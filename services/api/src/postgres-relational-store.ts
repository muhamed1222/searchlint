import type { RelationalStore } from "./ports.js";
import type { PostgresQuery } from "./postgres-repository-sql.js";
import {
  insertCrawlRequestSql,
  insertEnvironmentSql,
  insertMembershipSql,
  insertOrganizationSql,
  insertProjectSql,
  removeMembershipSql,
  selectCrawlRequestSql,
  selectEnvironmentSql,
  selectMembershipSql,
  selectProjectSql,
  updateMembershipRoleSql
} from "./postgres-repository-sql.js";
import type {
  CrawlRequest,
  Environment,
  Organization,
  OrganizationMembership,
  Project
} from "./types.js";

export type PostgresQueryResult<Row extends Record<string, unknown>> = {
  rows: readonly Row[];
};

export type PostgresQueryExecutor = {
  query<Row extends Record<string, unknown>>(
    query: PostgresQuery
  ): Promise<PostgresQueryResult<Row>>;
};

export function createPostgresRelationalStore(
  executor: PostgresQueryExecutor
): RelationalStore {
  return {
    async createOrganization(input) {
      const row = await requiredRow(
        executor.query(insertOrganizationSql(input)),
        "createOrganization"
      );
      return organizationFromRow(row);
    },

    async createMembership(input) {
      const row = await requiredRow(
        executor.query(insertMembershipSql(input)),
        "createMembership"
      );
      return membershipFromRow(row);
    },

    async getMembership(organizationId, principalId) {
      const row = await optionalRow(
        executor.query(selectMembershipSql(organizationId, principalId))
      );
      return row ? membershipFromRow(row) : undefined;
    },

    async updateMembershipRole(input) {
      const row = await optionalRow(
        executor.query(updateMembershipRoleSql(input))
      );
      return row ? membershipFromRow(row) : undefined;
    },

    async removeMembership(input) {
      const row = await optionalRow(executor.query(removeMembershipSql(input)));
      return row ? membershipFromRow(row) : undefined;
    },

    async createProject(input) {
      const row = await requiredRow(
        executor.query(insertProjectSql(input)),
        "createProject"
      );
      return projectFromRow(row);
    },

    async getProject(organizationId, projectId) {
      const row = await optionalRow(
        executor.query(selectProjectSql(organizationId, projectId))
      );
      return row ? projectFromRow(row) : undefined;
    },

    async createEnvironment(input) {
      const row = await requiredRow(
        executor.query(insertEnvironmentSql(input)),
        "createEnvironment"
      );
      return environmentFromRow(row);
    },

    async getEnvironment(organizationId, environmentId) {
      const row = await optionalRow(
        executor.query(selectEnvironmentSql(organizationId, environmentId))
      );
      return row ? environmentFromRow(row) : undefined;
    },

    async createCrawlRequest(input) {
      const row = await requiredRow(
        executor.query(insertCrawlRequestSql(input)),
        "createCrawlRequest"
      );
      return crawlRequestFromRow(row);
    },

    async getCrawlRequest(organizationId, crawlRequestId) {
      const row = await optionalRow(
        executor.query(selectCrawlRequestSql(organizationId, crawlRequestId))
      );
      return row ? crawlRequestFromRow(row) : undefined;
    }
  };
}

async function requiredRow<Row extends Record<string, unknown>>(
  result: Promise<PostgresQueryResult<Row>>,
  operation: string
): Promise<Row> {
  const row = (await result).rows[0];
  if (!row) {
    throw new Error(`${operation} did not return a row.`);
  }
  return row;
}

async function optionalRow<Row extends Record<string, unknown>>(
  result: Promise<PostgresQueryResult<Row>>
): Promise<Row | undefined> {
  return (await result).rows[0];
}

function organizationFromRow(row: Record<string, unknown>): Organization {
  return {
    id: text(row, "id"),
    name: text(row, "name"),
    createdAt: timestampText(row, "created_at")
  };
}

function membershipFromRow(
  row: Record<string, unknown>
): OrganizationMembership {
  return {
    id: text(row, "id"),
    organizationId: text(row, "organization_id"),
    principalId: text(row, "principal_id"),
    role: organizationRole(row, "role"),
    createdAt: timestampText(row, "created_at")
  };
}

function projectFromRow(row: Record<string, unknown>): Project {
  return {
    id: text(row, "id"),
    organizationId: text(row, "organization_id"),
    name: text(row, "name"),
    siteUrl: text(row, "site_url"),
    createdAt: timestampText(row, "created_at")
  };
}

function environmentFromRow(row: Record<string, unknown>): Environment {
  return {
    id: text(row, "id"),
    organizationId: text(row, "organization_id"),
    projectId: text(row, "project_id"),
    name: text(row, "name"),
    baseUrl: text(row, "base_url"),
    createdAt: timestampText(row, "created_at")
  };
}

function crawlRequestFromRow(row: Record<string, unknown>): CrawlRequest {
  const request: CrawlRequest = {
    id: text(row, "id"),
    organizationId: text(row, "organization_id"),
    projectId: text(row, "project_id"),
    environmentId: text(row, "environment_id"),
    requestedBy: text(row, "requested_by"),
    maxUrls: integer(row, "max_urls"),
    status: crawlRequestStatus(row, "status"),
    createdAt: timestampText(row, "created_at")
  };
  const startedAt = optionalTimestampText(row, "started_at");
  const completedAt = optionalTimestampText(row, "completed_at");
  const failedAt = optionalTimestampText(row, "failed_at");
  const lastError = optionalText(row, "last_error");
  const artifactUri = optionalText(row, "artifact_uri");
  if (startedAt !== undefined) {
    request.startedAt = startedAt;
  }
  if (completedAt !== undefined) {
    request.completedAt = completedAt;
  }
  if (failedAt !== undefined) {
    request.failedAt = failedAt;
  }
  if (lastError !== undefined) {
    request.lastError = lastError;
  }
  if (artifactUri !== undefined) {
    request.artifactUri = artifactUri;
  }
  return request;
}

function text(row: Record<string, unknown>, field: string): string {
  const value = row[field];
  if (typeof value !== "string") {
    throw new Error(`Expected ${field} to be a string.`);
  }
  return value;
}

function optionalText(
  row: Record<string, unknown>,
  field: string
): string | undefined {
  const value = row[field];
  if (value === null || value === undefined) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new Error(`Expected ${field} to be a string when present.`);
  }
  return value;
}

function timestampText(row: Record<string, unknown>, field: string): string {
  const value = row[field];
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value !== "string") {
    throw new Error(`Expected ${field} to be a timestamp string or Date.`);
  }
  return value;
}

function optionalTimestampText(
  row: Record<string, unknown>,
  field: string
): string | undefined {
  const value = row[field];
  if (value === null || value === undefined) {
    return undefined;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value !== "string") {
    throw new Error(
      `Expected ${field} to be a timestamp string or Date when present.`
    );
  }
  return value;
}

function integer(row: Record<string, unknown>, field: string): number {
  const value = row[field];
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error(`Expected ${field} to be an integer.`);
  }
  return value;
}

function organizationRole(
  row: Record<string, unknown>,
  field: string
): OrganizationMembership["role"] {
  const value = text(row, field);
  if (
    value === "owner" ||
    value === "admin" ||
    value === "developer" ||
    value === "analyst" ||
    value === "client"
  ) {
    return value;
  }
  throw new Error(`Expected ${field} to be an organization role.`);
}

function crawlRequestStatus(
  row: Record<string, unknown>,
  field: string
): CrawlRequest["status"] {
  const value = text(row, field);
  if (
    value === "queued" ||
    value === "running" ||
    value === "succeeded" ||
    value === "failed" ||
    value === "cancelled"
  ) {
    return value;
  }
  throw new Error(`Expected ${field} to be a crawl request status.`);
}
