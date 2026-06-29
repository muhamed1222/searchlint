import { describe, expect, it } from "vitest";

import {
  createOpenTelemetryOtlpExporterRuntime,
  type OpenTelemetryOtlpRuntimeFactories,
  type OpenTelemetryProviderLike,
  type OtlpRuntimeConfig
} from "../src/index.js";

describe("createOpenTelemetryOtlpExporterRuntime", () => {
  it("constructs log and metric providers from the validated OTLP config", async () => {
    const events: string[] = [];
    const factories = recordingFactories(events);
    const runtime = createOpenTelemetryOtlpExporterRuntime({ factories });

    runtime.start(
      runtimeConfig({
        headers: [{ name: "Authorization", value: "Bearer test-token" }]
      })
    );
    await runtime.shutdown();

    expect(events).toEqual([
      'resource:{"service.name":"searchlint-cloud-api","deployment.environment.name":"production","searchlint.environment":"production"}',
      'logExporter:{"url":"https://otel-collector.example.com/v1/logs","headers":{"Authorization":"Bearer test-token"},"timeoutMillis":12000}',
      "logProcessor:12000",
      "loggerProvider:12000:log-processor",
      'metricExporter:{"url":"https://otel-collector.example.com/v1/logs","headers":{"Authorization":"Bearer test-token"},"timeoutMillis":12000}',
      "metricReader:12000:12000",
      "meterProvider:metric-reader",
      "shutdown:meter-provider",
      "shutdown:logger-provider"
    ]);
  });

  it("creates only the log provider when metrics are disabled", async () => {
    const events: string[] = [];
    const runtime = createOpenTelemetryOtlpExporterRuntime({
      factories: recordingFactories(events)
    });

    runtime.start(runtimeConfig({ signals: ["logs"] }));
    await runtime.shutdown();

    expect(events).toEqual([
      'resource:{"service.name":"searchlint-cloud-api","deployment.environment.name":"production","searchlint.environment":"production"}',
      'logExporter:{"url":"https://otel-collector.example.com/v1/logs","headers":{},"timeoutMillis":12000}',
      "logProcessor:12000",
      "loggerProvider:12000:log-processor",
      "shutdown:logger-provider"
    ]);
  });

  it("creates only the metric provider when logs are disabled", async () => {
    const events: string[] = [];
    const runtime = createOpenTelemetryOtlpExporterRuntime({
      factories: recordingFactories(events)
    });

    runtime.start(runtimeConfig({ signals: ["metrics"] }));
    await runtime.shutdown();

    expect(events).toEqual([
      'resource:{"service.name":"searchlint-cloud-api","deployment.environment.name":"production","searchlint.environment":"production"}',
      'metricExporter:{"url":"https://otel-collector.example.com/v1/logs","headers":{},"timeoutMillis":12000}',
      "metricReader:12000:12000",
      "meterProvider:metric-reader",
      "shutdown:meter-provider"
    ]);
  });

  it("propagates shutdown failures and leaves later providers unmodified", async () => {
    const events: string[] = [];
    const error = new Error("metric shutdown failed");
    const runtime = createOpenTelemetryOtlpExporterRuntime({
      factories: recordingFactories(events, {
        failingProvider: "meter-provider",
        error
      })
    });

    runtime.start(runtimeConfig());

    await expect(runtime.shutdown()).rejects.toBe(error);
    expect(events).toEqual([
      'resource:{"service.name":"searchlint-cloud-api","deployment.environment.name":"production","searchlint.environment":"production"}',
      'logExporter:{"url":"https://otel-collector.example.com/v1/logs","headers":{},"timeoutMillis":12000}',
      "logProcessor:12000",
      "loggerProvider:12000:log-processor",
      'metricExporter:{"url":"https://otel-collector.example.com/v1/logs","headers":{},"timeoutMillis":12000}',
      "metricReader:12000:12000",
      "meterProvider:metric-reader",
      "shutdown:meter-provider"
    ]);
  });
});

function recordingFactories(
  events: string[],
  options: { failingProvider?: string; error?: Error } = {}
): OpenTelemetryOtlpRuntimeFactories {
  return {
    createResource(attributes) {
      events.push(`resource:${JSON.stringify(attributes)}`);
      return { kind: "resource" };
    },
    createLogExporter(config) {
      events.push(`logExporter:${JSON.stringify(config)}`);
      return { kind: "log-exporter" };
    },
    createLogRecordProcessor(_exporter, config) {
      events.push(`logProcessor:${config.exportTimeoutMillis}`);
      return { kind: "log-processor" };
    },
    createLoggerProvider(config) {
      events.push(
        `loggerProvider:${config.forceFlushTimeoutMillis}:${processorKinds(
          config.processors
        )}`
      );
      return provider("logger-provider", events, options);
    },
    createMetricExporter(config) {
      events.push(`metricExporter:${JSON.stringify(config)}`);
      return { kind: "metric-exporter" };
    },
    createMetricReader(_exporter, config) {
      events.push(
        `metricReader:${config.exportIntervalMillis}:${config.exportTimeoutMillis}`
      );
      return { kind: "metric-reader" };
    },
    createMeterProvider(config) {
      events.push(`meterProvider:${processorKinds(config.readers)}`);
      return provider("meter-provider", events, options);
    }
  };
}

function provider(
  name: string,
  events: string[],
  options: { failingProvider?: string; error?: Error }
): OpenTelemetryProviderLike {
  return {
    async shutdown() {
      events.push(`shutdown:${name}`);
      if (options.failingProvider === name) {
        throw options.error ?? new Error(`${name} failed`);
      }
    }
  };
}

function processorKinds(items: readonly object[]): string {
  return items
    .map((item) => ("kind" in item ? String(item.kind) : "unknown"))
    .join(",");
}

function runtimeConfig(
  overrides: Partial<OtlpRuntimeConfig> = {}
): OtlpRuntimeConfig {
  return {
    serviceName: "searchlint-cloud-api",
    environment: "production",
    endpoint: new URL("https://otel-collector.example.com/v1/logs"),
    protocol: "http/protobuf",
    timeoutMs: 12000,
    headers: [],
    signals: ["logs", "metrics"],
    ...overrides
  };
}
