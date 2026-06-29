export type CloudApiRateLimitProvisioningProvider = "aws-rds-postgresql";
export type CloudApiRateLimitAlgorithm = "fixed-window-insert-on-conflict";
export type CloudApiRateLimitStoreFactory =
  "createPostgresDistributedRateLimitStore";
export type CloudApiRateLimitRuntimePackage = "@searchlint/api";
export type CloudApiRateLimitSecretSource = "aws-secrets-manager" | "plain-env";
export type CloudApiRateLimitIamPrincipal = "cloud-api-task";
export type CloudApiRateLimitIamAction =
  | "secretsmanager:GetSecretValue"
  | "kms:Decrypt";
export type CloudApiRateLimitIamResourceRef =
  | "postgresDatabaseSecretArn"
  | "postgresDatabaseSecretKmsKeyArn";

export type CloudApiRateLimitEnvironmentVariable = {
  name:
    | "SEARCHLINT_API_RATE_LIMIT_STORE"
    | "SEARCHLINT_API_RATE_LIMIT_WINDOW_MS"
    | "SEARCHLINT_API_RATE_LIMIT_MAX_REQUESTS"
    | "SEARCHLINT_POSTGRES_DATABASE_URL"
    | "SEARCHLINT_POSTGRES_SSL_MODE";
  required: boolean;
  secretSource: CloudApiRateLimitSecretSource;
};

export type CloudApiRateLimitStoreContract = {
  provider: CloudApiRateLimitProvisioningProvider;
  tableName: "rate_limit_windows";
  schemaVersion: "cloud.rate_limit_windows.v1";
  migrationRequired: true;
  algorithm: CloudApiRateLimitAlgorithm;
  resetIndexName: "rate_limit_windows_reset_idx";
};

export type CloudApiRateLimitRuntimeContract = {
  packageName: CloudApiRateLimitRuntimePackage;
  storeFactory: CloudApiRateLimitStoreFactory;
  modeEnv: "SEARCHLINT_API_RATE_LIMIT_STORE";
  modeValue: "postgres";
  windowMsEnv: "SEARCHLINT_API_RATE_LIMIT_WINDOW_MS";
  maxRequestsEnv: "SEARCHLINT_API_RATE_LIMIT_MAX_REQUESTS";
  failClosed: true;
};

export type CloudApiRateLimitIamStatementContract = {
  principal: CloudApiRateLimitIamPrincipal;
  actions: readonly CloudApiRateLimitIamAction[];
  resources: readonly CloudApiRateLimitIamResourceRef[];
};

export type CloudApiRateLimitProvisioningContract = {
  id: "searchlint-cloud-api-rate-limit-provisioning-v1";
  contractVersion: 1;
  store: CloudApiRateLimitStoreContract;
  runtime: CloudApiRateLimitRuntimeContract;
  environment: {
    variables: readonly CloudApiRateLimitEnvironmentVariable[];
  };
  iam: {
    statements: readonly CloudApiRateLimitIamStatementContract[];
  };
};

export type CloudApiRateLimitProvisioningValidationIssue = {
  path: string;
  message: string;
};

export const cloudApiRateLimitProvisioningContract: CloudApiRateLimitProvisioningContract =
  {
    id: "searchlint-cloud-api-rate-limit-provisioning-v1",
    contractVersion: 1,
    store: {
      provider: "aws-rds-postgresql",
      tableName: "rate_limit_windows",
      schemaVersion: "cloud.rate_limit_windows.v1",
      migrationRequired: true,
      algorithm: "fixed-window-insert-on-conflict",
      resetIndexName: "rate_limit_windows_reset_idx"
    },
    runtime: {
      packageName: "@searchlint/api",
      storeFactory: "createPostgresDistributedRateLimitStore",
      modeEnv: "SEARCHLINT_API_RATE_LIMIT_STORE",
      modeValue: "postgres",
      windowMsEnv: "SEARCHLINT_API_RATE_LIMIT_WINDOW_MS",
      maxRequestsEnv: "SEARCHLINT_API_RATE_LIMIT_MAX_REQUESTS",
      failClosed: true
    },
    environment: {
      variables: [
        {
          name: "SEARCHLINT_API_RATE_LIMIT_STORE",
          required: true,
          secretSource: "plain-env"
        },
        {
          name: "SEARCHLINT_API_RATE_LIMIT_WINDOW_MS",
          required: true,
          secretSource: "plain-env"
        },
        {
          name: "SEARCHLINT_API_RATE_LIMIT_MAX_REQUESTS",
          required: true,
          secretSource: "plain-env"
        },
        {
          name: "SEARCHLINT_POSTGRES_DATABASE_URL",
          required: true,
          secretSource: "aws-secrets-manager"
        },
        {
          name: "SEARCHLINT_POSTGRES_SSL_MODE",
          required: true,
          secretSource: "plain-env"
        }
      ]
    },
    iam: {
      statements: [
        {
          principal: "cloud-api-task",
          actions: ["secretsmanager:GetSecretValue", "kms:Decrypt"],
          resources: [
            "postgresDatabaseSecretArn",
            "postgresDatabaseSecretKmsKeyArn"
          ]
        }
      ]
    }
  };

export function validateCloudApiRateLimitProvisioningContract(
  contract: CloudApiRateLimitProvisioningContract
): CloudApiRateLimitProvisioningValidationIssue[] {
  const issues: CloudApiRateLimitProvisioningValidationIssue[] = [];

  expectEqual(
    issues,
    "id",
    contract.id,
    "searchlint-cloud-api-rate-limit-provisioning-v1"
  );
  expectEqual(issues, "contractVersion", contract.contractVersion, 1);
  validateStore(contract.store, issues);
  validateRuntime(contract.runtime, issues);
  validateEnvironment(contract.environment.variables, issues);
  validateIamStatements(contract.iam.statements, issues);

  return issues;
}

function validateStore(
  store: CloudApiRateLimitStoreContract,
  issues: CloudApiRateLimitProvisioningValidationIssue[]
): void {
  expectEqual(issues, "store.provider", store.provider, "aws-rds-postgresql");
  expectEqual(issues, "store.tableName", store.tableName, "rate_limit_windows");
  expectEqual(
    issues,
    "store.schemaVersion",
    store.schemaVersion,
    "cloud.rate_limit_windows.v1"
  );
  expectEqual(issues, "store.migrationRequired", store.migrationRequired, true);
  expectEqual(
    issues,
    "store.algorithm",
    store.algorithm,
    "fixed-window-insert-on-conflict"
  );
  expectEqual(
    issues,
    "store.resetIndexName",
    store.resetIndexName,
    "rate_limit_windows_reset_idx"
  );
}

function validateRuntime(
  runtime: CloudApiRateLimitRuntimeContract,
  issues: CloudApiRateLimitProvisioningValidationIssue[]
): void {
  expectEqual(
    issues,
    "runtime.packageName",
    runtime.packageName,
    "@searchlint/api"
  );
  expectEqual(
    issues,
    "runtime.storeFactory",
    runtime.storeFactory,
    "createPostgresDistributedRateLimitStore"
  );
  expectEqual(
    issues,
    "runtime.modeEnv",
    runtime.modeEnv,
    "SEARCHLINT_API_RATE_LIMIT_STORE"
  );
  expectEqual(issues, "runtime.modeValue", runtime.modeValue, "postgres");
  expectEqual(
    issues,
    "runtime.windowMsEnv",
    runtime.windowMsEnv,
    "SEARCHLINT_API_RATE_LIMIT_WINDOW_MS"
  );
  expectEqual(
    issues,
    "runtime.maxRequestsEnv",
    runtime.maxRequestsEnv,
    "SEARCHLINT_API_RATE_LIMIT_MAX_REQUESTS"
  );
  expectEqual(issues, "runtime.failClosed", runtime.failClosed, true);
}

function validateEnvironment(
  variables: readonly CloudApiRateLimitEnvironmentVariable[],
  issues: CloudApiRateLimitProvisioningValidationIssue[]
): void {
  const variableMap = new Map(
    variables.map((variable) => [variable.name, variable])
  );

  for (const [name, secretSource] of [
    ["SEARCHLINT_API_RATE_LIMIT_STORE", "plain-env"],
    ["SEARCHLINT_API_RATE_LIMIT_WINDOW_MS", "plain-env"],
    ["SEARCHLINT_API_RATE_LIMIT_MAX_REQUESTS", "plain-env"],
    ["SEARCHLINT_POSTGRES_DATABASE_URL", "aws-secrets-manager"],
    ["SEARCHLINT_POSTGRES_SSL_MODE", "plain-env"]
  ] as const) {
    const variable = variableMap.get(name);
    if (!variable) {
      issues.push({
        path: "environment.variables",
        message: `${name} is required for API distributed rate limiting.`
      });
      continue;
    }

    if (!variable.required) {
      issues.push({
        path: `environment.variables.${name}.required`,
        message: `${name} must be marked required.`
      });
    }

    if (variable.secretSource !== secretSource) {
      issues.push({
        path: `environment.variables.${name}.secretSource`,
        message: `${name} must use ${secretSource}.`
      });
    }
  }
}

function validateIamStatements(
  statements: readonly CloudApiRateLimitIamStatementContract[],
  issues: CloudApiRateLimitProvisioningValidationIssue[]
): void {
  const apiTaskStatement = statements.find(
    (statement) => statement.principal === "cloud-api-task"
  );

  if (!apiTaskStatement) {
    issues.push({
      path: "iam.statements",
      message: "cloud-api-task IAM statement is required."
    });
    return;
  }

  for (const action of [
    "secretsmanager:GetSecretValue",
    "kms:Decrypt"
  ] as const) {
    if (!apiTaskStatement.actions.includes(action)) {
      issues.push({
        path: "iam.statements.cloud-api-task.actions",
        message: `${action} is required for the API rate-limit store.`
      });
    }
  }

  for (const action of apiTaskStatement.actions) {
    if (
      action !== "secretsmanager:GetSecretValue" &&
      action !== "kms:Decrypt"
    ) {
      issues.push({
        path: "iam.statements.cloud-api-task.actions",
        message: `Unexpected API rate-limit IAM action ${String(action)}.`
      });
    }
  }

  for (const resource of [
    "postgresDatabaseSecretArn",
    "postgresDatabaseSecretKmsKeyArn"
  ] as const) {
    if (!apiTaskStatement.resources.includes(resource)) {
      issues.push({
        path: "iam.statements.cloud-api-task.resources",
        message: `${resource} is required for the API rate-limit store.`
      });
    }
  }

  for (const resource of apiTaskStatement.resources) {
    if (
      resource !== "postgresDatabaseSecretArn" &&
      resource !== "postgresDatabaseSecretKmsKeyArn"
    ) {
      issues.push({
        path: "iam.statements.cloud-api-task.resources",
        message: `Unexpected API rate-limit IAM resource ${String(resource)}.`
      });
    }
  }
}

function expectEqual(
  issues: CloudApiRateLimitProvisioningValidationIssue[],
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
