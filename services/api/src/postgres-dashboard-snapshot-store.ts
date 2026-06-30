import type { DashboardSnapshotStore } from "./ports.js";
import { selectDashboardSnapshotSql } from "./postgres-repository-sql.js";
import type { PostgresQueryExecutor } from "./postgres-relational-store.js";
import type { DashboardSnapshotPayload } from "./types.js";

type DashboardSnapshotRow = {
  payload: unknown;
};

export function createPostgresDashboardSnapshotStore(
  executor: PostgresQueryExecutor
): DashboardSnapshotStore {
  return {
    async getDashboardSnapshot(input) {
      const row = (
        await executor.query<DashboardSnapshotRow>(
          selectDashboardSnapshotSql(input)
        )
      ).rows[0];

      return row ? dashboardSnapshotPayload(row.payload) : undefined;
    }
  };
}

function dashboardSnapshotPayload(value: unknown): DashboardSnapshotPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Expected dashboard snapshot payload to be a JSON object.");
  }
  return value as DashboardSnapshotPayload;
}
