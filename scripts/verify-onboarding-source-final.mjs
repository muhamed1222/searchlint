#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { format } from "prettier";

const reportPath = "reports/onboarding-source-final-report.json";
const samplePath = "docs/examples/onboarding-source-final-report.sample.json";

const prerequisiteCommands = [
  command("websiteOnboardingSource", "pnpm", ["website:acceptance"]),
  command("documentationFinalReadiness", "pnpm", ["docs:final-readiness"])
];

const requiredFiles = [
  "docs/ONBOARDING_GUIDE.md",
  "docs/PUBLIC_WEBSITE_ONBOARDING.md",
  "docs/examples/demo-project/README.md",
  "docs/examples/demo-project/searchlint.seo",
  "docs/examples/public-website-onboarding-report.sample.json",
  "docs/examples/documentation-final-readiness-report.sample.json"
];

const guideSections = [
  "Installation",
  "Quick Start",
  "Next.js Guide",
  "CLI Guide",
  "VS Code Guide",
  "Google and Yandex Guide",
  "Onboarding Wizard Source",
  "Demo Project"
];

const wizardInputs = [
  "Project name and site URL",
  "Framework: Next.js, generic website, or crawler-only",
  "Environment: local, staging, or production",
  "Preferred entry point: CLI, Next.js dev overlay, VS Code, or cloud",
  "Rule policy starter: strict, balanced, or advisory",
  "Optional Google/Yandex connection intent",
  "Report audience: developer, client, executive, or agency"
];

const wizardOutputs = [
  "a `searchlint.seo` starter config",
  "the next CLI command",
  "documentation links for the selected workflow",
  "a reminder that live cloud/provider features require release-gated setup"
];

const demoConfigMarkers = [
  "language 1",
  'site "https://example.com"',
  "policy productPage",
  'route "/"',
  'route "/products/[slug]"',
  'route "/admin/**"',
  "canonical self",
  "indexable false"
];

const honestyMarkers = [
  [
    "docs/ONBOARDING_GUIDE.md",
    "Public package publication remains a release gate"
  ],
  ["docs/ONBOARDING_GUIDE.md", "Live provider setup remains a release gate"],
  [
    "docs/examples/demo-project/README.md",
    "Live cloud onboarding, Google/Yandex connection, hosted reports, and billing are not claimed"
  ],
  [
    "docs/PUBLIC_WEBSITE_ONBOARDING.md",
    "live cloud availability before deployed acceptance is complete"
  ]
];

async function main() {
  const commands = prerequisiteCommands.map(runCommand);
  const files = await verifyNonEmptyFiles(requiredFiles);
  const guide = await verifyOnboardingGuide();
  const demoProject = await verifyDemoProject();
  const releaseHonesty = await verifyReleaseHonesty();
  const report = {
    generatedBy: "searchlint-onboarding-source-final-verifier",
    generatedAt: "2026-06-23T00:00:00.000Z",
    status: "passed",
    scope: {
      proofType: "deterministic onboarding source final readiness",
      closesMasterChecklistItem: "Onboarding готов",
      doesNotClaim: [
        "deployed public website",
        "live signup/auth onboarding",
        "live cloud project creation wizard",
        "final marketing/legal/privacy/pricing approval",
        "SearchLint 1.0 final release approval"
      ]
    },
    commands,
    files,
    guide,
    demoProject,
    releaseHonesty,
    summary: {
      commandCount: commands.length,
      fileCount: files.length,
      guideSectionCount: guide.sections.length,
      wizardInputCount: guide.wizardInputs.length,
      wizardOutputCount: guide.wizardOutputs.length,
      demoConfigMarkerCount: demoProject.configMarkers.length,
      honestyMarkerCount: releaseHonesty.length
    },
    assertions: [
      "Public website/onboarding source acceptance passes.",
      "Documentation final readiness passes.",
      "Onboarding source contains installation, quick-start, local tool, provider, wizard, and demo sections.",
      "Onboarding wizard source defines expected inputs and outputs.",
      "Demo project includes a deterministic starter searchlint.seo config.",
      "Onboarding docs explicitly avoid claiming live cloud/provider/signup readiness."
    ]
  };

  assertNoSensitiveValues(JSON.stringify(report));
  await mkdir(path.dirname(reportPath), { recursive: true });
  await mkdir(path.dirname(samplePath), { recursive: true });
  await writeJson(reportPath, report);
  await writeJson(samplePath, report);

  console.log(
    `Onboarding source final gate PASS: ${guide.sections.length} sections, ${guide.wizardInputs.length} wizard inputs verified`
  );
  console.log(`Report: ${reportPath}`);
  console.log(`Sample: ${samplePath}`);
}

function command(name, executable, args) {
  return { name, executable, args };
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
  const evidence = [];
  for (const filePath of filePaths) {
    const info = await stat(filePath);
    if (!info.isFile()) {
      throw new Error(`${filePath} is not a file.`);
    }
    const text = await readFile(filePath, "utf8");
    if (text.trim().length === 0) {
      throw new Error(`${filePath} is empty.`);
    }
    evidence.push({ path: filePath, bytes: info.size });
  }
  return evidence;
}

async function verifyOnboardingGuide() {
  const text = await readFile("docs/ONBOARDING_GUIDE.md", "utf8");
  const sections = verifyMarkers(
    "docs/ONBOARDING_GUIDE.md",
    text,
    guideSections
  );
  const inputs = verifyMarkers("docs/ONBOARDING_GUIDE.md", text, wizardInputs);
  const outputs = verifyMarkers(
    "docs/ONBOARDING_GUIDE.md",
    text,
    wizardOutputs
  );
  return {
    path: "docs/ONBOARDING_GUIDE.md",
    sections,
    wizardInputs: inputs,
    wizardOutputs: outputs
  };
}

async function verifyDemoProject() {
  const readme = await readFile("docs/examples/demo-project/README.md", "utf8");
  const config = await readFile(
    "docs/examples/demo-project/searchlint.seo",
    "utf8"
  );
  verifyMarkers("docs/examples/demo-project/README.md", readme, [
    "SearchLint Demo Project",
    "What It Demonstrates",
    "not claimed by this demo project"
  ]);
  return {
    readmePath: "docs/examples/demo-project/README.md",
    configPath: "docs/examples/demo-project/searchlint.seo",
    configMarkers: verifyMarkers(
      "docs/examples/demo-project/searchlint.seo",
      config,
      demoConfigMarkers
    ),
    routes: ["/", "/products/[slug]", "/admin/**"],
    policy: "productPage"
  };
}

async function verifyReleaseHonesty() {
  const evidence = [];
  for (const [filePath, marker] of honestyMarkers) {
    const text = await readFile(filePath, "utf8");
    if (!includesNormalized(text, marker)) {
      throw new Error(
        `${filePath} is missing release-honesty marker ${marker}.`
      );
    }
    evidence.push({ filePath, marker, status: "present" });
  }
  return evidence;
}

function verifyMarkers(filePath, text, markers) {
  return markers.map((marker) => {
    if (!includesNormalized(text, marker)) {
      throw new Error(`${filePath} is missing marker ${marker}.`);
    }
    return { marker, status: "present" };
  });
}

function includesNormalized(text, marker) {
  return normalizeText(text).includes(normalizeText(marker));
}

function normalizeText(value) {
  return value.replace(/\s+/gu, " ").trim();
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
      `Sensitive value leaked into onboarding evidence: ${match}`
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
