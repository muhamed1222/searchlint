#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { format } from "prettier";

const reportPath = "reports/agency-hosted-white-label-report-links-report.json";
const samplePath =
  "docs/examples/agency-hosted-white-label-report-links-report.sample.json";
const now = "2026-06-23T10:00:00.000Z";

const commands = [
  {
    name: "apiAgencyTests",
    command: "pnpm",
    args: ["--filter", "@searchlint/api", "test", "--", "agency-mode.test.ts"]
  },
  {
    name: "hostedReportLinksStatic",
    command: "pnpm",
    args: ["reports:hosted-links-static"]
  },
  {
    name: "reportAccessControlsStatic",
    command: "pnpm",
    args: ["reports:access-controls-static"]
  },
  {
    name: "apiBuild",
    command: "pnpm",
    args: ["--filter", "@searchlint/api", "build"]
  },
  {
    name: "workersBuild",
    command: "pnpm",
    args: ["--filter", "@searchlint/workers", "build"]
  }
];

const commandResults = commands.map(runCommand);
const api = await import("../services/api/dist/src/index.js");
const workers = await import("../services/workers/dist/src/index.js");

const presigner = createRecordingPresigner();
const signedUrlService = workers.createReportArtifactSignedUrlService({
  presigner,
  maxTtlSeconds: 300
});
const grant = api.createAgencyHostedWhiteLabelReportLinkGrant({
  actor: principal(),
  membership: membership(),
  workspace: workspace(),
  project: project(),
  brand: brand(),
  artifact: reportArtifact(),
  now,
  ttlSeconds: 180
});
assertAllowed(grant, "agency hosted white-label grant");

const signed = await signedUrlService.createSignedUrl(grant.signedUrlRequest);
assertEqual(
  presigner.requests[0]?.key,
  "org-1/projects/project-1/reports/agency-white-label-report.html",
  "agency report key"
);

const denialCases = collectDenialCases(api);
const report = {
  generatedBy: "searchlint-agency-hosted-white-label-report-links-verifier",
  generatedAt: "2026-06-23T00:00:00.000Z",
  status: "passed",
  scope: {
    proofType:
      "deterministic agency hosted white-label report link contract proof",
    closesChecklistItem: "Реализовать hosted white-label report links",
    doesNotClaim: [
      "live S3 signed URL request",
      "deployed hosted report API route",
      "production identity-provider browser session",
      "custom domain routing",
      "brand asset upload"
    ]
  },
  commands: commandResults,
  grant: {
    allowed: grant.allowed,
    clientWorkspaceId: grant.clientWorkspaceId,
    clientName: grant.clientName,
    brandLabel: grant.brandLabel,
    reportKind: grant.reportKind,
    evidence: grant.evidence
  },
  signedLink: {
    artifactId: signed.audit.artifactId,
    expiresAt: signed.expiresAt,
    ttlSeconds: signed.audit.ttlSeconds,
    redactedUrl: redactSignedUrl(signed.url),
    audit: signed.audit,
    presignerRequests: presigner.requests
  },
  denialCases,
  assertions: [
    "Agency hosted white-label links require an active client workspace.",
    "The white-label brand must belong to the requested client workspace.",
    "The report artifact must be an agency report.",
    "The report artifact must have an S3 artifact URI before presigning.",
    "The actor must pass report:read authorization before a signed URL request is created.",
    "Signed URL evidence is redacted and contains no query secrets."
  ],
  remainingReleaseGates: [
    "Deploy hosted report API route.",
    "Run live S3 signed URL acceptance.",
    "Run production identity-provider browser access-control E2E.",
    "Implement custom domain routing if required.",
    "Implement brand asset upload if required."
  ]
};

assertNoSensitiveValues(report);

await mkdir(path.dirname(reportPath), { recursive: true });
await mkdir(path.dirname(samplePath), { recursive: true });
await writeJson(reportPath, report);
await writeJson(samplePath, report);

console.log(
  `Agency hosted white-label report links PASS: ${denialCases.length} denial cases verified`
);
console.log(`Report: ${reportPath}`);
console.log(`Sample: ${samplePath}`);

function collectDenialCases(api) {
  const cases = [
    {
      id: "archived-workspace",
      input: {
        workspace: { ...workspace(), status: "archived" }
      },
      reason: "workspace-not-active"
    },
    {
      id: "brand-workspace-mismatch",
      input: {
        brand: { ...brand(), clientWorkspaceId: "client-other" }
      },
      reason: "brand-workspace-mismatch"
    },
    {
      id: "non-agency-report",
      input: {
        artifact: { ...reportArtifact(), reportKind: "developer" }
      },
      reason: "report-kind-mismatch"
    },
    {
      id: "missing-artifact-uri",
      input: {
        artifact: { ...reportArtifact(), artifactUri: undefined }
      },
      reason: "missing-artifact-uri"
    },
    {
      id: "missing-membership",
      input: {
        membership: undefined
      },
      reason: "access-denied",
      accessReason: "missing-membership"
    }
  ];

  return cases.map((item) => {
    const grant = api.createAgencyHostedWhiteLabelReportLinkGrant({
      actor: principal(),
      membership: membership(),
      workspace: workspace(),
      project: project(),
      brand: brand(),
      artifact: reportArtifact(),
      now,
      ttlSeconds: 180,
      ...item.input
    });
    if (grant.allowed) {
      throw new Error(`${item.id}: expected denial, received allowed grant.`);
    }
    assertEqual(grant.reason, item.reason, `${item.id} reason`);
    if (item.accessReason !== undefined) {
      assertEqual(
        grant.accessReason,
        item.accessReason,
        `${item.id} access reason`
      );
    }
    return {
      id: item.id,
      status: "passed",
      reason: grant.reason,
      ...(grant.accessReason === undefined
        ? {}
        : { accessReason: grant.accessReason })
    };
  });
}

function principal() {
  return {
    id: "principal-client",
    externalSubject: "cognito|principal-client"
  };
}

function membership() {
  return {
    id: "membership-client",
    organizationId: "org-1",
    principalId: "principal-client",
    role: "client",
    createdAt: "2026-06-23T00:00:00.000Z"
  };
}

function workspace() {
  return {
    id: "client-1",
    organizationId: "org-1",
    clientName: "Acme Retail",
    status: "active",
    ownerPrincipalId: "principal-owner",
    createdAt: "2026-06-23T00:00:00.000Z"
  };
}

function project() {
  return {
    id: "client-project-1",
    workspaceId: "client-1",
    projectId: "project-1",
    environmentId: "env-1",
    displayName: "Acme Store",
    siteUrl: "https://retail.example.test",
    healthScore: 92,
    openDiagnostics: 4,
    blockerDiagnostics: 1
  };
}

function brand() {
  return {
    clientWorkspaceId: "client-1",
    brandLabel: "Acme SEO",
    logoUri: "s3://searchlint-artifacts/org-1/brands/client-1/logo.svg",
    primaryColor: "#1d4ed8",
    reportFooter: "Prepared for Acme Retail"
  };
}

function reportArtifact() {
  return {
    id: "agency-white-label-report",
    organizationId: "org-1",
    projectId: "project-1",
    environmentId: "env-1",
    reportKind: "agency",
    artifactUri:
      "s3://searchlint-reports/org-1/projects/project-1/reports/agency-white-label-report.html",
    pinned: false,
    generatedAt: "2026-06-23T00:00:00.000Z",
    retentionUntil: "2026-06-24T00:00:00.000Z",
    deletionState: "active",
    createdAt: "2026-06-23T00:00:00.000Z"
  };
}

function createRecordingPresigner() {
  const requests = [];
  return {
    requests,
    async createSignedGetUrl(input) {
      requests.push(input);
      return `https://reports.example.test/${input.bucket}/${input.key}?X-Amz-Signature=secret-signature`;
    }
  };
}

function assertAllowed(grant, label) {
  if (!grant.allowed) {
    throw new Error(
      `${label}: expected allowed grant, received ${grant.reason}.`
    );
  }
}

function redactSignedUrl(value) {
  const url = new URL(value);
  url.search = "?<redacted>";
  return url.toString();
}

function assertNoSensitiveValues(value) {
  const serialized = JSON.stringify(value);
  for (const forbidden of [
    "X-Amz-Signature=",
    "secret-signature",
    "authorization:",
    "bearer ",
    "private_key",
    "client-secret",
    "sk_live",
    "whsec_"
  ]) {
    if (serialized.toLowerCase().includes(forbidden.toLowerCase())) {
      throw new Error(
        `Agency hosted white-label evidence leaked ${forbidden}.`
      );
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
