import { ReceiveMessageCommand } from "@aws-sdk/client-sqs";
import type { ReceiveMessageCommandOutput } from "@aws-sdk/client-sqs";
import type { PgPool, PostgresQueryExecutor } from "@searchlint/api";
import type { OtlpExporterRuntime } from "@searchlint/api";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  crawlerWorkerProcessConfigFromEnv,
  createCrawlerWorkerProcess
} from "../src/index.js";
import type {
  CrawlerWorkerProcess,
  CrawlerWorkerProcessEnv,
  CrawlerWorkerProcessFactories,
  OutboxWorkerProductionLogEvent,
  OutboxWorkerProductionLogSink,
  OutboxWorkerShutdownSignal,
  OutboxWorkerShutdownSignalTarget,
  S3PutObjectClient,
  SqsCrawlerClient
} from "../src/index.js";

describe("crawlerWorkerProcessConfigFromEnv", () => {
  it("parses required process env with stable polling defaults", () => {
    const config = crawlerWorkerProcessConfigFromEnv(requiredEnv());

    expect({
      ...config,
      observability: {
        ...config.observability,
        endpoint: config.observability.endpoint.toString()
      }
    }).toEqual({
      postgresPrefix: "SEARCHLINT_POSTGRES",
      postgresDatabaseUrl: "postgres://searchlint.local/db",
      queueUrl: "https://sqs.us-east-1.amazonaws.com/1/crawl",
      artifactBucket: "searchlint-crawl-artifacts",
      ruleCatalogPath: "specs/RULE_CATALOG.yaml",
      pollIntervalMs: 1000,
      batchSize: 5,
      waitTimeSeconds: 20,
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
      crawlerWorkerProcessConfigFromEnv({
        ...requiredEnv(),
        SEARCHLINT_CRAWL_ARTIFACT_KEY_PREFIX: "crawl-artifacts",
        SEARCHLINT_WORKER_CRAWLER_POLL_INTERVAL_MS: "250",
        SEARCHLINT_WORKER_CRAWLER_BATCH_SIZE: "7",
        SEARCHLINT_WORKER_CRAWLER_WAIT_TIME_SECONDS: "12",
        SEARCHLINT_WORKER_CRAWLER_VISIBILITY_TIMEOUT_SECONDS: "45"
      })
    ).toMatchObject({
      artifactKeyPrefix: "crawl-artifacts",
      pollIntervalMs: 250,
      batchSize: 7,
      waitTimeSeconds: 12,
      visibilityTimeoutSeconds: 45
    });
  });

  it("rejects missing required env before worker clients are created", () => {
    const calls: string[] = [];

    expect(() =>
      createCrawlerWorkerProcess({
        env: {
          SEARCHLINT_CRAWL_QUEUE_URL:
            "https://sqs.us-east-1.amazonaws.com/1/crawl",
          SEARCHLINT_CRAWL_ARTIFACT_BUCKET: "searchlint-crawl-artifacts",
          SEARCHLINT_RULE_CATALOG_PATH: "specs/RULE_CATALOG.yaml"
        },
        factories: factories({
          calls
        })
      })
    ).toThrow("SEARCHLINT_POSTGRES_DATABASE_URL is required.");
    expect(calls).toEqual([]);
  });

  it("rejects invalid OTLP env before worker clients are created", () => {
    const calls: string[] = [];

    expect(() =>
      createCrawlerWorkerProcess({
        env: {
          ...requiredEnv(),
          OTEL_EXPORTER_OTLP_PROTOCOL: "grpc"
        },
        factories: factories({
          calls
        })
      })
    ).toThrow("OTEL_EXPORTER_OTLP_PROTOCOL must be http/protobuf.");
    expect(calls).toEqual([]);
  });

  it("logs crawler batches through the production log sink", async () => {
    const events: OutboxWorkerProductionLogEvent[] = [];
    const observabilityEvents: string[] = [];
    let worker: CrawlerWorkerProcess | undefined;
    const sqsClient = new EmptySqsClient();
    const logSink: OutboxWorkerProductionLogSink = {
      async write(event) {
        events.push(event);
        if (event.kind === "crawler-batch") {
          void worker?.runtime.stop();
        }
      }
    };

    worker = createCrawlerWorkerProcess({
      env: requiredEnv(),
      factories: factories({
        observabilityRuntime:
          recordingObservabilityRuntime(observabilityEvents),
        sqsClient
      }),
      logSink,
      sleep: async () => undefined
    });

    await worker.observability.start();
    worker.runtime.start();
    await worker.runtime.done();
    await worker.observability.shutdown();

    expect(sqsClient.receiveCount).toBe(1);
    expect(observabilityEvents).toEqual([
      "start:searchlint-cloud-worker",
      "shutdown"
    ]);
    expect(events).toEqual([
      {
        kind: "crawler-batch",
        result: {
          received: 0,
          handled: 0,
          succeeded: 0,
          failed: 0,
          invalid: 0,
          deleted: 0,
          skipped: 0,
          canceled: 0,
          backoffApplied: 0
        }
      }
    ]);
  });

  it("installs lifecycle logging only when explicitly requested", async () => {
    const events: OutboxWorkerProductionLogEvent[] = [];
    const signalTarget = new FakeSignalTarget();
    const worker = createCrawlerWorkerProcess({
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

function requiredEnv(): CrawlerWorkerProcessEnv {
  return {
    SEARCHLINT_POSTGRES_DATABASE_URL: "postgres://searchlint.local/db",
    SEARCHLINT_CRAWL_QUEUE_URL: "https://sqs.us-east-1.amazonaws.com/1/crawl",
    SEARCHLINT_CRAWL_ARTIFACT_BUCKET: "searchlint-crawl-artifacts",
    SEARCHLINT_RULE_CATALOG_PATH: "specs/RULE_CATALOG.yaml",
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
    sqsClient?: SqsCrawlerClient;
    observabilityRuntime?: OtlpExporterRuntime;
  } = {}
): Partial<CrawlerWorkerProcessFactories> {
  return {
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
    createSqsClient() {
      options.calls?.push("sqs-client");
      return options.sqsClient ?? new EmptySqsClient();
    },
    createS3Client() {
      options.calls?.push("s3-client");
      return {
        async send() {
          throw new Error("S3 should not be called for empty crawler batches.");
        }
      } satisfies S3PutObjectClient;
    },
    createObservabilityRuntime() {
      options.calls?.push("observability-runtime");
      return options.observabilityRuntime ?? recordingObservabilityRuntime([]);
    },
    readText() {
      options.calls?.push("read-text");
      return readFileSync(
        new URL("../../../specs/RULE_CATALOG.yaml", import.meta.url),
        "utf8"
      );
    },
    async fetch() {
      throw new Error("Fetch should not be called for empty crawler batches.");
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

class EmptySqsClient implements SqsCrawlerClient {
  receiveCount = 0;

  async send(command: unknown): Promise<ReceiveMessageCommandOutput> {
    if (!(command instanceof ReceiveMessageCommand)) {
      throw new Error("Unexpected SQS command.");
    }
    this.receiveCount += 1;
    return {
      Messages: [],
      $metadata: {}
    };
  }
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

function tick(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}
