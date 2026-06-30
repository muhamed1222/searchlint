#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { format } from "prettier";

const reportPath = "reports/dashboard-api-connection-static-report.json";
const samplePath =
  "docs/examples/dashboard-api-connection-static-report.sample.json";

const commands = [
  {
    name: "apiBuild",
    command: "pnpm",
    args: ["--filter", "@searchlint/api", "build"]
  },
  {
    name: "dashboardBuild",
    command: "pnpm",
    args: ["--filter", "@searchlint/dashboard", "build"]
  },
  {
    name: "apiUnitTests",
    command: "pnpm",
    args: ["--filter", "@searchlint/api", "test"]
  },
  {
    name: "dashboardUnitTests",
    command: "pnpm",
    args: ["--filter", "@searchlint/dashboard", "test"]
  },
  {
    name: "backendApiAcceptance",
    command: "node",
    args: ["scripts/verify-backend-api-acceptance.mjs"]
  },
  {
    name: "hostedRouteFlows",
    command: "node",
    args: ["scripts/verify-dashboard-hosted-route-flows.mjs"]
  }
];

const commandResults = commands.map(runCommand);
const dashboardModule = await import("../apps/dashboard/dist/src/index.js");
const apiModule = await import("../services/api/dist/src/index.js");

const dashboardActions = [
  "createProject",
  "createEnvironment",
  "getDashboardSnapshot",
  "requestCrawl",
  "addMember",
  "startExternalProviderOAuthConnection",
  "completeExternalProviderOAuthConnection"
];

const requests = dashboardActions.map((action) =>
  dashboardModule.createDashboardApiRequest(
    action,
    {
      organizationId: "org 1",
      projectId: "project/1",
      environmentId: "env?1",
      provider: "google"
    },
    bodyForAction(action)
  )
);

for (const request of requests) {
  const contract = apiModule.routeContractForOperation(request.operation);
  assertEqual(request.method, contract.method, `${request.action} method`);
  assertEqual(request.apiVersion, "v1", `${request.action} api version`);
  assertEqual(request.stability, "stable", `${request.action} stability`);
  assertEqual(
    request.requestSchemaVersion,
    contract.requestSchemaVersion,
    `${request.action} request schema`
  );
  assertEqual(
    request.responseSchemaVersion,
    contract.responseSchemaVersion,
    `${request.action} response schema`
  );
  assert(
    request.path.startsWith("/v1/"),
    `${request.action} must target a v1 API path`
  );
}

const dashboardSnapshotRequest = requests.find(
  (request) => request.action === "getDashboardSnapshot"
);
assert(dashboardSnapshotRequest, "dashboard snapshot request must exist");
assertEqual(
  dashboardSnapshotRequest.method,
  "GET",
  "dashboard snapshot request must be GET"
);
assertEqual(
  dashboardSnapshotRequest.body,
  undefined,
  "dashboard snapshot request must not include a body"
);

const fetchCalls = [];
const transport = dashboardModule.createDashboardApiFetchTransport({
  baseUrl: "https://api.searchlint.example",
  accessToken: "static-readiness-token",
  headers: {
    "x-searchlint-dashboard-deployment": "static-readiness"
  },
  fetch: async (url, init) => {
    fetchCalls.push({ url, init });
    return {
      status: 200,
      headers: {
        get(name) {
          return name.toLowerCase() === "content-type"
            ? "application/json"
            : null;
        }
      },
      async json() {
        return {
          ok: true,
          source: "static-readiness"
        };
      },
      async text() {
        return JSON.stringify({
          ok: true,
          source: "static-readiness"
        });
      }
    };
  }
});
await transport(dashboardSnapshotRequest);
assertEqual(fetchCalls.length, 1, "fetch transport must perform one request");
const fetchCall = fetchCalls[0];
assertEqual(
  fetchCall.url,
  "https://api.searchlint.example/v1/organizations/org%201/projects/project%2F1/environments/env%3F1/dashboard-snapshot",
  "dashboard snapshot fetch URL"
);
assertEqual(fetchCall.init.method, "GET", "fetch method");
assertEqual(
  fetchCall.init.headers.authorization,
  "Bearer static-readiness-token",
  "fetch authorization header"
);
assertEqual(
  fetchCall.init.headers["x-searchlint-operation"],
  "getDashboardSnapshot",
  "fetch operation header"
);
assertEqual(
  fetchCall.init.headers["x-searchlint-dashboard-action"],
  "getDashboardSnapshot",
  "fetch dashboard action header"
);
assertEqual(
  fetchCall.init.headers["x-searchlint-request-schema"],
  "cloud.getDashboardSnapshot.v1",
  "fetch request schema header"
);
assert(
  !("content-type" in fetchCall.init.headers),
  "GET dashboard snapshot requests must not send content-type"
);

const apiContracts = requests.map((request) => {
  const contract = apiModule.routeContractForOperation(request.operation);
  return {
    action: request.action,
    operation: request.operation,
    method: contract.method,
    path: contract.path,
    permission: contract.permission ?? null,
    apiVersion: contract.apiVersion,
    stability: contract.stability,
    requestSchemaVersion: contract.requestSchemaVersion,
    responseSchemaVersion: contract.responseSchemaVersion
  };
});

const report = {
  generatedBy: "searchlint-dashboard-api-connection-static-verifier",
  generatedAt: "2026-06-23T00:00:00.000Z",
  status: "passed",
  scope: {
    proofType:
      "deterministic static dashboard-to-production-API connection readiness proof",
    doesNotClaim: [
      "deployed API Gateway URL",
      "deployed ECS/Fargate API runtime",
      "live RDS-backed dashboard snapshot data",
      "browser E2E against a real production API",
      "live Cognito authorization against the deployed API"
    ]
  },
  commands: commandResults,
  dashboardApiContracts: apiContracts,
  fetchTransportEvidence: {
    baseUrl: "https://api.searchlint.example",
    requestUrl: fetchCall.url,
    method: fetchCall.init.method,
    headers: {
      authorization: "Bearer <redacted>",
      "x-searchlint-api-version":
        fetchCall.init.headers["x-searchlint-api-version"],
      "x-searchlint-operation":
        fetchCall.init.headers["x-searchlint-operation"],
      "x-searchlint-dashboard-action":
        fetchCall.init.headers["x-searchlint-dashboard-action"],
      "x-searchlint-request-schema":
        fetchCall.init.headers["x-searchlint-request-schema"],
      "x-searchlint-response-schema":
        fetchCall.init.headers["x-searchlint-response-schema"]
    },
    sendsJsonBody: fetchCall.init.body !== undefined
  },
  assertions: [
    "Dashboard action requests are built from the checked Cloud API v1 route contracts.",
    "Dashboard API fetch transport sends bearer authorization and schema/version headers.",
    "getDashboardSnapshot uses GET and does not send a JSON body or content-type header.",
    "Backend API acceptance verifies the v1 route, OpenAPI, deployment, auth, rate-limit, and dashboard snapshot foundations.",
    "Hosted/local dashboard route-flow acceptance renders through the dashboard API client boundary."
  ],
  remainingReleaseGates: [
    "Deploy the API Gateway/ECS/Fargate runtime to AWS.",
    "Provide the real production API base URL to the deployed dashboard shell.",
    "Verify deployed dashboard requests against live Cognito and Cloud API.",
    "Verify RDS-backed dashboard snapshot data from the deployed API.",
    "Run production dashboard E2E against the live CloudFront and API URLs."
  ]
};

await mkdir(path.dirname(reportPath), { recursive: true });
await mkdir(path.dirname(samplePath), { recursive: true });
await writeJson(reportPath, report);
await writeJson(samplePath, report);

console.log(
  `Dashboard API connection static readiness PASS: ${commandResults.length}/${commands.length} command groups passed`
);
console.log(`Report: ${reportPath}`);
console.log(`Sample: ${samplePath}`);

function bodyForAction(action) {
  if (action === "createProject") {
    return { name: "Production Project", siteUrl: "https://example.com" };
  }
  if (action === "createEnvironment") {
    return { name: "Production", baseUrl: "https://example.com" };
  }
  if (action === "getDashboardSnapshot") {
    return undefined;
  }
  if (action === "requestCrawl") {
    return { maxUrls: 100 };
  }
  if (action === "addMember") {
    return { principalId: "principal-1", role: "developer" };
  }
  if (action === "startExternalProviderOAuthConnection") {
    return {
      state: "state-1",
      redirectUri: "https://app.searchlint.example/oauth/google/callback",
      scopes: ["webmasters.readonly"],
      codeChallenge: "challenge-1"
    };
  }
  if (action === "completeExternalProviderOAuthConnection") {
    return {
      code: "authorization-code",
      redirectUri: "https://app.searchlint.example/oauth/google/callback",
      codeVerifier: "verifier-1",
      scopes: ["webmasters.readonly"]
    };
  }
  throw new Error(`Unsupported dashboard action ${action}.`);
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

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}.`);
  }
}

async function writeJson(filePath, value) {
  const json = await format(`${JSON.stringify(value, null, 2)}\n`, {
    parser: "json"
  });
  await writeFile(filePath, json);
}
