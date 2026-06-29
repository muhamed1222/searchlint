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
  "reports/auth-password-reset-static-report.json"
);
const samplePath = path.join(
  repoRoot,
  "docs/examples/auth-password-reset-static-report.sample.json"
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
    contract.userPool.accountRecovery.mechanisms,
    "verified_email",
    "Cognito contract must require verified-email account recovery."
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
    userPool.AutoVerifiedAttributes,
    "email",
    "Password reset must be backed by verified email."
  );
  assert(
    JSON.stringify(userPool.AccountRecoverySetting?.RecoveryMechanisms) ===
      JSON.stringify([{ Name: "verified_email", Priority: 1 }]),
    "Cognito account recovery must use verified_email with priority 1."
  );
  assert(
    userPool.UserAttributeUpdateSettings?.AttributesRequireVerificationBeforeUpdate?.includes(
      "email"
    ),
    "Email updates must require verification before password-reset recovery can rely on email."
  );

  const password = userPool.Policies?.PasswordPolicy ?? {};
  assert(
    password.MinimumLength === 12,
    "Password reset must preserve minimum password length 12."
  );
  for (const property of [
    "RequireLowercase",
    "RequireUppercase",
    "RequireNumbers",
    "RequireSymbols"
  ]) {
    assert(
      password[property] === true,
      `Password reset must preserve ${property}.`
    );
  }
  assert(
    appClient.GenerateSecret === false,
    "Password reset app client must remain public/no-secret for browser flows."
  );
  assert(
    appClient.PreventUserExistenceErrors === "ENABLED",
    "Password reset must hide user-existence errors."
  );
  assertIncludes(
    appClient.SupportedIdentityProviders,
    "COGNITO",
    "Password reset app client must support Cognito identity provider."
  );

  const report = {
    schemaVersion: 1,
    generatedBy: "searchlint-auth-password-reset-static-verifier",
    generatedAt,
    status: "static-password-reset-passed-live-release-blocked",
    scope: {
      proofType: "deterministic static Cognito password-reset contract",
      liveAwsAccess: "not used by verifier",
      cognitoCloudFormation: cognitoTemplatePath,
      doesNotClaim: [
        "live Cognito deployment",
        "real forgot-password request",
        "real reset email delivery",
        "real confirmation-code handling",
        "real password update",
        "deployed dashboard/API password-reset behavior"
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
      accountRecoveryMechanisms: contract.userPool.accountRecovery.mechanisms,
      requiredVerifiedAttributes: contract.userPool.requiredVerifiedAttributes,
      signInAliases: contract.userPool.signInAliases,
      passwordPolicy: contract.userPool.passwordPolicy
    },
    cloudFormation: {
      accountRecoverySetting: userPool.AccountRecoverySetting,
      autoVerifiedAttributes: userPool.AutoVerifiedAttributes,
      emailUpdateRequiresVerification:
        userPool.UserAttributeUpdateSettings
          .AttributesRequireVerificationBeforeUpdate,
      passwordPolicy: userPool.Policies.PasswordPolicy,
      preventUserExistenceErrors: appClient.PreventUserExistenceErrors,
      publicAppClient: appClient.GenerateSecret === false
    },
    remainingReleaseGates: [
      "deploy real Cognito user pool and app client",
      "prove live forgot-password request",
      "prove reset email delivery",
      "prove confirmation-code handling",
      "prove password update with policy enforcement",
      "prove deployed dashboard/API password-reset behavior"
    ]
  };

  await writeJson(reportPath, report);
  await writeJson(samplePath, report);
  console.log(
    "Auth password-reset static acceptance PASS: verified-email recovery contract verified"
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
      : "Auth password-reset verifier failed."
  );
  process.exitCode = 1;
});
