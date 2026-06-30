import type { CloudWorkerDeploymentEnvironmentVariable } from "./deployment-contracts.js";

export type ExternalObservationScheduleProvider = "aws-eventbridge-scheduler";
export type ExternalObservationScheduleTarget = "aws-ecs-fargate-task";

export type ExternalObservationScheduleContract = {
  id: "searchlint-external-observation-eventbridge-ecs-fargate-v1";
  contractVersion: 1;
  provider: ExternalObservationScheduleProvider;
  schedule: {
    expression: "rate(1 hour)";
    flexibleTimeWindow: "OFF";
    retryAttempts: 2;
    deadLetterQueueRequired: true;
  };
  target: {
    kind: ExternalObservationScheduleTarget;
    packageName: "@searchlint/workers";
    binName: "searchlint-external-observation-worker";
    nodeMajor: 24;
    workerKind: "external-observation-collector";
    launchType: "FARGATE";
    networkMode: "awsvpc";
  };
  environment: {
    postgresEnvPrefix: "SEARCHLINT_POSTGRES";
    workerEnvPrefix: "SEARCHLINT_WORKER";
    variables: readonly CloudWorkerDeploymentEnvironmentVariable[];
  };
};

export type ExternalObservationScheduleValidationIssue = {
  path: string;
  message: string;
};

export const externalObservationScheduleContract: ExternalObservationScheduleContract =
  {
    id: "searchlint-external-observation-eventbridge-ecs-fargate-v1",
    contractVersion: 1,
    provider: "aws-eventbridge-scheduler",
    schedule: {
      expression: "rate(1 hour)",
      flexibleTimeWindow: "OFF",
      retryAttempts: 2,
      deadLetterQueueRequired: true
    },
    target: {
      kind: "aws-ecs-fargate-task",
      packageName: "@searchlint/workers",
      binName: "searchlint-external-observation-worker",
      nodeMajor: 24,
      workerKind: "external-observation-collector",
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
          name: "SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_PROVIDER",
          required: false,
          secretSource: "plain-env"
        },
        {
          name: "SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_POLL_INTERVAL_MS",
          required: false,
          secretSource: "plain-env"
        },
        {
          name: "SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_BATCH_SIZE",
          required: false,
          secretSource: "plain-env"
        },
        {
          name: "SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_MAX_BATCHES",
          required: true,
          secretSource: "plain-env"
        },
        {
          name: "SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_SECRET_NAME_PREFIX",
          required: false,
          secretSource: "plain-env"
        },
        {
          name: "SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_DISCOVERY_SITE_URLS",
          required: false,
          secretSource: "plain-env"
        },
        {
          name: "SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_DISCOVERY_SITEMAP_URLS",
          required: false,
          secretSource: "plain-env"
        },
        {
          name: "SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_DISCOVERY_MAX_SUBJECT_URLS",
          required: false,
          secretSource: "plain-env"
        },
        {
          name: "SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_GOOGLE_PAGESPEED_ENABLED",
          required: false,
          secretSource: "plain-env"
        },
        {
          name: "SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_GOOGLE_CRUX_ENABLED",
          required: false,
          secretSource: "plain-env"
        },
        {
          name: "SEARCHLINT_WORKER_GOOGLE_OAUTH_CLIENT_ID",
          required: false,
          secretSource: "aws-secrets-manager"
        },
        {
          name: "SEARCHLINT_WORKER_GOOGLE_OAUTH_CLIENT_SECRET",
          required: false,
          secretSource: "aws-secrets-manager"
        },
        {
          name: "SEARCHLINT_WORKER_YANDEX_OAUTH_CLIENT_ID",
          required: false,
          secretSource: "aws-secrets-manager"
        },
        {
          name: "SEARCHLINT_WORKER_YANDEX_OAUTH_CLIENT_SECRET",
          required: false,
          secretSource: "aws-secrets-manager"
        }
      ]
    }
  };

export function validateExternalObservationScheduleContract(
  contract: ExternalObservationScheduleContract
): ExternalObservationScheduleValidationIssue[] {
  const issues: ExternalObservationScheduleValidationIssue[] = [];

  expectEqual(
    issues,
    "id",
    contract.id,
    "searchlint-external-observation-eventbridge-ecs-fargate-v1"
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
    "rate(1 hour)"
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
    "searchlint-external-observation-worker"
  );
  expectEqual(issues, "target.nodeMajor", contract.target.nodeMajor, 24);
  expectEqual(
    issues,
    "target.workerKind",
    contract.target.workerKind,
    "external-observation-collector"
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
  contract: ExternalObservationScheduleContract,
  issues: ExternalObservationScheduleValidationIssue[]
): void {
  if (
    !Number.isInteger(contract.schedule.retryAttempts) ||
    contract.schedule.retryAttempts < 0
  ) {
    issues.push({
      path: "schedule.retryAttempts",
      message:
        "External observation schedule retry attempts must be non-negative."
    });
  }
}

function validateEnvironment(
  contract: ExternalObservationScheduleContract,
  issues: ExternalObservationScheduleValidationIssue[]
): void {
  const variables = new Map(
    contract.environment.variables.map((variable) => [variable.name, variable])
  );

  for (const name of [
    "SEARCHLINT_POSTGRES_DATABASE_URL",
    "SEARCHLINT_POSTGRES_SSL_MODE",
    "SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_POLL_INTERVAL_MS",
    "SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_BATCH_SIZE",
    "SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_MAX_BATCHES"
  ]) {
    const variable = variables.get(name);
    if (!variable) {
      issues.push({
        path: "environment.variables",
        message: `${name} is required.`
      });
    }
  }

  const databaseUrl = variables.get("SEARCHLINT_POSTGRES_DATABASE_URL");
  if (databaseUrl?.required !== true) {
    issues.push({
      path: "environment.variables.SEARCHLINT_POSTGRES_DATABASE_URL.required",
      message: "PostgreSQL database URL must be marked required."
    });
  }
  if (databaseUrl?.secretSource !== "aws-secrets-manager") {
    issues.push({
      path: "environment.variables.SEARCHLINT_POSTGRES_DATABASE_URL.secretSource",
      message: "PostgreSQL database URL must come from AWS Secrets Manager."
    });
  }

  const maxBatches = variables.get(
    "SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_MAX_BATCHES"
  );
  if (maxBatches?.required !== true) {
    issues.push({
      path: "environment.variables.SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_MAX_BATCHES.required",
      message: "Scheduled external observation tasks must set max batches."
    });
  }

  for (const secretName of [
    "SEARCHLINT_WORKER_GOOGLE_OAUTH_CLIENT_ID",
    "SEARCHLINT_WORKER_GOOGLE_OAUTH_CLIENT_SECRET",
    "SEARCHLINT_WORKER_YANDEX_OAUTH_CLIENT_ID",
    "SEARCHLINT_WORKER_YANDEX_OAUTH_CLIENT_SECRET"
  ]) {
    const variable = variables.get(secretName);
    if (variable && variable.secretSource !== "aws-secrets-manager") {
      issues.push({
        path: `environment.variables.${secretName}.secretSource`,
        message: `${secretName} must come from AWS Secrets Manager.`
      });
    }
  }
}

function expectEqual(
  issues: ExternalObservationScheduleValidationIssue[],
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
