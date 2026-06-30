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
  "reports/auth-registration-static-report.json"
);
const samplePath = path.join(
  repoRoot,
  "docs/examples/auth-registration-static-report.sample.json"
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
    "@searchlint/api",
    "test",
    "--",
    "cognito-provisioning-contracts.test.ts"
  ]);
  run("pnpm", [
    "--filter",
    "@searchlint/dashboard",
    "test",
    "--",
    "api-client.test.ts"
  ]);
  run("pnpm", ["--filter", "@searchlint/api", "build"]);

  const api = await import("../services/api/dist/src/index.js");
  const dashboard = await import("../apps/dashboard/dist/src/api-client.js");
  const contract = api.cognitoUserPoolProvisioningContract;
  const issues = api.validateCognitoUserPoolProvisioningContract(contract);
  assert(issues.length === 0, "Cognito provisioning contract drifted.");

  const appClientContract = contract.appClients[0];
  assert(
    contract.userPool.selfSignupEnabled === true,
    "Cognito contract must allow self-service signup."
  );
  assert(
    appClientContract.hostedUi.authorizationCodePkce === true,
    "Cognito hosted UI contract must require authorization-code PKCE."
  );

  const template = JSON.parse(await readText(cognitoTemplatePath));
  const resources = template.Resources ?? {};
  const userPool = requiredResource(
    resources,
    "SearchLintUserPool",
    "AWS::Cognito::UserPool"
  ).Properties;
  const appClient = requiredResource(
    resources,
    "SearchLintCloudApiAppClient",
    "AWS::Cognito::UserPoolClient"
  ).Properties;
  const hostedUiDomain = requiredResource(
    resources,
    "SearchLintUserPoolDomain",
    "AWS::Cognito::UserPoolDomain"
  ).Properties;

  assert(
    userPool.AdminCreateUserConfig?.AllowAdminCreateUserOnly === false,
    "Cognito user pool must allow self-service signup."
  );
  assertIncludes(
    userPool.UsernameAttributes,
    "email",
    "Cognito registration must use email as the sign-in alias."
  );
  assertIncludes(
    userPool.AutoVerifiedAttributes,
    "email",
    "Cognito registration must auto-verify email addresses."
  );
  assert(
    appClient.AllowedOAuthFlowsUserPoolClient === true,
    "Cognito app client must enable Hosted UI OAuth flows."
  );
  assertIncludes(
    appClient.AllowedOAuthFlows,
    "code",
    "Cognito app client must allow authorization-code flow."
  );
  for (const scope of appClientContract.hostedUi.allowedOAuthScopes) {
    assertIncludes(
      appClient.AllowedOAuthScopes,
      scope,
      `Cognito app client must allow ${scope} scope.`
    );
  }
  assertIncludes(
    appClient.CallbackURLs?.map((value) => JSON.stringify(value)),
    JSON.stringify({ "Fn::Sub": "${AppBaseUrl}/auth/callback" }),
    "Cognito app client must allow the dashboard auth callback URL."
  );
  assertIncludes(
    appClient.LogoutURLs?.map((value) => JSON.stringify(value)),
    JSON.stringify({ "Fn::Sub": "${AppBaseUrl}/signed-out" }),
    "Cognito app client must allow the dashboard signed-out URL."
  );
  assert(
    appClient.GenerateSecret === false,
    "Cognito registration app client must be public/no-secret for PKCE."
  );
  assert(
    appClient.PreventUserExistenceErrors === "ENABLED",
    "Cognito app client must hide user-existence errors."
  );
  assert(
    hostedUiDomain.Domain?.Ref === "HostedUiDomainPrefix",
    "Cognito Hosted UI domain must use the checked domain-prefix parameter."
  );

  const config = {
    hostedUiDomain: "https://auth.searchlint.example",
    clientId: "client-1",
    redirectUri: "https://app.searchlint.example/auth/callback",
    scopes: appClientContract.hostedUi.allowedOAuthScopes
  };
  const authUrl = new URL(
    dashboard.createDashboardCognitoAuthorizationUrl(config, {
      state: "state-1",
      nonce: "nonce-1",
      codeChallenge: "challenge-1"
    })
  );
  assert(
    authUrl.pathname === "/oauth2/authorize",
    "Dashboard auth start must use Cognito authorize endpoint."
  );
  assert(
    authUrl.searchParams.get("response_type") === "code",
    "Dashboard auth start must request authorization-code flow."
  );
  assert(
    authUrl.searchParams.get("code_challenge_method") === "S256",
    "Dashboard auth start must use PKCE S256."
  );

  const pendingStore = createPendingStore();
  const startResult = await dashboard.startDashboardCognitoPkceAuth({
    config,
    request: {
      state: "state-1",
      nonce: "nonce-1",
      codeChallenge: "challenge-1"
    },
    codeVerifier: "verifier-1",
    store: pendingStore,
    clock: fixedClock(1000),
    ttlSeconds: 300
  });
  assert(
    startResult.pendingState.expiresAt === 1300,
    "Dashboard pending registration auth state TTL drifted."
  );

  const callbackResult =
    await dashboard.consumeDashboardCognitoPkceAuthCallback({
      config,
      callbackUrl:
        "https://app.searchlint.example/auth/callback?code=code-1&state=state-1",
      store: pendingStore,
      clock: fixedClock(1100)
    });
  assert(
    callbackResult.tokenExchangeRequest.codeVerifier === "verifier-1",
    "Dashboard registration callback must preserve the PKCE verifier."
  );

  const sessionStore = createSessionStore();
  const tokenCalls = [];
  await dashboard.completeDashboardCognitoPkceAuthCallback({
    config,
    callbackUrl:
      "https://app.searchlint.example/auth/callback?code=code-2&state=state-2",
    pendingAuthStore: createPendingStore([
      {
        state: "state-2",
        nonce: "nonce-2",
        codeChallenge: "challenge-2",
        redirectUri: config.redirectUri,
        codeVerifier: "verifier-2",
        createdAt: 1000,
        expiresAt: 1300
      }
    ]),
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
            access_token: "access-token-1",
            id_token: "id-token-1",
            refresh_token: "refresh-token-1",
            expires_in: 3600,
            token_type: "Bearer"
          };
        }
      };
    },
    clock: fixedClock(1000)
  });
  assert(
    sessionStore.saved.length === 1,
    "Dashboard registration callback must save exactly one auth session."
  );
  assert(
    tokenCalls[0]?.init.body.includes("grant_type=authorization_code"),
    "Dashboard registration callback must exchange authorization codes."
  );

  const report = {
    schemaVersion: 1,
    generatedBy: "searchlint-auth-registration-static-verifier",
    generatedAt,
    status: "static-registration-flow-passed-live-release-blocked",
    scope: {
      proofType:
        "deterministic static Cognito Hosted UI registration-flow contract",
      liveAwsAccess: "not used by verifier",
      cognitoCloudFormation: cognitoTemplatePath,
      doesNotClaim: [
        "live Cognito deployment",
        "real user creation",
        "live signup email delivery",
        "live email verification completion",
        "live MFA challenge",
        "live session issuance from AWS",
        "deployed dashboard registration E2E"
      ]
    },
    commands: [
      {
        command:
          "pnpm --filter @searchlint/api test -- cognito-provisioning-contracts.test.ts",
        status: "passed"
      },
      {
        command:
          "pnpm --filter @searchlint/dashboard test -- api-client.test.ts",
        status: "passed"
      },
      {
        command: "pnpm --filter @searchlint/api build",
        status: "passed"
      },
      {
        command: "pnpm --filter @searchlint/dashboard build",
        status: "passed"
      }
    ],
    cognitoContract: {
      selfSignupEnabled: contract.userPool.selfSignupEnabled,
      signInAliases: contract.userPool.signInAliases,
      requiredVerifiedAttributes: contract.userPool.requiredVerifiedAttributes,
      appClient: {
        name: appClientContract.name,
        generateClientSecret: appClientContract.generateClientSecret,
        hostedUi: appClientContract.hostedUi
      }
    },
    cloudFormation: {
      userPoolAllowsSelfSignup:
        userPool.AdminCreateUserConfig.AllowAdminCreateUserOnly === false,
      hostedUiDomainLogicalId: "SearchLintUserPoolDomain",
      hostedUiDomainParameter: hostedUiDomain.Domain.Ref,
      allowedOAuthFlows: appClient.AllowedOAuthFlows,
      allowedOAuthScopes: appClient.AllowedOAuthScopes,
      callbackUrlTemplate: appClient.CallbackURLs[0],
      logoutUrlTemplate: appClient.LogoutURLs[0],
      preventUserExistenceErrors: appClient.PreventUserExistenceErrors
    },
    dashboardAuthContract: {
      authorizationEndpoint: `${authUrl.origin}${authUrl.pathname}`,
      responseType: authUrl.searchParams.get("response_type"),
      pkceMethod: authUrl.searchParams.get("code_challenge_method"),
      pendingStateTtlSeconds:
        startResult.pendingState.expiresAt - startResult.pendingState.createdAt,
      tokenExchangeGrant: "authorization_code",
      savedSessionIdentityProvider: sessionStore.saved[0]?.identityProvider
    },
    remainingReleaseGates: [
      "deploy real Cognito user pool and Hosted UI domain",
      "create real user through hosted signup",
      "prove live email verification delivery and completion",
      "prove live MFA enrollment/challenge when required",
      "prove deployed dashboard registration E2E",
      "prove deployed Cloud API accepts the issued Cognito access token"
    ]
  };

  await writeJson(reportPath, report);
  await writeJson(samplePath, report);
  console.log(
    "Auth registration static acceptance PASS: hosted UI PKCE registration contract verified"
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

function createSessionStore() {
  return {
    saved: [],
    async save(session) {
      this.saved.push(session);
    },
    async load() {
      return this.saved.at(-1);
    },
    async delete() {
      this.saved.length = 0;
    }
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
      : "Auth registration verifier failed."
  );
  process.exitCode = 1;
});
