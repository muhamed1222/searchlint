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
const reportPath = path.join(
  repoRoot,
  "reports/worker-autoscaling-report.json"
);
const samplePath = path.join(
  repoRoot,
  "docs/examples/worker-autoscaling-report.sample.json"
);
const templatePath = "infra/aws/crawler-worker-ecs-fargate.cloudformation.json";

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

async function main() {
  run(
    "pnpm",
    [
      "--filter",
      "@searchlint/workers",
      "test",
      "--",
      "worker-autoscaling-contracts.test.ts"
    ],
    { stdio: "inherit" }
  );
  run("pnpm", ["--filter", "@searchlint/workers", "build"], {
    stdio: "inherit"
  });

  const workers = await import("../services/workers/dist/src/index.js");
  const template = JSON.parse(
    await readFile(path.join(repoRoot, templatePath), "utf8")
  );
  const resources = template.Resources ?? {};
  const contract = workers.crawlerWorkerAutoscalingContract;
  const contractIssues = workers.validateWorkerAutoscalingContract(contract);
  assert(contractIssues.length === 0, "Autoscaling contract must validate.");

  const cases = [];
  cases.push(
    caseResult("typed-autoscaling-contract", "PASS", {
      id: contract.id,
      provider: contract.provider,
      serviceNamespace: contract.serviceNamespace,
      scalableDimension: contract.scalableDimension,
      capacity: contract.capacity,
      policy: contract.policy,
      requiredActions: contract.iam.requiredActions
    })
  );

  for (const parameter of [
    "ClusterName",
    "WorkerMinCapacity",
    "WorkerMaxCapacity",
    "WorkerTargetBacklogPerTask"
  ]) {
    assert(template.Parameters?.[parameter], `${parameter} must exist.`);
  }
  assert(
    template.Parameters.WorkerMinCapacity.Default ===
      contract.capacity.defaultMinCapacity,
    "WorkerMinCapacity default must match the contract."
  );
  assert(
    template.Parameters.WorkerMaxCapacity.Default ===
      contract.capacity.defaultMaxCapacity,
    "WorkerMaxCapacity default must match the contract."
  );
  assert(
    template.Parameters.WorkerTargetBacklogPerTask.Default ===
      contract.policy.defaultTargetBacklogPerTask,
    "WorkerTargetBacklogPerTask default must match the contract."
  );
  cases.push(
    caseResult("cloudformation-autoscaling-parameters", "PASS", {
      WorkerMinCapacity: template.Parameters.WorkerMinCapacity,
      WorkerMaxCapacity: template.Parameters.WorkerMaxCapacity,
      WorkerTargetBacklogPerTask: template.Parameters.WorkerTargetBacklogPerTask
    })
  );

  const scalableTarget = resource(resources, "CrawlerWorkerScalableTarget");
  assert(
    scalableTarget.Type === "AWS::ApplicationAutoScaling::ScalableTarget",
    "CrawlerWorkerScalableTarget must be an Application Auto Scaling target."
  );
  assert(
    scalableTarget.Properties.ServiceNamespace === contract.serviceNamespace,
    "Scalable target service namespace must match contract."
  );
  assert(
    scalableTarget.Properties.ScalableDimension === contract.scalableDimension,
    "Scalable target dimension must match contract."
  );
  assert(
    JSON.stringify(scalableTarget.Properties.ResourceId).includes(
      "CrawlerWorkerService.Name"
    ),
    "Scalable target must reference the crawler worker ECS service."
  );
  cases.push(
    caseResult("cloudformation-scalable-target", "PASS", {
      type: scalableTarget.Type,
      minCapacity: scalableTarget.Properties.MinCapacity,
      maxCapacity: scalableTarget.Properties.MaxCapacity,
      resourceId: scalableTarget.Properties.ResourceId,
      serviceNamespace: scalableTarget.Properties.ServiceNamespace,
      scalableDimension: scalableTarget.Properties.ScalableDimension
    })
  );

  const policy = resource(resources, "CrawlerWorkerBacklogScalingPolicy");
  const targetTracking =
    policy.Properties.TargetTrackingScalingPolicyConfiguration ?? {};
  assert(
    policy.Type === "AWS::ApplicationAutoScaling::ScalingPolicy",
    "CrawlerWorkerBacklogScalingPolicy must be a ScalingPolicy."
  );
  assert(
    policy.Properties.PolicyType === contract.policy.policyType,
    "Scaling policy type must match contract."
  );
  assert(
    targetTracking.CustomizedMetricSpecification?.Namespace === "AWS/SQS",
    "Scaling policy must use SQS metrics."
  );
  assert(
    targetTracking.CustomizedMetricSpecification?.MetricName ===
      "ApproximateNumberOfMessagesVisible",
    "Scaling policy must use visible message backlog."
  );
  assert(
    targetTracking.ScaleInCooldown === contract.policy.scaleInCooldownSeconds,
    "Scale-in cooldown must match contract."
  );
  assert(
    targetTracking.ScaleOutCooldown === contract.policy.scaleOutCooldownSeconds,
    "Scale-out cooldown must match contract."
  );
  cases.push(
    caseResult("cloudformation-backlog-scaling-policy", "PASS", {
      type: policy.Type,
      policyType: policy.Properties.PolicyType,
      targetTracking
    })
  );

  const autoscalingRole = resource(resources, "CrawlerWorkerAutoscalingRole");
  const roleJson = JSON.stringify(autoscalingRole);
  for (const action of [...contract.iam.requiredActions, "ecs:UpdateService"]) {
    assert(
      roleJson.includes(action),
      `Autoscaling role must include ${action}.`
    );
  }
  cases.push(
    caseResult("cloudformation-autoscaling-iam", "PASS", {
      type: autoscalingRole.Type,
      principal: "application-autoscaling.amazonaws.com",
      requiredActions: contract.iam.requiredActions
    })
  );

  const report = {
    schemaVersion: 1,
    generatedBy: "searchlint-worker-autoscaling-verifier",
    generatedAt,
    status: "passed",
    scope: {
      proofType: "deterministic static worker autoscaling contract",
      liveAwsAccess: "not used by verifier",
      doesNotClaim: [
        "deployed ECS service",
        "deployed Application Auto Scaling target",
        "live SQS backlog metric behavior",
        "live scale-out or scale-in event",
        "production throughput evidence"
      ]
    },
    summary: {
      caseCount: cases.length,
      passed: cases.length,
      failed: 0
    },
    cases,
    remainingLiveGates: [
      "Deploy crawler worker ECS service.",
      "Deploy Application Auto Scaling target and policy.",
      "Generate SQS backlog pressure against a deployed crawl queue.",
      "Record live scale-out and scale-in events.",
      "Review alert noise and worker cost impact under production-shaped load."
    ]
  };

  await mkdir(path.dirname(reportPath), { recursive: true });
  await mkdir(path.dirname(samplePath), { recursive: true });
  await writeJson(reportPath, report);
  await writeJson(samplePath, report);

  console.log(
    `Worker autoscaling ${report.status.toUpperCase()}: ${report.summary.passed}/${report.summary.caseCount} cases passed`
  );
  console.log(`Report: ${path.relative(repoRoot, reportPath)}`);
  console.log(`Sample: ${path.relative(repoRoot, samplePath)}`);
}

function resource(resources, name) {
  const value = resources[name];
  assert(value, `${name} must exist.`);
  return value;
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
