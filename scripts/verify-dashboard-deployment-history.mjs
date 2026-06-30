#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { format } from "prettier";

const reportPath = "reports/dashboard-deployment-history-report.json";
const samplePath =
  "docs/examples/dashboard-deployment-history-report.sample.json";

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
  generatedBy: "searchlint-dashboard-deployment-history-verifier",
  generatedAt: "2026-06-22T00:00:00.000Z",
  status: "passed",
  scope: {
    proofType: "deterministic hosted/local dashboard deployment history proof",
    doesNotClaim: [
      "production dashboard deployment",
      "live deployment source ingestion",
      "live Git provider integration",
      "production deployment correlation proof",
      "production browser E2E"
    ]
  },
  commands: commandResults,
  assertions: [
    "DashboardSnapshot accepts optional deploymentHistory records.",
    "Trends view model exposes deployment history sorted newest-first.",
    "Deployment history renders commit refs, status, before/after counts, delta, and annotations.",
    "Deployment annotations and commit refs are HTML-escaped.",
    "Hosted/local route-flow verifier observes deployment history content."
  ],
  coveredDeployments: [
    {
      deploymentId: "deploy-1",
      deployedAt: "2026-06-22T00:10:00.000Z",
      commitRef: "abc1234",
      status: "succeeded",
      diagnosticsBefore: 7,
      diagnosticsAfter: 3,
      delta: -4
    }
  ],
  remainingReleaseGates: [
    "Deploy the production dashboard.",
    "Persist deployment history through the live Cloud API.",
    "Ingest live deployment and commit references.",
    "Correlate live deployment history with diagnostics history.",
    "Run production dashboard E2E."
  ]
};

await mkdir(path.dirname(reportPath), { recursive: true });
await mkdir(path.dirname(samplePath), { recursive: true });
await writeJson(reportPath, report);
await writeJson(samplePath, report);

console.log(
  `Dashboard deployment history PASS: ${commandResults.length}/${commands.length} command groups passed`
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
