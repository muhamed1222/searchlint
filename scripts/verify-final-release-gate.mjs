#!/usr/bin/env node
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { format } from "prettier";

const reportPath = "reports/final-release-gate-report.json";
const samplePath = "docs/examples/final-release-gate-report.sample.json";
const rcMatrixSamplePath =
  "docs/examples/searchlint-1-0-rc-matrix-report.sample.json";
const evidenceReadinessReportPath =
  "reports/release-evidence-readiness-summary-report.json";
const ownerGateReportPath = "reports/release-owner-gate-actions-report.json";
const evidenceReadinessSamplePath =
  "docs/examples/release-evidence-readiness-summary-report.sample.json";
const hostedGithubGovernanceReportPath =
  "reports/hosted-github-governance-evidence-report.json";
const hostedGithubGovernanceEvidencePath =
  "docs/github/hosted-governance-evidence.json";
const branchProtectionPayloadPath = "docs/github/branch-protection-main.json";

const requiredDocuments = [
  "docs/SEARCHLINT_1_0_FINAL_RELEASE_GATE.md",
  "docs/SEARCHLINT_1_0_RELEASE_CANDIDATE_MATRIX.md",
  "docs/RELEASE_EVIDENCE_READINESS_SUMMARY.md",
  "docs/PACKAGE_PUBLICATION_READINESS.md",
  "docs/VSCODE_LSP_USAGE.md",
  "docs/PUBLIC_WEBSITE_ONBOARDING.md",
  "docs/ONBOARDING_FINAL_READINESS.md",
  "docs/LEGAL_RELEASE_GATE_CHECKLIST.md",
  "docs/PUBLIC_PRIVATE_REPOSITORY_BOUNDARY_PLAN.md",
  "docs/SECURITY_PRIVACY_RELEASE_GATE.md",
  "docs/CURRENT_PRODUCT_STATUS.md",
  "docs/SEARCHLINT_1_0_MASTER_CHECKLIST.md",
  rcMatrixSamplePath,
  evidenceReadinessSamplePath
];

const requiredEvidence = [
  gate(
    "evidence-readiness",
    "blocked",
    ["docs/RELEASE_EVIDENCE_READINESS_SUMMARY.md", evidenceReadinessSamplePath],
    ["aggregate release evidence readiness is blocked on external evidence"]
  ),
  gate(
    "reviewer-signoff",
    "missing",
    [],
    ["two real independent blocker-benchmark reviewer files are missing"]
  ),
  gate(
    "rule-qa-final",
    "blocked",
    ["docs/reviews/blocker-benchmark/README.md"],
    ["pnpm rule-qa:review cannot pass until reviewer sign-off exists"]
  ),
  gate(
    "legal-review",
    "blocked",
    ["docs/LEGAL_RELEASE_GATE_CHECKLIST.md"],
    ["qualified legal approval is missing"]
  ),
  gate(
    "repository-boundary",
    "blocked",
    [
      "docs/PUBLIC_PRIVATE_REPOSITORY_BOUNDARY_PLAN.md",
      "docs/examples/public-repository-boundary-report.sample.json"
    ],
    [
      "actual public/private repository split and owner/legal sign-off are missing"
    ]
  ),
  gate(
    "branch-protection-ci",
    "missing",
    [],
    [
      "protected branch and required hosted CI checks are not configured evidence"
    ]
  ),
  gate(
    "npm-publication",
    "blocked",
    ["docs/PACKAGE_PUBLICATION_READINESS.md"],
    [
      "trusted publishing, approved URLs, beta/final publication, and registry install are missing"
    ]
  ),
  gate(
    "vscode-marketplace",
    "blocked",
    ["docs/VSCODE_LSP_USAGE.md"],
    ["Marketplace publication and clean install evidence are missing"]
  ),
  gate(
    "public-website-docs",
    "blocked",
    ["docs/PUBLIC_WEBSITE_ONBOARDING.md"],
    ["deployed public website/docs and final copy approval are missing"]
  ),
  gate(
    "onboarding-source",
    "present",
    [
      "docs/ONBOARDING_FINAL_READINESS.md",
      "docs/examples/onboarding-source-final-report.sample.json"
    ],
    []
  ),
  gate(
    "zero-production-impact",
    "present",
    [
      "docs/ZERO_PRODUCTION_IMPACT_FINAL_GATE.md",
      "docs/examples/zero-production-impact-final-report.sample.json"
    ],
    []
  ),
  gate(
    "live-cloud",
    "blocked",
    ["docs/SEARCHLINT_1_0_RELEASE_CANDIDATE_MATRIX.md"],
    ["live AWS/RDS/API/SQS/S3/Cognito/OAuth/dashboard evidence is missing"]
  ),
  gate(
    "live-search-integrations",
    "blocked",
    [
      "docs/GOOGLE_SEARCH_CONSOLE_ACCEPTANCE.md",
      "docs/GOOGLE_PERFORMANCE_ACCEPTANCE.md",
      "docs/YANDEX_ACCEPTANCE.md"
    ],
    ["live Google/Yandex/PageSpeed/CrUX provider acceptance is missing"]
  ),
  gate(
    "live-billing",
    "blocked",
    ["docs/BILLING_ACCEPTANCE.md"],
    ["live Stripe acceptance is missing"]
  ),
  gate(
    "reports",
    "present",
    [
      "docs/REPORTS_FINAL_READINESS.md",
      "docs/examples/reports-final-readiness-report.sample.json"
    ],
    []
  ),
  gate(
    "documentation",
    "present",
    [
      "docs/DOCUMENTATION_FINAL_READINESS.md",
      "docs/examples/documentation-final-readiness-report.sample.json"
    ],
    []
  ),
  gate(
    "security-audit",
    "blocked",
    ["docs/SECURITY_PRIVACY_RELEASE_GATE.md"],
    ["DAST, penetration test, and security approval are missing"]
  ),
  gate(
    "final-rc",
    "blocked",
    ["docs/SEARCHLINT_1_0_RELEASE_CANDIDATE_MATRIX.md", rcMatrixSamplePath],
    ["final RC matrix remains blocked"]
  ),
  gate("git-tag-v1.0.0", "missing", [], ["local Git tag v1.0.0 is absent"]),
  gate(
    "public-release",
    "missing",
    [],
    ["SearchLint 1.0 public release evidence is absent"]
  )
];

async function main() {
  await writeFinalReleasePreflightReport();
  run("pnpm", ["release:evidence-readiness"]);
  replaceRequiredEvidenceGate(
    "branch-protection-ci",
    await buildBranchProtectionCiGate()
  );

  await verifyRequiredDocuments();
  await verifyEvidenceFiles();

  const rcMatrix = await readJson(rcMatrixSamplePath);
  const evidenceReadiness = await readJson(evidenceReadinessReportPath);
  const ownerGateReport = await readJson(ownerGateReportPath);
  verifyEvidenceReadiness(evidenceReadiness);
  verifyOwnerGateReport(ownerGateReport, evidenceReadiness);
  if (rcMatrix.status !== "blocked") {
    throw new Error(
      `Expected RC matrix sample to be blocked, received ${JSON.stringify(
        rcMatrix.status
      )}.`
    );
  }

  const blockedGateCount = Number(rcMatrix.summary?.blockedCount);
  if (!Number.isInteger(blockedGateCount) || blockedGateCount <= 0) {
    throw new Error("RC matrix sample does not report blocked gates.");
  }

  const tag = inspectLocalTag("v1.0.0");
  if (tag.exists) {
    throw new Error(
      "Local Git tag v1.0.0 already exists while final release gate is blocked."
    );
  }

  const summary = summarize(requiredEvidence);
  const report = {
    generatedBy: "searchlint-1-0-final-release-gate-verifier",
    generatedAt: "2026-06-22T00:00:00.000Z",
    releaseVersion: "1.0.0",
    status: "blocked",
    verdict: "SearchLint 1.0 must not be tagged or published yet.",
    tag,
    rcMatrix: {
      status: rcMatrix.status,
      gateCount: rcMatrix.summary?.gateCount,
      evidencePresentCount: rcMatrix.summary?.evidencePresentCount,
      blockedGateCount
    },
    evidenceReadiness: {
      status: evidenceReadiness.status,
      checkedItemCount: evidenceReadiness.summary?.checkedItemCount,
      totalItemCount: evidenceReadiness.summary?.totalItemCount,
      openGateCount: evidenceReadiness.summary?.openGateCount,
      expectedOwnerEvidenceCount:
        evidenceReadiness.summary?.expectedOwnerEvidenceCount,
      realOwnerEvidenceCount: evidenceReadiness.summary?.realOwnerEvidenceCount,
      missingOwnerInputCount: evidenceReadiness.summary?.missingOwnerInputCount,
      templateCoveredOwnerInputCount:
        evidenceReadiness.summary?.templateCoveredOwnerInputCount,
      releaseGateClaim: evidenceReadiness.summary?.releaseGateClaim
    },
    summary,
    requiredEvidence,
    forbiddenActions: [
      "git tag v1.0.0",
      "npm publish",
      "vsce publish",
      "public website release",
      "SearchLint 1.0 announcement"
    ],
    requiredFutureCommands: requiredFutureCommands(ownerGateReport)
  };

  assertNoSensitiveValues(JSON.stringify(report));
  await mkdir(path.dirname(reportPath), { recursive: true });
  await mkdir(path.dirname(samplePath), { recursive: true });
  await writeJson(reportPath, report);
  await writeJson(samplePath, report);
  run("pnpm", ["release:evidence-readiness"]);

  console.log(
    `SearchLint 1.0 final release gate BLOCKED: ${summary.blockedOrMissingCount}/${summary.gateCount} final gate(s) remain blocked or missing`
  );
  console.log("No v1.0.0 tag was created.");
  console.log(`Report: ${reportPath}`);
  console.log(`Sample: ${samplePath}`);
}

function gate(id, status, evidenceFiles, blockers) {
  return { id, status, evidenceFiles, blockers };
}

async function writeFinalReleasePreflightReport() {
  const report = {
    generatedBy: "searchlint-1-0-final-release-gate-verifier",
    generatedAt: "2026-06-22T00:00:00.000Z",
    releaseVersion: "1.0.0",
    status: "blocked",
    verdict:
      "SearchLint 1.0 final release gate is running; release remains blocked until the complete report is written.",
    preflight: true,
    nonClaims: [
      "This preflight report exists only so release evidence readiness can evaluate the final gate report path during a fresh final-release run.",
      "This preflight report does not close release gates.",
      "This preflight report does not authorize tagging, publishing, marketplace release, public website release, or launch announcement."
    ]
  };

  assertNoSensitiveValues(JSON.stringify(report));
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeJson(reportPath, report);
}

async function buildBranchProtectionCiGate() {
  const result = spawnSync("pnpm", ["governance:hosted-github-evidence"], {
    cwd: process.cwd(),
    env: process.env,
    encoding: "utf8",
    stdio: "inherit"
  });

  if (result.status !== 0) {
    return gate(
      "branch-protection-ci",
      "blocked",
      [hostedGithubGovernanceEvidencePath, branchProtectionPayloadPath],
      [
        "hosted GitHub governance evidence did not pass validation; run pnpm governance:hosted-github-evidence for details"
      ]
    );
  }

  const report = await readJson(hostedGithubGovernanceReportPath);
  if (report.status !== "passed") {
    return gate(
      "branch-protection-ci",
      "blocked",
      [
        hostedGithubGovernanceEvidencePath,
        branchProtectionPayloadPath,
        hostedGithubGovernanceReportPath
      ],
      [
        "hosted GitHub governance evidence report is not passed",
        ...failureMessages(report.failures)
      ]
    );
  }

  if (
    report.releaseGates?.protectedBranchConfigured !== true ||
    report.releaseGates?.requiredCiChecksConfigured !== true
  ) {
    return gate(
      "branch-protection-ci",
      "blocked",
      [
        hostedGithubGovernanceEvidencePath,
        branchProtectionPayloadPath,
        hostedGithubGovernanceReportPath
      ],
      [
        "hosted GitHub governance evidence does not close both protected branch and required CI gates"
      ]
    );
  }

  return gate(
    "branch-protection-ci",
    "present",
    [
      hostedGithubGovernanceEvidencePath,
      branchProtectionPayloadPath,
      hostedGithubGovernanceReportPath
    ],
    []
  );
}

function replaceRequiredEvidenceGate(id, replacement) {
  const index = requiredEvidence.findIndex((item) => item.id === id);
  if (index === -1) {
    throw new Error(`Unable to replace missing final release gate ${id}.`);
  }
  requiredEvidence[index] = replacement;
}

function failureMessages(failures) {
  if (!Array.isArray(failures)) {
    return [];
  }
  return failures.map((failure) => {
    const code = failure.code ?? "unknown_failure";
    const message = failure.message ?? "No failure message provided.";
    return `${code}: ${message}`;
  });
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env: process.env,
    encoding: "utf8",
    stdio: "inherit"
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed.`);
  }
}

function summarize(gates) {
  const blockedOrMissingCount = gates.filter((item) =>
    ["blocked", "missing"].includes(item.status)
  ).length;
  const presentCount = gates.filter((item) => item.status === "present").length;
  return {
    gateCount: gates.length,
    presentCount,
    blockedOrMissingCount,
    releaseBlockerCount: blockedOrMissingCount
  };
}

function verifyEvidenceReadiness(report) {
  if (report.status !== "blocked_external_evidence") {
    throw new Error(
      `Expected evidence readiness to be blocked_external_evidence, received ${JSON.stringify(report.status)}.`
    );
  }
  if (
    report.summary?.openGateCount + report.summary?.checkedItemCount !==
    report.summary?.totalItemCount
  ) {
    throw new Error("Evidence readiness checklist counts are inconsistent.");
  }
  if (
    report.summary?.templateCoveredOwnerInputCount !==
    report.summary?.expectedOwnerEvidenceCount
  ) {
    throw new Error(
      "Evidence readiness must report template coverage for every owner evidence file."
    );
  }
  if (report.summary?.realOwnerEvidenceCount !== 0) {
    throw new Error(
      "Evidence readiness must report 0 real owner evidence files for the current blocked release state."
    );
  }
  if (report.summary?.releaseGateClaim !== "not_claimed") {
    throw new Error("Evidence readiness must not claim release gates.");
  }
}

function verifyOwnerGateReport(report, evidenceReadiness) {
  if (!Array.isArray(report.openGates)) {
    throw new Error("Owner gate report must include openGates.");
  }
  if (report.actionability?.status !== "passed") {
    throw new Error("Owner gate report actionability must pass.");
  }
  if (
    report.openGates.length !== evidenceReadiness.summary?.openGateCount ||
    report.source?.openItems !== evidenceReadiness.summary?.openGateCount
  ) {
    throw new Error(
      "Owner gate report open gates must match evidence readiness."
    );
  }
}

function requiredFutureCommands(ownerGateReport) {
  const commands = new Set([
    "pnpm release:evidence-readiness",
    "pnpm final-release:gate"
  ]);

  for (const gate of ownerGateReport.openGates) {
    if (typeof gate.relatedCommand === "string") {
      commands.add(gate.relatedCommand);
    }
  }

  return [...commands].sort((left, right) =>
    commandSortKey(left).localeCompare(commandSortKey(right))
  );
}

function commandSortKey(command) {
  if (command === "pnpm release:evidence-readiness") return "00";
  if (command === "pnpm final-release:gate") return "99";
  return `50:${command}`;
}

async function verifyRequiredDocuments() {
  for (const filePath of requiredDocuments) {
    await verifyNonEmptyFile(filePath);
  }
}

async function verifyEvidenceFiles() {
  const files = new Set(requiredEvidence.flatMap((item) => item.evidenceFiles));
  for (const filePath of files) {
    await verifyNonEmptyFile(filePath);
  }
}

async function verifyNonEmptyFile(filePath) {
  const info = await stat(filePath);
  if (!info.isFile()) {
    throw new Error(`${filePath} is not a file.`);
  }
  const text = await readFile(filePath, "utf8");
  if (text.trim().length === 0) {
    throw new Error(`${filePath} is empty.`);
  }
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function inspectLocalTag(name) {
  const result = spawnSync("git", ["tag", "--list", name], {
    encoding: "utf8"
  });
  if (result.status !== 0) {
    throw new Error(
      `Unable to inspect Git tags: ${result.stderr || result.stdout}`
    );
  }
  return {
    name,
    exists: result.stdout
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .includes(name),
    action: "not-created"
  };
}

function assertNoSensitiveValues(text) {
  const forbidden = [
    /private_key/i,
    /client-secret/i,
    /authorization:/i,
    /bearer\s+/i,
    /sk_live/i,
    /whsec_/i,
    /postgres:\/\/user/i,
    /-----BEGIN PRIVATE KEY-----/i,
    /ya29\./i
  ];
  const match = forbidden.find((pattern) => pattern.test(text));
  if (match) {
    throw new Error(
      `Sensitive value leaked into final release gate evidence: ${match}`
    );
  }
}

async function writeJson(filePath, data) {
  await writeFile(
    filePath,
    await format(JSON.stringify(data), { parser: "json" })
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
