import { SendMessageCommand } from "@aws-sdk/client-sqs";
import type { SendMessageCommandOutput } from "@aws-sdk/client-sqs";
import { describe, expect, it } from "vitest";

import { createSqsOutboxPublisher } from "../src/index.js";
import type { SqsSendClient } from "../src/index.js";
import type { CrawlJobPayload } from "@searchlint/api";

describe("createSqsOutboxPublisher", () => {
  it("sends deterministic crawl request messages to standard queues", async () => {
    const harness = createHarness();
    const publisher = createSqsOutboxPublisher({
      client: harness.client,
      queueUrl: " https://sqs.us-east-1.amazonaws.com/123/searchlint-crawl "
    });

    await publisher.publishCrawlRequested(crawlPayload);

    expect(harness.commands).toHaveLength(1);
    const input = harness.commands[0]?.input;
    expect(input).toEqual({
      QueueUrl: "https://sqs.us-east-1.amazonaws.com/123/searchlint-crawl",
      MessageBody: JSON.stringify({
        schemaVersion: 1,
        type: "crawl.requested",
        payload: crawlPayload
      }),
      MessageAttributes: {
        searchlintMessageType: {
          DataType: "String",
          StringValue: "crawl.requested"
        },
        organizationId: {
          DataType: "String",
          StringValue: "org-1"
        },
        projectId: {
          DataType: "String",
          StringValue: "project-1"
        },
        environmentId: {
          DataType: "String",
          StringValue: "env-1"
        },
        crawlRequestId: {
          DataType: "String",
          StringValue: "crawl-1"
        }
      }
    });
  });

  it("adds FIFO group and deterministic deduplication identifiers", async () => {
    const harness = createHarness();
    const publisher = createSqsOutboxPublisher({
      client: harness.client,
      queueUrl: "https://sqs.us-east-1.amazonaws.com/123/searchlint-crawl.fifo",
      fifo: {
        messageGroupId: "org-1",
        messageDeduplicationPrefix: "searchlint"
      }
    });

    await publisher.publishCrawlRequested(crawlPayload);

    expect(harness.commands[0]?.input.MessageGroupId).toBe("org-1");
    expect(harness.commands[0]?.input.MessageDeduplicationId).toBe(
      "searchlint:crawl-1"
    );
  });

  it("rejects empty queue URLs before sending", () => {
    const harness = createHarness();

    expect(() =>
      createSqsOutboxPublisher({
        client: harness.client,
        queueUrl: " "
      })
    ).toThrow("SQS queue URL is required.");
    expect(harness.commands).toEqual([]);
  });

  it("rejects FIFO queues without a message group before sending", () => {
    const harness = createHarness();

    expect(() =>
      createSqsOutboxPublisher({
        client: harness.client,
        queueUrl: "https://sqs.us-east-1.amazonaws.com/123/searchlint.fifo"
      })
    ).toThrow("FIFO SQS queues require a message group ID.");
    expect(harness.commands).toEqual([]);
  });

  it("rejects FIFO configuration on standard queues before sending", () => {
    const harness = createHarness();

    expect(() =>
      createSqsOutboxPublisher({
        client: harness.client,
        queueUrl: "https://sqs.us-east-1.amazonaws.com/123/searchlint",
        fifo: {
          messageGroupId: "org-1"
        }
      })
    ).toThrow("FIFO SQS configuration requires a .fifo queue URL.");
    expect(harness.commands).toEqual([]);
  });

  it("propagates SQS send failures", async () => {
    const harness = createHarness({
      sendError: new Error("SQS send failed")
    });
    const publisher = createSqsOutboxPublisher({
      client: harness.client,
      queueUrl: "https://sqs.us-east-1.amazonaws.com/123/searchlint"
    });

    await expect(publisher.publishCrawlRequested(crawlPayload)).rejects.toThrow(
      "SQS send failed"
    );
    expect(harness.commands).toHaveLength(1);
  });
});

const crawlPayload: CrawlJobPayload = {
  crawlRequestId: "crawl-1",
  organizationId: "org-1",
  projectId: "project-1",
  environmentId: "env-1",
  maxUrls: 500
};

function createHarness(options: { sendError?: Error } = {}) {
  const commands: SendMessageCommand[] = [];
  const client: SqsSendClient = {
    async send(command) {
      if (!(command instanceof SendMessageCommand)) {
        throw new Error("Expected SendMessageCommand.");
      }
      commands.push(command);
      if (options.sendError) {
        throw options.sendError;
      }
      return {
        MessageId: "message-1",
        $metadata: {}
      } satisfies SendMessageCommandOutput;
    }
  };

  return {
    client,
    commands
  };
}
