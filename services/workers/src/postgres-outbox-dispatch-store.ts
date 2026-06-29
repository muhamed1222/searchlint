import {
  markOutboxEventFailedSql,
  markOutboxEventProcessingSql,
  markOutboxEventPublishedSql,
  selectPendingOutboxEventsSql
} from "@searchlint/api";
import type {
  CloudOutboxEvent,
  CloudOutboxStatus,
  CloudOutboxTopic,
  PostgresQueryExecutor
} from "@searchlint/api";

import type { OutboxDispatchStore } from "./index.js";

export function createPostgresOutboxDispatchStore(
  executor: PostgresQueryExecutor
): OutboxDispatchStore {
  return {
    async selectPending(input) {
      const result = await executor.query(selectPendingOutboxEventsSql(input));
      return result.rows.map(outboxEventFromRow);
    },
    async markProcessing(input) {
      const result = await executor.query(markOutboxEventProcessingSql(input));
      return optionalOutboxEvent(input.id, "markProcessing", result.rows[0]);
    },
    async markPublished(input) {
      const result = await executor.query(markOutboxEventPublishedSql(input));
      return optionalOutboxEvent(input.id, "markPublished", result.rows[0]);
    },
    async markFailed(input) {
      const result = await executor.query(markOutboxEventFailedSql(input));
      return optionalOutboxEvent(input.id, "markFailed", result.rows[0]);
    }
  };
}

function optionalOutboxEvent(
  id: string,
  operation: string,
  row: Record<string, unknown> | undefined
): CloudOutboxEvent | undefined {
  if (!row) {
    return undefined;
  }
  try {
    return outboxEventFromRow(row);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `${operation} returned malformed outbox row ${id}: ${message}`
    );
  }
}

function outboxEventFromRow(row: Record<string, unknown>): CloudOutboxEvent {
  const event: CloudOutboxEvent = {
    id: text(row, "id"),
    organizationId: text(row, "organization_id"),
    topic: outboxTopic(row, "topic"),
    payload: crawlPayload(row, "payload"),
    status: outboxStatus(row, "status"),
    attempts: integer(row, "attempts"),
    createdAt: text(row, "created_at"),
    availableAt: text(row, "available_at")
  };
  const lockedAt = optionalText(row, "locked_at");
  const publishedAt = optionalText(row, "published_at");
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
