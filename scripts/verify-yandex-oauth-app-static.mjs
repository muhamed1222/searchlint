#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { format } from "prettier";

const reportPath = "reports/yandex-oauth-app-static-report.json";
const samplePath = "docs/examples/yandex-oauth-app-static-report.sample.json";

const commands = [
  {
    name: "apiOAuthAuthorizationTests",
    command: "pnpm",
    args: [
      "--filter",
      "@searchlint/api",
      "test",
      "--",
      "external-provider-oauth-authorization.test.ts",
      "cloud-api-process.test.ts"
    ]
  },
  {
    name: "dashboardProviderSettings",
    command: "pnpm",
    args: ["dashboard:provider-settings"]
  },
  {
    name: "authOauthCallbacksStatic",
    command: "pnpm",
    args: ["auth:oauth-callbacks-static"]
  },
  {
    name: "yandexAcceptance",
    command: "pnpm",
    args: ["yandex:acceptance"]
  },
  {
    name: "apiBuild",
    command: "pnpm",
    args: ["--filter", "@searchlint/api", "build"]
  }
];

const commandResults = commands.map(runCommand);
const api = await import("../services/api/dist/src/index.js");

const config = {
  provider: "yandex",
  authorizationEndpoint: "https://oauth.yandex.com/authorize",
  clientId: "yandex-oauth-client-id",
  redirectUri: "https://app.searchlint.example/oauth/yandex/callback",
  scopes: ["login:email", "webmaster:read", "metrika:read"],
  pkceRequired: false
};
const builder = api.createExternalProviderOAuthAuthorizationUrlBuilder([
  config
]);
const authorization = await builder.buildAuthorizationUrl({
  organizationId: "org-1",
  projectId: "project-1",
  environmentId: "env-1",
  provider: "yandex",
  state: "yandex-state-1"
});

const authorizationUrl = new URL(authorization.authorizationUrl);
assertEqual(
  authorizationUrl.origin + authorizationUrl.pathname,
  config.authorizationEndpoint,
  "Yandex OAuth authorization endpoint"
);
assertEqual(
  authorizationUrl.searchParams.get("client_id"),
  config.clientId,
  "Yandex OAuth client id"
);
assertEqual(
  authorizationUrl.searchParams.get("redirect_uri"),
  config.redirectUri,
  "Yandex OAuth redirect URI"
);
assertEqual(
  authorizationUrl.searchParams.get("response_type"),
  "code",
  "Yandex OAuth response type"
);
assertEqual(
  authorizationUrl.searchParams.get("access_type"),
  "offline",
  "Yandex OAuth access type"
);
assertEqual(
  authorizationUrl.searchParams.get("scope"),
  "login:email metrika:read webmaster:read",
  "Yandex OAuth scopes"
);
assertEqual(
  authorizationUrl.searchParams.get("prompt"),
  null,
  "Yandex OAuth Google-only prompt"
);
assertEqual(
  authorizationUrl.searchParams.get("code_challenge"),
  null,
  "Yandex OAuth PKCE challenge"
);
assertEqual(
  authorizationUrl.searchParams.get("code_challenge_method"),
  null,
  "Yandex OAuth PKCE method"
);
assertEqual(authorization.pkceRequired, false, "Yandex OAuth PKCE required");

const report = {
  generatedBy: "searchlint-yandex-oauth-app-static-verifier",
  generatedAt: "2026-06-23T00:00:00.000Z",
  status: "passed",
  scope: {
    proofType: "deterministic static Yandex OAuth app configuration readiness",
    doesNotClaim: [
      "live Yandex OAuth application exists",
      "live Yandex app verification or approval is complete",
      "live Yandex authorization code exchange",
      "live Yandex Webmaster site connection",
      "live Yandex Metrica counter connection",
      "live dashboard connector proof with real Yandex credentials"
    ]
  },
  commands: commandResults,
  yandexOAuthAppContract: {
    provider: authorization.provider,
    authorizationEndpoint: config.authorizationEndpoint,
    clientId: "<redacted>",
    redirectUri: authorization.redirectUri,
    scopes: authorization.scopes,
    pkceRequired: authorization.pkceRequired,
    responseType: authorizationUrl.searchParams.get("response_type"),
    accessType: authorizationUrl.searchParams.get("access_type"),
    prompt: authorizationUrl.searchParams.get("prompt"),
    codeChallengeMethod: authorizationUrl.searchParams.get(
      "code_challenge_method"
    )
  },
  assertions: [
    "Yandex OAuth authorization endpoint is oauth.yandex.com/authorize.",
    "Yandex OAuth redirect URI is HTTPS and provider-specific.",
    "Yandex OAuth scopes include login:email, webmaster:read, and metrika:read.",
    "Yandex OAuth requests use authorization code flow.",
    "Yandex OAuth requests use the shared offline access-token boundary.",
    "Yandex OAuth static app contract does not require PKCE.",
    "Yandex OAuth static app contract does not send the Google-only consent prompt.",
    "Dashboard provider settings and OAuth callback static gates still pass.",
    "Yandex Webmaster/Metrica deterministic acceptance still passes."
  ],
  remainingReleaseGates: [
    "Create the real Yandex OAuth app in the Yandex developer console.",
    "Configure the real authorized redirect URI for the deployed dashboard/API.",
    "Run live Yandex authorization code exchange and token vault storage.",
    "Connect real Yandex Webmaster sites.",
    "Connect real Yandex Metrica counters.",
    "Run live dashboard connector proof with real Yandex credentials."
  ]
};

assertNoSensitiveMarkers(report);

await mkdir(path.dirname(reportPath), { recursive: true });
await mkdir(path.dirname(samplePath), { recursive: true });
await writeJson(reportPath, report);
await writeJson(samplePath, report);

console.log(
  `Yandex OAuth app static readiness PASS: ${commandResults.length}/${commands.length} command groups passed`
);
console.log(`Report: ${reportPath}`);
console.log(`Sample: ${samplePath}`);

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
    throw new Error(`${label}: expected ${expected}, got ${actual}.`);
  }
}

function assertNoSensitiveMarkers(value) {
  const serialized = JSON.stringify(value);
  const markers = [
    "yandex-access-token",
    "yandex-refresh-token",
    "authorization-code",
    "client-secret",
    "Bearer "
  ];
  for (const marker of markers) {
    if (serialized.includes(marker)) {
      throw new Error(`Sensitive marker leaked into report: ${marker}`);
    }
  }
}

async function writeJson(filePath, value) {
  const json = await format(`${JSON.stringify(value, null, 2)}\n`, {
    parser: "json"
  });
  await writeFile(filePath, json);
}
