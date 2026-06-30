#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const reportPath = path.join(
  repoRoot,
  "reports/object-storage-upload-contract-report.json"
);
const samplePath = path.join(
  repoRoot,
  "docs/examples/object-storage-upload-contract-report.sample.json"
);
const generatedAt = "2026-06-23T00:00:00.000Z";

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

async function main() {
  run(pnpmCommand(), [
    "--filter",
    "@searchlint/workers",
    "test",
    "--",
    "s3-crawl-artifact-store.test.ts",
    "s3-page-snapshot-artifact-store.test.ts"
  ]);
  run(pnpmCommand(), ["--filter", "@searchlint/workers", "build"]);

  const workers = await import("../services/workers/dist/src/index.js");
  const snapshotHarness = createPutObjectHarness();
  const crawlHarness = createPutObjectHarness();

  const snapshotStore = workers.createS3PageSnapshotArtifactStore({
    client: snapshotHarness.client,
    bucket: "searchlint-artifacts",
    keyPrefix: "prod"
  });
  const crawlStore = workers.createS3CrawlArtifactStore({
    client: crawlHarness.client,
    bucket: "searchlint-artifacts",
    keyPrefix: "prod"
  });

  const snapshotResult = await snapshotStore.putPageSnapshot(
    pageSnapshotArtifact()
  );
  const crawlResult = await crawlStore.putCrawlResult(crawlArtifact());
  const snapshotCommand = snapshotHarness.commands[0]?.input;
  const crawlCommand = crawlHarness.commands[0]?.input;

  assert(snapshotCommand, "Snapshot upload did not send PutObjectCommand.");
  assert(crawlCommand, "Crawl upload did not send PutObjectCommand.");
  assertUploadCommand(snapshotCommand, "page.snapshot");
  assertUploadCommand(crawlCommand);

  const report = {
    schemaVersion: 1,
    generatedBy: "searchlint-object-storage-upload-contract-verifier",
    generatedAt,
    status: "passed",
    liveS3Access: "not used by verifier",
    coverage: {
      snapshotUploadPutObject: true,
      crawlUploadPutObject: true,
      tenantScopedKeys: true,
      deterministicJsonBodies: true,
      contentLengthMetadata: true,
      sha256Metadata: true
    },
    uploads: [
      uploadSummary("snapshot", snapshotResult, snapshotCommand),
      uploadSummary("crawl", crawlResult, crawlCommand)
    ],
    assertions: [
      {
        id: "snapshot-upload-contract",
        status: "passed"
      },
      {
        id: "crawl-upload-contract",
        status: "passed"
      },
      {
        id: "tenant-scoped-object-keys",
        status: "passed"
      },
      {
        id: "byte-size-and-sha256-metadata",
        status: "passed"
      }
    ],
    releaseGates: {
      snapshotUploadContract: "passed",
      crawlArtifactUploadContract: "passed",
      realObjectStorageDeployment: "not_claimed",
      liveS3UploadDownloadDelete: "not_claimed",
      finalS3Proof: "not_claimed"
    }
  };

  assertNoSensitiveValues(JSON.stringify(report));
  await writeJson(reportPath, report);
  await writeJson(samplePath, report);
  console.log("Object storage upload contract PASS.");
  console.log(`Report: ${path.relative(repoRoot, reportPath)}`);
  console.log(`Sample: ${path.relative(repoRoot, samplePath)}`);
}

function assertUploadCommand(command, expectedArtifactType) {
  assert(command.Bucket === "searchlint-artifacts", "Bucket mismatch.");
  assert(
    typeof command.Key === "string" &&
      command.Key.startsWith("prod/organizations/org-1/projects/project-1/"),
    "Object key must be tenant-scoped."
  );
  assert(command.ContentType === "application/json", "ContentType mismatch.");
  assert(
    typeof command.Body === "string" && command.Body.startsWith("{"),
    "Body must be deterministic JSON."
  );
  assert(
    command.ContentLength === Buffer.byteLength(command.Body, "utf8"),
    "ContentLength must match body byte length."
  );
  assert(
    /^[a-f0-9]{64}$/u.test(command.Metadata?.["searchlint-sha256"] ?? ""),
    "SHA-256 metadata is missing."
  );
  assert(
    command.Metadata?.["searchlint-byte-size"] ===
      String(command.ContentLength),
    "Byte-size metadata mismatch."
  );
  if (expectedArtifactType) {
    assert(
      command.Metadata?.["searchlint-artifact-type"] === expectedArtifactType,
      "Artifact type metadata mismatch."
    );
  }
}

function uploadSummary(kind, result, command) {
  return {
    kind,
    artifactUri: result.artifactUri,
    key: command.Key,
    contentType: command.ContentType,
    contentLength: command.ContentLength,
    byteSize: result.byteSize,
    sha256: result.sha256,
    metadataKeys: Object.keys(command.Metadata ?? {}).sort()
  };
}

function pageSnapshotArtifact() {
  return {
    schemaVersion: 1,
    type: "page.snapshot",
    organizationId: "org-1",
    projectId: "project-1",
    environmentId: "env-1",
    snapshotId: "snapshot-1",
    snapshot: {
      pageUrl: "https://example.com/",
      route: "/",
      capturedAt: "2026-06-23T00:00:00.000Z",
      http: {
        status: 200,
        finalUrl: "https://example.com/",
        headers: {
          "content-type": "text/html"
        }
      },
      rawHtml: "<html><head><title>Example</title></head><body></body></html>",
      renderedDom:
        "<html><head><title>Example</title></head><body><main></main></body></html>"
    }
  };
}

function crawlArtifact() {
  return {
    schemaVersion: 1,
    type: "crawl.result",
    payload: {
      crawlRequestId: "crawl-1",
      organizationId: "org-1",
      projectId: "project-1",
      environmentId: "env-1",
      maxUrls: 5
    },
    target: {
      startUrl: "https://example.com/"
    },
    result: {
      startUrl: "https://example.com/",
      pages: [],
      skipped: []
    },
    completedAt: "2026-06-23T00:00:01.000Z"
  };
}

function createPutObjectHarness() {
  const commands = [];
  return {
    commands,
    client: {
      async send(command) {
        assert(
          command?.constructor?.name === "PutObjectCommand",
          "Expected PutObjectCommand."
        );
        commands.push(command);
        return {
          ETag: "etag-1",
          $metadata: {}
        };
      }
    }
  };
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function run(command, args) {
  return execFileSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "inherit"
  });
}

function assertNoSensitiveValues(text) {
  const forbidden = [
    /postgres:\/\/(?!\[REDACTED\])/i,
    /postgresql:\/\/(?!\[REDACTED\])/i,
    /private_key/i,
    /client-secret/i,
    /authorization:/i,
    /bearer\s+/i,
    /cookie:/i,
    /set-cookie:/i,
    /sk_live/i,
    /whsec_/i,
    /-----BEGIN PRIVATE KEY-----/i
  ];
  const match = forbidden.find((pattern) => pattern.test(text));
  if (match) {
    throw new Error(`Sensitive value leaked into upload evidence: ${match}`);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function pnpmCommand() {
  return process.platform === "win32" ? "pnpm.cmd" : "pnpm";
}
