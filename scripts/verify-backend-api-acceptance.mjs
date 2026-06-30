#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { format } from "prettier";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const reportPath = path.join(
  repoRoot,
  "reports/backend-api-acceptance-report.json"
);
const samplePath = path.join(
  repoRoot,
  "docs/examples/backend-api-acceptance-report.sample.json"
);
const openApiPath = path.join(
  repoRoot,
  "specs/openapi/searchlint-cloud-api-v1.openapi.json"
);
const fixedGeneratedAt = "2026-06-22T00:00:00.000Z";

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    env: { ...process.env, ...options.env },
    encoding: "utf8",
    stdio: options.stdio ?? "pipe"
  });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function caseResult(id, status, evidence, notes = []) {
  return { id, status, evidence, notes };
}

async function readText(relativePath) {
  return readFile(path.join(repoRoot, relativePath), "utf8");
}

async function readJson(relativePath) {
  return JSON.parse(await readText(relativePath));
}

async function main() {
  run("pnpm", ["--filter", "@searchlint/api", "test"], { stdio: "inherit" });
  run("pnpm", ["--filter", "@searchlint/api", "build"], { stdio: "inherit" });

  const apiModule = await import("../services/api/dist/src/index.js");
  const routeContracts = apiModule.cloudHttpRouteContracts;
  const deploymentContract = apiModule.cloudApiDeploymentContract;
  const deploymentIssues =
    apiModule.validateCloudApiDeploymentContract(deploymentContract);
  assert(
    deploymentIssues.length === 0,
    "Cloud API deployment contract drifted."
  );

  const cases = [];
  assert(
    routeContracts.length >= 9,
    "Cloud API must expose current v1 route contracts."
  );
  for (const contract of routeContracts) {
    assert(contract.apiVersion === "v1", `${contract.operation} must be v1`);
    assert(
      contract.path.startsWith("/v1/"),
      `${contract.operation} must use /v1`
    );
    assert(
      contract.stability === "stable",
      `${contract.operation} must be stable`
    );
    assert(
      contract.requestSchemaVersion.endsWith(".v1"),
      `${contract.operation} request schema must be v1`
    );
    assert(
      contract.responseSchemaVersion.endsWith(".v1"),
      `${contract.operation} response schema must be v1`
    );
  }
  cases.push(
    caseResult("api-v1-route-contracts", "PASS", {
      routeCount: routeContracts.length,
      operations: routeContracts.map((contract) => contract.operation),
      version: "v1",
      stability: "stable"
    })
  );

  const openApi = createOpenApiSpec(routeContracts);
  const formattedOpenApi = await format(JSON.stringify(openApi), {
    parser: "json"
  });
  await mkdir(path.dirname(openApiPath), { recursive: true });
  let existingOpenApi = "";
  try {
    existingOpenApi = await readFile(openApiPath, "utf8");
  } catch {
    await writeFile(openApiPath, formattedOpenApi);
    existingOpenApi = formattedOpenApi;
  }
  if (existingOpenApi !== formattedOpenApi) {
    await writeFile(openApiPath, formattedOpenApi);
    throw new Error(
      "OpenAPI spec was out of date and has been regenerated. Re-run pnpm api:acceptance."
    );
  }
  cases.push(
    caseResult("openapi-v1-specification", "PASS", {
      spec: "specs/openapi/searchlint-cloud-api-v1.openapi.json",
      openapi: openApi.openapi,
      pathCount: Object.keys(openApi.paths).length,
      generatedFrom: "services/api/src/http-contracts.ts"
    })
  );

  assert(deploymentContract.ingress.kind === "aws-api-gateway-http-api");
  assert(deploymentContract.runtime.compute === "aws-ecs-fargate");
  assert(deploymentContract.runtime.nodeMajor === 24);
  assert(deploymentContract.runtime.serverAdapter === "node:http");
  assert(deploymentContract.runtime.healthCheckPath === "/healthz");
  assert(deploymentContract.rateLimit.store === "postgres");
  assert(deploymentContract.rateLimit.failClosed === true);
  const cloudFormation = await readJson(
    "infra/aws/cloud-api-ecs-fargate.cloudformation.json"
  );
  const resources = cloudFormation.Resources ?? {};
  for (const [name, type] of Object.entries({
    CloudApiHttpApi: "AWS::ApiGatewayV2::Api",
    CloudApiVpcLink: "AWS::ApiGatewayV2::VpcLink",
    CloudApiService: "AWS::ECS::Service",
    CloudApiTaskDefinition: "AWS::ECS::TaskDefinition",
    CloudApiDefaultRoute: "AWS::ApiGatewayV2::Route",
    CloudApiHealthRoute: "AWS::ApiGatewayV2::Route"
  })) {
    const resource = resources[name];
    assert(resource, `Cloud API template is missing ${name}`);
    assert(resource.Type === type, `${name} must be ${type}`);
  }
  assert(
    resources.CloudApiService.Properties?.NetworkConfiguration
      ?.AwsvpcConfiguration?.AssignPublicIp === "DISABLED",
    "Cloud API ECS service must not assign public IPs"
  );
  cases.push(
    caseResult("api-gateway-ecs-deployment-contract", "PASS", {
      ingress: deploymentContract.ingress.kind,
      compute: deploymentContract.runtime.compute,
      nodeMajor: deploymentContract.runtime.nodeMajor,
      serverAdapter: deploymentContract.runtime.serverAdapter,
      healthCheckPath: deploymentContract.runtime.healthCheckPath,
      rateLimitStore: deploymentContract.rateLimit.store,
      cloudFormation: "infra/aws/cloud-api-ecs-fargate.cloudformation.json"
    })
  );

  const nodeHttpServerSource = await readText(
    "services/api/src/node-http-server.ts"
  );
  for (const fragment of [
    "extractPrincipal",
    "RATE_LIMITED",
    "BODY_TOO_LARGE",
    "REQUEST_TIMEOUT",
    "METHOD_NOT_ALLOWED",
    "INVALID_JSON",
    "requestIdFromHeader",
    "requestController.abort"
  ]) {
    assert(
      nodeHttpServerSource.includes(fragment),
      `Node HTTP runtime must include ${fragment}`
    );
  }
  const nodeHttpTest = await readText(
    "services/api/test/node-http-server.test.ts"
  );
  for (const phrase of [
    "authenticates Cognito bearer tokens through the Node HTTP dispatcher path",
    "returns 401 for invalid Cognito bearer credentials before application dispatch",
    "returns 400 for invalid JSON before application dispatch",
    "returns 413 for oversized bodies before application dispatch",
    "returns 504 when dispatcher processing exceeds the configured timeout",
    "returns 429 for rate-limited requests before body parsing or application dispatch",
    "reuses incoming request IDs in structured request logs"
  ]) {
    assert(nodeHttpTest.includes(phrase), `Missing Node HTTP test: ${phrase}`);
  }
  cases.push(
    caseResult("node-http-runtime-security-controls", "PASS", {
      authenticationMiddleware: "Cognito bearer principal extractor",
      requestValidation: ["invalid JSON", "body size", "unsupported method"],
      rateLimiting: "pre-body parse fixed-window limiter",
      cancellation: "dispatch timeout aborts request controller",
      logging: "structured request logs with x-request-id"
    })
  );

  const apiTest = await readText("services/api/test/api.test.ts");
  for (const phrase of [
    "authorizationMatrix",
    "idempotencyKey",
    "auditEvents",
    "returns dashboard snapshots after project-read authorization and identity checks",
    "does not load dashboard snapshots when authorization or route identity checks fail",
    "queues authorized crawl work and records audit plus metrics",
    "records external API inspection usage with caller-provided idempotency",
    "records crawl diagnostics after authorization and crawl identity checks"
  ]) {
    assert(
      apiTest.includes(phrase),
      `Missing API application test evidence: ${phrase}`
    );
  }
  cases.push(
    caseResult("application-authz-idempotency-audit-controls", "PASS", {
      authorization: "RBAC authorization matrix and route identity checks",
      tenantIsolation: "organization/project/environment identity checks",
      idempotency: "caller-provided idempotency keys for metered usage",
      audit:
        "organization, crawl, diagnostic, OAuth, and billing paths append audit events"
    })
  );

  const httpDispatcherTest = await readText(
    "services/api/test/http-dispatcher.test.ts"
  );
  for (const phrase of [
    "returns 401 when principal is missing",
    "returns 400 for invalid request bodies before calling application code",
    "maps domain errors to deterministic HTTP responses",
    "rejects invalid external provider OAuth authorization start requests before application code",
    "rejects invalid external provider OAuth callback requests before application code"
  ]) {
    assert(
      httpDispatcherTest.includes(phrase),
      `Missing HTTP dispatcher evidence: ${phrase}`
    );
  }
  cases.push(
    caseResult("dispatcher-validation-and-error-contracts", "PASS", {
      unauthenticatedStatus: 401,
      invalidInputStatus: 400,
      entitlementDeniedStatus: 402,
      unsupportedRouteStatus: 404,
      deterministicErrorEnvelope: true
    })
  );

  const docs = await readText(
    "docs/BACKEND_API_DEPLOYMENT_SECURITY_ACCEPTANCE.md"
  );
  const normalizedDocs = docs.toLowerCase();
  for (const phrase of [
    "deterministic local/static acceptance",
    "real production deployment",
    "load testing",
    "security testing",
    "openapi",
    "api gateway",
    "ecs/fargate"
  ]) {
    assert(
      normalizedDocs.includes(phrase),
      `Backend API doc must include ${phrase}`
    );
  }
  cases.push(
    caseResult("backend-api-acceptance-documentation", "PASS", {
      document: "docs/BACKEND_API_DEPLOYMENT_SECURITY_ACCEPTANCE.md",
      productionDeploymentClaimed: false,
      remainingRuntimeGatesDocumented: true
    })
  );

  const report = {
    schemaVersion: 1,
    summary: {
      status: "PASS",
      generatedAt: fixedGeneratedAt,
      nodeVersion: process.version,
      caseCount: cases.length,
      passed: cases.length,
      failed: 0
    },
    cases,
    limitations: [
      "This verifier checks deterministic API package tests, route/deployment contracts, checked OpenAPI, CloudFormation shape, and documentation.",
      "It does not deploy API Gateway, ECS/Fargate, RDS, Cognito, or Stripe resources.",
      "It does not perform real load testing, DAST, penetration testing, or live production API acceptance."
    ],
    remainingRuntimeGates: [
      "Deploy production API Gateway and ECS/Fargate service.",
      "Run live API smoke tests against deployed API base URL.",
      "Run PostgreSQL-backed integration proof against deployed RDS.",
      "Run load testing with documented thresholds.",
      "Run DAST and penetration testing.",
      "Record API Gateway/ECS/CloudWatch deployment evidence."
    ]
  };

  await mkdir(path.dirname(reportPath), { recursive: true });
  await mkdir(path.dirname(samplePath), { recursive: true });
  const formattedReport = await format(JSON.stringify(report), {
    parser: "json"
  });
  await writeFile(reportPath, formattedReport);
  await writeFile(samplePath, formattedReport);

  console.log(
    `Backend API acceptance ${report.summary.status}: ${report.summary.passed}/${report.summary.caseCount} cases passed`
  );
  console.log(`OpenAPI: ${path.relative(repoRoot, openApiPath)}`);
  console.log(`Report: ${path.relative(repoRoot, reportPath)}`);
  console.log(`Sample: ${path.relative(repoRoot, samplePath)}`);
}

function createOpenApiSpec(routeContracts) {
  const paths = {};
  for (const contract of routeContracts) {
    const openApiPath = contract.path.replaceAll(
      /\{([A-Za-z0-9_]+)\}/gu,
      "{$1}"
    );
    const method = contract.method.toLowerCase();
    const parameters = [...contract.path.matchAll(/\{([^}]+)\}/gu)].map(
      (match) => ({
        name: match[1],
        in: "path",
        required: true,
        schema: { type: "string" }
      })
    );
    paths[openApiPath] ??= {};
    paths[openApiPath][method] = {
      operationId: contract.operation,
      summary: contract.operation,
      tags: [tagForOperation(contract.operation)],
      "x-searchlint-api-version": contract.apiVersion,
      "x-searchlint-stability": contract.stability,
      "x-searchlint-request-schema-version": contract.requestSchemaVersion,
      "x-searchlint-response-schema-version": contract.responseSchemaVersion,
      ...(parameters.length === 0 ? {} : { parameters }),
      ...(contract.method === "GET"
        ? {}
        : {
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: {
                    $ref: `#/components/schemas/${schemaName(
                      contract.requestSchemaVersion
                    )}`
                  }
                }
              }
            }
          }),
      responses: {
        200: response(contract.responseSchemaVersion),
        201: response(contract.responseSchemaVersion),
        202: response(contract.responseSchemaVersion),
        400: errorResponse(),
        401: errorResponse(),
        402: errorResponse(),
        403: errorResponse(),
        404: errorResponse(),
        405: errorResponse(),
        413: errorResponse(),
        429: errorResponse(),
        504: errorResponse()
      }
    };
  }

  return {
    openapi: "3.1.0",
    info: {
      title: "SearchLint Cloud API",
      version: "1.0.0-beta.0",
      description:
        "Versioned SearchLint Cloud API contract generated from checked route contracts."
    },
    servers: [
      {
        url: "https://api.searchlint.example/v1",
        description: "Placeholder production API base URL pending deployment."
      }
    ],
    paths,
    components: {
      securitySchemes: {
        cognitoBearer: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT"
        },
        stripeSignature: {
          type: "apiKey",
          in: "header",
          name: "stripe-signature"
        }
      },
      parameters: {
        PaginationFirst: {
          name: "first",
          in: "query",
          required: false,
          schema: {
            type: "integer",
            minimum: 1,
            maximum: 100,
            default: 25
          }
        },
        PaginationAfter: {
          name: "after",
          in: "query",
          required: false,
          schema: {
            type: "string",
            minLength: 1
          }
        }
      },
      schemas: Object.fromEntries([
        ...uniqueSchemaVersions(routeContracts).map((version) => [
          schemaName(version),
          {
            type: "object",
            additionalProperties: true,
            description: `Schema placeholder for ${version}; canonical field validation lives in typed API contracts and tests.`
          }
        ]),
        [
          "PageInfo",
          {
            type: "object",
            required: ["hasNextPage"],
            properties: {
              hasNextPage: { type: "boolean" },
              endCursor: { type: "string" }
            }
          }
        ]
      ])
    }
  };
}

function uniqueSchemaVersions(routeContracts) {
  return [
    ...new Set(
      routeContracts.flatMap((contract) => [
        contract.requestSchemaVersion,
        contract.responseSchemaVersion
      ])
    )
  ].sort();
}

function schemaName(version) {
  return version
    .split(".")
    .map((part) => part.replace(/[^A-Za-z0-9]/gu, ""))
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join("");
}

function response(schemaVersion) {
  return {
    description: schemaVersion,
    content: {
      "application/json": {
        schema: {
          $ref: `#/components/schemas/${schemaName(schemaVersion)}`
        }
      }
    }
  };
}

function errorResponse() {
  return {
    description: "Deterministic error envelope",
    content: {
      "application/json": {
        schema: {
          $ref: "#/components/schemas/CloudErrorEnvelope"
        }
      }
    }
  };
}

function tagForOperation(operation) {
  if (operation.includes("OAuth")) {
    return "External provider OAuth";
  }
  if (operation.includes("Stripe")) {
    return "Billing";
  }
  if (operation.includes("Crawl")) {
    return "Crawls";
  }
  if (operation.includes("Dashboard")) {
    return "Dashboard";
  }
  return "Core";
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
