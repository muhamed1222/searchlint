#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { format } from "prettier";

const realFixtureReportPath = "reports/next-fixture-zero-impact-report.json";
const reportPath = "reports/zero-production-impact-final-report.json";
const samplePath =
  "docs/examples/zero-production-impact-final-report.sample.json";

const expectedFixtureIds = [
  "next15-app",
  "next15-pages",
  "next16-app",
  "next16-pages"
];

const prerequisiteCommands = [
  command("zeroImpactShape", "pnpm", ["verify:zero-impact"]),
  command("realNextFixtures", "pnpm", ["verify:next-fixtures"])
];

async function main() {
  const commands = prerequisiteCommands.map(runCommand);
  const realFixtureReport = JSON.parse(
    await readFile(realFixtureReportPath, "utf8")
  );
  const fixtures = summarizeFixtures(realFixtureReport);
  assertFixtureCoverage(fixtures);

  const report = {
    generatedBy: "searchlint-zero-production-impact-final-verifier",
    generatedAt: "2026-06-23T00:00:00.000Z",
    status: "passed",
    scope: {
      proofType: "deterministic zero production impact final gate",
      closesMasterChecklistItem: "Zero production impact подтверждён",
      fixtureSource: realFixtureReportPath,
      doesNotClaim: [
        "packages downloaded from the public npm registry",
        "Next.js versions outside the approved OD-003 matrix",
        "cloud/dashboard production E2E",
        "SearchLint 1.0 final release approval"
      ]
    },
    policy: {
      next: realFixtureReport.policy?.next,
      react: realFixtureReport.policy?.react,
      reactDom: realFixtureReport.policy?.reactDom,
      pnpm: realFixtureReport.policy?.pnpm,
      installSource: "pnpm pack tarballs"
    },
    commands,
    summary: {
      fixtureCount: fixtures.length,
      passedFixtureCount: fixtures.filter(
        (fixture) => fixture.status === "pass"
      ).length,
      clientBundleBytesDelta: sum(fixtures, "clientBundleBytesDelta"),
      searchLintClientModuleCount: sum(fixtures, "clientSearchLintModuleCount"),
      searchLintServerModuleCount: sum(fixtures, "serverSearchLintModuleCount"),
      productionRequestDelta: sum(fixtures, "requestDelta"),
      searchLintRequestCount: sum(fixtures, "searchLintRequestCount"),
      domDelta: sum(fixtures, "domDelta"),
      globalsDelta: sum(fixtures, "globalsDelta"),
      hookDelta: sum(fixtures, "hookDelta"),
      observerDelta: sum(fixtures, "observerDelta"),
      routeHtmlChangedCount: fixtures.filter((fixture) =>
        Boolean(fixture.routeHtmlChanged)
      ).length,
      headersChangedCount: fixtures.filter((fixture) =>
        Boolean(fixture.headersChanged)
      ).length
    },
    fixtures,
    assertions: [
      "SearchLint injects the dev client only in development.",
      "SearchLint-enabled production config matches the clean production config.",
      "Packed public package candidates install into clean fixture projects.",
      "Production client chunks contain 0 SearchLint bytes and 0 SearchLint modules.",
      "Production server chunks contain 0 SearchLint modules.",
      "Production browser requests have 0 SearchLint request delta.",
      "Production runtime has 0 SearchLint DOM nodes, globals, listeners, and observers.",
      "Normalized route HTML and headers are unchanged."
    ]
  };

  assertZeroSummary(report.summary);
  assertNoSensitiveValues(JSON.stringify(report));
  await mkdir(path.dirname(reportPath), { recursive: true });
  await mkdir(path.dirname(samplePath), { recursive: true });
  await writeJson(reportPath, report);
  await writeJson(samplePath, report);

  console.log(
    `Zero production impact final gate PASS: ${fixtures.length}/${fixtures.length} Next fixtures verified`
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

function summarizeFixtures(realFixtureReport) {
  if (!Array.isArray(realFixtureReport.fixtures)) {
    throw new Error("Real Next fixture report does not contain fixtures.");
  }
  return realFixtureReport.fixtures
    .map((fixture) => {
      const comparison = fixture.production?.comparison ?? {};
      const runtime = comparison.enabledRuntime ?? {};
      const hooks = runtime.hooks ?? {};
      const summary = {
        id: fixture.id,
        status: fixture.status,
        nextVersion: fixture.nextVersion,
        router: fixture.router,
        installSource: fixture.install?.source,
        workspaceReferences: fixture.install?.workspaceReferences,
        devStatus: fixture.dev?.status,
        productionStatus: fixture.production?.status,
        rawClientBundleBytesDelta: comparison.rawClientBundleBytesDelta ?? null,
        clientBundleBytesDelta: comparison.clientBundleBytesDelta ?? null,
        clientChunksChanged: comparison.clientChunksChanged ?? null,
        clientSearchLintModuleCount:
          comparison.clientSearchLintModules?.length ?? null,
        cssChanged: comparison.cssChanged ?? null,
        manifestsChanged: comparison.manifestsChanged ?? null,
        serverSearchLintModuleCount:
          comparison.serverSearchLintModules?.length ?? null,
        routeHtmlChanged: comparison.routeHtmlChanged ?? null,
        headersChanged: comparison.headersChanged ?? null,
        requestDelta: comparison.requestDelta ?? null,
        searchLintRequestCount: comparison.searchLintRequests?.length ?? null,
        domDelta: comparison.domDelta ?? null,
        globalsDelta: comparison.globalsDelta ?? null,
        hookDelta: comparison.hookDelta ?? null,
        observerDelta: comparison.observerDelta ?? null,
        enabledSearchLintDomElements: runtime.searchLintDomElements ?? null,
        enabledSearchLintGlobalCount: runtime.searchLintGlobals?.length ?? null,
        enabledSearchLintHookTotal: hooks.searchLintTotal ?? null,
        enabledSearchLintObserverTotal: hooks.searchLintObservers ?? null
      };
      assertFixtureZeroImpact(summary);
      return summary;
    })
    .sort((left, right) => left.id.localeCompare(right.id));
}

function assertFixtureCoverage(fixtures) {
  for (const id of expectedFixtureIds) {
    if (!fixtures.some((fixture) => fixture.id === id)) {
      throw new Error(`Missing required zero-impact fixture ${id}.`);
    }
  }
}

function assertFixtureZeroImpact(fixture) {
  const expected = {
    status: "pass",
    workspaceReferences: "absent",
    devStatus: "pass",
    productionStatus: "pass",
    clientBundleBytesDelta: 0,
    clientChunksChanged: false,
    clientSearchLintModuleCount: 0,
    cssChanged: false,
    manifestsChanged: false,
    serverSearchLintModuleCount: 0,
    routeHtmlChanged: false,
    headersChanged: false,
    requestDelta: 0,
    searchLintRequestCount: 0,
    domDelta: 0,
    globalsDelta: 0,
    hookDelta: 0,
    observerDelta: 0,
    enabledSearchLintDomElements: 0,
    enabledSearchLintGlobalCount: 0,
    enabledSearchLintHookTotal: 0,
    enabledSearchLintObserverTotal: 0
  };
  for (const [field, value] of Object.entries(expected)) {
    if (fixture[field] !== value) {
      throw new Error(
        `${fixture.id} zero-impact field ${field} expected ${JSON.stringify(
          value
        )}, received ${JSON.stringify(fixture[field])}.`
      );
    }
  }
}

function assertZeroSummary(summary) {
  for (const [field, value] of Object.entries(summary)) {
    if (
      field.endsWith("Count") &&
      ["fixtureCount", "passedFixtureCount"].includes(field)
    ) {
      continue;
    }
    if (field === "passedFixtureCount") {
      continue;
    }
    if (field === "fixtureCount") {
      continue;
    }
    if (value !== 0) {
      throw new Error(
        `Expected zero summary field ${field}, received ${value}.`
      );
    }
  }
  if (summary.fixtureCount !== expectedFixtureIds.length) {
    throw new Error(
      `Expected ${expectedFixtureIds.length} fixtures, received ${summary.fixtureCount}.`
    );
  }
  if (summary.passedFixtureCount !== summary.fixtureCount) {
    throw new Error("Not all zero-impact fixtures passed.");
  }
}

function sum(fixtures, field) {
  return fixtures.reduce((total, fixture) => total + Number(fixture[field]), 0);
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
      `Sensitive value leaked into zero-impact final evidence: ${match}`
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
