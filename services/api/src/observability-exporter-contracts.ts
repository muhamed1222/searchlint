import {
  cloudWatchLogProvisioningContract,
  type CloudWatchLogEventContract
} from "./cloudwatch-log-provisioning-contracts.js";

export type ObservabilityExporterContractId =
  "searchlint-observability-exporter-v1";
export type ObservabilityExporterProvider = "opentelemetry-otlp";
export type ObservabilityMetricTarget = "aws-cloudwatch-emf";
export type ObservabilitySignal = "logs" | "metrics";
export type ObservabilityOtlpProtocol = "http/protobuf";
export type ObservabilityMetricUnit =
  | "Count"
  | "Milliseconds"
  | "Seconds"
  | "Bytes";

export type ObservabilityEnvironmentVariableName =
  | "OTEL_SERVICE_NAME"
  | "OTEL_EXPORTER_OTLP_ENDPOINT"
  | "OTEL_EXPORTER_OTLP_PROTOCOL"
  | "OTEL_EXPORTER_OTLP_HEADERS"
  | "OTEL_EXPORTER_OTLP_TIMEOUT"
  | "SEARCHLINT_ENVIRONMENT";

export type ObservabilityEnvironmentVariableContract = {
  name: ObservabilityEnvironmentVariableName;
  required: boolean;
  secret: boolean;
};

export type ObservabilityMetricContract = {
  name: string;
  unit: ObservabilityMetricUnit;
  sourceAttribute: string;
};

export type ObservabilityExporterEventContract = {
  eventName: CloudWatchLogEventContract["eventName"];
  requiredAttributes: readonly string[];
  metrics: readonly ObservabilityMetricContract[];
};

export type ObservabilityExporterContract = {
  id: ObservabilityExporterContractId;
  contractVersion: 1;
  provider: ObservabilityExporterProvider;
  signals: readonly ObservabilitySignal[];
  otlp: {
    protocol: ObservabilityOtlpProtocol;
    environmentVariables: readonly ObservabilityEnvironmentVariableContract[];
  };
  cloudWatchEmf: {
    target: ObservabilityMetricTarget;
    namespace: "SearchLint/Cloud";
    dimensions: readonly ["ServiceName", "EventName", "Environment"];
    events: readonly ObservabilityExporterEventContract[];
  };
};

export type ObservabilityExporterValidationIssue = {
  path: string;
  message: string;
};

const requiredSignals: readonly ObservabilitySignal[] = ["logs", "metrics"];

const environmentVariables: readonly ObservabilityEnvironmentVariableContract[] =
  [
    {
      name: "OTEL_SERVICE_NAME",
      required: true,
      secret: false
    },
    {
      name: "SEARCHLINT_ENVIRONMENT",
      required: true,
      secret: false
    },
    {
      name: "OTEL_EXPORTER_OTLP_ENDPOINT",
      required: true,
      secret: false
    },
    {
      name: "OTEL_EXPORTER_OTLP_PROTOCOL",
      required: true,
      secret: false
    },
    {
      name: "OTEL_EXPORTER_OTLP_HEADERS",
      required: false,
      secret: true
    },
    {
      name: "OTEL_EXPORTER_OTLP_TIMEOUT",
      required: true,
      secret: false
    }
  ];

export const observabilityExporterContract: ObservabilityExporterContract = {
  id: "searchlint-observability-exporter-v1",
  contractVersion: 1,
  provider: "opentelemetry-otlp",
  signals: requiredSignals,
  otlp: {
    protocol: "http/protobuf",
    environmentVariables
  },
  cloudWatchEmf: {
    target: "aws-cloudwatch-emf",
    namespace: "SearchLint/Cloud",
    dimensions: ["ServiceName", "EventName", "Environment"],
    events: [
      {
        eventName: "searchlint.api.request",
        requiredAttributes: [
          "http.request.method",
          "url.path",
          "http.response.status_code",
          "http.server.duration_ms",
          "searchlint.rate_limited",
          "searchlint.timed_out"
        ],
        metrics: [
          {
            name: "ApiRequestCount",
            unit: "Count",
            sourceAttribute: "http.response.status_code"
          },
          {
            name: "ApiRequestDurationMs",
            unit: "Milliseconds",
            sourceAttribute: "http.server.duration_ms"
          },
          {
            name: "ApiRateLimitedRequests",
            unit: "Count",
            sourceAttribute: "searchlint.rate_limited"
          },
          {
            name: "ApiTimedOutRequests",
            unit: "Count",
            sourceAttribute: "searchlint.timed_out"
          },
          {
            name: "ApiServerErrors",
            unit: "Count",
            sourceAttribute: "http.response.status_code"
          }
        ]
      },
      {
        eventName: "searchlint.worker.lifecycle",
        requiredAttributes: [
          "searchlint.worker.kind",
          "searchlint.worker.event_kind",
          "searchlint.worker.lifecycle_state"
        ],
        metrics: [
          {
            name: "WorkerLifecycleEvents",
            unit: "Count",
            sourceAttribute: "searchlint.worker.lifecycle_state"
          }
        ]
      },
      {
        eventName: "searchlint.worker.outbox_batch",
        requiredAttributes: [
          "searchlint.outbox.selected",
          "searchlint.outbox.leased",
          "searchlint.outbox.published",
          "searchlint.outbox.failed",
          "searchlint.outbox.skipped"
        ],
        metrics: [
          {
            name: "OutboxPublished",
            unit: "Count",
            sourceAttribute: "searchlint.outbox.published"
          },
          {
            name: "OutboxFailed",
            unit: "Count",
            sourceAttribute: "searchlint.outbox.failed"
          },
          {
            name: "OutboxSkipped",
            unit: "Count",
            sourceAttribute: "searchlint.outbox.skipped"
          }
        ]
      },
      {
        eventName: "searchlint.worker.crawler_batch",
        requiredAttributes: [
          "searchlint.crawler.received",
          "searchlint.crawler.handled",
          "searchlint.crawler.succeeded",
          "searchlint.crawler.failed",
          "searchlint.crawler.invalid",
          "searchlint.crawler.deleted",
          "searchlint.crawler.skipped"
        ],
        metrics: [
          {
            name: "CrawlerSucceeded",
            unit: "Count",
            sourceAttribute: "searchlint.crawler.succeeded"
          },
          {
            name: "CrawlerFailed",
            unit: "Count",
            sourceAttribute: "searchlint.crawler.failed"
          },
          {
            name: "CrawlerInvalid",
            unit: "Count",
            sourceAttribute: "searchlint.crawler.invalid"
          },
          {
            name: "CrawlerDeleted",
            unit: "Count",
            sourceAttribute: "searchlint.crawler.deleted"
          },
          {
            name: "CrawlerSkipped",
            unit: "Count",
            sourceAttribute: "searchlint.crawler.skipped"
          }
        ]
      },
      {
        eventName: "searchlint.worker.error",
        requiredAttributes: [
          "searchlint.worker.kind",
          "searchlint.worker.event_kind",
          "error.message"
        ],
        metrics: [
          {
            name: "WorkerErrors",
            unit: "Count",
            sourceAttribute: "error.message"
          }
        ]
      }
    ]
  }
};

export function validateObservabilityExporterContract(
  contract: ObservabilityExporterContract
): ObservabilityExporterValidationIssue[] {
  const issues: ObservabilityExporterValidationIssue[] = [];

  expectEqual(
    issues,
    "id",
    contract.id,
    "searchlint-observability-exporter-v1"
  );
  expectEqual(issues, "contractVersion", contract.contractVersion, 1);
  expectEqual(issues, "provider", contract.provider, "opentelemetry-otlp");
  expectSetEqual(issues, "signals", contract.signals, requiredSignals);
  expectEqual(issues, "otlp.protocol", contract.otlp.protocol, "http/protobuf");
  validateEnvironmentVariables(issues, contract);
  validateCloudWatchEmf(issues, contract);

  return issues;
}

function validateEnvironmentVariables(
  issues: ObservabilityExporterValidationIssue[],
  contract: ObservabilityExporterContract
): void {
  const variables = new Map(
    contract.otlp.environmentVariables.map((variable) => [
      variable.name,
      variable
    ])
  );

  for (const expected of environmentVariables) {
    const actual = variables.get(expected.name);
    if (!actual) {
      issues.push({
        path: "otlp.environmentVariables",
        message: `${expected.name} environment variable contract is required.`
      });
      continue;
    }

    const basePath = `otlp.environmentVariables.${expected.name}`;
    expectEqual(
      issues,
      `${basePath}.required`,
      actual.required,
      expected.required
    );
    expectEqual(issues, `${basePath}.secret`, actual.secret, expected.secret);
  }
}

function validateCloudWatchEmf(
  issues: ObservabilityExporterValidationIssue[],
  contract: ObservabilityExporterContract
): void {
  expectEqual(
    issues,
    "cloudWatchEmf.target",
    contract.cloudWatchEmf.target,
    "aws-cloudwatch-emf"
  );
  expectEqual(
    issues,
    "cloudWatchEmf.namespace",
    contract.cloudWatchEmf.namespace,
    "SearchLint/Cloud"
  );
  expectSetEqual(
    issues,
    "cloudWatchEmf.dimensions",
    contract.cloudWatchEmf.dimensions,
    ["ServiceName", "EventName", "Environment"]
  );

  const knownEvents = new Map(
    cloudWatchLogProvisioningContract.groups.flatMap((group) =>
      group.events.map((event) => [event.eventName, event] as const)
    )
  );

  for (const event of contract.cloudWatchEmf.events) {
    const sourceEvent = knownEvents.get(event.eventName);
    const basePath = `cloudWatchEmf.events.${event.eventName}`;
    if (!sourceEvent) {
      issues.push({
        path: basePath,
        message: `${event.eventName} must exist in the CloudWatch log provisioning contract.`
      });
      continue;
    }
    validateEventAttributes(issues, basePath, event, sourceEvent);
    validateMetrics(issues, basePath, event);
  }

  for (const sourceEvent of knownEvents.values()) {
    if (
      !contract.cloudWatchEmf.events.some(
        (event) => event.eventName === sourceEvent.eventName
      )
    ) {
      issues.push({
        path: "cloudWatchEmf.events",
        message: `${sourceEvent.eventName} exporter event contract is required.`
      });
    }
  }
}

function validateEventAttributes(
  issues: ObservabilityExporterValidationIssue[],
  basePath: string,
  event: ObservabilityExporterEventContract,
  sourceEvent: CloudWatchLogEventContract
): void {
  const sourceAttributes = new Set(sourceEvent.requiredAttributes);
  for (const attribute of event.requiredAttributes) {
    if (!sourceAttributes.has(attribute)) {
      issues.push({
        path: `${basePath}.requiredAttributes`,
        message: `${attribute} must be required by the source CloudWatch log event.`
      });
    }
  }

  for (const metric of event.metrics) {
    if (!sourceAttributes.has(metric.sourceAttribute)) {
      issues.push({
        path: `${basePath}.metrics.${metric.name}.sourceAttribute`,
        message: `${metric.sourceAttribute} must be required by the source CloudWatch log event.`
      });
    }
  }
}

function validateMetrics(
  issues: ObservabilityExporterValidationIssue[],
  basePath: string,
  event: ObservabilityExporterEventContract
): void {
  if (event.metrics.length < 1) {
    issues.push({
      path: `${basePath}.metrics`,
      message: "At least one metric is required for each exporter event."
    });
  }

  const names = new Set<string>();
  for (const metric of event.metrics) {
    if (!/^[A-Z][A-Za-z0-9]+$/.test(metric.name)) {
      issues.push({
        path: `${basePath}.metrics.${metric.name}.name`,
        message: "Metric names must be PascalCase alphanumeric identifiers."
      });
    }
    if (names.has(metric.name)) {
      issues.push({
        path: `${basePath}.metrics.${metric.name}`,
        message: `${metric.name} metric is duplicated.`
      });
    }
    names.add(metric.name);
  }
}

function expectEqual(
  issues: ObservabilityExporterValidationIssue[],
  path: string,
  actual: unknown,
  expected: unknown
): void {
  if (actual !== expected) {
    issues.push({
      path,
      message: `Expected ${String(expected)}, received ${String(actual)}.`
    });
  }
}

function expectSetEqual(
  issues: ObservabilityExporterValidationIssue[],
  path: string,
  actual: readonly string[],
  expected: readonly string[]
): void {
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);

  for (const value of expectedSet) {
    if (!actualSet.has(value)) {
      issues.push({
        path,
        message: `${value} is required.`
      });
    }
  }

  for (const value of actualSet) {
    if (!expectedSet.has(value)) {
      issues.push({
        path,
        message: `${value} is not part of the approved set.`
      });
    }
  }
}
