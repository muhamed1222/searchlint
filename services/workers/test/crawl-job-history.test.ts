import { describe, expect, it } from "vitest";

import {
  createPostgresCrawlJobHistoryStore,
  summarizeCrawlJobHistory
} from "../src/index.js";
import type {
  PostgresQuery,
  PostgresQueryExecutor,
  PostgresQueryResult
} from "@searchlint/api";

describe("createPostgresCrawlJobHistoryStore", () => {
  it("lists tenant/project/environment-scoped crawl job history", async () => {
    const executor = new FakeExecutor([
      [
        crawlRow({
          id: "crawl-3",
          status: "failed",
          failed_at: "2026-06-22T00:03:00.000Z",
          last_error: "timeout"
        }),
        crawlRow({
          id: "crawl-2",
          status: "succeeded",
          completed_at: "2026-06-22T00:02:00.000Z",
          artifact_uri: "s3://searchlint-artifacts/crawls/crawl-2/result.json"
        }),
        crawlRow({
          id: "crawl-1",
          status: "running",
          started_at: "2026-06-22T00:01:00.000Z"
        })
      ]
    ]);
    const store = createPostgresCrawlJobHistoryStore(executor);

    await expect(
      store.list({
        organizationId: "org-1",
        projectId: "project-1",
        environmentId: "env-1",
        limit: 25
      })
    ).resolves.toEqual([
      expect.objectContaining({
        id: "crawl-3",
        status: "failed",
        failedAt: "2026-06-22T00:03:00.000Z",
        lastError: "timeout"
      }),
      expect.objectContaining({
        id: "crawl-2",
        status: "succeeded",
        completedAt: "2026-06-22T00:02:00.000Z",
        artifactUri: "s3://searchlint-artifacts/crawls/crawl-2/result.json"
      }),
      expect.objectContaining({
        id: "crawl-1",
        status: "running",
        startedAt: "2026-06-22T00:01:00.000Z"
      })
    ]);
    expect(executor.queries).toEqual([
      {
        text: 'SELECT * FROM "crawl_requests" WHERE "organization_id" = $1 AND "project_id" = $2 AND "environment_id" = $3 AND "deletion_state" = $4 ORDER BY "created_at" DESC LIMIT $5;',
        values: ["org-1", "project-1", "env-1", "active", 25]
      }
    ]);
  });

  it("rejects unsafe history inputs before querying", async () => {
    const executor = new FakeExecutor([]);
    const store = createPostgresCrawlJobHistoryStore(executor);

    await expect(
      store.list({
        organizationId: " ",
        projectId: "project-1",
        environmentId: "env-1",
        limit: 25
      })
    ).rejects.toThrow("Crawl job history organizationId is required.");
    await expect(
      store.list({
        organizationId: "org-1",
        projectId: "project-1",
        environmentId: "env-1",
        limit: 101
      })
    ).rejects.toThrow(
      "Crawl job history limit must be an integer from 1 to 100."
    );
    expect(executor.queries).toEqual([]);
  });

  it("rejects invalid history rows with deterministic errors", async () => {
    const store = createPostgresCrawlJobHistoryStore(
      new FakeExecutor([[crawlRow({ status: "unknown" })]])
    );

    await expect(
      store.list({
        organizationId: "org-1",
        projectId: "project-1",
        environmentId: "env-1",
        limit: 1
      })
    ).rejects.toThrow("Unknown crawl job history status: unknown.");
  });
});

describe("summarizeCrawlJobHistory", () => {
  it("summarizes status counts, artifacts, errors, and latest transition", () => {
    const jobs = [
      historyJob({
        id: "queued",
        status: "queued",
        createdAt: "2026-06-22T00:00:00.000Z"
      }),
      historyJob({
        id: "running",
        status: "running",
        startedAt: "2026-06-22T00:01:00.000Z"
      }),
      historyJob({
        id: "succeeded",
        status: "succeeded",
        completedAt: "2026-06-22T00:02:00.000Z",
        artifactUri: "s3://searchlint-artifacts/crawls/succeeded/result.json"
      }),
      historyJob({
        id: "failed",
        status: "failed",
        failedAt: "2026-06-22T00:03:00.000Z",
        lastError: "timeout"
      }),
      historyJob({
        id: "cancelled",
        status: "cancelled",
        completedAt: "2026-06-22T00:04:00.000Z"
      })
    ];

    expect(summarizeCrawlJobHistory(jobs)).toEqual({
      total: 5,
      queued: 1,
      running: 1,
      succeeded: 1,
      failed: 1,
      cancelled: 1,
      withArtifacts: 1,
      withErrors: 1,
      latestTransitionAt: "2026-06-22T00:04:00.000Z"
    });
  });
});

class FakeExecutor implements PostgresQueryExecutor {
  readonly queries: PostgresQuery[] = [];
  private readonly rows: Record<string, unknown>[][];

  constructor(rows: readonly Record<string, unknown>[][]) {
    this.rows = rows.map((group) => [...group]);
  }

  async query<Row extends Record<string, unknown>>(
    query: PostgresQuery
  ): Promise<PostgresQueryResult<Row>> {
    this.queries.push(query);
    return {
      rows: (this.rows.shift() ?? []) as Row[]
    };
  }
}

function crawlRow(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    id: "crawl-1",
    organization_id: "org-1",
    schema_version: "cloud.crawl_requests.v1",
    created_at: "2026-06-22T00:00:00.000Z",
    retention_until: null,
    deletion_state: "active",
    project_id: "project-1",
    environment_id: "env-1",
    requested_by: "principal-1",
    max_urls: 5,
    status: "queued",
    started_at: null,
    completed_at: null,
    failed_at: null,
    last_error: null,
    artifact_uri: null,
    ...overrides
  };
}

function historyJob(
  overrides: Partial<ReturnType<typeof summarizeCrawlJobHistory>> & {
    id: string;
    status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
    createdAt?: string;
    startedAt?: string;
    completedAt?: string;
    failedAt?: string;
    artifactUri?: string;
    lastError?: string;
  }
) {
  return {
    id: overrides.id,
    organizationId: "org-1",
    projectId: "project-1",
    environmentId: "env-1",
    requestedBy: "principal-1",
    maxUrls: 5,
    status: overrides.status,
    createdAt: overrides.createdAt ?? "2026-06-22T00:00:00.000Z",
    ...(overrides.startedAt === undefined
      ? {}
      : { startedAt: overrides.startedAt }),
    ...(overrides.completedAt === undefined
      ? {}
      : { completedAt: overrides.completedAt }),
    ...(overrides.failedAt === undefined
      ? {}
      : { failedAt: overrides.failedAt }),
    ...(overrides.artifactUri === undefined
      ? {}
      : { artifactUri: overrides.artifactUri }),
    ...(overrides.lastError === undefined
      ? {}
      : { lastError: overrides.lastError })
  };
}
