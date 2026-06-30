#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { format } from "prettier";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const generatedAt = "2026-06-22T00:00:00.000Z";
const reportPath = path.join(
  repoRoot,
  "reports/auth-oauth-callbacks-static-report.json"
);
const samplePath = path.join(
  repoRoot,
  "docs/examples/auth-oauth-callbacks-static-report.sample.json"
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
  run("pnpm", ["--filter", "@searchlint/dashboard...", "build"]);
  run("pnpm", [
    "--filter",
    "@searchlint/dashboard",
    "test",
    "--",
    "api-client.test.ts"
  ]);
  run("pnpm", [
    "--filter",
    "@searchlint/api",
    "test",
    "--",
    "http-dispatcher.test.ts",
    "external-provider-oauth-authorization.test.ts"
  ]);
  run("pnpm", ["--filter", "@searchlint/api", "build"]);

  const dashboard = await import("../apps/dashboard/dist/src/index.js");
  const api = await import("../services/api/dist/src/index.js");
  const cognitoEvidence = await verifyCognitoCallback(dashboard);
  const externalEvidence = await verifyExternalProviderCallbacks(dashboard);
  const dispatcherEvidence = await verifyApiDispatcherCallbacks(api);

  const report = {
    schemaVersion: 1,
    generatedBy: "searchlint-auth-oauth-callbacks-static-verifier",
    generatedAt,
    status: "static-oauth-callbacks-passed-live-release-blocked",
    scope: {
      proofType: "deterministic static dashboard/API OAuth callback contract",
      liveAwsAccess: "not used by verifier",
      liveProviderAccess: "not used by verifier",
      doesNotClaim: [
        "live Cognito Hosted UI callback",
        "live Google OAuth callback",
        "live Yandex OAuth callback",
        "real provider authorization-code exchange",
        "deployed dashboard/API OAuth callback behavior"
      ]
    },
    commands: [
      {
        command:
          "pnpm --filter @searchlint/dashboard test -- api-client.test.ts",
        status: "passed"
      },
      {
        command:
          "pnpm --filter @searchlint/api test -- http-dispatcher.test.ts external-provider-oauth-authorization.test.ts",
        status: "passed"
      },
      {
        command: "pnpm --filter @searchlint/dashboard build",
        status: "passed"
      },
      {
        command: "pnpm --filter @searchlint/api build",
        status: "passed"
      }
    ],
    cognitoCallback: cognitoEvidence,
    externalProviderCallbacks: externalEvidence,
    apiCallbackRoutes: dispatcherEvidence,
    remainingReleaseGates: [
      "deploy Cognito Hosted UI and dashboard callback routes",
      "prove AWS-issued Cognito callback and token exchange in a real browser",
      "configure live Google and Yandex OAuth apps",
      "prove live Google/Yandex callback code exchange and token storage",
      "prove deployed dashboard/API OAuth callback behavior"
    ]
  };

  await writeJson(reportPath, report);
  await writeJson(samplePath, report);
  console.log(
    "Auth OAuth callbacks static acceptance PASS: Cognito and provider callback contracts verified"
  );
  console.log(`Report: ${path.relative(repoRoot, reportPath)}`);
  console.log(`Sample: ${path.relative(repoRoot, samplePath)}`);
}

async function verifyCognitoCallback(dashboard) {
  const pendingStore = createPendingStore([
    pendingPkceState({
      state: "state-1",
      codeVerifier: "verifier-1"
    })
  ]);
  const consumed = await dashboard.consumeDashboardCognitoPkceAuthCallback({
    config: hostedUiConfig(),
    callbackUrl:
      "https://app.searchlint.example/auth/callback?code=code-1&state=state-1&iss=https%3A%2F%2Fauth.searchlint.example",
    store: pendingStore,
    clock: fixedClock(1100)
  });
  assert(
    consumed.callback.code === "code-1" &&
      consumed.callback.state === "state-1",
    "Cognito callback code/state parsing drifted."
  );
  assert(
    consumed.tokenExchangeRequest.codeVerifier === "verifier-1" &&
      consumed.tokenExchangeRequest.redirectUri ===
        "https://app.searchlint.example/auth/callback",
    "Cognito callback token-exchange request drifted."
  );
  assert(
    pendingStore.deleted.includes("state-1"),
    "Cognito callback must delete consumed pending state."
  );

  const completePendingStore = createPendingStore([
    pendingPkceState({
      state: "state-2",
      codeVerifier: "verifier-2"
    })
  ]);
  const sessionStore = createSessionStore();
  const tokenCalls = [];
  const completed = await dashboard.completeDashboardCognitoPkceAuthCallback({
    config: hostedUiConfig(),
    callbackUrl:
      "https://app.searchlint.example/auth/callback?code=code-2&state=state-2",
    pendingAuthStore: completePendingStore,
    sessionStore,
    fetch: tokenFetch(tokenCalls, {
      access_token: "access-token-2",
      id_token: "id-token-2",
      refresh_token: "refresh-token-2",
      expires_in: 3600,
      token_type: "Bearer"
    }),
    clock: fixedClock(1000)
  });
  assert(
    completed.session.accessToken === "access-token-2" &&
      sessionStore.saved[0]?.refreshToken === "refresh-token-2",
    "Cognito callback completion must save exchanged dashboard session."
  );
  assert(
    tokenCalls[0]?.init.body ===
      "grant_type=authorization_code&client_id=client-1&redirect_uri=https%3A%2F%2Fapp.searchlint.example%2Fauth%2Fcallback&code=code-2&code_verifier=verifier-2",
    "Cognito callback token POST body drifted."
  );

  const mismatchStore = createPendingStore([pendingPkceState()]);
  const mismatchError = await captureError(() =>
    dashboard.consumeDashboardCognitoPkceAuthCallback({
      config: hostedUiConfig(),
      callbackUrl:
        "https://app.searchlint.example/auth/callback?code=code-1&state=wrong-state",
      store: mismatchStore,
      clock: fixedClock(1100)
    })
  );
  assert(
    mismatchError.code === "AUTH_STATE_NOT_FOUND" ||
      mismatchError.code === "AUTH_STATE_MISMATCH",
    "Cognito callback mismatch must fail deterministically."
  );

  const providerErrorStore = createPendingStore([pendingPkceState()]);
  const providerError = await captureError(() =>
    dashboard.consumeDashboardCognitoPkceAuthCallback({
      config: hostedUiConfig(),
      callbackUrl:
        "https://app.searchlint.example/auth/callback?error=access_denied&error_description=Denied&state=state-1",
      store: providerErrorStore,
      clock: fixedClock(1100)
    })
  );
  assert(
    providerError.code === "AUTH_PROVIDER_ERROR" &&
      providerErrorStore.deleted.includes("state-1"),
    "Cognito provider errors must delete pending state."
  );

  return {
    consumedCallback: consumed.callback,
    tokenExchangeRequest: consumed.tokenExchangeRequest,
    tokenPostBody: tokenCalls[0].init.body,
    sessionSaved: sessionStore.saved.length === 1,
    pendingStateDeleted: pendingStore.deleted,
    providerError: {
      code: providerError.code,
      pendingStateDeleted: providerErrorStore.deleted
    },
    mismatchError: {
      code: mismatchError.code,
      message: mismatchError.message
    }
  };
}

async function verifyExternalProviderCallbacks(dashboard) {
  const apiClient = createExternalProviderApiClient();
  const store = createExternalPendingStore();
  const started = await dashboard.startDashboardExternalProviderOAuth({
    apiClient,
    store,
    clock: fixedClock(1000),
    organizationId: "org-1",
    projectId: "project-1",
    environmentId: "env-1",
    provider: "google",
    state: "state-google-1",
    redirectUri: "https://app.searchlint.example/oauth/google/callback",
    scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
    codeChallenge: "challenge-1",
    codeVerifier: "verifier-1"
  });
  assert(
    started.authorizationUrl.includes("state-google-1") &&
      store.saved[0]?.codeVerifier === "verifier-1",
    "External provider OAuth start must save pending PKCE state."
  );

  const consumed =
    await dashboard.consumeDashboardExternalProviderOAuthCallback({
      callbackUrl:
        "https://app.searchlint.example/oauth/google/callback?code=google-code-1&state=state-google-1",
      store,
      clock: fixedClock(1100)
    });
  assert(
    consumed.callback.provider === "google" &&
      consumed.callback.code === "google-code-1",
    "External provider callback parsing drifted."
  );
  assert(
    consumed.completionRequest.body.codeVerifier === "verifier-1" &&
      consumed.completionRequest.body.redirectUri ===
        "https://app.searchlint.example/oauth/google/callback",
    "External provider callback completion request drifted."
  );
  assert(
    store.deleted.includes("state-google-1"),
    "External provider callback must delete consumed pending state."
  );

  const completeStore = createExternalPendingStore([
    externalPendingState({
      provider: "yandex",
      state: "state-yandex-1",
      redirectUri: "https://app.searchlint.example/oauth/yandex/callback",
      scopes: ["webmaster:read", "metrika:read"],
      codeVerifier: "verifier-yandex-1"
    })
  ]);
  const completed =
    await dashboard.completeDashboardExternalProviderOAuthCallback({
      apiClient,
      callbackUrl:
        "https://app.searchlint.example/oauth/yandex/callback?code=yandex-code-1&state=state-yandex-1",
      store: completeStore,
      clock: fixedClock(1100)
    });
  assert(
    completed.response.body.oauthConnection.id === "oauth-yandex-1",
    "External provider callback must call API completion."
  );

  const providerErrorStore = createExternalPendingStore([
    externalPendingState({ state: "state-error-1" })
  ]);
  const providerError = await captureError(() =>
    dashboard.consumeDashboardExternalProviderOAuthCallback({
      callbackUrl:
        "https://app.searchlint.example/oauth/google/callback?error=access_denied&error_description=Denied&state=state-error-1",
      store: providerErrorStore,
      clock: fixedClock(1100)
    })
  );
  assert(
    providerError.code === "AUTH_PROVIDER_ERROR" &&
      providerErrorStore.deleted.includes("state-error-1"),
    "External provider errors must delete pending state."
  );

  return {
    startRequest: apiClient.calls.find((call) => call.operation === "start"),
    startedPendingState: started.pendingState,
    consumedCallback: consumed.callback,
    completionRequest: consumed.completionRequest,
    completedResponse: completed.response.body,
    pendingStateDeleted: store.deleted,
    providerError: {
      code: providerError.code,
      pendingStateDeleted: providerErrorStore.deleted
    }
  };
}

async function verifyApiDispatcherCallbacks(api) {
  let received;
  const dispatcher = api.createCloudHttpDispatcher(
    createCloudHttpApplication({
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
  const principal = {
    kind: "user",
    principalId: "principal-1",
    displayName: "Principal 1"
  };
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
  assert(response.status === 200, "Provider callback route must dispatch.");
  assert(
    received?.provider === "google" &&
      received.code === "authorization-code" &&
      received.codeVerifier === "pkce-verifier",
    "Provider callback dispatcher input drifted."
  );

  const rejectedCalls = [];
  const rejectingDispatcher = api.createCloudHttpDispatcher(
    createCloudHttpApplication({
      async completeExternalProviderOAuthConnection() {
        rejectedCalls.push("complete");
        return { oauthConnection: {} };
      }
    })
  );
  const rejected = await rejectingDispatcher({
    method: "POST",
    path: "/v1/organizations/org-1/projects/project-1/environments/env-1/external-providers/bing/oauth/callback",
    principal,
    body: {
      code: "authorization-code",
      redirectUri: "https://app.searchlint.example/oauth/bing/callback"
    }
  });
  assert(
    rejected.status === 400 && rejectedCalls.length === 0,
    "Unsupported provider callback must fail before application dispatch."
  );

  return {
    acceptedStatus: response.status,
    acceptedProvider: received.provider,
    acceptedScopes: received.scopes,
    rejectedUnsupportedProviderStatus: rejected.status,
    rejectedUnsupportedProviderCode: rejected.body.error.code,
    rejectedCalls: rejectedCalls.length
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

function pendingPkceState(overrides = {}) {
  return {
    state: "state-1",
    nonce: "nonce-1",
    codeChallenge: "challenge-1",
    codeVerifier: "verifier-1",
    redirectUri: "https://app.searchlint.example/auth/callback",
    createdAt: 1000,
    expiresAt: 1600,
    ...overrides
  };
}

function externalPendingState(overrides = {}) {
  return {
    provider: "google",
    organizationId: "org-1",
    projectId: "project-1",
    environmentId: "env-1",
    state: "state-google-1",
    redirectUri: "https://app.searchlint.example/oauth/google/callback",
    scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
    codeVerifier: "verifier-1",
    createdAt: 1000,
    expiresAt: 1600,
    ...overrides
  };
}

function createPendingStore(initialStates = []) {
  const states = new Map(initialStates.map((state) => [state.state, state]));
  return {
    saved: [],
    deleted: [],
    async save(state) {
      this.saved.push(state);
      states.set(state.state, state);
    },
    async load(state) {
      return states.get(state);
    },
    async delete(state) {
      this.deleted.push(state);
      states.delete(state);
    }
  };
}

function createExternalPendingStore(initialStates = []) {
  return createPendingStore(initialStates);
}

function createSessionStore() {
  let current;
  return {
    saved: [],
    async save(session) {
      this.saved.push(session);
      current = session;
    },
    async load() {
      return current;
    },
    async delete() {
      current = undefined;
    }
  };
}

function createExternalProviderApiClient() {
  return {
    calls: [],
    async startExternalProviderOAuthConnection(params, body) {
      this.calls.push({ operation: "start", params, body });
      return {
        status: 200,
        body: {
          provider: params.provider,
          authorizationUrl: `https://provider.searchlint.example/${params.provider}/authorize?state=${body.state}`,
          state: body.state,
          redirectUri:
            body.redirectUri ??
            `https://app.searchlint.example/oauth/${params.provider}/callback`,
          scopes: body.scopes ?? ["scope-default"]
        }
      };
    },
    async completeExternalProviderOAuthConnection(params, body) {
      this.calls.push({ operation: "complete", params, body });
      return {
        status: 200,
        body: {
          oauthConnection: {
            id: `oauth-${params.provider}-1`,
            provider: params.provider
          }
        }
      };
    }
  };
}

function createCloudHttpApplication(overrides = {}) {
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
        organization: { id: input.organizationId },
        project: { id: input.projectId },
        environment: { id: input.environmentId }
      };
    },
    async startExternalProviderOAuthConnection(input) {
      return {
        provider: input.provider,
        authorizationUrl: `https://provider.example/${input.provider}/authorize`,
        state: input.state,
        redirectUri: input.redirectUri,
        scopes: input.scopes
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
    ...overrides
  };
}

function tokenFetch(calls, body) {
  return async (url, init) => {
    calls.push({
      url,
      init: {
        method: init.method,
        body: init.body,
        headers: normalizeHeaders(init.headers)
      }
    });
    return {
      status: 200,
      async json() {
        return body;
      }
    };
  };
}

function normalizeHeaders(headers) {
  return Object.fromEntries(
    Object.entries(headers ?? {}).map(([key, value]) => [
      key.toLowerCase(),
      value
    ])
  );
}

function fixedClock(now) {
  return { now: () => now };
}

async function captureError(fn) {
  try {
    await fn();
  } catch (error) {
    return error;
  }
  throw new Error("Expected operation to fail.");
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const json = await format(`${JSON.stringify(value, null, 2)}\n`, {
    parser: "json"
  });
  await writeFile(filePath, json, "utf8");
}

main().catch((error) => {
  console.error(
    error instanceof Error
      ? error.message
      : "Unknown auth OAuth callbacks static verification error"
  );
  process.exitCode = 1;
});
