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
  "reports/workers-queues-scheduler-report.json"
);
const samplePath = path.join(
  repoRoot,
  "docs/examples/workers-queues-scheduler-report.sample.json"
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

async function readJson(relativePath) {
  return JSON.parse(await readText(relativePath));
}

async function main() {
  run("pnpm", ["--filter", "@searchlint/workers", "test"], {
    stdio: "inherit"
  });
  run("pnpm", ["--filter", "@searchlint/workers", "build"], {
    stdio: "inherit"
  });

  const workers = await import("../services/workers/dist/src/index.js");
  const cases = [];

  assert(
    workers.validateCloudWorkerSqsProvisioningContract(
      workers.cloudWorkerSqsProvisioningContract
    ).length === 0,
    "SQS provisioning contract drifted."
  );
  const sqs = workers.cloudWorkerSqsProvisioningContract.queues.crawlRequests;
  assert(
    sqs.deadLetterQueue.maxReceiveCount === 5,
    "DLQ maxReceiveCount drifted."
  );
  assert(
    sqs.encryption === "sqs-managed",
    "SQS managed encryption is required."
  );
  assert(
    sqs.receiveMessageWaitTimeSeconds === 20,
    "SQS long polling must be enabled."
  );
  cases.push(
    caseResult("sqs-dlq-provisioning-contract", "PASS", {
      provider: workers.cloudWorkerSqsProvisioningContract.provider,
      queueName: sqs.name,
      queueType: sqs.queueType,
      messageTypes: sqs.messageTypes,
      visibilityTimeoutSeconds: sqs.visibilityTimeoutSeconds,
      receiveMessageWaitTimeSeconds: sqs.receiveMessageWaitTimeSeconds,
      encryption: sqs.encryption,
      deadLetterQueue: sqs.deadLetterQueue
    })
  );

  const publisherTest = await readText(
    "services/workers/test/sqs-publisher.test.ts"
  );
  const consumerTest = await readText(
    "services/workers/test/sqs-crawler-consumer.test.ts"
  );
  for (const phrase of [
    "sends deterministic crawl request messages to standard queues",
    "adds FIFO group and deterministic deduplication identifiers",
    "propagates SQS send failures"
  ]) {
    assert(
      publisherTest.includes(phrase),
      `Missing SQS publisher test: ${phrase}`
    );
  }
  for (const phrase of [
    "receives crawl messages, executes crawls, and deletes successful messages",
    "leaves failed execution messages undeleted for SQS retry",
    "deletes invalid message bodies after counting them invalid",
    "skips messages without receipt handles"
  ]) {
    assert(
      consumerTest.includes(phrase),
      `Missing SQS consumer test: ${phrase}`
    );
  }
  cases.push(
    caseResult("sqs-enqueue-dequeue-and-retry-semantics", "PASS", {
      enqueue: "deterministic crawl.requested SQS message body and attributes",
      dequeue: "valid messages execute crawl jobs and delete on success",
      retry: "failed execution messages are left undeleted for SQS retry",
      invalidMessageHandling: "invalid bodies are deleted after invalid count",
      idempotency:
        "FIFO deduplication uses crawlRequestId when FIFO is configured"
    })
  );

  assert(
    workers.validateCloudWorkerDeploymentContract(
      workers.cloudWorkerDeploymentContract
    ).length === 0,
    "Worker deployment contract drifted."
  );
  const deployment = workers.cloudWorkerDeploymentContract;
  const crawlerTemplate = await readJson(
    "infra/aws/crawler-worker-ecs-fargate.cloudformation.json"
  );
  const crawlerResources = crawlerTemplate.Resources ?? {};
  for (const [name, type] of Object.entries({
    CrawlerWorkerQueue: "AWS::SQS::Queue",
    CrawlerWorkerDeadLetterQueue: "AWS::SQS::Queue",
    CrawlerWorkerTaskDefinition: "AWS::ECS::TaskDefinition",
    CrawlerWorkerService: "AWS::ECS::Service",
    CrawlerWorkerLogGroup: "AWS::Logs::LogGroup"
  })) {
    assertResource(crawlerResources, name, type);
  }
  assert(
    crawlerResources.CrawlerWorkerQueue.Properties?.RedrivePolicy
      ?.maxReceiveCount === 5,
    "Crawler SQS queue must redrive to DLQ after five receives."
  );
  assert(
    crawlerResources.CrawlerWorkerService.Properties?.NetworkConfiguration
      ?.AwsvpcConfiguration?.AssignPublicIp === "DISABLED",
    "Crawler worker service must not assign public IPs."
  );
  cases.push(
    caseResult("crawler-worker-ecs-fargate-contract", "PASS", {
      compute: deployment.runtime.compute,
      nodeMajor: deployment.runtime.nodeMajor,
      workerKind: deployment.runtime.workerKind,
      batchSize: deployment.runtime.batchSize,
      pollIntervalMs: deployment.runtime.pollIntervalMs,
      stopOnError: deployment.runtime.stopOnError,
      cloudFormation: "infra/aws/crawler-worker-ecs-fargate.cloudformation.json"
    })
  );

  const crawlerProcessTest = await readText(
    "services/workers/test/crawler-worker-process.test.ts"
  );
  const lifecycleTest = await readText(
    "services/workers/test/worker-lifecycle.test.ts"
  );
  for (const phrase of [
    "parses required process env with stable polling defaults",
    "rejects missing required env before worker clients are created",
    "logs crawler batches through the production log sink",
    "installs lifecycle logging only when explicitly requested"
  ]) {
    assert(
      crawlerProcessTest.includes(phrase),
      `Missing crawler worker process evidence: ${phrase}`
    );
  }
  for (const phrase of [
    "registers SIGTERM and SIGINT by default",
    "runs worker shutdown once for the first signal and removes listeners",
    "reports draining before stop and stopped after completion",
    "sets exit code 0 after successful shutdown"
  ]) {
    assert(
      lifecycleTest.includes(phrase),
      `Missing worker lifecycle evidence: ${phrase}`
    );
  }
  cases.push(
    caseResult("worker-lifecycle-and-structured-logs", "PASS", {
      lifecycleSignals: ["SIGTERM", "SIGINT"],
      lifecycleStates: ["ready", "draining", "stopped", "failed"],
      crawlerBatchLogs: true,
      processExitPolicy: true
    })
  );

  assert(
    workers.validateReportArtifactCleanupScheduleContract(
      workers.reportArtifactCleanupScheduleContract
    ).length === 0,
    "Report artifact cleanup schedule contract drifted."
  );
  const cleanupTemplate = await readJson(
    "infra/aws/report-artifact-cleanup-schedule.cloudformation.json"
  );
  const cleanupResources = cleanupTemplate.Resources ?? {};
  for (const [name, type] of Object.entries({
    ReportArtifactCleanupDeadLetterQueue: "AWS::SQS::Queue",
    ReportArtifactCleanupTaskDefinition: "AWS::ECS::TaskDefinition",
    ReportArtifactCleanupSchedule: "AWS::Scheduler::Schedule"
  })) {
    assertResource(cleanupResources, name, type);
  }
  assertScheduleHasDlqAndRetry(cleanupResources.ReportArtifactCleanupSchedule);
  const cleanupWorkerTest = await readText(
    "services/workers/test/report-artifact-retention-worker.test.ts"
  );
  for (const phrase of [
    "deletes leased report artifact payloads before marking metadata deleted",
    "returns leased rows to active when object deletion fails"
  ]) {
    assert(
      cleanupWorkerTest.includes(phrase),
      `Missing cleanup worker evidence: ${phrase}`
    );
  }
  cases.push(
    caseResult("report-artifact-cleanup-worker-scheduler", "PASS", {
      schedule:
        workers.reportArtifactCleanupScheduleContract.schedule.expression,
      flexibleTimeWindow:
        workers.reportArtifactCleanupScheduleContract.schedule
          .flexibleTimeWindow,
      retryAttempts:
        workers.reportArtifactCleanupScheduleContract.schedule.retryAttempts,
      target: workers.reportArtifactCleanupScheduleContract.target.binName,
      deadLetterQueueRequired: true
    })
  );

  assert(
    workers.validateExternalObservationScheduleContract(
      workers.externalObservationScheduleContract
    ).length === 0,
    "External observation schedule contract drifted."
  );
  const externalTemplate = await readJson(
    "infra/aws/external-observation-schedule.cloudformation.json"
  );
  const externalResources = externalTemplate.Resources ?? {};
  for (const [name, type] of Object.entries({
    ExternalObservationDeadLetterQueue: "AWS::SQS::Queue",
    ExternalObservationTaskDefinition: "AWS::ECS::TaskDefinition",
    ExternalObservationSchedule: "AWS::Scheduler::Schedule"
  })) {
    assertResource(externalResources, name, type);
  }
  assertScheduleHasDlqAndRetry(externalResources.ExternalObservationSchedule);
  const externalWorkerTest = await readText(
    "services/workers/test/external-observation-collection-process.test.ts"
  );
  for (const phrase of [
    "parses required process env with stable collection defaults",
    "parses optional process env overrides",
    "logs external observation batches through the production log sink",
    "rejects missing required env before worker clients are created"
  ]) {
    assert(
      externalWorkerTest.includes(phrase),
      `Missing external observation process evidence: ${phrase}`
    );
  }
  cases.push(
    caseResult("external-observation-worker-scheduler", "PASS", {
      schedule: workers.externalObservationScheduleContract.schedule.expression,
      flexibleTimeWindow:
        workers.externalObservationScheduleContract.schedule.flexibleTimeWindow,
      retryAttempts:
        workers.externalObservationScheduleContract.schedule.retryAttempts,
      target: workers.externalObservationScheduleContract.target.binName,
      maxBatchesEnv: "SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_MAX_BATCHES",
      deadLetterQueueRequired: true
    })
  );

  const awsDocs = await readText("docs/AWS_DEPLOYMENT_CONTRACTS.md");
  const workerDocs = await readText("docs/WORKERS_QUEUES_SCHEDULER_PROOF.md");
  for (const phrase of [
    "deterministic local/static proof",
    "real SQS",
    "autoscaling",
    "worker alerts",
    "EventBridge Scheduler"
  ]) {
    assert(
      workerDocs.toLowerCase().includes(phrase.toLowerCase()),
      `Worker proof doc must include ${phrase}`
    );
  }
  assert(
    awsDocs.includes("crawler worker SQS queue") &&
      awsDocs.includes("EventBridge scheduled invocation proof"),
    "AWS deployment docs must describe worker and scheduler gaps."
  );
  cases.push(
    caseResult("workers-queues-scheduler-documentation", "PASS", {
      document: "docs/WORKERS_QUEUES_SCHEDULER_PROOF.md",
      deploymentClaimed: false,
      remainingRuntimeGatesDocumented: true
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
      "This verifier checks deterministic worker package tests, SQS/DLQ contracts, ECS/Fargate templates, EventBridge Scheduler templates, lifecycle/logging contracts, and documentation.",
      "It does not deploy AWS SQS, ECS/Fargate, EventBridge Scheduler, CloudWatch metrics, or CloudWatch alarms.",
      "It does not prove live autoscaling, deployed failure recovery, or live worker alerts."
    ],
    remainingRuntimeGates: [
      "Deploy real SQS queue and DLQ.",
      "Deploy crawler, cleanup, and external observation worker containers.",
      "Run live enqueue/dequeue proof against deployed SQS.",
      "Run EventBridge scheduled invocation proof.",
      "Verify autoscaling policies and scaling behavior.",
      "Verify worker metrics and alerts in CloudWatch.",
      "Record live failure recovery and DLQ replay evidence."
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
    `Workers queues scheduler ${report.summary.status}: ${report.summary.passed}/${report.summary.caseCount} cases passed`
  );
  console.log(`Report: ${path.relative(repoRoot, reportPath)}`);
  console.log(`Sample: ${path.relative(repoRoot, samplePath)}`);
}

function assertResource(resources, name, type) {
  const resource = resources[name];
  assert(resource, `${name} must exist`);
  assert(resource.Type === type, `${name} must be ${type}`);
}

function assertScheduleHasDlqAndRetry(scheduleResource) {
  const target = scheduleResource.Properties?.Target;
  assert(
    target?.RetryPolicy?.MaximumRetryAttempts === 2,
    "Schedule must retry twice."
  );
  assert(target?.DeadLetterConfig, "Schedule must configure a DLQ.");
  assert(
    scheduleResource.Properties?.FlexibleTimeWindow?.Mode === "OFF",
    "Schedule flexible time window must be OFF."
  );
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
