import type { CloudOutboxTopic } from "@searchlint/api";

export type CloudWorkerSqsProvisioningProvider = "aws-sqs";
export type CloudWorkerSqsQueueType = "standard";
export type CloudWorkerSqsEncryptionMode = "sqs-managed";
export type CloudWorkerSqsIamPrincipal = "outbox-poller-worker";
export type CloudWorkerSqsIamAction =
  | "sqs:SendMessage"
  | "sqs:GetQueueAttributes";
export type CloudWorkerSqsResourceRef = "crawlQueueArn";

export type CloudWorkerSqsDeadLetterQueueContract = {
  name: "searchlint-crawl-requests-dlq";
  maxReceiveCount: number;
  messageRetentionSeconds: number;
};

export type CloudWorkerSqsQueueContract = {
  name: "searchlint-crawl-requests";
  queueType: CloudWorkerSqsQueueType;
  queueUrlEnv: "SEARCHLINT_CRAWL_QUEUE_URL";
  messageTypes: readonly CloudOutboxTopic[];
  visibilityTimeoutSeconds: number;
  messageRetentionSeconds: number;
  receiveMessageWaitTimeSeconds: number;
  encryption: CloudWorkerSqsEncryptionMode;
  deadLetterQueue: CloudWorkerSqsDeadLetterQueueContract;
};

export type CloudWorkerSqsIamStatementContract = {
  principal: CloudWorkerSqsIamPrincipal;
  actions: readonly CloudWorkerSqsIamAction[];
  resources: readonly CloudWorkerSqsResourceRef[];
};

export type CloudWorkerSqsProvisioningContract = {
  id: "searchlint-cloud-worker-sqs-provisioning-v1";
  contractVersion: 1;
  provider: CloudWorkerSqsProvisioningProvider;
  queues: {
    crawlRequests: CloudWorkerSqsQueueContract;
  };
  iam: {
    statements: readonly CloudWorkerSqsIamStatementContract[];
  };
};

export type CloudWorkerSqsProvisioningValidationIssue = {
  path: string;
  message: string;
};

export const cloudWorkerSqsProvisioningContract: CloudWorkerSqsProvisioningContract =
  {
    id: "searchlint-cloud-worker-sqs-provisioning-v1",
    contractVersion: 1,
    provider: "aws-sqs",
    queues: {
      crawlRequests: {
        name: "searchlint-crawl-requests",
        queueType: "standard",
        queueUrlEnv: "SEARCHLINT_CRAWL_QUEUE_URL",
        messageTypes: ["crawl.requested"],
        visibilityTimeoutSeconds: 300,
        messageRetentionSeconds: 1_209_600,
        receiveMessageWaitTimeSeconds: 20,
        encryption: "sqs-managed",
        deadLetterQueue: {
          name: "searchlint-crawl-requests-dlq",
          maxReceiveCount: 5,
          messageRetentionSeconds: 1_209_600
        }
      }
    },
    iam: {
      statements: [
        {
          principal: "outbox-poller-worker",
          actions: ["sqs:SendMessage", "sqs:GetQueueAttributes"],
          resources: ["crawlQueueArn"]
        }
      ]
    }
  };

export function validateCloudWorkerSqsProvisioningContract(
  contract: CloudWorkerSqsProvisioningContract
): CloudWorkerSqsProvisioningValidationIssue[] {
  const issues: CloudWorkerSqsProvisioningValidationIssue[] = [];

  expectEqual(
    issues,
    "id",
    contract.id,
    "searchlint-cloud-worker-sqs-provisioning-v1"
  );
  expectEqual(issues, "contractVersion", contract.contractVersion, 1);
  expectEqual(issues, "provider", contract.provider, "aws-sqs");
  validateCrawlQueue(contract.queues.crawlRequests, issues);
  validateIamStatements(contract.iam.statements, issues);

  return issues;
}

function validateCrawlQueue(
  queue: CloudWorkerSqsQueueContract,
  issues: CloudWorkerSqsProvisioningValidationIssue[]
): void {
  expectEqual(
    issues,
    "queues.crawlRequests.name",
    queue.name,
    "searchlint-crawl-requests"
  );
  expectEqual(
    issues,
    "queues.crawlRequests.queueType",
    queue.queueType,
    "standard"
  );
  expectEqual(
    issues,
    "queues.crawlRequests.queueUrlEnv",
    queue.queueUrlEnv,
    "SEARCHLINT_CRAWL_QUEUE_URL"
  );
  expectEqual(
    issues,
    "queues.crawlRequests.encryption",
    queue.encryption,
    "sqs-managed"
  );

  if (!queue.messageTypes.includes("crawl.requested")) {
    issues.push({
      path: "queues.crawlRequests.messageTypes",
      message: "crawl.requested messages must be routed to the crawl queue."
    });
  }

  for (const messageType of queue.messageTypes) {
    if (messageType !== "crawl.requested") {
      issues.push({
        path: "queues.crawlRequests.messageTypes",
        message: `Unexpected crawl queue message type ${String(messageType)}.`
      });
    }
  }

  expectPositiveInteger(
    issues,
    "queues.crawlRequests.visibilityTimeoutSeconds",
    queue.visibilityTimeoutSeconds,
    "Crawl queue visibility timeout must be a positive integer."
  );
  expectPositiveInteger(
    issues,
    "queues.crawlRequests.messageRetentionSeconds",
    queue.messageRetentionSeconds,
    "Crawl queue message retention must be a positive integer."
  );
  expectNonNegativeInteger(
    issues,
    "queues.crawlRequests.receiveMessageWaitTimeSeconds",
    queue.receiveMessageWaitTimeSeconds,
    "Crawl queue wait time must be a non-negative integer."
  );
  validateDeadLetterQueue(queue.deadLetterQueue, issues);
}

function validateDeadLetterQueue(
  deadLetterQueue: CloudWorkerSqsDeadLetterQueueContract,
  issues: CloudWorkerSqsProvisioningValidationIssue[]
): void {
  expectEqual(
    issues,
    "queues.crawlRequests.deadLetterQueue.name",
    deadLetterQueue.name,
    "searchlint-crawl-requests-dlq"
  );
  expectPositiveInteger(
    issues,
    "queues.crawlRequests.deadLetterQueue.maxReceiveCount",
    deadLetterQueue.maxReceiveCount,
    "Crawl queue DLQ max receive count must be a positive integer."
  );
  expectPositiveInteger(
    issues,
    "queues.crawlRequests.deadLetterQueue.messageRetentionSeconds",
    deadLetterQueue.messageRetentionSeconds,
    "Crawl queue DLQ retention must be a positive integer."
  );
}

function validateIamStatements(
  statements: readonly CloudWorkerSqsIamStatementContract[],
  issues: CloudWorkerSqsProvisioningValidationIssue[]
): void {
  const outboxStatement = statements.find(
    (statement) => statement.principal === "outbox-poller-worker"
  );

  if (!outboxStatement) {
    issues.push({
      path: "iam.statements",
      message: "outbox-poller-worker IAM statement is required."
    });
    return;
  }

  for (const action of ["sqs:SendMessage", "sqs:GetQueueAttributes"] as const) {
    if (!outboxStatement.actions.includes(action)) {
      issues.push({
        path: "iam.statements.outbox-poller-worker.actions",
        message: `${action} is required for the outbox polling worker.`
      });
    }
  }

  for (const action of outboxStatement.actions) {
    if (action !== "sqs:SendMessage" && action !== "sqs:GetQueueAttributes") {
      issues.push({
        path: "iam.statements.outbox-poller-worker.actions",
        message: `Unexpected outbox worker SQS IAM action ${String(action)}.`
      });
    }
  }

  if (!outboxStatement.resources.includes("crawlQueueArn")) {
    issues.push({
      path: "iam.statements.outbox-poller-worker.resources",
      message: "outbox-poller-worker must target the crawl queue ARN."
    });
  }

  for (const resource of outboxStatement.resources) {
    if (resource !== "crawlQueueArn") {
      issues.push({
        path: "iam.statements.outbox-poller-worker.resources",
        message: `Unexpected outbox worker SQS IAM resource ${String(
          resource
        )}.`
      });
    }
  }
}

function expectEqual<T>(
  issues: CloudWorkerSqsProvisioningValidationIssue[],
  path: string,
  actual: T,
  expected: T
): void {
  if (actual !== expected) {
    issues.push({
      path,
      message: `Expected ${path} to be ${String(expected)}.`
    });
  }
}

function expectPositiveInteger(
  issues: CloudWorkerSqsProvisioningValidationIssue[],
  path: string,
  value: number,
  message: string
): void {
  if (!Number.isInteger(value) || value < 1) {
    issues.push({
      path,
      message
    });
  }
}

function expectNonNegativeInteger(
  issues: CloudWorkerSqsProvisioningValidationIssue[],
  path: string,
  value: number,
  message: string
): void {
  if (!Number.isInteger(value) || value < 0) {
    issues.push({
      path,
      message
    });
  }
}
