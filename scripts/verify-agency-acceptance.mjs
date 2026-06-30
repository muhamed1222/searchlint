#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { format } from "prettier";

const reportPath = "reports/agency-acceptance-report.json";
const samplePath = "docs/examples/agency-acceptance-report.sample.json";

const commands = [
  {
    name: "dashboardBuild",
    command: "pnpm",
    args: ["--filter", "@searchlint/dashboard...", "build"]
  },
  {
    name: "apiAgencyTests",
    command: "pnpm",
    args: ["--filter", "@searchlint/api", "test", "--", "agency-mode.test.ts"]
  },
  {
    name: "dashboardAgencyTests",
    command: "pnpm",
    args: [
      "--filter",
      "@searchlint/dashboard",
      "test",
      "--",
      "dashboard.test.ts"
    ]
  },
  {
    name: "reporterAgencyTests",
    command: "pnpm",
    args: [
      "--filter",
      "@searchlint/reporter-html",
      "test",
      "--",
      "html.test.ts"
    ]
  },
  {
    name: "apiBuild",
    command: "pnpm",
    args: ["--filter", "@searchlint/api", "build"]
  },
  {
    name: "reporterBuild",
    command: "pnpm",
    args: ["--filter", "@searchlint/reporter-html", "build"]
  }
];

async function main() {
  const commandResults = commands.map(runCommand);
  const api = await import(
    pathToFileURL(path.resolve("services/api/dist/src/index.js")).href
  );
  const dashboard = await import(
    pathToFileURL(path.resolve("apps/dashboard/dist/src/index.js")).href
  );
  const reporter = await import(
    pathToFileURL(path.resolve("packages/reporter-html/dist/src/index.js")).href
  );

  const agencyCase = verifyAgencyCase(api);
  const dashboardCase = verifyDashboardCase(dashboard);
  const reportCase = verifyReportCase(api, reporter);
  const report = {
    generatedBy: "searchlint-agency-acceptance-verifier",
    generatedAt: "2026-06-22T00:00:00.000Z",
    status: "passed",
    scope: {
      proofType: "deterministic local/static agency mode proof",
      doesNotClaim: [
        "deployed client portal",
        "production agency workspace persistence",
        "live agency billing",
        "hosted white-label report links",
        "custom domains or DNS",
        "client invite email delivery"
      ]
    },
    commands: commandResults,
    cases: {
      agency: agencyCase,
      dashboard: dashboardCase,
      report: reportCase
    },
    remainingReleaseGates: [
      "Persist client workspaces and shared policies in production storage.",
      "Deploy client portal and client-access browser E2E.",
      "Connect agency billing to real Stripe account/customer hierarchy.",
      "Publish hosted white-label report links with access controls.",
      "Implement brand asset upload, custom domains, and DNS verification if required.",
      "Deliver and verify client invite emails."
    ]
  };

  assertNoSensitiveValues(JSON.stringify(report));
  await mkdir(path.dirname(reportPath), { recursive: true });
  await mkdir(path.dirname(samplePath), { recursive: true });
  await writeJson(reportPath, report);
  await writeJson(samplePath, report);

  console.log(
    `Agency acceptance PASS: ${Object.keys(report.cases).length}/3 evidence groups passed`
  );
  console.log(`Report: ${reportPath}`);
  console.log(`Sample: ${samplePath}`);
}

function verifyAgencyCase(api) {
  const portfolio = api.createAgencyPortfolioSummary({
    workspaces: workspaces(),
    projects: projects(),
    now: "2026-06-22T12:00:00.000Z"
  });
  const clientAccess = api.agencyClientAccessDecision("client");
  const ownerAccess = api.agencyClientAccessDecision("owner");
  const bulkMonitoring = api.createAgencyBulkMonitoringPlan({
    projects: projects(),
    maxConcurrency: 4,
    urlsPerProject: 500
  });
  const sla = api.evaluateAgencySla({
    projects: projects(),
    now: "2026-06-22T12:00:00.000Z",
    dueSoonHours: 24
  });
  const assignees = api.summarizeAgencyAssignees(projects());
  const onboarding = api.createAgencyOnboardingChecklist({
    workspaces: workspaces(),
    projects: projects(),
    brands: brands(),
    sharedPolicies: policies()
  });
  const billing = api.createAgencyBillingSummary({
    planTier: "agency",
    clientWorkspacesUsed: 10,
    clientWorkspaceLimit: 10,
    sharedSeatsUsed: 7,
    sharedSeatLimit: 25
  });

  expectEqual(portfolio.clientCount, 3);
  expectEqual(clientAccess.canMutateProject, false);
  expectEqual(clientAccess.canManageBilling, false);
  expectEqual(ownerAccess.canManageBilling, true);
  expectEqual(bulkMonitoring.estimatedUrlBudget, 1500);
  expectEqual(
    sla.some((item) => item.status === "overdue"),
    true
  );
  expectEqual(
    onboarding.every((item) => item.status === "complete"),
    true
  );

  return {
    portfolio,
    clientAccess,
    ownerAccess,
    bulkMonitoring,
    sla,
    assignees,
    onboarding,
    billing,
    sharedPolicies: policies().map((policy) => ({
      id: policy.id,
      name: policy.name,
      ruleIds: policy.ruleIds
    }))
  };
}

function verifyDashboardCase(dashboard) {
  const html = dashboard.renderDashboardProjectSectionHtml(
    dashboard.createDashboardProjectSectionModel(dashboardSnapshot(), "billing")
  );
  requireIncludes(html, "Agency portfolio");
  requireIncludes(html, "Acme Retail");
  requireIncludes(html, "Beta SaaS");
  requireIncludes(html, "overdue");
  requireIncludes(html, "Acme SEO");
  return {
    renderedTables: [
      "Billing subscription",
      "Billing invoices",
      "Agency portfolio",
      "Quota"
    ],
    renderedClients: ["Acme Retail", "Beta SaaS"],
    renderedSlaStates: ["overdue", "on-track"]
  };
}

function verifyReportCase(api, reporter) {
  const options = api.whiteLabelReportOptions({
    brand: brands()[0],
    locale: "en"
  });
  const html = reporter.createHtmlReport([diagnostic()], {
    title: "Agency client report",
    generatedAt: "2026-06-22T00:00:00.000Z",
    projectName: "Acme Store",
    environmentName: "Production",
    subjectUrl: "https://example.test",
    ...options
  });
  requireIncludes(html, "Client / White-Label Summary");
  requireIncludes(html, "Acme SEO");
  requireIncludes(html, "Audience: agency");
  requireIncludes(html, "Report type: white-label");
  return {
    reportVariant: options.reportVariant,
    audience: options.audience,
    brandLabel: options.brandLabel,
    locale: options.locale,
    localHtmlWhiteLabelRendered: true
  };
}

function workspaces() {
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

function workspace(overrides = {}) {
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

function projects() {
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

function project(overrides = {}) {
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

function brands() {
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

function policies() {
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

function dashboardSnapshot() {
  return {
    organization: { id: "org-1", name: "Acme Agency" },
    project: {
      id: "project-1",
      name: "Agency Portfolio",
      siteUrl: "https://agency.example.test"
    },
    environment: {
      id: "env-1",
      name: "Production",
      baseUrl: "https://agency.example.test"
    },
    diagnostics: [],
    crawlRuns: [],
    trends: [],
    externalObservations: [],
    reports: [],
    quotas: [],
    billing: {
      planTier: "agency",
      status: "active",
      source: "stripe",
      currentPeriodEnd: "2026-07-01T00:00:00.000Z",
      overagePolicy: "hard-cap",
      invoices: []
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
    teamMembers: []
  };
}

function diagnostic() {
  return {
    id: "diagnostic-1",
    ruleId: "SL-META-001",
    severity: "blocker",
    confidence: "certain",
    pageUrl: "https://example.test/",
    source: "raw-html",
    title: "Missing title",
    evidence: "No title element was found.",
    observedAt: "2026-06-22T00:00:00.000Z",
    fingerprint: "fingerprint-1"
  };
}

function runCommand(command) {
  const result = spawnSync(command.command, command.args, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: "pipe"
  });
  if (result.status !== 0) {
    throw new Error(
      `${command.name} failed with exit ${result.status}\n${result.stdout}\n${result.stderr}`
    );
  }
  return {
    name: command.name,
    command: [command.command, ...command.args].join(" "),
    status: "passed"
  };
}

async function writeJson(filePath, value) {
  const json = await format(JSON.stringify(value), { parser: "json" });
  await writeFile(filePath, json, "utf8");
}

function expectEqual(actual, expected) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}.`
    );
  }
}

function requireIncludes(value, expected) {
  if (!value.includes(expected)) {
    throw new Error(`Expected value to include ${expected}.`);
  }
}

function assertNoSensitiveValues(value) {
  const forbidden = [
    "private_key",
    "client-secret",
    "authorization:",
    "bearer ",
    "sk_live",
    "whsec_"
  ];
  const lower = value.toLowerCase();
  for (const item of forbidden) {
    if (lower.includes(item)) {
      throw new Error(`Forbidden agency evidence value found: ${item}`);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
