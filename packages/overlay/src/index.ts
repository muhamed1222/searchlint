import type { Diagnostic, Severity } from "@searchlint/core";

export type BadgeState =
  | "checking"
  | "clean"
  | "info"
  | "warnings"
  | "errors"
  | "blocked";

export type DiagnosticCategory =
  | "http-rendering"
  | "indexability"
  | "title-metadata"
  | "canonical-hreflang"
  | "headings-structure"
  | "images-social-preview"
  | "schema-org"
  | "links-site-graph"
  | "robots-sitemaps"
  | "performance"
  | "unknown";

export type OverlayFilters = {
  severity?: Severity | "all";
  category?: DiagnosticCategory | "all";
  source?: Diagnostic["source"] | "all";
};

export type OverlayPosition = "right" | "left";

export type OverlayDirection = "ltr" | "rtl";

export type OverlayLanguage = "en" | "ru";

export type OverlayRenderDiagnostic = Diagnostic & {
  explanation?: string;
  rawHtmlSnippet?: string;
  renderedDomSnippet?: string;
};

export type OverlayMetricStatus = "pass" | "warn" | "error" | "unknown";

export type OverlayLocalPerformance = {
  source: "browser-performance";
  capturedAt: string;
  viewport?: {
    width: number;
    height: number;
  };
  fcpMs?: number;
  lcpMs?: number;
  tbtMs?: number;
  cls?: number;
  loadMs?: number;
  domContentLoadedMs?: number;
};

export type OverlayPageSpeedCategoryScores = {
  performance?: number;
  accessibility?: number;
  bestPractices?: number;
  seo?: number;
};

export type OverlayPageSpeedVitals = {
  lcpMs?: number;
  fcpMs?: number;
  tbtMs?: number;
  cls?: number;
};

export type OverlayPageSpeedState = {
  source: "google-pagespeed";
  status: "not-configured" | "checking" | "available" | "unavailable" | "error";
  strategy: "mobile" | "desktop";
  pageUrl?: string;
  fetchedAt?: string;
  scores?: OverlayPageSpeedCategoryScores;
  vitals?: OverlayPageSpeedVitals;
  message?: string;
};

export type OverlayExternalMetrics = {
  pageSpeed?: OverlayPageSpeedState;
};

export type OverlayLinkTarget = {
  url: string;
  label: string;
  count: number;
  rel?: string;
  target?: string;
  status?: OverlayMetricStatus;
};

export type OverlayBacklinkState = {
  status: "not-configured" | "available" | "unavailable" | "error";
  provider?: string;
  fetchedAt?: string;
  backlinks?: number;
  referringDomains?: number;
  qualityScore?: number;
  message?: string;
};

export type OverlayLinkAudit = {
  source: "browser-dom";
  capturedAt: string;
  pageUrl: string;
  siteOrigin?: string;
  internalLinks: readonly OverlayLinkTarget[];
  externalLinks: readonly OverlayLinkTarget[];
  backlinks?: OverlayBacklinkState;
};

export type OverlayTechnicalMetric = {
  label: string;
  value?: string;
  status?: OverlayMetricStatus;
};

export type OverlayTechnicalAudit = {
  source: "browser-dom";
  capturedAt: string;
  pageUrl: string;
  score: number;
  overview: readonly OverlayTechnicalMetric[];
  timings: readonly OverlayTechnicalMetric[];
  renderBlocking: readonly OverlayTechnicalMetric[];
  relevance: readonly OverlayTechnicalMetric[];
  openGraph: readonly OverlayTechnicalMetric[];
  twitter: readonly OverlayTechnicalMetric[];
};

export type OverlayGeoSignal = {
  label: string;
  value: string;
  status?: OverlayMetricStatus;
  detail?: string;
};

export type OverlayGeoMarketPage = {
  url: string;
  label: string;
  market: string;
  locale?: string;
  links: number;
  status?: OverlayMetricStatus;
};

export type OverlayGeoAudit = {
  source: "browser-dom";
  capturedAt: string;
  pageUrl: string;
  score: number;
  primaryMarket: string;
  detectedLanguage: string;
  locale: string;
  hreflangStatus: "present" | "missing";
  localIntent: string;
  languageSignals: readonly OverlayGeoSignal[];
  regionalSignals: readonly OverlayGeoSignal[];
  marketCoverage: readonly OverlayGeoMarketPage[];
  providers: readonly OverlayGeoSignal[];
};

export type OverlaySiteEssentialStatus =
  | "pass"
  | "issue"
  | "not-proven"
  | "provider-needed";

export type OverlaySiteEssential = {
  key: "robots" | "sitemap" | "llms" | "not-found" | "mobile" | "crawler";
  label: string;
  status: OverlaySiteEssentialStatus;
  detail: string;
  url?: string;
};

export type OverlaySiteEssentialsAudit = {
  source: "browser-dom" | "browser-fetch";
  capturedAt: string;
  pageUrl: string;
  essentials: readonly OverlaySiteEssential[];
};

type OverlayActionItem = {
  title: string;
  detail: string;
  status?: OverlayMetricStatus;
  diagnostic?: OverlayRenderDiagnostic;
  prompt?: string;
  source?: string;
  confidence?: string;
  evidence?: string;
};

type OverlayScoreItem = readonly [
  value: string,
  label: string,
  status: OverlayMetricStatus,
  reason?: string
];

export type SearchLintOverlayState = {
  status: BadgeState;
  diagnostics: readonly OverlayRenderDiagnostic[];
  filters?: OverlayFilters | undefined;
  pageUrl?: string;
  route?: string;
  position?: OverlayPosition;
  direction?: OverlayDirection;
  language?: OverlayLanguage;
  runtimeError?: string | undefined;
  suppressEnabled?: boolean;
  rerunEnabled?: boolean;
  maxRenderedDiagnostics?: number | undefined;
  actionMessage?: string | undefined;
  localPerformance?: OverlayLocalPerformance | undefined;
  linkAudit?: OverlayLinkAudit | undefined;
  technicalAudit?: OverlayTechnicalAudit | undefined;
  geoAudit?: OverlayGeoAudit | undefined;
  siteEssentials?: OverlaySiteEssentialsAudit | undefined;
  externalMetrics?: OverlayExternalMetrics | undefined;
};

export type SearchLintOverlayRuntimeOptions = {
  document: Document;
  initialDiagnostics?: readonly OverlayRenderDiagnostic[];
  onRerun?: () => void | Promise<void>;
  onSuppress?: (diagnostic: OverlayRenderDiagnostic) => void | Promise<void>;
  onCopy?: (diagnostic: OverlayRenderDiagnostic) => void | Promise<void>;
  observeNavigation?: boolean;
  observeMutations?: boolean;
};

export type SearchLintOverlayRuntime = {
  readonly host: HTMLElement;
  readonly shadowRoot: ShadowRoot;
  update(state: Partial<SearchLintOverlayState>): void;
  open(): void;
  close(): void;
  destroy(): void;
};

export type OverlayAccessibilityCheck = {
  id: string;
  pass: boolean;
  message: string;
};

export type OverlayAccessibilityReport = {
  passed: boolean;
  checks: readonly OverlayAccessibilityCheck[];
};

type OverlayPositionReader = Pick<Storage, "getItem">;
type OverlayPositionWriter = Pick<Storage, "setItem">;
const feedTabs = ["seo", "links", "technical", "geo"] as const;
type OverlayFeedTab = (typeof feedTabs)[number];
const feedTabLabels: Record<OverlayLanguage, Record<OverlayFeedTab, string>> = {
  en: {
    seo: "SEO",
    links: "Links",
    technical: "Technical",
    geo: "GEO"
  },
  ru: {
    seo: "SEO",
    links: "Ссылки",
    technical: "Техника",
    geo: "GEO"
  }
};

const hostId = "searchlint-dev-overlay";
const panelId = "searchlint-panel";
const panelTitleId = "searchlint-panel-title";
const panelDescriptionId = "searchlint-panel-description";
const highlightedAttribute = "data-searchlint-highlighted";
const positionStorageKey = "searchlint.overlay.position";
const languageStorageKey = "searchlint.overlay.language";
const dragClickThresholdPx = 6;
const defaultMaxRenderedDiagnostics = 200;
const overlayAnimationMs = 220;
const severityOrder: Record<Severity, number> = {
  info: 1,
  warning: 2,
  error: 3,
  blocker: 4
};
const severityLabels: Record<Severity, string> = {
  blocker: "Blocker",
  error: "Error",
  warning: "Warning",
  info: "Note"
};
const categoryLabels: Record<DiagnosticCategory, string> = {
  "http-rendering": "HTTP & rendering",
  indexability: "Indexability",
  "title-metadata": "Title & metadata",
  "canonical-hreflang": "Canonical & hreflang",
  "headings-structure": "Headings & structure",
  "images-social-preview": "Images & social preview",
  "schema-org": "Schema.org",
  "links-site-graph": "Links & site graph",
  "robots-sitemaps": "Robots & sitemaps",
  performance: "Performance",
  unknown: "Unknown"
};
const sourceLabels: Record<Diagnostic["source"], string> = {
  "source-code": "Source code",
  "raw-html": "Raw HTML",
  "rendered-dom": "Rendered DOM",
  "http-header": "HTTP header",
  "robots-txt": "robots.txt",
  sitemap: "Sitemap",
  crawler: "Crawler",
  google: "Google",
  yandex: "Yandex"
};

export function deriveBadgeState(
  diagnostics: readonly Pick<Diagnostic, "severity">[],
  checking = false
): BadgeState {
  if (checking) {
    return "checking";
  }
  if (diagnostics.some((diagnostic) => diagnostic.severity === "blocker")) {
    return "blocked";
  }
  if (diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    return "errors";
  }
  if (diagnostics.some((diagnostic) => diagnostic.severity === "warning")) {
    return "warnings";
  }
  if (diagnostics.some((diagnostic) => diagnostic.severity === "info")) {
    return "info";
  }
  return "clean";
}

export function categoryForRuleId(ruleId: string): DiagnosticCategory {
  if (ruleId.startsWith("SL-HTTP-")) return "http-rendering";
  if (ruleId.startsWith("SL-INDEX-")) return "indexability";
  if (ruleId.startsWith("SL-META-")) return "title-metadata";
  if (ruleId.startsWith("SL-CANON-")) return "canonical-hreflang";
  if (ruleId.startsWith("SL-HEAD-")) return "headings-structure";
  if (ruleId.startsWith("SL-IMG-")) return "images-social-preview";
  if (ruleId.startsWith("SL-SCHEMA-")) return "schema-org";
  if (ruleId.startsWith("SL-LINK-")) return "links-site-graph";
  if (ruleId.startsWith("SL-ROBOTS-")) return "robots-sitemaps";
  if (ruleId.startsWith("SL-PERF-")) return "performance";
  return "unknown";
}

export function filterDiagnostics(
  diagnostics: readonly OverlayRenderDiagnostic[],
  filters: OverlayFilters = {}
): readonly OverlayRenderDiagnostic[] {
  return diagnostics.filter((diagnostic) => {
    if (
      filters.severity &&
      filters.severity !== "all" &&
      diagnostic.severity !== filters.severity
    ) {
      return false;
    }
    if (
      filters.category &&
      filters.category !== "all" &&
      categoryForRuleId(diagnostic.ruleId) !== filters.category
    ) {
      return false;
    }
    if (
      filters.source &&
      filters.source !== "all" &&
      diagnostic.source !== filters.source
    ) {
      return false;
    }
    return true;
  });
}

export function sortDiagnosticsByPriority(
  diagnostics: readonly OverlayRenderDiagnostic[]
): readonly OverlayRenderDiagnostic[] {
  return [...diagnostics].sort((left, right) => {
    const severityComparison =
      severityOrder[right.severity] - severityOrder[left.severity];
    if (severityComparison !== 0) return severityComparison;
    const ruleComparison = compareAscii(left.ruleId, right.ruleId);
    if (ruleComparison !== 0) return ruleComparison;
    return compareAscii(left.fingerprint, right.fingerprint);
  });
}

function compareAscii(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

export function updateOverlayFilters(
  currentFilters: OverlayFilters = {},
  name: string,
  value: string
): OverlayFilters {
  if (name === "severity" && isSeverityFilterValue(value)) {
    return { ...currentFilters, severity: value };
  }
  if (name === "category" && isCategoryFilterValue(value)) {
    return { ...currentFilters, category: value };
  }
  if (name === "source" && isSourceFilterValue(value)) {
    return { ...currentFilters, source: value };
  }
  return currentFilters;
}

export function renderBadgeLabel(
  state: BadgeState,
  count: number,
  diagnostics: readonly Pick<Diagnostic, "severity">[] = []
): string {
  if (state === "checking") return "SearchLint checking";
  if (state === "clean") return "SearchLint clean";
  if (count === 0) return `SearchLint ${stateLabel(state)}`;
  if (hasMixedDiagnosticSeverities(diagnostics)) {
    return `SearchLint ${pluralize(count, "issue")}: ${count}`;
  }
  return `SearchLint ${pluralize(count, stateCountLabel(state))}: ${count}`;
}

function renderBadgeVisibleText(
  state: BadgeState,
  count: number,
  diagnostics: readonly Pick<Diagnostic, "severity">[] = []
): string {
  if (state === "checking") return "checking";
  if (state === "clean") return "all good";
  if (count === 0) return stateLabel(state);
  if (hasMixedDiagnosticSeverities(diagnostics)) {
    return formatCount(count, "issue");
  }
  if (state === "blocked") return formatCount(count, "blocker");
  if (state === "warnings") return formatCount(count, "warning");
  if (state === "info") return formatCount(count, "note");
  return formatCount(count, "error");
}

function stateLabel(state: BadgeState): string {
  if (state === "blocked") return "blocked";
  if (state === "warnings") return "warning";
  if (state === "info") return "note";
  if (state === "checking") return "checking";
  if (state === "clean") return "all good";
  return "error";
}

function stateCountLabel(state: BadgeState): string {
  if (state === "blocked") return "blocker";
  if (state === "warnings") return "warning";
  if (state === "info") return "note";
  if (state === "checking") return "check";
  if (state === "clean") return "issue";
  return "error";
}

function hasMixedDiagnosticSeverities(
  diagnostics: readonly Pick<Diagnostic, "severity">[]
): boolean {
  if (diagnostics.length <= 1) {
    return false;
  }
  const firstSeverity = diagnostics[0]?.severity;
  return diagnostics.some(
    (diagnostic) => diagnostic.severity !== firstSeverity
  );
}

export function nearestOverlayPosition(
  viewportWidth: number,
  _viewportHeight: number,
  clientX: number,
  _clientY: number
): OverlayPosition {
  return clientX < viewportWidth / 2 ? "left" : "right";
}

export function parseOverlayPosition(
  value: string | null | undefined
): OverlayPosition | undefined {
  if (value === "right" || value === "left") {
    return value;
  }
  if (value === "bottom-right" || value === "top-right") return "right";
  if (value === "bottom-left" || value === "top-left") return "left";
  return undefined;
}

function parseFeedTab(value: string | undefined): OverlayFeedTab | undefined {
  return feedTabs.find((tab) => tab === value);
}

function parseOverlayLanguage(
  value: string | null | undefined
): OverlayLanguage | undefined {
  if (value === "en" || value === "ru") return value;
  return undefined;
}

function nextOverlayLanguage(language: OverlayLanguage): OverlayLanguage {
  return language === "en" ? "ru" : "en";
}

function readStoredOverlayLanguage(
  storage: OverlayPositionReader | null | undefined
): OverlayLanguage | undefined {
  if (storage === null || storage === undefined) {
    return undefined;
  }
  try {
    return parseOverlayLanguage(storage.getItem(languageStorageKey));
  } catch {
    return undefined;
  }
}

function writeStoredOverlayLanguage(
  storage: OverlayPositionWriter | null | undefined,
  language: OverlayLanguage
): boolean {
  if (storage === null || storage === undefined) {
    return false;
  }
  try {
    storage.setItem(languageStorageKey, language);
    return true;
  } catch {
    return false;
  }
}

export function readStoredOverlayPosition(
  storage: OverlayPositionReader | null | undefined
): OverlayPosition | undefined {
  if (storage === null || storage === undefined) {
    return undefined;
  }
  try {
    return parseOverlayPosition(storage.getItem(positionStorageKey));
  } catch {
    return undefined;
  }
}

export function writeStoredOverlayPosition(
  storage: OverlayPositionWriter | null | undefined,
  position: OverlayPosition
): boolean {
  if (storage === null || storage === undefined) {
    return false;
  }
  try {
    storage.setItem(positionStorageKey, position);
    return true;
  } catch {
    return false;
  }
}

export function trySetPointerCapture(
  element: Pick<HTMLElement, "setPointerCapture"> | null | undefined,
  pointerId: number
): boolean {
  if (element === null || element === undefined) {
    return false;
  }
  try {
    element.setPointerCapture(pointerId);
    return true;
  } catch {
    return false;
  }
}

export function tryReleasePointerCapture(
  element: Pick<HTMLElement, "releasePointerCapture"> | null | undefined,
  pointerId: number
): boolean {
  if (element === null || element === undefined) {
    return false;
  }
  try {
    element.releasePointerCapture(pointerId);
    return true;
  } catch {
    return false;
  }
}

export function renderOverlayHtml(state: SearchLintOverlayState): string {
  const diagnostics = sortDiagnosticsByPriority(
    filterDiagnostics(state.diagnostics, state.filters)
  );
  const visibleDiagnostics = limitRenderedDiagnostics(
    diagnostics,
    state.maxRenderedDiagnostics
  );
  const total = state.diagnostics.length;
  const badgeLabel = renderBadgeLabel(state.status, total, state.diagnostics);
  const position = state.position ?? "right";
  const direction = state.direction ?? "ltr";
  const language = state.language ?? "en";
  return `${renderStyles()}
<div class="sl-drawer sl-position--${position}" dir="${direction}" data-state="closed">
  <button class="sl-badge sl-badge--${state.status}" type="button" aria-label="${escapeHtml(badgeLabel)}" aria-haspopup="dialog" aria-controls="${panelId}" aria-expanded="false" data-action="toggle">
    <span class="sl-badge__text" aria-hidden="false" aria-live="polite" aria-atomic="true"><span class="sl-badge__status">${escapeHtml(labelForBadgeToggle(false, language))}</span></span>
    <span class="sl-badge__logo" aria-hidden="true">${renderSearchLintLogo()}</span>
  </button>
  <section id="${panelId}" class="sl-panel" role="dialog" aria-modal="false" aria-labelledby="${panelTitleId}" aria-describedby="${panelDescriptionId}" hidden tabindex="-1">
    <header class="sl-panel__header">
      <div class="sl-panel__title">
        <span class="sl-panel__mark" aria-hidden="true">${renderFeedIcon("rss")}</span>
        <h2 id="${panelTitleId}">SearchLint</h2>
        <span class="sl-panel__live" aria-hidden="true"></span>
        <p id="${panelDescriptionId}" class="sl-context">${escapeHtml(language === "ru" ? "SEO диагностика" : "SEO diagnostics")}${state.pageUrl ? ` · ${escapeHtml(state.pageUrl)}` : ""}${state.route ? ` · ${escapeHtml(state.route)}` : ""}</p>
      </div>
    </header>
    <div class="sl-panel__scroll">
      ${renderFeedTabs(language)}
      ${renderSeoFeed({
        allDiagnostics: state.diagnostics,
        matchingDiagnostics: diagnostics,
        visibleDiagnostics,
        filters: state.filters,
        filtered: hasActiveFilters(state.filters),
        runtimeError: state.runtimeError,
        actionMessage: state.actionMessage,
        suppressEnabled: state.suppressEnabled === true,
        language,
        pageUrl: state.pageUrl,
        localPerformance: state.localPerformance,
        linkAudit: state.linkAudit,
        technicalAudit: state.technicalAudit,
        geoAudit: state.geoAudit,
        siteEssentials: state.siteEssentials,
        externalMetrics: state.externalMetrics
      })}
    </div>
  </section>
</div>`;
}

export function formatDiagnosticForClipboard(
  diagnostic: OverlayRenderDiagnostic
): string {
  const lines = [
    `SearchLint diagnostic: ${diagnostic.ruleId}`,
    `Severity: ${severityLabels[diagnostic.severity]}`,
    `Title: ${diagnostic.title}`,
    diagnostic.explanation
      ? `Explanation: ${diagnostic.explanation}`
      : undefined,
    `Evidence: ${diagnostic.evidence}`,
    `URL: ${diagnostic.pageUrl}`,
    diagnostic.route ? `Route: ${diagnostic.route}` : undefined,
    `Confidence: ${diagnostic.confidence}`,
    `Source: ${sourceLabels[diagnostic.source]}`,
    diagnostic.expected ? `Expected: ${diagnostic.expected}` : undefined,
    diagnostic.actual ? `Actual: ${diagnostic.actual}` : undefined
  ];
  const location = diagnostic.sourceLocation;
  if (location?.confidence === "EXACT" && location.file) {
    lines.push(
      `File: ${location.file}${location.line ? `:${location.line}` : ""}`
    );
  }
  if (location?.selector) {
    lines.push(`Selector: ${location.selector}`);
  }
  return lines.filter((line): line is string => line !== undefined).join("\n");
}

export function formatDiagnosticFixPrompt(
  diagnostic: OverlayRenderDiagnostic
): string {
  const parts = [
    `Fix this SearchLint SEO issue: ${diagnostic.ruleId}`,
    `Title: ${diagnostic.title}`,
    `Severity: ${severityLabels[diagnostic.severity]}`,
    `Impact: ${impactForDiagnostic(diagnostic)}`,
    `Page: ${diagnostic.pageUrl}`,
    diagnostic.route ? `Route: ${diagnostic.route}` : undefined,
    `Evidence: ${diagnostic.evidence}`,
    diagnostic.expected ? `Expected: ${diagnostic.expected}` : undefined,
    diagnostic.actual ? `Actual: ${diagnostic.actual}` : undefined,
    diagnostic.sourceLocation?.selector
      ? `Selector: ${diagnostic.sourceLocation.selector}`
      : undefined,
    diagnostic.sourceLocation?.file
      ? `File: ${diagnostic.sourceLocation.file}${diagnostic.sourceLocation.line ? `:${diagnostic.sourceLocation.line}` : ""}`
      : undefined,
    "",
    "Instructions:",
    "- Keep the visual design unchanged.",
    "- Make the smallest code change that fixes this issue.",
    "- Do not refactor unrelated code.",
    "- Re-run SearchLint after the fix and confirm this rule is gone."
  ];
  return parts.filter((part): part is string => part !== undefined).join("\n");
}

export function formatAllFixesPrompt(
  diagnostics: readonly OverlayRenderDiagnostic[]
): string {
  const ordered = diagnostics
    .slice()
    .sort((left, right) => {
      const severityDelta =
        severityOrder[right.severity] - severityOrder[left.severity];
      return severityDelta === 0
        ? left.ruleId.localeCompare(right.ruleId)
        : severityDelta;
    })
    .slice(0, 5);
  if (ordered.length === 0) {
    return "SearchLint found no SEO fixes on this page.";
  }
  return [
    "Fix these SearchLint SEO issues on the current page.",
    "Keep the visual design unchanged. Make the smallest safe code changes. Do not refactor unrelated code. Re-run SearchLint after the fixes.",
    "",
    ...ordered.map(
      (diagnostic, index) =>
        `${index + 1}. ${diagnostic.ruleId} — ${diagnostic.title}\nSeverity: ${severityLabels[diagnostic.severity]}\nImpact: ${impactForDiagnostic(diagnostic)}\nEvidence: ${diagnostic.evidence}${diagnostic.sourceLocation?.selector ? `\nSelector: ${diagnostic.sourceLocation.selector}` : ""}${diagnostic.expected ? `\nExpected: ${diagnostic.expected}` : ""}${diagnostic.actual ? `\nActual: ${diagnostic.actual}` : ""}`
    )
  ].join("\n");
}

function impactForDiagnostic(
  diagnostic: Pick<Diagnostic, "severity">,
  language: OverlayLanguage = "en"
): string {
  if (language === "ru") {
    if (diagnostic.severity === "blocker")
      return "Блокирует публикацию или индексацию";
    if (diagnostic.severity === "error") return "Высокое влияние";
    if (diagnostic.severity === "warning") return "Исправить скоро";
    return "Можно позже";
  }
  if (diagnostic.severity === "blocker") return "Blocks publishing or indexing";
  if (diagnostic.severity === "error") return "High impact";
  if (diagnostic.severity === "warning") return "Fix soon";
  return "Can wait";
}

function categoryLabelForLanguage(
  category: DiagnosticCategory,
  language: OverlayLanguage
): string {
  if (language !== "ru") return categoryLabels[category];
  if (category === "http-rendering") return "HTTP и рендеринг";
  if (category === "indexability") return "Индексация";
  if (category === "title-metadata") return "Title и metadata";
  if (category === "canonical-hreflang") return "Canonical и hreflang";
  if (category === "headings-structure") return "Заголовки";
  if (category === "images-social-preview") return "Изображения и preview";
  if (category === "schema-org") return "Schema";
  if (category === "links-site-graph") return "Ссылки и site graph";
  if (category === "robots-sitemaps") return "Robots и sitemap";
  if (category === "performance") return "Производительность";
  return "Другое";
}

function renderSearchLintLogo(): string {
  return `<svg viewBox="0 0 150 150" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
<rect width="150" height="150" fill="#151515"/>
<path d="M110.302 92.1471C113.502 88.7471 117.702 82.2471 117.702 75.4471C117.702 68.6471 113.202 62.547 110.202 59.047C108.202 56.747 107.502 54.847 109.702 52.247C112.402 49.647 117.502 44.647 117.702 40.547C117.802 37.747 116.302 33.347 106.302 33.047C97.002 32.747 90.902 33.8471 76.802 37.3471C75.602 37.6471 74.302 37.6471 73.502 37.4471C63.002 35.1471 56.602 33.347 48.802 33.047C40.902 32.847 33.702 33.3471 33.502 39.4471C33.502 43.4471 37.402 47.447 40.802 51.147C42.802 53.047 43.402 55.047 41.302 57.547C39.002 60.247 33.302 65.8471 33.002 74.0471C32.902 81.8471 36.602 87.4471 40.202 91.5471C42.402 93.9471 42.602 96.2471 40.202 98.5471C37.602 101.147 32.902 105.847 33.102 109.847C33.302 114.147 37.702 116.747 46.502 116.747C56.102 116.747 65.102 114.547 73.502 112.647C75.302 112.247 76.102 112.347 77.402 112.647L87.502 114.847C92.202 115.847 98.102 116.847 104.902 116.847C113.202 116.847 117.702 114.547 117.702 109.947C117.702 106.247 114.202 102.147 110.902 98.747C108.902 96.947 108.402 94.1471 110.302 92.1471ZM104.302 36.147C108.102 36.147 112.202 36.4471 113.102 39.3471C114.102 42.2471 110.402 46.4471 107.602 48.9471C104.902 51.6471 102.802 52.447 99.702 50.547C96.402 48.447 92.202 46.047 87.902 44.147C84.502 42.647 84.502 41.5471 84.702 40.4471C84.902 38.9471 88.102 38.2471 90.402 37.8471C94.002 37.1471 99.502 36.147 104.302 36.147ZM37.802 39.247C38.902 36.747 42.302 36.147 47.202 36.147C51.202 36.147 56.002 36.847 60.302 37.647C62.402 38.047 66.002 38.6471 65.402 40.9471C64.902 42.8471 60.902 43.947 57.102 46.047C55.002 47.047 52.802 48.3471 51.102 49.4471C48.902 50.9471 46.202 52.1471 43.902 49.9471C41.0495 47.6066 36.5426 42.1093 37.802 39.247ZM43.202 89.6471C40.702 87.0471 36.602 81.7471 36.602 75.4471C36.602 69.2471 39.902 64.947 42.702 61.547C44.602 59.347 45.902 57.847 48.302 57.847C49.902 57.847 51.102 58.647 51.902 59.247C57.102 63.047 63.102 66.9471 68.402 70.4471C70.302 71.7471 70.702 72.6471 70.502 73.9471C70.302 75.8471 68.502 76.7471 67.102 77.7471C61.502 81.4471 56.302 84.8471 50.302 89.2471C49.102 90.1471 48.102 90.9471 46.702 91.1471C45.202 91.3471 44.102 90.7471 43.202 89.6471ZM61.102 111.747C57.202 112.547 51.702 113.347 45.702 113.247C41.702 113.247 37.202 112.847 37.102 109.247C37.002 106.847 39.702 103.847 42.702 101.047C45.402 98.6471 47.002 98.147 50.202 99.647C52.102 100.847 56.402 103.447 60.902 105.447C63.602 106.647 66.002 107.747 65.202 109.647C64.702 110.747 62.502 111.447 61.102 111.747ZM76.902 107.247C75.002 107.647 74.302 107.447 72.502 106.947C67.802 105.647 63.202 103.647 57.402 100.547C54.002 98.6471 52.202 97.6471 51.702 96.6471C51.202 95.5471 51.002 94.2471 52.102 93.0471C53.802 91.1471 64.302 84.5471 71.902 79.7471C74.902 77.7471 77.202 76.8471 80.202 78.6471C81.702 79.4471 93.302 87.2471 97.302 90.1471C99.902 92.1471 100.202 92.847 100.002 94.447C99.702 96.347 97.202 97.647 94.002 99.347C91.6343 100.552 79.3027 106.742 76.902 107.247ZM75.8027 71.4473C74.3027 71.4473 72.702 70.647 71.502 69.847L59.702 61.747C55.702 59.047 53.002 57.4471 52.302 56.1471C51.702 54.9471 51.602 53.147 53.702 51.847C56.302 50.047 63.702 46.447 68.502 44.647L72.402 43.4471C73.402 43.1471 74.302 42.9471 75.002 42.9471C76.002 42.8471 77.802 43.247 80.202 44.047C84.302 45.347 89.002 47.547 92.102 49.247C97.202 51.947 98.902 52.847 99.202 54.247C99.902 56.647 97.702 57.947 95.302 59.747C89.902 63.547 81.102 69.1471 79.302 70.1471C78.5193 70.7163 77.3027 71.4473 75.8027 71.4473ZM107.402 89.347C105.902 90.947 103.502 92.147 100.902 90.347C96.702 87.247 89.902 82.5471 84.702 79.1471C82.702 77.7471 81.402 76.6471 81.402 74.9471C81.402 73.1471 83.402 72.0471 84.502 71.2471L99.402 61.1471C101.702 59.4471 102.502 58.247 104.802 58.247C106.602 58.247 107.702 59.247 109.002 60.747C110.402 62.347 114.702 67.747 114.702 74.847C114.702 81.147 109.902 87.047 107.402 89.347ZM107.303 99.9473C108.903 101.347 112.702 105.147 113.402 107.847C114.002 110.347 112.202 112.747 107.702 113.147C102.502 113.647 97.802 113.147 94.702 112.747C90.002 111.947 85.502 111.647 85.102 109.847C84.502 107.447 87.902 106.647 91.302 105.047C94.302 103.647 96.702 102.247 100.002 100.147C101.402 99.247 102.502 98.647 103.802 98.647C105.302 98.547 106.303 98.9473 107.303 99.9473Z" fill="url(#sl-logo-gradient)"/>
<defs><linearGradient id="sl-logo-gradient" x1="118" y1="75" x2="33" y2="75" gradientUnits="userSpaceOnUse"><stop stop-color="#E8E8E8"/><stop offset="1" stop-color="#575757"/></linearGradient></defs>
</svg>`;
}

function labelForBadgeToggle(open: boolean, language: OverlayLanguage): string {
  if (language === "ru") return open ? "Закрыть" : "Открыть";
  return open ? "Close" : "Open";
}

function renderRerunButton(language: OverlayLanguage): string {
  const title =
    language === "ru"
      ? "Обновить проверку SearchLint"
      : "Refresh SearchLint analysis";
  return `<button class="sl-icon-button" type="button" aria-label="${escapeHtml(title)}" title="${escapeHtml(title)}" data-action="rerun">
    ${renderRefreshIcon()}
  </button>`;
}

function renderLanguageSwitchButton(language: OverlayLanguage): string {
  const nextLanguage = nextOverlayLanguage(language);
  const label = nextLanguage.toLocaleUpperCase();
  const title =
    language === "ru"
      ? "Переключить язык на английский"
      : "Переключить язык на русский";
  return `<button class="sl-icon-button sl-language-button" type="button" aria-label="${escapeHtml(title)}" title="${escapeHtml(title)}" data-action="language-toggle">
    ${renderLanguageIcon()}
    <span class="sl-language-button__label">${escapeHtml(label)}</span>
  </button>`;
}

function renderRefreshIcon(): string {
  return `<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
    <path d="M15.5 7.5A5.8 5.8 0 0 0 5.2 5.4L3.5 7.1" />
    <path d="M3.5 3.6v3.5H7" />
    <path d="M4.5 12.5a5.8 5.8 0 0 0 10.3 2.1l1.7-1.7" />
    <path d="M16.5 16.4v-3.5H13" />
  </svg>`;
}

function renderLanguageIcon(): string {
  return `<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
    <circle cx="10" cy="10" r="7" />
    <path d="M3.5 10h13" />
    <path d="M10 3a10.2 10.2 0 0 1 0 14" />
    <path d="M10 3a10.2 10.2 0 0 0 0 14" />
  </svg>`;
}

export function createOverlayAccessibilityReport(
  state: SearchLintOverlayState
): OverlayAccessibilityReport {
  const html = renderOverlayHtml(state);
  const renderedDiagnosticCount = countRenderedDiagnosticsForState(state);
  const fallbackHtml = renderOverlayHtml({
    ...state,
    runtimeError: state.runtimeError ?? "SearchLint overlay fallback state."
  });
  const checks: OverlayAccessibilityCheck[] = [
    {
      id: "badge-controls-dialog",
      pass:
        html.includes('aria-haspopup="dialog"') &&
        html.includes(`aria-controls="${panelId}"`),
      message: "Badge exposes dialog popup relationship."
    },
    {
      id: "dialog-is-non-modal-and-labelled",
      pass:
        html.includes('role="dialog"') &&
        html.includes('aria-modal="false"') &&
        html.includes(`aria-labelledby="${panelTitleId}"`) &&
        html.includes(`aria-describedby="${panelDescriptionId}"`),
      message: "Overlay panel is a labelled non-modal dialog."
    },
    {
      id: "diagnostic-count-live-region",
      pass:
        html.includes('aria-live="polite"') &&
        html.includes('aria-atomic="true"'),
      message: "Diagnostic count is announced as a polite live region."
    },
    {
      id: "filter-controls-named",
      pass:
        html.includes('aria-label="Filter by severity"') &&
        html.includes('aria-label="Filter by category"') &&
        html.includes('aria-label="Filter by source"'),
      message: "Filter controls have accessible names."
    },
    {
      id: "list-semantics",
      pass:
        html.includes('role="list"') &&
        html.includes('aria-label="Diagnostics"'),
      message: "Diagnostic results use named list semantics."
    },
    {
      id: "action-controls-named",
      pass:
        !html.includes('data-action="language-toggle"') &&
        !html.includes('data-action="rerun"') &&
        (renderedDiagnosticCount === 0 ||
          html.includes("Copy diagnostic") ||
          html.includes("Диагностика")),
      message: "Available primary overlay actions have accessible names."
    },
    {
      id: "focus-visible-style",
      pass: html.includes(":focus-visible"),
      message: "Overlay exposes a visible keyboard focus style."
    },
    {
      id: "forced-colors-support",
      pass: html.includes("@media (forced-colors: active)"),
      message: "Overlay exposes forced-colors support."
    },
    {
      id: "reduced-motion-support",
      pass: html.includes("@media (prefers-reduced-motion: reduce)"),
      message: "Overlay exposes reduced-motion support."
    },
    {
      id: "runtime-error-fallback",
      pass: fallbackHtml.includes('role="alert"'),
      message: "Overlay can render a clear runtime error fallback."
    },
    {
      id: "no-inline-script",
      pass: !html.includes("<script"),
      message: "Overlay rendering does not inject inline scripts."
    }
  ];

  return {
    passed: checks.every((check) => check.pass),
    checks
  };
}

function countRenderedDiagnosticsForState(
  state: SearchLintOverlayState
): number {
  return limitRenderedDiagnostics(
    sortDiagnosticsByPriority(
      filterDiagnostics(state.diagnostics, state.filters)
    ),
    state.maxRenderedDiagnostics
  ).length;
}

export function createSearchLintOverlayRuntime(
  options: SearchLintOverlayRuntimeOptions
): SearchLintOverlayRuntime {
  const document = options.document;
  const host = document.createElement("searchlint-dev-overlay");
  host.id = hostId;
  host.setAttribute("data-searchlint", "overlay-host");
  const shadow = host.attachShadow({ mode: "open" });
  document.documentElement.append(host);

  const positionStorage = getOverlayPositionStorage(document);
  const storedPosition = readStoredOverlayPosition(positionStorage);
  const storedLanguage = readStoredOverlayLanguage(positionStorage);
  let state: SearchLintOverlayState = {
    status: deriveBadgeState(options.initialDiagnostics ?? []),
    diagnostics: options.initialDiagnostics ?? [],
    pageUrl: document.location?.href,
    route: document.location?.pathname,
    ...(storedPosition === undefined ? {} : { position: storedPosition }),
    ...(storedLanguage === undefined ? {} : { language: storedLanguage })
  };
  let isOpen = false;
  let activeFeedTab: OverlayFeedTab = "seo";
  let destroyed = false;
  let pendingMutationRerun = false;
  let suppressNextToggleClick = false;
  let suppressNextToggleClickResetTimer: number | undefined;
  let closeAnimationTimer: number | undefined;
  let dragState:
    | {
        pointerId: number;
        startX: number;
        startY: number;
        currentX: number;
        currentY: number;
        moved: boolean;
      }
    | undefined;
  const cleanupCallbacks: Array<() => void> = [];

  function render(): void {
    shadow.innerHTML = renderOverlayHtml({
      ...state,
      suppressEnabled: options.onSuppress !== undefined,
      rerunEnabled: options.onRerun !== undefined
    });
    const drawer = shadow.querySelector<HTMLElement>(".sl-drawer");
    const panel = shadow.querySelector<HTMLElement>(".sl-panel");
    const badge = shadow.querySelector<HTMLButtonElement>(".sl-badge");
    if (drawer) {
      drawer.dataset.state = isOpen ? "open" : "closed";
    }
    if (panel) {
      panel.hidden = !isOpen;
    }
    if (badge) {
      badge.setAttribute("aria-expanded", String(isOpen));
      const badgeStatus = badge.querySelector<HTMLElement>(".sl-badge__status");
      if (badgeStatus) {
        badgeStatus.textContent = labelForBadgeToggle(
          isOpen,
          state.language ?? "en"
        );
      }
    }
    applyActiveFeedTab();
  }

  function applyActiveFeedTab(): void {
    shadow
      .querySelectorAll<HTMLButtonElement>("[data-feed-tab]")
      .forEach((tab) => {
        const tabId = parseFeedTab(tab.dataset.feedTab);
        const active = tabId === activeFeedTab;
        tab.classList.toggle("sl-tab--active", active);
        tab.setAttribute("aria-selected", String(active));
        if (active) {
          tab.removeAttribute("tabindex");
        } else {
          tab.setAttribute("tabindex", "-1");
        }
      });
    shadow
      .querySelectorAll<HTMLElement>("[data-feed-section]")
      .forEach((section) => {
        const tabs = (section.dataset.feedSection ?? "").split(/\s+/);
        section.hidden = !tabs.includes(activeFeedTab);
      });
  }

  function open(focusPanel = true): void {
    clearCloseAnimationTimer();
    dragState = undefined;
    isOpen = true;
    render();
    if (focusPanel) {
      shadow.querySelector<HTMLElement>(".sl-panel")?.focus();
    }
  }

  function close(focusBadge = true): void {
    dragState = undefined;
    const drawer = shadow.querySelector<HTMLElement>(".sl-drawer");
    const panel = shadow.querySelector<HTMLElement>(".sl-panel");
    const badge = shadow.querySelector<HTMLElement>(".sl-badge");
    if (drawer && panel && !panel.hidden && badge) {
      drawer.style.transform = "";
      drawer.dataset.state = "closing";
      badge.setAttribute("aria-expanded", "false");
      clearCloseAnimationTimer();
      const finishClose = (): void => {
        clearCloseAnimationTimer();
        closeAnimationTimer = undefined;
        isOpen = false;
        render();
        if (focusBadge) {
          shadow.querySelector<HTMLElement>(".sl-badge")?.focus();
        }
      };
      const onAnimationEnd = (event: AnimationEvent): void => {
        if (event.target !== drawer) return;
        drawer.removeEventListener("animationend", onAnimationEnd);
        finishClose();
      };
      drawer.addEventListener("animationend", onAnimationEnd);
      closeAnimationTimer = document.defaultView?.setTimeout(() => {
        drawer.removeEventListener("animationend", onAnimationEnd);
        finishClose();
      }, overlayAnimationMs + 80);
      return;
    }
    isOpen = false;
    render();
    if (focusBadge) {
      shadow.querySelector<HTMLElement>(".sl-badge")?.focus();
    }
  }

  function update(nextState: Partial<SearchLintOverlayState>): void {
    state = mergeOverlayRuntimeState(state, nextState);
    render();
  }

  function destroy(): void {
    if (destroyed) return;
    destroyed = true;
    clearSuppressNextToggleClickResetTimer();
    clearCloseAnimationTimer();
    cleanupCallbacks.splice(0).forEach((cleanup) => cleanup());
    clearHighlights(document);
    host.remove();
  }

  function setActionMessage(message: string | undefined): void {
    state = { ...state, actionMessage: message };
    const existing = shadow.querySelector<HTMLElement>(".sl-action-status");
    if (message === undefined) {
      existing?.remove();
      return;
    }
    const statusHtml = renderActionStatus(message, state.language ?? "en");
    if (existing) {
      existing.outerHTML = statusHtml;
      return;
    }
    const feedBody = shadow.querySelector<HTMLElement>(".sl-feed-body");
    const anchor = feedBody?.querySelector<HTMLElement>(
      ".sl-runtime-error, .sl-audit-date"
    );
    if (feedBody && anchor) {
      anchor.insertAdjacentHTML("beforebegin", statusHtml);
    }
  }

  function rerun(showMessage = true): void {
    if (showMessage) {
      setActionMessage(
        state.language === "ru"
          ? "Обновляем проверку SearchLint..."
          : "Refreshing SearchLint analysis..."
      );
    }
    void options.onRerun?.();
  }

  function viewportSize(): { width: number; height: number } {
    const view = document.defaultView;
    return {
      width: view?.innerWidth ?? document.documentElement.clientWidth,
      height: view?.innerHeight ?? document.documentElement.clientHeight
    };
  }

  function clearSuppressNextToggleClickResetTimer(): void {
    if (suppressNextToggleClickResetTimer === undefined) {
      return;
    }
    document.defaultView?.clearTimeout(suppressNextToggleClickResetTimer);
    suppressNextToggleClickResetTimer = undefined;
  }

  function clearCloseAnimationTimer(): void {
    if (closeAnimationTimer === undefined) {
      return;
    }
    document.defaultView?.clearTimeout(closeAnimationTimer);
    closeAnimationTimer = undefined;
  }

  function scheduleSuppressNextToggleClickReset(): void {
    clearSuppressNextToggleClickResetTimer();
    suppressNextToggleClickResetTimer = document.defaultView?.setTimeout(() => {
      suppressNextToggleClick = false;
      suppressNextToggleClickResetTimer = undefined;
    }, 0);
  }

  function startBadgeDrag(event: PointerEvent): void {
    if (isOpen) return;
    if (event.button !== 0) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (!target.closest<HTMLElement>(".sl-badge")) return;

    dragState = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      currentX: event.clientX,
      currentY: event.clientY,
      moved: false
    };
    const badge = target.closest<HTMLElement>(".sl-badge");
    trySetPointerCapture(badge, event.pointerId);
  }

  function moveBadgeDrag(event: PointerEvent): void {
    if (dragState === undefined || event.pointerId !== dragState.pointerId) {
      return;
    }
    dragState.currentX = event.clientX;
    dragState.currentY = event.clientY;
    const deltaX = dragState.currentX - dragState.startX;
    const deltaY = dragState.currentY - dragState.startY;
    if (
      Math.hypot(deltaX, deltaY) >= dragClickThresholdPx &&
      !dragState.moved
    ) {
      dragState.moved = true;
    }
    const drawer = shadow.querySelector<HTMLElement>(".sl-drawer");
    if (drawer) {
      drawer.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
    }
  }

  function clearBadgeDragTransform(): void {
    const drawer = shadow.querySelector<HTMLElement>(".sl-drawer");
    if (drawer) {
      drawer.style.transform = "";
    }
  }

  function finishBadgeDrag(event: PointerEvent): void {
    if (dragState === undefined || event.pointerId !== dragState.pointerId) {
      return;
    }
    const finishedDrag = dragState;
    dragState = undefined;
    tryReleasePointerCapture(
      shadow.querySelector<HTMLElement>(".sl-badge"),
      event.pointerId
    );
    if (!finishedDrag.moved) {
      clearBadgeDragTransform();
      return;
    }

    const viewport = viewportSize();
    const position = nearestOverlayPosition(
      viewport.width,
      viewport.height,
      finishedDrag.currentX,
      finishedDrag.currentY
    );
    state = {
      ...state,
      position
    };
    writeStoredOverlayPosition(positionStorage, position);
    suppressNextToggleClick = true;
    scheduleSuppressNextToggleClickReset();
    clearBadgeDragTransform();
    render();
  }

  function cancelBadgeDrag(event: PointerEvent): void {
    if (dragState === undefined || event.pointerId !== dragState.pointerId) {
      return;
    }
    dragState = undefined;
    tryReleasePointerCapture(
      shadow.querySelector<HTMLElement>(".sl-badge"),
      event.pointerId
    );
    clearBadgeDragTransform();
  }

  shadow.addEventListener("pointerdown", (event) => {
    startBadgeDrag(event as PointerEvent);
  });

  function helpTarget(event: Event): HTMLElement | null {
    const target = event.target;
    if (!(target instanceof Element)) return null;
    return target.closest<HTMLElement>(".sl-help");
  }

  function hideHelpTooltips(except?: HTMLElement): void {
    shadow
      .querySelectorAll<HTMLElement>(".sl-help--visible")
      .forEach((help) => {
        if (help !== except) help.classList.remove("sl-help--visible");
      });
  }

  shadow.addEventListener("pointerover", (event) => {
    const help = helpTarget(event);
    if (help === null) return;
    hideHelpTooltips(help);
    help.classList.add("sl-help--visible");
  });

  shadow.addEventListener("pointerout", (event) => {
    const help = helpTarget(event);
    if (help === null) return;
    const relatedTarget = (event as PointerEvent).relatedTarget;
    if (relatedTarget instanceof Node && help.contains(relatedTarget)) return;
    help.classList.remove("sl-help--visible");
  });

  shadow.addEventListener("focusin", (event) => {
    const help = helpTarget(event);
    if (help === null) return;
    hideHelpTooltips(help);
    help.classList.add("sl-help--visible");
  });

  shadow.addEventListener("focusout", (event) => {
    const help = helpTarget(event);
    if (help === null) return;
    help.classList.remove("sl-help--visible");
  });

  shadow.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const clickedHelp = target.closest<HTMLElement>(".sl-help");
    if (clickedHelp !== null) {
      const visible = clickedHelp.classList.toggle("sl-help--visible");
      if (visible) hideHelpTooltips(clickedHelp);
      event.preventDefault();
      return;
    }
    const action = target.closest<HTMLElement>("[data-action]")?.dataset.action;
    const fingerprint =
      target.closest<HTMLElement>("[data-fingerprint]")?.dataset.fingerprint;
    const diagnostic = fingerprint
      ? state.diagnostics.find((item) => item.fingerprint === fingerprint)
      : undefined;

    if (action === "toggle") {
      if (suppressNextToggleClick) {
        suppressNextToggleClick = false;
        clearSuppressNextToggleClickResetTimer();
        event.preventDefault();
        return;
      }
      isOpen ? close(false) : open(false);
    }
    if (action === "close") close(false);
    if (action === "language-toggle") {
      const language = nextOverlayLanguage(state.language ?? "en");
      state = {
        ...state,
        language
      };
      writeStoredOverlayLanguage(positionStorage, language);
      render();
    }
    if (action === "feed-tab") {
      const tab = parseFeedTab(
        target.closest<HTMLElement>("[data-feed-tab]")?.dataset.feedTab
      );
      if (tab !== undefined) {
        activeFeedTab = tab;
        applyActiveFeedTab();
        shadow
          .querySelector<HTMLElement>(".sl-panel__scroll")
          ?.scrollTo({ top: 0, behavior: "smooth" });
      }
    }
    if (action === "rerun") rerun();
    if (action === "copy" && diagnostic) {
      void copyDiagnostic(document, diagnostic, options.onCopy)
        .catch(() => false)
        .then((copied) => {
          setActionMessage(
            copied
              ? state.language === "ru"
                ? `Диагностика ${diagnostic.ruleId} скопирована. Вставьте агенту, исправьте и нажмите обновление.`
                : `Copied ${diagnostic.ruleId} diagnostic. Paste it into your agent, fix it, then refresh.`
              : state.language === "ru"
                ? "Копирование недоступно в этом браузере."
                : "Copy is unavailable in this browser."
          );
        });
    }
    if (action === "copy-fix-prompt" && diagnostic) {
      void copyText(document, formatDiagnosticFixPrompt(diagnostic))
        .catch(() => false)
        .then((copied) => {
          setActionMessage(
            copied
              ? state.language === "ru"
                ? `Prompt для ${diagnostic.ruleId} скопирован. Вставьте агенту, исправьте и нажмите обновление.`
                : `Copied ${diagnostic.ruleId} fix prompt. Paste it into your agent, fix it, then refresh.`
              : state.language === "ru"
                ? "Копирование недоступно в этом браузере."
                : "Copy is unavailable in this browser."
          );
        });
    }
    if (action === "copy-agent-fixes") {
      const diagnostics = sortDiagnosticsByPriority(
        filterDiagnostics(state.diagnostics, state.filters)
      );
      void copyText(document, formatAllFixesPrompt(diagnostics))
        .catch(() => false)
        .then((copied) => {
          setActionMessage(
            copied
              ? state.language === "ru"
                ? "Топ prompt-ов скопирован. Вставьте агенту, исправьте и нажмите обновление."
                : "Copied top SEO fix prompts. Paste them into your agent, fix them, then refresh."
              : state.language === "ru"
                ? "Копирование недоступно в этом браузере."
                : "Copy is unavailable in this browser."
          );
        });
    }
    if (action === "copy-action-prompt") {
      const encodedPrompt = target.closest<HTMLElement>("[data-action-prompt]")
        ?.dataset.actionPrompt;
      const prompt =
        encodedPrompt === undefined
          ? undefined
          : decodeActionPrompt(encodedPrompt);
      if (prompt !== undefined) {
        void copyText(document, prompt)
          .catch(() => false)
          .then((copied) => {
            setActionMessage(
              copied
                ? state.language === "ru"
                  ? "Задача скопирована. Вставьте агенту, исправьте и нажмите обновление."
                  : "Copied the task prompt. Paste it into your agent, fix it, then refresh."
                : state.language === "ru"
                  ? "Копирование недоступно в этом браузере."
                  : "Copy is unavailable in this browser."
            );
          });
      }
    }
    if (action === "suppress" && diagnostic && options.onSuppress) {
      void Promise.resolve(options.onSuppress(diagnostic))
        .then(() => {
          state = {
            ...state,
            actionMessage: formatSuppressActionMessage(diagnostic.ruleId, true)
          };
          render();
        })
        .catch(() => {
          state = {
            ...state,
            actionMessage: formatSuppressActionMessage(diagnostic.ruleId, false)
          };
          render();
        });
    }
    if (action === "highlight" && diagnostic?.sourceLocation?.selector) {
      const highlightedCount = highlightSelector(
        document,
        diagnostic.sourceLocation.selector
      );
      setActionMessage(
        highlightedCount > 0
          ? `Highlighted ${formatCount(highlightedCount, "element")} for ${diagnostic.ruleId}.`
          : `No page elements matched ${diagnostic.ruleId}.`
      );
    }
  });

  shadow.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const select = target.closest<HTMLSelectElement>("select[name]");
    if (select === null) return;
    state = {
      ...state,
      filters: updateOverlayFilters(state.filters, select.name, select.value),
      actionMessage: undefined
    };
    render();
  });

  addManagedListener(
    document,
    "pointermove",
    ((event: PointerEvent) => moveBadgeDrag(event)) as EventListener,
    cleanupCallbacks
  );
  addManagedListener(
    document,
    "pointerup",
    ((event: PointerEvent) => finishBadgeDrag(event)) as EventListener,
    cleanupCallbacks
  );
  addManagedListener(
    document,
    "pointercancel",
    ((event: PointerEvent) => cancelBadgeDrag(event)) as EventListener,
    cleanupCallbacks
  );

  addManagedListener(
    document,
    "pointerdown",
    ((event: PointerEvent) => {
      const path = event.composedPath();
      if (!path.includes(host)) hideHelpTooltips();
    }) as EventListener,
    cleanupCallbacks
  );

  shadow.addEventListener("keydown", (event) => {
    const keyboardEvent = event as KeyboardEvent;
    if (keyboardEvent.key === "Escape") {
      close(true);
      event.preventDefault();
    }
    if (
      (keyboardEvent.key === "Enter" || keyboardEvent.key === " ") &&
      !isOpen
    ) {
      open(true);
      event.preventDefault();
    }
    if (
      keyboardEvent.key === "r" &&
      (keyboardEvent.metaKey || keyboardEvent.ctrlKey)
    ) {
      rerun();
      event.preventDefault();
    }
  });

  addManagedListener(
    document,
    "keydown",
    ((event: KeyboardEvent) => {
      if (event.key !== "Escape" || !isOpen) return;
      if (event.composedPath().includes(host)) return;
      close(true);
      event.preventDefault();
    }) as EventListener,
    cleanupCallbacks
  );

  if (options.observeNavigation !== false) {
    const rerunOnNavigation = (): void => rerun();
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    history.pushState = function pushState(
      data: unknown,
      unused: string,
      url?: string | URL | null
    ) {
      const result = originalPushState.call(this, data, unused, url);
      rerunOnNavigation();
      return result;
    };
    history.replaceState = function replaceState(
      data: unknown,
      unused: string,
      url?: string | URL | null
    ) {
      const result = originalReplaceState.call(this, data, unused, url);
      rerunOnNavigation();
      return result;
    };
    addManagedListener(window, "popstate", rerunOnNavigation, cleanupCallbacks);
    addManagedListener(
      window,
      "searchlint:navigation",
      rerunOnNavigation,
      cleanupCallbacks
    );
    cleanupCallbacks.push(() => {
      history.pushState = originalPushState;
      history.replaceState = originalReplaceState;
    });
  }

  if (
    options.observeMutations !== false &&
    typeof MutationObserver !== "undefined"
  ) {
    const observer = new MutationObserver(() => {
      if (isOpen) return;
      if (pendingMutationRerun) return;
      pendingMutationRerun = true;
      window.setTimeout(() => {
        pendingMutationRerun = false;
        rerun(false);
      }, 50);
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true
    });
    cleanupCallbacks.push(() => observer.disconnect());
  }

  render();
  return { host, shadowRoot: shadow, update, open, close, destroy };
}

export function mergeOverlayRuntimeState(
  currentState: SearchLintOverlayState,
  nextState: Partial<SearchLintOverlayState>
): SearchLintOverlayState {
  const diagnostics = nextState.diagnostics ?? currentState.diagnostics;
  const shouldClearActionMessage =
    nextState.actionMessage === undefined &&
    (nextState.diagnostics !== undefined ||
      nextState.status !== undefined ||
      nextState.runtimeError !== undefined ||
      nextState.filters !== undefined ||
      nextState.pageUrl !== undefined ||
      nextState.route !== undefined);
  return {
    ...currentState,
    ...nextState,
    diagnostics,
    status: nextState.status ?? deriveBadgeState(diagnostics),
    actionMessage: shouldClearActionMessage
      ? undefined
      : (nextState.actionMessage ?? currentState.actionMessage)
  };
}

export function highlightSelector(
  document: Document,
  selector: string
): number {
  clearHighlights(document);
  let elements: HTMLElement[];
  try {
    elements = [...document.querySelectorAll<HTMLElement>(selector)];
  } catch {
    return 0;
  }
  for (const element of elements) {
    element.setAttribute(highlightedAttribute, "true");
    element.style.outline = "2px solid #ef4444";
    element.style.outlineOffset = "2px";
  }
  return elements.length;
}

export function clearHighlights(document: Document): void {
  for (const element of document.querySelectorAll<HTMLElement>(
    `[${highlightedAttribute}]`
  )) {
    element.removeAttribute(highlightedAttribute);
    element.style.outline = "";
    element.style.outlineOffset = "";
  }
}

function renderFilters(filters: OverlayFilters = {}): string {
  return `<form class="sl-filters" aria-label="Diagnostic filters">
    ${renderSelect("severity", "Severity", filters.severity ?? "all", [
      ["all", "All severities"],
      ["blocker", severityLabels.blocker],
      ["error", severityLabels.error],
      ["warning", severityLabels.warning],
      ["info", severityLabels.info]
    ])}
    ${renderSelect("category", "Category", filters.category ?? "all", [
      ["all", "All categories"],
      ["http-rendering", categoryLabels["http-rendering"]],
      ["indexability", categoryLabels.indexability],
      ["title-metadata", categoryLabels["title-metadata"]],
      ["canonical-hreflang", categoryLabels["canonical-hreflang"]],
      ["headings-structure", categoryLabels["headings-structure"]],
      ["images-social-preview", categoryLabels["images-social-preview"]],
      ["schema-org", categoryLabels["schema-org"]],
      ["links-site-graph", categoryLabels["links-site-graph"]],
      ["robots-sitemaps", categoryLabels["robots-sitemaps"]],
      ["performance", categoryLabels.performance],
      ["unknown", categoryLabels.unknown]
    ])}
    ${renderSelect("source", "Source", filters.source ?? "all", [
      ["all", "All sources"],
      ["source-code", sourceLabels["source-code"]],
      ["raw-html", sourceLabels["raw-html"]],
      ["rendered-dom", sourceLabels["rendered-dom"]],
      ["http-header", sourceLabels["http-header"]],
      ["robots-txt", sourceLabels["robots-txt"]],
      ["sitemap", sourceLabels.sitemap],
      ["crawler", sourceLabels.crawler],
      ["google", sourceLabels.google],
      ["yandex", sourceLabels.yandex]
    ])}
  </form>`;
}

function renderSelect(
  name: string,
  label: string,
  value: string,
  options: readonly (readonly [string, string])[]
): string {
  return `<label>${escapeHtml(label)}
    <select name="${escapeHtml(name)}" aria-label="Filter by ${escapeHtml(name)}">
      ${options
        .map(
          ([optionValue, optionLabel]) =>
            `<option value="${escapeHtml(optionValue)}"${optionValue === value ? " selected" : ""}>${escapeHtml(optionLabel)}</option>`
        )
        .join("")}
    </select>
  </label>`;
}

function renderFeedTabs(language: OverlayLanguage): string {
  return `<div class="sl-tabs" role="tablist" aria-label="SearchLint feed sections">
    ${renderFeedTab("seo", feedTabLabels[language].seo, true)}
    ${renderFeedTab("links", feedTabLabels[language].links, false)}
    ${renderFeedTab("technical", feedTabLabels[language].technical, false)}
    ${renderFeedTab("geo", feedTabLabels[language].geo, false)}
  </div>`;
}

function renderFeedTab(
  tab: OverlayFeedTab,
  label: string,
  active: boolean
): string {
  return `<button class="sl-tab${active ? " sl-tab--active" : ""}" type="button" role="tab" aria-selected="${String(active)}" ${active ? "" : 'tabindex="-1" '}data-action="feed-tab" data-feed-tab="${tab}">${escapeHtml(label)}</button>`;
}

function renderSeoFeed(options: {
  allDiagnostics: readonly OverlayRenderDiagnostic[];
  matchingDiagnostics: readonly OverlayRenderDiagnostic[];
  visibleDiagnostics: readonly OverlayRenderDiagnostic[];
  filters?: OverlayFilters | undefined;
  filtered: boolean;
  runtimeError?: string | undefined;
  actionMessage?: string | undefined;
  suppressEnabled: boolean;
  language: OverlayLanguage;
  pageUrl?: string | undefined;
  localPerformance?: OverlayLocalPerformance | undefined;
  externalMetrics?: OverlayExternalMetrics | undefined;
  linkAudit?: OverlayLinkAudit | undefined;
  technicalAudit?: OverlayTechnicalAudit | undefined;
  geoAudit?: OverlayGeoAudit | undefined;
  siteEssentials?: OverlaySiteEssentialsAudit | undefined;
}): string {
  const auditLabel = formatAuditDate(options.allDiagnostics, options.language);
  return `<div class="sl-feed-body">
    <div class="sl-legacy-a11y" hidden>
      ${renderDiagnosticSummary(
        options.allDiagnostics,
        options.matchingDiagnostics,
        options.runtimeError,
        options.filtered
      )}
      ${renderFilters(options.filters)}
      <div class="sl-list" role="list" aria-label="Diagnostics">
        ${
          options.visibleDiagnostics.length === 0
            ? renderEmptyState(
                options.allDiagnostics.length,
                options.matchingDiagnostics.length,
                options.visibleDiagnostics.length
              )
            : options.visibleDiagnostics
                .map((diagnostic) =>
                  renderDiagnosticCard(diagnostic, options.suppressEnabled)
                )
                .join("")
        }
      </div>
    </div>
    ${
      options.actionMessage
        ? renderActionStatus(options.actionMessage, options.language)
        : ""
    }
    ${options.runtimeError ? renderRuntimeError(options.runtimeError) : ""}
    <p class="sl-audit-date">${escapeHtml(auditLabel)}</p>
    ${renderTabTopAction(
      "seo",
      buildSeoTopAction(
        options.matchingDiagnostics,
        options.externalMetrics?.pageSpeed,
        options.language
      ),
      options.language
    )}
    ${renderTabTopAction(
      "links",
      buildLinksTopAction(options.linkAudit, options.language),
      options.language
    )}
    ${renderTabTopAction(
      "technical",
      buildTechnicalTopAction(options.technicalAudit, options.language),
      options.language
    )}
    ${renderTabTopAction(
      "geo",
      buildGeoTopAction(options.geoAudit, options.language),
      options.language
    )}
    ${renderPageSpeedScores(
      options.localPerformance,
      options.matchingDiagnostics,
      options.externalMetrics?.pageSpeed,
      options.language
    )}
    ${renderSeoFixesSection(
      options.matchingDiagnostics,
      options.externalMetrics?.pageSpeed,
      options.language
    )}
    ${renderSiteEssentials(options.siteEssentials, options.language)}
    ${renderCoreWebVitals(
      options.localPerformance,
      options.externalMetrics?.pageSpeed,
      options.language
    )}
    ${renderLinksAudit(options.linkAudit, options.language)}
    ${renderTechnicalAudit(
      options.technicalAudit,
      options.matchingDiagnostics,
      options.language
    )}
    ${renderGeoAudit(options.geoAudit, options.language)}
    ${renderSeoHealth(options.matchingDiagnostics, options.language)}
    ${renderIssuesSection(
      options.matchingDiagnostics,
      options.visibleDiagnostics,
      options.suppressEnabled,
      options.language
    )}
    ${renderDiagnosticLimitNotice(
      options.matchingDiagnostics.length,
      options.visibleDiagnostics.length
    )}
  </div>`;
}

function renderSectionHeader(
  title: string,
  subtitle: string,
  help?: string
): string {
  return `<div class="sl-section-head">
    <h3>${escapeHtml(title)}${help ? renderHelpTooltip(title, help) : ""}</h3>
    <p>${escapeHtml(subtitle)}</p>
  </div>`;
}

function renderTabTopAction(
  tab: OverlayFeedTab,
  action: OverlayActionItem,
  language: OverlayLanguage
): string {
  const status = action.status ?? "warn";
  const actionPrompt =
    action.prompt ??
    (status === "pass" ? undefined : formatActionPrompt(action));
  const button = action.diagnostic
    ? `<button type="button" data-action="copy-fix-prompt" data-fingerprint="${escapeHtml(action.diagnostic.fingerprint)}" aria-label="${language === "ru" ? "Скопировать главный fix prompt для" : "Copy primary fix prompt for"} ${escapeHtml(action.diagnostic.ruleId)}">${language === "ru" ? "Скопировать prompt" : "Copy prompt"}</button>`
    : actionPrompt
      ? `<button type="button" data-action="copy-action-prompt" data-action-prompt="${escapeHtml(encodeActionPrompt(actionPrompt))}">${language === "ru" ? "Скопировать задачу" : "Copy task"}</button>`
      : "";
  const evidence = renderActionEvidence(action, language);
  return `<section class="sl-feed-section sl-next-action-section" aria-label="${escapeHtml(topActionTitle(tab, language))}" data-feed-section="${tab}">
    <div class="sl-next-action sl-next-action--${status}">
      <div class="sl-next-action__label">
        ${renderFeedIcon(status === "pass" ? "readability" : "warning", status === "unknown" ? "info" : status)}
        <span>${escapeHtml(topActionTitle(tab, language))}</span>
      </div>
      <div class="sl-next-action__body">
        <strong>${escapeHtml(action.title)}</strong>
        <p>${escapeHtml(action.detail)}</p>
        <details class="sl-next-action__evidence">
          <summary>${language === "ru" ? "Почему это важно" : "Why this matters"}</summary>
          ${evidence}
        </details>
        ${button}
      </div>
    </div>
  </section>`;
}

function topActionTitle(
  tab: OverlayFeedTab,
  language: OverlayLanguage
): string {
  if (language === "ru") {
    if (tab === "seo") return "Исправить сейчас";
    if (tab === "links") return "Главное действие по ссылкам";
    if (tab === "technical") return "Главное техническое действие";
    return "Главное GEO действие";
  }
  if (tab === "seo") return "Next best SEO fix";
  if (tab === "links") return "Next best link fix";
  if (tab === "technical") return "Next best technical fix";
  return "Next best GEO fix";
}

function renderActionEvidence(
  action: OverlayActionItem,
  language: OverlayLanguage
): string {
  const diagnostic = action.diagnostic;
  const source =
    action.source ??
    (diagnostic ? sourceLabels[diagnostic.source] : undefined) ??
    (language === "ru" ? "Локальный overlay" : "Local overlay");
  const confidence =
    action.confidence ??
    (diagnostic ? diagnostic.confidence : undefined) ??
    (action.status === "unknown"
      ? language === "ru"
        ? "нужно доказательство"
        : "needs evidence"
      : language === "ru"
        ? "локальная эвристика"
        : "local heuristic");
  const evidence =
    action.evidence ??
    (diagnostic ? diagnostic.evidence : undefined) ??
    action.detail;
  return `<dl class="sl-evidence-strip">
    <div><dt>${language === "ru" ? "Источник" : "Source"}</dt><dd>${escapeHtml(source)}</dd></div>
    <div><dt>${language === "ru" ? "Доверие" : "Confidence"}</dt><dd>${escapeHtml(confidence)}</dd></div>
    <div><dt>${language === "ru" ? "Доказательство" : "Evidence"}</dt><dd>${escapeHtml(evidence)}</dd></div>
  </dl>`;
}

function buildSeoTopAction(
  diagnostics: readonly OverlayRenderDiagnostic[],
  pageSpeed: OverlayPageSpeedState | undefined,
  language: OverlayLanguage
): OverlayActionItem {
  const action = selectTopAction(
    buildSeoActions(diagnostics, pageSpeed, language)
  );
  if (action) return action;
  return {
    title:
      language === "ru" ? "Срочных SEO исправлений нет" : "No urgent SEO fix",
    detail:
      language === "ru"
        ? "Локальные diagnostics не нашли blocker/error/warning для текущей страницы. Следующий шаг - проверить источники, которые еще не подключены."
        : "Local diagnostics did not find blocker/error/warning issues on this page. Next, verify any providers that are not connected yet.",
    status: "pass",
    source: language === "ru" ? "Локальные diagnostics" : "Local diagnostics",
    confidence: language === "ru" ? "проверено локально" : "locally verified",
    evidence:
      language === "ru"
        ? `${formatIssueCount(diagnostics.length, language)} в текущем фильтре.`
        : `${formatCount(diagnostics.length, "diagnostic")} in the current filter.`
  };
}

function buildLinksTopAction(
  linkAudit: OverlayLinkAudit | undefined,
  language: OverlayLanguage
): OverlayActionItem {
  const action = selectTopAction(buildLinkActions(linkAudit, language));
  if (action) return action;
  return {
    title:
      language === "ru" ? "Явных link-задач нет" : "No immediate link task",
    detail:
      language === "ru"
        ? "Rendered anchors собраны. Для полной уверенности нужен site crawl или backlink provider."
        : "Rendered anchors are collected. Use a site crawl or backlink provider for complete evidence.",
    status: "pass",
    source:
      linkAudit?.source ?? (language === "ru" ? "Browser DOM" : "Browser DOM"),
    confidence: language === "ru" ? "частичная проверка" : "partial evidence",
    evidence:
      linkAudit === undefined
        ? language === "ru"
          ? "Link audit еще не готов."
          : "Link audit is not ready yet."
        : `${formatCount(linkAudit.internalLinks.length, "internal URL")} · ${formatCount(linkAudit.externalLinks.length, "external URL")}`
  };
}

function buildTechnicalTopAction(
  technicalAudit: OverlayTechnicalAudit | undefined,
  language: OverlayLanguage
): OverlayActionItem {
  const action = selectTopAction(
    buildTechnicalActions(technicalAudit, language)
  );
  if (action) return action;
  return {
    title:
      language === "ru"
        ? "Критичных технических задач нет"
        : "No urgent technical task",
    detail:
      language === "ru"
        ? "Browser audit не нашел плохих технических сигналов. Для полной уверенности проверьте response headers и crawler evidence."
        : "Browser audit did not find poor technical signals. Verify response headers and crawler evidence for full confidence.",
    status: "pass",
    source:
      technicalAudit?.source ??
      (language === "ru" ? "Browser DOM" : "Browser DOM"),
    confidence: language === "ru" ? "локальная проверка" : "local check",
    evidence:
      technicalAudit === undefined
        ? language === "ru"
          ? "Technical audit еще не готов."
          : "Technical audit is not ready yet."
        : `Score ${String(technicalAudit.score)} · ${technicalAudit.capturedAt.slice(0, 10)}`
  };
}

function buildGeoTopAction(
  geoAudit: OverlayGeoAudit | undefined,
  language: OverlayLanguage
): OverlayActionItem {
  const action = selectTopAction(buildGeoActions(geoAudit, language));
  if (action) return action;
  return {
    title:
      language === "ru" ? "GEO база выглядит готовой" : "GEO basics look ready",
    detail:
      language === "ru"
        ? "Язык, locale, hreflang и regional signals не требуют срочного исправления. Следующий уровень - provider data и citation readiness."
        : "Language, locale, hreflang, and regional signals do not need an urgent fix. Next level: provider data and citation readiness.",
    status: "pass",
    source:
      geoAudit?.source ?? (language === "ru" ? "Browser DOM" : "Browser DOM"),
    confidence: language === "ru" ? "локальная проверка" : "local check",
    evidence:
      geoAudit === undefined
        ? language === "ru"
          ? "GEO audit еще не готов."
          : "GEO audit is not ready yet."
        : `Score ${String(geoAudit.score)} · ${geoAudit.primaryMarket}`
  };
}

function selectTopAction(
  actions: readonly OverlayActionItem[]
): OverlayActionItem | undefined {
  const priority: Record<OverlayMetricStatus, number> = {
    error: 4,
    warn: 3,
    unknown: 2,
    pass: 1
  };
  return actions
    .slice()
    .sort(
      (left, right) =>
        priority[right.status ?? "warn"] - priority[left.status ?? "warn"]
    )[0];
}

function renderHelpTooltip(label: string, help: string): string {
  return `<button class="sl-help" type="button" aria-label="${escapeHtml(`${label}: ${help}`)}" data-tooltip="${escapeHtml(help)}">¿</button>`;
}

function renderSeoFixesSection(
  diagnostics: readonly OverlayRenderDiagnostic[],
  pageSpeed: OverlayPageSpeedState | undefined,
  language: OverlayLanguage
): string {
  const actions = buildSeoActions(diagnostics, pageSpeed, language);
  const diagnosticActions = actions.filter(
    (action) => action.diagnostic !== undefined
  );
  return `<section class="sl-feed-section" aria-label="Top SEO fixes" data-feed-section="seo">
    <div class="sl-action-list">
      <div class="sl-section-head sl-section-head--with-action">
        <div>
          <h3>${language === "ru" ? "Что исправить сейчас" : "Top SEO fixes"}${renderHelpTooltip(
            language === "ru" ? "Что исправить сейчас" : "Top SEO fixes",
            language === "ru"
              ? "Первые задачи, которые стоит отправить coding-агенту. Они отсортированы по важности: скопируйте prompt, исправьте и нажмите обновление."
              : "These are the first fixes to send to a coding agent. They are ranked by severity and are meant to be copied, fixed, and rechecked."
          )}</h3>
          <p>${language === "ru" ? "Самые важные действия для текущей страницы" : "Highest-impact local actions for this page"}</p>
        </div>
        ${
          diagnosticActions.length === 0
            ? ""
            : `<button type="button" class="sl-copy-all-button" data-action="copy-agent-fixes">${language === "ru" ? "Скопировать топ исправлений" : "Copy top fixes"}</button>`
        }
      </div>
      <div class="sl-action-list__card">
        ${renderActionItems(actions, language)}
      </div>
    </div>
  </section>`;
}

function renderSiteEssentials(
  audit: OverlaySiteEssentialsAudit | undefined,
  language: OverlayLanguage
): string {
  const essentials = audit?.essentials ?? defaultSiteEssentials(language);
  const passCount = essentials.filter((item) => item.status === "pass").length;
  const needsAttentionCount = essentials.length - passCount;
  const subtitle =
    audit === undefined
      ? language === "ru"
        ? "Проверкам сайта нужны source, crawler или fetch-доказательства"
        : "Site-level checks need source, crawler, or fetch evidence"
      : language === "ru"
        ? `Проверено через ${audit.source === "browser-fetch" ? "browser fetch" : "browser DOM"} · ${audit.capturedAt.slice(0, 10)}`
        : `Checked from ${audit.source === "browser-fetch" ? "browser fetch" : "browser DOM"} · ${audit.capturedAt.slice(0, 10)}`;
  return `<section class="sl-feed-section" aria-label="Site Essentials" data-feed-section="seo">
    ${renderSectionHeader(
      language === "ru" ? "База сайта" : "Site essentials",
      subtitle,
      language === "ru"
        ? "Напоминания уровня сайта для обхода, sitemap, 404 и AI discovery. SearchLint не ставит Pass без прямого доказательства."
        : "Site-level reminders for crawlability and AI discovery. These are not marked pass unless SearchLint has direct evidence."
    )}
    <div class="sl-essentials-card">
      <div class="sl-essentials-summary">
        <strong>${escapeHtml(
          language === "ru"
            ? `${passCount} пройдено · ${needsAttentionCount} требуют доказательства`
            : `${passCount} passed · ${needsAttentionCount} need proof`
        )}</strong>
      </div>
      ${essentials.map((item) => renderSiteEssentialRow(item, language)).join("")}
    </div>
  </section>`;
}

function defaultSiteEssentials(
  language: OverlayLanguage
): readonly OverlaySiteEssential[] {
  return [
    {
      key: "robots",
      label: "robots.txt",
      status: "not-proven",
      detail:
        language === "ru"
          ? "Еще не проверено. Обновите SearchLint или запустите crawl."
          : "Not checked yet. Rerun SearchLint or run a crawl to verify."
    },
    {
      key: "sitemap",
      label: "sitemap.xml",
      status: "not-proven",
      detail:
        language === "ru"
          ? "Еще не проверено. Обновите SearchLint или запустите crawl."
          : "Not checked yet. Rerun SearchLint or run a crawl to verify."
    },
    {
      key: "llms",
      label: "llms.txt",
      status: "not-proven",
      detail:
        language === "ru"
          ? "Еще не проверено. Добавьте политику LLM discovery, если это обязательно для проекта."
          : "Not checked yet. Add an LLM discovery policy before treating this as required."
    },
    {
      key: "not-found",
      label: "404 / not-found",
      status: "not-proven",
      detail:
        language === "ru"
          ? "Еще не проверено. Нужны route или crawler-доказательства."
          : "Not checked yet. SearchLint needs route or crawler evidence."
    },
    {
      key: "mobile",
      label: language === "ru" ? "Мобильная проверка" : "Mobile check",
      status: "not-proven",
      detail:
        language === "ru"
          ? "Еще не проверено в мобильном viewport. Откройте страницу на узкой ширине или запустите PageSpeed mobile."
          : "Not checked in a mobile viewport yet. Open the page at a narrow width or run PageSpeed mobile."
    },
    {
      key: "crawler",
      label: language === "ru" ? "Полный обход сайта" : "Full-site crawl",
      status: "provider-needed",
      detail:
        language === "ru"
          ? "Запустите crawler, чтобы доказать orphan pages, broken links, crawl depth и sitemap coverage."
          : "Run the crawler to prove orphan pages, broken links, crawl depth, and sitemap coverage."
    }
  ];
}

function renderSiteEssentialRow(
  item: OverlaySiteEssential,
  language: OverlayLanguage
): string {
  const tone = siteEssentialTone(item.status);
  const prompt =
    item.status === "pass" ? undefined : formatSiteEssentialPrompt(item);
  const promptButton =
    prompt === undefined
      ? ""
      : `<button type="button" data-action="copy-action-prompt" data-action-prompt="${escapeHtml(encodeActionPrompt(prompt))}">${language === "ru" ? "Скопировать задачу" : "Copy task"}</button>`;
  return `<div class="sl-essential-row sl-essential-row--${tone}">
    <span>${renderFeedIcon(siteEssentialIcon(item.key), tone)}${escapeHtml(siteEssentialLabel(item, language))}</span>
    <div class="sl-essential-row__body">
      <strong>${escapeHtml(siteEssentialStatusLabel(item.status, language))}</strong>
      ${
        item.status === "pass"
          ? `<p>${item.url ? escapeHtml(item.url) : escapeHtml(siteEssentialDetail(item, language))}</p>`
          : `<p>${escapeHtml(siteEssentialDetail(item, language))}${item.url ? ` · ${escapeHtml(item.url)}` : ""}</p>`
      }
      ${promptButton}
    </div>
  </div>`;
}

function siteEssentialLabel(
  item: OverlaySiteEssential,
  language: OverlayLanguage
): string {
  if (language === "ru" && item.key === "crawler") return "Полный обход сайта";
  if (language === "ru" && item.key === "mobile") return "Мобильная проверка";
  return item.label;
}

function siteEssentialTone(
  status: OverlaySiteEssentialStatus
): "pass" | "warn" | "error" | "info" {
  if (status === "pass") return "pass";
  if (status === "issue") return "error";
  if (status === "provider-needed") return "info";
  return "warn";
}

function siteEssentialStatusLabel(
  status: OverlaySiteEssentialStatus,
  language: OverlayLanguage
): string {
  if (language === "ru") {
    if (status === "pass") return "Пройдено";
    if (status === "issue") return "Проблема";
    if (status === "provider-needed") return "Нужен источник";
    return "Не доказано";
  }
  if (status === "pass") return "Pass";
  if (status === "issue") return "Issue";
  if (status === "provider-needed") return "Provider needed";
  return "Not proven";
}

function siteEssentialDetail(
  item: OverlaySiteEssential,
  language: OverlayLanguage
): string {
  if (language !== "ru") return item.detail;
  if (item.key === "robots") {
    if (item.status === "pass") return "robots.txt доступен.";
    if (item.status === "issue") {
      return "robots.txt отсутствует или вернул ошибку. Добавьте явную crawl-политику.";
    }
    return "robots.txt не удалось доказать из текущего браузера.";
  }
  if (item.key === "sitemap") {
    if (item.status === "pass") return "sitemap.xml доступен.";
    if (item.status === "issue") {
      return "sitemap.xml отсутствует или вернул ошибку. Добавьте карту страниц.";
    }
    return "sitemap.xml не удалось доказать из текущего браузера.";
  }
  if (item.key === "llms") {
    if (item.status === "pass")
      return "llms.txt доступен для AI/LLM discovery.";
    if (item.status === "issue") {
      return "llms.txt отсутствует или пустой. Добавьте файл для AI/LLM discovery.";
    }
    return "llms.txt для AI/LLM discovery не удалось доказать из текущего браузера.";
  }
  if (item.key === "not-found") {
    if (item.status === "pass")
      return "Отсутствующие страницы возвращают 404/410.";
    if (item.status === "issue") {
      return "Проверочный missing URL не вернул 404/410. Проверьте not-found route.";
    }
    return "404/not-found поведение не удалось доказать.";
  }
  if (item.key === "mobile") {
    if (item.status === "pass")
      return "Текущий viewport мобильный; можно оценивать mobile layout.";
    if (item.status === "issue") {
      return "Мобильная проверка выявила проблему. Проверьте layout, tap targets и overflow.";
    }
    return "Мобильный viewport не доказан. Откройте узкую ширину или PageSpeed mobile.";
  }
  return "Запустите crawler, чтобы доказать orphan pages, broken links, crawl depth и sitemap coverage.";
}

function siteEssentialIcon(
  key: OverlaySiteEssential["key"]
): "mobile" | "readability" | "warning" {
  if (key === "not-found") return "warning";
  if (key === "mobile" || key === "crawler") return "mobile";
  return "readability";
}

function renderActionList(
  title: string,
  subtitle: string,
  actions: readonly OverlayActionItem[],
  language: OverlayLanguage = "en"
): string {
  const visibleActions =
    actions.length === 0
      ? [
          {
            title:
              language === "ru"
                ? "Нет срочных исправлений"
                : "No immediate fixes",
            detail:
              language === "ru"
                ? "В этой секции нет actionable-находок на текущей rendered page."
                : "This section has no actionable findings in the current rendered page.",
            status: "pass" as const
          }
        ]
      : actions.slice(0, 4);
  return `<div class="sl-action-list">
    ${renderSectionHeader(title, subtitle)}
    <div class="sl-action-list__card">
      ${renderActionItems(visibleActions, language)}
    </div>
  </div>`;
}

function renderActionItems(
  actions: readonly OverlayActionItem[],
  language: OverlayLanguage = "en"
): string {
  return actions.map((action) => renderActionItem(action, language)).join("");
}

function renderActionItem(
  action: OverlayActionItem,
  language: OverlayLanguage = "en"
): string {
  const status = action.status ?? "warn";
  const actionPrompt =
    action.prompt ??
    (status === "pass" ? undefined : formatActionPrompt(action));
  const promptButton = action.diagnostic
    ? `<button type="button" data-action="copy-fix-prompt" data-fingerprint="${escapeHtml(action.diagnostic.fingerprint)}" aria-label="${language === "ru" ? "Скопировать fix prompt для" : "Copy fix prompt for"} ${escapeHtml(action.diagnostic.ruleId)}">${language === "ru" ? "Скопировать prompt" : "Copy fix prompt"}</button>`
    : actionPrompt
      ? `<button type="button" data-action="copy-action-prompt" data-action-prompt="${escapeHtml(encodeActionPrompt(actionPrompt))}">${language === "ru" ? "Скопировать задачу" : "Copy task"}</button>`
      : "";
  return `<div class="sl-action-item sl-action-item--${status}">
    <span>${renderFeedIcon("warning", status === "unknown" ? "info" : status)}</span>
    <div>
      <strong>${escapeHtml(action.title)}</strong>
      <p>${escapeHtml(action.detail)}</p>
      ${promptButton}
    </div>
  </div>`;
}

function encodeActionPrompt(prompt: string): string {
  return encodeURIComponent(prompt);
}

function decodeActionPrompt(prompt: string): string | undefined {
  try {
    return decodeURIComponent(prompt);
  } catch {
    return undefined;
  }
}

function formatActionPrompt(
  action: Pick<OverlayActionItem, "title" | "detail">
): string {
  return [
    `SearchLint task: ${action.title}`,
    "",
    action.detail,
    "",
    "Keep the current visual design unchanged.",
    "Make the smallest safe code changes.",
    "After the fix, rerun SearchLint and confirm this task is resolved."
  ].join("\n");
}

function formatSiteEssentialPrompt(item: OverlaySiteEssential): string {
  const target = item.url ? `\nTarget URL: ${item.url}` : "";
  return [
    `SearchLint site-essential task: ${item.label}`,
    "",
    `Status: ${siteEssentialStatusLabel(item.status, "en")}`,
    `Finding: ${item.detail}${target}`,
    "",
    siteEssentialPromptInstruction(item.key),
    "",
    "Keep the current visual design unchanged.",
    "Make the smallest safe code changes.",
    "After the fix, rerun SearchLint and confirm this row is Pass or has stronger evidence."
  ].join("\n");
}

function siteEssentialPromptInstruction(
  key: OverlaySiteEssential["key"]
): string {
  if (key === "robots") {
    return "Add or fix robots.txt so crawlers have an explicit crawl policy. Do not block important public pages by accident.";
  }
  if (key === "sitemap") {
    return "Add or fix sitemap.xml so crawlers and agents can discover the intended public pages.";
  }
  if (key === "llms") {
    return "Add or fix llms.txt when this project should expose explicit AI/LLM discovery guidance.";
  }
  if (key === "not-found") {
    return "Make missing URLs return a real 404 or 410 response and render the existing not-found experience.";
  }
  if (key === "mobile") {
    return "Check the page in a narrow mobile viewport and fix layout overflow, unreadable text, and tap-target issues if found.";
  }
  return "Run or connect the SearchLint crawler so orphan pages, broken links, crawl depth, and sitemap coverage can be proven.";
}

function buildSeoActions(
  diagnostics: readonly OverlayRenderDiagnostic[],
  pageSpeed: OverlayPageSpeedState | undefined,
  language: OverlayLanguage
): readonly OverlayActionItem[] {
  const actions = diagnostics
    .slice()
    .sort((left, right) => {
      const severityDelta =
        severityOrder[right.severity] - severityOrder[left.severity];
      return severityDelta === 0
        ? left.ruleId.localeCompare(right.ruleId)
        : severityDelta;
    })
    .slice(0, 3)
    .map(
      (diagnostic): OverlayActionItem => ({
        title: diagnostic.title,
        detail:
          language === "ru"
            ? `${diagnostic.ruleId} · ${impactForDiagnostic(diagnostic, language)} · ${categoryLabelForLanguage(categoryForRuleId(diagnostic.ruleId), language)}. Скопируйте prompt и отправьте coding-агенту.`
            : `${diagnostic.ruleId} · ${impactForDiagnostic(diagnostic)} · ${categoryLabels[categoryForRuleId(diagnostic.ruleId)]}. Copy the fix prompt and send it to your coding agent.`,
        status:
          diagnostic.severity === "blocker" || diagnostic.severity === "error"
            ? "error"
            : diagnostic.severity === "warning"
              ? "warn"
              : "unknown",
        diagnostic
      })
    );
  if (
    pageSpeed?.status !== "available" &&
    pageSpeed?.status !== "checking" &&
    actions.length < 4
  ) {
    actions.push({
      title:
        language === "ru"
          ? "Подключите Google PageSpeed"
          : "Connect Google PageSpeed",
      detail:
        language === "ru"
          ? "Добавьте PageSpeed API key, чтобы получать Accessibility и Best Practices из Lighthouse."
          : "Add a PageSpeed API key when you need Accessibility and Best Practices scores from Lighthouse.",
      status: "unknown",
      source: "Google PageSpeed",
      confidence:
        language === "ru" ? "provider не подключен" : "provider missing",
      evidence: pageSpeed
        ? `PageSpeed status: ${pageSpeed.status}${pageSpeed.message ? ` · ${pageSpeed.message}` : ""}`
        : "PageSpeed provider state is missing."
    });
  }
  return actions;
}

function renderPageSpeedScores(
  performance: OverlayLocalPerformance | undefined,
  diagnostics: readonly OverlayRenderDiagnostic[],
  pageSpeed: OverlayPageSpeedState | undefined,
  language: OverlayLanguage
): string {
  const localScores = [
    renderLocalPerformanceScore(performance, language),
    renderLocalSeoScore(diagnostics)
  ] as const;
  return `<section class="sl-feed-section" aria-label="PageSpeed Scores" data-feed-section="seo">
    ${renderSectionHeader(
      language === "ru" ? "Оценки страницы" : "PageSpeed Scores",
      formatPageSpeedSubtitle(performance, pageSpeed, language),
      language === "ru"
        ? "Быстрые оценки скорости, доступности, технической чистоты и SEO. Они помогают понять, нужна ли странице доработка перед публикацией."
        : "Quick quality scores for speed, accessibility, technical hygiene, and SEO. Use them to decide whether this page needs a performance or search cleanup before shipping."
    )}
    <div class="sl-score-card">
      ${renderScoreGroup(language === "ru" ? "Локальный браузер" : "Local browser", localScores)}
      ${renderGooglePageSpeedGroup(pageSpeed, language)}
    </div>
  </section>`;
}

function renderGooglePageSpeedGroup(
  pageSpeed: OverlayPageSpeedState | undefined,
  language: OverlayLanguage
): string {
  if (hasMissingPageSpeedScore(pageSpeed)) {
    const reason = formatPageSpeedMissingReason(pageSpeed, language);
    const statusLabel =
      pageSpeed?.status === "checking"
        ? language === "ru"
          ? "Проверяется"
          : "Checking"
        : pageSpeed?.status === "error"
          ? language === "ru"
            ? "Ошибка provider"
            : "Provider error"
          : pageSpeed?.status === "unavailable"
            ? language === "ru"
              ? "Недоступен"
              : "Unavailable"
            : language === "ru"
              ? "Не подключен"
              : "Not connected";
    return `<div class="sl-score-group">
      <h4>Google PageSpeed</h4>
      <div class="sl-provider-empty sl-provider-empty--unknown">
        ${renderFeedIcon("warning", "info")}
        <div>
          <strong>${escapeHtml(statusLabel)}</strong>
          <p>${escapeHtml(reason)}</p>
        </div>
      </div>
    </div>`;
  }
  const googleScores = [
    renderPageSpeedScore(
      pageSpeed?.scores?.performance,
      language === "ru" ? "Скорость" : "Performance",
      language
    ),
    renderPageSpeedScore(
      pageSpeed?.scores?.accessibility,
      language === "ru" ? "Доступность" : "Accessibility",
      language
    ),
    renderPageSpeedScore(
      pageSpeed?.scores?.bestPractices,
      language === "ru" ? "Практики" : "Best Practices",
      language
    ),
    renderPageSpeedScore(pageSpeed?.scores?.seo, "SEO", language)
  ] as const;
  return renderScoreGroup("Google PageSpeed", googleScores);
}

function renderPageSpeedScore(
  score: number | undefined,
  label: string,
  language: OverlayLanguage,
  missingReason?: string
): OverlayScoreItem {
  if (score === undefined) {
    return missingReason === undefined
      ? [noDataScoreLabel(), label, "unknown"]
      : [noDataScoreLabel(), label, "unknown", missingReason];
  }
  const rounded = Math.round(score);
  return [String(rounded), label, statusForScore(rounded)];
}

function formatPageSpeedMissingReason(
  pageSpeed: OverlayPageSpeedState | undefined,
  language: OverlayLanguage
): string {
  if (pageSpeed?.message) return pageSpeed.message;
  if (pageSpeed?.status === "checking") {
    return language === "ru"
      ? "Google PageSpeed еще проверяется."
      : "Google PageSpeed is still checking.";
  }
  if (pageSpeed?.status === "error") {
    return language === "ru"
      ? "Google PageSpeed вернул ошибку. Проверьте API key, URL и quota."
      : "Google PageSpeed returned an error. Check the API key, URL, and quota.";
  }
  if (pageSpeed?.status === "unavailable") {
    return language === "ru"
      ? "Google PageSpeed сейчас недоступен для этой страницы."
      : "Google PageSpeed is unavailable for this page right now.";
  }
  if (pageSpeed?.status === "available") {
    return language === "ru"
      ? "Google PageSpeed не вернул эту категорию в ответе."
      : "Google PageSpeed did not return this category in the response.";
  }
  return language === "ru"
    ? "Нужен SEARCHLINT_PAGESPEED_API_KEY или другой Lighthouse provider."
    : "Requires SEARCHLINT_PAGESPEED_API_KEY or another Lighthouse provider.";
}

function hasMissingPageSpeedScore(
  pageSpeed: OverlayPageSpeedState | undefined
): boolean {
  if (pageSpeed?.status !== "available") return true;
  if (pageSpeed.scores === undefined) return true;
  return (
    pageSpeed.scores.performance === undefined ||
    pageSpeed.scores.accessibility === undefined ||
    pageSpeed.scores.bestPractices === undefined ||
    pageSpeed.scores.seo === undefined
  );
}

function formatPageSpeedSubtitle(
  performance: OverlayLocalPerformance | undefined,
  pageSpeed: OverlayPageSpeedState | undefined,
  language: OverlayLanguage
): string {
  if (pageSpeed?.status === "available") {
    return `Google PageSpeed · ${pageSpeed.strategy}${pageSpeed.fetchedAt ? ` · ${pageSpeed.fetchedAt.slice(0, 10)}` : ""}`;
  }
  const local =
    performance === undefined
      ? language === "ru"
        ? "Локальные замеры ожидаются"
        : "Local timing pending"
      : `${language === "ru" ? "Локальный браузер" : "Local browser timing"} · ${formatViewport(performance.viewport)}`;
  if (pageSpeed?.status === "checking") {
    return `${local} · ${language === "ru" ? "Google проверяется" : "Google checking"}`;
  }
  if (pageSpeed?.status === "error") {
    return `${local} · ${language === "ru" ? "Ошибка Google" : "Google error"}`;
  }
  if (pageSpeed?.status === "unavailable") {
    return `${local} · ${language === "ru" ? "Google недоступен" : "Google unavailable"}`;
  }
  return `${local} · ${language === "ru" ? "Google provider не подключен" : "Google provider not connected"}`;
}

function renderScoreGroup(
  title: string,
  scores: readonly OverlayScoreItem[],
  note?: string
): string {
  return `<div class="sl-score-group">
    <h4>${escapeHtml(title)}</h4>
    <div class="sl-score-grid">
      ${scores.map(([score, label, status, reason]) => renderScoreDial(score, label, status, reason)).join("")}
    </div>
    ${note ? `<p class="sl-score-note">${escapeHtml(note)}</p>` : ""}
  </div>`;
}

function renderScoreDial(
  score: string,
  label: string,
  status: OverlayMetricStatus,
  reason?: string
): string {
  const help = helpForMetricLabel(label);
  return `<div class="sl-score-dial sl-score-dial--${status}">
    <div class="sl-score-dial__ring">
      <svg viewBox="0 0 40 40" aria-hidden="true" focusable="false">
        <circle cx="20" cy="20" r="16" pathLength="100" />
      </svg>
      <strong>${escapeHtml(score)}</strong>
    </div>
    <span>${escapeHtml(label)}${help ? renderHelpTooltip(label, help) : ""}</span>
    ${reason ? `<small>${escapeHtml(reason)}</small>` : ""}
  </div>`;
}

function renderLocalPerformanceScore(
  performance: OverlayLocalPerformance | undefined,
  language: OverlayLanguage
): OverlayScoreItem {
  if (performance === undefined) {
    return [
      noDataScoreLabel(),
      language === "ru" ? "Скорость" : "Performance",
      "unknown",
      language === "ru"
        ? "Локальные тайминги еще не собраны. Обновите после полной загрузки."
        : "Local timing has not been captured yet. Rerun after full load."
    ];
  }
  const ratedMetrics = [
    rateLcp(performance.lcpMs),
    rateFcp(performance.fcpMs),
    rateTbt(performance.tbtMs),
    rateCls(performance.cls)
  ].filter(isMeasuredMetricStatus);
  if (
    ratedMetrics.length === 0 &&
    (performance.loadMs !== undefined ||
      performance.domContentLoadedMs !== undefined)
  ) {
    ratedMetrics.push(
      ...[
        rateLoad(performance.loadMs),
        rateDcl(performance.domContentLoadedMs)
      ].filter(isMeasuredMetricStatus)
    );
  }
  if (ratedMetrics.length === 0) {
    return [
      noDataScoreLabel(),
      language === "ru" ? "Скорость" : "Performance",
      "unknown",
      language === "ru"
        ? "Navigation timing есть, но LCP/FCP/TBT/CLS еще не измерены."
        : "Navigation timing exists, but LCP/FCP/TBT/CLS are not measured yet."
    ];
  }
  const score = Math.max(
    0,
    Math.round(
      ratedMetrics.reduce(
        (total, status) => total + scoreForStatus(status),
        0
      ) / ratedMetrics.length
    )
  );
  return [
    String(score),
    language === "ru" ? "Скорость" : "Performance",
    statusForScore(score)
  ];
}

function renderLocalSeoScore(
  diagnostics: readonly OverlayRenderDiagnostic[]
): OverlayScoreItem {
  const counts = countDiagnosticsBySeverity(diagnostics);
  const penalty =
    counts.blocker * 35 +
    counts.error * 20 +
    counts.warning * 8 +
    counts.info * 3;
  const score = Math.max(0, 100 - penalty);
  return [String(score), "SEO", statusForScore(score)];
}

function helpForMetricLabel(label: string): string | undefined {
  const normalized = label.toLocaleLowerCase();
  if (normalized === "скорость") {
    return "Насколько быстро страница загружается и становится usable. Низкая оценка обычно значит, что пользователи ждут дольше или уходят раньше.";
  }
  if (normalized === "performance") {
    return "How fast the page loads and becomes usable. Low scores usually mean users wait longer or leave sooner.";
  }
  if (normalized === "доступность") {
    return "Показывает, могут ли люди с assistive technologies понять страницу и пользоваться ей.";
  }
  if (normalized === "accessibility") {
    return "Checks whether people using assistive technologies can understand and operate the page.";
  }
  if (normalized === "практики") {
    return "Техническая гигиена: безопасность браузера, современные API и частые ошибки реализации.";
  }
  if (normalized === "best practices") {
    return "Technical hygiene checks for browser safety, modern APIs, and common implementation mistakes.";
  }
  if (normalized === "seo") {
    return "Search visibility checks such as metadata, crawlability, links, and structured page signals.";
  }
  if (normalized === "lcp") {
    return "Largest Contentful Paint: how fast the main visible content appears. Bad LCP makes the page feel slow.";
  }
  if (normalized === "fcp") {
    return "First Contentful Paint: when the first text or image appears. Bad FCP means users stare at a blank page.";
  }
  if (normalized === "tbt") {
    return "Total Blocking Time: how much JavaScript blocks interaction. Bad TBT makes clicks and typing feel delayed.";
  }
  if (normalized === "cls") {
    return "Cumulative Layout Shift: how much the layout jumps. Bad CLS causes accidental clicks and visual instability.";
  }
  if (normalized === "load") {
    return "Full page load timing in this browser. Use it as a local signal, not as a Google ranking metric by itself.";
  }
  if (normalized === "dcl") {
    return "DOM Content Loaded: when the initial HTML is parsed. Slow DCL can delay app startup.";
  }
  return undefined;
}

function noDataLabel(language: OverlayLanguage): string {
  void language;
  return "N/A";
}

function noDataScoreLabel(): string {
  return "N/A";
}

function scoreForStatus(status: OverlayMetricStatus): number {
  if (status === "pass") return 100;
  if (status === "warn") return 65;
  if (status === "error") return 35;
  return 0;
}

function isMeasuredMetricStatus(
  status: OverlayMetricStatus
): status is "pass" | "warn" | "error" {
  return status !== "unknown";
}

function statusForScore(score: number): OverlayMetricStatus {
  if (score >= 90) return "pass";
  if (score >= 50) return "warn";
  return "error";
}

function renderCoreWebVitals(
  performance: OverlayLocalPerformance | undefined,
  pageSpeed: OverlayPageSpeedState | undefined,
  language: OverlayLanguage
): string {
  const googleVitals =
    pageSpeed?.status === "available" ? pageSpeed.vitals : undefined;
  const googleMetricCards = googleVitals
    ? [
        renderOptionalPerformanceMetric("LCP", googleVitals.lcpMs, rateLcp),
        renderOptionalPerformanceMetric("FCP", googleVitals.fcpMs, rateFcp),
        renderOptionalPerformanceMetric("TBT", googleVitals.tbtMs, rateTbt),
        renderOptionalPerformanceMetric(
          "CLS",
          googleVitals.cls,
          rateCls,
          formatCls
        )
      ].filter((card): card is string => card !== "")
    : [];
  const localMetricCards = performance
    ? [
        renderOptionalPerformanceMetric("LCP", performance.lcpMs, rateLcp),
        renderOptionalPerformanceMetric("FCP", performance.fcpMs, rateFcp),
        renderOptionalPerformanceMetric("TBT", performance.tbtMs, rateTbt),
        renderOptionalPerformanceMetric(
          "CLS",
          performance.cls,
          rateCls,
          formatCls
        ),
        renderOptionalPerformanceMetric("LOAD", performance.loadMs, rateLoad),
        renderOptionalPerformanceMetric(
          "DCL",
          performance.domContentLoadedMs,
          rateDcl
        )
      ].filter((card): card is string => card !== "")
    : [];
  const metricCards =
    googleMetricCards.length > 0 ? googleMetricCards : localMetricCards;
  const subtitle =
    googleMetricCards.length > 0
      ? `Google PageSpeed · ${pageSpeed?.strategy ?? "mobile"}${pageSpeed?.fetchedAt ? ` · ${pageSpeed.fetchedAt.slice(0, 10)}` : ""}`
      : performance === undefined
        ? language === "ru"
          ? "Ожидаем локальные замеры браузера"
          : "Waiting for local browser timing"
        : `${language === "ru" ? "Локальный браузер" : "Local browser timing"} · ${formatViewport(performance.viewport)}`;
  return `<section class="sl-feed-section" aria-label="Core Web Vitals" data-feed-section="seo">
    ${renderSectionHeader(
      "Core Web Vitals",
      subtitle,
      language === "ru"
        ? "Сигналы скорости и стабильности. Плохие значения делают страницу медленной, дерганой или неудобной, особенно на важных входных страницах."
        : "Speed and stability signals. Bad values can make the page feel slow, unstable, or hard to use, especially on important traffic pages."
    )}
    <div class="sl-vitals-card">
      ${
        metricCards.length === 0
          ? `<p>${language === "ru" ? "Данных по таймингам пока нет. Обновите SearchLint после полной загрузки страницы." : "Timing data is not available yet. Rerun SearchLint after the page finishes loading."}</p>`
          : `<div class="sl-vitals-grid">${metricCards.join("")}</div><p>${googleMetricCards.length > 0 ? (language === "ru" ? "Google PageSpeed lab-метрики могут отличаться от локальных и field-данных." : "Google PageSpeed lab metrics can differ from local and field data.") : language === "ru" ? "Локальные тайминги могут отличаться от Lighthouse и field-данных." : "Local browser timing can differ from Lighthouse and field data."}</p>`
      }
    </div>
  </section>`;
}

function renderLinksAudit(
  linkAudit: OverlayLinkAudit | undefined,
  language: OverlayLanguage
): string {
  const internalLinks = linkAudit?.internalLinks ?? [];
  const externalLinks = linkAudit?.externalLinks ?? [];
  const backlinks = linkAudit?.backlinks;
  const totalInternalRefs = internalLinks.reduce(
    (total, link) => total + link.count,
    0
  );
  const totalExternalRefs = externalLinks.reduce(
    (total, link) => total + link.count,
    0
  );
  const subtitle =
    linkAudit === undefined
      ? language === "ru"
        ? "Ожидаем link crawl в браузере"
        : "Waiting for browser link crawl"
      : language === "ru"
        ? `${formatRuCount(totalInternalRefs, "внутренняя ссылка", "внутренние ссылки", "внутренних ссылок")} · ${formatRuCount(totalExternalRefs, "внешняя ссылка", "внешние ссылки", "внешних ссылок")}`
        : `${formatCount(totalInternalRefs, "internal link")} · ${formatCount(
            totalExternalRefs,
            "external link"
          )}`;
  return `<section class="sl-feed-section" aria-label="Links Audit" data-feed-section="links">
    ${renderSectionHeader(
      language === "ru" ? "Ссылки" : "Links",
      subtitle,
      language === "ru"
        ? "Показывает внутренние ссылки, внешние ссылки и провайдерные данные по backlinks/referring domains, если они подключены."
        : "Shows internal links, external links, and provider-backed backlink/referring-domain data when connected."
    )}
    <div class="sl-link-card">
      <div class="sl-link-metrics" aria-label="Link metrics">
        ${renderLinkMetric(language === "ru" ? "Бэклинки" : "Backlinks", backlinks?.backlinks, backlinks?.status ?? "not-configured", language)}
        ${renderLinkMetric(language === "ru" ? "Домены" : "Referring domains", backlinks?.referringDomains, backlinks?.status ?? "not-configured", language)}
        ${renderLinkMetric(language === "ru" ? "Качество" : "Quality", backlinks?.qualityScore, backlinks?.status ?? "not-configured", language)}
      </div>
      <p>${escapeHtml(formatBacklinkMessage(backlinks, language))}</p>
      ${renderActionList(
        language === "ru" ? "Что проверить по ссылкам" : "Link next steps",
        language === "ru"
          ? "Что проверить перед изменением ссылочной структуры"
          : "What to check before changing the link graph",
        buildLinkActions(linkAudit, language),
        language
      )}
      ${renderLinkTable(
        language === "ru" ? "Внутренние страницы" : "Internal pages",
        internalLinks,
        language === "ru"
          ? "На этой странице внутренние ссылки не найдены."
          : "No internal links found on this page.",
        language
      )}
      ${renderLinkTable(
        language === "ru" ? "Внешние ссылки" : "External links",
        externalLinks,
        language === "ru"
          ? "На этой странице внешние ссылки не найдены."
          : "No external links found on this page.",
        language
      )}
    </div>
  </section>`;
}

function buildLinkActions(
  linkAudit: OverlayLinkAudit | undefined,
  language: OverlayLanguage
): readonly OverlayActionItem[] {
  if (linkAudit === undefined) {
    return [
      {
        title:
          language === "ru"
            ? "Дождитесь browser crawl"
            : "Wait for the browser crawl",
        detail:
          language === "ru"
            ? "SearchLint нужны rendered anchors, чтобы сгруппировать внутренние и внешние ссылки."
            : "SearchLint needs the rendered anchors before it can group internal and external links.",
        status: "unknown"
      }
    ];
  }
  const actions: OverlayActionItem[] = [];
  if (linkAudit.backlinks?.status !== "available") {
    actions.push({
      title:
        language === "ru"
          ? "Подключите backlink provider"
          : "Connect a backlink provider",
      detail:
        language === "ru"
          ? "Бэклинки, referring domains и качество нельзя доказать только из DOM страницы."
          : "Backlinks, referring domains, and quality cannot be proven from the page DOM alone.",
      status: "unknown"
    });
  }
  actions.push({
    title:
      language === "ru"
        ? "Запустите crawler для site graph"
        : "Run crawler for site graph",
    detail:
      language === "ru"
        ? "Orphan pages, broken internal links, crawl depth и sitemap coverage нельзя доказать с одной rendered page."
        : "Orphan pages, broken internal links, crawl depth, and sitemap coverage cannot be proven from one rendered page.",
    status: "unknown"
  });
  const riskyExternal = linkAudit.externalLinks.filter(
    (link) =>
      link.target === "_blank" &&
      !(link.rel ?? "").toLocaleLowerCase().includes("noopener")
  );
  if (riskyExternal.length > 0) {
    actions.push({
      title:
        language === "ru"
          ? "Исправьте небезопасные внешние вкладки"
          : "Fix unsafe external tabs",
      detail:
        language === "ru"
          ? `${formatRuCount(riskyExternal.length, "внешний URL", "внешних URL", "внешних URL")} открывается в новой вкладке без rel=noopener.`
          : `${formatCount(riskyExternal.length, "external URL")} opens in a new tab without rel=noopener.`,
      status: "error"
    });
  }
  if (linkAudit.internalLinks.length > 25) {
    actions.push({
      title:
        language === "ru"
          ? "Сгруппируйте повторяющиеся внутренние ссылки"
          : "Group repeated internal links",
      detail:
        language === "ru"
          ? "На странице много внутренних URL; проверьте дубли в навигации/footer перед оценкой важности страниц."
          : "The page has many internal URLs; review navigation/footer duplicates before judging page importance.",
      status: "warn"
    });
  }
  if (linkAudit.externalLinks.length > 0) {
    actions.push({
      title:
        language === "ru"
          ? "Проверьте исходящие ссылки"
          : "Review outbound authority",
      detail:
        language === "ru"
          ? "Проверьте, внешние ссылки являются trust signals, support links или случайными утечками веса."
          : "Check whether external links are intentional trust signals, support links, or accidental leaks.",
      status: "warn"
    });
  }
  return actions;
}

function renderLinkMetric(
  label: string,
  value: number | undefined,
  status: OverlayBacklinkState["status"],
  language: OverlayLanguage
): string {
  const tone: OverlayMetricStatus =
    status === "available"
      ? label === "Quality"
        ? statusForScore(value ?? 0)
        : "pass"
      : status === "error"
        ? "error"
        : "unknown";
  const formatted =
    value === undefined
      ? noDataLabel(language)
      : label === "Quality" || label === "Качество"
        ? `${Math.round(value)}/100`
        : String(value);
  return `<div class="sl-link-metric sl-link-metric--${tone}">
    <span>${escapeHtml(label)}</span>
    <strong>${escapeHtml(formatted)}</strong>
    ${
      value === undefined
        ? `<small>${escapeHtml(formatBacklinkMetricReason(status, language))}</small>`
        : ""
    }
  </div>`;
}

function formatBacklinkMetricReason(
  status: OverlayBacklinkState["status"],
  language: OverlayLanguage
): string {
  if (status === "error") {
    return language === "ru"
      ? "Provider вернул ошибку"
      : "Provider returned an error";
  }
  if (status === "unavailable") {
    return language === "ru" ? "Provider недоступен" : "Provider unavailable";
  }
  if (status === "available") {
    return language === "ru"
      ? "Provider не вернул поле"
      : "Provider omitted this field";
  }
  return language === "ru" ? "Provider не подключен" : "Provider not connected";
}

function formatBacklinkMessage(
  backlinks: OverlayBacklinkState | undefined,
  language: OverlayLanguage
): string {
  if (backlinks?.message) return backlinks.message;
  if (backlinks?.status === "available") {
    return `Backlink data from ${backlinks.provider ?? "connected provider"}${backlinks.fetchedAt ? ` · ${backlinks.fetchedAt.slice(0, 10)}` : ""}.`;
  }
  return language === "ru"
    ? "Бэклинки, referring domains и качество ссылок требуют подключенного внешнего provider."
    : "Backlinks, referring domains, and link quality require a connected external backlink provider.";
}

function renderLinkTable(
  title: string,
  links: readonly OverlayLinkTarget[],
  emptyMessage: string,
  language: OverlayLanguage = "en"
): string {
  const visibleLinks = links.slice(0, 12);
  return `<div class="sl-link-table">
    <div class="sl-link-table__head">
      <strong>${escapeHtml(title)}</strong>
      <span>${language === "ru" ? formatRuCount(links.length, "URL", "URL", "URL") : formatCount(links.length, "URL")}</span>
    </div>
    ${
      visibleLinks.length === 0
        ? `<p class="sl-link-empty">${escapeHtml(emptyMessage)}</p>`
        : visibleLinks.map((link) => renderLinkRow(link, language)).join("")
    }
    ${
      links.length > visibleLinks.length
        ? `<p class="sl-link-empty">${escapeHtml(
            language === "ru"
              ? `Показано 12 из ${links.length} URL.`
              : `Showing 12 of ${links.length} URLs.`
          )}</p>`
        : ""
    }
  </div>`;
}

function renderLinkRow(
  link: OverlayLinkTarget,
  language: OverlayLanguage = "en"
): string {
  const meta = [
    language === "ru"
      ? formatRuCount(link.count, "упоминание", "упоминания", "упоминаний")
      : formatCount(link.count, "reference"),
    link.rel ? `rel=${link.rel}` : undefined,
    link.target ? `target=${link.target}` : undefined
  ].filter((part): part is string => part !== undefined);
  return `<div class="sl-link-row">
    <div>
      <p>${escapeHtml(link.label || link.url)}</p>
      <small>${escapeHtml(link.url)}</small>
    </div>
    <span>${escapeHtml(meta.join(" · "))}</span>
  </div>`;
}

function renderTechnicalAudit(
  technicalAudit: OverlayTechnicalAudit | undefined,
  diagnostics: readonly OverlayRenderDiagnostic[],
  language: OverlayLanguage
): string {
  const score = technicalAudit?.score ?? renderLocalSeoScore(diagnostics)[0];
  const numericScore = Number(score);
  const status = Number.isFinite(numericScore)
    ? statusForScore(numericScore)
    : "unknown";
  const overview = technicalAudit?.overview ?? [
    {
      label: "Server",
      value: noDataLabel(language),
      status: "unknown" as const
    },
    {
      label: "Status",
      value: noDataLabel(language),
      status: "unknown" as const
    },
    {
      label: "Encoding",
      value: noDataLabel(language),
      status: "unknown" as const
    },
    {
      label: "Page Size",
      value: noDataLabel(language),
      status: "unknown" as const
    },
    {
      label: "DOM Size",
      value: noDataLabel(language),
      status: "unknown" as const
    },
    {
      label: "Cacheable",
      value: noDataLabel(language),
      status: "unknown" as const
    }
  ];
  return `<section class="sl-feed-section" aria-label="Technical Audit" data-feed-section="technical">
    ${renderSectionHeader(
      language === "ru" ? "Технический обзор" : "On-Page Overview",
      language === "ru"
        ? "Конфигурация сервера и характеристики страницы"
        : "Server configuration and page characteristics",
      language === "ru"
        ? "Показывает технические сигналы страницы: статус, размер DOM, headers, render-blocking assets и совпадение metadata с контентом."
        : "Shows page technical signals: status, DOM size, headers, render-blocking assets, and metadata/content alignment."
    )}
    <div class="sl-technical-score">
      ${renderScoreDial(String(score), "On-Page", status)}
      <div>
        <span>${language === "ru" ? "Оценка страницы" : "On-Page Score"}</span>
        <strong>${escapeHtml(String(score))}</strong>
        <p>${escapeHtml(formatTechnicalScoreReason(technicalAudit, language))}</p>
      </div>
    </div>
    ${renderActionList(
      language === "ru" ? "Что исправить технически" : "Technical next steps",
      language === "ru"
        ? "Исправьте это перед тем, как считать страницу технически здоровой"
        : "Fix these before treating the page as technically healthy",
      buildTechnicalActions(technicalAudit, language),
      language
    )}
    ${renderTechnicalTable("Overview", overview, language)}
    ${renderTechnicalMetricSection(
      language === "ru" ? "Серверные тайминги" : "Server Timing",
      language === "ru"
        ? "Ответ сервера и время загрузки, не Lighthouse"
        : "Server-side response and load times (not Lighthouse)",
      technicalAudit?.timings ?? [],
      language
    )}
    ${renderTechnicalMetricSection(
      language === "ru" ? "Render Blocking" : "Render Blocking",
      language === "ru"
        ? "Скрипты и стили, блокирующие первый рендер"
        : "Scripts and stylesheets blocking page render",
      technicalAudit?.renderBlocking ?? [],
      language
    )}
    ${renderTechnicalRelevance(technicalAudit?.relevance ?? [], language)}
    ${renderTechnicalTable("Open Graph", technicalAudit?.openGraph ?? [], language)}
    ${renderTechnicalTable("Twitter", technicalAudit?.twitter ?? [], language)}
  </section>`;
}

function formatTechnicalScoreReason(
  technicalAudit: OverlayTechnicalAudit | undefined,
  language: OverlayLanguage
): string {
  if (technicalAudit === undefined) {
    return language === "ru"
      ? "Основано на локальных diagnostics, пока browser audit недоступен."
      : "Based on local diagnostics until the browser audit is available.";
  }
  const metrics = collectTechnicalMetrics(technicalAudit);
  const errors = metrics.filter((metric) => metric.status === "error").length;
  const warnings = metrics.filter((metric) => metric.status === "warn").length;
  const unknown = metrics.filter(
    (metric) => metric.status === "unknown"
  ).length;
  if (language === "ru") {
    return `${formatRuCount(errors, "плохой сигнал", "плохих сигнала", "плохих сигналов")} · ${formatRuCount(warnings, "предупреждение", "предупреждения", "предупреждений")} · ${formatRuCount(unknown, "неизвестное поле", "неизвестных поля", "неизвестных полей")}`;
  }
  return `${formatCount(errors, "poor signal")} · ${formatCount(warnings, "warning")} · ${formatCount(unknown, "unknown field")}`;
}

function buildTechnicalActions(
  technicalAudit: OverlayTechnicalAudit | undefined,
  language: OverlayLanguage
): readonly OverlayActionItem[] {
  if (technicalAudit === undefined) {
    return [
      {
        title:
          language === "ru"
            ? "Дождитесь технических данных браузера"
            : "Wait for browser technical data",
        detail:
          language === "ru"
            ? "SearchLint нужны rendered DOM и navigation timing, чтобы ранжировать технические исправления."
            : "SearchLint needs rendered DOM and navigation timing before it can rank technical fixes.",
        status: "unknown"
      }
    ];
  }
  const actions: OverlayActionItem[] = [];
  actions.push({
    title:
      language === "ru"
        ? "Проверьте site essentials"
        : "Review site essentials",
    detail:
      language === "ru"
        ? "robots.txt, sitemap.xml, llms.txt, 404 и mobile check находятся в SEO checklist; для XML validity и redirects нужен crawler/source evidence."
        : "robots.txt, sitemap.xml, llms.txt, 404, and mobile check are in the SEO checklist; XML validity and redirects need crawler/source evidence.",
    status: "unknown"
  });
  const blocking = technicalAudit.renderBlocking.filter(
    (metric) => metric.status === "error" || metric.status === "warn"
  );
  if (blocking.length > 0) {
    actions.push({
      title:
        language === "ru"
          ? "Уменьшите render-blocking assets"
          : "Reduce render-blocking assets",
      detail: blocking
        .map(
          (metric) =>
            `${metric.label}: ${metric.value ?? noDataLabel(language)}`
        )
        .join(" · "),
      status: blocking.some((metric) => metric.status === "error")
        ? "error"
        : "warn"
    });
  }
  const relevance = technicalAudit.relevance.filter(
    (metric) => metric.status === "error" || metric.status === "warn"
  );
  if (relevance.length > 0) {
    actions.push({
      title:
        language === "ru"
          ? "Согласуйте metadata с видимым контентом"
          : "Align metadata with visible content",
      detail: relevance
        .map(
          (metric) =>
            `${metric.label}: ${metric.value ?? noDataLabel(language)}`
        )
        .join(" · "),
      status: relevance.some((metric) => metric.status === "error")
        ? "error"
        : "warn"
    });
  }
  const missingOpenGraph = technicalAudit.openGraph.filter(
    (metric) => metric.status === "unknown"
  );
  if (missingOpenGraph.length > 0) {
    actions.push({
      title:
        language === "ru"
          ? "Заполните Open Graph metadata"
          : "Complete Open Graph metadata",
      detail:
        language === "ru"
          ? `Не хватает ${missingOpenGraph
              .map((metric) => metric.label)
              .slice(0, 3)
              .join(", ")}.`
          : `Missing ${missingOpenGraph
              .map((metric) => metric.label)
              .slice(0, 3)
              .join(", ")}.`,
      status: "warn"
    });
  }
  const unknownOverview = technicalAudit.overview.filter(
    (metric) => metric.status === "unknown"
  );
  if (unknownOverview.length > 0) {
    actions.push({
      title:
        language === "ru"
          ? "Проверьте server headers"
          : "Verify server headers",
      detail:
        language === "ru"
          ? "Server, encoding и cacheability требуют response headers; один browser DOM не может это доказать."
          : "Server, encoding, and cacheability require response headers; browser DOM alone cannot prove them.",
      status: "unknown"
    });
  }
  return actions;
}

function collectTechnicalMetrics(
  technicalAudit: OverlayTechnicalAudit
): readonly OverlayTechnicalMetric[] {
  return [
    ...technicalAudit.overview,
    ...technicalAudit.timings,
    ...technicalAudit.renderBlocking,
    ...technicalAudit.relevance,
    ...technicalAudit.openGraph,
    ...technicalAudit.twitter
  ];
}

function renderTechnicalTable(
  title: string,
  rows: readonly OverlayTechnicalMetric[],
  language: OverlayLanguage = "en"
): string {
  if (rows.length === 0) return "";
  return `<div class="sl-technical-block">
    ${title === "Overview" ? "" : `<h3>${escapeHtml(title)}</h3>`}
    <div class="sl-technical-table">
      ${rows.map((row) => renderTechnicalRow(row, language)).join("")}
    </div>
  </div>`;
}

function renderTechnicalRow(
  row: OverlayTechnicalMetric,
  language: OverlayLanguage = "en"
): string {
  const iconTone = row.status === "unknown" ? "info" : (row.status ?? "info");
  return `<div class="sl-technical-row">
    <span>${renderFeedIcon("readability", iconTone)}${escapeHtml(technicalMetricLabel(row.label, language))}</span>
    ${renderMetricValueWithReason(row.label, row.value, row.status, language)}
  </div>`;
}

function renderMetricValueWithReason(
  label: string,
  value: string | undefined,
  status: OverlayMetricStatus | undefined,
  language: OverlayLanguage,
  detail?: string | undefined
): string {
  const displayValue = normalizeDisplayValue(value, language);
  const missing =
    status === "unknown" || value === undefined || value === "N/A";
  const reason =
    detail ??
    (missing ? explainMissingMetric(label, value, language) : undefined);
  return `<div class="sl-technical-value">
    <strong>${escapeHtml(displayValue)}</strong>
    ${reason ? `<small>${escapeHtml(reason)}</small>` : ""}
  </div>`;
}

function explainMissingMetric(
  label: string,
  value: string | undefined,
  language: OverlayLanguage
): string {
  if (value === "Not connected") {
    return language === "ru"
      ? "Provider не подключен"
      : "Provider not connected";
  }
  if (
    label === "Server" ||
    label === "Status" ||
    label === "Encoding" ||
    label === "Page Size" ||
    label === "Cacheable"
  ) {
    return language === "ru"
      ? "Нужны response headers"
      : "Needs response headers";
  }
  if (
    label === "TTFB" ||
    label === "Download" ||
    label === "Load" ||
    label === "DCL"
  ) {
    return language === "ru"
      ? "Нужны navigation timing"
      : "Needs navigation timing";
  }
  if (
    label === "Primary market" ||
    label === "Detected language" ||
    label === "Locale" ||
    label === "Hreflang" ||
    label === "Local intent"
  ) {
    return language === "ru"
      ? "Нужны rendered language/metadata"
      : "Needs rendered language/metadata";
  }
  if (value === "Missing") {
    return language === "ru" ? "Сигнал не найден" : "Signal not found";
  }
  return language === "ru" ? "Пока нет доказательства" : "No evidence yet";
}

function renderTechnicalMetricSection(
  title: string,
  subtitle: string,
  metrics: readonly OverlayTechnicalMetric[],
  language: OverlayLanguage = "en"
): string {
  if (metrics.length === 0) return "";
  return `<div class="sl-technical-block">
    ${renderSectionHeader(title, subtitle)}
    <div class="sl-technical-metrics">
      ${metrics.map((metric) => renderTechnicalMetricCard(metric, language)).join("")}
    </div>
  </div>`;
}

function renderTechnicalMetricCard(
  metric: OverlayTechnicalMetric,
  language: OverlayLanguage = "en"
): string {
  return `<div class="sl-vital sl-vital--${metric.status ?? "unknown"}">
    <div class="sl-vital__label"><span aria-hidden="true"></span>${escapeHtml(technicalMetricLabel(metric.label, language))}</div>
    <strong>${escapeHtml(normalizeDisplayValue(metric.value, language))}</strong>
  </div>`;
}

function renderTechnicalRelevance(
  metrics: readonly OverlayTechnicalMetric[],
  language: OverlayLanguage = "en"
): string {
  if (metrics.length === 0) return "";
  return `<div class="sl-technical-block">
    ${renderSectionHeader(
      language === "ru" ? "Релевантность контента" : "Content Relevance",
      language === "ru"
        ? "Насколько metadata совпадает с содержимым страницы"
        : "How well your metadata matches page content"
    )}
    <div class="sl-relevance-card">
      ${metrics.map((metric) => renderRelevanceRow(metric, language)).join("")}
    </div>
  </div>`;
}

function renderRelevanceRow(
  metric: OverlayTechnicalMetric,
  language: OverlayLanguage = "en"
): string {
  const rawValue = Number.parseInt(metric.value ?? "0", 10);
  const value = Number.isFinite(rawValue)
    ? Math.max(0, Math.min(rawValue, 100))
    : 0;
  const status = metric.status ?? statusForScore(value);
  return `<div class="sl-relevance-row sl-relevance-row--${status}">
    <div><span>${escapeHtml(technicalMetricLabel(metric.label, language))}</span><strong>${escapeHtml(normalizeDisplayValue(metric.value, language))}</strong></div>
    <i style="--sl-relevance:${String(value)}%"></i>
  </div>`;
}

function normalizeDisplayValue(
  value: string | undefined,
  language: OverlayLanguage
): string {
  if (value === undefined || value === "N/A") return noDataLabel(language);
  if (language === "ru") {
    if (value === "Present") return "Есть";
    if (value === "Missing") return "Нет";
    if (value === "Detected") return "Найдено";
    if (value === "Not connected") return "Не подключено";
  }
  return value;
}

function technicalMetricLabel(
  label: string,
  language: OverlayLanguage
): string {
  if (language !== "ru") return label;
  if (label === "Server") return "Сервер";
  if (label === "Status") return "Статус";
  if (label === "Encoding") return "Кодировка";
  if (label === "Page Size") return "Размер страницы";
  if (label === "DOM Size") return "Размер DOM";
  if (label === "Cacheable") return "Кэширование";
  if (label === "Blocking Scripts") return "Блокирующие скрипты";
  if (label === "Blocking Stylesheets") return "Блокирующие стили";
  if (label === "Title Relevance") return "Релевантность title";
  if (label === "Keyword Relevance") return "Релевантность keywords";
  if (label === "Primary market") return "Основной рынок";
  if (label === "Detected language") return "Язык страницы";
  if (label === "Locale") return "Локаль";
  if (label === "Hreflang") return "Hreflang";
  if (label === "Local intent") return "Локальный intent";
  return label;
}

function renderGeoAudit(
  geoAudit: OverlayGeoAudit | undefined,
  language: OverlayLanguage
): string {
  const score = geoAudit?.score;
  const status: OverlayMetricStatus =
    score === undefined
      ? "unknown"
      : score >= 80
        ? "pass"
        : score >= 50
          ? "warn"
          : "error";
  const overviewRows: readonly OverlayTechnicalMetric[] = geoAudit
    ? [
        {
          label: "Primary market",
          value: geoAudit.primaryMarket,
          status: "pass"
        },
        {
          label: "Detected language",
          value: geoAudit.detectedLanguage,
          status: geoAudit.detectedLanguage === "N/A" ? "unknown" : "pass"
        },
        {
          label: "Locale",
          value: geoAudit.locale,
          status: geoAudit.locale === "N/A" ? "unknown" : "pass"
        },
        {
          label: "Hreflang",
          value: geoAudit.hreflangStatus === "present" ? "Present" : "Missing",
          status: geoAudit.hreflangStatus === "present" ? "pass" : "warn"
        },
        {
          label: "Local intent",
          value: geoAudit.localIntent,
          status: geoAudit.localIntent === "N/A" ? "unknown" : "pass"
        }
      ]
    : [
        {
          label: "Primary market",
          value: noDataLabel(language),
          status: "unknown"
        },
        {
          label: "Detected language",
          value: noDataLabel(language),
          status: "unknown"
        },
        { label: "Locale", value: noDataLabel(language), status: "unknown" },
        { label: "Hreflang", value: noDataLabel(language), status: "unknown" },
        {
          label: "Local intent",
          value: noDataLabel(language),
          status: "unknown"
        }
      ];
  return `<section class="sl-feed-section" aria-label="GEO Audit" data-feed-section="geo">
    ${renderSectionHeader(
      language === "ru" ? "GEO обзор" : "GEO Overview",
      language === "ru"
        ? "Региональные search-сигналы и локализованные страницы"
        : "Regional search signals and localized coverage",
      language === "ru"
        ? "Показывает язык, locale, hreflang, локальный intent, market pages и подключение региональных search providers."
        : "Shows language, locale, hreflang, local intent, market pages, and regional search provider connectivity."
    )}
    <div class="sl-technical-score">
      ${renderScoreDial(score === undefined ? noDataScoreLabel() : String(score), "GEO", status)}
      <div>
        <span>${language === "ru" ? "Оценка региональных сигналов" : "Region Signal Score"}</span>
        <strong>${escapeHtml(score === undefined ? noDataLabel(language) : String(score))}</strong>
        <p>${escapeHtml(formatGeoScoreReason(geoAudit, language))}</p>
      </div>
    </div>
    ${renderActionList(
      language === "ru" ? "Что улучшить для GEO" : "GEO next steps",
      language === "ru"
        ? "Что сделать перед расширением регионального search coverage"
        : "What to do before expanding regional search coverage",
      buildGeoActions(geoAudit, language),
      language
    )}
    ${renderTechnicalTable("Overview", overviewRows, language)}
    ${renderGeoSignalTable(
      language === "ru" ? "Язык и локаль" : "Language & Locale",
      geoAudit?.languageSignals ?? [],
      language
    )}
    ${renderGeoSignalTable(
      language === "ru"
        ? "Региональные search-сигналы"
        : "Regional Search Signals",
      geoAudit?.regionalSignals ?? [],
      language
    )}
    ${renderGeoMarketCoverage(geoAudit?.marketCoverage ?? [], language)}
    ${renderGeoSignalTable(
      language === "ru" ? "Search providers" : "Search Engine Providers",
      geoAudit?.providers ?? [],
      language
    )}
  </section>`;
}

function formatGeoScoreReason(
  geoAudit: OverlayGeoAudit | undefined,
  language: OverlayLanguage
): string {
  if (geoAudit === undefined) {
    return language === "ru"
      ? "Ожидаем rendered language и региональные сигналы."
      : "Waiting for rendered language and regional signals.";
  }
  const detectedSignals = geoAudit.regionalSignals.filter(
    (signal) => signal.value === "Detected"
  ).length;
  if (language === "ru") {
    return `${formatRuCount(detectedSignals, "региональный сигнал", "региональных сигнала", "региональных сигналов")} · ${formatRuCount(geoAudit.marketCoverage.length, "market URL", "market URL", "market URL")} · ${geoAudit.hreflangStatus === "present" ? "hreflang есть" : "hreflang нет"}`;
  }
  return `${formatCount(detectedSignals, "regional signal")} · ${formatCount(geoAudit.marketCoverage.length, "market URL")} · ${geoAudit.hreflangStatus === "present" ? "hreflang present" : "hreflang missing"}`;
}

function buildGeoActions(
  geoAudit: OverlayGeoAudit | undefined,
  language: OverlayLanguage
): readonly OverlayActionItem[] {
  if (geoAudit === undefined) {
    return [
      {
        title: language === "ru" ? "Дождитесь GEO audit" : "Wait for GEO audit",
        detail:
          language === "ru"
            ? "SearchLint сначала нужны rendered language, metadata и internal links страницы."
            : "SearchLint needs the rendered page language, metadata, and internal links first.",
        status: "unknown"
      }
    ];
  }
  const actions: OverlayActionItem[] = [];
  if (geoAudit.hreflangStatus === "missing") {
    actions.push({
      title:
        language === "ru"
          ? "Добавьте hreflang alternates"
          : "Add hreflang alternates",
      detail:
        language === "ru"
          ? "Локализованным страницам нужны alternate language links, чтобы поисковики поняли market targeting."
          : "Localized pages need explicit alternate language links so search engines understand market targeting.",
      status: "warn"
    });
  }
  if (geoAudit.locale === "N/A") {
    actions.push({
      title: language === "ru" ? "Добавьте og:locale" : "Add og:locale",
      detail:
        language === "ru"
          ? "Укажите Open Graph locale для основного рынка, например ru_RU для русских страниц."
          : "Set the Open Graph locale for the primary market, for example ru_RU for Russian pages.",
      status: "warn"
    });
  }
  if (geoAudit.marketCoverage.length === 0) {
    actions.push({
      title:
        language === "ru"
          ? "Покажите локализованные market pages"
          : "Expose localized market pages",
      detail:
        language === "ru"
          ? "Добавьте ссылки на country/language/city pages из rendered page, чтобы coverage был discoverable."
          : "Link to country, language, or city pages from the rendered page so coverage is discoverable.",
      status: "warn"
    });
  }
  const missingSignals = geoAudit.regionalSignals.filter(
    (signal) => signal.value !== "Detected"
  );
  if (missingSignals.length > 0) {
    actions.push({
      title:
        language === "ru"
          ? "Усильте региональный intent"
          : "Strengthen regional intent",
      detail:
        language === "ru"
          ? `Не хватает ${missingSignals
              .map((signal) => signal.label)
              .slice(0, 3)
              .join(", ")}.`
          : `Missing ${missingSignals
              .map((signal) => signal.label)
              .slice(0, 3)
              .join(", ")}.`,
      status: "warn"
    });
  }
  if (
    geoAudit.providers.some((provider) => provider.value === "Not connected")
  ) {
    actions.push({
      title:
        language === "ru"
          ? "Подключите региональные search providers"
          : "Connect regional search providers",
      detail:
        language === "ru"
          ? "GSC, Yandex Webmaster и Metrica нужны для реальных country/query/indexing evidence."
          : "GSC, Yandex Webmaster, and Metrica are needed for real country/query/indexing evidence.",
      status: "unknown"
    });
  }
  return actions;
}

function renderGeoSignalTable(
  title: string,
  rows: readonly OverlayGeoSignal[],
  language: OverlayLanguage
): string {
  if (rows.length === 0) return "";
  return `<div class="sl-technical-block">
    ${renderSectionHeader(
      title,
      title === "Search Engine Providers" || title === "Search providers"
        ? language === "ru"
          ? "Внешние источники country/query data"
          : "External country/query data sources"
        : language === "ru"
          ? "Сигналы, найденные на rendered page"
          : "Signals detected on this rendered page"
    )}
    <div class="sl-technical-table">
      ${rows.map((row) => renderGeoSignalRow(row, language)).join("")}
    </div>
  </div>`;
}

function renderGeoSignalRow(
  row: OverlayGeoSignal,
  language: OverlayLanguage
): string {
  const iconTone = row.status === "unknown" ? "info" : (row.status ?? "info");
  const value = normalizeDisplayValue(row.value, language);
  return `<div class="sl-technical-row">
    <span>${renderFeedIcon("readability", iconTone)}${escapeHtml(technicalMetricLabel(row.label, language))}</span>
    ${renderMetricValueWithReason(row.label, row.value, row.status, language, row.detail)}
  </div>`;
}

function renderGeoMarketCoverage(
  pages: readonly OverlayGeoMarketPage[],
  language: OverlayLanguage
): string {
  return `<div class="sl-technical-block">
    ${renderSectionHeader(
      language === "ru" ? "Market coverage" : "Market Coverage",
      language === "ru"
        ? "Локализованные страницы, найденные во внутренних ссылках"
        : "Localized pages found in internal links"
    )}
    <div class="sl-link-table">
      <div class="sl-link-table__head">
        <strong>${language === "ru" ? "Market pages" : "Market pages"}</strong>
        <span>${language === "ru" ? formatRuCount(pages.length, "URL", "URL", "URL") : formatCount(pages.length, "URL")}</span>
      </div>
      ${
        pages.length === 0
          ? `<p class="sl-link-empty">${language === "ru" ? "На этой странице локализованные market pages не найдены." : "No localized market pages found on this page."}</p>`
          : pages
              .slice(0, 10)
              .map((page) => renderGeoMarketRow(page, language))
              .join("")
      }
      ${
        pages.length > 10
          ? `<p class="sl-link-empty">${escapeHtml(
              language === "ru"
                ? `Показано 10 из ${pages.length} market URL.`
                : `Showing 10 of ${pages.length} market URLs.`
            )}</p>`
          : ""
      }
    </div>
  </div>`;
}

function renderGeoMarketRow(
  page: OverlayGeoMarketPage,
  language: OverlayLanguage = "en"
): string {
  return `<div class="sl-link-row">
    <div>
      <p>${escapeHtml(page.label)}</p>
      <small>${escapeHtml(page.url)}</small>
    </div>
    <span>${escapeHtml(
      [
        page.market,
        page.locale,
        language === "ru"
          ? formatRuCount(page.links, "ссылка", "ссылки", "ссылок")
          : formatCount(page.links, "link")
      ]
        .filter(Boolean)
        .join(" · ")
    )}</span>
  </div>`;
}

function renderVital(
  label: string,
  value: string,
  statusText: string,
  status: OverlayMetricStatus,
  help?: string
): string {
  return `<div class="sl-vital sl-vital--${status}">
    <div class="sl-vital__label"><span aria-hidden="true"></span>${escapeHtml(label)}${help ? renderHelpTooltip(label, help) : ""}</div>
    <strong>${escapeHtml(value)}</strong>
    <small>${escapeHtml(statusText)}</small>
  </div>`;
}

function renderLocalPerformance(
  performance: OverlayLocalPerformance | undefined
): string {
  const metricCards = performance
    ? [
        renderOptionalPerformanceMetric("LCP", performance.lcpMs, rateLcp),
        renderOptionalPerformanceMetric("FCP", performance.fcpMs, rateFcp),
        renderOptionalPerformanceMetric("TBT", performance.tbtMs, rateTbt),
        renderOptionalPerformanceMetric(
          "CLS",
          performance.cls,
          rateCls,
          formatCls
        ),
        renderOptionalPerformanceMetric("LOAD", performance.loadMs, rateLoad),
        renderOptionalPerformanceMetric(
          "DCL",
          performance.domContentLoadedMs,
          rateDcl
        )
      ].filter((card): card is string => card !== "")
    : [];
  const subtitle =
    performance === undefined
      ? "Waiting for local browser timing"
      : `Local browser timing · ${formatViewport(performance.viewport)}`;
  return `<section class="sl-feed-section" aria-label="Local Performance">
    ${renderSectionHeader("Local Performance", subtitle)}
    <div class="sl-vitals-card">
      ${
        metricCards.length === 0
          ? "<p>Timing data is not available yet. Rerun SearchLint after the page finishes loading.</p>"
          : `<div class="sl-vitals-grid">${metricCards.join("")}</div><p>Local browser timing can differ from Lighthouse and field data.</p>`
      }
    </div>
  </section>`;
}

function renderOptionalPerformanceMetric(
  label: string,
  value: number | undefined,
  rate: (value: number | undefined) => OverlayMetricStatus,
  format: (value: number | undefined) => string = formatMs
): string {
  if (value === undefined) return "";
  const status = rate(value);
  return renderVital(
    label,
    format(value),
    metricStatusText(status),
    status,
    helpForMetricLabel(label)
  );
}

function rateLcp(value: number | undefined): OverlayMetricStatus {
  if (value === undefined) return "unknown";
  if (value <= 2500) return "pass";
  if (value <= 4000) return "warn";
  return "error";
}

function rateFcp(value: number | undefined): OverlayMetricStatus {
  if (value === undefined) return "unknown";
  if (value <= 1800) return "pass";
  if (value <= 3000) return "warn";
  return "error";
}

function rateTbt(value: number | undefined): OverlayMetricStatus {
  if (value === undefined) return "unknown";
  if (value <= 200) return "pass";
  if (value <= 600) return "warn";
  return "error";
}

function rateCls(value: number | undefined): OverlayMetricStatus {
  if (value === undefined) return "unknown";
  if (value <= 0.1) return "pass";
  if (value <= 0.25) return "warn";
  return "error";
}

function rateLoad(value: number | undefined): OverlayMetricStatus {
  if (value === undefined) return "unknown";
  if (value <= 3000) return "pass";
  if (value <= 6000) return "warn";
  return "error";
}

function rateDcl(value: number | undefined): OverlayMetricStatus {
  if (value === undefined) return "unknown";
  if (value <= 2000) return "pass";
  if (value <= 4000) return "warn";
  return "error";
}

function metricStatusText(status: OverlayMetricStatus): string {
  if (status === "pass") return "Pass";
  if (status === "warn") return "Warn";
  if (status === "error") return "Poor";
  return "Pending";
}

function formatMs(value: number | undefined): string {
  if (value === undefined) return "N/A";
  if (value >= 1000) return `${(value / 1000).toFixed(1)}s`;
  return `${Math.round(value)}ms`;
}

function formatCls(value: number | undefined): string {
  if (value === undefined) return "N/A";
  return value.toFixed(3);
}

function formatViewport(
  viewport: OverlayLocalPerformance["viewport"] | undefined
): string {
  if (viewport === undefined) return "current viewport";
  return `${viewport.width}x${viewport.height}`;
}

const healthGroups = [
  {
    label: "Indexability",
    categories: ["indexability", "canonical-hreflang", "robots-sitemaps"],
    help: "Whether search engines can crawl, index, and understand the canonical version of this page."
  },
  {
    label: "Metadata",
    categories: ["title-metadata", "headings-structure"],
    help: "Title, description, and heading signals. These affect snippets, click-through, and page understanding."
  },
  {
    label: "Images",
    categories: ["images-social-preview"],
    help: "Image alt text and social preview signals. These affect accessibility, image SEO, and previews."
  },
  {
    label: "Links",
    categories: ["links-site-graph"],
    help: "Internal and external link signals. These affect crawl paths, authority flow, and user navigation."
  },
  {
    label: "Technical",
    categories: ["http-rendering", "performance"],
    help: "Rendering, HTTP, and performance signals. These affect whether the page works reliably for users and bots."
  },
  {
    label: "Schema",
    categories: ["schema-org"],
    help: "Structured data signals. These help search engines understand entities, products, articles, and rich results."
  }
] as const;

function renderSeoHealth(
  diagnostics: readonly OverlayRenderDiagnostic[],
  language: OverlayLanguage
): string {
  const rows = healthGroups
    .map((group) =>
      buildHealthGroupRow(
        group.label,
        diagnostics,
        group.categories,
        group.help,
        language
      )
    )
    .sort(
      (left, right) =>
        healthPriority(right.status) - healthPriority(left.status)
    );
  return `<section class="sl-feed-section" aria-label="SEO Health" data-feed-section="seo">
    ${renderSectionHeader(
      "SEO Health",
      language === "ru"
        ? "Локальные диагностики по группам сигналов"
        : "Local diagnostics by signal group",
      language === "ru"
        ? "Сводка по группам SEO-сигналов. Используйте её, чтобы понять, где проблема, до открытия полного списка ошибок."
        : "A grouped health summary. Use it to see which SEO area needs attention before opening the detailed issues."
    )}
    <div class="sl-health-table">
      <div class="sl-health-row sl-health-row--head">
        <span>${language === "ru" ? "Сигнал" : "Signal"}</span>
        <span>${language === "ru" ? "Статус" : "Value"}</span>
      </div>
      ${rows.map((row) => renderHealthGroupRow(row)).join("")}
    </div>
  </section>`;
}

function buildHealthGroupRow(
  label: string,
  diagnostics: readonly OverlayRenderDiagnostic[],
  categories: readonly DiagnosticCategory[],
  help: string,
  language: OverlayLanguage
): {
  label: string;
  value: string;
  status: "pass" | "warn" | "error";
  icon: "mobile" | "readability" | "warning";
  help: string;
} {
  const groupDiagnostics = diagnostics.filter((diagnostic) =>
    categories.includes(categoryForRuleId(diagnostic.ruleId))
  );
  const status = statusForDiagnostics(groupDiagnostics);
  const value =
    groupDiagnostics.length === 0
      ? healthStatusLabel("pass", language)
      : `${healthStatusLabel(status, language)} · ${formatIssueCount(groupDiagnostics.length, language)}`;
  return {
    label: healthGroupLabel(label, language),
    value,
    status,
    icon: iconForHealthLabel(label),
    help: healthGroupHelp(label, help, language)
  };
}

function healthPriority(status: "pass" | "warn" | "error"): number {
  if (status === "error") return 3;
  if (status === "warn") return 2;
  return 1;
}

function renderHealthGroupRow(row: {
  label: string;
  value: string;
  status: "pass" | "warn" | "error";
  icon: "mobile" | "readability" | "warning";
  help: string;
}): string {
  return renderHealthRow(row.label, row.value, row.status, row.icon, row.help);
}

function statusForDiagnostics(
  diagnostics: readonly OverlayRenderDiagnostic[]
): "pass" | "warn" | "error" {
  if (
    diagnostics.some(
      (diagnostic) =>
        diagnostic.severity === "blocker" || diagnostic.severity === "error"
    )
  ) {
    return "error";
  }
  if (diagnostics.length > 0) {
    return "warn";
  }
  return "pass";
}

function healthStatusLabel(
  status: "pass" | "warn" | "error",
  language: OverlayLanguage
): string {
  if (language === "ru") {
    if (status === "error") return "Провал";
    if (status === "warn") return "Внимание";
    return "Пройдено";
  }
  if (status === "error") return "Fail";
  if (status === "warn") return "Warn";
  return "Pass";
}

function healthGroupLabel(label: string, language: OverlayLanguage): string {
  if (language !== "ru") return label;
  if (label === "Indexability") return "Индексация";
  if (label === "Metadata") return "Метаданные";
  if (label === "Images") return "Изображения";
  if (label === "Links") return "Ссылки";
  if (label === "Technical") return "Техника";
  if (label === "Schema") return "Schema";
  return label;
}

function healthGroupHelp(
  label: string,
  fallback: string,
  language: OverlayLanguage
): string {
  if (language !== "ru") return fallback;
  if (label === "Indexability") {
    return "Может ли поисковик просканировать, проиндексировать и понять canonical-версию страницы.";
  }
  if (label === "Metadata") {
    return "Title, description и headings. Влияет на сниппеты, клики и понимание страницы.";
  }
  if (label === "Images") {
    return "Alt-тексты и preview-сигналы. Влияет на доступность, image SEO и превью.";
  }
  if (label === "Links") {
    return "Внутренние и внешние ссылки. Влияет на crawl paths, authority flow и навигацию.";
  }
  if (label === "Technical") {
    return "Rendering, HTTP и performance-сигналы. Влияет на надежность страницы для пользователей и ботов.";
  }
  if (label === "Schema") {
    return "Structured data. Помогает поисковикам понимать сущности, продукты, статьи и rich results.";
  }
  return fallback;
}

function formatIssueCount(count: number, language: OverlayLanguage): string {
  if (language === "ru") {
    return `${String(count)} ${count === 1 ? "проблема" : "проблем"}`;
  }
  return formatCount(count, "issue");
}

function iconForHealthLabel(
  label: string
): "mobile" | "readability" | "warning" {
  if (label === "Technical") return "mobile";
  if (label === "Metadata") return "readability";
  return "warning";
}

function renderHealthRow(
  label: string,
  value: string,
  status: "pass" | "warn" | "error" | "unknown",
  icon: "mobile" | "readability" | "warning",
  help?: string
): string {
  const iconTone =
    status === "unknown" ? "info" : status === "error" ? "error" : status;
  return `<div class="sl-health-row sl-health-row--${status}">
    <span>${renderFeedIcon(icon, iconTone)}${escapeHtml(label)}${help ? renderHelpTooltip(label, help) : ""}</span>
    <strong class="sl-health-value sl-health-value--${status}">${escapeHtml(value)}</strong>
  </div>`;
}

function renderIssuesSection(
  matchingDiagnostics: readonly OverlayRenderDiagnostic[],
  visibleDiagnostics: readonly OverlayRenderDiagnostic[],
  suppressEnabled: boolean,
  language: OverlayLanguage
): string {
  const total = matchingDiagnostics.length;
  return `<section class="sl-feed-section sl-issues-section" aria-label="Issues" data-feed-section="seo">
    <div class="sl-issues-head">
      <div>
        <h3>${language === "ru" ? "Ошибки" : "Issues"}${renderHelpTooltip(
          language === "ru" ? "Ошибки" : "Issues",
          language === "ru"
            ? "Точные находки SearchLint для этой страницы. Скопируйте ошибку как доказательство или fix prompt для coding-агента."
            : "Exact SearchLint findings for this page. Copy an issue for technical evidence, or copy a fix prompt to send directly to a coding agent."
        )}</h3>
        <p>${language === "ru" ? "Проблемы, найденные на странице" : "Detected on-page problems"}</p>
      </div>
      <span class="sl-issues-count">${renderFeedIcon("warning", "warn")}${String(total)}</span>
    </div>
    <div class="sl-issues-table" role="list" aria-label="Diagnostics">
      <div class="sl-issues-table__head">
        <strong>${language === "ru" ? "Главные ошибки" : "Top issues"}</strong>
        <span>${language === "ru" ? formatIssueCount(total, language) : `${String(total)} total`}</span>
      </div>
      ${
        visibleDiagnostics.length === 0
          ? `<p class="sl-issue-empty" role="listitem">${
              total === 0
                ? language === "ru"
                  ? "Ошибок не найдено."
                  : "No issues found."
                : language === "ru"
                  ? "Текущие фильтры скрывают все находки SearchLint."
                  : "Current filters hide all SearchLint findings."
            }</p>`
          : visibleDiagnostics
              .slice(0, 4)
              .map((diagnostic) =>
                renderIssueRow(diagnostic, suppressEnabled, language)
              )
              .join("")
      }
    </div>
  </section>`;
}

function renderIssueRow(
  diagnostic: OverlayRenderDiagnostic,
  suppressEnabled: boolean,
  language: OverlayLanguage
): string {
  const location = diagnostic.sourceLocation;
  const selector =
    location?.selector !== undefined
      ? `<button type="button" class="sl-issue-icon-action" data-action="highlight" aria-label="Highlight ${escapeHtml(diagnostic.ruleId)} evidence">${renderFeedIcon("warning", diagnostic.severity === "info" ? "info" : "warn")}</button>`
      : renderFeedIcon(
          "warning",
          diagnostic.severity === "info" ? "info" : "warn"
        );
  return `<article class="sl-issue-row sl-issue-row--${diagnostic.severity}" role="listitem" tabindex="0" data-fingerprint="${escapeHtml(diagnostic.fingerprint)}" data-searchlint-feed-rule-id="${escapeHtml(diagnostic.ruleId)}" data-searchlint-feed-severity="${escapeHtml(diagnostic.severity)}" data-searchlint-feed-category="${escapeHtml(categoryForRuleId(diagnostic.ruleId))}" data-searchlint-feed-source="${escapeHtml(diagnostic.source)}">
    <div class="sl-issue-main">
      ${selector}
      <div>
        <p><span>${language === "ru" ? "Проблема" : "Problem"}</span>${escapeHtml(diagnostic.title)}</p>
        <small>${escapeHtml(diagnostic.ruleId)} · ${escapeHtml(impactForDiagnostic(diagnostic, language))} · ${escapeHtml(categoryLabelForLanguage(categoryForRuleId(diagnostic.ruleId), language))} · ${escapeHtml(sourceLabels[diagnostic.source])} · ${escapeHtml(diagnostic.confidence)}</small>
        <p class="sl-issue-fix"><span>${language === "ru" ? "Действие" : "Fix"}</span>${escapeHtml(issueFixSummary(diagnostic, language))}</p>
        ${renderIssueEvidenceDetails(diagnostic, language)}
      </div>
    </div>
    <div class="sl-issue-actions">
      <span>${escapeHtml(severityLabelForLanguage(diagnostic.severity, language))}</span>
      <button class="sl-issue-primary-action" type="button" data-action="copy-fix-prompt" aria-label="${language === "ru" ? "Скопировать fix prompt для" : "Copy fix prompt for"} ${escapeHtml(diagnostic.ruleId)}">${language === "ru" ? "Скопировать prompt" : "Copy fix prompt"}</button>
      <button type="button" data-action="copy" aria-label="${language === "ru" ? "Скопировать диагностику" : "Copy"} ${escapeHtml(diagnostic.ruleId)}${language === "ru" ? "" : " diagnostic"}">${language === "ru" ? "Диагностика" : "Diagnostic"}</button>
      ${suppressEnabled ? `<button type="button" data-action="suppress" aria-label="${language === "ru" ? "Скрыть диагностику" : "Suppress"} ${escapeHtml(diagnostic.ruleId)}${language === "ru" ? "" : " diagnostic"}">${language === "ru" ? "Скрыть" : "Suppress"}</button>` : ""}
    </div>
  </article>`;
}

function issueFixSummary(
  diagnostic: OverlayRenderDiagnostic,
  language: OverlayLanguage
): string {
  if (diagnostic.expected && diagnostic.actual) {
    return language === "ru"
      ? `Сделайте ${diagnostic.expected}; сейчас ${diagnostic.actual}.`
      : `Make it ${diagnostic.expected}; currently ${diagnostic.actual}.`;
  }
  if (diagnostic.expected) {
    return language === "ru"
      ? `Приведите к ожидаемому состоянию: ${diagnostic.expected}.`
      : `Bring it to the expected state: ${diagnostic.expected}.`;
  }
  return language === "ru"
    ? "Скопируйте prompt и отправьте coding-агенту, затем обновите SearchLint."
    : "Copy the fix prompt, send it to your coding agent, then rerun SearchLint.";
}

function renderIssueEvidenceDetails(
  diagnostic: OverlayRenderDiagnostic,
  language: OverlayLanguage
): string {
  const location = diagnostic.sourceLocation;
  const exactLocation =
    location?.confidence === "EXACT" && location.file
      ? `${location.file}${location.line ? `:${location.line}` : ""}`
      : undefined;
  const maybeRows: Array<readonly [string, string] | undefined> = [
    [
      language === "ru" ? "Источник" : "Source",
      sourceLabels[diagnostic.source]
    ] as const,
    [
      language === "ru" ? "Доверие" : "Confidence",
      diagnostic.confidence
    ] as const,
    [
      language === "ru" ? "Доказательство" : "Evidence",
      diagnostic.evidence
    ] as const,
    diagnostic.expected
      ? ([
          language === "ru" ? "Ожидалось" : "Expected",
          diagnostic.expected
        ] as const)
      : undefined,
    diagnostic.actual
      ? ([
          language === "ru" ? "Фактически" : "Actual",
          diagnostic.actual
        ] as const)
      : undefined,
    exactLocation
      ? ([language === "ru" ? "Файл" : "File", exactLocation] as const)
      : undefined,
    location?.selector
      ? ([
          language === "ru" ? "Selector" : "Selector",
          location.selector
        ] as const)
      : undefined
  ];
  const rows = maybeRows.flatMap((row) => (row === undefined ? [] : [row]));
  return `<details class="sl-issue-evidence">
    <summary>${language === "ru" ? "Доказательства" : "Evidence"}</summary>
    <dl>
      ${rows
        .map(
          ([label, value]) =>
            `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`
        )
        .join("")}
    </dl>
  </details>`;
}

function severityLabelForLanguage(
  severity: OverlayRenderDiagnostic["severity"],
  language: OverlayLanguage
): string {
  if (language !== "ru") return severityLabels[severity];
  if (severity === "blocker") return "Блокер";
  if (severity === "error") return "Ошибка";
  if (severity === "warning") return "Предупреждение";
  return "Инфо";
}

function renderFeedIcon(
  icon: "rss" | "collapse" | "mobile" | "readability" | "warning",
  tone: "pass" | "warn" | "error" | "info" = "info"
): string {
  const toneClass = `sl-feed-icon--${tone}`;
  if (icon === "rss") {
    return `<svg class="sl-feed-icon ${toneClass}" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M3.2 10.9a1.9 1.9 0 1 1 0 3.8 1.9 1.9 0 0 1 0-3.8Z"/><path d="M1.5 6.4c4.5 0 8.1 3.6 8.1 8.1"/><path d="M1.5 2.1c6.9 0 12.4 5.5 12.4 12.4"/></svg>`;
  }
  if (icon === "collapse") {
    return `<svg class="sl-feed-icon ${toneClass}" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M5.25 3.5h7.25v7.25"/><path d="M12.25 3.75 4 12"/></svg>`;
  }
  if (icon === "mobile") {
    return `<svg class="sl-feed-icon ${toneClass}" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><rect x="5" y="2" width="6" height="12" rx="1.5"/><path d="M7.2 12.1h1.6"/></svg>`;
  }
  if (icon === "readability") {
    return `<svg class="sl-feed-icon ${toneClass}" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M3 3.5h10"/><path d="M3 6.7h10"/><path d="M3 9.9h6"/><path d="M3 13h4"/></svg>`;
  }
  return `<svg class="sl-feed-icon ${toneClass}" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M8 2.6 14 13H2L8 2.6Z"/><path d="M8 6.1v3.2"/><path d="M8 11.6h.01"/></svg>`;
}

function formatHostname(pageUrl: string | undefined): string {
  if (!pageUrl) return "outlivion.space";
  try {
    return new URL(pageUrl).hostname.replace(/^www\./, "");
  } catch {
    return (
      pageUrl.replace(/^https?:\/\//, "").split("/")[0] || "outlivion.space"
    );
  }
}

function formatAuditDate(
  diagnostics: readonly Pick<Diagnostic, "observedAt">[],
  language: OverlayLanguage = "en"
): string {
  const timestamps = diagnostics
    .map((diagnostic) => Date.parse(diagnostic.observedAt))
    .filter((timestamp) => !Number.isNaN(timestamp));
  if (timestamps.length === 0) {
    return language === "ru"
      ? "Последняя локальная проверка: нет данных"
      : "Last local audit: not available";
  }
  const latest = new Date(Math.max(...timestamps));
  return language === "ru"
    ? `Последняя локальная проверка: ${latest.toISOString().slice(0, 10)}`
    : `Last local audit: ${latest.toISOString().slice(0, 10)}`;
}

function isSeverityFilterValue(
  value: string
): value is NonNullable<OverlayFilters["severity"]> {
  return (
    value === "all" ||
    value === "blocker" ||
    value === "error" ||
    value === "warning" ||
    value === "info"
  );
}

function isCategoryFilterValue(
  value: string
): value is NonNullable<OverlayFilters["category"]> {
  return (
    value === "all" ||
    value === "http-rendering" ||
    value === "indexability" ||
    value === "title-metadata" ||
    value === "canonical-hreflang" ||
    value === "headings-structure" ||
    value === "images-social-preview" ||
    value === "schema-org" ||
    value === "links-site-graph" ||
    value === "robots-sitemaps" ||
    value === "performance" ||
    value === "unknown"
  );
}

function isSourceFilterValue(
  value: string
): value is NonNullable<OverlayFilters["source"]> {
  return (
    value === "all" ||
    value === "source-code" ||
    value === "raw-html" ||
    value === "rendered-dom" ||
    value === "http-header" ||
    value === "robots-txt" ||
    value === "sitemap" ||
    value === "crawler" ||
    value === "google" ||
    value === "yandex"
  );
}

function renderDiagnosticSummary(
  allDiagnostics: readonly OverlayRenderDiagnostic[],
  matchingDiagnostics: readonly OverlayRenderDiagnostic[],
  runtimeError?: string | undefined,
  filtered = false
): string {
  const counts = countDiagnosticsBySeverity(matchingDiagnostics);
  if (allDiagnostics.length === 0 && runtimeError) {
    return `<div class="sl-summary sl-summary--error" aria-label="Diagnostic summary">
      <strong>SearchLint analysis did not complete</strong>
      <span>Runtime error details are shown below.</span>
    </div>`;
  }
  if (allDiagnostics.length === 0) {
    return `<div class="sl-summary sl-summary--clean" aria-label="Diagnostic summary">
      <strong>No SEO diagnostics found</strong>
      <span>This page currently passes the local SearchLint checks.</span>
    </div>`;
  }
  if (matchingDiagnostics.length === 0) {
    return `<div class="sl-summary sl-summary--filtered-empty" aria-label="Filtered diagnostic summary">
      <strong>No matching diagnostics</strong>
      <span>Current filters hide all ${escapeHtml(formatCount(allDiagnostics.length, "SearchLint finding"))}.</span>
    </div>`;
  }
  return `<div class="sl-summary" aria-label="${filtered ? "Filtered diagnostic summary" : "Diagnostic summary"}">
    ${renderSummaryPill("blocker", counts.blocker)}
    ${renderSummaryPill("error", counts.error)}
    ${renderSummaryPill("warning", counts.warning)}
    ${renderSummaryPill("info", counts.info)}
  </div>`;
}

function hasActiveFilters(filters: OverlayFilters = {}): boolean {
  return (
    (filters.severity !== undefined && filters.severity !== "all") ||
    (filters.category !== undefined && filters.category !== "all") ||
    (filters.source !== undefined && filters.source !== "all")
  );
}

function countDiagnosticsBySeverity(
  diagnostics: readonly Pick<Diagnostic, "severity">[]
): Record<Severity, number> {
  return diagnostics.reduce<Record<Severity, number>>(
    (counts, diagnostic) => ({
      ...counts,
      [diagnostic.severity]: counts[diagnostic.severity] + 1
    }),
    { blocker: 0, error: 0, warning: 0, info: 0 }
  );
}

function renderSummaryPill(severity: Severity, count: number): string {
  return `<span class="sl-summary__pill sl-summary__pill--${severity}">
    <strong>${String(count)}</strong> ${escapeHtml(pluralize(count, severityLabels[severity]))}
  </span>`;
}

function pluralize(count: number, singular: string): string {
  return count === 1 ? singular : `${singular}s`;
}

function formatCount(count: number, singular: string): string {
  return `${String(count)} ${pluralize(count, singular)}`;
}

function formatRuCount(
  count: number,
  singular: string,
  few: string,
  many: string
): string {
  const normalized = Math.abs(count);
  const lastTwo = normalized % 100;
  const last = normalized % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return `${String(count)} ${many}`;
  if (last === 1) return `${String(count)} ${singular}`;
  if (last >= 2 && last <= 4) return `${String(count)} ${few}`;
  return `${String(count)} ${many}`;
}

function renderEmptyState(
  totalDiagnostics: number,
  filteredDiagnostics: number,
  renderedDiagnostics: number
): string {
  if (totalDiagnostics === 0) {
    return `<p class="sl-empty"><strong>No issues found.</strong><span>SearchLint did not find diagnostics for this page.</span></p>`;
  }
  if (filteredDiagnostics > 0 && renderedDiagnostics === 0) {
    return `<p class="sl-empty"><strong>Diagnostics are hidden by the render limit.</strong><span>SearchLint found matching diagnostics, but this constrained overlay view is configured to render no diagnostic cards.</span></p>`;
  }
  return `<p class="sl-empty"><strong>No matching diagnostics.</strong><span>Change filters to see the remaining SearchLint findings.</span></p>`;
}

function limitRenderedDiagnostics(
  diagnostics: readonly OverlayRenderDiagnostic[],
  maxRenderedDiagnostics = defaultMaxRenderedDiagnostics
): readonly OverlayRenderDiagnostic[] {
  if (maxRenderedDiagnostics <= 0) {
    return [];
  }
  return diagnostics.slice(0, maxRenderedDiagnostics);
}

function renderDiagnosticLimitNotice(
  filteredCount: number,
  renderedCount: number
): string {
  if (renderedCount >= filteredCount) {
    return "";
  }
  if (renderedCount === 0) {
    return `<p class="sl-limit-notice" role="status" aria-live="polite">
      Showing 0 of ${String(filteredCount)} matching diagnostics because this overlay view is configured to render no diagnostic cards.
    </p>`;
  }
  return `<p class="sl-limit-notice" role="status" aria-live="polite">
    Showing first ${String(renderedCount)} of ${String(filteredCount)} matching diagnostics. Use filters to narrow the list.
  </p>`;
}

function renderRuntimeError(message: string): string {
  return `<div class="sl-runtime-error" role="alert">
    <strong>SearchLint overlay error</strong>
    <span>${escapeHtml(message)}</span>
  </div>`;
}

function renderActionStatus(
  message: string,
  language: OverlayLanguage = "en"
): string {
  return `<div class="sl-action-status" role="status" aria-live="polite">
    ${escapeHtml(localizeActionMessage(message, language))}
  </div>`;
}

function localizeActionMessage(
  message: string,
  language: OverlayLanguage
): string {
  if (language !== "ru") return message;
  if (message === "Rerunning SearchLint...") {
    return "Обновляем проверку SearchLint...";
  }
  if (message === "Copy is unavailable in this browser.") {
    return "Копирование недоступно в этом браузере.";
  }
  const copiedFixPrompt = /^Copied (.+) fix prompt/.exec(message);
  if (copiedFixPrompt?.[1]) {
    return `Prompt для ${copiedFixPrompt[1]} скопирован. Вставьте агенту, исправьте и нажмите обновление.`;
  }
  const copiedDiagnostic = /^Copied (.+) diagnostic/.exec(message);
  if (copiedDiagnostic?.[1]) {
    return `Диагностика ${copiedDiagnostic[1]} скопирована. Вставьте агенту, исправьте и нажмите обновление.`;
  }
  if (message.startsWith("Copied top SEO fix prompts")) {
    return "Топ prompt-ов скопирован. Вставьте агенту, исправьте и нажмите обновление.";
  }
  if (message.startsWith("Highlighted ")) {
    return "Элементы подсвечены на странице.";
  }
  if (message.startsWith("Cleared highlight")) {
    return "Подсветка очищена.";
  }
  return message;
}

export function formatSuppressActionMessage(
  ruleId: string,
  succeeded: boolean
): string {
  return succeeded
    ? `Suppress action requested for ${ruleId}.`
    : `Suppress action failed for ${ruleId}.`;
}

function getOverlayPositionStorage(document: Document): Storage | undefined {
  try {
    return document.defaultView?.localStorage;
  } catch {
    return undefined;
  }
}

function renderDiagnosticCard(
  diagnostic: OverlayRenderDiagnostic,
  suppressEnabled: boolean
): string {
  const location = diagnostic.sourceLocation;
  const exactLocation =
    location?.confidence === "EXACT" && location.file
      ? `<p><strong>File</strong> ${escapeHtml(location.file)}${location.line ? `:${location.line}` : ""}</p>`
      : "";
  const selector =
    location?.selector !== undefined
      ? `<p><strong>Selector</strong> <code>${escapeHtml(location.selector)}</code> <button type="button" data-action="highlight" aria-label="Highlight ${escapeHtml(diagnostic.ruleId)} evidence">Highlight</button></p>`
      : "";
  return `<article class="sl-card sl-card--${diagnostic.severity}" role="listitem" tabindex="0" data-fingerprint="${escapeHtml(diagnostic.fingerprint)}" data-searchlint-rule-id="${escapeHtml(diagnostic.ruleId)}" data-searchlint-severity="${escapeHtml(diagnostic.severity)}" data-searchlint-category="${escapeHtml(categoryForRuleId(diagnostic.ruleId))}" data-searchlint-source="${escapeHtml(diagnostic.source)}">
    <div class="sl-card__head">
      <span class="sl-severity">${escapeHtml(severityLabels[diagnostic.severity])}</span>
      <span>${escapeHtml(categoryLabels[categoryForRuleId(diagnostic.ruleId)])}</span>
      <span>${escapeHtml(diagnostic.ruleId)}</span>
    </div>
    <h3>${escapeHtml(diagnostic.title)}</h3>
    ${diagnostic.explanation ? `<p>${escapeHtml(diagnostic.explanation)}</p>` : ""}
    <p><strong>Evidence</strong> ${escapeHtml(diagnostic.evidence)}</p>
    ${diagnostic.expected ? `<p><strong>Expected</strong> ${escapeHtml(diagnostic.expected)}</p>` : ""}
    ${diagnostic.actual ? `<p><strong>Actual</strong> ${escapeHtml(diagnostic.actual)}</p>` : ""}
    <p><strong>URL</strong> ${escapeHtml(diagnostic.pageUrl)}</p>
    ${diagnostic.route ? `<p><strong>Route</strong> ${escapeHtml(diagnostic.route)}</p>` : ""}
    <p><strong>Confidence</strong> ${escapeHtml(diagnostic.confidence)}</p>
    <p><strong>Source type</strong> ${escapeHtml(sourceLabels[diagnostic.source])}</p>
    ${exactLocation}
    ${selector}
    ${diagnostic.rawHtmlSnippet ? `<details><summary>Raw HTML</summary><pre>${escapeHtml(diagnostic.rawHtmlSnippet)}</pre></details>` : ""}
    ${diagnostic.renderedDomSnippet ? `<details><summary>Rendered DOM</summary><pre>${escapeHtml(diagnostic.renderedDomSnippet)}</pre></details>` : ""}
    <div class="sl-card__actions">
      <button type="button" data-action="copy" aria-label="Copy ${escapeHtml(diagnostic.ruleId)} diagnostic">Copy diagnostic</button>
      ${suppressEnabled ? `<button type="button" data-action="suppress" aria-label="Suppress ${escapeHtml(diagnostic.ruleId)} diagnostic">Suppress</button>` : ""}
    </div>
  </article>`;
}

async function copyDiagnostic(
  document: Document,
  diagnostic: OverlayRenderDiagnostic,
  onCopy?: (diagnostic: OverlayRenderDiagnostic) => void | Promise<void>
): Promise<boolean> {
  if (onCopy !== undefined) {
    await onCopy(diagnostic);
    return true;
  }
  return copyText(document, formatDiagnosticForClipboard(diagnostic));
}

async function copyText(document: Document, text: string): Promise<boolean> {
  const clipboard = document.defaultView?.navigator.clipboard;
  if (clipboard !== undefined) {
    try {
      await clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to the textarea copy path for local/dev browser surfaces.
    }
  }
  return copyTextWithTextareaFallback(document, text);
}

function copyTextWithTextareaFallback(
  document: Document,
  text: string
): boolean {
  if (typeof document.execCommand !== "function") {
    return false;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  document.body.append(textarea);
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);
  try {
    return document.execCommand("copy");
  } finally {
    textarea.remove();
  }
}

function renderStyles(): string {
  return `<style>
    :host { all: initial; color-scheme: light; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; pointer-events: none; }
    * { box-sizing: border-box; }
    [hidden] { display: none !important; }
    .sl-drawer { position: fixed; top: 50%; z-index: 2147483647; display: flex; align-items: stretch; width: 36px; height: fit-content; margin-top: 0; transform: translateY(-50%); pointer-events: none; }
    .sl-drawer.sl-position--right { right: 0; flex-direction: row; }
    .sl-drawer.sl-position--left { left: 0; flex-direction: row-reverse; }
    .sl-drawer[data-state="open"] { top: 0; width: calc(min(476.778px, calc(100vw - 36px)) + 36px); height: 100vh; margin-top: 0; animation: sl-drawer-open-right 220ms ease-out both; }
    .sl-drawer[data-state="open"].sl-position--left { animation-name: sl-drawer-open-left; }
    .sl-drawer[data-state="closing"] { top: 0; width: calc(min(476.778px, calc(100vw - 36px)) + 36px); height: 100vh; margin-top: 0; animation: sl-drawer-close-right 220ms ease-in both; }
    .sl-drawer[data-state="closing"].sl-position--left { animation-name: sl-drawer-close-left; }
    .sl-badge { position: relative; z-index: 1; display: inline-flex; flex: 0 0 36px; flex-direction: column; align-items: center; justify-content: center; gap: 6px; width: 36px; height: fit-content; min-height: 89px; margin: 0; padding: 8px 2px 2px; border: 1px solid #E8E8E8; background: #fafaf9; color: #726a5a; box-shadow: 0 10px 24px rgb(57 48 34 / 14%); font: 400 16px/1 Inter, ui-sans-serif, system-ui; cursor: grab; overflow: hidden; touch-action: none; user-select: none; white-space: nowrap; pointer-events: auto; }
    .sl-badge:active { cursor: grabbing; }
    .sl-position--right .sl-badge { border-right: 0; border-right-color: #E8E8E8; border-radius: 8px 0 0 8px; }
    .sl-position--left .sl-badge { border-left: 0; border-left-color: #E8E8E8; border-radius: 0 8px 8px 0; }
    .sl-drawer[data-state="open"] .sl-badge, .sl-drawer[data-state="closing"] .sl-badge { align-self: center; height: fit-content; min-height: 119px; box-shadow: none; }
    .sl-drawer[data-state="closing"] .sl-badge { pointer-events: none; }
    .sl-badge--clean, .sl-badge--checking, .sl-badge--info, .sl-badge--warnings, .sl-badge--errors, .sl-badge--blocked { border-color: #E8E8E8; border-inline-color: #E8E8E8; }
    .sl-badge__text { display: flex; align-items: center; justify-content: center; width: 12px; height: fit-content; min-height: 7.5ch; flex: 0 0 auto; }
    .sl-badge__logo { display: block; width: 32px; height: 32px; border-radius: 7px; overflow: hidden; background: #e6ded2; flex: 0 0 32px; }
    .sl-badge__logo svg { display: block; width: 100%; height: 100%; }
    .sl-badge__status { display: block; color: #726a5a; font-weight: 400; letter-spacing: 0; transform: rotate(-90deg); }
    .sl-position--left .sl-badge__status { transform: rotate(90deg); }
    .sl-panel { display: flex; flex: 0 0 min(476.778px, calc(100vw - 36px)); flex-direction: column; width: min(476.778px, calc(100vw - 36px)); height: 100vh; max-height: 100vh; overflow: hidden; border: 0.556px solid #e5e7eb; border-top: 0; border-bottom: 0; background: #fafaf9; color: #1a1919; box-shadow: none; font: 400 12px/1.45 "DM Sans", ui-sans-serif, system-ui; overflow-wrap: anywhere; pointer-events: auto; }
    .sl-panel[hidden] { display: none; }
    .sl-position--right .sl-panel { border-right: 0; border-radius: 8px 0 0 8px; }
    .sl-position--left .sl-panel { border-left: 0; border-radius: 0 8px 8px 0; }
    @keyframes sl-drawer-open-left { from { opacity: 0; transform: translateX(calc(-100% + 36px)); } to { opacity: 1; transform: translateX(0); } }
    @keyframes sl-drawer-open-right { from { opacity: 0; transform: translateX(calc(100% - 36px)); } to { opacity: 1; transform: translateX(0); } }
    @keyframes sl-drawer-close-left { from { opacity: 1; transform: translateX(0); } to { opacity: 0; transform: translateX(calc(-100% + 36px)); } }
    @keyframes sl-drawer-close-right { from { opacity: 1; transform: translateX(0); } to { opacity: 0; transform: translateX(calc(100% - 36px)); } }
    .sl-panel__header { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 36px; padding: 0 12px; border-bottom: 0.556px solid #e5e7eb; background: #fafaf9; }
    .sl-panel__title { display: flex; min-width: 0; align-items: center; gap: 8px; }
    .sl-panel__mark { display: inline-grid; place-items: center; width: 14px; height: 14px; color: #726a5a; line-height: 1; }
    .sl-panel__live { position: relative; width: 6px; height: 6px; border-radius: 999px; background: #008f79; box-shadow: 0 0 3px 1px rgb(0 143 121 / 60%); }
    .sl-panel__live::before { content: ""; position: absolute; inset: -20%; border-radius: inherit; background: #008f79; opacity: 0.45; }
    .sl-panel__scroll { overflow: auto; min-height: 0; }
    .sl-feed-body { display: grid; gap: 12px; padding: 12px; }
    .sl-tabs { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); height: 32px; margin: 8px 12px 0; padding: 2px; border-radius: 6px; background: #f3f4f6; overflow: hidden; }
    .sl-tab { display: inline-flex; align-items: center; justify-content: center; min-width: 0; height: 28px; padding: 0 8px; border: 0; border-radius: 4px; background: transparent; color: #726a5a; font: 500 11px/16.5px "DM Sans", ui-sans-serif, system-ui; cursor: pointer; }
    .sl-tab--active { background: #fafaf9; color: #1a1919; box-shadow: 0 1px 2px rgb(0 0 0 / 5%); }
    .sl-feed-section { display: grid; gap: 12px; }
    [hidden] { display: none !important; }
    .sl-feed-section[hidden] { display: none; }
    .sl-next-action { display: grid; grid-template-columns: 112px minmax(0, 1fr); gap: 10px; padding: 10px 12px; border: 1px solid #e4ddcd; border-radius: 8px; background: #fffdf8; }
    .sl-next-action--pass { background: #f8fff8; border-color: #d7ead6; }
    .sl-next-action--warn { background: #fffbeb; border-color: #ecd8a4; }
    .sl-next-action--error { background: #fff7f7; border-color: #f0c5c5; }
    .sl-next-action--unknown { background: #f8fafc; border-color: #d8e0ea; }
    .sl-next-action__label { display: flex; align-items: center; gap: 6px; color: #726a5a; font: 500 10px/14px "DM Sans", ui-sans-serif, system-ui; letter-spacing: 0.2px; text-transform: uppercase; }
    .sl-next-action__body { display: grid; gap: 5px; min-width: 0; }
    .sl-next-action__body strong { color: #1a1919; font: 600 13px/17px "DM Sans", ui-sans-serif, system-ui; }
    .sl-next-action__body p { color: #4b4338; font: 400 11px/15px "DM Sans", ui-sans-serif, system-ui; overflow-wrap: anywhere; }
    .sl-next-action__body button { justify-self: start; min-height: 22px; padding: 3px 7px; border: 1px solid #d8d0c0; border-radius: 6px; background: #fafaf9; color: #1a1919; font: 500 10px/14px "DM Sans", ui-sans-serif, system-ui; }
    .sl-next-action__evidence { color: #726a5a; font: 400 10px/14px "DM Sans", ui-sans-serif, system-ui; }
    .sl-next-action__evidence summary { cursor: pointer; width: fit-content; color: #4b4338; font-weight: 500; }
    .sl-evidence-strip { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; margin: 2px 0 0; }
    .sl-evidence-strip div { min-width: 0; padding: 6px; border: 1px solid rgb(216 208 192 / 70%); border-radius: 6px; background: rgb(250 250 249 / 72%); }
    .sl-evidence-strip dt { color: #726a5a; font: 500 9px/12px "DM Sans", ui-sans-serif, system-ui; text-transform: uppercase; }
    .sl-evidence-strip dd { margin: 1px 0 0; color: #1a1919; font: 400 10px/13px "DM Sans", ui-sans-serif, system-ui; overflow-wrap: anywhere; }
    .sl-section-head { display: grid; gap: 1.27px; }
    .sl-section-head--with-action { grid-template-columns: minmax(0, 1fr) auto; align-items: start; gap: 8px; }
    .sl-section-head h3 { display: flex; align-items: center; gap: 5px; min-width: 0; }
    .sl-section-head p, .sl-issues-head p { color: #726a5a; font: 400 11px/16.5px "DM Sans", ui-sans-serif, system-ui; }
    .sl-help { position: relative; display: inline-grid; place-items: center; flex: 0 0 14px; width: 14px; height: 14px; min-width: 14px; min-height: 14px; padding: 0; border: 1px solid #d8d0c0; border-radius: 999px; color: #726a5a; background: #fafaf9; font: 700 10px/1 "DM Sans", ui-sans-serif, system-ui; cursor: help; overflow: visible; }
    .sl-help::after { position: absolute; left: 50%; bottom: calc(100% + 7px); z-index: 3; display: none; width: max-content; max-width: min(260px, calc(100vw - 48px)); padding: 7px 8px; border: 1px solid #d8d0c0; border-radius: 6px; background: #1f2937; color: #fff; box-shadow: 0 8px 20px rgb(0 0 0 / 16%); content: attr(data-tooltip); font: 400 11px/15px "DM Sans", ui-sans-serif, system-ui; text-align: left; text-transform: none; white-space: normal; overflow-wrap: anywhere; transform: translateX(-50%); pointer-events: none; }
    .sl-help::before { position: absolute; left: 50%; bottom: calc(100% + 3px); z-index: 4; display: none; width: 8px; height: 8px; background: #1f2937; content: ""; transform: translateX(-50%) rotate(45deg); pointer-events: none; }
    .sl-help:hover::after, .sl-help:focus-visible::after, .sl-help--visible::after, .sl-help:hover::before, .sl-help:focus-visible::before, .sl-help--visible::before { display: block; }
    .sl-copy-all-button { align-self: start; width: fit-content; max-width: 100%; min-height: 24px; padding: 4px 7px; border: 1px solid #d8d0c0; border-radius: 6px; background: #fafaf9; color: #1a1919; font: 500 10px/14px "DM Sans", ui-sans-serif, system-ui; white-space: normal; overflow-wrap: anywhere; }
    .sl-audit-date { padding: 12px 4px 0; color: rgb(114 106 90 / 60%); font: 400 10px/15px "DM Sans", ui-sans-serif, system-ui; }
    .sl-score-card, .sl-vitals-card, .sl-link-card, .sl-action-list__card, .sl-essentials-card, .sl-technical-score, .sl-technical-table, .sl-relevance-card { border: 1px solid #e4ddcd; border-radius: 8px; background: #fafaf9; }
    .sl-score-dial__ring svg { position: absolute; inset: 0; display: block; width: 100%; height: 100%; transform: rotate(-90deg); }
    .sl-score-card { display: grid; gap: 15.27px; padding: 11.82px 12.556px 12.55px; }
    .sl-score-card > p { color: #726a5a; font: 400 10px/13.75px "DM Sans", ui-sans-serif, system-ui; }
    .sl-score-group { display: grid; gap: 8px; }
    .sl-score-group h4 { margin: 0; color: #726a5a; font: 500 11px/16.5px "DM Sans", ui-sans-serif, system-ui; letter-spacing: 0.275px; text-transform: uppercase; }
    .sl-score-note { margin: 0; color: #726a5a; font: 400 10px/13.75px "DM Sans", ui-sans-serif, system-ui; overflow-wrap: anywhere; }
    .sl-provider-empty { display: grid; grid-template-columns: 14px minmax(0, 1fr); gap: 8px; align-items: start; padding: 10px 12px; border: 1px solid #e4ddcd; border-radius: 8px; background: #f8fafc; }
    .sl-provider-empty strong { display: block; color: #374151; font: 600 12px/16px "DM Sans", ui-sans-serif, system-ui; }
    .sl-provider-empty p { margin-top: 2px; color: #726a5a; font: 400 10px/14px "DM Sans", ui-sans-serif, system-ui; overflow-wrap: anywhere; }
    .sl-score-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
    .sl-score-dial { display: grid; justify-items: center; gap: 4px; min-width: 0; color: #374151; }
    .sl-score-dial__ring { position: relative; display: grid; place-items: center; width: 40px; height: 40px; }
    .sl-score-dial__ring circle { fill: none; stroke: currentColor; stroke-width: 3px; }
    .sl-score-dial--pass .sl-score-dial__ring { color: #10b981; }
    .sl-score-dial--warn .sl-score-dial__ring { color: #f59e0b; }
    .sl-score-dial--error .sl-score-dial__ring { color: #ef4444; }
    .sl-score-dial--unknown .sl-score-dial__ring { color: #cbd5e1; }
    .sl-score-dial strong { color: #1f2937; font: 700 12px/15px "DM Sans", ui-sans-serif, system-ui; }
    .sl-score-dial span { width: fit-content; max-width: 104px; color: #374151; font: 400 10px/12.5px "DM Sans", ui-sans-serif, system-ui; text-align: center; white-space: normal; overflow-wrap: anywhere; }
    .sl-score-dial small { max-width: 94px; color: #726a5a; font: 400 9px/11px "DM Sans", ui-sans-serif, system-ui; text-align: center; overflow-wrap: anywhere; }
    .sl-vitals-card { display: grid; gap: 12px; padding: 12.556px; }
    .sl-vitals-card > p { color: #726a5a; font: italic 400 10px/13.75px "DM Sans", ui-sans-serif, system-ui; text-align: center; }
    .sl-vitals-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
    .sl-vital { display: grid; gap: 4px; min-width: 0; padding: 12.556px; border: 1px solid #e4ddcd; border-radius: 8px; background: #fafaf9; }
    .sl-vital__label { display: flex; align-items: center; gap: 6px; color: #726a5a; font: 400 11px/16.5px "DM Sans", ui-sans-serif, system-ui; letter-spacing: 0.275px; text-transform: uppercase; }
    .sl-vital__label span { width: 6px; height: 6px; border-radius: 999px; background: currentColor; }
    .sl-vital strong { font: 700 19px/19px "DM Sans", ui-sans-serif, system-ui; letter-spacing: -0.475px; }
    .sl-vital small { color: #726a5a; font: 400 10px/15px "DM Sans", ui-sans-serif, system-ui; text-transform: capitalize; }
    .sl-vital--pass strong, .sl-vital--pass .sl-vital__label { color: #15803d; }
    .sl-vital--warn strong, .sl-vital--warn .sl-vital__label { color: #ca8a04; }
    .sl-vital--error strong, .sl-vital--error .sl-vital__label { color: #b91c1c; }
    .sl-vital--unknown strong, .sl-vital--unknown .sl-vital__label { color: #64748b; }
    .sl-link-card { display: grid; gap: 12px; padding: 12px; }
    .sl-link-card > p { color: #726a5a; font: 400 11px/16.5px "DM Sans", ui-sans-serif, system-ui; }
    .sl-action-list { display: grid; gap: 8px; }
    .sl-action-list__card { overflow: visible; }
    .sl-action-item { display: grid; grid-template-columns: 14px minmax(0, 1fr); gap: 8px; padding: 9px 12px; border-top: 0.556px solid #e4ddcd; }
    .sl-action-item:first-child { border-top: 0; }
    .sl-action-item > span { padding-top: 2px; }
    .sl-action-item strong { display: block; color: #1a1919; font: 500 12px/18px "DM Sans", ui-sans-serif, system-ui; }
    .sl-action-item p { margin-top: 1px; color: #726a5a; font: 400 11px/15px "DM Sans", ui-sans-serif, system-ui; overflow-wrap: anywhere; }
    .sl-action-item button { margin-top: 6px; min-height: 22px; padding: 3px 7px; border: 1px solid #d8d0c0; border-radius: 6px; background: #fafaf9; color: #1a1919; font: 500 10px/14px "DM Sans", ui-sans-serif, system-ui; }
    .sl-action-item--error strong { color: #991b1b; }
    .sl-action-item--warn strong { color: #92400e; }
    .sl-action-item--pass strong { color: #15803d; }
    .sl-action-item--unknown strong { color: #374151; }
    .sl-essentials-card { overflow: visible; }
    .sl-essentials-summary { padding: 8px 12px; border-bottom: 0.556px solid #e4ddcd; background: #f9fafb; }
    .sl-essentials-summary strong { color: #4b4338; font: 500 11px/16px "DM Sans", ui-sans-serif, system-ui; }
    .sl-essential-row { display: grid; grid-template-columns: minmax(98px, 0.55fr) minmax(0, 1fr); gap: 10px; align-items: start; padding: 9px 12px; border-top: 0.556px solid #e4ddcd; }
    .sl-essentials-summary + .sl-essential-row { border-top: 0; }
    .sl-essential-row > span { display: flex; align-items: center; gap: 6px; min-width: 0; color: #726a5a; font: 500 11px/16px "DM Sans", ui-sans-serif, system-ui; overflow-wrap: anywhere; }
    .sl-essential-row strong { display: block; color: #1a1919; font: 700 11px/16px "DM Sans", ui-sans-serif, system-ui; }
    .sl-essential-row p { margin-top: 2px; color: #726a5a; font: 400 11px/16px "DM Sans", ui-sans-serif, system-ui; overflow-wrap: anywhere; }
    .sl-essential-row button { margin-top: 6px; min-height: 22px; padding: 3px 7px; border: 1px solid #d8d0c0; border-radius: 6px; background: #fafaf9; color: #1a1919; font: 500 10px/14px "DM Sans", ui-sans-serif, system-ui; }
    .sl-essential-row--pass strong { color: #15803d; }
    .sl-essential-row--pass { padding-block: 7px; }
    .sl-essential-row--pass p { color: rgb(114 106 90 / 72%); font-size: 10px; line-height: 14px; }
    .sl-essential-row--warn strong { color: #ca8a04; }
    .sl-essential-row--error strong { color: #dc2626; }
    .sl-essential-row--info strong { color: #2563eb; }
    .sl-link-metrics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
    .sl-link-metric { display: grid; gap: 2px; min-width: 0; padding: 8px; border: 1px solid #e4ddcd; border-radius: 8px; background: #fafaf9; }
    .sl-link-metric span { color: #726a5a; font: 500 10px/15px "DM Sans", ui-sans-serif, system-ui; text-transform: uppercase; }
    .sl-link-metric strong { color: #1f2937; font: 700 16px/18px "DM Sans", ui-sans-serif, system-ui; }
    .sl-link-metric small { color: #726a5a; font: 400 9px/11px "DM Sans", ui-sans-serif, system-ui; overflow-wrap: anywhere; }
    .sl-link-metric--pass strong { color: #15803d; }
    .sl-link-metric--warn strong { color: #ca8a04; }
    .sl-link-metric--error strong { color: #b91c1c; }
    .sl-link-metric--unknown strong { color: #64748b; }
    .sl-link-table { border: 1px solid #e4ddcd; border-radius: 8px; background: #fafaf9; overflow: visible; }
    .sl-link-table__head, .sl-link-row { display: grid; grid-template-columns: minmax(0, 1fr) fit-content(112px); align-items: start; gap: 8px; }
    .sl-link-table__head { padding: 8px 12px; border-bottom: 0.556px solid #e4ddcd; background: #f9fafb; }
    .sl-link-table__head strong { color: #1a1919; font: 500 12px/18px "DM Sans", ui-sans-serif, system-ui; }
    .sl-link-table__head span, .sl-link-row span { color: #726a5a; font: 400 10px/15px "DM Sans", ui-sans-serif, system-ui; white-space: normal; overflow-wrap: anywhere; text-align: right; }
    .sl-link-row { padding: 8px 12px; border-top: 0.556px solid #e4ddcd; }
    .sl-link-table__head + .sl-link-row { border-top: 0; }
    .sl-link-row div { min-width: 0; }
    .sl-link-row p { width: fit-content; max-width: 100%; color: #1a1919; font: 400 12px/18px "DM Sans", ui-sans-serif, system-ui; overflow-wrap: anywhere; white-space: normal; }
    .sl-link-row small { display: block; width: fit-content; max-width: 100%; color: #726a5a; font: 400 10px/13px "DM Sans", ui-sans-serif, system-ui; overflow-wrap: anywhere; white-space: normal; }
    .sl-link-empty { padding: 12px; color: #726a5a; font: 400 12px/18px "DM Sans", ui-sans-serif, system-ui; }
    .sl-technical-score { display: flex; align-items: center; gap: 16px; padding: 12.556px; }
    .sl-technical-score .sl-score-dial__ring { width: 48px; height: 48px; }
    .sl-technical-score > div:last-child { display: grid; gap: 2px; min-width: 0; }
    .sl-technical-score > div:last-child span { color: #726a5a; font: 400 11px/16.5px "DM Sans", ui-sans-serif, system-ui; }
    .sl-technical-score > div:last-child strong { color: #1a1919; font: 700 22px/22px "DM Sans", ui-sans-serif, system-ui; letter-spacing: -0.55px; }
    .sl-technical-score > div:last-child p { color: #726a5a; font: 400 10px/14px "DM Sans", ui-sans-serif, system-ui; overflow-wrap: anywhere; }
    .sl-technical-block { display: grid; gap: 10px; width: 100%; }
    .sl-technical-block > h3 { color: #1a1919; font: 600 13px/19.5px "DM Sans", ui-sans-serif, system-ui; letter-spacing: -0.325px; }
    .sl-technical-table { overflow: visible; }
    .sl-technical-row { display: grid; grid-template-columns: minmax(0, 1fr) fit-content(220px); align-items: start; gap: 8px; padding: 8px 12px; border-top: 0.556px solid #e4ddcd; }
    .sl-technical-row:first-child { border-top: 0; }
    .sl-technical-row span { display: flex; align-items: center; gap: 8px; min-width: 0; color: #1a1919; font: 400 12px/18px "DM Sans", ui-sans-serif, system-ui; }
    .sl-technical-row strong { justify-self: end; width: fit-content; max-width: 220px; color: #726a5a; font: 400 11px/16.5px "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace; text-align: right; overflow-wrap: anywhere; white-space: normal; }
    .sl-technical-value { display: grid; justify-items: end; min-width: 0; }
    .sl-technical-value small { display: block; width: fit-content; max-width: 220px; color: rgb(114 106 90 / 78%); font: 400 9px/12px "DM Sans", ui-sans-serif, system-ui; text-align: right; overflow-wrap: anywhere; }
    .sl-technical-metrics { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
    .sl-relevance-card { display: grid; gap: 10px; padding: 12px; }
    .sl-relevance-row { display: grid; gap: 5px; }
    .sl-relevance-row div { display: flex; align-items: center; justify-content: space-between; gap: 12px; color: #1a1919; font: 400 12px/18px "DM Sans", ui-sans-serif, system-ui; }
    .sl-relevance-row strong { color: #15803d; font: 500 11px/16.5px "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace; }
    .sl-relevance-row--warn strong { color: #a16207; }
    .sl-relevance-row--error strong { color: #b91c1c; }
    .sl-relevance-row i { display: block; width: 100%; height: 6px; border-radius: 999px; background: linear-gradient(90deg, #4ade80 var(--sl-relevance), #f3eee4 var(--sl-relevance)); }
    .sl-relevance-row--warn i { background: linear-gradient(90deg, #facc15 var(--sl-relevance), #f3eee4 var(--sl-relevance)); }
    .sl-relevance-row--error i { background: linear-gradient(90deg, #ef4444 var(--sl-relevance), #f3eee4 var(--sl-relevance)); }
    .sl-health-table, .sl-issues-table { border: 1px solid #e4ddcd; border-radius: 8px; background: #fafaf9; overflow: visible; }
    .sl-health-row { display: grid; grid-template-columns: minmax(0, 1fr) fit-content(140px); align-items: start; gap: 8px; padding: 8px 12px; border-top: 0.556px solid #e4ddcd; }
    .sl-health-row:first-child { border-top: 0; }
    .sl-health-row--head { background: #f9fafb; color: #726a5a; font: 500 10px/15px "DM Sans", ui-sans-serif, system-ui; letter-spacing: 0.25px; text-transform: uppercase; }
    .sl-health-row span:first-child { display: flex; align-items: center; gap: 8px; min-width: 0; color: #1a1919; font: 400 12px/18px "DM Sans", ui-sans-serif, system-ui; }
    .sl-health-row--head span:first-child { color: #726a5a; font: inherit; }
    .sl-health-row span:last-child, .sl-health-row strong { justify-self: end; width: fit-content; max-width: 140px; text-align: right; overflow-wrap: anywhere; }
    .sl-health-row--pass { color: rgb(114 106 90 / 70%); }
    .sl-health-row--pass span:first-child { color: rgb(114 106 90 / 72%); }
    .sl-health-value { font: 500 11px/16.5px "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace; }
    .sl-health-value--warn { color: #a16207; }
    .sl-health-value--error { color: #b91c1c; white-space: normal; }
    .sl-health-value--pass { color: #15803d; }
    .sl-health-value--unknown { color: #64748b; white-space: normal; }
    .sl-issues-section { padding-top: 0.59px; }
    .sl-issues-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .sl-issues-count { display: inline-flex; align-items: center; gap: 4px; color: #ca8a04; font: 500 11px/16.5px "DM Sans", ui-sans-serif, system-ui; }
    .sl-issues-table__head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 12px 8.556px; border-bottom: 0.556px solid #e4ddcd; background: #f9fafb; }
    .sl-issues-table__head strong { color: #1a1919; font: 500 12px/18px "DM Sans", ui-sans-serif, system-ui; }
    .sl-issues-table__head span { color: #726a5a; font: 400 10px/15px "DM Sans", ui-sans-serif, system-ui; white-space: normal; text-align: right; overflow-wrap: anywhere; }
    .sl-issue-row { display: grid; grid-template-columns: minmax(0, 1fr) fit-content(168px); align-items: start; gap: 8px; padding: 8.556px 12px 8px; border-top: 0.556px solid #e4ddcd; background: #fafaf9; }
    .sl-issues-table__head + .sl-issue-row { border-top: 0; }
    .sl-issue-main { display: flex; align-items: center; gap: 8px; min-width: 0; }
    .sl-issue-main > div { min-width: 0; }
    .sl-issue-main p { width: fit-content; max-width: 100%; color: #1a1919; font: 400 12px/18px "DM Sans", ui-sans-serif, system-ui; overflow-wrap: anywhere; white-space: normal; }
    .sl-issue-main p span { display: inline-block; margin-right: 6px; color: #726a5a; font: 500 9px/12px "DM Sans", ui-sans-serif, system-ui; letter-spacing: 0.2px; text-transform: uppercase; }
    .sl-issue-main .sl-issue-fix { margin-top: 4px; color: #4b4338; }
    .sl-issue-main small { display: block; width: fit-content; max-width: 100%; color: #726a5a; font: 400 10px/13px "DM Sans", ui-sans-serif, system-ui; overflow-wrap: anywhere; white-space: normal; }
    .sl-issue-evidence { margin-top: 4px; color: #726a5a; font: 400 10px/14px "DM Sans", ui-sans-serif, system-ui; }
    .sl-issue-evidence summary { cursor: pointer; color: #4b4338; font-weight: 500; }
    .sl-issue-evidence dl { display: grid; gap: 3px; margin: 5px 0 0; padding: 6px; border: 1px solid rgb(216 208 192 / 70%); border-radius: 6px; background: #fffdf8; }
    .sl-issue-evidence div { display: grid; grid-template-columns: 78px minmax(0, 1fr); gap: 6px; }
    .sl-issue-evidence dt { color: #726a5a; font-weight: 500; }
    .sl-issue-evidence dd { margin: 0; color: #1a1919; overflow-wrap: anywhere; }
    .sl-issue-actions { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 6px; width: fit-content; max-width: 168px; }
    .sl-issue-actions span { color: #eab308; font: 500 10px/15px "DM Sans", ui-sans-serif, system-ui; white-space: normal; overflow-wrap: anywhere; }
    .sl-issue-row--error .sl-issue-actions span, .sl-issue-row--blocker .sl-issue-actions span { color: #ef4444; }
    .sl-issue-row--info .sl-issue-actions span { color: #3b82f6; }
    .sl-issue-actions button, .sl-issue-icon-action { border: 0; background: transparent; color: #726a5a; padding: 0; }
    .sl-issue-actions button { width: fit-content; max-width: 100%; min-height: 20px; padding: 2px 6px; border: 1px solid #d8d0c0; border-radius: 6px; background: #fafaf9; color: #1a1919; font: 500 10px/14px "DM Sans", ui-sans-serif, system-ui; white-space: normal; overflow-wrap: anywhere; }
    .sl-issue-actions .sl-issue-primary-action { border-color: #bfae8a; background: #fffdf8; color: #1a1919; font-weight: 600; }
    .sl-issue-icon-action { display: inline-grid; place-items: center; width: 14px; height: 14px; flex: 0 0 14px; cursor: pointer; clip-path: none; }
    .sl-issue-empty { padding: 12px; color: #726a5a; font: 400 12px/18px "DM Sans", ui-sans-serif, system-ui; }
    .sl-feed-icon { display: block; width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; flex: 0 0 14px; }
    .sl-feed-icon--info { color: #726a5a; }
    .sl-feed-icon--pass { color: #22c55e; }
    .sl-feed-icon--warn { color: #ca8a04; }
    .sl-feed-icon--error { color: #ef4444; }
    .sl-kicker { margin: 0; font-size: 11px; font-weight: 700; text-transform: uppercase; color: #4b5563; }
    h2, h3, p { margin: 0; }
    h2 { margin: 0; color: #726a5a; font: 400 12px/16px Sora, ui-sans-serif, system-ui; white-space: nowrap; }
    h3 { font-size: 13px; line-height: 19.5px; margin: 0; letter-spacing: -0.325px; }
    button, select { font: inherit; }
    button { border: 1px solid #d1d5db; border-radius: 6px; background: #fff; padding: 6px 8px; color: #111827; cursor: pointer; }
    .sl-tab { border: 0; background: transparent; padding: 0 8px; color: #726a5a; cursor: default; }
    .sl-tab--active { background: #fafaf9; color: #1a1919; }
    .sl-icon-button { display: inline-grid; place-items: center; width: 22px; height: 22px; padding: 4px; border: 0; border-radius: 6px; background: transparent; color: #726a5a; }
    .sl-icon-button svg { display: block; width: 14px; height: 14px; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; }
    .sl-language-button { grid-auto-flow: column; grid-auto-columns: max-content; align-items: center; gap: 4px; width: auto; min-width: 42px; padding-inline: 5px; }
    .sl-language-button__label { color: #726a5a; font: 500 10px/12px "DM Sans", ui-sans-serif, system-ui; letter-spacing: 0; }
    button:focus-visible, select:focus-visible, .sl-panel:focus-visible, .sl-card:focus-visible { outline: 3px solid #2563eb; outline-offset: 2px; }
    .sl-header-actions, .sl-card__actions, .sl-filters, .sl-card__head { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
    .sl-context { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
    .sl-summary { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; padding: 12.556px; border: 1px solid #e4ddcd; border-radius: 8px; background: #fafaf9; }
    .sl-summary--clean, .sl-summary--error, .sl-summary--filtered-empty { display: grid; grid-template-columns: 1fr; gap: 2px; color: #726a5a; }
    .sl-summary__pill { display: grid; gap: 2px; min-height: 52px; padding: 8px; border: 1px solid #e4ddcd; border-radius: 8px; background: #fafaf9; color: #726a5a; font-size: 10px; line-height: 15px; text-transform: uppercase; }
    .sl-summary__pill strong { color: #1a1919; font-size: 19px; line-height: 19px; letter-spacing: -0.475px; }
    .sl-summary__pill--blocker strong, .sl-summary__pill--error strong { color: #b91c1c; }
    .sl-summary__pill--warning strong { color: #ca8a04; }
    .sl-summary__pill--info strong { color: #15803d; }
    .sl-filters { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
    .sl-filters label { display: grid; gap: 4px; color: #726a5a; font-size: 10px; line-height: 15px; text-transform: uppercase; }
    .sl-filters select { width: 100%; min-width: 0; border: 1px solid #e4ddcd; border-radius: 6px; background: #fafaf9; color: #1a1919; padding: 5px 6px; font-size: 11px; }
    .sl-list { display: grid; gap: 8px; }
    .sl-limit-notice { padding: 8px 10px; border: 1px solid #e4ddcd; border-radius: 8px; background: #fafaf9; color: #a16207; overflow-wrap: anywhere; }
    .sl-card { display: grid; gap: 6px; padding: 12.556px; border: 1px solid #e4ddcd; border-left-width: 4px; border-radius: 8px; background: #fafaf9; }
    [dir="rtl"] .sl-card { border-left-width: 1px; border-right-width: 4px; }
    .sl-card--blocker { border-left-color: #991b1b; }
    .sl-card--error { border-left-color: #ef4444; }
    .sl-card--warning { border-left-color: #f59e0b; }
    .sl-card--info { border-left-color: #3b82f6; }
    .sl-card__head span, .sl-severity { display: inline-flex; align-items: center; min-height: 20px; border-radius: 999px; padding: 0 8px; background: #f3f4f6; font-size: 12px; }
    .sl-empty { display: grid; gap: 4px; padding: 16px; color: #4b5563; }
    .sl-empty strong { color: #111827; }
    .sl-action-status { margin: 12px 16px 0; padding: 8px 10px; border: 1px solid #bfdbfe; border-radius: 8px; background: #eff6ff; color: #1e40af; overflow-wrap: anywhere; }
    .sl-runtime-error { display: grid; gap: 4px; margin: 12px 16px 0; padding: 10px 12px; border: 1px solid #991b1b; border-radius: 8px; background: #fef2f2; color: #7f1d1d; overflow-wrap: anywhere; }
    pre { max-height: 160px; overflow: auto; padding: 8px; background: #f9fafb; border-radius: 6px; white-space: pre-wrap; overflow-wrap: anywhere; }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    @media (forced-colors: active) {
      .sl-badge, .sl-panel, .sl-card, button, select, .sl-runtime-error, .sl-action-status, .sl-limit-notice { border-color: CanvasText; box-shadow: none; }
      .sl-badge__status { forced-color-adjust: none; color: ButtonText; }
    }
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after { scroll-behavior: auto !important; transition-duration: 0.01ms !important; animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; }
    }
  </style>`;
}

function addManagedListener(
  target: EventTarget,
  type: string,
  listener: EventListener,
  cleanupCallbacks: Array<() => void>
): void {
  target.addEventListener(type, listener);
  cleanupCallbacks.push(() => target.removeEventListener(type, listener));
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
