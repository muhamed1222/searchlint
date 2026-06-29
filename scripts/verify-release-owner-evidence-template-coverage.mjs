#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { format, resolveConfig } from "prettier";

const evidenceDir = "docs/release-owner-evidence";
const templateDir = "docs/release-owner-evidence/templates";
const ownerEvidenceReportPath = "reports/release-owner-evidence-report.json";
const templateReportPath =
  "reports/release-owner-evidence-template-report.json";
const reportPath =
  "reports/release-owner-evidence-template-coverage-report.json";
const samplePath =
  "docs/examples/release-owner-evidence-template-coverage-report.sample.json";
const generatedAt = "2026-06-23T00:00:00.000Z";

run("pnpm", ["release:owner-evidence:templates"]);

const ownerEvidenceReport = JSON.parse(
  await readFile(ownerEvidenceReportPath, "utf8")
);
const templateReport = JSON.parse(await readFile(templateReportPath, "utf8"));
const expectedEvidence = ownerEvidenceReport.expectedEvidence ?? [];

if (!Array.isArray(expectedEvidence)) {
  throw new Error("Owner evidence report must include expectedEvidence.");
}

const expectedByPath = new Map(
  expectedEvidence.map((entry) => [entry.path, entry])
);
const expectedTemplatePaths = expectedEvidence
  .map((entry) => templatePathForEvidencePath(entry.path))
  .sort();
const actualTemplatePaths = await listTemplatePaths();
const actualTemplateSet = new Set(actualTemplatePaths);
const expectedTemplateSet = new Set(expectedTemplatePaths);
const realEvidenceFiles = await listRealEvidenceFiles();
const failures = [];
const coverage = [];

if (templateReport.templateCount !== expectedEvidence.length) {
  failures.push({
    code: "template_report_count_mismatch",
    path: templateReportPath,
    message: `Template report count ${templateReport.templateCount} must equal expected evidence count ${expectedEvidence.length}.`
  });
}

for (const templatePath of expectedTemplatePaths) {
  if (!actualTemplateSet.has(templatePath)) {
    failures.push({
      code: "missing_template",
      path: templatePath,
      message: "Expected owner evidence template is missing."
    });
  }
}

for (const templatePath of actualTemplatePaths) {
  if (!expectedTemplateSet.has(templatePath)) {
    failures.push({
      code: "unknown_template",
      path: templatePath,
      message: "Template path does not map to an expected owner evidence file."
    });
    continue;
  }
  const evidencePath = evidencePathForTemplatePath(templatePath);
  const expected = expectedByPath.get(evidencePath);
  const result = await validateTemplate(templatePath, expected);
  coverage.push(result.record);
  failures.push(...result.failures);
}

for (const filePath of realEvidenceFiles) {
  failures.push({
    code: "real_evidence_file_present",
    path: filePath,
    message:
      "Template coverage verification must not create or depend on real owner evidence files."
  });
}

const report = {
  schemaVersion: 1,
  generatedBy: "searchlint-release-owner-evidence-template-coverage-verifier",
  generatedAt,
  status: failures.length === 0 ? "passed" : "failed",
  sourceReports: {
    ownerEvidenceReportPath,
    templateReportPath
  },
  templateDirectory: templateDir,
  expectedEvidenceCount: expectedEvidence.length,
  expectedTemplateCount: expectedTemplatePaths.length,
  actualTemplateCount: actualTemplatePaths.length,
  realEvidenceFileCount: realEvidenceFiles.length,
  failureCount: failures.length,
  coverage,
  realEvidenceFiles,
  failures,
  nonClaims: [
    "Template coverage verifies examples only.",
    "Templates are not owner evidence and do not close release gates.",
    "Real evidence must be supplied separately in docs/release-owner-evidence/*.json."
  ]
};

assertNoSensitiveValues(JSON.stringify(report));
await writeJson(reportPath, report);
await writeJson(samplePath, report);

if (failures.length > 0) {
  const details = failures
    .map((failure) => `${failure.code}: ${failure.path} - ${failure.message}`)
    .join("\n");
  throw new Error(`Owner evidence template coverage failed:\n${details}`);
}

console.log(
  `Release owner evidence template coverage PASS: ${coverage.length}/${expectedEvidence.length} template(s) verified`
);
console.log(`Report: ${reportPath}`);
console.log(`Sample: ${samplePath}`);

function run(command, args) {
  execFileSync(command, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit"
  });
}

async function validateTemplate(templatePath, expected) {
  const failures = [];
  const value = JSON.parse(await readFile(templatePath, "utf8"));

  requireEqual(value.schemaVersion, 1, templatePath, "schemaVersion", failures);
  requireEqual(
    value.evidenceId,
    `${path.basename(expected.path, ".json")}-evidence`,
    templatePath,
    "evidenceId",
    failures
  );
  validateGate(value.gate, expected.gate, templatePath, failures);
  requirePlaceholder(
    value.providedBy?.name,
    templatePath,
    "providedBy.name",
    failures
  );
  requirePlaceholder(
    value.providedBy?.role,
    templatePath,
    "providedBy.role",
    failures
  );
  requirePlaceholder(value.providedAt, templatePath, "providedAt", failures);
  requirePlaceholder(
    value.evidenceSummary,
    templatePath,
    "evidenceSummary",
    failures
  );
  validateTemplateArtifacts(value.artifacts, expected, templatePath, failures);
  validateTemplateCommands(value.commandsRun, expected, templatePath, failures);
  validateTemplateExternalSystems(
    value.externalSystems,
    templatePath,
    failures
  );
  requireEqual(
    value.ownerAction,
    expected.nextOwnerAction,
    templatePath,
    "ownerAction",
    failures
  );
  requireIncludes(
    value.templateUse,
    "Copy this template",
    templatePath,
    "templateUse",
    failures
  );
  requireIncludes(
    value.sensitiveDataStatement,
    "contains no secrets",
    templatePath,
    "sensitiveDataStatement",
    failures
  );
  requireIncludes(
    value.signedStatement,
    "I confirm this evidence is accurate",
    templatePath,
    "signedStatement",
    failures
  );

  const serialized = JSON.stringify(value);
  const sensitiveMatch = sensitivePatternMatch(serialized);
  if (sensitiveMatch) {
    failures.push({
      code: "sensitive_value",
      path: templatePath,
      message: `Template appears to include sensitive material: ${sensitiveMatch}`
    });
  }
  const claimMatch = releaseClaimPatternMatch(serialized);
  if (claimMatch) {
    failures.push({
      code: "claim_like_template",
      path: templatePath,
      message: `Template appears to claim completion instead of requesting evidence: ${claimMatch}`
    });
  }

  return {
    record: {
      templatePath,
      expectedEvidencePath: expected.path,
      gate: expected.gate,
      status: failures.length === 0 ? "valid_template" : "invalid_template"
    },
    failures
  };
}

function validateGate(actual, expected, filePath, failures) {
  if (!actual || typeof actual !== "object" || Array.isArray(actual)) {
    failures.push({
      code: "missing_gate",
      path: filePath,
      message: "gate must be an object."
    });
    return;
  }
  for (const field of ["section", "item", "gateType", "relatedCommand"]) {
    requireEqual(
      actual[field],
      expected[field],
      filePath,
      `gate.${field}`,
      failures
    );
  }
}

function validateTemplateArtifacts(value, expected, filePath, failures) {
  if (!Array.isArray(value) || value.length !== 1) {
    failures.push({
      code: "invalid_artifacts",
      path: filePath,
      message:
        "Template artifacts must contain exactly one placeholder artifact."
    });
    return;
  }
  const artifact = value[0];
  requirePlaceholder(artifact?.type, filePath, "artifacts.0.type", failures);
  requireEqual(
    artifact?.description,
    expected.requiredEvidence,
    filePath,
    "artifacts.0.description",
    failures
  );
  requirePlaceholder(
    artifact?.reference,
    filePath,
    "artifacts.0.reference",
    failures
  );
}

function validateTemplateCommands(value, expected, filePath, failures) {
  if (!Array.isArray(value) || value.length !== 1) {
    failures.push({
      code: "invalid_commands_run",
      path: filePath,
      message: "Template commandsRun must contain exactly one command."
    });
    return;
  }
  const command = value[0];
  requireEqual(
    command?.command,
    expected.gate.relatedCommand,
    filePath,
    "commandsRun.0.command",
    failures
  );
  requireEqual(
    command?.result,
    "passed",
    filePath,
    "commandsRun.0.result",
    failures
  );
  requirePlaceholder(
    command?.summary,
    filePath,
    "commandsRun.0.summary",
    failures
  );
}

function validateTemplateExternalSystems(value, filePath, failures) {
  if (!Array.isArray(value) || value.length !== 1) {
    failures.push({
      code: "invalid_external_systems",
      path: filePath,
      message:
        "Template externalSystems must contain exactly one placeholder system."
    });
    return;
  }
  const system = value[0];
  requirePlaceholder(
    system?.system,
    filePath,
    "externalSystems.0.system",
    failures
  );
  requirePlaceholder(
    system?.resource,
    filePath,
    "externalSystems.0.resource",
    failures
  );
  requirePlaceholder(
    system?.verifiedAt,
    filePath,
    "externalSystems.0.verifiedAt",
    failures
  );
}

function templatePathForEvidencePath(evidencePath) {
  return `${templateDir}/${path.basename(evidencePath, ".json")}.example.json`;
}

function evidencePathForTemplatePath(templatePath) {
  return `${evidenceDir}/${path.basename(templatePath, ".example.json")}.json`;
}

async function listTemplatePaths() {
  if (!existsSync(templateDir)) return [];
  const names = await readdir(templateDir);
  return names
    .filter((name) => name.endsWith(".example.json"))
    .map((name) => `${templateDir}/${name}`)
    .sort();
}

async function listRealEvidenceFiles() {
  if (!existsSync(evidenceDir)) return [];
  const names = await readdir(evidenceDir);
  return names
    .filter((name) => name.endsWith(".json"))
    .map((name) => `${evidenceDir}/${name}`)
    .sort();
}

function requireEqual(actual, expected, filePath, field, failures) {
  if (actual !== expected) {
    failures.push({
      code: "field_mismatch",
      path: filePath,
      message: `${field} must equal ${JSON.stringify(expected)}.`
    });
  }
}

function requirePlaceholder(value, filePath, field, failures) {
  if (typeof value !== "string" || !value.startsWith("REPLACE_WITH_")) {
    failures.push({
      code: "missing_placeholder",
      path: filePath,
      message: `${field} must be a REPLACE_WITH_* placeholder.`
    });
  }
}

function requireIncludes(value, expected, filePath, field, failures) {
  if (typeof value !== "string" || !value.includes(expected)) {
    failures.push({
      code: "missing_required_text",
      path: filePath,
      message: `${field} must include ${JSON.stringify(expected)}.`
    });
  }
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(
    filePath,
    await format(`${JSON.stringify(value, null, 2)}\n`, {
      ...(await prettierOptions(filePath)),
      parser: "json"
    })
  );
}

async function prettierOptions(filePath) {
  return (await resolveConfig(filePath)) ?? {};
}

function assertNoSensitiveValues(text) {
  const match = sensitivePatternMatch(text);
  if (match) {
    throw new Error(
      `Sensitive value leaked into template coverage report: ${match}`
    );
  }
}

function sensitivePatternMatch(text) {
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
  return forbidden.find((pattern) => pattern.test(text))?.toString() ?? null;
}

function releaseClaimPatternMatch(text) {
  const forbidden = [
    /release gate passed/i,
    /approved by legal/i,
    /reviewer sign-off received/i,
    /published to npm/i,
    /published to marketplace/i,
    /deployed to production/i,
    /live acceptance passed/i
  ];
  return forbidden.find((pattern) => pattern.test(text))?.toString() ?? null;
}
