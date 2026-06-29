export type SecurityPrivacyControlStatus = "verified" | "blocked";

export type SecurityPrivacyControlCategory =
  | "application-security"
  | "cloud-security"
  | "identity"
  | "privacy"
  | "legal"
  | "external-audit";

export type SecurityPrivacyControl = {
  id: string;
  category: SecurityPrivacyControlCategory;
  title: string;
  status: SecurityPrivacyControlStatus;
  evidence: readonly string[];
  missing: readonly string[];
  releaseBlocker: boolean;
};

export type SecurityPrivacyGateSummary = {
  controlCount: number;
  verifiedCount: number;
  blockedCount: number;
  releaseBlockerCount: number;
  status: "deterministic-proof-complete" | "blocked";
};

export type SecurityPrivacyGateReport = {
  summary: SecurityPrivacyGateSummary;
  controls: readonly SecurityPrivacyControl[];
};

export type PrivacyRequestKind =
  | "user-data-export"
  | "account-deletion"
  | "organization-deletion";

export type PrivacyRequestPlan = {
  kind: PrivacyRequestKind;
  actorPrincipalId: string;
  targetId: string;
  requiredSteps: readonly string[];
  retainedLegalRecords: readonly string[];
  deadlineHours: number;
  evidence: string;
};

export type PrivacyRequestExecutionStatus =
  | "export-ready"
  | "deletion-scheduled"
  | "deletion-complete";

export type PrivacyRequestAuditEvidence = {
  action: string;
  actorPrincipalId: string;
  targetId: string;
  retainedLegalRecords: readonly string[];
  redacted: true;
};

export type UserDataExportExecution = {
  kind: "user-data-export";
  status: "export-ready";
  artifact: {
    format: "application/json";
    access: "tenant-scoped-signed-artifact";
    sections: readonly string[];
    excluded: readonly string[];
  };
  audit: PrivacyRequestAuditEvidence;
};

export type AccountDeletionExecution = {
  kind: "account-deletion";
  status: "deletion-complete";
  actions: readonly string[];
  anonymizedFields: readonly string[];
  retainedLegalRecords: readonly string[];
  audit: PrivacyRequestAuditEvidence;
};

export type OrganizationDeletionExecution = {
  kind: "organization-deletion";
  status: "deletion-scheduled";
  job: {
    startsWithinHours: number;
    completesWithinHours: number;
    cleanupActions: readonly string[];
  };
  retainedLegalRecords: readonly string[];
  audit: PrivacyRequestAuditEvidence;
};

export type PrivacyRequestExecution =
  | UserDataExportExecution
  | AccountDeletionExecution
  | OrganizationDeletionExecution;

export type SecurityDisclosurePolicy = {
  intake:
    | "private-owner-before-release"
    | "public-security-contact-after-release";
  publicIssuesAllowed: boolean;
  sensitiveIssueTypes: readonly string[];
  legalReviewRequired: boolean;
  evidence: string;
};

const deterministicControls: readonly SecurityPrivacyControl[] = [
  verified(
    "threat-model-review",
    "application-security",
    "Threat model reviewed against current architecture and security model.",
    ["docs/SECURITY_MODEL.md", "docs/ARCHITECTURE.md", "docs/OPEN_DECISIONS.md"]
  ),
  verified(
    "dependency-audit",
    "external-audit",
    "Release-time dependency audit has deterministic pnpm audit evidence.",
    [
      "pnpm security:dependency-audit",
      "docs/DEPENDENCY_AUDIT_RELEASE_GATE.md",
      "docs/examples/dependency-audit-report.sample.json"
    ]
  ),
  verified(
    "sast",
    "external-audit",
    "Repository-owned static SAST has deterministic evidence with reviewed sink allowlist.",
    [
      "pnpm security:sast",
      "docs/STATIC_SAST_RELEASE_GATE.md",
      "docs/examples/static-sast-report.sample.json"
    ]
  ),
  blockedExternal(
    "dast",
    "external-audit",
    "DAST requires a deployed target.",
    ["Run DAST against deployed staging/production-equivalent environment."]
  ),
  blockedExternal(
    "penetration-test",
    "external-audit",
    "Penetration test requires an independent tester.",
    ["Obtain independent pentest report and remediation sign-off."]
  ),
  verified(
    "ssrf-private-network",
    "application-security",
    "Crawler SSRF and private-network controls have deterministic acceptance.",
    [
      "pnpm crawler:acceptance",
      "docs/CLI_CI_USAGE.md",
      "docs/examples/crawler-acceptance-report.sample.json"
    ]
  ),
  verified(
    "xss-output-escaping",
    "application-security",
    "HTML/dashboard/report output escaping and CSP/security-header contracts are covered locally.",
    [
      "packages/reporter-html/test/html.test.ts",
      "apps/dashboard/test/dashboard.test.ts",
      "infra/aws/dashboard-static-hosting.cloudformation.json"
    ]
  ),
  verified(
    "csrf-request-boundary",
    "application-security",
    "Cloud API uses bearer-token JSON API boundaries and rejects malformed requests before dispatch.",
    [
      "pnpm api:acceptance",
      "docs/BACKEND_API_DEPLOYMENT_SECURITY_ACCEPTANCE.md"
    ]
  ),
  verified(
    "injection-attacks",
    "application-security",
    "PostgreSQL access uses parameterized SQL contracts and typed validation boundaries.",
    [
      "services/api/src/postgres-repository-sql.ts",
      "services/api/test/postgres-repository-sql.test.ts",
      "pnpm api:acceptance"
    ]
  ),
  verified(
    "oauth-attacks",
    "identity",
    "OAuth token metadata, vault write/read/delete, refresh, and revocation paths have deterministic proof.",
    ["pnpm oauth-vault:acceptance", "docs/OAUTH_VAULT_SECURITY.md"]
  ),
  verified(
    "tenant-isolation",
    "identity",
    "Organization/project/environment identity and RBAC checks have deterministic proof.",
    ["pnpm auth:acceptance", "docs/AUTH_RBAC_ACCEPTANCE.md"]
  ),
  verified(
    "secrets-handling",
    "cloud-security",
    "KMS/Secrets Manager contracts, token refs, and telemetry redaction are covered locally.",
    [
      "pnpm oauth-vault:acceptance",
      "pnpm observability:acceptance",
      "docs/OAUTH_VAULT_SECURITY.md"
    ]
  ),
  verified(
    "encryption-at-rest",
    "cloud-security",
    "RDS, S3, CloudWatch log, and Secrets Manager/KMS templates declare encrypted storage.",
    [
      "pnpm storage:backup:acceptance",
      "pnpm object-storage:acceptance",
      "pnpm oauth-vault:acceptance",
      "pnpm lint"
    ]
  ),
  verified(
    "encryption-in-transit",
    "cloud-security",
    "API Gateway/dashboard/S3 contracts enforce HTTPS/TLS-only access where represented.",
    [
      "pnpm api:acceptance",
      "pnpm object-storage:acceptance",
      "infra/aws/dashboard-static-hosting.cloudformation.json"
    ]
  ),
  verified(
    "backup-security",
    "cloud-security",
    "Backup readiness and retention controls have deterministic documentation and verifier evidence.",
    [
      "pnpm storage:backup:acceptance",
      "docs/DATABASE_STORAGE_BACKUP_RESTORE.md"
    ]
  ),
  verified(
    "restore-process",
    "cloud-security",
    "Restore process is documented as a deterministic readiness gate; live restore remains separate.",
    [
      "docs/DATABASE_STORAGE_BACKUP_RESTORE.md",
      "docs/examples/storage-backup-readiness-report.sample.json"
    ]
  ),
  verified(
    "retention-policies",
    "privacy",
    "Data-class retention/deletion metadata and report cleanup paths have deterministic proof.",
    [
      "docs/adr/0019-data-retention-deletion.md",
      "services/api/test/contracts.test.ts",
      "pnpm object-storage:acceptance"
    ]
  ),
  verified(
    "privacy-policy-draft",
    "legal",
    "Privacy policy draft exists and is marked for legal review.",
    ["docs/PRIVACY_POLICY.md"]
  ),
  verified(
    "terms-of-service-draft",
    "legal",
    "Terms of service draft exists and is marked for legal review.",
    ["docs/TERMS_OF_SERVICE.md"]
  ),
  verified(
    "dpa-draft",
    "legal",
    "DPA draft exists and is marked for legal review.",
    ["docs/DPA.md"]
  ),
  verified(
    "vulnerability-disclosure-draft",
    "legal",
    "Vulnerability disclosure draft exists and is marked for security/legal review.",
    ["docs/VULNERABILITY_DISCLOSURE.md", "SECURITY.md"]
  ),
  blockedExternal(
    "legal-security-review",
    "legal",
    "Legal/security approval is mandatory before public release.",
    [
      "Obtain legal approval for LICENSE, NOTICE, CONTRIBUTING, SECURITY, privacy, terms, DPA, and disclosure docs."
    ]
  ),
  blockedExternal(
    "production-security-review",
    "external-audit",
    "Deployed production security review is mandatory before cloud release.",
    [
      "Review live AWS, dashboard, API, worker, logs, telemetry, OAuth, billing, and tenant isolation evidence."
    ]
  )
];

export function createSecurityPrivacyGateReport(
  controls: readonly SecurityPrivacyControl[] = deterministicControls
): SecurityPrivacyGateReport {
  const verifiedCount = controls.filter(
    (control) => control.status === "verified"
  ).length;
  const blockedCount = controls.length - verifiedCount;
  const releaseBlockerCount = controls.filter(
    (control) => control.releaseBlocker
  ).length;
  return {
    summary: {
      controlCount: controls.length,
      verifiedCount,
      blockedCount,
      releaseBlockerCount,
      status:
        releaseBlockerCount === 0 ? "deterministic-proof-complete" : "blocked"
    },
    controls
  };
}

export function createPrivacyRequestPlan(input: {
  kind: PrivacyRequestKind;
  actorPrincipalId: string;
  targetId: string;
}): PrivacyRequestPlan {
  if (input.kind === "user-data-export") {
    return {
      kind: input.kind,
      actorPrincipalId: input.actorPrincipalId,
      targetId: input.targetId,
      requiredSteps: [
        "authenticate requester",
        "authorize requester against target account",
        "collect account, organization membership, project, report, billing, and audit metadata",
        "exclude secrets and deleted payload content",
        "deliver export through an access-controlled artifact"
      ],
      retainedLegalRecords: ["billing records", "security audit logs"],
      deadlineHours: 720,
      evidence:
        "User data export plan preserves legal records and excludes secrets."
    };
  }

  if (input.kind === "account-deletion") {
    return {
      kind: input.kind,
      actorPrincipalId: input.actorPrincipalId,
      targetId: input.targetId,
      requiredSteps: [
        "authenticate requester",
        "verify account ownership",
        "remove active sessions and OAuth connections",
        "anonymize personal profile data",
        "retain legally required billing and audit records"
      ],
      retainedLegalRecords: ["billing records", "security audit logs"],
      deadlineHours: 720,
      evidence:
        "Account deletion plan removes active personal data while retaining required records."
    };
  }

  return {
    kind: input.kind,
    actorPrincipalId: input.actorPrincipalId,
    targetId: input.targetId,
    requiredSteps: [
      "authenticate requester",
      "verify organization owner role",
      "start deletion job within 24 hours",
      "revoke OAuth connections and delete vault secrets",
      "delete or anonymize active tenant data within 30 days",
      "ensure backups expire without restoring deleted tenants into active service"
    ],
    retainedLegalRecords: ["billing records", "security audit logs"],
    deadlineHours: 720,
    evidence:
      "Organization deletion plan follows ADR-0019 deletion timing and audit boundaries."
  };
}

export function executePrivacyRequestPlan(
  plan: PrivacyRequestPlan
): PrivacyRequestExecution {
  const audit = createPrivacyAuditEvidence(plan);
  if (plan.kind === "user-data-export") {
    return {
      kind: plan.kind,
      status: "export-ready",
      artifact: {
        format: "application/json",
        access: "tenant-scoped-signed-artifact",
        sections: [
          "account-profile",
          "organization-memberships",
          "projects",
          "environments",
          "diagnostic-summaries",
          "reports",
          "billing-records",
          "audit-log-summary"
        ],
        excluded: [
          "oauth-token-values",
          "api-keys",
          "database-urls",
          "deleted-payload-content",
          "signed-url-query-strings"
        ]
      },
      audit
    };
  }

  if (plan.kind === "account-deletion") {
    return {
      kind: plan.kind,
      status: "deletion-complete",
      actions: [
        "active sessions revoked",
        "OAuth connections revoked",
        "vault secret references deleted",
        "personal profile fields anonymized",
        "owned personal projects transferred or deleted by policy"
      ],
      anonymizedFields: ["name", "email", "avatarUrl", "loginIdentifiers"],
      retainedLegalRecords: plan.retainedLegalRecords,
      audit
    };
  }

  return {
    kind: plan.kind,
    status: "deletion-scheduled",
    job: {
      startsWithinHours: 24,
      completesWithinHours: plan.deadlineHours,
      cleanupActions: [
        "disable organization access",
        "revoke organization OAuth connections",
        "delete vault secrets",
        "delete or anonymize tenant metadata",
        "schedule report and crawl artifact deletion",
        "allow backups to expire without active restore"
      ]
    },
    retainedLegalRecords: plan.retainedLegalRecords,
    audit
  };
}

export function executePrivacyRequest(input: {
  kind: PrivacyRequestKind;
  actorPrincipalId: string;
  targetId: string;
}): PrivacyRequestExecution {
  return executePrivacyRequestPlan(createPrivacyRequestPlan(input));
}

export function createSecurityDisclosurePolicy(): SecurityDisclosurePolicy {
  return {
    intake: "private-owner-before-release",
    publicIssuesAllowed: false,
    sensitiveIssueTypes: [
      "OAuth tokens",
      "API keys",
      "database URLs",
      "private customer data",
      "tenant isolation bypass",
      "crawler SSRF",
      "billing or entitlement bypass"
    ],
    legalReviewRequired: true,
    evidence:
      "Before public release, vulnerability reports remain private to the project owner and public issue filing is prohibited for sensitive findings."
  };
}

function createPrivacyAuditEvidence(
  plan: PrivacyRequestPlan
): PrivacyRequestAuditEvidence {
  return {
    action: `privacy.${plan.kind}.executed`,
    actorPrincipalId: plan.actorPrincipalId,
    targetId: plan.targetId,
    retainedLegalRecords: plan.retainedLegalRecords,
    redacted: true
  };
}

export const securityPrivacyReleaseControls = deterministicControls;

function verified(
  id: string,
  category: SecurityPrivacyControlCategory,
  title: string,
  evidence: readonly string[]
): SecurityPrivacyControl {
  return {
    id,
    category,
    title,
    status: "verified",
    evidence,
    missing: [],
    releaseBlocker: false
  };
}

function blockedExternal(
  id: string,
  category: SecurityPrivacyControlCategory,
  title: string,
  missing: readonly string[]
): SecurityPrivacyControl {
  return {
    id,
    category,
    title,
    status: "blocked",
    evidence: [],
    missing,
    releaseBlocker: true
  };
}
