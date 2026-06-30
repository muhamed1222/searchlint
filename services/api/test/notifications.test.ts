import { describe, expect, it } from "vitest";

import {
  evaluateNotificationRules,
  notificationAttemptsToMetricEvents,
  planNotificationRetry,
  sanitizeNotificationChannelTarget,
  summarizeNotificationDeliveryHistory,
  summarizeNotificationSettings
} from "../src/index.js";
import type {
  NotificationChannel,
  NotificationDeliveryAttempt,
  NotificationEvent,
  NotificationRule
} from "../src/index.js";

describe("notifications", () => {
  it("evaluates thresholds, channel settings, mute, snooze, and digest grouping", () => {
    const result = evaluateNotificationRules({
      rules: [
        rule({
          id: "rule-immediate",
          channelIds: ["email-1", "slack-1"],
          severityThreshold: "error"
        }),
        rule({
          id: "rule-digest",
          digest: "daily",
          channelIds: ["webhook-1"],
          severityThreshold: "info",
          eventKinds: ["diagnostic.created", "external_observation.stale"]
        }),
        rule({
          id: "rule-muted",
          channelIds: ["telegram-1"],
          severityThreshold: "info",
          mutedUntil: "2026-06-22T13:00:00.000Z"
        }),
        rule({
          id: "rule-snoozed",
          channelIds: ["telegram-1"],
          severityThreshold: "info",
          snoozedUntil: "2026-06-22T13:00:00.000Z"
        })
      ],
      channels: [
        channel({
          id: "email-1",
          kind: "email",
          targetDisplay: "alerts@example.com"
        }),
        channel({ id: "slack-1", kind: "slack", targetDisplay: "#seo-alerts" }),
        channel({
          id: "webhook-1",
          kind: "webhook",
          targetDisplay: "https://hooks.example.test/searchlint?token=secret"
        }),
        channel({ id: "telegram-1", kind: "telegram", targetDisplay: "123456" })
      ],
      events: [
        event({ id: "event-warning", severity: "warning" }),
        event({ id: "event-error", severity: "error" }),
        event({
          id: "event-stale",
          kind: "external_observation.stale"
        })
      ],
      now: "2026-06-22T12:00:00.000Z"
    });

    expect(
      result.tasks.map((task) => [task.id, task.channelKind, task.eventIds])
    ).toEqual([
      [
        "notification-task-rule-immediate-email-1-event-error",
        "email",
        ["event-error"]
      ],
      [
        "notification-task-rule-immediate-slack-1-event-error",
        "slack",
        ["event-error"]
      ],
      [
        "notification-task-rule-digest-webhook-1-daily-2026-06-22",
        "webhook",
        ["event-error", "event-stale", "event-warning"]
      ]
    ]);
    expect(result.tasks[2]?.targetDisplay).toBe(
      "https://hooks.example.test/searchlint"
    );
    expect(result.suppressions.map((item) => item.reason)).toContain(
      "severity-below-threshold"
    );
    expect(result.suppressions.map((item) => item.reason)).toContain("muted");
    expect(result.suppressions.map((item) => item.reason)).toContain("snoozed");
  });

  it("summarizes settings and delivery history", () => {
    expect(
      summarizeNotificationSettings({
        channels: [
          channel({ id: "email-1", kind: "email", enabled: true }),
          channel({ id: "slack-1", kind: "slack", enabled: false })
        ],
        rules: [
          rule({ id: "rule-1", digest: "immediate", enabled: true }),
          rule({ id: "rule-2", digest: "weekly", enabled: false })
        ]
      })
    ).toEqual({
      channelCount: 2,
      enabledChannelCount: 1,
      ruleCount: 2,
      enabledRuleCount: 1,
      immediateRuleCount: 1,
      digestRuleCount: 1
    });

    expect(
      summarizeNotificationDeliveryHistory([
        attempt({
          id: "attempt-1",
          status: "delivered",
          attemptedAt: "2026-06-22T12:00:00.000Z"
        }),
        attempt({
          id: "attempt-2",
          status: "retry_scheduled",
          attemptedAt: "2026-06-22T12:05:00.000Z"
        }),
        attempt({
          id: "attempt-3",
          status: "failed",
          attemptedAt: "2026-06-22T12:10:00.000Z"
        })
      ])
    ).toEqual({
      pending: 0,
      delivered: 1,
      failed: 1,
      retryScheduled: 1,
      suppressed: 0,
      latestAttemptAt: "2026-06-22T12:10:00.000Z"
    });
  });

  it("plans retries and emits delivery metric events", () => {
    const task = evaluateNotificationRules({
      rules: [rule({ id: "rule-1", channelIds: ["email-1"] })],
      channels: [channel({ id: "email-1", kind: "email" })],
      events: [event({ id: "event-1", severity: "blocker" })],
      now: "2026-06-22T12:00:00.000Z"
    }).tasks[0]!;

    expect(
      planNotificationRetry({
        task,
        failedAttempt: attempt({
          id: "attempt-1",
          taskId: task.id,
          attempt: 1,
          status: "failed"
        }),
        now: "2026-06-22T12:00:00.000Z",
        maxAttempts: 3,
        backoffMinutes: [5, 15, 60]
      })
    ).toEqual({
      status: "retry_scheduled",
      attempt: 2,
      nextRetryAt: "2026-06-22T12:05:00.000Z",
      evidence: `Notification task ${task.id} will retry attempt 2 at 2026-06-22T12:05:00.000Z.`
    });

    expect(
      planNotificationRetry({
        task,
        failedAttempt: attempt({
          id: "attempt-3",
          taskId: task.id,
          attempt: 3,
          status: "failed"
        }),
        now: "2026-06-22T12:30:00.000Z",
        maxAttempts: 3,
        backoffMinutes: [5, 15, 60]
      }).status
    ).toBe("failed");

    expect(
      notificationAttemptsToMetricEvents({
        organizationId: "org-1",
        attempts: [attempt({ id: "attempt-1", status: "delivered" })]
      })
    ).toEqual([
      {
        id: "metric-attempt-1",
        organizationId: "org-1",
        name: "notification.delivery.delivered",
        value: 1,
        occurredAt: "2026-06-22T12:00:00.000Z",
        dimensions: {
          channelKind: "email",
          channelId: "email-1"
        }
      }
    ]);
  });

  it("sanitizes channel targets without leaking secrets", () => {
    expect(
      sanitizeNotificationChannelTarget(
        channel({ kind: "email", targetDisplay: "alerts@example.com" })
      )
    ).toBe("a***@example.com");
    expect(
      sanitizeNotificationChannelTarget(
        channel({ kind: "slack", targetDisplay: "#seo-alerts" })
      )
    ).toBe("#seo-alerts");
    expect(
      sanitizeNotificationChannelTarget(
        channel({
          kind: "webhook",
          targetDisplay: "https://hooks.example.test/searchlint?token=secret"
        })
      )
    ).toBe("https://hooks.example.test/searchlint");
    expect(
      sanitizeNotificationChannelTarget(
        channel({ kind: "telegram", targetDisplay: "123456:secret" })
      )
    ).toBe("telegram-chat");
  });
});

function channel(
  overrides: Partial<NotificationChannel> & {
    targetDisplay?: string;
  } = {}
): NotificationChannel {
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

function rule(overrides: Partial<NotificationRule> = {}): NotificationRule {
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

function event(overrides: Partial<NotificationEvent> = {}): NotificationEvent {
  return {
    id: "event-1",
    organizationId: "org-1",
    projectId: "project-1",
    environmentId: "env-1",
    kind: "diagnostic.created",
    occurredAt: "2026-06-22T12:00:00.000Z",
    severity: "blocker",
    subject: "SL-META-001 on /products/widget",
    summary: "SearchLint found a blocker diagnostic.",
    evidence: "Missing canonical on https://example.test/products/widget.",
    ...overrides
  };
}

function attempt(
  overrides: Partial<NotificationDeliveryAttempt> = {}
): NotificationDeliveryAttempt {
  return {
    id: "attempt-1",
    taskId: "notification-task-rule-1-email-1-event-1",
    organizationId: "org-1",
    channelId: "email-1",
    channelKind: "email",
    status: "delivered",
    attemptedAt: "2026-06-22T12:00:00.000Z",
    attempt: 1,
    ...overrides
  };
}
