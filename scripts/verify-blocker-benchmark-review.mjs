import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import process from "node:process";

const root = process.cwd();
const reviewDir = "docs/reviews/blocker-benchmark";
const benchmarkPath = "reports/blocker-precision-report.json";
const summaryPath = "reports/blocker-benchmark-adjudication-summary.json";
const reviewerPaths = [
  `${reviewDir}/reviewer-1.review.json`,
  `${reviewDir}/reviewer-2.review.json`
];

const benchmark = await readJson(benchmarkPath);
const expectedCases = expandBenchmarkCases(benchmark);
const expectedCaseIds = new Set(expectedCases.map((entry) => entry.caseId));
const issues = [];
const reviewerResults = [];

for (const path of reviewerPaths) {
  const review = await readOptionalJson(path);
  if (!review) {
    issues.push({
      severity: "blocker",
      code: "missing-reviewer-file",
      message: `Missing required reviewer file: ${path}`
    });
    reviewerResults.push({
      path,
      present: false,
      valid: false,
      reviewerId: null,
      coverage: {
        reviewedCaseCount: 0,
        expectedCaseCount: expectedCases.length,
        missingCaseCount: expectedCases.length,
        unknownCaseCount: 0,
        duplicateCaseCount: 0
      }
    });
    continue;
  }

  const result = validateReview(path, review, benchmark, expectedCaseIds);
  reviewerResults.push(result);
  issues.push(...result.issues);
}

const disagreements = findDisagreements(reviewerResults, expectedCaseIds);
issues.push(
  ...disagreements.map((caseId) => ({
    severity: "blocker",
    code: "reviewer-disagreement",
    message: `Reviewer outcomes disagree for case ${caseId}`,
    caseId
  }))
);

const rejectedCaseIds = unique(
  reviewerResults.flatMap((result) => result.rejectedCaseIds ?? [])
);
const disputedCaseIds = unique(
  reviewerResults.flatMap((result) => result.disputedCaseIds ?? [])
);

if (rejectedCaseIds.length > 0) {
  issues.push({
    severity: "blocker",
    code: "rejected-cases",
    message: `${rejectedCaseIds.length} benchmark case(s) were rejected by reviewers.`,
    caseIds: rejectedCaseIds
  });
}

if (disputedCaseIds.length > 0) {
  issues.push({
    severity: "blocker",
    code: "disputed-cases",
    message: `${disputedCaseIds.length} benchmark case(s) remain disputed.`,
    caseIds: disputedCaseIds
  });
}

const signoffComplete =
  reviewerResults.length === 2 &&
  reviewerResults.every((result) => result.present && result.valid) &&
  issues.length === 0;

const reviewedMetrics = signoffComplete
  ? {
      tp: benchmark.summary.tp,
      fp: benchmark.summary.fp,
      fn: benchmark.summary.fn,
      tn: benchmark.summary.tn,
      disputed: 0,
      precision: benchmark.summary.precision,
      recall: benchmark.summary.recall,
      precisionWilsonLowerBound95: benchmark.summary.precisionWilsonLowerBound95
    }
  : null;

const releaseGate = {
  passFail:
    signoffComplete &&
    benchmark.releaseGate?.gates?.precisionAtLeast995 === true &&
    benchmark.releaseGate?.gates?.wilsonLowerBoundAtLeast990 === true &&
    benchmark.releaseGate?.gates?.fpAtMostOne === true &&
    benchmark.releaseGate?.gates?.aggregateRecallAtLeast95 === true &&
    benchmark.releaseGate?.gates?.everyRuleRecallAtLeast90 === true
      ? "pass"
      : "fail",
  gates: {
    twoReviewerFilesPresent: reviewerResults.every((result) => result.present),
    reviewerFilesValid: reviewerResults.every((result) => result.valid),
    fullBenchmarkCoverage: reviewerResults.every(
      (result) => result.coverage?.missingCaseCount === 0
    ),
    noUnknownCases: reviewerResults.every(
      (result) => result.coverage?.unknownCaseCount === 0
    ),
    noDuplicateCases: reviewerResults.every(
      (result) => result.coverage?.duplicateCaseCount === 0
    ),
    benchmarkVersionMatches: reviewerResults.every(
      (result) => result.benchmarkVersionMatches === true
    ),
    noReviewerDisagreements: disagreements.length === 0,
    noRejectedCases: rejectedCaseIds.length === 0,
    noDisputedCases: disputedCaseIds.length === 0,
    signedStatementsPresent: reviewerResults.every(
      (result) => result.signedStatementPresent === true
    ),
    numericPrecisionGate:
      benchmark.releaseGate?.gates?.precisionAtLeast995 === true,
    numericWilsonGate:
      benchmark.releaseGate?.gates?.wilsonLowerBoundAtLeast990 === true,
    numericFpGate: benchmark.releaseGate?.gates?.fpAtMostOne === true,
    numericRecallGate:
      benchmark.releaseGate?.gates?.aggregateRecallAtLeast95 === true,
    numericPerRuleRecallGate:
      benchmark.releaseGate?.gates?.everyRuleRecallAtLeast90 === true
  },
  failedGates: []
};
releaseGate.failedGates = Object.entries(releaseGate.gates)
  .filter(([, passed]) => !passed)
  .map(([gate]) => gate);

const summary = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  benchmarkVersion: benchmark.benchmarkVersion,
  benchmarkPath,
  expectedCaseCount: expectedCases.length,
  reviewerFiles: reviewerResults,
  disagreements,
  rejectedCaseIds,
  disputedCaseIds,
  issues,
  reviewedMetrics,
  releaseGate
};

await writeJson(summaryPath, summary);

if (releaseGate.passFail !== "pass") {
  console.error("OD-023 blocker benchmark review gate failed.");
  for (const issue of issues) {
    console.error(`- ${issue.code}: ${issue.message}`);
  }
  if (issues.length === 0) {
    console.error(
      `- failed-gates: ${releaseGate.failedGates.join(", ") || "unknown"}`
    );
  }
  console.error(`Adjudication summary written to ${summaryPath}`);
  process.exit(1);
}

console.log("OD-023 blocker benchmark review gate passed.");
console.log(`Adjudication summary written to ${summaryPath}`);

async function readJson(path) {
  const absolutePath = resolve(root, path);
  return JSON.parse(await readFile(absolutePath, "utf8"));
}

async function readOptionalJson(path) {
  try {
    return await readJson(path);
  } catch (error) {
    if (error?.code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}

async function writeJson(path, value) {
  const absolutePath = resolve(root, path);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, `${JSON.stringify(value, null, 2)}\n`);
}

function expandBenchmarkCases(report) {
  const cases = [];
  for (const rule of report.perRule ?? []) {
    const positiveFixture = rule.fixtures?.positive;
    const negativeFixture = rule.fixtures?.negative;
    for (let index = 1; index <= (rule.positiveUnits ?? 0); index += 1) {
      cases.push({
        caseId: `${rule.ruleId}:positive:${positiveFixture}:${String(index).padStart(3, "0")}`,
        ruleId: rule.ruleId,
        expected: "trigger",
        fixtureId: positiveFixture
      });
    }
    for (let index = 1; index <= (rule.negativeUnits ?? 0); index += 1) {
      cases.push({
        caseId: `${rule.ruleId}:negative:${negativeFixture}:${String(index).padStart(3, "0")}`,
        ruleId: rule.ruleId,
        expected: "no-trigger",
        fixtureId: negativeFixture
      });
    }
  }
  return cases;
}

function validateReview(path, review, report, expectedCaseIds) {
  const issues = [];
  const approved = asArray(review.approvedCaseIds);
  const rejected = asArray(review.rejectedCaseIds);
  const disputed = asArray(review.disputedCaseIds);
  const all = [...approved, ...rejected, ...disputed];
  const duplicates = duplicateValues(all);
  const unknown = all.filter((caseId) => !expectedCaseIds.has(caseId));
  const reviewedSet = new Set(all);
  const missing = [...expectedCaseIds].filter(
    (caseId) => !reviewedSet.has(caseId)
  );
  const benchmarkVersionMatches =
    review.benchmarkVersion === report.benchmarkVersion;
  const signedStatementPresent =
    typeof review.signedStatement === "string" &&
    review.signedStatement.trim().length > 0 &&
    !review.signedStatement.toLowerCase().includes("example only");

  if (review.schemaVersion !== 1) {
    issues.push(
      issue("invalid-schema-version", path, "schemaVersion must be 1.")
    );
  }
  for (const field of [
    "reviewerId",
    "reviewerName",
    "reviewedAt",
    "benchmarkVersion"
  ]) {
    if (
      typeof review[field] !== "string" ||
      review[field].trim().length === 0
    ) {
      issues.push(issue("missing-review-field", path, `${field} is required.`));
    }
  }
  if (!benchmarkVersionMatches) {
    issues.push(
      issue(
        "benchmark-version-mismatch",
        path,
        `${path} benchmarkVersion '${review.benchmarkVersion}' does not match '${report.benchmarkVersion}'.`
      )
    );
  }
  if (review.reviewedCaseCount !== expectedCaseIds.size) {
    issues.push(
      issue(
        "reviewed-case-count-mismatch",
        path,
        `${path} reviewedCaseCount ${review.reviewedCaseCount} does not equal expected ${expectedCaseIds.size}.`
      )
    );
  }
  if (missing.length > 0) {
    issues.push(
      issue(
        "incomplete-review-coverage",
        path,
        `${path} is missing ${missing.length} benchmark case(s).`
      )
    );
  }
  if (unknown.length > 0) {
    issues.push(
      issue(
        "unknown-review-case",
        path,
        `${path} contains ${unknown.length} unknown benchmark case ID(s).`
      )
    );
  }
  if (duplicates.length > 0) {
    issues.push(
      issue(
        "duplicate-review-case",
        path,
        `${path} contains ${duplicates.length} duplicate benchmark case ID(s).`
      )
    );
  }
  if (!signedStatementPresent) {
    issues.push(
      issue(
        "missing-signed-statement",
        path,
        `${path} must contain a real signedStatement. Example statements do not count.`
      )
    );
  }

  return {
    path,
    present: true,
    valid: issues.length === 0,
    reviewerId: review.reviewerId ?? null,
    reviewerName: review.reviewerName ?? null,
    reviewedAt: review.reviewedAt ?? null,
    benchmarkVersion: review.benchmarkVersion ?? null,
    benchmarkVersionMatches,
    signedStatementPresent,
    coverage: {
      reviewedCaseCount: all.length,
      expectedCaseCount: expectedCaseIds.size,
      missingCaseCount: missing.length,
      unknownCaseCount: unknown.length,
      duplicateCaseCount: duplicates.length
    },
    approvedCaseIds: approved,
    rejectedCaseIds: rejected,
    disputedCaseIds: disputed,
    issues
  };
}

function findDisagreements(results, expectedCaseIds) {
  const present = results.filter((result) => result.present);
  if (present.length < 2) {
    return [];
  }
  const disagreements = [];
  for (const caseId of expectedCaseIds) {
    const outcomes = new Set(
      present.map((result) => outcomeFor(result, caseId))
    );
    outcomes.delete("missing");
    if (outcomes.size > 1) {
      disagreements.push(caseId);
    }
  }
  return disagreements;
}

function outcomeFor(result, caseId) {
  if (result.approvedCaseIds?.includes(caseId)) {
    return "approved";
  }
  if (result.rejectedCaseIds?.includes(caseId)) {
    return "rejected";
  }
  if (result.disputedCaseIds?.includes(caseId)) {
    return "disputed";
  }
  return "missing";
}

function asArray(value) {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
    ? value
    : [];
}

function duplicateValues(values) {
  const seen = new Set();
  const duplicates = new Set();
  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
    }
    seen.add(value);
  }
  return [...duplicates];
}

function unique(values) {
  return [...new Set(values)];
}

function issue(code, path, message) {
  return { severity: "blocker", code, path, message };
}
