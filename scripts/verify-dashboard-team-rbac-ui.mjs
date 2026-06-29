#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { format } from "prettier";

const reportPath = "reports/dashboard-team-rbac-ui-report.json";
const samplePath = "docs/examples/dashboard-team-rbac-ui-report.sample.json";

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
  generatedBy: "searchlint-dashboard-team-rbac-ui-verifier",
  generatedAt: "2026-06-23T00:00:00.000Z",
  status: "passed",
  scope: {
    proofType: "deterministic hosted/local dashboard Team/RBAC UI proof",
    doesNotClaim: [
      "production dashboard deployment",
      "live invite email delivery",
      "live team mutation forms",
      "deployed API persistence",
      "production auth/RBAC enforcement"
    ]
  },
  commands: commandResults,
  assertions: [
    "Team view renders principal IDs, display names, and roles.",
    "Team view renders a Team/RBAC management panel.",
    "Role matrix exposes owner and developer permissions including member:manage.",
    "Management actions expose the checked addMember route contract.",
    "Management actions document remove-member and ownership-transfer foundations.",
    "Hosted/local route-flow verifier observes Team/RBAC UI content."
  ],
  coveredUi: {
    roles: ["owner", "admin", "developer", "analyst", "client", "viewer"],
    managementActions: ["Invite member", "Remove member", "Transfer ownership"],
    checkedRoute: {
      action: "addMember",
      method: "POST",
      path: "/v1/organizations/{organizationId}/members"
    }
  },
  remainingReleaseGates: [
    "Deploy the production dashboard.",
    "Wire live team mutation forms to deployed API routes.",
    "Deliver and accept real invite emails.",
    "Verify live auth/RBAC enforcement for team mutations.",
    "Run production dashboard E2E."
  ]
};

await mkdir(path.dirname(reportPath), { recursive: true });
await mkdir(path.dirname(samplePath), { recursive: true });
await writeJson(reportPath, report);
await writeJson(samplePath, report);

console.log(
  `Dashboard Team/RBAC UI PASS: ${commandResults.length}/${commands.length} command groups passed`
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
