import { describe, expect, it } from "vitest";

import { createPostgresHistoryRollupStore } from "../src/index.js";
import type {
  HistoryRollupRecord,
  PostgresQuery,
  PostgresQueryExecutor,
  PostgresQueryResult
} from "../src/index.js";

const rollup: HistoryRollupRecord = {
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
    errors: 2
  },
  generatedAt: "2026-06-23T12:10:00.000Z",
  deletionState: "active",
  createdAt: "2026-06-23T12:10:00.000Z"
};

describe("createPostgresHistoryRollupStore", () => {
  it("upserts history rollups through the repository SQL contract", async () => {
    const executor = new FakeExecutor([rowFor(rollup)]);
    const store = createPostgresHistoryRollupStore(executor);

    await expect(store.upsertRollup(rollup)).resolves.toEqual(rollup);
    expect(executor.queries[0]?.text).toContain(
      'INSERT INTO "history_rollups"'
    );
    expect(executor.queries[0]?.text).toContain(
      'ON CONFLICT ("organization_id", "project_id", "environment_id", "rollup_kind", "rollup_key", "period_start") DO UPDATE'
    );
    expect(executor.queries[0]?.values).toEqual([
      "rollup-row-1",
      "org-1",
      "cloud.history_rollups.v1",
      "2026-06-23T12:10:00.000Z",
      null,
      "active",
      "project-1",
      "env-1",
      "diagnostics",
      "daily:/products/widget",
      "2026-06-23T00:00:00.000Z",
      "2026-06-24T00:00:00.000Z",
      {
        pageUrl: "https://example.test/products/widget"
      },
      {
        diagnostics: 7,
        blockers: 1,
        errors: 2
      },
      "2026-06-23T12:10:00.000Z"
    ]);
  });

  it("lists active rollups by optional kind and deterministic period order", async () => {
    const executor = new FakeExecutor([rowFor(rollup)]);
    const store = createPostgresHistoryRollupStore(executor);

    await expect(
      store.listRollups({
        organizationId: "org-1",
        projectId: "project-1",
        environmentId: "env-1",
        rollupKind: "diagnostics",
        limit: 25
      })
    ).resolves.toEqual([rollup]);
    expect(executor.queries[0]?.text).toContain(
      'FROM "history_rollups" WHERE "organization_id" = $1'
    );
    expect(executor.queries[0]?.text).toContain(
      'ORDER BY "period_start" DESC, "rollup_key" ASC LIMIT $6'
    );
    expect(executor.queries[0]?.values).toEqual([
      "org-1",
      "project-1",
      "env-1",
      "diagnostics",
      "active",
      25
    ]);
  });

  it("fails deterministically when upsert returns no row", async () => {
    const executor = new FakeExecutor([undefined]);
    const store = createPostgresHistoryRollupStore(executor);

    await expect(store.upsertRollup(rollup)).rejects.toThrow(
      "upsertRollup did not return a row."
    );
  });
});

function rowFor(record: HistoryRollupRecord): Record<string, unknown> {
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
