#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const reportPath = "reports/privacy-request-execution-report.json";
const samplePath = "docs/examples/privacy-request-execution-report.sample.json";
const fixedGeneratedAt = "2026-06-23T00:00:00.000Z";

function run(command, args) {
  execFileSync(command, args, {
    stdio: "inherit",
    env: process.env
  });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  if (!process.version.startsWith("v24.")) {
    throw new Error(
      `privacy request execution must run under Node.js 24, got ${process.version}`
    );
  }

  run("pnpm", [
    "--filter",
    "@searchlint/api",
    "test",
    "--",
    "security-privacy-release.test.ts"
  ]);
  run("pnpm", ["--filter", "@searchlint/api", "build"]);

  const api = await import(
    pathToFileURL(path.resolve("services/api/dist/src/index.js")).href
  );
  const executions = [
    api.executePrivacyRequest({
      kind: "user-data-export",
      actorPrincipalId: "principal-1",
      targetId: "account-1"
    }),
    api.executePrivacyRequest({
      kind: "account-deletion",
      actorPrincipalId: "principal-1",
      targetId: "account-1"
    }),
    api.executePrivacyRequest({
      kind: "organization-deletion",
      actorPrincipalId: "principal-1",
      targetId: "org-1"
    })
  ];

  const exportExecution = executions.find(
    (execution) => execution.kind === "user-data-export"
  );
  const accountDeletion = executions.find(
    (execution) => execution.kind === "account-deletion"
  );
  const organizationDeletion = executions.find(
    (execution) => execution.kind === "organization-deletion"
  );

  assert(exportExecution?.status === "export-ready", "export must be ready");
  assert(
    exportExecution.artifact.excluded.includes("oauth-token-values") &&
      exportExecution.artifact.excluded.includes("database-urls"),
    "export must exclude secrets and database URLs"
  );
  assert(
    accountDeletion?.status === "deletion-complete",
    "account deletion must complete deterministically"
  );
  assert(
    accountDeletion.actions.includes("OAuth connections revoked"),
    "account deletion must revoke OAuth connections"
  );
  assert(
    organizationDeletion?.status === "deletion-scheduled",
    "organization deletion must schedule a deletion job"
  );
  assert(
    organizationDeletion.job.cleanupActions.includes("delete vault secrets") &&
      organizationDeletion.job.cleanupActions.includes(
        "schedule report and crawl artifact deletion"
      ),
    "organization deletion must clean vault secrets and artifacts"
  );

  const report = {
    schemaVersion: 1,
    generatedBy: "searchlint-privacy-request-execution",
    generatedAt: fixedGeneratedAt,
    status: "PASS",
    executions,
    checklistClosed: [
      "user-data-export",
      "account-deletion",
      "organization-deletion"
    ],
    liveGatesStillOpen: [
      "Live deployed privacy export execution.",
      "Live deployed account deletion execution.",
      "Live deployed organization deletion execution.",
      "Legal/security approval for privacy policy and data processing terms."
    ]
  };

  assertNoSensitiveValues(JSON.stringify(report));
  await mkdir(path.dirname(reportPath), { recursive: true });
  await mkdir(path.dirname(samplePath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(samplePath, `${JSON.stringify(report, null, 2)}\n`);
  run("pnpm", ["exec", "prettier", "--write", reportPath, samplePath]);

  console.log(
    `privacy request execution PASS: ${executions.length}/3 request types covered`
  );
  console.log(`Report: ${reportPath}`);
  console.log(`Sample: ${samplePath}`);
}

function assertNoSensitiveValues(text) {
  const forbidden = [
    /private_key/i,
    /client-secret/i,
    /authorization:/i,
    /bearer\s+/i,
    /sk_live/i,
    /whsec_/i,
    /postgres:\/\//i,
    /-----BEGIN PRIVATE KEY-----/i,
    /ya29\./i,
    /xox[baprs]-/i
  ];
  const match = forbidden.find((pattern) => pattern.test(text));
  if (match) {
    throw new Error(`Sensitive value leaked into privacy evidence: ${match}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
