#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { format } from "prettier";

const reportPath = "reports/page-snapshot-history-persistence-report.json";
const samplePath =
  "docs/examples/page-snapshot-history-persistence-report.sample.json";

const commands = [
  {
    name: "apiPageSnapshotHistoryPersistenceTests",
    command: "pnpm",
    args: [
      "--filter",
      "@searchlint/api",
      "test",
      "--",
      "contracts.test.ts",
      "postgres-ddl.test.ts",
      "postgres-repository-sql.test.ts",
      "postgres-page-snapshot-history-store.test.ts"
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
    generatedBy: "searchlint-page-snapshot-history-persistence-verifier",
    generatedAt: "2026-06-23T00:00:00.000Z",
    status: "passed",
    scope: {
      proofType:
        "deterministic page snapshot history persistence contract and store proof",
      doesNotClaim: [
        "live RDS deployment",
        "live database migration execution",
        "live S3 upload, download, restore, or deletion",
        "diagnostic or external-observation rollup persistence",
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
      "Run live S3 artifact upload/download/delete/restore proof.",
      "Persist diagnostic and external-observation history rollups for dashboard trend analysis.",
      "Run deployed dashboard timeline and historical report acceptance."
    ]
  };

  await mkdir(path.dirname(reportPath), { recursive: true });
  await mkdir(path.dirname(samplePath), { recursive: true });
  await writeJson(reportPath, report);
  await writeJson(samplePath, report);

  console.log(
    "Page snapshot history production persistence PASS: schema, SQL, store, and DDL verified"
  );
  console.log(`Report: ${reportPath}`);
  console.log(`Sample: ${samplePath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

function verifySchema(api) {
  const table = api.persistenceTable("page_snapshot_history");
  assert(table, "page_snapshot_history table contract must exist.");
  assert(
    table.schemaVersion === "cloud.page_snapshot_history.v1",
    "page_snapshot_history schema version must be v1."
  );
  assert(
    table.tenantScoped === true,
    "page_snapshot_history must be tenant scoped."
  );
  assert(
    table.retentionClass === "crawl_artifact",
    "page_snapshot_history retention class must be crawl_artifact."
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
    "page_url",
    "captured_at",
    "artifact_references",
    "diagnostic_fingerprints"
  ]);
  expectEqual(table.indexes, [
    {
      name: "page_snapshot_history_environment_time_idx",
      columns: ["organization_id", "environment_id", "captured_at"]
    },
    {
      name: "page_snapshot_history_unique_idx",
      columns: [
        "organization_id",
        "project_id",
        "environment_id",
        "page_url",
        "captured_at"
      ],
      unique: true
    }
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
  const upsert = api.upsertPageSnapshotHistorySql(snapshotInput());
  assert(
    upsert.text.includes('INSERT INTO "page_snapshot_history"'),
    "upsert SQL must insert page_snapshot_history."
  );
  assert(
    upsert.text.includes(
      'ON CONFLICT ("organization_id", "project_id", "environment_id", "page_url", "captured_at") DO UPDATE'
    ),
    "upsert SQL must use stable page/capture conflict key."
  );
  expectEqual(upsert.values.slice(0, 6), [
    "snapshot-row-1",
    "org-1",
    "cloud.page_snapshot_history.v1",
    "2026-06-23T12:05:00.000Z",
    null,
    "active"
  ]);

  const select = api.selectPageSnapshotHistorySql({
    organizationId: "org-1",
    projectId: "project-1",
    environmentId: "env-1",
    limit: 50
  });
  assert(
    select.text.includes('ORDER BY "captured_at" DESC, "page_url" ASC'),
    "select SQL must provide deterministic snapshot ordering."
  );
  expectEqual(select.values, ["org-1", "project-1", "env-1", "active", 50]);

  return {
    upsertConflictKey: [
      "organization_id",
      "project_id",
      "environment_id",
      "page_url",
      "captured_at"
    ],
    selectOrder: ["captured_at DESC", "page_url ASC"],
    valueCount: upsert.values.length
  };
}

async function verifyStore(api) {
  const rows = [rowFor(snapshotInput()), rowFor(snapshotInput())];
  const executor = {
    queries: [],
    async query(query) {
      this.queries.push(query);
      const row = rows.shift();
      return { rows: row ? [row] : [] };
    }
  };
  const store = api.createPostgresPageSnapshotHistoryStore(executor);
  const upserted = await store.upsertSnapshot(snapshotInput());
  const listed = await store.listSnapshots({
    organizationId: "org-1",
    projectId: "project-1",
    environmentId: "env-1",
    limit: 10
  });

  assert(
    upserted.pageUrl === "https://example.test/products/widget",
    "store must map upsert row pageUrl."
  );
  assert(listed.length === 1, "store must map listed snapshot rows.");
  assert(
    executor.queries.some((query) =>
      query.text.includes('FROM "page_snapshot_history"')
    ),
    "store must issue page_snapshot_history list query."
  );

  return {
    upsertedPageUrl: upserted.pageUrl,
    listedCount: listed.length,
    queryCount: executor.queries.length
  };
}

function verifyDdl(api) {
  const ddl = api.createPostgresSchemaSql();
  assert(
    ddl.includes('CREATE TABLE IF NOT EXISTS "page_snapshot_history"'),
    "DDL must create page_snapshot_history table."
  );
  assert(
    ddl.includes(
      'CREATE UNIQUE INDEX IF NOT EXISTS "page_snapshot_history_unique_idx"'
    ),
    "DDL must create page_snapshot_history unique index."
  );
  assert(
    ddl.includes('"artifact_references" JSONB NOT NULL'),
    "DDL must persist artifact references as JSONB."
  );
  assert(
    ddl.includes('"diagnostic_fingerprints" JSONB NOT NULL'),
    "DDL must persist diagnostic fingerprints as JSONB."
  );
  return {
    hasTable: true,
    hasUniqueIndex: true,
    hasJsonArtifactReferences: true,
    hasJsonDiagnosticFingerprints: true
  };
}

function snapshotInput() {
  return {
    id: "snapshot-row-1",
    organizationId: "org-1",
    projectId: "project-1",
    environmentId: "env-1",
    pageUrl: "https://example.test/products/widget",
    capturedAt: "2026-06-23T12:05:00.000Z",
    artifactReferences: {
      html: "s3://searchlint-artifacts/org-1/env-1/html.html",
      dom: "s3://searchlint-artifacts/org-1/env-1/dom.json",
      crawl: "s3://searchlint-artifacts/org-1/env-1/crawl.json"
    },
    diagnosticFingerprints: ["fingerprint-1", "fingerprint-2"],
    deletionState: "active",
    createdAt: "2026-06-23T12:05:00.000Z"
  };
}

function rowFor(record) {
  return {
    id: record.id,
    organization_id: record.organizationId,
    schema_version: "cloud.page_snapshot_history.v1",
    created_at: record.createdAt,
    retention_until: record.retentionUntil ?? null,
    deletion_state: record.deletionState,
    project_id: record.projectId,
    environment_id: record.environmentId,
    page_url: record.pageUrl,
    captured_at: record.capturedAt,
    artifact_references: record.artifactReferences,
    diagnostic_fingerprints: record.diagnosticFingerprints
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
