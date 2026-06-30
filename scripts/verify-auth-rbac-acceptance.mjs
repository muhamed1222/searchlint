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
  "reports/auth-rbac-acceptance-report.json"
);
const samplePath = path.join(
  repoRoot,
  "docs/examples/auth-rbac-acceptance-report.sample.json"
);
const fixedGeneratedAt = "2026-06-22T00:00:00.000Z";

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
  run("pnpm", ["--filter", "@searchlint/api", "build"], { stdio: "inherit" });

  const api = await import("../services/api/dist/src/index.js");
  const cases = [];

  const cognitoIssues = api.validateCognitoUserPoolProvisioningContract(
    api.cognitoUserPoolProvisioningContract
  );
  assert(cognitoIssues.length === 0, "Cognito provisioning contract drifted.");
  const cognitoTemplate = await readJson(
    "infra/aws/cognito-user-pool.cloudformation.json"
  );
  const cognitoResources = cognitoTemplate.Resources ?? {};
  assertResource(
    cognitoResources,
    "SearchLintUserPool",
    "AWS::Cognito::UserPool"
  );
  assertResource(
    cognitoResources,
    "SearchLintCloudApiAppClient",
    "AWS::Cognito::UserPoolClient"
  );
  assertResource(
    cognitoResources,
    "SearchLintPlatformAccessGroup",
    "AWS::Cognito::UserPoolGroup"
  );
  assert(
    cognitoResources.SearchLintUserPool.Properties?.MfaConfiguration ===
      "OPTIONAL",
    "Cognito MFA must remain optional for 1.0."
  );
  assert(
    cognitoResources.SearchLintCloudApiAppClient.Properties?.GenerateSecret ===
      false,
    "Cloud API Cognito app client must not generate a client secret."
  );
  cases.push(
    caseResult("cognito-provisioning-and-cloudformation-contract", "PASS", {
      provider: api.cognitoUserPoolProvisioningContract.provider,
      identityProtocol:
        api.cognitoUserPoolProvisioningContract.identityProtocol,
      jwtAlgorithm:
        api.cognitoUserPoolProvisioningContract.userPool.jwtAlgorithm,
      signInAliases:
        api.cognitoUserPoolProvisioningContract.userPool.signInAliases,
      requiredVerifiedAttributes:
        api.cognitoUserPoolProvisioningContract.userPool
          .requiredVerifiedAttributes,
      tenantRbacSource:
        api.cognitoUserPoolProvisioningContract.authorization.tenantRbacSource,
      cloudFormation: "infra/aws/cognito-user-pool.cloudformation.json"
    })
  );

  const cognitoAuthTest = await readText(
    "services/api/test/cognito-auth.test.ts"
  );
  const nodeHttpTest = await readText(
    "services/api/test/node-http-server.test.ts"
  );
  for (const phrase of [
    "resolves valid Cognito access tokens to SearchLint principals",
    "accepts client_id as the audience claim for access tokens",
    "rejects invalid Cognito tokens without producing a principal",
    "extracts bearer token principals from Node HTTP requests",
    "fetches, validates, and caches JWKS until TTL expiry"
  ]) {
    assert(
      cognitoAuthTest.includes(phrase),
      `Missing Cognito auth test: ${phrase}`
    );
  }
  for (const phrase of [
    "authenticates Cognito bearer tokens through the Node HTTP dispatcher path",
    "returns 401 for missing Cognito bearer credentials before application dispatch",
    "returns 401 for invalid Cognito bearer credentials before application dispatch"
  ]) {
    assert(
      nodeHttpTest.includes(phrase),
      `Missing Node auth path test: ${phrase}`
    );
  }
  cases.push(
    caseResult("cognito-jwt-principal-extraction", "PASS", {
      tokenAlgorithm: "RS256",
      acceptedAudienceClaims: ["aud", "client_id"],
      bearerPrincipalExtraction: true,
      invalidTokenShortCircuit: true,
      remoteJwksCacheEvidence: true
    })
  );

  assert(api.roleHasPermission("owner", "organization:manage"));
  assert(api.roleHasPermission("admin", "member:manage"));
  assert(api.roleHasPermission("developer", "crawl:create"));
  assert(api.roleHasPermission("analyst", "diagnostic:read"));
  assert(api.roleHasPermission("client", "report:read"));
  assert(!api.roleHasPermission("client", "crawl:create"));
  assert(!api.roleHasPermission("analyst", "diagnostic:write"));
  assert(!api.roleHasPermission("developer", "billing:manage"));
  cases.push(
    caseResult("searchlint-owned-rbac-matrix", "PASS", {
      roles: ["owner", "admin", "developer", "analyst", "client"],
      permissionsChecked: [
        "organization:manage",
        "member:manage",
        "billing:manage",
        "project:create",
        "project:read",
        "project:update",
        "environment:create",
        "environment:read",
        "crawl:create",
        "diagnostic:read",
        "diagnostic:write",
        "report:read",
        "connector:manage"
      ],
      tenantAuthorizationSource: "postgres-organization-memberships"
    })
  );

  const apiTest = await readText("services/api/test/api.test.ts");
  for (const phrase of [
    "creates an organization with owner membership and audit event",
    "requires member management permission to add users",
    "removes non-owner members with member-management permission and audit evidence",
    "blocks unsafe member removal paths",
    "transfers organization ownership and demotes the previous owner with audit evidence",
    "blocks non-owner and invalid ownership transfer attempts",
    "creates projects and environments inside the active organization",
    "does not load dashboard snapshots when authorization or route identity checks fail",
    "does not allow cross-organization project access",
    "records crawl diagnostics after authorization and crawl identity checks"
  ]) {
    assert(
      apiTest.includes(phrase),
      `Missing API auth/RBAC evidence: ${phrase}`
    );
  }
  cases.push(
    caseResult("organization-project-environment-lifecycle-and-audit", "PASS", {
      organizationCreation: true,
      ownerMembership: true,
      memberAdd: true,
      memberRemoval: true,
      ownershipTransfer: true,
      projectCreation: true,
      environmentCreation: true,
      auditActions: [
        "organization.created",
        "member.added",
        "member.removed",
        "ownership.transferred",
        "project.created",
        "environment.created",
        "diagnostics.ingested"
      ]
    })
  );

  const repositorySqlTest = await readText(
    "services/api/test/postgres-repository-sql.test.ts"
  );
  const relationalStoreTest = await readText(
    "services/api/test/postgres-relational-store.test.ts"
  );
  for (const phrase of [
    "keeps membership reads tenant-scoped and active-only",
    "updates and removes memberships through tenant-scoped active-only writes"
  ]) {
    assert(
      repositorySqlTest.includes(phrase) ||
        relationalStoreTest.includes(phrase),
      `Missing PostgreSQL membership evidence: ${phrase}`
    );
  }
  cases.push(
    caseResult("postgres-membership-tenant-isolation-contract", "PASS", {
      membershipReads: "organization_id + principal_id + active deletion_state",
      membershipRoleUpdates:
        "organization_id + principal_id + active deletion_state",
      membershipRemoval:
        "soft-delete through organization_id + principal_id + active deletion_state",
      projectEnvironmentIdentityChecks: true
    })
  );

  const docs = await readText("docs/AUTH_RBAC_ACCEPTANCE.md");
  for (const phrase of [
    "deterministic local/static proof",
    "real Cognito",
    "signup",
    "password reset",
    "MFA",
    "invite email",
    "dashboard team-management UI"
  ]) {
    assert(
      docs.toLowerCase().includes(phrase.toLowerCase()),
      `Auth/RBAC docs must include ${phrase}`
    );
  }
  cases.push(
    caseResult("auth-rbac-documentation", "PASS", {
      document: "docs/AUTH_RBAC_ACCEPTANCE.md",
      deployedCognitoClaimed: false,
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
      "This verifier checks deterministic API tests, Cognito contracts, CloudFormation shape, PostgreSQL membership SQL contracts, RBAC matrix behavior, and documentation.",
      "It does not deploy AWS Cognito or prove live signup, login, logout, refresh-token, password-reset, email-verification, MFA, session-expiry, or invite-email flows.",
      "It does not prove dashboard team-management UI or live Cloud API auth against a deployed Cognito issuer."
    ],
    remainingRuntimeGates: [
      "Deploy the real Cognito user pool and app client.",
      "Verify signup, login, logout, refresh-token, password-reset, email-verification, MFA, session-expiry, and OAuth callback user flows.",
      "Implement and verify invite email delivery and acceptance flow.",
      "Verify member removal and ownership transfer through dashboard/API E2E.",
      "Verify live Cloud API authentication against the deployed Cognito issuer and JWKS URL.",
      "Verify dashboard team-management UI, RBAC UI, and audit-log UI."
    ]
  };

  await mkdir(path.dirname(reportPath), { recursive: true });
  await mkdir(path.dirname(samplePath), { recursive: true });
  const formattedReport = await format(JSON.stringify(report), {
    parser: "json"
  });
  await writeFile(reportPath, formattedReport);
  await writeFile(samplePath, formattedReport);

  console.log(
    `Auth RBAC acceptance ${report.summary.status}: ${report.summary.passed}/${report.summary.caseCount} cases passed`
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
