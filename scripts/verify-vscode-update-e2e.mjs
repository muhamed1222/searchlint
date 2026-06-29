#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  downloadAndUnzipVSCode,
  resolveCliPathFromVSCodeExecutablePath
} from "@vscode/test-electron";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const fixedGeneratedAt = "2026-06-23T00:00:00.000Z";
const previousVersion = "1.0.0-alpha.0";
const currentVersion = "1.0.0-beta.0";
const extensionId = "searchlint.searchlint-vscode";
const currentVsixPath = path.join(
  repoRoot,
  "reports/searchlint-vscode-1.0.0-beta.0.vsix"
);
const reportPath = path.join(repoRoot, "reports/vscode-update-e2e-report.json");
const samplePath = path.join(
  repoRoot,
  "docs/examples/vscode-update-e2e-report.sample.json"
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

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
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

async function buildPreviousVersionVsix(tempRoot) {
  const stagingRoot = path.join(tempRoot, "previous-vsix");
  const artifactPath = path.join(
    tempRoot,
    `searchlint-vscode-${previousVersion}.vsix`
  );

  await mkdir(stagingRoot, { recursive: true });
  run("unzip", ["-q", currentVsixPath, "-d", stagingRoot]);

  const packageJsonPath = path.join(stagingRoot, "extension/package.json");
  const previousManifest = await readJson(packageJsonPath);
  previousManifest.version = previousVersion;
  await writeFile(
    packageJsonPath,
    `${JSON.stringify(previousManifest, null, 2)}\n`
  );

  const vsixManifestPath = path.join(stagingRoot, "extension.vsixmanifest");
  const vsixManifest = await readFile(vsixManifestPath, "utf8");
  await writeFile(
    vsixManifestPath,
    vsixManifest.replace(
      /(<Identity\b[^>]*\bVersion=")[^"]+(")/u,
      `$1${previousVersion}$2`
    )
  );

  run("zip", ["-X", "-qr", artifactPath, "."], { cwd: stagingRoot });
  return artifactPath;
}

function listInstalledExtensions(cliPath, userDataDir, extensionsDir) {
  const output = runCli(cliPath, [
    "--user-data-dir",
    userDataDir,
    "--extensions-dir",
    extensionsDir,
    "--list-extensions",
    "--show-versions"
  ]).stdout;
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .sort();
}

async function main() {
  run("pnpm", ["vscode:vsix-readiness"], { stdio: "inherit" });
  await stat(currentVsixPath);

  const tempRoot = await mkdtemp(path.join(tmpdir(), "slv-update-"));
  const userDataDir = path.join(tempRoot, "user-data");
  const extensionsDir = path.join(tempRoot, "extensions");
  await mkdir(userDataDir, { recursive: true });
  await mkdir(extensionsDir, { recursive: true });

  try {
    const previousVsixPath = await buildPreviousVersionVsix(tempRoot);
    const vscodeExecutablePath = await downloadAndUnzipVSCode("stable");
    const cliPath =
      resolveCliPathFromVSCodeExecutablePath(vscodeExecutablePath);
    const baseArgs = [
      "--user-data-dir",
      userDataDir,
      "--extensions-dir",
      extensionsDir
    ];

    runCli(cliPath, [
      ...baseArgs,
      "--install-extension",
      previousVsixPath,
      "--force"
    ]);
    const afterPreviousInstall = listInstalledExtensions(
      cliPath,
      userDataDir,
      extensionsDir
    );
    const previousEntry = `${extensionId}@${previousVersion}`;
    if (!afterPreviousInstall.includes(previousEntry)) {
      throw new Error(
        `Previous VSIX install did not produce ${previousEntry}.`
      );
    }

    runCli(cliPath, [
      ...baseArgs,
      "--install-extension",
      currentVsixPath,
      "--force"
    ]);
    const afterCurrentInstall = listInstalledExtensions(
      cliPath,
      userDataDir,
      extensionsDir
    );
    const currentEntry = `${extensionId}@${currentVersion}`;
    if (!afterCurrentInstall.includes(currentEntry)) {
      throw new Error(`Current VSIX install did not produce ${currentEntry}.`);
    }
    if (afterCurrentInstall.includes(previousEntry)) {
      throw new Error("Previous VSIX version remained installed after update.");
    }

    const previousStat = await stat(previousVsixPath);
    const currentStat = await stat(currentVsixPath);
    const report = {
      schemaVersion: 1,
      generatedAt: fixedGeneratedAt,
      status: "passed",
      nodeVersion: process.version,
      testHost: {
        provider: "@vscode/test-electron",
        version: "stable",
        source: "downloaded"
      },
      artifacts: {
        previous: {
          version: previousVersion,
          generatedInTempDirectory: true,
          sizeBytes: previousStat.size
        },
        current: {
          path: path.relative(repoRoot, currentVsixPath),
          version: currentVersion,
          sizeBytes: currentStat.size
        }
      },
      updateFlow: {
        isolatedUserDataDir: true,
        isolatedExtensionsDir: true,
        extensionId,
        installedBeforeUpdate: afterPreviousInstall,
        installedAfterUpdate: afterCurrentInstall,
        previousVersionInstalled: true,
        currentVersionInstalled: true,
        previousVersionRemoved: true
      },
      releaseGates: {
        localVsixUpdatePassed: true,
        marketplacePublisherSetupPassed: false,
        vsixSigningPassed: false,
        marketplacePublicationPassed: false,
        marketplaceAutoUpdatePassed: false
      },
      remainingReleaseGates: [
        "Marketplace publisher account setup",
        "VSIX signing",
        "Marketplace publication",
        "Marketplace auto-update after publication"
      ]
    };

    await writeReports(report);
    console.log(
      `VS Code local VSIX update PASS: ${previousEntry} -> ${currentEntry}.`
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
