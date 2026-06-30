import { describe, expect, it } from "vitest";

import { runPostgresLoadBenchmark } from "../src/index.js";
import type { PostgresQueryExecutor } from "../src/index.js";

describe("runPostgresLoadBenchmark", () => {
  it("runs deterministic query workloads with concurrency and threshold evidence", async () => {
    const operations = Array.from({ length: 20 }, (_, index) => ({
      id: `operation-${index + 1}`,
      query:
        index % 3 === 0
          ? {
              text: 'INSERT INTO "organizations" ("id") VALUES ($1) RETURNING *;',
              values: [`org-${index}`]
            }
          : index % 3 === 1
            ? {
                text: 'SELECT * FROM "projects" WHERE "organization_id" = $1;',
                values: ["org-1"]
              }
            : {
                text: 'UPDATE "organization_memberships" SET "role" = $1 WHERE "id" = $2 RETURNING *;',
                values: ["admin", `member-${index}`]
              },
      expectedRows: 1,
      simulatedDurationMs: 5 + (index % 5)
    }));

    const report = await runPostgresLoadBenchmark({
      name: "unit-load",
      operations,
      concurrency: 4,
      thresholds: {
        minOperations: 20,
        minConcurrency: 4,
        maxErrorRate: 0,
        maxP95DurationMs: 9,
        minStatementTypes: 3
      },
      executor: rowsExecutor(1)
    });

    expect(report.status).toBe("passed");
    expect(report.operationCount).toBe(20);
    expect(report.failedOperations).toBe(0);
    expect(report.statementTypes).toEqual({
      INSERT: 7,
      SELECT: 7,
      UPDATE: 6
    });
    expect(report.deterministicDurationMs).toEqual(
      expect.objectContaining({
        p50: 7,
        p95: 9,
        max: 9
      })
    );
    expect(report.operations[0]?.queryFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(report)).not.toContain("org-1");
  });

  it("accounts for failed operations without leaking SQL values", async () => {
    const report = await runPostgresLoadBenchmark({
      name: "failed-load",
      operations: [
        {
          id: "ok",
          query: { text: "SELECT 1;", values: ["secret-ok"] },
          expectedRows: 1,
          simulatedDurationMs: 3
        },
        {
          id: "wrong-row-count",
          query: { text: "SELECT 2;", values: ["secret-failure"] },
          expectedRows: 2,
          simulatedDurationMs: 4
        }
      ],
      concurrency: 2,
      thresholds: {
        minOperations: 2,
        minConcurrency: 2,
        maxErrorRate: 0,
        maxP95DurationMs: 10,
        minStatementTypes: 1
      },
      executor: rowsExecutor(1)
    });

    expect(report.status).toBe("failed");
    expect(report.failedOperations).toBe(1);
    expect(report.errorRate).toBe(0.5);
    expect(report.operations[1]).toEqual(
      expect.objectContaining({
        id: "wrong-row-count",
        status: "error",
        errorName: "Error"
      })
    );
    expect(JSON.stringify(report)).not.toContain("secret-failure");
  });

  it("rejects invalid benchmark configuration", async () => {
    await expect(
      runPostgresLoadBenchmark({
        name: "",
        operations: [],
        concurrency: 0,
        thresholds: {
          minOperations: 1,
          minConcurrency: 1,
          maxErrorRate: 0,
          maxP95DurationMs: 10,
          minStatementTypes: 1
        },
        executor: rowsExecutor(1)
      })
    ).rejects.toThrow("PostgreSQL load benchmark name is required.");

    await expect(
      runPostgresLoadBenchmark({
        name: "duplicate",
        operations: [
          {
            id: "same",
            query: { text: "SELECT 1;", values: [] },
            expectedRows: 1,
            simulatedDurationMs: 1
          },
          {
            id: "same",
            query: { text: "SELECT 2;", values: [] },
            expectedRows: 1,
            simulatedDurationMs: 1
          }
        ],
        concurrency: 1,
        thresholds: {
          minOperations: 1,
          minConcurrency: 1,
          maxErrorRate: 0,
          maxP95DurationMs: 10,
          minStatementTypes: 1
        },
        executor: rowsExecutor(1)
      })
    ).rejects.toThrow(
      "Duplicate PostgreSQL load benchmark operation id: same."
    );
  });
});

function rowsExecutor(rowCount: number): PostgresQueryExecutor {
  return {
    async query<Row extends Record<string, unknown>>() {
      return {
        rows: Array.from({ length: rowCount }, (_, index) => ({
          id: index
        })) as unknown as Row[]
      };
    }
  };
}
