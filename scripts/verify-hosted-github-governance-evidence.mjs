#!/usr/bin/env node
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const evidencePath = "docs/github/hosted-governance-evidence.json";
const templatePath = "docs/github/hosted-governance-evidence.example.json";
const reportPath = "reports/hosted-github-governance-evidence-report.json";
const samplePath =
  "docs/examples/hosted-github-governance-evidence-report.sample.json";
const selfTestReportPath =
  "reports/hosted-github-governance-evidence-self-test-report.json";
const selfTestSamplePath =
  "docs/examples/hosted-github-governance-evidence-self-test-report.sample.json";
const generatedAt = "2026-06-23T00:00:00.000Z";

const requiredChecks = [
  "foundation",
  "docker-image-build",
  "next-fixtures-zero-impact (next15-app)",
  "next-fixtures-zero-impact (next15-pages)",
  "next-fixtures-zero-impact (next16-app)",
  "next-fixtures-zero-impact (next16-pages)",
  "postgres-migration-proof"
];

if (process.argv.includes("--self-test")) {
  await runSelfTest();
  process.exit(0);
}

async function main() {
  const baseReport = {
    schemaVersion: 1,
    generatedBy: "searchlint-hosted-github-governance-evidence-verifier",
    generatedAt,
    evidencePath,
    templatePath,
    requiredChecks,
    releaseGates: {
      protectedBranchConfigured: false,
      requiredCiChecksConfigured: false
    }
  };

  if (!existsSync(path.join(repoRoot, evidencePath))) {
    await writeReports({
      ...baseReport,
      status: "missing_hosted_github_evidence",
      failure:
        "Missing docs/github/hosted-governance-evidence.json. Create it from the example template using real hosted GitHub evidence.",
      nextOwnerAction:
        "Configure hosted GitHub branch protection and required status checks, collect sanitized GitHub evidence, then rerun pnpm governance:hosted-github-evidence."
    });
    console.error("Missing hosted GitHub governance evidence.");
    process.exitCode = 1;
    return;
  }

  const value = JSON.parse(
    await readFile(path.join(repoRoot, evidencePath), "utf8")
  );
  const failures = validateEvidence(value);
  const report = {
    ...baseReport,
    status: failures.length === 0 ? "passed" : "failed",
    repository: value.repository ?? null,
    providedAt: value.providedAt ?? null,
    providedBy: value.providedBy ?? null,
    checkSummary: {
      branch: value.branchProtection?.branch ?? null,
      strictStatusChecks:
        value.branchProtection?.requiredStatusChecks?.strict === true,
      requiredCheckCount:
        value.branchProtection?.requiredStatusChecks?.contexts?.length ?? 0,
      ciRequiredCheckCount: value.ci?.requiredChecks?.length ?? 0,
      latestCiConclusion: value.ci?.latestSuccessfulRun?.conclusion ?? null
    },
    failures,
    releaseGates: {
      protectedBranchConfigured: failures.length === 0,
      requiredCiChecksConfigured: failures.length === 0
    }
  };
  await writeReports(report);

  if (failures.length > 0) {
    console.error("Hosted GitHub governance evidence failed validation.");
    process.exitCode = 1;
    return;
  }

  console.log("Hosted GitHub governance evidence PASS");
  console.log(`Report: ${reportPath}`);
  console.log(`Sample: ${samplePath}`);
}

async function runSelfTest() {
  const cases = [
    {
      id: "valid-hosted-github-evidence",
      value: validEvidence(),
      expectedPass: true,
      expectedFailureCodes: []
    },
    {
      id: "missing-required-ci-check",
      value: mutate(validEvidence(), (value) => {
        value.branchProtection.requiredStatusChecks.contexts =
          value.branchProtection.requiredStatusChecks.contexts.filter(
            (check) => check !== "postgres-migration-proof"
          );
      }),
      expectedPass: false,
      expectedFailureCodes: ["missing_required_checks"]
    },
    {
      id: "template-placeholder",
      value: mutate(validEvidence(), (value) => {
        value.repository.slug = "REPLACE_WITH_OWNER/REPOSITORY";
      }),
      expectedPass: false,
      expectedFailureCodes: ["placeholder_value"]
    },
    {
      id: "sensitive-github-token",
      value: mutate(validEvidence(), (value) => {
        value.collection.commands.push(
          "gh api repos/searchlint/searchlint --header authorization:token ghp_1234567890abcdefghijklmnopqrst"
        );
      }),
      expectedPass: false,
      expectedFailureCodes: ["sensitive_value"]
    },
    {
      id: "weak-branch-protection",
      value: mutate(validEvidence(), (value) => {
        value.branchProtection.allowForcePushes = true;
        value.branchProtection.pullRequestReviews.requiredApprovingReviewCount = 0;
      }),
      expectedPass: false,
      expectedFailureCodes: [
        "insufficient_review_requirement",
        "unexpected_value"
      ]
    },
    {
      id: "failed-ci-run",
      value: mutate(validEvidence(), (value) => {
        value.ci.latestSuccessfulRun.conclusion = "failure";
      }),
      expectedPass: false,
      expectedFailureCodes: ["unexpected_value"]
    }
  ];

  const results = cases.map((testCase) => {
    const failures = validateEvidence(testCase.value);
    const actualFailureCodes = [
      ...new Set(failures.map((failure) => failure.code))
    ].sort();
    const expectedFailureCodes = [...testCase.expectedFailureCodes].sort();
    const pass =
      (failures.length === 0) === testCase.expectedPass &&
      expectedFailureCodes.every((code) => actualFailureCodes.includes(code));
    return {
      id: testCase.id,
      status: pass ? "PASS" : "FAIL",
      expectedPass: testCase.expectedPass,
      expectedFailureCodes,
      actualFailureCodes,
      failureCount: failures.length
    };
  });

  const report = {
    schemaVersion: 1,
    generatedBy:
      "searchlint-hosted-github-governance-evidence-verifier-self-test",
    generatedAt,
    status: results.every((result) => result.status === "PASS")
      ? "passed"
      : "failed",
    caseCount: results.length,
    passedCaseCount: results.filter((result) => result.status === "PASS")
      .length,
    failedCaseCount: results.filter((result) => result.status === "FAIL")
      .length,
    cases: results,
    nonClaims: [
      "Self-test does not create real hosted GitHub evidence.",
      "Self-test does not close protected branch or required-CI release gates.",
      "Real hosted GitHub evidence remains owner-provided external proof."
    ]
  };

  assertNoSensitiveValues(JSON.stringify(report));
  await writeJson(selfTestReportPath, report);
  await writeJson(selfTestSamplePath, report);

  if (report.status !== "passed") {
    throw new Error("Hosted GitHub governance evidence self-test failed.");
  }

  console.log(
    `Hosted GitHub governance evidence self-test PASS: ${report.passedCaseCount}/${report.caseCount} cases passed`
  );
  console.log(`Report: ${selfTestReportPath}`);
  console.log(`Sample: ${selfTestSamplePath}`);
}

function validateEvidence(value) {
  const failures = [];
  requireEqual(value.schemaVersion, 1, "schemaVersion", failures);
  requireNonEmptyString(value.evidenceId, "evidenceId", failures);
  requireIsoDate(value.providedAt, "providedAt", failures);
  validateProvidedBy(value.providedBy, failures);
  validateRepository(value.repository, failures);
  validateCollection(value.collection, failures);
  validateBranchProtection(value.branchProtection, failures);
  validateCi(value.ci, failures);
  requireNonEmptyString(
    value.sensitiveDataStatement,
    "sensitiveDataStatement",
    failures
  );
  requireNonEmptyString(value.signedStatement, "signedStatement", failures);

  const serialized = JSON.stringify(value);
  const sensitive = sensitivePatternMatch(serialized);
  if (sensitive) {
    failures.push({
      code: "sensitive_value",
      path: "$",
      message: `Evidence appears to include sensitive material: ${sensitive}`
    });
  }
  for (const match of placeholderValueMatches(value)) {
    failures.push({
      code: "placeholder_value",
      path: match.path,
      message: `Replace template placeholder ${JSON.stringify(match.value)} with real sanitized evidence.`
    });
  }
  return failures;
}

function validEvidence() {
  return {
    schemaVersion: 1,
    evidenceId: "github-governance-main-2026-06-23",
    providedAt: "2026-06-23T00:00:00.000Z",
    providedBy: {
      name: "SearchLint Release Owner",
      role: "Release owner"
    },
    repository: {
      slug: "searchlint/searchlint",
      url: "https://github.com/searchlint/searchlint",
      defaultBranch: "main"
    },
    collection: {
      collectedAt: "2026-06-23T00:00:00.000Z",
      commands: [
        "gh api repos/searchlint/searchlint/branches/main/protection",
        "gh run list --workflow ci.yml --branch main --status success --limit 1"
      ]
    },
    branchProtection: {
      branch: "main",
      requiredStatusChecks: {
        strict: true,
        contexts: [...requiredChecks]
      },
      pullRequestReviews: {
        requiredApprovingReviewCount: 1,
        dismissStaleReviews: true
      },
      requiredConversationResolution: true,
      requiredLinearHistory: true,
      allowForcePushes: false,
      allowDeletions: false
    },
    ci: {
      workflowPath: ".github/workflows/ci.yml",
      requiredChecks: [...requiredChecks],
      latestSuccessfulRun: {
        runId: "1234567890",
        headSha: "abcdef1234567890abcdef1234567890abcdef12",
        url: "https://github.com/searchlint/searchlint/actions/runs/1234567890",
        completedAt: "2026-06-23T00:00:00.000Z",
        conclusion: "success"
      }
    },
    sensitiveDataStatement:
      "This evidence contains no tokens, credentials, private keys, or secrets.",
    signedStatement:
      "I confirm this evidence was collected from the real hosted GitHub repository and proves main branch protection plus required CI checks before merge."
  };
}

function mutate(value, applyMutation) {
  const copy = JSON.parse(JSON.stringify(value));
  applyMutation(copy);
  return copy;
}

function validateProvidedBy(value, failures) {
  if (!isPlainObject(value)) {
    failures.push({
      code: "missing_provided_by",
      path: "providedBy",
      message: "providedBy must be an object."
    });
    return;
  }
  requireNonEmptyString(value.name, "providedBy.name", failures);
  requireNonEmptyString(value.role, "providedBy.role", failures);
}

function validateRepository(value, failures) {
  if (!isPlainObject(value)) {
    failures.push({
      code: "missing_repository",
      path: "repository",
      message: "repository must be an object."
    });
    return;
  }
  requirePattern(
    value.slug,
    /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u,
    "repository.slug",
    failures
  );
  requirePattern(
    value.url,
    /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u,
    "repository.url",
    failures
  );
  requireEqual(
    value.defaultBranch,
    "main",
    "repository.defaultBranch",
    failures
  );
}

function validateCollection(value, failures) {
  if (!isPlainObject(value)) {
    failures.push({
      code: "missing_collection",
      path: "collection",
      message: "collection must be an object."
    });
    return;
  }
  requireIsoDate(value.collectedAt, "collection.collectedAt", failures);
  if (!Array.isArray(value.commands) || value.commands.length < 2) {
    failures.push({
      code: "invalid_collection_commands",
      path: "collection.commands",
      message:
        "collection.commands must include the GitHub API and CI run commands."
    });
  }
}

function validateBranchProtection(value, failures) {
  if (!isPlainObject(value)) {
    failures.push({
      code: "missing_branch_protection",
      path: "branchProtection",
      message: "branchProtection must be an object."
    });
    return;
  }
  requireEqual(value.branch, "main", "branchProtection.branch", failures);
  const statusChecks = value.requiredStatusChecks;
  if (!isPlainObject(statusChecks)) {
    failures.push({
      code: "missing_required_status_checks",
      path: "branchProtection.requiredStatusChecks",
      message: "requiredStatusChecks must be an object."
    });
  } else {
    requireEqual(
      statusChecks.strict,
      true,
      "branchProtection.requiredStatusChecks.strict",
      failures
    );
    validateRequiredChecks(
      statusChecks.contexts,
      "branchProtection.requiredStatusChecks.contexts",
      failures
    );
  }

  const reviews = value.pullRequestReviews;
  if (!isPlainObject(reviews)) {
    failures.push({
      code: "missing_pull_request_reviews",
      path: "branchProtection.pullRequestReviews",
      message: "pullRequestReviews must be an object."
    });
  } else {
    if (reviews.requiredApprovingReviewCount < 1) {
      failures.push({
        code: "insufficient_review_requirement",
        path: "branchProtection.pullRequestReviews.requiredApprovingReviewCount",
        message: "At least one approving review is required."
      });
    }
    requireEqual(
      reviews.dismissStaleReviews,
      true,
      "branchProtection.pullRequestReviews.dismissStaleReviews",
      failures
    );
  }

  requireEqual(
    value.requiredConversationResolution,
    true,
    "branchProtection.requiredConversationResolution",
    failures
  );
  requireEqual(
    value.requiredLinearHistory,
    true,
    "branchProtection.requiredLinearHistory",
    failures
  );
  requireEqual(
    value.allowForcePushes,
    false,
    "branchProtection.allowForcePushes",
    failures
  );
  requireEqual(
    value.allowDeletions,
    false,
    "branchProtection.allowDeletions",
    failures
  );
}

function validateCi(value, failures) {
  if (!isPlainObject(value)) {
    failures.push({
      code: "missing_ci",
      path: "ci",
      message: "ci must be an object."
    });
    return;
  }
  requireEqual(
    value.workflowPath,
    ".github/workflows/ci.yml",
    "ci.workflowPath",
    failures
  );
  validateRequiredChecks(value.requiredChecks, "ci.requiredChecks", failures);

  const run = value.latestSuccessfulRun;
  if (!isPlainObject(run)) {
    failures.push({
      code: "missing_latest_successful_run",
      path: "ci.latestSuccessfulRun",
      message: "latestSuccessfulRun must be an object."
    });
    return;
  }
  requireNonEmptyString(run.runId, "ci.latestSuccessfulRun.runId", failures);
  requirePattern(
    run.headSha,
    /^[a-f0-9]{7,40}$/iu,
    "ci.latestSuccessfulRun.headSha",
    failures
  );
  requirePattern(
    run.url,
    /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/actions\/runs\/[0-9]+$/u,
    "ci.latestSuccessfulRun.url",
    failures
  );
  requireIsoDate(
    run.completedAt,
    "ci.latestSuccessfulRun.completedAt",
    failures
  );
  requireEqual(
    run.conclusion,
    "success",
    "ci.latestSuccessfulRun.conclusion",
    failures
  );
}

function validateRequiredChecks(actual, fieldPath, failures) {
  if (!Array.isArray(actual)) {
    failures.push({
      code: "required_checks_not_array",
      path: fieldPath,
      message: "Required checks must be an array."
    });
    return;
  }
  const missing = missingValues(requiredChecks, actual);
  const unexpected = actual.filter((check) => !requiredChecks.includes(check));
  if (missing.length > 0) {
    failures.push({
      code: "missing_required_checks",
      path: fieldPath,
      message: `Missing required checks: ${missing.join(", ")}`
    });
  }
  if (unexpected.length > 0) {
    failures.push({
      code: "unexpected_required_checks",
      path: fieldPath,
      message: `Unexpected checks: ${unexpected.join(", ")}`
    });
  }
}

function requireEqual(actual, expected, fieldPath, failures) {
  if (actual !== expected) {
    failures.push({
      code: "unexpected_value",
      path: fieldPath,
      message: `${fieldPath} must be ${JSON.stringify(expected)}.`
    });
  }
}

function requireNonEmptyString(value, fieldPath, failures) {
  if (typeof value !== "string" || value.trim().length === 0) {
    failures.push({
      code: "missing_string",
      path: fieldPath,
      message: `${fieldPath} must be a non-empty string.`
    });
  }
}

function requirePattern(value, pattern, fieldPath, failures) {
  if (typeof value !== "string" || !pattern.test(value)) {
    failures.push({
      code: "invalid_format",
      path: fieldPath,
      message: `${fieldPath} has invalid format.`
    });
  }
}

function requireIsoDate(value, fieldPath, failures) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u.test(value)
  ) {
    failures.push({
      code: "invalid_iso_date",
      path: fieldPath,
      message: `${fieldPath} must be an ISO-8601 UTC timestamp.`
    });
  }
}

function missingValues(expected, actual) {
  const actualSet = new Set(actual);
  return expected.filter((value) => !actualSet.has(value));
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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

function placeholderValueMatches(value) {
  const matches = [];
  walk(value, "$", matches);
  return matches;
}

function walk(value, currentPath, matches) {
  if (typeof value === "string") {
    if (value.includes("REPLACE_WITH_")) {
      matches.push({
        path: currentPath,
        value
      });
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      walk(item, `${currentPath}[${index}]`, matches)
    );
    return;
  }
  if (isPlainObject(value)) {
    for (const [key, nested] of Object.entries(value)) {
      walk(nested, `${currentPath}.${key}`, matches);
    }
  }
}

async function writeReports(report) {
  await writeJson(reportPath, report);
  await writeJson(samplePath, report);
}

async function writeJson(filePath, report) {
  const prettier = await import("prettier");
  const formatted = await prettier.format(JSON.stringify(report), {
    parser: "json"
  });
  await mkdir(path.join(repoRoot, path.dirname(filePath)), {
    recursive: true
  });
  await writeFile(path.join(repoRoot, filePath), formatted);
}

function assertNoSensitiveValues(serialized) {
  const sensitive = sensitivePatternMatch(serialized);
  if (sensitive) {
    throw new Error(
      `Generated report contains sensitive material: ${sensitive}`
    );
  }
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
