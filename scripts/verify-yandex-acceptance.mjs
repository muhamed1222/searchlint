#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { format } from "prettier";

const reportPath = "reports/yandex-acceptance-report.json";
const samplePath = "docs/examples/yandex-acceptance-report.sample.json";

const commands = [
  {
    name: "apiYandexProviderTests",
    command: "pnpm",
    args: [
      "--filter",
      "@searchlint/api",
      "test",
      "--",
      "yandex-provider-adapter.test.ts"
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
      "external-observation-provider-collectors.test.ts"
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

  const adapterCase = await verifyAdapterCase(api.createYandexProviderAdapter);
  const workerCase = await verifyWorkerCase({
    createYandexProviderAdapter: api.createYandexProviderAdapter,
    collectExternalObservationsBatch: workers.collectExternalObservationsBatch,
    createYandexExternalObservationCollector:
      workers.createYandexExternalObservationCollector
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
    generatedBy: "searchlint-yandex-acceptance-verifier",
    generatedAt: "2026-06-22T00:00:00.000Z",
    status: "passed",
    scope: {
      proofType:
        "deterministic local/static Yandex Webmaster and Metrica proof",
      doesNotClaim: [
        "live Yandex OAuth app setup",
        "live Yandex Webmaster site connection",
        "live Yandex Metrica counter connection",
        "exact live Yandex endpoint conformance",
        "live Yandex quota acceptance",
        "live dashboard connector status"
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
      "Configure the real Yandex OAuth application and approved redirect URIs.",
      "Connect real Yandex Webmaster sites and Metrica counters.",
      "Run live Webmaster URL status acceptance for indexing state, searchable status, exclusion reasons, last crawl, HTTP status, important URLs, and diagnostics.",
      "Run live Webmaster sitemap status acceptance.",
      "Run live Metrica acceptance for organic traffic, landing pages, sources, visits, bounce rate, conversions, goal data, and sampling.",
      "Verify Yandex API quota, retry/backoff, and stale-state behavior against production credentials.",
      "Verify dashboard connector status and settings against live Yandex credentials."
    ]
  };

  assertNoForbiddenSecrets(JSON.stringify(report));
  await mkdir(path.dirname(reportPath), { recursive: true });
  await mkdir(path.dirname(samplePath), { recursive: true });
  await writeJson(reportPath, report);
  await writeJson(samplePath, report);

  console.log(
    `Yandex acceptance PASS: ${Object.keys(report.cases).length}/4 evidence groups passed`
  );
  console.log(`Report: ${reportPath}`);
  console.log(`Sample: ${samplePath}`);
}

async function verifyAdapterCase(createYandexProviderAdapter) {
  const fetch = new RecordingYandexFetch([
    yandexResponse(webmasterUrlStatusPayload()),
    yandexResponse(webmasterSitemapPayload()),
    yandexResponse(metricaLandingPagePayload()),
    yandexResponse({ sampled: false, data: [] })
  ]);
  const adapter = createYandexProviderAdapter({
    fetch: fetch.fetch,
    endpointBaseUrl: "https://yandex.test"
  });
  const scope = yandexScope();
  const urlStatus = await adapter.getUrlStatus({
    ...scope,
    subjectUrl: "https://example.test/products/widget"
  });
  const sitemap = await adapter.getSitemap({
    ...scope,
    sitemapUrl: "https://example.test/sitemap.xml"
  });
  const metrica = await adapter.queryMetricaLandingPage({
    ...scope,
    counterId: "counter-1",
    subjectUrl: "https://example.test/products/widget",
    startDate: "2026-06-01",
    endDate: "2026-06-20",
    metrics: [
      "ym:s:visits",
      "ym:s:bounceRate",
      "ym:s:goal123reaches",
      "ym:s:goal123conversionRate"
    ]
  });
  await adapter.queryMetricaLandingPage({
    ...scope,
    counterId: "counter-1",
    subjectUrl: "https://example.test/owner's\\page",
    startDate: "2026-06-01",
    endDate: "2026-06-20"
  });

  expectEqual(
    fetch.requests.map((request) => request.method),
    ["GET", "GET", "POST", "POST"]
  );
  expectEqual(
    fetch.requests[0].url,
    "https://yandex.test/webmaster/v1/hosts/host-1/url-status?url=https%3A%2F%2Fexample.test%2Fproducts%2Fwidget"
  );
  expectEqual(
    fetch.requests[1].url,
    "https://yandex.test/webmaster/v1/hosts/host-1/sitemaps/https%3A%2F%2Fexample.test%2Fsitemap.xml"
  );
  expectEqual(JSON.parse(fetch.requests[2].body), {
    date1: "2026-06-01",
    date2: "2026-06-20",
    metrics: [
      "ym:s:visits",
      "ym:s:bounceRate",
      "ym:s:goal123reaches",
      "ym:s:goal123conversionRate"
    ],
    dimensions: ["ym:s:startURL"],
    filters: "ym:s:startURL=='https://example.test/products/widget'"
  });
  expectEqual(
    JSON.parse(fetch.requests[3].body).filters,
    "ym:s:startURL=='https://example.test/owner\\'s\\\\page'"
  );
  expectEqual(urlStatus.source, "yandex.webmaster");
  expectEqual(sitemap.source, "yandex.webmaster");
  expectEqual(metrica.source, "yandex.metrica");
  expectEqual(urlStatus.payload.indexingState, "indexed");
  expectEqual(urlStatus.payload.searchable, true);
  expectEqual(urlStatus.payload.exclusionReason, null);
  expectEqual(urlStatus.payload.lastCrawlTime, "2026-06-20T09:10:11.000Z");
  expectEqual(urlStatus.payload.httpStatus, 200);
  expectEqual(urlStatus.payload.importantUrl, true);
  expectEqual(urlStatus.payload.diagnostics[0].code, "NO_ISSUES");
  expectEqual(sitemap.payload.status, "processed");
  expectEqual(metrica.payload.sampled, true);
  expectEqual(metrica.sampling, {
    sampled: true,
    state: "sampled"
  });

  return {
    records: [urlStatus, sitemap, metrica],
    summary: {
      requestMethods: fetch.requests.map((request) => request.method),
      sources: [urlStatus.source, sitemap.source, metrica.source],
      webmaster: webmasterSummary(urlStatus.payload),
      sitemap: sitemapSummary(sitemap.payload),
      metrica: metricaSummary(metrica.payload),
      quota: urlStatus.quota,
      freshness: [urlStatus.freshness, sitemap.freshness, metrica.freshness]
    }
  };
}

async function verifyWorkerCase(input) {
  const fetch = new RecordingYandexFetch([
    yandexResponse(webmasterUrlStatusPayload()),
    yandexResponse(metricaLandingPagePayload()),
    yandexResponse(webmasterSitemapPayload())
  ]);
  const adapter = input.createYandexProviderAdapter({
    fetch: fetch.fetch,
    endpointBaseUrl: "https://yandex.test"
  });
  const collector = input.createYandexExternalObservationCollector({
    adapter,
    targetResolver: {
      yandex() {
        return [
          {
            kind: "url-status",
            subjectUrl: "https://example.test/products/widget"
          },
          {
            kind: "metrica-landing-page",
            counterId: "counter-1",
            subjectUrl: "https://example.test/products/widget",
            startDate: "2026-06-01",
            endDate: "2026-06-20",
            metrics: ["ym:s:visits", "ym:s:bounceRate", "ym:s:goal123reaches"]
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
    yandexConnection()
  ]);
  const externalObservations = new RecordingExternalObservationStore();
  const vault = new RecordingVault({
    "secret://org-1/yandex/access-token": "yandex-access-token"
  });

  const batch = await input.collectExternalObservationsBatch({
    oauthConnections,
    externalObservations,
    vault,
    collectors: {
      google: {
        async collectExternalObservations() {
          throw new Error("Google collector should not be called.");
        }
      },
      yandex: collector
    },
    now: "2026-06-21T00:00:00.000Z",
    provider: "yandex",
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
      secretRef: "secret://org-1/yandex/access-token"
    }
  ]);
  expectEqual(
    externalObservations.records.map((record) => record.source),
    ["yandex.webmaster", "yandex.metrica", "yandex.webmaster"]
  );
  for (const record of externalObservations.records) {
    expectEqual(record.organizationId, "org-1");
    expectEqual(record.projectId, "project-1");
    expectEqual(record.environmentId, "env-1");
    if (!record.fingerprint.startsWith("yandex:org-1:project-1:env-1:")) {
      throw new Error(`Unexpected Yandex fingerprint ${record.fingerprint}.`);
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
  requireIncludes(html, "Yandex indexed and searchable");
  requireIncludes(html, "Yandex Metrica visits 420");
  requireIncludes(html, "https://example.test/products/widget");
  return {
    rendered: true,
    includesWebmasterSummary: html.includes("Yandex indexed and searchable"),
    includesMetricaSummary: html.includes("Yandex Metrica visits 420"),
    includesSitemapSummary: html.includes("Yandex sitemap processed")
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
    summary: yandexObservationSummary(record)
  };
}

function yandexObservationSummary(record) {
  if (record.source === "yandex.metrica") {
    const summary = metricaSummary(record.payload);
    return `Yandex Metrica visits ${summary.visits}, bounce ${summary.bounceRate}, conversions ${summary.conversions}, goal ${summary.goalConversionRate}`;
  }
  if (record.subjectUrl.endsWith("/sitemap.xml")) {
    const summary = sitemapSummary(record.payload);
    return `Yandex sitemap ${summary.status}: ${summary.urlCount} URLs, ${summary.errorCount} errors`;
  }
  const summary = webmasterSummary(record.payload);
  return `Yandex ${summary.indexingState} and ${summary.searchableStatus}: HTTP ${summary.httpStatus}, last crawl ${summary.lastCrawlTime}`;
}

function verifyReportCase(createHtmlReport, records) {
  const html = createHtmlReport([], {
    reportVariant: "yandex",
    externalObservations: records
  });
  requireIncludes(html, "Google / Yandex Report");
  requireIncludes(html, "yandex.webmaster");
  requireIncludes(html, "yandex.metrica");
  requireIncludes(html, "indexingState");
  requireIncludes(html, "organic");
  requireIncludes(html, "ym:s:goal123reaches");
  return {
    rendered: true,
    includesWebmaster: html.includes("yandex.webmaster"),
    includesMetrica: html.includes("yandex.metrica"),
    includesIndexingState: html.includes("indexingState"),
    includesTrafficSource: html.includes("organic"),
    includesGoalMetric: html.includes("ym:s:goal123reaches")
  };
}

function yandexScope() {
  return {
    organizationId: "org-1",
    projectId: "project-1",
    environmentId: "env-1",
    accessToken: "yandex-access-token",
    siteHostId: "host-1",
    fetchedAt: "2026-06-21T00:00:00.000Z",
    retentionUntil: "2026-07-21T00:00:00.000Z"
  };
}

function yandexConnection() {
  return {
    id: "yandex-connection-1",
    organizationId: "org-1",
    projectId: "project-1",
    environmentId: "env-1",
    provider: "yandex",
    providerAccountId: "host-1",
    scopes: ["webmaster:hostinfo", "webmaster:verify", "metrika:read"],
    accessTokenSecretRef: "secret://org-1/yandex/access-token",
    refreshTokenSecretRef: "secret://org-1/yandex/refresh-token",
    status: "active",
    nextRefreshAt: "2026-06-21T00:00:00.000Z",
    createdAt: "2026-06-20T00:00:00.000Z"
  };
}

function webmasterUrlStatusPayload() {
  return {
    indexingState: "indexed",
    searchable: true,
    indexable: true,
    exclusionReason: null,
    lastCrawlTime: "2026-06-20T09:10:11.000Z",
    checkedAt: "2026-06-20T10:00:00.000Z",
    httpStatus: 200,
    importantUrl: true,
    diagnostics: [
      {
        code: "NO_ISSUES",
        severity: "info",
        message: "No Yandex Webmaster issues detected."
      }
    ]
  };
}

function webmasterSitemapPayload() {
  return {
    url: "https://example.test/sitemap.xml",
    status: "processed",
    lastProcessedAt: "2026-06-20T08:00:00.000Z",
    urlCount: 128,
    errorCount: 0,
    warningCount: 1
  };
}

function metricaLandingPagePayload() {
  return {
    sampled: true,
    samplingState: "sampled",
    query: {
      dimensions: ["ym:s:startURL", "ym:s:lastsignTrafficSource"],
      metrics: [
        "ym:s:visits",
        "ym:s:bounceRate",
        "ym:s:goal123reaches",
        "ym:s:goal123conversionRate"
      ]
    },
    data: [
      {
        dimensions: [
          {
            name: "https://example.test/products/widget"
          },
          {
            name: "organic"
          }
        ],
        metrics: [420, 12.5, 37, 8.81],
        goals: [
          {
            id: "123",
            name: "Lead",
            conversions: 37,
            conversionRate: 8.81
          }
        ]
      }
    ],
    totals: [420, 12.5, 37, 8.81]
  };
}

function webmasterSummary(payload) {
  return {
    indexingState: payload.indexingState,
    searchableStatus: payload.searchable ? "searchable" : "not searchable",
    exclusionReason: payload.exclusionReason,
    lastCrawlTime: payload.lastCrawlTime,
    httpStatus: payload.httpStatus,
    importantUrl: payload.importantUrl,
    diagnostics: payload.diagnostics.map((diagnostic) => diagnostic.code)
  };
}

function sitemapSummary(payload) {
  return {
    status: payload.status,
    lastProcessedAt: payload.lastProcessedAt,
    urlCount: payload.urlCount,
    errorCount: payload.errorCount,
    warningCount: payload.warningCount
  };
}

function metricaSummary(payload) {
  const row = payload.data[0];
  return {
    landingPage: row.dimensions[0].name,
    source: row.dimensions[1].name,
    visits: row.metrics[0],
    bounceRate: row.metrics[1],
    conversions: row.metrics[2],
    goalConversionRate: row.metrics[3],
    goalId: row.goals[0].id,
    goalName: row.goals[0].name,
    sampled: payload.sampled,
    samplingState: payload.samplingState
  };
}

function yandexResponse(payload) {
  return {
    ok: true,
    status: 200,
    headers: {
      get(name) {
        return (
          {
            "x-yandex-ratelimit-limit": "1000",
            "x-yandex-ratelimit-remaining": "997",
            "x-yandex-ratelimit-reset": "2026-06-22T00:00:00.000Z"
          }[name.toLowerCase()] ?? null
        );
      }
    },
    async json() {
      return payload;
    }
  };
}

class RecordingYandexFetch {
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
      throw new Error(`Unexpected Yandex request ${url}.`);
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
    "yandex-access-token",
    "yandex-refresh-token",
    "authorization-code",
    "client-secret"
  ]) {
    if (value.includes(forbidden)) {
      throw new Error(
        `Yandex acceptance report contains forbidden ${forbidden}.`
      );
    }
  }
}

async function writeJson(filePath, value) {
  const json = await format(`${JSON.stringify(value, null, 2)}\n`, {
    parser: "json"
  });
  await writeFile(filePath, json);
}

await main();
