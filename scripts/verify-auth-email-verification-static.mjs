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
  "reports/auth-email-verification-static-report.json"
);
const samplePath = path.join(
  repoRoot,
  "docs/examples/auth-email-verification-static-report.sample.json"
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
  assertIncludes(
    contract.userPool.signInAliases,
    "email",
    "Cognito contract must use email sign-in."
  );
  assertIncludes(
    contract.userPool.requiredVerifiedAttributes,
    "email",
    "Cognito contract must require verified email."
  );
  assertIncludes(
    contract.userPool.accountRecovery.mechanisms,
    "verified_email",
    "Cognito contract must depend on verified-email account recovery."
  );
  assertIncludes(
    contract.appClients[0].hostedUi.allowedOAuthScopes,
    "email",
    "Hosted UI contract must include email scope."
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

  assertIncludes(
    userPool.UsernameAttributes,
    "email",
    "Cognito user pool must use email as a username attribute."
  );
  assertIncludes(
    userPool.AutoVerifiedAttributes,
    "email",
    "Cognito user pool must auto-verify email."
  );
  assertIncludes(
    userPool.UserAttributeUpdateSettings
      ?.AttributesRequireVerificationBeforeUpdate,
    "email",
    "Cognito user pool must require verification before email updates."
  );
  const emailSchema = (userPool.Schema ?? []).find(
    (attribute) => attribute.Name === "email"
  );
  assert(
    emailSchema,
    "Cognito user pool must define an email schema attribute."
  );
  assert(
    emailSchema.AttributeDataType === "String",
    "Cognito email schema must be a string."
  );
  assert(
    emailSchema.Required === true,
    "Cognito email schema must be required."
  );
  assert(emailSchema.Mutable === true, "Cognito email schema must be mutable.");
  assert(
    JSON.stringify(userPool.AccountRecoverySetting?.RecoveryMechanisms) ===
      JSON.stringify([{ Name: "verified_email", Priority: 1 }]),
    "Cognito account recovery must use verified_email."
  );
  assertIncludes(
    appClient.AllowedOAuthScopes,
    "email",
    "Cognito Hosted UI app client must allow email scope."
  );

  const report = {
    schemaVersion: 1,
    generatedBy: "searchlint-auth-email-verification-static-verifier",
    generatedAt,
    status: "static-email-verification-passed-live-release-blocked",
    scope: {
      proofType: "deterministic static Cognito email-verification contract",
      liveAwsAccess: "not used by verifier",
      cognitoCloudFormation: cognitoTemplatePath,
      doesNotClaim: [
        "live Cognito deployment",
        "real verification email delivery",
        "real confirmation-code handling",
        "verification resend behavior",
        "bounce handling",
        "deployed dashboard/API email-verification behavior"
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
      signInAliases: contract.userPool.signInAliases,
      requiredVerifiedAttributes: contract.userPool.requiredVerifiedAttributes,
      accountRecoveryMechanisms: contract.userPool.accountRecovery.mechanisms,
      hostedUiScopes: contract.appClients[0].hostedUi.allowedOAuthScopes
    },
    cloudFormation: {
      usernameAttributes: userPool.UsernameAttributes,
      autoVerifiedAttributes: userPool.AutoVerifiedAttributes,
      emailUpdateRequiresVerification:
        userPool.UserAttributeUpdateSettings
          .AttributesRequireVerificationBeforeUpdate,
      emailSchema,
      accountRecoverySetting: userPool.AccountRecoverySetting,
      hostedUiScopes: appClient.AllowedOAuthScopes
    },
    remainingReleaseGates: [
      "deploy real Cognito user pool and app client",
      "prove real verification email delivery",
      "prove confirmation-code handling",
      "prove verification resend behavior",
      "prove bounce/failure handling",
      "prove deployed dashboard/API email-verification behavior"
    ]
  };

  await writeJson(reportPath, report);
  await writeJson(samplePath, report);
  console.log(
    "Auth email-verification static acceptance PASS: verified-email contract verified"
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
      : "Auth email-verification verifier failed."
  );
  process.exitCode = 1;
});
