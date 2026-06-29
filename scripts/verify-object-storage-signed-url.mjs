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
const generatedAt = "2026-06-22T00:00:00.000Z";
const reportPath = path.join(
  repoRoot,
  "reports/object-storage-signed-url-report.json"
);
const samplePath = path.join(
  repoRoot,
  "docs/examples/object-storage-signed-url-report.sample.json"
);
const sourcePath = path.join(
  repoRoot,
  "services/workers/src/s3-report-artifact-store.ts"
);
const testPath = path.join(
  repoRoot,
  "services/workers/test/s3-report-artifact-store.test.ts"
);

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
    "s3-report-artifact-store.test.ts"
  ]);
  run("pnpm", ["--filter", "@searchlint/workers", "build"]);

  const [sourceText, testText] = await Promise.all([
    readFile(sourcePath, "utf8"),
    readFile(testPath, "utf8")
  ]);

  for (const phrase of [
    "createReportArtifactSignedUrlService",
    "ReportArtifactSignedUrlPresigner",
    "maxTtlSeconds",
    'deletionState !== "active"',
    "Report artifact organization scope mismatch",
    "Report artifact project scope mismatch",
    "Report artifact environment scope mismatch",
    "parseS3ArtifactUri",
    "s3KeyFingerprint"
  ]) {
    assert(
      sourceText.includes(phrase),
      `Signed URL source must include ${phrase}.`
    );
  }

  for (const phrase of [
    "creates signed URLs only after matching report artifact scope",
    "rejects cross-scope report artifacts before presigning",
    "rejects deleted or expired artifacts before presigning",
    "enforces short positive TTL",
    'not.toContain("X-Amz-Signature")'
  ]) {
    assert(testText.includes(phrase), `Signed URL tests must cover ${phrase}.`);
  }

  const workers = await import("../services/workers/dist/src/index.js");
  const presignRequests = [];
  const service = workers.createReportArtifactSignedUrlService({
    maxTtlSeconds: 300,
    presigner: {
      async createSignedGetUrl(input) {
        presignRequests.push(input);
        return "https://signed.example.test/report?X-Amz-Signature=secret";
      }
    }
  });

  const request = {
    organizationId: "org-1",
    projectId: "project-1",
    environmentId: "env-1",
    principalId: "principal-1"
  };
  const artifact = {
    id: "report-1",
    organizationId: "org-1",
    projectId: "project-1",
    environmentId: "env-1",
    artifactUri:
      "s3://searchlint-reports/org-1/projects/project-1/reports/report-1.html",
    deletionState: "active",
    expiresAt: "2026-06-22T11:00:00.000Z"
  };

  const result = await service.createSignedUrl({
    request,
    artifact,
    ttlSeconds: 120,
    now: "2026-06-22T10:00:00.000Z"
  });
  assert(
    result.url.includes("X-Amz-Signature"),
    "Expected a signed URL result."
  );
  assert(
    !JSON.stringify(result.audit).includes("X-Amz-Signature") &&
      !JSON.stringify(result.audit).includes("secret"),
    "Audit evidence must not include signed URL secrets."
  );

  const deniedCases = [];
  for (const [id, patch, message] of [
    [
      "cross-organization",
      { artifact: { ...artifact, organizationId: "org-2" } },
      "Report artifact organization scope mismatch."
    ],
    [
      "cross-project",
      { artifact: { ...artifact, projectId: "project-2" } },
      "Report artifact project scope mismatch."
    ],
    [
      "cross-environment",
      { artifact: { ...artifact, environmentId: "env-2" } },
      "Report artifact environment scope mismatch."
    ],
    [
      "deleted-artifact",
      { artifact: { ...artifact, deletionState: "deleted" } },
      "Report artifact is not active."
    ],
    [
      "expired-artifact",
      { artifact: { ...artifact, expiresAt: "2026-06-22T09:59:59.000Z" } },
      "Report artifact is expired."
    ],
    [
      "too-long-ttl",
      { ttlSeconds: 301 },
      "Signed URL TTL exceeds the configured maximum."
    ]
  ]) {
    await service
      .createSignedUrl({
        request,
        artifact,
        ttlSeconds: 120,
        now: "2026-06-22T10:00:00.000Z",
        ...patch
      })
      .then(
        () => {
          throw new Error(`Expected ${id} to be denied.`);
        },
        (error) => {
          assert(error instanceof Error, `Expected ${id} to throw Error.`);
          assert(
            error.message === message,
            `Unexpected ${id} error: ${error.message}`
          );
          deniedCases.push({ id, status: "denied", reason: error.message });
        }
      );
  }

  assert(
    presignRequests.length === 1,
    "Only the authorized case may reach the presigner."
  );

  const report = {
    schemaVersion: 1,
    generatedBy: "searchlint-object-storage-signed-url-verifier",
    generatedAt,
    status: "passed",
    methodology: {
      liveS3Access: "not used by verifier",
      scope:
        "local hosted report artifact signed URL authorization contract with injected presigner",
      tests: ["services/workers/test/s3-report-artifact-store.test.ts"]
    },
    signedUrlContract: {
      status: "passed",
      authorizedCase: {
        artifactId: result.audit.artifactId,
        organizationId: result.audit.organizationId,
        projectId: result.audit.projectId,
        environmentId: result.audit.environmentId,
        principalId: result.audit.principalId,
        s3Bucket: result.audit.s3Bucket,
        s3KeyFingerprint: result.audit.s3KeyFingerprint,
        ttlSeconds: result.audit.ttlSeconds,
        expiresAt: result.expiresAt,
        signedUrlReturned: true,
        signedUrlStoredInEvidence: false
      },
      deniedCases,
      checkedBehaviors: [
        "authorized scope reaches the injected presigner",
        "cross-organization requests are denied before presigning",
        "cross-project requests are denied before presigning",
        "cross-environment requests are denied before presigning",
        "deleted artifacts are denied before presigning",
        "expired artifacts are denied before presigning",
        "TTL must be positive and no greater than the configured maximum",
        "audit evidence omits signed URL query strings and secrets"
      ]
    },
    remainingGates: [
      "live AWS S3 request signing",
      "denial after signed URL expiration in deployed storage",
      "denial after report deletion in deployed storage",
      "cross-tenant access denial against deployed S3/IAM",
      "hosted report UI access-control flow"
    ]
  };

  await mkdir(path.dirname(reportPath), { recursive: true });
  await mkdir(path.dirname(samplePath), { recursive: true });
  await writeJson(reportPath, report);
  await writeJson(samplePath, report);

  console.log(
    `Object storage signed URL PASS: denied=${deniedCases.length}, presignRequests=${presignRequests.length}`
  );
  console.log(`Report: ${path.relative(repoRoot, reportPath)}`);
  console.log(`Sample: ${path.relative(repoRoot, samplePath)}`);
}

async function writeJson(filePath, data) {
  const json = await format(`${JSON.stringify(data, null, 2)}\n`, {
    parser: "json"
  });
  await writeFile(filePath, json);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
