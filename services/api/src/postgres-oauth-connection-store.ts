import type { OAuthConnectionStore } from "./ports.js";
import type { PostgresQueryExecutor } from "./postgres-relational-store.js";
import {
  markOAuthConnectionRevokedSql,
  selectOAuthConnectionSql,
  selectOAuthConnectionsDueForRefreshSql,
  upsertOAuthConnectionSql
} from "./postgres-repository-sql.js";
import type {
  ExternalObservationProvider,
  OAuthConnectionRecord,
  OAuthConnectionStatus
} from "./types.js";

export function createPostgresOAuthConnectionStore(
  executor: PostgresQueryExecutor
): OAuthConnectionStore {
  return {
    async upsertOAuthConnection(input) {
      const row = (
        await executor.query<Record<string, unknown>>(
          upsertOAuthConnectionSql(input)
        )
      ).rows[0];
      if (!row) {
        throw new Error("upsertOAuthConnection did not return a row.");
      }
      return oauthConnectionFromRow(row);
    },

    async getOAuthConnection(input) {
      const row = (
        await executor.query<Record<string, unknown>>(
          selectOAuthConnectionSql(input)
        )
      ).rows[0];
      return row === undefined ? undefined : oauthConnectionFromRow(row);
    },

    async selectOAuthConnectionsDueForRefresh(input) {
      const result = await executor.query<Record<string, unknown>>(
        selectOAuthConnectionsDueForRefreshSql(input)
      );
      return result.rows.map(oauthConnectionFromRow);
    },

    async markOAuthConnectionRevoked(input) {
      const row = (
        await executor.query<Record<string, unknown>>(
          markOAuthConnectionRevokedSql(input)
        )
      ).rows[0];
      return row === undefined ? undefined : oauthConnectionFromRow(row);
    }
  };
}

function oauthConnectionFromRow(
  row: Record<string, unknown>
): OAuthConnectionRecord {
  const record: OAuthConnectionRecord = {
    id: text(row, "id"),
    organizationId: text(row, "organization_id"),
    projectId: text(row, "project_id"),
    environmentId: text(row, "environment_id"),
    provider: provider(row.provider),
    providerAccountId: text(row, "provider_account_id"),
    scopes: scopes(row.scopes),
    refreshTokenSecretRef: secretRef(row, "refresh_token_secret_ref"),
    status: status(row.status),
    deletionState: deletionState(row.deletion_state),
    createdAt: text(row, "created_at")
  };

  const accessTokenSecretRef = optionalSecretRef(
    row,
    "access_token_secret_ref"
  );
  if (accessTokenSecretRef !== undefined) {
    record.accessTokenSecretRef = accessTokenSecretRef;
  }

  assignOptionalText(record, "expiresAt", row, "expires_at");
  assignOptionalText(record, "lastRefreshAt", row, "last_refresh_at");
  assignOptionalText(record, "lastError", row, "last_error");
  assignOptionalText(record, "retentionUntil", row, "retention_until");

  return record;
}

function provider(value: unknown): ExternalObservationProvider {
  if (value === "google" || value === "yandex") {
    return value;
  }
  throw new Error("Expected OAuth provider to be google or yandex.");
}

function status(value: unknown): OAuthConnectionStatus {
  if (
    value === "active" ||
    value === "expired" ||
    value === "revoked" ||
    value === "error"
  ) {
    return value;
  }
  throw new Error("Expected OAuth connection status to be valid.");
}

function scopes(value: unknown): readonly string[] {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    !value.every((item) => typeof item === "string" && item.length > 0)
  ) {
    throw new Error("Expected OAuth scopes to be a non-empty string array.");
  }
  return value;
}

function secretRef(row: Record<string, unknown>, field: string): string {
  const value = text(row, field);
  assertSecretRef(value, field);
  return value;
}

function optionalSecretRef(
  row: Record<string, unknown>,
  field: string
): string | undefined {
  const value = optionalText(row, field);
  if (value === undefined) {
    return undefined;
  }
  assertSecretRef(value, field);
  return value;
}

function assertSecretRef(value: string, field: string): void {
  if (!value.startsWith("secret://")) {
    throw new Error(`Expected ${field} to be a vault secret reference.`);
  }
}

function assignOptionalText(
  target: OAuthConnectionRecord,
  key: "expiresAt" | "lastRefreshAt" | "lastError" | "retentionUntil",
  row: Record<string, unknown>,
  field: string
): void {
  const value = optionalText(row, field);
  if (value !== undefined) {
    target[key] = value;
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

function deletionState(value: unknown): OAuthConnectionRecord["deletionState"] {
  if (value === "active" || value === "deleting" || value === "deleted") {
    return value;
  }
  throw new Error("Expected deletion_state to be a valid deletion state.");
}
