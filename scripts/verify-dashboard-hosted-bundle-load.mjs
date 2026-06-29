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
const dashboardPath =
  "/dashboard/organizations/org-1/projects/project-1/environments/env-1/overview";
const sessionStorageNamespace = "searchlint:dashboard-bundle-load";

const { renderDashboardHostedHtmlShell } = await import(dashboardDistIndexUrl);

const manifest = JSON.parse(
  await readFile(dashboardAssetsManifestPath, "utf8")
);
if (manifest.bundle?.moduleScript === undefined) {
  throw new Error("Dashboard hosted bundle load requires manifest.bundle.");
}

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
  throw new Error("Dashboard hosted bundle verifier could not bind server.");
}

const origin = `http://127.0.0.1:${address.port}`;
const browser = await chromium.launch();

try {
  const page = await browser.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });
  await page.addInitScript(
    ({ key, session }) => {
      window.sessionStorage.setItem(key, JSON.stringify(session));
    },
    {
      key: `${sessionStorageNamespace}:current`,
      session: {
        accessToken: "dashboard-bundle-load-token",
        expiresAt: Date.now() + 600_000,
        tokenType: "Bearer",
        identityProvider: "cognito",
        subject: "user-1"
      }
    }
  );

  await page.goto(`${origin}${dashboardPath}`, {
    waitUntil: "networkidle"
  });
  try {
    await page.waitForSelector('[aria-labelledby="overview-heading"]', {
      timeout: 10_000
    });
    await page.waitForFunction(() => {
      const app = window.__SEARCHLINT_DASHBOARD_APP__;
      return app && typeof app.then === "function";
    });
  } catch (error) {
    const body = await page
      .locator("body")
      .innerText()
      .catch(() => "");
    throw new Error(
      [
        error instanceof Error ? error.message : String(error),
        "Dashboard hosted bundle body:",
        body,
        ...pageErrors,
        ...consoleErrors
      ].join("\n")
    );
  }
  const heading = await page.locator("#overview-heading").textContent();
  if (heading !== "Project Overview") {
    throw new Error(
      `Dashboard bundle verifier expected Project Overview heading, received ${heading}.`
    );
  }
  if (pageErrors.length > 0 || consoleErrors.length > 0) {
    throw new Error(
      [
        "Dashboard hosted bundle load produced browser errors.",
        ...pageErrors,
        ...consoleErrors
      ].join("\n")
    );
  }
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

console.log("verified SearchLint dashboard hosted bundle load");

async function handleRequest(request, response) {
  const requestUrl = new URL(request.url ?? "/", origin);
  if (requestUrl.pathname === dashboardPath) {
    const html = renderDashboardHostedHtmlShell({
      title: "SearchLint Cloud",
      rootId: "searchlint-dashboard-root",
      configScriptId: "searchlint-dashboard-config",
      entryModuleUrl: manifest.bundle.moduleScript,
      importMap: { imports: {} },
      bootstrapConfig: {
        apiBaseUrl: origin,
        cognitoHostedUiDomain: `${origin}/auth`,
        cognitoClientId: "dashboard-bundle-load-client",
        authRoutes: {
          signIn: "/sign-in",
          dashboard: "/dashboard",
          sessionExpired: "/session-expired"
        },
        basePath: "/dashboard",
        sessionStorageNamespace
      }
    });
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(html);
    return;
  }

  if (
    requestUrl.pathname ===
    "/v1/organizations/org-1/projects/project-1/environments/env-1/dashboard-snapshot"
  ) {
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
        pageUrl: "https://example.com/",
        title: "Missing title contract",
        evidence: "Fixture diagnostic rendered by bundle verifier.",
        observedAt: "2026-06-22T00:00:00.000Z",
        fingerprint: "dashboard-bundle-load-fixture"
      }
    ],
    crawlRuns: [],
    trends: [],
    externalObservations: [],
    reports: [],
    quotas: [],
    teamMembers: []
  };
}
