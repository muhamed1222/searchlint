#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { format } from "prettier";

const packageStatusReportPath =
  "reports/release-owner-evidence-package-status-report.json";
const markdownPath = "docs/PRODUCTION_PLATFORM_PACKAGE_GATE.md";
const reportPath = "reports/production-platform-package-gate-report.json";
const samplePath =
  "docs/examples/production-platform-package-gate-report.sample.json";
const generatedAt = "2026-06-23T00:00:00.000Z";
const packageId = "04-production-platform";
const expectedMissingInputCount = 21;

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

const relatedCommands = packageRecord.relatedCommands;
const commandResults = [
  packageStatusCommand,
  ...relatedCommands.map((command) => runPackageCommand(command))
];

const requiredEvidencePaths = packageRecord.evidence.map(
  (record) => record.path
);
const missingEvidencePaths = packageRecord.evidence
  .filter((record) => !record.exists)
  .map((record) => record.path);
const presentEvidencePaths = packageRecord.evidence
  .filter((record) => record.exists)
  .map((record) => record.path);
const failedCommands = commandResults.filter((result) => result.exitCode !== 0);
const commandGateEntries = Object.fromEntries(
  commandResults.map((result) => [
    commandGateName(result.command),
    result.exitCode === 0
  ])
);

const releaseGate = {
  passFail:
    missingEvidencePaths.length === 0 &&
    packageRecord.status === "complete" &&
    commandResults.every((result) => result.exitCode === 0)
      ? "pass"
      : "blocked",
  gates: {
    packageRecordPresent: true,
    packageIdMatches: packageRecord.id === packageId,
    expectedEvidenceCount:
      packageRecord.evidence.length === expectedMissingInputCount,
    allEvidencePresent: missingEvidencePaths.length === 0,
    noUnexpectedPresentEvidence: presentEvidencePaths.every((evidencePath) =>
      requiredEvidencePaths.includes(evidencePath)
    ),
    packageStatusComplete: packageRecord.status === "complete",
    ...commandGateEntries
  },
  failedGates: []
};
releaseGate.failedGates = Object.entries(releaseGate.gates)
  .filter(([, passed]) => !passed)
  .map(([gate]) => gate);

const report = {
  schemaVersion: 1,
  generatedBy: "searchlint-production-platform-package-gate",
  generatedAt,
  status:
    releaseGate.passFail === "pass"
      ? "passed"
      : "blocked_missing_production_platform_evidence",
  packageId,
  packageTitle: packageRecord.title,
  sourceReport: packageStatusReportPath,
  requiredEvidencePaths,
  presentEvidencePaths,
  missingEvidencePaths,
  commandResults,
  failedCommands: failedCommands.map(({ command, exitCode }) => ({
    command,
    exitCode
  })),
  releaseGate,
  nonClaims: [
    "This report does not deploy production infrastructure.",
    "This report does not create RDS, S3, SQS, Cognito, KMS, or dashboard resources.",
    "This report does not perform a live crawler run or backup/restore drill.",
    "This report does not create owner evidence.",
    "This report does not close production platform or final release gates."
  ]
};

assertNoSensitiveValues(JSON.stringify(report));
await writeMarkdown(markdownPath, renderMarkdown(report));
await writeJson(reportPath, report);
await writeJson(samplePath, report);

if (releaseGate.passFail !== "pass") {
  console.error(`Production platform package gate blocked: ${report.status}`);
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

console.log("Production platform package gate passed.");
console.log(`Report: ${reportPath}`);
console.log(`Sample: ${samplePath}`);

function runPackageCommand(command) {
  const [binary, ...args] = command.split(" ");
  return runCommand(binary, args);
}

function runCommand(command, args) {
  const label = [command, ...args].join(" ");
  try {
    const stdout = execFileSync(command, args, {
      cwd: process.cwd(),
      env: process.env,
      encoding: "utf8",
      maxBuffer: 20 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 120_000
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
      status: error.signal === "SIGTERM" ? "timed_out" : "failed",
      outputSummary: summarizeOutput(
        [error.stdout, error.stderr].filter(Boolean).join("\n")
      )
    };
  }
}

function commandGateName(command) {
  return `${command
    .replace(/^pnpm\s+/u, "")
    .replace(/[^a-z0-9]+/giu, "_")
    .replace(/^_+|_+$/gu, "")}Passed`;
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
    "# Production Platform Package Gate",
    "",
    `Generated at: ${report.generatedAt}`,
    "",
    "This report tracks the `04-production-platform` owner evidence package. It does not deploy production infrastructure.",
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
    /npm_[A-Za-z0-9]{20,}/u,
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/u,
    /AKIA[0-9A-Z]{16}/u,
    /xox[baprs]-[A-Za-z0-9-]{10,}/u,
    /postgres(?:ql)?:\/\/[^"'\s]+:[^"'\s]+@/iu,
    /mongodb(?:\+srv)?:\/\/[^"'\s]+:[^"'\s]+@/iu,
    /https?:\/\/[^"'\s]+:[^"'\s]+@/iu,
    /Authorization:\s*Bearer\s+[A-Za-z0-9._-]+/iu
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
