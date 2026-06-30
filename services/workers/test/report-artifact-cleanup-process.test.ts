import type { DeleteObjectCommand } from "@aws-sdk/client-s3";
import type {
  PgPool,
  PostgresQueryExecutor,
  ReportRetentionStore
} from "@searchlint/api";
import type { OtlpExporterRuntime } from "@searchlint/api";
import { describe, expect, it } from "vitest";

import {
  createReportArtifactCleanupProcess,
  reportArtifactCleanupProcessConfigFromEnv
} from "../src/index.js";
import type {
  OutboxWorkerProductionLogEvent,
  OutboxWorkerProductionLogSink,
  ReportArtifactCleanupProcess,
  ReportArtifactCleanupProcessEnv,
  ReportArtifactCleanupProcessFactories,
  S3DeleteObjectClient
} from "../src/index.js";

describe("reportArtifactCleanupProcessConfigFromEnv", () => {
  it("parses required process env with stable cleanup defaults", () => {
    const config = reportArtifactCleanupProcessConfigFromEnv(requiredEnv());

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

  it("parses optional polling overrides", () => {
    expect(
      reportArtifactCleanupProcessConfigFromEnv({
        ...requiredEnv(),
        SEARCHLINT_WORKER_REPORT_ARTIFACT_CLEANUP_POLL_INTERVAL_MS: "5000",
        SEARCHLINT_WORKER_REPORT_ARTIFACT_CLEANUP_BATCH_SIZE: "75"
      })
    ).toMatchObject({
      pollIntervalMs: 5000,
      batchSize: 75
    });
  });

  it("rejects missing required env before clients are created", () => {
    const calls: string[] = [];

    expect(() =>
      createReportArtifactCleanupProcess({
        env: {},
        factories: factories({
          calls
        })
      })
    ).toThrow("SEARCHLINT_POSTGRES_DATABASE_URL is required.");
    expect(calls).toEqual([]);
  });

  it("logs cleanup batches through the production log sink", async () => {
    const events: OutboxWorkerProductionLogEvent[] = [];
    let worker: ReportArtifactCleanupProcess | undefined;
    const reportStore = reportRetentionStore({
      artifactUri: "s3://searchlint-reports/org-1/report.html"
    });
    const s3Client = new RecordingS3DeleteClient();
    const logSink: OutboxWorkerProductionLogSink = {
      async write(event) {
        events.push(event);
        if (event.kind === "report-cleanup-batch") {
          void worker?.runtime.stop();
        }
      }
    };

    worker = createReportArtifactCleanupProcess({
      env: requiredEnv(),
      factories: factories({
        reportStore,
        s3Client,
        observabilityRuntime: recordingObservabilityRuntime([])
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

    expect(reportStore.calls).toEqual([
      "select:2026-06-21T00:00:00.000Z:25",
      "deleting:report-1",
      "deleted:report-1"
    ]);
    expect(s3Client.deletes).toEqual([
      {
        Bucket: "searchlint-reports",
        Key: "org-1/report.html"
      }
    ]);
    expect(events).toEqual([
      {
        kind: "report-cleanup-batch",
        result: {
          selected: 1,
          leased: 1,
          deleted: 1,
          failed: 0,
          skipped: 0
        }
      }
    ]);
  });
});

function requiredEnv(): ReportArtifactCleanupProcessEnv {
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
    reportStore?: ReportRetentionStore;
    s3Client?: S3DeleteObjectClient;
    observabilityRuntime?: OtlpExporterRuntime;
  } = {}
): Partial<ReportArtifactCleanupProcessFactories> {
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
    createReportRetentionStore() {
      options.calls?.push("report-store");
      return options.reportStore ?? reportRetentionStore();
    },
    createS3Client() {
      options.calls?.push("s3-client");
      return options.s3Client ?? new RecordingS3DeleteClient();
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

function reportRetentionStore(
  options: { artifactUri?: string } = {}
): ReportRetentionStore & { calls: string[] } {
  const calls: string[] = [];
  const artifact = {
    id: "report-1",
    organizationId: "org-1",
    projectId: "project-1",
    environmentId: "env-1",
    reportKind: "html" as const,
    ...(options.artifactUri === undefined
      ? {}
      : { artifactUri: options.artifactUri }),
    pinned: false,
    generatedAt: "2026-06-01T00:00:00.000Z",
    retentionUntil: "2026-06-20T00:00:00.000Z",
    deletionState: "active" as const,
    createdAt: "2026-06-01T00:00:00.000Z"
  };

  return {
    calls,
    async insertReportArtifact() {
      throw new Error("insertReportArtifact should not be called.");
    },
    async selectExpiredReportArtifacts(input) {
      calls.push(`select:${input.now}:${input.limit}`);
      return [artifact];
    },
    async markReportArtifactDeleting(input) {
      calls.push(`deleting:${input.id}`);
      return {
        ...artifact,
        deletionState: "deleting"
      };
    },
    async markReportArtifactDeleted(input) {
      calls.push(`deleted:${input.id}`);
      const { artifactUri: _artifactUri, ...deletedArtifact } = artifact;
      return {
        ...deletedArtifact,
        deletionState: "deleted"
      };
    },
    async markReportArtifactDeletionFailed(input) {
      calls.push(`failed:${input.id}`);
      return artifact;
    }
  };
}

class RecordingS3DeleteClient implements S3DeleteObjectClient {
  readonly deletes: Array<{
    Bucket: string;
    Key: string;
  }> = [];

  async send(command: DeleteObjectCommand): Promise<unknown> {
    if (command.input.Bucket === undefined || command.input.Key === undefined) {
      throw new Error("DeleteObjectCommand must include Bucket and Key.");
    }
    this.deletes.push({
      Bucket: command.input.Bucket,
      Key: command.input.Key
    });
    return {
      $metadata: {}
    };
  }
}
