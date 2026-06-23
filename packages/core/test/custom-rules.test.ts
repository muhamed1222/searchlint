import { describe, expect, it } from "vitest";

import {
  createLocalCustomRule,
  createLocalCustomRules,
  runRuleEngine
} from "../src/index.js";
import type { CustomRuleDefinition, PageSnapshot } from "../src/index.js";

const observedAt = "2026-06-22T00:00:00.000Z";

const snapshot: PageSnapshot = {
  pageUrl: "https://example.com/products/widget",
  route: "/products/widget",
  capturedAt: observedAt,
  rawHtml: "<html><head><title>Widget</title></head></html>",
  renderedDom: "<main><h1>Widget</h1></main>",
  http: {
    finalUrl: "https://example.com/products/widget",
    redirectChain: [],
    headers: {
      "x-searchlint-custom": "enabled"
    }
  },
  sourceCode: {
    files: [
      { path: "app/products/[slug]/page.tsx", content: "export default" }
    ],
    findings: [
      {
        kind: "generate-metadata",
        file: "app/products/[slug]/page.tsx",
        location: { confidence: "EXACT", file: "app/products/[slug]/page.tsx" },
        router: "app",
        route: "/products/[slug]",
        exportName: "generateMetadata"
      }
    ]
  }
};

const definition: CustomRuleDefinition = {
  id: "CUSTOM-LOCAL-001",
  defaultSeverity: "warning",
  defaultConfidence: "certain",
  source: "raw-html",
  title: "Custom rule matched",
  evidence: "Raw HTML contained the configured marker.",
  expected: "Marker should be absent.",
  actual: "Marker was present.",
  conditions: [{ kind: "raw-html-includes", value: "<title>Widget</title>" }]
};

describe("local custom rule sandbox", () => {
  it("creates local-only declarative custom rules that emit normal diagnostics", async () => {
    const result = await runRuleEngine({
      snapshot,
      options: { now: observedAt },
      rules: [createLocalCustomRule(definition)]
    });

    expect(result.executedRuleIds).toEqual(["CUSTOM-LOCAL-001"]);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]).toMatchObject({
      ruleId: "CUSTOM-LOCAL-001",
      severity: "warning",
      confidence: "certain",
      pageUrl: snapshot.pageUrl,
      route: snapshot.route,
      source: "raw-html",
      title: definition.title,
      evidence: definition.evidence,
      expected: definition.expected,
      actual: definition.actual
    });
  });

  it("supports bounded snapshot-only conditions without workspace access hooks", async () => {
    const rules = createLocalCustomRules([
      {
        ...definition,
        id: "CUSTOM-LOCAL-HEADER",
        source: "http-header",
        conditions: [
          {
            kind: "http-header-equals",
            name: "x-searchlint-custom",
            value: "enabled"
          },
          { kind: "route-matches", value: "/products/widget" },
          { kind: "source-finding-kind-exists", value: "generate-metadata" }
        ]
      }
    ]);

    const result = await runRuleEngine({
      snapshot,
      options: { now: observedAt },
      rules
    });

    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]?.source).toBe("http-header");
    expect(Object.keys(rules[0] ?? {})).toEqual([
      "id",
      "defaultSeverity",
      "defaultConfidence",
      "sources",
      "run"
    ]);
  });

  it("rejects cloud custom rule execution", () => {
    expect(() =>
      createLocalCustomRule(definition, { environment: "cloud" })
    ).toThrow("custom rule execution is local-only");
  });

  it("rejects oversized custom rule definitions", () => {
    expect(() =>
      createLocalCustomRule(
        {
          ...definition,
          conditions: [{ kind: "raw-html-includes", value: "x".repeat(6) }]
        },
        { environment: "local", maxNeedleLength: 5 }
      )
    ).toThrow("exceeds needle limit");
  });

  it("enforces custom rule count limits", () => {
    expect(() =>
      createLocalCustomRules(
        [definition, { ...definition, id: "CUSTOM-TWO" }],
        {
          environment: "local",
          maxRules: 1
        }
      )
    ).toThrow("custom rule count 2 exceeds limit 1");
  });

  it("enforces custom rule evaluation step limits before execution", () => {
    expect(() =>
      createLocalCustomRule(
        {
          ...definition,
          conditions: [
            { kind: "route-matches", value: "/products/widget" },
            { kind: "raw-html-includes", value: "Widget" }
          ]
        },
        { environment: "local", maxEvaluationStepsPerRule: 1 }
      )
    ).toThrow("condition count 2 exceeds evaluation step limit 1");
  });

  it("enforces text input byte limits", async () => {
    await expect(
      runRuleEngine({
        snapshot: { ...snapshot, rawHtml: "abcdef" },
        options: { now: observedAt },
        rules: [
          createLocalCustomRule(definition, {
            environment: "local",
            maxTextBytesPerRule: 5
          })
        ]
      })
    ).rejects.toThrow("custom rule text input exceeds limit 5 byte");
  });

  it("preserves standard diagnostic validation for custom rule output", async () => {
    await expect(
      runRuleEngine({
        snapshot,
        options: { now: observedAt },
        rules: [
          createLocalCustomRule({
            ...definition,
            defaultSeverity: "blocker",
            defaultConfidence: "heuristic"
          })
        ]
      })
    ).rejects.toThrow("cannot emit a heuristic blocker");
  });
});
