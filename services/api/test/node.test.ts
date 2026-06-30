import { EventEmitter } from "node:events";
import type { Server } from "node:http";

import { describe, expect, it } from "vitest";

import {
  cloudApiNodeListenerConfigFromEnv,
  runSearchLintApiNodeProcess
} from "../src/index.js";
import type {
  CloudApiNodeProcessFactory,
  CloudApiNodeProcessLike,
  CloudApiProcess,
  CloudApiProcessConfig,
  NodeHttpProcessExitPolicyBinding,
  NodeHttpRuntime,
  NodeHttpShutdownSignal,
  NodeHttpShutdownSignalTarget,
  OtlpExporterLifecycle
} from "../src/index.js";

describe("cloudApiNodeListenerConfigFromEnv", () => {
  it("parses required port and optional host", () => {
    expect(
      cloudApiNodeListenerConfigFromEnv({
        SEARCHLINT_API_PORT: "8080"
      })
    ).toEqual({
      port: 8080
    });
    expect(
      cloudApiNodeListenerConfigFromEnv({
        SEARCHLINT_API_PORT: " 3000 ",
        SEARCHLINT_API_HOST: " 0.0.0.0 "
      })
    ).toEqual({
      port: 3000,
      host: "0.0.0.0"
    });
  });

  it("rejects missing or invalid listener env", () => {
    expect(() => cloudApiNodeListenerConfigFromEnv({})).toThrow(
      "SEARCHLINT_API_PORT is required."
    );
    for (const port of ["0", "65536", "1.5", "abc"]) {
      expect(() =>
        cloudApiNodeListenerConfigFromEnv({
          SEARCHLINT_API_PORT: port
        })
      ).toThrow("SEARCHLINT_API_PORT must be an integer from 1 to 65535.");
    }
  });
});

describe("runSearchLintApiNodeProcess", () => {
  it("starts the API listener and maps natural close to exit code 0", async () => {
    const processLike = new FakeNodeProcess(requiredEnv());
    const apiProcess = new FakeCloudApiProcess();

    const exitCode = await runSearchLintApiNodeProcess(processLike, {
      createProcess: createProcessFactory(apiProcess)
    });

    expect(exitCode).toBe(0);
    expect(processLike.exitCode).toBe(0);
    expect(processLike.stderr.lines).toEqual([]);
    expect(apiProcess.observability.events).toEqual(["start", "shutdown"]);
    expect(apiProcess.server.listenCalls).toEqual([
      {
        port: 8080,
        host: undefined
      }
    ]);
    expect(apiProcess.installLifecycleCalls[0]?.signalTarget).toBe(processLike);
    expect(apiProcess.binding.uninstalled).toBe(true);
  });

  it("maps observability startup failures before listen to stderr and exit code 1", async () => {
    const processLike = new FakeNodeProcess(requiredEnv());
    const apiProcess = new FakeCloudApiProcess({
      observabilityStartError: new Error("collector unavailable")
    });

    const exitCode = await runSearchLintApiNodeProcess(processLike, {
      createProcess: createProcessFactory(apiProcess)
    });

    expect(exitCode).toBe(1);
    expect(processLike.exitCode).toBe(1);
    expect(processLike.stderr.lines).toEqual([
      "SearchLint API failed: collector unavailable\n"
    ]);
    expect(apiProcess.server.listenCalls).toEqual([]);
    expect(apiProcess.observability.events).toEqual(["start", "shutdown"]);
    expect(apiProcess.binding.uninstalled).toBe(true);
  });

  it("maps observability shutdown failures to stderr and exit code 1", async () => {
    const processLike = new FakeNodeProcess(requiredEnv());
    const apiProcess = new FakeCloudApiProcess({
      observabilityShutdownError: new Error("collector shutdown failed")
    });

    const exitCode = await runSearchLintApiNodeProcess(processLike, {
      createProcess: createProcessFactory(apiProcess)
    });

    expect(exitCode).toBe(1);
    expect(processLike.exitCode).toBe(1);
    expect(processLike.stderr.lines).toEqual([
      "SearchLint API failed: collector shutdown failed\n"
    ]);
    expect(apiProcess.observability.events).toEqual(["start", "shutdown"]);
    expect(apiProcess.binding.uninstalled).toBe(true);
  });

  it("passes SEARCHLINT_API_HOST to server.listen when provided", async () => {
    const processLike = new FakeNodeProcess({
      ...requiredEnv(),
      SEARCHLINT_API_HOST: "0.0.0.0"
    });
    const apiProcess = new FakeCloudApiProcess();

    await runSearchLintApiNodeProcess(processLike, {
      createProcess: createProcessFactory(apiProcess)
    });

    expect(apiProcess.server.listenCalls).toEqual([
      {
        port: 8080,
        host: "0.0.0.0"
      }
    ]);
  });

  it("preserves lifecycle-provided exit codes", async () => {
    const processLike = new FakeNodeProcess(requiredEnv());
    const apiProcess = new FakeCloudApiProcess({
      onInstallLifecycle(bindingOptions) {
        bindingOptions.exitCodeSink?.(5);
      }
    });

    const exitCode = await runSearchLintApiNodeProcess(processLike, {
      createProcess: createProcessFactory(apiProcess)
    });

    expect(exitCode).toBe(5);
    expect(processLike.exitCode).toBe(5);
    expect(apiProcess.binding.uninstalled).toBe(true);
  });

  it("fails before process creation when listener env is invalid", async () => {
    const processLike = new FakeNodeProcess({
      ...requiredEnv(),
      SEARCHLINT_API_PORT: "0"
    });
    let created = false;

    const exitCode = await runSearchLintApiNodeProcess(processLike, {
      createProcess() {
        created = true;
        return new FakeCloudApiProcess();
      }
    });

    expect(exitCode).toBe(1);
    expect(created).toBe(false);
    expect(processLike.stderr.lines).toEqual([
      "SearchLint API failed: SEARCHLINT_API_PORT must be an integer from 1 to 65535.\n"
    ]);
  });

  it("maps startup failures to stderr and exit code 1", async () => {
    const processLike = new FakeNodeProcess(requiredEnv());

    const exitCode = await runSearchLintApiNodeProcess(processLike, {
      createProcess() {
        throw new Error("SEARCHLINT_POSTGRES_DATABASE_URL is required.");
      }
    });

    expect(exitCode).toBe(1);
    expect(processLike.exitCode).toBe(1);
    expect(processLike.stderr.lines).toEqual([
      "SearchLint API failed: SEARCHLINT_POSTGRES_DATABASE_URL is required.\n"
    ]);
  });

  it("maps listen failures to stderr, exit code 1, and lifecycle cleanup", async () => {
    const processLike = new FakeNodeProcess(requiredEnv());
    const apiProcess = new FakeCloudApiProcess({
      listenError: new Error("EADDRINUSE")
    });

    const exitCode = await runSearchLintApiNodeProcess(processLike, {
      createProcess: createProcessFactory(apiProcess)
    });

    expect(exitCode).toBe(1);
    expect(processLike.exitCode).toBe(1);
    expect(processLike.stderr.lines).toEqual([
      "SearchLint API failed: EADDRINUSE\n"
    ]);
    expect(apiProcess.binding.uninstalled).toBe(true);
  });

  it("maps server errors after listen to stderr, exit code 1, and lifecycle cleanup", async () => {
    const processLike = new FakeNodeProcess(requiredEnv());
    const apiProcess = new FakeCloudApiProcess({
      runtimeError: new Error("listener failed")
    });

    const exitCode = await runSearchLintApiNodeProcess(processLike, {
      createProcess: createProcessFactory(apiProcess)
    });

    expect(exitCode).toBe(1);
    expect(processLike.exitCode).toBe(1);
    expect(processLike.stderr.lines).toEqual([
      "SearchLint API failed: listener failed\n"
    ]);
    expect(apiProcess.binding.uninstalled).toBe(true);
  });
});

function requiredEnv(): Record<string, string> {
  return {
    SEARCHLINT_API_PORT: "8080",
    SEARCHLINT_API_RATE_LIMIT_STORE: "postgres",
    SEARCHLINT_API_RATE_LIMIT_WINDOW_MS: "60000",
    SEARCHLINT_API_RATE_LIMIT_MAX_REQUESTS: "120",
    SEARCHLINT_POSTGRES_DATABASE_URL: "postgres://searchlint.local/db",
    SEARCHLINT_COGNITO_ISSUER:
      "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_SearchLint",
    SEARCHLINT_COGNITO_AUDIENCE: "searchlint-cloud-api-client",
    SEARCHLINT_COGNITO_JWKS_URL:
      "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_SearchLint/.well-known/jwks.json",
    SEARCHLINT_COGNITO_TOKEN_USE: "access",
    SEARCHLINT_GOOGLE_OAUTH_CLIENT_ID: "google-client-id",
    SEARCHLINT_GOOGLE_OAUTH_AUTHORIZATION_ENDPOINT:
      "https://accounts.google.com/o/oauth2/v2/auth",
    SEARCHLINT_GOOGLE_OAUTH_REDIRECT_URI:
      "https://app.searchlint.example/oauth/google/callback",
    SEARCHLINT_GOOGLE_OAUTH_SCOPES:
      "openid,https://www.googleapis.com/auth/webmasters.readonly",
    SEARCHLINT_GOOGLE_OAUTH_PKCE_REQUIRED: "true",
    SEARCHLINT_YANDEX_OAUTH_CLIENT_ID: "yandex-client-id",
    SEARCHLINT_YANDEX_OAUTH_AUTHORIZATION_ENDPOINT:
      "https://oauth.yandex.com/authorize",
    SEARCHLINT_YANDEX_OAUTH_REDIRECT_URI:
      "https://app.searchlint.example/oauth/yandex/callback",
    SEARCHLINT_YANDEX_OAUTH_SCOPES: "webmaster:read metrika:read"
  };
}

function createProcessFactory(
  apiProcess: CloudApiProcess
): CloudApiNodeProcessFactory {
  return () => apiProcess;
}

class FakeCloudApiProcess implements CloudApiProcess {
  readonly config: CloudApiProcessConfig = {
    postgresPrefix: "SEARCHLINT_POSTGRES",
    postgresDatabaseUrl: "postgres://searchlint.local/db",
    stripeWebhookSigningSecret: "whsec_node_test",
    cognito: {
      issuer:
        "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_SearchLint",
      audience: "searchlint-cloud-api-client",
      jwksUrl:
        "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_SearchLint/.well-known/jwks.json",
      tokenUse: "access"
    },
    externalProviderOAuth: {
      google: {
        provider: "google",
        authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
        clientId: "google-client-id",
        redirectUri: "https://app.searchlint.example/oauth/google/callback",
        scopes: [
          "https://www.googleapis.com/auth/webmasters.readonly",
          "openid"
        ],
        pkceRequired: true
      },
      yandex: {
        provider: "yandex",
        authorizationEndpoint: "https://oauth.yandex.com/authorize",
        clientId: "yandex-client-id",
        redirectUri: "https://app.searchlint.example/oauth/yandex/callback",
        scopes: ["metrika:read", "webmaster:read"]
      }
    },
    rateLimitStore: "postgres",
    rateLimitWindowMs: 60_000,
    rateLimitMaxRequests: 120,
    observability: {
      serviceName: "searchlint-cloud-api",
      environment: "test",
      endpoint: new URL("https://otel-collector.example.com/v1/logs"),
      protocol: "http/protobuf",
      timeoutMs: 10000,
      headers: [],
      signals: ["logs", "metrics"]
    }
  };
  readonly server: FakeServer;
  readonly observability: FakeOtlpLifecycle;
  readonly runtime: NodeHttpRuntime;
  readonly binding = new FakeExitPolicyBinding();
  readonly installLifecycleCalls: Array<{
    signalTarget?: NodeHttpShutdownSignalTarget;
    exitCodeSink?: (exitCode: number) => void;
  }> = [];
  readonly onInstallLifecycle:
    | ((options: {
        signalTarget?: NodeHttpShutdownSignalTarget;
        exitCodeSink?: (exitCode: number) => void;
      }) => void)
    | undefined;

  constructor(
    options: {
      listenError?: Error;
      runtimeError?: Error;
      observabilityStartError?: Error;
      observabilityShutdownError?: Error;
      onInstallLifecycle?: (options: {
        signalTarget?: NodeHttpShutdownSignalTarget;
        exitCodeSink?: (exitCode: number) => void;
      }) => void;
    } = {}
  ) {
    this.server = new FakeServer(options);
    this.observability = new FakeOtlpLifecycle({
      ...(options.observabilityStartError === undefined
        ? {}
        : { startError: options.observabilityStartError }),
      ...(options.observabilityShutdownError === undefined
        ? {}
        : { shutdownError: options.observabilityShutdownError })
    });
    this.runtime = {
      server: this.server as unknown as Server,
      shutdown: async () => ({
        completed: true,
        forced: false,
        inFlightRequests: 0,
        openSockets: 0
      })
    };
    this.onInstallLifecycle = options.onInstallLifecycle;
  }

  installLifecycle(options: {
    signalTarget?: NodeHttpShutdownSignalTarget;
    exitCodeSink?: (exitCode: number) => void;
  }): NodeHttpProcessExitPolicyBinding {
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

class FakeServer extends EventEmitter {
  listening = false;
  readonly listenCalls: Array<{
    port: number;
    host?: string;
  }> = [];
  readonly listenError: Error | undefined;
  readonly runtimeError: Error | undefined;

  constructor(
    options: {
      listenError?: Error;
      runtimeError?: Error;
    } = {}
  ) {
    super();
    this.listenError = options.listenError;
    this.runtimeError = options.runtimeError;
  }

  listen(port: number, hostOrListener?: string | (() => void)): this {
    const host =
      typeof hostOrListener === "string" ? hostOrListener : undefined;
    this.listenCalls.push({
      port,
      ...(host === undefined ? {} : { host })
    });

    queueMicrotask(() => {
      if (this.listenError) {
        this.emit("error", this.listenError);
        return;
      }
      this.listening = true;
      this.emit("listening");
      setTimeout(() => {
        if (this.runtimeError) {
          this.emit("error", this.runtimeError);
          return;
        }
        this.listening = false;
        this.emit("close");
      }, 0);
    });

    return this;
  }
}

class FakeExitPolicyBinding implements NodeHttpProcessExitPolicyBinding {
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

class FakeNodeProcess implements CloudApiNodeProcessLike {
  readonly stderr = new MemoryWriter();
  exitCode: number | undefined;
  readonly listeners = new Map<NodeHttpShutdownSignal, Set<() => void>>();

  constructor(readonly env: Record<string, string>) {}

  on(signal: NodeHttpShutdownSignal, listener: () => void): void {
    const listeners = this.listeners.get(signal) ?? new Set<() => void>();
    listeners.add(listener);
    this.listeners.set(signal, listeners);
  }

  off(signal: NodeHttpShutdownSignal, listener: () => void): void {
    this.listeners.get(signal)?.delete(listener);
  }
}

class MemoryWriter {
  readonly lines: string[] = [];

  write(chunk: string): void {
    this.lines.push(chunk);
  }
}
