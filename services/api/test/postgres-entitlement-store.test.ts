import { describe, expect, it } from "vitest";

import {
  createPostgresEntitlementStore,
  selectOrganizationEntitlementSql,
  selectUsageCounterSql
} from "../src/index.js";
import type {
  PostgresQuery,
  PostgresQueryExecutor,
  PostgresQueryResult
} from "../src/index.js";

describe("entitlement SQL selectors", () => {
  it("selects the latest active organization entitlement row", () => {
    expect(selectOrganizationEntitlementSql("org-1")).toEqual({
      text: 'SELECT * FROM "organization_entitlements" WHERE "organization_id" = $1 AND "deletion_state" = $2 ORDER BY "current_period_end" DESC LIMIT 1;',
      values: ["org-1", "active"]
    });
  });

  it("selects a period usage counter row", () => {
    expect(
      selectUsageCounterSql({
        organizationId: "org-1",
        counterName: "crawl.urls",
        periodStart: "2026-06-01T00:00:00.000Z"
      })
    ).toEqual({
      text: 'SELECT * FROM "usage_counters" WHERE "organization_id" = $1 AND "counter_name" = $2 AND "period_start" = $3 AND "deletion_state" = $4 LIMIT 1;',
      values: ["org-1", "crawl.urls", "2026-06-01T00:00:00.000Z", "active"]
    });
  });
});

describe("createPostgresEntitlementStore", () => {
  it("allows crawl creation within per-run and monthly limits", async () => {
    const store = createPostgresEntitlementStore(
      executor([entitlementRow(), usageRow(50)])
    );

    await expect(
      store.canStartCrawl({
        organizationId: "org-1",
        projectId: "project-1",
        environmentId: "env-1",
        maxUrls: 100
      })
    ).resolves.toEqual({
      allowed: true,
      billableUsage: {
        counterName: "crawl.urls",
        amount: 100,
        periodStart: "2026-06-01T00:00:00.000Z",
        periodEnd: "2026-07-01T00:00:00.000Z"
      }
    });
  });

  it("denies when no entitlement row is configured", async () => {
    const store = createPostgresEntitlementStore(executor([undefined]));

    await expect(
      store.canStartCrawl({
        organizationId: "org-1",
        projectId: "project-1",
        environmentId: "env-1",
        maxUrls: 10
      })
    ).resolves.toEqual({
      allowed: false,
      reason: "No active cloud entitlement is configured."
    });
  });

  it("denies inactive subscription states", async () => {
    const store = createPostgresEntitlementStore(
      executor([entitlementRow({ status: "past_due" })])
    );

    await expect(
      store.canStartCrawl({
        organizationId: "org-1",
        projectId: "project-1",
        environmentId: "env-1",
        maxUrls: 10
      })
    ).resolves.toEqual({
      allowed: false,
      reason: "Cloud subscription is past_due."
    });
  });

  it("denies crawl requests above the per-run limit", async () => {
    const store = createPostgresEntitlementStore(
      executor([entitlementRow({ crawl_max_urls_per_run: 50 })])
    );

    await expect(
      store.canStartCrawl({
        organizationId: "org-1",
        projectId: "project-1",
        environmentId: "env-1",
        maxUrls: 51
      })
    ).resolves.toEqual({
      allowed: false,
      reason: "Requested crawl size exceeds plan limit of 50 URLs per run."
    });
  });

  it("denies crawl requests above the monthly URL limit", async () => {
    const store = createPostgresEntitlementStore(
      executor([
        entitlementRow({ monthly_crawled_urls_limit: 100 }),
        usageRow(95)
      ])
    );

    await expect(
      store.canStartCrawl({
        organizationId: "org-1",
        projectId: "project-1",
        environmentId: "env-1",
        maxUrls: 10
      })
    ).resolves.toEqual({
      allowed: false,
      reason:
        "Monthly crawled URL quota exceeded for period ending 2026-07-01T00:00:00.000Z."
    });
  });

  it("allows external API inspections within monthly limits", async () => {
    const store = createPostgresEntitlementStore(
      executor([entitlementRow(), usageRow(10)])
    );

    await expect(
      store.canUseExternalApiInspection({
        organizationId: "org-1",
        provider: "google",
        inspections: 25
      })
    ).resolves.toEqual({
      allowed: true,
      billableUsage: {
        counterName: "external_api.inspections",
        amount: 25,
        periodStart: "2026-06-01T00:00:00.000Z",
        periodEnd: "2026-07-01T00:00:00.000Z"
      }
    });
  });

  it("denies external API inspections above the monthly limit", async () => {
    const store = createPostgresEntitlementStore(
      executor([
        entitlementRow({ external_api_monthly_limit: 100 }),
        usageRow(90)
      ])
    );

    await expect(
      store.canUseExternalApiInspection({
        organizationId: "org-1",
        provider: "yandex",
        inspections: 11
      })
    ).resolves.toEqual({
      allowed: false,
      reason:
        "yandex external API inspection quota exceeded for period ending 2026-07-01T00:00:00.000Z."
    });
  });

  it("reads the external API usage counter for the current entitlement period", async () => {
    const queries: PostgresQuery[] = [];
    const store = createPostgresEntitlementStore(
      executor([entitlementRow(), usageRow(0)], queries)
    );

    await store.canUseExternalApiInspection({
      organizationId: "org-1",
      provider: "google",
      inspections: 1
    });

    expect(queries[1]).toEqual(
      selectUsageCounterSql({
        organizationId: "org-1",
        counterName: "external_api.inspections",
        periodStart: "2026-06-01T00:00:00.000Z"
      })
    );
  });

  it("fails loudly for malformed entitlement and usage rows", async () => {
    const malformedEntitlement = createPostgresEntitlementStore(
      executor([entitlementRow({ monthly_crawled_urls_limit: 0 })])
    );
    await expect(
      malformedEntitlement.canStartCrawl({
        organizationId: "org-1",
        projectId: "project-1",
        environmentId: "env-1",
        maxUrls: 10
      })
    ).rejects.toThrow(
      "Entitlement row monthly_crawled_urls_limit must be a positive integer."
    );

    const malformedUsage = createPostgresEntitlementStore(
      executor([entitlementRow(), usageRow(-1)])
    );
    await expect(
      malformedUsage.canStartCrawl({
        organizationId: "org-1",
        projectId: "project-1",
        environmentId: "env-1",
        maxUrls: 10
      })
    ).rejects.toThrow("Usage counter row used must be a non-negative integer.");
  });
});

function executor(
  rows: Array<Record<string, unknown> | undefined>,
  queries: PostgresQuery[] = []
): PostgresQueryExecutor {
  const pending = [...rows];
  return {
    async query<Row extends Record<string, unknown>>(
      query: PostgresQuery
    ): Promise<PostgresQueryResult<Row>> {
      queries.push(query);
      const row = pending.shift();
      return {
        rows: row ? ([row] as Row[]) : []
      };
    }
  };
}

function entitlementRow(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    id: "entitlement-1",
    organization_id: "org-1",
    plan_tier: "team",
    status: "active",
    current_period_start: "2026-06-01T00:00:00.000Z",
    current_period_end: "2026-07-01T00:00:00.000Z",
    crawl_max_urls_per_run: 1000,
    monthly_crawled_urls_limit: 10_000,
    external_api_monthly_limit: 500,
    report_retention_days: 90,
    source: "stripe",
    created_at: "2026-06-01T00:00:00.000Z",
    ...overrides
  };
}

function usageRow(used: number): Record<string, unknown> {
  return {
    used
  };
}
