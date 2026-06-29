import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  createDashboardBrowserHistoryRuntime,
  createDashboardOrganizationSwitcherItems,
  createDashboardProjectManagementItems,
  createDashboardProjectRoutePath,
  createDashboardProjectBrowserDomRenderer,
  createDashboardProjectSectionModel,
  createDashboardProjectViewModel,
  createDashboardSummary,
  dashboardHostedShellAssetsFromManifest,
  dashboardActionRoutes,
  dashboardMessages,
  parseDashboardProjectRoutePath,
  renderDashboardHostedHtmlShell,
  renderDashboardHtml,
  renderDashboardProjectRoute,
  renderDashboardProjectRouteWithSnapshotLoader,
  renderDashboardProjectSectionHtml,
  renderDashboardProjectViewHtml,
  resolveDashboardAuthRouteIntent,
  resolveDashboardProjectRuntimeState,
  runDashboardProjectBrowserRuntime,
  startDashboardBrowserApp,
  startDashboardHostedBrowserEntry,
  type DashboardApiClient,
  type DashboardApiFetch,
  type DashboardApiFetchRequestInit,
  type DashboardAuthSession,
  type DashboardAuthSessionStore,
  type DashboardBrowserEntryWindowPort,
  type DashboardBrowserStorageLike,
  type DashboardCognitoTokenFetch,
  type DashboardCognitoTokenFetchRequestInit,
  type DashboardHostedShellBootstrapConfig,
  type DashboardHostedBrowserAssetManifest,
  type DashboardMessageKey,
  type DashboardProjectBrowserRuntimeRenderer,
  type DashboardProjectRouteParams,
  type DashboardSnapshot
} from "../src/index.js";
import {
  startSearchLintDashboardBrowserEntry,
  startSearchLintDashboardBrowserEntryFromGlobal,
  type SearchLintDashboardBrowserGlobalScope
} from "../src/browser-entry.js";
import type { Diagnostic } from "@searchlint/core";

describe("createDashboardSummary", () => {
  it("summarizes diagnostics, crawl state, observations, reports, quota, and team deterministically", () => {
    const summary = createDashboardSummary(snapshot());

    expect(summary).toMatchObject({
      organizationName: "Acme Agency",
      projectName: "Example Store",
      environmentName: "Production",
      siteUrl: "https://example.com",
      totalDiagnostics: 3,
      affectedPages: 2,
      severityCounts: {
        blocker: 1,
        error: 1,
        warning: 1,
        info: 0
      },
      latestCrawl: {
        id: "crawl-new",
        status: "succeeded"
      },
      staleExternalObservations: 1,
      reportCount: 1,
      teamMemberCount: 2,
      exhaustedQuotaCount: 1
    });
  });
});

describe("dashboardActionRoutes", () => {
  it("maps dashboard actions to checked v1 cloud API route contracts", () => {
    expect(dashboardActionRoutes()).toEqual([
      {
        action: "createProject",
        route: expect.objectContaining({
          operation: "createProject",
          method: "POST",
          path: "/v1/organizations/{organizationId}/projects",
          apiVersion: "v1"
        })
      },
      {
        action: "createEnvironment",
        route: expect.objectContaining({
          operation: "createEnvironment",
          method: "POST",
          path: "/v1/organizations/{organizationId}/projects/{projectId}/environments",
          apiVersion: "v1"
        })
      },
      {
        action: "getDashboardSnapshot",
        route: expect.objectContaining({
          operation: "getDashboardSnapshot",
          method: "GET",
          path: "/v1/organizations/{organizationId}/projects/{projectId}/environments/{environmentId}/dashboard-snapshot",
          apiVersion: "v1"
        })
      },
      {
        action: "requestCrawl",
        route: expect.objectContaining({
          operation: "requestCrawl",
          method: "POST",
          path: "/v1/organizations/{organizationId}/projects/{projectId}/environments/{environmentId}/crawl-requests",
          apiVersion: "v1"
        })
      },
      {
        action: "addMember",
        route: expect.objectContaining({
          operation: "addMember",
          method: "POST",
          path: "/v1/organizations/{organizationId}/members",
          apiVersion: "v1"
        })
      },
      {
        action: "startExternalProviderOAuthConnection",
        route: expect.objectContaining({
          operation: "startExternalProviderOAuthConnection",
          method: "POST",
          path: "/v1/organizations/{organizationId}/projects/{projectId}/environments/{environmentId}/external-providers/{provider}/oauth/start",
          apiVersion: "v1"
        })
      },
      {
        action: "completeExternalProviderOAuthConnection",
        route: expect.objectContaining({
          operation: "completeExternalProviderOAuthConnection",
          method: "POST",
          path: "/v1/organizations/{organizationId}/projects/{projectId}/environments/{environmentId}/external-providers/{provider}/oauth/callback",
          apiVersion: "v1"
        })
      }
    ]);
  });
});

describe("dashboard project route contracts", () => {
  it("builds deterministic local paths for project dashboard views", () => {
    expect(
      createDashboardProjectRoutePath({
        ...routeParams(),
        view: "diagnostics"
      })
    ).toBe(
      "/dashboard/organizations/org-1/projects/project-1/environments/env-1/diagnostics"
    );

    expect(
      createDashboardProjectRoutePath({
        ...routeParams(),
        view: "crawlHistory",
        basePath: "/app/dashboard/"
      })
    ).toBe(
      "/app/dashboard/organizations/org-1/projects/project-1/environments/env-1/crawl-history"
    );

    expect(
      createDashboardProjectRoutePath({
        ...routeParams(),
        view: "team",
        basePath: "/"
      })
    ).toBe("/organizations/org-1/projects/project-1/environments/env-1/team");
  });

  it("parses project dashboard paths into decoded params and canonical views", () => {
    expect(
      parseDashboardProjectRoutePath(
        "/dashboard/organizations/org-1/projects/project-1/environments/env-1/external-observations"
      )
    ).toEqual({
      params: routeParams(),
      view: "externalObservations",
      path: "/dashboard/organizations/org-1/projects/project-1/environments/env-1/external-observations"
    });
  });

  it("round-trips percent-encoded project route IDs", () => {
    const params = routeParams({
      organizationId: "org 1",
      projectId: "project?1",
      environmentId: "env#1"
    });
    const path = createDashboardProjectRoutePath({
      ...params,
      view: "reports"
    });

    expect(path).toBe(
      "/dashboard/organizations/org%201/projects/project%3F1/environments/env%231/reports"
    );
    expect(parseDashboardProjectRoutePath(path)).toEqual({
      params,
      view: "reports",
      path
    });
  });

  it("returns undefined for unknown project route shapes and views", () => {
    expect(parseDashboardProjectRoutePath("/dashboard")).toBeUndefined();
    expect(
      parseDashboardProjectRoutePath(
        "/dashboard/organizations/org-1/projects/project-1/environments/env-1/unknown-view"
      )
    ).toBeUndefined();
    expect(
      parseDashboardProjectRoutePath(
        "/dashboard/organizations/org-1/projects/project-1/environments/env-1/diagnostics/extra"
      )
    ).toBeUndefined();
  });

  it("rejects invalid route construction inputs deterministically", () => {
    expect(() =>
      createDashboardProjectRoutePath({
        ...routeParams({ projectId: " " }),
        view: "overview"
      })
    ).toThrowError(new Error("Dashboard project route projectId is required."));

    expect(() =>
      createDashboardProjectRoutePath({
        ...routeParams({ environmentId: "env/1" }),
        view: "overview"
      })
    ).toThrowError(
      new Error("Dashboard project route environmentId is required.")
    );

    expect(() =>
      createDashboardProjectRoutePath({
        ...routeParams(),
        view: "overview",
        basePath: "https://app.searchlint.example/dashboard"
      })
    ).toThrowError(
      new Error("Dashboard route basePath must be a non-empty local path.")
    );
  });
});

describe("createDashboardProjectViewModel", () => {
  it("creates a deterministic active route, summary, and navigation model", () => {
    const currentSnapshot = snapshot();
    const model = createDashboardProjectViewModel({
      snapshot: currentSnapshot,
      ...routeParams(),
      view: "diagnostics"
    });

    expect(model.route).toEqual({
      params: routeParams(),
      view: "diagnostics",
      path: "/dashboard/organizations/org-1/projects/project-1/environments/env-1/diagnostics"
    });
    expect(model.activeView).toBe("diagnostics");
    expect(model.activeViewLabel).toBe("Diagnostics");
    expect(model.summary).toEqual(createDashboardSummary(currentSnapshot));
    expect(model.section).toMatchObject({
      view: "diagnostics",
      diagnostics: [
        expect.objectContaining({ ruleId: "SL-META-001" }),
        expect.objectContaining({ ruleId: "SL-HTTP-001" }),
        expect.objectContaining({ ruleId: "SL-META-002" })
      ]
    });
    expect(model.navigation.map((item) => item.view)).toEqual([
      "onboarding",
      "overview",
      "issues",
      "diagnostics",
      "crawlHistory",
      "trends",
      "externalObservations",
      "reports",
      "organization",
      "site",
      "environments",
      "team",
      "billing",
      "settings",
      "auditLog"
    ]);
    expect(model.navigation.filter((item) => item.current)).toEqual([
      {
        view: "diagnostics",
        label: "Diagnostics",
        path: "/dashboard/organizations/org-1/projects/project-1/environments/env-1/diagnostics",
        current: true
      }
    ]);
    expect(model.organizationSwitcher).toEqual([
      {
        organizationId: "org-1",
        organizationName: "Acme Agency",
        projectId: "project-1",
        projectName: "Example Store",
        environmentId: "env-1",
        environmentName: "Production",
        path: "/dashboard/organizations/org-1/projects/project-1/environments/env-1/diagnostics",
        current: true
      },
      {
        organizationId: "org-2",
        organizationName: "Beta Studio",
        projectId: "project-2",
        projectName: "Beta Docs",
        environmentId: "env-2",
        environmentName: "Production",
        path: "/dashboard/organizations/org-2/projects/project-2/environments/env-2/diagnostics",
        current: false
      }
    ]);
  });

  it("uses the same project route contract for custom-base navigation paths", () => {
    const model = createDashboardProjectViewModel({
      snapshot: snapshot(),
      ...routeParams(),
      view: "reports",
      basePath: "/app/dashboard"
    });

    expect(model.route.path).toBe(
      "/app/dashboard/organizations/org-1/projects/project-1/environments/env-1/reports"
    );
    expect(model.navigation.find((item) => item.view === "team")).toEqual({
      view: "team",
      label: "Team",
      path: "/app/dashboard/organizations/org-1/projects/project-1/environments/env-1/team",
      current: false
    });
    expect(
      model.organizationSwitcher.find((item) => item.organizationId === "org-2")
    ).toMatchObject({
      path: "/app/dashboard/organizations/org-2/projects/project-2/environments/env-2/reports",
      current: false
    });
  });

  it("rejects route and snapshot identity mismatches", () => {
    expect(() =>
      createDashboardProjectViewModel({
        snapshot: snapshot(),
        ...routeParams({ organizationId: "other-org" }),
        view: "overview"
      })
    ).toThrowError(
      new Error(
        "Dashboard project route organizationId must match the snapshot organization."
      )
    );

    expect(() =>
      createDashboardProjectViewModel({
        snapshot: snapshot(),
        ...routeParams({ projectId: "other-project" }),
        view: "overview"
      })
    ).toThrowError(
      new Error(
        "Dashboard project route projectId must match the snapshot project."
      )
    );

    expect(() =>
      createDashboardProjectViewModel({
        snapshot: snapshot(),
        ...routeParams({ environmentId: "other-env" }),
        view: "overview"
      })
    ).toThrowError(
      new Error(
        "Dashboard project route environmentId must match the snapshot environment."
      )
    );
  });
});

describe("createDashboardOrganizationSwitcherItems", () => {
  it("deduplicates current org, sorts targets, and builds route-safe links", () => {
    const currentSnapshot = snapshot({
      organizationSwitchTargets: [
        {
          organizationId: "org-1",
          organizationName: "Acme Agency",
          projectId: "project-1",
          projectName: "Example Store",
          environmentId: "env-1",
          environmentName: "Production"
        },
        {
          organizationId: "org-3",
          organizationName: "Zeta Group",
          projectId: "project-3",
          projectName: "Docs",
          environmentId: "env-3",
          environmentName: "Staging"
        },
        {
          organizationId: "org-2",
          organizationName: "Beta Studio",
          projectId: "project-2",
          projectName: "Storefront",
          environmentId: "env-2",
          environmentName: "Production"
        }
      ]
    });

    expect(
      createDashboardOrganizationSwitcherItems(
        currentSnapshot,
        {
          params: routeParams(),
          view: "reports",
          path: "/dashboard/organizations/org-1/projects/project-1/environments/env-1/reports"
        },
        "/app/dashboard"
      )
    ).toEqual([
      {
        organizationId: "org-1",
        organizationName: "Acme Agency",
        projectId: "project-1",
        projectName: "Example Store",
        environmentId: "env-1",
        environmentName: "Production",
        path: "/app/dashboard/organizations/org-1/projects/project-1/environments/env-1/reports",
        current: true
      },
      {
        organizationId: "org-2",
        organizationName: "Beta Studio",
        projectId: "project-2",
        projectName: "Storefront",
        environmentId: "env-2",
        environmentName: "Production",
        path: "/app/dashboard/organizations/org-2/projects/project-2/environments/env-2/reports",
        current: false
      },
      {
        organizationId: "org-3",
        organizationName: "Zeta Group",
        projectId: "project-3",
        projectName: "Docs",
        environmentId: "env-3",
        environmentName: "Staging",
        path: "/app/dashboard/organizations/org-3/projects/project-3/environments/env-3/reports",
        current: false
      }
    ]);
  });

  it("rejects invalid organization switch targets before rendering hrefs", () => {
    expect(() =>
      createDashboardOrganizationSwitcherItems(
        snapshot({
          organizationSwitchTargets: [
            {
              organizationId: "org/2",
              organizationName: "Beta Studio",
              projectId: "project-2",
              projectName: "Storefront",
              environmentId: "env-2",
              environmentName: "Production"
            }
          ]
        }),
        {
          params: routeParams(),
          view: "overview",
          path: "/dashboard/organizations/org-1/projects/project-1/environments/env-1/overview"
        }
      )
    ).toThrowError(
      new Error("Dashboard project route organizationId is required.")
    );
  });
});

describe("createDashboardProjectSectionModel", () => {
  it("creates an overview section with a derived summary and sorted quotas", () => {
    const currentSnapshot = snapshot({
      quotas: [
        {
          label: "Z quota",
          used: 1,
          limit: 10
        },
        {
          label: "A quota",
          used: 2,
          limit: 10
        }
      ]
    });

    expect(
      createDashboardProjectSectionModel(currentSnapshot, "overview")
    ).toEqual({
      view: "overview",
      summary: createDashboardSummary(currentSnapshot),
      quotas: [
        {
          label: "A quota",
          used: 2,
          limit: 10
        },
        {
          label: "Z quota",
          used: 1,
          limit: 10
        }
      ]
    });
    expect(currentSnapshot.quotas.map((quota) => quota.label)).toEqual([
      "Z quota",
      "A quota"
    ]);
  });

  it("creates sorted diagnostics, crawl, trend, observation, report, and team sections", () => {
    const currentSnapshot = snapshot({
      trends: [
        {
          date: "2026-06-22",
          diagnostics: 1,
          blockers: 0,
          errors: 1,
          warnings: 0,
          infos: 0
        },
        {
          date: "2026-06-20",
          diagnostics: 2,
          blockers: 1,
          errors: 0,
          warnings: 1,
          infos: 0
        }
      ],
      deploymentHistory: [
        {
          id: "deploy-old",
          deployedAt: "2026-06-20T00:10:00.000Z",
          environmentName: "Production",
          commitRef: "def5678",
          status: "rolled_back",
          diagnosticsBefore: 4,
          diagnosticsAfter: 6,
          annotation: "Rollback after canonical regression"
        },
        {
          id: "deploy-new",
          deployedAt: "2026-06-22T00:10:00.000Z",
          environmentName: "Production",
          commitRef: "abc1234",
          status: "succeeded",
          diagnosticsBefore: 7,
          diagnosticsAfter: 3,
          annotation: "Homepage metadata fix"
        }
      ],
      reports: [
        {
          id: "report-old",
          title: "Old Report",
          generatedAt: "2026-06-20T00:00:00.000Z",
          locale: "en",
          totalDiagnostics: 5
        },
        {
          id: "report-new",
          title: "New Report",
          generatedAt: "2026-06-22T00:00:00.000Z",
          locale: "en",
          totalDiagnostics: 1
        }
      ]
    });

    expect(
      createDashboardProjectSectionModel(currentSnapshot, "diagnostics")
    ).toMatchObject({
      view: "diagnostics",
      diagnostics: [
        expect.objectContaining({ ruleId: "SL-META-001" }),
        expect.objectContaining({ ruleId: "SL-HTTP-001" }),
        expect.objectContaining({ ruleId: "SL-META-002" })
      ]
    });
    expect(
      createDashboardProjectSectionModel(currentSnapshot, "crawlHistory")
    ).toMatchObject({
      view: "crawlHistory",
      crawlRuns: [
        expect.objectContaining({ id: "crawl-new" }),
        expect.objectContaining({ id: "crawl-old" })
      ],
      crawlSchedules: [
        expect.objectContaining({
          id: "schedule-weekly",
          name: "Weekly full crawl",
          enabled: true
        }),
        expect.objectContaining({
          id: "schedule-paused",
          name: "Paused launch crawl",
          enabled: false
        })
      ],
      requestCrawlRoute: expect.objectContaining({
        action: "requestCrawl",
        route: expect.objectContaining({
          method: "POST",
          path: "/v1/organizations/{organizationId}/projects/{projectId}/environments/{environmentId}/crawl-requests"
        })
      })
    });
    expect(
      createDashboardProjectSectionModel(currentSnapshot, "trends")
    ).toEqual({
      view: "trends",
      trends: [
        {
          date: "2026-06-20",
          diagnostics: 2,
          blockers: 1,
          errors: 0,
          warnings: 1,
          infos: 0
        },
        {
          date: "2026-06-22",
          diagnostics: 1,
          blockers: 0,
          errors: 1,
          warnings: 0,
          infos: 0
        }
      ],
      deploymentHistory: [
        {
          id: "deploy-new",
          deployedAt: "2026-06-22T00:10:00.000Z",
          environmentName: "Production",
          commitRef: "abc1234",
          status: "succeeded",
          diagnosticsBefore: 7,
          diagnosticsAfter: 3,
          annotation: "Homepage metadata fix"
        },
        {
          id: "deploy-old",
          deployedAt: "2026-06-20T00:10:00.000Z",
          environmentName: "Production",
          commitRef: "def5678",
          status: "rolled_back",
          diagnosticsBefore: 4,
          diagnosticsAfter: 6,
          annotation: "Rollback after canonical regression"
        }
      ]
    });
    expect(
      createDashboardProjectSectionModel(
        currentSnapshot,
        "externalObservations"
      )
    ).toMatchObject({
      view: "externalObservations",
      externalObservations: [
        expect.objectContaining({ id: "obs-google" }),
        expect.objectContaining({ id: "obs-yandex" })
      ],
      connectors: [
        expect.objectContaining({
          provider: "google",
          status: "connected",
          action: "startExternalProviderOAuthConnection",
          operation: "startExternalProviderOAuthConnection"
        }),
        expect.objectContaining({
          provider: "yandex",
          status: "stale",
          action: "startExternalProviderOAuthConnection",
          operation: "startExternalProviderOAuthConnection"
        })
      ]
    });
    expect(
      createDashboardProjectSectionModel(currentSnapshot, "reports")
    ).toEqual({
      view: "reports",
      reports: [
        {
          id: "report-new",
          title: "New Report",
          generatedAt: "2026-06-22T00:00:00.000Z",
          locale: "en",
          totalDiagnostics: 1
        },
        {
          id: "report-old",
          title: "Old Report",
          generatedAt: "2026-06-20T00:00:00.000Z",
          locale: "en",
          totalDiagnostics: 5
        }
      ]
    });
    expect(createDashboardProjectSectionModel(currentSnapshot, "team")).toEqual(
      {
        view: "team",
        teamMembers: [
          {
            principalId: "principal-2",
            displayName: "Developer",
            role: "developer"
          },
          {
            principalId: "principal-1",
            displayName: "Owner",
            role: "owner"
          }
        ],
        roleSummaries: expect.arrayContaining([
          expect.objectContaining({
            role: "owner",
            memberCount: 1,
            permissions: expect.arrayContaining([
              "organization:manage",
              "member:manage"
            ])
          }),
          expect.objectContaining({
            role: "developer",
            memberCount: 1,
            permissions: expect.arrayContaining([
              "project:update",
              "diagnostic:write"
            ])
          })
        ]),
        managementActions: expect.arrayContaining([
          expect.objectContaining({
            label: "Invite member",
            action: "addMember",
            method: "POST",
            pathTemplate: "/v1/organizations/{organizationId}/members"
          }),
          expect.objectContaining({ label: "Remove member" }),
          expect.objectContaining({ label: "Transfer ownership" })
        ])
      }
    );

    const clientTeam = createDashboardProjectSectionModel(
      snapshot({
        viewerRole: "client",
        teamMembers: [
          {
            principalId: "principal-client",
            displayName: "Client Reviewer",
            role: "client"
          }
        ]
      }),
      "team"
    );
    expect(clientTeam).toEqual({
      view: "team",
      teamMembers: [
        {
          principalId: "principal-client",
          displayName: "Client Reviewer",
          role: "client"
        }
      ],
      roleSummaries: [
        {
          role: "client",
          permissions: ["project:read", "report:read"],
          memberCount: 1
        }
      ],
      managementActions: []
    });
    expect(renderDashboardProjectSectionHtml(clientTeam)).not.toContain(
      "Team management actions"
    );
  });

  it("creates production dashboard sections for onboarding, org, site, issues, billing, settings, and audit summaries", () => {
    const currentSnapshot = snapshot();

    expect(
      createDashboardProjectSectionModel(currentSnapshot, "onboarding")
    ).toMatchObject({
      view: "onboarding",
      checklist: [
        expect.objectContaining({ label: "Project configured" }),
        expect.objectContaining({ label: "Environment configured" }),
        expect.objectContaining({ label: "First crawl recorded" }),
        expect.objectContaining({ label: "External observations connected" }),
        expect.objectContaining({ label: "Team access configured" })
      ]
    });
    expect(
      createDashboardProjectSectionModel(currentSnapshot, "organization")
    ).toMatchObject({
      view: "organization",
      organization: currentSnapshot.organization,
      teamMembers: expect.arrayContaining([
        expect.objectContaining({ role: "owner" })
      ]),
      projects: [
        expect.objectContaining({
          id: "project-2",
          name: "Beta Storefront",
          current: false
        }),
        expect.objectContaining({
          id: "project-1",
          name: "Example Store",
          current: true,
          openDiagnostics: 3
        })
      ],
      createProjectRoute: expect.objectContaining({
        action: "createProject",
        route: expect.objectContaining({
          method: "POST",
          path: "/v1/organizations/{organizationId}/projects"
        })
      })
    });
    expect(createDashboardProjectSectionModel(currentSnapshot, "site")).toEqual(
      {
        view: "site",
        project: currentSnapshot.project,
        environment: currentSnapshot.environment,
        affectedPages: 2
      }
    );
    expect(
      createDashboardProjectSectionModel(currentSnapshot, "environments")
    ).toMatchObject({
      view: "environments",
      environment: currentSnapshot.environment,
      latestCrawl: expect.objectContaining({ id: "crawl-new" })
    });
    expect(
      createDashboardProjectSectionModel(currentSnapshot, "issues")
    ).toMatchObject({
      view: "issues",
      summary: expect.objectContaining({ totalDiagnostics: 3 }),
      diagnostics: [
        expect.objectContaining({ severity: "blocker" }),
        expect.objectContaining({ severity: "error" }),
        expect.objectContaining({ severity: "warning" })
      ]
    });
    expect(
      createDashboardProjectSectionModel(currentSnapshot, "billing")
    ).toMatchObject({
      view: "billing",
      quotas: currentSnapshot.quotas,
      billing: expect.objectContaining({
        planTier: "team",
        status: "active",
        overagePolicy: "hard-cap"
      }),
      agency: expect.objectContaining({
        clientCount: 2,
        activeClientCount: 2,
        overdueSlaCount: 1
      })
    });
    expect(
      createDashboardProjectSectionModel(currentSnapshot, "settings")
    ).toMatchObject({
      view: "settings",
      providerSettings: expect.arrayContaining([
        expect.objectContaining({
          provider: "google",
          status: "connected",
          observedSubjectCount: 1,
          oauthStartOperation: "startExternalProviderOAuthConnection",
          oauthStartMethod: "POST",
          oauthStartPathTemplate:
            "/v1/organizations/{organizationId}/projects/{projectId}/environments/{environmentId}/external-providers/{provider}/oauth/start",
          requiredScopes: expect.arrayContaining([
            "https://www.googleapis.com/auth/webmasters.readonly"
          ]),
          redirectUri: "/dashboard/integrations/google/callback"
        }),
        expect.objectContaining({
          provider: "yandex",
          status: "stale",
          observedSubjectCount: 1,
          requiredScopes: expect.arrayContaining([
            "webmaster:read",
            "metrika:read"
          ]),
          redirectUri: "/dashboard/integrations/yandex/callback"
        })
      ]),
      notificationChannels: expect.arrayContaining([
        expect.objectContaining({
          kind: "email",
          targetDisplay: "a***@example.com"
        }),
        expect.objectContaining({ kind: "slack", targetDisplay: "#seo-alerts" })
      ]),
      notificationRules: expect.arrayContaining([
        expect.objectContaining({
          name: "Blocker alerts",
          digest: "immediate"
        })
      ]),
      notificationDeliveryAttempts: expect.arrayContaining([
        expect.objectContaining({ status: "retry_scheduled" }),
        expect.objectContaining({ status: "delivered" })
      ]),
      actionRoutes: expect.arrayContaining([
        expect.objectContaining({ action: "getDashboardSnapshot" })
      ])
    });
    expect(
      createDashboardProjectSectionModel(currentSnapshot, "auditLog")
    ).toMatchObject({
      view: "auditLog",
      events: expect.arrayContaining([
        expect.objectContaining({ action: "dashboard.snapshot.loaded" })
      ])
    });
  });
});

describe("createDashboardProjectManagementItems", () => {
  it("deduplicates the current project, sorts projects, and marks current state", () => {
    expect(
      createDashboardProjectManagementItems(
        snapshot({
          projectManagement: [
            {
              id: "project-1",
              name: "Example Store",
              siteUrl: "https://example.com",
              environmentCount: 2,
              openDiagnostics: 99,
              latestCrawlStatus: "failed"
            },
            {
              id: "project-3",
              name: "Zeta Docs",
              siteUrl: "https://zeta.example.com",
              environmentCount: 1,
              openDiagnostics: 0,
              latestCrawlStatus: "queued"
            },
            {
              id: "project-2",
              name: "Beta Storefront",
              siteUrl: "https://beta.example.com",
              environmentCount: 3,
              openDiagnostics: 4,
              latestCrawlStatus: "running"
            }
          ]
        })
      )
    ).toEqual([
      {
        id: "project-2",
        name: "Beta Storefront",
        siteUrl: "https://beta.example.com",
        environmentCount: 3,
        openDiagnostics: 4,
        latestCrawlStatus: "running",
        current: false
      },
      {
        id: "project-1",
        name: "Example Store",
        siteUrl: "https://example.com",
        environmentCount: 2,
        openDiagnostics: 99,
        latestCrawlStatus: "failed",
        current: true
      },
      {
        id: "project-3",
        name: "Zeta Docs",
        siteUrl: "https://zeta.example.com",
        environmentCount: 1,
        openDiagnostics: 0,
        latestCrawlStatus: "queued",
        current: false
      }
    ]);
  });

  it("rejects invalid project management records before rendering", () => {
    expect(() =>
      createDashboardProjectManagementItems(
        snapshot({
          projectManagement: [
            {
              id: "project/2",
              name: "Beta Storefront",
              siteUrl: "https://beta.example.com",
              environmentCount: 1,
              openDiagnostics: 0
            }
          ]
        })
      )
    ).toThrowError(
      new Error("Dashboard project management project id is required.")
    );
  });
});

describe("renderDashboardProjectViewHtml", () => {
  it("renders one active project view with navigation current state", () => {
    const html = renderDashboardProjectViewHtml(
      createDashboardProjectViewModel({
        snapshot: snapshot(),
        ...routeParams(),
        view: "diagnostics"
      })
    );

    expect(html).toContain("<!doctype html>");
    expect(html).toContain("<title>Diagnostics - SearchLint Dashboard</title>");
    expect(html).toContain('<nav aria-label="Organization switcher">');
    expect(html).toContain(
      '<a href="/dashboard/organizations/org-1/projects/project-1/environments/env-1/diagnostics" aria-current="true">Acme Agency / Example Store / Production</a>'
    );
    expect(html).toContain(
      '<a href="/dashboard/organizations/org-2/projects/project-2/environments/env-2/diagnostics">Beta Studio / Beta Docs / Production</a>'
    );
    expect(html).toContain('<nav aria-label="Project dashboard views">');
    expect(html).toContain(
      '<a href="/dashboard/organizations/org-1/projects/project-1/environments/env-1/diagnostics" aria-current="page">Diagnostics</a>'
    );
    expect((html.match(/aria-current="page"/gu) ?? []).length).toBe(1);
    expect(html).toContain('id="diagnostics"');
    expect(html).toContain('aria-label="Diagnostics"');
    expect(html).toContain("SL-META-001");
    expect(html).not.toContain('id="team"');
    expect(html).not.toContain('aria-label="Team"');
  });

  it("renders project management rows and create project contract", () => {
    const html = renderDashboardProjectSectionHtml(
      createDashboardProjectSectionModel(snapshot(), "organization")
    );

    expect(html).toContain('aria-label="Project management"');
    expect(html).toContain("Beta Storefront");
    expect(html).toContain("Example Store");
    expect(html).toContain("Current");
    expect(html).toContain("Available");
    expect(html).toContain("POST");
    expect(html).toContain("/v1/organizations/{organizationId}/projects");
  });

  it("renders crawl schedules and request crawl contract", () => {
    const html = renderDashboardProjectSectionHtml(
      createDashboardProjectSectionModel(snapshot(), "crawlHistory")
    );

    expect(html).toContain('aria-label="Crawl scheduling"');
    expect(html).toContain("Weekly full crawl");
    expect(html).toContain("Paused launch crawl");
    expect(html).toContain("Enabled");
    expect(html).toContain("Paused");
    expect(html).toContain("POST");
    expect(html).toContain(
      "/v1/organizations/{organizationId}/projects/{projectId}/environments/{environmentId}/crawl-requests"
    );
  });

  it("renders notification settings and delivery history in the settings view", () => {
    const html = renderDashboardProjectSectionHtml(
      createDashboardProjectSectionModel(snapshot(), "settings")
    );

    expect(html).toContain('aria-label="Google/Yandex settings"');
    expect(html).toContain("/dashboard/integrations/google/callback");
    expect(html).toContain("/dashboard/integrations/yandex/callback");
    expect(html).toContain("webmasters.readonly");
    expect(html).toContain("metrika:read");
    expect(html).toContain("Notification settings");
    expect(html).toContain('aria-label="Notification summary"');
    expect(html).toContain("Enabled channels");
    expect(html).toContain("Enabled rules");
    expect(html).toContain("Retry scheduled");
    expect(html).toContain('aria-label="Notification channels"');
    expect(html).toContain('aria-label="Notification rules"');
    expect(html).toContain('aria-label="Notification delivery history"');
    expect(html).toContain("#seo-alerts");
    expect(html).toContain("retry_scheduled");
    expect(html).not.toContain("token=secret");
  });

  it("renders billing subscription, invoices, usage, and overage policy", () => {
    const html = renderDashboardProjectSectionHtml(
      createDashboardProjectSectionModel(snapshot(), "billing")
    );

    expect(html).toContain('aria-label="Billing subscription"');
    expect(html).toContain('aria-label="Billing invoices"');
    expect(html).toContain('aria-label="Agency portfolio"');
    expect(html).toContain('aria-label="Quota"');
    expect(html).toContain("team");
    expect(html).toContain("active");
    expect(html).toContain("hard-cap");
    expect(html).toContain("USD 49.00");
    expect(html).toContain("Acme Retail");
    expect(html).toContain("overdue");
  });

  it("escapes active view navigation and section data", () => {
    const html = renderDashboardProjectViewHtml(
      createDashboardProjectViewModel({
        snapshot: snapshot({
          organization: {
            id: "org-1",
            name: "Org <unsafe>"
          },
          organizationSwitchTargets: [
            {
              organizationId: "org-2",
              organizationName: "Beta <unsafe>",
              projectId: "project-2",
              projectName: 'Docs "unsafe"',
              environmentId: "env-2",
              environmentName: "Prod & preview"
            }
          ],
          projectManagement: [
            {
              id: "project-2",
              name: "Project <unsafe>",
              siteUrl: "https://example.com/?q=<unsafe>",
              environmentCount: 1,
              openDiagnostics: 0
            }
          ],
          diagnostics: [
            diagnostic({
              evidence: 'Evidence <script> & "quote"',
              pageUrl: "https://example.com/<page>"
            })
          ]
        }),
        ...routeParams(),
        view: "diagnostics"
      })
    );

    expect(html).toContain("Org &lt;unsafe&gt;");
    expect(html).toContain(
      "Beta &lt;unsafe&gt; / Docs &quot;unsafe&quot; / Prod &amp; preview"
    );
    expect(html).toContain("Evidence &lt;script&gt; &amp; &quot;quote&quot;");
    expect(html).toContain("https://example.com/&lt;page&gt;");
    expect(html).not.toContain("<script>");

    const organizationHtml = renderDashboardProjectSectionHtml(
      createDashboardProjectSectionModel(
        snapshot({
          projectManagement: [
            {
              id: "project-2",
              name: "Project <unsafe>",
              siteUrl: "https://example.com/?q=<unsafe>",
              environmentCount: 1,
              openDiagnostics: 0
            }
          ]
        }),
        "organization"
      )
    );
    expect(organizationHtml).toContain("Project &lt;unsafe&gt;");
    expect(organizationHtml).toContain("https://example.com/?q=&lt;unsafe&gt;");

    const crawlHtml = renderDashboardProjectSectionHtml(
      createDashboardProjectSectionModel(
        snapshot({
          crawlSchedules: [
            {
              id: "schedule-unsafe",
              name: "Schedule <unsafe>",
              cadence: "daily",
              enabled: true,
              nextRunAt: "2026-06-23T00:00:00.000Z",
              targetUrlCount: 1
            }
          ]
        }),
        "crawlHistory"
      )
    );
    expect(crawlHtml).toContain("Schedule &lt;unsafe&gt;");
  });
});

describe("renderDashboardProjectRoute", () => {
  it("renders parsed project routes to active-view HTML", () => {
    const result = renderDashboardProjectRoute({
      snapshot: snapshot(),
      path: "/dashboard/organizations/org-1/projects/project-1/environments/env-1/reports"
    });

    expect(result.status).toBe("found");
    if (result.status !== "found") {
      throw new Error("Expected route render result to be found.");
    }
    expect(result.route).toEqual({
      params: routeParams(),
      view: "reports",
      path: "/dashboard/organizations/org-1/projects/project-1/environments/env-1/reports"
    });
    expect(result.model.activeView).toBe("reports");
    expect(result.html).toContain(
      "<title>Reports - SearchLint Dashboard</title>"
    );
    expect(result.html).toContain('aria-current="page">Reports</a>');
    expect(result.html).toContain('id="reports"');
    expect(result.html).not.toContain('id="diagnostics"');
  });

  it("supports custom route base paths", () => {
    const result = renderDashboardProjectRoute({
      snapshot: snapshot(),
      path: "/app/dashboard/organizations/org-1/projects/project-1/environments/env-1/team",
      basePath: "/app/dashboard"
    });

    expect(result.status).toBe("found");
    if (result.status !== "found") {
      throw new Error("Expected custom-base route render result to be found.");
    }
    expect(result.route.path).toBe(
      "/app/dashboard/organizations/org-1/projects/project-1/environments/env-1/team"
    );
    expect(
      result.model.navigation.every((item) =>
        item.path.startsWith("/app/dashboard")
      )
    ).toBe(true);
    expect(result.html).toContain("<title>Team - SearchLint Dashboard</title>");
    expect(result.html).toContain('aria-current="page">Team</a>');
    expect(result.html).toContain('id="team"');
  });

  it("returns notFound for unknown dashboard routes", () => {
    const path =
      "/dashboard/organizations/org-1/projects/project-1/environments/env-1/unknown-view";

    expect(
      renderDashboardProjectRoute({
        snapshot: snapshot(),
        path
      })
    ).toEqual({
      status: "notFound",
      path
    });
  });

  it("propagates route and snapshot identity mismatches", () => {
    expect(() =>
      renderDashboardProjectRoute({
        snapshot: snapshot(),
        path: "/dashboard/organizations/other-org/projects/project-1/environments/env-1/overview"
      })
    ).toThrowError(
      new Error(
        "Dashboard project route organizationId must match the snapshot organization."
      )
    );
  });
});

describe("renderDashboardProjectRouteWithSnapshotLoader", () => {
  it("loads snapshots for parsed project routes and renders active-view HTML", async () => {
    const loadedParams: DashboardProjectRouteParams[] = [];

    const result = await renderDashboardProjectRouteWithSnapshotLoader({
      path: "/dashboard/organizations/org-1/projects/project-1/environments/env-1/external-observations",
      loadSnapshot: (params) => {
        loadedParams.push(params);
        return snapshot();
      }
    });

    expect(loadedParams).toEqual([routeParams()]);
    expect(result.status).toBe("found");
    if (result.status !== "found") {
      throw new Error(
        "Expected loader-backed route render result to be found."
      );
    }
    expect(result.route).toEqual({
      params: routeParams(),
      view: "externalObservations",
      path: "/dashboard/organizations/org-1/projects/project-1/environments/env-1/external-observations"
    });
    expect(result.snapshot).toEqual(snapshot());
    expect(result.model.activeView).toBe("externalObservations");
    expect(result.html).toContain(
      "<title>External Observations - SearchLint Dashboard</title>"
    );
    expect(result.html).toContain(
      'aria-current="page">External Observations</a>'
    );
    expect(result.html).toContain('id="external-observations"');
  });

  it("supports custom route base paths with async snapshot loaders", async () => {
    const result = await renderDashboardProjectRouteWithSnapshotLoader({
      path: "/app/dashboard/organizations/org-1/projects/project-1/environments/env-1/trends",
      basePath: "/app/dashboard",
      loadSnapshot: async () => snapshot()
    });

    expect(result.status).toBe("found");
    if (result.status !== "found") {
      throw new Error(
        "Expected custom-base loader-backed route render result to be found."
      );
    }
    expect(result.route.path).toBe(
      "/app/dashboard/organizations/org-1/projects/project-1/environments/env-1/trends"
    );
    expect(
      result.model.navigation.every((item) =>
        item.path.startsWith("/app/dashboard")
      )
    ).toBe(true);
    expect(result.html).toContain(
      "<title>Trends - SearchLint Dashboard</title>"
    );
    expect(result.html).toContain('id="trends"');
  });

  it("does not call the snapshot loader for unknown dashboard routes", async () => {
    const loadedParams: DashboardProjectRouteParams[] = [];
    const path =
      "/dashboard/organizations/org-1/projects/project-1/environments/env-1/unknown-view";

    await expect(
      renderDashboardProjectRouteWithSnapshotLoader({
        path,
        loadSnapshot: (params) => {
          loadedParams.push(params);
          return snapshot();
        }
      })
    ).resolves.toEqual({
      status: "notFound",
      path
    });
    expect(loadedParams).toEqual([]);
  });

  it("returns snapshotNotFound for valid routes without a loaded snapshot", async () => {
    const result = await renderDashboardProjectRouteWithSnapshotLoader({
      path: "/dashboard/organizations/org-1/projects/project-1/environments/env-1/overview",
      loadSnapshot: () => undefined
    });

    expect(result).toEqual({
      status: "snapshotNotFound",
      route: {
        params: routeParams(),
        view: "overview",
        path: "/dashboard/organizations/org-1/projects/project-1/environments/env-1/overview"
      }
    });
  });

  it("propagates loaded snapshot identity mismatches", async () => {
    await expect(
      renderDashboardProjectRouteWithSnapshotLoader({
        path: "/dashboard/organizations/org-1/projects/project-1/environments/env-1/overview",
        loadSnapshot: () =>
          snapshot({
            project: {
              id: "other-project",
              name: "Other Project",
              siteUrl: "https://other.example"
            }
          })
      })
    ).rejects.toThrowError(
      new Error(
        "Dashboard project route projectId must match the snapshot project."
      )
    );
  });
});

describe("renderDashboardProjectSectionHtml", () => {
  it("renders supported section variants", () => {
    expect(
      renderDashboardProjectSectionHtml(
        createDashboardProjectSectionModel(snapshot(), "overview")
      )
    ).toContain('aria-label="Quota"');
    expect(
      renderDashboardProjectSectionHtml(
        createDashboardProjectSectionModel(snapshot(), "crawlHistory")
      )
    ).toContain('aria-label="Crawl History"');
    expect(
      renderDashboardProjectSectionHtml(
        createDashboardProjectSectionModel(snapshot(), "trends")
      )
    ).toContain('aria-label="Trends"');
    expect(
      renderDashboardProjectSectionHtml(
        createDashboardProjectSectionModel(snapshot(), "trends")
      )
    ).toContain('aria-label="Deployment history"');
    expect(
      renderDashboardProjectSectionHtml(
        createDashboardProjectSectionModel(snapshot(), "trends")
      )
    ).toContain("Homepage metadata fix");
    expect(
      renderDashboardProjectSectionHtml(
        createDashboardProjectSectionModel(snapshot(), "externalObservations")
      )
    ).toContain('aria-label="External Observations"');
    expect(
      renderDashboardProjectSectionHtml(
        createDashboardProjectSectionModel(snapshot(), "externalObservations")
      )
    ).toContain('data-dashboard-action="startExternalProviderOAuthConnection"');
    expect(
      renderDashboardProjectSectionHtml(
        createDashboardProjectSectionModel(snapshot(), "externalObservations")
      )
    ).toContain("Connect Google");
    expect(
      renderDashboardProjectSectionHtml(
        createDashboardProjectSectionModel(
          snapshot({ externalObservations: [] }),
          "externalObservations"
        )
      )
    ).toContain("<td>notConnected</td>");
    expect(
      renderDashboardProjectSectionHtml(
        createDashboardProjectSectionModel(snapshot(), "reports")
      )
    ).toContain('aria-label="Reports"');
    expect(
      renderDashboardProjectSectionHtml(
        createDashboardProjectSectionModel(snapshot(), "team")
      )
    ).toContain('aria-label="Team"');
    expect(
      renderDashboardProjectSectionHtml(
        createDashboardProjectSectionModel(snapshot(), "team")
      )
    ).toContain('aria-label="Team RBAC matrix"');
    expect(
      renderDashboardProjectSectionHtml(
        createDashboardProjectSectionModel(snapshot(), "team")
      )
    ).toContain('aria-label="Team management actions"');
  });
});

describe("resolveDashboardAuthRouteIntent", () => {
  it("redirects missing stored sessions to the sign-in route", async () => {
    const store = authSessionStore();

    await expect(
      resolveDashboardAuthRouteIntent({
        sessionStore: store,
        clock: fixedClock(1000),
        routes: routePaths()
      })
    ).resolves.toEqual({
      action: "redirect",
      route: "signIn",
      path: "/sign-in",
      reason: "missing-session"
    });
    expect(store.loadCount).toBe(1);
  });

  it("allows dashboard access for valid stored sessions", async () => {
    const storedSession = session({
      accessToken: "valid-token",
      expiresAt: 2000
    });

    await expect(
      resolveDashboardAuthRouteIntent({
        sessionStore: authSessionStore(storedSession),
        clock: fixedClock(1000),
        routes: routePaths()
      })
    ).resolves.toEqual({
      action: "allow",
      route: "dashboard",
      path: "/dashboard",
      session: storedSession
    });
  });

  it("redirects expired stored sessions to the session-expired route", async () => {
    const storedSession = session({
      accessToken: "expired-token",
      expiresAt: 1000
    });

    await expect(
      resolveDashboardAuthRouteIntent({
        sessionStore: authSessionStore(storedSession),
        clock: fixedClock(1000),
        expirySkewSeconds: 0,
        routes: routePaths()
      })
    ).resolves.toEqual({
      action: "redirect",
      route: "sessionExpired",
      path: "/session-expired",
      reason: "expired-session",
      session: storedSession
    });
  });

  it("falls back to the sign-in route for expired sessions without an expired route", async () => {
    const storedSession = session({
      accessToken: "expired-token",
      expiresAt: 1000
    });

    await expect(
      resolveDashboardAuthRouteIntent({
        sessionStore: authSessionStore(storedSession),
        clock: fixedClock(1000),
        expirySkewSeconds: 0,
        routes: {
          signIn: "/sign-in",
          dashboard: "/dashboard"
        }
      })
    ).resolves.toEqual({
      action: "redirect",
      route: "signIn",
      path: "/sign-in",
      reason: "expired-session",
      session: storedSession
    });
  });

  it("rejects invalid route paths before loading stored sessions", async () => {
    const store = authSessionStore(session());

    await expect(
      resolveDashboardAuthRouteIntent({
        sessionStore: store,
        clock: fixedClock(1000),
        routes: {
          signIn: "https://app.searchlint.example/sign-in",
          dashboard: "/dashboard",
          sessionExpired: "/session-expired"
        }
      })
    ).rejects.toThrowError(
      new Error("Dashboard auth route signIn must be a non-empty local path.")
    );
    expect(store.loadCount).toBe(0);
  });
});

describe("dashboardMessages", () => {
  it("contains stable message keys for every rendered dashboard label", () => {
    const requiredKeys: readonly DashboardMessageKey[] = [
      "dashboard.title",
      "dashboard.onboarding",
      "dashboard.overview",
      "dashboard.organization",
      "dashboard.site",
      "dashboard.environments",
      "dashboard.issues",
      "dashboard.diagnostics",
      "dashboard.crawlHistory",
      "dashboard.trends",
      "dashboard.externalObservations",
      "dashboard.connectors",
      "dashboard.connectGoogle",
      "dashboard.connectYandex",
      "dashboard.connectionStatus",
      "dashboard.reports",
      "dashboard.quota",
      "dashboard.team",
      "dashboard.billing",
      "dashboard.settings",
      "dashboard.auditLog",
      "dashboard.totalDiagnostics",
      "dashboard.affectedPages",
      "dashboard.latestCrawl",
      "dashboard.severity",
      "dashboard.rule",
      "dashboard.page",
      "dashboard.evidence",
      "dashboard.provider",
      "dashboard.status",
      "dashboard.generatedAt",
      "dashboard.role",
      "dashboard.requested",
      "dashboard.crawledUrls",
      "dashboard.failedUrls",
      "dashboard.date",
      "dashboard.total",
      "dashboard.blockers",
      "dashboard.errors",
      "dashboard.warnings",
      "dashboard.info",
      "dashboard.subject",
      "dashboard.observed",
      "dashboard.summary",
      "dashboard.titleColumn",
      "dashboard.locale",
      "dashboard.name",
      "dashboard.action",
      "dashboard.target",
      "dashboard.path",
      "dashboard.method",
      "dashboard.evidenceStatus"
    ];

    for (const key of requiredKeys) {
      expect(dashboardMessages[key]).toEqual(expect.any(String));
      expect(dashboardMessages[key].length).toBeGreaterThan(0);
    }
  });
});

describe("resolveDashboardProjectRuntimeState", () => {
  it("returns auth redirects before calling the dashboard API", async () => {
    const client = dashboardApiClient();

    await expect(
      resolveDashboardProjectRuntimeState({
        path: createDashboardProjectRoutePath({
          ...routeParams(),
          view: "overview"
        }),
        sessionStore: authSessionStore(),
        clock: fixedClock(1000),
        authRoutes: routePaths(),
        apiClient: client
      })
    ).resolves.toEqual({
      status: "redirect",
      intent: {
        action: "redirect",
        route: "signIn",
        path: "/sign-in",
        reason: "missing-session"
      }
    });
    expect(client.calls).toEqual([]);
  });

  it("loads a dashboard snapshot and renders a valid project route", async () => {
    const client = dashboardApiClient({
      status: 200,
      body: snapshot()
    });

    const result = await resolveDashboardProjectRuntimeState({
      path: createDashboardProjectRoutePath({
        ...routeParams(),
        view: "diagnostics"
      }),
      sessionStore: authSessionStore(session()),
      clock: fixedClock(1000),
      authRoutes: routePaths(),
      apiClient: client
    });

    expect(result).toMatchObject({
      status: "rendered",
      route: {
        params: routeParams(),
        view: "diagnostics"
      },
      session: {
        accessToken: "access-token"
      }
    });
    expect(result.status === "rendered" ? result.html : "").toContain(
      'aria-labelledby="diagnostics-heading"'
    );
    expect(client.calls).toEqual([routeParams()]);
  });

  it("returns notFound for unknown project routes before API calls", async () => {
    const client = dashboardApiClient();

    await expect(
      resolveDashboardProjectRuntimeState({
        path: "/dashboard/not-found",
        sessionStore: authSessionStore(session()),
        clock: fixedClock(1000),
        authRoutes: routePaths(),
        apiClient: client
      })
    ).resolves.toMatchObject({
      status: "notFound",
      path: "/dashboard/not-found"
    });
    expect(client.calls).toEqual([]);
  });

  it("returns snapshotNotFound for 404 dashboard snapshot responses", async () => {
    const client = dashboardApiClient({
      status: 404,
      body: {
        error: "missing"
      }
    });

    await expect(
      resolveDashboardProjectRuntimeState({
        path: createDashboardProjectRoutePath({
          ...routeParams(),
          view: "overview"
        }),
        sessionStore: authSessionStore(session()),
        clock: fixedClock(1000),
        authRoutes: routePaths(),
        apiClient: client
      })
    ).resolves.toMatchObject({
      status: "snapshotNotFound",
      route: {
        params: routeParams(),
        view: "overview"
      }
    });
  });

  it("returns apiError for invalid snapshot bodies and non-success responses", async () => {
    const path = createDashboardProjectRoutePath({
      ...routeParams(),
      view: "overview"
    });

    await expect(
      resolveDashboardProjectRuntimeState({
        path,
        sessionStore: authSessionStore(session()),
        clock: fixedClock(1000),
        authRoutes: routePaths(),
        apiClient: dashboardApiClient({
          status: 200,
          body: {
            invalid: true
          }
        })
      })
    ).resolves.toMatchObject({
      status: "apiError",
      statusCode: 200,
      message: "Dashboard snapshot response body is invalid."
    });

    await expect(
      resolveDashboardProjectRuntimeState({
        path,
        sessionStore: authSessionStore(session()),
        clock: fixedClock(1000),
        authRoutes: routePaths(),
        apiClient: dashboardApiClient({
          status: 503,
          body: {
            error: "unavailable"
          }
        })
      })
    ).resolves.toMatchObject({
      status: "apiError",
      statusCode: 503,
      message: "Dashboard snapshot request returned HTTP 503."
    });
  });
});

describe("runDashboardProjectBrowserRuntime", () => {
  it("redirects missing sessions through the injected navigation port before API calls or rendering", async () => {
    const client = dashboardApiClient();
    const navigation = browserNavigation();
    const renderer = browserRenderer();

    await expect(
      runDashboardProjectBrowserRuntime({
        location: {
          pathname: createDashboardProjectRoutePath({
            ...routeParams(),
            view: "overview"
          })
        },
        navigation,
        renderer,
        sessionStore: authSessionStore(),
        clock: fixedClock(1000),
        authRoutes: routePaths(),
        apiClient: client
      })
    ).resolves.toMatchObject({
      effect: "redirect",
      state: {
        status: "redirect",
        intent: {
          path: "/sign-in"
        }
      }
    });
    expect(navigation.assigned).toEqual(["/sign-in"]);
    expect(renderer.calls).toEqual([]);
    expect(client.calls).toEqual([]);
  });

  it("renders project HTML from the current browser pathname without navigating", async () => {
    const client = dashboardApiClient({
      status: 200,
      body: snapshot()
    });
    const navigation = browserNavigation();
    const renderer = browserRenderer();

    await expect(
      runDashboardProjectBrowserRuntime({
        location: {
          pathname: createDashboardProjectRoutePath({
            ...routeParams(),
            view: "reports",
            basePath: "/app/dashboard"
          })
        },
        basePath: "/app/dashboard",
        navigation,
        renderer,
        sessionStore: authSessionStore(session()),
        clock: fixedClock(1000),
        authRoutes: routePaths(),
        apiClient: client
      })
    ).resolves.toMatchObject({
      effect: "renderHtml",
      state: {
        status: "rendered",
        route: {
          params: routeParams(),
          view: "reports"
        }
      }
    });
    expect(navigation.assigned).toEqual([]);
    expect(renderer.calls).toHaveLength(1);
    expect(renderer.calls[0]).toMatchObject({
      operation: "html"
    });
    expect(
      renderer.calls[0]?.operation === "html" ? renderer.calls[0].html : ""
    ).toContain('aria-labelledby="reports-heading"');
    expect(client.calls).toEqual([routeParams()]);
  });

  it("renders not-found states without dashboard API calls", async () => {
    const client = dashboardApiClient();
    const navigation = browserNavigation();
    const renderer = browserRenderer();

    await expect(
      runDashboardProjectBrowserRuntime({
        location: {
          pathname: "/dashboard/missing"
        },
        navigation,
        renderer,
        sessionStore: authSessionStore(session()),
        clock: fixedClock(1000),
        authRoutes: routePaths(),
        apiClient: client
      })
    ).resolves.toMatchObject({
      effect: "renderNotFound",
      state: {
        status: "notFound",
        path: "/dashboard/missing"
      }
    });
    expect(navigation.assigned).toEqual([]);
    expect(renderer.calls).toEqual([
      {
        operation: "notFound",
        path: "/dashboard/missing",
        session: session()
      }
    ]);
    expect(client.calls).toEqual([]);
  });

  it("renders snapshot-missing and API-error states through typed render ports", async () => {
    const missingRenderer = browserRenderer();

    await expect(
      runDashboardProjectBrowserRuntime({
        location: {
          pathname: createDashboardProjectRoutePath({
            ...routeParams(),
            view: "overview"
          })
        },
        navigation: browserNavigation(),
        renderer: missingRenderer,
        sessionStore: authSessionStore(session()),
        clock: fixedClock(1000),
        authRoutes: routePaths(),
        apiClient: dashboardApiClient({
          status: 404,
          body: {
            error: "missing"
          }
        })
      })
    ).resolves.toMatchObject({
      effect: "renderSnapshotNotFound",
      state: {
        status: "snapshotNotFound"
      }
    });
    expect(missingRenderer.calls).toEqual([
      {
        operation: "snapshotNotFound",
        route: {
          params: routeParams(),
          view: "overview",
          path: createDashboardProjectRoutePath({
            ...routeParams(),
            view: "overview"
          })
        },
        session: session()
      }
    ]);

    const errorRenderer = browserRenderer();

    await expect(
      runDashboardProjectBrowserRuntime({
        location: {
          pathname: createDashboardProjectRoutePath({
            ...routeParams(),
            view: "overview"
          })
        },
        navigation: browserNavigation(),
        renderer: errorRenderer,
        sessionStore: authSessionStore(session()),
        clock: fixedClock(1000),
        authRoutes: routePaths(),
        apiClient: dashboardApiClient({
          status: 503,
          body: {
            error: "unavailable"
          }
        })
      })
    ).resolves.toMatchObject({
      effect: "renderApiError",
      state: {
        status: "apiError",
        statusCode: 503
      }
    });
    expect(errorRenderer.calls).toEqual([
      {
        operation: "apiError",
        path: createDashboardProjectRoutePath({
          ...routeParams(),
          view: "overview"
        }),
        route: {
          params: routeParams(),
          view: "overview",
          path: createDashboardProjectRoutePath({
            ...routeParams(),
            view: "overview"
          })
        },
        statusCode: 503,
        message: "Dashboard snapshot request returned HTTP 503.",
        session: session()
      }
    ]);
  });

  it("rejects invalid browser location pathnames before API, navigation, or render effects", async () => {
    const client = dashboardApiClient();
    const navigation = browserNavigation();
    const renderer = browserRenderer();

    await expect(
      runDashboardProjectBrowserRuntime({
        location: {
          pathname: "//dashboard"
        },
        navigation,
        renderer,
        sessionStore: authSessionStore(session()),
        clock: fixedClock(1000),
        authRoutes: routePaths(),
        apiClient: client
      })
    ).rejects.toThrowError(
      new Error(
        "Dashboard browser runtime location pathname must be a non-empty local path."
      )
    );
    expect(navigation.assigned).toEqual([]);
    expect(renderer.calls).toEqual([]);
    expect(client.calls).toEqual([]);
  });
});

describe("createDashboardProjectBrowserDomRenderer", () => {
  it("renders dashboard HTML into a DOM root with title, focus, and state attributes", () => {
    const root = domRoot();
    const document = { title: "" };
    const renderer = createDashboardProjectBrowserDomRenderer({
      root,
      document
    });
    const html = renderDashboardProjectViewHtml(
      createDashboardProjectViewModel({
        ...routeParams(),
        view: "diagnostics",
        snapshot: snapshot()
      })
    );

    renderer.renderHtml(html);

    expect(root.innerHTML).toBe(html);
    expect(root.attributes).toEqual({
      "data-searchlint-dashboard-state": "rendered"
    });
    expect(document.title).toBe("Diagnostics - SearchLint Dashboard");
    expect(root.focusCount).toBe(1);
  });

  it("renders escaped not-found app-shell state without forcing focus when disabled", () => {
    const root = domRoot();
    const document = { title: "" };
    const renderer = createDashboardProjectBrowserDomRenderer({
      root,
      document,
      focusAfterRender: false
    });

    renderer.renderNotFound({
      path: "/dashboard/<missing>",
      session: session({ subject: "user<&>" })
    });

    expect(root.attributes).toEqual({
      "data-searchlint-dashboard-state": "not-found"
    });
    expect(root.innerHTML).toContain("Dashboard route not found");
    expect(root.innerHTML).toContain("/dashboard/&lt;missing&gt;");
    expect(root.innerHTML).toContain("user&lt;&amp;&gt;");
    expect(document.title).toBe("Dashboard route not found - SearchLint");
    expect(root.focusCount).toBe(0);
  });

  it("renders snapshot-missing and API-error app-shell states with escaped context", () => {
    const root = domRoot();
    const document = { title: "" };
    const renderer = createDashboardProjectBrowserDomRenderer({
      root,
      document
    });
    const route = parseDashboardProjectRoutePath(
      createDashboardProjectRoutePath({
        ...routeParams({
          organizationId: "org<&>",
          projectId: "project-1",
          environmentId: "env-1"
        }),
        view: "overview"
      })
    );
    if (route === undefined) {
      throw new Error("Expected route to parse.");
    }

    renderer.renderSnapshotNotFound({
      route,
      session: session()
    });

    expect(root.attributes).toEqual({
      "data-searchlint-dashboard-state": "snapshot-not-found"
    });
    expect(root.innerHTML).toContain("Dashboard snapshot not found");
    expect(root.innerHTML).toContain("Organization org&lt;&amp;&gt;");
    expect(document.title).toBe("Dashboard snapshot not found - SearchLint");
    expect(root.focusCount).toBe(1);

    renderer.renderApiError({
      path: "/dashboard/<broken>",
      route,
      statusCode: 503,
      message: "Provider <down>",
      session: session()
    });

    expect(root.attributes).toEqual({
      "data-searchlint-dashboard-state": "api-error"
    });
    expect(root.innerHTML).toContain("Dashboard request failed");
    expect(root.innerHTML).toContain("Provider &lt;down&gt;");
    expect(root.innerHTML).toContain("Path /dashboard/&lt;broken&gt;");
    expect(root.innerHTML).toContain("HTTP 503");
    expect(document.title).toBe("Dashboard request failed - SearchLint");
    expect(root.focusCount).toBe(2);
  });
});

describe("createDashboardBrowserHistoryRuntime", () => {
  it("starts from the current location and registers browser history listeners", async () => {
    const path = createDashboardProjectRoutePath({
      ...routeParams(),
      view: "overview"
    });
    const location = browserLocation(path);
    const eventTarget = browserEventTarget();
    const renderer = browserRenderer();
    const runtime = createDashboardBrowserHistoryRuntime({
      location,
      history: browserHistory(location),
      eventTarget,
      navigation: browserNavigation(),
      renderer,
      sessionStore: authSessionStore(session()),
      clock: fixedClock(1000),
      authRoutes: routePaths(),
      apiClient: dashboardApiClient({
        status: 200,
        body: snapshot()
      })
    });

    await expect(runtime.start()).resolves.toMatchObject({
      effect: "renderHtml",
      state: {
        status: "rendered",
        route: {
          view: "overview"
        }
      }
    });
    expect(eventTarget.listenerCount("popstate")).toBe(1);
    expect(eventTarget.listenerCount("click")).toBe(1);
    expect(renderer.calls).toHaveLength(1);
  });

  it("rerenders on popstate for the current location pathname", async () => {
    const location = browserLocation(
      createDashboardProjectRoutePath({
        ...routeParams(),
        view: "overview"
      })
    );
    const eventTarget = browserEventTarget();
    const renderer = browserRenderer();
    const runtime = createDashboardBrowserHistoryRuntime({
      location,
      history: browserHistory(location),
      eventTarget,
      navigation: browserNavigation(),
      renderer,
      sessionStore: authSessionStore(session()),
      clock: fixedClock(1000),
      authRoutes: routePaths(),
      apiClient: dashboardApiClient({
        status: 200,
        body: snapshot()
      })
    });

    await runtime.start();
    location.pathname = createDashboardProjectRoutePath({
      ...routeParams(),
      view: "reports"
    });
    eventTarget.dispatch("popstate");
    await flushAsyncEvents();

    expect(renderer.calls).toHaveLength(2);
    expect(
      renderer.calls[1]?.operation === "html" ? renderer.calls[1].html : ""
    ).toContain('aria-labelledby="reports-heading"');
  });

  it("intercepts local dashboard link clicks, pushes history, and rerenders", async () => {
    const location = browserLocation(
      createDashboardProjectRoutePath({
        ...routeParams(),
        view: "overview",
        basePath: "/app/dashboard"
      })
    );
    const history = browserHistory(location);
    const eventTarget = browserEventTarget();
    const renderer = browserRenderer();
    const runtime = createDashboardBrowserHistoryRuntime({
      location,
      basePath: "/app/dashboard",
      history,
      eventTarget,
      navigation: browserNavigation(),
      renderer,
      sessionStore: authSessionStore(session()),
      clock: fixedClock(1000),
      authRoutes: routePaths(),
      apiClient: dashboardApiClient({
        status: 200,
        body: snapshot()
      })
    });
    const nextPath = createDashboardProjectRoutePath({
      ...routeParams(),
      view: "diagnostics",
      basePath: "/app/dashboard"
    });
    const click = browserClickEvent({
      href: `https://app.searchlint.example${nextPath}`,
      origin: "https://app.searchlint.example",
      pathname: nextPath
    });

    await runtime.start();
    eventTarget.dispatch("click", click);
    await flushAsyncEvents();

    expect(click.prevented).toBe(true);
    expect(history.pushed).toEqual([nextPath]);
    expect(location.pathname).toBe(nextPath);
    expect(renderer.calls).toHaveLength(2);
    expect(
      renderer.calls[1]?.operation === "html" ? renderer.calls[1].html : ""
    ).toContain('aria-labelledby="diagnostics-heading"');
  });

  it("ignores external, modified, non-left, and out-of-base link clicks", async () => {
    const location = browserLocation(
      createDashboardProjectRoutePath({
        ...routeParams(),
        view: "overview",
        basePath: "/app/dashboard"
      })
    );
    const history = browserHistory(location);
    const eventTarget = browserEventTarget();
    const renderer = browserRenderer();
    const runtime = createDashboardBrowserHistoryRuntime({
      location,
      basePath: "/app/dashboard",
      history,
      eventTarget,
      navigation: browserNavigation(),
      renderer,
      sessionStore: authSessionStore(session()),
      clock: fixedClock(1000),
      authRoutes: routePaths(),
      apiClient: dashboardApiClient({
        status: 200,
        body: snapshot()
      })
    });

    await runtime.start();
    const ignoredClicks = [
      browserClickEvent({
        href: "https://external.example/dashboard",
        origin: "https://external.example",
        pathname: "/dashboard"
      }),
      browserClickEvent({
        href: "/app/dashboard/organizations/org-1/projects/project-1/environments/env-1/reports",
        pathname:
          "/app/dashboard/organizations/org-1/projects/project-1/environments/env-1/reports",
        ctrlKey: true
      }),
      browserClickEvent({
        href: "/app/dashboard/organizations/org-1/projects/project-1/environments/env-1/reports",
        pathname:
          "/app/dashboard/organizations/org-1/projects/project-1/environments/env-1/reports",
        button: 1
      }),
      browserClickEvent({
        href: "/settings",
        pathname: "/settings"
      })
    ];

    for (const click of ignoredClicks) {
      eventTarget.dispatch("click", click);
    }
    await flushAsyncEvents();

    expect(ignoredClicks.every((click) => !click.prevented)).toBe(true);
    expect(history.pushed).toEqual([]);
    expect(renderer.calls).toHaveLength(1);
  });

  it("navigates programmatically and rejects invalid paths before history mutation", async () => {
    const location = browserLocation(
      createDashboardProjectRoutePath({
        ...routeParams(),
        view: "overview"
      })
    );
    const history = browserHistory(location);
    const runtime = createDashboardBrowserHistoryRuntime({
      location,
      history,
      eventTarget: browserEventTarget(),
      navigation: browserNavigation(),
      renderer: browserRenderer(),
      sessionStore: authSessionStore(session()),
      clock: fixedClock(1000),
      authRoutes: routePaths(),
      apiClient: dashboardApiClient({
        status: 200,
        body: snapshot()
      })
    });
    const nextPath = createDashboardProjectRoutePath({
      ...routeParams(),
      view: "team"
    });

    await expect(runtime.navigate(nextPath)).resolves.toMatchObject({
      effect: "renderHtml",
      state: {
        status: "rendered",
        route: {
          view: "team"
        }
      }
    });
    await expect(runtime.navigate("//evil.example")).rejects.toThrowError(
      new Error(
        "Dashboard browser navigation path must be a non-empty local path."
      )
    );
    expect(history.pushed).toEqual([nextPath]);
  });

  it("removes listeners on stop and prevents further controller effects", async () => {
    const location = browserLocation(
      createDashboardProjectRoutePath({
        ...routeParams(),
        view: "overview"
      })
    );
    const eventTarget = browserEventTarget();
    const renderer = browserRenderer();
    const runtime = createDashboardBrowserHistoryRuntime({
      location,
      history: browserHistory(location),
      eventTarget,
      navigation: browserNavigation(),
      renderer,
      sessionStore: authSessionStore(session()),
      clock: fixedClock(1000),
      authRoutes: routePaths(),
      apiClient: dashboardApiClient({
        status: 200,
        body: snapshot()
      })
    });

    await runtime.start();
    runtime.stop();
    location.pathname = createDashboardProjectRoutePath({
      ...routeParams(),
      view: "team"
    });
    eventTarget.dispatch("popstate");
    await flushAsyncEvents();

    expect(eventTarget.listenerCount("popstate")).toBe(0);
    expect(eventTarget.listenerCount("click")).toBe(0);
    expect(renderer.calls).toHaveLength(1);
    await expect(
      runtime.navigate(
        createDashboardProjectRoutePath({
          ...routeParams(),
          view: "reports"
        })
      )
    ).rejects.toThrowError(
      new Error("Dashboard browser history runtime has been stopped.")
    );
  });
});

describe("startDashboardBrowserApp", () => {
  it("composes session storage, API client, DOM renderer, and history runtime", async () => {
    const path = createDashboardProjectRoutePath({
      ...routeParams(),
      view: "diagnostics"
    });
    const root = domRoot();
    const document = { title: "" };
    const location = browserLocation(path);
    const history = browserHistory(location);
    const eventTarget = browserEventTarget();
    const navigation = browserNavigation();
    const storage = memoryStorage([
      [
        "searchlint:test-session:current",
        JSON.stringify(session({ expiresAt: 2000, refreshToken: "refresh-1" }))
      ]
    ]);
    const apiCalls: FetchCall[] = [];

    const app = await startDashboardBrowserApp({
      root,
      document,
      location,
      history,
      eventTarget,
      navigation,
      storage,
      clock: fixedClock(1000),
      authRoutes: routePaths(),
      apiBaseUrl: "https://api.searchlint.example",
      apiFetch: fetchJson(apiCalls, {
        status: 200,
        body: snapshot()
      }),
      tokenFetch: tokenFetchJson([]),
      cognitoHostedUiDomain: "https://auth.searchlint.example",
      cognitoClientId: "client-1",
      sessionStorageNamespace: "searchlint:test-session"
    });

    expect(app.initialResult).toMatchObject({
      effect: "renderHtml",
      state: {
        status: "rendered",
        route: {
          view: "diagnostics"
        }
      }
    });
    expect(root.innerHTML).toContain('aria-labelledby="diagnostics-heading"');
    expect(root.attributes).toEqual({
      "data-searchlint-dashboard-state": "rendered"
    });
    expect(document.title).toBe("Diagnostics - SearchLint Dashboard");
    expect(eventTarget.listenerCount("popstate")).toBe(1);
    expect(eventTarget.listenerCount("click")).toBe(1);
    expect(apiCalls).toHaveLength(1);
    expect(apiCalls[0]?.url).toBe(
      "https://api.searchlint.example/v1/organizations/org-1/projects/project-1/environments/env-1/dashboard-snapshot"
    );
    expect(apiCalls[0]?.init.headers.authorization).toBe("Bearer access-token");

    const nextPath = createDashboardProjectRoutePath({
      ...routeParams(),
      view: "team"
    });
    await app.navigate(nextPath);
    expect(history.pushed).toEqual([nextPath]);
    expect(root.innerHTML).toContain('aria-labelledby="team-heading"');

    app.stop();
    expect(eventTarget.listenerCount("popstate")).toBe(0);
    expect(eventTarget.listenerCount("click")).toBe(0);
  });

  it("validates config before browser app side effects", async () => {
    const root = domRoot();
    const location = browserLocation("/dashboard");
    const eventTarget = browserEventTarget();
    const navigation = browserNavigation();
    const storage = memoryStorage();
    const apiCalls: FetchCall[] = [];

    await expect(
      startDashboardBrowserApp({
        root,
        location,
        history: browserHistory(location),
        eventTarget,
        navigation,
        storage,
        clock: fixedClock(1000),
        authRoutes: routePaths(),
        apiBaseUrl: "/relative",
        apiFetch: fetchJson(apiCalls, {
          status: 200,
          body: snapshot()
        }),
        tokenFetch: tokenFetchJson([]),
        cognitoHostedUiDomain: "https://auth.searchlint.example",
        cognitoClientId: "client-1"
      })
    ).rejects.toThrowError(
      new Error(
        "Dashboard browser app apiBaseUrl must be an absolute HTTP(S) URL."
      )
    );

    expect(root.innerHTML).toBe("");
    expect(eventTarget.listenerCount("popstate")).toBe(0);
    expect(navigation.assigned).toEqual([]);
    expect(apiCalls).toEqual([]);
  });
});

describe("startDashboardHostedBrowserEntry", () => {
  it("reads hosted shell config and starts the dashboard browser app", async () => {
    const path = createDashboardProjectRoutePath({
      ...routeParams(),
      view: "overview"
    });
    const apiCalls: FetchCall[] = [];
    const storage = memoryStorage([
      [
        "searchlint:test-session:current",
        JSON.stringify(session({ expiresAt: 2000, refreshToken: "refresh-1" }))
      ]
    ]);
    const entry = browserEntryWindow({
      path,
      storage,
      apiFetch: fetchJson(apiCalls, {
        status: 200,
        body: snapshot()
      })
    });

    const app = await startDashboardHostedBrowserEntry({
      window: entry.window,
      clock: fixedClock(1000)
    });

    expect(app.initialResult.effect).toBe("renderHtml");
    expect(entry.root.innerHTML).toContain(
      'aria-labelledby="overview-heading"'
    );
    expect(entry.root.attributes).toEqual({
      "data-searchlint-dashboard-state": "rendered"
    });
    expect(entry.document.title).toBe(
      "Project Overview - SearchLint Dashboard"
    );
    expect(entry.windowTarget.listenerCount("popstate")).toBe(1);
    expect(entry.documentTarget.listenerCount("click")).toBe(1);
    expect(apiCalls).toHaveLength(1);
    expect(apiCalls[0]?.url).toBe(
      "https://api.searchlint.example/v1/organizations/org-1/projects/project-1/environments/env-1/dashboard-snapshot"
    );

    app.stop();
    expect(entry.windowTarget.listenerCount("popstate")).toBe(0);
    expect(entry.documentTarget.listenerCount("click")).toBe(0);
  });

  it("rejects missing shell elements before startup side effects", async () => {
    const apiCalls: FetchCall[] = [];
    const entry = browserEntryWindow({
      apiFetch: fetchJson(apiCalls, {
        status: 200,
        body: snapshot()
      })
    });
    entry.elements.delete("searchlint-dashboard-root");

    await expect(
      startDashboardHostedBrowserEntry({
        window: entry.window,
        clock: fixedClock(1000)
      })
    ).rejects.toThrowError(
      new Error(
        "Dashboard browser entry root #searchlint-dashboard-root was not found."
      )
    );

    expect(apiCalls).toEqual([]);
    expect(entry.windowTarget.listenerCount("popstate")).toBe(0);
    expect(entry.documentTarget.listenerCount("click")).toBe(0);
  });

  it("rejects malformed config JSON before startup side effects", async () => {
    const apiCalls: FetchCall[] = [];
    const entry = browserEntryWindow({
      apiFetch: fetchJson(apiCalls, {
        status: 200,
        body: snapshot()
      })
    });
    const configScript = entry.elements.get("searchlint-dashboard-config");
    if (configScript !== undefined) {
      configScript.textContent = "{";
    }

    await expect(
      startDashboardHostedBrowserEntry({
        window: entry.window,
        clock: fixedClock(1000)
      })
    ).rejects.toThrowError(
      /Dashboard browser entry config script #searchlint-dashboard-config contains invalid JSON/
    );

    expect(apiCalls).toEqual([]);
    expect(entry.windowTarget.listenerCount("popstate")).toBe(0);
    expect(entry.documentTarget.listenerCount("click")).toBe(0);
  });

  it("rejects invalid browser entry ports deterministically", async () => {
    const entry = browserEntryWindow();
    const invalidWindow = {
      ...entry.window,
      fetch: undefined
    } as unknown as DashboardBrowserEntryWindowPort;

    await expect(
      startDashboardHostedBrowserEntry({
        window: invalidWindow,
        clock: fixedClock(1000)
      })
    ).rejects.toThrowError(
      new Error(
        "Dashboard browser app entry window.fetch function is required."
      )
    );
  });
});

describe("dashboard browser entry package module", () => {
  it("starts the hosted browser entry with an explicit window port", async () => {
    const apiCalls: FetchCall[] = [];
    const globalScope: SearchLintDashboardBrowserGlobalScope = {};
    const entry = browserEntryWindow({
      storage: memoryStorage([
        [
          "searchlint:test-session:current",
          JSON.stringify(
            session({ expiresAt: 2000, refreshToken: "refresh-1" })
          )
        ]
      ]),
      apiFetch: fetchJson(apiCalls, {
        status: 200,
        body: snapshot()
      })
    });

    const appPromise = startSearchLintDashboardBrowserEntry({
      window: entry.window,
      globalScope,
      clock: fixedClock(1000)
    });

    expect(globalScope.__SEARCHLINT_DASHBOARD_APP__).toBe(appPromise);

    const app = await appPromise;
    expect(app.initialResult.effect).toBe("renderHtml");
    expect(entry.root.innerHTML).toContain(
      'aria-labelledby="overview-heading"'
    );
    expect(apiCalls).toHaveLength(1);

    app.stop();
  });

  it("starts from global window and configured shell IDs", async () => {
    const apiCalls: FetchCall[] = [];
    const entry = browserEntryWindow({
      storage: memoryStorage([
        [
          "searchlint:test-session:current",
          JSON.stringify(
            session({ expiresAt: 2000, refreshToken: "refresh-1" })
          )
        ]
      ]),
      apiFetch: fetchJson(apiCalls, {
        status: 200,
        body: snapshot()
      })
    });
    const customRoot: TestBrowserEntryElement = domRoot();
    const customConfig: TestBrowserEntryElement = {
      ...domRoot(),
      textContent: JSON.stringify(hostedShellBootstrapConfig())
    };
    entry.elements.set("custom-root", customRoot);
    entry.elements.set("custom-config", customConfig);
    const globalScope: SearchLintDashboardBrowserGlobalScope = {
      window: entry.window,
      __SEARCHLINT_DASHBOARD_ENTRY_OPTIONS__: {
        rootId: "custom-root",
        configScriptId: "custom-config",
        clock: fixedClock(1000)
      }
    };

    const app =
      await startSearchLintDashboardBrowserEntryFromGlobal(globalScope);

    expect(globalScope.__SEARCHLINT_DASHBOARD_APP__).toBeInstanceOf(Promise);
    expect(customRoot.innerHTML).toContain(
      'aria-labelledby="overview-heading"'
    );
    expect(entry.root.innerHTML).toBe("");
    expect(apiCalls).toHaveLength(1);

    app.stop();
  });

  it("rejects missing global window deterministically", () => {
    expect(() =>
      startSearchLintDashboardBrowserEntry({
        globalScope: {}
      })
    ).toThrowError(
      new Error("SearchLint dashboard browser entry requires a window port.")
    );
  });

  it("exposes package subpath exports for browser entry modules", () => {
    const manifest = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8")
    ) as {
      exports: Record<string, { types: string; import: string }>;
      searchlint: {
        dashboardBrowserAssets: Array<{
          name: string;
          manifest: string;
          moduleScript: string;
          modules: Array<{
            name: string;
            source: string;
            asset: string;
            moduleScript: string;
          }>;
          bundle: {
            name: string;
            asset: string;
            moduleScript: string;
          };
          importMap: {
            imports: Record<
              string,
              {
                name: string;
                source: string;
                asset: string;
                moduleScript: string;
              }
            >;
          };
        }>;
      };
    };

    expect(manifest.exports["./browser-entry"]).toEqual({
      types: "./dist/src/browser-entry.d.ts",
      import: "./dist/src/browser-entry.js"
    });
    expect(manifest.exports["./browser-entry.auto"]).toEqual({
      types: "./dist/src/browser-entry.auto.d.ts",
      import: "./dist/src/browser-entry.auto.js"
    });
    expect(manifest.searchlint.dashboardBrowserAssets).toEqual([
      {
        name: "searchlint-dashboard-browser-entry",
        manifest: "dist/assets/searchlint-dashboard-assets.json",
        moduleScript: "/assets/searchlint-dashboard/browser-entry.auto.js",
        bundle: {
          name: "searchlint-dashboard-browser-entry-bundle",
          asset:
            "dist/assets/searchlint-dashboard/searchlint-dashboard.bundle.min.js",
          moduleScript:
            "/assets/searchlint-dashboard/searchlint-dashboard.bundle.min.js"
        },
        modules: [
          {
            name: "searchlint-dashboard-browser-entry-auto",
            source: "dist/src/browser-entry.auto.js",
            asset: "dist/assets/searchlint-dashboard/browser-entry.auto.js",
            moduleScript: "/assets/searchlint-dashboard/browser-entry.auto.js"
          },
          {
            name: "searchlint-dashboard-browser-entry",
            source: "dist/src/browser-entry.js",
            asset: "dist/assets/searchlint-dashboard/browser-entry.js",
            moduleScript: "/assets/searchlint-dashboard/browser-entry.js"
          },
          {
            name: "searchlint-dashboard-index",
            source: "dist/src/index.js",
            asset: "dist/assets/searchlint-dashboard/index.js",
            moduleScript: "/assets/searchlint-dashboard/index.js"
          },
          {
            name: "searchlint-dashboard-api-client",
            source: "dist/src/api-client.js",
            asset: "dist/assets/searchlint-dashboard/api-client.js",
            moduleScript: "/assets/searchlint-dashboard/api-client.js"
          }
        ],
        importMap: {
          imports: {
            "@searchlint/api/http-contracts": {
              name: "searchlint-api-http-contracts",
              source: "../../services/api/dist/src/http-contracts.js",
              asset:
                "dist/assets/searchlint-dashboard/vendor/searchlint-api/http-contracts.js",
              moduleScript:
                "/assets/searchlint-dashboard/vendor/searchlint-api/http-contracts.js"
            }
          }
        }
      }
    ]);
  });
});

describe("renderDashboardHostedHtmlShell", () => {
  it("renders a hostable dashboard shell with config JSON and module entry", () => {
    const html = renderDashboardHostedHtmlShell({
      title: "SearchLint Cloud",
      rootId: "dashboard-root",
      configScriptId: "dashboard-config",
      entryModuleUrl: "/assets/dashboard.js",
      importMap: {
        imports: {
          "@searchlint/api/http-contracts":
            "/assets/vendor/searchlint-api/http-contracts.js"
        }
      },
      stylesheetUrls: ["/assets/dashboard.css"],
      cspNonce: "nonce-1",
      bootstrapConfig: hostedShellBootstrapConfig()
    });

    expect(html).toContain("<!doctype html>");
    expect(html).toContain('<html lang="en">');
    expect(html).toContain("<title>SearchLint Cloud</title>");
    expect(html).toContain(
      '<div id="dashboard-root" data-searchlint-dashboard-state="booting"'
    );
    expect(html).toContain(
      '<script id="dashboard-config" type="application/json" nonce="nonce-1">'
    );
    expect(html).toContain(
      '<script type="importmap" nonce="nonce-1">{"imports":{"@searchlint/api/http-contracts":"/assets/vendor/searchlint-api/http-contracts.js"}}</script>'
    );
    expect(html).toContain(
      '<script type="module" src="/assets/dashboard.js" nonce="nonce-1"></script>'
    );
    expect(html.indexOf('type="importmap"')).toBeLessThan(
      html.indexOf('type="module"')
    );
    expect(html).toContain(
      '<link rel="stylesheet" href="/assets/dashboard.css">'
    );
    expect(html).toContain('"apiBaseUrl":"https://api.searchlint.example"');
    expect(html).toContain('"dashboard":"/dashboard"');
  });

  it("escapes shell text, script JSON, and stylesheet URLs", () => {
    const html = renderDashboardHostedHtmlShell({
      title: "Dashboard <Cloud>",
      rootId: "dashboard-root",
      configScriptId: "dashboard-config",
      entryModuleUrl: "/assets/dashboard.js",
      importMap: {
        imports: {
          "@searchlint/api/http-contracts":
            "/assets/vendor/http-contracts.js?name=</script>"
        }
      },
      stylesheetUrls: ["/assets/dashboard.css?name=<style>"],
      bootstrapConfig: {
        ...hostedShellBootstrapConfig(),
        headers: {
          "x-searchlint-test": "</script><script>alert(1)</script>"
        }
      }
    });

    expect(html).toContain("<title>Dashboard &lt;Cloud&gt;</title>");
    expect(html).toContain(
      '<link rel="stylesheet" href="/assets/dashboard.css?name=&lt;style&gt;">'
    );
    expect(html).toContain("\\u003c/script\\u003e");
    expect(html).not.toContain("</script><script>alert(1)</script>");
  });

  it("converts generated dashboard asset manifests into hosted shell asset config", () => {
    const manifest: DashboardHostedBrowserAssetManifest = {
      entry: {
        name: "searchlint-dashboard-browser-entry",
        moduleScript: "/assets/searchlint-dashboard/browser-entry.auto.js"
      },
      importMap: {
        imports: {
          "@searchlint/api/http-contracts":
            "/assets/searchlint-dashboard/vendor/searchlint-api/http-contracts.js"
        }
      }
    };

    expect(dashboardHostedShellAssetsFromManifest(manifest)).toEqual({
      entryModuleUrl: "/assets/searchlint-dashboard/browser-entry.auto.js",
      importMap: {
        imports: {
          "@searchlint/api/http-contracts":
            "/assets/searchlint-dashboard/vendor/searchlint-api/http-contracts.js"
        }
      }
    });
  });

  it("rejects invalid shell configuration deterministically", () => {
    expect(() =>
      renderDashboardHostedHtmlShell({
        entryModuleUrl: "javascript:alert(1)",
        bootstrapConfig: hostedShellBootstrapConfig()
      })
    ).toThrowError(
      new Error(
        "Dashboard hosted shell entryModuleUrl must be a local path or absolute HTTP(S) URL."
      )
    );

    expect(() =>
      renderDashboardHostedHtmlShell({
        rootId: "bad id",
        entryModuleUrl: "/assets/dashboard.js",
        bootstrapConfig: hostedShellBootstrapConfig()
      })
    ).toThrowError(
      new Error("Dashboard hosted shell rootId must not contain spaces.")
    );

    expect(() =>
      renderDashboardHostedHtmlShell({
        entryModuleUrl: "/assets/dashboard.js",
        importMap: {
          imports: {
            "./relative": "/assets/relative.js"
          }
        },
        bootstrapConfig: hostedShellBootstrapConfig()
      })
    ).toThrowError(
      new Error(
        "Dashboard hosted shell importMap specifier must be a non-empty bare specifier."
      )
    );

    expect(() =>
      dashboardHostedShellAssetsFromManifest({
        entry: {
          name: "searchlint-dashboard-browser-entry",
          moduleScript: "javascript:alert(1)"
        }
      })
    ).toThrowError(
      new Error(
        "Dashboard hosted shell entry.moduleScript must be a local path or absolute HTTP(S) URL."
      )
    );

    expect(() =>
      renderDashboardHostedHtmlShell({
        entryModuleUrl: "/assets/dashboard.js",
        bootstrapConfig: {
          ...hostedShellBootstrapConfig(),
          apiBaseUrl: "/relative"
        }
      })
    ).toThrowError(
      new Error(
        "Dashboard browser app apiBaseUrl must be an absolute HTTP(S) URL."
      )
    );
  });
});

describe("renderDashboardHtml", () => {
  it("renders accessible landmarks, section labels, and exploration tables", () => {
    const html = renderDashboardHtml(snapshot());

    expect(html).toContain("<!doctype html>");
    expect(html).toContain('<nav aria-label="Dashboard sections">');
    expect(html).toContain("<main>");
    expect(html).toContain('aria-labelledby="overview-heading"');
    expect(html).toContain('aria-labelledby="diagnostics-heading"');
    expect(html).toContain('aria-label="Diagnostics"');
    expect(html).toContain('aria-label="Crawl History"');
    expect(html).toContain('aria-label="External Observations"');
    expect(html).toContain('aria-label="Reports"');
    expect(html).toContain('aria-label="Team"');
    expect(html).toContain("SL-META-001");
    expect(html.indexOf("SL-META-001")).toBeLessThan(
      html.indexOf("SL-META-002")
    );
  });

  it("escapes user-controlled dashboard data", () => {
    const html = renderDashboardHtml(
      snapshot({
        project: {
          id: "project-1",
          name: "Unsafe <Project>",
          siteUrl: "https://example.com?q=<script>"
        },
        diagnostics: [
          diagnostic({
            ruleId: "SL-XSS-001",
            title: "Unsafe",
            evidence: 'Evidence with <script> & "quote"',
            pageUrl: "https://example.com/<page>"
          })
        ],
        externalObservations: [
          {
            id: "observation-1",
            provider: "google",
            subjectUrl: "https://example.com/<url>",
            status: "fresh",
            observedAt: "2026-06-21T00:00:00.000Z",
            fetchedAt: "2026-06-21T00:01:00.000Z",
            summary: "Summary <unsafe>"
          }
        ]
      })
    );

    expect(html).toContain("Unsafe &lt;Project&gt;");
    expect(html).toContain(
      "Evidence with &lt;script&gt; &amp; &quot;quote&quot;"
    );
    expect(html).toContain("https://example.com/&lt;page&gt;");
    expect(html).toContain("Summary &lt;unsafe&gt;");
    expect(html).not.toContain("<script>");
  });
});

function snapshot(
  overrides: Partial<DashboardSnapshot> = {}
): DashboardSnapshot {
  return {
    organization: {
      id: "org-1",
      name: "Acme Agency"
    },
    project: {
      id: "project-1",
      name: "Example Store",
      siteUrl: "https://example.com"
    },
    environment: {
      id: "env-1",
      name: "Production",
      baseUrl: "https://example.com"
    },
    organizationSwitchTargets: [
      {
        organizationId: "org-2",
        organizationName: "Beta Studio",
        projectId: "project-2",
        projectName: "Beta Docs",
        environmentId: "env-2",
        environmentName: "Production"
      }
    ],
    projectManagement: [
      {
        id: "project-2",
        name: "Beta Storefront",
        siteUrl: "https://beta.example.com",
        environmentCount: 2,
        openDiagnostics: 4,
        latestCrawlStatus: "running"
      }
    ],
    diagnostics: [
      diagnostic({
        ruleId: "SL-META-002",
        severity: "warning",
        pageUrl: "https://example.com/b",
        fingerprint: "b"
      }),
      diagnostic({
        ruleId: "SL-META-001",
        severity: "blocker",
        pageUrl: "https://example.com/a",
        fingerprint: "a"
      }),
      diagnostic({
        ruleId: "SL-HTTP-001",
        severity: "error",
        pageUrl: "https://example.com/a",
        fingerprint: "c"
      })
    ],
    crawlRuns: [
      {
        id: "crawl-old",
        status: "failed",
        requestedAt: "2026-06-20T00:00:00.000Z",
        finishedAt: "2026-06-20T00:03:00.000Z",
        crawledUrls: 10,
        failedUrls: 2
      },
      {
        id: "crawl-new",
        status: "succeeded",
        requestedAt: "2026-06-21T00:00:00.000Z",
        finishedAt: "2026-06-21T00:04:00.000Z",
        crawledUrls: 40,
        failedUrls: 0
      }
    ],
    crawlSchedules: [
      {
        id: "schedule-paused",
        name: "Paused launch crawl",
        cadence: "daily",
        enabled: false,
        nextRunAt: "2026-06-24T00:00:00.000Z",
        lastRunAt: "2026-06-20T00:00:00.000Z",
        targetUrlCount: 25
      },
      {
        id: "schedule-weekly",
        name: "Weekly full crawl",
        cadence: "weekly",
        enabled: true,
        nextRunAt: "2026-06-23T00:00:00.000Z",
        lastRunAt: "2026-06-16T00:00:00.000Z",
        targetUrlCount: 1000
      }
    ],
    trends: [
      {
        date: "2026-06-21",
        diagnostics: 3,
        blockers: 1,
        errors: 1,
        warnings: 1,
        infos: 0
      }
    ],
    deploymentHistory: [
      {
        id: "deploy-new",
        deployedAt: "2026-06-22T00:10:00.000Z",
        environmentName: "Production",
        commitRef: "abc1234",
        status: "succeeded",
        diagnosticsBefore: 7,
        diagnosticsAfter: 3,
        annotation: "Homepage metadata fix"
      }
    ],
    externalObservations: [
      {
        id: "obs-google",
        provider: "google",
        subjectUrl: "https://example.com/a",
        status: "fresh",
        observedAt: "2026-06-21T00:00:00.000Z",
        fetchedAt: "2026-06-21T00:01:00.000Z",
        summary: "Indexed"
      },
      {
        id: "obs-yandex",
        provider: "yandex",
        subjectUrl: "https://example.com/b",
        status: "stale",
        observedAt: "2026-06-19T00:00:00.000Z",
        fetchedAt: "2026-06-19T00:01:00.000Z",
        summary: "Freshness expired"
      }
    ],
    reports: [
      {
        id: "report-1",
        title: "Weekly SEO Report",
        generatedAt: "2026-06-21T00:00:00.000Z",
        locale: "en",
        totalDiagnostics: 3
      }
    ],
    quotas: [
      {
        label: "Monthly crawled URLs",
        used: 1000,
        limit: 1000
      }
    ],
    billing: {
      planTier: "team",
      status: "active",
      source: "stripe",
      currentPeriodEnd: "2026-07-01T00:00:00.000Z",
      overagePolicy: "hard-cap",
      invoices: [
        {
          id: "in_1",
          status: "paid",
          amountDueCents: 4900,
          currency: "usd",
          dueAt: "2026-06-30T00:00:00.000Z"
        }
      ]
    },
    agency: {
      clientCount: 2,
      activeClientCount: 2,
      projectCount: 3,
      openDiagnostics: 42,
      blockerDiagnostics: 5,
      averageHealthScore: 81.67,
      overdueSlaCount: 1,
      brandLabel: "Acme SEO",
      billingStatus: "limit-reached",
      clients: [
        {
          id: "client-a",
          clientName: "Acme Retail",
          status: "active",
          projectCount: 2,
          openDiagnostics: 36,
          blockerDiagnostics: 5,
          healthScore: 76.5,
          slaStatus: "overdue",
          assignee: "principal-analyst"
        },
        {
          id: "client-b",
          clientName: "Beta SaaS",
          status: "active",
          projectCount: 1,
          openDiagnostics: 6,
          blockerDiagnostics: 0,
          healthScore: 92,
          slaStatus: "on-track",
          assignee: "principal-owner"
        }
      ]
    },
    teamMembers: [
      {
        principalId: "principal-2",
        displayName: "Developer",
        role: "developer"
      },
      {
        principalId: "principal-1",
        displayName: "Owner",
        role: "owner"
      }
    ],
    notificationChannels: [
      {
        id: "email-1",
        kind: "email",
        name: "SEO email alerts",
        targetDisplay: "a***@example.com",
        enabled: true
      },
      {
        id: "slack-1",
        kind: "slack",
        name: "SEO Slack alerts",
        targetDisplay: "#seo-alerts",
        enabled: true
      },
      {
        id: "webhook-1",
        kind: "webhook",
        name: "Webhook automation",
        targetDisplay: "https://hooks.example.test/searchlint",
        enabled: false
      },
      {
        id: "telegram-1",
        kind: "telegram",
        name: "Telegram operator",
        targetDisplay: "telegram-chat",
        enabled: true
      }
    ],
    notificationRules: [
      {
        id: "rule-1",
        name: "Blocker alerts",
        eventKinds: ["diagnostic.created"],
        channelIds: ["email-1", "slack-1"],
        severityThreshold: "blocker",
        digest: "immediate",
        enabled: true
      },
      {
        id: "rule-2",
        name: "Daily stale observations digest",
        eventKinds: ["external_observation.stale"],
        channelIds: ["webhook-1"],
        digest: "daily",
        enabled: true,
        snoozedUntil: "2026-06-22T18:00:00.000Z"
      }
    ],
    notificationDeliveryAttempts: [
      {
        id: "attempt-2",
        channelKind: "webhook",
        status: "retry_scheduled",
        attemptedAt: "2026-06-22T12:05:00.000Z",
        attempt: 1,
        failureReason: "HTTP 503 from provider.",
        nextRetryAt: "2026-06-22T12:10:00.000Z"
      },
      {
        id: "attempt-1",
        channelKind: "email",
        status: "delivered",
        attemptedAt: "2026-06-22T12:00:00.000Z",
        attempt: 1
      }
    ],
    ...overrides
  };
}

function diagnostic(overrides: Partial<Diagnostic> = {}): Diagnostic {
  return {
    id: "diagnostic-1",
    ruleId: "SL-META-001",
    severity: "warning",
    confidence: "certain",
    pageUrl: "https://example.com/",
    source: "raw-html",
    title: "Missing title",
    evidence: "No title element was found.",
    observedAt: "2026-06-21T00:00:00.000Z",
    fingerprint: "fingerprint-1",
    ...overrides
  };
}

function routePaths() {
  return {
    signIn: "/sign-in",
    dashboard: "/dashboard",
    sessionExpired: "/session-expired"
  };
}

function hostedShellBootstrapConfig(
  overrides: Partial<DashboardHostedShellBootstrapConfig> = {}
): DashboardHostedShellBootstrapConfig {
  return {
    apiBaseUrl: "https://api.searchlint.example",
    cognitoHostedUiDomain: "https://auth.searchlint.example",
    cognitoClientId: "client-1",
    authRoutes: routePaths(),
    basePath: "/dashboard",
    sessionStorageNamespace: "searchlint:test-session",
    ...overrides
  };
}

function routeParams(
  overrides: Partial<DashboardProjectRouteParams> = {}
): DashboardProjectRouteParams {
  return {
    organizationId: "org-1",
    projectId: "project-1",
    environmentId: "env-1",
    ...overrides
  };
}

function fixedClock(now: number) {
  return {
    now: () => now
  };
}

type TestDashboardApiClient = DashboardApiClient & {
  calls: DashboardProjectRouteParams[];
};

type FetchCall = {
  url: string;
  init: DashboardApiFetchRequestInit;
};

type TokenFetchCall = {
  url: string;
  init: DashboardCognitoTokenFetchRequestInit;
};

type TestBrowserNavigation = {
  assigned: string[];
  assign(path: string): void;
};

type BrowserRendererCall =
  | {
      operation: "html";
      html: string;
    }
  | {
      operation: "notFound";
      path: string;
      session: DashboardAuthSession;
    }
  | {
      operation: "snapshotNotFound";
      route: ReturnType<typeof parseDashboardProjectRoutePath>;
      session: DashboardAuthSession;
    }
  | {
      operation: "apiError";
      path: string;
      route?: ReturnType<typeof parseDashboardProjectRoutePath>;
      statusCode?: number;
      message: string;
      session: DashboardAuthSession;
    };

type TestBrowserRenderer = DashboardProjectBrowserRuntimeRenderer & {
  calls: BrowserRendererCall[];
};

type TestDomRoot = {
  innerHTML: string;
  attributes: Record<string, string>;
  focusCount: number;
  setAttribute(name: string, value: string): void;
  focus(): void;
};

type TestBrowserLocation = {
  pathname: string;
  origin: string;
};

type TestBrowserEntryLocation = TestBrowserLocation & {
  assigned: string[];
  assign(url: string): void;
};

type TestBrowserHistory = {
  pushed: string[];
  pushState(state: unknown, title: string, url: string): void;
};

type TestBrowserEventTarget = {
  addEventListener(type: string, listener: (event?: unknown) => void): void;
  removeEventListener(type: string, listener: (event?: unknown) => void): void;
  dispatch(type: string, event?: unknown): void;
  listenerCount(type: string): number;
};

type TestBrowserClickEvent = {
  button?: number;
  defaultPrevented: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  prevented: boolean;
  target: {
    closest(selector: string): {
      href: string;
      origin?: string;
      pathname?: string;
      search?: string;
      hash?: string;
      target?: string;
      getAttribute(name: string): string | null;
    } | null;
  };
  preventDefault(): void;
};

type TestStorage = DashboardBrowserStorageLike & {
  entries(): [string, string][];
};

type TestBrowserEntryElement = TestDomRoot & {
  textContent?: string | null;
};

type TestBrowserEntryDocument = {
  title: string;
  getElementById(id: string): TestBrowserEntryElement | null;
  addEventListener(type: string, listener: (event?: unknown) => void): void;
  removeEventListener(type: string, listener: (event?: unknown) => void): void;
};

function fetchJson(
  calls: FetchCall[],
  response: { status: number; body: unknown }
): DashboardApiFetch {
  return async (url, init) => {
    calls.push({ url, init });
    return {
      status: response.status,
      headers: {
        get(name) {
          return name.toLowerCase() === "content-type"
            ? "application/json"
            : null;
        }
      },
      async json() {
        return response.body;
      }
    };
  };
}

function tokenFetchJson(calls: TokenFetchCall[]): DashboardCognitoTokenFetch {
  return async (url, init) => {
    calls.push({ url, init });
    return {
      status: 200,
      headers: {
        get(name) {
          return name.toLowerCase() === "content-type"
            ? "application/json"
            : null;
        }
      },
      async json() {
        return {
          access_token: "refreshed-access-token",
          refresh_token: "refresh-1",
          token_type: "Bearer",
          expires_in: 3600
        };
      }
    };
  };
}

function memoryStorage(
  initialEntries: readonly [string, string][] = []
): TestStorage {
  const values = new Map(initialEntries);
  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
    removeItem(key) {
      values.delete(key);
    },
    entries() {
      return [...values.entries()].sort(([left], [right]) =>
        left.localeCompare(right)
      );
    }
  };
}

function browserNavigation(): TestBrowserNavigation {
  return {
    assigned: [],
    assign(path) {
      this.assigned.push(path);
    }
  };
}

function browserRenderer(): TestBrowserRenderer {
  return {
    calls: [],
    renderHtml(html) {
      this.calls.push({
        operation: "html",
        html
      });
    },
    renderNotFound(input) {
      this.calls.push({
        operation: "notFound",
        path: input.path,
        session: input.session
      });
    },
    renderSnapshotNotFound(input) {
      this.calls.push({
        operation: "snapshotNotFound",
        route: input.route,
        session: input.session
      });
    },
    renderApiError(input) {
      this.calls.push({
        operation: "apiError",
        path: input.path,
        ...(input.route === undefined ? {} : { route: input.route }),
        ...(input.statusCode === undefined
          ? {}
          : { statusCode: input.statusCode }),
        message: input.message,
        session: input.session
      });
    }
  };
}

function domRoot(): TestDomRoot {
  return {
    innerHTML: "",
    attributes: {},
    focusCount: 0,
    setAttribute(name, value) {
      this.attributes[name] = value;
    },
    focus() {
      this.focusCount += 1;
    }
  };
}

function browserLocation(pathname: string): TestBrowserLocation {
  return {
    pathname,
    origin: "https://app.searchlint.example"
  };
}

function browserEntryLocation(pathname: string): TestBrowserEntryLocation {
  return {
    pathname,
    origin: "https://app.searchlint.example",
    assigned: [],
    assign(url) {
      this.assigned.push(url);
    }
  };
}

function browserHistory(location: TestBrowserLocation): TestBrowserHistory {
  return {
    pushed: [],
    pushState(_state, _title, url) {
      this.pushed.push(url);
      location.pathname = url;
    }
  };
}

function browserEventTarget(): TestBrowserEventTarget {
  const listeners = new Map<string, Set<(event?: unknown) => void>>();
  return {
    addEventListener(type, listener) {
      const typeListeners = listeners.get(type) ?? new Set();
      typeListeners.add(listener);
      listeners.set(type, typeListeners);
    },
    removeEventListener(type, listener) {
      listeners.get(type)?.delete(listener);
    },
    dispatch(type, event) {
      for (const listener of listeners.get(type) ?? []) {
        listener(event);
      }
    },
    listenerCount(type) {
      return listeners.get(type)?.size ?? 0;
    }
  };
}

function browserEntryWindow(
  input: {
    path?: string;
    storage?: TestStorage;
    apiFetch?: DashboardApiFetch;
    bootstrapConfig?: DashboardHostedShellBootstrapConfig;
  } = {}
): {
  window: DashboardBrowserEntryWindowPort;
  root: TestBrowserEntryElement;
  document: TestBrowserEntryDocument;
  windowTarget: TestBrowserEventTarget;
  documentTarget: TestBrowserEventTarget;
  elements: Map<string, TestBrowserEntryElement>;
} {
  const path =
    input.path ??
    createDashboardProjectRoutePath({
      ...routeParams(),
      view: "overview"
    });
  const root: TestBrowserEntryElement = domRoot();
  const configScript: TestBrowserEntryElement = {
    ...domRoot(),
    textContent: JSON.stringify(
      input.bootstrapConfig ?? hostedShellBootstrapConfig()
    )
  };
  const elements = new Map<string, TestBrowserEntryElement>([
    ["searchlint-dashboard-root", root],
    ["searchlint-dashboard-config", configScript]
  ]);
  const documentTarget = browserEventTarget();
  const document: TestBrowserEntryDocument = {
    title: "",
    getElementById(id) {
      return elements.get(id) ?? null;
    },
    addEventListener(type, listener) {
      documentTarget.addEventListener(type, listener);
    },
    removeEventListener(type, listener) {
      documentTarget.removeEventListener(type, listener);
    }
  };
  const location = browserEntryLocation(path);
  const history = browserHistory(location);
  const windowTarget = browserEventTarget();
  const apiFetch =
    input.apiFetch ??
    fetchJson([], {
      status: 200,
      body: snapshot()
    });
  const window: DashboardBrowserEntryWindowPort = {
    document,
    location,
    history,
    sessionStorage: input.storage ?? memoryStorage(),
    fetch: apiFetch,
    addEventListener(type, listener) {
      windowTarget.addEventListener(type, listener);
    },
    removeEventListener(type, listener) {
      windowTarget.removeEventListener(type, listener);
    }
  };
  return {
    window,
    root,
    document,
    windowTarget,
    documentTarget,
    elements
  };
}

function browserClickEvent(input: {
  href: string;
  origin?: string;
  pathname?: string;
  search?: string;
  hash?: string;
  target?: string;
  download?: string;
  button?: number;
  metaKey?: boolean;
  altKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
}): TestBrowserClickEvent {
  const click: TestBrowserClickEvent = {
    defaultPrevented: false,
    prevented: false,
    ...(input.button === undefined ? {} : { button: input.button }),
    ...(input.metaKey === undefined ? {} : { metaKey: input.metaKey }),
    ...(input.altKey === undefined ? {} : { altKey: input.altKey }),
    ...(input.ctrlKey === undefined ? {} : { ctrlKey: input.ctrlKey }),
    ...(input.shiftKey === undefined ? {} : { shiftKey: input.shiftKey }),
    target: {
      closest(selector) {
        if (selector !== "a[href]") {
          return null;
        }
        return {
          href: input.href,
          ...(input.origin === undefined ? {} : { origin: input.origin }),
          ...(input.pathname === undefined ? {} : { pathname: input.pathname }),
          ...(input.search === undefined ? {} : { search: input.search }),
          ...(input.hash === undefined ? {} : { hash: input.hash }),
          ...(input.target === undefined ? {} : { target: input.target }),
          getAttribute(name) {
            return name === "download" ? (input.download ?? null) : null;
          }
        };
      }
    },
    preventDefault() {
      this.defaultPrevented = true;
      this.prevented = true;
    }
  };
  return click;
}

async function flushAsyncEvents(): Promise<void> {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function dashboardApiClient(
  response: {
    status: number;
    body: unknown;
  } = {
    status: 200,
    body: snapshot()
  }
): TestDashboardApiClient {
  const calls: DashboardProjectRouteParams[] = [];
  return {
    calls,
    async createProject() {
      return response;
    },
    async createEnvironment() {
      return response;
    },
    async getDashboardSnapshot(params) {
      calls.push(params);
      return response;
    },
    async requestCrawl() {
      return response;
    },
    async addMember() {
      return response;
    },
    async startExternalProviderOAuthConnection() {
      return response;
    },
    async completeExternalProviderOAuthConnection() {
      return response;
    }
  };
}

function session(
  overrides: Partial<DashboardAuthSession> = {}
): DashboardAuthSession {
  return {
    accessToken: "access-token",
    expiresAt: 2000,
    tokenType: "Bearer",
    identityProvider: "cognito",
    subject: "principal-1",
    refreshToken: "refresh-token",
    ...overrides
  };
}

type TestSessionStore = DashboardAuthSessionStore & {
  loadCount: number;
};

function authSessionStore(
  storedSession?: DashboardAuthSession
): TestSessionStore {
  return {
    loadCount: 0,
    save(session) {
      storedSession = session;
    },
    load() {
      this.loadCount += 1;
      return storedSession;
    },
    delete() {
      storedSession = undefined;
    }
  };
}
