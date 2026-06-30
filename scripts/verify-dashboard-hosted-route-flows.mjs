#!/usr/bin/env node
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { chromium } from "@playwright/test";

const dashboardDistIndexUrl = pathToFileURL(
  path.resolve("apps/dashboard/dist/src/index.js")
).href;
const dashboardAssetsManifestPath =
  "apps/dashboard/dist/assets/searchlint-dashboard-assets.json";
const dashboardAssetRoot = path.resolve("apps/dashboard/dist");
const dashboardBasePath = "/dashboard";
const projectRouteBase =
  "/dashboard/organizations/org-1/projects/project-1/environments/env-1";
const sessionStorageNamespace = "searchlint:dashboard-route-flow";

const {
  dashboardHostedShellAssetsFromManifest,
  renderDashboardHostedHtmlShell
} = await import(dashboardDistIndexUrl);

const manifest = JSON.parse(
  await readFile(dashboardAssetsManifestPath, "utf8")
);
const server = createServer(async (request, response) => {
  try {
    await handleRequest(request, response);
  } catch (error) {
    response.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    response.end(error instanceof Error ? error.stack : String(error));
  }
});

await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", resolve);
});

const address = server.address();
if (!address || typeof address === "string") {
  throw new Error("Dashboard route-flow verifier could not bind server.");
}

const origin = `http://127.0.0.1:${address.port}`;
const browser = await chromium.launch();

try {
  const page = await browser.newPage();
  const failures = browserFailures(page);
  await seedSession(page);
  await page.goto(`${origin}${projectRouteBase}/overview`, {
    waitUntil: "networkidle"
  });
  await expectHeading(page, "overview-heading", "Project Overview");
  await expectText(page, "Acme Agency");
  await expectText(page, "Primary crawl quota");

  await page.getByRole("link", { name: "Onboarding" }).click();
  await expectPath(page, `${projectRouteBase}/onboarding`);
  await expectHeading(page, "onboarding-heading", "Onboarding");
  await expectText(page, "Project configured");

  await page
    .getByRole("navigation", { name: "Organization switcher" })
    .getByRole("link", { name: "Beta Studio / Beta Docs / Production" })
    .click();
  await expectPath(
    page,
    "/dashboard/organizations/org-2/projects/project-2/environments/env-2/onboarding"
  );
  await expectHeading(page, "onboarding-heading", "Onboarding");
  await expectText(page, "Beta Studio");
  await expectText(page, "Beta Docs");

  await page
    .getByRole("navigation", { name: "Organization switcher" })
    .getByRole("link", { name: "Acme Agency / Example Store / Production" })
    .click();
  await expectPath(page, `${projectRouteBase}/onboarding`);
  await expectHeading(page, "onboarding-heading", "Onboarding");
  await expectText(page, "Acme Agency");

  await page.getByRole("link", { name: "Issues" }).click();
  await expectPath(page, `${projectRouteBase}/issues`);
  await expectHeading(page, "issues-heading", "Issues");
  await expectText(page, "Product page is missing title evidence.");

  await page.getByRole("link", { name: "Diagnostics" }).click();
  await expectPath(page, `${projectRouteBase}/diagnostics`);
  await expectHeading(page, "diagnostics-heading", "Diagnostics");
  await expectText(page, "SL-TITLE-001");
  await expectText(page, "Product page is missing title evidence.");

  await page.getByRole("link", { name: "Crawl History" }).click();
  await expectPath(page, `${projectRouteBase}/crawl-history`);
  await expectHeading(page, "crawl-history-heading", "Crawl History");
  await expectText(page, "succeeded");
  await expectText(page, "2026-06-22T00:00:00.000Z");
  await expectText(page, "Crawl scheduling");
  await expectText(page, "Weekly full crawl");
  await expectText(page, "Paused launch crawl");
  await expectText(
    page,
    "/v1/organizations/{organizationId}/projects/{projectId}/environments/{environmentId}/crawl-requests"
  );

  await page.getByRole("link", { name: "Trends" }).click();
  await expectPath(page, `${projectRouteBase}/trends`);
  await expectHeading(page, "trends-heading", "Trends");
  await expectText(page, "2026-06-21");
  await expectText(page, "Deployment history");
  await expectText(page, "abc1234");
  await expectText(page, "Homepage metadata fix");

  await page.getByRole("link", { name: "External Observations" }).click();
  await expectPath(page, `${projectRouteBase}/external-observations`);
  await expectHeading(
    page,
    "external-observations-heading",
    "External Observations"
  );
  await expectText(page, "google");
  await expectText(page, "Search Console URL inspection is fresh.");
  await expectText(page, "Connect Yandex");

  await page.getByRole("link", { name: "Reports" }).click();
  await expectPath(page, `${projectRouteBase}/reports`);
  await expectHeading(page, "reports-heading", "Reports");
  await expectText(page, "Executive SEO report");

  await page.getByRole("link", { name: "Organization" }).click();
  await expectPath(page, `${projectRouteBase}/organization`);
  await expectHeading(page, "organization-heading", "Organization");
  await expectText(page, "Acme Agency");
  await expectText(page, "Project management");
  await expectText(page, "Beta Storefront");
  await expectText(page, "/v1/organizations/{organizationId}/projects");

  await page.getByRole("link", { name: "Site" }).click();
  await expectPath(page, `${projectRouteBase}/site`);
  await expectHeading(page, "site-heading", "Site");
  await expectText(page, "https://example.com");

  await page.getByRole("link", { name: "Environments" }).click();
  await expectPath(page, `${projectRouteBase}/environments`);
  await expectHeading(page, "environments-heading", "Environments");
  await expectText(page, "Production");

  await page.getByRole("link", { name: "Team" }).click();
  await expectPath(page, `${projectRouteBase}/team`);
  await expectHeading(page, "team-heading", "Team");
  await expectText(page, "Alex Developer");
  await expectText(page, "Team/RBAC management");
  await expectText(page, "Team management actions");
  await expectText(page, "member:manage");
  await expectText(page, "Invite member");
  await expectText(page, "/v1/organizations/{organizationId}/members");
  await expectText(page, "Transfer ownership");

  await page.getByRole("link", { name: "Billing" }).click();
  await expectPath(page, `${projectRouteBase}/billing`);
  await expectHeading(page, "billing-heading", "Billing");
  await expectText(page, "Primary crawl quota");

  await page.getByRole("link", { name: "Settings" }).click();
  await expectPath(page, `${projectRouteBase}/settings`);
  await expectHeading(page, "settings-heading", "Settings");
  await expectText(page, "Google/Yandex settings");
  await expectText(page, "/dashboard/integrations/google/callback");
  await expectText(page, "/dashboard/integrations/yandex/callback");
  await expectText(page, "webmasters.readonly");
  await expectText(page, "metrika:read");
  await expectText(page, "Notification settings");
  await expectText(page, "Notification summary");
  await expectText(page, "SEO email alerts");
  await expectText(page, "Blocker alerts");
  await expectText(page, "retry_scheduled");
  await expectText(page, "getDashboardSnapshot");

  await page.getByRole("link", { name: "Audit Log" }).click();
  await expectPath(page, `${projectRouteBase}/audit-log`);
  await expectHeading(page, "audit-log-heading", "Audit Log");
  await expectText(page, "dashboard.snapshot.loaded");

  await assertNoBrowserFailures(failures);

  const anonymousPage = await browser.newPage();
  const anonymousFailures = browserFailures(anonymousPage);
  await anonymousPage.goto(`${origin}${projectRouteBase}/overview`, {
    waitUntil: "domcontentloaded"
  });
  await anonymousPage.waitForFunction(
    () => window.location.pathname === "/sign-in"
  );
  await assertNoBrowserFailures(anonymousFailures);
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

console.log("verified SearchLint dashboard hosted route flows");

async function handleRequest(request, response) {
  const requestUrl = new URL(request.url ?? "/", origin);
  if (requestUrl.pathname === "/sign-in") {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end("<!doctype html><title>Sign in</title><h1>Sign in</h1>");
    return;
  }

  if (isDashboardProjectPath(requestUrl.pathname)) {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(renderShell());
    return;
  }

  const snapshotParams = dashboardSnapshotParamsFromApiPath(
    requestUrl.pathname
  );
  if (snapshotParams !== undefined) {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify(dashboardSnapshot(snapshotParams)));
    return;
  }

  if (requestUrl.pathname.startsWith("/assets/")) {
    const assetPath = path.resolve(
      dashboardAssetRoot,
      `.${requestUrl.pathname}`
    );
    if (!assetPath.startsWith(dashboardAssetRoot)) {
      response.writeHead(403, { "content-type": "text/plain" });
      response.end("Forbidden");
      return;
    }
    const body = await readFile(assetPath);
    response.writeHead(200, {
      "content-type": assetPath.endsWith(".js")
        ? "text/javascript; charset=utf-8"
        : "application/octet-stream"
    });
    response.end(body);
    return;
  }

  response.writeHead(404, { "content-type": "text/plain" });
  response.end("Not found");
}

function isDashboardProjectPath(pathname) {
  return /^\/dashboard\/organizations\/[^/]+\/projects\/[^/]+\/environments\/[^/]+\/[^/]+$/u.test(
    pathname
  );
}

function dashboardSnapshotParamsFromApiPath(pathname) {
  const match =
    /^\/v1\/organizations\/([^/]+)\/projects\/([^/]+)\/environments\/([^/]+)\/dashboard-snapshot$/u.exec(
      pathname
    );
  if (match === null) {
    return undefined;
  }
  return {
    organizationId: decodeURIComponent(match[1]),
    projectId: decodeURIComponent(match[2]),
    environmentId: decodeURIComponent(match[3])
  };
}

function renderShell() {
  return renderDashboardHostedHtmlShell({
    title: "SearchLint Cloud",
    rootId: "searchlint-dashboard-root",
    configScriptId: "searchlint-dashboard-config",
    ...dashboardHostedShellAssetsFromManifest(manifest),
    bootstrapConfig: {
      apiBaseUrl: origin,
      cognitoHostedUiDomain: `${origin}/auth`,
      cognitoClientId: "dashboard-route-flow-client",
      authRoutes: {
        signIn: "/sign-in",
        dashboard: dashboardBasePath,
        sessionExpired: "/session-expired"
      },
      basePath: dashboardBasePath,
      sessionStorageNamespace
    }
  });
}

async function seedSession(page) {
  await page.addInitScript(
    ({ key, session }) => {
      window.sessionStorage.setItem(key, JSON.stringify(session));
    },
    {
      key: `${sessionStorageNamespace}:current`,
      session: {
        accessToken: "dashboard-route-flow-token",
        expiresAt: Date.now() + 600_000,
        tokenType: "Bearer",
        identityProvider: "cognito",
        subject: "user-1"
      }
    }
  );
}

function browserFailures(page) {
  const failures = [];
  page.on("pageerror", (error) => {
    failures.push(error.message);
  });
  page.on("console", (message) => {
    if (message.type() === "error") {
      failures.push(message.text());
    }
  });
  return failures;
}

async function assertNoBrowserFailures(failures) {
  if (failures.length > 0) {
    throw new Error(
      ["Dashboard route-flow verifier produced browser errors.", ...failures]
        .join("\n")
        .trim()
    );
  }
}

async function expectHeading(page, id, text) {
  await page.waitForSelector(`#${id}`, { timeout: 10_000 });
  const heading = await page.locator(`#${id}`).textContent();
  if (heading !== text) {
    throw new Error(`Expected heading ${text}, received ${heading}.`);
  }
}

async function expectText(page, text) {
  await page.waitForFunction(
    (expectedText) => document.body.innerText.includes(expectedText),
    text,
    { timeout: 10_000 }
  );
}

async function expectPath(page, pathname) {
  await page.waitForFunction(
    (expectedPathname) => window.location.pathname === expectedPathname,
    pathname
  );
}

function dashboardSnapshot(params = {}) {
  const isBeta = params.organizationId === "org-2";
  return {
    organization: {
      id: isBeta ? "org-2" : "org-1",
      name: isBeta ? "Beta Studio" : "Acme Agency"
    },
    project: {
      id: isBeta ? "project-2" : "project-1",
      name: isBeta ? "Beta Docs" : "Example Store",
      siteUrl: isBeta ? "https://beta.example.com" : "https://example.com"
    },
    environment: {
      id: isBeta ? "env-2" : "env-1",
      name: "Production",
      baseUrl: isBeta ? "https://beta.example.com" : "https://example.com"
    },
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
        id: isBeta ? "project-1" : "project-2",
        name: isBeta ? "Example Store" : "Beta Storefront",
        siteUrl: isBeta ? "https://example.com" : "https://beta.example.com",
        environmentCount: isBeta ? 1 : 2,
        openDiagnostics: isBeta ? 2 : 5,
        latestCrawlStatus: isBeta ? "succeeded" : "running"
      }
    ],
    diagnostics: [
      {
        ruleId: "SL-TITLE-001",
        severity: "warning",
        confidence: "certain",
        pageUrl: "https://example.com/products/one",
        title: "Missing title contract",
        evidence: "Product page is missing title evidence.",
        observedAt: "2026-06-22T00:00:00.000Z",
        fingerprint: "dashboard-route-flow-title"
      },
      {
        ruleId: "SL-CANON-001",
        severity: "error",
        confidence: "certain",
        pageUrl: "https://example.com/products/two",
        title: "Canonical mismatch",
        evidence: "Canonical points at a different route.",
        observedAt: "2026-06-22T00:01:00.000Z",
        fingerprint: "dashboard-route-flow-canonical"
      }
    ],
    crawlRuns: [
      {
        id: "crawl-1",
        status: "succeeded",
        requestedAt: "2026-06-22T00:00:00.000Z",
        finishedAt: "2026-06-22T00:02:00.000Z",
        crawledUrls: 42,
        failedUrls: 0
      }
    ],
    crawlSchedules: [
      {
        id: "schedule-weekly",
        name: "Weekly full crawl",
        cadence: "weekly",
        enabled: true,
        nextRunAt: "2026-06-23T00:00:00.000Z",
        lastRunAt: "2026-06-16T00:00:00.000Z",
        targetUrlCount: isBeta ? 100 : 1000
      },
      {
        id: "schedule-paused",
        name: "Paused launch crawl",
        cadence: "daily",
        enabled: false,
        nextRunAt: "2026-06-24T00:00:00.000Z",
        lastRunAt: "2026-06-20T00:00:00.000Z",
        targetUrlCount: isBeta ? 10 : 25
      }
    ],
    trends: [
      {
        date: "2026-06-21",
        diagnostics: 3,
        blockers: 0,
        errors: 1,
        warnings: 2,
        infos: 0
      }
    ],
    deploymentHistory: [
      {
        id: "deploy-1",
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
        id: "google-1",
        provider: "google",
        subjectUrl: "https://example.com/products/one",
        status: "fresh",
        observedAt: "2026-06-22T00:00:00.000Z",
        fetchedAt: "2026-06-22T00:01:00.000Z",
        summary: "Search Console URL inspection is fresh."
      }
    ],
    reports: [
      {
        id: "report-1",
        title: "Executive SEO report",
        generatedAt: "2026-06-22T00:05:00.000Z",
        locale: "en",
        totalDiagnostics: 2
      }
    ],
    quotas: [
      {
        label: isBeta ? "Beta crawl quota" : "Primary crawl quota",
        used: isBeta ? 7 : 42,
        limit: 100
      }
    ],
    teamMembers: [
      {
        principalId: "user-1",
        displayName: "Alex Developer",
        role: "developer"
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
      }
    ],
    notificationDeliveryAttempts: [
      {
        id: "attempt-1",
        channelKind: "webhook",
        status: "retry_scheduled",
        attemptedAt: "2026-06-22T12:05:00.000Z",
        attempt: 1,
        failureReason: "HTTP 503 from provider.",
        nextRetryAt: "2026-06-22T12:10:00.000Z"
      }
    ]
  };
}
