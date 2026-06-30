#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { format } from "prettier";

const root = process.cwd();
const generatedAt = "2026-06-23T00:00:00.000Z";
const reportPath =
  "reports/reviewer-rule-quality-preflight-self-test-report.json";
const samplePath =
  "docs/examples/reviewer-rule-quality-preflight-self-test-report.sample.json";
const deliveryVerifier = path.join(
  root,
  "scripts/verify-blocker-benchmark-review-delivery.mjs"
);
const reviewVerifier = path.join(
  root,
  "scripts/verify-blocker-benchmark-review.mjs"
);
const handoffPath = "docs/reviews/blocker-benchmark/HANDOFF_MANIFEST.json";
const deliveryExamplePath =
  "docs/reviews/blocker-benchmark/DELIVERY_EVIDENCE.example.json";
const reviewerOneExamplePath =
  "docs/reviews/blocker-benchmark/reviewer-1.review.example.json";
const reviewerTwoExamplePath =
  "docs/reviews/blocker-benchmark/reviewer-2.review.example.json";
const benchmarkReportPath = "reports/blocker-precision-report.json";

const handoff = await readJson(handoffPath);
const deliveryExample = await readJson(deliveryExamplePath);
const reviewerOneExample = await readJson(reviewerOneExamplePath);
const reviewerTwoExample = await readJson(reviewerTwoExamplePath);
const benchmarkReport = await readJson(benchmarkReportPath);
const expectedCaseIds = expandBenchmarkCaseIds(benchmarkReport);
const cases = [];

cases.push(
  await runDeliveryCase("valid-delivery-evidence", validDeliveryEvidence(), 0)
);
cases.push(
  await runDeliveryCase("copied-delivery-example", deliveryExample, 1)
);
cases.push(await runReviewCase("valid-reviewer-files", validReviewerPair(), 0));
cases.push(
  await runReviewCase(
    "copied-reviewer-examples",
    [reviewerOneExample, reviewerTwoExample],
    1
  )
);
cases.push(
  await runReviewCase(
    "incomplete-reviewer-coverage",
    incompleteReviewerPair(),
    1
  )
);

const report = {
  schemaVersion: 1,
  generatedBy: "searchlint-reviewer-rule-quality-preflight-self-test",
  generatedAt,
  status: cases.every((entry) => entry.pass) ? "passed" : "failed",
  benchmark: {
    benchmarkVersion: benchmarkReport.benchmarkVersion,
    expectedCaseCount: expectedCaseIds.length,
    handoffExpectedCaseCount: handoff.benchmark.expectedCaseCount
  },
  cases,
  nonClaims: [
    "Self-test evidence is synthetic and temporary.",
    "Self-test does not create repository owner evidence.",
    "Self-test does not claim independent reviewer approval.",
    "OD-023 remains blocked until real owner/reviewer inputs exist."
  ]
};

assertNoSensitiveValues(JSON.stringify(report));
await writeJson(reportPath, report);
await writeJson(samplePath, report);

if (report.status !== "passed") {
  console.error("Reviewer rule-quality preflight self-test failed.");
  for (const entry of cases.filter((item) => !item.pass)) {
    console.error(
      `- ${entry.id}: expected ${entry.expectedExitCode}, got ${entry.exitCode}`
    );
  }
  console.error(`Report: ${reportPath}`);
  process.exit(1);
}

console.log(
  `Reviewer rule-quality preflight self-test PASS: ${cases.length}/${cases.length} cases passed`
);
console.log(`Report: ${reportPath}`);
console.log(`Sample: ${samplePath}`);

async function runDeliveryCase(id, deliveryEvidence, expectedExitCode) {
  const workspace = await createBaseWorkspace();
  try {
    await writeJsonInWorkspace(
      workspace,
      "docs/reviews/blocker-benchmark/DELIVERY_EVIDENCE.json",
      deliveryEvidence
    );
    return runCase(id, workspace, deliveryVerifier, expectedExitCode);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
}

async function runReviewCase(id, reviewers, expectedExitCode) {
  const workspace = await createBaseWorkspace();
  try {
    await writeJsonInWorkspace(
      workspace,
      "docs/reviews/blocker-benchmark/reviewer-1.review.json",
      reviewers[0]
    );
    await writeJsonInWorkspace(
      workspace,
      "docs/reviews/blocker-benchmark/reviewer-2.review.json",
      reviewers[1]
    );
    return runCase(id, workspace, reviewVerifier, expectedExitCode);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
}

async function createBaseWorkspace() {
  const workspace = await mkdtemp(
    path.join(os.tmpdir(), "searchlint-reviewer-preflight-")
  );
  await mkdir(path.join(workspace, "docs/reviews/blocker-benchmark"), {
    recursive: true
  });
  await mkdir(path.join(workspace, "reports"), { recursive: true });
  await mkdir(path.join(workspace, "docs/examples"), { recursive: true });
  await cp(path.join(root, handoffPath), path.join(workspace, handoffPath), {
    recursive: true
  });
  await cp(
    path.join(root, benchmarkReportPath),
    path.join(workspace, benchmarkReportPath),
    { recursive: true }
  );
  return workspace;
}

function runCase(id, workspace, scriptPath, expectedExitCode) {
  const result = runNodeScript(workspace, scriptPath);
  return {
    id,
    expectedExitCode,
    exitCode: result.exitCode,
    pass: result.exitCode === expectedExitCode,
    outputSummary: result.outputSummary
  };
}

function runNodeScript(workspace, scriptPath) {
  try {
    const stdout = execFileSync(process.execPath, [scriptPath], {
      cwd: workspace,
      env: process.env,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });
    return {
      exitCode: 0,
      outputSummary: summarizeOutput(stdout)
    };
  } catch (error) {
    return {
      exitCode: typeof error.status === "number" ? error.status : 1,
      outputSummary: summarizeOutput(
        [error.stdout, error.stderr].filter(Boolean).join("\n")
      )
    };
  }
}

function validDeliveryEvidence() {
  return {
    ...deliveryExample,
    deliveredAt: "2026-06-23T12:00:00.000Z",
    deliveryChannel: "owner-email-to-reviewers",
    intendedReviewers: [
      {
        ...deliveryExample.intendedReviewers[0],
        reviewerDisplayName: "Reviewer Alpha",
        independenceStatement:
          "Reviewer Alpha confirmed they did not author blocker benchmark fixtures or SearchLint rule implementation."
      },
      {
        ...deliveryExample.intendedReviewers[1],
        reviewerDisplayName: "Reviewer Beta",
        independenceStatement:
          "Reviewer Beta confirmed they did not author blocker benchmark fixtures or SearchLint rule implementation."
      }
    ],
    ownerAttestation: {
      ...deliveryExample.ownerAttestation,
      signedStatement:
        "I delivered the listed blocker benchmark review packet to Reviewer Alpha and Reviewer Beta on the stated date. This delivery record does not claim reviewer approval."
    }
  };
}

function validReviewerPair() {
  return [
    validReview("reviewer-1", "Reviewer Alpha"),
    validReview("reviewer-2", "Reviewer Beta")
  ];
}

function incompleteReviewerPair() {
  const [first, second] = validReviewerPair();
  return [
    {
      ...first,
      reviewedCaseCount: 1,
      approvedCaseIds: [expectedCaseIds[0]]
    },
    second
  ];
}

function validReview(reviewerId, reviewerName) {
  return {
    schemaVersion: 1,
    reviewerId,
    reviewerName,
    reviewedAt: "2026-06-23T12:00:00.000Z",
    benchmarkVersion: benchmarkReport.benchmarkVersion,
    reviewedCaseCount: expectedCaseIds.length,
    approvedCaseIds: expectedCaseIds,
    rejectedCaseIds: [],
    disputedCaseIds: [],
    comments: [],
    signedStatement: `${reviewerName} independently reviewed the blocker benchmark expected results for the listed benchmark version.`
  };
}

function expandBenchmarkCaseIds(report) {
  const caseIds = [];
  for (const rule of report.perRule ?? []) {
    const positiveFixture = rule.fixtures?.positive;
    const negativeFixture = rule.fixtures?.negative;
    for (let index = 1; index <= (rule.positiveUnits ?? 0); index += 1) {
      caseIds.push(
        `${rule.ruleId}:positive:${positiveFixture}:${String(index).padStart(3, "0")}`
      );
    }
    for (let index = 1; index <= (rule.negativeUnits ?? 0); index += 1) {
      caseIds.push(
        `${rule.ruleId}:negative:${negativeFixture}:${String(index).padStart(3, "0")}`
      );
    }
  }
  return caseIds;
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(
    filePath,
    await format(JSON.stringify(value), { parser: "json" })
  );
}

async function writeJsonInWorkspace(workspace, filePath, value) {
  await writeJson(path.join(workspace, filePath), value);
}

function summarizeOutput(output) {
  return String(output)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-10);
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
      `Self-test report contains sensitive material: ${sensitive}`
    );
  }
}
