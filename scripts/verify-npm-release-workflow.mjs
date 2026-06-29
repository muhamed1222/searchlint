#!/usr/bin/env node
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const workflowPath = path.join(repoRoot, ".github/workflows/npm-release.yml");
const reportPath = path.join(
  repoRoot,
  "reports/npm-release-workflow-report.json"
);
const samplePath = path.join(
  repoRoot,
  "docs/examples/npm-release-workflow-report.sample.json"
);
const fixedNow = "2026-06-23T00:00:00.000Z";

const requiredPublicPackageDirs = [
  "packages/browser",
  "packages/core",
  "packages/crawler",
  "packages/html",
  "packages/http",
  "packages/language",
  "packages/language-server",
  "packages/lsp",
  "packages/next",
  "packages/overlay",
  "packages/reporter-html",
  "packages/reporter-junit",
  "packages/reporter-sarif",
  "packages/source",
  "packages/cli",
  "packages/searchlint"
];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function includesAll(text, values) {
  return values.every((value) => text.includes(value));
}

async function main() {
  const workflow = await readFile(workflowPath, "utf8");

  const checks = [
    {
      id: "manual-dispatch",
      status:
        workflow.includes("workflow_dispatch:") &&
        workflow.includes("publish:") &&
        workflow.includes('default: "false"')
          ? "PASS"
          : "FAIL",
      evidence: "workflow_dispatch includes publish=false by default"
    },
    {
      id: "oidc-permissions",
      status:
        workflow.includes("permissions:") &&
        workflow.includes("contents: read") &&
        workflow.includes("id-token: write")
          ? "PASS"
          : "FAIL",
      evidence: "workflow requests GitHub OIDC id-token permission"
    },
    {
      id: "node-24",
      status:
        workflow.includes("actions/setup-node@v4") &&
        workflow.includes('node-version: "24"') &&
        workflow.includes('registry-url: "https://registry.npmjs.org"')
          ? "PASS"
          : "FAIL",
      evidence: "workflow configures Node.js 24 and npm registry URL"
    },
    {
      id: "supported-github-actions",
      status:
        workflow.includes("actions/checkout@v4") &&
        workflow.includes("actions/setup-node@v4") &&
        !/uses:\s+actions\/(?:checkout|setup-node)@v[5-9]\b/u.test(workflow)
          ? "PASS"
          : "FAIL",
      evidence:
        "workflow uses supported GitHub Actions versions for checkout and setup-node"
    },
    {
      id: "prepublish-gates",
      status: includesAll(workflow, [
        "pnpm verify:release",
        "pnpm package:dry-run",
        "pnpm package:registry-install"
      ])
        ? "PASS"
        : "FAIL",
      evidence: "workflow runs release, dry-run, and npm-like registry checks"
    },
    {
      id: "trusted-publish-command",
      status:
        workflow.includes("npm publish") &&
        workflow.includes("--provenance") &&
        workflow.includes("--access public") &&
        workflow.includes("--tag")
          ? "PASS"
          : "FAIL",
      evidence: "workflow publish command uses npm provenance and public access"
    },
    {
      id: "manual-publish-gate",
      status:
        workflow.includes("github.event.inputs.publish == 'true'") &&
        workflow.includes("Publish skipped")
          ? "PASS"
          : "FAIL",
      evidence: "workflow only publishes when manual publish=true"
    },
    {
      id: "public-package-allowlist",
      status: includesAll(workflow, requiredPublicPackageDirs)
        ? "PASS"
        : "FAIL",
      evidence: "workflow publish loop contains all public package directories"
    },
    {
      id: "environment-gate",
      status: workflow.includes("environment: npm-release") ? "PASS" : "FAIL",
      evidence: "workflow uses npm-release environment for owner approval gates"
    }
  ];

  const failed = checks.filter((check) => check.status !== "PASS");
  assert(
    failed.length === 0,
    `npm release workflow contract failed: ${failed.map((item) => item.id).join(", ")}`
  );

  const report = {
    schemaVersion: 1,
    generatedBy: "searchlint-npm-release-workflow-verifier",
    generatedAt: fixedNow,
    status: "PASS",
    workflow: ".github/workflows/npm-release.yml",
    checks,
    releaseGatesStillOpen: [
      "Create and verify the npm organization/package trusted-publisher bindings in npm.",
      "Configure the npm-release GitHub environment reviewers and branch/tag protections.",
      "Run the workflow in the hosted repository with publish=false and preserve logs.",
      "Run the workflow with publish=true only for approved beta/final releases.",
      "Verify clean install from the public npm registry after publication."
    ]
  };

  await mkdir(path.dirname(reportPath), { recursive: true });
  await mkdir(path.dirname(samplePath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(samplePath, `${JSON.stringify(report, null, 2)}\n`);

  console.log("npm release workflow contract PASS");
  console.log(`Report: ${path.relative(repoRoot, reportPath)}`);
  console.log(`Sample: ${path.relative(repoRoot, samplePath)}`);
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
