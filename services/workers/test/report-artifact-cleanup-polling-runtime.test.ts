import { describe, expect, it } from "vitest";

import { createReportArtifactCleanupPollingRuntime } from "../src/index.js";
import type {
  DeleteExpiredReportArtifactsResult,
  ReportArtifactCleanupPollingRuntimeSleep
} from "../src/index.js";
import type { ReportArtifact, ReportRetentionStore } from "@searchlint/api";
import type { ReportArtifactObjectStore } from "../src/index.js";

const now = "2026-09-20T00:00:00.000Z";

describe("createReportArtifactCleanupPollingRuntime", () => {
  it("runs cleanup batches on an interval", async () => {
    const sleepIntervals: number[] = [];
    const sleep: ReportArtifactCleanupPollingRuntimeSleep = async (
      intervalMs
    ) => {
      sleepIntervals.push(intervalMs);
    };
    const batches: DeleteExpiredReportArtifactsResult[] = [];
    const harness = createRuntimeHarness();
    const runtime = createReportArtifactCleanupPollingRuntime({
      ...harness.input,
      intervalMs: 50,
      sleep,
      onBatch(result) {
        batches.push(result);
        void runtime.stop();
      }
    });

    runtime.start();
    await runtime.done();

    expect(batches).toEqual([emptyBatchResult()]);
    expect(sleepIntervals).toEqual([]);
    expect(harness.selectCount()).toBe(1);
  });

  it("rejects invalid intervals before starting", () => {
    const harness = createRuntimeHarness();

    expect(() =>
      createReportArtifactCleanupPollingRuntime({
        ...harness.input,
        intervalMs: 0
      })
    ).toThrow(
      "Report artifact cleanup polling interval must be a positive integer."
    );
  });

  it("rejects double starts", () => {
    const harness = createRuntimeHarness();
    const runtime = createReportArtifactCleanupPollingRuntime({
      ...harness.input,
      intervalMs: 50,
      sleep: createAbortableSleep()
    });

    runtime.start();
    expect(() => runtime.start()).toThrow(
      "Report artifact cleanup polling runtime is already running."
    );
    void runtime.stop();
  });

  it("waits for the current cleanup batch before stop completes", async () => {
    const deferred = createDeferred<readonly ReportArtifact[]>();
    const harness = createRuntimeHarness({
      selectExpiredReportArtifacts() {
        return deferred.promise;
      }
    });
    const runtime = createReportArtifactCleanupPollingRuntime({
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

  it("stops cleanly while sleeping between polls", async () => {
    const sleepStarted = createDeferred<void>();
    const harness = createRuntimeHarness();
    const runtime = createReportArtifactCleanupPollingRuntime({
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

  it("reports cleanup errors and continues polling by default", async () => {
    let attempts = 0;
    const harness = createRuntimeHarness({
      selectExpiredReportArtifacts() {
        attempts += 1;
        if (attempts === 1) {
          throw new Error("database unavailable");
        }
        return Promise.resolve([]);
      }
    });
    const errors: string[] = [];
    const batches: DeleteExpiredReportArtifactsResult[] = [];
    const runtime = createReportArtifactCleanupPollingRuntime({
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
      selectExpiredReportArtifacts() {
        throw new Error("database unavailable");
      }
    });
    const errors: string[] = [];
    const runtime = createReportArtifactCleanupPollingRuntime({
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
    selectExpiredReportArtifacts?: () => Promise<readonly ReportArtifact[]>;
  } = {}
) {
  let selected = 0;
  const selectWaiters: Array<() => void> = [];
  const store: ReportRetentionStore = {
    async insertReportArtifact(input) {
      return input;
    },
    async selectExpiredReportArtifacts() {
      selected += 1;
      for (const resolve of selectWaiters.splice(0)) {
        resolve();
      }
      return options.selectExpiredReportArtifacts?.() ?? [];
    },
    async markReportArtifactDeleting() {
      return undefined;
    },
    async markReportArtifactDeleted() {
      return undefined;
    },
    async markReportArtifactDeletionFailed() {
      return undefined;
    }
  };
  const objectStore: ReportArtifactObjectStore = {
    async deleteReportArtifact() {
      return undefined;
    }
  };

  return {
    input: {
      store,
      objectStore,
      now,
      limit: 25
    },
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

function emptyBatchResult(): DeleteExpiredReportArtifactsResult {
  return {
    selected: 0,
    leased: 0,
    deleted: 0,
    failed: 0,
    skipped: 0
  };
}

function createAbortableSleep(): ReportArtifactCleanupPollingRuntimeSleep {
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

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return {
    promise,
    resolve
  };
}
