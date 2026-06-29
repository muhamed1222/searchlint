import type { CloudOutboxTopic } from "@searchlint/api";

export type CloudWorkerComputeKind = "aws-ecs-fargate";
export type CloudWorkerRuntimeKind = "outbox-poller";
export type CloudWorkerQueueProvider = "aws-sqs";
export type CloudWorkerSecretSource = "aws-secrets-manager" | "plain-env";
export type CloudWorkerLogSink = "aws-cloudwatch";
export type CloudWorkerShutdownSignal = "SIGTERM" | "SIGINT";

export type CloudWorkerDeploymentEnvironmentVariable = {
  name: string;
  required: boolean;
  secretSource?: CloudWorkerSecretSource;
};

export type CloudWorkerDeploymentContract = {
  id: "searchlint-cloud-worker-outbox-ecs-fargate-v1";
  contractVersion: 1;
  runtime: {
    compute: CloudWorkerComputeKind;
    nodeMajor: 24;
    workerKind: CloudWorkerRuntimeKind;
    packageName: "@searchlint/workers";
    shutdownSignals: readonly ["SIGTERM", "SIGINT"];
    pollIntervalMs: number;
    batchSize: number;
    stopOnError: false;
  };
  queue: {
    provider: CloudWorkerQueueProvider;
    messageTypes: readonly CloudOutboxTopic[];
    crawlQueueUrlEnv: "SEARCHLINT_CRAWL_QUEUE_URL";
    fifoSupported: true;
    deadLetterQueueRequired: true;
  };
  observability: {
    structuredWorkerLogs: true;
    logSink: CloudWorkerLogSink;
    lifecycleStateField: "state";
  };
  environment: {
    postgresEnvPrefix: "SEARCHLINT_POSTGRES";
    workerEnvPrefix: "SEARCHLINT_WORKER";
    variables: readonly CloudWorkerDeploymentEnvironmentVariable[];
  };
};

export type CloudWorkerDeploymentValidationIssue = {
  path: string;
  message: string;
};

export const cloudWorkerDeploymentContract: CloudWorkerDeploymentContract = {
  id: "searchlint-cloud-worker-outbox-ecs-fargate-v1",
  contractVersion: 1,
  runtime: {
    compute: "aws-ecs-fargate",
    nodeMajor: 24,
    workerKind: "outbox-poller",
    packageName: "@searchlint/workers",
    shutdownSignals: ["SIGTERM", "SIGINT"],
    pollIntervalMs: 1000,
    batchSize: 25,
    stopOnError: false
  },
  queue: {
    provider: "aws-sqs",
    messageTypes: ["crawl.requested"],
    crawlQueueUrlEnv: "SEARCHLINT_CRAWL_QUEUE_URL",
    fifoSupported: true,
    deadLetterQueueRequired: true
  },
  observability: {
    structuredWorkerLogs: true,
    logSink: "aws-cloudwatch",
    lifecycleStateField: "state"
  },
  environment: {
    postgresEnvPrefix: "SEARCHLINT_POSTGRES",
    workerEnvPrefix: "SEARCHLINT_WORKER",
    variables: [
      {
        name: "SEARCHLINT_POSTGRES_DATABASE_URL",
        required: true,
        secretSource: "aws-secrets-manager"
      },
      {
        name: "SEARCHLINT_POSTGRES_SSL_MODE",
        required: true,
        secretSource: "plain-env"
      },
      {
        name: "SEARCHLINT_CRAWL_QUEUE_URL",
        required: true,
        secretSource: "plain-env"
      },
      {
        name: "SEARCHLINT_CRAWL_ARTIFACT_BUCKET",
        required: true,
        secretSource: "plain-env"
      },
      {
        name: "SEARCHLINT_RULE_CATALOG_PATH",
        required: true,
        secretSource: "plain-env"
      },
      {
        name: "SEARCHLINT_WORKER_OUTBOX_POLL_INTERVAL_MS",
        required: false,
        secretSource: "plain-env"
      },
      {
        name: "SEARCHLINT_WORKER_OUTBOX_BATCH_SIZE",
        required: false,
        secretSource: "plain-env"
      }
    ]
  }
};

export function validateCloudWorkerDeploymentContract(
  contract: CloudWorkerDeploymentContract
): CloudWorkerDeploymentValidationIssue[] {
  const issues: CloudWorkerDeploymentValidationIssue[] = [];

  expectEqual(
    issues,
    "id",
    contract.id,
    "searchlint-cloud-worker-outbox-ecs-fargate-v1"
  );
  expectEqual(issues, "contractVersion", contract.contractVersion, 1);
  expectEqual(
    issues,
    "runtime.compute",
    contract.runtime.compute,
    "aws-ecs-fargate"
  );
  expectEqual(issues, "runtime.nodeMajor", contract.runtime.nodeMajor, 24);
  expectEqual(
    issues,
    "runtime.workerKind",
    contract.runtime.workerKind,
    "outbox-poller"
  );
  expectEqual(
    issues,
    "runtime.packageName",
    contract.runtime.packageName,
    "@searchlint/workers"
  );
  expectEqual(
    issues,
    "runtime.stopOnError",
    contract.runtime.stopOnError,
    false
  );
  expectEqual(issues, "queue.provider", contract.queue.provider, "aws-sqs");
  expectEqual(
    issues,
    "queue.crawlQueueUrlEnv",
    contract.queue.crawlQueueUrlEnv,
    "SEARCHLINT_CRAWL_QUEUE_URL"
  );
  expectEqual(
    issues,
    "queue.fifoSupported",
    contract.queue.fifoSupported,
    true
  );
  expectEqual(
    issues,
    "queue.deadLetterQueueRequired",
    contract.queue.deadLetterQueueRequired,
    true
  );
  expectEqual(
    issues,
    "observability.structuredWorkerLogs",
    contract.observability.structuredWorkerLogs,
    true
  );
  expectEqual(
    issues,
    "observability.logSink",
    contract.observability.logSink,
    "aws-cloudwatch"
  );
  expectEqual(
    issues,
    "observability.lifecycleStateField",
    contract.observability.lifecycleStateField,
    "state"
  );
  expectEqual(
    issues,
    "environment.postgresEnvPrefix",
    contract.environment.postgresEnvPrefix,
    "SEARCHLINT_POSTGRES"
  );
  expectEqual(
    issues,
    "environment.workerEnvPrefix",
    contract.environment.workerEnvPrefix,
    "SEARCHLINT_WORKER"
  );

  validateRuntime(contract, issues);
  validateQueue(contract, issues);
  validateEnvironment(contract, issues);

  return issues;
}

function validateRuntime(
  contract: CloudWorkerDeploymentContract,
  issues: CloudWorkerDeploymentValidationIssue[]
): void {
  for (const signal of ["SIGTERM", "SIGINT"] as const) {
    if (!contract.runtime.shutdownSignals.includes(signal)) {
      issues.push({
        path: "runtime.shutdownSignals",
        message: `${signal} shutdown handling is required.`
      });
    }
  }

  if (
    !Number.isInteger(contract.runtime.pollIntervalMs) ||
    contract.runtime.pollIntervalMs < 1
  ) {
    issues.push({
      path: "runtime.pollIntervalMs",
      message: "Worker poll interval must be a positive integer."
    });
  }

  if (
    !Number.isInteger(contract.runtime.batchSize) ||
    contract.runtime.batchSize < 1
  ) {
    issues.push({
      path: "runtime.batchSize",
      message: "Worker batch size must be a positive integer."
    });
  }
}

function validateQueue(
  contract: CloudWorkerDeploymentContract,
  issues: CloudWorkerDeploymentValidationIssue[]
): void {
  if (!contract.queue.messageTypes.includes("crawl.requested")) {
    issues.push({
      path: "queue.messageTypes",
      message: "crawl.requested messages must be supported."
    });
  }

  for (const messageType of contract.queue.messageTypes) {
    if (messageType !== "crawl.requested") {
      issues.push({
        path: "queue.messageTypes",
        message: `Unexpected worker message type ${String(messageType)}.`
      });
    }
  }
}

function validateEnvironment(
  contract: CloudWorkerDeploymentContract,
  issues: CloudWorkerDeploymentValidationIssue[]
): void {
  const variables = new Map(
    contract.environment.variables.map((variable) => [variable.name, variable])
  );

  for (const name of [
    "SEARCHLINT_POSTGRES_DATABASE_URL",
    "SEARCHLINT_POSTGRES_SSL_MODE",
    "SEARCHLINT_CRAWL_QUEUE_URL",
    "SEARCHLINT_CRAWL_ARTIFACT_BUCKET",
    "SEARCHLINT_RULE_CATALOG_PATH"
  ]) {
    const variable = variables.get(name);
    if (!variable) {
      issues.push({
        path: "environment.variables",
        message: `${name} is required.`
      });
      continue;
    }

    if (!variable.required) {
      issues.push({
        path: `environment.variables.${name}.required`,
        message: `${name} must be marked required.`
      });
    }
  }

  const databaseUrl = variables.get("SEARCHLINT_POSTGRES_DATABASE_URL");
  if (databaseUrl?.secretSource !== "aws-secrets-manager") {
    issues.push({
      path: "environment.variables.SEARCHLINT_POSTGRES_DATABASE_URL.secretSource",
      message: "PostgreSQL database URL must come from AWS Secrets Manager."
    });
  }
}

function expectEqual(
  issues: CloudWorkerDeploymentValidationIssue[],
  path: string,
  actual: unknown,
  expected: unknown
): void {
  if (actual !== expected) {
    issues.push({
      path,
      message: `${path} must be ${String(expected)}.`
    });
  }
}
