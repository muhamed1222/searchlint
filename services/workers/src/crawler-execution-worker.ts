import { crawlSite } from "@searchlint/crawler";
import type {
  CrawlOptions,
  CrawlResult,
  CrawlerFetcher
} from "@searchlint/crawler";
import type { CrawlJobPayload } from "@searchlint/api";
import type { CrawlDiagnosticIngestionItem } from "@searchlint/api";

export type CloudCrawlTarget = {
  startUrl: string;
  sameOrigin?: boolean;
  respectRobotsTxt?: boolean;
  userAgent?: string;
};

export type CloudCrawlTargetResolver = {
  resolveCrawlTarget(
    payload: CrawlJobPayload
  ): Promise<CloudCrawlTarget | undefined>;
};

export type CloudCrawlJobStore = {
  markRunning(input: {
    payload: CrawlJobPayload;
    startedAt: string;
  }): Promise<void>;
  markSucceeded(input: {
    payload: CrawlJobPayload;
    target: CloudCrawlTarget;
    result: CrawlResult;
    completedAt: string;
    artifactUri?: string;
  }): Promise<void>;
  markFailed(input: {
    payload: CrawlJobPayload;
    errorMessage: string;
    failedAt: string;
  }): Promise<void>;
};

export type CloudCrawlResultArtifact = {
  schemaVersion: 1;
  type: "crawl.result";
  payload: CrawlJobPayload;
  target: CloudCrawlTarget;
  result: CrawlResult;
  completedAt: string;
};

export type CloudCrawlArtifactStore = {
  putCrawlResult(input: CloudCrawlResultArtifact): Promise<{
    artifactUri: string;
    byteSize?: number;
    sha256?: string;
  }>;
};

export type CloudCrawlDiagnosticAnalysisInput = {
  payload: CrawlJobPayload;
  target: CloudCrawlTarget;
  result: CrawlResult;
  observedAt: string;
};

export type CloudCrawlDiagnosticAnalyzer = {
  analyzeCrawlDiagnostics(
    input: CloudCrawlDiagnosticAnalysisInput
  ): Promise<readonly CrawlDiagnosticIngestionItem[]>;
};

export type CloudCrawlDiagnosticIngestionStore = {
  recordCrawlDiagnostics(input: {
    payload: CrawlJobPayload;
    diagnostics: readonly CrawlDiagnosticIngestionItem[];
  }): Promise<void>;
};

export type CloudCrawlerExecutionClock = {
  now(): string;
};

export type CloudCrawlerExecutionStatus =
  | "succeeded"
  | "failed"
  | "target-missing";

export type CloudCrawlerExecutionSummary = {
  crawlRequestId: string;
  status: CloudCrawlerExecutionStatus;
  startedAt?: string;
  completedAt?: string;
  failedAt?: string;
  artifactUri?: string;
  pageCount: number;
  skippedCount: number;
  errorMessage?: string;
};

export type ExecuteCrawlRequestedJobInput = {
  payload: CrawlJobPayload;
  targetResolver: CloudCrawlTargetResolver;
  fetcher: CrawlerFetcher;
  store: CloudCrawlJobStore;
  artifactStore?: CloudCrawlArtifactStore;
  diagnosticAnalyzer?: CloudCrawlDiagnosticAnalyzer;
  diagnosticStore?: CloudCrawlDiagnosticIngestionStore;
  clock: CloudCrawlerExecutionClock;
  crawler?: (
    options: CrawlOptions,
    fetcher: CrawlerFetcher
  ) => Promise<CrawlResult>;
};

export async function executeCrawlRequestedJob(
  input: ExecuteCrawlRequestedJobInput
): Promise<CloudCrawlerExecutionSummary> {
  const crawler = input.crawler ?? crawlSite;

  if (!Number.isInteger(input.payload.maxUrls) || input.payload.maxUrls < 1) {
    return failBeforeStart(
      input,
      `Crawl job maxUrls must be a positive integer.`
    );
  }

  const target = await input.targetResolver.resolveCrawlTarget(input.payload);
  if (!target) {
    return failBeforeStart(
      input,
      `Crawl target not found for request ${input.payload.crawlRequestId}.`,
      "target-missing"
    );
  }

  const startedAt = input.clock.now();
  await input.store.markRunning({
    payload: input.payload,
    startedAt
  });

  try {
    const result = await crawler(
      crawlOptions(input.payload, target),
      input.fetcher
    );
    const completedAt = input.clock.now();
    const artifactUri = await putCrawlResultArtifact(input, {
      schemaVersion: 1,
      type: "crawl.result",
      payload: input.payload,
      target,
      result,
      completedAt
    });
    const diagnostics = await analyzeCrawlDiagnostics(input, {
      payload: input.payload,
      target,
      result,
      observedAt: completedAt
    });
    await recordCrawlDiagnostics(input, diagnostics);
    await input.store.markSucceeded({
      payload: input.payload,
      target,
      result,
      completedAt,
      ...(artifactUri === undefined ? {} : { artifactUri })
    });
    return {
      crawlRequestId: input.payload.crawlRequestId,
      status: "succeeded",
      startedAt,
      completedAt,
      ...(artifactUri === undefined ? {} : { artifactUri }),
      pageCount: result.pages.length,
      skippedCount: result.skipped.length
    };
  } catch (error) {
    const failedAt = input.clock.now();
    const message = errorMessage(error);
    await input.store.markFailed({
      payload: input.payload,
      errorMessage: message,
      failedAt
    });
    return {
      crawlRequestId: input.payload.crawlRequestId,
      status: "failed",
      startedAt,
      failedAt,
      pageCount: 0,
      skippedCount: 0,
      errorMessage: message
    };
  }
}

async function putCrawlResultArtifact(
  input: ExecuteCrawlRequestedJobInput,
  artifact: CloudCrawlResultArtifact
): Promise<string | undefined> {
  if (!input.artifactStore) {
    return undefined;
  }
  const stored = await input.artifactStore.putCrawlResult(artifact);
  return stored.artifactUri;
}

async function analyzeCrawlDiagnostics(
  input: ExecuteCrawlRequestedJobInput,
  analysisInput: CloudCrawlDiagnosticAnalysisInput
): Promise<readonly CrawlDiagnosticIngestionItem[]> {
  if (!input.diagnosticAnalyzer) {
    return [];
  }
  return input.diagnosticAnalyzer.analyzeCrawlDiagnostics(analysisInput);
}

async function recordCrawlDiagnostics(
  input: ExecuteCrawlRequestedJobInput,
  diagnostics: readonly CrawlDiagnosticIngestionItem[]
): Promise<void> {
  if (!input.diagnosticStore) {
    return;
  }
  await input.diagnosticStore.recordCrawlDiagnostics({
    payload: input.payload,
    diagnostics
  });
}

function crawlOptions(
  payload: CrawlJobPayload,
  target: CloudCrawlTarget
): CrawlOptions {
  return {
    startUrl: target.startUrl,
    maxUrls: payload.maxUrls,
    ...(target.sameOrigin === undefined
      ? {}
      : { sameOrigin: target.sameOrigin }),
    ...(target.respectRobotsTxt === undefined
      ? {}
      : { respectRobotsTxt: target.respectRobotsTxt }),
    ...(target.userAgent === undefined ? {} : { userAgent: target.userAgent })
  };
}

async function failBeforeStart(
  input: ExecuteCrawlRequestedJobInput,
  errorMessage: string,
  status: CloudCrawlerExecutionStatus = "failed"
): Promise<CloudCrawlerExecutionSummary> {
  const failedAt = input.clock.now();
  await input.store.markFailed({
    payload: input.payload,
    errorMessage,
    failedAt
  });
  return {
    crawlRequestId: input.payload.crawlRequestId,
    status,
    failedAt,
    pageCount: 0,
    skippedCount: 0,
    errorMessage
  };
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
