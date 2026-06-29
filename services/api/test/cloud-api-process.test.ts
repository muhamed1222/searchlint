import type { AddressInfo } from "node:net";

import { describe, expect, it } from "vitest";

import {
  cloudApiProcessConfigFromEnv,
  createCloudApiProcess
} from "../src/index.js";
import type {
  CloudApiProcessEnv,
  CloudApiProcessFactories,
  NodeHttpShutdownSignal,
  NodeHttpShutdownSignalTarget,
  OtlpExporterRuntime,
  PgPool,
  PostgresQuery,
  PostgresQueryExecutor,
  PostgresQueryResult
} from "../src/index.js";

describe("cloudApiProcessConfigFromEnv", () => {
  it("parses PostgreSQL-backed rate-limit process configuration", () => {
    const config = cloudApiProcessConfigFromEnv(requiredEnv());

    expect({
      ...config,
      observability: {
        ...config.observability,
        endpoint: config.observability.endpoint.toString()
      }
    }).toEqual({
      postgresPrefix: "SEARCHLINT_POSTGRES",
      postgresDatabaseUrl: "postgres://searchlint.local/db",
      stripeWebhookSigningSecret: "whsec_searchlint_test",
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
        endpoint: "https://otel-collector.example.com/v1/logs",
        protocol: "http/protobuf",
        timeoutMs: 10000,
        headers: [],
        signals: ["logs", "metrics"]
      }
    });
  });

  it("parses optional HTTP runtime limits", () => {
    expect(
      cloudApiProcessConfigFromEnv({
        ...requiredEnv(),
        SEARCHLINT_API_DISPATCH_TIMEOUT_MS: "2500",
        SEARCHLINT_API_MAX_BODY_BYTES: "65536"
      })
    ).toMatchObject({
      dispatchTimeoutMs: 2500,
      maxBodyBytes: 65_536
    });
  });

  it("rejects missing or invalid rate-limit env before clients are created", () => {
    expect(() => cloudApiProcessConfigFromEnv({})).toThrow(
      "SEARCHLINT_API_RATE_LIMIT_STORE is required."
    );
    expect(() =>
      cloudApiProcessConfigFromEnv({
        ...requiredEnv(),
        SEARCHLINT_API_RATE_LIMIT_STORE: "memory"
      })
    ).toThrow("SEARCHLINT_API_RATE_LIMIT_STORE must be postgres.");
    expect(() =>
      cloudApiProcessConfigFromEnv({
        ...requiredEnv(),
        SEARCHLINT_API_RATE_LIMIT_WINDOW_MS: "0"
      })
    ).toThrow(
      "SEARCHLINT_API_RATE_LIMIT_WINDOW_MS must be a positive integer."
    );
    expect(() =>
      cloudApiProcessConfigFromEnv({
        ...requiredEnv(),
        SEARCHLINT_API_RATE_LIMIT_MAX_REQUESTS: "1.5"
      })
    ).toThrow(
      "SEARCHLINT_API_RATE_LIMIT_MAX_REQUESTS must be a positive integer."
    );
  });

  it("rejects invalid OTLP env before clients are created", () => {
    expect(() =>
      cloudApiProcessConfigFromEnv({
        ...requiredEnv(),
        OTEL_EXPORTER_OTLP_PROTOCOL: "grpc"
      })
    ).toThrow("OTEL_EXPORTER_OTLP_PROTOCOL must be http/protobuf.");
  });

  it("rejects invalid Cognito env before clients are created", () => {
    expect(() =>
      cloudApiProcessConfigFromEnv({
        ...requiredEnv(),
        SEARCHLINT_COGNITO_TOKEN_USE: "id"
      })
    ).toThrow("SEARCHLINT_COGNITO_TOKEN_USE must be access.");

    const calls: string[] = [];
    expect(() =>
      createCloudApiProcess({
        env: {
          ...requiredEnv(),
          SEARCHLINT_COGNITO_JWKS_URL: "http://example.test/jwks.json"
        },
        factories: factories({
          calls
        })
      })
    ).toThrow("JWKS URL must use https.");
    expect(calls).toEqual([]);
  });

  it("rejects invalid external provider OAuth env before clients are created", () => {
    expect(() =>
      cloudApiProcessConfigFromEnv({
        ...requiredEnv(),
        SEARCHLINT_GOOGLE_OAUTH_AUTHORIZATION_ENDPOINT:
          "http://accounts.google.com/o/oauth2/v2/auth"
      })
    ).toThrow(
      "SEARCHLINT_GOOGLE_OAUTH_AUTHORIZATION_ENDPOINT must be an https URL."
    );

    expect(() =>
      cloudApiProcessConfigFromEnv({
        ...requiredEnv(),
        SEARCHLINT_YANDEX_OAUTH_SCOPES: " "
      })
    ).toThrow("SEARCHLINT_YANDEX_OAUTH_SCOPES is required.");

    expect(() =>
      cloudApiProcessConfigFromEnv({
        ...requiredEnv(),
        SEARCHLINT_GOOGLE_OAUTH_PKCE_REQUIRED: "yes"
      })
    ).toThrow("SEARCHLINT_GOOGLE_OAUTH_PKCE_REQUIRED must be true or false.");
  });
});

describe("createCloudApiProcess", () => {
  it("fails before runtime clients are created when required env is missing", () => {
    const calls: string[] = [];

    expect(() =>
      createCloudApiProcess({
        env: {
          SEARCHLINT_POSTGRES_DATABASE_URL: "postgres://searchlint.local/db"
        },
        factories: factories({
          calls
        })
      })
    ).toThrow("SEARCHLINT_API_RATE_LIMIT_STORE is required.");
    expect(calls).toEqual([]);
  });

  it("assembles a non-listening Node HTTP runtime with PostgreSQL rate limiting", async () => {
    const queries: PostgresQuery[] = [];
    const observabilityEvents: string[] = [];
    const process = createCloudApiProcess({
      env: {
        ...requiredEnv(),
        SEARCHLINT_API_RATE_LIMIT_MAX_REQUESTS: "1"
      },
      factories: factories({
        observabilityRuntime:
          recordingObservabilityRuntime(observabilityEvents),
        executor: {
          async query<Row extends Record<string, unknown>>(
            query: PostgresQuery
          ): Promise<PostgresQueryResult<Row>> {
            queries.push(query);
            return {
              rows: [
                {
                  consumed_count: 2,
                  reset_at_ms: 1_800_000_000_000
                } as unknown as Row
              ]
            };
          }
        }
      }),
      async extractPrincipal() {
        return {
          id: "principal-1",
          externalSubject: "cognito|principal-1"
        };
      },
      logSinkOptions: {
        stdout: {
          write() {
            return undefined;
          }
        },
        stderr: {
          write() {
            return undefined;
          }
        }
      }
    });

    expect(process.runtime.server.listening).toBe(false);
    await expect(process.observability.start()).resolves.toEqual({
      state: "started",
      alreadyStarted: false
    });
    expect(observabilityEvents).toEqual(["start:searchlint-cloud-api"]);

    try {
      const response = await request(process.runtime.server, {
        method: "POST",
        path: "/v1/organizations",
        body: {
          name: "Acme"
        }
      });

      expect(response).toEqual({
        status: 429,
        body: {
          error: {
            code: "RATE_LIMITED",
            message: "Rate limit exceeded."
          }
        }
      });
      expect(queries).toHaveLength(1);
      expect(queries[0]?.text).toContain('INSERT INTO "rate_limit_windows"');
      expect(queries[0]?.values).toEqual([
        "127.0.0.1",
        "cloud.rate_limit_windows.v1",
        expect.any(Number),
        null,
        "active",
        60_000,
        1
      ]);
    } finally {
      await process.observability.shutdown();
      expect(observabilityEvents).toEqual([
        "start:searchlint-cloud-api",
        "shutdown"
      ]);
      await process.runtime.shutdown();
    }
  });

  it("installs lifecycle handling only when explicitly requested", async () => {
    const signalTarget = new FakeSignalTarget();
    const process = createCloudApiProcess({
      env: requiredEnv(),
      factories: factories(),
      logSinkOptions: {
        stdout: {
          write() {
            return undefined;
          }
        }
      }
    });

    await tick();
    expect(signalTarget.listenerCount("SIGTERM")).toBe(0);

    const exitCodes: number[] = [];
    const binding = process.installLifecycle({
      signalTarget,
      exitCodeSink(exitCode) {
        exitCodes.push(exitCode);
      }
    });

    await tick();
    expect(signalTarget.listenerCount("SIGTERM")).toBe(1);
    expect(binding.state()).toBe("ready");
    expect(exitCodes).toEqual([]);

    binding.uninstall();
    expect(signalTarget.listenerCount("SIGTERM")).toBe(0);
    await process.runtime.shutdown();
  });

  it("uses the PostgreSQL entitlement store before creating crawl work", async () => {
    const queries: PostgresQuery[] = [];
    const process = createCloudApiProcess({
      env: requiredEnv(),
      factories: factories({
        executor: {
          async query<Row extends Record<string, unknown>>(
            query: PostgresQuery
          ): Promise<PostgresQueryResult<Row>> {
            queries.push(query);
            if (query.text.includes('INSERT INTO "rate_limit_windows"')) {
              return {
                rows: [
                  {
                    consumed_count: 1,
                    reset_at_ms: 1_800_000_000_000
                  } as unknown as Row
                ]
              };
            }
            if (query.text.includes('FROM "organization_memberships"')) {
              return {
                rows: [
                  {
                    id: "membership-1",
                    organization_id: "org-1",
                    principal_id: "principal-1",
                    role: "owner",
                    created_at: "2026-06-21T00:00:00.000Z"
                  } as unknown as Row
                ]
              };
            }
            if (query.text.includes('FROM "projects"')) {
              return {
                rows: [
                  {
                    id: "project-1",
                    organization_id: "org-1",
                    name: "Acme",
                    site_url: "https://example.test",
                    created_at: "2026-06-21T00:00:00.000Z"
                  } as unknown as Row
                ]
              };
            }
            if (query.text.includes('FROM "environments"')) {
              return {
                rows: [
                  {
                    id: "env-1",
                    organization_id: "org-1",
                    project_id: "project-1",
                    name: "Production",
                    base_url: "https://example.test",
                    created_at: "2026-06-21T00:00:00.000Z"
                  } as unknown as Row
                ]
              };
            }
            return {
              rows: []
            };
          }
        }
      }),
      async extractPrincipal() {
        return {
          id: "principal-1",
          externalSubject: "cognito|principal-1"
        };
      },
      logSinkOptions: {
        stdout: {
          write() {
            return undefined;
          }
        }
      }
    });

    try {
      const response = await request(process.runtime.server, {
        method: "POST",
        path: "/v1/organizations/org-1/projects/project-1/environments/env-1/crawl-requests",
        body: {
          maxUrls: 10
        }
      });

      expect(response).toEqual({
        status: 402,
        body: {
          error: {
            code: "ENTITLEMENT_DENIED",
            message: "No active cloud entitlement is configured."
          }
        }
      });
      expect(
        queries.some((query) =>
          query.text.includes('INSERT INTO "crawl_requests"')
        )
      ).toBe(false);
      expect(
        queries.some((query) =>
          query.text.includes('INSERT INTO "outbox_events"')
        )
      ).toBe(false);
    } finally {
      await process.runtime.shutdown();
    }
  });

  it("uses the PostgreSQL dashboard snapshot store for dashboard snapshot requests", async () => {
    const queries: PostgresQuery[] = [];
    const process = createCloudApiProcess({
      env: requiredEnv(),
      factories: factories({
        executor: {
          async query<Row extends Record<string, unknown>>(
            query: PostgresQuery
          ): Promise<PostgresQueryResult<Row>> {
            queries.push(query);
            if (query.text.includes('INSERT INTO "rate_limit_windows"')) {
              return {
                rows: [
                  {
                    consumed_count: 1,
                    reset_at_ms: 1_800_000_000_000
                  } as unknown as Row
                ]
              };
            }
            if (query.text.includes('FROM "organization_memberships"')) {
              return {
                rows: [
                  {
                    id: "membership-1",
                    organization_id: "org-1",
                    principal_id: "principal-1",
                    role: "owner",
                    created_at: "2026-06-21T00:00:00.000Z"
                  } as unknown as Row
                ]
              };
            }
            if (query.text.includes('FROM "projects"')) {
              return {
                rows: [
                  {
                    id: "project-1",
                    organization_id: "org-1",
                    name: "Acme",
                    site_url: "https://example.test",
                    created_at: "2026-06-21T00:00:00.000Z"
                  } as unknown as Row
                ]
              };
            }
            if (query.text.includes('FROM "environments"')) {
              return {
                rows: [
                  {
                    id: "env-1",
                    organization_id: "org-1",
                    project_id: "project-1",
                    name: "Production",
                    base_url: "https://example.test",
                    created_at: "2026-06-21T00:00:00.000Z"
                  } as unknown as Row
                ]
              };
            }
            if (query.text.includes('FROM "dashboard_snapshots"')) {
              return {
                rows: [
                  {
                    payload: {
                      overview: {
                        blocker: 0,
                        error: 1
                      }
                    }
                  } as unknown as Row
                ]
              };
            }
            return {
              rows: []
            };
          }
        }
      }),
      async extractPrincipal() {
        return {
          id: "principal-1",
          externalSubject: "cognito|principal-1"
        };
      },
      logSinkOptions: {
        stdout: {
          write() {
            return undefined;
          }
        }
      }
    });

    try {
      const response = await request(process.runtime.server, {
        method: "GET",
        path: "/v1/organizations/org-1/projects/project-1/environments/env-1/dashboard-snapshot",
        body: {}
      });

      expect(response).toEqual({
        status: 200,
        body: {
          overview: {
            blocker: 0,
            error: 1
          }
        }
      });
      expect(
        queries.some((query) =>
          query.text.includes('FROM "dashboard_snapshots"')
        )
      ).toBe(true);
    } finally {
      await process.runtime.shutdown();
    }
  });
});

function requiredEnv(): CloudApiProcessEnv {
  return {
    SEARCHLINT_POSTGRES_DATABASE_URL: "postgres://searchlint.local/db",
    SEARCHLINT_STRIPE_WEBHOOK_SECRET: "whsec_searchlint_test",
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
    SEARCHLINT_YANDEX_OAUTH_SCOPES: "webmaster:read metrika:read",
    SEARCHLINT_API_RATE_LIMIT_STORE: "postgres",
    SEARCHLINT_API_RATE_LIMIT_WINDOW_MS: "60000",
    SEARCHLINT_API_RATE_LIMIT_MAX_REQUESTS: "120",
    OTEL_SERVICE_NAME: "searchlint-cloud-api",
    SEARCHLINT_ENVIRONMENT: "test",
    OTEL_EXPORTER_OTLP_ENDPOINT: "https://otel-collector.example.com/v1/logs",
    OTEL_EXPORTER_OTLP_PROTOCOL: "http/protobuf",
    OTEL_EXPORTER_OTLP_TIMEOUT: "10000"
  };
}

function factories(
  options: {
    calls?: string[];
    executor?: PostgresQueryExecutor;
    observabilityRuntime?: OtlpExporterRuntime;
  } = {}
): Partial<CloudApiProcessFactories> {
  return {
    createPgPool() {
      options.calls?.push("pg-pool");
      return fakePool();
    },
    createQueryExecutor() {
      options.calls?.push("pg-executor");
      return (
        options.executor ?? {
          async query<Row extends Record<string, unknown>>(): Promise<
            PostgresQueryResult<Row>
          > {
            return {
              rows: []
            };
          }
        }
      );
    },
    createObservabilityRuntime() {
      options.calls?.push("observability-runtime");
      return options.observabilityRuntime ?? recordingObservabilityRuntime([]);
    }
  };
}

function recordingObservabilityRuntime(events: string[]): OtlpExporterRuntime {
  return {
    start(config) {
      events.push(`start:${config.serviceName}`);
    },
    shutdown() {
      events.push("shutdown");
    }
  };
}

function fakePool(): PgPool {
  return {
    async query() {
      return {
        rows: [],
        command: "SELECT",
        rowCount: 0,
        oid: 0,
        fields: []
      };
    },
    async connect() {
      return {
        async query() {
          return {
            rows: [],
            command: "SELECT",
            rowCount: 0,
            oid: 0,
            fields: []
          };
        },
        release() {
          return undefined;
        }
      };
    }
  };
}

function request(
  server: ReturnType<typeof createCloudApiProcess>["runtime"]["server"],
  input: {
    method: string;
    path: string;
    body: unknown;
  }
): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address() as AddressInfo;
      const body =
        input.method === "GET" ? undefined : JSON.stringify(input.body);
      const request = fetch(`http://127.0.0.1:${address.port}${input.path}`, {
        method: input.method,
        headers: {
          "content-type": "application/json"
        },
        ...(body === undefined ? {} : { body })
      });

      request.then(
        async (response) => {
          resolve({
            status: response.status,
            body: await response.json()
          });
        },
        (error: unknown) => {
          reject(error);
        }
      );
    });
  });
}

class FakeSignalTarget implements NodeHttpShutdownSignalTarget {
  readonly listeners = new Map<NodeHttpShutdownSignal, Set<() => void>>();

  on(signal: NodeHttpShutdownSignal, listener: () => void): void {
    const listeners = this.listeners.get(signal) ?? new Set<() => void>();
    listeners.add(listener);
    this.listeners.set(signal, listeners);
  }

  off(signal: NodeHttpShutdownSignal, listener: () => void): void {
    this.listeners.get(signal)?.delete(listener);
  }

  listenerCount(signal: NodeHttpShutdownSignal): number {
    return this.listeners.get(signal)?.size ?? 0;
  }
}

function tick(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}
