import { describe, expect, it } from "vitest";

import { createOutboxPollingRuntime } from "../src/index.js";
import type {
  DispatchOutboxBatchInput,
  DispatchOutboxBatchResult,
  OutboxDispatchStore,
  OutboxPollingRuntimeSleep,
  OutboxPublisher,
  OutboxRetryPolicy
} from "../src/index.js";
import type { CloudOutboxEvent } from "@searchlint/api";

const createdAt = "2026-06-21T00:00:00.000Z";
const retryAt = "2026-06-21T00:01:00.000Z";

describe("createOutboxPollingRuntime", () => {
  it("runs dispatch batches sequentially until stopped", async () => {
    const harness = createRuntimeHarness();
    const batches: DispatchOutboxBatchResult[] = [];
    const sleepIntervals: number[] = [];
    const sleep: OutboxPollingRuntimeSleep = async (intervalMs) => {
      sleepIntervals.push(intervalMs);
    };
    const runtime = createOutboxPollingRuntime({
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
    expect(harness.selectCount()).toBe(2);
    expect(sleepIntervals).toEqual([50]);
    expect(batches).toEqual([emptyBatchResult(), emptyBatchResult()]);
  });

  it("rejects invalid intervals before starting", () => {
    const harness = createRuntimeHarness();

    expect(() =>
      createOutboxPollingRuntime({
        ...harness.input,
        intervalMs: 0
      })
    ).toThrow("Outbox polling interval must be a positive integer.");
  });

  it("rejects a second start while the runtime is running", async () => {
    const harness = createRuntimeHarness();
    const runtime = createOutboxPollingRuntime({
      ...harness.input,
      intervalMs: 50,
      sleep: createAbortableSleep()
    });

    runtime.start();
    expect(() => runtime.start()).toThrow(
      "Outbox polling runtime is already running."
    );
    await runtime.stop();
  });

  it("does not overlap dispatches while a batch is in flight", async () => {
    const deferred = createDeferred<readonly CloudOutboxEvent[]>();
    const harness = createRuntimeHarness({
      selectPending() {
        return deferred.promise;
      }
    });
    const runtime = createOutboxPollingRuntime({
      ...harness.input,
      intervalMs: 50,
      sleep: createAbortableSleep(),
      onBatch() {
        void runtime.stop();
      }
    });

    runtime.start();
    await harness.waitForSelect();

    expect(harness.selectCount()).toBe(1);
    deferred.resolve([]);
    await runtime.done();
    expect(harness.selectCount()).toBe(1);
  });

  it("stops cleanly while sleeping between polls", async () => {
    const harness = createRuntimeHarness();
    const sleepStarted = createDeferred<void>();
    const runtime = createOutboxPollingRuntime({
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
    expect(harness.selectCount()).toBe(1);
  });

  it("waits for the current dispatch before stop completes", async () => {
    const deferred = createDeferred<readonly CloudOutboxEvent[]>();
    const harness = createRuntimeHarness({
      selectPending() {
        return deferred.promise;
      }
    });
    const runtime = createOutboxPollingRuntime({
      ...harness.input,
      intervalMs: 50,
      sleep: createAbortableSleep()
    });
    let stopped = false;

    runtime.start();
    await harness.waitForSelect();
    const stopPromise = runtime.stop().then(() => {
      stopped = true;
    });

    await Promise.resolve();
    expect(stopped).toBe(false);
    deferred.resolve([]);
    await stopPromise;
    expect(stopped).toBe(true);
  });

  it("reports dispatch errors and continues polling by default", async () => {
    let attempts = 0;
    const harness = createRuntimeHarness({
      selectPending() {
        attempts += 1;
        if (attempts === 1) {
          throw new Error("database unavailable");
        }
        return Promise.resolve([]);
      }
    });
    const errors: string[] = [];
    const batches: DispatchOutboxBatchResult[] = [];
    const runtime = createOutboxPollingRuntime({
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

    expect(errors).toEqual(["database unavailable"]);
    expect(batches).toEqual([emptyBatchResult()]);
    expect(harness.selectCount()).toBe(2);
  });

  it("stops and rejects done when stopOnError is enabled", async () => {
    const harness = createRuntimeHarness({
      selectPending() {
        throw new Error("database unavailable");
      }
    });
    const errors: string[] = [];
    const runtime = createOutboxPollingRuntime({
      ...harness.input,
      intervalMs: 50,
      sleep: createAbortableSleep(),
      stopOnError: true,
      onError(error) {
        errors.push(error.message);
      }
    });

    runtime.start();
    await expect(runtime.done()).rejects.toThrow("database unavailable");
    expect(errors).toEqual(["database unavailable"]);
    expect(runtime.isRunning()).toBe(false);
  });
});

function createRuntimeHarness(
  options: {
    selectPending?: () => Promise<readonly CloudOutboxEvent[]>;
  } = {}
) {
  let selected = 0;
  const selectWaiters: Array<() => void> = [];
  const store: OutboxDispatchStore = {
    async selectPending() {
      selected += 1;
      for (const resolve of selectWaiters.splice(0)) {
        resolve();
      }
      return options.selectPending?.() ?? [];
    },
    async markProcessing() {
      return undefined;
    },
    async markPublished() {
      return undefined;
    },
    async markFailed() {
      return undefined;
    }
  };
  const publisher: OutboxPublisher = {
    async publishCrawlRequested() {
      return undefined;
    }
  };
  const retryPolicy: OutboxRetryPolicy = {
    nextAvailableAt() {
      return retryAt;
    }
  };
  const input: DispatchOutboxBatchInput = {
    store,
    publisher,
    retryPolicy,
    clock: {
      now() {
        return createdAt;
      }
    },
    limit: 25
  };

  return {
    input,
    selectCount() {
      return selected;
    },
    waitForSelect() {
      if (selected > 0) {
        return Promise.resolve();
      }
      return new Promise<void>((resolve) => {
        selectWaiters.push(resolve);
      });
    }
  };
}

function createAbortableSleep(): OutboxPollingRuntimeSleep {
  return (_intervalMs, signal) => {
    if (signal.aborted) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      signal.addEventListener("abort", () => resolve(), {
        once: true
      });
    });
  };
}

function emptyBatchResult(): DispatchOutboxBatchResult {
  return {
    selected: 0,
    leased: 0,
    published: 0,
    failed: 0,
    skipped: 0
  };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return {
    promise,
    resolve
  };
}
