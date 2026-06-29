export type WorkerAutoscalingProvider = "aws-application-autoscaling";
export type WorkerAutoscalingServiceNamespace = "ecs";
export type WorkerAutoscalingScalableDimension = "ecs:service:DesiredCount";
export type WorkerAutoscalingPolicyType = "TargetTrackingScaling";
export type WorkerAutoscalingMetricType = "sqs-backlog-per-task";

export type WorkerAutoscalingIamAction =
  | "application-autoscaling:RegisterScalableTarget"
  | "application-autoscaling:PutScalingPolicy"
  | "application-autoscaling:DescribeScalableTargets"
  | "application-autoscaling:DescribeScalingPolicies"
  | "cloudwatch:PutMetricAlarm"
  | "cloudwatch:DescribeAlarms"
  | "sqs:GetQueueAttributes"
  | "ecs:DescribeServices";

export type WorkerAutoscalingContract = {
  id: "searchlint-crawler-worker-autoscaling-v1";
  contractVersion: 1;
  provider: WorkerAutoscalingProvider;
  serviceNamespace: WorkerAutoscalingServiceNamespace;
  scalableDimension: WorkerAutoscalingScalableDimension;
  resource: {
    clusterArnParameter: "ClusterArn";
    clusterNameParameter: "ClusterName";
    serviceLogicalId: "CrawlerWorkerService";
    queueLogicalId: "CrawlerWorkerQueue";
    deadLetterQueueLogicalId: "CrawlerWorkerDeadLetterQueue";
  };
  capacity: {
    minCapacityParameter: "WorkerMinCapacity";
    maxCapacityParameter: "WorkerMaxCapacity";
    defaultMinCapacity: number;
    defaultMaxCapacity: number;
  };
  policy: {
    policyType: WorkerAutoscalingPolicyType;
    metricType: WorkerAutoscalingMetricType;
    targetBacklogPerTaskParameter: "WorkerTargetBacklogPerTask";
    defaultTargetBacklogPerTask: number;
    scaleInCooldownSeconds: number;
    scaleOutCooldownSeconds: number;
    disableScaleIn: false;
  };
  observability: {
    requiresQueueDepthMetric: true;
    requiresRunningTaskCountMetric: true;
    alarmOnScalingPolicy: true;
  };
  iam: {
    requiredActions: readonly WorkerAutoscalingIamAction[];
  };
};

export type WorkerAutoscalingValidationIssue = {
  path: string;
  message: string;
};

export const crawlerWorkerAutoscalingContract: WorkerAutoscalingContract = {
  id: "searchlint-crawler-worker-autoscaling-v1",
  contractVersion: 1,
  provider: "aws-application-autoscaling",
  serviceNamespace: "ecs",
  scalableDimension: "ecs:service:DesiredCount",
  resource: {
    clusterArnParameter: "ClusterArn",
    clusterNameParameter: "ClusterName",
    serviceLogicalId: "CrawlerWorkerService",
    queueLogicalId: "CrawlerWorkerQueue",
    deadLetterQueueLogicalId: "CrawlerWorkerDeadLetterQueue"
  },
  capacity: {
    minCapacityParameter: "WorkerMinCapacity",
    maxCapacityParameter: "WorkerMaxCapacity",
    defaultMinCapacity: 1,
    defaultMaxCapacity: 10
  },
  policy: {
    policyType: "TargetTrackingScaling",
    metricType: "sqs-backlog-per-task",
    targetBacklogPerTaskParameter: "WorkerTargetBacklogPerTask",
    defaultTargetBacklogPerTask: 25,
    scaleInCooldownSeconds: 300,
    scaleOutCooldownSeconds: 60,
    disableScaleIn: false
  },
  observability: {
    requiresQueueDepthMetric: true,
    requiresRunningTaskCountMetric: true,
    alarmOnScalingPolicy: true
  },
  iam: {
    requiredActions: [
      "application-autoscaling:RegisterScalableTarget",
      "application-autoscaling:PutScalingPolicy",
      "application-autoscaling:DescribeScalableTargets",
      "application-autoscaling:DescribeScalingPolicies",
      "cloudwatch:PutMetricAlarm",
      "cloudwatch:DescribeAlarms",
      "sqs:GetQueueAttributes",
      "ecs:DescribeServices"
    ]
  }
};

export function validateWorkerAutoscalingContract(
  contract: WorkerAutoscalingContract
): WorkerAutoscalingValidationIssue[] {
  const issues: WorkerAutoscalingValidationIssue[] = [];

  expectEqual(
    issues,
    "id",
    contract.id,
    "searchlint-crawler-worker-autoscaling-v1"
  );
  expectEqual(issues, "contractVersion", contract.contractVersion, 1);
  expectEqual(
    issues,
    "provider",
    contract.provider,
    "aws-application-autoscaling"
  );
  expectEqual(issues, "serviceNamespace", contract.serviceNamespace, "ecs");
  expectEqual(
    issues,
    "scalableDimension",
    contract.scalableDimension,
    "ecs:service:DesiredCount"
  );
  expectEqual(
    issues,
    "resource.clusterArnParameter",
    contract.resource.clusterArnParameter,
    "ClusterArn"
  );
  expectEqual(
    issues,
    "resource.clusterNameParameter",
    contract.resource.clusterNameParameter,
    "ClusterName"
  );
  expectEqual(
    issues,
    "resource.serviceLogicalId",
    contract.resource.serviceLogicalId,
    "CrawlerWorkerService"
  );
  expectEqual(
    issues,
    "resource.queueLogicalId",
    contract.resource.queueLogicalId,
    "CrawlerWorkerQueue"
  );
  expectEqual(
    issues,
    "resource.deadLetterQueueLogicalId",
    contract.resource.deadLetterQueueLogicalId,
    "CrawlerWorkerDeadLetterQueue"
  );
  expectEqual(
    issues,
    "policy.policyType",
    contract.policy.policyType,
    "TargetTrackingScaling"
  );
  expectEqual(
    issues,
    "policy.metricType",
    contract.policy.metricType,
    "sqs-backlog-per-task"
  );
  expectEqual(
    issues,
    "policy.disableScaleIn",
    contract.policy.disableScaleIn,
    false
  );
  expectEqual(
    issues,
    "observability.requiresQueueDepthMetric",
    contract.observability.requiresQueueDepthMetric,
    true
  );
  expectEqual(
    issues,
    "observability.requiresRunningTaskCountMetric",
    contract.observability.requiresRunningTaskCountMetric,
    true
  );
  expectEqual(
    issues,
    "observability.alarmOnScalingPolicy",
    contract.observability.alarmOnScalingPolicy,
    true
  );

  validateCapacity(contract, issues);
  validatePolicy(contract, issues);
  validateIam(contract, issues);

  return issues;
}

function validateCapacity(
  contract: WorkerAutoscalingContract,
  issues: WorkerAutoscalingValidationIssue[]
): void {
  if (
    !Number.isInteger(contract.capacity.defaultMinCapacity) ||
    contract.capacity.defaultMinCapacity < 1
  ) {
    issues.push({
      path: "capacity.defaultMinCapacity",
      message: "Default min capacity must be a positive integer."
    });
  }
  if (
    !Number.isInteger(contract.capacity.defaultMaxCapacity) ||
    contract.capacity.defaultMaxCapacity < contract.capacity.defaultMinCapacity
  ) {
    issues.push({
      path: "capacity.defaultMaxCapacity",
      message: "Default max capacity must be >= default min capacity."
    });
  }
}

function validatePolicy(
  contract: WorkerAutoscalingContract,
  issues: WorkerAutoscalingValidationIssue[]
): void {
  if (
    !Number.isInteger(contract.policy.defaultTargetBacklogPerTask) ||
    contract.policy.defaultTargetBacklogPerTask < 1
  ) {
    issues.push({
      path: "policy.defaultTargetBacklogPerTask",
      message: "Target backlog per task must be a positive integer."
    });
  }
  for (const [path, value] of [
    ["policy.scaleInCooldownSeconds", contract.policy.scaleInCooldownSeconds],
    ["policy.scaleOutCooldownSeconds", contract.policy.scaleOutCooldownSeconds]
  ] as const) {
    if (!Number.isInteger(value) || value < 0) {
      issues.push({
        path,
        message: `${path} must be a non-negative integer.`
      });
    }
  }
}

function validateIam(
  contract: WorkerAutoscalingContract,
  issues: WorkerAutoscalingValidationIssue[]
): void {
  for (const action of [
    "application-autoscaling:RegisterScalableTarget",
    "application-autoscaling:PutScalingPolicy",
    "sqs:GetQueueAttributes",
    "ecs:DescribeServices"
  ] as const) {
    if (!contract.iam.requiredActions.includes(action)) {
      issues.push({
        path: "iam.requiredActions",
        message: `${action} is required for worker autoscaling.`
      });
    }
  }
}

function expectEqual(
  issues: WorkerAutoscalingValidationIssue[],
  path: string,
  actual: unknown,
  expected: unknown
): void {
  if (actual !== expected) {
    issues.push({
      path,
      message: `${path} must be ${String(expected)}.`
    });
  }
}
