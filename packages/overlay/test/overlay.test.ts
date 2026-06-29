import { describe, expect, it } from "vitest";

import { createDiagnostic, type Diagnostic } from "@searchlint/core";

import {
  categoryForRuleId,
  createOverlayAccessibilityReport,
  deriveBadgeState,
  filterDiagnostics,
  formatAllFixesPrompt,
  formatDiagnosticForClipboard,
  formatDiagnosticFixPrompt,
  formatSuppressActionMessage,
  highlightSelector,
  mergeOverlayRuntimeState,
  nearestOverlayPosition,
  parseOverlayPosition,
  readStoredOverlayPosition,
  renderBadgeLabel,
  renderOverlayHtml,
  sortDiagnosticsByPriority,
  tryReleasePointerCapture,
  trySetPointerCapture,
  updateOverlayFilters,
  writeStoredOverlayPosition,
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
    expect(renderBadgeLabel("blocked", 1)).toBe("SearchLint blocker: 1");
    expect(renderBadgeLabel("blocked", 3)).toBe("SearchLint blockers: 3");
    expect(renderBadgeLabel("errors", 1)).toBe("SearchLint error: 1");
    expect(renderBadgeLabel("warnings", 2)).toBe("SearchLint warnings: 2");
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
    expect(html).toContain(">Open</span>");
    expect(html).not.toContain(">3 issues</span>");
    expect(html).not.toContain(">3 errors</span>");
    expect(html).not.toContain('class="sl-badge__label"');
  });

  it("renders singular badge issue text and labels", () => {
    const html = renderOverlayHtml({
      status: "errors",
      diagnostics: [diagnostic("SL-CANON-001", "error")]
    });

    expect(html).toContain('aria-label="SearchLint error: 1"');
    expect(html).toContain(">Open</span>");
    expect(html).not.toContain(">1 error</span>");
    expect(html).not.toContain('aria-label="SearchLint errors: 1"');
    expect(html).not.toContain(">1 errors</span>");
  });

  it("keeps the badge visual contract aligned to the Figma side tab", () => {
    const html = renderOverlayHtml({
      status: "errors",
      diagnostics: [diagnostic("SL-CANON-001", "error")]
    });

    expect(html).toContain("* { box-sizing: border-box; }");
    expect(html).toContain("width: 36px; height: fit-content;");
    expect(html).toContain("min-height: 89px;");
    expect(html).toContain("padding: 8px 2px 2px;");
    expect(html).toContain("border: 1px solid #E8E8E8;");
    expect(html).toContain(
      ".sl-badge--clean, .sl-badge--checking, .sl-badge--info, .sl-badge--warnings, .sl-badge--errors, .sl-badge--blocked { border-color: #E8E8E8; border-inline-color: #E8E8E8; }"
    );
    expect(html).toContain("background: #fafaf9;");
    expect(html).toContain("color: #726a5a;");
    expect(html).toContain("border-radius: 8px 0 0 8px;");
    expect(html).toContain("width: 12px; height: fit-content;");
    expect(html).toContain("min-height: 7.5ch;");
    expect(html).toContain("width: 32px; height: 32px;");
    expect(html).toContain("font: 400 16px/1 Inter, ui-sans-serif, system-ui;");
    expect(html).toContain(
      ".sl-badge__status { display: block; color: #726a5a; font-weight: 400; letter-spacing: 0; transform: rotate(-90deg); }"
    );
    expect(html).toContain(
      ".sl-position--left .sl-badge__status { transform: rotate(90deg); }"
    );
    expect(html).not.toContain('class="sl-badge__label"');
  });

  it("renders the badge as the overlay toggle control", () => {
    const html = renderOverlayHtml({
      status: "errors",
      diagnostics: [diagnostic("SL-CANON-001", "error")]
    });

    expect(html).toContain('class="sl-badge sl-badge--errors');
    expect(html).toContain('data-action="toggle"');
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain('aria-controls="searchlint-panel"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('id="searchlint-panel"');
    expect(html).toContain('role="dialog"');
    expect(html).toContain('hidden tabindex="-1"');
  });

  it("keeps the overlay panel constrained for mobile viewports", () => {
    const html = renderOverlayHtml({
      status: "errors",
      diagnostics: [diagnostic("SL-CANON-001", "error")]
    });

    expect(html).toContain('.sl-drawer[data-state="open"] { top: 0;');
    expect(html).toContain("width: min(476.778px, calc(100vw - 36px));");
    expect(html).toContain("height: 100vh; max-height: 100vh;");
    expect(html).toContain(
      '.sl-drawer[data-state="open"] { top: 0; width: calc(min(476.778px, calc(100vw - 36px)) + 36px); height: 100vh; margin-top: 0; animation: sl-drawer-open-right 220ms ease-out both; }'
    );
    expect(html).toContain(
      ".sl-position--right .sl-panel { border-right: 0; border-radius: 8px 0 0 8px; }"
    );
    expect(html).toContain(
      ".sl-position--left .sl-panel { border-left: 0; border-radius: 0 8px 8px 0; }"
    );
    expect(html).toContain(
      ".sl-panel__scroll { overflow: auto; min-height: 0; }"
    );
    expect(html).toContain("overflow-wrap: anywhere;");
  });

  it("keeps the invisible host click-through while badge and panel stay interactive", () => {
    const html = renderOverlayHtml({
      status: "errors",
      diagnostics: [diagnostic("SL-CANON-001", "error")]
    });

    expect(html).toContain(":host { all: initial;");
    expect(html).toContain("pointer-events: none;");
    expect(html).toContain(".sl-drawer { position: fixed;");
    expect(html).toContain("height: fit-content;");
    expect(html).toContain("transform: translateY(-50%);");
    expect(html).toContain("pointer-events: auto;");
    expect(html).toContain(".sl-panel { display: flex;");
  });

  it("wraps long diagnostic content instead of letting it break layout", () => {
    const longWord = "x".repeat(240);
    const html = renderOverlayHtml({
      status: "errors",
      diagnostics: [
        {
          ...diagnostic("SL-META-005", "error"),
          title: `Long ${longWord}`,
          explanation: `Message ${longWord}`,
          evidence: `Evidence ${longWord}`,
          pageUrl: `https://example.com/${longWord}`,
          rawHtmlSnippet: `<meta content="${longWord}">`
        }
      ]
    });

    expect(html).toContain(`Long ${longWord}`);
    expect(html).toContain(`Message ${longWord}`);
    expect(html).toContain(`Evidence ${longWord}`);
    expect(html).toContain(`https://example.com/${longWord}`);
    expect(html).toContain("overflow-wrap: anywhere;");
    expect(html).toContain("white-space: pre-wrap;");
    expect(html).toContain("pre { max-height: 160px; overflow: auto;");
  });

  it("renders clean badge text when no diagnostics are present", () => {
    const html = renderOverlayHtml({
      status: "clean",
      diagnostics: []
    });

    expect(html).toContain('aria-label="SearchLint clean"');
    expect(html).not.toContain("sl-badge--expanded");
    expect(html).toContain(">Open</span>");
    expect(html).not.toContain(">all good</span>");
  });

  it("does not render all-good badge text for runtime error states", () => {
    const html = renderOverlayHtml({
      status: "errors",
      diagnostics: [],
      runtimeError: "SearchLint analysis failed."
    });

    expect(html).toContain('aria-label="SearchLint error"');
    expect(html).toContain(">Open</span>");
    expect(html).not.toContain(">error</span>");
    expect(html).toContain("SearchLint overlay error");
    expect(html).not.toContain(">all good</span>");
  });

  it("does not present zero-diagnostic runtime errors as passing checks", () => {
    const html = renderOverlayHtml({
      status: "errors",
      diagnostics: [],
      runtimeError: "SearchLint analysis failed."
    });

    expect(html).toContain("SearchLint analysis did not complete");
    expect(html).toContain("Runtime error details are shown below.");
    expect(html).toContain("SearchLint overlay error");
    expect(html).not.toContain("No SEO diagnostics found");
    expect(html).not.toContain("passes the local SearchLint checks");
  });

  it("snaps dragged badges to the nearest viewport side", () => {
    expect(nearestOverlayPosition(1000, 800, 100, 100)).toBe("left");
    expect(nearestOverlayPosition(1000, 800, 900, 100)).toBe("right");
    expect(nearestOverlayPosition(1000, 800, 100, 700)).toBe("left");
    expect(nearestOverlayPosition(1000, 800, 900, 700)).toBe("right");
  });

  it("validates and persists dragged badge positions safely", () => {
    const entries = new Map<string, string>();
    const storage = {
      getItem(key: string) {
        return entries.get(key) ?? null;
      },
      setItem(key: string, value: string) {
        entries.set(key, value);
      }
    };

    expect(parseOverlayPosition("left")).toBe("left");
    expect(parseOverlayPosition("right")).toBe("right");
    expect(parseOverlayPosition("top-left")).toBe("left");
    expect(parseOverlayPosition("bottom-right")).toBe("right");
    expect(parseOverlayPosition("center")).toBeUndefined();
    expect(readStoredOverlayPosition(storage)).toBeUndefined();
    expect(writeStoredOverlayPosition(storage, "right")).toBe(true);
    expect(readStoredOverlayPosition(storage)).toBe("right");
    entries.set("searchlint.overlay.position", "center");
    expect(readStoredOverlayPosition(storage)).toBeUndefined();
  });

  it("ignores unavailable badge position storage", () => {
    const throwingStorage = {
      getItem() {
        throw new Error("storage unavailable");
      },
      setItem() {
        throw new Error("storage unavailable");
      }
    };

    expect(readStoredOverlayPosition(undefined)).toBeUndefined();
    expect(readStoredOverlayPosition(throwingStorage)).toBeUndefined();
    expect(writeStoredOverlayPosition(undefined, "left")).toBe(false);
    expect(writeStoredOverlayPosition(throwingStorage, "left")).toBe(false);
  });

  it("treats pointer capture as best-effort during badge drag", () => {
    expect(trySetPointerCapture(null, 1)).toBe(false);
    expect(tryReleasePointerCapture(undefined, 1)).toBe(false);
    expect(
      trySetPointerCapture(
        {
          setPointerCapture() {
            throw new DOMException("pointer inactive", "InvalidStateError");
          }
        },
        1
      )
    ).toBe(false);
    expect(
      tryReleasePointerCapture(
        {
          releasePointerCapture() {
            throw new DOMException("pointer inactive", "InvalidStateError");
          }
        },
        1
      )
    ).toBe(false);

    let capturedPointerId: number | undefined;
    let releasedPointerId: number | undefined;
    expect(
      trySetPointerCapture(
        {
          setPointerCapture(pointerId: number) {
            capturedPointerId = pointerId;
          }
        },
        7
      )
    ).toBe(true);
    expect(
      tryReleasePointerCapture(
        {
          releasePointerCapture(pointerId: number) {
            releasedPointerId = pointerId;
          }
        },
        7
      )
    ).toBe(true);
    expect(capturedPointerId).toBe(7);
    expect(releasedPointerId).toBe(7);
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

  it("sorts diagnostics by severity priority without mutating inputs", () => {
    const diagnostics = [
      diagnostic("SL-IMG-004", "info"),
      diagnostic("SL-META-015", "warning"),
      diagnostic("SL-INDEX-001", "blocker"),
      diagnostic("SL-META-005", "error")
    ];

    expect(
      sortDiagnosticsByPriority(diagnostics).map((item) => item.ruleId)
    ).toEqual(["SL-INDEX-001", "SL-META-005", "SL-META-015", "SL-IMG-004"]);
    expect(diagnostics.map((item) => item.ruleId)).toEqual([
      "SL-IMG-004",
      "SL-META-015",
      "SL-INDEX-001",
      "SL-META-005"
    ]);
  });

  it("sorts diagnostics deterministically within the same severity", () => {
    const diagnostics = [
      {
        ...diagnostic("SL-META-010", "error"),
        fingerprint: "fingerprint-b"
      },
      {
        ...diagnostic("SL-META-005", "error"),
        fingerprint: "fingerprint-c"
      },
      {
        ...diagnostic("SL-META-005", "error"),
        fingerprint: "fingerprint-a"
      }
    ];

    expect(["SL-META-010", "SL-META-005"].sort()).toEqual([
      "SL-META-005",
      "SL-META-010"
    ]);
    expect(
      sortDiagnosticsByPriority(diagnostics).map(
        (item) => `${item.ruleId}:${item.fingerprint}`
      )
    ).toEqual([
      "SL-META-005:fingerprint-a",
      "SL-META-005:fingerprint-c",
      "SL-META-010:fingerprint-b"
    ]);
  });

  it("renders highest severity diagnostics first", () => {
    const html = renderOverlayHtml({
      status: "blocked",
      diagnostics: [
        diagnostic("SL-IMG-004", "info"),
        diagnostic("SL-META-015", "warning"),
        diagnostic("SL-INDEX-001", "blocker"),
        diagnostic("SL-META-005", "error")
      ]
    });

    expect(renderedRuleIds(html)).toEqual([
      "SL-INDEX-001",
      "SL-META-005",
      "SL-META-015",
      "SL-IMG-004"
    ]);
  });

  it("updates filter state from overlay form controls", () => {
    expect(updateOverlayFilters({}, "severity", "warning")).toEqual({
      severity: "warning"
    });
    expect(
      updateOverlayFilters({ severity: "warning" }, "category", "all")
    ).toEqual({
      severity: "warning",
      category: "all"
    });
    expect(
      updateOverlayFilters(
        { severity: "warning", category: "all" },
        "source",
        "rendered-dom"
      )
    ).toEqual({
      severity: "warning",
      category: "all",
      source: "rendered-dom"
    });
    expect(
      updateOverlayFilters({ severity: "warning" }, "severity", "critical")
    ).toEqual({
      severity: "warning"
    });
  });

  it("renders only diagnostics matching active filters", () => {
    const html = renderOverlayHtml({
      status: "errors",
      filters: {
        severity: "warning",
        category: "images-social-preview",
        source: "rendered-dom"
      },
      diagnostics: [
        diagnostic("SL-META-005", "error", "raw-html"),
        diagnostic("SL-IMG-007", "warning", "rendered-dom")
      ]
    });

    expect(html.match(/<article class="sl-card/g)?.length).toBe(1);
    expect(html).toContain('data-searchlint-rule-id="SL-IMG-007"');
    expect(html).not.toContain('data-searchlint-rule-id="SL-META-005"');
    expect(html).toContain('<option value="warning" selected>');
    expect(html).toContain('<option value="images-social-preview" selected>');
    expect(html).toContain('<option value="rendered-dom" selected>');
    expect(html).toContain('aria-label="Filtered diagnostic summary"');
    expect(html).toContain("<strong>0</strong> Errors");
    expect(html).toContain("<strong>1</strong> Warning");
  });

  it("renders a filtered-empty summary when filters hide every diagnostic", () => {
    const html = renderOverlayHtml({
      status: "errors",
      filters: {
        severity: "warning"
      },
      diagnostics: [diagnostic("SL-META-005", "error", "raw-html")]
    });

    expect(html.match(/<article class="sl-card/g)?.length ?? 0).toBe(0);
    expect(html).toContain("No matching diagnostics");
    expect(html).toContain("Current filters hide all 1 SearchLint finding.");
    expect(html).not.toContain("No SEO diagnostics found");
  });

  it("pluralizes filtered-empty hidden finding counts", () => {
    const html = renderOverlayHtml({
      status: "errors",
      filters: {
        severity: "warning"
      },
      diagnostics: [
        diagnostic("SL-META-005", "error", "raw-html"),
        diagnostic("SL-META-006", "error", "rendered-dom")
      ]
    });

    expect(html).toContain("Current filters hide all 2 SearchLint findings.");
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
    expect(html).toContain("SL-META-005");
    expect(html).toContain('data-searchlint-rule-id="SL-META-005"');
    expect(html).toContain('data-searchlint-severity="error"');
    expect(html).toContain('<span class="sl-severity">Error</span>');
    expect(html).toContain("Description is required");
    expect(html).toContain("SL-META-005 evidence");
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
    expect(html).not.toContain("Suppress");
    expect(html).not.toContain("Rerun analysis");
    expect(html).toContain('aria-label="Close SearchLint diagnostics"');
    expect(html).not.toContain('data-action="language-toggle"');
    expect(html).not.toContain("Переключить язык на русский");
    expect(html).not.toContain('class="sl-icon-button sl-language-button"');
    expect(html).not.toContain(">Close</button>");
  });

  it("renders the full feed panel with honest connected and not-connected metrics", () => {
    const html = renderOverlayHtml({
      status: "warnings",
      diagnostics: [
        diagnostic("SL-IMG-007", "warning", "rendered-dom"),
        diagnostic("SL-META-009", "info", "rendered-dom")
      ],
      pageUrl: "http://localhost:3001/",
      siteEssentials: {
        source: "browser-fetch",
        capturedAt: "2026-06-21T00:00:00.000Z",
        pageUrl: "http://localhost:3001/",
        essentials: [
          {
            key: "robots",
            label: "robots.txt",
            status: "pass",
            detail: "robots.txt is reachable.",
            url: "http://localhost:3001/robots.txt"
          },
          {
            key: "sitemap",
            label: "sitemap.xml",
            status: "issue",
            detail:
              "sitemap.xml is missing. Add it so crawlers and agents can discover intended pages.",
            url: "http://localhost:3001/sitemap.xml"
          },
          {
            key: "llms",
            label: "llms.txt",
            status: "issue",
            detail:
              "llms.txt is missing. Add it when AI/LLM discovery should be explicit.",
            url: "http://localhost:3001/llms.txt"
          },
          {
            key: "not-found",
            label: "404 / not-found",
            status: "pass",
            detail: "Missing pages return HTTP 404.",
            url: "http://localhost:3001/__searchlint_missing_page__"
          },
          {
            key: "mobile",
            label: "Mobile check",
            status: "not-proven",
            detail:
              "Current viewport is 1440px wide. Rerun in a narrow viewport or use PageSpeed mobile before treating mobile UX as checked."
          },
          {
            key: "crawler",
            label: "Full-site crawl",
            status: "provider-needed",
            detail:
              "Run the crawler to prove orphan pages, broken links, crawl depth, and sitemap coverage."
          }
        ]
      },
      linkAudit: {
        source: "browser-dom",
        capturedAt: "2026-06-21T00:00:00.000Z",
        pageUrl: "http://localhost:3001/",
        siteOrigin: "https://outlivion.space",
        internalLinks: [
          {
            url: "https://outlivion.space/pricing",
            label: "Pricing",
            count: 3
          },
          {
            url: "https://outlivion.space/vpn-dlya-rossii",
            label: "VPN for Russia",
            count: 1
          }
        ],
        externalLinks: [
          {
            url: "https://t.me/outlivion",
            label: "Telegram",
            count: 2,
            rel: "noopener",
            target: "_blank"
          }
        ],
        backlinks: {
          status: "not-configured",
          message:
            "Connect a backlink provider to fetch backlinks, referring domains, and link quality."
        }
      },
      technicalAudit: {
        source: "browser-dom",
        capturedAt: "2026-06-21T00:00:00.000Z",
        pageUrl: "http://localhost:3001/",
        score: 96,
        overview: [
          { label: "Server", value: "N/A", status: "unknown" },
          { label: "Status", value: "200", status: "pass" },
          { label: "DOM Size", value: "111 KB", status: "pass" }
        ],
        timings: [
          { label: "TTFB", value: "486ms", status: "warn" },
          { label: "Download", value: "3ms", status: "pass" }
        ],
        renderBlocking: [
          { label: "Blocking Scripts", value: "1", status: "warn" },
          { label: "Blocking Stylesheets", value: "1", status: "warn" }
        ],
        relevance: [
          { label: "Title Relevance", value: "89%", status: "pass" },
          { label: "Keyword Relevance", value: "0%", status: "error" }
        ],
        openGraph: [{ label: "og:type", value: "website", status: "pass" }],
        twitter: [
          {
            label: "twitter:card",
            value: "summary_large_image",
            status: "pass"
          }
        ]
      },
      geoAudit: {
        source: "browser-dom",
        capturedAt: "2026-06-21T00:00:00.000Z",
        pageUrl: "http://localhost:3001/",
        score: 80,
        primaryMarket: "Russia / ru-RU",
        detectedLanguage: "ru",
        locale: "ru_RU",
        hreflangStatus: "present",
        localIntent: "Russia intent / Local currency / Telegram channel",
        languageSignals: [
          { label: "HTML lang", value: "ru", status: "pass" },
          { label: "OG locale", value: "ru_RU", status: "pass" },
          { label: "Hreflang", value: "Present", status: "pass" }
        ],
        regionalSignals: [
          { label: "Russia intent", value: "Detected", status: "pass" },
          { label: "Local currency", value: "Detected", status: "pass" }
        ],
        marketCoverage: [
          {
            url: "https://outlivion.space/vpn-dlya-rossii",
            label: "VPN для России",
            market: "Russia",
            locale: "ru-RU",
            links: 2,
            status: "pass"
          }
        ],
        providers: [
          {
            label: "Google Search Console",
            value: "Not connected",
            status: "unknown"
          },
          {
            label: "Yandex Webmaster",
            value: "Not connected",
            status: "unknown"
          }
        ]
      }
    });

    expect(html).toContain("Last local audit: 2026-06-21");
    expect(html).toContain('class="sl-tabs"');
    expect(html).toContain('data-action="feed-tab"');
    expect(html).toContain('data-feed-tab="seo"');
    expect(html).toContain('data-feed-tab="links"');
    expect(html).toContain('data-feed-tab="technical"');
    expect(html).toContain('data-feed-tab="geo"');
    expect(html).toContain("PageSpeed Scores");
    expect(html).toContain("PageSpeed Scores:");
    expect(html).toContain("Quick quality scores for speed");
    expect(html).toContain("Next best SEO fix");
    expect(html).toContain("Next best link fix");
    expect(html).toContain("Next best technical fix");
    expect(html).toContain("Next best GEO fix");
    expect(html).toContain("<dt>Source</dt>");
    expect(html).toContain("<dt>Confidence</dt>");
    expect(html).toContain("<dt>Evidence</dt>");
    expect(html).toContain("Top SEO fixes");
    expect(html).toContain("Copy top fixes");
    expect(html).toContain("Copy fix prompt");
    expect(html).toContain("Copy task");
    expect(html).toContain('data-action="copy-action-prompt"');
    expect(html).toContain(
      "SearchLint%20site-essential%20task%3A%20sitemap.xml"
    );
    expect(html).toContain(
      "SearchLint%20task%3A%20Connect%20Google%20PageSpeed"
    );
    expect(html).toContain("Fix soon");
    expect(html).toContain("Site essentials");
    expect(html).toContain("Site essentials:");
    expect(html).toContain("robots.txt");
    expect(html).toContain("sitemap.xml");
    expect(html).toContain("llms.txt");
    expect(html).toContain("404 / not-found");
    expect(html).toContain("Mobile check");
    expect(html).toContain("Full-site crawl");
    expect(html).toContain("Provider needed");
    expect(html).toContain("AI/LLM discovery");
    expect(html).toContain("Connect Google PageSpeed");
    expect(html).toContain("Requires SEARCHLINT_PAGESPEED_API_KEY");
    expect(
      html.match(/Requires SEARCHLINT_PAGESPEED_API_KEY/g) ?? []
    ).toHaveLength(1);
    expect(html).toContain(
      "Local timing pending · Google provider not connected"
    );
    expect(html).toContain("Google PageSpeed");
    expect(html).toContain("Accessibility");
    expect(html).toContain("Best Practices");
    expect(html).toContain("Core Web Vitals");
    expect(html).toContain("Speed and stability signals");
    expect(html).toContain('aria-label="Links Audit"');
    expect(html).toContain("Backlinks");
    expect(html).toContain("Referring domains");
    expect(html).toContain("Quality");
    expect(html).toContain("Link next steps");
    expect(html).toContain("Connect a backlink provider");
    expect(html).toContain("Run crawler for site graph");
    expect(html).toContain("Review outbound authority");
    expect(html).toContain("Internal pages");
    expect(html).toContain("External links");
    expect(html).toContain("https://outlivion.space/pricing");
    expect(html).toContain("3 references");
    expect(html).toContain("https://t.me/outlivion");
    expect(html).toContain("rel=noopener");
    expect(html).toContain("target=_blank");
    expect(html).toContain(
      "Connect a backlink provider to fetch backlinks, referring domains, and link quality."
    );
    expect(html).toContain('aria-label="Technical Audit"');
    expect(html).toContain("On-Page Overview");
    expect(html).toContain("On-Page Score");
    expect(html).toContain("Technical next steps");
    expect(html).toContain("Review site essentials");
    expect(html).toContain("Reduce render-blocking assets");
    expect(html).toContain("Align metadata with visible content");
    expect(html).toContain("Verify server headers");
    expect(html).toContain("Server Timing");
    expect(html).toContain("Needs response headers");
    expect(html).toContain("Render Blocking");
    expect(html).toContain("Content Relevance");
    expect(html).toContain("Open Graph");
    expect(html).toContain("Twitter");
    expect(html).toContain("twitter:card");
    expect(html).toContain('aria-label="GEO Audit"');
    expect(html).toContain("GEO Overview");
    expect(html).toContain("Region Signal Score");
    expect(html).toContain("GEO next steps");
    expect(html).toContain("Connect regional search providers");
    expect(html).toContain("Language &amp; Locale");
    expect(html).toContain("Regional Search Signals");
    expect(html).toContain("Market Coverage");
    expect(html).toContain("Search Engine Providers");
    expect(html).toContain("Google Search Console");
    expect(html).toContain("Yandex Webmaster");
    expect(html).toContain("Provider not connected");
    expect(html).toContain("SEO Health");
    expect(html).toContain("A grouped health summary");
    expect(html).toContain("Local diagnostics by signal group");
    expect(html).toContain("Waiting for local browser timing");
    expect(html).toContain("Issues");
    expect(html).toContain("Exact SearchLint findings");
    expect(html).toContain("Indexability");
    expect(html).toContain("Metadata");
    expect(html).toContain("Images");
    expect(html).toContain("Links");
    expect(html).toContain("Technical");
    expect(html).toContain("Schema");
    expect(html).toContain("Warn · 1 issue");
    expect(html).toContain("Pass");
    expect(html).toContain('data-searchlint-feed-rule-id="SL-IMG-007"');
    expect(html).toContain('data-searchlint-feed-rule-id="SL-META-009"');
    expect(html).toContain('data-feed-section="seo"');
    expect(html).toContain('data-feed-section="links"');
    expect(html).toContain('data-feed-section="technical"');
    expect(html).toContain('data-feed-section="geo"');
    expect(html).toContain(".sl-feed-section[hidden] { display: none; }");
    expect(html).not.toContain("External signals");
    expect(html).not.toContain("Domain Rating");
    expect(html).not.toContain("Authority provider");
    expect(html).not.toContain("domain rating");
    expect(html).not.toContain("Last audited: 01.05.2026");
    expect(html).not.toContain(">88</strong>");
    expect(html).not.toContain(">99</strong>");
    expect(html).not.toContain(">3.5s</strong>");
    expect(html).not.toContain("Mobile Friendly");
    expect(html).not.toContain("Very Difficult");
  });

  it("renders local browser performance metrics when the dev client provides them", () => {
    const html = renderOverlayHtml({
      status: "warnings",
      diagnostics: [
        diagnostic("SL-IMG-007", "warning", "rendered-dom"),
        diagnostic("SL-META-009", "info", "rendered-dom")
      ],
      pageUrl: "http://localhost:3001/",
      localPerformance: {
        source: "browser-performance",
        capturedAt: "2026-06-21T00:00:00.000Z",
        viewport: { width: 1310, height: 1255 },
        lcpMs: 2400,
        fcpMs: 1200,
        tbtMs: 120,
        cls: 0.08
      },
      externalMetrics: {
        pageSpeed: {
          source: "google-pagespeed",
          status: "available",
          strategy: "mobile",
          pageUrl: "https://example.com/",
          fetchedAt: "2026-06-21T00:00:00.000Z",
          scores: {
            performance: 88,
            accessibility: 100,
            bestPractices: 73,
            seo: 100
          },
          vitals: {
            lcpMs: 2400,
            fcpMs: 1200,
            tbtMs: 120,
            cls: 0.08
          }
        }
      }
    });

    expect(html).toContain("PageSpeed Scores");
    expect(html).toContain("Google PageSpeed · mobile · 2026-06-21");
    expect(html).toContain("Core Web Vitals");
    expect(html).toContain("<h4>Local browser</h4>");
    expect(html).toContain("<h4>Google PageSpeed</h4>");
    expect(html).toContain("Accessibility");
    expect(html).toContain("Best Practices");
    expect(html).not.toContain("<strong>N/A</strong></div><span>Accessibility");
    expect(html).not.toContain(
      "<strong>N/A</strong></div><span>Best Practices"
    );
    expect(html).toContain(">88</strong>");
    expect(html).toContain(">100</strong>");
    expect(html).toContain(">73</strong>");
    expect(html).toContain("2.4s");
    expect(html).toContain("1.2s");
    expect(html).toContain("120ms");
    expect(html).toContain("0.080");
    expect(html).toContain("Largest Contentful Paint");
    expect(html).toContain("Total Blocking Time");
    expect(html).toContain("Cumulative Layout Shift");
    expect(html).toContain("Google PageSpeed lab metrics can differ");
    expect(html).not.toContain("Waiting for local browser timing");
    expect(html).toContain("Google PageSpeed");
    expect(html).not.toContain("Google provider not connected");
  });

  it("renders suppress action only when suppression is enabled", () => {
    const withoutSuppress = renderOverlayHtml({
      status: "errors",
      diagnostics: [diagnostic("SL-META-005", "error")]
    });
    const withSuppress = renderOverlayHtml({
      status: "errors",
      diagnostics: [diagnostic("SL-META-005", "error")],
      suppressEnabled: true
    });

    expect(withoutSuppress).toContain("Copy diagnostic");
    expect(withoutSuppress).not.toContain("Suppress");
    expect(withSuppress).toContain("Copy diagnostic");
    expect(withSuppress).toContain("Suppress");
  });

  it("gives repeated diagnostic actions rule-specific accessible names", () => {
    const html = renderOverlayHtml({
      status: "errors",
      diagnostics: [
        diagnostic("SL-META-005", "error", "rendered-dom", {
          confidence: "EXACT",
          selector: "title"
        }),
        diagnostic("SL-IMG-007", "warning", "rendered-dom")
      ],
      suppressEnabled: true
    });

    expect(html).toContain('aria-label="Copy SL-META-005 diagnostic"');
    expect(html).toContain('aria-label="Copy SL-IMG-007 diagnostic"');
    expect(html).toContain('aria-label="Suppress SL-META-005 diagnostic"');
    expect(html).toContain('aria-label="Suppress SL-IMG-007 diagnostic"');
    expect(html).toContain('aria-label="Highlight SL-META-005 evidence"');
  });

  it("renders close header action without rerun or language actions by default", () => {
    const html = renderOverlayHtml({
      status: "errors",
      diagnostics: [diagnostic("SL-META-005", "error")]
    });

    expect(html).toContain('class="sl-header-actions"');
    expect(html).not.toContain('data-action="rerun"');
    expect(html).not.toContain('data-action="language-toggle"');
    expect(html).toContain('aria-label="Close SearchLint diagnostics"');
  });

  it("renders the header and tab labels in Russian language mode", () => {
    const html = renderOverlayHtml({
      status: "clean",
      diagnostics: [],
      language: "ru",
      linkAudit: {
        source: "browser-dom",
        capturedAt: observedAt,
        pageUrl: "https://example.com/",
        internalLinks: [],
        externalLinks: [],
        backlinks: { status: "not-configured" }
      },
      technicalAudit: {
        source: "browser-dom",
        capturedAt: observedAt,
        pageUrl: "https://example.com/",
        score: 88,
        overview: [
          { label: "Server", value: "N/A", status: "unknown" },
          { label: "Status", value: "200", status: "pass" },
          { label: "DOM Size", value: "32 KB", status: "pass" }
        ],
        timings: [],
        renderBlocking: [],
        relevance: [],
        openGraph: [],
        twitter: []
      },
      geoAudit: {
        source: "browser-dom",
        capturedAt: observedAt,
        pageUrl: "https://example.com/",
        score: 30,
        primaryMarket: "N/A",
        detectedLanguage: "N/A",
        locale: "N/A",
        hreflangStatus: "missing",
        localIntent: "N/A",
        languageSignals: [],
        regionalSignals: [
          { label: "Russia intent", value: "Missing", status: "warn" }
        ],
        marketCoverage: [],
        providers: [
          {
            label: "Yandex Webmaster",
            value: "Not connected",
            status: "unknown"
          }
        ]
      },
      siteEssentials: {
        source: "browser-fetch",
        capturedAt: observedAt,
        pageUrl: "https://example.com/",
        essentials: [
          {
            key: "robots",
            label: "robots.txt",
            status: "pass",
            detail: "robots.txt is available.",
            url: "https://example.com/robots.txt"
          },
          {
            key: "sitemap",
            label: "sitemap.xml",
            status: "issue",
            detail: "sitemap.xml is missing.",
            url: "https://example.com/sitemap.xml"
          },
          {
            key: "llms",
            label: "llms.txt",
            status: "not-proven",
            detail: "llms.txt could not be verified.",
            url: "https://example.com/llms.txt"
          },
          {
            key: "mobile",
            label: "Mobile check",
            status: "not-proven",
            detail:
              "Current viewport is 1200px wide. Rerun in a narrow viewport or use PageSpeed mobile before treating mobile UX as checked."
          },
          {
            key: "crawler",
            label: "Full-site crawl",
            status: "provider-needed",
            detail: "Run the crawler to prove site-wide issues."
          }
        ]
      }
    });

    expect(html).toContain(">SearchLint</h2>");
    expect(html).not.toContain("Лента агентов");
    expect(html).not.toContain("Agents Feed");
    expect(html).toContain(">Открыть</span>");
    expect(html).toContain('data-feed-tab="links">Ссылки</button>');
    expect(html).toContain('data-feed-tab="technical">Техника</button>');
    expect(html).not.toContain("Обновить проверку SearchLint");
    expect(html).toContain("Оценки страницы");
    expect(html).toContain("Исправить сейчас");
    expect(html).toContain("Почему это важно");
    expect(html).toContain("sl-provider-empty");
    expect(html).toContain("sl-essentials-summary");
    expect(html).toContain("Главное действие по ссылкам");
    expect(html).toContain("Источник");
    expect(html).toContain("Доверие");
    expect(html).toContain("N/A");
    expect(html).toContain("Что исправить сейчас");
    expect(html).toContain("Подключите Google PageSpeed");
    expect(html).toContain("База сайта");
    expect(html).toContain("База сайта:");
    expect(html).toContain("Пройдено");
    expect(html).toContain("Проблема");
    expect(html).toContain("Не доказано");
    expect(html).toContain("Нужен источник");
    expect(html).toContain("Мобильная проверка");
    expect(html).toContain("Мобильный viewport не доказан");
    expect(html).toContain("Полный обход сайта");
    expect(html).toContain("Скопировать задачу");
    expect(html).toContain('data-action="copy-action-prompt"');
    expect(html).toContain(
      "SearchLint%20site-essential%20task%3A%20sitemap.xml"
    );
    expect(html).toContain("Добавьте карту страниц");
    expect(html).toContain("AI/LLM discovery");
    expect(html).toContain("Ожидаем локальные замеры браузера");
    expect(html).toContain("Локальные диагностики по группам сигналов");
    expect(html).toContain("Индексация");
    expect(html).toContain("Метаданные");
    expect(html).toContain("Ошибки");
    expect(html).toContain("Ошибок не найдено.");
    expect(html).toContain("Ссылки");
    expect(html).toContain("Ожидаем");
    expect(html).toContain("Бэклинки");
    expect(html).toContain("Домены");
    expect(html).toContain("Качество");
    expect(html).toContain("Что проверить по ссылкам");
    expect(html).toContain("Подключите backlink provider");
    expect(html).toContain("Внутренние страницы");
    expect(html).toContain("Внешние ссылки");
    expect(html).toContain("Технический обзор");
    expect(html).toContain("Оценка страницы");
    expect(html).toContain("Что исправить технически");
    expect(html).toContain("Сервер");
    expect(html).toContain("Нужны response headers");
    expect(html).toContain("Размер DOM");
    expect(html).toContain("GEO обзор");
    expect(html).toContain("Оценка региональных сигналов");
    expect(html).toContain("Что улучшить для GEO");
    expect(html).toContain("Добавьте hreflang alternates");
    expect(html).toContain("Market coverage");
    expect(html).toContain("Не подключено");
    expect(html).not.toContain("Переключить язык на английский");
    expect(html).not.toContain('data-action="language-toggle"');
  });

  it("does not render missing GEO audit data as a failing zero score", () => {
    const html = renderOverlayHtml({
      status: "clean",
      diagnostics: [],
      language: "ru"
    });

    expect(html).toContain("GEO");
    expect(html).toContain("N/A");
    expect(html).toContain("Ожидаем rendered language");
    expect(html).not.toContain("<strong>0</strong>");
  });

  it("renders action feedback as a polite status message", () => {
    const html = renderOverlayHtml({
      status: "errors",
      diagnostics: [diagnostic("SL-META-005", "error")],
      actionMessage: "Copied SL-META-005 diagnostic."
    });

    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain("Copied SL-META-005 diagnostic.");
    expect(html).toContain("sl-action-status");
  });

  it("localizes Russian action feedback and issue metadata", () => {
    const html = renderOverlayHtml({
      status: "errors",
      diagnostics: [diagnostic("SL-META-005", "error")],
      language: "ru",
      actionMessage:
        "Copied SL-META-005 fix prompt. Paste it into your agent, fix it, then refresh."
    });

    expect(html).toContain("SL-META-005");
    expect(html).toContain("Высокое влияние");
    expect(html).toContain("Title и metadata");
    expect(html).toContain("Prompt для SL-META-005 скопирован");
    expect(html).not.toContain("High impact");
    expect(html).toContain(
      "<small>SL-META-005 · Высокое влияние · Title и metadata · Raw HTML · certain</small>"
    );
    expect(html).toContain("<summary>Доказательства</summary>");
    expect(html).toContain("<dt>Доверие</dt><dd>certain</dd>");
  });

  it("clears transient action feedback when runtime analysis state changes", () => {
    const currentState = {
      status: "errors" as const,
      diagnostics: [diagnostic("SL-META-005", "error")],
      actionMessage: "Copied SL-META-005 diagnostic."
    };

    expect(
      mergeOverlayRuntimeState(currentState, {
        diagnostics: [diagnostic("SL-IMG-007", "warning")]
      }).actionMessage
    ).toBeUndefined();
    expect(
      mergeOverlayRuntimeState(currentState, {
        filters: { severity: "warning" }
      }).actionMessage
    ).toBeUndefined();
    expect(
      mergeOverlayRuntimeState(currentState, {
        runtimeError: "SearchLint analysis failed."
      }).actionMessage
    ).toBeUndefined();
  });

  it("keeps transient action feedback for badge position-only runtime updates", () => {
    const state = mergeOverlayRuntimeState(
      {
        status: "errors",
        diagnostics: [diagnostic("SL-META-005", "error")],
        actionMessage: "Copied SL-META-005 diagnostic."
      },
      { position: "left" }
    );

    expect(state.position).toBe("left");
    expect(state.actionMessage).toBe("Copied SL-META-005 diagnostic.");
  });

  it("formats suppress action success and failure feedback", () => {
    expect(formatSuppressActionMessage("SL-META-005", true)).toBe(
      "Suppress action requested for SL-META-005."
    );
    expect(formatSuppressActionMessage("SL-META-005", false)).toBe(
      "Suppress action failed for SL-META-005."
    );
  });

  it("formats diagnostics for clipboard copying", () => {
    const text = formatDiagnosticForClipboard({
      ...diagnostic("SL-IMG-007", "warning", "rendered-dom", {
        confidence: "EXACT",
        file: "app/page.tsx",
        line: 14,
        selector: 'img[src="/hero.png"]'
      }),
      explanation:
        "Rendered image evidence shows a content image without descriptive alt text."
    });

    expect(text).toContain("SearchLint diagnostic: SL-IMG-007");
    expect(text).toContain("Severity: Warning");
    expect(text).toContain(
      "Explanation: Rendered image evidence shows a content image without descriptive alt text."
    );
    expect(text).toContain("Evidence: SL-IMG-007 evidence");
    expect(text).toContain("Confidence: certain");
    expect(text).toContain("Source: Rendered DOM");
    expect(text).toContain("File: app/page.tsx:14");
    expect(text).toContain('Selector: img[src="/hero.png"]');
  });

  it("formats agent-ready fix prompts without design-changing instructions", () => {
    const issue = {
      ...diagnostic("SL-IMG-007", "warning", "rendered-dom", {
        confidence: "EXACT",
        selector: 'img[src="/hero.png"]'
      }),
      expected: "descriptive alt text",
      actual: "empty alt"
    };
    const single = formatDiagnosticFixPrompt(issue);
    const all = formatAllFixesPrompt([issue]);

    expect(single).toContain("Fix this SearchLint SEO issue: SL-IMG-007");
    expect(single).toContain("Impact: Fix soon");
    expect(single).toContain("Keep the visual design unchanged.");
    expect(single).toContain("Do not refactor unrelated code.");
    expect(single).toContain('Selector: img[src="/hero.png"]');
    expect(all).toContain(
      "Fix these SearchLint SEO issues on the current page."
    );
    expect(all).toContain("SL-IMG-007");
    expect(all).toContain("Keep the visual design unchanged.");
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
      position: "left",
      direction: "rtl",
      runtimeError: "SearchLint runtime failed while analyzing the page."
    });

    expect(html).toContain("sl-position--left");
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
    expect(html).toContain(">Open</span>");
    expect(html).not.toContain(">1000 issues</span>");
    expect(html.match(/<article class="sl-card/g)?.length).toBe(200);
    expect(html).toContain("Showing first 200 of 1000 matching diagnostics");
    expect(html).toContain("Use filters to narrow the list.");
    expect(html).toContain("overflow-wrap: anywhere");
  });

  it("allows diagnostic render limits to be lowered for constrained surfaces", () => {
    const diagnostics = Array.from({ length: 5 }, (_, index) => ({
      ...diagnostic("SL-META-005", "error"),
      fingerprint: `limited-${index}`
    }));
    const html = renderOverlayHtml({
      status: "errors",
      diagnostics,
      maxRenderedDiagnostics: 2
    });

    expect(html.match(/<article class="sl-card/g)?.length).toBe(2);
    expect(html).toContain("Showing first 2 of 5 matching diagnostics");
  });

  it("explains when matching diagnostics are hidden by a zero render limit", () => {
    const html = renderOverlayHtml({
      status: "errors",
      diagnostics: [diagnostic("SL-META-005", "error")],
      maxRenderedDiagnostics: 0
    });

    expect(html.match(/<article class="sl-card/g)?.length ?? 0).toBe(0);
    expect(html).toContain("Showing 0 of 1 matching diagnostics");
    expect(html).toContain("Diagnostics are hidden by the render limit.");
    expect(html).toContain("configured to render no diagnostic cards");
    expect(html).not.toContain("No matching diagnostics.");
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
  it("highlights matching elements and ignores invalid selectors", () => {
    const highlighted: string[] = [];
    const element = {
      style: {
        outline: "",
        outlineOffset: ""
      },
      setAttribute(name: string, value: string) {
        highlighted.push(`${name}=${value}`);
      },
      removeAttribute() {}
    };
    const document = {
      querySelectorAll(selector: string) {
        if (selector === "[broken") {
          throw new Error("Invalid selector");
        }
        if (selector === "[data-searchlint-highlighted]") {
          return [];
        }
        return [element];
      }
    } as unknown as Document;

    expect(highlightSelector(document, ".hero img")).toBe(1);
    expect(highlighted).toEqual(["data-searchlint-highlighted=true"]);
    expect(element.style.outline).toBe("2px solid #ef4444");
    expect(element.style.outlineOffset).toBe("2px");
    expect(highlightSelector(document, "[broken")).toBe(0);
  });

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
    expect(html).toContain('<button class="sl-help" type="button"');
    expect(html).toContain('data-tooltip="');
    expect(html).not.toContain('<span class="sl-help"');
    expect(html).toContain(
      '<section id="searchlint-panel" class="sl-panel" role="dialog" aria-modal="false" aria-labelledby="searchlint-panel-title" aria-describedby="searchlint-panel-description" hidden tabindex="-1">'
    );
    expect(html).toContain(":focus-visible");
    expect(html).toContain(".sl-help:hover::after");
    expect(html).toContain(".sl-help:focus-visible::after");
    expect(html).not.toContain("<script");
  });

  it("keeps help tooltips and action labels from being clipped or forced onto one line", () => {
    const html = renderOverlayHtml({
      status: "warnings",
      diagnostics: [diagnostic("SL-IMG-007", "warning", "rendered-dom")]
    });

    expect(html).toContain(".sl-help { position: relative;");
    expect(html).toContain(".sl-help::after");
    expect(html).toContain("content: attr(data-tooltip);");
    expect(html).toContain(".sl-action-list__card { overflow: visible; }");
    expect(html).toContain(".sl-essentials-card { overflow: visible; }");
    expect(html).toContain(
      ".sl-link-table { border: 1px solid #e4ddcd; border-radius: 8px; background: #fafaf9; overflow: visible; }"
    );
    expect(html).toContain(".sl-technical-table { overflow: visible; }");
    expect(html).toContain(
      ".sl-health-table, .sl-issues-table { border: 1px solid #e4ddcd; border-radius: 8px; background: #fafaf9; overflow: visible; }"
    );
    expect(html).toContain(
      ".sl-copy-all-button { align-self: start; width: fit-content; max-width: 100%;"
    );
    expect(html).toContain(
      ".sl-issue-actions button { width: fit-content; max-width: 100%;"
    );
    expect(html).toContain("white-space: normal; overflow-wrap: anywhere;");
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

  it("keeps the accessibility report passing when rerun is intentionally hidden", () => {
    const report = createOverlayAccessibilityReport({
      status: "blocked",
      diagnostics: [diagnostic("SL-INDEX-001", "blocker")],
      rerunEnabled: false
    });

    expect(report.passed).toBe(true);
    expect(
      report.checks.find((check) => check.id === "action-controls-named")
    ).toMatchObject({
      pass: true,
      message: "Available primary overlay actions have accessible names."
    });
  });

  it("keeps the accessibility report passing for clean pages without diagnostic actions", () => {
    const report = createOverlayAccessibilityReport({
      status: "clean",
      diagnostics: []
    });

    expect(report.passed).toBe(true);
    expect(
      report.checks.find((check) => check.id === "action-controls-named")
    ).toMatchObject({
      pass: true,
      message: "Available primary overlay actions have accessible names."
    });
  });

  it("keeps the accessibility report passing when diagnostic card rendering is capped to zero", () => {
    const report = createOverlayAccessibilityReport({
      status: "errors",
      diagnostics: [diagnostic("SL-META-005", "error")],
      maxRenderedDiagnostics: 0
    });

    expect(report.passed).toBe(true);
    expect(
      report.checks.find((check) => check.id === "action-controls-named")
    ).toMatchObject({
      pass: true,
      message: "Available primary overlay actions have accessible names."
    });
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

function renderedRuleIds(html: string): string[] {
  return [...html.matchAll(/data-searchlint-rule-id="([^"]+)"/g)].map(
    (match) => match[1] ?? ""
  );
}
