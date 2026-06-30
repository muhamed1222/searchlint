import type {
  DistributedRateLimitInput,
  DistributedRateLimitStore
} from "./distributed-rate-limit.js";
import type { PostgresQuery } from "./postgres-repository-sql.js";
import type { PostgresQueryExecutor } from "./postgres-relational-store.js";

type RateLimitWindowRow = {
  consumed_count: unknown;
  reset_at_ms: unknown;
};

export function createPostgresDistributedRateLimitStore(
  executor: PostgresQueryExecutor
): DistributedRateLimitStore {
  return {
    async consume(input) {
      const row = (
        await executor.query<RateLimitWindowRow>(
          consumeRateLimitWindowSql(input)
        )
      ).rows[0];
      if (!row) {
        throw new Error("PostgreSQL rate-limit consume did not return a row.");
      }

      const consumedCount = integer(row.consumed_count, "consumed_count");
      const resetAt = epochMilliseconds(row.reset_at_ms, "reset_at_ms");
      if (consumedCount <= input.limit) {
        return {
          allowed: true,
          remaining: Math.max(input.limit - consumedCount, 0),
          resetAt
        };
      }

      return {
        allowed: false,
        remaining: 0,
        resetAt,
        reason: "rate limit exceeded"
      };
    }
  };
}

export function consumeRateLimitWindowSql(
  input: DistributedRateLimitInput
): PostgresQuery {
  validateInput(input);
  return {
    text: 'INSERT INTO "rate_limit_windows" ("key", "schema_version", "created_at", "updated_at", "retention_until", "deletion_state", "window_started_at", "reset_at", "window_ms", "limit_count", "consumed_count") VALUES ($1, $2, to_timestamp($3 / 1000.0), to_timestamp($3 / 1000.0), $4, $5, to_timestamp($3 / 1000.0), to_timestamp(($3 + $6) / 1000.0), $6, $7, 1) ON CONFLICT ("key") DO UPDATE SET "updated_at" = to_timestamp($3 / 1000.0), "deletion_state" = $5, "window_started_at" = CASE WHEN "rate_limit_windows"."reset_at" <= to_timestamp($3 / 1000.0) THEN to_timestamp($3 / 1000.0) ELSE "rate_limit_windows"."window_started_at" END, "reset_at" = CASE WHEN "rate_limit_windows"."reset_at" <= to_timestamp($3 / 1000.0) THEN to_timestamp(($3 + $6) / 1000.0) ELSE "rate_limit_windows"."reset_at" END, "window_ms" = $6, "limit_count" = $7, "consumed_count" = CASE WHEN "rate_limit_windows"."reset_at" <= to_timestamp($3 / 1000.0) THEN 1 ELSE "rate_limit_windows"."consumed_count" + 1 END RETURNING "consumed_count", (EXTRACT(EPOCH FROM "reset_at") * 1000)::BIGINT AS "reset_at_ms";',
    values: [
      input.key,
      "cloud.rate_limit_windows.v1",
      input.now,
      null,
      "active",
      input.windowMs,
      input.limit
    ]
  };
}

function validateInput(input: DistributedRateLimitInput): void {
  if (!Number.isInteger(input.limit) || input.limit < 1) {
    throw new Error("Rate-limit limit must be a positive integer.");
  }
  if (!Number.isInteger(input.windowMs) || input.windowMs < 1) {
    throw new Error("Rate-limit windowMs must be a positive integer.");
  }
  if (!Number.isFinite(input.now) || input.now < 0) {
    throw new Error("Rate-limit now must be a non-negative number.");
  }
}

function integer(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error(`Expected ${field} to be an integer.`);
  }
  return value;
}

function epochMilliseconds(value: unknown, field: string): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  throw new Error(`Expected ${field} to be epoch milliseconds.`);
}
