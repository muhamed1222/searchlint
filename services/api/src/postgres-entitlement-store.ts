import type { EntitlementStore } from "./ports.js";
import {
  selectOrganizationEntitlementSql,
  selectUsageCounterSql
} from "./postgres-repository-sql.js";
import type { PostgresQueryExecutor } from "./postgres-relational-store.js";
import type { EntitlementStatus, PlanTier } from "./types.js";

type EntitlementRow = {
  id: unknown;
  organization_id: unknown;
  plan_tier: unknown;
  status: unknown;
  current_period_start: unknown;
  current_period_end: unknown;
  crawl_max_urls_per_run: unknown;
  monthly_crawled_urls_limit: unknown;
  external_api_monthly_limit: unknown;
  report_retention_days: unknown;
  source: unknown;
  created_at: unknown;
};

type UsageCounterRow = {
  used: unknown;
};

const activeStatuses = new Set<EntitlementStatus>(["active", "trialing"]);

export function createPostgresEntitlementStore(
  executor: PostgresQueryExecutor
): EntitlementStore {
  return {
    async canStartCrawl(input) {
      const entitlement = await activeEntitlement(
        executor,
        input.organizationId
      );
      if (!entitlement.allowed) {
        return entitlement;
      }

      const maxUrlsPerRun = positiveInteger(
        entitlement.row.crawl_max_urls_per_run,
        "crawl_max_urls_per_run"
      );
      if (input.maxUrls > maxUrlsPerRun) {
        return {
          allowed: false,
          reason: `Requested crawl size exceeds plan limit of ${maxUrlsPerRun} URLs per run.`
        };
      }

      return monthlyQuotaDecision({
        executor,
        organizationId: input.organizationId,
        entitlement: entitlement.row,
        counterName: "crawl.urls",
        requestedAmount: input.maxUrls,
        limitField: "monthly_crawled_urls_limit",
        exceededReason(limit, periodEnd) {
          return `Monthly crawled URL quota exceeded for period ending ${periodEnd}.`;
        }
      });
    },

    async canUseExternalApiInspection(input) {
      const entitlement = await activeEntitlement(
        executor,
        input.organizationId
      );
      if (!entitlement.allowed) {
        return entitlement;
      }

      return monthlyQuotaDecision({
        executor,
        organizationId: input.organizationId,
        entitlement: entitlement.row,
        counterName: "external_api.inspections",
        requestedAmount: input.inspections,
        limitField: "external_api_monthly_limit",
        exceededReason(limit, periodEnd) {
          return `${input.provider} external API inspection quota exceeded for period ending ${periodEnd}.`;
        }
      });
    }
  };
}

async function activeEntitlement(
  executor: PostgresQueryExecutor,
  organizationId: string
): Promise<
  | {
      allowed: true;
      row: EntitlementRow;
    }
  | {
      allowed: false;
      reason: string;
    }
> {
  const entitlement = (
    await executor.query<EntitlementRow>(
      selectOrganizationEntitlementSql(organizationId)
    )
  ).rows[0];

  if (!entitlement) {
    return {
      allowed: false,
      reason: "No active cloud entitlement is configured."
    };
  }

  const status = entitlementStatus(entitlement.status);
  if (!activeStatuses.has(status)) {
    return {
      allowed: false,
      reason: `Cloud subscription is ${status}.`
    };
  }

  // Validate invariant fields once before any expensive work can be allowed.
  planTier(entitlement.plan_tier);
  positiveInteger(entitlement.crawl_max_urls_per_run, "crawl_max_urls_per_run");
  positiveInteger(
    entitlement.monthly_crawled_urls_limit,
    "monthly_crawled_urls_limit"
  );
  positiveInteger(
    entitlement.external_api_monthly_limit,
    "external_api_monthly_limit"
  );
  positiveInteger(entitlement.report_retention_days, "report_retention_days");
  source(entitlement.source);

  return {
    allowed: true,
    row: entitlement
  };
}

async function monthlyQuotaDecision(input: {
  executor: PostgresQueryExecutor;
  organizationId: string;
  entitlement: EntitlementRow;
  counterName: "crawl.urls" | "external_api.inspections";
  requestedAmount: number;
  limitField: "monthly_crawled_urls_limit" | "external_api_monthly_limit";
  exceededReason(limit: number, periodEnd: string): string;
}): Promise<Awaited<ReturnType<EntitlementStore["canStartCrawl"]>>> {
  const monthlyLimit = positiveInteger(
    input.entitlement[input.limitField],
    input.limitField
  );
  const periodStart = text(
    input.entitlement.current_period_start,
    "current_period_start"
  );
  const periodEnd = text(
    input.entitlement.current_period_end,
    "current_period_end"
  );
  const usage = (
    await input.executor.query<UsageCounterRow>(
      selectUsageCounterSql({
        organizationId: input.organizationId,
        counterName: input.counterName,
        periodStart
      })
    )
  ).rows[0];
  const used = usage ? nonNegativeInteger(usage.used, "used") : 0;

  if (used + input.requestedAmount > monthlyLimit) {
    return {
      allowed: false,
      reason: input.exceededReason(monthlyLimit, periodEnd)
    };
  }

  return {
    allowed: true,
    billableUsage: {
      counterName: input.counterName,
      amount: input.requestedAmount,
      periodStart,
      periodEnd
    }
  };
}

function text(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Entitlement row ${field} must be a non-empty string.`);
  }
  return value;
}

function positiveInteger(value: unknown, field: string): number {
  if (!Number.isInteger(value) || (value as number) < 1) {
    throw new Error(`Entitlement row ${field} must be a positive integer.`);
  }
  return value as number;
}

function nonNegativeInteger(value: unknown, field: string): number {
  if (!Number.isInteger(value) || (value as number) < 0) {
    throw new Error(
      `Usage counter row ${field} must be a non-negative integer.`
    );
  }
  return value as number;
}

function entitlementStatus(value: unknown): EntitlementStatus {
  const status = text(value, "status");
  if (
    status !== "trialing" &&
    status !== "active" &&
    status !== "past_due" &&
    status !== "cancelled" &&
    status !== "expired"
  ) {
    throw new Error(`Unsupported entitlement status ${status}.`);
  }
  return status;
}

function planTier(value: unknown): PlanTier {
  const tier = text(value, "plan_tier");
  if (
    tier !== "starter" &&
    tier !== "team" &&
    tier !== "agency" &&
    tier !== "enterprise"
  ) {
    throw new Error(`Unsupported plan tier ${tier}.`);
  }
  return tier;
}

function source(value: unknown): "stripe" | "manual" {
  const entitlementSource = text(value, "source");
  if (entitlementSource !== "stripe" && entitlementSource !== "manual") {
    throw new Error(`Unsupported entitlement source ${entitlementSource}.`);
  }
  return entitlementSource;
}
