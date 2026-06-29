import { describe, expect, it } from "vitest";

import {
  createPostgresReportHistoryStore,
  selectDashboardReportArtifactsSql,
  summarizeReportHistory
} from "../src/index.js";
import type {
  PostgresQuery,
  PostgresQueryExecutor,
  PostgresQueryResult,
  ReportArtifact
} from "../src/index.js";

describe("createPostgresReportHistoryStore", () => {
  it("lists tenant/project/environment-scoped active report history", async () => {
    const executor = new FakeExecutor([
      [
        reportRow({
          id: "report-3",
          report_kind: "pdf",
          generated_at: "2026-06-23T00:03:00.000Z",
          artifact_uri: "s3://searchlint-reports/org-1/report-3.pdf"
        }),
        reportRow({
          id: "report-2",
          report_kind: "agency",
          generated_at: "2026-06-23T00:02:00.000Z",
          pinned: true,
          retention_until: null
        }),
        reportRow({
          id: "report-1",
          report_kind: "html",
          generated_at: "2026-06-23T00:01:00.000Z"
        })
      ]
    ]);
    const store = createPostgresReportHistoryStore(executor);

    await expect(
      store.list({
        organizationId: "org-1",
        projectId: "project-1",
        environmentId: "env-1",
        limit: 25
      })
    ).resolves.toEqual([
      expect.objectContaining({
        id: "report-3",
        reportKind: "pdf",
        artifactUri: "s3://searchlint-reports/org-1/report-3.pdf"
      }),
      expect.objectContaining({
        id: "report-2",
        reportKind: "agency",
        pinned: true
      }),
      expect.objectContaining({
        id: "report-1",
        reportKind: "html"
      })
    ]);
    expect(executor.queries).toEqual([
      selectDashboardReportArtifactsSql({
        organizationId: "org-1",
        projectId: "project-1",
        environmentId: "env-1",
        limit: 25
      })
    ]);
  });

  it("rejects unsafe report history inputs before querying", async () => {
    const executor = new FakeExecutor([]);
    const store = createPostgresReportHistoryStore(executor);

    await expect(
      store.list({
        organizationId: " ",
        projectId: "project-1",
        environmentId: "env-1",
        limit: 25
      })
    ).rejects.toThrow("Report history organizationId is required.");
    await expect(
      store.list({
        organizationId: "org-1",
        projectId: "project-1",
        environmentId: "env-1",
        limit: 101
      })
    ).rejects.toThrow("Report history limit must be an integer from 1 to 100.");
    expect(executor.queries).toEqual([]);
  });

  it("rejects invalid report history rows with deterministic errors", async () => {
    const store = createPostgresReportHistoryStore(
      new FakeExecutor([[reportRow({ report_kind: "raw" })]])
    );

    await expect(
      store.list({
        organizationId: "org-1",
        projectId: "project-1",
        environmentId: "env-1",
        limit: 1
      })
    ).rejects.toThrow("Unknown report history kind: raw.");
  });
});

describe("summarizeReportHistory", () => {
  it("summarizes report kinds, pinned reports, artifacts, and timestamps", () => {
    expect(
      summarizeReportHistory([
        reportArtifact({
          id: "html-1",
          reportKind: "html",
          generatedAt: "2026-06-23T00:01:00.000Z"
        }),
        reportArtifact({
          id: "pdf-1",
          reportKind: "pdf",
          generatedAt: "2026-06-23T00:02:00.000Z",
          artifactUri: "s3://searchlint-reports/org-1/pdf-1.pdf",
          retentionUntil: "2026-09-21T00:00:00.000Z"
        }),
        reportArtifact({
          id: "agency-1",
          reportKind: "agency",
          generatedAt: "2026-06-23T00:03:00.000Z",
          pinned: true
        }),
        reportArtifact({
          id: "executive-1",
          reportKind: "executive",
          generatedAt: "2026-06-23T00:04:00.000Z",
          retentionUntil: "2026-08-21T00:00:00.000Z"
        }),
        reportArtifact({
          id: "developer-1",
          reportKind: "developer",
          generatedAt: "2026-06-23T00:05:00.000Z"
        })
      ])
    ).toEqual({
      total: 5,
      html: 1,
      pdf: 1,
      executive: 1,
      developer: 1,
      agency: 1,
      pinned: 1,
      withArtifacts: 1,
      latestGeneratedAt: "2026-06-23T00:05:00.000Z",
      earliestRetentionUntil: "2026-08-21T00:00:00.000Z"
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

function reportRow(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    id: "report-1",
    organization_id: "org-1",
    schema_version: "cloud.report_artifacts.v1",
    created_at: "2026-06-23T00:00:00.000Z",
    retention_until: "2026-09-21T00:00:00.000Z",
    deletion_state: "active",
    project_id: "project-1",
    environment_id: "env-1",
    report_kind: "html",
    artifact_uri: "s3://searchlint-reports/org-1/report-1.html",
    pinned: false,
    generated_at: "2026-06-23T00:01:00.000Z",
    ...overrides
  };
}

function reportArtifact(
  overrides: Partial<ReportArtifact> = {}
): ReportArtifact {
  return {
    id: "report-1",
    organizationId: "org-1",
    projectId: "project-1",
    environmentId: "env-1",
    reportKind: "html",
    pinned: false,
    generatedAt: "2026-06-23T00:01:00.000Z",
    deletionState: "active",
    createdAt: "2026-06-23T00:00:00.000Z",
    ...overrides
  };
}
