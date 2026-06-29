import type { ExternalObservationStore } from "./ports.js";
import type { PostgresQueryExecutor } from "./postgres-relational-store.js";
import {
  selectExternalObservationsSql,
  upsertExternalObservationSql
} from "./postgres-repository-sql.js";
import type {
  ExternalObservationFreshness,
  ExternalObservationPayload,
  ExternalObservationProvider,
  ExternalObservationQuota,
  ExternalObservationRecord,
  ExternalObservationSampling,
  ExternalObservationSource
} from "./types.js";

export function createPostgresExternalObservationStore(
  executor: PostgresQueryExecutor
): ExternalObservationStore {
  return {
    async upsertExternalObservation(input) {
      const row = (
        await executor.query<Record<string, unknown>>(
          upsertExternalObservationSql(input)
        )
      ).rows[0];
      if (!row) {
        throw new Error("upsertExternalObservation did not return a row.");
      }
      return externalObservationFromRow(row);
    },
    async selectExternalObservations(input) {
      const result = await executor.query<Record<string, unknown>>(
        selectExternalObservationsSql(input)
      );
      return result.rows.map(externalObservationFromRow);
    }
  };
}

function externalObservationFromRow(
  row: Record<string, unknown>
): ExternalObservationRecord {
  const parsedProvider = provider(row.provider);
  const record: ExternalObservationRecord = {
    id: text(row, "id"),
    organizationId: text(row, "organization_id"),
    projectId: text(row, "project_id"),
    environmentId: text(row, "environment_id"),
    provider: parsedProvider,
    source: sourceForProvider(row.source, parsedProvider),
    subjectUrl: text(row, "subject_url"),
    observedAt: text(row, "observed_at"),
    fetchedAt: text(row, "fetched_at"),
    freshness: freshness(row.freshness),
    payload: payload(row.payload),
    fingerprint: text(row, "fingerprint"),
    deletionState: deletionState(row.deletion_state),
    createdAt: text(row, "created_at")
  };

  const quotaValue = optionalObject(row.quota, "quota");
  if (quotaValue) {
    record.quota = quota(quotaValue);
  }

  const samplingValue = optionalObject(row.sampling, "sampling");
  if (samplingValue) {
    record.sampling = sampling(samplingValue);
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

function provider(value: unknown): ExternalObservationProvider {
  if (value === "google" || value === "yandex") {
    return value;
  }
  throw new Error("Expected provider to be google or yandex.");
}

function source(value: unknown): ExternalObservationSource {
  if (
    value === "google.searchConsole" ||
    value === "google.urlInspection" ||
    value === "google.searchAnalytics" ||
    value === "google.sitemap" ||
    value === "google.pagespeed" ||
    value === "google.crux" ||
    value === "yandex.webmaster" ||
    value === "yandex.metrica"
  ) {
    return value;
  }
  throw new Error("Expected source to be a known external observation source.");
}

function sourceForProvider(
  value: unknown,
  parsedProvider: ExternalObservationProvider
): ExternalObservationSource {
  const parsedSource = source(value);
  if (!parsedSource.startsWith(`${parsedProvider}.`)) {
    throw new Error("Expected source to match external observation provider.");
  }
  return parsedSource;
}

function freshness(value: unknown): ExternalObservationFreshness {
  if (
    value === "fresh" ||
    value === "stale" ||
    value === "expired" ||
    value === "unknown"
  ) {
    return value;
  }
  throw new Error("Expected freshness to be a valid external freshness state.");
}

function payload(value: unknown): ExternalObservationPayload {
  if (!isPlainObject(value)) {
    throw new Error("Expected payload to be an object.");
  }
  return value;
}

function quota(value: Record<string, unknown>): ExternalObservationQuota {
  const output: ExternalObservationQuota = {};
  assignOptionalNumber(output, "limit", value);
  assignOptionalNumber(output, "remaining", value);
  assignOptionalString(output, "resetAt", value);
  return output;
}

function sampling(value: Record<string, unknown>): ExternalObservationSampling {
  if (typeof value.sampled !== "boolean") {
    throw new Error("Expected sampling.sampled to be a boolean.");
  }
  const output: ExternalObservationSampling = {
    sampled: value.sampled
  };
  assignOptionalString(output, "state", value);
  return output;
}

function assignOptionalNumber<
  Target extends Record<string, unknown>,
  Key extends string
>(target: Target, key: Key, source: Record<string, unknown>): void {
  const value = source[key];
  if (value === null || value === undefined) {
    return;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Expected ${key} to be a finite number when present.`);
  }
  (target as Record<string, unknown>)[key] = value;
}

function assignOptionalString<
  Target extends Record<string, unknown>,
  Key extends string
>(target: Target, key: Key, source: Record<string, unknown>): void {
  const value = source[key];
  if (value === null || value === undefined) {
    return;
  }
  if (typeof value !== "string") {
    throw new Error(`Expected ${key} to be a string when present.`);
  }
  (target as Record<string, unknown>)[key] = value;
}

function optionalObject(
  value: unknown,
  field: string
): Record<string, unknown> | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  if (!isPlainObject(value)) {
    throw new Error(`Expected ${field} to be an object when present.`);
  }
  return value;
}

function deletionState(
  value: unknown
): ExternalObservationRecord["deletionState"] {
  if (value === "active" || value === "deleting" || value === "deleted") {
    return value;
  }
  throw new Error("Expected deletion_state to be a valid deletion state.");
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
