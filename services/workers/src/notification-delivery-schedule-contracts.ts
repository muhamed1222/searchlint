export type NotificationDeliveryScheduleProvider = "aws-eventbridge-scheduler";

export type NotificationDeliveryScheduleTarget = "aws-ecs-fargate-task";

export type NotificationDeliveryScheduleContract = {
  name: string;
  provider: NotificationDeliveryScheduleProvider;
  scheduleExpression: string;
  maximumEventAgeSeconds: number;
  retryAttempts: number;
  target: {
    kind: NotificationDeliveryScheduleTarget;
    command: readonly string[];
    environment: Readonly<Record<string, string>>;
    secrets: readonly string[];
  };
};

export type NotificationDeliveryScheduleValidationIssue = {
  path: string;
  message: string;
};

export const notificationDeliveryScheduleContract: NotificationDeliveryScheduleContract =
  {
    name: "searchlint-notification-delivery",
    provider: "aws-eventbridge-scheduler",
    scheduleExpression: "rate(1 minute)",
    maximumEventAgeSeconds: 300,
    retryAttempts: 2,
    target: {
      kind: "aws-ecs-fargate-task",
      command: ["node", "dist/src/notification-delivery-bin.js"],
      environment: {
        SEARCHLINT_NOTIFICATION_DELIVERY_LIMIT: "50",
        SEARCHLINT_NOTIFICATION_MAX_ATTEMPTS: "3",
        SEARCHLINT_NOTIFICATION_BACKOFF_MINUTES: "5,15,60"
      },
      secrets: [
        "SEARCHLINT_NOTIFICATION_EMAIL_SECRET_REF",
        "SEARCHLINT_NOTIFICATION_SLACK_SECRET_REF",
        "SEARCHLINT_NOTIFICATION_WEBHOOK_SECRET_REF",
        "SEARCHLINT_NOTIFICATION_TELEGRAM_SECRET_REF"
      ]
    }
  };

export function validateNotificationDeliveryScheduleContract(
  contract: NotificationDeliveryScheduleContract
): readonly NotificationDeliveryScheduleValidationIssue[] {
  const issues: NotificationDeliveryScheduleValidationIssue[] = [];
  if (contract.provider !== "aws-eventbridge-scheduler") {
    issues.push({
      path: "provider",
      message: "Notification delivery scheduler must use EventBridge Scheduler."
    });
  }
  if (contract.scheduleExpression !== "rate(1 minute)") {
    issues.push({
      path: "scheduleExpression",
      message: "Notification delivery scheduler must run every minute."
    });
  }
  if (contract.maximumEventAgeSeconds > 300) {
    issues.push({
      path: "maximumEventAgeSeconds",
      message: "Notification delivery events must expire within 300 seconds."
    });
  }
  if (contract.retryAttempts > 2) {
    issues.push({
      path: "retryAttempts",
      message:
        "Scheduler retries must stay bounded; worker handles provider retry policy."
    });
  }
  if (contract.target.kind !== "aws-ecs-fargate-task") {
    issues.push({
      path: "target.kind",
      message: "Notification delivery target must be an ECS Fargate task."
    });
  }
  if (
    !contract.target.command.includes("dist/src/notification-delivery-bin.js")
  ) {
    issues.push({
      path: "target.command",
      message:
        "Notification delivery target must run the notification delivery entrypoint."
    });
  }
  for (const name of [
    "SEARCHLINT_NOTIFICATION_DELIVERY_LIMIT",
    "SEARCHLINT_NOTIFICATION_MAX_ATTEMPTS",
    "SEARCHLINT_NOTIFICATION_BACKOFF_MINUTES"
  ]) {
    if (contract.target.environment[name] === undefined) {
      issues.push({
        path: `target.environment.${name}`,
        message: `${name} must be configured.`
      });
    }
  }
  for (const secretName of contract.target.secrets) {
    if (!secretName.startsWith("SEARCHLINT_NOTIFICATION_")) {
      issues.push({
        path: "target.secrets",
        message:
          "Notification delivery secrets must use SearchLint notification names."
      });
    }
  }
  return issues;
}
