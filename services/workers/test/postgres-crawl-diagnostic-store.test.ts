import { describe, expect, it } from "vitest";

import { createPostgresCloudCrawlDiagnosticStore } from "../src/index.js";
import type {
  PostgresQuery,
  PostgresQueryExecutor,
  PostgresQueryResult
} from "@searchlint/api";

describe("createPostgresCloudCrawlDiagnosticStore", () => {
  it("maps crawl diagnostics to tenant-scoped PostgreSQL diagnostic records", async () => {
    const executor = new FakeExecutor([
      {
        id: "diagnostic-1",
        organization_id: "org-1",
        schema_version: "cloud.diagnostics.v1",
        created_at: "2026-06-21T00:00:02.000Z",
        retention_until: null,
        deletion_state: "active",
        project_id: "project-1",
        environment_id: "env-1",
        crawl_request_id: "crawl-1",
        rule_id: "SL-META-001",
        severity: "error",
        confidence: "certain",
        page_url: "https://example.com/",
        route: "/",
        source: "crawler",
        title: "Missing title",
        evidence: "The rendered page does not contain a title element.",
        expected: null,
        actual: null,
        source_location: null,
        structured_evidence: null,
        observed_at: "2026-06-21T00:00:01.000Z",
        fingerprint: "diagnostic:fingerprint"
      }
    ]);
    const store = createPostgresCloudCrawlDiagnosticStore({
      executor,
      clock: {
        now() {
          return "2026-06-21T00:00:02.000Z";
        }
      },
      ids: {
        nextId() {
          return "diagnostic-1";
        }
      }
    });

    await store.recordCrawlDiagnostics({
      payload: {
        crawlRequestId: "crawl-1",
        organizationId: "org-1",
        projectId: "project-1",
        environmentId: "env-1",
        maxUrls: 5
      },
      diagnostics: [
        {
          ruleId: "SL-META-001",
          severity: "error",
          confidence: "certain",
          pageUrl: "https://example.com/",
          route: "/",
          source: "crawler",
          title: "Missing title",
          evidence: "The rendered page does not contain a title element.",
          observedAt: "2026-06-21T00:00:01.000Z",
          fingerprint: "diagnostic:fingerprint"
        }
      ]
    });

    expect(executor.queries).toHaveLength(1);
    expect(executor.queries[0]?.text).toContain('INSERT INTO "diagnostics"');
    expect(executor.queries[0]?.values).toEqual([
      "diagnostic-1",
      "org-1",
      "cloud.diagnostics.v1",
      "2026-06-21T00:00:02.000Z",
      null,
      "active",
      "project-1",
      "env-1",
      "crawl-1",
      "SL-META-001",
      "error",
      "certain",
      "https://example.com/",
      "/",
      "crawler",
      "Missing title",
      "The rendered page does not contain a title element.",
      null,
      null,
      null,
      null,
      "2026-06-21T00:00:01.000Z",
      "diagnostic:fingerprint"
    ]);
  });
});

class FakeExecutor implements PostgresQueryExecutor {
  readonly queries: PostgresQuery[] = [];
  private readonly rows: Record<string, unknown>[];

  constructor(rows: readonly Record<string, unknown>[]) {
    this.rows = [...rows];
  }

  async query<Row extends Record<string, unknown>>(
    query: PostgresQuery
  ): Promise<PostgresQueryResult<Row>> {
    this.queries.push(query);
    return {
      rows: [this.rows.shift() as Row]
    };
  }
}
