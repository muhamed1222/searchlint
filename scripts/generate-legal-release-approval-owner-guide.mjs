#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { format } from "prettier";

const approvalPath = "docs/legal-release-approval.json";
const templatePath = "docs/legal-release-approval.example.json";
const packageStatusReportPath =
  "reports/release-owner-evidence-package-status-report.json";
const markdownPath = "docs/LEGAL_RELEASE_APPROVAL_OWNER_INPUT_GUIDE.md";
const reportPath = "reports/legal-release-approval-owner-guide-report.json";
const samplePath =
  "docs/examples/legal-release-approval-owner-guide-report.sample.json";
const generatedAt = "2026-06-23T00:00:00.000Z";

await ensureReport(packageStatusReportPath, "pnpm", [
  "release:owner-evidence-package-status"
]);

const template = await readJson(templatePath);
const packageStatus = await readJson(packageStatusReportPath);
const governancePackage = packageStatus.packageRecords.find(
  (record) => record.id === "02-governance-legal"
);

if (!governancePackage) {
  throw new Error("Missing 02-governance-legal package status record.");
}

const approvalExists = existsSync(approvalPath);
const legalEvidence = governancePackage.evidence.find(
  (entry) => entry.path === approvalPath
);
const report = {
  schemaVersion: 1,
  generatedBy: "searchlint-legal-release-approval-owner-guide",
  generatedAt,
  status: approvalExists ? "owner_input_present" : "owner_input_required",
  approvalPath,
  templatePath,
  currentPackageStatus: {
    id: governancePackage.id,
    title: governancePackage.title,
    status: governancePackage.status,
    missingInputCount: governancePackage.missingInputCount,
    presentInputCount: governancePackage.presentInputCount,
    legalApprovalStatus: legalEvidence?.intakeStatus ?? "unknown"
  },
  requiredFiles: template.approvedFiles,
  requiredScopes: template.approvedScopes,
  requiredAnswerKeys: Object.keys(template.requiredAnswers),
  requiredApprovalFields: [
    "schemaVersion",
    "approvedBy",
    "reviewerRole",
    "reviewedAt",
    "approvalId",
    "approvedScopes",
    "approvedFiles",
    "requiredAnswers",
    "requiredChanges",
    "signedStatement"
  ],
  validationCommands: [
    "pnpm legal:release-gate",
    "pnpm release:owner-evidence-package-status",
    "pnpm release:evidence-readiness",
    "pnpm final-release:gate"
  ],
  ownerProcedure: [
    "Send the listed legal materials and scope list to a qualified legal reviewer or owner counsel.",
    `Create ${approvalPath} from ${templatePath} only after qualified legal review is complete.`,
    "Replace every example value with real reviewer, role, timestamp, approval ID, and approval statement.",
    "Include every required file and scope in the approved lists.",
    "Answer every required legal question with yes only if it was actually approved.",
    "Leave requiredChanges empty only after all legal changes are resolved.",
    "Run pnpm legal:release-gate and the aggregate release evidence checks."
  ],
  forbiddenEvidence: [
    "copied example approval values",
    "template or placeholder reviewer names",
    "approval with unresolved requiredChanges",
    "partial file approval",
    "partial scope approval",
    "answers other than yes for required legal questions",
    "screenshots or chat notes without machine-readable JSON",
    "legal approval containing secrets, tokens, private keys, or credentials"
  ],
  nonClaims: [
    "This guide does not provide legal advice.",
    "This guide does not create legal approval.",
    "This guide does not close package, VS Code, public repository, or final release gates.",
    "Real legal approval remains owner-provided external proof."
  ]
};

assertNoSensitiveValues(JSON.stringify(report));
await writeMarkdown(markdownPath, renderMarkdown(report));
await writeJson(reportPath, report);
await writeJson(samplePath, report);

console.log(
  `Legal release approval owner guide generated: ${report.status}, ${report.requiredFiles.length} file(s), ${report.requiredScopes.length} scope(s)`
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
    "# Legal Release Approval Owner Input Guide",
    "",
    `Generated at: ${report.generatedAt}`,
    "",
    "This guide covers the owner-provided legal release approval evidence. It is not legal advice and is not release approval.",
    "",
    "## Current Status",
    "",
    `- status: \`${report.status}\``,
    `- approval file: \`${report.approvalPath}\``,
    `- template: \`${report.templatePath}\``,
    `- governance package: \`${report.currentPackageStatus.status}\``,
    `- legal approval intake: \`${report.currentPackageStatus.legalApprovalStatus}\``,
    "",
    "## Required Approved Files",
    ""
  ];

  for (const filePath of report.requiredFiles) {
    lines.push(`- \`${filePath}\``);
  }

  lines.push("", "## Required Approved Scopes", "");
  for (const scope of report.requiredScopes) {
    lines.push(`- ${scope}`);
  }

  lines.push("", "## Required Legal Answers", "");
  for (const key of report.requiredAnswerKeys) {
    lines.push(`- \`${key}\`: must be ` + "`yes`");
  }

  lines.push("", "## Required JSON Fields", "");
  for (const field of report.requiredApprovalFields) {
    lines.push(`- \`${field}\``);
  }

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
