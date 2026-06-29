#!/usr/bin/env node
import { execFileSync, spawn } from "node:child_process";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  writeFile
} from "node:fs/promises";
import http from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const nodeBinDir = path.dirname(process.execPath);
const reportPath = path.join(
  repoRoot,
  "reports",
  "next-fixture-zero-impact-report.json"
);
const catalogPath = path.join(repoRoot, "specs", "RULE_CATALOG.yaml");
const packagePolicy = {
  pnpm: "11.8.0",
  react: "19.2.7",
  reactDom: "19.2.7",
  next: {
    15: "15.5.19",
    16: "16.2.9"
  }
};
const fixtures = [
  { id: "next15-app", nextMajor: 15, router: "app" },
  { id: "next15-pages", nextMajor: 15, router: "pages" },
  { id: "next16-app", nextMajor: 16, router: "app" },
  { id: "next16-pages", nextMajor: 16, router: "pages" }
];
const searchLintRuntimePattern =
  /@searchlint|searchlint-dev-overlay|__SEARCHLINT_DEV_OVERLAY__|__SEARCHLINT_RULE_CATALOG__|createSearchLintOverlayRuntime|withSearchLint/i;
const publicPackageDirs = [
  "packages/browser",
  "packages/cli",
  "packages/core",
  "packages/crawler",
  "packages/html",
  "packages/http",
  "packages/language",
  "packages/lsp",
  "packages/next",
  "packages/overlay",
  "packages/reporter-junit",
  "packages/reporter-sarif",
  "packages/source"
];
const selectedFixture = readFixtureFilter();

const report = {
  generatedAt: new Date().toISOString(),
  node: process.version,
  pnpm: run("pnpm", ["-v"]).trim(),
  policy: packagePolicy,
  fixtures: []
};

await mkdir(path.dirname(reportPath), { recursive: true });
assert(
  process.versions.node.split(".")[0] === "24",
  `fixture verification must run under Node.js 24, got ${process.version}`
);

const workDir = await mkdtemp(path.join(tmpdir(), "searchlint-next-fixtures-"));
try {
  const packDir = path.join(workDir, "tarballs");
  await mkdir(packDir, { recursive: true });
  run("pnpm", ["build"], { stdio: "inherit" });
  const packages = await packPublicPackages(packDir);

  for (const fixture of fixtures.filter((item) =>
    selectedFixture ? item.id === selectedFixture : true
  )) {
    report.fixtures.push(await verifyFixturePair(fixture, packages, workDir));
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  }

  assert(
    report.fixtures.every((fixture) => fixture.status === "pass"),
    "one or more real Next.js fixtures failed"
  );
  console.log(`Real Next.js fixture report: ${reportPath}`);
} finally {
  if (process.env.SEARCHLINT_KEEP_NEXT_FIXTURES !== "1") {
    await removeFixtureWorkDir(workDir);
  } else {
    console.log(`Kept fixture workspace: ${workDir}`);
  }
}

async function verifyFixturePair(fixture, packages, rootDir) {
  const fixtureDir = path.join(rootDir, fixture.id);
  const cleanDir = path.join(fixtureDir, "clean");
  const enabledDir = path.join(fixtureDir, "searchlint");
  await writeFixtureProject(cleanDir, fixture, packages, false);
  await writeFixtureProject(enabledDir, fixture, packages, true);

  await installFixture(cleanDir);
  await installFixture(enabledDir);
  await assertNoWorkspaceInstall(enabledDir);

  const dev = await runDevelopmentE2E(enabledDir, fixture);
  const production = await runProductionComparison(cleanDir, enabledDir);
  const status =
    dev.status === "pass" && production.status === "pass" ? "pass" : "fail";

  return {
    id: fixture.id,
    nextVersion: packagePolicy.next[fixture.nextMajor],
    router: fixture.router,
    install: {
      source: "pnpm pack tarballs",
      workspaceReferences: "absent"
    },
    dev,
    production,
    status
  };
}

async function packPublicPackages(packDir) {
  const packages = new Map();
  for (const packageDir of publicPackageDirs) {
    const manifest = JSON.parse(
      await readFile(path.join(repoRoot, packageDir, "package.json"), "utf8")
    );
    const before = new Set(await readdir(packDir));
    run("pnpm", ["--dir", packageDir, "pack", "--pack-destination", packDir]);
    const after = await readdir(packDir);
    const created = after.find((entry) => !before.has(entry));
    assert(created, `pnpm pack did not create a tarball for ${manifest.name}`);
    packages.set(manifest.name, path.join(packDir, created));
  }
  return packages;
}

async function writeFixtureProject(projectDir, fixture, packages, searchlint) {
  await mkdir(projectDir, { recursive: true });
  const dependencies = {
    next: packagePolicy.next[fixture.nextMajor],
    react: packagePolicy.react,
    "react-dom": packagePolicy.reactDom
  };
  if (searchlint) {
    dependencies["@searchlint/next"] =
      `file:${packages.get("@searchlint/next")}`;
  }

  await writeJson(path.join(projectDir, "package.json"), {
    private: true,
    type: "module",
    scripts: {
      dev: "next dev --webpack",
      build: "next build",
      start: "next start"
    },
    dependencies,
    devDependencies: {}
  });

  if (searchlint) {
    await writeFile(
      path.join(projectDir, "pnpm-workspace.yaml"),
      `overrides:
${[...packages.entries()]
  .map(([name, tarball]) => `  "${name}": "file:${tarball}"`)
  .join("\n")}
`
    );
    await mkdir(path.join(projectDir, "searchlint"), { recursive: true });
    await cp(
      catalogPath,
      path.join(projectDir, "searchlint", "RULE_CATALOG.yaml")
    );
    await writeFile(
      path.join(projectDir, "next.config.mjs"),
      `import { readFileSync } from "node:fs";
import { withSearchLint } from "@searchlint/next";

const nextConfig = {};

export default withSearchLint(nextConfig, {
  catalogText: readFileSync("./searchlint/RULE_CATALOG.yaml", "utf8")
});
`
    );
  } else {
    await writeFile(
      path.join(projectDir, "next.config.mjs"),
      "export default {};\n"
    );
  }

  if (fixture.router === "app") {
    await writeAppRouterFiles(projectDir);
  } else {
    await writePagesRouterFiles(projectDir);
  }
}

async function writeAppRouterFiles(projectDir) {
  await mkdir(path.join(projectDir, "app", "about"), { recursive: true });
  await writeFile(
    path.join(projectDir, "app", "layout.jsx"),
    `export const metadata = {
  title: "SearchLint Fixture",
  description: "Fixture used for real Next.js zero-impact verification."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
`
  );
  await writeFile(
    path.join(projectDir, "app", "page.jsx"),
    pageSource("App Router Home", "/about", "About")
  );
  await writeFile(
    path.join(projectDir, "app", "about", "page.jsx"),
    pageSource("App Router About", "/", "Home")
  );
}

async function writePagesRouterFiles(projectDir) {
  await mkdir(path.join(projectDir, "pages"), { recursive: true });
  await writeFile(
    path.join(projectDir, "pages", "_app.jsx"),
    `export default function App({ Component, pageProps }) {
  return <Component {...pageProps} />;
}
`
  );
  await writeFile(
    path.join(projectDir, "pages", "index.jsx"),
    pageSource("Pages Router Home", "/about", "About")
  );
  await writeFile(
    path.join(projectDir, "pages", "about.jsx"),
    pageSource("Pages Router About", "/", "Home")
  );
}

function pageSource(title, href, label) {
  return `import Link from "next/link";

export default function Page() {
  return (
    <main>
      <h1>${title}</h1>
      <p>SEO fixture route.</p>
      <img src="/missing-fixture-image.png" alt="" />
      <Link href="${href}">${label}</Link>
    </main>
  );
}
`;
}

async function installFixture(projectDir) {
  run(
    "pnpm",
    ["install", "--no-frozen-lockfile", "--dangerously-allow-all-builds"],
    {
      cwd: projectDir,
      stdio: "inherit",
      env: { CI: "1" }
    }
  );
}

async function assertNoWorkspaceInstall(projectDir) {
  const lockfile = await readFile(
    path.join(projectDir, "pnpm-lock.yaml"),
    "utf8"
  );
  assert(
    !lockfile.includes("workspace:"),
    `${projectDir} lockfile must not contain workspace dependencies`
  );
  assert(
    !lockfile.includes(repoRoot),
    `${projectDir} lockfile must not reference the monorepo root`
  );
}

async function runDevelopmentE2E(projectDir, fixture) {
  const port = await getFreePort();
  const devArgs =
    fixture.nextMajor >= 16
      ? ["exec", "next", "dev", "--webpack", "-p", String(port)]
      : ["exec", "next", "dev", "-p", String(port)];
  const server = startProcess("pnpm", devArgs, {
    cwd: projectDir,
    env: { CI: "1" }
  });
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const evidence = {
    port,
    badge: false,
    overlayOpenClose: false,
    diagnosticsFromCore: 0,
    filters: false,
    copy: false,
    rerun: false,
    suppression: false,
    highlight: false,
    navigationRefreshes: false,
    fastRefresh: false,
    duplicateHosts: false,
    cleanup: false,
    exactLocationOnly: false,
    shadowDom: false,
    accessibility: false,
    keyboardOpen: false,
    focusRestored: false,
    namedFilters: false,
    namedActions: false,
    liveStatus: false,
    nonModalDialog: false,
    listenersStable: false,
    states: []
  };

  try {
    await waitForHttp(`http://127.0.0.1:${port}/`, server);
    await page.goto(`http://127.0.0.1:${port}/`, {
      waitUntil: "domcontentloaded"
    });
    await page.waitForFunction(() =>
      Boolean(document.querySelector("searchlint-dev-overlay")?.shadowRoot)
    );
    await page.waitForFunction(() => {
      const host = document.querySelector("searchlint-dev-overlay");
      return (host?.shadowRoot?.textContent ?? "").includes("SearchLint");
    });

    evidence.badge = await page.evaluate(() => {
      const host = document.querySelector("searchlint-dev-overlay");
      return Boolean(host?.shadowRoot?.querySelector(".sl-badge"));
    });
    evidence.shadowDom = await page.evaluate(() => {
      const host = document.querySelector("searchlint-dev-overlay");
      return Boolean(host?.shadowRoot) && !document.querySelector(".sl-badge");
    });

    await page.evaluate(() =>
      window.__SEARCHLINT_DEV_OVERLAY__?.update({
        status: "checking",
        diagnostics: []
      })
    );
    for (const status of [
      "checking",
      "clean",
      "info",
      "warnings",
      "errors",
      "blocked"
    ]) {
      await page.evaluate((nextStatus) => {
        const severityByStatus = {
          checking: [],
          clean: [],
          info: ["info"],
          warnings: ["warning"],
          errors: ["error"],
          blocked: ["blocker"]
        };
        window.__SEARCHLINT_DEV_OVERLAY__?.update({
          status: nextStatus,
          diagnostics: severityByStatus[nextStatus].map((severity) => ({
            ruleId: "SL-IMG-ALT-001",
            severity,
            title: `${nextStatus} diagnostic`,
            evidence: "fixture evidence",
            expected: "expected",
            actual: "actual",
            pageUrl: location.href,
            route: location.pathname,
            confidence: "HIGH",
            source: "rendered-dom",
            fingerprint: `fixture-${nextStatus}`,
            sourceLocation: {
              confidence: "EXACT",
              selector: "main",
              file: "app/page.jsx",
              line: 7
            }
          }))
        });
      }, status);
      evidence.states.push(await shadowText(page));
    }

    await page.evaluate(() => window.__SEARCHLINT_DEV_OVERLAY__?.open());
    evidence.overlayOpenClose = await page.evaluate(() => {
      const host = document.querySelector("searchlint-dev-overlay");
      const panel = host?.shadowRoot?.querySelector(".sl-panel");
      window.__SEARCHLINT_DEV_OVERLAY__?.close();
      return Boolean(panel && !panel.hidden);
    });
    await page.evaluate(() => window.__SEARCHLINT_DEV_OVERLAY__?.open());
    evidence.filters = await page.evaluate(() => {
      const host = document.querySelector("searchlint-dev-overlay");
      return host?.shadowRoot?.querySelectorAll("select").length === 3;
    });
    evidence.copy = await clickShadowButton(page, "Copy diagnostic");
    evidence.suppression = await clickShadowButton(page, "Suppress");
    evidence.rerun = await clickShadowButton(page, "Rerun analysis");
    await page.waitForTimeout(100);
    evidence.diagnosticsFromCore = await page.evaluate(() => {
      const host = document.querySelector("searchlint-dev-overlay");
      return host?.shadowRoot?.querySelectorAll(".sl-card").length ?? 0;
    });
    evidence.highlight = await page.evaluate(() => {
      window.__SEARCHLINT_DEV_OVERLAY__?.update({
        diagnostics: [
          {
            ruleId: "SL-IMG-ALT-001",
            severity: "error",
            title: "Highlight diagnostic",
            evidence: "fixture evidence",
            pageUrl: location.href,
            route: location.pathname,
            confidence: "HIGH",
            source: "rendered-dom",
            fingerprint: "highlight",
            sourceLocation: {
              confidence: "EXACT",
              selector: "main",
              file: "app/page.jsx",
              line: 7
            }
          }
        ]
      });
      window.__SEARCHLINT_DEV_OVERLAY__?.open();
      const button = [
        ...document
          .querySelector("searchlint-dev-overlay")
          .shadowRoot.querySelectorAll("button")
      ].find((item) => item.textContent.includes("Highlight"));
      button?.click();
      return (
        document
          .querySelector("main")
          ?.getAttribute("data-searchlint-highlighted") === "true"
      );
    });
    evidence.exactLocationOnly = await page.evaluate(() => {
      window.__SEARCHLINT_DEV_OVERLAY__?.update({
        diagnostics: [
          {
            ruleId: "SL-META-TITLE-001",
            severity: "warning",
            title: "No exact location",
            evidence: "fixture evidence",
            pageUrl: location.href,
            route: location.pathname,
            confidence: "MEDIUM",
            source: "rendered-dom",
            fingerprint: "no-exact-location",
            sourceLocation: {
              confidence: "INFERRED",
              file: "app/page.jsx",
              line: 7
            }
          }
        ]
      });
      const text = document.querySelector("searchlint-dev-overlay").shadowRoot
        .textContent;
      return !text.includes("app/page.jsx:7");
    });
    const accessibilityEvidence = await page.evaluate(() => {
      window.__SEARCHLINT_DEV_OVERLAY__?.update({
        diagnostics: [
          {
            ruleId: "SL-IMG-ALT-001",
            severity: "error",
            title: "Accessible diagnostic",
            evidence: "fixture evidence",
            pageUrl: location.href,
            route: location.pathname,
            confidence: "HIGH",
            source: "rendered-dom",
            fingerprint: "accessibility",
            sourceLocation: {
              confidence: "EXACT",
              selector: "main",
              file: "app/page.jsx",
              line: 7
            }
          }
        ]
      });
      window.__SEARCHLINT_DEV_OVERLAY__?.open();
      const root = document.querySelector("searchlint-dev-overlay")?.shadowRoot;
      const badge = root?.querySelector(".sl-badge");
      const dialog = root?.querySelector("[role='dialog']");
      const count = root?.querySelector(".sl-badge__count");
      const controls = [...(root?.querySelectorAll("button") ?? [])].map(
        (item) => item.getAttribute("aria-label") || item.textContent?.trim()
      );
      return {
        accessibility:
          badge?.getAttribute("aria-haspopup") === "dialog" &&
          badge?.getAttribute("aria-controls") === "searchlint-panel" &&
          dialog?.getAttribute("aria-labelledby") ===
            "searchlint-panel-title" &&
          dialog?.getAttribute("aria-describedby") ===
            "searchlint-panel-description",
        namedFilters:
          root?.querySelector("[aria-label='Filter by severity']") !== null &&
          root?.querySelector("[aria-label='Filter by category']") !== null &&
          root?.querySelector("[aria-label='Filter by source']") !== null,
        namedActions:
          controls.includes("Rerun analysis") &&
          controls.includes("Close SearchLint diagnostics") &&
          controls.includes("Copy diagnostic") &&
          controls.includes("Suppress") &&
          controls.includes("Highlight"),
        liveStatus:
          count?.getAttribute("aria-live") === "polite" &&
          count?.getAttribute("aria-atomic") === "true",
        nonModalDialog: dialog?.getAttribute("aria-modal") === "false"
      };
    });
    Object.assign(evidence, accessibilityEvidence);

    await page.evaluate(() => {
      window.__SEARCHLINT_DEV_OVERLAY__?.close();
      const root = document.querySelector("searchlint-dev-overlay")?.shadowRoot;
      root?.querySelector(".sl-badge")?.focus();
    });
    await page.keyboard.press("Enter");
    evidence.keyboardOpen = await page.evaluate(() => {
      const root = document.querySelector("searchlint-dev-overlay")?.shadowRoot;
      const panel = root?.querySelector(".sl-panel");
      return panel?.hidden === false && root?.activeElement === panel;
    });
    await page.keyboard.press("Escape");
    evidence.focusRestored = await page.evaluate(() => {
      const root = document.querySelector("searchlint-dev-overlay")?.shadowRoot;
      const badge = root?.querySelector(".sl-badge");
      const panel = root?.querySelector(".sl-panel");
      return (
        panel?.hidden === true &&
        badge?.getAttribute("aria-expanded") === "false" &&
        root?.activeElement === badge
      );
    });

    const beforeHosts = await overlayHostCount(page);
    await page.click("a");
    await page.waitForURL(/about|\/$/);
    await page.waitForTimeout(300);
    const afterNavigationHosts = await overlayHostCount(page);
    const routeFile =
      fixture.router === "app"
        ? path.join(projectDir, "app", "about", "page.jsx")
        : path.join(projectDir, "pages", "about.jsx");
    const originalRouteSource = await readFile(routeFile, "utf8");
    await writeFile(
      routeFile,
      originalRouteSource.replace("About", "About Fast Refresh")
    );
    await page.waitForFunction(
      () => document.body.textContent?.includes("About Fast Refresh"),
      undefined,
      { timeout: 90_000 }
    );
    await page.waitForFunction(
      () => document.querySelectorAll("searchlint-dev-overlay").length === 1,
      undefined,
      { timeout: 30_000 }
    );
    const afterRefreshHosts = await overlayHostCount(page);
    await writeFile(routeFile, originalRouteSource);
    evidence.navigationRefreshes =
      beforeHosts === 1 && afterNavigationHosts === 1;
    evidence.fastRefresh = afterRefreshHosts === 1;
    evidence.duplicateHosts = afterRefreshHosts === 1;
    evidence.listenersStable = afterRefreshHosts === 1;
    evidence.cleanup = await page.evaluate(() => {
      window.__SEARCHLINT_DEV_OVERLAY__?.destroy();
      return !document.querySelector("searchlint-dev-overlay");
    });

    const pass = Object.entries(evidence).every(([key, value]) => {
      if (key === "states") return value.length === 6;
      if (key === "port") return true;
      if (key === "diagnosticsFromCore") return value > 0;
      return value === true;
    });
    assert(
      pass,
      `development E2E failed for ${fixture.id}:\n${JSON.stringify(evidence, null, 2)}`
    );
    return { status: "pass", evidence };
  } finally {
    await browser.close().catch(() => undefined);
    await stopProcess(server);
  }
}

async function runProductionComparison(cleanDir, enabledDir) {
  run("pnpm", ["build"], { cwd: cleanDir, stdio: "inherit", env: { CI: "1" } });
  run("pnpm", ["build"], {
    cwd: enabledDir,
    stdio: "inherit",
    env: { CI: "1" }
  });

  const cleanArtifacts = await collectProductionArtifacts(cleanDir);
  const enabledArtifacts = await collectProductionArtifacts(enabledDir);
  const cleanRuntime = await collectRuntimeEvidence(cleanDir);
  const enabledRuntime = await collectRuntimeEvidence(enabledDir);
  const comparison = {
    rawClientBundleBytesDelta:
      enabledArtifacts.clientJsBytes - cleanArtifacts.clientJsBytes,
    clientBundleBytesDelta: enabledArtifacts.searchLintClientJsBytes,
    clientChunksChanged: enabledArtifacts.clientSearchLintModules.length > 0,
    clientSearchLintModules: enabledArtifacts.clientSearchLintModules,
    cssChanged:
      JSON.stringify(enabledArtifacts.cssFiles) !==
      JSON.stringify(cleanArtifacts.cssFiles),
    manifestsChanged:
      JSON.stringify(enabledArtifacts.manifests) !==
      JSON.stringify(cleanArtifacts.manifests),
    serverSearchLintModules: enabledArtifacts.serverSearchLintModules,
    routeHtmlChanged:
      JSON.stringify(enabledRuntime.routes) !==
      JSON.stringify(cleanRuntime.routes),
    headersChanged:
      JSON.stringify(enabledRuntime.headers) !==
      JSON.stringify(cleanRuntime.headers),
    requestDelta: enabledRuntime.requests.length - cleanRuntime.requests.length,
    searchLintRequests: enabledRuntime.requests.filter((url) =>
      /searchlint/i.test(url)
    ),
    domDelta:
      enabledRuntime.searchLintDomElements - cleanRuntime.searchLintDomElements,
    globalsDelta:
      enabledRuntime.searchLintGlobals.length -
      cleanRuntime.searchLintGlobals.length,
    hookDelta:
      enabledRuntime.hooks.searchLintTotal - cleanRuntime.hooks.searchLintTotal,
    observerDelta:
      enabledRuntime.hooks.searchLintObservers -
      cleanRuntime.hooks.searchLintObservers,
    enabledRuntime
  };
  const checks = [
    comparison.clientBundleBytesDelta === 0,
    comparison.clientChunksChanged === false,
    comparison.clientSearchLintModules.length === 0,
    comparison.cssChanged === false,
    comparison.manifestsChanged === false,
    comparison.serverSearchLintModules.length === 0,
    comparison.routeHtmlChanged === false,
    comparison.headersChanged === false,
    comparison.requestDelta === 0,
    comparison.searchLintRequests.length === 0,
    comparison.domDelta === 0,
    comparison.globalsDelta === 0,
    comparison.hookDelta === 0,
    comparison.observerDelta === 0,
    enabledRuntime.hooks.searchLintTotal === 0,
    enabledRuntime.searchLintDomElements === 0,
    enabledRuntime.searchLintGlobals.length === 0
  ];
  assert(
    checks.every(Boolean),
    `production zero-impact comparison failed:\n${JSON.stringify(comparison, null, 2)}`
  );
  return {
    status: "pass",
    artifacts: { clean: cleanArtifacts, searchlint: enabledArtifacts },
    runtime: { clean: cleanRuntime, searchlint: enabledRuntime },
    comparison
  };
}

async function collectProductionArtifacts(projectDir) {
  const nextDir = path.join(projectDir, ".next");
  const clientChunksDir = path.join(nextDir, "static", "chunks");
  const serverDir = path.join(nextDir, "server");
  const staticDir = path.join(nextDir, "static");
  const clientJsFiles = (await listFiles(clientChunksDir)).filter((file) =>
    file.endsWith(".js")
  );
  const cssFiles = (await listFiles(staticDir))
    .filter((file) => file.endsWith(".css"))
    .sort();
  const clientChunks = await Promise.all(
    clientJsFiles.sort().map(async (file) => {
      const text = await readFile(file, "utf8");
      return {
        file: normalizeArtifactPath(nextDir, file),
        bytes: (await stat(file)).size,
        containsSearchLint: searchLintRuntimePattern.test(text)
      };
    })
  );
  return {
    clientJsBytes: clientChunks.reduce((sum, chunk) => sum + chunk.bytes, 0),
    searchLintClientJsBytes: clientChunks
      .filter((chunk) => chunk.containsSearchLint)
      .reduce((sum, chunk) => sum + chunk.bytes, 0),
    clientChunks,
    cssFiles: await summarizeFiles(nextDir, cssFiles),
    manifests: await collectManifests(nextDir),
    clientSearchLintModules: await searchFiles(
      clientJsFiles,
      searchLintRuntimePattern,
      nextDir
    ),
    serverSearchLintModules: await searchFiles(
      (await listFiles(serverDir)).filter((file) => /\.(js|json)$/.test(file)),
      searchLintRuntimePattern,
      nextDir
    )
  };
}

async function collectRuntimeEvidence(projectDir) {
  const port = await getFreePort();
  const server = startProcess(
    "pnpm",
    ["exec", "next", "start", "-p", String(port)],
    {
      cwd: projectDir,
      env: { CI: "1" }
    }
  );
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const requests = [];
  await page.addInitScript(() => {
    window.__searchlintZeroImpactProbe = {
      listeners: 0,
      mutationObservers: 0,
      resizeObservers: 0,
      searchLintListeners: 0,
      searchLintMutationObservers: 0,
      searchLintResizeObservers: 0
    };
    const originalAddEventListener = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function addEventListener(
      type,
      listener,
      options
    ) {
      window.__searchlintZeroImpactProbe.listeners += 1;
      if (/searchlint/i.test(new Error().stack ?? "")) {
        window.__searchlintZeroImpactProbe.searchLintListeners += 1;
      }
      return originalAddEventListener.call(this, type, listener, options);
    };
    const OriginalMutationObserver = window.MutationObserver;
    window.MutationObserver = class MutationObserver extends (
      OriginalMutationObserver
    ) {
      constructor(callback) {
        window.__searchlintZeroImpactProbe.mutationObservers += 1;
        if (/searchlint/i.test(new Error().stack ?? "")) {
          window.__searchlintZeroImpactProbe.searchLintMutationObservers += 1;
        }
        super(callback);
      }
    };
    const OriginalResizeObserver = window.ResizeObserver;
    if (OriginalResizeObserver) {
      window.ResizeObserver = class ResizeObserver extends (
        OriginalResizeObserver
      ) {
        constructor(callback) {
          window.__searchlintZeroImpactProbe.resizeObservers += 1;
          if (/searchlint/i.test(new Error().stack ?? "")) {
            window.__searchlintZeroImpactProbe.searchLintResizeObservers += 1;
          }
          super(callback);
        }
      };
    }
  });
  page.on("request", (request) => {
    requests.push(new URL(request.url()).pathname);
  });

  try {
    await waitForHttp(`http://127.0.0.1:${port}/`, server);
    const routes = {};
    const headers = {};
    for (const route of ["/", "/about"]) {
      const response = await fetch(`http://127.0.0.1:${port}${route}`);
      routes[route] = normalizeHtml(await response.text());
      headers[route] = normalizeHeaders(response.headers);
    }
    await page.goto(`http://127.0.0.1:${port}/`, {
      waitUntil: "networkidle"
    });
    await page.click("a");
    await page.waitForURL(/about|\/$/);
    await page.waitForLoadState("networkidle");
    const browserState = await page.evaluate(() => {
      const probe = window.__searchlintZeroImpactProbe;
      const searchLintGlobals = Object.keys(window)
        .filter((key) => /SEARCHLINT|searchlint/i.test(key))
        .filter((key) => key !== "__searchlintZeroImpactProbe");
      return {
        searchLintDomElements: document.querySelectorAll(
          "searchlint-dev-overlay,[data-searchlint]"
        ).length,
        searchLintGlobals,
        hooks: {
          listeners: probe.listeners,
          observers: probe.mutationObservers + probe.resizeObservers,
          total:
            probe.listeners + probe.mutationObservers + probe.resizeObservers,
          searchLintListeners: probe.searchLintListeners,
          searchLintObservers:
            probe.searchLintMutationObservers + probe.searchLintResizeObservers,
          searchLintTotal:
            probe.searchLintListeners +
            probe.searchLintMutationObservers +
            probe.searchLintResizeObservers
        }
      };
    });
    return {
      port,
      routes,
      headers,
      requests: normalizeRequests(requests),
      ...browserState
    };
  } finally {
    await browser.close().catch(() => undefined);
    await stopProcess(server);
  }
}

async function collectManifests(nextDir) {
  const manifestNames = [
    "build-manifest.json",
    "app-build-manifest.json",
    "routes-manifest.json",
    "server/app-paths-manifest.json",
    "server/pages-manifest.json",
    "server/middleware-manifest.json"
  ];
  const manifests = {};
  for (const name of manifestNames) {
    const filePath = path.join(nextDir, name);
    try {
      manifests[name] = normalizeManifest(
        JSON.parse(await readFile(filePath, "utf8"))
      );
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  return manifests;
}

async function summarizeFiles(rootDir, files) {
  return Promise.all(
    files.sort().map(async (file) => ({
      file: normalizeArtifactPath(rootDir, file),
      bytes: (await stat(file)).size,
      containsSearchLint: /searchlint/i.test(await readFile(file, "utf8"))
    }))
  );
}

async function searchFiles(files, pattern, rootDir) {
  const matches = [];
  for (const file of files) {
    if (pattern.test(await readFile(file, "utf8"))) {
      matches.push(normalizeArtifactPath(rootDir, file));
    }
  }
  return matches;
}

async function listFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true }).catch((error) => {
    if (error.code === "ENOENT") return [];
    throw error;
  });
  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(entryPath)));
    } else {
      files.push(entryPath);
    }
  }
  return files;
}

async function clickShadowButton(page, text) {
  return page.evaluate((buttonText) => {
    const root = document.querySelector("searchlint-dev-overlay")?.shadowRoot;
    const button = [...(root?.querySelectorAll("button") ?? [])].find((item) =>
      item.textContent?.includes(buttonText)
    );
    button?.click();
    return Boolean(button);
  }, text);
}

async function shadowText(page) {
  return page.evaluate(
    () =>
      document.querySelector("searchlint-dev-overlay")?.shadowRoot
        ?.textContent ?? ""
  );
}

async function overlayHostCount(page) {
  return page.evaluate(
    () => document.querySelectorAll("searchlint-dev-overlay").length
  );
}

function normalizeHtml(html) {
  return html
    .replaceAll(/<!DOCTYPE html><!--[^>]+--><html/g, "<!DOCTYPE html><html")
    .replaceAll(/nonce="[^"]+"/g, 'nonce="<nonce>"')
    .replaceAll(/buildId":"[^"]+"/g, 'buildId":"<build-id>"')
    .replaceAll(/\\"b\\":\\"[^"\\]+\\"/g, '\\"b\\":\\"<build-id>\\"')
    .replaceAll(/static\/[A-Za-z0-9_-]+/g, "static/<hash>")
    .replaceAll(/-[a-f0-9]{8,}(?=\.js|\.css)/gi, "-<hash>")
    .replaceAll(/\/_next\/[^"']+/g, "/_next/<asset>")
    .replaceAll(/\s+/g, " ")
    .trim();
}

function normalizeHeaders(headers) {
  const ignored = new Set([
    "connection",
    "date",
    "keep-alive",
    "content-length",
    "etag",
    "transfer-encoding",
    "vary",
    "x-nextjs-cache",
    "x-powered-by"
  ]);
  const normalized = {};
  for (const [key, value] of headers.entries()) {
    if (!ignored.has(key.toLowerCase())) {
      normalized[key.toLowerCase()] = value.replaceAll(
        /[a-f0-9]{16,}/gi,
        "<hash>"
      );
    }
  }
  return normalized;
}

function normalizeRequests(requests) {
  return [...new Set(requests)]
    .map((request) =>
      request
        .replaceAll(/\/_next\/static\/[^/]+/g, "/_next/static/<hash>")
        .replaceAll(/[a-f0-9]{16,}/gi, "<hash>")
    )
    .sort();
}

function normalizeManifest(value) {
  if (Array.isArray(value)) {
    return value.map(normalizeManifest).sort();
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, normalizeManifest(entry)])
    );
  }
  if (typeof value === "string") {
    return value
      .replaceAll(/[A-Za-z0-9_-]{16,}(?=\.js|\.css|\/)/g, "<hash>")
      .replaceAll(/"buildId":"[^"]+"/g, '"buildId":"<build-id>"');
  }
  return value;
}

function normalizeArtifactPath(rootDir, file) {
  return path
    .relative(rootDir, file)
    .replaceAll(path.sep, "/")
    .replaceAll(/[A-Za-z0-9_-]{16,}(?=\.js|\.css|\/)/g, "<hash>");
}

async function waitForHttp(url, server) {
  const deadline = Date.now() + 120_000;
  let lastError;
  while (Date.now() < deadline) {
    try {
      await new Promise((resolve, reject) => {
        const request = http.get(url, (response) => {
          response.resume();
          response.on("end", () =>
            response.statusCode && response.statusCode < 500
              ? resolve()
              : reject(new Error(`HTTP ${response.statusCode}`))
          );
        });
        request.on("error", reject);
        request.setTimeout(5_000, () => {
          request.destroy(new Error("timeout"));
        });
      });
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
  }
  const output = server?.output?.() ?? "";
  throw new Error(
    `Timed out waiting for ${url}: ${lastError?.message ?? "unknown"}\n${output}`
  );
}

async function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = http.createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() =>
        typeof address === "object" && address
          ? resolve(address.port)
          : reject(new Error("failed to allocate port"))
      );
    });
    server.on("error", reject);
  });
}

function startProcess(command, args, options) {
  const child = spawn(command, args, {
    cwd: options.cwd,
    env: childEnv(options.env),
    stdio: ["ignore", "pipe", "pipe"]
  });
  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });
  child.output = () => output;
  return child;
}

async function stopProcess(child) {
  if (child.exitCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 5_000))
  ]);
  if (child.exitCode === null) {
    child.kill("SIGKILL");
  }
}

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    env: childEnv(options.env),
    encoding: "utf8",
    stdio: options.stdio ?? "pipe"
  });
}

function childEnv(extra = {}) {
  return {
    ...process.env,
    ...extra,
    PATH: `${nodeBinDir}${path.delimiter}${process.env.PATH ?? ""}`
  };
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function removeFixtureWorkDir(directory) {
  let lastError;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await rm(directory, { recursive: true, force: true, maxRetries: 3 });
      return;
    } catch (error) {
      lastError = error;
      if (!["ENOTEMPTY", "EBUSY", "EPERM"].includes(error?.code)) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
    }
  }
  throw lastError;
}

function readFixtureFilter() {
  const index = process.argv.indexOf("--fixture");
  const fromArg = index === -1 ? undefined : process.argv[index + 1];
  const fromEnv = process.env.SEARCHLINT_NEXT_FIXTURE;
  const value = fromArg ?? fromEnv;
  if (!value) return undefined;
  assert(
    fixtures.some((fixture) => fixture.id === value),
    `unknown fixture "${value}"`
  );
  return value;
}
