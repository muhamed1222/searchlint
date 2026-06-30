import { ReceiveMessageCommand } from "@aws-sdk/client-sqs";
import type { ReceiveMessageCommandOutput } from "@aws-sdk/client-sqs";
import { describe, expect, it } from "vitest";

import { createSqsCrawlerPollingRuntime } from "../src/index.js";
import type {
  CloudCrawlJobStore,
  CloudCrawlTargetResolver,
  CloudCrawlerExecutionClock,
  SqsCrawlBatchResult,
  SqsCrawlerClient,
  SqsCrawlerConsumerOptions,
  SqsCrawlerPollingRuntimeSleep
} from "../src/index.js";
import type { CrawlResponse, CrawlerFetcher } from "@searchlint/crawler";

describe("createSqsCrawlerPollingRuntime", () => {
  it("runs crawler batches sequentially until stopped", async () => {
    const harness = createRuntimeHarness();
    const batches: SqsCrawlBatchResult[] = [];
    const sleepIntervals: number[] = [];
    const sleep: SqsCrawlerPollingRuntimeSleep = async (intervalMs) => {
      sleepIntervals.push(intervalMs);
    };
    const runtime = createSqsCrawlerPollingRuntime({
      ...harness.input,
      intervalMs: 50,
      sleep,
      onBatch(result) {
        batches.push(result);
        if (batches.length === 2) {
          void runtime.stop();
        }
      }
    });

    runtime.start();
    await runtime.done();

    expect(runtime.isRunning()).toBe(false);
    expect(harness.receiveCount()).toBe(2);
    expect(sleepIntervals).toEqual([50]);
    expect(batches).toEqual([emptyBatchResult(), emptyBatchResult()]);
  });

  it("rejects invalid intervals before starting", () => {
    const harness = createRuntimeHarness();

    expect(() =>
      createSqsCrawlerPollingRuntime({
        ...harness.input,
        intervalMs: 0
      })
    ).toThrow("SQS crawler polling interval must be a positive integer.");
  });

  it("rejects a second start while running", async () => {
    const harness = createRuntimeHarness();
    const runtime = createSqsCrawlerPollingRuntime({
      ...harness.input,
      intervalMs: 50,
      sleep: createAbortableSleep()
    });

    runtime.start();
    expect(() => runtime.start()).toThrow(
      "SQS crawler polling runtime is already running."
    );
    await runtime.stop();
  });

  it("does not overlap receives while a batch is in flight", async () => {
    const deferred = createDeferred<ReceiveMessageCommandOutput>();
    const harness = createRuntimeHarness({
      receive() {
        return deferred.promise;
      }
    });
    const runtime = createSqsCrawlerPollingRuntime({
      ...harness.input,
      intervalMs: 50,
      sleep: createAbortableSleep(),
      onBatch() {
        void runtime.stop();
      }
    });

    runtime.start();
    await harness.waitForReceive();

    expect(harness.receiveCount()).toBe(1);
    deferred.resolve({
      Messages: [],
      $metadata: {}
    });
    await runtime.done();
    expect(harness.receiveCount()).toBe(1);
  });

  it("stops cleanly while sleeping between polls", async () => {
    const harness = createRuntimeHarness();
    const sleepStarted = createDeferred<void>();
    const runtime = createSqsCrawlerPollingRuntime({
      ...harness.input,
      intervalMs: 50,
      sleep(intervalMs, signal) {
        expect(intervalMs).toBe(50);
        sleepStarted.resolve();
        return new Promise((resolve) => {
          signal.addEventListener("abort", () => resolve(), {
            once: true
          });
        });
      }
    });

    runtime.start();
    await sleepStarted.promise;
    await runtime.stop();

    expect(runtime.isRunning()).toBe(false);
    expect(harness.receiveCount()).toBe(1);
  });

  it("waits for the current batch before stop completes", async () => {
    const deferred = createDeferred<ReceiveMessageCommandOutput>();
    const harness = createRuntimeHarness({
      receive() {
        return deferred.promise;
      }
    });
    const runtime = createSqsCrawlerPollingRuntime({
      ...harness.input,
      intervalMs: 50,
      sleep: createAbortableSleep()
    });
    let stopped = false;

    runtime.start();
    await harness.waitForReceive();
    const stopPromise = runtime.stop().then(() => {
      stopped = true;
    });

    await Promise.resolve();
    expect(stopped).toBe(false);
    deferred.resolve({
      Messages: [],
      $metadata: {}
    });
    await stopPromise;
    expect(stopped).toBe(true);
  });

  it("reports receive errors and continues polling by default", async () => {
    let attempts = 0;
    const harness = createRuntimeHarness({
      receive() {
        attempts += 1;
        if (attempts === 1) {
          throw new Error("SQS receive failed");
        }
        return Promise.resolve({
          Messages: [],
          $metadata: {}
        });
      }
    });
    const errors: string[] = [];
    const batches: SqsCrawlBatchResult[] = [];
    const runtime = createSqsCrawlerPollingRuntime({
      ...harness.input,
      intervalMs: 50,
      sleep: async () => undefined,
      onError(error) {
        errors.push(error.message);
      },
      onBatch(result) {
        batches.push(result);
        void runtime.stop();
      }
    });

    runtime.start();
    await runtime.done();

    expect(errors).toEqual(["SQS receive failed"]);
    expect(batches).toEqual([emptyBatchResult()]);
    expect(harness.receiveCount()).toBe(2);
  });

  it("stops and rejects done when stopOnError is enabled", async () => {
    const harness = createRuntimeHarness({
      receive() {
        throw new Error("SQS receive failed");
      }
    });
    const errors: string[] = [];
    const runtime = createSqsCrawlerPollingRuntime({
      ...harness.input,
      intervalMs: 50,
      sleep: createAbortableSleep(),
      stopOnError: true,
      onError(error) {
        errors.push(error.message);
      }
    });

    runtime.start();
    await expect(runtime.done()).rejects.toThrow("SQS receive failed");
    expect(errors).toEqual(["SQS receive failed"]);
    expect(runtime.isRunning()).toBe(false);
  });
});

function createRuntimeHarness(
  options: {
    receive?: () => Promise<ReceiveMessageCommandOutput>;
  } = {}
) {
  let received = 0;
  const receiveWaiters: Array<() => void> = [];
  const client: SqsCrawlerClient = {
    async send(command) {
      if (!(command instanceof ReceiveMessageCommand)) {
        throw new Error("Unexpected SQS command.");
      }
      received += 1;
      for (const resolve of receiveWaiters.splice(0)) {
        resolve();
      }
      return (
        (await options.receive?.()) ?? {
          Messages: [],
          $metadata: {}
        }
      );
    }
  };
  const targetResolver: CloudCrawlTargetResolver = {
    async resolveCrawlTarget() {
      return undefined;
    }
  };
  const fetcher: CrawlerFetcher = {
    async fetch(url): Promise<CrawlResponse> {
      return {
        url,
        statusCode: 200,
        headers: {},
        body: ""
      };
    }
  };
  const store: CloudCrawlJobStore = {
    async markRunning() {
      return undefined;
    },
    async markSucceeded() {
      return undefined;
    },
    async markFailed() {
      return undefined;
    }
  };
  const clock: CloudCrawlerExecutionClock = {
    now() {
      return "2026-06-21T00:00:00.000Z";
    }
  };
  const input: SqsCrawlerConsumerOptions = {
    client,
    queueUrl: "https://sqs.us-east-1.amazonaws.com/123/searchlint-crawl",
    maxMessages: 5,
    targetResolver,
    fetcher,
    store,
    clock
  };

  return {
    input,
    receiveCount() {
      return received;
    },
    waitForReceive() {
      if (received > 0) {
        return Promise.resolve();
      }
      return new Promise<void>((resolve) => {
        receiveWaiters.push(resolve);
      });
    }
  };
}

function emptyBatchResult(): SqsCrawlBatchResult {
  return {
    received: 0,
    handled: 0,
    succeeded: 0,
    failed: 0,
    invalid: 0,
    deleted: 0,
    skipped: 0,
    canceled: 0,
    backoffApplied: 0
  };
}

function createAbortableSleep(): SqsCrawlerPollingRuntimeSleep {
  return (_intervalMs, signal) =>
    new Promise((resolve) => {
      signal.addEventListener("abort", () => resolve(), {
        once: true
      });
    });
}

function createDeferred<T>() {
  let resolve: (value: T | PromiseLike<T>) => void = () => undefined;
  let reject: (reason?: unknown) => void = () => undefined;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return {
    promise,
    resolve,
    reject
  };
}
