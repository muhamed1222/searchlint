#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const reportPath = path.join(
  repoRoot,
  "reports/core-rule-engine-performance-report.json"
);
const samplePath = path.join(
  repoRoot,
  "docs/examples/core-rule-engine-performance-report.sample.json"
);
const fixedGeneratedAt = "2026-06-22T00:00:00.000Z";
const snapshotCount = 100;
const thresholds = {
  maxTotalElapsedMs: 10_000,
  maxAveragePerSnapshotMs: 100,
  maxHeapDeltaBytes: 96 * 1024 * 1024
};

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    env: { ...process.env, ...options.env },
    encoding: "utf8",
    stdio: options.stdio ?? "pipe"
  });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  run("pnpm", ["build"], { stdio: "inherit" });

  const core = await import("../packages/core/dist/src/index.js");
  const catalogText = await readFile(
    path.join(repoRoot, "specs/RULE_CATALOG.yaml"),
    "utf8"
  );
  const registry = core.createRuleCatalogRegistry(
    core.parseRuleCatalogYaml(catalogText)
  );
  const rules = [
    ...core.createCoreHttpAndIndexabilityRules(registry),
    ...core.createCoreTitleMetadataRules(registry),
    ...core.createCoreCanonicalHreflangRules(registry),
    ...core.createCoreStructuralMediaSchemaLinkRules(registry),
    ...core.createCoreRobotsSitemapPerformanceRules(registry)
  ];

  assert(
    rules.length === 120,
    `expected 120 built-in rules, got ${rules.length}`
  );

  globalThis.gc?.();
  const heapBeforeBytes = process.memoryUsage().heapUsed;
  const start = process.hrtime.bigint();
  let totalDiagnostics = 0;
  let executedRuleCount = 0;

  for (let index = 0; index < snapshotCount; index += 1) {
    const result = await core.runRuleEngine({
      snapshot: createSnapshot(index),
      options: { now: fixedGeneratedAt },
      rules
    });
    totalDiagnostics += result.diagnostics.length;
    executedRuleCount += result.executedRuleIds.length;
  }

  const elapsedMs = Number(process.hrtime.bigint() - start) / 1_000_000;
  globalThis.gc?.();
  const heapAfterBytes = process.memoryUsage().heapUsed;
  const heapDeltaBytes = Math.max(0, heapAfterBytes - heapBeforeBytes);
  const averagePerSnapshotMs = elapsedMs / snapshotCount;
  const gates = {
    allRulesLoaded: rules.length === 120,
    allRulesExecutedPerSnapshot:
      executedRuleCount === rules.length * snapshotCount,
    elapsedWithinThreshold: elapsedMs <= thresholds.maxTotalElapsedMs,
    averageWithinThreshold:
      averagePerSnapshotMs <= thresholds.maxAveragePerSnapshotMs,
    heapWithinThreshold: heapDeltaBytes <= thresholds.maxHeapDeltaBytes
  };
  const status = Object.values(gates).every(Boolean) ? "passed" : "failed";
  const report = {
    generatedBy: "searchlint-core-rule-engine-performance-verifier",
    generatedAt: new Date().toISOString(),
    status,
    benchmark: {
      catalogPath: "specs/RULE_CATALOG.yaml",
      ruleCount: rules.length,
      snapshotCount,
      totalRuleExecutions: executedRuleCount,
      totalDiagnostics,
      elapsedMs,
      averagePerSnapshotMs,
      heapBeforeBytes,
      heapAfterBytes,
      heapDeltaBytes
    },
    thresholds,
    gates
  };
  const sample = {
    generatedBy: report.generatedBy,
    generatedAt: fixedGeneratedAt,
    status,
    benchmark: {
      catalogPath: report.benchmark.catalogPath,
      ruleCount: report.benchmark.ruleCount,
      snapshotCount: report.benchmark.snapshotCount,
      totalRuleExecutions: report.benchmark.totalRuleExecutions,
      totalDiagnostics: "generated-report-only",
      elapsedMs: "generated-report-only",
      averagePerSnapshotMs: "generated-report-only",
      heapBeforeBytes: "generated-report-only",
      heapAfterBytes: "generated-report-only",
      heapDeltaBytes: "generated-report-only"
    },
    thresholds,
    gates
  };

  await mkdir(path.dirname(reportPath), { recursive: true });
  await mkdir(path.dirname(samplePath), { recursive: true });
  await writeJson(reportPath, report);
  await writeJson(samplePath, sample);

  assert(status === "passed", "core rule engine performance benchmark failed");

  console.log(
    `Core rule engine performance PASS: ${rules.length} rules x ${snapshotCount} snapshots, ${averagePerSnapshotMs.toFixed(2)} ms/snapshot, heap delta ${heapDeltaBytes} bytes`
  );
  console.log(`Report: ${path.relative(repoRoot, reportPath)}`);
  console.log(`Sample: ${path.relative(repoRoot, samplePath)}`);
}

function createSnapshot(index) {
  const url = `https://example.com/products/widget-${index}`;
  const route = "/products/[slug]";
  const canonical = url;
  const links = Array.from({ length: 40 }, (_, linkIndex) => ({
    sourceUrl: url,
    targetUrl: `https://example.com/products/related-${linkIndex}`,
    text: `Related ${linkIndex}`
  }));
  const pages = Array.from({ length: 40 }, (_, pageIndex) => ({
    url: `https://example.com/products/related-${pageIndex}`,
    statusCode: 200,
    finalUrl: `https://example.com/products/related-${pageIndex}`,
    canonicalUrl: `https://example.com/products/related-${pageIndex}`,
    title: `Related ${pageIndex}`,
    description: `Related product ${pageIndex}`,
    indexable: true,
    crawlDepth: pageIndex % 5,
    important: pageIndex % 7 === 0
  }));

  return {
    pageUrl: url,
    route,
    capturedAt: fixedGeneratedAt,
    http: {
      statusCode: 200,
      finalUrl: url,
      redirectChain: [],
      headers: {
        "content-type": "text/html; charset=utf-8",
        "x-robots-tag": "index, follow"
      }
    },
    rawHtml: [
      "<!doctype html><html><head>",
      `<title>Widget ${index}</title>`,
      `<meta name="description" content="Buy widget ${index} today">`,
      `<link rel="canonical" href="${canonical}">`,
      '<meta property="og:title" content="Widget">',
      '<meta property="og:image" content="https://example.com/og/widget.png">',
      '<script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"Widget"}</script>',
      "</head><body>",
      "<main><h1>Widget</h1>",
      Array.from(
        { length: 25 },
        (_, imageIndex) =>
          `<img src="/images/${imageIndex}.jpg" alt="Widget image ${imageIndex}" width="800" height="600">`
      ).join(""),
      links
        .map((link) => `<a href="${link.targetUrl}">${link.text}</a>`)
        .join(""),
      "</main></body></html>"
    ].join(""),
    renderedDom: [
      "<html><head>",
      `<title>Widget ${index}</title>`,
      `<meta name="description" content="Buy widget ${index} today">`,
      `<link rel="canonical" href="${canonical}">`,
      "</head><body><main><h1>Widget</h1></main></body></html>"
    ].join(""),
    robotsTxt: {
      url: "https://example.com/robots.txt",
      statusCode: 200,
      contentType: "text/plain",
      body: "User-agent: *\nAllow: /\nSitemap: https://example.com/sitemap.xml\n"
    },
    sitemap: {
      url: "https://example.com/sitemap.xml",
      statusCode: 200,
      contentType: "application/xml",
      body: '<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>'
    },
    resolvedUrls: pages.map((page) => ({
      url: page.url,
      statusCode: page.statusCode,
      finalUrl: page.finalUrl,
      headers: { "content-type": "text/html" },
      redirectChain: []
    })),
    siteGraph: {
      pages: [
        {
          url,
          statusCode: 200,
          finalUrl: url,
          canonicalUrl: canonical,
          title: `Widget ${index}`,
          description: `Buy widget ${index} today`,
          indexable: true,
          crawlDepth: 1,
          important: true,
          hreflangLinks: [
            { hreflang: "en", url },
            { hreflang: "x-default", url }
          ],
          assetUrls: ["/images/0.jpg", "/images/1.jpg"]
        },
        ...pages
      ],
      links,
      internalNofollowPolicyMaxRatio: 0.25,
      internalNofollowPolicyMaxCount: 10
    },
    metadataTiming: {
      availableAtMs: 80,
      policyMaxMs: 250
    },
    externalObservations: [
      {
        provider: "google",
        observedAt: fixedGeneratedAt,
        fetchedAt: fixedGeneratedAt,
        freshness: "fresh",
        indexability: { indexed: true, state: "INDEXING_ALLOWED" },
        canonical: { googleSelected: canonical, userDeclared: canonical },
        richResults: { available: true, state: "eligible" },
        webVitals: {
          lcp: { value: 1800, unit: "ms", dataSource: "crux", rating: "good" },
          cls: {
            value: 0.04,
            unit: "score",
            dataSource: "crux",
            rating: "good"
          },
          inp: { value: 120, unit: "ms", dataSource: "crux", rating: "good" }
        }
      },
      {
        provider: "yandex",
        observedAt: fixedGeneratedAt,
        fetchedAt: fixedGeneratedAt,
        freshness: "fresh",
        indexability: { indexed: true, searchable: true, state: "SEARCHABLE" },
        sampling: { sampled: false }
      }
    ],
    sourceCode: {
      files: [
        {
          path: "app/products/[slug]/page.tsx",
          content: "export const metadata = { title: 'Widget' };"
        }
      ],
      findings: [
        {
          kind: "static-metadata-object",
          file: "app/products/[slug]/page.tsx",
          location: {
            confidence: "EXACT",
            file: "app/products/[slug]/page.tsx",
            line: 1
          },
          router: "app",
          route
        }
      ],
      routeMetadata: [
        {
          route,
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
      routeSocialImages: [
        {
          route,
          router: "app",
          openGraphImageFiles: ["app/products/[slug]/opengraph-image.tsx"],
          twitterImageFiles: ["app/products/[slug]/twitter-image.tsx"]
        }
      ]
    }
  };
}

async function writeJson(filePath, data) {
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
