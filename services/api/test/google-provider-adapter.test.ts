import { describe, expect, it } from "vitest";

import {
  GoogleProviderAdapterError,
  createGoogleProviderAdapter
} from "../src/index.js";
import type {
  GoogleProviderFetch,
  GoogleProviderHttpResponse
} from "../src/index.js";

describe("createGoogleProviderAdapter", () => {
  it("normalizes URL Inspection responses into Google external observations", async () => {
    const fetch = new RecordingFetch([
      response({
        inspectionResult: {
          indexStatusResult: {
            coverageState: "Submitted and indexed",
            lastCrawlTime: "2026-06-20T00:00:00.000Z"
          }
        }
      })
    ]);
    const adapter = createGoogleProviderAdapter({
      fetch: fetch.fetch,
      endpointBaseUrl: "https://google.test"
    });

    const record = await adapter.inspectUrl({
      ...scope(),
      subjectUrl: "https://example.test/"
    });

    expect(fetch.requests).toEqual([
      {
        url: "https://google.test/v1/urlInspection/index:inspect",
        method: "POST",
        headers: {
          authorization: "Bearer token-1",
          accept: "application/json",
          "content-type": "application/json"
        },
        body: JSON.stringify({
          inspectionUrl: "https://example.test/",
          siteUrl: "sc-domain:example.test"
        })
      }
    ]);
    expect(record).toMatchObject({
      organizationId: "org-1",
      projectId: "project-1",
      environmentId: "env-1",
      provider: "google",
      source: "google.urlInspection",
      subjectUrl: "https://example.test/",
      observedAt: "2026-06-20T00:00:00.000Z",
      fetchedAt: "2026-06-21T00:00:00.000Z",
      freshness: "fresh",
      quota: {
        limit: 2000,
        remaining: 1999,
        resetAt: "2026-06-22T00:00:00.000Z"
      },
      sampling: {
        sampled: false
      },
      deletionState: "active",
      createdAt: "2026-06-21T00:00:00.000Z"
    });
    expect(record.fingerprint).toBe(
      "google:org-1:project-1:env-1:google.urlInspection:https://example.test/"
    );
    expect(record.id).toMatch(/^google-observation-/);
    expect(record.payload).toEqual({
      inspectionResult: {
        indexStatusResult: {
          coverageState: "Submitted and indexed",
          lastCrawlTime: "2026-06-20T00:00:00.000Z"
        }
      }
    });
  });

  it("normalizes Search Analytics responses with stale freshness", async () => {
    const fetch = new RecordingFetch([
      response({
        rows: [
          {
            keys: ["https://example.test/"],
            clicks: 7,
            impressions: 100
          }
        ]
      })
    ]);
    const adapter = createGoogleProviderAdapter({
      fetch: fetch.fetch,
      endpointBaseUrl: "https://google.test"
    });

    const record = await adapter.querySearchAnalytics({
      ...scope({
        fetchedAt: "2026-06-21T00:00:00.000Z"
      }),
      subjectUrl: "https://example.test/",
      startDate: "2026-06-01",
      endDate: "2026-06-10",
      dimensions: ["page", "query"]
    });

    expect(fetch.requests[0]?.url).toBe(
      "https://google.test/webmasters/v3/sites/sc-domain%3Aexample.test/searchAnalytics/query"
    );
    expect(JSON.parse(fetch.requests[0]?.body ?? "{}")).toEqual({
      startDate: "2026-06-01",
      endDate: "2026-06-10",
      dimensions: ["page", "query"],
      dimensionFilterGroups: [
        {
          filters: [
            {
              dimension: "page",
              operator: "equals",
              expression: "https://example.test/"
            }
          ]
        }
      ]
    });
    expect(record).toMatchObject({
      provider: "google",
      source: "google.searchAnalytics",
      subjectUrl: "https://example.test/",
      observedAt: "2026-06-10T00:00:00.000Z",
      freshness: "stale",
      payload: {
        rows: [
          {
            keys: ["https://example.test/"],
            clicks: 7,
            impressions: 100
          }
        ]
      }
    });
  });

  it("normalizes sitemap responses with expired freshness", async () => {
    const fetch = new RecordingFetch([
      response({
        path: "https://example.test/sitemap.xml",
        lastSubmitted: "2026-04-01T00:00:00.000Z"
      })
    ]);
    const adapter = createGoogleProviderAdapter({
      fetch: fetch.fetch,
      endpointBaseUrl: "https://google.test"
    });

    const record = await adapter.getSitemap({
      ...scope({
        fetchedAt: "2026-06-21T00:00:00.000Z"
      }),
      sitemapUrl: "https://example.test/sitemap.xml"
    });

    expect(fetch.requests[0]?.url).toBe(
      "https://google.test/webmasters/v3/sites/sc-domain%3Aexample.test/sitemaps/https%3A%2F%2Fexample.test%2Fsitemap.xml"
    );
    expect(fetch.requests[0]?.method).toBe("GET");
    expect(record).toMatchObject({
      provider: "google",
      source: "google.sitemap",
      subjectUrl: "https://example.test/sitemap.xml",
      observedAt: "2026-04-01T00:00:00.000Z",
      freshness: "expired"
    });
  });

  it("normalizes PageSpeed responses into Google external observations", async () => {
    const fetch = new RecordingFetch([
      response({
        id: "https://example.test/",
        analysisUTCTimestamp: "2026-06-20T12:00:00.000Z",
        loadingExperience: {
          metrics: {
            LARGEST_CONTENTFUL_PAINT_MS: {
              percentile: 2600
            }
          }
        }
      })
    ]);
    const adapter = createGoogleProviderAdapter({
      fetch: fetch.fetch,
      endpointBaseUrl: "https://google.test"
    });

    const record = await adapter.runPageSpeed({
      ...scope(),
      subjectUrl: "https://example.test/",
      strategy: "desktop",
      categories: ["performance", "seo"]
    });

    expect(fetch.requests[0]?.url).toBe(
      "https://google.test/pagespeedonline/v5/runPagespeed?url=https%3A%2F%2Fexample.test%2F&strategy=desktop&category=performance&category=seo"
    );
    expect(fetch.requests[0]?.method).toBe("GET");
    expect(record).toMatchObject({
      provider: "google",
      source: "google.pagespeed",
      subjectUrl: "https://example.test/",
      observedAt: "2026-06-20T12:00:00.000Z",
      fetchedAt: "2026-06-21T00:00:00.000Z",
      freshness: "fresh",
      sampling: {
        sampled: false,
        state: "desktop"
      }
    });
    expect(record.fingerprint).toBe(
      "google:org-1:project-1:env-1:google.pagespeed:https://example.test/"
    );
  });

  it("normalizes CrUX responses into sampled Google external observations", async () => {
    const fetch = new RecordingFetch([
      response({
        record: {
          key: {
            url: "https://example.test/"
          },
          metrics: {
            largest_contentful_paint: {
              percentiles: {
                p75: 2400
              }
            }
          },
          collectionPeriod: {
            lastDate: {
              year: 2026,
              month: 6,
              day: 20
            }
          }
        }
      })
    ]);
    const adapter = createGoogleProviderAdapter({
      fetch: fetch.fetch,
      endpointBaseUrl: "https://google.test"
    });

    const record = await adapter.queryCrux({
      ...scope(),
      subjectUrl: "https://example.test/",
      formFactor: "PHONE",
      effectiveConnectionType: "4G"
    });

    expect(fetch.requests).toEqual([
      {
        url: "https://google.test/v1/records:queryRecord",
        method: "POST",
        headers: {
          authorization: "Bearer token-1",
          accept: "application/json",
          "content-type": "application/json"
        },
        body: JSON.stringify({
          url: "https://example.test/",
          formFactor: "PHONE",
          effectiveConnectionType: "4G"
        })
      }
    ]);
    expect(record).toMatchObject({
      provider: "google",
      source: "google.crux",
      subjectUrl: "https://example.test/",
      observedAt: "2026-06-20T00:00:00.000Z",
      fetchedAt: "2026-06-21T00:00:00.000Z",
      freshness: "fresh",
      sampling: {
        sampled: true,
        state: "field-data"
      }
    });
    expect(record.fingerprint).toBe(
      "google:org-1:project-1:env-1:google.crux:https://example.test/"
    );
  });

  it("throws deterministic provider errors with response payloads", async () => {
    const errorPayload = {
      error: {
        status: "RESOURCE_EXHAUSTED",
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
    const adapter = createGoogleProviderAdapter({
      fetch: fetch.fetch,
      endpointBaseUrl: "https://google.test"
    });

    await expect(
      adapter.inspectUrl({
        ...scope(),
        subjectUrl: "https://example.test/"
      })
    ).rejects.toMatchObject({
      name: "GoogleProviderAdapterError",
      status: 429,
      payload: {
        error: {
          status: "RESOURCE_EXHAUSTED",
          message: "quota exceeded"
        }
      }
    });
    await expect(
      adapter.inspectUrl({
        ...scope(),
        subjectUrl: "https://example.test/"
      })
    ).rejects.toBeInstanceOf(GoogleProviderAdapterError);
  });
});

class RecordingFetch {
  readonly requests: {
    url: string;
    method: string;
    headers: Readonly<Record<string, string>>;
    body?: string;
  }[] = [];

  constructor(private readonly responses: GoogleProviderHttpResponse[]) {}

  readonly fetch: GoogleProviderFetch = async (url, init) => {
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
): GoogleProviderHttpResponse {
  return {
    ok: options.ok ?? true,
    status: options.status ?? 200,
    headers: {
      get(name) {
        return (
          {
            "x-ratelimit-limit": "2000",
            "x-ratelimit-remaining": "1999",
            "x-ratelimit-reset": "2026-06-22T00:00:00.000Z"
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
    siteUrl: "sc-domain:example.test",
    fetchedAt: "2026-06-21T00:00:00.000Z",
    ...overrides
  };
}
