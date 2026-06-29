import { describe, expect, it } from "vitest";

import {
  agencyProductionPersistenceAcceptancePacket,
  agencyClientAccessDecision,
  createAgencyBrandAssetUploadGrant,
  createAgencyBillingSummary,
  createAgencyBulkMonitoringPlan,
  createAgencyHostedWhiteLabelReportLinkGrant,
  createAgencyOnboardingChecklist,
  createAgencyPortfolioSummary,
  evaluateAgencySla,
  summarizeAgencyAssignees,
  verifyAgencyCustomDomain,
  whiteLabelReportOptions
} from "../src/index.js";
import type {
  AgencyClientProject,
  AgencyClientWorkspace,
  AgencySharedRulePolicy,
  AgencyWhiteLabelBrand,
  OrganizationMembership,
  Principal,
  ReportArtifact
} from "../src/index.js";

describe("agency mode", () => {
  it("summarizes a multi-client portfolio deterministically", () => {
    expect(
      createAgencyPortfolioSummary({
        workspaces: workspaces(),
        projects: projects(),
        now: "2026-06-22T12:00:00.000Z"
      })
    ).toEqual({
      clientCount: 3,
      activeClientCount: 2,
      projectCount: 3,
      openDiagnostics: 42,
      blockerDiagnostics: 5,
      averageHealthScore: 81.67,
      overdueSlaCount: 1
    });
  });

  it("enforces client access as read-only shared project/report access", () => {
    expect(agencyClientAccessDecision("client")).toEqual({
      role: "client",
      canReadProject: true,
      canReadReports: true,
      canMutateProject: false,
      canManageBilling: false,
      evidence:
        "Client role can read shared project/report views and cannot mutate projects or billing."
    });
    expect(agencyClientAccessDecision("owner")).toMatchObject({
      canMutateProject: true,
      canManageBilling: true
    });
  });

  it("creates bulk monitoring, SLA, and assignee evidence", () => {
    expect(
      createAgencyBulkMonitoringPlan({
        projects: projects(),
        maxConcurrency: 4,
        urlsPerProject: 500
      })
    ).toEqual({
      projectIds: ["project-a", "project-b", "project-c"],
      maxConcurrency: 4,
      estimatedUrlBudget: 1500,
      evidence: "Bulk monitoring covers 3 project(s) with concurrency 4."
    });
    expect(
      evaluateAgencySla({
        projects: projects(),
        now: "2026-06-22T12:00:00.000Z",
        dueSoonHours: 24
      }).map((item) => [item.projectId, item.status])
    ).toEqual([
      ["project-a", "due-soon"],
      ["project-b", "overdue"],
      ["project-c", "on-track"]
    ]);
    expect(summarizeAgencyAssignees(projects())).toEqual([
      {
        principalId: "principal-analyst",
        assignedProjectCount: 2,
        blockerDiagnostics: 5
      },
      {
        principalId: "principal-owner",
        assignedProjectCount: 1,
        blockerDiagnostics: 0
      }
    ]);
  });

  it("builds onboarding, agency billing, and white-label report options", () => {
    expect(
      createAgencyOnboardingChecklist({
        workspaces: workspaces(),
        projects: projects(),
        brands: brands(),
        sharedPolicies: policies()
      }).map((item) => item.status)
    ).toEqual([
      "complete",
      "complete",
      "complete",
      "complete",
      "complete",
      "complete"
    ]);
    expect(
      createAgencyBillingSummary({
        planTier: "agency",
        clientWorkspacesUsed: 10,
        clientWorkspaceLimit: 10,
        sharedSeatsUsed: 7,
        sharedSeatLimit: 25
      })
    ).toEqual({
      planTier: "agency",
      clientWorkspacesUsed: 10,
      clientWorkspaceLimit: 10,
      sharedSeatsUsed: 7,
      sharedSeatLimit: 25,
      status: "limit-reached"
    });
    expect(
      whiteLabelReportOptions({
        brand: brands()[0]!,
        locale: "en"
      })
    ).toEqual({
      reportVariant: "white-label",
      audience: "agency",
      brandLabel: "Acme SEO",
      locale: "en"
    });
  });

  it("creates hosted white-label report link grants for active client agency reports", () => {
    expect(
      createAgencyHostedWhiteLabelReportLinkGrant({
        actor: principal(),
        membership: membership(),
        workspace: workspaces()[0]!,
        project: projects()[0]!,
        brand: brands()[0]!,
        artifact: reportArtifact(),
        now: "2026-06-22T10:00:00.000Z",
        ttlSeconds: 120
      })
    ).toEqual({
      allowed: true,
      clientWorkspaceId: "client-a",
      clientName: "Acme Retail",
      brandLabel: "Acme SEO",
      reportKind: "agency",
      signedUrlRequest: {
        request: {
          organizationId: "org-1",
          projectId: "project-a",
          environmentId: "env-1",
          principalId: "principal-client"
        },
        artifact: {
          id: "report-agency-1",
          organizationId: "org-1",
          projectId: "project-a",
          environmentId: "env-1",
          artifactUri:
            "s3://searchlint-reports/org-1/projects/project-a/reports/report-agency-1.html",
          deletionState: "active",
          expiresAt: "2026-06-23T00:00:00.000Z"
        },
        ttlSeconds: 120,
        now: "2026-06-22T10:00:00.000Z"
      },
      evidence:
        "Agency white-label report link grant for Acme Retail uses Acme SEO and report:read authorization."
    });
  });

  it("denies hosted white-label report links before presigning invalid agency reports", () => {
    const input = {
      actor: principal(),
      membership: membership(),
      workspace: workspaces()[0]!,
      project: projects()[0]!,
      brand: brands()[0]!,
      artifact: reportArtifact(),
      now: "2026-06-22T10:00:00.000Z",
      ttlSeconds: 120
    };

    expect(
      createAgencyHostedWhiteLabelReportLinkGrant({
        ...input,
        workspace: workspace({ status: "archived" })
      })
    ).toMatchObject({ allowed: false, reason: "workspace-not-active" });
    expect(
      createAgencyHostedWhiteLabelReportLinkGrant({
        ...input,
        brand: { ...brands()[0]!, clientWorkspaceId: "client-b" }
      })
    ).toMatchObject({ allowed: false, reason: "brand-workspace-mismatch" });
    expect(
      createAgencyHostedWhiteLabelReportLinkGrant({
        ...input,
        artifact: reportArtifact({ reportKind: "developer" })
      })
    ).toMatchObject({ allowed: false, reason: "report-kind-mismatch" });
    expect(
      createAgencyHostedWhiteLabelReportLinkGrant({
        ...input,
        artifact: reportArtifact({ artifactUri: undefined })
      })
    ).toMatchObject({ allowed: false, reason: "missing-artifact-uri" });
    expect(
      createAgencyHostedWhiteLabelReportLinkGrant({
        ...input,
        membership: undefined
      })
    ).toMatchObject({
      allowed: false,
      reason: "access-denied",
      accessReason: "missing-membership"
    });
  });

  it("creates brand asset upload grants without embedding raw asset bytes", () => {
    expect(
      createAgencyBrandAssetUploadGrant({
        workspace: workspaces()[0]!,
        filename: "acme-logo.svg",
        contentType: "image/svg+xml",
        byteLength: 4096,
        sha256:
          "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
        requestedAt: "2026-06-23T00:00:00.000Z"
      })
    ).toEqual({
      allowed: true,
      clientWorkspaceId: "client-a",
      organizationId: "org-1",
      contentType: "image/svg+xml",
      byteLength: 4096,
      objectUri:
        "s3://searchlint-artifacts/org-1/agency/client-a/brand-assets/0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef.svg",
      objectKey:
        "org-1/agency/client-a/brand-assets/0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef.svg",
      metadata: {
        sha256:
          "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
        requestedAt: "2026-06-23T00:00:00.000Z",
        dataClass: "brand-asset"
      },
      evidence:
        "Brand asset upload grant stores image/svg+xml for Acme Retail without embedding raw asset bytes in evidence."
    });
  });

  it("denies unsafe brand asset upload requests", () => {
    const input = {
      workspace: workspaces()[0]!,
      filename: "logo.svg",
      contentType: "image/svg+xml",
      byteLength: 4096,
      sha256:
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      requestedAt: "2026-06-23T00:00:00.000Z"
    };

    expect(
      createAgencyBrandAssetUploadGrant({
        ...input,
        workspace: workspace({ status: "paused" })
      })
    ).toMatchObject({ allowed: false, reason: "workspace-not-active" });
    expect(
      createAgencyBrandAssetUploadGrant({
        ...input,
        contentType: "image/gif"
      })
    ).toMatchObject({ allowed: false, reason: "unsupported-content-type" });
    expect(
      createAgencyBrandAssetUploadGrant({
        ...input,
        byteLength: 1_000_001
      })
    ).toMatchObject({ allowed: false, reason: "asset-too-large" });
    expect(
      createAgencyBrandAssetUploadGrant({
        ...input,
        sha256: "not-a-sha"
      })
    ).toMatchObject({ allowed: false, reason: "invalid-sha256" });
    expect(
      createAgencyBrandAssetUploadGrant({
        ...input,
        filename: "../logo.svg"
      })
    ).toMatchObject({ allowed: false, reason: "invalid-filename" });
  });

  it("verifies custom domains with DNS TXT challenge evidence", () => {
    expect(
      verifyAgencyCustomDomain({
        workspace: workspaces()[0]!,
        domain: "Reports.Acme-SEO.example",
        verificationToken: "searchlint_token_1234567890",
        observedTxtValues: [
          "searchlint-site-verification=searchlint_token_1234567890"
        ],
        observedAt: "2026-06-23T00:00:00.000Z"
      })
    ).toEqual({
      verified: true,
      clientWorkspaceId: "client-a",
      organizationId: "org-1",
      domain: "reports.acme-seo.example",
      expectedTxtRecordName: "_searchlint.reports.acme-seo.example",
      expectedTxtValue:
        "searchlint-site-verification=searchlint_token_1234567890",
      observedAt: "2026-06-23T00:00:00.000Z",
      evidence:
        "Custom domain reports.acme-seo.example is verified for Acme Retail by DNS TXT challenge."
    });
  });

  it("denies unsafe or unverified custom domains", () => {
    const input = {
      workspace: workspaces()[0]!,
      domain: "reports.example.test",
      verificationToken: "searchlint_token_1234567890",
      observedTxtValues: [
        "searchlint-site-verification=searchlint_token_1234567890"
      ],
      observedAt: "2026-06-23T00:00:00.000Z"
    };

    expect(
      verifyAgencyCustomDomain({
        ...input,
        workspace: workspace({ status: "archived" })
      })
    ).toMatchObject({ verified: false, reason: "workspace-not-active" });
    expect(
      verifyAgencyCustomDomain({
        ...input,
        domain: "https://reports.example.test/path"
      })
    ).toMatchObject({ verified: false, reason: "invalid-domain" });
    expect(
      verifyAgencyCustomDomain({
        ...input,
        verificationToken: "short"
      })
    ).toMatchObject({ verified: false, reason: "invalid-token" });
    expect(
      verifyAgencyCustomDomain({
        ...input,
        observedTxtValues: []
      })
    ).toMatchObject({ verified: false, reason: "txt-record-missing" });
  });

  it("creates a production agency persistence acceptance packet that blocks fake completion", () => {
    const packet = agencyProductionPersistenceAcceptancePacket();

    expect(packet).toMatchObject({
      acceptanceVersion: 1,
      gate: "agency-production-client-workspace-persistence",
      status: "blocked_until_owner_evidence"
    });
    expect(packet.requiredEvidence.map((item) => item.id)).toEqual([
      "rds-client-workspaces",
      "rds-client-projects",
      "rds-white-label-brand",
      "rds-shared-rule-policy",
      "rds-assignees-sla",
      "tenant-isolation",
      "retention-deletion-metadata",
      "dashboard-api-read"
    ]);
    expect(packet.requiredEvidence.every((item) => item.sanitized)).toBe(true);
    expect(packet.passCriteria).toContain(
      "Client-role access remains read-only and tenant-scoped for persisted client workspace records."
    );
    expect(packet.forbiddenEvidence).toEqual(
      expect.arrayContaining([
        "raw customer email addresses",
        "private keys",
        "raw database URLs",
        "authorization headers",
        "bearer tokens",
        "cross-tenant data"
      ])
    );
  });
});

function workspaces(): AgencyClientWorkspace[] {
  return [
    workspace({ id: "client-a", clientName: "Acme Retail", status: "active" }),
    workspace({ id: "client-b", clientName: "Beta SaaS", status: "active" }),
    workspace({
      id: "client-c",
      clientName: "Archived Client",
      status: "archived"
    })
  ];
}

function workspace(
  overrides: Partial<AgencyClientWorkspace> = {}
): AgencyClientWorkspace {
  return {
    id: "client-a",
    organizationId: "org-1",
    clientName: "Acme Retail",
    status: "active",
    ownerPrincipalId: "principal-owner",
    createdAt: "2026-06-22T00:00:00.000Z",
    ...overrides
  };
}

function projects(): AgencyClientProject[] {
  return [
    project({
      id: "client-project-a",
      workspaceId: "client-a",
      projectId: "project-a",
      displayName: "Acme Store",
      healthScore: 92,
      openDiagnostics: 12,
      blockerDiagnostics: 1,
      assigneePrincipalId: "principal-analyst",
      slaDueAt: "2026-06-23T00:00:00.000Z"
    }),
    project({
      id: "client-project-b",
      workspaceId: "client-a",
      projectId: "project-b",
      displayName: "Acme Blog",
      healthScore: 61,
      openDiagnostics: 24,
      blockerDiagnostics: 4,
      assigneePrincipalId: "principal-analyst",
      slaDueAt: "2026-06-22T10:00:00.000Z"
    }),
    project({
      id: "client-project-c",
      workspaceId: "client-b",
      projectId: "project-c",
      displayName: "Beta Docs",
      healthScore: 92,
      openDiagnostics: 6,
      blockerDiagnostics: 0,
      assigneePrincipalId: "principal-owner",
      slaDueAt: "2026-06-25T00:00:00.000Z"
    })
  ];
}

function project(
  overrides: Partial<AgencyClientProject> = {}
): AgencyClientProject {
  return {
    id: "client-project-a",
    workspaceId: "client-a",
    projectId: "project-a",
    environmentId: "env-1",
    displayName: "Acme Store",
    siteUrl: "https://example.test",
    healthScore: 90,
    openDiagnostics: 0,
    blockerDiagnostics: 0,
    lastCrawlAt: "2026-06-22T00:00:00.000Z",
    sharedPolicyId: "policy-1",
    ...overrides
  };
}

function brands(): AgencyWhiteLabelBrand[] {
  return [
    {
      clientWorkspaceId: "client-a",
      brandLabel: "Acme SEO",
      logoUri: "s3://searchlint-artifacts/brands/acme/logo.svg",
      primaryColor: "#1d4ed8",
      reportFooter: "Prepared for Acme Retail"
    }
  ];
}

function principal(): Principal {
  return {
    id: "principal-client",
    externalSubject: "cognito|principal-client"
  };
}

function membership(
  overrides: Partial<OrganizationMembership> = {}
): OrganizationMembership {
  return {
    id: "membership-client",
    organizationId: "org-1",
    principalId: "principal-client",
    role: "client",
    createdAt: "2026-06-22T00:00:00.000Z",
    ...overrides
  };
}

function reportArtifact(
  overrides: Partial<ReportArtifact> = {}
): ReportArtifact {
  return {
    id: "report-agency-1",
    organizationId: "org-1",
    projectId: "project-a",
    environmentId: "env-1",
    reportKind: "agency",
    artifactUri:
      "s3://searchlint-reports/org-1/projects/project-a/reports/report-agency-1.html",
    pinned: false,
    generatedAt: "2026-06-22T00:00:00.000Z",
    retentionUntil: "2026-06-23T00:00:00.000Z",
    deletionState: "active",
    createdAt: "2026-06-22T00:00:00.000Z",
    ...overrides
  };
}

function policies(): AgencySharedRulePolicy[] {
  return [
    {
      id: "policy-1",
      organizationId: "org-1",
      name: "Agency default blockers",
      ruleIds: ["SL-META-001", "SL-CANON-001"],
      severityOverrides: {
        "SL-META-001": "blocker"
      }
    }
  ];
}
