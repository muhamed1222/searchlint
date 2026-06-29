import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import type { Resource } from "@opentelemetry/resources";
import {
  BatchLogRecordProcessor,
  LoggerProvider
} from "@opentelemetry/sdk-logs";
import type {
  LogRecordExporter,
  LogRecordProcessor
} from "@opentelemetry/sdk-logs";
import {
  MeterProvider,
  PeriodicExportingMetricReader
} from "@opentelemetry/sdk-metrics";
import type {
  IMetricReader,
  PushMetricExporter
} from "@opentelemetry/sdk-metrics";

import type { OtlpExporterRuntime } from "./otlp-exporter-lifecycle.js";
import type { OtlpRuntimeConfig } from "./otlp-runtime-config.js";

export type OpenTelemetryOtlpExporterConfig = {
  url: string;
  headers: Record<string, string>;
  timeoutMillis: number;
};

export type OpenTelemetryResourceAttributes = {
  "service.name": string;
  "deployment.environment.name": string;
  "searchlint.environment": string;
};

export type OpenTelemetryResourceLike = object;
export type OpenTelemetryLogExporterLike = object;
export type OpenTelemetryLogRecordProcessorLike = object;
export type OpenTelemetryMetricExporterLike = object;
export type OpenTelemetryMetricReaderLike = object;

export type OpenTelemetryProviderLike = {
  shutdown(): Promise<void>;
};

export type OpenTelemetryOtlpRuntimeFactories = {
  createResource(
    attributes: OpenTelemetryResourceAttributes
  ): OpenTelemetryResourceLike;
  createLogExporter(
    config: OpenTelemetryOtlpExporterConfig
  ): OpenTelemetryLogExporterLike;
  createLogRecordProcessor(
    exporter: OpenTelemetryLogExporterLike,
    config: { exportTimeoutMillis: number }
  ): OpenTelemetryLogRecordProcessorLike;
  createLoggerProvider(config: {
    resource: OpenTelemetryResourceLike;
    forceFlushTimeoutMillis: number;
    processors: readonly OpenTelemetryLogRecordProcessorLike[];
  }): OpenTelemetryProviderLike;
  createMetricExporter(
    config: OpenTelemetryOtlpExporterConfig
  ): OpenTelemetryMetricExporterLike;
  createMetricReader(
    exporter: OpenTelemetryMetricExporterLike,
    config: {
      exportIntervalMillis: number;
      exportTimeoutMillis: number;
    }
  ): OpenTelemetryMetricReaderLike;
  createMeterProvider(config: {
    resource: OpenTelemetryResourceLike;
    readers: readonly OpenTelemetryMetricReaderLike[];
  }): OpenTelemetryProviderLike;
};

export type OpenTelemetryOtlpRuntimeOptions = {
  factories?: Partial<OpenTelemetryOtlpRuntimeFactories>;
};

export function createOpenTelemetryOtlpExporterRuntime(
  options: OpenTelemetryOtlpRuntimeOptions = {}
): OtlpExporterRuntime {
  const factories = openTelemetryOtlpRuntimeFactories(options.factories);
  let providers: OpenTelemetryProviderLike[] = [];

  return {
    start(config) {
      const resource = factories.createResource(resourceAttributes(config));
      const exporterConfig = otlpExporterConfig(config);
      const nextProviders: OpenTelemetryProviderLike[] = [];

      if (config.signals.includes("logs")) {
        const exporter = factories.createLogExporter(exporterConfig);
        const processor = factories.createLogRecordProcessor(exporter, {
          exportTimeoutMillis: config.timeoutMs
        });
        nextProviders.push(
          factories.createLoggerProvider({
            resource,
            forceFlushTimeoutMillis: config.timeoutMs,
            processors: [processor]
          })
        );
      }

      if (config.signals.includes("metrics")) {
        const exporter = factories.createMetricExporter(exporterConfig);
        const reader = factories.createMetricReader(exporter, {
          exportIntervalMillis: config.timeoutMs,
          exportTimeoutMillis: config.timeoutMs
        });
        nextProviders.push(
          factories.createMeterProvider({
            resource,
            readers: [reader]
          })
        );
      }

      providers = nextProviders;
    },
    async shutdown() {
      for (const provider of [...providers].reverse()) {
        await provider.shutdown();
      }
      providers = [];
    }
  };
}

function openTelemetryOtlpRuntimeFactories(
  overrides: Partial<OpenTelemetryOtlpRuntimeFactories> = {}
): OpenTelemetryOtlpRuntimeFactories {
  return {
    createResource:
      overrides.createResource ??
      ((attributes) => resourceFromAttributes(attributes)),
    createLogExporter:
      overrides.createLogExporter ?? ((config) => new OTLPLogExporter(config)),
    createLogRecordProcessor:
      overrides.createLogRecordProcessor ??
      ((exporter, config) =>
        new BatchLogRecordProcessor(exporter as LogRecordExporter, config)),
    createLoggerProvider:
      overrides.createLoggerProvider ??
      ((config) =>
        new LoggerProvider({
          resource: config.resource as Resource,
          forceFlushTimeoutMillis: config.forceFlushTimeoutMillis,
          processors: [...config.processors] as LogRecordProcessor[]
        })),
    createMetricExporter:
      overrides.createMetricExporter ??
      ((config) => new OTLPMetricExporter(config)),
    createMetricReader:
      overrides.createMetricReader ??
      ((exporter, config) =>
        new PeriodicExportingMetricReader({
          exporter: exporter as PushMetricExporter,
          exportIntervalMillis: config.exportIntervalMillis,
          exportTimeoutMillis: config.exportTimeoutMillis
        })),
    createMeterProvider:
      overrides.createMeterProvider ??
      ((config) =>
        new MeterProvider({
          resource: config.resource as Resource,
          readers: [...config.readers] as IMetricReader[]
        }))
  };
}

function otlpExporterConfig(
  config: OtlpRuntimeConfig
): OpenTelemetryOtlpExporterConfig {
  return {
    url: config.endpoint.toString(),
    headers: Object.fromEntries(
      config.headers.map((header) => [header.name, header.value])
    ),
    timeoutMillis: config.timeoutMs
  };
}

function resourceAttributes(
  config: OtlpRuntimeConfig
): OpenTelemetryResourceAttributes {
  return {
    "service.name": config.serviceName,
    "deployment.environment.name": config.environment,
    "searchlint.environment": config.environment
  };
}
