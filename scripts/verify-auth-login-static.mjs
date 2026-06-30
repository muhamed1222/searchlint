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
const reportPath = path.join(repoRoot, "reports/auth-login-static-report.json");
const samplePath = path.join(
  repoRoot,
  "docs/examples/auth-login-static-report.sample.json"
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
    "api-client.test.ts",
    "dashboard.test.ts"
  ]);
  run("pnpm", [
    "--filter",
    "@searchlint/api",
    "test",
    "--",
    "cognito-auth.test.ts",
    "node-http-server.test.ts"
  ]);
  run("pnpm", ["--filter", "@searchlint/api", "build"]);

  const dashboard = await import("../apps/dashboard/dist/src/index.js");
  const config = {
    hostedUiDomain: "https://auth.searchlint.example",
    clientId: "client-1",
    redirectUri: "https://app.searchlint.example/auth/callback",
    scopes: ["openid", "email", "profile"]
  };

  const loginUrl = new URL(
    dashboard.createDashboardCognitoAuthorizationUrl(config, {
      state: "login-state-1",
      nonce: "login-nonce-1",
      codeChallenge: "login-challenge-1"
    })
  );
  assert(
    loginUrl.pathname === "/oauth2/authorize",
    "Login must start through the Cognito authorize endpoint."
  );
  assert(
    loginUrl.searchParams.get("response_type") === "code",
    "Login must use authorization-code flow."
  );
  assert(
    loginUrl.searchParams.get("scope") === "email openid profile",
    "Login scopes drifted."
  );
  assert(
    loginUrl.searchParams.get("code_challenge_method") === "S256",
    "Login must use PKCE S256."
  );

  const pendingStore = createPendingStore();
  await dashboard.startDashboardCognitoPkceAuth({
    config,
    request: {
      state: "login-state-1",
      nonce: "login-nonce-1",
      codeChallenge: "login-challenge-1"
    },
    codeVerifier: "login-verifier-1",
    store: pendingStore,
    clock: fixedClock(1000),
    ttlSeconds: 300
  });

  const tokenCalls = [];
  const sessionStore = createSessionStore();
  const loginResult = await dashboard.completeDashboardCognitoPkceAuthCallback({
    config,
    callbackUrl:
      "https://app.searchlint.example/auth/callback?code=login-code-1&state=login-state-1&iss=https%3A%2F%2Fcognito-idp.us-east-1.amazonaws.com%2Fpool",
    pendingAuthStore: pendingStore,
    sessionStore,
    fetch: async (url, init) => {
      tokenCalls.push({
        url,
        init: {
          method: init.method,
          headers: init.headers,
          body: init.body
        }
      });
      return {
        status: 200,
        async json() {
          return {
            access_token: "login-access-token-1",
            id_token: "login-id-token-1",
            refresh_token: "login-refresh-token-1",
            expires_in: 3600,
            token_type: "Bearer"
          };
        }
      };
    },
    clock: fixedClock(1000)
  });

  assert(
    loginResult.callback.code === "login-code-1",
    "Login callback code was not preserved."
  );
  assert(
    loginResult.session.accessToken === "login-access-token-1",
    "Login token exchange did not produce the expected access token."
  );
  assert(
    sessionStore.saved.length === 1,
    "Login must persist exactly one dashboard auth session."
  );
  assert(
    tokenCalls[0]?.url === "https://auth.searchlint.example/oauth2/token",
    "Login must exchange the code at Cognito token endpoint."
  );
  assert(
    tokenCalls[0]?.init.body ===
      "grant_type=authorization_code&client_id=client-1&redirect_uri=https%3A%2F%2Fapp.searchlint.example%2Fauth%2Fcallback&code=login-code-1&code_verifier=login-verifier-1",
    "Login token exchange body drifted."
  );

  const apiCalls = [];
  const storedSessionClient =
    dashboard.createDashboardCognitoStoredSessionApiClient({
      baseUrl: "https://api.searchlint.example",
      apiFetch: async (url, init) => {
        apiCalls.push({
          url,
          init: {
            method: init.method,
            headers: normalizeHeaders(init.headers)
          }
        });
        return {
          status: 200,
          async json() {
            return {
              organization: { id: "org-1", name: "Acme" },
              project: {
                id: "project-1",
                name: "Site",
                siteUrl: "https://example.com"
              },
              environment: {
                id: "env-1",
                name: "Production",
                baseUrl: "https://example.com"
              },
              diagnostics: [],
              crawlRuns: [],
              trends: [],
              externalObservations: [],
              reports: [],
              quotas: [],
              teamMembers: []
            };
          }
        };
      },
      tokenFetch: async () => {
        throw new Error("Stored login session should not refresh.");
      },
      sessionStore,
      hostedUiDomain: config.hostedUiDomain,
      clientId: config.clientId,
      clock: fixedClock(1100),
      expirySkewSeconds: 0
    });
  await storedSessionClient.getDashboardSnapshot({
    organizationId: "org-1",
    projectId: "project-1",
    environmentId: "env-1"
  });
  assert(
    apiCalls[0]?.init.headers.authorization === "Bearer login-access-token-1",
    "Stored login session must authorize dashboard API requests with Bearer token."
  );

  const routeState = await dashboard.resolveDashboardAuthRouteIntent({
    sessionStore,
    clock: fixedClock(1100),
    routes: {
      signIn: "/sign-in",
      dashboard: "/dashboard",
      sessionExpired: "/session-expired"
    },
    expirySkewSeconds: 0
  });
  assert(
    routeState.action === "allow" && routeState.route === "dashboard",
    "Stored login session must resolve to authenticated route intent."
  );

  const report = {
    schemaVersion: 1,
    generatedBy: "searchlint-auth-login-static-verifier",
    generatedAt,
    status: "static-login-flow-passed-live-release-blocked",
    scope: {
      proofType: "deterministic static Cognito Hosted UI login-flow contract",
      liveAwsAccess: "not used by verifier",
      doesNotClaim: [
        "live Cognito deployment",
        "real browser login",
        "real AWS session issuance",
        "Hosted UI cookie behavior",
        "live MFA challenge",
        "deployed Cloud API bearer acceptance"
      ]
    },
    commands: [
      {
        command:
          "pnpm --filter @searchlint/dashboard test -- api-client.test.ts dashboard.test.ts",
        status: "passed"
      },
      {
        command:
          "pnpm --filter @searchlint/api test -- cognito-auth.test.ts node-http-server.test.ts",
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
    loginStart: {
      authorizationEndpoint: `${loginUrl.origin}${loginUrl.pathname}`,
      responseType: loginUrl.searchParams.get("response_type"),
      scopes: loginUrl.searchParams.get("scope"),
      pkceMethod: loginUrl.searchParams.get("code_challenge_method")
    },
    tokenExchange: {
      endpoint: tokenCalls[0].url,
      method: tokenCalls[0].init.method,
      grantType: "authorization_code",
      includesPkceVerifier: tokenCalls[0].init.body.includes(
        "code_verifier=login-verifier-1"
      )
    },
    sessionPersistence: {
      savedSessionCount: sessionStore.saved.length,
      identityProvider: sessionStore.saved[0]?.identityProvider,
      tokenType: sessionStore.saved[0]?.tokenType,
      hasRefreshToken: Boolean(sessionStore.saved[0]?.refreshToken)
    },
    dashboardApiAccess: {
      requestUrl: apiCalls[0].url,
      authorizationHeader: "Bearer <redacted>",
      bearerTokenSent:
        apiCalls[0].init.headers.authorization.startsWith("Bearer ")
    },
    routeIntent: {
      allowed: routeState.action === "allow" && routeState.route === "dashboard"
    },
    remainingReleaseGates: [
      "deploy real Cognito Hosted UI",
      "complete live browser login through Cognito",
      "prove AWS-issued access/id/refresh tokens",
      "prove hosted UI cookie and redirect behavior",
      "prove deployed dashboard login E2E",
      "prove deployed Cloud API accepts AWS-issued Cognito bearer token"
    ]
  };

  await writeJson(reportPath, report);
  await writeJson(samplePath, report);
  console.log(
    "Auth login static acceptance PASS: hosted UI login/session contract verified"
  );
  console.log(`Report: ${path.relative(repoRoot, reportPath)}`);
  console.log(`Sample: ${path.relative(repoRoot, samplePath)}`);
}

function fixedClock(now) {
  return {
    now() {
      return now;
    }
  };
}

function createPendingStore(initial = []) {
  const states = new Map(initial.map((state) => [state.state, state]));
  return {
    saved: [],
    deleted: [],
    async save(state) {
      states.set(state.state, state);
      this.saved.push(state);
    },
    async load(state) {
      return states.get(state);
    },
    async delete(state) {
      states.delete(state);
      this.deleted.push(state);
    }
  };
}

function createSessionStore(initial) {
  let storedSession = initial;
  return {
    saved: initial === undefined ? [] : [initial],
    async save(session) {
      storedSession = session;
      this.saved.push(session);
    },
    async load() {
      return storedSession;
    },
    async delete() {
      storedSession = undefined;
    }
  };
}

function normalizeHeaders(headers) {
  if (headers && typeof headers.entries === "function") {
    return Object.fromEntries(headers.entries());
  }
  return { ...(headers ?? {}) };
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
    error instanceof Error ? error.message : "Auth login verifier failed."
  );
  process.exitCode = 1;
});
