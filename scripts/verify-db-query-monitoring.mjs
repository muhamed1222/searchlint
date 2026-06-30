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
  "reports/db-query-monitoring-report.json"
);
const samplePath = path.join(
  repoRoot,
  "docs/examples/db-query-monitoring-report.sample.json"
);
const sourcePath = path.join(repoRoot, "services/api/src/postgres-pg.ts");
const testPath = path.join(repoRoot, "services/api/test/postgres-pg.test.ts");

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
    "postgres-pg.test.ts"
  ]);
  run("pnpm", ["--filter", "@searchlint/api", "build"]);

  const [sourceText, testText] = await Promise.all([
    readFile(sourcePath, "utf8"),
    readFile(testPath, "utf8")
  ]);

  const requiredSourceEvidence = [
    "createMonitoredPostgresQueryExecutor",
    "PostgresQueryObservation",
    "slowQueryThresholdMs",
    "fingerprintQueryText",
    "statementType",
    "recordQueryObservation",
    "options.queryMonitor"
  ];
  for (const phrase of requiredSourceEvidence) {
    assert(
      sourceText.includes(phrase),
      `postgres-pg.ts must include ${phrase}.`
    );
  }

  const requiredTestEvidence = [
    "records sanitized query duration",
    "records failed queries",
    "does not fail the database operation when the monitoring sink fails",
    "wires query monitoring through transaction-scoped stores",
    "secret-org-id",
    "not.toContain"
  ];
  for (const phrase of requiredTestEvidence) {
    assert(
      testText.includes(phrase),
      `postgres-pg.test.ts must cover ${phrase}.`
    );
  }

  const api = await import("../services/api/dist/src/index.js");
  const observations = [];
  const monitorErrors = [];
  const executor = api.createMonitoredPostgresQueryExecutor(
    {
      async query(query) {
        if (query.text.includes("slow")) {
          return {
            rows: [{ id: "slow-row" }]
          };
        }
        if (query.text.includes("fail")) {
          throw new Error("database query failed");
        }
        return {
          rows: [{ id: "row-1" }, { id: "row-2" }]
        };
      }
    },
    {
      slowQueryThresholdMs: 50,
      now: steppedClock([0, 20, 20, 95, 95, 105]),
      observe(observation) {
        observations.push(observation);
      },
      observeError(error) {
        monitorErrors.push(
          error instanceof Error ? error.message : String(error)
        );
      }
    }
  );

  await executor.query({
    text: 'SELECT * FROM "organizations" WHERE "id" = $1;',
    values: ["secret-organization-id"]
  });
  await executor.query({
    text: 'SELECT * FROM "slow_table" WHERE "id" = $1;',
    values: ["secret-slow-id"]
  });
  await executor
    .query({
      text: 'SELECT * FROM "fail_table" WHERE "id" = $1;',
      values: ["secret-fail-id"]
    })
    .catch(() => undefined);

  assert(observations.length === 3, "Expected three query observations.");
  assert(
    observations.every((observation) =>
      /^[a-f0-9]{64}$/u.test(observation.fingerprint)
    ),
    "Every query observation must include a sha256 fingerprint."
  );
  assert(
    observations.some((observation) => observation.slow === true),
    "At least one slow query observation is required."
  );
  assert(
    observations.some((observation) => observation.status === "error"),
    "At least one failed query observation is required."
  );
  assert(
    !JSON.stringify(observations).includes("secret-"),
    "Query observations must not include SQL parameter values."
  );

  const report = {
    schemaVersion: 1,
    generatedBy: "searchlint-db-query-monitoring-verifier",
    generatedAt,
    status: "passed",
    methodology: {
      liveDatabaseAccess: "not used by verifier",
      scope:
        "local PostgreSQL query executor monitoring, slow-query classification, and transaction-manager wiring",
      tests: ["services/api/test/postgres-pg.test.ts"]
    },
    monitoring: {
      status: "passed",
      observations: observations.map((observation) => ({
        statementType: observation.statementType,
        durationMs: observation.durationMs,
        rowCount: observation.rowCount,
        slow: observation.slow,
        status: observation.status,
        fingerprint: observation.fingerprint,
        ...(observation.errorName === undefined
          ? {}
          : { errorName: observation.errorName })
      })),
      checkedBehaviors: [
        "successful query observations include duration, row count, fingerprint, and statement type",
        "failed query observations include sanitized error name and still propagate the database error",
        "slow queries are flagged at or above the configured threshold",
        "SQL parameter values are omitted from observations",
        "monitoring sink failures do not fail database operations",
        "transaction-scoped stores can use the monitored executor"
      ],
      monitoringErrors: monitorErrors
    },
    remainingGates: [
      "real database load test",
      "deployed CloudWatch database metrics dashboard",
      "live RDS slow-query review",
      "database alerts wired to production incident channels"
    ]
  };

  await mkdir(path.dirname(reportPath), { recursive: true });
  await mkdir(path.dirname(samplePath), { recursive: true });
  await writeJson(reportPath, report);
  await writeJson(samplePath, report);

  console.log(
    `DB query monitoring PASS: observations=${observations.length}, slow=${observations.filter((entry) => entry.slow).length}, failed=${observations.filter((entry) => entry.status === "error").length}`
  );
  console.log(`Report: ${path.relative(repoRoot, reportPath)}`);
  console.log(`Sample: ${path.relative(repoRoot, samplePath)}`);
}

function steppedClock(values) {
  const steps = [...values];
  return () => {
    const value = steps.shift();
    if (value === undefined) {
      throw new Error("verifier clock exhausted");
    }
    return value;
  };
}

async function writeJson(filePath, data) {
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
