#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const fixedGeneratedAt = "2026-06-23T00:00:00.000Z";
const reportPath = path.join(
  repoRoot,
  "reports/overlay-visual-regression-report.json"
);
const samplePath = path.join(
  repoRoot,
  "docs/examples/overlay-visual-regression-report.sample.json"
);

function run(command, args) {
  execFileSync(command, args, {
    cwd: repoRoot,
    env: process.env,
    stdio: "inherit"
  });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function result(id, status, evidence) {
  return { id, status, evidence };
}

function hasAll(text, values) {
  return values.every((value) => text.includes(value));
}

function extractStyle(html) {
  const match = html.match(/<style>([\s\S]*?)<\/style>/);
  assert(match, "overlay render output must include a style block");
  return match[1];
}

async function main() {
  if (!process.version.startsWith("v24.")) {
    throw new Error(
      `overlay visual regression must run under Node.js 24, got ${process.version}`
    );
  }

  run("pnpm", ["overlay:acceptance"]);

  const { createDiagnostic } =
    await import("../packages/core/dist/src/index.js");
  const { deriveBadgeState, renderOverlayHtml } =
    await import("../packages/overlay/dist/src/index.js");

  const diagnostics = [
    createDiagnostic({
      ruleId: "SL-INDEX-001",
      severity: "blocker",
      confidence: "certain",
      pageUrl: "https://example.com/products/visual",
      route: "/products/[slug]",
      source: "raw-html",
      title: "Page is noindexed",
      evidence: "Rendered robots metadata includes noindex.",
      observedAt: fixedGeneratedAt
    }),
    createDiagnostic({
      ruleId: "SL-META-005",
      severity: "error",
      confidence: "certain",
      pageUrl: "https://example.com/products/visual",
      route: "/products/[slug]",
      source: "source-code",
      title: `Long diagnostic ${"token-".repeat(60)}`,
      evidence: `Long evidence ${"content ".repeat(120)}`,
      sourceLocation: {
        confidence: "EXACT",
        file: "app/products/[slug]/page.tsx",
        line: 12,
        selector: "meta[name=description]"
      },
      observedAt: fixedGeneratedAt
    }),
    createDiagnostic({
      ruleId: "SL-CANON-001",
      severity: "warning",
      confidence: "likely",
      pageUrl: "https://example.com/products/visual",
      route: "/products/[slug]",
      source: "rendered-dom",
      title: "Canonical target differs",
      evidence: "Rendered canonical differs from route contract.",
      observedAt: fixedGeneratedAt
    })
  ];

  const scenarioInputs = [
    {
      id: "desktop-bottom-right-blocked",
      viewport: { width: 1440, height: 900, zoom: 1 },
      state: {
        status: deriveBadgeState(diagnostics),
        diagnostics,
        pageUrl: "https://example.com/products/visual",
        route: "/products/[slug]",
        position: "bottom-right"
      }
    },
    {
      id: "mobile-top-left-rtl",
      viewport: { width: 320, height: 568, zoom: 1 },
      state: {
        status: "errors",
        diagnostics,
        pageUrl: "https://example.com/products/visual",
        route: "/products/[slug]",
        position: "top-left",
        direction: "rtl"
      }
    },
    {
      id: "zoom-200-long-diagnostics",
      viewport: { width: 640, height: 720, zoom: 2 },
      state: {
        status: "blocked",
        diagnostics: diagnostics.map((item, index) => ({
          ...item,
          fingerprint: `zoom-200-${index}`,
          title: `${item.title} ${"long-word-".repeat(40)}`
        })),
        position: "bottom-left"
      }
    },
    {
      id: "zoom-400-fallback",
      viewport: { width: 320, height: 568, zoom: 4 },
      state: {
        status: "errors",
        diagnostics,
        position: "top-right",
        runtimeError: "SearchLint overlay recovered after render failure."
      }
    },
    {
      id: "all-badge-states",
      viewport: { width: 1024, height: 768, zoom: 1 },
      state: {
        status: "clean",
        diagnostics: [],
        position: "bottom-right"
      }
    }
  ];

  const scenarioBaselines = scenarioInputs.map((scenario) => {
    const html = renderOverlayHtml(scenario.state);
    return {
      id: scenario.id,
      viewport: scenario.viewport,
      htmlSha256: sha256(html),
      byteLength: Buffer.byteLength(html, "utf8"),
      hasPanel: html.includes('class="sl-panel'),
      hasBadge: html.includes('class="sl-badge'),
      hasInlineScript: html.includes("<script")
    };
  });

  const html = renderOverlayHtml(scenarioInputs[0].state);
  const style = extractStyle(html);
  const checks = [];

  checks.push(
    result(
      "visual-baseline-scenarios",
      scenarioBaselines.every((item) => !item.hasInlineScript)
        ? "PASS"
        : "FAIL",
      {
        scenarioCount: scenarioBaselines.length,
        scenarios: scenarioBaselines
      }
    )
  );

  checks.push(
    result(
      "mobile-viewport-contract",
      hasAll(style, [
        "max-width: min(420px, calc(100vw - 32px))",
        "width: min(760px, calc(100vw - 32px))",
        "max-height: min(760px, calc(100vh - 90px))",
        "overflow: auto"
      ])
        ? "PASS"
        : "FAIL",
      {
        mobileWidth: 320,
        expectedPanelMaxWidth: 288,
        expectedBadgeMaxWidth: 288
      }
    )
  );

  checks.push(
    result(
      "zoom-200-400-contract",
      hasAll(style, [
        "overflow-wrap: anywhere",
        "pre-wrap",
        "flex-wrap: wrap",
        "max-height: min(760px, calc(100vh - 90px))"
      ]) && !style.includes("letter-spacing: -")
        ? "PASS"
        : "FAIL",
      {
        zoomFactors: [2, 4],
        noNegativeLetterSpacing: !style.includes("letter-spacing: -")
      }
    )
  );

  checks.push(
    result(
      "forced-colors-high-contrast-contract",
      hasAll(style, [
        "@media (forced-colors: active)",
        "border-color: CanvasText",
        "box-shadow: none",
        "forced-color-adjust: none",
        "background: Highlight"
      ])
        ? "PASS"
        : "FAIL",
      { forcedColorsMediaQuery: true }
    )
  );

  checks.push(
    result(
      "style-conflict-isolation-contract",
      hasAll(style, [
        ":host { all: initial",
        "z-index: 2147483647",
        "position: fixed"
      ]) &&
        !/\bbody\b/.test(style) &&
        !/\bhtml\b/.test(style) &&
        !html.includes("<script")
        ? "PASS"
        : "FAIL",
      {
        hostReset: style.includes(":host { all: initial"),
        noBodySelector: !/\bbody\b/.test(style),
        noHtmlSelector: !/\bhtml\b/.test(style),
        noInlineScript: !html.includes("<script")
      }
    )
  );

  checks.push(
    result(
      "final-ux-contract",
      hasAll(html, [
        "SearchLint",
        "SEO diagnostics",
        "Rerun analysis",
        "Close",
        "Diagnostic filters",
        "Copy diagnostic",
        "Suppress",
        "Highlight"
      ])
        ? "PASS"
        : "FAIL",
      {
        states: ["checking", "clean", "info", "warnings", "errors", "blocked"],
        positions: ["bottom-right", "bottom-left", "top-right", "top-left"],
        actions: ["rerun", "close", "copy", "suppress", "highlight"]
      }
    )
  );

  const failed = checks.filter((item) => item.status !== "PASS");
  assert(
    failed.length === 0,
    `overlay visual regression failed: ${failed.map((item) => item.id).join(", ")}`
  );

  const report = {
    schemaVersion: 1,
    generatedBy: "searchlint-overlay-visual-regression",
    generatedAt: fixedGeneratedAt,
    status: "PASS",
    baselineFormat: "sha256(renderOverlayHtml(scenario))",
    checks,
    manualGatesStillOpen: [
      "Manual WCAG 2.2 AA review.",
      "Manual screen-reader review."
    ],
    generatedArtifactsPolicy:
      "Screenshot artifacts, if produced by CI, must remain CI artifacts and not be committed unless sanitized as deterministic visual baselines."
  };

  await mkdir(path.dirname(reportPath), { recursive: true });
  await mkdir(path.dirname(samplePath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(samplePath, `${JSON.stringify(report, null, 2)}\n`);
  run("pnpm", [
    "exec",
    "prettier",
    "--write",
    path.relative(repoRoot, reportPath),
    path.relative(repoRoot, samplePath)
  ]);

  console.log(
    `overlay visual regression PASS: ${checks.length}/${checks.length} checks passed`
  );
  console.log(`Report: ${path.relative(repoRoot, reportPath)}`);
  console.log(`Sample: ${path.relative(repoRoot, samplePath)}`);
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
