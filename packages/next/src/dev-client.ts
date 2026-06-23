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
  type SearchLintOverlayRuntime
} from "@searchlint/overlay";

declare const __SEARCHLINT_RULE_CATALOG__: string | undefined;

declare global {
  interface Window {
    __SEARCHLINT_DEV_OVERLAY__?: SearchLintOverlayRuntime;
  }
}

export type SearchLintDevClientOptions = {
  document: Document;
  catalogText: string;
  now?: () => string;
};

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
  if (!catalogText) {
    throw new Error(
      "SearchLint dev client requires the real RULE_CATALOG.yaml injected by @searchlint/next."
    );
  }

  const runtime = createSearchLintOverlayRuntime({
    document: options.document ?? document,
    initialDiagnostics: [],
    onRerun: () => rerun(runtime, options.document ?? document, catalogText)
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
  void rerun(runtime, options.document ?? document, catalogText);
  return managedRuntime;
}

async function rerun(
  runtime: SearchLintOverlayRuntime,
  document: Document,
  catalogText: string
): Promise<void> {
  runtime.update({ status: "checking" });
  const diagnostics = await analyzeCurrentDocument({ document, catalogText });
  runtime.update({
    status: deriveBadgeState(diagnostics),
    diagnostics,
    pageUrl: document.location.href,
    route: document.location.pathname
  });
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
