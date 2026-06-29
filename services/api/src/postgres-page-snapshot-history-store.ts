import type { PostgresQueryExecutor } from "./postgres-relational-store.js";
import {
  selectPageSnapshotHistorySql,
  upsertPageSnapshotHistorySql
} from "./postgres-repository-sql.js";

export type PageSnapshotHistoryRecord = {
  id: string;
  organizationId: string;
  projectId: string;
  environmentId: string;
  pageUrl: string;
  capturedAt: string;
  artifactReferences: Readonly<Record<string, unknown>>;
  diagnosticFingerprints: readonly string[];
  deletionState: "active" | "deleting" | "deleted";
  createdAt: string;
  retentionUntil?: string;
};

export type PageSnapshotHistoryStore = {
  upsertSnapshot(
    input: PageSnapshotHistoryRecord
  ): Promise<PageSnapshotHistoryRecord>;
  listSnapshots(input: {
    organizationId: string;
    projectId: string;
    environmentId: string;
    limit: number;
  }): Promise<readonly PageSnapshotHistoryRecord[]>;
};

export function createPostgresPageSnapshotHistoryStore(
  executor: PostgresQueryExecutor
): PageSnapshotHistoryStore {
  return {
    async upsertSnapshot(input) {
      const row = (
        await executor.query<Record<string, unknown>>(
          upsertPageSnapshotHistorySql(input)
        )
      ).rows[0];
      if (!row) {
        throw new Error("upsertSnapshot did not return a row.");
      }
      return snapshotFromRow(row);
    },

    async listSnapshots(input) {
      const result = await executor.query<Record<string, unknown>>(
        selectPageSnapshotHistorySql(input)
      );
      return result.rows.map(snapshotFromRow);
    }
  };
}

function snapshotFromRow(
  row: Record<string, unknown>
): PageSnapshotHistoryRecord {
  const record: PageSnapshotHistoryRecord = {
    id: text(row, "id"),
    organizationId: text(row, "organization_id"),
    projectId: text(row, "project_id"),
    environmentId: text(row, "environment_id"),
    pageUrl: text(row, "page_url"),
    capturedAt: text(row, "captured_at"),
    artifactReferences: jsonObject(row.artifact_references),
    diagnosticFingerprints: stringArray(row.diagnostic_fingerprints),
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

function deletionState(
  value: unknown
): PageSnapshotHistoryRecord["deletionState"] {
  if (value === "active" || value === "deleting" || value === "deleted") {
    return value;
  }
  throw new Error("Expected deletion_state to be a valid deletion state.");
}

function jsonObject(value: unknown): Readonly<Record<string, unknown>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Expected artifact_references to be a JSON object.");
  }
  return value as Readonly<Record<string, unknown>>;
}

function stringArray(value: unknown): readonly string[] {
  if (
    !Array.isArray(value) ||
    !value.every((item) => typeof item === "string")
  ) {
    throw new Error("Expected diagnostic_fingerprints to be a string array.");
  }
  return value;
}
