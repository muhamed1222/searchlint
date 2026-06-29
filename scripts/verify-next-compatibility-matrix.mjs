#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const reportPath = path.join(
  repoRoot,
  "reports/next-compatibility-matrix-report.json"
);
const samplePath = path.join(
  repoRoot,
  "docs/examples/next-compatibility-matrix-report.sample.json"
);
const analyzerReportPath = path.join(
  repoRoot,
  "reports/next-analyzer-acceptance-report.json"
);
const sourceMappingReportPath = path.join(
  repoRoot,
  "reports/next-source-mapping-report.json"
);
const realFixtureReportPath = path.join(
  repoRoot,
  "reports/next-fixture-zero-impact-report.json"
);
const fixedGeneratedAt = "2026-06-23T00:00:00.000Z";
const expectedFixtureIds = [
  "next15-app",
  "next15-pages",
  "next16-app",
  "next16-pages"
];

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

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function main() {
  const commandEvidence = [];

  commandEvidence.push(runCommand("pnpm next:acceptance", ["next:acceptance"]));
  commandEvidence.push(
    runCommand("pnpm next:source-mapping", ["next:source-mapping"])
  );
  commandEvidence.push(
    runCommand("pnpm verify:zero-impact", ["verify:zero-impact"])
  );

  if (process.env.SEARCHLINT_SKIP_REAL_NEXT_FIXTURES === "1") {
    commandEvidence.push({
      command: "pnpm verify:next-fixtures",
      status: "SKIPPED",
      note: "Skipped only because SEARCHLINT_SKIP_REAL_NEXT_FIXTURES=1."
    });
  } else {
    commandEvidence.push(
      runCommand("pnpm verify:next-fixtures", ["verify:next-fixtures"])
    );
  }

  const analyzerReport = await readJson(analyzerReportPath);
  const sourceMappingReport = await readJson(sourceMappingReportPath);
  const realFixtureReport = await readJson(realFixtureReportPath);

  assert(
    analyzerReport.summary?.status === "PASS",
    "next analyzer acceptance report must pass"
  );
  assert(
    sourceMappingReport.status === "PASS",
    "next source mapping report must pass"
  );
  assert(
    realFixtureReport.fixtures?.every((fixture) => fixture.status === "pass"),
    "real Next fixture report must pass"
  );

  const fixtureRows = buildFixtureRows(realFixtureReport);
  const featureRows = buildFeatureRows(analyzerReport, sourceMappingReport);
  const report = {
    schemaVersion: 1,
    generatedAt: fixedGeneratedAt,
    nodeVersion: process.version,
    status: "PASS",
    policy: {
      next: realFixtureReport.policy.next,
      react: realFixtureReport.policy.react,
      reactDom: realFixtureReport.policy.reactDom,
      pnpm: realFixtureReport.policy.pnpm,
      source: "scripts/verify-real-next-fixtures.mjs packagePolicy"
    },
    summary: {
      fixtureRows: fixtureRows.length,
      featureRows: featureRows.length,
      commands: commandEvidence.length,
      passedCommands: commandEvidence.filter((item) => item.status === "PASS")
        .length,
      skippedCommands: commandEvidence.filter(
        (item) => item.status === "SKIPPED"
      ).length
    },
    commands: commandEvidence,
    fixtures: fixtureRows,
    features: featureRows,
    limitations: [
      "The matrix covers Next.js 15 and 16 only, per OD-003.",
      "CMS/API metadata runtime values are not executed.",
      "Streaming metadata runtime behavior is not covered.",
      "Dynamic redirect/rewrite config execution is not covered.",
      "Middleware runtime behavior is not covered.",
      "Runtime-generated Open Graph and Twitter image rendering is not covered."
    ]
  };

  assert(
    expectedFixtureIds.every((id) => fixtureRows.some((row) => row.id === id)),
    "all expected Next version/router fixture rows must be present"
  );
  assert(
    featureRows.every((row) => row.status === "PASS"),
    "all compatibility feature rows must pass"
  );

  await mkdir(path.dirname(reportPath), { recursive: true });
  await mkdir(path.dirname(samplePath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(samplePath, `${JSON.stringify(report, null, 2)}\n`);
  run("pnpm", ["exec", "prettier", "--write", samplePath]);

  console.log(
    `Next compatibility matrix PASS: fixtures=${fixtureRows.length}, features=${featureRows.length}`
  );
  console.log(`Report: ${path.relative(repoRoot, reportPath)}`);
  console.log(`Sample: ${path.relative(repoRoot, samplePath)}`);
}

function runCommand(label, args) {
  run("pnpm", args, { stdio: "inherit" });
  return {
    command: label,
    status: "PASS"
  };
}

function buildFixtureRows(realFixtureReport) {
  return realFixtureReport.fixtures
    .map((fixture) => ({
      id: fixture.id,
      status: fixture.status === "pass" ? "PASS" : "FAIL",
      nextVersion: fixture.nextVersion,
      router: fixture.router,
      installSource: fixture.install?.source,
      workspaceReferences: fixture.install?.workspaceReferences,
      devStatus: fixture.dev?.status,
      productionStatus: fixture.production?.status,
      productionBundleDelta: fixture.production?.bundle?.clientBundleBytesDelta,
      productionRequests:
        fixture.production?.searchLintRuntime?.productionHttpRequests ?? 0
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
}

function buildFeatureRows(analyzerReport, sourceMappingReport) {
  const analyzerCases = new Set(
    analyzerReport.cases.map((item) => `${item.id}:${item.status}`)
  );
  const sourceMappingProjectIds = new Set(
    sourceMappingReport.projects.map((project) => project.id)
  );
  const sourceMappingCases = new Set(
    sourceMappingReport.projects.flatMap((project) =>
      project.cases.map((item) => `${project.id}:${item.id}:${item.status}`)
    )
  );

  const rows = [
    feature(
      "next15-app-real-fixture",
      "Next 15 App Router real install/dev/build/start",
      "verify:next-fixtures",
      "next15-app"
    ),
    feature(
      "next15-pages-real-fixture",
      "Next 15 Pages Router real install/dev/build/start",
      "verify:next-fixtures",
      "next15-pages"
    ),
    feature(
      "next16-app-real-fixture",
      "Next 16 App Router real install/dev/build/start",
      "verify:next-fixtures",
      "next16-app"
    ),
    feature(
      "next16-pages-real-fixture",
      "Next 16 Pages Router real install/dev/build/start",
      "verify:next-fixtures",
      "next16-pages"
    ),
    analyzerFeature(
      analyzerCases,
      "route-shapes",
      "Root, dynamic, catch-all, optional catch-all, route group, parallel, and intercepting routes",
      "route-model-covers-next-route-shapes"
    ),
    analyzerFeature(
      analyzerCases,
      "metadata-summary",
      "Static metadata, inherited metadata, and dynamic metadata source contributions",
      "metadata-summary-static-inheritance-and-dynamic"
    ),
    analyzerFeature(
      analyzerCases,
      "source-confidence",
      "Exact source locations and related source confidence policy",
      "source-location-confidence-policy"
    ),
    analyzerFeature(
      analyzerCases,
      "redirects-rewrites",
      "Literal Next config redirect and rewrite entries",
      "redirects-and-rewrites-source-signals"
    ),
    analyzerFeature(
      analyzerCases,
      "pages-head",
      "Pages Router next/head source signal",
      "pages-router-head-source-signal"
    ),
    analyzerFeature(
      analyzerCases,
      "middleware-source",
      "Middleware source signal",
      "middleware-source-signal"
    ),
    analyzerFeature(
      analyzerCases,
      "proxy-source",
      "Proxy source signal",
      "proxy-source-signal"
    ),
    analyzerFeature(
      analyzerCases,
      "generated-assets",
      "Open Graph image, Twitter image, robots, sitemap, generateSitemaps, and generateStaticParams source signals",
      "generated-assets-and-special-route-signals"
    ),
    analyzerFeature(
      analyzerCases,
      "source-fixture-kind-coverage",
      "Full source analyzer fixture kind coverage",
      "source-analyzer-fixture-kind-coverage"
    ),
    sourceMappingFeature(
      sourceMappingProjectIds.has("real-app-router-project"),
      "src-app-source-root",
      "App Router source mapping under src/app"
    ),
    sourceMappingFeature(
      sourceMappingProjectIds.has("real-pages-router-project"),
      "src-pages-source-root",
      "Pages Router source mapping under src/pages"
    ),
    sourceMappingFeature(
      sourceMappingCases.has(
        "real-app-router-project:exact-source-lines-resolve-to-file-content:PASS"
      ),
      "typescript-tsx-exact-lines",
      "TypeScript/TSX exact source lines resolve to file content"
    ),
    sourceMappingFeature(
      sourceMappingCases.has(
        "real-pages-router-project:exact-source-lines-resolve-to-file-content:PASS"
      ),
      "pages-tsx-exact-lines",
      "Pages Router TSX exact source lines resolve to file content"
    ),
    sourceMappingFeature(
      sourceMappingCases.has(
        "real-app-router-project:related-source-findings-do-not-fabricate-lines:PASS"
      ) &&
        sourceMappingCases.has(
          "real-pages-router-project:related-source-findings-do-not-fabricate-lines:PASS"
        ),
      "related-source-no-fabricated-lines",
      "Related findings do not fabricate exact line precision"
    )
  ];

  return rows;
}

function feature(id, description, evidenceCommand, fixtureId) {
  return {
    id,
    description,
    evidenceCommand,
    fixtureId,
    status: "PASS"
  };
}

function analyzerFeature(cases, id, description, caseId) {
  return {
    id,
    description,
    evidenceCommand: "pnpm next:acceptance",
    caseId,
    status: cases.has(`${caseId}:PASS`) ? "PASS" : "FAIL"
  };
}

function sourceMappingFeature(condition, id, description) {
  return {
    id,
    description,
    evidenceCommand: "pnpm next:source-mapping",
    status: condition ? "PASS" : "FAIL"
  };
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
