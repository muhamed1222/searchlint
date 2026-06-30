#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { format } from "prettier";

const reportPath = "reports/billing-pricing-static-report.json";
const samplePath = "docs/examples/billing-pricing-static-report.sample.json";

const commands = [
  {
    name: "apiBillingProductTests",
    command: "pnpm",
    args: [
      "--filter",
      "@searchlint/api",
      "test",
      "--",
      "billing-product.test.ts"
    ]
  },
  {
    name: "apiBillingContractTests",
    command: "pnpm",
    args: [
      "--filter",
      "@searchlint/api",
      "test",
      "--",
      "stripe-billing-contracts.test.ts"
    ]
  },
  {
    name: "apiBuild",
    command: "pnpm",
    args: ["--filter", "@searchlint/api", "build"]
  }
];

const commandResults = commands.map(runCommand);
const api = await import(
  pathToFileURL(path.resolve("services/api/dist/src/index.js")).href
);

const pricingTiers = api.publicBillingPricingTiers();
const stripeBlueprints = api.stripeProductPriceBlueprints();
const contractIssues = api.validateStripeBillingContract(
  api.stripeBillingContract
);

expectEqual(contractIssues, []);
expectEqual(
  pricingTiers.map((tier) => tier.planTier),
  ["starter", "team", "agency", "enterprise"]
);
expectEqual(
  stripeBlueprints.map((blueprint) => blueprint.planTier),
  pricingTiers.map((tier) => tier.planTier)
);

const consistency = pricingTiers.map((tier) => {
  const contractPlan = api.stripeBillingContract.plans.find(
    (plan) => plan.planTier === tier.planTier
  );
  const blueprint = stripeBlueprints.find(
    (candidate) => candidate.planTier === tier.planTier
  );
  if (!contractPlan || !blueprint) {
    throw new Error(
      `Missing billing plan consistency data for ${tier.planTier}.`
    );
  }
  expectEqual(tier.priceLookupKey, contractPlan.stripePriceLookupKey);
  expectEqual(blueprint.priceLookupKey, contractPlan.stripePriceLookupKey);
  expectEqual(blueprint.metadata.searchlintPlanTier, tier.planTier);
  expectEqual(blueprint.metadata.entitlementSource, "searchlint");
  return {
    planTier: tier.planTier,
    priceLookupKeyMatchesContract: true,
    limitsMatchContract:
      tier.crawlMaxUrlsPerRun === contractPlan.limits.crawlMaxUrlsPerRun &&
      tier.monthlyCrawledUrlsLimit ===
        contractPlan.limits.monthlyCrawledUrlsLimit &&
      tier.externalApiMonthlyLimit ===
        contractPlan.limits.externalApiMonthlyLimit &&
      tier.reportRetentionDays === contractPlan.limits.reportRetentionDays,
    stripeBlueprintMatchesContract: true
  };
});

if (!consistency.every((item) => item.limitsMatchContract)) {
  throw new Error(
    "Public pricing tier limits must match Stripe billing contract limits."
  );
}

const report = {
  generatedBy: "searchlint-billing-pricing-static-verifier",
  generatedAt: "2026-06-23T00:00:00.000Z",
  status: "pricing-release-candidate-passed-live-release-blocked",
  scope: {
    proofType:
      "deterministic public pricing release-candidate and Stripe product/price blueprint",
    doesNotClaim: [
      "owner approval of final public pricing",
      "legal approval of billing terms",
      "real Stripe product creation",
      "real Stripe price creation",
      "live checkout or payment acceptance"
    ]
  },
  commands: commandResults,
  pricingTiers,
  stripeProductPriceBlueprints: stripeBlueprints,
  consistency,
  assertions: [
    "Every SearchLint plan tier has a public pricing release-candidate entry.",
    "Every public pricing entry maps to the approved Stripe Billing plan lookup key.",
    "Public pricing limits match SearchLint-owned entitlement limits.",
    "Enterprise is contact-sales/custom and does not publish a fixed unit amount.",
    "Generated evidence contains no Stripe secret keys, webhook secrets, card data, or customer data."
  ],
  remainingReleaseGates: [
    "Owner approval of final public pricing and customer communication.",
    "Legal review of pricing, taxes, terms, refunds, and invoice language.",
    "Create real Stripe products and prices from the blueprint.",
    "Run live checkout, portal, subscription, invoice, and webhook acceptance.",
    "Deploy billing UI and verify production E2E."
  ]
};

assertNoForbiddenSecrets(report);

await mkdir(path.dirname(reportPath), { recursive: true });
await mkdir(path.dirname(samplePath), { recursive: true });
await writeJson(reportPath, report);
await writeJson(samplePath, report);

console.log(
  `Billing pricing static PASS: tiers=${pricingTiers.length}, blueprints=${stripeBlueprints.length}`
);
console.log(`Report: ${reportPath}`);
console.log(`Sample: ${samplePath}`);

function runCommand(commandSpec) {
  const result = spawnSync(commandSpec.command, commandSpec.args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  const commandLine = [commandSpec.command, ...commandSpec.args].join(" ");
  if (result.status !== 0) {
    throw new Error(
      `${commandLine} failed with exit ${result.status}\n${result.stdout}\n${result.stderr}`
    );
  }
  return {
    name: commandSpec.name,
    command: commandLine,
    status: "passed"
  };
}

function expectEqual(actual, expected) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}.`
    );
  }
}

function assertNoForbiddenSecrets(value) {
  const text = JSON.stringify(value).toLowerCase();
  for (const forbidden of [
    "sk_live",
    "sk_test",
    "whsec_",
    "424242424242",
    "card[number]",
    "customer@example.com",
    "authorization:",
    "bearer "
  ]) {
    if (text.includes(forbidden)) {
      throw new Error(
        `Forbidden billing secret-like value found: ${forbidden}`
      );
    }
  }
}

async function writeJson(filePath, value) {
  const json = await format(JSON.stringify(value), { parser: "json" });
  await writeFile(filePath, json, "utf8");
}
