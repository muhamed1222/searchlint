#!/usr/bin/env node
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { inflateSync } from "node:zlib";

import { chromium } from "@playwright/test";

const dashboardDistIndexUrl = pathToFileURL(
  path.resolve("apps/dashboard/dist/src/index.js")
).href;
const dashboardAssetsManifestPath =
  "apps/dashboard/dist/assets/searchlint-dashboard-assets.json";
const dashboardAssetRoot = path.resolve("apps/dashboard/dist");
const reportDir = path.resolve("reports/dashboard-visual");
const reportPath = path.join(reportDir, "report.json");
const dashboardBasePath = "/dashboard";
const projectRouteBase =
  "/dashboard/organizations/org-1/projects/project-1/environments/env-1";
const sessionStorageNamespace = "searchlint:dashboard-visual";

const {
  dashboardHostedShellAssetsFromManifest,
  renderDashboardHostedHtmlShell
} = await import(dashboardDistIndexUrl);

const manifest = JSON.parse(
  await readFile(dashboardAssetsManifestPath, "utf8")
);

await rm(reportDir, { recursive: true, force: true });
await mkdir(reportDir, { recursive: true });

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
  throw new Error("Dashboard visual verifier could not bind server.");
}

const origin = `http://127.0.0.1:${address.port}`;
const browser = await chromium.launch();
const cases = [
  {
    name: "desktop-diagnostics",
    viewport: { width: 1440, height: 960 },
    path: `${projectRouteBase}/diagnostics`,
    expectedText: "SL-TITLE-001"
  },
  {
    name: "mobile-overview",
    viewport: { width: 390, height: 844 },
    path: `${projectRouteBase}/overview`,
    expectedText: "Primary crawl quota"
  },
  {
    name: "desktop-external-observations",
    viewport: { width: 1280, height: 900 },
    path: `${projectRouteBase}/external-observations`,
    expectedText: "Search Console URL inspection is fresh."
  }
];
const report = [];

try {
  for (const visualCase of cases) {
    report.push(await verifyVisualCase(visualCase));
  }
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

await writeFile(
  reportPath,
  `${JSON.stringify(
    {
      generatedBy: "searchlint-dashboard-hosted-visual-verifier",
      cases: report
    },
    null,
    2
  )}\n`
);

console.log("verified SearchLint dashboard hosted visual baseline");

async function verifyVisualCase(visualCase) {
  const page = await browser.newPage({ viewport: visualCase.viewport });
  const failures = browserFailures(page);
  await seedSession(page);
  await page.goto(`${origin}${visualCase.path}`, {
    waitUntil: "domcontentloaded"
  });
  await page.waitForFunction(
    (expectedText) => document.body.innerText.includes(expectedText),
    visualCase.expectedText,
    { timeout: 10_000 }
  );
  await assertNoBrowserFailures(failures, visualCase.name);
  const layout = await dashboardLayout(page);
  assertNoHorizontalOverflow(layout, visualCase.name);
  assertPositiveBox(layout.header, `${visualCase.name} header`);
  assertPositiveBox(layout.nav, `${visualCase.name} nav`);
  assertPositiveBox(layout.main, `${visualCase.name} main`);
  assertVerticalOrder(layout, visualCase.name);

  const screenshotPath = path.join(reportDir, `${visualCase.name}.png`);
  const screenshot = await page.screenshot({
    path: screenshotPath,
    fullPage: true
  });
  const pngStats = decodePngStats(screenshot);
  if (pngStats.uniqueColorCount < 2) {
    throw new Error(`${visualCase.name} screenshot appears blank.`);
  }

  await page.close();
  return {
    name: visualCase.name,
    viewport: visualCase.viewport,
    path: visualCase.path,
    screenshot: path.relative(process.cwd(), screenshotPath),
    sha256: createHash("sha256").update(screenshot).digest("hex"),
    bytes: screenshot.byteLength,
    png: pngStats,
    layout
  };
}

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
      cognitoClientId: "dashboard-visual-client",
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

async function dashboardLayout(page) {
  return page.evaluate(() => {
    const rectFor = (selector) => {
      const element = document.querySelector(selector);
      if (!element) {
        return undefined;
      }
      const rect = element.getBoundingClientRect();
      return {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        left: rect.left
      };
    };
    return {
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      },
      document: {
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        scrollHeight: document.documentElement.scrollHeight
      },
      header: rectFor("header"),
      nav: rectFor('nav[aria-label="Project dashboard views"]'),
      main: rectFor("main")
    };
  });
}

function assertNoHorizontalOverflow(layout, name) {
  if (layout.document.scrollWidth > layout.document.clientWidth + 1) {
    throw new Error(
      `${name} has horizontal overflow: scrollWidth=${layout.document.scrollWidth}, clientWidth=${layout.document.clientWidth}.`
    );
  }
}

function assertPositiveBox(box, label) {
  if (!box || box.width <= 0 || box.height <= 0) {
    throw new Error(`${label} box must have positive dimensions.`);
  }
}

function assertVerticalOrder(layout, name) {
  if (layout.header.bottom > layout.nav.top + 1) {
    throw new Error(`${name} header overlaps navigation.`);
  }
  if (layout.nav.bottom > layout.main.top + 1) {
    throw new Error(`${name} navigation overlaps main content.`);
  }
}

function decodePngStats(buffer) {
  const signature = buffer.subarray(0, 8).toString("hex");
  if (signature !== "89504e470d0a1a0a") {
    throw new Error("Screenshot is not a PNG file.");
  }
  let offset = 8;
  let width = 0;
  let height = 0;
  let colorType = 0;
  let bitDepth = 0;
  const idatChunks = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString("ascii");
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data.readUInt8(8);
      colorType = data.readUInt8(9);
    }
    if (type === "IDAT") {
      idatChunks.push(data);
    }
    offset += 12 + length;
    if (type === "IEND") {
      break;
    }
  }
  if (
    width <= 0 ||
    height <= 0 ||
    bitDepth !== 8 ||
    (colorType !== 2 && colorType !== 6)
  ) {
    throw new Error(
      `Unsupported screenshot PNG format: ${width}x${height}, bitDepth=${bitDepth}, colorType=${colorType}.`
    );
  }

  const inflated = inflateSync(Buffer.concat(idatChunks));
  const bytesPerPixel = colorType === 6 ? 4 : 3;
  const stride = width * bytesPerPixel;
  const previous = Buffer.alloc(stride);
  const current = Buffer.alloc(stride);
  const uniqueColors = new Set();
  let sourceOffset = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = inflated[sourceOffset];
    sourceOffset += 1;
    inflated.copy(current, 0, sourceOffset, sourceOffset + stride);
    sourceOffset += stride;
    unfilterScanline(current, previous, filter, bytesPerPixel);
    for (let x = 0; x < current.length; x += bytesPerPixel) {
      uniqueColors.add(
        bytesPerPixel === 4
          ? current.readUInt32BE(x).toString(16)
          : current.subarray(x, x + bytesPerPixel).toString("hex")
      );
      if (uniqueColors.size > 256) {
        return {
          width,
          height,
          uniqueColorCount: uniqueColors.size
        };
      }
    }
    current.copy(previous);
  }
  return {
    width,
    height,
    uniqueColorCount: uniqueColors.size
  };
}

function unfilterScanline(current, previous, filter, bytesPerPixel) {
  for (let index = 0; index < current.length; index += 1) {
    const left = index >= bytesPerPixel ? current[index - bytesPerPixel] : 0;
    const up = previous[index];
    const upLeft = index >= bytesPerPixel ? previous[index - bytesPerPixel] : 0;
    if (filter === 1) {
      current[index] = (current[index] + left) & 0xff;
    } else if (filter === 2) {
      current[index] = (current[index] + up) & 0xff;
    } else if (filter === 3) {
      current[index] = (current[index] + Math.floor((left + up) / 2)) & 0xff;
    } else if (filter === 4) {
      current[index] = (current[index] + paeth(left, up, upLeft)) & 0xff;
    } else if (filter !== 0) {
      throw new Error(`Unsupported PNG scanline filter ${filter}.`);
    }
  }
}

function paeth(left, up, upLeft) {
  const predictor = left + up - upLeft;
  const leftDistance = Math.abs(predictor - left);
  const upDistance = Math.abs(predictor - up);
  const upLeftDistance = Math.abs(predictor - upLeft);
  if (leftDistance <= upDistance && leftDistance <= upLeftDistance) {
    return left;
  }
  return upDistance <= upLeftDistance ? up : upLeft;
}

async function seedSession(page) {
  await page.addInitScript(
    ({ key, session }) => {
      window.sessionStorage.setItem(key, JSON.stringify(session));
    },
    {
      key: `${sessionStorageNamespace}:current`,
      session: {
        accessToken: "dashboard-visual-token",
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

async function assertNoBrowserFailures(failures, name) {
  if (failures.length > 0) {
    throw new Error(
      [`${name} produced browser errors.`, ...failures].join("\n").trim()
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
        fingerprint: "dashboard-visual-title"
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
