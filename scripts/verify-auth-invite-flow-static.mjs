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
  "reports/auth-invite-flow-static-report.json"
);
const samplePath = path.join(
  repoRoot,
  "docs/examples/auth-invite-flow-static-report.sample.json"
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
    "invite-flow.test.ts"
  ]);
  run("pnpm", ["--filter", "@searchlint/api", "build"]);

  const api = await import("../services/api/dist/src/index.js");
  const created = api.createOrganizationInvitation({
    id: "invite-1",
    organizationId: "org-1",
    inviteeEmail: "Developer@Example.COM",
    role: "developer",
    invitedByPrincipalId: "principal-owner",
    rawToken: "raw-token-1",
    appBaseUrl: "https://app.searchlint.example",
    createdAt: "2026-06-22T00:00:00.000Z",
    ttlSeconds: 604800
  });
  assert(
    created.invitation.inviteeEmail === "developer@example.com",
    "Invitee email must be normalized."
  );
  assert(
    created.invitation.expiresAt === "2026-06-29T00:00:00.000Z",
    "Invitation expiry drifted."
  );
  assert(
    created.invitation.tokenFingerprint ===
      api.fingerprintInvitationToken("raw-token-1"),
    "Invitation token fingerprint drifted."
  );
  assert(
    !created.invitation.tokenFingerprint.includes("raw-token-1"),
    "Invitation record must not store raw tokens."
  );
  assert(
    created.email.text.includes(created.invitation.acceptanceUrl),
    "Invitation email must contain the acceptance URL."
  );
  assert(
    created.auditEvent.action === "member.invited",
    "Invitation creation audit action drifted."
  );

  const accepted = api.acceptOrganizationInvitation({
    invitation: created.invitation,
    rawToken: "raw-token-1",
    acceptingPrincipalId: "principal-dev",
    expectedEmail: "developer@example.com",
    acceptedAt: "2026-06-22T01:00:00.000Z",
    membershipId: "membership-1"
  });
  assert(
    accepted.membership.role === "developer" &&
      accepted.membership.principalId === "principal-dev",
    "Invitation acceptance must produce the expected membership."
  );
  assert(
    accepted.auditEvent.action === "member.invitation_accepted",
    "Invitation acceptance audit action drifted."
  );

  const wrongTokenError = captureError(() =>
    api.acceptOrganizationInvitation({
      invitation: created.invitation,
      rawToken: "wrong-token",
      acceptingPrincipalId: "principal-dev",
      acceptedAt: "2026-06-22T01:00:00.000Z",
      membershipId: "membership-1"
    })
  );
  assert(
    wrongTokenError.code === "INVALID_INVITATION_TOKEN",
    "Wrong invitation token must be rejected."
  );
  const expiredError = captureError(() =>
    api.acceptOrganizationInvitation({
      invitation: created.invitation,
      rawToken: "raw-token-1",
      acceptingPrincipalId: "principal-dev",
      acceptedAt: "2026-06-29T00:00:00.000Z",
      membershipId: "membership-1"
    })
  );
  assert(
    expiredError.code === "INVITATION_EXPIRED",
    "Expired invitations must be rejected."
  );
  const revoked = api.revokeOrganizationInvitation({
    invitation: created.invitation,
    actorPrincipalId: "principal-owner",
    revokedAt: "2026-06-22T00:30:00.000Z"
  });
  const revokedError = captureError(() =>
    api.acceptOrganizationInvitation({
      invitation: revoked.invitation,
      rawToken: "raw-token-1",
      acceptingPrincipalId: "principal-dev",
      acceptedAt: "2026-06-22T01:00:00.000Z",
      membershipId: "membership-1"
    })
  );
  assert(
    revokedError.code === "INVITATION_REVOKED",
    "Revoked invitations must be rejected."
  );
  assert(
    revoked.auditEvent.action === "member.invitation_revoked",
    "Invitation revocation audit action drifted."
  );

  const invalidEmailError = captureError(() =>
    api.createOrganizationInvitation({
      id: "invite-2",
      organizationId: "org-1",
      inviteeEmail: "not-email",
      role: "developer",
      invitedByPrincipalId: "principal-owner",
      rawToken: "raw-token-2",
      appBaseUrl: "https://app.searchlint.example",
      createdAt: "2026-06-22T00:00:00.000Z",
      ttlSeconds: 604800
    })
  );
  assert(
    invalidEmailError.code === "INVALID_INVITATION",
    "Invalid invitee email must be rejected."
  );

  const report = {
    schemaVersion: 1,
    generatedBy: "searchlint-auth-invite-flow-static-verifier",
    generatedAt,
    status: "static-invite-flow-passed-live-release-blocked",
    scope: {
      proofType: "deterministic static organization invite-flow contract",
      liveEmailDelivery: "not used by verifier",
      liveAwsAccess: "not used by verifier",
      doesNotClaim: [
        "live invite email delivery",
        "deployed API invitation persistence",
        "deployed dashboard invite acceptance",
        "Cognito user creation from invitations",
        "email bounce/failure handling"
      ]
    },
    commands: [
      {
        command: "pnpm --filter @searchlint/api test -- invite-flow.test.ts",
        status: "passed"
      },
      {
        command: "pnpm --filter @searchlint/api build",
        status: "passed"
      }
    ],
    invitation: {
      id: created.invitation.id,
      organizationId: created.invitation.organizationId,
      inviteeEmail: created.invitation.inviteeEmail,
      role: created.invitation.role,
      status: created.invitation.status,
      createdAt: created.invitation.createdAt,
      expiresAt: created.invitation.expiresAt,
      tokenFingerprint: created.invitation.tokenFingerprint,
      rawTokenStored: false,
      acceptanceUrlShape:
        "https://app.searchlint.example/invite/accept?invitationId=<id>&token=<token>"
    },
    email: {
      to: created.email.to,
      subject: created.email.subject,
      containsAcceptanceUrl: created.email.text.includes(
        created.invitation.acceptanceUrl
      )
    },
    acceptance: {
      membership: accepted.membership,
      auditAction: accepted.auditEvent.action
    },
    negativeCases: {
      wrongToken: wrongTokenError.code,
      expired: expiredError.code,
      revoked: revokedError.code,
      invalidEmail: invalidEmailError.code
    },
    remainingReleaseGates: [
      "persist invitations and acceptance through deployed API routes",
      "deliver real invite emails",
      "prove invite email delivery and bounce/failure behavior",
      "prove invite acceptance in deployed dashboard/Cognito/API flows"
    ]
  };

  await writeJson(reportPath, report);
  await writeJson(samplePath, report);
  console.log(
    "Auth invite-flow static acceptance PASS: invitation contract verified"
  );
  console.log(`Report: ${path.relative(repoRoot, reportPath)}`);
  console.log(`Sample: ${path.relative(repoRoot, samplePath)}`);
}

function captureError(fn) {
  try {
    fn();
  } catch (error) {
    return error;
  }
  throw new Error("Expected operation to fail.");
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
      : "Unknown auth invite-flow static verification error"
  );
  process.exitCode = 1;
});
