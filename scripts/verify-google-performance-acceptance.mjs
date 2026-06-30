#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const reportPath = "reports/google-performance-acceptance-report.json";
const samplePath =
  "docs/examples/google-performance-acceptance-report.sample.json";

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
      "external-observation-collection-process.test.ts"
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
    generatedBy: "searchlint-google-performance-acceptance-verifier",
    generatedAt: "2026-06-22T00:00:00.000Z",
    status: "passed",
    scope: {
      proofType: "deterministic local/static PageSpeed and CrUX proof",
      doesNotClaim: [
        "live Google OAuth app verification",
        "live PageSpeed Insights API data",
        "live CrUX API data",
        "live PageSpeed or CrUX quota acceptance",
        "historical production metric storage",
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
      "Configure the real Google OAuth app and approved redirect URIs.",
      "Run live PageSpeed Insights acceptance for LCP, INP, CLS, lab data, field page data, and field origin data.",
      "Run live CrUX acceptance for LCP, INP, CLS, form-factor filtering, and missing-data states.",
      "Persist historical performance metric rollups for dashboard trend analysis.",
      "Verify Google performance API quota, retry/backoff, and stale-state behavior against production credentials.",
      "Verify dashboard performance visualizations against live Google credentials."
    ]
  };

  assertNoForbiddenSecrets(JSON.stringify(report));
  await mkdir(path.dirname(reportPath), { recursive: true });
  await mkdir(path.dirname(samplePath), { recursive: true });
  await writeJson(reportPath, report);
  await writeJson(samplePath, report);

  console.log(
    `Google performance acceptance PASS: ${Object.keys(report.cases).length}/4 evidence groups passed`
  );
  console.log(`Report: ${reportPath}`);
  console.log(`Sample: ${samplePath}`);
}

async function verifyAdapterCase(createGoogleProviderAdapter) {
  const fetch = new RecordingGoogleFetch([
    googleResponse(pageSpeedPayload()),
    googleResponse(cruxPayload()),
    googleResponse(cruxMissingPayload())
  ]);
  const adapter = createGoogleProviderAdapter({
    fetch: fetch.fetch,
    pageSpeedEndpointBaseUrl: "https://pagespeed.test",
    cruxEndpointBaseUrl: "https://crux.test"
  });
  const scope = googleScope();

  const pageSpeed = await adapter.runPageSpeed({
    ...scope,
    subjectUrl: "https://example.test/products/widget",
    strategy: "mobile",
    categories: ["performance", "seo"]
  });
  const crux = await adapter.queryCrux({
    ...scope,
    subjectUrl: "https://example.test/products/widget",
    formFactor: "PHONE",
    effectiveConnectionType: "4G"
  });
  const cruxMissing = await adapter.queryCrux({
    ...scope,
    subjectUrl: "https://example.test/products/no-data",
    formFactor: "DESKTOP"
  });

  expectEqual(
    fetch.requests.map((request) => request.method),
    ["GET", "POST", "POST"]
  );
  expectEqual(
    fetch.requests[0].url,
    "https://pagespeed.test/pagespeedonline/v5/runPagespeed?url=https%3A%2F%2Fexample.test%2Fproducts%2Fwidget&strategy=mobile&category=performance&category=seo"
  );
  expectEqual(JSON.parse(fetch.requests[1].body), {
    url: "https://example.test/products/widget",
    formFactor: "PHONE",
    effectiveConnectionType: "4G"
  });
  expectEqual(JSON.parse(fetch.requests[2].body), {
    url: "https://example.test/products/no-data",
    formFactor: "DESKTOP"
  });
  expectEqual(pageSpeed.source, "google.pagespeed");
  expectEqual(crux.source, "google.crux");
  expectEqual(cruxMissing.source, "google.crux");
  expectEqual(pageSpeed.observedAt, "2026-06-20T14:15:16.000Z");
  expectEqual(pageSpeed.sampling, {
    sampled: false,
    state: "mobile"
  });
  expectEqual(crux.sampling, {
    sampled: true,
    state: "field-data"
  });
  expectEqual(cruxMissing.sampling, {
    sampled: true,
    state: "missing"
  });

  const pageSpeedMetrics = pageSpeedMetricSummary(pageSpeed.payload);
  const cruxMetrics = cruxMetricSummary(crux.payload);
  const missingMetrics = cruxMetricSummary(cruxMissing.payload);

  expectEqual(pageSpeedMetrics.lab.lcpMs, 2200);
  expectEqual(pageSpeedMetrics.lab.inpMs, 180);
  expectEqual(pageSpeedMetrics.lab.cls, 0.04);
  expectEqual(pageSpeedMetrics.fieldPage.lcpMs, 2450);
  expectEqual(pageSpeedMetrics.fieldPage.inpMs, 190);
  expectEqual(pageSpeedMetrics.fieldPage.cls, 0.05);
  expectEqual(pageSpeedMetrics.fieldOrigin.lcpMs, 2600);
  expectEqual(pageSpeedMetrics.fieldOrigin.inpMs, 210);
  expectEqual(pageSpeedMetrics.fieldOrigin.cls, 0.07);
  expectEqual(cruxMetrics.field.lcpMs, 2400);
  expectEqual(cruxMetrics.field.inpMs, 175);
  expectEqual(cruxMetrics.field.cls, 0.06);
  expectEqual(missingMetrics.hasData, false);

  return {
    records: [pageSpeed, crux, cruxMissing],
    summary: {
      requestMethods: fetch.requests.map((request) => request.method),
      sources: [pageSpeed.source, crux.source, cruxMissing.source],
      pageSpeed: {
        strategy: pageSpeed.sampling.state,
        observedAt: pageSpeed.observedAt,
        freshness: pageSpeed.freshness,
        quota: pageSpeed.quota,
        metrics: pageSpeedMetrics
      },
      crux: {
        observedAt: crux.observedAt,
        freshness: crux.freshness,
        sampling: crux.sampling,
        metrics: cruxMetrics
      },
      missingData: {
        subjectUrl: cruxMissing.subjectUrl,
        sampling: cruxMissing.sampling,
        metrics: missingMetrics
      }
    }
  };
}

async function verifyWorkerCase(input) {
  const fetch = new RecordingGoogleFetch([
    googleResponse(pageSpeedPayload()),
    googleResponse(cruxPayload())
  ]);
  const adapter = input.createGoogleProviderAdapter({
    fetch: fetch.fetch,
    pageSpeedEndpointBaseUrl: "https://pagespeed.test",
    cruxEndpointBaseUrl: "https://crux.test"
  });
  const collector = input.createGoogleExternalObservationCollector({
    adapter,
    targetResolver: {
      google() {
        return [
          {
            kind: "pagespeed",
            subjectUrl: "https://example.test/products/widget",
            strategy: "mobile",
            categories: ["performance", "seo"]
          },
          {
            kind: "crux",
            subjectUrl: "https://example.test/products/widget",
            formFactor: "PHONE",
            effectiveConnectionType: "4G"
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
    "secret://org-1/google/access-token": "google-performance-access-token"
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
    collected: 2,
    stored: 2,
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
    ["google.pagespeed", "google.crux"]
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
    trends: [
      {
        date: "2026-06-20",
        diagnostics: 3,
        blockers: 0,
        errors: 0,
        warnings: 3,
        infos: 0
      }
    ],
    externalObservations: records.map(dashboardObservation),
    reports: [],
    quotas: [],
    teamMembers: []
  });
  requireIncludes(html, "PageSpeed mobile lab LCP 2200ms");
  requireIncludes(html, "CrUX PHONE field LCP 2400ms");
  requireIncludes(html, "https://example.test/products/widget");
  return {
    rendered: true,
    includesPageSpeedSummary: html.includes("PageSpeed mobile lab LCP 2200ms"),
    includesCruxSummary: html.includes("CrUX PHONE field LCP 2400ms"),
    includesMetricTrendContext: html.includes("2026-06-20")
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
    summary: performanceObservationSummary(record)
  };
}

function performanceObservationSummary(record) {
  if (record.source === "google.pagespeed") {
    const metrics = pageSpeedMetricSummary(record.payload);
    return `PageSpeed ${record.sampling?.state ?? "unknown"} lab LCP ${metrics.lab.lcpMs}ms, INP ${metrics.lab.inpMs}ms, CLS ${metrics.lab.cls}; field page LCP ${metrics.fieldPage.lcpMs}ms; origin LCP ${metrics.fieldOrigin.lcpMs}ms`;
  }
  if (record.source === "google.crux") {
    const metrics = cruxMetricSummary(record.payload);
    if (!metrics.hasData) {
      return "CrUX missing field data";
    }
    const formFactor =
      record.payload.record?.key?.formFactor ??
      record.payload.record?.key?.form_factor ??
      "unknown";
    return `CrUX ${formFactor} field LCP ${metrics.field.lcpMs}ms, INP ${metrics.field.inpMs}ms, CLS ${metrics.field.cls}`;
  }
  return record.source;
}

function verifyReportCase(createHtmlReport, records) {
  const html = createHtmlReport([], {
    reportVariant: "google",
    externalObservations: records
  });
  requireIncludes(html, "Google / Yandex Report");
  requireIncludes(html, "google.pagespeed");
  requireIncludes(html, "google.crux");
  requireIncludes(html, "largest_contentful_paint");
  requireIncludes(html, "interaction_to_next_paint");
  requireIncludes(html, "cumulative_layout_shift");
  return {
    rendered: true,
    includesPageSpeed: html.includes("google.pagespeed"),
    includesCrux: html.includes("google.crux"),
    includesLcp: html.includes("largest_contentful_paint"),
    includesInp: html.includes("interaction_to_next_paint"),
    includesCls: html.includes("cumulative_layout_shift")
  };
}

function googleScope() {
  return {
    organizationId: "org-1",
    projectId: "project-1",
    environmentId: "env-1",
    accessToken: "google-performance-access-token",
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

function pageSpeedPayload() {
  return {
    id: "https://example.test/products/widget",
    analysisUTCTimestamp: "2026-06-20T14:15:16.000Z",
    lighthouseResult: {
      requestedUrl: "https://example.test/products/widget",
      finalDisplayedUrl: "https://example.test/products/widget",
      categories: {
        performance: {
          score: 0.91
        },
        seo: {
          score: 0.98
        }
      },
      audits: {
        "largest-contentful-paint": {
          numericValue: 2200
        },
        "experimental-interaction-to-next-paint": {
          numericValue: 180
        },
        "cumulative-layout-shift": {
          numericValue: 0.04
        }
      }
    },
    loadingExperience: {
      id: "https://example.test/products/widget",
      metrics: {
        LARGEST_CONTENTFUL_PAINT_MS: {
          percentile: 2450
        },
        INTERACTION_TO_NEXT_PAINT: {
          percentile: 190
        },
        CUMULATIVE_LAYOUT_SHIFT_SCORE: {
          percentile: 0.05
        }
      }
    },
    originLoadingExperience: {
      id: "https://example.test",
      metrics: {
        LARGEST_CONTENTFUL_PAINT_MS: {
          percentile: 2600
        },
        INTERACTION_TO_NEXT_PAINT: {
          percentile: 210
        },
        CUMULATIVE_LAYOUT_SHIFT_SCORE: {
          percentile: 0.07
        }
      }
    }
  };
}

function cruxPayload() {
  return {
    record: {
      key: {
        url: "https://example.test/products/widget",
        formFactor: "PHONE"
      },
      metrics: {
        largest_contentful_paint: {
          percentiles: {
            p75: 2400
          }
        },
        interaction_to_next_paint: {
          percentiles: {
            p75: 175
          }
        },
        cumulative_layout_shift: {
          percentiles: {
            p75: 0.06
          }
        }
      },
      collectionPeriod: {
        firstDate: {
          year: 2026,
          month: 5,
          day: 24
        },
        lastDate: {
          year: 2026,
          month: 6,
          day: 20
        }
      }
    }
  };
}

function cruxMissingPayload() {
  return {
    record: {
      key: {
        url: "https://example.test/products/no-data",
        formFactor: "DESKTOP"
      },
      metrics: {},
      collectionPeriod: {
        firstDate: {
          year: 2026,
          month: 5,
          day: 24
        },
        lastDate: {
          year: 2026,
          month: 6,
          day: 20
        }
      }
    }
  };
}

function pageSpeedMetricSummary(payload) {
  return {
    lab: {
      lcpMs:
        payload.lighthouseResult.audits["largest-contentful-paint"]
          .numericValue,
      inpMs:
        payload.lighthouseResult.audits[
          "experimental-interaction-to-next-paint"
        ].numericValue,
      cls: payload.lighthouseResult.audits["cumulative-layout-shift"]
        .numericValue
    },
    fieldPage: {
      lcpMs:
        payload.loadingExperience.metrics.LARGEST_CONTENTFUL_PAINT_MS
          .percentile,
      inpMs:
        payload.loadingExperience.metrics.INTERACTION_TO_NEXT_PAINT.percentile,
      cls: payload.loadingExperience.metrics.CUMULATIVE_LAYOUT_SHIFT_SCORE
        .percentile
    },
    fieldOrigin: {
      lcpMs:
        payload.originLoadingExperience.metrics.LARGEST_CONTENTFUL_PAINT_MS
          .percentile,
      inpMs:
        payload.originLoadingExperience.metrics.INTERACTION_TO_NEXT_PAINT
          .percentile,
      cls: payload.originLoadingExperience.metrics.CUMULATIVE_LAYOUT_SHIFT_SCORE
        .percentile
    }
  };
}

function cruxMetricSummary(payload) {
  const metrics = payload.record.metrics;
  const hasData = Object.keys(metrics).length > 0;
  return {
    hasData,
    field: hasData
      ? {
          lcpMs: metrics.largest_contentful_paint.percentiles.p75,
          inpMs: metrics.interaction_to_next_paint.percentiles.p75,
          cls: metrics.cumulative_layout_shift.percentiles.p75
        }
      : undefined
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
            "x-ratelimit-limit": "25000",
            "x-ratelimit-remaining": "24998",
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
    "google-performance-access-token",
    "google-refresh-token",
    "authorization-code",
    "client-secret"
  ]) {
    if (value.includes(forbidden)) {
      throw new Error(
        `Google performance acceptance report contains forbidden ${forbidden}.`
      );
    }
  }
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

await main();
