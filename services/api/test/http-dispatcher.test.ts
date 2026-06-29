import { describe, expect, it } from "vitest";

import {
  CloudApiError,
  createCloudHttpDispatcher,
  matchCloudRoute
} from "../src/index.js";
import type {
  CloudHttpApplication,
  CompleteExternalProviderOAuthConnectionInput,
  GetDashboardSnapshotInput,
  Principal,
  RequestCrawlInput,
  StartExternalProviderOAuthConnectionInput
} from "../src/index.js";

const principal: Principal = {
  id: "principal-1",
  externalSubject: "cognito|principal-1"
};

describe("matchCloudRoute", () => {
  it("matches method, versioned path, and route params", () => {
    expect(
      matchCloudRoute(
        "POST",
        "/v1/organizations/org-1/projects/project-1/environments/env-1/crawl-requests"
      )
    ).toEqual({
      operation: "requestCrawl",
      params: {
        organizationId: "org-1",
        projectId: "project-1",
        environmentId: "env-1"
      }
    });
  });

  it("does not match unsupported methods or paths", () => {
    expect(matchCloudRoute("GET", "/v1/organizations")).toBeUndefined();
    expect(matchCloudRoute("POST", "/v2/organizations")).toBeUndefined();
  });
});

describe("createCloudHttpDispatcher", () => {
  it("dispatches createOrganization with authenticated principal", async () => {
    const dispatcher = createCloudHttpDispatcher(createApplication());
    const response = await dispatcher({
      method: "POST",
      path: "/v1/organizations",
      principal,
      body: {
        name: "Acme"
      }
    });

    expect(response).toEqual({
      status: 201,
      body: {
        organization: {
          id: "org-1",
          name: "Acme",
          createdAt: "2026-06-21T00:00:00.000Z"
        },
        membership: {
          id: "membership-1",
          organizationId: "org-1",
          principalId: principal.id,
          role: "owner",
          createdAt: "2026-06-21T00:00:00.000Z"
        }
      }
    });
  });

  it("returns 401 when principal is missing", async () => {
    const dispatcher = createCloudHttpDispatcher(createApplication());

    await expect(
      dispatcher({
        method: "POST",
        path: "/v1/organizations",
        body: { name: "Acme" }
      })
    ).resolves.toMatchObject({
      status: 401,
      body: {
        error: {
          code: "UNAUTHENTICATED"
        }
      }
    });
  });

  it("returns 400 for invalid request bodies before calling application code", async () => {
    const calls: string[] = [];
    const dispatcher = createCloudHttpDispatcher(
      createApplication({
        onCreateProject() {
          calls.push("createProject");
        }
      })
    );
    const response = await dispatcher({
      method: "POST",
      path: "/v1/organizations/org-1/projects",
      principal,
      body: {
        name: "Marketing"
      }
    });

    expect(response).toMatchObject({
      status: 400,
      body: {
        error: {
          code: "INVALID_INPUT",
          message: "siteUrl must be a non-empty string."
        }
      }
    });
    expect(calls).toEqual([]);
  });

  it("maps domain errors to deterministic HTTP responses", async () => {
    const dispatcher = createCloudHttpDispatcher(
      createApplication({
        async requestCrawl() {
          throw new CloudApiError(
            "ENTITLEMENT_DENIED",
            "monthly crawl URL quota exceeded"
          );
        }
      })
    );
    const response = await dispatcher({
      method: "POST",
      path: "/v1/organizations/org-1/projects/project-1/environments/env-1/crawl-requests",
      principal,
      body: {
        maxUrls: 500
      }
    });

    expect(response).toEqual({
      status: 402,
      body: {
        error: {
          code: "ENTITLEMENT_DENIED",
          message: "monthly crawl URL quota exceeded"
        }
      }
    });
  });

  it("dispatches crawl requests with route params and body fields", async () => {
    let received: RequestCrawlInput | undefined;
    const dispatcher = createCloudHttpDispatcher(
      createApplication({
        async requestCrawl(input) {
          received = input;
          return {
            crawlRequest: {
              id: "crawl-1",
              organizationId: input.organizationId,
              projectId: input.projectId,
              environmentId: input.environmentId,
              requestedBy: input.actor.id,
              maxUrls: input.maxUrls,
              status: "queued",
              createdAt: "2026-06-21T00:00:00.000Z"
            },
            jobId: "job-1"
          };
        }
      })
    );
    const response = await dispatcher({
      method: "POST",
      path: "/v1/organizations/org-1/projects/project-1/environments/env-1/crawl-requests",
      principal,
      body: {
        maxUrls: 500
      }
    });

    expect(received).toMatchObject({
      actor: principal,
      organizationId: "org-1",
      projectId: "project-1",
      environmentId: "env-1",
      maxUrls: 500
    });
    expect(response).toMatchObject({
      status: 200,
      body: {
        jobId: "job-1"
      }
    });
  });

  it("dispatches dashboard snapshot requests with route params and no body requirement", async () => {
    let received: GetDashboardSnapshotInput | undefined;
    const dispatcher = createCloudHttpDispatcher(
      createApplication({
        async getDashboardSnapshot(input) {
          received = input;
          return {
            organization: {
              id: input.organizationId
            },
            project: {
              id: input.projectId
            },
            environment: {
              id: input.environmentId
            }
          };
        }
      })
    );
    const response = await dispatcher({
      method: "GET",
      path: "/v1/organizations/org-1/projects/project-1/environments/env-1/dashboard-snapshot",
      principal
    });

    expect(received).toMatchObject({
      actor: principal,
      organizationId: "org-1",
      projectId: "project-1",
      environmentId: "env-1"
    });
    expect(response).toEqual({
      status: 200,
      body: {
        organization: {
          id: "org-1"
        },
        project: {
          id: "project-1"
        },
        environment: {
          id: "env-1"
        }
      }
    });
  });

  it("dispatches external provider OAuth callback completion requests", async () => {
    let received: CompleteExternalProviderOAuthConnectionInput | undefined;
    const dispatcher = createCloudHttpDispatcher(
      createApplication({
        async completeExternalProviderOAuthConnection(input) {
          received = input;
          return {
            oauthConnection: {
              id: "oauth-1",
              provider: input.provider,
              providerAccountId: "google-account-1"
            }
          };
        }
      })
    );
    const response = await dispatcher({
      method: "POST",
      path: "/v1/organizations/org-1/projects/project-1/environments/env-1/external-providers/google/oauth/callback",
      principal,
      body: {
        code: "authorization-code",
        redirectUri: "https://app.searchlint.example/oauth/google/callback",
        codeVerifier: "pkce-verifier",
        scopes: ["scope-a", "scope-b"]
      }
    });

    expect(received).toMatchObject({
      actor: principal,
      organizationId: "org-1",
      projectId: "project-1",
      environmentId: "env-1",
      provider: "google",
      code: "authorization-code",
      redirectUri: "https://app.searchlint.example/oauth/google/callback",
      codeVerifier: "pkce-verifier",
      scopes: ["scope-a", "scope-b"]
    });
    expect(response).toEqual({
      status: 200,
      body: {
        oauthConnection: {
          id: "oauth-1",
          provider: "google",
          providerAccountId: "google-account-1"
        }
      }
    });
  });

  it("dispatches external provider OAuth authorization start requests", async () => {
    let received: StartExternalProviderOAuthConnectionInput | undefined;
    const dispatcher = createCloudHttpDispatcher(
      createApplication({
        async startExternalProviderOAuthConnection(input) {
          received = input;
          return {
            provider: input.provider,
            authorizationUrl: `https://provider.example/${input.provider}/authorize`,
            state: input.state,
            redirectUri: input.redirectUri,
            scopes: input.scopes,
            pkceRequired: input.codeChallenge !== undefined
          };
        }
      })
    );
    const response = await dispatcher({
      method: "POST",
      path: "/v1/organizations/org-1/projects/project-1/environments/env-1/external-providers/yandex/oauth/start",
      principal,
      body: {
        state: "state-123",
        redirectUri: "https://app.searchlint.example/oauth/yandex/callback",
        scopes: ["webmaster:read", "metrika:read"],
        codeChallenge: "pkce-challenge"
      }
    });

    expect(received).toMatchObject({
      actor: principal,
      organizationId: "org-1",
      projectId: "project-1",
      environmentId: "env-1",
      provider: "yandex",
      state: "state-123",
      redirectUri: "https://app.searchlint.example/oauth/yandex/callback",
      scopes: ["webmaster:read", "metrika:read"],
      codeChallenge: "pkce-challenge"
    });
    expect(response).toEqual({
      status: 200,
      body: {
        provider: "yandex",
        authorizationUrl: "https://provider.example/yandex/authorize",
        state: "state-123",
        redirectUri: "https://app.searchlint.example/oauth/yandex/callback",
        scopes: ["webmaster:read", "metrika:read"],
        pkceRequired: true
      }
    });
  });

  it("rejects invalid external provider OAuth authorization start requests before application code", async () => {
    const calls: string[] = [];
    const dispatcher = createCloudHttpDispatcher(
      createApplication({
        async startExternalProviderOAuthConnection() {
          calls.push("startExternalProviderOAuthConnection");
          return {};
        }
      })
    );

    await expect(
      dispatcher({
        method: "POST",
        path: "/v1/organizations/org-1/projects/project-1/environments/env-1/external-providers/google/oauth/start",
        principal,
        body: {
          redirectUri: "https://app.searchlint.example/oauth/google/callback"
        }
      })
    ).resolves.toMatchObject({
      status: 400,
      body: {
        error: {
          code: "INVALID_INPUT",
          message: "state must be a non-empty string."
        }
      }
    });

    await expect(
      dispatcher({
        method: "POST",
        path: "/v1/organizations/org-1/projects/project-1/environments/env-1/external-providers/bing/oauth/start",
        principal,
        body: {
          state: "state-123"
        }
      })
    ).resolves.toMatchObject({
      status: 400,
      body: {
        error: {
          code: "INVALID_INPUT",
          message: "provider is not supported."
        }
      }
    });
    expect(calls).toEqual([]);
  });

  it("rejects invalid external provider OAuth callback requests before application code", async () => {
    const calls: string[] = [];
    const dispatcher = createCloudHttpDispatcher(
      createApplication({
        async completeExternalProviderOAuthConnection() {
          calls.push("completeExternalProviderOAuthConnection");
          return {
            oauthConnection: {}
          };
        }
      })
    );

    await expect(
      dispatcher({
        method: "POST",
        path: "/v1/organizations/org-1/projects/project-1/environments/env-1/external-providers/bing/oauth/callback",
        principal,
        body: {
          code: "authorization-code",
          redirectUri: "https://app.searchlint.example/oauth/bing/callback"
        }
      })
    ).resolves.toMatchObject({
      status: 400,
      body: {
        error: {
          code: "INVALID_INPUT",
          message: "provider is not supported."
        }
      }
    });

    await expect(
      dispatcher({
        method: "POST",
        path: "/v1/organizations/org-1/projects/project-1/environments/env-1/external-providers/google/oauth/callback",
        principal,
        body: {
          code: "authorization-code",
          redirectUri: "https://app.searchlint.example/oauth/google/callback",
          scopes: ["scope-a", ""]
        }
      })
    ).resolves.toMatchObject({
      status: 400,
      body: {
        error: {
          code: "INVALID_INPUT",
          message: "scopes must be an array of non-empty strings."
        }
      }
    });
    expect(calls).toEqual([]);
  });
});

function createApplication(
  overrides: Partial<CloudHttpApplication> & {
    onCreateProject?: () => void;
  } = {}
): CloudHttpApplication {
  return {
    async createOrganization(input) {
      return {
        organization: {
          id: "org-1",
          name: input.name,
          createdAt: "2026-06-21T00:00:00.000Z"
        },
        membership: {
          id: "membership-1",
          organizationId: "org-1",
          principalId: input.actor.id,
          role: "owner",
          createdAt: "2026-06-21T00:00:00.000Z"
        }
      };
    },
    async addMember(input) {
      return {
        id: "membership-1",
        organizationId: input.organizationId,
        principalId: input.principalId,
        role: input.role,
        createdAt: "2026-06-21T00:00:00.000Z"
      };
    },
    async createProject(input) {
      overrides.onCreateProject?.();
      return {
        id: "project-1",
        organizationId: input.organizationId,
        name: input.name,
        siteUrl: input.siteUrl,
        createdAt: "2026-06-21T00:00:00.000Z"
      };
    },
    async createEnvironment(input) {
      return {
        id: "env-1",
        organizationId: input.organizationId,
        projectId: input.projectId,
        name: input.name,
        baseUrl: input.baseUrl,
        createdAt: "2026-06-21T00:00:00.000Z"
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
          createdAt: "2026-06-21T00:00:00.000Z"
        },
        jobId: "job-1"
      };
    },
    async getDashboardSnapshot(input) {
      return {
        organization: {
          id: input.organizationId
        },
        project: {
          id: input.projectId
        },
        environment: {
          id: input.environmentId
        }
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
    },
    ...overrides
  };
}
