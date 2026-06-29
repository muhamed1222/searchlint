#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

import { format, resolveConfig } from "prettier";

const ownerGateReportPath = "reports/release-owner-gate-actions-report.json";
const evidenceDir = "docs/release-owner-evidence";
const reportPath = "reports/release-owner-evidence-report.json";
const samplePath = "docs/examples/release-owner-evidence-report.sample.json";
const selfTestReportPath =
  "reports/release-owner-evidence-self-test-report.json";
const selfTestSamplePath =
  "docs/examples/release-owner-evidence-self-test-report.sample.json";
const generatedAt = "2026-06-23T00:00:00.000Z";

if (process.argv.includes("--self-test")) {
  await runSelfTest();
  process.exit(0);
}

run("pnpm", ["release:owner-gates"]);

const ownerGateReport = JSON.parse(await readFile(ownerGateReportPath, "utf8"));
const expectedEvidence = expectedEvidenceEntries(ownerGateReport);
const expectedByPath = new Map(
  expectedEvidence.map((entry) => [entry.path, entry])
);
const presentPaths = await listPresentEvidencePaths();
const unknownPaths = presentPaths.filter(
  (filePath) => !expectedByPath.has(filePath)
);
const presentRecords = [];
const failures = [];

for (const filePath of presentPaths.filter((pathName) =>
  expectedByPath.has(pathName)
)) {
  const result = await validateEvidenceFile(
    filePath,
    expectedByPath.get(filePath)
  );
  presentRecords.push(result.record);
  failures.push(...result.failures);
}

for (const unknownPath of unknownPaths) {
  failures.push({
    code: "unknown_owner_evidence_path",
    path: unknownPath,
    message:
      "Owner evidence JSON files must be referenced by release-owner-gate actions."
  });
}

const report = {
  schemaVersion: 1,
  generatedBy: "searchlint-release-owner-evidence-verifier",
  generatedAt,
  status: failures.length === 0 ? "passed" : "failed",
  sourceReportPath: ownerGateReportPath,
  evidenceDirectory: evidenceDir,
  expectedEvidenceCount: expectedEvidence.length,
  presentEvidenceCount: presentRecords.length,
  missingEvidenceCount: expectedEvidence.length - presentRecords.length,
  unknownEvidenceCount: unknownPaths.length,
  failureCount: failures.length,
  expectedEvidence,
  presentRecords,
  unknownPaths,
  failures,
  nonClaims: [
    "This verifier validates owner evidence shape only.",
    "Missing owner evidence remains blocked external evidence.",
    "Passing this verifier does not close release gates unless the dedicated gate verifier also passes."
  ]
};

assertNoSensitiveValues(JSON.stringify(report));
await writeJson(reportPath, report);
await writeJson(samplePath, report);

if (failures.length > 0) {
  const details = failures
    .map((failure) => `${failure.code}: ${failure.path} - ${failure.message}`)
    .join("\n");
  throw new Error(`Owner evidence verification failed:\n${details}`);
}

console.log(
  `Release owner evidence verification PASS: ${presentRecords.length}/${expectedEvidence.length} owner evidence file(s) present`
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

function expectedEvidenceEntries(report) {
  if (!Array.isArray(report.openGates)) {
    throw new Error("Owner gate report must include openGates.");
  }
  const entries = [];
  for (const gate of report.openGates) {
    for (const evidencePath of gate.evidencePaths ?? []) {
      if (!isReleaseOwnerEvidencePath(evidencePath)) continue;
      entries.push({
        path: evidencePath,
        gate: {
          section: gate.section,
          item: gate.item,
          gateType: gate.gateType,
          relatedCommand: gate.relatedCommand
        },
        requiredEvidence: gate.requiredEvidence,
        nextOwnerAction: gate.nextOwnerAction
      });
    }
  }
  return entries.sort((left, right) => left.path.localeCompare(right.path));
}

function isReleaseOwnerEvidencePath(filePath) {
  return filePath.startsWith(`${evidenceDir}/`) && filePath.endsWith(".json");
}

async function listPresentEvidencePaths() {
  if (!existsSync(evidenceDir)) return [];
  const names = await readdir(evidenceDir);
  return names
    .filter((name) => name.endsWith(".json"))
    .map((name) => `${evidenceDir}/${name}`)
    .sort();
}

async function validateEvidenceFile(filePath, expected) {
  const failures = [];
  let value;
  try {
    value = JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return {
      record: {
        path: filePath,
        status: "failed_json_parse"
      },
      failures: [
        {
          code: "invalid_json",
          path: filePath,
          message: "Owner evidence file must be valid JSON."
        }
      ]
    };
  }

  failures.push(...validateEvidenceValue(value, expected, filePath));

  return {
    record: {
      path: filePath,
      status: failures.length === 0 ? "valid" : "invalid",
      evidenceId:
        typeof value.evidenceId === "string" ? value.evidenceId : null,
      gate: expected.gate,
      artifactCount: Array.isArray(value.artifacts)
        ? value.artifacts.length
        : 0,
      commandCount: Array.isArray(value.commandsRun)
        ? value.commandsRun.length
        : 0,
      externalSystemCount: Array.isArray(value.externalSystems)
        ? value.externalSystems.length
        : 0
    },
    failures
  };
}

function validateEvidenceValue(value, expected, filePath) {
  const failures = [];

  requireEqual(value.schemaVersion, 1, filePath, "schemaVersion", failures);
  requireNonEmptyString(value.evidenceId, filePath, "evidenceId", failures);
  requireIsoDate(value.providedAt, filePath, "providedAt", failures);
  requireNonEmptyString(
    value.evidenceSummary,
    filePath,
    "evidenceSummary",
    failures
  );
  requireNonEmptyString(
    value.sensitiveDataStatement,
    filePath,
    "sensitiveDataStatement",
    failures
  );
  requireNonEmptyString(
    value.signedStatement,
    filePath,
    "signedStatement",
    failures
  );
  validateProvidedBy(value.providedBy, filePath, failures);
  validateGate(value.gate, expected.gate, filePath, failures);
  validateArtifacts(value.artifacts, filePath, failures);
  validateCommandsRun(value.commandsRun, filePath, failures);
  validateExternalSystems(value.externalSystems, filePath, failures);

  const serialized = JSON.stringify(value);
  const sensitiveMatch = sensitivePatternMatch(serialized);
  if (sensitiveMatch) {
    failures.push({
      code: "sensitive_value",
      path: filePath,
      message: `Owner evidence appears to include sensitive material: ${sensitiveMatch}`
    });
  }
  const placeholderMatches = placeholderValueMatches(value);
  for (const match of placeholderMatches) {
    failures.push({
      code: "placeholder_value",
      path: filePath,
      message: `${match.path} must replace template placeholder ${JSON.stringify(match.value)} with real sanitized evidence.`
    });
  }

  return failures;
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

function validateProvidedBy(value, filePath, failures) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    failures.push({
      code: "missing_provided_by",
      path: filePath,
      message: "providedBy must be an object."
    });
    return;
  }
  requireNonEmptyString(value.name, filePath, "providedBy.name", failures);
  requireNonEmptyString(value.role, filePath, "providedBy.role", failures);
}

function validateArtifacts(value, filePath, failures) {
  if (!Array.isArray(value) || value.length === 0) {
    failures.push({
      code: "missing_artifacts",
      path: filePath,
      message: "artifacts must be a non-empty array."
    });
    return;
  }
  for (const [index, artifact] of value.entries()) {
    validateObjectStrings(
      artifact,
      ["type", "description", "reference"],
      filePath,
      `artifacts.${index}`,
      failures
    );
  }
}

function validateCommandsRun(value, filePath, failures) {
  if (!Array.isArray(value) || value.length === 0) {
    failures.push({
      code: "missing_commands_run",
      path: filePath,
      message: "commandsRun must be a non-empty array."
    });
    return;
  }
  for (const [index, command] of value.entries()) {
    validateObjectStrings(
      command,
      ["command", "result", "summary"],
      filePath,
      `commandsRun.${index}`,
      failures
    );
    if (command && typeof command === "object" && command.result !== "passed") {
      failures.push({
        code: "command_not_passed",
        path: filePath,
        message: `commandsRun.${index}.result must be passed.`
      });
    }
  }
}

function validateExternalSystems(value, filePath, failures) {
  if (!Array.isArray(value) || value.length === 0) {
    failures.push({
      code: "missing_external_systems",
      path: filePath,
      message: "externalSystems must be a non-empty array."
    });
    return;
  }
  for (const [index, system] of value.entries()) {
    validateObjectStrings(
      system,
      ["system", "resource", "verifiedAt"],
      filePath,
      `externalSystems.${index}`,
      failures
    );
    if (system && typeof system === "object") {
      requireIsoDate(
        system.verifiedAt,
        filePath,
        `externalSystems.${index}.verifiedAt`,
        failures
      );
    }
  }
}

function validateObjectStrings(value, fields, filePath, prefix, failures) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    failures.push({
      code: "invalid_object",
      path: filePath,
      message: `${prefix} must be an object.`
    });
    return;
  }
  for (const field of fields) {
    requireNonEmptyString(
      value[field],
      filePath,
      `${prefix}.${field}`,
      failures
    );
  }
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

function requireNonEmptyString(value, filePath, field, failures) {
  if (typeof value !== "string" || value.trim().length === 0) {
    failures.push({
      code: "missing_string",
      path: filePath,
      message: `${field} must be a non-empty string.`
    });
  }
}

function requireIsoDate(value, filePath, field, failures) {
  requireNonEmptyString(value, filePath, field, failures);
  if (typeof value === "string" && Number.isNaN(Date.parse(value))) {
    failures.push({
      code: "invalid_date",
      path: filePath,
      message: `${field} must be an ISO-compatible date string.`
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
      `Sensitive value leaked into owner evidence report: ${match}`
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

function placeholderValueMatches(value) {
  const matches = [];
  collectPlaceholderValueMatches(value, [], matches);
  return matches;
}

function collectPlaceholderValueMatches(value, pathParts, matches) {
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      collectPlaceholderValueMatches(
        item,
        [...pathParts, String(index)],
        matches
      );
    }
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      collectPlaceholderValueMatches(item, [...pathParts, key], matches);
    }
    return;
  }
  if (typeof value === "string" && value.includes("REPLACE_WITH_")) {
    matches.push({
      path: pathParts.join("."),
      value
    });
  }
}

async function runSelfTest() {
  const expected = {
    path: "docs/release-owner-evidence/self-test.json",
    gate: {
      section: "Self Test",
      item: "Owner evidence self-test",
      gateType: "production_deployment_gate",
      relatedCommand: "pnpm self:test"
    },
    requiredEvidence: "Self-test evidence.",
    nextOwnerAction: "Run self-test."
  };
  const validEvidence = {
    schemaVersion: 1,
    evidenceId: "self-test-owner-evidence",
    gate: expected.gate,
    providedBy: {
      name: "Self Test",
      role: "Verifier"
    },
    providedAt: "2026-06-23T00:00:00.000Z",
    evidenceSummary: "Sanitized self-test evidence.",
    artifacts: [
      {
        type: "sanitized-report",
        description: "Self-test artifact.",
        reference: "self-test-reference"
      }
    ],
    commandsRun: [
      {
        command: "pnpm self:test",
        result: "passed",
        summary: "Self-test command passed."
      }
    ],
    externalSystems: [
      {
        system: "Self Test",
        resource: "self-test-resource",
        verifiedAt: "2026-06-23T00:00:00.000Z"
      }
    ],
    sensitiveDataStatement:
      "This evidence is sanitized and contains no secrets, credentials, tokens, private keys, raw customer personal data, or confidential provider payloads.",
    signedStatement:
      "I confirm this evidence is accurate for the named SearchLint release gate and has been sanitized for repository storage."
  };

  const cases = [
    {
      id: "valid-owner-evidence",
      expectedFailureCodes: [],
      value: validEvidence
    },
    {
      id: "missing-required-fields",
      expectedFailureCodes: [
        "missing_string",
        "missing_provided_by",
        "missing_artifacts",
        "missing_commands_run",
        "missing_external_systems"
      ],
      value: {
        schemaVersion: 1,
        gate: expected.gate,
        providedAt: "2026-06-23T00:00:00.000Z"
      }
    },
    {
      id: "gate-mismatch",
      expectedFailureCodes: ["field_mismatch"],
      value: {
        ...validEvidence,
        gate: {
          ...expected.gate,
          item: "Wrong gate"
        }
      }
    },
    {
      id: "failed-command-result",
      expectedFailureCodes: ["command_not_passed"],
      value: {
        ...validEvidence,
        commandsRun: [
          {
            command: "pnpm self:test",
            result: "failed",
            summary: "Self-test command failed."
          }
        ]
      }
    },
    {
      id: "sensitive-value",
      expectedFailureCodes: ["sensitive_value"],
      value: {
        ...validEvidence,
        evidenceSummary: "Contains bearer token."
      }
    },
    {
      id: "copied-template-placeholder",
      expectedFailureCodes: ["placeholder_value"],
      value: {
        ...validEvidence,
        evidenceSummary:
          "REPLACE_WITH_SHORT_SANITIZED_DESCRIPTION_OF_WHAT_WAS_ACTUALLY_VERIFIED",
        providedBy: {
          name: "REPLACE_WITH_OWNER_OR_REVIEWER_NAME",
          role: "Owner"
        }
      }
    }
  ];

  const results = cases.map((testCase) => {
    const failures = validateEvidenceValue(
      testCase.value,
      expected,
      `self-test/${testCase.id}.json`
    );
    const failureCodes = [...new Set(failures.map((failure) => failure.code))];
    const passed =
      testCase.expectedFailureCodes.length === 0
        ? failures.length === 0
        : testCase.expectedFailureCodes.every((code) =>
            failureCodes.includes(code)
          );
    return {
      id: testCase.id,
      status: passed ? "passed" : "failed",
      expectedFailureCodes: testCase.expectedFailureCodes,
      actualFailureCodes: failureCodes,
      failureCount: failures.length
    };
  });
  const report = {
    schemaVersion: 1,
    generatedBy: "searchlint-release-owner-evidence-self-test",
    generatedAt,
    status: results.every((result) => result.status === "passed")
      ? "passed"
      : "failed",
    caseCount: results.length,
    passedCaseCount: results.filter((result) => result.status === "passed")
      .length,
    results,
    nonClaims: [
      "Self-test fixtures are in-memory only and are not owner release evidence.",
      "This self-test does not close release gates."
    ]
  };

  assertNoSensitiveValues(JSON.stringify(report));
  await writeJson(selfTestReportPath, report);
  await writeJson(selfTestSamplePath, report);

  if (report.status !== "passed") {
    throw new Error("Owner evidence verifier self-test failed.");
  }

  console.log(
    `Release owner evidence self-test PASS: ${report.passedCaseCount}/${report.caseCount} cases passed`
  );
  console.log(`Report: ${selfTestReportPath}`);
  console.log(`Sample: ${selfTestSamplePath}`);
}
