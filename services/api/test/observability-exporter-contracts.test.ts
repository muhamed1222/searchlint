import { describe, expect, it } from "vitest";

import {
  observabilityExporterContract,
  validateObservabilityExporterContract
} from "../src/index.js";

describe("observabilityExporterContract", () => {
  it("defines the approved OTLP and CloudWatch EMF exporter target", () => {
    expect(
      validateObservabilityExporterContract(observabilityExporterContract)
    ).toEqual([]);

    expect(observabilityExporterContract).toMatchObject({
      id: "searchlint-observability-exporter-v1",
      contractVersion: 1,
      provider: "opentelemetry-otlp",
      signals: ["logs", "metrics"],
      otlp: {
        protocol: "http/protobuf"
      },
      cloudWatchEmf: {
        target: "aws-cloudwatch-emf",
        namespace: "SearchLint/Cloud",
        dimensions: ["ServiceName", "EventName", "Environment"]
      }
    });
  });

  it("declares the required OTLP and SearchLint environment variables", () => {
    expect(
      observabilityExporterContract.otlp.environmentVariables.map(
        (variable) => variable.name
      )
    ).toEqual([
      "OTEL_SERVICE_NAME",
      "SEARCHLINT_ENVIRONMENT",
      "OTEL_EXPORTER_OTLP_ENDPOINT",
      "OTEL_EXPORTER_OTLP_PROTOCOL",
      "OTEL_EXPORTER_OTLP_HEADERS",
      "OTEL_EXPORTER_OTLP_TIMEOUT"
    ]);

    expect(
      observabilityExporterContract.otlp.environmentVariables.find(
        (variable) => variable.name === "OTEL_EXPORTER_OTLP_HEADERS"
      )
    ).toMatchObject({
      required: false,
      secret: true
    });
  });

  it("maps API and worker log events to low-cardinality metrics", () => {
    expect(
      observabilityExporterContract.cloudWatchEmf.events.map((event) => ({
        eventName: event.eventName,
        metrics: event.metrics.map((metric) => metric.name)
      }))
    ).toEqual([
      {
        eventName: "searchlint.api.request",
        metrics: [
          "ApiRequestCount",
          "ApiRequestDurationMs",
          "ApiRateLimitedRequests",
          "ApiTimedOutRequests",
          "ApiServerErrors"
        ]
      },
      {
        eventName: "searchlint.worker.lifecycle",
        metrics: ["WorkerLifecycleEvents"]
      },
      {
        eventName: "searchlint.worker.outbox_batch",
        metrics: ["OutboxPublished", "OutboxFailed", "OutboxSkipped"]
      },
      {
        eventName: "searchlint.worker.crawler_batch",
        metrics: [
          "CrawlerSucceeded",
          "CrawlerFailed",
          "CrawlerInvalid",
          "CrawlerDeleted",
          "CrawlerSkipped"
        ]
      },
      {
        eventName: "searchlint.worker.error",
        metrics: ["WorkerErrors"]
      }
    ]);
  });

  it("rejects unsupported exporter drift", () => {
    const issues = validateObservabilityExporterContract({
      ...observabilityExporterContract,
      signals: ["logs"],
      otlp: {
        ...observabilityExporterContract.otlp,
        protocol: "grpc" as "http/protobuf",
        environmentVariables:
          observabilityExporterContract.otlp.environmentVariables.filter(
            (variable) => variable.name !== "OTEL_EXPORTER_OTLP_ENDPOINT"
          )
      },
      cloudWatchEmf: {
        ...observabilityExporterContract.cloudWatchEmf,
        namespace: "SearchLint/Dev" as "SearchLint/Cloud",
        dimensions: ["ServiceName", "RequestId", "Environment"] as unknown as [
          "ServiceName",
          "EventName",
          "Environment"
        ],
        events: [
          {
            ...observabilityExporterContract.cloudWatchEmf.events[0]!,
            requiredAttributes: ["searchlint.tenant_id"],
            metrics: [
              {
                name: "api_request_count",
                unit: "Count",
                sourceAttribute: "searchlint.tenant_id"
              }
            ]
          }
        ]
      }
    });

    expect(issues).toEqual(
      expect.arrayContaining([
        {
          path: "signals",
          message: "metrics is required."
        },
        {
          path: "otlp.protocol",
          message: "Expected http/protobuf, received grpc."
        },
        {
          path: "otlp.environmentVariables",
          message:
            "OTEL_EXPORTER_OTLP_ENDPOINT environment variable contract is required."
        },
        {
          path: "cloudWatchEmf.namespace",
          message: "Expected SearchLint/Cloud, received SearchLint/Dev."
        },
        {
          path: "cloudWatchEmf.dimensions",
          message: "EventName is required."
        },
        {
          path: "cloudWatchEmf.dimensions",
          message: "RequestId is not part of the approved set."
        },
        {
          path: "cloudWatchEmf.events.searchlint.api.request.requiredAttributes",
          message:
            "searchlint.tenant_id must be required by the source CloudWatch log event."
        },
        {
          path: "cloudWatchEmf.events.searchlint.api.request.metrics.api_request_count.sourceAttribute",
          message:
            "searchlint.tenant_id must be required by the source CloudWatch log event."
        },
        {
          path: "cloudWatchEmf.events.searchlint.api.request.metrics.api_request_count.name",
          message: "Metric names must be PascalCase alphanumeric identifiers."
        },
        {
          path: "cloudWatchEmf.events",
          message:
            "searchlint.worker.lifecycle exporter event contract is required."
        }
      ])
    );
  });
});
