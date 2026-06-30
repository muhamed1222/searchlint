import { describe, expect, it } from "vitest";

import {
  createPostgresNotificationSettingsStore,
  insertNotificationChannelSql,
  insertNotificationDeliveryAttemptSql,
  insertNotificationRuleSql,
  selectNotificationChannelsSql,
  selectNotificationDeliveryAttemptsSql,
  selectNotificationRulesSql
} from "../src/index.js";
import type {
  NotificationChannel,
  NotificationDeliveryAttempt,
  NotificationRule,
  PostgresQuery,
  PostgresQueryExecutor,
  PostgresQueryResult
} from "../src/index.js";

const createdAt = "2026-06-23T00:00:00.000Z";
const attemptedAt = "2026-06-23T00:05:00.000Z";

describe("notification settings persistence SQL", () => {
  it("inserts notification channel settings without raw provider secrets", () => {
    const query = insertNotificationChannelSql(notificationChannel());

    expect(query).toEqual({
      text: 'INSERT INTO "notification_channels" ("id", "organization_id", "schema_version", "created_at", "retention_until", "deletion_state", "project_id", "environment_id", "kind", "name", "target_display", "target_secret_ref", "enabled") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *;',
      values: [
        "channel-1",
        "org-1",
        "cloud.notification_channels.v1",
        createdAt,
        null,
        "active",
        "project-1",
        "env-1",
        "webhook",
        "Production webhook",
        "https://hooks.example.test/searchlint",
        "secret://org-1/notifications/webhook-1",
        true
      ]
    });
    expect(JSON.stringify(query.values)).not.toContain("raw-webhook-token");
  });

  it("inserts notification rules with deterministic JSON fields", () => {
    expect(insertNotificationRuleSql(notificationRule())).toEqual({
      text: 'INSERT INTO "notification_rules" ("id", "organization_id", "schema_version", "created_at", "retention_until", "deletion_state", "project_id", "environment_id", "name", "event_kinds", "channel_ids", "severity_threshold", "digest", "muted_until", "snoozed_until", "enabled") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) RETURNING *;',
      values: [
        "rule-1",
        "org-1",
        "cloud.notification_rules.v1",
        createdAt,
        null,
        "active",
        "project-1",
        "env-1",
        "Blockers digest",
        ["diagnostic.created", "crawl.completed"],
        ["channel-1"],
        "blocker",
        "daily",
        null,
        "2026-06-24T00:00:00.000Z",
        true
      ]
    });
  });

  it("inserts notification delivery attempts with tenant scope", () => {
    expect(insertNotificationDeliveryAttemptSql(deliveryAttempt())).toEqual({
      text: 'INSERT INTO "notification_delivery_attempts" ("id", "organization_id", "schema_version", "created_at", "retention_until", "deletion_state", "task_id", "channel_id", "channel_kind", "status", "attempted_at", "attempt", "failure_reason", "next_retry_at") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *;',
      values: [
        "attempt-1",
        "org-1",
        "cloud.notification_delivery_attempts.v1",
        attemptedAt,
        null,
        "active",
        "task-1",
        "channel-1",
        "webhook",
        "retry_scheduled",
        attemptedAt,
        1,
        "HTTP 503",
        "2026-06-23T00:10:00.000Z"
      ]
    });
  });

  it("selects notification settings by organization, project, and environment", () => {
    const scope = {
      organizationId: "org-1",
      projectId: "project-1",
      environmentId: "env-1"
    };

    expect(selectNotificationChannelsSql(scope)).toEqual({
      text: 'SELECT * FROM "notification_channels" WHERE "organization_id" = $1 AND "project_id" = $2 AND "environment_id" = $3 AND "deletion_state" = $4 ORDER BY "kind" ASC, "name" ASC, "id" ASC;',
      values: ["org-1", "project-1", "env-1", "active"]
    });
    expect(selectNotificationRulesSql(scope)).toEqual({
      text: 'SELECT * FROM "notification_rules" WHERE "organization_id" = $1 AND "project_id" = $2 AND "environment_id" = $3 AND "deletion_state" = $4 ORDER BY "name" ASC, "id" ASC;',
      values: ["org-1", "project-1", "env-1", "active"]
    });
    expect(
      selectNotificationDeliveryAttemptsSql({
        organizationId: "org-1",
        limit: 25
      })
    ).toEqual({
      text: 'SELECT * FROM "notification_delivery_attempts" WHERE "organization_id" = $1 AND "deletion_state" = $2 ORDER BY "attempted_at" DESC, "id" ASC LIMIT $3;',
      values: ["org-1", "active", 25]
    });
  });
});

describe("createPostgresNotificationSettingsStore", () => {
  it("maps notification channel, rule, and delivery attempt rows", async () => {
    const executor = new FakeExecutor([
      notificationChannelRow(),
      notificationRuleRow(),
      deliveryAttemptRow()
    ]);
    const store = createPostgresNotificationSettingsStore(executor);

    await expect(
      store.upsertNotificationChannel(notificationChannel())
    ).resolves.toEqual(notificationChannel());
    await expect(
      store.upsertNotificationRule(notificationRule())
    ).resolves.toEqual(notificationRule());
    await expect(
      store.recordNotificationDeliveryAttempt(deliveryAttempt())
    ).resolves.toEqual(deliveryAttempt());
    expect(executor.queries).toEqual([
      insertNotificationChannelSql(notificationChannel()),
      insertNotificationRuleSql(notificationRule()),
      insertNotificationDeliveryAttemptSql(deliveryAttempt())
    ]);
  });

  it("selects notification settings through scoped SQL contracts", async () => {
    const executor = new FakeExecutor([
      notificationChannelRow(),
      notificationRuleRow(),
      deliveryAttemptRow()
    ]);
    const store = createPostgresNotificationSettingsStore(executor);
    const scope = {
      organizationId: "org-1",
      projectId: "project-1",
      environmentId: "env-1"
    };

    await expect(store.selectNotificationChannels(scope)).resolves.toEqual([
      notificationChannel()
    ]);
    await expect(store.selectNotificationRules(scope)).resolves.toEqual([
      notificationRule()
    ]);
    await expect(
      store.selectNotificationDeliveryAttempts({
        organizationId: "org-1",
        limit: 1
      })
    ).resolves.toEqual([deliveryAttempt()]);
    expect(executor.queries).toEqual([
      selectNotificationChannelsSql(scope),
      selectNotificationRulesSql(scope),
      selectNotificationDeliveryAttemptsSql({
        organizationId: "org-1",
        limit: 1
      })
    ]);
  });

  it("rejects invalid scope and limit before querying", async () => {
    const executor = new FakeExecutor([]);
    const store = createPostgresNotificationSettingsStore(executor);

    await expect(
      store.selectNotificationChannels({
        organizationId: " ",
        projectId: "project-1",
        environmentId: "env-1"
      })
    ).rejects.toThrow(
      "notification channel selection organizationId is required."
    );
    await expect(
      store.selectNotificationDeliveryAttempts({
        organizationId: "org-1",
        limit: 0
      })
    ).rejects.toThrow(
      "Notification delivery attempt selection limit must be an integer from 1 to 100."
    );
    expect(executor.queries).toEqual([]);
  });

  it("fails deterministically on malformed rows", async () => {
    const store = createPostgresNotificationSettingsStore(
      new FakeExecutor([
        {
          ...notificationChannelRow(),
          kind: "sms"
        }
      ])
    );

    await expect(
      store.selectNotificationChannels({
        organizationId: "org-1",
        projectId: "project-1",
        environmentId: "env-1"
      })
    ).rejects.toThrow("Unknown notification channel kind: sms.");
  });
});

function notificationChannel(): NotificationChannel {
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
    createdAt
  };
}

function notificationRule(): NotificationRule {
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
    createdAt
  };
}

function deliveryAttempt(): NotificationDeliveryAttempt {
  return {
    id: "attempt-1",
    taskId: "task-1",
    organizationId: "org-1",
    channelId: "channel-1",
    channelKind: "webhook",
    status: "retry_scheduled",
    attemptedAt,
    attempt: 1,
    failureReason: "HTTP 503",
    nextRetryAt: "2026-06-23T00:10:00.000Z"
  };
}

function notificationChannelRow(): Record<string, unknown> {
  return {
    id: "channel-1",
    organization_id: "org-1",
    schema_version: "cloud.notification_channels.v1",
    created_at: createdAt,
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

function notificationRuleRow(): Record<string, unknown> {
  return {
    id: "rule-1",
    organization_id: "org-1",
    schema_version: "cloud.notification_rules.v1",
    created_at: createdAt,
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

function deliveryAttemptRow(): Record<string, unknown> {
  return {
    id: "attempt-1",
    organization_id: "org-1",
    schema_version: "cloud.notification_delivery_attempts.v1",
    created_at: attemptedAt,
    retention_until: null,
    deletion_state: "active",
    task_id: "task-1",
    channel_id: "channel-1",
    channel_kind: "webhook",
    status: "retry_scheduled",
    attempted_at: attemptedAt,
    attempt: 1,
    failure_reason: "HTTP 503",
    next_retry_at: "2026-06-23T00:10:00.000Z"
  };
}

type FakeRow = Record<string, unknown> | undefined;

class FakeExecutor implements PostgresQueryExecutor {
  readonly queries: PostgresQuery[] = [];
  private readonly rows: FakeRow[];

  constructor(rows: readonly FakeRow[]) {
    this.rows = [...rows];
  }

  async query<Row extends Record<string, unknown>>(
    query: PostgresQuery
  ): Promise<PostgresQueryResult<Row>> {
    this.queries.push(query);
    const row = this.rows.shift();
    return {
      rows: row ? [row as Row] : []
    };
  }
}
