import { describe, expect, it } from "vitest";

import {
  deliverDueNotifications,
  notificationDeliveryScheduleContract,
  validateNotificationDeliveryScheduleContract
} from "../src/index.js";
import type {
  NotificationDeliveryQueueStore,
  NotificationDeliverySinks,
  PendingNotificationDelivery
} from "../src/index.js";
import type { NotificationDeliveryTask } from "@searchlint/api";

describe("deliverDueNotifications", () => {
  it("delivers due notification tasks and records retry/final failure transitions", async () => {
    const harness = createHarness([
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
    ]);

    await expect(
      deliverDueNotifications({
        store: harness.store,
        sinks: harness.sinks,
        now: "2026-06-23T12:00:00.000Z",
        limit: 50,
        maxAttempts: 3,
        backoffMinutes: [5, 15, 60]
      })
    ).resolves.toMatchObject({
      selected: 3,
      delivered: 1,
      retryScheduled: 1,
      failed: 1
    });
    expect(harness.events).toEqual([
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
    ]);
  });

  it("rejects unsafe worker limits before selecting tasks", async () => {
    const harness = createHarness([]);

    await expect(
      deliverDueNotifications({
        store: harness.store,
        sinks: harness.sinks,
        now: "2026-06-23T12:00:00.000Z",
        limit: 0,
        maxAttempts: 3,
        backoffMinutes: [5]
      })
    ).rejects.toThrow("Notification delivery worker limit must be positive.");
    expect(harness.events).toEqual([]);
  });
});

describe("notification delivery schedule contract", () => {
  it("validates the static scheduler contract", () => {
    expect(
      validateNotificationDeliveryScheduleContract(
        notificationDeliveryScheduleContract
      )
    ).toEqual([]);
  });

  it("reports deterministic drift issues", () => {
    expect(
      validateNotificationDeliveryScheduleContract({
        ...notificationDeliveryScheduleContract,
        scheduleExpression: "rate(10 minutes)",
        maximumEventAgeSeconds: 600,
        target: {
          ...notificationDeliveryScheduleContract.target,
          command: ["node", "dist/src/other.js"],
          environment: {}
        }
      })
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "scheduleExpression" }),
        expect.objectContaining({ path: "maximumEventAgeSeconds" }),
        expect.objectContaining({ path: "target.command" }),
        expect.objectContaining({
          path: "target.environment.SEARCHLINT_NOTIFICATION_DELIVERY_LIMIT"
        })
      ])
    );
  });
});

function createHarness(pending: readonly PendingNotificationDelivery[]) {
  const events: string[] = [];
  const store: NotificationDeliveryQueueStore = {
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
  const sinks: NotificationDeliverySinks = {
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

function task(
  overrides: Partial<NotificationDeliveryTask> = {}
): NotificationDeliveryTask {
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
