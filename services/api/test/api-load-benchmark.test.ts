import { describe, expect, it } from "vitest";

import { runApiLoadBenchmark } from "../src/index.js";
import type {
  ApiLoadBenchmarkRequest,
  CloudHttpApplication,
  Principal,
  RequestCrawlInput
} from "../src/index.js";

const principal: Principal = {
  id: "principal-load-test",
  externalSubject: "cognito|principal-load-test"
};

describe("runApiLoadBenchmark", () => {
  it("runs deterministic API request workloads with concurrency and threshold evidence", async () => {
    const report = await runApiLoadBenchmark({
      name: "unit-api-load",
      application: createApplication(),
      requests: createRequests(80),
      concurrency: 8,
      thresholds: {
        minRequests: 80,
        minConcurrency: 8,
        maxUnexpectedErrorRate: 0,
        maxP95DurationMs: 20,
        minRouteOperations: 6
      }
    });

    expect(report.status).toBe("passed");
    expect(report.requestCount).toBe(80);
    expect(report.unexpectedRequests).toBe(0);
    expect(report.routeOperations).toEqual(
      expect.objectContaining({
        addMember: expect.any(Number),
        createEnvironment: expect.any(Number),
        createOrganization: expect.any(Number),
        createProject: expect.any(Number),
        getDashboardSnapshot: expect.any(Number),
        requestCrawl: expect.any(Number)
      })
    );
    expect(report.statusCounts).toEqual(
      expect.objectContaining({
        "200": expect.any(Number),
        "201": expect.any(Number),
        "401": expect.any(Number)
      })
    );
    expect(report.deterministicDurationMs).toEqual(
      expect.objectContaining({
        p50: expect.any(Number),
        p95: expect.any(Number),
        max: expect.any(Number)
      })
    );
    expect(report.requests[0]?.pathFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(report)).not.toContain("secret-load-token");
    expect(JSON.stringify(report)).not.toContain("Acme Load");
  });

  it("reports unexpected status mismatches without leaking request bodies", async () => {
    const report = await runApiLoadBenchmark({
      name: "failed-api-load",
      application: createApplication(),
      requests: [
        {
          id: "wrong-status",
          method: "POST",
          path: "/v1/organizations",
          principal,
          body: {
            name: "Secret Organization"
          },
          expectedStatus: 200,
          simulatedDurationMs: 5
        }
      ],
      concurrency: 1,
      thresholds: {
        minRequests: 1,
        minConcurrency: 1,
        maxUnexpectedErrorRate: 0,
        maxP95DurationMs: 10,
        minRouteOperations: 1
      }
    });

    expect(report.status).toBe("failed");
    expect(report.unexpectedRequests).toBe(1);
    expect(report.requests[0]).toEqual(
      expect.objectContaining({
        id: "wrong-status",
        routeOperation: "createOrganization",
        expectedStatus: 200,
        actualStatus: 201,
        status: "unexpected"
      })
    );
    expect(JSON.stringify(report)).not.toContain("Secret Organization");
  });

  it("rejects invalid benchmark configuration", async () => {
    await expect(
      runApiLoadBenchmark({
        name: "",
        application: createApplication(),
        requests: [],
        concurrency: 0,
        thresholds: {
          minRequests: 1,
          minConcurrency: 1,
          maxUnexpectedErrorRate: 0,
          maxP95DurationMs: 10,
          minRouteOperations: 1
        }
      })
    ).rejects.toThrow("API load benchmark name is required.");

    await expect(
      runApiLoadBenchmark({
        name: "duplicate",
        application: createApplication(),
        requests: [
          {
            id: "same",
            method: "POST",
            path: "/v1/organizations",
            principal,
            body: { name: "A" },
            expectedStatus: 201,
            simulatedDurationMs: 1
          },
          {
            id: "same",
            method: "POST",
            path: "/v1/organizations",
            principal,
            body: { name: "B" },
            expectedStatus: 201,
            simulatedDurationMs: 1
          }
        ],
        concurrency: 1,
        thresholds: {
          minRequests: 1,
          minConcurrency: 1,
          maxUnexpectedErrorRate: 0,
          maxP95DurationMs: 10,
          minRouteOperations: 1
        }
      })
    ).rejects.toThrow("Duplicate API load benchmark request id: same.");
  });
});

function createRequests(count: number): ApiLoadBenchmarkRequest[] {
  return Array.from({ length: count }, (_, index) =>
    requestForIndex(index, `unit-${String(index + 1).padStart(4, "0")}`)
  );
}

function requestForIndex(index: number, id: string): ApiLoadBenchmarkRequest {
  const selector = index % 7;
  const common = {
    id,
    simulatedDurationMs: 4 + ((index * 5) % 17)
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
  return {
    ...common,
    method: "POST",
    path: "/v1/organizations",
    body: { name: "Unauthenticated" },
    expectedStatus: 401
  };
}

function createApplication(): CloudHttpApplication {
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
    async requestCrawl(input: RequestCrawlInput) {
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
