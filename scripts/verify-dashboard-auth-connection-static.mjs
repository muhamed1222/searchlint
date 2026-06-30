#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { format } from "prettier";

const reportPath = "reports/dashboard-auth-connection-static-report.json";
const samplePath =
  "docs/examples/dashboard-auth-connection-static-report.sample.json";

const commands = [
  {
    name: "dashboardBuild",
    command: "pnpm",
    args: ["--filter", "@searchlint/dashboard...", "build"]
  },
  {
    name: "dashboardAuthUnitTests",
    command: "pnpm",
    args: [
      "--filter",
      "@searchlint/dashboard",
      "test",
      "--",
      "api-client.test.ts",
      "dashboard.test.ts"
    ]
  },
  {
    name: "cognitoOidcStatic",
    command: "node",
    args: ["scripts/verify-cognito-oidc-static.mjs"]
  },
  {
    name: "authLoginStatic",
    command: "node",
    args: ["scripts/verify-auth-login-static.mjs"]
  },
  {
    name: "authLogoutStatic",
    command: "node",
    args: ["scripts/verify-auth-logout-static.mjs"]
  },
  {
    name: "authRefreshStatic",
    command: "node",
    args: ["scripts/verify-auth-refresh-static.mjs"]
  },
  {
    name: "authSessionExpiryStatic",
    command: "node",
    args: ["scripts/verify-auth-session-expiry-static.mjs"]
  },
  {
    name: "dashboardAcceptance",
    command: "node",
    args: ["scripts/verify-dashboard-production-e2e-accessibility.mjs"]
  }
];

const commandResults = commands.map(runCommand);
const dashboard = await import("../apps/dashboard/dist/src/index.js");

const authRoutes = {
  signIn: "/sign-in",
  dashboard: "/dashboard",
  sessionExpired: "/session-expired"
};
const clock = { now: () => 1000 };

const missingIntent = await dashboard.resolveDashboardAuthRouteIntent({
  sessionStore: sessionStore(),
  clock,
  routes: authRoutes
});
assertEqual(missingIntent.action, "redirect", "missing session action");
assertEqual(missingIntent.route, "signIn", "missing session route");

const validSession = session({ accessToken: "valid-access-token" });
const validIntent = await dashboard.resolveDashboardAuthRouteIntent({
  sessionStore: sessionStore(validSession),
  clock,
  routes: authRoutes
});
assertEqual(validIntent.action, "allow", "valid session action");
assertEqual(validIntent.route, "dashboard", "valid session route");

const expiredSession = session({
  accessToken: "expired-access-token",
  expiresAt: 900,
  refreshToken: "refresh-token-1"
});
const expiredIntent = await dashboard.resolveDashboardAuthRouteIntent({
  sessionStore: sessionStore(expiredSession),
  clock,
  expirySkewSeconds: 0,
  routes: authRoutes
});
assertEqual(expiredIntent.action, "redirect", "expired session action");
assertEqual(expiredIntent.route, "sessionExpired", "expired session route");

const hostedUiConfig = {
  hostedUiDomain: "https://auth.searchlint.example",
  clientId: "dashboard-client-1",
  redirectUri: "https://app.searchlint.example/auth/callback",
  scopes: ["openid", "email", "profile"]
};
const authorizationUrl = new URL(
  dashboard.createDashboardCognitoAuthorizationUrl(hostedUiConfig, {
    state: "state-1",
    nonce: "nonce-1",
    codeChallenge: "challenge-1"
  })
);
assertEqual(
  authorizationUrl.pathname,
  "/oauth2/authorize",
  "authorize endpoint"
);
assertEqual(
  authorizationUrl.searchParams.get("response_type"),
  "code",
  "authorize response type"
);
assertEqual(
  authorizationUrl.searchParams.get("code_challenge_method"),
  "S256",
  "authorize PKCE method"
);
assertEqual(
  authorizationUrl.searchParams.get("scope"),
  "email openid profile",
  "authorize scopes"
);

const logoutUrl = new URL(
  dashboard.createDashboardCognitoLogoutUrl({
    hostedUiDomain: hostedUiConfig.hostedUiDomain,
    clientId: hostedUiConfig.clientId,
    logoutUri: "https://app.searchlint.example/signed-out",
    state: "logout-state-1"
  })
);
assertEqual(logoutUrl.pathname, "/logout", "logout endpoint");
assertEqual(
  logoutUrl.searchParams.get("logout_uri"),
  "https://app.searchlint.example/signed-out",
  "logout URI"
);

const apiCalls = [];
const tokenCalls = [];
const storedSession = sessionStore(
  session({
    accessToken: "expired-access-token",
    expiresAt: 900,
    refreshToken: "refresh-token-1"
  })
);
const client = dashboard.createDashboardCognitoStoredSessionApiClient({
  baseUrl: "https://api.searchlint.example",
  apiFetch: async (url, init) => {
    apiCalls.push({ url, init });
    return jsonResponse(200, { ok: true });
  },
  tokenFetch: async (url, init) => {
    tokenCalls.push({ url, init });
    return jsonResponse(200, {
      access_token: "refreshed-access-token",
      expires_in: 1800,
      token_type: "Bearer"
    });
  },
  sessionStore: storedSession,
  hostedUiDomain: hostedUiConfig.hostedUiDomain,
  clientId: hostedUiConfig.clientId,
  clock,
  expirySkewSeconds: 0,
  headers: {
    "x-dashboard-runtime": "static-readiness"
  }
});
await client.getDashboardSnapshot({
  organizationId: "org-1",
  projectId: "project-1",
  environmentId: "env-1"
});
assertEqual(tokenCalls.length, 1, "refresh token call count");
assertEqual(apiCalls.length, 1, "dashboard API call count");
assertEqual(
  tokenCalls[0].url,
  "https://auth.searchlint.example/oauth2/token",
  "Cognito refresh URL"
);
assertEqual(
  tokenCalls[0].init.body,
  "grant_type=refresh_token&client_id=dashboard-client-1&refresh_token=refresh-token-1",
  "Cognito refresh body"
);
assertEqual(
  apiCalls[0].init.headers.authorization,
  "Bearer refreshed-access-token",
  "refreshed API bearer token"
);
assertEqual(
  apiCalls[0].init.headers["x-dashboard-runtime"],
  "static-readiness",
  "dashboard runtime header"
);
assertEqual(
  storedSession.saved[0]?.accessToken,
  "refreshed-access-token",
  "refreshed session saved"
);

const report = {
  generatedBy: "searchlint-dashboard-auth-connection-static-verifier",
  generatedAt: "2026-06-23T00:00:00.000Z",
  status: "passed",
  scope: {
    proofType:
      "deterministic static dashboard-to-auth connection readiness proof",
    doesNotClaim: [
      "deployed Cognito user pool",
      "live Hosted UI browser login",
      "live Cognito email, MFA, or password-reset delivery",
      "deployed dashboard callback URL",
      "production dashboard session cookie/storage hardening review"
    ]
  },
  commands: commandResults,
  authRouteIntentEvidence: {
    missingSession: {
      action: missingIntent.action,
      route: missingIntent.route,
      path: missingIntent.path,
      reason: missingIntent.reason
    },
    validSession: {
      action: validIntent.action,
      route: validIntent.route,
      path: validIntent.path
    },
    expiredSession: {
      action: expiredIntent.action,
      route: expiredIntent.route,
      path: expiredIntent.path,
      reason: expiredIntent.reason
    }
  },
  cognitoHostedUiEvidence: {
    authorizeEndpoint: authorizationUrl.pathname,
    responseType: authorizationUrl.searchParams.get("response_type"),
    codeChallengeMethod: authorizationUrl.searchParams.get(
      "code_challenge_method"
    ),
    scopes: authorizationUrl.searchParams.get("scope")?.split(" ") ?? [],
    logoutEndpoint: logoutUrl.pathname,
    logoutUri: logoutUrl.searchParams.get("logout_uri")
  },
  storedSessionApiEvidence: {
    refreshUrl: tokenCalls[0].url,
    refreshBody:
      "grant_type=refresh_token&client_id=dashboard-client-1&refresh_token=<redacted>",
    apiUrl: apiCalls[0].url,
    authorization: "Bearer <redacted>",
    runtimeHeader: apiCalls[0].init.headers["x-dashboard-runtime"],
    savedRefreshedSession: storedSession.saved.length === 1
  },
  assertions: [
    "Missing dashboard sessions redirect to the configured sign-in route before API calls.",
    "Valid dashboard sessions are allowed through the dashboard route.",
    "Expired dashboard sessions redirect to the configured session-expired route.",
    "Cognito Hosted UI authorization URLs use authorization-code flow with PKCE S256.",
    "Cognito logout URLs include the configured post-logout redirect URI.",
    "Expired stored sessions refresh through the Cognito token endpoint before dashboard API requests.",
    "Refreshed dashboard sessions are saved and API requests use the refreshed bearer token."
  ],
  remainingReleaseGates: [
    "Deploy the real Cognito user pool and app client.",
    "Run live Hosted UI login/logout/callback E2E from the deployed dashboard.",
    "Verify live email verification, password reset, MFA, and session expiry behavior.",
    "Verify deployed dashboard API calls with live Cognito-issued tokens.",
    "Complete production session storage/cookie security review."
  ]
};

await mkdir(path.dirname(reportPath), { recursive: true });
await mkdir(path.dirname(samplePath), { recursive: true });
await writeJson(reportPath, report);
await writeJson(samplePath, report);

console.log(
  `Dashboard auth connection static readiness PASS: ${commandResults.length}/${commands.length} command groups passed`
);
console.log(`Report: ${reportPath}`);
console.log(`Sample: ${samplePath}`);

function session(overrides = {}) {
  return {
    accessToken: "access-token",
    expiresAt: 2000,
    tokenType: "Bearer",
    identityProvider: "cognito",
    subject: "user-1",
    refreshToken: "refresh-token",
    ...overrides
  };
}

function sessionStore(initialSession) {
  let stored = initialSession;
  const store = {
    saved: [],
    deleted: 0,
    save(nextSession) {
      stored = nextSession;
      store.saved.push(nextSession);
    },
    load() {
      return stored;
    },
    delete() {
      stored = undefined;
      store.deleted += 1;
    }
  };
  return store;
}

function jsonResponse(status, body) {
  return {
    status,
    headers: {
      get(name) {
        return name.toLowerCase() === "content-type"
          ? "application/json"
          : null;
      }
    },
    async json() {
      return body;
    },
    async text() {
      return JSON.stringify(body);
    }
  };
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
