import { describe, expect, it } from "vitest";

import { createSarifReport, stringifySarifReport } from "../src/index.js";
import type { Diagnostic } from "@searchlint/core";

describe("createSarifReport", () => {
  it("creates SARIF 2.1.0 with deterministic rules and results", () => {
    const report = createSarifReport(
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
          ruleId: "SL-META-010",
          severity: "info"
        })
      ],
      {
        informationUri: "https://searchlint.dev"
      }
    );

    expect(report.version).toBe("2.1.0");
    expect(report.runs[0]?.tool.driver.name).toBe("SearchLint");
    expect(report.runs[0]?.tool.driver.informationUri).toBe(
      "https://searchlint.dev"
    );
    expect(report.runs[0]?.tool.driver.rules.map((rule) => rule.id)).toEqual([
      "SL-META-001",
      "SL-META-010"
    ]);
    expect(report.runs[0]?.results[0]).toMatchObject({
      ruleId: "SL-META-001",
      level: "error",
      locations: [
        {
          physicalLocation: {
            artifactLocation: { uri: "app/page.tsx" },
            region: { startLine: 12 }
          }
        }
      ],
      properties: {
        severity: "blocker",
        confidence: "certain",
        source: "raw-html"
      }
    });
    expect(report.runs[0]?.results[1]?.level).toBe("note");
  });

  it("falls back to page URL when source location is not exact", () => {
    const report = createSarifReport([
      diagnostic({
        sourceLocation: {
          confidence: "RELATED",
          file: "app/page.tsx",
          line: 12
        }
      })
    ]);

    expect(
      report.runs[0]?.results[0]?.locations[0]?.physicalLocation
        .artifactLocation.uri
    ).toBe("https://example.com/");
    expect(
      report.runs[0]?.results[0]?.locations[0]?.physicalLocation.region
    ).toBeUndefined();
  });

  it("stringifies with a trailing newline", () => {
    expect(stringifySarifReport(createSarifReport([]))).toMatch(/\n$/);
  });
});

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
