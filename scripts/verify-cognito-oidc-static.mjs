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
const apiTemplatePath = "infra/aws/cloud-api-ecs-fargate.cloudformation.json";
const reportPath = path.join(
  repoRoot,
  "reports/cognito-oidc-static-report.json"
);
const samplePath = path.join(
  repoRoot,
  "docs/examples/cognito-oidc-static-report.sample.json"
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
    "@searchlint/api",
    "test",
    "--",
    "cognito-provisioning-contracts.test.ts",
    "cognito-auth.test.ts",
    "node-http-server.test.ts"
  ]);
  run("pnpm", ["--filter", "@searchlint/api", "build"]);

  const api = await import("../services/api/dist/src/index.js");
  const contract = api.cognitoUserPoolProvisioningContract;
  const issues = api.validateCognitoUserPoolProvisioningContract(contract);
  assert(issues.length === 0, "Cognito provisioning contract drifted.");

  const cognitoTemplate = JSON.parse(await readText(cognitoTemplatePath));
  const cognitoResources = cognitoTemplate.Resources ?? {};
  const cognitoOutputs = cognitoTemplate.Outputs ?? {};
  const userPool = requiredResource(
    cognitoResources,
    "SearchLintUserPool",
    "AWS::Cognito::UserPool"
  ).Properties;
  const appClient = requiredResource(
    cognitoResources,
    "SearchLintCloudApiAppClient",
    "AWS::Cognito::UserPoolClient"
  ).Properties;
  const platformGroup = requiredResource(
    cognitoResources,
    "SearchLintPlatformAccessGroup",
    "AWS::Cognito::UserPoolGroup"
  ).Properties;
  const hostedUiDomain = requiredResource(
    cognitoResources,
    "SearchLintUserPoolDomain",
    "AWS::Cognito::UserPoolDomain"
  ).Properties;

  assertIncludes(
    userPool.UsernameAttributes,
    "email",
    "Cognito must support email sign-in."
  );
  assertIncludes(
    userPool.AutoVerifiedAttributes,
    "email",
    "Cognito must auto-verify email."
  );
  assert(
    userPool.UserAttributeUpdateSettings?.AttributesRequireVerificationBeforeUpdate?.includes(
      "email"
    ),
    "Cognito must require email verification before email updates."
  );
  assert(
    userPool.AdminCreateUserConfig?.AllowAdminCreateUserOnly === false,
    "Cognito must allow self-service signup."
  );
  const password = userPool.Policies?.PasswordPolicy ?? {};
  assert(
    password.MinimumLength === 12,
    "Cognito password minimum length drifted."
  );
  for (const property of [
    "RequireLowercase",
    "RequireUppercase",
    "RequireNumbers",
    "RequireSymbols"
  ]) {
    assert(
      password[property] === true,
      `Cognito password ${property} must be true.`
    );
  }
  assert(
    userPool.MfaConfiguration === "OPTIONAL",
    "Cognito MFA must be optional."
  );
  assertIncludes(
    userPool.EnabledMfas,
    "SOFTWARE_TOKEN_MFA",
    "Cognito must enable software-token MFA."
  );
  assert(
    appClient.ClientName === "searchlint-cloud-api",
    "Cognito app client name drifted."
  );
  assert(
    appClient.GenerateSecret === false,
    "Cognito app client must be public/no-secret."
  );
  assertIncludes(
    appClient.SupportedIdentityProviders,
    "COGNITO",
    "Cognito app client must support COGNITO IdP."
  );
  assert(
    appClient.AllowedOAuthFlowsUserPoolClient === true,
    "Cognito app client must enable Hosted UI OAuth flows."
  );
  assertIncludes(
    appClient.AllowedOAuthFlows,
    "code",
    "Cognito app client must support authorization-code flow."
  );
  for (const scope of ["openid", "email", "profile"]) {
    assertIncludes(
      appClient.AllowedOAuthScopes,
      scope,
      `Cognito app client must include ${scope} scope.`
    );
  }
  assertIncludes(
    appClient.CallbackURLs?.map((value) => JSON.stringify(value)),
    JSON.stringify({ "Fn::Sub": "${AppBaseUrl}/auth/callback" }),
    "Cognito app client must allow dashboard auth callback URL."
  );
  assertIncludes(
    appClient.LogoutURLs?.map((value) => JSON.stringify(value)),
    JSON.stringify({ "Fn::Sub": "${AppBaseUrl}/signed-out" }),
    "Cognito app client must allow dashboard signed-out URL."
  );
  assertIncludes(
    appClient.ExplicitAuthFlows,
    "ALLOW_USER_SRP_AUTH",
    "Cognito app client must support SRP auth."
  );
  assertIncludes(
    appClient.ExplicitAuthFlows,
    "ALLOW_REFRESH_TOKEN_AUTH",
    "Cognito app client must support refresh tokens."
  );
  assert(
    appClient.AccessTokenValidity === 60,
    "Access token validity drifted."
  );
  assert(appClient.IdTokenValidity === 60, "ID token validity drifted.");
  assert(
    appClient.RefreshTokenValidity === 30,
    "Refresh token validity drifted."
  );
  assert(
    platformGroup.GroupName === "searchlint-platform-access",
    "Cognito platform access group drifted."
  );
  assert(
    platformGroup.Description.includes(
      "Tenant RBAC is stored in SearchLint PostgreSQL memberships"
    ),
    "Cognito group must not become tenant RBAC source."
  );
  assert(
    hostedUiDomain.Domain?.Ref === "HostedUiDomainPrefix",
    "Cognito Hosted UI domain must come from the checked domain-prefix parameter."
  );
  assert(
    hostedUiDomain.UserPoolId?.Ref === "SearchLintUserPool",
    "Cognito Hosted UI domain must attach to the SearchLint user pool."
  );

  for (const output of [
    "SearchLintCognitoIssuer",
    "SearchLintCognitoAudience",
    "SearchLintCognitoJwksUrl",
    "SearchLintCognitoTokenUse",
    "SearchLintCognitoPlatformAccessGroup",
    "SearchLintCognitoHostedUiDomain"
  ]) {
    assert(cognitoOutputs[output], `${output} output is required.`);
  }
  assert(
    cognitoOutputs.SearchLintCognitoTokenUse.Value === "access",
    "Cognito token-use output must be access."
  );

  const apiTemplate = JSON.parse(await readText(apiTemplatePath));
  const apiTask =
    requiredResource(
      apiTemplate.Resources ?? {},
      "CloudApiTaskDefinition",
      "AWS::ECS::TaskDefinition"
    ).Properties ?? {};
  const apiContainer = apiTask.ContainerDefinitions?.[0];
  assert(apiContainer, "Cloud API task must define a container.");
  const apiEnv = objectByName(apiContainer.Environment ?? []);
  for (const [name, parameter] of [
    ["SEARCHLINT_COGNITO_ISSUER", "CognitoIssuer"],
    ["SEARCHLINT_COGNITO_AUDIENCE", "CognitoAudience"],
    ["SEARCHLINT_COGNITO_JWKS_URL", "CognitoJwksUrl"],
    ["SEARCHLINT_COGNITO_TOKEN_USE", "CognitoTokenUse"]
  ]) {
    assert(
      apiEnv.get(name)?.Value?.Ref === parameter,
      `Cloud API ${name} must come from ${parameter}.`
    );
  }

  const report = {
    schemaVersion: 1,
    generatedBy: "searchlint-cognito-oidc-static-verifier",
    generatedAt,
    status: "static-cognito-oidc-provisioning-passed-release-blocked",
    scope: {
      proofType: "deterministic static Cognito/OIDC provisioning contract",
      liveAwsAccess: "not used by verifier",
      cognitoCloudFormation: cognitoTemplatePath,
      apiCloudFormation: apiTemplatePath,
      doesNotClaim: [
        "live Cognito deployment",
        "live signup",
        "live login",
        "live logout",
        "live password reset",
        "live email verification",
        "live MFA",
        "live refresh-token behavior",
        "live session expiry"
      ]
    },
    commands: [
      {
        command:
          "pnpm --filter @searchlint/api test -- cognito-provisioning-contracts.test.ts cognito-auth.test.ts node-http-server.test.ts",
        status: "passed"
      },
      {
        command: "pnpm --filter @searchlint/api build",
        status: "passed"
      }
    ],
    contract: {
      id: contract.id,
      provider: contract.provider,
      identityProtocol: contract.identityProtocol,
      jwtAlgorithm: contract.userPool.jwtAlgorithm,
      signInAliases: contract.userPool.signInAliases,
      requiredVerifiedAttributes: contract.userPool.requiredVerifiedAttributes,
      mfa: contract.userPool.mfa,
      tenantRbacSource: contract.authorization.tenantRbacSource,
      appClients: contract.appClients,
      environment: contract.environment.variables
    },
    cloudFormation: {
      userPoolLogicalId: "SearchLintUserPool",
      appClientLogicalId: "SearchLintCloudApiAppClient",
      platformAccessGroupLogicalId: "SearchLintPlatformAccessGroup",
      usernameAttributes: userPool.UsernameAttributes,
      autoVerifiedAttributes: userPool.AutoVerifiedAttributes,
      mfaConfiguration: userPool.MfaConfiguration,
      enabledMfas: userPool.EnabledMfas,
      appClientName: appClient.ClientName,
      generateClientSecret: appClient.GenerateSecret,
      allowedOAuthFlowsUserPoolClient:
        appClient.AllowedOAuthFlowsUserPoolClient,
      allowedOAuthFlows: appClient.AllowedOAuthFlows,
      allowedOAuthScopes: appClient.AllowedOAuthScopes,
      callbackUrls: appClient.CallbackURLs,
      logoutUrls: appClient.LogoutURLs,
      explicitAuthFlows: appClient.ExplicitAuthFlows,
      tokenValidity: {
        accessMinutes: appClient.AccessTokenValidity,
        idMinutes: appClient.IdTokenValidity,
        refreshDays: appClient.RefreshTokenValidity
      },
      hostedUiDomainLogicalId: "SearchLintUserPoolDomain",
      outputs: Object.keys(cognitoOutputs).sort(),
      apiEnvironmentVariables: [
        "SEARCHLINT_COGNITO_ISSUER",
        "SEARCHLINT_COGNITO_AUDIENCE",
        "SEARCHLINT_COGNITO_JWKS_URL",
        "SEARCHLINT_COGNITO_TOKEN_USE"
      ]
    },
    remainingReleaseGates: [
      "Deploy the real Cognito user pool and app client.",
      "Verify live signup, login, logout, refresh-token, password-reset, email-verification, MFA, and session-expiry flows.",
      "Wire deployed Cloud API to the deployed Cognito issuer and JWKS URL.",
      "Capture live API authentication proof against deployed Cognito.",
      "Verify invite acceptance and dashboard team-management flows."
    ]
  };

  assertNoSensitiveValues(JSON.stringify(report));
  await mkdir(path.dirname(reportPath), { recursive: true });
  await mkdir(path.dirname(samplePath), { recursive: true });
  await writeJson(reportPath, report);
  await writeJson(samplePath, report);

  console.log(
    `Cognito/OIDC static contract PASS: provider=${contract.provider}, appClient=${appClient.ClientName}`
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

function objectByName(items) {
  return new Map(
    items
      .filter((item) => item && typeof item === "object" && "Name" in item)
      .map((item) => [item.Name, item])
  );
}

function assertIncludes(values, expected, message) {
  assert(Array.isArray(values) && values.includes(expected), message);
}

async function readText(relativePath) {
  return readFile(path.join(repoRoot, relativePath), "utf8");
}

function assertNoSensitiveValues(text) {
  const forbidden = [
    /private_key/i,
    /client-secret/i,
    /authorization:/i,
    /bearer\s+[A-Za-z0-9._-]{8,}/i,
    /sk_live/i,
    /whsec_[A-Za-z0-9]/i,
    /postgres:\/\/user/i,
    /-----BEGIN PRIVATE KEY-----/i,
    /ya29\./i,
    /xox[baprs]-/i
  ];
  const match = forbidden.find((pattern) => pattern.test(text));
  if (match) {
    throw new Error(
      `Sensitive value leaked into Cognito/OIDC evidence: ${match}`
    );
  }
}

async function writeJson(filePath, data) {
  await writeFile(
    filePath,
    await format(JSON.stringify(data), { parser: "json" })
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
