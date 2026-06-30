import { describe, expect, it } from "vitest";

import {
  createMonitoredPostgresQueryExecutor,
  createPgCloudTransactionManager,
  createPgQueryExecutor
} from "../src/index.js";
import type { QueryResult, QueryResultRow } from "pg";
import type {
  PgPool,
  PgTransactionClient,
  PostgresQuery
} from "../src/index.js";
import type { PostgresQueryObservation } from "../src/index.js";

const createdAt = "2026-06-21T00:00:00.000Z";

describe("createPgQueryExecutor", () => {
  it("forwards repository query text and values to the pg client", async () => {
    const client = new FakePgClient([
      {
        rows: [
          {
            id: "org-1"
          }
        ]
      }
    ]);
    const executor = createPgQueryExecutor(client);
    const query: PostgresQuery = {
      text: 'SELECT * FROM "organizations" WHERE "id" = $1;',
      values: ["org-1"]
    };

    await expect(executor.query(query)).resolves.toEqual({
      rows: [
        {
          id: "org-1"
        }
      ]
    });
    expect(client.calls).toEqual([
      {
        text: query.text,
        values: query.values
      }
    ]);
  });
});

describe("createMonitoredPostgresQueryExecutor", () => {
  it("records sanitized query duration, row count, fingerprint, and slow status", async () => {
    const observations: PostgresQueryObservation[] = [];
    const client = new FakePgClient([
      {
        rows: [{ id: "org-1" }, { id: "org-2" }]
      }
    ]);
    const executor = createMonitoredPostgresQueryExecutor(
      createPgQueryExecutor(client),
      {
        slowQueryThresholdMs: 50,
        now: steppedClock([100, 175]),
        observe(observation) {
          observations.push(observation);
        }
      }
    );
    const query: PostgresQuery = {
      text: 'SELECT * FROM "organizations" WHERE "id" = $1;',
      values: ["secret-org-id"]
    };

    await expect(executor.query(query)).resolves.toEqual({
      rows: [{ id: "org-1" }, { id: "org-2" }]
    });

    expect(observations).toEqual([
      expect.objectContaining({
        statementType: "SELECT",
        durationMs: 75,
        rowCount: 2,
        slow: true,
        status: "ok"
      })
    ]);
    expect(observations[0]?.fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(observations)).not.toContain("secret-org-id");
  });

  it("records failed queries and still propagates the database error", async () => {
    const observations: PostgresQueryObservation[] = [];
    const client = new FakePgClient([], {
      failOn: 'SELECT * FROM "organizations"'
    });
    const executor = createMonitoredPostgresQueryExecutor(
      createPgQueryExecutor(client),
      {
        slowQueryThresholdMs: 100,
        now: steppedClock([0, 25]),
        observe(observation) {
          observations.push(observation);
        }
      }
    );

    await expect(
      executor.query({
        text: 'SELECT * FROM "organizations" WHERE "id" = $1;',
        values: ["org-1"]
      })
    ).rejects.toThrow("database query failed");

    expect(observations).toEqual([
      expect.objectContaining({
        statementType: "SELECT",
        durationMs: 25,
        rowCount: 0,
        slow: false,
        status: "error",
        errorName: "Error"
      })
    ]);
  });

  it("does not fail the database operation when the monitoring sink fails", async () => {
    const monitorErrors: string[] = [];
    const executor = createMonitoredPostgresQueryExecutor(
      createPgQueryExecutor(new FakePgClient([{ rows: [{ id: "org-1" }] }])),
      {
        slowQueryThresholdMs: 100,
        now: steppedClock([0, 10]),
        observe() {
          throw new Error("monitor unavailable");
        },
        observeError(error) {
          monitorErrors.push(
            error instanceof Error ? error.message : "unknown"
          );
        }
      }
    );

    await expect(
      executor.query({
        text: 'SELECT * FROM "organizations" WHERE "id" = $1;',
        values: ["org-1"]
      })
    ).resolves.toEqual({
      rows: [{ id: "org-1" }]
    });
    expect(monitorErrors).toEqual(["monitor unavailable"]);
  });
});

describe("createPgCloudTransactionManager", () => {
  it("commits successful operations and releases the acquired client", async () => {
    const pool = new FakePgPool();
    const manager = createPgCloudTransactionManager({ pool });

    await expect(
      manager.transaction(async (dependencies) => {
        await dependencies.store.createOrganization({
          id: "org-1",
          name: "Acme",
          createdAt
        });
        await dependencies.auditLog.append({
          id: "audit-1",
          organizationId: "org-1",
          actorPrincipalId: "principal-1",
          action: "organization.created",
          targetType: "organization",
          targetId: "org-1",
          occurredAt: createdAt
        });
        await dependencies.metrics.record({
          id: "metric-1",
          organizationId: "org-1",
          name: "organization.created",
          value: 1,
          occurredAt: createdAt,
          dimensions: {
            source: "test"
          }
        });
        await dependencies.usageMeter?.record({
          id: "usage-1",
          organizationId: "org-1",
          counterName: "crawl.urls",
          idempotencyKey: "crawl-1",
          amount: 500,
          periodStart: "2026-06-01T00:00:00.000Z",
          periodEnd: "2026-07-01T00:00:00.000Z",
          occurredAt: createdAt,
          source: "crawl.requested",
          subjectType: "crawlRequest",
          subjectId: "crawl-1"
        });
        return "ok";
      })
    ).resolves.toBe("ok");

    expect(pool.client.calls.map((call) => call.text)).toEqual([
      "BEGIN",
      'INSERT INTO "organizations" ("id", "schema_version", "name", "created_at", "retention_until", "deletion_state") VALUES ($1, $2, $3, $4, $5, $6) RETURNING *;',
      'INSERT INTO "audit_events" ("id", "organization_id", "schema_version", "created_at", "retention_until", "deletion_state", "actor_principal_id", "action", "target_type", "target_id", "occurred_at") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *;',
      'INSERT INTO "metric_events" ("id", "organization_id", "schema_version", "created_at", "retention_until", "deletion_state", "name", "value", "dimensions", "occurred_at") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *;',
      'WITH inserted_event AS (INSERT INTO "billable_usage_events" ("id", "organization_id", "schema_version", "created_at", "retention_until", "deletion_state", "counter_name", "idempotency_key", "amount", "period_start", "period_end", "occurred_at", "source", "subject_type", "subject_id") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $4, $12, $13, $14) ON CONFLICT ("organization_id", "idempotency_key") DO NOTHING RETURNING "organization_id", "counter_name", "amount", "period_start", "period_end", "occurred_at") INSERT INTO "usage_counters" ("id", "organization_id", "schema_version", "created_at", "retention_until", "deletion_state", "counter_name", "period_start", "period_end", "used") SELECT $15, "organization_id", $16, "occurred_at", $5, $6, "counter_name", "period_start", "period_end", "amount" FROM inserted_event ON CONFLICT ("organization_id", "counter_name", "period_start") DO UPDATE SET "used" = "usage_counters"."used" + EXCLUDED."used", "period_end" = EXCLUDED."period_end", "created_at" = LEAST("usage_counters"."created_at", EXCLUDED."created_at") RETURNING *;',
      "COMMIT"
    ]);
    expect(pool.client.released).toBe(true);
  });

  it("rolls back failed operations, releases, and propagates the original error", async () => {
    const pool = new FakePgPool();
    const manager = createPgCloudTransactionManager({ pool });
    const failure = new Error("write failed");

    await expect(
      manager.transaction(async (dependencies) => {
        await dependencies.store.createOrganization({
          id: "org-1",
          name: "Acme",
          createdAt
        });
        throw failure;
      })
    ).rejects.toBe(failure);

    expect(pool.client.calls.map((call) => call.text)).toEqual([
      "BEGIN",
      'INSERT INTO "organizations" ("id", "schema_version", "name", "created_at", "retention_until", "deletion_state") VALUES ($1, $2, $3, $4, $5, $6) RETURNING *;',
      "ROLLBACK"
    ]);
    expect(pool.client.released).toBe(true);
  });

  it("wires the optional outbox store to the transaction client", async () => {
    const pool = new FakePgPool();
    const manager = createPgCloudTransactionManager({ pool, outbox: true });

    await manager.transaction(async (dependencies) => {
      await dependencies.outbox?.append({
        id: "outbox-1",
        organizationId: "org-1",
        topic: "crawl.requested",
        payload: {
          crawlRequestId: "crawl-1",
          organizationId: "org-1",
          projectId: "project-1",
          environmentId: "env-1",
          maxUrls: 500
        },
        status: "pending",
        attempts: 0,
        createdAt,
        availableAt: createdAt
      });
    });

    expect(pool.client.calls.map((call) => call.text)).toEqual([
      "BEGIN",
      'INSERT INTO "outbox_events" ("id", "organization_id", "schema_version", "created_at", "retention_until", "deletion_state", "topic", "payload", "status", "attempts", "available_at", "locked_at", "published_at", "last_error") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *;',
      "COMMIT"
    ]);
  });

  it("omits the outbox store unless configured", async () => {
    const pool = new FakePgPool();
    const manager = createPgCloudTransactionManager({ pool });

    await manager.transaction(async (dependencies) => {
      expect(dependencies.outbox).toBeUndefined();
    });

    expect(pool.client.calls.map((call) => call.text)).toEqual([
      "BEGIN",
      "COMMIT"
    ]);
  });

  it("wires query monitoring through transaction-scoped stores", async () => {
    const observations: PostgresQueryObservation[] = [];
    const pool = new FakePgPool();
    const manager = createPgCloudTransactionManager({
      pool,
      queryMonitor: {
        slowQueryThresholdMs: 1,
        now: steppedClock([0, 2, 4, 5]),
        observe(observation) {
          observations.push(observation);
        }
      }
    });

    await manager.transaction(async (dependencies) => {
      await dependencies.store.createOrganization({
        id: "org-1",
        name: "Acme",
        createdAt
      });
      await dependencies.metrics.record({
        id: "metric-1",
        organizationId: "org-1",
        name: "organization.created",
        value: 1,
        occurredAt: createdAt,
        dimensions: {
          source: "test"
        }
      });
    });

    expect(observations).toEqual([
      expect.objectContaining({
        statementType: "INSERT",
        durationMs: 2,
        slow: true,
        status: "ok"
      }),
      expect.objectContaining({
        statementType: "INSERT",
        durationMs: 1,
        slow: true,
        status: "ok"
      })
    ]);
    expect(pool.client.calls.map((call) => call.text)).toEqual([
      "BEGIN",
      'INSERT INTO "organizations" ("id", "schema_version", "name", "created_at", "retention_until", "deletion_state") VALUES ($1, $2, $3, $4, $5, $6) RETURNING *;',
      'INSERT INTO "metric_events" ("id", "organization_id", "schema_version", "created_at", "retention_until", "deletion_state", "name", "value", "dimensions", "occurred_at") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *;',
      "COMMIT"
    ]);
  });
});

type PgCall = {
  text: string;
  values?: readonly unknown[];
};

type FakeResult = {
  rows: Record<string, unknown>[];
};

type FakePgClientOptions = {
  failOn?: string;
};

class FakePgClient implements PgTransactionClient {
  readonly calls: PgCall[] = [];
  released = false;
  private readonly results: FakeResult[];
  private readonly failOn: string | undefined;

  constructor(
    results: readonly FakeResult[] = [],
    options: FakePgClientOptions = {}
  ) {
    this.results = [...results];
    this.failOn = options.failOn;
  }

  async query<Row extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: readonly unknown[]
  ): Promise<QueryResult<Row>> {
    this.calls.push(values === undefined ? { text } : { text, values });
    if (this.failOn && text.includes(this.failOn)) {
      throw new Error("database query failed");
    }
    return queryResult(this.resultFor(text).rows as Row[]);
  }

  release(): void {
    this.released = true;
  }

  private resultFor(text: string): FakeResult {
    if (text === "BEGIN" || text === "COMMIT" || text === "ROLLBACK") {
      return {
        rows: []
      };
    }
    const explicit = this.results.shift();
    if (explicit) {
      return explicit;
    }
    return {
      rows: [rowForQuery(text)]
    };
  }
}

class FakePgPool implements PgPool {
  readonly client = new FakePgClient();
  readonly calls: PgCall[] = [];

  async query<Row extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: readonly unknown[]
  ): Promise<QueryResult<Row>> {
    this.calls.push(values === undefined ? { text } : { text, values });
    return queryResult<Row>([]);
  }

  async connect(): Promise<PgTransactionClient> {
    return this.client;
  }
}

function rowForQuery(text: string): Record<string, unknown> {
  if (text.includes('"organizations"')) {
    return {
      id: "org-1",
      schema_version: "cloud.organizations.v1",
      name: "Acme",
      created_at: createdAt,
      retention_until: null,
      deletion_state: "active"
    };
  }
  if (text.includes('"outbox_events"')) {
    return {
      id: "outbox-1",
      organization_id: "org-1",
      schema_version: "cloud.outbox_events.v1",
      created_at: createdAt,
      retention_until: null,
      deletion_state: "active",
      topic: "crawl.requested",
      payload: {
        crawlRequestId: "crawl-1",
        organizationId: "org-1",
        projectId: "project-1",
        environmentId: "env-1",
        maxUrls: 500
      },
      status: "pending",
      attempts: 0,
      available_at: createdAt,
      locked_at: null,
      published_at: null,
      last_error: null
    };
  }
  return {
    id: "row-1"
  };
}

function queryResult<Row extends QueryResultRow>(
  rows: Row[]
): QueryResult<Row> {
  return {
    command: "SELECT",
    rowCount: rows.length,
    oid: 0,
    fields: [],
    rows
  };
}

function steppedClock(values: readonly number[]): () => number {
  const steps = [...values];
  return () => {
    const value = steps.shift();
    if (value === undefined) {
      throw new Error("test clock exhausted");
    }
    return value;
  };
}
