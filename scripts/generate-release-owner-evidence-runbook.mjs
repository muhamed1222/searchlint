#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { format, resolveConfig } from "prettier";

const missingTemplateReportPath =
  "reports/release-missing-evidence-template-index-report.json";
const readinessReportPath =
  "reports/release-evidence-readiness-summary-report.json";
const markdownPath = "docs/RELEASE_OWNER_EVIDENCE_RUNBOOK.md";
const reportPath = "reports/release-owner-evidence-runbook-report.json";
const samplePath =
  "docs/examples/release-owner-evidence-runbook-report.sample.json";
const generatedAt = "2026-06-23T00:00:00.000Z";

run("pnpm", ["release:missing-evidence-templates"]);
run("pnpm", ["release:evidence-readiness"]);

const missingTemplateReport = JSON.parse(
  await readFile(missingTemplateReportPath, "utf8")
);
const readinessReport = JSON.parse(await readFile(readinessReportPath, "utf8"));

assertSourceReports(missingTemplateReport, readinessReport);

const entries = missingTemplateReport.entries.map(normalizeEntry);
const packages = buildPackages(entries);
const report = {
  schemaVersion: 1,
  generatedBy: "searchlint-release-owner-evidence-runbook-generator",
  generatedAt,
  status: "blocked_waiting_for_owner_evidence",
  sourceReports: {
    missingTemplateReportPath,
    readinessReportPath
  },
  checklist: {
    checkedItemCount: readinessReport.summary.checkedItemCount,
    openGateCount: readinessReport.summary.openGateCount,
    totalItemCount: readinessReport.summary.totalItemCount
  },
  summary: {
    missingOwnerInputCount: entries.length,
    packageCount: packages.length,
    entriesWithTemplateCount: entries.filter(
      (entry) => entry.templatePaths.length > 0
    ).length,
    entriesWithCommandCount: entries.filter(
      (entry) => entry.relatedCommands.length > 0
    ).length,
    realOwnerEvidenceCount: readinessReport.summary.realOwnerEvidenceCount,
    releaseGateClaim: readinessReport.summary.releaseGateClaim
  },
  packages: packages.map((evidencePackage) => ({
    id: evidencePackage.id,
    title: evidencePackage.title,
    description: evidencePackage.description,
    missingInputCount: evidencePackage.entries.length,
    relatedCommands: [
      ...new Set(
        evidencePackage.entries.flatMap((entry) => entry.relatedCommands)
      )
    ]
  })),
  entries,
  nonClaims: [
    "This runbook does not create owner evidence.",
    "This runbook does not close release gates.",
    "Templates and instructions are not release evidence.",
    "SearchLint 1.0 remains blocked until real owner, reviewer, legal, security, provider, deployment, publication, backup, and final release evidence exists and dedicated verifiers pass."
  ]
};

assertCoverage(report);
assertNoSensitiveValues(JSON.stringify(report));
await writeMarkdown(markdownPath, renderMarkdown(report, packages));
await writeJson(reportPath, report);
await writeJson(samplePath, report);

console.log(
  `Release owner evidence runbook generated: ${report.summary.missingOwnerInputCount} missing owner input(s), ${report.summary.packageCount} package(s)`
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

function assertSourceReports(missingTemplateReport, readinessReport) {
  if (missingTemplateReport.status !== "template_index_ready") {
    throw new Error("Missing evidence template index must be ready.");
  }
  if (
    missingTemplateReport.entries?.length !==
    missingTemplateReport.missingOwnerInputCount
  ) {
    throw new Error(
      `Missing evidence template index count mismatch: entries=${missingTemplateReport.entries?.length}, missingOwnerInputCount=${missingTemplateReport.missingOwnerInputCount}.`
    );
  }
  if (readinessReport.status !== "blocked_external_evidence") {
    throw new Error("Release evidence readiness must remain blocked.");
  }
  if (readinessReport.summary?.releaseGateClaim !== "not_claimed") {
    throw new Error("Release evidence readiness must not claim release gates.");
  }
}

function normalizeEntry(entry) {
  const relatedCommands = [
    ...new Set(
      entry.relatedGates.map((gate) => gate.relatedCommand).filter(Boolean)
    )
  ].sort();
  const gateTypes = [
    ...new Set(entry.relatedGates.map((gate) => gate.gateType).filter(Boolean))
  ].sort();
  return {
    missingEvidencePath: entry.missingEvidencePath,
    templatePaths: entry.availableTemplatePaths,
    relatedGateCount: entry.relatedGateCount,
    relatedCommands,
    gateTypes,
    ownerAction: entry.ownerAction,
    relatedGates: entry.relatedGates.map((gate) => ({
      section: gate.section,
      item: gate.item,
      gateType: gate.gateType,
      relatedCommand: gate.relatedCommand,
      requiredEvidence: gate.requiredEvidence,
      nextOwnerAction: gate.nextOwnerAction
    }))
  };
}

function buildPackages(entries) {
  const definitions = [
    {
      id: "01-reviewer-rule-quality",
      title: "Reviewer And Rule Quality",
      description:
        "Independent OD-023 reviewer delivery, review files, adjudication, and final rule quality evidence.",
      match: (entry) =>
        entry.gateTypes.some((type) =>
          [
            "independent_reviewer_delivery_gate",
            "independent_reviewer_gate",
            "rule_quality_final_gate"
          ].includes(type)
        )
    },
    {
      id: "02-governance-legal",
      title: "Governance And Legal",
      description:
        "Hosted GitHub governance and qualified legal approval evidence.",
      match: (entry) =>
        entry.gateTypes.some((type) =>
          ["hosted_github_governance_gate", "legal_owner_gate"].includes(type)
        )
    },
    {
      id: "03-publication",
      title: "npm And VS Code Publication",
      description:
        "npm package publication, final version, clean install, VS Code publisher, and Marketplace evidence.",
      match: (entry) =>
        entry.gateTypes.some((type) =>
          ["npm_publication_gate", "vscode_marketplace_gate"].includes(type)
        )
    },
    {
      id: "04-production-platform",
      title: "Production Platform",
      description:
        "Cloud runtime, database, object storage, API, workers, dashboard, backup, observability, and agency evidence.",
      match: (entry) => entry.gateTypes.includes("production_deployment_gate")
    },
    {
      id: "05-live-providers",
      title: "Live Provider Acceptance",
      description:
        "Live Google, Yandex, Stripe, notifications, and other provider acceptance evidence.",
      match: (entry) =>
        entry.gateTypes.includes("live_provider_acceptance_gate")
    },
    {
      id: "06-security-accessibility-website",
      title: "Security Accessibility And Website",
      description:
        "Manual accessibility, external security review, DAST, pentest, security gate, and public website evidence.",
      match: (entry) =>
        entry.gateTypes.some((type) =>
          [
            "manual_accessibility_review_gate",
            "external_security_review_gate",
            "deployed_public_website_gate"
          ].includes(type)
        )
    },
    {
      id: "07-final-release",
      title: "Final Release",
      description:
        "Final RC, git tag, and SearchLint 1.0 publication evidence.",
      match: (entry) => entry.gateTypes.includes("final_release_action_gate")
    }
  ];

  const assigned = new Set();
  const packages = definitions.map((definition) => {
    const packageEntries = entries.filter((entry, index) => {
      if (assigned.has(index) || !definition.match(entry)) return false;
      assigned.add(index);
      return true;
    });
    return {
      id: definition.id,
      title: definition.title,
      description: definition.description,
      entries: packageEntries
    };
  });

  const unassigned = entries.filter((_, index) => !assigned.has(index));
  if (unassigned.length > 0) {
    throw new Error(
      `Owner evidence runbook missed ${unassigned.length} input(s): ${unassigned
        .map((entry) => entry.missingEvidencePath)
        .join(", ")}`
    );
  }

  return packages.filter((item) => item.entries.length > 0);
}

function assertCoverage(report) {
  if (report.entries.length !== report.summary.missingOwnerInputCount) {
    throw new Error(
      `Owner evidence runbook count mismatch: entries=${report.entries.length}, missingOwnerInputCount=${report.summary.missingOwnerInputCount}.`
    );
  }
  if (
    report.summary.entriesWithTemplateCount !==
    report.summary.missingOwnerInputCount
  ) {
    throw new Error("Every missing owner input must have template coverage.");
  }
  if (
    report.summary.entriesWithCommandCount !==
    report.summary.missingOwnerInputCount
  ) {
    throw new Error("Every missing owner input must have related commands.");
  }
  if (report.summary.realOwnerEvidenceCount !== 0) {
    throw new Error(
      "Current blocked state must still have 0 real owner evidence files."
    );
  }
}

function renderMarkdown(report, packages) {
  const lines = [
    "# Release Owner Evidence Runbook",
    "",
    `Generated at: ${report.generatedAt}`,
    "",
    "This runbook aggregates missing owner evidence inputs from `reports/release-missing-evidence-template-index-report.json`. It does not create evidence and it does not close release gates.",
    "",
    "## Orchestration Board",
    "",
    "Use `docs/RELEASE_EVIDENCE_CONTROL_BOARD.md` to route these missing owner inputs to the active GitHub release-evidence issues, handoff packets, and dispatch instructions. The board is an orchestration document only; it does not replace the real owner inputs listed below.",
    "",
    "## Summary",
    "",
    `- status: \`${report.status}\``,
    `- checklist: ${report.checklist.checkedItemCount}/${report.checklist.totalItemCount} done; ${report.checklist.openGateCount} remaining`,
    `- missing owner inputs: ${report.summary.missingOwnerInputCount}`,
    `- evidence packages: ${report.summary.packageCount}`,
    `- real owner evidence files: ${report.summary.realOwnerEvidenceCount}`,
    `- release gate claim: \`${report.summary.releaseGateClaim}\``,
    "",
    "## Package Summary",
    "",
    "| Package | Missing inputs | Related commands |",
    "| --- | ---: | --- |"
  ];

  for (const evidencePackage of packages) {
    const commands = [
      ...new Set(
        evidencePackage.entries.flatMap((entry) => entry.relatedCommands)
      )
    ]
      .map((command) => `\`${command}\``)
      .join("<br>");
    lines.push(
      `| ${evidencePackage.title} | ${evidencePackage.entries.length} | ${commands} |`
    );
  }

  for (const evidencePackage of packages) {
    lines.push(
      "",
      `## ${evidencePackage.title}`,
      "",
      evidencePackage.description,
      ""
    );
    for (const entry of evidencePackage.entries) {
      lines.push(`### ${entry.missingEvidencePath}`, "");
      lines.push(
        `- templates: ${entry.templatePaths.map((item) => `\`${item}\``).join(", ")}`
      );
      lines.push(
        `- related commands: ${entry.relatedCommands.map((item) => `\`${item}\``).join(", ")}`
      );
      lines.push(`- related gate count: ${entry.relatedGateCount}`);
      lines.push(`- owner action: ${entry.ownerAction}`);
      lines.push("");
    }
  }

  lines.push("## Non-Claims", "");
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
      `Generated runbook contains sensitive material: ${sensitive}`
    );
  }
}
