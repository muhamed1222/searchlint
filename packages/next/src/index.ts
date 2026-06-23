import { bundledRuleCatalogText } from "./catalog.generated.js";

export type NextSourceFileKind =
  | "app-route"
  | "app-layout"
  | "pages-route"
  | "metadata-file"
  | "route-handler"
  | "generated-image"
  | "middleware"
  | "next-config";

export type NextSourceFile = {
  path: string;
  kind: NextSourceFileKind;
};

export type NextProjectDiscoveryResult = {
  sourceFiles: readonly NextSourceFile[];
};

export type NextRouteModelMetadataMode =
  | "none"
  | "static"
  | "dynamic"
  | "static-and-dynamic";

export type NextRouteModelEntry = {
  route: string;
  router: "app" | "pages";
  pageFile: string;
  layouts: readonly string[];
  routeHandler?: string;
  dynamicSegments: readonly string[];
  metadataMode: NextRouteModelMetadataMode;
};

export type NextRouteModel = {
  routes: readonly NextRouteModelEntry[];
};

export type NextRouteSourceFinding = {
  kind:
    | "static-metadata-object"
    | "static-metadata-field"
    | "generate-metadata";
  file: string;
  field?: NextMetadataField;
};

export type NextMetadataField =
  | "title"
  | "description"
  | "robots"
  | "alternates"
  | "openGraph"
  | "twitter";

export type NextRouteMetadataStaticField = {
  field: NextMetadataField;
  file: string;
  inherited: boolean;
};

export type NextRouteMetadataDynamicContribution = {
  file: string;
  inherited: boolean;
};

export type NextRouteMetadataSummary = {
  route: string;
  router: "app" | "pages";
  pageFile: string;
  metadataMode: NextRouteModelMetadataMode;
  staticFields: readonly NextRouteMetadataStaticField[];
  dynamicMetadata: readonly NextRouteMetadataDynamicContribution[];
};

export type NextConfigSummary = {
  configFiles: readonly string[];
  redirectsFiles: readonly string[];
  rewritesFiles: readonly string[];
  redirectEntries: readonly NextConfigRouteEntry[];
  rewriteEntries: readonly NextConfigRouteEntry[];
};

export type NextConfigRouteEntry = {
  file: string;
  source: string;
  destination: string;
  permanent?: boolean;
};

export type SearchLintNextIntegrationOptions = {
  catalogText?: string;
  catalogPath?: string;
  enabled?: boolean;
};

export const nextDevelopmentServerPhase = "phase-development-server";
export const nextProductionBuildPhase = "phase-production-build";

export type NextWebpackContext = {
  dev?: boolean;
  isServer?: boolean;
  webpack?: {
    DefinePlugin: new (
      definitions: Readonly<Record<string, string>>
    ) => unknown;
  };
};

export type NextWebpackConfig = {
  entry?: unknown;
  plugins?: unknown[];
  resolve?: {
    alias?: Record<string, unknown>;
  };
};

export type NextConfigLike = {
  webpack?: (
    config: NextWebpackConfig,
    context: NextWebpackContext
  ) => NextWebpackConfig;
  [key: string]: unknown;
};

export type NextConfigFactory<TConfig extends NextConfigLike> = (
  phase: string,
  defaults?: unknown
) => TConfig;

export type SearchLintNextConfig<TConfig extends NextConfigLike> = (
  phase: string,
  defaults?: unknown
) =>
  | TConfig
  | (Omit<TConfig, "webpack"> & Required<Pick<NextConfigLike, "webpack">>);

const sourceExtensions = new Set(["js", "jsx", "ts", "tsx", "mjs", "cjs"]);
const pageExtensions = new Set(["js", "jsx", "ts", "tsx"]);
const ignoredSegments = new Set([
  ".next",
  "node_modules",
  "dist",
  "build",
  "coverage"
]);

export function createSearchLintNextConfig<TConfig extends NextConfigLike>(
  nextConfig: TConfig | NextConfigFactory<TConfig>,
  options: SearchLintNextIntegrationOptions = {}
): SearchLintNextConfig<TConfig> {
  return function searchLintNextConfig(phase: string, defaults?: unknown) {
    const resolvedConfig =
      typeof nextConfig === "function"
        ? nextConfig(phase, defaults)
        : nextConfig;

    if (
      options.enabled === false ||
      phase === nextProductionBuildPhase ||
      phase !== nextDevelopmentServerPhase
    ) {
      return resolvedConfig;
    }

    return createSearchLintDevelopmentConfig(resolvedConfig, options);
  };
}

function createSearchLintDevelopmentConfig<TConfig extends NextConfigLike>(
  nextConfig: TConfig,
  options: SearchLintNextIntegrationOptions
): Omit<TConfig, "webpack"> & Required<Pick<NextConfigLike, "webpack">> {
  const originalWebpack = nextConfig.webpack;
  return {
    ...nextConfig,
    webpack(config: NextWebpackConfig, context: NextWebpackContext) {
      const resolvedConfig = originalWebpack
        ? originalWebpack(config, context)
        : config;

      if (options.enabled === false || !context.dev || context.isServer) {
        return resolvedConfig;
      }

      const catalogText = options.catalogText ?? readCatalogText(options);
      if (context.webpack?.DefinePlugin) {
        resolvedConfig.plugins = [
          ...(resolvedConfig.plugins ?? []),
          new context.webpack.DefinePlugin({
            __SEARCHLINT_RULE_CATALOG__: JSON.stringify(catalogText)
          })
        ];
      }
      injectDevClientEntry(resolvedConfig);
      return resolvedConfig;
    }
  };
}

export const withSearchLint = createSearchLintNextConfig;

export function hasSearchLintProductionImpact(
  build: SearchLintProductionBuildSnapshot
): boolean {
  return (
    build.clientBundleBytesDelta !== 0 ||
    build.searchLintClientModules.length !== 0 ||
    build.productionHttpRequests.length !== 0 ||
    build.runtimeHooks.length !== 0 ||
    build.searchLintDomElements !== 0 ||
    build.routeOutputChanged ||
    build.searchLintGlobals.length !== 0 ||
    build.serverUsesOverlayRuntime
  );
}

export type SearchLintProductionBuildSnapshot = {
  clientBundleBytesDelta: number;
  searchLintClientModules: readonly string[];
  productionHttpRequests: readonly string[];
  runtimeHooks: readonly string[];
  searchLintDomElements: number;
  routeOutputChanged: boolean;
  searchLintGlobals: readonly string[];
  serverUsesOverlayRuntime: boolean;
};

export function createZeroImpactReport(
  build: SearchLintProductionBuildSnapshot
): readonly {
  check: string;
  expected: string;
  actual: string;
  pass: boolean;
}[] {
  return [
    {
      check: "client bundle bytes",
      expected: "0",
      actual: String(build.clientBundleBytesDelta),
      pass: build.clientBundleBytesDelta === 0
    },
    {
      check: "SearchLint client modules",
      expected: "0",
      actual: String(build.searchLintClientModules.length),
      pass: build.searchLintClientModules.length === 0
    },
    {
      check: "production HTTP requests",
      expected: "0",
      actual: String(build.productionHttpRequests.length),
      pass: build.productionHttpRequests.length === 0
    },
    {
      check: "runtime hooks/listeners/observers",
      expected: "0",
      actual: String(build.runtimeHooks.length),
      pass: build.runtimeHooks.length === 0
    },
    {
      check: "SearchLint DOM elements",
      expected: "0",
      actual: String(build.searchLintDomElements),
      pass: build.searchLintDomElements === 0
    },
    {
      check: "route output changes",
      expected: "false",
      actual: String(build.routeOutputChanged),
      pass: !build.routeOutputChanged
    },
    {
      check: "SearchLint globals",
      expected: "0",
      actual: String(build.searchLintGlobals.length),
      pass: build.searchLintGlobals.length === 0
    },
    {
      check: "production server overlay runtime",
      expected: "false",
      actual: String(build.serverUsesOverlayRuntime),
      pass: !build.serverUsesOverlayRuntime
    }
  ];
}

function injectDevClientEntry(config: NextWebpackConfig): void {
  const originalEntry = config.entry;
  config.entry = async function searchLintEntry() {
    const entries =
      typeof originalEntry === "function"
        ? await originalEntry()
        : (originalEntry ?? {});
    if (!isEntryMap(entries)) {
      return entries;
    }

    const candidates = ["main-app", "main"];
    for (const candidate of candidates) {
      const value = entries[candidate];
      if (Array.isArray(value)) {
        if (!value.includes("@searchlint/next/dev-client")) {
          value.unshift("@searchlint/next/dev-client");
        }
        return entries;
      }
      if (typeof value === "string") {
        entries[candidate] = ["@searchlint/next/dev-client", value];
        return entries;
      }
    }

    entries["searchlint-dev-client"] = ["@searchlint/next/dev-client"];
    return entries;
  };
}

function isEntryMap(
  value: unknown
): value is Record<string, string | string[]> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readCatalogText(options: SearchLintNextIntegrationOptions): string {
  if (options.catalogText === undefined && options.catalogPath === undefined) {
    return bundledRuleCatalogText;
  }
  if (options.catalogPath) {
    throw new Error(
      "SearchLint Next integration cannot read catalogPath in the browser-safe package build; pass catalogText from next.config instead."
    );
  }
  throw new Error(
    "SearchLint Next integration requires catalogText so development bundles can use the real RULE_CATALOG.yaml without shipping it to production."
  );
}

export function discoverNextProjectSourceFiles(
  paths: readonly string[]
): NextProjectDiscoveryResult {
  const byPath = new Map<string, NextSourceFile>();
  for (const inputPath of paths) {
    const sourceFile = classifyNextSourcePath(inputPath);
    if (!sourceFile || byPath.has(sourceFile.path)) {
      continue;
    }
    byPath.set(sourceFile.path, sourceFile);
  }

  return {
    sourceFiles: [...byPath.values()].sort((left, right) =>
      left.path.localeCompare(right.path)
    )
  };
}

export function classifyNextSourcePath(
  inputPath: string
): NextSourceFile | undefined {
  const path = normalizePath(inputPath);
  const segments = path.split("/");
  if (segments.some((segment) => ignoredSegments.has(segment))) {
    return undefined;
  }

  const extension = extensionOf(path);
  if (!extension) {
    return undefined;
  }

  const fileName = segments.at(-1) ?? "";
  if (
    /^(?:middleware|proxy)\.(?:js|ts)$/.test(fileName) &&
    sourceExtensions.has(extension)
  ) {
    return { path, kind: "middleware" };
  }

  if (
    /^next\.config\.(?:js|mjs|cjs|ts)$/.test(fileName) &&
    sourceExtensions.has(extension)
  ) {
    return { path, kind: "next-config" };
  }

  const appIndex = segments.lastIndexOf("app");
  if (appIndex !== -1 && pageExtensions.has(extension)) {
    const baseName = baseNameWithoutExtension(fileName);
    if (baseName === "page") {
      return { path, kind: "app-route" };
    }
    if (baseName === "layout") {
      return { path, kind: "app-layout" };
    }
    if (baseName === "route") {
      return { path, kind: "route-handler" };
    }
    if (baseName === "robots" || baseName === "sitemap") {
      return { path, kind: "metadata-file" };
    }
    if (baseName === "opengraph-image" || baseName === "twitter-image") {
      return { path, kind: "generated-image" };
    }
  }

  const pagesIndex = segments.lastIndexOf("pages");
  if (pagesIndex !== -1 && pageExtensions.has(extension)) {
    const relative = segments.slice(pagesIndex + 1).join("/");
    if (relative.startsWith("api/") || fileName.startsWith("_")) {
      return undefined;
    }
    return { path, kind: "pages-route" };
  }

  return undefined;
}

export function buildNextRouteModel(
  sourceFiles: readonly NextSourceFile[],
  sourceFindings: readonly NextRouteSourceFinding[] = []
): NextRouteModel {
  const layouts = sourceFiles.filter((file) => file.kind === "app-layout");
  const routeHandlers = sourceFiles.filter(
    (file) => file.kind === "route-handler"
  );
  const routes: NextRouteModelEntry[] = [];

  for (const file of sourceFiles) {
    if (file.kind !== "app-route" && file.kind !== "pages-route") {
      continue;
    }

    const route = routeFromSourceFile(file);
    if (!route) {
      continue;
    }

    routes.push({
      route,
      router: file.kind === "app-route" ? "app" : "pages",
      pageFile: file.path,
      layouts:
        file.kind === "app-route" ? layoutsForAppRoute(file.path, layouts) : [],
      ...(file.kind === "app-route"
        ? routeHandlerForAppRoute(file.path, routeHandlers)
        : {}),
      dynamicSegments: dynamicSegments(route),
      metadataMode: metadataModeForFile(file.path, sourceFindings)
    });
  }

  return {
    routes: routes.sort((left, right) => {
      const routeOrder = left.route.localeCompare(right.route);
      return routeOrder === 0
        ? left.pageFile.localeCompare(right.pageFile)
        : routeOrder;
    })
  };
}

export function buildNextRouteMetadataSummaries(
  routeModel: NextRouteModel,
  sourceFindings: readonly NextRouteSourceFinding[] = []
): readonly NextRouteMetadataSummary[] {
  return routeModel.routes
    .map((route) => {
      const inheritedFiles = new Set(route.layouts);
      const ownedFiles = new Set([route.pageFile, ...route.layouts]);
      const relevantFindings = sourceFindings.filter((finding) =>
        ownedFiles.has(finding.file)
      );

      return {
        route: route.route,
        router: route.router,
        pageFile: route.pageFile,
        metadataMode: metadataModeForFindings(relevantFindings),
        staticFields: staticFieldsForFindings(relevantFindings, inheritedFiles),
        dynamicMetadata: dynamicMetadataForFindings(
          relevantFindings,
          inheritedFiles
        )
      };
    })
    .sort((left, right) => {
      const routeOrder = left.route.localeCompare(right.route);
      return routeOrder === 0
        ? left.pageFile.localeCompare(right.pageFile)
        : routeOrder;
    });
}

export function buildNextConfigSummary(
  sourceFiles: readonly NextSourceFile[],
  sourceFindings: readonly {
    kind: "next-config-redirects" | "next-config-rewrites";
    file: string;
    configRouteEntries?: readonly {
      source: string;
      destination: string;
      permanent?: boolean;
    }[];
  }[] = []
): NextConfigSummary {
  const configFiles = uniqueStable(
    sourceFiles
      .filter((file) => file.kind === "next-config")
      .map((file) => file.path)
  );
  const redirectsFiles = uniqueStable(
    sourceFindings
      .filter((finding) => finding.kind === "next-config-redirects")
      .map((finding) => finding.file)
  );
  const rewritesFiles = uniqueStable(
    sourceFindings
      .filter((finding) => finding.kind === "next-config-rewrites")
      .map((finding) => finding.file)
  );
  const redirectEntries = configEntriesForKind(
    sourceFindings,
    "next-config-redirects"
  );
  const rewriteEntries = configEntriesForKind(
    sourceFindings,
    "next-config-rewrites"
  );

  return {
    configFiles,
    redirectsFiles,
    rewritesFiles,
    redirectEntries,
    rewriteEntries
  };
}

function configEntriesForKind(
  sourceFindings: readonly {
    kind: "next-config-redirects" | "next-config-rewrites";
    file: string;
    configRouteEntries?: readonly {
      source: string;
      destination: string;
      permanent?: boolean;
    }[];
  }[],
  kind: "next-config-redirects" | "next-config-rewrites"
): readonly NextConfigRouteEntry[] {
  return sourceFindings
    .filter((finding) => finding.kind === kind)
    .flatMap((finding) =>
      (finding.configRouteEntries ?? []).map((entry) => ({
        file: finding.file,
        source: entry.source,
        destination: entry.destination,
        ...(entry.permanent === undefined ? {} : { permanent: entry.permanent })
      }))
    )
    .sort((left, right) => {
      const fileOrder = left.file.localeCompare(right.file);
      if (fileOrder !== 0) {
        return fileOrder;
      }
      const sourceOrder = left.source.localeCompare(right.source);
      return sourceOrder === 0
        ? left.destination.localeCompare(right.destination)
        : sourceOrder;
    });
}

function routeFromSourceFile(file: NextSourceFile): string | undefined {
  if (file.kind === "app-route") {
    const appSegments = segmentsAfterMarker(file.path, "app");
    return appSegments
      ? routeFromSegments(appSegments.slice(0, -1))
      : undefined;
  }

  if (file.kind === "pages-route") {
    const pageSegments = segmentsAfterMarker(file.path, "pages");
    if (!pageSegments) {
      return undefined;
    }

    const routeSegments = pageSegments.map(stripExtension);
    if (routeSegments.at(-1) === "index") {
      routeSegments.pop();
    }
    return routeFromSegments(routeSegments);
  }

  return undefined;
}

function layoutsForAppRoute(
  pagePath: string,
  layouts: readonly NextSourceFile[]
): readonly string[] {
  const pageDirectory = directoryOf(pagePath);
  return layouts
    .filter((layout) =>
      isAncestorOrSameDirectory(directoryOf(layout.path), pageDirectory)
    )
    .map((layout) => layout.path)
    .sort((left, right) => left.localeCompare(right));
}

function routeHandlerForAppRoute(
  pagePath: string,
  routeHandlers: readonly NextSourceFile[]
): Pick<NextRouteModelEntry, "routeHandler"> {
  const pageDirectory = directoryOf(pagePath);
  const routeHandler = routeHandlers.find(
    (handler) => directoryOf(handler.path) === pageDirectory
  );
  return routeHandler ? { routeHandler: routeHandler.path } : {};
}

function metadataModeForFile(
  pageFile: string,
  sourceFindings: readonly NextRouteSourceFinding[]
): NextRouteModelMetadataMode {
  const relevantFindings = sourceFindings.filter(
    (finding) => finding.file === pageFile
  );
  const hasStatic = relevantFindings.some(
    (finding) =>
      finding.kind === "static-metadata-object" ||
      finding.kind === "static-metadata-field"
  );
  const hasDynamic = relevantFindings.some(
    (finding) => finding.kind === "generate-metadata"
  );

  if (hasStatic && hasDynamic) {
    return "static-and-dynamic";
  }
  if (hasStatic) {
    return "static";
  }
  if (hasDynamic) {
    return "dynamic";
  }
  return "none";
}

function metadataModeForFindings(
  sourceFindings: readonly NextRouteSourceFinding[]
): NextRouteModelMetadataMode {
  const hasStatic = sourceFindings.some(
    (finding) =>
      finding.kind === "static-metadata-object" ||
      finding.kind === "static-metadata-field"
  );
  const hasDynamic = sourceFindings.some(
    (finding) => finding.kind === "generate-metadata"
  );

  if (hasStatic && hasDynamic) {
    return "static-and-dynamic";
  }
  if (hasStatic) {
    return "static";
  }
  if (hasDynamic) {
    return "dynamic";
  }
  return "none";
}

function staticFieldsForFindings(
  sourceFindings: readonly NextRouteSourceFinding[],
  inheritedFiles: ReadonlySet<string>
): readonly NextRouteMetadataStaticField[] {
  return sourceFindings
    .filter(
      (
        finding
      ): finding is NextRouteSourceFinding & { field: NextMetadataField } =>
        finding.kind === "static-metadata-field" && finding.field !== undefined
    )
    .map((finding) => ({
      field: finding.field,
      file: finding.file,
      inherited: inheritedFiles.has(finding.file)
    }))
    .sort((left, right) => {
      const fieldOrder = left.field.localeCompare(right.field);
      return fieldOrder === 0
        ? left.file.localeCompare(right.file)
        : fieldOrder;
    });
}

function dynamicMetadataForFindings(
  sourceFindings: readonly NextRouteSourceFinding[],
  inheritedFiles: ReadonlySet<string>
): readonly NextRouteMetadataDynamicContribution[] {
  return sourceFindings
    .filter((finding) => finding.kind === "generate-metadata")
    .map((finding) => ({
      file: finding.file,
      inherited: inheritedFiles.has(finding.file)
    }))
    .sort((left, right) => left.file.localeCompare(right.file));
}

function segmentsAfterMarker(
  path: string,
  marker: string
): string[] | undefined {
  const segments = path.split("/");
  const index = segments.lastIndexOf(marker);
  return index === -1 ? undefined : segments.slice(index + 1);
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

function dynamicSegments(route: string): readonly string[] {
  return route
    .split("/")
    .filter((segment) => segment.startsWith("[") && segment.endsWith("]"));
}

function directoryOf(path: string): string {
  const index = path.lastIndexOf("/");
  return index === -1 ? "" : path.slice(0, index);
}

function isAncestorOrSameDirectory(
  candidate: string,
  directory: string
): boolean {
  return directory === candidate || directory.startsWith(`${candidate}/`);
}

function normalizePath(path: string): string {
  return path.replaceAll("\\", "/").replace(/^\.\/+/, "");
}

function uniqueStable(values: readonly string[]): readonly string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function extensionOf(path: string): string | undefined {
  const lastSegment = path.split("/").at(-1) ?? "";
  const dotIndex = lastSegment.lastIndexOf(".");
  return dotIndex === -1 ? undefined : lastSegment.slice(dotIndex + 1);
}

function baseNameWithoutExtension(fileName: string): string {
  const dotIndex = fileName.lastIndexOf(".");
  return dotIndex === -1 ? fileName : fileName.slice(0, dotIndex);
}

function stripExtension(fileName: string): string {
  return baseNameWithoutExtension(fileName);
}
