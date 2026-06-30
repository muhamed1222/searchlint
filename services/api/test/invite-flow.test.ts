import { describe, expect, it } from "vitest";

import {
  acceptOrganizationInvitation,
  createOrganizationInvitation,
  fingerprintInvitationToken,
  OrganizationInvitationError,
  revokeOrganizationInvitation
} from "../src/index.js";

describe("organization invite flow", () => {
  it("creates deterministic invitation, email, fingerprint, and audit evidence", () => {
    const result = createOrganizationInvitation({
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

    expect(result.invitation).toMatchObject({
      id: "invite-1",
      organizationId: "org-1",
      inviteeEmail: "developer@example.com",
      role: "developer",
      invitedByPrincipalId: "principal-owner",
      status: "pending",
      createdAt: "2026-06-22T00:00:00.000Z",
      expiresAt: "2026-06-29T00:00:00.000Z"
    });
    expect(result.invitation.tokenFingerprint).toBe(
      fingerprintInvitationToken("raw-token-1")
    );
    expect(result.invitation.tokenFingerprint).not.toContain("raw-token-1");
    expect(result.invitation.acceptanceUrl).toBe(
      "https://app.searchlint.example/invite/accept?invitationId=invite-1&token=raw-token-1"
    );
    expect(result.email.to).toBe("developer@example.com");
    expect(result.email.text).toContain(result.invitation.acceptanceUrl);
    expect(result.auditEvent).toMatchObject({
      organizationId: "org-1",
      actorPrincipalId: "principal-owner",
      action: "member.invited",
      targetType: "invitation",
      targetId: "invite-1"
    });
  });

  it("accepts pending invitations into membership and audit evidence", () => {
    const { invitation } = createInvitation();
    const result = acceptOrganizationInvitation({
      invitation,
      rawToken: "raw-token-1",
      acceptingPrincipalId: "principal-dev",
      expectedEmail: "developer@example.com",
      acceptedAt: "2026-06-22T01:00:00.000Z",
      membershipId: "membership-1"
    });

    expect(result.invitation).toMatchObject({
      status: "accepted",
      acceptedAt: "2026-06-22T01:00:00.000Z",
      acceptedByPrincipalId: "principal-dev"
    });
    expect(result.membership).toEqual({
      id: "membership-1",
      organizationId: "org-1",
      principalId: "principal-dev",
      role: "developer",
      createdAt: "2026-06-22T01:00:00.000Z"
    });
    expect(result.auditEvent).toMatchObject({
      action: "member.invitation_accepted",
      targetType: "principal",
      targetId: "principal-dev"
    });
  });

  it("rejects invalid, expired, and revoked invitation acceptance", () => {
    const { invitation } = createInvitation();

    expect(() =>
      acceptOrganizationInvitation({
        invitation,
        rawToken: "wrong-token",
        acceptingPrincipalId: "principal-dev",
        acceptedAt: "2026-06-22T01:00:00.000Z",
        membershipId: "membership-1"
      })
    ).toThrowError(
      new OrganizationInvitationError(
        "INVALID_INVITATION_TOKEN",
        "Organization invitation token is invalid."
      )
    );

    expect(() =>
      acceptOrganizationInvitation({
        invitation,
        rawToken: "raw-token-1",
        acceptingPrincipalId: "principal-dev",
        acceptedAt: "2026-06-29T00:00:00.000Z",
        membershipId: "membership-1"
      })
    ).toThrowError(
      new OrganizationInvitationError(
        "INVITATION_EXPIRED",
        "Organization invitation is expired."
      )
    );

    const revoked = revokeOrganizationInvitation({
      invitation,
      actorPrincipalId: "principal-owner",
      revokedAt: "2026-06-22T00:30:00.000Z"
    });
    expect(revoked.auditEvent.action).toBe("member.invitation_revoked");
    expect(() =>
      acceptOrganizationInvitation({
        invitation: revoked.invitation,
        rawToken: "raw-token-1",
        acceptingPrincipalId: "principal-dev",
        acceptedAt: "2026-06-22T01:00:00.000Z",
        membershipId: "membership-1"
      })
    ).toThrowError(
      new OrganizationInvitationError(
        "INVITATION_REVOKED",
        "Organization invitation is revoked."
      )
    );
  });

  it("rejects unsafe invitation creation inputs", () => {
    expect(() =>
      createOrganizationInvitation({
        id: "invite-1",
        organizationId: "org-1",
        inviteeEmail: "not-email",
        role: "developer",
        invitedByPrincipalId: "principal-owner",
        rawToken: "raw-token-1",
        appBaseUrl: "https://app.searchlint.example",
        createdAt: "2026-06-22T00:00:00.000Z",
        ttlSeconds: 604800
      })
    ).toThrowError(/valid email/);
    expect(() =>
      createOrganizationInvitation({
        id: "invite-1",
        organizationId: "org-1",
        inviteeEmail: "owner@example.com",
        role: "owner" as "developer",
        invitedByPrincipalId: "principal-owner",
        rawToken: "raw-token-1",
        appBaseUrl: "https://app.searchlint.example",
        createdAt: "2026-06-22T00:00:00.000Z",
        ttlSeconds: 604800
      })
    ).toThrowError(/role must be/);
    expect(() =>
      createOrganizationInvitation({
        id: "invite-1",
        organizationId: "org-1",
        inviteeEmail: "developer@example.com",
        role: "developer",
        invitedByPrincipalId: "principal-owner",
        rawToken: "raw-token-1",
        appBaseUrl: "http://app.searchlint.example",
        createdAt: "2026-06-22T00:00:00.000Z",
        ttlSeconds: 604800
      })
    ).toThrowError(/absolute HTTPS URL/);
  });
});

function createInvitation() {
  return createOrganizationInvitation({
    id: "invite-1",
    organizationId: "org-1",
    inviteeEmail: "developer@example.com",
    role: "developer",
    invitedByPrincipalId: "principal-owner",
    rawToken: "raw-token-1",
    appBaseUrl: "https://app.searchlint.example",
    createdAt: "2026-06-22T00:00:00.000Z",
    ttlSeconds: 604800
  });
}
