import {
  cloudWatchLogProvisioningContract,
  type CloudWatchLogGroupContract,
  type CloudWatchLogProducerKind
} from "./cloudwatch-log-provisioning-contracts.js";

export type EcsAwslogsContractId = "searchlint-ecs-awslogs-log-driver-v1";
export type EcsAwslogsProvider = "aws-ecs-log-configuration";
export type EcsAwslogsRuntime = "aws-ecs-fargate";
export type EcsAwslogsDriver = "awslogs";
export type EcsAwslogsMode = "non-blocking";
export type EcsAwslogsRegionEnv = "SEARCHLINT_AWS_REGION";
export type EcsAwslogsExecutionRoleAction =
  | "logs:CreateLogStream"
  | "logs:PutLogEvents";

export type EcsAwslogsContainerContract = {
  producer: CloudWatchLogProducerKind;
  serviceName: CloudWatchLogGroupContract["serviceName"];
  packageName: CloudWatchLogGroupContract["packageName"];
  logGroupName: CloudWatchLogGroupContract["name"];
  logDriver: EcsAwslogsDriver;
  regionEnv: EcsAwslogsRegionEnv;
  streamPrefix: CloudWatchLogGroupContract["serviceName"];
  mode: EcsAwslogsMode;
  maxBufferSize: "25m";
};

export type EcsAwslogsLogDriverContract = {
  id: EcsAwslogsContractId;
  contractVersion: 1;
  provider: EcsAwslogsProvider;
  runtime: EcsAwslogsRuntime;
  containers: readonly EcsAwslogsContainerContract[];
  executionRole: {
    requiredActions: readonly EcsAwslogsExecutionRoleAction[];
  };
};

export type EcsAwslogsLogDriverValidationIssue = {
  path: string;
  message: string;
};

const regionEnv: EcsAwslogsRegionEnv = "SEARCHLINT_AWS_REGION";
const logDriver: EcsAwslogsDriver = "awslogs";
const mode: EcsAwslogsMode = "non-blocking";
const maxBufferSize = "25m";
const requiredActions: readonly EcsAwslogsExecutionRoleAction[] = [
  "logs:CreateLogStream",
  "logs:PutLogEvents"
];

export const ecsAwslogsLogDriverContract: EcsAwslogsLogDriverContract = {
  id: "searchlint-ecs-awslogs-log-driver-v1",
  contractVersion: 1,
  provider: "aws-ecs-log-configuration",
  runtime: "aws-ecs-fargate",
  containers: cloudWatchLogProvisioningContract.groups.map((group) => ({
    producer: group.producer,
    serviceName: group.serviceName,
    packageName: group.packageName,
    logGroupName: group.name,
    logDriver,
    regionEnv,
    streamPrefix: group.serviceName,
    mode,
    maxBufferSize
  })),
  executionRole: {
    requiredActions
  }
};

export function validateEcsAwslogsLogDriverContract(
  contract: EcsAwslogsLogDriverContract
): EcsAwslogsLogDriverValidationIssue[] {
  const issues: EcsAwslogsLogDriverValidationIssue[] = [];

  expectEqual(
    issues,
    "id",
    contract.id,
    "searchlint-ecs-awslogs-log-driver-v1"
  );
  expectEqual(issues, "contractVersion", contract.contractVersion, 1);
  expectEqual(
    issues,
    "provider",
    contract.provider,
    "aws-ecs-log-configuration"
  );
  expectEqual(issues, "runtime", contract.runtime, "aws-ecs-fargate");

  const containers = new Map(
    contract.containers.map((container) => [container.producer, container])
  );
  for (const group of cloudWatchLogProvisioningContract.groups) {
    validateRequiredContainer(issues, containers, group);
  }

  for (const container of contract.containers) {
    validateContainer(issues, container);
  }

  validateExecutionRole(issues, contract.executionRole.requiredActions);

  return issues;
}

function validateRequiredContainer(
  issues: EcsAwslogsLogDriverValidationIssue[],
  containers: ReadonlyMap<
    CloudWatchLogProducerKind,
    EcsAwslogsContainerContract
  >,
  group: CloudWatchLogGroupContract
): void {
  const container = containers.get(group.producer);
  if (!container) {
    issues.push({
      path: "containers",
      message: `${group.producer} awslogs container contract is required.`
    });
    return;
  }

  const basePath = `containers.${group.producer}`;
  expectEqual(
    issues,
    `${basePath}.serviceName`,
    container.serviceName,
    group.serviceName
  );
  expectEqual(
    issues,
    `${basePath}.packageName`,
    container.packageName,
    group.packageName
  );
  expectEqual(
    issues,
    `${basePath}.logGroupName`,
    container.logGroupName,
    group.name
  );
  expectEqual(
    issues,
    `${basePath}.streamPrefix`,
    container.streamPrefix,
    group.serviceName
  );
}

function validateContainer(
  issues: EcsAwslogsLogDriverValidationIssue[],
  container: EcsAwslogsContainerContract
): void {
  const basePath = `containers.${container.producer}`;

  expectEqual(issues, `${basePath}.logDriver`, container.logDriver, logDriver);
  expectEqual(issues, `${basePath}.regionEnv`, container.regionEnv, regionEnv);
  expectEqual(issues, `${basePath}.mode`, container.mode, mode);
  expectEqual(
    issues,
    `${basePath}.maxBufferSize`,
    container.maxBufferSize,
    maxBufferSize
  );
}

function validateExecutionRole(
  issues: EcsAwslogsLogDriverValidationIssue[],
  actions: readonly EcsAwslogsExecutionRoleAction[]
): void {
  for (const action of requiredActions) {
    if (!actions.includes(action)) {
      issues.push({
        path: "executionRole.requiredActions",
        message: `${action} execution-role permission is required.`
      });
    }
  }

  for (const action of actions) {
    if (!requiredActions.includes(action)) {
      issues.push({
        path: "executionRole.requiredActions",
        message: `${action} is not part of the approved awslogs permission set.`
      });
    }
  }
}

function expectEqual(
  issues: EcsAwslogsLogDriverValidationIssue[],
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
