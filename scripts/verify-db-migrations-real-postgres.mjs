#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const reportPath = path.join(
  repoRoot,
  "reports/db-migrations-real-postgres-report.json"
);
const samplePath = path.join(
  repoRoot,
  "docs/examples/db-migrations-real-postgres-report.sample.json"
);
const generatedAt = "2026-06-23T00:00:00.000Z";
const databaseUser = "searchlint";
const databaseName = "searchlint";

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

async function main() {
  run(pnpmCommand(), ["--filter", "@searchlint/api", "build"]);

  const providedDatabaseUrl =
    process.env.SEARCHLINT_POSTGRES_TEST_DATABASE_URL?.trim();
  if (providedDatabaseUrl) {
    await runMigrationProof(providedDatabaseUrl, "provided-database-url");
    return;
  }

  await withTemporaryLocalPostgres(async (databaseUrl) => {
    await runMigrationProof(databaseUrl, "temporary-local-postgres-binaries");
  });
}

async function withTemporaryLocalPostgres(operation) {
  assertCommandAvailable("initdb");
  assertCommandAvailable("pg_ctl");
  assertCommandAvailable("createdb");

  const dataDirectory = await mkdtemp(
    path.join(tmpdir(), "searchlint-migrations-postgres-")
  );
  const port = String(24_000 + (process.pid % 16_000));
  let started = false;

  try {
    console.log("Starting temporary PostgreSQL cluster for migrations.");
    run("initdb", [
      "--pgdata",
      dataDirectory,
      "--username",
      databaseUser,
      "--auth",
      "trust",
      "--no-locale"
    ]);
    runQuiet("pg_ctl", [
      "--pgdata",
      dataDirectory,
      "--options",
      `-F -p ${port} -c listen_addresses=127.0.0.1`,
      "--wait",
      "start"
    ]);
    started = true;
    run("createdb", [
      "--host",
      "127.0.0.1",
      "--port",
      port,
      "--username",
      databaseUser,
      databaseName
    ]);

    await operation(
      `postgres://${databaseUser}@127.0.0.1:${port}/${databaseName}`
    );
  } finally {
    if (started) {
      console.log("Stopping temporary PostgreSQL cluster.");
      spawnSync("pg_ctl", ["--pgdata", dataDirectory, "--wait", "stop"], {
        stdio: "ignore"
      });
    }
    await rm(dataDirectory, { recursive: true, force: true });
  }
}

async function runMigrationProof(databaseUrl, mode) {
  const api = await import("../services/api/dist/src/index.js");
  const pool = api.createPgPoolFromEnv(
    {
      TEST_DATABASE_URL: databaseUrl,
      TEST_POOL_MAX: "1",
      TEST_CONNECTION_TIMEOUT_MS: "5000",
      TEST_SSL_MODE: process.env.SEARCHLINT_POSTGRES_TEST_SSL_MODE ?? "disable"
    },
    {
      prefix: "TEST"
    }
  );

  try {
    const migrations = api.createCurrentCloudSchemaMigrations();
    const first = await api.runPostgresMigrations({
      pool,
      appliedAt: "2026-06-23T00:00:00.000Z"
    });
    const second = await api.runPostgresMigrations({
      pool,
      appliedAt: "2026-06-23T00:00:01.000Z"
    });
    const ledger = await pool.query(
      'SELECT "id", "checksum" FROM "searchlint_schema_migrations" ORDER BY "id" ASC;'
    );
    const columns = await pool.query(
      `SELECT "table_name", "column_name", "data_type"
       FROM information_schema.columns
       WHERE "table_schema" = 'public'
         AND "table_name" IN ('organizations', 'projects', 'environments', 'crawl_requests', 'outbox_events')
       ORDER BY "table_name" ASC, "column_name" ASC;`
    );

    const migrationDefinitions = migrations.map((migration) => ({
      id: migration.id,
      checksum: migration.checksum,
      statementCount: migration.statements.length
    }));
    assertMigrationResults(first, second, migrationDefinitions);
    assertLedger(ledger.rows, migrationDefinitions);
    const checkedColumns = assertColumns(columns.rows);

    const report = {
      schemaVersion: 1,
      generatedBy: "searchlint-db-migrations-real-postgres-verifier",
      generatedAt,
      status: "passed",
      execution: {
        mode,
        databaseUrlRedacted: true,
        localPostgresBinaries:
          mode === "temporary-local-postgres-binaries"
            ? ["initdb", "pg_ctl", "createdb"]
            : [],
        buildCommand: "pnpm --filter @searchlint/api build"
      },
      migrationDefinitions,
      firstRun: first,
      secondRun: second,
      ledger: ledger.rows.map((row) => ({
        id: String(row.id),
        checksum: String(row.checksum)
      })),
      checkedColumns,
      assertions: [
        {
          id: "migration-first-run-applies-current-chain",
          status: "passed"
        },
        {
          id: "migration-second-run-skips-current-chain",
          status: "passed"
        },
        {
          id: "migration-ledger-matches-runtime-definitions",
          status: "passed"
        },
        {
          id: "migration-schema-columns-exist",
          status: "passed"
        }
      ],
      releaseGates: {
        databaseMigrationsExecutedAgainstRealPostgres: "passed",
        productionRdsDeployment: "not_claimed",
        productionMigrationWorkflow: "not_claimed"
      }
    };

    assertNoSensitiveValues(JSON.stringify(report));
    await writeJson(reportPath, report);
    await writeJson(samplePath, report);
    console.log(
      `Real PostgreSQL migrations PASS: applied=${first.applied.length}, skipped=${second.skipped.length}`
    );
    console.log(`Report: ${path.relative(repoRoot, reportPath)}`);
    console.log(`Sample: ${path.relative(repoRoot, samplePath)}`);
  } finally {
    await pool.end();
  }
}

function assertMigrationResults(first, second, definitions) {
  const ids = definitions.map((migration) => migration.id);
  assert(
    JSON.stringify(first.applied) === JSON.stringify(ids),
    "First migration run must apply every current migration in order."
  );
  assert(first.skipped.length === 0, "First migration run must not skip.");
  assert(
    second.applied.length === 0,
    "Second migration run must not apply migrations."
  );
  assert(
    JSON.stringify(second.skipped) === JSON.stringify(ids),
    "Second migration run must skip every current migration in order."
  );
}

function assertLedger(rows, definitions) {
  assert(
    rows.length === definitions.length,
    "Migration ledger must contain every current migration."
  );
  for (const definition of definitions) {
    const row = rows.find((entry) => entry.id === definition.id);
    assert(row, `Migration ledger is missing ${definition.id}.`);
    assert(
      row.checksum === definition.checksum,
      `Migration ledger checksum mismatch for ${definition.id}.`
    );
  }
}

function assertColumns(rows) {
  const requiredColumns = [
    ["organizations", "id"],
    ["projects", "organization_id"],
    ["environments", "project_id"],
    ["crawl_requests", "started_at"],
    ["crawl_requests", "completed_at"],
    ["crawl_requests", "failed_at"],
    ["crawl_requests", "last_error"],
    ["crawl_requests", "artifact_uri"],
    ["outbox_events", "payload"]
  ];
  const available = new Set(
    rows.map((row) => `${row.table_name}.${row.column_name}`)
  );
  for (const [table, column] of requiredColumns) {
    assert(
      available.has(`${table}.${column}`),
      `Migrated schema is missing ${table}.${column}.`
    );
  }
  return requiredColumns.map(([table, column]) => {
    const row = rows.find(
      (entry) => entry.table_name === table && entry.column_name === column
    );
    return {
      table,
      column,
      dataType: String(row?.data_type ?? "unknown")
    };
  });
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function assertCommandAvailable(command) {
  const result = spawnSync(command, ["--version"], {
    encoding: "utf8"
  });
  if (result.status !== 0) {
    throw new Error(
      `${command} is required when SEARCHLINT_POSTGRES_TEST_DATABASE_URL is not set.`
    );
  }
}

function assertNoSensitiveValues(text) {
  const forbidden = [
    /postgres:\/\/(?!\[REDACTED\])/i,
    /postgresql:\/\/(?!\[REDACTED\])/i,
    /password=/i,
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
    throw new Error(`Sensitive value leaked into migration evidence: ${match}`);
  }
}

function run(command, args) {
  return execFileSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"]
  });
}

function runQuiet(command, args) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "ignore"
  });
  if (result.status !== 0) {
    throw new Error(`${command} failed with exit code ${result.status}.`);
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
