import { createHash } from "node:crypto";

import type {
  CloudHttpApplication,
  CloudHttpMethod,
  CloudHttpRequest
} from "./http-dispatcher.js";
import {
  createCloudHttpDispatcher,
  matchCloudRoute
} from "./http-dispatcher.js";
import type { Principal } from "./types.js";

export type ApiLoadBenchmarkRequest = {
  id: string;
  method: CloudHttpMethod;
  path: string;
  principal?: Principal;
  body?: unknown;
  expectedStatus: number;
  simulatedDurationMs: number;
};

export type ApiLoadBenchmarkThresholds = {
  minRequests: number;
  minConcurrency: number;
  maxUnexpectedErrorRate: number;
  maxP95DurationMs: number;
  minRouteOperations: number;
};

export type ApiLoadBenchmarkOptions = {
  name: string;
  application: CloudHttpApplication;
  requests: readonly ApiLoadBenchmarkRequest[];
  concurrency: number;
  thresholds: ApiLoadBenchmarkThresholds;
};

export type ApiLoadBenchmarkRequestResult = {
  id: string;
  status: "ok" | "unexpected";
  method: CloudHttpMethod;
  pathFingerprint: string;
  routeOperation: string;
  expectedStatus: number;
  actualStatus: number;
  durationMs: number;
  errorName?: string;
};

export type ApiLoadBenchmarkReport = {
  name: string;
  status: "passed" | "failed";
  requestCount: number;
  successfulRequests: number;
  unexpectedRequests: number;
  concurrency: number;
  routeOperations: Record<string, number>;
  statusCounts: Record<string, number>;
  unexpectedErrorRate: number;
  deterministicDurationMs: {
    p50: number;
    p95: number;
    max: number;
    totalWallClockEstimate: number;
    throughputRequestsPerSecond: number;
  };
  thresholds: ApiLoadBenchmarkThresholds;
  thresholdResults: readonly {
    id: string;
    status: "passed" | "failed";
    actual: number;
    expected: number;
  }[];
  requests: readonly ApiLoadBenchmarkRequestResult[];
};

export async function runApiLoadBenchmark(
  options: ApiLoadBenchmarkOptions
): Promise<ApiLoadBenchmarkReport> {
  validateBenchmarkOptions(options);
  const dispatcher = createCloudHttpDispatcher(options.application);
  const results: ApiLoadBenchmarkRequestResult[] = [];

  for (
    let index = 0;
    index < options.requests.length;
    index += options.concurrency
  ) {
    const batch = options.requests.slice(index, index + options.concurrency);
    const batchResults = await Promise.all(
      batch.map(async (request) => {
        try {
          const response = await dispatcher(toCloudHttpRequest(request));
          return requestResult(request, response.status);
        } catch (error) {
          return requestResult(
            request,
            500,
            error instanceof Error ? error.name : "UnknownError"
          );
        }
      })
    );
    results.push(...batchResults);
  }

  const unexpectedRequests = results.filter(
    (result) => result.status === "unexpected"
  ).length;
  const successfulRequests = results.length - unexpectedRequests;
  const routeOperations = countBy(results, (result) => result.routeOperation);
  const statusCounts = countBy(results, (result) =>
    String(result.actualStatus)
  );
  const durations = results.map((result) => result.durationMs);
  const p95 = percentile(durations, 95);
  const totalWallClockEstimate = estimateWallClock(
    durations,
    options.concurrency
  );
  const unexpectedErrorRate = unexpectedRequests / results.length;
  const thresholdResults = [
    thresholdAtLeast(
      "min-requests",
      results.length,
      options.thresholds.minRequests
    ),
    thresholdAtLeast(
      "min-concurrency",
      options.concurrency,
      options.thresholds.minConcurrency
    ),
    thresholdAtMost(
      "max-unexpected-error-rate",
      unexpectedErrorRate,
      options.thresholds.maxUnexpectedErrorRate
    ),
    thresholdAtMost(
      "max-p95-duration-ms",
      p95,
      options.thresholds.maxP95DurationMs
    ),
    thresholdAtLeast(
      "min-route-operations",
      Object.keys(routeOperations).length,
      options.thresholds.minRouteOperations
    )
  ];

  return {
    name: options.name,
    status: thresholdResults.every((result) => result.status === "passed")
      ? "passed"
      : "failed",
    requestCount: results.length,
    successfulRequests,
    unexpectedRequests,
    concurrency: options.concurrency,
    routeOperations,
    statusCounts,
    unexpectedErrorRate,
    deterministicDurationMs: {
      p50: percentile(durations, 50),
      p95,
      max: Math.max(...durations),
      totalWallClockEstimate,
      throughputRequestsPerSecond:
        totalWallClockEstimate === 0
          ? results.length
          : results.length / (totalWallClockEstimate / 1000)
    },
    thresholds: options.thresholds,
    thresholdResults,
    requests: results
  };
}

function toCloudHttpRequest(
  request: ApiLoadBenchmarkRequest
): CloudHttpRequest {
  return {
    method: request.method,
    path: request.path,
    ...(request.principal === undefined
      ? {}
      : { principal: request.principal }),
    ...(request.body === undefined ? {} : { body: request.body })
  };
}

function requestResult(
  request: ApiLoadBenchmarkRequest,
  actualStatus: number,
  errorName?: string
): ApiLoadBenchmarkRequestResult {
  const match = matchCloudRoute(request.method, request.path);
  const routeOperation = match?.operation ?? "unmatched";
  const status =
    actualStatus === request.expectedStatus && errorName === undefined
      ? "ok"
      : "unexpected";
  return {
    id: request.id,
    status,
    method: request.method,
    pathFingerprint: fingerprint(`${request.method} ${request.path}`),
    routeOperation,
    expectedStatus: request.expectedStatus,
    actualStatus,
    durationMs: request.simulatedDurationMs,
    ...(errorName === undefined ? {} : { errorName })
  };
}

function validateBenchmarkOptions(options: ApiLoadBenchmarkOptions): void {
  if (options.name.trim().length === 0) {
    throw new Error("API load benchmark name is required.");
  }
  if (!Number.isInteger(options.concurrency) || options.concurrency <= 0) {
    throw new Error("API load benchmark concurrency must be positive.");
  }
  if (options.requests.length === 0) {
    throw new Error("API load benchmark requests are required.");
  }
  const requestIds = new Set<string>();
  for (const [index, request] of options.requests.entries()) {
    if (request.id.trim().length === 0) {
      throw new Error(`API load benchmark request ${index} needs an id.`);
    }
    if (requestIds.has(request.id)) {
      throw new Error(
        `Duplicate API load benchmark request id: ${request.id}.`
      );
    }
    requestIds.add(request.id);
    if (
      !Number.isInteger(request.expectedStatus) ||
      request.expectedStatus < 100
    ) {
      throw new Error(`Request ${request.id} expectedStatus must be valid.`);
    }
    if (
      !Number.isFinite(request.simulatedDurationMs) ||
      request.simulatedDurationMs < 0
    ) {
      throw new Error(
        `Request ${request.id} simulatedDurationMs must be non-negative.`
      );
    }
  }
}

function countBy(
  results: readonly ApiLoadBenchmarkRequestResult[],
  keyFor: (result: ApiLoadBenchmarkRequestResult) => string
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const result of results) {
    const key = keyFor(result);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.fromEntries(
    Object.entries(counts).sort(([a], [b]) => a.localeCompare(b))
  );
}

function thresholdAtLeast(id: string, actual: number, expected: number) {
  return {
    id,
    status: actual >= expected ? ("passed" as const) : ("failed" as const),
    actual,
    expected
  };
}

function thresholdAtMost(id: string, actual: number, expected: number) {
  return {
    id,
    status: actual <= expected ? ("passed" as const) : ("failed" as const),
    actual,
    expected
  };
}

function percentile(
  values: readonly number[],
  percentileValue: number
): number {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentileValue / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, index))] ?? 0;
}

function estimateWallClock(
  durations: readonly number[],
  concurrency: number
): number {
  const lanes = Array.from({ length: concurrency }, () => 0);
  for (const duration of durations) {
    let laneIndex = 0;
    for (let index = 1; index < lanes.length; index += 1) {
      if ((lanes[index] ?? 0) < (lanes[laneIndex] ?? 0)) {
        laneIndex = index;
      }
    }
    lanes[laneIndex] = (lanes[laneIndex] ?? 0) + duration;
  }
  return Math.max(...lanes);
}

function fingerprint(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
