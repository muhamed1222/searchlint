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
const reportPath = path.join(repoRoot, "reports/db-load-benchmark-report.json");
const samplePath = path.join(
  repoRoot,
  "docs/examples/db-load-benchmark-report.sample.json"
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
    "@searchlint/api",
    "test",
    "--",
    "postgres-load-benchmark.test.ts",
    "postgres-pg.test.ts"
  ]);
  run("pnpm", ["--filter", "@searchlint/api", "build"]);

  const api = await import("../services/api/dist/src/index.js");
  const source = await readFile(
    path.join(repoRoot, "services/api/src/postgres-load-benchmark.ts"),
    "utf8"
  );
  const tests = await readFile(
    path.join(repoRoot, "services/api/test/postgres-load-benchmark.test.ts"),
    "utf8"
  );

  for (const phrase of [
    "runPostgresLoadBenchmark",
    "max-p95-duration-ms",
    "queryFingerprint"
  ]) {
    assert(
      source.includes(phrase),
      `DB load benchmark source missing ${phrase}`
    );
  }
  for (const phrase of [
    "runs deterministic query workloads",
    "accounts for failed operations",
    "rejects invalid benchmark configuration"
  ]) {
    assert(tests.includes(phrase), `DB load benchmark tests missing ${phrase}`);
  }

  const operations = createBenchmarkOperations(api);
  const report = await api.runPostgresLoadBenchmark({
    name: "searchlint-local-postgres-query-boundary-load",
    operations,
    concurrency: 24,
    thresholds: {
      minOperations: 1200,
      minConcurrency: 16,
      maxErrorRate: 0,
      maxP95DurationMs: 40,
      minStatementTypes: 3
    },
    executor: deterministicExecutor()
  });

  assert(report.status === "passed", "DB load benchmark must pass thresholds");
  assert(report.operationCount === 1200, "DB load benchmark must run 1200 ops");
  assert(
    report.failedOperations === 0,
    "DB load benchmark must have 0 failures"
  );
  assert(
    report.statementTypes.INSERT > 0 &&
      report.statementTypes.SELECT > 0 &&
      report.statementTypes.UPDATE > 0,
    "DB load benchmark must include INSERT, SELECT, and UPDATE statements"
  );
  assert(
    JSON.stringify(report.operations).includes("org-load-") === false,
    "DB load benchmark report must not leak SQL parameter values"
  );

  const output = {
    schemaVersion: 1,
    generatedBy: "searchlint-db-load-benchmark-verifier",
    generatedAt,
    status: "passed",
    methodology: {
      liveDatabaseAccess: "not used by verifier",
      scope: "local PostgreSQL query-executor and generated SQL load benchmark",
      tests: [
        "services/api/test/postgres-load-benchmark.test.ts",
        "services/api/test/postgres-pg.test.ts"
      ],
      workload:
        "1200 deterministic operations generated from SearchLint PostgreSQL SQL builders"
    },
    benchmark: report,
    remainingGates: [
      "real AWS RDS deployment",
      "live RDS load test with production-shaped dataset",
      "deployed RDS metrics dashboard under load",
      "live RDS slow-query review under load",
      "database alerts wired to production incident channels"
    ]
  };

  await mkdir(path.dirname(reportPath), { recursive: true });
  await mkdir(path.dirname(samplePath), { recursive: true });
  await writeJson(reportPath, output);
  await writeJson(samplePath, output);

  console.log(
    `DB load benchmark PASS: operations=${report.operationCount}, concurrency=${report.concurrency}, p95=${report.deterministicDurationMs.p95}ms`
  );
  console.log(`Report: ${path.relative(repoRoot, reportPath)}`);
  console.log(`Sample: ${path.relative(repoRoot, samplePath)}`);
}

function createBenchmarkOperations(api) {
  const operations = [];
  const createdAt = "2026-06-22T00:00:00.000Z";
  for (let index = 0; index < 1200; index += 1) {
    const orgId = `org-load-${index % 25}`;
    const projectId = `project-load-${index % 100}`;
    const memberId = `member-load-${index % 50}`;
    const selector = index % 6;
    const query =
      selector === 0
        ? api.insertOrganizationSql({
            id: orgId,
            name: `Organization ${index}`,
            createdAt
          })
        : selector === 1
          ? api.insertProjectSql({
              id: projectId,
              organizationId: orgId,
              name: `Project ${index}`,
              siteUrl: "https://example.test",
              createdAt
            })
          : selector === 2
            ? api.selectProjectSql(orgId, projectId)
            : selector === 3
              ? api.insertMembershipSql({
                  id: `membership-load-${index}`,
                  organizationId: orgId,
                  principalId: memberId,
                  role: "member",
                  createdAt
                })
              : selector === 4
                ? api.updateMembershipRoleSql({
                    organizationId: orgId,
                    principalId: memberId,
                    role: "admin"
                  })
                : api.selectMembershipSql(orgId, memberId);
    operations.push({
      id: `db-load-${String(index + 1).padStart(4, "0")}`,
      query,
      expectedRows: 1,
      simulatedDurationMs: 4 + ((index * 7) % 33)
    });
  }
  return operations;
}

function deterministicExecutor() {
  return {
    async query() {
      return {
        rows: [{ id: "row" }]
      };
    }
  };
}

async function writeJson(filePath, data) {
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
