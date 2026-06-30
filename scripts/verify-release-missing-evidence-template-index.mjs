#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { format, resolveConfig } from "prettier";

const intakeReportPath = "reports/release-evidence-intake-status-report.json";
const markdownPath = "docs/RELEASE_MISSING_EVIDENCE_TEMPLATE_INDEX.md";
const reportPath =
  "reports/release-missing-evidence-template-index-report.json";
const samplePath =
  "docs/examples/release-missing-evidence-template-index-report.sample.json";
const generatedAt = "2026-06-23T00:00:00.000Z";

run("pnpm", ["release:evidence-intake"]);

const intakeReport = JSON.parse(await readFile(intakeReportPath, "utf8"));
assertIntakeReport(intakeReport);

const missingOwnerInputs = intakeReport.evidenceRecords.filter(
  (record) => record.kind === "owner_input" && !record.exists
);
const entries = missingOwnerInputs.map((record) =>
  buildTemplateEntry(record, intakeReport.gateRecords)
);
const entriesWithoutTemplates = entries.filter(
  (entry) => entry.availableTemplatePaths.length === 0
);

const report = {
  schemaVersion: 1,
  generatedBy: "searchlint-release-missing-evidence-template-index-verifier",
  generatedAt,
  status:
    entriesWithoutTemplates.length === 0
      ? "template_index_ready"
      : "blocked_missing_templates",
  sourceReportPath: intakeReportPath,
  openGateCount: intakeReport.summary.openGateCount,
  missingOwnerInputCount: missingOwnerInputs.length,
  entriesWithTemplatesCount: entries.filter(
    (entry) => entry.availableTemplatePaths.length > 0
  ).length,
  entriesWithoutTemplatesCount: entriesWithoutTemplates.length,
  entries,
  nonClaims: [
    "Templates and instructions are not owner evidence.",
    "This report does not create reviewer, legal, security, deployment, provider, publication, backup, or final release sign-off.",
    "Checklist items remain open until real evidence files exist and the related verifier passes."
  ]
};

assertNoMissingTemplates(report);
assertNoSensitiveValues(JSON.stringify(report));

await writeMarkdown(markdownPath, renderMarkdown(report));
await writeJson(reportPath, report);
await writeJson(samplePath, report);

console.log(
  `Missing evidence template index generated: ${report.missingOwnerInputCount} missing owner input(s), ${report.entriesWithTemplatesCount} with template(s)`
);
console.log(`Status: ${report.status}`);
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

function assertIntakeReport(report) {
  if (!Array.isArray(report.evidenceRecords)) {
    throw new Error("Evidence intake report must include evidenceRecords.");
  }
  if (!Array.isArray(report.gateRecords)) {
    throw new Error("Evidence intake report must include gateRecords.");
  }
  if (report.summary?.openGateCount !== 83) {
    throw new Error(
      `Expected 83 open gates, found ${report.summary?.openGateCount}.`
    );
  }
}

function buildTemplateEntry(record, gates) {
  const availableTemplatePaths = templateCandidates(record.path).filter(
    (candidate) => existsSync(candidate)
  );
  const relatedGates = gates
    .filter((gate) =>
      gate.evidence.some((evidence) => evidence.path === record.path)
    )
    .map((gate) => ({
      section: gate.section,
      item: gate.item,
      gateType: gate.gateType,
      relatedCommand: gate.relatedCommand,
      requiredEvidence: gate.requiredEvidence,
      nextOwnerAction: gate.nextOwnerAction
    }));

  return {
    missingEvidencePath: record.path,
    availableTemplatePaths,
    relatedGateCount: relatedGates.length,
    relatedGates,
    ownerAction: ownerActionFor(record.path, relatedGates)
  };
}

function templateCandidates(evidencePath) {
  const directory = path.dirname(evidencePath);
  const basename = path.basename(evidencePath, ".json");
  const candidates = [
    path.join(directory, `${basename}.example.json`),
    path.join(directory, `${basename}.template.json`),
    path.join(directory, "README.md"),
    path.join(directory, "REVIEW_INSTRUCTIONS.md"),
    path.join(directory, "REVIEW_FORM_TEMPLATE.md"),
    path.join(directory, "REPORT_SUMMARY_TEMPLATE.md")
  ];

  if (evidencePath.endsWith("REPORT_SUMMARY.json")) {
    candidates.push(path.join(directory, "report-summary.example.json"));
  }

  if (
    evidencePath.startsWith("docs/release-owner-evidence/") &&
    evidencePath.endsWith(".json")
  ) {
    candidates.unshift(
      path.join(
        "docs/release-owner-evidence/templates",
        `${basename}.example.json`
      )
    );
  }

  return [...new Set(candidates)];
}

function ownerActionFor(evidencePath, relatedGates) {
  const command =
    relatedGates.length > 0
      ? [...new Set(relatedGates.map((gate) => gate.relatedCommand))].join(", ")
      : "unknown";
  return `Create ${evidencePath} from the listed template/instructions using real owner or reviewer evidence, then run ${command}.`;
}

function assertNoMissingTemplates(report) {
  if (report.entriesWithoutTemplatesCount > 0) {
    throw new Error(
      `Missing template coverage for ${report.entriesWithoutTemplatesCount} owner input(s): ${report.entriesWithoutTemplates
        ?.map((entry) => entry.missingEvidencePath)
        .join(", ")}`
    );
  }
  for (const entry of report.entries) {
    if (entry.relatedGateCount === 0) {
      throw new Error(
        `Missing related gate mapping for ${entry.missingEvidencePath}.`
      );
    }
  }
}

function renderMarkdown(report) {
  const lines = [
    "# Release Missing Evidence Template Index",
    "",
    "Status date: 2026-06-23",
    "",
    "This document is generated from `reports/release-evidence-intake-status-report.json`.",
    "It maps each missing owner-provided evidence file to existing templates, instructions, related gates, and commands.",
    "",
    "Templates are not release evidence. They only define the shape of real owner, reviewer, legal, security, deployment, provider, publication, backup, or final release evidence.",
    "",
    "## Summary",
    "",
    `- status: \`${report.status}\``,
    `- open gates: ${report.openGateCount}`,
    `- missing owner input files: ${report.missingOwnerInputCount}`,
    `- missing owner input files with templates/instructions: ${report.entriesWithTemplatesCount}`,
    `- missing owner input files without templates/instructions: ${report.entriesWithoutTemplatesCount}`,
    "",
    "## Missing Evidence Inputs",
    "",
    "| Missing evidence | Templates / instructions | Related command(s) |",
    "| --- | --- | --- |"
  ];

  for (const entry of report.entries) {
    const templates = entry.availableTemplatePaths
      .map((templatePath) => `\`${templatePath}\``)
      .join("<br>");
    const commands = [
      ...new Set(entry.relatedGates.map((gate) => gate.relatedCommand))
    ]
      .map((command) => `\`${command}\``)
      .join("<br>");
    lines.push(
      `| \`${entry.missingEvidencePath}\` | ${templates} | ${commands} |`
    );
  }

  lines.push("");
  lines.push("## Owner Actions");
  lines.push("");
  for (const entry of report.entries) {
    lines.push(`### ${entry.missingEvidencePath}`);
    lines.push("");
    lines.push(entry.ownerAction);
    lines.push("");
    lines.push("Related gates:");
    for (const gate of entry.relatedGates) {
      lines.push(
        `- ${gate.section}: ${gate.item}; command \`${gate.relatedCommand}\``
      );
    }
    lines.push("");
  }

  lines.push("## Non-Claims");
  lines.push("");
  for (const nonClaim of report.nonClaims) {
    lines.push(`- ${nonClaim}`);
  }
  lines.push("");

  return `${lines.join("\n")}\n`;
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
      `Sensitive value leaked into missing evidence template index: ${match}`
    );
  }
}
