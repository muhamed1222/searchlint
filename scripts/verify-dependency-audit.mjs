#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const reportPath = path.join(repoRoot, "reports/dependency-audit-report.json");
const samplePath = path.join(
  repoRoot,
  "docs/examples/dependency-audit-report.sample.json"
);
const fixedGeneratedAt = "2026-06-23T00:00:00.000Z";
const severityKeys = ["info", "low", "moderate", "high", "critical"];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function runAudit() {
  try {
    return execFileSync("pnpm", ["audit", "--json"], {
      cwd: repoRoot,
      env: process.env,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 1024 * 1024 * 20
    });
  } catch (error) {
    const stdout = error?.stdout?.toString?.() ?? "";
    if (stdout.trim().startsWith("{")) {
      return stdout;
    }
    throw error;
  }
}

async function main() {
  if (!process.version.startsWith("v24.")) {
    throw new Error(
      `dependency audit must run under Node.js 24, got ${process.version}`
    );
  }

  const audit = JSON.parse(runAudit());
  const vulnerabilities = audit.metadata?.vulnerabilities ?? {};
  const dependencyCounts = {
    dependencies: audit.metadata?.dependencies ?? 0,
    devDependencies: audit.metadata?.devDependencies ?? 0,
    optionalDependencies: audit.metadata?.optionalDependencies ?? 0,
    totalDependencies: audit.metadata?.totalDependencies ?? 0
  };
  const severityCounts = Object.fromEntries(
    severityKeys.map((severity) => [severity, vulnerabilities[severity] ?? 0])
  );
  const nonZeroSeverities = Object.entries(severityCounts).filter(
    ([, count]) => count !== 0
  );

  assert(
    nonZeroSeverities.length === 0,
    `dependency audit found vulnerabilities: ${nonZeroSeverities
      .map(([severity, count]) => `${severity}=${count}`)
      .join(", ")}`
  );

  const report = {
    schemaVersion: 1,
    generatedBy: "searchlint-dependency-audit",
    generatedAt: fixedGeneratedAt,
    status: "PASS",
    command: "pnpm audit --json",
    nodeVersion: process.version,
    packageManager: "pnpm",
    severityCounts,
    dependencyCounts,
    advisoryCount: Object.keys(audit.advisories ?? {}).length,
    releaseGateClosed: "dependency-audit",
    notClaimed: [
      "SAST",
      "DAST",
      "penetration test",
      "legal/security approval",
      "deployed production security review"
    ]
  };

  await mkdir(path.dirname(reportPath), { recursive: true });
  await mkdir(path.dirname(samplePath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(samplePath, `${JSON.stringify(report, null, 2)}\n`);
  execFileSync(
    "pnpm",
    [
      "exec",
      "prettier",
      "--write",
      path.relative(repoRoot, reportPath),
      path.relative(repoRoot, samplePath)
    ],
    { cwd: repoRoot, env: process.env, stdio: "inherit" }
  );

  console.log(
    `dependency audit PASS: ${report.advisoryCount} advisories, ${dependencyCounts.totalDependencies} dependencies`
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
