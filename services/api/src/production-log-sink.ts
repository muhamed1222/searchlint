import type {
  NodeHttpRequestLogEvent,
  NodeHttpRequestLogger
} from "./node-http-server.js";

export type NodeHttpProductionLogSeverity = "INFO" | "WARN" | "ERROR";

export type NodeHttpProductionLogRecord = {
  timestamp: string;
  severity: NodeHttpProductionLogSeverity;
  serviceName: string;
  eventName: string;
  body: {
    requestId: string;
    method: string;
    path: string;
    status: number;
    durationMs: number;
    rateLimited: boolean;
    timedOut: boolean;
  };
  attributes: {
    "http.request.method": string;
    "url.path": string;
    "http.response.status_code": number;
    "http.server.duration_ms": number;
    "searchlint.request_id": string;
    "searchlint.rate_limited": boolean;
    "searchlint.timed_out": boolean;
  };
};

export type NodeHttpProductionLogWriter = {
  write(line: string): void | Promise<void>;
};

export type NodeHttpProductionLogClock = {
  now(): string;
};

export type NodeHttpProductionLogSinkOptions = {
  serviceName?: string;
  eventName?: string;
  clock?: NodeHttpProductionLogClock;
  stdout?: NodeHttpProductionLogWriter;
  stderr?: NodeHttpProductionLogWriter;
  routeErrorsToStderr?: boolean;
};

const defaultServiceName = "searchlint-cloud-api";
const defaultEventName = "searchlint.api.request";

export function createNodeHttpProductionLogSink(
  options: NodeHttpProductionLogSinkOptions = {}
): NodeHttpRequestLogger {
  const stdout = options.stdout ?? process.stdout;
  const stderr = options.stderr ?? process.stderr;

  return async (event) => {
    const record = nodeHttpProductionLogRecord(event, options);
    const line = `${JSON.stringify(record)}\n`;
    const writer =
      options.routeErrorsToStderr === true && record.severity === "ERROR"
        ? stderr
        : stdout;

    try {
      await writer.write(line);
    } catch {
      // Logging must not fail request handling or shutdown paths.
    }
  };
}

export function nodeHttpProductionLogRecord(
  event: NodeHttpRequestLogEvent,
  options: Pick<
    NodeHttpProductionLogSinkOptions,
    "serviceName" | "eventName" | "clock"
  > = {}
): NodeHttpProductionLogRecord {
  return {
    timestamp: options.clock?.now() ?? new Date().toISOString(),
    severity: logSeverity(event),
    serviceName: options.serviceName ?? defaultServiceName,
    eventName: options.eventName ?? defaultEventName,
    body: {
      requestId: event.requestId,
      method: event.method,
      path: event.path,
      status: event.status,
      durationMs: event.durationMs,
      rateLimited: event.rateLimited,
      timedOut: event.timedOut
    },
    attributes: {
      "http.request.method": event.method,
      "url.path": event.path,
      "http.response.status_code": event.status,
      "http.server.duration_ms": event.durationMs,
      "searchlint.request_id": event.requestId,
      "searchlint.rate_limited": event.rateLimited,
      "searchlint.timed_out": event.timedOut
    }
  };
}

function logSeverity(
  event: NodeHttpRequestLogEvent
): NodeHttpProductionLogSeverity {
  if (event.status >= 500) {
    return "ERROR";
  }
  if (event.status >= 400 || event.rateLimited || event.timedOut) {
    return "WARN";
  }
  return "INFO";
}
