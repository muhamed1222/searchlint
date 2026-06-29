#!/usr/bin/env node
import { readFile, stat, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { format } from "prettier";

const reportPath = "reports/searchlint-1-0-rc-matrix-report.json";
const samplePath = "docs/examples/searchlint-1-0-rc-matrix-report.sample.json";

const gates = [
  gate(
    "project-governance",
    "evidence-present",
    ["docs/PROJECT_PROGRESS.md", "docs/SEARCHLINT_1_0_MASTER_CHECKLIST.md"],
    [
      "baseline commit, branch protection, and required GitHub checks still need live configuration evidence"
    ]
  ),
  gate(
    "rule-qa",
    "evidence-present",
    ["docs/examples/rule-qa-summary.sample.json", "docs/RULE_QA.md"],
    []
  ),
  gate(
    "blocker-precision-review",
    "blocked",
    ["docs/reviews/blocker-benchmark/README.md"],
    ["two real independent reviewer JSON files are missing"]
  ),
  gate(
    "core-local-product",
    "evidence-present",
    [
      "docs/examples/cli-acceptance-report.sample.json",
      "docs/examples/crawler-acceptance-report.sample.json"
    ],
    []
  ),
  gate(
    "dsl-config",
    "evidence-present",
    ["docs/DSL_CONFIG_COMPATIBILITY.md", "docs/DSL_MIGRATION_GUIDE.md"],
    []
  ),
  gate(
    "next-zero-impact",
    "evidence-present",
    [
      "docs/NEXT_ANALYZER_ACCEPTANCE.md",
      "docs/ZERO_PRODUCTION_IMPACT_FINAL_GATE.md",
      "docs/examples/zero-production-impact-final-report.sample.json"
    ],
    []
  ),
  gate(
    "overlay",
    "evidence-present",
    ["docs/OVERLAY_ACCESSIBILITY_VISUAL_ACCEPTANCE.md"],
    ["manual/external WCAG and production visual review remain open"]
  ),
  gate(
    "lsp-vscode",
    "blocked",
    ["docs/VSCODE_LSP_USAGE.md", "apps/vscode/README.md"],
    [
      "VS Code Marketplace publication and clean Marketplace install are missing"
    ]
  ),
  gate(
    "npm-packages",
    "blocked",
    [
      "docs/PACKAGE_PUBLICATION_READINESS.md",
      "docs/examples/package-publication-dry-run-report.sample.json"
    ],
    [
      "trusted publishing, approved public URLs, beta publication, and registry install are missing"
    ]
  ),
  gate(
    "cli-crawler",
    "evidence-present",
    ["docs/CLI_ACCEPTANCE.md", "docs/CLI_CI_USAGE.md"],
    ["Windows/Linux/npm/Yarn and real registry install remain release gates"]
  ),
  gate(
    "reporters",
    "evidence-present",
    [
      "docs/REPORT_TEMPLATES.md",
      "docs/REPORTS_FINAL_READINESS.md",
      "docs/examples/reports-final-readiness-report.sample.json"
    ],
    []
  ),
  gate(
    "database-storage",
    "blocked",
    ["docs/DATABASE_STORAGE_BACKUP_RESTORE.md"],
    ["real RDS deployment, backup, restore, and load proof are missing"]
  ),
  gate(
    "object-storage",
    "blocked",
    ["docs/OBJECT_STORAGE_ARTIFACT_SECURITY.md"],
    ["real S3 upload/download/delete/signed URL/restore proof is missing"]
  ),
  gate(
    "backend-api",
    "blocked",
    [
      "docs/BACKEND_API_DEPLOYMENT_SECURITY_ACCEPTANCE.md",
      "specs/openapi/searchlint-cloud-api-v1.openapi.json"
    ],
    [
      "live API Gateway/ECS/RDS deployment and load/security testing are missing"
    ]
  ),
  gate(
    "queues-workers",
    "blocked",
    ["docs/WORKERS_QUEUES_SCHEDULER_PROOF.md"],
    [
      "live SQS/DLQ/ECS/EventBridge deployment and autoscaling/alerts are missing"
    ]
  ),
  gate(
    "auth-rbac",
    "blocked",
    ["docs/AUTH_RBAC_ACCEPTANCE.md"],
    ["live Cognito signup/login/logout/MFA/invite flows are missing"]
  ),
  gate(
    "oauth-vault",
    "blocked",
    ["docs/OAUTH_VAULT_SECURITY.md"],
    [
      "live KMS/Secrets Manager/provider credentials and external vault review are missing"
    ]
  ),
  gate(
    "dashboard",
    "blocked",
    ["docs/DASHBOARD_PRODUCTION_E2E_ACCESSIBILITY.md"],
    [
      "live dashboard URL, auth/API integration, and external WCAG review are missing"
    ]
  ),
  gate(
    "google-integrations",
    "blocked",
    [
      "docs/GOOGLE_SEARCH_CONSOLE_ACCEPTANCE.md",
      "docs/GOOGLE_PERFORMANCE_ACCEPTANCE.md"
    ],
    [
      "live Google OAuth, Search Console, PageSpeed, and CrUX acceptance are missing"
    ]
  ),
  gate(
    "yandex-integrations",
    "blocked",
    ["docs/YANDEX_ACCEPTANCE.md"],
    ["live Yandex OAuth, Webmaster, and Metrica acceptance are missing"]
  ),
  gate(
    "history-correlation",
    "evidence-present",
    ["docs/HISTORY_CORRELATION_ACCEPTANCE.md"],
    ["production persistence and deployed timeline acceptance remain open"]
  ),
  gate(
    "notifications",
    "blocked",
    ["docs/NOTIFICATIONS_ACCEPTANCE.md"],
    [
      "live email/Slack/webhook/Telegram delivery and deployed scheduler are missing"
    ]
  ),
  gate(
    "billing",
    "blocked",
    ["docs/BILLING_ACCEPTANCE.md"],
    [
      "live Stripe products/prices/checkout/portal/webhook and pricing/legal approval are missing"
    ]
  ),
  gate(
    "agency",
    "blocked",
    ["docs/AGENCY_MODE_ACCEPTANCE.md"],
    [
      "deployed client portal, live agency billing, and hosted white-label links are missing"
    ]
  ),
  gate(
    "observability",
    "blocked",
    ["docs/OBSERVABILITY_INCIDENTS_TELEMETRY.md"],
    [
      "live CloudWatch dashboards, OTLP export, and incident delivery are missing"
    ]
  ),
  gate(
    "security-privacy",
    "blocked",
    ["docs/SECURITY_PRIVACY_RELEASE_GATE.md"],
    [
      "DAST, pentest, legal approval, and production security review are missing"
    ]
  ),
  gate(
    "release-docs",
    "evidence-present",
    [
      "README.md",
      "docs/DOCUMENTATION_FINAL_READINESS.md",
      "docs/examples/documentation-final-readiness-report.sample.json"
    ],
    []
  ),
  gate(
    "onboarding-source",
    "evidence-present",
    [
      "docs/ONBOARDING_FINAL_READINESS.md",
      "docs/examples/onboarding-source-final-report.sample.json"
    ],
    []
  ),
  gate(
    "public-website",
    "blocked",
    [
      "docs/PUBLIC_WEBSITE_ONBOARDING.md",
      "docs/examples/public-website-onboarding-report.sample.json"
    ],
    ["deployed public website/domain/CDN and final copy approval are missing"]
  ),
  gate(
    "legal-repository-boundary",
    "blocked",
    [
      "docs/LEGAL_RELEASE_GATE_CHECKLIST.md",
      "docs/PUBLIC_PRIVATE_REPOSITORY_BOUNDARY_PLAN.md",
      "docs/examples/public-repository-boundary-report.sample.json"
    ],
    [
      "legal approval and actual repository split are missing; static public boundary verification is present"
    ]
  ),
  gate(
    "final-tag-publication",
    "blocked",
    ["docs/SEARCHLINT_1_0_RELEASE_CANDIDATE_MATRIX.md"],
    [
      "v1.0.0 tag, npm/VS Code publication, public website publication, and final release evidence are missing"
    ]
  )
];

async function main() {
  await verifyRequiredFiles();
  const summary = summarize(gates);
  const report = {
    generatedBy: "searchlint-1-0-release-candidate-matrix-verifier",
    generatedAt: "2026-06-22T00:00:00.000Z",
    status: "blocked",
    summary,
    gates,
    requiredFinalCommands: [
      "pnpm install --frozen-lockfile",
      "pnpm format",
      "pnpm lint",
      "pnpm typecheck",
      "pnpm test",
      "pnpm verify:release",
      "pnpm verify:next-fixtures",
      "pnpm rule-qa:review",
      "pnpm package:dry-run",
      "pnpm cli:acceptance",
      "pnpm dsl:acceptance",
      "pnpm zero-impact:final",
      "pnpm reports:final-readiness",
      "pnpm dashboard:acceptance",
      "pnpm security:acceptance",
      "pnpm website:acceptance",
      "pnpm onboarding:final",
      "pnpm docs:final-readiness",
      "pnpm rc:matrix"
    ]
  };

  assertNoSensitiveValues(JSON.stringify(report));
  await mkdir(path.dirname(reportPath), { recursive: true });
  await mkdir(path.dirname(samplePath), { recursive: true });
  await writeJson(reportPath, report);
  await writeJson(samplePath, report);

  console.log(
    `SearchLint 1.0 RC matrix BLOCKED: ${summary.evidencePresentCount}/${summary.gateCount} gates have deterministic evidence; ${summary.blockedCount} gate(s) remain blocked`
  );
  console.log(`Report: ${reportPath}`);
  console.log(`Sample: ${samplePath}`);
}

function gate(id, status, evidenceFiles, blockers) {
  return {
    id,
    status,
    evidenceFiles,
    blockers,
    releaseBlocker: status === "blocked"
  };
}

function summarize(items) {
  const evidencePresentCount = items.filter(
    (item) => item.status === "evidence-present"
  ).length;
  const blockedCount = items.filter((item) => item.status === "blocked").length;
  return {
    gateCount: items.length,
    evidencePresentCount,
    blockedCount,
    releaseBlockerCount: blockedCount
  };
}

async function verifyRequiredFiles() {
  const files = new Set(gates.flatMap((item) => item.evidenceFiles));
  files.add("docs/SEARCHLINT_1_0_RELEASE_CANDIDATE_MATRIX.md");
  for (const filePath of files) {
    const info = await stat(filePath);
    if (!info.isFile()) {
      throw new Error(`${filePath} is not a file.`);
    }
    const text = await readFile(filePath, "utf8");
    if (text.trim().length === 0) {
      throw new Error(`${filePath} is empty.`);
    }
  }
}

function assertNoSensitiveValues(text) {
  const forbidden = [
    /private_key/i,
    /client-secret/i,
    /authorization:/i,
    /bearer\s+/i,
    /sk_live/i,
    /whsec_/i,
    /postgres:\/\/user/i,
    /-----BEGIN PRIVATE KEY-----/i,
    /ya29\./i
  ];
  const match = forbidden.find((pattern) => pattern.test(text));
  if (match) {
    throw new Error(`Sensitive value leaked into RC matrix evidence: ${match}`);
  }
}

async function writeJson(filePath, data) {
  await writeFile(
    filePath,
    await format(JSON.stringify(data), { parser: "json" })
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
