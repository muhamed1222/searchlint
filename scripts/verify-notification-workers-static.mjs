#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { format } from "prettier";

const reportPath = "reports/notification-workers-static-report.json";
const samplePath =
  "docs/examples/notification-workers-static-report.sample.json";

const commands = [
  {
    name: "workerNotificationTests",
    command: "pnpm",
    args: [
      "--filter",
      "@searchlint/workers",
      "test",
      "--",
      "notification-delivery-worker.test.ts"
    ]
  },
  {
    name: "notificationsAcceptance",
    command: "pnpm",
    args: ["notifications:acceptance"]
  },
  {
    name: "workersBuild",
    command: "pnpm",
    args: ["--filter", "@searchlint/workers", "build"]
  }
];

const commandResults = commands.map(runCommand);
const workers = await import("../services/workers/dist/src/index.js");

const harness = createHarness();
const result = await workers.deliverDueNotifications({
  store: harness.store,
  sinks: harness.sinks,
  now: "2026-06-23T12:00:00.000Z",
  limit: 50,
  maxAttempts: 3,
  backoffMinutes: [5, 15, 60]
});
assertEqual(result.selected, 3, "selected");
assertEqual(result.delivered, 1, "delivered");
assertEqual(result.retryScheduled, 1, "retry scheduled");
assertEqual(result.failed, 1, "failed");
assertEqual(
  harness.events.join("|"),
  [
    "select:2026-06-23T12:00:00.000Z:50",
    "send:email:task-email",
    "attempt:task-email:delivered:1",
    "delivered:task-email",
    "send:webhook:task-webhook",
    "attempt:task-webhook:retry_scheduled:1",
    "retry:task-webhook:2:2026-06-23T12:05:00.000Z",
    "send:slack:task-slack",
    "attempt:task-slack:failed:3",
    "failed:task-slack:provider rejected slack delivery"
  ].join("|"),
  "worker events"
);

const scheduleIssues = workers.validateNotificationDeliveryScheduleContract(
  workers.notificationDeliveryScheduleContract
);
assertEqual(scheduleIssues.length, 0, "schedule issue count");

const requiredDocs = [
  "docs/NOTIFICATIONS_ACCEPTANCE.md",
  "docs/DASHBOARD_NOTIFICATIONS_UI.md",
  "docs/WORKER_METRICS_ALERTS.md"
];
const documentEvidence = await Promise.all(requiredDocs.map(readRequiredDoc));

const report = {
  generatedBy: "searchlint-notification-workers-static-verifier",
  generatedAt: "2026-06-23T00:00:00.000Z",
  status: "readiness-passed-live-gate-blocked",
  scope: {
    proofType:
      "deterministic static notification worker and scheduler contract",
    doesNotClaim: [
      "live email delivery",
      "live Slack delivery",
      "live webhook delivery",
      "live Telegram delivery",
      "deployed ECS worker task",
      "deployed EventBridge schedule",
      "production notification persistence"
    ]
  },
  commands: commandResults,
  workerContract: {
    result,
    events: harness.events
  },
  schedulerContract: workers.notificationDeliveryScheduleContract,
  documentEvidence,
  assertions: [
    "Notification worker selects due tasks through a store port.",
    "Notification worker dispatches through provider-specific sink ports.",
    "Successful deliveries record delivered attempts and mark tasks delivered.",
    "Retryable failures record retry_scheduled attempts and schedule bounded retry.",
    "Exhausted attempts record failed attempts and mark tasks failed.",
    "Notification delivery scheduler is modeled as an EventBridge Scheduler to ECS Fargate task contract.",
    "Static evidence does not include provider tokens or webhook secrets."
  ],
  remainingReleaseGates: [
    "Provision real notification provider credentials through the approved vault.",
    "Send and verify live email, Slack, webhook, and optional Telegram deliveries.",
    "Deploy notification worker ECS task and EventBridge schedule.",
    "Persist notification settings and delivery history in production storage.",
    "Review deployed notification payload redaction in logs and telemetry."
  ]
};

assertNoForbiddenSecrets(report);

await mkdir(path.dirname(reportPath), { recursive: true });
await mkdir(path.dirname(samplePath), { recursive: true });
await writeJson(reportPath, report);
await writeJson(samplePath, report);

console.log(
  `Notification workers static contract PASS: delivered=${result.delivered}, retry=${result.retryScheduled}, failed=${result.failed}`
);
console.log(`Report: ${reportPath}`);
console.log(`Sample: ${samplePath}`);

async function readRequiredDoc(filePath) {
  const text = await readFile(filePath, "utf8");
  const normalizedText = text.replace(/\s+/gu, " ");
  const requiredFragments = {
    "docs/NOTIFICATIONS_ACCEPTANCE.md": [
      "Deploy notification workers and scheduler",
      "Retry planning"
    ],
    "docs/DASHBOARD_NOTIFICATIONS_UI.md": [
      "Deploy notification workers and scheduler",
      "delivery history"
    ],
    "docs/WORKER_METRICS_ALERTS.md": [
      "notification delivery",
      "live alert firing"
    ]
  }[filePath];
  for (const fragment of requiredFragments) {
    if (!normalizedText.includes(fragment)) {
      throw new Error(`${filePath} is missing required text: ${fragment}`);
    }
  }
  return {
    filePath,
    status: "present",
    checkedFragments: requiredFragments
  };
}

function createHarness() {
  const events = [];
  const pending = [
    { task: task({ id: "task-email", channelKind: "email" }), attempt: 1 },
    {
      task: task({
        id: "task-webhook",
        channelId: "webhook-1",
        channelKind: "webhook"
      }),
      attempt: 1
    },
    {
      task: task({
        id: "task-slack",
        channelId: "slack-1",
        channelKind: "slack"
      }),
      attempt: 3
    }
  ];
  const store = {
    async selectDueNotificationDeliveries(input) {
      events.push(`select:${input.now}:${input.limit}`);
      return pending;
    },
    async recordNotificationDeliveryAttempt(attempt) {
      events.push(
        `attempt:${attempt.taskId}:${attempt.status}:${attempt.attempt}`
      );
    },
    async markNotificationDeliveryDelivered(input) {
      events.push(`delivered:${input.taskId}`);
    },
    async scheduleNotificationDeliveryRetry(input) {
      events.push(
        `retry:${input.taskId}:${input.attempt}:${input.nextRetryAt}`
      );
    },
    async markNotificationDeliveryFailed(input) {
      events.push(`failed:${input.taskId}:${input.failureReason}`);
    }
  };
  const sinks = {
    email: {
      async deliver(item) {
        events.push(`send:email:${item.id}`);
      }
    },
    webhook: {
      async deliver(item) {
        events.push(`send:webhook:${item.id}`);
        throw new Error("HTTP 503 from provider");
      }
    },
    slack: {
      async deliver(item) {
        events.push(`send:slack:${item.id}`);
        throw new Error("provider rejected slack delivery");
      }
    },
    telegram: {
      async deliver(item) {
        events.push(`send:telegram:${item.id}`);
      }
    }
  };
  return { events, sinks, store };
}

function task(overrides = {}) {
  const channelKind = overrides.channelKind ?? "email";
  return {
    id: "task-email",
    organizationId: "org-1",
    projectId: "project-1",
    environmentId: "env-1",
    ruleId: "rule-1",
    channelId: "email-1",
    channelKind,
    targetDisplay: `${channelKind}-target`,
    digest: "immediate",
    eventIds: ["event-1"],
    scheduledFor: "2026-06-23T12:00:00.000Z",
    subject: "diagnostic.created: Homepage blocker",
    body: "Evidence: missing canonical",
    ...overrides
  };
}

function assertNoForbiddenSecrets(value) {
  const serialized = JSON.stringify(value);
  for (const forbidden of [
    "xoxb-",
    "bot-token",
    "token=secret",
    "Authorization",
    "Bearer "
  ]) {
    if (serialized.includes(forbidden)) {
      throw new Error(`Notification worker evidence leaked ${forbidden}.`);
    }
  }
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, received ${actual}.`);
  }
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

async function writeJson(filePath, value) {
  const json = await format(`${JSON.stringify(value, null, 2)}\n`, {
    parser: "json"
  });
  await writeFile(filePath, json);
}
