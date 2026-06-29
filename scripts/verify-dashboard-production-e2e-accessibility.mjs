#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { format } from "prettier";

const reportPath = "reports/dashboard-production-e2e-accessibility-report.json";
const samplePath =
  "docs/examples/dashboard-production-e2e-accessibility-report.sample.json";

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
  },
  {
    name: "hostedAccessibility",
    command: "node",
    args: ["scripts/verify-dashboard-hosted-accessibility.mjs"]
  },
  {
    name: "hostedVisual",
    command: "node",
    args: ["scripts/verify-dashboard-hosted-visual.mjs"]
  }
];

const commandResults = commands.map(runCommand);
const visualReport = await readJsonIfExists(
  "reports/dashboard-visual/report.json"
);
const report = {
  generatedBy: "searchlint-dashboard-production-e2e-accessibility-verifier",
  generatedAt: "2026-06-22T00:00:00.000Z",
  status: "passed",
  scope: {
    proofType: "deterministic hosted/local browser proof",
    doesNotClaim: [
      "real CloudFront deployment",
      "live Cognito signup/login/logout",
      "live API Gateway/ECS/RDS proof",
      "live Stripe billing",
      "live Google/Yandex credentials",
      "external WCAG audit"
    ]
  },
  commands: commandResults,
  coveredViews: [
    "onboarding",
    "overview",
    "issues",
    "diagnostics",
    "crawlHistory",
    "trends",
    "externalObservations",
    "reports",
    "organization",
    "site",
    "environments",
    "team",
    "billing",
    "settings",
    "auditLog"
  ],
  accessibilityAssertions: [
    "banner landmark",
    "Organization switcher navigation landmark",
    "Project dashboard views navigation landmark",
    "main landmark",
    "current organization switcher link",
    "single aria-current page link",
    "keyboard tab order",
    "accessible table names",
    "boot loading state",
    "runtime error state focus"
  ],
  visualAssertions:
    visualReport?.cases?.map((visualCase) => ({
      name: visualCase.name,
      viewport: visualCase.viewport,
      path: visualCase.path,
      sha256: visualCase.sha256,
      bytes: visualCase.bytes,
      uniqueColorCount: visualCase.png?.uniqueColorCount
    })) ?? [],
  remainingReleaseGates: [
    "Deploy dashboard static hosting to real S3/CloudFront.",
    "Upload and verify production dashboard assets at the deployed URL.",
    "Run browser E2E against live Cognito and live Cloud API.",
    "Complete dashboard onboarding create flows against real API mutations.",
    "Complete billing UI against live Stripe-backed entitlements.",
    "Complete Google/Yandex connector UI with live credentials.",
    "Run external WCAG 2.2 AA audit and assistive-technology review.",
    "Run production visual regression service across supported browsers."
  ]
};

await mkdir(path.dirname(reportPath), { recursive: true });
await mkdir(path.dirname(samplePath), { recursive: true });
await writeJson(reportPath, report);
await writeJson(samplePath, report);

console.log(
  `Dashboard production E2E/accessibility PASS: ${commandResults.length}/${commands.length} command groups passed`
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

async function readJsonIfExists(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (
      error !== null &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return undefined;
    }
    throw error;
  }
}

async function writeJson(filePath, value) {
  const json = await format(`${JSON.stringify(value, null, 2)}\n`, {
    parser: "json"
  });
  await writeFile(filePath, json);
}
