import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  analyzeCrawl,
  formatCrawlAnalysisResult,
  shouldFail,
  type CliIo
} from "../src/index.js";
import type { CrawlResponse, CrawlerFetcher } from "@searchlint/crawler";

const realCatalogPath = "../../specs/RULE_CATALOG.yaml";

describe("analyzeCrawl", () => {
  it("runs crawl analysis through the real production catalog", async () => {
    const catalogText = await readFile(realCatalogPath, "utf8");
    const result = await analyzeCrawl(
      {
        catalogPath: "specs/RULE_CATALOG.yaml",
        configPath: "searchlint.seo",
        format: "json",
        failOn: "none",
        now: "2026-06-21T00:00:00.000Z",
        crawl: {
          startUrl: "https://example.com/",
          maxUrls: 1,
          respectRobotsTxt: false
        }
      },
      createIo({
        "specs/RULE_CATALOG.yaml": catalogText,
        "searchlint.seo": `language 1
site "https://example.com"
route "/**" {
  indexable true
}
`
      }),
      createFetcher({
        "https://example.com/": html(
          `<html><head><meta name="robots" content="noindex"></head><body><h1>Home</h1></body></html>`
        )
      })
    );

    expect(result.executedRuleIds).toHaveLength(120);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        ruleId: "SL-INDEX-001",
        severity: "blocker"
      })
    );
  });

  it("crawls pages, builds snapshots, and runs shared core rules", async () => {
    const result = await analyzeCrawl(
      {
        catalogPath: "catalog.yaml",
        format: "json",
        failOn: "blocker",
        now: "2026-06-20T00:00:00.000Z",
        crawl: {
          startUrl: "https://example.com/",
          maxUrls: 3,
          respectRobotsTxt: false
        }
      },
      createIo({ "catalog.yaml": createCatalog() }),
      createFetcher({
        "https://example.com/": html(
          `<html><body><a href="/missing-head">Missing</a></body></html>`
        ),
        "https://example.com/missing-head": html(`<html><body></body></html>`)
      })
    );

    expect(result.pageResults.map((page) => page.url)).toEqual([
      "https://example.com/",
      "https://example.com/missing-head"
    ]);
    expect(result.diagnostics.map((diagnostic) => diagnostic.ruleId)).toContain(
      "SL-HTTP-005"
    );
    expect(shouldFail(result.diagnostics, "blocker")).toBe(true);
  });

  it("attaches crawl site graph evidence for shared link rules", async () => {
    const result = await analyzeCrawl(
      {
        catalogPath: "catalog.yaml",
        format: "json",
        failOn: "none",
        now: "2026-06-20T00:00:00.000Z",
        crawl: {
          startUrl: "https://example.com/",
          maxUrls: 2,
          respectRobotsTxt: false
        }
      },
      createIo({ "catalog.yaml": createCatalog() }),
      createFetcher({
        "https://example.com/": html(
          `<html><body><a href="/missing">Missing</a></body></html>`
        ),
        "https://example.com/missing": {
          url: "https://example.com/missing",
          statusCode: 404,
          headers: { "content-type": "text/html" },
          body: `<html><body>Missing</body></html>`
        }
      })
    );

    expect(
      result.diagnostics.filter(
        (diagnostic) => diagnostic.ruleId === "SL-LINK-001"
      )
    ).toHaveLength(1);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        ruleId: "SL-LINK-001",
        source: "crawler",
        expected: "2xx HTTP status",
        actual: "404"
      })
    );
  });

  it("attaches observed noindex graph evidence for linked non-indexable rules", async () => {
    const result = await analyzeCrawl(
      {
        catalogPath: "catalog.yaml",
        format: "json",
        failOn: "none",
        now: "2026-06-20T00:00:00.000Z",
        crawl: {
          startUrl: "https://example.com/",
          maxUrls: 2,
          respectRobotsTxt: false
        }
      },
      createIo({ "catalog.yaml": createCatalog() }),
      createFetcher({
        "https://example.com/": html(
          `<html><body><a href="/noindex">Noindex</a></body></html>`
        ),
        "https://example.com/noindex": {
          url: "https://example.com/noindex",
          statusCode: 200,
          headers: { "content-type": "text/html" },
          body: `<html><head><meta name="robots" content="noindex"></head><body>Noindex</body></html>`
        }
      })
    );

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        ruleId: "SL-LINK-004",
        source: "crawler",
        actual: "non-indexable target"
      })
    );
  });

  it("attaches crawl metadata graph evidence for shared duplicate metadata rules", async () => {
    const result = await analyzeCrawl(
      {
        catalogPath: "catalog.yaml",
        format: "json",
        failOn: "none",
        now: "2026-06-20T00:00:00.000Z",
        crawl: {
          startUrl: "https://example.com/",
          maxUrls: 2,
          respectRobotsTxt: false
        }
      },
      createIo({ "catalog.yaml": createCatalog() }),
      createFetcher({
        "https://example.com/": html(
          `<html><head>
            <title>Shared Title</title>
            <meta name="description" content="Shared description across pages.">
          </head><body><a href="/second">Second</a></body></html>`
        ),
        "https://example.com/second": html(
          `<html><head>
            <title>Shared   Title</title>
            <meta name="description" content="Shared description across pages.">
          </head><body></body></html>`
        )
      })
    );

    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: "SL-META-004",
          source: "crawler"
        }),
        expect.objectContaining({
          ruleId: "SL-META-008",
          source: "crawler"
        })
      ])
    );
  });

  it("attaches crawl hreflang graph evidence for reciprocal checks", async () => {
    const result = await analyzeCrawl(
      {
        catalogPath: "catalog.yaml",
        format: "json",
        failOn: "none",
        now: "2026-06-20T00:00:00.000Z",
        crawl: {
          startUrl: "https://example.com/en",
          maxUrls: 2,
          respectRobotsTxt: false
        }
      },
      createIo({ "catalog.yaml": createCatalog() }),
      createFetcher({
        "https://example.com/en": html(
          `<html><head>
            <link rel="canonical" href="https://example.com/en">
            <link rel="alternate" hreflang="fr" href="/fr">
          </head><body><a href="/fr">FR</a></body></html>`
        ),
        "https://example.com/fr": html(
          `<html><head>
            <link rel="canonical" href="https://example.com/fr">
          </head><body>FR</body></html>`
        )
      })
    );

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        ruleId: "SL-CANON-009",
        source: "crawler",
        expected: "reciprocal hreflang return link",
        actual: "missing return link"
      })
    );
  });

  it("formats crawl analysis summaries for clean aggregate output", async () => {
    const output = formatCrawlAnalysisResult(
      {
        crawlResult: {
          startUrl: "https://example.com/",
          pages: [],
          skipped: [],
          failed: [],
          artifactSummary: {
            pageCount: 0,
            totalBodyBytes: 0,
            largestBodyBytes: 0,
            bodySha256:
              "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
          },
          limits: {
            maxUrls: 100,
            maxDepth: 50,
            maxLinksPerPage: 500,
            maxQueryVariantsPerPath: 20,
            maxResponseBytes: 5242880,
            maxRedirects: 10,
            retryAttempts: 1,
            requestTimeoutMs: 30000,
            allowPrivateNetworks: false
          }
        },
        pageResults: [],
        diagnostics: [],
        executedRuleIds: []
      },
      "text"
    );

    expect(output).toBe(
      "SearchLint crawled 0 pages and found 0 diagnostics. Executed 0 rules.\n"
    );
  });

  it("formats crawl diagnostics as SARIF and JUnit", async () => {
    const result = await analyzeCrawl(
      {
        catalogPath: "catalog.yaml",
        format: "sarif",
        failOn: "none",
        now: "2026-06-20T00:00:00.000Z",
        crawl: {
          startUrl: "https://example.com/",
          maxUrls: 1,
          respectRobotsTxt: false
        }
      },
      createIo({ "catalog.yaml": createCatalog() }),
      createFetcher({
        "https://example.com/": html(`<html><body></body></html>`)
      })
    );

    const sarif = JSON.parse(formatCrawlAnalysisResult(result, "sarif"));
    expect(sarif).toMatchObject({
      version: "2.1.0",
      runs: [{ results: expect.any(Array) }]
    });

    const junit = formatCrawlAnalysisResult(result, "junit");
    expect(junit).toContain("<testsuite");
    expect(junit).toContain("<failure");
  });

  it("applies SearchLint DSL route contracts during crawl analysis", async () => {
    const result = await analyzeCrawl(
      {
        catalogPath: "catalog.yaml",
        configPath: "searchlint.seo",
        format: "json",
        failOn: "none",
        now: "2026-06-20T00:00:00.000Z",
        crawl: {
          startUrl: "https://example.com/products/1",
          maxUrls: 1,
          respectRobotsTxt: false
        }
      },
      createIo({
        "catalog.yaml": createCatalog(),
        "searchlint.seo": `language 1
site "https://example.com"
route "/products/**" {
  indexable true
  severity SL-META-005 error
}
`
      }),
      createFetcher({
        "https://example.com/products/1": html(
          `<html><head><title>Product</title></head><body><h1>Product</h1></body></html>`
        )
      })
    );

    const diagnostic = result.diagnostics.find(
      (item) => item.ruleId === "SL-META-005"
    );
    expect(diagnostic).toMatchObject({
      route: "/products/**",
      severity: "error"
    });
  });

  it("discovers searchlint.seo and applies suppressions during crawl analysis", async () => {
    const result = await analyzeCrawl(
      {
        catalogPath: "catalog.yaml",
        format: "json",
        failOn: "none",
        now: "2026-06-20T00:00:00.000Z",
        crawl: {
          startUrl: "https://example.com/products/1",
          maxUrls: 1,
          respectRobotsTxt: false
        }
      },
      createIo(
        {
          "catalog.yaml": createCatalog(),
          "searchlint.seo": `language 1
site "https://example.com"
route "/products/**" {
  indexable true
  suppress SL-INDEX-001 {
    reason "Known noindex during migration"
  }
}
`
        },
        true
      ),
      createFetcher({
        "https://example.com/products/1": html(
          `<html><head><meta name="robots" content="noindex"></head><body></body></html>`
        )
      })
    );

    expect(result.diagnostics.map((item) => item.ruleId)).not.toContain(
      "SL-INDEX-001"
    );
  });

  it("attaches crawled robots.txt artifacts to page snapshots", async () => {
    const result = await analyzeCrawl(
      {
        catalogPath: "catalog.yaml",
        format: "json",
        failOn: "none",
        now: "2026-06-20T00:00:00.000Z",
        crawl: {
          startUrl: "https://example.com/",
          maxUrls: 1,
          respectRobotsTxt: true
        }
      },
      createIo({ "catalog.yaml": createCatalog() }),
      createFetcher({
        "https://example.com/robots.txt": {
          url: "https://example.com/robots.txt",
          statusCode: 200,
          headers: { "content-type": "text/plain" },
          body: "User-agent: *\nAllow: /\n"
        },
        "https://example.com/": html(`<html><body></body></html>`)
      })
    );

    expect(result.diagnostics.map((item) => item.ruleId)).not.toContain(
      "SL-ROBOTS-001"
    );
    expect(result.diagnostics.map((item) => item.ruleId)).toContain(
      "SL-ROBOTS-009"
    );
  });

  it("attaches crawled sitemap artifacts to page snapshots", async () => {
    const result = await analyzeCrawl(
      {
        catalogPath: "catalog.yaml",
        format: "json",
        failOn: "none",
        now: "2026-06-20T00:00:00.000Z",
        crawl: {
          startUrl: "https://example.com/",
          maxUrls: 1,
          respectRobotsTxt: true
        }
      },
      createIo({ "catalog.yaml": createCatalog() }),
      createFetcher({
        "https://example.com/robots.txt": {
          url: "https://example.com/robots.txt",
          statusCode: 200,
          headers: { "content-type": "text/plain" },
          body: "User-agent: *\nAllow: /\nSitemap: https://example.com/sitemap.xml\n"
        },
        "https://example.com/sitemap.xml": {
          url: "https://example.com/sitemap.xml",
          statusCode: 200,
          headers: { "content-type": "application/xml" },
          body: `<?xml version="1.0" encoding="UTF-8"?>
<urlset>
  <url>
    <loc>https://example.com/</loc>
    <lastmod>2026-06-19</lastmod>
  </url>
</urlset>`
        },
        "https://example.com/": html(`<html><body></body></html>`)
      })
    );

    const ruleIds = result.diagnostics.map((item) => item.ruleId);
    expect(ruleIds).not.toContain("SL-ROBOTS-004");
    expect(ruleIds).not.toContain("SL-ROBOTS-005");
    expect(ruleIds).not.toContain("SL-ROBOTS-006");
  });
});

function createIo(
  files: Readonly<Record<string, string>>,
  supportExists = false
): CliIo {
  const io: CliIo = {
    async readText(path: string): Promise<string> {
      const content = files[path];
      if (content === undefined) {
        throw new Error(`Missing test file ${path}`);
      }
      return content;
    }
  };

  if (supportExists) {
    io.exists = async (path: string): Promise<boolean> =>
      files[path] !== undefined;
  }

  return io;
}

function createFetcher(responses: Readonly<Record<string, CrawlResponse>>) {
  const fetcher: CrawlerFetcher = {
    async fetch(url: string): Promise<CrawlResponse> {
      const found = responses[url];
      if (!found) {
        throw new Error(`Unexpected fetch ${url}`);
      }
      return { ...found, url };
    }
  };
  return fetcher;
}

function html(body: string): CrawlResponse {
  return {
    url: "https://example.com/",
    statusCode: 200,
    headers: { "content-type": "text/html" },
    body
  };
}

function createCatalog(): string {
  const categories = Object.entries(localRuleIdsByCategory)
    .map(
      ([id, rules]) => `  - id: ${id}
    title: ${id}
    targetCount: ${rules.length}`
    )
    .join("\n");

  const rules = Object.entries(localRuleIdsByCategory)
    .flatMap(([category, ids]) =>
      ids.map(
        (id) => `  - id: ${id}
    name: ${id.toLowerCase()}
    category: ${category}
    defaultSeverity: ${id === "SL-META-009" || id === "SL-META-010" || id === "SL-SCHEMA-010" || id === "SL-IMG-009" || id === "SL-IMG-012" || id === "SL-PERF-005" || id === "SL-PERF-006" ? "info" : id === "SL-PERF-001" || id === "SL-PERF-002" || id === "SL-PERF-003" || id === "SL-INDEX-013" || id === "SL-SCHEMA-007" || id === "SL-CANON-005" || id === "SL-IMG-005" || id === "SL-IMG-008" || id === "SL-ROBOTS-004" || id === "SL-ROBOTS-008" || id === "SL-ROBOTS-010" ? "warning" : id === "SL-HTTP-002" || id === "SL-INDEX-006" || id === "SL-INDEX-009" || id === "SL-SCHEMA-001" || id === "SL-SCHEMA-003" || id === "SL-CANON-003" || id === "SL-CANON-004" || id === "SL-CANON-012" || id === "SL-CANON-013" || id === "SL-IMG-002" || id === "SL-IMG-003" || id === "SL-IMG-010" || id === "SL-ROBOTS-001" || id === "SL-ROBOTS-002" || id === "SL-ROBOTS-003" || id === "SL-ROBOTS-005" || id === "SL-ROBOTS-006" ? "error" : "blocker"}
    confidence: certain
    scope: page
    sources: [${id === "SL-SCHEMA-010" ? "google" : id === "SL-INDEX-009" || id === "SL-CANON-012" ? "crawler, raw-html, http-header" : id === "SL-CANON-004" || id === "SL-CANON-005" || id === "SL-CANON-013" ? "crawler, http-header" : id === "SL-IMG-002" || id === "SL-IMG-005" || id === "SL-IMG-009" || id === "SL-IMG-010" ? "http-header, raw-html" : id === "SL-IMG-008" ? "http-header, rendered-dom" : id === "SL-IMG-012" ? "source-code, rendered-dom" : "raw-html, rendered-dom, http-header"}]
    providerScope: ${id === "SL-SCHEMA-010" ? "google" : "core"}
    description: "Generated catalog entry for ${id}."
    checkingAlgorithm: "Run deterministic local rule."
    requiredEvidence: [evidence]
    fix: "Fix the observed issue."
    testExamples: [fixtures/${id}]
    documentation: docs/rules/${id}.md
    version: 1.0.0`
      )
    )
    .join("\n");

  return `version: 1
status: defined
source: test
targetRuleCount: ${Object.values(localRuleIdsByCategory).flat().length}
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
${categories}
rules:
${rules}
`;
}

const localRuleIdsByCategory = {
  "http-rendering": [
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
    "SL-HTTP-012"
  ],
  indexability: [
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
  ],
  "title-metadata": [
    "SL-META-001",
    "SL-META-002",
    "SL-META-003",
    "SL-META-004",
    "SL-META-005",
    "SL-META-006",
    "SL-META-007",
    "SL-META-008",
    "SL-META-009",
    "SL-META-010",
    "SL-META-011",
    "SL-META-012",
    "SL-META-013",
    "SL-META-014",
    "SL-META-015",
    "SL-META-016",
    "SL-META-017",
    "SL-META-018"
  ],
  "canonical-hreflang": [
    "SL-CANON-001",
    "SL-CANON-002",
    "SL-CANON-003",
    "SL-CANON-004",
    "SL-CANON-005",
    "SL-CANON-006",
    "SL-CANON-007",
    "SL-CANON-008",
    "SL-CANON-009",
    "SL-CANON-010",
    "SL-CANON-011",
    "SL-CANON-012",
    "SL-CANON-013",
    "SL-CANON-014",
    "SL-CANON-015",
    "SL-CANON-016"
  ],
  "headings-structure": [
    "SL-HEAD-001",
    "SL-HEAD-002",
    "SL-HEAD-003",
    "SL-HEAD-004",
    "SL-HEAD-005",
    "SL-HEAD-006",
    "SL-HEAD-007",
    "SL-HEAD-008"
  ],
  "images-social-preview": [
    "SL-IMG-001",
    "SL-IMG-002",
    "SL-IMG-003",
    "SL-IMG-004",
    "SL-IMG-005",
    "SL-IMG-006",
    "SL-IMG-007",
    "SL-IMG-008",
    "SL-IMG-009",
    "SL-IMG-010",
    "SL-IMG-011",
    "SL-IMG-012"
  ],
  "schema-org": [
    "SL-SCHEMA-001",
    "SL-SCHEMA-002",
    "SL-SCHEMA-003",
    "SL-SCHEMA-004",
    "SL-SCHEMA-005",
    "SL-SCHEMA-006",
    "SL-SCHEMA-007",
    "SL-SCHEMA-008",
    "SL-SCHEMA-009",
    "SL-SCHEMA-010"
  ],
  "links-site-graph": [
    "SL-LINK-001",
    "SL-LINK-002",
    "SL-LINK-003",
    "SL-LINK-004",
    "SL-LINK-005",
    "SL-LINK-006",
    "SL-LINK-007",
    "SL-LINK-008",
    "SL-LINK-009",
    "SL-LINK-010",
    "SL-LINK-011",
    "SL-LINK-012",
    "SL-LINK-013",
    "SL-LINK-014"
  ],
  "robots-sitemap": [
    "SL-ROBOTS-001",
    "SL-ROBOTS-002",
    "SL-ROBOTS-003",
    "SL-ROBOTS-004",
    "SL-ROBOTS-005",
    "SL-ROBOTS-006",
    "SL-ROBOTS-007",
    "SL-ROBOTS-008",
    "SL-ROBOTS-009",
    "SL-ROBOTS-010"
  ],
  "performance-technical": [
    "SL-PERF-001",
    "SL-PERF-002",
    "SL-PERF-003",
    "SL-PERF-004",
    "SL-PERF-005",
    "SL-PERF-006"
  ]
} as const;
