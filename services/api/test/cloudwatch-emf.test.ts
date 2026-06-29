import { describe, expect, it } from "vitest";

import {
  createCloudWatchEmfRecord,
  createCloudWatchEmfRecords,
  nodeHttpProductionLogRecord
} from "../src/index.js";

describe("createCloudWatchEmfRecord", () => {
  it("maps API request records to CloudWatch EMF metrics", () => {
    const record = nodeHttpProductionLogRecord(
      {
        requestId: "request-1",
        method: "GET",
        path: "/v1/projects",
        status: 503,
        durationMs: 125,
        rateLimited: true,
        timedOut: false
      },
      {
        clock: fixedClock()
      }
    );

    expect(
      createCloudWatchEmfRecord(record, {
        environment: "production"
      })
    ).toEqual({
      _aws: {
        Timestamp: 1782000000000,
        CloudWatchMetrics: [
          {
            Namespace: "SearchLint/Cloud",
            Dimensions: [["ServiceName", "EventName", "Environment"]],
            Metrics: [
              { Name: "ApiRequestCount", Unit: "Count" },
              { Name: "ApiRequestDurationMs", Unit: "Milliseconds" },
              { Name: "ApiRateLimitedRequests", Unit: "Count" },
              { Name: "ApiTimedOutRequests", Unit: "Count" },
              { Name: "ApiServerErrors", Unit: "Count" }
            ]
          }
        ]
      },
      ServiceName: "searchlint-cloud-api",
      EventName: "searchlint.api.request",
      Environment: "production",
      ApiRequestCount: 1,
      ApiRequestDurationMs: 125,
      ApiRateLimitedRequests: 1,
      ApiTimedOutRequests: 0,
      ApiServerErrors: 1
    });
  });

  it("maps worker lifecycle records to CloudWatch EMF metrics", () => {
    expect(
      createCloudWatchEmfRecord(
        {
          timestamp: "2026-06-21T00:00:00.000Z",
          serviceName: "searchlint-cloud-worker",
          eventName: "searchlint.worker.lifecycle",
          attributes: {
            "searchlint.worker.kind": "outbox-poller",
            "searchlint.worker.event_kind": "lifecycle",
            "searchlint.worker.lifecycle_state": "ready"
          }
        },
        {
          environment: "staging"
        }
      )
    ).toMatchObject({
      ServiceName: "searchlint-cloud-worker",
      EventName: "searchlint.worker.lifecycle",
      Environment: "staging",
      WorkerLifecycleEvents: 1
    });
  });

  it("maps worker outbox and crawler counters to CloudWatch EMF metrics", () => {
    expect(
      createCloudWatchEmfRecords(
        [
          {
            timestamp: "2026-06-21T00:00:00.000Z",
            serviceName: "searchlint-cloud-worker",
            eventName: "searchlint.worker.outbox_batch",
            attributes: {
              "searchlint.worker.kind": "outbox-poller",
              "searchlint.worker.event_kind": "batch",
              "searchlint.outbox.selected": 3,
              "searchlint.outbox.leased": 3,
              "searchlint.outbox.published": 2,
              "searchlint.outbox.failed": 1,
              "searchlint.outbox.skipped": 0
            }
          },
          {
            timestamp: "2026-06-21T00:00:00.000Z",
            serviceName: "searchlint-cloud-worker",
            eventName: "searchlint.worker.crawler_batch",
            attributes: {
              "searchlint.worker.kind": "sqs-crawler-poller",
              "searchlint.worker.event_kind": "crawler-batch",
              "searchlint.crawler.received": 5,
              "searchlint.crawler.handled": 5,
              "searchlint.crawler.succeeded": 4,
              "searchlint.crawler.failed": 1,
              "searchlint.crawler.invalid": 0,
              "searchlint.crawler.deleted": 4,
              "searchlint.crawler.skipped": 0
            }
          }
        ],
        {
          environment: "production"
        }
      )
    ).toEqual([
      expect.objectContaining({
        OutboxPublished: 2,
        OutboxFailed: 1,
        OutboxSkipped: 0
      }),
      expect.objectContaining({
        CrawlerSucceeded: 4,
        CrawlerFailed: 1,
        CrawlerInvalid: 0,
        CrawlerDeleted: 4,
        CrawlerSkipped: 0
      })
    ]);
  });

  it("maps worker error records to one-count error metrics", () => {
    expect(
      createCloudWatchEmfRecord(
        {
          timestamp: "2026-06-21T00:00:00.000Z",
          serviceName: "searchlint-cloud-worker",
          eventName: "searchlint.worker.error",
          attributes: {
            "searchlint.worker.kind": "outbox-poller",
            "searchlint.worker.event_kind": "error",
            "error.message": "database unavailable"
          }
        },
        {
          environment: "production"
        }
      )
    ).toMatchObject({
      WorkerErrors: 1
    });
  });

  it("returns undefined for unsupported events instead of inventing metrics", () => {
    expect(
      createCloudWatchEmfRecord(
        {
          timestamp: "2026-06-21T00:00:00.000Z",
          serviceName: "searchlint-cloud-api",
          eventName: "searchlint.api.unknown",
          attributes: {}
        },
        {
          environment: "production"
        }
      )
    ).toBeUndefined();
  });
});

function fixedClock(): { now(): string } {
  return {
    now() {
      return "2026-06-21T00:00:00.000Z";
    }
  };
}
