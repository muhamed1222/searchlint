import { describe, expect, it } from "vitest";

import { createJUnitReport } from "../src/index.js";
import type { Diagnostic } from "@searchlint/core";

describe("createJUnitReport", () => {
  it("creates one testcase per diagnostic and failures for blocker/error", () => {
    const report = createJUnitReport(
      [
        diagnostic({ ruleId: "SL-HTTP-001", severity: "blocker" }),
        diagnostic({ ruleId: "SL-META-009", severity: "info" })
      ],
      { suiteName: "SearchLint CI" }
    );

    expect(report).toContain(
      '<testsuite name="SearchLint CI" tests="2" failures="1" errors="0" skipped="0">'
    );
    expect(report).toContain('type="blocker"');
    expect(report).toContain('classname="raw-html"');
    expect(report).toContain("SL-META-009 https://example.com/");
  });

  it("escapes XML-controlled diagnostic fields", () => {
    const report = createJUnitReport([
      diagnostic({
        ruleId: "SL-XML-001",
        title: 'Title with <tag> & "quote"',
        evidence: "Evidence with <xml> & chars"
      })
    ]);

    expect(report).toContain("Title with &lt;tag&gt; &amp; &quot;quote&quot;");
    expect(report).toContain("Evidence with &lt;xml&gt; &amp; chars");
  });
});

function diagnostic(overrides: Partial<Diagnostic> = {}): Diagnostic {
  return {
    id: "diag-1",
    ruleId: "SL-HTTP-001",
    severity: "error",
    confidence: "certain",
    pageUrl: "https://example.com/",
    source: "raw-html",
    title: "Indexable route failed",
    evidence: "HTTP 500 was observed.",
    expected: "2xx",
    actual: "500",
    observedAt: "2026-06-20T00:00:00.000Z",
    fingerprint: "fingerprint-1",
    ...overrides
  };
}
