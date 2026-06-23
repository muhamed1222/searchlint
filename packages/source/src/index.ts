import type {
  SourceCodeFinding,
  SourceLocation,
  SourceLocationConfidence,
  SourceRouterKind
} from "@searchlint/core";

export type SourceFile = {
  path: string;
  content: string;
};

export type SourceFinding = SourceCodeFinding;

export type SourceAnalysisResult = {
  findings: readonly SourceFinding[];
};

const metadataFields: readonly NonNullable<SourceCodeFinding["field"]>[] = [
  "title",
  "description",
  "robots",
  "alternates",
  "openGraph",
  "twitter"
];

export function analyzeNextSourceFiles(
  files: readonly SourceFile[]
): SourceAnalysisResult {
  const findings: SourceFinding[] = [];

  for (const file of files) {
    const normalizedPath = normalizePath(file.path);
    const route = inferNextRouteFromPath(normalizedPath);
    if (route) {
      findings.push({
        kind: "next-route",
        file: normalizedPath,
        router: route.router,
        route: route.route,
        location: createLocation(normalizedPath, 1, "EXACT")
      });
    }

    findings.push(...findStaticMetadataFields(normalizedPath, file.content));
    findings.push(...findGenerateMetadata(normalizedPath, file.content));
    findings.push(...findPagesHead(normalizedPath, file.content));
    findings.push(...findGenerateSitemaps(normalizedPath, file.content));
    findings.push(...findGenerateStaticParams(normalizedPath, file.content));
    findings.push(...findNextConfigExports(normalizedPath, file.content));
    findings.push(...findUnoptimizedNextImages(normalizedPath, file.content));
    findings.push(...findSpecialRouteFiles(normalizedPath));
  }

  return { findings };
}

export function inferNextRouteFromPath(
  filePath: string
): { router: SourceRouterKind; route: string } | undefined {
  const normalizedPath = normalizePath(filePath);
  const appMatch = normalizedPath.match(
    /(?:^|\/)app(?:\/(.*))?\/(?:page|layout)\.(?:tsx|ts|jsx|js)$/
  );
  if (appMatch) {
    return {
      router: "app",
      route: routeFromSegments(appMatch[1] ? appMatch[1].split("/") : [])
    };
  }

  const pagesMatch = normalizedPath.match(
    /(?:^|\/)pages\/(.+)\.(?:tsx|ts|jsx|js)$/
  );
  if (!pagesMatch?.[1] || pagesMatch[1].startsWith("api/")) {
    return undefined;
  }

  return { router: "pages", route: routeFromPagesPath(pagesMatch[1]) };
}

function findStaticMetadataFields(
  filePath: string,
  content: string
): readonly SourceFinding[] {
  const metadataStart = findMetadataObjectStart(content);
  if (metadataStart === undefined) {
    return [];
  }

  const objectEnd = findMatchingBrace(content, metadataStart);
  if (objectEnd === undefined) {
    return [];
  }

  const objectLine = lineAtOffset(content, metadataStart);
  const objectText = content.slice(metadataStart + 1, objectEnd);
  const findings: SourceFinding[] = [
    {
      kind: "static-metadata-object",
      file: filePath,
      exportName: "metadata",
      location: createLocation(filePath, objectLine, "EXACT")
    }
  ];
  for (const field of metadataFields) {
    const match = findObjectField(objectText, field);
    if (!match) {
      continue;
    }

    findings.push({
      kind: "static-metadata-field",
      file: filePath,
      field,
      exportName: "metadata",
      location: createLocation(
        filePath,
        lineAtOffset(content, metadataStart + 1 + match.index),
        "EXACT"
      )
    });
  }

  return findings;
}

function findGenerateMetadata(
  filePath: string,
  content: string
): readonly SourceFinding[] {
  const match = content.match(
    /export\s+(?:async\s+)?function\s+generateMetadata\b|export\s+const\s+generateMetadata\s*=/
  );
  if (!match || match.index === undefined) {
    return [];
  }

  return [
    {
      kind: "generate-metadata",
      file: filePath,
      exportName: "generateMetadata",
      location: createLocation(
        filePath,
        lineAtOffset(content, match.index),
        "RELATED"
      )
    }
  ];
}

function findPagesHead(
  filePath: string,
  content: string
): readonly SourceFinding[] {
  const route = inferNextRouteFromPath(filePath);
  if (route?.router !== "pages" || !importsNextHead(content)) {
    return [];
  }

  const match = content.match(/<Head(?:\s|>)/);
  if (!match || match.index === undefined) {
    return [];
  }

  return [
    {
      kind: "pages-head",
      file: filePath,
      router: route.router,
      route: route.route,
      exportName: "Head",
      location: createLocation(
        filePath,
        lineAtOffset(content, match.index),
        "EXACT"
      )
    }
  ];
}

function findGenerateSitemaps(
  filePath: string,
  content: string
): readonly SourceFinding[] {
  const match = content.match(
    /export\s+(?:async\s+)?function\s+generateSitemaps\b|export\s+const\s+generateSitemaps\s*=/
  );
  if (!match || match.index === undefined) {
    return [];
  }

  return [
    {
      kind: "generate-sitemaps",
      file: filePath,
      exportName: "generateSitemaps",
      location: createLocation(
        filePath,
        lineAtOffset(content, match.index),
        "RELATED"
      )
    }
  ];
}

function findGenerateStaticParams(
  filePath: string,
  content: string
): readonly SourceFinding[] {
  const match = content.match(
    /export\s+(?:async\s+)?function\s+generateStaticParams\b|export\s+const\s+generateStaticParams\s*=/
  );
  if (!match || match.index === undefined) {
    return [];
  }

  return [
    {
      kind: "generate-static-params",
      file: filePath,
      exportName: "generateStaticParams",
      location: createLocation(
        filePath,
        lineAtOffset(content, match.index),
        "RELATED"
      )
    }
  ];
}

function findNextConfigExports(
  filePath: string,
  content: string
): readonly SourceFinding[] {
  if (!/(?:^|\/)next\.config\.(?:js|mjs|cjs|ts)$/.test(filePath)) {
    return [];
  }

  const findings: SourceFinding[] = [];
  const redirects = findConfigExport(content, "redirects");
  if (redirects !== undefined) {
    findings.push({
      kind: "next-config-redirects",
      file: filePath,
      exportName: "redirects",
      configRouteEntries: extractConfigRouteEntries(content, redirects),
      location: createLocation(
        filePath,
        lineAtOffset(content, redirects),
        "RELATED"
      )
    });
  }

  const rewrites = findConfigExport(content, "rewrites");
  if (rewrites !== undefined) {
    findings.push({
      kind: "next-config-rewrites",
      file: filePath,
      exportName: "rewrites",
      configRouteEntries: extractConfigRouteEntries(content, rewrites),
      location: createLocation(
        filePath,
        lineAtOffset(content, rewrites),
        "RELATED"
      )
    });
  }

  return findings;
}

function importsNextHead(content: string): boolean {
  return /import\s+Head\s+from\s+["']next\/head["']/.test(content);
}

function findConfigExport(
  content: string,
  exportName: "redirects" | "rewrites"
): number | undefined {
  const patterns = [
    new RegExp(`\\basync\\s+${exportName}\\s*\\(`),
    new RegExp(`\\b${exportName}\\s*\\(\\s*\\)\\s*[{:]`),
    new RegExp(
      `\\b${exportName}\\s*:\\s*(?:async\\s*)?(?:function\\b|\\([^)]*\\)\\s*=>|\\[)`
    ),
    new RegExp(
      `\\b${exportName}\\s*=\\s*(?:async\\s*)?(?:function\\b|\\([^)]*\\)\\s*=>|\\[)`
    )
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match?.index !== undefined) {
      return match.index + match[0].indexOf(exportName);
    }
  }

  return undefined;
}

function extractConfigRouteEntries(
  content: string,
  exportOffset: number
): readonly NonNullable<SourceFinding["configRouteEntries"]>[number][] {
  const arrayStart = content.indexOf("[", exportOffset);
  if (arrayStart === -1) {
    return [];
  }

  const arrayEnd = findMatchingBracket(content, arrayStart);
  if (arrayEnd === undefined) {
    return [];
  }

  const entries: NonNullable<SourceFinding["configRouteEntries"]>[number][] =
    [];
  const arrayText = content.slice(arrayStart + 1, arrayEnd);
  for (const objectText of objectLiteralsIn(arrayText)) {
    const source = stringPropertyValue(objectText, "source");
    const destination = stringPropertyValue(objectText, "destination");
    if (!source || !destination) {
      continue;
    }

    const permanent = booleanPropertyValue(objectText, "permanent");
    entries.push({
      source,
      destination,
      ...(permanent === undefined ? {} : { permanent })
    });
  }

  return entries;
}

function findUnoptimizedNextImages(
  filePath: string,
  content: string
): readonly SourceFinding[] {
  const route = inferNextRouteFromPath(filePath);
  if (!route) {
    return [];
  }

  const findings: SourceFinding[] = [];
  for (const match of content.matchAll(
    /<Image\b[^>]*\bunoptimized(?=[\s/>])/g
  )) {
    if (match.index === undefined) {
      continue;
    }

    findings.push({
      kind: "next-image-unoptimized",
      file: filePath,
      router: route.router,
      route: route.route,
      location: createLocation(
        filePath,
        lineAtOffset(content, match.index),
        "EXACT"
      )
    });
  }

  return findings;
}

function findSpecialRouteFiles(filePath: string): readonly SourceFinding[] {
  if (/(?:^|\/)middleware\.(?:ts|js)$/.test(filePath)) {
    return [
      {
        kind: "middleware-file",
        file: filePath,
        exportName: "middleware",
        location: createLocation(filePath, 1, "EXACT")
      }
    ];
  }

  if (/(?:^|\/)proxy\.(?:ts|js)$/.test(filePath)) {
    return [
      {
        kind: "proxy-file",
        file: filePath,
        exportName: "proxy",
        location: createLocation(filePath, 1, "EXACT")
      }
    ];
  }

  if (/(?:^|\/)app\/robots\.(?:ts|js)$/.test(filePath)) {
    return [
      {
        kind: "robots-file",
        file: filePath,
        exportName: "robots",
        location: createLocation(filePath, 1, "EXACT")
      }
    ];
  }

  if (/(?:^|\/)app\/sitemap\.(?:ts|js)$/.test(filePath)) {
    return [
      {
        kind: "sitemap-file",
        file: filePath,
        exportName: "sitemap",
        location: createLocation(filePath, 1, "EXACT")
      }
    ];
  }

  if (/(?:^|\/)app\/.*opengraph-image\.(?:tsx|ts|jsx|js)$/.test(filePath)) {
    const route = inferGeneratedImageRouteFromPath(filePath);
    return [
      {
        kind: "opengraph-image-file",
        file: filePath,
        exportName: "opengraph-image",
        ...(route ? { router: route.router, route: route.route } : {}),
        location: createLocation(filePath, 1, "EXACT")
      }
    ];
  }

  if (/(?:^|\/)app\/.*twitter-image\.(?:tsx|ts|jsx|js)$/.test(filePath)) {
    const route = inferGeneratedImageRouteFromPath(filePath);
    return [
      {
        kind: "twitter-image-file",
        file: filePath,
        exportName: "twitter-image",
        ...(route ? { router: route.router, route: route.route } : {}),
        location: createLocation(filePath, 1, "EXACT")
      }
    ];
  }

  return [];
}

function inferGeneratedImageRouteFromPath(
  filePath: string
): { router: SourceRouterKind; route: string } | undefined {
  const normalizedPath = normalizePath(filePath);
  const match = normalizedPath.match(
    /(?:^|\/)app\/(.+)\/(?:opengraph-image|twitter-image)\.(?:tsx|ts|jsx|js)$/
  );
  if (!match?.[1]) {
    return undefined;
  }

  return { router: "app", route: routeFromSegments(match[1].split("/")) };
}

function findMetadataObjectStart(content: string): number | undefined {
  const match = content.match(/export\s+const\s+metadata(?:\s*:[^=]+)?\s*=/);
  if (!match || match.index === undefined) {
    return undefined;
  }

  const braceIndex = content.indexOf("{", match.index + match[0].length);
  return braceIndex === -1 ? undefined : braceIndex;
}

function findObjectField(
  objectText: string,
  field: NonNullable<SourceCodeFinding["field"]>
): { index: number } | undefined {
  const pattern = new RegExp(`(^|[\\n,{])\\s*${field}\\s*:`);
  const match = objectText.match(pattern);
  if (!match || match.index === undefined) {
    return undefined;
  }

  return { index: match.index + match[0].lastIndexOf(field) };
}

function findMatchingBrace(
  content: string,
  startIndex: number
): number | undefined {
  let depth = 0;
  let quote: string | undefined;
  let escaped = false;

  for (let index = startIndex; index < content.length; index += 1) {
    const character = content[index];
    if (!character) {
      continue;
    }

    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (character === "\\") {
        escaped = true;
        continue;
      }
      if (character === quote) {
        quote = undefined;
      }
      continue;
    }

    if (character === "'" || character === '"' || character === "`") {
      quote = character;
      continue;
    }

    if (character === "{") {
      depth += 1;
      continue;
    }

    if (character === "}") {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }

  return undefined;
}

function findMatchingBracket(
  content: string,
  startIndex: number
): number | undefined {
  let depth = 0;
  let quote: string | undefined;
  let escaped = false;

  for (let index = startIndex; index < content.length; index += 1) {
    const character = content[index];
    if (!character) {
      continue;
    }

    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (character === "\\") {
        escaped = true;
        continue;
      }
      if (character === quote) {
        quote = undefined;
      }
      continue;
    }

    if (character === "'" || character === '"' || character === "`") {
      quote = character;
      continue;
    }

    if (character === "[") {
      depth += 1;
      continue;
    }

    if (character === "]") {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }

  return undefined;
}

function objectLiteralsIn(content: string): readonly string[] {
  const objects: string[] = [];
  let searchStart = 0;
  while (searchStart < content.length) {
    const objectStart = content.indexOf("{", searchStart);
    if (objectStart === -1) {
      break;
    }

    const objectEnd = findMatchingBrace(content, objectStart);
    if (objectEnd === undefined) {
      break;
    }

    objects.push(content.slice(objectStart + 1, objectEnd));
    searchStart = objectEnd + 1;
  }

  return objects;
}

function stringPropertyValue(
  content: string,
  property: string
): string | undefined {
  const pattern = new RegExp(`\\b${property}\\s*:\\s*["']([^"']+)["']`);
  return content.match(pattern)?.[1];
}

function booleanPropertyValue(
  content: string,
  property: string
): boolean | undefined {
  const pattern = new RegExp(`\\b${property}\\s*:\\s*(true|false)\\b`);
  const value = content.match(pattern)?.[1];
  return value === undefined ? undefined : value === "true";
}

function routeFromPagesPath(pathWithoutExtension: string): string {
  const segments = pathWithoutExtension.split("/");
  if (segments.at(-1) === "index") {
    segments.pop();
  }
  return routeFromSegments(segments);
}

function routeFromSegments(segments: readonly string[]): string {
  const visibleSegments = segments
    .map((segment) => publicRouteSegment(segment))
    .filter((segment): segment is string => segment !== undefined);
  return `/${visibleSegments.join("/")}`.replace(/\/+/g, "/");
}

function publicRouteSegment(segment: string): string | undefined {
  if (segment.length === 0 || segment === "index" || segment.startsWith("@")) {
    return undefined;
  }

  if (/^\([^)]+\)$/.test(segment)) {
    return undefined;
  }

  const intercepting = segment.match(
    /^\((?:\.|\.\.|\.\.\.|\.\.\)\(\.\.)\)(.+)$/
  );
  return intercepting?.[1] ?? segment;
}

function createLocation(
  file: string,
  line: number,
  confidence: SourceLocationConfidence
): SourceLocation {
  return confidence === "EXACT"
    ? { confidence, file, line }
    : { confidence, file };
}

function lineAtOffset(content: string, offset: number): number {
  let line = 1;
  for (let index = 0; index < offset; index += 1) {
    if (content[index] === "\n") {
      line += 1;
    }
  }
  return line;
}

function normalizePath(filePath: string): string {
  return filePath.replaceAll("\\", "/");
}
