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
const packageManagerSamplePath = path.join(
  repoRoot,
  "docs/examples/cli-package-manager-acceptance-report.sample.json"
);
const reportPath = path.join(
  repoRoot,
  "reports/windows-cli-acceptance-packet-report.json"
);
const samplePath = path.join(
  repoRoot,
  "docs/examples/windows-cli-acceptance-packet-report.sample.json"
);
const fixedGeneratedAt = "2026-06-23T00:00:00.000Z";

const requiredCliCommands = [
  "version",
  "doctor",
  "completion-bash",
  "init",
  "config-validate",
  "check-json",
  "check-text",
  "check-sarif",
  "check-junit",
  "check-html",
  "baseline",
  "migrate-config",
  "fail-on-blocker",
  "invalid-args"
];

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

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function main() {
  run("pnpm", ["cli:acceptance"]);
  run("pnpm", ["cli:package-manager-acceptance"]);

  const cliSample = await readJson(cliSamplePath);
  const packageManagerSample = await readJson(packageManagerSamplePath);
  const observedCommands = new Set(
    (cliSample.results ?? []).map((item) => item.name)
  );
  const missingCommands = requiredCliCommands.filter(
    (name) => !observedCommands.has(name)
  );

  assert(cliSample.status === "PASS", "CLI acceptance sample must be PASS");
  assert(
    cliSample.commandCount >= requiredCliCommands.length,
    "CLI acceptance sample must include all required command cases"
  );
  assert(
    cliSample.packageCount >= 15,
    "CLI acceptance sample must include all public package tarballs"
  );
  assert(
    missingCommands.length === 0,
    `CLI acceptance sample is missing commands: ${missingCommands.join(", ")}`
  );
  assert(
    Array.isArray(cliSample.results) &&
      cliSample.results.every((item) => item.status === "pass"),
    "CLI acceptance sample results must all pass"
  );
  assert(
    packageManagerSample.status === "PASS",
    "Package-manager acceptance sample must be PASS"
  );

  const packageManagerCases = packageManagerSample.packageManagers ?? [];
  const packageManagers = packageManagerCases.map(
    (item) => item.packageManager
  );
  for (const name of ["npm", "yarn"]) {
    assert(
      packageManagers.includes(name),
      `Package-manager acceptance must include ${name}`
    );
  }
  assert(
    packageManagerCases.every((item) => item.status === "PASS"),
    "Package-manager acceptance cases must all pass"
  );

  const isNativeWindows = process.platform === "win32";
  const report = {
    schemaVersion: 1,
    generatedBy: "searchlint-windows-cli-acceptance-packet",
    generatedAt: fixedGeneratedAt,
    hostPlatform: process.platform,
    summary: {
      status: "PASS",
      packetStatus: isNativeWindows
        ? "NATIVE_WINDOWS_RUNNER_OBSERVED"
        : "READY_FOR_OWNER_WINDOWS_RUNNER",
      nativeWindowsReleaseGate: isNativeWindows
        ? "EVIDENCE_PRESENT_ON_THIS_RUN"
        : "BLOCKED_NATIVE_WINDOWS_RUNNER_REQUIRED"
    },
    verifiedEvidence: {
      prerequisiteCommands: [
        "pnpm cli:acceptance",
        "pnpm cli:package-manager-acceptance"
      ],
      cliSample: "docs/examples/cli-acceptance-report.sample.json",
      packageManagerSample:
        "docs/examples/cli-package-manager-acceptance-report.sample.json",
      cliCommandCount: cliSample.commandCount,
      cliPackageCount: cliSample.packageCount,
      cliSamplePlatform: cliSample.platform,
      packageManagerSamplePlatform: packageManagerSample.platform,
      packageManagerPackageCount: packageManagerSample.packageCount,
      packageManagers,
      requiredCliCommands
    },
    requiredOwnerEvidence: isNativeWindows
      ? []
      : [
          {
            id: "native-windows-installed-cli",
            description:
              "Run the installed CLI acceptance command on a clean Windows runner with Node.js 24 and pnpm 11.",
            command: "pnpm cli:windows-acceptance",
            requiredPlatform: "win32"
          },
          {
            id: "windows-powershell-smoke",
            description:
              "Run SearchLint command smoke tests from PowerShell with native Windows paths.",
            command:
              "searchlint --version; searchlint doctor; searchlint check --format json",
            requiredPlatform: "win32"
          },
          {
            id: "windows-registry-install",
            description:
              "Install SearchLint from the approved public or npm-like registry on Windows after publication.",
            command: "npm install -D @searchlint/cli @searchlint/core",
            requiredPlatform: "win32"
          }
        ],
    releaseNotes: [
      "This packet proves current pnpm CLI tarball acceptance plus npm/Yarn local package-manager acceptance.",
      "This packet does not prove native Windows installed CLI execution when run on a non-Windows host.",
      "Native Windows filesystem DSL acceptance remains covered by the separate Windows paths release-runner gate."
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

  console.log("Windows CLI acceptance packet PASS");
  console.log(`Report: ${path.relative(repoRoot, reportPath)}`);
  console.log(`Sample: ${path.relative(repoRoot, samplePath)}`);
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
