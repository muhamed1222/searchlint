import type { PostgresQueryExecutor } from "./postgres-relational-store.js";
import {
  selectHistoryRollupsSql,
  upsertHistoryRollupSql
} from "./postgres-repository-sql.js";

export type HistoryRollupKind = "diagnostics" | "external-observations";

export type HistoryRollupRecord = {
  id: string;
  organizationId: string;
  projectId: string;
  environmentId: string;
  rollupKind: HistoryRollupKind;
  rollupKey: string;
  periodStart: string;
  periodEnd: string;
  dimensions: Readonly<Record<string, unknown>>;
  metrics: Readonly<Record<string, unknown>>;
  generatedAt: string;
  deletionState: "active" | "deleting" | "deleted";
  createdAt: string;
  retentionUntil?: string;
};

export type HistoryRollupStore = {
  upsertRollup(input: HistoryRollupRecord): Promise<HistoryRollupRecord>;
  listRollups(input: {
    organizationId: string;
    projectId: string;
    environmentId: string;
    rollupKind?: HistoryRollupKind;
    limit: number;
  }): Promise<readonly HistoryRollupRecord[]>;
};

export function createPostgresHistoryRollupStore(
  executor: PostgresQueryExecutor
): HistoryRollupStore {
  return {
    async upsertRollup(input) {
      const row = (
        await executor.query<Record<string, unknown>>(
          upsertHistoryRollupSql(input)
        )
      ).rows[0];
      if (!row) {
        throw new Error("upsertRollup did not return a row.");
      }
      return rollupFromRow(row);
    },

    async listRollups(input) {
      const result = await executor.query<Record<string, unknown>>(
        selectHistoryRollupsSql(input)
      );
      return result.rows.map(rollupFromRow);
    }
  };
}

function rollupFromRow(row: Record<string, unknown>): HistoryRollupRecord {
  const record: HistoryRollupRecord = {
    id: text(row, "id"),
    organizationId: text(row, "organization_id"),
    projectId: text(row, "project_id"),
    environmentId: text(row, "environment_id"),
    rollupKind: rollupKind(row.rollup_kind),
    rollupKey: text(row, "rollup_key"),
    periodStart: text(row, "period_start"),
    periodEnd: text(row, "period_end"),
    dimensions: jsonObject(row.dimensions, "dimensions"),
    metrics: jsonObject(row.metrics, "metrics"),
    generatedAt: text(row, "generated_at"),
    deletionState: deletionState(row.deletion_state),
    createdAt: text(row, "created_at")
  };

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

function rollupKind(value: unknown): HistoryRollupKind {
  if (value === "diagnostics" || value === "external-observations") {
    return value;
  }
  throw new Error("Expected rollup_kind to be a history rollup kind.");
}

function deletionState(value: unknown): HistoryRollupRecord["deletionState"] {
  if (value === "active" || value === "deleting" || value === "deleted") {
    return value;
  }
  throw new Error("Expected deletion_state to be a valid deletion state.");
}

function jsonObject(
  value: unknown,
  field: string
): Readonly<Record<string, unknown>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Expected ${field} to be a JSON object.`);
  }
  return value as Readonly<Record<string, unknown>>;
}
