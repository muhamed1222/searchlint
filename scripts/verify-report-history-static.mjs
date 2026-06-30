#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { format } from "prettier";

const reportPath = "reports/report-history-static-report.json";
const samplePath = "docs/examples/report-history-static-report.sample.json";

const commands = [
  {
    name: "apiReportHistoryTests",
    command: "pnpm",
    args: [
      "--filter",
      "@searchlint/api",
      "test",
      "--",
      "report-history.test.ts"
    ]
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
  }
];

const commandResults = commands.map(runCommand);
const api = await import("../services/api/dist/src/index.js");

const executor = createHistoryExecutor([
  reportRow({
    id: "report-3",
    report_kind: "pdf",
    generated_at: "2026-06-23T00:03:00.000Z",
    artifact_uri: "s3://searchlint-reports/org-1/reports/report-3.pdf",
    retention_until: "2026-09-23T00:00:00.000Z"
  }),
  reportRow({
    id: "report-2",
    report_kind: "agency",
    generated_at: "2026-06-23T00:02:00.000Z",
    pinned: true,
    artifact_uri: "s3://searchlint-reports/org-1/reports/report-2.html",
    retention_until: null
  }),
  reportRow({
    id: "report-1",
    report_kind: "html",
    generated_at: "2026-06-23T00:01:00.000Z",
    artifact_uri: "s3://searchlint-reports/org-1/reports/report-1.html",
    retention_until: "2026-08-23T00:00:00.000Z"
  })
]);
const store = api.createPostgresReportHistoryStore(executor);
const artifacts = await store.list({
  organizationId: "org-1",
  projectId: "project-1",
  environmentId: "env-1",
  limit: 25
});
const summary = api.summarizeReportHistory(artifacts);

assertEqual(artifacts.length, 3, "report history artifact count");
assertEqual(artifacts[0]?.id, "report-3", "newest report first");
assertEqual(summary.total, 3, "summary total");
assertEqual(summary.pdf, 1, "summary pdf count");
assertEqual(summary.agency, 1, "summary agency count");
assertEqual(summary.html, 1, "summary html count");
assertEqual(summary.pinned, 1, "summary pinned count");
assertEqual(summary.withArtifacts, 3, "summary artifact count");
assertEqual(
  summary.latestGeneratedAt,
  "2026-06-23T00:03:00.000Z",
  "latest generated timestamp"
);
assertEqual(
  summary.earliestRetentionUntil,
  "2026-08-23T00:00:00.000Z",
  "earliest retention timestamp"
);
assertEqual(executor.queries.length, 1, "query count");
assertEqual(
  executor.queries[0]?.text,
  'SELECT * FROM "report_artifacts" WHERE "organization_id" = $1 AND "project_id" = $2 AND "environment_id" = $3 AND "deletion_state" = $4 ORDER BY "generated_at" DESC LIMIT $5;',
  "report history SQL"
);
assertArrayEqual(
  executor.queries[0]?.values,
  ["org-1", "project-1", "env-1", "active", 25],
  "report history SQL values"
);

const deniedInputs = await collectInvalidInputs(store);
const requiredDocs = [
  "docs/REPORT_ACCESS_CONTROLS_STATIC_CONTRACT.md",
  "docs/REPORT_TEMPLATES.md",
  "docs/CURRENT_PRODUCT_STATUS.md"
];
const documentEvidence = await Promise.all(requiredDocs.map(readRequiredDoc));

const report = {
  generatedBy: "searchlint-report-history-static-verifier",
  generatedAt: "2026-06-23T00:00:00.000Z",
  status: "readiness-passed-live-gate-blocked",
  scope: {
    proofType: "deterministic static report history contract",
    doesNotClaim: [
      "deployed hosted report history API route",
      "live dashboard report history UI",
      "live object storage retrieval",
      "live identity-provider access-control flow",
      "production report persistence migration"
    ]
  },
  commands: commandResults,
  reportHistoryContract: {
    query: executor.queries[0],
    artifactIds: artifacts.map((artifact) => artifact.id),
    artifactKinds: artifacts.map((artifact) => artifact.reportKind),
    summary
  },
  invalidInputCases: deniedInputs,
  documentEvidence,
  assertions: [
    "Report history is scoped by organization, project, and environment.",
    "Report history queries only active report artifacts.",
    "Report history is ordered by generatedAt descending.",
    "Report history limits are bounded from 1 to 100.",
    "Report history summaries preserve kind counts, pinned count, artifact availability, latest generated timestamp, and earliest retention timestamp.",
    "Report history static evidence does not include signed URL query strings or secrets."
  ],
  remainingReleaseGates: [
    "Expose deployed hosted report history API route.",
    "Render dashboard report history UI against deployed API data.",
    "Run live identity-provider access-control E2E for report history.",
    "Run live object storage retrieval for report artifacts.",
    "Prove production report persistence migration."
  ]
};

assertNoSignedUrlSecrets(report);

await mkdir(path.dirname(reportPath), { recursive: true });
await mkdir(path.dirname(samplePath), { recursive: true });
await writeJson(reportPath, report);
await writeJson(samplePath, report);

console.log(
  `Report history static contract PASS: ${artifacts.length} artifacts summarized`
);
console.log(`Report: ${reportPath}`);
console.log(`Sample: ${samplePath}`);

async function collectInvalidInputs(store) {
  const cases = [
    {
      id: "missing-organization",
      input: {
        organizationId: " ",
        projectId: "project-1",
        environmentId: "env-1",
        limit: 25
      },
      expected: "Report history organizationId is required."
    },
    {
      id: "limit-too-large",
      input: {
        organizationId: "org-1",
        projectId: "project-1",
        environmentId: "env-1",
        limit: 101
      },
      expected: "Report history limit must be an integer from 1 to 100."
    }
  ];
  const results = [];
  for (const item of cases) {
    let actual = "";
    try {
      await store.list(item.input);
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
  const normalizedText = text.replace(/\s+/gu, " ");
  const requiredFragments = {
    "docs/REPORT_ACCESS_CONTROLS_STATIC_CONTRACT.md": [
      "report history",
      "live identity-provider session"
    ],
    "docs/REPORT_TEMPLATES.md": [
      "report history",
      "deployed cloud storage, authentication, authorization"
    ],
    "docs/CURRENT_PRODUCT_STATUS.md": [
      "Report Access Controls Static Contract",
      "report history"
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

function reportRow(overrides = {}) {
  return {
    id: "report-1",
    organization_id: "org-1",
    schema_version: "cloud.report_artifacts.v1",
    created_at: "2026-06-23T00:00:00.000Z",
    retention_until: "2026-08-23T00:00:00.000Z",
    deletion_state: "active",
    project_id: "project-1",
    environment_id: "env-1",
    report_kind: "html",
    artifact_uri: "s3://searchlint-reports/org-1/reports/report-1.html",
    pinned: false,
    generated_at: "2026-06-23T00:01:00.000Z",
    ...overrides
  };
}

function createHistoryExecutor(rows) {
  return {
    queries: [],
    async query(query) {
      this.queries.push(query);
      return {
        rows
      };
    }
  };
}

function assertNoSignedUrlSecrets(value) {
  const serialized = JSON.stringify(value);
  for (const forbidden of [
    "X-Amz-Signature=",
    "X-Amz-Credential=",
    "secret-signature"
  ]) {
    if (serialized.includes(forbidden)) {
      throw new Error(`Report history evidence leaked ${forbidden}.`);
    }
  }
}

function assertArrayEqual(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${label}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}.`
    );
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
