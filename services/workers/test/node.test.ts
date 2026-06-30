import { describe, expect, it } from "vitest";
import type { OtlpExporterLifecycle } from "@searchlint/api";

import { runSearchLintCrawlerWorkerNodeProcess } from "../src/node.js";
import type {
  CrawlerWorkerNodeProcessFactory,
  CrawlerWorkerNodeProcessLike
} from "../src/node.js";
import type {
  CrawlerWorkerProcess,
  CrawlerWorkerProcessConfig,
  CrawlerWorkerProcessEnv,
  OutboxWorkerProcessExitPolicyBinding,
  OutboxWorkerRuntime,
  OutboxWorkerShutdownSignal,
  OutboxWorkerShutdownSignalTarget,
  SqsCrawlerPollingRuntime
} from "../src/index.js";

describe("runSearchLintCrawlerWorkerNodeProcess", () => {
  it("starts the crawler worker and maps natural completion to exit code 0", async () => {
    const processLike = new FakeNodeProcess(requiredEnv());
    const worker = new FakeCrawlerWorkerProcess();

    const exitCode = await runSearchLintCrawlerWorkerNodeProcess(processLike, {
      createProcess: createProcessFactory(worker)
    });

    expect(exitCode).toBe(0);
    expect(processLike.exitCode).toBe(0);
    expect(processLike.stderr.lines).toEqual([]);
    expect(worker.observability.events).toEqual(["start", "shutdown"]);
    expect(worker.runtime.startCalls).toBe(1);
    expect(worker.runtime.doneAwaited).toBe(true);
    expect(worker.installLifecycleCalls).toHaveLength(1);
    expect(worker.installLifecycleCalls[0]?.signalTarget).toBe(processLike);
    expect(worker.binding.uninstalled).toBe(true);
  });

  it("maps observability startup failures before polling starts to stderr and exit code 1", async () => {
    const processLike = new FakeNodeProcess(requiredEnv());
    const worker = new FakeCrawlerWorkerProcess({
      observabilityStartError: new Error("collector unavailable")
    });

    const exitCode = await runSearchLintCrawlerWorkerNodeProcess(processLike, {
      createProcess: createProcessFactory(worker)
    });

    expect(exitCode).toBe(1);
    expect(processLike.exitCode).toBe(1);
    expect(processLike.stderr.lines).toEqual([
      "SearchLint crawler worker failed: collector unavailable\n"
    ]);
    expect(worker.runtime.startCalls).toBe(0);
    expect(worker.observability.events).toEqual(["start", "shutdown"]);
    expect(worker.binding.uninstalled).toBe(true);
  });

  it("maps observability shutdown failures to stderr and exit code 1", async () => {
    const processLike = new FakeNodeProcess(requiredEnv());
    const worker = new FakeCrawlerWorkerProcess({
      observabilityShutdownError: new Error("collector shutdown failed")
    });

    const exitCode = await runSearchLintCrawlerWorkerNodeProcess(processLike, {
      createProcess: createProcessFactory(worker)
    });

    expect(exitCode).toBe(1);
    expect(processLike.exitCode).toBe(1);
    expect(processLike.stderr.lines).toEqual([
      "SearchLint crawler worker failed: collector shutdown failed\n"
    ]);
    expect(worker.observability.events).toEqual(["start", "shutdown"]);
    expect(worker.binding.uninstalled).toBe(true);
  });

  it("preserves lifecycle-provided exit codes", async () => {
    const processLike = new FakeNodeProcess(requiredEnv());
    const worker = new FakeCrawlerWorkerProcess({
      onInstallLifecycle(bindingOptions) {
        bindingOptions.exitCodeSink?.(5);
      }
    });

    const exitCode = await runSearchLintCrawlerWorkerNodeProcess(processLike, {
      createProcess: createProcessFactory(worker)
    });

    expect(exitCode).toBe(5);
    expect(processLike.exitCode).toBe(5);
    expect(worker.binding.uninstalled).toBe(true);
  });

  it("maps startup failures to stderr and exit code 1", async () => {
    const processLike = new FakeNodeProcess(requiredEnv());

    const exitCode = await runSearchLintCrawlerWorkerNodeProcess(processLike, {
      createProcess() {
        throw new Error("SEARCHLINT_CRAWL_QUEUE_URL is required.");
      }
    });

    expect(exitCode).toBe(1);
    expect(processLike.exitCode).toBe(1);
    expect(processLike.stderr.lines).toEqual([
      "SearchLint crawler worker failed: SEARCHLINT_CRAWL_QUEUE_URL is required.\n"
    ]);
  });

  it("maps runtime failures to stderr, exit code 1, and lifecycle cleanup", async () => {
    const processLike = new FakeNodeProcess(requiredEnv());
    const worker = new FakeCrawlerWorkerProcess({
      runtimeError: new Error("polling failed")
    });

    const exitCode = await runSearchLintCrawlerWorkerNodeProcess(processLike, {
      createProcess: createProcessFactory(worker)
    });

    expect(exitCode).toBe(1);
    expect(processLike.exitCode).toBe(1);
    expect(processLike.stderr.lines).toEqual([
      "SearchLint crawler worker failed: polling failed\n"
    ]);
    expect(worker.runtime.stopped).toBe(false);
    expect(worker.binding.uninstalled).toBe(true);
  });

  it("stops a still-running worker after runtime failure", async () => {
    const processLike = new FakeNodeProcess(requiredEnv());
    const worker = new FakeCrawlerWorkerProcess({
      runtimeError: new Error("polling failed"),
      keepRunningAfterDoneError: true
    });

    await runSearchLintCrawlerWorkerNodeProcess(processLike, {
      createProcess: createProcessFactory(worker)
    });

    expect(worker.runtime.stopped).toBe(true);
    expect(worker.binding.uninstalled).toBe(true);
  });
});

function requiredEnv(): CrawlerWorkerProcessEnv {
  return {
    SEARCHLINT_POSTGRES_DATABASE_URL: "postgres://searchlint.local/db",
    SEARCHLINT_CRAWL_QUEUE_URL: "https://sqs.us-east-1.amazonaws.com/1/crawl",
    SEARCHLINT_CRAWL_ARTIFACT_BUCKET: "searchlint-crawl-artifacts",
    SEARCHLINT_RULE_CATALOG_PATH: "specs/RULE_CATALOG.yaml",
    OTEL_SERVICE_NAME: "searchlint-cloud-worker",
    SEARCHLINT_ENVIRONMENT: "test",
    OTEL_EXPORTER_OTLP_ENDPOINT: "https://otel-collector.example.com/v1/logs",
    OTEL_EXPORTER_OTLP_PROTOCOL: "http/protobuf",
    OTEL_EXPORTER_OTLP_TIMEOUT: "10000"
  };
}

function createProcessFactory(
  worker: CrawlerWorkerProcess
): CrawlerWorkerNodeProcessFactory {
  return () => worker;
}

class FakeCrawlerWorkerProcess implements CrawlerWorkerProcess {
  readonly config: CrawlerWorkerProcessConfig = {
    postgresPrefix: "SEARCHLINT_POSTGRES",
    postgresDatabaseUrl: "postgres://searchlint.local/db",
    queueUrl: "https://sqs.us-east-1.amazonaws.com/1/crawl",
    artifactBucket: "searchlint-crawl-artifacts",
    ruleCatalogPath: "specs/RULE_CATALOG.yaml",
    pollIntervalMs: 1000,
    batchSize: 5,
    waitTimeSeconds: 20,
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
  readonly observability: FakeOtlpLifecycle;
  readonly runtime: FakeWorkerRuntime;
  readonly pollingRuntime: SqsCrawlerPollingRuntime;
  readonly binding = new FakeExitPolicyBinding();
  readonly installLifecycleCalls: Array<{
    signalTarget?: OutboxWorkerShutdownSignalTarget;
    exitCodeSink?: (exitCode: number) => void;
  }> = [];
  readonly onInstallLifecycle:
    | ((options: {
        signalTarget?: OutboxWorkerShutdownSignalTarget;
        exitCodeSink?: (exitCode: number) => void;
      }) => void)
    | undefined;

  constructor(
    options: {
      runtimeError?: Error;
      keepRunningAfterDoneError?: boolean;
      observabilityStartError?: Error;
      observabilityShutdownError?: Error;
      onInstallLifecycle?: (options: {
        signalTarget?: OutboxWorkerShutdownSignalTarget;
        exitCodeSink?: (exitCode: number) => void;
      }) => void;
    } = {}
  ) {
    this.runtime = new FakeWorkerRuntime(options);
    this.pollingRuntime = this.runtime as unknown as SqsCrawlerPollingRuntime;
    this.observability = new FakeOtlpLifecycle({
      ...(options.observabilityStartError === undefined
        ? {}
        : { startError: options.observabilityStartError }),
      ...(options.observabilityShutdownError === undefined
        ? {}
        : { shutdownError: options.observabilityShutdownError })
    });
    this.onInstallLifecycle = options.onInstallLifecycle;
  }

  installLifecycle(options: {
    signalTarget?: OutboxWorkerShutdownSignalTarget;
    exitCodeSink?: (exitCode: number) => void;
  }): OutboxWorkerProcessExitPolicyBinding {
    this.installLifecycleCalls.push(options);
    this.onInstallLifecycle?.(options);
    return this.binding;
  }
}

class FakeOtlpLifecycle implements OtlpExporterLifecycle {
  readonly events: string[] = [];
  readonly startError: Error | undefined;
  readonly shutdownError: Error | undefined;
  private currentState: ReturnType<OtlpExporterLifecycle["state"]> = "idle";

  constructor(
    options: {
      startError?: Error;
      shutdownError?: Error;
    } = {}
  ) {
    this.startError = options.startError;
    this.shutdownError = options.shutdownError;
  }

  state(): ReturnType<OtlpExporterLifecycle["state"]> {
    return this.currentState;
  }

  async start(): ReturnType<OtlpExporterLifecycle["start"]> {
    this.events.push("start");
    if (this.startError) {
      this.currentState = "start-failed";
      throw this.startError;
    }
    this.currentState = "started";
    return {
      state: "started",
      alreadyStarted: false
    };
  }

  async shutdown(): ReturnType<OtlpExporterLifecycle["shutdown"]> {
    this.events.push("shutdown");
    if (this.shutdownError) {
      this.currentState = "shutdown-failed";
      throw this.shutdownError;
    }
    if (this.currentState === "idle" || this.currentState === "start-failed") {
      return {
        state: this.currentState,
        skipped: true
      };
    }
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

class FakeNodeProcess implements CrawlerWorkerNodeProcessLike {
  readonly stderr = new MemoryWriter();
  exitCode: number | undefined;
  readonly listeners = new Map<OutboxWorkerShutdownSignal, Set<() => void>>();

  constructor(readonly env: CrawlerWorkerProcessEnv) {}

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
