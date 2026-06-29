import {
  ChangeMessageVisibilityCommand,
  DeleteMessageCommand,
  ReceiveMessageCommand,
  type DeleteMessageCommandOutput,
  type Message,
  type ReceiveMessageCommandOutput,
  type SQSClient
} from "@aws-sdk/client-sqs";
import type { CrawlJobPayload } from "@searchlint/api";

import {
  executeCrawlRequestedJob,
  type CloudCrawlArtifactStore,
  type CloudCrawlDiagnosticAnalyzer,
  type CloudCrawlDiagnosticIngestionStore,
  type CloudCrawlJobStore,
  type CloudCrawlTargetResolver,
  type CloudCrawlerExecutionClock
} from "./crawler-execution-worker.js";
import type { CrawlerFetcher } from "@searchlint/crawler";

export type SqsCrawlerClient = Pick<SQSClient, "send">;

export type SqsCrawlerConsumerOptions = {
  client: SqsCrawlerClient;
  queueUrl: string;
  maxMessages: number;
  concurrency?: number;
  waitTimeSeconds?: number;
  visibilityTimeoutSeconds?: number;
  targetResolver: CloudCrawlTargetResolver;
  fetcher: CrawlerFetcher;
  store: CloudCrawlJobStore;
  artifactStore?: CloudCrawlArtifactStore;
  diagnosticAnalyzer?: CloudCrawlDiagnosticAnalyzer;
  diagnosticStore?: CloudCrawlDiagnosticIngestionStore;
  clock: CloudCrawlerExecutionClock;
  retryBackoff?: SqsCrawlerRetryBackoffPolicy;
  isCrawlCanceled?: (payload: CrawlJobPayload) => Promise<boolean> | boolean;
};

export type SqsCrawlBatchResult = {
  received: number;
  handled: number;
  succeeded: number;
  failed: number;
  invalid: number;
  deleted: number;
  skipped: number;
  canceled: number;
  backoffApplied: number;
};

export type SqsCrawlerRetryBackoffPolicy = {
  baseVisibilityTimeoutSeconds: number;
  maxVisibilityTimeoutSeconds: number;
  multiplier: number;
};

export type SqsCrawlerPollingRuntimeSleep = (
  intervalMs: number,
  signal: AbortSignal
) => Promise<void>;

export type SqsCrawlerPollingRuntimeOptions = SqsCrawlerConsumerOptions & {
  intervalMs: number;
  sleep?: SqsCrawlerPollingRuntimeSleep;
  onBatch?: (result: SqsCrawlBatchResult) => void | Promise<void>;
  onError?: (error: Error) => void | Promise<void>;
  stopOnError?: boolean;
};

export type SqsCrawlerPollingRuntime = {
  start(): void;
  stop(): Promise<void>;
  done(): Promise<void>;
  isRunning(): boolean;
};

type SqsCrawlRequestedMessage = {
  schemaVersion: 1;
  type: "crawl.requested";
  payload: CrawlJobPayload;
};

type ValidSqsCrawlerOptions = Omit<
  SqsCrawlerConsumerOptions,
  "queueUrl" | "maxMessages" | "waitTimeSeconds" | "visibilityTimeoutSeconds"
> & {
  queueUrl: string;
  maxMessages: number;
  concurrency: number;
  waitTimeSeconds?: number;
  visibilityTimeoutSeconds?: number;
};

export async function consumeSqsCrawlBatch(
  options: SqsCrawlerConsumerOptions
): Promise<SqsCrawlBatchResult> {
  const config = validateOptions(options);
  const received = await config.client.send(
    new ReceiveMessageCommand({
      QueueUrl: config.queueUrl,
      MaxNumberOfMessages: config.maxMessages,
      MessageAttributeNames: [
        "searchlintMessageType",
        "organizationId",
        "projectId",
        "environmentId",
        "crawlRequestId"
      ],
      MessageSystemAttributeNames: ["ApproximateReceiveCount"],
      ...(config.waitTimeSeconds === undefined
        ? {}
        : { WaitTimeSeconds: config.waitTimeSeconds }),
      ...(config.visibilityTimeoutSeconds === undefined
        ? {}
        : { VisibilityTimeout: config.visibilityTimeoutSeconds })
    })
  );

  const messages = received.Messages ?? [];
  const result: SqsCrawlBatchResult = {
    received: messages.length,
    handled: 0,
    succeeded: 0,
    failed: 0,
    invalid: 0,
    deleted: 0,
    skipped: 0,
    canceled: 0,
    backoffApplied: 0
  };

  await runWithConcurrency(messages, config.concurrency, async (message) => {
    const receiptHandle = message.ReceiptHandle;
    if (!receiptHandle) {
      result.skipped += 1;
      return;
    }

    const parsed = parseCrawlRequestedMessage(message);
    if (!parsed.valid) {
      result.invalid += 1;
      await deleteMessage(config, receiptHandle);
      result.deleted += 1;
      return;
    }

    result.handled += 1;
    if (await config.isCrawlCanceled?.(parsed.message.payload)) {
      result.canceled += 1;
      await deleteMessage(config, receiptHandle);
      result.deleted += 1;
      return;
    }

    const summary = await executeCrawlRequestedJob({
      payload: parsed.message.payload,
      targetResolver: config.targetResolver,
      fetcher: config.fetcher,
      store: config.store,
      ...(config.artifactStore === undefined
        ? {}
        : { artifactStore: config.artifactStore }),
      ...(config.diagnosticAnalyzer === undefined
        ? {}
        : { diagnosticAnalyzer: config.diagnosticAnalyzer }),
      ...(config.diagnosticStore === undefined
        ? {}
        : { diagnosticStore: config.diagnosticStore }),
      clock: config.clock
    });

    if (summary.status === "failed") {
      result.failed += 1;
      if (config.retryBackoff) {
        await changeMessageVisibility(config, receiptHandle, message);
        result.backoffApplied += 1;
      }
      return;
    }

    result.succeeded += 1;
    await deleteMessage(config, receiptHandle);
    result.deleted += 1;
  });

  return result;
}

export function sqsCrawlerBackoffVisibilityTimeoutSeconds(input: {
  approximateReceiveCount: number;
  policy: SqsCrawlerRetryBackoffPolicy;
}): number {
  validateBackoffPolicy(input.policy);
  if (
    !Number.isInteger(input.approximateReceiveCount) ||
    input.approximateReceiveCount < 1
  ) {
    throw new Error("SQS crawler approximate receive count must be positive.");
  }
  const exponent = input.approximateReceiveCount - 1;
  const raw =
    input.policy.baseVisibilityTimeoutSeconds *
    input.policy.multiplier ** exponent;
  return Math.min(input.policy.maxVisibilityTimeoutSeconds, Math.ceil(raw));
}

export function createSqsCrawlerPollingRuntime(
  options: SqsCrawlerPollingRuntimeOptions
): SqsCrawlerPollingRuntime {
  if (!Number.isInteger(options.intervalMs) || options.intervalMs < 1) {
    throw new Error("SQS crawler polling interval must be a positive integer.");
  }

  const sleep = options.sleep ?? defaultSleep;
  let running = false;
  let stopRequested = false;
  let controller: AbortController | undefined;
  let donePromise: Promise<void> = Promise.resolve();

  async function runLoop(signal: AbortSignal): Promise<void> {
    while (!stopRequested && !signal.aborted) {
      try {
        const result = await consumeSqsCrawlBatch(options);
        await options.onBatch?.(result);
      } catch (error) {
        const normalized = asError(error);
        await options.onError?.(normalized);
        if (options.stopOnError === true) {
          throw normalized;
        }
      }

      if (!stopRequested && !signal.aborted) {
        await sleep(options.intervalMs, signal);
      }
    }
  }

  return {
    start() {
      if (running) {
        throw new Error("SQS crawler polling runtime is already running.");
      }
      stopRequested = false;
      running = true;
      controller = new AbortController();
      donePromise = runLoop(controller.signal).finally(() => {
        running = false;
        controller = undefined;
      });
    },
    async stop() {
      stopRequested = true;
      controller?.abort();
      await donePromise;
    },
    done() {
      return donePromise;
    },
    isRunning() {
      return running;
    }
  };
}

async function deleteMessage(
  config: ValidSqsCrawlerOptions,
  receiptHandle: string
): Promise<void> {
  await config.client.send(
    new DeleteMessageCommand({
      QueueUrl: config.queueUrl,
      ReceiptHandle: receiptHandle
    })
  );
}

async function changeMessageVisibility(
  config: ValidSqsCrawlerOptions,
  receiptHandle: string,
  message: Message
): Promise<void> {
  if (!config.retryBackoff) {
    return;
  }
  await config.client.send(
    new ChangeMessageVisibilityCommand({
      QueueUrl: config.queueUrl,
      ReceiptHandle: receiptHandle,
      VisibilityTimeout: sqsCrawlerBackoffVisibilityTimeoutSeconds({
        approximateReceiveCount: approximateReceiveCount(message),
        policy: config.retryBackoff
      })
    })
  );
}

function approximateReceiveCount(message: Message): number {
  const raw =
    message.Attributes?.ApproximateReceiveCount ??
    message.MessageAttributes?.ApproximateReceiveCount?.StringValue;
  const parsed = raw === undefined ? 1 : Number.parseInt(raw, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function parseCrawlRequestedMessage(
  message: Message
): { valid: true; message: SqsCrawlRequestedMessage } | { valid: false } {
  if (!message.Body) {
    return { valid: false };
  }

  try {
    const parsed = JSON.parse(message.Body) as unknown;
    if (!isSqsCrawlRequestedMessage(parsed)) {
      return { valid: false };
    }
    return {
      valid: true,
      message: parsed
    };
  } catch {
    return { valid: false };
  }
}

function isSqsCrawlRequestedMessage(
  value: unknown
): value is SqsCrawlRequestedMessage {
  if (!isRecord(value)) {
    return false;
  }
  return (
    value.schemaVersion === 1 &&
    value.type === "crawl.requested" &&
    isCrawlJobPayload(value.payload)
  );
}

function isCrawlJobPayload(value: unknown): value is CrawlJobPayload {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.crawlRequestId === "string" &&
    typeof value.organizationId === "string" &&
    typeof value.projectId === "string" &&
    typeof value.environmentId === "string" &&
    Number.isInteger(value.maxUrls)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function validateOptions(
  options: SqsCrawlerConsumerOptions
): ValidSqsCrawlerOptions {
  const queueUrl = options.queueUrl.trim();
  if (queueUrl.length === 0) {
    throw new Error("SQS crawler queue URL is required.");
  }
  if (
    !Number.isInteger(options.maxMessages) ||
    options.maxMessages < 1 ||
    options.maxMessages > 10
  ) {
    throw new Error("SQS crawler maxMessages must be an integer from 1 to 10.");
  }
  const concurrency = options.concurrency ?? 1;
  if (
    !Number.isInteger(concurrency) ||
    concurrency < 1 ||
    concurrency > options.maxMessages
  ) {
    throw new Error(
      "SQS crawler concurrency must be an integer from 1 to maxMessages."
    );
  }
  if (
    options.waitTimeSeconds !== undefined &&
    (!Number.isInteger(options.waitTimeSeconds) ||
      options.waitTimeSeconds < 0 ||
      options.waitTimeSeconds > 20)
  ) {
    throw new Error(
      "SQS crawler waitTimeSeconds must be an integer from 0 to 20."
    );
  }
  if (
    options.visibilityTimeoutSeconds !== undefined &&
    (!Number.isInteger(options.visibilityTimeoutSeconds) ||
      options.visibilityTimeoutSeconds < 0)
  ) {
    throw new Error(
      "SQS crawler visibilityTimeoutSeconds must be a non-negative integer."
    );
  }
  if (options.retryBackoff !== undefined) {
    validateBackoffPolicy(options.retryBackoff);
  }

  return {
    ...options,
    queueUrl,
    maxMessages: options.maxMessages,
    concurrency
  };
}

function validateBackoffPolicy(policy: SqsCrawlerRetryBackoffPolicy): void {
  if (
    !Number.isInteger(policy.baseVisibilityTimeoutSeconds) ||
    policy.baseVisibilityTimeoutSeconds < 1
  ) {
    throw new Error(
      "SQS crawler backoff baseVisibilityTimeoutSeconds must be a positive integer."
    );
  }
  if (
    !Number.isInteger(policy.maxVisibilityTimeoutSeconds) ||
    policy.maxVisibilityTimeoutSeconds < policy.baseVisibilityTimeoutSeconds
  ) {
    throw new Error(
      "SQS crawler backoff maxVisibilityTimeoutSeconds must be at least the base timeout."
    );
  }
  if (!Number.isFinite(policy.multiplier) || policy.multiplier < 1) {
    throw new Error("SQS crawler backoff multiplier must be at least 1.");
  }
}

async function runWithConcurrency<T>(
  items: readonly T[],
  concurrency: number,
  handler: (item: T) => Promise<void>
): Promise<void> {
  let nextIndex = 0;
  const workerCount = Math.min(concurrency, items.length);
  const workers = Array.from({ length: workerCount }, async () => {
    while (nextIndex < items.length) {
      const item = items[nextIndex];
      nextIndex += 1;
      if (item !== undefined) {
        await handler(item);
      }
    }
  });
  await Promise.all(workers);
}

function asError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  return new Error(String(error));
}

function defaultSleep(intervalMs: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const timeout = setTimeout(resolve, intervalMs);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timeout);
        resolve();
      },
      {
        once: true
      }
    );
  });
}
