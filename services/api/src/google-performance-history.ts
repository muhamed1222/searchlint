import type { ExternalObservationRecord, MetricEvent } from "./types.js";

export type GooglePerformanceMetricName = "lcp" | "inp" | "cls";

export type GooglePerformanceMetricSource =
  | "pagespeed-lab"
  | "pagespeed-field-page"
  | "pagespeed-field-origin"
  | "crux-field";

export type GooglePerformanceMetricPoint = {
  organizationId: string;
  projectId: string;
  environmentId: string;
  subjectUrl: string;
  source: GooglePerformanceMetricSource;
  metric: GooglePerformanceMetricName;
  value: number;
  unit: "ms" | "score";
  observedAt: string;
  fetchedAt: string;
  freshness: ExternalObservationRecord["freshness"];
  sampled: boolean;
};

export function googlePerformanceMetricPointsFromObservations(
  observations: readonly ExternalObservationRecord[]
): readonly GooglePerformanceMetricPoint[] {
  return observations.flatMap((observation) => {
    if (observation.provider !== "google") {
      return [];
    }
    if (observation.source === "google.pagespeed") {
      return pageSpeedMetricPoints(observation);
    }
    if (observation.source === "google.crux") {
      return cruxMetricPoints(observation);
    }
    return [];
  });
}

export function googlePerformanceMetricEventsFromObservations(
  observations: readonly ExternalObservationRecord[]
): readonly MetricEvent[] {
  return googlePerformanceMetricPointsFromObservations(observations).map(
    (point) => ({
      id: [
        "metric",
        point.projectId,
        point.environmentId,
        point.source,
        point.metric,
        point.observedAt.slice(0, 10),
        stableSubjectKey(point.subjectUrl)
      ].join("-"),
      organizationId: point.organizationId,
      name: `performance.${point.metric}`,
      value: point.value,
      occurredAt: point.observedAt,
      dimensions: {
        projectId: point.projectId,
        environmentId: point.environmentId,
        subjectUrl: point.subjectUrl,
        source: point.source,
        unit: point.unit,
        freshness: point.freshness,
        sampled: String(point.sampled)
      }
    })
  );
}

function pageSpeedMetricPoints(
  observation: ExternalObservationRecord
): readonly GooglePerformanceMetricPoint[] {
  const payload = plainObject(observation.payload);
  const lighthouseResult = plainObject(payload.lighthouseResult);
  const audits = plainObject(lighthouseResult.audits);
  const loadingExperience = plainObject(payload.loadingExperience);
  const loadingMetrics = plainObject(loadingExperience.metrics);
  const originLoadingExperience = plainObject(payload.originLoadingExperience);
  const originMetrics = plainObject(originLoadingExperience.metrics);

  return [
    ...metricGroup(observation, "pagespeed-lab", {
      lcp: numericValue(audits["largest-contentful-paint"]),
      inp: numericValue(audits["experimental-interaction-to-next-paint"]),
      cls: numericValue(audits["cumulative-layout-shift"])
    }),
    ...metricGroup(observation, "pagespeed-field-page", {
      lcp: percentile(loadingMetrics.LARGEST_CONTENTFUL_PAINT_MS),
      inp: percentile(loadingMetrics.INTERACTION_TO_NEXT_PAINT),
      cls: percentile(loadingMetrics.CUMULATIVE_LAYOUT_SHIFT_SCORE)
    }),
    ...metricGroup(observation, "pagespeed-field-origin", {
      lcp: percentile(originMetrics.LARGEST_CONTENTFUL_PAINT_MS),
      inp: percentile(originMetrics.INTERACTION_TO_NEXT_PAINT),
      cls: percentile(originMetrics.CUMULATIVE_LAYOUT_SHIFT_SCORE)
    })
  ];
}

function cruxMetricPoints(
  observation: ExternalObservationRecord
): readonly GooglePerformanceMetricPoint[] {
  const record = plainObject(observation.payload.record);
  const metrics = plainObject(record.metrics);
  return metricGroup(observation, "crux-field", {
    lcp: p75(metrics.largest_contentful_paint),
    inp: p75(metrics.interaction_to_next_paint),
    cls: p75(metrics.cumulative_layout_shift)
  });
}

function metricGroup(
  observation: ExternalObservationRecord,
  source: GooglePerformanceMetricSource,
  metrics: Partial<Record<GooglePerformanceMetricName, number | undefined>>
): readonly GooglePerformanceMetricPoint[] {
  return (["lcp", "inp", "cls"] as const)
    .flatMap((metric) => {
      const value = metrics[metric];
      if (value === undefined) {
        return [];
      }
      const point: GooglePerformanceMetricPoint = {
        organizationId: observation.organizationId,
        projectId: observation.projectId,
        environmentId: observation.environmentId,
        subjectUrl: observation.subjectUrl,
        source,
        metric,
        value,
        unit: metric === "cls" ? "score" : "ms",
        observedAt: observation.observedAt,
        fetchedAt: observation.fetchedAt,
        freshness: observation.freshness,
        sampled: observation.sampling?.sampled ?? false
      };
      return [point];
    })
    .sort(compareMetricPoints);
}

function numericValue(value: unknown): number | undefined {
  const numeric = plainObject(value).numericValue;
  return typeof numeric === "number" ? numeric : undefined;
}

function percentile(value: unknown): number | undefined {
  const numeric = plainObject(value).percentile;
  return typeof numeric === "number" ? numeric : undefined;
}

function p75(value: unknown): number | undefined {
  const numeric = plainObject(plainObject(value).percentiles).p75;
  return typeof numeric === "number" ? numeric : undefined;
}

function compareMetricPoints(
  left: GooglePerformanceMetricPoint,
  right: GooglePerformanceMetricPoint
): number {
  return (
    left.observedAt.localeCompare(right.observedAt) ||
    left.subjectUrl.localeCompare(right.subjectUrl) ||
    left.source.localeCompare(right.source) ||
    left.metric.localeCompare(right.metric)
  );
}

function stableSubjectKey(subjectUrl: string): string {
  return subjectUrl
    .replace(/^https?:\/\//u, "")
    .replace(/[^a-z0-9]+/giu, "-")
    .replace(/^-|-$/gu, "")
    .toLowerCase();
}

function plainObject(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}
