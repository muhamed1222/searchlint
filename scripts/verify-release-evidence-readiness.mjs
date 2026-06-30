#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { format, resolveConfig } from "prettier";

const reportPath = "reports/release-evidence-readiness-summary-report.json";
const samplePath =
  "docs/examples/release-evidence-readiness-summary-report.sample.json";
const markdownPath = "docs/RELEASE_EVIDENCE_READINESS_SUMMARY.md";
const generatedAt = "2026-06-23T00:00:00.000Z";

const pipeline = [
  {
    name: "owner-evidence-self-test",
    command: "pnpm",
    args: ["release:owner-evidence:self-test"],
    reportPath: "reports/release-owner-evidence-self-test-report.json"
  },
  {
    name: "owner-evidence",
    command: "pnpm",
    args: ["release:owner-evidence"],
    reportPath: "reports/release-owner-evidence-report.json"
  },
  {
    name: "owner-evidence-template-coverage",
    command: "pnpm",
    args: ["release:owner-evidence:template-coverage"],
    reportPath: "reports/release-owner-evidence-template-coverage-report.json"
  },
  {
    name: "missing-evidence-templates",
    command: "pnpm",
    args: ["release:missing-evidence-templates"],
    reportPath: "reports/release-missing-evidence-template-index-report.json"
  },
  {
    name: "owner-evidence-readiness",
    command: "pnpm",
    args: ["release:owner-evidence:readiness"],
    reportPath: "reports/release-owner-evidence-readiness-report.json"
  },
  {
    name: "evidence-intake",
    command: "pnpm",
    args: ["release:evidence-intake"],
    reportPath: "reports/release-evidence-intake-status-report.json"
  }
];

for (const step of pipeline) {
  run(step.command, step.args);
}

const reports = Object.fromEntries(
  await Promise.all(
    pipeline.map(async (step) => [
      step.name,
      JSON.parse(await readFile(step.reportPath, "utf8"))
    ])
  )
);
const summary = buildSummary(reports);
const aggregateReport = {
  schemaVersion: 1,
  generatedBy: "searchlint-release-evidence-readiness-aggregate-verifier",
  generatedAt,
  status:
    summary.realOwnerEvidenceCount === 0 ||
    summary.missingEvidencePathCount > 0 ||
    summary.blockedOrFailingReportCount > 0
      ? "blocked_external_evidence"
      : "evidence_ready_for_final_owner_review",
  pipeline: pipeline.map((step) => ({
    name: step.name,
    command: `${step.command} ${step.args.join(" ")}`,
    reportPath: step.reportPath,
    status: reports[step.name].status
  })),
  summary,
  nonClaims: [
    "This aggregate report does not close release gates.",
    "This aggregate report does not replace real owner, reviewer, legal, security, provider, deployment, publication, backup, or final release evidence.",
    "SearchLint 1.0 remains blocked while external evidence is missing or supporting reports are blocked."
  ]
};

assertAggregateReadiness(aggregateReport);
assertNoSensitiveValues(JSON.stringify(aggregateReport));
await writeJson(reportPath, aggregateReport);
await writeJson(samplePath, aggregateReport);
await writeMarkdown(markdownPath, renderMarkdown(aggregateReport));

console.log(
  `Release evidence readiness summary generated: ${summary.checkedItemCount}/${summary.totalItemCount} done, ${summary.openGateCount} remaining`
);
console.log(`Status: ${aggregateReport.status}`);
console.log(`Document: ${markdownPath}`);
console.log(`Report: ${reportPath}`);
console.log(`Sample: ${samplePath}`);

function run(command, args) {
  execFileSync(command, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit"
  });
}

function buildSummary(reports) {
  const intake = reports["evidence-intake"];
  const readiness = reports["owner-evidence-readiness"];
  const ownerEvidence = reports["owner-evidence"];
  const selfTest = reports["owner-evidence-self-test"];
  const templateCoverage = reports["owner-evidence-template-coverage"];
  const missingTemplates = reports["missing-evidence-templates"];

  return {
    checkedItemCount: intake.summary.checkedItemCount,
    openGateCount: intake.summary.openGateCount,
    totalItemCount: intake.summary.totalItemCount,
    ownerEvidenceSelfTestCases: selfTest.caseCount,
    ownerEvidenceSelfTestPassedCases: selfTest.passedCaseCount,
    expectedOwnerEvidenceCount: ownerEvidence.expectedEvidenceCount,
    realOwnerEvidenceCount: ownerEvidence.presentEvidenceCount,
    missingOwnerEvidenceCount: ownerEvidence.missingEvidenceCount,
    ownerEvidenceFailureCount: ownerEvidence.failureCount,
    templateCoverageStatus: templateCoverage.status,
    templateCoveredOwnerInputCount:
      readiness.summary.templateCoveredOwnerInputCount,
    missingOwnerInputCount: missingTemplates.missingOwnerInputCount,
    missingOwnerInputWithTemplatesCount:
      missingTemplates.entriesWithTemplatesCount,
    missingOwnerInputWithoutTemplatesCount:
      missingTemplates.entriesWithoutTemplatesCount,
    missingEvidencePathCount: intake.summary.missingEvidencePathCount,
    blockedOrFailingReportCount: intake.summary.blockedOrFailingReportCount,
    externalOwnerProofRequiredGateCount:
      intake.summary.externalOwnerProofRequiredGateCount,
    gatesMissingExternalOwnerProofCount:
      intake.summary.gatesMissingExternalOwnerProofCount,
    intakeStatus: intake.status,
    ownerEvidenceReadinessStatus: readiness.status,
    releaseGateClaim: intake.summary.releaseGateClaim
  };
}

function assertAggregateReadiness(report) {
  const { summary } = report;
  if (summary.openGateCount !== 83) {
    throw new Error(`Expected 83 open gates, found ${summary.openGateCount}.`);
  }
  if (summary.expectedOwnerEvidenceCount !== 52) {
    throw new Error(
      `Expected 52 owner evidence files, found ${summary.expectedOwnerEvidenceCount}.`
    );
  }
  if (summary.templateCoveredOwnerInputCount !== 52) {
    throw new Error(
      `Expected 52 template-covered owner inputs, found ${summary.templateCoveredOwnerInputCount}.`
    );
  }
  if (summary.missingOwnerInputCount !== 63) {
    throw new Error(
      `Expected 63 missing owner input files, found ${summary.missingOwnerInputCount}.`
    );
  }
  if (summary.missingOwnerInputWithoutTemplatesCount !== 0) {
    throw new Error("All missing owner inputs must have templates.");
  }
  if (summary.releaseGateClaim !== "not_claimed") {
    throw new Error("Evidence readiness must not claim final release gates.");
  }
}

function renderMarkdown(report) {
  const lines = [
    "# Release Evidence Readiness Summary",
    "",
    `Generated at: ${report.generatedAt}`,
    "",
    "This aggregate status runs the release evidence readiness pipeline. It is not release approval.",
    "",
    "## Summary",
    "",
    `- Status: \`${report.status}\``,
    `- Checklist: ${report.summary.checkedItemCount}/${report.summary.totalItemCount} done; ${report.summary.openGateCount} remaining`,
    `- Owner evidence files: ${report.summary.realOwnerEvidenceCount}/${report.summary.expectedOwnerEvidenceCount} present`,
    `- Missing owner input files: ${report.summary.missingOwnerInputCount}`,
    `- Missing owner input files with templates: ${report.summary.missingOwnerInputWithTemplatesCount}`,
    `- Missing owner input files without templates: ${report.summary.missingOwnerInputWithoutTemplatesCount}`,
    `- Template-covered owner inputs: ${report.summary.templateCoveredOwnerInputCount}`,
    `- Evidence paths missing: ${report.summary.missingEvidencePathCount}`,
    `- Blocked/failing supporting reports: ${report.summary.blockedOrFailingReportCount}`,
    `- Gates missing external owner proof: ${report.summary.gatesMissingExternalOwnerProofCount}`,
    `- Release gate claim: \`${report.summary.releaseGateClaim}\``,
    "",
    "## Pipeline",
    "",
    "| Step | Command | Report | Status |",
    "| --- | --- | --- | --- |"
  ];

  for (const step of report.pipeline) {
    lines.push(
      `| ${step.name} | \`${step.command}\` | \`${step.reportPath}\` | \`${step.status}\` |`
    );
  }

  lines.push("", "## Non-Claims", "");
  for (const nonClaim of report.nonClaims) {
    lines.push(`- ${nonClaim}`);
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(
    filePath,
    await format(`${JSON.stringify(value, null, 2)}\n`, {
      ...(await prettierOptions(filePath)),
      parser: "json"
    })
  );
}

async function writeMarkdown(filePath, markdown) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(
    filePath,
    await format(markdown, {
      ...(await prettierOptions(filePath)),
      parser: "markdown"
    })
  );
}

async function prettierOptions(filePath) {
  return (await resolveConfig(filePath)) ?? {};
}

function assertNoSensitiveValues(text) {
  const forbidden = [
    /private_key/i,
    /client-secret/i,
    /authorization:/i,
    /bearer\s+/i,
    /cookie:/i,
    /set-cookie:/i,
    /sk_live/i,
    /whsec_/i,
    /postgres:\/\//i,
    /-----BEGIN PRIVATE KEY-----/i,
    /ya29\./i,
    /xox[baprs]-/i
  ];
  const match = forbidden.find((pattern) => pattern.test(text));
  if (match) {
    throw new Error(
      `Sensitive value leaked into evidence readiness summary: ${match}`
    );
  }
}
