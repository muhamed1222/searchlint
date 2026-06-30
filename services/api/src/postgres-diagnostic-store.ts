import type { DiagnosticStore } from "./ports.js";
import type { PostgresQueryExecutor } from "./postgres-relational-store.js";
import { upsertDashboardDiagnosticSql } from "./postgres-repository-sql.js";
import type {
  DiagnosticConfidence,
  DiagnosticRecord,
  DiagnosticSeverity,
  DiagnosticSource,
  DiagnosticSourceLocation,
  DiagnosticStructuredEvidence
} from "./types.js";

export function createPostgresDiagnosticStore(
  executor: PostgresQueryExecutor
): DiagnosticStore {
  return {
    async upsertDiagnostic(input) {
      const row = (
        await executor.query<Record<string, unknown>>(
          upsertDashboardDiagnosticSql(input)
        )
      ).rows[0];
      if (!row) {
        throw new Error("upsertDiagnostic did not return a row.");
      }
      return diagnosticFromRow(row);
    }
  };
}

function diagnosticFromRow(row: Record<string, unknown>): DiagnosticRecord {
  const record: DiagnosticRecord = {
    id: text(row, "id"),
    organizationId: text(row, "organization_id"),
    projectId: text(row, "project_id"),
    environmentId: text(row, "environment_id"),
    ruleId: text(row, "rule_id"),
    severity: severity(row.severity),
    confidence: confidence(row.confidence),
    pageUrl: text(row, "page_url"),
    source: source(row.source),
    title: text(row, "title"),
    evidence: text(row, "evidence"),
    observedAt: text(row, "observed_at"),
    fingerprint: text(row, "fingerprint"),
    deletionState: deletionState(row.deletion_state),
    createdAt: text(row, "created_at")
  };

  assignOptionalText(record, "crawlRequestId", row, "crawl_request_id");
  assignOptionalText(record, "route", row, "route");
  assignOptionalText(record, "expected", row, "expected");
  assignOptionalText(record, "actual", row, "actual");

  const sourceLocation = optionalSourceLocation(row.source_location);
  if (sourceLocation) {
    record.sourceLocation = sourceLocation;
  }

  const structuredEvidence = optionalStructuredEvidence(
    row.structured_evidence
  );
  if (structuredEvidence) {
    record.structuredEvidence = structuredEvidence;
  }

  const retentionUntil = optionalText(row, "retention_until");
  if (retentionUntil !== undefined) {
    record.retentionUntil = retentionUntil;
  }

  return record;
}

function assignOptionalText<
  Key extends "crawlRequestId" | "route" | "expected" | "actual"
>(
  record: DiagnosticRecord,
  key: Key,
  row: Record<string, unknown>,
  field: string
): void {
  const value = optionalText(row, field);
  if (value !== undefined) {
    record[key] = value;
  }
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

function severity(value: unknown): DiagnosticSeverity {
  if (
    value === "blocker" ||
    value === "error" ||
    value === "warning" ||
    value === "info"
  ) {
    return value;
  }
  throw new Error("Expected severity to be a SearchLint diagnostic severity.");
}

function confidence(value: unknown): DiagnosticConfidence {
  if (value === "certain" || value === "likely" || value === "heuristic") {
    return value;
  }
  throw new Error(
    "Expected confidence to be a SearchLint diagnostic confidence."
  );
}

function source(value: unknown): DiagnosticSource {
  if (
    value === "source-code" ||
    value === "raw-html" ||
    value === "rendered-dom" ||
    value === "http-header" ||
    value === "crawler" ||
    value === "google" ||
    value === "yandex"
  ) {
    return value;
  }
  throw new Error("Expected source to be a SearchLint diagnostic source.");
}

function deletionState(value: unknown): DiagnosticRecord["deletionState"] {
  if (value === "active" || value === "deleting" || value === "deleted") {
    return value;
  }
  throw new Error("Expected deletion_state to be a valid deletion state.");
}

function optionalSourceLocation(
  value: unknown
): DiagnosticSourceLocation | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  if (!isPlainObject(value)) {
    throw new Error("Expected source_location to be an object when present.");
  }
  if (value.confidence !== "exact" && value.confidence !== "related") {
    throw new Error(
      "Expected source_location.confidence to be exact or related."
    );
  }
  return value as DiagnosticSourceLocation;
}

function optionalStructuredEvidence(
  value: unknown
): readonly DiagnosticStructuredEvidence[] | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value) || !value.every(isPlainObject)) {
    throw new Error(
      "Expected structured_evidence to be an object array when present."
    );
  }
  return value as readonly DiagnosticStructuredEvidence[];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
