import type { ReportRetentionStore } from "./ports.js";
import type { PostgresQueryExecutor } from "./postgres-relational-store.js";
import {
  insertReportArtifactSql,
  markReportArtifactDeletedSql,
  markReportArtifactDeletionFailedSql,
  markReportArtifactDeletingSql,
  selectExpiredReportArtifactsSql
} from "./postgres-repository-sql.js";
import type { ReportArtifact, ReportArtifactKind } from "./types.js";

export function createPostgresReportRetentionStore(
  executor: PostgresQueryExecutor
): ReportRetentionStore {
  return {
    async insertReportArtifact(input) {
      const row = await requiredRow(
        executor.query(insertReportArtifactSql(input)),
        "insertReportArtifact"
      );
      return reportArtifactFromRow(row);
    },

    async selectExpiredReportArtifacts(input) {
      if (!Number.isInteger(input.limit) || input.limit <= 0) {
        throw new Error(
          "Expired report artifact selection limit must be positive."
        );
      }
      const result = await executor.query<Record<string, unknown>>(
        selectExpiredReportArtifactsSql(input)
      );
      return result.rows.map(reportArtifactFromRow);
    },

    async markReportArtifactDeleting(input) {
      const row = await optionalRow(
        executor.query(markReportArtifactDeletingSql(input))
      );
      return row ? reportArtifactFromRow(row) : undefined;
    },

    async markReportArtifactDeleted(input) {
      const row = await optionalRow(
        executor.query(markReportArtifactDeletedSql(input))
      );
      return row ? reportArtifactFromRow(row) : undefined;
    },

    async markReportArtifactDeletionFailed(input) {
      const row = await optionalRow(
        executor.query(markReportArtifactDeletionFailedSql(input))
      );
      return row ? reportArtifactFromRow(row) : undefined;
    }
  };
}

async function requiredRow<Row extends Record<string, unknown>>(
  result: Promise<{ rows: readonly Row[] }>,
  operation: string
): Promise<Row> {
  const row = (await result).rows[0];
  if (!row) {
    throw new Error(`${operation} did not return a row.`);
  }
  return row;
}

async function optionalRow<Row extends Record<string, unknown>>(
  result: Promise<{ rows: readonly Row[] }>
): Promise<Row | undefined> {
  return (await result).rows[0];
}

function reportArtifactFromRow(row: Record<string, unknown>): ReportArtifact {
  const artifact: ReportArtifact = {
    id: text(row, "id"),
    organizationId: text(row, "organization_id"),
    projectId: text(row, "project_id"),
    environmentId: text(row, "environment_id"),
    reportKind: reportArtifactKind(row, "report_kind"),
    pinned: boolean(row, "pinned"),
    generatedAt: text(row, "generated_at"),
    deletionState: deletionState(row, "deletion_state"),
    createdAt: text(row, "created_at")
  };

  const artifactUri = optionalText(row, "artifact_uri");
  const retentionUntil = optionalText(row, "retention_until");
  if (artifactUri !== undefined) {
    artifact.artifactUri = artifactUri;
  }
  if (retentionUntil !== undefined) {
    artifact.retentionUntil = retentionUntil;
  }

  return artifact;
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

function boolean(row: Record<string, unknown>, field: string): boolean {
  const value = row[field];
  if (typeof value !== "boolean") {
    throw new Error(`Expected ${field} to be a boolean.`);
  }
  return value;
}

function reportArtifactKind(
  row: Record<string, unknown>,
  field: string
): ReportArtifactKind {
  const value = text(row, field);
  if (
    value === "html" ||
    value === "pdf" ||
    value === "executive" ||
    value === "developer" ||
    value === "agency"
  ) {
    return value;
  }
  throw new Error(`Expected ${field} to be a report artifact kind.`);
}

function deletionState(
  row: Record<string, unknown>,
  field: string
): ReportArtifact["deletionState"] {
  const value = text(row, field);
  if (value === "active" || value === "deleting" || value === "deleted") {
    return value;
  }
  throw new Error(`Expected ${field} to be a deletion state.`);
}
