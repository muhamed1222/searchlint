import { describe, expect, it } from "vitest";

import {
  createCoreHttpAndIndexabilityRules,
  createRuleCatalogRegistry,
  parseRuleCatalogYaml,
  runRuleEngine
} from "../src/index.js";
import type { PageSnapshot, RouteContract } from "../src/index.js";

const catalog = `version: 1
status: defined
source: SEARCHLINT_1_0_DEVELOPMENT_PLAN.md
targetRuleCount: 26
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
  - id: http-rendering
    title: HTTP and rendering
    targetCount: 12
  - id: indexability
    title: Indexability
    targetCount: 14
rules:
  - id: SL-HTTP-001
    name: non-success-indexable-response
    category: http-rendering
    defaultSeverity: blocker
    confidence: certain
    scope: page
    sources: [http-header, crawler]
    providerScope: core
    description: "An indexable route returns a non-2xx HTTP response."
    checkingAlgorithm: "Compare route indexability contract with final HTTP status after redirects."
    requiredEvidence: [route-contract, final-status-code, final-url]
    fix: "Return a 2xx response for indexable pages or mark the route non-indexable."
    testExamples: [fixtures/http/non-success-indexable]
    documentation: docs/rules/SL-HTTP-001.md
    version: 1.0.0
  - id: SL-HTTP-002
    name: redirect-chain-too-long
    category: http-rendering
    defaultSeverity: error
    confidence: certain
    scope: page
    sources: [http-header, crawler]
    providerScope: core
    description: "A URL resolves through more redirects than policy allows."
    checkingAlgorithm: "Count redirect hops and compare with explicit policy."
    requiredEvidence: [redirect-chain, redirect-hop-count, policy-limit]
    fix: "Shorten the redirect chain."
    testExamples: [fixtures/http/redirect-chain-too-long]
    documentation: docs/rules/SL-HTTP-002.md
    version: 1.0.0
  - id: SL-HTTP-003
    name: redirect-loop
    category: http-rendering
    defaultSeverity: blocker
    confidence: certain
    scope: page
    sources: [http-header, crawler]
    providerScope: core
    description: "A redirect chain loops back to a previously observed URL."
    checkingAlgorithm: "Normalize each redirect target and detect repeated URLs in one chain."
    requiredEvidence: [redirect-chain, repeated-url]
    fix: "Fix redirect rules so the URL resolves to one final destination."
    testExamples: [fixtures/http/redirect-loop]
    documentation: docs/rules/SL-HTTP-003.md
    version: 1.0.0
  - id: SL-HTTP-004
    name: html-route-wrong-content-type
    category: http-rendering
    defaultSeverity: error
    confidence: certain
    scope: page
    sources: [http-header]
    providerScope: core
    description: "A route expected to serve HTML returns a non-HTML content type."
    checkingAlgorithm: "Compare route type with Content-Type header."
    requiredEvidence: [route-contract, content-type]
    fix: "Serve text/html for HTML routes or update the route contract."
    testExamples: [fixtures/http/wrong-content-type]
    documentation: docs/rules/SL-HTTP-004.md
    version: 1.0.0
  - id: SL-HTTP-005
    name: missing-raw-html-head
    category: http-rendering
    defaultSeverity: blocker
    confidence: certain
    scope: page
    sources: [raw-html]
    providerScope: core
    description: "Initial HTML lacks a usable head element."
    checkingAlgorithm: "Check raw HTML for a head element."
    requiredEvidence: [raw-html]
    fix: "Render a usable head element in initial HTML."
    testExamples: [fixtures/http/missing-raw-head]
    documentation: docs/rules/SL-HTTP-005.md
    version: 1.0.0
  - id: SL-HTTP-006
    name: missing-rendered-dom-head
    category: http-rendering
    defaultSeverity: blocker
    confidence: certain
    scope: page
    sources: [rendered-dom]
    providerScope: core
    description: "Rendered DOM lacks a usable head element."
    checkingAlgorithm: "Check rendered DOM for a head element."
    requiredEvidence: [rendered-dom]
    fix: "Ensure rendered DOM contains a head element."
    testExamples: [fixtures/http/missing-rendered-head]
    documentation: docs/rules/SL-HTTP-006.md
    version: 1.0.0
  - id: SL-HTTP-007
    name: raw-rendered-title-mismatch
    category: http-rendering
    defaultSeverity: warning
    confidence: likely
    scope: page
    sources: [raw-html, rendered-dom]
    providerScope: core
    description: "Raw HTML title differs from rendered DOM title."
    checkingAlgorithm: "Extract title from raw HTML and rendered DOM and compare normalized values."
    requiredEvidence: [raw-title, rendered-title]
    fix: "Make server and rendered metadata agree unless the route is intentionally dynamic."
    testExamples: [fixtures/http/raw-rendered-title-mismatch]
    documentation: docs/rules/SL-HTTP-007.md
    version: 1.0.0
  - id: SL-HTTP-008
    name: raw-rendered-description-mismatch
    category: http-rendering
    defaultSeverity: warning
    confidence: likely
    scope: page
    sources: [raw-html, rendered-dom]
    providerScope: core
    description: "Raw HTML meta description differs from rendered DOM description."
    checkingAlgorithm: "Extract description from raw HTML and rendered DOM and compare normalized values."
    requiredEvidence: [raw-description, rendered-description]
    fix: "Make server and rendered descriptions agree unless the route is intentionally dynamic."
    testExamples: [fixtures/http/raw-rendered-description-mismatch]
    documentation: docs/rules/SL-HTTP-008.md
    version: 1.0.0
  - id: SL-HTTP-009
    name: required-metadata-rendered-only
    category: http-rendering
    defaultSeverity: error
    confidence: likely
    scope: page
    sources: [raw-html, rendered-dom]
    providerScope: core
    description: "Required metadata is missing from raw HTML and appears only after rendering."
    checkingAlgorithm: "Compare route-required metadata presence in raw HTML and rendered DOM."
    requiredEvidence: [route-contract, raw-metadata-state, rendered-metadata-state]
    fix: "Emit required SEO metadata in server-rendered HTML."
    testExamples: [fixtures/http/metadata-rendered-only]
    documentation: docs/rules/SL-HTTP-009.md
    version: 1.0.0
  - id: SL-HTTP-010
    name: response-time-over-policy
    category: http-rendering
    defaultSeverity: info
    confidence: heuristic
    scope: page
    sources: [http-header]
    providerScope: core
    description: "HTTP response timing exceeds the configured technical policy."
    checkingAlgorithm: "Compare measured response timing with route or site timing policy."
    requiredEvidence: [response-timing, policy-threshold]
    fix: "Investigate slow server response, cache behavior, or route rendering path."
    testExamples: [fixtures/http/response-time-over-policy]
    documentation: docs/rules/SL-HTTP-010.md
    version: 1.0.0
  - id: SL-HTTP-011
    name: rendered-html-lang-missing
    category: http-rendering
    defaultSeverity: warning
    confidence: certain
    scope: page
    sources: [rendered-dom]
    providerScope: core
    description: "Rendered html element has no lang attribute."
    checkingAlgorithm: "Inspect rendered documentElement lang attribute."
    requiredEvidence: [dom-selector, lang-value]
    fix: "Set a language on the html element."
    testExamples: [fixtures/http/rendered-lang-missing]
    documentation: docs/rules/SL-HTTP-011.md
    version: 1.0.0
  - id: SL-HTTP-012
    name: hydration-removes-required-metadata
    category: http-rendering
    defaultSeverity: error
    confidence: certain
    scope: page
    sources: [raw-html, rendered-dom]
    providerScope: core
    description: "Required metadata exists in raw HTML but is removed after rendering."
    checkingAlgorithm: "Compare required metadata keys before and after rendering."
    requiredEvidence: [route-contract, raw-metadata-state, rendered-metadata-state]
    fix: "Fix client rendering or framework metadata configuration so required metadata remains present."
    testExamples: [fixtures/http/hydration-removes-metadata]
    documentation: docs/rules/SL-HTTP-012.md
    version: 1.0.0
  - id: SL-INDEX-001
    name: unexpected-noindex
    category: indexability
    defaultSeverity: blocker
    confidence: certain
    scope: page
    sources: [raw-html, rendered-dom, http-header]
    providerScope: core
    description: "An indexable route contains a noindex directive."
    checkingAlgorithm: "Compare route indexability contract with discovered noindex directives."
    requiredEvidence: [route-contract, discovered-directive]
    fix: "Remove noindex or mark the route non-indexable."
    testExamples: [fixtures/indexability/unexpected-noindex]
    documentation: docs/rules/SL-INDEX-001.md
    version: 1.0.0
  - id: SL-INDEX-002
    name: missing-noindex
    category: indexability
    defaultSeverity: blocker
    confidence: certain
    scope: page
    sources: [raw-html, rendered-dom, http-header]
    providerScope: core
    description: "A non-indexable route lacks a noindex directive."
    checkingAlgorithm: "Compare route indexability contract with discovered robots directives."
    requiredEvidence: [route-contract, discovered-directive]
    fix: "Add noindex or mark the route indexable."
    testExamples: [fixtures/indexability/missing-noindex]
    documentation: docs/rules/SL-INDEX-002.md
    version: 1.0.0
  - id: SL-INDEX-003
    name: conflicting-index-directives
    category: indexability
    defaultSeverity: blocker
    confidence: certain
    scope: page
    sources: [raw-html, rendered-dom, http-header]
    providerScope: core
    description: "A page has conflicting index and noindex directives."
    checkingAlgorithm: "Collect robots directives and detect index/noindex conflict."
    requiredEvidence: [discovered-directive]
    fix: "Remove conflicting robots directives."
    testExamples: [fixtures/indexability/conflicting-directives]
    documentation: docs/rules/SL-INDEX-003.md
    version: 1.0.0
  - id: SL-INDEX-004
    name: robots-blocks-indexable-route
    category: indexability
    defaultSeverity: blocker
    confidence: certain
    scope: page
    sources: [robots-txt, crawler]
    providerScope: core
    description: "robots.txt blocks a route declared indexable."
    checkingAlgorithm: "Match URL against robots rules and compare with route contract."
    requiredEvidence: [route-contract, robots-rule, matched-url]
    fix: "Allow crawling for indexable URLs or mark the route non-indexable."
    testExamples: [fixtures/indexability/robots-blocks-indexable]
    documentation: docs/rules/SL-INDEX-004.md
    version: 1.0.0
  - id: SL-INDEX-005
    name: sitemap-includes-noindex-url
    category: indexability
    defaultSeverity: error
    confidence: certain
    scope: site
    sources: [sitemap, raw-html, rendered-dom, http-header]
    providerScope: core
    description: "Sitemap includes a URL that is noindex."
    checkingAlgorithm: "Join sitemap URLs with collected indexability directives."
    requiredEvidence: [sitemap-entry, discovered-directive]
    fix: "Remove noindex URLs from sitemap or make them indexable."
    testExamples: [fixtures/indexability/sitemap-noindex]
    documentation: docs/rules/SL-INDEX-005.md
    version: 1.0.0
  - id: SL-INDEX-006
    name: noindex-rendered-only
    category: indexability
    defaultSeverity: error
    confidence: likely
    scope: page
    sources: [raw-html, rendered-dom]
    providerScope: core
    description: "A noindex directive appears only after JavaScript rendering."
    checkingAlgorithm: "Compare noindex directives in raw HTML and rendered DOM."
    requiredEvidence: [raw-directives, rendered-directives]
    fix: "Emit indexability directives consistently in server-rendered HTML."
    testExamples: [fixtures/indexability/noindex-rendered-only]
    documentation: docs/rules/SL-INDEX-006.md
    version: 1.0.0
  - id: SL-INDEX-007
    name: x-robots-none-on-indexable-route
    category: indexability
    defaultSeverity: blocker
    confidence: certain
    scope: page
    sources: [http-header]
    providerScope: core
    description: "An indexable route has X-Robots-Tag none."
    checkingAlgorithm: "Compare route indexability with X-Robots-Tag."
    requiredEvidence: [route-contract, x-robots-tag]
    fix: "Remove none from X-Robots-Tag or mark the route non-indexable."
    testExamples: [fixtures/indexability/x-robots-none]
    documentation: docs/rules/SL-INDEX-007.md
    version: 1.0.0
  - id: SL-INDEX-008
    name: unavailable-after-expired
    category: indexability
    defaultSeverity: blocker
    confidence: certain
    scope: page
    sources: [http-header, raw-html]
    providerScope: core
    description: "An indexable route has an unavailable_after date in the past."
    checkingAlgorithm: "Parse unavailable_after and compare with observedAt."
    requiredEvidence: [route-contract, unavailable-after-date, observed-at]
    fix: "Remove or update expired unavailable_after on indexable routes."
    testExamples: [fixtures/indexability/unavailable-after-expired]
    documentation: docs/rules/SL-INDEX-008.md
    version: 1.0.0
  - id: SL-INDEX-009
    name: canonical-target-noindex
    category: indexability
    defaultSeverity: error
    confidence: certain
    scope: page
    sources: [crawler, raw-html, http-header]
    providerScope: core
    description: "A page canonicalizes to a URL that is noindex."
    checkingAlgorithm: "Resolve canonical target snapshot and inspect indexability directives."
    requiredEvidence: [canonical-url, target-directive]
    fix: "Canonicalize to an indexable target or remove noindex from the target."
    testExamples: [fixtures/indexability/canonical-target-noindex]
    documentation: docs/rules/SL-INDEX-009.md
    version: 1.0.0
  - id: SL-INDEX-010
    name: critical-assets-blocked-by-robots
    category: indexability
    defaultSeverity: warning
    confidence: heuristic
    scope: page
    sources: [robots-txt, rendered-dom]
    providerScope: core
    description: "robots.txt blocks critical render assets."
    checkingAlgorithm: "Match critical linked assets against robots rules."
    requiredEvidence: [asset-url, robots-rule]
    fix: "Allow crawling of critical render assets."
    testExamples: [fixtures/indexability/blocked-assets]
    documentation: docs/rules/SL-INDEX-010.md
    version: 1.0.0
  - id: SL-INDEX-011
    name: google-indexable-url-not-indexed
    category: indexability
    defaultSeverity: error
    confidence: certain
    scope: page
    sources: [google]
    providerScope: google
    description: "Google reports that an indexable route is not indexed."
    checkingAlgorithm: "Compare route contract with latest Google URL Inspection coverage state."
    requiredEvidence: [route-contract, google-observation, observed-at, fetched-at]
    fix: "Review Google exclusion reason and fix crawl, canonical, quality, or indexing blockers."
    testExamples: [fixtures/indexability/google-not-indexed]
    documentation: docs/rules/SL-INDEX-011.md
    version: 1.0.0
  - id: SL-INDEX-012
    name: yandex-indexable-url-not-searchable
    category: indexability
    defaultSeverity: error
    confidence: certain
    scope: page
    sources: [yandex]
    providerScope: yandex
    description: "Yandex reports that an indexable route is not searchable."
    checkingAlgorithm: "Compare route contract with latest Yandex searchable state."
    requiredEvidence: [route-contract, yandex-observation, observed-at, fetched-at]
    fix: "Review Yandex exclusion reason and fix crawl, canonical, or indexing blockers."
    testExamples: [fixtures/indexability/yandex-not-searchable]
    documentation: docs/rules/SL-INDEX-012.md
    version: 1.0.0
  - id: SL-INDEX-013
    name: indexable-parameter-url
    category: indexability
    defaultSeverity: warning
    confidence: likely
    scope: page
    sources: [crawler, raw-html]
    providerScope: core
    description: "A query-parameter URL is indexable without an explicit route contract."
    checkingAlgorithm: "Detect indexable crawled URLs with query strings and no matching allow policy."
    requiredEvidence: [matched-url, route-contract, discovered-directive]
    fix: "Canonicalize, noindex, block, or explicitly allow parameter URLs."
    testExamples: [fixtures/indexability/indexable-parameter-url]
    documentation: docs/rules/SL-INDEX-013.md
    version: 1.0.0
  - id: SL-INDEX-014
    name: soft-404-indexable
    category: indexability
    defaultSeverity: error
    confidence: likely
    scope: page
    sources: [rendered-dom, crawler, google]
    providerScope: core
    description: "Indexable URL appears to be a soft 404."
    checkingAlgorithm: "Combine status code with content signals."
    requiredEvidence: [status-code, content-signal, route-contract]
    fix: "Return a real 404/410 or provide substantial content."
    testExamples: [fixtures/indexability/soft-404-indexable]
    documentation: docs/rules/SL-INDEX-014.md
    version: 1.0.0
`;

const observedAt = "2026-06-20T00:00:00.000Z";
const registry = createRuleCatalogRegistry(parseRuleCatalogYaml(catalog));
const rules = createCoreHttpAndIndexabilityRules(registry);

function snapshot(overrides: Partial<PageSnapshot> = {}): PageSnapshot {
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
    rawHtml:
      '<html lang="en"><head><title>Product</title></head><body></body></html>',
    renderedDom:
      '<html lang="en"><head><title>Product</title></head><body></body></html>',
    ...overrides
  };
}

function routeContract(overrides: Partial<RouteContract> = {}): RouteContract {
  return {
    route: "/products/**",
    indexable: true,
    ...overrides
  };
}

async function run(
  page: PageSnapshot,
  contract: RouteContract = routeContract()
) {
  return runRuleEngine({
    rules,
    snapshot: page,
    routeContract: contract,
    options: { now: observedAt }
  });
}

describe("createCoreHttpAndIndexabilityRules", () => {
  it("creates catalog-backed rules in deterministic ID order", () => {
    expect(rules.map((rule) => rule.id)).toEqual([
      "SL-HTTP-001",
      "SL-HTTP-002",
      "SL-HTTP-003",
      "SL-HTTP-004",
      "SL-HTTP-005",
      "SL-HTTP-006",
      "SL-HTTP-007",
      "SL-HTTP-008",
      "SL-HTTP-009",
      "SL-HTTP-010",
      "SL-HTTP-011",
      "SL-HTTP-012",
      "SL-INDEX-001",
      "SL-INDEX-002",
      "SL-INDEX-003",
      "SL-INDEX-004",
      "SL-INDEX-005",
      "SL-INDEX-006",
      "SL-INDEX-007",
      "SL-INDEX-008",
      "SL-INDEX-009",
      "SL-INDEX-010",
      "SL-INDEX-011",
      "SL-INDEX-012",
      "SL-INDEX-013",
      "SL-INDEX-014"
    ]);
  });

  it("emits no diagnostics for a clean indexable HTML page", async () => {
    const result = await run(snapshot());

    expect(result.diagnostics).toEqual([]);
  });

  it("detects non-success indexable responses and supports severity overrides", async () => {
    const result = await runRuleEngine({
      rules,
      snapshot: snapshot({
        http: {
          statusCode: 404,
          finalUrl: "https://example.com/products/1",
          headers: { "content-type": "text/html" },
          redirectChain: []
        }
      }),
      routeContract: routeContract({
        requiredSeverityOverrides: {
          "SL-HTTP-001": "error"
        }
      }),
      options: { now: observedAt }
    });

    expect(result.diagnostics.map((diagnostic) => diagnostic.ruleId)).toContain(
      "SL-HTTP-001"
    );
    expect(
      result.diagnostics.find(
        (diagnostic) => diagnostic.ruleId === "SL-HTTP-001"
      )?.severity
    ).toBe("error");
  });

  it("detects redirect loops, wrong content-type, and missing heads", async () => {
    const result = await run(
      snapshot({
        http: {
          statusCode: 200,
          finalUrl: "https://example.com/products/1",
          headers: { "content-type": "application/json" },
          redirectChain: [
            "https://example.com/a",
            "https://example.com/b",
            "https://example.com/a"
          ]
        },
        rawHtml: "<html><body></body></html>",
        renderedDom: "<html><body></body></html>"
      })
    );

    expect(result.diagnostics.map((diagnostic) => diagnostic.ruleId)).toEqual(
      expect.arrayContaining([
        "SL-HTTP-003",
        "SL-HTTP-004",
        "SL-HTTP-005",
        "SL-HTTP-006"
      ])
    );
  });

  it("detects redirect chains over an explicit policy limit", async () => {
    const result = await run(
      snapshot({
        http: {
          statusCode: 200,
          finalUrl: "https://example.com/products/1",
          headers: { "content-type": "text/html" },
          redirectChain: [
            "https://example.com/a",
            "https://example.com/b",
            "https://example.com/products/1"
          ],
          redirectPolicyMaxHops: 2
        }
      })
    );

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        ruleId: "SL-HTTP-002",
        source: "http-header",
        expected: "<= 2 redirect hops",
        actual: "3 redirect hops"
      })
    );

    const withoutPolicy = await run(
      snapshot({
        http: {
          statusCode: 200,
          finalUrl: "https://example.com/products/1",
          headers: { "content-type": "text/html" },
          redirectChain: [
            "https://example.com/a",
            "https://example.com/b",
            "https://example.com/products/1"
          ]
        }
      })
    );
    expect(
      withoutPolicy.diagnostics.map((diagnostic) => diagnostic.ruleId)
    ).not.toContain("SL-HTTP-002");
  });

  it("detects raw and rendered title and description mismatches", async () => {
    const result = await run(
      snapshot({
        rawHtml: `<html lang="en"><head>
          <title>Server Title</title>
          <meta name="description" content="Server description">
        </head><body></body></html>`,
        renderedDom: `<html lang="en"><head>
          <title>Client Title</title>
          <meta name="description" content="Client description">
        </head><body></body></html>`
      })
    );

    expect(result.diagnostics.map((diagnostic) => diagnostic.ruleId)).toEqual(
      expect.arrayContaining(["SL-HTTP-007", "SL-HTTP-008"])
    );
  });

  it("detects required metadata that appears only after rendering", async () => {
    const result = await run(
      snapshot({
        rawHtml: '<html lang="en"><head></head><body></body></html>',
        renderedDom: `<html lang="en"><head>
          <title>Rendered Title</title>
          <meta name="description" content="Rendered description">
        </head><body></body></html>`
      })
    );

    expect(result.diagnostics.map((diagnostic) => diagnostic.ruleId)).toContain(
      "SL-HTTP-009"
    );
    expect(
      result.diagnostics.find(
        (diagnostic) => diagnostic.ruleId === "SL-HTTP-009"
      )?.source
    ).toBe("raw-html");
  });

  it("detects rendered HTML without a lang attribute", async () => {
    const result = await run(
      snapshot({
        renderedDom:
          "<html><head><title>Product</title></head><body></body></html>"
      })
    );

    expect(result.diagnostics.map((diagnostic) => diagnostic.ruleId)).toContain(
      "SL-HTTP-011"
    );
  });

  it("detects hydration that removes required metadata", async () => {
    const result = await run(
      snapshot({
        rawHtml: `<html lang="en"><head>
          <title>Server Title</title>
          <meta name="description" content="Server description">
        </head><body></body></html>`,
        renderedDom: '<html lang="en"><head></head><body></body></html>'
      })
    );

    expect(result.diagnostics.map((diagnostic) => diagnostic.ruleId)).toContain(
      "SL-HTTP-012"
    );
    expect(
      result.diagnostics.find(
        (diagnostic) => diagnostic.ruleId === "SL-HTTP-012"
      )?.source
    ).toBe("rendered-dom");
  });

  it("detects response timing over an explicit policy threshold", async () => {
    const result = await run(
      snapshot({
        http: {
          statusCode: 200,
          finalUrl: "https://example.com/products/1",
          headers: { "content-type": "text/html" },
          redirectChain: [],
          responseTimingMs: 750,
          responseTimingPolicyMs: 500
        } as PageSnapshot["http"] & {
          responseTimingMs: number;
          responseTimingPolicyMs: number;
        }
      })
    );

    expect(result.diagnostics.map((diagnostic) => diagnostic.ruleId)).toContain(
      "SL-HTTP-010"
    );
  });

  it("evaluates noindex according to route indexability", async () => {
    const unexpected = await run(
      snapshot({
        rawHtml:
          '<html><head><meta name="robots" content="noindex"></head><body></body></html>'
      })
    );
    expect(
      unexpected.diagnostics.map((diagnostic) => diagnostic.ruleId)
    ).toContain("SL-INDEX-001");

    const missing = await run(snapshot(), routeContract({ indexable: false }));
    expect(
      missing.diagnostics.map((diagnostic) => diagnostic.ruleId)
    ).toContain("SL-INDEX-002");
  });

  it("detects conflicting robots directives and X-Robots none", async () => {
    const result = await run(
      snapshot({
        http: {
          statusCode: 200,
          finalUrl: "https://example.com/products/1",
          headers: {
            "content-type": "text/html",
            "x-robots-tag": "none"
          },
          redirectChain: []
        },
        rawHtml:
          '<html><head><meta name="robots" content="index, noindex"></head><body></body></html>'
      })
    );

    expect(result.diagnostics.map((diagnostic) => diagnostic.ruleId)).toEqual(
      expect.arrayContaining(["SL-INDEX-003", "SL-INDEX-007"])
    );
  });

  it("detects robots.txt blocking an indexable route", async () => {
    const result = await run(
      snapshot({
        pageUrl: "https://example.com/private/page",
        robotsTxt: {
          url: "https://example.com/robots.txt",
          statusCode: 200,
          body: "User-agent: *\nDisallow: /private\n"
        }
      }),
      {
        route: "/private/**",
        indexable: true
      }
    );

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        ruleId: "SL-INDEX-004",
        source: "robots-txt",
        expected: "robots.txt allows indexable route",
        actual: "Disallow: /private"
      })
    );
  });

  it("detects sitemap entries observed as non-indexable", async () => {
    const result = await run(
      snapshot({
        pageUrl: "https://example.com/",
        sitemap: {
          url: "https://example.com/sitemap.xml",
          statusCode: 200,
          body: "<urlset><url><loc>https://example.com/noindex</loc></url></urlset>"
        },
        siteGraph: {
          pages: [
            { url: "https://example.com/", statusCode: 200, indexable: true },
            {
              url: "https://example.com/noindex",
              statusCode: 200,
              indexable: false
            }
          ],
          links: []
        }
      })
    );

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        ruleId: "SL-INDEX-005",
        source: "sitemap",
        expected: "sitemap URLs are indexable",
        actual: "noindex"
      })
    );
  });

  it("detects critical assets blocked by robots.txt", async () => {
    const result = await run(
      snapshot({
        pageUrl: "https://example.com/products/1",
        robotsTxt: {
          url: "https://example.com/robots.txt",
          statusCode: 200,
          body: "User-agent: *\nDisallow: /_next/static\n"
        },
        renderedDom:
          '<html lang="en"><head><title>Product</title><script src="/_next/static/app.js"></script></head><body></body></html>'
      })
    );

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        ruleId: "SL-INDEX-010",
        source: "robots-txt",
        expected: "critical render assets allowed by robots.txt",
        actual: "Disallow: /_next/static"
      })
    );
  });

  it("detects noindex rendered only", async () => {
    const result = await run(
      snapshot({
        rawHtml:
          '<html><head><meta name="robots" content="index"></head><body></body></html>',
        renderedDom:
          '<html><head><meta name="robots" content="noindex"></head><body></body></html>'
      })
    );

    expect(result.diagnostics.map((diagnostic) => diagnostic.ruleId)).toContain(
      "SL-INDEX-006"
    );

    const rawNoindex = await run(
      snapshot({
        rawHtml:
          '<html><head><meta name="robots" content="noindex"></head><body></body></html>',
        renderedDom:
          '<html><head><meta name="robots" content="noindex"></head><body></body></html>'
      })
    );
    expect(
      rawNoindex.diagnostics.map((diagnostic) => diagnostic.ruleId)
    ).not.toContain("SL-INDEX-006");
  });

  it("detects expired unavailable_after on indexable routes", async () => {
    const result = await run(
      snapshot({
        rawHtml:
          '<html><head><meta name="robots" content="unavailable_after: 2026-06-19T00:00:00.000Z"></head><body></body></html>'
      })
    );

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        ruleId: "SL-INDEX-008",
        source: "raw-html",
        actual: "2026-06-19T00:00:00.000Z"
      })
    );

    const nonIndexable = await run(
      snapshot({
        rawHtml:
          '<html><head><meta name="robots" content="unavailable_after: 2026-06-19T00:00:00.000Z"></head><body></body></html>'
      }),
      routeContract({ indexable: false })
    );
    expect(
      nonIndexable.diagnostics.map((diagnostic) => diagnostic.ruleId)
    ).not.toContain("SL-INDEX-008");
  });

  it("detects canonical targets that resolve to noindex", async () => {
    const result = await run(
      snapshot({
        rawHtml:
          '<html><head><link rel="canonical" href="https://example.com/canonical"></head><body></body></html>',
        renderedDom:
          '<html><head><link rel="canonical" href="https://example.com/canonical"></head><body></body></html>',
        resolvedUrls: [
          {
            url: "https://example.com/canonical",
            statusCode: 200,
            finalUrl: "https://example.com/canonical",
            headers: { "x-robots-tag": "noindex" },
            redirectChain: []
          }
        ]
      })
    );

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        ruleId: "SL-INDEX-009",
        source: "http-header",
        expected: "indexable canonical target",
        actual: "noindex"
      })
    );

    const clean = await run(
      snapshot({
        rawHtml:
          '<html><head><link rel="canonical" href="https://example.com/canonical"></head><body></body></html>',
        renderedDom:
          '<html><head><link rel="canonical" href="https://example.com/canonical"></head><body></body></html>',
        resolvedUrls: [
          {
            url: "https://example.com/canonical",
            statusCode: 200,
            finalUrl: "https://example.com/canonical",
            headers: {},
            redirectChain: []
          }
        ]
      })
    );

    expect(
      clean.diagnostics.map((diagnostic) => diagnostic.ruleId)
    ).not.toContain("SL-INDEX-009");
  });

  it("detects indexable parameter URLs without an explicit route contract", async () => {
    const parameterSnapshot = snapshot({
      pageUrl: "https://example.com/products/1?sort=price"
    });
    delete parameterSnapshot.route;

    const result = await runRuleEngine({
      rules,
      snapshot: parameterSnapshot,
      options: { now: observedAt }
    });

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        ruleId: "SL-INDEX-013",
        source: "crawler",
        severity: "warning",
        actual: "https://example.com/products/1?sort=price"
      })
    );

    const explicitContract = await run(
      snapshot({
        pageUrl: "https://example.com/products/1?sort=price"
      })
    );
    expect(
      explicitContract.diagnostics.map((diagnostic) => diagnostic.ruleId)
    ).not.toContain("SL-INDEX-013");
  });

  it("detects soft-404 signals on indexable routes", async () => {
    const result = await run(
      snapshot({
        renderedDom:
          '<html lang="en"><head><title>Missing</title></head><body>Page not found</body></html>'
      }),
      routeContract({ indexable: true })
    );

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        ruleId: "SL-INDEX-014",
        source: "rendered-dom",
        expected: "substantial indexable content or a real 404/410 status",
        actual: expect.stringContaining("not-found-copy")
      })
    );
  });

  it("detects Google not-indexed observations for indexable routes", async () => {
    const result = await run(
      snapshot({
        externalObservations: [
          {
            provider: "google",
            observedAt: "2026-06-19T00:00:00.000Z",
            fetchedAt: "2026-06-20T00:00:00.000Z",
            freshness: "fresh",
            indexability: {
              indexed: false,
              state: "Crawled - currently not indexed",
              reason: "Discovered but not indexed"
            }
          }
        ]
      })
    );

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        ruleId: "SL-INDEX-011",
        source: "google",
        severity: "error",
        actual: "Crawled - currently not indexed",
        structuredEvidence: [
          {
            type: "record",
            label: "google indexability observation",
            value: {
              provider: "google",
              route: "/products/**",
              indexed: false,
              state: "Crawled - currently not indexed",
              reason: "Discovered but not indexed",
              observedAt: "2026-06-19T00:00:00.000Z",
              fetchedAt: "2026-06-20T00:00:00.000Z",
              freshness: "fresh"
            }
          }
        ]
      })
    );
  });

  it("detects Yandex not-searchable observations for indexable routes", async () => {
    const result = await run(
      snapshot({
        externalObservations: [
          {
            provider: "yandex",
            observedAt: "2026-06-19T00:00:00.000Z",
            fetchedAt: "2026-06-20T00:00:00.000Z",
            freshness: "stale",
            indexability: {
              searchable: false,
              state: "excluded",
              reason: "Duplicate page"
            }
          }
        ]
      })
    );

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        ruleId: "SL-INDEX-012",
        source: "yandex",
        severity: "error",
        actual: "excluded",
        structuredEvidence: [
          {
            type: "record",
            label: "yandex indexability observation",
            value: {
              provider: "yandex",
              route: "/products/**",
              searchable: false,
              state: "excluded",
              reason: "Duplicate page",
              observedAt: "2026-06-19T00:00:00.000Z",
              fetchedAt: "2026-06-20T00:00:00.000Z",
              freshness: "stale"
            }
          }
        ]
      })
    );
  });

  it("does not infer provider indexability without explicit negative observations", async () => {
    const result = await run(
      snapshot({
        externalObservations: [
          {
            provider: "google",
            observedAt,
            fetchedAt: observedAt,
            freshness: "fresh",
            indexability: { indexed: true, state: "indexed" }
          },
          {
            provider: "yandex",
            observedAt,
            fetchedAt: observedAt,
            freshness: "unknown"
          }
        ]
      }),
      routeContract({ indexable: false })
    );

    expect(
      result.diagnostics.map((diagnostic) => diagnostic.ruleId)
    ).not.toEqual(expect.arrayContaining(["SL-INDEX-011", "SL-INDEX-012"]));
  });

  it("produces stable fingerprints for equivalent inputs", async () => {
    const first = await run(
      snapshot({
        rawHtml:
          '<html><head><meta name="robots" content="noindex"></head><body></body></html>'
      })
    );
    const second = await run(
      snapshot({
        rawHtml:
          '<html><head><meta name="robots" content="noindex"></head><body></body></html>'
      })
    );

    expect(
      first.diagnostics.map((diagnostic) => diagnostic.fingerprint)
    ).toEqual(second.diagnostics.map((diagnostic) => diagnostic.fingerprint));
  });
});
