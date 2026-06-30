#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const generatedAt = "2026-06-22T00:00:00.000Z";
const reportPath = path.join(
  repoRoot,
  "reports/crawler-dedupe-rate-report.json"
);
const samplePath = path.join(
  repoRoot,
  "docs/examples/crawler-dedupe-rate-report.sample.json"
);

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

async function main() {
  run("pnpm", ["build"], { stdio: "inherit" });

  const { crawlSite } = await import("../packages/crawler/dist/src/index.js");
  const cases = [];

  let currentTime = 1_000;
  const sleepDurations = [];
  const fetchTimes = [];
  const rateFetcher = createMapFetcher({
    "https://example.com/": html('<a href="/a">A</a><a href="/b">B</a>'),
    "https://example.com/a": html("A"),
    "https://example.com/b": html("B")
  });
  const originalFetch = rateFetcher.fetch.bind(rateFetcher);
  rateFetcher.fetch = async (url, options) => {
    fetchTimes.push({ url, atMs: currentTime });
    return originalFetch(url, options);
  };

  const paced = await crawlSite(
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
    rateFetcher
  );
  assert(paced.pages.length === 3, "Rate-limit fixture must crawl 3 pages");
  assert(
    JSON.stringify(sleepDurations) === JSON.stringify([50, 50]),
    "Rate limiter must sleep between same-origin requests"
  );
  assert(
    fetchTimes.map((entry) => entry.atMs).join(",") === "1000,1050,1100",
    "Fetch timestamps must reflect deterministic pacing"
  );
  cases.push({
    id: "per-origin-request-pacing",
    status: "PASS",
    evidence: {
      minIntervalMs: 50,
      fetchTimes,
      sleepDurations,
      wallClockSleep: "not used by verifier"
    }
  });

  const dedupeFetcher = createMapFetcher({
    "https://example.com/": html(
      '<a href="/copy-a">A</a><a href="/copy-b">B</a><a href="/unique">Unique</a>'
    ),
    "https://example.com/copy-a": html("<main>Same content</main>"),
    "https://example.com/copy-b": html("<main>Same   content</main>"),
    "https://example.com/unique": html("<main>Different content</main>")
  });
  const dedupe = await crawlSite(
    {
      startUrl: "https://example.com/",
      respectRobotsTxt: false,
      maxUrls: 4
    },
    dedupeFetcher
  );
  const groups = dedupe.duplicateContentGroups ?? [];
  assert(groups.length === 1, "Duplicate-content fixture must produce 1 group");
  const group = groups[0];
  assert(
    group.representativeUrl === "https://example.com/copy-a",
    "Duplicate group must keep first-seen representative"
  );
  assert(
    group.duplicateUrls.includes("https://example.com/copy-b"),
    "Duplicate group must include duplicate URL"
  );
  assert(group.pageCount === 2, "Duplicate group must include two pages");
  cases.push({
    id: "duplicate-content-grouping",
    status: "PASS",
    evidence: {
      groupCount: groups.length,
      groups
    }
  });

  const failed = cases.filter((item) => item.status !== "PASS");
  const report = {
    schemaVersion: 1,
    generatedBy: "searchlint-crawler-dedupe-rate-verifier",
    generatedAt,
    status: failed.length === 0 ? "passed" : "failed",
    methodology: {
      liveNetworkAccess: "not used by verifier",
      scope:
        "local @searchlint/crawler per-origin request pacing and duplicate-content grouping",
      duplicateContent:
        "response bodies are normalized by whitespace and grouped by SHA-256 hash"
    },
    summary: {
      caseCount: cases.length,
      passed: cases.length - failed.length,
      failed: failed.length
    },
    cases
  };

  await mkdir(path.dirname(reportPath), { recursive: true });
  await mkdir(path.dirname(samplePath), { recursive: true });
  await writeJson(reportPath, report);
  await writeJson(samplePath, report);

  assert(report.status === "passed", "crawler dedupe/rate verification failed");

  console.log(
    `Crawler dedupe/rate PASS: cases=${cases.length}, paced=${sleepDurations.join(",")}, duplicateGroups=${groups.length}`
  );
  console.log(`Report: ${path.relative(repoRoot, reportPath)}`);
  console.log(`Sample: ${path.relative(repoRoot, samplePath)}`);
}

function createMapFetcher(responses) {
  const calls = [];
  return {
    calls,
    async fetch(url, options) {
      calls.push({ url, options });
      const found = responses[url];
      if (!found) {
        throw new Error(`Unexpected fetch ${url}`);
      }
      return { ...found, url };
    }
  };
}

function html(body) {
  return {
    url: "https://example.com/",
    statusCode: 200,
    headers: { "content-type": "text/html" },
    body
  };
}

async function writeJson(filePath, data) {
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
