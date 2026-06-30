import { describe, expect, it } from "vitest";

import {
  createCloudApi,
  roleHasPermission,
  CloudApiError
} from "../src/index.js";
import type {
  AuditEvent,
  BillableUsageEvent,
  CloudApiErrorCode,
  CrawlJobPayload,
  CrawlRequest,
  EntitlementDecision,
  EntitlementStore,
  Environment,
  ExternalProviderOAuthTokenExchangeResult,
  JobQueue,
  MetricEvent,
  Organization,
  OrganizationMembership,
  CloudOutboxEvent,
  Principal,
  Project,
  CloudTransactionManager,
  DashboardSnapshotPayload,
  DashboardSnapshotStore,
  DiagnosticRecord,
  DiagnosticStore,
  ExternalProviderAccountResolver,
  ExternalProviderOAuthAuthorizationUrlBuilder,
  ExternalProviderOAuthTokenExchanger,
  OutboxStore,
  OAuthConnectionRecord,
  OAuthConnectionStore,
  RelationalStore,
  SecretVault,
  UsageMeter
} from "../src/index.js";

const owner: Principal = {
  id: "principal-owner",
  externalSubject: "cognito|owner"
};
const analyst: Principal = {
  id: "principal-analyst",
  externalSubject: "cognito|analyst"
};

describe("roleHasPermission", () => {
  it("keeps client and analyst roles read-focused", () => {
    expect(roleHasPermission("client", "report:read")).toBe(true);
    expect(roleHasPermission("client", "crawl:create")).toBe(false);
    expect(roleHasPermission("analyst", "diagnostic:read")).toBe(true);
    expect(roleHasPermission("analyst", "diagnostic:write")).toBe(false);
    expect(roleHasPermission("developer", "diagnostic:write")).toBe(true);
    expect(roleHasPermission("analyst", "project:update")).toBe(false);
  });
});

describe("createCloudApi", () => {
  it("creates an organization with owner membership and audit event", async () => {
    const harness = createHarness();
    const result = await harness.api.createOrganization({
      actor: owner,
      name: "Acme"
    });

    expect(result.organization).toMatchObject({
      id: "org-1",
      name: "Acme"
    });
    expect(result.membership).toEqual({
      id: "membership-1",
      organizationId: "org-1",
      principalId: owner.id,
      role: "owner",
      createdAt: "2026-06-21T00:00:00.000Z"
    });
    expect(harness.auditEvents).toContainEqual(
      expect.objectContaining({
        action: "organization.created",
        organizationId: "org-1",
        actorPrincipalId: owner.id
      })
    );
  });

  it("requires member management permission to add users", async () => {
    const harness = createHarness();
    await seedOrganization(harness, "analyst");

    await expect(
      harness.api.addMember({
        actor: analyst,
        organizationId: "org-1",
        principalId: "principal-new",
        role: "developer"
      })
    ).rejects.toMatchObject({
      code: "FORBIDDEN"
    });
  });

  it("removes non-owner members with member-management permission and audit evidence", async () => {
    const harness = createHarness({ useTransactionManager: true });
    await seedOrganization(harness, "owner");
    await harness.api.addMember({
      actor: owner,
      organizationId: "org-1",
      principalId: "principal-dev",
      role: "developer"
    });
    harness.events.length = 0;
    harness.auditEvents.length = 0;

    await expect(
      harness.api.removeMember({
        actor: owner,
        organizationId: "org-1",
        principalId: "principal-dev"
      })
    ).resolves.toMatchObject({
      organizationId: "org-1",
      principalId: "principal-dev",
      role: "developer"
    });
    await expect(
      harness.store.getMembership("org-1", "principal-dev")
    ).resolves.toBeUndefined();
    expect(harness.auditEvents).toContainEqual(
      expect.objectContaining({
        action: "member.removed",
        organizationId: "org-1",
        actorPrincipalId: owner.id,
        targetType: "principal",
        targetId: "principal-dev"
      })
    );
    expect(harness.events).toEqual([
      "transaction:begin",
      "transaction:removeMembership",
      "transaction:audit",
      "transaction:commit"
    ]);
  });

  it("blocks unsafe member removal paths", async () => {
    const harness = createHarness();
    await seedOrganization(harness, "owner");
    await harness.api.addMember({
      actor: owner,
      organizationId: "org-1",
      principalId: "principal-analyst",
      role: "analyst"
    });

    await expect(
      harness.api.removeMember({
        actor: analyst,
        organizationId: "org-1",
        principalId: "principal-owner"
      })
    ).rejects.toMatchObject({
      code: "FORBIDDEN"
    });
    await expect(
      harness.api.removeMember({
        actor: owner,
        organizationId: "org-1",
        principalId: owner.id
      })
    ).rejects.toMatchObject({
      code: "INVALID_INPUT",
      message: "Members cannot remove their own membership."
    });
    await expect(
      harness.api.removeMember({
        actor: owner,
        organizationId: "org-1",
        principalId: "principal-missing"
      })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Membership was not found."
    });
  });

  it("transfers organization ownership and demotes the previous owner with audit evidence", async () => {
    const harness = createHarness({ useTransactionManager: true });
    await harness.api.createOrganization({ actor: owner, name: "Acme" });
    await harness.api.addMember({
      actor: owner,
      organizationId: "org-1",
      principalId: "principal-admin",
      role: "admin"
    });
    harness.events.length = 0;
    harness.auditEvents.length = 0;

    await expect(
      harness.api.transferOwnership({
        actor: owner,
        organizationId: "org-1",
        newOwnerPrincipalId: "principal-admin"
      })
    ).resolves.toEqual({
      previousOwner: {
        id: "membership-1",
        organizationId: "org-1",
        principalId: owner.id,
        role: "admin",
        createdAt: "2026-06-21T00:00:00.000Z"
      },
      newOwner: {
        id: "membership-2",
        organizationId: "org-1",
        principalId: "principal-admin",
        role: "owner",
        createdAt: "2026-06-21T00:00:00.000Z"
      }
    });
    expect(harness.auditEvents).toContainEqual(
      expect.objectContaining({
        action: "ownership.transferred",
        organizationId: "org-1",
        actorPrincipalId: owner.id,
        targetType: "principal",
        targetId: "principal-admin"
      })
    );
    expect(harness.events).toEqual([
      "transaction:begin",
      "transaction:updateMembershipRole",
      "transaction:updateMembershipRole",
      "transaction:audit",
      "transaction:commit"
    ]);
  });

  it("blocks non-owner and invalid ownership transfer attempts", async () => {
    const harness = createHarness();
    await seedOrganization(harness, "admin");

    await expect(
      harness.api.transferOwnership({
        actor: analyst,
        organizationId: "org-1",
        newOwnerPrincipalId: "principal-owner"
      })
    ).rejects.toMatchObject({
      code: "FORBIDDEN"
    });
    await expect(
      harness.api.transferOwnership({
        actor: owner,
        organizationId: "org-1",
        newOwnerPrincipalId: owner.id
      })
    ).rejects.toMatchObject({
      code: "INVALID_INPUT",
      message: "New owner must be a different organization member."
    });
    await expect(
      harness.api.transferOwnership({
        actor: owner,
        organizationId: "org-1",
        newOwnerPrincipalId: "principal-missing"
      })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Membership was not found."
    });
  });

  it("creates projects and environments inside the active organization", async () => {
    const harness = createHarness();
    await seedOrganization(harness, "owner");

    const project = await harness.api.createProject({
      actor: owner,
      organizationId: "org-1",
      name: "Marketing",
      siteUrl: "https://example.com"
    });
    const environment = await harness.api.createEnvironment({
      actor: owner,
      organizationId: "org-1",
      projectId: project.id,
      name: "Production",
      baseUrl: "https://example.com"
    });

    expect(project).toMatchObject({
      id: "project-1",
      organizationId: "org-1"
    });
    expect(environment).toMatchObject({
      id: "env-1",
      projectId: "project-1"
    });
    expect(harness.auditEvents.map((event) => event.action)).toEqual([
      "organization.created",
      "project.created",
      "environment.created"
    ]);
  });

  it("returns dashboard snapshots after project-read authorization and identity checks", async () => {
    const harness = createHarness({
      dashboardSnapshot: {
        organization: { id: "org-1", name: "Acme" },
        project: { id: "project-1", name: "Marketing" },
        environment: { id: "env-1", name: "Production" },
        diagnostics: []
      }
    });
    await seedOrganization(harness, "client");
    const project = await harness.api.createProject({
      actor: owner,
      organizationId: "org-1",
      name: "Marketing",
      siteUrl: "https://example.com"
    });
    const environment = await harness.api.createEnvironment({
      actor: owner,
      organizationId: "org-1",
      projectId: project.id,
      name: "Production",
      baseUrl: "https://example.com"
    });

    await expect(
      harness.api.getDashboardSnapshot({
        actor: analyst,
        organizationId: "org-1",
        projectId: project.id,
        environmentId: environment.id
      })
    ).resolves.toEqual({
      organization: { id: "org-1", name: "Acme" },
      project: { id: "project-1", name: "Marketing" },
      environment: { id: "env-1", name: "Production" },
      diagnostics: []
    });
    expect(harness.dashboardSnapshotLoads).toEqual([
      {
        organizationId: "org-1",
        projectId: project.id,
        environmentId: environment.id
      }
    ]);
  });

  it("does not load dashboard snapshots when authorization or route identity checks fail", async () => {
    const harness = createHarness({
      dashboardSnapshot: { ok: true }
    });
    await seedOrganization(harness, "client");
    const project = await harness.api.createProject({
      actor: owner,
      organizationId: "org-1",
      name: "Marketing",
      siteUrl: "https://example.com"
    });
    const environment = await harness.api.createEnvironment({
      actor: owner,
      organizationId: "org-1",
      projectId: project.id,
      name: "Production",
      baseUrl: "https://example.com"
    });

    await expect(
      harness.api.getDashboardSnapshot({
        actor: analyst,
        organizationId: "org-missing",
        projectId: project.id,
        environmentId: environment.id
      })
    ).rejects.toMatchObject({
      code: "FORBIDDEN"
    });

    await expect(
      harness.api.getDashboardSnapshot({
        actor: analyst,
        organizationId: "org-1",
        projectId: "project-missing",
        environmentId: environment.id
      })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Project was not found."
    });

    await expect(
      harness.api.getDashboardSnapshot({
        actor: analyst,
        organizationId: "org-1",
        projectId: project.id,
        environmentId: "env-missing"
      })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Environment was not found."
    });
    expect(harness.dashboardSnapshotLoads).toEqual([]);
  });

  it("returns deterministic errors when dashboard snapshot storage is missing or empty", async () => {
    const harness = createHarness();
    await seedOrganization(harness, "owner");
    const project = await harness.api.createProject({
      actor: owner,
      organizationId: "org-1",
      name: "Marketing",
      siteUrl: "https://example.com"
    });
    const environment = await harness.api.createEnvironment({
      actor: owner,
      organizationId: "org-1",
      projectId: project.id,
      name: "Production",
      baseUrl: "https://example.com"
    });

    await expect(
      harness.api.getDashboardSnapshot({
        actor: owner,
        organizationId: "org-1",
        projectId: project.id,
        environmentId: environment.id
      })
    ).rejects.toMatchObject({
      code: "INVALID_INPUT",
      message: "Dashboard snapshot store is not configured."
    });

    const emptyHarness = createHarness({ dashboardSnapshot: undefined });
    await seedOrganization(emptyHarness, "owner");
    const emptyProject = await emptyHarness.api.createProject({
      actor: owner,
      organizationId: "org-1",
      name: "Marketing",
      siteUrl: "https://example.com"
    });
    const emptyEnvironment = await emptyHarness.api.createEnvironment({
      actor: owner,
      organizationId: "org-1",
      projectId: emptyProject.id,
      name: "Production",
      baseUrl: "https://example.com"
    });

    await expect(
      emptyHarness.api.getDashboardSnapshot({
        actor: owner,
        organizationId: "org-1",
        projectId: emptyProject.id,
        environmentId: emptyEnvironment.id
      })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Dashboard snapshot was not found."
    });
  });

  it("checks entitlements before queueing crawl work", async () => {
    const harness = createHarness({
      entitlementDecision: {
        allowed: false,
        reason: "monthly crawl URL quota exceeded"
      }
    });
    await seedOrganization(harness, "owner");
    const project = await harness.api.createProject({
      actor: owner,
      organizationId: "org-1",
      name: "Marketing",
      siteUrl: "https://example.com"
    });
    const environment = await harness.api.createEnvironment({
      actor: owner,
      organizationId: "org-1",
      projectId: project.id,
      name: "Production",
      baseUrl: "https://example.com"
    });

    await expect(
      harness.api.requestCrawl({
        actor: owner,
        organizationId: "org-1",
        projectId: project.id,
        environmentId: environment.id,
        maxUrls: 100_001
      })
    ).rejects.toMatchObject({
      code: "ENTITLEMENT_DENIED",
      message: "monthly crawl URL quota exceeded"
    });
    expect(harness.queuedCrawls).toEqual([]);
  });

  it("rejects invalid crawl limits before entitlement and queue side effects", async () => {
    const harness = createHarness();
    await seedOrganization(harness, "owner");
    const project = await harness.api.createProject({
      actor: owner,
      organizationId: "org-1",
      name: "Marketing",
      siteUrl: "https://example.com"
    });
    const environment = await harness.api.createEnvironment({
      actor: owner,
      organizationId: "org-1",
      projectId: project.id,
      name: "Production",
      baseUrl: "https://example.com"
    });

    await expect(
      harness.api.requestCrawl({
        actor: owner,
        organizationId: "org-1",
        projectId: project.id,
        environmentId: environment.id,
        maxUrls: 0
      })
    ).rejects.toMatchObject({
      code: "INVALID_INPUT",
      message: "maxUrls must be a positive integer."
    });
    expect(harness.entitlementChecks).toBe(0);
    expect(harness.queuedCrawls).toEqual([]);
  });

  it("queues authorized crawl work and records audit plus metrics", async () => {
    const harness = createHarness();
    await seedOrganization(harness, "developer");
    const project = await harness.api.createProject({
      actor: owner,
      organizationId: "org-1",
      name: "Marketing",
      siteUrl: "https://example.com"
    });
    const environment = await harness.api.createEnvironment({
      actor: owner,
      organizationId: "org-1",
      projectId: project.id,
      name: "Production",
      baseUrl: "https://example.com"
    });

    const result = await harness.api.requestCrawl({
      actor: analyst,
      organizationId: "org-1",
      projectId: project.id,
      environmentId: environment.id,
      maxUrls: 500
    });

    expect(result).toMatchObject({
      crawlRequest: {
        id: "crawl-1",
        requestedBy: analyst.id,
        maxUrls: 500,
        status: "queued"
      },
      jobId: "job-1"
    });
    expect(harness.queuedCrawls).toEqual([
      {
        crawlRequestId: "crawl-1",
        organizationId: "org-1",
        projectId: "project-1",
        environmentId: "env-1",
        maxUrls: 500
      }
    ]);
    expect(harness.metricEvents).toContainEqual(
      expect.objectContaining({
        name: "crawl.requested",
        organizationId: "org-1",
        value: 1,
        dimensions: {
          projectId: "project-1",
          environmentId: "env-1"
        }
      })
    );
  });

  it("records billable crawl URL usage after creating crawl work", async () => {
    const harness = createHarness({
      entitlementDecision: {
        allowed: true,
        billableUsage: {
          counterName: "crawl.urls",
          amount: 500,
          periodStart: "2026-06-01T00:00:00.000Z",
          periodEnd: "2026-07-01T00:00:00.000Z"
        }
      },
      useTransactionManager: true
    });
    await seedOrganization(harness, "developer");
    const project = await harness.api.createProject({
      actor: owner,
      organizationId: "org-1",
      name: "Marketing",
      siteUrl: "https://example.com"
    });
    const environment = await harness.api.createEnvironment({
      actor: owner,
      organizationId: "org-1",
      projectId: project.id,
      name: "Production",
      baseUrl: "https://example.com"
    });
    harness.events.length = 0;

    await harness.api.requestCrawl({
      actor: analyst,
      organizationId: "org-1",
      projectId: project.id,
      environmentId: environment.id,
      maxUrls: 500
    });

    expect(harness.usageEvents).toEqual([
      {
        id: "usage-1",
        organizationId: "org-1",
        counterName: "crawl.urls",
        idempotencyKey: "crawl-1",
        amount: 500,
        periodStart: "2026-06-01T00:00:00.000Z",
        periodEnd: "2026-07-01T00:00:00.000Z",
        occurredAt: "2026-06-21T00:00:00.000Z",
        source: "crawl.requested",
        subjectType: "crawlRequest",
        subjectId: "crawl-1"
      }
    ]);
    expect(harness.events).toEqual([
      "transaction:begin",
      "transaction:createCrawlRequest",
      "transaction:audit",
      "transaction:metric",
      "transaction:usage",
      "transaction:commit",
      "queue:enqueue"
    ]);
  });

  it("records external API inspection usage with caller-provided idempotency", async () => {
    const harness = createHarness({
      entitlementDecision: {
        allowed: true,
        billableUsage: {
          counterName: "external_api.inspections",
          amount: 3,
          periodStart: "2026-06-01T00:00:00.000Z",
          periodEnd: "2026-07-01T00:00:00.000Z"
        }
      },
      useTransactionManager: true
    });
    await seedOrganization(harness, "admin");
    harness.events.length = 0;

    await expect(
      harness.api.recordExternalApiInspectionUsage({
        actor: analyst,
        organizationId: "org-1",
        provider: "google",
        inspections: 3,
        idempotencyKey: "gsc:url-inspection:example",
        subjectId: "https://example.com/"
      })
    ).resolves.toEqual({
      recorded: true,
      idempotencyKey: "gsc:url-inspection:example"
    });

    expect(harness.usageEvents).toEqual([
      {
        id: "usage-1",
        organizationId: "org-1",
        counterName: "external_api.inspections",
        idempotencyKey: "gsc:url-inspection:example",
        amount: 3,
        periodStart: "2026-06-01T00:00:00.000Z",
        periodEnd: "2026-07-01T00:00:00.000Z",
        occurredAt: "2026-06-21T00:00:00.000Z",
        source: "external_api.inspection",
        subjectType: "google.externalApiInspection",
        subjectId: "https://example.com/"
      }
    ]);
    expect(harness.metricEvents).toContainEqual(
      expect.objectContaining({
        name: "external_api.inspection.recorded",
        value: 3,
        dimensions: {
          provider: "google",
          subjectId: "https://example.com/"
        }
      })
    );
    expect(harness.events).toEqual([
      "transaction:begin",
      "transaction:usage",
      "transaction:metric",
      "transaction:commit"
    ]);
  });

  it("records crawl diagnostics after authorization and crawl identity checks", async () => {
    const harness = createHarness({ useTransactionManager: true });
    await seedOrganization(harness, "developer");
    const project = await harness.api.createProject({
      actor: owner,
      organizationId: "org-1",
      name: "Marketing",
      siteUrl: "https://example.com"
    });
    const environment = await harness.api.createEnvironment({
      actor: owner,
      organizationId: "org-1",
      projectId: project.id,
      name: "Production",
      baseUrl: "https://example.com"
    });
    const { crawlRequest } = await harness.api.requestCrawl({
      actor: analyst,
      organizationId: "org-1",
      projectId: project.id,
      environmentId: environment.id,
      maxUrls: 50
    });
    harness.events.length = 0;
    harness.auditEvents.length = 0;
    harness.metricEvents.length = 0;

    await expect(
      harness.api.recordCrawlDiagnostics({
        actor: analyst,
        organizationId: "org-1",
        projectId: project.id,
        environmentId: environment.id,
        crawlRequestId: crawlRequest.id,
        diagnostics: [
          {
            ruleId: "SL-META-001",
            severity: "error",
            confidence: "certain",
            pageUrl: "https://example.com/",
            route: "/",
            source: "crawler",
            title: "Missing title",
            evidence: "The rendered page does not contain a title element.",
            expected: "A non-empty title element",
            actual: "No title element",
            sourceLocation: {
              selector: "head > title",
              confidence: "exact"
            },
            structuredEvidence: [{ kind: "selector", selector: "title" }],
            observedAt: "2026-06-21T00:00:30.000Z",
            fingerprint: "diagnostic:fingerprint"
          }
        ]
      })
    ).resolves.toEqual({
      recorded: 1,
      crawlRequestId: "crawl-1"
    });

    expect(harness.diagnosticRecords).toEqual([
      expect.objectContaining({
        id: "diagnostic-1",
        organizationId: "org-1",
        projectId: project.id,
        environmentId: environment.id,
        crawlRequestId: crawlRequest.id,
        ruleId: "SL-META-001",
        severity: "error",
        confidence: "certain",
        pageUrl: "https://example.com/",
        route: "/",
        source: "crawler",
        title: "Missing title",
        evidence: "The rendered page does not contain a title element.",
        expected: "A non-empty title element",
        actual: "No title element",
        sourceLocation: {
          selector: "head > title",
          confidence: "exact"
        },
        structuredEvidence: [{ kind: "selector", selector: "title" }],
        observedAt: "2026-06-21T00:00:30.000Z",
        fingerprint: "diagnostic:fingerprint",
        deletionState: "active",
        createdAt: "2026-06-21T00:00:00.000Z"
      })
    ]);
    expect(harness.auditEvents).toContainEqual(
      expect.objectContaining({
        action: "diagnostics.ingested",
        targetType: "crawlRequest",
        targetId: crawlRequest.id
      })
    );
    expect(harness.metricEvents).toContainEqual(
      expect.objectContaining({
        name: "diagnostics.ingested",
        value: 1,
        dimensions: {
          projectId: project.id,
          environmentId: environment.id,
          crawlRequestId: crawlRequest.id
        }
      })
    );
    expect(harness.events).toEqual([
      "transaction:begin",
      "transaction:diagnostic",
      "transaction:audit",
      "transaction:metric",
      "transaction:commit"
    ]);
  });

  it("accepts empty crawl diagnostic batches without diagnostic writes", async () => {
    const harness = createHarness();
    await seedOrganization(harness, "developer");
    const context = await createAuthorizationContext(harness);

    await expect(
      harness.api.recordCrawlDiagnostics({
        actor: analyst,
        organizationId: "org-1",
        projectId: context.projectId,
        environmentId: context.environmentId,
        crawlRequestId: context.crawlRequestId,
        diagnostics: []
      })
    ).resolves.toEqual({
      recorded: 0,
      crawlRequestId: context.crawlRequestId
    });

    expect(harness.diagnosticRecords).toEqual([]);
  });

  it("rejects crawl diagnostics with mismatched crawl identity before writes", async () => {
    const harness = createHarness();
    await seedOrganization(harness, "developer");
    const context = await createAuthorizationContext(harness);

    await expect(
      harness.api.recordCrawlDiagnostics({
        actor: analyst,
        organizationId: "org-1",
        projectId: context.projectId,
        environmentId: context.environmentId,
        crawlRequestId: "crawl-missing",
        diagnostics: [validDiagnosticInput()]
      })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Crawl request was not found."
    });

    expect(harness.diagnosticRecords).toEqual([]);
  });

  it("rejects invalid crawl diagnostics before writes", async () => {
    const harness = createHarness();
    await seedOrganization(harness, "developer");
    const context = await createAuthorizationContext(harness);

    await expect(
      harness.api.recordCrawlDiagnostics({
        actor: analyst,
        organizationId: "org-1",
        projectId: context.projectId,
        environmentId: context.environmentId,
        crawlRequestId: context.crawlRequestId,
        diagnostics: [
          {
            ...validDiagnosticInput(),
            severity: "critical"
          } as never
        ]
      })
    ).rejects.toMatchObject({
      code: "INVALID_INPUT",
      message:
        "diagnostics[0].severity must be a SearchLint diagnostic severity."
    });

    expect(harness.diagnosticRecords).toEqual([]);
  });

  it("returns a deterministic error when diagnostic storage is missing", async () => {
    const harness = createHarness({ useDiagnosticStore: false });
    await seedOrganization(harness, "developer");
    const context = await createAuthorizationContext(harness);

    await expect(
      harness.api.recordCrawlDiagnostics({
        actor: analyst,
        organizationId: "org-1",
        projectId: context.projectId,
        environmentId: context.environmentId,
        crawlRequestId: context.crawlRequestId,
        diagnostics: [validDiagnosticInput()]
      })
    ).rejects.toMatchObject({
      code: "INVALID_INPUT",
      message: "Diagnostic store is not configured."
    });
  });

  it("denies external API inspection usage before recording usage", async () => {
    const harness = createHarness({
      entitlementDecision: {
        allowed: false,
        reason: "google external API inspection quota exceeded"
      }
    });
    await seedOrganization(harness, "admin");

    await expect(
      harness.api.recordExternalApiInspectionUsage({
        actor: analyst,
        organizationId: "org-1",
        provider: "google",
        inspections: 1,
        idempotencyKey: "quota-denied",
        subjectId: "https://example.com/"
      })
    ).rejects.toMatchObject({
      code: "ENTITLEMENT_DENIED",
      message: "google external API inspection quota exceeded"
    });
    expect(harness.usageEvents).toEqual([]);
  });

  it("rejects invalid external API inspection usage before entitlement checks", async () => {
    const harness = createHarness();
    await seedOrganization(harness, "admin");

    await expect(
      harness.api.recordExternalApiInspectionUsage({
        actor: analyst,
        organizationId: "org-1",
        provider: "yandex",
        inspections: 0,
        idempotencyKey: "invalid",
        subjectId: "https://example.com/"
      })
    ).rejects.toMatchObject({
      code: "INVALID_INPUT",
      message: "inspections must be a positive integer."
    });
    expect(harness.entitlementChecks).toBe(0);
  });

  it("completes external provider OAuth connections without persisting raw token values", async () => {
    const harness = createHarness({ useTransactionManager: true });
    await seedOrganization(harness, "admin");
    const project = await harness.api.createProject({
      actor: owner,
      organizationId: "org-1",
      name: "Marketing",
      siteUrl: "https://example.com"
    });
    const environment = await harness.api.createEnvironment({
      actor: owner,
      organizationId: "org-1",
      projectId: project.id,
      name: "Production",
      baseUrl: "https://example.com"
    });
    harness.events.length = 0;

    const result = await harness.api.completeExternalProviderOAuthConnection({
      actor: analyst,
      organizationId: "org-1",
      projectId: project.id,
      environmentId: environment.id,
      provider: "google",
      code: "authorization-code",
      redirectUri: "https://app.searchlint.example/oauth/google/callback",
      codeVerifier: "pkce-verifier",
      scopes: ["scope-b", "scope-a", "scope-a"]
    });

    expect(harness.oauthTokenExchanges).toEqual([
      {
        organizationId: "org-1",
        projectId: project.id,
        environmentId: environment.id,
        provider: "google",
        code: "authorization-code",
        redirectUri: "https://app.searchlint.example/oauth/google/callback",
        codeVerifier: "pkce-verifier"
      }
    ]);
    expect(harness.providerAccountResolutions).toEqual([
      {
        organizationId: "org-1",
        projectId: project.id,
        environmentId: environment.id,
        provider: "google",
        accessToken: "provider-access-token"
      }
    ]);
    expect(harness.secretWrites).toEqual([
      {
        organizationId: "org-1",
        key: "project-1/env-1/external-providers/google/oauth-1/access-token",
        value: "provider-access-token"
      },
      {
        organizationId: "org-1",
        key: "project-1/env-1/external-providers/google/oauth-1/refresh-token",
        value: "provider-refresh-token"
      }
    ]);
    expect(result.oauthConnection).toEqual({
      id: "oauth-1",
      organizationId: "org-1",
      projectId: project.id,
      environmentId: environment.id,
      provider: "google",
      providerAccountId: "google-account-1",
      scopes: ["scope-a", "scope-b"],
      accessTokenSecretRef:
        "secret://org-1/project-1/env-1/external-providers/google/oauth-1/access-token",
      refreshTokenSecretRef:
        "secret://org-1/project-1/env-1/external-providers/google/oauth-1/refresh-token",
      expiresAt: "2026-06-21T01:00:00.000Z",
      lastRefreshAt: "2026-06-21T00:00:00.000Z",
      status: "active",
      deletionState: "active",
      createdAt: "2026-06-21T00:00:00.000Z"
    });
    expect(JSON.stringify(harness.oauthConnections)).not.toContain(
      "provider-access-token"
    );
    expect(JSON.stringify(harness.auditEvents)).not.toContain(
      "provider-refresh-token"
    );
    expect(JSON.stringify(harness.metricEvents)).not.toContain(
      "provider-access-token"
    );
    expect(harness.events).toEqual([
      "oauth:exchange",
      "oauth:resolve-account",
      "vault:put",
      "vault:put",
      "transaction:begin",
      "transaction:oauthConnection",
      "transaction:audit",
      "transaction:metric",
      "transaction:commit"
    ]);
  });

  it("revokes external provider OAuth connections and deletes token secrets with audit evidence", async () => {
    const harness = createHarness({ useTransactionManager: true });
    await seedOrganization(harness, "admin");
    const project = await harness.api.createProject({
      actor: owner,
      organizationId: "org-1",
      name: "Marketing",
      siteUrl: "https://example.com"
    });
    const environment = await harness.api.createEnvironment({
      actor: owner,
      organizationId: "org-1",
      projectId: project.id,
      name: "Production",
      baseUrl: "https://example.com"
    });
    await harness.api.completeExternalProviderOAuthConnection({
      actor: analyst,
      organizationId: "org-1",
      projectId: project.id,
      environmentId: environment.id,
      provider: "google",
      code: "authorization-code",
      redirectUri: "https://app.searchlint.example/oauth/google/callback",
      scopes: ["scope-a"]
    });
    harness.events.length = 0;
    harness.auditEvents.length = 0;
    harness.metricEvents.length = 0;

    await expect(
      harness.api.revokeExternalProviderOAuthConnection({
        actor: analyst,
        organizationId: "org-1",
        projectId: project.id,
        environmentId: environment.id,
        provider: "google"
      })
    ).resolves.toEqual({
      oauthConnection: expect.objectContaining({
        id: "oauth-1",
        status: "revoked",
        deletionState: "deleted"
      })
    });

    expect(harness.secretDeletes).toEqual([
      {
        organizationId: "org-1",
        secretRef:
          "secret://org-1/project-1/env-1/external-providers/google/oauth-1/access-token"
      },
      {
        organizationId: "org-1",
        secretRef:
          "secret://org-1/project-1/env-1/external-providers/google/oauth-1/refresh-token"
      }
    ]);
    expect(harness.auditEvents).toContainEqual(
      expect.objectContaining({
        action: "oauth_connection.revoked",
        organizationId: "org-1",
        actorPrincipalId: analyst.id,
        targetType: "oauthConnection",
        targetId: "oauth-1"
      })
    );
    expect(harness.metricEvents).toContainEqual(
      expect.objectContaining({
        name: "oauth_connection.revoked",
        value: 1,
        dimensions: {
          projectId: project.id,
          environmentId: environment.id,
          provider: "google"
        }
      })
    );
    expect(JSON.stringify(harness.auditEvents)).not.toContain(
      "provider-refresh-token"
    );
    expect(JSON.stringify(harness.metricEvents)).not.toContain(
      "provider-access-token"
    );
    expect(harness.events).toEqual([
      "vault:delete",
      "vault:delete",
      "transaction:begin",
      "transaction:oauthConnectionRevoked",
      "transaction:audit",
      "transaction:metric",
      "transaction:commit"
    ]);
  });

  it("rejects external provider OAuth revocation before secret deletion when identity checks fail", async () => {
    const harness = createHarness();
    await seedOrganization(harness, "admin");

    await expect(
      harness.api.revokeExternalProviderOAuthConnection({
        actor: analyst,
        organizationId: "org-1",
        projectId: "project-missing",
        environmentId: "env-1",
        provider: "google"
      })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Project was not found."
    });
    expect(harness.secretDeletes).toEqual([]);
  });

  it("denies external provider OAuth revocation without connector management permission", async () => {
    const harness = createHarness();
    await seedOrganization(harness, "analyst");

    await expect(
      harness.api.revokeExternalProviderOAuthConnection({
        actor: analyst,
        organizationId: "org-1",
        projectId: "project-1",
        environmentId: "env-1",
        provider: "google"
      })
    ).rejects.toMatchObject({
      code: "FORBIDDEN"
    });
    expect(harness.secretDeletes).toEqual([]);
  });

  it("starts external provider OAuth authorization without token or vault side effects", async () => {
    const harness = createHarness();
    await seedOrganization(harness, "admin");
    const project = await harness.api.createProject({
      actor: owner,
      organizationId: "org-1",
      name: "Marketing",
      siteUrl: "https://example.com"
    });
    const environment = await harness.api.createEnvironment({
      actor: owner,
      organizationId: "org-1",
      projectId: project.id,
      name: "Production",
      baseUrl: "https://example.com"
    });
    harness.events.length = 0;

    const result = await harness.api.startExternalProviderOAuthConnection({
      actor: analyst,
      organizationId: "org-1",
      projectId: project.id,
      environmentId: environment.id,
      provider: "google",
      state: "state-123",
      redirectUri: "https://app.searchlint.example/oauth/google/callback",
      scopes: ["scope-b", "scope-a", "scope-a"],
      codeChallenge: "pkce-challenge"
    });

    expect(harness.authorizationUrlBuilds).toEqual([
      {
        organizationId: "org-1",
        projectId: project.id,
        environmentId: environment.id,
        provider: "google",
        state: "state-123",
        redirectUri: "https://app.searchlint.example/oauth/google/callback",
        scopes: ["scope-b", "scope-a", "scope-a"],
        pkce: {
          codeChallenge: "pkce-challenge",
          method: "S256"
        }
      }
    ]);
    expect(result).toEqual({
      provider: "google",
      authorizationUrl:
        "https://provider.example/google/authorize?state=state-123&client_id=google-client",
      state: "state-123",
      redirectUri: "https://app.searchlint.example/oauth/google/callback",
      scopes: ["scope-a", "scope-b"],
      pkceRequired: true
    });
    expect(harness.oauthTokenExchanges).toEqual([]);
    expect(harness.providerAccountResolutions).toEqual([]);
    expect(harness.secretWrites).toEqual([]);
    expect(harness.oauthConnections).toEqual([]);
    expect(harness.events).toEqual(["oauth:authorize"]);
  });

  it("rejects external provider OAuth authorization start before URL generation when identity checks fail", async () => {
    const harness = createHarness();
    await seedOrganization(harness, "admin");
    const project = await harness.api.createProject({
      actor: owner,
      organizationId: "org-1",
      name: "Marketing",
      siteUrl: "https://example.com"
    });

    await expect(
      harness.api.startExternalProviderOAuthConnection({
        actor: analyst,
        organizationId: "org-1",
        projectId: project.id,
        environmentId: "env-missing",
        provider: "yandex",
        state: "state-123"
      })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Environment was not found."
    });
    expect(harness.authorizationUrlBuilds).toEqual([]);
  });

  it("rejects external provider OAuth completion before token exchange when identity checks fail", async () => {
    const harness = createHarness();
    await seedOrganization(harness, "admin");
    const project = await harness.api.createProject({
      actor: owner,
      organizationId: "org-1",
      name: "Marketing",
      siteUrl: "https://example.com"
    });

    await expect(
      harness.api.completeExternalProviderOAuthConnection({
        actor: analyst,
        organizationId: "org-1",
        projectId: project.id,
        environmentId: "env-missing",
        provider: "yandex",
        code: "authorization-code",
        redirectUri: "https://app.searchlint.example/oauth/yandex/callback",
        scopes: ["yandex.webmaster"]
      })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Environment was not found."
    });
    expect(harness.oauthTokenExchanges).toEqual([]);
    expect(harness.secretWrites).toEqual([]);
    expect(harness.oauthConnections).toEqual([]);
  });

  it("returns deterministic OAuth connection errors for missing ports and refresh tokens", async () => {
    const missingHarness = createHarness({
      useOAuthConnectionStore: false
    });
    await seedOrganization(missingHarness, "admin");

    await expect(
      missingHarness.api.completeExternalProviderOAuthConnection({
        actor: analyst,
        organizationId: "org-1",
        projectId: "project-1",
        environmentId: "env-1",
        provider: "google",
        code: "authorization-code",
        redirectUri: "https://app.searchlint.example/oauth/google/callback",
        scopes: ["scope-a"]
      })
    ).rejects.toMatchObject({
      code: "INVALID_INPUT",
      message: "OAuth connection store is not configured."
    });

    const noRefreshHarness = createHarness({
      tokenExchangeResult: {
        accessToken: "provider-access-token",
        scopes: ["scope-a"]
      }
    });
    await seedOrganization(noRefreshHarness, "admin");
    const project = await noRefreshHarness.api.createProject({
      actor: owner,
      organizationId: "org-1",
      name: "Marketing",
      siteUrl: "https://example.com"
    });
    const environment = await noRefreshHarness.api.createEnvironment({
      actor: owner,
      organizationId: "org-1",
      projectId: project.id,
      name: "Production",
      baseUrl: "https://example.com"
    });

    await expect(
      noRefreshHarness.api.completeExternalProviderOAuthConnection({
        actor: analyst,
        organizationId: "org-1",
        projectId: project.id,
        environmentId: environment.id,
        provider: "google",
        code: "authorization-code",
        redirectUri: "https://app.searchlint.example/oauth/google/callback",
        scopes: ["scope-a"]
      })
    ).rejects.toMatchObject({
      code: "INVALID_INPUT",
      message: "refreshToken must be a non-empty string."
    });
    expect(noRefreshHarness.secretWrites).toEqual([]);
    expect(noRefreshHarness.oauthConnections).toEqual([]);
  });

  it("does not write OAuth secrets or metadata when token exchange fails", async () => {
    const harness = createHarness({
      tokenExchangeError: new Error("provider token endpoint unavailable")
    });
    await seedOrganization(harness, "admin");
    const project = await harness.api.createProject({
      actor: owner,
      organizationId: "org-1",
      name: "Marketing",
      siteUrl: "https://example.com"
    });
    const environment = await harness.api.createEnvironment({
      actor: owner,
      organizationId: "org-1",
      projectId: project.id,
      name: "Production",
      baseUrl: "https://example.com"
    });

    await expect(
      harness.api.completeExternalProviderOAuthConnection({
        actor: analyst,
        organizationId: "org-1",
        projectId: project.id,
        environmentId: environment.id,
        provider: "google",
        code: "authorization-code",
        redirectUri: "https://app.searchlint.example/oauth/google/callback",
        scopes: ["scope-a"]
      })
    ).rejects.toThrow("provider token endpoint unavailable");
    expect(harness.oauthTokenExchanges).toHaveLength(1);
    expect(harness.providerAccountResolutions).toEqual([]);
    expect(harness.secretWrites).toEqual([]);
    expect(harness.oauthConnections).toEqual([]);
  });

  it("does not persist OAuth connection metadata when vault writes fail", async () => {
    const harness = createHarness({
      failSecretWrite: true
    });
    await seedOrganization(harness, "admin");
    const project = await harness.api.createProject({
      actor: owner,
      organizationId: "org-1",
      name: "Marketing",
      siteUrl: "https://example.com"
    });
    const environment = await harness.api.createEnvironment({
      actor: owner,
      organizationId: "org-1",
      projectId: project.id,
      name: "Production",
      baseUrl: "https://example.com"
    });

    await expect(
      harness.api.completeExternalProviderOAuthConnection({
        actor: analyst,
        organizationId: "org-1",
        projectId: project.id,
        environmentId: environment.id,
        provider: "google",
        code: "authorization-code",
        redirectUri: "https://app.searchlint.example/oauth/google/callback",
        scopes: ["scope-a"]
      })
    ).rejects.toThrow("secret vault unavailable");
    expect(harness.oauthConnections).toEqual([]);
    expect(harness.auditEvents.map((event) => event.action)).not.toContain(
      "oauth_connection.completed"
    );
  });

  it("runs organization creation writes inside transaction-scoped ports", async () => {
    const harness = createHarness({ useTransactionManager: true });

    await harness.api.createOrganization({
      actor: owner,
      name: "Acme"
    });

    expect(harness.events).toEqual([
      "transaction:begin",
      "transaction:createOrganization",
      "transaction:createMembership",
      "transaction:audit",
      "transaction:commit"
    ]);
  });

  it("commits crawl request writes before queue handoff", async () => {
    const harness = createHarness({ useTransactionManager: true });
    await seedOrganization(harness, "developer");
    const project = await harness.api.createProject({
      actor: owner,
      organizationId: "org-1",
      name: "Marketing",
      siteUrl: "https://example.com"
    });
    const environment = await harness.api.createEnvironment({
      actor: owner,
      organizationId: "org-1",
      projectId: project.id,
      name: "Production",
      baseUrl: "https://example.com"
    });
    harness.events.length = 0;

    await harness.api.requestCrawl({
      actor: analyst,
      organizationId: "org-1",
      projectId: project.id,
      environmentId: environment.id,
      maxUrls: 500
    });

    expect(harness.events).toEqual([
      "transaction:begin",
      "transaction:createCrawlRequest",
      "transaction:audit",
      "transaction:metric",
      "transaction:commit",
      "queue:enqueue"
    ]);
  });

  it("persists crawl outbox events inside the transaction when configured", async () => {
    const harness = createHarness({
      useTransactionManager: true,
      useOutboxStore: true
    });
    await seedOrganization(harness, "developer");
    const project = await harness.api.createProject({
      actor: owner,
      organizationId: "org-1",
      name: "Marketing",
      siteUrl: "https://example.com"
    });
    const environment = await harness.api.createEnvironment({
      actor: owner,
      organizationId: "org-1",
      projectId: project.id,
      name: "Production",
      baseUrl: "https://example.com"
    });
    harness.events.length = 0;

    const result = await harness.api.requestCrawl({
      actor: analyst,
      organizationId: "org-1",
      projectId: project.id,
      environmentId: environment.id,
      maxUrls: 500
    });

    expect(result.jobId).toBe("outbox-1");
    expect(harness.queuedCrawls).toEqual([]);
    expect(harness.outboxEvents).toEqual([
      expect.objectContaining({
        id: "outbox-1",
        organizationId: "org-1",
        topic: "crawl.requested",
        status: "pending",
        payload: {
          crawlRequestId: "crawl-1",
          organizationId: "org-1",
          projectId: "project-1",
          environmentId: "env-1",
          maxUrls: 500
        }
      })
    ]);
    expect(harness.events).toEqual([
      "transaction:begin",
      "transaction:createCrawlRequest",
      "transaction:audit",
      "transaction:metric",
      "transaction:outbox",
      "transaction:commit"
    ]);
  });

  it("does not enqueue crawl work when the DB transaction fails", async () => {
    const harness = createHarness({ useTransactionManager: true });
    await seedOrganization(harness, "developer");
    const project = await harness.api.createProject({
      actor: owner,
      organizationId: "org-1",
      name: "Marketing",
      siteUrl: "https://example.com"
    });
    const environment = await harness.api.createEnvironment({
      actor: owner,
      organizationId: "org-1",
      projectId: project.id,
      name: "Production",
      baseUrl: "https://example.com"
    });
    harness.events.length = 0;
    harness.failNextTransaction();

    await expect(
      harness.api.requestCrawl({
        actor: analyst,
        organizationId: "org-1",
        projectId: project.id,
        environmentId: environment.id,
        maxUrls: 500
      })
    ).rejects.toThrow("transaction failed");

    expect(harness.queuedCrawls).toEqual([]);
    expect(harness.events).toEqual([
      "transaction:begin",
      "transaction:rollback"
    ]);
  });

  it("does not allow cross-organization project access", async () => {
    const harness = createHarness();
    await seedOrganization(harness, "owner");

    await expect(
      harness.api.createEnvironment({
        actor: owner,
        organizationId: "org-2",
        projectId: "project-1",
        name: "Production",
        baseUrl: "https://example.com"
      })
    ).rejects.toBeInstanceOf(CloudApiError);
  });

  it.each(authorizationMatrix())(
    "allows $operation for $role",
    async ({ operation, role, run }) => {
      const harness = createHarness({ dashboardSnapshot: { ok: true } });
      await seedOrganization(harness, role);
      const context = await createAuthorizationContext(harness);

      await expect(run(harness, context)).resolves.toBeDefined();

      if (operation === "getDashboardSnapshot") {
        expect(operationSideEffectCount(harness, operation)).toBe(0);
      } else {
        expect(
          operationSideEffectCount(harness, operation)
        ).toBeGreaterThanOrEqual(1);
      }
    }
  );

  it.each(forbiddenAuthorizationMatrix())(
    "rejects $operation for $role without side effects",
    async ({ operation, role, run }) => {
      const harness = createHarness();
      await seedOrganization(harness, role);
      const context = await createAuthorizationContext(harness);
      const before = sideEffectSnapshot(harness);

      await expect(run(harness, context)).rejects.toMatchObject({
        code: "FORBIDDEN" satisfies CloudApiErrorCode
      });

      expect(sideEffectSnapshot(harness)).toEqual(before);
    }
  );
});

type Harness = ReturnType<typeof createHarness>;

function createHarness(
  options: {
    entitlementDecision?: EntitlementDecision;
    useTransactionManager?: boolean;
    useOutboxStore?: boolean;
    useDiagnosticStore?: boolean;
    useOAuthConnectionStore?: boolean;
    tokenExchangeResult?: ExternalProviderOAuthTokenExchangeResult;
    tokenExchangeError?: Error;
    failSecretWrite?: boolean;
    dashboardSnapshot?: DashboardSnapshotPayload | undefined;
  } = {}
) {
  const store = new InMemoryStore();
  const auditEvents: AuditEvent[] = [];
  const metricEvents: MetricEvent[] = [];
  const usageEvents: BillableUsageEvent[] = [];
  const outboxEvents: CloudOutboxEvent[] = [];
  const diagnosticRecords: DiagnosticRecord[] = [];
  const oauthConnections: OAuthConnectionRecord[] = [];
  const queuedCrawls: CrawlJobPayload[] = [];
  const secretWrites: {
    organizationId: string;
    key: string;
    value: string;
  }[] = [];
  const secretDeletes: {
    organizationId: string;
    secretRef: string;
  }[] = [];
  const oauthTokenExchanges: Array<{
    organizationId: string;
    projectId: string;
    environmentId: string;
    provider: string;
    code: string;
    redirectUri: string;
    codeVerifier?: string;
  }> = [];
  const providerAccountResolutions: Array<{
    organizationId: string;
    projectId: string;
    environmentId: string;
    provider: string;
    accessToken: string;
  }> = [];
  const authorizationUrlBuilds: Parameters<
    ExternalProviderOAuthAuthorizationUrlBuilder["buildAuthorizationUrl"]
  >[0][] = [];
  const events: string[] = [];
  let failNextTransaction = false;
  let entitlementChecks = 0;
  const entitlementDecision = options.entitlementDecision ?? { allowed: true };
  const queue: JobQueue = {
    async enqueueCrawl(payload) {
      events.push("queue:enqueue");
      queuedCrawls.push(payload);
      return { jobId: `job-${queuedCrawls.length}` };
    }
  };
  const entitlements: EntitlementStore = {
    async canStartCrawl() {
      entitlementChecks += 1;
      return entitlementDecision;
    },
    async canUseExternalApiInspection() {
      entitlementChecks += 1;
      return entitlementDecision;
    }
  };
  const auditLog = {
    async append(event: AuditEvent) {
      auditEvents.push(event);
    }
  };
  const metrics = {
    async record(event: MetricEvent) {
      metricEvents.push(event);
    }
  };
  const usageMeter: UsageMeter = {
    async record(event) {
      usageEvents.push(event);
    }
  };
  const diagnostics: DiagnosticStore | undefined =
    options.useDiagnosticStore === false
      ? undefined
      : {
          async upsertDiagnostic(record) {
            const existingIndex = diagnosticRecords.findIndex(
              (candidate) =>
                candidate.organizationId === record.organizationId &&
                candidate.projectId === record.projectId &&
                candidate.environmentId === record.environmentId &&
                candidate.fingerprint === record.fingerprint
            );
            if (existingIndex === -1) {
              diagnosticRecords.push(record);
            } else {
              diagnosticRecords[existingIndex] = record;
            }
            return record;
          }
        };
  const outbox: OutboxStore | undefined =
    options.useOutboxStore === true
      ? {
          async append(event) {
            events.push("transaction:outbox");
            outboxEvents.push(event);
            return event;
          }
        }
      : undefined;
  const oauthConnectionStore: OAuthConnectionStore | undefined =
    options.useOAuthConnectionStore === false
      ? undefined
      : {
          async upsertOAuthConnection(input) {
            const existingIndex = oauthConnections.findIndex(
              (candidate) =>
                candidate.organizationId === input.organizationId &&
                candidate.projectId === input.projectId &&
                candidate.environmentId === input.environmentId &&
                candidate.provider === input.provider &&
                candidate.providerAccountId === input.providerAccountId
            );
            if (existingIndex === -1) {
              oauthConnections.push(input);
            } else {
              oauthConnections[existingIndex] = input;
            }
            return input;
          },
          async getOAuthConnection(input) {
            return oauthConnections.find(
              (candidate) =>
                candidate.organizationId === input.organizationId &&
                candidate.projectId === input.projectId &&
                candidate.environmentId === input.environmentId &&
                candidate.provider === input.provider &&
                candidate.status === "active" &&
                candidate.deletionState === "active"
            );
          },
          async selectOAuthConnectionsDueForRefresh() {
            return oauthConnections;
          },
          async markOAuthConnectionRevoked(input) {
            const existingIndex = oauthConnections.findIndex(
              (candidate) =>
                candidate.organizationId === input.organizationId &&
                candidate.id === input.id &&
                candidate.deletionState === "active"
            );
            if (existingIndex === -1) {
              return undefined;
            }
            const existing = oauthConnections[existingIndex];
            if (!existing) {
              return undefined;
            }
            const updated: OAuthConnectionRecord = {
              ...existing,
              status: "revoked",
              deletionState: "deleted"
            };
            oauthConnections[existingIndex] = updated;
            return updated;
          }
        };
  const secretVault: SecretVault | undefined =
    options.useOAuthConnectionStore === false
      ? undefined
      : {
          async putSecret(input) {
            events.push("vault:put");
            if (options.failSecretWrite === true) {
              throw new Error("secret vault unavailable");
            }
            secretWrites.push(input);
            return {
              secretRef: `secret://${input.organizationId}/${input.key}`
            };
          },
          async deleteSecret(input) {
            events.push("vault:delete");
            secretDeletes.push(input);
          }
        };
  const externalProviderOAuthTokenExchanger:
    | ExternalProviderOAuthTokenExchanger
    | undefined =
    options.useOAuthConnectionStore === false
      ? undefined
      : {
          async exchangeAuthorizationCode(input) {
            events.push("oauth:exchange");
            oauthTokenExchanges.push({
              organizationId: input.organizationId,
              projectId: input.projectId,
              environmentId: input.environmentId,
              provider: input.provider,
              code: input.code,
              redirectUri: input.redirectUri,
              ...(input.codeVerifier === undefined
                ? {}
                : { codeVerifier: input.codeVerifier })
            });
            if (options.tokenExchangeError) {
              throw options.tokenExchangeError;
            }
            return (
              options.tokenExchangeResult ?? {
                accessToken: "provider-access-token",
                refreshToken: "provider-refresh-token",
                expiresAt: "2026-06-21T01:00:00.000Z",
                scopes: ["scope-b", "scope-a"]
              }
            );
          }
        };
  const externalProviderAccountResolver:
    | ExternalProviderAccountResolver
    | undefined =
    options.useOAuthConnectionStore === false
      ? undefined
      : {
          async resolveProviderAccountId(input) {
            events.push("oauth:resolve-account");
            providerAccountResolutions.push({
              organizationId: input.organizationId,
              projectId: input.projectId,
              environmentId: input.environmentId,
              provider: input.provider,
              accessToken: input.accessToken
            });
            return {
              providerAccountId: `${input.provider}-account-1`
            };
          }
        };
  const externalProviderOAuthAuthorizationUrlBuilder: ExternalProviderOAuthAuthorizationUrlBuilder =
    {
      async buildAuthorizationUrl(input) {
        events.push("oauth:authorize");
        authorizationUrlBuilds.push(input);
        return {
          provider: input.provider,
          authorizationUrl: `https://provider.example/${input.provider}/authorize?state=${input.state}&client_id=${input.provider}-client`,
          state: input.state,
          redirectUri:
            input.redirectUri ??
            `https://app.searchlint.example/oauth/${input.provider}/callback`,
          scopes: [...new Set(input.scopes ?? ["default-scope"])].sort(),
          pkceRequired: input.pkce !== undefined
        };
      }
    };
  const dashboardSnapshotLoads: Array<{
    organizationId: string;
    projectId: string;
    environmentId: string;
  }> = [];
  const dashboardSnapshots: DashboardSnapshotStore | undefined =
    Object.prototype.hasOwnProperty.call(options, "dashboardSnapshot")
      ? {
          async getDashboardSnapshot(input) {
            dashboardSnapshotLoads.push(input);
            return options.dashboardSnapshot;
          }
        }
      : undefined;
  const transactionManager: CloudTransactionManager | undefined =
    options.useTransactionManager === true
      ? {
          async transaction(operation) {
            events.push("transaction:begin");
            try {
              if (failNextTransaction) {
                failNextTransaction = false;
                throw new Error("transaction failed");
              }
              const result = await operation({
                store: new TransactionStore(store, events),
                auditLog: {
                  async append(event) {
                    events.push("transaction:audit");
                    await auditLog.append(event);
                  }
                },
                metrics: {
                  async record(event) {
                    events.push("transaction:metric");
                    await metrics.record(event);
                  }
                },
                ...(diagnostics
                  ? {
                      diagnostics: {
                        async upsertDiagnostic(record) {
                          events.push("transaction:diagnostic");
                          return diagnostics.upsertDiagnostic(record);
                        }
                      }
                    }
                  : {}),
                usageMeter: {
                  async record(event) {
                    events.push("transaction:usage");
                    await usageMeter.record(event);
                  }
                },
                ...(outbox ? { outbox } : {}),
                ...(oauthConnectionStore
                  ? {
                      oauthConnections: {
                        async upsertOAuthConnection(input) {
                          events.push("transaction:oauthConnection");
                          return oauthConnectionStore.upsertOAuthConnection(
                            input
                          );
                        },
                        async getOAuthConnection(input) {
                          return oauthConnectionStore.getOAuthConnection(input);
                        },
                        async selectOAuthConnectionsDueForRefresh(input) {
                          return oauthConnectionStore.selectOAuthConnectionsDueForRefresh(
                            input
                          );
                        },
                        async markOAuthConnectionRevoked(input) {
                          events.push("transaction:oauthConnectionRevoked");
                          return oauthConnectionStore.markOAuthConnectionRevoked(
                            input
                          );
                        }
                      }
                    }
                  : {})
              });
              events.push("transaction:commit");
              return result;
            } catch (error) {
              events.push("transaction:rollback");
              throw error;
            }
          }
        }
      : undefined;
  const api = createCloudApi({
    store,
    queue,
    entitlements,
    auditLog,
    metrics,
    ...(diagnostics ? { diagnostics } : {}),
    ...(dashboardSnapshots ? { dashboardSnapshots } : {}),
    ...(oauthConnectionStore ? { oauthConnections: oauthConnectionStore } : {}),
    ...(secretVault ? { secretVault } : {}),
    externalProviderOAuthAuthorizationUrlBuilder,
    ...(externalProviderOAuthTokenExchanger
      ? { externalProviderOAuthTokenExchanger }
      : {}),
    ...(externalProviderAccountResolver
      ? { externalProviderAccountResolver }
      : {}),
    usageMeter,
    ...(outbox && !transactionManager ? { outbox } : {}),
    ...(transactionManager ? { transactionManager } : {}),
    clock: {
      now() {
        return "2026-06-21T00:00:00.000Z";
      }
    },
    ids: createTestIds()
  });

  return {
    api,
    store,
    auditEvents,
    metricEvents,
    usageEvents,
    outboxEvents,
    diagnosticRecords,
    oauthConnections,
    secretWrites,
    secretDeletes,
    oauthTokenExchanges,
    authorizationUrlBuilds,
    providerAccountResolutions,
    dashboardSnapshotLoads,
    queuedCrawls,
    events,
    failNextTransaction() {
      failNextTransaction = true;
    },
    get entitlementChecks() {
      return entitlementChecks;
    }
  };
}

async function seedOrganization(
  harness: Harness,
  analystRole: OrganizationMembership["role"]
): Promise<void> {
  await harness.api.createOrganization({ actor: owner, name: "Acme" });
  await harness.api.addMember({
    actor: owner,
    organizationId: "org-1",
    principalId: analyst.id,
    role: analystRole
  });
  harness.auditEvents.length = 1;
}

type AuthorizationOperation =
  | "addMember"
  | "createProject"
  | "createEnvironment"
  | "getDashboardSnapshot"
  | "requestCrawl"
  | "recordCrawlDiagnostics"
  | "completeExternalProviderOAuthConnection"
  | "recordExternalApiInspectionUsage";

type AuthorizationContext = {
  projectId: string;
  environmentId: string;
  crawlRequestId: string;
};

type AuthorizationCase = {
  operation: AuthorizationOperation;
  role: OrganizationMembership["role"];
  run(harness: Harness, context: AuthorizationContext): Promise<unknown>;
};

type AuthorizationOperationCase = Omit<AuthorizationCase, "role"> & {
  permission:
    | "member:manage"
    | "project:create"
    | "project:read"
    | "environment:create"
    | "crawl:create"
    | "diagnostic:write"
    | "connector:manage";
};

const allRoles: readonly OrganizationMembership["role"][] = [
  "owner",
  "admin",
  "developer",
  "analyst",
  "client"
];

function authorizationMatrix(): AuthorizationCase[] {
  return operationCases().flatMap((operationCase) =>
    allRoles
      .filter((role) => roleHasPermission(role, operationCase.permission))
      .map((role) => ({
        operation: operationCase.operation,
        role,
        run: operationCase.run
      }))
  );
}

function forbiddenAuthorizationMatrix(): AuthorizationCase[] {
  return operationCases().flatMap((operationCase) =>
    allRoles
      .filter((role) => !roleHasPermission(role, operationCase.permission))
      .map((role) => ({
        operation: operationCase.operation,
        role,
        run: operationCase.run
      }))
  );
}

function operationCases(): AuthorizationOperationCase[] {
  return [
    {
      operation: "addMember",
      permission: "member:manage",
      async run(harness) {
        return harness.api.addMember({
          actor: analyst,
          organizationId: "org-1",
          principalId: "principal-invitee",
          role: "client"
        });
      }
    },
    {
      operation: "createProject",
      permission: "project:create",
      async run(harness) {
        return harness.api.createProject({
          actor: analyst,
          organizationId: "org-1",
          name: "Authorization Matrix Project",
          siteUrl: "https://matrix.example.com"
        });
      }
    },
    {
      operation: "createEnvironment",
      permission: "environment:create",
      async run(harness, context) {
        return harness.api.createEnvironment({
          actor: analyst,
          organizationId: "org-1",
          projectId: context.projectId,
          name: "Authorization Matrix Environment",
          baseUrl: "https://matrix.example.com"
        });
      }
    },
    {
      operation: "requestCrawl",
      permission: "crawl:create",
      async run(harness, context) {
        return harness.api.requestCrawl({
          actor: analyst,
          organizationId: "org-1",
          projectId: context.projectId,
          environmentId: context.environmentId,
          maxUrls: 50
        });
      }
    },
    {
      operation: "recordCrawlDiagnostics",
      permission: "diagnostic:write",
      async run(harness, context) {
        return harness.api.recordCrawlDiagnostics({
          actor: analyst,
          organizationId: "org-1",
          projectId: context.projectId,
          environmentId: context.environmentId,
          crawlRequestId: context.crawlRequestId,
          diagnostics: [validDiagnosticInput()]
        });
      }
    },
    {
      operation: "getDashboardSnapshot",
      permission: "project:read",
      async run(harness, context) {
        return harness.api.getDashboardSnapshot({
          actor: analyst,
          organizationId: "org-1",
          projectId: context.projectId,
          environmentId: context.environmentId
        });
      }
    },
    {
      operation: "recordExternalApiInspectionUsage",
      permission: "connector:manage",
      async run(harness) {
        return harness.api.recordExternalApiInspectionUsage({
          actor: analyst,
          organizationId: "org-1",
          provider: "google",
          inspections: 1,
          idempotencyKey: "matrix-external-api",
          subjectId: "https://matrix.example.com/"
        });
      }
    },
    {
      operation: "completeExternalProviderOAuthConnection",
      permission: "connector:manage",
      async run(harness, context) {
        return harness.api.completeExternalProviderOAuthConnection({
          actor: analyst,
          organizationId: "org-1",
          projectId: context.projectId,
          environmentId: context.environmentId,
          provider: "google",
          code: "authorization-code",
          redirectUri: "https://app.searchlint.example/oauth/google/callback",
          scopes: ["scope-a"]
        });
      }
    }
  ];
}

async function createAuthorizationContext(
  harness: Harness
): Promise<AuthorizationContext> {
  const project = await harness.api.createProject({
    actor: owner,
    organizationId: "org-1",
    name: "Matrix Setup",
    siteUrl: "https://setup.example.com"
  });
  const environment = await harness.api.createEnvironment({
    actor: owner,
    organizationId: "org-1",
    projectId: project.id,
    name: "Matrix Setup",
    baseUrl: "https://setup.example.com"
  });
  const { crawlRequest } = await harness.api.requestCrawl({
    actor: owner,
    organizationId: "org-1",
    projectId: project.id,
    environmentId: environment.id,
    maxUrls: 50
  });
  harness.auditEvents.length = 1;
  harness.metricEvents.length = 0;
  harness.queuedCrawls.length = 0;
  harness.diagnosticRecords.length = 0;
  harness.oauthConnections.length = 0;
  harness.secretWrites.length = 0;
  return {
    projectId: project.id,
    environmentId: environment.id,
    crawlRequestId: crawlRequest.id
  };
}

function sideEffectSnapshot(harness: Harness): {
  auditEvents: number;
  metricEvents: number;
  queuedCrawls: number;
  usageEvents: number;
  diagnosticRecords: number;
  oauthConnections: number;
  secretWrites: number;
  memberships: number;
  projects: number;
  environments: number;
  crawlRequests: number;
} {
  return {
    auditEvents: harness.auditEvents.length,
    metricEvents: harness.metricEvents.length,
    queuedCrawls: harness.queuedCrawls.length,
    usageEvents: harness.usageEvents.length,
    diagnosticRecords: harness.diagnosticRecords.length,
    oauthConnections: harness.oauthConnections.length,
    secretWrites: harness.secretWrites.length,
    memberships: harness.store.memberships.size,
    projects: harness.store.projects.size,
    environments: harness.store.environments.size,
    crawlRequests: harness.store.crawlRequests.size
  };
}

function operationSideEffectCount(
  harness: Harness,
  operation: AuthorizationOperation
): number {
  if (operation === "addMember") {
    return harness.store.memberships.size - 2;
  }
  if (operation === "createProject") {
    return harness.store.projects.size - 1;
  }
  if (operation === "createEnvironment") {
    return harness.store.environments.size - 1;
  }
  if (operation === "requestCrawl") {
    return harness.store.crawlRequests.size + harness.queuedCrawls.length;
  }
  if (operation === "getDashboardSnapshot") {
    return 0;
  }
  if (operation === "recordCrawlDiagnostics") {
    return harness.diagnosticRecords.length;
  }
  if (operation === "completeExternalProviderOAuthConnection") {
    return harness.oauthConnections.length + harness.secretWrites.length;
  }
  return harness.usageEvents.length + harness.metricEvents.length;
}

function validDiagnosticInput() {
  return {
    ruleId: "SL-META-001",
    severity: "error",
    confidence: "certain",
    pageUrl: "https://example.com/",
    source: "crawler",
    title: "Missing title",
    evidence: "The rendered page does not contain a title element.",
    observedAt: "2026-06-21T00:00:30.000Z",
    fingerprint: "diagnostic:fingerprint"
  } as const;
}

function createTestIds() {
  const counters = new Map<string, number>();
  return {
    nextId(prefix: string): string {
      const next = (counters.get(prefix) ?? 0) + 1;
      counters.set(prefix, next);
      return `${prefix}-${next}`;
    }
  };
}

class InMemoryStore implements RelationalStore {
  readonly organizations = new Map<string, Organization>();
  readonly memberships = new Map<string, OrganizationMembership>();
  readonly projects = new Map<string, Project>();
  readonly environments = new Map<string, Environment>();
  readonly crawlRequests = new Map<string, CrawlRequest>();

  async createOrganization(input: Organization): Promise<Organization> {
    this.organizations.set(input.id, input);
    return input;
  }

  async createMembership(
    input: OrganizationMembership
  ): Promise<OrganizationMembership> {
    this.memberships.set(`${input.organizationId}:${input.principalId}`, input);
    return input;
  }

  async getMembership(
    organizationId: string,
    principalId: string
  ): Promise<OrganizationMembership | undefined> {
    return this.memberships.get(`${organizationId}:${principalId}`);
  }

  async updateMembershipRole(input: {
    organizationId: string;
    principalId: string;
    role: OrganizationMembership["role"];
  }): Promise<OrganizationMembership | undefined> {
    const key = `${input.organizationId}:${input.principalId}`;
    const existing = this.memberships.get(key);
    if (!existing) {
      return undefined;
    }
    const updated = {
      ...existing,
      role: input.role
    };
    this.memberships.set(key, updated);
    return updated;
  }

  async removeMembership(input: {
    organizationId: string;
    principalId: string;
  }): Promise<OrganizationMembership | undefined> {
    const key = `${input.organizationId}:${input.principalId}`;
    const existing = this.memberships.get(key);
    if (!existing) {
      return undefined;
    }
    this.memberships.delete(key);
    return existing;
  }

  async createProject(input: Project): Promise<Project> {
    this.projects.set(`${input.organizationId}:${input.id}`, input);
    return input;
  }

  async getProject(
    organizationId: string,
    projectId: string
  ): Promise<Project | undefined> {
    return this.projects.get(`${organizationId}:${projectId}`);
  }

  async createEnvironment(input: Environment): Promise<Environment> {
    this.environments.set(`${input.organizationId}:${input.id}`, input);
    return input;
  }

  async getEnvironment(
    organizationId: string,
    environmentId: string
  ): Promise<Environment | undefined> {
    return this.environments.get(`${organizationId}:${environmentId}`);
  }

  async createCrawlRequest(input: CrawlRequest): Promise<CrawlRequest> {
    this.crawlRequests.set(`${input.organizationId}:${input.id}`, input);
    return input;
  }

  async getCrawlRequest(
    organizationId: string,
    crawlRequestId: string
  ): Promise<CrawlRequest | undefined> {
    return this.crawlRequests.get(`${organizationId}:${crawlRequestId}`);
  }
}

class TransactionStore implements RelationalStore {
  constructor(
    private readonly store: RelationalStore,
    private readonly events: string[]
  ) {}

  async createOrganization(input: Organization): Promise<Organization> {
    this.events.push("transaction:createOrganization");
    return this.store.createOrganization(input);
  }

  async createMembership(
    input: OrganizationMembership
  ): Promise<OrganizationMembership> {
    this.events.push("transaction:createMembership");
    return this.store.createMembership(input);
  }

  async getMembership(
    organizationId: string,
    principalId: string
  ): Promise<OrganizationMembership | undefined> {
    return this.store.getMembership(organizationId, principalId);
  }

  async updateMembershipRole(input: {
    organizationId: string;
    principalId: string;
    role: OrganizationMembership["role"];
  }): Promise<OrganizationMembership | undefined> {
    this.events.push("transaction:updateMembershipRole");
    return this.store.updateMembershipRole(input);
  }

  async removeMembership(input: {
    organizationId: string;
    principalId: string;
  }): Promise<OrganizationMembership | undefined> {
    this.events.push("transaction:removeMembership");
    return this.store.removeMembership(input);
  }

  async createProject(input: Project): Promise<Project> {
    this.events.push("transaction:createProject");
    return this.store.createProject(input);
  }

  async getProject(
    organizationId: string,
    projectId: string
  ): Promise<Project | undefined> {
    return this.store.getProject(organizationId, projectId);
  }

  async createEnvironment(input: Environment): Promise<Environment> {
    this.events.push("transaction:createEnvironment");
    return this.store.createEnvironment(input);
  }

  async getEnvironment(
    organizationId: string,
    environmentId: string
  ): Promise<Environment | undefined> {
    return this.store.getEnvironment(organizationId, environmentId);
  }

  async createCrawlRequest(input: CrawlRequest): Promise<CrawlRequest> {
    this.events.push("transaction:createCrawlRequest");
    return this.store.createCrawlRequest(input);
  }

  async getCrawlRequest(
    organizationId: string,
    crawlRequestId: string
  ): Promise<CrawlRequest | undefined> {
    return this.store.getCrawlRequest(organizationId, crawlRequestId);
  }
}
