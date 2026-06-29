import {
  startDashboardHostedBrowserEntry,
  type DashboardBrowserApp,
  type DashboardBrowserEntryOptions,
  type DashboardBrowserEntryWindowPort
} from "./index.js";

export type SearchLintDashboardBrowserGlobalScope = {
  window?: DashboardBrowserEntryWindowPort;
  __SEARCHLINT_DASHBOARD_APP__?: Promise<DashboardBrowserApp>;
  __SEARCHLINT_DASHBOARD_ENTRY_OPTIONS__?: Omit<
    SearchLintDashboardBrowserEntryOptions,
    "globalScope" | "window"
  >;
  __SEARCHLINT_DASHBOARD_ENTRY_ON_ERROR__?: (error: unknown) => void;
  __SEARCHLINT_DASHBOARD_DISABLE_AUTO_START__?: boolean;
};

export type SearchLintDashboardBrowserEntryOptions = Omit<
  DashboardBrowserEntryOptions,
  "window"
> & {
  window?: DashboardBrowserEntryWindowPort;
  globalScope?: SearchLintDashboardBrowserGlobalScope;
  exposePromise?: boolean;
};

export function startSearchLintDashboardBrowserEntry(
  options: SearchLintDashboardBrowserEntryOptions = {}
): Promise<DashboardBrowserApp> {
  const globalScope =
    options.globalScope ??
    (globalThis as unknown as SearchLintDashboardBrowserGlobalScope);
  const windowPort = options.window ?? globalScope.window;
  if (windowPort === undefined) {
    throw new Error(
      "SearchLint dashboard browser entry requires a window port."
    );
  }

  const appPromise = startDashboardHostedBrowserEntry({
    window: windowPort,
    ...(options.rootId === undefined ? {} : { rootId: options.rootId }),
    ...(options.configScriptId === undefined
      ? {}
      : { configScriptId: options.configScriptId }),
    ...(options.clock === undefined ? {} : { clock: options.clock }),
    ...(options.signal === undefined ? {} : { signal: options.signal })
  });

  if (options.exposePromise ?? true) {
    globalScope.__SEARCHLINT_DASHBOARD_APP__ = appPromise;
  }

  return appPromise;
}

export function startSearchLintDashboardBrowserEntryFromGlobal(
  globalScope: SearchLintDashboardBrowserGlobalScope = globalThis as unknown as SearchLintDashboardBrowserGlobalScope
): Promise<DashboardBrowserApp> {
  const configuredOptions =
    globalScope.__SEARCHLINT_DASHBOARD_ENTRY_OPTIONS__ ?? {};
  return startSearchLintDashboardBrowserEntry({
    ...configuredOptions,
    globalScope
  });
}
