import { SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import {
  createOpenTelemetryOtlpExporterRuntime,
  createOtlpExporterLifecycle,
  createPgPoolFromEnv,
  createPgQueryExecutor,
  createPostgresExternalObservationStore,
  createPostgresOAuthConnectionStore,
  otlpRuntimeConfigFromEnv
} from "@searchlint/api";
import type {
  ExternalObservationProvider,
  ExternalObservationStore,
  GoogleProviderFetch,
  OAuthConnectionStore,
  OtlpExporterLifecycle,
  OtlpExporterRuntime,
  OtlpRuntimeConfig,
  PgPool,
  PostgresQueryExecutor,
  YandexProviderFetch
} from "@searchlint/api";

import {
  createOutboxWorkerProductionLogSink,
  type OutboxWorkerProductionLogSink
} from "./production-log-sink.js";
import {
  createExternalObservationCollectionPollingRuntime,
  type ExternalObservationAccessTokenVault,
  type ExternalObservationCollectionClock,
  type ExternalObservationCollectionPollingRuntime,
  type ExternalObservationCollectionPollingRuntimeSleep,
  type ExternalObservationProviderCollectors
} from "./external-observation-collection-worker.js";
import {
  createOutboxWorkerRuntime,
  installOutboxWorkerProcessExitPolicy,
  type OutboxWorkerProcessExitPolicyBinding,
  type OutboxWorkerRuntime,
  type OutboxWorkerShutdownSignalTarget
} from "./worker-lifecycle.js";
import {
  createSecretsManagerExternalObservationAccessTokenVault,
  type SecretsManagerGetSecretValueClient
} from "./secrets-manager-external-observation-vault.js";
import {
  createConfiguredExternalObservationTargetResolver,
  createExternalObservationProviderCollectors,
  type ExternalObservationProviderTargetConfig
} from "./external-observation-provider-collectors.js";
import {
  createGoogleOAuthTokenRefresher,
  createYandexOAuthTokenRefresher,
  type ExternalObservationOAuthRefreshFetch,
  type ExternalObservationOAuthTokenRefreshers,
  type OAuthRefreshClientCredentials
} from "./external-observation-oauth-refresh.js";

export type ExternalObservationCollectionProcessEnv = Readonly<
  Record<string, string | undefined>
>;

export type ExternalObservationCollectionProcessConfig = {
  postgresPrefix: "SEARCHLINT_POSTGRES";
  postgresDatabaseUrl: string;
  provider?: ExternalObservationProvider;
  pollIntervalMs: number;
  batchSize: number;
  maxBatches?: number;
  oauthSecretNamePrefix?: string;
  targets: ExternalObservationProviderTargetConfig;
  oauthRefresh?: ExternalObservationCollectionOAuthRefreshConfig;
  stopOnError: false;
  observability: OtlpRuntimeConfig;
};

export type ExternalObservationCollectionOAuthRefreshProviderConfig =
  OAuthRefreshClientCredentials & {
    tokenEndpoint?: string;
  };

export type ExternalObservationCollectionOAuthRefreshConfig = {
  google?: ExternalObservationCollectionOAuthRefreshProviderConfig;
  yandex?: ExternalObservationCollectionOAuthRefreshProviderConfig;
};

export type ExternalObservationCollectionProcessFactories = {
  createPgPool(env: ExternalObservationCollectionProcessEnv): PgPool;
  createQueryExecutor(pool: PgPool): PostgresQueryExecutor;
  createOAuthConnectionStore(
    executor: PostgresQueryExecutor
  ): OAuthConnectionStore;
  createExternalObservationStore(
    executor: PostgresQueryExecutor
  ): ExternalObservationStore;
  createSecretsManagerClient(): SecretsManagerGetSecretValueClient;
  createVault(
    config: ExternalObservationCollectionProcessConfig
  ): ExternalObservationAccessTokenVault;
  createProviderFetch(): GoogleProviderFetch & YandexProviderFetch;
  createCollectors(
    config: ExternalObservationCollectionProcessConfig
  ): ExternalObservationProviderCollectors;
  createTokenRefreshers(
    config: ExternalObservationCollectionProcessConfig
  ): ExternalObservationOAuthTokenRefreshers | undefined;
  createObservabilityRuntime(): OtlpExporterRuntime;
};

export type ExternalObservationCollectionProcessOptions = {
  env?: ExternalObservationCollectionProcessEnv;
  factories?: Partial<ExternalObservationCollectionProcessFactories>;
  logSink?: OutboxWorkerProductionLogSink;
  sleep?: ExternalObservationCollectionPollingRuntimeSleep;
  clock?: ExternalObservationCollectionClock;
};

export type ExternalObservationCollectionProcessLifecycleOptions = {
  signalTarget?: OutboxWorkerShutdownSignalTarget;
  exitCodeSink?: (exitCode: number) => void;
};

export type ExternalObservationCollectionProcess = {
  config: ExternalObservationCollectionProcessConfig;
  observability: OtlpExporterLifecycle;
  runtime: OutboxWorkerRuntime;
  pollingRuntime: ExternalObservationCollectionPollingRuntime;
  installLifecycle(
    options?: ExternalObservationCollectionProcessLifecycleOptions
  ): OutboxWorkerProcessExitPolicyBinding;
};

const defaultPollIntervalMs = 60_000;
const defaultBatchSize = 25;
const workerKind = "external-observation-collector";

export function createExternalObservationCollectionProcess(
  options: ExternalObservationCollectionProcessOptions = {}
): ExternalObservationCollectionProcess {
  const env = options.env ?? process.env;
  const config = externalObservationCollectionProcessConfigFromEnv(env);
  const factories = processFactories(options.factories);
  const pool = factories.createPgPool(env);
  const executor = factories.createQueryExecutor(pool);
  const oauthConnections = factories.createOAuthConnectionStore(executor);
  const externalObservations =
    factories.createExternalObservationStore(executor);
  const tokenRefreshers = factories.createTokenRefreshers(config);
  const logSink =
    options.logSink ??
    createOutboxWorkerProductionLogSink({
      workerKind
    });
  const pollingRuntime = createExternalObservationCollectionPollingRuntime({
    oauthConnections,
    externalObservations,
    vault: factories.createVault(config),
    collectors: factories.createCollectors(config),
    ...(tokenRefreshers === undefined ? {} : { tokenRefreshers }),
    clock:
      options.clock ??
      ({
        now() {
          return new Date().toISOString();
        }
      } satisfies ExternalObservationCollectionClock),
    limit: config.batchSize,
    intervalMs: config.pollIntervalMs,
    ...(config.maxBatches === undefined
      ? {}
      : { maxBatches: config.maxBatches }),
    ...(config.provider === undefined ? {} : { provider: config.provider }),
    ...(options.sleep === undefined ? {} : { sleep: options.sleep }),
    stopOnError: config.stopOnError,
    onBatch(result) {
      return logSink.write({
        kind: "external-observation-batch",
        result
      });
    },
    onError(error) {
      return logSink.write({
        kind: "error",
        error,
        phase: "external-observation-poll"
      });
    }
  });
  const runtime = createOutboxWorkerRuntime(pollingRuntime);

  return {
    config,
    observability: createOtlpExporterLifecycle({
      config: config.observability,
      runtime: factories.createObservabilityRuntime()
    }),
    runtime,
    pollingRuntime,
    installLifecycle(lifecycleOptions = {}) {
      return installOutboxWorkerProcessExitPolicy(runtime, {
        ...(lifecycleOptions.signalTarget === undefined
          ? {}
          : { target: lifecycleOptions.signalTarget }),
        ...(lifecycleOptions.exitCodeSink === undefined
          ? {}
          : { exitCodeSink: lifecycleOptions.exitCodeSink }),
        onStateChange(event) {
          return logSink.write({
            kind: "lifecycle",
            event
          });
        }
      });
    }
  };
}

export function externalObservationCollectionProcessConfigFromEnv(
  env: ExternalObservationCollectionProcessEnv
): ExternalObservationCollectionProcessConfig {
  const provider = optionalProvider(
    env,
    "SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_PROVIDER"
  );
  return {
    postgresPrefix: "SEARCHLINT_POSTGRES",
    postgresDatabaseUrl: requiredEnv(env, "SEARCHLINT_POSTGRES_DATABASE_URL"),
    ...(provider === undefined ? {} : { provider }),
    pollIntervalMs: optionalPositiveInteger(
      env,
      "SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_POLL_INTERVAL_MS",
      defaultPollIntervalMs
    ),
    batchSize: optionalBoundedInteger(
      env,
      "SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_BATCH_SIZE",
      defaultBatchSize,
      1,
      100
    ),
    ...optionalMaxBatches(env),
    ...optionalSecretNamePrefix(
      env,
      "SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_SECRET_NAME_PREFIX"
    ),
    targets: externalObservationTargetConfigFromEnv(env),
    ...optionalOAuthRefreshConfig(env),
    stopOnError: false,
    observability: otlpRuntimeConfigFromEnv(env)
  };
}

function processFactories(
  overrides: Partial<ExternalObservationCollectionProcessFactories> = {}
): ExternalObservationCollectionProcessFactories {
  const createSecretsManagerClient =
    overrides.createSecretsManagerClient ??
    (() => new SecretsManagerClient({}));
  const createProviderFetch =
    overrides.createProviderFetch ?? (() => nativeProviderFetch);

  return {
    createPgPool:
      overrides.createPgPool ??
      ((env) =>
        createPgPoolFromEnv(env, {
          prefix: "SEARCHLINT_POSTGRES"
        })),
    createQueryExecutor:
      overrides.createQueryExecutor ?? ((pool) => createPgQueryExecutor(pool)),
    createOAuthConnectionStore:
      overrides.createOAuthConnectionStore ??
      ((executor) => createPostgresOAuthConnectionStore(executor)),
    createExternalObservationStore:
      overrides.createExternalObservationStore ??
      ((executor) => createPostgresExternalObservationStore(executor)),
    createSecretsManagerClient: createSecretsManagerClient,
    createVault:
      overrides.createVault ??
      ((config) =>
        createSecretsManagerExternalObservationAccessTokenVault({
          client: createSecretsManagerClient(),
          ...(config.oauthSecretNamePrefix === undefined
            ? {}
            : { secretNamePrefix: config.oauthSecretNamePrefix })
        })),
    createProviderFetch,
    createCollectors:
      overrides.createCollectors ??
      ((config) =>
        createExternalObservationProviderCollectors({
          fetch: createProviderFetch(),
          targetResolver: createConfiguredExternalObservationTargetResolver(
            config.targets
          )
        })),
    createTokenRefreshers:
      overrides.createTokenRefreshers ??
      ((config) =>
        config.oauthRefresh === undefined
          ? undefined
          : defaultTokenRefreshers(config, createProviderFetch())),
    createObservabilityRuntime:
      overrides.createObservabilityRuntime ??
      createOpenTelemetryOtlpExporterRuntime
  };
}

function externalObservationTargetConfigFromEnv(
  env: ExternalObservationCollectionProcessEnv
): ExternalObservationProviderTargetConfig {
  const subjectUrls = optionalStringList(
    env,
    "SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_SUBJECT_URLS"
  );
  const sitemapUrls = optionalStringList(
    env,
    "SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_SITEMAP_URLS"
  );
  const discovery = optionalTargetDiscoveryConfig(env);
  return {
    ...(subjectUrls.length === 0 ? {} : { subjectUrls }),
    ...(sitemapUrls.length === 0 ? {} : { sitemapUrls }),
    ...(discovery === undefined ? {} : { discovery }),
    ...optionalGoogleSearchAnalyticsTargetConfig(env),
    ...optionalGooglePageSpeedTargetConfig(env),
    ...optionalGoogleCruxTargetConfig(env),
    ...optionalYandexMetricaTargetConfig(env)
  };
}

function optionalTargetDiscoveryConfig(
  env: ExternalObservationCollectionProcessEnv
): ExternalObservationProviderTargetConfig["discovery"] | undefined {
  const siteUrls = optionalStringList(
    env,
    "SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_DISCOVERY_SITE_URLS"
  );
  const sitemapUrls = optionalStringList(
    env,
    "SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_DISCOVERY_SITEMAP_URLS"
  );
  const maxSubjectUrls = optionalBoundedInteger(
    env,
    "SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_DISCOVERY_MAX_SUBJECT_URLS",
    100,
    1,
    10000
  );
  if (siteUrls.length === 0 && sitemapUrls.length === 0) {
    return undefined;
  }
  return {
    ...(siteUrls.length === 0 ? {} : { siteUrls }),
    ...(sitemapUrls.length === 0 ? {} : { sitemapUrls }),
    maxSubjectUrls
  };
}

function optionalGoogleSearchAnalyticsTargetConfig(
  env: ExternalObservationCollectionProcessEnv
): Pick<ExternalObservationProviderTargetConfig, "googleSearchAnalytics"> {
  const startDate = optionalEnv(
    env,
    "SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_GOOGLE_SEARCH_ANALYTICS_START_DATE"
  );
  const endDate = optionalEnv(
    env,
    "SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_GOOGLE_SEARCH_ANALYTICS_END_DATE"
  );
  if (startDate === undefined && endDate === undefined) {
    return {};
  }
  if (startDate === undefined || endDate === undefined) {
    throw new Error(
      "SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_GOOGLE_SEARCH_ANALYTICS_START_DATE and SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_GOOGLE_SEARCH_ANALYTICS_END_DATE must be configured together."
    );
  }
  const dimensions = optionalStringList(
    env,
    "SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_GOOGLE_SEARCH_ANALYTICS_DIMENSIONS"
  );
  return {
    googleSearchAnalytics: {
      startDate,
      endDate,
      ...(dimensions.length === 0 ? {} : { dimensions })
    }
  };
}

function optionalGooglePageSpeedTargetConfig(
  env: ExternalObservationCollectionProcessEnv
): Pick<ExternalObservationProviderTargetConfig, "googlePageSpeed"> {
  const enabled = optionalBoolean(
    env,
    "SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_GOOGLE_PAGESPEED_ENABLED",
    false
  );
  if (!enabled) {
    return {};
  }
  const strategy = optionalGooglePageSpeedStrategy(
    env,
    "SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_GOOGLE_PAGESPEED_STRATEGY"
  );
  const categories = optionalGooglePageSpeedCategories(
    env,
    "SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_GOOGLE_PAGESPEED_CATEGORIES"
  );
  return {
    googlePageSpeed: {
      enabled: true,
      ...(strategy === undefined ? {} : { strategy }),
      ...(categories.length === 0 ? {} : { categories })
    }
  };
}

function optionalGoogleCruxTargetConfig(
  env: ExternalObservationCollectionProcessEnv
): Pick<ExternalObservationProviderTargetConfig, "googleCrux"> {
  const enabled = optionalBoolean(
    env,
    "SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_GOOGLE_CRUX_ENABLED",
    false
  );
  if (!enabled) {
    return {};
  }
  const formFactor = optionalGoogleCruxFormFactor(
    env,
    "SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_GOOGLE_CRUX_FORM_FACTOR"
  );
  const effectiveConnectionType = optionalEnv(
    env,
    "SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_GOOGLE_CRUX_EFFECTIVE_CONNECTION_TYPE"
  );
  return {
    googleCrux: {
      enabled: true,
      ...(formFactor === undefined ? {} : { formFactor }),
      ...(effectiveConnectionType === undefined
        ? {}
        : { effectiveConnectionType })
    }
  };
}

function optionalYandexMetricaTargetConfig(
  env: ExternalObservationCollectionProcessEnv
): Pick<ExternalObservationProviderTargetConfig, "yandexMetrica"> {
  const counterId = optionalEnv(
    env,
    "SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_YANDEX_METRICA_COUNTER_ID"
  );
  const startDate = optionalEnv(
    env,
    "SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_YANDEX_METRICA_START_DATE"
  );
  const endDate = optionalEnv(
    env,
    "SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_YANDEX_METRICA_END_DATE"
  );
  if (
    counterId === undefined &&
    startDate === undefined &&
    endDate === undefined
  ) {
    return {};
  }
  if (
    counterId === undefined ||
    startDate === undefined ||
    endDate === undefined
  ) {
    throw new Error(
      "SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_YANDEX_METRICA_COUNTER_ID, SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_YANDEX_METRICA_START_DATE, and SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_YANDEX_METRICA_END_DATE must be configured together."
    );
  }
  const metrics = optionalStringList(
    env,
    "SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_YANDEX_METRICA_METRICS"
  );
  return {
    yandexMetrica: {
      counterId,
      startDate,
      endDate,
      ...(metrics.length === 0 ? {} : { metrics })
    }
  };
}

function optionalOAuthRefreshConfig(
  env: ExternalObservationCollectionProcessEnv
): Pick<ExternalObservationCollectionProcessConfig, "oauthRefresh"> {
  const google = optionalOAuthRefreshProviderConfig(env, {
    providerName: "Google",
    clientIdEnv: "SEARCHLINT_WORKER_GOOGLE_OAUTH_CLIENT_ID",
    clientSecretEnv: "SEARCHLINT_WORKER_GOOGLE_OAUTH_CLIENT_SECRET",
    tokenEndpointEnv: "SEARCHLINT_WORKER_GOOGLE_OAUTH_TOKEN_ENDPOINT"
  });
  const yandex = optionalOAuthRefreshProviderConfig(env, {
    providerName: "Yandex",
    clientIdEnv: "SEARCHLINT_WORKER_YANDEX_OAUTH_CLIENT_ID",
    clientSecretEnv: "SEARCHLINT_WORKER_YANDEX_OAUTH_CLIENT_SECRET",
    tokenEndpointEnv: "SEARCHLINT_WORKER_YANDEX_OAUTH_TOKEN_ENDPOINT"
  });
  if (google === undefined && yandex === undefined) {
    return {};
  }
  return {
    oauthRefresh: {
      ...(google === undefined ? {} : { google }),
      ...(yandex === undefined ? {} : { yandex })
    }
  };
}

function optionalOAuthRefreshProviderConfig(
  env: ExternalObservationCollectionProcessEnv,
  names: {
    providerName: string;
    clientIdEnv: string;
    clientSecretEnv: string;
    tokenEndpointEnv: string;
  }
): ExternalObservationCollectionOAuthRefreshProviderConfig | undefined {
  const clientId = optionalEnv(env, names.clientIdEnv);
  const clientSecret = optionalEnv(env, names.clientSecretEnv);
  const tokenEndpoint = optionalEnv(env, names.tokenEndpointEnv);
  if (
    clientId === undefined &&
    clientSecret === undefined &&
    tokenEndpoint === undefined
  ) {
    return undefined;
  }
  if (clientId === undefined || clientSecret === undefined) {
    throw new Error(
      `${names.clientIdEnv} and ${names.clientSecretEnv} must be configured together for ${names.providerName} OAuth refresh.`
    );
  }
  return {
    clientId,
    clientSecret,
    ...(tokenEndpoint === undefined ? {} : { tokenEndpoint })
  };
}

function defaultTokenRefreshers(
  config: ExternalObservationCollectionProcessConfig,
  fetch: ExternalObservationOAuthRefreshFetch
): ExternalObservationOAuthTokenRefreshers | undefined {
  if (config.oauthRefresh === undefined) {
    return undefined;
  }
  return {
    ...(config.oauthRefresh.google === undefined
      ? {}
      : {
          google: createGoogleOAuthTokenRefresher({
            ...config.oauthRefresh.google,
            fetch
          })
        }),
    ...(config.oauthRefresh.yandex === undefined
      ? {}
      : {
          yandex: createYandexOAuthTokenRefresher({
            ...config.oauthRefresh.yandex,
            fetch
          })
        })
  };
}

function requiredEnv(
  env: ExternalObservationCollectionProcessEnv,
  name: string
): string {
  const value = optionalEnv(env, name);
  if (value === undefined) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function optionalEnv(
  env: ExternalObservationCollectionProcessEnv,
  name: string
): string | undefined {
  const value = env[name]?.trim();
  return value && value.length > 0 ? value : undefined;
}

function optionalStringList(
  env: ExternalObservationCollectionProcessEnv,
  name: string
): readonly string[] {
  const value = optionalEnv(env, name);
  if (value === undefined) {
    return [];
  }
  return value
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function optionalProvider(
  env: ExternalObservationCollectionProcessEnv,
  name: string
): ExternalObservationProvider | undefined {
  const value = optionalEnv(env, name);
  if (value === undefined || value === "all") {
    return undefined;
  }
  if (value === "google" || value === "yandex") {
    return value;
  }
  throw new Error(`${name} must be google, yandex, or all.`);
}

function optionalBoolean(
  env: ExternalObservationCollectionProcessEnv,
  name: string,
  fallback: boolean
): boolean {
  const value = optionalEnv(env, name);
  if (value === undefined) {
    return fallback;
  }
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  throw new Error(`${name} must be true or false.`);
}

function optionalGooglePageSpeedStrategy(
  env: ExternalObservationCollectionProcessEnv,
  name: string
): "mobile" | "desktop" | undefined {
  const value = optionalEnv(env, name);
  if (value === undefined) {
    return undefined;
  }
  if (value === "mobile" || value === "desktop") {
    return value;
  }
  throw new Error(`${name} must be mobile or desktop.`);
}

function optionalGooglePageSpeedCategories(
  env: ExternalObservationCollectionProcessEnv,
  name: string
): readonly ("performance" | "accessibility" | "best-practices" | "seo")[] {
  return optionalStringList(env, name).map((value) => {
    if (
      value === "performance" ||
      value === "accessibility" ||
      value === "best-practices" ||
      value === "seo"
    ) {
      return value;
    }
    throw new Error(
      `${name} must contain only performance, accessibility, best-practices, or seo.`
    );
  });
}

function optionalGoogleCruxFormFactor(
  env: ExternalObservationCollectionProcessEnv,
  name: string
): "PHONE" | "DESKTOP" | "TABLET" | undefined {
  const value = optionalEnv(env, name);
  if (value === undefined) {
    return undefined;
  }
  if (value === "PHONE" || value === "DESKTOP" || value === "TABLET") {
    return value;
  }
  throw new Error(`${name} must be PHONE, DESKTOP, or TABLET.`);
}

function optionalSecretNamePrefix(
  env: ExternalObservationCollectionProcessEnv,
  name: string
): Pick<ExternalObservationCollectionProcessConfig, "oauthSecretNamePrefix"> {
  const value = optionalEnv(env, name);
  return value === undefined ? {} : { oauthSecretNamePrefix: value };
}

function optionalMaxBatches(
  env: ExternalObservationCollectionProcessEnv
): Pick<ExternalObservationCollectionProcessConfig, "maxBatches"> {
  const value = optionalEnv(
    env,
    "SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_MAX_BATCHES"
  );
  if (value === undefined) {
    return {};
  }
  return {
    maxBatches: optionalBoundedInteger(
      env,
      "SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_MAX_BATCHES",
      1,
      1,
      1000
    )
  };
}

function optionalPositiveInteger(
  env: ExternalObservationCollectionProcessEnv,
  name: string,
  fallback: number
): number {
  const value = optionalEnv(env, name);
  if (value === undefined) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsed;
}

function optionalBoundedInteger(
  env: ExternalObservationCollectionProcessEnv,
  name: string,
  fallback: number,
  min: number,
  max: number
): number {
  const value = optionalEnv(env, name);
  if (value === undefined) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${name} must be an integer from ${min} to ${max}.`);
  }
  return parsed;
}

const nativeProviderFetch: GoogleProviderFetch & YandexProviderFetch = async (
  url,
  init
) => fetch(url, init);
