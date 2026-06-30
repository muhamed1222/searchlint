import { describe, expect, it } from "vitest";

import {
  createOutboxWorkerProductionLogSink,
  outboxWorkerProductionLogRecord,
  workerLogRecordContainsSecret
} from "../src/index.js";
import type {
  OutboxWorkerProductionLogEvent,
  OutboxWorkerProductionLogWriter
} from "../src/index.js";

describe("outboxWorkerProductionLogRecord", () => {
  it("maps lifecycle events to stable OpenTelemetry-shaped records", () => {
    const record = outboxWorkerProductionLogRecord(
      {
        kind: "lifecycle",
        event: {
          state: "stopped",
          signal: "SIGTERM",
          result: {
            completed: true,
            forced: false,
            wasRunning: true
          }
        }
      },
      {
        clock: fixedClock(),
        serviceName: "custom-worker",
        workerKind: "custom-outbox"
      }
    );

    expect(record).toEqual({
      timestamp: "2026-06-21T00:00:00.000Z",
      severity: "INFO",
      serviceName: "custom-worker",
      eventName: "searchlint.worker.lifecycle",
      body: {
        workerKind: "custom-outbox",
        lifecycleState: "stopped",
        signal: "SIGTERM",
        shutdownCompleted: true,
        shutdownForced: false,
        shutdownWasRunning: true
      },
      attributes: {
        "searchlint.worker.kind": "custom-outbox",
        "searchlint.worker.event_kind": "lifecycle",
        "searchlint.worker.lifecycle_state": "stopped",
        "searchlint.worker.shutdown_signal": "SIGTERM",
        "searchlint.worker.shutdown_completed": true,
        "searchlint.worker.shutdown_forced": false,
        "searchlint.worker.shutdown_was_running": true
      }
    });
  });

  it("maps batch results to outbox counter records", () => {
    const record = outboxWorkerProductionLogRecord(
      {
        kind: "batch",
        result: {
          selected: 4,
          leased: 3,
          published: 2,
          failed: 1,
          skipped: 1
        }
      },
      {
        clock: fixedClock()
      }
    );

    expect(record).toEqual({
      timestamp: "2026-06-21T00:00:00.000Z",
      severity: "WARN",
      serviceName: "searchlint-cloud-worker",
      eventName: "searchlint.worker.outbox_batch",
      body: {
        workerKind: "outbox-poller",
        selected: 4,
        leased: 3,
        published: 2,
        failed: 1,
        skipped: 1
      },
      attributes: {
        "searchlint.worker.kind": "outbox-poller",
        "searchlint.worker.event_kind": "batch",
        "searchlint.outbox.selected": 4,
        "searchlint.outbox.leased": 3,
        "searchlint.outbox.published": 2,
        "searchlint.outbox.failed": 1,
        "searchlint.outbox.skipped": 1
      }
    });
  });

  it("maps crawler batch results to crawler counter records", () => {
    const record = outboxWorkerProductionLogRecord(
      {
        kind: "crawler-batch",
        result: {
          received: 5,
          handled: 4,
          succeeded: 3,
          failed: 1,
          invalid: 1,
          deleted: 4,
          skipped: 0,
          canceled: 1,
          backoffApplied: 1
        }
      },
      {
        clock: fixedClock(),
        workerKind: "sqs-crawler-poller"
      }
    );

    expect(record).toEqual({
      timestamp: "2026-06-21T00:00:00.000Z",
      severity: "WARN",
      serviceName: "searchlint-cloud-worker",
      eventName: "searchlint.worker.crawler_batch",
      body: {
        workerKind: "sqs-crawler-poller",
        received: 5,
        handled: 4,
        succeeded: 3,
        failed: 1,
        invalid: 1,
        deleted: 4,
        skipped: 0,
        canceled: 1,
        backoffApplied: 1
      },
      attributes: {
        "searchlint.worker.kind": "sqs-crawler-poller",
        "searchlint.worker.event_kind": "crawler-batch",
        "searchlint.crawler.received": 5,
        "searchlint.crawler.handled": 4,
        "searchlint.crawler.succeeded": 3,
        "searchlint.crawler.failed": 1,
        "searchlint.crawler.invalid": 1,
        "searchlint.crawler.deleted": 4,
        "searchlint.crawler.skipped": 0,
        "searchlint.crawler.canceled": 1,
        "searchlint.crawler.backoff_applied": 1
      }
    });
  });

  it("maps report artifact cleanup batches to cleanup counter records", () => {
    const record = outboxWorkerProductionLogRecord(
      {
        kind: "report-cleanup-batch",
        result: {
          selected: 4,
          leased: 3,
          deleted: 2,
          failed: 1,
          skipped: 1
        }
      },
      {
        clock: fixedClock(),
        workerKind: "report-artifact-cleanup-poller"
      }
    );

    expect(record).toEqual({
      timestamp: "2026-06-21T00:00:00.000Z",
      severity: "WARN",
      serviceName: "searchlint-cloud-worker",
      eventName: "searchlint.worker.report_artifact_cleanup_batch",
      body: {
        workerKind: "report-artifact-cleanup-poller",
        selected: 4,
        leased: 3,
        deleted: 2,
        failed: 1,
        skipped: 1
      },
      attributes: {
        "searchlint.worker.kind": "report-artifact-cleanup-poller",
        "searchlint.worker.event_kind": "report-cleanup-batch",
        "searchlint.report_artifact_cleanup.selected": 4,
        "searchlint.report_artifact_cleanup.leased": 3,
        "searchlint.report_artifact_cleanup.deleted": 2,
        "searchlint.report_artifact_cleanup.failed": 1,
        "searchlint.report_artifact_cleanup.skipped": 1
      }
    });
  });

  it("maps external observation batches to external observation counter records", () => {
    const record = outboxWorkerProductionLogRecord(
      {
        kind: "external-observation-batch",
        result: {
          selected: 3,
          collected: 2,
          stored: 2,
          failed: 1,
          skipped: 0
        }
      },
      {
        clock: fixedClock(),
        workerKind: "external-observation-collector"
      }
    );

    expect(record).toEqual({
      timestamp: "2026-06-21T00:00:00.000Z",
      severity: "WARN",
      serviceName: "searchlint-cloud-worker",
      eventName: "searchlint.worker.external_observation_batch",
      body: {
        workerKind: "external-observation-collector",
        selected: 3,
        succeeded: 2,
        published: 2,
        failed: 1,
        skipped: 0
      },
      attributes: {
        "searchlint.worker.kind": "external-observation-collector",
        "searchlint.worker.event_kind": "external-observation-batch",
        "searchlint.external_observation.selected": 3,
        "searchlint.external_observation.collected": 2,
        "searchlint.external_observation.stored": 2,
        "searchlint.external_observation.failed": 1,
        "searchlint.external_observation.skipped": 0
      }
    });
  });

  it("maps notification delivery batches to aggregate counter records", () => {
    const record = outboxWorkerProductionLogRecord(
      {
        kind: "notification-delivery-batch",
        result: {
          selected: 4,
          delivered: 2,
          retryScheduled: 1,
          failed: 1,
          attempts: [
            {
              id: "attempt-1",
              taskId: "task-1",
              organizationId: "org-1",
              channelId: "webhook-1",
              channelKind: "webhook",
              status: "retry_scheduled",
              attemptedAt: "2026-06-21T00:00:00.000Z",
              attempt: 1,
              failureReason: "Bearer provider-token",
              nextRetryAt: "2026-06-21T00:05:00.000Z"
            }
          ]
        }
      },
      {
        clock: fixedClock(),
        workerKind: "notification-delivery-worker"
      }
    );

    expect(record).toEqual({
      timestamp: "2026-06-21T00:00:00.000Z",
      severity: "WARN",
      serviceName: "searchlint-cloud-worker",
      eventName: "searchlint.worker.notification_delivery_batch",
      body: {
        workerKind: "notification-delivery-worker",
        selected: 4,
        delivered: 2,
        retryScheduled: 1,
        failed: 1
      },
      attributes: {
        "searchlint.worker.kind": "notification-delivery-worker",
        "searchlint.worker.event_kind": "notification-delivery-batch",
        "searchlint.notification_delivery.selected": 4,
        "searchlint.notification_delivery.delivered": 2,
        "searchlint.notification_delivery.retry_scheduled": 1,
        "searchlint.notification_delivery.failed": 1
      }
    });
    expect(JSON.stringify(record)).not.toContain("provider-token");
    expect(workerLogRecordContainsSecret(record)).toBe(false);
  });

  it("maps runtime errors to error records", () => {
    const record = outboxWorkerProductionLogRecord(
      {
        kind: "error",
        phase: "poll",
        error: new Error("database unavailable")
      },
      {
        clock: fixedClock()
      }
    );

    expect(record).toMatchObject({
      timestamp: "2026-06-21T00:00:00.000Z",
      severity: "ERROR",
      serviceName: "searchlint-cloud-worker",
      eventName: "searchlint.worker.error",
      body: {
        workerKind: "outbox-poller",
        errorMessage: "database unavailable",
        phase: "poll"
      },
      attributes: {
        "searchlint.worker.kind": "outbox-poller",
        "searchlint.worker.event_kind": "error",
        "error.message": "database unavailable",
        "searchlint.worker.phase": "poll"
      }
    });
  });

  it("redacts secret-bearing runtime errors before log records are emitted", () => {
    const record = outboxWorkerProductionLogRecord(
      {
        kind: "error",
        phase: "notification-delivery",
        error: new Error(
          "delivery failed Bearer slack-token xoxb_notification_token whsec_123456 postgres://user:pass@db.example.test:5432/app"
        )
      },
      {
        clock: fixedClock(),
        workerKind: "notification-delivery-worker"
      }
    );

    expect(record.body.errorMessage).toContain("[REDACTED]");
    expect(record.attributes["error.message"]).toContain("[REDACTED]");
    expect(JSON.stringify(record)).not.toContain("slack-token");
    expect(JSON.stringify(record)).not.toContain("xoxb_notification_token");
    expect(JSON.stringify(record)).not.toContain("whsec_123456");
    expect(JSON.stringify(record)).not.toContain("postgres://");
    expect(workerLogRecordContainsSecret(record)).toBe(false);
  });

  it.each([
    {
      event: {
        kind: "lifecycle",
        event: {
          state: "ready"
        }
      },
      severity: "INFO"
    },
    {
      event: {
        kind: "lifecycle",
        event: {
          state: "draining",
          signal: "SIGTERM"
        }
      },
      severity: "WARN"
    },
    {
      event: {
        kind: "lifecycle",
        event: {
          state: "failed",
          error: new Error("shutdown failed")
        }
      },
      severity: "ERROR"
    },
    {
      event: {
        kind: "batch",
        result: {
          selected: 1,
          leased: 1,
          published: 1,
          failed: 0,
          skipped: 0
        }
      },
      severity: "INFO"
    },
    {
      event: {
        kind: "report-cleanup-batch",
        result: {
          selected: 1,
          leased: 1,
          deleted: 1,
          failed: 0,
          skipped: 0
        }
      },
      severity: "INFO"
    },
    {
      event: {
        kind: "external-observation-batch",
        result: {
          selected: 1,
          collected: 1,
          stored: 1,
          failed: 0,
          skipped: 0
        }
      },
      severity: "INFO"
    },
    {
      event: {
        kind: "notification-delivery-batch",
        result: {
          selected: 1,
          delivered: 1,
          retryScheduled: 0,
          failed: 0,
          attempts: []
        }
      },
      severity: "INFO"
    },
    {
      event: {
        kind: "error",
        error: "poll failed"
      },
      severity: "ERROR"
    }
  ] satisfies Array<{
    event: OutboxWorkerProductionLogEvent;
    severity: string;
  }>)(
    "uses $severity severity for $event.kind events",
    ({ event, severity }) => {
      const record = outboxWorkerProductionLogRecord(event, {
        clock: fixedClock()
      });

      expect(record.severity).toBe(severity);
    }
  );
});

describe("createOutboxWorkerProductionLogSink", () => {
  it("writes JSON lines to stdout by default", async () => {
    const stdout = new MemoryWriter();
    const sink = createOutboxWorkerProductionLogSink({
      clock: fixedClock(),
      stdout
    });

    await sink.write({
      kind: "batch",
      result: {
        selected: 0,
        leased: 0,
        published: 0,
        failed: 0,
        skipped: 0
      }
    });

    expect(stdout.lines).toHaveLength(1);
    expect(stdout.lines[0]?.endsWith("\n")).toBe(true);
    expect(JSON.parse(stdout.lines[0] ?? "{}")).toMatchObject({
      timestamp: "2026-06-21T00:00:00.000Z",
      severity: "INFO",
      serviceName: "searchlint-cloud-worker",
      eventName: "searchlint.worker.outbox_batch"
    });
  });

  it("routes error records to stderr when configured", async () => {
    const stdout = new MemoryWriter();
    const stderr = new MemoryWriter();
    const sink = createOutboxWorkerProductionLogSink({
      clock: fixedClock(),
      stdout,
      stderr,
      routeErrorsToStderr: true
    });

    await sink.write({
      kind: "error",
      error: new Error("runtime failed")
    });

    expect(stdout.lines).toEqual([]);
    expect(stderr.lines).toHaveLength(1);
    expect(JSON.parse(stderr.lines[0] ?? "{}")).toMatchObject({
      severity: "ERROR"
    });
  });

  it("isolates writer failures from worker runtime paths", async () => {
    const sink = createOutboxWorkerProductionLogSink({
      clock: fixedClock(),
      stdout: {
        async write() {
          throw new Error("stdout unavailable");
        }
      }
    });

    await expect(
      sink.write({
        kind: "batch",
        result: {
          selected: 0,
          leased: 0,
          published: 0,
          failed: 0,
          skipped: 0
        }
      })
    ).resolves.toBeUndefined();
  });
});

function fixedClock(): { now(): string } {
  return {
    now() {
      return "2026-06-21T00:00:00.000Z";
    }
  };
}

class MemoryWriter implements OutboxWorkerProductionLogWriter {
  readonly lines: string[] = [];

  write(line: string): void {
    this.lines.push(line);
  }
}
