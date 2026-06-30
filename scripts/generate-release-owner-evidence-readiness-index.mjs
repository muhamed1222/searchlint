#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { format, resolveConfig } from "prettier";

const ownerGateReportPath = "reports/release-owner-gate-actions-report.json";
const ownerEvidenceReportPath = "reports/release-owner-evidence-report.json";
const templateCoverageReportPath =
  "reports/release-owner-evidence-template-coverage-report.json";
const intakeReportPath = "reports/release-evidence-intake-status-report.json";
const markdownPath = "docs/RELEASE_OWNER_EVIDENCE_READINESS_INDEX.md";
const reportPath = "reports/release-owner-evidence-readiness-report.json";
const samplePath =
  "docs/examples/release-owner-evidence-readiness-report.sample.json";
const templateDir = "docs/release-owner-evidence/templates";
const generatedAt = "2026-06-23T00:00:00.000Z";

run("pnpm", ["release:owner-evidence:template-coverage"]);
run("pnpm", ["release:evidence-intake"]);

const ownerGateReport = JSON.parse(await readFile(ownerGateReportPath, "utf8"));
const ownerEvidenceReport = JSON.parse(
  await readFile(ownerEvidenceReportPath, "utf8")
);
const templateCoverageReport = JSON.parse(
  await readFile(templateCoverageReportPath, "utf8")
);
const intakeReport = JSON.parse(await readFile(intakeReportPath, "utf8"));

assertSourceReports({
  ownerGateReport,
  ownerEvidenceReport,
  templateCoverageReport,
  intakeReport
});

const templateByEvidencePath = new Map(
  templateCoverageReport.coverage.map((entry) => [
    entry.expectedEvidencePath,
    entry
  ])
);
const intakeByPath = new Map(
  intakeReport.evidenceRecords.map((entry) => [entry.path, entry])
);

const gateRecords = ownerGateReport.openGates.map((gate, index) =>
  buildGateReadinessRecord(
    gate,
    index + 1,
    templateByEvidencePath,
    intakeByPath
  )
);
const ownerInputRecords = buildOwnerInputRecords(
  intakeReport.evidenceRecords,
  ownerGateReport.openGates,
  templateByEvidencePath
);
const summary = summarize(gateRecords, ownerInputRecords, intakeReport);

const report = {
  schemaVersion: 1,
  generatedBy: "searchlint-release-owner-evidence-readiness-index",
  generatedAt,
  status:
    summary.realOwnerEvidenceCount === 0
      ? "blocked_waiting_for_owner_evidence"
      : "owner_evidence_in_progress",
  sourceReports: {
    ownerGateReportPath,
    ownerEvidenceReportPath,
    templateCoverageReportPath,
    intakeReportPath
  },
  summary,
  gateRecords,
  ownerInputRecords,
  nonClaims: [
    "This readiness index does not close release gates.",
    "Templates are not owner evidence.",
    "Release gates remain open until real owner/reviewer/legal/security/provider/deployment/publication evidence is supplied and dedicated verifiers pass."
  ]
};

assertReadinessCoverage(report);
assertNoSensitiveValues(JSON.stringify(report));
await writeJson(reportPath, report);
await writeJson(samplePath, report);
await writeMarkdown(markdownPath, renderMarkdown(report));

console.log(
  `Release owner evidence readiness generated: ${summary.openGateCount} open gate(s), ${summary.ownerInputEvidenceCount} owner evidence input(s), ${summary.templateCoveredOwnerInputCount} template-covered`
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

function assertSourceReports({
  ownerGateReport,
  ownerEvidenceReport,
  templateCoverageReport,
  intakeReport
}) {
  if (!Array.isArray(ownerGateReport.openGates)) {
    throw new Error("Owner gate report must include openGates.");
  }
  const expectedOpenGateCount = ownerGateReport.source?.openItems;
  if (
    typeof expectedOpenGateCount !== "number" ||
    ownerGateReport.openGates.length !== expectedOpenGateCount
  ) {
    throw new Error(
      `Owner-gate report open gate count mismatch: source.openItems=${String(expectedOpenGateCount)}, openGates=${ownerGateReport.openGates.length}.`
    );
  }
  if (!Array.isArray(ownerEvidenceReport.expectedEvidence)) {
    throw new Error("Owner evidence report must include expectedEvidence.");
  }
  if (templateCoverageReport.status !== "passed") {
    throw new Error("Template coverage report must pass before readiness.");
  }
  if (!Array.isArray(templateCoverageReport.coverage)) {
    throw new Error("Template coverage report must include coverage.");
  }
  if (!Array.isArray(intakeReport.evidenceRecords)) {
    throw new Error("Evidence intake report must include evidenceRecords.");
  }
}

function buildGateReadinessRecord(
  gate,
  ordinal,
  templateByEvidencePath,
  intakeByPath
) {
  const evidencePaths = gate.evidencePaths ?? [];
  const ownerInputPaths = evidencePaths.filter(isOwnerInputPath);
  const ownerInputs = ownerInputPaths.map((evidencePath) => {
    const intake = intakeByPath.get(evidencePath);
    const templatePaths = templatePathsForOwnerInput(
      evidencePath,
      templateByEvidencePath
    );
    return {
      evidencePath,
      templatePath:
        templatePaths[0] ?? templatePathForEvidencePath(evidencePath),
      templatePaths,
      templateStatus: templatePaths.length > 0 ? "covered" : "missing_template",
      evidenceStatus: intake?.intakeStatus ?? "not_in_intake_report"
    };
  });

  const generatedEvidence = evidencePaths
    .filter((evidencePath) => !isOwnerInputPath(evidencePath))
    .map((evidencePath) => {
      const intake = intakeByPath.get(evidencePath);
      return {
        evidencePath,
        kind: intake?.kind ?? classifyEvidenceKind(evidencePath),
        evidenceStatus: intake?.intakeStatus ?? "not_in_intake_report"
      };
    });

  return {
    ordinal,
    section: gate.section,
    item: gate.item,
    gateType: gate.gateType,
    relatedCommand: gate.relatedCommand,
    requiredEvidence: gate.requiredEvidence,
    nextOwnerAction: gate.nextOwnerAction,
    ownerInputCount: ownerInputs.length,
    templateCoveredOwnerInputCount: ownerInputs.filter(
      (entry) => entry.templateStatus === "covered"
    ).length,
    generatedEvidenceCount: generatedEvidence.length,
    readinessStatus:
      ownerInputs.length === 0
        ? "waiting_for_external_non_owner_json_evidence"
        : ownerInputs.every((entry) => entry.templateStatus === "covered")
          ? "ready_for_owner_input"
          : "missing_owner_input_template",
    ownerInputs,
    generatedEvidence
  };
}

function buildOwnerInputRecords(
  evidenceRecords,
  gates,
  templateByEvidencePath
) {
  return evidenceRecords
    .filter((entry) => entry.kind === "owner_input")
    .map((entry) => {
      const relatedGates = gates.filter((gate) =>
        (gate.evidencePaths ?? []).includes(entry.path)
      );
      const templatePaths = templatePathsForOwnerInput(
        entry.path,
        templateByEvidencePath
      );
      return {
        evidencePath: entry.path,
        templatePaths,
        gate: ownerInputGate(entry, relatedGates),
        requiredEvidence: joinedUnique(
          relatedGates.map((gate) => gate.requiredEvidence)
        ),
        nextOwnerAction: joinedUnique(
          relatedGates.map((gate) => gate.nextOwnerAction)
        ),
        templateStatus:
          templatePaths.length > 0 ? "covered" : "missing_template",
        evidenceStatus: entry.intakeStatus,
        exists: entry.exists,
        usableForClosure: entry.usableForClosure,
        issue: entry.issue
      };
    });
}

function summarize(gateRecords, ownerInputRecords, intakeReport) {
  return {
    openGateCount: gateRecords.length,
    ownerInputEvidenceCount: ownerInputRecords.length,
    templateCoveredOwnerInputCount: ownerInputRecords.filter(
      (entry) => entry.templateStatus === "covered"
    ).length,
    realOwnerEvidenceCount: ownerInputRecords.filter(
      (entry) => entry.usableForClosure
    ).length,
    gatesReadyForOwnerInputCount: gateRecords.filter(
      (entry) => entry.readinessStatus === "ready_for_owner_input"
    ).length,
    gatesWithoutOwnerInputJsonCount: gateRecords.filter(
      (entry) =>
        entry.readinessStatus === "waiting_for_external_non_owner_json_evidence"
    ).length,
    intakeStatus: intakeReport.status,
    missingEvidencePathCount: intakeReport.summary.missingEvidencePathCount,
    blockedOrFailingReportCount:
      intakeReport.summary.blockedOrFailingReportCount
  };
}

function assertReadinessCoverage(report) {
  const expectedOpenGateCount =
    report.summary.gatesReadyForOwnerInputCount +
    report.summary.gatesWithoutOwnerInputJsonCount;
  if (report.summary.openGateCount !== expectedOpenGateCount) {
    throw new Error(
      `Readiness index gate coverage mismatch: openGateCount=${report.summary.openGateCount}, covered=${expectedOpenGateCount}.`
    );
  }
  if (
    report.ownerInputRecords.length !== report.summary.ownerInputEvidenceCount
  ) {
    throw new Error(
      `Readiness index owner input count mismatch: ownerInputRecords=${report.ownerInputRecords.length}, summary=${report.summary.ownerInputEvidenceCount}.`
    );
  }
  if (
    report.summary.templateCoveredOwnerInputCount !==
    report.summary.ownerInputEvidenceCount
  ) {
    throw new Error("Every owner evidence input must have template coverage.");
  }
}

function renderMarkdown(report) {
  const lines = [
    "# Release Owner Evidence Readiness Index",
    "",
    `Generated at: ${report.generatedAt}`,
    "",
    "This index maps the remaining SearchLint 1.0 release gates to their required owner evidence. It is not release approval.",
    "",
    "## Summary",
    "",
    `- Status: \`${report.status}\``,
    `- Open gates: ${report.summary.openGateCount}`,
    `- Owner evidence inputs: ${report.summary.ownerInputEvidenceCount}`,
    `- Template-covered owner inputs: ${report.summary.templateCoveredOwnerInputCount}`,
    `- Real owner evidence files present: ${report.summary.realOwnerEvidenceCount}`,
    `- Gates ready for owner input: ${report.summary.gatesReadyForOwnerInputCount}`,
    `- Gates without owner-input JSON path: ${report.summary.gatesWithoutOwnerInputJsonCount}`,
    `- Evidence intake status: \`${report.summary.intakeStatus}\``,
    "",
    "## Owner Input Evidence",
    "",
    "| Evidence path | Template | Gate | Status |",
    "| --- | --- | --- | --- |"
  ];

  for (const entry of report.ownerInputRecords) {
    lines.push(
      `| \`${entry.evidencePath}\` | ${entry.templatePaths.map((templatePath) => `\`${templatePath}\``).join("<br>")} | ${escapeMarkdown(entry.gate.section)} / ${escapeMarkdown(entry.gate.item)} | \`${entry.evidenceStatus}\`, \`${entry.templateStatus}\`, usable: \`${String(entry.usableForClosure)}\` |`
    );
  }

  lines.push("", "## Open Gate Readiness", "");

  for (const gate of report.gateRecords) {
    lines.push(
      `### ${gate.ordinal}. ${gate.section}: ${gate.item}`,
      "",
      `- Gate type: \`${gate.gateType}\``,
      `- Related command: \`${gate.relatedCommand}\``,
      `- Readiness status: \`${gate.readinessStatus}\``,
      `- Required evidence: ${gate.requiredEvidence}`,
      `- Next owner action: ${gate.nextOwnerAction}`
    );
    if (gate.ownerInputs.length > 0) {
      lines.push("- Owner input templates:");
      for (const input of gate.ownerInputs) {
        lines.push(
          `  - \`${input.evidencePath}\` from \`${input.templatePath}\` -> \`${input.evidenceStatus}\``
        );
      }
    }
    if (gate.generatedEvidence.length > 0) {
      lines.push("- Generated/supporting evidence:");
      for (const evidence of gate.generatedEvidence) {
        lines.push(
          `  - \`${evidence.evidencePath}\` -> \`${evidence.evidenceStatus}\``
        );
      }
    }
    lines.push("");
  }

  lines.push("## Non-Claims", "");
  for (const nonClaim of report.nonClaims) {
    lines.push(`- ${nonClaim}`);
  }
  lines.push("");

  return `${lines.join("\n")}\n`;
}

function isOwnerInputPath(filePath) {
  return (
    filePath.endsWith(".json") &&
    classifyEvidenceKind(filePath) === "owner_input"
  );
}

function templatePathForEvidencePath(evidencePath) {
  return `${templateDir}/${path.basename(evidencePath, ".json")}.example.json`;
}

function templatePathsForOwnerInput(evidencePath, templateByEvidencePath) {
  const coveredTemplate = templateByEvidencePath.get(evidencePath);
  if (coveredTemplate) return [coveredTemplate.templatePath];

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

  return [...new Set(candidates)].filter((candidate) => existsSync(candidate));
}

function ownerInputGate(entry, relatedGates) {
  const firstUsage = entry.usages[0];
  const firstGate = relatedGates[0] ?? firstUsage;
  const relatedCommands = joinedUnique(
    entry.usages.map((usage) => usage.relatedCommand)
  );
  return {
    section: firstGate.section,
    item:
      entry.usages.length === 1
        ? firstGate.item
        : `${entry.usages.length} release gates`,
    gateType: firstGate.gateType,
    relatedCommand: relatedCommands
  };
}

function joinedUnique(values) {
  return [...new Set(values.filter(Boolean))].join("; ");
}

function classifyEvidenceKind(evidencePath) {
  if (evidencePath.startsWith("docs/examples/")) return "sample";
  if (evidencePath.startsWith("reports/")) return "generated_report";
  if (evidencePath.endsWith(".json")) return "owner_input";
  return "document";
}

function escapeMarkdown(value) {
  return String(value).replaceAll("|", "\\|");
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
  const match = sensitivePatternMatch(text);
  if (match) {
    throw new Error(`Sensitive value leaked into readiness report: ${match}`);
  }
}

function sensitivePatternMatch(text) {
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
  return forbidden.find((pattern) => pattern.test(text))?.toString() ?? null;
}
