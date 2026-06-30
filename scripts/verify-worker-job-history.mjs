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
  "reports/worker-job-history-report.json"
);
const samplePath = path.join(
  repoRoot,
  "docs/examples/worker-job-history-report.sample.json"
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
    "crawl-job-history.test.ts",
    "postgres-crawl-job-store.test.ts"
  ]);
  run("pnpm", ["--filter", "@searchlint/workers", "build"]);

  const workers = await import("../services/workers/dist/src/index.js");
  const [historySource, historyTest, sqlSource] = await Promise.all([
    readText("services/workers/src/crawl-job-history.ts"),
    readText("services/workers/test/crawl-job-history.test.ts"),
    readText("services/api/src/postgres-repository-sql.ts")
  ]);

  for (const phrase of [
    "selectDashboardCrawlRunsSql",
    "summarizeCrawlJobHistory",
    "Crawl job history limit must be an integer from 1 to 100"
  ]) {
    assert(
      historySource.includes(phrase),
      `Job history source missing ${phrase}`
    );
  }
  for (const phrase of [
    "lists tenant/project/environment-scoped crawl job history",
    "summarizes status counts",
    "rejects invalid history rows"
  ]) {
    assert(historyTest.includes(phrase), `Job history tests missing ${phrase}`);
  }
  assert(
    sqlSource.includes(
      'WHERE "organization_id" = $1 AND "project_id" = $2 AND "environment_id" = $3'
    ),
    "Crawl history SQL must be tenant/project/environment scoped"
  );

  const jobs = [
    historyJob("queued", "queued", {}),
    historyJob("running", "running", {
      startedAt: "2026-06-22T00:01:00.000Z"
    }),
    historyJob("succeeded", "succeeded", {
      completedAt: "2026-06-22T00:02:00.000Z",
      artifactUri: "s3://searchlint-artifacts/crawls/succeeded/result.json"
    }),
    historyJob("failed", "failed", {
      failedAt: "2026-06-22T00:03:00.000Z",
      lastError: "timeout"
    }),
    historyJob("cancelled", "cancelled", {
      completedAt: "2026-06-22T00:04:00.000Z"
    })
  ];
  const summary = workers.summarizeCrawlJobHistory(jobs);
  assert(summary.total === 5, "Job history summary must include all jobs");
  assert(summary.failed === 1, "Job history summary must count failed jobs");
  assert(
    summary.latestTransitionAt === "2026-06-22T00:04:00.000Z",
    "Job history summary latest transition drifted"
  );

  const report = {
    schemaVersion: 1,
    generatedBy: "searchlint-worker-job-history-verifier",
    generatedAt,
    status: "passed",
    methodology: {
      liveDatabaseAccess: "not used by verifier",
      scope:
        "local PostgreSQL-backed worker crawl job history query and summary contract",
      tests: [
        "services/workers/test/crawl-job-history.test.ts",
        "services/workers/test/postgres-crawl-job-store.test.ts"
      ]
    },
    historyContract: {
      status: "passed",
      store: "createPostgresCrawlJobHistoryStore",
      sql: "selectDashboardCrawlRunsSql",
      scopeFields: ["organizationId", "projectId", "environmentId"],
      retainedFields: [
        "id",
        "status",
        "createdAt",
        "startedAt",
        "completedAt",
        "failedAt",
        "lastError",
        "artifactUri"
      ],
      maxLimit: 100
    },
    summary,
    remainingGates: [
      "real RDS-backed job history under deployed worker runtime",
      "live SQS/ECS job lifecycle history across retries and cancellations",
      "dashboard/API job history consumption from deployed storage",
      "retention/deletion review for production job history"
    ]
  };

  await mkdir(path.dirname(reportPath), { recursive: true });
  await mkdir(path.dirname(samplePath), { recursive: true });
  await writeJson(reportPath, report);
  await writeJson(samplePath, report);

  console.log(
    `Worker job history PASS: total=${summary.total}, latest=${summary.latestTransitionAt}`
  );
  console.log(`Report: ${path.relative(repoRoot, reportPath)}`);
  console.log(`Sample: ${path.relative(repoRoot, samplePath)}`);
}

function historyJob(id, status, overrides) {
  return {
    id,
    organizationId: "org-1",
    projectId: "project-1",
    environmentId: "env-1",
    requestedBy: "principal-1",
    maxUrls: 5,
    status,
    createdAt: "2026-06-22T00:00:00.000Z",
    ...overrides
  };
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
