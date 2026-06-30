#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { format } from "prettier";

const reportPath = "reports/google-search-console-stale-states-report.json";
const samplePath =
  "docs/examples/google-search-console-stale-states-report.sample.json";

const commands = [
  {
    name: "apiGoogleStaleStateTests",
    command: "pnpm",
    args: [
      "--filter",
      "@searchlint/api",
      "test",
      "--",
      "google-provider-stale-state.test.ts",
      "google-provider-adapter.test.ts"
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
  },
  {
    name: "dashboardBuild",
    command: "pnpm",
    args: ["--filter", "@searchlint/dashboard...", "build"]
  },
  {
    name: "reporterBuild",
    command: "pnpm",
    args: ["--filter", "@searchlint/reporter-html", "build"]
  }
];

const commandResults = commands.map(runCommand);
const api = await import("../services/api/dist/src/index.js");
const dashboard = await import("../apps/dashboard/dist/src/index.js");
const reporter = await import("../packages/reporter-html/dist/src/index.js");

const freshnessCases = [
  {
    id: "fresh-7-days",
    observedAt: "2026-06-16T00:00:00.000Z",
    fetchedAt: "2026-06-23T00:00:00.000Z",
    expected: "fresh"
  },
  {
    id: "stale-22-days",
    observedAt: "2026-06-01T00:00:00.000Z",
    fetchedAt: "2026-06-23T00:00:00.000Z",
    expected: "stale"
  },
  {
    id: "expired-53-days",
    observedAt: "2026-05-01T00:00:00.000Z",
    fetchedAt: "2026-06-23T00:00:00.000Z",
    expected: "expired"
  },
  {
    id: "unknown-invalid-observed-at",
    observedAt: "not-a-date",
    fetchedAt: "2026-06-23T00:00:00.000Z",
    expected: "unknown"
  }
].map((input) => {
  const state = api.googleProviderFreshnessState({
    observedAt: input.observedAt,
    fetchedAt: input.fetchedAt
  });
  assertEqual(state.freshness, input.expected, `${input.id} freshness`);
  return {
    id: input.id,
    observedAt: input.observedAt,
    fetchedAt: input.fetchedAt,
    freshness: state.freshness,
    ageDays: state.ageDays,
    reason: state.reason
  };
});

const dashboardHtml = dashboard.renderDashboardHtml({
  organization: { id: "org-1", name: "Acme" },
  project: {
    id: "project-1",
    name: "Example",
    siteUrl: "https://example.test"
  },
  environment: {
    id: "env-1",
    name: "Production",
    baseUrl: "https://example.test"
  },
  diagnostics: [],
  crawlRuns: [],
  trends: [],
  externalObservations: [
    dashboardObservation("google-stale", "stale"),
    dashboardObservation("google-expired", "missing")
  ],
  reports: [],
  quotas: [],
  teamMembers: []
});
requireIncludes(dashboardHtml, "Google observation is stale.");
requireIncludes(dashboardHtml, "Google observation is expired.");

const reportHtml = reporter.createHtmlReport([], {
  reportVariant: "google",
  externalObservations: [
    reportObservation("google-stale", "stale"),
    reportObservation("google-expired", "expired")
  ]
});
requireIncludes(reportHtml, "google.urlInspection");
requireIncludes(reportHtml, "stale");
requireIncludes(reportHtml, "expired");

const report = {
  generatedBy: "searchlint-google-search-console-stale-states-verifier",
  generatedAt: "2026-06-23T00:00:00.000Z",
  status: "passed",
  scope: {
    proofType: "deterministic static Google Search Console stale-state proof",
    doesNotClaim: [
      "live Google Search Console API calls",
      "live stale-state behavior with production credentials",
      "deployed scheduler stale-state transitions",
      "live dashboard connector behavior",
      "live alerting behavior for stale Google observations"
    ]
  },
  commands: commandResults,
  thresholds: api.defaultGoogleProviderFreshnessThresholds,
  freshnessCases,
  dashboardEvidence: {
    rendersStaleGoogleObservation: dashboardHtml.includes(
      "Google observation is stale."
    ),
    rendersExpiredGoogleObservation: dashboardHtml.includes(
      "Google observation is expired."
    )
  },
  reportEvidence: {
    rendersGoogleObservationSource: reportHtml.includes("google.urlInspection"),
    rendersStaleFreshness: reportHtml.includes("stale"),
    rendersExpiredFreshness: reportHtml.includes("expired")
  },
  assertions: [
    "Fresh Google observations are at most 7 days old.",
    "Stale Google observations are older than 7 days and at most 30 days old.",
    "Expired Google observations are older than 30 days.",
    "Invalid Google observation timestamps are classified as unknown.",
    "The Google provider adapter uses the exported freshness contract.",
    "Dashboard and HTML report surfaces preserve stale and expired Google states.",
    "Deterministic Google Search Console acceptance still passes."
  ],
  remainingReleaseGates: [
    "Run live Google provider calls with production credentials.",
    "Verify stale-state transitions after real provider data ages.",
    "Verify scheduler persistence and replay for stale observations.",
    "Verify deployed dashboard connector stale-state rendering with live data.",
    "Verify notification/alert behavior for stale Google observations."
  ]
};

assertNoForbiddenSecrets(JSON.stringify(report));
await mkdir(path.dirname(reportPath), { recursive: true });
await mkdir(path.dirname(samplePath), { recursive: true });
await writeJson(reportPath, report);
await writeJson(samplePath, report);

console.log(
  `Google Search Console stale states PASS: cases=${freshnessCases.length}, dashboard=stale/expired, report=stale/expired`
);
console.log(`Report: ${reportPath}`);
console.log(`Sample: ${samplePath}`);

function dashboardObservation(id, status) {
  return {
    id,
    provider: "google",
    subjectUrl: `https://example.test/${id}`,
    status,
    observedAt:
      status === "stale"
        ? "2026-06-01T00:00:00.000Z"
        : "2026-05-01T00:00:00.000Z",
    fetchedAt: "2026-06-23T00:00:00.000Z",
    summary:
      status === "stale"
        ? "Google observation is stale."
        : "Google observation is expired."
  };
}

function reportObservation(id, freshness) {
  return {
    id,
    organizationId: "org-1",
    projectId: "project-1",
    environmentId: "env-1",
    provider: "google",
    source: "google.urlInspection",
    subjectUrl: `https://example.test/${id}`,
    observedAt:
      freshness === "stale"
        ? "2026-06-01T00:00:00.000Z"
        : "2026-05-01T00:00:00.000Z",
    fetchedAt: "2026-06-23T00:00:00.000Z",
    freshness,
    payload: {
      inspectionResult: {
        indexStatusResult: {
          coverageState:
            freshness === "stale" ? "Submitted and indexed" : "Stale data"
        }
      }
    },
    sampling: { sampled: false },
    fingerprint: `google:org-1:project-1:env-1:google.urlInspection:${id}`,
    deletionState: "active",
    createdAt: "2026-06-23T00:00:00.000Z"
  };
}

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

function requireIncludes(value, expected) {
  if (!value.includes(expected)) {
    throw new Error(`Expected output to include ${expected}.`);
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
        `Google Search Console stale-state report contains forbidden ${forbidden}.`
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
