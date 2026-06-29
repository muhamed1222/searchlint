#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const dslSamplePath = path.join(
  repoRoot,
  "docs/examples/dsl-config-compatibility-report.sample.json"
);
const reportPath = path.join(
  repoRoot,
  "reports/windows-paths-acceptance-packet-report.json"
);
const samplePath = path.join(
  repoRoot,
  "docs/examples/windows-paths-acceptance-packet-report.sample.json"
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
  run("pnpm", ["dsl:acceptance"]);

  const dslSample = JSON.parse(await readFile(dslSamplePath, "utf8"));
  const windowsCase = dslSample.cases?.find(
    (item) => item.id === "windows-style-project-paths-preserved"
  );
  const limitations = dslSample.limitations ?? [];
  const nonNativeLimitation =
    "Windows path coverage is resolver-level string preservation on this non-Windows host.";

  assert(
    dslSample.summary?.status === "PASS",
    "DSL/config compatibility sample must be PASS"
  );
  assert(
    windowsCase?.status === "PASS",
    "Windows-style project path case must pass"
  );
  assert(
    Array.isArray(windowsCase.evidence?.loadedPaths),
    "Windows-style project path case must include loadedPaths evidence"
  );
  assert(
    windowsCase.evidence.loadedPaths.includes("C:\\repo\\searchlint.seo") &&
      windowsCase.evidence.loadedPaths.includes("C:\\repo\\policies.seo"),
    "Windows-style loadedPaths must preserve Windows path strings"
  );
  assert(
    limitations.includes(nonNativeLimitation),
    "DSL compatibility sample must state native Windows coverage is not claimed"
  );

  const report = {
    schemaVersion: 1,
    generatedBy: "searchlint-windows-paths-acceptance-packet",
    generatedAt: fixedGeneratedAt,
    hostPlatform: process.platform,
    summary: {
      status: "PASS",
      packetStatus: "READY_FOR_OWNER_WINDOWS_RUNNER",
      nativeWindowsReleaseGate: "BLOCKED_NATIVE_WINDOWS_RUNNER_REQUIRED"
    },
    verifiedEvidence: {
      prerequisiteCommand: "pnpm dsl:acceptance",
      prerequisiteSample:
        "docs/examples/dsl-config-compatibility-report.sample.json",
      caseId: windowsCase.id,
      loadedPaths: windowsCase.evidence.loadedPaths,
      limitation: nonNativeLimitation
    },
    requiredOwnerEvidence: [
      {
        id: "native-windows-runner",
        description:
          "Run the Windows path acceptance command on a clean Windows runner with Node.js 24 and pnpm 11.",
        command: "pnpm dsl:windows-paths",
        requiredPlatform: "win32"
      },
      {
        id: "windows-filesystem-migration",
        description:
          "Run searchlint migrate-config against a real Windows filesystem path and preserve backup/atomic-write behavior.",
        command:
          "searchlint migrate-config --from 1 --to 1 --write C:\\repo\\searchlint.seo",
        requiredPlatform: "win32"
      },
      {
        id: "windows-import-resolution",
        description:
          "Compile a searchlint.seo file importing another .seo file through native Windows path semantics.",
        command: "pnpm dsl:acceptance",
        requiredPlatform: "win32"
      }
    ],
    releaseNotes: [
      "This packet proves current Windows-style resolver string preservation.",
      "This packet does not prove native Windows filesystem behavior on this host.",
      "The broader CLI Windows release item remains open until Windows CLI acceptance runs."
    ]
  };

  await mkdir(path.dirname(reportPath), { recursive: true });
  await mkdir(path.dirname(samplePath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(samplePath, `${JSON.stringify(report, null, 2)}\n`);

  console.log("Windows paths acceptance packet PASS");
  console.log(`Report: ${path.relative(repoRoot, reportPath)}`);
  console.log(`Sample: ${path.relative(repoRoot, samplePath)}`);
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
