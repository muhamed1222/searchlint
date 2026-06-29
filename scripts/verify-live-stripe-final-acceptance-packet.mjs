#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { format } from "prettier";

const reportPath = "reports/live-stripe-final-acceptance-packet-report.json";
const samplePath =
  "docs/examples/live-stripe-final-acceptance-packet-report.sample.json";

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
    name: "webhookRdsAcceptancePacket",
    command: "pnpm",
    args: ["billing:webhook-rds-acceptance-packet"]
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
const packet = api.stripeFinalAcceptancePacket();

expectEqual(packet.acceptanceVersion, 1);
expectEqual(packet.gate, "live-stripe-final-acceptance");
expectEqual(packet.status, "blocked_until_owner_evidence");
expectEqual(packet.requiredPredecessorGates, [
  "stripe-products-prices-live-setup",
  "live-stripe-checkout-payment",
  "live-stripe-customer-portal",
  "live-stripe-subscription-lifecycle",
  "deployed-stripe-webhook-rds-persistence"
]);
expectEqual(
  packet.requiredEvidence.map((item) => item.id),
  [
    "stripe-products-prices-live-setup",
    "live-checkout-payment",
    "live-customer-portal",
    "live-subscription-lifecycle",
    "deployed-webhook-rds-persistence",
    "billing-ui-e2e",
    "legal-pricing-approval",
    "owner-final-signoff"
  ]
);
expectEqual(
  packet.requiredEvidence.every((item) => item.sanitized),
  true
);

const report = {
  generatedBy: "searchlint-live-stripe-final-acceptance-packet-verifier",
  generatedAt: "2026-06-23T00:00:00.000Z",
  status: "live-stripe-final-acceptance-packet-ready-final-gate-blocked",
  scope: {
    proofType:
      "deterministic final live Stripe acceptance packet without fake final signoff",
    doesNotClaim: [
      "real Stripe product/price creation",
      "live checkout payment",
      "live customer portal action",
      "live subscription lifecycle completion",
      "deployed webhook RDS persistence",
      "billing UI production E2E",
      "legal approval",
      "owner final signoff"
    ]
  },
  commands: commandResults,
  acceptancePacket: packet,
  evidenceStatus: {
    ownerProvidedFinalEvidencePresent: false,
    fakeSignoffAccepted: false,
    releaseGatePassed: false
  },
  assertions: [
    "The packet aggregates all predecessor Stripe evidence packets required for final live acceptance.",
    "The packet requires sanitized products/prices, checkout, portal, lifecycle, webhook/RDS, billing UI, legal/pricing, and owner sign-off evidence.",
    "The packet explicitly blocks final release-gate pass without owner-provided live/deployed evidence.",
    "Generated sample evidence contains no Stripe secret keys, webhook secrets, raw database URLs, passwords, private keys, card data, raw customer email addresses, authorization headers, bearer tokens, unredacted payloads, invoice URLs, or portal URLs."
  ],
  remainingReleaseGates: [
    "Provide owner-approved sanitized evidence for every predecessor Stripe gate.",
    "Run deployed billing UI E2E against the final Stripe configuration.",
    "Complete legal/pricing approval for public or paid customer access.",
    "Review all sanitized evidence versions and record explicit owner final sign-off.",
    "Only then mark final live Stripe acceptance passed."
  ]
};

assertNoForbiddenSecrets(report);

await mkdir(path.dirname(reportPath), { recursive: true });
await mkdir(path.dirname(samplePath), { recursive: true });
await writeJson(reportPath, report);
await writeJson(samplePath, report);

console.log(
  `Live Stripe final acceptance packet PASS: predecessors=${packet.requiredPredecessorGates.length}, evidence=${packet.requiredEvidence.length}, finalGate=blocked`
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
    "postgres://",
    "postgresql://",
    "password=",
    "-----begin private key",
    "private_key=",
    "424242424242",
    "card[number]",
    "customer@example.com",
    "authorization: bearer",
    "bearer sk_",
    "raw_payload",
    "invoice.stripe.com",
    "billing.stripe.com/p/session"
  ]) {
    if (text.includes(forbidden)) {
      throw new Error(
        `Forbidden final live Stripe secret-like value found: ${forbidden}`
      );
    }
  }
}

async function writeJson(filePath, value) {
  const json = await format(JSON.stringify(value), { parser: "json" });
  await writeFile(filePath, json, "utf8");
}
