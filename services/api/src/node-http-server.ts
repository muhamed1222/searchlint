import { createServer } from "node:http";
import type { IncomingMessage, Server, ServerResponse } from "node:http";
import type { Socket } from "node:net";

import {
  createCloudHttpDispatcher,
  type CloudHttpApplication,
  type CloudHttpMethod,
  type CloudHttpRequest,
  type CloudHttpResponse
} from "./http-dispatcher.js";
import type { DistributedRateLimitStore } from "./distributed-rate-limit.js";
import {
  parseStripeWebhookEvent,
  StripeWebhookError,
  type StripeWebhookNormalizedEvent
} from "./stripe-webhook.js";
import type { Principal } from "./types.js";

export type NodeHttpPrincipalExtractor = (
  request: IncomingMessage
) => Principal | undefined | Promise<Principal | undefined>;

export type NodeHttpRequestLogEvent = {
  requestId: string;
  method: string;
  path: string;
  status: number;
  durationMs: number;
  rateLimited: boolean;
  timedOut: boolean;
};

export type NodeHttpRequestLogger = (
  event: NodeHttpRequestLogEvent
) => void | Promise<void>;

export type NodeHttpRateLimitOptions = {
  windowMs: number;
  maxRequests: number;
  key?: (request: IncomingMessage) => string | undefined;
  distributedStore?: DistributedRateLimitStore;
  clock?: {
    now(): number;
  };
};

export type NodeHttpStripeWebhookOptions = {
  signingSecret: string;
  path?: "/v1/billing/stripe/webhook";
  toleranceSeconds?: number;
  now?: () => Date;
  onEvent?: (event: StripeWebhookNormalizedEvent) => void | Promise<void>;
};

export type NodeHttpServerOptions = {
  application: CloudHttpApplication;
  extractPrincipal?: NodeHttpPrincipalExtractor;
  logger?: NodeHttpRequestLogger;
  requestIdFactory?: () => string;
  dispatchTimeoutMs?: number;
  maxBodyBytes?: number;
  rateLimit?: NodeHttpRateLimitOptions;
  stripeWebhook?: NodeHttpStripeWebhookOptions;
};

export type NodeHttpShutdownOptions = {
  gracePeriodMs?: number;
};

export type NodeHttpShutdownResult = {
  completed: boolean;
  forced: boolean;
  inFlightRequests: number;
  openSockets: number;
};

export type NodeHttpRuntime = {
  server: Server;
  shutdown(options?: NodeHttpShutdownOptions): Promise<NodeHttpShutdownResult>;
};

export type NodeHttpShutdownSignal = "SIGTERM" | "SIGINT";

export type NodeHttpShutdownSignalTarget = {
  on(signal: NodeHttpShutdownSignal, listener: () => void): unknown;
  off?(signal: NodeHttpShutdownSignal, listener: () => void): unknown;
  removeListener?(
    signal: NodeHttpShutdownSignal,
    listener: () => void
  ): unknown;
};

export type NodeHttpShutdownSignalEvent = {
  signal: NodeHttpShutdownSignal;
  result: NodeHttpShutdownResult;
};

export type NodeHttpShutdownSignalStartEvent = {
  signal: NodeHttpShutdownSignal;
};

export type NodeHttpShutdownSignalErrorEvent = {
  signal: NodeHttpShutdownSignal;
  error: unknown;
};

export type NodeHttpShutdownSignalOptions = NodeHttpShutdownOptions & {
  signals?: readonly NodeHttpShutdownSignal[];
  target?: NodeHttpShutdownSignalTarget;
  onShutdownStart?: (
    event: NodeHttpShutdownSignalStartEvent
  ) => void | Promise<void>;
  onShutdownComplete?: (
    event: NodeHttpShutdownSignalEvent
  ) => void | Promise<void>;
  onShutdownError?: (
    event: NodeHttpShutdownSignalErrorEvent
  ) => void | Promise<void>;
};

export type NodeHttpShutdownSignalBinding = {
  uninstall(): void;
  shutdownPromise(): Promise<NodeHttpShutdownResult> | undefined;
};

export type NodeHttpEcsTaskLifecycleState =
  | "ready"
  | "draining"
  | "stopped"
  | "failed";

export type NodeHttpEcsTaskLifecycleEvent = {
  state: NodeHttpEcsTaskLifecycleState;
  signal?: NodeHttpShutdownSignal;
  result?: NodeHttpShutdownResult;
  error?: unknown;
};

export type NodeHttpEcsTaskLifecycleOptions = NodeHttpShutdownOptions & {
  signals?: readonly NodeHttpShutdownSignal[];
  target?: NodeHttpShutdownSignalTarget;
  onStateChange?: (
    event: NodeHttpEcsTaskLifecycleEvent
  ) => void | Promise<void>;
};

export type NodeHttpEcsTaskLifecycleBinding = {
  uninstall(): void;
  state(): NodeHttpEcsTaskLifecycleState;
  shutdownPromise(): Promise<NodeHttpShutdownResult> | undefined;
};

export type NodeHttpProcessExitCodeSink = (exitCode: number) => void;

export type NodeHttpProcessExitPolicyOptions =
  NodeHttpEcsTaskLifecycleOptions & {
    successExitCode?: number;
    forcedExitCode?: number;
    failureExitCode?: number;
    exitCodeSink?: NodeHttpProcessExitCodeSink;
  };

export type NodeHttpProcessExitPolicyBinding = {
  uninstall(): void;
  state(): NodeHttpEcsTaskLifecycleState;
  shutdownPromise(): Promise<NodeHttpShutdownResult> | undefined;
};

const defaultMaxBodyBytes = 1024 * 1024;
const defaultShutdownGracePeriodMs = 5000;
const defaultSuccessExitCode = 0;
const defaultFailureExitCode = 1;

const supportedMethods = new Set<string>(["GET", "POST", "PATCH", "DELETE"]);
const defaultShutdownSignals: readonly NodeHttpShutdownSignal[] = [
  "SIGTERM",
  "SIGINT"
];

export function createNodeHttpServer(options: NodeHttpServerOptions): Server {
  return createNodeHttpRuntime(options).server;
}

export function createNodeHttpRuntime(
  options: NodeHttpServerOptions
): NodeHttpRuntime {
  const dispatcher = createCloudHttpDispatcher(options.application);
  const maxBodyBytes = options.maxBodyBytes ?? defaultMaxBodyBytes;
  const nextRequestId = createRequestIdFactory(options.requestIdFactory);
  const rateLimiter = options.rateLimit
    ? createRateLimiter(options.rateLimit)
    : undefined;
  const sockets = new Set<Socket>();
  const requestControllers = new Set<AbortController>();
  let shuttingDown = false;

  const server = createServer(async (nodeRequest, nodeResponse) => {
    const startedAt = Date.now();
    const url = new URL(nodeRequest.url ?? "/", "http://searchlint.local");
    const requestId = requestIdFromHeader(nodeRequest) ?? nextRequestId();
    const method = nodeRequest.method ?? "UNKNOWN";
    const requestController = new AbortController();
    let status = 500;
    let rateLimited = false;
    let timedOut = false;

    requestControllers.add(requestController);
    nodeRequest.once("aborted", () => {
      requestController.abort();
    });

    try {
      if (shuttingDown) {
        status = 503;
        writeJson(
          nodeResponse,
          errorResponse(503, "SERVER_SHUTTING_DOWN", "Server is shutting down.")
        );
        return;
      }

      if (nodeRequest.method === "GET" && url.pathname === "/healthz") {
        status = 200;
        writeJson(nodeResponse, {
          status: 200,
          body: {
            status: "ok"
          }
        });
        return;
      }

      if (!nodeRequest.method || !supportedMethods.has(nodeRequest.method)) {
        status = 405;
        writeJson(
          nodeResponse,
          errorResponse(
            405,
            "METHOD_NOT_ALLOWED",
            "HTTP method is not allowed."
          )
        );
        return;
      }

      if (rateLimiter && !(await rateLimiter.consume(nodeRequest))) {
        rateLimited = true;
        status = 429;
        writeJson(
          nodeResponse,
          errorResponse(429, "RATE_LIMITED", "Rate limit exceeded.")
        );
        return;
      }

      if (isStripeWebhookRequest(nodeRequest, url, options.stripeWebhook)) {
        const rawBody = await readRawBody(nodeRequest, maxBodyBytes);
        const dispatcherResponse = await handleStripeWebhookRequest(
          rawBody,
          nodeRequest,
          options.stripeWebhook
        );
        status = dispatcherResponse.status;
        writeJson(nodeResponse, dispatcherResponse);
        return;
      }

      const body = await readJsonBody(nodeRequest, maxBodyBytes);
      const principal = await options.extractPrincipal?.(nodeRequest);
      const request: CloudHttpRequest = {
        method: nodeRequest.method as CloudHttpMethod,
        path: `${url.pathname}${url.search}`,
        signal: requestController.signal
      };
      if (principal) {
        request.principal = principal;
      }
      if (body !== undefined) {
        request.body = body;
      }

      const dispatcherResponse = await dispatchWithTimeout(
        dispatcher(request),
        options.dispatchTimeoutMs
      );
      status = dispatcherResponse.status;
      writeJson(nodeResponse, dispatcherResponse);
    } catch (error) {
      if (error instanceof InvalidJsonBodyError) {
        status = 400;
        writeJson(
          nodeResponse,
          errorResponse(400, "INVALID_JSON", "Request body must be valid JSON.")
        );
        return;
      }

      if (error instanceof BodyTooLargeError) {
        status = 413;
        writeJson(
          nodeResponse,
          errorResponse(
            413,
            "BODY_TOO_LARGE",
            "Request body exceeds the configured byte limit."
          )
        );
        return;
      }

      if (error instanceof DispatchTimeoutError) {
        timedOut = true;
        status = 504;
        requestController.abort();
        writeJson(
          nodeResponse,
          errorResponse(504, "REQUEST_TIMEOUT", "Request processing timed out.")
        );
        return;
      }

      status = 500;
      writeJson(
        nodeResponse,
        errorResponse(500, "INTERNAL_ERROR", "Internal server error.")
      );
    } finally {
      writeLog(options.logger, {
        requestId,
        method,
        path: `${url.pathname}${url.search}`,
        status,
        durationMs: Date.now() - startedAt,
        rateLimited,
        timedOut
      });
      requestControllers.delete(requestController);
    }
  });

  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.once("close", () => {
      sockets.delete(socket);
    });
  });

  return {
    server,
    async shutdown(shutdownOptions = {}) {
      shuttingDown = true;
      for (const controller of requestControllers) {
        controller.abort();
      }

      const closed = await closeServerWithGracePeriod(
        server,
        shutdownOptions.gracePeriodMs ?? defaultShutdownGracePeriodMs
      );

      if (!closed) {
        await destroySockets(sockets);
      }

      return {
        completed: closed,
        forced: !closed,
        inFlightRequests: requestControllers.size,
        openSockets: sockets.size
      };
    }
  };
}

export function installNodeHttpShutdownSignals(
  runtime: NodeHttpRuntime,
  options: NodeHttpShutdownSignalOptions = {}
): NodeHttpShutdownSignalBinding {
  const signals = options.signals ?? defaultShutdownSignals;
  const target = options.target ?? process;
  const listeners = new Map<NodeHttpShutdownSignal, () => void>();
  let installed = true;
  let activeShutdownPromise: Promise<NodeHttpShutdownResult> | undefined;

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
      const shutdownOptions: NodeHttpShutdownOptions = {};
      if (options.gracePeriodMs !== undefined) {
        shutdownOptions.gracePeriodMs = options.gracePeriodMs;
      }
      void Promise.resolve(
        options.onShutdownStart?.({
          signal
        })
      ).catch(() => undefined);
      activeShutdownPromise = runtime
        .shutdown(shutdownOptions)
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

export function installNodeHttpEcsTaskLifecycle(
  runtime: NodeHttpRuntime,
  options: NodeHttpEcsTaskLifecycleOptions = {}
): NodeHttpEcsTaskLifecycleBinding {
  let state: NodeHttpEcsTaskLifecycleState = "ready";

  const setState = (
    event: Omit<NodeHttpEcsTaskLifecycleEvent, "state"> & {
      state: NodeHttpEcsTaskLifecycleState;
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

  const binding = installNodeHttpShutdownSignals(runtime, {
    ...(options.gracePeriodMs === undefined
      ? {}
      : { gracePeriodMs: options.gracePeriodMs }),
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

export function installNodeHttpProcessExitPolicy(
  runtime: NodeHttpRuntime,
  options: NodeHttpProcessExitPolicyOptions = {}
): NodeHttpProcessExitPolicyBinding {
  const successExitCode = options.successExitCode ?? defaultSuccessExitCode;
  const forcedExitCode = options.forcedExitCode ?? defaultFailureExitCode;
  const failureExitCode = options.failureExitCode ?? defaultFailureExitCode;
  const exitCodeSink = options.exitCodeSink ?? defaultExitCodeSink;

  const binding = installNodeHttpEcsTaskLifecycle(runtime, {
    ...(options.gracePeriodMs === undefined
      ? {}
      : { gracePeriodMs: options.gracePeriodMs }),
    ...(options.signals === undefined ? {} : { signals: options.signals }),
    ...(options.target === undefined ? {} : { target: options.target }),
    onStateChange(event) {
      void Promise.resolve(options.onStateChange?.(event)).catch(
        () => undefined
      );

      if (event.state === "stopped" && event.result) {
        exitCodeSink(event.result.forced ? forcedExitCode : successExitCode);
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

async function readJsonBody(
  request: IncomingMessage,
  maxBodyBytes: number
): Promise<unknown> {
  const rawBody = await readRawBody(request, maxBodyBytes);

  if (rawBody.byteLength === 0) {
    return undefined;
  }

  const rawBodyText = rawBody.toString("utf8");
  if (rawBodyText.trim().length === 0) {
    return undefined;
  }

  try {
    return JSON.parse(rawBodyText) as unknown;
  } catch {
    throw new InvalidJsonBodyError();
  }
}

async function readRawBody(
  request: IncomingMessage,
  maxBodyBytes: number
): Promise<Buffer> {
  let size = 0;
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk)
      ? chunk
      : Buffer.from(String(chunk), "utf8");
    size += buffer.byteLength;

    if (size > maxBodyBytes) {
      throw new BodyTooLargeError();
    }

    chunks.push(buffer);
  }

  return Buffer.concat(chunks);
}

async function handleStripeWebhookRequest(
  rawBody: Buffer,
  request: IncomingMessage,
  options: NodeHttpStripeWebhookOptions | undefined
): Promise<CloudHttpResponse> {
  if (!options) {
    return errorResponse(
      404,
      "NOT_FOUND",
      "Stripe webhook route is not configured."
    );
  }

  const signatureHeader = headerValue(request, "stripe-signature");
  if (!signatureHeader) {
    return errorResponse(
      400,
      "STRIPE_WEBHOOK_INVALID",
      "Stripe-Signature header is required."
    );
  }

  try {
    const event = parseStripeWebhookEvent(
      {
        payload: rawBody,
        signatureHeader
      },
      {
        secret: options.signingSecret,
        ...(options.now === undefined ? {} : { now: options.now }),
        ...(options.toleranceSeconds === undefined
          ? {}
          : { toleranceSeconds: options.toleranceSeconds })
      }
    );
    await options.onEvent?.(event);

    return {
      status: 202,
      body: {
        received: true,
        event: {
          id: event.id,
          type: event.type,
          idempotencyKey: event.idempotencyKey,
          intentKind: event.intent.kind
        }
      }
    };
  } catch (error) {
    if (error instanceof StripeWebhookError) {
      return errorResponse(400, "STRIPE_WEBHOOK_INVALID", error.message);
    }
    throw error;
  }
}

function isStripeWebhookRequest(
  request: IncomingMessage,
  url: URL,
  options: NodeHttpStripeWebhookOptions | undefined
): boolean {
  const path = options?.path ?? "/v1/billing/stripe/webhook";
  return request.method === "POST" && url.pathname === path;
}

function headerValue(
  request: IncomingMessage,
  headerName: string
): string | undefined {
  const value = request.headers[headerName];
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  if (Array.isArray(value)) {
    return value.find((entry) => entry.trim().length > 0)?.trim();
  }
  return undefined;
}

function writeJson(
  response: ServerResponse,
  httpResponse: CloudHttpResponse
): void {
  const body = JSON.stringify(httpResponse.body);
  response.writeHead(httpResponse.status, {
    "content-length": Buffer.byteLength(body).toString(),
    "content-type": "application/json; charset=utf-8"
  });
  response.end(body);
}

function errorResponse(
  status: number,
  code: string,
  message: string
): CloudHttpResponse {
  return {
    status,
    body: {
      error: {
        code,
        message
      }
    }
  };
}

function createRequestIdFactory(factory?: () => string): () => string {
  if (factory) {
    return factory;
  }

  let nextId = 0;
  return () => {
    nextId += 1;
    return `searchlint-${nextId}`;
  };
}

function requestIdFromHeader(request: IncomingMessage): string | undefined {
  const value = request.headers["x-request-id"];
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  if (Array.isArray(value)) {
    return value.find((entry) => entry.trim().length > 0)?.trim();
  }
  return undefined;
}

function writeLog(
  logger: NodeHttpRequestLogger | undefined,
  event: NodeHttpRequestLogEvent
): void {
  if (!logger) {
    return;
  }

  void Promise.resolve(logger(event)).catch(() => undefined);
}

function dispatchWithTimeout(
  dispatch: Promise<CloudHttpResponse>,
  timeoutMs: number | undefined
): Promise<CloudHttpResponse> {
  if (!timeoutMs || timeoutMs <= 0) {
    return dispatch;
  }

  return new Promise<CloudHttpResponse>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new DispatchTimeoutError());
    }, timeoutMs);

    dispatch.then(resolve, reject).finally(() => {
      clearTimeout(timer);
    });
  });
}

function createRateLimiter(options: NodeHttpRateLimitOptions): {
  consume(request: IncomingMessage): Promise<boolean>;
} {
  const buckets = new Map<string, { count: number; windowStartedAt: number }>();

  return {
    async consume(request) {
      const key =
        options.key?.(request) ??
        request.socket.remoteAddress ??
        "unknown-client";
      const now = options.clock?.now() ?? Date.now();

      if (options.distributedStore) {
        const decision = await options.distributedStore.consume({
          key,
          limit: options.maxRequests,
          windowMs: options.windowMs,
          now
        });
        return decision.allowed;
      }

      const bucket = buckets.get(key);

      if (!bucket || now - bucket.windowStartedAt >= options.windowMs) {
        buckets.set(key, {
          count: 1,
          windowStartedAt: now
        });
        return true;
      }

      if (bucket.count >= options.maxRequests) {
        return false;
      }

      bucket.count += 1;
      return true;
    }
  };
}

class InvalidJsonBodyError extends Error {}

class BodyTooLargeError extends Error {}

class DispatchTimeoutError extends Error {}

function removeSignalListener(
  target: NodeHttpShutdownSignalTarget,
  signal: NodeHttpShutdownSignal,
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

async function closeServerWithGracePeriod(
  server: Server,
  gracePeriodMs: number
): Promise<boolean> {
  const closeIdleConnections = (): void => {
    server.closeIdleConnections();
  };
  const idleConnectionInterval = setInterval(closeIdleConnections, 10);
  const closePromise = new Promise<boolean>((resolve, reject) => {
    if (!server.listening) {
      resolve(true);
      return;
    }

    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(true);
    });
    closeIdleConnections();
  });

  try {
    if (gracePeriodMs <= 0) {
      return await closePromise;
    }

    return await Promise.race([
      closePromise,
      new Promise<boolean>((resolve) => {
        setTimeout(() => {
          resolve(false);
        }, gracePeriodMs);
      })
    ]);
  } finally {
    clearInterval(idleConnectionInterval);
    closeIdleConnections();
  }
}

async function destroySockets(sockets: Set<Socket>): Promise<void> {
  const pendingClose = [...sockets].map(
    (socket) =>
      new Promise<void>((resolve) => {
        if (socket.destroyed) {
          resolve();
          return;
        }
        socket.once("close", () => {
          resolve();
        });
        socket.destroy();
      })
  );

  await Promise.all(pendingClose);
}
