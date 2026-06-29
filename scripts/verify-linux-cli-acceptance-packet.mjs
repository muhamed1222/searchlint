#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const cliSamplePath = path.join(
  repoRoot,
  "docs/examples/cli-acceptance-report.sample.json"
);
const ciSamplePath = path.join(
  repoRoot,
  "docs/examples/ci-environments-acceptance-packet-report.sample.json"
);
const reportPath = path.join(
  repoRoot,
  "reports/linux-cli-acceptance-packet-report.json"
);
const samplePath = path.join(
  repoRoot,
  "docs/examples/linux-cli-acceptance-packet-report.sample.json"
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

async function main() {
  run("pnpm", ["cli:acceptance"]);
  run("pnpm", ["cli:ci-environments"]);

  const cliSample = JSON.parse(await readFile(cliSamplePath, "utf8"));
  const ciSample = JSON.parse(await readFile(ciSamplePath, "utf8"));
  const ciCases = ciSample.cases ?? [];

  assert(cliSample.status === "PASS", "CLI acceptance sample must be PASS");
  assert(
    cliSample.commandCount >= 14 && cliSample.packageCount >= 15,
    "CLI acceptance sample must include command and package coverage"
  );
  assert(
    Array.isArray(cliSample.results) &&
      cliSample.results.every((item) => item.status === "pass"),
    "CLI acceptance sample results must all pass"
  );
  assert(
    ciSample.summary?.status === "PASS",
    "CI environments sample must be PASS"
  );

  const linuxShapedCases = ciCases.filter((item) => {
    return (
      item.evidence?.heading === "### GitHub Actions" ||
      item.evidence?.heading === "### GitLab CI" ||
      item.evidence?.heading === "### Bitbucket Pipelines" ||
      item.evidence?.heading === "### Jenkins" ||
      item.evidence?.heading === "### Docker"
    );
  });
  assert(
    linuxShapedCases.length === 5,
    "CI environment sample must include all Linux-shaped CI/container cases"
  );
  assert(
    linuxShapedCases.every((item) => item.evidence?.usesNode24 === true),
    "Linux-shaped CI/container cases must use Node.js 24"
  );
  assert(
    linuxShapedCases.every(
      (item) =>
        item.evidence?.installsDependencies === true &&
        item.evidence?.runsSearchLint === true
    ),
    "Linux-shaped CI/container cases must install dependencies and run SearchLint"
  );

  const isNativeLinux = process.platform === "linux";
  const report = {
    schemaVersion: 1,
    generatedBy: "searchlint-linux-cli-acceptance-packet",
    generatedAt: fixedGeneratedAt,
    hostPlatform: process.platform,
    summary: {
      status: "PASS",
      packetStatus: isNativeLinux
        ? "NATIVE_LINUX_RUNNER_OBSERVED"
        : "READY_FOR_OWNER_LINUX_RUNNER",
      nativeLinuxReleaseGate: isNativeLinux
        ? "EVIDENCE_PRESENT_ON_THIS_RUN"
        : "BLOCKED_NATIVE_LINUX_RUNNER_REQUIRED"
    },
    verifiedEvidence: {
      prerequisiteCommands: ["pnpm cli:acceptance", "pnpm cli:ci-environments"],
      cliSample: "docs/examples/cli-acceptance-report.sample.json",
      ciSample:
        "docs/examples/ci-environments-acceptance-packet-report.sample.json",
      cliCommandCount: cliSample.commandCount,
      cliPackageCount: cliSample.packageCount,
      cliSamplePlatform: cliSample.platform,
      ciEnvironmentCount: ciSample.summary.environmentCount,
      linuxShapedCiCases: linuxShapedCases.map((item) => item.id)
    },
    requiredOwnerEvidence: isNativeLinux
      ? []
      : [
          {
            id: "native-linux-installed-cli",
            description:
              "Run the installed CLI acceptance command on a clean Linux runner with Node.js 24 and pnpm 11.",
            command: "pnpm cli:linux-acceptance",
            requiredPlatform: "linux"
          },
          {
            id: "linux-shell-completion",
            description:
              "Source generated Bash/Zsh/Fish completion scripts in real Linux shells.",
            command: "searchlint completion bash|zsh|fish",
            requiredPlatform: "linux"
          },
          {
            id: "linux-registry-install",
            description:
              "Install SearchLint from the approved public or npm-like registry on Linux after publication.",
            command: "npm install -D @searchlint/cli @searchlint/core",
            requiredPlatform: "linux"
          }
        ],
    releaseNotes: [
      "This packet proves current CLI tarball acceptance and Linux-shaped CI/container documentation contracts.",
      "This packet does not prove native Linux installed CLI execution when run on a non-Linux host.",
      "Windows CLI acceptance remains a separate open checklist item."
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

  console.log("Linux CLI acceptance packet PASS");
  console.log(`Report: ${path.relative(repoRoot, reportPath)}`);
  console.log(`Sample: ${path.relative(repoRoot, samplePath)}`);
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
