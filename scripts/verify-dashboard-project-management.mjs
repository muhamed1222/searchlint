#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { format } from "prettier";

const reportPath = "reports/dashboard-project-management-report.json";
const samplePath =
  "docs/examples/dashboard-project-management-report.sample.json";

const commands = [
  {
    name: "dashboardUnitTests",
    command: "pnpm",
    args: ["--filter", "@searchlint/dashboard", "test"]
  },
  {
    name: "dashboardBuild",
    command: "pnpm",
    args: ["--filter", "@searchlint/dashboard", "build"]
  },
  {
    name: "hostedRouteFlows",
    command: "node",
    args: ["scripts/verify-dashboard-hosted-route-flows.mjs"]
  }
];

const commandResults = commands.map(runCommand);
const report = {
  generatedBy: "searchlint-dashboard-project-management-verifier",
  generatedAt: "2026-06-22T00:00:00.000Z",
  status: "passed",
  scope: {
    proofType: "deterministic hosted/local dashboard project management proof",
    doesNotClaim: [
      "production dashboard deployment",
      "live API-backed project creation",
      "live Cognito/RBAC enforcement",
      "project CRUD beyond local management display",
      "production browser E2E"
    ]
  },
  commands: commandResults,
  assertions: [
    "DashboardSnapshot accepts optional projectManagement records.",
    "Organization view model exposes sorted project management rows.",
    "The current project is marked deterministically.",
    "Invalid project management route identifiers are rejected before rendering.",
    "Organization view renders Project management table rows.",
    "Organization view renders the checked createProject Cloud API route contract.",
    "Hosted/local route-flow verifier observes project management content in the Organization view."
  ],
  coveredProjects: [
    {
      projectId: "project-1",
      projectName: "Example Store",
      status: "current"
    },
    {
      projectId: "project-2",
      projectName: "Beta Storefront",
      status: "available"
    }
  ],
  remainingReleaseGates: [
    "Deploy the production dashboard.",
    "Back project management with live Cloud API project lists.",
    "Implement live project creation/update/delete forms.",
    "Verify live auth/RBAC enforcement for project management.",
    "Run production dashboard E2E."
  ]
};

await mkdir(path.dirname(reportPath), { recursive: true });
await mkdir(path.dirname(samplePath), { recursive: true });
await writeJson(reportPath, report);
await writeJson(samplePath, report);

console.log(
  `Dashboard project management PASS: ${commandResults.length}/${commands.length} command groups passed`
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
