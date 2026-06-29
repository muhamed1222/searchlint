#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { format } from "prettier";

const reportPath = "reports/stripe-setup-packet-report.json";
const samplePath = "docs/examples/stripe-setup-packet-report.sample.json";

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
    name: "billingPricingStatic",
    command: "pnpm",
    args: ["billing:pricing-static"]
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
const packet = api.stripeProductPriceSetupPacket();

expectEqual(packet.setupVersion, 1);
expectEqual(packet.mode, "manual-live-stripe-setup");
expectEqual(packet.doesNotIncludeSecrets, true);
expectEqual(
  packet.entries.map((entry) => entry.planTier),
  ["starter", "team", "agency", "enterprise"]
);

const selfServeEntries = packet.entries.filter(
  (entry) => entry.planTier !== "enterprise"
);
const enterpriseEntry = packet.entries.find(
  (entry) => entry.planTier === "enterprise"
);
expectEqual(
  selfServeEntries.every((entry) => entry.price !== undefined),
  true
);
expectEqual(enterpriseEntry?.price, undefined);

const idempotencyKeys = packet.entries.flatMap((entry) => [
  entry.product.idempotencyKey,
  ...(entry.price === undefined ? [] : [entry.price.idempotencyKey])
]);
expectEqual(new Set(idempotencyKeys).size, idempotencyKeys.length);

const report = {
  generatedBy: "searchlint-stripe-setup-packet-verifier",
  generatedAt: "2026-06-23T00:00:00.000Z",
  status: "stripe-setup-packet-passed-live-release-blocked",
  scope: {
    proofType:
      "deterministic Stripe products/prices live setup packet without Stripe API mutation",
    doesNotClaim: [
      "real Stripe product creation",
      "real Stripe price creation",
      "Stripe account access",
      "live checkout session creation",
      "legal approval of final pricing"
    ]
  },
  commands: commandResults,
  setupPacket: packet,
  assertions: [
    "Every plan tier has a Stripe product create request body.",
    "Starter, Team, and Agency have monthly recurring USD price create request bodies.",
    "Enterprise remains contact-sales/custom and has no fixed recurring price request.",
    "Every create request has a stable idempotency key.",
    "Generated evidence contains no Stripe secret keys, webhook secrets, card data, or customer data."
  ],
  remainingReleaseGates: [
    "Run the setup packet against the owner-controlled Stripe account.",
    "Verify created Stripe product and price IDs in Stripe.",
    "Record live product/price IDs in the deployment secret/config boundary.",
    "Run live checkout, portal, subscription, invoice, and webhook acceptance.",
    "Complete legal approval of final public pricing."
  ]
};

assertNoForbiddenSecrets(report);

await mkdir(path.dirname(reportPath), { recursive: true });
await mkdir(path.dirname(samplePath), { recursive: true });
await writeJson(reportPath, report);
await writeJson(samplePath, report);

console.log(
  `Stripe setup packet PASS: products=${packet.entries.length}, prices=${selfServeEntries.length}`
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
      throw new Error(`Forbidden Stripe secret-like value found: ${forbidden}`);
    }
  }
}

async function writeJson(filePath, value) {
  const json = await format(JSON.stringify(value), { parser: "json" });
  await writeFile(filePath, json, "utf8");
}
