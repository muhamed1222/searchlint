import { randomUUID } from "node:crypto";

import { createCloudApi } from "./api.js";
import type { Clock, IdGenerator } from "./api.js";
import {
  createCognitoPrincipalExtractor,
  createRemoteJwksProvider
} from "./cognito-auth.js";
import {
  createExternalProviderOAuthAuthorizationUrlBuilder,
  type ExternalProviderOAuthAuthorizationConfig
} from "./external-provider-oauth-authorization.js";
import {
  createNodeHttpProductionLogSink,
  type NodeHttpProductionLogSinkOptions
} from "./production-log-sink.js";
import {
  createNodeHttpRuntime,
  installNodeHttpProcessExitPolicy,
  type NodeHttpPrincipalExtractor,
  type NodeHttpProcessExitPolicyBinding,
  type NodeHttpRuntime,
  type NodeHttpShutdownSignalTarget
} from "./node-http-server.js";
import { createOpenTelemetryOtlpExporterRuntime } from "./open-telemetry-otlp-runtime.js";
import {
  createOtlpExporterLifecycle,
  type OtlpExporterLifecycle,
  type OtlpExporterRuntime
} from "./otlp-exporter-lifecycle.js";
import {
  otlpRuntimeConfigFromEnv,
  type OtlpRuntimeConfig
} from "./otlp-runtime-config.js";
import type {
  DashboardSnapshotStore,
  DiagnosticStore,
  EntitlementStore,
  JobQueue,
  OAuthConnectionStore,
  StripeWebhookStore
} from "./ports.js";
import { createPostgresDashboardSnapshotStore } from "./postgres-dashboard-snapshot-store.js";
import { createPostgresDiagnosticStore } from "./postgres-diagnostic-store.js";
import { createPostgresEntitlementStore } from "./postgres-entitlement-store.js";
import { createPgPoolFromEnv, type PgPoolEnv } from "./postgres-env.js";
import { createPostgresOutboxStore } from "./postgres-outbox-store.js";
import { createPostgresOAuthConnectionStore } from "./postgres-oauth-connection-store.js";
import {
  createPostgresAuditLog,
  createPgCloudTransactionManager,
  createPgQueryExecutor,
  createPostgresMetricsStore,
  createPostgresUsageMeter
} from "./postgres-pg.js";
import { createPostgresDistributedRateLimitStore } from "./postgres-rate-limit-store.js";
import { createPostgresRelationalStore } from "./postgres-relational-store.js";
import { createPostgresStripeWebhookStore } from "./postgres-stripe-webhook-store.js";
import type { PgPool } from "./postgres-pg.js";
import type { PostgresQueryExecutor } from "./postgres-relational-store.js";

export type CloudApiProcessEnv = Readonly<Record<string, string | undefined>>;

export type CloudApiRateLimitStoreMode = "postgres";

export type CloudApiCognitoConfig = {
  issuer: string;
  audience: string;
  jwksUrl: string;
  tokenUse: "access";
};

export type CloudApiExternalProviderOAuthConfig = {
  google: ExternalProviderOAuthAuthorizationConfig;
  yandex: ExternalProviderOAuthAuthorizationConfig;
};

export type CloudApiProcessConfig = {
  postgresPrefix: "SEARCHLINT_POSTGRES";
  postgresDatabaseUrl: string;
  stripeWebhookSigningSecret: string;
  cognito: CloudApiCognitoConfig;
  externalProviderOAuth: CloudApiExternalProviderOAuthConfig;
  rateLimitStore: CloudApiRateLimitStoreMode;
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
  observability: OtlpRuntimeConfig;
  dispatchTimeoutMs?: number;
  maxBodyBytes?: number;
};

export type CloudApiProcessFactories = {
  createPgPool(env: PgPoolEnv): PgPool;
  createQueryExecutor(pool: PgPool): PostgresQueryExecutor;
  createEntitlementStore(executor: PostgresQueryExecutor): EntitlementStore;
  createDashboardSnapshotStore(
    executor: PostgresQueryExecutor
  ): DashboardSnapshotStore;
  createDiagnosticStore(executor: PostgresQueryExecutor): DiagnosticStore;
  createOAuthConnectionStore(
    executor: PostgresQueryExecutor
  ): OAuthConnectionStore;
  createStripeWebhookStore(
    executor: PostgresQueryExecutor,
    ids: IdGenerator,
    clock: Clock
  ): StripeWebhookStore;
  createJobQueue(): JobQueue;
  createObservabilityRuntime(): OtlpExporterRuntime;
  clock: Clock;
  ids: IdGenerator;
};

export type CloudApiProcessOptions = {
  env?: CloudApiProcessEnv;
  factories?: Partial<CloudApiProcessFactories>;
  extractPrincipal?: NodeHttpPrincipalExtractor;
  logSinkOptions?: NodeHttpProductionLogSinkOptions;
};

export type CloudApiProcessLifecycleOptions = {
  signalTarget?: NodeHttpShutdownSignalTarget;
  exitCodeSink?: (exitCode: number) => void;
};

export type CloudApiProcess = {
  config: CloudApiProcessConfig;
  observability: OtlpExporterLifecycle;
  runtime: NodeHttpRuntime;
  installLifecycle(
    options?: CloudApiProcessLifecycleOptions
  ): NodeHttpProcessExitPolicyBinding;
};

export function createCloudApiProcess(
  options: CloudApiProcessOptions = {}
): CloudApiProcess {
  const env = options.env ?? process.env;
  const config = cloudApiProcessConfigFromEnv(env);
  const extractPrincipal =
    options.extractPrincipal ?? createDefaultCognitoPrincipalExtractor(config);
  const factories = cloudApiProcessFactories(options.factories);
  const pool = factories.createPgPool(env);
  const executor = factories.createQueryExecutor(pool);
  const store = createPostgresRelationalStore(executor);
  const application = createCloudApi({
    store,
    queue: factories.createJobQueue(),
    entitlements: factories.createEntitlementStore(executor),
    dashboardSnapshots: factories.createDashboardSnapshotStore(executor),
    diagnostics: factories.createDiagnosticStore(executor),
    oauthConnections: factories.createOAuthConnectionStore(executor),
    externalProviderOAuthAuthorizationUrlBuilder:
      createExternalProviderOAuthAuthorizationUrlBuilder([
        config.externalProviderOAuth.google,
        config.externalProviderOAuth.yandex
      ]),
    auditLog: createPostgresAuditLog(executor),
    metrics: createPostgresMetricsStore(executor),
    usageMeter: createPostgresUsageMeter(executor),
    outbox: createPostgresOutboxStore(executor),
    transactionManager: createPgCloudTransactionManager({
      pool,
      outbox: true,
      oauthConnections: true
    }),
    clock: factories.clock,
    ids: factories.ids
  });
  const logger = createNodeHttpProductionLogSink(options.logSinkOptions);
  const stripeWebhookStore = factories.createStripeWebhookStore(
    executor,
    factories.ids,
    factories.clock
  );
  const runtime = createNodeHttpRuntime({
    application,
    extractPrincipal,
    logger,
    ...(config.dispatchTimeoutMs === undefined
      ? {}
      : { dispatchTimeoutMs: config.dispatchTimeoutMs }),
    ...(config.maxBodyBytes === undefined
      ? {}
      : { maxBodyBytes: config.maxBodyBytes }),
    stripeWebhook: {
      signingSecret: config.stripeWebhookSigningSecret,
      async onEvent(event) {
        await stripeWebhookStore.apply(event);
      }
    },
    rateLimit: {
      windowMs: config.rateLimitWindowMs,
      maxRequests: config.rateLimitMaxRequests,
      distributedStore: createPostgresDistributedRateLimitStore(executor)
    }
  });

  return {
    config,
    observability: createOtlpExporterLifecycle({
      config: config.observability,
      runtime: factories.createObservabilityRuntime()
    }),
    runtime,
    installLifecycle(lifecycleOptions = {}) {
      return installNodeHttpProcessExitPolicy(runtime, {
        ...(lifecycleOptions.signalTarget === undefined
          ? {}
          : { target: lifecycleOptions.signalTarget }),
        ...(lifecycleOptions.exitCodeSink === undefined
          ? {}
          : { exitCodeSink: lifecycleOptions.exitCodeSink })
      });
    }
  };
}

export function cloudApiProcessConfigFromEnv(
  env: CloudApiProcessEnv
): CloudApiProcessConfig {
  const rateLimitStore = requiredEnv(env, "SEARCHLINT_API_RATE_LIMIT_STORE");
  if (rateLimitStore !== "postgres") {
    throw new Error("SEARCHLINT_API_RATE_LIMIT_STORE must be postgres.");
  }

  return {
    postgresPrefix: "SEARCHLINT_POSTGRES",
    postgresDatabaseUrl: requiredEnv(env, "SEARCHLINT_POSTGRES_DATABASE_URL"),
    stripeWebhookSigningSecret: requiredEnv(
      env,
      "SEARCHLINT_STRIPE_WEBHOOK_SECRET"
    ),
    cognito: cognitoConfigFromEnv(env),
    externalProviderOAuth: externalProviderOAuthConfigFromEnv(env),
    rateLimitStore,
    rateLimitWindowMs: requiredPositiveInteger(
      env,
      "SEARCHLINT_API_RATE_LIMIT_WINDOW_MS"
    ),
    rateLimitMaxRequests: requiredPositiveInteger(
      env,
      "SEARCHLINT_API_RATE_LIMIT_MAX_REQUESTS"
    ),
    observability: otlpRuntimeConfigFromEnv(env),
    ...optionalPositiveIntegerProperty(
      env,
      "SEARCHLINT_API_DISPATCH_TIMEOUT_MS",
      "dispatchTimeoutMs"
    ),
    ...optionalPositiveIntegerProperty(
      env,
      "SEARCHLINT_API_MAX_BODY_BYTES",
      "maxBodyBytes"
    )
  };
}

function createDefaultCognitoPrincipalExtractor(
  config: CloudApiProcessConfig
): NodeHttpPrincipalExtractor {
  return createCognitoPrincipalExtractor({
    issuer: config.cognito.issuer,
    audience: config.cognito.audience,
    tokenUse: config.cognito.tokenUse,
    jwks: createRemoteJwksProvider({
      jwksUrl: config.cognito.jwksUrl
    })
  });
}

function cognitoConfigFromEnv(env: CloudApiProcessEnv): CloudApiCognitoConfig {
  const tokenUse = requiredEnv(env, "SEARCHLINT_COGNITO_TOKEN_USE");
  if (tokenUse !== "access") {
    throw new Error("SEARCHLINT_COGNITO_TOKEN_USE must be access.");
  }

  return {
    issuer: requiredEnv(env, "SEARCHLINT_COGNITO_ISSUER"),
    audience: requiredEnv(env, "SEARCHLINT_COGNITO_AUDIENCE"),
    jwksUrl: requiredEnv(env, "SEARCHLINT_COGNITO_JWKS_URL"),
    tokenUse
  };
}

function externalProviderOAuthConfigFromEnv(
  env: CloudApiProcessEnv
): CloudApiExternalProviderOAuthConfig {
  return {
    google: externalProviderConfigFromEnv(env, "GOOGLE", "google"),
    yandex: externalProviderConfigFromEnv(env, "YANDEX", "yandex")
  };
}

function externalProviderConfigFromEnv(
  env: CloudApiProcessEnv,
  envProvider: "GOOGLE" | "YANDEX",
  provider: "google" | "yandex"
): ExternalProviderOAuthAuthorizationConfig {
  return {
    provider,
    clientId: requiredEnv(env, `SEARCHLINT_${envProvider}_OAUTH_CLIENT_ID`),
    authorizationEndpoint: requiredHttpsEnv(
      env,
      `SEARCHLINT_${envProvider}_OAUTH_AUTHORIZATION_ENDPOINT`
    ),
    redirectUri: requiredHttpsEnv(
      env,
      `SEARCHLINT_${envProvider}_OAUTH_REDIRECT_URI`
    ),
    scopes: requiredStringListEnv(
      env,
      `SEARCHLINT_${envProvider}_OAUTH_SCOPES`
    ),
    ...optionalBooleanProperty(
      env,
      `SEARCHLINT_${envProvider}_OAUTH_PKCE_REQUIRED`,
      "pkceRequired"
    )
  };
}

function cloudApiProcessFactories(
  overrides: Partial<CloudApiProcessFactories> = {}
): CloudApiProcessFactories {
  return {
    createPgPool:
      overrides.createPgPool ??
      ((env) =>
        createPgPoolFromEnv(env, {
          prefix: "SEARCHLINT_POSTGRES"
        })),
    createQueryExecutor:
      overrides.createQueryExecutor ?? ((pool) => createPgQueryExecutor(pool)),
    createEntitlementStore:
      overrides.createEntitlementStore ??
      ((executor) => createPostgresEntitlementStore(executor)),
    createDashboardSnapshotStore:
      overrides.createDashboardSnapshotStore ??
      ((executor) => createPostgresDashboardSnapshotStore(executor)),
    createDiagnosticStore:
      overrides.createDiagnosticStore ??
      ((executor) => createPostgresDiagnosticStore(executor)),
    createOAuthConnectionStore:
      overrides.createOAuthConnectionStore ??
      ((executor) => createPostgresOAuthConnectionStore(executor)),
    createStripeWebhookStore:
      overrides.createStripeWebhookStore ??
      ((executor, ids, clock) =>
        createPostgresStripeWebhookStore({
          executor,
          ids,
          clock
        })),
    createJobQueue: overrides.createJobQueue ?? createOutboxOnlyJobQueue,
    createObservabilityRuntime:
      overrides.createObservabilityRuntime ??
      createOpenTelemetryOtlpExporterRuntime,
    clock:
      overrides.clock ??
      ({
        now() {
          return new Date().toISOString();
        }
      } satisfies Clock),
    ids:
      overrides.ids ??
      ({
        nextId(prefix) {
          return `${prefix}_${randomUUID()}`;
        }
      } satisfies IdGenerator)
  };
}

function createOutboxOnlyJobQueue(): JobQueue {
  return {
    async enqueueCrawl() {
      throw new Error("Direct crawl queue is disabled; use the outbox store.");
    }
  };
}

function requiredEnv(env: CloudApiProcessEnv, name: string): string {
  const value = optionalEnv(env, name);
  if (value === undefined) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function optionalEnv(
  env: CloudApiProcessEnv,
  name: string
): string | undefined {
  const value = env[name]?.trim();
  return value && value.length > 0 ? value : undefined;
}

function requiredPositiveInteger(
  env: CloudApiProcessEnv,
  name: string
): number {
  const value = requiredEnv(env, name);
  return positiveInteger(name, value);
}

function requiredHttpsEnv(env: CloudApiProcessEnv, name: string): string {
  const value = requiredEnv(env, name);
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") {
      throw new Error("not https");
    }
    return url.toString();
  } catch {
    throw new Error(`${name} must be an https URL.`);
  }
}

function requiredStringListEnv(
  env: CloudApiProcessEnv,
  name: string
): readonly string[] {
  const value = requiredEnv(env, name);
  const entries = value
    .split(/[\s,]+/u)
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (entries.length === 0) {
    throw new Error(`${name} must include at least one value.`);
  }
  return [...new Set(entries)].sort();
}

function optionalBooleanProperty<Name extends "pkceRequired">(
  env: CloudApiProcessEnv,
  envName: string,
  propertyName: Name
): Partial<Record<Name, boolean>> {
  const value = optionalEnv(env, envName);
  if (value === undefined) {
    return {};
  }
  if (value !== "true" && value !== "false") {
    throw new Error(`${envName} must be true or false.`);
  }
  return {
    [propertyName]: value === "true"
  } as Partial<Record<Name, boolean>>;
}

function optionalPositiveIntegerProperty<
  Name extends "dispatchTimeoutMs" | "maxBodyBytes"
>(
  env: CloudApiProcessEnv,
  envName: string,
  propertyName: Name
): Partial<Record<Name, number>> {
  const value = optionalEnv(env, envName);
  if (value === undefined) {
    return {};
  }
  return {
    [propertyName]: positiveInteger(envName, value)
  } as Partial<Record<Name, number>>;
}

function positiveInteger(name: string, value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsed;
}
