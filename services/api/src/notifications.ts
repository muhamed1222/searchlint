import type {
  MetricEvent,
  NotificationChannel,
  NotificationChannelKind,
  NotificationDeliveryAttempt,
  NotificationDeliveryStatus,
  NotificationDeliveryTask,
  NotificationEvent,
  NotificationRule
} from "./types.js";

const severityRank = {
  info: 0,
  warning: 1,
  error: 2,
  blocker: 3
} as const;

export type NotificationSuppressionReason =
  | "rule-disabled"
  | "channel-disabled"
  | "event-kind-not-matched"
  | "severity-below-threshold"
  | "muted"
  | "snoozed"
  | "channel-missing";

export type NotificationSuppression = {
  ruleId: string;
  eventId: string;
  channelId?: string;
  reason: NotificationSuppressionReason;
  evidence: string;
};

export type NotificationEvaluationResult = {
  tasks: readonly NotificationDeliveryTask[];
  suppressions: readonly NotificationSuppression[];
};

export type NotificationSettingsSummary = {
  channelCount: number;
  enabledChannelCount: number;
  ruleCount: number;
  enabledRuleCount: number;
  immediateRuleCount: number;
  digestRuleCount: number;
};

export type NotificationDeliveryHistorySummary = {
  pending: number;
  delivered: number;
  failed: number;
  retryScheduled: number;
  suppressed: number;
  latestAttemptAt?: string;
};

export type NotificationRetryPlan = {
  status: "retry_scheduled" | "failed";
  attempt: number;
  nextRetryAt?: string;
  evidence: string;
};

export function evaluateNotificationRules(input: {
  rules: readonly NotificationRule[];
  channels: readonly NotificationChannel[];
  events: readonly NotificationEvent[];
  now: string;
}): NotificationEvaluationResult {
  const channelsById = new Map(
    input.channels.map((channel) => [channel.id, channel])
  );
  const tasks: NotificationDeliveryTask[] = [];
  const suppressions: NotificationSuppression[] = [];

  for (const rule of [...input.rules].sort(compareRules)) {
    for (const event of [...input.events].sort(compareEvents)) {
      if (!rule.enabled) {
        suppressions.push(suppression(rule, event, "rule-disabled"));
        continue;
      }
      if (!rule.eventKinds.includes(event.kind)) {
        suppressions.push(suppression(rule, event, "event-kind-not-matched"));
        continue;
      }
      if (isBelowSeverityThreshold(rule, event)) {
        suppressions.push(suppression(rule, event, "severity-below-threshold"));
        continue;
      }
      if (rule.mutedUntil !== undefined && rule.mutedUntil > input.now) {
        suppressions.push(suppression(rule, event, "muted"));
        continue;
      }
      if (rule.snoozedUntil !== undefined && rule.snoozedUntil > input.now) {
        suppressions.push(suppression(rule, event, "snoozed"));
        continue;
      }

      for (const channelId of [...rule.channelIds].sort()) {
        const channel = channelsById.get(channelId);
        if (channel === undefined) {
          suppressions.push(
            suppression(rule, event, "channel-missing", channelId)
          );
          continue;
        }
        if (!channel.enabled) {
          suppressions.push(
            suppression(rule, event, "channel-disabled", channel.id)
          );
          continue;
        }

        tasks.push(
          createDeliveryTask({ rule, channel, event, now: input.now })
        );
      }
    }
  }

  return {
    tasks: groupDigestTasks(tasks),
    suppressions
  };
}

export function summarizeNotificationSettings(input: {
  channels: readonly NotificationChannel[];
  rules: readonly NotificationRule[];
}): NotificationSettingsSummary {
  return {
    channelCount: input.channels.length,
    enabledChannelCount: input.channels.filter((channel) => channel.enabled)
      .length,
    ruleCount: input.rules.length,
    enabledRuleCount: input.rules.filter((rule) => rule.enabled).length,
    immediateRuleCount: input.rules.filter(
      (rule) => rule.digest === "immediate"
    ).length,
    digestRuleCount: input.rules.filter((rule) => rule.digest !== "immediate")
      .length
  };
}

export function summarizeNotificationDeliveryHistory(
  attempts: readonly NotificationDeliveryAttempt[]
): NotificationDeliveryHistorySummary {
  const summary = {
    pending: countStatus(attempts, "pending"),
    delivered: countStatus(attempts, "delivered"),
    failed: countStatus(attempts, "failed"),
    retryScheduled: countStatus(attempts, "retry_scheduled"),
    suppressed: countStatus(attempts, "suppressed")
  };
  const latestAttempt = [...attempts].sort((left, right) =>
    right.attemptedAt.localeCompare(left.attemptedAt)
  )[0];
  return latestAttempt === undefined
    ? summary
    : { ...summary, latestAttemptAt: latestAttempt.attemptedAt };
}

export function planNotificationRetry(input: {
  task: NotificationDeliveryTask;
  failedAttempt: NotificationDeliveryAttempt;
  now: string;
  maxAttempts: number;
  backoffMinutes: readonly number[];
}): NotificationRetryPlan {
  if (input.failedAttempt.attempt >= input.maxAttempts) {
    return {
      status: "failed",
      attempt: input.failedAttempt.attempt,
      evidence: `Notification task ${input.task.id} exhausted ${input.maxAttempts} attempts.`
    };
  }

  const delay =
    input.backoffMinutes[
      Math.min(input.failedAttempt.attempt - 1, input.backoffMinutes.length - 1)
    ] ??
    input.backoffMinutes[input.backoffMinutes.length - 1] ??
    15;
  const nextRetryAt = new Date(
    Date.parse(input.now) + delay * 60_000
  ).toISOString();
  return {
    status: "retry_scheduled",
    attempt: input.failedAttempt.attempt + 1,
    nextRetryAt,
    evidence: `Notification task ${input.task.id} will retry attempt ${input.failedAttempt.attempt + 1} at ${nextRetryAt}.`
  };
}

export function notificationAttemptsToMetricEvents(input: {
  organizationId: string;
  attempts: readonly NotificationDeliveryAttempt[];
}): readonly MetricEvent[] {
  return [...input.attempts]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((attempt) => ({
      id: `metric-${attempt.id}`,
      organizationId: input.organizationId,
      name: `notification.delivery.${attempt.status}`,
      value: 1,
      occurredAt: attempt.attemptedAt,
      dimensions: {
        channelKind: attempt.channelKind,
        channelId: attempt.channelId
      }
    }));
}

export function sanitizeNotificationChannelTarget(
  channel: NotificationChannel
): string {
  switch (channel.kind) {
    case "email":
      return maskEmail(channel.target.display);
    case "slack":
      return channel.target.display.startsWith("#")
        ? channel.target.display
        : "slack-channel";
    case "webhook":
      return sanitizeWebhookDisplay(channel.target.display);
    case "telegram":
      return "telegram-chat";
  }
}

function createDeliveryTask(input: {
  rule: NotificationRule;
  channel: NotificationChannel;
  event: NotificationEvent;
  now: string;
}): NotificationDeliveryTask {
  const scheduledFor = digestScheduledFor(
    input.rule.digest,
    input.event.occurredAt
  );
  const targetDisplay = sanitizeNotificationChannelTarget(input.channel);
  return {
    id: `notification-task-${input.rule.id}-${input.channel.id}-${input.event.id}`,
    organizationId: input.event.organizationId,
    projectId: input.event.projectId,
    environmentId: input.event.environmentId,
    ruleId: input.rule.id,
    channelId: input.channel.id,
    channelKind: input.channel.kind,
    targetDisplay,
    digest: input.rule.digest,
    eventIds: [input.event.id],
    scheduledFor: input.rule.digest === "immediate" ? input.now : scheduledFor,
    subject: `${input.event.kind}: ${input.event.subject}`,
    body: `${input.event.summary}\nEvidence: ${input.event.evidence}`
  };
}

function groupDigestTasks(
  tasks: readonly NotificationDeliveryTask[]
): readonly NotificationDeliveryTask[] {
  const immediate = tasks.filter((task) => task.digest === "immediate");
  const digestGroups = new Map<string, NotificationDeliveryTask[]>();
  for (const task of tasks.filter((item) => item.digest !== "immediate")) {
    const key = [
      task.ruleId,
      task.channelId,
      task.channelKind,
      task.targetDisplay,
      task.digest,
      task.scheduledFor
    ].join("|");
    digestGroups.set(key, [...(digestGroups.get(key) ?? []), task]);
  }

  const grouped = [...digestGroups.values()].map((group) => {
    const first = group[0]!;
    const eventIds = group.flatMap((task) => [...task.eventIds]).sort();
    return {
      ...first,
      id: `notification-task-${first.ruleId}-${first.channelId}-${first.digest}-${first.scheduledFor.slice(0, 10)}`,
      eventIds,
      subject: `SearchLint ${first.digest} digest: ${eventIds.length} events`,
      body: group.map((task) => task.body).join("\n\n")
    };
  });

  return [...immediate, ...grouped].sort(compareTasks);
}

function digestScheduledFor(
  digest: NotificationRule["digest"],
  occurredAt: string
): string {
  const date = new Date(occurredAt);
  if (digest === "daily") {
    date.setUTCHours(23, 59, 0, 0);
    return date.toISOString();
  }
  if (digest === "weekly") {
    const day = date.getUTCDay();
    const daysUntilMonday = (8 - day) % 7 || 7;
    date.setUTCDate(date.getUTCDate() + daysUntilMonday);
    date.setUTCHours(9, 0, 0, 0);
    return date.toISOString();
  }
  return occurredAt;
}

function isBelowSeverityThreshold(
  rule: NotificationRule,
  event: NotificationEvent
): boolean {
  if (rule.severityThreshold === undefined || event.severity === undefined) {
    return false;
  }
  return severityRank[event.severity] < severityRank[rule.severityThreshold];
}

function suppression(
  rule: NotificationRule,
  event: NotificationEvent,
  reason: NotificationSuppressionReason,
  channelId?: string
): NotificationSuppression {
  return {
    ruleId: rule.id,
    eventId: event.id,
    ...(channelId === undefined ? {} : { channelId }),
    reason,
    evidence: `Notification rule ${rule.id} suppressed event ${event.id}: ${reason}.`
  };
}

function countStatus(
  attempts: readonly NotificationDeliveryAttempt[],
  status: NotificationDeliveryStatus
): number {
  return attempts.filter((attempt) => attempt.status === status).length;
}

function compareRules(left: NotificationRule, right: NotificationRule): number {
  return left.id.localeCompare(right.id);
}

function compareEvents(
  left: NotificationEvent,
  right: NotificationEvent
): number {
  const timeOrder = left.occurredAt.localeCompare(right.occurredAt);
  return timeOrder === 0 ? left.id.localeCompare(right.id) : timeOrder;
}

function compareTasks(
  left: NotificationDeliveryTask,
  right: NotificationDeliveryTask
): number {
  const scheduledOrder = left.scheduledFor.localeCompare(right.scheduledFor);
  return scheduledOrder === 0
    ? left.id.localeCompare(right.id)
    : scheduledOrder;
}

function maskEmail(value: string): string {
  const [localPart, domain] = value.split("@");
  if (localPart === undefined || domain === undefined) {
    return "email-recipient";
  }
  return `${localPart.slice(0, 1)}***@${domain}`;
}

function sanitizeWebhookDisplay(value: string): string {
  try {
    const parsed = new URL(value);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return "webhook-endpoint";
  }
}
