import { describe, expect, it } from "vitest";
import type { OtlpExporterLifecycle } from "@searchlint/api";

import { runSearchLintReportArtifactCleanupNodeProcess } from "../src/index.js";
import type {
  OutboxWorkerProcessExitPolicyBinding,
  OutboxWorkerRuntime,
  OutboxWorkerShutdownSignal,
  OutboxWorkerShutdownSignalTarget,
  ReportArtifactCleanupNodeProcessFactory,
  ReportArtifactCleanupNodeProcessLike,
  ReportArtifactCleanupProcess,
  ReportArtifactCleanupProcessConfig,
  ReportArtifactCleanupProcessEnv,
  ReportArtifactCleanupPollingRuntime
} from "../src/index.js";

describe("runSearchLintReportArtifactCleanupNodeProcess", () => {
  it("starts the cleanup worker and maps natural completion to exit code 0", async () => {
    const processLike = new FakeNodeProcess(requiredEnv());
    const worker = new FakeReportArtifactCleanupProcess();

    const exitCode = await runSearchLintReportArtifactCleanupNodeProcess(
      processLike,
      {
        createProcess: createProcessFactory(worker)
      }
    );

    expect(exitCode).toBe(0);
    expect(processLike.exitCode).toBe(0);
    expect(processLike.stderr.lines).toEqual([]);
    expect(worker.observability.events).toEqual(["start", "shutdown"]);
    expect(worker.runtime.startCalls).toBe(1);
    expect(worker.runtime.doneAwaited).toBe(true);
    expect(worker.installLifecycleCalls[0]?.signalTarget).toBe(processLike);
    expect(worker.binding.uninstalled).toBe(true);
  });

  it("maps startup failures to stderr and exit code 1", async () => {
    const processLike = new FakeNodeProcess(requiredEnv());

    const exitCode = await runSearchLintReportArtifactCleanupNodeProcess(
      processLike,
      {
        createProcess() {
          throw new Error("SEARCHLINT_POSTGRES_DATABASE_URL is required.");
        }
      }
    );

    expect(exitCode).toBe(1);
    expect(processLike.exitCode).toBe(1);
    expect(processLike.stderr.lines).toEqual([
      "SearchLint report artifact cleanup worker failed: SEARCHLINT_POSTGRES_DATABASE_URL is required.\n"
    ]);
  });

  it("stops a still-running worker after runtime failure", async () => {
    const processLike = new FakeNodeProcess(requiredEnv());
    const worker = new FakeReportArtifactCleanupProcess({
      runtimeError: new Error("cleanup polling failed"),
      keepRunningAfterDoneError: true
    });

    await runSearchLintReportArtifactCleanupNodeProcess(processLike, {
      createProcess: createProcessFactory(worker)
    });

    expect(processLike.exitCode).toBe(1);
    expect(processLike.stderr.lines).toEqual([
      "SearchLint report artifact cleanup worker failed: cleanup polling failed\n"
    ]);
    expect(worker.runtime.stopped).toBe(true);
    expect(worker.binding.uninstalled).toBe(true);
  });
});

function requiredEnv(): ReportArtifactCleanupProcessEnv {
  return {
    SEARCHLINT_POSTGRES_DATABASE_URL: "postgres://searchlint.local/db",
    OTEL_SERVICE_NAME: "searchlint-cloud-worker",
    SEARCHLINT_ENVIRONMENT: "test",
    OTEL_EXPORTER_OTLP_ENDPOINT: "https://otel-collector.example.com/v1/logs",
    OTEL_EXPORTER_OTLP_PROTOCOL: "http/protobuf",
    OTEL_EXPORTER_OTLP_TIMEOUT: "10000"
  };
}

function createProcessFactory(
  worker: ReportArtifactCleanupProcess
): ReportArtifactCleanupNodeProcessFactory {
  return () => worker;
}

class FakeReportArtifactCleanupProcess implements ReportArtifactCleanupProcess {
  readonly config: ReportArtifactCleanupProcessConfig = {
    postgresPrefix: "SEARCHLINT_POSTGRES",
    postgresDatabaseUrl: "postgres://searchlint.local/db",
    pollIntervalMs: 60000,
    batchSize: 25,
    stopOnError: false,
    observability: {
      serviceName: "searchlint-cloud-worker",
      environment: "test",
      endpoint: new URL("https://otel-collector.example.com/v1/logs"),
      protocol: "http/protobuf",
      timeoutMs: 10000,
      headers: [],
      signals: ["logs", "metrics"]
    }
  };
  readonly observability = new FakeOtlpLifecycle();
  readonly runtime: FakeWorkerRuntime;
  readonly pollingRuntime: ReportArtifactCleanupPollingRuntime;
  readonly binding = new FakeExitPolicyBinding();
  readonly installLifecycleCalls: Array<{
    signalTarget?: OutboxWorkerShutdownSignalTarget;
    exitCodeSink?: (exitCode: number) => void;
  }> = [];

  constructor(
    options: {
      runtimeError?: Error;
      keepRunningAfterDoneError?: boolean;
    } = {}
  ) {
    this.runtime = new FakeWorkerRuntime(options);
    this.pollingRuntime = this
      .runtime as unknown as ReportArtifactCleanupPollingRuntime;
  }

  installLifecycle(options: {
    signalTarget?: OutboxWorkerShutdownSignalTarget;
    exitCodeSink?: (exitCode: number) => void;
  }): OutboxWorkerProcessExitPolicyBinding {
    this.installLifecycleCalls.push(options);
    return this.binding;
  }
}

class FakeOtlpLifecycle implements OtlpExporterLifecycle {
  readonly events: string[] = [];
  private currentState: ReturnType<OtlpExporterLifecycle["state"]> = "idle";

  state(): ReturnType<OtlpExporterLifecycle["state"]> {
    return this.currentState;
  }

  async start(): ReturnType<OtlpExporterLifecycle["start"]> {
    this.events.push("start");
    this.currentState = "started";
    return {
      state: "started",
      alreadyStarted: false
    };
  }

  async shutdown(): ReturnType<OtlpExporterLifecycle["shutdown"]> {
    this.events.push("shutdown");
    this.currentState = "stopped";
    return {
      state: "stopped",
      alreadyStopped: false
    };
  }
}

class FakeWorkerRuntime implements OutboxWorkerRuntime {
  started = false;
  startCalls = 0;
  stopped = false;
  doneAwaited = false;
  readonly runtimeError: Error | undefined;
  readonly keepRunningAfterDoneError: boolean;

  constructor(
    options: {
      runtimeError?: Error;
      keepRunningAfterDoneError?: boolean;
    } = {}
  ) {
    this.runtimeError = options.runtimeError;
    this.keepRunningAfterDoneError = options.keepRunningAfterDoneError ?? false;
  }

  start(): void {
    this.startCalls += 1;
    this.started = true;
  }

  async stop(): Promise<{
    completed: true;
    forced: false;
    wasRunning: boolean;
  }> {
    const wasRunning = this.isRunning();
    this.stopped = true;
    this.started = false;
    return {
      completed: true,
      forced: false,
      wasRunning
    };
  }

  async done(): Promise<void> {
    this.doneAwaited = true;
    if (this.runtimeError) {
      if (!this.keepRunningAfterDoneError) {
        this.started = false;
      }
      throw this.runtimeError;
    }
    this.started = false;
  }

  isRunning(): boolean {
    return this.started;
  }
}

class FakeExitPolicyBinding implements OutboxWorkerProcessExitPolicyBinding {
  uninstalled = false;

  uninstall(): void {
    this.uninstalled = true;
  }

  state(): "ready" {
    return "ready";
  }

  shutdownPromise(): undefined {
    return undefined;
  }
}

class FakeNodeProcess implements ReportArtifactCleanupNodeProcessLike {
  readonly stderr = new MemoryWriter();
  exitCode: number | undefined;
  readonly listeners = new Map<OutboxWorkerShutdownSignal, Set<() => void>>();

  constructor(readonly env: ReportArtifactCleanupProcessEnv) {}

  on(signal: OutboxWorkerShutdownSignal, listener: () => void): void {
    const listeners = this.listeners.get(signal) ?? new Set<() => void>();
    listeners.add(listener);
    this.listeners.set(signal, listeners);
  }

  off(signal: OutboxWorkerShutdownSignal, listener: () => void): void {
    this.listeners.get(signal)?.delete(listener);
  }
}

class MemoryWriter {
  readonly lines: string[] = [];

  write(chunk: string): void {
    this.lines.push(chunk);
  }
}
