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
const reportPath = path.join(repoRoot, "reports/crawler-recovery-report.json");
const samplePath = path.join(
  repoRoot,
  "docs/examples/crawler-recovery-report.sample.json"
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
  const controller = new AbortController();
  const fetcher = createRecoverableFetcher(controller);

  const interrupted = await crawlSite(
    {
      startUrl: "https://example.com/",
      respectRobotsTxt: false,
      signal: controller.signal
    },
    fetcher
  );
  assert(
    interrupted.recovery?.interrupted === true,
    "Interrupted crawl must include a recovery checkpoint"
  );
  const checkpoint = interrupted.recovery.checkpoint;
  assert(
    checkpoint.pendingQueue.length === 2,
    "Checkpoint must preserve pending queue"
  );
  assert(
    checkpoint.fetchedUrls.includes("https://example.com/"),
    "Checkpoint must preserve fetched root URL"
  );

  const resumed = await crawlSite(
    {
      startUrl: "https://example.com/",
      respectRobotsTxt: false,
      resumeFrom: checkpoint
    },
    fetcher
  );
  const rootFetchCount = fetcher.calls.filter(
    (url) => url === "https://example.com/"
  ).length;

  const gates = {
    checkpointCreated: interrupted.recovery?.interrupted === true,
    checkpointSerializable:
      JSON.parse(JSON.stringify(checkpoint)).version === checkpoint.version,
    pendingQueuePreserved: checkpoint.pendingQueue.length === 2,
    resumeCompleted: resumed.recovery?.interrupted === false,
    resumedFromCheckpoint: resumed.recovery?.resumed === true,
    completedPagesAggregated: resumed.pages.length === 3,
    completedPageNotRefetched: rootFetchCount === 1
  };
  const status = Object.values(gates).every(Boolean) ? "passed" : "failed";
  const report = {
    schemaVersion: 1,
    generatedBy: "searchlint-crawler-recovery-verifier",
    generatedAt,
    status,
    methodology: {
      liveNetworkAccess: "not used by verifier",
      scope:
        "local @searchlint/crawler checkpoint/resume recovery for interrupted crawls",
      cliFileCheckpointUx: "not implemented in this plan"
    },
    interrupted: {
      pages: interrupted.pages.map((page) => page.url),
      failedReasons: (interrupted.failed ?? []).map((item) => item.reason),
      checkpoint: {
        version: checkpoint.version,
        startUrl: checkpoint.startUrl,
        pendingQueue: checkpoint.pendingQueue,
        queuedUrls: checkpoint.queuedUrls,
        fetchedUrls: checkpoint.fetchedUrls,
        pageCount: checkpoint.pages.length,
        skippedCount: checkpoint.skipped.length,
        failedCount: checkpoint.failed.length
      }
    },
    resumed: {
      pages: resumed.pages.map((page) => page.url),
      failedReasons: (resumed.failed ?? []).map((item) => item.reason),
      rootFetchCount
    },
    gates
  };

  await mkdir(path.dirname(reportPath), { recursive: true });
  await mkdir(path.dirname(samplePath), { recursive: true });
  await writeJson(reportPath, report);
  await writeJson(samplePath, report);

  assert(status === "passed", "crawler recovery verification failed");

  console.log(
    `Crawler recovery PASS: checkpoint pending=${checkpoint.pendingQueue.length}, resumed pages=${resumed.pages.length}, root fetches=${rootFetchCount}`
  );
  console.log(`Report: ${path.relative(repoRoot, reportPath)}`);
  console.log(`Sample: ${path.relative(repoRoot, samplePath)}`);
}

function createRecoverableFetcher(controller) {
  const responses = {
    "https://example.com/": html(`<a href="/a">A</a><a href="/b">B</a>`),
    "https://example.com/a": html("A"),
    "https://example.com/b": html("B")
  };
  const calls = [];
  return {
    calls,
    async fetch(url) {
      calls.push(url);
      const found = responses[url];
      if (!found) {
        throw new Error(`Unexpected fetch ${url}`);
      }
      if (url === "https://example.com/") {
        controller.abort();
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
