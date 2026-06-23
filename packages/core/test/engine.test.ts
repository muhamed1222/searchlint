import { describe, expect, it } from "vitest";

import {
  createDiagnostic,
  createDiagnosticFingerprint,
  runRuleEngine
} from "../src/index.js";
import type { PageSnapshot, Rule, RuleContext } from "../src/index.js";

const observedAt = "2026-06-20T00:00:00.000Z";

const snapshot: PageSnapshot = {
  pageUrl: "https://example.com/",
  route: "/",
  capturedAt: observedAt,
  rawHtml: "<html></html>",
  renderedDom: "<html></html>"
};

function rule(id: string, options: Partial<Rule> = {}): Rule {
  return {
    id,
    defaultSeverity: "warning",
    defaultConfidence: "certain",
    sources: ["raw-html"],
    run: () => {
      const report = {
        pageUrl: snapshot.pageUrl,
        source: "raw-html",
        title: id,
        evidence: `${id} evidence`
      } as const;

      return snapshot.route ? [{ ...report, route: snapshot.route }] : [report];
    },
    ...options
  };
}

function routeContractRule(id: string): Rule {
  return {
    id,
    defaultSeverity: "warning",
    defaultConfidence: "certain",
    sources: ["raw-html"],
    run: (context: RuleContext) => {
      const report = {
        pageUrl: context.snapshot.pageUrl,
        source: "raw-html",
        title: id,
        evidence: context.routeContract
          ? `matched ${context.routeContract.route}`
          : "no route contract"
      } as const;

      return context.routeContract
        ? [{ ...report, route: context.routeContract.route }]
        : [report];
    }
  };
}

describe("runRuleEngine", () => {
  it("orders rules deterministically by dependency, priority, and rule ID", async () => {
    const result = await runRuleEngine({
      snapshot,
      options: { now: observedAt },
      rules: [
        rule("SL-TEST-003", { dependencies: ["SL-TEST-001"], priority: 100 }),
        rule("SL-TEST-002", { priority: 10 }),
        rule("SL-TEST-001", { priority: 1 })
      ]
    });

    expect(result.executedRuleIds).toEqual([
      "SL-TEST-002",
      "SL-TEST-001",
      "SL-TEST-003"
    ]);
  });

  it("executes asynchronous rules and applies severity overrides", async () => {
    const result = await runRuleEngine({
      snapshot,
      options: {
        now: observedAt,
        severityOverrides: {
          "SL-TEST-001": "error"
        }
      },
      rules: [
        rule("SL-TEST-001", {
          async run() {
            return [
              {
                pageUrl: snapshot.pageUrl,
                source: "rendered-dom",
                title: "async report",
                evidence: "rendered evidence"
              }
            ];
          }
        })
      ]
    });

    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]?.severity).toBe("error");
    expect(result.diagnostics[0]?.confidence).toBe("certain");
  });

  it("requires suppression reasons and filters matching diagnostics", async () => {
    await expect(
      runRuleEngine({
        snapshot,
        options: {
          now: observedAt,
          suppressions: [{ ruleId: "SL-TEST-001", reason: "" }]
        },
        rules: [rule("SL-TEST-001")]
      })
    ).rejects.toThrow("suppression reason is required");

    const result = await runRuleEngine({
      snapshot,
      options: {
        now: observedAt,
        suppressions: [{ ruleId: "SL-TEST-001", reason: "Known baseline" }]
      },
      rules: [rule("SL-TEST-001")]
    });

    expect(result.diagnostics).toEqual([]);
  });

  it("selects the most specific matching route contract from a contract list", async () => {
    const result = await runRuleEngine({
      snapshot: {
        ...snapshot,
        route: "/products/sale/[slug]",
        pageUrl: "https://example.com/products/sale/widget"
      },
      options: { now: observedAt },
      routeContracts: [
        { route: "/products/**", indexable: true },
        {
          route: "/products/sale/**",
          indexable: true,
          requiredSeverityOverrides: { "SL-TEST-001": "error" }
        }
      ],
      rules: [routeContractRule("SL-TEST-001")]
    });

    expect(result.diagnostics[0]).toMatchObject({
      route: "/products/sale/**",
      severity: "error",
      evidence: "matched /products/sale/**"
    });
  });

  it("keeps explicit route contract precedence over route contract lists", async () => {
    const result = await runRuleEngine({
      snapshot: {
        ...snapshot,
        route: "/products/sale/[slug]",
        pageUrl: "https://example.com/products/sale/widget"
      },
      options: { now: observedAt },
      routeContract: {
        route: "/explicit/**",
        indexable: true,
        requiredSeverityOverrides: { "SL-TEST-001": "blocker" }
      },
      routeContracts: [
        {
          route: "/products/sale/**",
          indexable: true,
          requiredSeverityOverrides: { "SL-TEST-001": "error" }
        }
      ],
      rules: [routeContractRule("SL-TEST-001")]
    });

    expect(result.diagnostics[0]).toMatchObject({
      route: "/explicit/**",
      severity: "blocker",
      evidence: "matched /explicit/**"
    });
  });

  it("runs without route contract when no contract matches the snapshot route", async () => {
    const result = await runRuleEngine({
      snapshot: {
        ...snapshot,
        route: "/blog/[slug]",
        pageUrl: "https://example.com/blog/post"
      },
      options: { now: observedAt },
      routeContracts: [{ route: "/products/**", indexable: true }],
      rules: [routeContractRule("SL-TEST-001")]
    });

    expect(result.diagnostics[0]).toMatchObject({
      evidence: "no route contract"
    });
    expect(result.diagnostics[0]?.route).toBeUndefined();
  });
});

describe("createDiagnostic", () => {
  it("creates stable fingerprints for equivalent diagnostic inputs", () => {
    const input = {
      ruleId: "SL-TEST-001",
      severity: "warning",
      confidence: "certain",
      pageUrl: snapshot.pageUrl,
      source: "raw-html",
      title: "Stable",
      evidence: "Same evidence",
      observedAt
    } as const;

    expect(createDiagnosticFingerprint(input)).toBe(
      createDiagnosticFingerprint(input)
    );
    expect(createDiagnostic(input).fingerprint).toBe(
      createDiagnostic(input).fingerprint
    );
  });

  it("rejects heuristic blockers", () => {
    expect(() =>
      createDiagnostic({
        ruleId: "SL-TEST-001",
        severity: "blocker",
        confidence: "heuristic",
        pageUrl: snapshot.pageUrl,
        source: "raw-html",
        title: "Bad blocker",
        evidence: "Subjective evidence",
        observedAt
      })
    ).toThrow("cannot emit a heuristic blocker");
  });

  it("does not allow fabricated file or line locations", () => {
    expect(() =>
      createDiagnostic({
        ruleId: "SL-TEST-001",
        severity: "warning",
        confidence: "certain",
        pageUrl: snapshot.pageUrl,
        source: "rendered-dom",
        title: "Runtime issue",
        evidence: "Runtime-only evidence",
        sourceLocation: {
          confidence: "RUNTIME",
          file: "app/page.tsx",
          line: 10
        },
        observedAt
      })
    ).toThrow("without EXACT source confidence");
  });
});
