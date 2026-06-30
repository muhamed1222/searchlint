#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { format } from "prettier";

const reportPath = "reports/google-oauth-app-static-report.json";
const samplePath = "docs/examples/google-oauth-app-static-report.sample.json";

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
    name: "googleSearchConsoleAcceptance",
    command: "pnpm",
    args: ["google:gsc:acceptance"]
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
  provider: "google",
  authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  clientId: "google-oauth-client-id.apps.googleusercontent.com",
  redirectUri: "https://app.searchlint.example/oauth/google/callback",
  scopes: [
    "openid",
    "email",
    "https://www.googleapis.com/auth/webmasters.readonly"
  ],
  pkceRequired: true
};
const builder = api.createExternalProviderOAuthAuthorizationUrlBuilder([
  config
]);
const authorization = await builder.buildAuthorizationUrl({
  organizationId: "org-1",
  projectId: "project-1",
  environmentId: "env-1",
  provider: "google",
  state: "google-state-1",
  pkce: {
    codeChallenge: "google-pkce-challenge",
    method: "S256"
  }
});

const authorizationUrl = new URL(authorization.authorizationUrl);
assertEqual(
  authorizationUrl.origin + authorizationUrl.pathname,
  config.authorizationEndpoint,
  "Google OAuth authorization endpoint"
);
assertEqual(
  authorizationUrl.searchParams.get("client_id"),
  config.clientId,
  "Google OAuth client id"
);
assertEqual(
  authorizationUrl.searchParams.get("redirect_uri"),
  config.redirectUri,
  "Google OAuth redirect URI"
);
assertEqual(
  authorizationUrl.searchParams.get("response_type"),
  "code",
  "Google OAuth response type"
);
assertEqual(
  authorizationUrl.searchParams.get("access_type"),
  "offline",
  "Google OAuth access type"
);
assertEqual(
  authorizationUrl.searchParams.get("prompt"),
  "consent",
  "Google OAuth prompt"
);
assertEqual(
  authorizationUrl.searchParams.get("code_challenge_method"),
  "S256",
  "Google OAuth PKCE method"
);
assertEqual(
  authorizationUrl.searchParams.get("scope"),
  "email https://www.googleapis.com/auth/webmasters.readonly openid",
  "Google OAuth scopes"
);
assertEqual(authorization.pkceRequired, true, "Google OAuth PKCE required");

let missingPkceError = "";
try {
  await builder.buildAuthorizationUrl({
    organizationId: "org-1",
    projectId: "project-1",
    environmentId: "env-1",
    provider: "google",
    state: "google-state-2"
  });
} catch (error) {
  missingPkceError = error instanceof Error ? error.message : String(error);
}
assertEqual(
  missingPkceError,
  "codeChallenge is required for this provider.",
  "Google OAuth missing PKCE error"
);

const report = {
  generatedBy: "searchlint-google-oauth-app-static-verifier",
  generatedAt: "2026-06-23T00:00:00.000Z",
  status: "passed",
  scope: {
    proofType: "deterministic static Google OAuth app configuration readiness",
    doesNotClaim: [
      "live Google Cloud Console OAuth app exists",
      "Google OAuth consent screen verification is approved",
      "live Search Console property connection",
      "live Google authorization-code exchange",
      "live dashboard connector proof with real Google credentials"
    ]
  },
  commands: commandResults,
  googleOAuthAppContract: {
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
    "Google OAuth authorization endpoint is accounts.google.com/o/oauth2/v2/auth.",
    "Google OAuth redirect URI is HTTPS and provider-specific.",
    "Google OAuth scopes include openid, email, and Search Console readonly.",
    "Google OAuth requests use authorization-code flow.",
    "Google OAuth requests request offline access and consent prompt.",
    "Google OAuth PKCE S256 is required by the static app contract.",
    "Dashboard provider settings and OAuth callback static gates still pass.",
    "Google Search Console deterministic acceptance still passes."
  ],
  remainingReleaseGates: [
    "Create the real Google OAuth app in Google Cloud Console.",
    "Configure the real authorized redirect URI for the deployed dashboard/API.",
    "Complete Google OAuth consent screen verification if Google requires it.",
    "Run live Google authorization-code exchange and token vault storage.",
    "Connect real Search Console properties for target sites.",
    "Run live dashboard connector proof with real Google credentials."
  ]
};

await mkdir(path.dirname(reportPath), { recursive: true });
await mkdir(path.dirname(samplePath), { recursive: true });
await writeJson(reportPath, report);
await writeJson(samplePath, report);

console.log(
  `Google OAuth app static readiness PASS: ${commandResults.length}/${commands.length} command groups passed`
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

async function writeJson(filePath, value) {
  const json = await format(`${JSON.stringify(value, null, 2)}\n`, {
    parser: "json"
  });
  await writeFile(filePath, json);
}
