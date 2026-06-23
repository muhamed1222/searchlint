import { describe, expect, it } from "vitest";

import {
  createHtmlReport,
  createPdfReport,
  createReportSummary
} from "../src/index.js";
import type { Diagnostic } from "@searchlint/core";

describe("createReportSummary", () => {
  it("counts severities, affected pages, and rule categories deterministically", () => {
    const summary = createReportSummary([
      diagnostic({
        ruleId: "SL-HTTP-001",
        severity: "error",
        pageUrl: "https://example.com/a"
      }),
      diagnostic({
        ruleId: "SL-META-001",
        severity: "blocker",
        pageUrl: "https://example.com/a"
      }),
      diagnostic({
        ruleId: "SL-META-009",
        severity: "info",
        pageUrl: "https://example.com/b"
      })
    ]);

    expect(summary).toMatchObject({
      title: "SearchLint Report",
      generatedAt: "1970-01-01T00:00:00.000Z",
      totalDiagnostics: 3,
      affectedPages: 2,
      blockerAndErrorCount: 2,
      severityCounts: {
        blocker: 1,
        error: 1,
        warning: 0,
        info: 1
      },
      topRuleCategories: [
        { category: "META", count: 2 },
        { category: "HTTP", count: 1 }
      ]
    });
  });
});

describe("createHtmlReport", () => {
  it("renders executive, agency, developer, comparison, and external sections", () => {
    const report = createHtmlReport(
      [
        diagnostic({
          ruleId: "SL-META-001",
          severity: "blocker",
          sourceLocation: {
            confidence: "EXACT",
            file: "app/page.tsx",
            line: 12
          }
        }),
        diagnostic({
          ruleId: "SL-HTTP-001",
          severity: "error",
          sourceLocation: {
            confidence: "RELATED",
            file: "app/layout.tsx",
            line: 7
          }
        })
      ],
      {
        title: "SearchLint Agency Report",
        generatedAt: "2026-06-21T00:00:00.000Z",
        reportVariant: "white-label",
        audience: "agency",
        projectName: "Example",
        environmentName: "Preview",
        subjectUrl: "https://example.com/",
        brandLabel: "Example Agency"
      }
    );

    expect(report).toContain("<!doctype html>");
    expect(report).toContain("Executive Summary");
    expect(report).toContain("Technical Report");
    expect(report).toContain("Client / White-Label Summary");
    expect(report).toContain("Developer Diagnostics");
    expect(report).toContain("Before / After Comparison");
    expect(report).toContain("External Observations");
    expect(report).toContain("Deployment Report");
    expect(report).toContain("PDF Readiness");
    expect(report).toContain("@media print");
    expect(report).toContain("app/page.tsx:12");
    expect(report).not.toContain("app/layout.tsx:7");
    expect(report).toContain("Prepared by Example Agency");
    expect(report).toContain("Report type: white-label");
    expect(report).toContain("Audience: agency");
    expect(report).toContain(
      "No Google or Yandex observations were provided in this report input."
    );
  });

  it("renders before/after and deployment sections when input is provided", () => {
    const report = createHtmlReport([], {
      reportVariant: "deployment",
      comparison: {
        previousLabel: "before",
        currentLabel: "after",
        newDiagnostics: 1,
        resolvedDiagnostics: 3,
        unchangedDiagnostics: 2,
        severityDelta: {
          blocker: -1,
          error: 1,
          warning: 0,
          info: 2
        }
      },
      deployment: {
        deploymentId: "deploy-123",
        commitRef: "abc123",
        deployedAt: "2026-06-22T00:00:00.000Z",
        environmentName: "production",
        status: "candidate"
      }
    });

    expect(report).toContain("before compared with after");
    expect(report).toContain("Resolved diagnostics");
    expect(report).toContain("deploy-123");
    expect(report).toContain("abc123");
    expect(report).toContain("candidate");
  });

  it("renders provided Google and Yandex external observations", () => {
    const report = createHtmlReport([], {
      externalObservations: [
        {
          id: "yandex-1",
          provider: "yandex",
          source: "yandex.metrica",
          subjectUrl: "https://example.com/about",
          observedAt: "2026-06-19T00:00:00.000Z",
          fetchedAt: "2026-06-20T00:01:00.000Z",
          freshness: "stale",
          sampling: {
            sampled: true,
            state: "sampled"
          },
          payload: {
            visits: 42
          }
        },
        {
          id: "google-1",
          provider: "google",
          source: "google.urlInspection",
          subjectUrl: "https://example.com/",
          observedAt: "2026-06-20T00:00:00.000Z",
          fetchedAt: "2026-06-20T00:01:00.000Z",
          freshness: "fresh",
          quota: {
            remaining: 199,
            limit: 200,
            resetAt: "2026-06-21T00:00:00.000Z"
          },
          sampling: {
            sampled: false
          },
          payload: {
            verdict: "PASS"
          }
        }
      ]
    });

    expect(report).toContain("Google / Yandex Report");
    expect(report).toContain('<table aria-label="External observations">');
    expect(report).toContain("google.urlInspection");
    expect(report).toContain(
      "199/200 remaining; resets 2026-06-21T00:00:00.000Z"
    );
    expect(report).toContain("unsampled");
    expect(report).toContain("{&quot;verdict&quot;:&quot;PASS&quot;}");
    expect(report).toContain("yandex.metrica");
    expect(report).toContain("sampled: sampled");
    expect(report).toContain("{&quot;visits&quot;:42}");
    expect(report.indexOf("google.urlInspection")).toBeLessThan(
      report.indexOf("yandex.metrica")
    );
  });

  it("escapes HTML-controlled fields", () => {
    const report = createHtmlReport(
      [
        diagnostic({
          ruleId: "SL-XSS-001",
          title: 'Title with <script> & "quote"',
          evidence: "Evidence with <img> & chars",
          pageUrl: "https://example.com/?q=<script>",
          sourceLocation: {
            confidence: "EXACT",
            file: "app/<page>.tsx",
            line: 1
          }
        })
      ],
      {
        title: "Report <unsafe>",
        brandLabel: "Agency <unsafe>",
        externalObservations: [
          {
            id: "google-xss",
            provider: "google",
            source: "google.urlInspection",
            subjectUrl: "https://example.com/?q=<script>",
            observedAt: "2026-06-20T00:00:00.000Z",
            fetchedAt: "2026-06-20T00:01:00.000Z",
            freshness: "fresh",
            payload: {
              unsafe: "<script>"
            }
          }
        ]
      }
    );

    expect(report).toContain("Report &lt;unsafe&gt;");
    expect(report).toContain(
      "Title with &lt;script&gt; &amp; &quot;quote&quot;"
    );
    expect(report).toContain("Evidence with &lt;img&gt; &amp; chars");
    expect(report).toContain("https://example.com/?q=&lt;script&gt;");
    expect(report).toContain("app/&lt;page&gt;.tsx:1");
    expect(report).toContain("{&quot;unsafe&quot;:&quot;&lt;script&gt;&quot;}");
    expect(report).not.toContain("<script>");
  });

  it("sorts diagnostics by severity, rule ID, page URL, and fingerprint", () => {
    const first = diagnostic({
      ruleId: "SL-META-002",
      severity: "warning",
      fingerprint: "b"
    });
    const second = diagnostic({
      ruleId: "SL-META-001",
      severity: "error",
      fingerprint: "a"
    });
    const left = createHtmlReport([first, second]);
    const right = createHtmlReport([first, second]);

    expect(left).toBe(right);
    expect(left.indexOf("SL-META-001")).toBeLessThan(
      left.indexOf("SL-META-002")
    );
  });
});

describe("createPdfReport", () => {
  it("creates a deterministic binary PDF report with diagnostic evidence", () => {
    const diagnostics = [
      diagnostic({
        ruleId: "SL-META-001",
        severity: "blocker",
        sourceLocation: {
          confidence: "EXACT",
          file: "app/page.tsx",
          line: 12
        }
      }),
      diagnostic({
        ruleId: "SL-HTTP-001",
        severity: "error",
        pageUrl: "https://example.com/about",
        fingerprint: "fingerprint-2"
      })
    ];
    const left = createPdfReport(diagnostics, {
      title: "SearchLint PDF Report",
      generatedAt: "2026-06-23T00:00:00.000Z",
      reportVariant: "technical",
      projectName: "Example"
    });
    const right = createPdfReport(diagnostics, {
      title: "SearchLint PDF Report",
      generatedAt: "2026-06-23T00:00:00.000Z",
      reportVariant: "technical",
      projectName: "Example"
    });
    const text = asciiText(left);

    expect(left).toEqual(right);
    expect(left).toBeInstanceOf(Uint8Array);
    expect(text).toContain("%PDF-1.4");
    expect(text).toContain("/Type /Catalog");
    expect(text).toContain("/BaseFont /Helvetica");
    expect(text).toContain("xref");
    expect(text).toContain("%%EOF");
    expect(text).toContain("SearchLint PDF Report");
    expect(text).toContain("Diagnostics: 2");
    expect(text).toContain("SL-META-001");
    expect(text).toContain("app/page.tsx:12");
    expect(text).toContain("fingerprint-2");
  });
});

function asciiText(bytes: Uint8Array): string {
  return [...bytes].map((byte) => String.fromCharCode(byte)).join("");
}

function diagnostic(overrides: Partial<Diagnostic> = {}): Diagnostic {
  return {
    id: "diag-1",
    ruleId: "SL-META-001",
    severity: "warning",
    confidence: "certain",
    pageUrl: "https://example.com/",
    source: "raw-html",
    title: "Missing title",
    evidence: "No title element was found.",
    observedAt: "2026-06-20T00:00:00.000Z",
    fingerprint: "fingerprint-1",
    ...overrides
  };
}
