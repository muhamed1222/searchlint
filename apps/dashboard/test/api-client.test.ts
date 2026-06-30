import { describe, expect, it, vi } from "vitest";

import {
  clearDashboardStoredAuthSession,
  createDashboardApiClient,
  createDashboardApiFetchTransport,
  createDashboardApiRequest,
  createDashboardBrowserAuthSessionStore,
  createDashboardBrowserExternalProviderOAuthStore,
  createDashboardBrowserPkceAuthStore,
  createDashboardCognitoAuthorizationUrl,
  createDashboardCognitoLogoutUrl,
  createDashboardCognitoStoredSessionApiClient,
  createDashboardSessionAccessTokenProvider,
  createDashboardStoredSessionAccessTokenProvider,
  completeDashboardCognitoPkceAuthCallback,
  completeDashboardExternalProviderOAuthCallback,
  consumeDashboardCognitoPkceAuthCallback,
  consumeDashboardExternalProviderOAuthCallback,
  DashboardApiClientError,
  exchangeDashboardCognitoAuthorizationCode,
  getDashboardStoredAuthSessionState,
  parseDashboardCognitoAuthCallback,
  refreshDashboardCognitoAuthSession,
  redirectDashboardExternalProviderOAuth,
  signOutDashboardCognitoSession,
  startDashboardCognitoPkceAuth,
  startDashboardExternalProviderOAuth,
  type DashboardApiClient,
  type DashboardAuthSession,
  type DashboardAuthSessionStore,
  type DashboardBrowserStorageLike,
  type DashboardCognitoPendingAuthStore,
  type DashboardCognitoPendingPkceAuthState,
  type DashboardCognitoTokenFetch,
  type DashboardCognitoTokenFetchRequestInit,
  type DashboardCognitoPendingAuthState,
  type DashboardApiFetch,
  type DashboardApiFetchRequestInit,
  type DashboardApiRequest,
  type DashboardApiTransport,
  type DashboardExternalProviderOAuthPendingState,
  type DashboardExternalProviderOAuthPendingStore
} from "../src/index.js";
import { routeContractForOperation } from "@searchlint/api/http-contracts";

describe("createDashboardApiRequest", () => {
  it("builds dashboard action requests from checked v1 cloud route contracts", () => {
    const request = createDashboardApiRequest(
      "requestCrawl",
      {
        organizationId: "org 1",
        projectId: "project/1",
        environmentId: "env?1"
      },
      { maxUrls: 100 }
    );
    const contract = routeContractForOperation("requestCrawl");

    expect(request).toEqual({
      action: "requestCrawl",
      operation: contract.operation,
      method: contract.method,
      path: "/v1/organizations/org%201/projects/project%2F1/environments/env%3F1/crawl-requests",
      apiVersion: contract.apiVersion,
      stability: contract.stability,
      requestSchemaVersion: contract.requestSchemaVersion,
      responseSchemaVersion: contract.responseSchemaVersion,
      body: { maxUrls: 100 }
    });
  });

  it("builds the dashboard snapshot GET request without a body", () => {
    const request = createDashboardApiRequest(
      "getDashboardSnapshot",
      {
        organizationId: "org 1",
        projectId: "project/1",
        environmentId: "env?1"
      },
      undefined
    );
    const contract = routeContractForOperation("getDashboardSnapshot");

    expect(request).toEqual({
      action: "getDashboardSnapshot",
      operation: contract.operation,
      method: "GET",
      path: "/v1/organizations/org%201/projects/project%2F1/environments/env%3F1/dashboard-snapshot",
      apiVersion: contract.apiVersion,
      stability: contract.stability,
      requestSchemaVersion: contract.requestSchemaVersion,
      responseSchemaVersion: contract.responseSchemaVersion,
      body: undefined
    });
  });

  it("builds external provider OAuth callback requests from the checked cloud route contract", () => {
    const request = createDashboardApiRequest(
      "completeExternalProviderOAuthConnection",
      {
        organizationId: "org 1",
        projectId: "project/1",
        environmentId: "env?1",
        provider: "google"
      },
      {
        code: "authorization-code",
        redirectUri: "https://app.searchlint.example/oauth/google/callback",
        codeVerifier: "pkce-verifier",
        scopes: ["scope-a", "scope-b"]
      }
    );
    const contract = routeContractForOperation(
      "completeExternalProviderOAuthConnection"
    );

    expect(request).toEqual({
      action: "completeExternalProviderOAuthConnection",
      operation: contract.operation,
      method: "POST",
      path: "/v1/organizations/org%201/projects/project%2F1/environments/env%3F1/external-providers/google/oauth/callback",
      apiVersion: "v1",
      stability: contract.stability,
      requestSchemaVersion: "cloud.completeExternalProviderOAuthConnection.v1",
      responseSchemaVersion: "cloud.oauthConnection.v1",
      body: {
        code: "authorization-code",
        redirectUri: "https://app.searchlint.example/oauth/google/callback",
        codeVerifier: "pkce-verifier",
        scopes: ["scope-a", "scope-b"]
      }
    });
  });

  it("builds external provider OAuth authorization start requests from the checked cloud route contract", () => {
    const request = createDashboardApiRequest(
      "startExternalProviderOAuthConnection",
      {
        organizationId: "org 1",
        projectId: "project/1",
        environmentId: "env?1",
        provider: "yandex"
      },
      {
        state: "state-123",
        redirectUri: "https://app.searchlint.example/oauth/yandex/callback",
        scopes: ["webmaster:read", "metrika:read"],
        codeChallenge: "pkce-challenge"
      }
    );
    const contract = routeContractForOperation(
      "startExternalProviderOAuthConnection"
    );

    expect(request).toEqual({
      action: "startExternalProviderOAuthConnection",
      operation: contract.operation,
      method: "POST",
      path: "/v1/organizations/org%201/projects/project%2F1/environments/env%3F1/external-providers/yandex/oauth/start",
      apiVersion: "v1",
      stability: contract.stability,
      requestSchemaVersion: "cloud.startExternalProviderOAuthConnection.v1",
      responseSchemaVersion: "cloud.externalProviderOAuthAuthorization.v1",
      body: {
        state: "state-123",
        redirectUri: "https://app.searchlint.example/oauth/yandex/callback",
        scopes: ["webmaster:read", "metrika:read"],
        codeChallenge: "pkce-challenge"
      }
    });
  });

  it("rejects missing path parameters before transport execution", () => {
    expect(() =>
      createDashboardApiRequest(
        "createEnvironment",
        { organizationId: "org-1" },
        { name: "Production", baseUrl: "https://example.com" }
      )
    ).toThrowError(
      new DashboardApiClientError(
        "MISSING_PATH_PARAM",
        "Missing dashboard API path parameter projectId."
      )
    );

    expect(() =>
      createDashboardApiRequest(
        "getDashboardSnapshot",
        {
          organizationId: "org-1",
          projectId: "project-1"
        },
        undefined
      )
    ).toThrowError(
      new DashboardApiClientError(
        "MISSING_PATH_PARAM",
        "Missing dashboard API path parameter environmentId."
      )
    );

    expect(() =>
      createDashboardApiRequest(
        "startExternalProviderOAuthConnection",
        {
          organizationId: "org-1",
          projectId: "project-1",
          environmentId: "env-1",
          provider: "google"
        },
        {
          redirectUri: "https://app.searchlint.example/oauth/google/callback"
        } as never
      )
    ).toThrowError(
      new DashboardApiClientError(
        "INVALID_REQUEST_BODY",
        "state must be a non-empty string."
      )
    );

    expect(() =>
      createDashboardApiRequest(
        "completeExternalProviderOAuthConnection",
        {
          organizationId: "org-1",
          projectId: "project-1",
          environmentId: "env-1",
          provider: "bing"
        },
        {
          code: "authorization-code",
          redirectUri: "https://app.searchlint.example/oauth/bing/callback"
        }
      )
    ).toThrowError(
      new DashboardApiClientError(
        "MISSING_PATH_PARAM",
        "Dashboard API provider path parameter must be google or yandex."
      )
    );
  });

  it("rejects invalid request bodies before transport execution", () => {
    expect(() =>
      createDashboardApiRequest("addMember", { organizationId: "org-1" }, {
        principalId: "principal-1",
        role: "viewer"
      } as never)
    ).toThrowError(
      new DashboardApiClientError(
        "INVALID_REQUEST_BODY",
        "role is not supported."
      )
    );

    expect(() =>
      createDashboardApiRequest(
        "requestCrawl",
        {
          organizationId: "org-1",
          projectId: "project-1",
          environmentId: "env-1"
        },
        { maxUrls: 0 }
      )
    ).toThrowError(
      new DashboardApiClientError(
        "INVALID_REQUEST_BODY",
        "maxUrls must be a positive integer."
      )
    );

    expect(() =>
      createDashboardApiRequest(
        "completeExternalProviderOAuthConnection",
        {
          organizationId: "org-1",
          projectId: "project-1",
          environmentId: "env-1",
          provider: "google"
        },
        {
          code: "authorization-code",
          redirectUri: "https://app.searchlint.example/oauth/google/callback",
          scopes: ["scope-a", ""]
        }
      )
    ).toThrowError(
      new DashboardApiClientError(
        "INVALID_REQUEST_BODY",
        "scopes must be an array of non-empty strings."
      )
    );
  });
});

describe("createDashboardApiClient", () => {
  it("invokes the injected transport with deterministic dashboard API requests", async () => {
    const requests: DashboardApiRequest[] = [];
    const transport: DashboardApiTransport = vi.fn(async (request) => {
      requests.push(request);
      return {
        status: 200,
        body: { ok: true }
      };
    });
    const client = createDashboardApiClient(transport);

    await expect(
      client.getDashboardSnapshot({
        organizationId: "org-1",
        projectId: "project-1",
        environmentId: "env-1"
      })
    ).resolves.toEqual({
      status: 200,
      body: { ok: true }
    });

    await expect(
      client.createProject(
        { organizationId: "org-1" },
        { name: "Example", siteUrl: "https://example.com" }
      )
    ).resolves.toEqual({
      status: 200,
      body: { ok: true }
    });

    await expect(
      client.startExternalProviderOAuthConnection(
        {
          organizationId: "org-1",
          projectId: "project-1",
          environmentId: "env-1",
          provider: "google"
        },
        {
          state: "state-123",
          redirectUri: "https://app.searchlint.example/oauth/google/callback",
          codeChallenge: "pkce-challenge"
        }
      )
    ).resolves.toEqual({
      status: 200,
      body: { ok: true }
    });

    await expect(
      client.completeExternalProviderOAuthConnection(
        {
          organizationId: "org-1",
          projectId: "project-1",
          environmentId: "env-1",
          provider: "yandex"
        },
        {
          code: "authorization-code",
          redirectUri: "https://app.searchlint.example/oauth/yandex/callback"
        }
      )
    ).resolves.toEqual({
      status: 200,
      body: { ok: true }
    });

    expect(transport).toHaveBeenCalledTimes(4);
    expect(requests).toEqual([
      expect.objectContaining({
        action: "getDashboardSnapshot",
        operation: "getDashboardSnapshot",
        method: "GET",
        path: "/v1/organizations/org-1/projects/project-1/environments/env-1/dashboard-snapshot",
        apiVersion: "v1",
        requestSchemaVersion: "cloud.getDashboardSnapshot.v1",
        responseSchemaVersion: "cloud.dashboardSnapshot.v1",
        body: undefined
      }),
      expect.objectContaining({
        action: "createProject",
        operation: "createProject",
        method: "POST",
        path: "/v1/organizations/org-1/projects",
        apiVersion: "v1",
        requestSchemaVersion: "cloud.createProject.v1",
        responseSchemaVersion: "cloud.project.v1",
        body: {
          name: "Example",
          siteUrl: "https://example.com"
        }
      }),
      expect.objectContaining({
        action: "startExternalProviderOAuthConnection",
        operation: "startExternalProviderOAuthConnection",
        method: "POST",
        path: "/v1/organizations/org-1/projects/project-1/environments/env-1/external-providers/google/oauth/start",
        apiVersion: "v1",
        requestSchemaVersion: "cloud.startExternalProviderOAuthConnection.v1",
        responseSchemaVersion: "cloud.externalProviderOAuthAuthorization.v1",
        body: {
          state: "state-123",
          redirectUri: "https://app.searchlint.example/oauth/google/callback",
          codeChallenge: "pkce-challenge"
        }
      }),
      expect.objectContaining({
        action: "completeExternalProviderOAuthConnection",
        operation: "completeExternalProviderOAuthConnection",
        method: "POST",
        path: "/v1/organizations/org-1/projects/project-1/environments/env-1/external-providers/yandex/oauth/callback",
        apiVersion: "v1",
        requestSchemaVersion:
          "cloud.completeExternalProviderOAuthConnection.v1",
        responseSchemaVersion: "cloud.oauthConnection.v1",
        body: {
          code: "authorization-code",
          redirectUri: "https://app.searchlint.example/oauth/yandex/callback"
        }
      })
    ]);
  });

  it("does not call transport when request validation fails", async () => {
    const transport: DashboardApiTransport = vi.fn(async () => ({
      status: 200,
      body: {}
    }));
    const client = createDashboardApiClient(transport);

    await expect(
      client.createProject(
        { organizationId: "" },
        { name: "Example", siteUrl: "https://example.com" }
      )
    ).rejects.toMatchObject({
      code: "MISSING_PATH_PARAM"
    });

    expect(transport).not.toHaveBeenCalled();
  });
});

describe("createDashboardApiFetchTransport", () => {
  it("sends authenticated JSON requests with stable dashboard schema headers", async () => {
    const calls: FetchCall[] = [];
    const fetcher = fetchJson(calls, {
      status: 200,
      body: { project: { id: "project-1" } }
    });
    const transport = createDashboardApiFetchTransport({
      baseUrl: "https://api.searchlint.example/",
      fetch: fetcher,
      accessToken: async () => "token-1",
      headers: {
        "x-searchlint-operation": "caller-cannot-override",
        "x-extra": "extra"
      }
    });
    const request = createDashboardApiRequest(
      "createProject",
      { organizationId: "org-1" },
      { name: "Example", siteUrl: "https://example.com" }
    );

    await expect(transport(request)).resolves.toEqual({
      status: 200,
      body: { project: { id: "project-1" } }
    });

    expect(calls).toEqual([
      {
        url: "https://api.searchlint.example/v1/organizations/org-1/projects",
        init: {
          method: "POST",
          headers: {
            accept: "application/json",
            authorization: "Bearer token-1",
            "content-type": "application/json",
            "x-extra": "extra",
            "x-searchlint-api-version": "v1",
            "x-searchlint-dashboard-action": "createProject",
            "x-searchlint-operation": "createProject",
            "x-searchlint-request-schema": "cloud.createProject.v1",
            "x-searchlint-response-schema": "cloud.project.v1"
          },
          body: JSON.stringify({
            name: "Example",
            siteUrl: "https://example.com"
          })
        }
      }
    ]);
  });

  it("normalizes non-JSON text responses", async () => {
    const transport = createDashboardApiFetchTransport({
      baseUrl: "https://api.searchlint.example",
      fetch: fetchText("accepted"),
      accessToken: "token-1"
    });

    await expect(
      transport(
        createDashboardApiRequest(
          "requestCrawl",
          {
            organizationId: "org-1",
            projectId: "project-1",
            environmentId: "env-1"
          },
          { maxUrls: 10 }
        )
      )
    ).resolves.toEqual({
      status: 202,
      body: "accepted"
    });
  });

  it("sends authenticated GET dashboard snapshot requests without JSON body headers", async () => {
    const calls: FetchCall[] = [];
    const transport = createDashboardApiFetchTransport({
      baseUrl: "https://api.searchlint.example/",
      fetch: fetchJson(calls, { status: 200, body: {} }),
      accessToken: "token-1"
    });

    await expect(
      transport(
        createDashboardApiRequest(
          "getDashboardSnapshot",
          {
            organizationId: "org-1",
            projectId: "project-1",
            environmentId: "env-1"
          },
          undefined
        )
      )
    ).resolves.toEqual({
      status: 200,
      body: {}
    });

    expect(calls).toEqual([
      {
        url: "https://api.searchlint.example/v1/organizations/org-1/projects/project-1/environments/env-1/dashboard-snapshot",
        init: {
          method: "GET",
          headers: {
            accept: "application/json",
            authorization: "Bearer token-1",
            "x-searchlint-api-version": "v1",
            "x-searchlint-dashboard-action": "getDashboardSnapshot",
            "x-searchlint-operation": "getDashboardSnapshot",
            "x-searchlint-request-schema": "cloud.getDashboardSnapshot.v1",
            "x-searchlint-response-schema": "cloud.dashboardSnapshot.v1"
          }
        }
      }
    ]);
  });

  it("sends external provider OAuth callback requests with stable schema headers", async () => {
    const calls: FetchCall[] = [];
    const transport = createDashboardApiFetchTransport({
      baseUrl: "https://api.searchlint.example",
      fetch: fetchJson(calls, {
        status: 200,
        body: {
          oauthConnection: {
            id: "oauth-1"
          }
        }
      }),
      accessToken: "token-1"
    });

    await expect(
      transport(
        createDashboardApiRequest(
          "completeExternalProviderOAuthConnection",
          {
            organizationId: "org-1",
            projectId: "project-1",
            environmentId: "env-1",
            provider: "google"
          },
          {
            code: "authorization-code",
            redirectUri: "https://app.searchlint.example/oauth/google/callback",
            codeVerifier: "pkce-verifier",
            scopes: ["scope-a"]
          }
        )
      )
    ).resolves.toEqual({
      status: 200,
      body: {
        oauthConnection: {
          id: "oauth-1"
        }
      }
    });

    expect(calls).toEqual([
      {
        url: "https://api.searchlint.example/v1/organizations/org-1/projects/project-1/environments/env-1/external-providers/google/oauth/callback",
        init: {
          method: "POST",
          headers: {
            accept: "application/json",
            authorization: "Bearer token-1",
            "content-type": "application/json",
            "x-searchlint-api-version": "v1",
            "x-searchlint-dashboard-action":
              "completeExternalProviderOAuthConnection",
            "x-searchlint-operation": "completeExternalProviderOAuthConnection",
            "x-searchlint-request-schema":
              "cloud.completeExternalProviderOAuthConnection.v1",
            "x-searchlint-response-schema": "cloud.oauthConnection.v1"
          },
          body: JSON.stringify({
            code: "authorization-code",
            redirectUri: "https://app.searchlint.example/oauth/google/callback",
            codeVerifier: "pkce-verifier",
            scopes: ["scope-a"]
          })
        }
      }
    ]);
  });

  it("sends external provider OAuth authorization start requests with stable schema headers", async () => {
    const calls: FetchCall[] = [];
    const transport = createDashboardApiFetchTransport({
      baseUrl: "https://api.searchlint.example",
      fetch: fetchJson(calls, {
        status: 200,
        body: {
          authorizationUrl: "https://provider.example/oauth"
        }
      }),
      accessToken: "token-1"
    });

    await expect(
      transport(
        createDashboardApiRequest(
          "startExternalProviderOAuthConnection",
          {
            organizationId: "org-1",
            projectId: "project-1",
            environmentId: "env-1",
            provider: "google"
          },
          {
            state: "state-123",
            redirectUri: "https://app.searchlint.example/oauth/google/callback",
            scopes: ["scope-a"],
            codeChallenge: "pkce-challenge"
          }
        )
      )
    ).resolves.toEqual({
      status: 200,
      body: {
        authorizationUrl: "https://provider.example/oauth"
      }
    });

    expect(calls).toEqual([
      {
        url: "https://api.searchlint.example/v1/organizations/org-1/projects/project-1/environments/env-1/external-providers/google/oauth/start",
        init: {
          method: "POST",
          headers: {
            accept: "application/json",
            authorization: "Bearer token-1",
            "content-type": "application/json",
            "x-searchlint-api-version": "v1",
            "x-searchlint-dashboard-action":
              "startExternalProviderOAuthConnection",
            "x-searchlint-operation": "startExternalProviderOAuthConnection",
            "x-searchlint-request-schema":
              "cloud.startExternalProviderOAuthConnection.v1",
            "x-searchlint-response-schema":
              "cloud.externalProviderOAuthAuthorization.v1"
          },
          body: JSON.stringify({
            state: "state-123",
            redirectUri: "https://app.searchlint.example/oauth/google/callback",
            scopes: ["scope-a"],
            codeChallenge: "pkce-challenge"
          })
        }
      }
    ]);
  });

  it("rejects missing access tokens before fetch execution", async () => {
    const fetcher = vi.fn<DashboardApiFetch>();
    const transport = createDashboardApiFetchTransport({
      baseUrl: "https://api.searchlint.example",
      fetch: fetcher,
      accessToken: () => " "
    });

    await expect(
      transport(
        createDashboardApiRequest(
          "addMember",
          { organizationId: "org-1" },
          { principalId: "principal-1", role: "developer" }
        )
      )
    ).rejects.toMatchObject({
      code: "ACCESS_TOKEN_UNAVAILABLE"
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("rejects invalid API base URLs deterministically", () => {
    expect(() =>
      createDashboardApiFetchTransport({
        baseUrl: "/relative",
        fetch: fetchJson([], { status: 200, body: {} }),
        accessToken: "token-1"
      })
    ).toThrowError(
      new DashboardApiClientError(
        "INVALID_BASE_URL",
        "Dashboard API base URL must be an absolute HTTP(S) URL."
      )
    );
  });

  it("wraps fetch failures in dashboard client errors", async () => {
    const transport = createDashboardApiFetchTransport({
      baseUrl: "https://api.searchlint.example",
      fetch: async () => {
        throw new Error("network down");
      },
      accessToken: "token-1"
    });

    await expect(
      transport(
        createDashboardApiRequest(
          "createEnvironment",
          { organizationId: "org-1", projectId: "project-1" },
          { name: "Production", baseUrl: "https://example.com" }
        )
      )
    ).rejects.toMatchObject({
      code: "TRANSPORT_ERROR",
      message: "Dashboard API transport failed: network down"
    });
  });
});

describe("createDashboardCognitoStoredSessionApiClient", () => {
  it("authorizes dashboard API requests with valid stored sessions without calling Cognito", async () => {
    const apiCalls: FetchCall[] = [];
    const tokenFetch = vi.fn<DashboardCognitoTokenFetch>();
    const client = createDashboardCognitoStoredSessionApiClient({
      baseUrl: "https://api.searchlint.example",
      apiFetch: fetchJson(apiCalls, { status: 201, body: { id: "project-1" } }),
      tokenFetch,
      sessionStore: authSessionStore(
        session({
          accessToken: "stored-access-token",
          expiresAt: 2000,
          refreshToken: "refresh-token-1"
        })
      ),
      hostedUiDomain: "https://auth.searchlint.example",
      clientId: "client-1",
      clock: fixedClock(1000)
    });

    await expect(
      client.createProject(
        { organizationId: "org-1" },
        { name: "Example", siteUrl: "https://example.com" }
      )
    ).resolves.toEqual({
      status: 201,
      body: { id: "project-1" }
    });

    expect(tokenFetch).not.toHaveBeenCalled();
    expect(apiCalls[0]).toEqual({
      url: "https://api.searchlint.example/v1/organizations/org-1/projects",
      init: expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          authorization: "Bearer stored-access-token"
        })
      })
    });
  });

  it("refreshes expired stored sessions through Cognito before API requests", async () => {
    const apiCalls: FetchCall[] = [];
    const tokenCalls: TokenFetchCall[] = [];
    const store = authSessionStore(
      session({
        accessToken: "expired-access-token",
        expiresAt: 1000,
        refreshToken: "refresh-token-1"
      })
    );
    const signal = { aborted: false };
    const client = createDashboardCognitoStoredSessionApiClient({
      baseUrl: "https://api.searchlint.example",
      apiFetch: fetchJson(apiCalls, { status: 202, body: { ok: true } }),
      tokenFetch: fetchTokenJson(tokenCalls, {
        status: 200,
        body: {
          access_token: "refreshed-access-token",
          expires_in: 1800,
          token_type: "Bearer"
        }
      }),
      sessionStore: store,
      hostedUiDomain: "https://auth.searchlint.example",
      clientId: "client-1",
      clock: fixedClock(1000),
      expirySkewSeconds: 0,
      headers: { "x-dashboard-runtime": "browser" },
      signal
    });

    await expect(
      client.requestCrawl(
        {
          organizationId: "org-1",
          projectId: "project-1",
          environmentId: "env-1"
        },
        { maxUrls: 50 }
      )
    ).resolves.toEqual({
      status: 202,
      body: { ok: true }
    });

    expect(tokenCalls).toEqual([
      {
        url: "https://auth.searchlint.example/oauth2/token",
        init: expect.objectContaining({
          method: "POST",
          body: "grant_type=refresh_token&client_id=client-1&refresh_token=refresh-token-1",
          signal
        })
      }
    ]);
    expect(store.saved).toEqual([
      {
        accessToken: "refreshed-access-token",
        expiresAt: 2800,
        tokenType: "Bearer",
        identityProvider: "cognito",
        refreshToken: "refresh-token-1"
      }
    ]);
    expect(apiCalls[0]).toEqual({
      url: "https://api.searchlint.example/v1/organizations/org-1/projects/project-1/environments/env-1/crawl-requests",
      init: expect.objectContaining({
        method: "POST",
        signal,
        headers: expect.objectContaining({
          authorization: "Bearer refreshed-access-token",
          "x-dashboard-runtime": "browser"
        })
      })
    });
  });

  it("fails expired stored sessions without refresh tokens before API fetch execution", async () => {
    const apiFetch = vi.fn<DashboardApiFetch>();
    const tokenFetch = vi.fn<DashboardCognitoTokenFetch>();
    const client = createDashboardCognitoStoredSessionApiClient({
      baseUrl: "https://api.searchlint.example",
      apiFetch,
      tokenFetch,
      sessionStore: authSessionStore(
        session({ accessToken: "expired-token", expiresAt: 1000 })
      ),
      hostedUiDomain: "https://auth.searchlint.example",
      clientId: "client-1",
      clock: fixedClock(1000),
      expirySkewSeconds: 0
    });

    await expect(
      client.createProject(
        { organizationId: "org-1" },
        { name: "Example", siteUrl: "https://example.com" }
      )
    ).rejects.toThrowError(
      new DashboardApiClientError(
        "ACCESS_TOKEN_UNAVAILABLE",
        "Dashboard auth session refresh token is required."
      )
    );
    expect(apiFetch).not.toHaveBeenCalled();
    expect(tokenFetch).not.toHaveBeenCalled();
  });
});

describe("createDashboardSessionAccessTokenProvider", () => {
  it("returns the current Cognito access token when it is valid outside the expiry skew", async () => {
    const refresh = vi.fn();
    const provider = createDashboardSessionAccessTokenProvider({
      session: session({ accessToken: "current-token", expiresAt: 2000 }),
      clock: fixedClock(1000),
      expirySkewSeconds: 60,
      refresh
    });

    await expect(provider()).resolves.toBe("current-token");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("rejects blank and non-bearer sessions deterministically", () => {
    expect(() =>
      createDashboardSessionAccessTokenProvider({
        session: session({ accessToken: " " }),
        clock: fixedClock(1000)
      })
    ).toThrowError(
      new DashboardApiClientError(
        "ACCESS_TOKEN_UNAVAILABLE",
        "Dashboard auth session access token is required."
      )
    );

    expect(() =>
      createDashboardSessionAccessTokenProvider({
        session: session({ tokenType: "Basic" as "Bearer" }),
        clock: fixedClock(1000)
      })
    ).toThrowError(
      new DashboardApiClientError(
        "INVALID_AUTH_SESSION",
        "Dashboard auth session token type must be Bearer."
      )
    );
  });

  it("rejects expired sessions when no refresh callback is available", async () => {
    const provider = createDashboardSessionAccessTokenProvider({
      session: session({ accessToken: "expired-token", expiresAt: 1000 }),
      clock: fixedClock(1000),
      expirySkewSeconds: 0
    });

    await expect(provider()).rejects.toMatchObject({
      code: "ACCESS_TOKEN_EXPIRED",
      message: "Dashboard access token is expired."
    });
  });

  it("uses refreshed sessions when the current token is expired or inside skew", async () => {
    const refresh = vi.fn(async (current: DashboardAuthSession) =>
      session({
        accessToken: `${current.accessToken}-refreshed`,
        expiresAt: 3000
      })
    );
    const provider = createDashboardSessionAccessTokenProvider({
      session: session({ accessToken: "current-token", expiresAt: 1050 }),
      clock: fixedClock(1000),
      expirySkewSeconds: 60,
      refresh
    });

    await expect(provider()).resolves.toBe("current-token-refreshed");
    await expect(provider()).resolves.toBe("current-token-refreshed");
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("rejects refresh results that are invalid or already expired", async () => {
    const invalidProvider = createDashboardSessionAccessTokenProvider({
      session: session({ accessToken: "expired-token", expiresAt: 1000 }),
      clock: fixedClock(1000),
      expirySkewSeconds: 0,
      refresh: async () => session({ accessToken: "" })
    });

    await expect(invalidProvider()).rejects.toMatchObject({
      code: "ACCESS_TOKEN_UNAVAILABLE"
    });

    const expiredProvider = createDashboardSessionAccessTokenProvider({
      session: session({ accessToken: "expired-token", expiresAt: 1000 }),
      clock: fixedClock(1000),
      expirySkewSeconds: 0,
      refresh: async () =>
        session({ accessToken: "still-expired", expiresAt: 1000 })
    });

    await expect(expiredProvider()).rejects.toMatchObject({
      code: "ACCESS_TOKEN_EXPIRED",
      message: "Refreshed dashboard access token is expired."
    });
  });
});

describe("createDashboardStoredSessionAccessTokenProvider", () => {
  it("loads a stored dashboard auth session and reuses it in memory", async () => {
    const store = authSessionStore(
      session({ accessToken: "stored-token", expiresAt: 2000 })
    );
    const provider = createDashboardStoredSessionAccessTokenProvider({
      sessionStore: store,
      clock: fixedClock(1000)
    });

    await expect(provider()).resolves.toBe("stored-token");
    await expect(provider()).resolves.toBe("stored-token");

    expect(store.loadCount).toBe(1);
    expect(store.saved).toEqual([]);
  });

  it("refreshes near-expiry stored sessions, saves the refreshed session, and reuses it", async () => {
    const store = authSessionStore(
      session({ accessToken: "stored-token", expiresAt: 1050 })
    );
    const refresh = vi.fn(async (current: DashboardAuthSession) =>
      session({
        accessToken: `${current.accessToken}-refreshed`,
        expiresAt: 2000
      })
    );
    const provider = createDashboardStoredSessionAccessTokenProvider({
      sessionStore: store,
      clock: fixedClock(1000),
      refresh
    });

    await expect(provider()).resolves.toBe("stored-token-refreshed");
    await expect(provider()).resolves.toBe("stored-token-refreshed");

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(store.saved).toEqual([
      session({ accessToken: "stored-token-refreshed", expiresAt: 2000 })
    ]);
  });

  it("rejects missing stored sessions before returning a token", async () => {
    const refresh = vi.fn();
    const provider = createDashboardStoredSessionAccessTokenProvider({
      sessionStore: authSessionStore(),
      clock: fixedClock(1000),
      refresh
    });

    await expect(provider()).rejects.toThrowError(
      new DashboardApiClientError(
        "ACCESS_TOKEN_UNAVAILABLE",
        "Dashboard auth session was not found."
      )
    );
    expect(refresh).not.toHaveBeenCalled();
  });

  it("rejects invalid expiry skew before store access", () => {
    const store = authSessionStore(session());

    expect(() =>
      createDashboardStoredSessionAccessTokenProvider({
        sessionStore: store,
        clock: fixedClock(1000),
        expirySkewSeconds: -1
      })
    ).toThrowError(
      new DashboardApiClientError(
        "INVALID_AUTH_SESSION",
        "Dashboard session expiry skew must be a non-negative number."
      )
    );
    expect(store.loadCount).toBe(0);
  });

  it("rejects expired stored sessions when no refresh callback is available", async () => {
    const provider = createDashboardStoredSessionAccessTokenProvider({
      sessionStore: authSessionStore(
        session({ accessToken: "expired-token", expiresAt: 1000 })
      ),
      clock: fixedClock(1000),
      expirySkewSeconds: 0
    });

    await expect(provider()).rejects.toThrowError(
      new DashboardApiClientError(
        "ACCESS_TOKEN_EXPIRED",
        "Dashboard access token is expired."
      )
    );
  });

  it("rejects unusable refresh results without saving them", async () => {
    const store = authSessionStore(
      session({ accessToken: "expired-token", expiresAt: 1000 })
    );
    const provider = createDashboardStoredSessionAccessTokenProvider({
      sessionStore: store,
      clock: fixedClock(1000),
      expirySkewSeconds: 0,
      refresh: async () =>
        session({ accessToken: "still-expired-token", expiresAt: 1000 })
    });

    await expect(provider()).rejects.toThrowError(
      new DashboardApiClientError(
        "ACCESS_TOKEN_EXPIRED",
        "Refreshed dashboard access token is expired."
      )
    );
    expect(store.saved).toEqual([]);
  });
});

describe("stored dashboard auth session lifecycle", () => {
  it("classifies missing, valid, and expired stored auth sessions", async () => {
    await expect(
      getDashboardStoredAuthSessionState({
        sessionStore: authSessionStore(),
        clock: fixedClock(1000)
      })
    ).resolves.toEqual({
      status: "missing"
    });

    const validSession = session({
      accessToken: "valid-token",
      expiresAt: 2000
    });
    await expect(
      getDashboardStoredAuthSessionState({
        sessionStore: authSessionStore(validSession),
        clock: fixedClock(1000)
      })
    ).resolves.toEqual({
      status: "valid",
      session: validSession
    });

    const expiredSession = session({
      accessToken: "expired-token",
      expiresAt: 1050
    });
    await expect(
      getDashboardStoredAuthSessionState({
        sessionStore: authSessionStore(expiredSession),
        clock: fixedClock(1000)
      })
    ).resolves.toEqual({
      status: "expired",
      session: expiredSession
    });
  });

  it("rejects invalid lifecycle expiry skew before store access", async () => {
    const store = authSessionStore(session());

    await expect(
      getDashboardStoredAuthSessionState({
        sessionStore: store,
        clock: fixedClock(1000),
        expirySkewSeconds: -1
      })
    ).rejects.toThrowError(
      new DashboardApiClientError(
        "INVALID_AUTH_SESSION",
        "Dashboard session expiry skew must be a non-negative number."
      )
    );
    expect(store.loadCount).toBe(0);
  });

  it("surfaces invalid stored auth sessions instead of treating them as missing", async () => {
    await expect(
      getDashboardStoredAuthSessionState({
        sessionStore: authSessionStore(
          session({ tokenType: "Basic" as "Bearer" })
        ),
        clock: fixedClock(1000)
      })
    ).rejects.toThrowError(
      new DashboardApiClientError(
        "INVALID_AUTH_SESSION",
        "Dashboard auth session token type must be Bearer."
      )
    );
  });

  it("clears persisted dashboard auth sessions through the injected store", async () => {
    const store = authSessionStore(session());

    await clearDashboardStoredAuthSession(store);

    await expect(
      getDashboardStoredAuthSessionState({
        sessionStore: store,
        clock: fixedClock(1000)
      })
    ).resolves.toEqual({
      status: "missing"
    });
    expect(store.deleted).toBe(1);
  });
});

describe("Cognito hosted UI auth contracts", () => {
  it("builds deterministic authorization-code URLs with PKCE S256 parameters", () => {
    const url = new URL(
      createDashboardCognitoAuthorizationUrl(
        {
          hostedUiDomain: "https://auth.searchlint.example",
          clientId: "client-1",
          redirectUri: "https://app.searchlint.example/auth/callback",
          scopes: ["openid", "email", "profile", "email"]
        },
        {
          state: "state-1",
          nonce: "nonce-1",
          codeChallenge: "challenge-1"
        }
      )
    );

    expect(url.origin).toBe("https://auth.searchlint.example");
    expect(url.pathname).toBe("/oauth2/authorize");
    expect(Object.fromEntries(url.searchParams.entries())).toEqual({
      client_id: "client-1",
      redirect_uri: "https://app.searchlint.example/auth/callback",
      response_type: "code",
      scope: "email openid profile",
      state: "state-1",
      nonce: "nonce-1",
      code_challenge: "challenge-1",
      code_challenge_method: "S256"
    });
  });

  it("rejects invalid authorization request inputs before URL construction", () => {
    expect(() =>
      createDashboardCognitoAuthorizationUrl(
        {
          hostedUiDomain: "https://auth.searchlint.example/path",
          clientId: "client-1",
          redirectUri: "https://app.searchlint.example/auth/callback",
          scopes: ["openid"]
        },
        {
          state: "state-1",
          nonce: "nonce-1",
          codeChallenge: "challenge-1"
        }
      )
    ).toThrowError(
      new DashboardApiClientError(
        "INVALID_AUTH_REQUEST",
        "Dashboard Cognito hosted UI domain must not include a path, query, or fragment."
      )
    );

    expect(() =>
      createDashboardCognitoAuthorizationUrl(
        {
          hostedUiDomain: "https://auth.searchlint.example",
          clientId: " ",
          redirectUri: "https://app.searchlint.example/auth/callback",
          scopes: ["openid"]
        },
        {
          state: "state-1",
          nonce: "nonce-1",
          codeChallenge: "challenge-1"
        }
      )
    ).toThrowError(
      new DashboardApiClientError(
        "INVALID_AUTH_REQUEST",
        "Dashboard auth clientId is required."
      )
    );

    expect(() =>
      createDashboardCognitoAuthorizationUrl(
        {
          hostedUiDomain: "https://auth.searchlint.example",
          clientId: "client-1",
          redirectUri: "/callback",
          scopes: []
        },
        {
          state: "state-1",
          nonce: "nonce-1",
          codeChallenge: "challenge-1"
        }
      )
    ).toThrowError(
      new DashboardApiClientError(
        "INVALID_AUTH_REQUEST",
        "Dashboard auth redirectUri must be an absolute HTTP(S) URL."
      )
    );
  });

  it("builds deterministic hosted UI logout URLs", () => {
    const url = new URL(
      createDashboardCognitoLogoutUrl({
        hostedUiDomain: "https://auth.searchlint.example",
        clientId: "client-1",
        logoutUri: "https://app.searchlint.example/signed-out",
        state: "logout-state-1"
      })
    );

    expect(url.origin).toBe("https://auth.searchlint.example");
    expect(url.pathname).toBe("/logout");
    expect(Object.fromEntries(url.searchParams.entries())).toEqual({
      client_id: "client-1",
      logout_uri: "https://app.searchlint.example/signed-out",
      state: "logout-state-1"
    });
  });

  it("rejects invalid hosted UI logout inputs", () => {
    expect(() =>
      createDashboardCognitoLogoutUrl({
        hostedUiDomain: "https://auth.searchlint.example/path",
        clientId: "client-1",
        logoutUri: "https://app.searchlint.example/signed-out"
      })
    ).toThrowError(
      new DashboardApiClientError(
        "INVALID_AUTH_REQUEST",
        "Dashboard Cognito hosted UI domain must not include a path, query, or fragment."
      )
    );

    expect(() =>
      createDashboardCognitoLogoutUrl({
        hostedUiDomain: "https://auth.searchlint.example",
        clientId: " ",
        logoutUri: "https://app.searchlint.example/signed-out"
      })
    ).toThrowError(
      new DashboardApiClientError(
        "INVALID_AUTH_REQUEST",
        "Dashboard auth clientId is required."
      )
    );

    expect(() =>
      createDashboardCognitoLogoutUrl({
        hostedUiDomain: "https://auth.searchlint.example",
        clientId: "client-1",
        logoutUri: "/signed-out"
      })
    ).toThrowError(
      new DashboardApiClientError(
        "INVALID_AUTH_REQUEST",
        "Dashboard auth logoutUri must be an absolute HTTP(S) URL."
      )
    );

    expect(() =>
      createDashboardCognitoLogoutUrl({
        hostedUiDomain: "https://auth.searchlint.example",
        clientId: "client-1",
        logoutUri: "https://app.searchlint.example/signed-out",
        state: " "
      })
    ).toThrowError(
      new DashboardApiClientError(
        "INVALID_AUTH_REQUEST",
        "Dashboard auth state is required."
      )
    );
  });

  it("clears the stored dashboard session and returns the logout URL", async () => {
    const store = authSessionStore(session());

    await expect(
      signOutDashboardCognitoSession({
        hostedUiDomain: "https://auth.searchlint.example",
        clientId: "client-1",
        logoutUri: "https://app.searchlint.example/signed-out",
        sessionStore: store
      })
    ).resolves.toEqual({
      logoutUrl:
        "https://auth.searchlint.example/logout?client_id=client-1&logout_uri=https%3A%2F%2Fapp.searchlint.example%2Fsigned-out"
    });
    expect(store.deleted).toBe(1);

    await expect(
      getDashboardStoredAuthSessionState({
        sessionStore: store,
        clock: fixedClock(1000)
      })
    ).resolves.toEqual({
      status: "missing"
    });
  });

  it("does not clear the stored session when logout URL validation fails", async () => {
    const store = authSessionStore(session());

    await expect(
      signOutDashboardCognitoSession({
        hostedUiDomain: "https://auth.searchlint.example",
        clientId: "client-1",
        logoutUri: "/signed-out",
        sessionStore: store
      })
    ).rejects.toThrowError(
      new DashboardApiClientError(
        "INVALID_AUTH_REQUEST",
        "Dashboard auth logoutUri must be an absolute HTTP(S) URL."
      )
    );
    expect(store.deleted).toBe(0);
  });

  it("propagates stored session delete failures", async () => {
    const store = createDashboardBrowserAuthSessionStore({
      storage: failingStorage("removeItem"),
      namespace: "searchlint:session"
    });

    await expect(
      signOutDashboardCognitoSession({
        hostedUiDomain: "https://auth.searchlint.example",
        clientId: "client-1",
        logoutUri: "https://app.searchlint.example/signed-out",
        sessionStore: store
      })
    ).rejects.toThrowError(
      new DashboardApiClientError(
        "AUTH_STORAGE_ERROR",
        "Dashboard auth storage delete failed: removeItem failed"
      )
    );
  });

  it("parses successful authorization callbacks with state validation", () => {
    expect(
      parseDashboardCognitoAuthCallback({
        callbackUrl:
          "https://app.searchlint.example/auth/callback?code=code-1&state=state-1&iss=https%3A%2F%2Fcognito-idp.us-east-1.amazonaws.com%2Fpool",
        expectedState: pendingState()
      })
    ).toEqual({
      code: "code-1",
      state: "state-1",
      issuer: "https://cognito-idp.us-east-1.amazonaws.com/pool"
    });
  });

  it("rejects callback state mismatches and provider errors deterministically", () => {
    expect(() =>
      parseDashboardCognitoAuthCallback({
        callbackUrl:
          "https://app.searchlint.example/auth/callback?code=code-1&state=wrong",
        expectedState: pendingState()
      })
    ).toThrowError(
      new DashboardApiClientError(
        "AUTH_STATE_MISMATCH",
        "Dashboard auth callback state does not match the pending request."
      )
    );

    expect(() =>
      parseDashboardCognitoAuthCallback({
        callbackUrl:
          "https://app.searchlint.example/auth/callback?error=access_denied&error_description=Denied&state=state-1",
        expectedState: pendingState()
      })
    ).toThrowError(
      new DashboardApiClientError(
        "AUTH_PROVIDER_ERROR",
        "Cognito authorization failed: access_denied (Denied)."
      )
    );
  });

  it("rejects callbacks without codes or valid absolute URLs", () => {
    expect(() =>
      parseDashboardCognitoAuthCallback({
        callbackUrl: "/auth/callback?code=code-1&state=state-1",
        expectedState: pendingState()
      })
    ).toThrowError(
      new DashboardApiClientError(
        "INVALID_AUTH_REQUEST",
        "Dashboard auth callbackUrl must be an absolute HTTP(S) URL."
      )
    );

    expect(() =>
      parseDashboardCognitoAuthCallback({
        callbackUrl:
          "https://app.searchlint.example/auth/callback?state=state-1",
        expectedState: pendingState()
      })
    ).toThrowError(
      new DashboardApiClientError(
        "INVALID_AUTH_REQUEST",
        "Dashboard auth callback code is required."
      )
    );
  });
});

describe("Cognito PKCE pending auth lifecycle", () => {
  it("stores pending PKCE verifier state when starting authorization", async () => {
    const store = pendingAuthStore();

    await expect(
      startDashboardCognitoPkceAuth({
        config: hostedUiConfig(),
        request: {
          state: "state-1",
          nonce: "nonce-1",
          codeChallenge: "challenge-1"
        },
        codeVerifier: "verifier-1",
        store,
        clock: fixedClock(1000),
        ttlSeconds: 300
      })
    ).resolves.toEqual({
      authorizationUrl:
        "https://auth.searchlint.example/oauth2/authorize?client_id=client-1&redirect_uri=https%3A%2F%2Fapp.searchlint.example%2Fauth%2Fcallback&response_type=code&scope=email+openid+profile&state=state-1&nonce=nonce-1&code_challenge=challenge-1&code_challenge_method=S256",
      pendingState: {
        state: "state-1",
        nonce: "nonce-1",
        codeChallenge: "challenge-1",
        redirectUri: "https://app.searchlint.example/auth/callback",
        codeVerifier: "verifier-1",
        createdAt: 1000,
        expiresAt: 1300
      }
    });

    expect(store.saved).toEqual([
      {
        state: "state-1",
        nonce: "nonce-1",
        codeChallenge: "challenge-1",
        redirectUri: "https://app.searchlint.example/auth/callback",
        codeVerifier: "verifier-1",
        createdAt: 1000,
        expiresAt: 1300
      }
    ]);
  });

  it("rejects invalid pending-state TTL before store writes", async () => {
    const store = pendingAuthStore();

    await expect(
      startDashboardCognitoPkceAuth({
        config: hostedUiConfig(),
        request: {
          state: "state-1",
          nonce: "nonce-1",
          codeChallenge: "challenge-1"
        },
        codeVerifier: "verifier-1",
        store,
        clock: fixedClock(1000),
        ttlSeconds: 0
      })
    ).rejects.toThrowError(
      new DashboardApiClientError(
        "INVALID_AUTH_REQUEST",
        "Dashboard auth pending state TTL must be a positive integer."
      )
    );
    expect(store.saved).toEqual([]);
  });

  it("consumes pending PKCE state into a token exchange request", async () => {
    const store = pendingAuthStore([
      pendingPkceState({
        state: "state-1",
        codeVerifier: "verifier-1"
      })
    ]);

    await expect(
      consumeDashboardCognitoPkceAuthCallback({
        config: hostedUiConfig(),
        callbackUrl:
          "https://app.searchlint.example/auth/callback?code=code-1&state=state-1",
        store,
        clock: fixedClock(1100)
      })
    ).resolves.toEqual({
      callback: {
        code: "code-1",
        state: "state-1"
      },
      tokenExchangeRequest: {
        hostedUiDomain: "https://auth.searchlint.example",
        clientId: "client-1",
        redirectUri: "https://app.searchlint.example/auth/callback",
        code: "code-1",
        codeVerifier: "verifier-1"
      }
    });
    expect(store.deleted).toEqual(["state-1"]);
    expect(await store.load("state-1")).toBeUndefined();
  });

  it("rejects missing and expired pending states deterministically", async () => {
    const missingStore = pendingAuthStore();

    await expect(
      consumeDashboardCognitoPkceAuthCallback({
        config: hostedUiConfig(),
        callbackUrl:
          "https://app.searchlint.example/auth/callback?code=code-1&state=missing",
        store: missingStore,
        clock: fixedClock(1100)
      })
    ).rejects.toThrowError(
      new DashboardApiClientError(
        "AUTH_STATE_NOT_FOUND",
        "Dashboard auth pending state was not found."
      )
    );
    expect(missingStore.deleted).toEqual([]);

    const expiredStore = pendingAuthStore([
      pendingPkceState({
        state: "state-1",
        createdAt: 1000,
        expiresAt: 1100
      })
    ]);

    await expect(
      consumeDashboardCognitoPkceAuthCallback({
        config: hostedUiConfig(),
        callbackUrl:
          "https://app.searchlint.example/auth/callback?code=code-1&state=state-1",
        store: expiredStore,
        clock: fixedClock(1100)
      })
    ).rejects.toThrowError(
      new DashboardApiClientError(
        "AUTH_STATE_EXPIRED",
        "Dashboard auth pending state is expired."
      )
    );
    expect(expiredStore.deleted).toEqual(["state-1"]);
  });

  it("deletes pending state when callback provider validation fails", async () => {
    const store = pendingAuthStore([pendingPkceState({ state: "state-1" })]);

    await expect(
      consumeDashboardCognitoPkceAuthCallback({
        config: hostedUiConfig(),
        callbackUrl:
          "https://app.searchlint.example/auth/callback?error=access_denied&error_description=Denied&state=state-1",
        store,
        clock: fixedClock(1100)
      })
    ).rejects.toThrowError(
      new DashboardApiClientError(
        "AUTH_PROVIDER_ERROR",
        "Cognito authorization failed: access_denied (Denied)."
      )
    );
    expect(store.deleted).toEqual(["state-1"]);
  });

  it("deletes invalid loaded pending state deterministically", async () => {
    const store = pendingAuthStore([
      pendingPkceState({
        state: "state-1",
        codeVerifier: ""
      })
    ]);

    await expect(
      consumeDashboardCognitoPkceAuthCallback({
        config: hostedUiConfig(),
        callbackUrl:
          "https://app.searchlint.example/auth/callback?code=code-1&state=state-1",
        store,
        clock: fixedClock(1100)
      })
    ).rejects.toThrowError(
      new DashboardApiClientError(
        "INVALID_AUTH_REQUEST",
        "Dashboard auth codeVerifier is required."
      )
    );
    expect(store.deleted).toEqual(["state-1"]);
  });
});

describe("completeDashboardCognitoPkceAuthCallback", () => {
  it("consumes pending PKCE state, exchanges the code, and saves the dashboard auth session", async () => {
    const pendingStore = pendingAuthStore([pendingPkceState()]);
    const sessionStore = authSessionStore();
    const tokenCalls: TokenFetchCall[] = [];

    await expect(
      completeDashboardCognitoPkceAuthCallback({
        config: hostedUiConfig(),
        callbackUrl:
          "https://app.searchlint.example/auth/callback?code=code-1&state=state-1",
        pendingAuthStore: pendingStore,
        sessionStore,
        fetch: fetchTokenJson(tokenCalls, {
          status: 200,
          body: {
            access_token: "access-token-1",
            id_token: "id-token-1",
            refresh_token: "refresh-token-1",
            expires_in: 3600,
            token_type: "Bearer"
          }
        }),
        clock: fixedClock(1000)
      })
    ).resolves.toEqual({
      callback: {
        code: "code-1",
        state: "state-1"
      },
      session: {
        accessToken: "access-token-1",
        expiresAt: 4600,
        tokenType: "Bearer",
        identityProvider: "cognito",
        idToken: "id-token-1",
        refreshToken: "refresh-token-1"
      }
    });

    expect(pendingStore.deleted).toEqual(["state-1"]);
    expect(sessionStore.saved).toEqual([
      {
        accessToken: "access-token-1",
        expiresAt: 4600,
        tokenType: "Bearer",
        identityProvider: "cognito",
        idToken: "id-token-1",
        refreshToken: "refresh-token-1"
      }
    ]);
    expect(tokenCalls).toEqual([
      {
        url: "https://auth.searchlint.example/oauth2/token",
        init: {
          method: "POST",
          headers: {
            accept: "application/json",
            "content-type": "application/x-www-form-urlencoded"
          },
          body: "grant_type=authorization_code&client_id=client-1&redirect_uri=https%3A%2F%2Fapp.searchlint.example%2Fauth%2Fcallback&code=code-1&code_verifier=verifier-1"
        }
      }
    ]);
  });

  it("forwards token endpoint signals during callback completion", async () => {
    const tokenCalls: TokenFetchCall[] = [];
    const signal = { aborted: false };

    await completeDashboardCognitoPkceAuthCallback({
      config: hostedUiConfig(),
      callbackUrl:
        "https://app.searchlint.example/auth/callback?code=code-1&state=state-1",
      pendingAuthStore: pendingAuthStore([pendingPkceState()]),
      sessionStore: authSessionStore(),
      fetch: fetchTokenJson(tokenCalls, {
        status: 200,
        body: {
          access_token: "access-token-1",
          expires_in: 3600,
          token_type: "Bearer"
        }
      }),
      clock: fixedClock(1000),
      signal
    });

    expect(tokenCalls[0]?.init.signal).toBe(signal);
  });

  it("does not save sessions when Cognito authorization callbacks fail", async () => {
    const pendingStore = pendingAuthStore([pendingPkceState()]);
    const sessionStore = authSessionStore();
    const tokenFetch = vi.fn<DashboardCognitoTokenFetch>();

    await expect(
      completeDashboardCognitoPkceAuthCallback({
        config: hostedUiConfig(),
        callbackUrl:
          "https://app.searchlint.example/auth/callback?error=access_denied&error_description=Denied&state=state-1",
        pendingAuthStore: pendingStore,
        sessionStore,
        fetch: tokenFetch,
        clock: fixedClock(1000)
      })
    ).rejects.toThrowError(
      new DashboardApiClientError(
        "AUTH_PROVIDER_ERROR",
        "Cognito authorization failed: access_denied (Denied)."
      )
    );

    expect(pendingStore.deleted).toEqual(["state-1"]);
    expect(sessionStore.saved).toEqual([]);
    expect(tokenFetch).not.toHaveBeenCalled();
  });

  it("does not save sessions when token exchange fails", async () => {
    const sessionStore = authSessionStore();

    await expect(
      completeDashboardCognitoPkceAuthCallback({
        config: hostedUiConfig(),
        callbackUrl:
          "https://app.searchlint.example/auth/callback?code=code-1&state=state-1",
        pendingAuthStore: pendingAuthStore([pendingPkceState()]),
        sessionStore,
        fetch: fetchTokenJson([], {
          status: 400,
          body: {
            error: "invalid_grant",
            error_description: "Code has expired"
          }
        }),
        clock: fixedClock(1000)
      })
    ).rejects.toThrowError(
      new DashboardApiClientError(
        "TOKEN_PROVIDER_ERROR",
        "Cognito token exchange failed: invalid_grant (Code has expired)."
      )
    );

    expect(sessionStore.saved).toEqual([]);
  });
});

describe("Dashboard external provider OAuth lifecycle", () => {
  it("starts provider OAuth and stores pending state without mutating browser location", async () => {
    const store = externalProviderPendingStore();
    const apiClient = externalProviderApiClient();

    await expect(
      startDashboardExternalProviderOAuth({
        apiClient,
        store,
        clock: fixedClock(1000),
        organizationId: "org-1",
        projectId: "project-1",
        environmentId: "env-1",
        provider: "google",
        state: "state-1",
        redirectUri: "https://app.searchlint.example/oauth/google/callback",
        scopes: ["scope-b", "scope-a"],
        codeChallenge: "challenge-1",
        codeVerifier: "verifier-1",
        ttlSeconds: 300
      })
    ).resolves.toEqual({
      authorizationUrl:
        "https://provider.example/google/authorize?state=state-1",
      pendingState: {
        provider: "google",
        organizationId: "org-1",
        projectId: "project-1",
        environmentId: "env-1",
        state: "state-1",
        redirectUri: "https://app.searchlint.example/oauth/google/callback",
        scopes: ["scope-a", "scope-b"],
        codeVerifier: "verifier-1",
        createdAt: 1000,
        expiresAt: 1300
      }
    });

    expect(apiClient.calls).toEqual([
      {
        operation: "start",
        params: {
          organizationId: "org-1",
          projectId: "project-1",
          environmentId: "env-1",
          provider: "google"
        },
        body: {
          state: "state-1",
          redirectUri: "https://app.searchlint.example/oauth/google/callback",
          scopes: ["scope-a", "scope-b"],
          codeChallenge: "challenge-1"
        }
      }
    ]);
    expect(store.saved).toEqual([
      {
        provider: "google",
        organizationId: "org-1",
        projectId: "project-1",
        environmentId: "env-1",
        state: "state-1",
        redirectUri: "https://app.searchlint.example/oauth/google/callback",
        scopes: ["scope-a", "scope-b"],
        codeVerifier: "verifier-1",
        createdAt: 1000,
        expiresAt: 1300
      }
    ]);
  });

  it("starts provider OAuth and redirects through the injected browser navigation port", async () => {
    const store = externalProviderPendingStore();
    const apiClient = externalProviderApiClient();
    const navigation = {
      assign: vi.fn()
    };

    await expect(
      redirectDashboardExternalProviderOAuth({
        apiClient,
        store,
        navigation,
        clock: fixedClock(1000),
        organizationId: "org-1",
        projectId: "project-1",
        environmentId: "env-1",
        provider: "google",
        state: "state-1",
        redirectUri: "https://app.searchlint.example/oauth/google/callback",
        scopes: ["scope-b", "scope-a"],
        ttlSeconds: 300
      })
    ).resolves.toEqual({
      authorizationUrl:
        "https://provider.example/google/authorize?state=state-1",
      pendingState: {
        provider: "google",
        organizationId: "org-1",
        projectId: "project-1",
        environmentId: "env-1",
        state: "state-1",
        redirectUri: "https://app.searchlint.example/oauth/google/callback",
        scopes: ["scope-a", "scope-b"],
        createdAt: 1000,
        expiresAt: 1300
      }
    });

    expect(navigation.assign).toHaveBeenCalledOnce();
    expect(navigation.assign).toHaveBeenCalledWith(
      "https://provider.example/google/authorize?state=state-1"
    );
  });

  it("rejects start response state/provider mismatches before saving pending state", async () => {
    const store = externalProviderPendingStore();
    const apiClient = externalProviderApiClient({
      startBody: {
        provider: "yandex",
        authorizationUrl: "https://provider.example/yandex/authorize",
        state: "other-state",
        redirectUri: "https://app.searchlint.example/oauth/yandex/callback",
        scopes: ["webmaster:read"]
      }
    });

    await expect(
      startDashboardExternalProviderOAuth({
        apiClient,
        store,
        clock: fixedClock(1000),
        organizationId: "org-1",
        projectId: "project-1",
        environmentId: "env-1",
        provider: "google",
        state: "state-1"
      })
    ).rejects.toThrowError(
      new DashboardApiClientError(
        "INVALID_AUTH_REQUEST",
        "Dashboard external provider OAuth start response provider does not match the request."
      )
    );
    expect(store.saved).toEqual([]);
  });

  it("does not redirect when start validation or pending-state save fails", async () => {
    const navigation = {
      assign: vi.fn()
    };

    await expect(
      redirectDashboardExternalProviderOAuth({
        apiClient: externalProviderApiClient({
          startBody: {
            provider: "yandex",
            authorizationUrl: "https://provider.example/yandex/authorize",
            state: "state-1",
            redirectUri: "https://app.searchlint.example/oauth/yandex/callback",
            scopes: ["webmaster:read"]
          }
        }),
        store: externalProviderPendingStore(),
        navigation,
        clock: fixedClock(1000),
        organizationId: "org-1",
        projectId: "project-1",
        environmentId: "env-1",
        provider: "google",
        state: "state-1"
      })
    ).rejects.toThrowError(
      new DashboardApiClientError(
        "INVALID_AUTH_REQUEST",
        "Dashboard external provider OAuth start response provider does not match the request."
      )
    );
    expect(navigation.assign).not.toHaveBeenCalled();

    const failingStore = externalProviderPendingStore();
    failingStore.save = () => {
      throw new Error("storage unavailable");
    };

    await expect(
      redirectDashboardExternalProviderOAuth({
        apiClient: externalProviderApiClient(),
        store: failingStore,
        navigation,
        clock: fixedClock(1000),
        organizationId: "org-1",
        projectId: "project-1",
        environmentId: "env-1",
        provider: "google",
        state: "state-2"
      })
    ).rejects.toThrowError("storage unavailable");
    expect(navigation.assign).not.toHaveBeenCalled();
  });

  it("maps browser navigation failures to deterministic client errors", async () => {
    const store = externalProviderPendingStore();
    const navigation = {
      assign: vi.fn(() => {
        throw new Error("navigation blocked");
      })
    };

    await expect(
      redirectDashboardExternalProviderOAuth({
        apiClient: externalProviderApiClient(),
        store,
        navigation,
        clock: fixedClock(1000),
        organizationId: "org-1",
        projectId: "project-1",
        environmentId: "env-1",
        provider: "google",
        state: "state-1"
      })
    ).rejects.toThrowError(
      new DashboardApiClientError(
        "TRANSPORT_ERROR",
        "Dashboard browser navigation failed: navigation blocked"
      )
    );
    expect(store.saved).toHaveLength(1);
    expect(navigation.assign).toHaveBeenCalledWith(
      "https://provider.example/google/authorize?state=state-1"
    );
  });

  it("consumes provider callbacks into backend completion requests", async () => {
    const store = externalProviderPendingStore([
      externalProviderPendingState({
        provider: "yandex",
        state: "state-1",
        redirectUri: "https://app.searchlint.example/oauth/yandex/callback",
        codeVerifier: "verifier-1",
        scopes: ["metrika:read", "webmaster:read"]
      })
    ]);

    await expect(
      consumeDashboardExternalProviderOAuthCallback({
        callbackUrl:
          "https://app.searchlint.example/oauth/yandex/callback?code=code-1&state=state-1",
        store,
        clock: fixedClock(1100)
      })
    ).resolves.toEqual({
      callback: {
        provider: "yandex",
        code: "code-1",
        state: "state-1"
      },
      completionRequest: {
        organizationId: "org-1",
        projectId: "project-1",
        environmentId: "env-1",
        provider: "yandex",
        body: {
          code: "code-1",
          redirectUri: "https://app.searchlint.example/oauth/yandex/callback",
          codeVerifier: "verifier-1",
          scopes: ["metrika:read", "webmaster:read"]
        }
      }
    });
    expect(store.deleted).toEqual(["state-1"]);
    expect(await store.load("state-1")).toBeUndefined();
  });

  it("deletes pending provider state when callbacks fail validation or expire", async () => {
    const providerErrorStore = externalProviderPendingStore([
      externalProviderPendingState({ state: "state-1" })
    ]);

    await expect(
      consumeDashboardExternalProviderOAuthCallback({
        callbackUrl:
          "https://app.searchlint.example/oauth/google/callback?error=access_denied&error_description=Denied&state=state-1",
        store: providerErrorStore,
        clock: fixedClock(1100)
      })
    ).rejects.toThrowError(
      new DashboardApiClientError(
        "AUTH_PROVIDER_ERROR",
        "External provider authorization failed: access_denied (Denied)."
      )
    );
    expect(providerErrorStore.deleted).toEqual(["state-1"]);

    const expiredStore = externalProviderPendingStore([
      externalProviderPendingState({
        state: "state-2",
        createdAt: 1000,
        expiresAt: 1100
      })
    ]);

    await expect(
      consumeDashboardExternalProviderOAuthCallback({
        callbackUrl:
          "https://app.searchlint.example/oauth/google/callback?code=code-1&state=state-2",
        store: expiredStore,
        clock: fixedClock(1100)
      })
    ).rejects.toThrowError(
      new DashboardApiClientError(
        "AUTH_STATE_EXPIRED",
        "Dashboard external provider OAuth pending state is expired."
      )
    );
    expect(expiredStore.deleted).toEqual(["state-2"]);
  });

  it("completes provider callbacks through the dashboard API client", async () => {
    const apiClient = externalProviderApiClient();
    const store = externalProviderPendingStore([
      externalProviderPendingState({
        provider: "google",
        state: "state-1",
        codeVerifier: "verifier-1",
        scopes: ["scope-a"]
      })
    ]);

    await expect(
      completeDashboardExternalProviderOAuthCallback({
        apiClient,
        callbackUrl:
          "https://app.searchlint.example/oauth/google/callback?code=code-1&state=state-1",
        store,
        clock: fixedClock(1100)
      })
    ).resolves.toEqual({
      callback: {
        provider: "google",
        code: "code-1",
        state: "state-1"
      },
      response: {
        status: 200,
        body: {
          oauthConnection: {
            id: "oauth-1"
          }
        }
      }
    });
    expect(apiClient.calls).toEqual([
      {
        operation: "complete",
        params: {
          organizationId: "org-1",
          projectId: "project-1",
          environmentId: "env-1",
          provider: "google"
        },
        body: {
          code: "code-1",
          redirectUri: "https://app.searchlint.example/oauth/google/callback",
          codeVerifier: "verifier-1",
          scopes: ["scope-a"]
        }
      }
    ]);
    expect(store.deleted).toEqual(["state-1"]);
  });
});

describe("createDashboardBrowserExternalProviderOAuthStore", () => {
  it("saves, loads, and deletes namespaced external provider OAuth pending states", () => {
    const storage = memoryStorage();
    const store = createDashboardBrowserExternalProviderOAuthStore({
      storage,
      namespace: "searchlint:external"
    });

    store.save(externalProviderPendingState({ state: "state/1" }));

    expect(storage.entries()).toEqual([
      [
        "searchlint:external:state%2F1",
        JSON.stringify(externalProviderPendingState({ state: "state/1" }))
      ]
    ]);
    expect(store.load("state/1")).toEqual(
      externalProviderPendingState({ state: "state/1" })
    );

    store.delete("state/1");
    expect(store.load("state/1")).toBeUndefined();
  });

  it("deletes corrupted JSON and invalid external provider pending states", () => {
    const corruptedStorage = memoryStorage([
      ["searchlint:external:state-1", "{not-json"]
    ]);
    const corruptedStore = createDashboardBrowserExternalProviderOAuthStore({
      storage: corruptedStorage,
      namespace: "searchlint:external"
    });

    expect(() => corruptedStore.load("state-1")).toThrowError(
      new DashboardApiClientError(
        "INVALID_AUTH_REQUEST",
        "Dashboard external provider OAuth pending state storage value must be valid JSON."
      )
    );
    expect(corruptedStorage.entries()).toEqual([]);

    const invalidStorage = memoryStorage([
      [
        "searchlint:external:state-1",
        JSON.stringify(
          externalProviderPendingState({ provider: "bing" as never })
        )
      ]
    ]);
    const invalidStore = createDashboardBrowserExternalProviderOAuthStore({
      storage: invalidStorage,
      namespace: "searchlint:external"
    });

    expect(() => invalidStore.load("state-1")).toThrowError(
      new DashboardApiClientError(
        "INVALID_AUTH_REQUEST",
        "Dashboard external provider OAuth provider must be google or yandex."
      )
    );
    expect(invalidStorage.entries()).toEqual([]);
  });
});

describe("createDashboardBrowserPkceAuthStore", () => {
  it("saves, loads, and deletes namespaced pending PKCE auth states", () => {
    const storage = memoryStorage();
    const store = createDashboardBrowserPkceAuthStore({
      storage,
      namespace: "searchlint:test"
    });

    store.save(pendingPkceState({ state: "state/1" }));

    expect(storage.entries()).toEqual([
      [
        "searchlint:test:state%2F1",
        JSON.stringify(pendingPkceState({ state: "state/1" }))
      ]
    ]);
    expect(store.load("state/1")).toEqual(
      pendingPkceState({ state: "state/1" })
    );

    store.delete("state/1");
    expect(store.load("state/1")).toBeUndefined();
  });

  it("rejects invalid storage namespaces before storage access", () => {
    const storage = memoryStorage();

    expect(() =>
      createDashboardBrowserPkceAuthStore({
        storage,
        namespace: " "
      })
    ).toThrowError(
      new DashboardApiClientError(
        "INVALID_AUTH_REQUEST",
        "Dashboard auth storage namespace is required."
      )
    );
    expect(storage.calls).toEqual([]);
  });

  it("deletes corrupted JSON and invalid stored pending states", () => {
    const corruptedStorage = memoryStorage([
      ["searchlint:test:state-1", "{not-json"]
    ]);
    const corruptedStore = createDashboardBrowserPkceAuthStore({
      storage: corruptedStorage,
      namespace: "searchlint:test"
    });

    expect(() => corruptedStore.load("state-1")).toThrowError(
      new DashboardApiClientError(
        "INVALID_AUTH_REQUEST",
        "Dashboard auth pending state storage value must be valid JSON."
      )
    );
    expect(corruptedStorage.entries()).toEqual([]);

    const invalidStorage = memoryStorage([
      [
        "searchlint:test:state-1",
        JSON.stringify(pendingPkceState({ codeVerifier: "" }))
      ]
    ]);
    const invalidStore = createDashboardBrowserPkceAuthStore({
      storage: invalidStorage,
      namespace: "searchlint:test"
    });

    expect(() => invalidStore.load("state-1")).toThrowError(
      new DashboardApiClientError(
        "INVALID_AUTH_REQUEST",
        "Dashboard auth codeVerifier is required."
      )
    );
    expect(invalidStorage.entries()).toEqual([]);
  });

  it("maps storage operation failures deterministically", () => {
    expect(() =>
      createDashboardBrowserPkceAuthStore({
        storage: failingStorage("setItem"),
        namespace: "searchlint:test"
      }).save(pendingPkceState())
    ).toThrowError(
      new DashboardApiClientError(
        "AUTH_STORAGE_ERROR",
        "Dashboard auth storage write failed: setItem failed"
      )
    );

    expect(() =>
      createDashboardBrowserPkceAuthStore({
        storage: failingStorage("getItem"),
        namespace: "searchlint:test"
      }).load("state-1")
    ).toThrowError(
      new DashboardApiClientError(
        "AUTH_STORAGE_ERROR",
        "Dashboard auth storage read failed: getItem failed"
      )
    );

    expect(() =>
      createDashboardBrowserPkceAuthStore({
        storage: failingStorage("removeItem"),
        namespace: "searchlint:test"
      }).delete("state-1")
    ).toThrowError(
      new DashboardApiClientError(
        "AUTH_STORAGE_ERROR",
        "Dashboard auth storage delete failed: removeItem failed"
      )
    );
  });
});

describe("createDashboardBrowserAuthSessionStore", () => {
  it("saves, loads, and deletes namespaced dashboard auth sessions", () => {
    const storage = memoryStorage();
    const store = createDashboardBrowserAuthSessionStore({
      storage,
      namespace: "searchlint:session"
    });
    const authSession = session({
      accessToken: "access-token-1",
      idToken: "id-token-1",
      refreshToken: "refresh-token-1",
      expiresAt: 4600
    });

    store.save(authSession);

    expect(storage.entries()).toEqual([
      ["searchlint:session:current", JSON.stringify(authSession)]
    ]);
    expect(store.load()).toEqual(authSession);

    store.delete();
    expect(store.load()).toBeUndefined();
  });

  it("rejects invalid session storage namespaces before storage access", () => {
    const storage = memoryStorage();

    expect(() =>
      createDashboardBrowserAuthSessionStore({
        storage,
        namespace: ""
      })
    ).toThrowError(
      new DashboardApiClientError(
        "INVALID_AUTH_REQUEST",
        "Dashboard auth storage namespace is required."
      )
    );
    expect(storage.calls).toEqual([]);
  });

  it("deletes corrupted JSON and invalid stored sessions", () => {
    const corruptedStorage = memoryStorage([
      ["searchlint:session:current", "{not-json"]
    ]);
    const corruptedStore = createDashboardBrowserAuthSessionStore({
      storage: corruptedStorage,
      namespace: "searchlint:session"
    });

    expect(() => corruptedStore.load()).toThrowError(
      new DashboardApiClientError(
        "INVALID_AUTH_SESSION",
        "Dashboard auth session storage value must be valid JSON."
      )
    );
    expect(corruptedStorage.entries()).toEqual([]);

    const invalidStorage = memoryStorage([
      [
        "searchlint:session:current",
        JSON.stringify(session({ tokenType: "Basic" as "Bearer" }))
      ]
    ]);
    const invalidStore = createDashboardBrowserAuthSessionStore({
      storage: invalidStorage,
      namespace: "searchlint:session"
    });

    expect(() => invalidStore.load()).toThrowError(
      new DashboardApiClientError(
        "INVALID_AUTH_SESSION",
        "Dashboard auth session token type must be Bearer."
      )
    );
    expect(invalidStorage.entries()).toEqual([]);
  });

  it("maps session storage operation failures deterministically", () => {
    expect(() =>
      createDashboardBrowserAuthSessionStore({
        storage: failingStorage("setItem"),
        namespace: "searchlint:session"
      }).save(session())
    ).toThrowError(
      new DashboardApiClientError(
        "AUTH_STORAGE_ERROR",
        "Dashboard auth storage write failed: setItem failed"
      )
    );

    expect(() =>
      createDashboardBrowserAuthSessionStore({
        storage: failingStorage("getItem"),
        namespace: "searchlint:session"
      }).load()
    ).toThrowError(
      new DashboardApiClientError(
        "AUTH_STORAGE_ERROR",
        "Dashboard auth storage read failed: getItem failed"
      )
    );

    expect(() =>
      createDashboardBrowserAuthSessionStore({
        storage: failingStorage("removeItem"),
        namespace: "searchlint:session"
      }).delete()
    ).toThrowError(
      new DashboardApiClientError(
        "AUTH_STORAGE_ERROR",
        "Dashboard auth storage delete failed: removeItem failed"
      )
    );
  });
});

describe("exchangeDashboardCognitoAuthorizationCode", () => {
  it("posts authorization-code PKCE forms to the Cognito token endpoint", async () => {
    const calls: TokenFetchCall[] = [];
    const fetcher = fetchTokenJson(calls, {
      status: 200,
      body: {
        access_token: "access-token-1",
        id_token: "id-token-1",
        refresh_token: "refresh-token-1",
        expires_in: 3600,
        token_type: "Bearer"
      }
    });

    await expect(
      exchangeDashboardCognitoAuthorizationCode({
        hostedUiDomain: "https://auth.searchlint.example",
        clientId: "client-1",
        redirectUri: "https://app.searchlint.example/auth/callback",
        code: "code-1",
        codeVerifier: "verifier-1",
        fetch: fetcher,
        clock: fixedClock(1000)
      })
    ).resolves.toEqual({
      accessToken: "access-token-1",
      expiresAt: 4600,
      tokenType: "Bearer",
      identityProvider: "cognito",
      idToken: "id-token-1",
      refreshToken: "refresh-token-1"
    });

    expect(calls).toEqual([
      {
        url: "https://auth.searchlint.example/oauth2/token",
        init: {
          method: "POST",
          headers: {
            accept: "application/json",
            "content-type": "application/x-www-form-urlencoded"
          },
          body: "grant_type=authorization_code&client_id=client-1&redirect_uri=https%3A%2F%2Fapp.searchlint.example%2Fauth%2Fcallback&code=code-1&code_verifier=verifier-1"
        }
      }
    ]);
  });

  it("rejects invalid exchange inputs before fetch execution", async () => {
    const fetcher = vi.fn<DashboardCognitoTokenFetch>();

    await expect(
      exchangeDashboardCognitoAuthorizationCode({
        hostedUiDomain: "https://auth.searchlint.example/path",
        clientId: "client-1",
        redirectUri: "https://app.searchlint.example/auth/callback",
        code: "code-1",
        codeVerifier: "verifier-1",
        fetch: fetcher,
        clock: fixedClock(1000)
      })
    ).rejects.toThrowError(
      new DashboardApiClientError(
        "INVALID_AUTH_REQUEST",
        "Dashboard Cognito hosted UI domain must not include a path, query, or fragment."
      )
    );

    await expect(
      exchangeDashboardCognitoAuthorizationCode({
        hostedUiDomain: "https://auth.searchlint.example",
        clientId: "client-1",
        redirectUri: "https://app.searchlint.example/auth/callback",
        code: " ",
        codeVerifier: "verifier-1",
        fetch: fetcher,
        clock: fixedClock(1000)
      })
    ).rejects.toThrowError(
      new DashboardApiClientError(
        "INVALID_AUTH_REQUEST",
        "Dashboard auth code is required."
      )
    );

    expect(fetcher).not.toHaveBeenCalled();
  });

  it("maps Cognito token endpoint provider errors deterministically", async () => {
    await expect(
      exchangeDashboardCognitoAuthorizationCode({
        hostedUiDomain: "https://auth.searchlint.example",
        clientId: "client-1",
        redirectUri: "https://app.searchlint.example/auth/callback",
        code: "code-1",
        codeVerifier: "verifier-1",
        fetch: fetchTokenJson([], {
          status: 400,
          body: {
            error: "invalid_grant",
            error_description: "Code has expired"
          }
        }),
        clock: fixedClock(1000)
      })
    ).rejects.toThrowError(
      new DashboardApiClientError(
        "TOKEN_PROVIDER_ERROR",
        "Cognito token exchange failed: invalid_grant (Code has expired)."
      )
    );

    await expect(
      exchangeDashboardCognitoAuthorizationCode({
        hostedUiDomain: "https://auth.searchlint.example",
        clientId: "client-1",
        redirectUri: "https://app.searchlint.example/auth/callback",
        code: "code-1",
        codeVerifier: "verifier-1",
        fetch: fetchTokenJson([], {
          status: 400,
          body: {
            error: "invalid_request",
            error_description: " "
          }
        }),
        clock: fixedClock(1000)
      })
    ).rejects.toThrowError(
      new DashboardApiClientError(
        "TOKEN_PROVIDER_ERROR",
        "Cognito token exchange failed: invalid_request."
      )
    );
  });

  it("rejects malformed token responses deterministically", async () => {
    await expect(
      exchangeDashboardCognitoAuthorizationCode({
        hostedUiDomain: "https://auth.searchlint.example",
        clientId: "client-1",
        redirectUri: "https://app.searchlint.example/auth/callback",
        code: "code-1",
        codeVerifier: "verifier-1",
        fetch: fetchTokenJson([], {
          status: 200,
          body: {
            access_token: "access-token-1",
            expires_in: 3600,
            token_type: "bearer"
          }
        }),
        clock: fixedClock(1000)
      })
    ).rejects.toThrowError(
      new DashboardApiClientError(
        "INVALID_TOKEN_EXCHANGE",
        "Cognito token exchange token_type must be Bearer."
      )
    );

    await expect(
      exchangeDashboardCognitoAuthorizationCode({
        hostedUiDomain: "https://auth.searchlint.example",
        clientId: "client-1",
        redirectUri: "https://app.searchlint.example/auth/callback",
        code: "code-1",
        codeVerifier: "verifier-1",
        fetch: fetchTokenJson([], {
          status: 200,
          body: {
            access_token: "access-token-1",
            expires_in: 0,
            token_type: "Bearer"
          }
        }),
        clock: fixedClock(1000)
      })
    ).rejects.toThrowError(
      new DashboardApiClientError(
        "INVALID_TOKEN_EXCHANGE",
        "Cognito token exchange expires_in must be a positive integer."
      )
    );
  });

  it("wraps token endpoint transport failures", async () => {
    await expect(
      exchangeDashboardCognitoAuthorizationCode({
        hostedUiDomain: "https://auth.searchlint.example",
        clientId: "client-1",
        redirectUri: "https://app.searchlint.example/auth/callback",
        code: "code-1",
        codeVerifier: "verifier-1",
        fetch: async () => {
          throw new Error("network down");
        },
        clock: fixedClock(1000)
      })
    ).rejects.toMatchObject({
      code: "TRANSPORT_ERROR",
      message: "Cognito token exchange failed: network down"
    });
  });
});

describe("refreshDashboardCognitoAuthSession", () => {
  it("posts refresh-token forms to the Cognito token endpoint and preserves the existing refresh token", async () => {
    const calls: TokenFetchCall[] = [];
    const fetcher = fetchTokenJson(calls, {
      status: 200,
      body: {
        access_token: "access-token-2",
        id_token: "id-token-2",
        expires_in: 1800,
        token_type: "Bearer"
      }
    });

    await expect(
      refreshDashboardCognitoAuthSession({
        hostedUiDomain: "https://auth.searchlint.example",
        clientId: "client-1",
        refreshToken: "refresh-token-1",
        fetch: fetcher,
        clock: fixedClock(1000)
      })
    ).resolves.toEqual({
      accessToken: "access-token-2",
      expiresAt: 2800,
      tokenType: "Bearer",
      identityProvider: "cognito",
      idToken: "id-token-2",
      refreshToken: "refresh-token-1"
    });

    expect(calls).toEqual([
      {
        url: "https://auth.searchlint.example/oauth2/token",
        init: {
          method: "POST",
          headers: {
            accept: "application/json",
            "content-type": "application/x-www-form-urlencoded"
          },
          body: "grant_type=refresh_token&client_id=client-1&refresh_token=refresh-token-1"
        }
      }
    ]);
  });

  it("uses provider-returned refresh tokens when Cognito rotates the token", async () => {
    await expect(
      refreshDashboardCognitoAuthSession({
        hostedUiDomain: "https://auth.searchlint.example",
        clientId: "client-1",
        refreshToken: "refresh-token-1",
        fetch: fetchTokenJson([], {
          status: 200,
          body: {
            access_token: "access-token-2",
            refresh_token: "refresh-token-2",
            expires_in: 1800,
            token_type: "Bearer"
          }
        }),
        clock: fixedClock(1000)
      })
    ).resolves.toMatchObject({
      accessToken: "access-token-2",
      refreshToken: "refresh-token-2"
    });
  });

  it("rejects invalid refresh inputs before fetch execution", async () => {
    const fetcher = vi.fn<DashboardCognitoTokenFetch>();

    await expect(
      refreshDashboardCognitoAuthSession({
        hostedUiDomain: "https://auth.searchlint.example/path",
        clientId: "client-1",
        refreshToken: "refresh-token-1",
        fetch: fetcher,
        clock: fixedClock(1000)
      })
    ).rejects.toThrowError(
      new DashboardApiClientError(
        "INVALID_AUTH_REQUEST",
        "Dashboard Cognito hosted UI domain must not include a path, query, or fragment."
      )
    );

    await expect(
      refreshDashboardCognitoAuthSession({
        hostedUiDomain: "https://auth.searchlint.example",
        clientId: "client-1",
        refreshToken: " ",
        fetch: fetcher,
        clock: fixedClock(1000)
      })
    ).rejects.toThrowError(
      new DashboardApiClientError(
        "INVALID_AUTH_REQUEST",
        "Dashboard auth refreshToken is required."
      )
    );

    expect(fetcher).not.toHaveBeenCalled();
  });

  it("maps Cognito refresh provider errors deterministically", async () => {
    await expect(
      refreshDashboardCognitoAuthSession({
        hostedUiDomain: "https://auth.searchlint.example",
        clientId: "client-1",
        refreshToken: "refresh-token-1",
        fetch: fetchTokenJson([], {
          status: 400,
          body: {
            error: "invalid_grant",
            error_description: "Refresh token has expired"
          }
        }),
        clock: fixedClock(1000)
      })
    ).rejects.toThrowError(
      new DashboardApiClientError(
        "TOKEN_PROVIDER_ERROR",
        "Cognito token exchange failed: invalid_grant (Refresh token has expired)."
      )
    );
  });

  it("rejects malformed refresh responses deterministically", async () => {
    await expect(
      refreshDashboardCognitoAuthSession({
        hostedUiDomain: "https://auth.searchlint.example",
        clientId: "client-1",
        refreshToken: "refresh-token-1",
        fetch: fetchTokenJson([], {
          status: 200,
          body: {
            access_token: "access-token-2",
            expires_in: 1800,
            token_type: "bearer"
          }
        }),
        clock: fixedClock(1000)
      })
    ).rejects.toThrowError(
      new DashboardApiClientError(
        "INVALID_TOKEN_EXCHANGE",
        "Cognito token exchange token_type must be Bearer."
      )
    );
  });

  it("wraps refresh token endpoint transport failures", async () => {
    await expect(
      refreshDashboardCognitoAuthSession({
        hostedUiDomain: "https://auth.searchlint.example",
        clientId: "client-1",
        refreshToken: "refresh-token-1",
        fetch: async () => {
          throw new Error("network down");
        },
        clock: fixedClock(1000)
      })
    ).rejects.toMatchObject({
      code: "TRANSPORT_ERROR",
      message: "Cognito token exchange failed: network down"
    });
  });
});

type FetchCall = {
  url: string;
  init: DashboardApiFetchRequestInit;
};

type TokenFetchCall = {
  url: string;
  init: DashboardCognitoTokenFetchRequestInit;
};

type TestPendingAuthStore = DashboardCognitoPendingAuthStore & {
  saved: DashboardCognitoPendingPkceAuthState[];
  deleted: string[];
};

type TestExternalProviderPendingStore =
  DashboardExternalProviderOAuthPendingStore & {
    saved: DashboardExternalProviderOAuthPendingState[];
    deleted: string[];
  };

type TestExternalProviderApiClient = DashboardApiClient & {
  calls: Array<{
    operation: "start" | "complete";
    params: unknown;
    body: unknown;
  }>;
};

type TestStorage = DashboardBrowserStorageLike & {
  calls: string[];
  entries(): [string, string][];
};

type TestSessionStore = DashboardAuthSessionStore & {
  saved: DashboardAuthSession[];
  loadCount: number;
  deleted: number;
};

function fetchJson(
  calls: FetchCall[],
  response: { status: number; body: unknown }
): DashboardApiFetch {
  return async (url, init) => {
    calls.push({ url, init });
    return {
      status: response.status,
      headers: {
        get(name) {
          return name.toLowerCase() === "content-type"
            ? "application/json"
            : null;
        }
      },
      async json() {
        return response.body;
      }
    };
  };
}

function fetchText(value: string): DashboardApiFetch {
  return async () => ({
    status: 202,
    headers: {
      get(name) {
        return name.toLowerCase() === "content-type" ? "text/plain" : null;
      }
    },
    async json() {
      throw new Error("JSON should not be parsed for text responses.");
    },
    async text() {
      return value;
    }
  });
}

function fetchTokenJson(
  calls: TokenFetchCall[],
  response: { status: number; body: unknown }
): DashboardCognitoTokenFetch {
  return async (url, init) => {
    calls.push({ url, init });
    return {
      status: response.status,
      headers: {
        get(name) {
          return name.toLowerCase() === "content-type"
            ? "application/json"
            : null;
        }
      },
      async json() {
        return response.body;
      }
    };
  };
}

function pendingAuthStore(
  initialStates: readonly DashboardCognitoPendingPkceAuthState[] = []
): TestPendingAuthStore {
  const states = new Map(
    initialStates.map((state) => [state.state, state] as const)
  );
  return {
    saved: [],
    deleted: [],
    save(state) {
      this.saved.push(state);
      states.set(state.state, state);
    },
    load(state) {
      return states.get(state);
    },
    delete(state) {
      this.deleted.push(state);
      states.delete(state);
    }
  };
}

function externalProviderPendingStore(
  initialStates: readonly DashboardExternalProviderOAuthPendingState[] = []
): TestExternalProviderPendingStore {
  const states = new Map(
    initialStates.map((state) => [state.state, state] as const)
  );
  return {
    saved: [],
    deleted: [],
    save(state) {
      this.saved.push(state);
      states.set(state.state, state);
    },
    load(state) {
      return states.get(state);
    },
    delete(state) {
      this.deleted.push(state);
      states.delete(state);
    }
  };
}

function externalProviderApiClient(
  options: {
    startBody?: unknown;
    completeBody?: unknown;
  } = {}
): TestExternalProviderApiClient {
  const calls: TestExternalProviderApiClient["calls"] = [];
  return {
    calls,
    async createProject() {
      return { status: 200, body: {} };
    },
    async createEnvironment() {
      return { status: 200, body: {} };
    },
    async getDashboardSnapshot() {
      return { status: 200, body: {} };
    },
    async requestCrawl() {
      return { status: 200, body: {} };
    },
    async addMember() {
      return { status: 200, body: {} };
    },
    async startExternalProviderOAuthConnection(params, body) {
      calls.push({ operation: "start", params, body });
      return {
        status: 200,
        body: options.startBody ?? {
          provider: params.provider,
          authorizationUrl: `https://provider.example/${params.provider}/authorize?state=${body.state}`,
          state: body.state,
          redirectUri:
            body.redirectUri ??
            `https://app.searchlint.example/oauth/${params.provider}/callback`,
          scopes: [...new Set(body.scopes ?? ["default-scope"])].sort()
        }
      };
    },
    async completeExternalProviderOAuthConnection(params, body) {
      calls.push({ operation: "complete", params, body });
      return {
        status: 200,
        body: options.completeBody ?? {
          oauthConnection: {
            id: "oauth-1"
          }
        }
      };
    }
  };
}

function memoryStorage(
  initialEntries: readonly [string, string][] = []
): TestStorage {
  const values = new Map(initialEntries);
  return {
    calls: [],
    getItem(key) {
      this.calls.push(`getItem:${key}`);
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      this.calls.push(`setItem:${key}`);
      values.set(key, value);
    },
    removeItem(key) {
      this.calls.push(`removeItem:${key}`);
      values.delete(key);
    },
    entries() {
      return [...values.entries()].sort(([left], [right]) =>
        left.localeCompare(right)
      );
    }
  };
}

function failingStorage(
  operation: "getItem" | "setItem" | "removeItem"
): DashboardBrowserStorageLike {
  return {
    getItem() {
      if (operation === "getItem") {
        throw new Error("getItem failed");
      }
      return null;
    },
    setItem() {
      if (operation === "setItem") {
        throw new Error("setItem failed");
      }
    },
    removeItem() {
      if (operation === "removeItem") {
        throw new Error("removeItem failed");
      }
    }
  };
}

function authSessionStore(
  initialSession?: DashboardAuthSession
): TestSessionStore {
  let storedSession = initialSession;
  return {
    saved: [],
    loadCount: 0,
    deleted: 0,
    save(session) {
      this.saved.push(session);
      storedSession = session;
    },
    load() {
      this.loadCount += 1;
      return storedSession;
    },
    delete() {
      this.deleted += 1;
      storedSession = undefined;
    }
  };
}

function hostedUiConfig() {
  return {
    hostedUiDomain: "https://auth.searchlint.example",
    clientId: "client-1",
    redirectUri: "https://app.searchlint.example/auth/callback",
    scopes: ["openid", "email", "profile"]
  };
}

function pendingPkceState(
  overrides: Partial<DashboardCognitoPendingPkceAuthState> = {}
): DashboardCognitoPendingPkceAuthState {
  return {
    state: "state-1",
    nonce: "nonce-1",
    codeChallenge: "challenge-1",
    redirectUri: "https://app.searchlint.example/auth/callback",
    codeVerifier: "verifier-1",
    createdAt: 1000,
    expiresAt: 1600,
    ...overrides
  };
}

function externalProviderPendingState(
  overrides: Partial<DashboardExternalProviderOAuthPendingState> = {}
): DashboardExternalProviderOAuthPendingState {
  return {
    provider: "google",
    organizationId: "org-1",
    projectId: "project-1",
    environmentId: "env-1",
    state: "state-1",
    redirectUri: "https://app.searchlint.example/oauth/google/callback",
    scopes: ["scope-a"],
    createdAt: 1000,
    expiresAt: 1600,
    ...overrides
  };
}

function session(
  overrides: Partial<DashboardAuthSession> = {}
): DashboardAuthSession {
  return {
    accessToken: "access-token",
    expiresAt: 2000,
    tokenType: "Bearer",
    identityProvider: "cognito",
    subject: "principal-1",
    issuer: "https://cognito-idp.us-east-1.amazonaws.com/pool",
    ...overrides
  };
}

function fixedClock(now: number): { now(): number } {
  return {
    now() {
      return now;
    }
  };
}

function pendingState(
  overrides: Partial<DashboardCognitoPendingAuthState> = {}
): DashboardCognitoPendingAuthState {
  return {
    state: "state-1",
    nonce: "nonce-1",
    codeChallenge: "challenge-1",
    redirectUri: "https://app.searchlint.example/auth/callback",
    ...overrides
  };
}
