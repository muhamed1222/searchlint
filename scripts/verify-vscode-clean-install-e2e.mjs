#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  downloadAndUnzipVSCode,
  resolveCliPathFromVSCodeExecutablePath,
  runTests
} from "@vscode/test-electron";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const fixedGeneratedAt = "2026-06-23T00:00:00.000Z";
const vsixPath = path.join(
  repoRoot,
  "reports/searchlint-vscode-1.0.0-beta.0.vsix"
);
const reportPath = path.join(
  repoRoot,
  "reports/vscode-clean-install-e2e-report.json"
);
const samplePath = path.join(
  repoRoot,
  "docs/examples/vscode-clean-install-e2e-report.sample.json"
);
const extensionDevelopmentPath = path.join(repoRoot, "apps/vscode");
const extensionTestsPath = path.join(
  repoRoot,
  "apps/vscode/e2e/extension-host.test.cjs"
);

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    env: { ...process.env, ...options.env },
    encoding: "utf8",
    stdio: options.stdio ?? "pipe"
  });
}

function runCli(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    env: { ...process.env, ...options.env },
    encoding: "utf8"
  });
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed: ${result.stderr || result.stdout}`
    );
  }
  return {
    stdout: result.stdout,
    stderr: result.stderr
  };
}

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function formatJson(value) {
  const prettier = await import("prettier");
  return prettier.format(JSON.stringify(value), { parser: "json" });
}

async function writeReports(report) {
  await mkdir(path.dirname(reportPath), { recursive: true });
  await mkdir(path.dirname(samplePath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(samplePath, await formatJson(report));
}

async function runCleanInstall(cliPath, tempRoot) {
  const userDataDir = path.join(tempRoot, "user-data");
  const extensionsDir = path.join(tempRoot, "extensions");
  await mkdir(userDataDir, { recursive: true });
  await mkdir(extensionsDir, { recursive: true });

  const baseArgs = [
    "--user-data-dir",
    userDataDir,
    "--extensions-dir",
    extensionsDir
  ];
  runCli(cliPath, [...baseArgs, "--install-extension", vsixPath, "--force"]);
  const listOutput = runCli(cliPath, [...baseArgs, "--list-extensions"]).stdout;
  const installedExtensions = listOutput
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .sort();

  return {
    status: installedExtensions.includes("searchlint.searchlint-vscode")
      ? "pass"
      : "fail",
    isolatedUserDataDir: true,
    isolatedExtensionsDir: true,
    installedExtensions
  };
}

async function runExtensionHostE2e(vscodeExecutablePath, tempRoot) {
  const workspacePath = path.join(tempRoot, "workspace");
  const userDataDir = path.join(tempRoot, "host-user-data");
  const extensionsDir = path.join(tempRoot, "host-extensions");
  await mkdir(workspacePath, { recursive: true });
  await mkdir(userDataDir, { recursive: true });
  await mkdir(extensionsDir, { recursive: true });

  await runTests({
    vscodeExecutablePath,
    extensionDevelopmentPath,
    extensionTestsPath,
    launchArgs: [
      workspacePath,
      "--disable-extensions",
      "--user-data-dir",
      userDataDir,
      "--extensions-dir",
      extensionsDir
    ],
    extensionTestsEnv: {
      SEARCHLINT_VSCODE_E2E: "1"
    }
  });

  return {
    status: "pass",
    isolatedUserDataDir: true,
    isolatedExtensionsDir: true,
    workspaceOpened: true,
    assertions: [
      "searchlint-seo document opened",
      "searchlint-vscode extension activated",
      "searchlint.openOverlay command registered",
      "unconfigured overlay command path executed without throwing"
    ]
  };
}

async function main() {
  run("pnpm", ["vscode:vsix-readiness"], { stdio: "inherit" });

  const artifactExists = await exists(vsixPath);
  const tempRoot = await mkdtemp(path.join(tmpdir(), "slv-"));
  const baseReport = {
    schemaVersion: 1,
    generatedAt: fixedGeneratedAt,
    nodeVersion: process.version,
    artifact: {
      path: path.relative(repoRoot, vsixPath),
      exists: artifactExists
    },
    testHost: {
      provider: "@vscode/test-electron",
      version: "stable",
      source: "downloaded"
    },
    releaseGates: {
      cleanInstallPassed: false,
      extensionHostE2EPassed: false,
      marketplacePublicationPassed: false
    },
    remainingReleaseGates: [
      "Marketplace publisher account setup",
      "VSIX signing",
      "Marketplace publication",
      "extension update acceptance"
    ]
  };

  try {
    if (!artifactExists) {
      const report = {
        ...baseReport,
        status: "blocked_until_vsix_artifact",
        failure:
          "VSIX artifact is missing; run pnpm vscode:vsix-readiness first."
      };
      await writeReports(report);
      console.error(report.failure);
      process.exitCode = 1;
      return;
    }

    const vscodeExecutablePath = await downloadAndUnzipVSCode("stable");
    const cliPath =
      resolveCliPathFromVSCodeExecutablePath(vscodeExecutablePath);
    const cleanInstall = await runCleanInstall(cliPath, tempRoot);
    if (cleanInstall.status !== "pass") {
      const report = {
        ...baseReport,
        status: "clean_install_failed",
        cleanInstall
      };
      await writeReports(report);
      console.error("VS Code clean install failed.");
      process.exitCode = 1;
      return;
    }

    const extensionHostE2E = await runExtensionHostE2e(
      vscodeExecutablePath,
      tempRoot
    );
    const report = {
      ...baseReport,
      status: "passed",
      cleanInstall,
      extensionHostE2E,
      releaseGates: {
        ...baseReport.releaseGates,
        cleanInstallPassed: true,
        extensionHostE2EPassed: true
      }
    };
    await writeReports(report);
    console.log(
      "VS Code clean install and Extension Host E2E PASS: local VSIX installed and activated in isolated VS Code."
    );
    console.log(`Report: ${path.relative(repoRoot, reportPath)}`);
    console.log(`Sample: ${path.relative(repoRoot, samplePath)}`);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
