#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { format } from "prettier";

const reportPath = "reports/google-search-console-retry-backoff-report.json";
const samplePath =
  "docs/examples/google-search-console-retry-backoff-report.sample.json";

const commands = [
  {
    name: "apiGoogleRetryPolicyTests",
    command: "pnpm",
    args: [
      "--filter",
      "@searchlint/api",
      "test",
      "--",
      "google-provider-retry-policy.test.ts"
    ]
  },
  {
    name: "googleSearchConsoleDeterministicAcceptance",
    command: "pnpm",
    args: ["google:gsc:acceptance"]
  },
  {
    name: "apiBuild",
    command: "pnpm",
    args: ["--filter", "@searchlint/api", "build"]
  }
];

const commandResults = commands.map(runCommand);
const api = await import("../services/api/dist/src/index.js");

const retryableCases = [
  {
    id: "quota-exhausted-429",
    status: 429,
    payload: { error: { status: "RESOURCE_EXHAUSTED" } },
    expectedReason: "quota-exhausted"
  },
  {
    id: "rate-limited-429",
    status: 429,
    payload: { error: {} },
    expectedReason: "rate-limited"
  },
  {
    id: "server-error-500",
    status: 500,
    payload: { error: { status: "INTERNAL" } },
    expectedReason: "server-error"
  },
  {
    id: "unavailable-503",
    status: 503,
    payload: { error: { status: "UNAVAILABLE" } },
    expectedReason: "temporarily-unavailable"
  },
  {
    id: "deadline-504",
    status: 504,
    payload: { error: { status: "DEADLINE_EXCEEDED" } },
    expectedReason: "deadline-exceeded"
  }
].map((input) => {
  const decision = api.googleProviderRetryDecision({
    status: input.status,
    payload: input.payload,
    attempt: 2,
    fetchedAt: "2026-06-23T00:00:00.000Z",
    policy: {
      baseDelayMs: 1_000,
      maxDelayMs: 60_000,
      multiplier: 2
    }
  });
  assertEqual(decision.retryable, true, `${input.id} retryable`);
  assertEqual(decision.reason, input.expectedReason, `${input.id} reason`);
  return {
    id: input.id,
    status: input.status,
    reason: decision.reason,
    delayMs: decision.delayMs,
    nextAttemptAt: decision.nextAttemptAt,
    source: decision.source
  };
});

const nonRetryableCases = [400, 401, 403, 404].map((status) => {
  const decision = api.googleProviderRetryDecision({
    status,
    payload: { error: { status: `HTTP_${status}` } },
    attempt: 1,
    fetchedAt: "2026-06-23T00:00:00.000Z"
  });
  assertEqual(decision.retryable, false, `${status} retryable`);
  assertEqual(decision.delayMs, 0, `${status} delay`);
  return {
    status,
    retryable: decision.retryable,
    source: decision.source
  };
});

const exponentialSchedule = [1, 2, 3, 4, 8].map((attempt) =>
  api.googleProviderRetryDecision({
    status: 429,
    attempt,
    fetchedAt: "2026-06-23T00:00:00.000Z",
    policy: {
      baseDelayMs: 1_000,
      maxDelayMs: 10_000,
      multiplier: 2
    }
  })
);
assertEqual(
  JSON.stringify(exponentialSchedule.map((decision) => decision.delayMs)),
  JSON.stringify([1_000, 2_000, 4_000, 8_000, 10_000]),
  "exponential schedule"
);

const retryAfterCases = [
  api.googleProviderRetryDecision({
    status: 503,
    retryAfter: "7",
    attempt: 1,
    fetchedAt: "2026-06-23T00:00:00.000Z"
  }),
  api.googleProviderRetryDecision({
    status: 503,
    retryAfter: "Tue, 23 Jun 2026 00:02:00 GMT",
    attempt: 1,
    fetchedAt: "2026-06-23T00:00:00.000Z",
    policy: { maxDelayMs: 60_000 }
  })
];
assertEqual(
  JSON.stringify(retryAfterCases.map((decision) => decision.delayMs)),
  JSON.stringify([7_000, 60_000]),
  "retry-after schedule"
);

const report = {
  generatedBy: "searchlint-google-search-console-retry-backoff-verifier",
  generatedAt: "2026-06-23T00:00:00.000Z",
  status: "passed",
  scope: {
    proofType: "deterministic static Google Search Console retry/backoff proof",
    doesNotClaim: [
      "live Google Search Console API calls",
      "live Google quota exhaustion",
      "live retry behavior with production credentials",
      "deployed scheduler retry execution",
      "live dashboard connector behavior"
    ]
  },
  commands: commandResults,
  policy: api.defaultGoogleProviderRetryPolicy,
  retryableCases,
  nonRetryableCases,
  exponentialSchedule: exponentialSchedule.map((decision) => ({
    attempt: decision.attempt,
    delayMs: decision.delayMs,
    nextAttemptAt: decision.nextAttemptAt,
    source: decision.source
  })),
  retryAfterCases: retryAfterCases.map((decision) => ({
    delayMs: decision.delayMs,
    nextAttemptAt: decision.nextAttemptAt,
    source: decision.source
  })),
  assertions: [
    "Google 429 RESOURCE_EXHAUSTED is treated as retryable quota exhaustion.",
    "Google 429 without a specific status is treated as retryable rate limiting.",
    "Google 500/503/504 transient failures are retryable.",
    "Google 400/401/403/404 failures are not retried by the static policy.",
    "Exponential backoff is deterministic and capped by maxDelayMs.",
    "Retry-After seconds and HTTP-date values are honored and capped.",
    "Deterministic Google Search Console acceptance still passes."
  ],
  remainingReleaseGates: [
    "Run live Google provider calls with production credentials.",
    "Verify retry behavior against real quota/rate-limit responses.",
    "Verify scheduler persistence and replay after transient provider failures.",
    "Verify deployed worker metrics and alerts for retry/backoff outcomes.",
    "Verify stale-state behavior after repeated retry exhaustion."
  ]
};

assertNoForbiddenSecrets(JSON.stringify(report));
await mkdir(path.dirname(reportPath), { recursive: true });
await mkdir(path.dirname(samplePath), { recursive: true });
await writeJson(reportPath, report);
await writeJson(samplePath, report);

console.log(
  `Google Search Console retry/backoff PASS: retryable=${retryableCases.length}, nonRetryable=${nonRetryableCases.length}, scheduleSteps=${exponentialSchedule.length}`
);
console.log(`Report: ${reportPath}`);
console.log(`Sample: ${samplePath}`);

function runCommand(commandSpec) {
  const result = spawnSync(commandSpec.command, commandSpec.args, {
    cwd: process.cwd(),
    env: process.env,
    encoding: "utf8",
    stdio: "pipe"
  });
  if (result.status !== 0) {
    process.stderr.write(result.stdout);
    process.stderr.write(result.stderr);
    throw new Error(
      `${commandSpec.name} failed with exit code ${result.status ?? "unknown"}.`
    );
  }
  return {
    name: commandSpec.name,
    command: [commandSpec.command, ...commandSpec.args].join(" "),
    status: "passed",
    stdout: summarizeOutput(result.stdout)
  };
}

function summarizeOutput(output) {
  return output
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line !== "")
    .filter((line) => !line.startsWith("RUN "))
    .filter((line) => !line.startsWith("Start at "))
    .filter((line) => !line.startsWith("Duration "))
    .filter((line) => !line.startsWith("$ "))
    .slice(-8);
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, received ${actual}.`);
  }
}

function assertNoForbiddenSecrets(value) {
  for (const forbidden of [
    "google-access-token",
    "google-refresh-token",
    "authorization-code",
    "client-secret",
    "Bearer "
  ]) {
    if (value.includes(forbidden)) {
      throw new Error(
        `Google Search Console retry/backoff report contains forbidden ${forbidden}.`
      );
    }
  }
}

async function writeJson(filePath, value) {
  const json = await format(`${JSON.stringify(value, null, 2)}\n`, {
    parser: "json"
  });
  await writeFile(filePath, json);
}
