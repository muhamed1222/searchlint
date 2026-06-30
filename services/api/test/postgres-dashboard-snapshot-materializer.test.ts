import { describe, expect, it } from "vitest";

import {
  createPostgresDashboardSnapshotMaterializer,
  upsertDashboardSnapshotSql
} from "../src/index.js";
import type {
  DashboardSnapshotMaterializationInput,
  PostgresQuery,
  PostgresQueryExecutor,
  PostgresQueryResult
} from "../src/index.js";

describe("createPostgresDashboardSnapshotMaterializer", () => {
  it("materializes and upserts the current dashboard snapshot", async () => {
    const executor = new FakeExecutor([{}]);
    const materializer = createPostgresDashboardSnapshotMaterializer(executor);

    await expect(
      materializer.materializeDashboardSnapshot(input())
    ).resolves.toMatchObject({
      organization: {
        id: "org-1"
      },
      project: {
        id: "project-1"
      },
      environment: {
        id: "env-1"
      }
    });
    expect(executor.queries).toEqual([
      upsertDashboardSnapshotSql({
        id: "snapshot-1",
        organizationId: "org-1",
        projectId: "project-1",
        environmentId: "env-1",
        payload: {
          organization: {
            id: "org-1",
            name: "Acme"
          },
          project: {
            id: "project-1",
            name: "Marketing",
            siteUrl: "https://example.test"
          },
          environment: {
            id: "env-1",
            name: "Production",
            baseUrl: "https://example.test"
          },
          diagnostics: [],
          crawlRuns: [],
          trends: [],
          externalObservations: [],
          reports: [],
          quotas: [],
          teamMembers: []
        },
        materializedAt: "2026-06-21T00:00:00.000Z",
        retentionUntil: "2026-09-21T00:00:00.000Z"
      })
    ]);
  });

  it("fails when PostgreSQL does not return the upserted row", async () => {
    const materializer = createPostgresDashboardSnapshotMaterializer(
      new FakeExecutor([undefined])
    );

    await expect(
      materializer.materializeDashboardSnapshot(input())
    ).rejects.toThrow(
      "Dashboard snapshot materialization did not return a row."
    );
  });
});

function input(): DashboardSnapshotMaterializationInput {
  return {
    id: "snapshot-1",
    materializedAt: "2026-06-21T00:00:00.000Z",
    retentionUntil: "2026-09-21T00:00:00.000Z",
    organization: {
      id: "org-1",
      name: "Acme"
    },
    project: {
      id: "project-1",
      name: "Marketing",
      siteUrl: "https://example.test"
    },
    environment: {
      id: "env-1",
      name: "Production",
      baseUrl: "https://example.test"
    }
  };
}

class FakeExecutor implements PostgresQueryExecutor {
  readonly queries: PostgresQuery[] = [];

  constructor(private readonly rows: readonly (unknown | undefined)[]) {}

  async query<Row extends Record<string, unknown>>(
    query: PostgresQuery
  ): Promise<PostgresQueryResult<Row>> {
    this.queries.push(query);
    const row = this.rows[this.queries.length - 1];
    return {
      rows: row === undefined ? [] : [row as Row]
    };
  }
}
