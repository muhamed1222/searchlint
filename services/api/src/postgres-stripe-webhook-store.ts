import { stripeBillingContract } from "./stripe-billing-contracts.js";
import type { StripeWebhookStore } from "./ports.js";
import {
  recordStripeWebhookEventSql,
  selectStripeBillingIdentitySql,
  upsertStripeOrganizationEntitlementSql
} from "./postgres-repository-sql.js";
import type { PostgresQueryExecutor } from "./postgres-relational-store.js";
import type {
  OrganizationEntitlement,
  PlanTier,
  StripeWebhookApplyResult,
  StripeWebhookProcessedEvent
} from "./types.js";
import type {
  StripeWebhookNormalizedEvent,
  StripeWebhookPaymentSignalIntent,
  StripeWebhookSubscriptionEntitlementUpdateIntent
} from "./stripe-webhook.js";

type StripeBillingIdentityRow = {
  organization_id: unknown;
  plan_tier: unknown;
};

type StripeWebhookEventRow = {
  organization_id: unknown;
};

export type PostgresStripeWebhookStoreOptions = {
  executor: PostgresQueryExecutor;
  ids: {
    nextId(prefix: string): string;
  };
  clock: {
    now(): string;
  };
};

export function createPostgresStripeWebhookStore(
  options: PostgresStripeWebhookStoreOptions
): StripeWebhookStore {
  return {
    async apply(event) {
      const mapping = await resolveStripeBillingIdentity(
        options.executor,
        event.intent
      );
      if (!mapping) {
        return {
          status: "ignored",
          reason:
            "No active SearchLint organization mapping exists for the Stripe webhook intent.",
          stripeEventId: event.id
        };
      }

      const processedAt = options.clock.now();
      const insertedEvent = (
        await options.executor.query<StripeWebhookEventRow>(
          recordStripeWebhookEventSql(
            processedWebhookEvent({
              id: options.ids.nextId("stripe_webhook_event"),
              organizationId: mapping.organizationId,
              event,
              processedAt
            })
          )
        )
      ).rows[0];

      if (!insertedEvent) {
        return {
          status: "duplicate",
          organizationId: mapping.organizationId,
          stripeEventId: event.id
        };
      }

      if (event.intent.kind === "subscription-entitlement-update") {
        await options.executor.query(
          upsertStripeOrganizationEntitlementSql(
            entitlementFromSubscriptionIntent({
              id: `stripe:${event.intent.stripeSubscriptionId}`,
              organizationId: mapping.organizationId,
              planTier: mapping.planTier,
              intent: event.intent,
              createdAt: processedAt
            })
          )
        );
      }

      return {
        status: "applied",
        organizationId: mapping.organizationId,
        stripeEventId: event.id
      };
    }
  };
}

async function resolveStripeBillingIdentity(
  executor: PostgresQueryExecutor,
  intent:
    | StripeWebhookSubscriptionEntitlementUpdateIntent
    | StripeWebhookPaymentSignalIntent
): Promise<{ organizationId: string; planTier: PlanTier } | undefined> {
  const row = (
    await executor.query<StripeBillingIdentityRow>(
      selectStripeBillingIdentitySql({
        ...stripeSubscriptionIdProperty(intent),
        ...stripeCustomerIdProperty(intent)
      })
    )
  ).rows[0];

  if (!row) {
    return undefined;
  }

  return {
    organizationId: text(row.organization_id, "organization_id"),
    planTier: planTier(row.plan_tier)
  };
}

function processedWebhookEvent(input: {
  id: string;
  organizationId: string;
  event: StripeWebhookNormalizedEvent;
  processedAt: string;
}): StripeWebhookProcessedEvent {
  return {
    id: input.id,
    organizationId: input.organizationId,
    stripeEventId: input.event.id,
    stripeEventType: input.event.type,
    intentKind: input.event.intent.kind,
    processedAt: input.processedAt
  };
}

function entitlementFromSubscriptionIntent(input: {
  id: string;
  organizationId: string;
  planTier: PlanTier;
  intent: StripeWebhookSubscriptionEntitlementUpdateIntent;
  createdAt: string;
}): OrganizationEntitlement {
  const limits = stripeBillingContract.plans.find(
    (plan) => plan.planTier === input.planTier
  )?.limits;
  if (!limits) {
    throw new Error(`Missing Stripe billing limits for ${input.planTier}.`);
  }

  return {
    id: input.id,
    organizationId: input.organizationId,
    planTier: input.planTier,
    status: input.intent.entitlementStatus,
    currentPeriodStart: input.intent.currentPeriodStart,
    currentPeriodEnd: input.intent.currentPeriodEnd,
    crawlMaxUrlsPerRun: limits.crawlMaxUrlsPerRun,
    monthlyCrawledUrlsLimit: limits.monthlyCrawledUrlsLimit,
    externalApiMonthlyLimit: limits.externalApiMonthlyLimit,
    reportRetentionDays: limits.reportRetentionDays,
    source: "stripe",
    createdAt: input.createdAt
  };
}

function stripeSubscriptionIdProperty(
  intent:
    | StripeWebhookSubscriptionEntitlementUpdateIntent
    | StripeWebhookPaymentSignalIntent
): { stripeSubscriptionId?: string } {
  return intent.stripeSubscriptionId
    ? { stripeSubscriptionId: intent.stripeSubscriptionId }
    : {};
}

function stripeCustomerIdProperty(
  intent:
    | StripeWebhookSubscriptionEntitlementUpdateIntent
    | StripeWebhookPaymentSignalIntent
): { stripeCustomerId?: string } {
  return intent.stripeCustomerId
    ? { stripeCustomerId: intent.stripeCustomerId }
    : {};
}

function text(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(
      `Stripe billing identity ${field} must be a non-empty string.`
    );
  }
  return value;
}

function planTier(value: unknown): PlanTier {
  const tier = text(value, "plan_tier");
  if (
    tier !== "starter" &&
    tier !== "team" &&
    tier !== "agency" &&
    tier !== "enterprise"
  ) {
    throw new Error(`Unsupported Stripe billing identity plan tier ${tier}.`);
  }
  return tier;
}
