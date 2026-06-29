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
  "reports/worker-backoff-cancel-report.json"
);
const samplePath = path.join(
  repoRoot,
  "docs/examples/worker-backoff-cancel-report.sample.json"
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
    "sqs-crawler-consumer.test.ts",
    "production-log-sink.test.ts"
  ]);
  run("pnpm", ["--filter", "@searchlint/workers", "build"]);

  const workers = await import("../services/workers/dist/src/index.js");
  const [consumerSource, consumerTest, logTest] = await Promise.all([
    readText("services/workers/src/sqs-crawler-consumer.ts"),
    readText("services/workers/test/sqs-crawler-consumer.test.ts"),
    readText("services/workers/test/production-log-sink.test.ts")
  ]);

  for (const phrase of [
    "ChangeMessageVisibilityCommand",
    "sqsCrawlerBackoffVisibilityTimeoutSeconds",
    "isCrawlCanceled"
  ]) {
    assert(
      consumerSource.includes(phrase),
      `Worker consumer missing ${phrase}`
    );
  }
  for (const phrase of [
    "applies deterministic backoff by changing visibility",
    "deletes canceled crawl jobs without executing them",
    "calculates bounded retry backoff visibility timeouts"
  ]) {
    assert(consumerTest.includes(phrase), `Worker tests missing ${phrase}`);
  }
  for (const phrase of [
    "searchlint.crawler.canceled",
    "searchlint.crawler.backoff_applied"
  ]) {
    assert(logTest.includes(phrase), `Production log tests missing ${phrase}`);
  }

  const policy = {
    baseVisibilityTimeoutSeconds: 15,
    maxVisibilityTimeoutSeconds: 300,
    multiplier: 2
  };
  const receiveCounts = [1, 2, 3, 4, 5, 8];
  const backoffSchedule = receiveCounts.map((approximateReceiveCount) => ({
    approximateReceiveCount,
    visibilityTimeoutSeconds: workers.sqsCrawlerBackoffVisibilityTimeoutSeconds(
      {
        approximateReceiveCount,
        policy
      }
    )
  }));
  assert(
    JSON.stringify(backoffSchedule) ===
      JSON.stringify([
        { approximateReceiveCount: 1, visibilityTimeoutSeconds: 15 },
        { approximateReceiveCount: 2, visibilityTimeoutSeconds: 30 },
        { approximateReceiveCount: 3, visibilityTimeoutSeconds: 60 },
        { approximateReceiveCount: 4, visibilityTimeoutSeconds: 120 },
        { approximateReceiveCount: 5, visibilityTimeoutSeconds: 240 },
        { approximateReceiveCount: 8, visibilityTimeoutSeconds: 300 }
      ]),
    "Backoff schedule drifted"
  );

  const report = {
    schemaVersion: 1,
    generatedBy: "searchlint-worker-backoff-cancel-verifier",
    generatedAt,
    status: "passed",
    methodology: {
      liveSqsAccess: "not used by verifier",
      scope:
        "local SQS crawler worker retry backoff and job cancellation contract",
      tests: [
        "services/workers/test/sqs-crawler-consumer.test.ts",
        "services/workers/test/production-log-sink.test.ts"
      ]
    },
    backoff: {
      status: "passed",
      policy,
      schedule: backoffSchedule,
      sqsCommand: "ChangeMessageVisibilityCommand",
      boundedByMaxVisibilityTimeout: true
    },
    cancellation: {
      status: "passed",
      guard: "isCrawlCanceled",
      behavior:
        "canceled crawl jobs are counted, deleted, and skipped before target resolution/fetch/artifact writes"
    },
    observability: {
      status: "passed",
      counters: [
        "searchlint.crawler.canceled",
        "searchlint.crawler.backoff_applied"
      ]
    },
    remainingGates: [
      "real SQS deployment",
      "live retry/backoff behavior against deployed SQS",
      "live cancellation API and persisted job-state integration",
      "DLQ redrive and replay proof",
      "worker metrics and alerts under deployed runtime"
    ]
  };

  await mkdir(path.dirname(reportPath), { recursive: true });
  await mkdir(path.dirname(samplePath), { recursive: true });
  await writeJson(reportPath, report);
  await writeJson(samplePath, report);

  console.log(
    `Worker backoff/cancellation PASS: backoffSteps=${backoffSchedule.length}, cancellation=guarded`
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
