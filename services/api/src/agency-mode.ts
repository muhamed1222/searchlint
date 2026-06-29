import { roleHasPermission } from "./rbac.js";
import { authorizeReportArtifactAccess } from "./report-access-control.js";
import type {
  OrganizationMembership,
  OrganizationRole,
  PlanTier,
  Principal,
  ReportArtifact
} from "./types.js";

export type AgencyClientWorkspaceStatus = "active" | "paused" | "archived";

export type AgencyClientWorkspace = {
  id: string;
  organizationId: string;
  clientName: string;
  status: AgencyClientWorkspaceStatus;
  ownerPrincipalId: string;
  createdAt: string;
};

export type AgencyClientProject = {
  id: string;
  workspaceId: string;
  projectId: string;
  environmentId: string;
  displayName: string;
  siteUrl: string;
  healthScore: number;
  openDiagnostics: number;
  blockerDiagnostics: number;
  lastCrawlAt?: string;
  assigneePrincipalId?: string;
  sharedPolicyId?: string;
  slaDueAt?: string;
};

export type AgencyWhiteLabelBrand = {
  clientWorkspaceId: string;
  brandLabel: string;
  logoUri?: string;
  primaryColor?: string;
  reportFooter?: string;
};

export type AgencyBrandAssetContentType =
  | "image/svg+xml"
  | "image/png"
  | "image/jpeg"
  | "image/webp";

export type AgencySharedRulePolicy = {
  id: string;
  organizationId: string;
  name: string;
  ruleIds: readonly string[];
  severityOverrides: Readonly<
    Record<string, "blocker" | "error" | "warning" | "info">
  >;
};

export type AgencyPortfolioSummary = {
  clientCount: number;
  activeClientCount: number;
  projectCount: number;
  openDiagnostics: number;
  blockerDiagnostics: number;
  averageHealthScore: number;
  overdueSlaCount: number;
};

export type AgencyClientAccessDecision = {
  role: OrganizationRole;
  canReadProject: boolean;
  canReadReports: boolean;
  canMutateProject: boolean;
  canManageBilling: boolean;
  evidence: string;
};

export type AgencyBulkMonitoringPlan = {
  projectIds: readonly string[];
  maxConcurrency: number;
  estimatedUrlBudget: number;
  evidence: string;
};

export type AgencySlaStatus = {
  projectId: string;
  dueAt?: string;
  status: "on-track" | "due-soon" | "overdue" | "not-configured";
  evidence: string;
};

export type AgencyAssigneeSummary = {
  principalId: string;
  assignedProjectCount: number;
  blockerDiagnostics: number;
};

export type AgencyOnboardingChecklistItem = {
  label: string;
  status: "complete" | "needsAttention";
  evidence: string;
};

export type AgencyBillingSummary = {
  planTier: PlanTier;
  clientWorkspacesUsed: number;
  clientWorkspaceLimit: number;
  sharedSeatsUsed: number;
  sharedSeatLimit: number;
  status: "within-limit" | "limit-reached" | "over-limit";
};

export type AgencyPersistenceEvidenceRequirement = {
  id: string;
  description: string;
  sanitized: true;
};

export type AgencyProductionPersistenceAcceptancePacket = {
  acceptanceVersion: 1;
  gate: "agency-production-client-workspace-persistence";
  status: "blocked_until_owner_evidence";
  requiredInputs: readonly string[];
  requiredEvidence: readonly AgencyPersistenceEvidenceRequirement[];
  passCriteria: readonly string[];
  forbiddenEvidence: readonly string[];
};

export type AgencyHostedWhiteLabelReportLinkInput = {
  actor: Principal;
  membership?: OrganizationMembership;
  workspace: AgencyClientWorkspace;
  project: AgencyClientProject;
  brand: AgencyWhiteLabelBrand;
  artifact: ReportArtifact;
  now: string;
  ttlSeconds: number;
};

export type AgencyHostedWhiteLabelReportLinkGrant =
  | {
      allowed: true;
      clientWorkspaceId: string;
      clientName: string;
      brandLabel: string;
      reportKind: "agency";
      signedUrlRequest: {
        request: {
          organizationId: string;
          projectId: string;
          environmentId: string;
          principalId: string;
        };
        artifact: {
          id: string;
          organizationId: string;
          projectId: string;
          environmentId: string;
          artifactUri: string;
          deletionState: "active" | "deleting" | "deleted";
          expiresAt?: string;
        };
        ttlSeconds: number;
        now: string;
      };
      evidence: string;
    }
  | {
      allowed: false;
      clientWorkspaceId?: string;
      artifactId: string;
      reason:
        | "workspace-organization-mismatch"
        | "workspace-not-active"
        | "project-workspace-mismatch"
        | "brand-workspace-mismatch"
        | "report-kind-mismatch"
        | "missing-artifact-uri"
        | "access-denied";
      accessReason?: string;
    };

export type AgencyBrandAssetUploadInput = {
  workspace: AgencyClientWorkspace;
  filename: string;
  contentType: string;
  byteLength: number;
  sha256: string;
  requestedAt: string;
  maxBytes?: number;
};

export type AgencyBrandAssetUploadGrant =
  | {
      allowed: true;
      clientWorkspaceId: string;
      organizationId: string;
      contentType: AgencyBrandAssetContentType;
      byteLength: number;
      objectUri: string;
      objectKey: string;
      metadata: {
        sha256: string;
        requestedAt: string;
        dataClass: "brand-asset";
      };
      evidence: string;
    }
  | {
      allowed: false;
      clientWorkspaceId: string;
      reason:
        | "workspace-not-active"
        | "unsupported-content-type"
        | "asset-too-large"
        | "invalid-sha256"
        | "invalid-filename";
    };

export type AgencyCustomDomainVerificationInput = {
  workspace: AgencyClientWorkspace;
  domain: string;
  verificationToken: string;
  observedTxtValues: readonly string[];
  observedAt: string;
};

export type AgencyCustomDomainVerificationResult =
  | {
      verified: true;
      clientWorkspaceId: string;
      organizationId: string;
      domain: string;
      expectedTxtRecordName: string;
      expectedTxtValue: string;
      observedAt: string;
      evidence: string;
    }
  | {
      verified: false;
      clientWorkspaceId: string;
      domain?: string;
      expectedTxtRecordName?: string;
      expectedTxtValue?: string;
      observedAt: string;
      reason:
        | "workspace-not-active"
        | "invalid-domain"
        | "invalid-token"
        | "txt-record-missing";
    };

export function createAgencyPortfolioSummary(input: {
  workspaces: readonly AgencyClientWorkspace[];
  projects: readonly AgencyClientProject[];
  now: string;
}): AgencyPortfolioSummary {
  const activeWorkspaceIds = new Set(
    input.workspaces
      .filter((workspace) => workspace.status === "active")
      .map((workspace) => workspace.id)
  );
  const activeProjects = input.projects.filter((project) =>
    activeWorkspaceIds.has(project.workspaceId)
  );
  const healthTotal = activeProjects.reduce(
    (sum, project) => sum + project.healthScore,
    0
  );
  return {
    clientCount: input.workspaces.length,
    activeClientCount: activeWorkspaceIds.size,
    projectCount: activeProjects.length,
    openDiagnostics: activeProjects.reduce(
      (sum, project) => sum + project.openDiagnostics,
      0
    ),
    blockerDiagnostics: activeProjects.reduce(
      (sum, project) => sum + project.blockerDiagnostics,
      0
    ),
    averageHealthScore:
      activeProjects.length === 0
        ? 0
        : Math.round((healthTotal / activeProjects.length) * 100) / 100,
    overdueSlaCount: activeProjects.filter(
      (project) =>
        project.slaDueAt !== undefined && project.slaDueAt < input.now
    ).length
  };
}

export function agencyClientAccessDecision(
  role: OrganizationRole
): AgencyClientAccessDecision {
  const canReadProject = roleHasPermission(role, "project:read");
  const canReadReports = roleHasPermission(role, "report:read");
  const canMutateProject = roleHasPermission(role, "project:update");
  const canManageBilling = roleHasPermission(role, "billing:manage");
  return {
    role,
    canReadProject,
    canReadReports,
    canMutateProject,
    canManageBilling,
    evidence:
      role === "client"
        ? "Client role can read shared project/report views and cannot mutate projects or billing."
        : `${role} role follows SearchLint-owned organization RBAC permissions.`
  };
}

export function createAgencyBulkMonitoringPlan(input: {
  projects: readonly AgencyClientProject[];
  maxConcurrency: number;
  urlsPerProject: number;
}): AgencyBulkMonitoringPlan {
  const projectIds = [...input.projects]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((project) => project.projectId);
  return {
    projectIds,
    maxConcurrency: input.maxConcurrency,
    estimatedUrlBudget: projectIds.length * input.urlsPerProject,
    evidence: `Bulk monitoring covers ${projectIds.length} project(s) with concurrency ${input.maxConcurrency}.`
  };
}

export function evaluateAgencySla(input: {
  projects: readonly AgencyClientProject[];
  now: string;
  dueSoonHours: number;
}): readonly AgencySlaStatus[] {
  const dueSoonMs = input.dueSoonHours * 60 * 60 * 1000;
  const nowMs = Date.parse(input.now);
  return [...input.projects]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((project) => {
      if (project.slaDueAt === undefined) {
        return {
          projectId: project.projectId,
          status: "not-configured" as const,
          evidence: `Project ${project.projectId} has no SLA due date.`
        };
      }
      const dueMs = Date.parse(project.slaDueAt);
      const status =
        dueMs < nowMs
          ? "overdue"
          : dueMs - nowMs <= dueSoonMs
            ? "due-soon"
            : "on-track";
      return {
        projectId: project.projectId,
        dueAt: project.slaDueAt,
        status,
        evidence: `Project ${project.projectId} SLA is ${status}.`
      };
    });
}

export function summarizeAgencyAssignees(
  projects: readonly AgencyClientProject[]
): readonly AgencyAssigneeSummary[] {
  const summaries = new Map<string, AgencyAssigneeSummary>();
  for (const project of projects) {
    if (project.assigneePrincipalId === undefined) {
      continue;
    }
    const current = summaries.get(project.assigneePrincipalId) ?? {
      principalId: project.assigneePrincipalId,
      assignedProjectCount: 0,
      blockerDiagnostics: 0
    };
    summaries.set(project.assigneePrincipalId, {
      principalId: current.principalId,
      assignedProjectCount: current.assignedProjectCount + 1,
      blockerDiagnostics:
        current.blockerDiagnostics + project.blockerDiagnostics
    });
  }
  return [...summaries.values()].sort((left, right) =>
    left.principalId.localeCompare(right.principalId)
  );
}

export function createAgencyOnboardingChecklist(input: {
  workspaces: readonly AgencyClientWorkspace[];
  projects: readonly AgencyClientProject[];
  brands: readonly AgencyWhiteLabelBrand[];
  sharedPolicies: readonly AgencySharedRulePolicy[];
}): readonly AgencyOnboardingChecklistItem[] {
  return [
    checklistItem("Client workspace created", input.workspaces.length > 0),
    checklistItem("Client projects connected", input.projects.length > 0),
    checklistItem("White-label branding configured", input.brands.length > 0),
    checklistItem(
      "Shared rule policy assigned",
      input.sharedPolicies.length > 0
    ),
    checklistItem(
      "Assignees configured",
      input.projects.some(
        (project) => project.assigneePrincipalId !== undefined
      )
    ),
    checklistItem(
      "SLA tracking configured",
      input.projects.some((project) => project.slaDueAt !== undefined)
    )
  ];
}

export function createAgencyBillingSummary(input: {
  planTier: PlanTier;
  clientWorkspacesUsed: number;
  clientWorkspaceLimit: number;
  sharedSeatsUsed: number;
  sharedSeatLimit: number;
}): AgencyBillingSummary {
  const over =
    input.clientWorkspacesUsed > input.clientWorkspaceLimit ||
    input.sharedSeatsUsed > input.sharedSeatLimit;
  const reached =
    input.clientWorkspacesUsed === input.clientWorkspaceLimit ||
    input.sharedSeatsUsed === input.sharedSeatLimit;
  return {
    ...input,
    status: over ? "over-limit" : reached ? "limit-reached" : "within-limit"
  };
}

export function whiteLabelReportOptions(input: {
  brand: AgencyWhiteLabelBrand;
  locale?: string;
}): {
  reportVariant: "white-label";
  audience: "agency";
  brandLabel: string;
  locale: string;
} {
  return {
    reportVariant: "white-label",
    audience: "agency",
    brandLabel: input.brand.brandLabel,
    locale: input.locale ?? "en"
  };
}

export function createAgencyHostedWhiteLabelReportLinkGrant(
  input: AgencyHostedWhiteLabelReportLinkInput
): AgencyHostedWhiteLabelReportLinkGrant {
  const baseDeny = {
    allowed: false,
    clientWorkspaceId: input.workspace.id,
    artifactId: input.artifact.id
  } as const;

  if (input.workspace.organizationId !== input.artifact.organizationId) {
    return {
      ...baseDeny,
      reason: "workspace-organization-mismatch"
    };
  }

  if (input.workspace.status !== "active") {
    return {
      ...baseDeny,
      reason: "workspace-not-active"
    };
  }

  if (
    input.project.workspaceId !== input.workspace.id ||
    input.project.projectId !== input.artifact.projectId ||
    input.project.environmentId !== input.artifact.environmentId
  ) {
    return {
      ...baseDeny,
      reason: "project-workspace-mismatch"
    };
  }

  if (input.brand.clientWorkspaceId !== input.workspace.id) {
    return {
      ...baseDeny,
      reason: "brand-workspace-mismatch"
    };
  }

  if (input.artifact.reportKind !== "agency") {
    return {
      ...baseDeny,
      reason: "report-kind-mismatch"
    };
  }

  if (input.artifact.artifactUri === undefined) {
    return {
      ...baseDeny,
      reason: "missing-artifact-uri"
    };
  }

  const accessRequest = {
    actor: input.actor,
    organizationId: input.workspace.organizationId,
    projectId: input.project.projectId,
    environmentId: input.project.environmentId,
    artifact: {
      id: input.artifact.id,
      organizationId: input.artifact.organizationId,
      projectId: input.artifact.projectId,
      environmentId: input.artifact.environmentId,
      deletionState: input.artifact.deletionState,
      ...(input.artifact.retentionUntil === undefined
        ? {}
        : { expiresAt: input.artifact.retentionUntil })
    },
    now: input.now
  };
  const access = authorizeReportArtifactAccess(
    input.membership === undefined
      ? accessRequest
      : {
          ...accessRequest,
          membership: input.membership
        }
  );

  if (!access.allowed) {
    return {
      ...baseDeny,
      reason: "access-denied",
      accessReason: access.reason
    };
  }

  return {
    allowed: true,
    clientWorkspaceId: input.workspace.id,
    clientName: input.workspace.clientName,
    brandLabel: input.brand.brandLabel,
    reportKind: "agency",
    signedUrlRequest: {
      request: {
        organizationId: input.workspace.organizationId,
        projectId: input.project.projectId,
        environmentId: input.project.environmentId,
        principalId: input.actor.id
      },
      artifact: {
        id: input.artifact.id,
        organizationId: input.artifact.organizationId,
        projectId: input.artifact.projectId,
        environmentId: input.artifact.environmentId,
        artifactUri: input.artifact.artifactUri,
        deletionState: input.artifact.deletionState,
        ...(input.artifact.retentionUntil === undefined
          ? {}
          : { expiresAt: input.artifact.retentionUntil })
      },
      ttlSeconds: input.ttlSeconds,
      now: input.now
    },
    evidence: `Agency white-label report link grant for ${input.workspace.clientName} uses ${input.brand.brandLabel} and report:read authorization.`
  };
}

export function createAgencyBrandAssetUploadGrant(
  input: AgencyBrandAssetUploadInput
): AgencyBrandAssetUploadGrant {
  if (input.workspace.status !== "active") {
    return {
      allowed: false,
      clientWorkspaceId: input.workspace.id,
      reason: "workspace-not-active"
    };
  }

  const contentType = agencyBrandAssetContentType(input.contentType);
  if (contentType === undefined) {
    return {
      allowed: false,
      clientWorkspaceId: input.workspace.id,
      reason: "unsupported-content-type"
    };
  }

  const maxBytes = input.maxBytes ?? 1_000_000;
  if (
    !Number.isInteger(input.byteLength) ||
    input.byteLength < 1 ||
    input.byteLength > maxBytes
  ) {
    return {
      allowed: false,
      clientWorkspaceId: input.workspace.id,
      reason: "asset-too-large"
    };
  }

  if (!/^[a-f0-9]{64}$/u.test(input.sha256)) {
    return {
      allowed: false,
      clientWorkspaceId: input.workspace.id,
      reason: "invalid-sha256"
    };
  }

  const extension = agencyBrandAssetExtension(input.filename, contentType);
  if (extension === undefined) {
    return {
      allowed: false,
      clientWorkspaceId: input.workspace.id,
      reason: "invalid-filename"
    };
  }

  const objectKey = [
    input.workspace.organizationId,
    "agency",
    input.workspace.id,
    "brand-assets",
    `${input.sha256}.${extension}`
  ].join("/");

  return {
    allowed: true,
    clientWorkspaceId: input.workspace.id,
    organizationId: input.workspace.organizationId,
    contentType,
    byteLength: input.byteLength,
    objectUri: `s3://searchlint-artifacts/${objectKey}`,
    objectKey,
    metadata: {
      sha256: input.sha256,
      requestedAt: input.requestedAt,
      dataClass: "brand-asset"
    },
    evidence: `Brand asset upload grant stores ${contentType} for ${input.workspace.clientName} without embedding raw asset bytes in evidence.`
  };
}

export function verifyAgencyCustomDomain(
  input: AgencyCustomDomainVerificationInput
): AgencyCustomDomainVerificationResult {
  if (input.workspace.status !== "active") {
    return {
      verified: false,
      clientWorkspaceId: input.workspace.id,
      observedAt: input.observedAt,
      reason: "workspace-not-active"
    };
  }

  const domain = normalizeAgencyCustomDomain(input.domain);
  if (domain === undefined) {
    return {
      verified: false,
      clientWorkspaceId: input.workspace.id,
      observedAt: input.observedAt,
      reason: "invalid-domain"
    };
  }

  if (!/^[a-zA-Z0-9_-]{16,96}$/u.test(input.verificationToken)) {
    return {
      verified: false,
      clientWorkspaceId: input.workspace.id,
      domain,
      observedAt: input.observedAt,
      reason: "invalid-token"
    };
  }

  const expectedTxtRecordName = `_searchlint.${domain}`;
  const expectedTxtValue = `searchlint-site-verification=${input.verificationToken}`;
  if (!input.observedTxtValues.includes(expectedTxtValue)) {
    return {
      verified: false,
      clientWorkspaceId: input.workspace.id,
      domain,
      expectedTxtRecordName,
      expectedTxtValue,
      observedAt: input.observedAt,
      reason: "txt-record-missing"
    };
  }

  return {
    verified: true,
    clientWorkspaceId: input.workspace.id,
    organizationId: input.workspace.organizationId,
    domain,
    expectedTxtRecordName,
    expectedTxtValue,
    observedAt: input.observedAt,
    evidence: `Custom domain ${domain} is verified for ${input.workspace.clientName} by DNS TXT challenge.`
  };
}

export function agencyProductionPersistenceAcceptancePacket(): AgencyProductionPersistenceAcceptancePacket {
  return {
    acceptanceVersion: 1,
    gate: "agency-production-client-workspace-persistence",
    status: "blocked_until_owner_evidence",
    requiredInputs: [
      "Deployed SearchLint API and dashboard running against the production PostgreSQL/RDS schema.",
      "Agency organization with at least two client workspaces and multiple client projects.",
      "Persisted white-label brand, shared rule policy, assignee, and SLA records for at least one client workspace.",
      "Client-role principal and agency owner/admin principal for tenant-isolation and read/write checks.",
      "Owner-provided sanitized deployed API/RDS evidence for the tested organization."
    ],
    requiredEvidence: [
      agencyPersistenceEvidence(
        "rds-client-workspaces",
        "Sanitized deployed RDS rows or API responses showing agency client workspaces with organization scope, status, owner, and schema version."
      ),
      agencyPersistenceEvidence(
        "rds-client-projects",
        "Sanitized deployed RDS rows or API responses showing client projects mapped to workspaces, projects, environments, diagnostics summary, and crawl timestamps."
      ),
      agencyPersistenceEvidence(
        "rds-white-label-brand",
        "Sanitized deployed persistence evidence for white-label brand label, logo/object reference, colors, and report footer without raw uploaded assets."
      ),
      agencyPersistenceEvidence(
        "rds-shared-rule-policy",
        "Sanitized deployed persistence evidence for shared rule policies, assigned rule IDs, severity overrides, and workspace/project assignment."
      ),
      agencyPersistenceEvidence(
        "rds-assignees-sla",
        "Sanitized deployed persistence evidence for assignee principal IDs and SLA due dates surfaced in agency summaries."
      ),
      agencyPersistenceEvidence(
        "tenant-isolation",
        "Sanitized deployed evidence that another organization cannot read or mutate the agency client workspace records."
      ),
      agencyPersistenceEvidence(
        "retention-deletion-metadata",
        "Sanitized deployed evidence that agency persistence rows carry retention and deletion-state metadata."
      ),
      agencyPersistenceEvidence(
        "dashboard-api-read",
        "Sanitized deployed dashboard/API response evidence showing persisted client workspace data rendered from storage."
      )
    ],
    passCriteria: [
      "Agency client workspaces and projects persist in deployed PostgreSQL/RDS and survive API process restarts.",
      "White-label brand, shared policy, assignee, and SLA fields persist and are reflected in dashboard/API reads.",
      "Client-role access remains read-only and tenant-scoped for persisted client workspace records.",
      "Retention and deletion-state metadata are present for persisted agency records.",
      "No raw customer emails, private keys, database URLs, bearer tokens, authorization headers, raw uploaded brand assets, or cross-tenant data appear in evidence."
    ],
    forbiddenEvidence: [
      "raw customer email addresses",
      "private keys",
      "raw database URLs",
      "database passwords",
      "authorization headers",
      "bearer tokens",
      "raw uploaded brand assets",
      "cross-tenant data",
      "unredacted invite tokens"
    ]
  };
}

function checklistItem(
  label: string,
  complete: boolean
): AgencyOnboardingChecklistItem {
  return {
    label,
    status: complete ? "complete" : "needsAttention",
    evidence: complete ? `${label}.` : `${label} is not configured.`
  };
}

function agencyBrandAssetContentType(
  value: string
): AgencyBrandAssetContentType | undefined {
  if (
    value === "image/svg+xml" ||
    value === "image/png" ||
    value === "image/jpeg" ||
    value === "image/webp"
  ) {
    return value;
  }
  return undefined;
}

function agencyBrandAssetExtension(
  filename: string,
  contentType: AgencyBrandAssetContentType
): string | undefined {
  const normalized = filename.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{0,127}$/u.test(normalized)) {
    return undefined;
  }

  const extension = normalized.split(".").pop();
  const expected = {
    "image/svg+xml": "svg",
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp"
  } satisfies Record<AgencyBrandAssetContentType, string>;
  if (extension === expected[contentType]) {
    return extension;
  }
  if (contentType === "image/jpeg" && extension === "jpeg") {
    return "jpg";
  }
  return undefined;
}

function normalizeAgencyCustomDomain(domain: string): string | undefined {
  const value = domain.trim().toLowerCase();
  if (
    value.includes("/") ||
    value.includes(":") ||
    value.startsWith(".") ||
    value.endsWith(".") ||
    value.includes("..") ||
    value.length > 253
  ) {
    return undefined;
  }
  const labels = value.split(".");
  if (labels.length < 2) {
    return undefined;
  }
  for (const label of labels) {
    if (
      label.length < 1 ||
      label.length > 63 ||
      label.startsWith("-") ||
      label.endsWith("-") ||
      !/^[a-z0-9-]+$/u.test(label)
    ) {
      return undefined;
    }
  }
  return value;
}

function agencyPersistenceEvidence(
  id: string,
  description: string
): AgencyPersistenceEvidenceRequirement {
  return {
    id,
    description,
    sanitized: true
  };
}
