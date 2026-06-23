import type { PageSnapshot } from "@searchlint/core";

export type BrowserElementLike = {
  outerHTML?: string | null;
};

export type BrowserDocumentLike = {
  documentElement?: BrowserElementLike | null;
};

export type BrowserSnapshotInput = {
  document: BrowserDocumentLike;
  url: string;
  capturedAt: string;
  route?: string;
  rawHtml?: string;
};

export function createBrowserRenderedDomSnapshot(
  input: BrowserSnapshotInput
): PageSnapshot {
  const snapshot: PageSnapshot = {
    pageUrl: input.url,
    route: input.route ?? routeFromUrl(input.url),
    capturedAt: input.capturedAt,
    renderedDom: renderedDomFromDocument(input.document)
  };

  if (input.rawHtml !== undefined) {
    snapshot.rawHtml = input.rawHtml;
  }

  return snapshot;
}

function renderedDomFromDocument(document: BrowserDocumentLike): string {
  return document.documentElement?.outerHTML ?? "";
}

function routeFromUrl(url: string): string {
  const match = url.match(/^[a-z][a-z0-9+.-]*:\/\/[^/?#]+([^?#]*)/i);
  if (!match) {
    return "/";
  }

  const pathname = match[1] || "/";
  return pathname.length === 0 ? "/" : pathname;
}
