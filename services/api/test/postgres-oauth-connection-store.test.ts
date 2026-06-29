import { describe, expect, it } from "vitest";

import { createPostgresOAuthConnectionStore } from "../src/index.js";
import type {
  OAuthConnectionRecord,
  PostgresQuery,
  PostgresQueryExecutor,
  PostgresQueryResult
} from "../src/index.js";

describe("createPostgresOAuthConnectionStore", () => {
  it("upserts, selects, refresh-selects, and revokes OAuth connection metadata", async () => {
    const input = oauthConnection();
    const revoked = oauthConnection({
      status: "revoked"
    });
    const executor = new RecordingExecutor([
      row(input),
      row(input),
      row(input),
      row(revoked)
    ]);
    const store = createPostgresOAuthConnectionStore(executor);

    await expect(store.upsertOAuthConnection(input)).resolves.toEqual(input);
    await expect(
      store.getOAuthConnection({
        organizationId: "org-1",
        projectId: "project-1",
        environmentId: "env-1",
        provider: "google"
      })
    ).resolves.toEqual(input);
    await expect(
      store.selectOAuthConnectionsDueForRefresh({
        now: "2026-06-21T01:00:00.000Z",
        provider: "google",
        limit: 10
      })
    ).resolves.toEqual([input]);
    await expect(
      store.markOAuthConnectionRevoked({
        organizationId: "org-1",
        id: "oauth-connection-1"
      })
    ).resolves.toEqual(revoked);

    expect(executor.queries[0]?.text).toContain(
      'INSERT INTO "oauth_connections"'
    );
    expect(executor.queries[0]?.values).toContain("cloud.oauth_connections.v1");
    expect(executor.queries[0]?.values).toContain(
      "secret://org-1/google/refresh-token"
    );
    expect(executor.queries[0]?.values).not.toContain("raw-refresh-token");
    expect(executor.queries[1]?.text).toContain('FROM "oauth_connections"');
    expect(executor.queries[2]?.text).toContain('"expires_at" <= $4');
    expect(executor.queries[3]?.text).toContain(
      'UPDATE "oauth_connections" SET "status" = $1'
    );
  });

  it("returns undefined when active lookup or revocation finds no row", async () => {
    const executor = new RecordingExecutor([]);
    const store = createPostgresOAuthConnectionStore(executor);

    await expect(
      store.getOAuthConnection({
        organizationId: "org-1",
        projectId: "project-1",
        environmentId: "env-1",
        provider: "google"
      })
    ).resolves.toBeUndefined();
    await expect(
      store.markOAuthConnectionRevoked({
        organizationId: "org-1",
        id: "oauth-connection-1"
      })
    ).resolves.toBeUndefined();
  });

  it("rejects malformed provider, status, scope, and secret-ref rows", async () => {
    const cases: readonly [Record<string, unknown>, string][] = [
      [
        {
          ...row(oauthConnection()),
          provider: "mixed"
        },
        "Expected OAuth provider to be google or yandex."
      ],
      [
        {
          ...row(oauthConnection()),
          status: "pending"
        },
        "Expected OAuth connection status to be valid."
      ],
      [
        {
          ...row(oauthConnection()),
          scopes: []
        },
        "Expected OAuth scopes to be a non-empty string array."
      ],
      [
        {
          ...row(oauthConnection()),
          refresh_token_secret_ref: "raw-refresh-token"
        },
        "Expected refresh_token_secret_ref to be a vault secret reference."
      ]
    ];

    for (const [malformedRow, message] of cases) {
      const store = createPostgresOAuthConnectionStore(
        new RecordingExecutor([malformedRow])
      );
      await expect(
        store.selectOAuthConnectionsDueForRefresh({
          now: "2026-06-21T01:00:00.000Z",
          limit: 10
        })
      ).rejects.toThrow(message);
    }
  });

  it("rejects missing upsert rows", async () => {
    const executor = new RecordingExecutor([]);
    const store = createPostgresOAuthConnectionStore(executor);

    await expect(
      store.upsertOAuthConnection(oauthConnection())
    ).rejects.toThrow("upsertOAuthConnection did not return a row.");
  });
});

class RecordingExecutor implements PostgresQueryExecutor {
  readonly queries: PostgresQuery[] = [];
  private readonly rows: Record<string, unknown>[][];

  constructor(rows: Record<string, unknown>[]) {
    this.rows = rows.map((item) => [item]);
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

function oauthConnection(
  overrides: Partial<OAuthConnectionRecord> = {}
): OAuthConnectionRecord {
  return {
    id: "oauth-connection-1",
    organizationId: "org-1",
    projectId: "project-1",
    environmentId: "env-1",
    provider: "google",
    providerAccountId: "sc-domain:example.test",
    scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
    accessTokenSecretRef: "secret://org-1/google/access-token",
    refreshTokenSecretRef: "secret://org-1/google/refresh-token",
    expiresAt: "2026-06-21T01:00:00.000Z",
    lastRefreshAt: "2026-06-21T00:00:00.000Z",
    status: "active",
    deletionState: "active",
    createdAt: "2026-06-21T00:00:00.000Z",
    ...overrides
  };
}

function row(record: OAuthConnectionRecord): Record<string, unknown> {
  return {
    id: record.id,
    organization_id: record.organizationId,
    project_id: record.projectId,
    environment_id: record.environmentId,
    provider: record.provider,
    provider_account_id: record.providerAccountId,
    scopes: record.scopes,
    access_token_secret_ref: record.accessTokenSecretRef ?? null,
    refresh_token_secret_ref: record.refreshTokenSecretRef,
    expires_at: record.expiresAt ?? null,
    last_refresh_at: record.lastRefreshAt ?? null,
    last_error: record.lastError ?? null,
    status: record.status,
    retention_until: record.retentionUntil ?? null,
    deletion_state: record.deletionState,
    created_at: record.createdAt
  };
}
