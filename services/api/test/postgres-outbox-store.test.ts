import { describe, expect, it } from "vitest";

import { createPostgresOutboxStore } from "../src/index.js";
import type {
  PostgresQuery,
  PostgresQueryExecutor,
  PostgresQueryResult
} from "../src/index.js";

const createdAt = "2026-06-21T00:00:00.000Z";

describe("createPostgresOutboxStore", () => {
  it("appends outbox events through the SQL contract", async () => {
    const executor = new FakeExecutor([
      {
        id: "outbox-1",
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
        last_error: null
      }
    ]);
    const store = createPostgresOutboxStore(executor);

    await expect(
      store.append({
        id: "outbox-1",
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
      })
    ).resolves.toEqual({
      id: "outbox-1",
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
    });
    expect(executor.queries[0]?.text).toBe(
      'INSERT INTO "outbox_events" ("id", "organization_id", "schema_version", "created_at", "retention_until", "deletion_state", "topic", "payload", "status", "attempts", "available_at", "locked_at", "published_at", "last_error") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *;'
    );
  });

  it("normalizes pg Date timestamp rows to API strings", async () => {
    const executor = new FakeExecutor([
      {
        id: "outbox-1",
        organization_id: "org-1",
        schema_version: "cloud.outbox_events.v1",
        created_at: new Date(createdAt),
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
        status: "processing",
        attempts: 1,
        available_at: new Date("2026-06-21T00:00:01.000Z"),
        locked_at: new Date("2026-06-21T00:00:02.000Z"),
        published_at: new Date("2026-06-21T00:00:03.000Z"),
        last_error: null
      }
    ]);
    const store = createPostgresOutboxStore(executor);

    await expect(
      store.append({
        id: "outbox-1",
        organizationId: "org-1",
        topic: "crawl.requested",
        payload: {
          crawlRequestId: "crawl-1",
          organizationId: "org-1",
          projectId: "project-1",
          environmentId: "env-1",
          maxUrls: 500
        },
        status: "processing",
        attempts: 1,
        createdAt,
        availableAt: "2026-06-21T00:00:01.000Z"
      })
    ).resolves.toMatchObject({
      createdAt,
      availableAt: "2026-06-21T00:00:01.000Z",
      lockedAt: "2026-06-21T00:00:02.000Z",
      publishedAt: "2026-06-21T00:00:03.000Z"
    });
  });

  it("fails deterministically when append returns no row", async () => {
    const store = createPostgresOutboxStore(new FakeExecutor([undefined]));

    await expect(
      store.append({
        id: "outbox-1",
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
      })
    ).rejects.toThrow("appendOutboxEvent did not return a row.");
  });
});

type FakeRow = Record<string, unknown> | undefined;

class FakeExecutor implements PostgresQueryExecutor {
  readonly queries: PostgresQuery[] = [];
  private readonly rows: FakeRow[];

  constructor(rows: readonly FakeRow[]) {
    this.rows = [...rows];
  }

  async query<Row extends Record<string, unknown>>(
    query: PostgresQuery
  ): Promise<PostgresQueryResult<Row>> {
    this.queries.push(query);
    const row = this.rows.shift();
    return {
      rows: row ? [row as Row] : []
    };
  }
}
