import type {
  DashboardSnapshotCrawlRun,
  DashboardSnapshotDiagnostic,
  DashboardSnapshotExternalObservation,
  DashboardSnapshotMaterializationInput,
  DashboardSnapshotQuotaUsage,
  DashboardSnapshotReportSummary,
  DashboardSnapshotSourceLocation,
  DashboardSnapshotStructuredEvidence,
  DashboardSnapshotTeamMember
} from "./dashboard-snapshot-materialization.js";
import {
  selectDashboardCrawlRunsSql,
  selectDashboardDiagnosticsSql,
  selectDashboardReportArtifactsSql,
  selectEnvironmentSql,
  selectExternalObservationsSql,
  selectOrganizationEntitlementSql,
  selectOrganizationMembershipsSql,
  selectOrganizationSql,
  selectProjectSql,
  selectUsageCounterSql
} from "./postgres-repository-sql.js";
import type { PostgresQueryExecutor } from "./postgres-relational-store.js";

export type DashboardSnapshotSourceLoadInput = {
  id: string;
  organizationId: string;
  projectId: string;
  environmentId: string;
  materializedAt: string;
  retentionUntil?: string | null;
  diagnosticLimit?: number;
  crawlRunLimit?: number;
  reportLimit?: number;
  externalObservationLimit?: number;
};

export type PostgresDashboardSnapshotSourceLoader = {
  loadDashboardSnapshotSource(
    input: DashboardSnapshotSourceLoadInput
  ): Promise<DashboardSnapshotMaterializationInput | undefined>;
};

type OrganizationRow = {
  id: unknown;
  name: unknown;
};

type ProjectRow = {
  id: unknown;
  organization_id: unknown;
  name: unknown;
  site_url: unknown;
};

type EnvironmentRow = {
  id: unknown;
  organization_id: unknown;
  project_id: unknown;
  name: unknown;
  base_url: unknown;
};

type CrawlRunRow = {
  id: unknown;
  status: unknown;
  created_at: unknown;
  completed_at?: unknown;
  failed_at?: unknown;
  crawled_urls?: unknown;
  failed_urls?: unknown;
};

type DiagnosticRow = {
  id: unknown;
  rule_id: unknown;
  severity: unknown;
  confidence: unknown;
  page_url: unknown;
  route?: unknown;
  source: unknown;
  title: unknown;
  evidence: unknown;
  expected?: unknown;
  actual?: unknown;
  source_location?: unknown;
  structured_evidence?: unknown;
  observed_at: unknown;
  fingerprint: unknown;
};

type ReportArtifactRow = {
  id: unknown;
  report_kind: unknown;
  generated_at: unknown;
};

type ExternalObservationRow = {
  id: unknown;
  provider: unknown;
  source: unknown;
  subject_url: unknown;
  observed_at: unknown;
  fetched_at: unknown;
  freshness: unknown;
  quota?: unknown;
  sampling?: unknown;
};

type MembershipRow = {
  principal_id: unknown;
  role: unknown;
};

type EntitlementRow = {
  current_period_start: unknown;
  monthly_crawled_urls_limit: unknown;
  external_api_monthly_limit: unknown;
};

type UsageCounterRow = {
  used: unknown;
};

const defaultDiagnosticLimit = 500;
const defaultCrawlRunLimit = 20;
const defaultReportLimit = 20;
const defaultExternalObservationLimit = 100;

export function createPostgresDashboardSnapshotSourceLoader(
  executor: PostgresQueryExecutor
): PostgresDashboardSnapshotSourceLoader {
  return {
    async loadDashboardSnapshotSource(input) {
      const diagnosticLimit = positiveLimit(
        input.diagnosticLimit ?? defaultDiagnosticLimit,
        "diagnosticLimit"
      );
      const crawlRunLimit = positiveLimit(
        input.crawlRunLimit ?? defaultCrawlRunLimit,
        "crawlRunLimit"
      );
      const reportLimit = positiveLimit(
        input.reportLimit ?? defaultReportLimit,
        "reportLimit"
      );
      const externalObservationLimit = positiveLimit(
        input.externalObservationLimit ?? defaultExternalObservationLimit,
        "externalObservationLimit"
      );

      const organization = (
        await executor.query<OrganizationRow>(
          selectOrganizationSql(input.organizationId)
        )
      ).rows[0];
      if (!organization) {
        return undefined;
      }

      const project = (
        await executor.query<ProjectRow>(
          selectProjectSql(input.organizationId, input.projectId)
        )
      ).rows[0];
      if (!project) {
        return undefined;
      }

      const environment = (
        await executor.query<EnvironmentRow>(
          selectEnvironmentSql(input.organizationId, input.environmentId)
        )
      ).rows[0];
      if (!environment) {
        return undefined;
      }
      if (text(environment.project_id, "project_id") !== input.projectId) {
        return undefined;
      }

      const diagnostics = (
        await executor.query<DiagnosticRow>(
          selectDashboardDiagnosticsSql({
            organizationId: input.organizationId,
            projectId: input.projectId,
            environmentId: input.environmentId,
            limit: diagnosticLimit
          })
        )
      ).rows.map(diagnosticFromRow);

      const crawlRuns = (
        await executor.query<CrawlRunRow>(
          selectDashboardCrawlRunsSql({
            organizationId: input.organizationId,
            projectId: input.projectId,
            environmentId: input.environmentId,
            limit: crawlRunLimit
          })
        )
      ).rows.map(crawlRunFromRow);

      const reports = (
        await executor.query<ReportArtifactRow>(
          selectDashboardReportArtifactsSql({
            organizationId: input.organizationId,
            projectId: input.projectId,
            environmentId: input.environmentId,
            limit: reportLimit
          })
        )
      ).rows.map(reportFromRow);

      const externalObservations = (
        await executor.query<ExternalObservationRow>(
          selectExternalObservationsSql({
            organizationId: input.organizationId,
            projectId: input.projectId,
            environmentId: input.environmentId,
            limit: externalObservationLimit
          })
        )
      ).rows.map(externalObservationFromRow);

      const teamMembers = (
        await executor.query<MembershipRow>(
          selectOrganizationMembershipsSql({
            organizationId: input.organizationId
          })
        )
      ).rows.map(teamMemberFromRow);

      const quotas = await quotaUsage(executor, input.organizationId);

      return {
        id: input.id,
        materializedAt: input.materializedAt,
        ...(input.retentionUntil === undefined
          ? {}
          : { retentionUntil: input.retentionUntil }),
        organization: {
          id: text(organization.id, "organization.id"),
          name: text(organization.name, "organization.name")
        },
        project: {
          id: text(project.id, "project.id"),
          name: text(project.name, "project.name"),
          siteUrl: text(project.site_url, "project.site_url")
        },
        environment: {
          id: text(environment.id, "environment.id"),
          name: text(environment.name, "environment.name"),
          baseUrl: text(environment.base_url, "environment.base_url")
        },
        diagnostics,
        crawlRuns,
        externalObservations,
        reports,
        quotas,
        teamMembers
      };
    }
  };
}

function diagnosticFromRow(row: DiagnosticRow): DashboardSnapshotDiagnostic {
  const diagnostic: DashboardSnapshotDiagnostic = {
    id: text(row.id, "diagnostic.id"),
    ruleId: text(row.rule_id, "rule_id"),
    severity: severity(row.severity),
    confidence: confidence(row.confidence),
    pageUrl: text(row.page_url, "page_url"),
    source: source(row.source),
    title: text(row.title, "title"),
    evidence: text(row.evidence, "evidence"),
    observedAt: text(row.observed_at, "observed_at"),
    fingerprint: text(row.fingerprint, "fingerprint")
  };
  const route = optionalText(row.route, "route");
  const expected = optionalText(row.expected, "expected");
  const actual = optionalText(row.actual, "actual");
  const sourceLocation = optionalSourceLocation(row.source_location);
  const structuredEvidence = optionalStructuredEvidence(
    row.structured_evidence
  );
  if (route !== undefined) {
    diagnostic.route = route;
  }
  if (expected !== undefined) {
    diagnostic.expected = expected;
  }
  if (actual !== undefined) {
    diagnostic.actual = actual;
  }
  if (sourceLocation !== undefined) {
    diagnostic.sourceLocation = sourceLocation;
  }
  if (structuredEvidence !== undefined) {
    diagnostic.structuredEvidence = structuredEvidence;
  }
  return diagnostic;
}

function crawlRunFromRow(row: CrawlRunRow): DashboardSnapshotCrawlRun {
  const crawlRun: DashboardSnapshotCrawlRun = {
    id: text(row.id, "crawl.id"),
    status: crawlStatus(row.status),
    requestedAt: text(row.created_at, "crawl.created_at"),
    crawledUrls: optionalNonNegativeInteger(row.crawled_urls, "crawled_urls"),
    failedUrls: optionalNonNegativeInteger(row.failed_urls, "failed_urls")
  };
  const finishedAt =
    optionalText(row.completed_at, "completed_at") ??
    optionalText(row.failed_at, "failed_at");
  if (finishedAt !== undefined) {
    crawlRun.finishedAt = finishedAt;
  }
  return crawlRun;
}

function severity(value: unknown): DashboardSnapshotDiagnostic["severity"] {
  const diagnosticSeverity = text(value, "severity");
  if (
    diagnosticSeverity === "blocker" ||
    diagnosticSeverity === "error" ||
    diagnosticSeverity === "warning" ||
    diagnosticSeverity === "info"
  ) {
    return diagnosticSeverity;
  }
  throw new Error(`Unsupported diagnostic severity ${diagnosticSeverity}.`);
}

function confidence(value: unknown): DashboardSnapshotDiagnostic["confidence"] {
  const diagnosticConfidence = text(value, "confidence");
  if (
    diagnosticConfidence === "certain" ||
    diagnosticConfidence === "likely" ||
    diagnosticConfidence === "heuristic"
  ) {
    return diagnosticConfidence;
  }
  throw new Error(`Unsupported diagnostic confidence ${diagnosticConfidence}.`);
}

function source(value: unknown): DashboardSnapshotDiagnostic["source"] {
  const diagnosticSource = text(value, "source");
  if (
    diagnosticSource === "source-code" ||
    diagnosticSource === "raw-html" ||
    diagnosticSource === "rendered-dom" ||
    diagnosticSource === "http-header" ||
    diagnosticSource === "robots-txt" ||
    diagnosticSource === "sitemap" ||
    diagnosticSource === "crawler" ||
    diagnosticSource === "google" ||
    diagnosticSource === "yandex"
  ) {
    return diagnosticSource;
  }
  throw new Error(`Unsupported diagnostic source ${diagnosticSource}.`);
}

function optionalSourceLocation(
  value: unknown
): DashboardSnapshotSourceLocation | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Expected source_location to be a JSON object.");
  }
  const record = value as Readonly<Record<string, unknown>>;
  const confidenceValue = text(record.confidence, "source_location.confidence");
  if (
    confidenceValue !== "EXACT" &&
    confidenceValue !== "RELATED" &&
    confidenceValue !== "RUNTIME" &&
    confidenceValue !== "EXTERNAL"
  ) {
    throw new Error(
      `Unsupported source location confidence ${confidenceValue}.`
    );
  }
  const location: DashboardSnapshotSourceLocation = {
    confidence: confidenceValue
  };
  const file = optionalText(record.file, "source_location.file");
  const selector = optionalText(record.selector, "source_location.selector");
  if (file !== undefined) {
    location.file = file;
  }
  if (selector !== undefined) {
    location.selector = selector;
  }
  if (record.line !== null && record.line !== undefined) {
    location.line = positiveInteger(record.line, "source_location.line");
  }
  return location;
}

function optionalStructuredEvidence(
  value: unknown
): readonly DashboardSnapshotStructuredEvidence[] | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    throw new Error("Expected structured_evidence to be a JSON array.");
  }
  return value.map((entry) => structuredEvidenceEntry(entry));
}

function structuredEvidenceEntry(
  value: unknown
): DashboardSnapshotStructuredEvidence {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Expected structured evidence entries to be JSON objects.");
  }
  const record = value as Readonly<Record<string, unknown>>;
  const type = text(record.type, "structured_evidence.type");
  const label = text(record.label, "structured_evidence.label");
  if (type === "text") {
    return {
      type,
      label,
      value: text(record.value, "structured_evidence.value")
    };
  }
  if (type === "record") {
    return {
      type,
      label,
      value: structuredEvidenceRecord(record.value)
    };
  }
  throw new Error(`Unsupported structured evidence type ${type}.`);
}

function structuredEvidenceRecord(
  value: unknown
): Readonly<Record<string, string | number | boolean | null>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(
      "Expected structured evidence record value to be an object."
    );
  }
  for (const entry of Object.values(value)) {
    if (
      entry !== null &&
      typeof entry !== "string" &&
      typeof entry !== "number" &&
      typeof entry !== "boolean"
    ) {
      throw new Error(
        "Expected structured evidence record values to be scalar JSON values."
      );
    }
  }
  return value as Readonly<Record<string, string | number | boolean | null>>;
}

function reportFromRow(row: ReportArtifactRow): DashboardSnapshotReportSummary {
  const kind = text(row.report_kind, "report_kind");
  return {
    id: text(row.id, "report.id"),
    title: `${kind} report`,
    generatedAt: text(row.generated_at, "generated_at"),
    locale: "en",
    totalDiagnostics: 0
  };
}

function externalObservationFromRow(
  row: ExternalObservationRow
): DashboardSnapshotExternalObservation {
  const providerValue = provider(row.provider);
  const sourceValue = sourceForProvider(row.source, providerValue);
  const freshnessValue = freshness(row.freshness);
  const quota = optionalObject(row.quota, "external_observation.quota");
  const sampling = optionalObject(
    row.sampling,
    "external_observation.sampling"
  );

  return {
    id: text(row.id, "external_observation.id"),
    provider: providerValue,
    subjectUrl: text(row.subject_url, "external_observation.subject_url"),
    status: observationStatus(freshnessValue),
    observedAt: text(row.observed_at, "external_observation.observed_at"),
    fetchedAt: text(row.fetched_at, "external_observation.fetched_at"),
    summary: externalObservationSummary({
      provider: providerValue,
      source: sourceValue,
      freshness: freshnessValue,
      quota,
      sampling
    })
  };
}

function teamMemberFromRow(row: MembershipRow): DashboardSnapshotTeamMember {
  const principalId = text(row.principal_id, "principal_id");
  return {
    principalId,
    displayName: principalId,
    role: dashboardRole(row.role)
  };
}

async function quotaUsage(
  executor: PostgresQueryExecutor,
  organizationId: string
): Promise<readonly DashboardSnapshotQuotaUsage[]> {
  const entitlement = (
    await executor.query<EntitlementRow>(
      selectOrganizationEntitlementSql(organizationId)
    )
  ).rows[0];

  if (!entitlement) {
    return [];
  }

  const periodStart = text(
    entitlement.current_period_start,
    "current_period_start"
  );
  const crawlUsed = await usedCounter(executor, {
    organizationId,
    counterName: "crawl.urls",
    periodStart
  });
  const externalApiUsed = await usedCounter(executor, {
    organizationId,
    counterName: "external_api.inspections",
    periodStart
  });

  return [
    {
      label: "Crawled URLs",
      used: crawlUsed,
      limit: positiveInteger(
        entitlement.monthly_crawled_urls_limit,
        "monthly_crawled_urls_limit"
      )
    },
    {
      label: "External API inspections",
      used: externalApiUsed,
      limit: positiveInteger(
        entitlement.external_api_monthly_limit,
        "external_api_monthly_limit"
      )
    }
  ];
}

async function usedCounter(
  executor: PostgresQueryExecutor,
  input: {
    organizationId: string;
    counterName: string;
    periodStart: string;
  }
): Promise<number> {
  const counter = (
    await executor.query<UsageCounterRow>(selectUsageCounterSql(input))
  ).rows[0];
  return counter ? nonNegativeInteger(counter.used, "used") : 0;
}

function externalObservationSummary(input: {
  provider: DashboardSnapshotExternalObservation["provider"];
  source: string;
  freshness: string;
  quota: Readonly<Record<string, unknown>> | undefined;
  sampling: Readonly<Record<string, unknown>> | undefined;
}): string {
  const parts = [
    `${providerLabel(input.provider)} ${input.source} observation is ${input.freshness}.`
  ];
  const quotaText = quotaSummary(input.quota);
  if (quotaText) {
    parts.push(quotaText);
  }
  const samplingText = samplingSummary(input.sampling);
  if (samplingText) {
    parts.push(samplingText);
  }
  return parts.join(" ");
}

function quotaSummary(
  quota: Readonly<Record<string, unknown>> | undefined
): string | undefined {
  if (!quota) {
    return undefined;
  }
  const remaining = optionalQuotaNumber(
    quota.remaining,
    "external_observation.quota.remaining"
  );
  const limit = optionalQuotaNumber(
    quota.limit,
    "external_observation.quota.limit"
  );
  const resetAt = optionalText(
    quota.resetAt,
    "external_observation.quota.resetAt"
  );
  const counters =
    remaining !== undefined && limit !== undefined
      ? `quota ${remaining}/${limit} remaining`
      : remaining !== undefined
        ? `quota remaining ${remaining}`
        : limit !== undefined
          ? `quota limit ${limit}`
          : undefined;
  if (counters && resetAt) {
    return `${counters}; resets ${resetAt}.`;
  }
  if (counters) {
    return `${counters}.`;
  }
  if (resetAt) {
    return `quota resets ${resetAt}.`;
  }
  return undefined;
}

function samplingSummary(
  sampling: Readonly<Record<string, unknown>> | undefined
): string | undefined {
  if (!sampling) {
    return undefined;
  }
  const sampled = boolean(
    sampling.sampled,
    "external_observation.sampling.sampled"
  );
  const state = optionalText(
    sampling.state,
    "external_observation.sampling.state"
  );
  if (state) {
    return sampled ? `sampled data: ${state}.` : `unsampled data: ${state}.`;
  }
  return sampled ? "sampled data." : "unsampled data.";
}

function crawlStatus(value: unknown): DashboardSnapshotCrawlRun["status"] {
  const status = text(value, "status");
  if (
    status === "queued" ||
    status === "running" ||
    status === "succeeded" ||
    status === "failed" ||
    status === "cancelled"
  ) {
    return status;
  }
  throw new Error(`Unsupported crawl status ${status}.`);
}

function dashboardRole(value: unknown): DashboardSnapshotTeamMember["role"] {
  const role = text(value, "role");
  if (role === "owner" || role === "admin" || role === "developer") {
    return role;
  }
  if (role === "analyst" || role === "client") {
    return "viewer";
  }
  throw new Error(`Unsupported organization role ${role}.`);
}

function provider(
  value: unknown
): DashboardSnapshotExternalObservation["provider"] {
  const providerValue = text(value, "external_observation.provider");
  if (providerValue === "google" || providerValue === "yandex") {
    return providerValue;
  }
  throw new Error(
    `Unsupported external observation provider ${providerValue}.`
  );
}

function sourceForProvider(
  value: unknown,
  providerValue: DashboardSnapshotExternalObservation["provider"]
): string {
  const sourceValue = text(value, "external_observation.source");
  if (!sourceValue.startsWith(`${providerValue}.`)) {
    throw new Error("External observation source must match provider.");
  }
  return sourceValue;
}

function freshness(value: unknown): string {
  const freshnessValue = text(value, "external_observation.freshness");
  if (
    freshnessValue === "fresh" ||
    freshnessValue === "stale" ||
    freshnessValue === "expired" ||
    freshnessValue === "unknown"
  ) {
    return freshnessValue;
  }
  throw new Error(
    `Unsupported external observation freshness ${freshnessValue}.`
  );
}

function observationStatus(
  freshnessValue: string
): DashboardSnapshotExternalObservation["status"] {
  if (freshnessValue === "fresh") {
    return "fresh";
  }
  if (freshnessValue === "stale") {
    return "stale";
  }
  return "missing";
}

function providerLabel(
  providerValue: DashboardSnapshotExternalObservation["provider"]
): string {
  return providerValue === "google" ? "Google" : "Yandex";
}

function optionalObject(
  value: unknown,
  field: string
): Readonly<Record<string, unknown>> | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Expected ${field} to be a JSON object when present.`);
  }
  return value as Readonly<Record<string, unknown>>;
}

function boolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`Expected ${field} to be a boolean.`);
  }
  return value;
}

function positiveLimit(value: number, field: string): number {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${field} must be a positive integer.`);
  }
  return value;
}

function text(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Expected ${field} to be a non-empty string.`);
  }
  return value;
}

function optionalText(value: unknown, field: string): string | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  return text(value, field);
}

function positiveInteger(value: unknown, field: string): number {
  if (!Number.isInteger(value) || (value as number) < 1) {
    throw new Error(`Expected ${field} to be a positive integer.`);
  }
  return value as number;
}

function nonNegativeInteger(value: unknown, field: string): number {
  if (!Number.isInteger(value) || (value as number) < 0) {
    throw new Error(`Expected ${field} to be a non-negative integer.`);
  }
  return value as number;
}

function optionalNonNegativeInteger(value: unknown, field: string): number {
  if (value === null || value === undefined) {
    return 0;
  }
  return nonNegativeInteger(value, field);
}

function optionalQuotaNumber(
  value: unknown,
  field: string
): number | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  return nonNegativeInteger(value, field);
}
