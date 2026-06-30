#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const reportPath = path.join(
  repoRoot,
  "reports/branch-protection-owner-gate-report.json"
);
const samplePath = path.join(
  repoRoot,
  "docs/examples/branch-protection-owner-gate-report.sample.json"
);
const payloadPath = path.join(
  repoRoot,
  "docs/github/branch-protection-main.json"
);

const requiredChecks = [
  "foundation",
  "docker-image-build",
  "next-fixtures-zero-impact (next15-app)",
  "next-fixtures-zero-impact (next15-pages)",
  "next-fixtures-zero-impact (next16-app)",
  "next-fixtures-zero-impact (next16-pages)",
  "postgres-migration-proof"
];

function tryRun(command, args) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8"
  });
  return {
    status: result.status,
    stdout: result.stdout.trim(),
    stderr: result.stderr.trim()
  };
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

function parseGithubRemote(remoteUrl) {
  const trimmed = remoteUrl.trim();
  const httpsMatch =
    /^https:\/\/github\.com\/([^/]+)\/([^/.]+)(?:\.git)?$/u.exec(trimmed);
  if (httpsMatch) {
    return {
      owner: httpsMatch[1],
      repo: httpsMatch[2],
      slug: `${httpsMatch[1]}/${httpsMatch[2]}`
    };
  }
  const sshMatch = /^git@github\.com:([^/]+)\/([^/.]+)(?:\.git)?$/u.exec(
    trimmed
  );
  if (sshMatch) {
    return {
      owner: sshMatch[1],
      repo: sshMatch[2],
      slug: `${sshMatch[1]}/${sshMatch[2]}`
    };
  }
  return null;
}

function requiredChecksFromPayload(payload) {
  return payload.required_status_checks?.contexts ?? [];
}

function missingValues(expected, actual) {
  const actualSet = new Set(actual);
  return expected.filter((value) => !actualSet.has(value));
}

function protectionCheck(payload, protection) {
  const statusChecks = protection.required_status_checks?.contexts ?? [];
  const checks = {
    strictStatusChecks:
      protection.required_status_checks?.strict === true &&
      missingValues(requiredChecks, statusChecks).length === 0,
    pullRequestReview:
      protection.required_pull_request_reviews
        ?.required_approving_review_count >= 1,
    staleReviewDismissal:
      protection.required_pull_request_reviews?.dismiss_stale_reviews === true,
    conversationResolution:
      protection.required_conversation_resolution?.enabled === true,
    linearHistory: protection.required_linear_history?.enabled === true,
    forcePushesBlocked: protection.allow_force_pushes?.enabled === false,
    deletionsBlocked: protection.allow_deletions?.enabled === false,
    payloadMatchesRequiredChecks:
      missingValues(requiredChecks, requiredChecksFromPayload(payload))
        .length === 0
  };
  return {
    checks,
    pass: Object.values(checks).every(Boolean),
    missingRequiredChecks: missingValues(requiredChecks, statusChecks)
  };
}

async function main() {
  const payload = JSON.parse(await readFile(payloadPath, "utf8"));
  const payloadMissingChecks = missingValues(
    requiredChecks,
    requiredChecksFromPayload(payload)
  );
  const remoteResult = tryRun("git", ["remote", "get-url", "origin"]);
  const baseReport = {
    schemaVersion: 1,
    generatedAt: "2026-06-23T00:00:00.000Z",
    branch: "main",
    requiredChecks,
    payload: {
      path: path.relative(repoRoot, payloadPath),
      requiredChecks: requiredChecksFromPayload(payload),
      missingRequiredChecks: payloadMissingChecks
    },
    releaseGates: {
      protectedBranchConfigured: false,
      requiredChecksConfigured: false
    }
  };

  if (payloadMissingChecks.length > 0) {
    const report = {
      ...baseReport,
      status: "payload_invalid",
      failure: "Branch-protection payload is missing required checks."
    };
    await writeReports(report);
    console.error(report.failure);
    process.exitCode = 1;
    return;
  }

  if (remoteResult.status !== 0 || remoteResult.stdout.length === 0) {
    const report = {
      ...baseReport,
      status: "blocked_until_remote",
      remote: {
        configured: false
      },
      failure:
        "No GitHub origin remote is configured; branch protection cannot be verified."
    };
    await writeReports(report);
    console.error(report.failure);
    console.error(`Sample: ${path.relative(repoRoot, samplePath)}`);
    process.exitCode = 1;
    return;
  }

  const remote = parseGithubRemote(remoteResult.stdout);
  if (!remote) {
    const report = {
      ...baseReport,
      status: "blocked_until_github_remote",
      remote: {
        configured: true,
        url: remoteResult.stdout,
        github: false
      },
      failure: "origin remote is not a supported GitHub remote URL."
    };
    await writeReports(report);
    console.error(report.failure);
    process.exitCode = 1;
    return;
  }

  const protectionResult = tryRun("gh", [
    "api",
    `repos/${remote.slug}/branches/main/protection`
  ]);
  if (protectionResult.status !== 0) {
    const report = {
      ...baseReport,
      status: "blocked_until_branch_protection",
      remote: {
        configured: true,
        github: true,
        slug: remote.slug
      },
      failure:
        "GitHub branch protection is not readable or not configured for main.",
      ghError: protectionResult.stderr || protectionResult.stdout
    };
    await writeReports(report);
    console.error(report.failure);
    process.exitCode = 1;
    return;
  }

  const protection = JSON.parse(protectionResult.stdout);
  const check = protectionCheck(payload, protection);
  const report = {
    ...baseReport,
    status: check.pass ? "passed" : "blocked_until_required_settings",
    remote: {
      configured: true,
      github: true,
      slug: remote.slug
    },
    protection: check,
    releaseGates: {
      protectedBranchConfigured: check.pass,
      requiredChecksConfigured: check.checks.strictStatusChecks
    }
  };
  await writeReports(report);

  if (!check.pass) {
    console.error(
      "Branch protection exists but required settings are missing."
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    `Branch protection owner gate PASS: ${remote.slug} main has required protections.`
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
