import type { PostgresQueryExecutor } from "./postgres-relational-store.js";
import {
  selectDeploymentHistorySql,
  upsertDeploymentHistorySql
} from "./postgres-repository-sql.js";

export type DeploymentHistoryStatus =
  | "candidate"
  | "released"
  | "rolled-back"
  | "failed";

export type DeploymentHistoryRecord = {
  id: string;
  organizationId: string;
  projectId: string;
  environmentId: string;
  deploymentId: string;
  commitSha: string;
  status: DeploymentHistoryStatus;
  deployedAt: string;
  source: string;
  annotations: Readonly<Record<string, unknown>>;
  deletionState: "active" | "deleting" | "deleted";
  createdAt: string;
  actor?: string;
  retentionUntil?: string;
};

export type DeploymentHistoryStore = {
  upsertDeployment(
    input: DeploymentHistoryRecord
  ): Promise<DeploymentHistoryRecord>;
  listDeployments(input: {
    organizationId: string;
    projectId: string;
    environmentId: string;
    limit: number;
  }): Promise<readonly DeploymentHistoryRecord[]>;
};

export function createPostgresDeploymentHistoryStore(
  executor: PostgresQueryExecutor
): DeploymentHistoryStore {
  return {
    async upsertDeployment(input) {
      const row = (
        await executor.query<Record<string, unknown>>(
          upsertDeploymentHistorySql(input)
        )
      ).rows[0];
      if (!row) {
        throw new Error("upsertDeployment did not return a row.");
      }
      return deploymentFromRow(row);
    },

    async listDeployments(input) {
      const result = await executor.query<Record<string, unknown>>(
        selectDeploymentHistorySql(input)
      );
      return result.rows.map(deploymentFromRow);
    }
  };
}

function deploymentFromRow(
  row: Record<string, unknown>
): DeploymentHistoryRecord {
  const record: DeploymentHistoryRecord = {
    id: text(row, "id"),
    organizationId: text(row, "organization_id"),
    projectId: text(row, "project_id"),
    environmentId: text(row, "environment_id"),
    deploymentId: text(row, "deployment_id"),
    commitSha: text(row, "commit_sha"),
    status: status(row.status),
    deployedAt: text(row, "deployed_at"),
    source: text(row, "source"),
    annotations: annotations(row.annotations),
    deletionState: deletionState(row.deletion_state),
    createdAt: text(row, "created_at")
  };

  const actor = optionalText(row, "actor");
  if (actor !== undefined) {
    record.actor = actor;
  }
  const retentionUntil = optionalText(row, "retention_until");
  if (retentionUntil !== undefined) {
    record.retentionUntil = retentionUntil;
  }

  return record;
}

function text(row: Record<string, unknown>, field: string): string {
  const value = row[field];
  if (typeof value !== "string") {
    throw new Error(`Expected ${field} to be a string.`);
  }
  return value;
}

function optionalText(
  row: Record<string, unknown>,
  field: string
): string | undefined {
  const value = row[field];
  if (value === null || value === undefined) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new Error(`Expected ${field} to be a string when present.`);
  }
  return value;
}

function status(value: unknown): DeploymentHistoryStatus {
  if (
    value === "candidate" ||
    value === "released" ||
    value === "rolled-back" ||
    value === "failed"
  ) {
    return value;
  }
  throw new Error("Expected status to be a deployment history status.");
}

function deletionState(
  value: unknown
): DeploymentHistoryRecord["deletionState"] {
  if (value === "active" || value === "deleting" || value === "deleted") {
    return value;
  }
  throw new Error("Expected deletion_state to be a valid deletion state.");
}

function annotations(value: unknown): Readonly<Record<string, unknown>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Expected annotations to be a JSON object.");
  }
  return value as Readonly<Record<string, unknown>>;
}
