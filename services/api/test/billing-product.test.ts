import { describe, expect, it } from "vitest";

import {
  billingPlanSummaries,
  createBillingCancellationIntent,
  createBillingCheckoutSessionRequest,
  createBillingPlanChangeIntent,
  createBillingPortalSessionRequest,
  overagePolicyForPlan,
  publicBillingPricingTiers,
  summarizeBillingInvoices,
  summarizeBillingSubscription,
  summarizeBillingUsage,
  stripeCheckoutPaymentAcceptancePacket,
  stripeCustomerPortalAcceptancePacket,
  stripeFinalAcceptancePacket,
  stripeProductPriceBlueprints,
  stripeProductPriceSetupPacket,
  stripeSubscriptionLifecycleAcceptancePacket,
  stripeWebhookRdsPersistenceAcceptancePacket
} from "../src/index.js";
import type { OrganizationEntitlement } from "../src/index.js";

describe("billing product helpers", () => {
  it("creates deterministic sanitized checkout session requests", () => {
    expect(
      createBillingCheckoutSessionRequest({
        organizationId: "org-1",
        planTier: "team",
        successUrl: "https://app.searchlint.example/billing/success",
        cancelUrl: "https://app.searchlint.example/billing/cancel",
        allowPromotionCodes: true,
        trialDays: 14,
        stripeCustomerId: "cus_123"
      })
    ).toEqual({
      mode: "subscription",
      clientReferenceId: "org-1",
      priceLookupKey: "searchlint_team_monthly",
      successUrl: "https://app.searchlint.example/billing/success",
      cancelUrl: "https://app.searchlint.example/billing/cancel",
      allowPromotionCodes: true,
      trialDays: 14,
      stripeCustomerId: "cus_123",
      metadata: {
        organizationId: "org-1",
        planTier: "team",
        entitlementSource: "searchlint"
      }
    });

    expect(() =>
      createBillingCheckoutSessionRequest({
        organizationId: "org-1",
        planTier: "starter",
        successUrl: "ftp://app.searchlint.example/success",
        cancelUrl: "https://app.searchlint.example/cancel",
        allowPromotionCodes: false
      })
    ).toThrow("Billing successUrl must be an absolute HTTP(S) URL.");
  });

  it("creates deterministic customer portal session requests", () => {
    expect(
      createBillingPortalSessionRequest({
        organizationId: "org-1",
        stripeCustomerId: "cus_123",
        returnUrl: "https://app.searchlint.example/billing"
      })
    ).toEqual({
      stripeCustomerId: "cus_123",
      returnUrl: "https://app.searchlint.example/billing",
      flow: "customer_portal",
      metadata: {
        organizationId: "org-1"
      }
    });
  });

  it("summarizes plan limits from the approved Stripe billing contract", () => {
    expect(billingPlanSummaries()).toEqual([
      expect.objectContaining({
        planTier: "starter",
        priceLookupKey: "searchlint_starter_monthly",
        crawlMaxUrlsPerRun: 1000,
        monthlyCrawledUrlsLimit: 10000,
        externalApiMonthlyLimit: 1000,
        reportRetentionDays: 30,
        contractOverrideAllowed: false
      }),
      expect.objectContaining({
        planTier: "team",
        priceLookupKey: "searchlint_team_monthly",
        crawlMaxUrlsPerRun: 10000
      }),
      expect.objectContaining({
        planTier: "agency",
        priceLookupKey: "searchlint_agency_monthly",
        monthlyCrawledUrlsLimit: 500000
      }),
      expect.objectContaining({
        planTier: "enterprise",
        priceLookupKey: "searchlint_enterprise_monthly",
        contractOverrideAllowed: true
      })
    ]);
  });

  it("defines release-candidate public pricing and Stripe product price blueprints", () => {
    expect(
      publicBillingPricingTiers().map((tier) => ({
        planTier: tier.planTier,
        displayName: tier.displayName,
        monthlyPriceUsdCents: tier.monthlyPriceUsdCents,
        priceLookupKey: tier.priceLookupKey,
        billingInterval: tier.billingInterval,
        publicPriceStatus: tier.publicPriceStatus,
        crawlMaxUrlsPerRun: tier.crawlMaxUrlsPerRun
      }))
    ).toEqual([
      {
        planTier: "starter",
        displayName: "Starter",
        monthlyPriceUsdCents: 2900,
        priceLookupKey: "searchlint_starter_monthly",
        billingInterval: "month",
        publicPriceStatus: "release_candidate",
        crawlMaxUrlsPerRun: 1000
      },
      {
        planTier: "team",
        displayName: "Team",
        monthlyPriceUsdCents: 4900,
        priceLookupKey: "searchlint_team_monthly",
        billingInterval: "month",
        publicPriceStatus: "release_candidate",
        crawlMaxUrlsPerRun: 10000
      },
      {
        planTier: "agency",
        displayName: "Agency",
        monthlyPriceUsdCents: 19900,
        priceLookupKey: "searchlint_agency_monthly",
        billingInterval: "month",
        publicPriceStatus: "release_candidate",
        crawlMaxUrlsPerRun: 25000
      },
      {
        planTier: "enterprise",
        displayName: "Enterprise",
        monthlyPriceUsdCents: "contact_sales",
        priceLookupKey: "searchlint_enterprise_monthly",
        billingInterval: "month",
        publicPriceStatus: "release_candidate",
        crawlMaxUrlsPerRun: 100000
      }
    ]);

    expect(stripeProductPriceBlueprints()).toEqual([
      expect.objectContaining({
        planTier: "starter",
        productLookupKey: "searchlint_starter",
        priceLookupKey: "searchlint_starter_monthly",
        unitAmountCents: 2900,
        currency: "usd",
        recurringInterval: "month",
        taxBehavior: "exclusive"
      }),
      expect.objectContaining({
        planTier: "team",
        productLookupKey: "searchlint_team",
        unitAmountCents: 4900
      }),
      expect.objectContaining({
        planTier: "agency",
        productLookupKey: "searchlint_agency",
        unitAmountCents: 19900
      }),
      expect.objectContaining({
        planTier: "enterprise",
        productLookupKey: "searchlint_enterprise",
        unitAmountCents: "custom"
      })
    ]);
  });

  it("creates a deterministic Stripe product and price live setup packet", () => {
    const packet = stripeProductPriceSetupPacket();

    expect(packet).toMatchObject({
      setupVersion: 1,
      mode: "manual-live-stripe-setup",
      requiredEnvironment: ["STRIPE_SECRET_KEY"],
      doesNotIncludeSecrets: true
    });
    expect(
      packet.entries.map((entry) => ({
        planTier: entry.planTier,
        productIdempotencyKey: entry.product.idempotencyKey,
        productName: entry.product.name,
        priceIdempotencyKey: entry.price?.idempotencyKey,
        priceLookupKey: entry.price?.lookupKey,
        unitAmountCents: entry.price?.unitAmountCents
      }))
    ).toEqual([
      {
        planTier: "starter",
        productIdempotencyKey: "searchlint_product_starter_v1",
        productName: "SearchLint Starter",
        priceIdempotencyKey: "searchlint_price_starter_monthly_v1",
        priceLookupKey: "searchlint_starter_monthly",
        unitAmountCents: 2900
      },
      {
        planTier: "team",
        productIdempotencyKey: "searchlint_product_team_v1",
        productName: "SearchLint Team",
        priceIdempotencyKey: "searchlint_price_team_monthly_v1",
        priceLookupKey: "searchlint_team_monthly",
        unitAmountCents: 4900
      },
      {
        planTier: "agency",
        productIdempotencyKey: "searchlint_product_agency_v1",
        productName: "SearchLint Agency",
        priceIdempotencyKey: "searchlint_price_agency_monthly_v1",
        priceLookupKey: "searchlint_agency_monthly",
        unitAmountCents: 19900
      },
      {
        planTier: "enterprise",
        productIdempotencyKey: "searchlint_product_enterprise_v1",
        productName: "SearchLint Enterprise",
        priceIdempotencyKey: undefined,
        priceLookupKey: undefined,
        unitAmountCents: undefined
      }
    ]);
    expect(
      packet.entries.find((entry) => entry.planTier === "enterprise")
        ?.verification
    ).toContain(
      "No fixed recurring price is created for contact-sales Enterprise pricing."
    );
  });

  it("creates a live Stripe checkout payment acceptance packet that blocks fake completion", () => {
    const packet = stripeCheckoutPaymentAcceptancePacket();

    expect(packet).toMatchObject({
      acceptanceVersion: 1,
      gate: "live-stripe-checkout-payment",
      status: "blocked_until_owner_evidence"
    });
    expect(packet.requiredEvidence.map((item) => item.id)).toEqual([
      "stripe-checkout-session",
      "stripe-customer",
      "stripe-subscription",
      "stripe-payment-or-invoice",
      "stripe-webhook-events",
      "searchlint-entitlement"
    ]);
    expect(packet.requiredEvidence.every((item) => item.sanitized)).toBe(true);
    expect(packet.passCriteria).toContain(
      "SearchLint entitlement is updated from Stripe webhook processing."
    );
    expect(packet.forbiddenEvidence).toEqual(
      expect.arrayContaining([
        "Stripe secret keys",
        "Stripe webhook signing secrets",
        "full card numbers",
        "raw customer email addresses",
        "authorization headers",
        "bearer tokens"
      ])
    );
  });

  it("creates a live Stripe customer portal acceptance packet that blocks fake completion", () => {
    const packet = stripeCustomerPortalAcceptancePacket();

    expect(packet).toMatchObject({
      acceptanceVersion: 1,
      gate: "live-stripe-customer-portal",
      status: "blocked_until_owner_evidence"
    });
    expect(packet.requiredEvidence.map((item) => item.id)).toEqual([
      "stripe-portal-session",
      "stripe-portal-redirect",
      "stripe-customer",
      "stripe-subscription-before",
      "stripe-portal-action",
      "stripe-subscription-after",
      "stripe-webhook-events",
      "searchlint-entitlement"
    ]);
    expect(packet.requiredEvidence.every((item) => item.sanitized)).toBe(true);
    expect(packet.passCriteria).toContain(
      "SearchLint entitlement reflects the portal-driven subscription change or scheduled cancellation."
    );
    expect(packet.forbiddenEvidence).toEqual(
      expect.arrayContaining([
        "Stripe secret keys",
        "Stripe webhook signing secrets",
        "full card numbers",
        "raw customer email addresses",
        "authorization headers",
        "bearer tokens",
        "unredacted portal URLs"
      ])
    );
  });

  it("creates a live Stripe subscription lifecycle acceptance packet that blocks fake completion", () => {
    const packet = stripeSubscriptionLifecycleAcceptancePacket();

    expect(packet).toMatchObject({
      acceptanceVersion: 1,
      gate: "live-stripe-subscription-lifecycle",
      status: "blocked_until_owner_evidence"
    });
    expect(packet.requiredLifecycleScenarios).toEqual([
      "trial checkout starts a trialing subscription and SearchLint trial entitlement.",
      "trial conversion or paid checkout produces an active subscription and paid entitlement.",
      "upgrade moves the subscription to the higher plan with immediate or documented proration behavior.",
      "downgrade schedules or applies the lower plan according to the approved portal policy.",
      "cancellation schedules period-end cancellation and preserves entitlement until the paid-through date.",
      "invoice/payment events reconcile subscription status and SearchLint entitlement state."
    ]);
    expect(packet.requiredEvidence.map((item) => item.id)).toEqual([
      "stripe-trial-subscription",
      "stripe-paid-subscription",
      "stripe-upgrade-transition",
      "stripe-downgrade-transition",
      "stripe-cancellation-transition",
      "stripe-invoice-events",
      "stripe-webhook-events",
      "searchlint-entitlement-transitions",
      "searchlint-usage-limit-transitions"
    ]);
    expect(packet.requiredEvidence.every((item) => item.sanitized)).toBe(true);
    expect(packet.passCriteria).toContain(
      "Trial, upgrade, downgrade, cancellation, invoice, and usage-limit behavior match the approved OD-020 billing contract."
    );
    expect(packet.forbiddenEvidence).toEqual(
      expect.arrayContaining([
        "Stripe secret keys",
        "Stripe webhook signing secrets",
        "full card numbers",
        "raw customer email addresses",
        "authorization headers",
        "bearer tokens",
        "unredacted invoice URLs",
        "unredacted portal URLs"
      ])
    );
  });

  it("creates a deployed Stripe webhook RDS persistence acceptance packet that blocks fake completion", () => {
    const packet = stripeWebhookRdsPersistenceAcceptancePacket();

    expect(packet).toMatchObject({
      acceptanceVersion: 1,
      gate: "deployed-stripe-webhook-rds-persistence",
      status: "blocked_until_owner_evidence"
    });
    expect(packet.requiredEvidence.map((item) => item.id)).toEqual([
      "deployed-webhook-request",
      "rds-stripe-webhook-event-row",
      "rds-idempotency-proof",
      "rds-entitlement-update",
      "invoice-signal-persistence",
      "webhook-error-path",
      "audit-metrics-log-redaction",
      "schema-version-proof"
    ]);
    expect(packet.requiredEvidence.every((item) => item.sanitized)).toBe(true);
    expect(packet.passCriteria).toContain(
      "Invalid or stale signatures are rejected and do not persist processed webhook rows."
    );
    expect(packet.forbiddenEvidence).toEqual(
      expect.arrayContaining([
        "Stripe secret keys",
        "Stripe webhook signing secrets",
        "raw database URLs",
        "database passwords",
        "authorization headers",
        "bearer tokens",
        "unredacted webhook payloads"
      ])
    );
  });

  it("creates a final live Stripe acceptance packet that blocks fake completion", () => {
    const packet = stripeFinalAcceptancePacket();

    expect(packet).toMatchObject({
      acceptanceVersion: 1,
      gate: "live-stripe-final-acceptance",
      status: "blocked_until_owner_evidence"
    });
    expect(packet.requiredPredecessorGates).toEqual([
      "stripe-products-prices-live-setup",
      "live-stripe-checkout-payment",
      "live-stripe-customer-portal",
      "live-stripe-subscription-lifecycle",
      "deployed-stripe-webhook-rds-persistence"
    ]);
    expect(packet.requiredEvidence.map((item) => item.id)).toEqual([
      "stripe-products-prices-live-setup",
      "live-checkout-payment",
      "live-customer-portal",
      "live-subscription-lifecycle",
      "deployed-webhook-rds-persistence",
      "billing-ui-e2e",
      "legal-pricing-approval",
      "owner-final-signoff"
    ]);
    expect(packet.requiredEvidence.every((item) => item.sanitized)).toBe(true);
    expect(packet.passCriteria).toContain(
      "Legal/pricing approval is recorded before public launch or paid customer access."
    );
    expect(packet.forbiddenEvidence).toEqual(
      expect.arrayContaining([
        "Stripe secret keys",
        "Stripe webhook signing secrets",
        "raw database URLs",
        "full card numbers",
        "authorization headers",
        "bearer tokens",
        "unredacted webhook payloads"
      ])
    );
  });

  it("summarizes subscription, trial, plan changes, cancellations, and invoices", () => {
    const entitlement = organizationEntitlement({
      status: "trialing",
      planTier: "starter"
    });

    expect(summarizeBillingSubscription(entitlement)).toEqual({
      organizationId: "org-1",
      planTier: "starter",
      status: "trialing",
      source: "stripe",
      currentPeriodStart: "2026-06-01T00:00:00.000Z",
      currentPeriodEnd: "2026-07-01T00:00:00.000Z",
      trial: {
        active: true,
        endsAt: "2026-07-01T00:00:00.000Z"
      }
    });
    expect(
      createBillingPlanChangeIntent({
        organizationId: "org-1",
        fromPlanTier: "starter",
        toPlanTier: "team"
      })
    ).toMatchObject({
      direction: "upgrade",
      effectiveAt: "immediate",
      requiresStripePortal: true
    });
    expect(
      createBillingPlanChangeIntent({
        organizationId: "org-1",
        fromPlanTier: "agency",
        toPlanTier: "team"
      })
    ).toMatchObject({
      direction: "downgrade",
      effectiveAt: "period-end"
    });
    expect(createBillingCancellationIntent(entitlement)).toEqual({
      organizationId: "org-1",
      planTier: "starter",
      cancelAt: "period-end",
      requiresStripePortal: true,
      entitlementUntil: "2026-07-01T00:00:00.000Z",
      evidence:
        "Cancellation keeps starter entitlement until 2026-07-01T00:00:00.000Z."
    });
    expect(
      summarizeBillingInvoices([
        {
          id: "in_2",
          status: "open",
          amountDueCents: 4900,
          currency: "usd"
        },
        {
          id: "in_1",
          status: "paid",
          amountDueCents: 2900,
          currency: "usd"
        }
      ]).map((invoice) => invoice.id)
    ).toEqual(["in_1", "in_2"]);
  });

  it("calculates usage limits and overage policy", () => {
    expect(
      summarizeBillingUsage([
        {
          label: "Monthly crawled URLs",
          used: 100000,
          limit: 100000
        },
        {
          label: "External API inspections",
          used: 1250,
          limit: 10000
        }
      ])
    ).toEqual([
      {
        label: "External API inspections",
        used: 1250,
        limit: 10000,
        remaining: 8750,
        percentUsed: 12.5,
        exhausted: false,
        overage: 0
      },
      {
        label: "Monthly crawled URLs",
        used: 100000,
        limit: 100000,
        remaining: 0,
        percentUsed: 100,
        exhausted: true,
        overage: 0
      }
    ]);
    expect(overagePolicyForPlan("team")).toEqual({
      planTier: "team",
      mode: "hard-cap",
      allowsOverage: false,
      evidence:
        "team plan uses hard caps; SearchLint denies work before Stripe billing side effects."
    });
    expect(overagePolicyForPlan("enterprise")).toEqual({
      planTier: "enterprise",
      mode: "contract-override",
      allowsOverage: true,
      evidence:
        "Enterprise overage requires a SearchLint contract override and internal entitlement update."
    });
  });
});

function organizationEntitlement(
  overrides: Partial<OrganizationEntitlement> = {}
): OrganizationEntitlement {
  return {
    id: "entitlement-1",
    organizationId: "org-1",
    planTier: "team",
    status: "active",
    currentPeriodStart: "2026-06-01T00:00:00.000Z",
    currentPeriodEnd: "2026-07-01T00:00:00.000Z",
    crawlMaxUrlsPerRun: 10000,
    monthlyCrawledUrlsLimit: 100000,
    externalApiMonthlyLimit: 10000,
    reportRetentionDays: 90,
    source: "stripe",
    createdAt: "2026-06-01T00:00:00.000Z",
    ...overrides
  };
}
