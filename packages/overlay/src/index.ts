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

export type OverlayPosition =
  | "bottom-right"
  | "bottom-left"
  | "top-right"
  | "top-left";

export type OverlayDirection = "ltr" | "rtl";

export type OverlayRenderDiagnostic = Diagnostic & {
  explanation?: string;
  rawHtmlSnippet?: string;
  renderedDomSnippet?: string;
};

export type SearchLintOverlayState = {
  status: BadgeState;
  diagnostics: readonly OverlayRenderDiagnostic[];
  filters?: OverlayFilters;
  pageUrl?: string;
  route?: string;
  position?: OverlayPosition;
  direction?: OverlayDirection;
  runtimeError?: string;
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

const hostId = "searchlint-dev-overlay";
const panelId = "searchlint-panel";
const panelTitleId = "searchlint-panel-title";
const panelDescriptionId = "searchlint-panel-description";
const highlightedAttribute = "data-searchlint-highlighted";
const severityOrder: Record<Severity, number> = {
  info: 1,
  warning: 2,
  error: 3,
  blocker: 4
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

export function renderBadgeLabel(state: BadgeState, count: number): string {
  if (state === "checking") return "SearchLint checking";
  if (state === "clean") return "SearchLint clean";
  return `SearchLint ${state}: ${count}`;
}

export function renderOverlayHtml(state: SearchLintOverlayState): string {
  const diagnostics = filterDiagnostics(state.diagnostics, state.filters);
  const total = state.diagnostics.length;
  const badgeLabel = renderBadgeLabel(state.status, total);
  const position = state.position ?? "bottom-right";
  const direction = state.direction ?? "ltr";
  return `${renderStyles()}
<button class="sl-badge sl-badge--${state.status} sl-position--${position}" dir="${direction}" type="button" aria-haspopup="dialog" aria-controls="${panelId}" aria-expanded="false" data-action="toggle">
  <span class="sl-badge__dot" aria-hidden="true"></span>
  <span>${escapeHtml(badgeLabel)}</span>
  <span class="sl-badge__count" aria-label="${total} diagnostics" aria-live="polite" aria-atomic="true">${total}</span>
</button>
<section id="${panelId}" class="sl-panel sl-position--${position}" dir="${direction}" role="dialog" aria-modal="false" aria-labelledby="${panelTitleId}" aria-describedby="${panelDescriptionId}" hidden tabindex="-1">
  <header class="sl-panel__header">
    <div>
      <p class="sl-kicker">SearchLint</p>
      <h2 id="${panelTitleId}">SEO diagnostics</h2>
      <p id="${panelDescriptionId}" class="sl-context">${escapeHtml(state.pageUrl ?? "")}${state.route ? ` · ${escapeHtml(state.route)}` : ""}</p>
    </div>
    <div class="sl-header-actions">
      <button type="button" data-action="rerun">Rerun analysis</button>
      <button type="button" aria-label="Close SearchLint diagnostics" data-action="close">Close</button>
    </div>
  </header>
  ${state.runtimeError ? renderRuntimeError(state.runtimeError) : ""}
  ${renderFilters(state.filters)}
  <div class="sl-list" role="list" aria-label="Diagnostics">
    ${
      diagnostics.length === 0
        ? '<p class="sl-empty">No diagnostics match the current filters.</p>'
        : diagnostics.map(renderDiagnosticCard).join("")
    }
  </div>
</section>`;
}

export function createOverlayAccessibilityReport(
  state: SearchLintOverlayState
): OverlayAccessibilityReport {
  const html = renderOverlayHtml(state);
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
        html.includes("Rerun analysis") &&
        html.includes('aria-label="Close SearchLint diagnostics"') &&
        html.includes("Copy diagnostic") &&
        html.includes("Suppress"),
      message: "Primary overlay actions have accessible names."
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

export function createSearchLintOverlayRuntime(
  options: SearchLintOverlayRuntimeOptions
): SearchLintOverlayRuntime {
  const document = options.document;
  const host = document.createElement("searchlint-dev-overlay");
  host.id = hostId;
  host.setAttribute("data-searchlint", "overlay-host");
  const shadow = host.attachShadow({ mode: "open" });
  document.documentElement.append(host);

  let state: SearchLintOverlayState = {
    status: deriveBadgeState(options.initialDiagnostics ?? []),
    diagnostics: options.initialDiagnostics ?? [],
    pageUrl: document.location?.href,
    route: document.location?.pathname
  };
  let isOpen = false;
  let destroyed = false;
  let pendingMutationRerun = false;
  const cleanupCallbacks: Array<() => void> = [];

  function render(): void {
    shadow.innerHTML = renderOverlayHtml(state);
    const panel = shadow.querySelector<HTMLElement>(".sl-panel");
    const badge = shadow.querySelector<HTMLButtonElement>(".sl-badge");
    if (panel) {
      panel.hidden = !isOpen;
    }
    if (badge) {
      badge.setAttribute("aria-expanded", String(isOpen));
    }
  }

  function open(): void {
    isOpen = true;
    render();
    shadow.querySelector<HTMLElement>(".sl-panel")?.focus();
  }

  function close(): void {
    isOpen = false;
    render();
    shadow.querySelector<HTMLElement>(".sl-badge")?.focus();
  }

  function update(nextState: Partial<SearchLintOverlayState>): void {
    state = {
      ...state,
      ...nextState,
      diagnostics: nextState.diagnostics ?? state.diagnostics,
      status:
        nextState.status ??
        deriveBadgeState(nextState.diagnostics ?? state.diagnostics)
    };
    if (nextState.filters !== undefined) {
      state.filters = nextState.filters;
    }
    render();
  }

  function destroy(): void {
    if (destroyed) return;
    destroyed = true;
    cleanupCallbacks.splice(0).forEach((cleanup) => cleanup());
    clearHighlights(document);
    host.remove();
  }

  function rerun(): void {
    void options.onRerun?.();
  }

  shadow.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const action = target.closest<HTMLElement>("[data-action]")?.dataset.action;
    const fingerprint =
      target.closest<HTMLElement>("[data-fingerprint]")?.dataset.fingerprint;
    const diagnostic = fingerprint
      ? state.diagnostics.find((item) => item.fingerprint === fingerprint)
      : undefined;

    if (action === "toggle") isOpen ? close() : open();
    if (action === "close") close();
    if (action === "rerun") rerun();
    if (action === "copy" && diagnostic) void options.onCopy?.(diagnostic);
    if (action === "suppress" && diagnostic)
      void options.onSuppress?.(diagnostic);
    if (action === "highlight" && diagnostic?.sourceLocation?.selector) {
      highlightSelector(document, diagnostic.sourceLocation.selector);
    }
  });

  shadow.addEventListener("keydown", (event) => {
    const keyboardEvent = event as KeyboardEvent;
    if (keyboardEvent.key === "Escape") {
      close();
      event.preventDefault();
    }
    if (
      (keyboardEvent.key === "Enter" || keyboardEvent.key === " ") &&
      !isOpen
    ) {
      open();
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
      if (pendingMutationRerun) return;
      pendingMutationRerun = true;
      window.setTimeout(() => {
        pendingMutationRerun = false;
        rerun();
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

export function highlightSelector(
  document: Document,
  selector: string
): number {
  clearHighlights(document);
  const elements = [...document.querySelectorAll<HTMLElement>(selector)];
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
    ${renderSelect("severity", filters.severity ?? "all", ["all", "blocker", "error", "warning", "info"])}
    ${renderSelect("category", filters.category ?? "all", [
      "all",
      "http-rendering",
      "indexability",
      "title-metadata",
      "canonical-hreflang",
      "headings-structure",
      "images-social-preview",
      "schema-org",
      "links-site-graph",
      "robots-sitemaps",
      "performance",
      "unknown"
    ])}
    ${renderSelect("source", filters.source ?? "all", [
      "all",
      "source-code",
      "raw-html",
      "rendered-dom",
      "http-header",
      "robots-txt",
      "sitemap",
      "crawler",
      "google",
      "yandex"
    ])}
  </form>`;
}

function renderSelect(name: string, value: string, options: readonly string[]) {
  return `<label>${escapeHtml(name)}
    <select name="${escapeHtml(name)}" aria-label="Filter by ${escapeHtml(name)}">
      ${options
        .map(
          (option) =>
            `<option value="${escapeHtml(option)}"${option === value ? " selected" : ""}>${escapeHtml(option)}</option>`
        )
        .join("")}
    </select>
  </label>`;
}

function renderRuntimeError(message: string): string {
  return `<div class="sl-runtime-error" role="alert">
    <strong>SearchLint overlay error</strong>
    <span>${escapeHtml(message)}</span>
  </div>`;
}

function renderDiagnosticCard(diagnostic: OverlayRenderDiagnostic): string {
  const location = diagnostic.sourceLocation;
  const exactLocation =
    location?.confidence === "EXACT" && location.file
      ? `<p><strong>File</strong> ${escapeHtml(location.file)}${location.line ? `:${location.line}` : ""}</p>`
      : "";
  const selector =
    location?.selector !== undefined
      ? `<p><strong>Selector</strong> <code>${escapeHtml(location.selector)}</code> <button type="button" data-action="highlight">Highlight</button></p>`
      : "";
  return `<article class="sl-card sl-card--${diagnostic.severity}" role="listitem" tabindex="0" data-fingerprint="${escapeHtml(diagnostic.fingerprint)}">
    <div class="sl-card__head">
      <span class="sl-severity">${escapeHtml(diagnostic.severity)}</span>
      <span>${escapeHtml(categoryForRuleId(diagnostic.ruleId))}</span>
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
    <p><strong>Source type</strong> ${escapeHtml(diagnostic.source)}</p>
    ${exactLocation}
    ${selector}
    ${diagnostic.rawHtmlSnippet ? `<details><summary>Raw HTML</summary><pre>${escapeHtml(diagnostic.rawHtmlSnippet)}</pre></details>` : ""}
    ${diagnostic.renderedDomSnippet ? `<details><summary>Rendered DOM</summary><pre>${escapeHtml(diagnostic.renderedDomSnippet)}</pre></details>` : ""}
    <div class="sl-card__actions">
      <button type="button" data-action="copy">Copy diagnostic</button>
      <button type="button" data-action="suppress">Suppress</button>
    </div>
  </article>`;
}

function renderStyles(): string {
  return `<style>
    :host { all: initial; color-scheme: light; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    * { box-sizing: border-box; }
    .sl-badge { position: fixed; z-index: 2147483647; display: inline-flex; align-items: center; gap: 8px; min-height: 36px; max-width: min(420px, calc(100vw - 32px)); padding: 0 10px; border: 1px solid #d1d5db; border-radius: 8px; background: #fff; color: #111827; box-shadow: 0 8px 28px rgb(15 23 42 / 18%); font: 600 13px/1 ui-sans-serif, system-ui; cursor: pointer; overflow-wrap: anywhere; }
    .sl-badge.sl-position--bottom-right { right: 16px; bottom: 16px; }
    .sl-badge.sl-position--bottom-left { left: 16px; bottom: 16px; }
    .sl-badge.sl-position--top-right { right: 16px; top: 16px; }
    .sl-badge.sl-position--top-left { left: 16px; top: 16px; }
    .sl-badge__dot { width: 8px; height: 8px; border-radius: 999px; background: #10b981; }
    .sl-badge--checking .sl-badge__dot { background: #64748b; }
    .sl-badge--info .sl-badge__dot { background: #3b82f6; }
    .sl-badge--warnings .sl-badge__dot { background: #f59e0b; }
    .sl-badge--errors .sl-badge__dot { background: #ef4444; }
    .sl-badge--blocked .sl-badge__dot { background: #991b1b; }
    .sl-badge__count { min-width: 20px; height: 20px; display: inline-grid; place-items: center; border-radius: 999px; background: #f3f4f6; }
    .sl-panel { position: fixed; z-index: 2147483647; width: min(760px, calc(100vw - 32px)); max-height: min(760px, calc(100vh - 90px)); overflow: auto; border: 1px solid #d1d5db; border-radius: 8px; background: #fff; color: #111827; box-shadow: 0 18px 60px rgb(15 23 42 / 24%); font: 13px/1.45 ui-sans-serif, system-ui; overflow-wrap: anywhere; }
    .sl-panel.sl-position--bottom-right { right: 16px; bottom: 60px; }
    .sl-panel.sl-position--bottom-left { left: 16px; bottom: 60px; }
    .sl-panel.sl-position--top-right { right: 16px; top: 60px; }
    .sl-panel.sl-position--top-left { left: 16px; top: 60px; }
    .sl-panel__header { position: sticky; top: 0; display: flex; justify-content: space-between; gap: 16px; padding: 16px; border-bottom: 1px solid #e5e7eb; background: #fff; }
    .sl-kicker { margin: 0; font-size: 11px; font-weight: 700; text-transform: uppercase; color: #4b5563; }
    h2, h3, p { margin: 0; }
    h2 { font-size: 18px; line-height: 1.2; }
    h3 { font-size: 15px; line-height: 1.25; margin: 8px 0; }
    button, select { font: inherit; }
    button { border: 1px solid #d1d5db; border-radius: 6px; background: #fff; padding: 6px 8px; color: #111827; cursor: pointer; }
    button:focus-visible, select:focus-visible, .sl-panel:focus-visible, .sl-card:focus-visible { outline: 3px solid #2563eb; outline-offset: 2px; }
    .sl-header-actions, .sl-card__actions, .sl-filters, .sl-card__head { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
    .sl-context { color: #4b5563; margin-top: 4px; overflow-wrap: anywhere; }
    .sl-filters { padding: 12px 16px; border-bottom: 1px solid #e5e7eb; }
    .sl-filters label { display: grid; gap: 4px; color: #4b5563; font-size: 12px; }
    .sl-list { display: grid; gap: 10px; padding: 12px; }
    .sl-card { display: grid; gap: 6px; padding: 12px; border: 1px solid #e5e7eb; border-left-width: 4px; border-radius: 8px; background: #fff; }
    [dir="rtl"] .sl-card { border-left-width: 1px; border-right-width: 4px; }
    .sl-card--blocker { border-left-color: #991b1b; }
    .sl-card--error { border-left-color: #ef4444; }
    .sl-card--warning { border-left-color: #f59e0b; }
    .sl-card--info { border-left-color: #3b82f6; }
    .sl-card__head span, .sl-severity { display: inline-flex; align-items: center; min-height: 20px; border-radius: 999px; padding: 0 8px; background: #f3f4f6; font-size: 12px; }
    .sl-empty { padding: 16px; color: #4b5563; }
    .sl-runtime-error { display: grid; gap: 4px; margin: 12px 16px 0; padding: 10px 12px; border: 1px solid #991b1b; border-radius: 8px; background: #fef2f2; color: #7f1d1d; overflow-wrap: anywhere; }
    pre { max-height: 160px; overflow: auto; padding: 8px; background: #f9fafb; border-radius: 6px; white-space: pre-wrap; overflow-wrap: anywhere; }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    @media (forced-colors: active) {
      .sl-badge, .sl-panel, .sl-card, button, select, .sl-runtime-error { border-color: CanvasText; box-shadow: none; }
      .sl-badge__dot { forced-color-adjust: none; background: Highlight; }
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
