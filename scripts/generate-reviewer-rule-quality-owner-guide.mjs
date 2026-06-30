#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { format } from "prettier";

const handoffManifestPath =
  "docs/reviews/blocker-benchmark/HANDOFF_MANIFEST.json";
const packageGateReportPath =
  "reports/reviewer-rule-quality-package-gate-report.json";
const markdownPath = "docs/REVIEWER_RULE_QUALITY_OWNER_INPUT_GUIDE.md";
const reportPath =
  "reports/reviewer-rule-quality-owner-input-guide-report.json";
const samplePath =
  "docs/examples/reviewer-rule-quality-owner-input-guide-report.sample.json";
const generatedAt = "2026-06-23T00:00:00.000Z";

await ensureReport(handoffManifestPath, "pnpm", ["rule-qa:review-handoff"], {
  allowFailure: false
});
await ensureReport(
  packageGateReportPath,
  "pnpm",
  ["release:reviewer-rule-quality-package"],
  { allowFailure: true }
);
const handoff = await readJson(handoffManifestPath);
const packageGate = await readJson(packageGateReportPath);
const requiredInputs = [
  {
    path: "docs/reviews/blocker-benchmark/DELIVERY_EVIDENCE.json",
    templatePath:
      "docs/reviews/blocker-benchmark/DELIVERY_EVIDENCE.example.json",
    owner: "project owner",
    purpose:
      "Records that the benchmark packet was delivered to two independent reviewers without claiming reviewer approval.",
    validationCommand: "pnpm rule-qa:review-delivery"
  },
  {
    path: "docs/reviews/blocker-benchmark/reviewer-1.review.json",
    templatePath:
      "docs/reviews/blocker-benchmark/reviewer-1.review.example.json",
    owner: "independent reviewer 1",
    purpose:
      "Records independent reviewer 1 expected-result confirmation for every benchmark case.",
    validationCommand: "pnpm rule-qa:review"
  },
  {
    path: "docs/reviews/blocker-benchmark/reviewer-2.review.json",
    templatePath:
      "docs/reviews/blocker-benchmark/reviewer-2.review.example.json",
    owner: "independent reviewer 2",
    purpose:
      "Records independent reviewer 2 expected-result confirmation for every benchmark case.",
    validationCommand: "pnpm rule-qa:review"
  }
];

const missingRequiredInputs = requiredInputs.filter((input) =>
  packageGate.missingEvidencePaths.includes(input.path)
);
const guide = {
  schemaVersion: 1,
  generatedBy: "searchlint-reviewer-rule-quality-owner-guide-generator",
  generatedAt,
  status:
    missingRequiredInputs.length === 0
      ? "owner_inputs_present"
      : "owner_input_required",
  packageId: packageGate.packageId,
  packageTitle: packageGate.packageTitle,
  sourceReports: {
    handoffManifestPath,
    packageGateReportPath
  },
  benchmark: {
    benchmarkVersion: handoff.benchmark.benchmarkVersion,
    expectedCaseCount: handoff.benchmark.expectedCaseCount,
    positiveCaseCount: handoff.benchmark.positiveCaseCount,
    negativeCaseCount: handoff.benchmark.negativeCaseCount,
    caseIndexPath: handoff.benchmark.caseIndexPath,
    caseIndexSha256: handoff.benchmark.caseIndexSha256,
    blockerRuleIds: handoff.blockerRuleIds
  },
  requiredPacketFiles: [
    handoffManifestPath,
    handoff.benchmark.caseIndexPath,
    ...handoff.requiredPacketFiles
  ],
  requiredInputs,
  missingRequiredInputPaths: missingRequiredInputs.map((input) => input.path),
  validationCommands: [
    "pnpm rule-qa:review-delivery",
    "pnpm rule-qa:review",
    "pnpm release:reviewer-rule-quality-package",
    "pnpm release:evidence-readiness"
  ],
  ownerProcedure: [
    "Run pnpm release:reviewer-rule-quality-owner-guide to refresh this guide.",
    "Send every required packet file to two independent reviewers.",
    "Create DELIVERY_EVIDENCE.json from its example template using real delivery details.",
    "Replace default deliveryChannel, reviewerDisplayName, independenceStatement, and ownerAttestation.signedStatement values.",
    "Collect reviewer-1.review.json and reviewer-2.review.json from the independent reviewers.",
    "Do not copy example signedStatement values into real evidence.",
    "Run pnpm rule-qa:review-delivery and pnpm rule-qa:review.",
    "Resolve rejected, disputed, or conflicting cases before claiming OD-023 complete.",
    "Run pnpm release:reviewer-rule-quality-package and pnpm release:evidence-readiness."
  ],
  reviewerProcedure: [
    "Use BENCHMARK_CASE_INDEX.json as the review case list.",
    "Do not use training fixtures as the basis for approval.",
    "Put every reviewed case ID in exactly one of approvedCaseIds, rejectedCaseIds, or disputedCaseIds.",
    "Set reviewedCaseCount to the full expected case count.",
    "Use the current benchmarkVersion from the handoff manifest.",
    "Write a real signedStatement that does not contain example-only language."
  ],
  nonClaims: [
    "This guide does not create delivery evidence.",
    "This guide does not create reviewer sign-off.",
    "Example JSON files are templates only.",
    "Codex is not an independent reviewer for OD-023.",
    "SearchLint 1.0 remains blocked while owner/reviewer inputs are missing."
  ]
};

assertNoSensitiveValues(JSON.stringify(guide));
await writeMarkdown(markdownPath, renderMarkdown(guide));
await writeJson(reportPath, guide);
await writeJson(samplePath, guide);

console.log(
  `Reviewer rule-quality owner input guide generated: ${missingRequiredInputs.length}/${requiredInputs.length} required input(s) missing`
);
console.log(`Document: ${markdownPath}`);
console.log(`Report: ${reportPath}`);
console.log(`Sample: ${samplePath}`);

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function ensureReport(filePath, command, args, { allowFailure }) {
  try {
    await access(filePath);
  } catch {
    try {
      execFileSync(command, args, {
        cwd: process.cwd(),
        env: process.env,
        stdio: "inherit"
      });
    } catch (error) {
      if (!allowFailure) {
        throw error;
      }
    }
    await access(filePath);
  }
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
    "# Reviewer Rule Quality Owner Input Guide",
    "",
    `Generated at: ${report.generatedAt}`,
    "",
    "This guide covers the first critical-path owner evidence package:",
    `\`${report.packageId}\` (${report.packageTitle}). It is a completion guide only; it does not create or imply reviewer sign-off.`,
    "",
    "## Current Status",
    "",
    `- status: \`${report.status}\``,
    `- missing required inputs: ${report.missingRequiredInputPaths.length}/${report.requiredInputs.length}`,
    `- benchmark version: \`${report.benchmark.benchmarkVersion}\``,
    `- benchmark cases: ${report.benchmark.expectedCaseCount} (${report.benchmark.positiveCaseCount} positive, ${report.benchmark.negativeCaseCount} negative)`,
    `- case index SHA-256: \`${report.benchmark.caseIndexSha256}\``,
    "",
    "## Required Inputs",
    "",
    "| Required file | Owner | Template | Validation | Status |",
    "| --- | --- | --- | --- | --- |"
  ];

  for (const input of report.requiredInputs) {
    const status = report.missingRequiredInputPaths.includes(input.path)
      ? "missing"
      : "present";
    lines.push(
      `| \`${input.path}\` | ${input.owner} | \`${input.templatePath}\` | \`${input.validationCommand}\` | \`${status}\` |`
    );
  }

  lines.push("", "## Required Packet Files", "");
  for (const filePath of report.requiredPacketFiles) {
    lines.push(`- \`${filePath}\``);
  }

  lines.push("", "## Blocker Rules Under Review", "");
  lines.push(
    report.benchmark.blockerRuleIds.map((ruleId) => `\`${ruleId}\``).join(", ")
  );

  lines.push("", "## Owner Procedure", "");
  for (const step of report.ownerProcedure) {
    lines.push(`- ${step}`);
  }

  lines.push("", "## Reviewer Procedure", "");
  for (const step of report.reviewerProcedure) {
    lines.push(`- ${step}`);
  }

  lines.push("", "## Validation Commands", "");
  for (const command of report.validationCommands) {
    lines.push(`- \`${command}\``);
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
      `Generated guide contains sensitive material: ${sensitive}`
    );
  }
}
