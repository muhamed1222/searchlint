import { describe, expect, it } from "vitest";

import { createPostgresDiagnosticStore } from "../src/index.js";
import type {
  DiagnosticRecord,
  PostgresQuery,
  PostgresQueryExecutor,
  PostgresQueryResult
} from "../src/index.js";

const createdAt = "2026-06-21T00:00:00.000Z";

describe("createPostgresDiagnosticStore", () => {
  it("upserts diagnostics through the repository SQL contract", async () => {
    const input: DiagnosticRecord = {
      id: "diagnostic-1",
      organizationId: "org-1",
      projectId: "project-1",
      environmentId: "env-1",
      crawlRequestId: "crawl-1",
      ruleId: "SL-META-001",
      severity: "error",
      confidence: "certain",
      pageUrl: "https://example.com/",
      route: "/",
      source: "crawler",
      title: "Missing title",
      evidence: "The rendered page does not contain a title element.",
      expected: "A non-empty title element",
      actual: "No title element",
      sourceLocation: {
        selector: "head > title",
        confidence: "exact"
      },
      structuredEvidence: [{ kind: "selector", selector: "title" }],
      observedAt: "2026-06-21T00:00:30.000Z",
      fingerprint: "diagnostic:fingerprint",
      deletionState: "active",
      createdAt
    };
    const executor = new FakeExecutor([
      {
        id: input.id,
        organization_id: input.organizationId,
        schema_version: "cloud.diagnostics.v1",
        created_at: input.createdAt,
        retention_until: null,
        deletion_state: "active",
        project_id: input.projectId,
        environment_id: input.environmentId,
        crawl_request_id: input.crawlRequestId,
        rule_id: input.ruleId,
        severity: input.severity,
        confidence: input.confidence,
        page_url: input.pageUrl,
        route: input.route,
        source: input.source,
        title: input.title,
        evidence: input.evidence,
        expected: input.expected,
        actual: input.actual,
        source_location: input.sourceLocation,
        structured_evidence: input.structuredEvidence,
        observed_at: input.observedAt,
        fingerprint: input.fingerprint
      }
    ]);
    const store = createPostgresDiagnosticStore(executor);

    await expect(store.upsertDiagnostic(input)).resolves.toEqual(input);
    expect(executor.queries[0]?.text).toContain('INSERT INTO "diagnostics"');
    expect(executor.queries[0]?.text).toContain(
      'ON CONFLICT ("organization_id", "project_id", "environment_id", "fingerprint") DO UPDATE'
    );
    expect(executor.queries[0]?.values).toEqual([
      "diagnostic-1",
      "org-1",
      "cloud.diagnostics.v1",
      "2026-06-21T00:00:00.000Z",
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
      "A non-empty title element",
      "No title element",
      {
        selector: "head > title",
        confidence: "exact"
      },
      [{ kind: "selector", selector: "title" }],
      "2026-06-21T00:00:30.000Z",
      "diagnostic:fingerprint"
    ]);
  });

  it("fails deterministically when upsert returns no row", async () => {
    const executor = new FakeExecutor([undefined]);
    const store = createPostgresDiagnosticStore(executor);

    await expect(
      store.upsertDiagnostic({
        id: "diagnostic-1",
        organizationId: "org-1",
        projectId: "project-1",
        environmentId: "env-1",
        ruleId: "SL-META-001",
        severity: "error",
        confidence: "certain",
        pageUrl: "https://example.com/",
        source: "crawler",
        title: "Missing title",
        evidence: "The rendered page does not contain a title element.",
        observedAt: "2026-06-21T00:00:30.000Z",
        fingerprint: "diagnostic:fingerprint",
        deletionState: "active",
        createdAt
      })
    ).rejects.toThrow("upsertDiagnostic did not return a row.");
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
