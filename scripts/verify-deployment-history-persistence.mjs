#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { format } from "prettier";

const reportPath = "reports/deployment-history-persistence-report.json";
const samplePath =
  "docs/examples/deployment-history-persistence-report.sample.json";

const commands = [
  {
    name: "apiDeploymentHistoryPersistenceTests",
    command: "pnpm",
    args: [
      "--filter",
      "@searchlint/api",
      "test",
      "--",
      "contracts.test.ts",
      "postgres-ddl.test.ts",
      "postgres-repository-sql.test.ts",
      "postgres-deployment-history-store.test.ts"
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
    generatedBy: "searchlint-deployment-history-persistence-verifier",
    generatedAt: "2026-06-23T00:00:00.000Z",
    status: "passed",
    scope: {
      proofType:
        "deterministic production persistence contract and store proof",
      doesNotClaim: [
        "live RDS deployment",
        "live database migration execution",
        "page snapshot history persistence",
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
      "Persist page snapshot history and artifact references in production storage.",
      "Persist diagnostic and external-observation history rollups for dashboard trend analysis.",
      "Run deployed dashboard timeline and historical report acceptance."
    ]
  };

  await mkdir(path.dirname(reportPath), { recursive: true });
  await mkdir(path.dirname(samplePath), { recursive: true });
  await writeJson(reportPath, report);
  await writeJson(samplePath, report);

  console.log(
    "Deployment history production persistence PASS: schema, SQL, store, and DDL verified"
  );
  console.log(`Report: ${reportPath}`);
  console.log(`Sample: ${samplePath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

function verifySchema(api) {
  const table = api.persistenceTable("deployment_history");
  assert(table, "deployment_history table contract must exist.");
  assert(
    table.schemaVersion === "cloud.deployment_history.v1",
    "deployment_history schema version must be v1."
  );
  assert(
    table.tenantScoped === true,
    "deployment_history must be tenant scoped."
  );
  assert(
    table.retentionClass === "diagnostic_summary",
    "deployment_history retention class must be diagnostic_summary."
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
    "deployment_id",
    "commit_sha",
    "status",
    "deployed_at",
    "actor",
    "source",
    "annotations"
  ]);
  expectEqual(table.indexes, [
    {
      name: "deployment_history_environment_time_idx",
      columns: ["organization_id", "environment_id", "deployed_at"]
    },
    {
      name: "deployment_history_unique_idx",
      columns: [
        "organization_id",
        "project_id",
        "environment_id",
        "deployment_id"
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
  const upsert = api.upsertDeploymentHistorySql(deploymentInput());
  assert(
    upsert.text.includes('INSERT INTO "deployment_history"'),
    "upsert SQL must insert deployment_history."
  );
  assert(
    upsert.text.includes(
      'ON CONFLICT ("organization_id", "project_id", "environment_id", "deployment_id") DO UPDATE'
    ),
    "upsert SQL must use stable deployment identity conflict key."
  );
  expectEqual(upsert.values.slice(0, 6), [
    "deployment-row-1",
    "org-1",
    "cloud.deployment_history.v1",
    "2026-06-23T12:00:00.000Z",
    null,
    "active"
  ]);

  const select = api.selectDeploymentHistorySql({
    organizationId: "org-1",
    projectId: "project-1",
    environmentId: "env-1",
    limit: 50
  });
  assert(
    select.text.includes('ORDER BY "deployed_at" DESC, "deployment_id" ASC'),
    "select SQL must provide deterministic deployment ordering."
  );
  expectEqual(select.values, ["org-1", "project-1", "env-1", "active", 50]);

  return {
    upsertConflictKey: [
      "organization_id",
      "project_id",
      "environment_id",
      "deployment_id"
    ],
    selectOrder: ["deployed_at DESC", "deployment_id ASC"],
    valueCount: upsert.values.length
  };
}

async function verifyStore(api) {
  const rows = [rowFor(deploymentInput()), rowFor(deploymentInput())];
  const executor = {
    queries: [],
    async query(query) {
      this.queries.push(query);
      const row = rows.shift();
      return { rows: row ? [row] : [] };
    }
  };
  const store = api.createPostgresDeploymentHistoryStore(executor);
  const upserted = await store.upsertDeployment(deploymentInput());
  const listed = await store.listDeployments({
    organizationId: "org-1",
    projectId: "project-1",
    environmentId: "env-1",
    limit: 10
  });

  assert(
    upserted.deploymentId === "deploy-2026-06-23",
    "store must map upsert row deploymentId."
  );
  assert(listed.length === 1, "store must map listed deployment rows.");
  assert(
    executor.queries.some((query) =>
      query.text.includes('FROM "deployment_history"')
    ),
    "store must issue deployment_history list query."
  );

  return {
    upsertedDeploymentId: upserted.deploymentId,
    listedCount: listed.length,
    queryCount: executor.queries.length
  };
}

function verifyDdl(api) {
  const ddl = api.createPostgresSchemaSql();
  assert(
    ddl.includes('CREATE TABLE IF NOT EXISTS "deployment_history"'),
    "DDL must create deployment_history table."
  );
  assert(
    ddl.includes(
      'CREATE UNIQUE INDEX IF NOT EXISTS "deployment_history_unique_idx"'
    ),
    "DDL must create deployment_history unique index."
  );
  assert(
    ddl.includes('"annotations" JSONB NOT NULL'),
    "DDL must persist deployment annotations as JSONB."
  );
  return {
    hasTable: true,
    hasUniqueIndex: true,
    hasJsonAnnotations: true
  };
}

function deploymentInput() {
  return {
    id: "deployment-row-1",
    organizationId: "org-1",
    projectId: "project-1",
    environmentId: "env-1",
    deploymentId: "deploy-2026-06-23",
    commitSha: "abc123def456",
    status: "released",
    deployedAt: "2026-06-23T12:00:00.000Z",
    actor: "release-bot",
    source: "github-actions",
    annotations: {
      releaseCandidate: "rc-1",
      changeWindow: "standard"
    },
    deletionState: "active",
    createdAt: "2026-06-23T12:00:00.000Z"
  };
}

function rowFor(record) {
  return {
    id: record.id,
    organization_id: record.organizationId,
    schema_version: "cloud.deployment_history.v1",
    created_at: record.createdAt,
    retention_until: record.retentionUntil ?? null,
    deletion_state: record.deletionState,
    project_id: record.projectId,
    environment_id: record.environmentId,
    deployment_id: record.deploymentId,
    commit_sha: record.commitSha,
    status: record.status,
    deployed_at: record.deployedAt,
    actor: record.actor ?? null,
    source: record.source,
    annotations: record.annotations
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
