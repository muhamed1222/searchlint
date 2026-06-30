import { describe, expect, it } from "vitest";

import {
  createPostgresDashboardSnapshotSourceLoader,
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
} from "../src/index.js";
import type {
  PostgresQuery,
  PostgresQueryExecutor,
  PostgresQueryResult
} from "../src/index.js";

const materializedAt = "2026-06-21T00:00:00.000Z";

describe("createPostgresDashboardSnapshotSourceLoader", () => {
  it("loads existing PostgreSQL source rows into materialization input", async () => {
    const executor = new FakeExecutor([
      organizationRow(),
      projectRow(),
      environmentRow(),
      [
        {
          id: "diagnostic-1",
          rule_id: "SL-TEST-001",
          severity: "error",
          confidence: "certain",
          page_url: "https://example.test/",
          route: "/",
          source: "crawler",
          title: "Diagnostic",
          evidence: "Evidence",
          expected: "Expected",
          actual: "Actual",
          source_location: {
            confidence: "EXACT",
            file: "app/page.tsx",
            line: 12
          },
          structured_evidence: [
            {
              type: "record",
              label: "Head",
              value: {
                selector: "title",
                found: false
              }
            }
          ],
          observed_at: "2026-06-20T00:00:00.000Z",
          fingerprint: "fingerprint-1"
        }
      ],
      [
        {
          id: "crawl-1",
          status: "succeeded",
          created_at: "2026-06-20T00:00:00.000Z",
          completed_at: "2026-06-20T00:05:00.000Z",
          crawled_urls: 42,
          failed_urls: 2
        }
      ],
      [
        {
          id: "report-1",
          report_kind: "developer",
          generated_at: "2026-06-20T01:00:00.000Z"
        }
      ],
      [
        {
          id: "google-observation-1",
          provider: "google",
          source: "google.urlInspection",
          subject_url: "https://example.test/",
          observed_at: "2026-06-20T02:00:00.000Z",
          fetched_at: "2026-06-20T02:01:00.000Z",
          freshness: "fresh",
          quota: {
            remaining: 199,
            limit: 200,
            resetAt: "2026-06-21T00:00:00.000Z"
          },
          sampling: {
            sampled: false
          }
        },
        {
          id: "yandex-observation-1",
          provider: "yandex",
          source: "yandex.metrica",
          subject_url: "https://example.test/about",
          observed_at: "2026-06-19T02:00:00.000Z",
          fetched_at: "2026-06-20T02:01:00.000Z",
          freshness: "stale",
          quota: null,
          sampling: {
            sampled: true,
            state: "sampled"
          }
        }
      ],
      [
        {
          principal_id: "principal-owner",
          role: "owner"
        },
        {
          principal_id: "principal-client",
          role: "client"
        }
      ],
      [
        {
          current_period_start: "2026-06-01T00:00:00.000Z",
          monthly_crawled_urls_limit: 1000,
          external_api_monthly_limit: 100
        }
      ],
      [
        {
          used: 250
        }
      ],
      [
        {
          used: 10
        }
      ]
    ]);
    const loader = createPostgresDashboardSnapshotSourceLoader(executor);

    await expect(
      loader.loadDashboardSnapshotSource({
        id: "snapshot-1",
        organizationId: "org-1",
        projectId: "project-1",
        environmentId: "env-1",
        materializedAt,
        retentionUntil: "2026-09-21T00:00:00.000Z",
        diagnosticLimit: 500,
        crawlRunLimit: 10,
        reportLimit: 5,
        externalObservationLimit: 25
      })
    ).resolves.toEqual({
      id: "snapshot-1",
      materializedAt,
      retentionUntil: "2026-09-21T00:00:00.000Z",
      organization: {
        id: "org-1",
        name: "Acme"
      },
      project: {
        id: "project-1",
        name: "Marketing",
        siteUrl: "https://example.test"
      },
      environment: {
        id: "env-1",
        name: "Production",
        baseUrl: "https://example.test"
      },
      diagnostics: [
        {
          id: "diagnostic-1",
          ruleId: "SL-TEST-001",
          severity: "error",
          confidence: "certain",
          pageUrl: "https://example.test/",
          route: "/",
          source: "crawler",
          title: "Diagnostic",
          evidence: "Evidence",
          expected: "Expected",
          actual: "Actual",
          sourceLocation: {
            confidence: "EXACT",
            file: "app/page.tsx",
            line: 12
          },
          structuredEvidence: [
            {
              type: "record",
              label: "Head",
              value: {
                selector: "title",
                found: false
              }
            }
          ],
          observedAt: "2026-06-20T00:00:00.000Z",
          fingerprint: "fingerprint-1"
        }
      ],
      crawlRuns: [
        {
          id: "crawl-1",
          status: "succeeded",
          requestedAt: "2026-06-20T00:00:00.000Z",
          finishedAt: "2026-06-20T00:05:00.000Z",
          crawledUrls: 42,
          failedUrls: 2
        }
      ],
      externalObservations: [
        {
          id: "google-observation-1",
          provider: "google",
          subjectUrl: "https://example.test/",
          status: "fresh",
          observedAt: "2026-06-20T02:00:00.000Z",
          fetchedAt: "2026-06-20T02:01:00.000Z",
          summary:
            "Google google.urlInspection observation is fresh. quota 199/200 remaining; resets 2026-06-21T00:00:00.000Z. unsampled data."
        },
        {
          id: "yandex-observation-1",
          provider: "yandex",
          subjectUrl: "https://example.test/about",
          status: "stale",
          observedAt: "2026-06-19T02:00:00.000Z",
          fetchedAt: "2026-06-20T02:01:00.000Z",
          summary:
            "Yandex yandex.metrica observation is stale. sampled data: sampled."
        }
      ],
      reports: [
        {
          id: "report-1",
          title: "developer report",
          generatedAt: "2026-06-20T01:00:00.000Z",
          locale: "en",
          totalDiagnostics: 0
        }
      ],
      quotas: [
        {
          label: "Crawled URLs",
          used: 250,
          limit: 1000
        },
        {
          label: "External API inspections",
          used: 10,
          limit: 100
        }
      ],
      teamMembers: [
        {
          principalId: "principal-owner",
          displayName: "principal-owner",
          role: "owner"
        },
        {
          principalId: "principal-client",
          displayName: "principal-client",
          role: "viewer"
        }
      ]
    });
    expect(executor.queries).toEqual([
      selectOrganizationSql("org-1"),
      selectProjectSql("org-1", "project-1"),
      selectEnvironmentSql("org-1", "env-1"),
      selectDashboardDiagnosticsSql({
        organizationId: "org-1",
        projectId: "project-1",
        environmentId: "env-1",
        limit: 500
      }),
      selectDashboardCrawlRunsSql({
        organizationId: "org-1",
        projectId: "project-1",
        environmentId: "env-1",
        limit: 10
      }),
      selectDashboardReportArtifactsSql({
        organizationId: "org-1",
        projectId: "project-1",
        environmentId: "env-1",
        limit: 5
      }),
      selectExternalObservationsSql({
        organizationId: "org-1",
        projectId: "project-1",
        environmentId: "env-1",
        limit: 25
      }),
      selectOrganizationMembershipsSql({
        organizationId: "org-1"
      }),
      selectOrganizationEntitlementSql("org-1"),
      selectUsageCounterSql({
        organizationId: "org-1",
        counterName: "crawl.urls",
        periodStart: "2026-06-01T00:00:00.000Z"
      }),
      selectUsageCounterSql({
        organizationId: "org-1",
        counterName: "external_api.inspections",
        periodStart: "2026-06-01T00:00:00.000Z"
      })
    ]);
  });

  it("returns undefined when an identity row is missing", async () => {
    const loader = createPostgresDashboardSnapshotSourceLoader(
      new FakeExecutor([organizationRow(), undefined])
    );

    await expect(
      loader.loadDashboardSnapshotSource({
        id: "snapshot-1",
        organizationId: "org-1",
        projectId: "project-1",
        environmentId: "env-1",
        materializedAt
      })
    ).resolves.toBeUndefined();
  });

  it("uses empty quota usage when no entitlement exists", async () => {
    const loader = createPostgresDashboardSnapshotSourceLoader(
      new FakeExecutor([
        organizationRow(),
        projectRow(),
        environmentRow(),
        [],
        [],
        [],
        [],
        [],
        undefined
      ])
    );

    const source = await loader.loadDashboardSnapshotSource({
      id: "snapshot-1",
      organizationId: "org-1",
      projectId: "project-1",
      environmentId: "env-1",
      materializedAt
    });

    expect(source?.quotas).toEqual([]);
  });

  it("rejects invalid limits and unsupported persisted enum values", async () => {
    const loader = createPostgresDashboardSnapshotSourceLoader(
      new FakeExecutor([])
    );

    await expect(
      loader.loadDashboardSnapshotSource({
        id: "snapshot-1",
        organizationId: "org-1",
        projectId: "project-1",
        environmentId: "env-1",
        materializedAt,
        crawlRunLimit: 0
      })
    ).rejects.toThrow("crawlRunLimit must be a positive integer.");

    const malformed = createPostgresDashboardSnapshotSourceLoader(
      new FakeExecutor([
        organizationRow(),
        projectRow(),
        environmentRow(),
        [],
        [
          {
            id: "crawl-1",
            status: "paused",
            created_at: "2026-06-20T00:00:00.000Z"
          }
        ]
      ])
    );

    await expect(
      malformed.loadDashboardSnapshotSource({
        id: "snapshot-1",
        organizationId: "org-1",
        projectId: "project-1",
        environmentId: "env-1",
        materializedAt
      })
    ).rejects.toThrow("Unsupported crawl status paused.");

    const malformedDiagnostic = createPostgresDashboardSnapshotSourceLoader(
      new FakeExecutor([
        organizationRow(),
        projectRow(),
        environmentRow(),
        [
          {
            id: "diagnostic-1",
            rule_id: "SL-TEST-001",
            severity: "critical",
            confidence: "certain",
            page_url: "https://example.test/",
            source: "crawler",
            title: "Diagnostic",
            evidence: "Evidence",
            observed_at: "2026-06-20T00:00:00.000Z",
            fingerprint: "fingerprint-1"
          }
        ]
      ])
    );

    await expect(
      malformedDiagnostic.loadDashboardSnapshotSource({
        id: "snapshot-1",
        organizationId: "org-1",
        projectId: "project-1",
        environmentId: "env-1",
        materializedAt
      })
    ).rejects.toThrow("Unsupported diagnostic severity critical.");

    const malformedObservation = createPostgresDashboardSnapshotSourceLoader(
      new FakeExecutor([
        organizationRow(),
        projectRow(),
        environmentRow(),
        [],
        [],
        [],
        [
          {
            id: "observation-1",
            provider: "yandex",
            source: "google.urlInspection",
            subject_url: "https://example.test/",
            observed_at: "2026-06-20T02:00:00.000Z",
            fetched_at: "2026-06-20T02:01:00.000Z",
            freshness: "fresh"
          }
        ]
      ])
    );

    await expect(
      malformedObservation.loadDashboardSnapshotSource({
        id: "snapshot-1",
        organizationId: "org-1",
        projectId: "project-1",
        environmentId: "env-1",
        materializedAt
      })
    ).rejects.toThrow("External observation source must match provider.");
  });
});

function organizationRow(): Record<string, unknown> {
  return {
    id: "org-1",
    name: "Acme"
  };
}

function projectRow(): Record<string, unknown> {
  return {
    id: "project-1",
    organization_id: "org-1",
    name: "Marketing",
    site_url: "https://example.test"
  };
}

function environmentRow(): Record<string, unknown> {
  return {
    id: "env-1",
    organization_id: "org-1",
    project_id: "project-1",
    name: "Production",
    base_url: "https://example.test"
  };
}

class FakeExecutor implements PostgresQueryExecutor {
  readonly queries: PostgresQuery[] = [];

  constructor(
    private readonly rows: readonly (unknown | readonly unknown[] | undefined)[]
  ) {}

  async query<Row extends Record<string, unknown>>(
    query: PostgresQuery
  ): Promise<PostgresQueryResult<Row>> {
    this.queries.push(query);
    const row = this.rows[this.queries.length - 1];
    return {
      rows:
        row === undefined
          ? []
          : Array.isArray(row)
            ? (row as Row[])
            : [row as Row]
    };
  }
}
