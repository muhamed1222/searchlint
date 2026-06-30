import type {
  ExternalObservationProvider,
  ExternalObservationRecord,
  ExternalObservationStore,
  OAuthConnectionRecord,
  OAuthConnectionStore,
  OtlpExporterRuntime,
  PgPool,
  PostgresQueryExecutor,
  GoogleProviderFetch,
  YandexProviderFetch
} from "@searchlint/api";
import { describe, expect, it } from "vitest";

import {
  createExternalObservationCollectionProcess,
  externalObservationCollectionProcessConfigFromEnv,
  runSearchLintExternalObservationCollectionNodeProcess
} from "../src/index.js";
import type {
  ExternalObservationAccessTokenVault,
  ExternalObservationCollectionNodeProcessLike,
  ExternalObservationCollectionPollingRuntime,
  ExternalObservationCollectionProcess,
  ExternalObservationCollectionProcessEnv,
  ExternalObservationCollectionProcessFactories,
  ExternalObservationProviderCollector,
  ExternalObservationProviderCollectors,
  OutboxWorkerProcessExitPolicyBinding,
  OutboxWorkerProductionLogEvent,
  OutboxWorkerProductionLogSink,
  OutboxWorkerShutdownResult,
  OutboxWorkerShutdownSignal,
  OutboxWorkerShutdownSignalTarget,
  SecretsManagerGetSecretValueClient
} from "../src/index.js";

describe("externalObservationCollectionProcessConfigFromEnv", () => {
  it("parses required process env with stable collection defaults", () => {
    const config =
      externalObservationCollectionProcessConfigFromEnv(requiredEnv());

    expect({
      ...config,
      observability: {
        ...config.observability,
        endpoint: config.observability.endpoint.toString()
      }
    }).toEqual({
      postgresPrefix: "SEARCHLINT_POSTGRES",
      postgresDatabaseUrl: "postgres://searchlint.local/db",
      pollIntervalMs: 60000,
      batchSize: 25,
      targets: {},
      stopOnError: false,
      observability: {
        serviceName: "searchlint-cloud-worker",
        environment: "test",
        endpoint: "https://otel-collector.example.com/v1/logs",
        protocol: "http/protobuf",
        timeoutMs: 10000,
        headers: [],
        signals: ["logs", "metrics"]
      }
    });
  });

  it("parses optional process env overrides", () => {
    expect(
      externalObservationCollectionProcessConfigFromEnv({
        ...requiredEnv(),
        SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_PROVIDER: "google",
        SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_POLL_INTERVAL_MS: "5000",
        SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_BATCH_SIZE: "75",
        SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_MAX_BATCHES: "1",
        SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_SECRET_NAME_PREFIX:
          "searchlint/prod/oauth",
        SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_SUBJECT_URLS:
          "https://example.test/, https://example.test/about",
        SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_SITEMAP_URLS:
          "https://example.test/sitemap.xml",
        SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_DISCOVERY_SITE_URLS:
          "https://example.test/products/widget, https://blog.example.test/",
        SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_DISCOVERY_SITEMAP_URLS:
          "https://cdn.example.test/sitemap-products.xml",
        SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_DISCOVERY_MAX_SUBJECT_URLS: "50",
        SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_GOOGLE_SEARCH_ANALYTICS_START_DATE:
          "2026-06-01",
        SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_GOOGLE_SEARCH_ANALYTICS_END_DATE:
          "2026-06-10",
        SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_GOOGLE_PAGESPEED_ENABLED: "true",
        SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_GOOGLE_PAGESPEED_STRATEGY:
          "desktop",
        SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_GOOGLE_PAGESPEED_CATEGORIES:
          "performance, seo",
        SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_GOOGLE_CRUX_ENABLED: "true",
        SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_GOOGLE_CRUX_FORM_FACTOR: "PHONE",
        SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_GOOGLE_CRUX_EFFECTIVE_CONNECTION_TYPE:
          "4G",
        SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_YANDEX_METRICA_COUNTER_ID:
          "counter-1",
        SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_YANDEX_METRICA_START_DATE:
          "2026-06-01",
        SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_YANDEX_METRICA_END_DATE:
          "2026-06-10",
        SEARCHLINT_WORKER_GOOGLE_OAUTH_CLIENT_ID: "google-client",
        SEARCHLINT_WORKER_GOOGLE_OAUTH_CLIENT_SECRET: "google-secret",
        SEARCHLINT_WORKER_GOOGLE_OAUTH_TOKEN_ENDPOINT:
          "https://oauth.google.test/token",
        SEARCHLINT_WORKER_YANDEX_OAUTH_CLIENT_ID: "yandex-client",
        SEARCHLINT_WORKER_YANDEX_OAUTH_CLIENT_SECRET: "yandex-secret"
      })
    ).toMatchObject({
      provider: "google",
      pollIntervalMs: 5000,
      batchSize: 75,
      maxBatches: 1,
      oauthSecretNamePrefix: "searchlint/prod/oauth",
      targets: {
        subjectUrls: ["https://example.test/", "https://example.test/about"],
        sitemapUrls: ["https://example.test/sitemap.xml"],
        discovery: {
          siteUrls: [
            "https://example.test/products/widget",
            "https://blog.example.test/"
          ],
          sitemapUrls: ["https://cdn.example.test/sitemap-products.xml"],
          maxSubjectUrls: 50
        },
        googleSearchAnalytics: {
          startDate: "2026-06-01",
          endDate: "2026-06-10"
        },
        googlePageSpeed: {
          enabled: true,
          strategy: "desktop",
          categories: ["performance", "seo"]
        },
        googleCrux: {
          enabled: true,
          formFactor: "PHONE",
          effectiveConnectionType: "4G"
        },
        yandexMetrica: {
          counterId: "counter-1",
          startDate: "2026-06-01",
          endDate: "2026-06-10"
        }
      },
      oauthRefresh: {
        google: {
          clientId: "google-client",
          clientSecret: "google-secret",
          tokenEndpoint: "https://oauth.google.test/token"
        },
        yandex: {
          clientId: "yandex-client",
          clientSecret: "yandex-secret"
        }
      }
    });
    expect(
      externalObservationCollectionProcessConfigFromEnv({
        ...requiredEnv(),
        SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_PROVIDER: "all"
      }).provider
    ).toBeUndefined();
  });

  it("rejects missing required env before worker clients are created", () => {
    const calls: string[] = [];

    expect(() =>
      createExternalObservationCollectionProcess({
        env: {},
        factories: factories({
          calls
        })
      })
    ).toThrow("SEARCHLINT_POSTGRES_DATABASE_URL is required.");
    expect(calls).toEqual([]);
  });

  it("rejects invalid provider env before worker clients are created", () => {
    const calls: string[] = [];

    expect(() =>
      createExternalObservationCollectionProcess({
        env: {
          ...requiredEnv(),
          SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_PROVIDER: "bing"
        },
        factories: factories({
          calls
        })
      })
    ).toThrow(
      "SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_PROVIDER must be google, yandex, or all."
    );
    expect(calls).toEqual([]);
  });

  it("rejects incomplete provider target date ranges before worker clients are created", () => {
    const calls: string[] = [];

    expect(() =>
      createExternalObservationCollectionProcess({
        env: {
          ...requiredEnv(),
          SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_GOOGLE_SEARCH_ANALYTICS_START_DATE:
            "2026-06-01"
        },
        factories: factories({
          calls
        })
      })
    ).toThrow(
      "SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_GOOGLE_SEARCH_ANALYTICS_START_DATE and SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_GOOGLE_SEARCH_ANALYTICS_END_DATE must be configured together."
    );
    expect(calls).toEqual([]);
  });

  it("rejects invalid target discovery limits before worker clients are created", () => {
    const calls: string[] = [];

    expect(() =>
      createExternalObservationCollectionProcess({
        env: {
          ...requiredEnv(),
          SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_DISCOVERY_SITE_URLS:
            "https://example.test/",
          SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_DISCOVERY_MAX_SUBJECT_URLS: "0"
        },
        factories: factories({
          calls
        })
      })
    ).toThrow(
      "SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_DISCOVERY_MAX_SUBJECT_URLS must be an integer from 1 to 10000."
    );
    expect(calls).toEqual([]);
  });

  it("rejects invalid max batch limits before worker clients are created", () => {
    const calls: string[] = [];

    expect(() =>
      createExternalObservationCollectionProcess({
        env: {
          ...requiredEnv(),
          SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_MAX_BATCHES: "0"
        },
        factories: factories({
          calls
        })
      })
    ).toThrow(
      "SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_MAX_BATCHES must be an integer from 1 to 1000."
    );
    expect(calls).toEqual([]);
  });

  it("rejects invalid Google performance target options before worker clients are created", () => {
    const calls: string[] = [];

    expect(() =>
      createExternalObservationCollectionProcess({
        env: {
          ...requiredEnv(),
          SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_GOOGLE_PAGESPEED_ENABLED:
            "true",
          SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_GOOGLE_PAGESPEED_STRATEGY:
            "tablet"
        },
        factories: factories({
          calls
        })
      })
    ).toThrow(
      "SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_GOOGLE_PAGESPEED_STRATEGY must be mobile or desktop."
    );
    expect(() =>
      createExternalObservationCollectionProcess({
        env: {
          ...requiredEnv(),
          SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_GOOGLE_CRUX_ENABLED: "true",
          SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_GOOGLE_CRUX_FORM_FACTOR:
            "WATCH"
        },
        factories: factories({
          calls
        })
      })
    ).toThrow(
      "SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_GOOGLE_CRUX_FORM_FACTOR must be PHONE, DESKTOP, or TABLET."
    );
    expect(calls).toEqual([]);
  });

  it("rejects incomplete OAuth refresh credentials before worker clients are created", () => {
    const calls: string[] = [];

    expect(() =>
      createExternalObservationCollectionProcess({
        env: {
          ...requiredEnv(),
          SEARCHLINT_WORKER_GOOGLE_OAUTH_CLIENT_ID: "google-client"
        },
        factories: factories({
          calls
        })
      })
    ).toThrow(
      "SEARCHLINT_WORKER_GOOGLE_OAUTH_CLIENT_ID and SEARCHLINT_WORKER_GOOGLE_OAUTH_CLIENT_SECRET must be configured together for Google OAuth refresh."
    );
    expect(calls).toEqual([]);
  });

  it("logs external observation batches through the production log sink", async () => {
    const events: OutboxWorkerProductionLogEvent[] = [];
    const observabilityEvents: string[] = [];
    let worker: ExternalObservationCollectionProcess | undefined;
    const oauthStore = oauthConnectionStore([
      connection({
        accessTokenSecretRef: "secret://org-1/google/access-token"
      })
    ]);
    const externalObservationStore = externalObservationStoreRecording();
    const logSink: OutboxWorkerProductionLogSink = {
      async write(event) {
        events.push(event);
        if (event.kind === "external-observation-batch") {
          void worker?.runtime.stop();
        }
      }
    };

    worker = createExternalObservationCollectionProcess({
      env: requiredEnv(),
      factories: factories({
        oauthStore,
        externalObservationStore,
        vault: vault({
          "secret://org-1/google/access-token": "google-token"
        }),
        collectors: collectors({
          google: [observation({ provider: "google" })],
          yandex: []
        }),
        observabilityRuntime: recordingObservabilityRuntime(observabilityEvents)
      }),
      logSink,
      sleep: async () => undefined,
      clock: {
        now() {
          return "2026-06-21T00:00:00.000Z";
        }
      }
    });

    await worker.observability.start();
    worker.runtime.start();
    await worker.runtime.done();
    await worker.observability.shutdown();

    expect(observabilityEvents).toEqual([
      "start:searchlint-cloud-worker",
      "shutdown"
    ]);
    expect(oauthStore.selections).toEqual([
      {
        now: "2026-06-21T00:00:00.000Z",
        limit: 25
      }
    ]);
    expect(externalObservationStore.records).toHaveLength(1);
    expect(events).toEqual([
      {
        kind: "external-observation-batch",
        result: {
          selected: 1,
          collected: 1,
          stored: 1,
          failed: 0,
          skipped: 0
        }
      }
    ]);
  });

  it("uses the Secrets Manager access-token vault by default", async () => {
    const commands: Array<{ input: unknown }> = [];
    const events: OutboxWorkerProductionLogEvent[] = [];
    let worker: ExternalObservationCollectionProcess | undefined;
    const externalObservationStore = externalObservationStoreRecording();
    const logSink: OutboxWorkerProductionLogSink = {
      async write(event) {
        events.push(event);
        if (event.kind === "external-observation-batch") {
          void worker?.runtime.stop();
        }
      }
    };

    worker = createExternalObservationCollectionProcess({
      env: {
        ...requiredEnv(),
        SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_SECRET_NAME_PREFIX:
          "searchlint/test/oauth"
      },
      factories: factories({
        oauthStore: oauthConnectionStore([
          connection({
            accessTokenSecretRef: "secret://org-1/google/access-token"
          })
        ]),
        externalObservationStore,
        useDefaultVault: true,
        secretsManagerClient: {
          async send(command) {
            commands.push(command);
            return {
              SecretString: "google-token",
              $metadata: {}
            };
          }
        },
        collectors: collectors({
          google: [observation({ provider: "google" })],
          yandex: []
        })
      }),
      logSink,
      sleep: async () => undefined,
      clock: {
        now() {
          return "2026-06-21T00:00:00.000Z";
        }
      }
    });

    worker.runtime.start();
    await worker.runtime.done();

    expect(commands).toHaveLength(1);
    expect(commands[0]?.input).toEqual({
      SecretId: "searchlint/test/oauth/org-1/google/access-token"
    });
    expect(externalObservationStore.records).toHaveLength(1);
    expect(events).toEqual([
      {
        kind: "external-observation-batch",
        result: {
          selected: 1,
          collected: 1,
          stored: 1,
          failed: 0,
          skipped: 0
        }
      }
    ]);
  });

  it("uses provider collectors by default when targets are configured", async () => {
    const providerRequests: Array<{
      url: string;
      method: string;
      headers: Readonly<Record<string, string>>;
      body?: string;
    }> = [];
    let worker: ExternalObservationCollectionProcess | undefined;
    const externalObservationStore = externalObservationStoreRecording();
    const logSink: OutboxWorkerProductionLogSink = {
      async write(event) {
        if (event.kind === "external-observation-batch") {
          void worker?.runtime.stop();
        }
      }
    };

    worker = createExternalObservationCollectionProcess({
      env: {
        ...requiredEnv(),
        SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_SUBJECT_URLS:
          "https://example.test/"
      },
      factories: factories({
        oauthStore: oauthConnectionStore([
          connection({
            provider: "google",
            providerAccountId: "sc-domain:example.test",
            accessTokenSecretRef: "secret://org-1/google/access-token"
          })
        ]),
        externalObservationStore,
        useDefaultVault: true,
        useDefaultCollectors: true,
        secretsManagerClient: {
          async send() {
            return {
              SecretString: "google-token",
              $metadata: {}
            };
          }
        },
        providerFetch: async (url, init) => {
          providerRequests.push({
            url,
            method: init.method,
            headers: init.headers,
            ...(init.body === undefined ? {} : { body: init.body })
          });
          return {
            ok: true,
            status: 200,
            async json() {
              return {
                inspectionResult: {
                  indexStatusResult: {
                    coverageState: "Submitted and indexed",
                    lastCrawlTime: "2026-06-20T00:00:00.000Z"
                  }
                }
              };
            }
          };
        }
      }),
      logSink,
      sleep: async () => undefined,
      clock: {
        now() {
          return "2026-06-21T00:00:00.000Z";
        }
      }
    });

    worker.runtime.start();
    await worker.runtime.done();

    expect(providerRequests).toEqual([
      {
        url: "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect",
        method: "POST",
        headers: {
          authorization: "Bearer google-token",
          accept: "application/json",
          "content-type": "application/json"
        },
        body: JSON.stringify({
          inspectionUrl: "https://example.test/",
          siteUrl: "sc-domain:example.test"
        })
      }
    ]);
    expect(externalObservationStore.records).toHaveLength(1);
    expect(externalObservationStore.records[0]).toMatchObject({
      provider: "google",
      source: "google.urlInspection",
      subjectUrl: "https://example.test/"
    });
  });

  it("uses default OAuth token refreshers when client credentials are configured", async () => {
    const commands: Array<{ input: unknown }> = [];
    const providerRequests: Array<{
      url: string;
      method: string;
      headers: Readonly<Record<string, string>>;
      body?: string;
    }> = [];
    const collectorCalls: Array<{ accessToken: string }> = [];
    let worker: ExternalObservationCollectionProcess | undefined;
    const logSink: OutboxWorkerProductionLogSink = {
      async write(event) {
        if (event.kind === "external-observation-batch") {
          void worker?.runtime.stop();
        }
      }
    };

    worker = createExternalObservationCollectionProcess({
      env: {
        ...requiredEnv(),
        SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_SECRET_NAME_PREFIX:
          "searchlint/test/oauth",
        SEARCHLINT_WORKER_GOOGLE_OAUTH_CLIENT_ID: "google-client",
        SEARCHLINT_WORKER_GOOGLE_OAUTH_CLIENT_SECRET: "google-secret",
        SEARCHLINT_WORKER_GOOGLE_OAUTH_TOKEN_ENDPOINT:
          "https://oauth.google.test/token"
      },
      factories: factories({
        oauthStore: oauthConnectionStore([
          connection({
            provider: "google",
            accessTokenSecretRef: "secret://org-1/google/access-token",
            refreshTokenSecretRef: "secret://org-1/google/refresh-token"
          })
        ]),
        externalObservationStore: externalObservationStoreRecording(),
        useDefaultVault: true,
        secretsManagerClient: {
          async send(command) {
            commands.push(command);
            if (
              "input" in command &&
              (command.input as { SecretString?: string }).SecretString !==
                undefined
            ) {
              return {
                $metadata: {}
              };
            }
            return {
              SecretString: "stored-refresh-token",
              $metadata: {}
            };
          }
        },
        providerFetch: async (url, init) => {
          providerRequests.push({
            url,
            method: init.method,
            headers: init.headers,
            ...(init.body === undefined ? {} : { body: init.body })
          });
          return {
            ok: true,
            status: 200,
            async json() {
              return {
                access_token: "refreshed-access-token",
                expires_in: 3600
              };
            }
          };
        },
        collectors: {
          google: {
            async collectExternalObservations(input) {
              collectorCalls.push({
                accessToken: input.accessToken
              });
              return [observation({ provider: "google" })];
            }
          },
          yandex: collector([])
        }
      }),
      logSink,
      sleep: async () => undefined,
      clock: {
        now() {
          return "2026-06-21T00:00:00.000Z";
        }
      }
    });

    worker.runtime.start();
    await worker.runtime.done();

    expect(providerRequests).toEqual([
      {
        url: "https://oauth.google.test/token",
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/x-www-form-urlencoded"
        },
        body: "grant_type=refresh_token&refresh_token=stored-refresh-token&client_id=google-client&client_secret=google-secret"
      }
    ]);
    expect(commands.map((command) => command.input)).toEqual([
      {
        SecretId: "searchlint/test/oauth/org-1/google/refresh-token"
      },
      {
        SecretId: "searchlint/test/oauth/org-1/google/access-token",
        SecretString: "refreshed-access-token"
      }
    ]);
    expect(collectorCalls).toEqual([
      {
        accessToken: "refreshed-access-token"
      }
    ]);
  });

  it("installs lifecycle logging only when explicitly requested", async () => {
    const events: OutboxWorkerProductionLogEvent[] = [];
    const signalTarget = new FakeSignalTarget();
    const worker = createExternalObservationCollectionProcess({
      env: requiredEnv(),
      factories: factories(),
      logSink: {
        async write(event) {
          events.push(event);
        }
      }
    });

    await tick();
    expect(events).toEqual([]);
    expect(signalTarget.listenerCount("SIGTERM")).toBe(0);

    const exitCodes: number[] = [];
    const binding = worker.installLifecycle({
      signalTarget,
      exitCodeSink(exitCode) {
        exitCodes.push(exitCode);
      }
    });

    await tick();
    expect(signalTarget.listenerCount("SIGTERM")).toBe(1);
    expect(events).toEqual([
      {
        kind: "lifecycle",
        event: {
          state: "ready"
        }
      }
    ]);
    expect(exitCodes).toEqual([]);

    binding.uninstall();
    expect(signalTarget.listenerCount("SIGTERM")).toBe(0);
  });
});

describe("runSearchLintExternalObservationCollectionNodeProcess", () => {
  it("runs a supplied external observation process factory", async () => {
    const processLike = fakeProcessLike();
    const runtime = controllableRuntime();
    const observabilityEvents: string[] = [];

    await expect(
      runSearchLintExternalObservationCollectionNodeProcess(processLike, {
        createProcess() {
          return fakeProcess(runtime, observabilityEvents);
        }
      })
    ).resolves.toBe(0);

    expect(processLike.exitCode).toBe(0);
    expect(observabilityEvents).toEqual(["start", "shutdown"]);
    expect(runtime.started).toBe(1);
  });

  it("writes startup failures to stderr", async () => {
    const processLike = fakeProcessLike();

    await expect(
      runSearchLintExternalObservationCollectionNodeProcess(processLike, {
        createProcess() {
          throw new Error("missing vault");
        }
      })
    ).resolves.toBe(1);

    expect(processLike.exitCode).toBe(1);
    expect(processLike.stderrLines.join("")).toContain(
      "SearchLint external observation collection worker failed: missing vault"
    );
  });
});

function requiredEnv(): ExternalObservationCollectionProcessEnv {
  return {
    SEARCHLINT_POSTGRES_DATABASE_URL: "postgres://searchlint.local/db",
    OTEL_SERVICE_NAME: "searchlint-cloud-worker",
    SEARCHLINT_ENVIRONMENT: "test",
    OTEL_EXPORTER_OTLP_ENDPOINT: "https://otel-collector.example.com/v1/logs",
    OTEL_EXPORTER_OTLP_PROTOCOL: "http/protobuf",
    OTEL_EXPORTER_OTLP_TIMEOUT: "10000"
  };
}

function factories(
  options: {
    calls?: string[];
    oauthStore?: OAuthConnectionStore;
    externalObservationStore?: ExternalObservationStore;
    vault?: ExternalObservationAccessTokenVault;
    secretsManagerClient?: SecretsManagerGetSecretValueClient;
    useDefaultVault?: boolean;
    providerFetch?: GoogleProviderFetch & YandexProviderFetch;
    collectors?: ExternalObservationProviderCollectors;
    useDefaultCollectors?: boolean;
    observabilityRuntime?: OtlpExporterRuntime;
  } = {}
): Partial<ExternalObservationCollectionProcessFactories> {
  const result: Partial<ExternalObservationCollectionProcessFactories> = {
    createPgPool() {
      options.calls?.push("pg-pool");
      return {} as PgPool;
    },
    createQueryExecutor() {
      options.calls?.push("pg-executor");
      return {
        async query() {
          return {
            rows: []
          };
        }
      } satisfies PostgresQueryExecutor;
    },
    createOAuthConnectionStore() {
      options.calls?.push("oauth-store");
      return options.oauthStore ?? oauthConnectionStore([]);
    },
    createExternalObservationStore() {
      options.calls?.push("external-observation-store");
      return (
        options.externalObservationStore ?? externalObservationStoreRecording()
      );
    },
    createSecretsManagerClient() {
      options.calls?.push("secrets-manager-client");
      if (options.secretsManagerClient === undefined) {
        throw new Error("test secrets manager client missing");
      }
      return options.secretsManagerClient;
    },
    createProviderFetch() {
      options.calls?.push("provider-fetch");
      if (options.providerFetch === undefined) {
        throw new Error("test provider fetch missing");
      }
      return options.providerFetch;
    },
    createObservabilityRuntime() {
      options.calls?.push("observability-runtime");
      return options.observabilityRuntime ?? recordingObservabilityRuntime([]);
    }
  };

  if (options.useDefaultVault !== true) {
    result.createVault = () => {
      options.calls?.push("vault");
      return options.vault ?? vault({});
    };
  }

  if (options.useDefaultCollectors !== true) {
    result.createCollectors = () => {
      options.calls?.push("collectors");
      return options.collectors ?? collectors({ google: [], yandex: [] });
    };
  }

  return result;
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

function oauthConnectionStore(
  connections: readonly OAuthConnectionRecord[]
): OAuthConnectionStore & {
  selections: {
    now: string;
    provider?: ExternalObservationProvider;
    limit: number;
  }[];
} {
  const selections: {
    now: string;
    provider?: ExternalObservationProvider;
    limit: number;
  }[] = [];
  return {
    selections,
    async upsertOAuthConnection(input) {
      return input;
    },
    async getOAuthConnection() {
      return undefined;
    },
    async selectOAuthConnectionsDueForRefresh(input) {
      selections.push(input);
      return connections;
    },
    async markOAuthConnectionRevoked() {
      return undefined;
    }
  };
}

function externalObservationStoreRecording(): ExternalObservationStore & {
  records: ExternalObservationRecord[];
} {
  const records: ExternalObservationRecord[] = [];
  return {
    records,
    async upsertExternalObservation(input) {
      records.push(input);
      return input;
    },
    async selectExternalObservations() {
      return records;
    }
  };
}

function vault(
  secrets: Readonly<Record<string, string>>
): ExternalObservationAccessTokenVault {
  return {
    async getSecret(input) {
      const value = secrets[input.secretRef];
      if (value === undefined) {
        throw new Error("missing secret");
      }
      return { value };
    }
  };
}

function collectors(input: {
  google: readonly ExternalObservationRecord[];
  yandex: readonly ExternalObservationRecord[];
}): ExternalObservationProviderCollectors {
  return {
    google: collector(input.google),
    yandex: collector(input.yandex)
  };
}

function collector(
  records: readonly ExternalObservationRecord[]
): ExternalObservationProviderCollector {
  return {
    async collectExternalObservations() {
      return records;
    }
  };
}

function connection(
  overrides: Partial<OAuthConnectionRecord> = {}
): OAuthConnectionRecord {
  return {
    id: "connection-1",
    organizationId: "org-1",
    projectId: "project-1",
    environmentId: "env-1",
    provider: "google",
    providerAccountId: "sc-domain:example.test",
    scopes: ["scope-1"],
    accessTokenSecretRef: "secret://org-1/google/access-token",
    refreshTokenSecretRef: "secret://org-1/google/refresh-token",
    expiresAt: "2026-06-21T00:00:00.000Z",
    status: "active",
    deletionState: "active",
    createdAt: "2026-06-20T00:00:00.000Z",
    ...overrides
  };
}

function observation(
  overrides: Partial<ExternalObservationRecord> & {
    provider: ExternalObservationProvider;
  }
): ExternalObservationRecord {
  const { provider, ...rest } = overrides;
  return {
    id: "google-observation-1",
    organizationId: "org-1",
    projectId: "project-1",
    environmentId: "env-1",
    provider,
    source: provider === "google" ? "google.urlInspection" : "yandex.webmaster",
    subjectUrl: "https://example.test/",
    observedAt: "2026-06-21T00:00:00.000Z",
    fetchedAt: "2026-06-21T00:00:00.000Z",
    freshness: "fresh",
    payload: {},
    fingerprint: "google-observation",
    deletionState: "active",
    createdAt: "2026-06-21T00:00:00.000Z",
    ...rest
  };
}

class FakeSignalTarget implements OutboxWorkerShutdownSignalTarget {
  readonly listeners = new Map<OutboxWorkerShutdownSignal, Set<() => void>>();

  on(signal: OutboxWorkerShutdownSignal, listener: () => void): void {
    const listeners = this.listeners.get(signal) ?? new Set<() => void>();
    listeners.add(listener);
    this.listeners.set(signal, listeners);
  }

  off(signal: OutboxWorkerShutdownSignal, listener: () => void): void {
    this.listeners.get(signal)?.delete(listener);
  }

  listenerCount(signal: OutboxWorkerShutdownSignal): number {
    return this.listeners.get(signal)?.size ?? 0;
  }
}

function controllableRuntime() {
  return {
    started: 0,
    running: false,
    start() {
      this.started += 1;
      this.running = true;
      this.running = false;
    },
    async stop() {
      const wasRunning = this.running;
      this.running = false;
      return {
        completed: true,
        forced: false,
        wasRunning
      } satisfies OutboxWorkerShutdownResult;
    },
    async done() {
      return undefined;
    },
    isRunning() {
      return this.running;
    }
  };
}

function fakeProcess(
  runtime: ReturnType<typeof controllableRuntime>,
  observabilityEvents: string[]
): ExternalObservationCollectionProcess {
  const pollingRuntime: ExternalObservationCollectionPollingRuntime = {
    start() {
      runtime.start();
    },
    async stop() {
      await runtime.stop();
    },
    done() {
      return runtime.done();
    },
    isRunning() {
      return runtime.isRunning();
    }
  };

  return {
    config: externalObservationCollectionProcessConfigFromEnv(requiredEnv()),
    observability: {
      state() {
        return "stopped";
      },
      async start() {
        observabilityEvents.push("start");
        return {
          state: "started",
          alreadyStarted: false
        };
      },
      async shutdown() {
        observabilityEvents.push("shutdown");
        return {
          state: "stopped",
          alreadyStopped: false
        };
      }
    },
    runtime,
    pollingRuntime,
    installLifecycle() {
      return {
        uninstall() {
          return undefined;
        },
        state() {
          return "ready";
        },
        shutdownPromise() {
          return undefined;
        }
      } satisfies OutboxWorkerProcessExitPolicyBinding;
    }
  };
}

function fakeProcessLike(): ExternalObservationCollectionNodeProcessLike & {
  stderrLines: string[];
} {
  const stderrLines: string[] = [];
  return {
    env: requiredEnv(),
    stderr: {
      write(chunk) {
        stderrLines.push(chunk);
      }
    },
    stderrLines,
    exitCode: undefined,
    on() {
      return undefined;
    },
    off() {
      return undefined;
    }
  };
}

function tick(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}
