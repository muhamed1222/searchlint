#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const reportPath = path.join(
  repoRoot,
  "reports/overlay-acceptance-report.json"
);
const samplePath = path.join(
  repoRoot,
  "docs/examples/overlay-acceptance-report.sample.json"
);
const fixedGeneratedAt = "2026-06-22T00:00:00.000Z";

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    env: { ...process.env, ...options.env },
    encoding: "utf8",
    stdio: options.stdio ?? "pipe"
  });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function caseResult(id, status, evidence, notes = []) {
  return { id, status, evidence, notes };
}

async function main() {
  run("pnpm", ["build"], { stdio: "inherit" });

  const { createDiagnostic } =
    await import("../packages/core/dist/src/index.js");
  const {
    createOverlayAccessibilityReport,
    deriveBadgeState,
    renderOverlayHtml
  } = await import("../packages/overlay/dist/src/index.js");

  const diagnostics = [
    createDiagnostic({
      ruleId: "SL-INDEX-001",
      severity: "blocker",
      confidence: "certain",
      pageUrl: "https://example.com/products/1",
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
      pageUrl: "https://example.com/products/1",
      route: "/products/[slug]",
      source: "source-code",
      title: `Long diagnostic ${"word-".repeat(80)}`,
      evidence: `Long evidence ${"content ".repeat(160)}`,
      sourceLocation: {
        confidence: "EXACT",
        file: "app/products/[slug]/page.tsx",
        line: 12,
        selector: "meta[name=description]"
      },
      observedAt: fixedGeneratedAt
    })
  ];

  const state = {
    status: deriveBadgeState(diagnostics),
    diagnostics,
    pageUrl: "https://example.com/products/1",
    route: "/products/[slug]",
    runtimeError: "SearchLint overlay recovered from a runtime render error."
  };

  const cases = [];
  const accessibility = createOverlayAccessibilityReport(state);
  assert(accessibility.passed, "Overlay accessibility report must pass");
  cases.push(
    caseResult("accessibility-contract", "PASS", {
      checkCount: accessibility.checks.length,
      checks: accessibility.checks
    })
  );

  const positions = ["bottom-right", "bottom-left", "top-right", "top-left"];
  const positionEvidence = positions.map((position) => {
    const html = renderOverlayHtml({ ...state, position });
    assert(
      html.includes(`sl-position--${position}`),
      `Overlay must render ${position} position class`
    );
    return { position, present: true };
  });
  cases.push(
    caseResult("badge-panel-position-classes", "PASS", positionEvidence)
  );

  const rtlHtml = renderOverlayHtml({ ...state, direction: "rtl" });
  assert(rtlHtml.includes('dir="rtl"'), "Overlay must expose RTL direction");
  assert(
    rtlHtml.includes('[dir="rtl"] .sl-card'),
    "Overlay CSS must include RTL card border handling"
  );
  cases.push(
    caseResult("rtl-layout-contract", "PASS", {
      dirAttribute: rtlHtml.includes('dir="rtl"'),
      rtlCss: rtlHtml.includes('[dir="rtl"] .sl-card')
    })
  );

  const fallbackHtml = renderOverlayHtml(state);
  assert(
    fallbackHtml.includes('role="alert"') &&
      fallbackHtml.includes("SearchLint overlay error"),
    "Overlay must render fallback alert semantics"
  );
  cases.push(
    caseResult("fallback-error-state", "PASS", {
      roleAlert: fallbackHtml.includes('role="alert"'),
      escaped: !fallbackHtml.includes("<script")
    })
  );

  assert(
    fallbackHtml.includes("@media (forced-colors: active)"),
    "Overlay must include forced-colors media hook"
  );
  assert(
    fallbackHtml.includes("@media (prefers-reduced-motion: reduce)"),
    "Overlay must include reduced-motion media hook"
  );
  cases.push(
    caseResult("high-contrast-and-reduced-motion-css", "PASS", {
      forcedColors: true,
      reducedMotion: true
    })
  );

  const largeDiagnostics = Array.from({ length: 1000 }, (_, index) => ({
    ...diagnostics[index % diagnostics.length],
    fingerprint: `large-${index}`,
    title: `Diagnostic ${index} ${"long-token-".repeat(20)}`,
    evidence: `Evidence ${index} ${"body ".repeat(40)}`
  }));
  const largeHtml = renderOverlayHtml({
    status: "blocked",
    diagnostics: largeDiagnostics
  });
  const cardCount = largeHtml.match(/<article class="sl-card/g)?.length ?? 0;
  assert(
    cardCount === 1000,
    "Overlay must render 1,000 diagnostics deterministically"
  );
  assert(
    largeHtml.includes("overflow-wrap: anywhere"),
    "Overlay must include wrapping styles for long diagnostics"
  );
  assert(
    !largeHtml.includes("<script"),
    "Overlay output must not include scripts"
  );
  cases.push(
    caseResult("large-and-long-diagnostic-rendering", "PASS", {
      diagnosticCount: largeDiagnostics.length,
      renderedCardCount: cardCount,
      wrappingCss: true
    })
  );

  const failedCases = cases.filter((item) => item.status !== "PASS");
  const summary = {
    status: failedCases.length === 0 ? "PASS" : "FAIL",
    generatedAt: fixedGeneratedAt,
    nodeVersion: process.version,
    caseCount: cases.length,
    passed: cases.length - failedCases.length,
    failed: failedCases.length,
    accessibilityCheckCount: accessibility.checks.length
  };
  const report = {
    schemaVersion: 1,
    summary,
    cases,
    limitations: [
      "This verifier checks deterministic HTML/CSS contracts; manual screen-reader review remains a release gate.",
      "Pixel-diff visual regression is not implemented in this verifier.",
      "Real browser overlay navigation, keyboard open/Escape, Shadow DOM, and Fast Refresh evidence remains covered by pnpm verify:next-fixtures."
    ]
  };

  await mkdir(path.dirname(reportPath), { recursive: true });
  await mkdir(path.dirname(samplePath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(samplePath, `${JSON.stringify(report, null, 2)}\n`);

  if (summary.status !== "PASS") {
    process.exitCode = 1;
  }

  console.log(
    `Overlay acceptance ${summary.status}: ${summary.passed}/${summary.caseCount} cases passed`
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
