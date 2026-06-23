import { describe, expect, it } from "vitest";

import { createDiagnostic, type Diagnostic } from "@searchlint/core";

import {
  categoryForRuleId,
  createOverlayAccessibilityReport,
  deriveBadgeState,
  filterDiagnostics,
  nearestOverlayPosition,
  renderBadgeLabel,
  renderOverlayHtml,
  type OverlayRenderDiagnostic
} from "../src/index.js";

const observedAt = "2026-06-21T00:00:00.000Z";

describe("deriveBadgeState", () => {
  it("covers checking, clean, info, warnings, errors, and blocked states", () => {
    expect(deriveBadgeState([], true)).toBe("checking");
    expect(deriveBadgeState([])).toBe("clean");
    expect(deriveBadgeState([diagnostic("SL-META-014", "info")])).toBe("info");
    expect(deriveBadgeState([diagnostic("SL-META-015", "warning")])).toBe(
      "warnings"
    );
    expect(deriveBadgeState([diagnostic("SL-META-005", "error")])).toBe(
      "errors"
    );
    expect(deriveBadgeState([diagnostic("SL-INDEX-001", "blocker")])).toBe(
      "blocked"
    );
  });

  it("renders diagnostic counts in badge labels", () => {
    expect(renderBadgeLabel("clean", 0)).toBe("SearchLint clean");
    expect(renderBadgeLabel("blocked", 3)).toBe("SearchLint blocked: 3");
  });

  it("renders mixed-severity badge counts as issues", () => {
    const html = renderOverlayHtml({
      status: "errors",
      diagnostics: [
        diagnostic("SL-CANON-001", "error"),
        diagnostic("SL-IMG-001", "warning"),
        diagnostic("SL-IMG-004", "info")
      ]
    });

    expect(html).toContain('aria-label="SearchLint issues: 3"');
    expect(html).toContain(">3 issues</span>");
    expect(html).not.toContain(">3 errors</span>");
    expect(html).not.toContain('class="sl-badge__label"');
  });

  it("snaps dragged badges to the nearest viewport corner", () => {
    expect(nearestOverlayPosition(1000, 800, 100, 100)).toBe("top-left");
    expect(nearestOverlayPosition(1000, 800, 900, 100)).toBe("top-right");
    expect(nearestOverlayPosition(1000, 800, 100, 700)).toBe("bottom-left");
    expect(nearestOverlayPosition(1000, 800, 900, 700)).toBe("bottom-right");
  });
});

describe("diagnostic filtering and rendering", () => {
  it("filters by severity, category, and source", () => {
    const diagnostics = [
      diagnostic("SL-INDEX-001", "blocker", "raw-html"),
      diagnostic("SL-META-005", "error", "rendered-dom"),
      diagnostic("SL-CANON-001", "error", "http-header")
    ];

    expect(
      filterDiagnostics(diagnostics, {
        severity: "error",
        category: "title-metadata",
        source: "rendered-dom"
      }).map((item) => item.ruleId)
    ).toEqual(["SL-META-005"]);
  });

  it("maps rule IDs to catalog categories", () => {
    expect(categoryForRuleId("SL-HTTP-001")).toBe("http-rendering");
    expect(categoryForRuleId("SL-INDEX-001")).toBe("indexability");
    expect(categoryForRuleId("SL-META-001")).toBe("title-metadata");
    expect(categoryForRuleId("SL-UNKNOWN-001")).toBe("unknown");
  });

  it("renders required diagnostic fields and raw/rendered distinctions", () => {
    const html = renderOverlayHtml({
      status: "errors",
      diagnostics: [
        {
          ...diagnostic("SL-META-005", "error", "raw-html"),
          explanation: "Description is required for this route.",
          expected: "meta description",
          actual: "missing",
          rawHtmlSnippet: "<html><head></head></html>",
          renderedDomSnippet:
            "<html><head><title>Rendered</title></head></html>"
        }
      ]
    });

    expect(html).toContain("SEO diagnostics");
    expect(html).toContain("Diagnostic summary");
    expect(html).toContain("<strong>1</strong> Error");
    expect(html).toContain("Description is required");
    expect(html).toContain("Expected");
    expect(html).toContain("Actual");
    expect(html).toContain("Raw HTML");
    expect(html).toContain("Rendered DOM");
    expect(html).toContain("Title &amp; metadata");
    expect(html).toContain("Source type</strong> Raw HTML");
    expect(html).toContain("All severities");
    expect(html).toContain("All categories");
    expect(html).toContain("All sources");
    expect(html).toContain("Copy diagnostic");
    expect(html).toContain("Suppress");
    expect(html).toContain("Rerun analysis");
    expect(html).toContain('class="sl-icon-button"');
    expect(html).toContain('aria-label="Close SearchLint diagnostics"');
    expect(html).not.toContain(">Close</button>");
  });

  it("renders machine-readable diagnostic attributes for QA automation", () => {
    const html = renderOverlayHtml({
      status: "warnings",
      diagnostics: [
        diagnostic("SL-IMG-007", "warning", "rendered-dom", {
          confidence: "RELATED",
          selector: 'img[src="/logo.svg"]'
        })
      ]
    });

    expect(html).toContain('data-searchlint-rule-id="SL-IMG-007"');
    expect(html).toContain('data-searchlint-severity="warning"');
    expect(html).toContain('data-searchlint-category="images-social-preview"');
    expect(html).toContain('data-searchlint-source="rendered-dom"');
  });

  it("renders deterministic badge positions, RTL direction, and fallback errors", () => {
    const html = renderOverlayHtml({
      status: "blocked",
      diagnostics: [diagnostic("SL-INDEX-001", "blocker")],
      position: "top-left",
      direction: "rtl",
      runtimeError: "SearchLint runtime failed while analyzing the page."
    });

    expect(html).toContain("sl-position--top-left");
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('role="alert"');
    expect(html).toContain("SearchLint overlay error");
    expect(html).toContain("runtime failed");
  });

  it("renders long and large diagnostic sets with wrapping styles", () => {
    const diagnostics = Array.from({ length: 1000 }, (_, index) =>
      diagnostic(
        index === 0 ? "SL-INDEX-001" : "SL-META-005",
        index === 0 ? "blocker" : "error"
      )
    ).map((item, index) => ({
      ...item,
      fingerprint: `large-${index}`,
      title: `Diagnostic ${index} ${"long-word-".repeat(20)}`,
      evidence: `Evidence ${index} ${"content ".repeat(30)}`
    }));

    const html = renderOverlayHtml({
      status: "blocked",
      diagnostics
    });

    expect(html).toContain('aria-label="SearchLint issues: 1000"');
    expect(html).toContain("1000 issues");
    expect(html.match(/<article class="sl-card/g)?.length).toBe(1000);
    expect(html).toContain("overflow-wrap: anywhere");
  });

  it("shows file and line only for EXACT source locations", () => {
    const exact = diagnostic("SL-META-005", "error", "source-code", {
      confidence: "EXACT",
      file: "app/page.tsx",
      line: 12
    });
    const related = diagnostic("SL-META-006", "warning", "source-code", {
      confidence: "RELATED",
      selector: "meta[name=description]"
    });

    const html = renderOverlayHtml({
      status: "errors",
      diagnostics: [exact, related]
    });

    expect(html).toContain("app/page.tsx:12");
    expect(html).not.toContain("RELATED");
    expect(html).toContain("Highlight");
    expect(html).toContain("meta[name=description]");
  });

  it("renders a product empty state when the page has no diagnostics", () => {
    const html = renderOverlayHtml({
      status: "clean",
      diagnostics: []
    });

    expect(html).toContain("No SEO diagnostics found");
    expect(html).toContain("No issues found.");
    expect(html).toContain("passes the local SearchLint checks");
  });
});

describe("shadow DOM and accessibility contract", () => {
  it("renders a Shadow DOM host-only contract with ARIA and keyboard targets", () => {
    const html = renderOverlayHtml({
      status: "blocked",
      diagnostics: [diagnostic("SL-INDEX-001", "blocker")]
    });

    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain('aria-controls="searchlint-panel"');
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="false"');
    expect(html).toContain('aria-labelledby="searchlint-panel-title"');
    expect(html).toContain('aria-describedby="searchlint-panel-description"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('role="list"');
    expect(html).toContain('tabindex="-1"');
    expect(html).toContain(":focus-visible");
    expect(html).not.toContain("<script");
  });

  it("produces a passing deterministic accessibility report", () => {
    const report = createOverlayAccessibilityReport({
      status: "blocked",
      diagnostics: [diagnostic("SL-INDEX-001", "blocker")]
    });

    expect(report.passed).toBe(true);
    expect(report.checks.map((check) => check.id)).toEqual([
      "badge-controls-dialog",
      "dialog-is-non-modal-and-labelled",
      "diagnostic-count-live-region",
      "filter-controls-named",
      "list-semantics",
      "action-controls-named",
      "focus-visible-style",
      "forced-colors-support",
      "reduced-motion-support",
      "runtime-error-fallback",
      "no-inline-script"
    ]);
  });

  it("escapes diagnostic content before rendering into the overlay", () => {
    const html = renderOverlayHtml({
      status: "errors",
      diagnostics: [
        {
          ...diagnostic("SL-META-005", "error"),
          title: "<img src=x onerror=alert(1)>"
        }
      ]
    });

    expect(html).toContain("&lt;img");
    expect(html).not.toContain("<img src=x");
  });
});

function diagnostic(
  ruleId: string,
  severity: Diagnostic["severity"],
  source: Diagnostic["source"] = "raw-html",
  sourceLocation?: Diagnostic["sourceLocation"]
): OverlayRenderDiagnostic {
  return createDiagnostic({
    ruleId,
    severity,
    confidence: "certain",
    pageUrl: "https://example.com/products/1",
    route: "/products/**",
    source,
    title: `${ruleId} title`,
    evidence: `${ruleId} evidence`,
    ...(sourceLocation === undefined ? {} : { sourceLocation }),
    observedAt
  });
}
