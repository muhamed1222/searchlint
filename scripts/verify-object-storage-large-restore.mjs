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
  "reports/object-storage-large-restore-report.json"
);
const samplePath = path.join(
  repoRoot,
  "docs/examples/object-storage-large-restore-report.sample.json"
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
    "s3-crawl-artifact-store.test.ts",
    "object-storage-restore-contract.test.ts"
  ]);
  run("pnpm", ["--filter", "@searchlint/workers", "build"]);

  const [crawlSource, crawlTest, restoreSource, restoreTest] =
    await Promise.all([
      readText("services/workers/src/s3-crawl-artifact-store.ts"),
      readText("services/workers/test/s3-crawl-artifact-store.test.ts"),
      readText("services/workers/src/object-storage-restore-contract.ts"),
      readText("services/workers/test/object-storage-restore-contract.test.ts")
    ]);

  for (const phrase of [
    "ContentLength",
    "searchlint-sha256",
    "searchlint-byte-size",
    "sha256Hex",
    "Buffer.byteLength"
  ]) {
    assert(
      crawlSource.includes(phrase),
      `Crawl artifact store must include ${phrase}.`
    );
  }
  for (const phrase of [
    "stores large crawl artifacts with byte size and SHA-256 metadata",
    "toBeGreaterThan(500_000)",
    "ContentLength",
    "searchlint-sha256"
  ]) {
    assert(
      crawlTest.includes(phrase),
      `Large artifact tests must include ${phrase}.`
    );
  }
  for (const phrase of [
    "createObjectStorageRestorePlan",
    "expectedByteSize",
    "expectedSha256",
    "verify byte size equals expectedByteSize",
    "verify SHA-256 digest equals expectedSha256",
    "verify deleted artifacts are not restored into active service"
  ]) {
    assert(
      restoreSource.includes(phrase),
      `Restore contract must include ${phrase}.`
    );
  }
  assert(
    restoreTest.includes(
      "creates restore verification plans from s3 artifact metadata"
    ),
    "Restore tests must cover plan creation."
  );
  assert(
    restoreTest.includes("rejects invalid restore verification metadata"),
    "Restore tests must cover invalid metadata rejection."
  );

  const workers = await import("../services/workers/dist/src/index.js");
  const restorePlan = workers.createObjectStorageRestorePlan({
    artifactUri:
      "s3://searchlint-artifacts/prod/organizations/org-1/projects/project-1/environments/env-1/crawls/crawl-1/result.json",
    artifactType: "crawl-result",
    scope: {
      organizationId: "org-1",
      projectId: "project-1",
      environmentId: "env-1"
    },
    expectedByteSize: 524288,
    expectedSha256:
      "767ad9095c85f1c359bf3d811796b904f5f1a58c23e7c7ad82a2678e07a02b5e",
    requestedAt: "2026-06-22T10:00:00.000Z"
  });

  assert(
    restorePlan.validationSteps.length >= 5,
    "Restore plan must include concrete validation steps."
  );

  const report = {
    schemaVersion: 1,
    generatedBy: "searchlint-object-storage-large-restore-verifier",
    generatedAt,
    status: "passed",
    methodology: {
      liveS3Access: "not used by verifier",
      scope:
        "local large crawl artifact metadata and object-storage restore verification contract",
      tests: [
        "services/workers/test/s3-crawl-artifact-store.test.ts",
        "services/workers/test/object-storage-restore-contract.test.ts"
      ]
    },
    largeArtifacts: {
      status: "passed",
      evidence: {
        byteSizeMetadata: "searchlint-byte-size",
        sha256Metadata: "searchlint-sha256",
        contentLengthHeader: "ContentLength",
        largeFixtureMinimumBytes: 500000,
        sameS3AdapterBoundary: "createS3CrawlArtifactStore"
      }
    },
    restoreContract: {
      status: "passed",
      evidence: {
        bucket: restorePlan.bucket,
        key: restorePlan.key,
        artifactType: restorePlan.artifactType,
        scope: restorePlan.scope,
        expectedByteSize: restorePlan.expectedByteSize,
        expectedSha256: restorePlan.expectedSha256,
        validationSteps: restorePlan.validationSteps
      }
    },
    remainingGates: [
      "real S3 deployment",
      "live large artifact upload/download",
      "multipart upload execution against deployed storage",
      "real object restore from S3 versioning or backup",
      "production restore drill evidence"
    ]
  };

  await mkdir(path.dirname(reportPath), { recursive: true });
  await mkdir(path.dirname(samplePath), { recursive: true });
  await writeJson(reportPath, report);
  await writeJson(samplePath, report);

  console.log(
    `Object storage large/restore contract PASS: minimumBytes=${report.largeArtifacts.evidence.largeFixtureMinimumBytes}, restoreSteps=${restorePlan.validationSteps.length}`
  );
  console.log(`Report: ${path.relative(repoRoot, reportPath)}`);
  console.log(`Sample: ${path.relative(repoRoot, samplePath)}`);
}

async function readText(relativePath) {
  return readFile(path.join(repoRoot, relativePath), "utf8");
}

async function writeJson(filePath, data) {
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
