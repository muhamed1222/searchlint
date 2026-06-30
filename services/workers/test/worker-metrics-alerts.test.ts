import { describe, expect, it } from "vitest";

import {
  defaultWorkerAlertDefinitions,
  validateWorkerAlertDefinitions,
  workerMetricsFromCrawlerBatch,
  workerMetricsFromExternalObservationBatch,
  workerMetricsFromOutboxBatch,
  workerMetricsFromReportArtifactCleanupBatch,
  workerQueueDepthMetric,
  workerQueueOldestMessageAgeMetric,
  workerRuntimeErrorMetric
} from "../src/index.js";

describe("worker metrics", () => {
  it("maps outbox batch results to deterministic worker metrics", () => {
    expect(
      workerMetricsFromOutboxBatch(
        {
          selected: 4,
          leased: 3,
          published: 2,
          failed: 1,
          skipped: 1
        },
        context("outbox-poller")
      )
    ).toEqual([
      sample("SearchLintWorkerOutboxSelected", 4, "outbox-poller"),
      sample("SearchLintWorkerOutboxLeased", 3, "outbox-poller"),
      sample("SearchLintWorkerOutboxPublished", 2, "outbox-poller"),
      sample("SearchLintWorkerOutboxFailed", 1, "outbox-poller"),
      sample("SearchLintWorkerOutboxSkipped", 1, "outbox-poller")
    ]);
  });

  it("maps crawler batch results to crawler worker metrics", () => {
    const metrics = workerMetricsFromCrawlerBatch(
      {
        received: 5,
        handled: 4,
        succeeded: 3,
        failed: 1,
        invalid: 1,
        deleted: 4,
        skipped: 0,
        canceled: 1,
        backoffApplied: 2
      },
      context("sqs-crawler-poller", "searchlint-crawl-requests")
    );

    expect(metrics).toEqual([
      sample(
        "SearchLintCrawlerReceived",
        5,
        "sqs-crawler-poller",
        "searchlint-crawl-requests"
      ),
      sample(
        "SearchLintCrawlerHandled",
        4,
        "sqs-crawler-poller",
        "searchlint-crawl-requests"
      ),
      sample(
        "SearchLintCrawlerSucceeded",
        3,
        "sqs-crawler-poller",
        "searchlint-crawl-requests"
      ),
      sample(
        "SearchLintCrawlerFailed",
        1,
        "sqs-crawler-poller",
        "searchlint-crawl-requests"
      ),
      sample(
        "SearchLintCrawlerInvalid",
        1,
        "sqs-crawler-poller",
        "searchlint-crawl-requests"
      ),
      sample(
        "SearchLintCrawlerDeleted",
        4,
        "sqs-crawler-poller",
        "searchlint-crawl-requests"
      ),
      sample(
        "SearchLintCrawlerSkipped",
        0,
        "sqs-crawler-poller",
        "searchlint-crawl-requests"
      ),
      sample(
        "SearchLintCrawlerCanceled",
        1,
        "sqs-crawler-poller",
        "searchlint-crawl-requests"
      ),
      sample(
        "SearchLintCrawlerBackoffApplied",
        2,
        "sqs-crawler-poller",
        "searchlint-crawl-requests"
      )
    ]);
  });

  it("maps cleanup and external observation batches to worker metrics", () => {
    expect(
      workerMetricsFromReportArtifactCleanupBatch(
        {
          selected: 4,
          leased: 3,
          deleted: 2,
          failed: 1,
          skipped: 1
        },
        context("report-artifact-cleanup-poller")
      ).map(({ name, value }) => [name, value])
    ).toEqual([
      ["SearchLintReportArtifactCleanupSelected", 4],
      ["SearchLintReportArtifactCleanupLeased", 3],
      ["SearchLintReportArtifactCleanupDeleted", 2],
      ["SearchLintReportArtifactCleanupFailed", 1],
      ["SearchLintReportArtifactCleanupSkipped", 1]
    ]);

    expect(
      workerMetricsFromExternalObservationBatch(
        {
          selected: 3,
          collected: 2,
          stored: 2,
          failed: 1,
          skipped: 0
        },
        context("external-observation-collector")
      ).map(({ name, value }) => [name, value])
    ).toEqual([
      ["SearchLintExternalObservationSelected", 3],
      ["SearchLintExternalObservationCollected", 2],
      ["SearchLintExternalObservationStored", 2],
      ["SearchLintExternalObservationFailed", 1],
      ["SearchLintExternalObservationSkipped", 0]
    ]);
  });

  it("maps runtime errors, DLQ depth, and queue age metrics", () => {
    expect(workerRuntimeErrorMetric(context("sqs-crawler-poller"))).toEqual(
      sample("SearchLintWorkerRuntimeErrors", 1, "sqs-crawler-poller")
    );
    expect(
      workerQueueDepthMetric(
        2,
        context("sqs-crawler-poller", "searchlint-crawl-requests-dlq")
      )
    ).toEqual(
      sample(
        "SearchLintWorkerDlqVisibleMessages",
        2,
        "sqs-crawler-poller",
        "searchlint-crawl-requests-dlq"
      )
    );
    expect(
      workerQueueOldestMessageAgeMetric(
        301,
        context("sqs-crawler-poller", "searchlint-crawl-requests")
      )
    ).toEqual({
      ...sample(
        "SearchLintWorkerQueueOldestMessageAgeSeconds",
        301,
        "sqs-crawler-poller",
        "searchlint-crawl-requests"
      ),
      unit: "Seconds"
    });
  });

  it("rejects negative metric values", () => {
    expect(() =>
      workerQueueDepthMetric(-1, context("sqs-crawler-poller"))
    ).toThrow("SearchLintWorkerDlqVisibleMessages metric value");
  });
});

describe("worker alert definitions", () => {
  it("defines deterministic worker alerts with live deployment requirements", () => {
    const definitions = defaultWorkerAlertDefinitions();

    expect(validateWorkerAlertDefinitions(definitions)).toEqual([]);
    expect(definitions.map((definition) => definition.id)).toEqual([
      "worker-runtime-errors-critical",
      "crawler-failed-batches-critical",
      "report-cleanup-failures-warning",
      "external-observation-failures-warning",
      "worker-dlq-depth-critical",
      "worker-queue-age-critical",
      "crawler-backoff-pressure-warning"
    ]);
    expect(
      definitions.every(
        (definition) =>
          definition.runbook.startsWith("docs/") &&
          definition.requiresLiveDeployment.length > 0
      )
    ).toBe(true);
  });

  it("reports invalid alert definitions", () => {
    const issues = validateWorkerAlertDefinitions([
      {
        ...defaultWorkerAlertDefinitions()[0]!,
        id: "broken",
        threshold: -1,
        periodSeconds: 30,
        evaluationPeriods: 0,
        runbook: "https://example.test/runbook",
        requiresLiveDeployment: []
      }
    ]);

    expect(issues.map((issue) => issue.message)).toEqual([
      "Alert threshold must be a non-negative finite number.",
      "Alert periodSeconds must be an integer >= 60.",
      "Alert evaluationPeriods must be a positive integer.",
      "Alert runbook must point to repository documentation.",
      "Alert must document live deployment requirements."
    ]);
  });
});

function context(workerKind: string, queueName?: string) {
  return {
    environment: "production",
    workerKind,
    ...(queueName === undefined ? {} : { queueName })
  };
}

function sample(
  name: string,
  value: number,
  workerKind: string,
  queueName?: string
) {
  return {
    name,
    value,
    unit: "Count",
    dimensions: {
      environment: "production",
      serviceName: "searchlint-cloud-worker",
      workerKind,
      ...(queueName === undefined ? {} : { queueName })
    }
  };
}
