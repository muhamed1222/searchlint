#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHmac } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { format } from "prettier";

const reportPath = "reports/billing-acceptance-report.json";
const samplePath = "docs/examples/billing-acceptance-report.sample.json";
const webhookSecret = "whsec_test_fixture_not_reported";

const commands = [
  {
    name: "dashboardBuild",
    command: "pnpm",
    args: ["--filter", "@searchlint/dashboard...", "build"]
  },
  {
    name: "apiBillingTests",
    command: "pnpm",
    args: [
      "--filter",
      "@searchlint/api",
      "test",
      "--",
      "billing-product.test.ts",
      "stripe-billing-contracts.test.ts",
      "stripe-webhook.test.ts",
      "postgres-entitlement-store.test.ts",
      "postgres-stripe-webhook-store.test.ts"
    ]
  },
  {
    name: "dashboardBillingTests",
    command: "pnpm",
    args: [
      "--filter",
      "@searchlint/dashboard",
      "test",
      "--",
      "dashboard.test.ts"
    ]
  },
  {
    name: "apiBuild",
    command: "pnpm",
    args: ["--filter", "@searchlint/api", "build"]
  }
];

async function main() {
  const commandResults = commands.map(runCommand);
  const api = await import(
    pathToFileURL(path.resolve("services/api/dist/src/index.js")).href
  );
  const dashboard = await import(
    pathToFileURL(path.resolve("apps/dashboard/dist/src/index.js")).href
  );

  const contractCase = verifyBillingContractCase(api);
  const sessionCase = verifySessionCase(api);
  const lifecycleCase = verifyLifecycleCase(api);
  const webhookCase = verifyWebhookCase(api);
  const dashboardCase = verifyDashboardCase(dashboard);
  const report = {
    generatedBy: "searchlint-billing-acceptance-verifier",
    generatedAt: "2026-06-22T00:00:00.000Z",
    status: "passed",
    scope: {
      proofType: "deterministic local/static Stripe billing proof",
      doesNotClaim: [
        "live Stripe product or price configuration",
        "live Stripe checkout session creation",
        "live Stripe customer portal session creation",
        "live card payment",
        "live invoice settlement",
        "production billing UI deployment"
      ]
    },
    commands: commandResults,
    cases: {
      contract: contractCase,
      sessions: sessionCase,
      lifecycle: lifecycleCase,
      webhook: webhookCase,
      dashboard: dashboardCase
    },
    remainingReleaseGates: [
      "Create and verify real Stripe products and prices.",
      "Create live Stripe checkout sessions and complete a test payment.",
      "Create live Stripe customer portal sessions.",
      "Verify live subscription trial, upgrade, downgrade, cancellation, and invoice flows.",
      "Verify deployed Stripe webhook persistence against production RDS.",
      "Deploy and run browser E2E for billing UI.",
      "Finalize pricing, overage policy, and legal billing terms."
    ]
  };

  assertNoForbiddenSecrets(JSON.stringify(report));
  await mkdir(path.dirname(reportPath), { recursive: true });
  await mkdir(path.dirname(samplePath), { recursive: true });
  await writeJson(reportPath, report);
  await writeJson(samplePath, report);

  console.log(
    `Billing acceptance PASS: ${Object.keys(report.cases).length}/5 evidence groups passed`
  );
  console.log(`Report: ${reportPath}`);
  console.log(`Sample: ${samplePath}`);
}

function verifyBillingContractCase(api) {
  const issues = api.validateStripeBillingContract(api.stripeBillingContract);
  expectEqual(issues, []);
  const plans = api.billingPlanSummaries();
  expectEqual(
    plans.map((plan) => plan.planTier),
    ["starter", "team", "agency", "enterprise"]
  );
  return {
    contractId: api.stripeBillingContract.id,
    provider: api.stripeBillingContract.provider,
    planLimits: plans,
    webhookEvents: api.stripeBillingContract.webhooks.events,
    entitlementSourceOfTruth:
      "SearchLint entitlement checks, not Stripe tenant authorization"
  };
}

function verifySessionCase(api) {
  const checkout = api.createBillingCheckoutSessionRequest({
    organizationId: "org-1",
    planTier: "team",
    successUrl: "https://app.searchlint.example/billing/success",
    cancelUrl: "https://app.searchlint.example/billing/cancel",
    allowPromotionCodes: true,
    trialDays: 14,
    stripeCustomerId: "cus_fixture"
  });
  const portal = api.createBillingPortalSessionRequest({
    organizationId: "org-1",
    stripeCustomerId: "cus_fixture",
    returnUrl: "https://app.searchlint.example/billing"
  });
  expectEqual(checkout.priceLookupKey, "searchlint_team_monthly");
  expectEqual(portal.flow, "customer_portal");
  return {
    checkout: {
      mode: checkout.mode,
      clientReferenceId: checkout.clientReferenceId,
      priceLookupKey: checkout.priceLookupKey,
      allowPromotionCodes: checkout.allowPromotionCodes,
      trialDays: checkout.trialDays,
      metadata: checkout.metadata
    },
    portal: {
      flow: portal.flow,
      returnUrl: portal.returnUrl,
      metadata: portal.metadata
    }
  };
}

function verifyLifecycleCase(api) {
  const entitlement = organizationEntitlement({ status: "trialing" });
  const subscription = api.summarizeBillingSubscription(entitlement);
  const upgrade = api.createBillingPlanChangeIntent({
    organizationId: "org-1",
    fromPlanTier: "starter",
    toPlanTier: "team"
  });
  const downgrade = api.createBillingPlanChangeIntent({
    organizationId: "org-1",
    fromPlanTier: "agency",
    toPlanTier: "team"
  });
  const cancellation = api.createBillingCancellationIntent(entitlement);
  const usage = api.summarizeBillingUsage([
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
  ]);
  const invoices = api.summarizeBillingInvoices([
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
  ]);
  expectEqual(subscription.trial.active, true);
  expectEqual(upgrade.direction, "upgrade");
  expectEqual(downgrade.direction, "downgrade");
  expectEqual(api.overagePolicyForPlan("team").allowsOverage, false);
  return {
    subscription,
    upgrade,
    downgrade,
    cancellation,
    usage,
    overagePolicies: [
      api.overagePolicyForPlan("team"),
      api.overagePolicyForPlan("enterprise")
    ],
    invoices
  };
}

function verifyWebhookCase(api) {
  const payload = JSON.stringify(stripeSubscriptionEvent());
  const signatureHeader = stripeSignature(payload, 1782086400);
  const event = api.parseStripeWebhookEvent(
    {
      payload,
      signatureHeader
    },
    {
      secret: webhookSecret,
      now: () => new Date("2026-06-22T00:00:00.000Z")
    }
  );
  expectEqual(event.intent.kind, "subscription-entitlement-update");
  expectEqual(event.intent.entitlementStatus, "active");
  return {
    parsedEventType: event.type,
    intentKind: event.intent.kind,
    entitlementStatus: event.intent.entitlementStatus,
    idempotencyKey: event.idempotencyKey,
    rawEventIncludedInSample: false
  };
}

function verifyDashboardCase(dashboard) {
  const html = dashboard.renderDashboardProjectSectionHtml(
    dashboard.createDashboardProjectSectionModel(dashboardSnapshot(), "billing")
  );
  requireIncludes(html, "Billing subscription");
  requireIncludes(html, "Billing invoices");
  requireIncludes(html, "team");
  requireIncludes(html, "active");
  requireIncludes(html, "hard-cap");
  requireIncludes(html, "USD 49.00");
  return {
    renderedTables: ["Billing subscription", "Billing invoices", "Quota"],
    renderedPlan: "team",
    renderedStatus: "active",
    renderedOveragePolicy: "hard-cap"
  };
}

function organizationEntitlement(overrides = {}) {
  return {
    id: "entitlement-1",
    organizationId: "org-1",
    planTier: "starter",
    status: "active",
    currentPeriodStart: "2026-06-01T00:00:00.000Z",
    currentPeriodEnd: "2026-07-01T00:00:00.000Z",
    crawlMaxUrlsPerRun: 1000,
    monthlyCrawledUrlsLimit: 10000,
    externalApiMonthlyLimit: 1000,
    reportRetentionDays: 30,
    source: "stripe",
    createdAt: "2026-06-01T00:00:00.000Z",
    ...overrides
  };
}

function dashboardSnapshot() {
  return {
    organization: { id: "org-1", name: "Acme Agency" },
    project: {
      id: "project-1",
      name: "Example Store",
      siteUrl: "https://example.test"
    },
    environment: {
      id: "env-1",
      name: "Production",
      baseUrl: "https://example.test"
    },
    diagnostics: [],
    crawlRuns: [],
    trends: [],
    externalObservations: [],
    reports: [],
    quotas: [
      {
        label: "Monthly crawled URLs",
        used: 100000,
        limit: 100000
      }
    ],
    billing: {
      planTier: "team",
      status: "active",
      source: "stripe",
      currentPeriodEnd: "2026-07-01T00:00:00.000Z",
      overagePolicy: "hard-cap",
      invoices: [
        {
          id: "in_1",
          status: "paid",
          amountDueCents: 4900,
          currency: "usd"
        }
      ]
    },
    teamMembers: []
  };
}

function stripeSubscriptionEvent() {
  return {
    id: "evt_subscription_fixture",
    type: "customer.subscription.updated",
    created: 1782086400,
    data: {
      object: {
        id: "sub_fixture",
        customer: "cus_fixture",
        status: "active",
        current_period_start: 1782000000,
        current_period_end: 1784678400,
        items: {
          data: [
            {
              price: {
                lookup_key: "searchlint_team_monthly"
              }
            }
          ]
        }
      }
    }
  };
}

function stripeSignature(payload, timestamp) {
  const signedPayload = `${timestamp}.${payload}`;
  const digest = createHmac("sha256", webhookSecret)
    .update(signedPayload)
    .digest("hex");
  return `t=${timestamp},v1=${digest}`;
}

function runCommand(command) {
  const result = spawnSync(command.command, command.args, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: "pipe"
  });
  if (result.status !== 0) {
    throw new Error(
      `${command.name} failed with exit ${result.status}\n${result.stdout}\n${result.stderr}`
    );
  }
  return {
    name: command.name,
    command: [command.command, ...command.args].join(" "),
    status: "passed"
  };
}

async function writeJson(filePath, value) {
  const json = await format(JSON.stringify(value), { parser: "json" });
  await writeFile(filePath, json, "utf8");
}

function expectEqual(actual, expected) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}.`
    );
  }
}

function requireIncludes(value, expected) {
  if (!value.includes(expected)) {
    throw new Error(`Expected value to include ${expected}.`);
  }
}

function assertNoForbiddenSecrets(value) {
  const forbidden = [
    "sk_live",
    "sk_test",
    "whsec_",
    "card[number]",
    "424242424242",
    "customer@example.com",
    "authorization:",
    "bearer "
  ];
  const lower = value.toLowerCase();
  for (const item of forbidden) {
    if (lower.includes(item)) {
      throw new Error(`Forbidden billing secret-like value found: ${item}`);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
