import type { EntitlementStatus, PlanTier } from "./types.js";

export type StripeBillingProvider = "stripe-billing";
export type StripeBillingSecretSource = "aws-secrets-manager";
export type StripeBillingEnvironmentVariableName =
  | "SEARCHLINT_STRIPE_SECRET_KEY"
  | "SEARCHLINT_STRIPE_WEBHOOK_SECRET";

export type StripeBillingEnvironmentVariable = {
  name: StripeBillingEnvironmentVariableName;
  required: true;
  secretSource: StripeBillingSecretSource;
};

export type StripeBillingWebhookEventType =
  | "customer.subscription.created"
  | "customer.subscription.updated"
  | "customer.subscription.deleted"
  | "invoice.payment_failed"
  | "invoice.payment_succeeded";

export type StripeSubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "incomplete"
  | "incomplete_expired";

export type StripeBillingEntitlementLimits = {
  crawlMaxUrlsPerRun: number;
  monthlyCrawledUrlsLimit: number;
  externalApiMonthlyLimit: number;
  reportRetentionDays: number;
  contractOverrideAllowed: boolean;
};

export type StripeBillingPlanMapping = {
  planTier: PlanTier;
  stripePriceLookupKey: `searchlint_${PlanTier}_monthly`;
  limits: StripeBillingEntitlementLimits;
};

export type StripeBillingStatusMapping = {
  stripeStatus: StripeSubscriptionStatus;
  entitlementStatus: EntitlementStatus;
};

export type StripeBillingContract = {
  id: "searchlint-stripe-billing-v1";
  contractVersion: 1;
  provider: StripeBillingProvider;
  environment: {
    variables: readonly StripeBillingEnvironmentVariable[];
  };
  plans: readonly StripeBillingPlanMapping[];
  webhooks: {
    signingSecretEnv: "SEARCHLINT_STRIPE_WEBHOOK_SECRET";
    idempotencyKey: "stripe_event_id";
    events: readonly StripeBillingWebhookEventType[];
    updates: {
      entitlementTable: "organization_entitlements";
      usageCounterTable: "usage_counters";
      billableUsageEventTable: "billable_usage_events";
      source: "stripe";
      tenantAuthorizationSource: false;
    };
  };
  subscriptionStatusMappings: readonly StripeBillingStatusMapping[];
};

export type StripeBillingValidationIssue = {
  path: string;
  message: string;
};

const requiredEnvironment: readonly StripeBillingEnvironmentVariable[] = [
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
];

const requiredWebhookEvents: readonly StripeBillingWebhookEventType[] = [
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.payment_failed",
  "invoice.payment_succeeded"
];

const requiredPlanTiers: readonly PlanTier[] = [
  "starter",
  "team",
  "agency",
  "enterprise"
];

const requiredStatusMappings: readonly StripeBillingStatusMapping[] = [
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
];

export const stripeBillingContract: StripeBillingContract = {
  id: "searchlint-stripe-billing-v1",
  contractVersion: 1,
  provider: "stripe-billing",
  environment: {
    variables: requiredEnvironment
  },
  plans: [
    plan("starter", {
      crawlMaxUrlsPerRun: 1_000,
      monthlyCrawledUrlsLimit: 10_000,
      externalApiMonthlyLimit: 1_000,
      reportRetentionDays: 30,
      contractOverrideAllowed: false
    }),
    plan("team", {
      crawlMaxUrlsPerRun: 10_000,
      monthlyCrawledUrlsLimit: 100_000,
      externalApiMonthlyLimit: 10_000,
      reportRetentionDays: 90,
      contractOverrideAllowed: false
    }),
    plan("agency", {
      crawlMaxUrlsPerRun: 25_000,
      monthlyCrawledUrlsLimit: 500_000,
      externalApiMonthlyLimit: 50_000,
      reportRetentionDays: 180,
      contractOverrideAllowed: false
    }),
    plan("enterprise", {
      crawlMaxUrlsPerRun: 100_000,
      monthlyCrawledUrlsLimit: 2_000_000,
      externalApiMonthlyLimit: 250_000,
      reportRetentionDays: 365,
      contractOverrideAllowed: true
    })
  ],
  webhooks: {
    signingSecretEnv: "SEARCHLINT_STRIPE_WEBHOOK_SECRET",
    idempotencyKey: "stripe_event_id",
    events: requiredWebhookEvents,
    updates: {
      entitlementTable: "organization_entitlements",
      usageCounterTable: "usage_counters",
      billableUsageEventTable: "billable_usage_events",
      source: "stripe",
      tenantAuthorizationSource: false
    }
  },
  subscriptionStatusMappings: requiredStatusMappings
};

export function validateStripeBillingContract(
  contract: StripeBillingContract
): StripeBillingValidationIssue[] {
  const issues: StripeBillingValidationIssue[] = [];

  expectEqual(issues, "id", contract.id, "searchlint-stripe-billing-v1");
  expectEqual(issues, "contractVersion", contract.contractVersion, 1);
  expectEqual(issues, "provider", contract.provider, "stripe-billing");
  validateEnvironment(contract, issues);
  validatePlans(contract, issues);
  validateWebhooks(contract, issues);
  validateStatusMappings(contract, issues);

  return issues;
}

function plan(
  planTier: PlanTier,
  limits: StripeBillingEntitlementLimits
): StripeBillingPlanMapping {
  return {
    planTier,
    stripePriceLookupKey: `searchlint_${planTier}_monthly`,
    limits
  };
}

function validateEnvironment(
  contract: StripeBillingContract,
  issues: StripeBillingValidationIssue[]
): void {
  const variables = new Map(
    contract.environment.variables.map((variable) => [variable.name, variable])
  );

  for (const expected of requiredEnvironment) {
    const variable = variables.get(expected.name);
    if (!variable) {
      issues.push({
        path: "environment.variables",
        message: `${expected.name} Stripe environment variable is required.`
      });
      continue;
    }
    const basePath = `environment.variables.${expected.name}`;
    expectEqual(issues, `${basePath}.required`, variable.required, true);
    expectEqual(
      issues,
      `${basePath}.secretSource`,
      variable.secretSource,
      "aws-secrets-manager"
    );
  }
}

function validatePlans(
  contract: StripeBillingContract,
  issues: StripeBillingValidationIssue[]
): void {
  const plans = new Map(contract.plans.map((entry) => [entry.planTier, entry]));

  for (const tier of requiredPlanTiers) {
    const mapping = plans.get(tier);
    if (!mapping) {
      issues.push({
        path: "plans",
        message: `${tier} Stripe plan mapping is required.`
      });
      continue;
    }
    expectEqual(
      issues,
      `plans.${tier}.stripePriceLookupKey`,
      mapping.stripePriceLookupKey,
      `searchlint_${tier}_monthly`
    );
    validateLimits(mapping, issues);
  }
}

function validateLimits(
  mapping: StripeBillingPlanMapping,
  issues: StripeBillingValidationIssue[]
): void {
  const basePath = `plans.${mapping.planTier}.limits`;
  positiveInteger(
    issues,
    `${basePath}.crawlMaxUrlsPerRun`,
    mapping.limits.crawlMaxUrlsPerRun
  );
  positiveInteger(
    issues,
    `${basePath}.monthlyCrawledUrlsLimit`,
    mapping.limits.monthlyCrawledUrlsLimit
  );
  positiveInteger(
    issues,
    `${basePath}.externalApiMonthlyLimit`,
    mapping.limits.externalApiMonthlyLimit
  );
  positiveInteger(
    issues,
    `${basePath}.reportRetentionDays`,
    mapping.limits.reportRetentionDays
  );
  expectEqual(
    issues,
    `${basePath}.contractOverrideAllowed`,
    mapping.limits.contractOverrideAllowed,
    mapping.planTier === "enterprise"
  );
}

function validateWebhooks(
  contract: StripeBillingContract,
  issues: StripeBillingValidationIssue[]
): void {
  expectEqual(
    issues,
    "webhooks.signingSecretEnv",
    contract.webhooks.signingSecretEnv,
    "SEARCHLINT_STRIPE_WEBHOOK_SECRET"
  );
  expectEqual(
    issues,
    "webhooks.idempotencyKey",
    contract.webhooks.idempotencyKey,
    "stripe_event_id"
  );
  expectSetEqual(
    issues,
    "webhooks.events",
    contract.webhooks.events,
    requiredWebhookEvents
  );
  expectEqual(
    issues,
    "webhooks.updates.entitlementTable",
    contract.webhooks.updates.entitlementTable,
    "organization_entitlements"
  );
  expectEqual(
    issues,
    "webhooks.updates.usageCounterTable",
    contract.webhooks.updates.usageCounterTable,
    "usage_counters"
  );
  expectEqual(
    issues,
    "webhooks.updates.billableUsageEventTable",
    contract.webhooks.updates.billableUsageEventTable,
    "billable_usage_events"
  );
  expectEqual(
    issues,
    "webhooks.updates.source",
    contract.webhooks.updates.source,
    "stripe"
  );
  expectEqual(
    issues,
    "webhooks.updates.tenantAuthorizationSource",
    contract.webhooks.updates.tenantAuthorizationSource,
    false
  );
}

function validateStatusMappings(
  contract: StripeBillingContract,
  issues: StripeBillingValidationIssue[]
): void {
  const mappings = new Map(
    contract.subscriptionStatusMappings.map((mapping) => [
      mapping.stripeStatus,
      mapping
    ])
  );

  for (const expected of requiredStatusMappings) {
    const mapping = mappings.get(expected.stripeStatus);
    if (!mapping) {
      issues.push({
        path: "subscriptionStatusMappings",
        message: `${expected.stripeStatus} subscription status mapping is required.`
      });
      continue;
    }
    expectEqual(
      issues,
      `subscriptionStatusMappings.${expected.stripeStatus}.entitlementStatus`,
      mapping.entitlementStatus,
      expected.entitlementStatus
    );
  }
}

function positiveInteger(
  issues: StripeBillingValidationIssue[],
  path: string,
  value: number
): void {
  if (!Number.isInteger(value) || value < 1) {
    issues.push({
      path,
      message: `${path} must be a positive integer.`
    });
  }
}

function expectEqual(
  issues: StripeBillingValidationIssue[],
  path: string,
  actual: unknown,
  expected: unknown
): void {
  if (actual !== expected) {
    issues.push({
      path,
      message: `${path} must be ${String(expected)}.`
    });
  }
}

function expectSetEqual(
  issues: StripeBillingValidationIssue[],
  path: string,
  actual: readonly string[],
  expected: readonly string[]
): void {
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);

  for (const value of expectedSet) {
    if (!actualSet.has(value)) {
      issues.push({
        path,
        message: `${value} is required.`
      });
    }
  }

  for (const value of actualSet) {
    if (!expectedSet.has(value)) {
      issues.push({
        path,
        message: `${value} is not part of the approved set.`
      });
    }
  }
}
