import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import {
  createSearchLintNextConfig,
  createZeroImpactReport,
  hasSearchLintProductionImpact,
  nextDevelopmentServerPhase,
  nextProductionBuildPhase,
  type NextWebpackConfig,
  type NextWebpackContext,
  buildNextConfigSummary,
  buildNextRouteMetadataSummaries,
  buildNextRouteModel,
  classifyNextSourcePath,
  discoverNextProjectSourceFiles
} from "../src/index.js";
import { analyzeCurrentDocument } from "../src/dev-client.js";

describe("classifyNextSourcePath", () => {
  it("classifies App Router source files", () => {
    expect(classifyNextSourcePath("app/page.tsx")).toEqual({
      path: "app/page.tsx",
      kind: "app-route"
    });
    expect(classifyNextSourcePath("app/products/[slug]/page.tsx")).toEqual({
      path: "app/products/[slug]/page.tsx",
      kind: "app-route"
    });
    expect(classifyNextSourcePath("src/app/(shop)/layout.tsx")).toEqual({
      path: "src/app/(shop)/layout.tsx",
      kind: "app-layout"
    });
    expect(classifyNextSourcePath("app/api/products/route.ts")).toEqual({
      path: "app/api/products/route.ts",
      kind: "route-handler"
    });
  });

  it("classifies metadata, generated image, pages, and config files", () => {
    expect(classifyNextSourcePath("app/robots.ts")).toEqual({
      path: "app/robots.ts",
      kind: "metadata-file"
    });
    expect(classifyNextSourcePath("app/opengraph-image.tsx")).toEqual({
      path: "app/opengraph-image.tsx",
      kind: "generated-image"
    });
    expect(classifyNextSourcePath("pages/products/[slug].tsx")).toEqual({
      path: "pages/products/[slug].tsx",
      kind: "pages-route"
    });
    expect(classifyNextSourcePath("./next.config.mjs")).toEqual({
      path: "next.config.mjs",
      kind: "next-config"
    });
    expect(classifyNextSourcePath("src/middleware.ts")).toEqual({
      path: "src/middleware.ts",
      kind: "middleware"
    });
    expect(classifyNextSourcePath("proxy.ts")).toEqual({
      path: "proxy.ts",
      kind: "middleware"
    });
  });

  it("ignores dependency, build output, and non-route pages files", () => {
    expect(classifyNextSourcePath("node_modules/app/page.tsx")).toBeUndefined();
    expect(classifyNextSourcePath(".next/server/app/page.js")).toBeUndefined();
    expect(classifyNextSourcePath("pages/api/health.ts")).toBeUndefined();
    expect(classifyNextSourcePath("pages/_app.tsx")).toBeUndefined();
    expect(classifyNextSourcePath("app/products/styles.css")).toBeUndefined();
  });
});

describe("createSearchLintNextConfig", () => {
  it("injects the dev client only for development client builds", async () => {
    const configFactory = createSearchLintNextConfig(identityConfig(), {
      catalogText: "categories: []\nrules: []\n"
    });
    const config = configFactory(nextDevelopmentServerPhase);
    const result = config.webpack!(
      { entry: { main: ["next-client"] }, plugins: [] },
      { dev: true, isServer: false, webpack: webpackStub() }
    );

    expect((await callEntry(result)).main).toEqual([
      "@searchlint/next/dev-client",
      "next-client"
    ]);
    expect(result.plugins).toHaveLength(1);
  });

  it("leaves production config unchanged without adding a webpack hook", () => {
    const inputConfig = identityConfig();
    const configFactory = createSearchLintNextConfig(inputConfig, {
      catalogText: "categories: []\nrules: []\n"
    });

    expect(configFactory(nextProductionBuildPhase)).toBe(inputConfig);
  });

  it("resolves function configs before adding development-only integration", async () => {
    const configFactory = createSearchLintNextConfig(
      (phase) => ({
        env: { phase },
        ...identityConfig()
      }),
      {
        catalogText: "categories: []\nrules: []\n"
      }
    );
    const config = configFactory(nextDevelopmentServerPhase);
    const result = config.webpack!(
      { entry: { main: ["next-client"] }, plugins: [] },
      { dev: true, isServer: false, webpack: webpackStub() }
    );

    expect(config.env).toEqual({ phase: nextDevelopmentServerPhase });
    expect((await callEntry(result)).main).toContain(
      "@searchlint/next/dev-client"
    );
  });

  it("loads the bundled rule catalog when catalogText is omitted", () => {
    const configFactory = createSearchLintNextConfig(identityConfig());
    const config = configFactory(nextDevelopmentServerPhase);
    const result = config.webpack!(
      { entry: { main: ["next-client"] }, plugins: [] },
      { dev: true, isServer: false, webpack: webpackStub() }
    );

    expect(result.plugins).toHaveLength(1);
  });

  it("passes configured siteUrl to the development client bundle", () => {
    const configFactory = createSearchLintNextConfig(identityConfig(), {
      catalogText: "categories: []\nrules: []\n",
      siteUrl: "https://example.com"
    });
    const config = configFactory(nextDevelopmentServerPhase);
    const result = config.webpack!(
      { entry: { main: ["next-client"] }, plugins: [] },
      { dev: true, isServer: false, webpack: webpackStub() }
    );
    const plugin = result.plugins?.at(0) as
      | { definitions: Readonly<Record<string, string>> }
      | undefined;

    expect(plugin?.definitions.__SEARCHLINT_SITE_URL__).toBe(
      JSON.stringify("https://example.com")
    );
  });

  it("reports zero production impact checks", () => {
    const report = createZeroImpactReport({
      clientBundleBytesDelta: 0,
      searchLintClientModules: [],
      productionHttpRequests: [],
      runtimeHooks: [],
      searchLintDomElements: 0,
      routeOutputChanged: false,
      searchLintGlobals: [],
      serverUsesOverlayRuntime: false
    });

    expect(report.every((row) => row.pass)).toBe(true);
    expect(
      hasSearchLintProductionImpact({
        clientBundleBytesDelta: 1,
        searchLintClientModules: [],
        productionHttpRequests: [],
        runtimeHooks: [],
        searchLintDomElements: 0,
        routeOutputChanged: false,
        searchLintGlobals: [],
        serverUsesOverlayRuntime: false
      })
    ).toBe(true);
  });
});

describe("dev client analysis", () => {
  it("runs the current document through the real catalog and shared core", async () => {
    const diagnostics = await analyzeCurrentDocument({
      catalogText: readFileSync("../../specs/RULE_CATALOG.yaml", "utf8"),
      document: {
        location: {
          href: "https://example.com/products/1",
          pathname: "/products/1"
        },
        documentElement: {
          outerHTML:
            '<html><head><meta name="robots" content="noindex"></head><body><h1>Product</h1></body></html>'
        }
      } as Document,
      now: () => "2026-06-21T00:00:00.000Z"
    });

    expect(diagnostics.map((diagnostic) => diagnostic.ruleId)).toContain(
      "SL-META-001"
    );
  });

  it("uses siteUrl to avoid local dev canonical origin noise", async () => {
    const diagnostics = await analyzeCurrentDocument({
      catalogText: readFileSync("../../specs/RULE_CATALOG.yaml", "utf8"),
      siteUrl: "https://example.com",
      document: {
        location: {
          href: "http://localhost:3001/products/1",
          pathname: "/products/1"
        },
        documentElement: {
          outerHTML:
            '<html><head><title>Product</title><meta name="description" content="Useful product page description."><link rel="canonical" href="https://example.com/products/1"></head><body><h1>Product</h1></body></html>'
        }
      } as Document,
      now: () => "2026-06-21T00:00:00.000Z"
    });

    expect(diagnostics.map((diagnostic) => diagnostic.ruleId)).not.toContain(
      "SL-CANON-006"
    );
    expect(diagnostics.map((diagnostic) => diagnostic.ruleId)).not.toContain(
      "SL-CANON-007"
    );
  });
});

describe("buildNextRouteMetadataSummaries", () => {
  it("summarizes route-local and inherited static metadata fields", () => {
    const model = buildNextRouteModel(
      discoverNextProjectSourceFiles([
        "app/layout.tsx",
        "app/products/layout.tsx",
        "app/products/[slug]/page.tsx"
      ]).sourceFiles
    );

    expect(
      buildNextRouteMetadataSummaries(model, [
        {
          kind: "static-metadata-field",
          file: "app/layout.tsx",
          field: "title"
        },
        {
          kind: "static-metadata-field",
          file: "app/products/layout.tsx",
          field: "openGraph"
        },
        {
          kind: "static-metadata-field",
          file: "app/products/[slug]/page.tsx",
          field: "description"
        }
      ])
    ).toEqual([
      {
        route: "/products/[slug]",
        router: "app",
        pageFile: "app/products/[slug]/page.tsx",
        metadataMode: "static",
        staticFields: [
          {
            field: "description",
            file: "app/products/[slug]/page.tsx",
            inherited: false
          },
          {
            field: "openGraph",
            file: "app/products/layout.tsx",
            inherited: true
          },
          { field: "title", file: "app/layout.tsx", inherited: true }
        ],
        dynamicMetadata: []
      }
    ]);
  });

  it("summarizes dynamic metadata without fabricating fields", () => {
    const model = buildNextRouteModel(
      discoverNextProjectSourceFiles(["app/blog/[slug]/page.tsx"]).sourceFiles
    );

    expect(
      buildNextRouteMetadataSummaries(model, [
        {
          kind: "generate-metadata",
          file: "app/blog/[slug]/page.tsx"
        }
      ])
    ).toEqual([
      {
        route: "/blog/[slug]",
        router: "app",
        pageFile: "app/blog/[slug]/page.tsx",
        metadataMode: "dynamic",
        staticFields: [],
        dynamicMetadata: [
          { file: "app/blog/[slug]/page.tsx", inherited: false }
        ]
      }
    ]);
  });

  it("represents static and dynamic metadata together", () => {
    const model = buildNextRouteModel(
      discoverNextProjectSourceFiles([
        "app/layout.tsx",
        "app/category/page.tsx"
      ]).sourceFiles
    );

    expect(
      buildNextRouteMetadataSummaries(model, [
        {
          kind: "static-metadata-object",
          file: "app/layout.tsx"
        },
        {
          kind: "generate-metadata",
          file: "app/category/page.tsx"
        }
      ])
    ).toEqual([
      {
        route: "/category",
        router: "app",
        pageFile: "app/category/page.tsx",
        metadataMode: "static-and-dynamic",
        staticFields: [],
        dynamicMetadata: [{ file: "app/category/page.tsx", inherited: false }]
      }
    ]);
  });

  it("does not inherit App Router layouts into Pages Router summaries", () => {
    const model = buildNextRouteModel(
      discoverNextProjectSourceFiles([
        "app/layout.tsx",
        "pages/products/[slug].tsx"
      ]).sourceFiles
    );

    expect(
      buildNextRouteMetadataSummaries(model, [
        {
          kind: "static-metadata-field",
          file: "app/layout.tsx",
          field: "title"
        }
      ])
    ).toEqual([
      {
        route: "/products/[slug]",
        router: "pages",
        pageFile: "pages/products/[slug].tsx",
        metadataMode: "none",
        staticFields: [],
        dynamicMetadata: []
      }
    ]);
  });
});

describe("discoverNextProjectSourceFiles", () => {
  it("returns unique source files in stable path order", () => {
    expect(
      discoverNextProjectSourceFiles([
        "app/z/page.tsx",
        "app/a/page.tsx",
        "app/z/page.tsx",
        ".next/server/app/page.js",
        "pages/index.tsx"
      ]).sourceFiles
    ).toEqual([
      { path: "app/a/page.tsx", kind: "app-route" },
      { path: "app/z/page.tsx", kind: "app-route" },
      { path: "pages/index.tsx", kind: "pages-route" }
    ]);
  });
});

describe("buildNextRouteModel", () => {
  it("builds stable App Router route entries with layouts and handlers", () => {
    const discovery = discoverNextProjectSourceFiles([
      "src/app/layout.tsx",
      "src/app/(shop)/products/[slug]/layout.tsx",
      "src/app/(shop)/products/[slug]/page.tsx",
      "src/app/(shop)/products/[slug]/route.ts"
    ]);

    expect(
      buildNextRouteModel(discovery.sourceFiles, [
        {
          kind: "static-metadata-object",
          file: "src/app/(shop)/products/[slug]/page.tsx"
        }
      ]).routes
    ).toEqual([
      {
        route: "/products/[slug]",
        router: "app",
        pageFile: "src/app/(shop)/products/[slug]/page.tsx",
        layouts: [
          "src/app/(shop)/products/[slug]/layout.tsx",
          "src/app/layout.tsx"
        ],
        routeHandler: "src/app/(shop)/products/[slug]/route.ts",
        dynamicSegments: ["[slug]"],
        metadataMode: "static"
      }
    ]);
  });

  it("builds App Router route entries for groups, parallel slots, intercepting routes, and optional catch-all segments", () => {
    const discovery = discoverNextProjectSourceFiles([
      "app/page.tsx",
      "app/(marketing)/about/page.tsx",
      "app/@modal/(.)photos/[id]/page.tsx",
      "app/docs/[[...slug]]/page.tsx",
      "app/blog/[...slug]/page.tsx"
    ]);

    expect(buildNextRouteModel(discovery.sourceFiles).routes).toEqual([
      {
        route: "/",
        router: "app",
        pageFile: "app/page.tsx",
        layouts: [],
        dynamicSegments: [],
        metadataMode: "none"
      },
      {
        route: "/about",
        router: "app",
        pageFile: "app/(marketing)/about/page.tsx",
        layouts: [],
        dynamicSegments: [],
        metadataMode: "none"
      },
      {
        route: "/blog/[...slug]",
        router: "app",
        pageFile: "app/blog/[...slug]/page.tsx",
        layouts: [],
        dynamicSegments: ["[...slug]"],
        metadataMode: "none"
      },
      {
        route: "/docs/[[...slug]]",
        router: "app",
        pageFile: "app/docs/[[...slug]]/page.tsx",
        layouts: [],
        dynamicSegments: ["[[...slug]]"],
        metadataMode: "none"
      },
      {
        route: "/photos/[id]",
        router: "app",
        pageFile: "app/@modal/(.)photos/[id]/page.tsx",
        layouts: [],
        dynamicSegments: ["[id]"],
        metadataMode: "none"
      }
    ]);
  });

  it("builds Pages Router entries and preserves catch-all segments", () => {
    const discovery = discoverNextProjectSourceFiles([
      "pages/index.tsx",
      "pages/docs/[...slug].tsx",
      "pages/blog/[[...slug]].tsx"
    ]);

    expect(buildNextRouteModel(discovery.sourceFiles).routes).toEqual([
      {
        route: "/",
        router: "pages",
        pageFile: "pages/index.tsx",
        layouts: [],
        dynamicSegments: [],
        metadataMode: "none"
      },
      {
        route: "/blog/[[...slug]]",
        router: "pages",
        pageFile: "pages/blog/[[...slug]].tsx",
        layouts: [],
        dynamicSegments: ["[[...slug]]"],
        metadataMode: "none"
      },
      {
        route: "/docs/[...slug]",
        router: "pages",
        pageFile: "pages/docs/[...slug].tsx",
        layouts: [],
        dynamicSegments: ["[...slug]"],
        metadataMode: "none"
      }
    ]);
  });

  it("represents dynamic metadata mode without executing source", () => {
    const discovery = discoverNextProjectSourceFiles([
      "app/blog/[slug]/page.tsx"
    ]);

    expect(
      buildNextRouteModel(discovery.sourceFiles, [
        {
          kind: "generate-metadata",
          file: "app/blog/[slug]/page.tsx"
        }
      ]).routes
    ).toEqual([
      {
        route: "/blog/[slug]",
        router: "app",
        pageFile: "app/blog/[slug]/page.tsx",
        layouts: [],
        dynamicSegments: ["[slug]"],
        metadataMode: "dynamic"
      }
    ]);
  });
});

describe("buildNextConfigSummary", () => {
  it("summarizes Next config redirect and rewrite awareness", () => {
    const discovery = discoverNextProjectSourceFiles([
      "next.config.mjs",
      "src/next.config.ts",
      "app/page.tsx"
    ]);

    expect(
      buildNextConfigSummary(discovery.sourceFiles, [
        {
          kind: "next-config-rewrites",
          file: "src/next.config.ts",
          configRouteEntries: [
            {
              source: "/proxy/:path*",
              destination: "https://example.com/:path*"
            }
          ]
        },
        {
          kind: "next-config-redirects",
          file: "next.config.mjs",
          configRouteEntries: [
            {
              source: "/old",
              destination: "/new",
              permanent: true
            }
          ]
        },
        {
          kind: "next-config-redirects",
          file: "next.config.mjs"
        }
      ])
    ).toEqual({
      configFiles: ["next.config.mjs", "src/next.config.ts"],
      redirectsFiles: ["next.config.mjs"],
      rewritesFiles: ["src/next.config.ts"],
      redirectEntries: [
        {
          file: "next.config.mjs",
          source: "/old",
          destination: "/new",
          permanent: true
        }
      ],
      rewriteEntries: [
        {
          file: "src/next.config.ts",
          source: "/proxy/:path*",
          destination: "https://example.com/:path*"
        }
      ]
    });
  });
});

function identityConfig() {
  return {
    webpack(config: NextWebpackConfig) {
      return config;
    }
  };
}

async function callEntry(
  config: NextWebpackConfig
): Promise<Record<string, string[]>> {
  if (typeof config.entry !== "function") {
    throw new Error("Expected entry function");
  }
  return (await config.entry()) as Record<string, string[]>;
}

function webpackStub(): NonNullable<NextWebpackContext["webpack"]> {
  return {
    DefinePlugin: class DefinePlugin {
      definitions: Readonly<Record<string, string>>;
      constructor(definitions: Readonly<Record<string, string>>) {
        this.definitions = definitions;
      }
    }
  };
}
