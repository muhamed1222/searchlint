import { createHash } from "node:crypto";

import type { PostgresQueryExecutor } from "./postgres-relational-store.js";
import type { PostgresQuery } from "./postgres-repository-sql.js";

export type PostgresLoadBenchmarkOperation = {
  id: string;
  query: PostgresQuery;
  expectedRows: number;
  simulatedDurationMs: number;
};

export type PostgresLoadBenchmarkThresholds = {
  minOperations: number;
  minConcurrency: number;
  maxErrorRate: number;
  maxP95DurationMs: number;
  minStatementTypes: number;
};

export type PostgresLoadBenchmarkOptions = {
  name: string;
  operations: readonly PostgresLoadBenchmarkOperation[];
  concurrency: number;
  thresholds: PostgresLoadBenchmarkThresholds;
  executor: PostgresQueryExecutor;
};

export type PostgresLoadBenchmarkOperationResult = {
  id: string;
  status: "ok" | "error";
  statementType: string;
  queryFingerprint: string;
  durationMs: number;
  rowCount: number;
  errorName?: string;
};

export type PostgresLoadBenchmarkReport = {
  name: string;
  status: "passed" | "failed";
  operationCount: number;
  successfulOperations: number;
  failedOperations: number;
  concurrency: number;
  statementTypes: Record<string, number>;
  errorRate: number;
  deterministicDurationMs: {
    p50: number;
    p95: number;
    max: number;
    totalWallClockEstimate: number;
    throughputOpsPerSecond: number;
  };
  thresholds: PostgresLoadBenchmarkThresholds;
  thresholdResults: readonly {
    id: string;
    status: "passed" | "failed";
    actual: number;
    expected: number;
  }[];
  operations: readonly PostgresLoadBenchmarkOperationResult[];
};

export async function runPostgresLoadBenchmark(
  options: PostgresLoadBenchmarkOptions
): Promise<PostgresLoadBenchmarkReport> {
  validateBenchmarkOptions(options);
  const results: PostgresLoadBenchmarkOperationResult[] = [];

  for (
    let index = 0;
    index < options.operations.length;
    index += options.concurrency
  ) {
    const batch = options.operations.slice(index, index + options.concurrency);
    const batchResults = await Promise.all(
      batch.map((operation) => runOperation(options.executor, operation))
    );
    results.push(...batchResults);
  }

  const failedOperations = results.filter(
    (result) => result.status === "error"
  ).length;
  const successfulOperations = results.length - failedOperations;
  const statementTypes = countStatementTypes(results);
  const durations = results.map((result) => result.durationMs);
  const totalWallClockEstimate = estimateWallClock(
    results.map((result) => result.durationMs),
    options.concurrency
  );
  const errorRate = failedOperations / results.length;
  const p95 = percentile(durations, 95);
  const thresholdResults = [
    thresholdAtLeast(
      "min-operations",
      results.length,
      options.thresholds.minOperations
    ),
    thresholdAtLeast(
      "min-concurrency",
      options.concurrency,
      options.thresholds.minConcurrency
    ),
    thresholdAtMost(
      "max-error-rate",
      errorRate,
      options.thresholds.maxErrorRate
    ),
    thresholdAtMost(
      "max-p95-duration-ms",
      p95,
      options.thresholds.maxP95DurationMs
    ),
    thresholdAtLeast(
      "min-statement-types",
      Object.keys(statementTypes).length,
      options.thresholds.minStatementTypes
    )
  ];

  return {
    name: options.name,
    status: thresholdResults.every((result) => result.status === "passed")
      ? "passed"
      : "failed",
    operationCount: results.length,
    successfulOperations,
    failedOperations,
    concurrency: options.concurrency,
    statementTypes,
    errorRate,
    deterministicDurationMs: {
      p50: percentile(durations, 50),
      p95,
      max: Math.max(...durations),
      totalWallClockEstimate,
      throughputOpsPerSecond:
        totalWallClockEstimate === 0
          ? results.length
          : results.length / (totalWallClockEstimate / 1000)
    },
    thresholds: options.thresholds,
    thresholdResults,
    operations: results
  };
}

async function runOperation(
  executor: PostgresQueryExecutor,
  operation: PostgresLoadBenchmarkOperation
): Promise<PostgresLoadBenchmarkOperationResult> {
  try {
    const result = await executor.query(operation.query);
    if (result.rows.length !== operation.expectedRows) {
      throw new Error(
        `Expected ${operation.expectedRows} rows, got ${result.rows.length}.`
      );
    }
    return {
      id: operation.id,
      status: "ok",
      statementType: statementType(operation.query.text),
      queryFingerprint: fingerprintQueryText(operation.query.text),
      durationMs: operation.simulatedDurationMs,
      rowCount: result.rows.length
    };
  } catch (error) {
    return {
      id: operation.id,
      status: "error",
      statementType: statementType(operation.query.text),
      queryFingerprint: fingerprintQueryText(operation.query.text),
      durationMs: operation.simulatedDurationMs,
      rowCount: 0,
      errorName: error instanceof Error ? error.name : "UnknownError"
    };
  }
}

function validateBenchmarkOptions(options: PostgresLoadBenchmarkOptions): void {
  if (options.name.trim().length === 0) {
    throw new Error("PostgreSQL load benchmark name is required.");
  }
  if (!Number.isInteger(options.concurrency) || options.concurrency <= 0) {
    throw new Error("PostgreSQL load benchmark concurrency must be positive.");
  }
  if (options.operations.length === 0) {
    throw new Error("PostgreSQL load benchmark operations are required.");
  }
  const operationIds = new Set<string>();
  for (const [index, operation] of options.operations.entries()) {
    if (operation.id.trim().length === 0) {
      throw new Error(
        `PostgreSQL load benchmark operation ${index} needs an id.`
      );
    }
    if (operationIds.has(operation.id)) {
      throw new Error(
        `Duplicate PostgreSQL load benchmark operation id: ${operation.id}.`
      );
    }
    operationIds.add(operation.id);
    if (
      !Number.isInteger(operation.expectedRows) ||
      operation.expectedRows < 0
    ) {
      throw new Error(
        `Operation ${operation.id} expectedRows must be non-negative.`
      );
    }
    if (
      !Number.isFinite(operation.simulatedDurationMs) ||
      operation.simulatedDurationMs < 0
    ) {
      throw new Error(
        `Operation ${operation.id} simulatedDurationMs must be non-negative.`
      );
    }
  }
  for (const [field, value] of Object.entries(options.thresholds)) {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(
        `PostgreSQL load benchmark threshold ${field} is invalid.`
      );
    }
  }
}

function countStatementTypes(
  results: readonly PostgresLoadBenchmarkOperationResult[]
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const result of results) {
    counts[result.statementType] = (counts[result.statementType] ?? 0) + 1;
  }
  return Object.fromEntries(
    Object.entries(counts).sort(([left], [right]) => left.localeCompare(right))
  );
}

function estimateWallClock(
  durations: readonly number[],
  concurrency: number
): number {
  let total = 0;
  for (let index = 0; index < durations.length; index += concurrency) {
    total += Math.max(...durations.slice(index, index + concurrency));
  }
  return total;
}

function percentile(
  values: readonly number[],
  percentileValue: number
): number {
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.ceil((percentileValue / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, index))] ?? 0;
}

function thresholdAtLeast(
  id: string,
  actual: number,
  expected: number
): PostgresLoadBenchmarkReport["thresholdResults"][number] {
  return {
    id,
    status: actual >= expected ? "passed" : "failed",
    actual,
    expected
  };
}

function thresholdAtMost(
  id: string,
  actual: number,
  expected: number
): PostgresLoadBenchmarkReport["thresholdResults"][number] {
  return {
    id,
    status: actual <= expected ? "passed" : "failed",
    actual,
    expected
  };
}

function fingerprintQueryText(text: string): string {
  return createHash("sha256").update(normalizeQueryText(text)).digest("hex");
}

function statementType(text: string): string {
  return normalizeQueryText(text).split(/\s+/u)[0]?.toUpperCase() ?? "UNKNOWN";
}

function normalizeQueryText(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}
