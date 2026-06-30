import { createHash } from "node:crypto";

export type ObservabilityMetricCategory =
  | "api"
  | "worker"
  | "crawler"
  | "database"
  | "integration"
  | "quota"
  | "business"
  | "incident";

export type ObservabilityMetricSample = {
  name: string;
  category: ObservabilityMetricCategory;
  value: number;
  unit: "Count" | "Milliseconds" | "Percent" | "Bytes";
  serviceName: string;
  environment: string;
  observedAt: string;
};

export type ObservabilityDashboardWidget = {
  id: string;
  title: string;
  category: ObservabilityMetricCategory;
  metricNames: readonly string[];
  status: "healthy" | "warning" | "critical";
  evidence: string;
};

export type ObservabilityDashboard = {
  environment: string;
  widgetCount: number;
  categories: readonly ObservabilityMetricCategory[];
  widgets: readonly ObservabilityDashboardWidget[];
};

export type ObservabilityAlertSeverity = "warning" | "critical";
export type ObservabilityAlertComparator = ">=" | ">" | "<=" | "<";

export type ObservabilityAlertRule = {
  id: string;
  metricName: string;
  severity: ObservabilityAlertSeverity;
  threshold: number;
  comparator: ObservabilityAlertComparator;
  windowMinutes: number;
  routeTo: string;
};

export type ObservabilityAlertEvaluation = {
  ruleId: string;
  metricName: string;
  triggered: boolean;
  severity: ObservabilityAlertSeverity;
  value?: number;
  threshold: number;
  evidence: string;
};

export type IncidentNotificationChannel = {
  id: string;
  kind: "email" | "slack" | "webhook";
  display: string;
  severities: readonly ObservabilityAlertSeverity[];
};

export type IncidentRoutingPlan = {
  alertRuleId: string;
  severity: ObservabilityAlertSeverity;
  channels: readonly string[];
  status: "routed" | "unrouted";
  evidence: string;
};

export type TelemetryRedactionFinding = {
  path: string;
  reason: string;
};

export type TelemetryRedactionResult<T> = {
  redacted: T;
  findings: readonly TelemetryRedactionFinding[];
};

export type ErrorTrackingSeverity = "warning" | "critical";

export type ErrorTrackingInput = {
  serviceName: string;
  environment: string;
  operation: string;
  error: unknown;
  context?: Record<string, unknown>;
  observedAt: string;
};

export type ErrorTrackingEvent = {
  fingerprint: string;
  serviceName: string;
  environment: string;
  operation: string;
  severity: ErrorTrackingSeverity;
  errorName: string;
  message: string;
  stackSummary: readonly string[];
  context: Record<string, unknown>;
  redactionFindings: readonly TelemetryRedactionFinding[];
  observedAt: string;
  evidence: string;
};

const categories: readonly ObservabilityMetricCategory[] = [
  "api",
  "worker",
  "crawler",
  "database",
  "integration",
  "quota",
  "business",
  "incident"
];

const sensitiveKeyPattern =
  /authorization|cookie|set[-_]?cookie|password|passwd|secret|token|api[-_]?key|private[-_]?key|database[-_]?url|connection[-_]?string|stripe[-_]?secret|webhook[-_]?secret|client[-_]?secret|refresh[-_]?token|access[-_]?token/i;

const sensitiveValuePatterns: readonly RegExp[] = [
  /\bBearer\s+[A-Za-z0-9._~+/=-]+/i,
  /\bsk_(live|test)_[A-Za-z0-9]+/i,
  /\bwhsec_[A-Za-z0-9]+/i,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\bpostgres(?:ql)?:\/\/[^\s"']+/i,
  /\b(?:ya29|xox[baprs]|ghp|github_pat)_[A-Za-z0-9_=-]+/i
];

export function createObservabilityDashboard(
  samples: readonly ObservabilityMetricSample[],
  environment: string
): ObservabilityDashboard {
  const widgets = categories.map((category) =>
    widgetForCategory(samples, category)
  );

  return {
    environment,
    widgetCount: widgets.length,
    categories,
    widgets
  };
}

export function evaluateObservabilityAlerts(
  rules: readonly ObservabilityAlertRule[],
  samples: readonly ObservabilityMetricSample[]
): readonly ObservabilityAlertEvaluation[] {
  return rules.map((rule) => {
    const value = latestMetricValue(samples, rule.metricName);
    const triggered =
      value === undefined
        ? false
        : compareMetric(value, rule.comparator, rule.threshold);
    return {
      ruleId: rule.id,
      metricName: rule.metricName,
      triggered,
      severity: rule.severity,
      ...(value === undefined ? {} : { value }),
      threshold: rule.threshold,
      evidence:
        value === undefined
          ? `${rule.metricName} has no samples in the evaluation window.`
          : `${rule.metricName}=${value} ${rule.comparator} ${rule.threshold} over ${rule.windowMinutes}m is ${triggered ? "triggered" : "not triggered"}.`
    };
  });
}

export function createIncidentRoutingPlan(input: {
  evaluations: readonly ObservabilityAlertEvaluation[];
  rules: readonly ObservabilityAlertRule[];
  channels: readonly IncidentNotificationChannel[];
}): readonly IncidentRoutingPlan[] {
  const rulesById = new Map(input.rules.map((rule) => [rule.id, rule]));
  return input.evaluations
    .filter((evaluation) => evaluation.triggered)
    .map((evaluation) => {
      const rule = rulesById.get(evaluation.ruleId);
      const channels = input.channels
        .filter(
          (channel) =>
            channel.severities.includes(evaluation.severity) &&
            (rule === undefined || channel.id === rule.routeTo)
        )
        .map((channel) => channel.display);
      return {
        alertRuleId: evaluation.ruleId,
        severity: evaluation.severity,
        channels,
        status: channels.length === 0 ? "unrouted" : "routed",
        evidence:
          channels.length === 0
            ? `${evaluation.ruleId} has no matching incident notification channel.`
            : `${evaluation.ruleId} routes to ${channels.join(", ")}.`
      };
    });
}

export function redactTelemetryPayload<T>(
  payload: T
): TelemetryRedactionResult<T> {
  const findings: TelemetryRedactionFinding[] = [];
  const redacted = redactValue(payload, "$", findings) as T;
  return { redacted, findings };
}

export function telemetryPayloadContainsSecret(payload: unknown): boolean {
  const text = JSON.stringify(payload);
  return sensitiveValuePatterns.some((pattern) => pattern.test(text));
}

export function createErrorTrackingEvent(
  input: ErrorTrackingInput
): ErrorTrackingEvent {
  const normalized = normalizeError(input.error);
  const redacted = redactTelemetryPayload({
    message: normalized.message,
    stack: normalized.stack,
    context: input.context ?? {}
  });
  const message =
    typeof redacted.redacted.message === "string"
      ? redacted.redacted.message
      : "Unknown error";
  const stackSummary = Array.isArray(redacted.redacted.stack)
    ? redacted.redacted.stack.filter(
        (line): line is string => typeof line === "string"
      )
    : [];
  const context =
    redacted.redacted.context !== null &&
    typeof redacted.redacted.context === "object" &&
    !Array.isArray(redacted.redacted.context)
      ? redacted.redacted.context
      : {};
  const fingerprint = createErrorFingerprint({
    serviceName: input.serviceName,
    environment: input.environment,
    operation: input.operation,
    errorName: normalized.name,
    message
  });
  const severity = errorSeverity(normalized.name, input.operation);

  return {
    fingerprint,
    serviceName: input.serviceName,
    environment: input.environment,
    operation: input.operation,
    severity,
    errorName: normalized.name,
    message,
    stackSummary,
    context,
    redactionFindings: redacted.findings,
    observedAt: input.observedAt,
    evidence: `${input.operation} ${normalized.name} captured with fingerprint ${fingerprint}.`
  };
}

export function createErrorFingerprint(input: {
  serviceName: string;
  environment: string;
  operation: string;
  errorName: string;
  message: string;
}): string {
  return createHash("sha256")
    .update(
      [
        input.serviceName,
        input.environment,
        input.operation,
        input.errorName,
        input.message
      ].join("\n")
    )
    .digest("hex")
    .slice(0, 32);
}

function widgetForCategory(
  samples: readonly ObservabilityMetricSample[],
  category: ObservabilityMetricCategory
): ObservabilityDashboardWidget {
  const categorySamples = samples.filter(
    (sample) => sample.category === category
  );
  const metricNames = [
    ...new Set(categorySamples.map((sample) => sample.name))
  ].sort();
  const maxValue = categorySamples.reduce(
    (max, sample) => Math.max(max, sample.value),
    0
  );
  const status =
    category === "incident" && maxValue > 0
      ? "critical"
      : maxValue > warningThreshold(category)
        ? "warning"
        : "healthy";
  return {
    id: `${category}-observability`,
    title: `${category} observability`,
    category,
    metricNames,
    status,
    evidence:
      metricNames.length === 0
        ? `${category} dashboard widget is declared but has no current metric samples.`
        : `${category} dashboard widget covers ${metricNames.length} metric(s).`
  };
}

function warningThreshold(category: ObservabilityMetricCategory): number {
  if (category === "api") {
    return 499;
  }
  if (category === "database") {
    return 1000;
  }
  if (category === "quota") {
    return 90;
  }
  return Number.POSITIVE_INFINITY;
}

function latestMetricValue(
  samples: readonly ObservabilityMetricSample[],
  metricName: string
): number | undefined {
  const sorted = samples
    .filter((sample) => sample.name === metricName)
    .sort((left, right) => right.observedAt.localeCompare(left.observedAt));
  return sorted[0]?.value;
}

function compareMetric(
  value: number,
  comparator: ObservabilityAlertComparator,
  threshold: number
): boolean {
  if (comparator === ">=") {
    return value >= threshold;
  }
  if (comparator === ">") {
    return value > threshold;
  }
  if (comparator === "<=") {
    return value <= threshold;
  }
  return value < threshold;
}

function normalizeError(error: unknown): {
  name: string;
  message: string;
  stack: readonly string[];
} {
  if (error instanceof Error) {
    return {
      name: error.name || "Error",
      message: error.message || "Unknown error",
      stack: stackSummary(error.stack)
    };
  }
  if (typeof error === "string") {
    return {
      name: "Error",
      message: error,
      stack: []
    };
  }
  return {
    name: "NonErrorThrow",
    message: JSON.stringify(error),
    stack: []
  };
}

function stackSummary(stack: string | undefined): readonly string[] {
  if (!stack) return [];
  return stack
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 5);
}

function errorSeverity(
  errorName: string,
  operation: string
): ErrorTrackingSeverity {
  if (/auth|billing|vault|security|token|permission/i.test(operation)) {
    return "critical";
  }
  if (/TypeError|ReferenceError|SyntaxError|RangeError/u.test(errorName)) {
    return "critical";
  }
  return "warning";
}

function redactValue(
  value: unknown,
  path: string,
  findings: TelemetryRedactionFinding[]
): unknown {
  if (Array.isArray(value)) {
    return value.map((item, index) =>
      redactValue(item, `${path}[${index}]`, findings)
    );
  }

  if (value !== null && typeof value === "object") {
    const redacted: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      const childPath = `${path}.${key}`;
      if (sensitiveKeyPattern.test(key)) {
        findings.push({ path: childPath, reason: "sensitive key" });
        redacted[key] = "[REDACTED]";
      } else {
        redacted[key] = redactValue(child, childPath, findings);
      }
    }
    return redacted;
  }

  if (typeof value === "string") {
    let redacted = value;
    for (const pattern of sensitiveValuePatterns) {
      if (pattern.test(redacted)) {
        findings.push({ path, reason: "sensitive value" });
        redacted = redacted.replace(pattern, "[REDACTED]");
      }
    }
    return redacted;
  }

  return value;
}
