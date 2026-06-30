#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { chromium } from "@playwright/test";
import { format } from "prettier";

const reportPath = "reports/agency-client-access-browser-e2e-report.json";
const samplePath =
  "docs/examples/agency-client-access-browser-e2e-report.sample.json";
const dashboardDistIndexUrl = pathToFileURL(
  path.resolve("apps/dashboard/dist/src/index.js")
).href;
const dashboardAssetsManifestPath =
  "apps/dashboard/dist/assets/searchlint-dashboard-assets.json";
const dashboardAssetRoot = path.resolve("apps/dashboard/dist");
const dashboardBasePath = "/dashboard";
const projectRouteBase =
  "/dashboard/organizations/org-client/projects/project-client/environments/env-client";
const sessionStorageNamespace = "searchlint:agency-client-access-browser-e2e";

const commands = [
  {
    name: "dashboardBuild",
    command: "pnpm",
    args: ["--filter", "@searchlint/dashboard", "build"]
  }
];

const commandResults = commands.map(runCommand);
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
  throw new Error("Agency client-access browser E2E could not bind server.");
}

const origin = `http://127.0.0.1:${address.port}`;
const browser = await chromium.launch();
const assertions = [];

try {
  const page = await browser.newPage();
  const failures = browserFailures(page);
  await seedClientSession(page);

  await page.goto(`${origin}${projectRouteBase}/billing`, {
    waitUntil: "networkidle"
  });
  await expectHeading(page, "billing-heading", "Billing", assertions);
  await expectTable(page, "Agency portfolio", assertions);
  await expectText(page, "Acme SEO", assertions);
  await expectText(page, "Acme Retail", assertions);
  await expectNotText(page, "Invite member", assertions);
  await expectNotText(page, "Transfer ownership", assertions);
  await expectNotText(page, "member:manage", assertions);

  await page.getByRole("link", { name: "Reports" }).click();
  await expectPath(page, `${projectRouteBase}/reports`, assertions);
  await expectHeading(page, "reports-heading", "Reports", assertions);
  await expectText(page, "Client-visible SEO report", assertions);
  await expectNotText(page, "Billing subscription", assertions);

  await page.getByRole("link", { name: "Diagnostics" }).click();
  await expectPath(page, `${projectRouteBase}/diagnostics`, assertions);
  await expectHeading(page, "diagnostics-heading", "Diagnostics", assertions);
  await expectText(page, "SL-META-001", assertions);
  await expectText(
    page,
    "Missing title evidence for client report.",
    assertions
  );
  await expectNotText(page, "Team management actions", assertions);

  await page.getByRole("link", { name: "Team" }).click();
  await expectPath(page, `${projectRouteBase}/team`, assertions);
  await expectHeading(page, "team-heading", "Team", assertions);
  await expectText(page, "Client Reviewer", assertions);
  await expectText(page, "client", assertions);
  await expectNotText(page, "Invite member", assertions);
  await expectNotText(page, "Transfer ownership", assertions);
  await expectNotText(
    page,
    "/v1/organizations/{organizationId}/members",
    assertions
  );

  await assertNoBrowserFailures(failures);
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

const report = {
  generatedBy: "searchlint-agency-client-access-browser-e2e-verifier",
  generatedAt: "2026-06-23T00:00:00.000Z",
  status: "passed",
  scope: {
    proofType:
      "deterministic local hosted-dashboard agency client-access browser E2E",
    closesChecklistItem: "Провести client-access browser E2E",
    doesNotClaim: [
      "deployed client portal",
      "production identity provider client session",
      "live agency billing",
      "hosted white-label report links",
      "client invite email delivery"
    ]
  },
  commands: commandResults,
  browser: {
    engine: "chromium",
    hostedOrigin: "http://127.0.0.1:<ephemeral>",
    seededRole: "client",
    testedRoutes: [
      `${projectRouteBase}/billing`,
      `${projectRouteBase}/reports`,
      `${projectRouteBase}/diagnostics`,
      `${projectRouteBase}/team`
    ]
  },
  assertions,
  negativeAssertions: [
    "Invite member is not visible to the client route.",
    "Transfer ownership is not visible to the client route.",
    "member:manage is not visible to the client route.",
    "Team member mutation API path is not visible to the client route."
  ],
  remainingReleaseGates: [
    "Deploy client portal with production URL evidence.",
    "Connect client access to production identity-provider sessions.",
    "Implement live agency billing.",
    "Implement hosted white-label report links.",
    "Verify client invite email delivery."
  ]
};

assertNoSensitiveValues(JSON.stringify(report));
await mkdir(path.dirname(reportPath), { recursive: true });
await mkdir(path.dirname(samplePath), { recursive: true });
await writeJson(reportPath, report);
await writeJson(samplePath, report);

console.log(
  `Agency client-access browser E2E PASS: ${assertions.length} assertions`
);
console.log(`Report: ${reportPath}`);
console.log(`Sample: ${samplePath}`);

async function handleRequest(request, response) {
  const requestUrl = new URL(request.url ?? "/", origin);
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
    response.end(JSON.stringify(clientAccessSnapshot(snapshotParams)));
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
    title: "SearchLint Client Portal",
    rootId: "searchlint-dashboard-root",
    configScriptId: "searchlint-dashboard-config",
    ...dashboardHostedShellAssetsFromManifest(manifest),
    bootstrapConfig: {
      apiBaseUrl: origin,
      cognitoHostedUiDomain: `${origin}/auth`,
      cognitoClientId: "agency-client-access-browser-e2e-client",
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

async function seedClientSession(page) {
  await page.addInitScript(
    ({ key, session }) => {
      window.sessionStorage.setItem(key, JSON.stringify(session));
    },
    {
      key: `${sessionStorageNamespace}:current`,
      session: {
        accessToken: "agency-client-access-browser-e2e-token",
        expiresAt: Date.now() + 600_000,
        tokenType: "Bearer",
        identityProvider: "cognito",
        subject: "principal-client"
      }
    }
  );
}

function clientAccessSnapshot(params) {
  return {
    organization: {
      id: params.organizationId,
      name: "Acme Agency"
    },
    project: {
      id: params.projectId,
      name: "Acme Retail Client Portal",
      siteUrl: "https://retail.example.test"
    },
    environment: {
      id: params.environmentId,
      name: "Production",
      baseUrl: "https://retail.example.test"
    },
    viewerRole: "client",
    diagnostics: [
      {
        id: "diagnostic-client-title",
        ruleId: "SL-META-001",
        severity: "blocker",
        confidence: "certain",
        pageUrl: "https://retail.example.test/products/widget",
        source: "raw-html",
        title: "Missing title",
        evidence: "Missing title evidence for client report.",
        observedAt: "2026-06-23T00:00:00.000Z",
        fingerprint: "client-title-fingerprint"
      }
    ],
    crawlRuns: [
      {
        id: "crawl-client",
        status: "succeeded",
        requestedAt: "2026-06-22T00:00:00.000Z",
        finishedAt: "2026-06-22T00:02:00.000Z",
        crawledUrls: 42,
        failedUrls: 0
      }
    ],
    trends: [
      {
        date: "2026-06-22",
        diagnostics: 1,
        blockers: 1,
        errors: 0,
        warnings: 0,
        infos: 0
      }
    ],
    externalObservations: [],
    reports: [
      {
        id: "report-client",
        title: "Client-visible SEO report",
        generatedAt: "2026-06-22T00:00:00.000Z",
        locale: "en",
        totalDiagnostics: 1
      }
    ],
    quotas: [
      {
        label: "Client report quota",
        used: 4,
        limit: 25
      }
    ],
    billing: undefined,
    agency: {
      clientCount: 1,
      activeClientCount: 1,
      projectCount: 1,
      openDiagnostics: 1,
      blockerDiagnostics: 1,
      averageHealthScore: 88,
      overdueSlaCount: 0,
      brandLabel: "Acme SEO",
      billingStatus: "within-limit",
      clients: [
        {
          id: "client-acme-retail",
          clientName: "Acme Retail",
          status: "active",
          projectCount: 1,
          openDiagnostics: 1,
          blockerDiagnostics: 1,
          healthScore: 88,
          slaStatus: "on-track",
          assignee: "principal-client"
        }
      ]
    },
    teamMembers: [
      {
        principalId: "principal-client",
        displayName: "Client Reviewer",
        role: "client"
      }
    ],
    notificationChannels: [],
    notificationRules: [],
    notificationDeliveryAttempts: []
  };
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

async function expectHeading(page, id, expected, sink) {
  await page.waitForSelector(`#${id}`, { timeout: 10_000 });
  const actual = await page.locator(`#${id}`).textContent();
  if (actual !== expected) {
    throw new Error(
      `Expected #${id} to equal ${expected}, received ${actual}.`
    );
  }
  sink.push({ type: "heading", target: id, expected, status: "passed" });
}

async function expectText(page, expected, sink) {
  await page.getByText(expected, { exact: false }).first().waitFor({
    timeout: 10_000
  });
  sink.push({ type: "text-present", expected, status: "passed" });
}

async function expectTable(page, label, sink) {
  await page.getByRole("table", { name: label }).waitFor({
    timeout: 10_000
  });
  sink.push({ type: "table", expected: label, status: "passed" });
}

async function expectNotText(page, forbidden, sink) {
  const count = await page.getByText(forbidden, { exact: false }).count();
  if (count !== 0) {
    throw new Error(`Expected text ${forbidden} to be absent, found ${count}.`);
  }
  sink.push({ type: "text-absent", forbidden, status: "passed" });
}

async function expectPath(page, expected, sink) {
  await page.waitForFunction(
    (path) => window.location.pathname === path,
    expected
  );
  sink.push({ type: "path", expected, status: "passed" });
}

async function assertNoBrowserFailures(failures) {
  if (failures.length > 0) {
    throw new Error(
      ["Agency client-access browser E2E produced browser errors.", ...failures]
        .join("\n")
        .trim()
    );
  }
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
      throw new Error(
        `Forbidden agency client-access evidence value found: ${item}`
      );
    }
  }
}
