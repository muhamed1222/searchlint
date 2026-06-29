import { describe, expect, it } from "vitest";

import {
  consumeRateLimitWindowSql,
  createPostgresDistributedRateLimitStore
} from "../src/index.js";
import type { PostgresQuery, PostgresQueryExecutor } from "../src/index.js";

describe("consumeRateLimitWindowSql", () => {
  it("creates one atomic PostgreSQL fixed-window consume query", () => {
    const query = consumeRateLimitWindowSql({
      key: "org:1:ip:127.0.0.1",
      limit: 10,
      windowMs: 60_000,
      now: 1_800_000_000_000
    });

    expect(query.text).toContain('INSERT INTO "rate_limit_windows"');
    expect(query.text).toContain('ON CONFLICT ("key") DO UPDATE SET');
    expect(query.text).toContain('"consumed_count" + 1');
    expect(query.text).toContain('RETURNING "consumed_count"');
    expect(query.text).toContain('"reset_at_ms"');
    expect(query.values).toEqual([
      "org:1:ip:127.0.0.1",
      "cloud.rate_limit_windows.v1",
      1_800_000_000_000,
      null,
      "active",
      60_000,
      10
    ]);
  });

  it("rejects invalid limits before creating SQL", () => {
    expect(() =>
      consumeRateLimitWindowSql({
        key: "org:1",
        limit: 0,
        windowMs: 1000,
        now: 100
      })
    ).toThrow("Rate-limit limit must be a positive integer.");
    expect(() =>
      consumeRateLimitWindowSql({
        key: "org:1",
        limit: 1,
        windowMs: 0,
        now: 100
      })
    ).toThrow("Rate-limit windowMs must be a positive integer.");
  });
});

describe("createPostgresDistributedRateLimitStore", () => {
  it("maps consumed rows below the limit to allowed decisions", async () => {
    const executor = new FakeExecutor([
      {
        consumed_count: 3,
        reset_at_ms: "1800000060000"
      }
    ]);
    const store = createPostgresDistributedRateLimitStore(executor);

    await expect(
      store.consume({
        key: "org:1",
        limit: 10,
        windowMs: 60_000,
        now: 1_800_000_000_000
      })
    ).resolves.toEqual({
      allowed: true,
      remaining: 7,
      resetAt: 1_800_000_060_000
    });
    expect(executor.queries).toHaveLength(1);
  });

  it("maps consumed rows over the limit to denied decisions", async () => {
    const store = createPostgresDistributedRateLimitStore(
      new FakeExecutor([
        {
          consumed_count: 11,
          reset_at_ms: 1_800_000_060_000
        }
      ])
    );

    await expect(
      store.consume({
        key: "org:1",
        limit: 10,
        windowMs: 60_000,
        now: 1_800_000_000_000
      })
    ).resolves.toEqual({
      allowed: false,
      remaining: 0,
      resetAt: 1_800_000_060_000,
      reason: "rate limit exceeded"
    });
  });

  it("fails loudly when PostgreSQL returns malformed rows", async () => {
    const store = createPostgresDistributedRateLimitStore(
      new FakeExecutor([
        {
          consumed_count: "not-a-number",
          reset_at_ms: 1_800_000_060_000
        }
      ])
    );

    await expect(
      store.consume({
        key: "org:1",
        limit: 10,
        windowMs: 60_000,
        now: 1_800_000_000_000
      })
    ).rejects.toThrow("Expected consumed_count to be an integer.");
  });
});

class FakeExecutor implements PostgresQueryExecutor {
  readonly queries: PostgresQuery[] = [];

  constructor(private readonly rows: readonly Record<string, unknown>[]) {}

  async query<Row extends Record<string, unknown>>(
    query: PostgresQuery
  ): Promise<{ rows: readonly Row[] }> {
    this.queries.push(query);
    return {
      rows: this.rows as readonly Row[]
    };
  }
}
