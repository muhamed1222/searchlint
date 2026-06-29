import { describe, expect, it } from "vitest";

import {
  cloudWorkerSqsProvisioningContract,
  validateCloudWorkerSqsProvisioningContract
} from "../src/index.js";

describe("cloudWorkerSqsProvisioningContract", () => {
  it("defines the approved crawl request SQS queue and DLQ target", () => {
    expect(
      validateCloudWorkerSqsProvisioningContract(
        cloudWorkerSqsProvisioningContract
      )
    ).toEqual([]);

    expect(cloudWorkerSqsProvisioningContract.provider).toBe("aws-sqs");
    expect(
      cloudWorkerSqsProvisioningContract.queues.crawlRequests
    ).toMatchObject({
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
    });
  });

  it("defines least-privilege SQS IAM for the outbox polling worker", () => {
    expect(cloudWorkerSqsProvisioningContract.iam.statements).toEqual([
      {
        principal: "outbox-poller-worker",
        actions: ["sqs:SendMessage", "sqs:GetQueueAttributes"],
        resources: ["crawlQueueArn"]
      }
    ]);
  });

  it("rejects queue and DLQ drift", () => {
    const issues = validateCloudWorkerSqsProvisioningContract({
      ...cloudWorkerSqsProvisioningContract,
      provider: "other" as "aws-sqs",
      queues: {
        crawlRequests: {
          ...cloudWorkerSqsProvisioningContract.queues.crawlRequests,
          name: "other" as "searchlint-crawl-requests",
          queueType: "fifo" as "standard",
          queueUrlEnv: "CRAWL_QUEUE_URL" as "SEARCHLINT_CRAWL_QUEUE_URL",
          messageTypes: [],
          visibilityTimeoutSeconds: 0,
          messageRetentionSeconds: 0,
          receiveMessageWaitTimeSeconds: -1,
          encryption: "none" as "sqs-managed",
          deadLetterQueue: {
            name: "other" as "searchlint-crawl-requests-dlq",
            maxReceiveCount: 0,
            messageRetentionSeconds: 0
          }
        }
      }
    });

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "provider" }),
        expect.objectContaining({ path: "queues.crawlRequests.name" }),
        expect.objectContaining({ path: "queues.crawlRequests.queueType" }),
        expect.objectContaining({ path: "queues.crawlRequests.queueUrlEnv" }),
        expect.objectContaining({ path: "queues.crawlRequests.messageTypes" }),
        expect.objectContaining({
          path: "queues.crawlRequests.visibilityTimeoutSeconds"
        }),
        expect.objectContaining({
          path: "queues.crawlRequests.messageRetentionSeconds"
        }),
        expect.objectContaining({
          path: "queues.crawlRequests.receiveMessageWaitTimeSeconds"
        }),
        expect.objectContaining({ path: "queues.crawlRequests.encryption" }),
        expect.objectContaining({
          path: "queues.crawlRequests.deadLetterQueue.name"
        }),
        expect.objectContaining({
          path: "queues.crawlRequests.deadLetterQueue.maxReceiveCount"
        }),
        expect.objectContaining({
          path: "queues.crawlRequests.deadLetterQueue.messageRetentionSeconds"
        })
      ])
    );
  });

  it("rejects unexpected crawl queue message types", () => {
    const issues = validateCloudWorkerSqsProvisioningContract({
      ...cloudWorkerSqsProvisioningContract,
      queues: {
        crawlRequests: {
          ...cloudWorkerSqsProvisioningContract.queues.crawlRequests,
          messageTypes: ["crawl.requested", "other" as "crawl.requested"]
        }
      }
    });

    expect(issues).toEqual([
      {
        path: "queues.crawlRequests.messageTypes",
        message: "Unexpected crawl queue message type other."
      }
    ]);
  });

  it("rejects IAM drift and wildcard-like resource expansion", () => {
    const issues = validateCloudWorkerSqsProvisioningContract({
      ...cloudWorkerSqsProvisioningContract,
      iam: {
        statements: [
          {
            principal: "outbox-poller-worker",
            actions: [
              "sqs:SendMessage",
              "sqs:DeleteMessage" as "sqs:SendMessage"
            ],
            resources: ["*" as "crawlQueueArn"]
          }
        ]
      }
    });

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "iam.statements.outbox-poller-worker.actions",
          message:
            "sqs:GetQueueAttributes is required for the outbox polling worker."
        }),
        expect.objectContaining({
          path: "iam.statements.outbox-poller-worker.actions",
          message: "Unexpected outbox worker SQS IAM action sqs:DeleteMessage."
        }),
        expect.objectContaining({
          path: "iam.statements.outbox-poller-worker.resources",
          message: "outbox-poller-worker must target the crawl queue ARN."
        }),
        expect.objectContaining({
          path: "iam.statements.outbox-poller-worker.resources",
          message: "Unexpected outbox worker SQS IAM resource *."
        })
      ])
    );
  });

  it("requires an outbox polling worker IAM statement", () => {
    const issues = validateCloudWorkerSqsProvisioningContract({
      ...cloudWorkerSqsProvisioningContract,
      iam: {
        statements: []
      }
    });

    expect(issues).toEqual([
      {
        path: "iam.statements",
        message: "outbox-poller-worker IAM statement is required."
      }
    ]);
  });
});
