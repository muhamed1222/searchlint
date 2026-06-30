import { describe, expect, it } from "vitest";

import {
  createPostgresCloudCrawlJobStore,
  createPostgresCloudCrawlTargetResolver
} from "../src/index.js";
import type {
  CrawlJobPayload,
  PostgresQuery,
  PostgresQueryExecutor,
  PostgresQueryResult
} from "@searchlint/api";
import type { CrawlResult } from "@searchlint/crawler";

describe("createPostgresCloudCrawlTargetResolver", () => {
  it("resolves crawl targets from active environment base URLs", async () => {
    const executor = new FakeExecutor([
      [
        environmentRow({
          base_url: "https://example.com/"
        })
      ]
    ]);
    const resolver = createPostgresCloudCrawlTargetResolver(executor);

    await expect(resolver.resolveCrawlTarget(crawlPayload())).resolves.toEqual({
      startUrl: "https://example.com/"
    });
    expect(executor.queries).toEqual([
      {
        text: 'SELECT * FROM "environments" WHERE "organization_id" = $1 AND "id" = $2 AND "deletion_state" = $3 LIMIT 1;',
        values: ["org-1", "env-1", "active"]
      }
    ]);
  });

  it("returns undefined for missing environments", async () => {
    const executor = new FakeExecutor([[]]);
    const resolver = createPostgresCloudCrawlTargetResolver(executor);

    await expect(resolver.resolveCrawlTarget(crawlPayload())).resolves.toBe(
      undefined
    );
  });

  it("rejects project mismatches before crawling", async () => {
    const executor = new FakeExecutor([
      [
        environmentRow({
          project_id: "other-project"
        })
      ]
    ]);
    const resolver = createPostgresCloudCrawlTargetResolver(executor);

    await expect(resolver.resolveCrawlTarget(crawlPayload())).rejects.toThrow(
      "Crawl target environment env-1 belongs to project other-project, expected project-1."
    );
  });
});

describe("createPostgresCloudCrawlJobStore", () => {
  it("marks crawl requests running through the SQL contract", async () => {
    const executor = new FakeExecutor([
      [crawlRequestRow({ status: "running" })]
    ]);
    const store = createPostgresCloudCrawlJobStore(executor);

    await store.markRunning({
      payload: crawlPayload(),
      startedAt: "2026-06-21T00:00:00.000Z"
    });

    expect(executor.queries).toEqual([
      {
        text: 'UPDATE "crawl_requests" SET "status" = $1, "started_at" = $2, "completed_at" = $3, "failed_at" = $4, "last_error" = $5 WHERE "organization_id" = $6 AND "id" = $7 AND "status" = $8 AND "deletion_state" = $9 RETURNING *;',
        values: [
          "running",
          "2026-06-21T00:00:00.000Z",
          null,
          null,
          null,
          "org-1",
          "crawl-1",
          "queued",
          "active"
        ]
      }
    ]);
  });

  it("marks crawl requests succeeded through the SQL contract", async () => {
    const executor = new FakeExecutor([
      [crawlRequestRow({ status: "succeeded" })]
    ]);
    const store = createPostgresCloudCrawlJobStore(executor);

    await store.markSucceeded({
      payload: crawlPayload(),
      target: {
        startUrl: "https://example.com/"
      },
      result: crawlResult(),
      completedAt: "2026-06-21T00:00:10.000Z"
    });

    expect(executor.queries).toEqual([
      {
        text: 'UPDATE "crawl_requests" SET "status" = $1, "completed_at" = $2, "failed_at" = $3, "last_error" = $4, "artifact_uri" = $5 WHERE "organization_id" = $6 AND "id" = $7 AND "status" = $8 AND "deletion_state" = $9 RETURNING *;',
        values: [
          "succeeded",
          "2026-06-21T00:00:10.000Z",
          null,
          null,
          null,
          "org-1",
          "crawl-1",
          "running",
          "active"
        ]
      }
    ]);
  });

  it("persists artifact URIs on successful crawl requests", async () => {
    const executor = new FakeExecutor([
      [
        crawlRequestRow({
          status: "succeeded",
          artifact_uri: "s3://searchlint-artifacts/crawls/crawl-1/result.json"
        })
      ]
    ]);
    const store = createPostgresCloudCrawlJobStore(executor);

    await store.markSucceeded({
      payload: crawlPayload(),
      target: {
        startUrl: "https://example.com/"
      },
      result: crawlResult(),
      completedAt: "2026-06-21T00:00:10.000Z",
      artifactUri: "s3://searchlint-artifacts/crawls/crawl-1/result.json"
    });

    expect(executor.queries).toEqual([
      {
        text: 'UPDATE "crawl_requests" SET "status" = $1, "completed_at" = $2, "failed_at" = $3, "last_error" = $4, "artifact_uri" = $5 WHERE "organization_id" = $6 AND "id" = $7 AND "status" = $8 AND "deletion_state" = $9 RETURNING *;',
        values: [
          "succeeded",
          "2026-06-21T00:00:10.000Z",
          null,
          null,
          "s3://searchlint-artifacts/crawls/crawl-1/result.json",
          "org-1",
          "crawl-1",
          "running",
          "active"
        ]
      }
    ]);
  });

  it("marks crawl requests failed through the SQL contract", async () => {
    const executor = new FakeExecutor([
      [crawlRequestRow({ status: "failed" })]
    ]);
    const store = createPostgresCloudCrawlJobStore(executor);

    await store.markFailed({
      payload: crawlPayload(),
      errorMessage: "network unavailable",
      failedAt: "2026-06-21T00:00:10.000Z"
    });

    expect(executor.queries).toEqual([
      {
        text: 'UPDATE "crawl_requests" SET "status" = $1, "failed_at" = $2, "last_error" = $3 WHERE "organization_id" = $4 AND "id" = $5 AND "status" = $6 AND "deletion_state" = $7 RETURNING *;',
        values: [
          "failed",
          "2026-06-21T00:00:10.000Z",
          "network unavailable",
          "org-1",
          "crawl-1",
          "running",
          "active"
        ]
      }
    ]);
  });

  it("throws deterministic errors when lifecycle transitions update no row", async () => {
    const executor = new FakeExecutor([[]]);
    const store = createPostgresCloudCrawlJobStore(executor);

    await expect(
      store.markRunning({
        payload: crawlPayload(),
        startedAt: "2026-06-21T00:00:00.000Z"
      })
    ).rejects.toThrow("markRunning did not update crawl request crawl-1.");
  });
});

function crawlPayload(): CrawlJobPayload {
  return {
    crawlRequestId: "crawl-1",
    organizationId: "org-1",
    projectId: "project-1",
    environmentId: "env-1",
    maxUrls: 5
  };
}

function environmentRow(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    id: "env-1",
    organization_id: "org-1",
    schema_version: "cloud.environments.v1",
    created_at: "2026-06-21T00:00:00.000Z",
    retention_until: null,
    deletion_state: "active",
    project_id: "project-1",
    name: "Production",
    base_url: "https://example.com/",
    ...overrides
  };
}

function crawlRequestRow(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    id: "crawl-1",
    organization_id: "org-1",
    schema_version: "cloud.crawl_requests.v1",
    created_at: "2026-06-21T00:00:00.000Z",
    retention_until: null,
    deletion_state: "active",
    project_id: "project-1",
    environment_id: "env-1",
    requested_by: "principal-1",
    max_urls: 5,
    status: "running",
    started_at: null,
    completed_at: null,
    failed_at: null,
    last_error: null,
    artifact_uri: null,
    ...overrides
  };
}

function crawlResult(): CrawlResult {
  return {
    startUrl: "https://example.com/",
    pages: [],
    skipped: []
  };
}

class FakeExecutor implements PostgresQueryExecutor {
  readonly queries: PostgresQuery[] = [];
  private readonly rows: readonly (readonly Record<string, unknown>[])[];

  constructor(rows: readonly (readonly Record<string, unknown>[])[]) {
    this.rows = rows;
  }

  async query<Row extends Record<string, unknown>>(
    query: PostgresQuery
  ): Promise<PostgresQueryResult<Row>> {
    this.queries.push(query);
    const rows = this.rows[this.queries.length - 1] ?? [];
    return {
      rows: rows as readonly Row[]
    };
  }
}
