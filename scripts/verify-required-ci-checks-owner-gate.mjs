#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const workflowPath = ".github/workflows/ci.yml";
const payloadPath = "docs/github/branch-protection-main.json";
const reportPath = "reports/required-ci-checks-owner-gate-report.json";
const samplePath =
  "docs/examples/required-ci-checks-owner-gate-report.sample.json";
const generatedAt = "2026-06-23T00:00:00.000Z";

const expectedChecks = [
  "foundation",
  "docker-image-build",
  "next-fixtures-zero-impact (next15-app)",
  "next-fixtures-zero-impact (next15-pages)",
  "next-fixtures-zero-impact (next16-app)",
  "next-fixtures-zero-impact (next16-pages)",
  "postgres-migration-proof"
];

async function main() {
  const workflow = await readFile(path.join(repoRoot, workflowPath), "utf8");
  const payload = JSON.parse(
    await readFile(path.join(repoRoot, payloadPath), "utf8")
  );
  const workflowChecks = checksFromWorkflow(workflow);
  const payloadChecks = payload.required_status_checks?.contexts ?? [];
  const localContract = {
    workflowPath,
    payloadPath,
    expectedChecks,
    workflowChecks,
    payloadChecks,
    workflowMissingChecks: missingValues(expectedChecks, workflowChecks),
    payloadMissingChecks: missingValues(expectedChecks, payloadChecks),
    payloadUnexpectedChecks: payloadChecks.filter(
      (check) => !expectedChecks.includes(check)
    ),
    strictStatusChecksInPayload: payload.required_status_checks?.strict === true
  };

  const baseReport = {
    schemaVersion: 1,
    generatedBy: "searchlint-required-ci-checks-owner-gate",
    generatedAt,
    branch: "main",
    localContract,
    releaseGates: {
      requiredCiChecksConfigured: false
    }
  };

  const localFailures = localContractFailures(localContract);
  if (localFailures.length > 0) {
    await writeReports({
      ...baseReport,
      status: "local_contract_invalid",
      failures: localFailures
    });
    console.error("Required CI checks local contract is invalid.");
    process.exitCode = 1;
    return;
  }

  const remoteResult = tryRun("git", ["remote", "get-url", "origin"]);
  if (remoteResult.status !== 0 || remoteResult.stdout.length === 0) {
    await writeReports({
      ...baseReport,
      status: "blocked_until_remote",
      remote: {
        configured: false
      },
      failure:
        "No GitHub origin remote is configured; required CI checks cannot be verified against hosted branch protection.",
      nextOwnerAction:
        "Create/configure the GitHub repository remote, enable required status checks for main, then rerun pnpm governance:required-ci-checks."
    });
    console.error(
      "No GitHub origin remote is configured; required CI checks cannot be verified."
    );
    process.exitCode = 1;
    return;
  }

  const remote = parseGithubRemote(remoteResult.stdout);
  if (!remote) {
    await writeReports({
      ...baseReport,
      status: "blocked_until_github_remote",
      remote: {
        configured: true,
        url: remoteResult.stdout,
        github: false
      },
      failure: "origin remote is not a supported GitHub remote URL."
    });
    console.error("origin remote is not a supported GitHub remote URL.");
    process.exitCode = 1;
    return;
  }

  const protectionResult = tryRun("gh", [
    "api",
    `repos/${remote.slug}/branches/main/protection`
  ]);
  if (protectionResult.status !== 0) {
    await writeReports({
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
    });
    console.error(
      "GitHub branch protection is not readable or not configured for main."
    );
    process.exitCode = 1;
    return;
  }

  const protection = JSON.parse(protectionResult.stdout);
  const statusChecks = protection.required_status_checks?.contexts ?? [];
  const hostedCheck = {
    strictStatusChecks: protection.required_status_checks?.strict === true,
    hostedRequiredChecks: statusChecks,
    missingHostedChecks: missingValues(expectedChecks, statusChecks),
    unexpectedHostedChecks: statusChecks.filter(
      (check) => !expectedChecks.includes(check)
    )
  };
  const pass =
    hostedCheck.strictStatusChecks &&
    hostedCheck.missingHostedChecks.length === 0;

  await writeReports({
    ...baseReport,
    status: pass ? "passed" : "blocked_until_required_ci_checks",
    remote: {
      configured: true,
      github: true,
      slug: remote.slug
    },
    hostedCheck,
    releaseGates: {
      requiredCiChecksConfigured: pass
    }
  });

  if (!pass) {
    console.error("Required CI checks are not fully enforced for main.");
    process.exitCode = 1;
    return;
  }

  console.log(
    `Required CI checks owner gate PASS: ${remote.slug} main enforces ${expectedChecks.length} required checks.`
  );
  console.log(`Report: ${reportPath}`);
  console.log(`Sample: ${samplePath}`);
}

function checksFromWorkflow(workflow) {
  const checks = [
    requireJob(workflow, "foundation"),
    requireJob(workflow, "docker-image-build"),
    ...requireMatrixChecks(workflow, "next-fixtures-zero-impact", [
      "next15-app",
      "next15-pages",
      "next16-app",
      "next16-pages"
    ]),
    requireJob(workflow, "postgres-migration-proof")
  ];
  return checks;
}

function requireJob(workflow, jobName) {
  if (!new RegExp(`^  ${escapeRegExp(jobName)}:`, "mu").test(workflow)) {
    throw new Error(`${workflowPath} is missing job ${jobName}.`);
  }
  return jobName;
}

function requireMatrixChecks(workflow, jobName, matrixValues) {
  requireJob(workflow, jobName);
  for (const value of matrixValues) {
    if (!workflow.includes(`- ${value}`)) {
      throw new Error(`${workflowPath} is missing ${jobName} matrix ${value}.`);
    }
  }
  return matrixValues.map((value) => `${jobName} (${value})`);
}

function localContractFailures(localContract) {
  const failures = [];
  if (localContract.workflowMissingChecks.length > 0) {
    failures.push({
      code: "workflow_missing_required_checks",
      checks: localContract.workflowMissingChecks
    });
  }
  if (localContract.payloadMissingChecks.length > 0) {
    failures.push({
      code: "payload_missing_required_checks",
      checks: localContract.payloadMissingChecks
    });
  }
  if (localContract.payloadUnexpectedChecks.length > 0) {
    failures.push({
      code: "payload_has_unexpected_checks",
      checks: localContract.payloadUnexpectedChecks
    });
  }
  if (!localContract.strictStatusChecksInPayload) {
    failures.push({
      code: "payload_not_strict",
      message: "required_status_checks.strict must be true."
    });
  }
  return failures;
}

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

function missingValues(expected, actual) {
  const actualSet = new Set(actual);
  return expected.filter((value) => !actualSet.has(value));
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

async function writeReports(report) {
  const prettier = await import("prettier");
  const formatted = await prettier.format(JSON.stringify(report), {
    parser: "json"
  });
  await mkdir(path.join(repoRoot, path.dirname(reportPath)), {
    recursive: true
  });
  await mkdir(path.join(repoRoot, path.dirname(samplePath)), {
    recursive: true
  });
  await writeFile(path.join(repoRoot, reportPath), formatted);
  await writeFile(path.join(repoRoot, samplePath), formatted);
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
