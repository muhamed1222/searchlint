import { describe, expect, it } from "vitest";

import {
  googlePerformanceMetricEventsFromObservations,
  googlePerformanceMetricPointsFromObservations
} from "../src/index.js";
import type { ExternalObservationRecord } from "../src/index.js";

describe("googlePerformanceMetricPointsFromObservations", () => {
  it("extracts PageSpeed lab, page field, origin field, and CrUX metric history", () => {
    const points = googlePerformanceMetricPointsFromObservations([
      pageSpeedObservation(),
      cruxObservation(),
      cruxMissingObservation(),
      yandexObservation()
    ]);

    expect(points).toHaveLength(12);
    expect(
      points.map((point) => `${point.source}:${point.metric}:${point.value}`)
    ).toEqual([
      "pagespeed-lab:cls:0.04",
      "pagespeed-lab:inp:180",
      "pagespeed-lab:lcp:2200",
      "pagespeed-field-page:cls:0.05",
      "pagespeed-field-page:inp:190",
      "pagespeed-field-page:lcp:2450",
      "pagespeed-field-origin:cls:0.07",
      "pagespeed-field-origin:inp:210",
      "pagespeed-field-origin:lcp:2600",
      "crux-field:cls:0.06",
      "crux-field:inp:175",
      "crux-field:lcp:2400"
    ]);
    expect(points.every((point) => point.organizationId === "org-1")).toBe(
      true
    );
    expect(points.filter((point) => point.unit === "score")).toHaveLength(4);
    expect(points.filter((point) => point.unit === "ms")).toHaveLength(8);
  });

  it("converts performance history points into metric events", () => {
    const events = googlePerformanceMetricEventsFromObservations([
      pageSpeedObservation()
    ]);

    expect(events).toHaveLength(9);
    expect(
      events.find(
        (event) =>
          event.name === "performance.cls" &&
          event.dimensions.source === "pagespeed-field-origin"
      )
    ).toMatchObject({
      organizationId: "org-1",
      name: "performance.cls",
      value: 0.07,
      occurredAt: "2026-06-20T14:15:16.000Z",
      dimensions: {
        projectId: "project-1",
        environmentId: "env-1",
        subjectUrl: "https://example.test/products/widget",
        source: "pagespeed-field-origin",
        unit: "score",
        freshness: "fresh",
        sampled: "false"
      }
    });
    expect(events.map((event) => event.id)).toContain(
      "metric-project-1-env-1-pagespeed-lab-lcp-2026-06-20-example-test-products-widget"
    );
  });
});

function baseObservation(
  source: ExternalObservationRecord["source"],
  payload: ExternalObservationRecord["payload"],
  sampling: ExternalObservationRecord["sampling"] = { sampled: false }
): ExternalObservationRecord {
  return {
    id: `observation-${source}`,
    organizationId: "org-1",
    projectId: "project-1",
    environmentId: "env-1",
    provider: source.startsWith("yandex.") ? "yandex" : "google",
    source,
    subjectUrl: "https://example.test/products/widget",
    observedAt: "2026-06-20T14:15:16.000Z",
    fetchedAt: "2026-06-21T00:00:00.000Z",
    freshness: "fresh",
    payload,
    sampling,
    fingerprint: `fingerprint-${source}`,
    deletionState: "active",
    createdAt: "2026-06-21T00:00:00.000Z"
  };
}

function pageSpeedObservation(): ExternalObservationRecord {
  return baseObservation("google.pagespeed", {
    lighthouseResult: {
      audits: {
        "largest-contentful-paint": { numericValue: 2200 },
        "experimental-interaction-to-next-paint": { numericValue: 180 },
        "cumulative-layout-shift": { numericValue: 0.04 }
      }
    },
    loadingExperience: {
      metrics: {
        LARGEST_CONTENTFUL_PAINT_MS: { percentile: 2450 },
        INTERACTION_TO_NEXT_PAINT: { percentile: 190 },
        CUMULATIVE_LAYOUT_SHIFT_SCORE: { percentile: 0.05 }
      }
    },
    originLoadingExperience: {
      metrics: {
        LARGEST_CONTENTFUL_PAINT_MS: { percentile: 2600 },
        INTERACTION_TO_NEXT_PAINT: { percentile: 210 },
        CUMULATIVE_LAYOUT_SHIFT_SCORE: { percentile: 0.07 }
      }
    }
  });
}

function cruxObservation(): ExternalObservationRecord {
  return baseObservation(
    "google.crux",
    {
      record: {
        metrics: {
          largest_contentful_paint: { percentiles: { p75: 2400 } },
          interaction_to_next_paint: { percentiles: { p75: 175 } },
          cumulative_layout_shift: { percentiles: { p75: 0.06 } }
        }
      }
    },
    { sampled: true, state: "field-data" }
  );
}

function cruxMissingObservation(): ExternalObservationRecord {
  return baseObservation(
    "google.crux",
    {
      record: {
        metrics: {}
      }
    },
    { sampled: true, state: "missing" }
  );
}

function yandexObservation(): ExternalObservationRecord {
  return baseObservation("yandex.metrica", {
    rows: [{ metrics: [10] }]
  });
}
