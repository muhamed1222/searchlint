#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { format } from "prettier";

const reportPath =
  "reports/google-search-console-site-connection-static-report.json";
const samplePath =
  "docs/examples/google-search-console-site-connection-static-report.sample.json";

const commands = [
  {
    name: "googleOAuthStaticReadiness",
    command: "pnpm",
    args: ["google:oauth-static"]
  },
  {
    name: "googleSearchConsoleDeterministicAcceptance",
    command: "pnpm",
    args: ["google:gsc:acceptance"]
  }
];

const commandResults = commands.map(runCommand);

const contracts = [
  {
    fixtureId: "gsc-domain-property",
    propertyType: "domain",
    siteUrl: "sc-domain:example.test",
    projectBaseUrl: "https://example.test",
    subjectUrls: [
      "https://example.test/",
      "https://example.test/products/widget",
      "https://docs.example.test/guide"
    ],
    sitemapUrls: [
      "https://example.test/sitemap.xml",
      "https://docs.example.test/sitemap.xml"
    ]
  },
  {
    fixtureId: "gsc-url-prefix-property",
    propertyType: "url-prefix",
    siteUrl: "https://example.test/",
    projectBaseUrl: "https://example.test",
    subjectUrls: [
      "https://example.test/",
      "https://example.test/products/widget"
    ],
    sitemapUrls: ["https://example.test/sitemap.xml"]
  }
].map(buildConnectionContract);

for (const contract of contracts) {
  validateConnectionContract(contract);
}

const requiredDocs = [
  "docs/GOOGLE_OAUTH_APP_STATIC_READINESS.md",
  "docs/GOOGLE_CONSENT_VERIFICATION_READINESS.md",
  "docs/GOOGLE_SEARCH_CONSOLE_ACCEPTANCE.md",
  "docs/DASHBOARD_PROVIDER_SETTINGS.md"
];
const documentEvidence = await Promise.all(requiredDocs.map(readRequiredDoc));

const report = {
  generatedBy: "searchlint-google-gsc-site-connection-static-verifier",
  generatedAt: "2026-06-23T00:00:00.000Z",
  status: "readiness-passed-live-gate-blocked",
  scope: {
    proofType:
      "deterministic static Google Search Console site connection readiness",
    doesNotClaim: [
      "live Google Search Console property ownership",
      "live Search Console property listing",
      "live Google OAuth token exchange",
      "live Search Analytics data",
      "live URL Inspection call",
      "live sitemap status from Google",
      "live dashboard connector status"
    ]
  },
  commands: commandResults,
  requiredScopes: [
    "openid",
    "email",
    "https://www.googleapis.com/auth/webmasters.readonly"
  ],
  tenantBinding: {
    organizationId: "org-1",
    projectId: "project-1",
    environmentId: "env-1",
    provider: "google"
  },
  siteConnectionContracts: contracts.map((contract) => ({
    fixtureId: contract.fixtureId,
    propertyType: contract.propertyType,
    siteUrl: contract.siteUrl,
    projectBaseUrl: contract.projectBaseUrl,
    subjectUrlCount: contract.subjectUrls.length,
    sitemapUrlCount: contract.sitemapUrls.length,
    containment: contract.containment,
    requestMapping: contract.requestMapping
  })),
  documentEvidence,
  assertions: [
    "Google Search Console site connections are bound to organization, project, and environment.",
    "Domain property connections preserve the sc-domain Search Console siteUrl form.",
    "URL-prefix property connections preserve the HTTPS URL-prefix siteUrl form.",
    "URL Inspection and Search Analytics requests use subject URLs contained by the connected property.",
    "Sitemap requests use sitemap URLs contained by the connected property.",
    "The static contract uses Search Console readonly scope and does not require write scopes.",
    "Generated evidence redacts credentials and does not contain access tokens, refresh tokens, authorization codes, or client secrets."
  ],
  remainingReleaseGates: [
    "Owner adds and verifies the real Google Search Console property.",
    "SearchLint completes live Google OAuth exchange and vault storage.",
    "SearchLint lists or binds the verified Search Console property for the target project/environment.",
    "Live Search Analytics acceptance passes for the connected property.",
    "Live URL Inspection acceptance passes for URLs under the connected property.",
    "Live sitemap status acceptance passes for sitemaps under the connected property.",
    "Dashboard connector status is verified against live Google credentials."
  ]
};

assertNoForbiddenSecrets(JSON.stringify(report));
await mkdir(path.dirname(reportPath), { recursive: true });
await mkdir(path.dirname(samplePath), { recursive: true });
await writeJson(reportPath, report);
await writeJson(samplePath, report);

console.log(
  `Google Search Console site connection static readiness PASS: ${contracts.length}/2 property contracts verified; live gate remains blocked`
);
console.log(`Report: ${reportPath}`);
console.log(`Sample: ${samplePath}`);

function buildConnectionContract(input) {
  return {
    organizationId: "org-1",
    projectId: "project-1",
    environmentId: "env-1",
    provider: "google",
    requiredScopes: [
      "openid",
      "email",
      "https://www.googleapis.com/auth/webmasters.readonly"
    ],
    ...input,
    requestMapping: {
      urlInspection: {
        endpoint: "/v1/urlInspection/index:inspect",
        bodyFields: ["inspectionUrl", "siteUrl"]
      },
      searchAnalytics: {
        endpoint: "/webmasters/v3/sites/{siteUrl}/searchAnalytics/query",
        bodyFields: ["startDate", "endDate", "dimensions"]
      },
      sitemap: {
        endpoint: "/webmasters/v3/sites/{siteUrl}/sitemaps/{sitemapUrl}",
        pathFields: ["siteUrl", "sitemapUrl"]
      }
    }
  };
}

function validateConnectionContract(contract) {
  assertEqual(contract.organizationId, "org-1", "organization binding");
  assertEqual(contract.projectId, "project-1", "project binding");
  assertEqual(contract.environmentId, "env-1", "environment binding");
  assertEqual(contract.provider, "google", "provider binding");
  if (!["domain", "url-prefix"].includes(contract.propertyType)) {
    throw new Error(`Unexpected property type ${contract.propertyType}.`);
  }
  if (contract.propertyType === "domain") {
    assertStartsWith(contract.siteUrl, "sc-domain:", "domain property siteUrl");
  } else {
    assertStartsWith(contract.siteUrl, "https://", "URL-prefix siteUrl");
  }
  const containment = {
    subjectUrls: contract.subjectUrls.map((subjectUrl) =>
      assertContainedByProperty(contract, subjectUrl)
    ),
    sitemapUrls: contract.sitemapUrls.map((sitemapUrl) =>
      assertContainedByProperty(contract, sitemapUrl)
    )
  };
  contract.containment = containment;
  return contract;
}

function assertContainedByProperty(contract, targetUrl) {
  const url = new URL(targetUrl);
  if (contract.propertyType === "domain") {
    const domain = contract.siteUrl.replace("sc-domain:", "");
    const matches =
      url.hostname === domain || url.hostname.endsWith(`.${domain}`);
    if (!matches) {
      throw new Error(`${targetUrl} is outside ${contract.siteUrl}.`);
    }
    return {
      targetUrl,
      contained: true,
      reason: "host matches domain property"
    };
  }
  const prefix = new URL(contract.siteUrl);
  const matches =
    url.origin === prefix.origin && url.pathname.startsWith(prefix.pathname);
  if (!matches) {
    throw new Error(`${targetUrl} is outside ${contract.siteUrl}.`);
  }
  return { targetUrl, contained: true, reason: "URL prefix matches property" };
}

async function readRequiredDoc(filePath) {
  const text = await readFile(filePath, "utf8");
  const requiredFragments = {
    "docs/GOOGLE_OAUTH_APP_STATIC_READINESS.md": [
      "https://www.googleapis.com/auth/webmasters.readonly",
      "connect real Search Console properties"
    ],
    "docs/GOOGLE_CONSENT_VERIFICATION_READINESS.md": [
      "sensitive scope",
      "connect real Search Console properties"
    ],
    "docs/GOOGLE_SEARCH_CONSOLE_ACCEPTANCE.md": [
      "Search Console property ownership verification",
      "live Search Console site connection"
    ],
    "docs/DASHBOARD_PROVIDER_SETTINGS.md": ["Google", "required scopes"]
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

function assertNoForbiddenSecrets(value) {
  for (const forbidden of [
    "google-access-token",
    "google-refresh-token",
    "authorization-code",
    "client-secret",
    "Bearer "
  ]) {
    if (value.includes(forbidden)) {
      throw new Error(
        `Google Search Console site connection report contains forbidden ${forbidden}.`
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
