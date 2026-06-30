#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { format, resolveConfig } from "prettier";

const ownerGateReportPath = "reports/release-owner-gate-actions-report.json";
const markdownPath = "docs/RELEASE_OWNER_ACTION_RUNBOOK.md";
const reportPath = "reports/release-owner-action-runbook-report.json";
const samplePath =
  "docs/examples/release-owner-action-runbook-report.sample.json";
const generatedAt = "2026-06-23T00:00:00.000Z";

run("pnpm", ["release:owner-gates"]);

const ownerGateReport = JSON.parse(await readFile(ownerGateReportPath, "utf8"));
assertOwnerGateReport(ownerGateReport);

const phases = buildPhases(ownerGateReport.openGates);
const runbookReport = {
  schemaVersion: 1,
  generatedBy: "searchlint-release-owner-action-runbook-generator",
  generatedAt,
  sourceReportPath: ownerGateReportPath,
  status: "generated",
  checklist: ownerGateReport.source,
  releaseReadiness: ownerGateReport.releaseReadiness,
  actionability: ownerGateReport.actionability,
  phaseCount: phases.length,
  openGateCount: ownerGateReport.openGates.length,
  phases: phases.map((phase) => ({
    id: phase.id,
    title: phase.title,
    description: phase.description,
    gateCount: phase.gates.length,
    gateTypes: [...new Set(phase.gates.map((gate) => gate.gateType))]
  })),
  nonClaims: [
    "This runbook does not close release gates.",
    "This runbook does not provide owner, legal, reviewer, deployed, live provider, publication, or final release evidence.",
    "Checklist items remain open until their required evidence exists and the relevant verifier passes."
  ]
};

assertRunbookCoverage(phases, ownerGateReport.openGates);
assertNoSensitiveValues(JSON.stringify(runbookReport));

await writeMarkdown(markdownPath, renderRunbook(ownerGateReport, phases));
await writeJson(reportPath, runbookReport);
await writeJson(samplePath, runbookReport);

console.log(
  `Release owner action runbook generated: ${ownerGateReport.openGates.length} open gate(s), ${phases.length} phase(s)`
);
console.log(`Runbook: ${markdownPath}`);
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
      "Owner-gate report actionability must pass before runbook generation."
    );
  }
  if (!Array.isArray(report.openGates)) {
    throw new Error("Owner-gate report must include openGates.");
  }
}

function buildPhases(gates) {
  const phaseDefinitions = [
    {
      id: "01-reviewer-rule-quality",
      title: "Reviewer And Rule Quality Gates",
      description:
        "Complete OD-023 delivery, independent reviewer files, adjudication, and final rule-quality confirmation.",
      gateTypes: [
        "independent_reviewer_delivery_gate",
        "independent_reviewer_gate",
        "rule_quality_final_gate"
      ]
    },
    {
      id: "02-governance-legal-repository",
      title: "Governance Legal And Repository Gates",
      description:
        "Finish legal approval and hosted GitHub/repository governance before publication or public launch.",
      gateTypes: ["legal_owner_gate", "hosted_github_governance_gate"]
    },
    {
      id: "03-local-publication-surfaces",
      title: "npm And VS Code Publication Gates",
      description:
        "Complete public package metadata, npm publication, Marketplace publisher, and extension publication evidence.",
      gateTypes: ["npm_publication_gate", "vscode_marketplace_gate"]
    },
    {
      id: "04-production-platform",
      title: "Production Platform Gates",
      description:
        "Deploy and verify cloud runtime, storage, database, API, workers, auth, dashboard, observability, backup, and agency surfaces.",
      gateTypes: ["production_deployment_gate"]
    },
    {
      id: "05-live-provider-acceptance",
      title: "Live Provider Acceptance Gates",
      description:
        "Run live Google, Yandex, PageSpeed/CrUX, Stripe, notification, and related provider acceptance.",
      gateTypes: ["live_provider_acceptance_gate"]
    },
    {
      id: "06-accessibility-security-website",
      title: "Accessibility Security And Website Gates",
      description:
        "Complete manual accessibility, DAST, penetration testing, security gates, and deployed public website evidence.",
      gateTypes: [
        "manual_accessibility_review_gate",
        "external_security_review_gate",
        "deployed_public_website_gate"
      ]
    },
    {
      id: "07-final-release",
      title: "Final Release Gates",
      description:
        "Run final RC, tag, and publication only after every prerequisite gate has evidence.",
      gateTypes: ["final_release_action_gate"]
    }
  ];

  const assigned = new Set();
  const phases = phaseDefinitions.map((phase) => {
    const phaseGates = gates.filter((gate, index) => {
      if (!phase.gateTypes.includes(gate.gateType)) return false;
      assigned.add(index);
      return true;
    });
    return { ...phase, gates: phaseGates };
  });

  const unassigned = gates.filter((_, index) => !assigned.has(index));
  if (unassigned.length > 0) {
    throw new Error(
      `Runbook phase mapping missed ${unassigned.length} gate(s): ${unassigned
        .map((gate) => `${gate.section} / ${gate.item}`)
        .join("; ")}`
    );
  }

  return phases.filter((phase) => phase.gates.length > 0);
}

function assertRunbookCoverage(phases, gates) {
  const flattened = phases.flatMap((phase) => phase.gates);
  if (flattened.length !== gates.length) {
    throw new Error(
      `Runbook coverage mismatch: ${flattened.length} rendered, ${gates.length} expected.`
    );
  }
  const seen = new Set();
  for (const gate of flattened) {
    const key = `${gate.section}\n${gate.item}`;
    if (seen.has(key)) {
      throw new Error(`Duplicate runbook gate: ${gate.section} / ${gate.item}`);
    }
    seen.add(key);
  }
}

function renderRunbook(report, phases) {
  const lines = [
    "# Release Owner Action Runbook",
    "",
    "Status date: 2026-06-23",
    "",
    "This runbook is generated from `reports/release-owner-gate-actions-report.json`.",
    "It groups the remaining SearchLint 1.0 gates by practical execution phase.",
    "",
    "It does not close any gate and does not provide owner, legal, reviewer, deployed, live provider, publication, or final release evidence.",
    "",
    "## Orchestration Board",
    "",
    "Use `docs/RELEASE_EVIDENCE_CONTROL_BOARD.md` for the current owner-routing board across release evidence issues `#19` through `#25`, including packet checksums, dispatch packet references, priority order, and forbidden release actions.",
    "",
    "## Current Count",
    "",
    `- checked: ${report.source.checkedItems}`,
    `- open: ${report.source.openItems}`,
    `- total: ${report.source.totalItems}`,
    `- actionability: ${report.actionability.status}`,
    "",
    "## How To Use",
    "",
    "1. Start with phase 1 and work downward unless an owner explicitly chooses a parallel track.",
    "2. For each gate, produce the listed evidence paths and run the related command.",
    "3. Mark a master-checklist item complete only after direct evidence exists and the relevant verifier passes.",
    "4. Regenerate this runbook after every completed external gate.",
    "",
    "## Phase Summary",
    "",
    "| Phase | Gates | Gate types |",
    "| --- | ---: | --- |",
    ...phases.map(
      (phase) =>
        `| ${phase.title} | ${phase.gates.length} | ${[
          ...new Set(phase.gates.map((gate) => gate.gateType))
        ].join(", ")} |`
    ),
    ""
  ];

  for (const phase of phases) {
    lines.push(`## ${phase.title}`);
    lines.push("");
    lines.push(phase.description);
    lines.push("");
    lines.push(`Open gates: ${phase.gates.length}`);
    lines.push("");
    for (const [index, gate] of phase.gates.entries()) {
      lines.push(`### ${index + 1}. ${gate.section} - ${gate.item}`);
      lines.push("");
      lines.push(`- gate type: \`${gate.gateType}\``);
      lines.push(`- command: \`${gate.relatedCommand}\``);
      lines.push(`- required evidence: ${gate.requiredEvidence}`);
      lines.push(`- next owner action: ${gate.nextOwnerAction}`);
      lines.push("- evidence paths:");
      for (const evidencePath of gate.evidencePaths) {
        lines.push(`  - \`${evidencePath}\``);
      }
      lines.push("");
    }
  }

  lines.push("## Non-Claims");
  lines.push("");
  lines.push("- SearchLint 1.0 is not release-ready.");
  lines.push(
    "- This runbook does not publish npm packages or the VS Code extension."
  );
  lines.push(
    "- This runbook does not deploy the cloud platform or call live providers."
  );
  lines.push(
    "- This runbook does not replace legal, reviewer, security, or owner approval."
  );
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
      `Sensitive value leaked into owner action runbook: ${match}`
    );
  }
}
