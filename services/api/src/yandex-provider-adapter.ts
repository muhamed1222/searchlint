import type {
  ExternalObservationFreshness,
  ExternalObservationQuota,
  ExternalObservationRecord,
  ExternalObservationSampling,
  ExternalObservationSource
} from "./types.js";

export type YandexProviderHttpHeaders = {
  get(name: string): string | null | undefined;
};

export type YandexProviderHttpResponse = {
  ok: boolean;
  status: number;
  headers?: YandexProviderHttpHeaders;
  json(): Promise<unknown>;
};

export type YandexProviderFetch = (
  url: string,
  init: {
    method: "GET" | "POST";
    headers: Readonly<Record<string, string>>;
    body?: string;
  }
) => Promise<YandexProviderHttpResponse>;

export type YandexProviderAdapterOptions = {
  fetch: YandexProviderFetch;
  endpointBaseUrl?: string;
};

export type YandexProviderObservationScope = {
  organizationId: string;
  projectId: string;
  environmentId: string;
  accessToken: string;
  siteHostId: string;
  fetchedAt: string;
  retentionUntil?: string;
};

export type YandexUrlStatusInput = YandexProviderObservationScope & {
  subjectUrl: string;
};

export type YandexSitemapInput = YandexProviderObservationScope & {
  sitemapUrl: string;
};

export type YandexMetricaLandingPageInput = YandexProviderObservationScope & {
  counterId: string;
  subjectUrl: string;
  startDate: string;
  endDate: string;
  metrics?: readonly string[];
};

export type YandexProviderAdapter = {
  getUrlStatus(input: YandexUrlStatusInput): Promise<ExternalObservationRecord>;
  getSitemap(input: YandexSitemapInput): Promise<ExternalObservationRecord>;
  queryMetricaLandingPage(
    input: YandexMetricaLandingPageInput
  ): Promise<ExternalObservationRecord>;
};

export class YandexProviderAdapterError extends Error {
  readonly status: number;
  readonly payload: unknown;

  constructor(status: number, payload: unknown) {
    super(`Yandex provider request failed with status ${status}.`);
    this.name = "YandexProviderAdapterError";
    this.status = status;
    this.payload = payload;
  }
}

export function createYandexProviderAdapter(
  options: YandexProviderAdapterOptions
): YandexProviderAdapter {
  const endpointBaseUrl =
    options.endpointBaseUrl ?? "https://api.searchlint-yandex-provider.local";

  return {
    async getUrlStatus(input) {
      const response = await request(options.fetch, {
        endpointBaseUrl,
        accessToken: input.accessToken,
        path: `/webmaster/v1/hosts/${encodeURIComponent(
          input.siteHostId
        )}/url-status?url=${encodeURIComponent(input.subjectUrl)}`
      });
      const payload = await response.json();
      return observationRecord({
        scope: input,
        source: "yandex.webmaster",
        subjectUrl: input.subjectUrl,
        payload,
        quota: quotaFromHeaders(response.headers),
        sampling: {
          sampled: false
        },
        observedAt: observedAtFromWebmasterUrlStatus(payload, input.fetchedAt)
      });
    },

    async getSitemap(input) {
      const response = await request(options.fetch, {
        endpointBaseUrl,
        accessToken: input.accessToken,
        path: `/webmaster/v1/hosts/${encodeURIComponent(
          input.siteHostId
        )}/sitemaps/${encodeURIComponent(input.sitemapUrl)}`
      });
      const payload = await response.json();
      return observationRecord({
        scope: input,
        source: "yandex.webmaster",
        subjectUrl: input.sitemapUrl,
        payload,
        quota: quotaFromHeaders(response.headers),
        sampling: {
          sampled: false
        },
        observedAt: observedAtFromWebmasterSitemap(payload, input.fetchedAt)
      });
    },

    async queryMetricaLandingPage(input) {
      const response = await request(options.fetch, {
        endpointBaseUrl,
        accessToken: input.accessToken,
        path: `/metrica/v1/counters/${encodeURIComponent(
          input.counterId
        )}/landing-pages/query`,
        body: {
          date1: input.startDate,
          date2: input.endDate,
          metrics: input.metrics ?? ["ym:s:visits"],
          dimensions: ["ym:s:startURL"],
          filters: `ym:s:startURL=='${escapeMetricaFilterValue(
            input.subjectUrl
          )}'`
        }
      });
      const payload = await response.json();
      return observationRecord({
        scope: input,
        source: "yandex.metrica",
        subjectUrl: input.subjectUrl,
        payload,
        quota: quotaFromHeaders(response.headers),
        sampling: samplingFromMetricaPayload(payload),
        observedAt: `${input.endDate}T00:00:00.000Z`
      });
    }
  };
}

async function request(
  fetch: YandexProviderFetch,
  input: {
    endpointBaseUrl: string;
    accessToken: string;
    path: string;
    body?: Readonly<Record<string, unknown>>;
  }
): Promise<YandexProviderHttpResponse> {
  const response = await fetch(`${input.endpointBaseUrl}${input.path}`, {
    method: input.body === undefined ? "GET" : "POST",
    headers: {
      authorization: `OAuth ${input.accessToken}`,
      accept: "application/json",
      ...(input.body === undefined
        ? {}
        : { "content-type": "application/json" })
    },
    ...(input.body === undefined ? {} : { body: JSON.stringify(input.body) })
  });
  if (!response.ok) {
    throw new YandexProviderAdapterError(
      response.status,
      await response.json()
    );
  }
  return response;
}

function observationRecord(input: {
  scope: YandexProviderObservationScope;
  source: Extract<
    ExternalObservationSource,
    "yandex.webmaster" | "yandex.metrica"
  >;
  subjectUrl: string;
  observedAt: string;
  payload: unknown;
  quota: ExternalObservationQuota | undefined;
  sampling: ExternalObservationSampling;
}): ExternalObservationRecord {
  const fingerprint = fingerprintFor(input);
  return {
    id: stableId(fingerprint),
    organizationId: input.scope.organizationId,
    projectId: input.scope.projectId,
    environmentId: input.scope.environmentId,
    provider: "yandex",
    source: input.source,
    subjectUrl: input.subjectUrl,
    observedAt: input.observedAt,
    fetchedAt: input.scope.fetchedAt,
    freshness: freshness(input.observedAt, input.scope.fetchedAt),
    payload: payloadObject(input.payload),
    ...(input.quota === undefined ? {} : { quota: input.quota }),
    sampling: input.sampling,
    fingerprint,
    ...(input.scope.retentionUntil === undefined
      ? {}
      : { retentionUntil: input.scope.retentionUntil }),
    deletionState: "active",
    createdAt: input.scope.fetchedAt
  };
}

function observedAtFromWebmasterUrlStatus(
  payload: unknown,
  fallback: string
): string {
  const value = plainObject(payload);
  const checkedAt = value.checkedAt;
  const lastCrawlTime = value.lastCrawlTime;
  const indexedAt = value.indexedAt;
  if (typeof checkedAt === "string") {
    return checkedAt;
  }
  if (typeof lastCrawlTime === "string") {
    return lastCrawlTime;
  }
  return typeof indexedAt === "string" ? indexedAt : fallback;
}

function observedAtFromWebmasterSitemap(
  payload: unknown,
  fallback: string
): string {
  const value = plainObject(payload);
  const lastProcessedAt = value.lastProcessedAt;
  const lastDownloaded = value.lastDownloaded;
  const lastSubmitted = value.lastSubmitted;
  if (typeof lastProcessedAt === "string") {
    return lastProcessedAt;
  }
  if (typeof lastDownloaded === "string") {
    return lastDownloaded;
  }
  return typeof lastSubmitted === "string" ? lastSubmitted : fallback;
}

function samplingFromMetricaPayload(
  payload: unknown
): ExternalObservationSampling {
  const value = plainObject(payload);
  const sampled = value.sampled;
  if (typeof sampled !== "boolean") {
    return {
      sampled: false
    };
  }
  const state = value.samplingState ?? value.sampleShare ?? value.sampleSize;
  return {
    sampled,
    ...(state === undefined ? {} : { state: String(state) })
  };
}

function escapeMetricaFilterValue(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("'", "\\'");
}

function freshness(
  observedAt: string,
  fetchedAt: string
): ExternalObservationFreshness {
  const observed = Date.parse(observedAt);
  const fetched = Date.parse(fetchedAt);
  if (!Number.isFinite(observed) || !Number.isFinite(fetched)) {
    return "unknown";
  }
  const ageDays = Math.max(0, (fetched - observed) / 86_400_000);
  if (ageDays <= 7) {
    return "fresh";
  }
  if (ageDays <= 30) {
    return "stale";
  }
  return "expired";
}

function quotaFromHeaders(
  headers: YandexProviderHttpHeaders | undefined
): ExternalObservationQuota | undefined {
  if (!headers) {
    return undefined;
  }
  const quota: ExternalObservationQuota = {};
  assignHeaderNumber(
    quota,
    "limit",
    headers.get("x-ratelimit-limit") ?? headers.get("x-yandex-ratelimit-limit")
  );
  assignHeaderNumber(
    quota,
    "remaining",
    headers.get("x-ratelimit-remaining") ??
      headers.get("x-yandex-ratelimit-remaining")
  );
  const resetAt =
    headers.get("x-ratelimit-reset") ?? headers.get("x-yandex-ratelimit-reset");
  if (resetAt) {
    quota.resetAt = resetAt;
  }
  return Object.keys(quota).length === 0 ? undefined : quota;
}

function assignHeaderNumber(
  quota: ExternalObservationQuota,
  key: "limit" | "remaining",
  value: string | null | undefined
): void {
  if (value === null || value === undefined || value.length === 0) {
    return;
  }
  const parsed = Number(value);
  if (Number.isFinite(parsed)) {
    quota[key] = parsed;
  }
}

function fingerprintFor(input: {
  scope: YandexProviderObservationScope;
  source: string;
  subjectUrl: string;
}): string {
  return [
    "yandex",
    input.scope.organizationId,
    input.scope.projectId,
    input.scope.environmentId,
    input.source,
    input.subjectUrl
  ].join(":");
}

function stableId(fingerprint: string): string {
  return `yandex-observation-${hash(fingerprint)}`;
}

function hash(value: string): string {
  let output = 5381;
  for (let index = 0; index < value.length; index += 1) {
    output = (output * 33) ^ value.charCodeAt(index);
  }
  return (output >>> 0).toString(36);
}

function payloadObject(value: unknown): Readonly<Record<string, unknown>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      value
    };
  }
  return value as Readonly<Record<string, unknown>>;
}

function plainObject(value: unknown): Readonly<Record<string, unknown>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Readonly<Record<string, unknown>>;
}
