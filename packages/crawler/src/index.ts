import { createHash } from "node:crypto";

export type CrawlResponse = {
  url: string;
  statusCode: number;
  headers: Readonly<Record<string, string>>;
  body: string;
  redirectChain?: readonly string[];
};

export type CrawlerFetcher = {
  fetch(url: string, options?: CrawlRequestOptions): Promise<CrawlResponse>;
};

export type CrawlRequestOptions = {
  signal?: AbortSignal;
  timeoutMs?: number;
  headers?: Readonly<Record<string, string>>;
};

export type CrawlOptions = {
  startUrl: string;
  maxUrls?: number;
  maxDepth?: number;
  maxLinksPerPage?: number;
  maxQueryVariantsPerPath?: number;
  maxResponseBytes?: number;
  maxRedirects?: number;
  retryAttempts?: number;
  requestTimeoutMs?: number;
  allowPrivateNetworks?: boolean;
  sameOrigin?: boolean;
  respectRobotsTxt?: boolean;
  userAgent?: string;
  requestHeaders?: Readonly<Record<string, string>>;
  sessionCookies?: readonly CrawlCookie[];
  rateLimit?: CrawlRateLimitOptions;
  signal?: AbortSignal;
  resumeFrom?: CrawlCheckpoint;
};

export type CrawlRateLimitOptions = {
  minIntervalMs?: number;
  now?: () => number;
  sleep?: (milliseconds: number) => Promise<void>;
};

export type CrawlCookie = {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: "strict" | "lax" | "none";
  expires?: string;
};

export type CrawledPage = {
  url: string;
  statusCode: number;
  headers: Readonly<Record<string, string>>;
  body: string;
  contentType?: string;
  finalUrl?: string;
  redirectChain?: readonly string[];
  discoveredLinks: readonly string[];
  depth?: number;
  artifact?: CrawlArtifactSummary;
};

export type SkippedUrl = {
  url: string;
  reason:
    | "robots"
    | "external-origin"
    | "duplicate"
    | "limit"
    | "invalid-url"
    | "private-network"
    | "depth"
    | "query-variant-limit"
    | "link-limit";
  evidence?: string;
};

export type FailedUrl = {
  url: string;
  reason:
    | "cancelled"
    | "fetch-error"
    | "redirect-loop"
    | "response-too-large"
    | "timeout";
  attempts: number;
  evidence: string;
};

export type SitemapArtifact = {
  url: string;
  statusCode: number;
  contentType?: string;
  body: string;
};

export type CrawlResult = {
  startUrl: string;
  pages: readonly CrawledPage[];
  skipped: readonly SkippedUrl[];
  failed?: readonly FailedUrl[];
  duplicateContentGroups?: readonly DuplicateContentGroup[];
  artifactSummary?: CrawlArtifactSummary;
  limits?: Required<CrawlSafetyLimits>;
  recovery?: CrawlRecoveryState;
  robotsTxt?: {
    url: string;
    statusCode: number;
    body: string;
    crawlDelaySeconds?: number;
  };
  sitemap?: SitemapArtifact;
  sessionCookies?: readonly CrawlCookie[];
};

export type DuplicateContentGroup = {
  normalizedBodySha256: string;
  representativeUrl: string;
  duplicateUrls: readonly string[];
  urls: readonly string[];
  pageCount: number;
  totalBodyBytes: number;
};

export type RobotsPolicy = {
  allows(url: string): boolean;
  crawlDelaySeconds?: number;
};

export type CrawlSafetyLimits = {
  maxUrls?: number;
  maxDepth?: number;
  maxLinksPerPage?: number;
  maxQueryVariantsPerPath?: number;
  maxResponseBytes?: number;
  maxRedirects?: number;
  retryAttempts?: number;
  requestTimeoutMs?: number;
  allowPrivateNetworks?: boolean;
};

export type CrawlArtifactSummary = {
  pageCount: number;
  totalBodyBytes: number;
  largestBodyBytes: number;
  bodySha256: string;
};

export type CrawlQueueEntry = {
  url: string;
  depth: number;
};

export type CrawlCheckpoint = {
  version: 1;
  startUrl: string;
  createdAt: string;
  pendingQueue: readonly CrawlQueueEntry[];
  queuedUrls: readonly string[];
  fetchedUrls: readonly string[];
  queryVariants: readonly {
    key: string;
    variants: readonly string[];
  }[];
  pages: readonly CrawledPage[];
  skipped: readonly SkippedUrl[];
  failed: readonly FailedUrl[];
  robotsTxt?: {
    url: string;
    statusCode: number;
    body: string;
    crawlDelaySeconds?: number;
  };
  sitemap?: SitemapArtifact;
  sessionCookies?: readonly CrawlCookie[];
};

export type CrawlRecoveryState =
  | {
      interrupted: false;
      resumed: boolean;
    }
  | {
      interrupted: true;
      resumed: boolean;
      checkpoint: CrawlCheckpoint;
    };

const defaultMaxUrls = 100;
const defaultMaxDepth = 50;
const defaultMaxLinksPerPage = 500;
const defaultMaxQueryVariantsPerPath = 20;
const defaultMaxResponseBytes = 5 * 1024 * 1024;
const defaultMaxRedirects = 10;
const defaultRetryAttempts = 1;
const defaultRequestTimeoutMs = 30_000;
const defaultUserAgent = "SearchLint";

export async function crawlSite(
  options: CrawlOptions,
  fetcher: CrawlerFetcher
): Promise<CrawlResult> {
  const startUrl = normalizeUrl(options.startUrl);
  if (!startUrl) {
    const limits = resolveSafetyLimits(options);
    return {
      startUrl: options.startUrl,
      pages: [],
      skipped: [{ url: options.startUrl, reason: "invalid-url" }],
      failed: [],
      artifactSummary: emptyArtifactSummary(),
      limits
    };
  }

  const limits = resolveSafetyLimits(options);
  const sameOrigin = options.sameOrigin ?? true;
  const respectRobotsTxt = options.respectRobotsTxt ?? true;
  const userAgent = options.userAgent ?? defaultUserAgent;
  const origin = urlOrigin(startUrl);
  const resume = normalizeCheckpoint(options.resumeFrom, startUrl);
  const resumed = resume !== undefined;
  const skipped: SkippedUrl[] = [...(resume?.skipped ?? [])];
  const failed: FailedUrl[] = [...(resume?.failed ?? [])];
  const pages: CrawledPage[] = [...(resume?.pages ?? [])];
  if (!limits.allowPrivateNetworks && isPrivateNetworkUrl(startUrl)) {
    return {
      startUrl,
      pages,
      skipped: [
        {
          url: startUrl,
          reason: "private-network",
          evidence: "Private-network crawling is disabled."
        }
      ],
      failed,
      artifactSummary: emptyArtifactSummary(),
      limits
    };
  }

  const queue: CrawlQueueEntry[] = resume
    ? [...resume.pendingQueue]
    : [{ url: startUrl, depth: 0 }];
  const queued = new Set(resume?.queuedUrls ?? [startUrl]);
  const fetched = new Set(resume?.fetchedUrls ?? []);
  const queryVariantCounts = new Map(
    (resume?.queryVariants ?? []).map((entry) => [
      entry.key,
      new Set(entry.variants)
    ])
  );
  const cookieJar = createCookieJar(startUrl, [
    ...(options.sessionCookies ?? []),
    ...(resume?.sessionCookies ?? [])
  ]);
  const requestContext: CrawlRequestContext = {
    requestHeaders: normalizeHeaders(options.requestHeaders ?? {}),
    cookieJar,
    rateLimiter: createRateLimiter(options.rateLimit),
    limits,
    signal: options.signal
  };

  const robots = resume?.robotsTxt
    ? {
        url: resume.robotsTxt.url,
        statusCode: resume.robotsTxt.statusCode,
        body: resume.robotsTxt.body,
        policy: parseRobotsTxt(resume.robotsTxt.body, userAgent)
      }
    : respectRobotsTxt
      ? await fetchRobotsPolicy(startUrl, userAgent, fetcher, requestContext)
      : undefined;
  const sitemap =
    resume?.sitemap ??
    (robots
      ? await fetchSitemapArtifact(robots.body, fetcher, requestContext)
      : undefined);
  let recovery: CrawlRecoveryState = {
    interrupted: false,
    resumed
  };

  while (queue.length > 0) {
    if (options.signal?.aborted) {
      failed.push({
        url: queue[0]?.url ?? startUrl,
        reason: "cancelled",
        attempts: 0,
        evidence: "Crawl aborted before the next queued URL was fetched."
      });
      recovery = {
        interrupted: true,
        resumed,
        checkpoint: createCheckpoint({
          startUrl,
          queue,
          queued,
          fetched,
          queryVariantCounts,
          pages,
          skipped,
          failed,
          robots,
          sitemap,
          cookieJar
        })
      };
      break;
    }

    const queuedUrl = queue.shift()!;
    const current = queuedUrl.url;
    if (fetched.has(current)) {
      skipped.push({ url: current, reason: "duplicate" });
      continue;
    }

    if (pages.length >= limits.maxUrls) {
      skipped.push({ url: current, reason: "limit" });
      continue;
    }

    if (queuedUrl.depth > limits.maxDepth) {
      skipped.push({
        url: current,
        reason: "depth",
        evidence: `Depth ${queuedUrl.depth} exceeds maxDepth ${limits.maxDepth}.`
      });
      continue;
    }

    if (sameOrigin && urlOrigin(current) !== origin) {
      skipped.push({ url: current, reason: "external-origin" });
      continue;
    }

    if (!limits.allowPrivateNetworks && isPrivateNetworkUrl(current)) {
      skipped.push({
        url: current,
        reason: "private-network",
        evidence: "Private-network crawling is disabled."
      });
      continue;
    }

    if (robots && !robots.policy.allows(current)) {
      skipped.push({ url: current, reason: "robots" });
      continue;
    }

    let response: CrawlResponse;
    try {
      response = await fetchWithPolicy(current, fetcher, requestContext);
    } catch (error) {
      failed.push(toFailedUrl(current, error));
      continue;
    }
    fetched.add(current);

    if (
      response.redirectChain &&
      response.redirectChain.length > limits.maxRedirects
    ) {
      failed.push({
        url: current,
        reason: "redirect-loop",
        attempts: 1,
        evidence: `Redirect chain length ${response.redirectChain.length} exceeds maxRedirects ${limits.maxRedirects}.`
      });
      continue;
    }

    const bodyBytes = byteLength(response.body);
    if (bodyBytes > limits.maxResponseBytes) {
      failed.push({
        url: current,
        reason: "response-too-large",
        attempts: 1,
        evidence: `Response body ${bodyBytes} bytes exceeds maxResponseBytes ${limits.maxResponseBytes}.`
      });
      continue;
    }

    const contentType = headerValue(response.headers, "content-type");
    const extractedLinks = isHtml(contentType)
      ? extractLinks(response.body, response.url)
      : [];
    const linkLimitSkipped =
      extractedLinks.length > limits.maxLinksPerPage
        ? extractedLinks.slice(limits.maxLinksPerPage)
        : [];
    for (const link of linkLimitSkipped) {
      skipped.push({
        url: link,
        reason: "link-limit",
        evidence: `Page link count exceeds maxLinksPerPage ${limits.maxLinksPerPage}.`
      });
    }
    const links = extractedLinks.slice(0, limits.maxLinksPerPage);
    const normalizedLinks = links
      .map((link) => normalizeUrl(link))
      .filter((link): link is string => Boolean(link));
    const discoveredLinks = uniqueStable(
      sameOrigin
        ? normalizedLinks.filter((link) => urlOrigin(link) === origin)
        : normalizedLinks
    );

    pages.push({
      url: current,
      statusCode: response.statusCode,
      headers: response.headers,
      body: response.body,
      ...(contentType ? { contentType } : {}),
      ...(response.url === current ? {} : { finalUrl: response.url }),
      ...(response.redirectChain === undefined
        ? {}
        : { redirectChain: response.redirectChain }),
      discoveredLinks,
      depth: queuedUrl.depth,
      artifact: createSinglePageArtifactSummary(response.body)
    });

    for (const link of discoveredLinks) {
      if (queued.has(link) || fetched.has(link)) {
        continue;
      }
      if (
        !trackQueryVariant(
          link,
          queryVariantCounts,
          limits.maxQueryVariantsPerPath
        )
      ) {
        skipped.push({
          url: link,
          reason: "query-variant-limit",
          evidence: `Query variants for this path exceed maxQueryVariantsPerPath ${limits.maxQueryVariantsPerPath}.`
        });
        continue;
      }
      queued.add(link);
      queue.push({ url: link, depth: queuedUrl.depth + 1 });
    }
  }

  return {
    startUrl,
    pages,
    failed,
    skipped,
    duplicateContentGroups: createDuplicateContentGroups(pages),
    artifactSummary: createCrawlArtifactSummary(pages),
    limits,
    recovery,
    ...(robots
      ? {
          robotsTxt: {
            url: robots.url,
            statusCode: robots.statusCode,
            body: robots.body,
            ...(robots.policy.crawlDelaySeconds === undefined
              ? {}
              : { crawlDelaySeconds: robots.policy.crawlDelaySeconds })
          }
        }
      : {}),
    ...(sitemap ? { sitemap } : {})
  };
}

export function normalizeUrl(
  value: string,
  baseUrl?: string
): string | undefined {
  return parseUrl(value, baseUrl)?.href;
}

export function extractLinks(html: string, baseUrl: string): readonly string[] {
  const links: string[] = [];
  for (const match of html.matchAll(
    /<a\s+[^>]*href\s*=\s*["']([^"']+)["'][^>]*>/gi
  )) {
    const href = match[1];
    if (!href) {
      continue;
    }
    const normalized = normalizeUrl(href, baseUrl);
    if (normalized) {
      links.push(normalized);
    }
  }
  return links;
}

export function parseRobotsTxt(body: string, userAgent: string): RobotsPolicy {
  const groups = parseRobotsGroups(body);
  const normalizedAgent = userAgent.toLowerCase();
  const matching = groups.filter((group) =>
    group.agents.some((agent) => agent === "*" || agent === normalizedAgent)
  );
  const rules = matching.flatMap((group) => group.rules);
  const crawlDelaySeconds = matching
    .map((group) => group.crawlDelaySeconds)
    .find((value): value is number => value !== undefined);

  return {
    ...(crawlDelaySeconds === undefined ? {} : { crawlDelaySeconds }),
    allows(url: string): boolean {
      const path = pathForRobots(url);
      const match = longestMatchingRule(path, rules);
      return match?.type !== "disallow";
    }
  };
}

type RobotsGroup = {
  agents: string[];
  rules: RobotsRule[];
  crawlDelaySeconds?: number;
};

type RobotsRule = {
  type: "allow" | "disallow";
  path: string;
};

async function fetchRobotsPolicy(
  startUrl: string,
  userAgent: string,
  fetcher: CrawlerFetcher,
  context: CrawlRequestContext
): Promise<
  | {
      url: string;
      statusCode: number;
      body: string;
      policy: RobotsPolicy;
    }
  | undefined
> {
  const robotsUrl = `${urlOrigin(startUrl)}/robots.txt`;
  const response = await fetchWithPolicy(robotsUrl, fetcher, context);
  if (response.statusCode < 200 || response.statusCode >= 300) {
    return {
      url: robotsUrl,
      statusCode: response.statusCode,
      body: response.body,
      policy: { allows: () => true }
    };
  }

  return {
    url: robotsUrl,
    statusCode: response.statusCode,
    body: response.body,
    policy: parseRobotsTxt(response.body, userAgent)
  };
}

async function fetchSitemapArtifact(
  robotsBody: string,
  fetcher: CrawlerFetcher,
  context: CrawlRequestContext
): Promise<SitemapArtifact | undefined> {
  const sitemapUrl = firstSitemapUrl(robotsBody);
  if (!sitemapUrl) {
    return undefined;
  }

  const response = await fetchWithPolicy(sitemapUrl, fetcher, context);
  const contentType = headerValue(response.headers, "content-type");

  return {
    url: response.url,
    statusCode: response.statusCode,
    ...(contentType ? { contentType } : {}),
    body: response.body
  };
}

function firstSitemapUrl(robotsBody: string): string | undefined {
  for (const line of robotsBody.split(/\r?\n/)) {
    const match = line.match(/^\s*sitemap\s*:\s*(\S+)\s*$/i);
    if (match?.[1]) {
      return normalizeUrl(match[1]);
    }
  }
  return undefined;
}

function parseRobotsGroups(body: string): RobotsGroup[] {
  const groups: RobotsGroup[] = [];
  let current: RobotsGroup | undefined;

  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.split("#", 1)[0]?.trim();
    if (!line) {
      continue;
    }

    const separator = line.indexOf(":");
    if (separator < 0) {
      continue;
    }

    const key = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();

    if (key === "user-agent") {
      if (!current || current.rules.length > 0) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      continue;
    }

    if ((key === "allow" || key === "disallow") && current) {
      current.rules.push({ type: key, path: value });
      continue;
    }

    if (key === "crawl-delay" && current) {
      const seconds = Number(value);
      if (Number.isFinite(seconds) && seconds >= 0) {
        current.crawlDelaySeconds = seconds;
      }
    }
  }

  return groups;
}

function longestMatchingRule(
  path: string,
  rules: readonly RobotsRule[]
): RobotsRule | undefined {
  let selected: RobotsRule | undefined;

  for (const rule of rules) {
    if (rule.path === "" || !path.startsWith(rule.path)) {
      continue;
    }

    if (!selected || rule.path.length > selected.path.length) {
      selected = rule;
    }
  }

  return selected;
}

function pathForRobots(value: string): string {
  const parsed = parseUrl(value);
  return parsed ? `${parsed.pathname}${parsed.search}` : "/";
}

function urlOrigin(value: string): string {
  return parseUrl(value)?.origin ?? "";
}

function headerValue(
  headers: Readonly<Record<string, string>>,
  name: string
): string | undefined {
  const lowerName = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === lowerName) {
      return value;
    }
  }
  return undefined;
}

function isHtml(contentType: string | undefined): boolean {
  return contentType?.toLowerCase().includes("text/html") ?? false;
}

function uniqueStable(values: readonly string[]): readonly string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }
    seen.add(value);
    result.push(value);
  }
  return result;
}

function resolveSafetyLimits(
  options: CrawlOptions
): Required<CrawlSafetyLimits> {
  return {
    maxUrls: options.maxUrls ?? defaultMaxUrls,
    maxDepth: options.maxDepth ?? defaultMaxDepth,
    maxLinksPerPage: options.maxLinksPerPage ?? defaultMaxLinksPerPage,
    maxQueryVariantsPerPath:
      options.maxQueryVariantsPerPath ?? defaultMaxQueryVariantsPerPath,
    maxResponseBytes: options.maxResponseBytes ?? defaultMaxResponseBytes,
    maxRedirects: options.maxRedirects ?? defaultMaxRedirects,
    retryAttempts: options.retryAttempts ?? defaultRetryAttempts,
    requestTimeoutMs: options.requestTimeoutMs ?? defaultRequestTimeoutMs,
    allowPrivateNetworks: options.allowPrivateNetworks ?? false
  };
}

function normalizeCheckpoint(
  checkpoint: CrawlCheckpoint | undefined,
  startUrl: string
): CrawlCheckpoint | undefined {
  if (!checkpoint) {
    return undefined;
  }
  if (checkpoint.version !== 1) {
    throw new Error(
      `Unsupported crawl checkpoint version ${checkpoint.version}.`
    );
  }
  if (checkpoint.startUrl !== startUrl) {
    throw new Error(
      `Crawl checkpoint startUrl ${checkpoint.startUrl} does not match ${startUrl}.`
    );
  }
  return checkpoint;
}

function createCheckpoint(input: {
  startUrl: string;
  queue: readonly CrawlQueueEntry[];
  queued: ReadonlySet<string>;
  fetched: ReadonlySet<string>;
  queryVariantCounts: ReadonlyMap<string, ReadonlySet<string>>;
  pages: readonly CrawledPage[];
  skipped: readonly SkippedUrl[];
  failed: readonly FailedUrl[];
  robots:
    | {
        url: string;
        statusCode: number;
        body: string;
        policy: RobotsPolicy;
      }
    | undefined;
  sitemap: SitemapArtifact | undefined;
  cookieJar: CrawlCookieJar;
}): CrawlCheckpoint {
  return {
    version: 1,
    startUrl: input.startUrl,
    createdAt: new Date(0).toISOString(),
    pendingQueue: [...input.queue],
    queuedUrls: [...input.queued],
    fetchedUrls: [...input.fetched],
    queryVariants: [...input.queryVariantCounts.entries()]
      .map(([key, variants]) => ({
        key,
        variants: [...variants].sort()
      }))
      .sort((a, b) => a.key.localeCompare(b.key)),
    pages: input.pages,
    skipped: input.skipped,
    failed: input.failed,
    sessionCookies: input.cookieJar.snapshot(),
    ...(input.robots
      ? {
          robotsTxt: {
            url: input.robots.url,
            statusCode: input.robots.statusCode,
            body: input.robots.body,
            ...(input.robots.policy.crawlDelaySeconds === undefined
              ? {}
              : { crawlDelaySeconds: input.robots.policy.crawlDelaySeconds })
          }
        }
      : {}),
    ...(input.sitemap ? { sitemap: input.sitemap } : {})
  };
}

async function fetchWithPolicy(
  url: string,
  fetcher: CrawlerFetcher,
  context: CrawlRequestContext
): Promise<CrawlResponse> {
  let lastError: unknown;
  const attempts = Math.max(1, context.limits.retryAttempts + 1);

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    if (context.signal?.aborted) {
      throw new CrawlFetchError(
        "cancelled",
        attempt - 1,
        "Crawl signal was aborted."
      );
    }

    try {
      await context.rateLimiter.beforeRequest(url);
      const requestHeaders = headersForRequest(url, context);
      const response = await withTimeout(
        fetcher.fetch(url, {
          ...(context.signal ? { signal: context.signal } : {}),
          timeoutMs: context.limits.requestTimeoutMs,
          ...(requestHeaders ? { headers: requestHeaders } : {})
        }),
        context.limits.requestTimeoutMs
      );
      context.cookieJar.storeFromResponse(response.url, response.headers);
      return response;
    } catch (error) {
      if (error instanceof CrawlFetchError && error.reason === "timeout") {
        throw new CrawlFetchError(
          "timeout",
          attempt,
          `Fetch timed out after ${context.limits.requestTimeoutMs}ms.`
        );
      }

      lastError = error;
      if (attempt >= attempts) {
        break;
      }
    }
  }

  throw new CrawlFetchError(
    "fetch-error",
    attempts,
    lastError instanceof Error ? lastError.message : String(lastError)
  );
}

type CrawlRequestContext = {
  requestHeaders: Readonly<Record<string, string>>;
  cookieJar: CrawlCookieJar;
  rateLimiter: CrawlRateLimiter;
  limits: Required<CrawlSafetyLimits>;
  signal: AbortSignal | undefined;
};

type CrawlRateLimiter = {
  beforeRequest(url: string): Promise<void>;
};

function createRateLimiter(
  options: CrawlRateLimitOptions | undefined
): CrawlRateLimiter {
  const minIntervalMs = Math.max(0, options?.minIntervalMs ?? 0);
  if (minIntervalMs <= 0) {
    return {
      async beforeRequest() {
        return;
      }
    };
  }

  const now = options?.now ?? Date.now;
  const sleep = options?.sleep ?? defaultSleep;
  const lastRequestAtByOrigin = new Map<string, number>();

  return {
    async beforeRequest(url: string) {
      const origin = urlOrigin(url);
      if (!origin) {
        return;
      }

      const current = now();
      const previous = lastRequestAtByOrigin.get(origin);
      if (previous !== undefined) {
        const elapsed = current - previous;
        const delay = minIntervalMs - elapsed;
        if (delay > 0) {
          await sleep(delay);
        }
      }
      lastRequestAtByOrigin.set(origin, now());
    }
  };
}

function defaultSleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

type StoredCookie = Required<Pick<CrawlCookie, "name" | "value" | "path">> &
  Omit<CrawlCookie, "name" | "value" | "path"> & {
    domain: string;
    hostOnly: boolean;
  };

type CrawlCookieJar = {
  headerFor(url: string): string | undefined;
  storeFromResponse(
    url: string,
    headers: Readonly<Record<string, string>>
  ): void;
  snapshot(): readonly CrawlCookie[];
};

function createCookieJar(
  startUrl: string,
  initialCookies: readonly CrawlCookie[]
): CrawlCookieJar {
  const start = parseUrl(startUrl);
  const cookies = new Map<string, StoredCookie>();

  for (const cookie of initialCookies) {
    const normalized = normalizeInitialCookie(cookie, start);
    if (normalized) {
      cookies.set(cookieKey(normalized), normalized);
    }
  }

  return {
    headerFor(url: string): string | undefined {
      const matching = [...cookies.values()]
        .filter((cookie) => cookieMatchesUrl(cookie, url))
        .sort((left, right) => right.path.length - left.path.length);
      if (matching.length === 0) {
        return undefined;
      }
      return matching
        .map((cookie) => `${cookie.name}=${cookie.value}`)
        .join("; ");
    },
    storeFromResponse(url: string, headers: Readonly<Record<string, string>>) {
      const setCookie = headerValue(headers, "set-cookie");
      if (!setCookie) {
        return;
      }
      const responseUrl = parseUrl(url);
      if (!responseUrl) {
        return;
      }
      for (const value of splitSetCookieHeader(setCookie)) {
        const cookie = parseSetCookie(value, responseUrl);
        if (!cookie) {
          continue;
        }
        const key = cookieKey(cookie);
        if (cookie.expires && Date.parse(cookie.expires) <= Date.now()) {
          cookies.delete(key);
          continue;
        }
        cookies.set(key, cookie);
      }
    },
    snapshot(): readonly CrawlCookie[] {
      return [...cookies.values()]
        .sort((left, right) => cookieKey(left).localeCompare(cookieKey(right)))
        .map(({ hostOnly: _hostOnly, ...cookie }) => cookie);
    }
  };
}

function normalizeInitialCookie(
  cookie: CrawlCookie,
  start: ParsedUrl | undefined
): StoredCookie | undefined {
  if (!cookie.name || cookie.name.includes("=")) {
    return undefined;
  }
  const domain = normalizeCookieDomain(cookie.domain ?? start?.host);
  if (!domain) {
    return undefined;
  }
  return {
    ...cookie,
    name: cookie.name,
    value: cookie.value,
    domain,
    hostOnly: cookie.domain === undefined,
    path: cookie.path ?? "/"
  };
}

function parseSetCookie(
  value: string,
  responseUrl: ParsedUrl
): StoredCookie | undefined {
  const parts = value.split(";").map((part) => part.trim());
  const [nameValue, ...attributes] = parts;
  const separator = nameValue?.indexOf("=") ?? -1;
  if (!nameValue || separator <= 0) {
    return undefined;
  }

  const cookie: StoredCookie = {
    name: nameValue.slice(0, separator),
    value: nameValue.slice(separator + 1),
    domain: responseUrl.host.toLowerCase(),
    hostOnly: true,
    path: defaultCookiePath(responseUrl.pathname)
  };

  for (const attribute of attributes) {
    const attributeSeparator = attribute.indexOf("=");
    const key =
      attributeSeparator < 0
        ? attribute.toLowerCase()
        : attribute.slice(0, attributeSeparator).trim().toLowerCase();
    const attrValue =
      attributeSeparator < 0
        ? ""
        : attribute.slice(attributeSeparator + 1).trim();

    if (key === "domain") {
      const domain = normalizeCookieDomain(attrValue);
      if (domain && domainMatches(responseUrl.host, domain)) {
        cookie.domain = domain;
        cookie.hostOnly = false;
      }
      continue;
    }
    if (key === "path" && attrValue.startsWith("/")) {
      cookie.path = attrValue;
      continue;
    }
    if (key === "secure") {
      cookie.secure = true;
      continue;
    }
    if (key === "httponly") {
      cookie.httpOnly = true;
      continue;
    }
    if (key === "samesite") {
      const sameSite = attrValue.toLowerCase();
      if (sameSite === "strict" || sameSite === "lax" || sameSite === "none") {
        cookie.sameSite = sameSite;
      }
      continue;
    }
    if (key === "expires") {
      cookie.expires = attrValue;
      continue;
    }
    if (key === "max-age" && Number(attrValue) <= 0) {
      cookie.expires = new Date(0).toISOString();
    }
  }

  return cookie;
}

function headersForRequest(
  url: string,
  context: CrawlRequestContext
): Readonly<Record<string, string>> | undefined {
  const headers: Record<string, string> = { ...context.requestHeaders };
  const cookieHeader = context.cookieJar.headerFor(url);
  const existingCookieHeader = headerValue(headers, "cookie");
  if (cookieHeader && existingCookieHeader) {
    headers.cookie = `${existingCookieHeader}; ${cookieHeader}`;
  } else if (cookieHeader) {
    headers.cookie = cookieHeader;
  }
  return Object.keys(headers).length > 0 ? headers : undefined;
}

function normalizeHeaders(
  headers: Readonly<Record<string, string>>
): Readonly<Record<string, string>> {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (key.trim() && value !== "") {
      normalized[key.toLowerCase()] = value;
    }
  }
  return normalized;
}

function splitSetCookieHeader(value: string): readonly string[] {
  return value.split(/,(?=\s*[^;,=\s]+=[^;,]*)/g).map((part) => part.trim());
}

function normalizeCookieDomain(value: string | undefined): string | undefined {
  const domain = value?.trim().replace(/^\./, "").toLowerCase();
  return domain ? domain : undefined;
}

function cookieMatchesUrl(cookie: StoredCookie, url: string): boolean {
  const parsed = parseUrl(url);
  if (!parsed) {
    return false;
  }
  if (cookie.secure && !parsed.origin.startsWith("https://")) {
    return false;
  }
  const host = parsed.host.toLowerCase();
  if (
    cookie.hostOnly
      ? host !== cookie.domain
      : !domainMatches(host, cookie.domain)
  ) {
    return false;
  }
  return pathMatches(parsed.pathname, cookie.path);
}

function domainMatches(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

function pathMatches(pathname: string, cookiePath: string): boolean {
  if (cookiePath === "/") {
    return true;
  }
  return pathname === cookiePath || pathname.startsWith(`${cookiePath}/`);
}

function defaultCookiePath(pathname: string): string {
  if (!pathname || pathname === "/") {
    return "/";
  }
  const lastSlash = pathname.lastIndexOf("/");
  return lastSlash <= 0 ? "/" : pathname.slice(0, lastSlash);
}

function cookieKey(cookie: Pick<StoredCookie, "domain" | "path" | "name">) {
  return `${cookie.domain}\t${cookie.path}\t${cookie.name}`;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  if (timeoutMs <= 0) {
    return promise;
  }

  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(
        new CrawlFetchError(
          "timeout",
          1,
          `Fetch timed out after ${timeoutMs}ms.`
        )
      );
    }, timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timeout);
        reject(error);
      }
    );
  });
}

class CrawlFetchError extends Error {
  constructor(
    readonly reason: FailedUrl["reason"],
    readonly attempts: number,
    message: string
  ) {
    super(message);
  }
}

function toFailedUrl(url: string, error: unknown): FailedUrl {
  if (error instanceof CrawlFetchError) {
    return {
      url,
      reason: error.reason,
      attempts: error.attempts,
      evidence: error.message
    };
  }

  return {
    url,
    reason: "fetch-error",
    attempts: 1,
    evidence: error instanceof Error ? error.message : String(error)
  };
}

function trackQueryVariant(
  url: string,
  counts: Map<string, Set<string>>,
  maxQueryVariantsPerPath: number
): boolean {
  const parsed = parseUrl(url);
  if (!parsed) {
    return false;
  }

  const key = `${parsed.origin}${parsed.pathname}`;
  const variants = counts.get(key) ?? new Set<string>();
  variants.add(parsed.search);
  counts.set(key, variants);
  return variants.size <= maxQueryVariantsPerPath;
}

function isPrivateNetworkUrl(value: string): boolean {
  const parsed = parseAbsoluteUrl(value);
  if (!parsed) {
    return false;
  }

  const host = parsed.host;
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host === "127.0.0.1" ||
    host.startsWith("127.") ||
    host === "0.0.0.0" ||
    host === "::1" ||
    host === "[::1]"
  ) {
    return true;
  }

  const parts = host.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) {
    return false;
  }

  const [first, second] = parts;
  return (
    first === 10 ||
    (first === 172 && second !== undefined && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 169 && second === 254)
  );
}

function createSinglePageArtifactSummary(body: string): CrawlArtifactSummary {
  const bytes = byteLength(body);
  return {
    pageCount: 1,
    totalBodyBytes: bytes,
    largestBodyBytes: bytes,
    bodySha256: sha256(body)
  };
}

function createCrawlArtifactSummary(
  pages: readonly CrawledPage[]
): CrawlArtifactSummary {
  if (pages.length === 0) {
    return emptyArtifactSummary();
  }

  const bodySha256 = sha256(
    pages
      .map((page) => page.artifact?.bodySha256 ?? sha256(page.body))
      .join("\n")
  );
  const totalBodyBytes = pages.reduce(
    (total, page) =>
      total + (page.artifact?.totalBodyBytes ?? byteLength(page.body)),
    0
  );
  const largestBodyBytes = Math.max(
    ...pages.map(
      (page) => page.artifact?.largestBodyBytes ?? byteLength(page.body)
    )
  );

  return {
    pageCount: pages.length,
    totalBodyBytes,
    largestBodyBytes,
    bodySha256
  };
}

function createDuplicateContentGroups(
  pages: readonly CrawledPage[]
): readonly DuplicateContentGroup[] {
  const groups = new Map<
    string,
    {
      pages: CrawledPage[];
      totalBodyBytes: number;
    }
  >();

  for (const page of pages) {
    const normalizedBodySha256 = sha256(
      normalizeBodyForDuplicateContent(page.body)
    );
    const existing = groups.get(normalizedBodySha256);
    const bytes = byteLength(page.body);
    if (existing) {
      existing.pages.push(page);
      existing.totalBodyBytes += bytes;
      continue;
    }
    groups.set(normalizedBodySha256, {
      pages: [page],
      totalBodyBytes: bytes
    });
  }

  return [...groups.entries()]
    .filter(([, group]) => group.pages.length > 1)
    .map(([normalizedBodySha256, group]) => {
      const urls = group.pages.map((page) => page.url);
      const representativeUrl = urls[0]!;
      return {
        normalizedBodySha256,
        representativeUrl,
        duplicateUrls: urls.slice(1),
        urls,
        pageCount: urls.length,
        totalBodyBytes: group.totalBodyBytes
      };
    })
    .sort((left, right) =>
      left.representativeUrl.localeCompare(right.representativeUrl)
    );
}

function normalizeBodyForDuplicateContent(body: string): string {
  return body.replace(/\s+/g, " ").trim();
}

function emptyArtifactSummary(): CrawlArtifactSummary {
  return {
    pageCount: 0,
    totalBodyBytes: 0,
    largestBodyBytes: 0,
    bodySha256: sha256("")
  };
}

function byteLength(value: string): number {
  return Buffer.byteLength(value, "utf8");
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

type ParsedUrl = {
  href: string;
  origin: string;
  host: string;
  pathname: string;
  search: string;
};

function parseUrl(value: string, baseUrl?: string): ParsedUrl | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed) && !/^https?:\/\//i.test(trimmed)) {
    return undefined;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return parseAbsoluteUrl(trimmed);
  }

  if (!baseUrl) {
    return undefined;
  }

  const base = parseAbsoluteUrl(baseUrl);
  if (!base) {
    return undefined;
  }

  if (trimmed.startsWith("//")) {
    const protocol = base.origin.split("://", 1)[0] ?? "https";
    return parseAbsoluteUrl(`${protocol}:${trimmed}`);
  }

  const withoutHash = trimmed.split("#", 1)[0] ?? "";
  const [pathPart = "", searchPart = ""] = withoutHash.split("?", 2);
  const baseDirectory = base.pathname.slice(
    0,
    base.pathname.lastIndexOf("/") + 1
  );
  const pathname = normalizePath(
    pathPart.startsWith("/") ? pathPart : `${baseDirectory}${pathPart}`
  );
  const search = searchPart ? `?${searchPart}` : "";

  return makeParsedUrl(base.origin, pathname, search);
}

function parseAbsoluteUrl(value: string): ParsedUrl | undefined {
  const withoutHash = value.split("#", 1)[0] ?? "";
  const match = withoutHash.match(
    /^(https?):\/\/([^/?#]+)([^?#]*)(\?[^#]*)?$/i
  );
  if (!match) {
    return undefined;
  }

  const protocol = match[1]!.toLowerCase();
  const host = match[2]!.toLowerCase();
  const pathname = normalizePath(match[3] || "/");
  const search = match[4] ?? "";

  return makeParsedUrl(`${protocol}://${host}`, pathname, search, host);
}

function makeParsedUrl(
  origin: string,
  pathname: string,
  search: string,
  host?: string
): ParsedUrl {
  const normalizedPath =
    pathname !== "/" && pathname.endsWith("/")
      ? pathname.slice(0, -1)
      : pathname;

  return {
    href: `${origin}${normalizedPath}${search}`,
    origin,
    host: host ?? origin.replace(/^[a-z]+:\/\//i, ""),
    pathname: normalizedPath,
    search
  };
}

function normalizePath(pathname: string): string {
  const segments: string[] = [];
  for (const segment of pathname.split("/")) {
    if (!segment || segment === ".") {
      continue;
    }
    if (segment === "..") {
      segments.pop();
      continue;
    }
    segments.push(segment);
  }

  return `/${segments.join("/")}`;
}
