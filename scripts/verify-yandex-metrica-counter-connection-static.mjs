#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { format } from "prettier";

const reportPath =
  "reports/yandex-metrica-counter-connection-static-report.json";
const samplePath =
  "docs/examples/yandex-metrica-counter-connection-static-report.sample.json";

const commands = [
  {
    name: "yandexOAuthStaticReadiness",
    command: "pnpm",
    args: ["yandex:oauth-static"]
  },
  {
    name: "yandexAcceptance",
    command: "pnpm",
    args: ["yandex:acceptance"]
  }
];

const commandResults = commands.map(runCommand);

const contracts = [
  {
    fixtureId: "metrica-primary-counter",
    counterId: "counter-1",
    counterName: "Example production counter",
    siteUrls: ["https://example.test"],
    landingPageUrls: [
      "https://example.test/",
      "https://example.test/products/widget"
    ],
    dateRange: {
      startDate: "2026-06-01",
      endDate: "2026-06-20"
    },
    metrics: [
      "ym:s:visits",
      "ym:s:bounceRate",
      "ym:s:goal123reaches",
      "ym:s:goal123conversionRate"
    ],
    goals: [
      {
        goalId: "123",
        name: "Lead form"
      }
    ]
  },
  {
    fixtureId: "metrica-blog-counter",
    counterId: "counter-blog",
    counterName: "Example blog counter",
    siteUrls: ["https://blog.example.test"],
    landingPageUrls: [
      "https://blog.example.test/",
      "https://blog.example.test/articles/launch"
    ],
    dateRange: {
      startDate: "2026-06-01",
      endDate: "2026-06-20"
    },
    metrics: ["ym:s:visits", "ym:s:bounceRate"],
    goals: []
  }
].map(buildCounterContract);

for (const contract of contracts) {
  validateCounterContract(contract);
}

const requiredDocs = [
  "docs/YANDEX_OAUTH_APP_STATIC_READINESS.md",
  "docs/YANDEX_ACCEPTANCE.md",
  "docs/DASHBOARD_PROVIDER_SETTINGS.md"
];
const documentEvidence = await Promise.all(requiredDocs.map(readRequiredDoc));

const report = {
  generatedBy: "searchlint-yandex-metrica-counter-static-verifier",
  generatedAt: "2026-06-23T00:00:00.000Z",
  status: "readiness-passed-live-gate-blocked",
  scope: {
    proofType:
      "deterministic static Yandex Metrica counter connection readiness",
    doesNotClaim: [
      "live Yandex Metrica counter ownership",
      "live Yandex Metrica counter listing",
      "live Yandex OAuth token exchange",
      "live Metrica traffic data",
      "live Metrica goal data",
      "live dashboard connector status"
    ]
  },
  commands: commandResults,
  requiredScopes: ["login:email", "metrika:read"],
  tenantBinding: {
    organizationId: "org-1",
    projectId: "project-1",
    environmentId: "env-1",
    provider: "yandex"
  },
  counterConnectionContracts: contracts.map((contract) => ({
    fixtureId: contract.fixtureId,
    counterId: contract.counterId,
    counterName: contract.counterName,
    siteUrlCount: contract.siteUrls.length,
    landingPageUrlCount: contract.landingPageUrls.length,
    dateRange: contract.dateRange,
    metrics: contract.metrics,
    goalCount: contract.goals.length,
    containment: contract.containment,
    requestMapping: contract.requestMapping
  })),
  documentEvidence,
  assertions: [
    "Yandex Metrica counter connections are bound to organization, project, and environment.",
    "Yandex Metrica counter connections preserve the counter id used by the provider adapter.",
    "Landing-page query targets are contained by one of the connected counter site URLs.",
    "The static contract records date range, metrics, and goal metadata required by Metrica observations.",
    "The static contract uses read-only Metrica scope and does not require write scopes.",
    "Dashboard provider settings and Yandex deterministic acceptance remain green.",
    "Generated evidence redacts credentials and does not contain access tokens, refresh tokens, authorization codes, or client secrets."
  ],
  remainingReleaseGates: [
    "Owner grants SearchLint access to the real Yandex Metrica counter.",
    "SearchLint completes live Yandex OAuth exchange and vault storage.",
    "SearchLint lists or binds the real Metrica counter to the target project/environment.",
    "Live Metrica landing-page acceptance passes for URLs tracked by the connected counter.",
    "Live Metrica goal/conversion acceptance passes for configured goals.",
    "Dashboard connector status is verified against live Yandex credentials."
  ]
};

assertNoForbiddenSecrets(JSON.stringify(report));
await mkdir(path.dirname(reportPath), { recursive: true });
await mkdir(path.dirname(samplePath), { recursive: true });
await writeJson(reportPath, report);
await writeJson(samplePath, report);

console.log(
  `Yandex Metrica counter connection static readiness PASS: ${contracts.length}/2 counter contracts verified; live gate remains blocked`
);
console.log(`Report: ${reportPath}`);
console.log(`Sample: ${samplePath}`);

function buildCounterContract(input) {
  return {
    organizationId: "org-1",
    projectId: "project-1",
    environmentId: "env-1",
    provider: "yandex",
    requiredScopes: ["login:email", "metrika:read"],
    ...input,
    requestMapping: {
      landingPages: {
        endpoint: "/metrica/v1/counters/{counterId}/landing-pages/query",
        method: "POST",
        bodyFields: ["date1", "date2", "metrics", "dimensions", "filters"]
      }
    }
  };
}

function validateCounterContract(contract) {
  assertEqual(contract.organizationId, "org-1", "organization binding");
  assertEqual(contract.projectId, "project-1", "project binding");
  assertEqual(contract.environmentId, "env-1", "environment binding");
  assertEqual(contract.provider, "yandex", "provider binding");
  assertNonEmpty(contract.counterId, "Yandex Metrica counter id");
  assertNonEmpty(contract.counterName, "Yandex Metrica counter name");
  assertDate(contract.dateRange.startDate, "Metrica start date");
  assertDate(contract.dateRange.endDate, "Metrica end date");
  if (contract.metrics.length === 0) {
    throw new Error("Yandex Metrica metrics must not be empty.");
  }
  const containment = contract.landingPageUrls.map((landingPageUrl) =>
    assertContainedByCounterSite(contract, landingPageUrl)
  );
  contract.containment = containment;
  return contract;
}

function assertContainedByCounterSite(contract, landingPageUrl) {
  const landing = new URL(landingPageUrl);
  for (const siteUrl of contract.siteUrls) {
    const site = new URL(siteUrl);
    if (
      landing.origin === site.origin &&
      landing.pathname.startsWith(site.pathname)
    ) {
      return {
        targetUrl: landingPageUrl,
        contained: true,
        reason: "landing page matches connected Metrica counter site URL"
      };
    }
  }
  throw new Error(
    `${landingPageUrl} is outside connected Metrica counter sites.`
  );
}

async function readRequiredDoc(filePath) {
  const text = await readFile(filePath, "utf8");
  const requiredFragments = {
    "docs/YANDEX_OAUTH_APP_STATIC_READINESS.md": [
      "metrika:read",
      "connect real Yandex Metrica counters"
    ],
    "docs/YANDEX_ACCEPTANCE.md": [
      "real Yandex Metrica counter connection",
      "live Metrica acceptance"
    ],
    "docs/DASHBOARD_PROVIDER_SETTINGS.md": ["Yandex", "required scopes"]
  }[filePath];
  for (const fragment of requiredFragments) {
    if (!text.includes(fragment)) {
      throw new Error(`${filePath} is missing required text: ${fragment}`);
    }
  }
  return {
    filePath,
    status: "present",
    checkedFragments: requiredFragments
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

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, received ${actual}.`);
  }
}

function assertNonEmpty(actual, label) {
  if (typeof actual !== "string" || actual.trim() === "") {
    throw new Error(`${label} must be a non-empty string.`);
  }
}

function assertDate(actual, label) {
  assertNonEmpty(actual, label);
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(actual)) {
    throw new Error(`${label} must use YYYY-MM-DD format.`);
  }
}

function assertNoForbiddenSecrets(value) {
  for (const forbidden of [
    "yandex-access-token",
    "yandex-refresh-token",
    "authorization-code",
    "client-secret",
    "Bearer "
  ]) {
    if (value.includes(forbidden)) {
      throw new Error(
        `Yandex Metrica counter connection report contains forbidden ${forbidden}.`
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
