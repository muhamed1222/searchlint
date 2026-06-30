#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const reviewPath = path.join(
  repoRoot,
  "docs/reviews/overlay-accessibility/reviewer.review.json"
);
const reportPath = path.join(
  repoRoot,
  "reports/overlay-manual-a11y-review-report.json"
);
const samplePath = path.join(
  repoRoot,
  "docs/examples/overlay-manual-a11y-review-report.sample.json"
);

const requiredScenarios = [
  "badge-accessible-name",
  "diagnostic-count-announcement",
  "keyboard-open",
  "keyboard-close-focus-return",
  "non-modal-dialog-name-description",
  "filter-controls",
  "diagnostic-card-reading-order",
  "diagnostic-evidence-fields",
  "action-controls",
  "runtime-fallback-alert",
  "long-and-large-diagnostics",
  "zoom-200-400",
  "forced-colors-high-contrast",
  "reduced-motion",
  "rtl-rendering",
  "non-modal-page-access"
];

const prerequisiteCommands = [
  {
    id: "overlay-acceptance",
    command: "pnpm",
    args: ["overlay:acceptance"]
  },
  {
    id: "overlay-visual-regression",
    command: "pnpm",
    args: ["overlay:visual-regression"]
  },
  {
    id: "next-fixtures",
    command: "pnpm",
    args: ["verify:next-fixtures"]
  }
];

const commandResults = prerequisiteCommands.map(runCommand);
const issues = [];

for (const result of commandResults) {
  if (result.status !== 0) {
    issues.push({
      severity: "blocker",
      code: "prerequisite-command-failed",
      message: `${result.id} failed before manual review validation.`
    });
  }
}

const review = await readOptionalJson(reviewPath);
const reviewResult = validateReview(review);
issues.push(...reviewResult.issues);

const releaseGate = {
  passFail:
    commandResults.every((result) => result.status === 0) &&
    reviewResult.valid &&
    issues.length === 0
      ? "pass"
      : "fail",
  gates: {
    automatedOverlayAcceptancePassed:
      commandResults.find((result) => result.id === "overlay-acceptance")
        ?.status === 0,
    automatedVisualRegressionPassed:
      commandResults.find((result) => result.id === "overlay-visual-regression")
        ?.status === 0,
    realNextFixtureOverlayEvidencePassed:
      commandResults.find((result) => result.id === "next-fixtures")?.status ===
      0,
    manualReviewFilePresent: reviewResult.present,
    manualReviewFileValid: reviewResult.valid,
    allRequiredScenariosApproved: reviewResult.missingScenarioIds.length === 0,
    noRejectedScenarios: reviewResult.rejectedScenarioIds.length === 0,
    noDisputedScenarios: reviewResult.disputedScenarioIds.length === 0,
    signedStatementPresent: reviewResult.signedStatementPresent,
    assistiveTechnologyRecorded: reviewResult.assistiveTechnologyRecorded,
    browserMatrixRecorded: reviewResult.browserMatrixRecorded
  }
};
releaseGate.failedGates = Object.entries(releaseGate.gates)
  .filter(([, passed]) => !passed)
  .map(([gate]) => gate);

const report = {
  schemaVersion: 1,
  generatedAt: "2026-06-23T00:00:00.000Z",
  reviewFile: path.relative(repoRoot, reviewPath),
  requiredScenarios,
  prerequisiteCommands: commandResults.map((result) => ({
    id: result.id,
    command: [result.command, ...result.args].join(" "),
    status: result.status
  })),
  review: reviewResult.summary,
  issues,
  releaseGate
};

await writeReports(report);

if (releaseGate.passFail !== "pass") {
  console.error("Overlay manual accessibility review gate failed.");
  for (const issue of issues) {
    console.error(`- ${issue.code}: ${issue.message}`);
  }
  if (issues.length === 0) {
    console.error(
      `- failed-gates: ${releaseGate.failedGates.join(", ") || "unknown"}`
    );
  }
  console.error(`Report: ${path.relative(repoRoot, reportPath)}`);
  console.error(`Sample: ${path.relative(repoRoot, samplePath)}`);
  process.exitCode = 1;
} else {
  console.log("Overlay manual accessibility review gate passed.");
  console.log(`Report: ${path.relative(repoRoot, reportPath)}`);
}

function runCommand(entry) {
  const result = spawnSync(entry.command, entry.args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  return {
    ...entry,
    status: result.status ?? 1,
    stdout: result.stdout.trim().split(/\n/u).filter(Boolean).slice(-12),
    stderr: result.stderr.trim().split(/\n/u).filter(Boolean).slice(-12)
  };
}

async function readOptionalJson(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}

function validateReview(review) {
  if (!review) {
    return {
      present: false,
      valid: false,
      missingScenarioIds: requiredScenarios,
      rejectedScenarioIds: [],
      disputedScenarioIds: [],
      signedStatementPresent: false,
      assistiveTechnologyRecorded: false,
      browserMatrixRecorded: false,
      summary: {
        present: false
      },
      issues: [
        {
          severity: "blocker",
          code: "missing-review-file",
          message:
            "Missing docs/reviews/overlay-accessibility/reviewer.review.json."
        }
      ]
    };
  }

  const approved = asArray(review.approvedScenarios);
  const rejected = asArray(review.rejectedScenarios);
  const disputed = asArray(review.disputedScenarios);
  const approvedSet = new Set(approved);
  const missingScenarioIds = requiredScenarios.filter(
    (scenarioId) => !approvedSet.has(scenarioId)
  );
  const unknownScenarioIds = [...approved, ...rejected, ...disputed].filter(
    (scenarioId) => !requiredScenarios.includes(scenarioId)
  );
  const duplicateScenarioIds = duplicateValues([
    ...approved,
    ...rejected,
    ...disputed
  ]);
  const signedStatementPresent =
    typeof review.signedStatement === "string" &&
    review.signedStatement.trim().length > 0 &&
    !/example only|template|placeholder/iu.test(review.signedStatement);
  const assistiveTechnologyRecorded =
    Array.isArray(review.assistiveTechnologies) &&
    review.assistiveTechnologies.length > 0 &&
    review.assistiveTechnologies.every(
      (item) =>
        typeof item?.name === "string" &&
        item.name.trim().length > 0 &&
        typeof item?.platform === "string" &&
        item.platform.trim().length > 0 &&
        !JSON.stringify(item).toLowerCase().includes("example only")
    );
  const browserMatrixRecorded =
    Array.isArray(review.browserMatrix) &&
    review.browserMatrix.length > 0 &&
    review.browserMatrix.every(
      (item) =>
        typeof item?.browser === "string" &&
        item.browser.trim().length > 0 &&
        typeof item?.platform === "string" &&
        item.platform.trim().length > 0 &&
        !JSON.stringify(item).toLowerCase().includes("example only")
    );
  const issues = [];

  if (review.schemaVersion !== 1) {
    issues.push(issue("invalid-schema-version", "schemaVersion must be 1."));
  }
  for (const field of [
    "reviewerId",
    "reviewerName",
    "reviewedAt",
    "reviewedArtifact",
    "reviewedVersion"
  ]) {
    if (
      typeof review[field] !== "string" ||
      review[field].trim().length === 0
    ) {
      issues.push(issue("missing-required-field", `${field} is required.`));
    }
  }
  if (/example|template|placeholder/iu.test(String(review.reviewerId ?? ""))) {
    issues.push(
      issue("example-reviewer-id", "reviewerId must identify a real reviewer.")
    );
  }
  if (missingScenarioIds.length > 0) {
    issues.push(
      issue(
        "missing-scenarios",
        `${missingScenarioIds.length} required scenario(s) are not approved.`
      )
    );
  }
  if (unknownScenarioIds.length > 0) {
    issues.push(
      issue(
        "unknown-scenarios",
        `${unknownScenarioIds.length} unknown scenario id(s) were provided.`
      )
    );
  }
  if (duplicateScenarioIds.length > 0) {
    issues.push(
      issue(
        "duplicate-scenarios",
        `${duplicateScenarioIds.length} duplicate scenario id(s) were provided.`
      )
    );
  }
  if (rejected.length > 0) {
    issues.push(
      issue(
        "rejected-scenarios",
        `${rejected.length} scenario(s) were rejected by the reviewer.`
      )
    );
  }
  if (disputed.length > 0) {
    issues.push(
      issue(
        "disputed-scenarios",
        `${disputed.length} scenario(s) remain disputed.`
      )
    );
  }
  if (!signedStatementPresent) {
    issues.push(
      issue(
        "missing-signed-statement",
        "signedStatement must be present and must not be an example statement."
      )
    );
  }
  if (!assistiveTechnologyRecorded) {
    issues.push(
      issue(
        "missing-assistive-technology",
        "At least one real assistive technology environment is required."
      )
    );
  }
  if (!browserMatrixRecorded) {
    issues.push(
      issue("missing-browser-matrix", "At least one real browser is required.")
    );
  }

  return {
    present: true,
    valid: issues.length === 0,
    missingScenarioIds,
    rejectedScenarioIds: rejected,
    disputedScenarioIds: disputed,
    signedStatementPresent,
    assistiveTechnologyRecorded,
    browserMatrixRecorded,
    summary: {
      present: true,
      reviewerId: review.reviewerId,
      reviewerName: review.reviewerName,
      reviewedAt: review.reviewedAt,
      reviewedVersion: review.reviewedVersion,
      approvedScenarioCount: approved.length,
      rejectedScenarioCount: rejected.length,
      disputedScenarioCount: disputed.length,
      missingScenarioCount: missingScenarioIds.length
    },
    issues
  };
}

function issue(code, message) {
  return {
    severity: "blocker",
    code,
    message
  };
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
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

async function writeReports(report) {
  await mkdir(path.dirname(reportPath), { recursive: true });
  await mkdir(path.dirname(samplePath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  const prettier = await import("prettier");
  await writeFile(
    samplePath,
    await prettier.format(JSON.stringify(report), { parser: "json" })
  );
}
