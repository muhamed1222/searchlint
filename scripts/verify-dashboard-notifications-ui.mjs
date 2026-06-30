#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { format } from "prettier";

const reportPath = "reports/dashboard-notifications-ui-report.json";
const samplePath =
  "docs/examples/dashboard-notifications-ui-report.sample.json";

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
  generatedBy: "searchlint-dashboard-notifications-ui-verifier",
  generatedAt: "2026-06-22T00:00:00.000Z",
  status: "passed",
  scope: {
    proofType: "deterministic hosted/local dashboard notifications UI proof",
    doesNotClaim: [
      "production dashboard deployment",
      "live email delivery",
      "live Slack delivery",
      "live webhook delivery",
      "live Telegram delivery",
      "production notification persistence"
    ]
  },
  commands: commandResults,
  assertions: [
    "Settings view renders a visible Notification settings panel.",
    "Notification summary renders enabled channel, enabled rule, and retry-scheduled counts.",
    "Notification channels render sanitized target displays.",
    "Notification rules render events, severity threshold, digest, enabled state, and mute/snooze state.",
    "Notification delivery history renders retry-scheduled and delivered attempts without tokens.",
    "Hosted/local route-flow verifier observes notifications UI content in Settings."
  ],
  coveredUi: {
    channels: ["email", "slack", "webhook", "telegram"],
    rules: ["Blocker alerts", "Daily stale observations digest"],
    deliveryStatuses: ["retry_scheduled", "delivered"]
  },
  remainingReleaseGates: [
    "Deploy the production dashboard.",
    "Persist notification settings and delivery history through production storage.",
    "Send and verify live email, Slack, webhook, and optional Telegram notifications.",
    "Deploy notification workers and scheduler.",
    "Review deployed notification payload redaction in logs and telemetry."
  ]
};

await mkdir(path.dirname(reportPath), { recursive: true });
await mkdir(path.dirname(samplePath), { recursive: true });
await writeJson(reportPath, report);
await writeJson(samplePath, report);

console.log(
  `Dashboard notifications UI PASS: ${commandResults.length}/${commands.length} command groups passed`
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
