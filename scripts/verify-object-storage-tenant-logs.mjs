#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const generatedAt = "2026-06-22T00:00:00.000Z";
const reportPath = path.join(
  repoRoot,
  "reports/object-storage-tenant-logs-report.json"
);
const samplePath = path.join(
  repoRoot,
  "docs/examples/object-storage-tenant-logs-report.sample.json"
);

const secretPattern =
  /X-Amz-Signature|authorization|bearer|token|secret|password|credential|api[-_]?key|refresh[-_]?token|access[-_]?token/i;

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

async function main() {
  run("pnpm", [
    "--filter",
    "@searchlint/workers",
    "test",
    "--",
    "s3-crawl-artifact-store.test.ts",
    "s3-report-artifact-store.test.ts"
  ]);
  run("pnpm", ["--filter", "@searchlint/workers", "build"]);

  const [template, crawlSource, crawlTest, reportSource, reportTest] =
    await Promise.all([
      readJson("infra/aws/artifact-storage-s3.cloudformation.json"),
      readText("services/workers/src/s3-crawl-artifact-store.ts"),
      readText("services/workers/test/s3-crawl-artifact-store.test.ts"),
      readText("services/workers/src/s3-report-artifact-store.ts"),
      readText("services/workers/test/s3-report-artifact-store.test.ts")
    ]);

  const resources = template.Resources ?? {};
  const crawlBucket = requiredBucket(resources, "CrawlArtifactBucket");
  const reportBucket = requiredBucket(resources, "ReportArtifactBucket");
  const accessLogBucket = requiredBucket(resources, "ArtifactAccessLogBucket");
  const crawlLogPrefix = crawlBucket.LoggingConfiguration?.LogFilePrefix;
  const reportLogPrefix = reportBucket.LoggingConfiguration?.LogFilePrefix;

  assert(
    crawlBucket.LoggingConfiguration?.DestinationBucketName?.Ref ===
      "ArtifactAccessLogBucket",
    "Crawl artifact bucket must write access logs to ArtifactAccessLogBucket."
  );
  assert(
    reportBucket.LoggingConfiguration?.DestinationBucketName?.Ref ===
      "ArtifactAccessLogBucket",
    "Report artifact bucket must write access logs to ArtifactAccessLogBucket."
  );
  assert(
    crawlLogPrefix?.["Fn::Sub"] === "crawl-artifacts/${EnvironmentName}/",
    "Crawl artifact access logs must use the stable crawl prefix."
  );
  assert(
    reportLogPrefix?.["Fn::Sub"] === "report-artifacts/${EnvironmentName}/",
    "Report artifact access logs must use the stable report prefix."
  );

  const accessLogRetentionRule =
    accessLogBucket.LifecycleConfiguration?.Rules?.find(
      (rule) => rule.Id === "expire-artifact-access-logs"
    );
  assert(
    accessLogRetentionRule?.ExpirationInDays === 365,
    "Artifact access logs must have explicit 365-day retention."
  );

  for (const phrase of [
    "organizations",
    "projects",
    "environments",
    "crawls",
    "result.json",
    "encodeURIComponent"
  ]) {
    assert(crawlSource.includes(phrase), `Crawl store must include ${phrase}.`);
  }
  assert(
    crawlTest.includes("encodes tenant identifiers in object keys"),
    "Crawl store tests must cover encoded tenant identifiers."
  );
  assert(
    crawlTest.includes(
      "organizations/org%2Fone/projects/project%20one/environments/env%231/crawls/crawl%3F1/result.json"
    ),
    "Crawl store tests must prove path segment escaping."
  );

  for (const phrase of [
    "Report artifact organization scope mismatch",
    "Report artifact project scope mismatch",
    "Report artifact environment scope mismatch",
    "Report artifact is not active",
    "Report artifact is expired",
    "s3KeyFingerprint"
  ]) {
    assert(
      reportSource.includes(phrase),
      `Report signed URL source must include ${phrase}.`
    );
  }
  assert(
    reportTest.includes(
      "rejects cross-scope report artifacts before presigning"
    ),
    "Report signed URL tests must cover cross-scope denial."
  );
  assert(
    reportSource.includes("DeleteObjectCommand") &&
      reportTest.includes(
        "rejects non-s3 and incomplete artifact URIs before sending"
      ),
    "Report artifact deletion must stay metadata-selected and s3:// bounded."
  );

  const accessLoggableKeys = [
    "crawl-artifacts/prod/organizations/org-1/projects/project-1/environments/env-1/crawls/crawl-1/result.json",
    "report-artifacts/prod/organizations/org-1/projects/project-1/environments/env-1/reports/report-1.html",
    "organizations/org%2Fone/projects/project%20one/environments/env%231/crawls/crawl%3F1/result.json"
  ];
  for (const key of accessLoggableKeys) {
    assert(
      !key.includes("?"),
      `Access-loggable key must not contain query string: ${key}`
    );
    assert(
      !secretPattern.test(key),
      `Access-loggable key must not include secrets: ${key}`
    );
  }

  const report = {
    schemaVersion: 1,
    generatedBy: "searchlint-object-storage-tenant-logs-verifier",
    generatedAt,
    status: "passed",
    methodology: {
      liveS3Access: "not used by verifier",
      scope:
        "local object-storage tenant-isolation, access-log configuration, and access-loggable key hygiene",
      tests: [
        "services/workers/test/s3-crawl-artifact-store.test.ts",
        "services/workers/test/s3-report-artifact-store.test.ts"
      ]
    },
    tenantIsolation: {
      status: "passed",
      evidence: {
        crawlArtifactKeyShape:
          "{prefix}/organizations/{organizationId}/projects/{projectId}/environments/{environmentId}/crawls/{crawlRequestId}/result.json",
        tenantPathSegmentEncoding: "encodeURIComponent",
        reportSignedUrlDeniedCases: [
          "cross-organization",
          "cross-project",
          "cross-environment",
          "deleted-artifact",
          "expired-artifact"
        ],
        reportDeletionBoundary:
          "metadata-selected expired report artifacts and s3:// URI parsing only"
      }
    },
    accessLogs: {
      status: "passed",
      evidence: {
        destinationBucket: "ArtifactAccessLogBucket",
        crawlLogPrefix,
        reportLogPrefix,
        accessLogRetentionDays: accessLogRetentionRule.ExpirationInDays,
        accessLoggableKeySamples: accessLoggableKeys,
        secretBearingFragmentsDetected: false
      }
    },
    remainingGates: [
      "real S3 deployment",
      "live access-log file review after upload/download/delete operations",
      "deployed cross-tenant S3/IAM denial proof",
      "live hosted report access-control flow",
      "real object restore proof"
    ]
  };

  await mkdir(path.dirname(reportPath), { recursive: true });
  await mkdir(path.dirname(samplePath), { recursive: true });
  await writeJson(reportPath, report);
  await writeJson(samplePath, report);

  console.log(
    `Object storage tenant/access-log contract PASS: keySamples=${accessLoggableKeys.length}, accessLogRetentionDays=${accessLogRetentionRule.ExpirationInDays}`
  );
  console.log(`Report: ${path.relative(repoRoot, reportPath)}`);
  console.log(`Sample: ${path.relative(repoRoot, samplePath)}`);
}

async function readText(relativePath) {
  return readFile(path.join(repoRoot, relativePath), "utf8");
}

async function readJson(relativePath) {
  return JSON.parse(await readText(relativePath));
}

function requiredBucket(resources, name) {
  const resource = resources[name];
  assert(resource?.Type === "AWS::S3::Bucket", `${name} must be an S3 bucket.`);
  return resource.Properties ?? {};
}

async function writeJson(filePath, data) {
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
