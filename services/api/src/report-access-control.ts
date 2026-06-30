import { roleHasPermission } from "./rbac.js";
import type { OrganizationMembership, Principal } from "./types.js";

export type ReportArtifactAccessMetadata = {
  id: string;
  organizationId: string;
  projectId: string;
  environmentId: string;
  deletionState: "active" | "deleting" | "deleted";
  expiresAt?: string;
};

export type ReportArtifactAccessRequest = {
  actor: Principal;
  membership?: OrganizationMembership;
  organizationId: string;
  projectId: string;
  environmentId: string;
  artifact: ReportArtifactAccessMetadata;
  now: string;
};

export type ReportArtifactAccessDecision =
  | {
      allowed: true;
      principalId: string;
      artifactId: string;
      organizationId: string;
      projectId: string;
      environmentId: string;
      permission: "report:read";
      reason: "authorized";
    }
  | {
      allowed: false;
      principalId: string;
      artifactId: string;
      reason:
        | "missing-membership"
        | "membership-scope-mismatch"
        | "permission-denied"
        | "artifact-organization-mismatch"
        | "artifact-project-mismatch"
        | "artifact-environment-mismatch"
        | "artifact-not-active"
        | "artifact-expired";
    };

export function authorizeReportArtifactAccess(
  input: ReportArtifactAccessRequest
): ReportArtifactAccessDecision {
  const baseDeny = {
    allowed: false,
    principalId: input.actor.id,
    artifactId: input.artifact.id
  } as const;

  if (input.membership === undefined) {
    return {
      ...baseDeny,
      reason: "missing-membership"
    };
  }

  if (
    input.membership.organizationId !== input.organizationId ||
    input.membership.principalId !== input.actor.id
  ) {
    return {
      ...baseDeny,
      reason: "membership-scope-mismatch"
    };
  }

  if (!roleHasPermission(input.membership.role, "report:read")) {
    return {
      ...baseDeny,
      reason: "permission-denied"
    };
  }

  if (input.artifact.organizationId !== input.organizationId) {
    return {
      ...baseDeny,
      reason: "artifact-organization-mismatch"
    };
  }

  if (input.artifact.projectId !== input.projectId) {
    return {
      ...baseDeny,
      reason: "artifact-project-mismatch"
    };
  }

  if (input.artifact.environmentId !== input.environmentId) {
    return {
      ...baseDeny,
      reason: "artifact-environment-mismatch"
    };
  }

  if (input.artifact.deletionState !== "active") {
    return {
      ...baseDeny,
      reason: "artifact-not-active"
    };
  }

  if (
    input.artifact.expiresAt !== undefined &&
    Date.parse(input.artifact.expiresAt) <= Date.parse(input.now)
  ) {
    return {
      ...baseDeny,
      reason: "artifact-expired"
    };
  }

  return {
    allowed: true,
    principalId: input.actor.id,
    artifactId: input.artifact.id,
    organizationId: input.organizationId,
    projectId: input.projectId,
    environmentId: input.environmentId,
    permission: "report:read",
    reason: "authorized"
  };
}
