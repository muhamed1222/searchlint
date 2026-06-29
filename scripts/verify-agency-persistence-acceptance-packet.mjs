#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { format } from "prettier";

const reportPath = "reports/agency-persistence-acceptance-packet-report.json";
const samplePath =
  "docs/examples/agency-persistence-acceptance-packet-report.sample.json";

const commands = [
  {
    name: "apiAgencyTests",
    command: "pnpm",
    args: ["--filter", "@searchlint/api", "test", "--", "agency-mode.test.ts"]
  },
  {
    name: "agencyAcceptance",
    command: "pnpm",
    args: ["agency:acceptance"]
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
const packet = api.agencyProductionPersistenceAcceptancePacket();

expectEqual(packet.acceptanceVersion, 1);
expectEqual(packet.gate, "agency-production-client-workspace-persistence");
expectEqual(packet.status, "blocked_until_owner_evidence");
expectEqual(
  packet.requiredEvidence.map((item) => item.id),
  [
    "rds-client-workspaces",
    "rds-client-projects",
    "rds-white-label-brand",
    "rds-shared-rule-policy",
    "rds-assignees-sla",
    "tenant-isolation",
    "retention-deletion-metadata",
    "dashboard-api-read"
  ]
);
expectEqual(
  packet.requiredEvidence.every((item) => item.sanitized),
  true
);

const report = {
  generatedBy: "searchlint-agency-persistence-acceptance-packet-verifier",
  generatedAt: "2026-06-23T00:00:00.000Z",
  status: "agency-persistence-acceptance-packet-ready-deployed-gate-blocked",
  scope: {
    proofType:
      "deterministic agency production persistence acceptance packet without fake deployed signoff",
    doesNotClaim: [
      "production agency workspace persistence",
      "deployed RDS connectivity",
      "deployed dashboard API read",
      "tenant-isolation proof from deployed API",
      "client portal deployment",
      "owner approval of agency production persistence"
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
    "The packet defines owner-provided deployed evidence required for production agency client workspace persistence.",
    "The packet requires sanitized client workspace, client project, white-label brand, shared policy, assignee, SLA, tenant-isolation, retention/deletion, and dashboard/API read evidence.",
    "The packet explicitly blocks release-gate pass without owner-provided deployed evidence.",
    "Generated sample evidence contains no raw customer emails, private keys, raw database URLs, passwords, authorization headers, bearer tokens, raw uploaded brand assets, cross-tenant data, or invite tokens."
  ],
  remainingReleaseGates: [
    "Persist agency client workspaces and related records in deployed PostgreSQL/RDS.",
    "Capture sanitized deployed RDS/API evidence for client workspaces, projects, brands, policies, assignees, SLA, retention, and deletion metadata.",
    "Prove tenant isolation and client read-only access against deployed API.",
    "Capture deployed dashboard/API rendering evidence from persisted data.",
    "Review and approve owner-provided evidence before marking production agency persistence passed."
  ]
};

assertNoForbiddenSecrets(report);

await mkdir(path.dirname(reportPath), { recursive: true });
await mkdir(path.dirname(samplePath), { recursive: true });
await writeJson(reportPath, report);
await writeJson(samplePath, report);

console.log(
  `Agency persistence acceptance packet PASS: evidence=${packet.requiredEvidence.length}, deployedGate=blocked`
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
    "customer@example.com",
    "-----begin private key",
    "private_key=",
    "postgres://",
    "postgresql://",
    "password=",
    "authorization: bearer",
    "bearer sk_",
    "raw_brand_asset",
    "cross_tenant_payload",
    "invite_token="
  ]) {
    if (text.includes(forbidden)) {
      throw new Error(
        `Forbidden agency persistence secret-like value found: ${forbidden}`
      );
    }
  }
}

async function writeJson(filePath, value) {
  const json = await format(JSON.stringify(value), { parser: "json" });
  await writeFile(filePath, json, "utf8");
}
