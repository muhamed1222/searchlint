import { describe, expect, it } from "vitest";

import {
  createPostgresReportRetentionStore,
  insertReportArtifactSql,
  markReportArtifactDeletedSql,
  markReportArtifactDeletionFailedSql,
  markReportArtifactDeletingSql,
  selectExpiredReportArtifactsSql
} from "../src/index.js";
import type {
  PostgresQuery,
  PostgresQueryExecutor,
  PostgresQueryResult,
  ReportArtifact
} from "../src/index.js";

const createdAt = "2026-06-21T00:00:00.000Z";
const generatedAt = "2026-06-21T00:05:00.000Z";
const retentionUntil = "2026-09-19T00:05:00.000Z";

describe("report artifact retention SQL", () => {
  it("inserts report artifact metadata with retention metadata", () => {
    expect(insertReportArtifactSql(reportArtifact())).toEqual({
      text: 'INSERT INTO "report_artifacts" ("id", "organization_id", "schema_version", "created_at", "retention_until", "deletion_state", "project_id", "environment_id", "report_kind", "artifact_uri", "pinned", "generated_at") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *;',
      values: [
        "report-1",
        "org-1",
        "cloud.report_artifacts.v1",
        createdAt,
        retentionUntil,
        "active",
        "project-1",
        "env-1",
        "html",
        "s3://searchlint-reports/org-1/report-1.html",
        false,
        generatedAt
      ]
    });
  });

  it("selects only active unpinned expired report artifacts", () => {
    expect(
      selectExpiredReportArtifactsSql({
        now: "2026-09-20T00:00:00.000Z",
        limit: 50
      })
    ).toEqual({
      text: 'SELECT * FROM "report_artifacts" WHERE "deletion_state" = $1 AND "pinned" = $2 AND "retention_until" IS NOT NULL AND "retention_until" <= $3 ORDER BY "retention_until" ASC, "created_at" ASC LIMIT $4;',
      values: ["active", false, "2026-09-20T00:00:00.000Z", 50]
    });
  });

  it("uses state transitions that preserve tenant scope", () => {
    expect(
      markReportArtifactDeletingSql({
        organizationId: "org-1",
        id: "report-1"
      })
    ).toEqual({
      text: 'UPDATE "report_artifacts" SET "deletion_state" = $1 WHERE "organization_id" = $2 AND "id" = $3 AND "deletion_state" = $4 RETURNING *;',
      values: ["deleting", "org-1", "report-1", "active"]
    });
    expect(
      markReportArtifactDeletedSql({
        organizationId: "org-1",
        id: "report-1"
      })
    ).toEqual({
      text: 'UPDATE "report_artifacts" SET "deletion_state" = $1, "artifact_uri" = $2 WHERE "organization_id" = $3 AND "id" = $4 AND "deletion_state" = $5 RETURNING *;',
      values: ["deleted", null, "org-1", "report-1", "deleting"]
    });
    expect(
      markReportArtifactDeletionFailedSql({
        organizationId: "org-1",
        id: "report-1"
      })
    ).toEqual({
      text: 'UPDATE "report_artifacts" SET "deletion_state" = $1 WHERE "organization_id" = $2 AND "id" = $3 AND "deletion_state" = $4 RETURNING *;',
      values: ["active", "org-1", "report-1", "deleting"]
    });
  });
});

describe("createPostgresReportRetentionStore", () => {
  it("inserts and maps report artifact metadata", async () => {
    const executor = new FakeExecutor([reportArtifactRow()]);
    const store = createPostgresReportRetentionStore(executor);

    await expect(store.insertReportArtifact(reportArtifact())).resolves.toEqual(
      reportArtifact()
    );
    expect(executor.queries[0]).toEqual(
      insertReportArtifactSql(reportArtifact())
    );
  });

  it("selects expired report artifacts through the SQL contract", async () => {
    const executor = new FakeExecutor([reportArtifactRow()]);
    const store = createPostgresReportRetentionStore(executor);

    await expect(
      store.selectExpiredReportArtifacts({
        now: "2026-09-20T00:00:00.000Z",
        limit: 2
      })
    ).resolves.toEqual([reportArtifact()]);
    expect(executor.queries[0]).toEqual(
      selectExpiredReportArtifactsSql({
        now: "2026-09-20T00:00:00.000Z",
        limit: 2
      })
    );
  });

  it("rejects invalid selection limits before querying", async () => {
    const executor = new FakeExecutor([]);
    const store = createPostgresReportRetentionStore(executor);

    await expect(
      store.selectExpiredReportArtifacts({
        now: "2026-09-20T00:00:00.000Z",
        limit: 0
      })
    ).rejects.toThrow(
      "Expired report artifact selection limit must be positive."
    );
    expect(executor.queries).toEqual([]);
  });

  it("marks report artifacts deleting and deleted", async () => {
    const executor = new FakeExecutor([
      {
        ...reportArtifactRow(),
        deletion_state: "deleting"
      },
      {
        ...reportArtifactRow(),
        deletion_state: "deleted",
        artifact_uri: null
      },
      {
        ...reportArtifactRow(),
        deletion_state: "active"
      }
    ]);
    const store = createPostgresReportRetentionStore(executor);

    await expect(
      store.markReportArtifactDeleting({
        organizationId: "org-1",
        id: "report-1"
      })
    ).resolves.toEqual({
      ...reportArtifact(),
      deletionState: "deleting"
    });
    await expect(
      store.markReportArtifactDeleted({
        organizationId: "org-1",
        id: "report-1"
      })
    ).resolves.toEqual({
      ...reportArtifact(),
      artifactUri: undefined,
      deletionState: "deleted"
    });
    await expect(
      store.markReportArtifactDeletionFailed({
        organizationId: "org-1",
        id: "report-1"
      })
    ).resolves.toEqual(reportArtifact());
  });

  it("returns undefined when a state transition does not update a row", async () => {
    const store = createPostgresReportRetentionStore(
      new FakeExecutor([undefined])
    );

    await expect(
      store.markReportArtifactDeleting({
        organizationId: "org-1",
        id: "report-1"
      })
    ).resolves.toBeUndefined();
  });

  it("fails deterministically on malformed rows", async () => {
    const store = createPostgresReportRetentionStore(
      new FakeExecutor([
        {
          ...reportArtifactRow(),
          report_kind: "raw" as "html"
        }
      ])
    );

    await expect(
      store.selectExpiredReportArtifacts({
        now: "2026-09-20T00:00:00.000Z",
        limit: 1
      })
    ).rejects.toThrow("Expected report_kind to be a report artifact kind.");
  });
});

function reportArtifact(): ReportArtifact {
  return {
    id: "report-1",
    organizationId: "org-1",
    projectId: "project-1",
    environmentId: "env-1",
    reportKind: "html",
    artifactUri: "s3://searchlint-reports/org-1/report-1.html",
    pinned: false,
    generatedAt,
    retentionUntil,
    deletionState: "active",
    createdAt
  };
}

function reportArtifactRow(): Record<string, unknown> {
  return {
    id: "report-1",
    organization_id: "org-1",
    schema_version: "cloud.report_artifacts.v1",
    created_at: createdAt,
    retention_until: retentionUntil,
    deletion_state: "active",
    project_id: "project-1",
    environment_id: "env-1",
    report_kind: "html",
    artifact_uri: "s3://searchlint-reports/org-1/report-1.html",
    pinned: false,
    generated_at: generatedAt
  };
}

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
