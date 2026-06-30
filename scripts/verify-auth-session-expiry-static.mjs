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
const generatedAt = "2026-06-22T00:00:00.000Z";
const cognitoTemplatePath = "infra/aws/cognito-user-pool.cloudformation.json";
const reportPath = path.join(
  repoRoot,
  "reports/auth-session-expiry-static-report.json"
);
const samplePath = path.join(
  repoRoot,
  "docs/examples/auth-session-expiry-static-report.sample.json"
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

  const template = JSON.parse(await readText(cognitoTemplatePath));
  const appClient =
    requiredResource(
      template.Resources ?? {},
      "SearchLintCloudApiAppClient",
      "AWS::Cognito::UserPoolClient"
    ).Properties ?? {};
  assert(
    appClient.AccessTokenValidity === 60,
    "Cognito access-token validity must be 60 minutes."
  );
  assert(
    appClient.IdTokenValidity === 60,
    "Cognito ID-token validity must be 60 minutes."
  );
  assert(
    appClient.RefreshTokenValidity === 30,
    "Cognito refresh-token validity must be 30 days."
  );
  assert(
    appClient.TokenValidityUnits?.AccessToken === "minutes",
    "Cognito access-token validity unit must be minutes."
  );
  assert(
    appClient.TokenValidityUnits?.IdToken === "minutes",
    "Cognito ID-token validity unit must be minutes."
  );
  assert(
    appClient.TokenValidityUnits?.RefreshToken === "days",
    "Cognito refresh-token validity unit must be days."
  );

  const dashboard = await import("../apps/dashboard/dist/src/index.js");
  const validSession = session({ accessToken: "valid-token", expiresAt: 2000 });
  const expiredSession = session({
    accessToken: "expired-token",
    expiresAt: 1050
  });
  const validState = await dashboard.getDashboardStoredAuthSessionState({
    sessionStore: createSessionStore(validSession),
    clock: fixedClock(1000),
    expirySkewSeconds: 60
  });
  assert(validState.status === "valid", "Expected valid stored session state.");
  const expiredState = await dashboard.getDashboardStoredAuthSessionState({
    sessionStore: createSessionStore(expiredSession),
    clock: fixedClock(1000),
    expirySkewSeconds: 60
  });
  assert(
    expiredState.status === "expired",
    "Expected expired stored session state inside skew."
  );
  const missingState = await dashboard.getDashboardStoredAuthSessionState({
    sessionStore: createSessionStore(),
    clock: fixedClock(1000)
  });
  assert(
    missingState.status === "missing",
    "Expected missing stored session state."
  );

  const expiredRoute = await dashboard.resolveDashboardAuthRouteIntent({
    sessionStore: createSessionStore(
      session({ accessToken: "route-expired-token", expiresAt: 1000 })
    ),
    clock: fixedClock(1000),
    expirySkewSeconds: 0,
    routes: {
      signIn: "/sign-in",
      dashboard: "/dashboard",
      sessionExpired: "/session-expired"
    }
  });
  assert(
    expiredRoute.action === "redirect" &&
      expiredRoute.route === "sessionExpired" &&
      expiredRoute.path === "/session-expired" &&
      expiredRoute.reason === "expired-session",
    "Expired stored sessions must redirect to the session-expired route."
  );

  const missingRefreshStore = createSessionStore(
    session({ accessToken: "expired-no-refresh", expiresAt: 1000 })
  );
  const missingRefreshApiCalls = [];
  const expiredClient = dashboard.createDashboardCognitoStoredSessionApiClient({
    baseUrl: "https://api.searchlint.example",
    apiFetch: async (url, init) => {
      missingRefreshApiCalls.push({ url, init });
      return { status: 200, async json() {} };
    },
    tokenFetch: async () => {
      throw new Error("Token fetch must not run without a refresh token.");
    },
    sessionStore: missingRefreshStore,
    hostedUiDomain: "https://auth.searchlint.example",
    clientId: "client-1",
    clock: fixedClock(1000),
    expirySkewSeconds: 0
  });
  let missingRefreshError;
  try {
    await expiredClient.getDashboardSnapshot({
      organizationId: "org-1",
      projectId: "project-1",
      environmentId: "env-1"
    });
  } catch (error) {
    missingRefreshError = error;
  }
  assert(
    missingRefreshError?.code === "ACCESS_TOKEN_UNAVAILABLE",
    "Expired stored sessions without refresh tokens must fail deterministically."
  );
  assert(
    missingRefreshApiCalls.length === 0,
    "Expired sessions without refresh must fail before API fetch execution."
  );

  const refreshStore = createSessionStore(
    session({
      accessToken: "near-expiry-token",
      expiresAt: 1050,
      refreshToken: "refresh-token-1"
    })
  );
  const tokenCalls = [];
  const apiCalls = [];
  const refreshingClient =
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
            return snapshotResponse();
          }
        };
      },
      tokenFetch: tokenFetch(tokenCalls, {
        access_token: "refreshed-access-token",
        expires_in: 1800,
        token_type: "Bearer"
      }),
      sessionStore: refreshStore,
      hostedUiDomain: "https://auth.searchlint.example",
      clientId: "client-1",
      clock: fixedClock(1000),
      expirySkewSeconds: 60
    });
  await refreshingClient.getDashboardSnapshot({
    organizationId: "org-1",
    projectId: "project-1",
    environmentId: "env-1"
  });
  assert(tokenCalls.length === 1, "Near-expiry sessions must refresh once.");
  assert(
    refreshStore.saved[0]?.accessToken === "refreshed-access-token",
    "Near-expiry refresh must save the refreshed access token."
  );
  assert(
    refreshStore.saved[0]?.expiresAt === 2800,
    "Near-expiry refresh must persist the refreshed expiry."
  );
  assert(
    apiCalls[0]?.init.headers.authorization === "Bearer refreshed-access-token",
    "Dashboard API requests must use the refreshed bearer token."
  );

  let invalidSkewError;
  try {
    await dashboard.getDashboardStoredAuthSessionState({
      sessionStore: createSessionStore(validSession),
      clock: fixedClock(1000),
      expirySkewSeconds: -1
    });
  } catch (error) {
    invalidSkewError = error;
  }
  assert(
    invalidSkewError?.code === "INVALID_AUTH_SESSION",
    "Invalid expiry skew must fail before session classification."
  );

  const report = {
    schemaVersion: 1,
    generatedBy: "searchlint-auth-session-expiry-static-verifier",
    generatedAt,
    status: "static-session-expiry-passed-live-release-blocked",
    scope: {
      proofType:
        "deterministic static Cognito/dashboard session-expiry contract",
      liveAwsAccess: "not used by verifier",
      cognitoCloudFormation: cognitoTemplatePath,
      doesNotClaim: [
        "live Cognito deployment",
        "AWS-issued token expiry in a real browser session",
        "refresh-token revocation",
        "live browser cookie expiry",
        "deployed dashboard/API session-expiry behavior"
      ]
    },
    commands: [
      {
        command:
          "pnpm --filter @searchlint/dashboard test -- api-client.test.ts dashboard.test.ts",
        status: "passed"
      },
      {
        command: "pnpm --filter @searchlint/dashboard build",
        status: "passed"
      }
    ],
    cognitoTokenValidity: {
      accessTokenValidity: appClient.AccessTokenValidity,
      accessTokenValidityUnit: appClient.TokenValidityUnits.AccessToken,
      idTokenValidity: appClient.IdTokenValidity,
      idTokenValidityUnit: appClient.TokenValidityUnits.IdToken,
      refreshTokenValidity: appClient.RefreshTokenValidity,
      refreshTokenValidityUnit: appClient.TokenValidityUnits.RefreshToken
    },
    dashboardSessionLifecycle: {
      validState: validState.status,
      expiredState: expiredState.status,
      missingState: missingState.status,
      expiredRoute: {
        action: expiredRoute.action,
        route: expiredRoute.route,
        path: expiredRoute.path,
        reason: expiredRoute.reason
      },
      invalidSkewError: {
        code: invalidSkewError.code,
        message: invalidSkewError.message
      }
    },
    refreshBehavior: {
      nearExpiryRefreshCalls: tokenCalls.length,
      refreshedExpiresAt: refreshStore.saved[0].expiresAt,
      apiAuthorizationHeader: apiCalls[0].init.headers.authorization,
      missingRefreshError: {
        code: missingRefreshError.code,
        message: missingRefreshError.message
      },
      missingRefreshApiFetches: missingRefreshApiCalls.length
    },
    remainingReleaseGates: [
      "deploy real Cognito user pool and app client",
      "prove AWS-issued access/ID token expiry in a real browser session",
      "prove live refresh-token expiry and revocation behavior",
      "prove live browser cookie/session expiry behavior",
      "prove deployed dashboard/API session-expiry behavior"
    ]
  };

  await writeJson(reportPath, report);
  await writeJson(samplePath, report);
  console.log(
    "Auth session-expiry static acceptance PASS: token validity and dashboard expiry behavior verified"
  );
  console.log(`Report: ${path.relative(repoRoot, reportPath)}`);
  console.log(`Sample: ${path.relative(repoRoot, samplePath)}`);
}

function requiredResource(resources, logicalId, type) {
  const resource = resources[logicalId];
  assert(resource, `${logicalId} resource is required.`);
  assert(resource.Type === type, `${logicalId} must be ${type}.`);
  return resource;
}

function fixedClock(now) {
  return { now: () => now };
}

function session(overrides = {}) {
  return {
    accessToken: "access-token",
    expiresAt: 2000,
    tokenType: "Bearer",
    identityProvider: "cognito",
    ...overrides
  };
}

function createSessionStore(storedSession) {
  return {
    saved: [],
    deleted: 0,
    async save(sessionValue) {
      this.saved.push(sessionValue);
      storedSession = sessionValue;
    },
    async load() {
      return storedSession;
    },
    async delete() {
      this.deleted += 1;
      storedSession = undefined;
    }
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

function snapshotResponse() {
  return {
    schemaVersion: 1,
    generatedAt: "2026-06-22T00:00:00.000Z",
    organization: { id: "org-1", name: "Org" },
    project: {
      id: "project-1",
      name: "Project",
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

async function readText(relativePath) {
  return readFile(path.join(repoRoot, relativePath), "utf8");
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
      : "Unknown auth session-expiry static verification error"
  );
  process.exitCode = 1;
});
