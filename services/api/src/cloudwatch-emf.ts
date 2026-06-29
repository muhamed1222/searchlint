import { observabilityExporterContract } from "./observability-exporter-contracts.js";
import type {
  ObservabilityExporterEventContract,
  ObservabilityMetricContract
} from "./observability-exporter-contracts.js";

export type CloudWatchEmfSourceRecord = {
  timestamp: string;
  serviceName: string;
  eventName: string;
  attributes: Readonly<Record<string, unknown>>;
};

export type CloudWatchEmfMetricDefinition = {
  Name: string;
  Unit: ObservabilityMetricContract["unit"];
};

export type CloudWatchEmfMetricsBlock = {
  Namespace: "SearchLint/Cloud";
  Dimensions: readonly [readonly ["ServiceName", "EventName", "Environment"]];
  Metrics: readonly CloudWatchEmfMetricDefinition[];
};

export type CloudWatchEmfRecord = {
  _aws: {
    Timestamp: number;
    CloudWatchMetrics: readonly [CloudWatchEmfMetricsBlock];
  };
  ServiceName: string;
  EventName: string;
  Environment: string;
} & Record<string, string | number | boolean | object>;

export type CloudWatchEmfRecordOptions = {
  environment: string;
};

export function createCloudWatchEmfRecord(
  record: CloudWatchEmfSourceRecord,
  options: CloudWatchEmfRecordOptions
): CloudWatchEmfRecord | undefined {
  const eventContract = observabilityExporterContract.cloudWatchEmf.events.find(
    (event) => event.eventName === record.eventName
  );
  if (!eventContract) {
    return undefined;
  }

  const metricValues = metricsForEvent(record, eventContract);
  if (Object.keys(metricValues).length === 0) {
    return undefined;
  }

  return {
    _aws: {
      Timestamp: Date.parse(record.timestamp),
      CloudWatchMetrics: [
        {
          Namespace: observabilityExporterContract.cloudWatchEmf.namespace,
          Dimensions: [["ServiceName", "EventName", "Environment"]],
          Metrics: eventContract.metrics.map((metric) => ({
            Name: metric.name,
            Unit: metric.unit
          }))
        }
      ]
    },
    ServiceName: record.serviceName,
    EventName: record.eventName,
    Environment: options.environment,
    ...metricValues
  };
}

export function createCloudWatchEmfRecords(
  records: readonly CloudWatchEmfSourceRecord[],
  options: CloudWatchEmfRecordOptions
): readonly CloudWatchEmfRecord[] {
  return records.flatMap((record) => {
    const emfRecord = createCloudWatchEmfRecord(record, options);
    return emfRecord === undefined ? [] : [emfRecord];
  });
}

function metricsForEvent(
  record: CloudWatchEmfSourceRecord,
  eventContract: ObservabilityExporterEventContract
): Record<string, number> {
  const values: Record<string, number> = {};

  for (const metric of eventContract.metrics) {
    const value = metricValue(record, metric);
    if (value !== undefined) {
      values[metric.name] = value;
    }
  }

  return values;
}

function metricValue(
  record: CloudWatchEmfSourceRecord,
  metric: ObservabilityMetricContract
): number | undefined {
  const sourceValue = record.attributes[metric.sourceAttribute];

  if (metric.name === "ApiRequestCount") {
    return 1;
  }

  if (metric.name === "ApiServerErrors") {
    return typeof sourceValue === "number" && sourceValue >= 500 ? 1 : 0;
  }

  if (
    metric.name === "WorkerLifecycleEvents" ||
    metric.name === "WorkerErrors"
  ) {
    return sourceValue === undefined ? undefined : 1;
  }

  if (typeof sourceValue === "number") {
    return sourceValue;
  }

  if (typeof sourceValue === "boolean") {
    return sourceValue ? 1 : 0;
  }

  return undefined;
}
