import { describe, expect, it } from "vitest";

import { otlpRuntimeConfigFromEnv } from "../src/index.js";
import type { OtlpRuntimeConfigEnv } from "../src/index.js";

describe("otlpRuntimeConfigFromEnv", () => {
  it("parses the approved OTLP runtime environment", () => {
    const config = otlpRuntimeConfigFromEnv({
      ...validEnv(),
      OTEL_EXPORTER_OTLP_HEADERS:
        "authorization=Bearer token, x-searchlint-tenant=tenant-1"
    });

    expect({
      serviceName: config.serviceName,
      environment: config.environment,
      endpoint: config.endpoint.toString(),
      protocol: config.protocol,
      timeoutMs: config.timeoutMs,
      headers: config.headers,
      signals: config.signals
    }).toEqual({
      serviceName: "searchlint-cloud-api",
      environment: "production",
      endpoint: "https://otel-collector.example.com/v1/logs",
      protocol: "http/protobuf",
      timeoutMs: 10000,
      headers: [
        {
          name: "authorization",
          value: "Bearer token"
        },
        {
          name: "x-searchlint-tenant",
          value: "tenant-1"
        }
      ],
      signals: ["logs", "metrics"]
    });
  });

  it("treats blank optional headers as unset", () => {
    expect(
      otlpRuntimeConfigFromEnv({
        ...validEnv(),
        OTEL_EXPORTER_OTLP_HEADERS: "  "
      }).headers
    ).toEqual([]);
  });

  it.each([
    {
      name: "OTEL_SERVICE_NAME",
      value: " ",
      message: "OTEL_SERVICE_NAME is required."
    },
    {
      name: "SEARCHLINT_ENVIRONMENT",
      value: undefined,
      message: "SEARCHLINT_ENVIRONMENT is required."
    },
    {
      name: "OTEL_EXPORTER_OTLP_ENDPOINT",
      value: "collector.local/v1/logs",
      message: "OTEL_EXPORTER_OTLP_ENDPOINT must be an absolute URL."
    },
    {
      name: "OTEL_EXPORTER_OTLP_ENDPOINT",
      value: "ftp://collector.local/v1/logs",
      message: "OTEL_EXPORTER_OTLP_ENDPOINT must use http or https."
    },
    {
      name: "OTEL_EXPORTER_OTLP_PROTOCOL",
      value: "grpc",
      message: "OTEL_EXPORTER_OTLP_PROTOCOL must be http/protobuf."
    },
    {
      name: "OTEL_EXPORTER_OTLP_TIMEOUT",
      value: "0",
      message: "OTEL_EXPORTER_OTLP_TIMEOUT must be a positive integer."
    },
    {
      name: "OTEL_EXPORTER_OTLP_TIMEOUT",
      value: "100.5",
      message: "OTEL_EXPORTER_OTLP_TIMEOUT must be a positive integer."
    },
    {
      name: "OTEL_EXPORTER_OTLP_HEADERS",
      value: "authorization",
      message:
        "OTEL_EXPORTER_OTLP_HEADERS must contain comma-separated name=value pairs."
    },
    {
      name: "OTEL_EXPORTER_OTLP_HEADERS",
      value: "authorization=",
      message:
        "OTEL_EXPORTER_OTLP_HEADERS must contain comma-separated name=value pairs."
    }
  ] as const)("rejects invalid $name", ({ name, value, message }) => {
    expect(() =>
      otlpRuntimeConfigFromEnv({
        ...validEnv(),
        [name]: value
      })
    ).toThrow(message);
  });
});

function validEnv(): OtlpRuntimeConfigEnv {
  return {
    OTEL_SERVICE_NAME: "searchlint-cloud-api",
    SEARCHLINT_ENVIRONMENT: "production",
    OTEL_EXPORTER_OTLP_ENDPOINT: "https://otel-collector.example.com/v1/logs",
    OTEL_EXPORTER_OTLP_PROTOCOL: "http/protobuf",
    OTEL_EXPORTER_OTLP_TIMEOUT: "10000"
  };
}
