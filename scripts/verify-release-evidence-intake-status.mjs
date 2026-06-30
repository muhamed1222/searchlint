#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { format, resolveConfig } from "prettier";

const ownerGateReportPath = "reports/release-owner-gate-actions-report.json";
const markdownPath = "docs/RELEASE_EVIDENCE_INTAKE_STATUS.md";
const reportPath = "reports/release-evidence-intake-status-report.json";
const samplePath =
  "docs/examples/release-evidence-intake-status-report.sample.json";
const generatedAt = "2026-06-23T00:00:00.000Z";

run("pnpm", ["release:owner-evidence"]);

const ownerGateReport = JSON.parse(await readFile(ownerGateReportPath, "utf8"));
assertOwnerGateReport(ownerGateReport);
const ownerEvidenceReport = JSON.parse(
  await readFile("reports/release-owner-evidence-report.json", "utf8")
);
assertOwnerEvidenceReport(ownerEvidenceReport);

const evidenceRecords = await buildEvidenceRecords(ownerGateReport.openGates);
const evidenceByPath = new Map(
  evidenceRecords.map((record) => [record.path, record])
);
const gateRecords = ownerGateReport.openGates.map((gate) =>
  buildGateRecord(gate, evidenceByPath)
);
const summary = buildSummary(ownerGateReport, evidenceRecords, gateRecords);

const intakeReport = {
  schemaVersion: 1,
  generatedBy: "searchlint-release-evidence-intake-status-verifier",
  generatedAt,
  status:
    summary.missingEvidencePathCount === 0 &&
    summary.blockedOrFailingReportCount === 0
      ? "evidence_intake_ready_for_owner_review"
      : "blocked_external_evidence",
  sourceReportPath: ownerGateReportPath,
  ownerEvidenceReport: {
    reportPath: "reports/release-owner-evidence-report.json",
    status: ownerEvidenceReport.status,
    expectedEvidenceCount: ownerEvidenceReport.expectedEvidenceCount,
    presentEvidenceCount: ownerEvidenceReport.presentEvidenceCount,
    missingEvidenceCount: ownerEvidenceReport.missingEvidenceCount,
    failureCount: ownerEvidenceReport.failureCount
  },
  checklist: ownerGateReport.source,
  releaseReadiness: ownerGateReport.releaseReadiness,
  summary,
  evidenceRecords,
  gateRecords,
  nonClaims: [
    "This report does not close release gates.",
    "This report does not replace owner, reviewer, legal, security, provider, publication, deployment, or final release approval.",
    "Present generated reports are intake signals only; checklist items remain open until their dedicated verifier passes and required external evidence exists."
  ]
};

assertIntakeCoverage(intakeReport, ownerGateReport);
assertNoSensitiveValues(JSON.stringify(intakeReport));

await writeMarkdown(markdownPath, renderMarkdown(intakeReport));
await writeJson(reportPath, intakeReport);
await writeJson(samplePath, intakeReport);

console.log(
  `Release evidence intake status generated: ${summary.openGateCount} open gate(s), ${summary.uniqueEvidencePathCount} unique evidence path(s), ${summary.missingEvidencePathCount} missing`
);
console.log(`Status: ${intakeReport.status}`);
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

function assertOwnerGateReport(report) {
  if (report.actionability?.status !== "passed") {
    throw new Error(
      "Owner-gate report actionability must pass before evidence intake."
    );
  }
  if (!Array.isArray(report.openGates)) {
    throw new Error("Owner-gate report must include openGates.");
  }
  const expectedOpenGateCount = report.source?.openItems;
  if (
    typeof expectedOpenGateCount !== "number" ||
    report.openGates.length !== expectedOpenGateCount
  ) {
    throw new Error(
      `Owner-gate report open gate count mismatch: source.openItems=${String(expectedOpenGateCount)}, openGates=${report.openGates.length}. Regenerate or update the intake contract intentionally.`
    );
  }
}

function assertOwnerEvidenceReport(report) {
  if (report.status !== "passed") {
    throw new Error("Owner evidence report must pass before evidence intake.");
  }
  if (typeof report.expectedEvidenceCount !== "number") {
    throw new Error(
      "Owner evidence report must include expectedEvidenceCount."
    );
  }
}

async function buildEvidenceRecords(gates) {
  const usageByPath = new Map();
  for (const gate of gates) {
    for (const evidencePath of gate.evidencePaths ?? []) {
      const usages = usageByPath.get(evidencePath) ?? [];
      usages.push({
        section: gate.section,
        item: gate.item,
        gateType: gate.gateType,
        relatedCommand: gate.relatedCommand
      });
      usageByPath.set(evidencePath, usages);
    }
  }

  const records = [];
  for (const [evidencePath, usages] of [...usageByPath.entries()].sort()) {
    records.push(await buildEvidenceRecord(evidencePath, usages));
  }
  return records;
}

async function buildEvidenceRecord(evidencePath, usages) {
  const exists = existsSync(evidencePath);
  const kind = classifyEvidenceKind(evidencePath);
  const record = {
    path: evidencePath,
    kind,
    exists,
    usableForClosure: false,
    usageCount: usages.length,
    usages
  };

  if (!exists) {
    return {
      ...record,
      intakeStatus: "missing",
      issue: "Required evidence path does not exist."
    };
  }

  const fileStat = await stat(evidencePath);
  const parsed = await readJsonStatus(evidencePath);
  const statusSignals = parsed.ok ? extractStatusSignals(parsed.value) : [];
  const blockingSignals = statusSignals.filter(isBlockingStatusSignal);
  const releasePassSignals = statusSignals.filter(isReleasePassStatusSignal);

  return {
    ...record,
    bytes: fileStat.size,
    jsonParseStatus: parsed.ok ? "parsed" : parsed.status,
    statusSignals,
    intakeStatus:
      blockingSignals.length > 0
        ? "present_blocked_or_failing"
        : kind === "sample"
          ? "sample_present_not_release_evidence"
          : releasePassSignals.length > 0
            ? "present_with_pass_signal"
            : "present_unclassified",
    usableForClosure:
      kind !== "sample" &&
      blockingSignals.length === 0 &&
      releasePassSignals.length > 0,
    issue:
      blockingSignals.length > 0
        ? "Present JSON records blocked or failing status."
        : undefined
  };
}

function classifyEvidenceKind(evidencePath) {
  if (evidencePath.startsWith("docs/examples/")) return "sample";
  if (evidencePath.startsWith("reports/")) return "generated_report";
  if (evidencePath.endsWith(".json")) return "owner_input";
  return "document";
}

async function readJsonStatus(evidencePath) {
  if (!evidencePath.endsWith(".json")) {
    return { ok: false, status: "not_json" };
  }
  try {
    return {
      ok: true,
      value: JSON.parse(await readFile(evidencePath, "utf8"))
    };
  } catch {
    return { ok: false, status: "json_parse_failed" };
  }
}

function extractStatusSignals(value) {
  const signals = [];
  collectStatusSignals(value, [], signals);
  return signals.sort((a, b) => a.path.localeCompare(b.path));
}

function collectStatusSignals(value, pathParts, signals) {
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      collectStatusSignals(item, [...pathParts, String(index)], signals);
    }
    return;
  }
  if (!value || typeof value !== "object") return;

  for (const [key, nestedValue] of Object.entries(value)) {
    const nestedPath = [...pathParts, key];
    if (isStatusKey(key) && typeof nestedValue !== "object") {
      signals.push({
        path: nestedPath.join("."),
        value: String(nestedValue)
      });
    }
    if (nestedPath.length < 5) {
      collectStatusSignals(nestedValue, nestedPath, signals);
    }
  }
}

function isStatusKey(key) {
  return /^(status|passFail|releaseGateStatus|result|verdict)$/i.test(key);
}

function isBlockingStatusSignal(signal) {
  return /blocked|fail|failed|failure|missing|reject|rejected|incomplete|not[_-]?ready/i.test(
    signal.value
  );
}

function isReleasePassStatusSignal(signal) {
  return /^(pass|passed|verified|approved|ready|complete|completed|generated)$/i.test(
    signal.value
  );
}

function buildGateRecord(gate, evidenceByPath) {
  const evidence = (gate.evidencePaths ?? []).map((evidencePath) => {
    const record = evidenceByPath.get(evidencePath);
    if (!record) {
      throw new Error(`Missing evidence record for ${evidencePath}`);
    }
    return {
      path: record.path,
      kind: record.kind,
      exists: record.exists,
      intakeStatus: record.intakeStatus,
      usableForClosure: record.usableForClosure
    };
  });

  const blockingEvidenceIssues = evidence
    .filter(
      (record) =>
        !record.exists || record.intakeStatus === "present_blocked_or_failing"
    )
    .map((record) => ({
      path: record.path,
      intakeStatus: record.intakeStatus
    }));
  const externalOwnerProofRequired = requiresExternalOwnerProof(gate);
  const ownerProofEvidence = evidence.filter(
    (record) =>
      record.kind === "owner_input" &&
      record.exists &&
      record.intakeStatus !== "present_blocked_or_failing"
  );

  if (externalOwnerProofRequired && ownerProofEvidence.length === 0) {
    blockingEvidenceIssues.push({
      path: null,
      intakeStatus: "missing_external_owner_proof"
    });
  }

  return {
    section: gate.section,
    item: gate.item,
    gateType: gate.gateType,
    relatedCommand: gate.relatedCommand,
    requiredEvidence: gate.requiredEvidence,
    nextOwnerAction: gate.nextOwnerAction,
    evidencePathCount: evidence.length,
    presentEvidencePathCount: evidence.filter((record) => record.exists).length,
    missingEvidencePathCount: evidence.filter((record) => !record.exists)
      .length,
    externalOwnerProofRequired,
    ownerProofEvidencePathCount: ownerProofEvidence.length,
    missingExternalOwnerProof:
      externalOwnerProofRequired && ownerProofEvidence.length === 0,
    blockingEvidenceIssues,
    evidence
  };
}

function requiresExternalOwnerProof(gate) {
  return [
    "independent_reviewer_gate",
    "independent_reviewer_delivery_gate",
    "legal_owner_gate",
    "hosted_github_governance_gate",
    "npm_publication_gate",
    "vscode_marketplace_gate",
    "production_deployment_gate",
    "live_provider_acceptance_gate",
    "manual_accessibility_review_gate",
    "external_security_review_gate",
    "deployed_public_website_gate",
    "final_release_action_gate"
  ].includes(gate.gateType);
}

function buildSummary(ownerGateReport, evidenceRecords, gateRecords) {
  return {
    openGateCount: ownerGateReport.openGates.length,
    checkedItemCount: ownerGateReport.source.checkedItems,
    openItemCount: ownerGateReport.source.openItems,
    totalItemCount: ownerGateReport.source.totalItems,
    uniqueEvidencePathCount: evidenceRecords.length,
    presentEvidencePathCount: evidenceRecords.filter((record) => record.exists)
      .length,
    missingEvidencePathCount: evidenceRecords.filter((record) => !record.exists)
      .length,
    ownerInputEvidencePathCount: evidenceRecords.filter(
      (record) => record.kind === "owner_input"
    ).length,
    generatedReportEvidencePathCount: evidenceRecords.filter(
      (record) => record.kind === "generated_report"
    ).length,
    sampleEvidencePathCount: evidenceRecords.filter(
      (record) => record.kind === "sample"
    ).length,
    blockedOrFailingReportCount: evidenceRecords.filter(
      (record) => record.intakeStatus === "present_blocked_or_failing"
    ).length,
    gatesWithMissingEvidenceCount: gateRecords.filter(
      (record) => record.missingEvidencePathCount > 0
    ).length,
    gatesWithBlockingEvidenceIssuesCount: gateRecords.filter(
      (record) => record.blockingEvidenceIssues.length > 0
    ).length,
    externalOwnerProofRequiredGateCount: gateRecords.filter(
      (record) => record.externalOwnerProofRequired
    ).length,
    gatesMissingExternalOwnerProofCount: gateRecords.filter(
      (record) => record.missingExternalOwnerProof
    ).length,
    gatesWithAllEvidencePathsPresentCount: gateRecords.filter(
      (record) => record.missingEvidencePathCount === 0
    ).length,
    releaseGateClaim: "not_claimed"
  };
}

function assertIntakeCoverage(intakeReport, ownerGateReport) {
  if (intakeReport.gateRecords.length !== ownerGateReport.openGates.length) {
    throw new Error(
      `Gate coverage mismatch: ${intakeReport.gateRecords.length} records, ${ownerGateReport.openGates.length} expected.`
    );
  }
  const uniquePaths = new Set(
    ownerGateReport.openGates.flatMap((gate) => gate.evidencePaths ?? [])
  );
  if (intakeReport.evidenceRecords.length !== uniquePaths.size) {
    throw new Error(
      `Evidence path coverage mismatch: ${intakeReport.evidenceRecords.length} records, ${uniquePaths.size} expected.`
    );
  }
  if (intakeReport.summary.releaseGateClaim !== "not_claimed") {
    throw new Error("Evidence intake must not claim release-gate closure.");
  }
}

function renderMarkdown(report) {
  const missing = report.evidenceRecords.filter((record) => !record.exists);
  const blocking = report.evidenceRecords.filter(
    (record) => record.intakeStatus === "present_blocked_or_failing"
  );
  const lines = [
    "# Release Evidence Intake Status",
    "",
    "Status date: 2026-06-23",
    "",
    "This document is generated from `reports/release-owner-gate-actions-report.json`.",
    "It tracks required evidence files for the remaining SearchLint 1.0 owner gates.",
    "",
    "It does not close release gates and does not replace reviewer, legal, security, provider, publication, deployment, or final release approval.",
    "",
    "## Summary",
    "",
    `- status: \`${report.status}\``,
    `- open gates: ${report.summary.openGateCount}`,
    `- checklist progress: ${report.summary.checkedItemCount}/${report.summary.totalItemCount} checked, ${report.summary.openItemCount} open`,
    `- unique evidence paths: ${report.summary.uniqueEvidencePathCount}`,
    `- present evidence paths: ${report.summary.presentEvidencePathCount}`,
    `- missing evidence paths: ${report.summary.missingEvidencePathCount}`,
    `- blocked or failing present reports: ${report.summary.blockedOrFailingReportCount}`,
    `- gates with missing evidence: ${report.summary.gatesWithMissingEvidenceCount}`,
    `- gates with blocking evidence issues: ${report.summary.gatesWithBlockingEvidenceIssuesCount}`,
    `- external gates requiring owner proof: ${report.summary.externalOwnerProofRequiredGateCount}`,
    `- external gates missing owner proof: ${report.summary.gatesMissingExternalOwnerProofCount}`,
    `- owner evidence verifier: ${report.ownerEvidenceReport.presentEvidenceCount}/${report.ownerEvidenceReport.expectedEvidenceCount} present, ${report.ownerEvidenceReport.failureCount} failures`,
    "",
    "## Missing Evidence Paths",
    ""
  ];

  if (missing.length === 0) {
    lines.push("- None.");
  } else {
    for (const record of missing) {
      lines.push(`- \`${record.path}\` (${record.kind})`);
    }
  }

  lines.push("");
  lines.push("## Present Blocked Or Failing Reports");
  lines.push("");

  if (blocking.length === 0) {
    lines.push("- None.");
  } else {
    for (const record of blocking) {
      lines.push(`- \`${record.path}\``);
    }
  }

  lines.push("");
  lines.push("## Gate Intake Status");
  lines.push("");
  lines.push("| Section | Gate | Command | Evidence | Issues |");
  lines.push("| --- | --- | --- | ---: | --- |");
  for (const gate of report.gateRecords) {
    const issues =
      gate.blockingEvidenceIssues.length === 0
        ? "none"
        : gate.blockingEvidenceIssues
            .map((issue) =>
              issue.path
                ? `${issue.path}: ${issue.intakeStatus}`
                : issue.intakeStatus
            )
            .join("<br>");
    lines.push(
      `| ${escapeMarkdownTable(gate.section)} | ${escapeMarkdownTable(gate.item)} | \`${gate.relatedCommand}\` | ${gate.presentEvidencePathCount}/${gate.evidencePathCount} present | ${escapeMarkdownTable(issues)} |`
    );
  }

  lines.push("");
  lines.push("## Non-Claims");
  lines.push("");
  for (const nonClaim of report.nonClaims) {
    lines.push(`- ${nonClaim}`);
  }
  lines.push("");

  return `${lines.join("\n")}\n`;
}

function escapeMarkdownTable(value) {
  return String(value).replaceAll("|", "\\|").replaceAll("\n", " ");
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
    throw new Error(`Sensitive value leaked into evidence intake: ${match}`);
  }
}
