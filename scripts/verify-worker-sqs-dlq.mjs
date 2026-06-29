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
const generatedAt = "2026-06-22T00:00:00.000Z";
const templatePath = "infra/aws/crawler-worker-ecs-fargate.cloudformation.json";
const reportPath = path.join(repoRoot, "reports/worker-sqs-dlq-report.json");
const samplePath = path.join(
  repoRoot,
  "docs/examples/worker-sqs-dlq-report.sample.json"
);

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

async function main() {
  run("pnpm", [
    "--filter",
    "@searchlint/workers",
    "test",
    "--",
    "sqs-provisioning-contracts.test.ts"
  ]);
  run("pnpm", ["--filter", "@searchlint/workers", "build"]);

  const workers = await import("../services/workers/dist/src/index.js");
  const contract = workers.cloudWorkerSqsProvisioningContract;
  const contractIssues =
    workers.validateCloudWorkerSqsProvisioningContract(contract);
  assert(
    contractIssues.length === 0,
    "Worker SQS provisioning contract drifted."
  );

  const template = JSON.parse(await readText(templatePath));
  const resources = template.Resources ?? {};
  const outputs = template.Outputs ?? {};
  const queue = requiredResource(
    resources,
    "CrawlerWorkerQueue",
    "AWS::SQS::Queue"
  );
  const dlq = requiredResource(
    resources,
    "CrawlerWorkerDeadLetterQueue",
    "AWS::SQS::Queue"
  );
  const queueProps = queue.Properties ?? {};
  const dlqProps = dlq.Properties ?? {};
  const expected = contract.queues.crawlRequests;

  assert(
    JSON.stringify(queueProps.QueueName).includes("searchlint-") &&
      JSON.stringify(queueProps.QueueName).includes("-crawl-requests"),
    "Crawler queue name must include the SearchLint crawl request queue pattern."
  );
  assert(
    JSON.stringify(dlqProps.QueueName).includes("searchlint-") &&
      JSON.stringify(dlqProps.QueueName).includes("-crawl-requests-dlq"),
    "Crawler DLQ name must include the SearchLint crawl request DLQ pattern."
  );
  assert(
    queueProps.MessageRetentionPeriod === expected.messageRetentionSeconds,
    "Crawler queue retention must match contract."
  );
  assert(
    dlqProps.MessageRetentionPeriod ===
      expected.deadLetterQueue.messageRetentionSeconds,
    "Crawler DLQ retention must match contract."
  );
  assert(
    queueProps.ReceiveMessageWaitTimeSeconds?.Ref === "CrawlerWaitTimeSeconds",
    "Crawler queue must use long-polling wait time parameter."
  );
  assert(
    queueProps.VisibilityTimeout?.Ref === "CrawlerVisibilityTimeoutSeconds",
    "Crawler queue must use visibility-timeout parameter."
  );
  assert(
    queueProps.SqsManagedSseEnabled === true,
    "Crawler queue must use SSE."
  );
  assert(dlqProps.SqsManagedSseEnabled === true, "Crawler DLQ must use SSE.");
  assert(
    queueProps.RedrivePolicy?.deadLetterTargetArn?.["Fn::GetAtt"]?.[0] ===
      "CrawlerWorkerDeadLetterQueue",
    "Crawler queue redrive target must be the crawler DLQ."
  );
  assert(
    queueProps.RedrivePolicy?.maxReceiveCount ===
      expected.deadLetterQueue.maxReceiveCount,
    "Crawler queue maxReceiveCount must match contract."
  );

  for (const [name, logicalId, attribute] of [
    ["CrawlerWorkerQueueUrl", "CrawlerWorkerQueue", undefined],
    ["CrawlerWorkerQueueArn", "CrawlerWorkerQueue", "Arn"],
    ["CrawlerWorkerDeadLetterQueueArn", "CrawlerWorkerDeadLetterQueue", "Arn"]
  ]) {
    assert(outputs[name], `${name} output is required.`);
    const value = outputs[name].Value;
    if (attribute === undefined) {
      assert(value?.Ref === logicalId, `${name} must Ref ${logicalId}.`);
    } else {
      assert(
        value?.["Fn::GetAtt"]?.[0] === logicalId &&
          value?.["Fn::GetAtt"]?.[1] === attribute,
        `${name} must GetAtt ${logicalId}.${attribute}.`
      );
    }
  }

  const report = {
    schemaVersion: 1,
    generatedBy: "searchlint-worker-sqs-dlq-verifier",
    generatedAt,
    status: "static-provisioning-passed-release-blocked",
    scope: {
      proofType: "deterministic static SQS/DLQ provisioning contract",
      liveAwsAccess: "not used by verifier",
      cloudFormation: templatePath,
      doesNotClaim: [
        "live AWS SQS deployment",
        "live message delivery",
        "live redrive behavior",
        "CloudWatch SQS metric proof",
        "production incident routing"
      ]
    },
    commands: [
      {
        command:
          "pnpm --filter @searchlint/workers test -- sqs-provisioning-contracts.test.ts",
        status: "passed"
      },
      {
        command: "pnpm --filter @searchlint/workers build",
        status: "passed"
      }
    ],
    contract: {
      id: contract.id,
      provider: contract.provider,
      queue: expected,
      iam: contract.iam
    },
    cloudFormation: {
      queueLogicalId: "CrawlerWorkerQueue",
      deadLetterQueueLogicalId: "CrawlerWorkerDeadLetterQueue",
      queueType: queue.Type,
      deadLetterQueueType: dlq.Type,
      queueRetentionSeconds: queueProps.MessageRetentionPeriod,
      deadLetterQueueRetentionSeconds: dlqProps.MessageRetentionPeriod,
      queueSseManaged: queueProps.SqsManagedSseEnabled,
      deadLetterQueueSseManaged: dlqProps.SqsManagedSseEnabled,
      redrivePolicy: queueProps.RedrivePolicy,
      outputs: [
        "CrawlerWorkerQueueUrl",
        "CrawlerWorkerQueueArn",
        "CrawlerWorkerDeadLetterQueueArn"
      ]
    },
    remainingReleaseGates: [
      "Deploy the SQS queue and DLQ in the target AWS account.",
      "Capture live queue and DLQ ARNs/URLs from CloudFormation outputs.",
      "Prove live enqueue/dequeue and retry/redrive behavior.",
      "Verify CloudWatch SQS metrics for depth, age, and DLQ visibility.",
      "Document operational DLQ replay and incident-response runbooks."
    ]
  };

  assertNoSensitiveValues(JSON.stringify(report));
  await mkdir(path.dirname(reportPath), { recursive: true });
  await mkdir(path.dirname(samplePath), { recursive: true });
  await writeJson(reportPath, report);
  await writeJson(samplePath, report);

  console.log(
    `Worker SQS/DLQ static contract PASS: queue=${expected.name}, dlq=${expected.deadLetterQueue.name}, maxReceiveCount=${expected.deadLetterQueue.maxReceiveCount}`
  );
  console.log(`Report: ${path.relative(repoRoot, reportPath)}`);
  console.log(`Sample: ${path.relative(repoRoot, samplePath)}`);
}

function requiredResource(resources, logicalId, type) {
  const resource = resources[logicalId];
  assert(resource, `${logicalId} resource is required.`);
  assert(resource.Type === type, `${logicalId} must be ${type}.`);
  return resource;
}

async function readText(relativePath) {
  return readFile(path.join(repoRoot, relativePath), "utf8");
}

function assertNoSensitiveValues(text) {
  const forbidden = [
    /private_key/i,
    /client-secret/i,
    /authorization:/i,
    /bearer\s+[A-Za-z0-9._-]{8,}/i,
    /sk_live/i,
    /whsec_[A-Za-z0-9]/i,
    /postgres:\/\/user/i,
    /-----BEGIN PRIVATE KEY-----/i,
    /ya29\./i,
    /xox[baprs]-/i
  ];
  const match = forbidden.find((pattern) => pattern.test(text));
  if (match) {
    throw new Error(`Sensitive value leaked into SQS/DLQ evidence: ${match}`);
  }
}

async function writeJson(filePath, data) {
  await writeFile(
    filePath,
    await format(JSON.stringify(data), { parser: "json" })
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
