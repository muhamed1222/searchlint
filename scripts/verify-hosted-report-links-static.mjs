#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { format } from "prettier";

const reportPath = "reports/hosted-report-links-static-report.json";
const samplePath =
  "docs/examples/hosted-report-links-static-report.sample.json";

const commands = [
  {
    name: "workerSignedUrlTests",
    command: "pnpm",
    args: [
      "--filter",
      "@searchlint/workers",
      "test",
      "--",
      "s3-report-artifact-store.test.ts"
    ]
  },
  {
    name: "objectStorageSignedUrl",
    command: "pnpm",
    args: ["object-storage:signed-url"]
  },
  {
    name: "workersBuild",
    command: "pnpm",
    args: ["--filter", "@searchlint/workers", "build"]
  }
];

const commandResults = commands.map(runCommand);
const workers = await import("../services/workers/dist/src/index.js");

const presigner = createRecordingPresigner();
const service = workers.createReportArtifactSignedUrlService({
  presigner,
  maxTtlSeconds: 300
});
const request = {
  organizationId: "org-1",
  projectId: "project-1",
  environmentId: "env-1",
  principalId: "principal-1"
};
const artifact = {
  id: "report-1",
  organizationId: "org-1",
  projectId: "project-1",
  environmentId: "env-1",
  artifactUri:
    "s3://searchlint-reports/org-1/projects/project-1/reports/report-1.html",
  deletionState: "active",
  expiresAt: "2026-06-23T11:00:00.000Z"
};

const signed = await service.createSignedUrl({
  request,
  artifact,
  ttlSeconds: 120,
  now: "2026-06-23T10:00:00.000Z"
});
assertEqual(signed.expiresAt, "2026-06-23T10:02:00.000Z", "link expiry");
assertEqual(presigner.requests.length, 1, "presigner request count");
assertEqual(
  presigner.requests[0]?.key,
  "org-1/projects/project-1/reports/report-1.html",
  "presigned report key"
);

const negativeCases = await collectNegativeCases(service, request, artifact);
const requiredDocs = [
  "docs/OBJECT_STORAGE_SIGNED_URLS.md",
  "docs/REPORT_TEMPLATES.md",
  "docs/PDF_REPORT_EXPORT.md"
];
const documentEvidence = await Promise.all(requiredDocs.map(readRequiredDoc));

const redactedUrl = redactSignedUrl(signed.url);
const report = {
  generatedBy: "searchlint-hosted-report-links-static-verifier",
  generatedAt: "2026-06-23T00:00:00.000Z",
  status: "readiness-passed-live-gate-blocked",
  scope: {
    proofType: "deterministic static hosted report link contract",
    doesNotClaim: [
      "live S3 signed URL request",
      "deployed API route for hosted report links",
      "browser access to hosted reports",
      "production report access-control flow",
      "production report history"
    ]
  },
  commands: commandResults,
  hostedReportLinkContract: {
    artifactId: artifact.id,
    organizationId: request.organizationId,
    projectId: request.projectId,
    environmentId: request.environmentId,
    principalId: request.principalId,
    artifactUriScheme: "s3",
    ttlSeconds: signed.audit.ttlSeconds,
    expiresAt: signed.expiresAt,
    redactedUrl,
    audit: signed.audit,
    presignerRequests: presigner.requests
  },
  negativeCases,
  documentEvidence,
  assertions: [
    "Hosted report links are generated only through the report artifact signed URL service.",
    "The request organization, project, and environment must match the report artifact metadata.",
    "The report artifact must be active and unexpired before presigning.",
    "The signed URL TTL is positive and bounded.",
    "Audit evidence includes bucket and key fingerprint but excludes signed URL query secrets.",
    "Generated sample evidence redacts signed URL query strings."
  ],
  remainingReleaseGates: [
    "Deploy the hosted report API route.",
    "Run live S3 signed URL request and denial-after-expiry acceptance.",
    "Run production report access-control flow.",
    "Add report history and dashboard report UI integration."
  ]
};

assertNoSignedUrlSecrets(report);

await mkdir(path.dirname(reportPath), { recursive: true });
await mkdir(path.dirname(samplePath), { recursive: true });
await writeJson(reportPath, report);
await writeJson(samplePath, report);

console.log(
  `Hosted report links static contract PASS: ${negativeCases.length} negative cases verified`
);
console.log(`Report: ${reportPath}`);
console.log(`Sample: ${samplePath}`);

async function collectNegativeCases(service, request, artifact) {
  const cases = [
    {
      id: "organization-scope-mismatch",
      artifact: { ...artifact, organizationId: "org-2" },
      expected: "Report artifact organization scope mismatch."
    },
    {
      id: "project-scope-mismatch",
      artifact: { ...artifact, projectId: "project-2" },
      expected: "Report artifact project scope mismatch."
    },
    {
      id: "environment-scope-mismatch",
      artifact: { ...artifact, environmentId: "env-2" },
      expected: "Report artifact environment scope mismatch."
    },
    {
      id: "deleted-artifact",
      artifact: { ...artifact, deletionState: "deleted" },
      expected: "Report artifact is not active."
    },
    {
      id: "expired-artifact",
      artifact: { ...artifact, expiresAt: "2026-06-23T09:59:59.000Z" },
      expected: "Report artifact is expired."
    },
    {
      id: "ttl-too-large",
      ttlSeconds: 301,
      artifact,
      expected: "Signed URL TTL exceeds the configured maximum."
    }
  ];
  const results = [];
  for (const item of cases) {
    let actual = "";
    try {
      await service.createSignedUrl({
        request,
        artifact: item.artifact,
        ttlSeconds: item.ttlSeconds ?? 60,
        now: "2026-06-23T10:00:00.000Z"
      });
    } catch (error) {
      actual = error instanceof Error ? error.message : String(error);
    }
    assertEqual(actual, item.expected, item.id);
    results.push({
      id: item.id,
      status: "passed",
      expectedError: item.expected
    });
  }
  return results;
}

async function readRequiredDoc(filePath) {
  const text = await readFile(filePath, "utf8");
  const requiredFragments = {
    "docs/OBJECT_STORAGE_SIGNED_URLS.md": [
      "hosted report",
      "signed URL authorization",
      "cross-tenant access denial"
    ],
    "docs/REPORT_TEMPLATES.md": [
      "Hosted report links",
      "cloud storage, authentication, authorization"
    ],
    "docs/PDF_REPORT_EXPORT.md": ["hosted report links"]
  }[filePath];
  for (const fragment of requiredFragments) {
    if (!text.includes(fragment)) {
      throw new Error(`${filePath} is missing required text: ${fragment}`);
    }
  }
  return {
    filePath,
    status: "present",
    checkedFragments: requiredFragments
  };
}

function redactSignedUrl(value) {
  const url = new URL(value);
  url.search = "?<redacted>";
  return url.toString();
}

function assertNoSignedUrlSecrets(value) {
  const serialized = JSON.stringify(value);
  for (const forbidden of [
    "X-Amz-Signature=",
    "X-Amz-Credential=",
    "secret-signature"
  ]) {
    if (serialized.includes(forbidden)) {
      throw new Error(`Hosted report link evidence leaked ${forbidden}.`);
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
  const json = await format(`${JSON.stringify(value, null, 2)}\n`, {
    parser: "json"
  });
  await writeFile(filePath, json);
}

function createRecordingPresigner() {
  return {
    requests: [],
    async createSignedGetUrl(input) {
      this.requests.push(input);
      return `https://signed.example.test/report?X-Amz-Signature=secret-signature`;
    }
  };
}
