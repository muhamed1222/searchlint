#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { format } from "prettier";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const generatedAt = "2026-06-22T00:00:00.000Z";
const templatePath = "infra/aws/secret-vault-kms.cloudformation.json";
const reportPath = path.join(
  repoRoot,
  "reports/oauth-vault-kms-static-report.json"
);
const samplePath = path.join(
  repoRoot,
  "docs/examples/oauth-vault-kms-static-report.sample.json"
);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const template = JSON.parse(await readText(templatePath));
  const resources = template.Resources ?? {};
  const key = requiredResource(
    resources,
    "SearchLintSecretsKey",
    "AWS::KMS::Key"
  ).Properties;
  const alias = requiredResource(
    resources,
    "SearchLintSecretsKeyAlias",
    "AWS::KMS::Alias"
  ).Properties;

  assert(
    key.Description.includes("SearchLint Cloud KMS key"),
    "KMS key description must identify the SearchLint vault key."
  );
  assert(
    key.EnableKeyRotation === true,
    "SearchLint vault KMS key must enable rotation."
  );
  const keyPolicy = key.KeyPolicy;
  assert(
    keyPolicy?.Version === "2012-10-17",
    "KMS key policy must use version 2012-10-17."
  );
  const accountRootStatement = (keyPolicy.Statement ?? []).find(
    (statement) =>
      statement.Sid === "EnableIamUserPermissions" &&
      statement.Effect === "Allow" &&
      statement.Action === "kms:*" &&
      statement.Resource === "*" &&
      statement.Principal?.AWS?.["Fn::Sub"] ===
        "arn:${AWS::Partition}:iam::${AWS::AccountId}:root"
  );
  assert(
    accountRootStatement,
    "KMS key policy must allow account-root IAM policy administration."
  );
  assert(
    alias.AliasName?.["Fn::Sub"] ===
      "alias/searchlint/${EnvironmentName}/secrets",
    "KMS alias must be stable and SearchLint namespaced."
  );
  assert(
    alias.TargetKeyId?.Ref === "SearchLintSecretsKey",
    "KMS alias must target SearchLintSecretsKey."
  );

  const outputs = template.Outputs ?? {};
  const keyArnOutput = outputs.SearchLintSecretsKeyArn;
  const aliasOutput = outputs.SearchLintSecretsKeyAliasName;
  assert(
    keyArnOutput?.Value?.["Fn::GetAtt"]?.[0] === "SearchLintSecretsKey" &&
      keyArnOutput.Value["Fn::GetAtt"][1] === "Arn",
    "Template must output SearchLintSecretsKeyArn."
  );
  assert(
    aliasOutput?.Value?.Ref === "SearchLintSecretsKeyAlias",
    "Template must output SearchLintSecretsKeyAliasName."
  );

  const report = {
    schemaVersion: 1,
    generatedBy: "searchlint-oauth-vault-kms-static-verifier",
    generatedAt,
    status: "static-kms-provisioning-passed-live-release-blocked",
    scope: {
      proofType: "deterministic static KMS CloudFormation contract",
      liveAwsAccess: "not used by verifier",
      cloudFormation: templatePath,
      doesNotClaim: [
        "real AWS KMS deployment",
        "deployed key ARN verification",
        "deployed alias verification",
        "production secret encryption",
        "external vault security review"
      ]
    },
    kms: {
      logicalId: "SearchLintSecretsKey",
      type: "AWS::KMS::Key",
      enableKeyRotation: key.EnableKeyRotation,
      keyPolicyVersion: keyPolicy.Version,
      accountRootAdministration: true
    },
    alias: {
      logicalId: "SearchLintSecretsKeyAlias",
      type: "AWS::KMS::Alias",
      aliasName: alias.AliasName,
      targetKeyId: alias.TargetKeyId
    },
    outputs: {
      searchLintSecretsKeyArn: keyArnOutput.Value,
      searchLintSecretsKeyAliasName: aliasOutput.Value
    },
    remainingReleaseGates: [
      "deploy the real KMS key",
      "verify deployed key ARN and alias",
      "wire deployed key ARN into production secrets/templates",
      "complete external vault security review"
    ]
  };

  await writeJson(reportPath, report);
  await writeJson(samplePath, report);
  console.log(
    "OAuth vault KMS static provisioning PASS: KMS key contract verified"
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
      : "Unknown OAuth vault KMS static verification error"
  );
  process.exitCode = 1;
});
