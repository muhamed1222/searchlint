import { describe, expect, it } from "vitest";

import {
  createPostgresDashboardSnapshotStore,
  selectDashboardSnapshotSql
} from "../src/index.js";
import type {
  DashboardSnapshotPayload,
  PostgresQuery,
  PostgresQueryExecutor,
  PostgresQueryResult
} from "../src/index.js";

describe("createPostgresDashboardSnapshotStore", () => {
  it("loads materialized dashboard snapshots through the SQL contract", async () => {
    const payload: DashboardSnapshotPayload = {
      overview: {
        blocker: 0,
        error: 1,
        warning: 2
      }
    };
    const executor = new FakeExecutor([{ payload }]);
    const store = createPostgresDashboardSnapshotStore(executor);

    await expect(
      store.getDashboardSnapshot({
        organizationId: "org-1",
        projectId: "project-1",
        environmentId: "env-1"
      })
    ).resolves.toEqual(payload);
    expect(executor.queries).toEqual([
      selectDashboardSnapshotSql({
        organizationId: "org-1",
        projectId: "project-1",
        environmentId: "env-1"
      })
    ]);
  });

  it("returns undefined when no snapshot row exists", async () => {
    const store = createPostgresDashboardSnapshotStore(
      new FakeExecutor([undefined])
    );

    await expect(
      store.getDashboardSnapshot({
        organizationId: "org-1",
        projectId: "project-1",
        environmentId: "env-1"
      })
    ).resolves.toBeUndefined();
  });

  it("rejects malformed snapshot payload rows", async () => {
    const store = createPostgresDashboardSnapshotStore(
      new FakeExecutor([{ payload: ["not", "an", "object"] }])
    );

    await expect(
      store.getDashboardSnapshot({
        organizationId: "org-1",
        projectId: "project-1",
        environmentId: "env-1"
      })
    ).rejects.toThrow(
      "Expected dashboard snapshot payload to be a JSON object."
    );
  });
});

class FakeExecutor implements PostgresQueryExecutor {
  readonly queries: PostgresQuery[] = [];

  constructor(private readonly rows: readonly (unknown | undefined)[]) {}

  async query<Row extends Record<string, unknown>>(
    query: PostgresQuery
  ): Promise<PostgresQueryResult<Row>> {
    this.queries.push(query);
    const row = this.rows[this.queries.length - 1];
    return {
      rows: row === undefined ? [] : [row as Row]
    };
  }
}
