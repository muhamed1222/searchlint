import {
  createReportArtifactCleanupProcess,
  type ReportArtifactCleanupProcess,
  type ReportArtifactCleanupProcessEnv,
  type ReportArtifactCleanupProcessOptions
} from "./report-artifact-cleanup-process.js";
import type {
  OutboxWorkerProcessExitPolicyBinding,
  OutboxWorkerShutdownSignalTarget
} from "./worker-lifecycle.js";

export type ReportArtifactCleanupNodeWritable = {
  write(chunk: string): void;
};

export type ReportArtifactCleanupNodeProcessLike =
  OutboxWorkerShutdownSignalTarget & {
    env: ReportArtifactCleanupProcessEnv;
    stderr: ReportArtifactCleanupNodeWritable;
    exitCode: string | number | null | undefined;
  };

export type ReportArtifactCleanupNodeProcessFactory = (
  options: ReportArtifactCleanupProcessOptions
) => ReportArtifactCleanupProcess;

export type ReportArtifactCleanupNodeRunnerOptions = {
  createProcess?: ReportArtifactCleanupNodeProcessFactory;
};

const startupFailurePrefix = "SearchLint report artifact cleanup worker failed";

export async function runSearchLintReportArtifactCleanupNodeProcess(
  processLike: ReportArtifactCleanupNodeProcessLike,
  options: ReportArtifactCleanupNodeRunnerOptions = {}
): Promise<number> {
  const createProcess =
    options.createProcess ?? createReportArtifactCleanupProcess;
  let binding: OutboxWorkerProcessExitPolicyBinding | undefined;
  let worker: ReportArtifactCleanupProcess | undefined;

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
  worker: ReportArtifactCleanupProcess | undefined
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
  worker: ReportArtifactCleanupProcess
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
