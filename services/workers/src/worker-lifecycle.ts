import type { OutboxPollingRuntime } from "./index.js";

export type OutboxWorkerShutdownSignal = "SIGTERM" | "SIGINT";

export type OutboxWorkerShutdownSignalTarget = {
  on(signal: OutboxWorkerShutdownSignal, listener: () => void): unknown;
  off?(signal: OutboxWorkerShutdownSignal, listener: () => void): unknown;
  removeListener?(
    signal: OutboxWorkerShutdownSignal,
    listener: () => void
  ): unknown;
};

export type OutboxWorkerShutdownResult = {
  completed: boolean;
  forced: boolean;
  wasRunning: boolean;
};

export type OutboxWorkerRuntime = {
  start(): void;
  stop(): Promise<OutboxWorkerShutdownResult>;
  done(): Promise<void>;
  isRunning(): boolean;
};

export type OutboxWorkerShutdownSignalStartEvent = {
  signal: OutboxWorkerShutdownSignal;
};

export type OutboxWorkerShutdownSignalEvent = {
  signal: OutboxWorkerShutdownSignal;
  result: OutboxWorkerShutdownResult;
};

export type OutboxWorkerShutdownSignalErrorEvent = {
  signal: OutboxWorkerShutdownSignal;
  error: unknown;
};

export type OutboxWorkerShutdownSignalOptions = {
  signals?: readonly OutboxWorkerShutdownSignal[];
  target?: OutboxWorkerShutdownSignalTarget;
  onShutdownStart?: (
    event: OutboxWorkerShutdownSignalStartEvent
  ) => void | Promise<void>;
  onShutdownComplete?: (
    event: OutboxWorkerShutdownSignalEvent
  ) => void | Promise<void>;
  onShutdownError?: (
    event: OutboxWorkerShutdownSignalErrorEvent
  ) => void | Promise<void>;
};

export type OutboxWorkerShutdownSignalBinding = {
  uninstall(): void;
  shutdownPromise(): Promise<OutboxWorkerShutdownResult> | undefined;
};

export type OutboxWorkerEcsTaskLifecycleState =
  | "ready"
  | "draining"
  | "stopped"
  | "failed";

export type OutboxWorkerEcsTaskLifecycleEvent = {
  state: OutboxWorkerEcsTaskLifecycleState;
  signal?: OutboxWorkerShutdownSignal;
  result?: OutboxWorkerShutdownResult;
  error?: unknown;
};

export type OutboxWorkerEcsTaskLifecycleOptions = {
  signals?: readonly OutboxWorkerShutdownSignal[];
  target?: OutboxWorkerShutdownSignalTarget;
  onStateChange?: (
    event: OutboxWorkerEcsTaskLifecycleEvent
  ) => void | Promise<void>;
};

export type OutboxWorkerEcsTaskLifecycleBinding = {
  uninstall(): void;
  state(): OutboxWorkerEcsTaskLifecycleState;
  shutdownPromise(): Promise<OutboxWorkerShutdownResult> | undefined;
};

export type OutboxWorkerProcessExitCodeSink = (exitCode: number) => void;

export type OutboxWorkerProcessExitPolicyOptions =
  OutboxWorkerEcsTaskLifecycleOptions & {
    successExitCode?: number;
    failureExitCode?: number;
    exitCodeSink?: OutboxWorkerProcessExitCodeSink;
  };

export type OutboxWorkerProcessExitPolicyBinding = {
  uninstall(): void;
  state(): OutboxWorkerEcsTaskLifecycleState;
  shutdownPromise(): Promise<OutboxWorkerShutdownResult> | undefined;
};

const defaultShutdownSignals: readonly OutboxWorkerShutdownSignal[] = [
  "SIGTERM",
  "SIGINT"
];
const defaultSuccessExitCode = 0;
const defaultFailureExitCode = 1;

export function createOutboxWorkerRuntime(
  runtime: OutboxPollingRuntime
): OutboxWorkerRuntime {
  return {
    start() {
      runtime.start();
    },
    async stop() {
      const wasRunning = runtime.isRunning();
      await runtime.stop();
      return {
        completed: true,
        forced: false,
        wasRunning
      };
    },
    done() {
      return runtime.done();
    },
    isRunning() {
      return runtime.isRunning();
    }
  };
}

export function installOutboxWorkerShutdownSignals(
  runtime: OutboxWorkerRuntime,
  options: OutboxWorkerShutdownSignalOptions = {}
): OutboxWorkerShutdownSignalBinding {
  const signals = options.signals ?? defaultShutdownSignals;
  const target = options.target ?? process;
  const listeners = new Map<OutboxWorkerShutdownSignal, () => void>();
  let installed = true;
  let activeShutdownPromise: Promise<OutboxWorkerShutdownResult> | undefined;

  const uninstall = (): void => {
    if (!installed) {
      return;
    }
    installed = false;
    for (const [signal, listener] of listeners) {
      removeSignalListener(target, signal, listener);
    }
    listeners.clear();
  };

  for (const signal of signals) {
    const listener = (): void => {
      if (activeShutdownPromise) {
        return;
      }

      uninstall();
      void Promise.resolve(
        options.onShutdownStart?.({
          signal
        })
      ).catch(() => undefined);
      activeShutdownPromise = runtime
        .stop()
        .then(async (result) => {
          await options.onShutdownComplete?.({
            signal,
            result
          });
          return result;
        })
        .catch(async (error: unknown) => {
          await options.onShutdownError?.({
            signal,
            error
          });
          throw error;
        });
      void activeShutdownPromise.catch(() => undefined);
    };
    listeners.set(signal, listener);
    target.on(signal, listener);
  }

  return {
    uninstall,
    shutdownPromise() {
      return activeShutdownPromise;
    }
  };
}

export function installOutboxWorkerEcsTaskLifecycle(
  runtime: OutboxWorkerRuntime,
  options: OutboxWorkerEcsTaskLifecycleOptions = {}
): OutboxWorkerEcsTaskLifecycleBinding {
  let state: OutboxWorkerEcsTaskLifecycleState = "ready";

  const setState = (
    event: Omit<OutboxWorkerEcsTaskLifecycleEvent, "state"> & {
      state: OutboxWorkerEcsTaskLifecycleState;
    }
  ): void => {
    if (event.state === state) {
      return;
    }
    state = event.state;
    void Promise.resolve(options.onStateChange?.(event)).catch(() => undefined);
  };

  void Promise.resolve(
    options.onStateChange?.({
      state
    })
  ).catch(() => undefined);

  const binding = installOutboxWorkerShutdownSignals(runtime, {
    ...(options.signals === undefined ? {} : { signals: options.signals }),
    ...(options.target === undefined ? {} : { target: options.target }),
    onShutdownStart(event) {
      setState({
        state: "draining",
        signal: event.signal
      });
    },
    onShutdownComplete(event) {
      setState({
        state: "stopped",
        signal: event.signal,
        result: event.result
      });
    },
    onShutdownError(event) {
      setState({
        state: "failed",
        signal: event.signal,
        error: event.error
      });
    }
  });

  return {
    uninstall() {
      binding.uninstall();
    },
    state() {
      return state;
    },
    shutdownPromise() {
      return binding.shutdownPromise();
    }
  };
}

export function installOutboxWorkerProcessExitPolicy(
  runtime: OutboxWorkerRuntime,
  options: OutboxWorkerProcessExitPolicyOptions = {}
): OutboxWorkerProcessExitPolicyBinding {
  const successExitCode = options.successExitCode ?? defaultSuccessExitCode;
  const failureExitCode = options.failureExitCode ?? defaultFailureExitCode;
  const exitCodeSink = options.exitCodeSink ?? defaultExitCodeSink;

  const binding = installOutboxWorkerEcsTaskLifecycle(runtime, {
    ...(options.signals === undefined ? {} : { signals: options.signals }),
    ...(options.target === undefined ? {} : { target: options.target }),
    onStateChange(event) {
      void Promise.resolve(options.onStateChange?.(event)).catch(
        () => undefined
      );

      if (event.state === "stopped") {
        exitCodeSink(successExitCode);
      }
      if (event.state === "failed") {
        exitCodeSink(failureExitCode);
      }
    }
  });

  return {
    uninstall() {
      binding.uninstall();
    },
    state() {
      return binding.state();
    },
    shutdownPromise() {
      return binding.shutdownPromise();
    }
  };
}

function removeSignalListener(
  target: OutboxWorkerShutdownSignalTarget,
  signal: OutboxWorkerShutdownSignal,
  listener: () => void
): void {
  if (target.off) {
    target.off(signal, listener);
    return;
  }
  target.removeListener?.(signal, listener);
}

function defaultExitCodeSink(exitCode: number): void {
  process.exitCode = exitCode;
}
