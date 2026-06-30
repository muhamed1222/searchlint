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
const dockerfilePath = "Dockerfile.worker";
const reportPath = path.join(repoRoot, "reports/worker-containers-report.json");
const samplePath = path.join(
  repoRoot,
  "docs/examples/worker-containers-report.sample.json"
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
    "deployment-contracts.test.ts",
    "node.test.ts",
    "crawler-worker-process.test.ts"
  ]);
  run("pnpm", ["--filter", "@searchlint/workers", "build"]);

  const workers = await import("../services/workers/dist/src/index.js");
  const deploymentContract = workers.cloudWorkerDeploymentContract;
  const deploymentIssues =
    workers.validateCloudWorkerDeploymentContract(deploymentContract);
  assert(deploymentIssues.length === 0, "Worker deployment contract drifted.");

  const dockerfile = await readText(dockerfilePath);
  verifyDockerfile(dockerfile);

  const template = JSON.parse(await readText(templatePath));
  const resources = template.Resources ?? {};
  const task = requiredResource(
    resources,
    "CrawlerWorkerTaskDefinition",
    "AWS::ECS::TaskDefinition"
  ).Properties;
  const service = requiredResource(
    resources,
    "CrawlerWorkerService",
    "AWS::ECS::Service"
  ).Properties;
  const container = task.ContainerDefinitions?.[0];

  assert(
    task.RequiresCompatibilities?.includes("FARGATE"),
    "Task must require FARGATE."
  );
  assert(task.NetworkMode === "awsvpc", "Task must use awsvpc networking.");
  assert(container, "Worker task must define a container.");
  assert(container.Name === "crawler-worker", "Worker container name drifted.");
  assert(
    JSON.stringify(container.Image) ===
      JSON.stringify({ Ref: "WorkerImageUri" }),
    "Worker image must come from WorkerImageUri parameter."
  );
  assert(
    JSON.stringify(container.Command) ===
      JSON.stringify(["node", "dist/src/bin.js"]),
    "Worker container command must run built worker entrypoint."
  );
  assert(container.Essential === true, "Worker container must be essential.");
  assert(
    container.LogConfiguration?.LogDriver === "awslogs",
    "Worker container must use awslogs."
  );

  const env = objectByName(container.Environment ?? []);
  for (const name of [
    "SEARCHLINT_POSTGRES_SSL_MODE",
    "SEARCHLINT_CRAWL_QUEUE_URL",
    "SEARCHLINT_CRAWL_ARTIFACT_BUCKET",
    "SEARCHLINT_CRAWL_ARTIFACT_KEY_PREFIX",
    "SEARCHLINT_RULE_CATALOG_PATH",
    "SEARCHLINT_WORKER_CRAWLER_POLL_INTERVAL_MS",
    "SEARCHLINT_WORKER_CRAWLER_BATCH_SIZE",
    "SEARCHLINT_WORKER_CRAWLER_WAIT_TIME_SECONDS",
    "SEARCHLINT_WORKER_CRAWLER_VISIBILITY_TIMEOUT_SECONDS",
    "OTEL_SERVICE_NAME",
    "SEARCHLINT_ENVIRONMENT",
    "OTEL_EXPORTER_OTLP_ENDPOINT",
    "OTEL_EXPORTER_OTLP_PROTOCOL",
    "OTEL_EXPORTER_OTLP_TIMEOUT"
  ]) {
    assert(env.has(name), `${name} must be declared as worker env.`);
  }
  assert(
    env.get("SEARCHLINT_RULE_CATALOG_PATH")?.Value ===
      "/app/specs/RULE_CATALOG.yaml",
    "Worker rule catalog path must point at runtime image catalog."
  );
  assert(
    env.get("OTEL_SERVICE_NAME")?.Value === "searchlint-crawler-worker",
    "Worker OTLP service name drifted."
  );
  assert(
    env.get("OTEL_EXPORTER_OTLP_PROTOCOL")?.Value === "http/protobuf",
    "Worker OTLP protocol must be http/protobuf."
  );

  const secrets = objectByName(container.Secrets ?? []);
  assert(
    secrets.has("SEARCHLINT_POSTGRES_DATABASE_URL"),
    "Database URL must be injected as ECS secret."
  );
  assert(
    !env.has("SEARCHLINT_POSTGRES_DATABASE_URL"),
    "Database URL must not be plaintext env."
  );
  assert(
    service.LaunchType === "FARGATE",
    "Worker ECS service must launch Fargate tasks."
  );
  assert(
    service.NetworkConfiguration?.AwsvpcConfiguration?.AssignPublicIp ===
      "DISABLED",
    "Worker ECS service must not assign public IPs."
  );
  assert(
    service.TaskDefinition?.Ref === "CrawlerWorkerTaskDefinition",
    "Worker ECS service must reference worker task definition."
  );

  const report = {
    schemaVersion: 1,
    generatedBy: "searchlint-worker-containers-verifier",
    generatedAt,
    status: "static-container-deployment-passed-release-blocked",
    scope: {
      proofType: "deterministic static worker container deployment contract",
      liveAwsAccess: "not used by verifier",
      dockerBuild: "not run by verifier",
      cloudFormation: templatePath,
      dockerfile: dockerfilePath,
      doesNotClaim: [
        "published container image",
        "live ECS service deployment",
        "running ECS task health",
        "live worker logs",
        "live worker metrics"
      ]
    },
    commands: [
      {
        command:
          "pnpm --filter @searchlint/workers test -- deployment-contracts.test.ts node.test.ts crawler-worker-process.test.ts",
        status: "passed"
      },
      {
        command: "pnpm --filter @searchlint/workers build",
        status: "passed"
      }
    ],
    dockerfile: {
      baseImage: "node:24-bookworm-slim",
      package: "@searchlint/workers",
      deployTarget: "/app",
      runtimeUser: "node",
      command: ["node", "dist/src/bin.js"],
      includesRuleCatalog: true
    },
    deploymentContract: {
      id: deploymentContract.id,
      compute: deploymentContract.runtime.compute,
      nodeMajor: deploymentContract.runtime.nodeMajor,
      packageName: deploymentContract.runtime.packageName,
      shutdownSignals: deploymentContract.runtime.shutdownSignals,
      queueProvider: deploymentContract.queue.provider,
      logSink: deploymentContract.observability.logSink
    },
    cloudFormation: {
      taskDefinitionLogicalId: "CrawlerWorkerTaskDefinition",
      serviceLogicalId: "CrawlerWorkerService",
      requiresCompatibilities: task.RequiresCompatibilities,
      networkMode: task.NetworkMode,
      launchType: service.LaunchType,
      assignPublicIp:
        service.NetworkConfiguration?.AwsvpcConfiguration?.AssignPublicIp,
      containerName: container.Name,
      imageParameter: "WorkerImageUri",
      command: container.Command,
      logDriver: container.LogConfiguration?.LogDriver,
      secretNames: Array.from(secrets.keys()).sort(),
      environmentNames: Array.from(env.keys()).sort()
    },
    remainingReleaseGates: [
      "Build the worker container image in release CI.",
      "Publish the worker image to the approved container registry.",
      "Deploy the ECS/Fargate worker service in the target AWS account.",
      "Capture running task health and startup logs.",
      "Verify live worker metrics, logs, autoscaling, and shutdown behavior."
    ]
  };

  assertNoSensitiveValues(JSON.stringify(report));
  await mkdir(path.dirname(reportPath), { recursive: true });
  await mkdir(path.dirname(samplePath), { recursive: true });
  await writeJson(reportPath, report);
  await writeJson(samplePath, report);

  console.log(
    `Worker container static contract PASS: image=${report.dockerfile.baseImage}, command=${report.dockerfile.command.join(" ")}`
  );
  console.log(`Report: ${path.relative(repoRoot, reportPath)}`);
  console.log(`Sample: ${path.relative(repoRoot, samplePath)}`);
}

function verifyDockerfile(text) {
  for (const phrase of [
    "FROM node:24-bookworm-slim AS base",
    "FROM node:24-bookworm-slim AS runtime",
    "RUN corepack enable && corepack prepare pnpm@11.8.0 --activate",
    "RUN pnpm install --frozen-lockfile",
    "RUN pnpm build",
    "RUN pnpm --filter @searchlint/workers deploy --legacy --prod /app",
    "COPY --from=build --chown=node:node /app /app",
    "COPY --from=build --chown=node:node /workspace/specs/RULE_CATALOG.yaml /app/specs/RULE_CATALOG.yaml",
    "USER node",
    'CMD ["node", "dist/src/bin.js"]'
  ]) {
    assert(text.includes(phrase), `Dockerfile.worker missing: ${phrase}`);
  }
  assert(
    !/FROM\s+.*alpine/i.test(text),
    "Worker Dockerfile must not use Alpine."
  );
}

function requiredResource(resources, logicalId, type) {
  const resource = resources[logicalId];
  assert(resource, `${logicalId} resource is required.`);
  assert(resource.Type === type, `${logicalId} must be ${type}.`);
  return resource;
}

function objectByName(items) {
  return new Map(
    items
      .filter((item) => item && typeof item === "object" && "Name" in item)
      .map((item) => [item.Name, item])
  );
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
    throw new Error(
      `Sensitive value leaked into worker container evidence: ${match}`
    );
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
