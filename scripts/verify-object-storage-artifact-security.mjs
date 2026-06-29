#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { format } from "prettier";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const reportPath = path.join(
  repoRoot,
  "reports/object-storage-artifact-security-report.json"
);
const samplePath = path.join(
  repoRoot,
  "docs/examples/object-storage-artifact-security-report.sample.json"
);
const fixedGeneratedAt = "2026-06-22T00:00:00.000Z";

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    env: { ...process.env, ...options.env },
    encoding: "utf8",
    stdio: options.stdio ?? "pipe"
  });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function readText(relativePath) {
  return readFile(path.join(repoRoot, relativePath), "utf8");
}

async function readJson(relativePath) {
  return JSON.parse(await readText(relativePath));
}

function caseResult(id, status, evidence, notes = []) {
  return { id, status, evidence, notes };
}

async function main() {
  run("pnpm", ["--filter", "@searchlint/workers", "test"], {
    stdio: "inherit"
  });

  const cases = [];
  const template = await readJson(
    "infra/aws/artifact-storage-s3.cloudformation.json"
  );
  const resources = template.Resources ?? {};
  const crawlBucket = requiredResource(
    resources,
    "CrawlArtifactBucket",
    "AWS::S3::Bucket"
  ).Properties;
  const reportBucket = requiredResource(
    resources,
    "ReportArtifactBucket",
    "AWS::S3::Bucket"
  ).Properties;
  const accessLogBucket = requiredResource(
    resources,
    "ArtifactAccessLogBucket",
    "AWS::S3::Bucket"
  ).Properties;

  for (const [label, bucket] of [
    ["crawl artifact bucket", crawlBucket],
    ["report artifact bucket", reportBucket]
  ]) {
    assertPublicAccessBlocked(bucket, label);
    assertObjectOwnership(bucket, "BucketOwnerEnforced", label);
    assertEncrypted(bucket, label);
    assertVersioned(bucket, label);
    assertLogsToAccessLogBucket(bucket, label);
    assertHasMultipartAbort(bucket, label);
  }

  assertPublicAccessBlocked(accessLogBucket, "artifact access log bucket");
  assertObjectOwnership(
    accessLogBucket,
    "BucketOwnerPreferred",
    "artifact access log bucket"
  );
  assertEncrypted(accessLogBucket, "artifact access log bucket");
  assertVersioned(accessLogBucket, "artifact access log bucket");
  assertHasMultipartAbort(accessLogBucket, "artifact access log bucket");

  cases.push(
    caseResult("s3-private-encrypted-versioned-buckets", "PASS", {
      artifactBuckets: ["CrawlArtifactBucket", "ReportArtifactBucket"],
      accessLogBucket: "ArtifactAccessLogBucket",
      publicAccessBlocked: true,
      artifactObjectOwnership: "BucketOwnerEnforced",
      accessLogObjectOwnership: "BucketOwnerPreferred",
      encryptionConfigured: true,
      versioning: "Enabled"
    })
  );

  const crawlLifecycle = crawlBucket.LifecycleConfiguration?.Rules ?? [];
  const crawlExpiration = crawlLifecycle.find(
    (rule) => rule.Id === "expire-raw-crawl-artifacts"
  );
  assert(
    crawlExpiration?.ExpirationInDays?.Ref === "CrawlArtifactExpirationDays",
    "Crawl artifacts must expire through CrawlArtifactExpirationDays"
  );
  assert(
    crawlExpiration?.Prefix?.["Fn::Sub"] === "${CrawlArtifactKeyPrefix}/",
    "Crawl artifact expiration must be scoped to the configured prefix"
  );

  const reportLifecycle = reportBucket.LifecycleConfiguration?.Rules ?? [];
  assert(
    !reportLifecycle.some((rule) => rule.ExpirationInDays !== undefined),
    "Report artifact bucket must not use lifecycle expiration for report payload deletion"
  );
  const accessLogExpiration =
    accessLogBucket.LifecycleConfiguration?.Rules?.find(
      (rule) => rule.Id === "expire-artifact-access-logs"
    );
  assert(
    accessLogExpiration?.ExpirationInDays === 365,
    "Artifact access logs must have explicit retention"
  );

  cases.push(
    caseResult("s3-lifecycle-retention-and-deletion-controls", "PASS", {
      crawlExpirationParameter: "CrawlArtifactExpirationDays",
      reportDeletionAuthority: "PostgreSQL metadata and cleanup worker",
      accessLogRetentionDays: accessLogExpiration?.ExpirationInDays,
      multipartAbortDays: 7
    })
  );

  for (const name of [
    "CrawlArtifactBucketPolicy",
    "ReportArtifactBucketPolicy",
    "ArtifactAccessLogBucketPolicy"
  ]) {
    assertTlsOnlyPolicy(resources, name);
  }

  cases.push(
    caseResult("s3-tls-only-and-access-log-controls", "PASS", {
      tlsOnlyPolicies: [
        "CrawlArtifactBucketPolicy",
        "ReportArtifactBucketPolicy",
        "ArtifactAccessLogBucketPolicy"
      ],
      crawlLogPrefix: crawlBucket.LoggingConfiguration?.LogFilePrefix,
      reportLogPrefix: reportBucket.LoggingConfiguration?.LogFilePrefix
    })
  );

  const crawlStoreSource = await readText(
    "services/workers/src/s3-crawl-artifact-store.ts"
  );
  for (const fragment of [
    "organizations",
    "projects",
    "environments",
    "crawls",
    "result.json",
    "encodeURIComponent"
  ]) {
    assert(
      crawlStoreSource.includes(fragment),
      `Crawl artifact store must include ${fragment}`
    );
  }

  const crawlStoreTest = await readText(
    "services/workers/test/s3-crawl-artifact-store.test.ts"
  );
  assert(
    crawlStoreTest.includes(
      "stores crawl result artifacts as deterministic JSON objects"
    ),
    "Crawl artifact store must test deterministic JSON object writes"
  );
  assert(
    crawlStoreTest.includes("encodes tenant identifiers in object keys"),
    "Crawl artifact store must test encoded tenant identifiers"
  );

  cases.push(
    caseResult("crawl-artifact-tenant-scoped-keys", "PASS", {
      keySegments: [
        "organizations/{organizationId}",
        "projects/{projectId}",
        "environments/{environmentId}",
        "crawls/{crawlRequestId}",
        "result.json"
      ],
      pathEncoding: "encodeURIComponent",
      testFile: "services/workers/test/s3-crawl-artifact-store.test.ts"
    })
  );

  const reportStoreSource = await readText(
    "services/workers/src/s3-report-artifact-store.ts"
  );
  for (const fragment of [
    "new URL(uri)",
    'parsed.protocol !== "s3:"',
    "DeleteObjectCommand",
    "Report artifact URI must include an S3 object key"
  ]) {
    assert(
      reportStoreSource.includes(fragment),
      `Report artifact store must include ${fragment}`
    );
  }

  const reportStoreTest = await readText(
    "services/workers/test/s3-report-artifact-store.test.ts"
  );
  assert(
    reportStoreTest.includes(
      "rejects non-s3 and incomplete artifact URIs before sending"
    ),
    "Report artifact store must reject unsafe report artifact URIs before S3 sends"
  );

  cases.push(
    caseResult("report-artifact-safe-s3-delete-boundary", "PASS", {
      acceptedScheme: "s3://",
      rejectedBeforeSend: ["https://bucket/key", "s3://bucket", "not a uri"],
      deletionAuthority: "metadata-selected expired report artifacts only",
      testFile: "services/workers/test/s3-report-artifact-store.test.ts"
    })
  );

  const docs = await readText("docs/OBJECT_STORAGE_ARTIFACT_SECURITY.md");
  const normalizedDocs = docs.toLowerCase();
  for (const phrase of [
    "deterministic contract proof",
    "signed urls",
    "real s3 upload/download/delete proof",
    "tenant isolation",
    "access logs",
    "restore",
    "large artifacts"
  ]) {
    assert(
      normalizedDocs.includes(phrase),
      `Object storage doc must include ${phrase}`
    );
  }

  cases.push(
    caseResult("object-storage-security-documentation", "PASS", {
      document: "docs/OBJECT_STORAGE_ARTIFACT_SECURITY.md",
      runtimeProofClaimed: false,
      remainingGatesDocumented: true
    })
  );

  const report = {
    schemaVersion: 1,
    summary: {
      status: "PASS",
      generatedAt: fixedGeneratedAt,
      nodeVersion: process.version,
      caseCount: cases.length,
      passed: cases.length,
      failed: 0
    },
    cases,
    limitations: [
      "This verifier checks deterministic worker adapter tests, S3 CloudFormation controls, and object-storage security documentation.",
      "It does not deploy AWS resources, upload/download/delete real S3 objects, generate or validate signed URLs, restore objects, review real access logs, or transfer large artifacts.",
      "Real object-storage release proof still requires a deployed environment and externally captured operational evidence."
    ],
    remainingRuntimeGates: [
      "Deploy real S3/object storage stack.",
      "Upload/download/delete snapshot, crawl, and report artifacts against deployed buckets.",
      "Implement and verify signed URL generation, expiration, and access controls.",
      "Review server access logs after real artifact operations.",
      "Verify large artifact and multipart transfer behavior.",
      "Run object restore procedure against deployed storage."
    ]
  };

  await mkdir(path.dirname(reportPath), { recursive: true });
  await mkdir(path.dirname(samplePath), { recursive: true });
  const formattedReport = await format(JSON.stringify(report), {
    parser: "json"
  });
  await writeFile(reportPath, formattedReport);
  await writeFile(samplePath, formattedReport);

  console.log(
    `Object storage artifact security ${report.summary.status}: ${report.summary.passed}/${report.summary.caseCount} cases passed`
  );
  console.log(`Report: ${path.relative(repoRoot, reportPath)}`);
  console.log(`Sample: ${path.relative(repoRoot, samplePath)}`);
}

function requiredResource(resources, name, type) {
  const resource = resources[name];
  assert(resource, `${name} must exist`);
  assert(resource.Type === type, `${name} must be ${type}`);
  return resource;
}

function assertPublicAccessBlocked(bucket, label) {
  const config = bucket.PublicAccessBlockConfiguration;
  for (const property of [
    "BlockPublicAcls",
    "BlockPublicPolicy",
    "IgnorePublicAcls",
    "RestrictPublicBuckets"
  ]) {
    assert(config?.[property] === true, `${label} must set ${property}=true`);
  }
}

function assertObjectOwnership(bucket, expected, label) {
  const rules = bucket.OwnershipControls?.Rules ?? [];
  assert(
    rules.some((rule) => rule.ObjectOwnership === expected),
    `${label} must set ObjectOwnership=${expected}`
  );
}

function assertEncrypted(bucket, label) {
  const encryption =
    bucket.BucketEncryption?.ServerSideEncryptionConfiguration?.[0]
      ?.ServerSideEncryptionByDefault;
  assert(encryption?.SSEAlgorithm, `${label} must configure SSEAlgorithm`);
}

function assertVersioned(bucket, label) {
  assert(
    bucket.VersioningConfiguration?.Status === "Enabled",
    `${label} must enable versioning`
  );
}

function assertLogsToAccessLogBucket(bucket, label) {
  assert(
    bucket.LoggingConfiguration?.DestinationBucketName?.Ref ===
      "ArtifactAccessLogBucket",
    `${label} must log to ArtifactAccessLogBucket`
  );
  assert(
    bucket.LoggingConfiguration?.LogFilePrefix?.["Fn::Sub"]?.length > 0,
    `${label} must set a server access log prefix`
  );
}

function assertHasMultipartAbort(bucket, label) {
  const rules = bucket.LifecycleConfiguration?.Rules ?? [];
  assert(
    rules.some(
      (rule) => rule.AbortIncompleteMultipartUpload?.DaysAfterInitiation === 7
    ),
    `${label} must abort incomplete multipart uploads after 7 days`
  );
}

function assertTlsOnlyPolicy(resources, name) {
  const policy = requiredResource(resources, name, "AWS::S3::BucketPolicy");
  const statements = policy.Properties?.PolicyDocument?.Statement ?? [];
  assert(
    statements.some(
      (statement) =>
        statement.Effect === "Deny" &&
        statement.Principal === "*" &&
        statement.Action === "s3:*" &&
        statement.Condition?.Bool?.["aws:SecureTransport"] === "false"
    ),
    `${name} must deny non-TLS access`
  );
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
