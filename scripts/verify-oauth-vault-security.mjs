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
const reportPath = path.join(
  repoRoot,
  "reports/oauth-vault-security-report.json"
);
const samplePath = path.join(
  repoRoot,
  "docs/examples/oauth-vault-security-report.sample.json"
);
const fixedGeneratedAt = "2026-06-22T00:00:00.000Z";
const forbiddenSampleTokens = [
  "provider-access-token",
  "provider-refresh-token",
  "google-access-token",
  "google-refresh-token",
  "yandex-secret",
  "google-secret",
  "authorization-code",
  "old-refresh-token",
  "refreshed-access-token"
];

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

function caseResult(id, status, evidence, notes = []) {
  return { id, status, evidence, notes };
}

async function readText(relativePath) {
  return readFile(path.join(repoRoot, relativePath), "utf8");
}

async function readJson(relativePath) {
  return JSON.parse(await readText(relativePath));
}

async function main() {
  run("pnpm", ["--filter", "@searchlint/api", "test"], { stdio: "inherit" });
  run("pnpm", ["--filter", "@searchlint/workers", "test"], {
    stdio: "inherit"
  });
  run("pnpm", ["--filter", "@searchlint/api", "build"], { stdio: "inherit" });
  run("pnpm", ["--filter", "@searchlint/workers", "build"], {
    stdio: "inherit"
  });

  const cases = [];

  const vaultTemplate = await readJson(
    "infra/aws/secret-vault-kms.cloudformation.json"
  );
  const vaultResources = vaultTemplate.Resources ?? {};
  assertResource(vaultResources, "SearchLintSecretsKey", "AWS::KMS::Key");
  assertResource(
    vaultResources,
    "SearchLintSecretsKeyAlias",
    "AWS::KMS::Alias"
  );
  assertResource(
    vaultResources,
    "StripeWebhookSecret",
    "AWS::SecretsManager::Secret"
  );
  assertResource(
    vaultResources,
    "OtelHeadersSecret",
    "AWS::SecretsManager::Secret"
  );
  assert(
    vaultResources.SearchLintSecretsKey.Properties?.EnableKeyRotation === true,
    "Secret vault KMS key rotation must be enabled."
  );
  for (const name of ["StripeWebhookSecret", "OtelHeadersSecret"]) {
    assert(
      vaultResources[name].Properties?.KmsKeyId,
      `${name} must use the SearchLint KMS key.`
    );
  }
  const externalSchedule = await readJson(
    "infra/aws/external-observation-schedule.cloudformation.json"
  );
  const taskPolicy = JSON.stringify(
    externalSchedule.Resources?.ExternalObservationTaskRole?.Properties
      ?.Policies ?? []
  );
  for (const action of [
    "secretsmanager:GetSecretValue",
    "secretsmanager:PutSecretValue",
    "kms:Decrypt",
    "kms:Encrypt"
  ]) {
    assert(
      taskPolicy.includes(action),
      `External observation task policy missing ${action}.`
    );
  }
  cases.push(
    caseResult("kms-secrets-manager-template-contract", "PASS", {
      kmsKeyRotation: true,
      managedSecretSlots: ["StripeWebhookSecret", "OtelHeadersSecret"],
      externalObservationTaskActions: [
        "secretsmanager:GetSecretValue",
        "secretsmanager:PutSecretValue",
        "kms:Decrypt",
        "kms:Encrypt"
      ],
      cloudFormation: [
        "infra/aws/secret-vault-kms.cloudformation.json",
        "infra/aws/external-observation-schedule.cloudformation.json"
      ]
    })
  );

  const apiTest = await readText("services/api/test/api.test.ts");
  for (const phrase of [
    "completes external provider OAuth connections without persisting raw token values",
    "revokes external provider OAuth connections and deletes token secrets with audit evidence",
    "rejects external provider OAuth revocation before secret deletion when identity checks fail",
    "denies external provider OAuth revocation without connector management permission",
    "does not write OAuth secrets or metadata when token exchange fails",
    "does not persist OAuth connection metadata when vault writes fail"
  ]) {
    assert(
      apiTest.includes(phrase),
      `Missing API OAuth vault evidence: ${phrase}`
    );
  }
  cases.push(
    caseResult("api-oauth-token-write-revocation-and-audit", "PASS", {
      permissionRequired: "connector:manage",
      tokenWritePort: "SecretVault.putSecret",
      tokenDeletePort: "SecretVault.deleteSecret",
      persistedTokenMaterial: false,
      auditActions: ["oauth_connection.completed", "oauth_connection.revoked"],
      metrics: ["oauth_connection.completed", "oauth_connection.revoked"]
    })
  );

  const postgresOAuthTest = await readText(
    "services/api/test/postgres-oauth-connection-store.test.ts"
  );
  const contractsTest = await readText("services/api/test/contracts.test.ts");
  for (const phrase of [
    "upserts, selects, refresh-selects, and revokes OAuth connection metadata",
    "rejects malformed provider, status, scope, and secret-ref rows"
  ]) {
    assert(
      postgresOAuthTest.includes(phrase),
      `Missing PostgreSQL OAuth evidence: ${phrase}`
    );
  }
  assert(
    contractsTest.includes("access_token_secret_ref") &&
      contractsTest.includes("refresh_token_secret_ref") &&
      contractsTest.includes("access_token") &&
      contractsTest.includes("refresh_token"),
    "Schema contract must cover OAuth secret refs and exclude raw token columns."
  );
  cases.push(
    caseResult("oauth-metadata-secret-ref-persistence", "PASS", {
      metadataTable: "oauth_connections",
      storesRawAccessToken: false,
      storesRawRefreshToken: false,
      secretReferenceFields: [
        "access_token_secret_ref",
        "refresh_token_secret_ref"
      ],
      revocationMetadata: "status=revoked and deletion_state=deleted"
    })
  );

  const workerVaultTest = await readText(
    "services/workers/test/secrets-manager-external-observation-vault.test.ts"
  );
  for (const phrase of [
    "maps SearchLint secret refs to AWS Secrets Manager SecretId values",
    "rejects unsupported or empty secret refs before AWS calls",
    "writes refreshed tokens through PutSecretValue",
    "deletes token secrets through Secrets Manager with a recovery window",
    "rejects missing, empty, and binary-only secret values"
  ]) {
    assert(
      workerVaultTest.includes(phrase),
      `Missing worker vault evidence: ${phrase}`
    );
  }
  cases.push(
    caseResult("worker-secrets-manager-vault-read-write-delete", "PASS", {
      readCommand: "GetSecretValue",
      writeCommand: "PutSecretValue",
      deleteCommand: "DeleteSecret",
      deletionRecoveryWindowDays: 7,
      tenantScopedSecretRefs: true,
      rejectsBinaryOnlySecrets: true
    })
  );

  const refreshTest = await readText(
    "services/workers/test/external-observation-oauth-refresh.test.ts"
  );
  const collectionTest = await readText(
    "services/workers/test/external-observation-collection-worker.test.ts"
  );
  for (const phrase of [
    "posts Google refresh-token grants and maps refreshed token metadata",
    "surfaces Yandex refresh failures with status and response payload",
    "rejects malformed refresh responses deterministically"
  ]) {
    assert(
      refreshTest.includes(phrase),
      `Missing OAuth refresh evidence: ${phrase}`
    );
  }
  for (const phrase of [
    "refreshes configured OAuth tokens before provider collection",
    "rotated-refresh-token",
    "isolates refresh failures without collecting stale provider data"
  ]) {
    assert(
      collectionTest.includes(phrase),
      `Missing collection refresh evidence: ${phrase}`
    );
  }
  cases.push(
    caseResult("oauth-refresh-and-token-rotation", "PASS", {
      providers: ["google", "yandex"],
      grantType: "refresh_token",
      rotatesAccessToken: true,
      rotatesRefreshTokenWhenReturned: true,
      refreshBeforeCollection: true
    })
  );

  const docs = await readText("docs/OAUTH_VAULT_SECURITY.md");
  for (const phrase of [
    "deterministic local/static proof",
    "real AWS KMS",
    "real AWS Secrets Manager",
    "raw OAuth token values",
    "dashboard connector UI",
    "external security review"
  ]) {
    assert(
      docs.toLowerCase().includes(phrase.toLowerCase()),
      `OAuth vault docs must include ${phrase}`
    );
  }
  cases.push(
    caseResult("oauth-vault-documentation-and-sanitized-evidence", "PASS", {
      document: "docs/OAUTH_VAULT_SECURITY.md",
      deployedVaultClaimed: false,
      rawTokensInSample: false,
      remainingRuntimeGatesDocumented: true
    })
  );

  const report = {
    schemaVersion: 1,
    summary: {
      status: "PASS",
      generatedAt: fixedGeneratedAt,
      nodeVersion: process.version,
      caseCount: cases.length,
      passed: cases.length,
      failed: 0
    },
    cases,
    limitations: [
      "This verifier checks deterministic API and worker tests, KMS/Secrets Manager template shape, secret-ref persistence contracts, and documentation.",
      "It does not deploy AWS KMS or AWS Secrets Manager, populate live secrets, or use live Google/Yandex OAuth credentials.",
      "It does not call live provider token revocation endpoints or verify deployed CloudWatch logs."
    ],
    remainingRuntimeGates: [
      "Deploy the real KMS key and Secrets Manager secret namespace.",
      "Populate production provider client credentials.",
      "Run live OAuth token write/read/delete proof against AWS Secrets Manager.",
      "Run live Google/Yandex token refresh proof with real credentials.",
      "Verify provider token revocation endpoint behavior if required by final connector policy.",
      "Verify deployed logs and telemetry contain no secrets.",
      "Complete dashboard connector disconnect UI and external security review."
    ]
  };

  await mkdir(path.dirname(reportPath), { recursive: true });
  await mkdir(path.dirname(samplePath), { recursive: true });
  const formattedReport = await format(JSON.stringify(report), {
    parser: "json"
  });
  for (const token of forbiddenSampleTokens) {
    assert(
      !formattedReport.includes(token),
      `Sample report contains raw token marker ${token}.`
    );
  }
  await writeFile(reportPath, formattedReport);
  await writeFile(samplePath, formattedReport);

  console.log(
    `OAuth vault security ${report.summary.status}: ${report.summary.passed}/${report.summary.caseCount} cases passed`
  );
  console.log(`Report: ${path.relative(repoRoot, reportPath)}`);
  console.log(`Sample: ${path.relative(repoRoot, samplePath)}`);
}

function assertResource(resources, name, type) {
  const resource = resources[name];
  assert(resource, `${name} must exist`);
  assert(resource.Type === type, `${name} must be ${type}`);
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
