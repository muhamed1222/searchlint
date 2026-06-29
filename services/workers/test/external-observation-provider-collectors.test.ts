import { describe, expect, it } from "vitest";

import {
  createConfiguredExternalObservationTargetResolver,
  createExternalObservationProviderCollectors
} from "../src/index.js";
import type {
  ExternalObservationProviderTargetResolver,
  GoogleExternalObservationTarget,
  YandexExternalObservationTarget
} from "../src/index.js";
import type {
  ExternalObservationProvider,
  ExternalObservationRecord,
  GoogleCruxInput,
  GooglePageSpeedInput,
  GoogleProviderAdapter,
  GoogleSearchAnalyticsInput,
  GoogleSitemapInput,
  GoogleUrlInspectionInput,
  OAuthConnectionRecord,
  YandexMetricaLandingPageInput,
  YandexProviderAdapter,
  YandexSitemapInput,
  YandexUrlStatusInput
} from "@searchlint/api";

describe("createConfiguredExternalObservationTargetResolver", () => {
  it("builds provider targets from explicit configuration", async () => {
    const resolver = createConfiguredExternalObservationTargetResolver({
      subjectUrls: ["https://example.test/", "https://example.test/about"],
      sitemapUrls: ["https://example.test/sitemap.xml"],
      googleSearchAnalytics: {
        startDate: "2026-06-01",
        endDate: "2026-06-10",
        dimensions: ["page", "query"]
      },
      googlePageSpeed: {
        enabled: true,
        strategy: "desktop",
        categories: ["performance", "seo"]
      },
      googleCrux: {
        enabled: true,
        formFactor: "PHONE",
        effectiveConnectionType: "4G"
      },
      yandexMetrica: {
        counterId: "counter-1",
        startDate: "2026-06-01",
        endDate: "2026-06-10",
        metrics: ["ym:s:visits"]
      }
    });

    await expect(
      Promise.resolve(
        resolver.google({
          connection: connection({ provider: "google" }),
          now: "2026-06-21T00:00:00.000Z"
        })
      )
    ).resolves.toEqual([
      {
        kind: "url-inspection",
        subjectUrl: "https://example.test/"
      },
      {
        kind: "url-inspection",
        subjectUrl: "https://example.test/about"
      },
      {
        kind: "search-analytics",
        subjectUrl: "https://example.test/",
        startDate: "2026-06-01",
        endDate: "2026-06-10",
        dimensions: ["page", "query"]
      },
      {
        kind: "search-analytics",
        subjectUrl: "https://example.test/about",
        startDate: "2026-06-01",
        endDate: "2026-06-10",
        dimensions: ["page", "query"]
      },
      {
        kind: "pagespeed",
        subjectUrl: "https://example.test/",
        strategy: "desktop",
        categories: ["performance", "seo"]
      },
      {
        kind: "pagespeed",
        subjectUrl: "https://example.test/about",
        strategy: "desktop",
        categories: ["performance", "seo"]
      },
      {
        kind: "crux",
        subjectUrl: "https://example.test/",
        formFactor: "PHONE",
        effectiveConnectionType: "4G"
      },
      {
        kind: "crux",
        subjectUrl: "https://example.test/about",
        formFactor: "PHONE",
        effectiveConnectionType: "4G"
      },
      {
        kind: "sitemap",
        sitemapUrl: "https://example.test/sitemap.xml"
      }
    ]);

    await expect(
      Promise.resolve(
        resolver.yandex({
          connection: connection({ provider: "yandex" }),
          now: "2026-06-21T00:00:00.000Z"
        })
      )
    ).resolves.toEqual([
      {
        kind: "url-status",
        subjectUrl: "https://example.test/"
      },
      {
        kind: "url-status",
        subjectUrl: "https://example.test/about"
      },
      {
        kind: "metrica-landing-page",
        counterId: "counter-1",
        subjectUrl: "https://example.test/",
        startDate: "2026-06-01",
        endDate: "2026-06-10",
        metrics: ["ym:s:visits"]
      },
      {
        kind: "metrica-landing-page",
        counterId: "counter-1",
        subjectUrl: "https://example.test/about",
        startDate: "2026-06-01",
        endDate: "2026-06-10",
        metrics: ["ym:s:visits"]
      },
      {
        kind: "sitemap",
        sitemapUrl: "https://example.test/sitemap.xml"
      }
    ]);
  });

  it("returns no targets when target configuration is empty", async () => {
    const resolver = createConfiguredExternalObservationTargetResolver({});

    await expect(
      Promise.resolve(
        resolver.google({
          connection: connection({ provider: "google" }),
          now: "2026-06-21T00:00:00.000Z"
        })
      )
    ).resolves.toEqual([]);
    await expect(
      Promise.resolve(
        resolver.yandex({
          connection: connection({ provider: "yandex" }),
          now: "2026-06-21T00:00:00.000Z"
        })
      )
    ).resolves.toEqual([]);
  });

  it("combines explicit and discovered targets in stable bounded order", async () => {
    const resolver = createConfiguredExternalObservationTargetResolver({
      subjectUrls: [
        "https://example.test/",
        "https://example.test/products/widget"
      ],
      sitemapUrls: ["https://example.test/sitemap.xml"],
      discovery: {
        siteUrls: [
          "https://example.test/products/widget?ref=searchlint",
          "https://blog.example.test/articles/launch"
        ],
        sitemapUrls: [
          "https://example.test/sitemap.xml",
          "https://cdn.example.test/sitemap-products.xml"
        ],
        maxSubjectUrls: 3
      },
      googleSearchAnalytics: {
        startDate: "2026-06-01",
        endDate: "2026-06-10"
      },
      yandexMetrica: {
        counterId: "counter-1",
        startDate: "2026-06-01",
        endDate: "2026-06-10"
      }
    });

    await expect(
      Promise.resolve(
        resolver.google({
          connection: connection({ provider: "google" }),
          now: "2026-06-21T00:00:00.000Z"
        })
      )
    ).resolves.toEqual([
      {
        kind: "url-inspection",
        subjectUrl: "https://example.test/"
      },
      {
        kind: "url-inspection",
        subjectUrl: "https://example.test/products/widget"
      },
      {
        kind: "url-inspection",
        subjectUrl: "https://blog.example.test/"
      },
      {
        kind: "search-analytics",
        subjectUrl: "https://example.test/",
        startDate: "2026-06-01",
        endDate: "2026-06-10"
      },
      {
        kind: "search-analytics",
        subjectUrl: "https://example.test/products/widget",
        startDate: "2026-06-01",
        endDate: "2026-06-10"
      },
      {
        kind: "search-analytics",
        subjectUrl: "https://blog.example.test/",
        startDate: "2026-06-01",
        endDate: "2026-06-10"
      },
      {
        kind: "sitemap",
        sitemapUrl: "https://example.test/sitemap.xml"
      },
      {
        kind: "sitemap",
        sitemapUrl: "https://cdn.example.test/sitemap-products.xml"
      },
      {
        kind: "sitemap",
        sitemapUrl: "https://blog.example.test/sitemap.xml"
      }
    ]);

    await expect(
      Promise.resolve(
        resolver.yandex({
          connection: connection({ provider: "yandex" }),
          now: "2026-06-21T00:00:00.000Z"
        })
      )
    ).resolves.toEqual([
      {
        kind: "url-status",
        subjectUrl: "https://example.test/"
      },
      {
        kind: "url-status",
        subjectUrl: "https://example.test/products/widget"
      },
      {
        kind: "url-status",
        subjectUrl: "https://blog.example.test/"
      },
      {
        kind: "metrica-landing-page",
        counterId: "counter-1",
        subjectUrl: "https://example.test/",
        startDate: "2026-06-01",
        endDate: "2026-06-10"
      },
      {
        kind: "metrica-landing-page",
        counterId: "counter-1",
        subjectUrl: "https://example.test/products/widget",
        startDate: "2026-06-01",
        endDate: "2026-06-10"
      },
      {
        kind: "metrica-landing-page",
        counterId: "counter-1",
        subjectUrl: "https://blog.example.test/",
        startDate: "2026-06-01",
        endDate: "2026-06-10"
      },
      {
        kind: "sitemap",
        sitemapUrl: "https://example.test/sitemap.xml"
      },
      {
        kind: "sitemap",
        sitemapUrl: "https://cdn.example.test/sitemap-products.xml"
      },
      {
        kind: "sitemap",
        sitemapUrl: "https://blog.example.test/sitemap.xml"
      }
    ]);
  });

  it("rejects invalid target discovery URL limits", () => {
    expect(() =>
      createConfiguredExternalObservationTargetResolver({
        discovery: {
          siteUrls: ["https://example.test/"],
          maxSubjectUrls: 0
        }
      }).google({
        connection: connection({ provider: "google" }),
        now: "2026-06-21T00:00:00.000Z"
      })
    ).toThrow(
      "External observation target discovery maxSubjectUrls must be a positive integer."
    );
  });
});

describe("createExternalObservationProviderCollectors", () => {
  it("routes Google targets through the Google provider adapter", async () => {
    const google = new RecordingGoogleAdapter();
    const collectors = createExternalObservationProviderCollectors({
      googleAdapter: google,
      yandexAdapter: new RecordingYandexAdapter(),
      targetResolver: targetResolver({
        google: [
          {
            kind: "url-inspection",
            subjectUrl: "https://example.test/"
          },
          {
            kind: "search-analytics",
            subjectUrl: "https://example.test/",
            startDate: "2026-06-01",
            endDate: "2026-06-10"
          },
          {
            kind: "sitemap",
            sitemapUrl: "https://example.test/sitemap.xml"
          },
          {
            kind: "pagespeed",
            subjectUrl: "https://example.test/",
            strategy: "mobile"
          },
          {
            kind: "crux",
            subjectUrl: "https://example.test/",
            formFactor: "DESKTOP"
          }
        ],
        yandex: []
      })
    });

    await expect(
      collectors.google.collectExternalObservations({
        connection: connection({
          provider: "google",
          providerAccountId: "sc-domain:example.test",
          retentionUntil: "2026-07-21T00:00:00.000Z"
        }),
        accessToken: "google-token",
        now: "2026-06-21T00:00:00.000Z"
      })
    ).resolves.toHaveLength(5);

    expect(google.urlInspectionInputs).toMatchObject([
      {
        siteUrl: "sc-domain:example.test",
        subjectUrl: "https://example.test/",
        accessToken: "google-token",
        retentionUntil: "2026-07-21T00:00:00.000Z"
      }
    ]);
    expect(google.searchAnalyticsInputs).toMatchObject([
      {
        subjectUrl: "https://example.test/",
        startDate: "2026-06-01",
        endDate: "2026-06-10"
      }
    ]);
    expect(google.sitemapInputs).toMatchObject([
      {
        sitemapUrl: "https://example.test/sitemap.xml"
      }
    ]);
    expect(google.pageSpeedInputs).toMatchObject([
      {
        subjectUrl: "https://example.test/",
        strategy: "mobile"
      }
    ]);
    expect(google.cruxInputs).toMatchObject([
      {
        subjectUrl: "https://example.test/",
        formFactor: "DESKTOP"
      }
    ]);
  });

  it("routes Yandex targets through the Yandex provider adapter", async () => {
    const yandex = new RecordingYandexAdapter();
    const collectors = createExternalObservationProviderCollectors({
      googleAdapter: new RecordingGoogleAdapter(),
      yandexAdapter: yandex,
      targetResolver: targetResolver({
        google: [],
        yandex: [
          {
            kind: "url-status",
            subjectUrl: "https://example.test/"
          },
          {
            kind: "metrica-landing-page",
            counterId: "counter-1",
            subjectUrl: "https://example.test/",
            startDate: "2026-06-01",
            endDate: "2026-06-10"
          },
          {
            kind: "sitemap",
            sitemapUrl: "https://example.test/sitemap.xml"
          }
        ]
      })
    });

    await expect(
      collectors.yandex.collectExternalObservations({
        connection: connection({
          provider: "yandex",
          providerAccountId: "host-1"
        }),
        accessToken: "yandex-token",
        now: "2026-06-21T00:00:00.000Z"
      })
    ).resolves.toHaveLength(3);

    expect(yandex.urlStatusInputs).toMatchObject([
      {
        siteHostId: "host-1",
        subjectUrl: "https://example.test/",
        accessToken: "yandex-token"
      }
    ]);
    expect(yandex.metricaInputs).toMatchObject([
      {
        counterId: "counter-1",
        subjectUrl: "https://example.test/",
        startDate: "2026-06-01",
        endDate: "2026-06-10"
      }
    ]);
    expect(yandex.sitemapInputs).toMatchObject([
      {
        sitemapUrl: "https://example.test/sitemap.xml"
      }
    ]);
  });
});

class RecordingGoogleAdapter implements GoogleProviderAdapter {
  readonly urlInspectionInputs: GoogleUrlInspectionInput[] = [];
  readonly searchAnalyticsInputs: GoogleSearchAnalyticsInput[] = [];
  readonly sitemapInputs: GoogleSitemapInput[] = [];
  readonly pageSpeedInputs: GooglePageSpeedInput[] = [];
  readonly cruxInputs: GoogleCruxInput[] = [];

  async inspectUrl(
    input: GoogleUrlInspectionInput
  ): Promise<ExternalObservationRecord> {
    this.urlInspectionInputs.push(input);
    return observation({
      provider: "google",
      source: "google.urlInspection",
      subjectUrl: input.subjectUrl
    });
  }

  async querySearchAnalytics(
    input: GoogleSearchAnalyticsInput
  ): Promise<ExternalObservationRecord> {
    this.searchAnalyticsInputs.push(input);
    return observation({
      provider: "google",
      source: "google.searchAnalytics",
      subjectUrl: input.subjectUrl
    });
  }

  async getSitemap(
    input: GoogleSitemapInput
  ): Promise<ExternalObservationRecord> {
    this.sitemapInputs.push(input);
    return observation({
      provider: "google",
      source: "google.sitemap",
      subjectUrl: input.sitemapUrl
    });
  }

  async runPageSpeed(
    input: GooglePageSpeedInput
  ): Promise<ExternalObservationRecord> {
    this.pageSpeedInputs.push(input);
    return observation({
      provider: "google",
      source: "google.pagespeed",
      subjectUrl: input.subjectUrl
    });
  }

  async queryCrux(input: GoogleCruxInput): Promise<ExternalObservationRecord> {
    this.cruxInputs.push(input);
    return observation({
      provider: "google",
      source: "google.crux",
      subjectUrl: input.subjectUrl
    });
  }
}

class RecordingYandexAdapter implements YandexProviderAdapter {
  readonly urlStatusInputs: YandexUrlStatusInput[] = [];
  readonly metricaInputs: YandexMetricaLandingPageInput[] = [];
  readonly sitemapInputs: YandexSitemapInput[] = [];

  async getUrlStatus(
    input: YandexUrlStatusInput
  ): Promise<ExternalObservationRecord> {
    this.urlStatusInputs.push(input);
    return observation({
      provider: "yandex",
      source: "yandex.webmaster",
      subjectUrl: input.subjectUrl
    });
  }

  async queryMetricaLandingPage(
    input: YandexMetricaLandingPageInput
  ): Promise<ExternalObservationRecord> {
    this.metricaInputs.push(input);
    return observation({
      provider: "yandex",
      source: "yandex.metrica",
      subjectUrl: input.subjectUrl
    });
  }

  async getSitemap(
    input: YandexSitemapInput
  ): Promise<ExternalObservationRecord> {
    this.sitemapInputs.push(input);
    return observation({
      provider: "yandex",
      source: "yandex.webmaster",
      subjectUrl: input.sitemapUrl
    });
  }
}

function targetResolver(input: {
  google: readonly GoogleExternalObservationTarget[];
  yandex: readonly YandexExternalObservationTarget[];
}): ExternalObservationProviderTargetResolver {
  return {
    google() {
      return input.google;
    },
    yandex() {
      return input.yandex;
    }
  };
}

function connection(
  overrides: Partial<OAuthConnectionRecord> & {
    provider: ExternalObservationProvider;
  }
): OAuthConnectionRecord {
  const { provider, ...rest } = overrides;
  return {
    id: `${provider}-connection`,
    organizationId: "org-1",
    projectId: "project-1",
    environmentId: "env-1",
    provider,
    providerAccountId:
      provider === "google" ? "sc-domain:example.test" : "host-1",
    scopes: ["scope-1"],
    accessTokenSecretRef: `secret://org-1/${provider}/access-token`,
    refreshTokenSecretRef: `secret://org-1/${provider}/refresh-token`,
    expiresAt: "2026-06-21T00:00:00.000Z",
    status: "active",
    deletionState: "active",
    createdAt: "2026-06-20T00:00:00.000Z",
    ...rest
  };
}

function observation(input: {
  provider: ExternalObservationProvider;
  source: ExternalObservationRecord["source"];
  subjectUrl: string;
}): ExternalObservationRecord {
  return {
    id: `${input.provider}-observation`,
    organizationId: "org-1",
    projectId: "project-1",
    environmentId: "env-1",
    provider: input.provider,
    source: input.source,
    subjectUrl: input.subjectUrl,
    observedAt: "2026-06-21T00:00:00.000Z",
    fetchedAt: "2026-06-21T00:00:00.000Z",
    freshness: "fresh",
    payload: {},
    fingerprint: `${input.provider}:${input.source}:${input.subjectUrl}`,
    deletionState: "active",
    createdAt: "2026-06-21T00:00:00.000Z"
  };
}
