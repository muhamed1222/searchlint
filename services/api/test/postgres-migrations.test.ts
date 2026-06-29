import { describe, expect, it } from "vitest";

import {
  createCrawlExecutionMetadataMigration,
  createCurrentCloudSchemaMigration,
  createCurrentCloudSchemaMigrations,
  createPostgresMigration,
  runPostgresMigrations
} from "../src/index.js";
import type { QueryResult, QueryResultRow } from "pg";
import type { PgPool, PgTransactionClient } from "../src/index.js";

const appliedAt = "2026-06-21T00:00:00.000Z";

describe("createCurrentCloudSchemaMigration", () => {
  it("creates a deterministic migration from the current schema contract", () => {
    const first = createCurrentCloudSchemaMigration();
    const second = createCurrentCloudSchemaMigration();

    expect(first.id).toBe("cloud-persistence-schema-v1");
    expect(first.checksum).toMatch(/^[a-f0-9]{64}$/);
    expect(first).toEqual(second);
    expect(first.statements[0]).toContain(
      'CREATE TABLE IF NOT EXISTS "organizations"'
    );
    expect(first.statements.join("\n")).not.toContain('"started_at"');
  });

  it("creates an additive crawl execution metadata migration", () => {
    const migration = createCrawlExecutionMetadataMigration();

    expect(migration.id).toBe("cloud-crawl-execution-metadata-v1");
    expect(migration.statements).toEqual([
      'ALTER TABLE "crawl_requests" ADD COLUMN IF NOT EXISTS "started_at" TIMESTAMPTZ;',
      'ALTER TABLE "crawl_requests" ADD COLUMN IF NOT EXISTS "completed_at" TIMESTAMPTZ;',
      'ALTER TABLE "crawl_requests" ADD COLUMN IF NOT EXISTS "failed_at" TIMESTAMPTZ;',
      'ALTER TABLE "crawl_requests" ADD COLUMN IF NOT EXISTS "last_error" TEXT;',
      'ALTER TABLE "crawl_requests" ADD COLUMN IF NOT EXISTS "artifact_uri" TEXT;'
    ]);
  });

  it("keeps default migrations ordered from base schema to additive changes", () => {
    expect(
      createCurrentCloudSchemaMigrations().map((migration) => migration.id)
    ).toEqual([
      "cloud-persistence-schema-v1",
      "cloud-crawl-execution-metadata-v1"
    ]);
  });
});

describe("runPostgresMigrations", () => {
  it("creates the ledger, applies pending statements, records migration, and commits", async () => {
    const migration = createPostgresMigration(
      "migration-1",
      'CREATE TABLE IF NOT EXISTS "example" ("id" TEXT NOT NULL);'
    );
    const pool = new FakePgPool();

    await expect(
      runPostgresMigrations({
        pool,
        migrations: [migration],
        appliedAt
      })
    ).resolves.toEqual({
      applied: ["migration-1"],
      skipped: []
    });

    expect(pool.client.calls).toEqual([
      call("BEGIN"),
      call(
        'CREATE TABLE IF NOT EXISTS "searchlint_schema_migrations" (\n  "id" TEXT PRIMARY KEY,\n  "checksum" TEXT NOT NULL,\n  "applied_at" TIMESTAMPTZ NOT NULL\n);'
      ),
      call(
        'SELECT "checksum" FROM "searchlint_schema_migrations" WHERE "id" = $1 LIMIT 1;',
        ["migration-1"]
      ),
      call('CREATE TABLE IF NOT EXISTS "example" ("id" TEXT NOT NULL);'),
      call(
        'INSERT INTO "searchlint_schema_migrations" ("id", "checksum", "applied_at") VALUES ($1, $2, $3);',
        ["migration-1", migration.checksum, appliedAt]
      ),
      call("COMMIT")
    ]);
    expect(pool.client.released).toBe(true);
  });

  it("skips already applied migrations with matching checksums", async () => {
    const migration = createPostgresMigration(
      "migration-1",
      'CREATE TABLE IF NOT EXISTS "example" ("id" TEXT NOT NULL);'
    );
    const pool = new FakePgPool({
      appliedChecksums: new Map([["migration-1", migration.checksum]])
    });

    await expect(
      runPostgresMigrations({
        pool,
        migrations: [migration],
        appliedAt
      })
    ).resolves.toEqual({
      applied: [],
      skipped: ["migration-1"]
    });

    expect(pool.client.calls.map((entry) => entry.text)).toEqual([
      "BEGIN",
      'CREATE TABLE IF NOT EXISTS "searchlint_schema_migrations" (\n  "id" TEXT PRIMARY KEY,\n  "checksum" TEXT NOT NULL,\n  "applied_at" TIMESTAMPTZ NOT NULL\n);',
      'SELECT "checksum" FROM "searchlint_schema_migrations" WHERE "id" = $1 LIMIT 1;',
      "COMMIT"
    ]);
  });

  it("rejects checksum drift for already applied migrations", async () => {
    const migration = createPostgresMigration(
      "migration-1",
      'CREATE TABLE IF NOT EXISTS "example" ("id" TEXT NOT NULL);'
    );
    const pool = new FakePgPool({
      appliedChecksums: new Map([["migration-1", "different-checksum"]])
    });

    await expect(
      runPostgresMigrations({
        pool,
        migrations: [migration],
        appliedAt
      })
    ).rejects.toThrow(
      `Migration migration-1 checksum mismatch: expected different-checksum, got ${migration.checksum}.`
    );
    expect(pool.client.calls.map((entry) => entry.text)).toEqual([
      "BEGIN",
      'CREATE TABLE IF NOT EXISTS "searchlint_schema_migrations" (\n  "id" TEXT PRIMARY KEY,\n  "checksum" TEXT NOT NULL,\n  "applied_at" TIMESTAMPTZ NOT NULL\n);',
      'SELECT "checksum" FROM "searchlint_schema_migrations" WHERE "id" = $1 LIMIT 1;',
      "ROLLBACK"
    ]);
    expect(pool.client.released).toBe(true);
  });

  it("rolls back and releases when a migration statement fails", async () => {
    const migration = createPostgresMigration(
      "migration-1",
      'CREATE TABLE IF NOT EXISTS "example" ("id" TEXT NOT NULL);'
    );
    const pool = new FakePgPool({
      failOn: 'CREATE TABLE IF NOT EXISTS "example"'
    });

    await expect(
      runPostgresMigrations({
        pool,
        migrations: [migration],
        appliedAt
      })
    ).rejects.toThrow("migration statement failed");

    expect(pool.client.calls.map((entry) => entry.text)).toEqual([
      "BEGIN",
      'CREATE TABLE IF NOT EXISTS "searchlint_schema_migrations" (\n  "id" TEXT PRIMARY KEY,\n  "checksum" TEXT NOT NULL,\n  "applied_at" TIMESTAMPTZ NOT NULL\n);',
      'SELECT "checksum" FROM "searchlint_schema_migrations" WHERE "id" = $1 LIMIT 1;',
      'CREATE TABLE IF NOT EXISTS "example" ("id" TEXT NOT NULL);',
      "ROLLBACK"
    ]);
    expect(pool.client.released).toBe(true);
  });

  it("rejects empty migration SQL before acquiring a client", async () => {
    const pool = new FakePgPool();

    expect(() => createPostgresMigration("empty", " ")).toThrow(
      "Migration empty has no SQL statements."
    );
    expect(pool.client.calls).toEqual([]);
  });
});

type PgCall = {
  text: string;
  values?: readonly unknown[];
};

type FakePgPoolOptions = {
  appliedChecksums?: Map<string, string>;
  failOn?: string;
};

class FakePgPool implements PgPool {
  readonly client: FakePgClient;
  readonly calls: PgCall[] = [];

  constructor(options: FakePgPoolOptions = {}) {
    this.client = new FakePgClient(options);
  }

  async query<Row extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: readonly unknown[]
  ): Promise<QueryResult<Row>> {
    this.calls.push(values === undefined ? { text } : { text, values });
    return queryResult<Row>([]);
  }

  async connect(): Promise<PgTransactionClient> {
    return this.client;
  }
}

class FakePgClient implements PgTransactionClient {
  readonly calls: PgCall[] = [];
  released = false;
  private readonly appliedChecksums: Map<string, string>;
  private readonly failOn: string | undefined;

  constructor(options: FakePgPoolOptions) {
    this.appliedChecksums = options.appliedChecksums ?? new Map();
    this.failOn = options.failOn;
  }

  async query<Row extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: readonly unknown[]
  ): Promise<QueryResult<Row>> {
    this.calls.push(values === undefined ? { text } : { text, values });
    if (this.failOn && text.includes(this.failOn)) {
      throw new Error("migration statement failed");
    }
    if (text.startsWith('SELECT "checksum"')) {
      const id = values?.[0];
      const checksum =
        typeof id === "string" ? this.appliedChecksums.get(id) : undefined;
      return queryResult<Row>(
        checksum ? ([{ checksum }] as QueryResultRow[] as Row[]) : []
      );
    }
    return queryResult<Row>([]);
  }

  release(): void {
    this.released = true;
  }
}

function call(text: string, values?: readonly unknown[]): PgCall {
  return values === undefined ? { text } : { text, values };
}

function queryResult<Row extends QueryResultRow>(
  rows: Row[]
): QueryResult<Row> {
  return {
    command: "SELECT",
    rowCount: rows.length,
    oid: 0,
    fields: [],
    rows
  };
}
