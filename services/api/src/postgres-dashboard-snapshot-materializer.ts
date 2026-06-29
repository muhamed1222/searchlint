import {
  createDashboardSnapshotPayload,
  type DashboardSnapshotMaterializationInput
} from "./dashboard-snapshot-materialization.js";
import { upsertDashboardSnapshotSql } from "./postgres-repository-sql.js";
import type { PostgresQueryExecutor } from "./postgres-relational-store.js";
import type { DashboardSnapshotPayload } from "./types.js";

export type PostgresDashboardSnapshotMaterializer = {
  materializeDashboardSnapshot(
    input: DashboardSnapshotMaterializationInput
  ): Promise<DashboardSnapshotPayload>;
};

export function createPostgresDashboardSnapshotMaterializer(
  executor: PostgresQueryExecutor
): PostgresDashboardSnapshotMaterializer {
  return {
    async materializeDashboardSnapshot(input) {
      const payload = createDashboardSnapshotPayload(input);
      const result = await executor.query(
        upsertDashboardSnapshotSql({
          id: input.id,
          organizationId: input.organization.id,
          projectId: input.project.id,
          environmentId: input.environment.id,
          payload,
          materializedAt: input.materializedAt,
          ...(input.retentionUntil === undefined
            ? {}
            : { retentionUntil: input.retentionUntil })
        })
      );
      if (!result.rows[0]) {
        throw new Error(
          "Dashboard snapshot materialization did not return a row."
        );
      }
      return payload;
    }
  };
}
