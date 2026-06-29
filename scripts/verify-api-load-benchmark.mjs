#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const generatedAt = "2026-06-22T00:00:00.000Z";
const reportPath = path.join(
  repoRoot,
  "reports/api-load-benchmark-report.json"
);
const samplePath = path.join(
  repoRoot,
  "docs/examples/api-load-benchmark-report.sample.json"
);

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

async function main() {
  run("pnpm", [
    "--filter",
    "@searchlint/api",
    "test",
    "--",
    "api-load-benchmark.test.ts",
    "http-dispatcher.test.ts"
  ]);
  run("pnpm", ["--filter", "@searchlint/api", "build"]);

  const api = await import("../services/api/dist/src/index.js");
  const source = await readFile(
    path.join(repoRoot, "services/api/src/api-load-benchmark.ts"),
    "utf8"
  );
  const tests = await readFile(
    path.join(repoRoot, "services/api/test/api-load-benchmark.test.ts"),
    "utf8"
  );

  for (const phrase of [
    "runApiLoadBenchmark",
    "max-p95-duration-ms",
    "pathFingerprint"
  ]) {
    assert(
      source.includes(phrase),
      `API load benchmark source missing ${phrase}`
    );
  }
  for (const phrase of [
    "runs deterministic API request workloads",
    "reports unexpected status mismatches",
    "rejects invalid benchmark configuration"
  ]) {
    assert(
      tests.includes(phrase),
      `API load benchmark tests missing ${phrase}`
    );
  }

  const report = await api.runApiLoadBenchmark({
    name: "searchlint-local-cloud-api-v1-request-mix-load",
    application: createApplication(),
    requests: createBenchmarkRequests(),
    concurrency: 48,
    thresholds: {
      minRequests: 1500,
      minConcurrency: 32,
      maxUnexpectedErrorRate: 0,
      maxP95DurationMs: 35,
      minRouteOperations: 8
    }
  });

  assert(report.status === "passed", "API load benchmark must pass thresholds");
  assert(
    report.requestCount === 1500,
    "API load benchmark must run 1500 requests"
  );
  assert(
    report.unexpectedRequests === 0,
    "API load benchmark must have 0 unexpected requests"
  );
  assert(
    report.routeOperations.createOrganization > 0,
    "API load benchmark must cover createOrganization"
  );
  assert(
    report.routeOperations.requestCrawl > 0,
    "API load benchmark must cover requestCrawl"
  );
  assert(
    report.routeOperations.startExternalProviderOAuthConnection > 0,
    "API load benchmark must cover OAuth start"
  );
  assert(
    report.statusCounts["401"] > 0,
    "API load benchmark must cover auth rejection"
  );
  assert(
    JSON.stringify(report).includes("secret-load-token") === false,
    "API load benchmark report must not leak tokens"
  );
  assert(
    JSON.stringify(report).includes("Acme Load") === false,
    "API load benchmark report must not leak request bodies"
  );

  const output = {
    schemaVersion: 1,
    generatedBy: "searchlint-api-load-benchmark-verifier",
    generatedAt,
    status: "passed",
    methodology: {
      liveApiAccess: "not used by verifier",
      liveDatabaseAccess: "not used by verifier",
      scope: "local Cloud HTTP dispatcher request-mix load benchmark",
      tests: [
        "services/api/test/api-load-benchmark.test.ts",
        "services/api/test/http-dispatcher.test.ts"
      ],
      workload:
        "1500 deterministic SearchLint Cloud API v1 requests across stable route contracts, expected validation/auth paths, and bounded concurrency"
    },
    benchmark: report,
    remainingGates: [
      "real production API deployment",
      "live API Gateway/ECS/RDS load test with production-shaped dataset",
      "documented throughput, latency, and error thresholds for deployed cloud",
      "deployed CloudWatch metrics and alarms under API load",
      "DAST and penetration testing against deployed API"
    ]
  };

  await mkdir(path.dirname(reportPath), { recursive: true });
  await mkdir(path.dirname(samplePath), { recursive: true });
  await writeJson(reportPath, output);
  await writeJson(samplePath, output);

  console.log(
    `API load benchmark PASS: requests=${report.requestCount}, concurrency=${report.concurrency}, p95=${report.deterministicDurationMs.p95}ms`
  );
  console.log(`Report: ${path.relative(repoRoot, reportPath)}`);
  console.log(`Sample: ${path.relative(repoRoot, samplePath)}`);
}

function createBenchmarkRequests() {
  return Array.from({ length: 1500 }, (_, index) =>
    requestForIndex(index, `api-load-${String(index + 1).padStart(4, "0")}`)
  );
}

function requestForIndex(index, id) {
  const selector = index % 9;
  const common = {
    id,
    simulatedDurationMs: 5 + ((index * 7) % 29)
  };
  if (selector === 0) {
    return {
      ...common,
      method: "POST",
      path: "/v1/organizations",
      principal,
      body: { name: `Acme Load ${index}`, token: "secret-load-token" },
      expectedStatus: 201
    };
  }
  if (selector === 1) {
    return {
      ...common,
      method: "POST",
      path: "/v1/organizations/org-load/members",
      principal,
      body: { principalId: `member-${index}`, role: "developer" },
      expectedStatus: 200
    };
  }
  if (selector === 2) {
    return {
      ...common,
      method: "POST",
      path: "/v1/organizations/org-load/projects",
      principal,
      body: { name: `Project ${index}`, siteUrl: "https://example.test" },
      expectedStatus: 200
    };
  }
  if (selector === 3) {
    return {
      ...common,
      method: "POST",
      path: "/v1/organizations/org-load/projects/project-load/environments",
      principal,
      body: { name: "Production", baseUrl: "https://example.test" },
      expectedStatus: 200
    };
  }
  if (selector === 4) {
    return {
      ...common,
      method: "GET",
      path: "/v1/organizations/org-load/projects/project-load/environments/env-load/dashboard-snapshot",
      principal,
      expectedStatus: 200
    };
  }
  if (selector === 5) {
    return {
      ...common,
      method: "POST",
      path: "/v1/organizations/org-load/projects/project-load/environments/env-load/crawl-requests",
      principal,
      body: { maxUrls: 100 },
      expectedStatus: 200
    };
  }
  if (selector === 6) {
    return {
      ...common,
      method: "POST",
      path: "/v1/organizations/org-load/projects/project-load/environments/env-load/external-providers/google/oauth/start",
      principal,
      body: {
        state: `state-${index}`,
        redirectUri: "https://app.searchlint.example/oauth/google/callback"
      },
      expectedStatus: 200
    };
  }
  if (selector === 7) {
    return {
      ...common,
      method: "POST",
      path: "/v1/organizations/org-load/projects/project-load/environments/env-load/external-providers/yandex/oauth/callback",
      principal,
      body: {
        code: `code-${index}`,
        redirectUri: "https://app.searchlint.example/oauth/yandex/callback"
      },
      expectedStatus: 200
    };
  }
  return {
    ...common,
    method: "POST",
    path: "/v1/organizations",
    body: { name: "Unauthenticated" },
    expectedStatus: 401
  };
}

const principal = {
  id: "principal-load-test",
  externalSubject: "cognito|principal-load-test"
};

function createApplication() {
  return {
    async createOrganization(input) {
      return {
        organization: {
          id: "org-1",
          name: input.name,
          createdAt: "2026-06-22T00:00:00.000Z"
        },
        membership: {
          id: "membership-1",
          organizationId: "org-1",
          principalId: input.actor.id,
          role: "owner",
          createdAt: "2026-06-22T00:00:00.000Z"
        }
      };
    },
    async addMember(input) {
      return {
        id: "membership-1",
        organizationId: input.organizationId,
        principalId: input.principalId,
        role: input.role,
        createdAt: "2026-06-22T00:00:00.000Z"
      };
    },
    async createProject(input) {
      return {
        id: "project-1",
        organizationId: input.organizationId,
        name: input.name,
        siteUrl: input.siteUrl,
        createdAt: "2026-06-22T00:00:00.000Z"
      };
    },
    async createEnvironment(input) {
      return {
        id: "env-1",
        organizationId: input.organizationId,
        projectId: input.projectId,
        name: input.name,
        baseUrl: input.baseUrl,
        createdAt: "2026-06-22T00:00:00.000Z"
      };
    },
    async requestCrawl(input) {
      return {
        crawlRequest: {
          id: "crawl-1",
          organizationId: input.organizationId,
          projectId: input.projectId,
          environmentId: input.environmentId,
          requestedBy: input.actor.id,
          maxUrls: input.maxUrls,
          status: "queued",
          createdAt: "2026-06-22T00:00:00.000Z"
        },
        jobId: "job-1"
      };
    },
    async getDashboardSnapshot(input) {
      return {
        organization: { id: input.organizationId },
        project: { id: input.projectId },
        environment: { id: input.environmentId }
      };
    },
    async completeExternalProviderOAuthConnection(input) {
      return {
        oauthConnection: {
          id: "oauth-1",
          organizationId: input.organizationId,
          projectId: input.projectId,
          environmentId: input.environmentId,
          provider: input.provider
        }
      };
    },
    async startExternalProviderOAuthConnection(input) {
      return {
        provider: input.provider,
        authorizationUrl: `https://provider.example/${input.provider}/authorize`,
        state: input.state
      };
    }
  };
}

async function writeJson(filePath, data) {
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
