import {
  createCoreCanonicalHreflangRules,
  createCoreHttpAndIndexabilityRules,
  createCoreRobotsSitemapPerformanceRules,
  createCoreStructuralMediaSchemaLinkRules,
  createCoreTitleMetadataRules,
  createRuleCatalogRegistry,
  parseRuleCatalogYaml,
  runRuleEngine,
  type Diagnostic,
  type PageSnapshot,
  type Rule,
  type SiteGraphSnapshot
} from "@searchlint/core";
import type {
  CrawlDiagnosticIngestionItem,
  DiagnosticSourceLocation
} from "@searchlint/api";
import type { CrawlResult } from "@searchlint/crawler";
import { createHtmlSnapshotFragment } from "@searchlint/html";
import { createHttpSnapshotFragment } from "@searchlint/http";

import type {
  CloudCrawlDiagnosticAnalysisInput,
  CloudCrawlDiagnosticAnalyzer
} from "./crawler-execution-worker.js";

export type CoreCrawlDiagnosticAnalyzerOptions = {
  catalogText: string;
};

export function createCoreCrawlDiagnosticAnalyzer(
  options: CoreCrawlDiagnosticAnalyzerOptions
): CloudCrawlDiagnosticAnalyzer {
  const registry = createRuleCatalogRegistry(
    parseRuleCatalogYaml(options.catalogText)
  );
  const rules = createWorkerCoreRules(registry);

  return {
    async analyzeCrawlDiagnostics(input) {
      const siteGraph = createSiteGraphFromCrawl(input.result);
      const diagnostics: CrawlDiagnosticIngestionItem[] = [];

      for (const page of input.result.pages) {
        const snapshot = createSnapshotFromCrawledPage(
          page,
          input.observedAt,
          input.result.robotsTxt,
          input.result.sitemap,
          siteGraph
        );
        const engineResult = await runRuleEngine({
          rules,
          snapshot,
          options: {
            now: input.observedAt
          }
        });
        diagnostics.push(
          ...engineResult.diagnostics.map((diagnostic) =>
            ingestionDiagnosticFromCore(diagnostic)
          )
        );
      }

      return diagnostics;
    }
  };
}

function createWorkerCoreRules(
  registry: ReturnType<typeof createRuleCatalogRegistry>
): readonly Rule[] {
  return [
    ...createCoreHttpAndIndexabilityRules(registry),
    ...createCoreTitleMetadataRules(registry),
    ...createCoreCanonicalHreflangRules(registry),
    ...createCoreStructuralMediaSchemaLinkRules(registry),
    ...createCoreRobotsSitemapPerformanceRules(registry)
  ];
}

function ingestionDiagnosticFromCore(
  diagnostic: Diagnostic
): CrawlDiagnosticIngestionItem {
  return {
    ruleId: diagnostic.ruleId,
    severity: diagnostic.severity,
    confidence: diagnostic.confidence,
    pageUrl: diagnostic.pageUrl,
    ...(diagnostic.route === undefined ? {} : { route: diagnostic.route }),
    source: diagnosticSource(diagnostic.source),
    title: diagnostic.title,
    evidence: diagnostic.evidence,
    ...(diagnostic.expected === undefined
      ? {}
      : { expected: diagnostic.expected }),
    ...(diagnostic.actual === undefined ? {} : { actual: diagnostic.actual }),
    ...(diagnostic.sourceLocation === undefined
      ? {}
      : {
          sourceLocation: sourceLocation(diagnostic.sourceLocation)
        }),
    ...(diagnostic.structuredEvidence === undefined
      ? {}
      : {
          structuredEvidence: diagnostic.structuredEvidence.map((entry) => ({
            ...entry
          }))
        }),
    observedAt: diagnostic.observedAt,
    fingerprint: diagnostic.fingerprint
  };
}

function diagnosticSource(
  source: Diagnostic["source"]
): CrawlDiagnosticIngestionItem["source"] {
  if (source === "robots-txt" || source === "sitemap") {
    return "crawler";
  }
  return source;
}

function sourceLocation(
  location: NonNullable<Diagnostic["sourceLocation"]>
): DiagnosticSourceLocation {
  return {
    confidence: location.confidence === "EXACT" ? "exact" : "related",
    ...(location.file === undefined ? {} : { file: location.file }),
    ...(location.line === undefined ? {} : { line: location.line }),
    ...(location.selector === undefined ? {} : { selector: location.selector })
  };
}

function createSnapshotFromCrawledPage(
  page: CrawlResult["pages"][number],
  capturedAt: string,
  robotsTxt: CrawlResult["robotsTxt"] | undefined,
  sitemap: CrawlResult["sitemap"] | undefined,
  siteGraph?: SiteGraphSnapshot
): PageSnapshot {
  return {
    route: routeFromUrl(page.url),
    ...createHtmlSnapshotFragment({
      pageUrl: page.url,
      capturedAt,
      rawHtml: page.body,
      renderedDom: page.body
    }),
    ...createHttpSnapshotFragment({
      finalUrl: page.finalUrl ?? page.url,
      statusCode: page.statusCode,
      headers: page.headers,
      redirectChain: page.redirectChain ?? []
    }),
    ...(siteGraph === undefined ? {} : { siteGraph }),
    ...(robotsTxt === undefined
      ? {}
      : {
          robotsTxt: {
            url: robotsTxt.url,
            statusCode: robotsTxt.statusCode,
            body: robotsTxt.body
          }
        }),
    ...(sitemap === undefined
      ? {}
      : {
          sitemap: {
            url: sitemap.url,
            statusCode: sitemap.statusCode,
            ...(sitemap.contentType === undefined
              ? {}
              : { contentType: sitemap.contentType }),
            body: sitemap.body
          }
        })
  };
}

function createSiteGraphFromCrawl(
  crawlResult: CrawlResult
): SiteGraphSnapshot | undefined {
  if (crawlResult.pages.length === 0) {
    return undefined;
  }

  return {
    pages: crawlResult.pages.map((page) => ({
      url: page.url,
      statusCode: page.statusCode,
      ...(page.finalUrl === undefined ? {} : { finalUrl: page.finalUrl }),
      ...(page.redirectChain === undefined
        ? {}
        : { redirectChain: page.redirectChain }),
      indexable: observedIndexable(page)
    })),
    links: crawlResult.pages.flatMap((page) =>
      page.discoveredLinks.map((targetUrl) => ({
        sourceUrl: page.url,
        targetUrl
      }))
    )
  };
}

function observedIndexable(page: CrawlResult["pages"][number]): boolean {
  const directives = [
    ...splitDirectiveList(headerValue(page.headers, "x-robots-tag") ?? ""),
    ...htmlRobotDirectives(page.body)
  ];

  return !directives.includes("noindex") && !directives.includes("none");
}

function htmlRobotDirectives(html: string): readonly string[] {
  return [
    ...html.matchAll(
      /<meta\s+[^>]*(?:name|property)=["'](?:robots|googlebot|yandex)["'][^>]*>/gi
    )
  ].flatMap((match) =>
    splitDirectiveList(match[0].match(/\bcontent=["']([^"']*)["']/i)?.[1] ?? "")
  );
}

function splitDirectiveList(value: string): readonly string[] {
  return value
    .split(/[,\s]+/)
    .map((directive) => directive.trim().toLowerCase())
    .filter(Boolean);
}

function headerValue(
  headers: Readonly<Record<string, string>>,
  headerName: string
): string | undefined {
  const lowerName = headerName.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === lowerName) {
      return value;
    }
  }

  return undefined;
}

function routeFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    return pathname.length === 0 ? "/" : pathname;
  } catch {
    return "/";
  }
}
