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
  "reports/auth-refresh-static-report.json"
);
const samplePath = path.join(
  repoRoot,
  "docs/examples/auth-refresh-static-report.sample.json"
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
    "@searchlint/dashboard",
    "test",
    "--",
    "api-client.test.ts"
  ]);
  run("pnpm", ["--filter", "@searchlint/dashboard", "build"]);

  const template = JSON.parse(await readText(cognitoTemplatePath));
  const appClient =
    requiredResource(
      template.Resources ?? {},
      "SearchLintCloudApiAppClient",
      "AWS::Cognito::UserPoolClient"
    ).Properties ?? {};
  assertIncludes(
    appClient.ExplicitAuthFlows,
    "ALLOW_REFRESH_TOKEN_AUTH",
    "Cognito app client must allow refresh-token auth."
  );
  assert(
    appClient.RefreshTokenValidity === 30,
    "Cognito refresh-token validity must be 30 days."
  );
  assert(
    appClient.TokenValidityUnits?.RefreshToken === "days",
    "Cognito refresh-token validity unit must be days."
  );

  const dashboard = await import("../apps/dashboard/dist/src/index.js");
  const directRefreshCalls = [];
  const refreshedSession = await dashboard.refreshDashboardCognitoAuthSession({
    hostedUiDomain: "https://auth.searchlint.example",
    clientId: "client-1",
    refreshToken: "refresh-token-1",
    fetch: tokenFetch(directRefreshCalls, {
      status: 200,
      body: {
        access_token: "refreshed-access-token-1",
        expires_in: 1800,
        token_type: "Bearer"
      }
    }),
    clock: fixedClock(1000)
  });
  assert(
    directRefreshCalls[0]?.init.body ===
      "grant_type=refresh_token&client_id=client-1&refresh_token=refresh-token-1",
    "Refresh grant body drifted."
  );
  assert(
    refreshedSession.refreshToken === "refresh-token-1",
    "Refresh must preserve the current refresh token when provider omits rotation."
  );
  assert(
    refreshedSession.expiresAt === 2800,
    "Refreshed session expiry drifted."
  );

  const rotationCalls = [];
  const rotatedSession = await dashboard.refreshDashboardCognitoAuthSession({
    hostedUiDomain: "https://auth.searchlint.example",
    clientId: "client-1",
    refreshToken: "refresh-token-1",
    fetch: tokenFetch(rotationCalls, {
      status: 200,
      body: {
        access_token: "rotated-access-token-1",
        refresh_token: "refresh-token-2",
        expires_in: 3600,
        token_type: "Bearer"
      }
    }),
    clock: fixedClock(1000)
  });
  assert(
    rotatedSession.refreshToken === "refresh-token-2",
    "Provider-returned refresh-token rotation must be preserved."
  );

  const store = createSessionStore(
    session({
      accessToken: "expired-access-token-1",
      expiresAt: 1000,
      refreshToken: "refresh-token-1"
    })
  );
  const storedRefreshCalls = [];
  const apiCalls = [];
  const client = dashboard.createDashboardCognitoStoredSessionApiClient({
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
        status: 202,
        async json() {
          return { ok: true };
        }
      };
    },
    tokenFetch: tokenFetch(storedRefreshCalls, {
      status: 200,
      body: {
        access_token: "stored-refreshed-access-token-1",
        expires_in: 1800,
        token_type: "Bearer"
      }
    }),
    sessionStore: store,
    hostedUiDomain: "https://auth.searchlint.example",
    clientId: "client-1",
    clock: fixedClock(1000),
    expirySkewSeconds: 0
  });
  await client.requestCrawl(
    {
      organizationId: "org-1",
      projectId: "project-1",
      environmentId: "env-1"
    },
    { maxUrls: 50 }
  );
  assert(
    store.saved[0]?.accessToken === "stored-refreshed-access-token-1",
    "Stored expired sessions must save the refreshed access token."
  );
  assert(
    store.saved[0]?.refreshToken === "refresh-token-1",
    "Stored expired sessions must keep refresh token when provider omits rotation."
  );
  assert(
    apiCalls[0]?.init.headers.authorization ===
      "Bearer stored-refreshed-access-token-1",
    "Dashboard API requests must use the refreshed access token."
  );

  const missingRefreshStore = createSessionStore(
    session({ accessToken: "expired-access-token-2", expiresAt: 1000 })
  );
  const missingRefreshApiCalls = [];
  const missingRefreshTokenCalls = [];
  const missingRefreshClient =
    dashboard.createDashboardCognitoStoredSessionApiClient({
      baseUrl: "https://api.searchlint.example",
      apiFetch: async (url, init) => {
        missingRefreshApiCalls.push({ url, init });
        return { status: 200, async json() {} };
      },
      tokenFetch: async (url, init) => {
        missingRefreshTokenCalls.push({ url, init });
        return { status: 200, async json() {} };
      },
      sessionStore: missingRefreshStore,
      hostedUiDomain: "https://auth.searchlint.example",
      clientId: "client-1",
      clock: fixedClock(1000),
      expirySkewSeconds: 0
    });
  let missingRefreshError;
  try {
    await missingRefreshClient.createProject(
      { organizationId: "org-1" },
      { name: "Example", siteUrl: "https://example.com" }
    );
  } catch (error) {
    missingRefreshError = error;
  }
  assert(
    missingRefreshError?.code === "ACCESS_TOKEN_UNAVAILABLE",
    "Expired stored sessions without refresh tokens must fail deterministically."
  );
  assert(
    missingRefreshApiCalls.length === 0 &&
      missingRefreshTokenCalls.length === 0,
    "Missing refresh token must fail before token/API fetch execution."
  );

  const report = {
    schemaVersion: 1,
    generatedBy: "searchlint-auth-refresh-static-verifier",
    generatedAt,
    status: "static-refresh-token-flow-passed-live-release-blocked",
    scope: {
      proofType: "deterministic static Cognito refresh-token contract",
      liveAwsAccess: "not used by verifier",
      cognitoCloudFormation: cognitoTemplatePath,
      doesNotClaim: [
        "live Cognito deployment",
        "real refresh token use",
        "provider-side refresh-token rotation policy",
        "refresh-token revocation",
        "deployed dashboard/API refresh behavior"
      ]
    },
    commands: [
      {
        command:
          "pnpm --filter @searchlint/dashboard test -- api-client.test.ts",
        status: "passed"
      },
      {
        command: "pnpm --filter @searchlint/dashboard build",
        status: "passed"
      }
    ],
    cognitoProvisioning: {
      explicitAuthFlows: appClient.ExplicitAuthFlows,
      refreshTokenValidity: appClient.RefreshTokenValidity,
      refreshTokenValidityUnit: appClient.TokenValidityUnits.RefreshToken
    },
    directRefreshGrant: {
      endpoint: directRefreshCalls[0].url,
      method: directRefreshCalls[0].init.method,
      grantType: "refresh_token",
      preservesExistingRefreshToken:
        refreshedSession.refreshToken === "refresh-token-1",
      expiresAt: refreshedSession.expiresAt
    },
    rotation: {
      providerReturnedRefreshToken: true,
      storedRefreshToken: rotatedSession.refreshToken
    },
    storedSessionRefresh: {
      refreshCalledBeforeApi: storedRefreshCalls.length === 1,
      savedSessionCount: store.saved.length,
      apiAuthorizationHeader: "Bearer <redacted>",
      apiUsedRefreshedAccessToken:
        apiCalls[0].init.headers.authorization ===
        "Bearer stored-refreshed-access-token-1"
    },
    negativeCases: {
      missingRefreshTokenFailsBeforeFetch:
        missingRefreshError?.code === "ACCESS_TOKEN_UNAVAILABLE" &&
        missingRefreshApiCalls.length === 0 &&
        missingRefreshTokenCalls.length === 0
    },
    remainingReleaseGates: [
      "deploy real Cognito",
      "prove live refresh-token grant with AWS-issued token",
      "prove provider-side refresh-token rotation behavior",
      "prove refresh-token revocation or documented non-revocation policy",
      "prove deployed dashboard/API refresh behavior"
    ]
  };

  await writeJson(reportPath, report);
  await writeJson(samplePath, report);
  console.log(
    "Auth refresh-token static acceptance PASS: refresh grant/session contract verified"
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

function assertIncludes(values, expected, message) {
  assert(Array.isArray(values) && values.includes(expected), message);
}

function fixedClock(now) {
  return {
    now() {
      return now;
    }
  };
}

function tokenFetch(calls, response) {
  return async (url, init) => {
    calls.push({
      url,
      init: {
        method: init.method,
        headers: init.headers,
        body: init.body,
        ...(init.signal === undefined ? {} : { signal: init.signal })
      }
    });
    return {
      status: response.status,
      async json() {
        return response.body;
      }
    };
  };
}

function session(overrides = {}) {
  return {
    accessToken: "access-token-1",
    expiresAt: 2000,
    tokenType: "Bearer",
    identityProvider: "cognito",
    ...overrides
  };
}

function createSessionStore(initial) {
  let storedSession = initial;
  return {
    saved: [],
    async save(sessionValue) {
      storedSession = sessionValue;
      this.saved.push(sessionValue);
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
    error instanceof Error ? error.message : "Auth refresh verifier failed."
  );
  process.exitCode = 1;
});
