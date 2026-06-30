#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { format } from "prettier";

const runbookReportPath = "reports/release-owner-evidence-runbook-report.json";
const intakeReportPath = "reports/release-evidence-intake-status-report.json";
const markdownPath = "docs/RELEASE_OWNER_EVIDENCE_PACKAGE_STATUS.md";
const reportPath = "reports/release-owner-evidence-package-status-report.json";
const samplePath =
  "docs/examples/release-owner-evidence-package-status-report.sample.json";
const generatedAt = "2026-06-23T00:00:00.000Z";

run("pnpm", ["release:owner-evidence-runbook"]);

const runbookReport = JSON.parse(await readFile(runbookReportPath, "utf8"));
const intakeReport = JSON.parse(await readFile(intakeReportPath, "utf8"));

assertSourceReports(runbookReport, intakeReport);

const evidenceByPath = new Map(
  intakeReport.evidenceRecords.map((record) => [record.path, record])
);
const entriesByPackage = new Map();
for (const entry of runbookReport.entries) {
  const packageId = packageForEntry(entry, runbookReport.packages);
  const entries = entriesByPackage.get(packageId) ?? [];
  entries.push(entry);
  entriesByPackage.set(packageId, entries);
}

const packageRecords = runbookReport.packages.map((packageSummary) =>
  buildPackageRecord(packageSummary, entriesByPackage, evidenceByPath)
);
const report = {
  schemaVersion: 1,
  generatedBy: "searchlint-release-owner-evidence-package-status-verifier",
  generatedAt,
  status: packageRecords.every((record) => record.status === "complete")
    ? "owner_evidence_packages_complete"
    : "blocked_waiting_for_owner_evidence",
  sourceReports: {
    runbookReportPath,
    intakeReportPath
  },
  checklist: runbookReport.checklist,
  summary: {
    packageCount: packageRecords.length,
    completePackageCount: packageRecords.filter(
      (record) => record.status === "complete"
    ).length,
    blockedPackageCount: packageRecords.filter(
      (record) => record.status !== "complete"
    ).length,
    missingOwnerInputCount: packageRecords.reduce(
      (sum, record) => sum + record.missingInputCount,
      0
    ),
    presentOwnerInputCount: packageRecords.reduce(
      (sum, record) => sum + record.presentInputCount,
      0
    ),
    blockedOrFailingEvidenceCount: packageRecords.reduce(
      (sum, record) => sum + record.blockedOrFailingEvidenceCount,
      0
    ),
    releaseGateClaim: runbookReport.summary.releaseGateClaim
  },
  packageRecords,
  nonClaims: [
    "This verifier does not create owner evidence.",
    "This verifier does not close release gates.",
    "Package status is informational until real evidence exists and dedicated verifiers pass."
  ]
};

assertCurrentBlockedState(report);
assertNoSensitiveValues(JSON.stringify(report));
await writeMarkdown(markdownPath, renderMarkdown(report));
await writeJson(reportPath, report);
await writeJson(samplePath, report);

console.log(
  `Release owner evidence package status: ${report.summary.completePackageCount}/${report.summary.packageCount} complete, ${report.summary.missingOwnerInputCount} missing owner input(s)`
);
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

function assertSourceReports(runbookReport, intakeReport) {
  if (runbookReport.status !== "blocked_waiting_for_owner_evidence") {
    throw new Error("Owner evidence runbook must be in blocked waiting state.");
  }
  if (runbookReport.summary?.missingOwnerInputCount !== 63) {
    throw new Error("Owner evidence runbook must cover 63 missing inputs.");
  }
  if (intakeReport.status !== "blocked_external_evidence") {
    throw new Error("Evidence intake must remain blocked.");
  }
  if (!Array.isArray(runbookReport.packages)) {
    throw new Error("Owner evidence runbook report must include packages.");
  }
  if (!Array.isArray(runbookReport.entries)) {
    throw new Error("Owner evidence runbook report must include entries.");
  }
  if (!Array.isArray(intakeReport.evidenceRecords)) {
    throw new Error("Evidence intake report must include evidence records.");
  }
}

function packageForEntry(entry, packages) {
  const candidates = packages.filter((summary) =>
    entry.gateTypes.some((gateType) =>
      packageMatchesGateType(summary.id, gateType)
    )
  );
  if (candidates.length !== 1) {
    throw new Error(
      `Unable to map ${entry.missingEvidencePath} to exactly one package.`
    );
  }
  return candidates[0].id;
}

function packageMatchesGateType(packageId, gateType) {
  const mapping = {
    "01-reviewer-rule-quality": [
      "independent_reviewer_delivery_gate",
      "independent_reviewer_gate",
      "rule_quality_final_gate"
    ],
    "02-governance-legal": [
      "hosted_github_governance_gate",
      "legal_owner_gate"
    ],
    "03-publication": ["npm_publication_gate", "vscode_marketplace_gate"],
    "04-production-platform": ["production_deployment_gate"],
    "05-live-providers": ["live_provider_acceptance_gate"],
    "06-security-accessibility-website": [
      "manual_accessibility_review_gate",
      "external_security_review_gate",
      "deployed_public_website_gate"
    ],
    "07-final-release": ["final_release_action_gate"]
  };
  return (mapping[packageId] ?? []).includes(gateType);
}

function buildPackageRecord(packageSummary, entriesByPackage, evidenceByPath) {
  const entries = entriesByPackage.get(packageSummary.id) ?? [];
  const evidence = entries.map((entry) => {
    const record = evidenceByPath.get(entry.missingEvidencePath);
    if (!record) {
      throw new Error(`Missing intake record for ${entry.missingEvidencePath}`);
    }
    return {
      path: entry.missingEvidencePath,
      exists: record.exists,
      intakeStatus: record.intakeStatus,
      templateCount: entry.templatePaths.length,
      relatedCommands: entry.relatedCommands
    };
  });
  const missingInputCount = evidence.filter((record) => !record.exists).length;
  const presentInputCount = evidence.filter((record) => record.exists).length;
  const blockedOrFailingEvidenceCount = evidence.filter((record) =>
    /blocked|fail|missing/i.test(record.intakeStatus)
  ).length;
  const status =
    missingInputCount === 0 && blockedOrFailingEvidenceCount === 0
      ? "complete"
      : "blocked_missing_owner_evidence";

  return {
    id: packageSummary.id,
    title: packageSummary.title,
    status,
    missingInputCount,
    presentInputCount,
    blockedOrFailingEvidenceCount,
    templateCoveredInputCount: evidence.filter(
      (record) => record.templateCount > 0
    ).length,
    relatedCommands: packageSummary.relatedCommands,
    evidence
  };
}

function assertCurrentBlockedState(report) {
  if (report.summary.packageCount !== 7) {
    throw new Error(
      `Expected 7 packages, found ${report.summary.packageCount}.`
    );
  }
  if (report.summary.completePackageCount !== 0) {
    throw new Error(
      "Current checkout must not report complete owner packages."
    );
  }
  if (report.summary.blockedPackageCount !== 7) {
    throw new Error("Current checkout must report all 7 packages blocked.");
  }
  if (report.summary.missingOwnerInputCount !== 63) {
    throw new Error("Current checkout must report 63 missing owner inputs.");
  }
  if (report.summary.presentOwnerInputCount !== 0) {
    throw new Error("Current checkout must report 0 present owner inputs.");
  }
  if (report.summary.releaseGateClaim !== "not_claimed") {
    throw new Error("Package status must not claim release gates.");
  }
}

function renderMarkdown(report) {
  const lines = [
    "# Release Owner Evidence Package Status",
    "",
    `Generated at: ${report.generatedAt}`,
    "",
    "This status is generated from `reports/release-owner-evidence-runbook-report.json` and `reports/release-evidence-intake-status-report.json`.",
    "It tracks owner evidence packages. It does not create evidence or close release gates.",
    "",
    "## Summary",
    "",
    `- status: \`${report.status}\``,
    `- packages: ${report.summary.completePackageCount}/${report.summary.packageCount} complete`,
    `- missing owner inputs: ${report.summary.missingOwnerInputCount}`,
    `- present owner inputs: ${report.summary.presentOwnerInputCount}`,
    `- release gate claim: \`${report.summary.releaseGateClaim}\``,
    "",
    "## Packages",
    "",
    "| Package | Status | Missing | Present | Blocked/failing |",
    "| --- | --- | ---: | ---: | ---: |"
  ];

  for (const record of report.packageRecords) {
    lines.push(
      `| ${record.title} | \`${record.status}\` | ${record.missingInputCount} | ${record.presentInputCount} | ${record.blockedOrFailingEvidenceCount} |`
    );
  }

  for (const record of report.packageRecords) {
    lines.push("", `## ${record.title}`, "");
    lines.push(`Status: \`${record.status}\``);
    lines.push("");
    for (const evidence of record.evidence) {
      lines.push(
        `- \`${evidence.path}\`: \`${evidence.intakeStatus}\`; templates ${evidence.templateCount}; commands ${evidence.relatedCommands
          .map((command) => `\`${command}\``)
          .join(", ")}`
      );
    }
  }

  lines.push("", "## Non-Claims", "");
  for (const nonClaim of report.nonClaims) {
    lines.push(`- ${nonClaim}`);
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
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
      `Generated package status contains sensitive material: ${sensitive}`
    );
  }
}
