import { createHash } from "node:crypto";

import { createPostgresSchemaSql } from "./postgres-ddl.js";
import type { PersistenceTableContract } from "./schema-contracts.js";
import { cloudPersistenceSchema } from "./schema-contracts.js";
import type { PgPool, PgTransactionClient } from "./postgres-pg.js";

export type PostgresMigration = {
  id: string;
  checksum: string;
  statements: readonly string[];
};

export type PostgresMigrationResult = {
  applied: readonly string[];
  skipped: readonly string[];
};

export type RunPostgresMigrationsOptions = {
  pool: PgPool;
  migrations?: readonly PostgresMigration[];
  appliedAt: string;
};

const migrationLedgerTable = "searchlint_schema_migrations";
const currentCloudSchemaMigrationId = "cloud-persistence-schema-v1";
const crawlExecutionMetadataMigrationId = "cloud-crawl-execution-metadata-v1";

export function createCurrentCloudSchemaMigration(): PostgresMigration {
  const sql = createPostgresSchemaSql(cloudPersistenceSchemaV1());
  return createPostgresMigration(currentCloudSchemaMigrationId, sql);
}

export function createCrawlExecutionMetadataMigration(): PostgresMigration {
  return createPostgresMigration(
    crawlExecutionMetadataMigrationId,
    `ALTER TABLE "crawl_requests" ADD COLUMN IF NOT EXISTS "started_at" TIMESTAMPTZ;
ALTER TABLE "crawl_requests" ADD COLUMN IF NOT EXISTS "completed_at" TIMESTAMPTZ;
ALTER TABLE "crawl_requests" ADD COLUMN IF NOT EXISTS "failed_at" TIMESTAMPTZ;
ALTER TABLE "crawl_requests" ADD COLUMN IF NOT EXISTS "last_error" TEXT;
ALTER TABLE "crawl_requests" ADD COLUMN IF NOT EXISTS "artifact_uri" TEXT;`
  );
}

export function createCurrentCloudSchemaMigrations(): readonly PostgresMigration[] {
  return [
    createCurrentCloudSchemaMigration(),
    createCrawlExecutionMetadataMigration()
  ];
}

export function createPostgresMigration(
  id: string,
  sql: string
): PostgresMigration {
  const statements = splitSqlStatements(sql);
  if (id.trim().length === 0) {
    throw new Error("Migration id is required.");
  }
  if (statements.length === 0) {
    throw new Error(`Migration ${id} has no SQL statements.`);
  }
  return {
    id,
    checksum: checksumSql(statements.join("\n")),
    statements
  };
}

export async function runPostgresMigrations(
  options: RunPostgresMigrationsOptions
): Promise<PostgresMigrationResult> {
  const migrations = options.migrations ?? [
    ...createCurrentCloudSchemaMigrations()
  ];
  const client = await options.pool.connect();
  const applied: string[] = [];
  const skipped: string[] = [];

  try {
    await client.query("BEGIN");
    await client.query(migrationLedgerSql());

    for (const migration of migrations) {
      const existing = await appliedMigration(client, migration.id);
      if (existing) {
        if (existing.checksum !== migration.checksum) {
          throw new Error(
            `Migration ${migration.id} checksum mismatch: expected ${existing.checksum}, got ${migration.checksum}.`
          );
        }
        skipped.push(migration.id);
        continue;
      }

      for (const statement of migration.statements) {
        await client.query(statement);
      }
      await client.query(insertMigrationSql(), [
        migration.id,
        migration.checksum,
        options.appliedAt
      ]);
      applied.push(migration.id);
    }

    await client.query("COMMIT");
    return { applied, skipped };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function splitSqlStatements(sql: string): readonly string[] {
  return sql
    .split(";")
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0)
    .map((statement) => `${statement};`);
}

function checksumSql(sql: string): string {
  return createHash("sha256").update(sql).digest("hex");
}

async function appliedMigration(
  client: PgTransactionClient,
  id: string
): Promise<{ checksum: string } | undefined> {
  const result = await client.query<{ checksum: string }>(
    `SELECT "checksum" FROM "${migrationLedgerTable}" WHERE "id" = $1 LIMIT 1;`,
    [id]
  );
  const row = result.rows[0];
  if (!row) {
    return undefined;
  }
  if (typeof row.checksum !== "string") {
    throw new Error(`Migration ${id} has an invalid stored checksum.`);
  }
  return {
    checksum: row.checksum
  };
}

function migrationLedgerSql(): string {
  return `CREATE TABLE IF NOT EXISTS "${migrationLedgerTable}" (
  "id" TEXT PRIMARY KEY,
  "checksum" TEXT NOT NULL,
  "applied_at" TIMESTAMPTZ NOT NULL
);`;
}

function insertMigrationSql(): string {
  return `INSERT INTO "${migrationLedgerTable}" ("id", "checksum", "applied_at") VALUES ($1, $2, $3);`;
}

function cloudPersistenceSchemaV1(): readonly PersistenceTableContract[] {
  return cloudPersistenceSchema.map((table) => {
    if (table.name !== "crawl_requests") {
      return table;
    }
    return {
      ...table,
      columns: table.columns.filter(
        (column) =>
          column.name !== "started_at" &&
          column.name !== "completed_at" &&
          column.name !== "failed_at" &&
          column.name !== "last_error" &&
          column.name !== "artifact_uri"
      )
    };
  });
}
