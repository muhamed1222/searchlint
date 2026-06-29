#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { format } from "prettier";

const reportPath = "reports/dast-release-gate-report.json";
const samplePath = "docs/examples/dast-release-gate-report.sample.json";
const generatedAt = "2026-06-23T00:00:00.000Z";
const requiredEnv = [
  "SEARCHLINT_DAST_LIVE",
  "SEARCHLINT_DAST_DASHBOARD_URL",
  "SEARCHLINT_DAST_API_URL"
];
const xssPayload = "<script>searchlint-dast</script>";
const liveEnabled = process.env.SEARCHLINT_DAST_LIVE === "1";
const missingEnv = requiredEnv.filter((name) => !process.env[name]);
const issues = [];
const targetValidation = [];
const probes = [];

if (!liveEnabled) {
  issues.push({
    severity: "blocker",
    code: "live-mode-disabled",
    message: "Set SEARCHLINT_DAST_LIVE=1 to run deployed-target DAST."
  });
}

for (const name of missingEnv) {
  issues.push({
    severity: "blocker",
    code: "missing-live-env",
    message: `${name} is required for DAST release evidence.`,
    env: name
  });
}

let dashboardUrl;
let apiUrl;

if (issues.length === 0) {
  dashboardUrl = await validateTargetUrl(
    "SEARCHLINT_DAST_DASHBOARD_URL",
    process.env.SEARCHLINT_DAST_DASHBOARD_URL
  );
  apiUrl = await validateTargetUrl(
    "SEARCHLINT_DAST_API_URL",
    process.env.SEARCHLINT_DAST_API_URL
  );
}

if (issues.length === 0) {
  probes.push(await probeDashboardLoad(dashboardUrl));
  probes.push(await probeDashboardSecurityHeaders(dashboardUrl));
  probes.push(await probeReflectedXss(dashboardUrl));
  probes.push(await probeApiUnauthenticated(apiUrl));
  probes.push(await probeApiInvalidJson(apiUrl));
  probes.push(await probeApiUnsafeMethod(apiUrl));
  probes.push(await probeApiSecurityHeaders(apiUrl));

  for (const probe of probes) {
    if (probe.status !== "passed") {
      issues.push({
        severity: "blocker",
        code: "dast-probe-failed",
        message: `${probe.id} failed.`,
        probeId: probe.id
      });
    }
  }
}

const report = {
  generatedBy: "searchlint-dast-release-gate-verifier",
  generatedAt,
  status: issues.length === 0 ? "passed" : "blocked",
  scope: {
    proofType: "deployed production-equivalent DAST release gate",
    doesNotClaim:
      issues.length === 0
        ? ["independent penetration test", "legal/security approval"]
        : [
            "DAST pass",
            "independent penetration test",
            "legal/security approval",
            "production security approval"
          ]
  },
  liveMode: {
    enabled: liveEnabled,
    requiredEnv: requiredEnv.map((name) => ({
      name,
      provided: Boolean(process.env[name]),
      value: process.env[name] ? "<redacted>" : null
    }))
  },
  targetValidation,
  probes,
  releaseGate: {
    passFail: issues.length === 0 ? "pass" : "fail",
    gates: {
      liveModeEnabled: liveEnabled,
      requiredEnvironmentProvided: missingEnv.length === 0,
      dashboardTargetAccepted:
        targetValidation.find(
          (target) => target.env === "SEARCHLINT_DAST_DASHBOARD_URL"
        )?.status === "passed",
      apiTargetAccepted:
        targetValidation.find(
          (target) => target.env === "SEARCHLINT_DAST_API_URL"
        )?.status === "passed",
      allProbesPassed:
        probes.length > 0 && probes.every((probe) => probe.status === "passed"),
      evidenceSanitized: true
    }
  },
  issues,
  remainingReleaseGates:
    issues.length === 0
      ? [
          "Owner review and approval of the DAST report.",
          "Independent penetration test report and remediation sign-off.",
          "Final legal/security release approval."
        ]
      : [
          "Deploy production-equivalent dashboard and API targets.",
          "Set SEARCHLINT_DAST_LIVE=1.",
          "Set SEARCHLINT_DAST_DASHBOARD_URL and SEARCHLINT_DAST_API_URL.",
          "Run pnpm security:dast against deployed HTTPS targets.",
          "Review and approve the DAST report."
        ]
};
report.releaseGate.failedGates = Object.entries(report.releaseGate.gates)
  .filter(([, passed]) => !passed)
  .map(([gate]) => gate);

assertNoSensitiveValues(JSON.stringify(report));
await writeJson(reportPath, report);
await writeJson(samplePath, report);

if (report.status !== "passed") {
  console.error("DAST release gate blocked.");
  for (const issue of issues) {
    console.error(`- ${issue.code}: ${issue.message}`);
  }
  console.error(`Report: ${reportPath}`);
  console.error(`Sample: ${samplePath}`);
  process.exitCode = 1;
} else {
  console.log("DAST release gate PASS: deployed targets passed safe probes.");
  console.log(`Report: ${reportPath}`);
  console.log(`Sample: ${samplePath}`);
}

async function validateTargetUrl(envName, value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    addTargetIssue(envName, "invalid-url", `${envName} must be a valid URL.`);
    return undefined;
  }

  const result = {
    env: envName,
    status: "passed",
    protocol: url.protocol,
    host: redactHost(url),
    pathname: url.pathname,
    checks: {
      https: url.protocol === "https:",
      noCredentials: url.username === "" && url.password === "",
      notLocalhost: !isLocalhost(url.hostname),
      notLiteralPrivateIp: !isLiteralPrivateIp(url.hostname),
      notPlaceholder: !isPlaceholderHost(url.hostname)
    }
  };

  if (Object.values(result.checks).some((passed) => !passed)) {
    result.status = "failed";
    addTargetIssue(
      envName,
      "target-url-rejected",
      `${envName} must be HTTPS, deployed, non-placeholder, and non-local.`
    );
  }

  targetValidation.push(result);
  return result.status === "passed" ? url : undefined;
}

function addTargetIssue(envName, code, message) {
  issues.push({
    severity: "blocker",
    code,
    message,
    env: envName
  });
}

async function probeDashboardLoad(baseUrl) {
  const response = await fetchWithTimeout(baseUrl, {
    method: "GET",
    redirect: "manual"
  });
  return {
    id: "dashboard-load-no-5xx",
    target: "dashboard",
    status: response.status < 500 ? "passed" : "failed",
    httpStatus: response.status
  };
}

async function probeDashboardSecurityHeaders(baseUrl) {
  const response = await fetchWithTimeout(baseUrl, {
    method: "GET",
    redirect: "manual"
  });
  const headers = normalizeHeaders(response.headers);
  const checks = {
    contentTypeOptions: headers["x-content-type-options"] === "nosniff",
    frameProtection:
      Boolean(
        headers["content-security-policy"]?.includes("frame-ancestors")
      ) || ["deny", "sameorigin"].includes(headers["x-frame-options"] ?? ""),
    noServerDisclosure: !headers.server,
    hsts: Boolean(headers["strict-transport-security"])
  };
  return {
    id: "dashboard-security-headers",
    target: "dashboard",
    status: Object.values(checks).every(Boolean) ? "passed" : "failed",
    httpStatus: response.status,
    checks
  };
}

async function probeReflectedXss(baseUrl) {
  const url = new URL(baseUrl);
  url.searchParams.set("searchlint_dast", xssPayload);
  const response = await fetchWithTimeout(url, {
    method: "GET",
    redirect: "manual"
  });
  const body = await boundedText(response);
  const reflectedRawPayload = body.includes(xssPayload);
  return {
    id: "dashboard-reflected-xss-query",
    target: "dashboard",
    status: !reflectedRawPayload && response.status < 500 ? "passed" : "failed",
    httpStatus: response.status,
    reflectedRawPayload
  };
}

async function probeApiUnauthenticated(baseUrl) {
  const url = apiUrlFor(baseUrl, "/v1/dashboard/snapshot");
  const response = await fetchWithTimeout(url, {
    method: "GET",
    redirect: "manual"
  });
  return {
    id: "api-unauthenticated-boundary",
    target: "api",
    status: [401, 403, 404].includes(response.status) ? "passed" : "failed",
    httpStatus: response.status
  };
}

async function probeApiInvalidJson(baseUrl) {
  const url = apiUrlFor(baseUrl, "/v1/crawls");
  const response = await fetchWithTimeout(url, {
    method: "POST",
    body: "{invalid-json",
    headers: {
      "content-type": "application/json"
    },
    redirect: "manual"
  });
  return {
    id: "api-invalid-json-boundary",
    target: "api",
    status:
      response.status >= 400 && response.status < 500 ? "passed" : "failed",
    httpStatus: response.status
  };
}

async function probeApiUnsafeMethod(baseUrl) {
  const response = await fetchWithTimeout(
    apiUrlFor(baseUrl, "/v1/dashboard/snapshot"),
    {
      method: "TRACE",
      redirect: "manual"
    }
  );
  return {
    id: "api-unsafe-method-boundary",
    target: "api",
    status:
      response.status >= 400 && response.status < 500 ? "passed" : "failed",
    httpStatus: response.status
  };
}

async function probeApiSecurityHeaders(baseUrl) {
  const response = await fetchWithTimeout(
    apiUrlFor(baseUrl, "/v1/dashboard/snapshot"),
    {
      method: "GET",
      redirect: "manual"
    }
  );
  const headers = normalizeHeaders(response.headers);
  const checks = {
    contentTypeOptions: headers["x-content-type-options"] === "nosniff",
    noServerDisclosure: !headers.server,
    noCorsWildcardWithCredentials:
      headers["access-control-allow-origin"] !== "*" ||
      headers["access-control-allow-credentials"] !== "true"
  };
  return {
    id: "api-security-headers",
    target: "api",
    status: Object.values(checks).every(Boolean) ? "passed" : "failed",
    httpStatus: response.status,
    checks
  };
}

function apiUrlFor(baseUrl, pathname) {
  const url = new URL(baseUrl);
  url.pathname = pathname;
  url.search = "";
  return url;
}

async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "user-agent": "SearchLint-DAST/1.0",
        ...(options.headers ?? {})
      }
    });
  } finally {
    clearTimeout(timer);
  }
}

async function boundedText(response) {
  const text = await response.text();
  return text.slice(0, 250000);
}

function normalizeHeaders(headers) {
  return Object.fromEntries(
    [...headers.entries()].map(([name, value]) => [
      name.toLowerCase(),
      value.toLowerCase()
    ])
  );
}

function isPlaceholderHost(hostname) {
  return /(^|\.)example\.(com|org|net)$/iu.test(hostname);
}

function isLocalhost(hostname) {
  return ["localhost", "127.0.0.1", "::1"].includes(hostname.toLowerCase());
}

function isLiteralPrivateIp(hostname) {
  const cleanHost = hostname.replace(/^\[/u, "").replace(/\]$/u, "");
  if (net.isIPv4(cleanHost)) {
    const parts = cleanHost.split(".").map(Number);
    return (
      parts[0] === 10 ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
      (parts[0] === 192 && parts[1] === 168) ||
      parts[0] === 127 ||
      (parts[0] === 169 && parts[1] === 254)
    );
  }
  if (net.isIPv6(cleanHost)) {
    const lower = cleanHost.toLowerCase();
    return (
      lower === "::1" ||
      lower.startsWith("fc") ||
      lower.startsWith("fd") ||
      lower.startsWith("fe80:")
    );
  }
  return false;
}

function redactHost(url) {
  return `${url.protocol}//<redacted-host>${url.pathname === "/" ? "" : url.pathname}`;
}

function assertNoSensitiveValues(text) {
  const forbidden = [
    /private_key/i,
    /client-secret/i,
    /authorization:/i,
    /bearer\s+/i,
    /cookie:/i,
    /set-cookie:/i,
    /sk_live/i,
    /whsec_/i,
    /postgres:\/\//i,
    /-----BEGIN PRIVATE KEY-----/i,
    /ya29\./i,
    /xox[baprs]-/i
  ];
  const match = forbidden.find((pattern) => pattern.test(text));
  if (match) {
    throw new Error(`Sensitive value leaked into DAST evidence: ${match}`);
  }
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(
    filePath,
    await format(`${JSON.stringify(value, null, 2)}\n`, { parser: "json" })
  );
}
