import { cloudHttpRouteContracts } from "./http-contracts.js";
import type { CloudHttpRouteContract } from "./http-contracts.js";
import { cloudApiRateLimitProvisioningContract } from "./rate-limit-provisioning-contracts.js";

export type CloudApiIngressKind = "aws-api-gateway-http-api";
export type CloudApiComputeKind = "aws-ecs-fargate";
export type CloudApiServerAdapter = "node:http";
export type CloudApiSecretSource = "aws-secrets-manager" | "plain-env";
export type CloudApiLogSink = "aws-cloudwatch";

export type CloudApiDeploymentRateLimit = {
  store: "postgres";
  distributedStoreFactory: "createPostgresDistributedRateLimitStore";
  modeEnv: "SEARCHLINT_API_RATE_LIMIT_STORE";
  windowMsEnv: "SEARCHLINT_API_RATE_LIMIT_WINDOW_MS";
  maxRequestsEnv: "SEARCHLINT_API_RATE_LIMIT_MAX_REQUESTS";
  failClosed: true;
};

export type CloudApiDeploymentRoute = Pick<
  CloudHttpRouteContract,
  | "operation"
  | "method"
  | "path"
  | "apiVersion"
  | "stability"
  | "requestSchemaVersion"
  | "responseSchemaVersion"
>;

export type CloudApiDeploymentEnvironmentVariable = {
  name: string;
  required: boolean;
  secretSource?: CloudApiSecretSource;
};

export type CloudApiDeploymentContract = {
  id: "searchlint-cloud-api-ecs-fargate-v1";
  contractVersion: 1;
  ingress: {
    kind: CloudApiIngressKind;
    apiVersion: "v1";
    requestIdHeader: "x-request-id";
    routes: readonly CloudApiDeploymentRoute[];
  };
  runtime: {
    compute: CloudApiComputeKind;
    nodeMajor: 24;
    serverAdapter: CloudApiServerAdapter;
    containerPort: number;
    healthCheckPath: "/healthz";
    shutdownSignals: readonly ["SIGTERM", "SIGINT"];
    shutdownGracePeriodMs: number;
    maxBodyBytes: number;
    dispatchTimeoutMs: number;
  };
  observability: {
    structuredRequestLogs: true;
    logSink: CloudApiLogSink;
    requestIdField: "requestId";
  };
  rateLimit: CloudApiDeploymentRateLimit;
  environment: {
    postgresEnvPrefix: "SEARCHLINT_POSTGRES";
    variables: readonly CloudApiDeploymentEnvironmentVariable[];
  };
};

export type CloudApiDeploymentValidationIssue = {
  path: string;
  message: string;
};

export const cloudApiDeploymentContract: CloudApiDeploymentContract = {
  id: "searchlint-cloud-api-ecs-fargate-v1",
  contractVersion: 1,
  ingress: {
    kind: "aws-api-gateway-http-api",
    apiVersion: "v1",
    requestIdHeader: "x-request-id",
    routes: cloudHttpRouteContracts.map(deploymentRoute)
  },
  runtime: {
    compute: "aws-ecs-fargate",
    nodeMajor: 24,
    serverAdapter: "node:http",
    containerPort: 3000,
    healthCheckPath: "/healthz",
    shutdownSignals: ["SIGTERM", "SIGINT"],
    shutdownGracePeriodMs: 5000,
    maxBodyBytes: 1024 * 1024,
    dispatchTimeoutMs: 30_000
  },
  observability: {
    structuredRequestLogs: true,
    logSink: "aws-cloudwatch",
    requestIdField: "requestId"
  },
  rateLimit: {
    store: "postgres",
    distributedStoreFactory:
      cloudApiRateLimitProvisioningContract.runtime.storeFactory,
    modeEnv: cloudApiRateLimitProvisioningContract.runtime.modeEnv,
    windowMsEnv: cloudApiRateLimitProvisioningContract.runtime.windowMsEnv,
    maxRequestsEnv:
      cloudApiRateLimitProvisioningContract.runtime.maxRequestsEnv,
    failClosed: cloudApiRateLimitProvisioningContract.runtime.failClosed
  },
  environment: {
    postgresEnvPrefix: "SEARCHLINT_POSTGRES",
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
        name: "SEARCHLINT_POSTGRES_POOL_MAX",
        required: false,
        secretSource: "plain-env"
      },
      {
        name: "SEARCHLINT_POSTGRES_CONNECTION_TIMEOUT_MS",
        required: false,
        secretSource: "plain-env"
      },
      {
        name: "SEARCHLINT_POSTGRES_IDLE_TIMEOUT_MS",
        required: false,
        secretSource: "plain-env"
      },
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
        name: "SEARCHLINT_STRIPE_WEBHOOK_SECRET",
        required: true,
        secretSource: "aws-secrets-manager"
      },
      {
        name: "SEARCHLINT_COGNITO_ISSUER",
        required: true,
        secretSource: "plain-env"
      },
      {
        name: "SEARCHLINT_COGNITO_AUDIENCE",
        required: true,
        secretSource: "plain-env"
      },
      {
        name: "SEARCHLINT_COGNITO_JWKS_URL",
        required: true,
        secretSource: "plain-env"
      },
      {
        name: "SEARCHLINT_COGNITO_TOKEN_USE",
        required: true,
        secretSource: "plain-env"
      },
      {
        name: "SEARCHLINT_GOOGLE_OAUTH_CLIENT_ID",
        required: true,
        secretSource: "plain-env"
      },
      {
        name: "SEARCHLINT_GOOGLE_OAUTH_AUTHORIZATION_ENDPOINT",
        required: true,
        secretSource: "plain-env"
      },
      {
        name: "SEARCHLINT_GOOGLE_OAUTH_REDIRECT_URI",
        required: true,
        secretSource: "plain-env"
      },
      {
        name: "SEARCHLINT_GOOGLE_OAUTH_SCOPES",
        required: true,
        secretSource: "plain-env"
      },
      {
        name: "SEARCHLINT_GOOGLE_OAUTH_PKCE_REQUIRED",
        required: false,
        secretSource: "plain-env"
      },
      {
        name: "SEARCHLINT_YANDEX_OAUTH_CLIENT_ID",
        required: true,
        secretSource: "plain-env"
      },
      {
        name: "SEARCHLINT_YANDEX_OAUTH_AUTHORIZATION_ENDPOINT",
        required: true,
        secretSource: "plain-env"
      },
      {
        name: "SEARCHLINT_YANDEX_OAUTH_REDIRECT_URI",
        required: true,
        secretSource: "plain-env"
      },
      {
        name: "SEARCHLINT_YANDEX_OAUTH_SCOPES",
        required: true,
        secretSource: "plain-env"
      }
    ]
  }
};

export function validateCloudApiDeploymentContract(
  contract: CloudApiDeploymentContract
): CloudApiDeploymentValidationIssue[] {
  const issues: CloudApiDeploymentValidationIssue[] = [];

  expectEqual(issues, "id", contract.id, "searchlint-cloud-api-ecs-fargate-v1");
  expectEqual(issues, "contractVersion", contract.contractVersion, 1);
  expectEqual(
    issues,
    "ingress.kind",
    contract.ingress.kind,
    "aws-api-gateway-http-api"
  );
  expectEqual(issues, "ingress.apiVersion", contract.ingress.apiVersion, "v1");
  expectEqual(
    issues,
    "ingress.requestIdHeader",
    contract.ingress.requestIdHeader,
    "x-request-id"
  );
  expectEqual(
    issues,
    "runtime.compute",
    contract.runtime.compute,
    "aws-ecs-fargate"
  );
  expectEqual(issues, "runtime.nodeMajor", contract.runtime.nodeMajor, 24);
  expectEqual(
    issues,
    "runtime.serverAdapter",
    contract.runtime.serverAdapter,
    "node:http"
  );
  expectEqual(
    issues,
    "runtime.healthCheckPath",
    contract.runtime.healthCheckPath,
    "/healthz"
  );
  expectEqual(
    issues,
    "observability.structuredRequestLogs",
    contract.observability.structuredRequestLogs,
    true
  );
  expectEqual(
    issues,
    "observability.logSink",
    contract.observability.logSink,
    "aws-cloudwatch"
  );
  expectEqual(
    issues,
    "observability.requestIdField",
    contract.observability.requestIdField,
    "requestId"
  );
  validateRateLimit(contract, issues);
  expectEqual(
    issues,
    "environment.postgresEnvPrefix",
    contract.environment.postgresEnvPrefix,
    "SEARCHLINT_POSTGRES"
  );

  if (
    !Number.isInteger(contract.runtime.containerPort) ||
    contract.runtime.containerPort < 1 ||
    contract.runtime.containerPort > 65535
  ) {
    issues.push({
      path: "runtime.containerPort",
      message: "Container port must be an integer between 1 and 65535."
    });
  }

  if (
    !Number.isInteger(contract.runtime.shutdownGracePeriodMs) ||
    contract.runtime.shutdownGracePeriodMs < 1
  ) {
    issues.push({
      path: "runtime.shutdownGracePeriodMs",
      message: "Shutdown grace period must be a positive integer."
    });
  }

  if (
    !Number.isInteger(contract.runtime.maxBodyBytes) ||
    contract.runtime.maxBodyBytes < 1
  ) {
    issues.push({
      path: "runtime.maxBodyBytes",
      message: "Maximum body size must be a positive integer."
    });
  }

  if (
    !Number.isInteger(contract.runtime.dispatchTimeoutMs) ||
    contract.runtime.dispatchTimeoutMs < 1
  ) {
    issues.push({
      path: "runtime.dispatchTimeoutMs",
      message: "Dispatch timeout must be a positive integer."
    });
  }

  for (const signal of ["SIGTERM", "SIGINT"] as const) {
    if (!contract.runtime.shutdownSignals.includes(signal)) {
      issues.push({
        path: "runtime.shutdownSignals",
        message: `${signal} shutdown handling is required.`
      });
    }
  }

  validateRoutes(contract, issues);
  validateEnvironment(contract, issues);

  return issues;
}

function validateRateLimit(
  contract: CloudApiDeploymentContract,
  issues: CloudApiDeploymentValidationIssue[]
): void {
  expectEqual(issues, "rateLimit.store", contract.rateLimit.store, "postgres");
  expectEqual(
    issues,
    "rateLimit.distributedStoreFactory",
    contract.rateLimit.distributedStoreFactory,
    "createPostgresDistributedRateLimitStore"
  );
  expectEqual(
    issues,
    "rateLimit.modeEnv",
    contract.rateLimit.modeEnv,
    "SEARCHLINT_API_RATE_LIMIT_STORE"
  );
  expectEqual(
    issues,
    "rateLimit.windowMsEnv",
    contract.rateLimit.windowMsEnv,
    "SEARCHLINT_API_RATE_LIMIT_WINDOW_MS"
  );
  expectEqual(
    issues,
    "rateLimit.maxRequestsEnv",
    contract.rateLimit.maxRequestsEnv,
    "SEARCHLINT_API_RATE_LIMIT_MAX_REQUESTS"
  );
  expectEqual(
    issues,
    "rateLimit.failClosed",
    contract.rateLimit.failClosed,
    true
  );
}

function deploymentRoute(
  contract: CloudHttpRouteContract
): CloudApiDeploymentRoute {
  return {
    operation: contract.operation,
    method: contract.method,
    path: contract.path,
    apiVersion: contract.apiVersion,
    stability: contract.stability,
    requestSchemaVersion: contract.requestSchemaVersion,
    responseSchemaVersion: contract.responseSchemaVersion
  };
}

function validateRoutes(
  contract: CloudApiDeploymentContract,
  issues: CloudApiDeploymentValidationIssue[]
): void {
  const expected = new Map(
    cloudHttpRouteContracts.map((route) => [
      route.operation,
      deploymentRoute(route)
    ])
  );
  const actual = new Map(
    contract.ingress.routes.map((route) => [route.operation, route])
  );

  for (const [operation, route] of expected) {
    const deployed = actual.get(operation);
    if (!deployed) {
      issues.push({
        path: "ingress.routes",
        message: `Missing deployment route for ${operation}.`
      });
      continue;
    }

    for (const key of [
      "method",
      "path",
      "apiVersion",
      "stability",
      "requestSchemaVersion",
      "responseSchemaVersion"
    ] as const) {
      if (deployed[key] !== route[key]) {
        issues.push({
          path: `ingress.routes.${operation}.${key}`,
          message: `Route ${operation} ${key} must match cloud HTTP route contracts.`
        });
      }
    }
  }

  for (const operation of actual.keys()) {
    if (!expected.has(operation)) {
      issues.push({
        path: "ingress.routes",
        message: `Unexpected deployment route for ${operation}.`
      });
    }
  }
}

function validateEnvironment(
  contract: CloudApiDeploymentContract,
  issues: CloudApiDeploymentValidationIssue[]
): void {
  const variables = new Map(
    contract.environment.variables.map((variable) => [variable.name, variable])
  );

  for (const name of [
    "SEARCHLINT_POSTGRES_DATABASE_URL",
    "SEARCHLINT_POSTGRES_SSL_MODE",
    "SEARCHLINT_API_RATE_LIMIT_STORE",
    "SEARCHLINT_API_RATE_LIMIT_WINDOW_MS",
    "SEARCHLINT_API_RATE_LIMIT_MAX_REQUESTS",
    "SEARCHLINT_STRIPE_WEBHOOK_SECRET",
    "SEARCHLINT_COGNITO_ISSUER",
    "SEARCHLINT_COGNITO_AUDIENCE",
    "SEARCHLINT_COGNITO_JWKS_URL",
    "SEARCHLINT_COGNITO_TOKEN_USE",
    "SEARCHLINT_GOOGLE_OAUTH_CLIENT_ID",
    "SEARCHLINT_GOOGLE_OAUTH_AUTHORIZATION_ENDPOINT",
    "SEARCHLINT_GOOGLE_OAUTH_REDIRECT_URI",
    "SEARCHLINT_GOOGLE_OAUTH_SCOPES",
    "SEARCHLINT_YANDEX_OAUTH_CLIENT_ID",
    "SEARCHLINT_YANDEX_OAUTH_AUTHORIZATION_ENDPOINT",
    "SEARCHLINT_YANDEX_OAUTH_REDIRECT_URI",
    "SEARCHLINT_YANDEX_OAUTH_SCOPES"
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

  const stripeWebhookSecret = variables.get("SEARCHLINT_STRIPE_WEBHOOK_SECRET");
  if (stripeWebhookSecret?.secretSource !== "aws-secrets-manager") {
    issues.push({
      path: "environment.variables.SEARCHLINT_STRIPE_WEBHOOK_SECRET.secretSource",
      message: "Stripe webhook secret must come from AWS Secrets Manager."
    });
  }

  for (const name of [
    "SEARCHLINT_API_RATE_LIMIT_STORE",
    "SEARCHLINT_API_RATE_LIMIT_WINDOW_MS",
    "SEARCHLINT_API_RATE_LIMIT_MAX_REQUESTS",
    "SEARCHLINT_COGNITO_ISSUER",
    "SEARCHLINT_COGNITO_AUDIENCE",
    "SEARCHLINT_COGNITO_JWKS_URL",
    "SEARCHLINT_COGNITO_TOKEN_USE",
    "SEARCHLINT_GOOGLE_OAUTH_CLIENT_ID",
    "SEARCHLINT_GOOGLE_OAUTH_AUTHORIZATION_ENDPOINT",
    "SEARCHLINT_GOOGLE_OAUTH_REDIRECT_URI",
    "SEARCHLINT_GOOGLE_OAUTH_SCOPES",
    "SEARCHLINT_GOOGLE_OAUTH_PKCE_REQUIRED",
    "SEARCHLINT_YANDEX_OAUTH_CLIENT_ID",
    "SEARCHLINT_YANDEX_OAUTH_AUTHORIZATION_ENDPOINT",
    "SEARCHLINT_YANDEX_OAUTH_REDIRECT_URI",
    "SEARCHLINT_YANDEX_OAUTH_SCOPES"
  ]) {
    const variable = variables.get(name);
    if (variable?.secretSource !== "plain-env") {
      issues.push({
        path: `environment.variables.${name}.secretSource`,
        message: `${name} must come from plain environment configuration.`
      });
    }
  }
}

function expectEqual(
  issues: CloudApiDeploymentValidationIssue[],
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
