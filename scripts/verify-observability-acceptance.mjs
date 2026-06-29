#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const reportPath = "reports/observability-acceptance-report.json";
const samplePath = "docs/examples/observability-acceptance-report.sample.json";

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
    name: "apiObservabilityContractTests",
    command: "pnpm",
    args: [
      "--filter",
      "@searchlint/api",
      "test",
      "--",
      "cloudwatch-log-provisioning-contracts.test.ts",
      "observability-exporter-contracts.test.ts",
      "cloudwatch-emf.test.ts",
      "otlp-runtime-config.test.ts",
      "cloud-observability-iac-provisioning-contracts.test.ts"
    ]
  },
  {
    name: "apiBuild",
    command: "pnpm",
    args: ["--filter", "@searchlint/api", "build"]
  }
];

async function main() {
  const commandResults = commands.map(runCommand);
  const api = await import(
    pathToFileURL(path.resolve("services/api/dist/src/index.js")).href
  );

  const dashboardCase = verifyDashboardCase(api);
  const alertCase = verifyAlertCase(api);
  const redactionCase = verifyRedactionCase(api);
  const report = {
    generatedBy: "searchlint-observability-acceptance-verifier",
    generatedAt: "2026-06-22T00:00:00.000Z",
    status: "passed",
    scope: {
      proofType:
        "deterministic observability, incident, and telemetry redaction proof",
      doesNotClaim: [
        "deployed CloudWatch dashboard",
        "live OTLP collector export",
        "live incident notification delivery",
        "external error tracking SaaS integration",
        "production telemetry review"
      ]
    },
    commands: commandResults,
    cases: {
      dashboard: dashboardCase,
      alertsAndIncidents: alertCase,
      redaction: redactionCase
    },
    remainingReleaseGates: [
      "Deploy CloudWatch dashboards and review live widgets.",
      "Prove live OTLP log, metric, and trace export.",
      "Connect alert actions to production incident channels.",
      "Integrate external error tracking if required by release owner.",
      "Review deployed production logs and telemetry for secret redaction."
    ]
  };

  assertNoSensitiveValues(JSON.stringify(report));
  await mkdir(path.dirname(reportPath), { recursive: true });
  await mkdir(path.dirname(samplePath), { recursive: true });
  await writeJson(reportPath, report);
  await writeJson(samplePath, report);

  console.log(
    `Observability acceptance PASS: ${Object.keys(report.cases).length}/3 evidence groups passed`
  );
  console.log(`Report: ${reportPath}`);
  console.log(`Sample: ${samplePath}`);
}

function verifyDashboardCase(api) {
  const dashboard = api.createObservabilityDashboard(samples(), "production");
  expectEqual(dashboard.widgetCount, 8);
  for (const category of [
    "api",
    "worker",
    "crawler",
    "database",
    "integration",
    "quota",
    "business",
    "incident"
  ]) {
    expectEqual(dashboard.categories.includes(category), true);
  }
  return {
    environment: dashboard.environment,
    widgetCount: dashboard.widgetCount,
    categories: dashboard.categories,
    widgets: dashboard.widgets.map((widget) => ({
      id: widget.id,
      category: widget.category,
      status: widget.status,
      metricNames: widget.metricNames
    }))
  };
}

function verifyAlertCase(api) {
  const evaluations = api.evaluateObservabilityAlerts(alertRules(), samples());
  const routing = api.createIncidentRoutingPlan({
    evaluations,
    rules: alertRules(),
    channels: incidentChannels()
  });
  expectEqual(
    evaluations.some((evaluation) => evaluation.triggered),
    true
  );
  expectEqual(
    routing.every((plan) => plan.status === "routed"),
    true
  );
  return {
    alertRules: alertRules().map((rule) => ({
      id: rule.id,
      metricName: rule.metricName,
      severity: rule.severity,
      threshold: rule.threshold,
      comparator: rule.comparator,
      windowMinutes: rule.windowMinutes
    })),
    evaluations,
    routing
  };
}

function verifyRedactionCase(api) {
  const payload = sensitivePayload();
  const result = api.redactTelemetryPayload(payload);
  expectEqual(result.findings.length >= 8, true);
  expectEqual(api.telemetryPayloadContainsSecret(result.redacted), false);
  assertNoSensitiveValues(JSON.stringify(result.redacted));
  return {
    findingCount: result.findings.length,
    redactedPaths: result.findings.map((finding) => finding.path).sort(),
    sanitizedPayload: result.redacted
  };
}

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

function samples() {
  return [
    sample("ApiServerErrors", "api", 2, "Count"),
    sample("ApiRequestDurationMs", "api", 240, "Milliseconds"),
    sample("WorkerErrors", "worker", 0, "Count"),
    sample("CrawlerFailed", "crawler", 1, "Count"),
    sample("DatabaseSlowQueryMs", "database", 1200, "Milliseconds"),
    sample("ExternalProviderFailures", "integration", 1, "Count"),
    sample("QuotaUsagePercent", "quota", 95, "Percent"),
    sample("BillableCrawlEvents", "business", 12, "Count"),
    sample("OpenIncidents", "incident", 1, "Count")
  ];
}

function sample(name, category, value, unit) {
  return {
    name,
    category,
    value,
    unit,
    serviceName: "searchlint-cloud-api",
    environment: "production",
    observedAt: "2026-06-22T00:00:00.000Z"
  };
}

function alertRules() {
  return [
    {
      id: "api-5xx-critical",
      metricName: "ApiServerErrors",
      severity: "critical",
      threshold: 1,
      comparator: ">=",
      windowMinutes: 5,
      routeTo: "incident-slack"
    },
    {
      id: "quota-warning",
      metricName: "QuotaUsagePercent",
      severity: "warning",
      threshold: 90,
      comparator: ">=",
      windowMinutes: 15,
      routeTo: "ops-email"
    }
  ];
}

function incidentChannels() {
  return [
    {
      id: "incident-slack",
      kind: "slack",
      display: "#searchlint-incidents",
      severities: ["critical"]
    },
    {
      id: "ops-email",
      kind: "email",
      display: "ops@example.test",
      severities: ["warning", "critical"]
    }
  ];
}

function sensitivePayload() {
  return {
    log: {
      authorization: "Bearer google-access-token",
      message: "database failed postgres://user:pass@db.example.test:5432/app",
      nested: {
        privateKey:
          "-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----"
      }
    },
    metric: {
      stripeSecret: "sk_live_123456789",
      webhookSecret: "whsec_123456789"
    },
    trace: {
      attributes: {
        cookie: "session=secret",
        providerToken: "ya29.google-token"
      }
    },
    incident: {
      body: "External alert with Bearer slack-token"
    }
  };
}

function assertNoSensitiveValues(text) {
  const forbidden = [
    /private_key/i,
    /client-secret/i,
    /authorization:/i,
    /bearer\s+/i,
    /sk_live/i,
    /whsec_/i,
    /postgres:\/\/user/i,
    /-----BEGIN PRIVATE KEY-----/i,
    /ya29\./i
  ];
  const match = forbidden.find((pattern) => pattern.test(text));
  if (match) {
    throw new Error(
      `Sensitive value leaked into observability evidence: ${match}`
    );
  }
}

async function writeJson(filePath, data) {
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function expectEqual(actual, expected) {
  if (actual !== expected) {
    throw new Error(
      `Expected ${String(expected)}, received ${String(actual)}.`
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
