import {
  markCrawlRequestFailedSql,
  markCrawlRequestRunningSql,
  markCrawlRequestSucceededSql,
  selectEnvironmentSql
} from "@searchlint/api";
import type { PostgresQueryExecutor } from "@searchlint/api";

import type {
  CloudCrawlJobStore,
  CloudCrawlTarget,
  CloudCrawlTargetResolver
} from "./crawler-execution-worker.js";

export function createPostgresCloudCrawlTargetResolver(
  executor: PostgresQueryExecutor
): CloudCrawlTargetResolver {
  return {
    async resolveCrawlTarget(payload) {
      const result = await executor.query(
        selectEnvironmentSql(payload.organizationId, payload.environmentId)
      );
      const row = result.rows[0];
      if (!row) {
        return undefined;
      }

      const projectId = text(row, "project_id");
      if (projectId !== payload.projectId) {
        throw new Error(
          `Crawl target environment ${payload.environmentId} belongs to project ${projectId}, expected ${payload.projectId}.`
        );
      }

      return {
        startUrl: text(row, "base_url")
      };
    }
  };
}

export function createPostgresCloudCrawlJobStore(
  executor: PostgresQueryExecutor
): CloudCrawlJobStore {
  return {
    async markRunning(input) {
      await requireUpdatedRow(
        executor.query(
          markCrawlRequestRunningSql({
            organizationId: input.payload.organizationId,
            id: input.payload.crawlRequestId,
            startedAt: input.startedAt
          })
        ),
        "markRunning",
        input.payload.crawlRequestId
      );
    },
    async markSucceeded(input) {
      await requireUpdatedRow(
        executor.query(
          markCrawlRequestSucceededSql({
            organizationId: input.payload.organizationId,
            id: input.payload.crawlRequestId,
            completedAt: input.completedAt,
            ...(input.artifactUri === undefined
              ? {}
              : { artifactUri: input.artifactUri })
          })
        ),
        "markSucceeded",
        input.payload.crawlRequestId
      );
    },
    async markFailed(input) {
      await requireUpdatedRow(
        executor.query(
          markCrawlRequestFailedSql({
            organizationId: input.payload.organizationId,
            id: input.payload.crawlRequestId,
            failedAt: input.failedAt,
            lastError: input.errorMessage
          })
        ),
        "markFailed",
        input.payload.crawlRequestId
      );
    }
  };
}

async function requireUpdatedRow(
  result: Promise<{ rows: readonly Record<string, unknown>[] }>,
  operation: string,
  crawlRequestId: string
): Promise<void> {
  const row = (await result).rows[0];
  if (!row) {
    throw new Error(
      `${operation} did not update crawl request ${crawlRequestId}.`
    );
  }
}

function text(row: Record<string, unknown>, field: string): string {
  const value = row[field];
  if (typeof value !== "string") {
    throw new Error(`Expected ${field} to be a string.`);
  }
  return value;
}
