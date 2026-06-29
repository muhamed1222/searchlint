import {
  ChangeMessageVisibilityCommand,
  DeleteMessageCommand,
  ReceiveMessageCommand
} from "@aws-sdk/client-sqs";
import type {
  ChangeMessageVisibilityCommandOutput,
  DeleteMessageCommandOutput,
  Message,
  ReceiveMessageCommandOutput
} from "@aws-sdk/client-sqs";
import { describe, expect, it } from "vitest";

import {
  consumeSqsCrawlBatch,
  sqsCrawlerBackoffVisibilityTimeoutSeconds
} from "../src/index.js";
import type {
  CloudCrawlArtifactStore,
  CloudCrawlJobStore,
  CloudCrawlTargetResolver,
  CloudCrawlerExecutionClock,
  SqsCrawlerClient
} from "../src/index.js";
import type { CrawlJobPayload } from "@searchlint/api";
import type {
  CrawlResponse,
  CrawlResult,
  CrawlerFetcher
} from "@searchlint/crawler";

describe("consumeSqsCrawlBatch", () => {
  it("receives crawl messages, executes crawls, and deletes successful messages", async () => {
    const harness = createHarness({
      messages: [
        sqsMessage({
          body: crawlMessage(crawlPayload()),
          receiptHandle: "receipt-1"
        })
      ]
    });

    await expect(consumeSqsCrawlBatch(harness.input())).resolves.toEqual({
      received: 1,
      handled: 1,
      succeeded: 1,
      failed: 0,
      invalid: 0,
      deleted: 1,
      skipped: 0,
      canceled: 0,
      backoffApplied: 0
    });

    expect(harness.commands.map((command) => command.constructor)).toEqual([
      ReceiveMessageCommand,
      DeleteMessageCommand
    ]);
    expect(harness.receiveCommands[0]?.input).toEqual({
      QueueUrl: "https://sqs.us-east-1.amazonaws.com/123/searchlint-crawl",
      MaxNumberOfMessages: 5,
      MessageAttributeNames: [
        "searchlintMessageType",
        "organizationId",
        "projectId",
        "environmentId",
        "crawlRequestId"
      ],
      MessageSystemAttributeNames: ["ApproximateReceiveCount"],
      WaitTimeSeconds: 10,
      VisibilityTimeout: 30
    });
    expect(harness.deleteCommands[0]?.input).toEqual({
      QueueUrl: "https://sqs.us-east-1.amazonaws.com/123/searchlint-crawl",
      ReceiptHandle: "receipt-1"
    });
    expect(harness.events).toEqual([
      "resolve:crawl-1",
      "running:crawl-1",
      "fetch:https://example.com/robots.txt",
      "fetch:https://example.com/",
      "artifact:crawl-1",
      "succeeded:crawl-1"
    ]);
  });

  it("leaves failed execution messages undeleted for SQS retry", async () => {
    const harness = createHarness({
      messages: [
        sqsMessage({
          body: crawlMessage(crawlPayload()),
          receiptHandle: "receipt-1"
        })
      ],
      artifactError: new Error("artifact store unavailable")
    });

    await expect(consumeSqsCrawlBatch(harness.input())).resolves.toEqual({
      received: 1,
      handled: 1,
      succeeded: 0,
      failed: 1,
      invalid: 0,
      deleted: 0,
      skipped: 0,
      canceled: 0,
      backoffApplied: 0
    });

    expect(harness.deleteCommands).toEqual([]);
    expect(harness.events).toEqual([
      "resolve:crawl-1",
      "running:crawl-1",
      "fetch:https://example.com/robots.txt",
      "fetch:https://example.com/",
      "artifact:crawl-1",
      "failed:crawl-1:artifact store unavailable"
    ]);
  });

  it("applies deterministic backoff by changing visibility for failed messages", async () => {
    const harness = createHarness({
      messages: [
        sqsMessage({
          body: crawlMessage(crawlPayload()),
          receiptHandle: "receipt-1",
          approximateReceiveCount: 3
        })
      ],
      artifactError: new Error("artifact store unavailable")
    });

    await expect(
      consumeSqsCrawlBatch({
        ...harness.input(),
        retryBackoff: {
          baseVisibilityTimeoutSeconds: 15,
          maxVisibilityTimeoutSeconds: 300,
          multiplier: 2
        }
      })
    ).resolves.toEqual({
      received: 1,
      handled: 1,
      succeeded: 0,
      failed: 1,
      invalid: 0,
      deleted: 0,
      skipped: 0,
      canceled: 0,
      backoffApplied: 1
    });

    expect(harness.changeVisibilityCommands[0]?.input).toEqual({
      QueueUrl: "https://sqs.us-east-1.amazonaws.com/123/searchlint-crawl",
      ReceiptHandle: "receipt-1",
      VisibilityTimeout: 60
    });
    expect(harness.deleteCommands).toEqual([]);
  });

  it("deletes canceled crawl jobs without executing them", async () => {
    const harness = createHarness({
      messages: [
        sqsMessage({
          body: crawlMessage(crawlPayload("crawl-canceled")),
          receiptHandle: "receipt-canceled"
        })
      ]
    });

    await expect(
      consumeSqsCrawlBatch({
        ...harness.input(),
        isCrawlCanceled(payload) {
          return payload.crawlRequestId === "crawl-canceled";
        }
      })
    ).resolves.toEqual({
      received: 1,
      handled: 1,
      succeeded: 0,
      failed: 0,
      invalid: 0,
      deleted: 1,
      skipped: 0,
      canceled: 1,
      backoffApplied: 0
    });

    expect(harness.events).toEqual([]);
    expect(harness.deleteCommands[0]?.input).toEqual({
      QueueUrl: "https://sqs.us-east-1.amazonaws.com/123/searchlint-crawl",
      ReceiptHandle: "receipt-canceled"
    });
  });

  it("deletes invalid message bodies after counting them invalid", async () => {
    const harness = createHarness({
      messages: [
        sqsMessage({
          body: '{"type":"not-crawl"}',
          receiptHandle: "receipt-1"
        })
      ]
    });

    await expect(consumeSqsCrawlBatch(harness.input())).resolves.toEqual({
      received: 1,
      handled: 0,
      succeeded: 0,
      failed: 0,
      invalid: 1,
      deleted: 1,
      skipped: 0,
      canceled: 0,
      backoffApplied: 0
    });
    expect(harness.events).toEqual([]);
    expect(harness.deleteCommands[0]?.input.ReceiptHandle).toBe("receipt-1");
  });

  it("skips messages without receipt handles", async () => {
    const harness = createHarness({
      messages: [
        sqsMessage({
          body: crawlMessage(crawlPayload())
        })
      ]
    });

    await expect(consumeSqsCrawlBatch(harness.input())).resolves.toEqual({
      received: 1,
      handled: 0,
      succeeded: 0,
      failed: 0,
      invalid: 0,
      deleted: 0,
      skipped: 1,
      canceled: 0,
      backoffApplied: 0
    });
    expect(harness.commands).toHaveLength(1);
    expect(harness.events).toEqual([]);
  });

  it("processes crawler messages with bounded batch concurrency", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const harness = createHarness({
      messages: [
        sqsMessage({
          body: crawlMessage(crawlPayload("crawl-1")),
          receiptHandle: "receipt-1"
        }),
        sqsMessage({
          body: crawlMessage(crawlPayload("crawl-2")),
          receiptHandle: "receipt-2"
        }),
        sqsMessage({
          body: crawlMessage(crawlPayload("crawl-3")),
          receiptHandle: "receipt-3"
        })
      ],
      async onResolve() {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await Promise.resolve();
        inFlight -= 1;
      }
    });

    await expect(
      consumeSqsCrawlBatch({
        ...harness.input(),
        concurrency: 2
      })
    ).resolves.toEqual({
      received: 3,
      handled: 3,
      succeeded: 3,
      failed: 0,
      invalid: 0,
      deleted: 3,
      skipped: 0,
      canceled: 0,
      backoffApplied: 0
    });

    expect(maxInFlight).toBe(2);
    expect(harness.deleteCommands.map((command) => command.input)).toEqual(
      expect.arrayContaining([
        {
          QueueUrl: "https://sqs.us-east-1.amazonaws.com/123/searchlint-crawl",
          ReceiptHandle: "receipt-1"
        },
        {
          QueueUrl: "https://sqs.us-east-1.amazonaws.com/123/searchlint-crawl",
          ReceiptHandle: "receipt-2"
        },
        {
          QueueUrl: "https://sqs.us-east-1.amazonaws.com/123/searchlint-crawl",
          ReceiptHandle: "receipt-3"
        }
      ])
    );
  });

  it("calculates bounded retry backoff visibility timeouts", () => {
    const policy = {
      baseVisibilityTimeoutSeconds: 10,
      maxVisibilityTimeoutSeconds: 90,
      multiplier: 2
    };

    expect(
      sqsCrawlerBackoffVisibilityTimeoutSeconds({
        approximateReceiveCount: 1,
        policy
      })
    ).toBe(10);
    expect(
      sqsCrawlerBackoffVisibilityTimeoutSeconds({
        approximateReceiveCount: 4,
        policy
      })
    ).toBe(80);
    expect(
      sqsCrawlerBackoffVisibilityTimeoutSeconds({
        approximateReceiveCount: 5,
        policy
      })
    ).toBe(90);
  });

  it("rejects invalid receive options before contacting SQS", async () => {
    const harness = createHarness();

    await expect(
      consumeSqsCrawlBatch({
        ...harness.input(),
        maxMessages: 11
      })
    ).rejects.toThrow(
      "SQS crawler maxMessages must be an integer from 1 to 10."
    );
    expect(harness.commands).toEqual([]);

    await expect(
      consumeSqsCrawlBatch({
        ...harness.input(),
        concurrency: 6
      })
    ).rejects.toThrow(
      "SQS crawler concurrency must be an integer from 1 to maxMessages."
    );
    expect(harness.commands).toEqual([]);
  });
});

function createHarness(
  options: {
    messages?: readonly Message[];
    artifactError?: Error;
    onResolve?: (payload: CrawlJobPayload) => Promise<void>;
  } = {}
) {
  const commands: Array<
    | ReceiveMessageCommand
    | DeleteMessageCommand
    | ChangeMessageVisibilityCommand
  > = [];
  const events: string[] = [];
  const receiveCommands: ReceiveMessageCommand[] = [];
  const deleteCommands: DeleteMessageCommand[] = [];
  const changeVisibilityCommands: ChangeMessageVisibilityCommand[] = [];
  const client: SqsCrawlerClient = {
    async send(command) {
      if (command instanceof ReceiveMessageCommand) {
        commands.push(command);
        receiveCommands.push(command);
        return {
          Messages: [...(options.messages ?? [])],
          $metadata: {}
        } satisfies ReceiveMessageCommandOutput;
      }
      if (command instanceof DeleteMessageCommand) {
        commands.push(command);
        deleteCommands.push(command);
        return {
          $metadata: {}
        } satisfies DeleteMessageCommandOutput;
      }
      if (command instanceof ChangeMessageVisibilityCommand) {
        commands.push(command);
        changeVisibilityCommands.push(command);
        return {
          $metadata: {}
        } satisfies ChangeMessageVisibilityCommandOutput;
      }
      throw new Error("Unexpected SQS command.");
    }
  };
  const targetResolver: CloudCrawlTargetResolver = {
    async resolveCrawlTarget(payload) {
      events.push(`resolve:${payload.crawlRequestId}`);
      await options.onResolve?.(payload);
      return {
        startUrl: "https://example.com/",
        sameOrigin: true
      };
    }
  };
  const fetcher: CrawlerFetcher = {
    async fetch(url): Promise<CrawlResponse> {
      events.push(`fetch:${url}`);
      if (url === "https://example.com/robots.txt") {
        return {
          url,
          statusCode: 404,
          headers: {
            "content-type": "text/plain"
          },
          body: ""
        };
      }
      return {
        url,
        statusCode: 200,
        headers: {
          "content-type": "text/html"
        },
        body: "<html></html>"
      };
    }
  };
  const store: CloudCrawlJobStore = {
    async markRunning(input) {
      events.push(`running:${input.payload.crawlRequestId}`);
    },
    async markSucceeded(input) {
      events.push(`succeeded:${input.payload.crawlRequestId}`);
    },
    async markFailed(input) {
      events.push(
        `failed:${input.payload.crawlRequestId}:${input.errorMessage}`
      );
    }
  };
  const artifactStore: CloudCrawlArtifactStore = {
    async putCrawlResult(input) {
      events.push(`artifact:${input.payload.crawlRequestId}`);
      if (options.artifactError) {
        throw options.artifactError;
      }
      return {
        artifactUri: "s3://searchlint-artifacts/crawls/crawl-1/result.json"
      };
    }
  };
  const clock: CloudCrawlerExecutionClock = {
    now() {
      return "2026-06-21T00:00:00.000Z";
    }
  };

  return {
    commands,
    receiveCommands,
    deleteCommands,
    changeVisibilityCommands,
    events,
    input() {
      return {
        client,
        queueUrl: " https://sqs.us-east-1.amazonaws.com/123/searchlint-crawl ",
        maxMessages: 5,
        waitTimeSeconds: 10,
        visibilityTimeoutSeconds: 30,
        targetResolver,
        fetcher,
        store,
        artifactStore,
        clock
      };
    }
  };
}

function sqsMessage(input: {
  body: string;
  receiptHandle?: string;
  approximateReceiveCount?: number;
}): Message {
  return {
    MessageId: "message-1",
    Body: input.body,
    Attributes:
      input.approximateReceiveCount === undefined
        ? undefined
        : {
            ApproximateReceiveCount: String(input.approximateReceiveCount)
          },
    ...(input.receiptHandle === undefined
      ? {}
      : { ReceiptHandle: input.receiptHandle })
  };
}

function crawlMessage(payload: CrawlJobPayload): string {
  return JSON.stringify({
    schemaVersion: 1,
    type: "crawl.requested",
    payload
  });
}

function crawlPayload(crawlRequestId = "crawl-1"): CrawlJobPayload {
  return {
    crawlRequestId,
    organizationId: "org-1",
    projectId: "project-1",
    environmentId: "env-1",
    maxUrls: 5
  };
}
