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
const dragClickThresholdPx = 6;
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

function renderBadgeVisibleText(state: BadgeState, count: number): string {
  if (state === "checking") return "checking";
  if (count === 0 || state === "clean") return "";
  if (state === "blocked") return `${count} blockers`;
  if (state === "warnings") return `${count} warnings`;
  if (state === "info") return `${count} notes`;
  return `${count} errors`;
}

export function nearestOverlayPosition(
  viewportWidth: number,
  viewportHeight: number,
  clientX: number,
  clientY: number
): OverlayPosition {
  const horizontal = clientX < viewportWidth / 2 ? "left" : "right";
  const vertical = clientY < viewportHeight / 2 ? "top" : "bottom";
  return `${vertical}-${horizontal}` as OverlayPosition;
}

export function renderOverlayHtml(state: SearchLintOverlayState): string {
  const diagnostics = filterDiagnostics(state.diagnostics, state.filters);
  const total = state.diagnostics.length;
  const badgeLabel = renderBadgeLabel(state.status, total);
  const badgeVisibleText = renderBadgeVisibleText(state.status, total);
  const position = state.position ?? "bottom-right";
  const direction = state.direction ?? "ltr";
  return `${renderStyles()}
<button class="sl-badge sl-badge--${state.status}${badgeVisibleText ? " sl-badge--expanded" : ""} sl-position--${position}" dir="${direction}" type="button" aria-label="${escapeHtml(badgeLabel)}" aria-haspopup="dialog" aria-controls="${panelId}" aria-expanded="false" data-action="toggle">
  <span class="sl-badge__logo" aria-hidden="true">${renderSearchLintLogo()}</span>
  <span class="sl-badge__label">${escapeHtml(badgeLabel)}</span>
  <span class="sl-badge__status" aria-hidden="${badgeVisibleText ? "false" : "true"}" aria-live="polite" aria-atomic="true">${escapeHtml(badgeVisibleText)}</span>
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

function renderSearchLintLogo(): string {
  return `<svg viewBox="0 0 150 150" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
<rect width="150" height="150" fill="#151515"/>
<path d="M110.302 92.1471C113.502 88.7471 117.702 82.2471 117.702 75.4471C117.702 68.6471 113.202 62.547 110.202 59.047C108.202 56.747 107.502 54.847 109.702 52.247C112.402 49.647 117.502 44.647 117.702 40.547C117.802 37.747 116.302 33.347 106.302 33.047C97.002 32.747 90.902 33.8471 76.802 37.3471C75.602 37.6471 74.302 37.6471 73.502 37.4471C63.002 35.1471 56.602 33.347 48.802 33.047C40.902 32.847 33.702 33.3471 33.502 39.4471C33.502 43.4471 37.402 47.447 40.802 51.147C42.802 53.047 43.402 55.047 41.302 57.547C39.002 60.247 33.302 65.8471 33.002 74.0471C32.902 81.8471 36.602 87.4471 40.202 91.5471C42.402 93.9471 42.602 96.2471 40.202 98.5471C37.602 101.147 32.902 105.847 33.102 109.847C33.302 114.147 37.702 116.747 46.502 116.747C56.102 116.747 65.102 114.547 73.502 112.647C75.302 112.247 76.102 112.347 77.402 112.647L87.502 114.847C92.202 115.847 98.102 116.847 104.902 116.847C113.202 116.847 117.702 114.547 117.702 109.947C117.702 106.247 114.202 102.147 110.902 98.747C108.902 96.947 108.402 94.1471 110.302 92.1471ZM104.302 36.147C108.102 36.147 112.202 36.4471 113.102 39.3471C114.102 42.2471 110.402 46.4471 107.602 48.9471C104.902 51.6471 102.802 52.447 99.702 50.547C96.402 48.447 92.202 46.047 87.902 44.147C84.502 42.647 84.502 41.5471 84.702 40.4471C84.902 38.9471 88.102 38.2471 90.402 37.8471C94.002 37.1471 99.502 36.147 104.302 36.147ZM37.802 39.247C38.902 36.747 42.302 36.147 47.202 36.147C51.202 36.147 56.002 36.847 60.302 37.647C62.402 38.047 66.002 38.6471 65.402 40.9471C64.902 42.8471 60.902 43.947 57.102 46.047C55.002 47.047 52.802 48.3471 51.102 49.4471C48.902 50.9471 46.202 52.1471 43.902 49.9471C41.0495 47.6066 36.5426 42.1093 37.802 39.247ZM43.202 89.6471C40.702 87.0471 36.602 81.7471 36.602 75.4471C36.602 69.2471 39.902 64.947 42.702 61.547C44.602 59.347 45.902 57.847 48.302 57.847C49.902 57.847 51.102 58.647 51.902 59.247C57.102 63.047 63.102 66.9471 68.402 70.4471C70.302 71.7471 70.702 72.6471 70.502 73.9471C70.302 75.8471 68.502 76.7471 67.102 77.7471C61.502 81.4471 56.302 84.8471 50.302 89.2471C49.102 90.1471 48.102 90.9471 46.702 91.1471C45.202 91.3471 44.102 90.7471 43.202 89.6471ZM61.102 111.747C57.202 112.547 51.702 113.347 45.702 113.247C41.702 113.247 37.202 112.847 37.102 109.247C37.002 106.847 39.702 103.847 42.702 101.047C45.402 98.6471 47.002 98.147 50.202 99.647C52.102 100.847 56.402 103.447 60.902 105.447C63.602 106.647 66.002 107.747 65.202 109.647C64.702 110.747 62.502 111.447 61.102 111.747ZM76.902 107.247C75.002 107.647 74.302 107.447 72.502 106.947C67.802 105.647 63.202 103.647 57.402 100.547C54.002 98.6471 52.202 97.6471 51.702 96.6471C51.202 95.5471 51.002 94.2471 52.102 93.0471C53.802 91.1471 64.302 84.5471 71.902 79.7471C74.902 77.7471 77.202 76.8471 80.202 78.6471C81.702 79.4471 93.302 87.2471 97.302 90.1471C99.902 92.1471 100.202 92.847 100.002 94.447C99.702 96.347 97.202 97.647 94.002 99.347C91.6343 100.552 79.3027 106.742 76.902 107.247ZM75.8027 71.4473C74.3027 71.4473 72.702 70.647 71.502 69.847L59.702 61.747C55.702 59.047 53.002 57.4471 52.302 56.1471C51.702 54.9471 51.602 53.147 53.702 51.847C56.302 50.047 63.702 46.447 68.502 44.647L72.402 43.4471C73.402 43.1471 74.302 42.9471 75.002 42.9471C76.002 42.8471 77.802 43.247 80.202 44.047C84.302 45.347 89.002 47.547 92.102 49.247C97.202 51.947 98.902 52.847 99.202 54.247C99.902 56.647 97.702 57.947 95.302 59.747C89.902 63.547 81.102 69.1471 79.302 70.1471C78.5193 70.7163 77.3027 71.4473 75.8027 71.4473ZM107.402 89.347C105.902 90.947 103.502 92.147 100.902 90.347C96.702 87.247 89.902 82.5471 84.702 79.1471C82.702 77.7471 81.402 76.6471 81.402 74.9471C81.402 73.1471 83.402 72.0471 84.502 71.2471L99.402 61.1471C101.702 59.4471 102.502 58.247 104.802 58.247C106.602 58.247 107.702 59.247 109.002 60.747C110.402 62.347 114.702 67.747 114.702 74.847C114.702 81.147 109.902 87.047 107.402 89.347ZM107.303 99.9473C108.903 101.347 112.702 105.147 113.402 107.847C114.002 110.347 112.202 112.747 107.702 113.147C102.502 113.647 97.802 113.147 94.702 112.747C90.002 111.947 85.502 111.647 85.102 109.847C84.502 107.447 87.902 106.647 91.302 105.047C94.302 103.647 96.702 102.247 100.002 100.147C101.402 99.247 102.502 98.647 103.802 98.647C105.302 98.547 106.303 98.9473 107.303 99.9473Z" fill="url(#sl-logo-gradient)"/>
<defs><linearGradient id="sl-logo-gradient" x1="118" y1="75" x2="33" y2="75" gradientUnits="userSpaceOnUse"><stop stop-color="#E8E8E8"/><stop offset="1" stop-color="#575757"/></linearGradient></defs>
</svg>`;
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
  let suppressNextToggleClick = false;
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

  function viewportSize(): { width: number; height: number } {
    const view = document.defaultView;
    return {
      width: view?.innerWidth ?? document.documentElement.clientWidth,
      height: view?.innerHeight ?? document.documentElement.clientHeight
    };
  }

  function startBadgeDrag(event: PointerEvent): void {
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
    badge?.setPointerCapture?.(event.pointerId);
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
    const badge = shadow.querySelector<HTMLElement>(".sl-badge");
    if (badge) {
      badge.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
    }
  }

  function finishBadgeDrag(event: PointerEvent): void {
    if (dragState === undefined || event.pointerId !== dragState.pointerId) {
      return;
    }
    const finishedDrag = dragState;
    dragState = undefined;
    shadow
      .querySelector<HTMLElement>(".sl-badge")
      ?.releasePointerCapture?.(event.pointerId);
    if (!finishedDrag.moved) {
      return;
    }

    const viewport = viewportSize();
    state = {
      ...state,
      position: nearestOverlayPosition(
        viewport.width,
        viewport.height,
        finishedDrag.currentX,
        finishedDrag.currentY
      )
    };
    suppressNextToggleClick = true;
    render();
  }

  shadow.addEventListener("pointerdown", (event) => {
    startBadgeDrag(event as PointerEvent);
  });

  shadow.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const action = target.closest<HTMLElement>("[data-action]")?.dataset.action;
    const fingerprint =
      target.closest<HTMLElement>("[data-fingerprint]")?.dataset.fingerprint;
    const diagnostic = fingerprint
      ? state.diagnostics.find((item) => item.fingerprint === fingerprint)
      : undefined;

    if (action === "toggle") {
      if (suppressNextToggleClick) {
        suppressNextToggleClick = false;
        event.preventDefault();
        return;
      }
      isOpen ? close() : open();
    }
    if (action === "close") close();
    if (action === "rerun") rerun();
    if (action === "copy" && diagnostic) void options.onCopy?.(diagnostic);
    if (action === "suppress" && diagnostic)
      void options.onSuppress?.(diagnostic);
    if (action === "highlight" && diagnostic?.sourceLocation?.selector) {
      highlightSelector(document, diagnostic.sourceLocation.selector);
    }
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
    ((event: PointerEvent) => finishBadgeDrag(event)) as EventListener,
    cleanupCallbacks
  );

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
    .sl-badge { position: fixed; z-index: 2147483647; display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; padding: 0; border: 2px solid #E8E8E8; border-radius: 999px; background: #0f172a; color: #E8E8E8; box-shadow: 0 10px 26px rgb(15 23 42 / 22%), inset 0 0 0 1px rgb(255 255 255 / 10%); font: 700 12px/1 ui-sans-serif, system-ui; cursor: grab; overflow: visible; touch-action: none; user-select: none; white-space: nowrap; }
    .sl-badge--expanded { width: auto; min-width: 36px; gap: 0; padding: 0 10px 0 3px; }
    .sl-badge:active { cursor: grabbing; }
    .sl-badge.sl-position--bottom-right { right: 16px; bottom: 16px; }
    .sl-badge.sl-position--bottom-left { left: 16px; bottom: 16px; }
    .sl-badge.sl-position--top-right { right: 16px; top: 16px; }
    .sl-badge.sl-position--top-left { left: 16px; top: 16px; }
    .sl-badge--clean, .sl-badge--checking, .sl-badge--info, .sl-badge--warnings, .sl-badge--errors, .sl-badge--blocked { border-color: #E8E8E8; }
    .sl-badge__logo { display: block; width: 28px; height: 28px; border-radius: 999px; overflow: hidden; background: #151515; }
    .sl-badge__logo svg { display: block; width: 100%; height: 100%; }
    .sl-badge__label { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
    .sl-badge__status { display: none; color: #E8E8E8; font-weight: 400; letter-spacing: 0; }
    .sl-badge--expanded .sl-badge__status { display: inline; }
    .sl-panel { position: fixed; z-index: 2147483647; width: min(760px, calc(100vw - 32px)); max-height: min(760px, calc(100vh - 90px)); overflow: auto; border: 1px solid #d1d5db; border-radius: 8px; background: #fff; color: #111827; box-shadow: 0 18px 60px rgb(15 23 42 / 24%); font: 13px/1.45 ui-sans-serif, system-ui; overflow-wrap: anywhere; }
    .sl-panel.sl-position--bottom-right { right: 16px; bottom: 64px; }
    .sl-panel.sl-position--bottom-left { left: 16px; bottom: 64px; }
    .sl-panel.sl-position--top-right { right: 16px; top: 64px; }
    .sl-panel.sl-position--top-left { left: 16px; top: 64px; }
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
