import type { OtlpRuntimeConfig } from "./otlp-runtime-config.js";

export type OtlpExporterRuntime = {
  start(config: OtlpRuntimeConfig): Promise<void> | void;
  shutdown(): Promise<void> | void;
};

export type OtlpExporterLifecycleState =
  | "idle"
  | "started"
  | "start-failed"
  | "stopped"
  | "shutdown-failed";

export type OtlpExporterLifecycleStartResult = {
  state: "started";
  alreadyStarted: boolean;
};

export type OtlpExporterLifecycleShutdownResult =
  | {
      state: "stopped";
      alreadyStopped: boolean;
    }
  | {
      state: "idle" | "start-failed";
      skipped: true;
    };

export type OtlpExporterLifecycle = {
  state(): OtlpExporterLifecycleState;
  start(): Promise<OtlpExporterLifecycleStartResult>;
  shutdown(): Promise<OtlpExporterLifecycleShutdownResult>;
};

export type OtlpExporterLifecycleOptions = {
  config: OtlpRuntimeConfig;
  runtime: OtlpExporterRuntime;
};

export function createOtlpExporterLifecycle(
  options: OtlpExporterLifecycleOptions
): OtlpExporterLifecycle {
  let state: OtlpExporterLifecycleState = "idle";
  let startPromise: Promise<OtlpExporterLifecycleStartResult> | undefined;
  let shutdownPromise: Promise<OtlpExporterLifecycleShutdownResult> | undefined;

  return {
    state() {
      return state;
    },
    start() {
      if (state === "started") {
        return Promise.resolve({
          state: "started",
          alreadyStarted: true
        });
      }

      if (startPromise !== undefined) {
        return startPromise;
      }

      startPromise = withTimeout(
        Promise.resolve().then(() => options.runtime.start(options.config)),
        options.config.timeoutMs,
        "start"
      )
        .then(() => {
          state = "started";
          return {
            state: "started" as const,
            alreadyStarted: false
          };
        })
        .catch((error: unknown) => {
          state = "start-failed";
          throw error;
        });

      return startPromise;
    },
    shutdown() {
      if (state === "idle" || state === "start-failed") {
        return Promise.resolve({
          state,
          skipped: true
        });
      }

      if (state === "stopped") {
        return Promise.resolve({
          state: "stopped",
          alreadyStopped: true
        });
      }

      if (shutdownPromise !== undefined) {
        return shutdownPromise;
      }

      shutdownPromise = withTimeout(
        Promise.resolve().then(() => options.runtime.shutdown()),
        options.config.timeoutMs,
        "shutdown"
      )
        .then(() => {
          state = "stopped";
          return {
            state: "stopped" as const,
            alreadyStopped: false
          };
        })
        .catch((error: unknown) => {
          state = "shutdown-failed";
          throw error;
        });

      return shutdownPromise;
    }
  };
}

function withTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  phase: "start" | "shutdown"
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      reject(
        new Error(`OTLP exporter ${phase} timed out after ${timeoutMs}ms.`)
      );
    }, timeoutMs);
  });

  return Promise.race([operation, timeoutPromise]).finally(() => {
    if (timeout !== undefined) {
      clearTimeout(timeout);
    }
  });
}
