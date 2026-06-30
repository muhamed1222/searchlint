import type { ReportArtifact, ReportRetentionStore } from "@searchlint/api";

export type ReportArtifactObjectStore = {
  deleteReportArtifact(input: { artifactUri: string }): Promise<void>;
};

export type DeleteExpiredReportArtifactsInput = {
  store: ReportRetentionStore;
  objectStore: ReportArtifactObjectStore;
  now: string;
  limit: number;
};

export type DeleteExpiredReportArtifactsResult = {
  selected: number;
  leased: number;
  deleted: number;
  failed: number;
  skipped: number;
};

export type ReportArtifactCleanupClock = {
  now(): string;
};

export type ReportArtifactCleanupPollingRuntimeSleep = (
  intervalMs: number,
  signal: AbortSignal
) => Promise<void>;

export type ReportArtifactCleanupPollingRuntimeOptions = Omit<
  DeleteExpiredReportArtifactsInput,
  "now"
> & {
  now?: string;
  clock?: ReportArtifactCleanupClock;
  intervalMs: number;
  sleep?: ReportArtifactCleanupPollingRuntimeSleep;
  onBatch?: (
    result: DeleteExpiredReportArtifactsResult
  ) => void | Promise<void>;
  onError?: (error: Error) => void | Promise<void>;
  stopOnError?: boolean;
};

export type ReportArtifactCleanupPollingRuntime = {
  start(): void;
  stop(): Promise<void>;
  done(): Promise<void>;
  isRunning(): boolean;
};

export async function deleteExpiredReportArtifacts(
  input: DeleteExpiredReportArtifactsInput
): Promise<DeleteExpiredReportArtifactsResult> {
  if (!Number.isInteger(input.limit) || input.limit <= 0) {
    throw new Error("Report artifact deletion limit must be positive.");
  }

  const expired = await input.store.selectExpiredReportArtifacts({
    now: input.now,
    limit: input.limit
  });
  const result: DeleteExpiredReportArtifactsResult = {
    selected: expired.length,
    leased: 0,
    deleted: 0,
    failed: 0,
    skipped: 0
  };

  for (const artifact of expired) {
    await deleteExpiredReportArtifact(input, artifact, result);
  }

  return result;
}

export function createReportArtifactCleanupPollingRuntime(
  options: ReportArtifactCleanupPollingRuntimeOptions
): ReportArtifactCleanupPollingRuntime {
  if (!Number.isInteger(options.intervalMs) || options.intervalMs < 1) {
    throw new Error(
      "Report artifact cleanup polling interval must be a positive integer."
    );
  }

  const sleep = options.sleep ?? defaultSleep;
  let running = false;
  let stopRequested = false;
  let controller: AbortController | undefined;
  let donePromise: Promise<void> = Promise.resolve();

  async function runLoop(signal: AbortSignal): Promise<void> {
    while (!stopRequested && !signal.aborted) {
      try {
        const result = await deleteExpiredReportArtifacts({
          store: options.store,
          objectStore: options.objectStore,
          now: options.now ?? options.clock?.now() ?? new Date().toISOString(),
          limit: options.limit
        });
        await options.onBatch?.(result);
      } catch (error) {
        const normalized = asError(error);
        await options.onError?.(normalized);
        if (options.stopOnError === true) {
          throw normalized;
        }
      }

      if (!stopRequested && !signal.aborted) {
        await sleep(options.intervalMs, signal);
      }
    }
  }

  return {
    start() {
      if (running) {
        throw new Error(
          "Report artifact cleanup polling runtime is already running."
        );
      }
      stopRequested = false;
      running = true;
      controller = new AbortController();
      donePromise = runLoop(controller.signal).finally(() => {
        running = false;
        controller = undefined;
      });
    },
    async stop() {
      stopRequested = true;
      controller?.abort();
      await donePromise;
    },
    done() {
      return donePromise;
    },
    isRunning() {
      return running;
    }
  };
}

async function deleteExpiredReportArtifact(
  input: DeleteExpiredReportArtifactsInput,
  artifact: ReportArtifact,
  result: DeleteExpiredReportArtifactsResult
): Promise<void> {
  const leased = await input.store.markReportArtifactDeleting({
    organizationId: artifact.organizationId,
    id: artifact.id
  });
  if (!leased) {
    result.skipped += 1;
    return;
  }

  result.leased += 1;

  try {
    if (leased.artifactUri !== undefined) {
      await input.objectStore.deleteReportArtifact({
        artifactUri: leased.artifactUri
      });
    }

    const deleted = await input.store.markReportArtifactDeleted({
      organizationId: leased.organizationId,
      id: leased.id
    });
    if (deleted) {
      result.deleted += 1;
    } else {
      result.skipped += 1;
    }
  } catch (error) {
    result.failed += 1;
    await input.store.markReportArtifactDeletionFailed({
      organizationId: leased.organizationId,
      id: leased.id
    });
  }
}

function asError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  return new Error(String(error));
}

function defaultSleep(intervalMs: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const timeout = setTimeout(resolve, intervalMs);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timeout);
        resolve();
      },
      {
        once: true
      }
    );
  });
}
