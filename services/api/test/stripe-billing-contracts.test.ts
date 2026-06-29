import { describe, expect, it } from "vitest";

import {
  stripeBillingContract,
  validateStripeBillingContract
} from "../src/index.js";

describe("stripeBillingContract", () => {
  it("defines the approved Stripe billing contract", () => {
    expect(validateStripeBillingContract(stripeBillingContract)).toEqual([]);

    expect(stripeBillingContract).toMatchObject({
      id: "searchlint-stripe-billing-v1",
      contractVersion: 1,
      provider: "stripe-billing",
      environment: {
        variables: [
          {
            name: "SEARCHLINT_STRIPE_SECRET_KEY",
            required: true,
            secretSource: "aws-secrets-manager"
          },
          {
            name: "SEARCHLINT_STRIPE_WEBHOOK_SECRET",
            required: true,
            secretSource: "aws-secrets-manager"
          }
        ]
      }
    });
  });

  it("declares plan-tier limits that feed SearchLint-owned entitlements", () => {
    expect(
      stripeBillingContract.plans.map((plan) => ({
        planTier: plan.planTier,
        stripePriceLookupKey: plan.stripePriceLookupKey,
        limits: plan.limits
      }))
    ).toEqual([
      {
        planTier: "starter",
        stripePriceLookupKey: "searchlint_starter_monthly",
        limits: {
          crawlMaxUrlsPerRun: 1000,
          monthlyCrawledUrlsLimit: 10000,
          externalApiMonthlyLimit: 1000,
          reportRetentionDays: 30,
          contractOverrideAllowed: false
        }
      },
      {
        planTier: "team",
        stripePriceLookupKey: "searchlint_team_monthly",
        limits: {
          crawlMaxUrlsPerRun: 10000,
          monthlyCrawledUrlsLimit: 100000,
          externalApiMonthlyLimit: 10000,
          reportRetentionDays: 90,
          contractOverrideAllowed: false
        }
      },
      {
        planTier: "agency",
        stripePriceLookupKey: "searchlint_agency_monthly",
        limits: {
          crawlMaxUrlsPerRun: 25000,
          monthlyCrawledUrlsLimit: 500000,
          externalApiMonthlyLimit: 50000,
          reportRetentionDays: 180,
          contractOverrideAllowed: false
        }
      },
      {
        planTier: "enterprise",
        stripePriceLookupKey: "searchlint_enterprise_monthly",
        limits: {
          crawlMaxUrlsPerRun: 100000,
          monthlyCrawledUrlsLimit: 2000000,
          externalApiMonthlyLimit: 250000,
          reportRetentionDays: 365,
          contractOverrideAllowed: true
        }
      }
    ]);
  });

  it("declares webhook event handling boundaries", () => {
    expect(stripeBillingContract.webhooks).toEqual({
      signingSecretEnv: "SEARCHLINT_STRIPE_WEBHOOK_SECRET",
      idempotencyKey: "stripe_event_id",
      events: [
        "customer.subscription.created",
        "customer.subscription.updated",
        "customer.subscription.deleted",
        "invoice.payment_failed",
        "invoice.payment_succeeded"
      ],
      updates: {
        entitlementTable: "organization_entitlements",
        usageCounterTable: "usage_counters",
        billableUsageEventTable: "billable_usage_events",
        source: "stripe",
        tenantAuthorizationSource: false
      }
    });
  });

  it("maps Stripe subscription statuses to SearchLint entitlement statuses", () => {
    expect(stripeBillingContract.subscriptionStatusMappings).toEqual([
      {
        stripeStatus: "trialing",
        entitlementStatus: "trialing"
      },
      {
        stripeStatus: "active",
        entitlementStatus: "active"
      },
      {
        stripeStatus: "past_due",
        entitlementStatus: "past_due"
      },
      {
        stripeStatus: "canceled",
        entitlementStatus: "cancelled"
      },
      {
        stripeStatus: "unpaid",
        entitlementStatus: "expired"
      },
      {
        stripeStatus: "incomplete",
        entitlementStatus: "past_due"
      },
      {
        stripeStatus: "incomplete_expired",
        entitlementStatus: "expired"
      }
    ]);
  });

  it("rejects missing secrets, plans, webhooks, status mappings, and direct tenant access", () => {
    const issues = validateStripeBillingContract({
      ...stripeBillingContract,
      provider: "other" as "stripe-billing",
      environment: {
        variables: [
          {
            ...stripeBillingContract.environment.variables[0]!,
            secretSource: "plain-env" as "aws-secrets-manager"
          }
        ]
      },
      plans: [
        {
          ...stripeBillingContract.plans[0]!,
          stripePriceLookupKey:
            "searchlint_wrong_monthly" as "searchlint_starter_monthly",
          limits: {
            ...stripeBillingContract.plans[0]!.limits,
            crawlMaxUrlsPerRun: 0,
            contractOverrideAllowed: true
          }
        }
      ],
      webhooks: {
        ...stripeBillingContract.webhooks,
        idempotencyKey: "organization_id" as "stripe_event_id",
        events: ["customer.subscription.created"],
        updates: {
          ...stripeBillingContract.webhooks.updates,
          source: "manual" as "stripe",
          tenantAuthorizationSource: true as false
        }
      },
      subscriptionStatusMappings: [
        {
          stripeStatus: "active",
          entitlementStatus: "expired"
        }
      ]
    });

    expect(issues).toEqual(
      expect.arrayContaining([
        {
          path: "provider",
          message: "provider must be stripe-billing."
        },
        {
          path: "environment.variables.SEARCHLINT_STRIPE_SECRET_KEY.secretSource",
          message:
            "environment.variables.SEARCHLINT_STRIPE_SECRET_KEY.secretSource must be aws-secrets-manager."
        },
        {
          path: "environment.variables",
          message:
            "SEARCHLINT_STRIPE_WEBHOOK_SECRET Stripe environment variable is required."
        },
        {
          path: "plans.starter.stripePriceLookupKey",
          message:
            "plans.starter.stripePriceLookupKey must be searchlint_starter_monthly."
        },
        {
          path: "plans.starter.limits.crawlMaxUrlsPerRun",
          message:
            "plans.starter.limits.crawlMaxUrlsPerRun must be a positive integer."
        },
        {
          path: "plans.starter.limits.contractOverrideAllowed",
          message: "plans.starter.limits.contractOverrideAllowed must be false."
        },
        {
          path: "plans",
          message: "team Stripe plan mapping is required."
        },
        {
          path: "webhooks.idempotencyKey",
          message: "webhooks.idempotencyKey must be stripe_event_id."
        },
        {
          path: "webhooks.events",
          message: "customer.subscription.updated is required."
        },
        {
          path: "webhooks.updates.source",
          message: "webhooks.updates.source must be stripe."
        },
        {
          path: "webhooks.updates.tenantAuthorizationSource",
          message: "webhooks.updates.tenantAuthorizationSource must be false."
        },
        {
          path: "subscriptionStatusMappings.active.entitlementStatus",
          message:
            "subscriptionStatusMappings.active.entitlementStatus must be active."
        },
        {
          path: "subscriptionStatusMappings",
          message: "trialing subscription status mapping is required."
        }
      ])
    );
  });
});
