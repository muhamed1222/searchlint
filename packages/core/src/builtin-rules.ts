import {
  createCatalogBackedRule,
  type RuleCatalogRegistry
} from "./catalog.js";
import { sourceRouteApplies } from "./routes.js";
import type {
  DiagnosticSource,
  GoogleWebVitalMetric,
  Rule,
  RuleContext,
  RuleReport,
  ResolvedUrlSnapshot,
  SourceCodeFinding,
  SourceMetadataField,
  SourceLocation,
  SourceRouteMetadataSummary
} from "./types.js";

const implementedRuleIds = [
  "SL-HTTP-001",
  "SL-HTTP-002",
  "SL-HTTP-003",
  "SL-HTTP-004",
  "SL-HTTP-005",
  "SL-HTTP-006",
  "SL-HTTP-007",
  "SL-HTTP-008",
  "SL-HTTP-009",
  "SL-HTTP-010",
  "SL-HTTP-011",
  "SL-HTTP-012",
  "SL-INDEX-001",
  "SL-INDEX-002",
  "SL-INDEX-003",
  "SL-INDEX-004",
  "SL-INDEX-005",
  "SL-INDEX-006",
  "SL-INDEX-007",
  "SL-INDEX-008",
  "SL-INDEX-009",
  "SL-INDEX-010",
  "SL-INDEX-011",
  "SL-INDEX-012",
  "SL-INDEX-013",
  "SL-INDEX-014"
] as const;

const implementedTitleMetadataRuleIds = [
  "SL-META-001",
  "SL-META-002",
  "SL-META-003",
  "SL-META-004",
  "SL-META-005",
  "SL-META-006",
  "SL-META-007",
  "SL-META-008",
  "SL-META-009",
  "SL-META-010",
  "SL-META-011",
  "SL-META-012",
  "SL-META-013",
  "SL-META-014",
  "SL-META-015",
  "SL-META-016",
  "SL-META-017",
  "SL-META-018"
] as const;

const implementedCanonicalHreflangRuleIds = [
  "SL-CANON-001",
  "SL-CANON-002",
  "SL-CANON-003",
  "SL-CANON-004",
  "SL-CANON-005",
  "SL-CANON-006",
  "SL-CANON-007",
  "SL-CANON-008",
  "SL-CANON-009",
  "SL-CANON-010",
  "SL-CANON-011",
  "SL-CANON-012",
  "SL-CANON-013",
  "SL-CANON-014",
  "SL-CANON-015",
  "SL-CANON-016"
] as const;

const implementedStructuralMediaSchemaLinkRuleIds = [
  "SL-HEAD-001",
  "SL-HEAD-002",
  "SL-HEAD-003",
  "SL-HEAD-004",
  "SL-HEAD-005",
  "SL-HEAD-006",
  "SL-HEAD-007",
  "SL-HEAD-008",
  "SL-IMG-001",
  "SL-IMG-002",
  "SL-IMG-003",
  "SL-IMG-004",
  "SL-IMG-005",
  "SL-IMG-006",
  "SL-IMG-007",
  "SL-IMG-008",
  "SL-IMG-009",
  "SL-IMG-010",
  "SL-IMG-011",
  "SL-IMG-012",
  "SL-SCHEMA-001",
  "SL-SCHEMA-002",
  "SL-SCHEMA-003",
  "SL-SCHEMA-004",
  "SL-SCHEMA-005",
  "SL-SCHEMA-006",
  "SL-SCHEMA-007",
  "SL-SCHEMA-008",
  "SL-SCHEMA-009",
  "SL-SCHEMA-010",
  "SL-LINK-001",
  "SL-LINK-002",
  "SL-LINK-003",
  "SL-LINK-004",
  "SL-LINK-005",
  "SL-LINK-006",
  "SL-LINK-007",
  "SL-LINK-008",
  "SL-LINK-009",
  "SL-LINK-010",
  "SL-LINK-011",
  "SL-LINK-012",
  "SL-LINK-013",
  "SL-LINK-014"
] as const;

const implementedRobotsSitemapPerformanceRuleIds = [
  "SL-ROBOTS-001",
  "SL-ROBOTS-002",
  "SL-ROBOTS-003",
  "SL-ROBOTS-004",
  "SL-ROBOTS-005",
  "SL-ROBOTS-006",
  "SL-ROBOTS-007",
  "SL-ROBOTS-008",
  "SL-ROBOTS-009",
  "SL-ROBOTS-010",
  "SL-PERF-001",
  "SL-PERF-002",
  "SL-PERF-003",
  "SL-PERF-004",
  "SL-PERF-005",
  "SL-PERF-006"
] as const;

function pageUrl(context: RuleContext): string {
  return context.snapshot.pageUrl;
}

function route(context: RuleContext): string | undefined {
  return context.routeContract?.route ?? context.snapshot.route;
}

function headerValue(
  context: RuleContext,
  headerName: string
): string | undefined {
  const headers = context.snapshot.http?.headers;
  if (!headers) {
    return undefined;
  }

  const lowerName = headerName.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === lowerName) {
      return value;
    }
  }

  return undefined;
}

function htmlContainsHead(html: string | undefined): boolean | undefined {
  if (html === undefined) {
    return undefined;
  }

  return /<head(?:\s|>)/i.test(html);
}

function htmlDirectives(html: string | undefined): readonly string[] {
  if (!html) {
    return [];
  }

  const directives: string[] = [];
  const metaRobotsPattern =
    /<meta\s+[^>]*(?:name|property)=["'](?:robots|googlebot|yandex)["'][^>]*>/gi;
  const contentPattern = /content=["']([^"']+)["']/i;

  for (const match of html.matchAll(metaRobotsPattern)) {
    const tag = match[0] ?? "";
    const content = tag.match(contentPattern)?.[1];
    if (content) {
      directives.push(...splitDirectiveList(content));
    }
  }

  return directives;
}

function htmlDocuments(
  context: RuleContext
): readonly { source: DiagnosticSource; html: string }[] {
  return [
    ...(context.snapshot.rawHtml
      ? [{ source: "raw-html" as const, html: context.snapshot.rawHtml }]
      : []),
    ...(context.snapshot.renderedDom
      ? [
          {
            source: "rendered-dom" as const,
            html: context.snapshot.renderedDom
          }
        ]
      : [])
  ];
}

function attributeValue(
  tag: string,
  attributeName: string
): string | undefined {
  const pattern = new RegExp(`${attributeName}\\s*=\\s*["']([^"']*)["']`, "i");
  return tag.match(pattern)?.[1];
}

function titleTexts(html: string): readonly string[] {
  return [...html.matchAll(/<title(?:\s[^>]*)?>([\s\S]*?)<\/title>/gi)].map(
    (match) => (match[1] ?? "").trim()
  );
}

function metaTags(html: string): readonly string[] {
  return [...html.matchAll(/<meta\s+[^>]*>/gi)].map((match) => match[0] ?? "");
}

function linkTags(html: string): readonly string[] {
  return [...html.matchAll(/<link\s+[^>]*>/gi)].map((match) => match[0] ?? "");
}

type ImageTagEntry = {
  tag: string;
  index: number;
  src?: string;
  alt?: string;
};

function imageTags(html: string): readonly string[] {
  return imageTagEntries(html).map((entry) => entry.tag);
}

function imageTagEntries(html: string): readonly ImageTagEntry[] {
  return [...html.matchAll(/<img\s+[^>]*>/gi)].map((match, index) => {
    const tag = match[0] ?? "";
    const src = attributeValue(tag, "src");
    const alt = attributeValue(tag, "alt");
    return {
      tag,
      index,
      ...(src === undefined ? {} : { src }),
      ...(alt === undefined ? {} : { alt })
    };
  });
}

function anchorTags(html: string): readonly { tag: string; text: string }[] {
  return [...html.matchAll(/<a\s+[^>]*>([\s\S]*?)<\/a>/gi)].map((match) => ({
    tag: match[0] ?? "",
    text: stripTags(match[1] ?? "").trim()
  }));
}

function headingEntries(
  html: string
): readonly { level: number; text: string; tag: string }[] {
  return [...html.matchAll(/<h([1-6])\b([^>]*)>([\s\S]*?)<\/h\1>/gi)].map(
    (match) => ({
      level: Number(match[1]),
      tag: match[0] ?? "",
      text: stripTags(match[3] ?? "").trim()
    })
  );
}

function stripTags(value: string): string {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function metaContents(html: string, key: string): readonly string[] {
  const lowerKey = key.toLowerCase();
  return metaTags(html)
    .filter((tag) => {
      const name = attributeValue(tag, "name")?.toLowerCase();
      const property = attributeValue(tag, "property")?.toLowerCase();
      return name === lowerKey || property === lowerKey;
    })
    .map((tag) => attributeValue(tag, "content") ?? "");
}

function hasMeta(html: string, key: string): boolean {
  return metaContents(html, key).length > 0;
}

function hasMetaCharset(html: string): boolean {
  return metaTags(html).some((tag) => /<meta\s+[^>]*charset\s*=/i.test(tag));
}

function jsonLdScripts(html: string): readonly string[] {
  return [
    ...html.matchAll(
      /<script\s+[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
    )
  ].map((match) => (match[1] ?? "").trim());
}

function schemaTypes(node: unknown): readonly string[] {
  if (Array.isArray(node)) {
    return node.flatMap((item) => schemaTypes(item));
  }

  if (!node || typeof node !== "object") {
    return [];
  }

  const record = node as Record<string, unknown>;
  const type = record["@type"];
  const ownTypes = Array.isArray(type)
    ? type.filter((item): item is string => typeof item === "string")
    : typeof type === "string"
      ? [type]
      : [];
  const graphTypes = schemaTypes(record["@graph"]);

  return [...ownTypes, ...graphTypes];
}

function parsedJsonLd(html: string): readonly unknown[] {
  const parsed: unknown[] = [];
  for (const script of jsonLdScripts(html)) {
    try {
      parsed.push(JSON.parse(script));
    } catch {
      // Invalid JSON-LD is reported by SL-SCHEMA-002.
    }
  }
  return parsed;
}

function allTitleTexts(context: RuleContext): readonly string[] {
  return htmlDocuments(context).flatMap((document) =>
    titleTexts(document.html)
  );
}

function allMetaContents(context: RuleContext, key: string): readonly string[] {
  return htmlDocuments(context).flatMap((document) =>
    metaContents(document.html, key)
  );
}

function hasAnyMeta(context: RuleContext, key: string): boolean {
  return htmlDocuments(context).some((document) => hasMeta(document.html, key));
}

function renderedHtml(context: RuleContext): string | undefined {
  return context.snapshot.renderedDom;
}

function linkRels(tag: string): readonly string[] {
  return (attributeValue(tag, "rel") ?? "")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

function canonicalLinks(html: string): readonly string[] {
  return linkTags(html)
    .filter((tag) => linkRels(tag).includes("canonical"))
    .map((tag) => attributeValue(tag, "href") ?? "")
    .filter(Boolean);
}

function linkHeaderCanonicals(context: RuleContext): readonly string[] {
  const linkHeader = headerValue(context, "link");
  if (!linkHeader) {
    return [];
  }

  return [...linkHeader.matchAll(/<([^>]+)>\s*;\s*rel=["']?canonical["']?/gi)]
    .map((match) => match[1] ?? "")
    .filter(Boolean);
}

function canonicalEntries(
  context: RuleContext
): readonly { source: DiagnosticSource; href: string }[] {
  return [
    ...linkHeaderCanonicals(context).map((href) => ({
      source: "http-header" as const,
      href
    })),
    ...htmlDocuments(context).flatMap((document) =>
      canonicalLinks(document.html).map((href) => ({
        source: document.source,
        href
      }))
    )
  ];
}

function hreflangEntries(
  context: RuleContext
): readonly { source: DiagnosticSource; hreflang: string; href: string }[] {
  return htmlDocuments(context).flatMap((document) =>
    linkTags(document.html)
      .filter((tag) => linkRels(tag).includes("alternate"))
      .map((tag) => ({
        source: document.source,
        hreflang: attributeValue(tag, "hreflang") ?? "",
        href: attributeValue(tag, "href") ?? ""
      }))
      .filter((entry) => entry.hreflang.length > 0)
  );
}

type ParsedUrl = {
  href: string;
  protocol: string;
  host: string;
  pathname: string;
  search: string;
};

function parseUrlAgainstPage(
  value: string,
  context: RuleContext
): ParsedUrl | undefined {
  const pageMatch = context.snapshot.pageUrl.match(
    /^(https?:)\/\/([^/?#]+)([^?#]*)(\?[^#]*)?/i
  );
  if (!pageMatch) {
    return undefined;
  }

  const absolute = value.startsWith("/")
    ? `${pageMatch[1]}//${pageMatch[2]}${value}`
    : value;
  const match = absolute.match(/^(https?:)\/\/([^/?#]+)([^?#]*)(\?[^#]*)?/i);
  if (!match) {
    return undefined;
  }

  return {
    href: absolute,
    protocol: match[1]!,
    host: match[2]!,
    pathname: match[3] ?? "/",
    search: match[4] ?? ""
  };
}

function resolvedUrlSnapshot(
  context: RuleContext,
  url: string
): ResolvedUrlSnapshot | undefined {
  const expected = parseUrlAgainstPage(url, context);
  if (!expected) {
    return undefined;
  }

  return context.snapshot.resolvedUrls?.find((candidate) => {
    const actual = parseUrlAgainstPage(candidate.url, context);
    return actual?.href === expected.href;
  });
}

function resolvedHeaderValue(
  target: ResolvedUrlSnapshot,
  headerName: string
): string | undefined {
  const headers = target.headers;
  if (!headers) {
    return undefined;
  }

  const lowerName = headerName.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === lowerName) {
      return value;
    }
  }

  return undefined;
}

function resolvedTargetDirectives(
  target: ResolvedUrlSnapshot
): readonly { source: DiagnosticSource; directive: string }[] {
  return [
    ...splitDirectiveList(
      resolvedHeaderValue(target, "x-robots-tag") ?? ""
    ).map((directive) => ({
      source: "http-header" as const,
      directive
    })),
    ...htmlDirectives(target.rawHtml).map((directive) => ({
      source: "raw-html" as const,
      directive
    }))
  ];
}

function firstNoindexTargetDirective(
  target: ResolvedUrlSnapshot
): { source: DiagnosticSource; directive: string } | undefined {
  return resolvedTargetDirectives(target).find((entry) =>
    hasNoindex([entry.directive])
  );
}

function validHreflang(value: string): boolean {
  if (value.toLowerCase() === "x-default") {
    return true;
  }

  return /^[a-z]{2,3}(-[A-Z][a-z]{3})?(-[A-Z]{2}|\-[0-9]{3})?$/.test(value);
}

function headerDirectives(context: RuleContext): readonly string[] {
  return splitDirectiveList(headerValue(context, "x-robots-tag") ?? "");
}

function splitDirectiveList(value: string): readonly string[] {
  return value
    .split(/[,\s]+/)
    .map((directive) => directive.trim().toLowerCase())
    .filter(Boolean);
}

function unavailableAfterValues(value: string): readonly string[] {
  return [...value.matchAll(/unavailable_after\s*:\s*([^,\n;]+)/gi)]
    .map((match) => (match[1] ?? "").trim())
    .filter(Boolean);
}

function htmlUnavailableAfterEntries(
  source: Extract<DiagnosticSource, "raw-html" | "rendered-dom">,
  html: string | undefined
): readonly { source: DiagnosticSource; value: string }[] {
  if (!html) {
    return [];
  }

  return metaTags(html)
    .filter((tag) => {
      const name = attributeValue(tag, "name")?.toLowerCase();
      const property = attributeValue(tag, "property")?.toLowerCase();
      return name === "robots" || name === "googlebot" || property === "robots";
    })
    .flatMap((tag) =>
      unavailableAfterValues(attributeValue(tag, "content") ?? "").map(
        (value) => ({ source, value })
      )
    );
}

function allUnavailableAfterEntries(
  context: RuleContext
): readonly { source: DiagnosticSource; value: string }[] {
  return [
    ...unavailableAfterValues(headerValue(context, "x-robots-tag") ?? "").map(
      (value) => ({ source: "http-header" as const, value })
    ),
    ...htmlUnavailableAfterEntries("raw-html", context.snapshot.rawHtml),
    ...htmlUnavailableAfterEntries("rendered-dom", context.snapshot.renderedDom)
  ];
}

function allDirectives(context: RuleContext): readonly string[] {
  return [
    ...headerDirectives(context),
    ...htmlDirectives(context.snapshot.rawHtml),
    ...htmlDirectives(context.snapshot.renderedDom)
  ];
}

function hasNoindex(directives: readonly string[]): boolean {
  return directives.includes("noindex") || directives.includes("none");
}

function hasIndex(directives: readonly string[]): boolean {
  return directives.includes("index") || directives.includes("all");
}

function report(
  context: RuleContext,
  source: DiagnosticSource,
  title: string,
  evidence: string,
  extra: Partial<RuleReport> = {}
): RuleReport {
  const currentRoute = route(context);
  return {
    pageUrl: pageUrl(context),
    ...(currentRoute ? { route: currentRoute } : {}),
    source,
    title,
    evidence,
    ...extra
  };
}

const titleLengthGuidance = {
  min: 10,
  max: 60,
  toleratedMax: 65
} as const;

function meaningfulWordTokens(value: string): readonly string[] {
  return (value.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).filter(
    (token) => token.length > 1
  );
}

function sourceFindings(context: RuleContext): readonly SourceCodeFinding[] {
  return context.snapshot.sourceCode?.findings ?? [];
}

function sourceFinding(
  context: RuleContext,
  kind: SourceCodeFinding["kind"]
): SourceCodeFinding | undefined {
  return sourceFindings(context).find((finding) => finding.kind === kind);
}

function hasApplicableSourceFinding(
  context: RuleContext,
  kind: SourceCodeFinding["kind"]
): boolean {
  const currentRoute = route(context);
  return sourceFindings(context).some((finding) => {
    if (finding.kind !== kind) {
      return false;
    }
    return sourceRouteApplies(finding.route, currentRoute);
  });
}

function hasRouteSocialImageSummary(
  context: RuleContext,
  imageKind: "openGraph" | "twitter"
): boolean {
  const summaries = context.snapshot.sourceCode?.routeSocialImages;
  if (!summaries || summaries.length === 0) {
    return false;
  }

  const currentRoute = route(context);
  return summaries.some((summary) => {
    if (!sourceRouteApplies(summary.route, currentRoute)) {
      return false;
    }

    return imageKind === "openGraph"
      ? summary.openGraphImageFiles.length > 0
      : summary.twitterImageFiles.length > 0;
  });
}

function routeMetadataSummary(
  context: RuleContext
): SourceRouteMetadataSummary | undefined {
  const currentRoute = route(context);
  if (!currentRoute) {
    return undefined;
  }

  return context.snapshot.sourceCode?.routeMetadata?.find((summary) =>
    sourceRouteApplies(summary.route, currentRoute)
  );
}

function sourceLocationForMissingMetadata(
  context: RuleContext,
  field: Extract<SourceMetadataField, "title" | "description">
): SourceLocation | undefined {
  const summary = routeMetadataSummary(context);
  if (summary) {
    if (summary.staticFields.some((entry) => entry.field === field)) {
      return undefined;
    }

    const staticMetadataObject = sourceFindings(context).find(
      (finding) =>
        finding.kind === "static-metadata-object" &&
        metadataSummaryFiles(summary).has(finding.file)
    );
    if (staticMetadataObject) {
      return staticMetadataObject.location;
    }

    return summary.dynamicMetadata.length > 0
      ? { confidence: "RELATED" }
      : undefined;
  }

  const findings = sourceFindings(context);
  const hasStaticField = findings.some(
    (finding) =>
      finding.kind === "static-metadata-field" && finding.field === field
  );
  const staticMetadataObject = findings.find(
    (finding) => finding.kind === "static-metadata-object"
  );
  if (staticMetadataObject && !hasStaticField) {
    return staticMetadataObject.location;
  }

  return findings.find((finding) => finding.kind === "generate-metadata")
    ? { confidence: "RELATED" }
    : undefined;
}

function metadataSummaryFiles(
  summary: SourceRouteMetadataSummary
): ReadonlySet<string> {
  return new Set([
    summary.pageFile,
    ...summary.staticFields.map((field) => field.file),
    ...summary.dynamicMetadata.map((metadata) => metadata.file)
  ]);
}

function missingMetadataEvidence(
  baseEvidence: string,
  field: Extract<SourceMetadataField, "title" | "description">,
  sourceLocation: SourceLocation | undefined
): string {
  if (!sourceLocation) {
    return baseEvidence;
  }

  if (sourceLocation.confidence === "EXACT") {
    return `${baseEvidence} Source metadata object was found and no static '${field}' field was present.`;
  }

  return `${baseEvidence} generateMetadata is the related source for this route.`;
}

function nonSuccessIndexableResponse(
  context: RuleContext
): readonly RuleReport[] {
  if (!context.routeContract?.indexable || !context.snapshot.http?.statusCode) {
    return [];
  }

  const { statusCode, finalUrl } = context.snapshot.http;
  if (statusCode >= 200 && statusCode < 300) {
    return [];
  }

  return [
    report(
      context,
      "http-header",
      "Indexable route returns a non-success HTTP status",
      `Route '${context.routeContract.route}' is indexable but final URL '${finalUrl}' returned HTTP ${statusCode}.`,
      {
        expected: "2xx HTTP status for an indexable route",
        actual: String(statusCode)
      }
    )
  ];
}

function redirectChainTooLong(context: RuleContext): readonly RuleReport[] {
  const http = context.snapshot.http;
  const maxHops = http?.redirectPolicyMaxHops;
  const redirectChain = http?.redirectChain;
  if (!http || maxHops === undefined || !redirectChain) {
    return [];
  }

  const hopCount = redirectChain.length;
  if (hopCount <= maxHops) {
    return [];
  }

  return [
    report(
      context,
      "http-header",
      "Redirect chain is too long",
      `Redirect chain has ${hopCount} hops, exceeding policy limit ${maxHops}.`,
      {
        expected: `<= ${maxHops} redirect hops`,
        actual: `${hopCount} redirect hops`,
        structuredEvidence: [
          {
            type: "record",
            label: "redirect chain policy",
            value: {
              redirectHopCount: hopCount,
              policyLimit: maxHops,
              redirectChain: redirectChain.join(" -> ")
            }
          }
        ]
      }
    )
  ];
}

function redirectLoop(context: RuleContext): readonly RuleReport[] {
  const redirectChain = context.snapshot.http?.redirectChain;
  if (!redirectChain || redirectChain.length === 0) {
    return [];
  }

  const seen = new Set<string>();
  for (const url of redirectChain) {
    if (seen.has(url)) {
      return [
        report(
          context,
          "http-header",
          "Redirect chain loops",
          `Redirect chain repeats '${url}'.`,
          {
            actual: redirectChain.join(" -> ")
          }
        )
      ];
    }
    seen.add(url);
  }

  return [];
}

function htmlRouteWrongContentType(
  context: RuleContext
): readonly RuleReport[] {
  if (!context.snapshot.rawHtml && !context.snapshot.renderedDom) {
    return [];
  }

  const contentType = headerValue(context, "content-type");
  if (!contentType) {
    return [];
  }

  if (contentType.toLowerCase().includes("text/html")) {
    return [];
  }

  return [
    report(
      context,
      "http-header",
      "HTML route returned a non-HTML content type",
      `Observed Content-Type '${contentType}' for an HTML route.`,
      {
        expected: "text/html",
        actual: contentType
      }
    )
  ];
}

function missingRawHtmlHead(context: RuleContext): readonly RuleReport[] {
  const hasHead = htmlContainsHead(context.snapshot.rawHtml);
  if (hasHead !== false) {
    return [];
  }

  return [
    report(
      context,
      "raw-html",
      "Initial HTML is missing a head element",
      "Raw HTML was available but no <head> element was found."
    )
  ];
}

function missingRenderedDomHead(context: RuleContext): readonly RuleReport[] {
  const hasHead = htmlContainsHead(context.snapshot.renderedDom);
  if (hasHead !== false) {
    return [];
  }

  return [
    report(
      context,
      "rendered-dom",
      "Rendered DOM is missing a head element",
      "Rendered DOM was available but no <head> element was found."
    )
  ];
}

function rawRenderedTitleMismatch(context: RuleContext): readonly RuleReport[] {
  if (!context.snapshot.rawHtml || !context.snapshot.renderedDom) {
    return [];
  }

  const rawTitle = normalizedFirstTitle(context.snapshot.rawHtml);
  const renderedTitle = normalizedFirstTitle(context.snapshot.renderedDom);
  if (!rawTitle || !renderedTitle || rawTitle === renderedTitle) {
    return [];
  }

  return [
    report(
      context,
      "rendered-dom",
      "Raw and rendered titles differ",
      `Raw HTML title is '${rawTitle}' but rendered DOM title is '${renderedTitle}'.`,
      {
        expected: rawTitle,
        actual: renderedTitle
      }
    )
  ];
}

function rawRenderedDescriptionMismatch(
  context: RuleContext
): readonly RuleReport[] {
  if (!context.snapshot.rawHtml || !context.snapshot.renderedDom) {
    return [];
  }

  const rawDescription = normalizedFirstMetaContent(
    context.snapshot.rawHtml,
    "description"
  );
  const renderedDescription = normalizedFirstMetaContent(
    context.snapshot.renderedDom,
    "description"
  );
  if (
    !rawDescription ||
    !renderedDescription ||
    rawDescription === renderedDescription
  ) {
    return [];
  }

  return [
    report(
      context,
      "rendered-dom",
      "Raw and rendered descriptions differ",
      `Raw HTML description is '${rawDescription}' but rendered DOM description is '${renderedDescription}'.`,
      {
        expected: rawDescription,
        actual: renderedDescription
      }
    )
  ];
}

function requiredMetadataRenderedOnly(
  context: RuleContext
): readonly RuleReport[] {
  if (!context.snapshot.rawHtml || !context.snapshot.renderedDom) {
    return [];
  }

  if (context.routeContract?.indexable === false) {
    return [];
  }

  const renderedOnly = requiredMetadataKeys(
    context.snapshot.renderedDom
  ).filter(
    (key) => !requiredMetadataKeys(context.snapshot.rawHtml!).includes(key)
  );
  if (renderedOnly.length === 0) {
    return [];
  }

  return [
    report(
      context,
      "raw-html",
      "Required metadata is rendered only",
      `Required metadata appears only after rendering: ${renderedOnly.join(", ")}.`,
      {
        expected: "required metadata in raw HTML",
        actual: `rendered-only ${renderedOnly.join(", ")}`
      }
    )
  ];
}

function responseTimeOverPolicy(context: RuleContext): readonly RuleReport[] {
  const http = context.snapshot.http as
    | (typeof context.snapshot.http & {
        responseTimingMs?: number;
        responseTimingPolicyMs?: number;
      })
    | undefined;

  if (
    !http ||
    http.responseTimingMs === undefined ||
    http.responseTimingPolicyMs === undefined ||
    http.responseTimingMs <= http.responseTimingPolicyMs
  ) {
    return [];
  }

  return [
    report(
      context,
      "http-header",
      "HTTP response time exceeds policy",
      `Observed response time ${http.responseTimingMs}ms exceeds policy threshold ${http.responseTimingPolicyMs}ms.`,
      {
        expected: `<= ${http.responseTimingPolicyMs}ms`,
        actual: `${http.responseTimingMs}ms`
      }
    )
  ];
}

function renderedHtmlLangMissing(context: RuleContext): readonly RuleReport[] {
  const rendered = context.snapshot.renderedDom;
  if (!rendered) {
    return [];
  }

  const htmlTag = rendered.match(/<html\b([^>]*)>/i);
  if (!htmlTag || attributeValue(htmlTag[0], "lang")?.trim()) {
    return [];
  }

  return [
    report(
      context,
      "rendered-dom",
      "Rendered html element has no lang attribute",
      "Rendered DOM includes an <html> element without a lang attribute.",
      {
        expected: "html lang attribute",
        actual: "missing"
      }
    )
  ];
}

function hydrationRemovesRequiredMetadata(
  context: RuleContext
): readonly RuleReport[] {
  if (!context.snapshot.rawHtml || !context.snapshot.renderedDom) {
    return [];
  }

  if (context.routeContract?.indexable === false) {
    return [];
  }

  const removed = requiredMetadataKeys(context.snapshot.rawHtml).filter(
    (key) => !requiredMetadataKeys(context.snapshot.renderedDom!).includes(key)
  );
  if (removed.length === 0) {
    return [];
  }

  return [
    report(
      context,
      "rendered-dom",
      "Hydration removes required metadata",
      `Required metadata exists in raw HTML but is missing after rendering: ${removed.join(", ")}.`,
      {
        expected: `rendered metadata ${removed.join(", ")}`,
        actual: "missing after rendering"
      }
    )
  ];
}

function unexpectedNoindex(context: RuleContext): readonly RuleReport[] {
  if (!context.routeContract?.indexable) {
    return [];
  }

  const directives = allDirectives(context);
  if (!hasNoindex(directives)) {
    return [];
  }

  return [
    report(
      context,
      "raw-html",
      "Indexable route contains a noindex directive",
      `Route '${context.routeContract.route}' is indexable but directives include '${directives.join(", ")}'.`,
      {
        expected: "indexable route without noindex",
        actual: directives.join(", ")
      }
    )
  ];
}

function normalizedFirstTitle(html: string): string | undefined {
  const title = titleTexts(html)[0];
  return title === undefined ? undefined : normalizeText(title);
}

function normalizedFirstMetaContent(
  html: string,
  key: string
): string | undefined {
  const content = metaContents(html, key)[0];
  return content === undefined ? undefined : normalizeText(content);
}

function requiredMetadataKeys(html: string): readonly string[] {
  const keys: string[] = [];
  if (normalizedFirstTitle(html)) {
    keys.push("title");
  }
  if (normalizedFirstMetaContent(html, "description")) {
    keys.push("description");
  }
  return keys;
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function uniqueStrings(values: readonly string[]): readonly string[] {
  return [...new Set(values)];
}

function missingNoindex(context: RuleContext): readonly RuleReport[] {
  if (context.routeContract?.indexable !== false) {
    return [];
  }

  const directives = allDirectives(context);
  if (hasNoindex(directives)) {
    return [];
  }

  return [
    report(
      context,
      "raw-html",
      "Non-indexable route is missing a noindex directive",
      `Route '${context.routeContract.route}' is non-indexable but no noindex directive was found.`,
      {
        expected: "noindex directive",
        actual: directives.length > 0 ? directives.join(", ") : "none"
      }
    )
  ];
}

function conflictingIndexDirectives(
  context: RuleContext
): readonly RuleReport[] {
  const directives = allDirectives(context);
  if (!hasIndex(directives) || !hasNoindex(directives)) {
    return [];
  }

  return [
    report(
      context,
      "raw-html",
      "Conflicting index and noindex directives",
      `Observed conflicting directives '${directives.join(", ")}'.`,
      {
        actual: directives.join(", ")
      }
    )
  ];
}

function robotsBlocksIndexableRoute(
  context: RuleContext
): readonly RuleReport[] {
  if (context.routeContract?.indexable !== true) {
    return [];
  }

  const matchedRule = robotsRuleForPage(context);
  if (matchedRule?.directive !== "disallow") {
    return [];
  }

  return [
    report(
      context,
      "robots-txt",
      "robots.txt blocks an indexable route",
      `Route '${context.routeContract.route}' is indexable, but robots.txt rule '${matchedRule.line}' blocks '${context.snapshot.pageUrl}'.`,
      {
        expected: "robots.txt allows indexable route",
        actual: matchedRule.line,
        structuredEvidence: [
          {
            type: "record",
            label: "robots route conflict",
            value: {
              route: context.routeContract.route,
              matchedUrl: context.snapshot.pageUrl,
              robotsRule: matchedRule.line
            }
          }
        ]
      }
    )
  ];
}

function sitemapIncludesNoindexUrl(
  context: RuleContext
): readonly RuleReport[] {
  const graph = graphForSiteDiagnostic(context);
  if (!graph) {
    return [];
  }

  return sitemapLocEntries(context).flatMap((entry) => {
    const page = graphPageByUrl(graph, entry);
    if (!page || page.indexable !== false) {
      return [];
    }

    return [
      report(
        context,
        "sitemap",
        "Sitemap includes a non-indexable URL",
        `Sitemap entry '${entry}' is observed as non-indexable.`,
        {
          expected: "sitemap URLs are indexable",
          actual: "noindex",
          structuredEvidence: [
            {
              type: "record",
              label: "sitemap noindex entry",
              value: {
                sitemapEntry: entry,
                discoveredDirective: "noindex"
              }
            }
          ]
        }
      )
    ];
  });
}

function criticalAssetsBlockedByRobots(
  context: RuleContext
): readonly RuleReport[] {
  const graphPage = context.snapshot.siteGraph?.pages.find((page) =>
    sameUrl(page.url, context.snapshot.pageUrl)
  );
  const assetUrls = graphPage?.assetUrls ?? htmlAssetUrlsFromSnapshot(context);
  const blocked = assetUrls
    .map((assetUrl) => ({
      assetUrl,
      rule: robotsRuleForUrl(context, assetUrl)
    }))
    .find((entry) => entry.rule?.directive === "disallow");

  if (!blocked?.rule) {
    return [];
  }

  return [
    report(
      context,
      "robots-txt",
      "robots.txt blocks a critical render asset",
      `Critical asset '${blocked.assetUrl}' matches robots.txt rule '${blocked.rule.line}'.`,
      {
        expected: "critical render assets allowed by robots.txt",
        actual: blocked.rule.line,
        structuredEvidence: [
          {
            type: "record",
            label: "blocked critical asset",
            value: {
              assetUrl: blocked.assetUrl,
              robotsRule: blocked.rule.line
            }
          }
        ]
      }
    )
  ];
}

function htmlAssetUrlsFromSnapshot(context: RuleContext): readonly string[] {
  return uniqueStrings(
    htmlDocuments(context).flatMap((document) => [
      ...assetAttributeUrls(document.html, "script", "src"),
      ...assetAttributeUrls(document.html, "link", "href"),
      ...assetAttributeUrls(document.html, "img", "src")
    ])
  )
    .map((url) => parseUrlAgainstPage(url, context)?.href)
    .filter((url): url is string => Boolean(url));
}

function assetAttributeUrls(
  html: string,
  tagName: "script" | "link" | "img",
  attributeName: "src" | "href"
): readonly string[] {
  return [...html.matchAll(new RegExp(`<${tagName}\\s+[^>]*>`, "gi"))]
    .map((match) => attributeValue(match[0] ?? "", attributeName) ?? "")
    .filter(Boolean);
}

function noindexRenderedOnly(context: RuleContext): readonly RuleReport[] {
  const rawDirectives = [
    ...headerDirectives(context),
    ...htmlDirectives(context.snapshot.rawHtml)
  ];
  const renderedDirectives = htmlDirectives(context.snapshot.renderedDom);

  if (hasNoindex(rawDirectives) || !hasNoindex(renderedDirectives)) {
    return [];
  }

  return [
    report(
      context,
      "rendered-dom",
      "Noindex appears only after rendering",
      `Rendered DOM contains noindex directives '${renderedDirectives.join(", ")}' but raw HTML and HTTP headers do not.`,
      {
        expected: "consistent noindex directives before rendering",
        actual: renderedDirectives.join(", ")
      }
    )
  ];
}

function xRobotsNoneOnIndexableRoute(
  context: RuleContext
): readonly RuleReport[] {
  if (!context.routeContract?.indexable) {
    return [];
  }

  const directives = headerDirectives(context);
  if (!directives.includes("none")) {
    return [];
  }

  return [
    report(
      context,
      "http-header",
      "Indexable route has X-Robots-Tag none",
      `Route '${context.routeContract.route}' is indexable but X-Robots-Tag contains 'none'.`,
      {
        expected: "X-Robots-Tag without none",
        actual: directives.join(", ")
      }
    )
  ];
}

function unavailableAfterExpired(context: RuleContext): readonly RuleReport[] {
  if (!context.routeContract?.indexable) {
    return [];
  }

  const expired = allUnavailableAfterEntries(context).find((entry) => {
    const timestamp = Date.parse(entry.value);
    return Number.isFinite(timestamp) && timestamp < Date.parse(context.now);
  });
  if (!expired) {
    return [];
  }

  return [
    report(
      context,
      expired.source,
      "Indexable route has expired unavailable_after",
      `Route '${context.routeContract.route}' is indexable but unavailable_after '${expired.value}' is before observedAt '${context.now}'.`,
      {
        expected: "no expired unavailable_after directive",
        actual: expired.value
      }
    )
  ];
}

function canonicalTargetNoindex(context: RuleContext): readonly RuleReport[] {
  const entry = canonicalEntries(context)[0];
  if (!entry) {
    return [];
  }

  const target = resolvedUrlSnapshot(context, entry.href);
  if (!target) {
    return [];
  }

  const directive = firstNoindexTargetDirective(target);
  if (!directive) {
    return [];
  }

  const targetUrl =
    parseUrlAgainstPage(target.url, context)?.href ?? target.url;
  return [
    report(
      context,
      directive.source,
      "Canonical target is noindex",
      `Canonical target '${targetUrl}' contains '${directive.directive}'.`,
      {
        expected: "indexable canonical target",
        actual: directive.directive,
        structuredEvidence: [
          {
            type: "record",
            label: "canonical target directive",
            value: {
              canonicalUrl: entry.href,
              canonicalSource: entry.source,
              targetUrl,
              targetDirective: directive.directive,
              targetDirectiveSource: directive.source
            }
          }
        ]
      }
    )
  ];
}

function googleIndexableUrlNotIndexed(
  context: RuleContext
): readonly RuleReport[] {
  if (!context.routeContract?.indexable) {
    return [];
  }

  const observation = (context.snapshot.externalObservations ?? []).find(
    (item) => item.provider === "google" && item.indexability?.indexed === false
  );
  if (!observation) {
    return [];
  }

  const state = observation.indexability?.state ?? "not-indexed";
  const reason = observation.indexability?.reason;
  return [
    report(
      context,
      "google",
      "Google reports indexable route is not indexed",
      `Google observation for route '${context.routeContract.route}' is '${state}' with observedAt '${observation.observedAt}' and fetchedAt '${observation.fetchedAt}'.${reason ? ` Reason: ${reason}.` : ""}`,
      {
        expected: "indexed Google coverage state",
        actual: state,
        structuredEvidence: [
          {
            type: "record",
            label: "google indexability observation",
            value: {
              provider: "google",
              route: context.routeContract.route,
              indexed: false,
              state,
              reason: reason ?? null,
              observedAt: observation.observedAt,
              fetchedAt: observation.fetchedAt,
              freshness: observation.freshness
            }
          }
        ]
      }
    )
  ];
}

function yandexIndexableUrlNotSearchable(
  context: RuleContext
): readonly RuleReport[] {
  if (!context.routeContract?.indexable) {
    return [];
  }

  const observation = (context.snapshot.externalObservations ?? []).find(
    (item) =>
      item.provider === "yandex" && item.indexability?.searchable === false
  );
  if (!observation) {
    return [];
  }

  const state = observation.indexability?.state ?? "not-searchable";
  const reason = observation.indexability?.reason;
  return [
    report(
      context,
      "yandex",
      "Yandex reports indexable route is not searchable",
      `Yandex observation for route '${context.routeContract.route}' is '${state}' with observedAt '${observation.observedAt}' and fetchedAt '${observation.fetchedAt}'.${reason ? ` Reason: ${reason}.` : ""}`,
      {
        expected: "searchable Yandex state",
        actual: state,
        structuredEvidence: [
          {
            type: "record",
            label: "yandex indexability observation",
            value: {
              provider: "yandex",
              route: context.routeContract.route,
              searchable: false,
              state,
              reason: reason ?? null,
              observedAt: observation.observedAt,
              fetchedAt: observation.fetchedAt,
              freshness: observation.freshness
            }
          }
        ]
      }
    )
  ];
}

function indexableParameterUrl(context: RuleContext): readonly RuleReport[] {
  if (context.routeContract) {
    return [];
  }

  const page = parseUrlAgainstPage(context.snapshot.pageUrl, context);
  if (!page || page.search.length === 0 || hasNoindex(allDirectives(context))) {
    return [];
  }

  return [
    report(
      context,
      "crawler",
      "Query-parameter URL is indexable without an explicit route contract",
      `URL '${context.snapshot.pageUrl}' has query parameters and no explicit route contract or noindex directive.`,
      {
        expected:
          "explicit route contract, canonicalization, noindex, or blocked parameter URL",
        actual: context.snapshot.pageUrl
      }
    )
  ];
}

function soft404Indexable(context: RuleContext): readonly RuleReport[] {
  const statusCode = context.snapshot.http?.statusCode;
  if (
    context.routeContract?.indexable !== true ||
    statusCode === undefined ||
    statusCode < 200 ||
    statusCode >= 300
  ) {
    return [];
  }

  const graphPage = context.snapshot.siteGraph?.pages.find((page) =>
    sameUrl(page.url, context.snapshot.pageUrl)
  );
  const signals = graphPage?.soft404Signals ?? soft404Signals(context);
  if (!signals.includes("not-found-copy")) {
    return [];
  }

  return [
    report(
      context,
      "rendered-dom",
      "Indexable route has soft-404 content signals",
      `Indexable route returned HTTP ${statusCode} but content signals indicate '${signals.join(", ")}'.`,
      {
        expected: "substantial indexable content or a real 404/410 status",
        actual: signals.join(", "),
        structuredEvidence: [
          {
            type: "record",
            label: "soft 404 signals",
            value: {
              statusCode,
              contentSignal: signals.join(", "),
              route: context.routeContract.route
            }
          }
        ]
      }
    )
  ];
}

function soft404Signals(context: RuleContext): readonly string[] {
  const html = renderedHtml(context) ?? context.snapshot.rawHtml;
  if (!html) {
    return [];
  }
  const text = stripTags(html).toLowerCase();
  const signals: string[] = [];
  if (/\b(not found|page not found|404|does not exist)\b/.test(text)) {
    signals.push("not-found-copy");
  }
  if (text.length > 0 && text.length < 120) {
    signals.push("thin-content");
  }
  return signals;
}

function missingTitle(context: RuleContext): readonly RuleReport[] {
  const documents = htmlDocuments(context);
  if (documents.length === 0 || allTitleTexts(context).length > 0) {
    return [];
  }

  const sourceLocation = sourceLocationForMissingMetadata(context, "title");
  return [
    report(
      context,
      sourceLocation ? "source-code" : (documents[0]?.source ?? "raw-html"),
      "Route is missing a title",
      missingMetadataEvidence(
        "Raw HTML or rendered DOM was available but no <title> element was found.",
        "title",
        sourceLocation
      ),
      sourceLocation ? { sourceLocation } : {}
    )
  ];
}

function emptyTitle(context: RuleContext): readonly RuleReport[] {
  const titles = allTitleTexts(context);
  if (!titles.some((title) => title.length === 0)) {
    return [];
  }

  return [
    report(
      context,
      "raw-html",
      "Route has an empty title",
      "At least one <title> element is present but empty."
    )
  ];
}

function multipleTitleElements(context: RuleContext): readonly RuleReport[] {
  const violatingDocument = htmlDocuments(context).find(
    (document) => titleTexts(document.html).length > 1
  );
  if (!violatingDocument) {
    return [];
  }

  return [
    report(
      context,
      violatingDocument.source,
      "Route has multiple title elements",
      `${violatingDocument.source} contains ${titleTexts(violatingDocument.html).length} <title> elements.`
    )
  ];
}

function normalizedGraphText(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function duplicateTitleAcrossIndexablePages(
  context: RuleContext
): readonly RuleReport[] {
  const graph = graphForSiteDiagnostic(context);
  if (!graph) {
    return [];
  }

  const groups = new Map<string, { url: string; title: string }[]>();
  for (const page of graph.pages) {
    if (page.indexable === false || !page.title?.trim()) {
      continue;
    }
    const key = normalizedGraphText(page.title);
    const group = groups.get(key) ?? [];
    group.push({ url: page.url, title: page.title });
    groups.set(key, group);
  }

  return [...groups.values()]
    .filter((group) => group.length > 1)
    .map((group) =>
      report(
        context,
        "crawler",
        "Duplicate title across indexable pages",
        `Indexable pages share normalized title '${group[0]!.title}'. Matched URLs: ${group.map((page) => page.url).join(", ")}.`,
        {
          expected: "unique title per indexable page",
          actual: group[0]!.title,
          structuredEvidence: [
            {
              type: "record",
              label: "duplicate title group",
              value: {
                titleValue: group[0]!.title,
                matchedUrls: group.map((page) => page.url).join(", ")
              }
            }
          ]
        }
      )
    );
}

function missingDescription(context: RuleContext): readonly RuleReport[] {
  const documents = htmlDocuments(context);
  if (
    documents.length === 0 ||
    allMetaContents(context, "description").length > 0
  ) {
    return [];
  }

  const sourceLocation = sourceLocationForMissingMetadata(
    context,
    "description"
  );
  return [
    report(
      context,
      sourceLocation ? "source-code" : (documents[0]?.source ?? "raw-html"),
      "Route is missing a meta description",
      missingMetadataEvidence(
        "Raw HTML or rendered DOM was available but no meta description was found.",
        "description",
        sourceLocation
      ),
      sourceLocation ? { sourceLocation } : {}
    )
  ];
}

function emptyDescription(context: RuleContext): readonly RuleReport[] {
  const descriptions = allMetaContents(context, "description");
  if (!descriptions.some((description) => description.trim().length === 0)) {
    return [];
  }

  return [
    report(
      context,
      "raw-html",
      "Route has an empty meta description",
      "At least one meta description tag is present but empty."
    )
  ];
}

function multipleMetaDescriptions(context: RuleContext): readonly RuleReport[] {
  const violatingDocument = htmlDocuments(context).find(
    (document) => metaContents(document.html, "description").length > 1
  );
  if (!violatingDocument) {
    return [];
  }

  return [
    report(
      context,
      violatingDocument.source,
      "Route has multiple meta descriptions",
      `${violatingDocument.source} contains ${metaContents(violatingDocument.html, "description").length} meta description tags.`
    )
  ];
}

function duplicateDescriptionAcrossIndexablePages(
  context: RuleContext
): readonly RuleReport[] {
  const graph = graphForSiteDiagnostic(context);
  if (!graph) {
    return [];
  }

  const groups = new Map<string, { url: string; description: string }[]>();
  for (const page of graph.pages) {
    if (page.indexable === false || !page.description?.trim()) {
      continue;
    }
    const key = normalizedGraphText(page.description);
    const group = groups.get(key) ?? [];
    group.push({ url: page.url, description: page.description });
    groups.set(key, group);
  }

  return [...groups.values()]
    .filter((group) => group.length > 1)
    .map((group) =>
      report(
        context,
        "crawler",
        "Duplicate meta description across indexable pages",
        `Indexable pages share normalized meta description '${group[0]!.description}'. Matched URLs: ${group.map((page) => page.url).join(", ")}.`,
        {
          expected: "unique meta description per indexable page",
          actual: group[0]!.description,
          structuredEvidence: [
            {
              type: "record",
              label: "duplicate description group",
              value: {
                descriptionValue: group[0]!.description,
                matchedUrls: group.map((page) => page.url).join(", ")
              }
            }
          ]
        }
      )
    );
}

function metadataSourceLocationUnresolved(
  context: RuleContext
): readonly RuleReport[] {
  const unresolved = sourceFindings(context).find(
    (finding) =>
      (finding.kind === "generate-metadata" ||
        finding.kind === "static-metadata-object") &&
      finding.location.confidence !== "EXACT"
  );
  if (!unresolved) {
    return [];
  }

  return [
    report(
      context,
      "source-code",
      "Metadata source location is not exact",
      `Source analysis located metadata through '${unresolved.kind}' with ${unresolved.location.confidence} confidence, so file and line must not be treated as exact.`,
      {
        expected: "EXACT source location for metadata origin",
        actual: unresolved.location.confidence,
        structuredEvidence: [
          {
            type: "record",
            label: "metadata localization confidence",
            value: {
              diagnosticId: "metadata-source-location",
              localizationConfidence: unresolved.location.confidence,
              findingKind: unresolved.kind
            }
          }
        ]
      }
    )
  ];
}

function titleLengthOutsideGuidance(
  context: RuleContext
): readonly RuleReport[] {
  const title = allTitleTexts(context).find(
    (candidate) => candidate.length > 0
  );
  if (
    !title ||
    (title.length >= titleLengthGuidance.min &&
      title.length <= titleLengthGuidance.toleratedMax)
  ) {
    return [];
  }

  const overage = Math.max(0, title.length - titleLengthGuidance.max);
  return [
    report(
      context,
      "raw-html",
      "Title length is outside guidance",
      overage > 0
        ? `Observed title length is ${title.length} characters, ${overage} over the ${titleLengthGuidance.max} character guidance.`
        : `Observed title length is ${title.length} characters.`,
      {
        expected: `${titleLengthGuidance.min} to ${titleLengthGuidance.max} characters; minor overage up to ${titleLengthGuidance.toleratedMax} is tolerated`,
        actual: `${title.length} characters`,
        structuredEvidence: [
          {
            type: "record",
            label: "title length guidance",
            value: {
              title,
              titleLength: title.length,
              minimum: titleLengthGuidance.min,
              maximum: titleLengthGuidance.max,
              toleratedMaximum: titleLengthGuidance.toleratedMax
            }
          }
        ]
      }
    )
  ];
}

function descriptionLengthOutsideGuidance(
  context: RuleContext
): readonly RuleReport[] {
  const description = allMetaContents(context, "description").find(
    (candidate) => candidate.trim().length > 0
  );
  if (!description || (description.length >= 50 && description.length <= 160)) {
    return [];
  }

  return [
    report(
      context,
      "raw-html",
      "Description length is outside guidance",
      `Observed meta description length is ${description.length} characters.`,
      {
        expected: "50 to 160 characters",
        actual: `${description.length} characters`
      }
    )
  ];
}

function missingMetaKey(
  context: RuleContext,
  key: string,
  title: string,
  evidence: string
): readonly RuleReport[] {
  const documents = htmlDocuments(context);
  if (documents.length === 0 || hasAnyMeta(context, key)) {
    return [];
  }

  return [report(context, documents[0]?.source ?? "raw-html", title, evidence)];
}

function missingOpenGraphTitle(context: RuleContext): readonly RuleReport[] {
  return missingMetaKey(
    context,
    "og:title",
    "Route is missing Open Graph title",
    "No og:title metadata was found in raw HTML or rendered DOM."
  );
}

function missingOpenGraphDescription(
  context: RuleContext
): readonly RuleReport[] {
  return missingMetaKey(
    context,
    "og:description",
    "Route is missing Open Graph description",
    "No og:description metadata was found in raw HTML or rendered DOM."
  );
}

function missingTwitterTitle(context: RuleContext): readonly RuleReport[] {
  return missingMetaKey(
    context,
    "twitter:title",
    "Route is missing Twitter title",
    "No twitter:title metadata was found in raw HTML or rendered DOM."
  );
}

function missingTwitterDescription(
  context: RuleContext
): readonly RuleReport[] {
  return missingMetaKey(
    context,
    "twitter:description",
    "Route is missing Twitter description",
    "No twitter:description metadata was found in raw HTML or rendered DOM."
  );
}

function missingViewport(context: RuleContext): readonly RuleReport[] {
  return missingMetaKey(
    context,
    "viewport",
    "Route is missing viewport metadata",
    "No viewport metadata was found in raw HTML or rendered DOM."
  );
}

function missingCharset(context: RuleContext): readonly RuleReport[] {
  const documents = htmlDocuments(context);
  if (documents.length === 0) {
    return [];
  }

  const hasCharset =
    documents.some((document) => hasMetaCharset(document.html)) ||
    (headerValue(context, "content-type")?.toLowerCase().includes("charset=") ??
      false);

  if (hasCharset) {
    return [];
  }

  return [
    report(
      context,
      "raw-html",
      "Route is missing charset metadata",
      "No meta charset or Content-Type charset was found."
    )
  ];
}

function duplicateSocialMetadata(context: RuleContext): readonly RuleReport[] {
  const socialKeys = [
    "og:title",
    "og:description",
    "twitter:title",
    "twitter:description"
  ];

  for (const document of htmlDocuments(context)) {
    for (const key of socialKeys) {
      const count = metaContents(document.html, key).length;
      if (count > 1) {
        return [
          report(
            context,
            document.source,
            "Route has duplicate social metadata",
            `${document.source} contains ${count} '${key}' metadata tags.`,
            {
              actual: `${count} ${key} tags`
            }
          )
        ];
      }
    }
  }

  return [];
}

function missingH1(context: RuleContext): readonly RuleReport[] {
  const html = renderedHtml(context);
  if (!html || headingEntries(html).some((heading) => heading.level === 1)) {
    return [];
  }

  return [
    report(
      context,
      "rendered-dom",
      "Rendered DOM is missing an H1",
      "Rendered DOM was available but no <h1> element was found."
    )
  ];
}

function multipleH1(context: RuleContext): readonly RuleReport[] {
  const html = renderedHtml(context);
  if (!html) {
    return [];
  }

  const count = headingEntries(html).filter(
    (heading) => heading.level === 1
  ).length;
  if (count <= 1) {
    return [];
  }

  return [
    report(
      context,
      "rendered-dom",
      "Rendered DOM has multiple H1 elements",
      `Rendered DOM contains ${count} <h1> elements.`,
      { actual: `${count} h1 elements` }
    )
  ];
}

function emptyHeading(context: RuleContext): readonly RuleReport[] {
  const html = renderedHtml(context);
  if (!html) {
    return [];
  }

  const empty = headingEntries(html).find(
    (heading) => heading.text.length === 0
  );
  if (!empty) {
    return [];
  }

  return [
    report(
      context,
      "rendered-dom",
      "Rendered DOM has an empty heading",
      `A rendered h${empty.level} heading has no text.`
    )
  ];
}

function skippedHeadingLevel(context: RuleContext): readonly RuleReport[] {
  const html = renderedHtml(context);
  if (!html) {
    return [];
  }

  let previousLevel = 0;
  for (const heading of headingEntries(html)) {
    if (previousLevel > 0 && heading.level > previousLevel + 1) {
      return [
        report(
          context,
          "rendered-dom",
          "Rendered heading levels skip",
          `Heading level jumps from h${previousLevel} to h${heading.level}.`,
          {
            actual: `h${previousLevel} to h${heading.level}`
          }
        )
      ];
    }
    previousLevel = heading.level;
  }

  return [];
}

function titleH1TokenMismatch(context: RuleContext): readonly RuleReport[] {
  const html = renderedHtml(context);
  if (!html) {
    return [];
  }

  const title = titleTexts(html)[0];
  const h1 = headingEntries(html).find((heading) => heading.level === 1)?.text;
  if (!title || !h1) {
    return [];
  }

  const titleTokens = new Set(meaningfulWordTokens(title));
  const h1Tokens = new Set(meaningfulWordTokens(h1));
  const overlap = [...titleTokens].filter((token) => h1Tokens.has(token));
  if (overlap.length > 0) {
    return [];
  }

  return [
    report(
      context,
      "rendered-dom",
      "Title and H1 do not share tokens",
      `Rendered title '${title}' and H1 '${h1}' share no normalized word tokens.`,
      {
        expected: "At least one shared meaningful title/H1 term",
        actual: "0 shared meaningful terms",
        structuredEvidence: [
          {
            type: "record",
            label: "title and h1 token overlap",
            value: {
              title,
              h1,
              titleTokens: [...titleTokens].join(", "),
              h1Tokens: [...h1Tokens].join(", "),
              overlap: overlap.join(", ")
            }
          }
        ]
      }
    )
  ];
}

function h1RenderedOnly(context: RuleContext): readonly RuleReport[] {
  if (!context.snapshot.rawHtml || !context.snapshot.renderedDom) {
    return [];
  }

  const rawHasH1 = headingEntries(context.snapshot.rawHtml).some(
    (heading) => heading.level === 1
  );
  const renderedHasH1 = headingEntries(context.snapshot.renderedDom).some(
    (heading) => heading.level === 1
  );
  if (rawHasH1 || !renderedHasH1) {
    return [];
  }

  return [
    report(
      context,
      "rendered-dom",
      "H1 exists only after rendering",
      "Rendered DOM contains an H1, but initial raw HTML does not."
    )
  ];
}

function hiddenPrimaryHeading(context: RuleContext): readonly RuleReport[] {
  const html = renderedHtml(context);
  if (!html) {
    return [];
  }

  const hidden = headingEntries(html).find(
    (heading) =>
      heading.level === 1 &&
      (/\bhidden\b/i.test(heading.tag) ||
        /display\s*:\s*none/i.test(heading.tag) ||
        /visibility\s*:\s*hidden/i.test(heading.tag) ||
        /aria-hidden\s*=\s*["']true["']/i.test(heading.tag))
  );
  if (!hidden) {
    return [];
  }

  return [
    report(
      context,
      "rendered-dom",
      "Primary heading is hidden",
      "Rendered H1 is hidden by attributes or inline style."
    )
  ];
}

function requiredHeadingPatternMissing(
  context: RuleContext
): readonly RuleReport[] {
  const requirements = context.routeContract?.requiredHeadings ?? [];
  const html = renderedHtml(context);
  if (requirements.length === 0 || !html) {
    return [];
  }

  const headings = headingEntries(html);
  const missing = requirements.find((requirement) => {
    const expectedPattern = normalizeText(requirement.pattern).toLowerCase();
    return !headings.some(
      (heading) =>
        heading.level === requirement.level &&
        normalizeText(heading.text).toLowerCase().includes(expectedPattern)
    );
  });
  if (!missing) {
    return [];
  }

  const headingSequence = headings
    .map((heading) => `h${heading.level}:${normalizeText(heading.text)}`)
    .join(" | ");

  return [
    report(
      context,
      "rendered-dom",
      "Required heading pattern is missing",
      `Route '${context.routeContract?.route}' requires h${missing.level} heading pattern '${missing.pattern}', but rendered headings do not match it.`,
      {
        expected: `h${missing.level} containing '${missing.pattern}'`,
        actual: headingSequence || "no rendered headings",
        structuredEvidence: [
          {
            type: "record",
            label: "route heading requirement",
            value: {
              route: route(context) ?? null,
              headingLevel: missing.level,
              pattern: missing.pattern
            }
          },
          {
            type: "record",
            label: "rendered heading sequence",
            value: {
              headings: headingSequence || null
            }
          }
        ]
      }
    )
  ];
}

function missingOgImage(context: RuleContext): readonly RuleReport[] {
  if (
    hasRouteSocialImageSummary(context, "openGraph") ||
    hasApplicableSourceFinding(context, "opengraph-image-file")
  ) {
    return [];
  }

  return missingMetaKey(
    context,
    "og:image",
    "Route is missing Open Graph image",
    "No og:image metadata was found in raw HTML or rendered DOM."
  );
}

function metaContentEntries(
  context: RuleContext,
  key: string
): readonly { source: DiagnosticSource; value: string }[] {
  return htmlDocuments(context).flatMap((document) =>
    metaContents(document.html, key).map((value) => ({
      source: document.source,
      value
    }))
  );
}

function socialImageEntries(context: RuleContext): readonly {
  source: DiagnosticSource;
  kind: "og:image" | "twitter:image";
  url: string;
}[] {
  return [
    ...metaContentEntries(context, "og:image").map((entry) => ({
      ...entry,
      kind: "og:image" as const,
      url: entry.value
    })),
    ...metaContentEntries(context, "twitter:image").map((entry) => ({
      ...entry,
      kind: "twitter:image" as const,
      url: entry.value
    }))
  ].filter((entry) => entry.url.trim().length > 0);
}

function renderedImageSrcEntries(
  context: RuleContext
): readonly { source: DiagnosticSource; url: string }[] {
  const html = renderedHtml(context);
  if (!html) {
    return [];
  }

  return imageTags(html)
    .map((tag) => attributeValue(tag, "src") ?? "")
    .filter(Boolean)
    .map((url) => ({ source: "rendered-dom" as const, url }));
}

function resolvedImageTarget(
  context: RuleContext,
  url: string
): ResolvedUrlSnapshot | undefined {
  return resolvedUrlSnapshot(context, url);
}

function contentType(target: ResolvedUrlSnapshot): string | undefined {
  return resolvedHeaderValue(target, "content-type")
    ?.split(";")[0]
    ?.trim()
    .toLowerCase();
}

function contentLengthBytes(target: ResolvedUrlSnapshot): number | undefined {
  const value = resolvedHeaderValue(target, "content-length");
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function supportedSocialImageType(type: string | undefined): boolean {
  return (
    type === undefined ||
    type === "image/jpeg" ||
    type === "image/png" ||
    type === "image/gif" ||
    type === "image/webp"
  );
}

function imageTargetUrl(
  context: RuleContext,
  target: ResolvedUrlSnapshot
): string {
  return parseUrlAgainstPage(target.url, context)?.href ?? target.url;
}

function socialImageNonSuccess(
  context: RuleContext,
  kind: "og:image" | "twitter:image",
  title: string,
  expected: string
): readonly RuleReport[] {
  for (const entry of socialImageEntries(context).filter(
    (candidate) => candidate.kind === kind
  )) {
    const target = resolvedImageTarget(context, entry.url);
    if (!target || !nonSuccessStatus(target.statusCode)) {
      continue;
    }

    const targetUrl = imageTargetUrl(context, target);
    return [
      report(
        context,
        "http-header",
        title,
        `${kind} target '${targetUrl}' returned HTTP ${target.statusCode}.`,
        {
          expected,
          actual: `HTTP ${target.statusCode}`,
          structuredEvidence: [
            {
              type: "record",
              label: "social image target status",
              value: {
                imageKind: kind,
                imageUrl: entry.url,
                imageSource: entry.source,
                targetUrl,
                finalUrl: target.finalUrl ?? null,
                statusCode: target.statusCode ?? null
              }
            }
          ]
        }
      )
    ];
  }

  return [];
}

function ogImageNonSuccess(context: RuleContext): readonly RuleReport[] {
  return socialImageNonSuccess(
    context,
    "og:image",
    "Open Graph image target is non-success",
    "2xx Open Graph image response"
  );
}

function ogImageNotAbsolute(context: RuleContext): readonly RuleReport[] {
  const value = allMetaContents(context, "og:image")[0];
  if (!value || /^https?:\/\//i.test(value)) {
    return [];
  }

  return [
    report(
      context,
      "raw-html",
      "Open Graph image is not absolute",
      `Observed og:image '${value}' is not an absolute URL.`,
      { actual: value }
    )
  ];
}

function missingTwitterImage(context: RuleContext): readonly RuleReport[] {
  if (
    hasRouteSocialImageSummary(context, "twitter") ||
    hasApplicableSourceFinding(context, "twitter-image-file")
  ) {
    return [];
  }

  return missingMetaKey(
    context,
    "twitter:image",
    "Route is missing Twitter image",
    "No twitter:image metadata was found in raw HTML or rendered DOM."
  );
}

function twitterImageNonSuccess(context: RuleContext): readonly RuleReport[] {
  return socialImageNonSuccess(
    context,
    "twitter:image",
    "Twitter image target is non-success",
    "2xx Twitter image response"
  );
}

function contentImageMissingAlt(context: RuleContext): readonly RuleReport[] {
  const html = renderedHtml(context);
  if (!html) {
    return [];
  }

  const missing = imageTagEntries(html).find(
    (entry) => entry.alt === undefined
  );
  if (!missing) {
    return [];
  }

  return [
    report(
      context,
      "rendered-dom",
      "Content image is missing alt text",
      imageAltEvidence("without an alt attribute", missing),
      imageAltReportDetails(missing, "descriptive alt text")
    )
  ];
}

function contentImageEmptyAlt(context: RuleContext): readonly RuleReport[] {
  const html = renderedHtml(context);
  if (!html) {
    return [];
  }

  const empty = imageTagEntries(html).find(
    (entry) => entry.alt?.trim().length === 0
  );
  if (!empty) {
    return [];
  }

  return [
    report(
      context,
      "rendered-dom",
      "Content image has empty alt text",
      imageAltEvidence("with an empty alt attribute", empty),
      imageAltReportDetails(empty, "non-empty descriptive alt text")
    )
  ];
}

function imageAltEvidence(state: string, entry: ImageTagEntry): string {
  const src = entry.src ? ` src '${entry.src}'` : "";
  return `Rendered DOM contains image #${entry.index + 1}${src} ${state}.`;
}

function imageAltReportDetails(
  entry: ImageTagEntry,
  expected: string
): Partial<RuleReport> {
  return {
    expected,
    actual:
      entry.alt === undefined ? "missing alt attribute" : `alt="${entry.alt}"`,
    sourceLocation: {
      confidence: "RUNTIME",
      selector: imageSelector(entry)
    },
    structuredEvidence: [
      {
        type: "record",
        label: "image alt state",
        value: {
          imageIndex: entry.index + 1,
          src: entry.src ?? null,
          alt: entry.alt ?? null
        }
      }
    ]
  };
}

function imageSelector(entry: ImageTagEntry): string {
  if (entry.src) {
    return `img[src="${cssString(entry.src)}"]`;
  }
  return `img:nth-of-type(${entry.index + 1})`;
}

function cssString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function pageImageNonSuccess(context: RuleContext): readonly RuleReport[] {
  for (const entry of renderedImageSrcEntries(context)) {
    const target = resolvedImageTarget(context, entry.url);
    if (!target || !nonSuccessStatus(target.statusCode)) {
      continue;
    }

    const targetUrl = imageTargetUrl(context, target);
    return [
      report(
        context,
        "http-header",
        "Rendered page image target is non-success",
        `Rendered image target '${targetUrl}' returned HTTP ${target.statusCode}.`,
        {
          expected: "2xx rendered image response",
          actual: `HTTP ${target.statusCode}`,
          structuredEvidence: [
            {
              type: "record",
              label: "rendered image target status",
              value: {
                imageUrl: entry.url,
                imageSource: entry.source,
                targetUrl,
                finalUrl: target.finalUrl ?? null,
                statusCode: target.statusCode ?? null
              }
            }
          ]
        }
      )
    ];
  }

  return [];
}

const socialImageSizeGuidanceMaxBytes = 5_000_000;

function socialImageSizeOutsideGuidance(
  context: RuleContext
): readonly RuleReport[] {
  for (const entry of socialImageEntries(context)) {
    const target = resolvedImageTarget(context, entry.url);
    const bytes = target ? contentLengthBytes(target) : undefined;
    if (
      !target ||
      bytes === undefined ||
      bytes <= socialImageSizeGuidanceMaxBytes
    ) {
      continue;
    }

    const targetUrl = imageTargetUrl(context, target);
    return [
      report(
        context,
        "http-header",
        "Social image size is outside guidance",
        `${entry.kind} target '${targetUrl}' is ${bytes} bytes, above guidance ${socialImageSizeGuidanceMaxBytes} bytes.`,
        {
          expected: `<= ${socialImageSizeGuidanceMaxBytes} bytes`,
          actual: `${bytes} bytes`,
          structuredEvidence: [
            {
              type: "record",
              label: "social image size",
              value: {
                imageKind: entry.kind,
                imageUrl: entry.url,
                imageSource: entry.source,
                targetUrl,
                sizeBytes: bytes,
                policyMaxBytes: socialImageSizeGuidanceMaxBytes
              }
            }
          ]
        }
      )
    ];
  }

  return [];
}

function unsupportedSocialImageType(
  context: RuleContext
): readonly RuleReport[] {
  for (const entry of socialImageEntries(context)) {
    const target = resolvedImageTarget(context, entry.url);
    const type = target ? contentType(target) : undefined;
    if (!target || type === undefined || supportedSocialImageType(type)) {
      continue;
    }

    const targetUrl = imageTargetUrl(context, target);
    return [
      report(
        context,
        "http-header",
        "Social image content type is unsupported",
        `${entry.kind} target '${targetUrl}' returned unsupported content type '${type}'.`,
        {
          expected: "image/jpeg, image/png, image/gif, or image/webp",
          actual: type,
          structuredEvidence: [
            {
              type: "record",
              label: "social image content type",
              value: {
                imageKind: entry.kind,
                imageUrl: entry.url,
                imageSource: entry.source,
                targetUrl,
                contentType: type
              }
            }
          ]
        }
      )
    ];
  }

  return [];
}

function missingOgImageDimensions(context: RuleContext): readonly RuleReport[] {
  const hasImage = hasAnyMeta(context, "og:image");
  if (!hasImage) {
    return [];
  }

  if (
    hasAnyMeta(context, "og:image:width") &&
    hasAnyMeta(context, "og:image:height")
  ) {
    return [];
  }

  return [
    report(
      context,
      "raw-html",
      "Open Graph image dimensions are missing",
      "og:image exists but og:image:width or og:image:height metadata is missing."
    )
  ];
}

function nextImageUnoptimizedIndexable(
  context: RuleContext
): readonly RuleReport[] {
  if (!context.routeContract?.indexable) {
    return [];
  }

  const currentRoute = route(context);
  const finding = sourceFindings(context).find(
    (candidate) =>
      candidate.kind === "next-image-unoptimized" &&
      sourceRouteApplies(candidate.route, currentRoute)
  );
  if (!finding) {
    return [];
  }

  return [
    report(
      context,
      "source-code",
      "Next.js image is configured unoptimized",
      `Route '${context.routeContract.route}' is indexable but source file '${finding.file}' contains a Next.js Image with the boolean unoptimized prop.`,
      {
        expected:
          "optimized Next.js image or documented route policy allowance",
        actual: "unoptimized Next.js Image",
        sourceLocation: finding.location,
        structuredEvidence: [
          {
            type: "record",
            label: "next image unoptimized usage",
            value: {
              route: context.routeContract.route,
              file: finding.file,
              line: finding.location.line ?? null,
              locationConfidence: finding.location.confidence
            }
          }
        ]
      }
    )
  ];
}

function requiredSchemaTypes(context: RuleContext): readonly string[] {
  return (context.routeContract?.requiredSchemas ?? [])
    .map((type) => type.trim())
    .filter(Boolean);
}

function parsedSchemaTypeSet(context: RuleContext): ReadonlySet<string> {
  return new Set(
    htmlDocuments(context)
      .flatMap((document) => parsedJsonLd(document.html))
      .flatMap((node) => schemaTypes(node))
      .map((type) => type.toLowerCase())
  );
}

function schemaTypeState(context: RuleContext): {
  required: readonly string[];
  observed: readonly string[];
} {
  const observed = [...parsedSchemaTypeSet(context)].sort();
  return {
    required: requiredSchemaTypes(context),
    observed
  };
}

function hasRequiredSchemaType(context: RuleContext): boolean {
  const required = requiredSchemaTypes(context).map((type) =>
    type.toLowerCase()
  );
  if (required.length === 0) {
    return true;
  }

  const observed = parsedSchemaTypeSet(context);
  return required.some((type) => observed.has(type));
}

function missingRequiredSchema(context: RuleContext): readonly RuleReport[] {
  const required = requiredSchemaTypes(context);
  if (required.length === 0 || parsedSchemaTypeSet(context).size > 0) {
    return [];
  }

  return [
    report(
      context,
      "raw-html",
      "Required schema is missing",
      `Route '${route(context) ?? context.snapshot.pageUrl}' requires schema types '${required.join(", ")}' but no parsed JSON-LD schema types were found.`,
      {
        expected: required.join(", "),
        actual: "no parsed JSON-LD schema types",
        structuredEvidence: [
          {
            type: "record",
            label: "route schema requirement",
            value: {
              route: route(context) ?? null,
              requiredSchemas: required.join(", ")
            }
          },
          {
            type: "record",
            label: "json-ld schema state",
            value: {
              observedTypes: null
            }
          }
        ]
      }
    )
  ];
}

function schemaTypeMismatch(context: RuleContext): readonly RuleReport[] {
  const state = schemaTypeState(context);
  if (
    state.required.length === 0 ||
    state.observed.length === 0 ||
    hasRequiredSchemaType(context)
  ) {
    return [];
  }

  return [
    report(
      context,
      "raw-html",
      "Schema type does not match route contract",
      `Route '${route(context) ?? context.snapshot.pageUrl}' requires schema types '${state.required.join(", ")}' but parsed JSON-LD types are '${state.observed.join(", ")}'.`,
      {
        expected: state.required.join(", "),
        actual: state.observed.join(", "),
        structuredEvidence: [
          {
            type: "record",
            label: "route schema requirement",
            value: {
              route: route(context) ?? null,
              requiredSchemas: state.required.join(", ")
            }
          },
          {
            type: "record",
            label: "json-ld schema types",
            value: {
              observedTypes: state.observed.join(", ")
            }
          }
        ]
      }
    )
  ];
}

function schemaUrlEntries(
  node: unknown
): readonly { field: "url" | "mainEntityOfPage"; value: string }[] {
  if (Array.isArray(node)) {
    return node.flatMap((item) => schemaUrlEntries(item));
  }

  if (!node || typeof node !== "object") {
    return [];
  }

  const record = node as Record<string, unknown>;
  const entries: { field: "url" | "mainEntityOfPage"; value: string }[] = [];
  for (const field of ["url", "mainEntityOfPage"] as const) {
    const value = record[field];
    if (typeof value === "string") {
      entries.push({ field, value });
    } else if (value && typeof value === "object") {
      const nested = value as Record<string, unknown>;
      if (typeof nested["@id"] === "string") {
        entries.push({ field, value: nested["@id"] });
      } else if (typeof nested.url === "string") {
        entries.push({ field, value: nested.url });
      }
    }
  }

  return [...entries, ...schemaUrlEntries(record["@graph"])];
}

function schemaUrlConflictsPage(context: RuleContext): readonly RuleReport[] {
  const canonical =
    canonicalEntries(context)[0]?.href ?? context.snapshot.pageUrl;
  const expected = parseUrlAgainstPage(canonical, context);
  if (!expected) {
    return [];
  }

  for (const document of htmlDocuments(context)) {
    for (const node of parsedJsonLd(document.html)) {
      for (const entry of schemaUrlEntries(node)) {
        const actual = parseUrlAgainstPage(entry.value, context);
        if (!actual || actual.href === expected.href) {
          continue;
        }

        return [
          report(
            context,
            document.source,
            "Schema URL conflicts with page URL",
            `JSON-LD '${entry.field}' value '${actual.href}' conflicts with expected page entity URL '${expected.href}'.`,
            {
              expected: expected.href,
              actual: actual.href,
              structuredEvidence: [
                {
                  type: "record",
                  label: "schema url conflict",
                  value: {
                    field: entry.field,
                    schemaUrl: actual.href,
                    expectedUrl: expected.href,
                    pageUrl: context.snapshot.pageUrl,
                    canonicalUrl: canonical
                  }
                }
              ]
            }
          )
        ];
      }
    }
  }

  return [];
}

function invalidJsonLd(context: RuleContext): readonly RuleReport[] {
  for (const document of htmlDocuments(context)) {
    for (const script of jsonLdScripts(document.html)) {
      try {
        JSON.parse(script);
      } catch {
        return [
          report(
            context,
            document.source,
            "Invalid JSON-LD",
            "A JSON-LD script could not be parsed as JSON."
          )
        ];
      }
    }
  }

  return [];
}

function productSchemaMissingOffers(
  context: RuleContext
): readonly RuleReport[] {
  for (const document of htmlDocuments(context)) {
    for (const node of parsedJsonLd(document.html)) {
      const types = schemaTypes(node).map((type) => type.toLowerCase());
      if (types.includes("product")) {
        const record = node as Record<string, unknown>;
        if (!("offers" in record)) {
          return [
            report(
              context,
              document.source,
              "Product schema is missing offers",
              "Product JSON-LD exists but has no offers property."
            )
          ];
        }
      }
    }
  }

  return [];
}

function articleSchemaMissingDate(context: RuleContext): readonly RuleReport[] {
  for (const document of htmlDocuments(context)) {
    for (const node of parsedJsonLd(document.html)) {
      const types = schemaTypes(node).map((type) => type.toLowerCase());
      if (types.includes("article") || types.includes("newsarticle")) {
        const record = node as Record<string, unknown>;
        if (!("datePublished" in record) && !("dateModified" in record)) {
          return [
            report(
              context,
              document.source,
              "Article schema is missing date",
              "Article JSON-LD exists but has no datePublished or dateModified property."
            )
          ];
        }
      }
    }
  }

  return [];
}

function breadcrumbSchemaIncomplete(
  context: RuleContext
): readonly RuleReport[] {
  for (const document of htmlDocuments(context)) {
    for (const node of parsedJsonLd(document.html)) {
      const types = schemaTypes(node).map((type) => type.toLowerCase());
      if (!types.includes("breadcrumblist")) {
        continue;
      }
      const itemListElement = (node as Record<string, unknown>)[
        "itemListElement"
      ];
      if (!Array.isArray(itemListElement) || itemListElement.length === 0) {
        return [
          report(
            context,
            document.source,
            "Breadcrumb schema is incomplete",
            "BreadcrumbList JSON-LD has no itemListElement entries."
          )
        ];
      }
    }
  }

  return [];
}

function duplicateJsonLdNode(context: RuleContext): readonly RuleReport[] {
  for (const document of htmlDocuments(context)) {
    const seen = new Set<string>();
    for (const node of parsedJsonLd(document.html)) {
      const key = JSON.stringify(node);
      if (seen.has(key)) {
        return [
          report(
            context,
            document.source,
            "Duplicate JSON-LD node",
            "The same JSON-LD node appears more than once."
          )
        ];
      }
      seen.add(key);
    }
  }

  return [];
}

function requiredSchemaRenderedOnly(
  context: RuleContext
): readonly RuleReport[] {
  if (!context.snapshot.rawHtml || !context.snapshot.renderedDom) {
    return [];
  }

  if (
    jsonLdScripts(context.snapshot.rawHtml).length > 0 ||
    jsonLdScripts(context.snapshot.renderedDom).length === 0
  ) {
    return [];
  }

  return [
    report(
      context,
      "rendered-dom",
      "Schema appears only after rendering",
      "Rendered DOM contains JSON-LD but initial raw HTML does not."
    )
  ];
}

function googleRichResultUnavailable(
  context: RuleContext
): readonly RuleReport[] {
  const requirement = context.routeContract?.googleRichResult;
  if (!requirement?.required) {
    return [];
  }

  const observation = (context.snapshot.externalObservations ?? []).find(
    (item) => item.provider === "google" && item.richResults
  );
  if (!observation || observation.richResults?.available !== false) {
    return [];
  }

  const eligibleTypes = observation.richResults.eligibleTypes?.join(", ");
  const requiredTypes = requirement.eligibleTypes?.join(", ");

  return [
    report(
      context,
      "google",
      "Google rich result is unavailable",
      `Route contract requires Google rich-result availability, but Google observation state '${observation.richResults.state ?? "unavailable"}' reports unavailable with observedAt '${observation.observedAt}' and fetchedAt '${observation.fetchedAt}'.`,
      {
        expected: "Google rich result available",
        actual: observation.richResults.state ?? "unavailable",
        structuredEvidence: [
          {
            type: "record",
            label: "route contract rich result requirement",
            value: {
              route: route(context) ?? null,
              required: true,
              eligibleTypes: requiredTypes ?? null
            }
          },
          {
            type: "record",
            label: "google rich result observation",
            value: {
              provider: "google",
              available: false,
              state: observation.richResults.state ?? null,
              eligibleTypes: eligibleTypes ?? null,
              observedAt: observation.observedAt,
              fetchedAt: observation.fetchedAt,
              freshness: observation.freshness,
              quotaLimit: observation.quota?.limit ?? null,
              quotaRemaining: observation.quota?.remaining ?? null,
              quotaResetAt: observation.quota?.resetAt ?? null
            }
          }
        ]
      }
    )
  ];
}

function graphForSiteDiagnostic(context: RuleContext) {
  const graph = context.snapshot.siteGraph;
  if (!graph || graph.pages.length === 0) {
    return undefined;
  }

  return sameUrl(context.snapshot.pageUrl, graph.pages[0]!.url)
    ? graph
    : undefined;
}

function absoluteUrl(value: string): string | undefined {
  return parseAbsoluteUrlDetails(value)?.href;
}

function parseAbsoluteUrlDetails(
  value: string
):
  | { href: string; origin: string; pathname: string; search: string }
  | undefined {
  const match = value.match(/^(https?:)\/\/([^/?#]+)([^?#]*)(\?[^#]*)?/i);
  if (!match) {
    return undefined;
  }

  return {
    href: value,
    origin: `${match[1]}//${match[2]}`,
    pathname: match[3] && match[3].length > 0 ? match[3] : "/",
    search: match[4] ?? ""
  };
}

function sameUrl(left: string, right: string): boolean {
  return absoluteUrl(left) === absoluteUrl(right);
}

function sameOrigin(left: string, right: string): boolean {
  const leftUrl = parseAbsoluteUrlDetails(left);
  const rightUrl = parseAbsoluteUrlDetails(right);
  return leftUrl !== undefined && leftUrl.origin === rightUrl?.origin;
}

function graphPageByUrl(
  graph: NonNullable<RuleContext["snapshot"]["siteGraph"]>,
  url: string
) {
  const expected = absoluteUrl(url);
  if (!expected) {
    return undefined;
  }

  return graph.pages.find((page) => {
    const pageUrl = absoluteUrl(page.url);
    const finalUrl = page.finalUrl ? absoluteUrl(page.finalUrl) : undefined;
    return pageUrl === expected || finalUrl === expected;
  });
}

function graphKnownUrls(
  graph: NonNullable<RuleContext["snapshot"]["siteGraph"]>
): ReadonlySet<string> {
  return new Set(
    [
      ...graph.pages.flatMap((page) => [page.url, page.finalUrl ?? ""]),
      ...graph.links.map((link) => link.targetUrl)
    ]
      .map((url) => absoluteUrl(url))
      .filter((url): url is string => Boolean(url))
  );
}

function brokenInternalLink(context: RuleContext): readonly RuleReport[] {
  const graph = graphForSiteDiagnostic(context);
  if (!graph) {
    return [];
  }

  return graph.links.flatMap((link) => {
    const target = graphPageByUrl(graph, link.targetUrl);
    if (!target || !nonSuccessStatus(target.statusCode)) {
      return [];
    }

    return [
      report(
        context,
        "crawler",
        "Internal link target is non-success",
        `Internal link from '${link.sourceUrl}' to '${link.targetUrl}' resolved with HTTP status ${target.statusCode}.`,
        {
          expected: "2xx HTTP status",
          actual: String(target.statusCode),
          structuredEvidence: [
            {
              type: "record",
              label: "internal link target",
              value: {
                sourceUrl: link.sourceUrl,
                targetUrl: link.targetUrl,
                finalStatusCode: target.statusCode ?? null
              }
            }
          ]
        }
      )
    ];
  });
}

function internalLinkRedirects(context: RuleContext): readonly RuleReport[] {
  const graph = graphForSiteDiagnostic(context);
  if (!graph) {
    return [];
  }

  return graph.links.flatMap((link) => {
    const target = graphPageByUrl(graph, link.targetUrl);
    const redirectChain = target?.redirectChain ?? [];
    if (!target || redirectChain.length === 0) {
      return [];
    }

    return [
      report(
        context,
        "crawler",
        "Internal link points through a redirect",
        `Internal link from '${link.sourceUrl}' to '${link.targetUrl}' has redirect chain '${redirectChain.join(" -> ")}'.`,
        {
          expected: "direct internal link target",
          actual: redirectChain.join(" -> "),
          structuredEvidence: [
            {
              type: "record",
              label: "internal link redirect",
              value: {
                sourceUrl: link.sourceUrl,
                targetUrl: link.targetUrl,
                redirectChain: redirectChain.join(" -> ")
              }
            }
          ]
        }
      )
    ];
  });
}

function orphanIndexablePage(context: RuleContext): readonly RuleReport[] {
  const graph = graphForSiteDiagnostic(context);
  if (!graph) {
    return [];
  }

  const startUrl = absoluteUrl(graph.pages[0]!.url);
  const linkedTargets = graphKnownUrls({ pages: [], links: graph.links });

  return graph.pages.flatMap((page) => {
    const pageUrl = absoluteUrl(page.url);
    if (
      !pageUrl ||
      pageUrl === startUrl ||
      page.indexable === false ||
      linkedTargets.has(pageUrl)
    ) {
      return [];
    }

    return [
      report(
        context,
        "crawler",
        "Indexable page has no incoming internal links",
        `Indexable page '${page.url}' is present in the crawl graph but has no incoming internal links.`,
        {
          expected: "at least one incoming internal link",
          actual: "0 incoming links",
          structuredEvidence: [
            {
              type: "record",
              label: "orphan indexable page",
              value: {
                pageUrl: page.url,
                crawlGraphPages: graph.pages.length,
                incomingLinks: 0
              }
            }
          ]
        }
      )
    ];
  });
}

function linkedNonindexablePage(context: RuleContext): readonly RuleReport[] {
  const graph = graphForSiteDiagnostic(context);
  if (!graph) {
    return [];
  }

  return graph.links.flatMap((link) => {
    const target = graphPageByUrl(graph, link.targetUrl);
    if (!target || target.indexable !== false) {
      return [];
    }

    return [
      report(
        context,
        "crawler",
        "Internal link targets a non-indexable page",
        `Internal link from '${link.sourceUrl}' targets non-indexable page '${link.targetUrl}'.`,
        {
          expected:
            "internal link target is indexable or intentionally allowed",
          actual: "non-indexable target",
          structuredEvidence: [
            {
              type: "record",
              label: "linked non-indexable target",
              value: {
                sourceUrl: link.sourceUrl,
                targetUrl: link.targetUrl,
                routeContract:
                  target.indexable === false ? "indexable=false" : null
              }
            }
          ]
        }
      )
    ];
  });
}

function excessiveInternalNofollow(
  context: RuleContext
): readonly RuleReport[] {
  const graph = graphForSiteDiagnostic(context);
  if (!graph) {
    return [];
  }

  const sameOriginLinks = graph.links.filter((link) =>
    sameOrigin(link.sourceUrl, link.targetUrl)
  );
  const nofollowLinks = sameOriginLinks.filter((link) =>
    splitDirectiveList(link.rel ?? "").includes("nofollow")
  );
  if (sameOriginLinks.length === 0 || nofollowLinks.length === 0) {
    return [];
  }

  const ratio = nofollowLinks.length / sameOriginLinks.length;
  const maxRatio = graph.internalNofollowPolicyMaxRatio;
  const maxCount = graph.internalNofollowPolicyMaxCount;
  const violatesRatio = maxRatio !== undefined && ratio > maxRatio;
  const violatesCount =
    maxCount !== undefined && nofollowLinks.length > maxCount;
  if (!violatesRatio && !violatesCount) {
    return [];
  }

  return [
    report(
      context,
      "crawler",
      "Internal nofollow usage exceeds policy",
      `${nofollowLinks.length} of ${sameOriginLinks.length} internal links use nofollow.`,
      {
        expected:
          maxRatio !== undefined
            ? `nofollow ratio <= ${maxRatio}`
            : `nofollow count <= ${maxCount}`,
        actual: `${nofollowLinks.length}/${sameOriginLinks.length}`,
        structuredEvidence: [
          {
            type: "record",
            label: "internal nofollow policy",
            value: {
              linkSample: nofollowLinks
                .slice(0, 5)
                .map((link) => `${link.sourceUrl} -> ${link.targetUrl}`)
                .join(", "),
              policyThreshold:
                maxRatio !== undefined
                  ? `ratio <= ${maxRatio}`
                  : `count <= ${maxCount}`,
              nofollowCount: nofollowLinks.length,
              internalLinkCount: sameOriginLinks.length
            }
          }
        ]
      }
    )
  ];
}

function paginatedSeriesLinksMissing(
  context: RuleContext
): readonly RuleReport[] {
  if (context.routeContract?.pagination?.required !== true) {
    return [];
  }

  const graphPage = context.snapshot.siteGraph?.pages.find((page) =>
    sameUrl(page.url, context.snapshot.pageUrl)
  );
  const pagination = graphPage?.pagination;
  if (pagination?.previousUrl || pagination?.nextUrl) {
    return [];
  }

  return [
    report(
      context,
      "crawler",
      "Paginated route is missing crawlable pagination links",
      `Route '${context.routeContract.route}' requires pagination links, but no previous or next link was observed.`,
      {
        expected: "crawlable previous or next pagination link",
        actual: "missing pagination links",
        structuredEvidence: [
          {
            type: "record",
            label: "pagination requirement",
            value: {
              route: context.routeContract.route,
              paginationLinks: "missing"
            }
          }
        ]
      }
    )
  ];
}

function importantPageExcessiveCrawlDepth(
  context: RuleContext
): readonly RuleReport[] {
  const graphPage = context.snapshot.siteGraph?.pages.find((page) =>
    sameUrl(page.url, context.snapshot.pageUrl)
  );
  const important =
    context.routeContract?.important === true || graphPage?.important === true;
  const maxDepth =
    context.routeContract?.crawlDepthPolicyMax ??
    graphPage?.crawlDepthPolicyMax;
  const crawlDepth = graphPage?.crawlDepth;

  if (
    !important ||
    maxDepth === undefined ||
    crawlDepth === undefined ||
    crawlDepth <= maxDepth
  ) {
    return [];
  }

  return [
    report(
      context,
      "crawler",
      "Important page exceeds crawl-depth policy",
      `Important page '${context.snapshot.pageUrl}' was observed at crawl depth ${crawlDepth}, above policy ${maxDepth}.`,
      {
        expected: `crawl depth <= ${maxDepth}`,
        actual: String(crawlDepth),
        structuredEvidence: [
          {
            type: "record",
            label: "important page crawl depth",
            value: {
              pageUrl: context.snapshot.pageUrl,
              crawlDepth,
              policyThreshold: maxDepth
            }
          }
        ]
      }
    )
  ];
}

function successfulGraphPages(
  context: RuleContext
): readonly { url: string; statusCode?: number }[] {
  const graph = graphForSiteDiagnostic(context);
  if (!graph) {
    return [];
  }

  return graph.pages.filter(
    (page) =>
      page.statusCode !== undefined && !nonSuccessStatus(page.statusCode)
  );
}

function trailingSlashDuplicate(context: RuleContext): readonly RuleReport[] {
  const groups = new Map<string, { url: string; statusCode?: number }[]>();

  for (const page of successfulGraphPages(context)) {
    const parsed = absoluteUrl(page.url);
    if (!parsed) {
      continue;
    }
    const url = parseAbsoluteUrlDetails(parsed)!;
    if (url.pathname === "/") {
      continue;
    }

    const key = `${url.origin}${url.pathname.replace(/\/+$/, "")}${url.search}`;
    const group = groups.get(key) ?? [];
    group.push(page);
    groups.set(key, group);
  }

  return [...groups.values()].flatMap((group) => {
    const withSlash = group.find((page) =>
      parseAbsoluteUrlDetails(page.url)?.pathname.endsWith("/")
    );
    const withoutSlash = group.find(
      (page) => !parseAbsoluteUrlDetails(page.url)?.pathname.endsWith("/")
    );
    if (!withSlash || !withoutSlash) {
      return [];
    }

    const variants = `${withoutSlash.url}, ${withSlash.url}`;
    return [
      report(
        context,
        "crawler",
        "Trailing-slash URL variants both return success",
        `Crawl graph contains successful trailing-slash variants '${variants}'.`,
        {
          expected: "one canonical URL variant",
          actual: variants,
          structuredEvidence: [
            {
              type: "record",
              label: "url variants",
              value: {
                variants,
                statusCodes: `${withoutSlash.statusCode}, ${withSlash.statusCode}`
              }
            }
          ]
        }
      )
    ];
  });
}

function caseVariantDuplicate(context: RuleContext): readonly RuleReport[] {
  const groups = new Map<string, { url: string; statusCode?: number }[]>();

  for (const page of successfulGraphPages(context)) {
    const parsed = absoluteUrl(page.url);
    if (!parsed) {
      continue;
    }
    const url = parseAbsoluteUrlDetails(parsed)!;
    const key = `${url.origin}${url.pathname.toLowerCase()}${url.search}`;
    const group = groups.get(key) ?? [];
    group.push(page);
    groups.set(key, group);
  }

  return [...groups.values()].flatMap((group) => {
    const pathVariants = new Set(
      group.map((page) => parseAbsoluteUrlDetails(page.url)?.pathname)
    );
    if (pathVariants.size < 2) {
      return [];
    }

    const variants = group.map((page) => page.url).join(", ");
    return [
      report(
        context,
        "crawler",
        "Path case URL variants both return success",
        `Crawl graph contains successful path case variants '${variants}'.`,
        {
          expected: "one canonical path casing",
          actual: variants,
          structuredEvidence: [
            {
              type: "record",
              label: "case variants",
              value: {
                variants,
                statusCodes: group
                  .map((page) => page.statusCode ?? "unknown")
                  .join(", ")
              }
            }
          ]
        }
      )
    ];
  });
}

function sitemapUrlNotLinked(context: RuleContext): readonly RuleReport[] {
  const graph = graphForSiteDiagnostic(context);
  if (!graph) {
    return [];
  }

  const knownUrls = graphKnownUrls(graph);
  return sitemapLocEntries(context).flatMap((entry) => {
    const url = absoluteUrl(entry);
    if (!url || knownUrls.has(url)) {
      return [];
    }

    return [
      report(
        context,
        "crawler",
        "Sitemap URL is not present in crawl graph",
        `Sitemap URL '${url}' is not present as a crawled page or internal link target in the crawl graph.`,
        {
          expected: "sitemap URL present in crawl graph",
          actual: "missing from crawl graph",
          structuredEvidence: [
            {
              type: "record",
              label: "sitemap graph entry",
              value: {
                sitemapEntry: url,
                crawledPages: graph.pages.length,
                crawlLinks: graph.links.length
              }
            }
          ]
        }
      )
    ];
  });
}

function canonicalTargetNotLinked(context: RuleContext): readonly RuleReport[] {
  const graph = graphForSiteDiagnostic(context);
  if (!graph) {
    return [];
  }

  const knownUrls = graphKnownUrls(graph);
  return graph.pages.flatMap((page) => {
    const canonicalUrl = page.canonicalUrl
      ? absoluteUrl(page.canonicalUrl)
      : undefined;
    if (
      !canonicalUrl ||
      !sameOrigin(page.url, canonicalUrl) ||
      knownUrls.has(canonicalUrl)
    ) {
      return [];
    }

    return [
      report(
        context,
        "crawler",
        "Canonical target is not present in crawl graph",
        `Canonical target '${canonicalUrl}' declared by '${page.url}' is not present as a crawled page or internal link target.`,
        {
          expected: "canonical target present in crawl graph",
          actual: "missing from crawl graph",
          structuredEvidence: [
            {
              type: "record",
              label: "canonical graph target",
              value: {
                pageUrl: page.url,
                canonicalUrl,
                crawledPages: graph.pages.length,
                crawlLinks: graph.links.length
              }
            }
          ]
        }
      )
    ];
  });
}

function invalidAnchorHref(context: RuleContext): readonly RuleReport[] {
  const html = renderedHtml(context);
  if (!html) {
    return [];
  }

  const invalid = anchorTags(html).find((anchor) => {
    const href = attributeValue(anchor.tag, "href");
    return (
      href === undefined || href.trim().length === 0 || href.trim() === "#"
    );
  });
  if (!invalid) {
    return [];
  }

  return [
    report(
      context,
      "rendered-dom",
      "Rendered link has an invalid href",
      "Rendered DOM contains an anchor with missing, empty, or placeholder href."
    )
  ];
}

function emptyLinkText(context: RuleContext): readonly RuleReport[] {
  const html = renderedHtml(context);
  if (!html) {
    return [];
  }

  const empty = anchorTags(html).find((anchor) => anchor.text.length === 0);
  if (!empty) {
    return [];
  }

  return [
    report(
      context,
      "rendered-dom",
      "Rendered link has empty text",
      "Rendered DOM contains an anchor with no text content."
    )
  ];
}

function externalTargetBlankMissingRel(
  context: RuleContext
): readonly RuleReport[] {
  const html = renderedHtml(context);
  if (!html) {
    return [];
  }

  const offending = anchorTags(html).find((anchor) => {
    const href = attributeValue(anchor.tag, "href") ?? "";
    const target = attributeValue(anchor.tag, "target")?.toLowerCase();
    const rel = (attributeValue(anchor.tag, "rel") ?? "").toLowerCase();
    return (
      /^https?:\/\//i.test(href) &&
      target === "_blank" &&
      (!rel.includes("noopener") || !rel.includes("noreferrer"))
    );
  });

  if (!offending) {
    return [];
  }

  return [
    report(
      context,
      "rendered-dom",
      "External target blank link is missing safe rel",
      "Rendered DOM contains an external target=_blank link without noopener and noreferrer."
    )
  ];
}

function robotsLines(context: RuleContext): readonly string[] {
  return (context.snapshot.robotsTxt?.body ?? "").split(/\r?\n/);
}

function robotsSitemapDirectives(context: RuleContext): readonly string[] {
  return robotsLines(context)
    .map((line) => line.trim())
    .filter((line) => /^sitemap\s*:/i.test(line))
    .map((line) => line.replace(/^sitemap\s*:/i, "").trim())
    .filter(Boolean);
}

function sitemapLocEntries(context: RuleContext): readonly string[] {
  const body = context.snapshot.sitemap?.body;
  if (!body) {
    return [];
  }

  return [...body.matchAll(/<loc>([^<]+)<\/loc>/gi)]
    .map((match) => (match[1] ?? "").trim())
    .filter(Boolean);
}

function sitemapEntryForPage(context: RuleContext): string | undefined {
  const page = parseUrlAgainstPage(context.snapshot.pageUrl, context);
  if (!page) {
    return undefined;
  }

  return sitemapLocEntries(context).find((entry) => {
    const parsed = parseUrlAgainstPage(entry, context);
    return parsed?.href === page.href;
  });
}

function robotsStarRules(
  context: RuleContext
): readonly { directive: "allow" | "disallow"; path: string; line: string }[] {
  const rules: {
    directive: "allow" | "disallow";
    path: string;
    line: string;
  }[] = [];
  let appliesToStar = false;

  for (const line of robotsLines(context)) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith("#")) {
      continue;
    }

    const userAgent = trimmed.match(/^user-agent\s*:\s*(.+)$/i)?.[1]?.trim();
    if (userAgent !== undefined) {
      appliesToStar = userAgent === "*";
      continue;
    }

    if (!appliesToStar) {
      continue;
    }

    const match = trimmed.match(/^(allow|disallow)\s*:\s*(.*)$/i);
    if (!match) {
      continue;
    }

    const path = (match[2] ?? "").trim();
    if (path.length === 0) {
      continue;
    }

    rules.push({
      directive: match[1]!.toLowerCase() as "allow" | "disallow",
      path,
      line: trimmed
    });
  }

  return rules;
}

function robotsRuleForPage(
  context: RuleContext
): { directive: "allow" | "disallow"; path: string; line: string } | undefined {
  const page = parseUrlAgainstPage(context.snapshot.pageUrl, context);
  if (!page) {
    return undefined;
  }

  const path = page.pathname;
  return robotsStarRules(context)
    .filter((rule) => path.startsWith(rule.path))
    .sort((a, b) => b.path.length - a.path.length)[0];
}

function robotsRuleForUrl(
  context: RuleContext,
  url: string
): { directive: "allow" | "disallow"; path: string; line: string } | undefined {
  const parsed = parseUrlAgainstPage(url, context);
  if (!parsed) {
    return undefined;
  }

  return robotsStarRules(context)
    .filter((rule) => parsed.pathname.startsWith(rule.path))
    .sort((a, b) => b.path.length - a.path.length)[0];
}

function robotsTxtUnavailable(context: RuleContext): readonly RuleReport[] {
  const artifact = context.snapshot.robotsTxt;
  if (!artifact || artifact.statusCode === undefined) {
    return [];
  }

  if (artifact.statusCode >= 200 && artifact.statusCode < 300) {
    return [];
  }

  return [
    report(
      context,
      "robots-txt",
      "robots.txt is unavailable",
      `robots.txt URL '${artifact.url}' returned HTTP ${artifact.statusCode}.`,
      {
        expected: "2xx HTTP status",
        actual: String(artifact.statusCode)
      }
    )
  ];
}

function robotsSyntaxError(context: RuleContext): readonly RuleReport[] {
  if (!context.snapshot.robotsTxt?.body) {
    return [];
  }

  const allowed = /^(user-agent|allow|disallow|sitemap|crawl-delay|host)\s*:/i;
  const invalidLine = robotsLines(context).find((line) => {
    const trimmed = line.trim();
    return (
      trimmed.length > 0 && !trimmed.startsWith("#") && !allowed.test(trimmed)
    );
  });

  if (!invalidLine) {
    return [];
  }

  return [
    report(
      context,
      "robots-txt",
      "robots.txt contains a syntax error",
      `Unrecognized robots.txt directive '${invalidLine.trim()}'.`,
      {
        actual: invalidLine.trim()
      }
    )
  ];
}

function robotsDisallowsSitemapUrl(
  context: RuleContext
): readonly RuleReport[] {
  const sitemapEntry = sitemapEntryForPage(context);
  const matchedRule = robotsRuleForPage(context);
  if (!sitemapEntry || matchedRule?.directive !== "disallow") {
    return [];
  }

  return [
    report(
      context,
      "robots-txt",
      "robots.txt disallows sitemap URL",
      `Sitemap lists '${sitemapEntry}', but robots.txt rule '${matchedRule.line}' disallows the current page URL '${context.snapshot.pageUrl}'.`,
      {
        expected: "sitemap URL allowed by robots.txt",
        actual: matchedRule.line,
        structuredEvidence: [
          {
            type: "record",
            label: "robots sitemap conflict",
            value: {
              pageUrl: context.snapshot.pageUrl,
              sitemapEntry,
              robotsRule: matchedRule.line
            }
          }
        ]
      }
    )
  ];
}

function sitemapMissing(context: RuleContext): readonly RuleReport[] {
  if (context.snapshot.sitemap || robotsSitemapDirectives(context).length > 0) {
    return [];
  }

  if (sourceFinding(context, "sitemap-file")) {
    return [];
  }

  if (!context.snapshot.robotsTxt?.body) {
    return [];
  }

  return [
    report(
      context,
      "robots-txt",
      "Sitemap is missing",
      "robots.txt was available but no Sitemap directive or sitemap artifact was found."
    )
  ];
}

function sitemapNonSuccess(context: RuleContext): readonly RuleReport[] {
  const sitemap = context.snapshot.sitemap;
  if (!sitemap || sitemap.statusCode === undefined) {
    return [];
  }

  if (sitemap.statusCode >= 200 && sitemap.statusCode < 300) {
    return [];
  }

  return [
    report(
      context,
      "sitemap",
      "Sitemap returned a non-success HTTP status",
      `Sitemap URL '${sitemap.url}' returned HTTP ${sitemap.statusCode}.`,
      {
        expected: "2xx HTTP status",
        actual: String(sitemap.statusCode)
      }
    )
  ];
}

function sitemapInvalidXml(context: RuleContext): readonly RuleReport[] {
  const body = context.snapshot.sitemap?.body;
  if (!body) {
    return [];
  }

  const trimmed = body.trim();
  const hasRoot =
    /^<\?xml[\s\S]*<urlset[\s>]/i.test(trimmed) ||
    /^<urlset[\s>]/i.test(trimmed) ||
    /^<\?xml[\s\S]*<sitemapindex[\s>]/i.test(trimmed) ||
    /^<sitemapindex[\s>]/i.test(trimmed);
  const hasClosingRoot =
    /<\/urlset>\s*$/i.test(trimmed) || /<\/sitemapindex>\s*$/i.test(trimmed);

  if (hasRoot && hasClosingRoot) {
    return [];
  }

  return [
    report(
      context,
      "sitemap",
      "Sitemap XML is invalid",
      "Sitemap body does not contain a complete urlset or sitemapindex root."
    )
  ];
}

function sitemapUrlNonSuccess(context: RuleContext): readonly RuleReport[] {
  const graph = graphForSiteDiagnostic(context);
  if (!graph) {
    return [];
  }

  return sitemapLocEntries(context).flatMap((entry) => {
    const page = graphPageByUrl(graph, entry);
    if (!page || !nonSuccessStatus(page.statusCode)) {
      return [];
    }

    return [
      report(
        context,
        "sitemap",
        "Sitemap URL returned a non-success HTTP status",
        `Sitemap entry '${entry}' resolved with HTTP status ${page.statusCode}.`,
        {
          expected: "2xx HTTP status",
          actual: String(page.statusCode),
          structuredEvidence: [
            {
              type: "record",
              label: "sitemap URL status",
              value: {
                sitemapEntry: entry,
                finalStatusCode: page.statusCode ?? null
              }
            }
          ]
        }
      )
    ];
  });
}

function sitemapCanonicalMismatch(context: RuleContext): readonly RuleReport[] {
  const sitemapEntry = sitemapEntryForPage(context);
  const canonical = canonicalEntries(context)[0];
  if (!sitemapEntry || !canonical) {
    return [];
  }

  const sitemapUrl = parseUrlAgainstPage(sitemapEntry, context);
  const canonicalUrl = parseUrlAgainstPage(canonical.href, context);
  if (!sitemapUrl || !canonicalUrl || sitemapUrl.href === canonicalUrl.href) {
    return [];
  }

  return [
    report(
      context,
      canonical.source,
      "Sitemap URL canonicalizes elsewhere",
      `Sitemap entry '${sitemapUrl.href}' declares canonical '${canonicalUrl.href}' from ${canonical.source}.`,
      {
        expected: sitemapUrl.href,
        actual: canonicalUrl.href,
        structuredEvidence: [
          {
            type: "record",
            label: "sitemap canonical mismatch",
            value: {
              pageUrl: context.snapshot.pageUrl,
              sitemapEntry: sitemapUrl.href,
              canonicalUrl: canonicalUrl.href,
              canonicalSource: canonical.source
            }
          }
        ]
      }
    )
  ];
}

function robotsMissingSitemapDirective(
  context: RuleContext
): readonly RuleReport[] {
  if (!context.snapshot.robotsTxt?.body) {
    return [];
  }

  if (robotsSitemapDirectives(context).length > 0) {
    return [];
  }

  const sitemapSource = sourceFinding(context, "sitemap-file");
  return [
    report(
      context,
      sitemapSource ? "source-code" : "robots-txt",
      "robots.txt is missing a Sitemap directive",
      sitemapSource
        ? "robots.txt contains no Sitemap directive, while a Next.js sitemap source file exists."
        : "robots.txt contains no Sitemap directive.",
      sitemapSource ? { sourceLocation: sitemapSource.location } : {}
    )
  ];
}

function sitemapLastmodFuture(context: RuleContext): readonly RuleReport[] {
  const body = context.snapshot.sitemap?.body;
  if (!body) {
    return [];
  }

  const nowDate = context.now.slice(0, 10);
  const future = [...body.matchAll(/<lastmod>([^<]+)<\/lastmod>/gi)]
    .map((match) => (match[1] ?? "").trim().slice(0, 10))
    .find((date) => /^\d{4}-\d{2}-\d{2}$/.test(date) && date > nowDate);

  if (!future) {
    return [];
  }

  return [
    report(
      context,
      "sitemap",
      "Sitemap lastmod is in the future",
      `Sitemap contains future lastmod '${future}' relative to '${nowDate}'.`,
      {
        actual: future
      }
    )
  ];
}

function htmlSizeOverGuidance(context: RuleContext): readonly RuleReport[] {
  const html = context.snapshot.rawHtml;
  if (!html) {
    return [];
  }

  const bytes = utf8ByteLength(html);
  const guidanceBytes = 500_000;
  if (bytes <= guidanceBytes) {
    return [];
  }

  return [
    report(
      context,
      "raw-html",
      "HTML size is over guidance",
      `Raw HTML size is ${bytes} bytes, above guidance of ${guidanceBytes} bytes.`,
      {
        expected: `<= ${guidanceBytes} bytes`,
        actual: `${bytes} bytes`
      }
    )
  ];
}

function googleWebVitalPoor(
  context: RuleContext,
  metricKey: "lcp" | "cls" | "inp",
  metricLabel: "LCP" | "CLS" | "INP"
): readonly RuleReport[] {
  const observation = (context.snapshot.externalObservations ?? []).find(
    (item) => item.provider === "google" && item.webVitals?.[metricKey]
  );
  const metric = observation?.webVitals?.[metricKey];
  if (!observation || !metric || !isPoorMetric(metric)) {
    return [];
  }

  const value = metric.value;
  const valueText = value === undefined ? "unknown" : `${value}${metric.unit}`;
  const thresholdText =
    metric.poorThreshold === undefined
      ? "provider poor rating"
      : `${metric.poorThreshold}${metric.unit}`;

  return [
    report(
      context,
      "google",
      `Google reports poor ${metricLabel}`,
      `Google ${metric.dataSource} observation reports ${metricLabel} '${valueText}' as poor with observedAt '${observation.observedAt}' and fetchedAt '${observation.fetchedAt}'.`,
      {
        expected:
          metric.poorThreshold !== undefined
            ? `<= ${thresholdText}`
            : "not poor provider rating",
        actual: valueText,
        structuredEvidence: [
          {
            type: "record",
            label: `google ${metricLabel} observation`,
            value: {
              provider: "google",
              metric: metricLabel,
              value: value ?? null,
              unit: metric.unit,
              dataSource: metric.dataSource,
              rating: metric.rating ?? null,
              poorThreshold: metric.poorThreshold ?? null,
              observedAt: observation.observedAt,
              fetchedAt: observation.fetchedAt,
              freshness: observation.freshness
            }
          }
        ]
      }
    )
  ];
}

function isPoorMetric(metric: GoogleWebVitalMetric): boolean {
  if (metric.rating === "poor") {
    return true;
  }

  return (
    metric.value !== undefined &&
    metric.poorThreshold !== undefined &&
    metric.value > metric.poorThreshold
  );
}

function googleLcpPoor(context: RuleContext): readonly RuleReport[] {
  return googleWebVitalPoor(context, "lcp", "LCP");
}

function googleClsPoor(context: RuleContext): readonly RuleReport[] {
  return googleWebVitalPoor(context, "cls", "CLS");
}

function googleInpPoor(context: RuleContext): readonly RuleReport[] {
  return googleWebVitalPoor(context, "inp", "INP");
}

function metadataRenderDelayOverPolicy(
  context: RuleContext
): readonly RuleReport[] {
  const timing = context.snapshot.metadataTiming;
  if (!timing || timing.availableAtMs <= timing.policyMaxMs) {
    return [];
  }

  return [
    report(
      context,
      "rendered-dom",
      "Metadata availability exceeded timing policy",
      `Required metadata became available after ${timing.availableAtMs}ms, above policy ${timing.policyMaxMs}ms.`,
      {
        expected: `<= ${timing.policyMaxMs}ms`,
        actual: `${timing.availableAtMs}ms`,
        structuredEvidence: [
          {
            type: "record",
            label: "metadata timing",
            value: {
              metadataTiming: timing.availableAtMs,
              policyThreshold: timing.policyMaxMs
            }
          }
        ]
      }
    )
  ];
}

function externalObservationSampled(
  context: RuleContext
): readonly RuleReport[] {
  return (context.snapshot.externalObservations ?? []).flatMap(
    (observation) => {
      if (observation.sampling?.sampled !== true) {
        return [];
      }

      const samplingState = observation.sampling.state ?? "sampled";
      return [
        report(
          context,
          observation.provider,
          "External observation is sampled",
          `${observation.provider} observation is '${samplingState}' with observedAt '${observation.observedAt}' and fetchedAt '${observation.fetchedAt}'.`,
          {
            actual: samplingState,
            structuredEvidence: [
              {
                type: "record",
                label: "external observation sampling",
                value: {
                  provider: observation.provider,
                  samplingState,
                  observedAt: observation.observedAt,
                  fetchedAt: observation.fetchedAt,
                  freshness: observation.freshness
                }
              }
            ]
          }
        )
      ];
    }
  );
}

function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (codePoint <= 0x7f) {
      bytes += 1;
    } else if (codePoint <= 0x7ff) {
      bytes += 2;
    } else if (codePoint <= 0xffff) {
      bytes += 3;
    } else {
      bytes += 4;
    }
  }
  return bytes;
}

function missingCanonical(context: RuleContext): readonly RuleReport[] {
  const documents = htmlDocuments(context);
  if (documents.length === 0 || canonicalEntries(context).length > 0) {
    return [];
  }

  return [
    report(
      context,
      documents[0]?.source ?? "raw-html",
      "Route is missing canonical",
      "Raw HTML or rendered DOM was available but no canonical link was found."
    )
  ];
}

function multipleCanonicals(context: RuleContext): readonly RuleReport[] {
  const entries = canonicalEntries(context);
  const violatingSource = ["http-header", "raw-html", "rendered-dom"].find(
    (source) => entries.filter((entry) => entry.source === source).length > 1
  );
  if (!violatingSource) {
    return [];
  }

  const violatingEntries = entries.filter(
    (entry) => entry.source === violatingSource
  );

  return [
    report(
      context,
      violatingEntries[0]?.source ?? "raw-html",
      "Route has multiple canonicals",
      `Found ${violatingEntries.length} canonical declarations in ${violatingSource}: ${violatingEntries.map((entry) => entry.href).join(", ")}.`,
      {
        actual: violatingEntries.map((entry) => entry.href).join(", ")
      }
    )
  ];
}

function selfCanonicalExpected(context: RuleContext): readonly RuleReport[] {
  if (context.routeContract?.canonicalPolicy !== "self") {
    return [];
  }

  const entry = canonicalEntries(context)[0];
  if (!entry) {
    return [];
  }

  const canonical = parseUrlAgainstPage(entry.href, context);
  const page = parseUrlAgainstPage(context.snapshot.pageUrl, context);
  if (!canonical || !page || canonical.href === page.href) {
    return [];
  }

  return [
    report(
      context,
      entry.source,
      "Self canonical route points elsewhere",
      `Route '${context.routeContract.route}' requires self canonical '${page.href}', but declared canonical is '${canonical.href}'.`,
      {
        expected: page.href,
        actual: canonical.href,
        structuredEvidence: [
          {
            type: "record",
            label: "self canonical policy",
            value: {
              route: context.routeContract.route,
              canonicalPolicy: "self",
              pageUrl: page.href,
              canonicalUrl: canonical.href,
              canonicalSource: entry.source
            }
          }
        ]
      }
    )
  ];
}

function nonSuccessStatus(statusCode: number | undefined): boolean {
  return statusCode !== undefined && (statusCode < 200 || statusCode >= 300);
}

function canonicalLoop(context: RuleContext): readonly RuleReport[] {
  const graph = graphForSiteDiagnostic(context);
  if (!graph) {
    return [];
  }

  const reportedCycles = new Set<string>();
  const reports: RuleReport[] = [];

  for (const page of graph.pages) {
    const start = absoluteUrl(page.url);
    if (!start) {
      continue;
    }

    const path: string[] = [];
    const seen = new Map<string, number>();
    let current: string | undefined = start;

    while (current) {
      const seenAt = seen.get(current);
      if (seenAt !== undefined) {
        const cycle = path.slice(seenAt);
        if (cycle.length > 1) {
          const cycleKey = [...cycle].sort().join("|");
          if (!reportedCycles.has(cycleKey)) {
            reportedCycles.add(cycleKey);
            reports.push(
              report(
                context,
                "crawler",
                "Canonical relationships form a loop",
                `Canonical graph contains cycle '${[...cycle, current].join(" -> ")}'.`,
                {
                  expected: "canonical graph ending at one final target",
                  actual: [...cycle, current].join(" -> "),
                  structuredEvidence: [
                    {
                      type: "record",
                      label: "canonical cycle",
                      value: {
                        cyclePath: [...cycle, current].join(" -> ")
                      }
                    }
                  ]
                }
              )
            );
          }
        }
        break;
      }

      seen.set(current, path.length);
      path.push(current);
      const currentPage = graphPageByUrl(graph, current);
      current = currentPage?.canonicalUrl
        ? absoluteUrl(currentPage.canonicalUrl)
        : undefined;
    }
  }

  return reports;
}

function hreflangMissingReturnLink(
  context: RuleContext
): readonly RuleReport[] {
  const graph = graphForSiteDiagnostic(context);
  if (!graph) {
    return [];
  }

  return graph.pages.flatMap((sourcePage) =>
    (sourcePage.hreflangLinks ?? []).flatMap((alternate) => {
      const targetPage = graphPageByUrl(graph, alternate.url);
      if (!targetPage) {
        return [];
      }

      const hasReturn = (targetPage.hreflangLinks ?? []).some((candidate) =>
        sameUrl(candidate.url, sourcePage.url)
      );
      if (hasReturn) {
        return [];
      }

      return [
        report(
          context,
          "crawler",
          "Hreflang alternate is missing a return link",
          `Hreflang source '${sourcePage.url}' links to '${alternate.url}' for '${alternate.hreflang}', but the target page does not link back.`,
          {
            expected: "reciprocal hreflang return link",
            actual: "missing return link",
            structuredEvidence: [
              {
                type: "record",
                label: "hreflang return link",
                value: {
                  hreflangSource: sourcePage.url,
                  hreflangTarget: alternate.url,
                  hreflang: alternate.hreflang
                }
              }
            ]
          }
        )
      ];
    })
  );
}

function canonicalTargetNonSuccess(
  context: RuleContext
): readonly RuleReport[] {
  const entry = canonicalEntries(context)[0];
  if (!entry) {
    return [];
  }

  const target = resolvedUrlSnapshot(context, entry.href);
  if (!target || !nonSuccessStatus(target.statusCode)) {
    return [];
  }

  const targetUrl =
    parseUrlAgainstPage(target.url, context)?.href ?? target.url;
  return [
    report(
      context,
      "crawler",
      "Canonical target is non-success",
      `Canonical target '${targetUrl}' returned HTTP ${target.statusCode}.`,
      {
        expected: "2xx canonical target response",
        actual: `HTTP ${target.statusCode}`,
        structuredEvidence: [
          {
            type: "record",
            label: "canonical target status",
            value: {
              canonicalUrl: entry.href,
              canonicalSource: entry.source,
              targetUrl,
              finalUrl: target.finalUrl ?? null,
              statusCode: target.statusCode ?? null
            }
          }
        ]
      }
    )
  ];
}

function canonicalTargetRedirects(context: RuleContext): readonly RuleReport[] {
  const entry = canonicalEntries(context)[0];
  if (!entry) {
    return [];
  }

  const target = resolvedUrlSnapshot(context, entry.href);
  const redirectChain = target?.redirectChain ?? [];
  if (!target || redirectChain.length === 0) {
    return [];
  }

  const targetUrl =
    parseUrlAgainstPage(target.url, context)?.href ?? target.url;
  return [
    report(
      context,
      "crawler",
      "Canonical target redirects",
      `Canonical target '${targetUrl}' redirects through ${redirectChain.length} hop(s).`,
      {
        expected: "canonical target without redirects",
        actual: redirectChain.join(" -> "),
        structuredEvidence: [
          {
            type: "record",
            label: "canonical target redirect chain",
            value: {
              canonicalUrl: entry.href,
              canonicalSource: entry.source,
              targetUrl,
              finalUrl: target.finalUrl ?? null,
              redirectChain: redirectChain.join(" -> ")
            }
          }
        ]
      }
    )
  ];
}

function canonicalSchemeConflict(context: RuleContext): readonly RuleReport[] {
  const entry = canonicalEntries(context)[0];
  if (!entry) {
    return [];
  }

  const canonical = parseUrlAgainstPage(entry.href, context);
  const page = parseUrlAgainstPage(context.snapshot.pageUrl, context);
  if (
    !canonical ||
    !page ||
    canonical.protocol === page.protocol ||
    canonicalMatchesConfiguredLocalSite(context, page, canonical)
  ) {
    return [];
  }

  return [
    report(
      context,
      entry.source,
      "Canonical URL uses a different scheme",
      `Page scheme is '${page.protocol}' but canonical scheme is '${canonical.protocol}'.`,
      {
        expected: page.protocol,
        actual: canonical.protocol
      }
    )
  ];
}

function canonicalHostConflict(context: RuleContext): readonly RuleReport[] {
  const entry = canonicalEntries(context)[0];
  if (!entry) {
    return [];
  }

  const canonical = parseUrlAgainstPage(entry.href, context);
  const page = parseUrlAgainstPage(context.snapshot.pageUrl, context);
  if (
    !canonical ||
    !page ||
    canonical.host === page.host ||
    canonicalMatchesConfiguredLocalSite(context, page, canonical)
  ) {
    return [];
  }

  return [
    report(
      context,
      entry.source,
      "Canonical URL uses a different host",
      `Page host is '${page.host}' but canonical host is '${canonical.host}'.`,
      {
        expected: page.host,
        actual: canonical.host
      }
    )
  ];
}

function canonicalMatchesConfiguredLocalSite(
  context: RuleContext,
  page: ParsedUrl,
  canonical: ParsedUrl
): boolean {
  if (!isLocalDevelopmentUrl(page) || !context.siteUrl) {
    return false;
  }

  const site = parseAbsoluteUrlOrUndefined(context.siteUrl);
  return (
    site !== undefined &&
    canonical.protocol === site.protocol &&
    canonical.host === site.host
  );
}

function isLocalDevelopmentUrl(url: ParsedUrl): boolean {
  const host = url.host.toLowerCase();
  return (
    host === "localhost" ||
    host.startsWith("localhost:") ||
    isLoopbackHost(host)
  );
}

function isLoopbackHost(host: string): boolean {
  return (
    host === "127.0.0.1" ||
    host.startsWith("127.0.0.1:") ||
    host === "[::1]" ||
    host.startsWith("[::1]:")
  );
}

function parseAbsoluteUrlOrUndefined(
  value: string
): Pick<ParsedUrl, "protocol" | "host"> | undefined {
  const match = value.match(/^(https?:)\/\/([^/?#]+)/i);
  if (!match) {
    return undefined;
  }

  return {
    protocol: match[1]!,
    host: match[2]!
  };
}

function invalidHreflangCode(context: RuleContext): readonly RuleReport[] {
  const invalid = hreflangEntries(context).find(
    (entry) => !validHreflang(entry.hreflang)
  );
  if (!invalid) {
    return [];
  }

  return [
    report(
      context,
      invalid.source,
      "Invalid hreflang code",
      `Observed invalid hreflang '${invalid.hreflang}'.`,
      {
        actual: invalid.hreflang
      }
    )
  ];
}

function missingXDefault(context: RuleContext): readonly RuleReport[] {
  const entries = hreflangEntries(context);
  if (
    entries.length === 0 ||
    entries.some((entry) => entry.hreflang.toLowerCase() === "x-default")
  ) {
    return [];
  }

  return [
    report(
      context,
      entries[0]?.source ?? "raw-html",
      "Hreflang set is missing x-default",
      `Found ${entries.length} hreflang alternates but no x-default alternate.`
    )
  ];
}

function hreflangTargetNonIndexable(
  context: RuleContext
): readonly RuleReport[] {
  for (const entry of hreflangEntries(context)) {
    const target = resolvedUrlSnapshot(context, entry.href);
    if (!target) {
      continue;
    }

    const directive = firstNoindexTargetDirective(target);
    if (!directive) {
      continue;
    }

    const targetUrl =
      parseUrlAgainstPage(target.url, context)?.href ?? target.url;
    return [
      report(
        context,
        directive.source,
        "Hreflang target is non-indexable",
        `Hreflang target '${targetUrl}' for '${entry.hreflang}' contains '${directive.directive}'.`,
        {
          expected: "indexable hreflang target",
          actual: directive.directive,
          structuredEvidence: [
            {
              type: "record",
              label: "hreflang target directive",
              value: {
                hreflang: entry.hreflang,
                hreflangUrl: entry.href,
                hreflangSource: entry.source,
                targetUrl,
                targetDirective: directive.directive,
                targetDirectiveSource: directive.source
              }
            }
          ]
        }
      )
    ];
  }

  return [];
}

function hreflangTargetNonSuccess(context: RuleContext): readonly RuleReport[] {
  for (const entry of hreflangEntries(context)) {
    const target = resolvedUrlSnapshot(context, entry.href);
    if (!target || !nonSuccessStatus(target.statusCode)) {
      continue;
    }

    const targetUrl =
      parseUrlAgainstPage(target.url, context)?.href ?? target.url;
    return [
      report(
        context,
        "crawler",
        "Hreflang target is non-success",
        `Hreflang target '${targetUrl}' for '${entry.hreflang}' returned HTTP ${target.statusCode}.`,
        {
          expected: "2xx hreflang target response",
          actual: `HTTP ${target.statusCode}`,
          structuredEvidence: [
            {
              type: "record",
              label: "hreflang target status",
              value: {
                hreflang: entry.hreflang,
                hreflangUrl: entry.href,
                hreflangSource: entry.source,
                targetUrl,
                finalUrl: target.finalUrl ?? null,
                statusCode: target.statusCode ?? null
              }
            }
          ]
        }
      )
    ];
  }

  return [];
}

function rawRenderedCanonicalMismatch(
  context: RuleContext
): readonly RuleReport[] {
  if (!context.snapshot.rawHtml || !context.snapshot.renderedDom) {
    return [];
  }

  const rawCanonical = canonicalLinks(context.snapshot.rawHtml)[0];
  const renderedCanonical = canonicalLinks(context.snapshot.renderedDom)[0];
  if (
    !rawCanonical ||
    !renderedCanonical ||
    rawCanonical === renderedCanonical
  ) {
    return [];
  }

  return [
    report(
      context,
      "rendered-dom",
      "Raw and rendered canonicals differ",
      `Raw HTML canonical is '${rawCanonical}' but rendered DOM canonical is '${renderedCanonical}'.`,
      {
        expected: rawCanonical,
        actual: renderedCanonical
      }
    )
  ];
}

function canonicalToParameterUrl(context: RuleContext): readonly RuleReport[] {
  const entry = canonicalEntries(context)[0];
  if (!entry) {
    return [];
  }

  const canonical = parseUrlAgainstPage(entry.href, context);
  if (!canonical || canonical.search.length === 0) {
    return [];
  }

  return [
    report(
      context,
      entry.source,
      "Canonical URL includes query parameters",
      `Canonical URL '${canonical.href}' includes query parameters.`,
      {
        actual: canonical.href
      }
    )
  ];
}

function googleSelectedCanonicalDiffers(
  context: RuleContext
): readonly RuleReport[] {
  const declared = canonicalEntries(context)[0];
  if (!declared) {
    return [];
  }

  const observation = (context.snapshot.externalObservations ?? []).find(
    (item) =>
      item.provider === "google" && item.canonical?.googleSelected !== undefined
  );
  const googleSelected = observation?.canonical?.googleSelected;
  if (!observation || !googleSelected || googleSelected === declared.href) {
    return [];
  }

  return [
    report(
      context,
      "google",
      "Google selected a different canonical",
      `Declared canonical is '${declared.href}' but Google selected '${googleSelected}' with observedAt '${observation.observedAt}' and fetchedAt '${observation.fetchedAt}'.`,
      {
        expected: declared.href,
        actual: googleSelected,
        structuredEvidence: [
          {
            type: "record",
            label: "google canonical observation",
            value: {
              provider: "google",
              declaredCanonical: declared.href,
              declaredCanonicalSource: declared.source,
              googleCanonical: googleSelected,
              userDeclaredCanonical:
                observation.canonical?.userDeclared ?? null,
              observedAt: observation.observedAt,
              fetchedAt: observation.fetchedAt,
              freshness: observation.freshness
            }
          }
        ]
      }
    )
  ];
}

const implementations: Record<
  (typeof implementedRuleIds)[number],
  Rule["run"]
> = {
  "SL-HTTP-001": nonSuccessIndexableResponse,
  "SL-HTTP-002": redirectChainTooLong,
  "SL-HTTP-003": redirectLoop,
  "SL-HTTP-004": htmlRouteWrongContentType,
  "SL-HTTP-005": missingRawHtmlHead,
  "SL-HTTP-006": missingRenderedDomHead,
  "SL-HTTP-007": rawRenderedTitleMismatch,
  "SL-HTTP-008": rawRenderedDescriptionMismatch,
  "SL-HTTP-009": requiredMetadataRenderedOnly,
  "SL-HTTP-010": responseTimeOverPolicy,
  "SL-HTTP-011": renderedHtmlLangMissing,
  "SL-HTTP-012": hydrationRemovesRequiredMetadata,
  "SL-INDEX-001": unexpectedNoindex,
  "SL-INDEX-002": missingNoindex,
  "SL-INDEX-003": conflictingIndexDirectives,
  "SL-INDEX-004": robotsBlocksIndexableRoute,
  "SL-INDEX-005": sitemapIncludesNoindexUrl,
  "SL-INDEX-006": noindexRenderedOnly,
  "SL-INDEX-007": xRobotsNoneOnIndexableRoute,
  "SL-INDEX-008": unavailableAfterExpired,
  "SL-INDEX-009": canonicalTargetNoindex,
  "SL-INDEX-010": criticalAssetsBlockedByRobots,
  "SL-INDEX-011": googleIndexableUrlNotIndexed,
  "SL-INDEX-012": yandexIndexableUrlNotSearchable,
  "SL-INDEX-013": indexableParameterUrl,
  "SL-INDEX-014": soft404Indexable
};

const titleMetadataImplementations: Record<
  (typeof implementedTitleMetadataRuleIds)[number],
  Rule["run"]
> = {
  "SL-META-001": missingTitle,
  "SL-META-002": emptyTitle,
  "SL-META-003": multipleTitleElements,
  "SL-META-004": duplicateTitleAcrossIndexablePages,
  "SL-META-005": missingDescription,
  "SL-META-006": emptyDescription,
  "SL-META-007": multipleMetaDescriptions,
  "SL-META-008": duplicateDescriptionAcrossIndexablePages,
  "SL-META-009": titleLengthOutsideGuidance,
  "SL-META-010": descriptionLengthOutsideGuidance,
  "SL-META-011": missingOpenGraphTitle,
  "SL-META-012": missingOpenGraphDescription,
  "SL-META-013": missingTwitterTitle,
  "SL-META-014": missingTwitterDescription,
  "SL-META-015": missingViewport,
  "SL-META-016": missingCharset,
  "SL-META-017": metadataSourceLocationUnresolved,
  "SL-META-018": duplicateSocialMetadata
};

const canonicalHreflangImplementations: Record<
  (typeof implementedCanonicalHreflangRuleIds)[number],
  Rule["run"]
> = {
  "SL-CANON-001": missingCanonical,
  "SL-CANON-002": multipleCanonicals,
  "SL-CANON-003": selfCanonicalExpected,
  "SL-CANON-004": canonicalTargetNonSuccess,
  "SL-CANON-005": canonicalTargetRedirects,
  "SL-CANON-006": canonicalSchemeConflict,
  "SL-CANON-007": canonicalHostConflict,
  "SL-CANON-008": canonicalLoop,
  "SL-CANON-009": hreflangMissingReturnLink,
  "SL-CANON-010": invalidHreflangCode,
  "SL-CANON-011": missingXDefault,
  "SL-CANON-012": hreflangTargetNonIndexable,
  "SL-CANON-013": hreflangTargetNonSuccess,
  "SL-CANON-014": rawRenderedCanonicalMismatch,
  "SL-CANON-015": canonicalToParameterUrl,
  "SL-CANON-016": googleSelectedCanonicalDiffers
};

const structuralMediaSchemaLinkImplementations: Record<
  (typeof implementedStructuralMediaSchemaLinkRuleIds)[number],
  Rule["run"]
> = {
  "SL-HEAD-001": missingH1,
  "SL-HEAD-002": multipleH1,
  "SL-HEAD-003": emptyHeading,
  "SL-HEAD-004": skippedHeadingLevel,
  "SL-HEAD-005": titleH1TokenMismatch,
  "SL-HEAD-006": h1RenderedOnly,
  "SL-HEAD-007": hiddenPrimaryHeading,
  "SL-HEAD-008": requiredHeadingPatternMissing,
  "SL-IMG-001": missingOgImage,
  "SL-IMG-002": ogImageNonSuccess,
  "SL-IMG-003": ogImageNotAbsolute,
  "SL-IMG-004": missingTwitterImage,
  "SL-IMG-005": twitterImageNonSuccess,
  "SL-IMG-006": contentImageMissingAlt,
  "SL-IMG-007": contentImageEmptyAlt,
  "SL-IMG-008": pageImageNonSuccess,
  "SL-IMG-009": socialImageSizeOutsideGuidance,
  "SL-IMG-010": unsupportedSocialImageType,
  "SL-IMG-011": missingOgImageDimensions,
  "SL-IMG-012": nextImageUnoptimizedIndexable,
  "SL-SCHEMA-001": missingRequiredSchema,
  "SL-SCHEMA-002": invalidJsonLd,
  "SL-SCHEMA-003": schemaTypeMismatch,
  "SL-SCHEMA-004": productSchemaMissingOffers,
  "SL-SCHEMA-005": articleSchemaMissingDate,
  "SL-SCHEMA-006": breadcrumbSchemaIncomplete,
  "SL-SCHEMA-007": schemaUrlConflictsPage,
  "SL-SCHEMA-008": duplicateJsonLdNode,
  "SL-SCHEMA-009": requiredSchemaRenderedOnly,
  "SL-SCHEMA-010": googleRichResultUnavailable,
  "SL-LINK-001": brokenInternalLink,
  "SL-LINK-002": internalLinkRedirects,
  "SL-LINK-003": orphanIndexablePage,
  "SL-LINK-004": linkedNonindexablePage,
  "SL-LINK-005": excessiveInternalNofollow,
  "SL-LINK-006": invalidAnchorHref,
  "SL-LINK-007": emptyLinkText,
  "SL-LINK-008": trailingSlashDuplicate,
  "SL-LINK-009": caseVariantDuplicate,
  "SL-LINK-010": externalTargetBlankMissingRel,
  "SL-LINK-011": sitemapUrlNotLinked,
  "SL-LINK-012": canonicalTargetNotLinked,
  "SL-LINK-013": paginatedSeriesLinksMissing,
  "SL-LINK-014": importantPageExcessiveCrawlDepth
};

const robotsSitemapPerformanceImplementations: Record<
  (typeof implementedRobotsSitemapPerformanceRuleIds)[number],
  Rule["run"]
> = {
  "SL-ROBOTS-001": robotsTxtUnavailable,
  "SL-ROBOTS-002": robotsSyntaxError,
  "SL-ROBOTS-003": robotsDisallowsSitemapUrl,
  "SL-ROBOTS-004": sitemapMissing,
  "SL-ROBOTS-005": sitemapNonSuccess,
  "SL-ROBOTS-006": sitemapInvalidXml,
  "SL-ROBOTS-007": sitemapUrlNonSuccess,
  "SL-ROBOTS-008": sitemapCanonicalMismatch,
  "SL-ROBOTS-009": robotsMissingSitemapDirective,
  "SL-ROBOTS-010": sitemapLastmodFuture,
  "SL-PERF-001": googleLcpPoor,
  "SL-PERF-002": googleClsPoor,
  "SL-PERF-003": googleInpPoor,
  "SL-PERF-004": metadataRenderDelayOverPolicy,
  "SL-PERF-005": htmlSizeOverGuidance,
  "SL-PERF-006": externalObservationSampled
};

export function createCoreHttpAndIndexabilityRules(
  registry: RuleCatalogRegistry
): readonly Rule[] {
  return implementedRuleIds.map((ruleId) =>
    createCatalogBackedRule(
      registry.requireRule(ruleId),
      implementations[ruleId]
    )
  );
}

export function createCoreTitleMetadataRules(
  registry: RuleCatalogRegistry
): readonly Rule[] {
  return implementedTitleMetadataRuleIds.map((ruleId) =>
    createCatalogBackedRule(
      registry.requireRule(ruleId),
      titleMetadataImplementations[ruleId]
    )
  );
}

export function createCoreCanonicalHreflangRules(
  registry: RuleCatalogRegistry
): readonly Rule[] {
  return implementedCanonicalHreflangRuleIds.map((ruleId) =>
    createCatalogBackedRule(
      registry.requireRule(ruleId),
      canonicalHreflangImplementations[ruleId]
    )
  );
}

export function createCoreStructuralMediaSchemaLinkRules(
  registry: RuleCatalogRegistry
): readonly Rule[] {
  return implementedStructuralMediaSchemaLinkRuleIds.map((ruleId) =>
    createCatalogBackedRule(
      registry.requireRule(ruleId),
      structuralMediaSchemaLinkImplementations[ruleId]
    )
  );
}

export function createCoreRobotsSitemapPerformanceRules(
  registry: RuleCatalogRegistry
): readonly Rule[] {
  return implementedRobotsSitemapPerformanceRuleIds.map((ruleId) =>
    createCatalogBackedRule(
      registry.requireRule(ruleId),
      robotsSitemapPerformanceImplementations[ruleId]
    )
  );
}
