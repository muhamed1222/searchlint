import type {
  DispatchOutboxBatchResult,
  OutboxWorkerEcsTaskLifecycleEvent,
  OutboxWorkerEcsTaskLifecycleState,
  OutboxWorkerShutdownSignal
} from "./index.js";
import type { DeleteExpiredReportArtifactsResult } from "./report-artifact-retention-worker.js";
import type { CollectExternalObservationsBatchResult } from "./external-observation-collection-worker.js";
import type { NotificationDeliveryWorkerResult } from "./notification-delivery-worker.js";
import type { SqsCrawlBatchResult } from "./sqs-crawler-consumer.js";

export type OutboxWorkerProductionLogSeverity = "INFO" | "WARN" | "ERROR";

export type OutboxWorkerProductionLogEvent =
  | {
      kind: "lifecycle";
      event: OutboxWorkerEcsTaskLifecycleEvent;
    }
  | {
      kind: "batch";
      result: DispatchOutboxBatchResult;
    }
  | {
      kind: "crawler-batch";
      result: SqsCrawlBatchResult;
    }
  | {
      kind: "report-cleanup-batch";
      result: DeleteExpiredReportArtifactsResult;
    }
  | {
      kind: "external-observation-batch";
      result: CollectExternalObservationsBatchResult;
    }
  | {
      kind: "notification-delivery-batch";
      result: NotificationDeliveryWorkerResult;
    }
  | {
      kind: "error";
      error: unknown;
      phase?: string;
    };

export type OutboxWorkerProductionLogRecord = {
  timestamp: string;
  severity: OutboxWorkerProductionLogSeverity;
  serviceName: string;
  eventName: string;
  body: {
    workerKind: string;
    lifecycleState?: OutboxWorkerEcsTaskLifecycleState;
    signal?: OutboxWorkerShutdownSignal;
    shutdownCompleted?: boolean;
    shutdownForced?: boolean;
    shutdownWasRunning?: boolean;
    selected?: number;
    leased?: number;
    published?: number;
    delivered?: number;
    received?: number;
    handled?: number;
    succeeded?: number;
    invalid?: number;
    deleted?: number;
    failed?: number;
    skipped?: number;
    canceled?: number;
    backoffApplied?: number;
    retryScheduled?: number;
    errorMessage?: string;
    phase?: string;
  };
  attributes: {
    "searchlint.worker.kind": string;
    "searchlint.worker.event_kind": OutboxWorkerProductionLogEvent["kind"];
    "searchlint.worker.lifecycle_state"?: OutboxWorkerEcsTaskLifecycleState;
    "searchlint.worker.shutdown_signal"?: OutboxWorkerShutdownSignal;
    "searchlint.worker.shutdown_completed"?: boolean;
    "searchlint.worker.shutdown_forced"?: boolean;
    "searchlint.worker.shutdown_was_running"?: boolean;
    "searchlint.outbox.selected"?: number;
    "searchlint.outbox.leased"?: number;
    "searchlint.outbox.published"?: number;
    "searchlint.outbox.failed"?: number;
    "searchlint.outbox.skipped"?: number;
    "searchlint.crawler.received"?: number;
    "searchlint.crawler.handled"?: number;
    "searchlint.crawler.succeeded"?: number;
    "searchlint.crawler.failed"?: number;
    "searchlint.crawler.invalid"?: number;
    "searchlint.crawler.deleted"?: number;
    "searchlint.crawler.skipped"?: number;
    "searchlint.crawler.canceled"?: number;
    "searchlint.crawler.backoff_applied"?: number;
    "searchlint.report_artifact_cleanup.selected"?: number;
    "searchlint.report_artifact_cleanup.leased"?: number;
    "searchlint.report_artifact_cleanup.deleted"?: number;
    "searchlint.report_artifact_cleanup.failed"?: number;
    "searchlint.report_artifact_cleanup.skipped"?: number;
    "searchlint.external_observation.selected"?: number;
    "searchlint.external_observation.collected"?: number;
    "searchlint.external_observation.stored"?: number;
    "searchlint.external_observation.failed"?: number;
    "searchlint.external_observation.skipped"?: number;
    "searchlint.notification_delivery.selected"?: number;
    "searchlint.notification_delivery.delivered"?: number;
    "searchlint.notification_delivery.retry_scheduled"?: number;
    "searchlint.notification_delivery.failed"?: number;
    "error.message"?: string;
    "searchlint.worker.phase"?: string;
  };
};

export type OutboxWorkerProductionLogWriter = {
  write(line: string): void | Promise<void>;
};

export type OutboxWorkerProductionLogClock = {
  now(): string;
};

export type OutboxWorkerProductionLogSink = {
  write(event: OutboxWorkerProductionLogEvent): Promise<void>;
};

export type OutboxWorkerProductionLogSinkOptions = {
  serviceName?: string;
  workerKind?: string;
  clock?: OutboxWorkerProductionLogClock;
  stdout?: OutboxWorkerProductionLogWriter;
  stderr?: OutboxWorkerProductionLogWriter;
  routeErrorsToStderr?: boolean;
};

const defaultServiceName = "searchlint-cloud-worker";
const defaultWorkerKind = "outbox-poller";
const sensitiveValuePatterns: readonly RegExp[] = [
  /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi,
  /\bsk_(live|test)_[A-Za-z0-9]+/gi,
  /\bwhsec_[A-Za-z0-9]+/gi,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
  /\bpostgres(?:ql)?:\/\/[^\s"']+/gi,
  /\b(?:ya29|xox[baprs]|ghp|github_pat)_[A-Za-z0-9_=-]+/gi
];

export function createOutboxWorkerProductionLogSink(
  options: OutboxWorkerProductionLogSinkOptions = {}
): OutboxWorkerProductionLogSink {
  const stdout = options.stdout ?? process.stdout;
  const stderr = options.stderr ?? process.stderr;

  return {
    async write(event) {
      const record = outboxWorkerProductionLogRecord(event, options);
      const line = `${JSON.stringify(record)}\n`;
      const writer =
        options.routeErrorsToStderr === true && record.severity === "ERROR"
          ? stderr
          : stdout;

      try {
        await writer.write(line);
      } catch {
        // Logging must not fail worker polling or shutdown paths.
      }
    }
  };
}

export function outboxWorkerProductionLogRecord(
  event: OutboxWorkerProductionLogEvent,
  options: Pick<
    OutboxWorkerProductionLogSinkOptions,
    "serviceName" | "workerKind" | "clock"
  > = {}
): OutboxWorkerProductionLogRecord {
  const workerKind = options.workerKind ?? defaultWorkerKind;
  return {
    timestamp: options.clock?.now() ?? new Date().toISOString(),
    severity: logSeverity(event),
    serviceName: options.serviceName ?? defaultServiceName,
    eventName: eventName(event),
    body: logBody(event, workerKind),
    attributes: logAttributes(event, workerKind)
  };
}

function eventName(event: OutboxWorkerProductionLogEvent): string {
  if (event.kind === "lifecycle") {
    return "searchlint.worker.lifecycle";
  }
  if (event.kind === "batch") {
    return "searchlint.worker.outbox_batch";
  }
  if (event.kind === "crawler-batch") {
    return "searchlint.worker.crawler_batch";
  }
  if (event.kind === "report-cleanup-batch") {
    return "searchlint.worker.report_artifact_cleanup_batch";
  }
  if (event.kind === "external-observation-batch") {
    return "searchlint.worker.external_observation_batch";
  }
  if (event.kind === "notification-delivery-batch") {
    return "searchlint.worker.notification_delivery_batch";
  }
  return "searchlint.worker.error";
}

function logSeverity(
  event: OutboxWorkerProductionLogEvent
): OutboxWorkerProductionLogSeverity {
  if (event.kind === "error") {
    return "ERROR";
  }
  if (event.kind === "lifecycle") {
    if (event.event.state === "failed") {
      return "ERROR";
    }
    if (event.event.state === "draining" || event.event.result?.forced) {
      return "WARN";
    }
    return "INFO";
  }
  if (event.kind === "notification-delivery-batch") {
    if (event.result.failed > 0 || event.result.retryScheduled > 0) {
      return "WARN";
    }
    return "INFO";
  }
  if (event.result.failed > 0 || event.result.skipped > 0) {
    return "WARN";
  }
  return "INFO";
}

function logBody(
  event: OutboxWorkerProductionLogEvent,
  workerKind: string
): OutboxWorkerProductionLogRecord["body"] {
  if (event.kind === "lifecycle") {
    return {
      workerKind,
      lifecycleState: event.event.state,
      ...(event.event.signal === undefined
        ? {}
        : { signal: event.event.signal }),
      ...(event.event.result === undefined
        ? {}
        : {
            shutdownCompleted: event.event.result.completed,
            shutdownForced: event.event.result.forced,
            shutdownWasRunning: event.event.result.wasRunning
          }),
      ...(event.event.error === undefined
        ? {}
        : { errorMessage: errorMessage(event.event.error) })
    };
  }

  if (event.kind === "batch") {
    return {
      workerKind,
      selected: event.result.selected,
      leased: event.result.leased,
      published: event.result.published,
      failed: event.result.failed,
      skipped: event.result.skipped
    };
  }

  if (event.kind === "crawler-batch") {
    return {
      workerKind,
      received: event.result.received,
      handled: event.result.handled,
      succeeded: event.result.succeeded,
      failed: event.result.failed,
      invalid: event.result.invalid,
      deleted: event.result.deleted,
      skipped: event.result.skipped,
      canceled: event.result.canceled,
      backoffApplied: event.result.backoffApplied
    };
  }

  if (event.kind === "report-cleanup-batch") {
    return {
      workerKind,
      selected: event.result.selected,
      leased: event.result.leased,
      deleted: event.result.deleted,
      failed: event.result.failed,
      skipped: event.result.skipped
    };
  }

  if (event.kind === "external-observation-batch") {
    return {
      workerKind,
      selected: event.result.selected,
      succeeded: event.result.collected,
      published: event.result.stored,
      failed: event.result.failed,
      skipped: event.result.skipped
    };
  }

  if (event.kind === "notification-delivery-batch") {
    return {
      workerKind,
      selected: event.result.selected,
      delivered: event.result.delivered,
      retryScheduled: event.result.retryScheduled,
      failed: event.result.failed
    };
  }

  return {
    workerKind,
    errorMessage: errorMessage(event.error),
    ...(event.phase === undefined ? {} : { phase: event.phase })
  };
}

function logAttributes(
  event: OutboxWorkerProductionLogEvent,
  workerKind: string
): OutboxWorkerProductionLogRecord["attributes"] {
  if (event.kind === "lifecycle") {
    return {
      "searchlint.worker.kind": workerKind,
      "searchlint.worker.event_kind": event.kind,
      "searchlint.worker.lifecycle_state": event.event.state,
      ...(event.event.signal === undefined
        ? {}
        : { "searchlint.worker.shutdown_signal": event.event.signal }),
      ...(event.event.result === undefined
        ? {}
        : {
            "searchlint.worker.shutdown_completed":
              event.event.result.completed,
            "searchlint.worker.shutdown_forced": event.event.result.forced,
            "searchlint.worker.shutdown_was_running":
              event.event.result.wasRunning
          }),
      ...(event.event.error === undefined
        ? {}
        : { "error.message": errorMessage(event.event.error) })
    };
  }

  if (event.kind === "batch") {
    return {
      "searchlint.worker.kind": workerKind,
      "searchlint.worker.event_kind": event.kind,
      "searchlint.outbox.selected": event.result.selected,
      "searchlint.outbox.leased": event.result.leased,
      "searchlint.outbox.published": event.result.published,
      "searchlint.outbox.failed": event.result.failed,
      "searchlint.outbox.skipped": event.result.skipped
    };
  }

  if (event.kind === "crawler-batch") {
    return {
      "searchlint.worker.kind": workerKind,
      "searchlint.worker.event_kind": event.kind,
      "searchlint.crawler.received": event.result.received,
      "searchlint.crawler.handled": event.result.handled,
      "searchlint.crawler.succeeded": event.result.succeeded,
      "searchlint.crawler.failed": event.result.failed,
      "searchlint.crawler.invalid": event.result.invalid,
      "searchlint.crawler.deleted": event.result.deleted,
      "searchlint.crawler.skipped": event.result.skipped,
      "searchlint.crawler.canceled": event.result.canceled,
      "searchlint.crawler.backoff_applied": event.result.backoffApplied
    };
  }

  if (event.kind === "report-cleanup-batch") {
    return {
      "searchlint.worker.kind": workerKind,
      "searchlint.worker.event_kind": event.kind,
      "searchlint.report_artifact_cleanup.selected": event.result.selected,
      "searchlint.report_artifact_cleanup.leased": event.result.leased,
      "searchlint.report_artifact_cleanup.deleted": event.result.deleted,
      "searchlint.report_artifact_cleanup.failed": event.result.failed,
      "searchlint.report_artifact_cleanup.skipped": event.result.skipped
    };
  }

  if (event.kind === "external-observation-batch") {
    return {
      "searchlint.worker.kind": workerKind,
      "searchlint.worker.event_kind": event.kind,
      "searchlint.external_observation.selected": event.result.selected,
      "searchlint.external_observation.collected": event.result.collected,
      "searchlint.external_observation.stored": event.result.stored,
      "searchlint.external_observation.failed": event.result.failed,
      "searchlint.external_observation.skipped": event.result.skipped
    };
  }

  if (event.kind === "notification-delivery-batch") {
    return {
      "searchlint.worker.kind": workerKind,
      "searchlint.worker.event_kind": event.kind,
      "searchlint.notification_delivery.selected": event.result.selected,
      "searchlint.notification_delivery.delivered": event.result.delivered,
      "searchlint.notification_delivery.retry_scheduled":
        event.result.retryScheduled,
      "searchlint.notification_delivery.failed": event.result.failed
    };
  }

  return {
    "searchlint.worker.kind": workerKind,
    "searchlint.worker.event_kind": event.kind,
    "error.message": errorMessage(event.error),
    ...(event.phase === undefined
      ? {}
      : { "searchlint.worker.phase": event.phase })
  };
}

function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return redactSensitiveValues(message);
}

function redactSensitiveValues(value: string): string {
  return sensitiveValuePatterns.reduce(
    (redacted, pattern) => redacted.replace(pattern, "[REDACTED]"),
    value
  );
}

export function workerLogRecordContainsSecret(record: unknown): boolean {
  const text = JSON.stringify(record);
  return sensitiveValuePatterns.some((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(text);
  });
}
