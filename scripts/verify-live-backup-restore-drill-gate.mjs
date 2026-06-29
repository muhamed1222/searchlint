#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { format } from "prettier";

const evidencePath = "docs/live-backup-restore-drill.json";
const examplePath = "docs/live-backup-restore-drill.example.json";
const reportPath = "reports/live-backup-restore-drill-report.json";
const samplePath = "docs/examples/live-backup-restore-drill-report.sample.json";
const generatedAt = "2026-06-23T00:00:00.000Z";

const requiredDrillTypes = [
  "rds-backup-restore",
  "rds-point-in-time-recovery",
  "s3-object-restore"
];
const requiredValidationChecks = ["tenant-isolation", "rbac", "deletion-state"];

const issues = [];
const evidence = await readOptionalJson(evidencePath);

if (!evidence) {
  issues.push(issue("missing-evidence", `${evidencePath} is required.`));
} else {
  validateEvidence(evidence);
}

const report = {
  schemaVersion: 1,
  generatedBy: "searchlint-live-backup-restore-drill-verifier",
  generatedAt,
  status: issues.length === 0 ? "passed" : "blocked",
  evidence: summarizeEvidence(evidence),
  releaseGate: {
    passFail: issues.length === 0 ? "pass" : "fail",
    checks: {
      evidencePresent: Boolean(evidence),
      schemaVersionValid: evidence?.schemaVersion === 1,
      requiredDrillsPresent: requiredDrillTypes.every((type) =>
        evidence?.drills?.some((drill) => drill.type === type)
      ),
      rpoRtoWithinTargets: drillsWithinTargets(evidence),
      postRestoreValidationPresent: hasRequiredPostRestoreValidation(evidence),
      signedStatementPresent:
        typeof evidence?.signedStatement === "string" &&
        /approve|approved|release/i.test(evidence.signedStatement),
      noExampleValues: !evidence || !looksLikeExample(evidence)
    }
  },
  issues,
  nextSteps:
    issues.length === 0
      ? [
          "Mark Backup/restore verified in the master checklist with this evidence.",
          "Run the final release gate verifier."
        ]
      : [
          `Create ${evidencePath} from ${examplePath} with real live restore drill evidence.`,
          "Do not mark Backup/restore verified until this gate passes."
        ]
};

report.releaseGate.failedChecks = Object.entries(report.releaseGate.checks)
  .filter(([, passed]) => !passed)
  .map(([check]) => check);

assertNoSensitiveValues(JSON.stringify(report));
await writeJson(reportPath, report);
await writeJson(samplePath, report);

if (report.status !== "passed") {
  console.error("Live backup/restore drill gate blocked.");
  for (const entry of issues) {
    console.error(`- ${entry.code}: ${entry.message}`);
  }
  console.error(`Report: ${reportPath}`);
  console.error(`Sample: ${samplePath}`);
  process.exitCode = 1;
} else {
  console.log("Live backup/restore drill gate PASS.");
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

function validateEvidence(value) {
  if (value.schemaVersion !== 1) {
    issues.push(issue("invalid-schema-version", "schemaVersion must be 1."));
  }
  for (const field of [
    "evidenceId",
    "environment",
    "reviewedAt",
    "approvedBy",
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
  if (!Number.isFinite(value.rpoTargetHours) || value.rpoTargetHours <= 0) {
    issues.push(
      issue("invalid-rpo-target", "rpoTargetHours must be positive.")
    );
  }
  if (!Number.isFinite(value.rtoTargetHours) || value.rtoTargetHours <= 0) {
    issues.push(
      issue("invalid-rto-target", "rtoTargetHours must be positive.")
    );
  }
  if (!Array.isArray(value.drills)) {
    issues.push(issue("missing-drills", "drills must be an array."));
    return;
  }
  for (const type of requiredDrillTypes) {
    const drill = value.drills.find((entry) => entry.type === type);
    if (!drill) {
      issues.push(issue("missing-drill", `${type} drill is required.`));
      continue;
    }
    validateDrill(drill, value);
  }
  if (!hasRequiredPostRestoreValidation(value)) {
    issues.push(
      issue(
        "missing-post-restore-validation",
        "RDS drills must include tenant-isolation, RBAC, and deletion-state validation."
      )
    );
  }
  if (!drillsWithinTargets(value)) {
    issues.push(
      issue("rpo-rto-exceeded", "All drills must be within RPO/RTO targets.")
    );
  }
  if (
    typeof value.signedStatement !== "string" ||
    !/approve|approved|release/i.test(value.signedStatement)
  ) {
    issues.push(
      issue(
        "missing-signed-statement",
        "signedStatement must approve the live restore drill evidence."
      )
    );
  }
}

function validateDrill(drill, evidence) {
  for (const field of [
    "id",
    "startedAt",
    "completedAt",
    "validatedAt",
    "evidenceSummary"
  ]) {
    if (typeof drill[field] !== "string" || drill[field].trim() === "") {
      issues.push(
        issue("missing-drill-field", `${drill.type}.${field} is required.`)
      );
    }
  }
  if (!Number.isFinite(drill.rpoHours) || drill.rpoHours < 0) {
    issues.push(
      issue("invalid-drill-rpo", `${drill.type}.rpoHours is invalid.`)
    );
  }
  if (!Number.isFinite(drill.rtoHours) || drill.rtoHours < 0) {
    issues.push(
      issue("invalid-drill-rto", `${drill.type}.rtoHours is invalid.`)
    );
  }
  if (drill.rpoHours > evidence.rpoTargetHours) {
    issues.push(
      issue("drill-rpo-exceeded", `${drill.type} exceeds RPO target.`)
    );
  }
  if (drill.rtoHours > evidence.rtoTargetHours) {
    issues.push(
      issue("drill-rto-exceeded", `${drill.type} exceeds RTO target.`)
    );
  }
  if (
    !Array.isArray(drill.validationChecks) ||
    drill.validationChecks.length === 0
  ) {
    issues.push(
      issue(
        "missing-validation-checks",
        `${drill.type}.validationChecks is required.`
      )
    );
  }
}

function drillsWithinTargets(value) {
  if (!value || !Array.isArray(value.drills)) return false;
  return value.drills.every(
    (drill) =>
      Number.isFinite(drill.rpoHours) &&
      Number.isFinite(drill.rtoHours) &&
      drill.rpoHours <= value.rpoTargetHours &&
      drill.rtoHours <= value.rtoTargetHours
  );
}

function hasRequiredPostRestoreValidation(value) {
  if (!value || !Array.isArray(value.drills)) return false;
  const rdsDrills = value.drills.filter((drill) =>
    ["rds-backup-restore", "rds-point-in-time-recovery"].includes(drill.type)
  );
  return rdsDrills.every((drill) =>
    requiredValidationChecks.every((check) =>
      drill.validationChecks?.includes(check)
    )
  );
}

function summarizeEvidence(value) {
  if (!value) return { present: false };
  return {
    present: true,
    evidenceId: value.evidenceId,
    environment: value.environment,
    reviewedAt: value.reviewedAt,
    approvedBy: value.approvedBy,
    rpoTargetHours: value.rpoTargetHours,
    rtoTargetHours: value.rtoTargetHours,
    drillTypes: Array.isArray(value.drills)
      ? value.drills.map((drill) => drill.type)
      : []
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
    /X-Amz-Signature/i,
    /ya29\./i,
    /xox[baprs]-/i
  ];
  const match = forbidden.find((pattern) => pattern.test(text));
  if (match) {
    throw new Error(`Sensitive value leaked into restore evidence: ${match}`);
  }
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(
    filePath,
    await format(`${JSON.stringify(value, null, 2)}\n`, { parser: "json" })
  );
}
