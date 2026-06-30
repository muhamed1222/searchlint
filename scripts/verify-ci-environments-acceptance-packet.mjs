#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const reportPath = path.join(
  repoRoot,
  "reports/ci-environments-acceptance-packet-report.json"
);
const samplePath = path.join(
  repoRoot,
  "docs/examples/ci-environments-acceptance-packet-report.sample.json"
);
const fixedGeneratedAt = "2026-06-23T00:00:00.000Z";

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

function section(text, heading, nextHeadingLevel = "### ") {
  const start = text.indexOf(heading);
  assert(start !== -1, `Missing CI section: ${heading}`);
  const next = text.indexOf(`\n${nextHeadingLevel}`, start + heading.length);
  return next === -1 ? text.slice(start) : text.slice(start, next);
}

function requireAll(text, phrases, label) {
  for (const phrase of phrases) {
    assert(text.includes(phrase), `${label} is missing: ${phrase}`);
  }
}

async function main() {
  run("node", ["scripts/verify-ci-workflow.mjs"]);

  const cliUsage = await readFile(
    path.join(repoRoot, "docs/CLI_CI_USAGE.md"),
    "utf8"
  );

  const sharedRequirements = [
    "corepack enable",
    "pnpm install --frozen-lockfile",
    "pnpm build",
    "searchlint check --snapshot snapshot.json --catalog"
  ];

  const environments = [
    {
      id: "github-actions",
      label: "GitHub Actions",
      heading: "### GitHub Actions",
      required: [
        "runs-on: ubuntu-latest",
        "actions/checkout@v4",
        "actions/setup-node@v5",
        "node-version: 24",
        "searchlint config validate --config searchlint.seo",
        "--format sarif"
      ]
    },
    {
      id: "gitlab-ci",
      label: "GitLab CI",
      heading: "### GitLab CI",
      required: [
        "image: node:24",
        "searchlint config validate --config searchlint.seo",
        "--format junit"
      ]
    },
    {
      id: "bitbucket-pipelines",
      label: "Bitbucket Pipelines",
      heading: "### Bitbucket Pipelines",
      required: ["image: node:24", "pull-requests:"]
    },
    {
      id: "jenkins",
      label: "Jenkins",
      heading: "### Jenkins",
      required: [
        "docker { image 'node:24' }",
        "searchlint config validate --config searchlint.seo",
        "--format junit"
      ]
    },
    {
      id: "docker",
      label: "Docker",
      heading: "### Docker",
      required: [
        "docker run --rm",
        "node:24",
        "sh -lc",
        "pnpm install --frozen-lockfile"
      ]
    }
  ];

  const cases = environments.map((environment) => {
    const body = section(cliUsage, environment.heading);
    requireAll(body, sharedRequirements, environment.label);
    requireAll(body, environment.required, environment.label);
    return {
      id: environment.id,
      status: "PASS",
      evidence: {
        heading: environment.heading,
        usesNode24:
          body.includes("node-version: 24") ||
          body.includes("node:24") ||
          body.includes("image 'node:24'"),
        installsDependencies: body.includes("pnpm install --frozen-lockfile"),
        runsSearchLint: body.includes("searchlint check --snapshot")
      }
    };
  });

  const report = {
    schemaVersion: 1,
    generatedBy: "searchlint-ci-environments-acceptance-packet",
    generatedAt: fixedGeneratedAt,
    summary: {
      status: "PASS",
      environmentCount: cases.length,
      staticWorkflowContract: "PASS",
      liveExternalCiGate: "BLOCKED_OWNER_RUNNER_EVIDENCE_REQUIRED"
    },
    cases,
    verifiedContracts: [
      "docs/CLI_CI_USAGE.md documents GitHub Actions, GitLab CI, Bitbucket Pipelines, Jenkins, and Docker examples.",
      "CI examples use Node.js 24, corepack, frozen pnpm install, workspace build, and SearchLint CLI checks.",
      ".github/workflows/ci.yml static Docker image/SBOM/provenance contract passes scripts/verify-ci-workflow.mjs."
    ],
    remainingReleaseGates: [
      "Run the documented GitHub Actions snippet in a real hosted GitHub runner after package publication.",
      "Run the documented GitLab CI snippet in a real hosted GitLab runner after package publication.",
      "Run the documented Bitbucket Pipelines snippet in a real hosted Bitbucket runner after package publication.",
      "Run the documented Jenkins pipeline in an approved Jenkins runner after package publication.",
      "Run CI install from the approved public or npm-like registry instead of local repository sources.",
      "Run Windows and Linux installed CLI acceptance in real CI runners."
    ]
  };

  await mkdir(path.dirname(reportPath), { recursive: true });
  await mkdir(path.dirname(samplePath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(samplePath, `${JSON.stringify(report, null, 2)}\n`);

  console.log("CI environments acceptance packet PASS");
  console.log(`Report: ${path.relative(repoRoot, reportPath)}`);
  console.log(`Sample: ${path.relative(repoRoot, samplePath)}`);
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
