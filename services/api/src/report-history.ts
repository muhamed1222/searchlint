import type { PostgresQueryExecutor } from "./postgres-relational-store.js";
import { selectDashboardReportArtifactsSql } from "./postgres-repository-sql.js";
import type { ReportArtifact, ReportArtifactKind } from "./types.js";

export type ReportHistoryInput = {
  organizationId: string;
  projectId: string;
  environmentId: string;
  limit: number;
};

export type ReportHistoryStore = {
  list(input: ReportHistoryInput): Promise<readonly ReportArtifact[]>;
};

export type ReportHistorySummary = {
  total: number;
  html: number;
  pdf: number;
  executive: number;
  developer: number;
  agency: number;
  pinned: number;
  withArtifacts: number;
  latestGeneratedAt?: string;
  earliestRetentionUntil?: string;
};

export function createPostgresReportHistoryStore(
  executor: PostgresQueryExecutor
): ReportHistoryStore {
  return {
    async list(input) {
      validateReportHistoryInput(input);
      const result = await executor.query(
        selectDashboardReportArtifactsSql({
          organizationId: input.organizationId,
          projectId: input.projectId,
          environmentId: input.environmentId,
          limit: input.limit
        })
      );
      return result.rows.map(reportArtifactFromHistoryRow);
    }
  };
}

export function summarizeReportHistory(
  artifacts: readonly ReportArtifact[]
): ReportHistorySummary {
  const summary: ReportHistorySummary = {
    total: artifacts.length,
    html: 0,
    pdf: 0,
    executive: 0,
    developer: 0,
    agency: 0,
    pinned: 0,
    withArtifacts: 0
  };
  let latestGeneratedAt: string | undefined;
  let earliestRetentionUntil: string | undefined;

  for (const artifact of artifacts) {
    summary[artifact.reportKind] += 1;
    if (artifact.pinned) {
      summary.pinned += 1;
    }
    if (artifact.artifactUri !== undefined) {
      summary.withArtifacts += 1;
    }
    if (
      latestGeneratedAt === undefined ||
      artifact.generatedAt > latestGeneratedAt
    ) {
      latestGeneratedAt = artifact.generatedAt;
    }
    if (
      artifact.retentionUntil !== undefined &&
      (earliestRetentionUntil === undefined ||
        artifact.retentionUntil < earliestRetentionUntil)
    ) {
      earliestRetentionUntil = artifact.retentionUntil;
    }
  }

  if (latestGeneratedAt !== undefined) {
    summary.latestGeneratedAt = latestGeneratedAt;
  }
  if (earliestRetentionUntil !== undefined) {
    summary.earliestRetentionUntil = earliestRetentionUntil;
  }
  return summary;
}

function validateReportHistoryInput(input: ReportHistoryInput): void {
  for (const field of [
    "organizationId",
    "projectId",
    "environmentId"
  ] as const) {
    if (input[field].trim().length === 0) {
      throw new Error(`Report history ${field} is required.`);
    }
  }
  if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 100) {
    throw new Error("Report history limit must be an integer from 1 to 100.");
  }
}

function reportArtifactFromHistoryRow(
  row: Record<string, unknown>
): ReportArtifact {
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
    throw new Error(`Expected report history ${field} to be a string.`);
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
    throw new Error(`Expected report history ${field} to be a string.`);
  }
  return value;
}

function boolean(row: Record<string, unknown>, field: string): boolean {
  const value = row[field];
  if (typeof value !== "boolean") {
    throw new Error(`Expected report history ${field} to be a boolean.`);
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
  throw new Error(`Unknown report history kind: ${value}.`);
}

function deletionState(
  row: Record<string, unknown>,
  field: string
): ReportArtifact["deletionState"] {
  const value = text(row, field);
  if (value === "active" || value === "deleting" || value === "deleted") {
    return value;
  }
  throw new Error(`Unknown report history deletion state: ${value}.`);
}
