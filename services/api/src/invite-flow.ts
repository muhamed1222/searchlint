import { createHash } from "node:crypto";

import type { OrganizationMembership, OrganizationRole } from "./types.js";

export type OrganizationInvitationRole = Exclude<OrganizationRole, "owner">;

export type OrganizationInvitationStatus =
  | "pending"
  | "accepted"
  | "expired"
  | "revoked";

export type OrganizationInvitation = {
  id: string;
  organizationId: string;
  inviteeEmail: string;
  role: OrganizationInvitationRole;
  invitedByPrincipalId: string;
  tokenFingerprint: string;
  acceptanceUrl: string;
  status: OrganizationInvitationStatus;
  createdAt: string;
  expiresAt: string;
  acceptedAt?: string;
  acceptedByPrincipalId?: string;
  revokedAt?: string;
};

export type OrganizationInvitationEmail = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

export type OrganizationInvitationAuditEvent = {
  organizationId: string;
  actorPrincipalId: string;
  action:
    | "member.invited"
    | "member.invitation_accepted"
    | "member.invitation_revoked";
  targetType: "invitation" | "principal";
  targetId: string;
  occurredAt: string;
};

export type CreateOrganizationInvitationInput = {
  id: string;
  organizationId: string;
  inviteeEmail: string;
  role: OrganizationInvitationRole;
  invitedByPrincipalId: string;
  rawToken: string;
  appBaseUrl: string;
  createdAt: string;
  ttlSeconds: number;
};

export type CreateOrganizationInvitationResult = {
  invitation: OrganizationInvitation;
  email: OrganizationInvitationEmail;
  auditEvent: OrganizationInvitationAuditEvent;
};

export type AcceptOrganizationInvitationInput = {
  invitation: OrganizationInvitation;
  rawToken: string;
  acceptingPrincipalId: string;
  acceptedAt: string;
  membershipId: string;
  expectedEmail?: string;
};

export type AcceptOrganizationInvitationResult = {
  invitation: OrganizationInvitation;
  membership: OrganizationMembership;
  auditEvent: OrganizationInvitationAuditEvent;
};

export type RevokeOrganizationInvitationInput = {
  invitation: OrganizationInvitation;
  actorPrincipalId: string;
  revokedAt: string;
};

export type RevokeOrganizationInvitationResult = {
  invitation: OrganizationInvitation;
  auditEvent: OrganizationInvitationAuditEvent;
};

export class OrganizationInvitationError extends Error {
  constructor(
    readonly code:
      | "INVALID_INVITATION"
      | "INVALID_INVITATION_TOKEN"
      | "INVITATION_EXPIRED"
      | "INVITATION_REVOKED"
      | "INVITATION_ALREADY_ACCEPTED",
    message: string
  ) {
    super(message);
    this.name = "OrganizationInvitationError";
  }
}

export function createOrganizationInvitation(
  input: CreateOrganizationInvitationInput
): CreateOrganizationInvitationResult {
  const inviteeEmail = normalizeInviteeEmail(input.inviteeEmail);
  const tokenFingerprint = fingerprintInvitationToken(input.rawToken);
  const createdAtMs = Date.parse(input.createdAt);
  if (!Number.isFinite(createdAtMs)) {
    throw new OrganizationInvitationError(
      "INVALID_INVITATION",
      "Invitation createdAt must be an ISO timestamp."
    );
  }
  if (!Number.isInteger(input.ttlSeconds) || input.ttlSeconds < 300) {
    throw new OrganizationInvitationError(
      "INVALID_INVITATION",
      "Invitation ttlSeconds must be at least 300 seconds."
    );
  }

  const expiresAt = new Date(
    createdAtMs + input.ttlSeconds * 1000
  ).toISOString();
  const acceptanceUrl = invitationAcceptanceUrl({
    appBaseUrl: input.appBaseUrl,
    invitationId: requiredText(input.id, "id"),
    token: requiredText(input.rawToken, "rawToken")
  });
  const invitation: OrganizationInvitation = {
    id: input.id,
    organizationId: requiredText(input.organizationId, "organizationId"),
    inviteeEmail,
    role: requiredInvitationRole(input.role),
    invitedByPrincipalId: requiredText(
      input.invitedByPrincipalId,
      "invitedByPrincipalId"
    ),
    tokenFingerprint,
    acceptanceUrl,
    status: "pending",
    createdAt: input.createdAt,
    expiresAt
  };

  return {
    invitation,
    email: organizationInvitationEmail(invitation),
    auditEvent: {
      organizationId: invitation.organizationId,
      actorPrincipalId: invitation.invitedByPrincipalId,
      action: "member.invited",
      targetType: "invitation",
      targetId: invitation.id,
      occurredAt: invitation.createdAt
    }
  };
}

export function acceptOrganizationInvitation(
  input: AcceptOrganizationInvitationInput
): AcceptOrganizationInvitationResult {
  const invitation = validateAcceptableInvitation(input);
  const acceptedAtMs = Date.parse(input.acceptedAt);
  if (!Number.isFinite(acceptedAtMs)) {
    throw new OrganizationInvitationError(
      "INVALID_INVITATION",
      "Invitation acceptedAt must be an ISO timestamp."
    );
  }
  if (Date.parse(invitation.expiresAt) <= acceptedAtMs) {
    throw new OrganizationInvitationError(
      "INVITATION_EXPIRED",
      "Organization invitation is expired."
    );
  }
  if (input.expectedEmail !== undefined) {
    const expectedEmail = normalizeInviteeEmail(input.expectedEmail);
    if (expectedEmail !== invitation.inviteeEmail) {
      throw new OrganizationInvitationError(
        "INVALID_INVITATION",
        "Invitation email does not match the accepting principal."
      );
    }
  }
  if (
    invitation.tokenFingerprint !== fingerprintInvitationToken(input.rawToken)
  ) {
    throw new OrganizationInvitationError(
      "INVALID_INVITATION_TOKEN",
      "Organization invitation token is invalid."
    );
  }

  const acceptingPrincipalId = requiredText(
    input.acceptingPrincipalId,
    "acceptingPrincipalId"
  );
  const acceptedInvitation: OrganizationInvitation = {
    ...invitation,
    status: "accepted",
    acceptedAt: input.acceptedAt,
    acceptedByPrincipalId: acceptingPrincipalId
  };
  const membership: OrganizationMembership = {
    id: requiredText(input.membershipId, "membershipId"),
    organizationId: invitation.organizationId,
    principalId: acceptingPrincipalId,
    role: invitation.role,
    createdAt: input.acceptedAt
  };

  return {
    invitation: acceptedInvitation,
    membership,
    auditEvent: {
      organizationId: invitation.organizationId,
      actorPrincipalId: acceptingPrincipalId,
      action: "member.invitation_accepted",
      targetType: "principal",
      targetId: acceptingPrincipalId,
      occurredAt: input.acceptedAt
    }
  };
}

export function revokeOrganizationInvitation(
  input: RevokeOrganizationInvitationInput
): RevokeOrganizationInvitationResult {
  if (input.invitation.status === "accepted") {
    throw new OrganizationInvitationError(
      "INVITATION_ALREADY_ACCEPTED",
      "Accepted organization invitations cannot be revoked."
    );
  }
  const invitation: OrganizationInvitation = {
    ...input.invitation,
    status: "revoked",
    revokedAt: input.revokedAt
  };
  return {
    invitation,
    auditEvent: {
      organizationId: invitation.organizationId,
      actorPrincipalId: requiredText(
        input.actorPrincipalId,
        "actorPrincipalId"
      ),
      action: "member.invitation_revoked",
      targetType: "invitation",
      targetId: invitation.id,
      occurredAt: input.revokedAt
    }
  };
}

export function fingerprintInvitationToken(rawToken: string): string {
  return createHash("sha256")
    .update(requiredText(rawToken, "rawToken"), "utf8")
    .digest("hex");
}

function validateAcceptableInvitation(
  input: AcceptOrganizationInvitationInput
): OrganizationInvitation {
  if (input.invitation.status === "accepted") {
    throw new OrganizationInvitationError(
      "INVITATION_ALREADY_ACCEPTED",
      "Organization invitation has already been accepted."
    );
  }
  if (input.invitation.status === "revoked") {
    throw new OrganizationInvitationError(
      "INVITATION_REVOKED",
      "Organization invitation is revoked."
    );
  }
  if (input.invitation.status === "expired") {
    throw new OrganizationInvitationError(
      "INVITATION_EXPIRED",
      "Organization invitation is expired."
    );
  }
  return input.invitation;
}

function organizationInvitationEmail(
  invitation: OrganizationInvitation
): OrganizationInvitationEmail {
  const subject = "You have been invited to SearchLint";
  const text = [
    "You have been invited to join a SearchLint organization.",
    `Role: ${invitation.role}`,
    `Accept: ${invitation.acceptanceUrl}`,
    `This invitation expires at ${invitation.expiresAt}.`
  ].join("\n");
  return {
    to: invitation.inviteeEmail,
    subject,
    text,
    html: `<p>You have been invited to join a SearchLint organization.</p><p>Role: ${escapeHtml(invitation.role)}</p><p><a href="${escapeHtml(invitation.acceptanceUrl)}">Accept invitation</a></p><p>This invitation expires at ${escapeHtml(invitation.expiresAt)}.</p>`
  };
}

function invitationAcceptanceUrl(input: {
  appBaseUrl: string;
  invitationId: string;
  token: string;
}): string {
  const url = new URL("/invite/accept", requiredAbsoluteUrl(input.appBaseUrl));
  url.searchParams.set("invitationId", input.invitationId);
  url.searchParams.set("token", input.token);
  return url.toString();
}

function normalizeInviteeEmail(value: string): string {
  const email = requiredText(value, "inviteeEmail").toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new OrganizationInvitationError(
      "INVALID_INVITATION",
      "Invitation inviteeEmail must be a valid email address."
    );
  }
  return email;
}

function requiredInvitationRole(
  role: OrganizationInvitationRole
): OrganizationInvitationRole {
  if (
    role === "admin" ||
    role === "developer" ||
    role === "analyst" ||
    role === "client"
  ) {
    return role;
  }
  throw new OrganizationInvitationError(
    "INVALID_INVITATION",
    "Invitation role must be admin, developer, analyst, or client."
  );
}

function requiredText(value: string, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new OrganizationInvitationError(
      "INVALID_INVITATION",
      `Invitation ${field} is required.`
    );
  }
  return value.trim();
}

function requiredAbsoluteUrl(value: string): string {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") {
      throw new Error("not https");
    }
    return url.toString();
  } catch {
    throw new OrganizationInvitationError(
      "INVALID_INVITATION",
      "Invitation appBaseUrl must be an absolute HTTPS URL."
    );
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return char;
    }
  });
}
