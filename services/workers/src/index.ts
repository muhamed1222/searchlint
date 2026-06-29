import type { CloudOutboxEvent, CrawlJobPayload } from "@searchlint/api";

export {
  executeCrawlRequestedJob,
  type CloudCrawlArtifactStore,
  type CloudCrawlDiagnosticAnalysisInput,
  type CloudCrawlDiagnosticAnalyzer,
  type CloudCrawlDiagnosticIngestionStore,
  type CloudCrawlJobStore,
  type CloudCrawlResultArtifact,
  type CloudCrawlTarget,
  type CloudCrawlTargetResolver,
  type CloudCrawlerExecutionClock,
  type CloudCrawlerExecutionStatus,
  type CloudCrawlerExecutionSummary,
  type ExecuteCrawlRequestedJobInput
} from "./crawler-execution-worker.js";
export {
  createPostgresCrawlJobHistoryStore,
  summarizeCrawlJobHistory,
  type CrawlJobHistoryInput,
  type CrawlJobHistoryStore,
  type CrawlJobHistorySummary
} from "./crawl-job-history.js";
export {
  defaultWorkerAlertDefinitions,
  validateWorkerAlertDefinitions,
  workerMetricsFromCrawlerBatch,
  workerMetricsFromExternalObservationBatch,
  workerMetricsFromOutboxBatch,
  workerMetricsFromReportArtifactCleanupBatch,
  workerQueueDepthMetric,
  workerQueueOldestMessageAgeMetric,
  workerRuntimeErrorMetric,
  type OutboxBatchMetricResult,
  type WorkerAlertComparator,
  type WorkerAlertDefinition,
  type WorkerAlertSeverity,
  type WorkerAlertValidationIssue,
  type WorkerMetricContext,
  type WorkerMetricDimensions,
  type WorkerMetricName,
  type WorkerMetricSample,
  type WorkerMetricUnit
} from "./worker-metrics-alerts.js";
export {
  crawlerWorkerAutoscalingContract,
  validateWorkerAutoscalingContract,
  type WorkerAutoscalingContract,
  type WorkerAutoscalingIamAction,
  type WorkerAutoscalingMetricType,
  type WorkerAutoscalingPolicyType,
  type WorkerAutoscalingProvider,
  type WorkerAutoscalingScalableDimension,
  type WorkerAutoscalingServiceNamespace,
  type WorkerAutoscalingValidationIssue
} from "./worker-autoscaling-contracts.js";
export {
  createCoreCrawlDiagnosticAnalyzer,
  type CoreCrawlDiagnosticAnalyzerOptions
} from "./crawl-diagnostic-analyzer.js";
export {
  cloudWorkerDeploymentContract,
  validateCloudWorkerDeploymentContract,
  type CloudWorkerComputeKind,
  type CloudWorkerDeploymentContract,
  type CloudWorkerDeploymentEnvironmentVariable,
  type CloudWorkerDeploymentValidationIssue,
  type CloudWorkerLogSink,
  type CloudWorkerQueueProvider,
  type CloudWorkerRuntimeKind,
  type CloudWorkerSecretSource,
  type CloudWorkerShutdownSignal
} from "./deployment-contracts.js";
export {
  reportArtifactCleanupScheduleContract,
  validateReportArtifactCleanupScheduleContract,
  type ReportArtifactCleanupScheduleContract,
  type ReportArtifactCleanupScheduleProvider,
  type ReportArtifactCleanupScheduleSecretSource,
  type ReportArtifactCleanupScheduleTarget,
  type ReportArtifactCleanupScheduleValidationIssue
} from "./report-artifact-cleanup-schedule-contracts.js";
export {
  externalObservationScheduleContract,
  validateExternalObservationScheduleContract,
  type ExternalObservationScheduleContract,
  type ExternalObservationScheduleProvider,
  type ExternalObservationScheduleTarget,
  type ExternalObservationScheduleValidationIssue
} from "./external-observation-schedule-contracts.js";
export {
  createSqsOutboxPublisher,
  type SqsCrawlRequestedMessage,
  type SqsOutboxPublisherOptions,
  type SqsSendClient
} from "./sqs-publisher.js";
export {
  crawlerWorkerProcessConfigFromEnv,
  createCrawlerWorkerProcess,
  createNodeCrawlerFetcher,
  type CrawlerWorkerProcess,
  type CrawlerWorkerProcessConfig,
  type CrawlerWorkerProcessEnv,
  type CrawlerWorkerProcessFactories,
  type CrawlerWorkerProcessFetch,
  type CrawlerWorkerProcessLifecycleOptions,
  type CrawlerWorkerProcessOptions
} from "./crawler-worker-process.js";
export {
  createReportArtifactCleanupProcess,
  reportArtifactCleanupProcessConfigFromEnv,
  type ReportArtifactCleanupProcess,
  type ReportArtifactCleanupProcessConfig,
  type ReportArtifactCleanupProcessEnv,
  type ReportArtifactCleanupProcessFactories,
  type ReportArtifactCleanupProcessLifecycleOptions,
  type ReportArtifactCleanupProcessOptions
} from "./report-artifact-cleanup-process.js";
export {
  createExternalObservationCollectionProcess,
  externalObservationCollectionProcessConfigFromEnv,
  type ExternalObservationCollectionProcess,
  type ExternalObservationCollectionProcessConfig,
  type ExternalObservationCollectionProcessEnv,
  type ExternalObservationCollectionProcessFactories,
  type ExternalObservationCollectionProcessLifecycleOptions,
  type ExternalObservationCollectionOAuthRefreshConfig,
  type ExternalObservationCollectionOAuthRefreshProviderConfig,
  type ExternalObservationCollectionProcessOptions
} from "./external-observation-collection-process.js";
export {
  ExternalObservationOAuthRefreshError,
  createGoogleOAuthTokenRefresher,
  createYandexOAuthTokenRefresher,
  type ExternalObservationOAuthRefreshFetch,
  type ExternalObservationOAuthRefreshFetchResponse,
  type ExternalObservationOAuthRefreshInput,
  type ExternalObservationOAuthRefreshResult,
  type ExternalObservationOAuthTokenRefresher,
  type ExternalObservationOAuthTokenRefreshers,
  type OAuthRefreshAdapterOptions,
  type OAuthRefreshClientCredentials
} from "./external-observation-oauth-refresh.js";
export {
  runSearchLintReportArtifactCleanupNodeProcess,
  type ReportArtifactCleanupNodeProcessFactory,
  type ReportArtifactCleanupNodeProcessLike,
  type ReportArtifactCleanupNodeRunnerOptions,
  type ReportArtifactCleanupNodeWritable
} from "./report-artifact-cleanup-node.js";
export {
  runSearchLintExternalObservationCollectionNodeProcess,
  type ExternalObservationCollectionNodeProcessFactory,
  type ExternalObservationCollectionNodeProcessLike,
  type ExternalObservationCollectionNodeRunnerOptions,
  type ExternalObservationCollectionNodeWritable
} from "./external-observation-collection-node.js";
export {
  consumeSqsCrawlBatch,
  createSqsCrawlerPollingRuntime,
  sqsCrawlerBackoffVisibilityTimeoutSeconds,
  type SqsCrawlBatchResult,
  type SqsCrawlerClient,
  type SqsCrawlerConsumerOptions,
  type SqsCrawlerPollingRuntime,
  type SqsCrawlerPollingRuntimeOptions,
  type SqsCrawlerPollingRuntimeSleep,
  type SqsCrawlerRetryBackoffPolicy
} from "./sqs-crawler-consumer.js";
export {
  createS3CrawlArtifactStore,
  type S3CrawlArtifactStoreOptions,
  type S3PutObjectClient
} from "./s3-crawl-artifact-store.js";
export {
  createS3PageSnapshotArtifactStore,
  type PageSnapshotArtifact,
  type PageSnapshotArtifactUploadResult,
  type S3PageSnapshotArtifactStore,
  type S3PageSnapshotArtifactStoreOptions,
  type S3PageSnapshotPutObjectClient
} from "./s3-page-snapshot-artifact-store.js";
export {
  createObjectStorageRestorePlan,
  type ObjectStorageRestorePlan,
  type ObjectStorageRestorePlanInput,
  type ObjectStorageRestoreScope
} from "./object-storage-restore-contract.js";
export {
  createReportArtifactSignedUrlService,
  createS3ReportArtifactObjectStore,
  parseS3ArtifactUri,
  type CreateReportArtifactSignedUrlInput,
  type ReportArtifactSignedUrlMetadata,
  type ReportArtifactSignedUrlPresigner,
  type ReportArtifactSignedUrlResult,
  type ReportArtifactSignedUrlServiceOptions,
  type S3DeleteObjectClient,
  type S3DeleteReportArtifactOutput,
  type S3ReportArtifactStoreOptions
} from "./s3-report-artifact-store.js";
export {
  createSearchLintSecretRefResolver,
  createSecretsManagerExternalObservationAccessTokenVault,
  type SecretsManagerExternalObservationAccessTokenVaultOptions,
  type SecretsManagerExternalObservationSecretIdResolver,
  type SecretsManagerExternalObservationSecretIdResolverInput,
  type SecretsManagerGetSecretValueClient
} from "./secrets-manager-external-observation-vault.js";
export {
  createReportArtifactCleanupPollingRuntime,
  deleteExpiredReportArtifacts,
  type DeleteExpiredReportArtifactsInput,
  type DeleteExpiredReportArtifactsResult,
  type ReportArtifactCleanupClock,
  type ReportArtifactCleanupPollingRuntime,
  type ReportArtifactCleanupPollingRuntimeOptions,
  type ReportArtifactCleanupPollingRuntimeSleep,
  type ReportArtifactObjectStore
} from "./report-artifact-retention-worker.js";
export {
  collectExternalObservationsBatch,
  createExternalObservationCollectionPollingRuntime,
  type CollectExternalObservationsBatchInput,
  type CollectExternalObservationsBatchResult,
  type ExternalObservationAccessTokenVault,
  type ExternalObservationCollectionClock,
  type ExternalObservationCollectionPollingRuntime,
  type ExternalObservationCollectionPollingRuntimeOptions,
  type ExternalObservationCollectionPollingRuntimeSleep,
  type ExternalObservationProviderCollector,
  type ExternalObservationProviderCollectorInput,
  type ExternalObservationProviderCollectors
} from "./external-observation-collection-worker.js";
export {
  createConfiguredExternalObservationTargetResolver,
  createExternalObservationProviderCollectors,
  createGoogleExternalObservationCollector,
  createYandexExternalObservationCollector,
  type ExternalObservationProviderCollectorsOptions,
  type ExternalObservationProviderTargetConfig,
  type ExternalObservationProviderTargetResolver,
  type ExternalObservationProviderTargetResolverInput,
  type ExternalObservationTargetDiscoveryConfig,
  type GoogleExternalObservationTarget,
  type YandexExternalObservationTarget
} from "./external-observation-provider-collectors.js";
export {
  cloudWorkerSqsProvisioningContract,
  validateCloudWorkerSqsProvisioningContract,
  type CloudWorkerSqsDeadLetterQueueContract,
  type CloudWorkerSqsEncryptionMode,
  type CloudWorkerSqsIamAction,
  type CloudWorkerSqsIamPrincipal,
  type CloudWorkerSqsIamStatementContract,
  type CloudWorkerSqsProvisioningContract,
  type CloudWorkerSqsProvisioningProvider,
  type CloudWorkerSqsProvisioningValidationIssue,
  type CloudWorkerSqsQueueContract,
  type CloudWorkerSqsQueueType,
  type CloudWorkerSqsResourceRef
} from "./sqs-provisioning-contracts.js";
export {
  deliverDueNotifications,
  type NotificationDeliveryQueueStore,
  type NotificationDeliverySink,
  type NotificationDeliverySinks,
  type NotificationDeliveryWorkerOptions,
  type NotificationDeliveryWorkerResult,
  type PendingNotificationDelivery
} from "./notification-delivery-worker.js";
export {
  notificationDeliveryScheduleContract,
  validateNotificationDeliveryScheduleContract,
  type NotificationDeliveryScheduleContract,
  type NotificationDeliveryScheduleProvider,
  type NotificationDeliveryScheduleTarget,
  type NotificationDeliveryScheduleValidationIssue
} from "./notification-delivery-schedule-contracts.js";
export { createPostgresOutboxDispatchStore } from "./postgres-outbox-dispatch-store.js";
export {
  createPostgresCloudCrawlJobStore,
  createPostgresCloudCrawlTargetResolver
} from "./postgres-crawl-job-store.js";
export {
  createPostgresCloudCrawlDiagnosticStore,
  type CloudCrawlDiagnosticStoreClock,
  type CloudCrawlDiagnosticStoreIds,
  type PostgresCloudCrawlDiagnosticStoreOptions
} from "./postgres-crawl-diagnostic-store.js";
export {
  createOutboxWorkerProductionLogSink,
  outboxWorkerProductionLogRecord,
  workerLogRecordContainsSecret,
  type OutboxWorkerProductionLogClock,
  type OutboxWorkerProductionLogEvent,
  type OutboxWorkerProductionLogRecord,
  type OutboxWorkerProductionLogSeverity,
  type OutboxWorkerProductionLogSink,
  type OutboxWorkerProductionLogSinkOptions,
  type OutboxWorkerProductionLogWriter
} from "./production-log-sink.js";
export {
  createOutboxWorkerRuntime,
  installOutboxWorkerEcsTaskLifecycle,
  installOutboxWorkerProcessExitPolicy,
  installOutboxWorkerShutdownSignals,
  type OutboxWorkerEcsTaskLifecycleBinding,
  type OutboxWorkerEcsTaskLifecycleEvent,
  type OutboxWorkerEcsTaskLifecycleOptions,
  type OutboxWorkerEcsTaskLifecycleState,
  type OutboxWorkerProcessExitCodeSink,
  type OutboxWorkerProcessExitPolicyBinding,
  type OutboxWorkerProcessExitPolicyOptions,
  type OutboxWorkerRuntime,
  type OutboxWorkerShutdownResult,
  type OutboxWorkerShutdownSignal,
  type OutboxWorkerShutdownSignalBinding,
  type OutboxWorkerShutdownSignalErrorEvent,
  type OutboxWorkerShutdownSignalEvent,
  type OutboxWorkerShutdownSignalOptions,
  type OutboxWorkerShutdownSignalStartEvent,
  type OutboxWorkerShutdownSignalTarget
} from "./worker-lifecycle.js";

export type OutboxDispatchStore = {
  selectPending(input: {
    now: string;
    limit: number;
  }): Promise<readonly CloudOutboxEvent[]>;
  markProcessing(input: {
    organizationId: string;
    id: string;
    lockedAt: string;
  }): Promise<CloudOutboxEvent | undefined>;
  markPublished(input: {
    organizationId: string;
    id: string;
    publishedAt: string;
  }): Promise<CloudOutboxEvent | undefined>;
  markFailed(input: {
    organizationId: string;
    id: string;
    lastError: string;
    availableAt: string;
  }): Promise<CloudOutboxEvent | undefined>;
};

export type OutboxPublisher = {
  publishCrawlRequested(payload: CrawlJobPayload): Promise<void>;
};

export type OutboxDispatcherClock = {
  now(): string;
};

export type OutboxRetryPolicy = {
  nextAvailableAt(input: {
    event: CloudOutboxEvent;
    failedAt: string;
    error: Error;
  }): string;
};

export type DispatchOutboxBatchInput = {
  store: OutboxDispatchStore;
  publisher: OutboxPublisher;
  clock: OutboxDispatcherClock;
  retryPolicy: OutboxRetryPolicy;
  limit: number;
};

export type DispatchOutboxBatchResult = {
  selected: number;
  leased: number;
  published: number;
  failed: number;
  skipped: number;
};

export type OutboxPollingRuntimeSleep = (
  intervalMs: number,
  signal: AbortSignal
) => Promise<void>;

export type OutboxPollingRuntimeOptions = DispatchOutboxBatchInput & {
  intervalMs: number;
  sleep?: OutboxPollingRuntimeSleep;
  onBatch?: (result: DispatchOutboxBatchResult) => void | Promise<void>;
  onError?: (error: Error) => void | Promise<void>;
  stopOnError?: boolean;
};

export type OutboxPollingRuntime = {
  start(): void;
  stop(): Promise<void>;
  done(): Promise<void>;
  isRunning(): boolean;
};

export async function dispatchOutboxBatch(
  input: DispatchOutboxBatchInput
): Promise<DispatchOutboxBatchResult> {
  if (!Number.isInteger(input.limit) || input.limit < 1) {
    throw new Error("Outbox dispatch limit must be a positive integer.");
  }

  const now = input.clock.now();
  const events = await input.store.selectPending({
    now,
    limit: input.limit
  });
  const result: DispatchOutboxBatchResult = {
    selected: events.length,
    leased: 0,
    published: 0,
    failed: 0,
    skipped: 0
  };

  for (const event of events) {
    const lockedAt = input.clock.now();
    const leased = await input.store.markProcessing({
      organizationId: event.organizationId,
      id: event.id,
      lockedAt
    });
    if (!leased) {
      result.skipped += 1;
      continue;
    }
    result.leased += 1;

    try {
      await publishEvent(input.publisher, leased);
      await input.store.markPublished({
        organizationId: leased.organizationId,
        id: leased.id,
        publishedAt: input.clock.now()
      });
      result.published += 1;
    } catch (error) {
      const failedAt = input.clock.now();
      await input.store.markFailed({
        organizationId: leased.organizationId,
        id: leased.id,
        lastError: errorMessage(error),
        availableAt: input.retryPolicy.nextAvailableAt({
          event: leased,
          failedAt,
          error: asError(error)
        })
      });
      result.failed += 1;
    }
  }

  return result;
}

export function createOutboxPollingRuntime(
  options: OutboxPollingRuntimeOptions
): OutboxPollingRuntime {
  if (!Number.isInteger(options.intervalMs) || options.intervalMs < 1) {
    throw new Error("Outbox polling interval must be a positive integer.");
  }

  const sleep = options.sleep ?? defaultSleep;
  let running = false;
  let stopRequested = false;
  let controller: AbortController | undefined;
  let donePromise: Promise<void> = Promise.resolve();

  async function runLoop(signal: AbortSignal): Promise<void> {
    while (!stopRequested && !signal.aborted) {
      try {
        const result = await dispatchOutboxBatch(options);
        await options.onBatch?.(result);
      } catch (error) {
        const normalized = asError(error);
        await options.onError?.(normalized);
        if (options.stopOnError === true) {
          throw normalized;
        }
      }

      if (!stopRequested && !signal.aborted) {
        await sleep(options.intervalMs, signal);
      }
    }
  }

  return {
    start() {
      if (running) {
        throw new Error("Outbox polling runtime is already running.");
      }
      stopRequested = false;
      running = true;
      controller = new AbortController();
      donePromise = runLoop(controller.signal).finally(() => {
        running = false;
        controller = undefined;
      });
    },
    async stop() {
      stopRequested = true;
      controller?.abort();
      await donePromise;
    },
    done() {
      return donePromise;
    },
    isRunning() {
      return running;
    }
  };
}

async function publishEvent(
  publisher: OutboxPublisher,
  event: CloudOutboxEvent
): Promise<void> {
  if (event.topic === "crawl.requested") {
    await publisher.publishCrawlRequested(event.payload);
    return;
  }
  throw new Error(`Unsupported outbox topic ${String(event.topic)}.`);
}

function asError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  return new Error(String(error));
}

function errorMessage(error: unknown): string {
  return asError(error).message;
}

function defaultSleep(intervalMs: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const timeout = setTimeout(resolve, intervalMs);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timeout);
        resolve();
      },
      {
        once: true
      }
    );
  });
}
