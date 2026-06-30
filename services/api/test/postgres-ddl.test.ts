import { describe, expect, it } from "vitest";

import {
  cloudPersistenceSchema,
  createPostgresSchemaSql,
  validatePersistenceSchema
} from "../src/index.js";
import type { PersistenceTableContract } from "../src/index.js";

describe("createPostgresSchemaSql", () => {
  it("generates deterministic PostgreSQL DDL for all cloud tables", () => {
    const left = createPostgresSchemaSql();
    const right = createPostgresSchemaSql();

    expect(left).toBe(right);
    expect(left).toContain('CREATE TABLE IF NOT EXISTS "organizations"');
    expect(left).toContain(
      'CREATE TABLE IF NOT EXISTS "organization_memberships"'
    );
    expect(left).toContain('CREATE TABLE IF NOT EXISTS "crawl_requests"');
    expect(left).toContain('CREATE TABLE IF NOT EXISTS "outbox_events"');
    expect(left).toContain(
      'CREATE TABLE IF NOT EXISTS "agency_client_workspaces"'
    );
    expect(left).toContain(
      'CREATE TABLE IF NOT EXISTS "agency_client_projects"'
    );
    expect(left).toContain(
      'CREATE TABLE IF NOT EXISTS "agency_white_label_brands"'
    );
    expect(left).toContain('CREATE TABLE IF NOT EXISTS "dashboard_snapshots"');
    expect(left).toContain('CREATE TABLE IF NOT EXISTS "deployment_history"');
    expect(left).toContain(
      'CREATE TABLE IF NOT EXISTS "page_snapshot_history"'
    );
    expect(left).toContain('CREATE TABLE IF NOT EXISTS "history_rollups"');
    expect(left).toContain('CREATE TABLE IF NOT EXISTS "diagnostics"');
    expect(left).toContain(
      'CREATE TABLE IF NOT EXISTS "external_observations"'
    );
    expect(left).toContain('CREATE TABLE IF NOT EXISTS "oauth_connections"');
    expect(left).toContain('"schema_version" TEXT NOT NULL');
    expect(left).toContain('"payload" JSONB NOT NULL');
    expect(left).toContain('"quota" JSONB');
    expect(left).toContain('"sampling" JSONB');
    expect(left).toContain('"structured_evidence" JSONB');
    expect(left).toContain('"retention_until" TIMESTAMPTZ');
    expect(left).toContain('"deletion_state" TEXT NOT NULL');
    expect(left).toContain('"started_at" TIMESTAMPTZ');
    expect(left).toContain('"artifact_uri" TEXT');
    expect(left).toContain(
      'FOREIGN KEY ("project_id") REFERENCES "projects" ("id")'
    );
    expect(left).toContain(
      'CREATE UNIQUE INDEX IF NOT EXISTS "organization_memberships_unique_member_idx"'
    );
    expect(left).toContain(
      'CREATE UNIQUE INDEX IF NOT EXISTS "agency_client_projects_project_unique_idx"'
    );
    expect(left).toContain(
      'CREATE UNIQUE INDEX IF NOT EXISTS "agency_white_label_brands_workspace_unique_idx"'
    );
    expect(left).toContain(
      'CREATE INDEX IF NOT EXISTS "outbox_events_pending_idx"'
    );
    expect(left).toContain(
      'CREATE UNIQUE INDEX IF NOT EXISTS "dashboard_snapshots_environment_unique_idx"'
    );
    expect(left).toContain(
      'CREATE UNIQUE INDEX IF NOT EXISTS "deployment_history_unique_idx"'
    );
    expect(left).toContain(
      'CREATE UNIQUE INDEX IF NOT EXISTS "page_snapshot_history_unique_idx"'
    );
    expect(left).toContain(
      'CREATE UNIQUE INDEX IF NOT EXISTS "history_rollups_unique_idx"'
    );
    expect(left).toContain(
      'CREATE UNIQUE INDEX IF NOT EXISTS "diagnostics_fingerprint_unique_idx"'
    );
    expect(left).toContain(
      'CREATE UNIQUE INDEX IF NOT EXISTS "external_observations_fingerprint_unique_idx"'
    );
    expect(left).toContain(
      'CREATE UNIQUE INDEX IF NOT EXISTS "oauth_connections_unique_provider_account_idx"'
    );
    expect(left).toMatch(/\n$/);
  });

  it("emits index statements for declared indexes", () => {
    const sql = createPostgresSchemaSql();

    for (const table of cloudPersistenceSchema) {
      for (const index of table.indexes) {
        expect(sql).toContain(`INDEX IF NOT EXISTS "${index.name}"`);
        expect(sql).toContain(`ON "${table.name}"`);
      }
    }
  });

  it("rejects invalid schema contracts before generating SQL", () => {
    const broken: readonly PersistenceTableContract[] = [
      {
        name: "broken",
        schemaVersion: "cloud.broken.v1",
        tenantScoped: true,
        retentionClass: "audit_log",
        columns: [
          { name: "id", type: "text", nullable: false, primaryKey: true },
          { name: "schema_version", type: "text", nullable: false },
          { name: "deletion_state", type: "text", nullable: false }
        ],
        indexes: [{ name: "broken_missing_idx", columns: ["missing"] }]
      }
    ];

    expect(validatePersistenceSchema(broken)).toEqual([
      {
        table: "broken",
        message: "missing retention_until column"
      },
      {
        table: "broken",
        message: "tenant-scoped table missing organization_id column"
      },
      {
        table: "broken",
        message: "index broken_missing_idx references missing column missing"
      }
    ]);
    expect(() => createPostgresSchemaSql(broken)).toThrow(
      "Invalid persistence schema"
    );
  });
});
