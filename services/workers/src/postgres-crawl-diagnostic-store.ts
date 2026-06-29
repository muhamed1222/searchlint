import {
  createPostgresDiagnosticStore,
  type DiagnosticRecord,
  type PostgresQueryExecutor
} from "@searchlint/api";
import { randomUUID } from "node:crypto";

import type { CloudCrawlDiagnosticIngestionStore } from "./crawler-execution-worker.js";

export type CloudCrawlDiagnosticStoreClock = {
  now(): string;
};

export type CloudCrawlDiagnosticStoreIds = {
  nextId(prefix: "diagnostic"): string;
};

export type PostgresCloudCrawlDiagnosticStoreOptions = {
  executor: PostgresQueryExecutor;
  clock: CloudCrawlDiagnosticStoreClock;
  ids?: CloudCrawlDiagnosticStoreIds;
};

export function createPostgresCloudCrawlDiagnosticStore(
  options: PostgresCloudCrawlDiagnosticStoreOptions
): CloudCrawlDiagnosticIngestionStore {
  const store = createPostgresDiagnosticStore(options.executor);
  const ids = options.ids ?? cryptoIds();

  return {
    async recordCrawlDiagnostics(input) {
      const createdAt = options.clock.now();
      for (const diagnostic of input.diagnostics) {
        await store.upsertDiagnostic({
          id: ids.nextId("diagnostic"),
          organizationId: input.payload.organizationId,
          projectId: input.payload.projectId,
          environmentId: input.payload.environmentId,
          crawlRequestId: input.payload.crawlRequestId,
          ruleId: diagnostic.ruleId,
          severity: diagnostic.severity,
          confidence: diagnostic.confidence,
          pageUrl: diagnostic.pageUrl,
          ...(diagnostic.route === undefined
            ? {}
            : { route: diagnostic.route }),
          source: diagnostic.source,
          title: diagnostic.title,
          evidence: diagnostic.evidence,
          ...(diagnostic.expected === undefined
            ? {}
            : { expected: diagnostic.expected }),
          ...(diagnostic.actual === undefined
            ? {}
            : { actual: diagnostic.actual }),
          ...(diagnostic.sourceLocation === undefined
            ? {}
            : { sourceLocation: diagnostic.sourceLocation }),
          ...(diagnostic.structuredEvidence === undefined
            ? {}
            : { structuredEvidence: diagnostic.structuredEvidence }),
          observedAt: diagnostic.observedAt,
          fingerprint: diagnostic.fingerprint,
          deletionState: "active",
          createdAt
        } satisfies DiagnosticRecord);
      }
    }
  };
}

function cryptoIds(): CloudCrawlDiagnosticStoreIds {
  return {
    nextId(prefix) {
      return `${prefix}-${randomUUID()}`;
    }
  };
}
