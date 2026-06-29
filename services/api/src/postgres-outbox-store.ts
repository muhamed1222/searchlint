import type { OutboxStore } from "./ports.js";
import type { PostgresQueryExecutor } from "./postgres-relational-store.js";
import { insertOutboxEventSql } from "./postgres-repository-sql.js";
import type {
  CloudOutboxEvent,
  CloudOutboxStatus,
  CloudOutboxTopic
} from "./types.js";

export function createPostgresOutboxStore(
  executor: PostgresQueryExecutor
): OutboxStore {
  return {
    async append(event) {
      const result = await executor.query(insertOutboxEventSql(event));
      const row = result.rows[0];
      if (!row) {
        throw new Error("appendOutboxEvent did not return a row.");
      }
      return outboxEventFromRow(row);
    }
  };
}

function outboxEventFromRow(row: Record<string, unknown>): CloudOutboxEvent {
  const event: CloudOutboxEvent = {
    id: text(row, "id"),
    organizationId: text(row, "organization_id"),
    topic: outboxTopic(row, "topic"),
    payload: crawlPayload(row, "payload"),
    status: outboxStatus(row, "status"),
    attempts: integer(row, "attempts"),
    createdAt: timestampText(row, "created_at"),
    availableAt: timestampText(row, "available_at")
  };
  const lockedAt = optionalTimestampText(row, "locked_at");
  const publishedAt = optionalTimestampText(row, "published_at");
  const lastError = optionalText(row, "last_error");
  if (lockedAt !== undefined) {
    event.lockedAt = lockedAt;
  }
  if (publishedAt !== undefined) {
    event.publishedAt = publishedAt;
  }
  if (lastError !== undefined) {
    event.lastError = lastError;
  }
  return event;
}

function crawlPayload(
  row: Record<string, unknown>,
  field: string
): CloudOutboxEvent["payload"] {
  const value = row[field];
  if (
    !isRecord(value) ||
    typeof value.crawlRequestId !== "string" ||
    typeof value.organizationId !== "string" ||
    typeof value.projectId !== "string" ||
    typeof value.environmentId !== "string" ||
    typeof value.maxUrls !== "number" ||
    !Number.isInteger(value.maxUrls)
  ) {
    throw new Error(`Expected ${field} to be a crawl job payload.`);
  }
  return {
    crawlRequestId: value.crawlRequestId,
    organizationId: value.organizationId,
    projectId: value.projectId,
    environmentId: value.environmentId,
    maxUrls: value.maxUrls
  };
}

function outboxTopic(
  row: Record<string, unknown>,
  field: string
): CloudOutboxTopic {
  const value = text(row, field);
  if (value === "crawl.requested") {
    return value;
  }
  throw new Error(`Expected ${field} to be an outbox topic.`);
}

function outboxStatus(
  row: Record<string, unknown>,
  field: string
): CloudOutboxStatus {
  const value = text(row, field);
  if (
    value === "pending" ||
    value === "processing" ||
    value === "published" ||
    value === "failed"
  ) {
    return value;
  }
  throw new Error(`Expected ${field} to be an outbox status.`);
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
    throw new Error(`Expected ${field} to be a nullable string.`);
  }
  return value;
}

function timestampText(row: Record<string, unknown>, field: string): string {
  const value = row[field];
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value !== "string") {
    throw new Error(`Expected ${field} to be a timestamp string or Date.`);
  }
  return value;
}

function optionalTimestampText(
  row: Record<string, unknown>,
  field: string
): string | undefined {
  const value = row[field];
  if (value === null || value === undefined) {
    return undefined;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value !== "string") {
    throw new Error(
      `Expected ${field} to be a timestamp string or Date when present.`
    );
  }
  return value;
}

function integer(row: Record<string, unknown>, field: string): number {
  const value = row[field];
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error(`Expected ${field} to be an integer.`);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
