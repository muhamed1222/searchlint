#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

const fixedNow = "2026-06-23T00:00:00.000Z";
const workflowPath = path.join(repoRoot, ".github/workflows/npm-release.yml");
const betaPrepSamplePath = path.join(
  repoRoot,
  "docs/examples/prerelease-beta-preparation-report.sample.json"
);
const reportPath = path.join(
  repoRoot,
  "reports/beta-package-publication-gate-report.json"
);
const samplePath = path.join(
  repoRoot,
  "docs/examples/beta-package-publication-gate-report.sample.json"
);

const expectedPublicPackageCount = 16;
const expectedPrivatePackageCount = 3;
const expectedBetaVersionPattern = /^1\.0\.0-beta\.\d+$/;

function run(command, args) {
  execFileSync(command, args, {
    cwd: repoRoot,
    env: process.env,
    stdio: "inherit"
  });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function check(id, condition, evidence) {
  return {
    id,
    status: condition ? "PASS" : "FAIL",
    evidence
  };
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function main() {
  if (!process.version.startsWith("v24.")) {
    throw new Error(
      `beta package publication gate must run under Node.js 24, got ${process.version}`
    );
  }

  run("pnpm", ["package:beta-prep"]);

  const workflow = await readFile(workflowPath, "utf8");
  const betaPrep = await readJson(betaPrepSamplePath);

  const checks = [
    check(
      "beta-prep-pass",
      betaPrep.status === "PASS" &&
        betaPrep.publicPackages.every((item) =>
          expectedBetaVersionPattern.test(item.version)
        ) &&
        betaPrep.publicPackageCount === expectedPublicPackageCount &&
        betaPrep.privatePackageCount === expectedPrivatePackageCount,
      "prerelease beta preparation sample is PASS for 16 public packages and 3 private packages"
    ),
    check(
      "manual-workflow-dispatch",
      workflow.includes("workflow_dispatch:") &&
        workflow.includes("publish:") &&
        workflow.includes('default: "false"'),
      "npm release workflow is manual and defaults publish to false"
    ),
    check(
      "publish-true-only",
      workflow.includes("github.event.inputs.publish == 'true'") &&
        workflow.includes("Publish skipped") &&
        !workflow.includes("github.event.inputs.publish != 'false'"),
      "npm publish step runs only when owner dispatches publish=true"
    ),
    check(
      "beta-dist-tag",
      workflow.includes("tag:") &&
        workflow.includes('default: "beta"') &&
        workflow.includes('- "beta"') &&
        workflow.includes('--tag "${{ github.event.inputs.tag }}"'),
      "workflow supports the beta dist-tag and forwards it to npm publish"
    ),
    check(
      "trusted-publishing-provenance",
      workflow.includes("id-token: write") &&
        workflow.includes("--provenance") &&
        workflow.includes("--access public") &&
        workflow.includes('registry-url: "https://registry.npmjs.org"'),
      "workflow is configured for npm trusted publishing with provenance"
    ),
    check(
      "environment-owner-gate",
      workflow.includes("environment: npm-release"),
      "workflow uses the npm-release GitHub environment gate"
    ),
    check(
      "no-token-publish-path",
      !workflow.includes("NODE_AUTH_TOKEN") &&
        !workflow.includes("NPM_TOKEN") &&
        !workflow.includes("npm_token") &&
        !workflow.includes("automation token"),
      "trusted publishing path does not reference npm automation-token secrets"
    )
  ];

  const failed = checks.filter((item) => item.status !== "PASS");
  assert(
    failed.length === 0,
    `beta package publication gate failed: ${failed.map((item) => item.id).join(", ")}`
  );

  const report = {
    schemaVersion: 1,
    generatedBy: "searchlint-beta-package-publication-gate",
    generatedAt: fixedNow,
    status: "PASS",
    releaseGateStatus: "BLOCKED_EXTERNAL_EVIDENCE",
    betaVersionPattern: String(expectedBetaVersionPattern),
    publicPackageCount: betaPrep.publicPackageCount,
    privatePackageCount: betaPrep.privatePackageCount,
    checks,
    ownerRequiredBeforePublishTrue: [
      "Legal approval for LICENSE, NOTICE, CONTRIBUTING, SECURITY, trademark policy, package metadata, and repository boundary.",
      "GitHub npm-release environment reviewers and branch/tag protections configured in the hosted repository.",
      "npm organization/package trusted publisher bindings configured for .github/workflows/npm-release.yml.",
      "Hosted workflow run with publish=false captured as evidence.",
      "Owner approval for workflow_dispatch publish=true with tag=beta."
    ],
    ownerRequiredAfterPublishTrue: [
      "Hosted workflow logs for publish=true preserved.",
      "Published package versions and provenance verified in npm.",
      "Clean install from the public npm registry verified in a clean npm consumer.",
      "Clean install from the public npm registry verified in clean pnpm and Yarn consumers when package-manager support is claimed.",
      "Master checklist item `Опубликовать beta packages` marked complete only after publication evidence exists."
    ],
    notClaimed: [
      "This report does not prove beta packages were published.",
      "This report does not prove clean install from the public npm registry.",
      "This report does not approve final 1.0.0 publication."
    ]
  };

  await mkdir(path.dirname(reportPath), { recursive: true });
  await mkdir(path.dirname(samplePath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(samplePath, `${JSON.stringify(report, null, 2)}\n`);
  run("pnpm", [
    "exec",
    "prettier",
    "--write",
    path.relative(repoRoot, reportPath),
    path.relative(repoRoot, samplePath)
  ]);

  console.log(
    `beta package publication owner gate PASS with ${report.releaseGateStatus}`
  );
  console.log(`Report: ${path.relative(repoRoot, reportPath)}`);
  console.log(`Sample: ${path.relative(repoRoot, samplePath)}`);
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
