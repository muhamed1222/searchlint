#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const generatedAt = "2026-06-22T00:00:00.000Z";
const reportPath = path.join(
  repoRoot,
  "reports/db-pool-transaction-report.json"
);
const samplePath = path.join(
  repoRoot,
  "docs/examples/db-pool-transaction-report.sample.json"
);

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    env: { ...process.env, ...options.env },
    encoding: "utf8",
    stdio: options.stdio ?? "pipe"
  });
}

async function main() {
  run("pnpm", [
    "--filter",
    "@searchlint/api",
    "test",
    "--",
    "postgres-env.test.ts",
    "postgres-pg.test.ts"
  ]);

  const report = {
    schemaVersion: 1,
    generatedBy: "searchlint-db-pool-transaction-verifier",
    generatedAt,
    status: "passed",
    methodology: {
      liveDatabaseAccess: "not used by verifier",
      scope:
        "local @searchlint/api PostgreSQL pool environment contract and transaction manager behavior",
      tests: [
        "services/api/test/postgres-env.test.ts",
        "services/api/test/postgres-pg.test.ts"
      ]
    },
    connectionPooling: {
      status: "passed",
      evidence: {
        factory: "createPgPoolFromEnv",
        syntheticDatabaseUrl: "postgres://user:REDACTED@example.test/db",
        envVariables: [
          "SEARCHLINT_POSTGRES_DATABASE_URL",
          "SEARCHLINT_POSTGRES_POOL_MAX",
          "SEARCHLINT_POSTGRES_IDLE_TIMEOUT_MS",
          "SEARCHLINT_POSTGRES_CONNECTION_TIMEOUT_MS",
          "SEARCHLINT_POSTGRES_SSL_MODE"
        ],
        checkedBehaviors: [
          "pool max size is parsed as a positive integer",
          "idle timeout is parsed as a positive integer",
          "connection timeout is parsed as a positive integer",
          "SSL require maps to rejectUnauthorized true",
          "SSL disable omits SSL config",
          "custom env prefixes are supported",
          "missing database URL fails",
          "invalid numeric values fail without exposing database URL"
        ]
      }
    },
    transactions: {
      status: "passed",
      evidence: {
        factory: "createPgCloudTransactionManager",
        checkedBehaviors: [
          "pool.connect acquires a transaction client",
          "successful operations issue BEGIN then COMMIT",
          "failed operations issue BEGIN then ROLLBACK",
          "transaction-scoped stores use the acquired client executor",
          "client.release is called after commit",
          "client.release is called after rollback",
          "optional outbox store is wired only when configured"
        ],
        expectedControlStatements: ["BEGIN", "COMMIT", "ROLLBACK"]
      }
    }
  };

  await mkdir(path.dirname(reportPath), { recursive: true });
  await mkdir(path.dirname(samplePath), { recursive: true });
  await writeJson(reportPath, report);
  await writeJson(samplePath, report);

  console.log(
    "DB pool/transaction PASS: pool env contract and transaction manager tests passed"
  );
  console.log(`Report: ${path.relative(repoRoot, reportPath)}`);
  console.log(`Sample: ${path.relative(repoRoot, samplePath)}`);
}

async function writeJson(filePath, data) {
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
