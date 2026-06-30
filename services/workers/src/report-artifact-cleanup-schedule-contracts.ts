import type { CloudWorkerDeploymentEnvironmentVariable } from "./deployment-contracts.js";

export type ReportArtifactCleanupScheduleProvider = "aws-eventbridge-scheduler";
export type ReportArtifactCleanupScheduleTarget = "aws-ecs-fargate-task";
export type ReportArtifactCleanupScheduleSecretSource =
  | "aws-secrets-manager"
  | "plain-env";

export type ReportArtifactCleanupScheduleContract = {
  id: "searchlint-report-artifact-cleanup-eventbridge-ecs-fargate-v1";
  contractVersion: 1;
  provider: ReportArtifactCleanupScheduleProvider;
  schedule: {
    expression: "rate(15 minutes)";
    flexibleTimeWindow: "OFF";
    retryAttempts: 2;
    deadLetterQueueRequired: true;
  };
  target: {
    kind: ReportArtifactCleanupScheduleTarget;
    packageName: "@searchlint/workers";
    binName: "searchlint-report-artifact-cleanup-worker";
    nodeMajor: 24;
    workerKind: "report-artifact-cleanup-poller";
    launchType: "FARGATE";
    networkMode: "awsvpc";
  };
  environment: {
    postgresEnvPrefix: "SEARCHLINT_POSTGRES";
    workerEnvPrefix: "SEARCHLINT_WORKER";
    variables: readonly CloudWorkerDeploymentEnvironmentVariable[];
  };
};

export type ReportArtifactCleanupScheduleValidationIssue = {
  path: string;
  message: string;
};

export const reportArtifactCleanupScheduleContract: ReportArtifactCleanupScheduleContract =
  {
    id: "searchlint-report-artifact-cleanup-eventbridge-ecs-fargate-v1",
    contractVersion: 1,
    provider: "aws-eventbridge-scheduler",
    schedule: {
      expression: "rate(15 minutes)",
      flexibleTimeWindow: "OFF",
      retryAttempts: 2,
      deadLetterQueueRequired: true
    },
    target: {
      kind: "aws-ecs-fargate-task",
      packageName: "@searchlint/workers",
      binName: "searchlint-report-artifact-cleanup-worker",
      nodeMajor: 24,
      workerKind: "report-artifact-cleanup-poller",
      launchType: "FARGATE",
      networkMode: "awsvpc"
    },
    environment: {
      postgresEnvPrefix: "SEARCHLINT_POSTGRES",
      workerEnvPrefix: "SEARCHLINT_WORKER",
      variables: [
        {
          name: "SEARCHLINT_POSTGRES_DATABASE_URL",
          required: true,
          secretSource: "aws-secrets-manager"
        },
        {
          name: "SEARCHLINT_POSTGRES_SSL_MODE",
          required: true,
          secretSource: "plain-env"
        },
        {
          name: "SEARCHLINT_WORKER_REPORT_ARTIFACT_CLEANUP_POLL_INTERVAL_MS",
          required: false,
          secretSource: "plain-env"
        },
        {
          name: "SEARCHLINT_WORKER_REPORT_ARTIFACT_CLEANUP_BATCH_SIZE",
          required: false,
          secretSource: "plain-env"
        }
      ]
    }
  };

export function validateReportArtifactCleanupScheduleContract(
  contract: ReportArtifactCleanupScheduleContract
): ReportArtifactCleanupScheduleValidationIssue[] {
  const issues: ReportArtifactCleanupScheduleValidationIssue[] = [];

  expectEqual(
    issues,
    "id",
    contract.id,
    "searchlint-report-artifact-cleanup-eventbridge-ecs-fargate-v1"
  );
  expectEqual(issues, "contractVersion", contract.contractVersion, 1);
  expectEqual(
    issues,
    "provider",
    contract.provider,
    "aws-eventbridge-scheduler"
  );
  expectEqual(
    issues,
    "schedule.expression",
    contract.schedule.expression,
    "rate(15 minutes)"
  );
  expectEqual(
    issues,
    "schedule.flexibleTimeWindow",
    contract.schedule.flexibleTimeWindow,
    "OFF"
  );
  expectEqual(
    issues,
    "schedule.deadLetterQueueRequired",
    contract.schedule.deadLetterQueueRequired,
    true
  );
  expectEqual(
    issues,
    "target.kind",
    contract.target.kind,
    "aws-ecs-fargate-task"
  );
  expectEqual(
    issues,
    "target.packageName",
    contract.target.packageName,
    "@searchlint/workers"
  );
  expectEqual(
    issues,
    "target.binName",
    contract.target.binName,
    "searchlint-report-artifact-cleanup-worker"
  );
  expectEqual(issues, "target.nodeMajor", contract.target.nodeMajor, 24);
  expectEqual(
    issues,
    "target.workerKind",
    contract.target.workerKind,
    "report-artifact-cleanup-poller"
  );
  expectEqual(
    issues,
    "target.launchType",
    contract.target.launchType,
    "FARGATE"
  );
  expectEqual(
    issues,
    "target.networkMode",
    contract.target.networkMode,
    "awsvpc"
  );
  expectEqual(
    issues,
    "environment.postgresEnvPrefix",
    contract.environment.postgresEnvPrefix,
    "SEARCHLINT_POSTGRES"
  );
  expectEqual(
    issues,
    "environment.workerEnvPrefix",
    contract.environment.workerEnvPrefix,
    "SEARCHLINT_WORKER"
  );

  validateSchedule(contract, issues);
  validateEnvironment(contract, issues);

  return issues;
}

function validateSchedule(
  contract: ReportArtifactCleanupScheduleContract,
  issues: ReportArtifactCleanupScheduleValidationIssue[]
): void {
  if (
    !Number.isInteger(contract.schedule.retryAttempts) ||
    contract.schedule.retryAttempts < 0
  ) {
    issues.push({
      path: "schedule.retryAttempts",
      message:
        "Report artifact cleanup schedule retry attempts must be non-negative."
    });
  }
}

function validateEnvironment(
  contract: ReportArtifactCleanupScheduleContract,
  issues: ReportArtifactCleanupScheduleValidationIssue[]
): void {
  const variables = new Map(
    contract.environment.variables.map((variable) => [variable.name, variable])
  );

  for (const name of [
    "SEARCHLINT_POSTGRES_DATABASE_URL",
    "SEARCHLINT_POSTGRES_SSL_MODE"
  ]) {
    const variable = variables.get(name);
    if (!variable) {
      issues.push({
        path: "environment.variables",
        message: `${name} is required.`
      });
      continue;
    }

    if (!variable.required) {
      issues.push({
        path: `environment.variables.${name}.required`,
        message: `${name} must be marked required.`
      });
    }
  }

  const databaseUrl = variables.get("SEARCHLINT_POSTGRES_DATABASE_URL");
  if (databaseUrl?.secretSource !== "aws-secrets-manager") {
    issues.push({
      path: "environment.variables.SEARCHLINT_POSTGRES_DATABASE_URL.secretSource",
      message: "PostgreSQL database URL must come from AWS Secrets Manager."
    });
  }
}

function expectEqual(
  issues: ReportArtifactCleanupScheduleValidationIssue[],
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
