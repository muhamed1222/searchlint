#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { format } from "prettier";

const packageStatusReportPath =
  "reports/release-owner-evidence-package-status-report.json";
const markdownPath = "docs/PUBLICATION_PACKAGE_GATE.md";
const reportPath = "reports/publication-package-gate-report.json";
const samplePath = "docs/examples/publication-package-gate-report.sample.json";
const generatedAt = "2026-06-23T00:00:00.000Z";
const packageId = "03-publication";
const requiredEvidencePaths = [
  "docs/package-metadata-approval.json",
  "docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-npm-pakety-opublikovany.json",
  "docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-vs-code-extension-opublikovan.json",
  "docs/release-owner-evidence/7-vs-code-i-lsp-nastroit-publisher-account.json",
  "docs/release-owner-evidence/7-vs-code-i-lsp-podpisat-i-opublikovat-extension.json",
  "docs/release-owner-evidence/8-npm-pakety-opublikovat-beta-packages.json",
  "docs/release-owner-evidence/8-npm-pakety-podgotovit-finalnuyu-publikaciyu-1-0-0.json",
  "docs/release-owner-evidence/8-npm-pakety-proverit-chistuyu-ustanovku-opublikovannyh-packages.json",
  "docs/release-owner-evidence/8-npm-pakety-zamenit-0-0-0-beta-versions-na-final-release-versions.json"
];

const commandResults = [
  runCommand("pnpm", ["release:publication-package:owner-guide"]),
  runCommand("pnpm", ["package:metadata-approval"]),
  runCommand("pnpm", ["package:beta-publication-gate"]),
  runCommand("pnpm", ["package:registry-install"]),
  runCommand("pnpm", ["vscode:update-e2e"]),
  runCommand("pnpm", ["final-release:gate"]),
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
const presentEvidencePaths = packageRecord.evidence
  .filter((record) => record.exists)
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
      requiredEvidencePaths.every((evidencePath) =>
        packageRecord.evidence.some((entry) => entry.path === evidencePath)
      ) && unexpectedEvidencePaths.length === 0,
    packageMetadataApprovalPresent: !missingEvidencePaths.includes(
      requiredEvidencePaths[0]
    ),
    finalNpmPublicationEvidencePresent: !missingEvidencePaths.includes(
      requiredEvidencePaths[1]
    ),
    finalVsCodePublicationEvidencePresent: !missingEvidencePaths.includes(
      requiredEvidencePaths[2]
    ),
    vsCodePublisherAccountEvidencePresent: !missingEvidencePaths.includes(
      requiredEvidencePaths[3]
    ),
    vsCodeMarketplacePublicationEvidencePresent: !missingEvidencePaths.includes(
      requiredEvidencePaths[4]
    ),
    npmBetaPublicationEvidencePresent: !missingEvidencePaths.includes(
      requiredEvidencePaths[5]
    ),
    npmFinalPreparationEvidencePresent: !missingEvidencePaths.includes(
      requiredEvidencePaths[6]
    ),
    npmPublishedCleanInstallEvidencePresent: !missingEvidencePaths.includes(
      requiredEvidencePaths[7]
    ),
    finalVersionEvidencePresent: !missingEvidencePaths.includes(
      requiredEvidencePaths[8]
    ),
    ownerGuidePassed: commandPassed(
      commandResults,
      "pnpm release:publication-package:owner-guide"
    ),
    packageMetadataApprovalPassed: commandPassed(
      commandResults,
      "pnpm package:metadata-approval"
    ),
    betaPublicationGatePassed: commandPassed(
      commandResults,
      "pnpm package:beta-publication-gate"
    ),
    registryInstallPassed: commandPassed(
      commandResults,
      "pnpm package:registry-install"
    ),
    vscodeUpdateE2ePassed: commandPassed(
      commandResults,
      "pnpm vscode:update-e2e"
    ),
    finalReleaseGatePassed: commandPassed(
      commandResults,
      "pnpm final-release:gate"
    ),
    packageStatusCommandPassed: commandPassed(
      commandResults,
      "pnpm release:owner-evidence-package-status"
    ),
    packageStatusComplete: packageRecord.status === "complete"
  },
  failedGates: []
};
releaseGate.failedGates = Object.entries(releaseGate.gates)
  .filter(([, passed]) => !passed)
  .map(([gate]) => gate);

const report = {
  schemaVersion: 1,
  generatedBy: "searchlint-publication-package-gate",
  generatedAt,
  status:
    releaseGate.passFail === "pass"
      ? "passed"
      : "blocked_missing_publication_evidence",
  packageId,
  packageTitle: packageRecord.title,
  sourceReport: packageStatusReportPath,
  requiredEvidencePaths,
  presentEvidencePaths,
  missingEvidencePaths,
  unexpectedEvidencePaths,
  commandResults,
  failedCommands: failedCommands.map(({ command, exitCode }) => ({
    command,
    exitCode
  })),
  releaseGate,
  nonClaims: [
    "This report does not publish npm packages.",
    "This report does not publish the VS Code extension.",
    "This report does not change package manifests, versions, or private flags.",
    "This report does not create npm, Marketplace, or GitHub owner evidence.",
    "This report does not create a v1.0.0 tag or close final release gates."
  ]
};

assertNoSensitiveValues(JSON.stringify(report));
await writeMarkdown(markdownPath, renderMarkdown(report));
await writeJson(reportPath, report);
await writeJson(samplePath, report);

if (releaseGate.passFail !== "pass") {
  console.error(`Publication package gate blocked: ${report.status}`);
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

console.log("Publication package gate passed.");
console.log(`Report: ${reportPath}`);
console.log(`Sample: ${samplePath}`);

function runCommand(command, args) {
  const label = [command, ...args].join(" ");
  try {
    const stdout = execFileSync(command, args, {
      cwd: process.cwd(),
      env: process.env,
      encoding: "utf8",
      maxBuffer: 20 * 1024 * 1024,
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
    "# Publication Package Gate",
    "",
    `Generated at: ${report.generatedAt}`,
    "",
    "This report tracks the `03-publication` owner evidence package. It does not publish npm packages or the VS Code extension.",
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
