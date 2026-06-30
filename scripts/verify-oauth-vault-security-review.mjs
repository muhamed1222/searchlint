#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { format } from "prettier";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const generatedAt = "2026-06-22T00:00:00.000Z";
const reviewDir = "docs/reviews/oauth-vault-security";
const reviewScopePath = `${reviewDir}/review-scope.json`;
const reviewerPaths = [
  `${reviewDir}/reviewer-1.review.json`,
  `${reviewDir}/reviewer-2.review.json`
];
const reportPath = path.join(
  repoRoot,
  "reports/oauth-vault-security-review-report.json"
);
const samplePath = path.join(
  repoRoot,
  "docs/examples/oauth-vault-security-review-report.sample.json"
);

function run(command, args) {
  execFileSync(command, args, {
    cwd: repoRoot,
    env: process.env,
    encoding: "utf8",
    stdio: "inherit"
  });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  run("pnpm", ["oauth-vault:kms-static"]);
  run("pnpm", ["oauth-vault:secrets-static"]);
  run("pnpm", ["oauth-vault:acceptance"]);

  const scope = await readJson(reviewScopePath);
  const evidenceIds = scope.evidence.map((item) => item.id);
  const missingReviewerFiles = [];
  const reviewers = [];

  for (const reviewerPath of reviewerPaths) {
    try {
      reviewers.push(await readJson(reviewerPath));
    } catch (error) {
      if (error?.code === "ENOENT") {
        missingReviewerFiles.push(reviewerPath);
      } else {
        throw error;
      }
    }
  }

  if (missingReviewerFiles.length > 0) {
    await writeReport({
      status: "blocked-missing-reviewer-signoff",
      scope,
      reviewers: [],
      missingReviewerFiles,
      disagreements: [],
      rejectedEvidenceIds: [],
      disputedEvidenceIds: [],
      releaseGatePassed: false
    });
    throw new Error(
      `OAuth vault security review BLOCKED: missing real reviewer files: ${missingReviewerFiles.join(
        ", "
      )}. Example .json files do not count as sign-off.`
    );
  }

  assert(
    reviewers.length === scope.requiredReviewerCount,
    `Expected ${scope.requiredReviewerCount} reviewer files.`
  );

  const reviewerIds = new Set(reviewers.map((reviewer) => reviewer.reviewerId));
  assert(
    reviewerIds.size === reviewers.length,
    "Reviewer files must use distinct reviewerId values."
  );

  const summaries = reviewers.map((reviewer, index) =>
    validateReviewer(reviewer, index + 1, scope, evidenceIds)
  );

  const disagreements = findDisagreements(summaries, evidenceIds);
  const rejectedEvidenceIds = uniqueFlat(
    summaries.map((summary) => summary.rejectedEvidenceIds)
  );
  const disputedEvidenceIds = uniqueFlat(
    summaries.map((summary) => summary.disputedEvidenceIds)
  );

  await writeReport({
    status:
      disagreements.length === 0 &&
      rejectedEvidenceIds.length === 0 &&
      disputedEvidenceIds.length === 0
        ? "passed"
        : "blocked-review-issues",
    scope,
    reviewers: summaries,
    missingReviewerFiles: [],
    disagreements,
    rejectedEvidenceIds,
    disputedEvidenceIds,
    releaseGatePassed:
      disagreements.length === 0 &&
      rejectedEvidenceIds.length === 0 &&
      disputedEvidenceIds.length === 0
  });

  assert(
    disagreements.length === 0,
    `OAuth vault security review BLOCKED: reviewer disagreements for ${disagreements
      .map((item) => item.evidenceId)
      .join(", ")}.`
  );
  assert(
    rejectedEvidenceIds.length === 0,
    `OAuth vault security review BLOCKED: rejected evidence ${rejectedEvidenceIds.join(
      ", "
    )}.`
  );
  assert(
    disputedEvidenceIds.length === 0,
    `OAuth vault security review BLOCKED: disputed evidence ${disputedEvidenceIds.join(
      ", "
    )}.`
  );

  console.log("OAuth vault security review PASS: two reviewer sign-offs valid");
  console.log(`Report: ${path.relative(repoRoot, reportPath)}`);
  console.log(`Sample: ${path.relative(repoRoot, samplePath)}`);
}

function validateReviewer(reviewer, ordinal, scope, evidenceIds) {
  assert(
    reviewer.schemaVersion === 1,
    `Reviewer ${ordinal} schemaVersion must be 1.`
  );
  for (const field of [
    "reviewerId",
    "reviewerName",
    "reviewedAt",
    "reviewScopeVersion",
    "signedStatement"
  ]) {
    assert(
      typeof reviewer[field] === "string" && reviewer[field].length > 0,
      `Reviewer ${ordinal} missing ${field}.`
    );
  }
  assert(
    reviewer.reviewScopeVersion === scope.reviewScopeVersion,
    `Reviewer ${ordinal} reviewScopeVersion mismatch.`
  );
  assert(
    reviewer.signedStatement === scope.requiredSignedStatement,
    `Reviewer ${ordinal} signedStatement mismatch.`
  );

  const reviewedEvidenceIds = requiredStringArray(
    reviewer.reviewedEvidenceIds,
    `Reviewer ${ordinal} reviewedEvidenceIds`
  );
  const approvedEvidenceIds = requiredStringArray(
    reviewer.approvedEvidenceIds,
    `Reviewer ${ordinal} approvedEvidenceIds`
  );
  const rejectedEvidenceIds = requiredStringArray(
    reviewer.rejectedEvidenceIds,
    `Reviewer ${ordinal} rejectedEvidenceIds`
  );
  const disputedEvidenceIds = requiredStringArray(
    reviewer.disputedEvidenceIds,
    `Reviewer ${ordinal} disputedEvidenceIds`
  );

  assertSameSet(
    reviewedEvidenceIds,
    evidenceIds,
    `Reviewer ${ordinal} must review every evidence id.`
  );
  assertKnownIds(
    [...approvedEvidenceIds, ...rejectedEvidenceIds, ...disputedEvidenceIds],
    evidenceIds,
    `Reviewer ${ordinal}`
  );
  assertNoDuplicates(
    [...approvedEvidenceIds, ...rejectedEvidenceIds, ...disputedEvidenceIds],
    `Reviewer ${ordinal} evidence classifications`
  );
  assertSameSet(
    [...approvedEvidenceIds, ...rejectedEvidenceIds, ...disputedEvidenceIds],
    evidenceIds,
    `Reviewer ${ordinal} must classify every evidence id exactly once.`
  );

  return {
    reviewerId: reviewer.reviewerId,
    reviewerName: reviewer.reviewerName,
    reviewedAt: reviewer.reviewedAt,
    reviewScopeVersion: reviewer.reviewScopeVersion,
    reviewedEvidenceIds,
    approvedEvidenceIds,
    rejectedEvidenceIds,
    disputedEvidenceIds
  };
}

function findDisagreements(summaries, evidenceIds) {
  return evidenceIds.flatMap((evidenceId) => {
    const statuses = summaries.map((summary) => ({
      reviewerId: summary.reviewerId,
      status: statusFor(summary, evidenceId)
    }));
    const uniqueStatuses = new Set(statuses.map((item) => item.status));
    return uniqueStatuses.size === 1 ? [] : [{ evidenceId, statuses }];
  });
}

function statusFor(summary, evidenceId) {
  if (summary.approvedEvidenceIds.includes(evidenceId)) {
    return "approved";
  }
  if (summary.rejectedEvidenceIds.includes(evidenceId)) {
    return "rejected";
  }
  if (summary.disputedEvidenceIds.includes(evidenceId)) {
    return "disputed";
  }
  return "missing";
}

function requiredStringArray(value, label) {
  assert(Array.isArray(value), `${label} must be an array.`);
  for (const item of value) {
    assert(typeof item === "string" && item.length > 0, `${label} invalid id.`);
  }
  return value;
}

function assertKnownIds(ids, knownIds, label) {
  for (const id of ids) {
    assert(knownIds.includes(id), `${label} uses unknown evidence id ${id}.`);
  }
}

function assertNoDuplicates(ids, label) {
  assert(new Set(ids).size === ids.length, `${label} contains duplicates.`);
}

function assertSameSet(actual, expected, message) {
  const actualSorted = [...actual].sort();
  const expectedSorted = [...expected].sort();
  assert(
    actualSorted.length === expectedSorted.length &&
      actualSorted.every((value, index) => value === expectedSorted[index]),
    message
  );
}

function uniqueFlat(arrays) {
  return [...new Set(arrays.flat())].sort();
}

async function readText(relativePath) {
  return readFile(path.join(repoRoot, relativePath), "utf8");
}

async function readJson(relativePath) {
  return JSON.parse(await readText(relativePath));
}

async function writeReport(result) {
  const report = {
    schemaVersion: 1,
    generatedBy: "searchlint-oauth-vault-security-review-verifier",
    generatedAt,
    reviewScopeVersion: result.scope.reviewScopeVersion,
    status: result.status,
    releaseGatePassed: result.releaseGatePassed,
    requiredReviewerCount: result.scope.requiredReviewerCount,
    missingReviewerFiles: result.missingReviewerFiles,
    reviewerCount: result.reviewers.length,
    reviewers: result.reviewers,
    evidenceIds: result.scope.evidence.map((item) => item.id),
    disagreements: result.disagreements,
    rejectedEvidenceIds: result.rejectedEvidenceIds,
    disputedEvidenceIds: result.disputedEvidenceIds,
    exampleFilesDoNotCount: true,
    remainingReleaseGates:
      result.releaseGatePassed === true
        ? []
        : [
            "provide reviewer-1.review.json",
            "provide reviewer-2.review.json",
            "resolve rejected evidence",
            "adjudicate disputed evidence",
            "rerun pnpm oauth-vault:security-review"
          ]
  };

  await writeJson(reportPath, report);
  await writeJson(samplePath, report);
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const json = await format(`${JSON.stringify(value, null, 2)}\n`, {
    parser: "json"
  });
  await writeFile(filePath, json, "utf8");
}

main().catch((error) => {
  console.error(
    error instanceof Error
      ? error.message
      : "Unknown OAuth vault security review verification error"
  );
  process.exitCode = 1;
});
