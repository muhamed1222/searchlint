#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { format } from "prettier";

const reportPath = "reports/observability-error-tracking-report.json";
const samplePath =
  "docs/examples/observability-error-tracking-report.sample.json";
const generatedAt = "2026-06-23T00:00:00.000Z";

const commands = [
  {
    name: "apiObservabilityTests",
    command: "pnpm",
    args: [
      "--filter",
      "@searchlint/api",
      "test",
      "--",
      "observability-release.test.ts"
    ]
  },
  {
    name: "apiBuild",
    command: "pnpm",
    args: ["--filter", "@searchlint/api", "build"]
  }
];

const commandResults = commands.map(runCommand);
const api = await import(
  pathToFileURL(path.resolve("services/api/dist/src/index.js")).href
);

const typeError = new TypeError(
  "database failed postgres://user:pass@db.example.test:5432/app"
);
typeError.stack = [
  "TypeError: database failed postgres://user:pass@db.example.test:5432/app",
  "at apiCheck (services/api/src/api.ts:1:1)",
  "at oauthToken (Bearer provider-token)"
].join("\n");

const first = api.createErrorTrackingEvent({
  serviceName: "searchlint-cloud-api",
  environment: "production",
  operation: "api.check",
  observedAt: generatedAt,
  error: typeError,
  context: {
    organizationId: "org-1",
    authorization: "Bearer customer-token"
  }
});
const second = api.createErrorTrackingEvent({
  serviceName: "searchlint-cloud-api",
  environment: "production",
  operation: "api.check",
  observedAt: "2026-06-23T00:01:00.000Z",
  error: typeError,
  context: {
    organizationId: "org-1",
    authorization: "Bearer customer-token"
  }
});
const vaultError = api.createErrorTrackingEvent({
  serviceName: "searchlint-cloud-api",
  environment: "production",
  operation: "oauth-vault.refresh",
  observedAt: generatedAt,
  error: new Error("refresh failed for token reference"),
  context: {
    tokenReference: "oauth-token-reference-1"
  }
});

assert(first.fingerprint === second.fingerprint, "Fingerprint must be stable.");
assert(/^[a-f0-9]{32}$/u.test(first.fingerprint), "Fingerprint shape drifted.");
assert(first.severity === "critical", "TypeError must be critical.");
assert(vaultError.severity === "critical", "Vault errors must be critical.");
assert(
  first.redactionFindings.length >= 4,
  "Error event must include redaction findings."
);
assertNoSensitiveValues(JSON.stringify([first, second, vaultError]));

const report = {
  generatedBy: "searchlint-observability-error-tracking-verifier",
  generatedAt,
  status: "passed",
  scope: {
    proofType: "deterministic local error-tracking contract",
    doesNotClaim: [
      "external error tracking SaaS integration",
      "live CloudWatch error dashboard",
      "live OTLP export",
      "production incident delivery"
    ]
  },
  commands: commandResults,
  cases: {
    stableFingerprint: {
      status: "passed",
      fingerprint: first.fingerprint
    },
    redaction: {
      status: "passed",
      findingCount: first.redactionFindings.length,
      findingPaths: first.redactionFindings.map((finding) => finding.path)
    },
    severityMapping: {
      status: "passed",
      typeErrorSeverity: first.severity,
      vaultErrorSeverity: vaultError.severity
    },
    sanitizedEvent: {
      status: "passed",
      event: first
    }
  },
  remainingReleaseGates: [
    "Deploy logging, metrics, and tracing in AWS.",
    "Prove live CloudWatch/OTLP error event delivery.",
    "Connect production incident channels.",
    "Integrate external error tracking SaaS if required by the release owner."
  ]
};

await mkdir(path.dirname(reportPath), { recursive: true });
await mkdir(path.dirname(samplePath), { recursive: true });
await writeJson(reportPath, report);
await writeJson(samplePath, report);

console.log("Observability error tracking PASS.");
console.log(`Report: ${reportPath}`);
console.log(`Sample: ${samplePath}`);

function runCommand(command) {
  const result = spawnSync(command.command, command.args, {
    stdio: "pipe",
    encoding: "utf8"
  });
  if (result.status !== 0) {
    process.stderr.write(result.stdout);
    process.stderr.write(result.stderr);
    throw new Error(`${command.name} failed with exit code ${result.status}.`);
  }
  return {
    name: command.name,
    command: [command.command, ...command.args].join(" "),
    status: "passed"
  };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertNoSensitiveValues(text) {
  const forbidden = [
    /private_key/i,
    /client-secret/i,
    /authorization:\s*Bearer/i,
    /bearer\s+[a-z0-9._~+/=-]+/i,
    /cookie:/i,
    /set-cookie:/i,
    /sk_live/i,
    /whsec_/i,
    /postgres:\/\//i,
    /-----BEGIN PRIVATE KEY-----/i,
    /ya29\./i,
    /xox[baprs]-/i,
    /provider-token/i,
    /customer-token/i
  ];
  const match = forbidden.find((pattern) => pattern.test(text));
  if (match) {
    throw new Error(
      `Sensitive value leaked into error tracking evidence: ${match}`
    );
  }
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(
    filePath,
    await format(`${JSON.stringify(value, null, 2)}\n`, { parser: "json" })
  );
}
