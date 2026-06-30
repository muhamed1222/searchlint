import {
  selectDashboardCrawlRunsSql,
  type CrawlRequest
} from "@searchlint/api";
import type { PostgresQueryExecutor } from "@searchlint/api";

export type CrawlJobHistoryInput = {
  organizationId: string;
  projectId: string;
  environmentId: string;
  limit: number;
};

export type CrawlJobHistoryStore = {
  list(input: CrawlJobHistoryInput): Promise<readonly CrawlRequest[]>;
};

export type CrawlJobHistorySummary = {
  total: number;
  queued: number;
  running: number;
  succeeded: number;
  failed: number;
  cancelled: number;
  withArtifacts: number;
  withErrors: number;
  latestTransitionAt?: string;
};

export function createPostgresCrawlJobHistoryStore(
  executor: PostgresQueryExecutor
): CrawlJobHistoryStore {
  return {
    async list(input) {
      validateHistoryInput(input);
      const result = await executor.query(
        selectDashboardCrawlRunsSql({
          organizationId: input.organizationId,
          projectId: input.projectId,
          environmentId: input.environmentId,
          limit: input.limit
        })
      );
      return result.rows.map(crawlRequestFromHistoryRow);
    }
  };
}

export function summarizeCrawlJobHistory(
  jobs: readonly CrawlRequest[]
): CrawlJobHistorySummary {
  const summary: CrawlJobHistorySummary = {
    total: jobs.length,
    queued: 0,
    running: 0,
    succeeded: 0,
    failed: 0,
    cancelled: 0,
    withArtifacts: 0,
    withErrors: 0
  };
  let latestTransitionAt: string | undefined;

  for (const job of jobs) {
    summary[job.status] += 1;
    if (job.artifactUri !== undefined) {
      summary.withArtifacts += 1;
    }
    if (job.lastError !== undefined) {
      summary.withErrors += 1;
    }
    const transitionAt =
      job.failedAt ?? job.completedAt ?? job.startedAt ?? job.createdAt;
    if (latestTransitionAt === undefined || transitionAt > latestTransitionAt) {
      latestTransitionAt = transitionAt;
    }
  }

  if (latestTransitionAt !== undefined) {
    summary.latestTransitionAt = latestTransitionAt;
  }
  return summary;
}

function validateHistoryInput(input: CrawlJobHistoryInput): void {
  for (const field of [
    "organizationId",
    "projectId",
    "environmentId"
  ] as const) {
    if (input[field].trim().length === 0) {
      throw new Error(`Crawl job history ${field} is required.`);
    }
  }
  if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 100) {
    throw new Error(
      "Crawl job history limit must be an integer from 1 to 100."
    );
  }
}

function crawlRequestFromHistoryRow(
  row: Record<string, unknown>
): CrawlRequest {
  const request: CrawlRequest = {
    id: text(row, "id"),
    organizationId: text(row, "organization_id"),
    projectId: text(row, "project_id"),
    environmentId: text(row, "environment_id"),
    requestedBy: text(row, "requested_by"),
    maxUrls: integer(row, "max_urls"),
    status: crawlStatus(row, "status"),
    createdAt: text(row, "created_at")
  };
  const startedAt = optionalText(row, "started_at");
  const completedAt = optionalText(row, "completed_at");
  const failedAt = optionalText(row, "failed_at");
  const lastError = optionalText(row, "last_error");
  const artifactUri = optionalText(row, "artifact_uri");
  if (startedAt !== undefined) {
    request.startedAt = startedAt;
  }
  if (completedAt !== undefined) {
    request.completedAt = completedAt;
  }
  if (failedAt !== undefined) {
    request.failedAt = failedAt;
  }
  if (lastError !== undefined) {
    request.lastError = lastError;
  }
  if (artifactUri !== undefined) {
    request.artifactUri = artifactUri;
  }
  return request;
}

function text(row: Record<string, unknown>, field: string): string {
  const value = row[field];
  if (typeof value !== "string") {
    throw new Error(`Expected crawl job history ${field} to be a string.`);
  }
  return value;
}

function optionalText(
  row: Record<string, unknown>,
  field: string
): string | undefined {
  const value = row[field];
  if (value === null || value === undefined) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new Error(`Expected crawl job history ${field} to be a string.`);
  }
  return value;
}

function integer(row: Record<string, unknown>, field: string): number {
  const value = row[field];
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error(`Expected crawl job history ${field} to be an integer.`);
  }
  return value;
}

function crawlStatus(
  row: Record<string, unknown>,
  field: string
): CrawlRequest["status"] {
  const value = text(row, field);
  if (
    value !== "queued" &&
    value !== "running" &&
    value !== "succeeded" &&
    value !== "failed" &&
    value !== "cancelled"
  ) {
    throw new Error(`Unknown crawl job history status: ${value}.`);
  }
  return value;
}
