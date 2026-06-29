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
const reportPath = path.join(repoRoot, "reports/auth-mfa-static-report.json");
const samplePath = path.join(
  repoRoot,
  "docs/examples/auth-mfa-static-report.sample.json"
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
    "cognito-provisioning-contracts.test.ts"
  ]);
  run("pnpm", ["--filter", "@searchlint/api", "build"]);

  const api = await import("../services/api/dist/src/index.js");
  const contract = api.cognitoUserPoolProvisioningContract;
  const issues = api.validateCognitoUserPoolProvisioningContract(contract);
  assert(issues.length === 0, "Cognito provisioning contract drifted.");
  assert(
    contract.userPool.mfa.mode === "optional",
    "Cognito contract must require optional MFA."
  );
  assert(
    contract.userPool.mfa.softwareTokenEnabled === true,
    "Cognito contract must enable software-token MFA."
  );
  assert(
    contract.appClients[0].hostedUi.authorizationCodePkce === true,
    "Hosted UI contract must use authorization-code PKCE."
  );
  assert(
    contract.appClients[0].generateClientSecret === false,
    "Hosted UI app client must remain public/no-secret for browser flows."
  );

  const template = JSON.parse(await readText(cognitoTemplatePath));
  const userPool =
    requiredResource(
      template.Resources ?? {},
      "SearchLintUserPool",
      "AWS::Cognito::UserPool"
    ).Properties ?? {};
  const appClient =
    requiredResource(
      template.Resources ?? {},
      "SearchLintCloudApiAppClient",
      "AWS::Cognito::UserPoolClient"
    ).Properties ?? {};

  assert(
    userPool.MfaConfiguration === "OPTIONAL",
    "Cognito CloudFormation user pool must use optional MFA."
  );
  assertIncludes(
    userPool.EnabledMfas,
    "SOFTWARE_TOKEN_MFA",
    "Cognito CloudFormation user pool must enable software-token MFA."
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
  assert(
    appClient.GenerateSecret === false,
    "Cognito app client must remain no-secret for browser PKCE flows."
  );
  assertIncludes(
    appClient.SupportedIdentityProviders,
    "COGNITO",
    "Cognito app client must support the Cognito identity provider."
  );

  const report = {
    schemaVersion: 1,
    generatedBy: "searchlint-auth-mfa-static-verifier",
    generatedAt,
    status: "static-mfa-passed-live-release-blocked",
    scope: {
      proofType: "deterministic static Cognito MFA contract",
      liveAwsAccess: "not used by verifier",
      cognitoCloudFormation: cognitoTemplatePath,
      doesNotClaim: [
        "live Cognito deployment",
        "real TOTP enrollment",
        "real MFA challenge",
        "MFA recovery-code behavior",
        "deployed dashboard/API MFA behavior"
      ]
    },
    commands: [
      {
        command:
          "pnpm --filter @searchlint/api test -- cognito-provisioning-contracts.test.ts",
        status: "passed"
      },
      {
        command: "pnpm --filter @searchlint/api build",
        status: "passed"
      }
    ],
    contract: {
      mfa: contract.userPool.mfa,
      appClient: {
        hostedUiAuthorizationCodePkce:
          contract.appClients[0].hostedUi.authorizationCodePkce,
        generateClientSecret: contract.appClients[0].generateClientSecret,
        allowedOAuthFlows: contract.appClients[0].hostedUi.allowedOAuthFlows
      }
    },
    cloudFormation: {
      mfaConfiguration: userPool.MfaConfiguration,
      enabledMfas: userPool.EnabledMfas,
      allowedOAuthFlowsUserPoolClient:
        appClient.AllowedOAuthFlowsUserPoolClient,
      allowedOAuthFlows: appClient.AllowedOAuthFlows,
      generateSecret: appClient.GenerateSecret,
      supportedIdentityProviders: appClient.SupportedIdentityProviders
    },
    remainingReleaseGates: [
      "deploy real Cognito user pool and app client",
      "prove live software-token MFA enrollment",
      "prove live TOTP challenge behavior",
      "prove MFA recovery/fallback behavior",
      "prove deployed dashboard/API MFA behavior"
    ]
  };

  await writeJson(reportPath, report);
  await writeJson(samplePath, report);
  console.log(
    "Auth MFA static acceptance PASS: optional software-token MFA contract verified"
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
      : "Unknown auth MFA static verification error"
  );
  process.exitCode = 1;
});
