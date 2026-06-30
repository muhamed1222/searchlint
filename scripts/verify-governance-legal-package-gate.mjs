#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { format } from "prettier";

const packageStatusReportPath =
  "reports/release-owner-evidence-package-status-report.json";
const markdownPath = "docs/GOVERNANCE_LEGAL_PACKAGE_GATE.md";
const reportPath = "reports/governance-legal-package-gate-report.json";
const samplePath =
  "docs/examples/governance-legal-package-gate-report.sample.json";
const generatedAt = "2026-06-23T00:00:00.000Z";
const packageId = "02-governance-legal";
const requiredEvidencePaths = [
  "docs/github/hosted-governance-evidence.json",
  "docs/legal-release-approval.json"
];

const commandResults = [
  runCommand("pnpm", ["governance:hosted-github-evidence:owner-guide"]),
  runCommand("pnpm", ["legal:release-gate:owner-guide"]),
  runCommand("pnpm", ["governance:hosted-github-evidence"]),
  runCommand("pnpm", ["governance:branch-protection"]),
  runCommand("pnpm", ["governance:required-ci-checks"]),
  runCommand("pnpm", ["legal:release-gate"]),
  runCommand("pnpm", ["release:owner-evidence-package-status"])
];

const packageStatusReport = await readJson(packageStatusReportPath);
const packageRecord = packageStatusReport.packageRecords.find(
  (record) => record.id === packageId
);
if (!packageRecord) {
  throw new Error(`Missing package record ${packageId}.`);
}

const missingEvidencePaths = packageRecord.evidence
  .filter((record) => !record.exists)
  .map((record) => record.path);
const unexpectedEvidencePaths = packageRecord.evidence
  .map((record) => record.path)
  .filter((evidencePath) => !requiredEvidencePaths.includes(evidencePath));
const failedCommands = commandResults.filter((result) => result.exitCode !== 0);
const releaseGate = {
  passFail:
    missingEvidencePaths.length === 0 &&
    unexpectedEvidencePaths.length === 0 &&
    packageRecord.status === "complete" &&
    commandResults.every((result) => result.exitCode === 0)
      ? "pass"
      : "blocked",
  gates: {
    packageRecordPresent: true,
    packageIdMatches: packageRecord.id === packageId,
    exactRequiredEvidencePaths:
      missingEvidencePaths.every((evidencePath) =>
        requiredEvidencePaths.includes(evidencePath)
      ) && unexpectedEvidencePaths.length === 0,
    hostedGithubEvidencePresent: !missingEvidencePaths.includes(
      requiredEvidencePaths[0]
    ),
    legalApprovalPresent: !missingEvidencePaths.includes(
      requiredEvidencePaths[1]
    ),
    hostedGithubOwnerGuidePassed: commandPassed(
      commandResults,
      "pnpm governance:hosted-github-evidence:owner-guide"
    ),
    legalOwnerGuidePassed: commandPassed(
      commandResults,
      "pnpm legal:release-gate:owner-guide"
    ),
    hostedGithubEvidencePassed: commandPassed(
      commandResults,
      "pnpm governance:hosted-github-evidence"
    ),
    branchProtectionPassed: commandPassed(
      commandResults,
      "pnpm governance:branch-protection"
    ),
    requiredCiChecksPassed: commandPassed(
      commandResults,
      "pnpm governance:required-ci-checks"
    ),
    legalReleaseGatePassed: commandPassed(
      commandResults,
      "pnpm legal:release-gate"
    ),
    packageStatusComplete: packageRecord.status === "complete",
    packageStatusCommandPassed: commandPassed(
      commandResults,
      "pnpm release:owner-evidence-package-status"
    )
  },
  failedGates: []
};
releaseGate.failedGates = Object.entries(releaseGate.gates)
  .filter(([, passed]) => !passed)
  .map(([gate]) => gate);

const report = {
  schemaVersion: 1,
  generatedBy: "searchlint-governance-legal-package-gate",
  generatedAt,
  status:
    releaseGate.passFail === "pass"
      ? "passed"
      : "blocked_missing_governance_legal_evidence",
  packageId,
  packageTitle: packageRecord.title,
  sourceReport: packageStatusReportPath,
  requiredEvidencePaths,
  missingEvidencePaths,
  unexpectedEvidencePaths,
  commandResults,
  failedCommands: failedCommands.map(({ command, exitCode }) => ({
    command,
    exitCode
  })),
  releaseGate,
  nonClaims: [
    "This report does not create hosted GitHub evidence.",
    "This report does not create legal approval.",
    "This report does not mutate GitHub settings.",
    "This report does not close governance, legal, package, or final release gates."
  ]
};

assertNoSensitiveValues(JSON.stringify(report));
await writeMarkdown(markdownPath, renderMarkdown(report));
await writeJson(reportPath, report);
await writeJson(samplePath, report);

if (releaseGate.passFail !== "pass") {
  console.error(`Governance/legal package gate blocked: ${report.status}`);
  for (const missingPath of missingEvidencePaths) {
    console.error(`- missing evidence: ${missingPath}`);
  }
  for (const result of failedCommands) {
    console.error(
      `- failed command: ${result.command} exit ${result.exitCode}`
    );
  }
  console.error(`Report: ${reportPath}`);
  process.exit(1);
}

console.log("Governance/legal package gate passed.");
console.log(`Report: ${reportPath}`);
console.log(`Sample: ${samplePath}`);

function runCommand(command, args) {
  const label = [command, ...args].join(" ");
  try {
    const stdout = execFileSync(command, args, {
      cwd: process.cwd(),
      env: process.env,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });
    return {
      command: label,
      exitCode: 0,
      status: "passed",
      outputSummary: summarizeOutput(stdout)
    };
  } catch (error) {
    return {
      command: label,
      exitCode: typeof error.status === "number" ? error.status : 1,
      status: "failed",
      outputSummary: summarizeOutput(
        [error.stdout, error.stderr].filter(Boolean).join("\n")
      )
    };
  }
}

function commandPassed(results, command) {
  return results.some(
    (result) => result.command === command && result.exitCode === 0
  );
}

function summarizeOutput(output) {
  return String(output)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-12);
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
    "# Governance Legal Package Gate",
    "",
    `Generated at: ${report.generatedAt}`,
    "",
    "This report tracks the `02-governance-legal` owner evidence package. It does not create or imply hosted GitHub evidence or legal approval.",
    "",
    "## Summary",
    "",
    `- status: \`${report.status}\``,
    `- release gate: \`${report.releaseGate.passFail}\``,
    `- missing evidence files: ${report.missingEvidencePaths.length}`,
    `- failed commands: ${report.failedCommands.length}`,
    "",
    "## Required Evidence",
    ""
  ];

  for (const evidencePath of report.requiredEvidencePaths) {
    const status = report.missingEvidencePaths.includes(evidencePath)
      ? "missing"
      : "present";
    lines.push(`- \`${evidencePath}\`: \`${status}\``);
  }

  lines.push("", "## Commands", "");
  for (const result of report.commandResults) {
    lines.push(
      `- \`${result.command}\`: \`${result.status}\` (exit ${result.exitCode})`
    );
  }

  lines.push("", "## Failed Gates", "");
  if (report.releaseGate.failedGates.length === 0) {
    lines.push("- none");
  } else {
    for (const gate of report.releaseGate.failedGates) {
      lines.push(`- \`${gate}\``);
    }
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
      `Generated report contains sensitive material: ${sensitive}`
    );
  }
}
