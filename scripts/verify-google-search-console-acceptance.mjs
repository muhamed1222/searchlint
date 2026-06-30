#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const reportPath = "reports/google-search-console-acceptance-report.json";
const samplePath =
  "docs/examples/google-search-console-acceptance-report.sample.json";

const commands = [
  {
    name: "apiGoogleProviderTests",
    command: "pnpm",
    args: [
      "--filter",
      "@searchlint/api",
      "test",
      "--",
      "google-provider-adapter.test.ts"
    ]
  },
  {
    name: "workerProviderCollectorTests",
    command: "pnpm",
    args: [
      "--filter",
      "@searchlint/workers",
      "test",
      "--",
      "external-observation-provider-collectors.test.ts",
      "external-observation-collection-worker.test.ts"
    ]
  },
  {
    name: "apiBuild",
    command: "pnpm",
    args: ["--filter", "@searchlint/api", "build"]
  },
  {
    name: "workersBuild",
    command: "pnpm",
    args: ["--filter", "@searchlint/workers", "build"]
  },
  {
    name: "dashboardBuild",
    command: "pnpm",
    args: ["--filter", "@searchlint/dashboard...", "build"]
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
  const workers = await import(
    pathToFileURL(path.resolve("services/workers/dist/src/index.js")).href
  );
  const dashboard = await import(
    pathToFileURL(path.resolve("apps/dashboard/dist/src/index.js")).href
  );
  const reporter = await import(
    pathToFileURL(path.resolve("packages/reporter-html/dist/src/index.js")).href
  );

  const adapterCase = await verifyAdapterCase(api.createGoogleProviderAdapter);
  const workerCase = await verifyWorkerCase({
    createGoogleProviderAdapter: api.createGoogleProviderAdapter,
    collectExternalObservationsBatch: workers.collectExternalObservationsBatch,
    createGoogleExternalObservationCollector:
      workers.createGoogleExternalObservationCollector
  });
  const dashboardCase = verifyDashboardCase(
    dashboard.renderDashboardHtml,
    workerCase.records
  );
  const reportCase = verifyReportCase(
    reporter.createHtmlReport,
    workerCase.records
  );

  const report = {
    generatedBy: "searchlint-google-search-console-acceptance-verifier",
    generatedAt: "2026-06-22T00:00:00.000Z",
    status: "passed",
    scope: {
      proofType: "deterministic local/static Google Search Console proof",
      doesNotClaim: [
        "live Google OAuth app verification",
        "live Search Console property ownership",
        "live URL Inspection quota acceptance",
        "live Search Analytics data",
        "live sitemap fetch from Google",
        "PageSpeed or CrUX acceptance"
      ]
    },
    commands: commandResults,
    cases: {
      adapter: adapterCase.summary,
      worker: workerCase.summary,
      dashboard: dashboardCase,
      report: reportCase
    },
    remainingReleaseGates: [
      "Configure the real Google OAuth app and approved redirect URIs.",
      "Connect real Search Console properties for target sites.",
      "Run live Search Analytics acceptance with real clicks, impressions, CTR, and average position.",
      "Run live URL Inspection acceptance with last crawl, Google canonical, user canonical, coverage, and rich-result observations.",
      "Run live sitemap status acceptance.",
      "Verify Google API quota, retry/backoff, and stale-state behavior against production credentials.",
      "Verify dashboard connector status and settings against live Google credentials."
    ]
  };

  assertNoForbiddenSecrets(JSON.stringify(report));
  await mkdir(path.dirname(reportPath), { recursive: true });
  await mkdir(path.dirname(samplePath), { recursive: true });
  await writeJson(reportPath, report);
  await writeJson(samplePath, report);

  console.log(
    `Google Search Console acceptance PASS: ${Object.keys(report.cases).length}/4 evidence groups passed`
  );
  console.log(`Report: ${reportPath}`);
  console.log(`Sample: ${samplePath}`);
}

async function verifyAdapterCase(createGoogleProviderAdapter) {
  const fetch = new RecordingGoogleFetch([
    googleResponse(urlInspectionPayload()),
    googleResponse(searchAnalyticsPayload()),
    googleResponse(sitemapPayload())
  ]);
  const adapter = createGoogleProviderAdapter({
    fetch: fetch.fetch,
    endpointBaseUrl: "https://google.test"
  });
  const scope = googleScope();
  const urlInspection = await adapter.inspectUrl({
    ...scope,
    subjectUrl: "https://example.test/products/widget"
  });
  const searchAnalytics = await adapter.querySearchAnalytics({
    ...scope,
    subjectUrl: "https://example.test/products/widget",
    startDate: "2026-06-01",
    endDate: "2026-06-20",
    dimensions: ["page", "query"]
  });
  const sitemap = await adapter.getSitemap({
    ...scope,
    sitemapUrl: "https://example.test/sitemap.xml"
  });

  expectEqual(
    fetch.requests.map((request) => request.method),
    ["POST", "POST", "GET"]
  );
  expectEqual(
    fetch.requests[0].url,
    "https://google.test/v1/urlInspection/index:inspect"
  );
  expectEqual(JSON.parse(fetch.requests[0].body), {
    inspectionUrl: "https://example.test/products/widget",
    siteUrl: "sc-domain:example.test"
  });
  expectEqual(JSON.parse(fetch.requests[1].body).dimensions, ["page", "query"]);
  expectEqual(urlInspection.source, "google.urlInspection");
  expectEqual(searchAnalytics.source, "google.searchAnalytics");
  expectEqual(sitemap.source, "google.sitemap");
  expectEqual(
    urlInspection.payload.inspectionResult.indexStatusResult.lastCrawlTime,
    "2026-06-20T12:34:56.000Z"
  );
  expectEqual(
    urlInspection.payload.inspectionResult.indexStatusResult.googleCanonical,
    "https://example.test/products/widget"
  );
  expectEqual(
    urlInspection.payload.inspectionResult.indexStatusResult.userCanonical,
    "https://example.test/products/widget"
  );
  expectEqual(
    urlInspection.payload.inspectionResult.richResultsResult.verdict,
    "PASS"
  );
  expectEqual(searchAnalytics.payload.rows[0].clicks, 42);
  expectEqual(searchAnalytics.payload.rows[0].impressions, 1200);
  expectEqual(searchAnalytics.payload.rows[0].ctr, 0.035);
  expectEqual(searchAnalytics.payload.rows[0].position, 8.4);

  return {
    records: [urlInspection, searchAnalytics, sitemap],
    summary: {
      requestMethods: fetch.requests.map((request) => request.method),
      sources: [urlInspection.source, searchAnalytics.source, sitemap.source],
      urlInspection: {
        coverageState:
          urlInspection.payload.inspectionResult.indexStatusResult
            .coverageState,
        lastCrawlTime:
          urlInspection.payload.inspectionResult.indexStatusResult
            .lastCrawlTime,
        googleCanonical:
          urlInspection.payload.inspectionResult.indexStatusResult
            .googleCanonical,
        userCanonical:
          urlInspection.payload.inspectionResult.indexStatusResult
            .userCanonical,
        richResultsVerdict:
          urlInspection.payload.inspectionResult.richResultsResult.verdict
      },
      searchAnalyticsMetrics: {
        clicks: searchAnalytics.payload.rows[0].clicks,
        impressions: searchAnalytics.payload.rows[0].impressions,
        ctr: searchAnalytics.payload.rows[0].ctr,
        position: searchAnalytics.payload.rows[0].position
      },
      sitemap: {
        path: sitemap.payload.path,
        isPending: sitemap.payload.isPending,
        warnings: sitemap.payload.warnings,
        errors: sitemap.payload.errors
      },
      quota: urlInspection.quota,
      freshness: [
        urlInspection.freshness,
        searchAnalytics.freshness,
        sitemap.freshness
      ]
    }
  };
}

async function verifyWorkerCase(input) {
  const fetch = new RecordingGoogleFetch([
    googleResponse(urlInspectionPayload()),
    googleResponse(searchAnalyticsPayload()),
    googleResponse(sitemapPayload())
  ]);
  const adapter = input.createGoogleProviderAdapter({
    fetch: fetch.fetch,
    endpointBaseUrl: "https://google.test"
  });
  const collector = input.createGoogleExternalObservationCollector({
    adapter,
    targetResolver: {
      google() {
        return [
          {
            kind: "url-inspection",
            subjectUrl: "https://example.test/products/widget"
          },
          {
            kind: "search-analytics",
            subjectUrl: "https://example.test/products/widget",
            startDate: "2026-06-01",
            endDate: "2026-06-20",
            dimensions: ["page", "query"]
          },
          {
            kind: "sitemap",
            sitemapUrl: "https://example.test/sitemap.xml"
          }
        ];
      }
    }
  });
  const oauthConnections = new RecordingOAuthConnectionStore([
    googleConnection()
  ]);
  const externalObservations = new RecordingExternalObservationStore();
  const vault = new RecordingVault({
    "secret://org-1/google/access-token": "google-access-token"
  });

  const batch = await input.collectExternalObservationsBatch({
    oauthConnections,
    externalObservations,
    vault,
    collectors: {
      google: collector,
      yandex: {
        async collectExternalObservations() {
          throw new Error("Yandex collector should not be called.");
        }
      }
    },
    now: "2026-06-21T00:00:00.000Z",
    provider: "google",
    limit: 5
  });

  expectEqual(batch, {
    selected: 1,
    collected: 3,
    stored: 3,
    failed: 0,
    skipped: 0
  });
  expectEqual(vault.reads, [
    {
      organizationId: "org-1",
      secretRef: "secret://org-1/google/access-token"
    }
  ]);
  expectEqual(
    externalObservations.records.map((record) => record.source),
    ["google.urlInspection", "google.searchAnalytics", "google.sitemap"]
  );
  for (const record of externalObservations.records) {
    expectEqual(record.organizationId, "org-1");
    expectEqual(record.projectId, "project-1");
    expectEqual(record.environmentId, "env-1");
    if (!record.fingerprint.startsWith("google:org-1:project-1:env-1:")) {
      throw new Error(`Unexpected Google fingerprint ${record.fingerprint}.`);
    }
  }

  return {
    records: externalObservations.records,
    summary: {
      batch,
      selectedProvider: oauthConnections.selections[0].provider,
      vaultReads: vault.reads.length,
      storedSources: externalObservations.records.map(
        (record) => record.source
      ),
      fingerprints: externalObservations.records.map(
        (record) => record.fingerprint
      )
    }
  };
}

function verifyDashboardCase(renderDashboardHtml, records) {
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
    diagnostics: [],
    crawlRuns: [],
    trends: [],
    externalObservations: records.map(dashboardObservation),
    reports: [],
    quotas: [],
    teamMembers: []
  });
  requireIncludes(html, "Submitted and indexed");
  requireIncludes(html, "42 clicks, 1200 impressions");
  requireIncludes(html, "https://example.test/products/widget");
  return {
    rendered: true,
    includesUrlInspectionSummary: html.includes("Submitted and indexed"),
    includesSearchAnalyticsSummary: html.includes(
      "42 clicks, 1200 impressions"
    ),
    includesSitemapSummary: html.includes(
      "Sitemap https://example.test/sitemap.xml"
    )
  };
}

function dashboardObservation(record) {
  return {
    id: record.id,
    provider: record.provider,
    subjectUrl: record.subjectUrl,
    status: record.freshness === "fresh" ? "fresh" : "stale",
    observedAt: record.observedAt,
    fetchedAt: record.fetchedAt,
    summary: googleObservationSummary(record)
  };
}

function googleObservationSummary(record) {
  if (record.source === "google.urlInspection") {
    return record.payload.inspectionResult.indexStatusResult.coverageState;
  }
  if (record.source === "google.searchAnalytics") {
    const row = record.payload.rows[0];
    return `${row.clicks} clicks, ${row.impressions} impressions, CTR ${row.ctr}, position ${row.position}`;
  }
  if (record.source === "google.sitemap") {
    return `Sitemap ${record.payload.path}: ${record.payload.errors} errors, ${record.payload.warnings} warnings.`;
  }
  return record.source;
}

function verifyReportCase(createHtmlReport, records) {
  const html = createHtmlReport([], {
    reportVariant: "google",
    externalObservations: records
  });
  requireIncludes(html, "Google / Yandex Report");
  requireIncludes(html, "google.urlInspection");
  requireIncludes(html, "Submitted and indexed");
  requireIncludes(html, "42");
  requireIncludes(html, "1200");
  return {
    rendered: true,
    includesUrlInspection: html.includes("google.urlInspection"),
    includesSearchAnalytics: html.includes("google.searchAnalytics"),
    includesSitemap: html.includes("google.sitemap")
  };
}

function googleScope() {
  return {
    organizationId: "org-1",
    projectId: "project-1",
    environmentId: "env-1",
    accessToken: "google-access-token",
    siteUrl: "sc-domain:example.test",
    fetchedAt: "2026-06-21T00:00:00.000Z",
    retentionUntil: "2026-07-21T00:00:00.000Z"
  };
}

function googleConnection() {
  return {
    id: "google-connection-1",
    organizationId: "org-1",
    projectId: "project-1",
    environmentId: "env-1",
    provider: "google",
    providerAccountId: "sc-domain:example.test",
    scopes: [
      "https://www.googleapis.com/auth/webmasters.readonly",
      "https://www.googleapis.com/auth/indexing"
    ],
    accessTokenSecretRef: "secret://org-1/google/access-token",
    refreshTokenSecretRef: "secret://org-1/google/refresh-token",
    status: "active",
    nextRefreshAt: "2026-06-21T00:00:00.000Z",
    createdAt: "2026-06-20T00:00:00.000Z"
  };
}

function urlInspectionPayload() {
  return {
    inspectionResult: {
      inspectionResultLink: "https://search.google.com/search-console/inspect",
      indexStatusResult: {
        verdict: "PASS",
        coverageState: "Submitted and indexed",
        robotsTxtState: "ALLOWED",
        indexingState: "INDEXING_ALLOWED",
        lastCrawlTime: "2026-06-20T12:34:56.000Z",
        pageFetchState: "SUCCESSFUL",
        googleCanonical: "https://example.test/products/widget",
        userCanonical: "https://example.test/products/widget"
      },
      richResultsResult: {
        verdict: "PASS",
        detectedItems: [
          {
            richResultType: "Product",
            items: [{ name: "Widget" }]
          }
        ]
      }
    }
  };
}

function searchAnalyticsPayload() {
  return {
    rows: [
      {
        keys: ["https://example.test/products/widget", "widget"],
        clicks: 42,
        impressions: 1200,
        ctr: 0.035,
        position: 8.4
      }
    ],
    responseAggregationType: "byPage"
  };
}

function sitemapPayload() {
  return {
    path: "https://example.test/sitemap.xml",
    lastSubmitted: "2026-06-19T10:00:00.000Z",
    lastDownloaded: "2026-06-20T10:00:00.000Z",
    isPending: false,
    isSitemapsIndex: false,
    type: "web",
    warnings: "0",
    errors: "0"
  };
}

function googleResponse(payload) {
  return {
    ok: true,
    status: 200,
    headers: {
      get(name) {
        return (
          {
            "x-ratelimit-limit": "2000",
            "x-ratelimit-remaining": "1997",
            "x-ratelimit-reset": "2026-06-22T00:00:00.000Z"
          }[name.toLowerCase()] ?? null
        );
      }
    },
    async json() {
      return payload;
    }
  };
}

class RecordingGoogleFetch {
  requests = [];

  constructor(responses) {
    this.responses = [...responses];
  }

  fetch = async (url, init) => {
    this.requests.push({
      url,
      method: init.method,
      headers: init.headers,
      body: init.body
    });
    const response = this.responses.shift();
    if (response === undefined) {
      throw new Error(`Unexpected Google request ${url}.`);
    }
    return response;
  };
}

class RecordingOAuthConnectionStore {
  selections = [];

  constructor(connections) {
    this.connections = connections;
  }

  async upsertOAuthConnection(input) {
    return input;
  }

  async getOAuthConnection() {
    return undefined;
  }

  async selectOAuthConnectionsDueForRefresh(input) {
    this.selections.push(input);
    return this.connections.filter(
      (connection) =>
        input.provider === undefined || connection.provider === input.provider
    );
  }

  async markOAuthConnectionRevoked() {
    return undefined;
  }
}

class RecordingExternalObservationStore {
  records = [];

  async upsertExternalObservation(input) {
    this.records.push(input);
    return input;
  }

  async selectExternalObservations() {
    return this.records;
  }
}

class RecordingVault {
  reads = [];

  constructor(secrets) {
    this.secrets = secrets;
  }

  async getSecret(input) {
    this.reads.push(input);
    const value = this.secrets[input.secretRef];
    if (value === undefined) {
      throw new Error(`Missing secret ${input.secretRef}.`);
    }
    return { value };
  }
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
  for (const forbidden of [
    "google-access-token",
    "google-refresh-token",
    "authorization-code",
    "client-secret"
  ]) {
    if (value.includes(forbidden)) {
      throw new Error(
        `Google acceptance report contains forbidden ${forbidden}.`
      );
    }
  }
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

await main();
