import {
  planNotificationRetry,
  type NotificationChannelKind,
  type NotificationDeliveryAttempt,
  type NotificationDeliveryTask
} from "@searchlint/api";

export type PendingNotificationDelivery = {
  task: NotificationDeliveryTask;
  attempt: number;
};

export type NotificationDeliveryQueueStore = {
  selectDueNotificationDeliveries(input: {
    now: string;
    limit: number;
  }): Promise<readonly PendingNotificationDelivery[]>;
  recordNotificationDeliveryAttempt(
    attempt: NotificationDeliveryAttempt
  ): Promise<void>;
  markNotificationDeliveryDelivered(input: {
    taskId: string;
    attemptedAt: string;
  }): Promise<void>;
  scheduleNotificationDeliveryRetry(input: {
    taskId: string;
    nextRetryAt: string;
    attempt: number;
  }): Promise<void>;
  markNotificationDeliveryFailed(input: {
    taskId: string;
    attemptedAt: string;
    failureReason: string;
  }): Promise<void>;
};

export type NotificationDeliverySink = {
  deliver(task: NotificationDeliveryTask): Promise<void>;
};

export type NotificationDeliverySinks = Readonly<
  Record<NotificationChannelKind, NotificationDeliverySink>
>;

export type NotificationDeliveryWorkerOptions = {
  store: NotificationDeliveryQueueStore;
  sinks: NotificationDeliverySinks;
  now: string;
  limit: number;
  maxAttempts: number;
  backoffMinutes: readonly number[];
};

export type NotificationDeliveryWorkerResult = {
  selected: number;
  delivered: number;
  retryScheduled: number;
  failed: number;
  attempts: readonly NotificationDeliveryAttempt[];
};

export async function deliverDueNotifications(
  options: NotificationDeliveryWorkerOptions
): Promise<NotificationDeliveryWorkerResult> {
  if (!Number.isInteger(options.limit) || options.limit < 1) {
    throw new Error("Notification delivery worker limit must be positive.");
  }
  if (!Number.isInteger(options.maxAttempts) || options.maxAttempts < 1) {
    throw new Error("Notification delivery maxAttempts must be positive.");
  }

  const pending = await options.store.selectDueNotificationDeliveries({
    now: options.now,
    limit: options.limit
  });
  const attempts: NotificationDeliveryAttempt[] = [];
  const result: NotificationDeliveryWorkerResult = {
    selected: pending.length,
    delivered: 0,
    retryScheduled: 0,
    failed: 0,
    attempts
  };

  for (const item of pending) {
    const sink = options.sinks[item.task.channelKind];
    try {
      await sink.deliver(item.task);
      const attempt = notificationAttempt({
        task: item.task,
        attemptedAt: options.now,
        attempt: item.attempt,
        status: "delivered"
      });
      await options.store.recordNotificationDeliveryAttempt(attempt);
      await options.store.markNotificationDeliveryDelivered({
        taskId: item.task.id,
        attemptedAt: options.now
      });
      attempts.push(attempt);
      result.delivered += 1;
    } catch (error) {
      const failureReason =
        error instanceof Error ? error.message : String(error);
      const failedAttempt = notificationAttempt({
        task: item.task,
        attemptedAt: options.now,
        attempt: item.attempt,
        status: "failed",
        failureReason
      });
      const retryPlan = planNotificationRetry({
        task: item.task,
        failedAttempt,
        now: options.now,
        maxAttempts: options.maxAttempts,
        backoffMinutes: options.backoffMinutes
      });
      const recordedAttempt =
        retryPlan.status === "retry_scheduled"
          ? retryScheduledAttempt(failedAttempt, retryPlan.nextRetryAt)
          : failedAttempt;
      await options.store.recordNotificationDeliveryAttempt(recordedAttempt);
      attempts.push(recordedAttempt);

      if (retryPlan.status === "retry_scheduled") {
        await options.store.scheduleNotificationDeliveryRetry({
          taskId: item.task.id,
          nextRetryAt: retryPlan.nextRetryAt!,
          attempt: retryPlan.attempt
        });
        result.retryScheduled += 1;
      } else {
        await options.store.markNotificationDeliveryFailed({
          taskId: item.task.id,
          attemptedAt: options.now,
          failureReason
        });
        result.failed += 1;
      }
    }
  }

  return result;
}

function retryScheduledAttempt(
  attempt: NotificationDeliveryAttempt,
  nextRetryAt: string | undefined
): NotificationDeliveryAttempt {
  if (nextRetryAt === undefined) {
    throw new Error(
      "Retry scheduled notification attempt requires nextRetryAt."
    );
  }
  return {
    ...attempt,
    status: "retry_scheduled",
    nextRetryAt
  };
}

function notificationAttempt(input: {
  task: NotificationDeliveryTask;
  attemptedAt: string;
  attempt: number;
  status: NotificationDeliveryAttempt["status"];
  failureReason?: string;
}): NotificationDeliveryAttempt {
  return {
    id: `attempt-${input.task.id}-${input.attempt}`,
    taskId: input.task.id,
    organizationId: input.task.organizationId,
    channelId: input.task.channelId,
    channelKind: input.task.channelKind,
    status: input.status,
    attemptedAt: input.attemptedAt,
    attempt: input.attempt,
    ...(input.failureReason === undefined
      ? {}
      : { failureReason: input.failureReason })
  };
}
