#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { format } from "prettier";

const approvalPath = "docs/package-metadata-approval.json";
const examplePath = "docs/package-metadata-approval.example.json";
const reportPath = "reports/public-package-metadata-approval-report.json";
const samplePath =
  "docs/examples/public-package-metadata-approval-report.sample.json";
const generatedAt = "2026-06-23T00:00:00.000Z";

const publicPackages = [
  ["@searchlint/browser", "packages/browser"],
  ["@searchlint/cli", "packages/cli"],
  ["@searchlint/core", "packages/core"],
  ["@searchlint/crawler", "packages/crawler"],
  ["@searchlint/html", "packages/html"],
  ["@searchlint/http", "packages/http"],
  ["@searchlint/language", "packages/language"],
  ["searchlint-language-server", "packages/language-server"],
  ["@searchlint/lsp", "packages/lsp"],
  ["@searchlint/next", "packages/next"],
  ["@searchlint/overlay", "packages/overlay"],
  ["@searchlint/reporter-html", "packages/reporter-html"],
  ["@searchlint/reporter-junit", "packages/reporter-junit"],
  ["@searchlint/reporter-sarif", "packages/reporter-sarif"],
  ["@searchlint/source", "packages/source"],
  ["searchlint", "packages/searchlint"]
];

const issues = [];
const approval = await readOptionalJson(approvalPath);

if (!approval) {
  issues.push(issue("missing-approval", `${approvalPath} is required.`));
} else {
  validateApproval(approval);
}

const report = {
  schemaVersion: 1,
  generatedBy: "searchlint-public-package-metadata-approval-verifier",
  generatedAt,
  status: issues.length === 0 ? "passed" : "blocked",
  approval: summarizeApproval(approval),
  publicPackageCount: publicPackages.length,
  publicPackages: publicPackages.map(([name, directory]) => ({
    name,
    directory,
    covered: approval?.repository?.directoryMappings?.[name] === directory
  })),
  releaseGate: {
    passFail: issues.length === 0 ? "pass" : "fail",
    checks: {
      approvalPresent: Boolean(approval),
      schemaVersionValid: approval?.schemaVersion === 1,
      repositoryApproved: issues.every(
        (entry) => !entry.code.startsWith("repository-")
      ),
      homepageApproved: issues.every(
        (entry) => !entry.code.startsWith("homepage-")
      ),
      bugsApproved: issues.every((entry) => !entry.code.startsWith("bugs-")),
      directoryMappingsComplete: issues.every(
        (entry) => !entry.code.startsWith("directory-")
      ),
      signedStatementPresent: issues.every(
        (entry) => entry.code !== "missing-signed-statement"
      ),
      noExampleValues: !approval || !looksLikeExample(approval)
    }
  },
  issues,
  nextSteps:
    issues.length === 0
      ? [
          "Apply approved metadata to public package manifests.",
          "Run pnpm package:dry-run.",
          "Run npm beta publication owner gate."
        ]
      : [
          `Create ${approvalPath} from ${examplePath} with real owner-approved values.`,
          "Do not edit package manifests until the approval gate passes."
        ]
};

report.releaseGate.failedChecks = Object.entries(report.releaseGate.checks)
  .filter(([, passed]) => !passed)
  .map(([check]) => check);

assertNoSensitiveValues(JSON.stringify(report));
await writeJson(reportPath, report);
await writeJson(samplePath, report);

if (report.status !== "passed") {
  console.error("Public package metadata approval gate blocked.");
  for (const entry of issues) {
    console.error(`- ${entry.code}: ${entry.message}`);
  }
  console.error(`Report: ${reportPath}`);
  console.error(`Sample: ${samplePath}`);
  process.exitCode = 1;
} else {
  console.log("Public package metadata approval gate PASS.");
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

function validateApproval(value) {
  if (value.schemaVersion !== 1) {
    issues.push(issue("invalid-schema-version", "schemaVersion must be 1."));
  }
  for (const field of ["approvedBy", "approvedAt", "signedStatement"]) {
    if (typeof value[field] !== "string" || value[field].trim() === "") {
      issues.push(issue("missing-field", `${field} is required.`));
    }
  }
  if (looksLikeExample(value)) {
    issues.push(
      issue("example-values", "Example/template values are not evidence.")
    );
  }
  if (
    typeof value.signedStatement !== "string" ||
    !/approve|approved|approval/i.test(value.signedStatement)
  ) {
    issues.push(
      issue(
        "missing-signed-statement",
        "signedStatement must explicitly approve package metadata."
      )
    );
  }
  validateRepository(value.repository);
  validateUrlObject("homepage", value.homepage);
  validateUrlObject("bugs", value.bugs);
}

function validateRepository(repository) {
  if (!repository || typeof repository !== "object") {
    issues.push(issue("repository-missing", "repository is required."));
    return;
  }
  if (repository.type !== "git") {
    issues.push(issue("repository-type", "repository.type must be git."));
  }
  if (!isHttpsGithubUrl(repository.url)) {
    issues.push(
      issue(
        "repository-url",
        "repository.url must be an HTTPS GitHub repository URL."
      )
    );
  }
  const mappings = repository.directoryMappings;
  if (!mappings || typeof mappings !== "object" || Array.isArray(mappings)) {
    issues.push(
      issue(
        "directory-mappings-missing",
        "repository.directoryMappings is required."
      )
    );
    return;
  }
  for (const [name, directory] of publicPackages) {
    if (mappings[name] !== directory) {
      issues.push(
        issue("directory-mapping-mismatch", `${name} must map to ${directory}.`)
      );
    }
  }
  const allowedNames = new Set(publicPackages.map(([name]) => name));
  for (const name of Object.keys(mappings)) {
    if (!allowedNames.has(name)) {
      issues.push(
        issue(
          "directory-extra-package",
          `${name} is not a public package candidate.`
        )
      );
    }
  }
}

function validateUrlObject(name, value) {
  if (!value || typeof value !== "object") {
    issues.push(issue(`${name}-missing`, `${name} is required.`));
    return;
  }
  if (!isHttpsUrl(value.url)) {
    issues.push(issue(`${name}-url`, `${name}.url must be an HTTPS URL.`));
  }
}

function summarizeApproval(value) {
  if (!value) return { present: false };
  return {
    present: true,
    approvedBy: value.approvedBy,
    approvedAt: value.approvedAt,
    repositoryUrl: value.repository?.url ?? null,
    homepageUrl: value.homepage?.url ?? null,
    bugsUrl: value.bugs?.url ?? null
  };
}

function isHttpsGithubUrl(value) {
  return (
    typeof value === "string" &&
    /^https:\/\/github\.com\/[^/\s]+\/[^/\s]+(?:\.git)?$/u.test(value)
  );
}

function isHttpsUrl(value) {
  return typeof value === "string" && /^https:\/\/[^/\s]+\/?.*/u.test(value);
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
    /ya29\./i,
    /xox[baprs]-/i
  ];
  const match = forbidden.find((pattern) => pattern.test(text));
  if (match) {
    throw new Error(
      `Sensitive value leaked into package metadata evidence: ${match}`
    );
  }
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(
    filePath,
    await format(`${JSON.stringify(value, null, 2)}\n`, { parser: "json" })
  );
}
