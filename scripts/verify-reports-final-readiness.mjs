#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { format } from "prettier";

const reportPath = "reports/reports-final-readiness-report.json";
const samplePath = "docs/examples/reports-final-readiness-report.sample.json";

const prerequisiteCommands = [
  command("reportersAcceptance", "pnpm", ["reporters:acceptance"]),
  command("pdfRendering", "pnpm", ["reporters:pdf-rendering"]),
  command("hostedLinksStatic", "pnpm", ["reports:hosted-links-static"]),
  command("expirationStatic", "pnpm", ["reports:expiration-static"]),
  command("accessControlsStatic", "pnpm", ["reports:access-controls-static"]),
  command("historyStatic", "pnpm", ["reports:history-static"])
];

const requiredDocuments = [
  "docs/REPORT_TEMPLATES.md",
  "docs/PDF_REPORT_EXPORT.md",
  "docs/PDF_RENDERING_STATIC_ACCEPTANCE.md",
  "docs/HOSTED_REPORT_LINKS_STATIC_CONTRACT.md",
  "docs/REPORT_EXPIRATION_STATIC_CONTRACT.md",
  "docs/REPORT_ACCESS_CONTROLS_STATIC_CONTRACT.md",
  "docs/REPORT_HISTORY_STATIC_CONTRACT.md"
];

const requiredSamples = [
  "docs/examples/reporters-release-docs-acceptance-report.sample.json",
  "docs/examples/pdf-rendering-static-report.sample.json",
  "docs/examples/hosted-report-links-static-report.sample.json",
  "docs/examples/report-expiration-static-report.sample.json",
  "docs/examples/report-access-controls-static-report.sample.json",
  "docs/examples/report-history-static-report.sample.json"
];

const capabilities = [
  capability("sarif", "SARIF reporter acceptance", [
    "docs/examples/reporters-release-docs-acceptance-report.sample.json"
  ]),
  capability("junit", "JUnit reporter acceptance", [
    "docs/examples/reporters-release-docs-acceptance-report.sample.json"
  ]),
  capability("html", "HTML local report templates", [
    "docs/REPORT_TEMPLATES.md",
    "docs/examples/reporters-release-docs-acceptance-report.sample.json"
  ]),
  capability("pdf", "Binary PDF export and static rendering", [
    "docs/PDF_REPORT_EXPORT.md",
    "docs/PDF_RENDERING_STATIC_ACCEPTANCE.md",
    "docs/examples/pdf-rendering-static-report.sample.json"
  ]),
  capability("technical-client-executive-templates", "Report variants", [
    "docs/REPORT_TEMPLATES.md"
  ]),
  capability("before-after-deployment-google-yandex", "Contextual templates", [
    "docs/REPORT_TEMPLATES.md"
  ]),
  capability("white-label", "White-label local report template", [
    "docs/REPORT_TEMPLATES.md"
  ]),
  capability("hosted-links-static", "Hosted report links static contract", [
    "docs/HOSTED_REPORT_LINKS_STATIC_CONTRACT.md",
    "docs/examples/hosted-report-links-static-report.sample.json"
  ]),
  capability("expiration-static", "Report expiration static contract", [
    "docs/REPORT_EXPIRATION_STATIC_CONTRACT.md",
    "docs/examples/report-expiration-static-report.sample.json"
  ]),
  capability(
    "access-controls-static",
    "Hosted report access-control static contract",
    [
      "docs/REPORT_ACCESS_CONTROLS_STATIC_CONTRACT.md",
      "docs/examples/report-access-controls-static-report.sample.json"
    ]
  ),
  capability("history-static", "Report history static contract", [
    "docs/REPORT_HISTORY_STATIC_CONTRACT.md",
    "docs/examples/report-history-static-report.sample.json"
  ])
];

async function main() {
  const commands = prerequisiteCommands.map(runCommand);
  await verifyNonEmptyFiles([...requiredDocuments, ...requiredSamples]);
  await verifyJsonSamples(requiredSamples);
  await verifyReportTemplateCoverage();

  const report = {
    generatedBy: "searchlint-reports-final-readiness-verifier",
    generatedAt: "2026-06-23T00:00:00.000Z",
    status: "passed",
    scope: {
      proofType: "deterministic local/static reports final readiness",
      closesMasterChecklistItem: "Reports готовы",
      doesNotClaim: [
        "live hosted report API route deployment",
        "live S3 signed URL behavior",
        "live identity-provider access-control E2E",
        "deployed dashboard report-history UI",
        "cloud deployment readiness outside report contracts",
        "SearchLint 1.0 final release approval"
      ]
    },
    commands,
    documents: requiredDocuments,
    samples: requiredSamples,
    capabilities,
    summary: {
      commandCount: commands.length,
      documentCount: requiredDocuments.length,
      sampleCount: requiredSamples.length,
      capabilityCount: capabilities.length,
      verifiedCapabilityCount: capabilities.length
    },
    assertions: [
      "Every prerequisite report verifier passed.",
      "Every required report document exists and is non-empty.",
      "Every required sanitized sample exists, is non-empty, and parses as JSON.",
      "Report templates document SARIF/JUnit/HTML/PDF-adjacent local reports and technical/client/executive/before-after/deployment/Google/Yandex/white-label variants.",
      "Hosted links, expiration, access controls, and history are covered by static contracts.",
      "Overall SearchLint 1.0 release remains blocked by separate live, legal, publication, and reviewer gates."
    ]
  };

  assertNoSensitiveValues(JSON.stringify(report));
  await mkdir(path.dirname(reportPath), { recursive: true });
  await mkdir(path.dirname(samplePath), { recursive: true });
  await writeJson(reportPath, report);
  await writeJson(samplePath, report);

  console.log(
    `Reports final readiness PASS: ${capabilities.length}/${capabilities.length} report capabilities verified`
  );
  console.log(`Report: ${reportPath}`);
  console.log(`Sample: ${samplePath}`);
}

function command(name, executable, args) {
  return { name, executable, args };
}

function capability(id, description, evidenceFiles) {
  return {
    id,
    status: "verified",
    description,
    evidenceFiles
  };
}

function runCommand(item) {
  const startedAt = Date.now();
  const result = spawnSync(item.executable, item.args, {
    cwd: process.cwd(),
    env: process.env,
    encoding: "utf8",
    stdio: "pipe"
  });
  const durationMs = Date.now() - startedAt;
  if (result.status !== 0) {
    if (result.stdout) {
      process.stdout.write(result.stdout);
    }
    if (result.stderr) {
      process.stderr.write(result.stderr);
    }
    throw new Error(
      `${item.name} failed with exit code ${String(result.status)}.`
    );
  }
  return {
    name: item.name,
    command: [item.executable, ...item.args].join(" "),
    status: "passed",
    durationMs
  };
}

async function verifyNonEmptyFiles(filePaths) {
  for (const filePath of filePaths) {
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

async function verifyJsonSamples(filePaths) {
  for (const filePath of filePaths) {
    JSON.parse(await readFile(filePath, "utf8"));
  }
}

async function verifyReportTemplateCoverage() {
  const templates = await readFile("docs/REPORT_TEMPLATES.md", "utf8");
  for (const phrase of [
    "Technical Report",
    "Executive Report",
    "Developer Diagnostics",
    "Agency / Client Report",
    "Before / After Comparison",
    "Deployment Report",
    "Google Report",
    "Yandex Report",
    "White-Label Report",
    "Hosted Report Links",
    "Binary PDF export is implemented"
  ]) {
    if (!templates.includes(phrase)) {
      throw new Error(`REPORT_TEMPLATES.md must document ${phrase}.`);
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
    throw new Error(
      `Sensitive value leaked into reports final readiness evidence: ${match}`
    );
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
