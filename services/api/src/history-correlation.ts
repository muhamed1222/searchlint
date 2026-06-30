import type {
  DiagnosticRecord,
  ExternalObservationRecord,
  MetricEvent
} from "./types.js";

export type HistoryDeploymentRecord = {
  id: string;
  organizationId: string;
  projectId: string;
  environmentId: string;
  deploymentId: string;
  commitRef: string;
  deployedAt: string;
  environmentName: string;
  status: "candidate" | "released" | "rolled-back" | "failed";
  annotations?: readonly string[];
};

export type HistoryPageSnapshotRecord = {
  id: string;
  organizationId: string;
  projectId: string;
  environmentId: string;
  pageUrl: string;
  capturedAt: string;
  artifactUri?: string;
  diagnosticFingerprints?: readonly string[];
};

export type HistoryTimelineEventKind =
  | "deployment"
  | "page-snapshot"
  | "diagnostic"
  | "external-observation";

export type HistoryTimelineEvent = {
  id: string;
  kind: HistoryTimelineEventKind;
  occurredAt: string;
  subject: string;
  summary: string;
  metadata: Readonly<Record<string, unknown>>;
};

export type DiagnosticBeforeAfterComparison = {
  previousLabel: string;
  currentLabel: string;
  newDiagnostics: number;
  resolvedDiagnostics: number;
  unchangedDiagnostics: number;
  severityDelta: Readonly<{
    blocker: number;
    error: number;
    warning: number;
    info: number;
  }>;
};

export type DeploymentCorrelation = {
  deploymentId: string;
  commitRef: string;
  deployedAt: string;
  windowHours: number;
  relation: "correlated-not-causal";
  diagnosticDelta: number;
  externalObservationDelta: number;
  annotations: readonly string[];
  summary: string;
};

export type TrendPoint = {
  date: string;
  diagnostics: number;
  blockers: number;
  errors: number;
  warnings: number;
  infos: number;
};

export type TrendSummary = {
  firstDate: string;
  lastDate: string;
  diagnosticDelta: number;
  blockerDelta: number;
  direction: "improving" | "worsening" | "flat";
};

export type TrendAnomaly = {
  date: string;
  metric: "diagnostics" | "blockers";
  previousValue: number;
  currentValue: number;
  delta: number;
  threshold: number;
  summary: string;
};

export function createHistoryTimeline(input: {
  deployments?: readonly HistoryDeploymentRecord[];
  pageSnapshots?: readonly HistoryPageSnapshotRecord[];
  diagnostics?: readonly DiagnosticRecord[];
  externalObservations?: readonly ExternalObservationRecord[];
}): readonly HistoryTimelineEvent[] {
  const events: HistoryTimelineEvent[] = [
    ...(input.deployments ?? []).map(deploymentEvent),
    ...(input.pageSnapshots ?? []).map(pageSnapshotEvent),
    ...(input.diagnostics ?? []).map(diagnosticEvent),
    ...(input.externalObservations ?? []).map(externalObservationEvent)
  ];
  return events.sort(compareTimelineEvents);
}

export function compareDiagnosticsBeforeAfter(input: {
  previousLabel: string;
  currentLabel: string;
  before: readonly DiagnosticRecord[];
  after: readonly DiagnosticRecord[];
}): DiagnosticBeforeAfterComparison {
  const beforeFingerprints = new Set(
    input.before.map((item) => item.fingerprint)
  );
  const afterFingerprints = new Set(
    input.after.map((item) => item.fingerprint)
  );
  const newDiagnostics = [...afterFingerprints].filter(
    (fingerprint) => !beforeFingerprints.has(fingerprint)
  ).length;
  const resolvedDiagnostics = [...beforeFingerprints].filter(
    (fingerprint) => !afterFingerprints.has(fingerprint)
  ).length;
  const unchangedDiagnostics = [...afterFingerprints].filter((fingerprint) =>
    beforeFingerprints.has(fingerprint)
  ).length;

  return {
    previousLabel: input.previousLabel,
    currentLabel: input.currentLabel,
    newDiagnostics,
    resolvedDiagnostics,
    unchangedDiagnostics,
    severityDelta: {
      blocker:
        severityCount(input.after, "blocker") -
        severityCount(input.before, "blocker"),
      error:
        severityCount(input.after, "error") -
        severityCount(input.before, "error"),
      warning:
        severityCount(input.after, "warning") -
        severityCount(input.before, "warning"),
      info:
        severityCount(input.after, "info") - severityCount(input.before, "info")
    }
  };
}

export function correlateDeployments(input: {
  deployments: readonly HistoryDeploymentRecord[];
  beforeDiagnostics: readonly DiagnosticRecord[];
  afterDiagnostics: readonly DiagnosticRecord[];
  beforeExternalObservations?: readonly ExternalObservationRecord[];
  afterExternalObservations?: readonly ExternalObservationRecord[];
  windowHours: number;
}): readonly DeploymentCorrelation[] {
  const comparison = compareDiagnosticsBeforeAfter({
    previousLabel: "before",
    currentLabel: "after",
    before: input.beforeDiagnostics,
    after: input.afterDiagnostics
  });
  const diagnosticDelta =
    comparison.newDiagnostics - comparison.resolvedDiagnostics;
  const externalObservationDelta =
    (input.afterExternalObservations ?? []).length -
    (input.beforeExternalObservations ?? []).length;

  return [...input.deployments].sort(compareDeployments).map((deployment) => ({
    deploymentId: deployment.deploymentId,
    commitRef: deployment.commitRef,
    deployedAt: deployment.deployedAt,
    windowHours: input.windowHours,
    relation: "correlated-not-causal" as const,
    diagnosticDelta,
    externalObservationDelta,
    annotations: deployment.annotations ?? [],
    summary: `Diagnostics changed by ${diagnosticDelta} and external observations changed by ${externalObservationDelta} within ${input.windowHours}h of deployment ${deployment.deploymentId}; this is correlation, not causation.`
  }));
}

export function summarizeTrends(points: readonly TrendPoint[]): TrendSummary {
  if (points.length === 0) {
    throw new Error("At least one trend point is required.");
  }
  const sorted = [...points].sort((left, right) =>
    left.date.localeCompare(right.date)
  );
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  const diagnosticDelta = last.diagnostics - first.diagnostics;
  const blockerDelta = last.blockers - first.blockers;
  return {
    firstDate: first.date,
    lastDate: last.date,
    diagnosticDelta,
    blockerDelta,
    direction:
      diagnosticDelta < 0
        ? "improving"
        : diagnosticDelta > 0
          ? "worsening"
          : "flat"
  };
}

export function detectTrendAnomalies(
  points: readonly TrendPoint[],
  threshold: number
): readonly TrendAnomaly[] {
  const sorted = [...points].sort((left, right) =>
    left.date.localeCompare(right.date)
  );
  const anomalies: TrendAnomaly[] = [];
  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1]!;
    const current = sorted[index]!;
    addAnomaly(anomalies, {
      date: current.date,
      metric: "diagnostics",
      previousValue: previous.diagnostics,
      currentValue: current.diagnostics,
      threshold
    });
    addAnomaly(anomalies, {
      date: current.date,
      metric: "blockers",
      previousValue: previous.blockers,
      currentValue: current.blockers,
      threshold
    });
  }
  return anomalies;
}

export function metricEventsFromTrendPoints(input: {
  organizationId: string;
  projectId: string;
  environmentId: string;
  points: readonly TrendPoint[];
}): readonly MetricEvent[] {
  return input.points.flatMap((point) =>
    (
      [
        ["diagnostics", point.diagnostics],
        ["blockers", point.blockers],
        ["errors", point.errors],
        ["warnings", point.warnings],
        ["infos", point.infos]
      ] as const
    ).map(([name, value]) => ({
      id: `metric-${input.projectId}-${input.environmentId}-${point.date}-${name}`,
      organizationId: input.organizationId,
      name: `history.${name}`,
      value,
      occurredAt: `${point.date}T00:00:00.000Z`,
      dimensions: {
        projectId: input.projectId,
        environmentId: input.environmentId
      }
    }))
  );
}

function deploymentEvent(
  deployment: HistoryDeploymentRecord
): HistoryTimelineEvent {
  return {
    id: deployment.id,
    kind: "deployment",
    occurredAt: deployment.deployedAt,
    subject: deployment.deploymentId,
    summary: `Deployment ${deployment.deploymentId} at ${deployment.commitRef}`,
    metadata: {
      commitRef: deployment.commitRef,
      status: deployment.status,
      environmentName: deployment.environmentName,
      annotations: deployment.annotations ?? []
    }
  };
}

function pageSnapshotEvent(
  snapshot: HistoryPageSnapshotRecord
): HistoryTimelineEvent {
  return {
    id: snapshot.id,
    kind: "page-snapshot",
    occurredAt: snapshot.capturedAt,
    subject: snapshot.pageUrl,
    summary: `Page snapshot captured for ${snapshot.pageUrl}`,
    metadata: {
      artifactUri: snapshot.artifactUri,
      diagnosticFingerprints: snapshot.diagnosticFingerprints ?? []
    }
  };
}

function diagnosticEvent(diagnostic: DiagnosticRecord): HistoryTimelineEvent {
  return {
    id: diagnostic.id,
    kind: "diagnostic",
    occurredAt: diagnostic.observedAt,
    subject: diagnostic.pageUrl,
    summary: `${diagnostic.severity} ${diagnostic.ruleId}: ${diagnostic.title}`,
    metadata: {
      ruleId: diagnostic.ruleId,
      severity: diagnostic.severity,
      fingerprint: diagnostic.fingerprint
    }
  };
}

function externalObservationEvent(
  observation: ExternalObservationRecord
): HistoryTimelineEvent {
  return {
    id: observation.id,
    kind: "external-observation",
    occurredAt: observation.observedAt,
    subject: observation.subjectUrl,
    summary: `${observation.provider} ${observation.source} observation`,
    metadata: {
      provider: observation.provider,
      source: observation.source,
      freshness: observation.freshness,
      fingerprint: observation.fingerprint
    }
  };
}

function compareTimelineEvents(
  left: HistoryTimelineEvent,
  right: HistoryTimelineEvent
): number {
  const timeOrder = left.occurredAt.localeCompare(right.occurredAt);
  if (timeOrder !== 0) {
    return timeOrder;
  }
  const kindOrder = left.kind.localeCompare(right.kind);
  if (kindOrder !== 0) {
    return kindOrder;
  }
  return left.id.localeCompare(right.id);
}

function compareDeployments(
  left: HistoryDeploymentRecord,
  right: HistoryDeploymentRecord
): number {
  const timeOrder = left.deployedAt.localeCompare(right.deployedAt);
  return timeOrder === 0 ? left.id.localeCompare(right.id) : timeOrder;
}

function severityCount(
  diagnostics: readonly DiagnosticRecord[],
  severity: DiagnosticRecord["severity"]
): number {
  return diagnostics.filter((diagnostic) => diagnostic.severity === severity)
    .length;
}

function addAnomaly(
  anomalies: TrendAnomaly[],
  input: {
    date: string;
    metric: TrendAnomaly["metric"];
    previousValue: number;
    currentValue: number;
    threshold: number;
  }
): void {
  const delta = input.currentValue - input.previousValue;
  if (Math.abs(delta) < input.threshold) {
    return;
  }
  anomalies.push({
    date: input.date,
    metric: input.metric,
    previousValue: input.previousValue,
    currentValue: input.currentValue,
    delta,
    threshold: input.threshold,
    summary: `${input.metric} changed by ${delta} on ${input.date}; investigate correlation before claiming causation.`
  });
}
