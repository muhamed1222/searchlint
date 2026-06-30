import { describe, expect, it } from "vitest";

import {
  compareDiagnosticsBeforeAfter,
  correlateDeployments,
  createHistoryTimeline,
  detectTrendAnomalies,
  metricEventsFromTrendPoints,
  summarizeTrends
} from "../src/index.js";
import type {
  DiagnosticRecord,
  ExternalObservationRecord
} from "../src/index.js";
import type {
  HistoryDeploymentRecord,
  HistoryPageSnapshotRecord,
  TrendPoint
} from "../src/history-correlation.js";

describe("history correlation", () => {
  it("builds a stable timeline across deployments, snapshots, diagnostics, and observations", () => {
    const events = createHistoryTimeline({
      deployments: [deployment()],
      pageSnapshots: [snapshot()],
      diagnostics: [
        diagnostic({
          id: "diag-after",
          observedAt: "2026-06-22T00:20:00.000Z"
        })
      ],
      externalObservations: [externalObservation()]
    });

    expect(events.map((event) => [event.kind, event.id])).toEqual([
      ["deployment", "history-deployment-1"],
      ["page-snapshot", "snapshot-1"],
      ["diagnostic", "diag-after"],
      ["external-observation", "obs-1"]
    ]);
    expect(events[0]).toMatchObject({
      summary: "Deployment deploy-1 at abc123",
      metadata: {
        commitRef: "abc123",
        annotations: ["search templates changed"]
      }
    });
  });

  it("computes before and after diagnostic comparisons from fingerprints", () => {
    const comparison = compareDiagnosticsBeforeAfter({
      previousLabel: "before deploy",
      currentLabel: "after deploy",
      before: [
        diagnostic({
          id: "before-1",
          fingerprint: "shared",
          severity: "error"
        }),
        diagnostic({
          id: "before-2",
          fingerprint: "resolved",
          severity: "blocker"
        })
      ],
      after: [
        diagnostic({ id: "after-1", fingerprint: "shared", severity: "error" }),
        diagnostic({ id: "after-2", fingerprint: "new", severity: "warning" })
      ]
    });

    expect(comparison).toEqual({
      previousLabel: "before deploy",
      currentLabel: "after deploy",
      newDiagnostics: 1,
      resolvedDiagnostics: 1,
      unchangedDiagnostics: 1,
      severityDelta: {
        blocker: -1,
        error: 0,
        warning: 1,
        info: 0
      }
    });
  });

  it("correlates deployments without claiming causation", () => {
    const correlations = correlateDeployments({
      deployments: [deployment()],
      beforeDiagnostics: [
        diagnostic({ id: "before-1", fingerprint: "resolved" })
      ],
      afterDiagnostics: [diagnostic({ id: "after-1", fingerprint: "new" })],
      beforeExternalObservations: [],
      afterExternalObservations: [externalObservation()],
      windowHours: 24
    });

    expect(correlations).toEqual([
      {
        deploymentId: "deploy-1",
        commitRef: "abc123",
        deployedAt: "2026-06-22T00:00:00.000Z",
        windowHours: 24,
        relation: "correlated-not-causal",
        diagnosticDelta: 0,
        externalObservationDelta: 1,
        annotations: ["search templates changed"],
        summary:
          "Diagnostics changed by 0 and external observations changed by 1 within 24h of deployment deploy-1; this is correlation, not causation."
      }
    ]);
  });

  it("summarizes trends and detects anomaly spikes", () => {
    const points: TrendPoint[] = [
      trendPoint("2026-06-20", 12, 1),
      trendPoint("2026-06-21", 9, 0),
      trendPoint("2026-06-22", 20, 3)
    ];

    expect(summarizeTrends(points)).toEqual({
      firstDate: "2026-06-20",
      lastDate: "2026-06-22",
      diagnosticDelta: 8,
      blockerDelta: 2,
      direction: "worsening"
    });
    expect(detectTrendAnomalies(points, 5)).toEqual([
      {
        date: "2026-06-22",
        metric: "diagnostics",
        previousValue: 9,
        currentValue: 20,
        delta: 11,
        threshold: 5,
        summary:
          "diagnostics changed by 11 on 2026-06-22; investigate correlation before claiming causation."
      }
    ]);
  });

  it("maps trend points into metric events with project and environment dimensions", () => {
    const events = metricEventsFromTrendPoints({
      organizationId: "org-1",
      projectId: "project-1",
      environmentId: "env-1",
      points: [trendPoint("2026-06-22", 20, 3)]
    });

    expect(events.map((event) => event.name)).toEqual([
      "history.diagnostics",
      "history.blockers",
      "history.errors",
      "history.warnings",
      "history.infos"
    ]);
    expect(events[0]).toMatchObject({
      id: "metric-project-1-env-1-2026-06-22-diagnostics",
      occurredAt: "2026-06-22T00:00:00.000Z",
      dimensions: {
        projectId: "project-1",
        environmentId: "env-1"
      }
    });
  });
});

function deployment(): HistoryDeploymentRecord {
  return {
    id: "history-deployment-1",
    organizationId: "org-1",
    projectId: "project-1",
    environmentId: "env-1",
    deploymentId: "deploy-1",
    commitRef: "abc123",
    deployedAt: "2026-06-22T00:00:00.000Z",
    environmentName: "production",
    status: "released",
    annotations: ["search templates changed"]
  };
}

function snapshot(): HistoryPageSnapshotRecord {
  return {
    id: "snapshot-1",
    organizationId: "org-1",
    projectId: "project-1",
    environmentId: "env-1",
    pageUrl: "https://example.test/products/widget",
    capturedAt: "2026-06-22T00:10:00.000Z",
    artifactUri: "s3://searchlint-artifacts/snapshots/snapshot-1.json",
    diagnosticFingerprints: ["shared"]
  };
}

function diagnostic(
  overrides: Partial<DiagnosticRecord> = {}
): DiagnosticRecord {
  return {
    id: "diag-1",
    organizationId: "org-1",
    projectId: "project-1",
    environmentId: "env-1",
    ruleId: "SL-META-001",
    severity: "warning",
    confidence: "certain",
    pageUrl: "https://example.test/products/widget",
    source: "source-code",
    title: "Diagnostic title",
    evidence: "Diagnostic evidence",
    observedAt: "2026-06-22T00:20:00.000Z",
    fingerprint: "shared",
    deletionState: "active",
    createdAt: "2026-06-22T00:20:00.000Z",
    ...overrides
  };
}

function externalObservation(
  overrides: Partial<ExternalObservationRecord> = {}
): ExternalObservationRecord {
  return {
    id: "obs-1",
    organizationId: "org-1",
    projectId: "project-1",
    environmentId: "env-1",
    provider: "google",
    source: "google.searchAnalytics",
    subjectUrl: "https://example.test/products/widget",
    observedAt: "2026-06-22T00:30:00.000Z",
    fetchedAt: "2026-06-22T00:35:00.000Z",
    freshness: "fresh",
    payload: {
      clicks: 42
    },
    fingerprint:
      "google:org-1:project-1:env-1:google.searchAnalytics:https://example.test/products/widget",
    deletionState: "active",
    createdAt: "2026-06-22T00:35:00.000Z",
    ...overrides
  };
}

function trendPoint(
  date: string,
  diagnostics: number,
  blockers: number
): TrendPoint {
  return {
    date,
    diagnostics,
    blockers,
    errors: Math.max(0, diagnostics - blockers - 3),
    warnings: 3,
    infos: 0
  };
}
