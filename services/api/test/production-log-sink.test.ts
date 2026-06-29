import { describe, expect, it } from "vitest";

import {
  createNodeHttpProductionLogSink,
  nodeHttpProductionLogRecord
} from "../src/index.js";
import type {
  NodeHttpProductionLogWriter,
  NodeHttpRequestLogEvent
} from "../src/index.js";

describe("nodeHttpProductionLogRecord", () => {
  it("maps request log events to stable OpenTelemetry-shaped records", () => {
    const record = nodeHttpProductionLogRecord(requestLogEvent(), {
      clock: fixedClock(),
      serviceName: "custom-api",
      eventName: "custom.request"
    });

    expect(record).toEqual({
      timestamp: "2026-06-21T00:00:00.000Z",
      severity: "INFO",
      serviceName: "custom-api",
      eventName: "custom.request",
      body: {
        requestId: "request-1",
        method: "POST",
        path: "/v1/organizations",
        status: 201,
        durationMs: 42,
        rateLimited: false,
        timedOut: false
      },
      attributes: {
        "http.request.method": "POST",
        "url.path": "/v1/organizations",
        "http.response.status_code": 201,
        "http.server.duration_ms": 42,
        "searchlint.request_id": "request-1",
        "searchlint.rate_limited": false,
        "searchlint.timed_out": false
      }
    });
  });

  it("uses default service and event names", () => {
    const record = nodeHttpProductionLogRecord(requestLogEvent(), {
      clock: fixedClock()
    });

    expect(record.serviceName).toBe("searchlint-cloud-api");
    expect(record.eventName).toBe("searchlint.api.request");
  });

  it.each([
    { status: 200, rateLimited: false, timedOut: false, severity: "INFO" },
    { status: 404, rateLimited: false, timedOut: false, severity: "WARN" },
    { status: 200, rateLimited: true, timedOut: false, severity: "WARN" },
    { status: 200, rateLimited: false, timedOut: true, severity: "WARN" },
    { status: 500, rateLimited: false, timedOut: false, severity: "ERROR" }
  ] as const)(
    "uses $severity severity for status $status rateLimited=$rateLimited timedOut=$timedOut",
    ({ status, rateLimited, timedOut, severity }) => {
      const record = nodeHttpProductionLogRecord(
        requestLogEvent({
          status,
          rateLimited,
          timedOut
        }),
        {
          clock: fixedClock()
        }
      );

      expect(record.severity).toBe(severity);
    }
  );
});

describe("createNodeHttpProductionLogSink", () => {
  it("writes JSON lines to stdout by default", async () => {
    const stdout = new MemoryWriter();
    const sink = createNodeHttpProductionLogSink({
      clock: fixedClock(),
      stdout
    });

    await sink(requestLogEvent());

    expect(stdout.lines).toHaveLength(1);
    expect(stdout.lines[0]?.endsWith("\n")).toBe(true);
    expect(JSON.parse(stdout.lines[0] ?? "{}")).toMatchObject({
      timestamp: "2026-06-21T00:00:00.000Z",
      severity: "INFO",
      serviceName: "searchlint-cloud-api",
      eventName: "searchlint.api.request"
    });
  });

  it("routes error records to stderr when configured", async () => {
    const stdout = new MemoryWriter();
    const stderr = new MemoryWriter();
    const sink = createNodeHttpProductionLogSink({
      clock: fixedClock(),
      stdout,
      stderr,
      routeErrorsToStderr: true
    });

    await sink(
      requestLogEvent({
        status: 503
      })
    );

    expect(stdout.lines).toEqual([]);
    expect(stderr.lines).toHaveLength(1);
    expect(JSON.parse(stderr.lines[0] ?? "{}")).toMatchObject({
      severity: "ERROR"
    });
  });

  it("isolates writer failures from request handling", async () => {
    const sink = createNodeHttpProductionLogSink({
      clock: fixedClock(),
      stdout: {
        async write() {
          throw new Error("stdout unavailable");
        }
      }
    });

    await expect(sink(requestLogEvent())).resolves.toBeUndefined();
  });
});

function requestLogEvent(
  overrides: Partial<NodeHttpRequestLogEvent> = {}
): NodeHttpRequestLogEvent {
  return {
    requestId: "request-1",
    method: "POST",
    path: "/v1/organizations",
    status: 201,
    durationMs: 42,
    rateLimited: false,
    timedOut: false,
    ...overrides
  };
}

function fixedClock(): { now(): string } {
  return {
    now() {
      return "2026-06-21T00:00:00.000Z";
    }
  };
}

class MemoryWriter implements NodeHttpProductionLogWriter {
  readonly lines: string[] = [];

  write(line: string): void {
    this.lines.push(line);
  }
}
