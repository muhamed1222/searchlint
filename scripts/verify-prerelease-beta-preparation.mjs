#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

const betaVersionPattern = /^1\.0\.0-beta\.\d+$/;
const fixedNow = "2026-06-23T00:00:00.000Z";
const reportPath = path.join(
  repoRoot,
  "reports/prerelease-beta-preparation-report.json"
);
const samplePath = path.join(
  repoRoot,
  "docs/examples/prerelease-beta-preparation-report.sample.json"
);

const publicPackages = [
  "packages/browser",
  "packages/cli",
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
  "packages/searchlint"
];

const privatePackages = ["apps/dashboard", "services/api", "services/workers"];

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

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(repoRoot, relativePath), "utf8"));
}

async function main() {
  if (!process.version.startsWith("v24.")) {
    throw new Error(
      `prerelease beta preparation must run under Node.js 24, got ${process.version}`
    );
  }

  run("pnpm", ["package:dry-run"]);
  run("pnpm", ["package:registry-install"]);
  run("pnpm", ["package:release-workflow"]);

  const publicPackageReports = [];
  for (const packageDir of publicPackages) {
    const manifest = await readJson(`${packageDir}/package.json`);
    assert(
      betaVersionPattern.test(manifest.version),
      `${manifest.name} must use an explicit 1.0.0-beta.* version`
    );
    assert(
      manifest.private !== true,
      `${manifest.name} must be publishable, not private`
    );
    assert(
      manifest.publishConfig?.provenance === true,
      `${manifest.name} must enable npm provenance metadata`
    );
    assert(
      manifest.publishConfig?.access === "public" ||
        !manifest.name.startsWith("@"),
      `${manifest.name} scoped packages must publish with public access`
    );
    publicPackageReports.push({
      name: manifest.name,
      version: manifest.version,
      private: manifest.private === true,
      publishConfig: manifest.publishConfig ?? null
    });
  }

  const privatePackageReports = [];
  for (const packageDir of privatePackages) {
    const manifest = await readJson(`${packageDir}/package.json`);
    assert(
      manifest.private === true,
      `${manifest.name} must remain private for beta package publication`
    );
    privatePackageReports.push({
      name: manifest.name,
      version: manifest.version,
      private: manifest.private === true
    });
  }

  const releaseNotes = await readFile(
    path.join(repoRoot, "docs/RELEASE_NOTES.md"),
    "utf8"
  );
  const changelog = await readFile(path.join(repoRoot, "CHANGELOG.md"), "utf8");
  const workflowReport = await readJson(
    "docs/examples/npm-release-workflow-report.sample.json"
  );
  const registryReport = await readJson(
    "docs/examples/npm-like-registry-install-report.sample.json"
  );

  assert(
    releaseNotes.includes("## Current Published Beta Line"),
    "release notes must include current published beta line notes"
  );
  assert(
    /Public npm beta packages are published/.test(releaseNotes),
    "release notes must acknowledge current beta npm publication"
  );
  assert(
    changelog.includes("## Current Published Beta Line"),
    "changelog must include current published beta line"
  );
  assert(
    workflowReport.status === "PASS",
    "npm release workflow report must pass"
  );
  assert(
    registryReport.status === "PASS",
    "npm-like registry install report must pass"
  );

  const report = {
    schemaVersion: 1,
    generatedBy: "searchlint-prerelease-beta-preparation",
    generatedAt: fixedNow,
    status: "PASS",
    betaVersionPattern: String(betaVersionPattern),
    publicPackageCount: publicPackageReports.length,
    privatePackageCount: privatePackageReports.length,
    publicPackages: publicPackageReports,
    privatePackages: privatePackageReports,
    verifiedEvidence: [
      "pnpm package:dry-run",
      "pnpm package:registry-install",
      "pnpm package:release-workflow",
      "docs/RELEASE_NOTES.md",
      "CHANGELOG.md"
    ],
    releaseGatesStillOpen: [
      "Legal approval for public package publication.",
      "npm-side trusted publisher bindings and hosted workflow proof.",
      "Owner-approved workflow run with publish=true and tag=beta.",
      "Clean install from the public npm registry after beta publication."
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
    `prerelease beta preparation PASS: ${publicPackageReports.length} public packages on 1.0.0-beta.*`
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
