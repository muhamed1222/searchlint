#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { format, resolveConfig } from "prettier";

const evidenceDir = "docs/release-owner-evidence";
const templateDir = "docs/release-owner-evidence/templates";
const ownerEvidenceReportPath = "reports/release-owner-evidence-report.json";
const reportPath = "reports/release-owner-evidence-template-report.json";
const samplePath =
  "docs/examples/release-owner-evidence-template-report.sample.json";
const generatedAt = "2026-06-23T00:00:00.000Z";

run("pnpm", ["release:owner-evidence"]);

const ownerEvidenceReport = JSON.parse(
  await readFile(ownerEvidenceReportPath, "utf8")
);
const expectedEvidence = ownerEvidenceReport.expectedEvidence ?? [];

if (!Array.isArray(expectedEvidence)) {
  throw new Error("Owner evidence report must include expectedEvidence.");
}

await mkdir(templateDir, { recursive: true });

const templates = [];
for (const entry of expectedEvidence) {
  const templatePath = templatePathForEvidencePath(entry.path);
  const value = templateForEntry(entry);
  await writeJson(templatePath, value);
  templates.push({
    templatePath,
    expectedEvidencePath: entry.path,
    gate: entry.gate,
    requiredEvidence: entry.requiredEvidence,
    nextOwnerAction: entry.nextOwnerAction
  });
}

const realEvidenceFiles = await listRealEvidenceFiles();
const report = {
  schemaVersion: 1,
  generatedBy: "searchlint-release-owner-evidence-template-generator",
  generatedAt,
  sourceReportPath: ownerEvidenceReportPath,
  templateDirectory: templateDir,
  expectedEvidenceCount: expectedEvidence.length,
  templateCount: templates.length,
  realEvidenceFileCount: realEvidenceFiles.length,
  status:
    templates.length === expectedEvidence.length &&
    realEvidenceFiles.length === 0
      ? "passed"
      : "failed",
  templates,
  realEvidenceFiles,
  nonClaims: [
    "Templates are examples only and are not owner evidence.",
    "Generating templates does not close any release gate.",
    "Real evidence must be written to the expected docs/release-owner-evidence/*.json paths and validated separately."
  ]
};

assertNoSensitiveValues(JSON.stringify(report));
await writeJson(reportPath, report);
await writeJson(samplePath, report);

if (report.status !== "passed") {
  throw new Error(
    `Owner evidence template generation failed: expected ${expectedEvidence.length} templates, wrote ${templates.length}, found ${realEvidenceFiles.length} real evidence file(s).`
  );
}

console.log(
  `Release owner evidence templates PASS: ${templates.length}/${expectedEvidence.length} template(s) generated`
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

function templatePathForEvidencePath(evidencePath) {
  const name = path.basename(evidencePath, ".json");
  return `${templateDir}/${name}.example.json`;
}

function templateForEntry(entry) {
  return {
    schemaVersion: 1,
    evidenceId: `${path.basename(entry.path, ".json")}-evidence`,
    gate: entry.gate,
    providedBy: {
      name: "REPLACE_WITH_OWNER_OR_REVIEWER_NAME",
      role: "REPLACE_WITH_OWNER_LEGAL_SECURITY_OPERATOR_OR_REVIEWER_ROLE"
    },
    providedAt: "REPLACE_WITH_ISO_TIMESTAMP",
    evidenceSummary:
      "REPLACE_WITH_SHORT_SANITIZED_DESCRIPTION_OF_WHAT_WAS_ACTUALLY_VERIFIED",
    artifacts: [
      {
        type: "REPLACE_WITH_SANITIZED_REPORT_URL_OR_SCREENSHOT_REFERENCE",
        description: entry.requiredEvidence,
        reference:
          "REPLACE_WITH_SANITIZED_CI_ARTIFACT_URL_INTERNAL_REFERENCE_OR_REPORT_PATH"
      }
    ],
    commandsRun: [
      {
        command: entry.gate.relatedCommand,
        result: "passed",
        summary:
          "REPLACE_WITH_SANITIZED_COMMAND_RESULT_SUMMARY_AFTER_RUNNING_THE_COMMAND"
      }
    ],
    externalSystems: [
      {
        system: "REPLACE_WITH_EXTERNAL_SYSTEM_NAME",
        resource: "REPLACE_WITH_SANITIZED_RESOURCE_IDENTIFIER",
        verifiedAt: "REPLACE_WITH_ISO_TIMESTAMP"
      }
    ],
    sensitiveDataStatement:
      "This evidence is sanitized and contains no secrets, credentials, tokens, private keys, raw customer personal data, or confidential provider payloads.",
    signedStatement:
      "I confirm this evidence is accurate for the named SearchLint release gate and has been sanitized for repository storage.",
    ownerAction: entry.nextOwnerAction,
    templateUse:
      "Copy this template to the matching expected docs/release-owner-evidence/*.json path, replace every placeholder with real sanitized evidence, then run pnpm release:owner-evidence."
  };
}

async function listRealEvidenceFiles() {
  if (!existsSync(evidenceDir)) return [];
  const names = await readdir(evidenceDir);
  return names
    .filter((name) => name.endsWith(".json"))
    .map((name) => `${evidenceDir}/${name}`)
    .sort();
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
    throw new Error(`Sensitive value leaked into template report: ${match}`);
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
