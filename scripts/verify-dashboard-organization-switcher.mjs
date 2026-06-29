#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { format } from "prettier";

const reportPath = "reports/dashboard-organization-switcher-report.json";
const samplePath =
  "docs/examples/dashboard-organization-switcher-report.sample.json";

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
  generatedBy: "searchlint-dashboard-organization-switcher-verifier",
  generatedAt: "2026-06-22T00:00:00.000Z",
  status: "passed",
  scope: {
    proofType:
      "deterministic hosted/local dashboard organization switcher proof",
    doesNotClaim: [
      "production dashboard deployment",
      "live Cognito organization membership discovery",
      "live API Gateway/ECS/RDS organization switcher data",
      "organization CRUD",
      "production browser E2E"
    ]
  },
  commands: commandResults,
  assertions: [
    "DashboardSnapshot accepts optional organizationSwitchTargets.",
    "DashboardProjectViewModel exposes route-safe organizationSwitcher links.",
    "Current organization switch target is marked with aria-current=true.",
    "Project-view navigation keeps a single aria-current=page link.",
    "Custom dashboard base paths are preserved.",
    "Invalid switch target route segments are rejected before href rendering.",
    "Hosted/local browser route flow switches from Acme Agency to Beta Studio and back through dashboard snapshot API paths."
  ],
  coveredOrganizations: [
    {
      organizationId: "org-1",
      organizationName: "Acme Agency",
      projectId: "project-1",
      environmentId: "env-1"
    },
    {
      organizationId: "org-2",
      organizationName: "Beta Studio",
      projectId: "project-2",
      environmentId: "env-2"
    }
  ],
  remainingReleaseGates: [
    "Deploy the production dashboard.",
    "Read organization membership from live Cognito/API identity.",
    "Load switcher targets from the production Cloud API.",
    "Run production dashboard E2E across real auth and API infrastructure."
  ]
};

await mkdir(path.dirname(reportPath), { recursive: true });
await mkdir(path.dirname(samplePath), { recursive: true });
await writeJson(reportPath, report);
await writeJson(samplePath, report);

console.log(
  `Dashboard organization switcher PASS: ${commandResults.length}/${commands.length} command groups passed`
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
