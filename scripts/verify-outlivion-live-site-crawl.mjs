#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { format } from "prettier";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const generatedAt = "2026-06-23T00:00:00.000Z";
const siteUrl = "https://outlivion.space/";
const userAgent =
  "SearchLint/1.0 cautious live-site acceptance (+https://outlivion.space/)";
const reportPath = path.join(
  repoRoot,
  "reports/outlivion-live-site-crawl-report.json"
);
const samplePath = path.join(
  repoRoot,
  "docs/examples/outlivion-live-site-crawl-report.sample.json"
);
const crawlLimits = {
  maxUrls: 126,
  maxDepth: 10,
  maxLinksPerPage: 120,
  maxQueryVariantsPerPath: 2,
  maxResponseBytes: 1_000_000,
  maxRedirects: 8,
  retryAttempts: 1,
  requestTimeoutMs: 10_000,
  minIntervalMs: 500
};

if (!process.version.startsWith("v24.")) {
  throw new Error(
    `Outlivion live crawl evidence must run under Node.js 24, got ${process.version}`
  );
}

run("pnpm", ["build"], { stdio: "inherit" });

const [{ analyzeCrawl }, { createNodeCliIo }] = await Promise.all([
  import("../packages/cli/dist/src/index.js"),
  import("../packages/cli/dist/src/node.js")
]);

const sitemap = await fetchText(`${siteUrl}sitemap.xml`);
const sitemapUrls = [...sitemap.text.matchAll(/<loc>([^<]+)<\/loc>/gu)].map(
  (match) => match[1]
);

const requestLog = [];
const crawlAnalysis = await analyzeCrawl(
  {
    catalogPath: path.join(repoRoot, "specs/RULE_CATALOG.yaml"),
    format: "json",
    failOn: "none",
    now: generatedAt,
    crawl: {
      startUrl: siteUrl,
      maxUrls: crawlLimits.maxUrls,
      maxDepth: crawlLimits.maxDepth,
      maxLinksPerPage: crawlLimits.maxLinksPerPage,
      maxQueryVariantsPerPath: crawlLimits.maxQueryVariantsPerPath,
      maxResponseBytes: crawlLimits.maxResponseBytes,
      maxRedirects: crawlLimits.maxRedirects,
      retryAttempts: crawlLimits.retryAttempts,
      requestTimeoutMs: crawlLimits.requestTimeoutMs,
      allowPrivateNetworks: false,
      sameOrigin: true,
      respectRobotsTxt: true,
      userAgent,
      rateLimit: {
        minIntervalMs: crawlLimits.minIntervalMs
      }
    }
  },
  createNodeCliIo(),
  {
    async fetch(url, options) {
      const startedAt = new Date().toISOString();
      const response = await fetch(url, {
        headers: options?.headers,
        signal: options?.signal
      });
      const headers = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });
      const body = await response.text();
      requestLog.push({
        url,
        finalUrl: response.url,
        statusCode: response.status,
        contentType: headers["content-type"] ?? null,
        bytes: Buffer.byteLength(body),
        startedAt
      });
      return {
        url: response.url,
        statusCode: response.status,
        headers,
        body
      };
    }
  }
);

const report = buildReport(crawlAnalysis, sitemap, sitemapUrls, requestLog);
assertNoHtmlBodies(report);
await writeJson(reportPath, report);
await writeJson(samplePath, report);

console.log(
  `Outlivion live-site crawl evidence ${report.status}: ${report.crawl.pagesCrawled} page(s), ${report.diagnostics.totalDiagnostics} diagnostic(s)`
);
console.log(`Report: ${path.relative(repoRoot, reportPath)}`);
console.log(`Sample: ${path.relative(repoRoot, samplePath)}`);

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    env: process.env,
    encoding: "utf8",
    stdio: options.stdio ?? "pipe"
  });
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { "user-agent": userAgent }
  });
  return {
    url: response.url,
    statusCode: response.status,
    contentType: response.headers.get("content-type"),
    text: await response.text()
  };
}

function buildReport(crawlAnalysis, sitemap, sitemapUrls, requests) {
  const diagnostics = crawlAnalysis.diagnostics;
  const pages = crawlAnalysis.crawlResult.pages.map((page) => ({
    url: page.url,
    finalUrl: page.finalUrl ?? page.url,
    statusCode: page.statusCode,
    contentType: page.contentType ?? page.headers["content-type"] ?? null,
    discoveredLinkCount: page.discoveredLinks.length,
    depth: page.depth ?? null
  }));
  const gates = {
    ownerAuthorized: true,
    robotsTxtFetched: Boolean(crawlAnalysis.crawlResult.robotsTxt),
    sitemapFetched: sitemap.statusCode === 200 && sitemapUrls.length > 0,
    sameOriginOnly: crawlAnalysis.crawlResult.pages.every(
      (page) => new URL(page.url).origin === new URL(siteUrl).origin
    ),
    boundedToSitemapSize:
      crawlLimits.maxUrls === sitemapUrls.length &&
      crawlAnalysis.crawlResult.pages.length <= sitemapUrls.length,
    noHtmlBodiesInReport: true
  };
  const status = Object.values(gates).every(Boolean) ? "passed" : "failed";

  return {
    schemaVersion: 1,
    generatedBy: "searchlint-outlivion-live-site-crawl",
    generatedAt,
    status,
    ownerAuthorization: {
      providedBy: "project owner in Codex thread",
      target: siteUrl,
      scope: "entire site, cautious crawl",
      statement: "весь сайт, но аккуратно; разрешаю все"
    },
    target: {
      startUrl: siteUrl,
      robotsUrl: `${siteUrl}robots.txt`,
      sitemapUrl: `${siteUrl}sitemap.xml`,
      sitemapStatusCode: sitemap.statusCode,
      sitemapUrlCount: sitemapUrls.length
    },
    limits: {
      ...crawlLimits,
      sameOrigin: true,
      respectRobotsTxt: true,
      allowPrivateNetworks: false,
      userAgent
    },
    crawl: {
      pagesCrawled: crawlAnalysis.crawlResult.pages.length,
      failedUrlCount: crawlAnalysis.crawlResult.failed.length,
      skippedUrlCount: crawlAnalysis.crawlResult.skipped.length,
      duplicateContentGroupCount:
        crawlAnalysis.crawlResult.duplicateContentGroups?.length ?? 0,
      requestCount: requests.length,
      pages,
      failed: crawlAnalysis.crawlResult.failed.slice(0, 50),
      skipped: crawlAnalysis.crawlResult.skipped.slice(0, 50)
    },
    ruleExecution: {
      executedRuleCount: crawlAnalysis.executedRuleIds.length,
      executedRuleIds: crawlAnalysis.executedRuleIds
    },
    diagnostics: {
      totalDiagnostics: diagnostics.length,
      bySeverity: countBy(diagnostics, (diagnostic) => diagnostic.severity),
      byRuleId: countBy(diagnostics, (diagnostic) => diagnostic.ruleId),
      sample: diagnostics.slice(0, 100).map((diagnostic) => ({
        ruleId: diagnostic.ruleId,
        severity: diagnostic.severity,
        confidence: diagnostic.confidence,
        pageUrl: diagnostic.pageUrl,
        title: diagnostic.title,
        evidence: diagnostic.evidence,
        fingerprint: diagnostic.fingerprint
      }))
    },
    requestSummary: requests.map((request) => ({
      url: request.url,
      finalUrl: request.finalUrl,
      statusCode: request.statusCode,
      contentType: request.contentType,
      bytes: request.bytes,
      startedAt: request.startedAt
    })),
    gates,
    nonClaims: [
      "This live-site crawl does not replace OD-023 independent reviewer approval.",
      "This live-site crawl does not prove Google Search Console, PageSpeed/CrUX, Yandex, Stripe, or cloud acceptance.",
      "This report omits full HTML response bodies.",
      "This report does not close SearchLint 1.0 final release gates by itself."
    ]
  };
}

function countBy(values, keyFn) {
  const counts = {};
  for (const value of values) {
    const key = keyFn(value) ?? "unknown";
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.fromEntries(
    Object.entries(counts).sort(([left], [right]) => left.localeCompare(right))
  );
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(
    filePath,
    await format(JSON.stringify(value), { parser: "json" })
  );
}

function assertNoHtmlBodies(report) {
  const serialized = JSON.stringify(report);
  const forbidden = [/<html[\s>]/iu, /<body[\s>]/iu, /__NEXT_DATA__/u];
  const match = forbidden.find((pattern) => pattern.test(serialized));
  if (match) {
    throw new Error(`Report appears to contain full HTML body: ${match}`);
  }
}
