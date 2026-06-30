import { describe, expect, it } from "vitest";

import {
  insertAuditEventSql,
  insertCrawlRequestSql,
  insertEnvironmentSql,
  insertMembershipSql,
  insertMetricEventSql,
  insertOrganizationSql,
  insertOutboxEventSql,
  insertProjectSql,
  removeMembershipSql,
  markCrawlRequestFailedSql,
  markCrawlRequestRunningSql,
  markCrawlRequestSucceededSql,
  markOutboxEventFailedSql,
  markOutboxEventProcessingSql,
  markOutboxEventPublishedSql,
  recordStripeWebhookEventSql,
  recordUsageEventSql,
  markOAuthConnectionRevokedSql,
  selectCrawlRequestSql,
  selectDeploymentHistorySql,
  selectDashboardCrawlRunsSql,
  selectDashboardDiagnosticsSql,
  selectDashboardReportArtifactsSql,
  selectDashboardSnapshotSql,
  selectEnvironmentSql,
  selectExternalObservationsSql,
  selectHistoryRollupsSql,
  selectMembershipSql,
  selectOAuthConnectionSql,
  selectOAuthConnectionsDueForRefreshSql,
  selectOrganizationMembershipsSql,
  selectOrganizationSql,
  selectPageSnapshotHistorySql,
  selectPendingOutboxEventsSql,
  selectProjectSql,
  selectStripeBillingIdentitySql,
  updateMembershipRoleSql,
  upsertDashboardDiagnosticSql,
  upsertDeploymentHistorySql,
  upsertDashboardSnapshotSql,
  upsertExternalObservationSql,
  upsertHistoryRollupSql,
  upsertOAuthConnectionSql,
  upsertPageSnapshotHistorySql,
  upsertStripeOrganizationEntitlementSql
} from "../src/index.js";

const createdAt = "2026-06-21T00:00:00.000Z";

describe("PostgreSQL repository SQL contracts", () => {
  it("creates parameterized organization inserts with schema metadata", () => {
    const query = insertOrganizationSql({
      id: "org-1",
      name: "Acme'; DROP TABLE organizations; --",
      createdAt
    });

    expect(query.text).toBe(
      'INSERT INTO "organizations" ("id", "schema_version", "name", "created_at", "retention_until", "deletion_state") VALUES ($1, $2, $3, $4, $5, $6) RETURNING *;'
    );
    expect(query.values).toEqual([
      "org-1",
      "cloud.organizations.v1",
      "Acme'; DROP TABLE organizations; --",
      createdAt,
      null,
      "active"
    ]);
    expect(query.text).not.toContain("DROP TABLE");
  });

  it("selects dashboard source rows with tenant-scoped queries", () => {
    expect(selectOrganizationSql("org-1")).toEqual({
      text: 'SELECT * FROM "organizations" WHERE "id" = $1 AND "deletion_state" = $2 LIMIT 1;',
      values: ["org-1", "active"]
    });
    expect(
      selectDashboardCrawlRunsSql({
        organizationId: "org-1",
        projectId: "project-1",
        environmentId: "env-1",
        limit: 10
      })
    ).toEqual({
      text: 'SELECT * FROM "crawl_requests" WHERE "organization_id" = $1 AND "project_id" = $2 AND "environment_id" = $3 AND "deletion_state" = $4 ORDER BY "created_at" DESC LIMIT $5;',
      values: ["org-1", "project-1", "env-1", "active", 10]
    });
    expect(
      selectDashboardReportArtifactsSql({
        organizationId: "org-1",
        projectId: "project-1",
        environmentId: "env-1",
        limit: 5
      })
    ).toEqual({
      text: 'SELECT * FROM "report_artifacts" WHERE "organization_id" = $1 AND "project_id" = $2 AND "environment_id" = $3 AND "deletion_state" = $4 ORDER BY "generated_at" DESC LIMIT $5;',
      values: ["org-1", "project-1", "env-1", "active", 5]
    });
    expect(
      selectOrganizationMembershipsSql({
        organizationId: "org-1"
      })
    ).toEqual({
      text: 'SELECT * FROM "organization_memberships" WHERE "organization_id" = $1 AND "deletion_state" = $2 ORDER BY "role" ASC, "principal_id" ASC;',
      values: ["org-1", "active"]
    });
  });

  it("records billable usage idempotently and increments counters only for new events", () => {
    expect(
      recordUsageEventSql({
        id: "usage-1",
        organizationId: "org-1",
        counterName: "crawl.urls",
        idempotencyKey: "crawl-1",
        amount: 500,
        periodStart: "2026-06-01T00:00:00.000Z",
        periodEnd: "2026-07-01T00:00:00.000Z",
        occurredAt: createdAt,
        source: "crawl.requested",
        subjectType: "crawlRequest",
        subjectId: "crawl-1"
      })
    ).toEqual({
      text: 'WITH inserted_event AS (INSERT INTO "billable_usage_events" ("id", "organization_id", "schema_version", "created_at", "retention_until", "deletion_state", "counter_name", "idempotency_key", "amount", "period_start", "period_end", "occurred_at", "source", "subject_type", "subject_id") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $4, $12, $13, $14) ON CONFLICT ("organization_id", "idempotency_key") DO NOTHING RETURNING "organization_id", "counter_name", "amount", "period_start", "period_end", "occurred_at") INSERT INTO "usage_counters" ("id", "organization_id", "schema_version", "created_at", "retention_until", "deletion_state", "counter_name", "period_start", "period_end", "used") SELECT $15, "organization_id", $16, "occurred_at", $5, $6, "counter_name", "period_start", "period_end", "amount" FROM inserted_event ON CONFLICT ("organization_id", "counter_name", "period_start") DO UPDATE SET "used" = "usage_counters"."used" + EXCLUDED."used", "period_end" = EXCLUDED."period_end", "created_at" = LEAST("usage_counters"."created_at", EXCLUDED."created_at") RETURNING *;',
      values: [
        "usage-1",
        "org-1",
        "cloud.billable_usage_events.v1",
        createdAt,
        null,
        "active",
        "crawl.urls",
        "crawl-1",
        500,
        "2026-06-01T00:00:00.000Z",
        "2026-07-01T00:00:00.000Z",
        "crawl.requested",
        "crawlRequest",
        "crawl-1",
        "usage-1:counter",
        "cloud.usage_counters.v1"
      ]
    });
  });

  it("upserts materialized dashboard snapshots by environment", () => {
    expect(
      upsertDashboardSnapshotSql({
        id: "dashboard-snapshot-1",
        organizationId: "org-1",
        projectId: "project-1",
        environmentId: "env-1",
        payload: {
          overview: {
            blocker: 0,
            error: 1
          }
        },
        materializedAt: createdAt
      })
    ).toEqual({
      text: 'INSERT INTO "dashboard_snapshots" ("id", "organization_id", "schema_version", "created_at", "retention_until", "deletion_state", "project_id", "environment_id", "payload", "materialized_at") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $4) ON CONFLICT ("organization_id", "project_id", "environment_id") DO UPDATE SET "schema_version" = EXCLUDED."schema_version", "retention_until" = EXCLUDED."retention_until", "deletion_state" = EXCLUDED."deletion_state", "payload" = EXCLUDED."payload", "materialized_at" = EXCLUDED."materialized_at" RETURNING *;',
      values: [
        "dashboard-snapshot-1",
        "org-1",
        "cloud.dashboard_snapshots.v1",
        createdAt,
        null,
        "active",
        "project-1",
        "env-1",
        {
          overview: {
            blocker: 0,
            error: 1
          }
        }
      ]
    });
  });

  it("upserts and selects dashboard diagnostics by environment", () => {
    expect(
      upsertDashboardDiagnosticSql({
        id: "diagnostic-1",
        organizationId: "org-1",
        projectId: "project-1",
        environmentId: "env-1",
        crawlRequestId: "crawl-1",
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
            type: "text",
            label: "Selector",
            value: "title"
          }
        ],
        observedAt: createdAt,
        fingerprint: "fingerprint-1"
      })
    ).toEqual({
      text: 'INSERT INTO "diagnostics" ("id", "organization_id", "schema_version", "created_at", "retention_until", "deletion_state", "project_id", "environment_id", "crawl_request_id", "rule_id", "severity", "confidence", "page_url", "route", "source", "title", "evidence", "expected", "actual", "source_location", "structured_evidence", "observed_at", "fingerprint") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23) ON CONFLICT ("organization_id", "project_id", "environment_id", "fingerprint") DO UPDATE SET "schema_version" = EXCLUDED."schema_version", "retention_until" = EXCLUDED."retention_until", "deletion_state" = EXCLUDED."deletion_state", "crawl_request_id" = EXCLUDED."crawl_request_id", "rule_id" = EXCLUDED."rule_id", "severity" = EXCLUDED."severity", "confidence" = EXCLUDED."confidence", "page_url" = EXCLUDED."page_url", "route" = EXCLUDED."route", "source" = EXCLUDED."source", "title" = EXCLUDED."title", "evidence" = EXCLUDED."evidence", "expected" = EXCLUDED."expected", "actual" = EXCLUDED."actual", "source_location" = EXCLUDED."source_location", "structured_evidence" = EXCLUDED."structured_evidence", "observed_at" = EXCLUDED."observed_at" RETURNING *;',
      values: [
        "diagnostic-1",
        "org-1",
        "cloud.diagnostics.v1",
        createdAt,
        null,
        "active",
        "project-1",
        "env-1",
        "crawl-1",
        "SL-TEST-001",
        "error",
        "certain",
        "https://example.test/",
        "/",
        "crawler",
        "Diagnostic",
        "Evidence",
        "Expected",
        "Actual",
        {
          confidence: "EXACT",
          file: "app/page.tsx",
          line: 12
        },
        [
          {
            type: "text",
            label: "Selector",
            value: "title"
          }
        ],
        createdAt,
        "fingerprint-1"
      ]
    });
    expect(
      selectDashboardDiagnosticsSql({
        organizationId: "org-1",
        projectId: "project-1",
        environmentId: "env-1",
        limit: 500
      })
    ).toEqual({
      text: 'SELECT * FROM "diagnostics" WHERE "organization_id" = $1 AND "project_id" = $2 AND "environment_id" = $3 AND "deletion_state" = $4 ORDER BY "severity" ASC, "rule_id" ASC, "page_url" ASC, "fingerprint" ASC LIMIT $5;',
      values: ["org-1", "project-1", "env-1", "active", 500]
    });
  });

  it("selects active dashboard snapshots by tenant project and environment", () => {
    expect(
      selectDashboardSnapshotSql({
        organizationId: "org-1",
        projectId: "project-1",
        environmentId: "env-1"
      })
    ).toEqual({
      text: 'SELECT * FROM "dashboard_snapshots" WHERE "organization_id" = $1 AND "project_id" = $2 AND "environment_id" = $3 AND "deletion_state" = $4 LIMIT 1;',
      values: ["org-1", "project-1", "env-1", "active"]
    });
  });

  it("upserts and selects deployment history by environment", () => {
    expect(
      upsertDeploymentHistorySql({
        id: "deployment-row-1",
        organizationId: "org-1",
        projectId: "project-1",
        environmentId: "env-1",
        deploymentId: "deploy-1",
        commitSha: "abc123",
        status: "released",
        deployedAt: "2026-06-23T12:00:00.000Z",
        actor: "release-bot",
        source: "github-actions",
        annotations: {
          releaseCandidate: "rc-1"
        }
      })
    ).toEqual({
      text: 'INSERT INTO "deployment_history" ("id", "organization_id", "schema_version", "created_at", "retention_until", "deletion_state", "project_id", "environment_id", "deployment_id", "commit_sha", "status", "deployed_at", "actor", "source", "annotations") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) ON CONFLICT ("organization_id", "project_id", "environment_id", "deployment_id") DO UPDATE SET "schema_version" = EXCLUDED."schema_version", "retention_until" = EXCLUDED."retention_until", "deletion_state" = EXCLUDED."deletion_state", "commit_sha" = EXCLUDED."commit_sha", "status" = EXCLUDED."status", "deployed_at" = EXCLUDED."deployed_at", "actor" = EXCLUDED."actor", "source" = EXCLUDED."source", "annotations" = EXCLUDED."annotations" RETURNING *;',
      values: [
        "deployment-row-1",
        "org-1",
        "cloud.deployment_history.v1",
        "2026-06-23T12:00:00.000Z",
        null,
        "active",
        "project-1",
        "env-1",
        "deploy-1",
        "abc123",
        "released",
        "2026-06-23T12:00:00.000Z",
        "release-bot",
        "github-actions",
        {
          releaseCandidate: "rc-1"
        }
      ]
    });

    expect(
      selectDeploymentHistorySql({
        organizationId: "org-1",
        projectId: "project-1",
        environmentId: "env-1",
        limit: 20
      })
    ).toEqual({
      text: 'SELECT * FROM "deployment_history" WHERE "organization_id" = $1 AND "project_id" = $2 AND "environment_id" = $3 AND "deletion_state" = $4 ORDER BY "deployed_at" DESC, "deployment_id" ASC LIMIT $5;',
      values: ["org-1", "project-1", "env-1", "active", 20]
    });
  });

  it("upserts and selects page snapshot history by environment", () => {
    expect(
      upsertPageSnapshotHistorySql({
        id: "snapshot-row-1",
        organizationId: "org-1",
        projectId: "project-1",
        environmentId: "env-1",
        pageUrl: "https://example.test/products/widget",
        capturedAt: "2026-06-23T12:05:00.000Z",
        artifactReferences: {
          html: "s3://searchlint-artifacts/org-1/env-1/html.html",
          dom: "s3://searchlint-artifacts/org-1/env-1/dom.json"
        },
        diagnosticFingerprints: ["fingerprint-1", "fingerprint-2"]
      })
    ).toEqual({
      text: 'INSERT INTO "page_snapshot_history" ("id", "organization_id", "schema_version", "created_at", "retention_until", "deletion_state", "project_id", "environment_id", "page_url", "captured_at", "artifact_references", "diagnostic_fingerprints") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) ON CONFLICT ("organization_id", "project_id", "environment_id", "page_url", "captured_at") DO UPDATE SET "schema_version" = EXCLUDED."schema_version", "retention_until" = EXCLUDED."retention_until", "deletion_state" = EXCLUDED."deletion_state", "artifact_references" = EXCLUDED."artifact_references", "diagnostic_fingerprints" = EXCLUDED."diagnostic_fingerprints" RETURNING *;',
      values: [
        "snapshot-row-1",
        "org-1",
        "cloud.page_snapshot_history.v1",
        "2026-06-23T12:05:00.000Z",
        null,
        "active",
        "project-1",
        "env-1",
        "https://example.test/products/widget",
        "2026-06-23T12:05:00.000Z",
        {
          html: "s3://searchlint-artifacts/org-1/env-1/html.html",
          dom: "s3://searchlint-artifacts/org-1/env-1/dom.json"
        },
        ["fingerprint-1", "fingerprint-2"]
      ]
    });

    expect(
      selectPageSnapshotHistorySql({
        organizationId: "org-1",
        projectId: "project-1",
        environmentId: "env-1",
        limit: 20
      })
    ).toEqual({
      text: 'SELECT * FROM "page_snapshot_history" WHERE "organization_id" = $1 AND "project_id" = $2 AND "environment_id" = $3 AND "deletion_state" = $4 ORDER BY "captured_at" DESC, "page_url" ASC LIMIT $5;',
      values: ["org-1", "project-1", "env-1", "active", 20]
    });
  });

  it("upserts and selects history rollups by environment", () => {
    expect(
      upsertHistoryRollupSql({
        id: "rollup-row-1",
        organizationId: "org-1",
        projectId: "project-1",
        environmentId: "env-1",
        rollupKind: "diagnostics",
        rollupKey: "daily:/products/widget",
        periodStart: "2026-06-23T00:00:00.000Z",
        periodEnd: "2026-06-24T00:00:00.000Z",
        dimensions: {
          pageUrl: "https://example.test/products/widget"
        },
        metrics: {
          diagnostics: 7,
          blockers: 1
        },
        generatedAt: "2026-06-23T12:10:00.000Z"
      })
    ).toEqual({
      text: 'INSERT INTO "history_rollups" ("id", "organization_id", "schema_version", "created_at", "retention_until", "deletion_state", "project_id", "environment_id", "rollup_kind", "rollup_key", "period_start", "period_end", "dimensions", "metrics", "generated_at") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) ON CONFLICT ("organization_id", "project_id", "environment_id", "rollup_kind", "rollup_key", "period_start") DO UPDATE SET "schema_version" = EXCLUDED."schema_version", "retention_until" = EXCLUDED."retention_until", "deletion_state" = EXCLUDED."deletion_state", "period_end" = EXCLUDED."period_end", "dimensions" = EXCLUDED."dimensions", "metrics" = EXCLUDED."metrics", "generated_at" = EXCLUDED."generated_at" RETURNING *;',
      values: [
        "rollup-row-1",
        "org-1",
        "cloud.history_rollups.v1",
        "2026-06-23T12:10:00.000Z",
        null,
        "active",
        "project-1",
        "env-1",
        "diagnostics",
        "daily:/products/widget",
        "2026-06-23T00:00:00.000Z",
        "2026-06-24T00:00:00.000Z",
        {
          pageUrl: "https://example.test/products/widget"
        },
        {
          diagnostics: 7,
          blockers: 1
        },
        "2026-06-23T12:10:00.000Z"
      ]
    });

    expect(
      selectHistoryRollupsSql({
        organizationId: "org-1",
        projectId: "project-1",
        environmentId: "env-1",
        rollupKind: "diagnostics",
        limit: 20
      })
    ).toEqual({
      text: 'SELECT * FROM "history_rollups" WHERE "organization_id" = $1 AND "project_id" = $2 AND "environment_id" = $3 AND "rollup_kind" = $4 AND "deletion_state" = $5 ORDER BY "period_start" DESC, "rollup_key" ASC LIMIT $6;',
      values: ["org-1", "project-1", "env-1", "diagnostics", "active", 20]
    });
  });

  it("upserts and selects external Google observations by environment and provider", () => {
    expect(
      upsertExternalObservationSql({
        id: "observation-1",
        organizationId: "org-1",
        projectId: "project-1",
        environmentId: "env-1",
        provider: "google",
        source: "google.urlInspection",
        subjectUrl: "https://example.test/",
        observedAt: "2026-06-21T00:00:00.000Z",
        fetchedAt: "2026-06-21T00:01:00.000Z",
        freshness: "fresh",
        payload: {
          inspectionResult: {
            verdict: "PASS"
          }
        },
        quota: {
          limit: 2000,
          remaining: 1999,
          resetAt: "2026-06-22T00:00:00.000Z"
        },
        sampling: {
          sampled: false
        },
        fingerprint: "google-url-inspection-home",
        deletionState: "active",
        createdAt
      })
    ).toEqual({
      text: 'INSERT INTO "external_observations" ("id", "organization_id", "schema_version", "created_at", "retention_until", "deletion_state", "project_id", "environment_id", "provider", "source", "subject_url", "observed_at", "fetched_at", "freshness", "payload", "quota", "sampling", "fingerprint") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18) ON CONFLICT ("organization_id", "project_id", "environment_id", "provider", "fingerprint") DO UPDATE SET "schema_version" = EXCLUDED."schema_version", "created_at" = EXCLUDED."created_at", "retention_until" = EXCLUDED."retention_until", "deletion_state" = EXCLUDED."deletion_state", "source" = EXCLUDED."source", "subject_url" = EXCLUDED."subject_url", "observed_at" = EXCLUDED."observed_at", "fetched_at" = EXCLUDED."fetched_at", "freshness" = EXCLUDED."freshness", "payload" = EXCLUDED."payload", "quota" = EXCLUDED."quota", "sampling" = EXCLUDED."sampling" RETURNING *;',
      values: [
        "observation-1",
        "org-1",
        "cloud.external_observations.v1",
        createdAt,
        null,
        "active",
        "project-1",
        "env-1",
        "google",
        "google.urlInspection",
        "https://example.test/",
        "2026-06-21T00:00:00.000Z",
        "2026-06-21T00:01:00.000Z",
        "fresh",
        {
          inspectionResult: {
            verdict: "PASS"
          }
        },
        {
          limit: 2000,
          remaining: 1999,
          resetAt: "2026-06-22T00:00:00.000Z"
        },
        {
          sampled: false
        },
        "google-url-inspection-home"
      ]
    });

    expect(
      selectExternalObservationsSql({
        organizationId: "org-1",
        projectId: "project-1",
        environmentId: "env-1",
        provider: "google",
        limit: 100
      })
    ).toEqual({
      text: 'SELECT * FROM "external_observations" WHERE "organization_id" = $1 AND "project_id" = $2 AND "environment_id" = $3 AND "provider" = $4 AND "deletion_state" = $5 ORDER BY "observed_at" DESC, "source" ASC, "subject_url" ASC LIMIT $6;',
      values: ["org-1", "project-1", "env-1", "google", "active", 100]
    });

    expect(
      selectExternalObservationsSql({
        organizationId: "org-1",
        projectId: "project-1",
        environmentId: "env-1",
        limit: 100
      })
    ).toEqual({
      text: 'SELECT * FROM "external_observations" WHERE "organization_id" = $1 AND "project_id" = $2 AND "environment_id" = $3 AND "deletion_state" = $4 ORDER BY "provider" ASC, "observed_at" DESC, "source" ASC, "subject_url" ASC LIMIT $5;',
      values: ["org-1", "project-1", "env-1", "active", 100]
    });
  });

  it("upserts and selects external Yandex observations by environment and provider", () => {
    expect(
      upsertExternalObservationSql({
        id: "observation-yandex-1",
        organizationId: "org-1",
        projectId: "project-1",
        environmentId: "env-1",
        provider: "yandex",
        source: "yandex.webmaster",
        subjectUrl: "https://example.test/catalog",
        observedAt: "2026-06-21T02:00:00.000Z",
        fetchedAt: "2026-06-21T02:01:00.000Z",
        freshness: "stale",
        payload: {
          indexing: {
            searchable: false,
            exclusionReason: "canonical"
          }
        },
        quota: {
          remaining: 499
        },
        sampling: {
          sampled: false
        },
        fingerprint: "yandex-webmaster-catalog",
        deletionState: "active",
        createdAt
      })
    ).toEqual({
      text: 'INSERT INTO "external_observations" ("id", "organization_id", "schema_version", "created_at", "retention_until", "deletion_state", "project_id", "environment_id", "provider", "source", "subject_url", "observed_at", "fetched_at", "freshness", "payload", "quota", "sampling", "fingerprint") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18) ON CONFLICT ("organization_id", "project_id", "environment_id", "provider", "fingerprint") DO UPDATE SET "schema_version" = EXCLUDED."schema_version", "created_at" = EXCLUDED."created_at", "retention_until" = EXCLUDED."retention_until", "deletion_state" = EXCLUDED."deletion_state", "source" = EXCLUDED."source", "subject_url" = EXCLUDED."subject_url", "observed_at" = EXCLUDED."observed_at", "fetched_at" = EXCLUDED."fetched_at", "freshness" = EXCLUDED."freshness", "payload" = EXCLUDED."payload", "quota" = EXCLUDED."quota", "sampling" = EXCLUDED."sampling" RETURNING *;',
      values: [
        "observation-yandex-1",
        "org-1",
        "cloud.external_observations.v1",
        createdAt,
        null,
        "active",
        "project-1",
        "env-1",
        "yandex",
        "yandex.webmaster",
        "https://example.test/catalog",
        "2026-06-21T02:00:00.000Z",
        "2026-06-21T02:01:00.000Z",
        "stale",
        {
          indexing: {
            searchable: false,
            exclusionReason: "canonical"
          }
        },
        {
          remaining: 499
        },
        {
          sampled: false
        },
        "yandex-webmaster-catalog"
      ]
    });

    expect(
      selectExternalObservationsSql({
        organizationId: "org-1",
        projectId: "project-1",
        environmentId: "env-1",
        provider: "yandex",
        limit: 100
      })
    ).toEqual({
      text: 'SELECT * FROM "external_observations" WHERE "organization_id" = $1 AND "project_id" = $2 AND "environment_id" = $3 AND "provider" = $4 AND "deletion_state" = $5 ORDER BY "observed_at" DESC, "source" ASC, "subject_url" ASC LIMIT $6;',
      values: ["org-1", "project-1", "env-1", "yandex", "active", 100]
    });
  });

  it("upserts OAuth connection metadata with vault secret references only", () => {
    const query = upsertOAuthConnectionSql({
      id: "oauth-connection-1",
      organizationId: "org-1",
      projectId: "project-1",
      environmentId: "env-1",
      provider: "google",
      providerAccountId: "sc-domain:example.test",
      scopes: ["https://www.googleapis.com/auth/webmasters.readonly", "openid"],
      accessTokenSecretRef: "secret://org-1/google/access-token",
      refreshTokenSecretRef: "secret://org-1/google/refresh-token",
      expiresAt: "2026-06-21T01:00:00.000Z",
      lastRefreshAt: "2026-06-21T00:00:00.000Z",
      status: "active",
      deletionState: "active",
      createdAt
    });

    expect(query).toEqual({
      text: 'INSERT INTO "oauth_connections" ("id", "organization_id", "schema_version", "created_at", "retention_until", "deletion_state", "project_id", "environment_id", "provider", "provider_account_id", "scopes", "access_token_secret_ref", "refresh_token_secret_ref", "expires_at", "last_refresh_at", "last_error", "status") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) ON CONFLICT ("organization_id", "project_id", "environment_id", "provider", "provider_account_id") DO UPDATE SET "schema_version" = EXCLUDED."schema_version", "created_at" = EXCLUDED."created_at", "retention_until" = EXCLUDED."retention_until", "deletion_state" = EXCLUDED."deletion_state", "scopes" = EXCLUDED."scopes", "access_token_secret_ref" = EXCLUDED."access_token_secret_ref", "refresh_token_secret_ref" = EXCLUDED."refresh_token_secret_ref", "expires_at" = EXCLUDED."expires_at", "last_refresh_at" = EXCLUDED."last_refresh_at", "last_error" = EXCLUDED."last_error", "status" = EXCLUDED."status" RETURNING *;',
      values: [
        "oauth-connection-1",
        "org-1",
        "cloud.oauth_connections.v1",
        createdAt,
        null,
        "active",
        "project-1",
        "env-1",
        "google",
        "sc-domain:example.test",
        ["https://www.googleapis.com/auth/webmasters.readonly", "openid"],
        "secret://org-1/google/access-token",
        "secret://org-1/google/refresh-token",
        "2026-06-21T01:00:00.000Z",
        "2026-06-21T00:00:00.000Z",
        null,
        "active"
      ]
    });
    expect(query.text).not.toContain('access_token"');
    expect(query.text).not.toContain('refresh_token"');
    expect(query.values).not.toContain("raw-access-token");
    expect(query.values).not.toContain("raw-refresh-token");
  });

  it("selects active and refresh-due OAuth connections", () => {
    expect(
      selectOAuthConnectionSql({
        organizationId: "org-1",
        projectId: "project-1",
        environmentId: "env-1",
        provider: "yandex"
      })
    ).toEqual({
      text: 'SELECT * FROM "oauth_connections" WHERE "organization_id" = $1 AND "project_id" = $2 AND "environment_id" = $3 AND "provider" = $4 AND "status" = $5 AND "deletion_state" = $6 ORDER BY "created_at" DESC LIMIT 1;',
      values: ["org-1", "project-1", "env-1", "yandex", "active", "active"]
    });

    expect(
      selectOAuthConnectionsDueForRefreshSql({
        now: "2026-06-21T00:00:00.000Z",
        limit: 50
      })
    ).toEqual({
      text: 'SELECT * FROM "oauth_connections" WHERE "status" = $1 AND "deletion_state" = $2 AND ("expires_at" IS NULL OR "expires_at" <= $3) ORDER BY "expires_at" ASC NULLS FIRST, "provider" ASC, "created_at" ASC LIMIT $4;',
      values: ["active", "active", "2026-06-21T00:00:00.000Z", 50]
    });

    expect(
      selectOAuthConnectionsDueForRefreshSql({
        now: "2026-06-21T00:00:00.000Z",
        provider: "google",
        limit: 25
      })
    ).toEqual({
      text: 'SELECT * FROM "oauth_connections" WHERE "status" = $1 AND "deletion_state" = $2 AND "provider" = $3 AND ("expires_at" IS NULL OR "expires_at" <= $4) ORDER BY "expires_at" ASC NULLS FIRST, "provider" ASC, "created_at" ASC LIMIT $5;',
      values: ["active", "active", "google", "2026-06-21T00:00:00.000Z", 25]
    });
  });

  it("marks OAuth connections revoked without deleting audit metadata", () => {
    expect(
      markOAuthConnectionRevokedSql({
        organizationId: "org-1",
        id: "oauth-connection-1"
      })
    ).toEqual({
      text: 'UPDATE "oauth_connections" SET "status" = $1, "last_error" = $2 WHERE "organization_id" = $3 AND "id" = $4 AND "deletion_state" = $5 RETURNING *;',
      values: ["revoked", null, "org-1", "oauth-connection-1", "active"]
    });
  });

  it("selects Stripe billing identities by subscription before customer", () => {
    expect(
      selectStripeBillingIdentitySql({
        stripeSubscriptionId: "sub-1",
        stripeCustomerId: "cus-1"
      })
    ).toEqual({
      text: 'SELECT * FROM "stripe_billing_identities" WHERE "active" = $1 AND "deletion_state" = $2 AND ("stripe_subscription_id" = $3 OR "stripe_customer_id" = $4) ORDER BY CASE WHEN "stripe_subscription_id" = $3 THEN 0 ELSE 1 END ASC, "created_at" DESC LIMIT 1;',
      values: [true, "active", "sub-1", "cus-1"]
    });
    expect(
      selectStripeBillingIdentitySql({
        stripeCustomerId: "cus-1"
      })
    ).toEqual({
      text: 'SELECT * FROM "stripe_billing_identities" WHERE "active" = $1 AND "deletion_state" = $2 AND "stripe_customer_id" = $3 ORDER BY "created_at" DESC LIMIT 1;',
      values: [true, "active", "cus-1"]
    });
  });

  it("records Stripe webhook events idempotently per organization", () => {
    expect(
      recordStripeWebhookEventSql({
        id: "stripe-webhook-event-1",
        organizationId: "org-1",
        stripeEventId: "evt-1",
        stripeEventType: "customer.subscription.updated",
        intentKind: "subscription-entitlement-update",
        processedAt: createdAt
      })
    ).toEqual({
      text: 'INSERT INTO "stripe_webhook_events" ("id", "organization_id", "schema_version", "created_at", "retention_until", "deletion_state", "stripe_event_id", "stripe_event_type", "intent_kind", "processed_at") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $4) ON CONFLICT ("organization_id", "stripe_event_id") DO NOTHING RETURNING *;',
      values: [
        "stripe-webhook-event-1",
        "org-1",
        "cloud.stripe_webhook_events.v1",
        createdAt,
        null,
        "active",
        "evt-1",
        "customer.subscription.updated",
        "subscription-entitlement-update"
      ]
    });
  });

  it("upserts Stripe-sourced organization entitlements", () => {
    expect(
      upsertStripeOrganizationEntitlementSql({
        id: "stripe:sub-1",
        organizationId: "org-1",
        planTier: "team",
        status: "active",
        currentPeriodStart: "2026-06-01T00:00:00.000Z",
        currentPeriodEnd: "2026-07-01T00:00:00.000Z",
        crawlMaxUrlsPerRun: 10_000,
        monthlyCrawledUrlsLimit: 100_000,
        externalApiMonthlyLimit: 10_000,
        reportRetentionDays: 90,
        source: "stripe",
        createdAt
      })
    ).toEqual({
      text: 'INSERT INTO "organization_entitlements" ("id", "organization_id", "schema_version", "created_at", "retention_until", "deletion_state", "plan_tier", "status", "current_period_start", "current_period_end", "crawl_max_urls_per_run", "monthly_crawled_urls_limit", "external_api_monthly_limit", "report_retention_days", "source") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) ON CONFLICT ("id") DO UPDATE SET "plan_tier" = EXCLUDED."plan_tier", "status" = EXCLUDED."status", "current_period_start" = EXCLUDED."current_period_start", "current_period_end" = EXCLUDED."current_period_end", "crawl_max_urls_per_run" = EXCLUDED."crawl_max_urls_per_run", "monthly_crawled_urls_limit" = EXCLUDED."monthly_crawled_urls_limit", "external_api_monthly_limit" = EXCLUDED."external_api_monthly_limit", "report_retention_days" = EXCLUDED."report_retention_days", "source" = EXCLUDED."source", "created_at" = EXCLUDED."created_at", "retention_until" = EXCLUDED."retention_until", "deletion_state" = EXCLUDED."deletion_state" RETURNING *;',
      values: [
        "stripe:sub-1",
        "org-1",
        "cloud.organization_entitlements.v1",
        createdAt,
        null,
        "active",
        "team",
        "active",
        "2026-06-01T00:00:00.000Z",
        "2026-07-01T00:00:00.000Z",
        10_000,
        100_000,
        10_000,
        90,
        "stripe"
      ]
    });
  });

  it("creates membership inserts that match the schema primary key", () => {
    const query = insertMembershipSql({
      id: "membership-1",
      organizationId: "org-1",
      principalId: "principal-1",
      role: "owner",
      createdAt
    });

    expect(query.text).toBe(
      'INSERT INTO "organization_memberships" ("id", "organization_id", "schema_version", "created_at", "retention_until", "deletion_state", "principal_id", "role") VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *;'
    );
    expect(query.values).toEqual([
      "membership-1",
      "org-1",
      "cloud.organization_memberships.v1",
      createdAt,
      null,
      "active",
      "principal-1",
      "owner"
    ]);
  });

  it("keeps membership reads tenant-scoped and active-only", () => {
    expect(selectMembershipSql("org-1", "principal-1")).toEqual({
      text: 'SELECT * FROM "organization_memberships" WHERE "organization_id" = $1 AND "principal_id" = $2 AND "deletion_state" = $3 LIMIT 1;',
      values: ["org-1", "principal-1", "active"]
    });
  });

  it("updates and removes memberships through tenant-scoped active-only writes", () => {
    expect(
      updateMembershipRoleSql({
        organizationId: "org-1",
        principalId: "principal-1",
        role: "owner"
      })
    ).toEqual({
      text: 'UPDATE "organization_memberships" SET "role" = $1 WHERE "organization_id" = $2 AND "principal_id" = $3 AND "deletion_state" = $4 RETURNING *;',
      values: ["owner", "org-1", "principal-1", "active"]
    });
    expect(
      removeMembershipSql({
        organizationId: "org-1",
        principalId: "principal-1"
      })
    ).toEqual({
      text: 'UPDATE "organization_memberships" SET "deletion_state" = $1 WHERE "organization_id" = $2 AND "principal_id" = $3 AND "deletion_state" = $4 RETURNING *;',
      values: ["deleted", "org-1", "principal-1", "active"]
    });
  });

  it("creates project and environment inserts with retention metadata", () => {
    expect(
      insertProjectSql(
        {
          id: "project-1",
          organizationId: "org-1",
          name: "Marketing",
          siteUrl: "https://example.com",
          createdAt
        },
        {
          retentionUntil: "2027-06-21T00:00:00.000Z"
        }
      )
    ).toEqual({
      text: 'INSERT INTO "projects" ("id", "organization_id", "schema_version", "created_at", "retention_until", "deletion_state", "name", "site_url") VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *;',
      values: [
        "project-1",
        "org-1",
        "cloud.projects.v1",
        createdAt,
        "2027-06-21T00:00:00.000Z",
        "active",
        "Marketing",
        "https://example.com"
      ]
    });

    expect(
      insertEnvironmentSql({
        id: "env-1",
        organizationId: "org-1",
        projectId: "project-1",
        name: "Production",
        baseUrl: "https://example.com",
        createdAt
      })
    ).toEqual({
      text: 'INSERT INTO "environments" ("id", "organization_id", "schema_version", "created_at", "retention_until", "deletion_state", "project_id", "name", "base_url") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *;',
      values: [
        "env-1",
        "org-1",
        "cloud.environments.v1",
        createdAt,
        null,
        "active",
        "project-1",
        "Production",
        "https://example.com"
      ]
    });
  });

  it("keeps project and environment reads scoped to organization_id", () => {
    expect(selectProjectSql("org-1", "project-1")).toEqual({
      text: 'SELECT * FROM "projects" WHERE "organization_id" = $1 AND "id" = $2 AND "deletion_state" = $3 LIMIT 1;',
      values: ["org-1", "project-1", "active"]
    });
    expect(selectEnvironmentSql("org-1", "env-1")).toEqual({
      text: 'SELECT * FROM "environments" WHERE "organization_id" = $1 AND "id" = $2 AND "deletion_state" = $3 LIMIT 1;',
      values: ["org-1", "env-1", "active"]
    });
  });

  it("creates crawl request inserts with explicit lifecycle status", () => {
    const query = insertCrawlRequestSql({
      id: "crawl-1",
      organizationId: "org-1",
      projectId: "project-1",
      environmentId: "env-1",
      requestedBy: "principal-1",
      maxUrls: 500,
      status: "queued",
      createdAt
    });

    expect(query).toEqual({
      text: 'INSERT INTO "crawl_requests" ("id", "organization_id", "schema_version", "created_at", "retention_until", "deletion_state", "project_id", "environment_id", "requested_by", "max_urls", "status", "started_at", "completed_at", "failed_at", "last_error", "artifact_uri") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) RETURNING *;',
      values: [
        "crawl-1",
        "org-1",
        "cloud.crawl_requests.v1",
        createdAt,
        null,
        "active",
        "project-1",
        "env-1",
        "principal-1",
        500,
        "queued",
        null,
        null,
        null,
        null,
        null
      ]
    });
  });

  it("keeps crawl request reads scoped to organization_id", () => {
    expect(selectCrawlRequestSql("org-1", "crawl-1")).toEqual({
      text: 'SELECT * FROM "crawl_requests" WHERE "organization_id" = $1 AND "id" = $2 AND "deletion_state" = $3 LIMIT 1;',
      values: ["org-1", "crawl-1", "active"]
    });
  });

  it("creates crawl request lifecycle transition updates", () => {
    expect(
      markCrawlRequestRunningSql({
        organizationId: "org-1",
        id: "crawl-1",
        startedAt: "2026-06-21T00:00:01.000Z"
      })
    ).toEqual({
      text: 'UPDATE "crawl_requests" SET "status" = $1, "started_at" = $2, "completed_at" = $3, "failed_at" = $4, "last_error" = $5 WHERE "organization_id" = $6 AND "id" = $7 AND "status" = $8 AND "deletion_state" = $9 RETURNING *;',
      values: [
        "running",
        "2026-06-21T00:00:01.000Z",
        null,
        null,
        null,
        "org-1",
        "crawl-1",
        "queued",
        "active"
      ]
    });
    expect(
      markCrawlRequestSucceededSql({
        organizationId: "org-1",
        id: "crawl-1",
        completedAt: "2026-06-21T00:00:10.000Z",
        artifactUri: "s3://searchlint/crawls/crawl-1.json"
      })
    ).toEqual({
      text: 'UPDATE "crawl_requests" SET "status" = $1, "completed_at" = $2, "failed_at" = $3, "last_error" = $4, "artifact_uri" = $5 WHERE "organization_id" = $6 AND "id" = $7 AND "status" = $8 AND "deletion_state" = $9 RETURNING *;',
      values: [
        "succeeded",
        "2026-06-21T00:00:10.000Z",
        null,
        null,
        "s3://searchlint/crawls/crawl-1.json",
        "org-1",
        "crawl-1",
        "running",
        "active"
      ]
    });
    expect(
      markCrawlRequestFailedSql({
        organizationId: "org-1",
        id: "crawl-1",
        failedAt: "2026-06-21T00:00:10.000Z",
        lastError: "network unavailable"
      })
    ).toEqual({
      text: 'UPDATE "crawl_requests" SET "status" = $1, "failed_at" = $2, "last_error" = $3 WHERE "organization_id" = $4 AND "id" = $5 AND "status" = $6 AND "deletion_state" = $7 RETURNING *;',
      values: [
        "failed",
        "2026-06-21T00:00:10.000Z",
        "network unavailable",
        "org-1",
        "crawl-1",
        "running",
        "active"
      ]
    });
  });

  it("creates audit and metric inserts with tenant and retention metadata", () => {
    expect(
      insertAuditEventSql({
        id: "audit-1",
        organizationId: "org-1",
        actorPrincipalId: "principal-1",
        action: "crawl.requested",
        targetType: "crawlRequest",
        targetId: "crawl-1",
        occurredAt: createdAt
      })
    ).toEqual({
      text: 'INSERT INTO "audit_events" ("id", "organization_id", "schema_version", "created_at", "retention_until", "deletion_state", "actor_principal_id", "action", "target_type", "target_id", "occurred_at") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *;',
      values: [
        "audit-1",
        "org-1",
        "cloud.audit_events.v1",
        createdAt,
        null,
        "active",
        "principal-1",
        "crawl.requested",
        "crawlRequest",
        "crawl-1",
        createdAt
      ]
    });

    expect(
      insertMetricEventSql({
        id: "metric-1",
        organizationId: "org-1",
        name: "crawl.requested",
        value: 1,
        occurredAt: createdAt,
        dimensions: {
          projectId: "project-1"
        }
      })
    ).toEqual({
      text: 'INSERT INTO "metric_events" ("id", "organization_id", "schema_version", "created_at", "retention_until", "deletion_state", "name", "value", "dimensions", "occurred_at") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *;',
      values: [
        "metric-1",
        "org-1",
        "cloud.metric_events.v1",
        createdAt,
        null,
        "active",
        "crawl.requested",
        1,
        {
          projectId: "project-1"
        },
        createdAt
      ]
    });
  });

  it("creates parameterized outbox inserts for crawl queue handoff", () => {
    expect(
      insertOutboxEventSql({
        id: "outbox-1",
        organizationId: "org-1",
        topic: "crawl.requested",
        payload: {
          crawlRequestId: "crawl-1",
          organizationId: "org-1",
          projectId: "project-1",
          environmentId: "env-1",
          maxUrls: 500
        },
        status: "pending",
        attempts: 0,
        createdAt,
        availableAt: createdAt
      })
    ).toEqual({
      text: 'INSERT INTO "outbox_events" ("id", "organization_id", "schema_version", "created_at", "retention_until", "deletion_state", "topic", "payload", "status", "attempts", "available_at", "locked_at", "published_at", "last_error") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *;',
      values: [
        "outbox-1",
        "org-1",
        "cloud.outbox_events.v1",
        createdAt,
        null,
        "active",
        "crawl.requested",
        {
          crawlRequestId: "crawl-1",
          organizationId: "org-1",
          projectId: "project-1",
          environmentId: "env-1",
          maxUrls: 500
        },
        "pending",
        0,
        createdAt,
        null,
        null,
        null
      ]
    });
  });

  it("creates deterministic outbox dispatch lifecycle queries", () => {
    expect(selectPendingOutboxEventsSql({ now: createdAt, limit: 25 })).toEqual(
      {
        text: 'SELECT * FROM "outbox_events" WHERE "status" = $1 AND "available_at" <= $2 AND "deletion_state" = $3 ORDER BY "created_at" ASC LIMIT $4;',
        values: ["pending", createdAt, "active", 25]
      }
    );
    expect(
      markOutboxEventProcessingSql({
        organizationId: "org-1",
        id: "outbox-1",
        lockedAt: createdAt
      })
    ).toEqual({
      text: 'UPDATE "outbox_events" SET "status" = $1, "attempts" = "attempts" + 1, "locked_at" = $2 WHERE "organization_id" = $3 AND "id" = $4 AND "status" = $5 AND "deletion_state" = $6 RETURNING *;',
      values: [
        "processing",
        createdAt,
        "org-1",
        "outbox-1",
        "pending",
        "active"
      ]
    });
    expect(
      markOutboxEventPublishedSql({
        organizationId: "org-1",
        id: "outbox-1",
        publishedAt: createdAt
      })
    ).toEqual({
      text: 'UPDATE "outbox_events" SET "status" = $1, "published_at" = $2, "locked_at" = $3, "last_error" = $4 WHERE "organization_id" = $5 AND "id" = $6 AND "status" = $7 AND "deletion_state" = $8 RETURNING *;',
      values: [
        "published",
        createdAt,
        null,
        null,
        "org-1",
        "outbox-1",
        "processing",
        "active"
      ]
    });
    expect(
      markOutboxEventFailedSql({
        organizationId: "org-1",
        id: "outbox-1",
        lastError: "SQS throttled",
        availableAt: "2026-06-21T00:01:00.000Z"
      })
    ).toEqual({
      text: 'UPDATE "outbox_events" SET "status" = $1, "available_at" = $2, "locked_at" = $3, "last_error" = $4 WHERE "organization_id" = $5 AND "id" = $6 AND "status" = $7 AND "deletion_state" = $8 RETURNING *;',
      values: [
        "pending",
        "2026-06-21T00:01:00.000Z",
        null,
        "SQS throttled",
        "org-1",
        "outbox-1",
        "processing",
        "active"
      ]
    });
  });
});
