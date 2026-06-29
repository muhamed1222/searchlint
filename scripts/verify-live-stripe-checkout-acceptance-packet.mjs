#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { format } from "prettier";

const reportPath = "reports/live-stripe-checkout-acceptance-packet-report.json";
const samplePath =
  "docs/examples/live-stripe-checkout-acceptance-packet-report.sample.json";

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
    name: "stripeSetupPacket",
    command: "pnpm",
    args: ["billing:stripe-setup-packet"]
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
const packet = api.stripeCheckoutPaymentAcceptancePacket();

expectEqual(packet.acceptanceVersion, 1);
expectEqual(packet.gate, "live-stripe-checkout-payment");
expectEqual(packet.status, "blocked_until_owner_evidence");
expectEqual(
  packet.requiredEvidence.map((item) => item.id),
  [
    "stripe-checkout-session",
    "stripe-customer",
    "stripe-subscription",
    "stripe-payment-or-invoice",
    "stripe-webhook-events",
    "searchlint-entitlement"
  ]
);
expectEqual(
  packet.requiredEvidence.every((item) => item.sanitized),
  true
);

const report = {
  generatedBy: "searchlint-live-stripe-checkout-acceptance-packet-verifier",
  generatedAt: "2026-06-23T00:00:00.000Z",
  status: "checkout-acceptance-packet-ready-live-gate-blocked",
  scope: {
    proofType:
      "deterministic live Stripe checkout payment acceptance packet without fake live signoff",
    doesNotClaim: [
      "live checkout session creation",
      "completed card payment",
      "live Stripe webhook receipt",
      "production entitlement update",
      "owner approval of final live Stripe acceptance"
    ]
  },
  commands: commandResults,
  acceptancePacket: packet,
  evidenceStatus: {
    ownerProvidedLiveEvidencePresent: false,
    fakeSignoffAccepted: false,
    releaseGatePassed: false
  },
  assertions: [
    "The packet defines all owner-provided live evidence required for checkout payment acceptance.",
    "The packet requires sanitized Stripe checkout, customer, subscription, payment/invoice, webhook, and SearchLint entitlement evidence.",
    "The packet explicitly blocks release-gate pass without owner-provided live evidence.",
    "Generated sample evidence contains no Stripe secret keys, webhook secrets, card data, raw customer email addresses, authorization headers, or bearer tokens."
  ],
  remainingReleaseGates: [
    "Run checkout against the owner-controlled Stripe account.",
    "Complete a test payment or valid trial checkout.",
    "Capture sanitized Checkout Session, Customer, Subscription, PaymentIntent or invoice, webhook, and SearchLint entitlement evidence.",
    "Review and approve owner-provided evidence before marking live checkout payment acceptance passed."
  ]
};

assertNoForbiddenSecrets(report);

await mkdir(path.dirname(reportPath), { recursive: true });
await mkdir(path.dirname(samplePath), { recursive: true });
await writeJson(reportPath, report);
await writeJson(samplePath, report);

console.log(
  `Live Stripe checkout acceptance packet PASS: evidence=${packet.requiredEvidence.length}, liveGate=blocked`
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
    "authorization: bearer",
    "bearer sk_"
  ]) {
    if (text.includes(forbidden)) {
      throw new Error(
        `Forbidden live checkout secret-like value found: ${forbidden}`
      );
    }
  }
}

async function writeJson(filePath, value) {
  const json = await format(JSON.stringify(value), { parser: "json" });
  await writeFile(filePath, json, "utf8");
}
