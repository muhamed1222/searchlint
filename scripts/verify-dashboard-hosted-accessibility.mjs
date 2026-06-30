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
const sessionStorageNamespace = "searchlint:dashboard-accessibility";

const {
  dashboardHostedShellAssetsFromManifest,
  renderDashboardHostedHtmlShell
} = await import(dashboardDistIndexUrl);

const manifest = JSON.parse(
  await readFile(dashboardAssetsManifestPath, "utf8")
);
let forceApiError = false;

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
  throw new Error("Dashboard accessibility verifier could not bind server.");
}

const origin = `http://127.0.0.1:${address.port}`;
const browser = await chromium.launch();

try {
  const page = await browser.newPage();
  const failures = browserFailures(page);
  await seedSession(page);
  await page.goto(`${origin}${projectRouteBase}/diagnostics`, {
    waitUntil: "domcontentloaded"
  });
  await page.waitForSelector("#diagnostics-heading", { timeout: 10_000 });

  await expectLandmarks(page);
  await expectNavigationAccessibility(page);
  await expectTableLabels(page);
  await expectFocusAndKeyboardNavigation(page);
  await assertNoBrowserFailures(failures);

  forceApiError = true;
  const errorPage = await browser.newPage();
  const errorFailures = browserFailures(errorPage);
  await seedSession(errorPage);
  await errorPage.goto(`${origin}${projectRouteBase}/overview`, {
    waitUntil: "domcontentloaded"
  });
  await expectRuntimeStatusAccessibility(errorPage);
  await assertNoBrowserFailures(errorFailures);
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

console.log("verified SearchLint dashboard hosted accessibility baseline");

async function handleRequest(request, response) {
  const requestUrl = new URL(request.url ?? "/", origin);
  if (requestUrl.pathname.startsWith(`${projectRouteBase}/`)) {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(renderShell());
    return;
  }

  if (
    requestUrl.pathname ===
    "/v1/organizations/org-1/projects/project-1/environments/env-1/dashboard-snapshot"
  ) {
    if (forceApiError) {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ invalidDashboardSnapshot: true }));
      return;
    }
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify(dashboardSnapshot()));
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

function renderShell() {
  return renderDashboardHostedHtmlShell({
    title: "SearchLint Cloud",
    rootId: "searchlint-dashboard-root",
    configScriptId: "searchlint-dashboard-config",
    ...dashboardHostedShellAssetsFromManifest(manifest),
    bootstrapConfig: {
      apiBaseUrl: origin,
      cognitoHostedUiDomain: `${origin}/auth`,
      cognitoClientId: "dashboard-accessibility-client",
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

async function expectLandmarks(page) {
  await page.getByRole("banner").waitFor({ timeout: 10_000 });
  await page
    .getByRole("navigation", { name: "Project dashboard views" })
    .waitFor({ timeout: 10_000 });
  await page
    .getByRole("navigation", { name: "Organization switcher" })
    .waitFor({ timeout: 10_000 });
  await page.getByRole("main").waitFor({ timeout: 10_000 });
  await page
    .getByRole("heading", { name: "SearchLint Dashboard", level: 1 })
    .waitFor({ timeout: 10_000 });
  await page
    .getByRole("heading", { name: "Diagnostics", level: 2 })
    .waitFor({ timeout: 10_000 });
}

async function expectNavigationAccessibility(page) {
  const organizationSwitcher = page.getByRole("navigation", {
    name: "Organization switcher"
  });
  const organizationLinks = await organizationSwitcher.getByRole("link").all();
  if (organizationLinks.length < 1) {
    throw new Error("Expected at least one organization switcher link.");
  }
  const currentOrganization = page.locator(
    'nav[aria-label="Organization switcher"] a[aria-current="true"]'
  );
  await currentOrganization.waitFor({ timeout: 10_000 });
  const currentOrganizationText = (
    await currentOrganization.textContent()
  )?.trim();
  if (currentOrganizationText !== "Acme Agency / Example Store / Production") {
    throw new Error(
      `Expected current organization switcher link, received ${currentOrganizationText}.`
    );
  }

  const navigation = page.getByRole("navigation", {
    name: "Project dashboard views"
  });
  const links = await navigation.getByRole("link").all();
  if (links.length !== 15) {
    throw new Error(
      `Expected 15 dashboard navigation links, found ${links.length}.`
    );
  }
  for (const link of links) {
    const text = (await link.textContent())?.trim() ?? "";
    if (text === "") {
      throw new Error(
        "Dashboard navigation link has an empty accessible name."
      );
    }
  }
  const current = page.locator(
    'nav[aria-label="Project dashboard views"] a[aria-current="page"]'
  );
  await current.waitFor({ timeout: 10_000 });
  const currentText = (await current.textContent())?.trim();
  if (currentText !== "Diagnostics") {
    throw new Error(
      `Expected Diagnostics current link, received ${currentText}.`
    );
  }
}

async function expectTableLabels(page) {
  await page.getByRole("table", { name: "Diagnostics" }).waitFor({
    timeout: 10_000
  });
  await page.getByRole("cell", { name: "SL-TITLE-001" }).waitFor({
    timeout: 10_000
  });
}

async function expectFocusAndKeyboardNavigation(page) {
  await page.waitForFunction(
    () => document.activeElement?.id === "searchlint-dashboard-root"
  );
  await page.keyboard.press("Tab");
  await expectActiveElementText(
    page,
    "Acme Agency / Example Store / Production"
  );
  await page.keyboard.press("Tab");
  await expectActiveElementText(page, "Onboarding");
  await page.keyboard.press("Tab");
  await expectActiveElementText(page, "Project Overview");
  await page.keyboard.press("Tab");
  await expectActiveElementText(page, "Issues");
  await page.keyboard.press("Tab");
  await expectActiveElementText(page, "Diagnostics");
  await page.keyboard.press("Tab");
  await expectActiveElementText(page, "Crawl History");
  await page.keyboard.press("Enter");
  await page.waitForFunction(
    (expectedPathname) => window.location.pathname === expectedPathname,
    `${projectRouteBase}/crawl-history`
  );
  await page
    .getByRole("heading", { name: "Crawl History", level: 2 })
    .waitFor({ timeout: 10_000 });
  const current = page.locator(
    'nav[aria-label="Project dashboard views"] a[aria-current="page"]'
  );
  const currentText = (await current.textContent())?.trim();
  if (currentText !== "Crawl History") {
    throw new Error(
      `Expected Crawl History current link, received ${currentText}.`
    );
  }
}

async function expectRuntimeStatusAccessibility(page) {
  await page
    .getByRole("heading", { name: "Dashboard request failed", level: 1 })
    .waitFor({ timeout: 10_000 });
  await page
    .locator('main.searchlint-dashboard-shell[tabindex="-1"]')
    .waitFor({ timeout: 10_000 });
  await page.waitForFunction(
    () => document.activeElement?.id === "searchlint-dashboard-root"
  );
}

async function expectActiveElementText(page, text) {
  const activeText = await page.evaluate(
    () => document.activeElement?.textContent?.trim() ?? ""
  );
  if (activeText !== text) {
    throw new Error(`Expected active element ${text}, received ${activeText}.`);
  }
}

async function seedSession(page) {
  await page.addInitScript(
    ({ key, session }) => {
      window.sessionStorage.setItem(key, JSON.stringify(session));
    },
    {
      key: `${sessionStorageNamespace}:current`,
      session: {
        accessToken: "dashboard-accessibility-token",
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
      ["Dashboard accessibility verifier produced browser errors.", ...failures]
        .join("\n")
        .trim()
    );
  }
}

function dashboardSnapshot() {
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
    diagnostics: [
      {
        ruleId: "SL-TITLE-001",
        severity: "warning",
        confidence: "certain",
        pageUrl: "https://example.com/products/one",
        title: "Missing title contract",
        evidence: "Product page is missing title evidence.",
        observedAt: "2026-06-22T00:00:00.000Z",
        fingerprint: "dashboard-accessibility-title"
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
    trends: [
      {
        date: "2026-06-21",
        diagnostics: 1,
        blockers: 0,
        errors: 0,
        warnings: 1,
        infos: 0
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
        totalDiagnostics: 1
      }
    ],
    quotas: [
      {
        label: "Primary crawl quota",
        used: 42,
        limit: 100
      }
    ],
    teamMembers: [
      {
        principalId: "user-1",
        displayName: "Alex Developer",
        role: "developer"
      }
    ]
  };
}
