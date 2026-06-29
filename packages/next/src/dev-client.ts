import { createBrowserRenderedDomSnapshot } from "@searchlint/browser";
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
  type Rule
} from "@searchlint/core";
import {
  createSearchLintOverlayRuntime,
  deriveBadgeState,
  type OverlayBacklinkState,
  type OverlayGeoAudit,
  type OverlayGeoMarketPage,
  type OverlayGeoSignal,
  type OverlayLinkAudit,
  type OverlayLinkTarget,
  type OverlayLocalPerformance,
  type OverlayMetricStatus,
  type OverlayPageSpeedState,
  type OverlaySiteEssential,
  type OverlaySiteEssentialsAudit,
  type OverlayTechnicalAudit,
  type OverlayTechnicalMetric,
  type SearchLintOverlayRuntime,
  type SearchLintOverlayState
} from "@searchlint/overlay";

declare const __SEARCHLINT_RULE_CATALOG__: string | undefined;
declare const __SEARCHLINT_SITE_URL__: string | undefined;
declare const __SEARCHLINT_PAGESPEED_ENABLED__: boolean | undefined;
declare const __SEARCHLINT_PAGESPEED_STRATEGY__:
  | "mobile"
  | "desktop"
  | undefined;
declare const __SEARCHLINT_PAGESPEED_API_KEY__: string | undefined;

declare global {
  interface Window {
    __SEARCHLINT_DEV_OVERLAY__?: SearchLintOverlayRuntime;
  }
}

export type SearchLintDevClientOptions = {
  document: Document;
  catalogText: string;
  siteUrl?: string;
  now?: () => string;
  pageSpeedEnabled?: boolean;
  pageSpeedStrategy?: "mobile" | "desktop";
  pageSpeedApiKey?: string;
  pageSpeedFetch?: PageSpeedFetch;
  siteEssentialsFetch?: SiteEssentialsFetch;
};

type PageSpeedFetch = (url: string) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

type PageSpeedCacheEntry = {
  createdAt: number;
  promise: Promise<OverlayPageSpeedState>;
};

type SiteEssentialsFetch = (url: string) => Promise<{
  ok: boolean;
  status: number;
  text(): Promise<string>;
}>;

const pageSpeedCache = new Map<string, PageSpeedCacheEntry>();
const pageSpeedCacheTtlMs = 10 * 60 * 1000;

export async function analyzeCurrentDocument(
  options: SearchLintDevClientOptions
): Promise<readonly Diagnostic[]> {
  const capturedAt = options.now?.() ?? new Date().toISOString();
  const snapshot = createBrowserRenderedDomSnapshot({
    document: options.document,
    url: options.document.location.href,
    capturedAt,
    rawHtml: options.document.documentElement.outerHTML
  });
  const registry = createRuleCatalogRegistry(
    parseRuleCatalogYaml(options.catalogText)
  );
  const result = await runRuleEngine({
    rules: createRules(registry),
    snapshot,
    ...(options.siteUrl === undefined ? {} : { siteUrl: options.siteUrl }),
    options: { now: capturedAt }
  });
  return result.diagnostics;
}

export function initializeSearchLintDevClient(
  options: Partial<SearchLintDevClientOptions> = {}
): SearchLintOverlayRuntime | undefined {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return undefined;
  }
  if (window.__SEARCHLINT_DEV_OVERLAY__?.host.isConnected) {
    return window.__SEARCHLINT_DEV_OVERLAY__;
  }
  if (window.__SEARCHLINT_DEV_OVERLAY__) {
    window.__SEARCHLINT_DEV_OVERLAY__.destroy();
    delete window.__SEARCHLINT_DEV_OVERLAY__;
  }
  document.querySelector("searchlint-dev-overlay")?.remove();

  const catalogText = options.catalogText ?? __SEARCHLINT_RULE_CATALOG__;
  const siteUrl = options.siteUrl ?? __SEARCHLINT_SITE_URL__;
  const pageSpeedEnabled =
    options.pageSpeedEnabled ?? __SEARCHLINT_PAGESPEED_ENABLED__ === true;
  const pageSpeedStrategy =
    options.pageSpeedStrategy ?? __SEARCHLINT_PAGESPEED_STRATEGY__ ?? "mobile";
  const pageSpeedApiKey =
    options.pageSpeedApiKey ?? __SEARCHLINT_PAGESPEED_API_KEY__;
  if (!catalogText) {
    throw new Error(
      "SearchLint dev client requires the real RULE_CATALOG.yaml injected by @searchlint/next."
    );
  }

  const runtime = createSearchLintOverlayRuntime({
    document: options.document ?? document,
    initialDiagnostics: [],
    onRerun: () =>
      rerunSearchLintDevClient(
        runtime,
        options.document ?? document,
        catalogText,
        siteUrl,
        {
          enabled: pageSpeedEnabled,
          strategy: pageSpeedStrategy,
          ...(pageSpeedApiKey === undefined || pageSpeedApiKey === ""
            ? {}
            : { apiKey: pageSpeedApiKey }),
          ...(options.pageSpeedFetch === undefined
            ? {}
            : { fetch: options.pageSpeedFetch }),
          ...(options.siteEssentialsFetch === undefined
            ? {}
            : { siteEssentialsFetch: options.siteEssentialsFetch })
        }
      )
  });
  const destroy = runtime.destroy;
  const managedRuntime: SearchLintOverlayRuntime = {
    ...runtime,
    destroy() {
      destroy();
      if (window.__SEARCHLINT_DEV_OVERLAY__ === managedRuntime) {
        delete window.__SEARCHLINT_DEV_OVERLAY__;
      }
    }
  };
  window.__SEARCHLINT_DEV_OVERLAY__ = managedRuntime;
  void rerunSearchLintDevClient(
    runtime,
    options.document ?? document,
    catalogText,
    siteUrl,
    {
      enabled: pageSpeedEnabled,
      strategy: pageSpeedStrategy,
      ...(pageSpeedApiKey === undefined || pageSpeedApiKey === ""
        ? {}
        : { apiKey: pageSpeedApiKey }),
      ...(options.pageSpeedFetch === undefined
        ? {}
        : { fetch: options.pageSpeedFetch }),
      ...(options.siteEssentialsFetch === undefined
        ? {}
        : { siteEssentialsFetch: options.siteEssentialsFetch })
    }
  );
  return managedRuntime;
}

export async function rerunSearchLintDevClient(
  runtime: SearchLintOverlayRuntime,
  document: Document,
  catalogText: string,
  siteUrl?: string,
  pageSpeed: {
    enabled?: boolean;
    strategy?: "mobile" | "desktop";
    apiKey?: string;
    fetch?: PageSpeedFetch;
    siteEssentialsFetch?: SiteEssentialsFetch;
  } = {}
): Promise<void> {
  runtime.update({
    status: "checking",
    actionMessage: "Rerunning SearchLint...",
    runtimeError: undefined
  });
  try {
    const diagnostics = await analyzeCurrentDocument({
      document,
      catalogText,
      ...(siteUrl === undefined ? {} : { siteUrl })
    });
    const pageSpeedPageUrl = resolvePageSpeedPageUrl(document, siteUrl);
    const linkAudit = collectLinkAudit(document, siteUrl);
    const siteEssentials = await collectSiteEssentials(
      document,
      pageSpeed.siteEssentialsFetch
    );
    const pageSpeedState =
      pageSpeed.enabled === true
        ? createPendingPageSpeedState(
            pageSpeed.strategy ?? "mobile",
            pageSpeedPageUrl,
            pageSpeed.apiKey
          )
        : undefined;
    runtime.update({
      status: deriveBadgeState(diagnostics),
      diagnostics,
      pageUrl: document.location.href,
      route: document.location.pathname,
      localPerformance: collectLocalPerformance(document),
      linkAudit,
      technicalAudit: collectTechnicalAudit(document, diagnostics),
      geoAudit: collectGeoAudit(document, linkAudit),
      siteEssentials,
      ...(pageSpeedState !== undefined
        ? {
            externalMetrics: {
              pageSpeed: pageSpeedState
            }
          }
        : {}),
      actionMessage: undefined,
      runtimeError: undefined
    });
    scheduleLocalPerformanceRefresh(runtime, document);
    if (pageSpeedState?.status === "checking") {
      void refreshPageSpeedMetrics(
        runtime,
        pageSpeedPageUrl,
        pageSpeed.strategy ?? "mobile",
        pageSpeed.apiKey,
        pageSpeed.fetch
      );
    }
  } catch (error) {
    runtime.update({
      status: "errors",
      actionMessage: undefined,
      runtimeError:
        error instanceof Error
          ? error.message
          : "SearchLint analysis failed while rerunning."
    } satisfies Partial<SearchLintOverlayState>);
  }
}

function scheduleLocalPerformanceRefresh(
  runtime: SearchLintOverlayRuntime,
  document: Document
): void {
  const view = document.defaultView;
  if (view === null || view === undefined) return;
  view.setTimeout(() => {
    runtime.update({
      localPerformance: collectLocalPerformance(document)
    });
  }, 1200);
}

export function collectLocalPerformance(
  document: Document
): OverlayLocalPerformance | undefined {
  const view = document.defaultView;
  const performance = view?.performance;
  if (view === null || view === undefined || performance === undefined) {
    return undefined;
  }
  const navigation = performance.getEntriesByType("navigation")[0] as
    | PerformanceNavigationTiming
    | undefined;
  const paintEntries = performance.getEntriesByType("paint");
  const fcpEntry = paintEntries.find(
    (entry) => entry.name === "first-contentful-paint"
  );
  const largestPaintEntries = performance.getEntriesByType(
    "largest-contentful-paint"
  );
  const lcpEntry = largestPaintEntries.at(-1);
  const longTasks = performance.getEntriesByType("longtask");
  const layoutShifts = performance.getEntriesByType("layout-shift");
  const cls = layoutShifts.reduce((total, entry) => {
    const shift = entry as PerformanceEntry & {
      value?: number;
      hadRecentInput?: boolean;
    };
    if (shift.hadRecentInput === true) return total;
    return total + (shift.value ?? 0);
  }, 0);
  const tbtMs = longTasks.reduce(
    (total, entry) => total + Math.max(0, entry.duration - 50),
    0
  );
  return {
    source: "browser-performance",
    capturedAt: new Date().toISOString(),
    viewport: {
      width: view.innerWidth,
      height: view.innerHeight
    },
    ...(fcpEntry === undefined ? {} : { fcpMs: fcpEntry.startTime }),
    ...(lcpEntry === undefined ? {} : { lcpMs: lcpEntry.startTime }),
    ...(longTasks.length === 0 ? {} : { tbtMs }),
    ...(layoutShifts.length === 0 ? {} : { cls }),
    ...(navigation === undefined
      ? {}
      : {
          loadMs: navigation.loadEventEnd,
          domContentLoadedMs: navigation.domContentLoadedEventEnd
        })
  };
}

export function collectLinkAudit(
  document: Document,
  siteUrl?: string
): OverlayLinkAudit | undefined {
  if (typeof document.querySelectorAll !== "function") return undefined;
  const pageUrl = document.location?.href;
  if (typeof pageUrl !== "string" || pageUrl === "") return undefined;
  const siteOrigin = resolveSiteOrigin(document, siteUrl);
  const currentOrigin = resolveCurrentOrigin(document);
  const internal = new Map<string, OverlayLinkTarget>();
  const external = new Map<string, OverlayLinkTarget>();
  document.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((anchor) => {
    const rawHref = anchor.getAttribute("href");
    if (rawHref === null || rawHref.trim() === "") return;
    const normalized = normalizeLinkUrl(
      rawHref,
      pageUrl,
      currentOrigin,
      siteOrigin
    );
    if (normalized === undefined) return;
    const targetMap =
      siteOrigin !== undefined && new URL(normalized).origin === siteOrigin
        ? internal
        : external;
    upsertLinkTarget(targetMap, normalized, anchor);
  });
  return {
    source: "browser-dom",
    capturedAt: new Date().toISOString(),
    pageUrl,
    ...(siteOrigin === undefined ? {} : { siteOrigin }),
    internalLinks: sortLinkTargets([...internal.values()]),
    externalLinks: sortLinkTargets([...external.values()]),
    backlinks: createUnavailableBacklinkState()
  };
}

export async function collectSiteEssentials(
  document: Document,
  fetchOverride?: SiteEssentialsFetch
): Promise<OverlaySiteEssentialsAudit | undefined> {
  const pageUrl = document.location?.href;
  const origin = resolveCurrentOrigin(document);
  if (
    typeof pageUrl !== "string" ||
    pageUrl === "" ||
    origin === undefined
  ) {
    return undefined;
  }
  const fetchArtifact =
    fetchOverride ?? document.defaultView?.fetch?.bind(document.defaultView);
  const capturedAt = new Date().toISOString();
  if (fetchArtifact === undefined) {
    return {
      source: "browser-dom",
      capturedAt,
      pageUrl,
      essentials: [
        notProvenEssential("robots", "robots.txt", "Browser fetch is unavailable."),
        notProvenEssential("sitemap", "sitemap.xml", "Browser fetch is unavailable."),
        notProvenEssential("llms", "llms.txt", "Browser fetch is unavailable."),
        notProvenEssential(
          "not-found",
          "404 / not-found",
          "Browser fetch is unavailable."
        ),
        collectMobileEssential(document),
        crawlerProviderEssential()
      ]
    };
  }

  const [robots, sitemap, llms, notFound] = await Promise.all([
    checkTextArtifact(fetchArtifact, new URL("/robots.txt", origin).href, {
      key: "robots",
      label: "robots.txt",
      missingDetail:
        "robots.txt is missing. Add it when crawl policy should be explicit."
    }),
    checkTextArtifact(fetchArtifact, new URL("/sitemap.xml", origin).href, {
      key: "sitemap",
      label: "sitemap.xml",
      missingDetail:
        "sitemap.xml is missing. Add it so crawlers and agents can discover intended pages."
    }),
    checkTextArtifact(fetchArtifact, new URL("/llms.txt", origin).href, {
      key: "llms",
      label: "llms.txt",
      missingDetail:
        "llms.txt is missing. Add it when AI/LLM discovery should be explicit."
    }),
    checkNotFoundRoute(fetchArtifact, new URL("/__searchlint_missing_page__", origin).href)
  ]);

  return {
    source: "browser-fetch",
    capturedAt,
    pageUrl,
    essentials: [
      robots,
      sitemap,
      llms,
      notFound,
      collectMobileEssential(document),
      crawlerProviderEssential()
    ]
  };
}

function notProvenEssential(
  key: OverlaySiteEssential["key"],
  label: string,
  detail: string
): OverlaySiteEssential {
  return {
    key,
    label,
    status: "not-proven",
    detail
  };
}

function crawlerProviderEssential(): OverlaySiteEssential {
  return {
    key: "crawler",
    label: "Full-site crawl",
    status: "provider-needed",
    detail:
      "Run the crawler to prove orphan pages, broken links, crawl depth, and sitemap coverage."
  };
}

function collectMobileEssential(document: Document): OverlaySiteEssential {
  const view = document.defaultView;
  const width = view?.innerWidth;
  if (typeof width !== "number" || width <= 0) {
    return {
      key: "mobile",
      label: "Mobile check",
      status: "not-proven",
      detail:
        "Viewport width is unavailable. Open a mobile viewport or run PageSpeed mobile."
    };
  }
  if (width <= 768) {
    return {
      key: "mobile",
      label: "Mobile check",
      status: "pass",
      detail: `Current viewport is ${String(width)}px wide; review mobile layout, tap targets, and overflow.`
    };
  }
  return {
    key: "mobile",
    label: "Mobile check",
    status: "not-proven",
    detail: `Current viewport is ${String(width)}px wide. Rerun in a narrow viewport or use PageSpeed mobile before treating mobile UX as checked.`
  };
}

async function checkTextArtifact(
  fetchArtifact: SiteEssentialsFetch,
  url: string,
  options: {
    key: "robots" | "sitemap" | "llms";
    label: string;
    missingDetail: string;
  }
): Promise<OverlaySiteEssential> {
  try {
    const response = await fetchArtifact(url);
    if (response.status >= 200 && response.status < 300) {
      const body = await response.text();
      const trimmed = body.trim();
      return {
        key: options.key,
        label: options.label,
        status: trimmed === "" ? "issue" : "pass",
        detail:
          trimmed === ""
            ? `${options.label} is empty. Add useful crawl or discovery directives.`
            : `${options.label} is reachable.`,
        url
      };
    }
    if (response.status === 404) {
      return {
        key: options.key,
        label: options.label,
        status: "issue",
        detail: options.missingDetail,
        url
      };
    }
    return {
      key: options.key,
      label: options.label,
      status: "issue",
      detail: `${options.label} returned HTTP ${String(response.status)}.`,
      url
    };
  } catch {
    return {
      key: options.key,
      label: options.label,
      status: "not-proven",
      detail: `${options.label} could not be checked from this browser.`,
      url
    };
  }
}

async function checkNotFoundRoute(
  fetchArtifact: SiteEssentialsFetch,
  url: string
): Promise<OverlaySiteEssential> {
  try {
    const response = await fetchArtifact(url);
    if (response.status === 404 || response.status === 410) {
      return {
        key: "not-found",
        label: "404 / not-found",
        status: "pass",
        detail: `Missing pages return HTTP ${String(response.status)}.`,
        url
      };
    }
    return {
      key: "not-found",
      label: "404 / not-found",
      status: "issue",
      detail: `Missing page test returned HTTP ${String(response.status)} instead of 404/410.`,
      url
    };
  } catch {
    return {
      key: "not-found",
      label: "404 / not-found",
      status: "not-proven",
      detail: "404 behavior could not be checked from this browser.",
      url
    };
  }
}

export function collectTechnicalAudit(
  document: Document,
  diagnostics: readonly Diagnostic[]
): OverlayTechnicalAudit | undefined {
  const pageUrl = document.location?.href;
  if (typeof pageUrl !== "string" || pageUrl === "") return undefined;
  const navigation = document.defaultView?.performance?.getEntriesByType(
    "navigation"
  )[0] as PerformanceNavigationTiming | undefined;
  const html = document.documentElement?.outerHTML ?? "";
  const scripts = document.querySelectorAll?.("script[src]").length ?? 0;
  const stylesheets =
    document.querySelectorAll?.('link[rel~="stylesheet"]').length ?? 0;
  const title = document.title || readMetaContent(document, "og:title");
  const description = readMetaContent(document, "description");
  const overview: readonly OverlayTechnicalMetric[] = [
    { label: "Server", value: "N/A", status: "unknown" },
    { label: "Status", value: "200", status: "pass" },
    { label: "Encoding", value: "N/A", status: "unknown" },
    {
      label: "Page Size",
      value: formatBytes(
        navigation?.transferSize || navigation?.decodedBodySize
      ),
      status: statusForBytes(
        navigation?.transferSize || navigation?.decodedBodySize
      )
    },
    {
      label: "DOM Size",
      value: formatBytes(byteLength(html)),
      status: statusForBytes(byteLength(html))
    },
    { label: "Cacheable", value: "N/A", status: "unknown" }
  ];
  const timings: readonly OverlayTechnicalMetric[] = [
    metricMs("Time to Interactive", navigation?.domInteractive),
    metricMs("DOM Complete", navigation?.domComplete),
    metricMs(
      "Connection",
      navigation === undefined
        ? undefined
        : navigation.connectEnd - navigation.connectStart
    ),
    metricMs(
      "TLS Handshake",
      navigation === undefined || navigation.secureConnectionStart === 0
        ? 0
        : navigation.connectEnd - navigation.secureConnectionStart
    ),
    metricMs(
      "TTFB",
      navigation === undefined
        ? undefined
        : navigation.responseStart - navigation.requestStart
    ),
    metricMs(
      "Download",
      navigation === undefined
        ? undefined
        : navigation.responseEnd - navigation.responseStart
    )
  ];
  const renderBlocking: readonly OverlayTechnicalMetric[] = [
    {
      label: "Blocking Scripts",
      value: String(scripts),
      status: scripts === 0 ? "pass" : scripts <= 2 ? "warn" : "error"
    },
    {
      label: "Blocking Stylesheets",
      value: String(stylesheets),
      status: stylesheets === 0 ? "pass" : stylesheets <= 2 ? "warn" : "error"
    }
  ];
  const relevance: readonly OverlayTechnicalMetric[] = [
    relevanceMetric("Title Relevance", title, document.body?.textContent),
    relevanceMetric(
      "Description Relevance",
      description,
      document.body?.textContent
    ),
    relevanceMetric(
      "Keyword Relevance",
      readMetaContent(document, "keywords"),
      document.body?.textContent
    )
  ];
  const openGraph = collectMetaTable(document, [
    "og:type",
    "og:image",
    "og:title",
    "og:locale",
    "og:site_name",
    "og:description"
  ]);
  const twitter = collectMetaTable(document, [
    "twitter:card",
    "twitter:image",
    "twitter:title",
    "twitter:description"
  ]);
  const score = scoreTechnicalAudit(diagnostics, {
    overview,
    timings,
    renderBlocking,
    relevance,
    openGraph,
    twitter
  });
  return {
    source: "browser-dom",
    capturedAt: new Date().toISOString(),
    pageUrl,
    score,
    overview,
    timings,
    renderBlocking,
    relevance,
    openGraph,
    twitter
  };
}

function scoreTechnicalAudit(
  diagnostics: readonly Diagnostic[],
  audit: Pick<
    OverlayTechnicalAudit,
    | "overview"
    | "timings"
    | "renderBlocking"
    | "relevance"
    | "openGraph"
    | "twitter"
  >
): number {
  const technicalDiagnostics = diagnostics.filter((diagnostic) => {
    return (
      diagnostic.ruleId.startsWith("SL-HTTP-") ||
      diagnostic.ruleId.startsWith("SL-PERF-") ||
      diagnostic.ruleId.startsWith("SL-ROBOTS-") ||
      diagnostic.ruleId.startsWith("SL-SITEMAP-")
    );
  });
  const diagnosticPenalty = technicalDiagnostics.reduce((total, diagnostic) => {
    if (diagnostic.severity === "blocker") return total + 35;
    if (diagnostic.severity === "error") return total + 20;
    if (diagnostic.severity === "warning") return total + 8;
    return total + 3;
  }, 0);
  const metricPenalty =
    penaltyForMetrics(audit.overview, { error: 4, warn: 2, unknown: 1 }) +
    penaltyForMetrics(audit.timings, { error: 5, warn: 2, unknown: 0 }) +
    penaltyForMetrics(audit.renderBlocking, {
      error: 10,
      warn: 5,
      unknown: 0
    }) +
    penaltyForMetrics(audit.relevance, { error: 8, warn: 4, unknown: 0 }) +
    penaltyForMetrics(audit.openGraph, { error: 4, warn: 2, unknown: 1 }) +
    penaltyForMetrics(audit.twitter, { error: 4, warn: 2, unknown: 1 });
  return Math.max(0, 100 - diagnosticPenalty - metricPenalty);
}

function penaltyForMetrics(
  metrics: readonly OverlayTechnicalMetric[],
  weights: Record<"error" | "warn" | "unknown", number>
): number {
  return metrics.reduce((total, metric) => {
    if (metric.status === "error") return total + weights.error;
    if (metric.status === "warn") return total + weights.warn;
    if (metric.status === "unknown") return total + weights.unknown;
    return total;
  }, 0);
}

function metricMs(
  label: string,
  value: number | undefined
): OverlayTechnicalMetric {
  const rounded =
    value === undefined ? undefined : Math.max(0, Math.round(value));
  return {
    label,
    value: rounded === undefined ? "N/A" : `${String(rounded)}ms`,
    status:
      rounded === undefined
        ? "unknown"
        : rounded <= 200
          ? "pass"
          : rounded <= 1000
            ? "warn"
            : "error"
  };
}

function statusForBytes(value: number | undefined): OverlayMetricStatus {
  if (value === undefined || value === 0) return "unknown";
  if (value <= 150_000) return "pass";
  if (value <= 500_000) return "warn";
  return "error";
}

function formatBytes(value: number | undefined): string {
  if (value === undefined || value === 0) return "N/A";
  if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(value / 1024))} KB`;
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

function relevanceMetric(
  label: string,
  value: string | undefined,
  bodyText: string | undefined
): OverlayTechnicalMetric {
  const score = relevanceScore(value, bodyText);
  return {
    label,
    value: `${String(score)}%`,
    status: score >= 80 ? "pass" : score >= 50 ? "warn" : "error"
  };
}

function relevanceScore(
  value: string | undefined,
  bodyText: string | undefined
): number {
  if (value === undefined || value.trim() === "" || bodyText === undefined) {
    return 0;
  }
  const body = new Set(tokenizeText(bodyText));
  const tokens = tokenizeText(value);
  if (tokens.length === 0) return 0;
  const matches = tokens.filter((token) => body.has(token)).length;
  return Math.round((matches / tokens.length) * 100);
}

function tokenizeText(value: string): string[] {
  return value
    .toLocaleLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length >= 3);
}

function collectMetaTable(
  document: Document,
  names: readonly string[]
): readonly OverlayTechnicalMetric[] {
  return names.map((name) => ({
    label: name,
    value: readMetaContent(document, name) ?? "N/A",
    status: readMetaContent(document, name) === undefined ? "unknown" : "pass"
  }));
}

function readMetaContent(document: Document, name: string): string | undefined {
  const selector = name.startsWith("og:")
    ? `meta[property="${cssEscape(name)}"]`
    : `meta[name="${cssEscape(name)}"]`;
  const value = document.querySelector?.(selector)?.getAttribute("content");
  const trimmed = value?.trim();
  return trimmed === "" ? undefined : trimmed;
}

function cssEscape(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

export function collectGeoAudit(
  document: Document,
  linkAudit: OverlayLinkAudit | undefined
): OverlayGeoAudit | undefined {
  const pageUrl = document.location?.href;
  if (typeof pageUrl !== "string" || pageUrl === "") return undefined;
  const htmlLang =
    typeof document.documentElement?.getAttribute === "function"
      ? document.documentElement.getAttribute("lang")?.trim()
      : undefined;
  const ogLocale = readMetaContent(document, "og:locale");
  const alternates = collectAlternateLanguages(document);
  const text = document.body?.textContent ?? "";
  const regionalSignals = collectRegionalSignals(text);
  const marketCoverage = collectMarketCoverage(linkAudit);
  const detectedLanguage = htmlLang || inferLanguage(text);
  const primaryMarket = inferPrimaryMarket(text, ogLocale, detectedLanguage);
  const score = scoreGeoAudit({
    htmlLang,
    ogLocale,
    alternates,
    regionalSignals,
    marketCoverage
  });
  return {
    source: "browser-dom",
    capturedAt: new Date().toISOString(),
    pageUrl,
    score,
    primaryMarket,
    detectedLanguage: detectedLanguage || "N/A",
    locale: ogLocale ?? localeFromLanguage(detectedLanguage) ?? "N/A",
    hreflangStatus: alternates.length > 0 ? "present" : "missing",
    localIntent: inferLocalIntent(regionalSignals),
    languageSignals: [
      {
        label: "HTML lang",
        value: htmlLang || "N/A",
        status: htmlLang ? "pass" : "warn"
      },
      {
        label: "OG locale",
        value: ogLocale ?? "N/A",
        status: ogLocale ? "pass" : "warn"
      },
      {
        label: "Alternate languages",
        value:
          alternates.length === 0
            ? "N/A"
            : alternates.map((item) => item.label).join(", "),
        status: alternates.length === 0 ? "warn" : "pass"
      },
      {
        label: "Hreflang",
        value: alternates.length === 0 ? "Missing" : "Present",
        status: alternates.length === 0 ? "warn" : "pass"
      }
    ],
    regionalSignals,
    marketCoverage,
    providers: [
      {
        label: "Google Search Console",
        value: "Not connected",
        status: "unknown",
        detail:
          "Connect GSC to fetch country, query, click, and impression data."
      },
      {
        label: "Yandex Webmaster",
        value: "Not connected",
        status: "unknown",
        detail: "Connect Yandex Webmaster to fetch regional indexing data."
      },
      {
        label: "Yandex Metrica",
        value: "Not connected",
        status: "unknown",
        detail: "Connect Yandex Metrica to fetch regional user behavior."
      }
    ]
  };
}

function collectAlternateLanguages(
  document: Document
): readonly OverlayGeoSignal[] {
  return [
    ...(document.querySelectorAll?.('link[rel="alternate"][hreflang]') ?? [])
  ].map((link) => {
    const hreflang = link.getAttribute("hreflang") ?? "unknown";
    const href = link.getAttribute("href") ?? "";
    return {
      label: hreflang,
      value: href,
      status: "pass" as const
    };
  });
}

function collectRegionalSignals(text: string): readonly OverlayGeoSignal[] {
  const normalized = text.toLocaleLowerCase();
  const signals = [
    {
      label: "Russia intent",
      value: includesAny(normalized, ["росси", "russia", "для россии"])
        ? "Detected"
        : "Missing"
    },
    {
      label: "Local currency",
      value: includesAny(normalized, ["₽", "руб", "rub"])
        ? "Detected"
        : "Missing"
    },
    {
      label: "Telegram channel",
      value: includesAny(normalized, ["telegram", "телеграм"])
        ? "Detected"
        : "Missing"
    },
    {
      label: "Travel/Public Wi-Fi",
      value: includesAny(normalized, ["поезд", "travel", "wi-fi", "wifi"])
        ? "Detected"
        : "Missing"
    },
    {
      label: "Device coverage",
      value: includesAny(normalized, ["android", "iphone", "windows", "macos"])
        ? "Detected"
        : "Missing"
    }
  ];
  return signals.map((signal) => ({
    ...signal,
    status: signal.value === "Detected" ? "pass" : "warn"
  }));
}

function collectMarketCoverage(
  linkAudit: OverlayLinkAudit | undefined
): readonly OverlayGeoMarketPage[] {
  const links = linkAudit?.internalLinks ?? [];
  return links
    .map((link): OverlayGeoMarketPage | undefined => {
      const market = inferMarketFromUrl(link.url, link.label);
      if (market === undefined) return undefined;
      return {
        url: link.url,
        label: link.label,
        market: market.market,
        ...(market.locale === undefined ? {} : { locale: market.locale }),
        links: link.count,
        status: "pass"
      };
    })
    .filter((page): page is OverlayGeoMarketPage => page !== undefined);
}

function inferMarketFromUrl(
  url: string,
  label: string
): { market: string; locale?: string } | undefined {
  const value = `${url} ${label}`.toLocaleLowerCase();
  if (value.includes("/en") || value.includes(" english")) {
    return { market: "English", locale: "en" };
  }
  if (value.includes("/hi") || value.includes(" hindi")) {
    return { market: "Hindi", locale: "hi" };
  }
  if (value.includes("rossii") || value.includes("росси")) {
    return { market: "Russia", locale: "ru-RU" };
  }
  const locationMatch = value.match(/\/locations\/([^/?#]+)/);
  if (locationMatch?.[1]) {
    return { market: titleCase(locationMatch[1].replaceAll("-", " ")) };
  }
  return undefined;
}

function scoreGeoAudit(input: {
  htmlLang?: string | undefined;
  ogLocale?: string | undefined;
  alternates: readonly OverlayGeoSignal[];
  regionalSignals: readonly OverlayGeoSignal[];
  marketCoverage: readonly OverlayGeoMarketPage[];
}): number {
  let score = 20;
  if (input.htmlLang) score += 15;
  if (input.ogLocale) score += 15;
  if (input.alternates.length > 0) score += 15;
  score +=
    input.regionalSignals.filter((signal) => signal.value === "Detected")
      .length * 6;
  if (input.marketCoverage.length > 0) score += 5;
  return Math.min(100, score);
}

function inferLanguage(text: string): string {
  return /[а-яё]/i.test(text) ? "ru" : "N/A";
}

function localeFromLanguage(language: string): string | undefined {
  if (language === "ru") return "ru_RU";
  if (language === "en") return "en_US";
  if (language === "hi") return "hi_IN";
  return undefined;
}

function inferPrimaryMarket(
  text: string,
  ogLocale: string | undefined,
  language: string
): string {
  const normalized = text.toLocaleLowerCase();
  if (
    ogLocale === "ru_RU" ||
    language === "ru" ||
    normalized.includes("росси")
  ) {
    return "Russia / ru-RU";
  }
  if (language === "en") return "English";
  return "N/A";
}

function inferLocalIntent(signals: readonly OverlayGeoSignal[]): string {
  const detected = signals
    .filter((signal) => signal.value === "Detected")
    .map((signal) => signal.label);
  return detected.length === 0 ? "N/A" : detected.slice(0, 3).join(" / ");
}

function includesAny(value: string, needles: readonly string[]): boolean {
  return needles.some((needle) => value.includes(needle));
}

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0]?.toLocaleUpperCase() + part.slice(1))
    .join(" ");
}

function resolveSiteOrigin(
  document: Document,
  siteUrl?: string
): string | undefined {
  const candidates = [
    siteUrl,
    document.location?.origin,
    document.location?.href
  ];
  for (const candidate of candidates) {
    if (typeof candidate !== "string" || candidate === "") continue;
    try {
      const parsed = new URL(candidate);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        return parsed.origin;
      }
    } catch {
      continue;
    }
  }
  return undefined;
}

function resolveCurrentOrigin(document: Document): string | undefined {
  const origin = document.location?.origin;
  if (typeof origin === "string" && origin !== "") return origin;
  const href = document.location?.href;
  if (typeof href !== "string" || href === "") return undefined;
  try {
    return new URL(href).origin;
  } catch {
    return undefined;
  }
}

function normalizeLinkUrl(
  rawHref: string,
  pageUrl: string,
  currentOrigin: string | undefined,
  siteOrigin: string | undefined
): string | undefined {
  const trimmed = rawHref.trim();
  if (
    trimmed.startsWith("#") ||
    trimmed.startsWith("mailto:") ||
    trimmed.startsWith("tel:") ||
    trimmed.startsWith("javascript:")
  ) {
    return undefined;
  }
  try {
    const parsed = new URL(trimmed, pageUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return undefined;
    }
    if (
      siteOrigin !== undefined &&
      currentOrigin !== undefined &&
      parsed.origin === currentOrigin &&
      parsed.origin !== siteOrigin
    ) {
      return new URL(`${parsed.pathname}${parsed.search}`, siteOrigin).href;
    }
    parsed.hash = "";
    return parsed.href;
  } catch {
    return undefined;
  }
}

function upsertLinkTarget(
  targets: Map<string, OverlayLinkTarget>,
  url: string,
  anchor: HTMLAnchorElement
): void {
  const existing = targets.get(url);
  if (existing !== undefined) {
    targets.set(url, { ...existing, count: existing.count + 1 });
    return;
  }
  const label =
    anchor.textContent?.replace(/\s+/g, " ").trim() ||
    anchor.getAttribute("aria-label") ||
    anchor.getAttribute("title") ||
    url;
  const rel = anchor.getAttribute("rel")?.trim();
  const target = anchor.getAttribute("target")?.trim();
  targets.set(url, {
    url,
    label,
    count: 1,
    ...(rel === undefined || rel === "" ? {} : { rel }),
    ...(target === undefined || target === "" ? {} : { target })
  });
}

function sortLinkTargets(
  targets: readonly OverlayLinkTarget[]
): readonly OverlayLinkTarget[] {
  return [...targets].sort((left, right) => {
    if (right.count !== left.count) return right.count - left.count;
    return left.url.localeCompare(right.url);
  });
}

function createUnavailableBacklinkState(): OverlayBacklinkState {
  return {
    status: "not-configured",
    message:
      "Connect a backlink provider to fetch backlinks, referring domains, and link quality."
  };
}

export function resolvePageSpeedPageUrl(
  document: Document,
  siteUrl?: string
): string | undefined {
  const pathname = document.location.pathname || "/";
  const search =
    "search" in document.location &&
    typeof document.location.search === "string"
      ? document.location.search
      : "";
  if (siteUrl !== undefined) {
    try {
      const base = new URL(siteUrl);
      if (base.protocol === "http:" || base.protocol === "https:") {
        return new URL(`${pathname}${search}`, base).href;
      }
    } catch {
      return undefined;
    }
  }
  try {
    const current = new URL(document.location.href);
    if (
      (current.protocol === "http:" || current.protocol === "https:") &&
      !isLocalhost(current.hostname)
    ) {
      return current.href;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function isLocalhost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.endsWith(".localhost")
  );
}

function createPendingPageSpeedState(
  strategy: "mobile" | "desktop",
  pageUrl: string | undefined,
  apiKey: string | undefined
): OverlayPageSpeedState {
  if (pageUrl === undefined) {
    return {
      source: "google-pagespeed",
      status: "unavailable",
      strategy,
      message:
        "Google PageSpeed requires a public siteUrl; localhost cannot be crawled."
    };
  }
  if (apiKey === undefined || apiKey === "") {
    return {
      source: "google-pagespeed",
      status: "unavailable",
      strategy,
      pageUrl,
      message:
        "Set SEARCHLINT_PAGESPEED_API_KEY to fetch Google PageSpeed scores."
    };
  }
  return {
    source: "google-pagespeed",
    status: "checking",
    strategy,
    pageUrl,
    message: "Fetching Google PageSpeed scores..."
  };
}

async function refreshPageSpeedMetrics(
  runtime: SearchLintOverlayRuntime,
  pageUrl: string | undefined,
  strategy: "mobile" | "desktop",
  apiKey: string | undefined,
  fetchOverride: PageSpeedFetch | undefined
): Promise<void> {
  if (pageUrl === undefined) return;
  const fetchPageSpeed = fetchOverride ?? globalThis.fetch?.bind(globalThis);
  if (fetchPageSpeed === undefined) {
    runtime.update({
      externalMetrics: {
        pageSpeed: {
          source: "google-pagespeed",
          status: "unavailable",
          strategy,
          pageUrl,
          message: "Fetch is unavailable in this browser runtime."
        }
      }
    });
    return;
  }
  try {
    const pageSpeed =
      fetchOverride === undefined
        ? await fetchCachedGooglePageSpeed(
            pageUrl,
            strategy,
            apiKey,
            fetchPageSpeed as PageSpeedFetch
          )
        : await fetchGooglePageSpeed(
            pageUrl,
            strategy,
            apiKey,
            fetchPageSpeed as PageSpeedFetch
          );
    runtime.update({
      externalMetrics: {
        pageSpeed
      }
    });
  } catch (error) {
    runtime.update({
      externalMetrics: {
        pageSpeed: {
          source: "google-pagespeed",
          status: "error",
          strategy,
          pageUrl,
          fetchedAt: new Date().toISOString(),
          message:
            error instanceof Error
              ? error.message
              : "Google PageSpeed request failed."
        }
      }
    });
  }
}

function fetchCachedGooglePageSpeed(
  pageUrl: string,
  strategy: "mobile" | "desktop",
  apiKey: string | undefined,
  fetchPageSpeed: PageSpeedFetch
): Promise<OverlayPageSpeedState> {
  const cacheKey = JSON.stringify([pageUrl, strategy, apiKey ?? ""]);
  const now = Date.now();
  const existing = pageSpeedCache.get(cacheKey);
  if (existing !== undefined && now - existing.createdAt < pageSpeedCacheTtlMs) {
    return existing.promise;
  }

  const promise = fetchGooglePageSpeed(
    pageUrl,
    strategy,
    apiKey,
    fetchPageSpeed
  ).catch((error: unknown) => {
    pageSpeedCache.delete(cacheKey);
    throw error;
  });
  pageSpeedCache.set(cacheKey, { createdAt: now, promise });
  return promise;
}

export async function fetchGooglePageSpeed(
  pageUrl: string,
  strategy: "mobile" | "desktop",
  apiKey: string | undefined,
  fetchPageSpeed: PageSpeedFetch
): Promise<OverlayPageSpeedState> {
  const endpoint = new URL(
    "https://www.googleapis.com/pagespeedonline/v5/runPagespeed"
  );
  endpoint.searchParams.set("url", pageUrl);
  endpoint.searchParams.set("strategy", strategy);
  if (apiKey !== undefined && apiKey !== "") {
    endpoint.searchParams.set("key", apiKey);
  }
  for (const category of [
    "performance",
    "accessibility",
    "best-practices",
    "seo"
  ]) {
    endpoint.searchParams.append("category", category);
  }

  const response = await fetchPageSpeed(endpoint.href);
  if (!response.ok) {
    throw new Error(`Google PageSpeed returned HTTP ${response.status}.`);
  }
  return parseGooglePageSpeedResponse(
    await response.json(),
    pageUrl,
    strategy,
    new Date().toISOString()
  );
}

export function parseGooglePageSpeedResponse(
  payload: unknown,
  pageUrl: string,
  strategy: "mobile" | "desktop",
  fetchedAt: string
): OverlayPageSpeedState {
  const lighthouseResult = readRecord(payload).lighthouseResult;
  const lighthouse = readRecord(lighthouseResult);
  const categories = readRecord(lighthouse.categories);
  const audits = readRecord(lighthouse.audits);
  return {
    source: "google-pagespeed",
    status: "available",
    strategy,
    pageUrl,
    fetchedAt,
    scores: compactOptionalNumbers({
      performance: readCategoryScore(categories.performance),
      accessibility: readCategoryScore(categories.accessibility),
      bestPractices: readCategoryScore(categories["best-practices"]),
      seo: readCategoryScore(categories.seo)
    }),
    vitals: compactOptionalNumbers({
      lcpMs: readAuditNumericValue(audits["largest-contentful-paint"]),
      fcpMs: readAuditNumericValue(audits["first-contentful-paint"]),
      tbtMs: readAuditNumericValue(audits["total-blocking-time"]),
      cls: readAuditNumericValue(audits["cumulative-layout-shift"])
    })
  };
}

function compactOptionalNumbers<
  TShape extends Record<string, number | undefined>
>(input: TShape): { [TKey in keyof TShape]?: number } {
  return Object.fromEntries(
    Object.entries(input).filter((entry): entry is [string, number] => {
      return typeof entry[1] === "number";
    })
  ) as { [TKey in keyof TShape]?: number };
}

function readRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function readCategoryScore(value: unknown): number | undefined {
  const score = readRecord(value).score;
  return typeof score === "number" ? score * 100 : undefined;
}

function readAuditNumericValue(value: unknown): number | undefined {
  const numericValue = readRecord(value).numericValue;
  return typeof numericValue === "number" ? numericValue : undefined;
}

function createRules(
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

initializeSearchLintDevClient();
