#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { format } from "prettier";

const reportPath = "reports/report-expiration-static-report.json";
const samplePath = "docs/examples/report-expiration-static-report.sample.json";
const now = "2026-09-20T00:00:00.000Z";

const commands = [
  {
    name: "retentionWorkerTests",
    command: "pnpm",
    args: [
      "--filter",
      "@searchlint/workers",
      "test",
      "--",
      "report-artifact-retention-worker.test.ts",
      "report-artifact-cleanup-polling-runtime.test.ts"
    ]
  },
  {
    name: "hostedLinksStatic",
    command: "pnpm",
    args: ["reports:hosted-links-static"]
  },
  {
    name: "workersBuild",
    command: "pnpm",
    args: ["--filter", "@searchlint/workers", "build"]
  }
];

const commandResults = commands.map(runCommand);
const workers = await import("../services/workers/dist/src/index.js");

const expirationHarness = createExpirationHarness([
  reportArtifact({
    id: "expired-html",
    artifactUri: "s3://searchlint-reports/org-1/reports/expired-html.html",
    retentionUntil: "2026-09-19T00:00:00.000Z"
  }),
  reportArtifact({
    id: "expired-pdf",
    reportKind: "pdf",
    artifactUri: "s3://searchlint-reports/org-1/reports/expired-pdf.pdf",
    retentionUntil: "2026-09-01T00:00:00.000Z"
  }),
  reportArtifact({
    id: "active-html",
    artifactUri: "s3://searchlint-reports/org-1/reports/active-html.html",
    retentionUntil: "2026-10-01T00:00:00.000Z"
  }),
  reportArtifact({
    id: "pinned-expired",
    pinned: true,
    artifactUri: "s3://searchlint-reports/org-1/reports/pinned.html",
    retentionUntil: "2026-09-01T00:00:00.000Z"
  })
]);

const cleanupResult = await workers.deleteExpiredReportArtifacts({
  store: expirationHarness.store,
  objectStore: expirationHarness.objectStore,
  now,
  limit: 10
});

assertEqual(cleanupResult.selected, 2, "selected expired artifacts");
assertEqual(cleanupResult.leased, 2, "leased expired artifacts");
assertEqual(cleanupResult.deleted, 2, "deleted expired artifacts");
assertEqual(cleanupResult.failed, 0, "failed expired artifacts");
assertEqual(cleanupResult.skipped, 0, "skipped expired artifacts");
assertEqual(
  expirationHarness.events.join("|"),
  [
    "select-expired:2026-09-20T00:00:00.000Z:10",
    "lease:expired-html",
    "object-delete:s3://searchlint-reports/org-1/reports/expired-html.html",
    "metadata-deleted:expired-html",
    "lease:expired-pdf",
    "object-delete:s3://searchlint-reports/org-1/reports/expired-pdf.pdf",
    "metadata-deleted:expired-pdf"
  ].join("|"),
  "expiration cleanup event sequence"
);

const signedUrlService = workers.createReportArtifactSignedUrlService({
  presigner: createRecordingPresigner(),
  maxTtlSeconds: 300
});
let expiredLinkError = "";
try {
  await signedUrlService.createSignedUrl({
    request: {
      organizationId: "org-1",
      projectId: "project-1",
      environmentId: "env-1",
      principalId: "principal-1"
    },
    artifact: {
      id: "expired-html",
      organizationId: "org-1",
      projectId: "project-1",
      environmentId: "env-1",
      artifactUri: "s3://searchlint-reports/org-1/reports/expired-html.html",
      deletionState: "active",
      expiresAt: "2026-09-19T00:00:00.000Z"
    },
    ttlSeconds: 120,
    now
  });
} catch (error) {
  expiredLinkError = error instanceof Error ? error.message : String(error);
}
assertEqual(expiredLinkError, "Report artifact is expired.", "expired link");

const requiredDocs = [
  "docs/HOSTED_REPORT_LINKS_STATIC_CONTRACT.md",
  "docs/OBJECT_STORAGE_SIGNED_URLS.md",
  "docs/REPORT_TEMPLATES.md"
];
const documentEvidence = await Promise.all(requiredDocs.map(readRequiredDoc));

const report = {
  generatedBy: "searchlint-report-expiration-static-verifier",
  generatedAt: "2026-06-23T00:00:00.000Z",
  status: "readiness-passed-live-gate-blocked",
  scope: {
    proofType: "deterministic static report expiration contract",
    doesNotClaim: [
      "live deployed cleanup worker",
      "live S3 object deletion",
      "deployed API denial after expiration",
      "production report access-control flow",
      "production report history"
    ]
  },
  commands: commandResults,
  expirationContract: {
    now,
    selectedExpiredArtifacts: ["expired-html", "expired-pdf"],
    excludedArtifacts: [
      {
        id: "active-html",
        reason: "retentionUntil is after now"
      },
      {
        id: "pinned-expired",
        reason: "pinned artifacts are excluded from cleanup"
      }
    ],
    cleanupResult,
    events: expirationHarness.events,
    expiredSignedLinkRejection: expiredLinkError
  },
  documentEvidence,
  assertions: [
    "Report expiration is driven by report artifact retention metadata.",
    "Only unpinned active artifacts with retentionUntil at or before now are selected.",
    "Cleanup leases metadata before deleting object storage payloads.",
    "Object storage payloads are deleted before metadata is marked deleted.",
    "Expired artifacts are rejected before hosted link presigning.",
    "Generated evidence does not include signed URL query secrets."
  ],
  remainingReleaseGates: [
    "Deploy report artifact cleanup worker.",
    "Run live S3 object deletion and denial-after-expiration acceptance.",
    "Expose deployed hosted report expiration through API/dashboard.",
    "Add production report access-control flow.",
    "Add report history."
  ]
};

await mkdir(path.dirname(reportPath), { recursive: true });
await mkdir(path.dirname(samplePath), { recursive: true });
await writeJson(reportPath, report);
await writeJson(samplePath, report);

console.log(
  `Report expiration static contract PASS: selected=${cleanupResult.selected}, deleted=${cleanupResult.deleted}`
);
console.log(`Report: ${reportPath}`);
console.log(`Sample: ${samplePath}`);

function createExpirationHarness(artifacts) {
  const events = [];
  const mutable = artifacts.map((artifact) => ({ ...artifact }));
  const store = {
    async insertReportArtifact(input) {
      return input;
    },
    async selectExpiredReportArtifacts(input) {
      events.push(`select-expired:${input.now}:${input.limit}`);
      return mutable
        .filter(
          (artifact) =>
            artifact.deletionState === "active" &&
            artifact.pinned === false &&
            Date.parse(artifact.retentionUntil) <= Date.parse(input.now)
        )
        .slice(0, input.limit);
    },
    async markReportArtifactDeleting(input) {
      events.push(`lease:${input.id}`);
      const artifact = mutable.find(
        (item) =>
          item.id === input.id &&
          item.organizationId === input.organizationId &&
          item.deletionState === "active"
      );
      if (!artifact) {
        return undefined;
      }
      artifact.deletionState = "deleting";
      return { ...artifact };
    },
    async markReportArtifactDeleted(input) {
      events.push(`metadata-deleted:${input.id}`);
      const artifact = mutable.find(
        (item) =>
          item.id === input.id && item.organizationId === input.organizationId
      );
      if (!artifact || artifact.deletionState !== "deleting") {
        return undefined;
      }
      artifact.deletionState = "deleted";
      delete artifact.artifactUri;
      return { ...artifact };
    },
    async markReportArtifactDeletionFailed(input) {
      events.push(`metadata-active:${input.id}`);
      const artifact = mutable.find(
        (item) =>
          item.id === input.id && item.organizationId === input.organizationId
      );
      if (!artifact) {
        return undefined;
      }
      artifact.deletionState = "active";
      return { ...artifact };
    }
  };
  const objectStore = {
    async deleteReportArtifact(input) {
      events.push(`object-delete:${input.artifactUri}`);
    }
  };
  return { events, objectStore, store };
}

function reportArtifact(overrides = {}) {
  return {
    id: "report-1",
    organizationId: "org-1",
    projectId: "project-1",
    environmentId: "env-1",
    reportKind: "html",
    artifactUri: "s3://searchlint-reports/org-1/reports/report-1.html",
    pinned: false,
    generatedAt: "2026-06-21T00:00:00.000Z",
    retentionUntil: "2026-09-19T00:00:00.000Z",
    deletionState: "active",
    createdAt: "2026-06-21T00:00:00.000Z",
    ...overrides
  };
}

async function readRequiredDoc(filePath) {
  const text = await readFile(filePath, "utf8");
  const normalizedText = text.replace(/\s+/gu, " ");
  const requiredFragments = {
    "docs/HOSTED_REPORT_LINKS_STATIC_CONTRACT.md": [
      "inactive or expired artifacts are rejected",
      "live identity-provider access-control flow"
    ],
    "docs/OBJECT_STORAGE_SIGNED_URLS.md": [
      "expired report artifacts are rejected before presigning",
      "denial after signed URL",
      "expiration"
    ],
    "docs/REPORT_TEMPLATES.md": [
      "expiration",
      "cloud storage, authentication, authorization"
    ]
  }[filePath];
  for (const fragment of requiredFragments) {
    if (!normalizedText.includes(fragment)) {
      throw new Error(`${filePath} is missing required text: ${fragment}`);
    }
  }
  return {
    filePath,
    status: "present",
    checkedFragments: requiredFragments
  };
}

function createRecordingPresigner() {
  return {
    async createSignedGetUrl() {
      throw new Error("Presigner must not be called for expired reports.");
    }
  };
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
  const json = await format(`${JSON.stringify(value, null, 2)}\n`, {
    parser: "json"
  });
  await writeFile(filePath, json);
}
