#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { format } from "prettier";

const reportPath = "reports/agency-brand-domain-contract-report.json";
const samplePath =
  "docs/examples/agency-brand-domain-contract-report.sample.json";
const now = "2026-06-23T00:00:00.000Z";

const commands = [
  {
    name: "apiAgencyTests",
    command: "pnpm",
    args: ["--filter", "@searchlint/api", "test", "--", "agency-mode.test.ts"]
  },
  {
    name: "apiBuild",
    command: "pnpm",
    args: ["--filter", "@searchlint/api", "build"]
  }
];

const commandResults = commands.map(runCommand);
const api = await import("../services/api/dist/src/index.js");
const workspace = activeWorkspace();
const assetGrant = api.createAgencyBrandAssetUploadGrant({
  workspace,
  filename: "acme-logo.svg",
  contentType: "image/svg+xml",
  byteLength: 4096,
  sha256: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  requestedAt: now
});
assertAllowed(assetGrant, "brand asset upload grant");

const domainVerification = api.verifyAgencyCustomDomain({
  workspace,
  domain: "Reports.Acme-SEO.example",
  verificationToken: "searchlint_token_1234567890",
  observedTxtValues: [
    "searchlint-site-verification=searchlint_token_1234567890"
  ],
  observedAt: now
});
assertVerified(domainVerification, "custom domain verification");

const assetDenials = collectAssetDenials(api, workspace);
const domainDenials = collectDomainDenials(api, workspace);
const report = {
  generatedBy: "searchlint-agency-brand-domain-contract-verifier",
  generatedAt: now,
  status: "passed",
  scope: {
    proofType: "deterministic agency brand asset and custom domain contract",
    closesChecklistItem:
      "Реализовать brand asset upload/custom domains, если требуется",
    doesNotClaim: [
      "live S3 object upload",
      "live DNS query",
      "CloudFront custom-domain routing",
      "ACM certificate issuance",
      "raw brand asset persistence"
    ]
  },
  commands: commandResults,
  brandAssetUpload: {
    clientWorkspaceId: assetGrant.clientWorkspaceId,
    organizationId: assetGrant.organizationId,
    contentType: assetGrant.contentType,
    byteLength: assetGrant.byteLength,
    objectUri: assetGrant.objectUri,
    objectKey: assetGrant.objectKey,
    metadata: assetGrant.metadata,
    evidence: assetGrant.evidence
  },
  customDomain: domainVerification,
  denialCases: {
    brandAssetUpload: assetDenials,
    customDomain: domainDenials
  },
  assertions: [
    "Brand asset upload grants accept only active client workspaces.",
    "Brand asset upload grants allow only SVG, PNG, JPEG, or WebP assets.",
    "Brand asset upload grants enforce bounded byte length, valid SHA-256, and safe filename extension.",
    "Brand asset evidence stores object URI, key, checksum, and metadata but no raw bytes.",
    "Custom domains require active client workspaces, normalized hostnames, bounded verification tokens, and matching DNS TXT value.",
    "Generated sample evidence contains no raw uploaded asset data, credentials, private keys, or bearer tokens."
  ],
  remainingReleaseGates: [
    "Run live S3 object upload acceptance for brand assets.",
    "Run live DNS TXT lookup acceptance for custom domains.",
    "Wire verified domains into deployed CloudFront/API routing if required.",
    "Issue and validate production TLS certificates if custom domains are enabled."
  ]
};

assertNoSensitiveValues(report);
await mkdir(path.dirname(reportPath), { recursive: true });
await mkdir(path.dirname(samplePath), { recursive: true });
await writeJson(reportPath, report);
await writeJson(samplePath, report);

console.log(
  `Agency brand/domain contract PASS: ${assetDenials.length} asset denials, ${domainDenials.length} domain denials`
);
console.log(`Report: ${reportPath}`);
console.log(`Sample: ${samplePath}`);

function collectAssetDenials(api, workspace) {
  const base = {
    workspace,
    filename: "logo.svg",
    contentType: "image/svg+xml",
    byteLength: 4096,
    sha256: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    requestedAt: now
  };
  const cases = [
    {
      id: "inactive-workspace",
      input: { workspace: { ...workspace, status: "paused" } },
      reason: "workspace-not-active"
    },
    {
      id: "unsupported-content-type",
      input: { contentType: "image/gif" },
      reason: "unsupported-content-type"
    },
    {
      id: "asset-too-large",
      input: { byteLength: 1_000_001 },
      reason: "asset-too-large"
    },
    {
      id: "invalid-sha256",
      input: { sha256: "not-a-sha" },
      reason: "invalid-sha256"
    },
    {
      id: "invalid-filename",
      input: { filename: "../logo.svg" },
      reason: "invalid-filename"
    }
  ];

  return cases.map((item) => {
    const grant = api.createAgencyBrandAssetUploadGrant({
      ...base,
      ...item.input
    });
    if (grant.allowed) {
      throw new Error(`${item.id}: expected asset denial, received allowed.`);
    }
    assertEqual(grant.reason, item.reason, `${item.id} reason`);
    return {
      id: item.id,
      status: "passed",
      reason: grant.reason
    };
  });
}

function collectDomainDenials(api, workspace) {
  const base = {
    workspace,
    domain: "reports.example.test",
    verificationToken: "searchlint_token_1234567890",
    observedTxtValues: [
      "searchlint-site-verification=searchlint_token_1234567890"
    ],
    observedAt: now
  };
  const cases = [
    {
      id: "inactive-workspace",
      input: { workspace: { ...workspace, status: "archived" } },
      reason: "workspace-not-active"
    },
    {
      id: "invalid-domain",
      input: { domain: "https://reports.example.test/path" },
      reason: "invalid-domain"
    },
    {
      id: "invalid-token",
      input: { verificationToken: "short" },
      reason: "invalid-token"
    },
    {
      id: "txt-record-missing",
      input: { observedTxtValues: [] },
      reason: "txt-record-missing"
    }
  ];

  return cases.map((item) => {
    const result = api.verifyAgencyCustomDomain({
      ...base,
      ...item.input
    });
    if (result.verified) {
      throw new Error(`${item.id}: expected domain denial, received verified.`);
    }
    assertEqual(result.reason, item.reason, `${item.id} reason`);
    return {
      id: item.id,
      status: "passed",
      reason: result.reason
    };
  });
}

function activeWorkspace() {
  return {
    id: "client-a",
    organizationId: "org-1",
    clientName: "Acme Retail",
    status: "active",
    ownerPrincipalId: "principal-owner",
    createdAt: now
  };
}

function assertAllowed(value, label) {
  if (!value.allowed) {
    throw new Error(`${label}: expected allowed, received ${value.reason}.`);
  }
}

function assertVerified(value, label) {
  if (!value.verified) {
    throw new Error(`${label}: expected verified, received ${value.reason}.`);
  }
}

function assertNoSensitiveValues(value) {
  const serialized = JSON.stringify(value).toLowerCase();
  for (const forbidden of [
    "<svg",
    "pngbase64",
    "private_key",
    "authorization: bearer",
    "client-secret",
    "sk_live",
    "whsec_"
  ]) {
    if (serialized.includes(forbidden)) {
      throw new Error(`Agency brand/domain evidence leaked ${forbidden}.`);
    }
  }
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, received ${actual}.`);
  }
}

function runCommand(commandSpec) {
  const result = spawnSync(commandSpec.command, commandSpec.args, {
    cwd: process.cwd(),
    env: process.env,
    encoding: "utf8",
    stdio: "pipe"
  });
  if (result.status !== 0) {
    process.stderr.write(result.stdout);
    process.stderr.write(result.stderr);
    throw new Error(
      `${commandSpec.name} failed with exit code ${result.status ?? "unknown"}.`
    );
  }
  return {
    name: commandSpec.name,
    command: [commandSpec.command, ...commandSpec.args].join(" "),
    status: "passed",
    stdout: summarizeOutput(result.stdout)
  };
}

function summarizeOutput(output) {
  return output
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line !== "")
    .filter((line) => !line.startsWith("RUN "))
    .filter((line) => !line.startsWith("Start at "))
    .filter((line) => !line.startsWith("Duration "))
    .filter((line) => !line.startsWith("$ "))
    .slice(-8);
}

async function writeJson(filePath, value) {
  const json = await format(JSON.stringify(value), { parser: "json" });
  await writeFile(filePath, json, "utf8");
}
