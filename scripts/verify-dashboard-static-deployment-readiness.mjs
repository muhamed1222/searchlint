#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { format } from "prettier";

const reportPath = "reports/dashboard-static-deployment-readiness-report.json";
const samplePath =
  "docs/examples/dashboard-static-deployment-readiness-report.sample.json";

const commands = [
  {
    name: "dashboardBuild",
    command: "pnpm",
    args: ["--filter", "@searchlint/dashboard", "build"]
  },
  {
    name: "browserAssets",
    command: "node",
    args: ["scripts/verify-dashboard-browser-assets.mjs"]
  },
  {
    name: "hostedBrowserLoad",
    command: "node",
    args: ["scripts/verify-dashboard-hosted-browser-load.mjs"]
  },
  {
    name: "hostedBundleLoad",
    command: "node",
    args: ["scripts/verify-dashboard-hosted-bundle-load.mjs"]
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
  },
  {
    name: "awsStaticHostingTemplate",
    command: "node",
    args: ["scripts/verify-aws-iac.mjs"]
  }
];

const commandResults = commands.map(runCommand);
const template = JSON.parse(
  await readFile(
    "infra/aws/dashboard-static-hosting.cloudformation.json",
    "utf8"
  )
);
const dashboardPackage = JSON.parse(
  await readFile("apps/dashboard/package.json", "utf8")
);

const report = {
  generatedBy: "searchlint-dashboard-static-deployment-readiness-verifier",
  generatedAt: "2026-06-23T00:00:00.000Z",
  status: "passed",
  scope: {
    proofType:
      "deterministic static production dashboard deployment readiness proof",
    doesNotClaim: [
      "real S3 bucket creation",
      "real CloudFront distribution deployment",
      "production dashboard asset upload",
      "deployed dashboard URL browser acceptance",
      "live Cognito/API/Stripe/Google/Yandex dashboard behavior"
    ]
  },
  commands: commandResults,
  dashboardPackage: {
    name: dashboardPackage.name,
    private: dashboardPackage.private,
    browserAssets: dashboardPackage.searchlint?.dashboardBrowserAssets ?? null
  },
  staticHostingTemplate: {
    path: "infra/aws/dashboard-static-hosting.cloudformation.json",
    resources: Object.fromEntries(
      Object.entries(template.Resources ?? {}).map(([name, resource]) => [
        name,
        resource.Type
      ])
    ),
    outputs: Object.keys(template.Outputs ?? {}).sort()
  },
  assertions: [
    "Dashboard package builds before deployment readiness is reported.",
    "Generated browser assets are verified before static deployment readiness is reported.",
    "Hosted/local browser load, bundle load, route-flow, accessibility, and visual verifiers pass.",
    "AWS IaC verifier validates the dashboard S3/CloudFront static hosting template.",
    "The readiness report explicitly does not claim a live production deployment."
  ],
  remainingReleaseGates: [
    "Deploy the dashboard static hosting template to an AWS account.",
    "Upload the generated dashboard index.html and assets to the private dashboard S3 bucket.",
    "Run browser E2E against the real CloudFront dashboard base URL.",
    "Verify live Cognito auth and live Cloud API requests from the deployed dashboard.",
    "Run external accessibility review and production visual regression."
  ]
};

await mkdir(path.dirname(reportPath), { recursive: true });
await mkdir(path.dirname(samplePath), { recursive: true });
await writeJson(reportPath, report);
await writeJson(samplePath, report);

console.log(
  `Dashboard static deployment readiness PASS: ${commandResults.length}/${commands.length} command groups passed`
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
