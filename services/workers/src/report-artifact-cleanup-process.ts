import { S3Client } from "@aws-sdk/client-s3";
import {
  createOpenTelemetryOtlpExporterRuntime,
  createOtlpExporterLifecycle,
  createPgPoolFromEnv,
  createPgQueryExecutor,
  createPostgresReportRetentionStore,
  otlpRuntimeConfigFromEnv
} from "@searchlint/api";
import type {
  OtlpExporterLifecycle,
  OtlpExporterRuntime,
  OtlpRuntimeConfig,
  PgPool,
  PostgresQueryExecutor,
  ReportRetentionStore
} from "@searchlint/api";

import {
  createOutboxWorkerProductionLogSink,
  type OutboxWorkerProductionLogSink
} from "./production-log-sink.js";
import {
  createReportArtifactCleanupPollingRuntime,
  type ReportArtifactCleanupClock,
  type ReportArtifactCleanupPollingRuntime,
  type ReportArtifactCleanupPollingRuntimeSleep
} from "./report-artifact-retention-worker.js";
import {
  createS3ReportArtifactObjectStore,
  type S3DeleteObjectClient
} from "./s3-report-artifact-store.js";
import {
  createOutboxWorkerRuntime,
  installOutboxWorkerProcessExitPolicy,
  type OutboxWorkerProcessExitPolicyBinding,
  type OutboxWorkerRuntime,
  type OutboxWorkerShutdownSignalTarget
} from "./worker-lifecycle.js";

export type ReportArtifactCleanupProcessEnv = Readonly<
  Record<string, string | undefined>
>;

export type ReportArtifactCleanupProcessConfig = {
  postgresPrefix: "SEARCHLINT_POSTGRES";
  postgresDatabaseUrl: string;
  pollIntervalMs: number;
  batchSize: number;
  stopOnError: false;
  observability: OtlpRuntimeConfig;
};

export type ReportArtifactCleanupProcessFactories = {
  createPgPool(env: ReportArtifactCleanupProcessEnv): PgPool;
  createQueryExecutor(pool: PgPool): PostgresQueryExecutor;
  createReportRetentionStore(
    executor: PostgresQueryExecutor
  ): ReportRetentionStore;
  createS3Client(): S3DeleteObjectClient;
  createObservabilityRuntime(): OtlpExporterRuntime;
};

export type ReportArtifactCleanupProcessOptions = {
  env?: ReportArtifactCleanupProcessEnv;
  factories?: Partial<ReportArtifactCleanupProcessFactories>;
  logSink?: OutboxWorkerProductionLogSink;
  sleep?: ReportArtifactCleanupPollingRuntimeSleep;
  clock?: ReportArtifactCleanupClock;
};

export type ReportArtifactCleanupProcessLifecycleOptions = {
  signalTarget?: OutboxWorkerShutdownSignalTarget;
  exitCodeSink?: (exitCode: number) => void;
};

export type ReportArtifactCleanupProcess = {
  config: ReportArtifactCleanupProcessConfig;
  observability: OtlpExporterLifecycle;
  runtime: OutboxWorkerRuntime;
  pollingRuntime: ReportArtifactCleanupPollingRuntime;
  installLifecycle(
    options?: ReportArtifactCleanupProcessLifecycleOptions
  ): OutboxWorkerProcessExitPolicyBinding;
};

const defaultPollIntervalMs = 60_000;
const defaultBatchSize = 25;
const workerKind = "report-artifact-cleanup-poller";

export function createReportArtifactCleanupProcess(
  options: ReportArtifactCleanupProcessOptions = {}
): ReportArtifactCleanupProcess {
  const env = options.env ?? process.env;
  const config = reportArtifactCleanupProcessConfigFromEnv(env);
  const factories = processFactories(options.factories);
  const pool = factories.createPgPool(env);
  const executor = factories.createQueryExecutor(pool);
  const store = factories.createReportRetentionStore(executor);
  const s3Client = factories.createS3Client();
  const logSink =
    options.logSink ??
    createOutboxWorkerProductionLogSink({
      workerKind
    });
  const pollingRuntime = createReportArtifactCleanupPollingRuntime({
    store,
    objectStore: createS3ReportArtifactObjectStore({
      client: s3Client
    }),
    clock:
      options.clock ??
      ({
        now() {
          return new Date().toISOString();
        }
      } satisfies ReportArtifactCleanupClock),
    limit: config.batchSize,
    intervalMs: config.pollIntervalMs,
    ...(options.sleep === undefined ? {} : { sleep: options.sleep }),
    stopOnError: config.stopOnError,
    onBatch(result) {
      return logSink.write({
        kind: "report-cleanup-batch",
        result
      });
    },
    onError(error) {
      return logSink.write({
        kind: "error",
        error,
        phase: "report-artifact-cleanup-poll"
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

export function reportArtifactCleanupProcessConfigFromEnv(
  env: ReportArtifactCleanupProcessEnv
): ReportArtifactCleanupProcessConfig {
  return {
    postgresPrefix: "SEARCHLINT_POSTGRES",
    postgresDatabaseUrl: requiredEnv(env, "SEARCHLINT_POSTGRES_DATABASE_URL"),
    pollIntervalMs: optionalPositiveInteger(
      env,
      "SEARCHLINT_WORKER_REPORT_ARTIFACT_CLEANUP_POLL_INTERVAL_MS",
      defaultPollIntervalMs
    ),
    batchSize: optionalBoundedInteger(
      env,
      "SEARCHLINT_WORKER_REPORT_ARTIFACT_CLEANUP_BATCH_SIZE",
      defaultBatchSize,
      1,
      100
    ),
    stopOnError: false,
    observability: otlpRuntimeConfigFromEnv(env)
  };
}

function processFactories(
  overrides: Partial<ReportArtifactCleanupProcessFactories> = {}
): ReportArtifactCleanupProcessFactories {
  return {
    createPgPool:
      overrides.createPgPool ??
      ((env) =>
        createPgPoolFromEnv(env, {
          prefix: "SEARCHLINT_POSTGRES"
        })),
    createQueryExecutor:
      overrides.createQueryExecutor ?? ((pool) => createPgQueryExecutor(pool)),
    createReportRetentionStore:
      overrides.createReportRetentionStore ??
      ((executor) => createPostgresReportRetentionStore(executor)),
    createS3Client: overrides.createS3Client ?? (() => new S3Client({})),
    createObservabilityRuntime:
      overrides.createObservabilityRuntime ??
      createOpenTelemetryOtlpExporterRuntime
  };
}

function requiredEnv(
  env: ReportArtifactCleanupProcessEnv,
  name: string
): string {
  const value = optionalEnv(env, name);
  if (value === undefined) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function optionalEnv(
  env: ReportArtifactCleanupProcessEnv,
  name: string
): string | undefined {
  const value = env[name]?.trim();
  return value && value.length > 0 ? value : undefined;
}

function optionalPositiveInteger(
  env: ReportArtifactCleanupProcessEnv,
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
  env: ReportArtifactCleanupProcessEnv,
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
