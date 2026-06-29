import { describe, expect, it } from "vitest";

import { createPostgresOutboxDispatchStore } from "../src/index.js";
import type {
  PostgresQuery,
  PostgresQueryExecutor,
  PostgresQueryResult
} from "@searchlint/api";

const createdAt = "2026-06-21T00:00:00.000Z";
const lockedAt = "2026-06-21T00:00:05.000Z";
const publishedAt = "2026-06-21T00:00:10.000Z";
const retryAt = "2026-06-21T00:01:00.000Z";

describe("createPostgresOutboxDispatchStore", () => {
  it("selects pending outbox events through the SQL contract", async () => {
    const executor = new FakeExecutor([[outboxRow("outbox-1")]]);
    const store = createPostgresOutboxDispatchStore(executor);

    await expect(
      store.selectPending({
        now: createdAt,
        limit: 25
      })
    ).resolves.toEqual([outboxEvent("outbox-1")]);
    expect(executor.queries).toEqual([
      {
        text: 'SELECT * FROM "outbox_events" WHERE "status" = $1 AND "available_at" <= $2 AND "deletion_state" = $3 ORDER BY "created_at" ASC LIMIT $4;',
        values: ["pending", createdAt, "active", 25]
      }
    ]);
  });

  it("marks events processing through the SQL contract", async () => {
    const executor = new FakeExecutor([
      [
        outboxRow("outbox-1", {
          status: "processing",
          attempts: 1,
          locked_at: lockedAt
        })
      ]
    ]);
    const store = createPostgresOutboxDispatchStore(executor);

    await expect(
      store.markProcessing({
        organizationId: "org-1",
        id: "outbox-1",
        lockedAt
      })
    ).resolves.toEqual({
      ...outboxEvent("outbox-1"),
      status: "processing",
      attempts: 1,
      lockedAt
    });
    expect(executor.queries[0]).toEqual({
      text: 'UPDATE "outbox_events" SET "status" = $1, "attempts" = "attempts" + 1, "locked_at" = $2 WHERE "organization_id" = $3 AND "id" = $4 AND "status" = $5 AND "deletion_state" = $6 RETURNING *;',
      values: ["processing", lockedAt, "org-1", "outbox-1", "pending", "active"]
    });
  });

  it("marks events published through the SQL contract", async () => {
    const executor = new FakeExecutor([
      [
        outboxRow("outbox-1", {
          status: "published",
          attempts: 1,
          published_at: publishedAt
        })
      ]
    ]);
    const store = createPostgresOutboxDispatchStore(executor);

    await expect(
      store.markPublished({
        organizationId: "org-1",
        id: "outbox-1",
        publishedAt
      })
    ).resolves.toEqual({
      ...outboxEvent("outbox-1"),
      status: "published",
      attempts: 1,
      publishedAt
    });
    expect(executor.queries[0]).toEqual({
      text: 'UPDATE "outbox_events" SET "status" = $1, "published_at" = $2, "locked_at" = $3, "last_error" = $4 WHERE "organization_id" = $5 AND "id" = $6 AND "status" = $7 AND "deletion_state" = $8 RETURNING *;',
      values: [
        "published",
        publishedAt,
        null,
        null,
        "org-1",
        "outbox-1",
        "processing",
        "active"
      ]
    });
  });

  it("marks events failed through the SQL contract", async () => {
    const executor = new FakeExecutor([
      [
        outboxRow("outbox-1", {
          attempts: 1,
          available_at: retryAt,
          last_error: "SQS unavailable"
        })
      ]
    ]);
    const store = createPostgresOutboxDispatchStore(executor);

    await expect(
      store.markFailed({
        organizationId: "org-1",
        id: "outbox-1",
        lastError: "SQS unavailable",
        availableAt: retryAt
      })
    ).resolves.toEqual({
      ...outboxEvent("outbox-1"),
      attempts: 1,
      availableAt: retryAt,
      lastError: "SQS unavailable"
    });
    expect(executor.queries[0]).toEqual({
      text: 'UPDATE "outbox_events" SET "status" = $1, "available_at" = $2, "locked_at" = $3, "last_error" = $4 WHERE "organization_id" = $5 AND "id" = $6 AND "status" = $7 AND "deletion_state" = $8 RETURNING *;',
      values: [
        "pending",
        retryAt,
        null,
        "SQS unavailable",
        "org-1",
        "outbox-1",
        "processing",
        "active"
      ]
    });
  });

  it("returns undefined when transition updates do not return a row", async () => {
    const executor = new FakeExecutor([[]]);
    const store = createPostgresOutboxDispatchStore(executor);

    await expect(
      store.markProcessing({
        organizationId: "org-1",
        id: "outbox-1",
        lockedAt
      })
    ).resolves.toBeUndefined();
  });

  it("rejects malformed selected rows before dispatch", async () => {
    const executor = new FakeExecutor([
      [
        outboxRow("outbox-1", {
          payload: {
            crawlRequestId: "crawl-1"
          }
        })
      ]
    ]);
    const store = createPostgresOutboxDispatchStore(executor);

    await expect(
      store.selectPending({
        now: createdAt,
        limit: 25
      })
    ).rejects.toThrow("Expected payload to be a crawl job payload.");
  });

  it("identifies malformed transition rows by operation and event", async () => {
    const executor = new FakeExecutor([
      [
        outboxRow("outbox-1", {
          attempts: "1"
        })
      ]
    ]);
    const store = createPostgresOutboxDispatchStore(executor);

    await expect(
      store.markPublished({
        organizationId: "org-1",
        id: "outbox-1",
        publishedAt
      })
    ).rejects.toThrow(
      "markPublished returned malformed outbox row outbox-1: Expected attempts to be an integer."
    );
  });

  it("rejects invalid topics and statuses", async () => {
    const topicExecutor = new FakeExecutor([
      [
        outboxRow("outbox-1", {
          topic: "unknown.topic"
        })
      ]
    ]);
    const statusExecutor = new FakeExecutor([
      [
        outboxRow("outbox-1", {
          status: "unknown"
        })
      ]
    ]);

    await expect(
      createPostgresOutboxDispatchStore(topicExecutor).selectPending({
        now: createdAt,
        limit: 25
      })
    ).rejects.toThrow("Expected topic to be an outbox topic.");
    await expect(
      createPostgresOutboxDispatchStore(statusExecutor).selectPending({
        now: createdAt,
        limit: 25
      })
    ).rejects.toThrow("Expected status to be an outbox status.");
  });
});

function outboxRow(
  id: string,
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    id,
    organization_id: "org-1",
    schema_version: "cloud.outbox_events.v1",
    created_at: createdAt,
    retention_until: null,
    deletion_state: "active",
    topic: "crawl.requested",
    payload: {
      crawlRequestId: "crawl-1",
      organizationId: "org-1",
      projectId: "project-1",
      environmentId: "env-1",
      maxUrls: 500
    },
    status: "pending",
    attempts: 0,
    available_at: createdAt,
    locked_at: null,
    published_at: null,
    last_error: null,
    ...overrides
  };
}

function outboxEvent(id: string) {
  return {
    id,
    organizationId: "org-1",
    topic: "crawl.requested",
    payload: {
      crawlRequestId: "crawl-1",
      organizationId: "org-1",
      projectId: "project-1",
      environmentId: "env-1",
      maxUrls: 500
    },
    status: "pending",
    attempts: 0,
    createdAt,
    availableAt: createdAt
  };
}

class FakeExecutor implements PostgresQueryExecutor {
  readonly queries: PostgresQuery[] = [];
  private readonly batches: Array<readonly Record<string, unknown>[]>;

  constructor(batches: readonly (readonly Record<string, unknown>[])[]) {
    this.batches = [...batches];
  }

  async query<Row extends Record<string, unknown>>(
    query: PostgresQuery
  ): Promise<PostgresQueryResult<Row>> {
    this.queries.push(query);
    return {
      rows: (this.batches.shift() ?? []) as readonly Row[]
    };
  }
}
