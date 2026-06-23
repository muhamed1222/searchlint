export type Severity = "blocker" | "error" | "warning" | "info";

export type Confidence = "certain" | "likely" | "heuristic";

export type DiagnosticSource =
  | "source-code"
  | "raw-html"
  | "rendered-dom"
  | "http-header"
  | "robots-txt"
  | "sitemap"
  | "crawler"
  | "google"
  | "yandex";

export type SourceLocationConfidence =
  | "EXACT"
  | "RELATED"
  | "RUNTIME"
  | "EXTERNAL";

export type StructuredEvidence =
  | {
      type: "text";
      label: string;
      value: string;
    }
  | {
      type: "record";
      label: string;
      value: Readonly<Record<string, string | number | boolean | null>>;
    };

export type SourceLocation = {
  confidence: SourceLocationConfidence;
  file?: string;
  line?: number;
  selector?: string;
};

export type SourceRouterKind = "app" | "pages";

export type SourceMetadataField =
  | "title"
  | "description"
  | "robots"
  | "alternates"
  | "openGraph"
  | "twitter";

export type SourceRouteMetadataMode =
  | "none"
  | "static"
  | "dynamic"
  | "static-and-dynamic";

export type SourceRouteMetadataStaticField = {
  field: SourceMetadataField;
  file: string;
  inherited: boolean;
};

export type SourceRouteMetadataDynamicContribution = {
  file: string;
  inherited: boolean;
};

export type SourceRouteMetadataSummary = {
  route: string;
  router: SourceRouterKind;
  pageFile: string;
  metadataMode: SourceRouteMetadataMode;
  staticFields: readonly SourceRouteMetadataStaticField[];
  dynamicMetadata: readonly SourceRouteMetadataDynamicContribution[];
};

export type SourceRouteSocialImageSummary = {
  route?: string;
  router?: SourceRouterKind;
  openGraphImageFiles: readonly string[];
  twitterImageFiles: readonly string[];
};

export type SourceCodeFindingKind =
  | "next-route"
  | "static-metadata-object"
  | "static-metadata-field"
  | "generate-metadata"
  | "pages-head"
  | "robots-file"
  | "sitemap-file"
  | "generate-sitemaps"
  | "generate-static-params"
  | "opengraph-image-file"
  | "twitter-image-file"
  | "middleware-file"
  | "proxy-file"
  | "next-config-redirects"
  | "next-config-rewrites"
  | "next-image-unoptimized";

export type SourceConfigRouteEntry = {
  source: string;
  destination: string;
  permanent?: boolean;
};

export type SourceCodeFinding = {
  kind: SourceCodeFindingKind;
  file: string;
  location: SourceLocation;
  router?: SourceRouterKind;
  route?: string;
  field?: SourceMetadataField;
  configRouteEntries?: readonly SourceConfigRouteEntry[];
  exportName?:
    | "metadata"
    | "generateMetadata"
    | "Head"
    | "robots"
    | "sitemap"
    | "generateSitemaps"
    | "generateStaticParams"
    | "opengraph-image"
    | "twitter-image"
    | "middleware"
    | "proxy"
    | "redirects"
    | "rewrites";
};

export type DiagnosticInput = {
  ruleId: string;
  severity: Severity;
  confidence: Confidence;
  pageUrl: string;
  route?: string;
  source: DiagnosticSource;
  title: string;
  evidence: string;
  expected?: string;
  actual?: string;
  sourceLocation?: SourceLocation;
  structuredEvidence?: readonly StructuredEvidence[];
  observedAt: string;
};

export type Diagnostic = DiagnosticInput & {
  id: string;
  fingerprint: string;
};

export type ExternalObservationFreshness =
  | "fresh"
  | "stale"
  | "expired"
  | "unknown";

export type GoogleWebVitalMetric = {
  value?: number;
  unit: "ms" | "score";
  dataSource: "pagespeed" | "crux" | "field" | "lab";
  rating?: "good" | "needs-improvement" | "poor";
  poorThreshold?: number;
};

export type ExternalObservation = {
  provider: "google" | "yandex";
  observedAt: string;
  fetchedAt: string;
  freshness: ExternalObservationFreshness;
  indexability?: {
    indexed?: boolean;
    searchable?: boolean;
    state?: string;
    reason?: string;
  };
  canonical?: {
    googleSelected?: string;
    userDeclared?: string;
  };
  richResults?: {
    available?: boolean;
    state?: string;
    eligibleTypes?: readonly string[];
  };
  webVitals?: {
    lcp?: GoogleWebVitalMetric;
    cls?: GoogleWebVitalMetric;
    inp?: GoogleWebVitalMetric;
  };
  sampling?: {
    sampled: boolean;
    state?: string;
  };
  quota?: {
    limit?: number;
    remaining?: number;
    resetAt?: string;
  };
};

export type HttpSnapshot = {
  statusCode?: number;
  finalUrl: string;
  headers: Readonly<Record<string, string>>;
  redirectChain: readonly string[];
  redirectPolicyMaxHops?: number;
};

export type TextArtifactSnapshot = {
  url: string;
  statusCode?: number;
  contentType?: string;
  body?: string;
};

export type ResolvedUrlSnapshot = {
  url: string;
  statusCode?: number;
  finalUrl?: string;
  headers?: Readonly<Record<string, string>>;
  redirectChain?: readonly string[];
  rawHtml?: string;
  capturedAt?: string;
};

export type SiteGraphPageSnapshot = {
  url: string;
  statusCode?: number;
  finalUrl?: string;
  redirectChain?: readonly string[];
  canonicalUrl?: string;
  hreflangLinks?: readonly {
    hreflang: string;
    url: string;
  }[];
  assetUrls?: readonly string[];
  pagination?: {
    previousUrl?: string;
    nextUrl?: string;
  };
  title?: string;
  description?: string;
  indexable?: boolean;
  soft404Signals?: readonly string[];
  crawlDepth?: number;
  important?: boolean;
  crawlDepthPolicyMax?: number;
};

export type SiteGraphLinkSnapshot = {
  sourceUrl: string;
  targetUrl: string;
  rel?: string;
  text?: string;
};

export type SiteGraphSnapshot = {
  pages: readonly SiteGraphPageSnapshot[];
  links: readonly SiteGraphLinkSnapshot[];
  internalNofollowPolicyMaxRatio?: number;
  internalNofollowPolicyMaxCount?: number;
};

export type PageSnapshot = {
  pageUrl: string;
  route?: string;
  capturedAt: string;
  sourceCode?: {
    files: readonly {
      path: string;
      content: string;
    }[];
    findings?: readonly SourceCodeFinding[];
    routeMetadata?: readonly SourceRouteMetadataSummary[];
    routeSocialImages?: readonly SourceRouteSocialImageSummary[];
  };
  http?: HttpSnapshot;
  rawHtml?: string;
  renderedDom?: string;
  robotsTxt?: TextArtifactSnapshot;
  sitemap?: TextArtifactSnapshot;
  resolvedUrls?: readonly ResolvedUrlSnapshot[];
  siteGraph?: SiteGraphSnapshot;
  metadataTiming?: {
    availableAtMs: number;
    policyMaxMs: number;
  };
  externalObservations?: readonly ExternalObservation[];
};

export type RouteContract = {
  route: string;
  indexable: boolean;
  canonicalPolicy?: "self" | "custom";
  googleRichResult?: {
    required: boolean;
    eligibleTypes?: readonly string[];
  };
  requiredHeadings?: readonly {
    level: 1 | 2 | 3 | 4 | 5 | 6;
    pattern: string;
  }[];
  requiredSchemas?: readonly string[];
  hreflang?: readonly string[];
  requiredSeverityOverrides?: Readonly<Record<string, Severity>>;
  pagination?: {
    required: boolean;
  };
  important?: boolean;
  crawlDepthPolicyMax?: number;
};

export type RuleContext = {
  snapshot: PageSnapshot;
  routeContract?: RouteContract;
  now: string;
};

export type RuleReport = Omit<
  DiagnosticInput,
  "ruleId" | "observedAt" | "severity" | "confidence"
> & {
  severity?: Severity;
  confidence?: Confidence;
  observedAt?: string;
};

export type MaybePromise<T> = T | Promise<T>;

export type Rule = {
  id: string;
  defaultSeverity: Severity;
  defaultConfidence: Confidence;
  sources: readonly DiagnosticSource[];
  dependencies?: readonly string[];
  priority?: number;
  run(context: RuleContext): MaybePromise<readonly RuleReport[]>;
};

export type SeverityOverrides = Readonly<Record<string, Severity>>;

export type Suppression = {
  ruleId: string;
  reason: string;
  pageUrl?: string;
  route?: string;
};

export type RuleEngineOptions = {
  now?: string;
  severityOverrides?: SeverityOverrides;
  suppressions?: readonly Suppression[];
};

export type RuleEngineInput = {
  rules: readonly Rule[];
  snapshot: PageSnapshot;
  routeContract?: RouteContract;
  routeContracts?: readonly RouteContract[];
  options?: RuleEngineOptions;
};

export type RuleEngineResult = {
  diagnostics: readonly Diagnostic[];
  executedRuleIds: readonly string[];
};
