#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { format } from "prettier";

const reportPath = "reports/stripe-webhook-rds-acceptance-packet-report.json";
const samplePath =
  "docs/examples/stripe-webhook-rds-acceptance-packet-report.sample.json";

const commands = [
  {
    name: "stripeWebhookTests",
    command: "pnpm",
    args: [
      "--filter",
      "@searchlint/api",
      "test",
      "--",
      "stripe-webhook.test.ts"
    ]
  },
  {
    name: "postgresStripeWebhookStoreTests",
    command: "pnpm",
    args: [
      "--filter",
      "@searchlint/api",
      "test",
      "--",
      "postgres-stripe-webhook-store.test.ts"
    ]
  },
  {
    name: "subscriptionLifecycleAcceptancePacket",
    command: "pnpm",
    args: ["billing:subscription-lifecycle-acceptance-packet"]
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
const packet = api.stripeWebhookRdsPersistenceAcceptancePacket();

expectEqual(packet.acceptanceVersion, 1);
expectEqual(packet.gate, "deployed-stripe-webhook-rds-persistence");
expectEqual(packet.status, "blocked_until_owner_evidence");
expectEqual(
  packet.requiredEvidence.map((item) => item.id),
  [
    "deployed-webhook-request",
    "rds-stripe-webhook-event-row",
    "rds-idempotency-proof",
    "rds-entitlement-update",
    "invoice-signal-persistence",
    "webhook-error-path",
    "audit-metrics-log-redaction",
    "schema-version-proof"
  ]
);
expectEqual(
  packet.requiredEvidence.every((item) => item.sanitized),
  true
);

const report = {
  generatedBy: "searchlint-stripe-webhook-rds-acceptance-packet-verifier",
  generatedAt: "2026-06-23T00:00:00.000Z",
  status: "stripe-webhook-rds-acceptance-packet-ready-deployed-gate-blocked",
  scope: {
    proofType:
      "deterministic deployed Stripe webhook RDS persistence acceptance packet without fake deployed signoff",
    doesNotClaim: [
      "deployed API webhook receipt",
      "live RDS connectivity",
      "real Stripe webhook delivery",
      "deployed entitlement mutation",
      "deployed duplicate replay proof",
      "owner approval of deployed Stripe webhook persistence"
    ]
  },
  commands: commandResults,
  acceptancePacket: packet,
  evidenceStatus: {
    ownerProvidedDeployedEvidencePresent: false,
    fakeSignoffAccepted: false,
    releaseGatePassed: false
  },
  assertions: [
    "The packet defines all owner-provided deployed evidence required for Stripe webhook RDS persistence acceptance.",
    "The packet requires sanitized deployed webhook, RDS processed-event, idempotency, entitlement, invoice signal, error path, redaction, and schema-version evidence.",
    "The packet explicitly blocks release-gate pass without owner-provided deployed evidence.",
    "Generated sample evidence contains no Stripe secret keys, webhook secrets, raw database URLs, passwords, private keys, raw customer email addresses, authorization headers, bearer tokens, or unredacted webhook payloads."
  ],
  remainingReleaseGates: [
    "Deliver valid subscription and invoice webhook events to the deployed SearchLint API.",
    "Capture sanitized RDS rows for stripe_webhook_events and organization_entitlements.",
    "Replay the same Stripe event and prove idempotent duplicate handling on deployed RDS.",
    "Capture deployed invalid-signature or stale-signature rejection evidence.",
    "Review and approve owner-provided deployed evidence before marking Stripe webhook RDS persistence passed."
  ]
};

assertNoForbiddenSecrets(report);

await mkdir(path.dirname(reportPath), { recursive: true });
await mkdir(path.dirname(samplePath), { recursive: true });
await writeJson(reportPath, report);
await writeJson(samplePath, report);

console.log(
  `Stripe webhook RDS acceptance packet PASS: evidence=${packet.requiredEvidence.length}, deployedGate=blocked`
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
    "customer@example.com",
    "authorization: bearer",
    "bearer sk_",
    "raw_payload"
  ]) {
    if (text.includes(forbidden)) {
      throw new Error(
        `Forbidden deployed Stripe webhook secret-like value found: ${forbidden}`
      );
    }
  }
}

async function writeJson(filePath, value) {
  const json = await format(JSON.stringify(value), { parser: "json" });
  await writeFile(filePath, json, "utf8");
}
