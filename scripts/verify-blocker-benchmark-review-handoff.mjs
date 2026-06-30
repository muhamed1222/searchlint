#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { format } from "prettier";

const benchmarkPath = "reports/blocker-precision-report.json";
const reviewDir = "docs/reviews/blocker-benchmark";
const handoffManifestPath = `${reviewDir}/HANDOFF_MANIFEST.json`;
const caseIndexPath = `${reviewDir}/BENCHMARK_CASE_INDEX.json`;
const reportPath = "reports/blocker-benchmark-review-handoff-report.json";
const samplePath =
  "docs/examples/blocker-benchmark-review-handoff-report.sample.json";
const generatedAt = "2026-06-23T00:00:00.000Z";

const requiredPacketFiles = [
  `${reviewDir}/README.md`,
  `${reviewDir}/REVIEW_INSTRUCTIONS.md`,
  `${reviewDir}/REVIEW_FORM_TEMPLATE.md`,
  `${reviewDir}/ADJUDICATION_LOG.md`,
  `${reviewDir}/REVIEW_STATUS.md`,
  `${reviewDir}/reviewer-1.review.example.json`,
  `${reviewDir}/reviewer-2.review.example.json`
];
const reviewerOutputPaths = [
  `${reviewDir}/reviewer-1.review.json`,
  `${reviewDir}/reviewer-2.review.json`
];

await ensureBenchmarkReport();
const benchmark = JSON.parse(await readFile(benchmarkPath, "utf8"));
const caseIndex = expandBenchmarkCases(benchmark);
const requiredPacketEvidence = await verifyRequiredPacketFiles();
const handoffManifest = createHandoffManifest(caseIndex);
const report = createReport(requiredPacketEvidence, caseIndex, handoffManifest);

assertNoDuplicateCases(caseIndex.cases);
assertNoSensitiveValues(JSON.stringify(report));
assertNoSensitiveValues(JSON.stringify(handoffManifest));
assertNoSensitiveValues(JSON.stringify(caseIndex));

await writeJson(handoffManifestPath, handoffManifest);
await writeJson(caseIndexPath, caseIndex);
await writeJson(reportPath, report);
await writeJson(samplePath, report);

console.log(
  `Blocker benchmark review handoff PASS: ${caseIndex.cases.length} case(s), ${handoffManifest.blockerRuleIds.length} blocker rule(s)`
);
console.log(`Handoff manifest: ${handoffManifestPath}`);
console.log(`Case index: ${caseIndexPath}`);
console.log(`Report: ${reportPath}`);
console.log(`Sample: ${samplePath}`);

async function verifyRequiredPacketFiles() {
  const evidence = [];
  for (const filePath of requiredPacketFiles) {
    const text = await readFile(filePath, "utf8");
    evidence.push({
      path: filePath,
      bytes: Buffer.byteLength(text, "utf8"),
      sha256: sha256(text)
    });
  }
  return evidence;
}

async function ensureBenchmarkReport() {
  try {
    await access(benchmarkPath);
  } catch {
    execFileSync("pnpm", ["rule-qa"], {
      cwd: process.cwd(),
      env: process.env,
      stdio: "inherit"
    });
  }
}

function createHandoffManifest(caseIndex) {
  return {
    schemaVersion: 1,
    generatedBy: "searchlint-blocker-benchmark-review-handoff-verifier",
    generatedAt,
    status: "handoff-ready-reviewer-signoff-missing",
    benchmark: {
      path: benchmarkPath,
      benchmarkVersion: benchmark.benchmarkVersion,
      productVersion: benchmark.productVersion,
      ruleCatalogVersion: benchmark.ruleCatalogVersion,
      expectedCaseCount: caseIndex.cases.length,
      positiveCaseCount: caseIndex.summary.positiveCaseCount,
      negativeCaseCount: caseIndex.summary.negativeCaseCount,
      caseIndexPath,
      caseIndexSha256: sha256(JSON.stringify(caseIndex))
    },
    blockerRuleIds: benchmark.blockerRuleIds,
    requiredPacketFiles,
    reviewerOutputPaths,
    requiredReviewerCount: 2,
    ownerNextActions: [
      "Send the review packet and benchmark case index to two independent reviewers.",
      "Collect reviewer-1.review.json and reviewer-2.review.json from real reviewers.",
      "Place the real reviewer files at the documented output paths.",
      "Run pnpm rule-qa:review.",
      "Adjudicate rejected, disputed, or conflicting cases before claiming OD-023 pass."
    ],
    nonClaims: [
      "review packet delivered to reviewers",
      "independent reviewer sign-off exists",
      "OD-023 release gate passed",
      "reviewer files created by Codex"
    ]
  };
}

function createReport(requiredPacketEvidence, caseIndex, handoffManifest) {
  return {
    schemaVersion: 1,
    generatedBy: "searchlint-blocker-benchmark-review-handoff-verifier",
    generatedAt,
    status: "passed",
    scope: {
      proofType: "blocker benchmark independent-review handoff packet",
      doesNotClaim: handoffManifest.nonClaims
    },
    benchmark: handoffManifest.benchmark,
    requiredPacketFiles: requiredPacketEvidence,
    reviewerOutputPaths,
    blockerRuleIds: benchmark.blockerRuleIds,
    caseSummary: caseIndex.summary,
    releaseGate: {
      passFail: "blocked",
      blockers: [
        "review packet delivery is not evidenced",
        "reviewer-1.review.json is missing",
        "reviewer-2.review.json is missing",
        "pnpm rule-qa:review is expected to fail until real reviewer files exist"
      ]
    }
  };
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
        fixtureId: positiveFixture,
        polarity: "positive",
        expectedResult: "trigger"
      });
    }
    for (let index = 1; index <= (rule.negativeUnits ?? 0); index += 1) {
      cases.push({
        caseId: `${rule.ruleId}:negative:${negativeFixture}:${String(index).padStart(3, "0")}`,
        ruleId: rule.ruleId,
        fixtureId: negativeFixture,
        polarity: "negative",
        expectedResult: "no-trigger"
      });
    }
  }
  return {
    schemaVersion: 1,
    generatedBy: "searchlint-blocker-benchmark-review-handoff-verifier",
    generatedAt,
    benchmarkVersion: report.benchmarkVersion,
    expectedCaseCount: cases.length,
    summary: {
      blockerRuleCount: report.blockerRuleIds?.length ?? 0,
      positiveCaseCount: cases.filter((entry) => entry.polarity === "positive")
        .length,
      negativeCaseCount: cases.filter((entry) => entry.polarity === "negative")
        .length,
      trainingFixturesExcluded:
        report.provenance?.trainingFixturesExcluded === true,
      privacy: report.provenance?.privacy ?? null
    },
    cases
  };
}

function assertNoDuplicateCases(cases) {
  const seen = new Set();
  for (const entry of cases) {
    if (seen.has(entry.caseId)) {
      throw new Error(`Duplicate benchmark case ID: ${entry.caseId}`);
    }
    seen.add(entry.caseId);
  }
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
      `Sensitive value leaked into blocker benchmark review handoff evidence: ${match}`
    );
  }
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(
    filePath,
    await format(`${JSON.stringify(value, null, 2)}\n`, { parser: "json" })
  );
}
