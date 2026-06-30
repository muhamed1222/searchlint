import type {
  ExternalObservationQuota,
  ExternalObservationRecord,
  ExternalObservationSource
} from "./types.js";
import { googleProviderFreshnessState } from "./google-provider-stale-state.js";

export type GoogleProviderHttpHeaders = {
  get(name: string): string | null | undefined;
};

export type GoogleProviderHttpResponse = {
  ok: boolean;
  status: number;
  headers?: GoogleProviderHttpHeaders;
  json(): Promise<unknown>;
};

export type GoogleProviderFetch = (
  url: string,
  init: {
    method: "GET" | "POST";
    headers: Readonly<Record<string, string>>;
    body?: string;
  }
) => Promise<GoogleProviderHttpResponse>;

export type GoogleProviderAdapterOptions = {
  fetch: GoogleProviderFetch;
  endpointBaseUrl?: string;
  searchConsoleEndpointBaseUrl?: string;
  pageSpeedEndpointBaseUrl?: string;
  cruxEndpointBaseUrl?: string;
};

export type GoogleProviderObservationScope = {
  organizationId: string;
  projectId: string;
  environmentId: string;
  accessToken: string;
  siteUrl: string;
  fetchedAt: string;
  retentionUntil?: string;
};

export type GoogleUrlInspectionInput = GoogleProviderObservationScope & {
  subjectUrl: string;
};

export type GoogleSearchAnalyticsInput = GoogleProviderObservationScope & {
  subjectUrl: string;
  startDate: string;
  endDate: string;
  dimensions?: readonly string[];
};

export type GoogleSitemapInput = GoogleProviderObservationScope & {
  sitemapUrl: string;
};

export type GooglePageSpeedStrategy = "mobile" | "desktop";

export type GooglePageSpeedCategory =
  | "performance"
  | "accessibility"
  | "best-practices"
  | "seo";

export type GooglePageSpeedInput = GoogleProviderObservationScope & {
  subjectUrl: string;
  strategy?: GooglePageSpeedStrategy;
  categories?: readonly GooglePageSpeedCategory[];
};

export type GoogleCruxFormFactor = "PHONE" | "DESKTOP" | "TABLET";

export type GoogleCruxInput = GoogleProviderObservationScope & {
  subjectUrl: string;
  formFactor?: GoogleCruxFormFactor;
  effectiveConnectionType?: string;
};

export type GoogleProviderAdapter = {
  inspectUrl(
    input: GoogleUrlInspectionInput
  ): Promise<ExternalObservationRecord>;
  querySearchAnalytics(
    input: GoogleSearchAnalyticsInput
  ): Promise<ExternalObservationRecord>;
  getSitemap(input: GoogleSitemapInput): Promise<ExternalObservationRecord>;
  runPageSpeed(input: GooglePageSpeedInput): Promise<ExternalObservationRecord>;
  queryCrux(input: GoogleCruxInput): Promise<ExternalObservationRecord>;
};

export class GoogleProviderAdapterError extends Error {
  readonly status: number;
  readonly payload: unknown;

  constructor(status: number, payload: unknown) {
    super(`Google provider request failed with status ${status}.`);
    this.name = "GoogleProviderAdapterError";
    this.status = status;
    this.payload = payload;
  }
}

export function createGoogleProviderAdapter(
  options: GoogleProviderAdapterOptions
): GoogleProviderAdapter {
  const endpointBaseUrl =
    options.searchConsoleEndpointBaseUrl ??
    options.endpointBaseUrl ??
    "https://searchconsole.googleapis.com";
  const pageSpeedEndpointBaseUrl =
    options.pageSpeedEndpointBaseUrl ??
    options.endpointBaseUrl ??
    "https://pagespeedonline.googleapis.com";
  const cruxEndpointBaseUrl =
    options.cruxEndpointBaseUrl ??
    options.endpointBaseUrl ??
    "https://chromeuxreport.googleapis.com";

  return {
    async inspectUrl(input) {
      const response = await request(options.fetch, {
        endpointBaseUrl,
        accessToken: input.accessToken,
        path: "/v1/urlInspection/index:inspect",
        body: {
          inspectionUrl: input.subjectUrl,
          siteUrl: input.siteUrl
        }
      });
      const payload = await response.json();
      return observationRecord({
        scope: input,
        source: "google.urlInspection",
        subjectUrl: input.subjectUrl,
        payload,
        quota: quotaFromHeaders(response.headers),
        observedAt: observedAtFromUrlInspection(payload, input.fetchedAt)
      });
    },

    async querySearchAnalytics(input) {
      const response = await request(options.fetch, {
        endpointBaseUrl,
        accessToken: input.accessToken,
        path: `/webmasters/v3/sites/${encodeURIComponent(
          input.siteUrl
        )}/searchAnalytics/query`,
        body: {
          startDate: input.startDate,
          endDate: input.endDate,
          dimensions: input.dimensions ?? ["page"],
          dimensionFilterGroups: [
            {
              filters: [
                {
                  dimension: "page",
                  operator: "equals",
                  expression: input.subjectUrl
                }
              ]
            }
          ]
        }
      });
      const payload = await response.json();
      return observationRecord({
        scope: input,
        source: "google.searchAnalytics",
        subjectUrl: input.subjectUrl,
        payload,
        quota: quotaFromHeaders(response.headers),
        observedAt: `${input.endDate}T00:00:00.000Z`
      });
    },

    async getSitemap(input) {
      const response = await request(options.fetch, {
        endpointBaseUrl,
        accessToken: input.accessToken,
        path: `/webmasters/v3/sites/${encodeURIComponent(
          input.siteUrl
        )}/sitemaps/${encodeURIComponent(input.sitemapUrl)}`
      });
      const payload = await response.json();
      return observationRecord({
        scope: input,
        source: "google.sitemap",
        subjectUrl: input.sitemapUrl,
        payload,
        quota: quotaFromHeaders(response.headers),
        observedAt: observedAtFromSitemap(payload, input.fetchedAt)
      });
    },

    async runPageSpeed(input) {
      const path = pageSpeedPath(input);
      const response = await request(options.fetch, {
        endpointBaseUrl: pageSpeedEndpointBaseUrl,
        accessToken: input.accessToken,
        path
      });
      const payload = await response.json();
      return observationRecord({
        scope: input,
        source: "google.pagespeed",
        subjectUrl: input.subjectUrl,
        payload,
        quota: quotaFromHeaders(response.headers),
        observedAt: observedAtFromPageSpeed(payload, input.fetchedAt),
        sampling: {
          sampled: false,
          state: input.strategy ?? "mobile"
        }
      });
    },

    async queryCrux(input) {
      const response = await request(options.fetch, {
        endpointBaseUrl: cruxEndpointBaseUrl,
        accessToken: input.accessToken,
        path: "/v1/records:queryRecord",
        body: {
          url: input.subjectUrl,
          ...(input.formFactor === undefined
            ? {}
            : { formFactor: input.formFactor }),
          ...(input.effectiveConnectionType === undefined
            ? {}
            : { effectiveConnectionType: input.effectiveConnectionType })
        }
      });
      const payload = await response.json();
      return observationRecord({
        scope: input,
        source: "google.crux",
        subjectUrl: input.subjectUrl,
        payload,
        quota: quotaFromHeaders(response.headers),
        observedAt: observedAtFromCrux(payload, input.fetchedAt),
        sampling: samplingFromCrux(payload)
      });
    }
  };
}

async function request(
  fetch: GoogleProviderFetch,
  input: {
    endpointBaseUrl: string;
    accessToken: string;
    path: string;
    body?: Readonly<Record<string, unknown>>;
  }
): Promise<GoogleProviderHttpResponse> {
  const response = await fetch(`${input.endpointBaseUrl}${input.path}`, {
    method: input.body === undefined ? "GET" : "POST",
    headers: {
      authorization: `Bearer ${input.accessToken}`,
      accept: "application/json",
      ...(input.body === undefined
        ? {}
        : { "content-type": "application/json" })
    },
    ...(input.body === undefined ? {} : { body: JSON.stringify(input.body) })
  });
  if (!response.ok) {
    throw new GoogleProviderAdapterError(
      response.status,
      await response.json()
    );
  }
  return response;
}

function observationRecord(input: {
  scope: GoogleProviderObservationScope;
  source: Extract<
    ExternalObservationSource,
    | "google.urlInspection"
    | "google.searchAnalytics"
    | "google.sitemap"
    | "google.pagespeed"
    | "google.crux"
  >;
  subjectUrl: string;
  observedAt: string;
  payload: unknown;
  quota: ExternalObservationQuota | undefined;
  sampling?: ExternalObservationRecord["sampling"];
}): ExternalObservationRecord {
  const fingerprint = fingerprintFor(input);
  return {
    id: stableId(fingerprint),
    organizationId: input.scope.organizationId,
    projectId: input.scope.projectId,
    environmentId: input.scope.environmentId,
    provider: "google",
    source: input.source,
    subjectUrl: input.subjectUrl,
    observedAt: input.observedAt,
    fetchedAt: input.scope.fetchedAt,
    freshness: googleProviderFreshnessState({
      observedAt: input.observedAt,
      fetchedAt: input.scope.fetchedAt
    }).freshness,
    payload: payloadObject(input.payload),
    ...(input.quota === undefined ? {} : { quota: input.quota }),
    sampling: input.sampling ?? {
      sampled: false
    },
    fingerprint,
    ...(input.scope.retentionUntil === undefined
      ? {}
      : { retentionUntil: input.scope.retentionUntil }),
    deletionState: "active",
    createdAt: input.scope.fetchedAt
  };
}

function pageSpeedPath(input: GooglePageSpeedInput): string {
  const params = new URLSearchParams();
  params.set("url", input.subjectUrl);
  params.set("strategy", input.strategy ?? "mobile");
  for (const category of input.categories ?? ["performance"]) {
    params.append("category", category);
  }
  return `/pagespeedonline/v5/runPagespeed?${params.toString()}`;
}

function observedAtFromUrlInspection(
  payload: unknown,
  fallback: string
): string {
  const result = plainObject(payload).inspectionResult;
  const indexStatus = plainObject(result).indexStatusResult;
  const lastCrawlTime = plainObject(indexStatus).lastCrawlTime;
  return typeof lastCrawlTime === "string" ? lastCrawlTime : fallback;
}

function observedAtFromSitemap(payload: unknown, fallback: string): string {
  const lastSubmitted = plainObject(payload).lastSubmitted;
  const lastDownloaded = plainObject(payload).lastDownloaded;
  if (typeof lastDownloaded === "string") {
    return lastDownloaded;
  }
  return typeof lastSubmitted === "string" ? lastSubmitted : fallback;
}

function observedAtFromPageSpeed(payload: unknown, fallback: string): string {
  const analysisUtcTimestamp = plainObject(payload).analysisUTCTimestamp;
  return typeof analysisUtcTimestamp === "string"
    ? analysisUtcTimestamp
    : fallback;
}

function observedAtFromCrux(payload: unknown, fallback: string): string {
  const record = plainObject(payload).record;
  const collectionPeriod = plainObject(record).collectionPeriod;
  const lastDate = plainObject(collectionPeriod).lastDate;
  const year = plainObject(lastDate).year;
  const month = plainObject(lastDate).month;
  const day = plainObject(lastDate).day;
  if (
    typeof year === "number" &&
    typeof month === "number" &&
    typeof day === "number"
  ) {
    return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T00:00:00.000Z`;
  }
  return fallback;
}

function samplingFromCrux(
  payload: unknown
): ExternalObservationRecord["sampling"] {
  const record = plainObject(payload).record;
  const metrics = plainObject(plainObject(record).metrics);
  return {
    sampled: true,
    state: Object.keys(metrics).length === 0 ? "missing" : "field-data"
  };
}

function quotaFromHeaders(
  headers: GoogleProviderHttpHeaders | undefined
): ExternalObservationQuota | undefined {
  if (!headers) {
    return undefined;
  }
  const quota: ExternalObservationQuota = {};
  assignHeaderNumber(quota, "limit", headers.get("x-ratelimit-limit"));
  assignHeaderNumber(quota, "remaining", headers.get("x-ratelimit-remaining"));
  const resetAt = headers.get("x-ratelimit-reset");
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
  scope: GoogleProviderObservationScope;
  source: string;
  subjectUrl: string;
}): string {
  return [
    "google",
    input.scope.organizationId,
    input.scope.projectId,
    input.scope.environmentId,
    input.source,
    input.subjectUrl
  ].join(":");
}

function stableId(fingerprint: string): string {
  return `google-observation-${hash(fingerprint)}`;
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
