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
  "reports/oauth-vault-secrets-static-report.json"
);
const samplePath = path.join(
  repoRoot,
  "docs/examples/oauth-vault-secrets-static-report.sample.json"
);
const expectedExcludeCharacters = "\"'\\";

const expectedSecrets = [
  {
    logicalId: "StripeWebhookSecret",
    runtimeEnv: "SEARCHLINT_STRIPE_WEBHOOK_SECRET",
    name: "searchlint/${EnvironmentName}/stripe/webhook-secret",
    passwordLength: 48,
    output: "StripeWebhookSecretArn"
  },
  {
    logicalId: "OtelHeadersSecret",
    runtimeEnv: "OTEL_EXPORTER_OTLP_HEADERS",
    name: "searchlint/${EnvironmentName}/otel/exporter-headers",
    passwordLength: 64,
    output: "OtelHeadersSecretArn"
  }
];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const template = JSON.parse(await readText(templatePath));
  const resources = template.Resources ?? {};
  const outputs = template.Outputs ?? {};

  const secrets = expectedSecrets.map((expected) =>
    verifySecret(resources, outputs, expected)
  );

  const report = {
    schemaVersion: 1,
    generatedBy: "searchlint-oauth-vault-secrets-static-verifier",
    generatedAt,
    status: "static-secrets-manager-provisioning-passed-live-release-blocked",
    scope: {
      proofType: "deterministic static Secrets Manager CloudFormation contract",
      liveAwsAccess: "not used by verifier",
      cloudFormation: templatePath,
      doesNotClaim: [
        "real AWS Secrets Manager deployment",
        "live secret population",
        "production provider credentials",
        "live OAuth token write/read/delete",
        "external vault security review"
      ]
    },
    secrets,
    outputs: Object.fromEntries(
      secrets.map((secret) => [secret.outputName, secret.outputValue])
    ),
    forbiddenSecretScan: {
      rawSecretSamplesAbsent: true,
      plaintextSecretStringCommitted: false,
      generatedReportContainsRawSecrets: false
    },
    remainingReleaseGates: [
      "deploy the real Secrets Manager stack",
      "populate production secrets with real values",
      "verify deployed secret ARNs and KMS encryption",
      "prove live OAuth token write/read/delete against AWS",
      "complete external vault security review"
    ]
  };

  assertNoRawSecrets(report);
  await writeJson(reportPath, report);
  await writeJson(samplePath, report);
  console.log(
    "OAuth vault Secrets Manager static provisioning PASS: secret slots verified"
  );
  console.log(`Report: ${path.relative(repoRoot, reportPath)}`);
  console.log(`Sample: ${path.relative(repoRoot, samplePath)}`);
}

function verifySecret(resources, outputs, expected) {
  const resource = requiredResource(
    resources,
    expected.logicalId,
    "AWS::SecretsManager::Secret"
  );
  const properties = resource.Properties ?? {};

  assert(
    properties.Name?.["Fn::Sub"] === expected.name,
    `${expected.logicalId} must use stable SearchLint namespaced name ${expected.name}.`
  );
  assert(
    properties.Description?.includes(expected.runtimeEnv),
    `${expected.logicalId} description must identify ${expected.runtimeEnv}.`
  );
  assert(
    properties.KmsKeyId?.["Fn::GetAtt"]?.[0] === "SearchLintSecretsKey" &&
      properties.KmsKeyId["Fn::GetAtt"][1] === "Arn",
    `${expected.logicalId} must be encrypted with SearchLintSecretsKey.`
  );
  assert(
    properties.GenerateSecretString?.PasswordLength === expected.passwordLength,
    `${expected.logicalId} generated placeholder length must be ${expected.passwordLength}.`
  );
  assert(
    properties.GenerateSecretString?.ExcludeCharacters ===
      expectedExcludeCharacters,
    `${expected.logicalId} generated placeholder exclude-character policy changed.`
  );
  assert(
    properties.GenerateSecretString?.RequireEachIncludedType === true,
    `${expected.logicalId} generated placeholder must require each included type.`
  );
  assert(
    properties.SecretString === undefined,
    `${expected.logicalId} must not commit plaintext SecretString.`
  );

  const output = outputs[expected.output];
  assert(
    output?.Value?.Ref === expected.logicalId,
    `Template must output ${expected.output}.`
  );

  return {
    logicalId: expected.logicalId,
    type: resource.Type,
    name: properties.Name,
    runtimeEnv: expected.runtimeEnv,
    kmsKeyId: properties.KmsKeyId,
    generateSecretString: {
      passwordLength: properties.GenerateSecretString.PasswordLength,
      excludeCharacters: "redacted-policy-value",
      requireEachIncludedType:
        properties.GenerateSecretString.RequireEachIncludedType
    },
    plaintextSecretStringCommitted: false,
    outputName: expected.output,
    outputValue: output.Value
  };
}

function requiredResource(resources, logicalId, type) {
  const resource = resources[logicalId];
  assert(resource, `${logicalId} resource is required.`);
  assert(resource.Type === type, `${logicalId} must be ${type}.`);
  return resource;
}

function assertNoRawSecrets(report) {
  const serialized = JSON.stringify(report);
  const forbiddenSamples = [
    "whsec_",
    "sk_live",
    "ya29.",
    "provider-access-token",
    "provider-refresh-token",
    "client-secret"
  ];
  for (const sample of forbiddenSamples) {
    assert(
      !serialized.includes(sample),
      `Sanitized report must not include raw secret sample ${sample}.`
    );
  }
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
      : "Unknown OAuth vault Secrets Manager static verification error"
  );
  process.exitCode = 1;
});
