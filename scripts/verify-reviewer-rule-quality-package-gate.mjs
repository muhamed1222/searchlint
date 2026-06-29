#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { format } from "prettier";

const packageStatusReportPath =
  "reports/release-owner-evidence-package-status-report.json";
const reportPath = "reports/reviewer-rule-quality-package-gate-report.json";
const samplePath =
  "docs/examples/reviewer-rule-quality-package-gate-report.sample.json";
const markdownPath = "docs/REVIEWER_RULE_QUALITY_PACKAGE_GATE.md";
const generatedAt = "2026-06-23T00:00:00.000Z";
const packageId = "01-reviewer-rule-quality";
const requiredEvidencePaths = [
  "docs/reviews/blocker-benchmark/DELIVERY_EVIDENCE.json",
  "docs/reviews/blocker-benchmark/reviewer-1.review.json",
  "docs/reviews/blocker-benchmark/reviewer-2.review.json"
];
const exampleOnlyPaths = [
  "docs/reviews/blocker-benchmark/DELIVERY_EVIDENCE.example.json",
  "docs/reviews/blocker-benchmark/reviewer-1.review.example.json",
  "docs/reviews/blocker-benchmark/reviewer-2.review.example.json"
];

const packageStatusCommand = runCommand("pnpm", [
  "release:owner-evidence-package-status"
]);
const packageStatusReport = await readJson(packageStatusReportPath);
const packageRecord = packageStatusReport.packageRecords.find(
  (record) => record.id === packageId
);
if (!packageRecord) {
  throw new Error(`Missing package record ${packageId}.`);
}

const commandResults = [
  packageStatusCommand,
  runCommand("pnpm", ["rule-qa"]),
  runCommand("pnpm", ["rule-qa:review-delivery"]),
  runCommand("pnpm", ["rule-qa:review"])
];

const missingEvidencePaths = packageRecord.evidence
  .filter((record) => !record.exists)
  .map((record) => record.path);
const unexpectedEvidencePaths = packageRecord.evidence
  .map((record) => record.path)
  .filter((evidencePath) => !requiredEvidencePaths.includes(evidencePath));
const presentRequiredEvidencePaths = packageRecord.evidence
  .filter((record) => record.exists)
  .map((record) => record.path);
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
    deliveryEvidencePresent: !missingEvidencePaths.includes(
      requiredEvidencePaths[0]
    ),
    reviewerOneEvidencePresent: !missingEvidencePaths.includes(
      requiredEvidencePaths[1]
    ),
    reviewerTwoEvidencePresent: !missingEvidencePaths.includes(
      requiredEvidencePaths[2]
    ),
    noExampleFilesCountAsEvidence: exampleOnlyPaths.every(
      (examplePath) => !presentRequiredEvidencePaths.includes(examplePath)
    ),
    packageComplete: packageRecord.status === "complete",
    packageStatusCommandPassed: packageStatusCommand.exitCode === 0,
    ruleQaPassed: commandPassed(commandResults, "pnpm rule-qa"),
    reviewDeliveryCommandPassed: commandPassed(
      commandResults,
      "pnpm rule-qa:review-delivery"
    ),
    reviewAdjudicationCommandPassed: commandPassed(
      commandResults,
      "pnpm rule-qa:review"
    )
  },
  failedGates: []
};
releaseGate.failedGates = Object.entries(releaseGate.gates)
  .filter(([, passed]) => !passed)
  .map(([gate]) => gate);

const report = {
  schemaVersion: 1,
  generatedBy: "searchlint-reviewer-rule-quality-package-gate",
  generatedAt,
  status:
    releaseGate.passFail === "pass"
      ? "passed"
      : "blocked_missing_reviewer_evidence",
  packageId,
  packageTitle: packageRecord.title,
  sourceReport: packageStatusReportPath,
  requiredEvidencePaths,
  exampleOnlyPaths,
  presentRequiredEvidencePaths,
  missingEvidencePaths,
  unexpectedEvidencePaths,
  commandResults,
  failedCommands: failedCommands.map(({ command, exitCode }) => ({
    command,
    exitCode
  })),
  releaseGate,
  nonClaims: [
    "This report does not create reviewer sign-off.",
    "Example JSON files are templates only and are not accepted as release evidence.",
    "Codex is not an independent reviewer for OD-023.",
    "The package remains blocked until two real independent reviewer files and delivery evidence exist."
  ]
};

assertNoSensitiveValues(JSON.stringify(report));
await writeMarkdown(markdownPath, renderMarkdown(report));
await writeJson(reportPath, report);
await writeJson(samplePath, report);

if (releaseGate.passFail !== "pass") {
  console.error(`Reviewer/rule-quality package gate blocked: ${report.status}`);
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

console.log("Reviewer/rule-quality package gate passed.");
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
    "# Reviewer Rule Quality Package Gate",
    "",
    `Generated at: ${report.generatedAt}`,
    "",
    "This report tracks the first critical-path owner evidence package:",
    "`01-reviewer-rule-quality`. It does not create or imply reviewer sign-off.",
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
