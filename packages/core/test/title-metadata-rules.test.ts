import { describe, expect, it } from "vitest";

import {
  createCoreTitleMetadataRules,
  createRuleCatalogRegistry,
  parseRuleCatalogYaml,
  runRuleEngine
} from "../src/index.js";
import type { PageSnapshot } from "../src/index.js";

const ruleIds = [
  ["SL-META-001", "missing-title", "blocker", "certain"],
  ["SL-META-002", "empty-title", "blocker", "certain"],
  ["SL-META-003", "multiple-title-elements", "error", "certain"],
  [
    "SL-META-004",
    "duplicate-title-across-indexable-pages",
    "warning",
    "likely"
  ],
  ["SL-META-005", "missing-description", "error", "certain"],
  ["SL-META-006", "empty-description", "error", "certain"],
  ["SL-META-007", "multiple-meta-descriptions", "error", "certain"],
  [
    "SL-META-008",
    "duplicate-description-across-indexable-pages",
    "warning",
    "likely"
  ],
  ["SL-META-009", "title-length-outside-guidance", "info", "heuristic"],
  ["SL-META-010", "description-length-outside-guidance", "info", "heuristic"],
  ["SL-META-011", "missing-open-graph-title", "warning", "certain"],
  ["SL-META-012", "missing-open-graph-description", "warning", "certain"],
  ["SL-META-013", "missing-twitter-title", "info", "certain"],
  ["SL-META-014", "missing-twitter-description", "info", "certain"],
  ["SL-META-015", "missing-viewport", "warning", "certain"],
  ["SL-META-016", "missing-charset", "warning", "certain"],
  ["SL-META-017", "metadata-source-location-unresolved", "info", "likely"],
  ["SL-META-018", "duplicate-social-metadata", "warning", "certain"]
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
  - title length is not a hard error
categories:
  - id: title-metadata
    title: Title and metadata
    targetCount: ${ruleIds.length}
rules:
${ruleIds
  .map(([id, name, severity, confidence]) =>
    `  - id: ${id}
    name: ${name}
    category: title-metadata
    defaultSeverity: ${severity}
    confidence: ${confidence}
    scope: page
    sources: [raw-html, rendered-dom]
    providerScope: core
    description: "Test catalog entry for ${name}."
    checkingAlgorithm: "Evaluate metadata from raw HTML and rendered DOM."
    requiredEvidence: [metadata]
    fix: "Update route metadata."
    testExamples: [fixtures/meta/${name}]
    documentation: docs/rules/${id}.md
    version: 1.0.0`.replace(
      "sources: [raw-html, rendered-dom]",
      id === "SL-META-001" || id === "SL-META-005"
        ? "sources: [raw-html, rendered-dom, source-code]"
        : "sources: [raw-html, rendered-dom]"
    )
  )
  .join("\n")}
`;

const observedAt = "2026-06-20T00:00:00.000Z";
const registry = createRuleCatalogRegistry(parseRuleCatalogYaml(catalog));
const rules = createCoreTitleMetadataRules(registry);

function cleanHead(): string {
  return `<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Useful Product Page</title>
    <meta name="description" content="A useful product description that fits normal search result guidance for this page.">
    <meta property="og:title" content="Useful Product Page">
    <meta property="og:description" content="A useful product description that fits normal search result guidance for this page.">
    <meta name="twitter:title" content="Useful Product Page">
    <meta name="twitter:description" content="A useful product description that fits normal search result guidance for this page.">
  </head>`;
}

function snapshot(rawHead = cleanHead()): PageSnapshot {
  return {
    pageUrl: "https://example.com/products/1",
    route: "/products/**",
    capturedAt: observedAt,
    http: {
      statusCode: 200,
      finalUrl: "https://example.com/products/1",
      headers: { "content-type": "text/html; charset=utf-8" },
      redirectChain: []
    },
    rawHtml: `<html>${rawHead}<body></body></html>`,
    renderedDom: `<html>${rawHead}<body></body></html>`
  };
}

async function run(page: PageSnapshot) {
  return runRuleEngine({
    rules,
    snapshot: page,
    options: { now: observedAt }
  });
}

describe("createCoreTitleMetadataRules", () => {
  it("creates catalog-backed metadata rules in deterministic ID order", () => {
    expect(rules.map((rule) => rule.id)).toEqual(ruleIds.map(([id]) => id));
  });

  it("emits no metadata diagnostics for a complete page", async () => {
    const result = await run(snapshot());

    expect(result.diagnostics).toEqual([]);
  });

  it("detects missing and empty title/description metadata", async () => {
    const missing = await run(
      snapshot(
        `<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>`
      )
    );
    expect(missing.diagnostics.map((diagnostic) => diagnostic.ruleId)).toEqual(
      expect.arrayContaining(["SL-META-001", "SL-META-005"])
    );

    const empty = await run(
      snapshot(
        `<head><title> </title><meta name="description" content=""></head>`
      )
    );
    expect(empty.diagnostics.map((diagnostic) => diagnostic.ruleId)).toEqual(
      expect.arrayContaining(["SL-META-002", "SL-META-006"])
    );
  });

  it("detects duplicate titles and descriptions across indexable graph pages", async () => {
    const result = await run({
      ...snapshot(),
      pageUrl: "https://example.com/",
      siteGraph: {
        pages: [
          {
            url: "https://example.com/",
            statusCode: 200,
            title: "Shared Product",
            description: "Shared description for indexable product pages.",
            indexable: true
          },
          {
            url: "https://example.com/a",
            statusCode: 200,
            title: "Shared   Product",
            description: "Shared description for indexable product pages.",
            indexable: true
          },
          {
            url: "https://example.com/noindex",
            statusCode: 200,
            title: "Shared Product",
            description: "Shared description for indexable product pages.",
            indexable: false
          }
        ],
        links: []
      }
    });

    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: "SL-META-004",
          source: "crawler",
          expected: "unique title per indexable page"
        }),
        expect.objectContaining({
          ruleId: "SL-META-008",
          source: "crawler",
          expected: "unique meta description per indexable page"
        })
      ])
    );
  });

  it("uses exact static source metadata object locations for missing fields", async () => {
    const result = await run({
      ...snapshot(
        `<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Product</title></head>`
      ),
      sourceCode: {
        files: [
          {
            path: "app/products/[slug]/page.tsx",
            content: `export const metadata = {
  title: "Product"
};`
          }
        ],
        findings: [
          {
            kind: "static-metadata-object",
            file: "app/products/[slug]/page.tsx",
            exportName: "metadata",
            location: {
              confidence: "EXACT",
              file: "app/products/[slug]/page.tsx",
              line: 1
            }
          },
          {
            kind: "static-metadata-field",
            file: "app/products/[slug]/page.tsx",
            exportName: "metadata",
            field: "title",
            location: {
              confidence: "EXACT",
              file: "app/products/[slug]/page.tsx",
              line: 2
            }
          }
        ]
      }
    });

    const diagnostic = result.diagnostics.find(
      (item) => item.ruleId === "SL-META-005"
    );
    expect(diagnostic).toMatchObject({
      source: "source-code",
      sourceLocation: {
        confidence: "EXACT",
        file: "app/products/[slug]/page.tsx",
        line: 1
      }
    });
    expect(diagnostic?.evidence).toContain(
      "no static 'description' field was present"
    );
  });

  it("uses related generateMetadata evidence without diagnostic file or line", async () => {
    const result = await run({
      ...snapshot(
        `<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Product</title></head>`
      ),
      sourceCode: {
        files: [
          {
            path: "app/products/[slug]/page.tsx",
            content: `export async function generateMetadata() {
  return await loadMetadata();
}`
          }
        ],
        findings: [
          {
            kind: "generate-metadata",
            file: "app/products/[slug]/page.tsx",
            exportName: "generateMetadata",
            location: {
              confidence: "RELATED",
              file: "app/products/[slug]/page.tsx"
            }
          }
        ]
      }
    });

    const diagnostic = result.diagnostics.find(
      (item) => item.ruleId === "SL-META-005"
    );
    expect(diagnostic).toMatchObject({
      source: "source-code",
      sourceLocation: {
        confidence: "RELATED"
      }
    });
    expect(diagnostic?.sourceLocation?.file).toBeUndefined();
    expect(diagnostic?.sourceLocation?.line).toBeUndefined();
  });

  it("reports unresolved metadata source localization confidence", async () => {
    const result = await run({
      ...snapshot(),
      sourceCode: {
        files: [],
        findings: [
          {
            kind: "generate-metadata",
            file: "app/products/[slug]/page.tsx",
            exportName: "generateMetadata",
            location: {
              confidence: "RELATED"
            }
          }
        ]
      }
    });

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        ruleId: "SL-META-017",
        source: "source-code",
        expected: "EXACT source location for metadata origin",
        actual: "RELATED"
      })
    );
  });

  it("uses route metadata summaries instead of unrelated route findings", async () => {
    const result = await run({
      ...snapshot(
        `<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>`
      ),
      route: "/products/[slug]",
      sourceCode: {
        files: [],
        routeMetadata: [
          {
            route: "/products/[slug]",
            router: "app",
            pageFile: "app/products/[slug]/page.tsx",
            metadataMode: "static",
            staticFields: [
              {
                field: "title",
                file: "app/products/layout.tsx",
                inherited: true
              }
            ],
            dynamicMetadata: []
          },
          {
            route: "/blog/[slug]",
            router: "app",
            pageFile: "app/blog/[slug]/page.tsx",
            metadataMode: "static",
            staticFields: [
              {
                field: "description",
                file: "app/blog/[slug]/page.tsx",
                inherited: false
              }
            ],
            dynamicMetadata: []
          }
        ],
        findings: [
          {
            kind: "static-metadata-object",
            file: "app/products/[slug]/page.tsx",
            exportName: "metadata",
            location: {
              confidence: "EXACT",
              file: "app/products/[slug]/page.tsx",
              line: 1
            }
          },
          {
            kind: "static-metadata-field",
            file: "app/blog/[slug]/page.tsx",
            exportName: "metadata",
            field: "description",
            location: {
              confidence: "EXACT",
              file: "app/blog/[slug]/page.tsx",
              line: 2
            }
          }
        ]
      }
    });

    const titleDiagnostic = result.diagnostics.find(
      (item) => item.ruleId === "SL-META-001"
    );
    const descriptionDiagnostic = result.diagnostics.find(
      (item) => item.ruleId === "SL-META-005"
    );

    expect(titleDiagnostic).toMatchObject({
      source: "raw-html"
    });
    expect(titleDiagnostic?.sourceLocation).toBeUndefined();
    expect(descriptionDiagnostic).toMatchObject({
      source: "source-code",
      sourceLocation: {
        confidence: "EXACT",
        file: "app/products/[slug]/page.tsx",
        line: 1
      }
    });
  });

  it("matches Next.js dynamic route metadata summaries to wildcard route contracts", async () => {
    const result = await run({
      ...snapshot(
        `<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>`
      ),
      route: "/products/**",
      sourceCode: {
        files: [],
        routeMetadata: [
          {
            route: "/products/[slug]",
            router: "app",
            pageFile: "app/products/[slug]/page.tsx",
            metadataMode: "static",
            staticFields: [
              {
                field: "title",
                file: "app/products/[slug]/page.tsx",
                inherited: false
              }
            ],
            dynamicMetadata: []
          }
        ],
        findings: [
          {
            kind: "static-metadata-object",
            file: "app/products/[slug]/page.tsx",
            exportName: "metadata",
            location: {
              confidence: "EXACT",
              file: "app/products/[slug]/page.tsx",
              line: 1
            }
          }
        ]
      }
    });

    const descriptionDiagnostic = result.diagnostics.find(
      (item) => item.ruleId === "SL-META-005"
    );

    expect(descriptionDiagnostic).toMatchObject({
      source: "source-code",
      sourceLocation: {
        confidence: "EXACT",
        file: "app/products/[slug]/page.tsx",
        line: 1
      }
    });
  });

  it("detects multiple title and meta description elements", async () => {
    const result = await run(
      snapshot(`<head>
        <meta charset="utf-8">
        <title>One</title><title>Two</title>
        <meta name="description" content="One">
        <meta name="description" content="Two">
      </head>`)
    );

    expect(result.diagnostics.map((diagnostic) => diagnostic.ruleId)).toEqual(
      expect.arrayContaining(["SL-META-003", "SL-META-007"])
    );
  });

  it("keeps title and description guidance as info diagnostics", async () => {
    const result = await run(
      snapshot(`<head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width">
        <title>Short</title>
        <meta name="description" content="Short">
        <meta property="og:title" content="Short">
        <meta property="og:description" content="Short">
        <meta name="twitter:title" content="Short">
        <meta name="twitter:description" content="Short">
      </head>`)
    );

    const guidance = result.diagnostics.filter((diagnostic) =>
      ["SL-META-009", "SL-META-010"].includes(diagnostic.ruleId)
    );
    expect(guidance.map((diagnostic) => diagnostic.severity)).toEqual([
      "info",
      "info"
    ]);
    expect(guidance.map((diagnostic) => diagnostic.confidence)).toEqual([
      "heuristic",
      "heuristic"
    ]);
  });

  it("detects missing social metadata, viewport, and charset", async () => {
    const result = await run({
      ...snapshot(
        `<head><title>Useful Product Page</title><meta name="description" content="A useful product description that fits normal search result guidance for this page."></head>`
      ),
      http: {
        statusCode: 200,
        finalUrl: "https://example.com/products/1",
        headers: { "content-type": "text/html" },
        redirectChain: []
      }
    });

    expect(result.diagnostics.map((diagnostic) => diagnostic.ruleId)).toEqual(
      expect.arrayContaining([
        "SL-META-011",
        "SL-META-012",
        "SL-META-013",
        "SL-META-014",
        "SL-META-015",
        "SL-META-016"
      ])
    );
  });

  it("detects duplicate social metadata", async () => {
    const result = await run(
      snapshot(`<head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width">
        <title>Useful Product Page</title>
        <meta name="description" content="A useful product description that fits normal search result guidance for this page.">
        <meta property="og:title" content="One">
        <meta property="og:title" content="Two">
        <meta property="og:description" content="A useful product description that fits normal search result guidance for this page.">
        <meta name="twitter:title" content="Useful Product Page">
        <meta name="twitter:description" content="A useful product description that fits normal search result guidance for this page.">
      </head>`)
    );

    expect(result.diagnostics.map((diagnostic) => diagnostic.ruleId)).toContain(
      "SL-META-018"
    );
  });
});
