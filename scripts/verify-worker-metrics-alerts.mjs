#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { format } from "prettier";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const reportPath = path.join(
  repoRoot,
  "reports/worker-metrics-alerts-report.json"
);
const samplePath = path.join(
  repoRoot,
  "docs/examples/worker-metrics-alerts-report.sample.json"
);
const fixedGeneratedAt = "2026-06-22T00:00:00.000Z";

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    env: { ...process.env, ...options.env },
    encoding: "utf8",
    stdio: options.stdio ?? "pipe"
  });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function caseResult(id, status, evidence, notes = []) {
  return { id, status, evidence, notes };
}

async function readText(relativePath) {
  return readFile(path.join(repoRoot, relativePath), "utf8");
}

async function main() {
  run(
    "pnpm",
    [
      "--filter",
      "@searchlint/workers",
      "test",
      "--",
      "worker-metrics-alerts.test.ts"
    ],
    { stdio: "inherit" }
  );
  run("pnpm", ["--filter", "@searchlint/workers", "build"], {
    stdio: "inherit"
  });

  const workers = await import("../services/workers/dist/src/index.js");
  const context = {
    environment: "production",
    serviceName: "searchlint-cloud-worker",
    workerKind: "sqs-crawler-poller",
    queueName: "searchlint-crawl-requests"
  };
  const cases = [];

  const crawlerMetrics = workers.workerMetricsFromCrawlerBatch(
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
    context
  );
  assertMetricNames(crawlerMetrics, [
    "SearchLintCrawlerReceived",
    "SearchLintCrawlerHandled",
    "SearchLintCrawlerSucceeded",
    "SearchLintCrawlerFailed",
    "SearchLintCrawlerInvalid",
    "SearchLintCrawlerDeleted",
    "SearchLintCrawlerSkipped",
    "SearchLintCrawlerCanceled",
    "SearchLintCrawlerBackoffApplied"
  ]);
  cases.push(
    caseResult("crawler-worker-batch-metrics", "PASS", {
      metricCount: crawlerMetrics.length,
      metrics: crawlerMetrics
    })
  );

  const cleanupMetrics = workers.workerMetricsFromReportArtifactCleanupBatch(
    {
      selected: 4,
      leased: 3,
      deleted: 2,
      failed: 1,
      skipped: 1
    },
    {
      ...context,
      workerKind: "report-artifact-cleanup-poller",
      queueName: "searchlint-report-artifact-cleanup"
    }
  );
  assertMetricNames(cleanupMetrics, [
    "SearchLintReportArtifactCleanupSelected",
    "SearchLintReportArtifactCleanupLeased",
    "SearchLintReportArtifactCleanupDeleted",
    "SearchLintReportArtifactCleanupFailed",
    "SearchLintReportArtifactCleanupSkipped"
  ]);
  cases.push(
    caseResult("report-cleanup-worker-batch-metrics", "PASS", {
      metricCount: cleanupMetrics.length,
      metrics: cleanupMetrics
    })
  );

  const externalMetrics = workers.workerMetricsFromExternalObservationBatch(
    {
      selected: 3,
      collected: 2,
      stored: 2,
      failed: 1,
      skipped: 0
    },
    {
      ...context,
      workerKind: "external-observation-collector",
      queueName: "searchlint-external-observation"
    }
  );
  assertMetricNames(externalMetrics, [
    "SearchLintExternalObservationSelected",
    "SearchLintExternalObservationCollected",
    "SearchLintExternalObservationStored",
    "SearchLintExternalObservationFailed",
    "SearchLintExternalObservationSkipped"
  ]);
  cases.push(
    caseResult("external-observation-worker-batch-metrics", "PASS", {
      metricCount: externalMetrics.length,
      metrics: externalMetrics
    })
  );

  const outboxMetrics = workers.workerMetricsFromOutboxBatch(
    {
      selected: 4,
      leased: 3,
      published: 2,
      failed: 1,
      skipped: 1
    },
    { ...context, workerKind: "outbox-poller" }
  );
  assertMetricNames(outboxMetrics, [
    "SearchLintWorkerOutboxSelected",
    "SearchLintWorkerOutboxLeased",
    "SearchLintWorkerOutboxPublished",
    "SearchLintWorkerOutboxFailed",
    "SearchLintWorkerOutboxSkipped"
  ]);
  cases.push(
    caseResult("outbox-worker-batch-metrics", "PASS", {
      metricCount: outboxMetrics.length,
      metrics: outboxMetrics
    })
  );

  const operationalMetrics = [
    workers.workerRuntimeErrorMetric(context),
    workers.workerQueueDepthMetric(2, {
      ...context,
      queueName: "searchlint-crawl-requests-dlq"
    }),
    workers.workerQueueOldestMessageAgeMetric(301, context)
  ];
  assertMetricNames(operationalMetrics, [
    "SearchLintWorkerRuntimeErrors",
    "SearchLintWorkerDlqVisibleMessages",
    "SearchLintWorkerQueueOldestMessageAgeSeconds"
  ]);
  cases.push(
    caseResult("worker-operational-metrics", "PASS", {
      metricCount: operationalMetrics.length,
      metrics: operationalMetrics
    })
  );

  const alerts = workers.defaultWorkerAlertDefinitions();
  const alertIssues = workers.validateWorkerAlertDefinitions(alerts);
  assert(alertIssues.length === 0, "Worker alert definitions must validate.");
  assert(
    alerts.some((alert) => alert.id === "worker-dlq-depth-critical"),
    "DLQ depth alert must be defined."
  );
  assert(
    alerts.some((alert) => alert.id === "worker-queue-age-critical"),
    "Queue age alert must be defined."
  );
  assert(
    alerts.every((alert) => alert.requiresLiveDeployment.length > 0),
    "Every alert must document live deployment requirements."
  );
  cases.push(
    caseResult("worker-alert-definitions", "PASS", {
      alertCount: alerts.length,
      alerts
    })
  );

  const docs = await readText("docs/WORKER_METRICS_ALERTS.md");
  for (const phrase of [
    "deterministic local proof",
    "does not claim live CloudWatch",
    "worker-runtime-errors-critical",
    "worker-dlq-depth-critical",
    "remaining live gates"
  ]) {
    assert(
      docs.toLowerCase().includes(phrase.toLowerCase()),
      `Worker metrics alerts docs must include ${phrase}.`
    );
  }
  cases.push(
    caseResult("worker-metrics-alerts-documentation", "PASS", {
      document: "docs/WORKER_METRICS_ALERTS.md",
      liveDeploymentClaimed: false
    })
  );

  const report = {
    schemaVersion: 1,
    summary: {
      status: "PASS",
      generatedAt: fixedGeneratedAt,
      nodeVersion: process.version,
      caseCount: cases.length,
      passed: cases.length,
      failed: 0
    },
    cases,
    limitations: [
      "This verifier checks deterministic worker metric mappings, static alert definitions, focused worker tests, and documentation.",
      "It does not deploy CloudWatch, OTLP, SQS, ECS/Fargate, alert actions, or incident routing.",
      "It does not prove live worker metrics, live worker alerts, autoscaling, or production incident response."
    ],
    remainingLiveGates: [
      "Deploy worker containers and queues.",
      "Export worker metrics to CloudWatch or OTLP.",
      "Deploy CloudWatch alarms or equivalent alert rules.",
      "Route alert actions to production incident channels.",
      "Record live worker metrics and alert firing/resolution evidence."
    ]
  };

  await mkdir(path.dirname(reportPath), { recursive: true });
  await mkdir(path.dirname(samplePath), { recursive: true });
  const formattedReport = await format(JSON.stringify(report), {
    parser: "json"
  });
  await writeFile(reportPath, formattedReport);
  await writeFile(samplePath, formattedReport);

  console.log(
    `Worker metrics alerts ${report.summary.status}: ${report.summary.passed}/${report.summary.caseCount} cases passed`
  );
  console.log(`Report: ${path.relative(repoRoot, reportPath)}`);
  console.log(`Sample: ${path.relative(repoRoot, samplePath)}`);
}

function assertMetricNames(metrics, expectedNames) {
  const names = metrics.map((metric) => metric.name);
  assert(
    JSON.stringify(names) === JSON.stringify(expectedNames),
    `Metric names drifted: expected ${expectedNames.join(", ")}, got ${names.join(", ")}.`
  );
  for (const metric of metrics) {
    assert(
      Number.isFinite(metric.value) && metric.value >= 0,
      `${metric.name} must have a non-negative value.`
    );
    assert(
      metric.dimensions.environment,
      `${metric.name} missing environment.`
    );
    assert(metric.dimensions.workerKind, `${metric.name} missing workerKind.`);
  }
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
