#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { format } from "prettier";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const generatedAt = "2026-06-22T00:00:00.000Z";
const reportPath = path.join(
  repoRoot,
  "reports/worker-concurrency-report.json"
);
const samplePath = path.join(
  repoRoot,
  "docs/examples/worker-concurrency-report.sample.json"
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

  const { consumeSqsCrawlBatch } =
    await import("../services/workers/dist/src/index.js");

  let inFlight = 0;
  let maxInFlight = 0;
  const commands = [];
  const deleteReceiptHandles = [];
  const events = [];
  const client = {
    async send(command) {
      commands.push(command.constructor.name);
      if (command.constructor.name === "ReceiveMessageCommand") {
        return {
          Messages: [
            sqsMessage("crawl-1", "receipt-1"),
            sqsMessage("crawl-2", "receipt-2"),
            sqsMessage("crawl-3", "receipt-3")
          ],
          $metadata: {}
        };
      }
      if (command.constructor.name === "DeleteMessageCommand") {
        deleteReceiptHandles.push(command.input.ReceiptHandle);
        return { $metadata: {} };
      }
      throw new Error("Unexpected SQS command.");
    }
  };

  const result = await consumeSqsCrawlBatch({
    client,
    queueUrl: "https://sqs.us-east-1.amazonaws.com/123/searchlint-crawl",
    maxMessages: 3,
    concurrency: 2,
    targetResolver: {
      async resolveCrawlTarget(payload) {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        events.push(`resolve:${payload.crawlRequestId}:inFlight=${inFlight}`);
        await Promise.resolve();
        inFlight -= 1;
        return {
          startUrl: "https://example.com/",
          sameOrigin: true,
          respectRobotsTxt: false
        };
      }
    },
    fetcher: {
      async fetch(url) {
        return {
          url,
          statusCode: 200,
          headers: { "content-type": "text/html" },
          body: "<html></html>"
        };
      }
    },
    store: {
      async markRunning(input) {
        events.push(`running:${input.payload.crawlRequestId}`);
      },
      async markSucceeded(input) {
        events.push(`succeeded:${input.payload.crawlRequestId}`);
      },
      async markFailed(input) {
        events.push(`failed:${input.payload.crawlRequestId}`);
      }
    },
    artifactStore: {
      async putCrawlResult(input) {
        return {
          artifactUri: `s3://searchlint-artifacts/crawls/${input.payload.crawlRequestId}/result.json`
        };
      }
    },
    clock: {
      now() {
        return generatedAt;
      }
    }
  });

  assert(result.received === 3, "Verifier must receive 3 messages");
  assert(result.handled === 3, "Verifier must handle 3 valid messages");
  assert(result.succeeded === 3, "Verifier must succeed all messages");
  assert(result.deleted === 3, "Verifier must delete successful messages");
  assert(maxInFlight === 2, "Verifier must observe bounded concurrency of 2");
  assert(
    deleteReceiptHandles.length === 3,
    "Verifier must delete every successful message"
  );

  const report = {
    schemaVersion: 1,
    generatedBy: "searchlint-worker-concurrency-verifier",
    generatedAt,
    status: "passed",
    methodology: {
      liveAwsAccess: "not used by verifier",
      scope:
        "local SQS crawler batch consumer bounded concurrency and delete-on-success behavior",
      configuredConcurrency: 2,
      messageCount: 3
    },
    summary: {
      received: result.received,
      handled: result.handled,
      succeeded: result.succeeded,
      failed: result.failed,
      deleted: result.deleted,
      maxObservedInFlight: maxInFlight
    },
    evidence: {
      commands,
      deleteReceiptHandles,
      events
    }
  };

  await mkdir(path.dirname(reportPath), { recursive: true });
  await mkdir(path.dirname(samplePath), { recursive: true });
  await writeJson(reportPath, report);
  await writeJson(samplePath, report);

  console.log(
    `Worker concurrency PASS: received=${result.received}, deleted=${result.deleted}, maxInFlight=${maxInFlight}`
  );
  console.log(`Report: ${path.relative(repoRoot, reportPath)}`);
  console.log(`Sample: ${path.relative(repoRoot, samplePath)}`);
}

function sqsMessage(crawlRequestId, receiptHandle) {
  return {
    MessageId: `message-${crawlRequestId}`,
    ReceiptHandle: receiptHandle,
    Body: JSON.stringify({
      schemaVersion: 1,
      type: "crawl.requested",
      payload: {
        crawlRequestId,
        organizationId: "org-1",
        projectId: "project-1",
        environmentId: "env-1",
        maxUrls: 1
      }
    })
  };
}

async function writeJson(filePath, data) {
  await writeFile(
    filePath,
    await format(JSON.stringify(data), { parser: "json" })
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
