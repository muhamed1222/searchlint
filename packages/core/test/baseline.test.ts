import { describe, expect, it } from "vitest";

import { compareDiagnosticsToBaseline } from "../src/index.js";
import type { BaselineEntry, Diagnostic } from "../src/index.js";

describe("compareDiagnosticsToBaseline", () => {
  it("separates new, unchanged, and resolved diagnostics by fingerprint", () => {
    const current = [
      diagnostic({ ruleId: "SL-HTTP-001", fingerprint: "new" }),
      diagnostic({ ruleId: "SL-META-001", fingerprint: "known" })
    ];
    const baseline: BaselineEntry[] = [
      { fingerprint: "known", ruleId: "SL-META-001" },
      { fingerprint: "resolved", ruleId: "SL-CANON-001" }
    ];

    const result = compareDiagnosticsToBaseline(current, baseline);

    expect(result.newDiagnostics.map((item) => item.fingerprint)).toEqual([
      "new"
    ]);
    expect(result.unchangedDiagnostics.map((item) => item.fingerprint)).toEqual(
      ["known"]
    );
    expect(
      result.resolvedBaselineEntries.map((item) => item.fingerprint)
    ).toEqual(["resolved"]);
  });

  it("preserves diagnostic object identity", () => {
    const known = diagnostic({ fingerprint: "known" });
    const result = compareDiagnosticsToBaseline(known ? [known] : [], [
      { fingerprint: "known" }
    ]);

    expect(result.unchangedDiagnostics[0]).toBe(known);
  });

  it("deduplicates duplicate baseline entries for resolved output", () => {
    const result = compareDiagnosticsToBaseline(
      [],
      [
        { fingerprint: "same", reason: "first" },
        { fingerprint: "same", reason: "second" }
      ]
    );

    expect(result.resolvedBaselineEntries).toEqual([
      { fingerprint: "same", reason: "first" }
    ]);
  });

  it("keeps output ordering deterministic", () => {
    const result = compareDiagnosticsToBaseline(
      [
        diagnostic({ fingerprint: "b" }),
        diagnostic({ fingerprint: "a" }),
        diagnostic({ fingerprint: "c" })
      ],
      [{ fingerprint: "a" }]
    );

    expect(result.newDiagnostics.map((item) => item.fingerprint)).toEqual([
      "b",
      "c"
    ]);
    expect(result.unchangedDiagnostics.map((item) => item.fingerprint)).toEqual(
      ["a"]
    );
  });
});

function diagnostic(overrides: Partial<Diagnostic> = {}): Diagnostic {
  return {
    id: "diag-1",
    ruleId: "SL-TEST-001",
    severity: "warning",
    confidence: "certain",
    pageUrl: "https://example.com/",
    source: "raw-html",
    title: "Diagnostic",
    evidence: "Evidence",
    observedAt: "2026-06-20T00:00:00.000Z",
    fingerprint: "fingerprint",
    ...overrides
  };
}
