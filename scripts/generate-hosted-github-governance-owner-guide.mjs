#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { format } from "prettier";

const evidencePath = "docs/github/hosted-governance-evidence.json";
const templatePath = "docs/github/hosted-governance-evidence.example.json";
const runbookReportPath =
  "reports/hosted-github-governance-evidence-runbook-report.json";
const selfTestReportPath =
  "reports/hosted-github-governance-evidence-self-test-report.json";
const packageStatusReportPath =
  "reports/release-owner-evidence-package-status-report.json";
const markdownPath = "docs/GITHUB_GOVERNANCE_OWNER_INPUT_GUIDE.md";
const reportPath = "reports/hosted-github-governance-owner-guide-report.json";
const samplePath =
  "docs/examples/hosted-github-governance-owner-guide-report.sample.json";
const generatedAt = "2026-06-23T00:00:00.000Z";

await ensureReport(runbookReportPath, "pnpm", [
  "governance:hosted-github-evidence:runbook"
]);
await ensureReport(selfTestReportPath, "pnpm", [
  "governance:hosted-github-evidence:self-test"
]);
await ensureReport(packageStatusReportPath, "pnpm", [
  "release:owner-evidence-package-status"
]);

const template = await readJson(templatePath);
const runbook = await readJson(runbookReportPath);
const selfTest = await readJson(selfTestReportPath);
const packageStatus = await readJson(packageStatusReportPath);
const governancePackage = packageStatus.packageRecords.find(
  (record) => record.id === "02-governance-legal"
);

if (!governancePackage) {
  throw new Error("Missing 02-governance-legal package status record.");
}

const evidenceExists = existsSync(evidencePath);
const report = {
  schemaVersion: 1,
  generatedBy: "searchlint-hosted-github-governance-owner-guide",
  generatedAt,
  status: evidenceExists ? "owner_input_present" : "owner_input_required",
  evidencePath,
  templatePath,
  currentPackageStatus: {
    id: governancePackage.id,
    title: governancePackage.title,
    status: governancePackage.status,
    missingInputCount: governancePackage.missingInputCount,
    presentInputCount: governancePackage.presentInputCount,
    githubEvidenceStatus:
      governancePackage.evidence.find((entry) => entry.path === evidencePath)
        ?.intakeStatus ?? "unknown"
  },
  repositoryDetection: runbook.repository,
  requiredChecks: runbook.requiredChecks,
  collectionCommands: runbook.commands,
  validationCommands: runbook.validationCommands,
  templateFields: Object.keys(template),
  selfTest: {
    status: selfTest.status,
    caseCount: selfTest.caseCount,
    passedCaseCount: selfTest.passedCaseCount,
    failedCaseCount: selfTest.failedCaseCount
  },
  ownerProcedure: [
    "Configure a real GitHub origin for the SearchLint public repository.",
    "Configure main branch protection and required status checks in hosted GitHub.",
    "Run the listed non-mutating collection commands with gh.",
    `Create ${evidencePath} from ${templatePath} using only sanitized real GitHub metadata.`,
    "Replace every REPLACE_WITH placeholder before validation.",
    "Do not paste GitHub tokens, Authorization headers, cookies, private keys, database URLs, or screenshots into the evidence file.",
    "Run the validation commands and keep the JSON report outputs as release evidence."
  ],
  forbiddenEvidence: [
    "screenshots without machine-readable JSON",
    "copied .example.json placeholders",
    "GitHub tokens or Authorization headers",
    "private keys, cookies, database URLs, or other secrets",
    "branch protection with force pushes enabled",
    "branch protection without required reviews",
    "CI evidence without the full required check list",
    "failed or cancelled CI runs"
  ],
  nonClaims: [
    "This guide does not create hosted GitHub evidence.",
    "This guide does not mutate GitHub settings.",
    "This guide does not close protected-branch or required-CI gates.",
    "Real hosted GitHub evidence remains owner-provided external proof."
  ]
};

assertNoSensitiveValues(JSON.stringify(report));
await writeMarkdown(markdownPath, renderMarkdown(report));
await writeJson(reportPath, report);
await writeJson(samplePath, report);

console.log(
  `Hosted GitHub governance owner guide generated: ${report.status}, ${report.requiredChecks.length} required check(s)`
);
console.log(`Document: ${markdownPath}`);
console.log(`Report: ${reportPath}`);
console.log(`Sample: ${samplePath}`);

async function ensureReport(filePath, command, args) {
  try {
    await access(filePath);
  } catch {
    execFileSync(command, args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: "inherit"
    });
    await access(filePath);
  }
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function writeMarkdown(filePath, markdown) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, await format(markdown, { parser: "markdown" }));
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(
    filePath,
    await format(JSON.stringify(value), { parser: "json" })
  );
}

function renderMarkdown(report) {
  const lines = [
    "# GitHub Governance Owner Input Guide",
    "",
    `Generated at: ${report.generatedAt}`,
    "",
    "This guide covers hosted GitHub evidence for protected branch and required CI gates. It is not release approval.",
    "",
    "## Current Status",
    "",
    `- status: \`${report.status}\``,
    `- evidence file: \`${report.evidencePath}\``,
    `- template: \`${report.templatePath}\``,
    `- governance package: \`${report.currentPackageStatus.status}\``,
    `- GitHub evidence intake: \`${report.currentPackageStatus.githubEvidenceStatus}\``,
    `- self-test: \`${report.selfTest.status}\` (${report.selfTest.passedCaseCount}/${report.selfTest.caseCount})`,
    "",
    "## Required Status Checks",
    ""
  ];

  for (const check of report.requiredChecks) {
    lines.push(`- \`${check}\``);
  }

  lines.push("", "## Collection Commands", "", "```bash");
  lines.push(report.collectionCommands.inspectOrigin);
  lines.push(report.collectionCommands.inspectProtection);
  lines.push(report.collectionCommands.inspectLatestCiRun);
  lines.push("```");

  lines.push("", "## Validation Commands", "", "```bash");
  for (const command of report.validationCommands) {
    lines.push(command);
  }
  lines.push("```");

  lines.push("", "## Owner Procedure", "");
  for (const step of report.ownerProcedure) {
    lines.push(`- ${step}`);
  }

  lines.push("", "## Forbidden Evidence", "");
  for (const item of report.forbiddenEvidence) {
    lines.push(`- ${item}`);
  }

  lines.push("", "## Required JSON Fields", "");
  for (const field of report.templateFields) {
    lines.push(`- \`${field}\``);
  }

  lines.push("", "## Non-Claims", "");
  for (const nonClaim of report.nonClaims) {
    lines.push(`- ${nonClaim}`);
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function sensitivePatternMatch(serialized) {
  const patterns = [
    /ghp_[A-Za-z0-9_]{20,}/u,
    /github_pat_[A-Za-z0-9_]{20,}/u,
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/u,
    /AKIA[0-9A-Z]{16}/u,
    /xox[baprs]-[A-Za-z0-9-]{10,}/u,
    /postgres(?:ql)?:\/\/[^"'\s]+:[^"'\s]+@/iu,
    /mongodb(?:\+srv)?:\/\/[^"'\s]+:[^"'\s]+@/iu
  ];
  return patterns.find((pattern) => pattern.test(serialized))?.source ?? null;
}

function assertNoSensitiveValues(serialized) {
  const sensitive = sensitivePatternMatch(serialized);
  if (sensitive) {
    throw new Error(
      `Generated guide contains sensitive material: ${sensitive}`
    );
  }
}
