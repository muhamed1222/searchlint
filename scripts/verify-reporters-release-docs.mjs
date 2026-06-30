#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const reportPath = path.join(
  repoRoot,
  "reports/reporters-release-docs-acceptance-report.json"
);
const samplePath = path.join(
  repoRoot,
  "docs/examples/reporters-release-docs-acceptance-report.sample.json"
);
const fixedGeneratedAt = "2026-06-22T00:00:00.000Z";

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    env: { ...process.env, ...options.env },
    encoding: "utf8",
    stdio: options.stdio ?? "pipe"
  });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function caseResult(id, status, evidence, notes = []) {
  return { id, status, evidence, notes };
}

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  run("pnpm", ["build"], { stdio: "inherit" });

  const { createHtmlReport, createPdfReport, createReportSummary } =
    await import("../packages/reporter-html/dist/src/index.js");
  const { createSarifReport, stringifySarifReport } =
    await import("../packages/reporter-sarif/dist/src/index.js");
  const { createJUnitReport } =
    await import("../packages/reporter-junit/dist/src/index.js");

  const diagnostics = [
    diagnostic({
      ruleId: "SL-META-001",
      severity: "blocker",
      sourceLocation: {
        confidence: "EXACT",
        file: "app/page.tsx",
        line: 12
      }
    }),
    diagnostic({
      ruleId: "SL-HTTP-001",
      severity: "error",
      pageUrl: "https://example.com/about",
      fingerprint: "fingerprint-2"
    }),
    diagnostic({
      ruleId: "SL-LINK-001",
      severity: "warning",
      pageUrl: "https://example.com/docs",
      fingerprint: "fingerprint-3"
    })
  ];
  const cases = [];

  const sarif = createSarifReport(diagnostics, {
    toolName: "SearchLint",
    informationUri: "https://searchlint.local/docs"
  });
  const sarifText = stringifySarifReport(sarif);
  assert(sarif.version === "2.1.0", "SARIF report must use version 2.1.0");
  assert(
    sarif.runs[0]?.results.length === diagnostics.length,
    "SARIF result count must match diagnostics"
  );
  assert(
    sarifText.includes("app/page.tsx"),
    "SARIF must preserve exact source locations"
  );
  cases.push(
    caseResult("sarif-reporter", "PASS", {
      version: sarif.version,
      resultCount: sarif.runs[0]?.results.length ?? 0,
      ruleCount: sarif.runs[0]?.tool.driver.rules.length ?? 0
    })
  );

  const junit = createJUnitReport(diagnostics, {
    suiteName: "SearchLint Release Acceptance"
  });
  assert(
    junit.includes('tests="3"') && junit.includes('failures="2"'),
    "JUnit must count blocker/error diagnostics as failures"
  );
  assert(
    junit.includes("Fingerprint: fingerprint-1"),
    "JUnit failure body must include fingerprint"
  );
  cases.push(
    caseResult("junit-reporter", "PASS", {
      tests: 3,
      failures: 2,
      escapedXml: junit.includes("&quot;") || junit.includes("SearchLint")
    })
  );

  const summary = createReportSummary(diagnostics, {
    generatedAt: fixedGeneratedAt
  });
  assert(summary.totalDiagnostics === 3, "HTML summary must count diagnostics");
  assert(
    summary.blockerAndErrorCount === 2,
    "HTML summary must count blockers/errors"
  );
  const html = createHtmlReport(diagnostics, {
    title: "SearchLint Release Acceptance Report",
    generatedAt: fixedGeneratedAt,
    reportVariant: "white-label",
    audience: "agency",
    projectName: "Example",
    environmentName: "Preview",
    subjectUrl: "https://example.com/",
    brandLabel: "Example Agency",
    comparison: {
      previousLabel: "before",
      currentLabel: "after",
      newDiagnostics: 1,
      resolvedDiagnostics: 2,
      unchangedDiagnostics: 1,
      severityDelta: {
        blocker: -1,
        error: 1,
        warning: 0,
        info: 0
      }
    },
    deployment: {
      deploymentId: "deploy-123",
      commitRef: "abc123",
      deployedAt: fixedGeneratedAt,
      environmentName: "preview",
      status: "candidate"
    },
    externalObservations: [
      {
        id: "google-1",
        provider: "google",
        source: "google.urlInspection",
        subjectUrl: "https://example.com/",
        observedAt: fixedGeneratedAt,
        fetchedAt: fixedGeneratedAt,
        freshness: "fresh",
        quota: { remaining: 199, limit: 200 },
        sampling: { sampled: false },
        payload: { verdict: "PASS" }
      },
      {
        id: "yandex-1",
        provider: "yandex",
        source: "yandex.metrica",
        subjectUrl: "https://example.com/",
        observedAt: fixedGeneratedAt,
        fetchedAt: fixedGeneratedAt,
        freshness: "fresh",
        sampling: { sampled: true, state: "sampled" },
        payload: { visits: 42 }
      }
    ]
  });
  for (const required of [
    "Executive Summary",
    "Technical Report",
    "Client / White-Label Summary",
    "Developer Diagnostics",
    "Before / After Comparison",
    "Deployment Report",
    "Google / Yandex Report",
    "PDF Readiness",
    "@media print",
    "app/page.tsx:12"
  ]) {
    assert(html.includes(required), `HTML report must include ${required}`);
  }
  assert(
    !html.includes("app/layout.tsx:7"),
    "HTML report must not invent non-EXACT source locations"
  );
  cases.push(
    caseResult("html-local-report-templates", "PASS", {
      totalDiagnostics: summary.totalDiagnostics,
      blockerAndErrorCount: summary.blockerAndErrorCount,
      includesPrintCss: html.includes("@media print"),
      includesExternalObservations: html.includes("google.urlInspection")
    })
  );

  const pdf = createPdfReport(diagnostics, {
    title: "SearchLint Release Acceptance PDF",
    generatedAt: fixedGeneratedAt,
    reportVariant: "technical",
    projectName: "Example",
    environmentName: "Preview"
  });
  const pdfText = new TextDecoder().decode(pdf);
  for (const required of [
    "%PDF-1.4",
    "/Type /Catalog",
    "/BaseFont /Helvetica",
    "xref",
    "%%EOF",
    "SearchLint Release Acceptance PDF",
    "SL-META-001",
    "app/page.tsx:12"
  ]) {
    assert(pdfText.includes(required), `PDF report must include ${required}`);
  }
  cases.push(
    caseResult("pdf-binary-export", "PASS", {
      byteLength: pdf.byteLength,
      startsWithPdfHeader: pdfText.startsWith("%PDF-1.4"),
      includesXref: pdfText.includes("xref"),
      includesEof: pdfText.includes("%%EOF")
    })
  );

  const requiredDocs = [
    "README.md",
    "CHANGELOG.md",
    "CONTRIBUTING.md",
    "DCO.md",
    "SECURITY.md",
    "docs/SECURITY_MODEL.md",
    "docs/SECURITY_PRIVACY_RELEASE_GATE.md",
    "docs/REPORT_TEMPLATES.md",
    "docs/PACKAGE_DOCUMENTATION.md",
    "docs/INSTALLATION.md",
    "docs/RELEASE_NOTES.md",
    "docs/COMPATIBILITY_MATRIX.md",
    "docs/SUPPORT_POLICY.md",
    "docs/DEPRECATION_POLICY.md",
    "docs/VERSIONING_POLICY.md",
    "docs/UPGRADE_GUIDE.md",
    "docs/INCIDENT_SUPPORT_PROCESS.md",
    "docs/DSL_MIGRATION_GUIDE.md"
  ];
  const missingDocs = [];
  for (const relativePath of requiredDocs) {
    const filePath = path.join(repoRoot, relativePath);
    if (!(await exists(filePath))) {
      missingDocs.push(relativePath);
    }
  }
  assert(
    missingDocs.length === 0,
    `Missing release docs: ${missingDocs.join(", ")}`
  );
  const templates = await readFile(
    path.join(repoRoot, "docs/REPORT_TEMPLATES.md"),
    "utf8"
  );
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
    assert(
      templates.includes(phrase),
      `Report templates must document ${phrase}`
    );
  }
  const readme = await readFile(path.join(repoRoot, "README.md"), "utf8");
  assert(
    requiredDocs
      .filter(
        (item) =>
          item.startsWith("docs/") && item !== "docs/REPORT_TEMPLATES.md"
      )
      .every((item) => readme.includes(item)),
    "README must link release documentation policy files"
  );
  assert(readme.includes("CHANGELOG.md"), "README must link CHANGELOG.md");
  for (const phrase of [
    "# SearchLint",
    "SearchLint 1.0 is not released",
    "Current Status",
    "Install and Quick Start",
    "Local Developer Surfaces",
    "Cloud and Commercial Surfaces",
    "Validation Commands",
    "Release Gates",
    "Documentation Map",
    "docs/INSTALLATION.md",
    "docs/COMPATIBILITY_MATRIX.md",
    "docs/RELEASE_NOTES.md",
    "docs/PACKAGE_DOCUMENTATION.md",
    "docs/SEARCHLINT_1_0_MASTER_CHECKLIST.md",
    "npm install -D @searchlint/cli @searchlint/core",
    "searchlint config validate --config searchlint.seo",
    "pnpm reporters:acceptance",
    "OD-023 blocker benchmark reviewer sign-offs",
    "legal review of `LICENSE`, `NOTICE`, `CONTRIBUTING.md`, `SECURITY.md`",
    "VS Code Marketplace publication",
    "v1.0.0"
  ]) {
    assert(readme.includes(phrase), `README.md must document ${phrase}`);
  }

  const changelog = await readFile(path.join(repoRoot, "CHANGELOG.md"), "utf8");
  for (const phrase of [
    "# Changelog",
    "SearchLint 1.0 is not released",
    "Unreleased",
    "1.0.0-beta.0",
    "Release Gates",
    "Known Blockers",
    "docs/RELEASE_NOTES.md",
    "docs/PROJECT_PROGRESS.md",
    "docs/SEARCHLINT_1_0_MASTER_CHECKLIST.md",
    "docs/RELEASE_GAP_MATRIX.md",
    "docs/VERSIONING_POLICY.md",
    "docs/DEPRECATION_POLICY.md"
  ]) {
    assert(changelog.includes(phrase), `CHANGELOG.md must document ${phrase}`);
  }

  const releaseNotes = await readFile(
    path.join(repoRoot, "docs/RELEASE_NOTES.md"),
    "utf8"
  );
  for (const phrase of [
    "# SearchLint Release Notes",
    "Status date: 2026-06-23",
    "SearchLint 1.0 is not released",
    "1.0.0-beta.0 Local Readiness Notes",
    "Included Local Surfaces",
    "Verified Evidence Commands",
    "Known Limitations",
    "1.0.0 Final Release Gates",
    "Reader Guidance",
    "CHANGELOG.md",
    "docs/INSTALLATION.md",
    "docs/PROJECT_PROGRESS.md",
    "docs/SEARCHLINT_1_0_MASTER_CHECKLIST.md",
    "docs/RELEASE_GAP_MATRIX.md",
    "docs/COMPATIBILITY_MATRIX.md",
    "docs/CURRENT_PRODUCT_STATUS.md",
    "pnpm rule-qa",
    "pnpm rule-qa:review",
    "pnpm cli:package-manager-acceptance",
    "pnpm reporters:acceptance",
    "deterministic binary PDF",
    "two independent OD-023 reviewer sign-offs",
    "legal review approves"
  ]) {
    assert(
      releaseNotes.includes(phrase),
      `RELEASE_NOTES.md must document ${phrase}`
    );
  }

  const installation = await readFile(
    path.join(repoRoot, "docs/INSTALLATION.md"),
    "utf8"
  );
  for (const phrase of [
    "# SearchLint Installation",
    "Status date: 2026-06-23",
    "SearchLint 1.0 is not released",
    "Public npm packages and the VS Code Marketplace",
    "extension are not published yet",
    "Node.js `>=24.0.0`",
    "pnpm `>=11.0.0 <12.0.0`",
    "Current Local Verification Path",
    "pnpm verify:release",
    "pnpm package:dry-run",
    "pnpm cli:acceptance",
    "pnpm cli:package-manager-acceptance",
    "pnpm verify:next-fixtures",
    "pnpm vscode:vsix-readiness",
    "Intended Package Installation After Publication",
    "npm install -D @searchlint/cli @searchlint/core",
    "pnpm add -D @searchlint/cli @searchlint/core",
    "yarn add -D @searchlint/cli @searchlint/core",
    "not valid release evidence until the packages are published",
    "CLI Setup",
    "`searchlint.seo` Setup",
    "Next.js Setup",
    "VS Code Setup",
    "Reporters and CI",
    "Installation Evidence and Limits",
    "Windows/Linux release runners",
    "Marketplace publication and clean install E2E",
    "docs/PACKAGE_DOCUMENTATION.md",
    "docs/CLI_CI_USAGE.md",
    "docs/NEXTJS_INSTALLATION.md",
    "docs/VSCODE_LSP_USAGE.md",
    "docs/COMPATIBILITY_MATRIX.md"
  ]) {
    assert(
      installation.includes(phrase),
      `INSTALLATION.md must document ${phrase}`
    );
  }

  const compatibilityMatrix = await readFile(
    path.join(repoRoot, "docs/COMPATIBILITY_MATRIX.md"),
    "utf8"
  );
  for (const phrase of [
    "# SearchLint Compatibility Matrix",
    "Status date: 2026-06-23",
    "SearchLint 1.0 is not released",
    "Status Legend",
    "Runtime and Toolchain",
    "Next.js Compatibility",
    "CLI and Package Installation",
    "DSL and Rule Compatibility",
    "IDE Compatibility",
    "Reporter Compatibility",
    "Cloud and Data Compatibility",
    "Provider and Commercial Compatibility",
    "Security and Release Compatibility",
    "Not Claimed",
    "pnpm verify:next-fixtures",
    "pnpm next:compatibility-matrix",
    "pnpm cli:package-manager-acceptance",
    "pnpm dsl:acceptance",
    "pnpm rule:compatibility",
    "pnpm vscode:vsix-readiness",
    "pnpm reporters:acceptance",
    "pnpm db:migration-compat",
    "Windows and Linux runner acceptance remain open",
    "Real npm registry",
    "VS Code Marketplace",
    "Requires deployed RDS proof",
    "Requires live OAuth app",
    "Requires DAST against a deployed target"
  ]) {
    assert(
      compatibilityMatrix.includes(phrase),
      `COMPATIBILITY_MATRIX.md must document ${phrase}`
    );
  }

  const contributing = await readFile(
    path.join(repoRoot, "CONTRIBUTING.md"),
    "utf8"
  );
  const dco = await readFile(path.join(repoRoot, "DCO.md"), "utf8");
  for (const phrase of [
    "Public Contribution Scope",
    "Closed Commercial Scope",
    "Developer Certificate of Origin",
    "git commit -s",
    "Apache-2.0",
    "SearchLint name and logo are not granted",
    "Release Gate"
  ]) {
    assert(
      contributing.includes(phrase),
      `CONTRIBUTING.md must document ${phrase}`
    );
  }
  for (const phrase of [
    "Developer Certificate of Origin",
    "Version 1.1",
    "Signed-off-by:",
    "git commit -s"
  ]) {
    assert(dco.includes(phrase), `DCO.md must document ${phrase}`);
  }
  const securityPolicy = await readFile(
    path.join(repoRoot, "SECURITY.md"),
    "utf8"
  );
  const securityModel = await readFile(
    path.join(repoRoot, "docs/SECURITY_MODEL.md"),
    "utf8"
  );
  const securityReleaseGate = await readFile(
    path.join(repoRoot, "docs/SECURITY_PRIVACY_RELEASE_GATE.md"),
    "utf8"
  );
  for (const phrase of [
    "Supported Scope",
    "Reporting a Vulnerability",
    "Before public release",
    "OAuth tokens",
    "Release Gate",
    "legal and security review"
  ]) {
    assert(
      securityPolicy.includes(phrase),
      `SECURITY.md must document ${phrase}`
    );
  }
  for (const phrase of [
    "Confirmed Security Requirements",
    "Security-Sensitive Components",
    "Release-Gate Security Work",
    "Custom Rule Sandbox",
    "no filesystem",
    "network"
  ]) {
    assert(
      securityModel.includes(phrase),
      `SECURITY_MODEL.md must document ${phrase}`
    );
  }
  for (const phrase of [
    "pnpm security:acceptance",
    "Verified Deterministic Scope",
    "reports/security-privacy-acceptance-report.json",
    "Blocked External Gates",
    "Release-time dependency audit",
    "Repository-owned static SAST",
    "DAST run",
    "independent penetration test",
    "Not Claimed"
  ]) {
    assert(
      securityReleaseGate.includes(phrase),
      `SECURITY_PRIVACY_RELEASE_GATE.md must document ${phrase}`
    );
  }
  cases.push(
    caseResult("release-documentation", "PASS", {
      requiredDocs,
      reportTemplatePhrases: 11,
      binaryPdfExport: true,
      contributionGuide: true,
      dco: true,
      securityDocs: true,
      readme: true,
      changelog: true,
      releaseNotes: true,
      compatibilityMatrix: true,
      installation: true
    })
  );

  const packageDocs = await readFile(
    path.join(repoRoot, "docs/PACKAGE_DOCUMENTATION.md"),
    "utf8"
  );
  for (const phrase of [
    "@searchlint/browser",
    "@searchlint/cli",
    "@searchlint/core",
    "@searchlint/crawler",
    "@searchlint/html",
    "@searchlint/http",
    "@searchlint/language",
    "searchlint-language-server",
    "@searchlint/lsp",
    "@searchlint/next",
    "@searchlint/overlay",
    "@searchlint/reporter-html",
    "@searchlint/reporter-junit",
    "@searchlint/reporter-sarif",
    "@searchlint/source",
    "sideEffects: false",
    "not release evidence",
    "Publication Gates"
  ]) {
    assert(
      packageDocs.includes(phrase),
      `Package documentation must include ${phrase}`
    );
  }
  cases.push(
    caseResult("package-documentation", "PASS", {
      publicPackageCount: 15,
      documentsTreeShaking: packageDocs.includes("sideEffects: false"),
      documentsPublicationGates: packageDocs.includes("Publication Gates")
    })
  );

  const failedCases = cases.filter((item) => item.status !== "PASS");
  const report = {
    schemaVersion: 1,
    summary: {
      status: failedCases.length === 0 ? "PASS" : "FAIL",
      generatedAt: fixedGeneratedAt,
      nodeVersion: process.version,
      caseCount: cases.length,
      passed: cases.length - failedCases.length,
      failed: failedCases.length
    },
    cases,
    limitations: [
      "Binary PDF export is implemented for deterministic local report summaries; visual PDF rendering acceptance remains a separate release gate.",
      "Hosted report links, expiration, access controls, report persistence, report history, and dashboard report UI remain release gates.",
      "Google/Yandex report sections render supplied observations only; this verifier does not call live provider APIs."
    ]
  };

  await mkdir(path.dirname(reportPath), { recursive: true });
  await mkdir(path.dirname(samplePath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(samplePath, `${JSON.stringify(report, null, 2)}\n`);

  if (report.summary.status !== "PASS") {
    process.exitCode = 1;
  }

  console.log(
    `Reporters/release docs acceptance ${report.summary.status}: ${report.summary.passed}/${report.summary.caseCount} cases passed`
  );
  console.log(`Report: ${path.relative(repoRoot, reportPath)}`);
  console.log(`Sample: ${path.relative(repoRoot, samplePath)}`);
}

function diagnostic(overrides = {}) {
  return {
    id: "diag-1",
    ruleId: "SL-META-001",
    severity: "warning",
    confidence: "certain",
    pageUrl: "https://example.com/",
    source: "raw-html",
    title: "Missing title",
    evidence: "No title element was found.",
    observedAt: fixedGeneratedAt,
    fingerprint: "fingerprint-1",
    ...overrides
  };
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
