import type { PostgresQueryExecutor } from "./postgres-relational-store.js";
import {
  insertNotificationChannelSql,
  insertNotificationDeliveryAttemptSql,
  insertNotificationRuleSql,
  selectNotificationChannelsSql,
  selectNotificationDeliveryAttemptsSql,
  selectNotificationRulesSql
} from "./postgres-repository-sql.js";
import type {
  DiagnosticSeverity,
  NotificationChannel,
  NotificationChannelKind,
  NotificationDeliveryAttempt,
  NotificationDeliveryStatus,
  NotificationEventKind,
  NotificationRule
} from "./types.js";

export type NotificationSettingsPersistenceScope = {
  organizationId: string;
  projectId: string;
  environmentId: string;
};

export type NotificationSettingsPersistenceStore = {
  upsertNotificationChannel(
    input: NotificationChannel
  ): Promise<NotificationChannel>;
  upsertNotificationRule(input: NotificationRule): Promise<NotificationRule>;
  recordNotificationDeliveryAttempt(
    input: NotificationDeliveryAttempt
  ): Promise<NotificationDeliveryAttempt>;
  selectNotificationChannels(
    input: NotificationSettingsPersistenceScope
  ): Promise<readonly NotificationChannel[]>;
  selectNotificationRules(
    input: NotificationSettingsPersistenceScope
  ): Promise<readonly NotificationRule[]>;
  selectNotificationDeliveryAttempts(input: {
    organizationId: string;
    limit: number;
  }): Promise<readonly NotificationDeliveryAttempt[]>;
};

export function createPostgresNotificationSettingsStore(
  executor: PostgresQueryExecutor
): NotificationSettingsPersistenceStore {
  return {
    async upsertNotificationChannel(input) {
      const row = await requiredRow(
        executor.query(insertNotificationChannelSql(input)),
        "upsertNotificationChannel"
      );
      return notificationChannelFromRow(row);
    },
    async upsertNotificationRule(input) {
      const row = await requiredRow(
        executor.query(insertNotificationRuleSql(input)),
        "upsertNotificationRule"
      );
      return notificationRuleFromRow(row);
    },
    async recordNotificationDeliveryAttempt(input) {
      const row = await requiredRow(
        executor.query(insertNotificationDeliveryAttemptSql(input)),
        "recordNotificationDeliveryAttempt"
      );
      return notificationDeliveryAttemptFromRow(row);
    },
    async selectNotificationChannels(input) {
      validateScope(input, "notification channel selection");
      const result = await executor.query<Record<string, unknown>>(
        selectNotificationChannelsSql(input)
      );
      return result.rows.map(notificationChannelFromRow);
    },
    async selectNotificationRules(input) {
      validateScope(input, "notification rule selection");
      const result = await executor.query<Record<string, unknown>>(
        selectNotificationRulesSql(input)
      );
      return result.rows.map(notificationRuleFromRow);
    },
    async selectNotificationDeliveryAttempts(input) {
      if (input.organizationId.trim().length === 0) {
        throw new Error(
          "Notification delivery attempt selection organizationId is required."
        );
      }
      if (
        !Number.isInteger(input.limit) ||
        input.limit < 1 ||
        input.limit > 100
      ) {
        throw new Error(
          "Notification delivery attempt selection limit must be an integer from 1 to 100."
        );
      }
      const result = await executor.query<Record<string, unknown>>(
        selectNotificationDeliveryAttemptsSql(input)
      );
      return result.rows.map(notificationDeliveryAttemptFromRow);
    }
  };
}

async function requiredRow<Row extends Record<string, unknown>>(
  result: Promise<{ rows: readonly Row[] }>,
  operation: string
): Promise<Row> {
  const row = (await result).rows[0];
  if (!row) {
    throw new Error(`${operation} did not return a row.`);
  }
  return row;
}

function validateScope(
  input: NotificationSettingsPersistenceScope,
  label: string
): void {
  for (const field of [
    "organizationId",
    "projectId",
    "environmentId"
  ] as const) {
    if (input[field].trim().length === 0) {
      throw new Error(`${label} ${field} is required.`);
    }
  }
}

function notificationChannelFromRow(
  row: Record<string, unknown>
): NotificationChannel {
  return {
    id: text(row, "id"),
    organizationId: text(row, "organization_id"),
    projectId: text(row, "project_id"),
    environmentId: text(row, "environment_id"),
    kind: notificationChannelKind(row, "kind"),
    name: text(row, "name"),
    target: targetFromRow(row),
    enabled: boolean(row, "enabled"),
    createdAt: text(row, "created_at")
  };
}

function notificationRuleFromRow(
  row: Record<string, unknown>
): NotificationRule {
  const rule: NotificationRule = {
    id: text(row, "id"),
    organizationId: text(row, "organization_id"),
    projectId: text(row, "project_id"),
    environmentId: text(row, "environment_id"),
    name: text(row, "name"),
    eventKinds: notificationEventKinds(row, "event_kinds"),
    channelIds: stringArray(row, "channel_ids"),
    digest: digest(row, "digest"),
    enabled: boolean(row, "enabled"),
    createdAt: text(row, "created_at")
  };
  const severityThreshold = optionalText(row, "severity_threshold");
  const mutedUntil = optionalText(row, "muted_until");
  const snoozedUntil = optionalText(row, "snoozed_until");
  if (severityThreshold !== undefined) {
    rule.severityThreshold = diagnosticSeverityValue(severityThreshold);
  }
  if (mutedUntil !== undefined) {
    rule.mutedUntil = mutedUntil;
  }
  if (snoozedUntil !== undefined) {
    rule.snoozedUntil = snoozedUntil;
  }
  return rule;
}

function notificationDeliveryAttemptFromRow(
  row: Record<string, unknown>
): NotificationDeliveryAttempt {
  const attempt: NotificationDeliveryAttempt = {
    id: text(row, "id"),
    taskId: text(row, "task_id"),
    organizationId: text(row, "organization_id"),
    channelId: text(row, "channel_id"),
    channelKind: notificationChannelKind(row, "channel_kind"),
    status: notificationDeliveryStatus(row, "status"),
    attemptedAt: text(row, "attempted_at"),
    attempt: integer(row, "attempt")
  };
  const failureReason = optionalText(row, "failure_reason");
  const nextRetryAt = optionalText(row, "next_retry_at");
  if (failureReason !== undefined) {
    attempt.failureReason = failureReason;
  }
  if (nextRetryAt !== undefined) {
    attempt.nextRetryAt = nextRetryAt;
  }
  return attempt;
}

function targetFromRow(
  row: Record<string, unknown>
): NotificationChannel["target"] {
  const target = {
    display: text(row, "target_display")
  };
  const secretRef = optionalText(row, "target_secret_ref");
  return secretRef === undefined ? target : { ...target, secretRef };
}

function text(row: Record<string, unknown>, field: string): string {
  const value = row[field];
  if (typeof value !== "string") {
    throw new Error(`Expected notification setting ${field} to be a string.`);
  }
  return value;
}

function optionalText(
  row: Record<string, unknown>,
  field: string
): string | undefined {
  const value = row[field];
  if (value === null || value === undefined) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new Error(`Expected notification setting ${field} to be a string.`);
  }
  return value;
}

function boolean(row: Record<string, unknown>, field: string): boolean {
  const value = row[field];
  if (typeof value !== "boolean") {
    throw new Error(`Expected notification setting ${field} to be a boolean.`);
  }
  return value;
}

function integer(row: Record<string, unknown>, field: string): number {
  const value = row[field];
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error(`Expected notification setting ${field} to be an integer.`);
  }
  return value;
}

function stringArray(
  row: Record<string, unknown>,
  field: string
): readonly string[] {
  const value = row[field];
  if (
    !Array.isArray(value) ||
    !value.every((item) => typeof item === "string")
  ) {
    throw new Error(
      `Expected notification setting ${field} to be a string array.`
    );
  }
  return value;
}

function notificationEventKinds(
  row: Record<string, unknown>,
  field: string
): readonly NotificationEventKind[] {
  return stringArray(row, field).map(notificationEventKindValue);
}

function notificationChannelKind(
  row: Record<string, unknown>,
  field: string
): NotificationChannelKind {
  const value = text(row, field);
  if (
    value === "email" ||
    value === "slack" ||
    value === "webhook" ||
    value === "telegram"
  ) {
    return value;
  }
  throw new Error(`Unknown notification channel kind: ${value}.`);
}

function notificationDeliveryStatus(
  row: Record<string, unknown>,
  field: string
): NotificationDeliveryStatus {
  const value = text(row, field);
  if (
    value === "pending" ||
    value === "delivered" ||
    value === "failed" ||
    value === "retry_scheduled" ||
    value === "suppressed"
  ) {
    return value;
  }
  throw new Error(`Unknown notification delivery status: ${value}.`);
}

function diagnosticSeverityValue(value: string): DiagnosticSeverity {
  if (
    value === "blocker" ||
    value === "error" ||
    value === "warning" ||
    value === "info"
  ) {
    return value;
  }
  throw new Error(`Unknown notification severity threshold: ${value}.`);
}

function notificationEventKindValue(value: string): NotificationEventKind {
  if (
    value === "diagnostic.created" ||
    value === "crawl.completed" ||
    value === "deployment.correlated" ||
    value === "external_observation.stale" ||
    value === "quota.exhausted" ||
    value === "report.generated" ||
    value === "billing.action_required"
  ) {
    return value;
  }
  throw new Error(`Unknown notification event kind: ${value}.`);
}

function digest(
  row: Record<string, unknown>,
  field: string
): NotificationRule["digest"] {
  const value = text(row, field);
  if (value === "immediate" || value === "daily" || value === "weekly") {
    return value;
  }
  throw new Error(`Unknown notification digest: ${value}.`);
}
