import { describe, expect, it } from "vitest";

import { createPostgresRelationalStore } from "../src/index.js";
import type {
  PostgresQuery,
  PostgresQueryExecutor,
  PostgresQueryResult
} from "../src/index.js";

const createdAt = "2026-06-21T00:00:00.000Z";

describe("createPostgresRelationalStore", () => {
  it("creates organizations through the repository SQL contract", async () => {
    const executor = new FakeExecutor([
      {
        id: "org-1",
        schema_version: "cloud.organizations.v1",
        name: "Acme",
        created_at: createdAt,
        retention_until: null,
        deletion_state: "active"
      }
    ]);
    const store = createPostgresRelationalStore(executor);

    await expect(
      store.createOrganization({
        id: "org-1",
        name: "Acme",
        createdAt
      })
    ).resolves.toEqual({
      id: "org-1",
      name: "Acme",
      createdAt
    });
    expect(executor.queries).toEqual([
      {
        text: 'INSERT INTO "organizations" ("id", "schema_version", "name", "created_at", "retention_until", "deletion_state") VALUES ($1, $2, $3, $4, $5, $6) RETURNING *;',
        values: [
          "org-1",
          "cloud.organizations.v1",
          "Acme",
          createdAt,
          null,
          "active"
        ]
      }
    ]);
  });

  it("normalizes pg Date timestamp rows to API strings", async () => {
    const executor = new FakeExecutor([
      {
        id: "crawl-1",
        organization_id: "org-1",
        schema_version: "cloud.crawl_requests.v1",
        created_at: new Date(createdAt),
        retention_until: null,
        deletion_state: "active",
        project_id: "project-1",
        environment_id: "env-1",
        requested_by: "principal-1",
        max_urls: 500,
        status: "succeeded",
        started_at: new Date("2026-06-21T00:00:01.000Z"),
        completed_at: new Date("2026-06-21T00:00:10.000Z"),
        failed_at: null,
        last_error: null,
        artifact_uri: "s3://searchlint/crawls/crawl-1.json"
      }
    ]);
    const store = createPostgresRelationalStore(executor);

    await expect(store.getCrawlRequest("org-1", "crawl-1")).resolves.toEqual({
      id: "crawl-1",
      organizationId: "org-1",
      projectId: "project-1",
      environmentId: "env-1",
      requestedBy: "principal-1",
      maxUrls: 500,
      status: "succeeded",
      createdAt,
      startedAt: "2026-06-21T00:00:01.000Z",
      completedAt: "2026-06-21T00:00:10.000Z",
      artifactUri: "s3://searchlint/crawls/crawl-1.json"
    });
  });

  it("creates and reads memberships with tenant-scoped queries", async () => {
    const executor = new FakeExecutor([
      membershipRow("membership-1", "principal-1", "owner"),
      membershipRow("membership-1", "principal-1", "owner")
    ]);
    const store = createPostgresRelationalStore(executor);

    await expect(
      store.createMembership({
        id: "membership-1",
        organizationId: "org-1",
        principalId: "principal-1",
        role: "owner",
        createdAt
      })
    ).resolves.toEqual({
      id: "membership-1",
      organizationId: "org-1",
      principalId: "principal-1",
      role: "owner",
      createdAt
    });
    await expect(
      store.getMembership("org-1", "principal-1")
    ).resolves.toMatchObject({
      id: "membership-1",
      role: "owner"
    });
    expect(executor.queries[1]).toEqual({
      text: 'SELECT * FROM "organization_memberships" WHERE "organization_id" = $1 AND "principal_id" = $2 AND "deletion_state" = $3 LIMIT 1;',
      values: ["org-1", "principal-1", "active"]
    });
  });

  it("updates and removes memberships with tenant-scoped active-only writes", async () => {
    const executor = new FakeExecutor([
      membershipRow("membership-1", "principal-1", "admin"),
      membershipRow("membership-1", "principal-1", "admin")
    ]);
    const store = createPostgresRelationalStore(executor);

    await expect(
      store.updateMembershipRole({
        organizationId: "org-1",
        principalId: "principal-1",
        role: "admin"
      })
    ).resolves.toMatchObject({
      id: "membership-1",
      role: "admin"
    });
    await expect(
      store.removeMembership({
        organizationId: "org-1",
        principalId: "principal-1"
      })
    ).resolves.toMatchObject({
      id: "membership-1",
      principalId: "principal-1"
    });
    expect(executor.queries).toEqual([
      {
        text: 'UPDATE "organization_memberships" SET "role" = $1 WHERE "organization_id" = $2 AND "principal_id" = $3 AND "deletion_state" = $4 RETURNING *;',
        values: ["admin", "org-1", "principal-1", "active"]
      },
      {
        text: 'UPDATE "organization_memberships" SET "deletion_state" = $1 WHERE "organization_id" = $2 AND "principal_id" = $3 AND "deletion_state" = $4 RETURNING *;',
        values: ["deleted", "org-1", "principal-1", "active"]
      }
    ]);
  });

  it("creates and reads project plus environment records", async () => {
    const executor = new FakeExecutor([
      projectRow(),
      projectRow(),
      environmentRow(),
      environmentRow()
    ]);
    const store = createPostgresRelationalStore(executor);

    await expect(
      store.createProject({
        id: "project-1",
        organizationId: "org-1",
        name: "Marketing",
        siteUrl: "https://example.com",
        createdAt
      })
    ).resolves.toMatchObject({
      id: "project-1",
      siteUrl: "https://example.com"
    });
    await expect(store.getProject("org-1", "project-1")).resolves.toMatchObject(
      {
        id: "project-1",
        organizationId: "org-1"
      }
    );
    await expect(
      store.createEnvironment({
        id: "env-1",
        organizationId: "org-1",
        projectId: "project-1",
        name: "Production",
        baseUrl: "https://example.com",
        createdAt
      })
    ).resolves.toMatchObject({
      id: "env-1",
      projectId: "project-1"
    });
    await expect(store.getEnvironment("org-1", "env-1")).resolves.toMatchObject(
      {
        id: "env-1",
        organizationId: "org-1"
      }
    );

    expect(executor.queries[1]?.values).toEqual([
      "org-1",
      "project-1",
      "active"
    ]);
    expect(executor.queries[3]?.values).toEqual(["org-1", "env-1", "active"]);
  });

  it("creates crawl requests with mapped lifecycle status", async () => {
    const executor = new FakeExecutor([
      {
        id: "crawl-1",
        organization_id: "org-1",
        schema_version: "cloud.crawl_requests.v1",
        created_at: createdAt,
        retention_until: null,
        deletion_state: "active",
        project_id: "project-1",
        environment_id: "env-1",
        requested_by: "principal-1",
        max_urls: 500,
        status: "queued",
        started_at: "2026-06-21T00:00:01.000Z",
        completed_at: null,
        failed_at: null,
        last_error: null,
        artifact_uri: "s3://searchlint/crawls/crawl-1.json"
      }
    ]);
    const store = createPostgresRelationalStore(executor);

    await expect(
      store.createCrawlRequest({
        id: "crawl-1",
        organizationId: "org-1",
        projectId: "project-1",
        environmentId: "env-1",
        requestedBy: "principal-1",
        maxUrls: 500,
        status: "queued",
        createdAt
      })
    ).resolves.toEqual({
      id: "crawl-1",
      organizationId: "org-1",
      projectId: "project-1",
      environmentId: "env-1",
      requestedBy: "principal-1",
      maxUrls: 500,
      status: "queued",
      createdAt,
      startedAt: "2026-06-21T00:00:01.000Z",
      artifactUri: "s3://searchlint/crawls/crawl-1.json"
    });
    await expect(store.getCrawlRequest("org-1", "crawl-1")).resolves.toBe(
      undefined
    );
  });

  it("reads crawl requests with mapped lifecycle status", async () => {
    const executor = new FakeExecutor([
      {
        id: "crawl-1",
        organization_id: "org-1",
        schema_version: "cloud.crawl_requests.v1",
        created_at: createdAt,
        retention_until: null,
        deletion_state: "active",
        project_id: "project-1",
        environment_id: "env-1",
        requested_by: "principal-1",
        max_urls: 500,
        status: "succeeded",
        started_at: "2026-06-21T00:00:01.000Z",
        completed_at: "2026-06-21T00:00:10.000Z",
        failed_at: null,
        last_error: null,
        artifact_uri: "s3://searchlint/crawls/crawl-1.json"
      }
    ]);
    const store = createPostgresRelationalStore(executor);

    await expect(store.getCrawlRequest("org-1", "crawl-1")).resolves.toEqual({
      id: "crawl-1",
      organizationId: "org-1",
      projectId: "project-1",
      environmentId: "env-1",
      requestedBy: "principal-1",
      maxUrls: 500,
      status: "succeeded",
      createdAt,
      startedAt: "2026-06-21T00:00:01.000Z",
      completedAt: "2026-06-21T00:00:10.000Z",
      artifactUri: "s3://searchlint/crawls/crawl-1.json"
    });
    expect(executor.queries[0]).toMatchObject({
      values: ["org-1", "crawl-1", "active"]
    });
  });

  it("returns undefined for missing read rows", async () => {
    const executor = new FakeExecutor([undefined]);
    const store = createPostgresRelationalStore(executor);

    await expect(store.getProject("org-1", "project-1")).resolves.toBe(
      undefined
    );
  });

  it("fails deterministically when inserts return no row", async () => {
    const executor = new FakeExecutor([undefined]);
    const store = createPostgresRelationalStore(executor);

    await expect(
      store.createOrganization({
        id: "org-1",
        name: "Acme",
        createdAt
      })
    ).rejects.toThrow("createOrganization did not return a row.");
  });

  it("fails on malformed rows instead of returning invalid domain records", async () => {
    const executor = new FakeExecutor([
      {
        ...projectRow(),
        site_url: 42
      }
    ]);
    const store = createPostgresRelationalStore(executor);

    await expect(store.getProject("org-1", "project-1")).rejects.toThrow(
      "Expected site_url to be a string."
    );
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

function membershipRow(
  id: string,
  principalId: string,
  role: string
): Record<string, unknown> {
  return {
    id,
    organization_id: "org-1",
    schema_version: "cloud.organization_memberships.v1",
    created_at: createdAt,
    retention_until: null,
    deletion_state: "active",
    principal_id: principalId,
    role
  };
}

function projectRow(): Record<string, unknown> {
  return {
    id: "project-1",
    organization_id: "org-1",
    schema_version: "cloud.projects.v1",
    created_at: createdAt,
    retention_until: null,
    deletion_state: "active",
    name: "Marketing",
    site_url: "https://example.com"
  };
}

function environmentRow(): Record<string, unknown> {
  return {
    id: "env-1",
    organization_id: "org-1",
    schema_version: "cloud.environments.v1",
    created_at: createdAt,
    retention_until: null,
    deletion_state: "active",
    project_id: "project-1",
    name: "Production",
    base_url: "https://example.com"
  };
}
