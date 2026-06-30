#!/usr/bin/env node
import { readdir, readFile, stat, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();
const reportPath = path.join(repoRoot, "reports/static-sast-report.json");
const samplePath = path.join(
  repoRoot,
  "docs/examples/static-sast-report.sample.json"
);

const scanRoots = ["packages", "apps", "services", "infra"];
const sourceExtensions = new Set([
  ".cjs",
  ".cts",
  ".js",
  ".json",
  ".jsx",
  ".mjs",
  ".mts",
  ".ts",
  ".tsx",
  ".yaml",
  ".yml"
]);
const ignoredPathParts = new Set([
  ".git",
  ".next",
  "coverage",
  "dist",
  "node_modules",
  "reports"
]);
const testPathPattern =
  /(?:^|\/)(test|tests|__tests__|fixtures)(?:\/|$)|\.(?:test|spec)\.[cm]?[tj]sx?$/u;

const ruleDefinitions = [
  {
    id: "SAST-EVAL-001",
    title: "Dynamic JavaScript evaluation is forbidden.",
    severity: "critical",
    pattern: /\b(?:eval\s*\(|new\s+Function\s*\()/gu
  },
  {
    id: "SAST-SHELL-001",
    title: "Product source must not execute shell commands.",
    severity: "critical",
    pattern:
      /\b(?:child_process\.(?:exec|execFile|execSync|spawn|spawnSync)\s*\(|from\s+["']node:child_process["']|from\s+["']child_process["']|require\s*\(\s*["'](?:node:)?child_process["']\s*\)|import\s*\(\s*["'](?:node:)?child_process["']\s*\))/gu,
    includeMatch(match) {
      return !match.file.startsWith("scripts/");
    }
  },
  {
    id: "SAST-HTML-SINK-001",
    title: "HTML sinks must be reviewed and allowlisted.",
    severity: "high",
    pattern:
      /\b(?:innerHTML\s*=|dangerouslySetInnerHTML|document\.write\s*\()/gu
  },
  {
    id: "SAST-SECRET-001",
    title: "High-confidence secret literals are forbidden in product source.",
    severity: "critical",
    pattern:
      /\b(?:sk_live_[A-Za-z0-9_]{8,}|whsec_[A-Za-z0-9_]{8,}|ya29\.[A-Za-z0-9._-]{8,}|xox[baprs]-[A-Za-z0-9-]{8,}|postgres:\/\/[A-Za-z0-9._%+-]+:[^@${\s"'`]+@[^\s"'`]+)|-----BEGIN PRIVATE KEY-----/gu,
    includeMatch(match) {
      return !testPathPattern.test(match.file);
    }
  },
  {
    id: "SAST-CRYPTO-001",
    title: "Deprecated crypto primitives are forbidden.",
    severity: "high",
    pattern:
      /\b(?:createCipher\s*\(|createDecipher\s*\(|createHash\s*\(\s*["'](?:md5|sha1)["'])/gu
  }
];

const reviewedAllowlist = [
  {
    ruleId: "SAST-HTML-SINK-001",
    file: "packages/overlay/src/index.ts",
    line: 316,
    reviewedAt: "2026-06-23",
    reviewer: "repo-static-sast-gate",
    rationale:
      "Overlay renders into an isolated Shadow DOM. Diagnostic content is escaped by renderOverlayHtml and covered by overlay acceptance tests.",
    evidence: [
      "packages/overlay/src/index.ts",
      "pnpm overlay:acceptance",
      "pnpm overlay:visual-regression"
    ]
  },
  {
    ruleId: "SAST-HTML-SINK-001",
    file: "apps/dashboard/src/index.ts",
    line: 4184,
    reviewedAt: "2026-06-23",
    reviewer: "repo-static-sast-gate",
    rationale:
      "Dashboard static renderer writes a first-party HTML string generated from escaped helpers in the same module and covered by dashboard hosted/browser verifiers.",
    evidence: [
      "apps/dashboard/src/index.ts",
      "pnpm dashboard:acceptance",
      "pnpm lint"
    ]
  }
];

async function main() {
  const files = await listScanFiles();
  const findings = [];

  for (const file of files) {
    const absolutePath = path.join(repoRoot, file);
    const text = await readFile(absolutePath, "utf8");
    for (const rule of ruleDefinitions) {
      const matches = findRuleMatches(rule, file, text);
      findings.push(...matches);
    }
  }

  const reviewedFindings = [];
  const unreviewedFindings = [];
  for (const finding of findings) {
    const allowlistEntry = reviewedAllowlist.find(
      (entry) =>
        entry.ruleId === finding.ruleId &&
        entry.file === finding.file &&
        entry.line === finding.line
    );
    if (allowlistEntry) {
      reviewedFindings.push({
        ...finding,
        status: "reviewed-allowlisted",
        rationale: allowlistEntry.rationale,
        evidence: allowlistEntry.evidence
      });
    } else {
      unreviewedFindings.push({
        ...finding,
        status: "unreviewed"
      });
    }
  }

  const ruleResults = ruleDefinitions.map((rule) => {
    const ruleFindings = findings.filter(
      (finding) => finding.ruleId === rule.id
    );
    const reviewed = reviewedFindings.filter(
      (finding) => finding.ruleId === rule.id
    );
    const unreviewed = unreviewedFindings.filter(
      (finding) => finding.ruleId === rule.id
    );
    return {
      ruleId: rule.id,
      title: rule.title,
      severity: rule.severity,
      status: unreviewed.length === 0 ? "pass" : "fail",
      matchCount: ruleFindings.length,
      reviewedAllowlistCount: reviewed.length,
      unreviewedCount: unreviewed.length
    };
  });

  const report = {
    generatedBy: "searchlint-static-sast-verifier",
    generatedAt: "2026-06-23T00:00:00.000Z",
    status: unreviewedFindings.length === 0 ? "PASS" : "FAIL",
    scope: {
      proofType: "repository-owned deterministic static SAST",
      scanRoots,
      scannedFileCount: files.length,
      excluded: [
        "node_modules",
        "dist",
        "coverage",
        "reports",
        "docs",
        "scripts"
      ],
      doesNotClaim: [
        "DAST",
        "penetration test",
        "external commercial scanner approval",
        "legal approval",
        "deployed production security review"
      ]
    },
    rules: ruleResults,
    reviewedFindings,
    unreviewedFindings,
    remainingReleaseGates: [
      "Run DAST against a deployed production-equivalent target.",
      "Obtain independent penetration test report and remediation sign-off.",
      "Complete legal/security review for policy documents and repository boundary.",
      "Complete deployed production security review across AWS, dashboard, API, workers, OAuth, billing, tenant isolation, logs, and telemetry."
    ]
  };

  assertNoSensitiveValues(JSON.stringify(report));
  await mkdir(path.dirname(reportPath), { recursive: true });
  await mkdir(path.dirname(samplePath), { recursive: true });
  await writeJson(reportPath, report);
  await writeJson(samplePath, report);

  if (unreviewedFindings.length > 0) {
    for (const finding of unreviewedFindings) {
      console.error(
        `${finding.ruleId} ${finding.file}:${finding.line}:${finding.column} ${finding.snippet}`
      );
    }
    throw new Error(
      `Static SAST failed with ${unreviewedFindings.length} unreviewed finding(s).`
    );
  }

  console.log(
    `Static SAST PASS: ${files.length} files scanned, ${reviewedFindings.length} reviewed finding(s), 0 unreviewed finding(s)`
  );
  console.log(`Report: ${path.relative(repoRoot, reportPath)}`);
  console.log(`Sample: ${path.relative(repoRoot, samplePath)}`);
}

async function listScanFiles() {
  const files = [];
  for (const root of scanRoots) {
    await walk(root, files);
  }
  return files.sort();
}

async function walk(relativePath, files) {
  const absolutePath = path.join(repoRoot, relativePath);
  const info = await stat(absolutePath);
  if (info.isDirectory()) {
    if (
      relativePath.split(path.sep).some((part) => ignoredPathParts.has(part))
    ) {
      return;
    }
    const entries = await readdir(absolutePath);
    for (const entry of entries) {
      await walk(path.join(relativePath, entry), files);
    }
    return;
  }

  if (!info.isFile()) {
    return;
  }

  if (!sourceExtensions.has(path.extname(relativePath))) {
    return;
  }

  files.push(toPosix(relativePath));
}

function findRuleMatches(rule, file, text) {
  const matches = [];
  for (const match of text.matchAll(rule.pattern)) {
    const location = offsetToLocation(text, match.index ?? 0);
    const finding = {
      ruleId: rule.id,
      severity: rule.severity,
      file,
      line: location.line,
      column: location.column,
      snippet: sanitizeSnippet(match[0])
    };
    if (!rule.includeMatch || rule.includeMatch(finding)) {
      matches.push(finding);
    }
  }
  return matches;
}

function offsetToLocation(text, offset) {
  const prefix = text.slice(0, offset);
  const lines = prefix.split("\n");
  return {
    line: lines.length,
    column: lines.at(-1).length + 1
  };
}

function sanitizeSnippet(value) {
  return value
    .replace(/sk_live_[A-Za-z0-9_]+/gu, "sk_live_[REDACTED]")
    .replace(/whsec_[A-Za-z0-9_]+/gu, "whsec_[REDACTED]")
    .replace(/ya29\.[A-Za-z0-9._-]+/gu, "ya29.[REDACTED]")
    .replace(/xox[baprs]-[A-Za-z0-9-]+/gu, "xox[REDACTED]")
    .replace(/postgres:\/\/[^\s"'`]+/gu, "postgres://[REDACTED]");
}

function assertNoSensitiveValues(text) {
  const forbidden = [
    /private_key/i,
    /client-secret/i,
    /authorization:/i,
    /bearer\s+/i,
    /sk_live_[A-Za-z0-9_]{8,}/i,
    /whsec_[A-Za-z0-9_]{8,}/i,
    /postgres:\/\/(?!\[REDACTED\])[A-Za-z0-9._%+-]+:[^@${\s"'`]+@/i,
    /-----BEGIN PRIVATE KEY-----/i,
    /ya29\.[A-Za-z0-9._-]{8,}/i,
    /xox[baprs]-[A-Za-z0-9-]{8,}/i
  ];
  const match = forbidden.find((pattern) => pattern.test(text));
  if (match) {
    throw new Error(`Sensitive value leaked into static SAST report: ${match}`);
  }
}

async function writeJson(filePath, data) {
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function toPosix(value) {
  return value.split(path.sep).join("/");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
