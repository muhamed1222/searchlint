import { describe, expect, it } from "vitest";

import {
  createCoreCanonicalHreflangRules,
  createRuleCatalogRegistry,
  parseRuleCatalogYaml,
  runRuleEngine
} from "../src/index.js";
import type { PageSnapshot, RouteContract } from "../src/index.js";

const ruleIds = [
  ["SL-CANON-001", "missing-canonical", "error", "certain"],
  ["SL-CANON-002", "multiple-canonicals", "blocker", "certain"],
  ["SL-CANON-003", "self-canonical-expected", "error", "certain"],
  ["SL-CANON-004", "canonical-target-non-success", "error", "certain"],
  ["SL-CANON-005", "canonical-target-redirects", "warning", "certain"],
  ["SL-CANON-006", "canonical-scheme-conflict", "error", "certain"],
  ["SL-CANON-007", "canonical-host-conflict", "error", "certain"],
  ["SL-CANON-008", "canonical-loop", "blocker", "certain"],
  ["SL-CANON-009", "hreflang-missing-return-link", "error", "certain"],
  ["SL-CANON-010", "invalid-hreflang-code", "error", "certain"],
  ["SL-CANON-011", "missing-x-default", "warning", "certain"],
  ["SL-CANON-012", "hreflang-target-non-indexable", "error", "certain"],
  ["SL-CANON-013", "hreflang-target-non-success", "error", "certain"],
  ["SL-CANON-014", "raw-rendered-canonical-mismatch", "error", "certain"],
  ["SL-CANON-015", "canonical-to-parameter-url", "warning", "likely"],
  ["SL-CANON-016", "google-selected-canonical-differs", "warning", "certain"]
] as const;

const catalog = `version: 1
status: defined
source: SEARCHLINT_1_0_DEVELOPMENT_PLAN.md
targetRuleCount: ${ruleIds.length}
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
  - id: canonical-hreflang
    title: Canonical and hreflang
    targetCount: ${ruleIds.length}
rules:
${ruleIds
  .map(
    ([id, name, severity, confidence]) => `  - id: ${id}
    name: ${name}
    category: canonical-hreflang
    defaultSeverity: ${severity}
    confidence: ${confidence}
    scope: page
    sources: ${
      id === "SL-CANON-016"
        ? "[google]"
        : id === "SL-CANON-004" ||
            id === "SL-CANON-005" ||
            id === "SL-CANON-013"
          ? "[crawler, http-header]"
          : id === "SL-CANON-012"
            ? "[crawler, raw-html, http-header]"
            : "[raw-html, rendered-dom, http-header]"
    }
    providerScope: ${id === "SL-CANON-016" ? "google" : "core"}
    description: "Test catalog entry for ${name}."
    checkingAlgorithm: "Evaluate canonical and hreflang metadata from snapshot data."
    requiredEvidence: [metadata]
    fix: "Update canonical or hreflang metadata."
    testExamples: [fixtures/canonical/${name}]
    documentation: docs/rules/${id}.md
    version: 1.0.0`
  )
  .join("\n")}
`;

const observedAt = "2026-06-20T00:00:00.000Z";
const registry = createRuleCatalogRegistry(parseRuleCatalogYaml(catalog));
const rules = createCoreCanonicalHreflangRules(registry);

function cleanHead(): string {
  return `<head>
    <link rel="canonical" href="https://example.com/products/1">
    <link rel="alternate" hreflang="en" href="https://example.com/products/1">
    <link rel="alternate" hreflang="x-default" href="https://example.com/products/1">
  </head>`;
}

function snapshot(rawHead = cleanHead(), renderedHead = rawHead): PageSnapshot {
  return {
    pageUrl: "https://example.com/products/1",
    route: "/products/**",
    capturedAt: observedAt,
    http: {
      statusCode: 200,
      finalUrl: "https://example.com/products/1",
      headers: { "content-type": "text/html" },
      redirectChain: []
    },
    rawHtml: `<html>${rawHead}<body></body></html>`,
    renderedDom: `<html>${renderedHead}<body></body></html>`
  };
}

async function run(page: PageSnapshot, routeContract?: RouteContract) {
  return runRuleEngine({
    rules,
    snapshot: page,
    ...(routeContract ? { routeContract } : {}),
    options: { now: observedAt }
  });
}

async function runWithSiteUrl(page: PageSnapshot, siteUrl: string) {
  return runRuleEngine({
    rules,
    snapshot: page,
    siteUrl,
    options: { now: observedAt }
  });
}

describe("createCoreCanonicalHreflangRules", () => {
  it("creates catalog-backed canonical rules in deterministic ID order", () => {
    expect(rules.map((rule) => rule.id)).toEqual(ruleIds.map(([id]) => id));
  });

  it("emits no diagnostics for a clean canonical and hreflang set", async () => {
    const result = await run(snapshot());

    expect(result.diagnostics).toEqual([]);
  });

  it("detects missing and multiple canonicals", async () => {
    const missing = await run(snapshot("<head></head>"));
    expect(
      missing.diagnostics.map((diagnostic) => diagnostic.ruleId)
    ).toContain("SL-CANON-001");

    const multiple = await run(
      snapshot(`<head>
        <link rel="canonical" href="https://example.com/a">
        <link rel="canonical" href="https://example.com/b">
      </head>`)
    );
    expect(
      multiple.diagnostics.map((diagnostic) => diagnostic.ruleId)
    ).toContain("SL-CANON-002");
  });

  it("detects canonical scheme and host conflicts", async () => {
    const scheme = await run(
      snapshot(
        '<head><link rel="canonical" href="http://example.com/products/1"></head>'
      )
    );
    expect(scheme.diagnostics.map((diagnostic) => diagnostic.ruleId)).toContain(
      "SL-CANON-006"
    );

    const host = await run(
      snapshot(
        '<head><link rel="canonical" href="https://other.example/products/1"></head>'
      )
    );
    expect(host.diagnostics.map((diagnostic) => diagnostic.ruleId)).toContain(
      "SL-CANON-007"
    );
  });

  it("does not treat configured production canonicals as local dev host conflicts", async () => {
    const result = await runWithSiteUrl(
      {
        ...snapshot(
          '<head><link rel="canonical" href="https://example.com/products/1"></head>'
        ),
        pageUrl: "http://localhost:3001/products/1",
        http: {
          statusCode: 200,
          finalUrl: "http://localhost:3001/products/1",
          headers: { "content-type": "text/html" },
          redirectChain: []
        }
      },
      "https://example.com"
    );

    expect(
      result.diagnostics.map((diagnostic) => diagnostic.ruleId)
    ).not.toContain("SL-CANON-006");
    expect(
      result.diagnostics.map((diagnostic) => diagnostic.ruleId)
    ).not.toContain("SL-CANON-007");
  });

  it("compares local dev canonical origin conflicts against the configured site origin", async () => {
    const result = await runWithSiteUrl(
      {
        ...snapshot(
          '<head><link rel="canonical" href="https://www.moolt.site/"></head>'
        ),
        pageUrl: "http://127.0.0.1:3000/",
        http: {
          statusCode: 200,
          finalUrl: "http://127.0.0.1:3000/",
          headers: { "content-type": "text/html" },
          redirectChain: []
        }
      },
      "https://moolt.site"
    );
    const diagnostics = result.diagnostics.map((diagnostic) => diagnostic.ruleId);
    const hostDiagnostic = result.diagnostics.find(
      (diagnostic) => diagnostic.ruleId === "SL-CANON-007"
    );

    expect(diagnostics).not.toContain("SL-CANON-006");
    expect(diagnostics).toContain("SL-CANON-007");
    expect(hostDiagnostic).toMatchObject({
      evidence:
        "Expected canonical host is 'moolt.site' but canonical host is 'www.moolt.site'.",
      expected: "moolt.site",
      actual: "www.moolt.site"
    });
  });

  it("detects self-canonical policy violations only when policy is explicit", async () => {
    const page = snapshot(
      '<head><link rel="canonical" href="https://example.com/products/2"></head>'
    );
    const routeContract: RouteContract = {
      route: "/products/**",
      indexable: true,
      canonicalPolicy: "self"
    };

    const result = await run(page, routeContract);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        ruleId: "SL-CANON-003",
        source: "raw-html",
        expected: "https://example.com/products/1",
        actual: "https://example.com/products/2",
        structuredEvidence: [
          {
            type: "record",
            label: "self canonical policy",
            value: {
              route: "/products/**",
              canonicalPolicy: "self",
              pageUrl: "https://example.com/products/1",
              canonicalUrl: "https://example.com/products/2",
              canonicalSource: "raw-html"
            }
          }
        ]
      })
    );

    const noPolicy = await run(page);
    expect(
      noPolicy.diagnostics.map((diagnostic) => diagnostic.ruleId)
    ).not.toContain("SL-CANON-003");

    const matching = await run(snapshot(), routeContract);
    expect(
      matching.diagnostics.map((diagnostic) => diagnostic.ruleId)
    ).not.toContain("SL-CANON-003");
  });

  it("detects canonical targets with non-success responses and redirects", async () => {
    const nonSuccess = await run({
      ...snapshot(
        '<head><link rel="canonical" href="https://example.com/canonical"></head>'
      ),
      resolvedUrls: [
        {
          url: "https://example.com/canonical",
          statusCode: 404,
          finalUrl: "https://example.com/canonical",
          headers: {},
          redirectChain: []
        }
      ]
    });

    expect(nonSuccess.diagnostics).toContainEqual(
      expect.objectContaining({
        ruleId: "SL-CANON-004",
        source: "crawler",
        expected: "2xx canonical target response",
        actual: "HTTP 404"
      })
    );

    const redirects = await run({
      ...snapshot(
        '<head><link rel="canonical" href="https://example.com/canonical"></head>'
      ),
      resolvedUrls: [
        {
          url: "https://example.com/canonical",
          statusCode: 200,
          finalUrl: "https://example.com/final",
          headers: {},
          redirectChain: [
            "https://example.com/canonical",
            "https://example.com/final"
          ]
        }
      ]
    });

    expect(redirects.diagnostics).toContainEqual(
      expect.objectContaining({
        ruleId: "SL-CANON-005",
        source: "crawler",
        expected: "canonical target without redirects",
        actual: "https://example.com/canonical -> https://example.com/final"
      })
    );

    const clean = await run({
      ...snapshot(
        '<head><link rel="canonical" href="https://example.com/canonical"></head>'
      ),
      resolvedUrls: [
        {
          url: "https://example.com/canonical",
          statusCode: 200,
          finalUrl: "https://example.com/canonical",
          headers: {},
          redirectChain: []
        }
      ]
    });

    expect(
      clean.diagnostics.map((diagnostic) => diagnostic.ruleId)
    ).not.toEqual(expect.arrayContaining(["SL-CANON-004", "SL-CANON-005"]));
  });

  it("detects canonical graph loops", async () => {
    const result = await run({
      ...snapshot(),
      pageUrl: "https://example.com/a",
      siteGraph: {
        pages: [
          {
            url: "https://example.com/a",
            statusCode: 200,
            canonicalUrl: "https://example.com/b"
          },
          {
            url: "https://example.com/b",
            statusCode: 200,
            canonicalUrl: "https://example.com/a"
          }
        ],
        links: []
      }
    });

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        ruleId: "SL-CANON-008",
        source: "crawler",
        expected: "canonical graph ending at one final target",
        actual:
          "https://example.com/a -> https://example.com/b -> https://example.com/a"
      })
    );
  });

  it("detects hreflang alternates missing return links", async () => {
    const result = await run({
      ...snapshot(),
      pageUrl: "https://example.com/en",
      siteGraph: {
        pages: [
          {
            url: "https://example.com/en",
            statusCode: 200,
            hreflangLinks: [{ hreflang: "fr", url: "https://example.com/fr" }]
          },
          {
            url: "https://example.com/fr",
            statusCode: 200,
            hreflangLinks: []
          }
        ],
        links: []
      }
    });

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        ruleId: "SL-CANON-009",
        source: "crawler",
        expected: "reciprocal hreflang return link",
        actual: "missing return link"
      })
    );
  });

  it("detects invalid hreflang code and missing x-default", async () => {
    const result = await run(
      snapshot(`<head>
        <link rel="canonical" href="https://example.com/products/1">
        <link rel="alternate" hreflang="english-us" href="https://example.com/products/1">
      </head>`)
    );

    expect(result.diagnostics.map((diagnostic) => diagnostic.ruleId)).toEqual(
      expect.arrayContaining(["SL-CANON-010", "SL-CANON-011"])
    );
  });

  it("detects hreflang targets that are non-indexable or non-success", async () => {
    const nonIndexable = await run({
      ...snapshot(`<head>
        <link rel="canonical" href="https://example.com/products/1">
        <link rel="alternate" hreflang="en" href="https://example.com/products/1">
        <link rel="alternate" hreflang="fr" href="https://example.com/fr/products/1">
        <link rel="alternate" hreflang="x-default" href="https://example.com/products/1">
      </head>`),
      resolvedUrls: [
        {
          url: "https://example.com/fr/products/1",
          statusCode: 200,
          finalUrl: "https://example.com/fr/products/1",
          headers: {},
          redirectChain: [],
          rawHtml:
            '<html><head><meta name="robots" content="noindex"></head><body></body></html>'
        }
      ]
    });

    expect(nonIndexable.diagnostics).toContainEqual(
      expect.objectContaining({
        ruleId: "SL-CANON-012",
        source: "raw-html",
        expected: "indexable hreflang target",
        actual: "noindex"
      })
    );

    const nonSuccess = await run({
      ...snapshot(`<head>
        <link rel="canonical" href="https://example.com/products/1">
        <link rel="alternate" hreflang="en" href="https://example.com/products/1">
        <link rel="alternate" hreflang="fr" href="https://example.com/fr/products/1">
        <link rel="alternate" hreflang="x-default" href="https://example.com/products/1">
      </head>`),
      resolvedUrls: [
        {
          url: "https://example.com/fr/products/1",
          statusCode: 500,
          finalUrl: "https://example.com/fr/products/1",
          headers: {},
          redirectChain: []
        }
      ]
    });

    expect(nonSuccess.diagnostics).toContainEqual(
      expect.objectContaining({
        ruleId: "SL-CANON-013",
        source: "crawler",
        expected: "2xx hreflang target response",
        actual: "HTTP 500"
      })
    );

    const missingTargetSnapshot = await run(
      snapshot(`<head>
        <link rel="canonical" href="https://example.com/products/1">
        <link rel="alternate" hreflang="fr" href="https://example.com/fr/products/1">
        <link rel="alternate" hreflang="x-default" href="https://example.com/products/1">
      </head>`)
    );

    expect(
      missingTargetSnapshot.diagnostics.map((diagnostic) => diagnostic.ruleId)
    ).not.toEqual(expect.arrayContaining(["SL-CANON-012", "SL-CANON-013"]));
  });

  it("detects raw/rendered canonical mismatch", async () => {
    const result = await run(
      snapshot(
        '<head><link rel="canonical" href="https://example.com/products/1"></head>',
        '<head><link rel="canonical" href="https://example.com/products/2"></head>'
      )
    );

    expect(result.diagnostics.map((diagnostic) => diagnostic.ruleId)).toContain(
      "SL-CANON-014"
    );
  });

  it("detects canonical URLs with query parameters", async () => {
    const result = await run(
      snapshot(
        '<head><link rel="canonical" href="https://example.com/products/1?ref=ad"></head>'
      )
    );

    expect(result.diagnostics.map((diagnostic) => diagnostic.ruleId)).toContain(
      "SL-CANON-015"
    );
  });

  it("detects Google-selected canonical differences", async () => {
    const result = await run({
      ...snapshot(),
      externalObservations: [
        {
          provider: "google",
          observedAt: "2026-06-19T00:00:00.000Z",
          fetchedAt: "2026-06-20T00:00:00.000Z",
          freshness: "fresh",
          canonical: {
            userDeclared: "https://example.com/products/1",
            googleSelected: "https://example.com/products/canonical"
          }
        }
      ]
    });

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        ruleId: "SL-CANON-016",
        source: "google",
        expected: "https://example.com/products/1",
        actual: "https://example.com/products/canonical",
        structuredEvidence: [
          {
            type: "record",
            label: "google canonical observation",
            value: {
              provider: "google",
              declaredCanonical: "https://example.com/products/1",
              declaredCanonicalSource: "raw-html",
              googleCanonical: "https://example.com/products/canonical",
              userDeclaredCanonical: "https://example.com/products/1",
              observedAt: "2026-06-19T00:00:00.000Z",
              fetchedAt: "2026-06-20T00:00:00.000Z",
              freshness: "fresh"
            }
          }
        ]
      })
    );
  });

  it("ignores Google canonical observations without explicit differences", async () => {
    const matching = await run({
      ...snapshot(),
      externalObservations: [
        {
          provider: "google",
          observedAt,
          fetchedAt: observedAt,
          freshness: "fresh",
          canonical: {
            googleSelected: "https://example.com/products/1"
          }
        }
      ]
    });
    expect(
      matching.diagnostics.map((diagnostic) => diagnostic.ruleId)
    ).not.toContain("SL-CANON-016");

    const missingDeclared = await run({
      ...snapshot("<head></head>"),
      externalObservations: [
        {
          provider: "google",
          observedAt,
          fetchedAt: observedAt,
          freshness: "fresh",
          canonical: {
            googleSelected: "https://example.com/products/canonical"
          }
        }
      ]
    });
    expect(
      missingDeclared.diagnostics.map((diagnostic) => diagnostic.ruleId)
    ).not.toContain("SL-CANON-016");
  });

  it("uses Link header canonical declarations", async () => {
    const result = await run({
      ...snapshot("<head></head>"),
      http: {
        statusCode: 200,
        finalUrl: "https://example.com/products/1",
        headers: {
          "content-type": "text/html",
          link: '<https://example.com/products/1>; rel="canonical"'
        },
        redirectChain: []
      }
    });

    expect(
      result.diagnostics.map((diagnostic) => diagnostic.ruleId)
    ).not.toContain("SL-CANON-001");
  });
});
