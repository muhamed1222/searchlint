#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { format } from "prettier";

const reportPath = "reports/notifications-acceptance-report.json";
const samplePath = "docs/examples/notifications-acceptance-report.sample.json";

const commands = [
  {
    name: "dashboardBuild",
    command: "pnpm",
    args: ["--filter", "@searchlint/dashboard...", "build"]
  },
  {
    name: "apiNotificationTests",
    command: "pnpm",
    args: ["--filter", "@searchlint/api", "test", "--", "notifications.test.ts"]
  },
  {
    name: "dashboardNotificationTests",
    command: "pnpm",
    args: [
      "--filter",
      "@searchlint/dashboard",
      "test",
      "--",
      "dashboard.test.ts"
    ]
  }
];

async function main() {
  const commandResults = commands.map(runCommand);
  const api = await import(
    pathToFileURL(path.resolve("services/api/dist/src/index.js")).href
  );
  const dashboard = await import(
    pathToFileURL(path.resolve("apps/dashboard/dist/src/index.js")).href
  );

  const notificationCase = verifyNotificationCase(api);
  const dashboardCase = verifyDashboardCase(dashboard);
  const report = {
    generatedBy: "searchlint-notifications-acceptance-verifier",
    generatedAt: "2026-06-22T00:00:00.000Z",
    status: "passed",
    scope: {
      proofType: "deterministic local/static notification proof",
      doesNotClaim: [
        "live email delivery",
        "live Slack delivery",
        "live webhook HTTP delivery",
        "live Telegram Bot API delivery",
        "deployed scheduler or worker delivery",
        "secret-backed target management"
      ]
    },
    commands: commandResults,
    cases: {
      notifications: notificationCase,
      dashboard: dashboardCase
    },
    remainingReleaseGates: [
      "Provision real notification provider credentials through the approved vault.",
      "Send and verify live email, Slack, webhook, and optional Telegram deliveries.",
      "Deploy notification workers and scheduler.",
      "Persist notification settings and delivery history in production storage.",
      "Expose full dashboard notification settings editing and delivery history.",
      "Review provider payload redaction in deployed logs and telemetry."
    ]
  };

  assertNoForbiddenSecrets(JSON.stringify(report));
  await mkdir(path.dirname(reportPath), { recursive: true });
  await mkdir(path.dirname(samplePath), { recursive: true });
  await writeJson(reportPath, report);
  await writeJson(samplePath, report);

  console.log(
    `Notifications acceptance PASS: ${Object.keys(report.cases).length}/2 evidence groups passed`
  );
  console.log(`Report: ${reportPath}`);
  console.log(`Sample: ${samplePath}`);
}

function verifyNotificationCase(api) {
  const channels = notificationChannels();
  const rules = notificationRules();
  const events = notificationEvents();
  const evaluation = api.evaluateNotificationRules({
    rules,
    channels,
    events,
    now: "2026-06-22T12:00:00.000Z"
  });
  const retryPlan = api.planNotificationRetry({
    task: evaluation.tasks.find((task) => task.channelKind === "webhook"),
    failedAttempt: deliveryAttempt({
      id: "attempt-webhook-1",
      taskId: "notification-task-rule-digest-webhook-1-daily-2026-06-22",
      channelId: "webhook-1",
      channelKind: "webhook",
      status: "failed",
      attempt: 1,
      failureReason: "HTTP 503 from provider."
    }),
    now: "2026-06-22T12:00:00.000Z",
    maxAttempts: 3,
    backoffMinutes: [5, 15, 60]
  });
  const attempts = [
    deliveryAttempt({ id: "attempt-email-1", status: "delivered" }),
    deliveryAttempt({
      id: "attempt-webhook-1",
      channelId: "webhook-1",
      channelKind: "webhook",
      status: "retry_scheduled",
      attempt: 1,
      failureReason: "HTTP 503 from provider.",
      nextRetryAt: retryPlan.nextRetryAt
    }),
    deliveryAttempt({
      id: "attempt-slack-1",
      channelId: "slack-1",
      channelKind: "slack",
      status: "pending"
    }),
    deliveryAttempt({
      id: "attempt-telegram-1",
      channelId: "telegram-1",
      channelKind: "telegram",
      status: "suppressed"
    })
  ];
  const settingsSummary = api.summarizeNotificationSettings({
    channels,
    rules
  });
  const historySummary = api.summarizeNotificationDeliveryHistory(attempts);
  const metricEvents = api.notificationAttemptsToMetricEvents({
    organizationId: "org-1",
    attempts
  });

  expectEqual(
    [...new Set(evaluation.tasks.map((task) => task.channelKind))].sort(),
    ["email", "slack", "webhook"]
  );
  expectEqual(
    evaluation.tasks.some((task) => task.digest === "daily"),
    true
  );
  expectEqual(retryPlan.status, "retry_scheduled");
  expectEqual(settingsSummary.channelCount, 4);
  expectEqual(historySummary.retryScheduled, 1);
  expectEqual(metricEvents.length, 4);
  expectEqual(
    evaluation.tasks.every((task) => !task.targetDisplay.includes("token")),
    true
  );

  return {
    settingsSummary,
    historySummary,
    retryPlan,
    taskCount: evaluation.tasks.length,
    suppressionReasons: [
      ...new Set(evaluation.suppressions.map((item) => item.reason))
    ].sort(),
    taskChannels: evaluation.tasks.map((task) => ({
      channelKind: task.channelKind,
      targetDisplay: task.targetDisplay,
      digest: task.digest,
      eventIds: task.eventIds,
      scheduledFor: task.scheduledFor
    })),
    metricEventNames: metricEvents.map((event) => event.name)
  };
}

function verifyDashboardCase(dashboard) {
  const html = dashboard.renderDashboardProjectSectionHtml(
    dashboard.createDashboardProjectSectionModel(
      dashboardSnapshot(),
      "settings"
    )
  );
  requireIncludes(html, "Notification channels");
  requireIncludes(html, "Notification rules");
  requireIncludes(html, "Notification delivery history");
  requireIncludes(html, "a***@example.com");
  requireIncludes(html, "#seo-alerts");
  requireIncludes(html, "retry_scheduled");
  requireNotIncludes(html, "xoxb-");
  requireNotIncludes(html, "bot-token");
  requireNotIncludes(html, "token=secret");
  return {
    renderedSettingsTables: [
      "Notification channels",
      "Notification rules",
      "Notification delivery history"
    ],
    sanitizedTargets: ["a***@example.com", "#seo-alerts", "telegram-chat"],
    retryStatusRendered: true
  };
}

function notificationChannels() {
  return [
    channel({
      id: "email-1",
      kind: "email",
      name: "SEO email alerts",
      targetDisplay: "alerts@example.com"
    }),
    channel({
      id: "slack-1",
      kind: "slack",
      name: "SEO Slack alerts",
      targetDisplay: "#seo-alerts"
    }),
    channel({
      id: "webhook-1",
      kind: "webhook",
      name: "Webhook automation",
      targetDisplay: "https://hooks.example.test/searchlint?token=secret"
    }),
    channel({
      id: "telegram-1",
      kind: "telegram",
      name: "Telegram operator",
      targetDisplay: "123456:bot-token"
    })
  ];
}

function notificationRules() {
  return [
    rule({
      id: "rule-blocker",
      name: "Blocker alerts",
      eventKinds: ["diagnostic.created"],
      channelIds: ["email-1", "slack-1"],
      severityThreshold: "blocker",
      digest: "immediate"
    }),
    rule({
      id: "rule-digest",
      name: "Daily operations digest",
      eventKinds: [
        "external_observation.stale",
        "quota.exhausted",
        "report.generated"
      ],
      channelIds: ["webhook-1"],
      digest: "daily"
    }),
    rule({
      id: "rule-muted",
      name: "Muted Telegram alerts",
      eventKinds: ["diagnostic.created"],
      channelIds: ["telegram-1"],
      severityThreshold: "warning",
      digest: "immediate",
      mutedUntil: "2026-06-22T18:00:00.000Z"
    })
  ];
}

function notificationEvents() {
  return [
    event({
      id: "event-blocker",
      kind: "diagnostic.created",
      severity: "blocker",
      subject: "SL-META-001 on /products/widget"
    }),
    event({
      id: "event-warning",
      kind: "diagnostic.created",
      severity: "warning",
      subject: "SL-IMG-001 on /blog"
    }),
    event({
      id: "event-stale",
      kind: "external_observation.stale",
      subject: "Google observation stale"
    }),
    event({
      id: "event-quota",
      kind: "quota.exhausted",
      subject: "Monthly external API quota exhausted"
    }),
    event({
      id: "event-report",
      kind: "report.generated",
      subject: "Weekly report generated"
    })
  ];
}

function dashboardSnapshot() {
  return {
    organization: { id: "org-1", name: "Acme Agency" },
    project: {
      id: "project-1",
      name: "Example Store",
      siteUrl: "https://example.test"
    },
    environment: {
      id: "env-1",
      name: "Production",
      baseUrl: "https://example.test"
    },
    diagnostics: [],
    crawlRuns: [],
    trends: [],
    externalObservations: [],
    reports: [],
    quotas: [],
    teamMembers: [],
    notificationChannels: [
      {
        id: "email-1",
        kind: "email",
        name: "SEO email alerts",
        targetDisplay: "a***@example.com",
        enabled: true
      },
      {
        id: "slack-1",
        kind: "slack",
        name: "SEO Slack alerts",
        targetDisplay: "#seo-alerts",
        enabled: true
      },
      {
        id: "telegram-1",
        kind: "telegram",
        name: "Telegram operator",
        targetDisplay: "telegram-chat",
        enabled: true
      }
    ],
    notificationRules: [
      {
        id: "rule-blocker",
        name: "Blocker alerts",
        eventKinds: ["diagnostic.created"],
        channelIds: ["email-1", "slack-1"],
        severityThreshold: "blocker",
        digest: "immediate",
        enabled: true
      }
    ],
    notificationDeliveryAttempts: [
      {
        id: "attempt-webhook-1",
        channelKind: "webhook",
        status: "retry_scheduled",
        attemptedAt: "2026-06-22T12:05:00.000Z",
        attempt: 1,
        failureReason: "HTTP 503 from provider.",
        nextRetryAt: "2026-06-22T12:10:00.000Z"
      }
    ]
  };
}

function channel(overrides = {}) {
  const kind = overrides.kind ?? "email";
  return {
    id: "email-1",
    organizationId: "org-1",
    projectId: "project-1",
    environmentId: "env-1",
    kind,
    name: `${kind} channel`,
    target: {
      display: overrides.targetDisplay ?? "alerts@example.com",
      secretRef: `secret://${kind}/target`
    },
    enabled: true,
    createdAt: "2026-06-22T00:00:00.000Z",
    ...overrides
  };
}

function rule(overrides = {}) {
  return {
    id: "rule-1",
    organizationId: "org-1",
    projectId: "project-1",
    environmentId: "env-1",
    name: "Blocker notifications",
    eventKinds: ["diagnostic.created"],
    channelIds: ["email-1"],
    severityThreshold: "blocker",
    digest: "immediate",
    enabled: true,
    createdAt: "2026-06-22T00:00:00.000Z",
    ...overrides
  };
}

function event(overrides = {}) {
  return {
    id: "event-1",
    organizationId: "org-1",
    projectId: "project-1",
    environmentId: "env-1",
    kind: "diagnostic.created",
    occurredAt: "2026-06-22T12:00:00.000Z",
    severity: "blocker",
    subject: "SL-META-001 on /products/widget",
    summary: "SearchLint notification event.",
    evidence: "Deterministic fixture evidence.",
    ...overrides
  };
}

function deliveryAttempt(overrides = {}) {
  return {
    id: "attempt-1",
    taskId: "notification-task-rule-blocker-email-1-event-blocker",
    organizationId: "org-1",
    channelId: "email-1",
    channelKind: "email",
    status: "delivered",
    attemptedAt: "2026-06-22T12:00:00.000Z",
    attempt: 1,
    ...overrides
  };
}

function runCommand(command) {
  const result = spawnSync(command.command, command.args, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: "pipe"
  });
  if (result.status !== 0) {
    throw new Error(
      `${command.name} failed with exit ${result.status}\n${result.stdout}\n${result.stderr}`
    );
  }
  return {
    name: command.name,
    command: [command.command, ...command.args].join(" "),
    status: "passed"
  };
}

async function writeJson(filePath, value) {
  const json = await format(`${JSON.stringify(value, null, 2)}\n`, {
    parser: "json"
  });
  await writeFile(filePath, json, "utf8");
}

function expectEqual(actual, expected) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}.`
    );
  }
}

function requireIncludes(value, expected) {
  if (!value.includes(expected)) {
    throw new Error(`Expected value to include ${expected}.`);
  }
}

function requireNotIncludes(value, forbidden) {
  if (value.includes(forbidden)) {
    throw new Error(`Expected value not to include ${forbidden}.`);
  }
}

function assertNoForbiddenSecrets(value) {
  const forbidden = [
    "authorization:",
    "bearer ",
    "xoxb-",
    "bot-token",
    "token=secret",
    "client-secret",
    "webhook-secret"
  ];
  const lower = value.toLowerCase();
  for (const item of forbidden) {
    if (lower.includes(item)) {
      throw new Error(`Forbidden secret-like value found in report: ${item}`);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
