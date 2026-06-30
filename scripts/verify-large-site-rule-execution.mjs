#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const generatedAt = "2026-06-22T00:00:00.000Z";
const reportPath = path.join(
  repoRoot,
  "reports/large-site-rule-execution-report.json"
);
const samplePath = path.join(
  repoRoot,
  "docs/examples/large-site-rule-execution-report.sample.json"
);
const thresholds = {
  minScenarioCount: 3,
  minTotalSitePages: 10_000,
  minTotalSiteLinks: 40_000,
  maxTotalElapsedMs: 60_000,
  maxAverageElapsedMs: 25_000,
  maxHeapDeltaBytes: 160 * 1024 * 1024
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

  const scenarios = [
    createLargeSiteScenario({
      id: "large-docs-site",
      baseUrl: "https://docs.example.test/",
      routePrefix: "/docs",
      pageCount: 4_000,
      linksPerPage: 4,
      importantEvery: 11,
      pageType: "Documentation"
    }),
    createLargeSiteScenario({
      id: "large-ecommerce",
      baseUrl: "https://shop.example.test/",
      routePrefix: "/products",
      pageCount: 3_500,
      linksPerPage: 5,
      importantEvery: 7,
      pageType: "Product"
    }),
    createLargeSiteScenario({
      id: "large-publisher",
      baseUrl: "https://publisher.example.test/",
      routePrefix: "/articles",
      pageCount: 3_000,
      linksPerPage: 3,
      importantEvery: 9,
      pageType: "Article"
    })
  ];

  globalThis.gc?.();
  const heapBeforeBytes = process.memoryUsage().heapUsed;
  const startedAt = process.hrtime.bigint();
  const scenarioResults = [];

  for (const scenario of scenarios) {
    const scenarioStartedAt = process.hrtime.bigint();
    const result = await core.runRuleEngine({
      snapshot: scenario.snapshot,
      options: { now: generatedAt },
      rules
    });
    const elapsedMs =
      Number(process.hrtime.bigint() - scenarioStartedAt) / 1_000_000;
    assert(
      result.executedRuleIds.length === rules.length,
      `${scenario.id} executed ${result.executedRuleIds.length} rules instead of ${rules.length}`
    );
    scenarioResults.push(toScenarioResult(scenario, result, elapsedMs));
  }

  const totalElapsedMs =
    Number(process.hrtime.bigint() - startedAt) / 1_000_000;
  globalThis.gc?.();
  const heapAfterBytes = process.memoryUsage().heapUsed;
  const heapDeltaBytes = Math.max(0, heapAfterBytes - heapBeforeBytes);
  const totalSitePages = scenarioResults.reduce(
    (total, entry) => total + entry.sitePageCount,
    0
  );
  const totalSiteLinks = scenarioResults.reduce(
    (total, entry) => total + entry.siteLinkCount,
    0
  );
  const totalRuleExecutions = scenarioResults.length * rules.length;
  const totalDiagnostics = scenarioResults.reduce(
    (total, entry) => total + entry.diagnosticCount,
    0
  );
  const averageElapsedMs = totalElapsedMs / scenarioResults.length;
  const gates = {
    allRulesLoaded: rules.length === 120,
    enoughScenarios: scenarioResults.length >= thresholds.minScenarioCount,
    enoughSitePages: totalSitePages >= thresholds.minTotalSitePages,
    enoughSiteLinks: totalSiteLinks >= thresholds.minTotalSiteLinks,
    allRulesExecutedForEveryScenario: scenarioResults.every(
      (entry) => entry.executedRuleCount === rules.length
    ),
    elapsedWithinThreshold: totalElapsedMs <= thresholds.maxTotalElapsedMs,
    averageWithinThreshold: averageElapsedMs <= thresholds.maxAverageElapsedMs,
    heapWithinThreshold: heapDeltaBytes <= thresholds.maxHeapDeltaBytes
  };
  const status = Object.values(gates).every(Boolean) ? "passed" : "failed";
  const report = {
    schemaVersion: 1,
    generatedBy: "searchlint-large-site-rule-execution-verifier",
    generatedAt,
    status,
    methodology: {
      scenarioType: "deterministic-synthetic-large-site-graphs",
      liveNetworkAccess: "not used by verifier",
      purpose:
        "local acceptance for all 120 shared core rules on large site-shaped snapshots"
    },
    thresholds,
    summary: {
      scenarioCount: scenarioResults.length,
      ruleCount: rules.length,
      totalRuleExecutions,
      totalSitePages,
      totalSiteLinks,
      totalDiagnostics,
      totalElapsedMs,
      averageElapsedMs,
      heapBeforeBytes,
      heapAfterBytes,
      heapDeltaBytes
    },
    scenarios: scenarioResults,
    gates
  };

  await mkdir(path.dirname(reportPath), { recursive: true });
  await mkdir(path.dirname(samplePath), { recursive: true });
  await writeJson(reportPath, report);
  await writeJson(samplePath, sanitizeReport(report));

  assert(status === "passed", "large-site rule execution verification failed");

  console.log(
    `Large-site rule execution PASS: ${scenarioResults.length} scenarios, ${rules.length} rules, ${totalSitePages} pages, ${totalSiteLinks} links, ${totalRuleExecutions} rule executions`
  );
  console.log(`Report: ${path.relative(repoRoot, reportPath)}`);
  console.log(`Sample: ${path.relative(repoRoot, samplePath)}`);
}

function createLargeSiteScenario(options) {
  const base = new URL(options.baseUrl);
  const canonical = new URL(`${options.routePrefix}/page-0`, base).toString();
  const pages = Array.from({ length: options.pageCount }, (_, index) => {
    const url = new URL(
      `${options.routePrefix}/page-${index}`,
      base
    ).toString();
    return {
      url,
      statusCode: 200,
      finalUrl: url,
      canonicalUrl: url,
      hreflangLinks: [
        { hreflang: "en", url },
        { hreflang: "x-default", url }
      ],
      assetUrls: [
        new URL(`/assets/${options.id}-${index % 50}.jpg`, base).toString()
      ],
      title: `${options.pageType} ${index}`,
      description: `${options.pageType} page ${index}`,
      indexable: true,
      crawlDepth: index % 8,
      important: index % options.importantEvery === 0,
      crawlDepthPolicyMax: 8
    };
  });
  const links = pages.flatMap((page, index) =>
    Array.from({ length: options.linksPerPage }, (_, offset) => {
      const target = pages[(index + offset + 1) % pages.length];
      return {
        sourceUrl: page.url,
        targetUrl: target.url,
        text: `${options.pageType} related ${offset}`
      };
    })
  );
  const resolvedUrls = pages.slice(0, 500).map((page) => ({
    url: page.url,
    statusCode: 200,
    finalUrl: page.finalUrl,
    headers: { "content-type": "text/html; charset=utf-8" },
    redirectChain: [],
    capturedAt: generatedAt
  }));
  const snapshot = {
    pageUrl: canonical,
    route: `${options.routePrefix}/[slug]`,
    capturedAt: generatedAt,
    http: {
      statusCode: 200,
      finalUrl: canonical,
      redirectChain: [],
      headers: {
        "content-type": "text/html; charset=utf-8",
        "x-robots-tag": "index, follow"
      }
    },
    rawHtml: htmlDocument(options, canonical),
    renderedDom: htmlDocument(options, canonical),
    robotsTxt: {
      url: new URL("/robots.txt", base).toString(),
      statusCode: 200,
      contentType: "text/plain",
      body: `User-agent: *\nAllow: /\nSitemap: ${new URL("/sitemap.xml", base).toString()}\n`
    },
    sitemap: {
      url: new URL("/sitemap.xml", base).toString(),
      statusCode: 200,
      contentType: "application/xml",
      body: sitemapBody(pages.slice(0, 1_000))
    },
    resolvedUrls,
    siteGraph: {
      pages,
      links,
      internalNofollowPolicyMaxRatio: 0.25,
      internalNofollowPolicyMaxCount: 10
    },
    metadataTiming: {
      availableAtMs: 100,
      policyMaxMs: 250
    }
  };

  return {
    id: options.id,
    baseUrl: options.baseUrl,
    shape: {
      pageCount: pages.length,
      linkCount: links.length,
      resolvedUrlCount: resolvedUrls.length,
      linksPerPage: options.linksPerPage
    },
    snapshot
  };
}

function htmlDocument(options, canonical) {
  const title = `${options.pageType} index`;
  const description = `${options.pageType} index page for large-site rule execution.`;
  const image = new URL(
    `/assets/${options.id}.jpg`,
    options.baseUrl
  ).toString();
  return [
    '<!doctype html><html lang="en"><head>',
    '<meta charset="utf-8">',
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(description)}">`,
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="robots" content="index, follow">',
    `<link rel="canonical" href="${escapeHtml(canonical)}">`,
    `<link rel="alternate" hreflang="en" href="${escapeHtml(canonical)}">`,
    `<link rel="alternate" hreflang="x-default" href="${escapeHtml(canonical)}">`,
    `<meta property="og:title" content="${escapeHtml(title)}">`,
    `<meta property="og:description" content="${escapeHtml(description)}">`,
    `<meta property="og:url" content="${escapeHtml(canonical)}">`,
    `<meta property="og:image" content="${escapeHtml(image)}">`,
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${escapeHtml(title)}">`,
    `<meta name="twitter:image" content="${escapeHtml(image)}">`,
    `<script type="application/ld+json">{"@context":"https://schema.org","@type":"${options.pageType}","name":"${escapeJson(title)}"}</script>`,
    "</head><body>",
    `<main><h1>${escapeHtml(title)}</h1>`,
    `<p>${escapeHtml(description)}</p>`,
    `<img src="${escapeHtml(image)}" alt="${escapeHtml(title)}" width="1200" height="630">`,
    "</main></body></html>"
  ].join("");
}

function sitemapBody(pages) {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...pages.map((page) => `<url><loc>${escapeXml(page.url)}</loc></url>`),
    "</urlset>"
  ].join("");
}

function toScenarioResult(scenario, result, elapsedMs) {
  const diagnostics = result.diagnostics.map((diagnostic) => ({
    ruleId: diagnostic.ruleId,
    severity: diagnostic.severity,
    confidence: diagnostic.confidence,
    source: diagnostic.source,
    fingerprint: diagnostic.fingerprint,
    evidenceHash: sha256(diagnostic.evidence)
  }));
  return {
    id: scenario.id,
    baseUrl: scenario.baseUrl,
    sitePageCount: scenario.shape.pageCount,
    siteLinkCount: scenario.shape.linkCount,
    resolvedUrlCount: scenario.shape.resolvedUrlCount,
    executedRuleCount: result.executedRuleIds.length,
    diagnosticCount: diagnostics.length,
    elapsedMs,
    emittedRuleIds: [
      ...new Set(diagnostics.map((entry) => entry.ruleId))
    ].sort(),
    fingerprintDigest: sha256(
      diagnostics
        .map((entry) => entry.fingerprint)
        .sort()
        .join("\n")
    ),
    diagnostics
  };
}

function sanitizeReport(report) {
  return {
    ...report,
    summary: {
      ...report.summary,
      totalElapsedMs: "generated-report-only",
      averageElapsedMs: "generated-report-only",
      heapBeforeBytes: "generated-report-only",
      heapAfterBytes: "generated-report-only",
      heapDeltaBytes: "generated-report-only"
    },
    scenarios: report.scenarios.map((scenario) => ({
      ...scenario,
      elapsedMs: "generated-report-only",
      diagnostics: scenario.diagnostics.map((diagnostic) => ({
        ...diagnostic,
        fingerprint: "generated-report-only"
      }))
    }))
  };
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeXml(value) {
  return escapeHtml(value).replaceAll("'", "&apos;");
}

function escapeJson(value) {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

async function writeJson(filePath, data) {
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
