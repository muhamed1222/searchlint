import { describe, expect, it } from "vitest";

import { createPgPoolFromEnv } from "../src/index.js";

describe("createPgPoolFromEnv", () => {
  it("creates a pg pool from explicit SearchLint env settings", async () => {
    const pool = createPgPoolFromEnv({
      SEARCHLINT_POSTGRES_DATABASE_URL:
        "postgres://user:secret@example.test/db",
      SEARCHLINT_POSTGRES_POOL_MAX: "7",
      SEARCHLINT_POSTGRES_IDLE_TIMEOUT_MS: "30000",
      SEARCHLINT_POSTGRES_CONNECTION_TIMEOUT_MS: "5000",
      SEARCHLINT_POSTGRES_SSL_MODE: "require"
    });

    expect(pool.options).toMatchObject({
      connectionString: "postgres://user:secret@example.test/db",
      max: 7,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      ssl: {
        rejectUnauthorized: true
      }
    });
    await pool.end();
  });

  it("supports custom prefixes", async () => {
    const pool = createPgPoolFromEnv(
      {
        TEST_DATABASE_URL: "postgres://user:secret@example.test/db",
        TEST_SSL_MODE: "disable"
      },
      {
        prefix: "TEST"
      }
    );

    expect(pool.options).toMatchObject({
      connectionString: "postgres://user:secret@example.test/db"
    });
    expect(pool.options.ssl).toBeUndefined();
    await pool.end();
  });

  it("rejects missing database URLs", () => {
    expect(() => createPgPoolFromEnv({})).toThrow(
      "SEARCHLINT_POSTGRES_DATABASE_URL is required."
    );
  });

  it("rejects invalid numeric pool settings without leaking the database URL", () => {
    expect(() =>
      createPgPoolFromEnv({
        SEARCHLINT_POSTGRES_DATABASE_URL:
          "postgres://user:secret@example.test/db",
        SEARCHLINT_POSTGRES_POOL_MAX: "0"
      })
    ).toThrow("SEARCHLINT_POSTGRES_POOL_MAX must be a positive integer.");
  });

  it("rejects unknown SSL modes", () => {
    expect(() =>
      createPgPoolFromEnv({
        SEARCHLINT_POSTGRES_DATABASE_URL:
          "postgres://user:secret@example.test/db",
        SEARCHLINT_POSTGRES_SSL_MODE: "prefer"
      })
    ).toThrow("SEARCHLINT_POSTGRES_SSL_MODE must be disable or require.");
  });
});
