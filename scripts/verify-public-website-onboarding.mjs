#!/usr/bin/env node
import { readFile, stat, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { format } from "prettier";

const reportPath = "reports/public-website-onboarding-report.json";
const samplePath = "docs/examples/public-website-onboarding-report.sample.json";

const requiredCoverage = [
  ["product", "docs/PUBLIC_WEBSITE_ONBOARDING.md", "Product Overview"],
  ["local-tools", "docs/PUBLIC_WEBSITE_ONBOARDING.md", "Local Tools"],
  ["cloud-platform", "docs/PUBLIC_WEBSITE_ONBOARDING.md", "Cloud Platform"],
  ["pricing", "docs/PUBLIC_WEBSITE_ONBOARDING.md", "Pricing"],
  ["installation", "docs/ONBOARDING_GUIDE.md", "Installation"],
  ["quick-start", "docs/ONBOARDING_GUIDE.md", "Quick Start"],
  ["nextjs", "docs/ONBOARDING_GUIDE.md", "Next.js Guide"],
  ["cli", "docs/ONBOARDING_GUIDE.md", "CLI Guide"],
  ["vscode", "docs/ONBOARDING_GUIDE.md", "VS Code Guide"],
  ["google-yandex", "docs/ONBOARDING_GUIDE.md", "Google and Yandex Guide"],
  ["rule-catalog", "docs/PUBLIC_WEBSITE_ONBOARDING.md", "docs/rules/README.md"],
  [
    "dsl",
    "docs/PUBLIC_WEBSITE_ONBOARDING.md",
    "specs/SEARCHLINT_LANGUAGE_SPEC.md"
  ],
  ["api", "docs/API_DOCUMENTATION.md", "Cloud API"],
  [
    "examples",
    "docs/PUBLIC_WEBSITE_ONBOARDING.md",
    "docs/examples/demo-project/README.md"
  ],
  ["faq", "docs/FAQ.md", "SearchLint FAQ"],
  ["troubleshooting", "docs/TROUBLESHOOTING.md", "SearchLint Troubleshooting"],
  ["onboarding-wizard", "docs/ONBOARDING_GUIDE.md", "Onboarding Wizard Source"],
  [
    "demo-project",
    "docs/examples/demo-project/README.md",
    "SearchLint Demo Project"
  ],
  ["contact-support", "docs/PUBLIC_WEBSITE_ONBOARDING.md", "/support"]
];

const requiredFiles = [
  "README.md",
  "docs/PUBLIC_WEBSITE_ONBOARDING.md",
  "docs/ONBOARDING_GUIDE.md",
  "docs/FAQ.md",
  "docs/TROUBLESHOOTING.md",
  "docs/API_DOCUMENTATION.md",
  "docs/NEXTJS_INSTALLATION.md",
  "docs/CLI_CI_USAGE.md",
  "docs/VSCODE_LSP_USAGE.md",
  "docs/GOOGLE_SEARCH_CONSOLE_ACCEPTANCE.md",
  "docs/YANDEX_ACCEPTANCE.md",
  "docs/rules/README.md",
  "specs/SEARCHLINT_LANGUAGE_SPEC.md",
  "docs/examples/demo-project/README.md",
  "docs/examples/demo-project/searchlint.seo"
];

async function main() {
  const fileEvidence = await verifyFiles();
  const coverage = await verifyCoverage();
  const demo = await verifyDemoProject();
  const releaseHonesty = await verifyReleaseHonesty();
  const report = {
    generatedBy: "searchlint-public-website-onboarding-verifier",
    generatedAt: "2026-06-22T00:00:00.000Z",
    status: "passed",
    scope: {
      proofType: "deterministic public website/onboarding source proof",
      doesNotClaim: [
        "deployed public website",
        "production domain or CDN",
        "live signup flow",
        "analytics/tracking setup",
        "final marketing/legal approval"
      ]
    },
    cases: {
      files: fileEvidence,
      coverage,
      demoProject: demo,
      releaseHonesty
    },
    remainingReleaseGates: [
      "Deploy public website to the approved domain/CDN.",
      "Approve final marketing, pricing, legal, privacy, and support copy.",
      "Connect live onboarding/signup when cloud release gates are complete.",
      "Add analytics/tracking only after privacy review.",
      "Verify public links and screenshots against the deployed website."
    ]
  };

  assertNoSensitiveValues(JSON.stringify(report));
  await mkdir(path.dirname(reportPath), { recursive: true });
  await mkdir(path.dirname(samplePath), { recursive: true });
  await writeJson(reportPath, report);
  await writeJson(samplePath, report);

  console.log(
    `Public website/onboarding acceptance PASS: ${requiredCoverage.length}/${requiredCoverage.length} coverage items verified`
  );
  console.log(`Report: ${reportPath}`);
  console.log(`Sample: ${samplePath}`);
}

async function verifyFiles() {
  const evidence = [];
  for (const filePath of requiredFiles) {
    const info = await stat(filePath);
    if (!info.isFile()) {
      throw new Error(`${filePath} is not a file.`);
    }
    evidence.push({
      path: filePath,
      bytes: info.size
    });
  }
  return evidence;
}

async function verifyCoverage() {
  const evidence = [];
  for (const [id, filePath, marker] of requiredCoverage) {
    const text = await readFile(filePath, "utf8");
    if (!text.includes(marker)) {
      throw new Error(
        `${id} coverage marker ${marker} missing from ${filePath}.`
      );
    }
    evidence.push({ id, filePath, marker, status: "covered" });
  }
  return evidence;
}

async function verifyDemoProject() {
  const config = await readFile(
    "docs/examples/demo-project/searchlint.seo",
    "utf8"
  );
  for (const marker of [
    "language 1",
    'site "https://example.com"',
    "policy productPage",
    'route "/"',
    'route "/products/[slug]"',
    'route "/admin/**"'
  ]) {
    if (!config.includes(marker)) {
      throw new Error(`Demo project config is missing ${marker}.`);
    }
  }
  return {
    configPath: "docs/examples/demo-project/searchlint.seo",
    readmePath: "docs/examples/demo-project/README.md",
    routes: ["/", "/products/[slug]", "/admin/**"],
    status: "covered"
  };
}

async function verifyReleaseHonesty() {
  const website = await readFile("docs/PUBLIC_WEBSITE_ONBOARDING.md", "utf8");
  for (const marker of [
    "must not claim",
    "published npm packages before package publication is complete",
    "published VS Code extension before Marketplace release is complete",
    "live cloud availability before deployed acceptance is complete"
  ]) {
    if (!website.includes(marker)) {
      throw new Error(`Release honesty marker missing: ${marker}`);
    }
  }
  return {
    status: "covered",
    blockedClaims: [
      "npm publication",
      "VS Code Marketplace publication",
      "live cloud availability",
      "live Google/Yandex integrations",
      "security/pentest completion"
    ]
  };
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
      `Sensitive value leaked into website/onboarding evidence: ${match}`
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
