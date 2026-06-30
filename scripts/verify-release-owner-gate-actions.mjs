#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { format } from "prettier";

const checklistPath = "docs/SEARCHLINT_1_0_MASTER_CHECKLIST.md";
const reportPath = "reports/release-owner-gate-actions-report.json";
const samplePath =
  "docs/examples/release-owner-gate-actions-report.sample.json";
const generatedAt = "2026-06-23T00:00:00.000Z";

const checklist = await readFile(checklistPath, "utf8");
const items = parseChecklist(checklist);
const openItems = items.filter((item) => !item.done);
const doneItems = items.filter((item) => item.done);
const openGates = openItems.map((item) =>
  addExternalOwnerEvidencePath(classifyOpenItem(item))
);
const actionability = summarizeActionability(openGates);

const report = {
  schemaVersion: 1,
  generatedBy: "searchlint-release-owner-gate-actions-verifier",
  generatedAt,
  status: openGates.length === 0 ? "all_checklist_items_closed" : "open_gates",
  source: {
    checklistPath,
    sections: new Set(items.map((item) => item.section)).size,
    checkedItems: doneItems.length,
    openItems: openItems.length,
    totalItems: items.length
  },
  releaseReadiness: {
    canReleaseSearchLint1: openGates.length === 0,
    remainingChecklistItems: openGates.length,
    statement:
      openGates.length === 0
        ? "The master checklist has no open items."
        : "SearchLint 1.0 is not complete while owner/live/reviewer/publication gates remain open."
  },
  gateSummary: summarizeGates(openGates),
  actionability,
  openGates
};

assertReportCompleteness(report, openItems);
assertActionability(report);
assertNoSensitiveValues(JSON.stringify(report));
await writeJson(reportPath, report);
await writeJson(samplePath, report);

console.log(
  `Release owner gates: ${doneItems.length}/${items.length} done, ${openItems.length} remaining`
);
console.log(`Report: ${reportPath}`);
console.log(`Sample: ${samplePath}`);

function parseChecklist(text) {
  const parsed = [];
  let section = "Unsectioned";
  for (const line of text.split("\n")) {
    if (line.startsWith("## ")) {
      section = line.slice(3).trim();
      continue;
    }
    const match = /^- \[(x| )\] (.+)$/u.exec(line);
    if (match === null) continue;
    parsed.push({
      section,
      done: match[1] === "x",
      item: match[2].trim()
    });
  }
  return parsed;
}

function classifyOpenItem(item) {
  const text = `${item.section} ${item.item}`.toLowerCase();
  const base = {
    section: item.section,
    item: item.item,
    gateType: "owner_release_gate",
    requiredEvidence:
      "Owner-provided evidence that directly proves this checklist item.",
    nextOwnerAction:
      "Provide the required evidence or complete the external release action.",
    relatedCommand: null,
    evidencePaths: []
  };

  if (
    matches(text, [
      "передать им review packet",
      "deliver review packet",
      "review packet delivery"
    ])
  ) {
    return {
      ...base,
      gateType: "independent_reviewer_delivery_gate",
      requiredEvidence:
        "Owner-provided DELIVERY_EVIDENCE.json proving the blocker benchmark review packet was sent to two intended independent reviewers, with matching benchmarkVersion and case-index SHA-256.",
      nextOwnerAction:
        "Send the handoff packet to two intended independent reviewers, provide DELIVERY_EVIDENCE.json, then run the delivery gate.",
      relatedCommand: "pnpm rule-qa:review-delivery",
      evidencePaths: [
        "docs/reviews/blocker-benchmark/DELIVERY_EVIDENCE.json",
        "reports/blocker-benchmark-review-delivery-report.json"
      ]
    };
  }

  if (
    matches(text, [
      "reviewer",
      "review-фай",
      "review file",
      "od-023",
      "rule-qa:review",
      "disagreements",
      "adjudication",
      "benchmarkversion",
      "1960 benchmark"
    ])
  ) {
    return {
      ...base,
      gateType: "independent_reviewer_gate",
      requiredEvidence:
        "Two real independent reviewer JSON files, full benchmark coverage, matching benchmarkVersion, adjudicated disagreements, and passing pnpm rule-qa:review.",
      nextOwnerAction:
        "Select two independent reviewers, collect reviewer-1.review.json and reviewer-2.review.json, adjudicate disputes, then rerun the review gate.",
      relatedCommand: "pnpm rule-qa:review",
      evidencePaths: [
        "docs/reviews/blocker-benchmark/reviewer-1.review.json",
        "docs/reviews/blocker-benchmark/reviewer-2.review.json",
        "reports/blocker-benchmark-adjudication-summary.json"
      ]
    };
  }

  if (matches(text, ["legal", "юрид", "license", "repository boundary"])) {
    return {
      ...base,
      gateType: "legal_owner_gate",
      requiredEvidence:
        "Qualified legal/owner approval JSON plus reviewed public/private repository boundary evidence.",
      nextOwnerAction:
        "Complete legal review and provide the approved release-gate evidence file.",
      relatedCommand: "pnpm legal:release-gate",
      evidencePaths: [
        "docs/legal-release-approval.json",
        "reports/legal-release-approval-report.json"
      ]
    };
  }

  if (matches(text, ["ci-провер", "required ci", "checks before merge"])) {
    return {
      ...base,
      gateType: "hosted_github_governance_gate",
      requiredEvidence:
        "Configured GitHub origin plus main branch protection with the exact required CI status checks enforced before merge.",
      nextOwnerAction:
        "Create/configure the GitHub repository remote, enable required status checks for main, and run the dedicated required-CI verifier.",
      relatedCommand: "pnpm governance:required-ci-checks",
      evidencePaths: [
        "docs/github/branch-protection-main.json",
        "docs/github/hosted-governance-evidence.json",
        "reports/required-ci-checks-owner-gate-report.json"
      ]
    };
  }

  if (matches(text, ["protected branches"])) {
    return {
      ...base,
      gateType: "hosted_github_governance_gate",
      requiredEvidence:
        "Configured GitHub origin plus branch protection on main with required CI checks enforced.",
      nextOwnerAction:
        "Create/configure the GitHub repository remote and apply the reviewed branch-protection payload.",
      relatedCommand: "pnpm governance:branch-protection",
      evidencePaths: [
        "docs/github/branch-protection-main.json",
        "docs/github/hosted-governance-evidence.json",
        "reports/branch-protection-owner-gate-report.json"
      ]
    };
  }

  if (
    matches(text, [
      "npm-пак",
      "npm packages",
      "package publication",
      "packages опублик",
      "0.0.0",
      "beta packages"
    ])
  ) {
    const packageMapping = commandForPackageGate(text);
    return {
      ...base,
      gateType: "npm_publication_gate",
      requiredEvidence: packageMapping.requiredEvidence,
      nextOwnerAction: packageMapping.nextOwnerAction,
      relatedCommand: packageMapping.relatedCommand,
      evidencePaths: packageMapping.evidencePaths
    };
  }

  if (matches(text, ["vs code", "extension", "publisher", "marketplace"])) {
    const vsCodeMapping = commandForVsCodeGate(text);
    return {
      ...base,
      gateType: "vscode_marketplace_gate",
      requiredEvidence: vsCodeMapping.requiredEvidence,
      nextOwnerAction: vsCodeMapping.nextOwnerAction,
      relatedCommand: vsCodeMapping.relatedCommand,
      evidencePaths: vsCodeMapping.evidencePaths
    };
  }

  if (matches(text, ["100 000 url", "100,000 url"])) {
    return {
      ...base,
      gateType: "production_deployment_gate",
      requiredEvidence:
        "Cloud crawler execution evidence for 100,000 URLs, including deployed worker/resource identifiers, crawl summary, failure/retry/cost controls, and sanitized artifacts.",
      nextOwnerAction:
        "Run the cloud crawler scale acceptance in the deployed environment and preserve sanitized evidence.",
      relatedCommand: "pnpm crawler:acceptance",
      evidencePaths: ["reports/crawler-acceptance-report.json"]
    };
  }

  if (matches(text, ["external security review vault"])) {
    return {
      ...base,
      gateType: "external_security_review_gate",
      requiredEvidence:
        "Two real independent OAuth vault security reviewer files plus passing vault security review report.",
      nextOwnerAction:
        "Provide real OAuth vault security reviewer evidence and rerun the vault security review gate.",
      relatedCommand: "pnpm oauth-vault:security-review",
      evidencePaths: [
        "docs/reviews/oauth-vault-security/reviewer-1.review.json",
        "docs/reviews/oauth-vault-security/reviewer-2.review.json",
        "reports/oauth-vault-security-review-report.json"
      ]
    };
  }

  if (matches(text, ["oauth vault proof"])) {
    return {
      ...base,
      gateType: "production_deployment_gate",
      requiredEvidence:
        "Deployed KMS/Secrets Manager OAuth vault acceptance evidence plus external security review sign-off.",
      nextOwnerAction:
        "Run deployed OAuth vault acceptance and complete the independent vault security review.",
      relatedCommand: "pnpm oauth-vault:acceptance",
      evidencePaths: [
        "reports/oauth-vault-security-report.json",
        "reports/oauth-vault-security-review-report.json"
      ]
    };
  }

  if (matches(text, ["overlay release acceptance"])) {
    return {
      ...base,
      gateType: "manual_accessibility_review_gate",
      requiredEvidence:
        "Overlay automated acceptance, visual regression, and manual accessibility/screen-reader reviewer evidence.",
      nextOwnerAction:
        "Run overlay acceptance/visual checks and provide real manual accessibility reviewer evidence.",
      relatedCommand: "pnpm overlay:manual-a11y-review",
      evidencePaths: [
        "reports/overlay-acceptance-report.json",
        "reports/overlay-visual-regression-report.json",
        "docs/reviews/overlay-accessibility/reviewer.review.json",
        "reports/overlay-manual-a11y-review-report.json"
      ]
    };
  }

  if (matches(text, ["notifications готовы"])) {
    return {
      ...base,
      gateType: "live_provider_acceptance_gate",
      requiredEvidence:
        "Notification contracts, persistence/redaction evidence, and live provider delivery evidence for the enabled channels.",
      nextOwnerAction:
        "Run notification acceptance plus live provider delivery checks and preserve sanitized delivery evidence.",
      relatedCommand: "pnpm notifications:acceptance",
      evidencePaths: [
        "reports/notifications-acceptance-report.json",
        "reports/notification-workers-static-report.json",
        "reports/notification-settings-persistence-static-report.json",
        "reports/notification-redaction-review-report.json"
      ]
    };
  }

  if (matches(text, ["agency mode готов"])) {
    return {
      ...base,
      gateType: "production_deployment_gate",
      requiredEvidence:
        "Agency mode deterministic evidence plus deployed persistence, client access, hosted white-label links, and billing evidence.",
      nextOwnerAction:
        "Run agency acceptance and deployed agency evidence gates, then preserve live billing/client access evidence.",
      relatedCommand: "pnpm agency:acceptance",
      evidencePaths: [
        "reports/agency-acceptance-report.json",
        "reports/agency-persistence-acceptance-packet-report.json",
        "reports/agency-client-access-browser-e2e-report.json"
      ]
    };
  }

  if (matches(text, ["backup/restore"])) {
    return {
      ...base,
      gateType: "production_deployment_gate",
      requiredEvidence:
        "Live RDS backup restore, RDS PITR, and S3 object restore drill evidence.",
      nextOwnerAction:
        "Provide live backup/restore drill evidence and run the backup restore live gate.",
      relatedCommand: "pnpm backup:restore-live-gate",
      evidencePaths: [
        "docs/live-backup-restore-drill.json",
        "reports/live-backup-restore-drill-report.json"
      ]
    };
  }

  if (
    matches(text, [
      "развернуть",
      "production",
      "deployed",
      "rds",
      "s3",
      "api deployment",
      "workers/sqs",
      "cognito",
      "dashboard production",
      "observability",
      "cloudwatch",
      "logging",
      "metrics",
      "tracing",
      "client portal"
    ])
  ) {
    return {
      ...base,
      gateType: "production_deployment_gate",
      requiredEvidence:
        "Production-equivalent deployed target evidence, sanitized URLs/resource identifiers, and passing focused deployed acceptance command.",
      nextOwnerAction:
        "Deploy the target surface in the approved environment and capture sanitized deployed acceptance evidence.",
      relatedCommand: commandForDeploymentGate(text),
      evidencePaths: evidencePathsForDeploymentGate(text)
    };
  }

  if (
    matches(text, [
      "live",
      "google",
      "yandex",
      "яндекс",
      "метрика",
      "вебмастер",
      "pagespeed",
      "crux",
      "stripe",
      "slack",
      "webhook",
      "telegram",
      "email delivery",
      "customer portal"
    ])
  ) {
    return {
      ...base,
      gateType: "live_provider_acceptance_gate",
      requiredEvidence:
        "Live provider account/configuration evidence, sanitized API response or delivery proof, quota/freshness handling, and passing live acceptance command.",
      nextOwnerAction:
        "Provide live provider credentials/configuration outside the repo, run the relevant acceptance packet, and store sanitized evidence.",
      relatedCommand: commandForLiveGate(text),
      evidencePaths: evidencePathsForLiveGate(text)
    };
  }

  if (matches(text, ["accessibility", "screen readers", "wcag"])) {
    return {
      ...base,
      gateType: "manual_accessibility_review_gate",
      requiredEvidence:
        "Manual accessibility review evidence for the required assistive technology/browser matrix.",
      nextOwnerAction:
        "Run the manual accessibility review and record reviewer evidence.",
      relatedCommand: "pnpm overlay:manual-a11y-review",
      evidencePaths: [
        "docs/reviews/overlay-accessibility/reviewer.review.json",
        "reports/overlay-manual-a11y-review-report.json"
      ]
    };
  }

  if (
    matches(text, ["dast", "penetration", "security release", "security audit"])
  ) {
    return {
      ...base,
      gateType: "external_security_review_gate",
      requiredEvidence:
        "Passed deployed-target DAST, independent penetration-test report, remediation sign-off, and security/legal approval.",
      nextOwnerAction:
        "Run DAST against deployed production-equivalent targets, commission independent penetration testing, remediate findings, and approve the final gate.",
      relatedCommand: text.includes("penetration")
        ? "pnpm security:pentest"
        : "pnpm security:dast",
      evidencePaths: evidencePathsForSecurityGate(text)
    };
  }

  if (matches(text, ["tag", "опубликован searchlint", "release candidate"])) {
    return {
      ...base,
      gateType: "final_release_action_gate",
      requiredEvidence:
        "Passing full release-candidate matrix, signed tag, publication proof, and final release approval.",
      nextOwnerAction:
        "Run the final release gates only after all prerequisite gates pass.",
      relatedCommand: "pnpm final-release:gate",
      evidencePaths: [
        "reports/final-release-gate-report.json",
        "docs/examples/final-release-gate-report.sample.json"
      ]
    };
  }

  if (matches(text, ["public website"])) {
    return {
      ...base,
      gateType: "deployed_public_website_gate",
      requiredEvidence:
        "Deployed website domain/CDN evidence, approved marketing/legal copy, live link validation, and screenshots if required.",
      nextOwnerAction:
        "Deploy the public website and capture sanitized deployed website acceptance evidence.",
      relatedCommand: "pnpm website:acceptance",
      evidencePaths: ["reports/public-website-onboarding-report.json"]
    };
  }

  if (matches(text, ["rule qa", "120 правил", "release-quality"])) {
    return {
      ...base,
      gateType: "rule_quality_final_gate",
      requiredEvidence:
        "Passed independent OD-023 reviewer gate plus release-quality confirmation for all 120 rules.",
      nextOwnerAction:
        "Complete the independent reviewer gate, then rerun rule QA and update status.",
      relatedCommand: "pnpm rule-qa:review",
      evidencePaths: [
        "reports/blocker-benchmark-adjudication-summary.json",
        "reports/rule-qa-summary.json"
      ]
    };
  }

  return base;
}

function addExternalOwnerEvidencePath(gate) {
  if (!requiresExternalOwnerEvidence(gate)) return gate;
  if (gate.evidencePaths.some(isOwnerInputEvidencePath)) return gate;
  return {
    ...gate,
    evidencePaths: [ownerEvidencePathForGate(gate), ...gate.evidencePaths]
  };
}

function requiresExternalOwnerEvidence(gate) {
  return [
    "independent_reviewer_gate",
    "independent_reviewer_delivery_gate",
    "legal_owner_gate",
    "hosted_github_governance_gate",
    "npm_publication_gate",
    "vscode_marketplace_gate",
    "production_deployment_gate",
    "live_provider_acceptance_gate",
    "manual_accessibility_review_gate",
    "external_security_review_gate",
    "deployed_public_website_gate",
    "final_release_action_gate"
  ].includes(gate.gateType);
}

function isOwnerInputEvidencePath(evidencePath) {
  return (
    evidencePath.startsWith("docs/") &&
    evidencePath.endsWith(".json") &&
    !evidencePath.startsWith("docs/examples/")
  );
}

function ownerEvidencePathForGate(gate) {
  return `docs/release-owner-evidence/${slugify(`${gate.section}-${gate.item}`)}.json`;
}

function slugify(value) {
  const transliterated = value
    .toLowerCase()
    .replaceAll("ё", "e")
    .replaceAll("й", "i")
    .replaceAll("ц", "c")
    .replaceAll("у", "u")
    .replaceAll("к", "k")
    .replaceAll("е", "e")
    .replaceAll("н", "n")
    .replaceAll("г", "g")
    .replaceAll("ш", "sh")
    .replaceAll("щ", "sh")
    .replaceAll("з", "z")
    .replaceAll("х", "h")
    .replaceAll("ъ", "")
    .replaceAll("ф", "f")
    .replaceAll("ы", "y")
    .replaceAll("в", "v")
    .replaceAll("а", "a")
    .replaceAll("п", "p")
    .replaceAll("р", "r")
    .replaceAll("о", "o")
    .replaceAll("л", "l")
    .replaceAll("д", "d")
    .replaceAll("ж", "zh")
    .replaceAll("э", "e")
    .replaceAll("я", "ya")
    .replaceAll("ч", "ch")
    .replaceAll("с", "s")
    .replaceAll("м", "m")
    .replaceAll("и", "i")
    .replaceAll("т", "t")
    .replaceAll("ь", "")
    .replaceAll("б", "b")
    .replaceAll("ю", "yu");
  return transliterated
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function matches(text, fragments) {
  return fragments.some((fragment) => text.includes(fragment));
}

function commandForDeploymentGate(text) {
  if (text.includes("rds") || text.includes("postgresql")) {
    return "pnpm verify:postgres";
  }
  if (text.includes("s3")) return "pnpm object-storage:acceptance";
  if (text.includes("api")) return "pnpm api:acceptance";
  if (text.includes("workers") || text.includes("sqs")) {
    return "pnpm workers:acceptance";
  }
  if (text.includes("cognito") || text.includes("rbac")) {
    return "pnpm auth:acceptance";
  }
  if (text.includes("dashboard")) return "pnpm dashboard:production-e2e";
  if (text.includes("observability")) return "pnpm observability:acceptance";
  if (text.includes("client portal"))
    return "pnpm agency:client-access-browser-e2e";
  return null;
}

function commandForLiveGate(text) {
  if (text.includes("google")) return "pnpm google:gsc:acceptance";
  if (text.includes("pagespeed") || text.includes("crux")) {
    return "pnpm google:performance:acceptance";
  }
  if (
    text.includes("yandex") ||
    text.includes("яндекс") ||
    text.includes("метрика") ||
    text.includes("вебмастер")
  ) {
    return "pnpm yandex:acceptance";
  }
  if (text.includes("stripe") || text.includes("billing")) {
    return "pnpm billing:live-stripe-final-acceptance-packet";
  }
  if (text.includes("customer portal")) {
    return "pnpm billing:customer-portal-acceptance-packet";
  }
  if (
    text.includes("email") ||
    text.includes("slack") ||
    text.includes("webhook") ||
    text.includes("telegram")
  ) {
    return "pnpm notifications:acceptance";
  }
  return null;
}

function evidencePathsForDeploymentGate(text) {
  if (text.includes("rds") || text.includes("postgresql")) {
    if (text.includes("stripe")) {
      return ["reports/stripe-webhook-rds-acceptance-packet-report.json"];
    }
    return [
      "reports/backend-api-postgresql-integration-report.json",
      "reports/db-migrations-real-postgres-report.json"
    ];
  }
  if (text.includes("s3")) {
    return [
      "reports/object-storage-artifact-security-report.json",
      "reports/object-storage-upload-contract-report.json"
    ];
  }
  if (text.includes("api"))
    return ["reports/backend-api-acceptance-report.json"];
  if (text.includes("workers") || text.includes("sqs")) {
    return [
      "reports/workers-queues-scheduler-report.json",
      "reports/worker-containers-report.json",
      "reports/worker-sqs-dlq-report.json"
    ];
  }
  if (text.includes("cognito") || text.includes("rbac")) {
    return [
      "reports/auth-rbac-acceptance-report.json",
      "reports/cognito-oidc-static-report.json"
    ];
  }
  if (text.includes("dashboard")) {
    return ["reports/dashboard-production-e2e-deployed-url-report.json"];
  }
  if (text.includes("observability")) {
    return [
      "reports/observability-acceptance-report.json",
      "reports/observability-error-tracking-report.json"
    ];
  }
  if (text.includes("client portal")) {
    return ["reports/agency-client-access-browser-e2e-report.json"];
  }
  return [];
}

function evidencePathsForLiveGate(text) {
  if (text.includes("google")) {
    return ["reports/google-search-console-acceptance-report.json"];
  }
  if (text.includes("pagespeed") || text.includes("crux")) {
    return [
      "reports/google-performance-acceptance-report.json",
      "reports/google-performance-history-report.json"
    ];
  }
  if (
    text.includes("yandex") ||
    text.includes("яндекс") ||
    text.includes("метрика") ||
    text.includes("вебмастер")
  ) {
    return ["reports/yandex-acceptance-report.json"];
  }
  if (text.includes("customer portal")) {
    return [
      "reports/live-stripe-customer-portal-acceptance-packet-report.json"
    ];
  }
  if (text.includes("stripe") || text.includes("billing")) {
    return ["reports/live-stripe-final-acceptance-packet-report.json"];
  }
  if (
    text.includes("email") ||
    text.includes("slack") ||
    text.includes("webhook") ||
    text.includes("telegram")
  ) {
    return ["reports/notifications-acceptance-report.json"];
  }
  return [];
}

function evidencePathsForSecurityGate(text) {
  if (text.includes("penetration")) {
    return [
      "docs/reviews/penetration-test/report-summary.json",
      "reports/penetration-test-release-gate-report.json"
    ];
  }
  if (text.includes("dast")) {
    return ["reports/dast-release-gate-report.json"];
  }
  return [
    "reports/security-privacy-acceptance-report.json",
    "reports/dast-release-gate-report.json",
    "reports/penetration-test-release-gate-report.json"
  ];
}

function commandForPackageGate(text) {
  if (
    matches(text, [
      "repository",
      "homepage",
      "bugs",
      "package metadata",
      "metadata"
    ])
  ) {
    return {
      requiredEvidence:
        "Owner-approved public package repository/homepage/bugs metadata plus passing package metadata approval report.",
      nextOwnerAction:
        "Provide docs/package-metadata-approval.json with approved public URLs, then run package metadata approval.",
      relatedCommand: "pnpm package:metadata-approval",
      evidencePaths: [
        "docs/package-metadata-approval.json",
        "reports/public-package-metadata-approval-report.json"
      ]
    };
  }
  if (matches(text, ["beta packages"])) {
    return {
      requiredEvidence:
        "Hosted npm workflow publication proof for 1.0.0-beta.0, npm provenance, beta dist-tag, and no private package publication.",
      nextOwnerAction:
        "Complete legal/package metadata gates, configure npm trusted publishing, run the hosted workflow with publish=true and tag=beta, then preserve publication evidence.",
      relatedCommand: "pnpm package:beta-publication-gate",
      evidencePaths: [
        "reports/beta-package-publication-gate-report.json",
        "reports/prerelease-beta-preparation-report.json"
      ]
    };
  }
  if (
    matches(text, ["чистую установку опубликованных", "published packages"])
  ) {
    return {
      requiredEvidence:
        "Clean install from the public npm registry after packages are published, with sanitized install logs and package versions.",
      nextOwnerAction:
        "After beta/final publication, verify clean install from the approved public registry and preserve sanitized evidence.",
      relatedCommand: "pnpm package:registry-install",
      evidencePaths: ["reports/npm-like-registry-install-report.json"]
    };
  }
  if (
    matches(text, [
      "final release versions",
      "финальную публикацию",
      "пакеты опубликованы",
      "1.0.0"
    ])
  ) {
    return {
      requiredEvidence:
        "Final 1.0.0 version approval, passing RC matrix, hosted npm publication proof, provenance, and clean public registry install.",
      nextOwnerAction:
        "Run final publication only after all release gates pass, then preserve npm publication and install evidence.",
      relatedCommand: "pnpm final-release:gate",
      evidencePaths: [
        "reports/final-release-gate-report.json",
        "reports/searchlint-1-0-rc-matrix-report.json"
      ]
    };
  }
  return {
    requiredEvidence:
      "Approved repository/homepage/bugs metadata, final package versions when releasing, npm trusted publishing, beta publication, and clean install from published packages.",
    nextOwnerAction:
      "Provide approved package metadata URLs, finish legal/repository boundary review, configure npm trusted publishing, and run beta/final publication gates.",
    relatedCommand: "pnpm package:metadata-approval",
    evidencePaths: [
      "docs/package-metadata-approval.json",
      "reports/public-package-metadata-approval-report.json"
    ]
  };
}

function commandForVsCodeGate(text) {
  if (matches(text, ["publisher account", "publisher"])) {
    return {
      requiredEvidence:
        "VS Code Marketplace publisher account configured for SearchLint plus local VSIX readiness/update evidence.",
      nextOwnerAction:
        "Configure the Marketplace publisher account, keep the local VSIX/update evidence current, and preserve publisher setup evidence outside secrets.",
      relatedCommand: "pnpm vscode:update-e2e",
      evidencePaths: [
        "reports/vscode-vsix-readiness-report.json",
        "reports/vscode-update-e2e-report.json"
      ]
    };
  }
  if (matches(text, ["опубликовать extension", "extension опубликован"])) {
    return {
      requiredEvidence:
        "Signed and published VS Code extension on Marketplace, publisher metadata, and clean install/update evidence after publication.",
      nextOwnerAction:
        "After publisher setup and legal approval, publish the VSIX through the Marketplace flow and preserve publication/install evidence.",
      relatedCommand: "pnpm vscode:update-e2e",
      evidencePaths: [
        "reports/vscode-vsix-readiness-report.json",
        "reports/vscode-clean-install-e2e-report.json",
        "reports/vscode-update-e2e-report.json"
      ]
    };
  }
  return {
    requiredEvidence:
      "VS Code publisher account, signed/published extension, Marketplace metadata, and clean update/install evidence.",
    nextOwnerAction:
      "Configure the Marketplace publisher and run the extension publication/update acceptance flow.",
    relatedCommand: "pnpm vscode:vsix-readiness",
    evidencePaths: ["reports/vscode-vsix-readiness-report.json"]
  };
}

function summarizeGates(gates) {
  return Object.values(
    gates.reduce((summary, gate) => {
      summary[gate.gateType] ??= {
        gateType: gate.gateType,
        count: 0
      };
      summary[gate.gateType].count += 1;
      return summary;
    }, {})
  ).sort((left, right) => left.gateType.localeCompare(right.gateType));
}

function assertReportCompleteness(report, expectedOpenItems) {
  if (report.openGates.length !== expectedOpenItems.length) {
    throw new Error("Open gate count does not match parsed checklist count.");
  }
  const seen = new Set();
  for (const gate of report.openGates) {
    const key = `${gate.section}\n${gate.item}`;
    if (seen.has(key)) {
      throw new Error(`Duplicate open gate in report: ${gate.item}`);
    }
    seen.add(key);
  }
}

function summarizeActionability(gates) {
  const genericOwnerGates = gates.filter(
    (gate) => gate.gateType === "owner_release_gate"
  );
  const missingRelatedCommand = gates.filter(
    (gate) =>
      typeof gate.relatedCommand !== "string" ||
      gate.relatedCommand.trim().length === 0
  );
  const missingEvidencePaths = gates.filter(
    (gate) =>
      !Array.isArray(gate.evidencePaths) || gate.evidencePaths.length === 0
  );
  const missingRequiredEvidence = gates.filter(
    (gate) =>
      typeof gate.requiredEvidence !== "string" ||
      gate.requiredEvidence.trim().length === 0
  );
  const missingNextOwnerAction = gates.filter(
    (gate) =>
      typeof gate.nextOwnerAction !== "string" ||
      gate.nextOwnerAction.trim().length === 0
  );
  const failures = [
    ...genericOwnerGates.map((gate) =>
      actionabilityFailure("generic_owner_gate", gate)
    ),
    ...missingRelatedCommand.map((gate) =>
      actionabilityFailure("missing_related_command", gate)
    ),
    ...missingEvidencePaths.map((gate) =>
      actionabilityFailure("missing_evidence_paths", gate)
    ),
    ...missingRequiredEvidence.map((gate) =>
      actionabilityFailure("missing_required_evidence", gate)
    ),
    ...missingNextOwnerAction.map((gate) =>
      actionabilityFailure("missing_next_owner_action", gate)
    )
  ];

  return {
    status: failures.length === 0 ? "passed" : "failed",
    checkedOpenGateCount: gates.length,
    genericOwnerGateCount: genericOwnerGates.length,
    missingRelatedCommandCount: missingRelatedCommand.length,
    missingEvidencePathsCount: missingEvidencePaths.length,
    missingRequiredEvidenceCount: missingRequiredEvidence.length,
    missingNextOwnerActionCount: missingNextOwnerAction.length,
    failures
  };
}

function actionabilityFailure(code, gate) {
  return {
    code,
    section: gate.section,
    item: gate.item,
    gateType: gate.gateType
  };
}

function assertActionability(report) {
  if (report.actionability.status === "passed") return;
  const details = report.actionability.failures
    .map(
      (failure) =>
        `${failure.code}: ${failure.section} / ${failure.item} (${failure.gateType})`
    )
    .join("\n");
  throw new Error(`Owner-gate actionability check failed:\n${details}`);
}

function assertNoSensitiveValues(text) {
  const forbidden = [
    /private_key/i,
    /client-secret/i,
    /authorization:/i,
    /bearer\s+/i,
    /cookie:/i,
    /set-cookie:/i,
    /sk_live/i,
    /whsec_/i,
    /postgres:\/\//i,
    /-----BEGIN PRIVATE KEY-----/i,
    /ya29\./i,
    /xox[baprs]-/i
  ];
  const match = forbidden.find((pattern) => pattern.test(text));
  if (match) {
    throw new Error(
      `Sensitive value leaked into release owner-gate evidence: ${match}`
    );
  }
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(
    filePath,
    await format(`${JSON.stringify(value, null, 2)}\n`, { parser: "json" })
  );
}
