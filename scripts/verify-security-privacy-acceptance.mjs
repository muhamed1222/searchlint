#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const reportPath = "reports/security-privacy-acceptance-report.json";
const samplePath =
  "docs/examples/security-privacy-acceptance-report.sample.json";

const commands = [
  {
    name: "apiSecurityPrivacyTests",
    command: "pnpm",
    args: [
      "--filter",
      "@searchlint/api",
      "test",
      "--",
      "security-privacy-release.test.ts"
    ]
  },
  {
    name: "apiBuild",
    command: "pnpm",
    args: ["--filter", "@searchlint/api", "build"]
  }
];

const requiredDocs = [
  "docs/SECURITY_PRIVACY_RELEASE_GATE.md",
  "docs/DEPENDENCY_AUDIT_RELEASE_GATE.md",
  "docs/STATIC_SAST_RELEASE_GATE.md",
  "docs/PRIVACY_POLICY.md",
  "docs/TERMS_OF_SERVICE.md",
  "docs/DPA.md",
  "docs/VULNERABILITY_DISCLOSURE.md",
  "SECURITY.md"
];

async function main() {
  const commandResults = commands.map(runCommand);
  const api = await import(
    pathToFileURL(path.resolve("services/api/dist/src/index.js")).href
  );

  const controlCase = verifyControls(api);
  const privacyCase = verifyPrivacyPlans(api);
  const disclosureCase = verifyDisclosure(api);
  const docsCase = await verifyDocuments();
  const report = {
    generatedBy: "searchlint-security-privacy-acceptance-verifier",
    generatedAt: "2026-06-22T00:00:00.000Z",
    status: "deterministic-proof-passed-release-blocked",
    scope: {
      proofType: "deterministic security/privacy release-gate packet",
      doesNotClaim: [
        "DAST",
        "penetration test",
        "legal approval",
        "deployed production security review",
        "live privacy export/deletion execution"
      ]
    },
    commands: commandResults,
    cases: {
      controls: controlCase,
      privacyRequests: privacyCase,
      vulnerabilityDisclosure: disclosureCase,
      documents: docsCase
    },
    remainingReleaseGates: [
      "Run DAST against a deployed production-equivalent target.",
      "Obtain independent penetration test report and remediation sign-off.",
      "Complete legal/security review for policy documents and repository boundary.",
      "Complete deployed production security review across AWS, dashboard, API, workers, OAuth, billing, tenant isolation, logs, and telemetry."
    ]
  };

  assertNoSensitiveValues(JSON.stringify(report));
  await mkdir(path.dirname(reportPath), { recursive: true });
  await mkdir(path.dirname(samplePath), { recursive: true });
  await writeJson(reportPath, report);
  await writeJson(samplePath, report);

  console.log(
    `Security/privacy acceptance PASS: ${Object.keys(report.cases).length}/4 evidence groups passed; release gate remains blocked by ${controlCase.releaseBlockers.length} external gate(s)`
  );
  console.log(`Report: ${reportPath}`);
  console.log(`Sample: ${samplePath}`);
}

function verifyControls(api) {
  const report = api.createSecurityPrivacyGateReport();
  expectEqual(report.summary.controlCount, 23);
  expectEqual(report.summary.verifiedCount, 19);
  expectEqual(report.summary.blockedCount, 4);
  expectEqual(report.summary.releaseBlockerCount, 4);
  expectEqual(report.summary.status, "blocked");
  const releaseBlockers = report.controls
    .filter((control) => control.releaseBlocker)
    .map((control) => ({
      id: control.id,
      category: control.category,
      missing: control.missing
    }));
  return {
    summary: report.summary,
    verifiedControls: report.controls
      .filter((control) => control.status === "verified")
      .map((control) => ({
        id: control.id,
        category: control.category,
        evidence: control.evidence
      })),
    releaseBlockers
  };
}

function verifyPrivacyPlans(api) {
  const plans = [
    api.createPrivacyRequestPlan({
      kind: "user-data-export",
      actorPrincipalId: "principal-1",
      targetId: "account-1"
    }),
    api.createPrivacyRequestPlan({
      kind: "account-deletion",
      actorPrincipalId: "principal-1",
      targetId: "account-1"
    }),
    api.createPrivacyRequestPlan({
      kind: "organization-deletion",
      actorPrincipalId: "principal-1",
      targetId: "org-1"
    })
  ];

  for (const plan of plans) {
    expectEqual(plan.deadlineHours, 720);
    expectEqual(plan.retainedLegalRecords.includes("billing records"), true);
  }

  return plans.map((plan) => ({
    kind: plan.kind,
    requiredSteps: plan.requiredSteps,
    retainedLegalRecords: plan.retainedLegalRecords,
    deadlineHours: plan.deadlineHours
  }));
}

function verifyDisclosure(api) {
  const policy = api.createSecurityDisclosurePolicy();
  expectEqual(policy.publicIssuesAllowed, false);
  expectEqual(policy.legalReviewRequired, true);
  expectEqual(policy.sensitiveIssueTypes.includes("crawler SSRF"), true);
  return policy;
}

async function verifyDocuments() {
  const docs = [];
  for (const filePath of requiredDocs) {
    const text = await readFile(filePath, "utf8");
    if (!/legal review|required|Release Gate|draft|security/i.test(text)) {
      throw new Error(`${filePath} does not include release-gate language.`);
    }
    docs.push({
      path: filePath,
      bytes: Buffer.byteLength(text),
      status: "present"
    });
  }
  return docs;
}

function runCommand(command) {
  const result = spawnSync(command.command, command.args, {
    stdio: "pipe",
    encoding: "utf8"
  });
  if (result.status !== 0) {
    process.stderr.write(result.stdout);
    process.stderr.write(result.stderr);
    throw new Error(`${command.name} failed with exit code ${result.status}.`);
  }
  return {
    name: command.name,
    command: [command.command, ...command.args].join(" "),
    status: "passed"
  };
}

function assertNoSensitiveValues(text) {
  const forbidden = [
    /private_key/i,
    /client-secret/i,
    /authorization:/i,
    /bearer\s+/i,
    /sk_live/i,
    /whsec_/i,
    /postgres:\/\/user/i,
    /-----BEGIN PRIVATE KEY-----/i,
    /ya29\./i,
    /xox[baprs]-/i
  ];
  const match = forbidden.find((pattern) => pattern.test(text));
  if (match) {
    throw new Error(
      `Sensitive value leaked into security/privacy evidence: ${match}`
    );
  }
}

async function writeJson(filePath, data) {
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function expectEqual(actual, expected) {
  if (actual !== expected) {
    throw new Error(
      `Expected ${String(expected)}, received ${String(actual)}.`
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
