import { S3Client } from "@aws-sdk/client-s3";
import { SQSClient } from "@aws-sdk/client-sqs";
import { readFileSync } from "node:fs";
import {
  createOpenTelemetryOtlpExporterRuntime,
  createOtlpExporterLifecycle,
  createPgPoolFromEnv,
  createPgQueryExecutor,
  otlpRuntimeConfigFromEnv
} from "@searchlint/api";
import type {
  OtlpExporterLifecycle,
  OtlpExporterRuntime,
  OtlpRuntimeConfig,
  PgPool,
  PostgresQueryExecutor
} from "@searchlint/api";
import type { CrawlResponse, CrawlerFetcher } from "@searchlint/crawler";

import { createCoreCrawlDiagnosticAnalyzer } from "./crawl-diagnostic-analyzer.js";
import { createPostgresCloudCrawlDiagnosticStore } from "./postgres-crawl-diagnostic-store.js";
import {
  createPostgresCloudCrawlJobStore,
  createPostgresCloudCrawlTargetResolver
} from "./postgres-crawl-job-store.js";
import {
  createOutboxWorkerProductionLogSink,
  type OutboxWorkerProductionLogSink
} from "./production-log-sink.js";
import {
  createS3CrawlArtifactStore,
  type S3PutObjectClient
} from "./s3-crawl-artifact-store.js";
import {
  createSqsCrawlerPollingRuntime,
  type SqsCrawlerClient,
  type SqsCrawlerPollingRuntime,
  type SqsCrawlerPollingRuntimeSleep
} from "./sqs-crawler-consumer.js";
import {
  createOutboxWorkerRuntime,
  installOutboxWorkerProcessExitPolicy,
  type OutboxWorkerProcessExitPolicyBinding,
  type OutboxWorkerRuntime,
  type OutboxWorkerShutdownSignalTarget
} from "./worker-lifecycle.js";

export type CrawlerWorkerProcessEnv = Readonly<
  Record<string, string | undefined>
>;

export type CrawlerWorkerProcessFetch = (url: string) => Promise<{
  url: string;
  status: number;
  headers: {
    forEach(callback: (value: string, key: string) => void): void;
  };
  text(): Promise<string>;
}>;

export type CrawlerWorkerProcessConfig = {
  postgresPrefix: "SEARCHLINT_POSTGRES";
  postgresDatabaseUrl: string;
  queueUrl: string;
  artifactBucket: string;
  artifactKeyPrefix?: string;
  ruleCatalogPath: string;
  pollIntervalMs: number;
  batchSize: number;
  waitTimeSeconds?: number;
  visibilityTimeoutSeconds?: number;
  stopOnError: false;
  observability: OtlpRuntimeConfig;
};

export type CrawlerWorkerProcessFactories = {
  createPgPool(env: CrawlerWorkerProcessEnv): PgPool;
  createQueryExecutor(pool: PgPool): PostgresQueryExecutor;
  createSqsClient(): SqsCrawlerClient;
  createS3Client(): S3PutObjectClient;
  createObservabilityRuntime(): OtlpExporterRuntime;
  readText(path: string): string;
  fetch: CrawlerWorkerProcessFetch;
};

export type CrawlerWorkerProcessOptions = {
  env?: CrawlerWorkerProcessEnv;
  factories?: Partial<CrawlerWorkerProcessFactories>;
  logSink?: OutboxWorkerProductionLogSink;
  sleep?: SqsCrawlerPollingRuntimeSleep;
};

export type CrawlerWorkerProcessLifecycleOptions = {
  signalTarget?: OutboxWorkerShutdownSignalTarget;
  exitCodeSink?: (exitCode: number) => void;
};

export type CrawlerWorkerProcess = {
  config: CrawlerWorkerProcessConfig;
  observability: OtlpExporterLifecycle;
  runtime: OutboxWorkerRuntime;
  pollingRuntime: SqsCrawlerPollingRuntime;
  installLifecycle(
    options?: CrawlerWorkerProcessLifecycleOptions
  ): OutboxWorkerProcessExitPolicyBinding;
};

const defaultPollIntervalMs = 1000;
const defaultBatchSize = 5;
const defaultWaitTimeSeconds = 20;
const workerKind = "sqs-crawler-poller";

export function createCrawlerWorkerProcess(
  options: CrawlerWorkerProcessOptions = {}
): CrawlerWorkerProcess {
  const env = options.env ?? process.env;
  const config = crawlerWorkerProcessConfigFromEnv(env);
  const factories = processFactories(options.factories);
  const pool = factories.createPgPool(env);
  const executor = factories.createQueryExecutor(pool);
  const sqsClient = factories.createSqsClient();
  const s3Client = factories.createS3Client();
  const clock = {
    now() {
      return new Date().toISOString();
    }
  };
  const ruleCatalogText = factories.readText(config.ruleCatalogPath);
  const logSink =
    options.logSink ??
    createOutboxWorkerProductionLogSink({
      workerKind
    });
  const pollingRuntime = createSqsCrawlerPollingRuntime({
    client: sqsClient,
    queueUrl: config.queueUrl,
    maxMessages: config.batchSize,
    ...(config.waitTimeSeconds === undefined
      ? {}
      : { waitTimeSeconds: config.waitTimeSeconds }),
    ...(config.visibilityTimeoutSeconds === undefined
      ? {}
      : { visibilityTimeoutSeconds: config.visibilityTimeoutSeconds }),
    targetResolver: createPostgresCloudCrawlTargetResolver(executor),
    fetcher: createNodeCrawlerFetcher(factories.fetch),
    store: createPostgresCloudCrawlJobStore(executor),
    artifactStore: createS3CrawlArtifactStore({
      client: s3Client,
      bucket: config.artifactBucket,
      ...(config.artifactKeyPrefix === undefined
        ? {}
        : { keyPrefix: config.artifactKeyPrefix })
    }),
    diagnosticAnalyzer: createCoreCrawlDiagnosticAnalyzer({
      catalogText: ruleCatalogText
    }),
    diagnosticStore: createPostgresCloudCrawlDiagnosticStore({
      executor,
      clock
    }),
    clock,
    intervalMs: config.pollIntervalMs,
    ...(options.sleep === undefined ? {} : { sleep: options.sleep }),
    stopOnError: config.stopOnError,
    onBatch(result) {
      return logSink.write({
        kind: "crawler-batch",
        result
      });
    },
    onError(error) {
      return logSink.write({
        kind: "error",
        error,
        phase: "crawler-poll"
      });
    }
  });
  const runtime = createOutboxWorkerRuntime(pollingRuntime);

  return {
    config,
    observability: createOtlpExporterLifecycle({
      config: config.observability,
      runtime: factories.createObservabilityRuntime()
    }),
    runtime,
    pollingRuntime,
    installLifecycle(lifecycleOptions = {}) {
      return installOutboxWorkerProcessExitPolicy(runtime, {
        ...(lifecycleOptions.signalTarget === undefined
          ? {}
          : { target: lifecycleOptions.signalTarget }),
        ...(lifecycleOptions.exitCodeSink === undefined
          ? {}
          : { exitCodeSink: lifecycleOptions.exitCodeSink }),
        onStateChange(event) {
          return logSink.write({
            kind: "lifecycle",
            event
          });
        }
      });
    }
  };
}

export function crawlerWorkerProcessConfigFromEnv(
  env: CrawlerWorkerProcessEnv
): CrawlerWorkerProcessConfig {
  const artifactKeyPrefix = optionalEnv(
    env,
    "SEARCHLINT_CRAWL_ARTIFACT_KEY_PREFIX"
  );
  const visibilityTimeoutSeconds = optionalEnv(
    env,
    "SEARCHLINT_WORKER_CRAWLER_VISIBILITY_TIMEOUT_SECONDS"
  );

  return {
    postgresPrefix: "SEARCHLINT_POSTGRES",
    postgresDatabaseUrl: requiredEnv(env, "SEARCHLINT_POSTGRES_DATABASE_URL"),
    queueUrl: requiredEnv(env, "SEARCHLINT_CRAWL_QUEUE_URL"),
    artifactBucket: requiredEnv(env, "SEARCHLINT_CRAWL_ARTIFACT_BUCKET"),
    ...(artifactKeyPrefix === undefined ? {} : { artifactKeyPrefix }),
    ruleCatalogPath: requiredEnv(env, "SEARCHLINT_RULE_CATALOG_PATH"),
    pollIntervalMs: optionalPositiveInteger(
      env,
      "SEARCHLINT_WORKER_CRAWLER_POLL_INTERVAL_MS",
      defaultPollIntervalMs
    ),
    batchSize: optionalBoundedInteger(
      env,
      "SEARCHLINT_WORKER_CRAWLER_BATCH_SIZE",
      defaultBatchSize,
      1,
      10
    ),
    waitTimeSeconds: optionalBoundedInteger(
      env,
      "SEARCHLINT_WORKER_CRAWLER_WAIT_TIME_SECONDS",
      defaultWaitTimeSeconds,
      0,
      20
    ),
    ...(visibilityTimeoutSeconds === undefined
      ? {}
      : {
          visibilityTimeoutSeconds: optionalNonNegativeInteger(
            env,
            "SEARCHLINT_WORKER_CRAWLER_VISIBILITY_TIMEOUT_SECONDS"
          )
        }),
    stopOnError: false,
    observability: otlpRuntimeConfigFromEnv(env)
  };
}

export function createNodeCrawlerFetcher(
  fetchFn: CrawlerWorkerProcessFetch = defaultFetch
): CrawlerFetcher {
  return {
    async fetch(url): Promise<CrawlResponse> {
      const response = await fetchFn(url);
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });
      return {
        url: response.url,
        statusCode: response.status,
        headers,
        body: await response.text()
      };
    }
  };
}

function processFactories(
  overrides: Partial<CrawlerWorkerProcessFactories> = {}
): CrawlerWorkerProcessFactories {
  return {
    createPgPool:
      overrides.createPgPool ??
      ((env) =>
        createPgPoolFromEnv(env, {
          prefix: "SEARCHLINT_POSTGRES"
        })),
    createQueryExecutor:
      overrides.createQueryExecutor ?? ((pool) => createPgQueryExecutor(pool)),
    createSqsClient: overrides.createSqsClient ?? (() => new SQSClient({})),
    createS3Client: overrides.createS3Client ?? (() => new S3Client({})),
    createObservabilityRuntime:
      overrides.createObservabilityRuntime ??
      createOpenTelemetryOtlpExporterRuntime,
    readText: overrides.readText ?? ((path) => readFileSync(path, "utf8")),
    fetch: overrides.fetch ?? defaultFetch
  };
}

function requiredEnv(env: CrawlerWorkerProcessEnv, name: string): string {
  const value = optionalEnv(env, name);
  if (value === undefined) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function optionalEnv(
  env: CrawlerWorkerProcessEnv,
  name: string
): string | undefined {
  const value = env[name]?.trim();
  return value && value.length > 0 ? value : undefined;
}

function optionalPositiveInteger(
  env: CrawlerWorkerProcessEnv,
  name: string,
  fallback: number
): number {
  const value = optionalEnv(env, name);
  if (value === undefined) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsed;
}

function optionalBoundedInteger(
  env: CrawlerWorkerProcessEnv,
  name: string,
  fallback: number,
  min: number,
  max: number
): number {
  const value = optionalEnv(env, name);
  if (value === undefined) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${name} must be an integer from ${min} to ${max}.`);
  }
  return parsed;
}

function optionalNonNegativeInteger(
  env: CrawlerWorkerProcessEnv,
  name: string
): number {
  const value = optionalEnv(env, name);
  if (value === undefined) {
    throw new Error(`${name} is required.`);
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative integer.`);
  }
  return parsed;
}

function defaultFetch(url: string): ReturnType<CrawlerWorkerProcessFetch> {
  const fetchFn = (globalThis as { fetch?: CrawlerWorkerProcessFetch }).fetch;
  if (fetchFn === undefined) {
    throw new Error("globalThis.fetch is required for crawler worker process.");
  }
  return fetchFn(url);
}
