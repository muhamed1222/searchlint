import type { DashboardSnapshotPayload } from "./types.js";

export type DashboardSnapshotSeverity =
  | "blocker"
  | "error"
  | "warning"
  | "info";

export type DashboardSnapshotConfidence = "certain" | "likely" | "heuristic";

export type DashboardSnapshotSource =
  | "source-code"
  | "raw-html"
  | "rendered-dom"
  | "http-header"
  | "robots-txt"
  | "sitemap"
  | "crawler"
  | "google"
  | "yandex";

export type DashboardSnapshotStructuredEvidence =
  | {
      type: "text";
      label: string;
      value: string;
    }
  | {
      type: "record";
      label: string;
      value: Readonly<Record<string, string | number | boolean | null>>;
    };

export type DashboardSnapshotSourceLocation = {
  confidence: "EXACT" | "RELATED" | "RUNTIME" | "EXTERNAL";
  file?: string;
  line?: number;
  selector?: string;
};

export type DashboardSnapshotDiagnostic = {
  id: string;
  ruleId: string;
  severity: DashboardSnapshotSeverity;
  confidence: DashboardSnapshotConfidence;
  pageUrl: string;
  route?: string;
  source: DashboardSnapshotSource;
  title: string;
  evidence: string;
  expected?: string;
  actual?: string;
  sourceLocation?: DashboardSnapshotSourceLocation;
  structuredEvidence?: readonly DashboardSnapshotStructuredEvidence[];
  observedAt: string;
  fingerprint: string;
};

export type DashboardSnapshotCrawlRun = {
  id: string;
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
  requestedAt: string;
  finishedAt?: string;
  crawledUrls: number;
  failedUrls: number;
};

export type DashboardSnapshotTrendPoint = {
  date: string;
  diagnostics: number;
  blockers: number;
  errors: number;
  warnings: number;
  infos: number;
};

export type DashboardSnapshotExternalObservation = {
  id: string;
  provider: "google" | "yandex";
  subjectUrl: string;
  status: "fresh" | "stale" | "missing";
  observedAt: string;
  fetchedAt: string;
  summary: string;
};

export type DashboardSnapshotReportSummary = {
  id: string;
  title: string;
  generatedAt: string;
  locale: string;
  totalDiagnostics: number;
};

export type DashboardSnapshotQuotaUsage = {
  label: string;
  used: number;
  limit: number;
};

export type DashboardSnapshotTeamMember = {
  principalId: string;
  displayName: string;
  role: "owner" | "admin" | "developer" | "viewer";
};

export type CreateDashboardSnapshotPayloadInput = {
  organization: {
    id: string;
    name: string;
  };
  project: {
    id: string;
    name: string;
    siteUrl: string;
  };
  environment: {
    id: string;
    name: string;
    baseUrl: string;
  };
  diagnostics?: readonly DashboardSnapshotDiagnostic[];
  crawlRuns?: readonly DashboardSnapshotCrawlRun[];
  trends?: readonly DashboardSnapshotTrendPoint[];
  externalObservations?: readonly DashboardSnapshotExternalObservation[];
  reports?: readonly DashboardSnapshotReportSummary[];
  quotas?: readonly DashboardSnapshotQuotaUsage[];
  teamMembers?: readonly DashboardSnapshotTeamMember[];
};

export type DashboardSnapshotMaterializationInput =
  CreateDashboardSnapshotPayloadInput & {
    id: string;
    materializedAt: string;
    retentionUntil?: string | null;
  };

const severityOrder: Readonly<Record<DashboardSnapshotSeverity, number>> = {
  blocker: 0,
  error: 1,
  warning: 2,
  info: 3
};

const teamRoleOrder: Readonly<
  Record<DashboardSnapshotTeamMember["role"], number>
> = {
  owner: 0,
  admin: 1,
  developer: 2,
  viewer: 3
};

export function createDashboardSnapshotPayload(
  input: CreateDashboardSnapshotPayloadInput
): DashboardSnapshotPayload {
  const diagnostics = [...(input.diagnostics ?? [])].sort(compareDiagnostics);
  const crawlRuns = [...(input.crawlRuns ?? [])].sort(compareCrawlRuns);
  const trends = [...(input.trends ?? deriveTrends(diagnostics))].sort(
    compareTrends
  );
  const externalObservations = [...(input.externalObservations ?? [])].sort(
    compareExternalObservations
  );
  const reports = [...(input.reports ?? [])].sort(compareReports);
  const quotas = [...(input.quotas ?? [])].sort(compareQuotas);
  const teamMembers = [...(input.teamMembers ?? [])].sort(compareTeamMembers);

  validateCounters({ crawlRuns, trends, reports, quotas });

  return {
    organization: input.organization,
    project: input.project,
    environment: input.environment,
    diagnostics,
    crawlRuns,
    trends,
    externalObservations,
    reports,
    quotas,
    teamMembers
  };
}

function deriveTrends(
  diagnostics: readonly DashboardSnapshotDiagnostic[]
): readonly DashboardSnapshotTrendPoint[] {
  const byDate = new Map<string, DashboardSnapshotTrendPoint>();

  for (const diagnostic of diagnostics) {
    const date = diagnostic.observedAt.slice(0, 10);
    const current =
      byDate.get(date) ??
      ({
        date,
        diagnostics: 0,
        blockers: 0,
        errors: 0,
        warnings: 0,
        infos: 0
      } satisfies DashboardSnapshotTrendPoint);

    current.diagnostics += 1;
    if (diagnostic.severity === "blocker") {
      current.blockers += 1;
    } else if (diagnostic.severity === "error") {
      current.errors += 1;
    } else if (diagnostic.severity === "warning") {
      current.warnings += 1;
    } else {
      current.infos += 1;
    }
    byDate.set(date, current);
  }

  return [...byDate.values()].sort(compareTrends);
}

function validateCounters(input: {
  crawlRuns: readonly DashboardSnapshotCrawlRun[];
  trends: readonly DashboardSnapshotTrendPoint[];
  reports: readonly DashboardSnapshotReportSummary[];
  quotas: readonly DashboardSnapshotQuotaUsage[];
}): void {
  for (const crawlRun of input.crawlRuns) {
    nonNegativeInteger(crawlRun.crawledUrls, "crawlRuns.crawledUrls");
    nonNegativeInteger(crawlRun.failedUrls, "crawlRuns.failedUrls");
  }
  for (const trend of input.trends) {
    nonNegativeInteger(trend.diagnostics, "trends.diagnostics");
    nonNegativeInteger(trend.blockers, "trends.blockers");
    nonNegativeInteger(trend.errors, "trends.errors");
    nonNegativeInteger(trend.warnings, "trends.warnings");
    nonNegativeInteger(trend.infos, "trends.infos");
  }
  for (const report of input.reports) {
    nonNegativeInteger(report.totalDiagnostics, "reports.totalDiagnostics");
  }
  for (const quota of input.quotas) {
    nonNegativeInteger(quota.used, "quotas.used");
    nonNegativeInteger(quota.limit, "quotas.limit");
  }
}

function nonNegativeInteger(value: number, field: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`Expected ${field} to be a non-negative integer.`);
  }
}

function compareDiagnostics(
  left: DashboardSnapshotDiagnostic,
  right: DashboardSnapshotDiagnostic
): number {
  return (
    severityOrder[left.severity] - severityOrder[right.severity] ||
    left.ruleId.localeCompare(right.ruleId) ||
    left.pageUrl.localeCompare(right.pageUrl) ||
    left.fingerprint.localeCompare(right.fingerprint)
  );
}

function compareCrawlRuns(
  left: DashboardSnapshotCrawlRun,
  right: DashboardSnapshotCrawlRun
): number {
  return (
    right.requestedAt.localeCompare(left.requestedAt) ||
    left.id.localeCompare(right.id)
  );
}

function compareTrends(
  left: DashboardSnapshotTrendPoint,
  right: DashboardSnapshotTrendPoint
): number {
  return left.date.localeCompare(right.date);
}

function compareExternalObservations(
  left: DashboardSnapshotExternalObservation,
  right: DashboardSnapshotExternalObservation
): number {
  return (
    left.provider.localeCompare(right.provider) ||
    left.subjectUrl.localeCompare(right.subjectUrl) ||
    right.observedAt.localeCompare(left.observedAt) ||
    left.id.localeCompare(right.id)
  );
}

function compareReports(
  left: DashboardSnapshotReportSummary,
  right: DashboardSnapshotReportSummary
): number {
  return (
    right.generatedAt.localeCompare(left.generatedAt) ||
    left.id.localeCompare(right.id)
  );
}

function compareQuotas(
  left: DashboardSnapshotQuotaUsage,
  right: DashboardSnapshotQuotaUsage
): number {
  return left.label.localeCompare(right.label);
}

function compareTeamMembers(
  left: DashboardSnapshotTeamMember,
  right: DashboardSnapshotTeamMember
): number {
  return (
    teamRoleOrder[left.role] - teamRoleOrder[right.role] ||
    left.displayName.localeCompare(right.displayName) ||
    left.principalId.localeCompare(right.principalId)
  );
}
