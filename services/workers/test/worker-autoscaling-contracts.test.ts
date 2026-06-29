import { describe, expect, it } from "vitest";

import {
  crawlerWorkerAutoscalingContract,
  validateWorkerAutoscalingContract
} from "../src/index.js";

describe("crawlerWorkerAutoscalingContract", () => {
  it("defines the static ECS Application Auto Scaling target contract", () => {
    expect(
      validateWorkerAutoscalingContract(crawlerWorkerAutoscalingContract)
    ).toEqual([]);
    expect(crawlerWorkerAutoscalingContract.provider).toBe(
      "aws-application-autoscaling"
    );
    expect(crawlerWorkerAutoscalingContract.serviceNamespace).toBe("ecs");
    expect(crawlerWorkerAutoscalingContract.scalableDimension).toBe(
      "ecs:service:DesiredCount"
    );
    expect(crawlerWorkerAutoscalingContract.capacity).toEqual({
      minCapacityParameter: "WorkerMinCapacity",
      maxCapacityParameter: "WorkerMaxCapacity",
      defaultMinCapacity: 1,
      defaultMaxCapacity: 10
    });
  });

  it("defines SQS backlog pressure as the target tracking policy", () => {
    expect(crawlerWorkerAutoscalingContract.policy).toEqual({
      policyType: "TargetTrackingScaling",
      metricType: "sqs-backlog-per-task",
      targetBacklogPerTaskParameter: "WorkerTargetBacklogPerTask",
      defaultTargetBacklogPerTask: 25,
      scaleInCooldownSeconds: 300,
      scaleOutCooldownSeconds: 60,
      disableScaleIn: false
    });
    expect(crawlerWorkerAutoscalingContract.observability).toEqual({
      requiresQueueDepthMetric: true,
      requiresRunningTaskCountMetric: true,
      alarmOnScalingPolicy: true
    });
  });

  it("declares the IAM actions required to manage and inspect scaling", () => {
    expect(crawlerWorkerAutoscalingContract.iam.requiredActions).toEqual([
      "application-autoscaling:RegisterScalableTarget",
      "application-autoscaling:PutScalingPolicy",
      "application-autoscaling:DescribeScalableTargets",
      "application-autoscaling:DescribeScalingPolicies",
      "cloudwatch:PutMetricAlarm",
      "cloudwatch:DescribeAlarms",
      "sqs:GetQueueAttributes",
      "ecs:DescribeServices"
    ]);
  });

  it("rejects autoscaling contract drift", () => {
    const issues = validateWorkerAutoscalingContract({
      ...crawlerWorkerAutoscalingContract,
      provider: "other" as "aws-application-autoscaling",
      serviceNamespace: "other" as "ecs",
      scalableDimension: "other" as "ecs:service:DesiredCount",
      capacity: {
        ...crawlerWorkerAutoscalingContract.capacity,
        defaultMinCapacity: 0,
        defaultMaxCapacity: -1
      },
      policy: {
        ...crawlerWorkerAutoscalingContract.policy,
        policyType: "other" as "TargetTrackingScaling",
        metricType: "other" as "sqs-backlog-per-task",
        defaultTargetBacklogPerTask: 0,
        scaleInCooldownSeconds: -1,
        scaleOutCooldownSeconds: -1,
        disableScaleIn: true as false
      },
      observability: {
        requiresQueueDepthMetric: false as true,
        requiresRunningTaskCountMetric: false as true,
        alarmOnScalingPolicy: false as true
      },
      iam: {
        requiredActions: []
      }
    });

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "provider" }),
        expect.objectContaining({ path: "serviceNamespace" }),
        expect.objectContaining({ path: "scalableDimension" }),
        expect.objectContaining({ path: "capacity.defaultMinCapacity" }),
        expect.objectContaining({ path: "capacity.defaultMaxCapacity" }),
        expect.objectContaining({ path: "policy.policyType" }),
        expect.objectContaining({ path: "policy.metricType" }),
        expect.objectContaining({ path: "policy.defaultTargetBacklogPerTask" }),
        expect.objectContaining({ path: "policy.scaleInCooldownSeconds" }),
        expect.objectContaining({ path: "policy.scaleOutCooldownSeconds" }),
        expect.objectContaining({ path: "policy.disableScaleIn" }),
        expect.objectContaining({
          path: "observability.requiresQueueDepthMetric"
        }),
        expect.objectContaining({
          path: "observability.requiresRunningTaskCountMetric"
        }),
        expect.objectContaining({ path: "observability.alarmOnScalingPolicy" }),
        expect.objectContaining({ path: "iam.requiredActions" })
      ])
    );
  });
});
