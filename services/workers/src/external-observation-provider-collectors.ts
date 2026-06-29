import {
  createGoogleProviderAdapter,
  createYandexProviderAdapter,
  type ExternalObservationRecord,
  type GoogleCruxFormFactor,
  type GooglePageSpeedCategory,
  type GooglePageSpeedStrategy,
  type GoogleProviderAdapter,
  type GoogleProviderFetch,
  type OAuthConnectionRecord,
  type YandexProviderAdapter,
  type YandexProviderFetch
} from "@searchlint/api";

import type {
  ExternalObservationProviderCollector,
  ExternalObservationProviderCollectorInput,
  ExternalObservationProviderCollectors
} from "./external-observation-collection-worker.js";

export type GoogleExternalObservationTarget =
  | {
      kind: "url-inspection";
      subjectUrl: string;
      siteUrl?: string;
    }
  | {
      kind: "search-analytics";
      subjectUrl: string;
      startDate: string;
      endDate: string;
      dimensions?: readonly string[];
      siteUrl?: string;
    }
  | {
      kind: "sitemap";
      sitemapUrl: string;
      siteUrl?: string;
    }
  | {
      kind: "pagespeed";
      subjectUrl: string;
      strategy?: GooglePageSpeedStrategy;
      categories?: readonly GooglePageSpeedCategory[];
      siteUrl?: string;
    }
  | {
      kind: "crux";
      subjectUrl: string;
      formFactor?: GoogleCruxFormFactor;
      effectiveConnectionType?: string;
      siteUrl?: string;
    };

export type YandexExternalObservationTarget =
  | {
      kind: "url-status";
      subjectUrl: string;
      siteHostId?: string;
    }
  | {
      kind: "sitemap";
      sitemapUrl: string;
      siteHostId?: string;
    }
  | {
      kind: "metrica-landing-page";
      counterId: string;
      subjectUrl: string;
      startDate: string;
      endDate: string;
      metrics?: readonly string[];
      siteHostId?: string;
    };

export type ExternalObservationProviderTargetResolverInput = {
  connection: OAuthConnectionRecord;
  now: string;
};

export type ExternalObservationProviderTargetResolver = {
  google(
    input: ExternalObservationProviderTargetResolverInput
  ):
    | Promise<readonly GoogleExternalObservationTarget[]>
    | readonly GoogleExternalObservationTarget[];
  yandex(
    input: ExternalObservationProviderTargetResolverInput
  ):
    | Promise<readonly YandexExternalObservationTarget[]>
    | readonly YandexExternalObservationTarget[];
};

export type ExternalObservationProviderTargetConfig = {
  subjectUrls?: readonly string[];
  sitemapUrls?: readonly string[];
  discovery?: ExternalObservationTargetDiscoveryConfig;
  googleSearchAnalytics?: {
    startDate: string;
    endDate: string;
    dimensions?: readonly string[];
  };
  googlePageSpeed?: {
    enabled: boolean;
    strategy?: GooglePageSpeedStrategy;
    categories?: readonly GooglePageSpeedCategory[];
  };
  googleCrux?: {
    enabled: boolean;
    formFactor?: GoogleCruxFormFactor;
    effectiveConnectionType?: string;
  };
  yandexMetrica?: {
    counterId: string;
    startDate: string;
    endDate: string;
    metrics?: readonly string[];
  };
};

export type ExternalObservationTargetDiscoveryConfig = {
  siteUrls?: readonly string[];
  sitemapUrls?: readonly string[];
  maxSubjectUrls: number;
};

export type ExternalObservationProviderCollectorsOptions = {
  googleAdapter?: GoogleProviderAdapter;
  yandexAdapter?: YandexProviderAdapter;
  fetch?: GoogleProviderFetch & YandexProviderFetch;
  targetResolver: ExternalObservationProviderTargetResolver;
};

export function createExternalObservationProviderCollectors(
  options: ExternalObservationProviderCollectorsOptions
): ExternalObservationProviderCollectors {
  const fetch = options.fetch ?? nativeJsonFetch;
  const googleAdapter =
    options.googleAdapter ??
    createGoogleProviderAdapter({
      fetch
    });
  const yandexAdapter =
    options.yandexAdapter ??
    createYandexProviderAdapter({
      fetch
    });

  return {
    google: createGoogleExternalObservationCollector({
      adapter: googleAdapter,
      targetResolver: options.targetResolver
    }),
    yandex: createYandexExternalObservationCollector({
      adapter: yandexAdapter,
      targetResolver: options.targetResolver
    })
  };
}

export function createGoogleExternalObservationCollector(options: {
  adapter: GoogleProviderAdapter;
  targetResolver: Pick<ExternalObservationProviderTargetResolver, "google">;
}): ExternalObservationProviderCollector {
  return {
    async collectExternalObservations(input) {
      const targets = await options.targetResolver.google({
        connection: input.connection,
        now: input.now
      });
      const records: ExternalObservationRecord[] = [];
      for (const target of targets) {
        records.push(
          ...(await collectGoogleTarget(options.adapter, input, target))
        );
      }
      return records;
    }
  };
}

export function createYandexExternalObservationCollector(options: {
  adapter: YandexProviderAdapter;
  targetResolver: Pick<ExternalObservationProviderTargetResolver, "yandex">;
}): ExternalObservationProviderCollector {
  return {
    async collectExternalObservations(input) {
      const targets = await options.targetResolver.yandex({
        connection: input.connection,
        now: input.now
      });
      const records: ExternalObservationRecord[] = [];
      for (const target of targets) {
        records.push(
          ...(await collectYandexTarget(options.adapter, input, target))
        );
      }
      return records;
    }
  };
}

export function createConfiguredExternalObservationTargetResolver(
  input: ExternalObservationProviderTargetConfig
): ExternalObservationProviderTargetResolver {
  const subjectUrls = discoveredSubjectUrls(input);
  const sitemapUrls = discoveredSitemapUrls(input);
  return {
    google() {
      return [
        ...subjectUrls.map(
          (subjectUrl): GoogleExternalObservationTarget => ({
            kind: "url-inspection",
            subjectUrl
          })
        ),
        ...googleSearchAnalyticsTargets(
          subjectUrls,
          input.googleSearchAnalytics
        ),
        ...googlePageSpeedTargets(subjectUrls, input.googlePageSpeed),
        ...googleCruxTargets(subjectUrls, input.googleCrux),
        ...sitemapUrls.map(
          (sitemapUrl): GoogleExternalObservationTarget => ({
            kind: "sitemap",
            sitemapUrl
          })
        )
      ];
    },
    yandex() {
      return [
        ...subjectUrls.map(
          (subjectUrl): YandexExternalObservationTarget => ({
            kind: "url-status",
            subjectUrl
          })
        ),
        ...yandexMetricaTargets(subjectUrls, input.yandexMetrica),
        ...sitemapUrls.map(
          (sitemapUrl): YandexExternalObservationTarget => ({
            kind: "sitemap",
            sitemapUrl
          })
        )
      ];
    }
  };
}

function discoveredSubjectUrls(
  input: ExternalObservationProviderTargetConfig
): readonly string[] {
  const maxSubjectUrls = input.discovery?.maxSubjectUrls;
  if (
    maxSubjectUrls !== undefined &&
    (!Number.isInteger(maxSubjectUrls) || maxSubjectUrls < 1)
  ) {
    throw new Error(
      "External observation target discovery maxSubjectUrls must be a positive integer."
    );
  }

  return uniqueStable([
    ...(input.subjectUrls ?? []),
    ...(input.discovery?.siteUrls ?? []).map(siteRootUrl)
  ]).slice(0, maxSubjectUrls);
}

function discoveredSitemapUrls(
  input: ExternalObservationProviderTargetConfig
): readonly string[] {
  return uniqueStable([
    ...(input.sitemapUrls ?? []),
    ...(input.discovery?.sitemapUrls ?? []),
    ...(input.discovery?.siteUrls ?? []).map(defaultSitemapUrl)
  ]);
}

function siteRootUrl(url: string): string {
  const parsed = new URL(url);
  parsed.pathname = "/";
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString();
}

function defaultSitemapUrl(url: string): string {
  const parsed = new URL(url);
  parsed.pathname = "/sitemap.xml";
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString();
}

function uniqueStable(values: readonly string[]): readonly string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }
    seen.add(value);
    unique.push(value);
  }
  return unique;
}

async function collectGoogleTarget(
  adapter: GoogleProviderAdapter,
  input: ExternalObservationProviderCollectorInput,
  target: GoogleExternalObservationTarget
): Promise<readonly ExternalObservationRecord[]> {
  const scope = {
    organizationId: input.connection.organizationId,
    projectId: input.connection.projectId,
    environmentId: input.connection.environmentId,
    accessToken: input.accessToken,
    siteUrl: target.siteUrl ?? input.connection.providerAccountId,
    fetchedAt: input.now,
    ...(input.connection.retentionUntil === undefined
      ? {}
      : { retentionUntil: input.connection.retentionUntil })
  };

  if (target.kind === "url-inspection") {
    return [
      await adapter.inspectUrl({
        ...scope,
        subjectUrl: target.subjectUrl
      })
    ];
  }
  if (target.kind === "search-analytics") {
    return [
      await adapter.querySearchAnalytics({
        ...scope,
        subjectUrl: target.subjectUrl,
        startDate: target.startDate,
        endDate: target.endDate,
        ...(target.dimensions === undefined
          ? {}
          : { dimensions: target.dimensions })
      })
    ];
  }
  if (target.kind === "pagespeed") {
    return [
      await adapter.runPageSpeed({
        ...scope,
        subjectUrl: target.subjectUrl,
        ...(target.strategy === undefined ? {} : { strategy: target.strategy }),
        ...(target.categories === undefined
          ? {}
          : { categories: target.categories })
      })
    ];
  }
  if (target.kind === "crux") {
    return [
      await adapter.queryCrux({
        ...scope,
        subjectUrl: target.subjectUrl,
        ...(target.formFactor === undefined
          ? {}
          : { formFactor: target.formFactor }),
        ...(target.effectiveConnectionType === undefined
          ? {}
          : { effectiveConnectionType: target.effectiveConnectionType })
      })
    ];
  }
  return [
    await adapter.getSitemap({
      ...scope,
      sitemapUrl: target.sitemapUrl
    })
  ];
}

async function collectYandexTarget(
  adapter: YandexProviderAdapter,
  input: ExternalObservationProviderCollectorInput,
  target: YandexExternalObservationTarget
): Promise<readonly ExternalObservationRecord[]> {
  const scope = {
    organizationId: input.connection.organizationId,
    projectId: input.connection.projectId,
    environmentId: input.connection.environmentId,
    accessToken: input.accessToken,
    siteHostId: target.siteHostId ?? input.connection.providerAccountId,
    fetchedAt: input.now,
    ...(input.connection.retentionUntil === undefined
      ? {}
      : { retentionUntil: input.connection.retentionUntil })
  };

  if (target.kind === "url-status") {
    return [
      await adapter.getUrlStatus({
        ...scope,
        subjectUrl: target.subjectUrl
      })
    ];
  }
  if (target.kind === "metrica-landing-page") {
    return [
      await adapter.queryMetricaLandingPage({
        ...scope,
        counterId: target.counterId,
        subjectUrl: target.subjectUrl,
        startDate: target.startDate,
        endDate: target.endDate,
        ...(target.metrics === undefined ? {} : { metrics: target.metrics })
      })
    ];
  }
  return [
    await adapter.getSitemap({
      ...scope,
      sitemapUrl: target.sitemapUrl
    })
  ];
}

function googleSearchAnalyticsTargets(
  subjectUrls: readonly string[],
  config:
    | {
        startDate: string;
        endDate: string;
        dimensions?: readonly string[];
      }
    | undefined
): readonly GoogleExternalObservationTarget[] {
  if (config === undefined) {
    return [];
  }
  return subjectUrls.map((subjectUrl) => ({
    kind: "search-analytics" as const,
    subjectUrl,
    startDate: config.startDate,
    endDate: config.endDate,
    ...(config.dimensions === undefined
      ? {}
      : { dimensions: config.dimensions })
  }));
}

function googlePageSpeedTargets(
  subjectUrls: readonly string[],
  config:
    | {
        enabled: boolean;
        strategy?: GooglePageSpeedStrategy;
        categories?: readonly GooglePageSpeedCategory[];
      }
    | undefined
): readonly GoogleExternalObservationTarget[] {
  if (config?.enabled !== true) {
    return [];
  }
  return subjectUrls.map((subjectUrl) => ({
    kind: "pagespeed" as const,
    subjectUrl,
    ...(config.strategy === undefined ? {} : { strategy: config.strategy }),
    ...(config.categories === undefined
      ? {}
      : { categories: config.categories })
  }));
}

function googleCruxTargets(
  subjectUrls: readonly string[],
  config:
    | {
        enabled: boolean;
        formFactor?: GoogleCruxFormFactor;
        effectiveConnectionType?: string;
      }
    | undefined
): readonly GoogleExternalObservationTarget[] {
  if (config?.enabled !== true) {
    return [];
  }
  return subjectUrls.map((subjectUrl) => ({
    kind: "crux" as const,
    subjectUrl,
    ...(config.formFactor === undefined
      ? {}
      : { formFactor: config.formFactor }),
    ...(config.effectiveConnectionType === undefined
      ? {}
      : { effectiveConnectionType: config.effectiveConnectionType })
  }));
}

function yandexMetricaTargets(
  subjectUrls: readonly string[],
  config:
    | {
        counterId: string;
        startDate: string;
        endDate: string;
        metrics?: readonly string[];
      }
    | undefined
): readonly YandexExternalObservationTarget[] {
  if (config === undefined) {
    return [];
  }
  return subjectUrls.map((subjectUrl) => ({
    kind: "metrica-landing-page" as const,
    counterId: config.counterId,
    subjectUrl,
    startDate: config.startDate,
    endDate: config.endDate,
    ...(config.metrics === undefined ? {} : { metrics: config.metrics })
  }));
}

const nativeJsonFetch: GoogleProviderFetch & YandexProviderFetch = async (
  url,
  init
) => fetch(url, init);
