import { describe, expect, it } from "vitest";
import {
  createPrivacyRequestPlan,
  executePrivacyRequest,
  createSecurityDisclosurePolicy,
  createSecurityPrivacyGateReport,
  securityPrivacyReleaseControls
} from "../src/index.js";

describe("security and privacy release gate", () => {
  it("maps deterministic controls and preserves external release blockers", () => {
    const report = createSecurityPrivacyGateReport();

    expect(report.summary).toEqual({
      controlCount: 23,
      verifiedCount: 19,
      blockedCount: 4,
      releaseBlockerCount: 4,
      status: "blocked"
    });
    expect(securityPrivacyReleaseControls.map((control) => control.id)).toEqual(
      [
        "threat-model-review",
        "dependency-audit",
        "sast",
        "dast",
        "penetration-test",
        "ssrf-private-network",
        "xss-output-escaping",
        "csrf-request-boundary",
        "injection-attacks",
        "oauth-attacks",
        "tenant-isolation",
        "secrets-handling",
        "encryption-at-rest",
        "encryption-in-transit",
        "backup-security",
        "restore-process",
        "retention-policies",
        "privacy-policy-draft",
        "terms-of-service-draft",
        "dpa-draft",
        "vulnerability-disclosure-draft",
        "legal-security-review",
        "production-security-review"
      ]
    );
    expect(
      report.controls
        .filter((control) => control.releaseBlocker)
        .map((control) => control.id)
    ).toEqual([
      "dast",
      "penetration-test",
      "legal-security-review",
      "production-security-review"
    ]);
  });

  it("creates privacy lifecycle plans for export and deletion requests", () => {
    const exportPlan = createPrivacyRequestPlan({
      kind: "user-data-export",
      actorPrincipalId: "principal-1",
      targetId: "account-1"
    });
    const accountDeletion = createPrivacyRequestPlan({
      kind: "account-deletion",
      actorPrincipalId: "principal-1",
      targetId: "account-1"
    });
    const organizationDeletion = createPrivacyRequestPlan({
      kind: "organization-deletion",
      actorPrincipalId: "principal-1",
      targetId: "org-1"
    });

    expect(exportPlan.requiredSteps).toContain(
      "exclude secrets and deleted payload content"
    );
    expect(accountDeletion.requiredSteps).toContain(
      "remove active sessions and OAuth connections"
    );
    expect(organizationDeletion.requiredSteps).toContain(
      "start deletion job within 24 hours"
    );
    expect(organizationDeletion.requiredSteps).toContain(
      "delete or anonymize active tenant data within 30 days"
    );
    expect(
      [exportPlan, accountDeletion, organizationDeletion].every((plan) =>
        plan.retainedLegalRecords.includes("billing records")
      )
    ).toBe(true);
  });

  it("executes privacy export and deletion requests with redacted audit evidence", () => {
    const exportExecution = executePrivacyRequest({
      kind: "user-data-export",
      actorPrincipalId: "principal-1",
      targetId: "account-1"
    });
    const accountDeletion = executePrivacyRequest({
      kind: "account-deletion",
      actorPrincipalId: "principal-1",
      targetId: "account-1"
    });
    const organizationDeletion = executePrivacyRequest({
      kind: "organization-deletion",
      actorPrincipalId: "principal-1",
      targetId: "org-1"
    });

    expect(exportExecution.kind).toBe("user-data-export");
    if (exportExecution.kind !== "user-data-export") {
      throw new Error("Expected user-data-export execution.");
    }
    expect(exportExecution.status).toBe("export-ready");
    expect(exportExecution.artifact.sections).toContain("billing-records");
    expect(exportExecution.artifact.excluded).toContain("oauth-token-values");
    expect(exportExecution.artifact.excluded).toContain("database-urls");
    expect(exportExecution.audit.redacted).toBe(true);

    expect(accountDeletion.kind).toBe("account-deletion");
    if (accountDeletion.kind !== "account-deletion") {
      throw new Error("Expected account-deletion execution.");
    }
    expect(accountDeletion.status).toBe("deletion-complete");
    expect(accountDeletion.actions).toContain("OAuth connections revoked");
    expect(accountDeletion.anonymizedFields).toContain("email");
    expect(accountDeletion.audit.action).toBe(
      "privacy.account-deletion.executed"
    );

    expect(organizationDeletion.kind).toBe("organization-deletion");
    if (organizationDeletion.kind !== "organization-deletion") {
      throw new Error("Expected organization-deletion execution.");
    }
    expect(organizationDeletion.status).toBe("deletion-scheduled");
    expect(organizationDeletion.job.startsWithinHours).toBe(24);
    expect(organizationDeletion.job.cleanupActions).toContain(
      "delete vault secrets"
    );
    expect(organizationDeletion.job.cleanupActions).toContain(
      "schedule report and crawl artifact deletion"
    );

    expect(
      JSON.stringify([exportExecution, accountDeletion, organizationDeletion])
    ).not.toMatch(/ya29\.|sk_live|postgres:\/\/|-----BEGIN PRIVATE KEY-----/);
  });

  it("keeps vulnerability disclosure private before public release", () => {
    const policy = createSecurityDisclosurePolicy();

    expect(policy).toMatchObject({
      intake: "private-owner-before-release",
      publicIssuesAllowed: false,
      legalReviewRequired: true
    });
    expect(policy.sensitiveIssueTypes).toContain("OAuth tokens");
    expect(policy.sensitiveIssueTypes).toContain("tenant isolation bypass");
    expect(policy.sensitiveIssueTypes).toContain("crawler SSRF");
  });
});
