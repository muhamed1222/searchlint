#!/usr/bin/env node
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { format } from "prettier";

const reviewDir = "docs/reviews/blocker-benchmark";
const handoffManifestPath = `${reviewDir}/HANDOFF_MANIFEST.json`;
const deliveryEvidencePath = `${reviewDir}/DELIVERY_EVIDENCE.json`;
const deliveryEvidenceExamplePath = `${reviewDir}/DELIVERY_EVIDENCE.example.json`;
const reportPath = "reports/blocker-benchmark-review-delivery-report.json";
const samplePath =
  "docs/examples/blocker-benchmark-review-delivery-report.sample.json";
const generatedAt = "2026-06-23T00:00:00.000Z";

const handoff = await readJson(handoffManifestPath);
const requiredPacketFiles = unique([
  handoffManifestPath,
  handoff.benchmark.caseIndexPath,
  ...(handoff.requiredPacketFiles ?? [])
]);

const exampleTemplate = createExampleTemplate(handoff);
await writeJson(deliveryEvidenceExamplePath, exampleTemplate);

const deliveryEvidence = await readOptionalJson(deliveryEvidencePath);
const issues = [];

if (!deliveryEvidence) {
  issues.push({
    severity: "blocker",
    code: "missing-delivery-evidence",
    message: `Missing owner-provided delivery evidence file: ${deliveryEvidencePath}`
  });
} else {
  issues.push(...validateDeliveryEvidence(deliveryEvidence, handoff));
}

const releaseGate = {
  passFail: issues.length === 0 ? "pass" : "blocked",
  gates: {
    deliveryEvidenceFilePresent: Boolean(deliveryEvidence),
    benchmarkVersionMatches:
      deliveryEvidence?.benchmarkVersion === handoff.benchmark.benchmarkVersion,
    caseIndexSha256Matches:
      deliveryEvidence?.caseIndexSha256 === handoff.benchmark.caseIndexSha256,
    twoDistinctIntendedReviewers:
      countDistinctReviewerIds(deliveryEvidence?.intendedReviewers ?? []) >= 2,
    deliveryTimestampPresent: isNonEmptyString(deliveryEvidence?.deliveredAt),
    deliveryChannelPresent: isNonEmptyString(deliveryEvidence?.deliveryChannel),
    requiredPacketFilesDelivered:
      deliveryEvidence != null &&
      requiredPacketFiles.every((filePath) =>
        deliveryEvidence.deliveredPacketFiles?.includes(filePath)
      ),
    ownerAttestationPresent:
      deliveryEvidence?.ownerAttestation?.packetSent === true &&
      deliveryEvidence?.ownerAttestation?.noReviewerSignoffClaimed === true &&
      deliveryEvidence?.ownerAttestation?.exampleFilesExcluded === true &&
      isNonEmptyString(deliveryEvidence?.ownerAttestation?.signedStatement)
  },
  failedGates: []
};
releaseGate.failedGates = Object.entries(releaseGate.gates)
  .filter(([, passed]) => !passed)
  .map(([gate]) => gate);

const report = {
  schemaVersion: 1,
  generatedBy: "searchlint-blocker-benchmark-review-delivery-verifier",
  generatedAt,
  status: releaseGate.passFail === "pass" ? "passed" : "blocked",
  deliveryEvidencePath,
  deliveryEvidenceExamplePath,
  handoffManifestPath,
  benchmark: {
    benchmarkVersion: handoff.benchmark.benchmarkVersion,
    caseIndexPath: handoff.benchmark.caseIndexPath,
    caseIndexSha256: handoff.benchmark.caseIndexSha256,
    expectedCaseCount: handoff.benchmark.expectedCaseCount,
    blockerRuleCount: handoff.blockerRuleIds.length
  },
  requiredPacketFiles,
  reviewerOutputPaths: handoff.reviewerOutputPaths,
  issues,
  releaseGate,
  nonClaims: [
    "independent reviewer sign-off exists",
    "OD-023 release gate passed",
    "reviewer files created by Codex",
    "delivery evidence fabricated by Codex"
  ]
};

assertNoSensitiveValues(JSON.stringify(exampleTemplate));
assertNoSensitiveValues(JSON.stringify(report));

await writeJson(reportPath, report);
await writeJson(samplePath, report);

if (releaseGate.passFail !== "pass") {
  console.error("Blocker benchmark review delivery gate blocked.");
  for (const issue of issues) {
    console.error(`- ${issue.code}: ${issue.message}`);
  }
  console.error(`Report: ${reportPath}`);
  process.exit(1);
}

console.log("Blocker benchmark review delivery gate passed.");
console.log(`Report: ${reportPath}`);
console.log(`Sample: ${samplePath}`);

function createExampleTemplate(handoffManifest) {
  return {
    schemaVersion: 1,
    evidenceType: "blocker-benchmark-review-delivery",
    benchmarkVersion: handoffManifest.benchmark.benchmarkVersion,
    caseIndexPath: handoffManifest.benchmark.caseIndexPath,
    caseIndexSha256: handoffManifest.benchmark.caseIndexSha256,
    deliveredAt: "2026-06-23T00:00:00.000Z",
    deliveryChannel: "owner-managed-channel",
    deliveredPacketFiles: requiredPacketFiles,
    intendedReviewers: [
      {
        reviewerId: "reviewer-1",
        reviewerDisplayName: "Independent reviewer 1",
        targetReviewFile: `${reviewDir}/reviewer-1.review.json`,
        independenceStatement:
          "Reviewer is independent from benchmark fixture authoring and rule implementation."
      },
      {
        reviewerId: "reviewer-2",
        reviewerDisplayName: "Independent reviewer 2",
        targetReviewFile: `${reviewDir}/reviewer-2.review.json`,
        independenceStatement:
          "Reviewer is independent from benchmark fixture authoring and rule implementation."
      }
    ],
    ownerAttestation: {
      packetSent: true,
      noReviewerSignoffClaimed: true,
      exampleFilesExcluded: true,
      signedStatement:
        "The owner delivered the listed packet files to the intended independent reviewers. This evidence records delivery only and does not claim reviewer approval."
    }
  };
}

function validateDeliveryEvidence(evidence, handoffManifest) {
  const validationIssues = [];

  if (evidence.schemaVersion !== 1) {
    validationIssues.push(
      issue("invalid-schema-version", "schemaVersion must be 1.")
    );
  }
  if (evidence.evidenceType !== "blocker-benchmark-review-delivery") {
    validationIssues.push(
      issue(
        "invalid-evidence-type",
        "evidenceType must be blocker-benchmark-review-delivery."
      )
    );
  }
  if (
    evidence.benchmarkVersion !== handoffManifest.benchmark.benchmarkVersion
  ) {
    validationIssues.push(
      issue(
        "benchmark-version-mismatch",
        `benchmarkVersion must match ${handoffManifest.benchmark.benchmarkVersion}.`
      )
    );
  }
  if (evidence.caseIndexPath !== handoffManifest.benchmark.caseIndexPath) {
    validationIssues.push(
      issue(
        "case-index-path-mismatch",
        `caseIndexPath must match ${handoffManifest.benchmark.caseIndexPath}.`
      )
    );
  }
  if (evidence.caseIndexSha256 !== handoffManifest.benchmark.caseIndexSha256) {
    validationIssues.push(
      issue(
        "case-index-sha-mismatch",
        `caseIndexSha256 must match ${handoffManifest.benchmark.caseIndexSha256}.`
      )
    );
  }
  if (!isNonEmptyString(evidence.deliveredAt)) {
    validationIssues.push(
      issue(
        "missing-delivered-at",
        "deliveredAt must be an ISO timestamp string."
      )
    );
  } else if (Number.isNaN(Date.parse(evidence.deliveredAt))) {
    validationIssues.push(
      issue(
        "invalid-delivered-at",
        "deliveredAt must parse as an ISO timestamp."
      )
    );
  }
  if (!isNonEmptyString(evidence.deliveryChannel)) {
    validationIssues.push(
      issue("missing-delivery-channel", "deliveryChannel must be present.")
    );
  } else if (evidence.deliveryChannel === "owner-managed-channel") {
    validationIssues.push(
      issue(
        "copied-delivery-template",
        "deliveryChannel must be replaced with a real delivery channel."
      )
    );
  }

  const deliveredFiles = evidence.deliveredPacketFiles;
  if (!Array.isArray(deliveredFiles)) {
    validationIssues.push(
      issue("missing-delivered-files", "deliveredPacketFiles must be an array.")
    );
  } else {
    for (const filePath of requiredPacketFiles) {
      if (!deliveredFiles.includes(filePath)) {
        validationIssues.push(
          issue(
            "required-packet-file-not-delivered",
            `deliveredPacketFiles must include ${filePath}.`
          )
        );
      }
    }
  }

  const reviewers = evidence.intendedReviewers;
  if (!Array.isArray(reviewers) || reviewers.length < 2) {
    validationIssues.push(
      issue(
        "missing-intended-reviewers",
        "intendedReviewers must contain at least two reviewers."
      )
    );
  } else {
    const reviewerIds = new Set();
    for (const reviewer of reviewers) {
      if (!isNonEmptyString(reviewer.reviewerId)) {
        validationIssues.push(
          issue("missing-reviewer-id", "Each reviewer must include reviewerId.")
        );
      } else {
        reviewerIds.add(reviewer.reviewerId);
      }
      if (!isNonEmptyString(reviewer.reviewerDisplayName)) {
        validationIssues.push(
          issue(
            "missing-reviewer-display-name",
            "Each reviewer must include reviewerDisplayName."
          )
        );
      } else if (
        /^Independent reviewer [12]$/u.test(reviewer.reviewerDisplayName)
      ) {
        validationIssues.push(
          issue(
            "copied-reviewer-template",
            "Reviewer display names must be replaced with real reviewer names or approved reviewer labels."
          )
        );
      }
      if (
        !handoffManifest.reviewerOutputPaths.includes(reviewer.targetReviewFile)
      ) {
        validationIssues.push(
          issue(
            "invalid-target-review-file",
            `Reviewer targetReviewFile must be one of ${handoffManifest.reviewerOutputPaths.join(", ")}.`
          )
        );
      }
      if (!isNonEmptyString(reviewer.independenceStatement)) {
        validationIssues.push(
          issue(
            "missing-independence-statement",
            "Each reviewer must include an independenceStatement."
          )
        );
      } else if (
        reviewer.independenceStatement ===
        "Reviewer is independent from benchmark fixture authoring and rule implementation."
      ) {
        validationIssues.push(
          issue(
            "copied-independence-template",
            "Reviewer independenceStatement must be replaced with a real reviewer-specific statement."
          )
        );
      }
    }
    if (reviewerIds.size < 2) {
      validationIssues.push(
        issue(
          "reviewers-not-distinct",
          "At least two distinct reviewerId values are required."
        )
      );
    }
  }

  const attestation = evidence.ownerAttestation;
  if (attestation?.packetSent !== true) {
    validationIssues.push(
      issue(
        "packet-not-attested-sent",
        "ownerAttestation.packetSent must be true."
      )
    );
  }
  if (attestation?.noReviewerSignoffClaimed !== true) {
    validationIssues.push(
      issue(
        "signoff-claim-not-disclaimed",
        "ownerAttestation.noReviewerSignoffClaimed must be true."
      )
    );
  }
  if (attestation?.exampleFilesExcluded !== true) {
    validationIssues.push(
      issue(
        "examples-not-excluded",
        "ownerAttestation.exampleFilesExcluded must be true."
      )
    );
  }
  if (!isNonEmptyString(attestation?.signedStatement)) {
    validationIssues.push(
      issue(
        "missing-owner-signed-statement",
        "ownerAttestation.signedStatement must be present."
      )
    );
  } else if (
    attestation.signedStatement ===
    "The owner delivered the listed packet files to the intended independent reviewers. This evidence records delivery only and does not claim reviewer approval."
  ) {
    validationIssues.push(
      issue(
        "copied-owner-attestation-template",
        "ownerAttestation.signedStatement must be replaced with a real owner statement."
      )
    );
  }

  return validationIssues;
}

function issue(code, message) {
  return {
    severity: "blocker",
    code,
    message
  };
}

function countDistinctReviewerIds(reviewers) {
  return new Set(
    reviewers
      .map((reviewer) => reviewer?.reviewerId)
      .filter((reviewerId) => isNonEmptyString(reviewerId))
  ).size;
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function unique(values) {
  return [...new Set(values)];
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
      `Sensitive value leaked into blocker benchmark review delivery evidence: ${match}`
    );
  }
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function readOptionalJson(filePath) {
  try {
    await access(filePath);
    return await readJson(filePath);
  } catch (error) {
    if (error?.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(
    filePath,
    await format(`${JSON.stringify(value, null, 2)}\n`, { parser: "json" })
  );
}
