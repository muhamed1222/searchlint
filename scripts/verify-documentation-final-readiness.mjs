#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { format } from "prettier";

const reportPath = "reports/documentation-final-readiness-report.json";
const samplePath =
  "docs/examples/documentation-final-readiness-report.sample.json";

const prerequisiteCommands = [
  command("releaseDocsAcceptance", "pnpm", ["reporters:acceptance"]),
  command("websiteOnboardingSource", "pnpm", ["website:acceptance"]),
  command("ruleDocsCheck", "pnpm", ["docs:rules:check"])
];

const requiredDocuments = [
  "README.md",
  "CHANGELOG.md",
  "LICENSE",
  "NOTICE",
  "CONTRIBUTING.md",
  "DCO.md",
  "SECURITY.md",
  "docs/INSTALLATION.md",
  "docs/DSL_MIGRATION_GUIDE.md",
  "docs/COMPATIBILITY_MATRIX.md",
  "docs/SECURITY_MODEL.md",
  "docs/SECURITY_PRIVACY_RELEASE_GATE.md",
  "docs/PACKAGE_DOCUMENTATION.md",
  "docs/API_DOCUMENTATION.md",
  "docs/RELEASE_NOTES.md",
  "docs/SUPPORT_POLICY.md",
  "docs/DEPRECATION_POLICY.md",
  "docs/VERSIONING_POLICY.md",
  "docs/UPGRADE_GUIDE.md",
  "docs/INCIDENT_SUPPORT_PROCESS.md",
  "docs/PUBLIC_WEBSITE_ONBOARDING.md",
  "docs/ONBOARDING_GUIDE.md",
  "docs/FAQ.md",
  "docs/TROUBLESHOOTING.md",
  "docs/rules/README.md",
  "docs/examples/demo-project/README.md",
  "docs/examples/demo-project/searchlint.seo",
  "specs/SEARCHLINT_LANGUAGE_SPEC.md",
  "docs/SEARCHLINT_1_0_MASTER_CHECKLIST.md",
  "docs/SEARCHLINT_1_0_RELEASE_CANDIDATE_MATRIX.md",
  "docs/SEARCHLINT_1_0_FINAL_RELEASE_GATE.md",
  "docs/CURRENT_PRODUCT_STATUS.md",
  "docs/RELEASE_GAP_MATRIX.md",
  "docs/PROJECT_PROGRESS.md"
];

const requiredSamples = [
  "docs/examples/public-website-onboarding-report.sample.json",
  "docs/examples/reporters-release-docs-acceptance-report.sample.json"
];

const requiredHonestyMarkers = [
  ["README.md", "SearchLint 1.0 is not released"],
  ["CHANGELOG.md", "SearchLint 1.0 is not released"],
  ["docs/RELEASE_NOTES.md", "SearchLint 1.0 is not released"],
  ["docs/INSTALLATION.md", "SearchLint 1.0 is not released"],
  [
    "docs/PUBLIC_WEBSITE_ONBOARDING.md",
    "live cloud availability before deployed acceptance is complete"
  ],
  [
    "docs/SEARCHLINT_1_0_FINAL_RELEASE_GATE.md",
    "Current final release verdict: `BLOCKED`"
  ]
];

async function main() {
  const commands = prerequisiteCommands.map(runCommand);
  const documents = await verifyNonEmptyFiles(requiredDocuments);
  const samples = await verifyJsonSamples(requiredSamples);
  const releaseHonesty = await verifyReleaseHonesty();

  const report = {
    generatedBy: "searchlint-documentation-final-readiness-verifier",
    generatedAt: "2026-06-23T00:00:00.000Z",
    status: "passed",
    scope: {
      proofType: "deterministic release documentation final readiness",
      closesMasterChecklistItem: "Documentation завершена",
      doesNotClaim: [
        "deployed public website",
        "final marketing/legal/privacy/pricing approval",
        "live onboarding or signup",
        "SearchLint 1.0 final release approval"
      ]
    },
    commands,
    documents,
    samples,
    releaseHonesty,
    summary: {
      commandCount: commands.length,
      documentCount: documents.length,
      sampleCount: samples.length,
      honestyMarkerCount: releaseHonesty.length
    },
    assertions: [
      "Release documentation acceptance passes.",
      "Public website/onboarding source acceptance passes.",
      "Generated rule documentation is current.",
      "Required release documentation files exist and are non-empty.",
      "Required documentation samples exist, are non-empty, and parse as JSON.",
      "Release docs explicitly state that SearchLint 1.0 is not released while final gates remain blocked."
    ]
  };

  assertNoSensitiveValues(JSON.stringify(report));
  await mkdir(path.dirname(reportPath), { recursive: true });
  await mkdir(path.dirname(samplePath), { recursive: true });
  await writeJson(reportPath, report);
  await writeJson(samplePath, report);

  console.log(
    `Documentation final readiness PASS: ${documents.length} docs, ${samples.length} samples verified`
  );
  console.log(`Report: ${reportPath}`);
  console.log(`Sample: ${samplePath}`);
}

function command(name, executable, args) {
  return { name, executable, args };
}

function runCommand(item) {
  const startedAt = Date.now();
  const result = spawnSync(item.executable, item.args, {
    cwd: process.cwd(),
    env: process.env,
    encoding: "utf8",
    stdio: "pipe"
  });
  const durationMs = Date.now() - startedAt;
  if (result.status !== 0) {
    if (result.stdout) {
      process.stdout.write(result.stdout);
    }
    if (result.stderr) {
      process.stderr.write(result.stderr);
    }
    throw new Error(
      `${item.name} failed with exit code ${String(result.status)}.`
    );
  }
  return {
    name: item.name,
    command: [item.executable, ...item.args].join(" "),
    status: "passed",
    durationMs
  };
}

async function verifyNonEmptyFiles(filePaths) {
  const evidence = [];
  for (const filePath of filePaths) {
    const info = await stat(filePath);
    if (!info.isFile()) {
      throw new Error(`${filePath} is not a file.`);
    }
    const text = await readFile(filePath, "utf8");
    if (text.trim().length === 0) {
      throw new Error(`${filePath} is empty.`);
    }
    evidence.push({ path: filePath, bytes: info.size });
  }
  return evidence;
}

async function verifyJsonSamples(filePaths) {
  const evidence = [];
  for (const filePath of filePaths) {
    const text = await readFile(filePath, "utf8");
    if (text.trim().length === 0) {
      throw new Error(`${filePath} is empty.`);
    }
    JSON.parse(text);
    evidence.push({ path: filePath, status: "valid-json" });
  }
  return evidence;
}

async function verifyReleaseHonesty() {
  const evidence = [];
  for (const [filePath, marker] of requiredHonestyMarkers) {
    const text = await readFile(filePath, "utf8");
    if (!text.includes(marker)) {
      throw new Error(
        `${filePath} is missing release-honesty marker ${marker}.`
      );
    }
    evidence.push({ filePath, marker, status: "present" });
  }
  return evidence;
}

function assertNoSensitiveValues(text) {
  const forbidden = [
    /private_key/i,
    /client-secret/i,
    /authorization:/i,
    /bearer\s+/i,
    /sk_live/i,
    /whsec_/i,
    /postgres:\/\/user/i,
    /-----BEGIN PRIVATE KEY-----/i,
    /ya29\./i
  ];
  const match = forbidden.find((pattern) => pattern.test(text));
  if (match) {
    throw new Error(
      `Sensitive value leaked into documentation final evidence: ${match}`
    );
  }
}

async function writeJson(filePath, data) {
  await writeFile(
    filePath,
    await format(JSON.stringify(data), { parser: "json" })
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
