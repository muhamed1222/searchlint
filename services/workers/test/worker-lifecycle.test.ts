import { describe, expect, it } from "vitest";

import {
  createOutboxWorkerRuntime,
  installOutboxWorkerEcsTaskLifecycle,
  installOutboxWorkerProcessExitPolicy,
  installOutboxWorkerShutdownSignals
} from "../src/index.js";
import type {
  OutboxPollingRuntime,
  OutboxWorkerEcsTaskLifecycleEvent,
  OutboxWorkerRuntime,
  OutboxWorkerShutdownResult,
  OutboxWorkerShutdownSignal,
  OutboxWorkerShutdownSignalTarget
} from "../src/index.js";

describe("createOutboxWorkerRuntime", () => {
  it("starts and stops the wrapped polling runtime", async () => {
    const polling = createPollingRuntime();
    const runtime = createOutboxWorkerRuntime(polling);

    runtime.start();
    const result = await runtime.stop();

    expect(polling.calls).toEqual(["start", "stop"]);
    expect(result).toEqual({
      completed: true,
      forced: false,
      wasRunning: true
    });
    expect(runtime.isRunning()).toBe(false);
  });

  it("reports stop when the wrapped polling runtime was already stopped", async () => {
    const polling = createPollingRuntime();
    const runtime = createOutboxWorkerRuntime(polling);

    await expect(runtime.stop()).resolves.toEqual({
      completed: true,
      forced: false,
      wasRunning: false
    });
  });
});

describe("installOutboxWorkerShutdownSignals", () => {
  it("registers SIGTERM and SIGINT by default", () => {
    const target = new FakeSignalTarget();
    const binding = installOutboxWorkerShutdownSignals(createWorkerRuntime(), {
      target
    });

    expect(target.listenerCount("SIGTERM")).toBe(1);
    expect(target.listenerCount("SIGINT")).toBe(1);

    binding.uninstall();
  });

  it("runs worker shutdown once for the first signal and removes listeners", async () => {
    const target = new FakeSignalTarget();
    const calls: string[] = [];
    const binding = installOutboxWorkerShutdownSignals(
      createWorkerRuntime({
        async stop() {
          calls.push("stop");
          return workerShutdownResult();
        }
      }),
      {
        target
      }
    );

    target.emit("SIGTERM");
    target.emit("SIGINT");
    await expect(binding.shutdownPromise()).resolves.toEqual(
      workerShutdownResult()
    );

    expect(calls).toEqual(["stop"]);
    expect(target.listenerCount("SIGTERM")).toBe(0);
    expect(target.listenerCount("SIGINT")).toBe(0);
  });

  it("does not shut down after uninstall", () => {
    const target = new FakeSignalTarget();
    const calls: string[] = [];
    const binding = installOutboxWorkerShutdownSignals(
      createWorkerRuntime({
        async stop() {
          calls.push("stop");
          return workerShutdownResult();
        }
      }),
      {
        target
      }
    );

    binding.uninstall();
    target.emit("SIGTERM");

    expect(calls).toEqual([]);
    expect(binding.shutdownPromise()).toBeUndefined();
  });

  it("reports shutdown start and completion through callbacks", async () => {
    const target = new FakeSignalTarget();
    const events: Array<{ kind: string; signal: OutboxWorkerShutdownSignal }> =
      [];
    const binding = installOutboxWorkerShutdownSignals(createWorkerRuntime(), {
      target,
      onShutdownStart(event) {
        events.push({
          kind: "start",
          signal: event.signal
        });
      },
      onShutdownComplete(event) {
        events.push({
          kind: "complete",
          signal: event.signal
        });
      }
    });

    target.emit("SIGINT");
    await binding.shutdownPromise();

    expect(events).toEqual([
      {
        kind: "start",
        signal: "SIGINT"
      },
      {
        kind: "complete",
        signal: "SIGINT"
      }
    ]);
  });

  it("reports shutdown errors and preserves rejection", async () => {
    const target = new FakeSignalTarget();
    const error = new Error("stop failed");
    const errors: unknown[] = [];
    const binding = installOutboxWorkerShutdownSignals(
      createWorkerRuntime({
        async stop() {
          throw error;
        }
      }),
      {
        target,
        onShutdownError(event) {
          errors.push(event.error);
        }
      }
    );

    target.emit("SIGTERM");

    await expect(binding.shutdownPromise()).rejects.toBe(error);
    expect(errors).toEqual([error]);
  });
});

describe("installOutboxWorkerEcsTaskLifecycle", () => {
  it("reports ready immediately after installation", () => {
    const target = new FakeSignalTarget();
    const events: OutboxWorkerEcsTaskLifecycleEvent[] = [];
    const binding = installOutboxWorkerEcsTaskLifecycle(createWorkerRuntime(), {
      target,
      onStateChange(event) {
        events.push(event);
      }
    });

    expect(binding.state()).toBe("ready");
    expect(events).toEqual([
      {
        state: "ready"
      }
    ]);

    binding.uninstall();
  });

  it("reports draining before stop and stopped after completion", async () => {
    const target = new FakeSignalTarget();
    const events: OutboxWorkerEcsTaskLifecycleEvent[] = [];
    let resolveStop: (result: OutboxWorkerShutdownResult) => void = () =>
      undefined;
    const stop = new Promise<OutboxWorkerShutdownResult>((resolve) => {
      resolveStop = resolve;
    });
    const binding = installOutboxWorkerEcsTaskLifecycle(
      createWorkerRuntime({
        async stop() {
          return stop;
        }
      }),
      {
        target,
        onStateChange(event) {
          events.push(event);
        }
      }
    );

    target.emit("SIGTERM");

    expect(binding.state()).toBe("draining");
    expect(events).toEqual([
      {
        state: "ready"
      },
      {
        state: "draining",
        signal: "SIGTERM"
      }
    ]);

    resolveStop(workerShutdownResult());
    await binding.shutdownPromise();

    expect(binding.state()).toBe("stopped");
    expect(events).toEqual([
      {
        state: "ready"
      },
      {
        state: "draining",
        signal: "SIGTERM"
      },
      {
        state: "stopped",
        signal: "SIGTERM",
        result: workerShutdownResult()
      }
    ]);
  });

  it("reports failed when stop rejects", async () => {
    const target = new FakeSignalTarget();
    const error = new Error("stop failed");
    const events: OutboxWorkerEcsTaskLifecycleEvent[] = [];
    const binding = installOutboxWorkerEcsTaskLifecycle(
      createWorkerRuntime({
        async stop() {
          throw error;
        }
      }),
      {
        target,
        onStateChange(event) {
          events.push(event);
        }
      }
    );

    target.emit("SIGINT");

    await expect(binding.shutdownPromise()).rejects.toBe(error);
    expect(binding.state()).toBe("failed");
    expect(events).toEqual([
      {
        state: "ready"
      },
      {
        state: "draining",
        signal: "SIGINT"
      },
      {
        state: "failed",
        signal: "SIGINT",
        error
      }
    ]);
  });
});

describe("installOutboxWorkerProcessExitPolicy", () => {
  it("sets exit code 0 after successful shutdown", async () => {
    const target = new FakeSignalTarget();
    const exitCodes: number[] = [];
    const binding = installOutboxWorkerProcessExitPolicy(
      createWorkerRuntime(),
      {
        target,
        exitCodeSink(exitCode) {
          exitCodes.push(exitCode);
        }
      }
    );

    target.emit("SIGTERM");
    await binding.shutdownPromise();

    expect(binding.state()).toBe("stopped");
    expect(exitCodes).toEqual([0]);
  });

  it("sets exit code 1 after failed shutdown", async () => {
    const target = new FakeSignalTarget();
    const error = new Error("stop failed");
    const exitCodes: number[] = [];
    const binding = installOutboxWorkerProcessExitPolicy(
      createWorkerRuntime({
        async stop() {
          throw error;
        }
      }),
      {
        target,
        exitCodeSink(exitCode) {
          exitCodes.push(exitCode);
        }
      }
    );

    target.emit("SIGINT");

    await expect(binding.shutdownPromise()).rejects.toBe(error);
    expect(binding.state()).toBe("failed");
    expect(exitCodes).toEqual([1]);
  });

  it("supports custom exit codes", async () => {
    const successTarget = new FakeSignalTarget();
    const failureTarget = new FakeSignalTarget();
    const exitCodes: number[] = [];
    const success = installOutboxWorkerProcessExitPolicy(
      createWorkerRuntime(),
      {
        target: successTarget,
        successExitCode: 10,
        failureExitCode: 20,
        exitCodeSink(exitCode) {
          exitCodes.push(exitCode);
        }
      }
    );
    const failure = installOutboxWorkerProcessExitPolicy(
      createWorkerRuntime({
        async stop() {
          throw new Error("stop failed");
        }
      }),
      {
        target: failureTarget,
        successExitCode: 10,
        failureExitCode: 20,
        exitCodeSink(exitCode) {
          exitCodes.push(exitCode);
        }
      }
    );

    successTarget.emit("SIGTERM");
    failureTarget.emit("SIGTERM");
    await success.shutdownPromise();
    await expect(failure.shutdownPromise()).rejects.toThrow("stop failed");

    expect(exitCodes).toEqual([10, 20]);
  });
});

function createPollingRuntime(): OutboxPollingRuntime & { calls: string[] } {
  let running = false;
  const calls: string[] = [];
  return {
    calls,
    start() {
      calls.push("start");
      running = true;
    },
    async stop() {
      calls.push("stop");
      running = false;
    },
    async done() {
      return undefined;
    },
    isRunning() {
      return running;
    }
  };
}

function createWorkerRuntime(
  overrides: Partial<OutboxWorkerRuntime> = {}
): OutboxWorkerRuntime {
  return {
    start() {
      return undefined;
    },
    async stop() {
      return workerShutdownResult();
    },
    async done() {
      return undefined;
    },
    isRunning() {
      return true;
    },
    ...overrides
  };
}

function workerShutdownResult(): OutboxWorkerShutdownResult {
  return {
    completed: true,
    forced: false,
    wasRunning: true
  };
}

class FakeSignalTarget implements OutboxWorkerShutdownSignalTarget {
  private readonly listeners = new Map<
    OutboxWorkerShutdownSignal,
    Set<() => void>
  >();

  on(signal: OutboxWorkerShutdownSignal, listener: () => void): void {
    const listeners = this.listeners.get(signal) ?? new Set<() => void>();
    listeners.add(listener);
    this.listeners.set(signal, listeners);
  }

  off(signal: OutboxWorkerShutdownSignal, listener: () => void): void {
    this.listeners.get(signal)?.delete(listener);
  }

  emit(signal: OutboxWorkerShutdownSignal): void {
    for (const listener of this.listeners.get(signal) ?? []) {
      listener();
    }
  }

  listenerCount(signal: OutboxWorkerShutdownSignal): number {
    return this.listeners.get(signal)?.size ?? 0;
  }
}
