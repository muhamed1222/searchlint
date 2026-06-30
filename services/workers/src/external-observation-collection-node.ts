import {
  createExternalObservationCollectionProcess,
  type ExternalObservationCollectionProcess,
  type ExternalObservationCollectionProcessEnv,
  type ExternalObservationCollectionProcessOptions
} from "./external-observation-collection-process.js";
import type {
  OutboxWorkerProcessExitPolicyBinding,
  OutboxWorkerShutdownSignalTarget
} from "./worker-lifecycle.js";

export type ExternalObservationCollectionNodeWritable = {
  write(chunk: string): void;
};

export type ExternalObservationCollectionNodeProcessLike =
  OutboxWorkerShutdownSignalTarget & {
    env: ExternalObservationCollectionProcessEnv;
    stderr: ExternalObservationCollectionNodeWritable;
    exitCode: string | number | null | undefined;
  };

export type ExternalObservationCollectionNodeProcessFactory = (
  options: ExternalObservationCollectionProcessOptions
) => ExternalObservationCollectionProcess;

export type ExternalObservationCollectionNodeRunnerOptions = {
  createProcess?: ExternalObservationCollectionNodeProcessFactory;
};

const startupFailurePrefix =
  "SearchLint external observation collection worker failed";

export async function runSearchLintExternalObservationCollectionNodeProcess(
  processLike: ExternalObservationCollectionNodeProcessLike,
  options: ExternalObservationCollectionNodeRunnerOptions = {}
): Promise<number> {
  const createProcess =
    options.createProcess ?? createExternalObservationCollectionProcess;
  let binding: OutboxWorkerProcessExitPolicyBinding | undefined;
  let worker: ExternalObservationCollectionProcess | undefined;

  try {
    worker = createProcess({
      env: processLike.env
    });
    binding = worker.installLifecycle({
      signalTarget: processLike,
      exitCodeSink(exitCode) {
        processLike.exitCode = exitCode;
      }
    });
    await worker.observability.start();
    worker.runtime.start();
    await worker.runtime.done();
    await worker.observability.shutdown();

    if (processLike.exitCode === null || processLike.exitCode === undefined) {
      processLike.exitCode = 0;
    }
    return numericExitCode(processLike.exitCode);
  } catch (error) {
    if (worker?.runtime.isRunning()) {
      await stopRunningWorker(worker);
    }
    await shutdownWorkerObservability(worker);
    processLike.stderr.write(
      `${startupFailurePrefix}: ${errorMessage(error)}\n`
    );
    processLike.exitCode = 1;
    return processLike.exitCode;
  } finally {
    binding?.uninstall();
  }
}

async function shutdownWorkerObservability(
  worker: ExternalObservationCollectionProcess | undefined
): Promise<void> {
  if (worker === undefined) {
    return;
  }
  const state = worker.observability.state();
  if (state === "stopped" || state === "shutdown-failed") {
    return;
  }
  try {
    await worker.observability.shutdown();
  } catch {
    // Preserve the startup or runtime failure as the process result.
  }
}

async function stopRunningWorker(
  worker: ExternalObservationCollectionProcess
): Promise<void> {
  try {
    await worker.runtime.stop();
  } catch {
    // The original startup/runtime error is the process result.
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function numericExitCode(exitCode: string | number): number {
  if (typeof exitCode === "number") {
    return exitCode;
  }
  const parsed = Number(exitCode);
  return Number.isInteger(parsed) ? parsed : 1;
}
