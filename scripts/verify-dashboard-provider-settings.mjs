#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { format } from "prettier";

const reportPath = "reports/dashboard-provider-settings-report.json";
const samplePath =
  "docs/examples/dashboard-provider-settings-report.sample.json";

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
  generatedBy: "searchlint-dashboard-provider-settings-verifier",
  generatedAt: "2026-06-22T00:00:00.000Z",
  status: "passed",
  scope: {
    proofType:
      "deterministic hosted/local dashboard Google/Yandex settings proof",
    doesNotClaim: [
      "production dashboard deployment",
      "live Google OAuth app configuration",
      "live Yandex OAuth app configuration",
      "live credential storage",
      "production browser E2E"
    ]
  },
  commands: commandResults,
  assertions: [
    "Settings view model exposes Google and Yandex provider settings.",
    "Provider settings include connection status derived from observations.",
    "Provider settings include observed subject counts without leaking tokens.",
    "Provider settings render the checked OAuth start route contract.",
    "Provider settings render required Google and Yandex scopes.",
    "Hosted/local route-flow verifier observes Google/Yandex settings content."
  ],
  coveredProviders: [
    {
      provider: "google",
      requiredScopes: [
        "openid",
        "email",
        "https://www.googleapis.com/auth/webmasters.readonly"
      ],
      redirectUri: "/dashboard/integrations/google/callback"
    },
    {
      provider: "yandex",
      requiredScopes: ["login:email", "webmaster:read", "metrika:read"],
      redirectUri: "/dashboard/integrations/yandex/callback"
    }
  ],
  remainingReleaseGates: [
    "Deploy the production dashboard.",
    "Configure live Google OAuth application and verified redirect URIs.",
    "Configure live Yandex OAuth application and verified redirect URIs.",
    "Persist live provider credentials through the OAuth vault.",
    "Run production dashboard E2E."
  ]
};

await mkdir(path.dirname(reportPath), { recursive: true });
await mkdir(path.dirname(samplePath), { recursive: true });
await writeJson(reportPath, report);
await writeJson(samplePath, report);

console.log(
  `Dashboard provider settings PASS: ${commandResults.length}/${commands.length} command groups passed`
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
