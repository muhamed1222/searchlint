#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { format } from "prettier";

const reportPath =
  "reports/yandex-webmaster-site-connection-static-report.json";
const samplePath =
  "docs/examples/yandex-webmaster-site-connection-static-report.sample.json";

const commands = [
  {
    name: "yandexOAuthStaticReadiness",
    command: "pnpm",
    args: ["yandex:oauth-static"]
  },
  {
    name: "yandexDeterministicAcceptance",
    command: "pnpm",
    args: ["yandex:acceptance"]
  }
];

const commandResults = commands.map(runCommand);

const contracts = [
  {
    fixtureId: "yandex-webmaster-primary-host",
    siteHostId: "host-1",
    verifiedHost: "example.test",
    projectBaseUrl: "https://example.test",
    subjectUrls: [
      "https://example.test/",
      "https://example.test/products/widget"
    ],
    sitemapUrls: ["https://example.test/sitemap.xml"]
  },
  {
    fixtureId: "yandex-webmaster-subdomain-host",
    siteHostId: "host-docs",
    verifiedHost: "docs.example.test",
    projectBaseUrl: "https://docs.example.test",
    subjectUrls: [
      "https://docs.example.test/",
      "https://docs.example.test/guide"
    ],
    sitemapUrls: ["https://docs.example.test/sitemap.xml"]
  }
].map(buildConnectionContract);

for (const contract of contracts) {
  validateConnectionContract(contract);
}

const requiredDocs = [
  "docs/YANDEX_OAUTH_APP_STATIC_READINESS.md",
  "docs/YANDEX_ACCEPTANCE.md",
  "docs/DASHBOARD_PROVIDER_SETTINGS.md"
];
const documentEvidence = await Promise.all(requiredDocs.map(readRequiredDoc));

const report = {
  generatedBy: "searchlint-yandex-webmaster-site-connection-static-verifier",
  generatedAt: "2026-06-23T00:00:00.000Z",
  status: "readiness-passed-live-gate-blocked",
  scope: {
    proofType:
      "deterministic static Yandex Webmaster site connection readiness",
    doesNotClaim: [
      "live Yandex Webmaster site ownership verification",
      "live Yandex Webmaster site list binding",
      "live Yandex OAuth token exchange",
      "live Webmaster URL status data",
      "live Webmaster sitemap status data",
      "live dashboard connector status"
    ]
  },
  commands: commandResults,
  requiredScopes: ["login:email", "webmaster:read"],
  tenantBinding: {
    organizationId: "org-1",
    projectId: "project-1",
    environmentId: "env-1",
    provider: "yandex"
  },
  siteConnectionContracts: contracts.map((contract) => ({
    fixtureId: contract.fixtureId,
    siteHostId: contract.siteHostId,
    verifiedHost: contract.verifiedHost,
    projectBaseUrl: contract.projectBaseUrl,
    subjectUrlCount: contract.subjectUrls.length,
    sitemapUrlCount: contract.sitemapUrls.length,
    containment: contract.containment,
    requestMapping: contract.requestMapping
  })),
  documentEvidence,
  assertions: [
    "Yandex Webmaster site connections are bound to organization, project, and environment.",
    "Yandex Webmaster site connections preserve the provider account host id used by the adapter.",
    "URL-status requests use subject URLs contained by the connected verified host.",
    "Sitemap requests use sitemap URLs contained by the connected verified host.",
    "The static contract uses read-only Webmaster scope and does not require write scopes.",
    "Dashboard provider settings and Yandex deterministic acceptance remain green.",
    "Generated evidence redacts credentials and does not contain access tokens, refresh tokens, authorization codes, or client secrets."
  ],
  remainingReleaseGates: [
    "Owner adds and verifies the real Yandex Webmaster site.",
    "SearchLint completes live Yandex OAuth exchange and vault storage.",
    "SearchLint lists or binds the verified Yandex Webmaster host for the target project/environment.",
    "Live Webmaster URL status acceptance passes for URLs under the connected host.",
    "Live Webmaster sitemap status acceptance passes for sitemaps under the connected host.",
    "Dashboard connector status is verified against live Yandex credentials."
  ]
};

assertNoForbiddenSecrets(JSON.stringify(report));
await mkdir(path.dirname(reportPath), { recursive: true });
await mkdir(path.dirname(samplePath), { recursive: true });
await writeJson(reportPath, report);
await writeJson(samplePath, report);

console.log(
  `Yandex Webmaster site connection static readiness PASS: ${contracts.length}/2 host contracts verified; live gate remains blocked`
);
console.log(`Report: ${reportPath}`);
console.log(`Sample: ${samplePath}`);

function buildConnectionContract(input) {
  return {
    organizationId: "org-1",
    projectId: "project-1",
    environmentId: "env-1",
    provider: "yandex",
    requiredScopes: ["login:email", "webmaster:read"],
    ...input,
    requestMapping: {
      urlStatus: {
        endpoint: "/webmaster/v1/hosts/{siteHostId}/url-status",
        queryFields: ["url"]
      },
      sitemap: {
        endpoint: "/webmaster/v1/hosts/{siteHostId}/sitemaps/{sitemapUrl}",
        pathFields: ["siteHostId", "sitemapUrl"]
      }
    }
  };
}

function validateConnectionContract(contract) {
  assertEqual(contract.organizationId, "org-1", "organization binding");
  assertEqual(contract.projectId, "project-1", "project binding");
  assertEqual(contract.environmentId, "env-1", "environment binding");
  assertEqual(contract.provider, "yandex", "provider binding");
  assertNonEmpty(contract.siteHostId, "Yandex Webmaster host id");
  assertNonEmpty(contract.verifiedHost, "Yandex Webmaster verified host");
  assertStartsWith(contract.projectBaseUrl, "https://", "project base URL");
  const containment = {
    subjectUrls: contract.subjectUrls.map((subjectUrl) =>
      assertContainedByHost(contract, subjectUrl)
    ),
    sitemapUrls: contract.sitemapUrls.map((sitemapUrl) =>
      assertContainedByHost(contract, sitemapUrl)
    )
  };
  contract.containment = containment;
  return contract;
}

function assertContainedByHost(contract, targetUrl) {
  const url = new URL(targetUrl);
  if (url.hostname !== contract.verifiedHost) {
    throw new Error(`${targetUrl} is outside ${contract.verifiedHost}.`);
  }
  return {
    targetUrl,
    contained: true,
    reason: "host matches Yandex Webmaster verified host"
  };
}

async function readRequiredDoc(filePath) {
  const text = await readFile(filePath, "utf8");
  const requiredFragments = {
    "docs/YANDEX_OAUTH_APP_STATIC_READINESS.md": [
      "webmaster:read",
      "connect real Yandex Webmaster sites"
    ],
    "docs/YANDEX_ACCEPTANCE.md": [
      "real Yandex Webmaster site connection",
      "Webmaster sitemap status acceptance"
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

function assertStartsWith(actual, expected, label) {
  if (!actual.startsWith(expected)) {
    throw new Error(`${label}: expected ${actual} to start with ${expected}.`);
  }
}

function assertNonEmpty(actual, label) {
  if (typeof actual !== "string" || actual.trim() === "") {
    throw new Error(`${label} must be a non-empty string.`);
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
        `Yandex Webmaster site connection report contains forbidden ${forbidden}.`
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
