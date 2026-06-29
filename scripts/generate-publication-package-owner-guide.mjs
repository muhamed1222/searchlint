#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { format } from "prettier";

const packageStatusReportPath =
  "reports/release-owner-evidence-package-status-report.json";
const markdownPath = "docs/PUBLICATION_PACKAGE_OWNER_INPUT_GUIDE.md";
const reportPath = "reports/publication-package-owner-guide-report.json";
const samplePath =
  "docs/examples/publication-package-owner-guide-report.sample.json";
const generatedAt = "2026-06-23T00:00:00.000Z";

const evidenceGroups = [
  {
    id: "package-metadata",
    title: "Public Package Metadata",
    match: (evidencePath) =>
      evidencePath === "docs/package-metadata-approval.json",
    ownerAction:
      "Provide owner-approved public repository, homepage, issue routing, and package-directory metadata before public manifests are changed."
  },
  {
    id: "npm-publication",
    title: "npm Beta And Final Publication",
    match: (evidencePath) =>
      evidencePath.includes("npm-pakety") ||
      evidencePath.includes("8-npm-pakety"),
    ownerAction:
      "Provide sanitized npm beta/final publication evidence, version evidence, and clean-install evidence from an npm-like registry or the real npm registry."
  },
  {
    id: "vscode-publication",
    title: "VS Code Publisher And Marketplace Publication",
    match: (evidencePath) =>
      evidencePath.includes("vs-code") || evidencePath.includes("vscode"),
    ownerAction:
      "Provide sanitized publisher-account and Marketplace publication evidence for the SearchLint VS Code extension."
  }
];

const packageStatus = await readJson(packageStatusReportPath);
const publicationPackage = packageStatus.packageRecords.find(
  (record) => record.id === "03-publication"
);

if (!publicationPackage) {
  throw new Error("Missing 03-publication package status record.");
}

const evidence = publicationPackage.evidence.map((entry) => ({
  path: entry.path,
  exists: entry.exists,
  intakeStatus: entry.intakeStatus,
  templateCount: entry.templateCount,
  relatedCommands: entry.relatedCommands,
  groupId: classifyEvidence(entry.path).id
}));

const report = {
  schemaVersion: 1,
  generatedBy: "searchlint-publication-package-owner-guide",
  generatedAt,
  status:
    publicationPackage.missingInputCount === 0
      ? "owner_input_present"
      : "owner_input_required",
  package: {
    id: publicationPackage.id,
    title: publicationPackage.title,
    status: publicationPackage.status,
    missingInputCount: publicationPackage.missingInputCount,
    presentInputCount: publicationPackage.presentInputCount,
    blockedOrFailingEvidenceCount:
      publicationPackage.blockedOrFailingEvidenceCount,
    templateCoveredInputCount: publicationPackage.templateCoveredInputCount
  },
  requiredEvidence: evidence,
  evidenceGroups: evidenceGroups.map((group) => ({
    id: group.id,
    title: group.title,
    ownerAction: group.ownerAction,
    evidencePaths: evidence
      .filter((entry) => entry.groupId === group.id)
      .map((entry) => entry.path)
  })),
  validationCommands: unique([
    ...publicationPackage.relatedCommands,
    "pnpm package:metadata-approval",
    "pnpm package:beta-publication-gate",
    "pnpm package:registry-install",
    "pnpm vscode:update-e2e",
    "pnpm final-release:gate",
    "pnpm release:owner-evidence-package-status"
  ]),
  ownerProcedure: [
    "Collect real owner-controlled publication evidence only after the package metadata, npm publishing, and VS Code Marketplace actions have actually happened.",
    "Create each required JSON file from its matching template or gate instructions, replacing every example value with real sanitized evidence.",
    "Keep npm tokens, VS Code PATs, private registry credentials, cookies, private keys, database URLs, and Authorization headers out of committed evidence.",
    "Run the package metadata, npm, VS Code, final-release, and owner package status commands after the files are populated.",
    "Do not reuse beta evidence as final 1.0 publication evidence unless the specific gate explicitly accepts that evidence class."
  ],
  forbiddenEvidence: [
    "copied templates or placeholder values",
    "screenshots without machine-readable JSON",
    "npm tokens, automation tokens, or registry credentials",
    "VS Code Marketplace PATs or publisher secrets",
    "private package registry URLs containing credentials",
    "local dry-run output presented as real publication proof",
    "beta publication evidence presented as final 1.0.0 publication proof",
    "Marketplace draft or local VSIX evidence presented as published extension proof",
    "Git tags or package versions claimed without matching release evidence"
  ],
  nonClaims: [
    "This guide does not publish npm packages.",
    "This guide does not publish the VS Code extension.",
    "This guide does not change package versions or package privacy flags.",
    "This guide does not create a release tag.",
    "This guide does not close publication or final release gates."
  ]
};

assertNoSensitiveValues(JSON.stringify(report));
await writeMarkdown(markdownPath, renderMarkdown(report));
await writeJson(reportPath, report);
await writeJson(samplePath, report);

console.log(
  `Publication package owner guide generated: ${report.status}, ${report.package.missingInputCount} missing input(s), ${report.package.presentInputCount} present input(s)`
);
console.log(`Document: ${markdownPath}`);
console.log(`Report: ${reportPath}`);
console.log(`Sample: ${samplePath}`);

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

function classifyEvidence(evidencePath) {
  return (
    evidenceGroups.find((group) => group.match(evidencePath)) ?? {
      id: "other-publication",
      title: "Other Publication Evidence",
      ownerAction: "Provide the required sanitized publication evidence."
    }
  );
}

function unique(values) {
  return [...new Set(values)];
}

function renderMarkdown(report) {
  const lines = [
    "# Publication Package Owner Input Guide",
    "",
    `Generated at: ${report.generatedAt}`,
    "",
    "This guide covers owner-provided npm and VS Code publication evidence. It does not publish packages, publish the extension, change versions, or close release gates.",
    "",
    "## Current Status",
    "",
    `- status: \`${report.status}\``,
    `- package: \`${report.package.id}\` - ${report.package.title}`,
    `- package status: \`${report.package.status}\``,
    `- missing owner inputs: ${report.package.missingInputCount}`,
    `- present owner inputs: ${report.package.presentInputCount}`,
    `- blocked or failing evidence: ${report.package.blockedOrFailingEvidenceCount}`,
    `- template-covered inputs: ${report.package.templateCoveredInputCount}`,
    "",
    "## Required Evidence Files",
    ""
  ];

  for (const entry of report.requiredEvidence) {
    lines.push(
      `- \`${entry.path}\` - \`${entry.intakeStatus}\`, templates: ${entry.templateCount}, commands: ${entry.relatedCommands.map((command) => `\`${command}\``).join(", ")}`
    );
  }

  lines.push("", "## Evidence Groups", "");
  for (const group of report.evidenceGroups) {
    lines.push(`### ${group.title}`, "", group.ownerAction, "");
    for (const evidencePath of group.evidencePaths) {
      lines.push(`- \`${evidencePath}\``);
    }
    lines.push("");
  }

  lines.push("## Validation Commands", "", "```bash");
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
      `Generated guide contains sensitive material: ${sensitive}`
    );
  }
}
