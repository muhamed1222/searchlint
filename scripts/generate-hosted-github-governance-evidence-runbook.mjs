#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const markdownPath = "docs/GITHUB_GOVERNANCE_EVIDENCE_COLLECTION_RUNBOOK.md";
const reportPath =
  "reports/hosted-github-governance-evidence-runbook-report.json";
const samplePath =
  "docs/examples/hosted-github-governance-evidence-runbook-report.sample.json";
const evidencePath = "docs/github/hosted-governance-evidence.json";
const templatePath = "docs/github/hosted-governance-evidence.example.json";
const generatedAt = "2026-06-23T00:00:00.000Z";

const requiredChecks = [
  "foundation",
  "docker-image-build",
  "next-fixtures-zero-impact (next15-app)",
  "next-fixtures-zero-impact (next15-pages)",
  "next-fixtures-zero-impact (next16-app)",
  "next-fixtures-zero-impact (next16-pages)",
  "postgres-migration-proof"
];

async function main() {
  const origin = readOrigin();
  const parsedOrigin = origin ? parseGithubRemote(origin) : null;
  const report = {
    schemaVersion: 1,
    generatedBy: "searchlint-hosted-github-governance-evidence-runbook",
    generatedAt,
    status: parsedOrigin
      ? "ready_for_owner_collection"
      : "blocked_until_github_origin",
    repository: parsedOrigin
      ? {
          origin,
          slug: parsedOrigin.slug,
          branch: "main"
        }
      : {
          originConfigured: Boolean(origin),
          githubOrigin: false
        },
    evidencePath,
    templatePath,
    requiredChecks,
    commands: commandsFor(parsedOrigin?.slug ?? "OWNER/REPO"),
    validationCommands: [
      "pnpm governance:hosted-github-evidence:self-test",
      "pnpm governance:hosted-github-evidence",
      "pnpm governance:branch-protection",
      "pnpm governance:required-ci-checks"
    ],
    nonClaims: [
      "This runbook does not create real hosted GitHub evidence.",
      "This runbook does not mutate GitHub settings.",
      "This runbook does not close protected branch or required-CI release gates.",
      "Screenshots are not sufficient release evidence for these gates."
    ]
  };

  assertNoSensitiveValues(JSON.stringify(report));
  await writeMarkdown(markdownPath, renderMarkdown(report));
  await writeJson(reportPath, report);
  await writeJson(samplePath, report);

  console.log(`Hosted GitHub governance evidence runbook: ${report.status}`);
  console.log(`Document: ${markdownPath}`);
  console.log(`Report: ${reportPath}`);
  console.log(`Sample: ${samplePath}`);
}

function readOrigin() {
  const result = spawnSync("git", ["remote", "get-url", "origin"], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  if (result.status !== 0) return null;
  return result.stdout.trim() || null;
}

function parseGithubRemote(remoteUrl) {
  const httpsMatch =
    /^https:\/\/github\.com\/([^/]+)\/([^/.]+)(?:\.git)?$/u.exec(remoteUrl);
  if (httpsMatch) {
    return {
      owner: httpsMatch[1],
      repo: httpsMatch[2],
      slug: `${httpsMatch[1]}/${httpsMatch[2]}`
    };
  }
  const sshMatch = /^git@github\.com:([^/]+)\/([^/.]+)(?:\.git)?$/u.exec(
    remoteUrl
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

function commandsFor(slug) {
  return {
    inspectOrigin: "git remote get-url origin",
    inspectProtection: `gh api repos/${slug}/branches/main/protection > /tmp/searchlint-main-protection.json`,
    inspectLatestCiRun: `gh run list --repo ${slug} --workflow ci.yml --branch main --status success --limit 1 --json databaseId,headSha,url,conclusion,updatedAt > /tmp/searchlint-latest-ci-run.json`,
    validateEvidence: "pnpm governance:hosted-github-evidence",
    validateLiveSettings:
      "pnpm governance:branch-protection && pnpm governance:required-ci-checks"
  };
}

function renderMarkdown(report) {
  const slug = report.repository.slug ?? "OWNER/REPO";
  const lines = [
    "# GitHub Governance Evidence Collection Runbook",
    "",
    `Generated at: ${report.generatedAt}`,
    "",
    `Status: \`${report.status}\``,
    "",
    "This runbook tells the project owner how to collect real hosted GitHub governance evidence for protected branches and required CI checks. It is not release approval.",
    "",
    "## Current Repository Detection",
    "",
    `- GitHub repository: \`${slug}\``,
    `- Evidence file to create: \`${report.evidencePath}\``,
    `- Template: \`${report.templatePath}\``,
    "",
    "If the repository is shown as `OWNER/REPO`, configure a real GitHub `origin` first. Do not fabricate the evidence file.",
    "",
    "## Required Status Checks",
    ""
  ];

  for (const check of report.requiredChecks) {
    lines.push(`- \`${check}\``);
  }

  lines.push(
    "",
    "## Collection Commands",
    "",
    "Run these commands from the repository root after `origin` points to the real GitHub repository:",
    "",
    "```bash",
    report.commands.inspectOrigin,
    report.commands.inspectProtection,
    report.commands.inspectLatestCiRun,
    "```",
    "",
    "Use those sanitized outputs to fill `docs/github/hosted-governance-evidence.json` from the `.example.json` template. Do not paste GitHub tokens, authorization headers, private keys, database URLs, or any other secret into the evidence file.",
    "",
    "The evidence must record only the repository slug/URL, branch protection settings, required status check contexts, latest successful CI run metadata, collection timestamps, and a signed owner statement.",
    "",
    "## Validation Commands",
    "",
    "```bash"
  );

  for (const command of report.validationCommands) {
    lines.push(command);
  }

  lines.push(
    "```",
    "",
    "The checklist items remain open until the real evidence file exists and the dedicated verifiers pass.",
    "",
    "## Non-Claims",
    ""
  );

  for (const nonClaim of report.nonClaims) {
    lines.push(`- ${nonClaim}`);
  }

  lines.push("");
  return `${lines.join("\n")}\n`;
}

async function writeMarkdown(filePath, markdown) {
  const prettier = await import("prettier");
  await mkdir(path.join(repoRoot, path.dirname(filePath)), {
    recursive: true
  });
  await writeFile(
    path.join(repoRoot, filePath),
    await prettier.format(markdown, { parser: "markdown" })
  );
}

async function writeJson(filePath, value) {
  const prettier = await import("prettier");
  await mkdir(path.join(repoRoot, path.dirname(filePath)), {
    recursive: true
  });
  await writeFile(
    path.join(repoRoot, filePath),
    await prettier.format(JSON.stringify(value), { parser: "json" })
  );
}

function sensitivePatternMatch(serialized) {
  const patterns = [
    /ghp_[A-Za-z0-9_]{20,}/u,
    /github_pat_[A-Za-z0-9_]{20,}/u,
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/u,
    /AKIA[0-9A-Z]{16}/u,
    /xox[baprs]-[A-Za-z0-9-]{10,}/u,
    /postgres(?:ql)?:\/\/[^"'\s]+:[^"'\s]+@/iu,
    /mongodb(?:\+srv)?:\/\/[^"'\s]+:[^"'\s]+@/iu
  ];
  return patterns.find((pattern) => pattern.test(serialized))?.source ?? null;
}

function assertNoSensitiveValues(serialized) {
  const sensitive = sensitivePatternMatch(serialized);
  if (sensitive) {
    throw new Error(
      `Generated runbook contains sensitive material: ${sensitive}`
    );
  }
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
