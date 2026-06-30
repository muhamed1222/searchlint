import { describe, expect, it } from "vitest";

import {
  createOtlpExporterLifecycle,
  type OtlpExporterRuntime,
  type OtlpRuntimeConfig
} from "../src/index.js";

describe("createOtlpExporterLifecycle", () => {
  it("starts and shuts down the exporter runtime once", async () => {
    const calls: string[] = [];
    const runtime: OtlpExporterRuntime = {
      start(receivedConfig) {
        calls.push(`start:${receivedConfig.serviceName}`);
      },
      shutdown() {
        calls.push("shutdown");
      }
    };
    const lifecycle = createOtlpExporterLifecycle({
      config: runtimeConfig(),
      runtime
    });

    await expect(lifecycle.start()).resolves.toEqual({
      state: "started",
      alreadyStarted: false
    });
    await expect(lifecycle.start()).resolves.toEqual({
      state: "started",
      alreadyStarted: true
    });
    await expect(lifecycle.shutdown()).resolves.toEqual({
      state: "stopped",
      alreadyStopped: false
    });
    await expect(lifecycle.shutdown()).resolves.toEqual({
      state: "stopped",
      alreadyStopped: true
    });

    expect(lifecycle.state()).toBe("stopped");
    expect(calls).toEqual(["start:searchlint-cloud-api", "shutdown"]);
  });

  it("shares concurrent start and shutdown operations", async () => {
    const calls: string[] = [];
    let resolveStart: (() => void) | undefined;
    let resolveShutdown: (() => void) | undefined;
    const runtime: OtlpExporterRuntime = {
      start() {
        calls.push("start");
        return new Promise<void>((resolve) => {
          resolveStart = resolve;
        });
      },
      shutdown() {
        calls.push("shutdown");
        return new Promise<void>((resolve) => {
          resolveShutdown = resolve;
        });
      }
    };
    const lifecycle = createOtlpExporterLifecycle({
      config: runtimeConfig(),
      runtime
    });

    const firstStart = lifecycle.start();
    const secondStart = lifecycle.start();
    await Promise.resolve();
    resolveStart?.();
    await expect(Promise.all([firstStart, secondStart])).resolves.toEqual([
      { state: "started", alreadyStarted: false },
      { state: "started", alreadyStarted: false }
    ]);

    const firstShutdown = lifecycle.shutdown();
    const secondShutdown = lifecycle.shutdown();
    await Promise.resolve();
    resolveShutdown?.();
    await expect(Promise.all([firstShutdown, secondShutdown])).resolves.toEqual(
      [
        { state: "stopped", alreadyStopped: false },
        { state: "stopped", alreadyStopped: false }
      ]
    );

    expect(calls).toEqual(["start", "shutdown"]);
  });

  it("marks start failures and skips shutdown when the runtime did not start", async () => {
    const calls: string[] = [];
    const error = new Error("collector unavailable");
    const runtime: OtlpExporterRuntime = {
      start() {
        calls.push("start");
        throw error;
      },
      shutdown() {
        calls.push("shutdown");
      }
    };
    const lifecycle = createOtlpExporterLifecycle({
      config: runtimeConfig(),
      runtime
    });

    await expect(lifecycle.start()).rejects.toBe(error);
    await expect(lifecycle.shutdown()).resolves.toEqual({
      state: "start-failed",
      skipped: true
    });

    expect(lifecycle.state()).toBe("start-failed");
    expect(calls).toEqual(["start"]);
  });

  it("rejects startup timeout deterministically", async () => {
    const lifecycle = createOtlpExporterLifecycle({
      config: runtimeConfig({ timeoutMs: 1 }),
      runtime: {
        start() {
          return new Promise<void>(() => undefined);
        },
        shutdown() {
          throw new Error("shutdown should not run");
        }
      }
    });

    await expect(lifecycle.start()).rejects.toThrow(
      "OTLP exporter start timed out after 1ms."
    );
    await expect(lifecycle.shutdown()).resolves.toEqual({
      state: "start-failed",
      skipped: true
    });
  });

  it("marks shutdown failures and timeout failures deterministically", async () => {
    const shutdownFailure = createOtlpExporterLifecycle({
      config: runtimeConfig(),
      runtime: {
        start() {
          return undefined;
        },
        shutdown() {
          throw new Error("flush failed");
        }
      }
    });

    await shutdownFailure.start();
    await expect(shutdownFailure.shutdown()).rejects.toThrow("flush failed");
    expect(shutdownFailure.state()).toBe("shutdown-failed");

    const shutdownTimeout = createOtlpExporterLifecycle({
      config: runtimeConfig({ timeoutMs: 1 }),
      runtime: {
        start() {
          return undefined;
        },
        shutdown() {
          return new Promise<void>(() => undefined);
        }
      }
    });

    await shutdownTimeout.start();
    await expect(shutdownTimeout.shutdown()).rejects.toThrow(
      "OTLP exporter shutdown timed out after 1ms."
    );
    expect(shutdownTimeout.state()).toBe("shutdown-failed");
  });
});

function runtimeConfig(
  overrides: Partial<OtlpRuntimeConfig> = {}
): OtlpRuntimeConfig {
  return {
    serviceName: "searchlint-cloud-api",
    environment: "test",
    endpoint: new URL("https://otel-collector.example.com/v1/logs"),
    protocol: "http/protobuf",
    timeoutMs: 10000,
    headers: [],
    signals: ["logs", "metrics"],
    ...overrides
  };
}
