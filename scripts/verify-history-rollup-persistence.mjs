#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { format } from "prettier";

const reportPath = "reports/history-rollup-persistence-report.json";
const samplePath =
  "docs/examples/history-rollup-persistence-report.sample.json";

const commands = [
  {
    name: "apiHistoryRollupPersistenceTests",
    command: "pnpm",
    args: [
      "--filter",
      "@searchlint/api",
      "test",
      "--",
      "contracts.test.ts",
      "postgres-ddl.test.ts",
      "postgres-repository-sql.test.ts",
      "postgres-history-rollup-store.test.ts"
    ]
  },
  {
    name: "apiBuild",
    command: "pnpm",
    args: ["--filter", "@searchlint/api", "build"]
  }
];

async function main() {
  const commandResults = commands.map(runCommand);
  const api = await import(
    pathToFileURL(path.resolve("services/api/dist/src/index.js")).href
  );

  const schemaCase = verifySchema(api);
  const sqlCase = verifySql(api);
  const storeCase = await verifyStore(api);
  const ddlCase = verifyDdl(api);

  const report = {
    generatedBy: "searchlint-history-rollup-persistence-verifier",
    generatedAt: "2026-06-23T00:00:00.000Z",
    status: "passed",
    scope: {
      proofType:
        "deterministic diagnostic and external-observation rollup persistence contract and store proof",
      doesNotClaim: [
        "live RDS deployment",
        "live database migration execution",
        "deployed rollup generation scheduler",
        "raw diagnostic or provider payload retention",
        "deployed dashboard timeline acceptance"
      ]
    },
    commands: commandResults,
    cases: {
      schema: schemaCase,
      sql: sqlCase,
      store: storeCase,
      ddl: ddlCase
    },
    remainingReleaseGates: [
      "Deploy and migrate a real PostgreSQL/RDS database.",
      "Run deployed rollup generation through workers or scheduler.",
      "Run deployed dashboard timeline and historical report acceptance."
    ]
  };

  await mkdir(path.dirname(reportPath), { recursive: true });
  await mkdir(path.dirname(samplePath), { recursive: true });
  await writeJson(reportPath, report);
  await writeJson(samplePath, report);

  console.log(
    "History rollup production persistence PASS: schema, SQL, store, and DDL verified"
  );
  console.log(`Report: ${reportPath}`);
  console.log(`Sample: ${samplePath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

function verifySchema(api) {
  const table = api.persistenceTable("history_rollups");
  assert(table, "history_rollups table contract must exist.");
  assert(
    table.schemaVersion === "cloud.history_rollups.v1",
    "history_rollups schema version must be v1."
  );
  assert(table.tenantScoped === true, "history_rollups must be tenant scoped.");
  assert(
    table.retentionClass === "diagnostic_summary",
    "history_rollups retention class must be diagnostic_summary."
  );

  const columns = table.columns.map((column) => column.name);
  expectEqual(columns, [
    "id",
    "organization_id",
    "schema_version",
    "created_at",
    "retention_until",
    "deletion_state",
    "project_id",
    "environment_id",
    "rollup_kind",
    "rollup_key",
    "period_start",
    "period_end",
    "dimensions",
    "metrics",
    "generated_at"
  ]);

  return {
    table: table.name,
    schemaVersion: table.schemaVersion,
    retentionClass: table.retentionClass,
    columns,
    indexes: table.indexes.map((index) => index.name)
  };
}

function verifySql(api) {
  const upsert = api.upsertHistoryRollupSql(rollupInput());
  assert(
    upsert.text.includes('INSERT INTO "history_rollups"'),
    "upsert SQL must insert history_rollups."
  );
  assert(
    upsert.text.includes(
      'ON CONFLICT ("organization_id", "project_id", "environment_id", "rollup_kind", "rollup_key", "period_start") DO UPDATE'
    ),
    "upsert SQL must use stable rollup identity conflict key."
  );
  expectEqual(upsert.values.slice(0, 6), [
    "rollup-row-1",
    "org-1",
    "cloud.history_rollups.v1",
    "2026-06-23T12:10:00.000Z",
    null,
    "active"
  ]);

  const select = api.selectHistoryRollupsSql({
    organizationId: "org-1",
    projectId: "project-1",
    environmentId: "env-1",
    rollupKind: "diagnostics",
    limit: 50
  });
  assert(
    select.text.includes('ORDER BY "period_start" DESC, "rollup_key" ASC'),
    "select SQL must provide deterministic rollup ordering."
  );
  expectEqual(select.values, [
    "org-1",
    "project-1",
    "env-1",
    "diagnostics",
    "active",
    50
  ]);

  return {
    supportedKinds: ["diagnostics", "external-observations"],
    selectOrder: ["period_start DESC", "rollup_key ASC"],
    valueCount: upsert.values.length
  };
}

async function verifyStore(api) {
  const rows = [rowFor(rollupInput()), rowFor(rollupInput())];
  const executor = {
    queries: [],
    async query(query) {
      this.queries.push(query);
      const row = rows.shift();
      return { rows: row ? [row] : [] };
    }
  };
  const store = api.createPostgresHistoryRollupStore(executor);
  const upserted = await store.upsertRollup(rollupInput());
  const listed = await store.listRollups({
    organizationId: "org-1",
    projectId: "project-1",
    environmentId: "env-1",
    rollupKind: "diagnostics",
    limit: 10
  });

  assert(
    upserted.rollupKey === "daily:/products/widget",
    "store must map upsert row rollupKey."
  );
  assert(listed.length === 1, "store must map listed rollup rows.");
  assert(
    executor.queries.some((query) =>
      query.text.includes('FROM "history_rollups"')
    ),
    "store must issue history_rollups list query."
  );

  return {
    upsertedRollupKey: upserted.rollupKey,
    listedCount: listed.length,
    queryCount: executor.queries.length
  };
}

function verifyDdl(api) {
  const ddl = api.createPostgresSchemaSql();
  assert(
    ddl.includes('CREATE TABLE IF NOT EXISTS "history_rollups"'),
    "DDL must create history_rollups table."
  );
  assert(
    ddl.includes(
      'CREATE UNIQUE INDEX IF NOT EXISTS "history_rollups_unique_idx"'
    ),
    "DDL must create history_rollups unique index."
  );
  assert(
    ddl.includes('"dimensions" JSONB NOT NULL'),
    "DDL must persist rollup dimensions as JSONB."
  );
  assert(
    ddl.includes('"metrics" JSONB NOT NULL'),
    "DDL must persist rollup metrics as JSONB."
  );
  return {
    hasTable: true,
    hasUniqueIndex: true,
    hasJsonDimensions: true,
    hasJsonMetrics: true
  };
}

function rollupInput() {
  return {
    id: "rollup-row-1",
    organizationId: "org-1",
    projectId: "project-1",
    environmentId: "env-1",
    rollupKind: "diagnostics",
    rollupKey: "daily:/products/widget",
    periodStart: "2026-06-23T00:00:00.000Z",
    periodEnd: "2026-06-24T00:00:00.000Z",
    dimensions: {
      pageUrl: "https://example.test/products/widget"
    },
    metrics: {
      diagnostics: 7,
      blockers: 1,
      errors: 2,
      externalObservations: 3
    },
    generatedAt: "2026-06-23T12:10:00.000Z",
    deletionState: "active",
    createdAt: "2026-06-23T12:10:00.000Z"
  };
}

function rowFor(record) {
  return {
    id: record.id,
    organization_id: record.organizationId,
    schema_version: "cloud.history_rollups.v1",
    created_at: record.createdAt,
    retention_until: record.retentionUntil ?? null,
    deletion_state: record.deletionState,
    project_id: record.projectId,
    environment_id: record.environmentId,
    rollup_kind: record.rollupKind,
    rollup_key: record.rollupKey,
    period_start: record.periodStart,
    period_end: record.periodEnd,
    dimensions: record.dimensions,
    metrics: record.metrics,
    generated_at: record.generatedAt
  };
}

function runCommand(command) {
  const result = spawnSync(command.command, command.args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  const passed = result.status === 0;
  if (!passed) {
    process.stdout.write(result.stdout);
    process.stderr.write(result.stderr);
    throw new Error(`${command.name} failed with exit code ${result.status}.`);
  }
  return {
    name: command.name,
    command: [command.command, ...command.args].join(" "),
    status: "passed"
  };
}

async function writeJson(filePath, value) {
  const formatted = await format(JSON.stringify(value), {
    parser: "json"
  });
  await writeFile(filePath, formatted);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function expectEqual(actual, expected) {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  assert(
    actualJson === expectedJson,
    `Expected ${expectedJson}, received ${actualJson}.`
  );
}
