import { describe, expect, it } from "vitest";

import { executeCrawlRequestedJob } from "../src/index.js";
import type {
  CloudCrawlJobStore,
  CloudCrawlTarget,
  CloudCrawlTargetResolver,
  CloudCrawlArtifactStore,
  CloudCrawlDiagnosticAnalyzer,
  CloudCrawlDiagnosticIngestionStore,
  CloudCrawlerExecutionClock,
  ExecuteCrawlRequestedJobInput
} from "../src/index.js";
import type { CrawlJobPayload } from "@searchlint/api";
import type {
  CrawlOptions,
  CrawlResponse,
  CrawlResult,
  CrawlerFetcher
} from "@searchlint/crawler";

describe("executeCrawlRequestedJob", () => {
  it("resolves target, marks running, crawls, and marks success", async () => {
    const harness = createHarness({
      target: {
        startUrl: "https://example.com/",
        sameOrigin: true,
        respectRobotsTxt: false,
        userAgent: "SearchLintCloud"
      },
      crawlResult: crawlResult()
    });

    const summary = await executeCrawlRequestedJob(harness.input);

    expect(summary).toEqual({
      crawlRequestId: "crawl-1",
      status: "succeeded",
      startedAt: "2026-06-21T00:00:00.000Z",
      completedAt: "2026-06-21T00:00:01.000Z",
      pageCount: 1,
      skippedCount: 1
    });
    expect(harness.events).toEqual([
      "resolver:crawl-1",
      "store:running:crawl-1:2026-06-21T00:00:00.000Z",
      "crawler:https://example.com/:5:false",
      "store:succeeded:crawl-1:2026-06-21T00:00:01.000Z:none"
    ]);
    expect(harness.crawlOptions).toEqual([
      {
        startUrl: "https://example.com/",
        maxUrls: 5,
        sameOrigin: true,
        respectRobotsTxt: false,
        userAgent: "SearchLintCloud"
      }
    ]);
    expect(harness.succeededResults[0]?.result).toEqual(crawlResult());
  });

  it("stores successful crawl artifacts before marking success", async () => {
    const harness = createHarness({
      target: {
        startUrl: "https://example.com/"
      },
      crawlResult: crawlResult(),
      artifactUri: "s3://searchlint-artifacts/crawls/crawl-1/result.json"
    });

    const summary = await executeCrawlRequestedJob(harness.input);

    expect(summary).toEqual({
      crawlRequestId: "crawl-1",
      status: "succeeded",
      startedAt: "2026-06-21T00:00:00.000Z",
      completedAt: "2026-06-21T00:00:01.000Z",
      artifactUri: "s3://searchlint-artifacts/crawls/crawl-1/result.json",
      pageCount: 1,
      skippedCount: 1
    });
    expect(harness.events).toEqual([
      "resolver:crawl-1",
      "store:running:crawl-1:2026-06-21T00:00:00.000Z",
      "crawler:https://example.com/:5:default",
      "artifact:crawl-1:2026-06-21T00:00:01.000Z",
      "store:succeeded:crawl-1:2026-06-21T00:00:01.000Z:s3://searchlint-artifacts/crawls/crawl-1/result.json"
    ]);
    expect(harness.artifacts).toEqual([
      {
        schemaVersion: 1,
        type: "crawl.result",
        payload: crawlPayload(),
        target: {
          startUrl: "https://example.com/"
        },
        result: crawlResult(),
        completedAt: "2026-06-21T00:00:01.000Z"
      }
    ]);
  });

  it("records diagnostics after storing artifacts and before marking success", async () => {
    const harness = createHarness({
      target: {
        startUrl: "https://example.com/"
      },
      crawlResult: crawlResult(),
      artifactUri: "s3://searchlint-artifacts/crawls/crawl-1/result.json",
      diagnostics: [diagnosticInput()]
    });

    const summary = await executeCrawlRequestedJob(harness.input);

    expect(summary).toMatchObject({
      crawlRequestId: "crawl-1",
      status: "succeeded",
      artifactUri: "s3://searchlint-artifacts/crawls/crawl-1/result.json"
    });
    expect(harness.events).toEqual([
      "resolver:crawl-1",
      "store:running:crawl-1:2026-06-21T00:00:00.000Z",
      "crawler:https://example.com/:5:default",
      "artifact:crawl-1:2026-06-21T00:00:01.000Z",
      "diagnostic-analyzer:crawl-1:2026-06-21T00:00:01.000Z",
      "diagnostic-store:crawl-1:1",
      "store:succeeded:crawl-1:2026-06-21T00:00:01.000Z:s3://searchlint-artifacts/crawls/crawl-1/result.json"
    ]);
    expect(harness.diagnosticBatches).toEqual([
      {
        payload: crawlPayload(),
        diagnostics: [diagnosticInput()]
      }
    ]);
  });

  it("marks diagnostic ingestion failures failed after running starts", async () => {
    const harness = createHarness({
      target: {
        startUrl: "https://example.com/"
      },
      crawlResult: crawlResult(),
      diagnostics: [diagnosticInput()],
      diagnosticError: new Error("diagnostic database unavailable")
    });

    const summary = await executeCrawlRequestedJob(harness.input);

    expect(summary).toEqual({
      crawlRequestId: "crawl-1",
      status: "failed",
      startedAt: "2026-06-21T00:00:00.000Z",
      failedAt: "2026-06-21T00:00:02.000Z",
      pageCount: 0,
      skippedCount: 0,
      errorMessage: "diagnostic database unavailable"
    });
    expect(harness.events).toEqual([
      "resolver:crawl-1",
      "store:running:crawl-1:2026-06-21T00:00:00.000Z",
      "crawler:https://example.com/:5:default",
      "diagnostic-analyzer:crawl-1:2026-06-21T00:00:01.000Z",
      "diagnostic-store:crawl-1:1",
      "store:failed:crawl-1:2026-06-21T00:00:02.000Z:diagnostic database unavailable"
    ]);
    expect(harness.succeededResults).toEqual([]);
  });

  it("marks missing targets failed without starting the crawler", async () => {
    const harness = createHarness({
      target: undefined
    });

    const summary = await executeCrawlRequestedJob(harness.input);

    expect(summary).toEqual({
      crawlRequestId: "crawl-1",
      status: "target-missing",
      failedAt: "2026-06-21T00:00:00.000Z",
      pageCount: 0,
      skippedCount: 0,
      errorMessage: "Crawl target not found for request crawl-1."
    });
    expect(harness.events).toEqual([
      "resolver:crawl-1",
      "store:failed:crawl-1:2026-06-21T00:00:00.000Z:Crawl target not found for request crawl-1."
    ]);
    expect(harness.crawlOptions).toEqual([]);
  });

  it("rejects invalid maxUrls before resolving or crawling", async () => {
    const harness = createHarness({
      payload: {
        ...crawlPayload(),
        maxUrls: 0
      },
      target: {
        startUrl: "https://example.com/"
      }
    });

    const summary = await executeCrawlRequestedJob(harness.input);

    expect(summary).toEqual({
      crawlRequestId: "crawl-1",
      status: "failed",
      failedAt: "2026-06-21T00:00:00.000Z",
      pageCount: 0,
      skippedCount: 0,
      errorMessage: "Crawl job maxUrls must be a positive integer."
    });
    expect(harness.events).toEqual([
      "store:failed:crawl-1:2026-06-21T00:00:00.000Z:Crawl job maxUrls must be a positive integer."
    ]);
    expect(harness.crawlOptions).toEqual([]);
  });

  it("marks crawler failures failed after running starts", async () => {
    const harness = createHarness({
      target: {
        startUrl: "https://example.com/"
      },
      crawlError: new Error("network unavailable")
    });

    const summary = await executeCrawlRequestedJob(harness.input);

    expect(summary).toEqual({
      crawlRequestId: "crawl-1",
      status: "failed",
      startedAt: "2026-06-21T00:00:00.000Z",
      failedAt: "2026-06-21T00:00:01.000Z",
      pageCount: 0,
      skippedCount: 0,
      errorMessage: "network unavailable"
    });
    expect(harness.events).toEqual([
      "resolver:crawl-1",
      "store:running:crawl-1:2026-06-21T00:00:00.000Z",
      "crawler:https://example.com/:5:default",
      "store:failed:crawl-1:2026-06-21T00:00:01.000Z:network unavailable"
    ]);
  });

  it("marks artifact store failures failed after running starts", async () => {
    const harness = createHarness({
      target: {
        startUrl: "https://example.com/"
      },
      crawlResult: crawlResult(),
      artifactError: new Error("S3 unavailable")
    });

    const summary = await executeCrawlRequestedJob(harness.input);

    expect(summary).toEqual({
      crawlRequestId: "crawl-1",
      status: "failed",
      startedAt: "2026-06-21T00:00:00.000Z",
      failedAt: "2026-06-21T00:00:02.000Z",
      pageCount: 0,
      skippedCount: 0,
      errorMessage: "S3 unavailable"
    });
    expect(harness.events).toEqual([
      "resolver:crawl-1",
      "store:running:crawl-1:2026-06-21T00:00:00.000Z",
      "crawler:https://example.com/:5:default",
      "artifact:crawl-1:2026-06-21T00:00:01.000Z",
      "store:failed:crawl-1:2026-06-21T00:00:02.000Z:S3 unavailable"
    ]);
  });
});

function createHarness(options: {
  payload?: CrawlJobPayload;
  target: CloudCrawlTarget | undefined;
  crawlResult?: CrawlResult;
  crawlError?: Error;
  artifactUri?: string;
  artifactError?: Error;
  diagnostics?: readonly ReturnType<typeof diagnosticInput>[];
  diagnosticError?: Error;
}) {
  const payload = options.payload ?? crawlPayload();
  const events: string[] = [];
  const crawlOptions: CrawlOptions[] = [];
  const artifacts: Array<
    Parameters<CloudCrawlArtifactStore["putCrawlResult"]>[0]
  > = [];
  const succeededResults: Array<{
    payload: CrawlJobPayload;
    target: CloudCrawlTarget;
    result: CrawlResult;
    completedAt: string;
    artifactUri?: string;
  }> = [];
  const diagnosticBatches: Array<
    Parameters<CloudCrawlDiagnosticIngestionStore["recordCrawlDiagnostics"]>[0]
  > = [];
  const clock = fixedClock([
    "2026-06-21T00:00:00.000Z",
    "2026-06-21T00:00:01.000Z",
    "2026-06-21T00:00:02.000Z"
  ]);
  const targetResolver: CloudCrawlTargetResolver = {
    async resolveCrawlTarget(input) {
      events.push(`resolver:${input.crawlRequestId}`);
      return options.target;
    }
  };
  const store: CloudCrawlJobStore = {
    async markRunning(input) {
      events.push(
        `store:running:${input.payload.crawlRequestId}:${input.startedAt}`
      );
    },
    async markSucceeded(input) {
      events.push(
        `store:succeeded:${input.payload.crawlRequestId}:${input.completedAt}:${input.artifactUri ?? "none"}`
      );
      succeededResults.push(input);
    },
    async markFailed(input) {
      events.push(
        `store:failed:${input.payload.crawlRequestId}:${input.failedAt}:${input.errorMessage}`
      );
    }
  };
  const artifactStore: CloudCrawlArtifactStore | undefined =
    options.artifactUri !== undefined || options.artifactError !== undefined
      ? {
          async putCrawlResult(artifact) {
            events.push(
              `artifact:${artifact.payload.crawlRequestId}:${artifact.completedAt}`
            );
            artifacts.push(artifact);
            if (options.artifactError) {
              throw options.artifactError;
            }
            return {
              artifactUri: options.artifactUri ?? "s3://bucket/result.json"
            };
          }
        }
      : undefined;
  const diagnosticAnalyzer: CloudCrawlDiagnosticAnalyzer | undefined =
    options.diagnostics !== undefined || options.diagnosticError !== undefined
      ? {
          async analyzeCrawlDiagnostics(analysisInput) {
            events.push(
              `diagnostic-analyzer:${analysisInput.payload.crawlRequestId}:${analysisInput.observedAt}`
            );
            return options.diagnostics ?? [];
          }
        }
      : undefined;
  const diagnosticStore: CloudCrawlDiagnosticIngestionStore | undefined =
    options.diagnostics !== undefined || options.diagnosticError !== undefined
      ? {
          async recordCrawlDiagnostics(batch) {
            events.push(
              `diagnostic-store:${batch.payload.crawlRequestId}:${batch.diagnostics.length}`
            );
            diagnosticBatches.push(batch);
            if (options.diagnosticError) {
              throw options.diagnosticError;
            }
          }
        }
      : undefined;
  const fetcher: CrawlerFetcher = {
    async fetch(url: string): Promise<CrawlResponse> {
      return {
        url,
        statusCode: 200,
        headers: {},
        body: ""
      };
    }
  };
  const input: ExecuteCrawlRequestedJobInput = {
    payload,
    targetResolver,
    fetcher,
    store,
    ...(artifactStore === undefined ? {} : { artifactStore }),
    ...(diagnosticAnalyzer === undefined ? {} : { diagnosticAnalyzer }),
    ...(diagnosticStore === undefined ? {} : { diagnosticStore }),
    clock,
    async crawler(crawlInput) {
      crawlOptions.push(crawlInput);
      events.push(
        `crawler:${crawlInput.startUrl}:${crawlInput.maxUrls}:${
          crawlInput.respectRobotsTxt ?? "default"
        }`
      );
      if (options.crawlError) {
        throw options.crawlError;
      }
      return options.crawlResult ?? crawlResult();
    }
  };

  return {
    input,
    events,
    crawlOptions,
    artifacts,
    succeededResults,
    diagnosticBatches
  };
}

function diagnosticInput() {
  return {
    ruleId: "SL-META-001",
    severity: "error",
    confidence: "certain",
    pageUrl: "https://example.com/",
    source: "crawler",
    title: "Missing title",
    evidence: "The rendered page does not contain a title element.",
    observedAt: "2026-06-21T00:00:01.000Z",
    fingerprint: "diagnostic:fingerprint"
  } as const;
}

function crawlPayload(): CrawlJobPayload {
  return {
    crawlRequestId: "crawl-1",
    organizationId: "org-1",
    projectId: "project-1",
    environmentId: "env-1",
    maxUrls: 5
  };
}

function crawlResult(): CrawlResult {
  return {
    startUrl: "https://example.com/",
    pages: [
      {
        url: "https://example.com/",
        statusCode: 200,
        headers: {
          "content-type": "text/html"
        },
        body: "<html></html>",
        contentType: "text/html",
        discoveredLinks: []
      }
    ],
    skipped: [
      {
        url: "https://example.com/private",
        reason: "robots"
      }
    ]
  };
}

function fixedClock(values: readonly string[]): CloudCrawlerExecutionClock {
  let index = 0;
  return {
    now() {
      const value = values[index] ?? values.at(-1);
      index += 1;
      if (value === undefined) {
        throw new Error("Fixed clock requires at least one value.");
      }
      return value;
    }
  };
}
