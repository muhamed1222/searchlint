import type { CollectExternalObservationsBatchResult } from "./external-observation-collection-worker.js";
import type { DeleteExpiredReportArtifactsResult } from "./report-artifact-retention-worker.js";
import type { SqsCrawlBatchResult } from "./sqs-crawler-consumer.js";

export type WorkerMetricName =
  | "SearchLintWorkerOutboxSelected"
  | "SearchLintWorkerOutboxLeased"
  | "SearchLintWorkerOutboxPublished"
  | "SearchLintWorkerOutboxFailed"
  | "SearchLintWorkerOutboxSkipped"
  | "SearchLintCrawlerReceived"
  | "SearchLintCrawlerHandled"
  | "SearchLintCrawlerSucceeded"
  | "SearchLintCrawlerFailed"
  | "SearchLintCrawlerInvalid"
  | "SearchLintCrawlerDeleted"
  | "SearchLintCrawlerSkipped"
  | "SearchLintCrawlerCanceled"
  | "SearchLintCrawlerBackoffApplied"
  | "SearchLintReportArtifactCleanupSelected"
  | "SearchLintReportArtifactCleanupLeased"
  | "SearchLintReportArtifactCleanupDeleted"
  | "SearchLintReportArtifactCleanupFailed"
  | "SearchLintReportArtifactCleanupSkipped"
  | "SearchLintExternalObservationSelected"
  | "SearchLintExternalObservationCollected"
  | "SearchLintExternalObservationStored"
  | "SearchLintExternalObservationFailed"
  | "SearchLintExternalObservationSkipped"
  | "SearchLintWorkerRuntimeErrors"
  | "SearchLintWorkerDlqVisibleMessages"
  | "SearchLintWorkerQueueOldestMessageAgeSeconds";

export type WorkerMetricUnit = "Count" | "Seconds";

export type WorkerMetricDimensions = {
  environment: string;
  serviceName: string;
  workerKind: string;
  queueName?: string;
};

export type WorkerMetricSample = {
  name: WorkerMetricName;
  value: number;
  unit: WorkerMetricUnit;
  dimensions: WorkerMetricDimensions;
};

export type WorkerMetricContext = {
  environment: string;
  serviceName?: string;
  workerKind: string;
  queueName?: string;
};

export type OutboxBatchMetricResult = {
  selected: number;
  leased: number;
  published: number;
  failed: number;
  skipped: number;
};

export type WorkerAlertSeverity = "warning" | "critical";
export type WorkerAlertComparator = ">=" | ">";

export type WorkerAlertDefinition = {
  id: string;
  metricName: WorkerMetricName;
  severity: WorkerAlertSeverity;
  comparator: WorkerAlertComparator;
  threshold: number;
  periodSeconds: number;
  evaluationPeriods: number;
  description: string;
  runbook: string;
  requiresLiveDeployment: readonly string[];
};

export type WorkerAlertValidationIssue = {
  id: string;
  message: string;
};

const defaultServiceName = "searchlint-cloud-worker";

export function workerMetricsFromOutboxBatch(
  result: OutboxBatchMetricResult,
  context: WorkerMetricContext
): WorkerMetricSample[] {
  return [
    metric("SearchLintWorkerOutboxSelected", result.selected, context),
    metric("SearchLintWorkerOutboxLeased", result.leased, context),
    metric("SearchLintWorkerOutboxPublished", result.published, context),
    metric("SearchLintWorkerOutboxFailed", result.failed, context),
    metric("SearchLintWorkerOutboxSkipped", result.skipped, context)
  ];
}

export function workerMetricsFromCrawlerBatch(
  result: SqsCrawlBatchResult,
  context: WorkerMetricContext
): WorkerMetricSample[] {
  return [
    metric("SearchLintCrawlerReceived", result.received, context),
    metric("SearchLintCrawlerHandled", result.handled, context),
    metric("SearchLintCrawlerSucceeded", result.succeeded, context),
    metric("SearchLintCrawlerFailed", result.failed, context),
    metric("SearchLintCrawlerInvalid", result.invalid, context),
    metric("SearchLintCrawlerDeleted", result.deleted, context),
    metric("SearchLintCrawlerSkipped", result.skipped, context),
    metric("SearchLintCrawlerCanceled", result.canceled, context),
    metric("SearchLintCrawlerBackoffApplied", result.backoffApplied, context)
  ];
}

export function workerMetricsFromReportArtifactCleanupBatch(
  result: DeleteExpiredReportArtifactsResult,
  context: WorkerMetricContext
): WorkerMetricSample[] {
  return [
    metric("SearchLintReportArtifactCleanupSelected", result.selected, context),
    metric("SearchLintReportArtifactCleanupLeased", result.leased, context),
    metric("SearchLintReportArtifactCleanupDeleted", result.deleted, context),
    metric("SearchLintReportArtifactCleanupFailed", result.failed, context),
    metric("SearchLintReportArtifactCleanupSkipped", result.skipped, context)
  ];
}

export function workerMetricsFromExternalObservationBatch(
  result: CollectExternalObservationsBatchResult,
  context: WorkerMetricContext
): WorkerMetricSample[] {
  return [
    metric("SearchLintExternalObservationSelected", result.selected, context),
    metric("SearchLintExternalObservationCollected", result.collected, context),
    metric("SearchLintExternalObservationStored", result.stored, context),
    metric("SearchLintExternalObservationFailed", result.failed, context),
    metric("SearchLintExternalObservationSkipped", result.skipped, context)
  ];
}

export function workerRuntimeErrorMetric(
  context: WorkerMetricContext
): WorkerMetricSample {
  return metric("SearchLintWorkerRuntimeErrors", 1, context);
}

export function workerQueueDepthMetric(
  value: number,
  context: WorkerMetricContext
): WorkerMetricSample {
  return metric("SearchLintWorkerDlqVisibleMessages", value, context);
}

export function workerQueueOldestMessageAgeMetric(
  valueSeconds: number,
  context: WorkerMetricContext
): WorkerMetricSample {
  return metric(
    "SearchLintWorkerQueueOldestMessageAgeSeconds",
    valueSeconds,
    context,
    "Seconds"
  );
}

export function defaultWorkerAlertDefinitions(): WorkerAlertDefinition[] {
  return [
    {
      id: "worker-runtime-errors-critical",
      metricName: "SearchLintWorkerRuntimeErrors",
      severity: "critical",
      comparator: ">=",
      threshold: 1,
      periodSeconds: 300,
      evaluationPeriods: 1,
      description: "Worker runtime error count is non-zero.",
      runbook: "docs/WORKER_METRICS_ALERTS.md#worker-runtime-errors-critical",
      requiresLiveDeployment: [
        "CloudWatch or OTLP metric export",
        "alert action routed to incident channel"
      ]
    },
    {
      id: "crawler-failed-batches-critical",
      metricName: "SearchLintCrawlerFailed",
      severity: "critical",
      comparator: ">=",
      threshold: 1,
      periodSeconds: 300,
      evaluationPeriods: 1,
      description: "Crawler worker failed at least one crawl batch item.",
      runbook: "docs/WORKER_METRICS_ALERTS.md#crawler-failed-batches-critical",
      requiresLiveDeployment: [
        "deployed crawler worker metric export",
        "alert action routed to incident channel"
      ]
    },
    {
      id: "report-cleanup-failures-warning",
      metricName: "SearchLintReportArtifactCleanupFailed",
      severity: "warning",
      comparator: ">=",
      threshold: 1,
      periodSeconds: 900,
      evaluationPeriods: 1,
      description: "Report artifact cleanup worker failed an object deletion.",
      runbook: "docs/WORKER_METRICS_ALERTS.md#report-cleanup-failures-warning",
      requiresLiveDeployment: [
        "deployed cleanup worker metric export",
        "alert action routed to operations channel"
      ]
    },
    {
      id: "external-observation-failures-warning",
      metricName: "SearchLintExternalObservationFailed",
      severity: "warning",
      comparator: ">=",
      threshold: 1,
      periodSeconds: 900,
      evaluationPeriods: 1,
      description: "External observation worker failed provider collection.",
      runbook:
        "docs/WORKER_METRICS_ALERTS.md#external-observation-failures-warning",
      requiresLiveDeployment: [
        "deployed external observation metric export",
        "alert action routed to operations channel"
      ]
    },
    {
      id: "worker-dlq-depth-critical",
      metricName: "SearchLintWorkerDlqVisibleMessages",
      severity: "critical",
      comparator: ">=",
      threshold: 1,
      periodSeconds: 300,
      evaluationPeriods: 1,
      description: "Worker dead-letter queue contains visible messages.",
      runbook: "docs/WORKER_METRICS_ALERTS.md#worker-dlq-depth-critical",
      requiresLiveDeployment: [
        "SQS dead-letter queue CloudWatch metrics",
        "alert action routed to incident channel"
      ]
    },
    {
      id: "worker-queue-age-critical",
      metricName: "SearchLintWorkerQueueOldestMessageAgeSeconds",
      severity: "critical",
      comparator: ">",
      threshold: 300,
      periodSeconds: 300,
      evaluationPeriods: 2,
      description: "Worker queue oldest visible message is stale.",
      runbook: "docs/WORKER_METRICS_ALERTS.md#worker-queue-age-critical",
      requiresLiveDeployment: [
        "SQS approximate oldest message age metric",
        "alert action routed to incident channel"
      ]
    },
    {
      id: "crawler-backoff-pressure-warning",
      metricName: "SearchLintCrawlerBackoffApplied",
      severity: "warning",
      comparator: ">=",
      threshold: 3,
      periodSeconds: 900,
      evaluationPeriods: 1,
      description: "Crawler worker is applying repeated retry backoff.",
      runbook: "docs/WORKER_METRICS_ALERTS.md#crawler-backoff-pressure-warning",
      requiresLiveDeployment: [
        "deployed crawler worker metric export",
        "alert action routed to operations channel"
      ]
    }
  ];
}

export function validateWorkerAlertDefinitions(
  definitions: readonly WorkerAlertDefinition[]
): WorkerAlertValidationIssue[] {
  const issues: WorkerAlertValidationIssue[] = [];
  const seen = new Set<string>();

  for (const definition of definitions) {
    if (definition.id.trim().length === 0) {
      issues.push({ id: definition.id, message: "Alert id is required." });
    }
    if (seen.has(definition.id)) {
      issues.push({
        id: definition.id,
        message: "Alert id must be unique."
      });
    }
    seen.add(definition.id);

    if (!Number.isFinite(definition.threshold) || definition.threshold < 0) {
      issues.push({
        id: definition.id,
        message: "Alert threshold must be a non-negative finite number."
      });
    }
    if (
      !Number.isInteger(definition.periodSeconds) ||
      definition.periodSeconds < 60
    ) {
      issues.push({
        id: definition.id,
        message: "Alert periodSeconds must be an integer >= 60."
      });
    }
    if (
      !Number.isInteger(definition.evaluationPeriods) ||
      definition.evaluationPeriods < 1
    ) {
      issues.push({
        id: definition.id,
        message: "Alert evaluationPeriods must be a positive integer."
      });
    }
    if (!definition.runbook.startsWith("docs/")) {
      issues.push({
        id: definition.id,
        message: "Alert runbook must point to repository documentation."
      });
    }
    if (definition.requiresLiveDeployment.length === 0) {
      issues.push({
        id: definition.id,
        message: "Alert must document live deployment requirements."
      });
    }
  }

  return issues;
}

function metric(
  name: WorkerMetricName,
  value: number,
  context: WorkerMetricContext,
  unit: WorkerMetricUnit = "Count"
): WorkerMetricSample {
  assertMetricValue(name, value);
  return {
    name,
    value,
    unit,
    dimensions: dimensions(context)
  };
}

function dimensions(context: WorkerMetricContext): WorkerMetricDimensions {
  return {
    environment: context.environment,
    serviceName: context.serviceName ?? defaultServiceName,
    workerKind: context.workerKind,
    ...(context.queueName === undefined ? {} : { queueName: context.queueName })
  };
}

function assertMetricValue(name: WorkerMetricName, value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${name} metric value must be a non-negative number.`);
  }
}
