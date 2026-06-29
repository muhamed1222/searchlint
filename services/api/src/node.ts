import type { Server } from "node:http";

import {
  createCloudApiProcess,
  type CloudApiProcess,
  type CloudApiProcessEnv,
  type CloudApiProcessOptions
} from "./cloud-api-process.js";
import type {
  NodeHttpProcessExitPolicyBinding,
  NodeHttpShutdownSignalTarget
} from "./node-http-server.js";

export type CloudApiNodeWritable = {
  write(chunk: string): void;
};

export type CloudApiNodeProcessLike = NodeHttpShutdownSignalTarget & {
  env: CloudApiProcessEnv;
  stderr: CloudApiNodeWritable;
  exitCode: string | number | null | undefined;
};

export type CloudApiNodeListenerConfig = {
  port: number;
  host?: string;
};

export type CloudApiNodeProcessFactory = (
  options: CloudApiProcessOptions
) => CloudApiProcess;

export type CloudApiNodeRunnerOptions = {
  createProcess?: CloudApiNodeProcessFactory;
};

const startupFailurePrefix = "SearchLint API failed";

export async function runSearchLintApiNodeProcess(
  processLike: CloudApiNodeProcessLike,
  options: CloudApiNodeRunnerOptions = {}
): Promise<number> {
  const createProcess = options.createProcess ?? createCloudApiProcess;
  let binding: NodeHttpProcessExitPolicyBinding | undefined;
  let apiProcess: CloudApiProcess | undefined;

  try {
    const listener = cloudApiNodeListenerConfigFromEnv(processLike.env);
    apiProcess = createProcess({
      env: processLike.env
    });
    binding = apiProcess.installLifecycle({
      signalTarget: processLike,
      exitCodeSink(exitCode) {
        processLike.exitCode = exitCode;
      }
    });

    await apiProcess.observability.start();
    await listen(apiProcess.runtime.server, listener);
    await waitForServerClose(apiProcess.runtime.server);

    const shutdownPromise = binding.shutdownPromise();
    if (shutdownPromise) {
      await shutdownPromise;
    }
    await apiProcess.observability.shutdown();

    if (processLike.exitCode === null || processLike.exitCode === undefined) {
      processLike.exitCode = 0;
    }
    return numericExitCode(processLike.exitCode);
  } catch (error) {
    await shutdownApiObservability(apiProcess);
    processLike.stderr.write(
      `${startupFailurePrefix}: ${errorMessage(error)}\n`
    );
    processLike.exitCode = 1;
    return processLike.exitCode;
  } finally {
    binding?.uninstall();
  }
}

async function shutdownApiObservability(
  apiProcess: CloudApiProcess | undefined
): Promise<void> {
  if (apiProcess === undefined) {
    return;
  }
  const state = apiProcess.observability.state();
  if (state === "stopped" || state === "shutdown-failed") {
    return;
  }
  try {
    await apiProcess.observability.shutdown();
  } catch {
    // Preserve the startup or runtime failure as the process result.
  }
}

export function cloudApiNodeListenerConfigFromEnv(
  env: CloudApiProcessEnv
): CloudApiNodeListenerConfig {
  return {
    port: portFromEnv(env),
    ...hostProperty(env)
  };
}

function portFromEnv(env: CloudApiProcessEnv): number {
  const rawPort = optionalEnv(env, "SEARCHLINT_API_PORT");
  if (rawPort === undefined) {
    throw new Error("SEARCHLINT_API_PORT is required.");
  }
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("SEARCHLINT_API_PORT must be an integer from 1 to 65535.");
  }
  return port;
}

function hostProperty(
  env: CloudApiProcessEnv
): Partial<Pick<CloudApiNodeListenerConfig, "host">> {
  const host = optionalEnv(env, "SEARCHLINT_API_HOST");
  return host === undefined ? {} : { host };
}

function optionalEnv(
  env: CloudApiProcessEnv,
  name: string
): string | undefined {
  const value = env[name]?.trim();
  return value && value.length > 0 ? value : undefined;
}

async function listen(
  server: Server,
  config: CloudApiNodeListenerConfig
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error): void => {
      cleanup();
      reject(error);
    };
    const onListening = (): void => {
      cleanup();
      resolve();
    };
    const cleanup = (): void => {
      server.off("error", onError);
      server.off("listening", onListening);
    };

    server.once("error", onError);
    server.once("listening", onListening);
    if (config.host === undefined) {
      server.listen(config.port);
    } else {
      server.listen(config.port, config.host);
    }
  });
}

async function waitForServerClose(server: Server): Promise<void> {
  if (!server.listening) {
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const onClose = (): void => {
      cleanup();
      resolve();
    };
    const onError = (error: Error): void => {
      cleanup();
      reject(error);
    };
    const cleanup = (): void => {
      server.off("close", onClose);
      server.off("error", onError);
    };

    server.once("close", onClose);
    server.once("error", onError);
  });
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
