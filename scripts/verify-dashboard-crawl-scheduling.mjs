#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { format } from "prettier";

const reportPath = "reports/dashboard-crawl-scheduling-report.json";
const samplePath =
  "docs/examples/dashboard-crawl-scheduling-report.sample.json";

const commands = [
  {
    name: "dashboardBuild",
    command: "pnpm",
    args: ["--filter", "@searchlint/dashboard...", "build"]
  },
  {
    name: "dashboardUnitTests",
    command: "pnpm",
    args: ["--filter", "@searchlint/dashboard", "test"]
  },
  {
    name: "hostedRouteFlows",
    command: "node",
    args: ["scripts/verify-dashboard-hosted-route-flows.mjs"]
  }
];

const commandResults = commands.map(runCommand);
const report = {
  generatedBy: "searchlint-dashboard-crawl-scheduling-verifier",
  generatedAt: "2026-06-22T00:00:00.000Z",
  status: "passed",
  scope: {
    proofType: "deterministic hosted/local dashboard crawl scheduling proof",
    doesNotClaim: [
      "production dashboard deployment",
      "live EventBridge schedule creation",
      "live API-backed schedule persistence",
      "mutable scheduling form",
      "production browser E2E"
    ]
  },
  commands: commandResults,
  assertions: [
    "DashboardSnapshot accepts optional crawlSchedules records.",
    "Crawl History view model exposes sorted crawl schedules.",
    "Enabled and paused schedules render visibly.",
    "The checked requestCrawl Cloud API route contract renders in Crawl History.",
    "Schedule names are HTML-escaped.",
    "Hosted/local route-flow verifier observes crawl scheduling content."
  ],
  coveredSchedules: [
    {
      scheduleId: "schedule-weekly",
      name: "Weekly full crawl",
      cadence: "weekly",
      status: "enabled"
    },
    {
      scheduleId: "schedule-paused",
      name: "Paused launch crawl",
      cadence: "daily",
      status: "paused"
    }
  ],
  remainingReleaseGates: [
    "Deploy the production dashboard.",
    "Persist schedules through the live Cloud API.",
    "Create or update live scheduler resources.",
    "Verify live RBAC enforcement for schedule mutation.",
    "Run production dashboard E2E."
  ]
};

await mkdir(path.dirname(reportPath), { recursive: true });
await mkdir(path.dirname(samplePath), { recursive: true });
await writeJson(reportPath, report);
await writeJson(samplePath, report);

console.log(
  `Dashboard crawl scheduling PASS: ${commandResults.length}/${commands.length} command groups passed`
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

async function writeJson(filePath, value) {
  const json = await format(`${JSON.stringify(value, null, 2)}\n`, {
    parser: "json"
  });
  await writeFile(filePath, json);
}
