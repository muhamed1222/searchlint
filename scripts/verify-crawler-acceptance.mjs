#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const reportPath = path.join(
  repoRoot,
  "reports/crawler-acceptance-report.json"
);
const samplePath = path.join(
  repoRoot,
  "docs/examples/crawler-acceptance-report.sample.json"
);
const fixedGeneratedAt = "2026-06-22T00:00:00.000Z";

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    env: { ...process.env, ...options.env },
    encoding: "utf8",
    stdio: options.stdio ?? "pipe"
  });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function caseResult(id, status, evidence, notes = []) {
  return { id, status, evidence, notes };
}

async function main() {
  run("pnpm", ["build"], { stdio: "inherit" });

  const { crawlSite } = await import("../packages/crawler/dist/src/index.js");
  const cases = [];

  const largeCrawl = await crawlSite(
    {
      startUrl: "https://example.com/page-0",
      maxUrls: 10_000,
      maxDepth: 10_000
    },
    createSyntheticLinearFetcher(10_000)
  );
  assert(
    largeCrawl.pages.length === 10_000,
    "Crawler must process 10,000 URLs"
  );
  assert(
    largeCrawl.failed.length === 0,
    "10,000 URL crawl must have no failures"
  );
  assert(
    largeCrawl.artifactSummary.pageCount === 10_000,
    "Artifact summary must include every crawled page"
  );
  cases.push(
    caseResult("local-10000-url-scale", "PASS", {
      pageCount: largeCrawl.pages.length,
      totalBodyBytes: largeCrawl.artifactSummary.totalBodyBytes,
      largestBodyBytes: largeCrawl.artifactSummary.largestBodyBytes,
      bodySha256: largeCrawl.artifactSummary.bodySha256
    })
  );

  const safety = await crawlSite(
    {
      startUrl: "https://example.com/",
      maxUrls: 10,
      maxLinksPerPage: 2,
      maxQueryVariantsPerPath: 1,
      maxDepth: 1
    },
    createMapFetcher({
      "https://example.com/robots.txt": response(
        "https://example.com/robots.txt",
        200,
        "User-agent: SearchLint\nCrawl-delay: 2\nAllow: /\n"
      ),
      "https://example.com/": html(
        [
          '<a href="/search?q=1">one</a>',
          '<a href="/search?q=2">two</a>',
          '<a href="/too-many">too many</a>'
        ].join("")
      ),
      "https://example.com/search?q=1": html('<a href="/deep">deep</a>')
    })
  );
  assert(
    safety.robotsTxt?.crawlDelaySeconds === 2,
    "Crawler must parse robots crawl-delay"
  );
  assert(
    safety.skipped.some((item) => item.reason === "query-variant-limit"),
    "Crawler must cap query variants per path"
  );
  assert(
    safety.skipped.some((item) => item.reason === "link-limit"),
    "Crawler must cap links per page"
  );
  assert(
    safety.skipped.some((item) => item.reason === "depth"),
    "Crawler must cap crawl depth"
  );
  cases.push(
    caseResult("robots-url-explosion-depth-controls", "PASS", {
      crawlDelaySeconds: safety.robotsTxt?.crawlDelaySeconds,
      skippedReasons: safety.skipped.map((item) => item.reason)
    })
  );

  const privateNetwork = await crawlSite(
    { startUrl: "http://127.0.0.1/", maxUrls: 1 },
    createMapFetcher({})
  );
  assert(
    privateNetwork.skipped.some((item) => item.reason === "private-network"),
    "Crawler must block private-network start URLs before fetching"
  );
  cases.push(
    caseResult("ssrf-private-network-protection", "PASS", {
      skipped: privateNetwork.skipped
    })
  );

  const failureFetcher = createMapFetcher({
    "https://example.com/robots.txt": response(
      "https://example.com/robots.txt",
      404,
      ""
    ),
    "https://example.com/redirect-loop": {
      ...html("loop"),
      redirectChain: [
        "https://example.com/a",
        "https://example.com/b",
        "https://example.com/a"
      ]
    },
    "https://example.com/large": html("x".repeat(20))
  });
  const redirectLoop = await crawlSite(
    { startUrl: "https://example.com/redirect-loop", maxRedirects: 2 },
    failureFetcher
  );
  const largeResponse = await crawlSite(
    { startUrl: "https://example.com/large", maxResponseBytes: 10 },
    failureFetcher
  );
  assert(
    redirectLoop.failed.some((item) => item.reason === "redirect-loop"),
    "Crawler must fail redirect loops"
  );
  assert(
    largeResponse.failed.some((item) => item.reason === "response-too-large"),
    "Crawler must fail oversized responses"
  );
  cases.push(
    caseResult("redirect-and-response-size-controls", "PASS", {
      redirectFailures: redirectLoop.failed,
      largeResponseFailures: largeResponse.failed
    })
  );

  const retryFetcher = createFlakyFetcher();
  const retry = await crawlSite(
    {
      startUrl: "https://example.com/",
      respectRobotsTxt: false,
      retryAttempts: 1
    },
    retryFetcher
  );
  const timeout = await crawlSite(
    {
      startUrl: "https://example.com/",
      respectRobotsTxt: false,
      requestTimeoutMs: 1
    },
    {
      async fetch() {
        return new Promise((resolve) =>
          setTimeout(() => resolve(html("late")), 20)
        );
      }
    }
  );
  const controller = new AbortController();
  controller.abort();
  const cancellation = await crawlSite(
    {
      startUrl: "https://example.com/",
      respectRobotsTxt: false,
      signal: controller.signal
    },
    createMapFetcher({ "https://example.com/": html("ok") })
  );
  assert(retry.pages.length === 1, "Crawler must retry transient failures");
  assert(
    retryFetcher.calls.filter((url) => url === "https://example.com/")
      .length === 2,
    "Retry evidence must show two attempts"
  );
  assert(
    timeout.failed.some((item) => item.reason === "timeout"),
    "Crawler must report timeout failures"
  );
  assert(
    cancellation.failed.some((item) => item.reason === "cancelled"),
    "Crawler must report cancellation failures"
  );
  cases.push(
    caseResult("retry-timeout-cancellation", "PASS", {
      retryCalls: retryFetcher.calls,
      timeoutFailures: timeout.failed,
      cancellationFailures: cancellation.failed
    })
  );

  const failedCases = cases.filter((item) => item.status !== "PASS");
  const summary = {
    status: failedCases.length === 0 ? "PASS" : "FAIL",
    generatedAt: fixedGeneratedAt,
    nodeVersion: process.version,
    caseCount: cases.length,
    passed: cases.length - failedCases.length,
    failed: failedCases.length
  };
  const report = {
    schemaVersion: 1,
    summary,
    cases,
    limitations: [
      "This is deterministic local crawler acceptance, not a live external-site load test.",
      "100,000 URL cloud crawl, distributed worker concurrency, authenticated crawl, and cookie/session handling remain release gates.",
      "Crawl-delay is parsed and exposed as policy evidence; this verifier does not sleep."
    ]
  };

  await mkdir(path.dirname(reportPath), { recursive: true });
  await mkdir(path.dirname(samplePath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(samplePath, `${JSON.stringify(report, null, 2)}\n`);

  if (summary.status !== "PASS") {
    process.exitCode = 1;
  }

  console.log(
    `Crawler acceptance ${summary.status}: ${summary.passed}/${summary.caseCount} cases passed`
  );
  console.log(`Report: ${path.relative(repoRoot, reportPath)}`);
  console.log(`Sample: ${path.relative(repoRoot, samplePath)}`);
}

function createSyntheticLinearFetcher(count) {
  return {
    async fetch(url) {
      if (url.endsWith("/robots.txt")) {
        return response(url, 404, "");
      }
      const match = url.match(/\/page-(\d+)$/u);
      if (!match) {
        throw new Error(`Unexpected synthetic URL ${url}`);
      }
      const index = Number(match[1]);
      const next =
        index + 1 < count ? `<a href="/page-${index + 1}">next</a>` : "";
      return html(next, url);
    }
  };
}

function createFlakyFetcher() {
  const calls = [];
  const attempts = new Map();
  return {
    calls,
    async fetch(url) {
      calls.push(url);
      const count = attempts.get(url) ?? 0;
      attempts.set(url, count + 1);
      if (count === 0) {
        throw new Error("transient failure");
      }
      return html("ok", url);
    }
  };
}

function createMapFetcher(responses) {
  return {
    async fetch(url) {
      const found = responses[url];
      if (!found) {
        throw new Error(`Unexpected fetch ${url}`);
      }
      return { ...found, url };
    }
  };
}

function html(body, url = "https://example.com/") {
  return response(url, 200, body, { "content-type": "text/html" });
}

function response(url, statusCode, body, headers = {}) {
  return {
    url,
    statusCode,
    headers,
    body
  };
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
