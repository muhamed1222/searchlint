import {
  SendMessageCommand,
  type MessageAttributeValue,
  type SendMessageCommandOutput,
  type SQSClient
} from "@aws-sdk/client-sqs";
import type { CrawlJobPayload } from "@searchlint/api";

import type { OutboxPublisher } from "./index.js";

export type SqsSendClient = Pick<SQSClient, "send">;

export type SqsOutboxPublisherOptions = {
  client: SqsSendClient;
  queueUrl: string;
  fifo?: {
    messageGroupId: string;
    messageDeduplicationPrefix?: string;
  };
};

export type SqsCrawlRequestedMessage = {
  schemaVersion: 1;
  type: "crawl.requested";
  payload: CrawlJobPayload;
};

export function createSqsOutboxPublisher(
  options: SqsOutboxPublisherOptions
): OutboxPublisher {
  const config = validateSqsOptions(options);
  return {
    async publishCrawlRequested(payload) {
      await config.client.send(
        new SendMessageCommand(crawlMessage(config, payload))
      );
    }
  };
}

function crawlMessage(
  config: ValidSqsOptions,
  payload: CrawlJobPayload
): ConstructorParameters<typeof SendMessageCommand>[0] {
  const message: ConstructorParameters<typeof SendMessageCommand>[0] = {
    QueueUrl: config.queueUrl,
    MessageBody: JSON.stringify(crawlRequestedMessage(payload)),
    MessageAttributes: crawlMessageAttributes(payload)
  };

  if (config.fifo) {
    message.MessageGroupId = config.fifo.messageGroupId;
    message.MessageDeduplicationId = [
      config.fifo.messageDeduplicationPrefix,
      payload.crawlRequestId
    ].join(":");
  }

  return message;
}

function crawlRequestedMessage(
  payload: CrawlJobPayload
): SqsCrawlRequestedMessage {
  return {
    schemaVersion: 1,
    type: "crawl.requested",
    payload
  };
}

function crawlMessageAttributes(
  payload: CrawlJobPayload
): Record<string, MessageAttributeValue> {
  return {
    searchlintMessageType: stringAttribute("crawl.requested"),
    organizationId: stringAttribute(payload.organizationId),
    projectId: stringAttribute(payload.projectId),
    environmentId: stringAttribute(payload.environmentId),
    crawlRequestId: stringAttribute(payload.crawlRequestId)
  };
}

function stringAttribute(value: string): MessageAttributeValue {
  return {
    DataType: "String",
    StringValue: value
  };
}

type ValidSqsOptions = {
  client: {
    send(command: SendMessageCommand): Promise<SendMessageCommandOutput>;
  };
  queueUrl: string;
  fifo?: {
    messageGroupId: string;
    messageDeduplicationPrefix: string;
  };
};

function validateSqsOptions(
  options: SqsOutboxPublisherOptions
): ValidSqsOptions {
  const queueUrl = options.queueUrl.trim();
  if (queueUrl.length === 0) {
    throw new Error("SQS queue URL is required.");
  }

  if (!options.fifo) {
    if (queueUrl.endsWith(".fifo")) {
      throw new Error("FIFO SQS queues require a message group ID.");
    }
    return {
      client: options.client,
      queueUrl
    };
  }

  if (!queueUrl.endsWith(".fifo")) {
    throw new Error("FIFO SQS configuration requires a .fifo queue URL.");
  }

  const messageGroupId = options.fifo.messageGroupId.trim();
  if (messageGroupId.length === 0) {
    throw new Error("FIFO SQS queues require a message group ID.");
  }

  const messageDeduplicationPrefix =
    options.fifo.messageDeduplicationPrefix?.trim() || "searchlint-crawl";

  return {
    client: options.client,
    queueUrl,
    fifo: {
      messageGroupId,
      messageDeduplicationPrefix
    }
  };
}
