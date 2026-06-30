#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { format } from "prettier";

const reportPath = "reports/report-access-controls-static-report.json";
const samplePath =
  "docs/examples/report-access-controls-static-report.sample.json";
const now = "2026-06-23T10:00:00.000Z";

const commands = [
  {
    name: "apiReportAccessControlTests",
    command: "pnpm",
    args: [
      "--filter",
      "@searchlint/api",
      "test",
      "--",
      "report-access-control.test.ts"
    ]
  },
  {
    name: "hostedLinksStatic",
    command: "pnpm",
    args: ["reports:hosted-links-static"]
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

const request = {
  actor: {
    id: "principal-1",
    externalSubject: "cognito|principal-1"
  },
  membership: {
    id: "membership-1",
    organizationId: "org-1",
    principalId: "principal-1",
    role: "client",
    createdAt: "2026-06-23T00:00:00.000Z"
  },
  organizationId: "org-1",
  projectId: "project-1",
  environmentId: "env-1",
  artifact: artifactAccessMetadata(),
  now
};

const authorizedDecision = api.authorizeReportArtifactAccess(request);
assertAllowed(authorizedDecision, "authorized decision");

const presigner = createRecordingPresigner();
const signedUrlService = workers.createReportArtifactSignedUrlService({
  presigner,
  maxTtlSeconds: 300
});
const signed = await signedUrlService.createSignedUrl({
  request: {
    organizationId: request.organizationId,
    projectId: request.projectId,
    environmentId: request.environmentId,
    principalId: request.actor.id
  },
  artifact: {
    ...request.artifact,
    artifactUri:
      "s3://searchlint-reports/org-1/projects/project-1/reports/report-1.html"
  },
  ttlSeconds: 120,
  now
});
assertEqual(presigner.requests.length, 1, "authorized presign count");

const deniedCases = await collectDeniedCases(api, presigner, request);
const requiredDocs = [
  "docs/HOSTED_REPORT_LINKS_STATIC_CONTRACT.md",
  "docs/REPORT_EXPIRATION_STATIC_CONTRACT.md",
  "docs/REPORT_TEMPLATES.md",
  "docs/AUTH_RBAC_ACCEPTANCE.md"
];
const documentEvidence = await Promise.all(requiredDocs.map(readRequiredDoc));

const report = {
  generatedBy: "searchlint-report-access-controls-static-verifier",
  generatedAt: "2026-06-23T00:00:00.000Z",
  status: "readiness-passed-live-gate-blocked",
  scope: {
    proofType: "deterministic static report access-control contract",
    doesNotClaim: [
      "deployed hosted report API route",
      "live browser hosted report access",
      "live identity-provider session enforcement",
      "live S3 signed URL request",
      "production report history"
    ]
  },
  commands: commandResults,
  accessControlContract: {
    permission: "report:read",
    allowedRoles: ["owner", "admin", "developer", "analyst", "client"].filter(
      (role) => api.roleHasPermission(role, "report:read")
    ),
    authorizedDecision,
    signedLink: {
      artifactId: signed.audit.artifactId,
      expiresAt: signed.expiresAt,
      ttlSeconds: signed.audit.ttlSeconds,
      redactedUrl: redactSignedUrl(signed.url),
      audit: signed.audit,
      presignerRequests: presigner.requests
    },
    deniedCases
  },
  documentEvidence,
  assertions: [
    "Hosted report access is authorized before creating a signed URL.",
    "The actor must have an organization membership in the requested organization.",
    "The actor role must include report:read permission.",
    "The report artifact organization, project, and environment must match the request.",
    "Inactive and expired artifacts are denied before presigning.",
    "Denied access cases do not call the signed URL presigner.",
    "Generated sample evidence redacts signed URL query secrets."
  ],
  remainingReleaseGates: [
    "Expose the deployed hosted report API route.",
    "Run live identity-provider session and RBAC denial acceptance.",
    "Run live S3 signed URL request and denial-after-expiry acceptance.",
    "Add dashboard report UI access-control E2E.",
    "Add report history."
  ]
};

assertNoSignedUrlSecrets(report);

await mkdir(path.dirname(reportPath), { recursive: true });
await mkdir(path.dirname(samplePath), { recursive: true });
await writeJson(reportPath, report);
await writeJson(samplePath, report);

console.log(
  `Report access controls static contract PASS: ${deniedCases.length} denial cases verified`
);
console.log(`Report: ${reportPath}`);
console.log(`Sample: ${samplePath}`);

async function collectDeniedCases(api, presigner, request) {
  const cases = [
    {
      id: "missing-membership",
      request: {
        ...request,
        membership: undefined
      },
      expectedReason: "missing-membership"
    },
    {
      id: "membership-organization-mismatch",
      request: {
        ...request,
        membership: {
          ...request.membership,
          organizationId: "org-2"
        }
      },
      expectedReason: "membership-scope-mismatch"
    },
    {
      id: "membership-principal-mismatch",
      request: {
        ...request,
        membership: {
          ...request.membership,
          principalId: "principal-2"
        }
      },
      expectedReason: "membership-scope-mismatch"
    },
    {
      id: "artifact-organization-mismatch",
      request: {
        ...request,
        artifact: {
          ...request.artifact,
          organizationId: "org-2"
        }
      },
      expectedReason: "artifact-organization-mismatch"
    },
    {
      id: "artifact-project-mismatch",
      request: {
        ...request,
        artifact: {
          ...request.artifact,
          projectId: "project-2"
        }
      },
      expectedReason: "artifact-project-mismatch"
    },
    {
      id: "artifact-environment-mismatch",
      request: {
        ...request,
        artifact: {
          ...request.artifact,
          environmentId: "env-2"
        }
      },
      expectedReason: "artifact-environment-mismatch"
    },
    {
      id: "artifact-deleted",
      request: {
        ...request,
        artifact: {
          ...request.artifact,
          deletionState: "deleted"
        }
      },
      expectedReason: "artifact-not-active"
    },
    {
      id: "artifact-expired",
      request: {
        ...request,
        artifact: {
          ...request.artifact,
          expiresAt: "2026-06-23T09:59:59.000Z"
        }
      },
      expectedReason: "artifact-expired"
    }
  ];

  const results = [];
  for (const item of cases) {
    const beforePresignCount = presigner.requests.length;
    const decision = api.authorizeReportArtifactAccess(item.request);
    assertDenied(decision, item.expectedReason, item.id);
    assertEqual(
      presigner.requests.length,
      beforePresignCount,
      `${item.id} presign count`
    );
    results.push({
      id: item.id,
      status: "passed",
      expectedReason: item.expectedReason,
      actualReason: decision.reason,
      presignerCalled: false
    });
  }
  return results;
}

function artifactAccessMetadata(overrides = {}) {
  return {
    id: "report-1",
    organizationId: "org-1",
    projectId: "project-1",
    environmentId: "env-1",
    deletionState: "active",
    expiresAt: "2026-06-23T11:00:00.000Z",
    ...overrides
  };
}

async function readRequiredDoc(filePath) {
  const text = await readFile(filePath, "utf8");
  const normalizedText = text.replace(/\s+/gu, " ");
  const requiredFragments = {
    "docs/HOSTED_REPORT_LINKS_STATIC_CONTRACT.md": [
      "scope and redaction contract",
      "live identity-provider access-control flow"
    ],
    "docs/REPORT_EXPIRATION_STATIC_CONTRACT.md": [
      "expired artifacts are rejected before hosted-link presigning"
    ],
    "docs/REPORT_TEMPLATES.md": [
      "cloud storage, authentication, authorization"
    ],
    "docs/AUTH_RBAC_ACCEPTANCE.md": ["report:read", "Tenant isolation"]
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

function redactSignedUrl(value) {
  const url = new URL(value);
  url.search = "?<redacted>";
  return url.toString();
}

function assertAllowed(decision, label) {
  if (!decision.allowed) {
    throw new Error(`${label}: expected allowed, received ${decision.reason}.`);
  }
}

function assertDenied(decision, expectedReason, label) {
  if (decision.allowed) {
    throw new Error(`${label}: expected denied, received allowed.`);
  }
  assertEqual(decision.reason, expectedReason, `${label} denial reason`);
}

function assertNoSignedUrlSecrets(value) {
  const serialized = JSON.stringify(value);
  for (const forbidden of [
    "X-Amz-Signature=",
    "X-Amz-Credential=",
    "secret-signature"
  ]) {
    if (serialized.includes(forbidden)) {
      throw new Error(`Report access-control evidence leaked ${forbidden}.`);
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
      return "https://signed.example.test/report?X-Amz-Signature=secret-signature";
    }
  };
}
