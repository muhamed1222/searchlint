import { describe, expect, it } from "vitest";
import {
  createErrorTrackingEvent,
  createIncidentRoutingPlan,
  createObservabilityDashboard,
  evaluateObservabilityAlerts,
  redactTelemetryPayload,
  telemetryPayloadContainsSecret,
  type IncidentNotificationChannel,
  type ObservabilityAlertRule,
  type ObservabilityMetricSample
} from "../src/index.js";

describe("observability release acceptance helpers", () => {
  it("creates dashboard widgets for all release observability categories", () => {
    const dashboard = createObservabilityDashboard(samples(), "production");

    expect(dashboard.environment).toBe("production");
    expect(dashboard.widgetCount).toBe(8);
    expect(dashboard.categories).toEqual([
      "api",
      "worker",
      "crawler",
      "database",
      "integration",
      "quota",
      "business",
      "incident"
    ]);
    expect(
      dashboard.widgets.map((widget) => [widget.category, widget.metricNames])
    ).toEqual([
      ["api", ["ApiRequestDurationMs", "ApiServerErrors"]],
      ["worker", ["WorkerErrors"]],
      ["crawler", ["CrawlerFailed"]],
      ["database", ["DatabaseSlowQueryMs"]],
      ["integration", ["ExternalProviderFailures"]],
      ["quota", ["QuotaUsagePercent"]],
      ["business", ["BillableCrawlEvents"]],
      ["incident", ["OpenIncidents"]]
    ]);
    expect(
      dashboard.widgets.find((widget) => widget.category === "incident")?.status
    ).toBe("critical");
  });

  it("evaluates alert rules and routes triggered incidents", () => {
    const evaluations = evaluateObservabilityAlerts(alertRules(), samples());
    const routing = createIncidentRoutingPlan({
      evaluations,
      rules: alertRules(),
      channels: incidentChannels()
    });

    expect(evaluations).toEqual([
      expect.objectContaining({
        ruleId: "api-5xx-critical",
        metricName: "ApiServerErrors",
        triggered: true,
        severity: "critical",
        value: 2
      }),
      expect.objectContaining({
        ruleId: "quota-warning",
        metricName: "QuotaUsagePercent",
        triggered: true,
        severity: "warning",
        value: 95
      }),
      expect.objectContaining({
        ruleId: "worker-errors-critical",
        metricName: "WorkerErrors",
        triggered: false,
        severity: "critical",
        value: 0
      })
    ]);
    expect(routing).toEqual([
      expect.objectContaining({
        alertRuleId: "api-5xx-critical",
        severity: "critical",
        channels: ["#searchlint-incidents"],
        status: "routed"
      }),
      expect.objectContaining({
        alertRuleId: "quota-warning",
        severity: "warning",
        channels: ["ops@example.test"],
        status: "routed"
      })
    ]);
  });

  it("redacts secrets from logs, metrics, traces, and incident payloads", () => {
    const payload = {
      log: {
        authorization: "Bearer google-access-token",
        message:
          "database failed postgres://user:pass@db.example.test:5432/app",
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

    const result = redactTelemetryPayload(payload);

    expect(result.findings.map((finding) => finding.path).sort()).toEqual([
      "$.incident.body",
      "$.log.authorization",
      "$.log.message",
      "$.log.nested.privateKey",
      "$.metric.stripeSecret",
      "$.metric.webhookSecret",
      "$.trace.attributes.cookie",
      "$.trace.attributes.providerToken"
    ]);
    expect(telemetryPayloadContainsSecret(result.redacted)).toBe(false);
    expect(JSON.stringify(result.redacted)).toContain("[REDACTED]");
  });

  it("creates redacted stable error tracking events", () => {
    const error = new TypeError(
      "failed with postgres://user:pass@db.example.test:5432/app"
    );
    error.stack = [
      "TypeError: failed with postgres://user:pass@db.example.test:5432/app",
      "at handler (src/api.ts:1:1)",
      "at token (Bearer provider-token)"
    ].join("\n");

    const first = createErrorTrackingEvent({
      serviceName: "searchlint-cloud-api",
      environment: "production",
      operation: "api.check",
      observedAt: "2026-06-23T00:00:00.000Z",
      error,
      context: {
        organizationId: "org-1",
        authorization: "Bearer customer-token"
      }
    });
    const second = createErrorTrackingEvent({
      serviceName: "searchlint-cloud-api",
      environment: "production",
      operation: "api.check",
      observedAt: "2026-06-23T00:01:00.000Z",
      error,
      context: {
        organizationId: "org-1",
        authorization: "Bearer customer-token"
      }
    });

    expect(first.fingerprint).toBe(second.fingerprint);
    expect(first.fingerprint).toMatch(/^[a-f0-9]{32}$/);
    expect(first.severity).toBe("critical");
    expect(JSON.stringify(first)).not.toContain("postgres://");
    expect(JSON.stringify(first)).not.toContain("customer-token");
    expect(JSON.stringify(first)).not.toContain("provider-token");
    expect(first.context).toEqual({
      organizationId: "org-1",
      authorization: "[REDACTED]"
    });
    expect(first.redactionFindings.map((finding) => finding.path)).toEqual([
      "$.message",
      "$.stack[0]",
      "$.stack[2]",
      "$.context.authorization"
    ]);
  });
});

function samples(): readonly ObservabilityMetricSample[] {
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

function sample(
  name: string,
  category: ObservabilityMetricSample["category"],
  value: number,
  unit: ObservabilityMetricSample["unit"]
): ObservabilityMetricSample {
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

function alertRules(): readonly ObservabilityAlertRule[] {
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
    },
    {
      id: "worker-errors-critical",
      metricName: "WorkerErrors",
      severity: "critical",
      threshold: 1,
      comparator: ">=",
      windowMinutes: 5,
      routeTo: "incident-slack"
    }
  ];
}

function incidentChannels(): readonly IncidentNotificationChannel[] {
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
