#!/usr/bin/env node
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { format } from "prettier";

const approvalPath = "docs/legal-release-approval.json";
const examplePath = "docs/legal-release-approval.example.json";
const reportPath = "reports/legal-release-approval-report.json";
const samplePath = "docs/examples/legal-release-approval-report.sample.json";
const generatedAt = "2026-06-23T00:00:00.000Z";

const requiredFiles = [
  "LICENSE",
  "NOTICE",
  "CONTRIBUTING.md",
  "DCO.md",
  "SECURITY.md",
  "docs/TRADEMARK_POLICY_DRAFT.md",
  "docs/RELEASE_GOVERNANCE.md",
  "docs/PACKAGE_PUBLIC_PRIVATE_MATRIX.md",
  "docs/PUBLIC_PRIVATE_REPOSITORY_BOUNDARY_PLAN.md",
  "docs/PACKAGE_PUBLICATION_READINESS.md",
  "docs/PACKAGE_DOCUMENTATION.md",
  "docs/VSCODE_LSP_USAGE.md",
  "docs/PUBLIC_WEBSITE_ONBOARDING.md",
  "docs/ONBOARDING_GUIDE.md"
];

const requiredScopes = [
  "Apache-2.0 public local/core package scope",
  "closed commercial cloud/SaaS boundary",
  "SearchLint trademark reservation",
  "DCO 1.1 contribution process",
  "public/private repository boundary",
  "public package metadata",
  "VS Code Marketplace copy",
  "public website and onboarding copy"
];

const requiredAnswers = [
  "apache2PublicScopeAccepted",
  "noticeApproved",
  "trademarkExclusionSufficient",
  "trademarkPolicyApproved",
  "dco11Accepted",
  "contributionScopeExcludesCloud",
  "repositorySplitExcludesPrivateCloud",
  "publicCopyConsistentWithTrademarkAndLicense",
  "securityPolicyApproved",
  "privacyTelemetryBenchmarkFixturePoliciesApproved"
];

const issues = [];
await verifyRequiredFilesExist();
const approval = await readOptionalJson(approvalPath);

if (!approval) {
  issues.push(issue("missing-approval", `${approvalPath} is required.`));
} else {
  validateApproval(approval);
}

const report = {
  schemaVersion: 1,
  generatedBy: "searchlint-legal-release-approval-verifier",
  generatedAt,
  status: issues.length === 0 ? "passed" : "blocked",
  approval: summarizeApproval(approval),
  requiredFiles: requiredFiles.map((filePath) => ({
    path: filePath,
    approved: approval?.approvedFiles?.includes(filePath) === true
  })),
  requiredScopes: requiredScopes.map((scope) => ({
    scope,
    approved: approval?.approvedScopes?.includes(scope) === true
  })),
  requiredAnswers: requiredAnswers.map((key) => ({
    key,
    answer: approval?.requiredAnswers?.[key] ?? null,
    approved: approval?.requiredAnswers?.[key] === "yes"
  })),
  releaseGate: {
    passFail: issues.length === 0 ? "pass" : "fail",
    checks: {
      approvalPresent: Boolean(approval),
      schemaVersionValid: approval?.schemaVersion === 1,
      filesApproved:
        approval?.approvedFiles &&
        requiredFiles.every((filePath) =>
          approval.approvedFiles.includes(filePath)
        ),
      scopesApproved:
        approval?.approvedScopes &&
        requiredScopes.every((scope) =>
          approval.approvedScopes.includes(scope)
        ),
      legalQuestionsAnswered:
        approval?.requiredAnswers &&
        requiredAnswers.every((key) => approval.requiredAnswers[key] === "yes"),
      signedStatementPresent:
        typeof approval?.signedStatement === "string" &&
        /approve|approved|approval/i.test(approval.signedStatement),
      noRequiredChanges:
        Array.isArray(approval?.requiredChanges) &&
        approval.requiredChanges.length === 0,
      noExampleValues: !approval || !looksLikeExample(approval)
    }
  },
  issues,
  nextSteps:
    issues.length === 0
      ? [
          "Apply any approved final legal text changes.",
          "Run package metadata approval and publication gates.",
          "Update the master checklist with legal evidence links."
        ]
      : [
          `Create ${approvalPath} from ${examplePath} with real qualified legal approval.`,
          "Resolve any legal requiredChanges before package or VS Code publication."
        ]
};

report.releaseGate.failedChecks = Object.entries(report.releaseGate.checks)
  .filter(([, passed]) => !passed)
  .map(([check]) => check);

assertNoSensitiveValues(JSON.stringify(report));
await writeJson(reportPath, report);
await writeJson(samplePath, report);

if (report.status !== "passed") {
  console.error("Legal release approval gate blocked.");
  for (const entry of issues) {
    console.error(`- ${entry.code}: ${entry.message}`);
  }
  console.error(`Report: ${reportPath}`);
  console.error(`Sample: ${samplePath}`);
  process.exitCode = 1;
} else {
  console.log("Legal release approval gate PASS.");
  console.log(`Report: ${reportPath}`);
  console.log(`Sample: ${samplePath}`);
}

async function verifyRequiredFilesExist() {
  for (const filePath of requiredFiles) {
    let info;
    try {
      info = await stat(filePath);
    } catch (error) {
      if (error?.code === "ENOENT") {
        issues.push(issue("missing-required-file", `${filePath} is missing.`));
        continue;
      }
      throw error;
    }
    if (!info.isFile()) {
      issues.push(issue("missing-required-file", `${filePath} is missing.`));
      continue;
    }
    const text = await readFile(filePath, "utf8");
    if (text.trim().length === 0) {
      issues.push(issue("empty-required-file", `${filePath} is empty.`));
    }
  }
}

async function readOptionalJson(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return undefined;
    throw error;
  }
}

function validateApproval(value) {
  if (value.schemaVersion !== 1) {
    issues.push(issue("invalid-schema-version", "schemaVersion must be 1."));
  }
  for (const field of [
    "approvedBy",
    "reviewerRole",
    "reviewedAt",
    "approvalId",
    "signedStatement"
  ]) {
    if (typeof value[field] !== "string" || value[field].trim() === "") {
      issues.push(issue("missing-field", `${field} is required.`));
    }
  }
  if (looksLikeExample(value)) {
    issues.push(
      issue("example-values", "Example/template values are not evidence.")
    );
  }
  if (
    typeof value.signedStatement !== "string" ||
    !/approve|approved|approval/i.test(value.signedStatement)
  ) {
    issues.push(
      issue(
        "missing-signed-statement",
        "signedStatement must explicitly approve the legal release gate."
      )
    );
  }
  validateList("approvedFiles", value.approvedFiles, requiredFiles);
  validateList("approvedScopes", value.approvedScopes, requiredScopes);
  validateAnswers(value.requiredAnswers);
  if (!Array.isArray(value.requiredChanges)) {
    issues.push(
      issue("missing-required-changes", "requiredChanges must be an array.")
    );
  } else if (value.requiredChanges.length > 0) {
    issues.push(
      issue(
        "unresolved-required-changes",
        "requiredChanges must be empty before legal release approval passes."
      )
    );
  }
}

function validateList(field, actual, expected) {
  if (!Array.isArray(actual)) {
    issues.push(issue(`missing-${field}`, `${field} must be an array.`));
    return;
  }
  const actualSet = new Set(actual);
  for (const value of expected) {
    if (!actualSet.has(value)) {
      issues.push(
        issue(`missing-${field}-entry`, `${field} missing ${value}.`)
      );
    }
  }
}

function validateAnswers(answers) {
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) {
    issues.push(
      issue("missing-required-answers", "requiredAnswers object is required.")
    );
    return;
  }
  for (const key of requiredAnswers) {
    if (answers[key] !== "yes") {
      issues.push(
        issue("required-answer-not-approved", `${key} must be answered yes.`)
      );
    }
  }
}

function summarizeApproval(value) {
  if (!value) return { present: false };
  return {
    present: true,
    approvalId: value.approvalId,
    approvedBy: value.approvedBy,
    reviewerRole: value.reviewerRole,
    reviewedAt: value.reviewedAt,
    requiredChangeCount: Array.isArray(value.requiredChanges)
      ? value.requiredChanges.length
      : null
  };
}

function looksLikeExample(value) {
  return /example|template|placeholder|todo|replace-me/iu.test(
    JSON.stringify(value)
  );
}

function issue(code, message) {
  return {
    severity: "blocker",
    code,
    message
  };
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
    throw new Error(`Sensitive value leaked into legal evidence: ${match}`);
  }
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(
    filePath,
    await format(`${JSON.stringify(value, null, 2)}\n`, { parser: "json" })
  );
}
