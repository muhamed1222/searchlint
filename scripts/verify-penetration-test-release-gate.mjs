#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { format } from "prettier";

const reportPath = "reports/penetration-test-release-gate-report.json";
const samplePath =
  "docs/examples/penetration-test-release-gate-report.sample.json";
const pentestDir = "docs/reviews/penetration-test";
const reportSummaryPath = `${pentestDir}/report-summary.json`;
const ownerApprovalPath = `${pentestDir}/owner-approval.json`;
const dastReportPath = "reports/dast-release-gate-report.json";
const generatedAt = "2026-06-23T00:00:00.000Z";
const blockingSeverities = new Set(["critical", "high", "medium"]);
const issues = [];

const dastReport = await readOptionalJson(dastReportPath);
const reportSummary = await readOptionalJson(reportSummaryPath);
const ownerApproval = await readOptionalJson(ownerApprovalPath);

const dast = validateDastReport(dastReport);
const summary = validateReportSummary(reportSummary);
const approval = validateOwnerApproval(ownerApproval, reportSummary);

issues.push(...dast.issues, ...summary.issues, ...approval.issues);

const report = {
  generatedBy: "searchlint-penetration-test-release-gate-verifier",
  generatedAt,
  status: issues.length === 0 ? "passed" : "blocked",
  scope: {
    proofType: "independent penetration-test release gate",
    doesNotClaim:
      issues.length === 0
        ? ["legal approval", "future release candidate security"]
        : [
            "penetration test pass",
            "legal approval",
            "security release approval",
            "future release candidate security"
          ]
  },
  inputs: {
    dastReport: {
      path: dastReportPath,
      present: Boolean(dastReport),
      status: dastReport?.status ?? null
    },
    reportSummary: summary.summary,
    ownerApproval: approval.summary
  },
  releaseGate: {
    passFail: issues.length === 0 ? "pass" : "fail",
    gates: {
      dastPassed: dast.valid,
      reportSummaryPresent: summary.present,
      reportSummaryValid: summary.valid,
      independentReviewerStatementPresent: summary.independentStatementPresent,
      noOpenCriticalHighMedium: summary.noOpenCriticalHighMedium,
      remediationEvidenceComplete: summary.remediationEvidenceComplete,
      ownerApprovalPresent: approval.present,
      ownerApprovalValid: approval.valid,
      evidenceSanitized: true
    }
  },
  issues,
  remainingReleaseGates:
    issues.length === 0
      ? [
          "Final legal/security release approval.",
          "Run the full release candidate matrix."
        ]
      : [
          "Complete DAST against deployed production-equivalent targets.",
          "Obtain independent penetration test report summary.",
          "Resolve or formally accept all findings.",
          "Retest remediated critical/high findings.",
          "Provide owner approval."
        ]
};
report.releaseGate.failedGates = Object.entries(report.releaseGate.gates)
  .filter(([, passed]) => !passed)
  .map(([gate]) => gate);

assertNoSensitiveValues(JSON.stringify(report));
await writeJson(reportPath, report);
await writeJson(samplePath, report);

if (report.status !== "passed") {
  console.error("Penetration test release gate blocked.");
  for (const issue of issues) {
    console.error(`- ${issue.code}: ${issue.message}`);
  }
  console.error(`Report: ${reportPath}`);
  console.error(`Sample: ${samplePath}`);
  process.exitCode = 1;
} else {
  console.log("Penetration test release gate PASS.");
  console.log(`Report: ${reportPath}`);
  console.log(`Sample: ${samplePath}`);
}

async function readOptionalJson(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return undefined;
    throw error;
  }
}

function validateDastReport(report) {
  const result = {
    valid:
      report?.status === "passed" && report?.releaseGate?.passFail === "pass",
    issues: []
  };
  if (!report) {
    result.issues.push(issue("missing-dast-report", "DAST report is missing."));
  } else if (!result.valid) {
    result.issues.push(
      issue("dast-not-passed", "DAST report must pass before pentest approval.")
    );
  }
  return result;
}

function validateReportSummary(summary) {
  const result = {
    present: Boolean(summary),
    valid: false,
    independentStatementPresent: false,
    noOpenCriticalHighMedium: false,
    remediationEvidenceComplete: false,
    summary: {
      present: Boolean(summary)
    },
    issues: []
  };

  if (!summary) {
    result.issues.push(
      issue("missing-report-summary", `${reportSummaryPath} is required.`)
    );
    return result;
  }

  result.summary = {
    present: true,
    reportId: summary.reportId,
    reviewerOrganization: summary.reviewerOrganization,
    reviewerTeam: summary.reviewerTeam,
    targetClasses: Array.isArray(summary.targetClasses)
      ? summary.targetClasses
      : [],
    findingCount: Array.isArray(summary.findings) ? summary.findings.length : 0,
    openCriticalHighMediumCount: summary.openCriticalHighMediumCount
  };

  if (summary.schemaVersion !== 1) {
    result.issues.push(
      issue("invalid-report-schema", "schemaVersion must be 1.")
    );
  }
  for (const field of [
    "reportId",
    "reviewerOrganization",
    "reviewerTeam",
    "signedStatement"
  ]) {
    if (typeof summary[field] !== "string" || summary[field].trim() === "") {
      result.issues.push(
        issue("missing-report-field", `${field} is required.`)
      );
    }
  }
  if (looksLikeExample(summary)) {
    result.issues.push(
      issue("example-report-summary", "Example report summary is not evidence.")
    );
  }
  result.independentStatementPresent =
    typeof summary.signedStatement === "string" &&
    /independent/i.test(summary.signedStatement) &&
    !looksLikeExample({ signedStatement: summary.signedStatement });
  if (!result.independentStatementPresent) {
    result.issues.push(
      issue(
        "missing-independent-statement",
        "signedStatement must explicitly state independent testing."
      )
    );
  }
  const findings = Array.isArray(summary.findings) ? summary.findings : [];
  const unresolvedBlocking = findings.filter(
    (finding) =>
      blockingSeverities.has(String(finding.severity).toLowerCase()) &&
      !["resolved", "accepted-risk"].includes(String(finding.status))
  );
  result.noOpenCriticalHighMedium =
    summary.openCriticalHighMediumCount === 0 &&
    unresolvedBlocking.length === 0;
  if (!result.noOpenCriticalHighMedium) {
    result.issues.push(
      issue(
        "unresolved-blocking-findings",
        "No critical, high, or medium findings may remain unresolved."
      )
    );
  }
  const missingRemediation = findings.filter((finding) => {
    const severity = String(finding.severity).toLowerCase();
    const status = String(finding.status);
    if (!blockingSeverities.has(severity)) return false;
    if (!["resolved", "accepted-risk"].includes(status)) return false;
    return (
      typeof finding.remediationEvidence !== "string" ||
      finding.remediationEvidence.trim() === "" ||
      (["critical", "high"].includes(severity) &&
        typeof finding.retestEvidence !== "string")
    );
  });
  result.remediationEvidenceComplete = missingRemediation.length === 0;
  if (!result.remediationEvidenceComplete) {
    result.issues.push(
      issue(
        "missing-remediation-evidence",
        "Resolved or accepted critical/high/medium findings require remediation evidence."
      )
    );
  }

  result.valid = result.issues.length === 0;
  return result;
}

function validateOwnerApproval(approval, summary) {
  const result = {
    present: Boolean(approval),
    valid: false,
    summary: {
      present: Boolean(approval)
    },
    issues: []
  };
  if (!approval) {
    result.issues.push(
      issue("missing-owner-approval", `${ownerApprovalPath} is required.`)
    );
    return result;
  }
  result.summary = {
    present: true,
    approvedBy: approval.approvedBy,
    approvedAt: approval.approvedAt,
    reportId: approval.reportId,
    dastReportStatus: approval.dastReportStatus
  };
  if (approval.schemaVersion !== 1) {
    result.issues.push(
      issue("invalid-approval-schema", "schemaVersion must be 1.")
    );
  }
  for (const field of [
    "approvedBy",
    "approvedAt",
    "reportId",
    "dastReportStatus",
    "signedStatement"
  ]) {
    if (typeof approval[field] !== "string" || approval[field].trim() === "") {
      result.issues.push(
        issue("missing-approval-field", `${field} is required.`)
      );
    }
  }
  if (looksLikeExample(approval)) {
    result.issues.push(
      issue("example-owner-approval", "Example owner approval is not evidence.")
    );
  }
  if (summary?.reportId && approval.reportId !== summary.reportId) {
    result.issues.push(
      issue("approval-report-mismatch", "owner approval reportId must match.")
    );
  }
  if (approval.dastReportStatus !== "passed") {
    result.issues.push(
      issue(
        "approval-without-dast-pass",
        "owner approval must cite passed DAST."
      )
    );
  }
  if (
    typeof approval.signedStatement !== "string" ||
    !/approve|accepted|release/i.test(approval.signedStatement)
  ) {
    result.issues.push(
      issue(
        "missing-owner-signed-statement",
        "owner signedStatement must approve or accept the pentest result."
      )
    );
  }
  result.valid = result.issues.length === 0;
  return result;
}

function looksLikeExample(value) {
  return /example only|example-|template|placeholder/iu.test(
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
    throw new Error(`Sensitive value leaked into pentest evidence: ${match}`);
  }
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(
    filePath,
    await format(`${JSON.stringify(value, null, 2)}\n`, { parser: "json" })
  );
}
