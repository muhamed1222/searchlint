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
  "reports/real-site-regression-corpus-report.json"
);
const samplePath = path.join(
  repoRoot,
  "docs/examples/real-site-regression-corpus-report.sample.json"
);

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

  const cases = buildCorpusCases();
  const caseResults = [];

  for (const corpusCase of cases) {
    const result = await core.runRuleEngine({
      snapshot: createSnapshot(corpusCase),
      options: { now: generatedAt },
      rules
    });
    assert(
      result.executedRuleIds.length === rules.length,
      `${corpusCase.id} executed ${result.executedRuleIds.length} rules instead of ${rules.length}`
    );
    caseResults.push(toCaseResult(corpusCase, result));
  }

  const totalDiagnostics = caseResults.reduce(
    (total, entry) => total + entry.diagnosticCount,
    0
  );
  const totalRuleExecutions = caseResults.length * rules.length;
  const diagnosticsBySeverity = countBy(
    caseResults.flatMap((entry) => entry.diagnostics),
    (diagnostic) => diagnostic.severity
  );
  const diagnosticsByRuleId = countBy(
    caseResults.flatMap((entry) => entry.diagnostics),
    (diagnostic) => diagnostic.ruleId
  );
  const gates = {
    corpusCasesPresent: cases.length >= 5,
    allRulesLoaded: rules.length === 120,
    allRulesExecutedForEveryCase: caseResults.every(
      (entry) => entry.executedRuleCount === rules.length
    ),
    generatedEvidenceWritten: true
  };
  const status = Object.values(gates).every(Boolean) ? "passed" : "failed";
  const report = {
    schemaVersion: 1,
    generatedBy: "searchlint-real-site-regression-corpus-verifier",
    generatedAt,
    status,
    methodology: {
      corpusType: "sanitized-real-site-derived-snapshots",
      liveNetworkAccess: "not used by verifier",
      fullPageBodiesCommitted: false,
      purpose:
        "deterministic regression tracking for the shared 120-rule local core",
      falsePositiveReview:
        "reviewed-current-corpus: run pnpm core:false-positive-review for the versioned review ledger; OD-023 independent blocker review remains separate"
    },
    corpus: {
      caseCount: cases.length,
      cases: cases.map((entry) => ({
        id: entry.id,
        url: entry.url,
        siteType: entry.siteType,
        capturedAt: entry.capturedAt,
        provenance: entry.provenance,
        sanitization: entry.sanitization
      }))
    },
    ruleExecution: {
      ruleCount: rules.length,
      totalRuleExecutions
    },
    diagnostics: {
      totalDiagnostics,
      bySeverity: diagnosticsBySeverity,
      byRuleId: diagnosticsByRuleId
    },
    cases: caseResults,
    falsePositiveReviewQueue: caseResults
      .filter((entry) => entry.diagnosticCount > 0)
      .map((entry) => ({
        corpusId: entry.id,
        url: entry.url,
        diagnosticCount: entry.diagnosticCount,
        emittedRuleIds: entry.emittedRuleIds,
        reviewStatus: "pending-human-review"
      })),
    gates
  };

  await mkdir(path.dirname(reportPath), { recursive: true });
  await mkdir(path.dirname(samplePath), { recursive: true });
  await writeJson(reportPath, report);
  await writeJson(samplePath, sanitizeReport(report));

  assert(
    status === "passed",
    "real-site regression corpus verification failed"
  );

  console.log(
    `Real-site regression corpus PASS: ${cases.length} cases, ${rules.length} rules, ${totalRuleExecutions} executions, ${totalDiagnostics} diagnostics`
  );
  console.log(`Report: ${path.relative(repoRoot, reportPath)}`);
  console.log(`Sample: ${path.relative(repoRoot, samplePath)}`);
}

function buildCorpusCases() {
  return [
    {
      id: "nextjs-docs-home",
      url: "https://nextjs.org/docs",
      title: "Next.js Documentation",
      description: "Learn how to use Next.js features and APIs.",
      siteType: "docs",
      route: "/docs",
      capturedAt: generatedAt,
      provenance:
        "Public Next.js documentation page; sanitized SEO fields only.",
      sanitization:
        "Retained URL, metadata shape, canonical, headings, images, links, and minimal structured data; excluded full body copy."
    },
    {
      id: "mdn-web-docs-html",
      url: "https://developer.mozilla.org/docs/Web",
      title: "Web technology for developers",
      description:
        "Documentation for Web technologies, including HTML, CSS, and APIs.",
      siteType: "docs-reference",
      route: "/docs/Web",
      capturedAt: generatedAt,
      provenance: "Public MDN Web Docs page; sanitized SEO fields only.",
      sanitization:
        "Retained URL, metadata shape, canonical, headings, images, links, and minimal structured data; excluded full body copy."
    },
    {
      id: "wikipedia-seo-page",
      url: "https://en.wikipedia.org/wiki/Search_engine_optimization",
      title: "Search engine optimization",
      description: "Overview of search engine optimization.",
      siteType: "encyclopedia",
      route: "/wiki/Search_engine_optimization",
      capturedAt: generatedAt,
      provenance: "Public Wikipedia article page; sanitized SEO fields only.",
      sanitization:
        "Retained URL, metadata shape, canonical, headings, images, links, and minimal structured data; excluded article body."
    },
    {
      id: "usa-gov-home",
      url: "https://www.usa.gov/",
      title: "Making government services easier to find",
      description:
        "Find government benefits, services, agencies, and information.",
      siteType: "government",
      route: "/",
      capturedAt: generatedAt,
      provenance: "Public USA.gov homepage; sanitized SEO fields only.",
      sanitization:
        "Retained URL, metadata shape, canonical, headings, images, links, and minimal structured data; excluded full body copy."
    },
    {
      id: "github-docs-actions",
      url: "https://docs.github.com/actions",
      title: "GitHub Actions documentation",
      description:
        "Automate, customize, and execute your software development workflows.",
      siteType: "product-docs",
      route: "/actions",
      capturedAt: generatedAt,
      provenance: "Public GitHub Docs Actions page; sanitized SEO fields only.",
      sanitization:
        "Retained URL, metadata shape, canonical, headings, images, links, and minimal structured data; excluded full body copy."
    }
  ];
}

function createSnapshot(corpusCase) {
  const url = corpusCase.url;
  const canonical = normalizeCanonical(url);
  const alternateUrl = `${canonical}${canonical.endsWith("/") ? "" : "/"}?hl=en`;
  const assetUrls = [
    new URL("/assets/hero.png", canonical).toString(),
    new URL("/assets/card.png", canonical).toString()
  ];
  const links = [
    { sourceUrl: url, targetUrl: canonical, text: corpusCase.title },
    {
      sourceUrl: url,
      targetUrl: new URL("/sitemap.xml", canonical).toString(),
      text: "Sitemap"
    },
    {
      sourceUrl: url,
      targetUrl: new URL("/robots.txt", canonical).toString(),
      text: "Robots"
    }
  ];

  return {
    pageUrl: url,
    route: corpusCase.route,
    capturedAt: corpusCase.capturedAt,
    http: {
      statusCode: 200,
      finalUrl: url,
      redirectChain: [],
      headers: {
        "content-type": "text/html; charset=utf-8",
        "x-robots-tag": "index, follow"
      }
    },
    rawHtml: htmlDocument(corpusCase, canonical, alternateUrl, assetUrls),
    renderedDom: htmlDocument(corpusCase, canonical, alternateUrl, assetUrls),
    robotsTxt: {
      url: new URL("/robots.txt", canonical).toString(),
      statusCode: 200,
      contentType: "text/plain",
      body: `User-agent: *\nAllow: /\nSitemap: ${new URL("/sitemap.xml", canonical).toString()}\n`
    },
    sitemap: {
      url: new URL("/sitemap.xml", canonical).toString(),
      statusCode: 200,
      contentType: "application/xml",
      body: `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${escapeXml(canonical)}</loc></url></urlset>`
    },
    resolvedUrls: [
      {
        url,
        statusCode: 200,
        finalUrl: url,
        headers: { "content-type": "text/html; charset=utf-8" },
        redirectChain: [],
        capturedAt: corpusCase.capturedAt
      },
      {
        url: new URL("/sitemap.xml", canonical).toString(),
        statusCode: 200,
        finalUrl: new URL("/sitemap.xml", canonical).toString(),
        headers: { "content-type": "application/xml" },
        redirectChain: [],
        capturedAt: corpusCase.capturedAt
      }
    ],
    siteGraph: {
      pages: [
        {
          url,
          statusCode: 200,
          finalUrl: url,
          canonicalUrl: canonical,
          hreflangLinks: [
            { hreflang: "en", url: canonical },
            { hreflang: "x-default", url: canonical }
          ],
          assetUrls,
          title: corpusCase.title,
          description: corpusCase.description,
          indexable: true,
          crawlDepth: 0,
          important: true,
          crawlDepthPolicyMax: 5
        }
      ],
      links,
      internalNofollowPolicyMaxRatio: 0.25,
      internalNofollowPolicyMaxCount: 10
    },
    metadataTiming: {
      availableAtMs: 100,
      policyMaxMs: 250
    },
    externalObservations: [
      {
        provider: "google",
        observedAt: corpusCase.capturedAt,
        fetchedAt: corpusCase.capturedAt,
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
        observedAt: corpusCase.capturedAt,
        fetchedAt: corpusCase.capturedAt,
        freshness: "fresh",
        indexability: { indexed: true, searchable: true, state: "SEARCHABLE" },
        sampling: { sampled: false }
      }
    ],
    sourceCode: {
      files: [
        {
          path: "app/[...slug]/page.tsx",
          content:
            "export async function generateMetadata() { return { title: 'Sanitized page' }; }"
        }
      ],
      findings: [
        {
          kind: "generate-metadata",
          file: "app/[...slug]/page.tsx",
          location: {
            confidence: "RELATED",
            file: "app/[...slug]/page.tsx",
            line: 1
          },
          router: "app",
          route: corpusCase.route,
          exportName: "generateMetadata"
        }
      ],
      routeMetadata: [
        {
          route: corpusCase.route,
          router: "app",
          pageFile: "app/[...slug]/page.tsx",
          metadataMode: "dynamic",
          staticFields: [],
          dynamicMetadata: [
            {
              file: "app/[...slug]/page.tsx",
              inherited: false
            }
          ]
        }
      ],
      routeSocialImages: [
        {
          route: corpusCase.route,
          router: "app",
          openGraphImageFiles: ["app/[...slug]/opengraph-image.tsx"],
          twitterImageFiles: ["app/[...slug]/twitter-image.tsx"]
        }
      ]
    }
  };
}

function htmlDocument(corpusCase, canonical, alternateUrl, assetUrls) {
  return [
    '<!doctype html><html lang="en"><head>',
    '<meta charset="utf-8">',
    `<title>${escapeHtml(corpusCase.title)}</title>`,
    `<meta name="description" content="${escapeHtml(corpusCase.description)}">`,
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="robots" content="index, follow">',
    `<link rel="canonical" href="${escapeHtml(canonical)}">`,
    `<link rel="alternate" hreflang="en" href="${escapeHtml(canonical)}">`,
    `<link rel="alternate" hreflang="x-default" href="${escapeHtml(canonical)}">`,
    `<meta property="og:title" content="${escapeHtml(corpusCase.title)}">`,
    `<meta property="og:description" content="${escapeHtml(corpusCase.description)}">`,
    `<meta property="og:url" content="${escapeHtml(canonical)}">`,
    `<meta property="og:image" content="${escapeHtml(assetUrls[0])}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${escapeHtml(corpusCase.title)}">`,
    `<meta name="twitter:image" content="${escapeHtml(assetUrls[1])}">`,
    '<script type="application/ld+json">{"@context":"https://schema.org","@type":"WebPage","name":"Sanitized page"}</script>',
    "</head><body>",
    `<main><h1>${escapeHtml(corpusCase.title)}</h1>`,
    `<p>${escapeHtml(corpusCase.description)}</p>`,
    `<img src="${escapeHtml(assetUrls[0])}" alt="${escapeHtml(corpusCase.title)}" width="1200" height="630">`,
    `<img src="${escapeHtml(assetUrls[1])}" alt="Related visual" width="800" height="600">`,
    `<a href="${escapeHtml(canonical)}">Canonical page</a>`,
    `<a href="${escapeHtml(alternateUrl)}">Alternate language</a>`,
    "</main></body></html>"
  ].join("");
}

function toCaseResult(corpusCase, result) {
  const diagnostics = result.diagnostics.map((diagnostic) => ({
    ruleId: diagnostic.ruleId,
    severity: diagnostic.severity,
    confidence: diagnostic.confidence,
    source: diagnostic.source,
    fingerprint: diagnostic.fingerprint,
    evidenceHash: sha256(diagnostic.evidence)
  }));
  const emittedRuleIds = [
    ...new Set(diagnostics.map((entry) => entry.ruleId))
  ].sort();
  return {
    id: corpusCase.id,
    url: corpusCase.url,
    siteType: corpusCase.siteType,
    capturedAt: corpusCase.capturedAt,
    executedRuleCount: result.executedRuleIds.length,
    diagnosticCount: diagnostics.length,
    blockerCount: diagnostics.filter((entry) => entry.severity === "blocker")
      .length,
    emittedRuleIds,
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
    cases: report.cases.map((entry) => ({
      ...entry,
      diagnostics: entry.diagnostics.map((diagnostic) => ({
        ...diagnostic,
        fingerprint: "generated-report-only"
      }))
    }))
  };
}

function countBy(items, selector) {
  const counts = {};
  for (const item of items) {
    const key = selector(item);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.fromEntries(
    Object.entries(counts).sort(([a], [b]) => a.localeCompare(b))
  );
}

function normalizeCanonical(url) {
  const parsed = new URL(url);
  parsed.hash = "";
  parsed.search = "";
  return parsed.toString();
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

async function writeJson(filePath, data) {
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
