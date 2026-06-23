import type { PageSnapshot } from "@searchlint/core";

export type HtmlSnapshotInput = {
  pageUrl: string;
  capturedAt: string;
  route?: string;
  rawHtml?: string;
  renderedDom?: string;
};

export type HtmlAttribute = {
  name: string;
  value: string;
};

export type HtmlElementSummary = {
  tagName: string;
  attributes: readonly HtmlAttribute[];
  text?: string;
};

export type HtmlDocumentSummary = {
  htmlLength: number;
  headCount: number;
  bodyCount: number;
  documentLang?: string;
  titles: readonly string[];
  meta: readonly HtmlElementSummary[];
  links: readonly HtmlElementSummary[];
  headings: readonly HtmlElementSummary[];
  images: readonly HtmlElementSummary[];
  jsonLdScripts: readonly string[];
};

export type HtmlSnapshotFragment = Pick<
  PageSnapshot,
  "pageUrl" | "capturedAt" | "route" | "rawHtml" | "renderedDom"
>;

const TAG_PATTERN_FLAGS = "gis";

export function createHtmlSnapshotFragment(
  input: HtmlSnapshotInput
): HtmlSnapshotFragment {
  const snapshot: HtmlSnapshotFragment = {
    pageUrl: input.pageUrl,
    capturedAt: input.capturedAt
  };

  if (input.route !== undefined) {
    snapshot.route = input.route;
  }

  if (input.rawHtml !== undefined) {
    snapshot.rawHtml = input.rawHtml;
  }

  if (input.renderedDom !== undefined) {
    snapshot.renderedDom = input.renderedDom;
  }

  return snapshot;
}

export function summarizeHtmlDocument(html: string): HtmlDocumentSummary {
  const summary: HtmlDocumentSummary = {
    htmlLength: html.length,
    headCount: countTag(html, "head"),
    bodyCount: countTag(html, "body"),
    titles: extractTextElements(html, "title"),
    meta: extractVoidElements(html, "meta"),
    links: extractVoidElements(html, "link"),
    headings: extractHeadingElements(html),
    images: extractVoidElements(html, "img"),
    jsonLdScripts: extractJsonLdScripts(html)
  };

  const documentLang = getDocumentLang(html);
  if (documentLang !== undefined) {
    return { ...summary, documentLang };
  }

  return summary;
}

export function getAttribute(
  element: HtmlElementSummary,
  name: string
): string | undefined {
  const normalizedName = name.toLowerCase();
  return element.attributes.find(
    (attribute) => attribute.name === normalizedName
  )?.value;
}

function countTag(html: string, tagName: string): number {
  const pattern = new RegExp(`<\\s*${tagName}(?:\\s|>|/)`, "gi");
  return [...html.matchAll(pattern)].length;
}

function getDocumentLang(html: string): string | undefined {
  const htmlTag = /<\s*html\b([^>]*)>/i.exec(html);
  if (!htmlTag) {
    return undefined;
  }

  return parseAttributes(htmlTag[1] ?? "").find(
    (attribute) => attribute.name === "lang"
  )?.value;
}

function extractTextElements(html: string, tagName: string): readonly string[] {
  const pattern = new RegExp(
    `<\\s*${tagName}\\b[^>]*>([\\s\\S]*?)<\\s*/\\s*${tagName}\\s*>`,
    TAG_PATTERN_FLAGS
  );

  return [...html.matchAll(pattern)].map((match) =>
    decodeBasicEntities(stripTags(match[1] ?? "")).trim()
  );
}

function extractVoidElements(
  html: string,
  tagName: string
): readonly HtmlElementSummary[] {
  const pattern = new RegExp(`<\\s*${tagName}\\b([^>]*)>`, TAG_PATTERN_FLAGS);

  return [...html.matchAll(pattern)].map((match) => ({
    tagName,
    attributes: parseAttributes(match[1] ?? "")
  }));
}

function extractHeadingElements(html: string): readonly HtmlElementSummary[] {
  const pattern = /<\s*(h[1-6])\b([^>]*)>([\s\S]*?)<\s*\/\s*\1\s*>/gis;

  return [...html.matchAll(pattern)].map((match) => ({
    tagName: (match[1] ?? "").toLowerCase(),
    attributes: parseAttributes(match[2] ?? ""),
    text: decodeBasicEntities(stripTags(match[3] ?? "")).trim()
  }));
}

function extractJsonLdScripts(html: string): readonly string[] {
  const pattern = /<\s*script\b([^>]*)>([\s\S]*?)<\s*\/\s*script\s*>/gis;

  return [...html.matchAll(pattern)]
    .filter((match) => {
      const attributes = parseAttributes(match[1] ?? "");
      return attributes.some(
        (attribute) =>
          attribute.name === "type" &&
          attribute.value.toLowerCase() === "application/ld+json"
      );
    })
    .map((match) => (match[2] ?? "").trim());
}

function parseAttributes(source: string): readonly HtmlAttribute[] {
  const attributes: HtmlAttribute[] = [];
  const pattern =
    /([^\s"'=<>`]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

  for (const match of source.matchAll(pattern)) {
    const rawName = match[1];
    if (!rawName) {
      continue;
    }

    attributes.push({
      name: rawName.toLowerCase(),
      value: decodeBasicEntities(match[2] ?? match[3] ?? match[4] ?? "")
    });
  }

  return attributes;
}

function stripTags(source: string): string {
  return source.replace(/<[^>]*>/g, "");
}

function decodeBasicEntities(source: string): string {
  return source
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}
