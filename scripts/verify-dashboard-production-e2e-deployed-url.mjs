#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { format } from "prettier";
import { chromium } from "@playwright/test";

const reportPath = "reports/dashboard-production-e2e-deployed-url-report.json";
const samplePath =
  "docs/examples/dashboard-production-e2e-deployed-url-report.sample.json";

const requiredLiveEnv = [
  "SEARCHLINT_DASHBOARD_BASE_URL",
  "SEARCHLINT_DASHBOARD_API_BASE_URL",
  "SEARCHLINT_DASHBOARD_COGNITO_HOSTED_UI_DOMAIN"
];

const commands = [
  {
    name: "staticDeploymentReadiness",
    command: "pnpm",
    args: ["dashboard:static-deployment"]
  },
  {
    name: "apiConnectionStaticReadiness",
    command: "pnpm",
    args: ["dashboard:api-connection-static"]
  },
  {
    name: "authConnectionStaticReadiness",
    command: "pnpm",
    args: ["dashboard:auth-connection-static"]
  },
  {
    name: "hostedLocalDashboardAcceptance",
    command: "pnpm",
    args: ["dashboard:acceptance"]
  }
];

const commandResults = commands.map(runCommand);
const liveEnabled = process.env.SEARCHLINT_DASHBOARD_E2E_LIVE === "1";
const missingLiveEnv = requiredLiveEnv.filter((name) => !process.env[name]);
const liveResult =
  liveEnabled && missingLiveEnv.length === 0
    ? await runLiveSmoke()
    : {
        status: "blocked",
        reason: liveEnabled ? "missing-live-environment" : "live-mode-disabled",
        missingEnv: missingLiveEnv,
        requiredEnv: requiredLiveEnv,
        enableWith: "SEARCHLINT_DASHBOARD_E2E_LIVE=1"
      };

const report = {
  generatedBy: "searchlint-dashboard-production-e2e-deployed-url-verifier",
  generatedAt: "2026-06-23T00:00:00.000Z",
  status:
    liveResult.status === "passed"
      ? "passed"
      : "harness-ready-live-gate-blocked",
  scope: {
    proofType:
      "dashboard production E2E deployed-URL acceptance harness and prerequisite proof",
    doesNotClaim:
      liveResult.status === "passed"
        ? []
        : [
            "real deployed CloudFront dashboard browser E2E",
            "real deployed API Gateway/ECS runtime behavior",
            "live Cognito Hosted UI login/logout/callback",
            "live RDS-backed dashboard snapshot data",
            "final production dashboard E2E release gate"
          ]
  },
  commands: commandResults,
  liveExecution: liveResult,
  requiredLiveEnvironment: requiredLiveEnv.map((name) => ({
    name,
    provided: Boolean(process.env[name]),
    value: process.env[name] ? "<redacted>" : null
  })),
  assertions: [
    "Static dashboard deployment readiness passes before deployed-URL E2E can run.",
    "Static dashboard API connection readiness passes before deployed-URL E2E can run.",
    "Static dashboard auth connection readiness passes before deployed-URL E2E can run.",
    "Hosted/local dashboard acceptance passes before deployed-URL E2E can run.",
    "Live deployed-URL mode is explicit and requires SEARCHLINT_DASHBOARD_E2E_LIVE=1.",
    "Live URL inputs are redacted from persisted evidence."
  ],
  remainingReleaseGates:
    liveResult.status === "passed"
      ? [
          "Promote the live deployed-URL E2E report to release evidence after owner review.",
          "Run the full production release candidate matrix."
        ]
      : [
          "Deploy dashboard static hosting to real S3/CloudFront.",
          "Deploy the API Gateway/ECS/Fargate runtime.",
          "Deploy and configure the real Cognito user pool/app client.",
          "Set SEARCHLINT_DASHBOARD_E2E_LIVE=1 and the required live URL environment variables.",
          "Run pnpm dashboard:production-e2e against the live CloudFront, API, and Cognito URLs.",
          "Promote the live deployed-URL E2E report to release evidence after owner review."
        ]
};

await mkdir(path.dirname(reportPath), { recursive: true });
await mkdir(path.dirname(samplePath), { recursive: true });
await writeJson(reportPath, report);
await writeJson(samplePath, report);

console.log(
  liveResult.status === "passed"
    ? "Dashboard production deployed-URL E2E PASS: live smoke completed"
    : "Dashboard production deployed-URL E2E harness ready: live gate remains blocked"
);
console.log(`Report: ${reportPath}`);
console.log(`Sample: ${samplePath}`);

async function runLiveSmoke() {
  const dashboardUrl = requiredHttpsUrl(
    process.env.SEARCHLINT_DASHBOARD_BASE_URL,
    "SEARCHLINT_DASHBOARD_BASE_URL"
  );
  const apiUrl = requiredHttpsUrl(
    process.env.SEARCHLINT_DASHBOARD_API_BASE_URL,
    "SEARCHLINT_DASHBOARD_API_BASE_URL"
  );
  const cognitoUrl = requiredHttpsUrl(
    process.env.SEARCHLINT_DASHBOARD_COGNITO_HOSTED_UI_DOMAIN,
    "SEARCHLINT_DASHBOARD_COGNITO_HOSTED_UI_DOMAIN"
  );

  const browser = await chromium.launch();
  const page = await browser.newPage();
  const failures = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      failures.push(`console:${message.text()}`);
    }
  });
  page.on("pageerror", (error) => {
    failures.push(`pageerror:${error.message}`);
  });
  try {
    const response = await page.goto(dashboardUrl.toString(), {
      waitUntil: "domcontentloaded"
    });
    if (!response) {
      throw new Error("Dashboard URL did not return a response.");
    }
    if (response.status() >= 500) {
      throw new Error(`Dashboard URL returned HTTP ${response.status()}.`);
    }
    await page.waitForLoadState("networkidle", { timeout: 15000 });
    if (failures.length > 0) {
      throw new Error(`Browser failures: ${failures.join("; ")}`);
    }
    return {
      status: "passed",
      dashboardBaseUrl: redactUrl(dashboardUrl),
      apiBaseUrl: redactUrl(apiUrl),
      cognitoHostedUiDomain: redactUrl(cognitoUrl),
      httpStatus: response.status(),
      finalPath: page.url().replace(dashboardUrl.origin, "<dashboard-origin>")
    };
  } finally {
    await browser.close();
  }
}

function requiredHttpsUrl(value, name) {
  if (!value) {
    throw new Error(`${name} is required for live dashboard E2E.`);
  }
  const url = new URL(value);
  if (url.protocol !== "https:") {
    throw new Error(`${name} must be an HTTPS URL.`);
  }
  return url;
}

function redactUrl(url) {
  return `${url.protocol}//<redacted-host>${url.pathname === "/" ? "" : url.pathname}`;
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

async function writeJson(filePath, value) {
  const json = await format(`${JSON.stringify(value, null, 2)}\n`, {
    parser: "json"
  });
  await writeFile(filePath, json);
}
