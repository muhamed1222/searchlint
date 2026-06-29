import { createHmac, createSign, generateKeyPairSync } from "node:crypto";
import { createConnection } from "node:net";
import type { AddressInfo } from "node:net";

import { afterEach, describe, expect, it } from "vitest";

import {
  createCognitoPrincipalExtractor,
  createNodeHttpRuntime,
  createNodeHttpServer,
  installNodeHttpEcsTaskLifecycle,
  installNodeHttpProcessExitPolicy,
  installNodeHttpShutdownSignals
} from "../src/index.js";
import type {
  CloudHttpApplication,
  CognitoJsonWebKeySet,
  CognitoJwtPayload,
  DistributedRateLimitStore,
  NodeHttpRuntime,
  NodeHttpEcsTaskLifecycleEvent,
  NodeHttpRequestLogEvent,
  NodeHttpShutdownResult,
  NodeHttpShutdownSignal,
  NodeHttpShutdownSignalTarget,
  Principal,
  RequestCrawlInput,
  StripeWebhookNormalizedEvent
} from "../src/index.js";

const principal: Principal = {
  id: "principal-1",
  externalSubject: "cognito|principal-1"
};
const cognitoIssuer =
  "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_searchlint";
const cognitoAudience = "searchlint-cloud-api";
const cognitoNow = new Date("2026-06-21T12:00:00.000Z");
const cognitoNowSeconds = Math.floor(cognitoNow.getTime() / 1000);
const cognitoKeyPair = generateKeyPairSync("rsa", {
  modulusLength: 2048
});
const cognitoPublicJwk = cognitoKeyPair.publicKey.export({ format: "jwk" });
const cognitoJwks: CognitoJsonWebKeySet = {
  keys: [
    {
      ...cognitoPublicJwk,
      kid: "searchlint-node-http-key-1",
      alg: "RS256",
      use: "sig"
    }
  ]
};

const servers: Array<ReturnType<typeof createNodeHttpServer>> = [];
const stripeWebhookSecret = "whsec_node_http_test";
const stripeWebhookTimestamp = 1_783_000_000;
const stripeWebhookNow = () => new Date(stripeWebhookTimestamp * 1000);

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => closeServer(server)));
});

describe("createNodeHttpServer", () => {
  it("returns a health response without requiring a principal", async () => {
    const baseUrl = await listen(
      createNodeHttpServer({ application: createApplication() })
    );

    const response = await fetch(`${baseUrl}/healthz`);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "application/json; charset=utf-8"
    );
    await expect(response.json()).resolves.toEqual({
      status: "ok"
    });
  });

  it("accepts signed Stripe webhook requests without a principal or JSON pre-parsing", async () => {
    const events: StripeWebhookNormalizedEvent[] = [];
    const calls: string[] = [];
    const payload = JSON.stringify(stripeSubscriptionEvent());
    const baseUrl = await listen(
      createNodeHttpServer({
        application: createApplication({
          async createOrganization(input) {
            calls.push(input.name);
            return createOrganizationResult(input.name, input.actor.id);
          }
        }),
        stripeWebhook: {
          signingSecret: stripeWebhookSecret,
          now: stripeWebhookNow,
          onEvent(event) {
            events.push(event);
          }
        }
      })
    );

    const response = await fetch(`${baseUrl}/v1/billing/stripe/webhook`, {
      method: "POST",
      headers: {
        "stripe-signature": stripeSignatureHeader(payload)
      },
      body: payload
    });

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({
      received: true,
      event: {
        id: "evt_node_http_subscription",
        type: "customer.subscription.updated",
        idempotencyKey: "evt_node_http_subscription",
        intentKind: "subscription-entitlement-update"
      }
    });
    expect(events).toHaveLength(1);
    expect(events[0]?.intent.kind).toBe("subscription-entitlement-update");
    expect(calls).toEqual([]);
  });

  it("accepts signed Stripe invoice webhook requests", async () => {
    const payload = JSON.stringify(stripeInvoiceEvent());
    const baseUrl = await listen(
      createNodeHttpServer({
        application: createApplication(),
        stripeWebhook: {
          signingSecret: stripeWebhookSecret,
          now: stripeWebhookNow
        }
      })
    );

    const response = await fetch(`${baseUrl}/v1/billing/stripe/webhook`, {
      method: "POST",
      headers: {
        "stripe-signature": stripeSignatureHeader(payload)
      },
      body: payload
    });

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({
      received: true,
      event: {
        id: "evt_node_http_invoice",
        type: "invoice.payment_succeeded",
        idempotencyKey: "evt_node_http_invoice",
        intentKind: "payment-signal"
      }
    });
  });

  it("returns 400 for Stripe webhook requests without a signature header", async () => {
    const baseUrl = await listen(
      createNodeHttpServer({
        application: createApplication(),
        stripeWebhook: {
          signingSecret: stripeWebhookSecret,
          now: stripeWebhookNow
        }
      })
    );

    const response = await fetch(`${baseUrl}/v1/billing/stripe/webhook`, {
      method: "POST",
      body: JSON.stringify(stripeSubscriptionEvent())
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "STRIPE_WEBHOOK_INVALID",
        message: "Stripe-Signature header is required."
      }
    });
  });

  it("returns 400 for Stripe webhook requests with invalid signatures", async () => {
    const payload = JSON.stringify(stripeSubscriptionEvent());
    const baseUrl = await listen(
      createNodeHttpServer({
        application: createApplication(),
        stripeWebhook: {
          signingSecret: stripeWebhookSecret,
          now: stripeWebhookNow
        }
      })
    );

    const response = await fetch(`${baseUrl}/v1/billing/stripe/webhook`, {
      method: "POST",
      headers: {
        "stripe-signature": `t=${stripeWebhookTimestamp},v1=${"0".repeat(64)}`
      },
      body: payload
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "STRIPE_WEBHOOK_INVALID",
        message: "Stripe webhook signature does not match the payload."
      }
    });
  });

  it("dispatches JSON requests to the cloud HTTP dispatcher", async () => {
    const baseUrl = await listen(
      createNodeHttpServer({
        application: createApplication(),
        extractPrincipal() {
          return principal;
        }
      })
    );

    const response = await fetch(`${baseUrl}/v1/organizations`, {
      method: "POST",
      body: JSON.stringify({
        name: "Acme"
      })
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      organization: {
        id: "org-1",
        name: "Acme"
      },
      membership: {
        principalId: principal.id,
        role: "owner"
      }
    });
  });

  it("passes missing principals through the dispatcher authentication path", async () => {
    const baseUrl = await listen(
      createNodeHttpServer({
        application: createApplication()
      })
    );

    const response = await fetch(`${baseUrl}/v1/organizations`, {
      method: "POST",
      body: JSON.stringify({
        name: "Acme"
      })
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "UNAUTHENTICATED"
      }
    });
  });

  it("authenticates Cognito bearer tokens through the Node HTTP dispatcher path", async () => {
    const baseUrl = await listen(
      createNodeHttpServer({
        application: createApplication(),
        extractPrincipal: createCognitoPrincipalExtractor(
          cognitoExtractorOptions()
        )
      })
    );
    const token = signCognitoToken({
      sub: "cognito-user-123",
      email: "developer@example.com"
    });

    const response = await fetch(`${baseUrl}/v1/organizations`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        name: "Acme"
      })
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      membership: {
        principalId: "cognito-user-123"
      }
    });
  });

  it("returns 401 for missing Cognito bearer credentials before application dispatch", async () => {
    const calls: string[] = [];
    const baseUrl = await listen(
      createNodeHttpServer({
        application: createApplication({
          async createOrganization(input) {
            calls.push(input.name);
            return createOrganizationResult(input.name, input.actor.id);
          }
        }),
        extractPrincipal: createCognitoPrincipalExtractor(
          cognitoExtractorOptions()
        )
      })
    );

    const response = await fetch(`${baseUrl}/v1/organizations`, {
      method: "POST",
      body: JSON.stringify({
        name: "Acme"
      })
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "UNAUTHENTICATED"
      }
    });
    expect(calls).toEqual([]);
  });

  it("returns 401 for invalid Cognito bearer credentials before application dispatch", async () => {
    const calls: string[] = [];
    const baseUrl = await listen(
      createNodeHttpServer({
        application: createApplication({
          async createOrganization(input) {
            calls.push(input.name);
            return createOrganizationResult(input.name, input.actor.id);
          }
        }),
        extractPrincipal: createCognitoPrincipalExtractor(
          cognitoExtractorOptions()
        )
      })
    );
    const token = invalidCognitoSignature(
      signCognitoToken({
        sub: "cognito-user-123"
      })
    );

    const response = await fetch(`${baseUrl}/v1/organizations`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        name: "Acme"
      })
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "UNAUTHENTICATED"
      }
    });
    expect(calls).toEqual([]);
  });

  it("returns 400 for invalid JSON before application dispatch", async () => {
    const calls: string[] = [];
    const baseUrl = await listen(
      createNodeHttpServer({
        application: createApplication({
          async createOrganization(input) {
            calls.push(input.name);
            return createOrganizationResult(input.name, input.actor.id);
          }
        }),
        extractPrincipal() {
          return principal;
        }
      })
    );

    const response = await fetch(`${baseUrl}/v1/organizations`, {
      method: "POST",
      body: "{"
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "INVALID_JSON"
      }
    });
    expect(calls).toEqual([]);
  });

  it("returns 405 for unsupported HTTP methods", async () => {
    const baseUrl = await listen(
      createNodeHttpServer({
        application: createApplication()
      })
    );

    const response = await fetch(`${baseUrl}/v1/organizations`, {
      method: "PUT"
    });

    expect(response.status).toBe(405);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "METHOD_NOT_ALLOWED"
      }
    });
  });

  it("returns 413 for oversized bodies before application dispatch", async () => {
    const calls: string[] = [];
    const baseUrl = await listen(
      createNodeHttpServer({
        application: createApplication({
          async createOrganization(input) {
            calls.push(input.name);
            return createOrganizationResult(input.name, input.actor.id);
          }
        }),
        extractPrincipal() {
          return principal;
        },
        maxBodyBytes: 4
      })
    );

    const response = await fetch(`${baseUrl}/v1/organizations`, {
      method: "POST",
      body: JSON.stringify({
        name: "Acme"
      })
    });

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "BODY_TOO_LARGE"
      }
    });
    expect(calls).toEqual([]);
  });

  it("reuses incoming request IDs in structured request logs", async () => {
    const logs: NodeHttpRequestLogEvent[] = [];
    const baseUrl = await listen(
      createNodeHttpServer({
        application: createApplication(),
        logger(event) {
          logs.push(event);
        },
        extractPrincipal() {
          return principal;
        }
      })
    );

    const response = await fetch(`${baseUrl}/v1/organizations`, {
      method: "POST",
      headers: {
        "x-request-id": "request-123"
      },
      body: JSON.stringify({
        name: "Acme"
      })
    });

    expect(response.status).toBe(201);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      requestId: "request-123",
      method: "POST",
      path: "/v1/organizations",
      status: 201,
      rateLimited: false,
      timedOut: false
    });
    expect(logs[0]?.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("uses the configured request ID factory when the header is missing", async () => {
    const logs: NodeHttpRequestLogEvent[] = [];
    const baseUrl = await listen(
      createNodeHttpServer({
        application: createApplication(),
        logger(event) {
          logs.push(event);
        },
        requestIdFactory() {
          return "generated-request-1";
        }
      })
    );

    const response = await fetch(`${baseUrl}/healthz`);

    expect(response.status).toBe(200);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      requestId: "generated-request-1",
      method: "GET",
      path: "/healthz",
      status: 200
    });
  });

  it("does not fail requests when the structured logger rejects", async () => {
    const baseUrl = await listen(
      createNodeHttpServer({
        application: createApplication(),
        async logger() {
          throw new Error("log sink unavailable");
        }
      })
    );

    const response = await fetch(`${baseUrl}/healthz`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: "ok"
    });
  });

  it("returns 504 when dispatcher processing exceeds the configured timeout", async () => {
    const logs: NodeHttpRequestLogEvent[] = [];
    const baseUrl = await listen(
      createNodeHttpServer({
        application: createApplication({
          async createOrganization(input) {
            await wait(25);
            return createOrganizationResult(input.name, input.actor.id);
          }
        }),
        dispatchTimeoutMs: 1,
        logger(event) {
          logs.push(event);
        },
        extractPrincipal() {
          return principal;
        }
      })
    );

    const response = await fetch(`${baseUrl}/v1/organizations`, {
      method: "POST",
      body: JSON.stringify({
        name: "Acme"
      })
    });

    expect(response.status).toBe(504);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "REQUEST_TIMEOUT"
      }
    });
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      status: 504,
      timedOut: true
    });
  });

  it("returns 429 for rate-limited requests before body parsing or application dispatch", async () => {
    const calls: string[] = [];
    const logs: NodeHttpRequestLogEvent[] = [];
    const baseUrl = await listen(
      createNodeHttpServer({
        application: createApplication({
          async createOrganization(input) {
            calls.push(input.name);
            return createOrganizationResult(input.name, input.actor.id);
          }
        }),
        logger(event) {
          logs.push(event);
        },
        rateLimit: {
          windowMs: 1000,
          maxRequests: 1,
          key() {
            return "tenant-1";
          }
        },
        extractPrincipal() {
          return principal;
        }
      })
    );

    const firstResponse = await fetch(`${baseUrl}/v1/organizations`, {
      method: "POST",
      body: JSON.stringify({
        name: "Acme"
      })
    });
    const secondResponse = await fetch(`${baseUrl}/v1/organizations`, {
      method: "POST",
      body: "{"
    });

    expect(firstResponse.status).toBe(201);
    expect(secondResponse.status).toBe(429);
    await expect(secondResponse.json()).resolves.toMatchObject({
      error: {
        code: "RATE_LIMITED"
      }
    });
    expect(calls).toEqual(["Acme"]);
    expect(logs).toHaveLength(2);
    expect(logs[1]).toMatchObject({
      status: 429,
      rateLimited: true
    });
  });

  it("uses an injected distributed rate-limit store before body parsing or application dispatch", async () => {
    const calls: string[] = [];
    const logs: NodeHttpRequestLogEvent[] = [];
    const decisions: string[] = [];
    const distributedStore: DistributedRateLimitStore = {
      async consume(input) {
        decisions.push(`${input.key}:${input.limit}:${input.windowMs}`);
        return {
          allowed: false,
          remaining: 0,
          resetAt: input.now + input.windowMs,
          reason: "distributed limit exceeded"
        };
      }
    };
    const baseUrl = await listen(
      createNodeHttpServer({
        application: createApplication({
          async createOrganization(input) {
            calls.push(input.name);
            return createOrganizationResult(input.name, input.actor.id);
          }
        }),
        logger(event) {
          logs.push(event);
        },
        rateLimit: {
          windowMs: 1000,
          maxRequests: 10,
          distributedStore,
          clock: {
            now() {
              return 5000;
            }
          },
          key() {
            return "org:distributed";
          }
        },
        extractPrincipal() {
          return principal;
        }
      })
    );

    const response = await fetch(`${baseUrl}/v1/organizations`, {
      method: "POST",
      body: "{"
    });

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "RATE_LIMITED"
      }
    });
    expect(decisions).toEqual(["org:distributed:10:1000"]);
    expect(calls).toEqual([]);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      status: 429,
      rateLimited: true
    });
  });

  it("forwards request abort signals to application operations", async () => {
    let receivedSignal: AbortSignal | undefined;
    const baseUrl = await listen(
      createNodeHttpServer({
        application: createApplication({
          async createOrganization(input) {
            receivedSignal = input.signal;
            return createOrganizationResult(input.name, input.actor.id);
          }
        }),
        extractPrincipal() {
          return principal;
        }
      })
    );

    const response = await fetch(`${baseUrl}/v1/organizations`, {
      method: "POST",
      body: JSON.stringify({
        name: "Acme"
      })
    });

    expect(response.status).toBe(201);
    expect(receivedSignal).toBeInstanceOf(AbortSignal);
    expect(receivedSignal?.aborted).toBe(false);
  });

  it("aborts in-flight request signals during graceful shutdown", async () => {
    let observedAbort = false;
    let resolveOperationEntered: () => void = () => undefined;
    const operationEntered = new Promise<void>((resolve) => {
      resolveOperationEntered = resolve;
    });
    const runtime = createNodeHttpRuntime({
      application: createApplication({
        async createOrganization(input) {
          if (!input.signal) {
            throw new Error("expected request signal");
          }
          resolveOperationEntered();
          await new Promise<void>((resolve) => {
            input.signal?.addEventListener(
              "abort",
              () => {
                observedAbort = true;
                resolve();
              },
              { once: true }
            );
          });
          return createOrganizationResult(input.name, input.actor.id);
        }
      }),
      extractPrincipal() {
        return principal;
      }
    });
    const baseUrl = await listen(runtime.server);
    const request = fetch(`${baseUrl}/v1/organizations`, {
      method: "POST",
      body: JSON.stringify({
        name: "Acme"
      })
    });

    await operationEntered;
    const shutdown = runtime.shutdown({
      gracePeriodMs: 1000
    });
    const response = await request;
    const shutdownResult = await shutdown;

    expect(observedAbort).toBe(true);
    expect(response.status).toBe(201);
    expect(shutdownResult).toMatchObject({
      completed: true,
      forced: false,
      inFlightRequests: 0
    });
    expect(runtime.server.listening).toBe(false);
  });

  it("destroys remaining sockets when graceful shutdown exceeds its grace period", async () => {
    const runtime = createNodeHttpRuntime({
      application: createApplication(),
      extractPrincipal() {
        return principal;
      }
    });
    const baseUrl = await listen(runtime.server);
    const port = new URL(baseUrl).port;
    const socket = createConnection({
      host: "127.0.0.1",
      port: Number(port)
    });
    await new Promise<void>((resolve) => {
      socket.once("connect", resolve);
    });
    const socketClosed = new Promise<void>((resolve) => {
      socket.once("close", resolve);
    });
    socket.write(
      [
        "POST /v1/organizations HTTP/1.1",
        "Host: 127.0.0.1",
        "Content-Length: 100",
        "",
        "{"
      ].join("\r\n")
    );

    await wait(5);
    const shutdownResult = await runtime.shutdown({
      gracePeriodMs: 1
    });

    expect(shutdownResult).toMatchObject({
      completed: false,
      forced: true,
      openSockets: 0
    });
    await socketClosed;
    expect(socket.destroyed).toBe(true);
  });
});

describe("installNodeHttpShutdownSignals", () => {
  it("registers SIGTERM and SIGINT by default", () => {
    const target = new FakeSignalTarget();
    const binding = installNodeHttpShutdownSignals(createShutdownRuntime(), {
      target
    });

    expect(target.listenerCount("SIGTERM")).toBe(1);
    expect(target.listenerCount("SIGINT")).toBe(1);

    binding.uninstall();
  });

  it("runs runtime shutdown once for the first signal and removes listeners", async () => {
    const target = new FakeSignalTarget();
    const calls: Array<{ gracePeriodMs: number | undefined }> = [];
    const binding = installNodeHttpShutdownSignals(
      createShutdownRuntime({
        async shutdown(options) {
          calls.push({
            gracePeriodMs: options?.gracePeriodMs
          });
          return shutdownResult();
        }
      }),
      {
        target,
        gracePeriodMs: 250
      }
    );

    target.emit("SIGTERM");
    target.emit("SIGINT");
    const result = await binding.shutdownPromise();

    expect(result).toEqual(shutdownResult());
    expect(calls).toEqual([{ gracePeriodMs: 250 }]);
    expect(target.listenerCount("SIGTERM")).toBe(0);
    expect(target.listenerCount("SIGINT")).toBe(0);
  });

  it("does not shut down after uninstall", () => {
    const target = new FakeSignalTarget();
    const calls: string[] = [];
    const binding = installNodeHttpShutdownSignals(
      createShutdownRuntime({
        async shutdown() {
          calls.push("shutdown");
          return shutdownResult();
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

  it("reports shutdown completion through the configured callback", async () => {
    const target = new FakeSignalTarget();
    const events: Array<{
      signal: NodeHttpShutdownSignal;
      result: NodeHttpShutdownResult;
    }> = [];
    const binding = installNodeHttpShutdownSignals(createShutdownRuntime(), {
      target,
      onShutdownComplete(event) {
        events.push(event);
      }
    });

    target.emit("SIGINT");
    await binding.shutdownPromise();

    expect(events).toEqual([
      {
        signal: "SIGINT",
        result: shutdownResult()
      }
    ]);
  });

  it("reports shutdown errors through the configured callback", async () => {
    const target = new FakeSignalTarget();
    const error = new Error("shutdown failed");
    const errors: unknown[] = [];
    const binding = installNodeHttpShutdownSignals(
      createShutdownRuntime({
        async shutdown() {
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

describe("installNodeHttpEcsTaskLifecycle", () => {
  it("reports ready immediately after installation", () => {
    const target = new FakeSignalTarget();
    const events: NodeHttpEcsTaskLifecycleEvent[] = [];
    const binding = installNodeHttpEcsTaskLifecycle(createShutdownRuntime(), {
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

  it("reports draining before successful shutdown and stopped after completion", async () => {
    const target = new FakeSignalTarget();
    const events: NodeHttpEcsTaskLifecycleEvent[] = [];
    let resolveShutdown: (result: NodeHttpShutdownResult) => void = () =>
      undefined;
    const shutdown = new Promise<NodeHttpShutdownResult>((resolve) => {
      resolveShutdown = resolve;
    });
    const binding = installNodeHttpEcsTaskLifecycle(
      createShutdownRuntime({
        async shutdown() {
          return shutdown;
        }
      }),
      {
        target,
        gracePeriodMs: 750,
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

    resolveShutdown(shutdownResult());
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
        result: shutdownResult()
      }
    ]);
  });

  it("reuses duplicate signal shutdown without duplicate lifecycle transitions", async () => {
    const target = new FakeSignalTarget();
    const events: NodeHttpEcsTaskLifecycleEvent[] = [];
    const calls: string[] = [];
    const binding = installNodeHttpEcsTaskLifecycle(
      createShutdownRuntime({
        async shutdown() {
          calls.push("shutdown");
          return shutdownResult();
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
    target.emit("SIGINT");
    await binding.shutdownPromise();

    expect(calls).toEqual(["shutdown"]);
    expect(events.map((event) => event.state)).toEqual([
      "ready",
      "draining",
      "stopped"
    ]);
  });

  it("does not shut down after uninstall", () => {
    const target = new FakeSignalTarget();
    const calls: string[] = [];
    const binding = installNodeHttpEcsTaskLifecycle(
      createShutdownRuntime({
        async shutdown() {
          calls.push("shutdown");
          return shutdownResult();
        }
      }),
      {
        target
      }
    );

    binding.uninstall();
    target.emit("SIGTERM");

    expect(binding.state()).toBe("ready");
    expect(binding.shutdownPromise()).toBeUndefined();
    expect(calls).toEqual([]);
  });

  it("reports failed when shutdown rejects and preserves the rejection", async () => {
    const target = new FakeSignalTarget();
    const error = new Error("shutdown failed");
    const events: NodeHttpEcsTaskLifecycleEvent[] = [];
    const binding = installNodeHttpEcsTaskLifecycle(
      createShutdownRuntime({
        async shutdown() {
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

describe("installNodeHttpProcessExitPolicy", () => {
  it("sets exit code 0 after successful graceful shutdown", async () => {
    const target = new FakeSignalTarget();
    const exitCodes: number[] = [];
    const binding = installNodeHttpProcessExitPolicy(createShutdownRuntime(), {
      target,
      exitCodeSink(exitCode) {
        exitCodes.push(exitCode);
      }
    });

    target.emit("SIGTERM");
    await binding.shutdownPromise();

    expect(binding.state()).toBe("stopped");
    expect(exitCodes).toEqual([0]);
  });

  it("sets exit code 1 after forced shutdown", async () => {
    const target = new FakeSignalTarget();
    const exitCodes: number[] = [];
    const binding = installNodeHttpProcessExitPolicy(
      createShutdownRuntime({
        async shutdown() {
          return {
            completed: false,
            forced: true,
            inFlightRequests: 1,
            openSockets: 1
          };
        }
      }),
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
    expect(exitCodes).toEqual([1]);
  });

  it("sets exit code 1 and preserves rejection after failed shutdown", async () => {
    const target = new FakeSignalTarget();
    const error = new Error("shutdown failed");
    const exitCodes: number[] = [];
    const binding = installNodeHttpProcessExitPolicy(
      createShutdownRuntime({
        async shutdown() {
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

  it("supports custom success, forced, and failure exit codes", async () => {
    const successTarget = new FakeSignalTarget();
    const forcedTarget = new FakeSignalTarget();
    const failureTarget = new FakeSignalTarget();
    const exitCodes: number[] = [];

    const success = installNodeHttpProcessExitPolicy(createShutdownRuntime(), {
      target: successTarget,
      successExitCode: 10,
      forcedExitCode: 20,
      failureExitCode: 30,
      exitCodeSink(exitCode) {
        exitCodes.push(exitCode);
      }
    });
    const forced = installNodeHttpProcessExitPolicy(
      createShutdownRuntime({
        async shutdown() {
          return {
            completed: false,
            forced: true,
            inFlightRequests: 0,
            openSockets: 0
          };
        }
      }),
      {
        target: forcedTarget,
        successExitCode: 10,
        forcedExitCode: 20,
        failureExitCode: 30,
        exitCodeSink(exitCode) {
          exitCodes.push(exitCode);
        }
      }
    );
    const failure = installNodeHttpProcessExitPolicy(
      createShutdownRuntime({
        async shutdown() {
          throw new Error("shutdown failed");
        }
      }),
      {
        target: failureTarget,
        successExitCode: 10,
        forcedExitCode: 20,
        failureExitCode: 30,
        exitCodeSink(exitCode) {
          exitCodes.push(exitCode);
        }
      }
    );

    successTarget.emit("SIGTERM");
    forcedTarget.emit("SIGTERM");
    failureTarget.emit("SIGTERM");
    await success.shutdownPromise();
    await forced.shutdownPromise();
    await expect(failure.shutdownPromise()).rejects.toThrow("shutdown failed");

    expect(exitCodes).toEqual([10, 20, 30]);
  });

  it("does not set duplicate exit codes for duplicate signals", async () => {
    const target = new FakeSignalTarget();
    const exitCodes: number[] = [];
    const binding = installNodeHttpProcessExitPolicy(createShutdownRuntime(), {
      target,
      exitCodeSink(exitCode) {
        exitCodes.push(exitCode);
      }
    });

    target.emit("SIGTERM");
    target.emit("SIGINT");
    await binding.shutdownPromise();

    expect(exitCodes).toEqual([0]);
  });

  it("does not set an exit code after uninstall", () => {
    const target = new FakeSignalTarget();
    const exitCodes: number[] = [];
    const binding = installNodeHttpProcessExitPolicy(createShutdownRuntime(), {
      target,
      exitCodeSink(exitCode) {
        exitCodes.push(exitCode);
      }
    });

    binding.uninstall();
    target.emit("SIGTERM");

    expect(binding.shutdownPromise()).toBeUndefined();
    expect(binding.state()).toBe("ready");
    expect(exitCodes).toEqual([]);
  });
});

async function listen(
  server: ReturnType<typeof createNodeHttpServer>
): Promise<string> {
  servers.push(server);
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}`;
}

async function closeServer(
  server: ReturnType<typeof createNodeHttpServer>
): Promise<void> {
  if (!server.listening) {
    return;
  }
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

function createApplication(
  overrides: Partial<CloudHttpApplication> = {}
): CloudHttpApplication {
  return {
    async createOrganization(input) {
      return createOrganizationResult(input.name, input.actor.id);
    },
    async addMember(input) {
      return {
        id: "membership-1",
        organizationId: input.organizationId,
        principalId: input.principalId,
        role: input.role,
        createdAt: "2026-06-21T00:00:00.000Z"
      };
    },
    async createProject(input) {
      return {
        id: "project-1",
        organizationId: input.organizationId,
        name: input.name,
        siteUrl: input.siteUrl,
        createdAt: "2026-06-21T00:00:00.000Z"
      };
    },
    async createEnvironment(input) {
      return {
        id: "env-1",
        organizationId: input.organizationId,
        projectId: input.projectId,
        name: input.name,
        baseUrl: input.baseUrl,
        createdAt: "2026-06-21T00:00:00.000Z"
      };
    },
    async requestCrawl(input: RequestCrawlInput) {
      return {
        crawlRequest: {
          id: "crawl-1",
          organizationId: input.organizationId,
          projectId: input.projectId,
          environmentId: input.environmentId,
          requestedBy: input.actor.id,
          maxUrls: input.maxUrls,
          status: "queued",
          createdAt: "2026-06-21T00:00:00.000Z"
        },
        jobId: "job-1"
      };
    },
    async getDashboardSnapshot(input) {
      return {
        organization: {
          id: input.organizationId
        },
        project: {
          id: input.projectId
        },
        environment: {
          id: input.environmentId
        }
      };
    },
    async completeExternalProviderOAuthConnection(input) {
      return {
        oauthConnection: {
          id: "oauth-1",
          organizationId: input.organizationId,
          projectId: input.projectId,
          environmentId: input.environmentId,
          provider: input.provider
        }
      };
    },
    async startExternalProviderOAuthConnection(input) {
      return {
        provider: input.provider,
        authorizationUrl: `https://provider.example/${input.provider}/authorize`,
        state: input.state
      };
    },
    ...overrides
  };
}

function createOrganizationResult(name: string, principalId: string) {
  return {
    organization: {
      id: "org-1",
      name,
      createdAt: "2026-06-21T00:00:00.000Z"
    },
    membership: {
      id: "membership-1",
      organizationId: "org-1",
      principalId,
      role: "owner" as const,
      createdAt: "2026-06-21T00:00:00.000Z"
    }
  };
}

function stripeSubscriptionEvent() {
  return {
    id: "evt_node_http_subscription",
    type: "customer.subscription.updated",
    created: stripeWebhookTimestamp,
    data: {
      object: {
        id: "sub_node_http",
        status: "active",
        customer: "cus_node_http",
        current_period_start: 1_780_272_000,
        current_period_end: 1_782_864_000,
        items: {
          data: [
            {
              price: {
                lookup_key: "searchlint_team_monthly"
              }
            }
          ]
        }
      }
    }
  };
}

function stripeInvoiceEvent() {
  return {
    id: "evt_node_http_invoice",
    type: "invoice.payment_succeeded",
    created: stripeWebhookTimestamp,
    data: {
      object: {
        id: "in_node_http",
        customer: "cus_node_http",
        subscription: "sub_node_http"
      }
    }
  };
}

function stripeSignatureHeader(payload: string): string {
  return `t=${stripeWebhookTimestamp},v1=${stripeSignature(payload)}`;
}

function stripeSignature(payload: string): string {
  return createHmac("sha256", stripeWebhookSecret)
    .update(`${stripeWebhookTimestamp}.${payload}`)
    .digest("hex");
}

function cognitoExtractorOptions() {
  return {
    issuer: cognitoIssuer,
    audience: cognitoAudience,
    tokenUse: "access" as const,
    jwks() {
      return cognitoJwks;
    },
    clock() {
      return cognitoNow;
    }
  };
}

function signCognitoToken(
  overrides: Partial<CognitoJwtPayload>,
  headerOverrides: { kid?: string; alg?: string; issuer?: string } = {}
): string {
  const header = {
    alg: headerOverrides.alg ?? "RS256",
    kid: headerOverrides.kid ?? "searchlint-node-http-key-1",
    typ: "JWT"
  };
  const payload: CognitoJwtPayload = {
    iss: headerOverrides.issuer ?? cognitoIssuer,
    sub: "cognito-user-123",
    aud: cognitoAudience,
    token_use: "access",
    exp: cognitoNowSeconds + 300,
    nbf: cognitoNowSeconds - 30,
    iat: cognitoNowSeconds,
    ...overrides
  };
  const signingInput = `${base64UrlJson(header)}.${base64UrlJson(payload)}`;
  const signature = createSign("RSA-SHA256")
    .update(signingInput)
    .end()
    .sign(cognitoKeyPair.privateKey)
    .toString("base64url");

  return `${signingInput}.${signature}`;
}

function invalidCognitoSignature(token: string): string {
  const [header, payload] = token.split(".");
  return `${header}.${payload}.${Buffer.from("invalid").toString("base64url")}`;
}

function base64UrlJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

async function wait(ms: number): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function createShutdownRuntime(
  overrides: Partial<NodeHttpRuntime> = {}
): NodeHttpRuntime {
  return {
    server: createNodeHttpServer({
      application: createApplication()
    }),
    async shutdown() {
      return shutdownResult();
    },
    ...overrides
  };
}

function shutdownResult(): NodeHttpShutdownResult {
  return {
    completed: true,
    forced: false,
    inFlightRequests: 0,
    openSockets: 0
  };
}

class FakeSignalTarget implements NodeHttpShutdownSignalTarget {
  private readonly listeners = new Map<
    NodeHttpShutdownSignal,
    Set<() => void>
  >();

  on(signal: NodeHttpShutdownSignal, listener: () => void): void {
    const listeners = this.listeners.get(signal) ?? new Set<() => void>();
    listeners.add(listener);
    this.listeners.set(signal, listeners);
  }

  off(signal: NodeHttpShutdownSignal, listener: () => void): void {
    this.listeners.get(signal)?.delete(listener);
  }

  emit(signal: NodeHttpShutdownSignal): void {
    for (const listener of this.listeners.get(signal) ?? []) {
      listener();
    }
  }

  listenerCount(signal: NodeHttpShutdownSignal): number {
    return this.listeners.get(signal)?.size ?? 0;
  }
}
