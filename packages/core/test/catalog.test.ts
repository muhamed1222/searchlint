import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import {
  createCatalogBackedRule,
  createCoreCanonicalHreflangRules,
  createCoreHttpAndIndexabilityRules,
  createCoreRobotsSitemapPerformanceRules,
  createCoreStructuralMediaSchemaLinkRules,
  createCoreTitleMetadataRules,
  createRuleCatalogRegistry,
  parseRuleCatalogYaml,
  runRuleEngine
} from "../src/index.js";

const realCatalogPath = "../../specs/RULE_CATALOG.yaml";

const validCatalog = `version: 1
status: defined
source: SEARCHLINT_1_0_DEVELOPMENT_PLAN.md
targetRuleCount: 2
ruleIdPattern: "SL-{CATEGORY}-{NNN}"
requiredRuleFields:
  - id
  - name
  - category
  - defaultSeverity
  - confidence
  - scope
  - sources
  - providerScope
  - description
  - checkingAlgorithm
  - requiredEvidence
  - fix
  - testExamples
  - documentation
  - version
qualityConstraints:
  - blocker cannot be based on subjective heuristic
categories:
  - id: indexability
    title: Indexability
    targetCount: 1
  - id: title-metadata
    title: Title and metadata
    targetCount: 1
rules:
  - id: SL-INDEX-001
    name: unexpected-noindex
    category: indexability
    defaultSeverity: blocker
    confidence: certain
    scope: page
    sources: [raw-html, rendered-dom, http-header]
    providerScope: core
    description: "An indexable route contains a noindex directive."
    checkingAlgorithm:
      "Compare route indexability contract with discovered noindex directives."
    requiredEvidence: [route-contract, discovered-directive]
    fix: "Remove the noindex directive or mark the route non-indexable."
    testExamples: [fixtures/indexability/unexpected-noindex]
    documentation: docs/rules/SL-INDEX-001.md
    version: 1.0.0
  - id: SL-TITLE-001
    name: missing-title
    category: title-metadata
    defaultSeverity: error
    confidence: certain
    scope: page
    sources: [raw-html, rendered-dom]
    providerScope: core
    description: "A route requiring a title has no title."
    checkingAlgorithm: "Check the route contract against observed title text."
    requiredEvidence: [route-contract, title-text]
    fix: "Add a title for the route."
    testExamples: [fixtures/title/missing-title]
    documentation: docs/rules/SL-TITLE-001.md
    version: 1.0.0
`;

describe("parseRuleCatalogYaml", () => {
  it("parses catalog metadata and multiline scalar fields", () => {
    const catalog = parseRuleCatalogYaml(validCatalog);

    expect(catalog.rules).toHaveLength(2);
    expect(catalog.categories.map((category) => category.id)).toEqual([
      "indexability",
      "title-metadata"
    ]);
    expect(catalog.rules[0]?.checkingAlgorithm).toBe(
      "Compare route indexability contract with discovered noindex directives."
    );
  });

  it("rejects duplicate rule IDs", () => {
    const duplicate = validCatalog.replace("SL-TITLE-001", "SL-INDEX-001");

    expect(() => parseRuleCatalogYaml(duplicate)).toThrow(
      "SL-INDEX-001 id invalid: duplicate rule id"
    );
  });

  it("rejects missing required fields", () => {
    const missing = validCatalog.replace(
      "    requiredEvidence: [route-contract, title-text]\n",
      ""
    );

    expect(() => parseRuleCatalogYaml(missing)).toThrow(
      "SL-TITLE-001 requiredEvidence invalid: missing required field"
    );
  });

  it("rejects invalid field types with rule ID, field, and reason", () => {
    const invalid = validCatalog.replace(
      "    requiredEvidence: [route-contract, title-text]\n",
      "    requiredEvidence: route-contract\n"
    );

    expect(() => parseRuleCatalogYaml(invalid)).toThrow(
      "SL-TITLE-001 requiredEvidence invalid: expected string array"
    );
  });

  it("rejects heuristic blockers, forbidden keywords, and title-length hard errors", () => {
    const heuristicBlocker = validCatalog.replace(
      "    confidence: certain\n    scope: page\n    sources: [raw-html, rendered-dom, http-header]",
      "    confidence: heuristic\n    scope: page\n    sources: [raw-html, rendered-dom, http-header]"
    );

    expect(() => parseRuleCatalogYaml(heuristicBlocker)).toThrow(
      "SL-INDEX-001 confidence invalid: blocker cannot be heuristic"
    );

    const metaKeywords = validCatalog.replace(
      "name: missing-title",
      "name: meta-keywords-present"
    );

    expect(() => parseRuleCatalogYaml(metaKeywords)).toThrow(
      "SL-TITLE-001 name invalid: meta keywords checks are forbidden"
    );

    const titleLengthHardError = validCatalog.replace(
      "name: missing-title",
      "name: title-length-too-long"
    );

    expect(() => parseRuleCatalogYaml(titleLengthHardError)).toThrow(
      "SL-TITLE-001 defaultSeverity invalid: title length cannot be blocker or error"
    );
  });

  it("rejects category and provider mismatches", () => {
    const unknownCategory = validCatalog.replace(
      "category: title-metadata",
      "category: unknown-category"
    );

    expect(() => parseRuleCatalogYaml(unknownCategory)).toThrow(
      "SL-TITLE-001 category invalid: unknown category unknown-category"
    );

    const providerMismatch = validCatalog.replace(
      "sources: [raw-html, rendered-dom]\n    providerScope: core",
      "sources: [google, yandex]\n    providerScope: core"
    );

    expect(() => parseRuleCatalogYaml(providerMismatch)).toThrow(
      "SL-TITLE-001 providerScope invalid: Google and Yandex sources require external scope"
    );
  });

  it("loads the real catalog through the production parser", () => {
    const catalog = parseRuleCatalogYaml(readFileSync(realCatalogPath, "utf8"));

    expect(catalog.rules).toHaveLength(120);
    expect(new Set(catalog.rules.map((rule) => rule.id)).size).toBe(120);
    expect(
      catalog.rules.find((rule) => rule.id === "SL-HTTP-009")?.requiredEvidence
    ).toEqual([
      "route-contract",
      "raw-metadata-state",
      "rendered-metadata-state"
    ]);
  });

  it("binds every real catalog rule ID to exactly one shared core implementation", () => {
    const registry = createRuleCatalogRegistry(
      parseRuleCatalogYaml(readFileSync(realCatalogPath, "utf8"))
    );

    const rules = [
      ...createCoreHttpAndIndexabilityRules(registry),
      ...createCoreTitleMetadataRules(registry),
      ...createCoreCanonicalHreflangRules(registry),
      ...createCoreStructuralMediaSchemaLinkRules(registry),
      ...createCoreRobotsSitemapPerformanceRules(registry)
    ];
    const implementationIds = rules.map((rule) => rule.id);

    expect(implementationIds).toHaveLength(120);
    expect(new Set(implementationIds).size).toBe(120);
    expect(implementationIds.sort()).toEqual(
      registry
        .listRules()
        .map((rule) => rule.id)
        .sort()
    );
  });

  it("runs real catalog rules through registry, core, and diagnostics", async () => {
    const registry = createRuleCatalogRegistry(
      parseRuleCatalogYaml(readFileSync(realCatalogPath, "utf8"))
    );
    const rules = [
      ...createCoreHttpAndIndexabilityRules(registry),
      ...createCoreTitleMetadataRules(registry),
      ...createCoreCanonicalHreflangRules(registry),
      ...createCoreStructuralMediaSchemaLinkRules(registry),
      ...createCoreRobotsSitemapPerformanceRules(registry)
    ];

    const result = await runRuleEngine({
      rules,
      snapshot: {
        pageUrl: "https://example.com/",
        route: "/",
        capturedAt: "2026-06-21T00:00:00.000Z",
        http: {
          statusCode: 200,
          finalUrl: "https://example.com/",
          headers: { "content-type": "text/html" },
          redirectChain: []
        },
        rawHtml:
          '<html lang="en"><head><title>Home</title><meta name="robots" content="noindex"></head><body><h1>Home</h1></body></html>',
        renderedDom:
          '<html lang="en"><head><title>Home</title><meta name="robots" content="noindex"></head><body><h1>Home</h1></body></html>'
      },
      routeContracts: [{ route: "/", indexable: true }],
      options: { now: "2026-06-21T00:00:00.000Z" }
    });

    expect(result.executedRuleIds).toHaveLength(120);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        ruleId: "SL-INDEX-001",
        severity: "blocker",
        confidence: "certain",
        evidence: expect.stringContaining("noindex")
      })
    );
  });
});

describe("createRuleCatalogRegistry", () => {
  it("provides deterministic lookup and category ordering", () => {
    const registry = createRuleCatalogRegistry(
      parseRuleCatalogYaml(validCatalog)
    );

    expect(registry.listRules().map((rule) => rule.id)).toEqual([
      "SL-INDEX-001",
      "SL-TITLE-001"
    ]);
    expect(registry.requireRule("SL-INDEX-001").defaultSeverity).toBe(
      "blocker"
    );
    expect(
      registry.listByCategory("title-metadata").map((rule) => rule.id)
    ).toEqual(["SL-TITLE-001"]);
    expect(() => registry.requireRule("SL-MISSING-001")).toThrow(
      "unknown rule SL-MISSING-001"
    );
  });

  it("creates executable rules from catalog metadata without duplicating defaults", async () => {
    const registry = createRuleCatalogRegistry(
      parseRuleCatalogYaml(validCatalog)
    );
    const entry = registry.requireRule("SL-INDEX-001");
    const rule = createCatalogBackedRule(entry, () => [
      {
        pageUrl: "https://example.com/",
        source: "raw-html",
        title: "Unexpected noindex",
        evidence: "noindex found"
      }
    ]);

    expect(rule.id).toBe(entry.id);
    expect(rule.defaultSeverity).toBe(entry.defaultSeverity);
    expect(rule.defaultConfidence).toBe(entry.confidence);
    expect(rule.sources).toEqual(entry.sources);
    await expect(
      Promise.resolve(
        rule.run({
          snapshot: {
            pageUrl: "https://example.com/",
            capturedAt: "2026-06-20T00:00:00.000Z"
          },
          now: "2026-06-20T00:00:00.000Z"
        })
      )
    ).resolves.toHaveLength(1);
  });
});
