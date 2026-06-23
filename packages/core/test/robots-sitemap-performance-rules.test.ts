import { describe, expect, it } from "vitest";

import {
  createCoreRobotsSitemapPerformanceRules,
  createRuleCatalogRegistry,
  parseRuleCatalogYaml,
  runRuleEngine
} from "../src/index.js";
import type { PageSnapshot } from "../src/index.js";

const ruleIds = [
  [
    "SL-ROBOTS-001",
    "robots-txt-unavailable",
    "error",
    "certain",
    "robots-sitemap"
  ],
  [
    "SL-ROBOTS-002",
    "robots-syntax-error",
    "error",
    "certain",
    "robots-sitemap"
  ],
  [
    "SL-ROBOTS-003",
    "robots-disallows-sitemap-url",
    "error",
    "certain",
    "robots-sitemap"
  ],
  ["SL-ROBOTS-004", "sitemap-missing", "warning", "certain", "robots-sitemap"],
  [
    "SL-ROBOTS-005",
    "sitemap-non-success",
    "error",
    "certain",
    "robots-sitemap"
  ],
  [
    "SL-ROBOTS-006",
    "sitemap-invalid-xml",
    "error",
    "certain",
    "robots-sitemap"
  ],
  [
    "SL-ROBOTS-007",
    "sitemap-url-non-success",
    "error",
    "certain",
    "robots-sitemap"
  ],
  [
    "SL-ROBOTS-008",
    "sitemap-canonical-mismatch",
    "warning",
    "certain",
    "robots-sitemap"
  ],
  [
    "SL-ROBOTS-009",
    "robots-missing-sitemap-directive",
    "info",
    "certain",
    "robots-sitemap"
  ],
  [
    "SL-ROBOTS-010",
    "sitemap-lastmod-future",
    "warning",
    "certain",
    "robots-sitemap"
  ],
  [
    "SL-PERF-001",
    "google-lcp-poor",
    "warning",
    "certain",
    "performance-technical"
  ],
  [
    "SL-PERF-002",
    "google-cls-poor",
    "warning",
    "certain",
    "performance-technical"
  ],
  [
    "SL-PERF-003",
    "google-inp-poor",
    "warning",
    "certain",
    "performance-technical"
  ],
  [
    "SL-PERF-004",
    "metadata-render-delay-over-policy",
    "info",
    "heuristic",
    "performance-technical"
  ],
  [
    "SL-PERF-005",
    "html-size-over-guidance",
    "info",
    "heuristic",
    "performance-technical"
  ],
  [
    "SL-PERF-006",
    "external-observation-sampled",
    "info",
    "certain",
    "performance-technical"
  ]
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
  - id: robots-sitemap
    title: robots-sitemap
    targetCount: 10
  - id: performance-technical
    title: performance-technical
    targetCount: 6
rules:
${ruleIds
  .map(
    ([id, name, severity, confidence, category]) => `  - id: ${id}
    name: ${name}
    category: ${category}
    defaultSeverity: ${severity}
    confidence: ${confidence}
    scope: page
    sources: ${id === "SL-PERF-001" || id === "SL-PERF-002" || id === "SL-PERF-003" ? "[google]" : id === "SL-PERF-006" ? "[google, yandex]" : "[robots-txt, sitemap, raw-html, http-header]"}
    providerScope: ${id === "SL-PERF-001" || id === "SL-PERF-002" || id === "SL-PERF-003" ? "google" : id === "SL-PERF-006" ? "external" : "core"}
    description: "Test catalog entry for ${name}."
    checkingAlgorithm: "Evaluate robots, sitemap, and local HTML artifacts."
    requiredEvidence: [artifact]
    fix: "Update robots, sitemap, or HTML artifact."
    testExamples: [fixtures/${category}/${name}]
    documentation: docs/rules/${id}.md
    version: 1.0.0`
  )
  .join("\n")}
`;

const observedAt = "2026-06-20T00:00:00.000Z";
const registry = createRuleCatalogRegistry(parseRuleCatalogYaml(catalog));
const rules = createCoreRobotsSitemapPerformanceRules(registry);

function cleanSitemap(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset>
  <url>
    <loc>https://example.com/</loc>
    <lastmod>2026-06-19</lastmod>
  </url>
</urlset>`;
}

function snapshot(overrides: Partial<PageSnapshot> = {}): PageSnapshot {
  return {
    pageUrl: "https://example.com/",
    capturedAt: observedAt,
    rawHtml: "<html><head><title>Home</title></head><body></body></html>",
    robotsTxt: {
      url: "https://example.com/robots.txt",
      statusCode: 200,
      body: "User-agent: *\nAllow: /\nSitemap: https://example.com/sitemap.xml\n"
    },
    sitemap: {
      url: "https://example.com/sitemap.xml",
      statusCode: 200,
      body: cleanSitemap()
    },
    ...overrides
  };
}

async function run(page: PageSnapshot) {
  return runRuleEngine({
    rules,
    snapshot: page,
    options: { now: observedAt }
  });
}

describe("createCoreRobotsSitemapPerformanceRules", () => {
  it("creates catalog-backed rules in deterministic ID order", () => {
    expect(rules.map((rule) => rule.id)).toEqual(ruleIds.map(([id]) => id));
  });

  it("emits no diagnostics for clean robots, sitemap, and local HTML", async () => {
    const result = await run(snapshot());

    expect(result.diagnostics).toEqual([]);
  });

  it("detects unavailable robots.txt and robots syntax errors", async () => {
    const unavailable = await run(
      snapshot({
        robotsTxt: {
          url: "https://example.com/robots.txt",
          statusCode: 404,
          body: "User-agent: *\n"
        }
      })
    );
    expect(
      unavailable.diagnostics.map((diagnostic) => diagnostic.ruleId)
    ).toContain("SL-ROBOTS-001");

    const syntax = await run(
      snapshot({
        robotsTxt: {
          url: "https://example.com/robots.txt",
          statusCode: 200,
          body: "User-agent: *\nBrokenDirective /\n"
        }
      })
    );
    expect(syntax.diagnostics.map((diagnostic) => diagnostic.ruleId)).toContain(
      "SL-ROBOTS-002"
    );
  });

  it("detects missing sitemap and missing robots Sitemap directive", async () => {
    const result = await run({
      pageUrl: "https://example.com/",
      capturedAt: observedAt,
      rawHtml: "<html><head><title>Home</title></head><body></body></html>",
      robotsTxt: {
        url: "https://example.com/robots.txt",
        statusCode: 200,
        body: "User-agent: *\nAllow: /\n"
      }
    });

    expect(result.diagnostics.map((diagnostic) => diagnostic.ruleId)).toEqual(
      expect.arrayContaining(["SL-ROBOTS-004", "SL-ROBOTS-009"])
    );
  });

  it("uses Next sitemap source findings for robots Sitemap directive evidence", async () => {
    const result = await run({
      pageUrl: "https://example.com/",
      capturedAt: observedAt,
      rawHtml: "<html><head><title>Home</title></head><body></body></html>",
      robotsTxt: {
        url: "https://example.com/robots.txt",
        statusCode: 200,
        body: "User-agent: *\nAllow: /\n"
      },
      sourceCode: {
        files: [
          {
            path: "app/sitemap.ts",
            content: "export default function sitemap() { return []; }"
          }
        ],
        findings: [
          {
            kind: "sitemap-file",
            file: "app/sitemap.ts",
            exportName: "sitemap",
            location: {
              confidence: "EXACT",
              file: "app/sitemap.ts",
              line: 1
            }
          }
        ]
      }
    });

    expect(
      result.diagnostics.map((diagnostic) => diagnostic.ruleId)
    ).not.toContain("SL-ROBOTS-004");
    expect(
      result.diagnostics.find(
        (diagnostic) => diagnostic.ruleId === "SL-ROBOTS-009"
      )
    ).toMatchObject({
      source: "source-code",
      sourceLocation: {
        confidence: "EXACT",
        file: "app/sitemap.ts",
        line: 1
      }
    });
  });

  it("detects sitemap status and XML problems", async () => {
    const nonSuccess = await run(
      snapshot({
        sitemap: {
          url: "https://example.com/sitemap.xml",
          statusCode: 500,
          body: cleanSitemap()
        }
      })
    );
    expect(
      nonSuccess.diagnostics.map((diagnostic) => diagnostic.ruleId)
    ).toContain("SL-ROBOTS-005");

    const invalid = await run(
      snapshot({
        sitemap: {
          url: "https://example.com/sitemap.xml",
          statusCode: 200,
          body: "<not-sitemap>"
        }
      })
    );
    expect(
      invalid.diagnostics.map((diagnostic) => diagnostic.ruleId)
    ).toContain("SL-ROBOTS-006");
  });

  it("detects sitemap URLs with non-success observed page status", async () => {
    const result = await run(
      snapshot({
        sitemap: {
          url: "https://example.com/sitemap.xml",
          statusCode: 200,
          body: "<urlset><url><loc>https://example.com/missing</loc></url></urlset>"
        },
        siteGraph: {
          pages: [
            { url: "https://example.com/", statusCode: 200 },
            { url: "https://example.com/missing", statusCode: 404 }
          ],
          links: []
        }
      })
    );

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        ruleId: "SL-ROBOTS-007",
        source: "sitemap",
        expected: "2xx HTTP status",
        actual: "404"
      })
    );
  });

  it("detects robots.txt disallowing the current sitemap URL", async () => {
    const result = await run(
      snapshot({
        pageUrl: "https://example.com/private/page",
        robotsTxt: {
          url: "https://example.com/robots.txt",
          statusCode: 200,
          body: "User-agent: *\nDisallow: /private\nSitemap: https://example.com/sitemap.xml\n"
        },
        sitemap: {
          url: "https://example.com/sitemap.xml",
          statusCode: 200,
          body: "<urlset><url><loc>https://example.com/private/page</loc></url></urlset>"
        }
      })
    );

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        ruleId: "SL-ROBOTS-003",
        source: "robots-txt",
        expected: "sitemap URL allowed by robots.txt",
        actual: "Disallow: /private"
      })
    );

    const allowed = await run(
      snapshot({
        pageUrl: "https://example.com/private/page",
        robotsTxt: {
          url: "https://example.com/robots.txt",
          statusCode: 200,
          body: "User-agent: *\nDisallow: /private\nAllow: /private/page\nSitemap: https://example.com/sitemap.xml\n"
        },
        sitemap: {
          url: "https://example.com/sitemap.xml",
          statusCode: 200,
          body: "<urlset><url><loc>https://example.com/private/page</loc></url></urlset>"
        }
      })
    );

    expect(
      allowed.diagnostics.map((diagnostic) => diagnostic.ruleId)
    ).not.toContain("SL-ROBOTS-003");
  });

  it("detects sitemap URL canonical mismatch for current page", async () => {
    const result = await run(
      snapshot({
        pageUrl: "https://example.com/page",
        rawHtml:
          '<html><head><link rel="canonical" href="https://example.com/canonical"></head><body></body></html>',
        sitemap: {
          url: "https://example.com/sitemap.xml",
          statusCode: 200,
          body: "<urlset><url><loc>https://example.com/page</loc></url></urlset>"
        }
      })
    );

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        ruleId: "SL-ROBOTS-008",
        source: "raw-html",
        expected: "https://example.com/page",
        actual: "https://example.com/canonical"
      })
    );

    const aligned = await run(
      snapshot({
        pageUrl: "https://example.com/page",
        rawHtml:
          '<html><head><link rel="canonical" href="https://example.com/page"></head><body></body></html>',
        sitemap: {
          url: "https://example.com/sitemap.xml",
          statusCode: 200,
          body: "<urlset><url><loc>https://example.com/page</loc></url></urlset>"
        }
      })
    );
    expect(
      aligned.diagnostics.map((diagnostic) => diagnostic.ruleId)
    ).not.toContain("SL-ROBOTS-008");
  });

  it("detects future lastmod dates", async () => {
    const result = await run(
      snapshot({
        sitemap: {
          url: "https://example.com/sitemap.xml",
          statusCode: 200,
          body: "<urlset><url><loc>https://example.com/</loc><lastmod>2026-06-21</lastmod></url></urlset>"
        }
      })
    );

    expect(result.diagnostics.map((diagnostic) => diagnostic.ruleId)).toContain(
      "SL-ROBOTS-010"
    );
  });

  it("detects raw HTML size over guidance", async () => {
    const result = await run(
      snapshot({
        rawHtml: `<html>${"x".repeat(500_001)}</html>`
      })
    );

    expect(result.diagnostics.map((diagnostic) => diagnostic.ruleId)).toContain(
      "SL-PERF-005"
    );
  });

  it("detects metadata render delay over explicit policy", async () => {
    const result = await run(
      snapshot({
        metadataTiming: {
          availableAtMs: 250,
          policyMaxMs: 100
        }
      })
    );

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        ruleId: "SL-PERF-004",
        source: "rendered-dom",
        expected: "<= 100ms",
        actual: "250ms"
      })
    );
  });

  it("detects poor Google Web Vitals observations", async () => {
    const result = await run(
      snapshot({
        externalObservations: [
          {
            provider: "google",
            observedAt: "2026-06-19T00:00:00.000Z",
            fetchedAt: "2026-06-20T00:00:00.000Z",
            freshness: "fresh",
            webVitals: {
              lcp: {
                value: 4200,
                unit: "ms",
                dataSource: "crux",
                poorThreshold: 4000
              },
              cls: {
                value: 0.32,
                unit: "score",
                dataSource: "field",
                rating: "poor"
              },
              inp: {
                value: 620,
                unit: "ms",
                dataSource: "pagespeed",
                poorThreshold: 500
              }
            }
          }
        ]
      })
    );

    expect(result.diagnostics.map((diagnostic) => diagnostic.ruleId)).toEqual(
      expect.arrayContaining(["SL-PERF-001", "SL-PERF-002", "SL-PERF-003"])
    );
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        ruleId: "SL-PERF-001",
        source: "google",
        expected: "<= 4000ms",
        actual: "4200ms",
        structuredEvidence: [
          {
            type: "record",
            label: "google LCP observation",
            value: {
              provider: "google",
              metric: "LCP",
              value: 4200,
              unit: "ms",
              dataSource: "crux",
              rating: null,
              poorThreshold: 4000,
              observedAt: "2026-06-19T00:00:00.000Z",
              fetchedAt: "2026-06-20T00:00:00.000Z",
              freshness: "fresh"
            }
          }
        ]
      })
    );
  });

  it("ignores non-poor, non-Google, and incomplete Web Vitals observations", async () => {
    const result = await run(
      snapshot({
        externalObservations: [
          {
            provider: "google",
            observedAt,
            fetchedAt: observedAt,
            freshness: "fresh",
            webVitals: {
              lcp: {
                value: 1800,
                unit: "ms",
                dataSource: "crux",
                rating: "good",
                poorThreshold: 4000
              },
              cls: {
                unit: "score",
                dataSource: "field"
              }
            }
          },
          {
            provider: "yandex",
            observedAt,
            fetchedAt: observedAt,
            freshness: "fresh",
            webVitals: {
              inp: {
                value: 900,
                unit: "ms",
                dataSource: "field",
                rating: "poor"
              }
            }
          }
        ]
      })
    );

    expect(
      result.diagnostics.map((diagnostic) => diagnostic.ruleId)
    ).not.toEqual(
      expect.arrayContaining(["SL-PERF-001", "SL-PERF-002", "SL-PERF-003"])
    );
  });

  it("detects sampled external observations with provider evidence", async () => {
    const result = await run(
      snapshot({
        externalObservations: [
          {
            provider: "yandex",
            observedAt: "2026-06-19T00:00:00.000Z",
            fetchedAt: "2026-06-20T00:00:00.000Z",
            freshness: "fresh",
            sampling: {
              sampled: true,
              state: "sampled-analytics"
            }
          }
        ]
      })
    );

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        ruleId: "SL-PERF-006",
        source: "yandex",
        evidence:
          "yandex observation is 'sampled-analytics' with observedAt '2026-06-19T00:00:00.000Z' and fetchedAt '2026-06-20T00:00:00.000Z'.",
        actual: "sampled-analytics",
        structuredEvidence: [
          {
            type: "record",
            label: "external observation sampling",
            value: {
              provider: "yandex",
              samplingState: "sampled-analytics",
              observedAt: "2026-06-19T00:00:00.000Z",
              fetchedAt: "2026-06-20T00:00:00.000Z",
              freshness: "fresh"
            }
          }
        ]
      })
    );
  });

  it("ignores unsampled observations and missing sampling metadata", async () => {
    const result = await run(
      snapshot({
        externalObservations: [
          {
            provider: "google",
            observedAt,
            fetchedAt: observedAt,
            freshness: "fresh",
            sampling: {
              sampled: false,
              state: "not-sampled"
            }
          },
          {
            provider: "yandex",
            observedAt,
            fetchedAt: observedAt,
            freshness: "unknown"
          }
        ]
      })
    );

    expect(
      result.diagnostics.map((diagnostic) => diagnostic.ruleId)
    ).not.toContain("SL-PERF-006");
  });
});
