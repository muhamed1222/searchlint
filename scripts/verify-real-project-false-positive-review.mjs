#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const generatedAt = "2026-06-23T00:00:00.000Z";
const ledgerPath = path.join(
  repoRoot,
  "specs/REAL_PROJECT_FALSE_POSITIVE_REVIEW.json"
);
const sourceReportPath = path.join(
  repoRoot,
  "reports/real-site-regression-corpus-report.json"
);
const reportPath = path.join(
  repoRoot,
  "reports/real-project-false-positive-review-report.json"
);
const samplePath = path.join(
  repoRoot,
  "docs/examples/real-project-false-positive-review-report.sample.json"
);
const releaseBlockingSeverities = new Set(["blocker", "error", "warning"]);

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    env: { ...process.env, ...options.env },
    encoding: "utf8",
    stdio: options.stdio ?? "pipe"
  });
}

async function main() {
  run("pnpm", ["core:real-corpus"], { stdio: "inherit" });

  const ledger = JSON.parse(await readFile(ledgerPath, "utf8"));
  const sourceReport = JSON.parse(await readFile(sourceReportPath, "utf8"));
  const actualDiagnostics = sourceReport.cases.flatMap((entry) =>
    entry.diagnostics.map((diagnostic) => ({
      caseId: entry.id,
      ruleId: diagnostic.ruleId,
      severity: diagnostic.severity,
      fingerprint: diagnostic.fingerprint
    }))
  );
  const reviewedDiagnostics = ledger.reviewedDiagnostics;
  const reviewedByKey = new Map(
    reviewedDiagnostics.map((entry) => [diagnosticKey(entry), entry])
  );
  const actualByKey = new Map(
    actualDiagnostics.map((entry) => [diagnosticKey(entry), entry])
  );

  const newUnreviewed = actualDiagnostics.filter(
    (entry) => !reviewedByKey.has(diagnosticKey(entry))
  );
  const missingReviewed = reviewedDiagnostics.filter(
    (entry) => !actualByKey.has(diagnosticKey(entry))
  );
  const severityDrift = actualDiagnostics
    .map((entry) => ({
      actual: entry,
      reviewed: reviewedByKey.get(diagnosticKey(entry))
    }))
    .filter(
      (entry) =>
        entry.reviewed && entry.actual.severity !== entry.reviewed.severity
    );
  const releaseBlockingDiagnostics = actualDiagnostics.filter((entry) =>
    releaseBlockingSeverities.has(entry.severity)
  );
  const acceptedDiagnostics = actualDiagnostics.filter((entry) => {
    const reviewed = reviewedByKey.get(diagnosticKey(entry));
    return (
      reviewed?.classification === "accepted-nonblocking-guidance" &&
      entry.severity === reviewed.severity &&
      !releaseBlockingSeverities.has(entry.severity)
    );
  });

  const gates = {
    sourceCorpusPassed: sourceReport.status === "passed",
    reviewedLedgerPresent: reviewedDiagnostics.length > 0,
    allCurrentDiagnosticsReviewed: newUnreviewed.length === 0,
    noMissingReviewedDiagnostics: missingReviewed.length === 0,
    noSeverityDrift: severityDrift.length === 0,
    noReleaseBlockingFalsePositiveCandidates:
      releaseBlockingDiagnostics.length === 0
  };
  const status = Object.values(gates).every(Boolean) ? "passed" : "failed";
  const report = {
    schemaVersion: 1,
    generatedBy: "searchlint-real-project-false-positive-review",
    generatedAt,
    status,
    benchmarkVersion: ledger.benchmarkVersion,
    source: {
      command: ledger.sourceCommand,
      report: ledger.sourceReport,
      corpusCaseCount: sourceReport.corpus.caseCount,
      ruleCount: sourceReport.ruleExecution.ruleCount,
      totalRuleExecutions: sourceReport.ruleExecution.totalRuleExecutions
    },
    policy: ledger.policy,
    summary: {
      actualDiagnosticCount: actualDiagnostics.length,
      reviewedDiagnosticCount: reviewedDiagnostics.length,
      acceptedNonBlockingGuidanceCount: acceptedDiagnostics.length,
      newUnreviewedCount: newUnreviewed.length,
      missingReviewedCount: missingReviewed.length,
      severityDriftCount: severityDrift.length,
      releaseBlockingDiagnosticCount: releaseBlockingDiagnostics.length
    },
    cases: sourceReport.cases.map((entry) => ({
      id: entry.id,
      url: entry.url,
      diagnosticCount: entry.diagnosticCount,
      emittedRuleIds: entry.emittedRuleIds,
      releaseBlockingDiagnostics: entry.diagnostics
        .filter((diagnostic) =>
          releaseBlockingSeverities.has(diagnostic.severity)
        )
        .map((diagnostic) => ({
          ruleId: diagnostic.ruleId,
          severity: diagnostic.severity,
          fingerprint: diagnostic.fingerprint
        }))
    })),
    gates,
    failures: {
      newUnreviewed,
      missingReviewed,
      severityDrift,
      releaseBlockingDiagnostics
    },
    remainingReleaseGates: [
      "OD-023 independent blocker benchmark review still requires two real reviewer files.",
      "Broader customer/demo project corpus remains useful before final release.",
      "Release-quality for all 120 rules remains blocked until OD-023 reviewer gate passes."
    ]
  };

  await mkdir(path.dirname(reportPath), { recursive: true });
  await mkdir(path.dirname(samplePath), { recursive: true });
  await writeJson(reportPath, report);
  await writeJson(samplePath, report);

  if (status !== "passed") {
    throw new Error(
      `real-project false-positive review failed: ${JSON.stringify(report.summary)}`
    );
  }

  console.log(
    `Real-project false-positive review PASS: ${acceptedDiagnostics.length}/${actualDiagnostics.length} reviewed non-blocking diagnostics, 0 release-blocking candidates`
  );
  console.log(`Report: ${path.relative(repoRoot, reportPath)}`);
  console.log(`Sample: ${path.relative(repoRoot, samplePath)}`);
}

function diagnosticKey(entry) {
  return `${entry.caseId}:${entry.ruleId}:${entry.fingerprint}`;
}

async function writeJson(filePath, data) {
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
