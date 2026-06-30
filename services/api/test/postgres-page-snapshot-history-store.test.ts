import { describe, expect, it } from "vitest";

import { createPostgresPageSnapshotHistoryStore } from "../src/index.js";
import type {
  PageSnapshotHistoryRecord,
  PostgresQuery,
  PostgresQueryExecutor,
  PostgresQueryResult
} from "../src/index.js";

const snapshot: PageSnapshotHistoryRecord = {
  id: "snapshot-row-1",
  organizationId: "org-1",
  projectId: "project-1",
  environmentId: "env-1",
  pageUrl: "https://example.test/products/widget",
  capturedAt: "2026-06-23T12:05:00.000Z",
  artifactReferences: {
    html: "s3://searchlint-artifacts/org-1/env-1/html.html",
    dom: "s3://searchlint-artifacts/org-1/env-1/dom.json"
  },
  diagnosticFingerprints: ["fingerprint-1", "fingerprint-2"],
  deletionState: "active",
  createdAt: "2026-06-23T12:05:00.000Z"
};

describe("createPostgresPageSnapshotHistoryStore", () => {
  it("upserts page snapshot history through the repository SQL contract", async () => {
    const executor = new FakeExecutor([rowFor(snapshot)]);
    const store = createPostgresPageSnapshotHistoryStore(executor);

    await expect(store.upsertSnapshot(snapshot)).resolves.toEqual(snapshot);
    expect(executor.queries[0]?.text).toContain(
      'INSERT INTO "page_snapshot_history"'
    );
    expect(executor.queries[0]?.text).toContain(
      'ON CONFLICT ("organization_id", "project_id", "environment_id", "page_url", "captured_at") DO UPDATE'
    );
    expect(executor.queries[0]?.values).toEqual([
      "snapshot-row-1",
      "org-1",
      "cloud.page_snapshot_history.v1",
      "2026-06-23T12:05:00.000Z",
      null,
      "active",
      "project-1",
      "env-1",
      "https://example.test/products/widget",
      "2026-06-23T12:05:00.000Z",
      {
        html: "s3://searchlint-artifacts/org-1/env-1/html.html",
        dom: "s3://searchlint-artifacts/org-1/env-1/dom.json"
      },
      ["fingerprint-1", "fingerprint-2"]
    ]);
  });

  it("lists active page snapshot history by environment and capture time", async () => {
    const executor = new FakeExecutor([rowFor(snapshot)]);
    const store = createPostgresPageSnapshotHistoryStore(executor);

    await expect(
      store.listSnapshots({
        organizationId: "org-1",
        projectId: "project-1",
        environmentId: "env-1",
        limit: 25
      })
    ).resolves.toEqual([snapshot]);
    expect(executor.queries[0]?.text).toContain(
      'FROM "page_snapshot_history" WHERE "organization_id" = $1'
    );
    expect(executor.queries[0]?.text).toContain(
      'ORDER BY "captured_at" DESC, "page_url" ASC LIMIT $5'
    );
    expect(executor.queries[0]?.values).toEqual([
      "org-1",
      "project-1",
      "env-1",
      "active",
      25
    ]);
  });

  it("fails deterministically when upsert returns no row", async () => {
    const executor = new FakeExecutor([undefined]);
    const store = createPostgresPageSnapshotHistoryStore(executor);

    await expect(store.upsertSnapshot(snapshot)).rejects.toThrow(
      "upsertSnapshot did not return a row."
    );
  });
});

function rowFor(record: PageSnapshotHistoryRecord): Record<string, unknown> {
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

type FakeRow = Record<string, unknown> | undefined;

class FakeExecutor implements PostgresQueryExecutor {
  readonly queries: PostgresQuery[] = [];
  private readonly rows: FakeRow[];

  constructor(rows: readonly FakeRow[]) {
    this.rows = [...rows];
  }

  async query<Row extends Record<string, unknown>>(
    query: PostgresQuery
  ): Promise<PostgresQueryResult<Row>> {
    this.queries.push(query);
    const row = this.rows.shift();
    return {
      rows: row ? [row as Row] : []
    };
  }
}
