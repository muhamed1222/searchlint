import { describe, expect, it } from "vitest";

import {
  crawlSite,
  extractLinks,
  normalizeUrl,
  parseRobotsTxt,
  type CrawlResponse,
  type CrawlRequestOptions,
  type CrawlerFetcher
} from "../src/index.js";

describe("normalizeUrl", () => {
  it("normalizes http URLs and rejects unsupported protocols", () => {
    expect(normalizeUrl("https://example.com/a/#section")).toBe(
      "https://example.com/a"
    );
    expect(normalizeUrl("/b/", "https://example.com/a/")).toBe(
      "https://example.com/b"
    );
    expect(normalizeUrl("mailto:test@example.com")).toBeUndefined();
  });
});

describe("extractLinks", () => {
  it("extracts normalized links from anchors", () => {
    expect(
      extractLinks(
        `<a href="/a">A</a><a href="https://other.example/x#frag">X</a><a href="mailto:test@example.com">Mail</a>`,
        "https://example.com/"
      )
    ).toEqual(["https://example.com/a", "https://other.example/x"]);
  });
});

describe("parseRobotsTxt", () => {
  it("uses the longest matching allow/disallow rule", () => {
    const policy = parseRobotsTxt(
      `User-agent: *
Disallow: /private
Allow: /private/public`,
      "SearchLint"
    );

    expect(policy.allows("https://example.com/private")).toBe(false);
    expect(policy.allows("https://example.com/private/public")).toBe(true);
  });
});

describe("crawlSite", () => {
  it("crawls same-origin pages in deterministic FIFO order", async () => {
    const fetcher = createFetcher({
      "https://example.com/robots.txt": response(
        "https://example.com/robots.txt",
        404,
        ""
      ),
      "https://example.com/": html(` <a href="/b">B</a><a href="/a">A</a> `),
      "https://example.com/b": html(`<a href="/c">C</a>`),
      "https://example.com/a": html(`<a href="/c">C</a>`),
      "https://example.com/c": html(`done`)
    });

    const result = await crawlSite(
      { startUrl: "https://example.com/", maxUrls: 10 },
      fetcher
    );

    expect(result.pages.map((page) => page.url)).toEqual([
      "https://example.com/",
      "https://example.com/b",
      "https://example.com/a",
      "https://example.com/c"
    ]);
  });

  it("skips robots-disallowed URLs by default", async () => {
    const fetcher = createFetcher({
      "https://example.com/robots.txt": response(
        "https://example.com/robots.txt",
        200,
        `User-agent: SearchLint
Disallow: /blocked`
      ),
      "https://example.com/": html(
        `<a href="/allowed">Allowed</a><a href="/blocked">Blocked</a>`
      ),
      "https://example.com/allowed": html(`ok`),
      "https://example.com/blocked": html(`should not fetch`)
    });

    const result = await crawlSite(
      { startUrl: "https://example.com/", maxUrls: 10 },
      fetcher
    );

    expect(result.pages.map((page) => page.url)).toEqual([
      "https://example.com/",
      "https://example.com/allowed"
    ]);
    expect(result.skipped).toContainEqual({
      url: "https://example.com/blocked",
      reason: "robots"
    });
    expect(fetcher.calls).not.toContain("https://example.com/blocked");
  });

  it("can explicitly disable robots-aware filtering", async () => {
    const fetcher = createFetcher({
      "https://example.com/robots.txt": response(
        "https://example.com/robots.txt",
        200,
        `User-agent: *
Disallow: /blocked`
      ),
      "https://example.com/": html(`<a href="/blocked">Blocked</a>`),
      "https://example.com/blocked": html(`ok`)
    });

    const result = await crawlSite(
      {
        startUrl: "https://example.com/",
        maxUrls: 10,
        respectRobotsTxt: false
      },
      fetcher
    );

    expect(result.pages.map((page) => page.url)).toEqual([
      "https://example.com/",
      "https://example.com/blocked"
    ]);
    expect(fetcher.calls).not.toContain("https://example.com/robots.txt");
  });

  it("filters external links and de-duplicates discovered URLs", async () => {
    const fetcher = createFetcher({
      "https://example.com/robots.txt": response(
        "https://example.com/robots.txt",
        404,
        ""
      ),
      "https://example.com/": html(
        `<a href="/a">A</a><a href="/a#fragment">A2</a><a href="https://other.example/">Other</a>`
      ),
      "https://example.com/a": html(`ok`)
    });

    const result = await crawlSite(
      { startUrl: "https://example.com/", maxUrls: 10 },
      fetcher
    );

    expect(result.pages[0]?.discoveredLinks).toEqual(["https://example.com/a"]);
    expect(result.pages.map((page) => page.url)).toEqual([
      "https://example.com/",
      "https://example.com/a"
    ]);
  });

  it("honors maxUrls without fetching beyond the page limit", async () => {
    const fetcher = createFetcher({
      "https://example.com/robots.txt": response(
        "https://example.com/robots.txt",
        404,
        ""
      ),
      "https://example.com/": html(`<a href="/a">A</a><a href="/b">B</a>`),
      "https://example.com/a": html(`A`),
      "https://example.com/b": html(`B`)
    });

    const result = await crawlSite(
      { startUrl: "https://example.com/", maxUrls: 2 },
      fetcher
    );

    expect(result.pages.map((page) => page.url)).toEqual([
      "https://example.com/",
      "https://example.com/a"
    ]);
    expect(result.skipped).toContainEqual({
      url: "https://example.com/b",
      reason: "limit"
    });
    expect(fetcher.calls).not.toContain("https://example.com/b");
  });

  it("fetches the first sitemap declared by robots.txt", async () => {
    const fetcher = createFetcher({
      "https://example.com/robots.txt": response(
        "https://example.com/robots.txt",
        200,
        "User-agent: *\nAllow: /\nSitemap: https://example.com/sitemap.xml\n"
      ),
      "https://example.com/sitemap.xml": response(
        "https://example.com/sitemap.xml",
        200,
        '<?xml version="1.0"?><urlset></urlset>',
        { "content-type": "application/xml" }
      ),
      "https://example.com/": html(`<html><body></body></html>`)
    });

    const result = await crawlSite(
      {
        startUrl: "https://example.com/",
        maxUrls: 1,
        respectRobotsTxt: true
      },
      fetcher
    );

    expect(result.sitemap).toEqual({
      url: "https://example.com/sitemap.xml",
      statusCode: 200,
      contentType: "application/xml",
      body: '<?xml version="1.0"?><urlset></urlset>'
    });
  });

  it("blocks private-network start URLs before fetching robots.txt", async () => {
    const fetcher = createFetcher({});

    const result = await crawlSite(
      { startUrl: "http://127.0.0.1/", maxUrls: 1 },
      fetcher
    );

    expect(result.pages).toEqual([]);
    expect(result.skipped).toContainEqual({
      url: "http://127.0.0.1/",
      reason: "private-network",
      evidence: "Private-network crawling is disabled."
    });
    expect(fetcher.calls).toEqual([]);
  });

  it("records crawl-delay from robots.txt without sleeping in deterministic runs", async () => {
    const fetcher = createFetcher({
      "https://example.com/robots.txt": response(
        "https://example.com/robots.txt",
        200,
        "User-agent: SearchLint\nCrawl-delay: 3\nAllow: /\n"
      ),
      "https://example.com/": html(`ok`)
    });

    const result = await crawlSite(
      { startUrl: "https://example.com/" },
      fetcher
    );

    expect(result.robotsTxt?.crawlDelaySeconds).toBe(3);
  });

  it("limits query parameter explosion per canonical path", async () => {
    const fetcher = createFetcher({
      "https://example.com/robots.txt": response(
        "https://example.com/robots.txt",
        404,
        ""
      ),
      "https://example.com/": html(
        `<a href="/search?q=1">1</a><a href="/search?q=2">2</a><a href="/search?q=3">3</a>`
      ),
      "https://example.com/search?q=1": html(`1`),
      "https://example.com/search?q=2": html(`2`)
    });

    const result = await crawlSite(
      {
        startUrl: "https://example.com/",
        maxUrls: 10,
        maxQueryVariantsPerPath: 2
      },
      fetcher
    );

    expect(result.pages.map((page) => page.url)).toEqual([
      "https://example.com/",
      "https://example.com/search?q=1",
      "https://example.com/search?q=2"
    ]);
    expect(result.skipped).toContainEqual({
      url: "https://example.com/search?q=3",
      reason: "query-variant-limit",
      evidence: "Query variants for this path exceed maxQueryVariantsPerPath 2."
    });
  });

  it("limits extracted links per page before enqueueing", async () => {
    const fetcher = createFetcher({
      "https://example.com/robots.txt": response(
        "https://example.com/robots.txt",
        404,
        ""
      ),
      "https://example.com/": html(
        `<a href="/a">A</a><a href="/b">B</a><a href="/c">C</a>`
      ),
      "https://example.com/a": html(`A`)
    });

    const result = await crawlSite(
      { startUrl: "https://example.com/", maxUrls: 10, maxLinksPerPage: 1 },
      fetcher
    );

    expect(result.pages.map((page) => page.url)).toEqual([
      "https://example.com/",
      "https://example.com/a"
    ]);
    expect(result.skipped.map((item) => item.reason)).toContain("link-limit");
    expect(fetcher.calls).not.toContain("https://example.com/b");
  });

  it("records redirect loops and oversized responses as failed URLs", async () => {
    const fetcher = createFetcher({
      "https://example.com/robots.txt": response(
        "https://example.com/robots.txt",
        404,
        ""
      ),
      "https://example.com/": response("https://example.com/", 200, "ok", {
        "content-type": "text/html"
      }),
      "https://example.com/loop": {
        ...html(`loop`),
        redirectChain: [
          "https://example.com/a",
          "https://example.com/b",
          "https://example.com/a"
        ]
      },
      "https://example.com/large": html("x".repeat(20))
    });

    const redirect = await crawlSite(
      { startUrl: "https://example.com/loop", maxRedirects: 2 },
      fetcher
    );
    const large = await crawlSite(
      { startUrl: "https://example.com/large", maxResponseBytes: 10 },
      fetcher
    );

    expect(redirect.failed).toContainEqual(
      expect.objectContaining({ reason: "redirect-loop", attempts: 1 })
    );
    expect(large.failed).toContainEqual(
      expect.objectContaining({ reason: "response-too-large", attempts: 1 })
    );
  });

  it("retries transient fetch failures and reports permanent failures", async () => {
    const calls = new Map<string, number>();
    const fetchCalls: string[] = [];
    const fetcher: CrawlerFetcher & { calls: string[] } = {
      calls: fetchCalls,
      async fetch(url: string): Promise<CrawlResponse> {
        fetchCalls.push(url);
        if (url.endsWith("/robots.txt")) {
          return response(url, 404, "");
        }
        const count = calls.get(url) ?? 0;
        calls.set(url, count + 1);
        if (count === 0) {
          throw new Error("transient");
        }
        return html(`ok`);
      }
    };

    const result = await crawlSite(
      { startUrl: "https://example.com/", retryAttempts: 1 },
      fetcher
    );

    expect(result.pages).toHaveLength(1);
    expect(
      fetcher.calls.filter((url) => url === "https://example.com/")
    ).toHaveLength(2);
  });

  it("records timeout and cancellation failures with evidence", async () => {
    const timeoutFetcher: CrawlerFetcher = {
      async fetch(): Promise<CrawlResponse> {
        return new Promise((resolve) =>
          setTimeout(() => resolve(html(`late`)), 20)
        );
      }
    };
    const cancelled = new AbortController();
    cancelled.abort();

    const timeout = await crawlSite(
      {
        startUrl: "https://example.com/",
        respectRobotsTxt: false,
        requestTimeoutMs: 1
      },
      timeoutFetcher
    );
    const cancellation = await crawlSite(
      {
        startUrl: "https://example.com/",
        respectRobotsTxt: false,
        signal: cancelled.signal
      },
      createFetcher({ "https://example.com/": html(`ok`) })
    );

    expect(timeout.failed).toContainEqual(
      expect.objectContaining({ reason: "timeout" })
    );
    expect(cancellation.failed).toContainEqual(
      expect.objectContaining({ reason: "cancelled" })
    );
  });

  it("sends configured authentication headers to crawl requests", async () => {
    const fetcher = createFetcher({
      "https://example.com/": html(`authenticated`)
    });

    const result = await crawlSite(
      {
        startUrl: "https://example.com/",
        respectRobotsTxt: false,
        requestHeaders: {
          authorization: "Bearer synthetic-token"
        }
      },
      fetcher
    );

    expect(result.pages.map((page) => page.url)).toEqual([
      "https://example.com/"
    ]);
    expect(fetcher.optionsByUrl.get("https://example.com/")?.headers).toEqual({
      authorization: "Bearer synthetic-token"
    });
  });

  it("stores Set-Cookie values and replays matching cookies in the session", async () => {
    const fetcher = createFetcher({
      "https://example.com/": response(
        "https://example.com/",
        200,
        `<a href="/account/page">Account</a><a href="/public">Public</a>`,
        {
          "content-type": "text/html",
          "set-cookie":
            "session=synthetic-session; Path=/account; HttpOnly; SameSite=Lax"
        }
      ),
      "https://example.com/account/page": html(`account`),
      "https://example.com/public": html(`public`)
    });

    const result = await crawlSite(
      {
        startUrl: "https://example.com/",
        respectRobotsTxt: false,
        maxUrls: 3
      },
      fetcher
    );

    expect(result.pages.map((page) => page.url)).toEqual([
      "https://example.com/",
      "https://example.com/account/page",
      "https://example.com/public"
    ]);
    expect(
      fetcher.optionsByUrl.get("https://example.com/account/page")?.headers
    ).toEqual({
      cookie: "session=synthetic-session"
    });
    expect(
      fetcher.optionsByUrl.get("https://example.com/public")?.headers
    ).toBeUndefined();
  });

  it("supports initial session cookies without leaking them to other origins", async () => {
    const fetcher = createFetcher({
      "https://example.com/": html(
        `<a href="/dashboard">Dashboard</a><a href="https://other.example/private">Other</a>`
      ),
      "https://example.com/dashboard": html(`dashboard`),
      "https://other.example/private": html(`other`)
    });

    const result = await crawlSite(
      {
        startUrl: "https://example.com/",
        respectRobotsTxt: false,
        sameOrigin: false,
        maxUrls: 3,
        sessionCookies: [
          {
            name: "session",
            value: "synthetic-session",
            domain: "example.com",
            path: "/",
            secure: true
          }
        ]
      },
      fetcher
    );

    expect(result.pages.map((page) => page.url)).toEqual([
      "https://example.com/",
      "https://example.com/dashboard",
      "https://other.example/private"
    ]);
    expect(fetcher.optionsByUrl.get("https://example.com/")?.headers).toEqual({
      cookie: "session=synthetic-session"
    });
    expect(
      fetcher.optionsByUrl.get("https://example.com/dashboard")?.headers
    ).toEqual({
      cookie: "session=synthetic-session"
    });
    expect(
      fetcher.optionsByUrl.get("https://other.example/private")?.headers
    ).toBeUndefined();
  });

  it("paces same-origin crawl requests through deterministic rate limiting", async () => {
    let currentTime = 1_000;
    const sleepDurations: number[] = [];
    const fetchTimes: number[] = [];
    const fetcher = createFetcher({
      "https://example.com/": html(`<a href="/a">A</a><a href="/b">B</a>`),
      "https://example.com/a": html(`A`),
      "https://example.com/b": html(`B`)
    });
    const originalFetch = fetcher.fetch.bind(fetcher);
    fetcher.fetch = async (url, options) => {
      fetchTimes.push(currentTime);
      return originalFetch(url, options);
    };

    const result = await crawlSite(
      {
        startUrl: "https://example.com/",
        respectRobotsTxt: false,
        maxUrls: 3,
        rateLimit: {
          minIntervalMs: 50,
          now: () => currentTime,
          sleep: async (milliseconds) => {
            sleepDurations.push(milliseconds);
            currentTime += milliseconds;
          }
        }
      },
      fetcher
    );

    expect(result.pages.map((page) => page.url)).toEqual([
      "https://example.com/",
      "https://example.com/a",
      "https://example.com/b"
    ]);
    expect(fetchTimes).toEqual([1_000, 1_050, 1_100]);
    expect(sleepDurations).toEqual([50, 50]);
  });

  it("groups duplicate content by normalized response body hash", async () => {
    const fetcher = createFetcher({
      "https://example.com/": html(
        `<a href="/copy-a">A</a><a href="/copy-b">B</a><a href="/unique">Unique</a>`
      ),
      "https://example.com/copy-a": html(`<main>Same content</main>`),
      "https://example.com/copy-b": html(`<main>Same   content</main>`),
      "https://example.com/unique": html(`<main>Different content</main>`)
    });

    const result = await crawlSite(
      {
        startUrl: "https://example.com/",
        respectRobotsTxt: false,
        maxUrls: 4
      },
      fetcher
    );

    expect(result.duplicateContentGroups).toEqual([
      {
        normalizedBodySha256: expect.any(String),
        representativeUrl: "https://example.com/copy-a",
        duplicateUrls: ["https://example.com/copy-b"],
        urls: ["https://example.com/copy-a", "https://example.com/copy-b"],
        pageCount: 2,
        totalBodyBytes:
          Buffer.byteLength(`<main>Same content</main>`, "utf8") +
          Buffer.byteLength(`<main>Same   content</main>`, "utf8")
      }
    ]);
  });

  it("creates a checkpoint on interruption and resumes without refetching completed pages", async () => {
    const controller = new AbortController();
    const fetcher = createFetcher({
      "https://example.com/": html(`<a href="/a">A</a><a href="/b">B</a>`),
      "https://example.com/a": html(`A`),
      "https://example.com/b": html(`B`)
    });
    const originalFetch = fetcher.fetch.bind(fetcher);
    fetcher.fetch = async (url, options) => {
      const result = await originalFetch(url, options);
      if (url === "https://example.com/") {
        controller.abort();
      }
      return result;
    };

    const interrupted = await crawlSite(
      {
        startUrl: "https://example.com/",
        respectRobotsTxt: false,
        signal: controller.signal
      },
      fetcher
    );

    expect(interrupted.pages.map((page) => page.url)).toEqual([
      "https://example.com/"
    ]);
    expect(interrupted.recovery?.interrupted).toBe(true);
    const checkpoint =
      interrupted.recovery?.interrupted === true
        ? interrupted.recovery.checkpoint
        : undefined;
    expect(checkpoint?.pendingQueue.map((entry) => entry.url)).toEqual([
      "https://example.com/a",
      "https://example.com/b"
    ]);
    if (!checkpoint) {
      throw new Error("Expected interrupted crawl checkpoint.");
    }

    const resumed = await crawlSite(
      {
        startUrl: "https://example.com/",
        respectRobotsTxt: false,
        resumeFrom: checkpoint
      },
      fetcher
    );

    expect(resumed.recovery).toEqual({ interrupted: false, resumed: true });
    expect(resumed.pages.map((page) => page.url)).toEqual([
      "https://example.com/",
      "https://example.com/a",
      "https://example.com/b"
    ]);
    expect(
      fetcher.calls.filter((url) => url === "https://example.com/")
    ).toHaveLength(1);
    expect(resumed.failed).toContainEqual(
      expect.objectContaining({ reason: "cancelled" })
    );
  });

  it("crawls 10,000 synthetic URLs with deterministic artifact summary", async () => {
    const responses: Record<string, CrawlResponse> = {
      "https://example.com/robots.txt": response(
        "https://example.com/robots.txt",
        404,
        ""
      )
    };
    for (let index = 0; index < 10_000; index += 1) {
      const next =
        index + 1 < 10_000 ? `<a href="/page-${index + 1}">next</a>` : "";
      responses[`https://example.com/page-${index}`] = html(next);
    }
    const fetcher = createFetcher(responses);

    const result = await crawlSite(
      {
        startUrl: "https://example.com/page-0",
        maxUrls: 10_000,
        maxDepth: 10_000
      },
      fetcher
    );

    expect(result.pages).toHaveLength(10_000);
    expect(result.failed).toEqual([]);
    expect(result.artifactSummary).toBeDefined();
    expect(result.artifactSummary?.pageCount).toBe(10_000);
    expect(result.artifactSummary?.totalBodyBytes).toBeGreaterThan(0);
  });
});

function html(body: string): CrawlResponse {
  return response("https://example.com/", 200, body, {
    "content-type": "text/html"
  });
}

function response(
  url: string,
  statusCode: number,
  body: string,
  headers: Readonly<Record<string, string>> = {}
): CrawlResponse {
  return {
    url,
    statusCode,
    headers,
    body
  };
}

function createFetcher(responses: Readonly<Record<string, CrawlResponse>>) {
  const calls: string[] = [];
  const optionsByUrl = new Map<string, CrawlRequestOptions | undefined>();
  const fetcher: CrawlerFetcher & {
    calls: string[];
    optionsByUrl: Map<string, CrawlRequestOptions | undefined>;
  } = {
    calls,
    optionsByUrl,
    async fetch(
      url: string,
      options?: CrawlRequestOptions
    ): Promise<CrawlResponse> {
      calls.push(url);
      optionsByUrl.set(url, options);
      const found = responses[url];
      if (!found) {
        throw new Error(`Unexpected fetch ${url}`);
      }
      return { ...found, url };
    }
  };
  return fetcher;
}
