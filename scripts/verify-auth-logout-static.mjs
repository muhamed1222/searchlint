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
  "reports/auth-logout-static-report.json"
);
const samplePath = path.join(
  repoRoot,
  "docs/examples/auth-logout-static-report.sample.json"
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
    "api-client.test.ts",
    "dashboard.test.ts"
  ]);
  run("pnpm", ["--filter", "@searchlint/dashboard", "build"]);

  const dashboard = await import("../apps/dashboard/dist/src/index.js");
  const logoutUrl = new URL(
    dashboard.createDashboardCognitoLogoutUrl({
      hostedUiDomain: "https://auth.searchlint.example",
      clientId: "client-1",
      logoutUri: "https://app.searchlint.example/signed-out",
      state: "logout-state-1"
    })
  );
  assert(
    logoutUrl.pathname === "/logout",
    "Logout must use the Cognito Hosted UI logout endpoint."
  );
  assert(
    logoutUrl.searchParams.get("client_id") === "client-1",
    "Logout URL client_id drifted."
  );
  assert(
    logoutUrl.searchParams.get("logout_uri") ===
      "https://app.searchlint.example/signed-out",
    "Logout URL must include the signed-out redirect URI."
  );
  assert(
    logoutUrl.searchParams.get("state") === "logout-state-1",
    "Logout URL state drifted."
  );

  const sessionStore = createSessionStore(
    session({
      accessToken: "stored-access-token-1",
      expiresAt: 2000,
      refreshToken: "refresh-token-1"
    })
  );
  const signOutResult = await dashboard.signOutDashboardCognitoSession({
    hostedUiDomain: "https://auth.searchlint.example",
    clientId: "client-1",
    logoutUri: "https://app.searchlint.example/signed-out",
    sessionStore
  });
  assert(
    signOutResult.logoutUrl ===
      "https://auth.searchlint.example/logout?client_id=client-1&logout_uri=https%3A%2F%2Fapp.searchlint.example%2Fsigned-out",
    "Sign-out logout URL drifted."
  );
  assert(
    sessionStore.deleted === 1,
    "Sign-out must delete the stored dashboard session exactly once."
  );
  const storedAfterLogout = await dashboard.getDashboardStoredAuthSessionState({
    sessionStore,
    clock: fixedClock(1000)
  });
  assert(
    storedAfterLogout.status === "missing",
    "Stored session must be missing after logout."
  );
  const postLogoutIntent = await dashboard.resolveDashboardAuthRouteIntent({
    sessionStore,
    clock: fixedClock(1000),
    routes: {
      signIn: "/sign-in",
      dashboard: "/dashboard",
      sessionExpired: "/session-expired"
    }
  });
  assert(
    postLogoutIntent.action === "redirect" &&
      postLogoutIntent.route === "signIn" &&
      postLogoutIntent.reason === "missing-session",
    "Post-logout route intent must redirect to sign-in as a missing session."
  );

  const invalidInputStore = createSessionStore(session());
  let invalidInputError;
  try {
    await dashboard.signOutDashboardCognitoSession({
      hostedUiDomain: "https://auth.searchlint.example",
      clientId: "client-1",
      logoutUri: "/signed-out",
      sessionStore: invalidInputStore
    });
  } catch (error) {
    invalidInputError = error;
  }
  assert(
    invalidInputError?.code === "INVALID_AUTH_REQUEST",
    "Invalid logout input must fail before session deletion."
  );
  assert(
    invalidInputStore.deleted === 0,
    "Invalid logout input must not delete the stored session."
  );

  const failingStore = createFailingDeleteSessionStore(session());
  let deleteFailure;
  try {
    await dashboard.signOutDashboardCognitoSession({
      hostedUiDomain: "https://auth.searchlint.example",
      clientId: "client-1",
      logoutUri: "https://app.searchlint.example/signed-out",
      sessionStore: failingStore
    });
  } catch (error) {
    deleteFailure = error;
  }
  assert(
    deleteFailure?.code === "AUTH_STORAGE_ERROR" ||
      deleteFailure?.message === "delete failed",
    "Storage delete failures must block false logout success."
  );

  const report = {
    schemaVersion: 1,
    generatedBy: "searchlint-auth-logout-static-verifier",
    generatedAt,
    status: "static-logout-flow-passed-live-release-blocked",
    scope: {
      proofType: "deterministic static Cognito Hosted UI logout-flow contract",
      liveAwsAccess: "not used by verifier",
      doesNotClaim: [
        "live Cognito deployment",
        "real browser logout",
        "Hosted UI cookie clearing",
        "refresh-token revocation",
        "deployed dashboard logout E2E"
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
    logoutUrl: {
      endpoint: `${logoutUrl.origin}${logoutUrl.pathname}`,
      clientIdIncluded: logoutUrl.searchParams.has("client_id"),
      logoutUri: logoutUrl.searchParams.get("logout_uri"),
      stateIncluded: logoutUrl.searchParams.has("state")
    },
    sessionClearing: {
      deleteCount: sessionStore.deleted,
      storedStateAfterLogout: storedAfterLogout.status,
      postLogoutRoute: postLogoutIntent.route,
      postLogoutReason: postLogoutIntent.reason
    },
    negativeCases: {
      invalidLogoutInputPreservesSession:
        invalidInputError?.code === "INVALID_AUTH_REQUEST" &&
        invalidInputStore.deleted === 0,
      storageDeleteFailureBlocksSuccess: Boolean(deleteFailure)
    },
    remainingReleaseGates: [
      "deploy real Cognito Hosted UI",
      "complete live browser logout through Cognito",
      "prove Hosted UI cookie clearing",
      "prove refresh-token revocation or documented non-revocation policy",
      "prove deployed dashboard logout E2E"
    ]
  };

  await writeJson(reportPath, report);
  await writeJson(samplePath, report);
  console.log(
    "Auth logout static acceptance PASS: hosted UI logout/session clearing contract verified"
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
    deleted: 0,
    async save(sessionValue) {
      storedSession = sessionValue;
    },
    async load() {
      return storedSession;
    },
    async delete() {
      storedSession = undefined;
      this.deleted += 1;
    }
  };
}

function createFailingDeleteSessionStore(initial) {
  return {
    async save() {},
    async load() {
      return initial;
    },
    async delete() {
      throw new Error("delete failed");
    }
  };
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
    error instanceof Error ? error.message : "Auth logout verifier failed."
  );
  process.exitCode = 1;
});
