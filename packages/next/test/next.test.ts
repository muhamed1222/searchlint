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
import {
  analyzeCurrentDocument,
  collectGeoAudit,
  collectLinkAudit,
  collectLocalPerformance,
  collectSiteEssentials,
  collectTechnicalAudit,
  fetchGooglePageSpeed,
  parseGooglePageSpeedResponse,
  resolvePageSpeedPageUrl,
  rerunSearchLintDevClient
} from "../src/dev-client.js";
import type { SearchLintOverlayRuntime } from "@searchlint/overlay";

describe("@searchlint/next package metadata", () => {
  it("exposes top-level types for classic TypeScript module resolution", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
      types?: string;
      exports?: Record<string, { types?: string }>;
    };

    expect(packageJson.types).toBe("./dist/src/index.d.ts");
    expect(packageJson.exports?.["."]?.types).toBe("./dist/src/index.d.ts");
  });
});

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

  it("accepts Next.js typed configs where webpack is null", async () => {
    const configFactory = createSearchLintNextConfig(
      {
        env: { searchlint: "enabled" },
        webpack: null
      },
      {
        catalogText: "categories: []\nrules: []\n"
      }
    );
    const config = configFactory(nextDevelopmentServerPhase);
    const result = config.webpack!(
      { entry: { main: ["next-client"] }, plugins: [] },
      { dev: true, isServer: false, webpack: webpackStub() }
    );

    expect(config.env).toEqual({ searchlint: "enabled" });
    expect((await callEntry(result)).main).toEqual([
      "@searchlint/next/dev-client",
      "next-client"
    ]);
  });

  it("accepts framework-typed Next configs without index signatures", async () => {
    type FrameworkWebpackContext = {
      dir: string;
      buildId: string;
      dev: boolean;
      isServer: boolean;
      config: { distDir: string };
      defaultLoaders: Record<string, unknown>;
      totalPages: number;
      webpack: {
        DefinePlugin: new (
          definitions: Readonly<Record<string, string>>
        ) => unknown;
      };
    };
    type FrameworkTypedNextConfig = {
      env?: Record<string, string>;
      webpack?: (
        config: { entry?: unknown; plugins?: unknown[] },
        context: FrameworkWebpackContext
      ) => { entry?: unknown; plugins?: unknown[] };
    };
    const frameworkConfig: FrameworkTypedNextConfig = {
      env: { searchlint: "enabled" },
      webpack(config) {
        return config;
      }
    };
    const configFactory = createSearchLintNextConfig(frameworkConfig, {
      catalogText: "categories: []\nrules: []\n"
    });

    expect(configFactory).toBeTypeOf("function");
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

  it("resolves async function configs before adding development-only integration", async () => {
    const configFactory = createSearchLintNextConfig(
      async (phase) => ({
        env: { phase },
        ...identityConfig()
      }),
      {
        catalogText: "categories: []\nrules: []\n"
      }
    );
    const config = await configFactory(nextDevelopmentServerPhase);
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
      siteUrl: "https://example.com",
      pageSpeed: {
        enabled: true,
        strategy: "desktop",
        apiKey: "psi-key"
      }
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
    expect(plugin?.definitions.__SEARCHLINT_PAGESPEED_ENABLED__).toBe(
      JSON.stringify(true)
    );
    expect(plugin?.definitions.__SEARCHLINT_PAGESPEED_STRATEGY__).toBe(
      JSON.stringify("desktop")
    );
    expect(plugin?.definitions.__SEARCHLINT_PAGESPEED_API_KEY__).toBe(
      JSON.stringify("psi-key")
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

  it("clears stale action feedback after successful reruns", async () => {
    const updates: unknown[] = [];

    await rerunSearchLintDevClient(
      createRuntimeRecorder(updates),
      {
        defaultView: performanceWindow(),
        location: {
          href: "https://example.com/products/1",
          pathname: "/products/1"
        },
        documentElement: {
          outerHTML:
            '<html><head><meta name="robots" content="noindex"></head><body><h1>Product</h1></body></html>'
        }
      } as Document,
      readFileSync("../../specs/RULE_CATALOG.yaml", "utf8")
    );

    expect(updates[0]).toMatchObject({
      status: "checking",
      actionMessage: "Rerunning SearchLint..."
    });
    expect(updates.at(-1)).toMatchObject({
      pageUrl: "https://example.com/products/1",
      route: "/products/1",
      localPerformance: {
        source: "browser-performance",
        viewport: { width: 1310, height: 1255 },
        fcpMs: 1200,
        lcpMs: 2400,
        tbtMs: 120,
        cls: 0.08,
        loadMs: 2800,
        domContentLoadedMs: 1600
      },
      actionMessage: undefined,
      runtimeError: undefined
    });
  });

  it("collects local browser performance metrics for the overlay feed", () => {
    expect(
      collectLocalPerformance({
        defaultView: performanceWindow()
      } as Document)
    ).toMatchObject({
      source: "browser-performance",
      viewport: { width: 1310, height: 1255 },
      fcpMs: 1200,
      lcpMs: 2400,
      tbtMs: 120,
      cls: 0.08,
      loadMs: 2800,
      domContentLoadedMs: 1600
    });
  });

  it("resolves PageSpeed URLs from the configured public site URL", () => {
    expect(
      resolvePageSpeedPageUrl(
        {
          location: {
            href: "http://localhost:3001/products/1?ref=dev",
            pathname: "/products/1",
            search: "?ref=dev"
          }
        } as Document,
        "https://example.com"
      )
    ).toBe("https://example.com/products/1?ref=dev");

    expect(
      resolvePageSpeedPageUrl({
        location: {
          href: "http://localhost:3001/products/1",
          pathname: "/products/1",
          search: ""
        }
      } as Document)
    ).toBeUndefined();
  });

  it("parses Google PageSpeed category scores and lab vitals", () => {
    expect(
      parseGooglePageSpeedResponse(
        googlePageSpeedPayload(),
        "https://example.com/products/1",
        "mobile",
        "2026-06-25T00:00:00.000Z"
      )
    ).toMatchObject({
      source: "google-pagespeed",
      status: "available",
      strategy: "mobile",
      pageUrl: "https://example.com/products/1",
      fetchedAt: "2026-06-25T00:00:00.000Z",
      scores: {
        performance: 88,
        accessibility: 100,
        bestPractices: 73,
        seo: 100
      },
      vitals: {
        lcpMs: 2400,
        fcpMs: 1200,
        tbtMs: 120,
        cls: 0.08
      }
    });
  });

  it("fetches Google PageSpeed with all visible feed categories", async () => {
    const requestedUrls: string[] = [];
    const pageSpeed = await fetchGooglePageSpeed(
      "https://example.com/products/1",
      "desktop",
      "psi-key",
      async (url) => {
        requestedUrls.push(url);
        return {
          ok: true,
          status: 200,
          async json() {
            return googlePageSpeedPayload();
          }
        };
      }
    );

    const requestUrl = new URL(requestedUrls[0] ?? "");
    expect(requestUrl.origin + requestUrl.pathname).toBe(
      "https://www.googleapis.com/pagespeedonline/v5/runPagespeed"
    );
    expect(requestUrl.searchParams.get("url")).toBe(
      "https://example.com/products/1"
    );
    expect(requestUrl.searchParams.get("strategy")).toBe("desktop");
    expect(requestUrl.searchParams.get("key")).toBe("psi-key");
    expect(requestUrl.searchParams.getAll("category")).toEqual([
      "performance",
      "accessibility",
      "best-practices",
      "seo"
    ]);
    expect(pageSpeed.scores?.performance).toBe(88);
  });

  it("updates the overlay with PageSpeed provider results after rerun", async () => {
    const updates: unknown[] = [];

    await rerunSearchLintDevClient(
      createRuntimeRecorder(updates),
      {
        defaultView: performanceWindow(),
        location: {
          href: "http://localhost:3001/products/1",
          pathname: "/products/1",
          search: ""
        },
        documentElement: {
          outerHTML:
            '<html><head><title>Product</title><meta name="description" content="Useful product page description."></head><body><h1>Product</h1></body></html>'
        }
      } as Document,
      readFileSync("../../specs/RULE_CATALOG.yaml", "utf8"),
      "https://example.com",
      {
        enabled: true,
        strategy: "mobile",
        apiKey: "psi-key",
        fetch: async () => ({
          ok: true,
          status: 200,
          async json() {
            return googlePageSpeedPayload();
          }
        })
      }
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(updates).toContainEqual(
      expect.objectContaining({
        externalMetrics: {
          pageSpeed: expect.objectContaining({
            status: "checking",
            pageUrl: "https://example.com/products/1"
          })
        }
      })
    );
    expect(updates.at(-1)).toMatchObject({
      externalMetrics: {
        pageSpeed: {
          status: "available",
          scores: {
            performance: 88,
            accessibility: 100,
            bestPractices: 73,
            seo: 100
          }
        }
      }
    });
  });

  it("does not call Google PageSpeed when the API key is missing", async () => {
    const updates: unknown[] = [];
    let fetchCalled = false;

    await rerunSearchLintDevClient(
      createRuntimeRecorder(updates),
      {
        defaultView: performanceWindow(),
        location: {
          href: "http://localhost:3001/products/1",
          pathname: "/products/1",
          search: ""
        },
        documentElement: {
          outerHTML:
            '<html><head><title>Product</title><meta name="description" content="Useful product page description."></head><body><h1>Product</h1></body></html>'
        }
      } as Document,
      readFileSync("../../specs/RULE_CATALOG.yaml", "utf8"),
      "https://example.com",
      {
        enabled: true,
        strategy: "mobile",
        fetch: async () => {
          fetchCalled = true;
          return {
            ok: true,
            status: 200,
            async json() {
              return googlePageSpeedPayload();
            }
          };
        }
      }
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(fetchCalled).toBe(false);
    expect(updates.at(-1)).toMatchObject({
      externalMetrics: {
        pageSpeed: {
          status: "unavailable",
          pageUrl: "https://example.com/products/1",
          message:
            "Set SEARCHLINT_PAGESPEED_API_KEY to fetch Google PageSpeed scores."
        }
      }
    });
  });

  it("collects internal and external links from the current browser DOM", () => {
    const document = {
      location: {
        href: "http://localhost:3001/",
        origin: "http://localhost:3001",
        pathname: "/"
      },
      querySelectorAll(selector: string) {
        expect(selector).toBe("a[href]");
        return [
          anchor("/pricing#plans", "Pricing"),
          anchor("https://outlivion.space/pricing", "Pricing duplicate"),
          anchor("/vpn-dlya-rossii", "VPN for Russia"),
          anchor("https://t.me/outlivion", "Telegram", {
            rel: "noopener",
            target: "_blank"
          }),
          anchor("mailto:support@example.com", "Email"),
          anchor("#faq", "FAQ")
        ];
      }
    } as unknown as Document;

    const audit = collectLinkAudit(document, "https://outlivion.space");

    expect(audit).toMatchObject({
      source: "browser-dom",
      pageUrl: "http://localhost:3001/",
      siteOrigin: "https://outlivion.space",
      backlinks: {
        status: "not-configured"
      }
    });
    expect(audit?.internalLinks).toEqual([
      {
        url: "https://outlivion.space/pricing",
        label: "Pricing",
        count: 2
      },
      {
        url: "https://outlivion.space/vpn-dlya-rossii",
        label: "VPN for Russia",
        count: 1
      }
    ]);
    expect(audit?.externalLinks).toEqual([
      {
        url: "https://t.me/outlivion",
        label: "Telegram",
        count: 1,
        rel: "noopener",
        target: "_blank"
      }
    ]);
  });

  it("collects site essentials from conventional local URLs", async () => {
    const requested: string[] = [];
    const document = {
      location: {
        href: "http://localhost:3001/",
        origin: "http://localhost:3001",
        pathname: "/"
      }
    } as unknown as Document;

    const audit = await collectSiteEssentials(document, async (url) => {
      requested.push(url);
      const status = url.endsWith("/__searchlint_missing_page__") ? 404 : 200;
      return {
        ok: status >= 200 && status < 300,
        status,
        async text() {
          if (url.endsWith("/robots.txt")) return "User-agent: *\nAllow: /\n";
          if (url.endsWith("/sitemap.xml")) return "<urlset></urlset>";
          if (url.endsWith("/llms.txt")) return "# LLM discovery\n";
          return "";
        }
      };
    });

    expect(requested).toEqual([
      "http://localhost:3001/robots.txt",
      "http://localhost:3001/sitemap.xml",
      "http://localhost:3001/llms.txt",
      "http://localhost:3001/__searchlint_missing_page__"
    ]);
    expect(audit).toMatchObject({
      source: "browser-fetch",
      pageUrl: "http://localhost:3001/"
    });
    expect(audit?.essentials).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "robots",
          label: "robots.txt",
          status: "pass"
        }),
        expect.objectContaining({
          key: "sitemap",
          label: "sitemap.xml",
          status: "pass"
        }),
        expect.objectContaining({
          key: "llms",
          label: "llms.txt",
          status: "pass"
        }),
        expect.objectContaining({
          key: "not-found",
          label: "404 / not-found",
          status: "pass"
        }),
        expect.objectContaining({
          key: "mobile",
          label: "Mobile check",
          status: "not-proven",
          detail: expect.stringContaining("Viewport width is unavailable")
        }),
        expect.objectContaining({
          key: "crawler",
          label: "Full-site crawl",
          status: "provider-needed"
        })
      ])
    );
  });

  it("reports missing site essentials without pretending provider coverage exists", async () => {
    const document = {
      location: {
        href: "http://localhost:3001/",
        origin: "http://localhost:3001",
        pathname: "/"
      }
    } as unknown as Document;

    const audit = await collectSiteEssentials(document, async (url) => ({
      ok: false,
      status: url.endsWith("/robots.txt")
        ? 200
        : url.endsWith("/__searchlint_missing_page__")
          ? 200
          : 404,
      async text() {
        return url.endsWith("/robots.txt") ? "User-agent: *\nAllow: /\n" : "";
      }
    }));

    expect(audit?.essentials).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "robots", status: "pass" }),
        expect.objectContaining({
          key: "sitemap",
          status: "issue",
          detail: expect.stringContaining("sitemap.xml is missing")
        }),
        expect.objectContaining({
          key: "llms",
          status: "issue",
          detail: expect.stringContaining("llms.txt is missing")
        }),
        expect.objectContaining({
          key: "not-found",
          status: "issue",
          detail: expect.stringContaining("instead of 404/410")
        }),
        expect.objectContaining({
          key: "mobile",
          status: "not-proven"
        }),
        expect.objectContaining({
          key: "crawler",
          status: "provider-needed"
        })
      ])
    );
  });

  it("marks mobile site essentials pass only for narrow viewports", async () => {
    const document = {
      location: {
        href: "http://localhost:3001/",
        origin: "http://localhost:3001",
        pathname: "/"
      },
      defaultView: { innerWidth: 390 }
    } as unknown as Document;

    const audit = await collectSiteEssentials(document, async (url) => ({
      ok: true,
      status: url.endsWith("/__searchlint_missing_page__") ? 404 : 200,
      async text() {
        return "ok";
      }
    }));

    expect(audit?.essentials).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "mobile",
          label: "Mobile check",
          status: "pass",
          detail: expect.stringContaining("390px")
        })
      ])
    );
  });

  it("collects GEO audit signals from locale metadata, page text, and market links", () => {
    const document = {
      location: {
        href: "http://localhost:3001/",
        origin: "http://localhost:3001"
      },
      documentElement: {
        outerHTML:
          '<html lang="ru"><head><meta property="og:locale" content="ru_RU"><link rel="alternate" hreflang="en" href="https://outlivion.space/en"><link rel="alternate" hreflang="hi" href="https://outlivion.space/hi"></head><body>VPN для России Telegram 10 ₽ поездки Android iPhone Windows</body></html>',
        getAttribute(name: string) {
          return name === "lang" ? "ru" : null;
        }
      },
      body: {
        textContent:
          "VPN для России Telegram 10 ₽ поездки Android iPhone Windows"
      },
      querySelector(selector: string) {
        if (selector === 'meta[property="og:locale"]') {
          return {
            getAttribute(attribute: string) {
              return attribute === "content" ? "ru_RU" : null;
            }
          };
        }
        return null;
      },
      querySelectorAll(selector: string) {
        if (selector === 'link[rel="alternate"][hreflang]') {
          return [
            {
              getAttribute(name: string) {
                if (name === "hreflang") return "en";
                if (name === "href") return "https://outlivion.space/en";
                return null;
              }
            },
            {
              getAttribute(name: string) {
                if (name === "hreflang") return "hi";
                if (name === "href") return "https://outlivion.space/hi";
                return null;
              }
            }
          ];
        }
        if (selector === "a[href]") {
          return [
            anchor("/vpn-dlya-rossii", "VPN для России"),
            anchor("/en", "EN")
          ];
        }
        return [];
      }
    } as unknown as Document;
    const linkAudit = collectLinkAudit(document, "https://outlivion.space");
    const audit = collectGeoAudit(document, linkAudit);

    expect(audit).toMatchObject({
      source: "browser-dom",
      pageUrl: "http://localhost:3001/",
      primaryMarket: "Russia / ru-RU",
      detectedLanguage: "ru",
      locale: "ru_RU",
      hreflangStatus: "present"
    });
    expect(audit?.languageSignals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "HTML lang", value: "ru" }),
        expect.objectContaining({ label: "OG locale", value: "ru_RU" }),
        expect.objectContaining({
          label: "Alternate languages",
          value: "en, hi"
        })
      ])
    );
    expect(audit?.regionalSignals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Russia intent", value: "Detected" }),
        expect.objectContaining({ label: "Local currency", value: "Detected" }),
        expect.objectContaining({
          label: "Telegram channel",
          value: "Detected"
        })
      ])
    );
    expect(audit?.marketCoverage).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          market: "Russia",
          url: "https://outlivion.space/vpn-dlya-rossii"
        }),
        expect.objectContaining({
          market: "English",
          url: "https://outlivion.space/en"
        })
      ])
    );
    expect(audit?.providers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Google Search Console",
          value: "Not connected"
        }),
        expect.objectContaining({
          label: "Yandex Webmaster",
          value: "Not connected"
        })
      ])
    );
  });

  it("collects technical audit data from DOM and navigation timing", () => {
    const document = {
      title: "Fast VPN for travel",
      location: {
        href: "http://localhost:3001/",
        pathname: "/"
      },
      documentElement: {
        outerHTML:
          '<html><head><meta name="description" content="Fast VPN for travel and public Wi-Fi"><meta property="og:type" content="website"><meta name="twitter:card" content="summary_large_image"><script src="/app.js"></script><link rel="stylesheet" href="/app.css"></head><body>Fast VPN for travel and public Wi-Fi</body></html>'
      },
      body: {
        textContent: "Fast VPN for travel and public Wi-Fi"
      },
      defaultView: {
        performance: {
          getEntriesByType(type: string) {
            if (type !== "navigation") return [];
            return [
              {
                transferSize: 111_000,
                decodedBodySize: 155_000,
                domInteractive: 553,
                domComplete: 2645,
                connectStart: 0,
                connectEnd: 0,
                secureConnectionStart: 0,
                requestStart: 10,
                responseStart: 496,
                responseEnd: 499
              }
            ];
          }
        }
      },
      querySelector(selector: string) {
        const html = document.documentElement.outerHTML;
        const namePrefix = 'meta[name="';
        const propertyPrefix = 'meta[property="';
        const name = selector.startsWith(namePrefix)
          ? selector.slice(namePrefix.length, -2)
          : undefined;
        const property = selector.startsWith(propertyPrefix)
          ? selector.slice(propertyPrefix.length, -2)
          : undefined;
        const key = name ?? property;
        const content = key
          ? html.match(
              new RegExp(`<meta (?:name|property)="${key}" content="([^"]+)"`)
            )?.[1]
          : undefined;
        return content === undefined
          ? null
          : {
              getAttribute(attribute: string) {
                return attribute === "content" ? content : null;
              }
            };
      },
      querySelectorAll(selector: string) {
        if (selector === "script[src]") return [{}];
        if (selector === 'link[rel~="stylesheet"]') return [{}];
        return [];
      }
    } as unknown as Document;

    const audit = collectTechnicalAudit(document, []);

    expect(audit).toMatchObject({
      source: "browser-dom",
      pageUrl: "http://localhost:3001/",
      score: 62
    });
    expect(audit?.overview).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Status", value: "200" }),
        expect.objectContaining({ label: "Page Size", value: "108 KB" })
      ])
    );
    expect(audit?.timings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "TTFB", value: "486ms" }),
        expect.objectContaining({ label: "Download", value: "3ms" })
      ])
    );
    expect(audit?.renderBlocking).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Blocking Scripts", value: "1" }),
        expect.objectContaining({ label: "Blocking Stylesheets", value: "1" })
      ])
    );
    expect(audit?.openGraph).toContainEqual(
      expect.objectContaining({ label: "og:type", value: "website" })
    );
    expect(audit?.twitter).toContainEqual(
      expect.objectContaining({
        label: "twitter:card",
        value: "summary_large_image"
      })
    );
  });

  it("reports rerun failures in overlay state", async () => {
    const updates: unknown[] = [];

    await rerunSearchLintDevClient(
      createRuntimeRecorder(updates),
      {
        location: {
          href: "https://example.com/products/1",
          pathname: "/products/1"
        },
        documentElement: {
          outerHTML: "<html><head></head><body></body></html>"
        }
      } as Document,
      "not: [valid"
    );

    expect(updates[0]).toMatchObject({
      status: "checking",
      actionMessage: "Rerunning SearchLint..."
    });
    expect(updates.at(-1)).toMatchObject({
      status: "errors",
      actionMessage: undefined
    });
    expect(
      String((updates.at(-1) as { runtimeError?: string }).runtimeError)
    ).toBeTruthy();
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

function createRuntimeRecorder(updates: unknown[]): SearchLintOverlayRuntime {
  return {
    host: { isConnected: true } as HTMLElement,
    shadowRoot: {} as ShadowRoot,
    update(state) {
      updates.push(state);
    },
    open() {},
    close() {},
    destroy() {}
  };
}

function performanceWindow(): Window {
  const entries: Record<string, PerformanceEntry[]> = {
    navigation: [
      {
        name: "https://example.com/products/1",
        entryType: "navigation",
        startTime: 0,
        duration: 2800,
        loadEventEnd: 2800,
        domContentLoadedEventEnd: 1600
      } as PerformanceNavigationTiming
    ],
    paint: [
      {
        name: "first-contentful-paint",
        entryType: "paint",
        startTime: 1200,
        duration: 0
      } as PerformanceEntry
    ],
    "largest-contentful-paint": [
      {
        name: "",
        entryType: "largest-contentful-paint",
        startTime: 2400,
        duration: 0
      } as PerformanceEntry
    ],
    longtask: [
      {
        name: "self",
        entryType: "longtask",
        startTime: 1300,
        duration: 170
      } as PerformanceEntry
    ],
    "layout-shift": [
      {
        name: "",
        entryType: "layout-shift",
        startTime: 1400,
        duration: 0,
        value: 0.08,
        hadRecentInput: false
      } as PerformanceEntry & { value: number; hadRecentInput: boolean }
    ]
  };
  return {
    innerWidth: 1310,
    innerHeight: 1255,
    setTimeout() {
      return 0;
    },
    performance: {
      getEntriesByType(type: string): PerformanceEntry[] {
        return entries[type] ?? [];
      }
    }
  } as unknown as Window;
}

function anchor(
  href: string,
  textContent: string,
  attributes: { rel?: string; target?: string } = {}
): HTMLAnchorElement {
  return {
    textContent,
    getAttribute(name: string) {
      if (name === "href") return href;
      if (name === "rel") return attributes.rel ?? null;
      if (name === "target") return attributes.target ?? null;
      if (name === "aria-label" || name === "title") return null;
      return null;
    }
  } as HTMLAnchorElement;
}

function googlePageSpeedPayload(): unknown {
  return {
    lighthouseResult: {
      categories: {
        performance: { score: 0.88 },
        accessibility: { score: 1 },
        "best-practices": { score: 0.73 },
        seo: { score: 1 }
      },
      audits: {
        "largest-contentful-paint": { numericValue: 2400 },
        "first-contentful-paint": { numericValue: 1200 },
        "total-blocking-time": { numericValue: 120 },
        "cumulative-layout-shift": { numericValue: 0.08 }
      }
    }
  };
}
