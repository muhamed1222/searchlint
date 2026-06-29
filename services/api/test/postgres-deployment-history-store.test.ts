import { describe, expect, it } from "vitest";

import { createPostgresDeploymentHistoryStore } from "../src/index.js";
import type {
  DeploymentHistoryRecord,
  PostgresQuery,
  PostgresQueryExecutor,
  PostgresQueryResult
} from "../src/index.js";

const deployment: DeploymentHistoryRecord = {
  id: "deployment-row-1",
  organizationId: "org-1",
  projectId: "project-1",
  environmentId: "env-1",
  deploymentId: "deploy-2026-06-23",
  commitSha: "abc123def456",
  status: "released",
  deployedAt: "2026-06-23T12:00:00.000Z",
  actor: "release-bot",
  source: "github-actions",
  annotations: {
    releaseCandidate: "rc-1",
    note: "production deployment"
  },
  deletionState: "active",
  createdAt: "2026-06-23T12:00:00.000Z"
};

describe("createPostgresDeploymentHistoryStore", () => {
  it("upserts deployment history through the repository SQL contract", async () => {
    const executor = new FakeExecutor([rowFor(deployment)]);
    const store = createPostgresDeploymentHistoryStore(executor);

    await expect(store.upsertDeployment(deployment)).resolves.toEqual(
      deployment
    );
    expect(executor.queries[0]?.text).toContain(
      'INSERT INTO "deployment_history"'
    );
    expect(executor.queries[0]?.text).toContain(
      'ON CONFLICT ("organization_id", "project_id", "environment_id", "deployment_id") DO UPDATE'
    );
    expect(executor.queries[0]?.values).toEqual([
      "deployment-row-1",
      "org-1",
      "cloud.deployment_history.v1",
      "2026-06-23T12:00:00.000Z",
      null,
      "active",
      "project-1",
      "env-1",
      "deploy-2026-06-23",
      "abc123def456",
      "released",
      "2026-06-23T12:00:00.000Z",
      "release-bot",
      "github-actions",
      {
        releaseCandidate: "rc-1",
        note: "production deployment"
      }
    ]);
  });

  it("lists active deployment history by environment and deployment time", async () => {
    const executor = new FakeExecutor([rowFor(deployment)]);
    const store = createPostgresDeploymentHistoryStore(executor);

    await expect(
      store.listDeployments({
        organizationId: "org-1",
        projectId: "project-1",
        environmentId: "env-1",
        limit: 25
      })
    ).resolves.toEqual([deployment]);
    expect(executor.queries[0]?.text).toContain(
      'FROM "deployment_history" WHERE "organization_id" = $1'
    );
    expect(executor.queries[0]?.text).toContain(
      'ORDER BY "deployed_at" DESC, "deployment_id" ASC LIMIT $5'
    );
    expect(executor.queries[0]?.values).toEqual([
      "org-1",
      "project-1",
      "env-1",
      "active",
      25
    ]);
  });

  it("fails deterministically when upsert returns no row", async () => {
    const executor = new FakeExecutor([undefined]);
    const store = createPostgresDeploymentHistoryStore(executor);

    await expect(store.upsertDeployment(deployment)).rejects.toThrow(
      "upsertDeployment did not return a row."
    );
  });
});

function rowFor(record: DeploymentHistoryRecord): Record<string, unknown> {
  return {
    id: record.id,
    organization_id: record.organizationId,
    schema_version: "cloud.deployment_history.v1",
    created_at: record.createdAt,
    retention_until: record.retentionUntil ?? null,
    deletion_state: record.deletionState,
    project_id: record.projectId,
    environment_id: record.environmentId,
    deployment_id: record.deploymentId,
    commit_sha: record.commitSha,
    status: record.status,
    deployed_at: record.deployedAt,
    actor: record.actor ?? null,
    source: record.source,
    annotations: record.annotations
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
