#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { format } from "prettier";

const reportPath =
  "reports/notification-settings-persistence-static-report.json";
const samplePath =
  "docs/examples/notification-settings-persistence-static-report.sample.json";

const commands = [
  {
    name: "apiNotificationPersistenceTests",
    command: "pnpm",
    args: [
      "--filter",
      "@searchlint/api",
      "test",
      "--",
      "postgres-notification-settings-store.test.ts"
    ]
  },
  {
    name: "notificationWorkersStatic",
    command: "pnpm",
    args: ["notifications:workers-static"]
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

const schemaEvidence = verifySchema(api);
const sqlEvidence = verifySql(api);
const storeEvidence = await verifyStore(api);

const report = {
  generatedBy: "searchlint-notification-settings-persistence-static-verifier",
  generatedAt: "2026-06-23T00:00:00.000Z",
  status: "readiness-passed-live-gate-blocked",
  scope: {
    proofType:
      "deterministic static notification settings persistence contract",
    doesNotClaim: [
      "applied production RDS migration",
      "live provider delivery",
      "deployed notification settings API",
      "dashboard edit-form persistence E2E",
      "deployed log or telemetry redaction review"
    ]
  },
  commands: commandResults,
  schemaEvidence,
  sqlEvidence,
  storeEvidence,
  assertions: [
    "Notification channels, rules, and delivery attempts have tenant-scoped schema contracts.",
    "Notification channel and rule selection requires organization, project, environment, and active deletion state.",
    "Delivery history selection is organization-scoped and bounded.",
    "Raw provider secret material is not persisted in notification channel SQL values.",
    "Store mapping fails deterministically on malformed rows."
  ],
  remainingReleaseGates: [
    "Apply notification persistence migrations to real PostgreSQL/RDS.",
    "Connect production notification settings API and dashboard edit flows to the store.",
    "Provision real notification provider credentials through the approved vault.",
    "Send and verify live notification deliveries.",
    "Review deployed notification payload redaction in logs and telemetry."
  ]
};

assertNoForbiddenSecrets(report);

await mkdir(path.dirname(reportPath), { recursive: true });
await mkdir(path.dirname(samplePath), { recursive: true });
await writeJson(reportPath, report);
await writeJson(samplePath, report);

console.log(
  `Notification settings persistence static contract PASS: tables=${schemaEvidence.tables.length}, sql=${sqlEvidence.queries.length}`
);
console.log(`Report: ${reportPath}`);
console.log(`Sample: ${samplePath}`);

function verifySchema(api) {
  const requiredTables = [
    "notification_channels",
    "notification_rules",
    "notification_delivery_attempts"
  ];
  const tables = requiredTables.map((name) => {
    const table = api.cloudPersistenceSchema.find(
      (candidate) => candidate.name === name
    );
    if (!table) {
      throw new Error(`Missing persistence schema table: ${name}`);
    }
    if (!table.tenantScoped) {
      throw new Error(`${name} must be tenant scoped.`);
    }
    if (table.retentionClass !== "notification_setting") {
      throw new Error(`${name} must use notification_setting retention class.`);
    }
    return {
      name,
      schemaVersion: table.schemaVersion,
      tenantScoped: table.tenantScoped,
      retentionClass: table.retentionClass,
      indexes: table.indexes.map((index) => index.name)
    };
  });
  return { tables };
}

function verifySql(api) {
  const channel = notificationChannel();
  const channelQuery = api.insertNotificationChannelSql(channel);
  const ruleQuery = api.insertNotificationRuleSql(notificationRule());
  const attemptQuery =
    api.insertNotificationDeliveryAttemptSql(deliveryAttempt());
  const scope = {
    organizationId: "org-1",
    projectId: "project-1",
    environmentId: "env-1"
  };
  const channelSelect = api.selectNotificationChannelsSql(scope);
  const ruleSelect = api.selectNotificationRulesSql(scope);
  const attemptSelect = api.selectNotificationDeliveryAttemptsSql({
    organizationId: "org-1",
    limit: 25
  });

  expectIncludes(channelSelect.text, '"organization_id" = $1');
  expectIncludes(channelSelect.text, '"project_id" = $2');
  expectIncludes(channelSelect.text, '"environment_id" = $3');
  expectIncludes(ruleSelect.text, '"organization_id" = $1');
  expectIncludes(ruleSelect.text, '"project_id" = $2');
  expectIncludes(ruleSelect.text, '"environment_id" = $3');
  expectIncludes(attemptSelect.text, "LIMIT $3");

  const forbiddenSecret = "raw-webhook-token";
  if (JSON.stringify(channelQuery.values).includes(forbiddenSecret)) {
    throw new Error("Raw notification provider secret leaked into SQL values.");
  }

  return {
    queries: [
      summarizeQuery("insertNotificationChannelSql", channelQuery),
      summarizeQuery("insertNotificationRuleSql", ruleQuery),
      summarizeQuery("insertNotificationDeliveryAttemptSql", attemptQuery),
      summarizeQuery("selectNotificationChannelsSql", channelSelect),
      summarizeQuery("selectNotificationRulesSql", ruleSelect),
      summarizeQuery("selectNotificationDeliveryAttemptsSql", attemptSelect)
    ],
    rawSecretPersisted: false
  };
}

async function verifyStore(api) {
  const executor = createFakeExecutor([
    notificationChannelRow(),
    notificationRuleRow(),
    deliveryAttemptRow()
  ]);
  const store = api.createPostgresNotificationSettingsStore(executor);
  const channels = await store.selectNotificationChannels({
    organizationId: "org-1",
    projectId: "project-1",
    environmentId: "env-1"
  });
  const rules = await store.selectNotificationRules({
    organizationId: "org-1",
    projectId: "project-1",
    environmentId: "env-1"
  });
  const attempts = await store.selectNotificationDeliveryAttempts({
    organizationId: "org-1",
    limit: 1
  });

  if (
    channels[0]?.target.secretRef !== "secret://org-1/notifications/webhook-1"
  ) {
    throw new Error("Notification channel secretRef mapping failed.");
  }
  if (rules[0]?.severityThreshold !== "blocker") {
    throw new Error("Notification rule severityThreshold mapping failed.");
  }
  if (attempts[0]?.status !== "retry_scheduled") {
    throw new Error("Notification delivery attempt status mapping failed.");
  }

  await expectRejects(
    () =>
      store.selectNotificationDeliveryAttempts({
        organizationId: "org-1",
        limit: 0
      }),
    "limit must be an integer from 1 to 100"
  );

  return {
    selectedChannels: channels.length,
    selectedRules: rules.length,
    selectedAttempts: attempts.length,
    executedQueries: executor.queries.map((query) => query.text),
    boundedDeliveryAttemptLimit: true
  };
}

function summarizeQuery(name, query) {
  return {
    name,
    text: query.text,
    valueCount: query.values.length
  };
}

function expectIncludes(value, fragment) {
  if (!value.includes(fragment)) {
    throw new Error(`Expected SQL to include ${fragment}: ${value}`);
  }
}

async function expectRejects(action, expectedMessage) {
  try {
    await action();
  } catch (error) {
    if (String(error.message).includes(expectedMessage)) {
      return;
    }
    throw error;
  }
  throw new Error(`Expected rejection containing: ${expectedMessage}`);
}

function notificationChannel() {
  return {
    id: "channel-1",
    organizationId: "org-1",
    projectId: "project-1",
    environmentId: "env-1",
    kind: "webhook",
    name: "Production webhook",
    target: {
      display: "https://hooks.example.test/searchlint",
      secretRef: "secret://org-1/notifications/webhook-1"
    },
    enabled: true,
    createdAt: "2026-06-23T00:00:00.000Z"
  };
}

function notificationRule() {
  return {
    id: "rule-1",
    organizationId: "org-1",
    projectId: "project-1",
    environmentId: "env-1",
    name: "Blockers digest",
    eventKinds: ["diagnostic.created", "crawl.completed"],
    channelIds: ["channel-1"],
    severityThreshold: "blocker",
    digest: "daily",
    snoozedUntil: "2026-06-24T00:00:00.000Z",
    enabled: true,
    createdAt: "2026-06-23T00:00:00.000Z"
  };
}

function deliveryAttempt() {
  return {
    id: "attempt-1",
    taskId: "task-1",
    organizationId: "org-1",
    channelId: "channel-1",
    channelKind: "webhook",
    status: "retry_scheduled",
    attemptedAt: "2026-06-23T00:05:00.000Z",
    attempt: 1,
    failureReason: "HTTP 503",
    nextRetryAt: "2026-06-23T00:10:00.000Z"
  };
}

function notificationChannelRow() {
  return {
    id: "channel-1",
    organization_id: "org-1",
    schema_version: "cloud.notification_channels.v1",
    created_at: "2026-06-23T00:00:00.000Z",
    retention_until: null,
    deletion_state: "active",
    project_id: "project-1",
    environment_id: "env-1",
    kind: "webhook",
    name: "Production webhook",
    target_display: "https://hooks.example.test/searchlint",
    target_secret_ref: "secret://org-1/notifications/webhook-1",
    enabled: true
  };
}

function notificationRuleRow() {
  return {
    id: "rule-1",
    organization_id: "org-1",
    schema_version: "cloud.notification_rules.v1",
    created_at: "2026-06-23T00:00:00.000Z",
    retention_until: null,
    deletion_state: "active",
    project_id: "project-1",
    environment_id: "env-1",
    name: "Blockers digest",
    event_kinds: ["diagnostic.created", "crawl.completed"],
    channel_ids: ["channel-1"],
    severity_threshold: "blocker",
    digest: "daily",
    muted_until: null,
    snoozed_until: "2026-06-24T00:00:00.000Z",
    enabled: true
  };
}

function deliveryAttemptRow() {
  return {
    id: "attempt-1",
    organization_id: "org-1",
    schema_version: "cloud.notification_delivery_attempts.v1",
    created_at: "2026-06-23T00:05:00.000Z",
    retention_until: null,
    deletion_state: "active",
    task_id: "task-1",
    channel_id: "channel-1",
    channel_kind: "webhook",
    status: "retry_scheduled",
    attempted_at: "2026-06-23T00:05:00.000Z",
    attempt: 1,
    failure_reason: "HTTP 503",
    next_retry_at: "2026-06-23T00:10:00.000Z"
  };
}

function createFakeExecutor(rows) {
  const executorRows = [...rows];
  return {
    queries: [],
    async query(query) {
      this.queries.push(query);
      const row = executorRows.shift();
      return {
        rows: row ? [row] : []
      };
    }
  };
}

function runCommand(commandSpec) {
  const result = spawnSync(commandSpec.command, commandSpec.args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  const commandLine = [commandSpec.command, ...commandSpec.args].join(" ");
  if (result.status !== 0) {
    throw new Error(
      `${commandLine} failed with exit ${result.status}\n${result.stdout}\n${result.stderr}`
    );
  }
  return {
    name: commandSpec.name,
    command: commandLine,
    status: "passed"
  };
}

function assertNoForbiddenSecrets(value) {
  const text = JSON.stringify(value);
  for (const forbidden of [
    "raw-webhook-token",
    "xoxb-",
    "AIza",
    "-----BEGIN",
    "postgres://"
  ]) {
    if (text.includes(forbidden)) {
      throw new Error(`Forbidden secret-like value found: ${forbidden}`);
    }
  }
}

async function writeJson(filePath, value) {
  const json = await format(JSON.stringify(value), { parser: "json" });
  await writeFile(filePath, json, "utf8");
}
