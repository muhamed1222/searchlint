import {
  stripeBillingContract,
  type StripeBillingPlanMapping
} from "./stripe-billing-contracts.js";
import type {
  EntitlementStatus,
  OrganizationEntitlement,
  PlanTier
} from "./types.js";

export type BillingCheckoutMode = "subscription";

export type BillingCheckoutRequest = {
  organizationId: string;
  planTier: PlanTier;
  successUrl: string;
  cancelUrl: string;
  allowPromotionCodes: boolean;
  trialDays?: number;
};

export type BillingCheckoutSessionInput = BillingCheckoutRequest & {
  stripeCustomerId?: string;
};

export type BillingCheckoutSessionRequest = {
  mode: BillingCheckoutMode;
  clientReferenceId: string;
  priceLookupKey: StripeBillingPlanMapping["stripePriceLookupKey"];
  successUrl: string;
  cancelUrl: string;
  allowPromotionCodes: boolean;
  trialDays?: number;
  stripeCustomerId?: string;
  metadata: {
    organizationId: string;
    planTier: PlanTier;
    entitlementSource: "searchlint";
  };
};

export type BillingPortalSessionRequest = {
  stripeCustomerId: string;
  returnUrl: string;
  flow: "customer_portal";
  metadata: {
    organizationId: string;
  };
};

export type BillingPlanSummary = {
  planTier: PlanTier;
  priceLookupKey: StripeBillingPlanMapping["stripePriceLookupKey"];
  crawlMaxUrlsPerRun: number;
  monthlyCrawledUrlsLimit: number;
  externalApiMonthlyLimit: number;
  reportRetentionDays: number;
  contractOverrideAllowed: boolean;
};

export type PublicBillingPricingTier = BillingPlanSummary & {
  displayName: string;
  audience: string;
  monthlyPriceUsdCents: number | "contact_sales";
  billingInterval: "month";
  publicPriceStatus: "release_candidate";
};

export type StripeProductPriceBlueprint = {
  planTier: PlanTier;
  productLookupKey: `searchlint_${PlanTier}`;
  priceLookupKey: StripeBillingPlanMapping["stripePriceLookupKey"];
  productName: string;
  recurringInterval: "month";
  currency: "usd";
  unitAmountCents: number | "custom";
  taxBehavior: "exclusive";
  metadata: {
    searchlintPlanTier: PlanTier;
    entitlementSource: "searchlint";
    pricingStatus: "release_candidate";
  };
};

export type StripeProductCreateRequest = {
  idempotencyKey: `searchlint_product_${PlanTier}_v1`;
  name: string;
  statementDescriptor: "SEARCHLINT";
  metadata: {
    searchlintPlanTier: PlanTier;
    searchlintProductLookupKey: `searchlint_${PlanTier}`;
    entitlementSource: "searchlint";
    pricingStatus: "release_candidate";
  };
};

export type StripePriceCreateRequest = {
  idempotencyKey: `searchlint_price_${PlanTier}_monthly_v1`;
  lookupKey: StripeBillingPlanMapping["stripePriceLookupKey"];
  currency: "usd";
  unitAmountCents: number;
  recurring: {
    interval: "month";
  };
  taxBehavior: "exclusive";
  metadata: {
    searchlintPlanTier: PlanTier;
    entitlementSource: "searchlint";
    pricingStatus: "release_candidate";
  };
};

export type StripeProductPriceSetupEntry = {
  planTier: PlanTier;
  product: StripeProductCreateRequest;
  price?: StripePriceCreateRequest;
  verification: readonly string[];
};

export type StripeProductPriceSetupPacket = {
  setupVersion: 1;
  mode: "manual-live-stripe-setup";
  entries: readonly StripeProductPriceSetupEntry[];
  requiredEnvironment: readonly "STRIPE_SECRET_KEY"[];
  doesNotIncludeSecrets: true;
};

type AcceptanceEvidenceRequirement = {
  id: string;
  description: string;
  sanitized: true;
};

export type StripeCheckoutPaymentAcceptancePacket = {
  acceptanceVersion: 1;
  gate: "live-stripe-checkout-payment";
  status: "blocked_until_owner_evidence";
  requiredInputs: readonly string[];
  requiredEvidence: readonly AcceptanceEvidenceRequirement[];
  passCriteria: readonly string[];
  forbiddenEvidence: readonly string[];
};

export type StripeCustomerPortalAcceptancePacket = {
  acceptanceVersion: 1;
  gate: "live-stripe-customer-portal";
  status: "blocked_until_owner_evidence";
  requiredInputs: readonly string[];
  requiredEvidence: readonly AcceptanceEvidenceRequirement[];
  passCriteria: readonly string[];
  forbiddenEvidence: readonly string[];
};

export type StripeSubscriptionLifecycleAcceptancePacket = {
  acceptanceVersion: 1;
  gate: "live-stripe-subscription-lifecycle";
  status: "blocked_until_owner_evidence";
  requiredInputs: readonly string[];
  requiredEvidence: readonly AcceptanceEvidenceRequirement[];
  requiredLifecycleScenarios: readonly string[];
  passCriteria: readonly string[];
  forbiddenEvidence: readonly string[];
};

export type StripeWebhookRdsPersistenceAcceptancePacket = {
  acceptanceVersion: 1;
  gate: "deployed-stripe-webhook-rds-persistence";
  status: "blocked_until_owner_evidence";
  requiredInputs: readonly string[];
  requiredEvidence: readonly AcceptanceEvidenceRequirement[];
  passCriteria: readonly string[];
  forbiddenEvidence: readonly string[];
};

export type StripeFinalAcceptancePacket = {
  acceptanceVersion: 1;
  gate: "live-stripe-final-acceptance";
  status: "blocked_until_owner_evidence";
  requiredPredecessorGates: readonly string[];
  requiredInputs: readonly string[];
  requiredEvidence: readonly AcceptanceEvidenceRequirement[];
  passCriteria: readonly string[];
  forbiddenEvidence: readonly string[];
};

export type BillingSubscriptionSummary = {
  organizationId: string;
  planTier: PlanTier;
  status: EntitlementStatus;
  source: OrganizationEntitlement["source"];
  currentPeriodStart: string;
  currentPeriodEnd: string;
  trial: {
    active: boolean;
    endsAt?: string;
  };
};

export type BillingPlanChangeIntent = {
  organizationId: string;
  fromPlanTier: PlanTier;
  toPlanTier: PlanTier;
  direction: "upgrade" | "downgrade" | "same-plan";
  effectiveAt: "immediate" | "period-end";
  requiresStripePortal: true;
  evidence: string;
};

export type BillingCancellationIntent = {
  organizationId: string;
  planTier: PlanTier;
  cancelAt: "period-end";
  requiresStripePortal: true;
  entitlementUntil: string;
  evidence: string;
};

export type BillingInvoiceSummary = {
  id: string;
  status: "draft" | "open" | "paid" | "void" | "uncollectible";
  amountDueCents: number;
  currency: string;
  hostedInvoiceUrl?: string;
  invoicePdfUrl?: string;
  dueAt?: string;
};

export type BillingUsageInput = {
  label: string;
  used: number;
  limit: number;
};

export type BillingUsageLimitSummary = BillingUsageInput & {
  remaining: number;
  percentUsed: number;
  exhausted: boolean;
  overage: number;
};

export type BillingOveragePolicy = {
  planTier: PlanTier;
  mode: "hard-cap" | "contract-override";
  allowsOverage: boolean;
  evidence: string;
};

const planOrder: readonly PlanTier[] = [
  "starter",
  "team",
  "agency",
  "enterprise"
];

export function createBillingCheckoutSessionRequest(
  input: BillingCheckoutSessionInput
): BillingCheckoutSessionRequest {
  const plan = planForTier(input.planTier);
  validateHttpUrl(input.successUrl, "successUrl");
  validateHttpUrl(input.cancelUrl, "cancelUrl");
  if (
    input.trialDays !== undefined &&
    (!Number.isInteger(input.trialDays) || input.trialDays < 1)
  ) {
    throw new Error("Billing checkout trialDays must be a positive integer.");
  }

  return {
    mode: "subscription",
    clientReferenceId: input.organizationId,
    priceLookupKey: plan.stripePriceLookupKey,
    successUrl: input.successUrl,
    cancelUrl: input.cancelUrl,
    allowPromotionCodes: input.allowPromotionCodes,
    ...(input.trialDays === undefined ? {} : { trialDays: input.trialDays }),
    ...(input.stripeCustomerId === undefined
      ? {}
      : { stripeCustomerId: input.stripeCustomerId }),
    metadata: {
      organizationId: input.organizationId,
      planTier: input.planTier,
      entitlementSource: "searchlint"
    }
  };
}

export function createBillingPortalSessionRequest(input: {
  organizationId: string;
  stripeCustomerId: string;
  returnUrl: string;
}): BillingPortalSessionRequest {
  if (input.stripeCustomerId.trim() === "") {
    throw new Error("Billing portal stripeCustomerId is required.");
  }
  validateHttpUrl(input.returnUrl, "returnUrl");
  return {
    stripeCustomerId: input.stripeCustomerId,
    returnUrl: input.returnUrl,
    flow: "customer_portal",
    metadata: {
      organizationId: input.organizationId
    }
  };
}

export function billingPlanSummaries(): readonly BillingPlanSummary[] {
  return stripeBillingContract.plans.map((plan) => ({
    planTier: plan.planTier,
    priceLookupKey: plan.stripePriceLookupKey,
    crawlMaxUrlsPerRun: plan.limits.crawlMaxUrlsPerRun,
    monthlyCrawledUrlsLimit: plan.limits.monthlyCrawledUrlsLimit,
    externalApiMonthlyLimit: plan.limits.externalApiMonthlyLimit,
    reportRetentionDays: plan.limits.reportRetentionDays,
    contractOverrideAllowed: plan.limits.contractOverrideAllowed
  }));
}

export function publicBillingPricingTiers(): readonly PublicBillingPricingTier[] {
  const pricingByTier: Record<
    PlanTier,
    Pick<
      PublicBillingPricingTier,
      "displayName" | "audience" | "monthlyPriceUsdCents"
    >
  > = {
    starter: {
      displayName: "Starter",
      audience: "Solo developers and small sites",
      monthlyPriceUsdCents: 2900
    },
    team: {
      displayName: "Team",
      audience: "Product teams running production SEO checks",
      monthlyPriceUsdCents: 4900
    },
    agency: {
      displayName: "Agency",
      audience: "Agencies managing multiple clients",
      monthlyPriceUsdCents: 19900
    },
    enterprise: {
      displayName: "Enterprise",
      audience: "Organizations requiring custom limits and procurement",
      monthlyPriceUsdCents: "contact_sales"
    }
  };

  return billingPlanSummaries().map((summary) => ({
    ...summary,
    ...pricingByTier[summary.planTier],
    billingInterval: "month",
    publicPriceStatus: "release_candidate"
  }));
}

export function stripeProductPriceBlueprints(): readonly StripeProductPriceBlueprint[] {
  return publicBillingPricingTiers().map((tier) => ({
    planTier: tier.planTier,
    productLookupKey: `searchlint_${tier.planTier}`,
    priceLookupKey: tier.priceLookupKey,
    productName: `SearchLint ${tier.displayName}`,
    recurringInterval: tier.billingInterval,
    currency: "usd",
    unitAmountCents:
      tier.monthlyPriceUsdCents === "contact_sales"
        ? "custom"
        : tier.monthlyPriceUsdCents,
    taxBehavior: "exclusive",
    metadata: {
      searchlintPlanTier: tier.planTier,
      entitlementSource: "searchlint",
      pricingStatus: tier.publicPriceStatus
    }
  }));
}

export function stripeProductPriceSetupPacket(): StripeProductPriceSetupPacket {
  return {
    setupVersion: 1,
    mode: "manual-live-stripe-setup",
    requiredEnvironment: ["STRIPE_SECRET_KEY"],
    doesNotIncludeSecrets: true,
    entries: stripeProductPriceBlueprints().map((blueprint) => {
      const product = {
        idempotencyKey: `searchlint_product_${blueprint.planTier}_v1`,
        name: blueprint.productName,
        statementDescriptor: "SEARCHLINT",
        metadata: {
          searchlintPlanTier: blueprint.planTier,
          searchlintProductLookupKey: blueprint.productLookupKey,
          entitlementSource: "searchlint",
          pricingStatus: blueprint.metadata.pricingStatus
        }
      } satisfies StripeProductCreateRequest;
      const price =
        blueprint.unitAmountCents === "custom"
          ? undefined
          : ({
              idempotencyKey: `searchlint_price_${blueprint.planTier}_monthly_v1`,
              lookupKey: blueprint.priceLookupKey,
              currency: blueprint.currency,
              unitAmountCents: blueprint.unitAmountCents,
              recurring: {
                interval: blueprint.recurringInterval
              },
              taxBehavior: blueprint.taxBehavior,
              metadata: {
                searchlintPlanTier: blueprint.planTier,
                entitlementSource: blueprint.metadata.entitlementSource,
                pricingStatus: blueprint.metadata.pricingStatus
              }
            } satisfies StripePriceCreateRequest);

      return {
        planTier: blueprint.planTier,
        product,
        ...(price === undefined ? {} : { price }),
        verification: stripeSetupVerification(blueprint)
      };
    })
  };
}

export function stripeCheckoutPaymentAcceptancePacket(): StripeCheckoutPaymentAcceptancePacket {
  return {
    acceptanceVersion: 1,
    gate: "live-stripe-checkout-payment",
    status: "blocked_until_owner_evidence",
    requiredInputs: [
      "Owner-controlled Stripe test or production account.",
      "Created Stripe product IDs for SearchLint Starter, Team, Agency, and Enterprise.",
      "Created Stripe monthly price IDs for SearchLint Starter, Team, and Agency.",
      "SearchLint app base URL for checkout success and cancel redirects.",
      "Configured Stripe webhook endpoint and signing secret in the approved vault."
    ],
    requiredEvidence: [
      evidence(
        "stripe-checkout-session",
        "Sanitized Checkout Session ID, mode=subscription, lookup key, success URL, cancel URL, and client reference organization ID."
      ),
      evidence(
        "stripe-customer",
        "Sanitized Stripe Customer ID created or reused for the checkout."
      ),
      evidence(
        "stripe-subscription",
        "Sanitized Stripe Subscription ID with active or trialing status after checkout."
      ),
      evidence(
        "stripe-payment-or-invoice",
        "Sanitized PaymentIntent or invoice evidence showing successful test payment or valid trial checkout."
      ),
      evidence(
        "stripe-webhook-events",
        "Sanitized Stripe webhook event IDs for subscription and invoice/payment signals received by SearchLint."
      ),
      evidence(
        "searchlint-entitlement",
        "SearchLint organization entitlement row or API response reflecting the purchased plan and period."
      )
    ],
    passCriteria: [
      "Checkout Session completes successfully in the owner-controlled Stripe account.",
      "Stripe subscription maps to the expected SearchLint plan lookup key.",
      "Required webhook events are received and processed idempotently.",
      "SearchLint entitlement is updated from Stripe webhook processing.",
      "No Stripe secret keys, webhook secrets, card data, raw customer email addresses, authorization headers, or bearer tokens appear in evidence."
    ],
    forbiddenEvidence: [
      "Stripe secret keys",
      "Stripe webhook signing secrets",
      "full card numbers",
      "raw customer email addresses",
      "authorization headers",
      "bearer tokens",
      "unredacted payment method details"
    ]
  };
}

export function stripeCustomerPortalAcceptancePacket(): StripeCustomerPortalAcceptancePacket {
  return {
    acceptanceVersion: 1,
    gate: "live-stripe-customer-portal",
    status: "blocked_until_owner_evidence",
    requiredInputs: [
      "Owner-controlled Stripe test or production account with customer portal enabled.",
      "Configured Stripe customer portal settings for plan changes and cancellation policy.",
      "Existing Stripe Customer ID mapped to a SearchLint organization.",
      "Existing Stripe Subscription ID for a SearchLint paid or trial plan.",
      "SearchLint app base URL for the customer portal return redirect.",
      "Configured Stripe webhook endpoint and signing secret in the approved vault."
    ],
    requiredEvidence: [
      evidence(
        "stripe-portal-session",
        "Sanitized Stripe customer portal session ID, customer ID reference, return URL, and created timestamp."
      ),
      evidence(
        "stripe-portal-redirect",
        "Sanitized evidence that the user reached the Stripe-hosted portal and returned to the SearchLint billing page."
      ),
      evidence(
        "stripe-customer",
        "Sanitized Stripe Customer ID mapped to the SearchLint organization."
      ),
      evidence(
        "stripe-subscription-before",
        "Sanitized subscription state before the portal action, including plan lookup key, status, and current period."
      ),
      evidence(
        "stripe-portal-action",
        "Sanitized portal action evidence for allowed plan change, cancellation, or payment-method management."
      ),
      evidence(
        "stripe-subscription-after",
        "Sanitized subscription state after the portal action, including effective plan/status and period behavior."
      ),
      evidence(
        "stripe-webhook-events",
        "Sanitized Stripe webhook event IDs received by SearchLint for the portal-driven subscription update."
      ),
      evidence(
        "searchlint-entitlement",
        "SearchLint organization entitlement row or API response reflecting the portal-driven subscription state."
      )
    ],
    passCriteria: [
      "Customer portal session is created for the expected Stripe customer mapped to a SearchLint organization.",
      "User can reach the Stripe-hosted portal and return to the SearchLint billing page.",
      "Allowed portal action produces the expected Stripe subscription state.",
      "Required webhook events are received and processed idempotently.",
      "SearchLint entitlement reflects the portal-driven subscription change or scheduled cancellation.",
      "No Stripe secret keys, webhook secrets, card data, raw customer email addresses, authorization headers, or bearer tokens appear in evidence."
    ],
    forbiddenEvidence: [
      "Stripe secret keys",
      "Stripe webhook signing secrets",
      "full card numbers",
      "raw customer email addresses",
      "authorization headers",
      "bearer tokens",
      "unredacted payment method details",
      "unredacted portal URLs"
    ]
  };
}

export function stripeSubscriptionLifecycleAcceptancePacket(): StripeSubscriptionLifecycleAcceptancePacket {
  return {
    acceptanceVersion: 1,
    gate: "live-stripe-subscription-lifecycle",
    status: "blocked_until_owner_evidence",
    requiredInputs: [
      "Owner-controlled Stripe test or production account with SearchLint products and prices configured.",
      "Configured checkout and customer portal flows for trial, upgrade, downgrade, and cancellation scenarios.",
      "Configured Stripe webhook endpoint and signing secret in the approved vault.",
      "SearchLint organization mapped to a Stripe Customer ID.",
      "SearchLint entitlement storage connected to deployed webhook processing."
    ],
    requiredLifecycleScenarios: [
      "trial checkout starts a trialing subscription and SearchLint trial entitlement.",
      "trial conversion or paid checkout produces an active subscription and paid entitlement.",
      "upgrade moves the subscription to the higher plan with immediate or documented proration behavior.",
      "downgrade schedules or applies the lower plan according to the approved portal policy.",
      "cancellation schedules period-end cancellation and preserves entitlement until the paid-through date.",
      "invoice/payment events reconcile subscription status and SearchLint entitlement state."
    ],
    requiredEvidence: [
      evidence(
        "stripe-trial-subscription",
        "Sanitized trial subscription evidence including subscription ID, plan lookup key, status=trialing, and trial end."
      ),
      evidence(
        "stripe-paid-subscription",
        "Sanitized active paid subscription evidence including subscription ID, plan lookup key, status, and current period."
      ),
      evidence(
        "stripe-upgrade-transition",
        "Sanitized upgrade evidence showing previous plan, new plan, effective time, and proration behavior."
      ),
      evidence(
        "stripe-downgrade-transition",
        "Sanitized downgrade evidence showing previous plan, new plan, effective time, and period-end behavior."
      ),
      evidence(
        "stripe-cancellation-transition",
        "Sanitized cancellation evidence showing cancel_at_period_end or equivalent policy and paid-through date."
      ),
      evidence(
        "stripe-invoice-events",
        "Sanitized invoice/payment evidence for paid, failed, or trial-conversion scenarios used by the lifecycle test."
      ),
      evidence(
        "stripe-webhook-events",
        "Sanitized Stripe webhook event IDs for subscription, invoice, and payment lifecycle events received by SearchLint."
      ),
      evidence(
        "searchlint-entitlement-transitions",
        "SearchLint entitlement rows or API responses before and after each lifecycle transition."
      ),
      evidence(
        "searchlint-usage-limit-transitions",
        "SearchLint plan limit or usage entitlement evidence showing the effective limits after lifecycle changes."
      )
    ],
    passCriteria: [
      "Each required lifecycle scenario is executed against the owner-controlled Stripe account.",
      "Stripe subscription states and SearchLint entitlement states match after every scenario.",
      "Webhook processing is idempotent for every lifecycle event used as evidence.",
      "Trial, upgrade, downgrade, cancellation, invoice, and usage-limit behavior match the approved OD-020 billing contract.",
      "No Stripe secret keys, webhook secrets, card data, raw customer email addresses, authorization headers, or bearer tokens appear in evidence."
    ],
    forbiddenEvidence: [
      "Stripe secret keys",
      "Stripe webhook signing secrets",
      "full card numbers",
      "raw customer email addresses",
      "authorization headers",
      "bearer tokens",
      "unredacted payment method details",
      "unredacted invoice URLs",
      "unredacted portal URLs"
    ]
  };
}

export function stripeWebhookRdsPersistenceAcceptancePacket(): StripeWebhookRdsPersistenceAcceptancePacket {
  return {
    acceptanceVersion: 1,
    gate: "deployed-stripe-webhook-rds-persistence",
    status: "blocked_until_owner_evidence",
    requiredInputs: [
      "Deployed SearchLint API running the signed raw-body Stripe webhook route.",
      "Deployed PostgreSQL/RDS database with current SearchLint cloud schema migrations applied.",
      "Configured Stripe webhook endpoint and signing secret in the approved vault.",
      "Active Stripe billing identity mapping for the tested SearchLint organization.",
      "Owner-controlled Stripe event fixtures or live test events for subscription and invoice paths."
    ],
    requiredEvidence: [
      evidence(
        "deployed-webhook-request",
        "Sanitized deployed API request evidence for a signed Stripe webhook POST to /v1/billing/stripe/webhook."
      ),
      evidence(
        "rds-stripe-webhook-event-row",
        "Sanitized RDS query result showing stripe_webhook_events row with organization, Stripe event ID, event type, intent kind, and processed time."
      ),
      evidence(
        "rds-idempotency-proof",
        "Sanitized proof that replaying the same Stripe event does not create a duplicate processed-event row."
      ),
      evidence(
        "rds-entitlement-update",
        "Sanitized organization_entitlements row or API response showing subscription webhook entitlement application."
      ),
      evidence(
        "invoice-signal-persistence",
        "Sanitized invoice payment signal evidence showing processed webhook event persistence without unintended entitlement mutation."
      ),
      evidence(
        "webhook-error-path",
        "Sanitized invalid-signature or stale-signature deployed response evidence that does not persist an event."
      ),
      evidence(
        "audit-metrics-log-redaction",
        "Sanitized deployed logs, audit events, or metrics proving webhook processing is observable without secrets."
      ),
      evidence(
        "schema-version-proof",
        "Sanitized evidence that deployed RDS uses the expected stripe_webhook_events and organization_entitlements schema versions."
      )
    ],
    passCriteria: [
      "A valid deployed Stripe subscription webhook persists exactly one stripe_webhook_events row.",
      "Replaying the same Stripe event is idempotent and does not create a duplicate processed-event row.",
      "Subscription webhook processing updates SearchLint organization entitlement through RDS.",
      "Invoice payment webhook processing records the event without unintended entitlement mutation.",
      "Invalid or stale signatures are rejected and do not persist processed webhook rows.",
      "No Stripe secret keys, webhook signing secrets, raw database URLs, raw customer email addresses, authorization headers, or bearer tokens appear in evidence."
    ],
    forbiddenEvidence: [
      "Stripe secret keys",
      "Stripe webhook signing secrets",
      "raw database URLs",
      "database passwords",
      "private keys",
      "raw customer email addresses",
      "authorization headers",
      "bearer tokens",
      "unredacted webhook payloads"
    ]
  };
}

export function stripeFinalAcceptancePacket(): StripeFinalAcceptancePacket {
  return {
    acceptanceVersion: 1,
    gate: "live-stripe-final-acceptance",
    status: "blocked_until_owner_evidence",
    requiredPredecessorGates: [
      "stripe-products-prices-live-setup",
      "live-stripe-checkout-payment",
      "live-stripe-customer-portal",
      "live-stripe-subscription-lifecycle",
      "deployed-stripe-webhook-rds-persistence"
    ],
    requiredInputs: [
      "Owner-controlled Stripe account with final SearchLint products and prices configured.",
      "Deployed SearchLint API, dashboard, webhook route, and PostgreSQL/RDS environment.",
      "Configured Stripe checkout, customer portal, and webhook endpoint.",
      "Approved final pricing, terms, privacy, tax, and customer communication artifacts.",
      "Owner-provided sanitized evidence for every predecessor gate."
    ],
    requiredEvidence: [
      evidence(
        "stripe-products-prices-live-setup",
        "Sanitized evidence that final Stripe products/prices exist with expected lookup keys, metadata, currency, and recurring behavior."
      ),
      evidence(
        "live-checkout-payment",
        "Sanitized evidence that live checkout completes payment or trial setup and maps to SearchLint entitlement."
      ),
      evidence(
        "live-customer-portal",
        "Sanitized evidence that the Stripe customer portal can be opened, used for allowed actions, and returns to SearchLint."
      ),
      evidence(
        "live-subscription-lifecycle",
        "Sanitized evidence for trial, paid, upgrade, downgrade, cancellation, invoice, webhook, entitlement, and usage-limit lifecycle scenarios."
      ),
      evidence(
        "deployed-webhook-rds-persistence",
        "Sanitized deployed API/RDS evidence for webhook persistence, idempotency, entitlement mutation, invoice signals, and rejected signatures."
      ),
      evidence(
        "billing-ui-e2e",
        "Sanitized deployed billing UI evidence showing current plan, portal access, invoices, usage limits, and error states."
      ),
      evidence(
        "legal-pricing-approval",
        "Sanitized owner/legal approval evidence for final pricing, terms, tax behavior, refunds, and customer communication."
      ),
      evidence(
        "owner-final-signoff",
        "Explicit owner sign-off referencing all sanitized evidence packet versions and confirming no secrets are included."
      )
    ],
    passCriteria: [
      "All predecessor gates are passed with owner-provided sanitized live or deployed evidence.",
      "Stripe products/prices, checkout, portal, lifecycle, webhook/RDS, and billing UI evidence are internally consistent.",
      "SearchLint entitlements and usage limits match the approved OD-020 billing contract after every live Stripe scenario.",
      "Legal/pricing approval is recorded before public launch or paid customer access.",
      "No Stripe secret keys, webhook signing secrets, raw database URLs, card data, raw customer email addresses, authorization headers, bearer tokens, or unredacted payloads appear in evidence."
    ],
    forbiddenEvidence: [
      "Stripe secret keys",
      "Stripe webhook signing secrets",
      "raw database URLs",
      "database passwords",
      "private keys",
      "full card numbers",
      "raw customer email addresses",
      "authorization headers",
      "bearer tokens",
      "unredacted webhook payloads",
      "unredacted invoice URLs",
      "unredacted portal URLs"
    ]
  };
}

export function summarizeBillingSubscription(
  entitlement: OrganizationEntitlement
): BillingSubscriptionSummary {
  return {
    organizationId: entitlement.organizationId,
    planTier: entitlement.planTier,
    status: entitlement.status,
    source: entitlement.source,
    currentPeriodStart: entitlement.currentPeriodStart,
    currentPeriodEnd: entitlement.currentPeriodEnd,
    trial: {
      active: entitlement.status === "trialing",
      ...(entitlement.status === "trialing"
        ? { endsAt: entitlement.currentPeriodEnd }
        : {})
    }
  };
}

export function createBillingPlanChangeIntent(input: {
  organizationId: string;
  fromPlanTier: PlanTier;
  toPlanTier: PlanTier;
}): BillingPlanChangeIntent {
  const fromRank = planOrder.indexOf(input.fromPlanTier);
  const toRank = planOrder.indexOf(input.toPlanTier);
  const direction =
    toRank > fromRank
      ? "upgrade"
      : toRank < fromRank
        ? "downgrade"
        : "same-plan";
  return {
    organizationId: input.organizationId,
    fromPlanTier: input.fromPlanTier,
    toPlanTier: input.toPlanTier,
    direction,
    effectiveAt: direction === "upgrade" ? "immediate" : "period-end",
    requiresStripePortal: true,
    evidence: `Plan change from ${input.fromPlanTier} to ${input.toPlanTier} must be completed through Stripe customer portal.`
  };
}

export function createBillingCancellationIntent(
  entitlement: OrganizationEntitlement
): BillingCancellationIntent {
  return {
    organizationId: entitlement.organizationId,
    planTier: entitlement.planTier,
    cancelAt: "period-end",
    requiresStripePortal: true,
    entitlementUntil: entitlement.currentPeriodEnd,
    evidence: `Cancellation keeps ${entitlement.planTier} entitlement until ${entitlement.currentPeriodEnd}.`
  };
}

export function summarizeBillingUsage(
  usage: readonly BillingUsageInput[]
): readonly BillingUsageLimitSummary[] {
  return [...usage]
    .sort((left, right) => left.label.localeCompare(right.label))
    .map((item) => {
      if (!Number.isFinite(item.used) || item.used < 0) {
        throw new Error(
          `Billing usage ${item.label} used must be non-negative.`
        );
      }
      if (!Number.isFinite(item.limit) || item.limit < 1) {
        throw new Error(`Billing usage ${item.label} limit must be positive.`);
      }
      const remaining = Math.max(0, item.limit - item.used);
      return {
        ...item,
        remaining,
        percentUsed: Math.round((item.used / item.limit) * 10_000) / 100,
        exhausted: item.used >= item.limit,
        overage: Math.max(0, item.used - item.limit)
      };
    });
}

export function overagePolicyForPlan(planTier: PlanTier): BillingOveragePolicy {
  const plan = planForTier(planTier);
  if (plan.limits.contractOverrideAllowed) {
    return {
      planTier,
      mode: "contract-override",
      allowsOverage: true,
      evidence:
        "Enterprise overage requires a SearchLint contract override and internal entitlement update."
    };
  }
  return {
    planTier,
    mode: "hard-cap",
    allowsOverage: false,
    evidence: `${planTier} plan uses hard caps; SearchLint denies work before Stripe billing side effects.`
  };
}

export function summarizeBillingInvoices(
  invoices: readonly BillingInvoiceSummary[]
): readonly BillingInvoiceSummary[] {
  return [...invoices].sort((left, right) => left.id.localeCompare(right.id));
}

function planForTier(planTier: PlanTier): StripeBillingPlanMapping {
  const plan = stripeBillingContract.plans.find(
    (candidate) => candidate.planTier === planTier
  );
  if (plan === undefined) {
    throw new Error(`Stripe billing plan ${planTier} is not configured.`);
  }
  return plan;
}

function stripeSetupVerification(
  blueprint: StripeProductPriceBlueprint
): readonly string[] {
  const checks = [
    `Product metadata searchlintPlanTier=${blueprint.planTier}.`,
    `Product metadata searchlintProductLookupKey=${blueprint.productLookupKey}.`
  ];
  if (blueprint.unitAmountCents === "custom") {
    return [
      ...checks,
      "No fixed recurring price is created for contact-sales Enterprise pricing."
    ];
  }
  return [
    ...checks,
    `Price lookup_key=${blueprint.priceLookupKey}.`,
    `Price currency=${blueprint.currency}.`,
    `Price recurring interval=${blueprint.recurringInterval}.`,
    `Price unit_amount=${blueprint.unitAmountCents}.`
  ];
}

function evidence(
  id: string,
  description: string
): AcceptanceEvidenceRequirement {
  return {
    id,
    description,
    sanitized: true
  };
}

function validateHttpUrl(value: string, field: string): void {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`Billing ${field} must be an absolute HTTP(S) URL.`);
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error(`Billing ${field} must be an absolute HTTP(S) URL.`);
  }
}
