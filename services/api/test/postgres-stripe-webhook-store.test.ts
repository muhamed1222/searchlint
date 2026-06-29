import { describe, expect, it } from "vitest";

import { createPostgresStripeWebhookStore } from "../src/index.js";
import type {
  PostgresQuery,
  PostgresQueryExecutor,
  PostgresQueryResult,
  StripeWebhookNormalizedEvent
} from "../src/index.js";

const processedAt = "2026-06-21T12:00:00.000Z";

describe("createPostgresStripeWebhookStore", () => {
  it("applies subscription webhook intents through a mapped organization", async () => {
    const executor = executorWithRows([
      [{ organization_id: "org-1", plan_tier: "team" }],
      [{ organization_id: "org-1" }],
      [{ id: "stripe:sub-1" }]
    ]);
    const store = createStore(executor);

    await expect(store.apply(subscriptionEvent())).resolves.toEqual({
      status: "applied",
      organizationId: "org-1",
      stripeEventId: "evt-subscription"
    });

    expect(executor.queries.map((query) => query.text)).toEqual([
      'SELECT * FROM "stripe_billing_identities" WHERE "active" = $1 AND "deletion_state" = $2 AND ("stripe_subscription_id" = $3 OR "stripe_customer_id" = $4) ORDER BY CASE WHEN "stripe_subscription_id" = $3 THEN 0 ELSE 1 END ASC, "created_at" DESC LIMIT 1;',
      'INSERT INTO "stripe_webhook_events" ("id", "organization_id", "schema_version", "created_at", "retention_until", "deletion_state", "stripe_event_id", "stripe_event_type", "intent_kind", "processed_at") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $4) ON CONFLICT ("organization_id", "stripe_event_id") DO NOTHING RETURNING *;',
      'INSERT INTO "organization_entitlements" ("id", "organization_id", "schema_version", "created_at", "retention_until", "deletion_state", "plan_tier", "status", "current_period_start", "current_period_end", "crawl_max_urls_per_run", "monthly_crawled_urls_limit", "external_api_monthly_limit", "report_retention_days", "source") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) ON CONFLICT ("id") DO UPDATE SET "plan_tier" = EXCLUDED."plan_tier", "status" = EXCLUDED."status", "current_period_start" = EXCLUDED."current_period_start", "current_period_end" = EXCLUDED."current_period_end", "crawl_max_urls_per_run" = EXCLUDED."crawl_max_urls_per_run", "monthly_crawled_urls_limit" = EXCLUDED."monthly_crawled_urls_limit", "external_api_monthly_limit" = EXCLUDED."external_api_monthly_limit", "report_retention_days" = EXCLUDED."report_retention_days", "source" = EXCLUDED."source", "created_at" = EXCLUDED."created_at", "retention_until" = EXCLUDED."retention_until", "deletion_state" = EXCLUDED."deletion_state" RETURNING *;'
    ]);
    expect(executor.queries[2]?.values).toEqual([
      "stripe:sub-1",
      "org-1",
      "cloud.organization_entitlements.v1",
      processedAt,
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
    ]);
  });

  it("returns duplicate when the Stripe webhook event is already processed", async () => {
    const executor = executorWithRows([
      [{ organization_id: "org-1", plan_tier: "team" }],
      []
    ]);
    const store = createStore(executor);

    await expect(store.apply(subscriptionEvent())).resolves.toEqual({
      status: "duplicate",
      organizationId: "org-1",
      stripeEventId: "evt-subscription"
    });

    expect(executor.queries).toHaveLength(2);
  });

  it("records invoice payment signals without mutating entitlements", async () => {
    const executor = executorWithRows([
      [{ organization_id: "org-1", plan_tier: "team" }],
      [{ organization_id: "org-1" }]
    ]);
    const store = createStore(executor);

    await expect(store.apply(invoiceEvent())).resolves.toEqual({
      status: "applied",
      organizationId: "org-1",
      stripeEventId: "evt-invoice"
    });

    expect(executor.queries).toHaveLength(2);
    expect(executor.queries[1]?.values).toContain("payment-signal");
  });

  it("ignores webhook intents without an active SearchLint organization mapping", async () => {
    const executor = executorWithRows([[]]);
    const store = createStore(executor);

    await expect(store.apply(subscriptionEvent())).resolves.toEqual({
      status: "ignored",
      reason:
        "No active SearchLint organization mapping exists for the Stripe webhook intent.",
      stripeEventId: "evt-subscription"
    });

    expect(executor.queries).toHaveLength(1);
  });
});

function createStore(executor: RecordingExecutor) {
  return createPostgresStripeWebhookStore({
    executor,
    ids: {
      nextId(prefix) {
        return `${prefix}-1`;
      }
    },
    clock: {
      now() {
        return processedAt;
      }
    }
  });
}

function subscriptionEvent(): StripeWebhookNormalizedEvent {
  return {
    id: "evt-subscription",
    type: "customer.subscription.updated",
    created: 1_783_000_000,
    receivedAt: processedAt,
    idempotencyKey: "evt-subscription",
    intent: {
      kind: "subscription-entitlement-update",
      stripeEventId: "evt-subscription",
      stripeEventType: "customer.subscription.updated",
      stripeSubscriptionId: "sub-1",
      stripeCustomerId: "cus-1",
      stripePriceLookupKey: "searchlint_team_monthly",
      entitlementStatus: "active",
      currentPeriodStart: "2026-06-01T00:00:00.000Z",
      currentPeriodEnd: "2026-07-01T00:00:00.000Z",
      source: "stripe",
      idempotencyKey: "evt-subscription"
    },
    rawEvent: {}
  };
}

function invoiceEvent(): StripeWebhookNormalizedEvent {
  return {
    id: "evt-invoice",
    type: "invoice.payment_succeeded",
    created: 1_783_000_000,
    receivedAt: processedAt,
    idempotencyKey: "evt-invoice",
    intent: {
      kind: "payment-signal",
      stripeEventId: "evt-invoice",
      stripeEventType: "invoice.payment_succeeded",
      stripeInvoiceId: "in-1",
      stripeCustomerId: "cus-1",
      stripeSubscriptionId: "sub-1",
      signal: "invoice-payment-succeeded",
      occurredAt: processedAt,
      source: "stripe",
      idempotencyKey: "evt-invoice"
    },
    rawEvent: {}
  };
}

type RecordingExecutor = PostgresQueryExecutor & {
  queries: PostgresQuery[];
};

function executorWithRows(
  rows: Array<readonly Record<string, unknown>[]>
): RecordingExecutor {
  const queries: PostgresQuery[] = [];
  return {
    queries,
    async query<Row extends Record<string, unknown>>(
      query: PostgresQuery
    ): Promise<PostgresQueryResult<Row>> {
      queries.push(query);
      return {
        rows: (rows.shift() ?? []) as Row[]
      };
    }
  };
}
