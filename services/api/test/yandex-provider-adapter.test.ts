import { describe, expect, it } from "vitest";

import {
  YandexProviderAdapterError,
  createYandexProviderAdapter
} from "../src/index.js";
import type {
  YandexProviderFetch,
  YandexProviderHttpResponse
} from "../src/index.js";

describe("createYandexProviderAdapter", () => {
  it("normalizes Webmaster URL-status responses into Yandex external observations", async () => {
    const fetch = new RecordingFetch([
      response({
        searchable: true,
        indexable: true,
        checkedAt: "2026-06-20T00:00:00.000Z",
        exclusionReason: null
      })
    ]);
    const adapter = createYandexProviderAdapter({
      fetch: fetch.fetch,
      endpointBaseUrl: "https://yandex.test"
    });

    const record = await adapter.getUrlStatus({
      ...scope(),
      subjectUrl: "https://example.test/"
    });

    expect(fetch.requests).toEqual([
      {
        url: "https://yandex.test/webmaster/v1/hosts/host-1/url-status?url=https%3A%2F%2Fexample.test%2F",
        method: "GET",
        headers: {
          authorization: "OAuth token-1",
          accept: "application/json"
        }
      }
    ]);
    expect(record).toMatchObject({
      organizationId: "org-1",
      projectId: "project-1",
      environmentId: "env-1",
      provider: "yandex",
      source: "yandex.webmaster",
      subjectUrl: "https://example.test/",
      observedAt: "2026-06-20T00:00:00.000Z",
      fetchedAt: "2026-06-21T00:00:00.000Z",
      freshness: "fresh",
      quota: {
        limit: 1000,
        remaining: 998,
        resetAt: "2026-06-22T00:00:00.000Z"
      },
      sampling: {
        sampled: false
      },
      deletionState: "active",
      createdAt: "2026-06-21T00:00:00.000Z"
    });
    expect(record.fingerprint).toBe(
      "yandex:org-1:project-1:env-1:yandex.webmaster:https://example.test/"
    );
    expect(record.id).toMatch(/^yandex-observation-/);
    expect(record.payload).toEqual({
      searchable: true,
      indexable: true,
      checkedAt: "2026-06-20T00:00:00.000Z",
      exclusionReason: null
    });
  });

  it("normalizes Metrica landing-page responses with sampling metadata", async () => {
    const fetch = new RecordingFetch([
      response({
        sampled: true,
        samplingState: "sampled",
        data: [
          {
            dimensions: [{ name: "https://example.test/" }],
            metrics: [42]
          }
        ]
      })
    ]);
    const adapter = createYandexProviderAdapter({
      fetch: fetch.fetch,
      endpointBaseUrl: "https://yandex.test"
    });

    const record = await adapter.queryMetricaLandingPage({
      ...scope({
        fetchedAt: "2026-06-21T00:00:00.000Z"
      }),
      counterId: "counter-1",
      subjectUrl: "https://example.test/",
      startDate: "2026-06-01",
      endDate: "2026-06-10",
      metrics: ["ym:s:visits", "ym:s:users"]
    });

    expect(fetch.requests[0]?.url).toBe(
      "https://yandex.test/metrica/v1/counters/counter-1/landing-pages/query"
    );
    expect(fetch.requests[0]?.method).toBe("POST");
    expect(JSON.parse(fetch.requests[0]?.body ?? "{}")).toEqual({
      date1: "2026-06-01",
      date2: "2026-06-10",
      metrics: ["ym:s:visits", "ym:s:users"],
      dimensions: ["ym:s:startURL"],
      filters: "ym:s:startURL=='https://example.test/'"
    });
    expect(record).toMatchObject({
      provider: "yandex",
      source: "yandex.metrica",
      subjectUrl: "https://example.test/",
      observedAt: "2026-06-10T00:00:00.000Z",
      freshness: "stale",
      sampling: {
        sampled: true,
        state: "sampled"
      },
      payload: {
        sampled: true,
        samplingState: "sampled",
        data: [
          {
            dimensions: [{ name: "https://example.test/" }],
            metrics: [42]
          }
        ]
      }
    });
  });

  it("escapes Metrica landing-page filter values", async () => {
    const fetch = new RecordingFetch([
      response({
        sampled: false,
        data: []
      })
    ]);
    const adapter = createYandexProviderAdapter({
      fetch: fetch.fetch,
      endpointBaseUrl: "https://yandex.test"
    });

    await adapter.queryMetricaLandingPage({
      ...scope(),
      counterId: "counter-1",
      subjectUrl: "https://example.test/owner's\\page",
      startDate: "2026-06-01",
      endDate: "2026-06-10"
    });

    expect(JSON.parse(fetch.requests[0]?.body ?? "{}")).toMatchObject({
      filters: "ym:s:startURL=='https://example.test/owner\\'s\\\\page'"
    });
  });

  it("normalizes Webmaster sitemap responses with expired freshness", async () => {
    const fetch = new RecordingFetch([
      response({
        url: "https://example.test/sitemap.xml",
        lastProcessedAt: "2026-04-01T00:00:00.000Z"
      })
    ]);
    const adapter = createYandexProviderAdapter({
      fetch: fetch.fetch,
      endpointBaseUrl: "https://yandex.test"
    });

    const record = await adapter.getSitemap({
      ...scope({
        fetchedAt: "2026-06-21T00:00:00.000Z"
      }),
      sitemapUrl: "https://example.test/sitemap.xml"
    });

    expect(fetch.requests[0]?.url).toBe(
      "https://yandex.test/webmaster/v1/hosts/host-1/sitemaps/https%3A%2F%2Fexample.test%2Fsitemap.xml"
    );
    expect(fetch.requests[0]?.method).toBe("GET");
    expect(record).toMatchObject({
      provider: "yandex",
      source: "yandex.webmaster",
      subjectUrl: "https://example.test/sitemap.xml",
      observedAt: "2026-04-01T00:00:00.000Z",
      freshness: "expired"
    });
  });

  it("throws deterministic provider errors with response payloads", async () => {
    const errorPayload = {
      error: {
        code: "QUOTA_EXCEEDED",
        message: "quota exceeded"
      }
    };
    const fetch = new RecordingFetch([
      response(errorPayload, {
        ok: false,
        status: 429
      }),
      response(errorPayload, {
        ok: false,
        status: 429
      })
    ]);
    const adapter = createYandexProviderAdapter({
      fetch: fetch.fetch,
      endpointBaseUrl: "https://yandex.test"
    });

    await expect(
      adapter.getUrlStatus({
        ...scope(),
        subjectUrl: "https://example.test/"
      })
    ).rejects.toMatchObject({
      name: "YandexProviderAdapterError",
      status: 429,
      payload: {
        error: {
          code: "QUOTA_EXCEEDED",
          message: "quota exceeded"
        }
      }
    });
    await expect(
      adapter.getUrlStatus({
        ...scope(),
        subjectUrl: "https://example.test/"
      })
    ).rejects.toBeInstanceOf(YandexProviderAdapterError);
  });
});

class RecordingFetch {
  readonly requests: {
    url: string;
    method: string;
    headers: Readonly<Record<string, string>>;
    body?: string;
  }[] = [];

  constructor(private readonly responses: YandexProviderHttpResponse[]) {}

  readonly fetch: YandexProviderFetch = async (url, init) => {
    this.requests.push({
      url,
      method: init.method,
      headers: init.headers,
      ...(init.body === undefined ? {} : { body: init.body })
    });
    const response = this.responses.shift();
    if (!response) {
      throw new Error("No mocked response available.");
    }
    return response;
  };
}

function response(
  payload: unknown,
  options: {
    ok?: boolean;
    status?: number;
  } = {}
): YandexProviderHttpResponse {
  return {
    ok: options.ok ?? true,
    status: options.status ?? 200,
    headers: {
      get(name) {
        return (
          {
            "x-yandex-ratelimit-limit": "1000",
            "x-yandex-ratelimit-remaining": "998",
            "x-yandex-ratelimit-reset": "2026-06-22T00:00:00.000Z"
          }[name] ?? null
        );
      }
    },
    async json() {
      return payload;
    }
  };
}

function scope(
  overrides: Partial<{
    fetchedAt: string;
  }> = {}
) {
  return {
    organizationId: "org-1",
    projectId: "project-1",
    environmentId: "env-1",
    accessToken: "token-1",
    siteHostId: "host-1",
    fetchedAt: "2026-06-21T00:00:00.000Z",
    ...overrides
  };
}
