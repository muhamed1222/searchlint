import { describe, expect, it } from "vitest";

import {
  createCoreStructuralMediaSchemaLinkRules,
  createRuleCatalogRegistry,
  parseRuleCatalogYaml,
  runRuleEngine
} from "../src/index.js";
import type { PageSnapshot, RouteContract } from "../src/index.js";

const ruleIds = [
  ["SL-HEAD-001", "missing-h1", "warning", "certain", "headings-structure"],
  ["SL-HEAD-002", "multiple-h1", "warning", "heuristic", "headings-structure"],
  ["SL-HEAD-003", "empty-heading", "warning", "certain", "headings-structure"],
  [
    "SL-HEAD-004",
    "skipped-heading-level",
    "info",
    "heuristic",
    "headings-structure"
  ],
  [
    "SL-HEAD-005",
    "title-h1-token-mismatch",
    "info",
    "heuristic",
    "headings-structure"
  ],
  [
    "SL-HEAD-006",
    "h1-rendered-only",
    "warning",
    "likely",
    "headings-structure"
  ],
  [
    "SL-HEAD-007",
    "hidden-primary-heading",
    "warning",
    "likely",
    "headings-structure"
  ],
  [
    "SL-HEAD-008",
    "required-heading-pattern-missing",
    "warning",
    "certain",
    "headings-structure"
  ],
  [
    "SL-IMG-001",
    "missing-og-image",
    "warning",
    "certain",
    "images-social-preview"
  ],
  [
    "SL-IMG-002",
    "og-image-non-success",
    "error",
    "certain",
    "images-social-preview"
  ],
  [
    "SL-IMG-003",
    "og-image-not-absolute",
    "error",
    "certain",
    "images-social-preview"
  ],
  [
    "SL-IMG-004",
    "missing-twitter-image",
    "info",
    "certain",
    "images-social-preview"
  ],
  [
    "SL-IMG-005",
    "twitter-image-non-success",
    "warning",
    "certain",
    "images-social-preview"
  ],
  [
    "SL-IMG-006",
    "content-image-missing-alt",
    "warning",
    "certain",
    "images-social-preview"
  ],
  [
    "SL-IMG-007",
    "content-image-empty-alt",
    "warning",
    "likely",
    "images-social-preview"
  ],
  [
    "SL-IMG-008",
    "page-image-non-success",
    "warning",
    "certain",
    "images-social-preview"
  ],
  [
    "SL-IMG-009",
    "social-image-size-outside-guidance",
    "info",
    "heuristic",
    "images-social-preview"
  ],
  [
    "SL-IMG-010",
    "unsupported-social-image-type",
    "warning",
    "certain",
    "images-social-preview"
  ],
  [
    "SL-IMG-011",
    "missing-og-image-dimensions",
    "info",
    "certain",
    "images-social-preview"
  ],
  [
    "SL-IMG-012",
    "next-image-unoptimized-indexable",
    "info",
    "likely",
    "images-social-preview"
  ],
  [
    "SL-SCHEMA-001",
    "missing-required-schema",
    "error",
    "certain",
    "schema-org"
  ],
  ["SL-SCHEMA-002", "invalid-json-ld", "error", "certain", "schema-org"],
  ["SL-SCHEMA-003", "schema-type-mismatch", "error", "certain", "schema-org"],
  [
    "SL-SCHEMA-004",
    "product-schema-missing-offers",
    "warning",
    "certain",
    "schema-org"
  ],
  [
    "SL-SCHEMA-005",
    "article-schema-missing-date",
    "warning",
    "certain",
    "schema-org"
  ],
  [
    "SL-SCHEMA-006",
    "breadcrumb-schema-incomplete",
    "warning",
    "certain",
    "schema-org"
  ],
  [
    "SL-SCHEMA-007",
    "schema-url-conflicts-page",
    "warning",
    "likely",
    "schema-org"
  ],
  ["SL-SCHEMA-008", "duplicate-json-ld-node", "info", "likely", "schema-org"],
  [
    "SL-SCHEMA-009",
    "required-schema-rendered-only",
    "warning",
    "likely",
    "schema-org"
  ],
  [
    "SL-SCHEMA-010",
    "google-rich-result-unavailable",
    "info",
    "certain",
    "schema-org"
  ],
  [
    "SL-LINK-001",
    "broken-internal-link",
    "error",
    "certain",
    "links-site-graph"
  ],
  [
    "SL-LINK-002",
    "internal-link-redirects",
    "warning",
    "certain",
    "links-site-graph"
  ],
  [
    "SL-LINK-003",
    "orphan-indexable-page",
    "warning",
    "likely",
    "links-site-graph"
  ],
  [
    "SL-LINK-004",
    "linked-nonindexable-page",
    "info",
    "certain",
    "links-site-graph"
  ],
  [
    "SL-LINK-005",
    "excessive-internal-nofollow",
    "warning",
    "heuristic",
    "links-site-graph"
  ],
  [
    "SL-LINK-006",
    "invalid-anchor-href",
    "warning",
    "certain",
    "links-site-graph"
  ],
  ["SL-LINK-007", "empty-link-text", "warning", "certain", "links-site-graph"],
  [
    "SL-LINK-008",
    "trailing-slash-duplicate",
    "warning",
    "likely",
    "links-site-graph"
  ],
  [
    "SL-LINK-009",
    "case-variant-duplicate",
    "warning",
    "likely",
    "links-site-graph"
  ],
  [
    "SL-LINK-010",
    "external-target-blank-missing-rel",
    "info",
    "certain",
    "links-site-graph"
  ],
  [
    "SL-LINK-011",
    "sitemap-url-not-linked",
    "warning",
    "likely",
    "links-site-graph"
  ],
  [
    "SL-LINK-012",
    "canonical-target-not-linked",
    "info",
    "likely",
    "links-site-graph"
  ],
  [
    "SL-LINK-013",
    "paginated-series-links-missing",
    "warning",
    "likely",
    "links-site-graph"
  ],
  [
    "SL-LINK-014",
    "important-page-excessive-crawl-depth",
    "info",
    "heuristic",
    "links-site-graph"
  ]
] as const;

const categoryCounts = {
  "headings-structure": 8,
  "images-social-preview": 12,
  "schema-org": 10,
  "links-site-graph": 14
} as const;

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
${Object.entries(categoryCounts)
  .map(
    ([id, count]) => `  - id: ${id}
    title: ${id}
    targetCount: ${count}`
  )
  .join("\n")}
rules:
${ruleIds
  .map(
    ([id, name, severity, confidence, category]) => `  - id: ${id}
    name: ${name}
    category: ${category}
    defaultSeverity: ${severity}
    confidence: ${confidence}
    scope: page
    sources: ${
      id === "SL-SCHEMA-010"
        ? "[google]"
        : id === "SL-IMG-002" ||
            id === "SL-IMG-005" ||
            id === "SL-IMG-009" ||
            id === "SL-IMG-010"
          ? "[http-header, raw-html]"
          : id === "SL-IMG-008"
            ? "[http-header, rendered-dom]"
            : id === "SL-IMG-012"
              ? "[source-code, rendered-dom]"
              : "[raw-html, rendered-dom]"
    }
    providerScope: ${id === "SL-SCHEMA-010" ? "google" : "core"}
    description: "Test catalog entry for ${name}."
    checkingAlgorithm: "Evaluate local HTML and rendered DOM."
    requiredEvidence: [local-html]
    fix: "Update local document markup."
    testExamples: [fixtures/${category}/${name}]
    documentation: docs/rules/${id}.md
    version: 1.0.0`
  )
  .join("\n")}
`;

const observedAt = "2026-06-20T00:00:00.000Z";
const registry = createRuleCatalogRegistry(parseRuleCatalogYaml(catalog));
const rules = createCoreStructuralMediaSchemaLinkRules(registry);

function cleanJsonLd(): string {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Product",
    name: "Product",
    offers: { "@type": "Offer", price: "10" }
  });
}

function cleanHtml(): string {
  return `<html><head>
    <title>Product Detail</title>
    <meta property="og:image" content="https://example.com/og.png">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta name="twitter:image" content="https://example.com/twitter.png">
    <script type="application/ld+json">${cleanJsonLd()}</script>
  </head><body>
    <h1>Product Detail</h1>
    <h2>Overview</h2>
    <img src="/p.png" alt="Product photo">
    <a href="/details">Details</a>
    <a href="https://external.example" target="_blank" rel="noopener noreferrer">External</a>
  </body></html>`;
}

function snapshot(rawHtml = cleanHtml(), renderedDom = rawHtml): PageSnapshot {
  return {
    pageUrl: "https://example.com/products/1",
    route: "/products/**",
    capturedAt: observedAt,
    rawHtml,
    renderedDom
  };
}

async function run(
  page: PageSnapshot,
  routeContract: RouteContract = {
    route: "/products/**",
    indexable: true
  }
) {
  return runRuleEngine({
    rules,
    snapshot: page,
    routeContract,
    options: { now: observedAt }
  });
}

describe("createCoreStructuralMediaSchemaLinkRules", () => {
  it("creates catalog-backed rules in deterministic ID order", () => {
    expect(rules.map((rule) => rule.id)).toEqual(ruleIds.map(([id]) => id));
  });

  it("emits no diagnostics for clean local HTML", async () => {
    const result = await run(snapshot());

    expect(result.diagnostics).toEqual([]);
  });

  it("detects heading structure diagnostics", async () => {
    const result = await run(
      snapshot(
        cleanHtml(),
        `<html><head><title>Checkout</title></head><body>
          <h1 hidden>Product Detail</h1>
          <h1>Another</h1>
          <h3>Skipped</h3>
          <h2></h2>
        </body></html>`
      )
    );

    expect(result.diagnostics.map((diagnostic) => diagnostic.ruleId)).toEqual(
      expect.arrayContaining([
        "SL-HEAD-002",
        "SL-HEAD-003",
        "SL-HEAD-004",
        "SL-HEAD-005",
        "SL-HEAD-007"
      ])
    );
  });

  it("compares title and H1 tokens with Unicode-aware meaningful terms", async () => {
    const matching = await run(
      snapshot(
        cleanHtml(),
        `<html><head><title>Блог Outlivion VPN</title></head><body>
          <h1>Блог о доступе</h1>
        </body></html>`
      )
    );
    expect(
      matching.diagnostics.map((diagnostic) => diagnostic.ruleId)
    ).not.toContain("SL-HEAD-005");

    const mismatching = await run(
      snapshot(
        cleanHtml(),
        `<html><head><title>Блог Outlivion VPN</title></head><body>
          <h1>Заметки о доступе</h1>
        </body></html>`
      )
    );
    const diagnostic = mismatching.diagnostics.find(
      (entry) => entry.ruleId === "SL-HEAD-005"
    );
    expect(diagnostic?.actual).toBe("0 shared meaningful terms");
    expect(diagnostic?.structuredEvidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "title and h1 token overlap",
          value: expect.objectContaining({
            titleTokens: "блог, outlivion, vpn",
            h1Tokens: "заметки, доступе",
            overlap: ""
          })
        })
      ])
    );
  });

  it("detects missing H1 and rendered-only H1", async () => {
    const missing = await run(
      snapshot("<html><body></body></html>", "<html><body></body></html>")
    );
    expect(
      missing.diagnostics.map((diagnostic) => diagnostic.ruleId)
    ).toContain("SL-HEAD-001");

    const renderedOnly = await run(
      snapshot("<html><body></body></html>", cleanHtml())
    );
    expect(
      renderedOnly.diagnostics.map((diagnostic) => diagnostic.ruleId)
    ).toContain("SL-HEAD-006");
  });

  it("detects missing route-required heading patterns", async () => {
    const result = await run(snapshot(), {
      route: "/products/**",
      indexable: true,
      requiredHeadings: [{ level: 2, pattern: "Specifications" }]
    });

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        ruleId: "SL-HEAD-008",
        source: "rendered-dom",
        expected: "h2 containing 'Specifications'",
        actual: "h1:Product Detail | h2:Overview",
        structuredEvidence: [
          {
            type: "record",
            label: "route heading requirement",
            value: {
              route: "/products/**",
              headingLevel: 2,
              pattern: "Specifications"
            }
          },
          {
            type: "record",
            label: "rendered heading sequence",
            value: {
              headings: "h1:Product Detail | h2:Overview"
            }
          }
        ]
      })
    );

    const satisfied = await run(snapshot(), {
      route: "/products/**",
      indexable: true,
      requiredHeadings: [{ level: 2, pattern: "overview" }]
    });
    expect(
      satisfied.diagnostics.map((diagnostic) => diagnostic.ruleId)
    ).not.toContain("SL-HEAD-008");
  });

  it("detects image and social preview diagnostics", async () => {
    const result = await run(
      snapshot(`<html><head>
        <meta property="og:image" content="/relative.png">
      </head><body>
        <h1>Product Detail</h1>
        <img src="/missing-alt.png">
        <img src="/empty-alt.png" alt="">
      </body></html>`)
    );

    expect(result.diagnostics.map((diagnostic) => diagnostic.ruleId)).toEqual(
      expect.arrayContaining([
        "SL-IMG-003",
        "SL-IMG-004",
        "SL-IMG-006",
        "SL-IMG-007",
        "SL-IMG-011"
      ])
    );
    const missingAlt = result.diagnostics.find(
      (diagnostic) => diagnostic.ruleId === "SL-IMG-006"
    );
    const emptyAlt = result.diagnostics.find(
      (diagnostic) => diagnostic.ruleId === "SL-IMG-007"
    );

    expect(missingAlt).toMatchObject({
      evidence:
        "Rendered DOM contains image #1 src '/missing-alt.png' without an alt attribute.",
      expected: "descriptive alt text",
      actual: "missing alt attribute",
      sourceLocation: {
        confidence: "RUNTIME",
        selector: 'img[src="/missing-alt.png"]'
      }
    });
    expect(emptyAlt).toMatchObject({
      evidence:
        "Rendered DOM contains image #2 src '/empty-alt.png' with an empty alt attribute.",
      expected: "non-empty descriptive alt text",
      actual: 'alt=""',
      sourceLocation: {
        confidence: "RUNTIME",
        selector: 'img[src="/empty-alt.png"]'
      }
    });
    expect(emptyAlt?.structuredEvidence).toEqual([
      {
        type: "record",
        label: "image alt state",
        value: {
          imageIndex: 2,
          src: "/empty-alt.png",
          alt: ""
        }
      }
    ]);
  });

  it("does not flag decorative empty-alt image candidates", async () => {
    const result = await run(
      snapshot(`<html><head>
        <meta property="og:image" content="/og.png">
        <meta property="og:image:width" content="1200">
        <meta property="og:image:height" content="630">
        <meta name="twitter:image" content="/twitter.png">
      </head><body>
        <h1>Product Detail</h1>
        <img src="/_next/image?url=%2Fimages%2Fdesktop%2Fshell-bg.png&amp;w=3840&amp;q=70" alt="">
        <img src="/decorative-divider.svg" alt="">
        <img src="/content.png" alt="Product photo">
      </body></html>`)
    );

    expect(
      result.diagnostics.some((diagnostic) => diagnostic.ruleId === "SL-IMG-007")
    ).toBe(false);
  });

  it("does not flag explicitly decorative empty-alt images", async () => {
    const result = await run(
      snapshot(`<html><head>
        <meta property="og:image" content="/og.png">
        <meta property="og:image:width" content="1200">
        <meta property="og:image:height" content="630">
        <meta name="twitter:image" content="/twitter.png">
      </head><body>
        <h1>Product Detail</h1>
        <img src="/hero-accent.png" alt="" aria-hidden="true">
        <img src="/layout-line.png" alt="" role="presentation">
        <img src="/content.png" alt="Product photo">
      </body></html>`)
    );

    expect(
      result.diagnostics.some((diagnostic) => diagnostic.ruleId === "SL-IMG-007")
    ).toBe(false);
  });

  it("detects image targets from resolved URL observations", async () => {
    const result = await run({
      ...snapshot(`<html><head>
        <meta property="og:image" content="https://example.com/og.png">
        <meta property="og:image:width" content="1200">
        <meta property="og:image:height" content="630">
        <meta name="twitter:image" content="https://example.com/twitter.png">
      </head><body>
        <h1>Product Detail</h1>
        <img src="/content.png" alt="Product photo">
      </body></html>`),
      resolvedUrls: [
        {
          url: "https://example.com/og.png",
          statusCode: 404,
          headers: { "content-type": "image/png" },
          redirectChain: []
        },
        {
          url: "https://example.com/twitter.png",
          statusCode: 500,
          headers: { "content-type": "image/jpeg" },
          redirectChain: []
        },
        {
          url: "https://example.com/content.png",
          statusCode: 410,
          headers: { "content-type": "image/png" },
          redirectChain: []
        }
      ]
    });

    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: "SL-IMG-002",
          source: "http-header",
          expected: "2xx Open Graph image response",
          actual: "HTTP 404"
        }),
        expect.objectContaining({
          ruleId: "SL-IMG-005",
          source: "http-header",
          expected: "2xx Twitter image response",
          actual: "HTTP 500"
        }),
        expect.objectContaining({
          ruleId: "SL-IMG-008",
          source: "http-header",
          expected: "2xx rendered image response",
          actual: "HTTP 410"
        })
      ])
    );
  });

  it("detects social image size and content type guidance", async () => {
    const oversized = await run({
      ...snapshot(`<html><head>
        <meta property="og:image" content="https://example.com/large.png">
        <meta property="og:image:width" content="1200">
        <meta property="og:image:height" content="630">
        <meta name="twitter:image" content="https://example.com/twitter.png">
      </head><body>
        <h1>Product Detail</h1>
        <img src="/p.png" alt="Product photo">
      </body></html>`),
      resolvedUrls: [
        {
          url: "https://example.com/large.png",
          statusCode: 200,
          headers: {
            "content-type": "image/png",
            "content-length": "5000001"
          },
          redirectChain: []
        }
      ]
    });

    expect(oversized.diagnostics).toContainEqual(
      expect.objectContaining({
        ruleId: "SL-IMG-009",
        source: "http-header",
        expected: "<= 5000000 bytes",
        actual: "5000001 bytes"
      })
    );

    const unsupported = await run({
      ...snapshot(`<html><head>
        <meta property="og:image" content="https://example.com/og.svg">
        <meta property="og:image:width" content="1200">
        <meta property="og:image:height" content="630">
        <meta name="twitter:image" content="https://example.com/twitter.png">
      </head><body>
        <h1>Product Detail</h1>
        <img src="/p.png" alt="Product photo">
      </body></html>`),
      resolvedUrls: [
        {
          url: "https://example.com/og.svg",
          statusCode: 200,
          headers: { "content-type": "image/svg+xml" },
          redirectChain: []
        }
      ]
    });

    expect(unsupported.diagnostics).toContainEqual(
      expect.objectContaining({
        ruleId: "SL-IMG-010",
        source: "http-header",
        expected: "image/jpeg, image/png, image/gif, or image/webp",
        actual: "image/svg+xml"
      })
    );
  });

  it("does not emit target image diagnostics without failing target evidence", async () => {
    const result = await run({
      ...snapshot(),
      resolvedUrls: [
        {
          url: "https://example.com/og.png",
          statusCode: 200,
          headers: {
            "content-type": "image/png",
            "content-length": "4999999"
          },
          redirectChain: []
        },
        {
          url: "https://example.com/twitter.png",
          statusCode: 200,
          headers: { "content-type": "image/jpeg" },
          redirectChain: []
        },
        {
          url: "https://example.com/p.png",
          statusCode: 200,
          headers: { "content-type": "image/png" },
          redirectChain: []
        }
      ]
    });

    expect(
      result.diagnostics.map((diagnostic) => diagnostic.ruleId)
    ).not.toEqual(
      expect.arrayContaining([
        "SL-IMG-002",
        "SL-IMG-005",
        "SL-IMG-008",
        "SL-IMG-009",
        "SL-IMG-010"
      ])
    );
  });

  it("detects unoptimized Next image usage on indexable routes", async () => {
    const page = {
      ...snapshot(),
      sourceCode: {
        files: [
          {
            path: "app/products/[slug]/page.tsx",
            content:
              'import Image from "next/image";\nexport default function Page() { return <Image src="/p.png" alt="Product" width={1200} height={630} unoptimized />; }'
          }
        ],
        findings: [
          {
            kind: "next-image-unoptimized" as const,
            file: "app/products/[slug]/page.tsx",
            router: "app" as const,
            route: "/products/[slug]",
            location: {
              confidence: "EXACT" as const,
              file: "app/products/[slug]/page.tsx",
              line: 2
            }
          }
        ]
      }
    };

    const result = await run(page);

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        ruleId: "SL-IMG-012",
        source: "source-code",
        sourceLocation: {
          confidence: "EXACT",
          file: "app/products/[slug]/page.tsx",
          line: 2
        },
        expected:
          "optimized Next.js image or documented route policy allowance",
        actual: "unoptimized Next.js Image"
      })
    );

    const nonIndexable = await run(page, {
      route: "/products/**",
      indexable: false
    });
    expect(
      nonIndexable.diagnostics.map((diagnostic) => diagnostic.ruleId)
    ).not.toContain("SL-IMG-012");

    const missingFinding = await run(snapshot());
    expect(
      missingFinding.diagnostics.map((diagnostic) => diagnostic.ruleId)
    ).not.toContain("SL-IMG-012");
  });

  it("uses generated image source findings for missing social image rules", async () => {
    const result = await run({
      ...snapshot(
        `<html><head></head><body><h1>Product Detail</h1></body></html>`
      ),
      sourceCode: {
        files: [
          {
            path: "app/products/[slug]/opengraph-image.tsx",
            content: "export default function Image() { return null; }"
          },
          {
            path: "app/products/[slug]/twitter-image.tsx",
            content: "export default function Image() { return null; }"
          }
        ],
        findings: [
          {
            kind: "opengraph-image-file",
            file: "app/products/[slug]/opengraph-image.tsx",
            exportName: "opengraph-image",
            route: "/products/**",
            location: {
              confidence: "EXACT",
              file: "app/products/[slug]/opengraph-image.tsx",
              line: 1
            }
          },
          {
            kind: "twitter-image-file",
            file: "app/products/[slug]/twitter-image.tsx",
            exportName: "twitter-image",
            route: "/products/**",
            location: {
              confidence: "EXACT",
              file: "app/products/[slug]/twitter-image.tsx",
              line: 1
            }
          }
        ]
      }
    });

    expect(
      result.diagnostics.map((diagnostic) => diagnostic.ruleId)
    ).not.toEqual(expect.arrayContaining(["SL-IMG-001", "SL-IMG-004"]));
  });

  it("does not use generated image source findings from unrelated routes", async () => {
    const result = await run({
      ...snapshot(
        `<html><head></head><body><h1>Product Detail</h1></body></html>`
      ),
      sourceCode: {
        files: [
          {
            path: "app/blog/[slug]/opengraph-image.tsx",
            content: "export default function Image() { return null; }"
          },
          {
            path: "app/blog/[slug]/twitter-image.tsx",
            content: "export default function Image() { return null; }"
          }
        ],
        findings: [
          {
            kind: "opengraph-image-file",
            file: "app/blog/[slug]/opengraph-image.tsx",
            exportName: "opengraph-image",
            route: "/blog/[slug]",
            location: {
              confidence: "EXACT",
              file: "app/blog/[slug]/opengraph-image.tsx",
              line: 1
            }
          },
          {
            kind: "twitter-image-file",
            file: "app/blog/[slug]/twitter-image.tsx",
            exportName: "twitter-image",
            route: "/blog/[slug]",
            location: {
              confidence: "EXACT",
              file: "app/blog/[slug]/twitter-image.tsx",
              line: 1
            }
          }
        ]
      }
    });

    expect(result.diagnostics.map((diagnostic) => diagnostic.ruleId)).toEqual(
      expect.arrayContaining(["SL-IMG-001", "SL-IMG-004"])
    );
  });

  it("uses route social image summaries before raw source findings", async () => {
    const result = await run({
      ...snapshot(
        `<html><head></head><body><h1>Product Detail</h1></body></html>`
      ),
      sourceCode: {
        files: [],
        routeSocialImages: [
          {
            route: "/products/**",
            router: "app",
            openGraphImageFiles: ["app/products/[slug]/opengraph-image.tsx"],
            twitterImageFiles: ["app/products/[slug]/twitter-image.tsx"]
          }
        ],
        findings: [
          {
            kind: "opengraph-image-file",
            file: "app/blog/[slug]/opengraph-image.tsx",
            exportName: "opengraph-image",
            route: "/blog/[slug]",
            location: {
              confidence: "EXACT",
              file: "app/blog/[slug]/opengraph-image.tsx",
              line: 1
            }
          }
        ]
      }
    });

    expect(
      result.diagnostics.map((diagnostic) => diagnostic.ruleId)
    ).not.toEqual(expect.arrayContaining(["SL-IMG-001", "SL-IMG-004"]));
  });

  it("matches Next.js dynamic route social image summaries to wildcard route contracts", async () => {
    const result = await run({
      ...snapshot(
        `<html><head></head><body><h1>Product Detail</h1></body></html>`
      ),
      sourceCode: {
        files: [],
        routeSocialImages: [
          {
            route: "/products/[slug]",
            router: "app",
            openGraphImageFiles: ["app/products/[slug]/opengraph-image.tsx"],
            twitterImageFiles: ["app/products/[slug]/twitter-image.tsx"]
          }
        ],
        findings: []
      }
    });

    expect(
      result.diagnostics.map((diagnostic) => diagnostic.ruleId)
    ).not.toEqual(expect.arrayContaining(["SL-IMG-001", "SL-IMG-004"]));
  });

  it("detects schema.org diagnostics", async () => {
    const result = await run(
      snapshot(`<html><head>
        <meta property="og:image" content="https://example.com/og.png">
        <meta property="og:image:width" content="1200">
        <meta property="og:image:height" content="630">
        <meta name="twitter:image" content="https://example.com/twitter.png">
        <script type="application/ld+json">{ bad json }</script>
        <script type="application/ld+json">{"@type":"Product","name":"Product"}</script>
        <script type="application/ld+json">{"@type":"Article","headline":"Article"}</script>
        <script type="application/ld+json">{"@type":"BreadcrumbList","itemListElement":[]}</script>
        <script type="application/ld+json">{"@type":"Thing","name":"Duplicate"}</script>
        <script type="application/ld+json">{"@type":"Thing","name":"Duplicate"}</script>
      </head><body><h1>Product Detail</h1></body></html>`)
    );

    expect(result.diagnostics.map((diagnostic) => diagnostic.ruleId)).toEqual(
      expect.arrayContaining([
        "SL-SCHEMA-002",
        "SL-SCHEMA-004",
        "SL-SCHEMA-005",
        "SL-SCHEMA-006",
        "SL-SCHEMA-008"
      ])
    );
  });

  it("detects missing and mismatched route-required schema", async () => {
    const missing = await run(
      snapshot("<html><body><h1>Product Detail</h1></body></html>"),
      {
        route: "/products/**",
        indexable: true,
        requiredSchemas: ["Product"]
      }
    );

    expect(missing.diagnostics).toContainEqual(
      expect.objectContaining({
        ruleId: "SL-SCHEMA-001",
        source: "raw-html",
        expected: "Product",
        actual: "no parsed JSON-LD schema types"
      })
    );

    const mismatch = await run(
      snapshot(`<html><head>
        <script type="application/ld+json">{"@type":"Article","headline":"Article"}</script>
      </head><body><h1>Product Detail</h1></body></html>`),
      {
        route: "/products/**",
        indexable: true,
        requiredSchemas: ["Product"]
      }
    );

    expect(mismatch.diagnostics).toContainEqual(
      expect.objectContaining({
        ruleId: "SL-SCHEMA-003",
        source: "raw-html",
        expected: "Product",
        actual: "article"
      })
    );

    const satisfied = await run(snapshot(), {
      route: "/products/**",
      indexable: true,
      requiredSchemas: ["Product"]
    });
    expect(
      satisfied.diagnostics.map((diagnostic) => diagnostic.ruleId)
    ).not.toEqual(expect.arrayContaining(["SL-SCHEMA-001", "SL-SCHEMA-003"]));
  });

  it("detects schema URL conflicts with canonical URL", async () => {
    const result = await run(
      snapshot(`<html><head>
        <link rel="canonical" href="https://example.com/products/1">
        <script type="application/ld+json">{"@type":"Product","url":"https://example.com/products/other"}</script>
      </head><body><h1>Product Detail</h1></body></html>`)
    );

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        ruleId: "SL-SCHEMA-007",
        source: "raw-html",
        expected: "https://example.com/products/1",
        actual: "https://example.com/products/other"
      })
    );

    const aligned = await run(
      snapshot(`<html><head>
        <link rel="canonical" href="https://example.com/products/1">
        <script type="application/ld+json">{"@type":"Product","mainEntityOfPage":"https://example.com/products/1"}</script>
      </head><body><h1>Product Detail</h1></body></html>`)
    );
    expect(
      aligned.diagnostics.map((diagnostic) => diagnostic.ruleId)
    ).not.toContain("SL-SCHEMA-007");
  });

  it("detects schema rendered only", async () => {
    const result = await run(
      snapshot("<html><body><h1>Product Detail</h1></body></html>", cleanHtml())
    );

    expect(result.diagnostics.map((diagnostic) => diagnostic.ruleId)).toContain(
      "SL-SCHEMA-009"
    );
  });

  it("detects unavailable Google rich result when route contract requires it", async () => {
    const result = await run(
      {
        ...snapshot(),
        externalObservations: [
          {
            provider: "google",
            observedAt: "2026-06-19T00:00:00.000Z",
            fetchedAt: "2026-06-20T00:00:00.000Z",
            freshness: "fresh",
            richResults: {
              available: false,
              state: "not-eligible",
              eligibleTypes: ["Product"]
            },
            quota: {
              limit: 2000,
              remaining: 12,
              resetAt: "2026-06-21T00:00:00.000Z"
            }
          }
        ]
      },
      {
        route: "/products/**",
        indexable: true,
        googleRichResult: {
          required: true,
          eligibleTypes: ["Product"]
        }
      }
    );

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        ruleId: "SL-SCHEMA-010",
        source: "google",
        expected: "Google rich result available",
        actual: "not-eligible",
        structuredEvidence: [
          {
            type: "record",
            label: "route contract rich result requirement",
            value: {
              route: "/products/**",
              required: true,
              eligibleTypes: "Product"
            }
          },
          {
            type: "record",
            label: "google rich result observation",
            value: {
              provider: "google",
              available: false,
              state: "not-eligible",
              eligibleTypes: "Product",
              observedAt: "2026-06-19T00:00:00.000Z",
              fetchedAt: "2026-06-20T00:00:00.000Z",
              freshness: "fresh",
              quotaLimit: 2000,
              quotaRemaining: 12,
              quotaResetAt: "2026-06-21T00:00:00.000Z"
            }
          }
        ]
      })
    );
  });

  it("ignores rich-result observations without explicit required unavailable state", async () => {
    const result = await run(
      {
        ...snapshot(),
        externalObservations: [
          {
            provider: "google",
            observedAt,
            fetchedAt: observedAt,
            freshness: "fresh",
            richResults: {
              available: true,
              state: "eligible"
            }
          },
          {
            provider: "yandex",
            observedAt,
            fetchedAt: observedAt,
            freshness: "fresh",
            richResults: {
              available: false,
              state: "not-eligible"
            }
          }
        ]
      },
      {
        route: "/products/**",
        indexable: true,
        googleRichResult: {
          required: true
        }
      }
    );

    const withoutRequirement = await run({
      ...snapshot(),
      externalObservations: [
        {
          provider: "google",
          observedAt,
          fetchedAt: observedAt,
          freshness: "fresh",
          richResults: {
            available: false,
            state: "not-eligible"
          }
        }
      ]
    });

    expect(
      result.diagnostics.map((diagnostic) => diagnostic.ruleId)
    ).not.toContain("SL-SCHEMA-010");
    expect(
      withoutRequirement.diagnostics.map((diagnostic) => diagnostic.ruleId)
    ).not.toContain("SL-SCHEMA-010");
  });

  it("detects rendered link diagnostics", async () => {
    const result = await run(
      snapshot(
        cleanHtml(),
        `<html><head>${cleanHtml()}</head><body>
          <h1>Product Detail</h1>
          <a href="#">Placeholder</a>
          <a href="/empty"></a>
          <a href="https://external.example" target="_blank">External</a>
        </body></html>`
      )
    );

    expect(result.diagnostics.map((diagnostic) => diagnostic.ruleId)).toEqual(
      expect.arrayContaining(["SL-LINK-006", "SL-LINK-007", "SL-LINK-010"])
    );
  });

  it("detects deterministic crawl site graph link diagnostics", async () => {
    const page = {
      ...snapshot(),
      pageUrl: "https://example.com/",
      route: "/",
      sitemap: {
        url: "https://example.com/sitemap.xml",
        statusCode: 200,
        body: `<urlset>
          <url><loc>https://example.com/about</loc></url>
          <url><loc>https://example.com/not-linked</loc></url>
        </urlset>`
      },
      siteGraph: {
        pages: [
          { url: "https://example.com/", statusCode: 200 },
          { url: "https://example.com/broken", statusCode: 404 },
          {
            url: "https://example.com/redirect",
            statusCode: 200,
            finalUrl: "https://example.com/final",
            redirectChain: [
              "https://example.com/redirect",
              "https://example.com/final"
            ]
          },
          { url: "https://example.com/about", statusCode: 200 },
          { url: "https://example.com/about/", statusCode: 200 },
          { url: "https://example.com/Case", statusCode: 200 },
          { url: "https://example.com/case", statusCode: 200 },
          {
            url: "https://example.com/canonical-source",
            statusCode: 200,
            canonicalUrl: "https://example.com/canonical-target"
          },
          {
            url: "https://example.com/noindex",
            statusCode: 200,
            indexable: false
          },
          {
            url: "https://example.com/orphan",
            statusCode: 200,
            indexable: true
          }
        ],
        links: [
          {
            sourceUrl: "https://example.com/",
            targetUrl: "https://example.com/broken"
          },
          {
            sourceUrl: "https://example.com/",
            targetUrl: "https://example.com/redirect"
          },
          {
            sourceUrl: "https://example.com/",
            targetUrl: "https://example.com/about"
          },
          {
            sourceUrl: "https://example.com/",
            targetUrl: "https://example.com/Case"
          },
          {
            sourceUrl: "https://example.com/",
            targetUrl: "https://example.com/noindex"
          }
        ]
      }
    };

    const result = await run(page);

    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: "SL-LINK-001",
          source: "crawler",
          expected: "2xx HTTP status",
          actual: "404"
        }),
        expect.objectContaining({
          ruleId: "SL-LINK-002",
          source: "crawler",
          expected: "direct internal link target",
          actual: "https://example.com/redirect -> https://example.com/final"
        }),
        expect.objectContaining({
          ruleId: "SL-LINK-003",
          source: "crawler",
          expected: "at least one incoming internal link",
          actual: "0 incoming links"
        }),
        expect.objectContaining({
          ruleId: "SL-LINK-004",
          source: "crawler",
          expected:
            "internal link target is indexable or intentionally allowed",
          actual: "non-indexable target"
        }),
        expect.objectContaining({
          ruleId: "SL-LINK-008",
          source: "crawler",
          expected: "one canonical URL variant"
        }),
        expect.objectContaining({
          ruleId: "SL-LINK-009",
          source: "crawler",
          expected: "one canonical path casing"
        }),
        expect.objectContaining({
          ruleId: "SL-LINK-011",
          source: "crawler",
          expected: "sitemap URL present in crawl graph",
          actual: "missing from crawl graph"
        }),
        expect.objectContaining({
          ruleId: "SL-LINK-012",
          source: "crawler",
          expected: "canonical target present in crawl graph",
          actual: "missing from crawl graph"
        })
      ])
    );
  });

  it("does not repeat site graph diagnostics on non-root graph pages", async () => {
    const result = await run({
      ...snapshot(),
      pageUrl: "https://example.com/second",
      siteGraph: {
        pages: [
          { url: "https://example.com/", statusCode: 200 },
          { url: "https://example.com/second", statusCode: 200 },
          { url: "https://example.com/broken", statusCode: 404 }
        ],
        links: [
          {
            sourceUrl: "https://example.com/",
            targetUrl: "https://example.com/broken"
          }
        ]
      }
    });

    expect(
      result.diagnostics.map((diagnostic) => diagnostic.ruleId)
    ).not.toContain("SL-LINK-001");
  });

  it("detects excessive internal nofollow usage when policy is configured", async () => {
    const result = await run({
      ...snapshot(),
      pageUrl: "https://example.com/",
      siteGraph: {
        internalNofollowPolicyMaxRatio: 0.25,
        pages: [{ url: "https://example.com/", statusCode: 200 }],
        links: [
          {
            sourceUrl: "https://example.com/",
            targetUrl: "https://example.com/a",
            rel: "nofollow"
          },
          {
            sourceUrl: "https://example.com/",
            targetUrl: "https://example.com/b"
          }
        ]
      }
    });

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        ruleId: "SL-LINK-005",
        source: "crawler",
        expected: "nofollow ratio <= 0.25",
        actual: "1/2"
      })
    );
  });

  it("detects missing pagination links for routes requiring pagination", async () => {
    const result = await run(
      {
        ...snapshot(),
        pageUrl: "https://example.com/blog?page=2",
        siteGraph: {
          pages: [{ url: "https://example.com/blog?page=2", statusCode: 200 }],
          links: []
        }
      },
      {
        route: "/blog",
        indexable: true,
        pagination: { required: true }
      }
    );

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        ruleId: "SL-LINK-013",
        source: "crawler",
        expected: "crawlable previous or next pagination link",
        actual: "missing pagination links"
      })
    );
  });

  it("detects important pages beyond crawl-depth policy", async () => {
    const result = await run(
      {
        ...snapshot(),
        pageUrl: "https://example.com/key",
        siteGraph: {
          pages: [
            {
              url: "https://example.com/key",
              statusCode: 200,
              crawlDepth: 4
            }
          ],
          links: []
        }
      },
      {
        route: "/key",
        indexable: true,
        important: true,
        crawlDepthPolicyMax: 2
      }
    );

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        ruleId: "SL-LINK-014",
        source: "crawler",
        expected: "crawl depth <= 2",
        actual: "4"
      })
    );
  });
});
