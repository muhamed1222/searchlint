import { describe, expect, it } from "vitest";

import { authorizeReportArtifactAccess } from "../src/index.js";
import type {
  OrganizationMembership,
  Principal,
  ReportArtifactAccessMetadata
} from "../src/index.js";

describe("authorizeReportArtifactAccess", () => {
  it("allows active unexpired report artifacts for report readers in the same scope", () => {
    expect(authorizeReportArtifactAccess(accessRequest())).toEqual({
      allowed: true,
      principalId: "principal-1",
      artifactId: "report-1",
      organizationId: "org-1",
      projectId: "project-1",
      environmentId: "env-1",
      permission: "report:read",
      reason: "authorized"
    });
  });

  it("denies missing or mismatched membership before artifact access", () => {
    expect(
      authorizeReportArtifactAccess(accessRequestWithoutMembership())
    ).toMatchObject({
      allowed: false,
      reason: "missing-membership"
    });
    expect(
      authorizeReportArtifactAccess({
        ...accessRequest(),
        membership: membership({ organizationId: "org-2" })
      })
    ).toMatchObject({
      allowed: false,
      reason: "membership-scope-mismatch"
    });
  });

  it("denies cross-scope, inactive, and expired artifacts", () => {
    for (const testCase of [
      {
        artifact: artifact({ organizationId: "org-2" }),
        reason: "artifact-organization-mismatch"
      },
      {
        artifact: artifact({ projectId: "project-2" }),
        reason: "artifact-project-mismatch"
      },
      {
        artifact: artifact({ environmentId: "env-2" }),
        reason: "artifact-environment-mismatch"
      },
      {
        artifact: artifact({ deletionState: "deleted" }),
        reason: "artifact-not-active"
      },
      {
        artifact: artifact({ expiresAt: "2026-06-23T09:59:59.000Z" }),
        reason: "artifact-expired"
      }
    ] as const) {
      expect(
        authorizeReportArtifactAccess({
          ...accessRequest(),
          artifact: testCase.artifact
        })
      ).toMatchObject({
        allowed: false,
        reason: testCase.reason
      });
    }
  });
});

function accessRequest() {
  return {
    actor: principal(),
    membership: membership(),
    organizationId: "org-1",
    projectId: "project-1",
    environmentId: "env-1",
    artifact: artifact(),
    now: "2026-06-23T10:00:00.000Z"
  };
}

function accessRequestWithoutMembership() {
  return {
    actor: principal(),
    organizationId: "org-1",
    projectId: "project-1",
    environmentId: "env-1",
    artifact: artifact(),
    now: "2026-06-23T10:00:00.000Z"
  };
}

function principal(): Principal {
  return {
    id: "principal-1",
    externalSubject: "cognito|principal-1"
  };
}

function membership(
  overrides: Partial<OrganizationMembership> = {}
): OrganizationMembership {
  return {
    id: "membership-1",
    organizationId: "org-1",
    principalId: "principal-1",
    role: "client",
    createdAt: "2026-06-23T00:00:00.000Z",
    ...overrides
  };
}

function artifact(
  overrides: Partial<ReportArtifactAccessMetadata> = {}
): ReportArtifactAccessMetadata {
  return {
    id: "report-1",
    organizationId: "org-1",
    projectId: "project-1",
    environmentId: "env-1",
    deletionState: "active",
    expiresAt: "2026-06-23T11:00:00.000Z",
    ...overrides
  };
}
