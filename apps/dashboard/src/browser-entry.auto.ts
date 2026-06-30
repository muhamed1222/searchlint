import {
  startSearchLintDashboardBrowserEntryFromGlobal,
  type SearchLintDashboardBrowserGlobalScope
} from "./browser-entry.js";

const searchLintDashboardGlobal =
  globalThis as unknown as SearchLintDashboardBrowserGlobalScope;

if (!searchLintDashboardGlobal.__SEARCHLINT_DASHBOARD_DISABLE_AUTO_START__) {
  const appPromise = startSearchLintDashboardBrowserEntryFromGlobal(
    searchLintDashboardGlobal
  );
  void appPromise.catch((error: unknown) => {
    if (
      typeof searchLintDashboardGlobal.__SEARCHLINT_DASHBOARD_ENTRY_ON_ERROR__ ===
      "function"
    ) {
      searchLintDashboardGlobal.__SEARCHLINT_DASHBOARD_ENTRY_ON_ERROR__(error);
      return;
    }

    console.error("SearchLint dashboard browser entry failed.", error);
  });
}

export {};
