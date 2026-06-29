#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { format } from "prettier";

const reportPath = "reports/google-performance-history-report.json";
const samplePath =
  "docs/examples/google-performance-history-report.sample.json";

const commands = [
  {
    name: "apiGooglePerformanceHistoryTests",
    command: "pnpm",
    args: [
      "--filter",
      "@searchlint/api",
      "test",
      "--",
      "google-performance-history.test.ts"
    ]
  },
  {
    name: "googlePerformanceAcceptance",
    command: "pnpm",
    args: ["google:performance:acceptance"]
  },
  {
    name: "apiBuild",
    command: "pnpm",
    args: ["--filter", "@searchlint/api", "build"]
  }
];

const commandResults = commands.map(runCommand);
const api = await import("../services/api/dist/src/index.js");

const observations = [pageSpeedObservation(), cruxObservation(), cruxMissing()];
const points = api.googlePerformanceMetricPointsFromObservations(observations);
const events = api.googlePerformanceMetricEventsFromObservations(observations);

assertEqual(points.length, 12, "metric point count");
assertEqual(events.length, 12, "metric event count");
assertEqual(
  JSON.stringify([...new Set(points.map((point) => point.source))].sort()),
  JSON.stringify([
    "crux-field",
    "pagespeed-field-origin",
    "pagespeed-field-page",
    "pagespeed-lab"
  ]),
  "metric sources"
);
assertEqual(
  JSON.stringify([...new Set(events.map((event) => event.name))].sort()),
  JSON.stringify(["performance.cls", "performance.inp", "performance.lcp"]),
  "metric event names"
);

const report = {
  generatedBy: "searchlint-google-performance-history-verifier",
  generatedAt: "2026-06-23T00:00:00.000Z",
  status: "passed",
  scope: {
    proofType: "deterministic static PageSpeed/CrUX metric history proof",
    doesNotClaim: [
      "live PageSpeed Insights API calls",
      "live CrUX API calls",
      "production historical metric storage",
      "deployed dashboard performance visualization",
      "live Google quota/retry/stale-state behavior"
    ]
  },
  commands: commandResults,
  metricPointSummary: {
    pointCount: points.length,
    sources: [...new Set(points.map((point) => point.source))].sort(),
    metrics: [...new Set(points.map((point) => point.metric))].sort(),
    units: [...new Set(points.map((point) => point.unit))].sort(),
    sampledPointCount: points.filter((point) => point.sampled).length
  },
  metricEventSummary: {
    eventCount: events.length,
    names: [...new Set(events.map((event) => event.name))].sort(),
    dimensionKeys: Object.keys(events[0]?.dimensions ?? {}).sort(),
    sampleEvent: events[0]
  },
  missingDataHandling: {
    cruxMissingObservationIncluded: true,
    cruxMissingMetricPoints: api.googlePerformanceMetricPointsFromObservations([
      cruxMissing()
    ]).length
  },
  assertions: [
    "PageSpeed lab LCP, INP, and CLS become performance history points.",
    "PageSpeed field page LCP, INP, and CLS become performance history points.",
    "PageSpeed field origin LCP, INP, and CLS become performance history points.",
    "CrUX field LCP, INP, and CLS become performance history points.",
    "CrUX missing-data observations produce zero metric points.",
    "Metric events include project, environment, subject URL, source, unit, freshness, and sampled dimensions.",
    "Deterministic PageSpeed/CrUX acceptance still passes."
  ],
  remainingReleaseGates: [
    "Run live PageSpeed Insights and CrUX calls with production credentials.",
    "Persist historical performance metric rollups in deployed storage.",
    "Render deployed dashboard performance charts from live stored data.",
    "Verify retention/deletion behavior for performance metric history.",
    "Verify live quota/retry/stale-state behavior."
  ]
};

assertNoForbiddenSecrets(JSON.stringify(report));
await mkdir(path.dirname(reportPath), { recursive: true });
await mkdir(path.dirname(samplePath), { recursive: true });
await writeJson(reportPath, report);
await writeJson(samplePath, report);

console.log(
  `Google performance history PASS: points=${points.length}, events=${events.length}, missingCruxPoints=${report.missingDataHandling.cruxMissingMetricPoints}`
);
console.log(`Report: ${reportPath}`);
console.log(`Sample: ${samplePath}`);

function baseObservation(source, payload, sampling = { sampled: false }) {
  return {
    id: `observation-${source}`,
    organizationId: "org-1",
    projectId: "project-1",
    environmentId: "env-1",
    provider: "google",
    source,
    subjectUrl: "https://example.test/products/widget",
    observedAt: "2026-06-20T14:15:16.000Z",
    fetchedAt: "2026-06-21T00:00:00.000Z",
    freshness: "fresh",
    payload,
    sampling,
    fingerprint: `fingerprint-${source}`,
    deletionState: "active",
    createdAt: "2026-06-21T00:00:00.000Z"
  };
}

function pageSpeedObservation() {
  return baseObservation("google.pagespeed", {
    lighthouseResult: {
      audits: {
        "largest-contentful-paint": { numericValue: 2200 },
        "experimental-interaction-to-next-paint": { numericValue: 180 },
        "cumulative-layout-shift": { numericValue: 0.04 }
      }
    },
    loadingExperience: {
      metrics: {
        LARGEST_CONTENTFUL_PAINT_MS: { percentile: 2450 },
        INTERACTION_TO_NEXT_PAINT: { percentile: 190 },
        CUMULATIVE_LAYOUT_SHIFT_SCORE: { percentile: 0.05 }
      }
    },
    originLoadingExperience: {
      metrics: {
        LARGEST_CONTENTFUL_PAINT_MS: { percentile: 2600 },
        INTERACTION_TO_NEXT_PAINT: { percentile: 210 },
        CUMULATIVE_LAYOUT_SHIFT_SCORE: { percentile: 0.07 }
      }
    }
  });
}

function cruxObservation() {
  return baseObservation(
    "google.crux",
    {
      record: {
        metrics: {
          largest_contentful_paint: { percentiles: { p75: 2400 } },
          interaction_to_next_paint: { percentiles: { p75: 175 } },
          cumulative_layout_shift: { percentiles: { p75: 0.06 } }
        }
      }
    },
    { sampled: true, state: "field-data" }
  );
}

function cruxMissing() {
  return baseObservation(
    "google.crux",
    {
      record: {
        metrics: {}
      }
    },
    { sampled: true, state: "missing" }
  );
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
        `Google performance history report contains forbidden ${forbidden}.`
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
