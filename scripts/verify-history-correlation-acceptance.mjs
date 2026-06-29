#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const reportPath = "reports/history-correlation-acceptance-report.json";
const samplePath =
  "docs/examples/history-correlation-acceptance-report.sample.json";

const commands = [
  {
    name: "apiHistoryCorrelationTests",
    command: "pnpm",
    args: [
      "--filter",
      "@searchlint/api",
      "test",
      "--",
      "history-correlation.test.ts"
    ]
  },
  {
    name: "apiBuild",
    command: "pnpm",
    args: ["--filter", "@searchlint/api", "build"]
  },
  {
    name: "dashboardBuild",
    command: "pnpm",
    args: ["--filter", "@searchlint/dashboard", "build"]
  },
  {
    name: "reporterBuild",
    command: "pnpm",
    args: ["--filter", "@searchlint/reporter-html", "build"]
  }
];

async function main() {
  const commandResults = commands.map(runCommand);
  const api = await import(
    pathToFileURL(path.resolve("services/api/dist/src/index.js")).href
  );
  const dashboard = await import(
    pathToFileURL(path.resolve("apps/dashboard/dist/src/index.js")).href
  );
  const reporter = await import(
    pathToFileURL(path.resolve("packages/reporter-html/dist/src/index.js")).href
  );

  const historyCase = verifyHistoryCase(api);
  const dashboardCase = verifyDashboardCase(dashboard.renderDashboardHtml);
  const reportCase = verifyReportCase(reporter.createHtmlReport, historyCase);

  const report = {
    generatedBy: "searchlint-history-correlation-acceptance-verifier",
    generatedAt: "2026-06-22T00:00:00.000Z",
    status: "passed",
    scope: {
      proofType: "deterministic local/static history and correlation proof",
      doesNotClaim: [
        "production history persistence",
        "deployed dashboard history runtime",
        "statistical causal inference",
        "long-term metric rollup storage",
        "live deployment provider integration"
      ]
    },
    commands: commandResults,
    cases: {
      history: historyCase.summary,
      dashboard: dashboardCase,
      report: reportCase
    },
    remainingReleaseGates: [
      "Persist deployment history in production storage.",
      "Persist page snapshot history and artifact references in production storage.",
      "Persist diagnostic and external-observation history rollups for dashboard trend analysis.",
      "Run deployed dashboard timeline and historical report acceptance.",
      "Add production anomaly alerting and analyst review workflow.",
      "Keep all deployment-correlation UI copy explicit that correlation is not causation."
    ]
  };

  assertNoForbiddenSecrets(JSON.stringify(report));
  await mkdir(path.dirname(reportPath), { recursive: true });
  await mkdir(path.dirname(samplePath), { recursive: true });
  await writeJson(reportPath, report);
  await writeJson(samplePath, report);

  console.log(
    `History correlation acceptance PASS: ${Object.keys(report.cases).length}/3 evidence groups passed`
  );
  console.log(`Report: ${reportPath}`);
  console.log(`Sample: ${samplePath}`);
}

function verifyHistoryCase(api) {
  const beforeDiagnostics = [
    diagnostic({
      id: "diag-shared-before",
      fingerprint: "shared",
      severity: "error"
    }),
    diagnostic({
      id: "diag-resolved-before",
      fingerprint: "resolved",
      severity: "blocker"
    })
  ];
  const afterDiagnostics = [
    diagnostic({
      id: "diag-shared-after",
      fingerprint: "shared",
      severity: "error"
    }),
    diagnostic({
      id: "diag-new-after",
      fingerprint: "new",
      severity: "warning"
    })
  ];
  const deployments = [deployment()];
  const pageSnapshots = [snapshot()];
  const externalObservations = [externalObservation()];
  const trends = [
    trendPoint("2026-06-20", 12, 1),
    trendPoint("2026-06-21", 9, 0),
    trendPoint("2026-06-22", 20, 3)
  ];

  const timeline = api.createHistoryTimeline({
    deployments,
    pageSnapshots,
    diagnostics: afterDiagnostics,
    externalObservations
  });
  const comparison = api.compareDiagnosticsBeforeAfter({
    previousLabel: "before deploy",
    currentLabel: "after deploy",
    before: beforeDiagnostics,
    after: afterDiagnostics
  });
  const correlations = api.correlateDeployments({
    deployments,
    beforeDiagnostics,
    afterDiagnostics,
    beforeExternalObservations: [],
    afterExternalObservations: externalObservations,
    windowHours: 24
  });
  const trendSummary = api.summarizeTrends(trends);
  const anomalies = api.detectTrendAnomalies(trends, 5);
  const metricEvents = api.metricEventsFromTrendPoints({
    organizationId: "org-1",
    projectId: "project-1",
    environmentId: "env-1",
    points: trends
  });

  expectEqual(
    timeline.map((event) => event.kind),
    [
      "deployment",
      "page-snapshot",
      "diagnostic",
      "diagnostic",
      "external-observation"
    ]
  );
  expectEqual(comparison.newDiagnostics, 1);
  expectEqual(comparison.resolvedDiagnostics, 1);
  expectEqual(comparison.unchangedDiagnostics, 1);
  expectEqual(correlations[0].relation, "correlated-not-causal");
  requireIncludes(correlations[0].summary, "correlation, not causation");
  expectEqual(trendSummary.direction, "worsening");
  expectEqual(anomalies[0].metric, "diagnostics");
  expectEqual(metricEvents.length, 15);

  return {
    deployments,
    pageSnapshots,
    beforeDiagnostics,
    afterDiagnostics,
    externalObservations,
    trends,
    summary: {
      timelineEventKinds: timeline.map((event) => event.kind),
      timelineSubjects: timeline.map((event) => event.subject),
      comparison,
      correlations,
      trendSummary,
      anomalies,
      metricEventNames: metricEvents.map((event) => event.name)
    }
  };
}

function verifyDashboardCase(renderDashboardHtml) {
  const html = renderDashboardHtml({
    organization: {
      id: "org-1",
      name: "Acme"
    },
    project: {
      id: "project-1",
      name: "Example",
      siteUrl: "https://example.test"
    },
    environment: {
      id: "env-1",
      name: "Production",
      baseUrl: "https://example.test"
    },
    diagnostics: [
      diagnostic({
        id: "diag-new-after",
        fingerprint: "new",
        severity: "warning"
      })
    ],
    crawlRuns: [
      {
        id: "crawl-1",
        status: "succeeded",
        requestedAt: "2026-06-22T00:05:00.000Z",
        finishedAt: "2026-06-22T00:08:00.000Z",
        crawledUrls: 128,
        failedUrls: 0
      }
    ],
    trends: [
      {
        date: "2026-06-20",
        diagnostics: 12,
        blockers: 1,
        errors: 2,
        warnings: 9,
        infos: 0
      },
      {
        date: "2026-06-22",
        diagnostics: 20,
        blockers: 3,
        errors: 4,
        warnings: 13,
        infos: 0
      }
    ],
    externalObservations: [
      {
        id: "obs-1",
        provider: "google",
        subjectUrl: "https://example.test/products/widget",
        status: "fresh",
        observedAt: "2026-06-22T00:30:00.000Z",
        fetchedAt: "2026-06-22T00:35:00.000Z",
        summary: "Search Analytics after deploy"
      }
    ],
    reports: [
      {
        id: "history-report-1",
        title: "Deployment history report",
        generatedAt: "2026-06-22T01:00:00.000Z",
        locale: "en",
        totalDiagnostics: 2
      }
    ],
    quotas: [],
    teamMembers: []
  });
  requireIncludes(html, "2026-06-22");
  requireIncludes(html, "Deployment history report");
  requireIncludes(html, "Search Analytics after deploy");
  return {
    rendered: true,
    includesTrendDate: html.includes("2026-06-22"),
    includesHistoricalReport: html.includes("Deployment history report"),
    includesExternalObservation: html.includes("Search Analytics after deploy")
  };
}

function verifyReportCase(createHtmlReport, historyCase) {
  const comparison = historyCase.summary.comparison;
  const deploymentRecord = historyCase.deployments[0];
  const html = createHtmlReport(historyCase.afterDiagnostics, {
    reportVariant: "deployment",
    comparison,
    deployment: {
      deploymentId: deploymentRecord.deploymentId,
      commitRef: deploymentRecord.commitRef,
      deployedAt: deploymentRecord.deployedAt,
      environmentName: deploymentRecord.environmentName,
      status: "released"
    },
    externalObservations: historyCase.externalObservations
  });
  requireIncludes(html, "Before / After Comparison");
  requireIncludes(html, "Deployment Report");
  requireIncludes(html, "deploy-1");
  requireIncludes(html, "abc123");
  requireIncludes(html, "Resolved diagnostics");
  requireIncludes(html, "google.searchAnalytics");
  return {
    rendered: true,
    includesBeforeAfter: html.includes("Before / After Comparison"),
    includesDeployment: html.includes("Deployment Report"),
    includesCommitRef: html.includes("abc123"),
    includesExternalObservation: html.includes("google.searchAnalytics")
  };
}

function deployment() {
  return {
    id: "history-deployment-1",
    organizationId: "org-1",
    projectId: "project-1",
    environmentId: "env-1",
    deploymentId: "deploy-1",
    commitRef: "abc123",
    deployedAt: "2026-06-22T00:00:00.000Z",
    environmentName: "production",
    status: "released",
    annotations: ["search templates changed"]
  };
}

function snapshot() {
  return {
    id: "snapshot-1",
    organizationId: "org-1",
    projectId: "project-1",
    environmentId: "env-1",
    pageUrl: "https://example.test/products/widget",
    capturedAt: "2026-06-22T00:10:00.000Z",
    artifactUri: "s3://searchlint-artifacts/snapshots/snapshot-1.json",
    diagnosticFingerprints: ["shared", "new"]
  };
}

function diagnostic(overrides = {}) {
  return {
    id: "diag-1",
    organizationId: "org-1",
    projectId: "project-1",
    environmentId: "env-1",
    ruleId: "SL-META-001",
    severity: "warning",
    confidence: "certain",
    pageUrl: "https://example.test/products/widget",
    source: "source-code",
    title: "Diagnostic title",
    evidence: "Diagnostic evidence",
    observedAt: "2026-06-22T00:20:00.000Z",
    fingerprint: "shared",
    deletionState: "active",
    createdAt: "2026-06-22T00:20:00.000Z",
    ...overrides
  };
}

function externalObservation(overrides = {}) {
  return {
    id: "obs-1",
    organizationId: "org-1",
    projectId: "project-1",
    environmentId: "env-1",
    provider: "google",
    source: "google.searchAnalytics",
    subjectUrl: "https://example.test/products/widget",
    observedAt: "2026-06-22T00:30:00.000Z",
    fetchedAt: "2026-06-22T00:35:00.000Z",
    freshness: "fresh",
    payload: {
      clicks: 42,
      impressions: 1200
    },
    sampling: {
      sampled: false
    },
    fingerprint:
      "google:org-1:project-1:env-1:google.searchAnalytics:https://example.test/products/widget",
    deletionState: "active",
    createdAt: "2026-06-22T00:35:00.000Z",
    ...overrides
  };
}

function trendPoint(date, diagnostics, blockers) {
  return {
    date,
    diagnostics,
    blockers,
    errors: Math.max(0, diagnostics - blockers - 3),
    warnings: 3,
    infos: 0
  };
}

function runCommand(commandSpec) {
  const result = spawnSync(commandSpec.command, commandSpec.args, {
    cwd: process.cwd(),
    env: process.env,
    encoding: "utf8",
    stdio: "pipe"
  });
  if (result.status !== 0) {
    process.stderr.write(result.stdout);
    process.stderr.write(result.stderr);
    throw new Error(
      `${commandSpec.name} failed with exit code ${result.status ?? "unknown"}.`
    );
  }
  return {
    name: commandSpec.name,
    command: [commandSpec.command, ...commandSpec.args].join(" "),
    status: "passed",
    stdout: summarizeOutput(result.stdout)
  };
}

function summarizeOutput(output) {
  return output
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line !== "")
    .filter((line) => !line.startsWith("RUN "))
    .filter((line) => !line.startsWith("Start at "))
    .filter((line) => !line.startsWith("Duration "))
    .filter((line) => !line.startsWith("$ "))
    .slice(-8);
}

function expectEqual(actual, expected) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}.`
    );
  }
}

function requireIncludes(value, expected) {
  if (!value.includes(expected)) {
    throw new Error(`Expected output to include ${expected}.`);
  }
}

function assertNoForbiddenSecrets(value) {
  for (const forbidden of ["authorization-code", "client-secret"]) {
    if (value.includes(forbidden)) {
      throw new Error(
        `History correlation acceptance report contains forbidden ${forbidden}.`
      );
    }
  }
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

await main();
