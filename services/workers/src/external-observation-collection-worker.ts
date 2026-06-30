import type {
  ExternalObservationProvider,
  ExternalObservationRecord,
  ExternalObservationStore,
  OAuthConnectionRecord,
  OAuthConnectionStore
} from "@searchlint/api";
import type {
  ExternalObservationOAuthRefreshResult,
  ExternalObservationOAuthTokenRefreshers
} from "./external-observation-oauth-refresh.js";

export type ExternalObservationAccessTokenVault = {
  getSecret(input: {
    organizationId: string;
    secretRef: string;
  }): Promise<{ value: string }>;
  putSecret?(input: {
    organizationId: string;
    secretRef: string;
    value: string;
  }): Promise<void>;
  deleteSecret?(input: {
    organizationId: string;
    secretRef: string;
  }): Promise<void>;
};

export type ExternalObservationProviderCollectorInput = {
  connection: OAuthConnectionRecord;
  accessToken: string;
  now: string;
};

export type ExternalObservationProviderCollector = {
  collectExternalObservations(
    input: ExternalObservationProviderCollectorInput
  ): Promise<readonly ExternalObservationRecord[]>;
};

export type ExternalObservationProviderCollectors = {
  google: ExternalObservationProviderCollector;
  yandex: ExternalObservationProviderCollector;
};

export type CollectExternalObservationsBatchInput = {
  oauthConnections: OAuthConnectionStore;
  externalObservations: ExternalObservationStore;
  vault: ExternalObservationAccessTokenVault;
  collectors: ExternalObservationProviderCollectors;
  tokenRefreshers?: ExternalObservationOAuthTokenRefreshers;
  now: string;
  limit: number;
  provider?: ExternalObservationProvider;
};

export type CollectExternalObservationsBatchResult = {
  selected: number;
  collected: number;
  stored: number;
  failed: number;
  skipped: number;
};

export type ExternalObservationCollectionClock = {
  now(): string;
};

export type ExternalObservationCollectionPollingRuntimeSleep = (
  intervalMs: number,
  signal: AbortSignal
) => Promise<void>;

export type ExternalObservationCollectionPollingRuntimeOptions = Omit<
  CollectExternalObservationsBatchInput,
  "now"
> & {
  now?: string;
  clock?: ExternalObservationCollectionClock;
  intervalMs: number;
  sleep?: ExternalObservationCollectionPollingRuntimeSleep;
  maxBatches?: number;
  onBatch?: (
    result: CollectExternalObservationsBatchResult
  ) => void | Promise<void>;
  onError?: (error: Error) => void | Promise<void>;
  stopOnError?: boolean;
};

export type ExternalObservationCollectionPollingRuntime = {
  start(): void;
  stop(): Promise<void>;
  done(): Promise<void>;
  isRunning(): boolean;
};

export async function collectExternalObservationsBatch(
  input: CollectExternalObservationsBatchInput
): Promise<CollectExternalObservationsBatchResult> {
  if (!Number.isInteger(input.limit) || input.limit <= 0) {
    throw new Error("External observation collection limit must be positive.");
  }

  const connections =
    await input.oauthConnections.selectOAuthConnectionsDueForRefresh({
      now: input.now,
      ...(input.provider === undefined ? {} : { provider: input.provider }),
      limit: input.limit
    });
  const result: CollectExternalObservationsBatchResult = {
    selected: connections.length,
    collected: 0,
    stored: 0,
    failed: 0,
    skipped: 0
  };

  for (const connection of connections) {
    await collectConnection(input, connection, result);
  }

  return result;
}

export function createExternalObservationCollectionPollingRuntime(
  options: ExternalObservationCollectionPollingRuntimeOptions
): ExternalObservationCollectionPollingRuntime {
  if (!Number.isInteger(options.intervalMs) || options.intervalMs < 1) {
    throw new Error(
      "External observation collection polling interval must be a positive integer."
    );
  }
  if (
    options.maxBatches !== undefined &&
    (!Number.isInteger(options.maxBatches) || options.maxBatches < 1)
  ) {
    throw new Error(
      "External observation collection max batches must be a positive integer."
    );
  }

  const sleep = options.sleep ?? defaultSleep;
  let running = false;
  let stopRequested = false;
  let controller: AbortController | undefined;
  let donePromise: Promise<void> = Promise.resolve();
  let completedBatches = 0;

  async function runLoop(signal: AbortSignal): Promise<void> {
    while (!stopRequested && !signal.aborted) {
      try {
        const result = await collectExternalObservationsBatch({
          oauthConnections: options.oauthConnections,
          externalObservations: options.externalObservations,
          vault: options.vault,
          collectors: options.collectors,
          ...(options.tokenRefreshers === undefined
            ? {}
            : { tokenRefreshers: options.tokenRefreshers }),
          now: options.now ?? options.clock?.now() ?? new Date().toISOString(),
          limit: options.limit,
          ...(options.provider === undefined
            ? {}
            : { provider: options.provider })
        });
        await options.onBatch?.(result);
        completedBatches += 1;
        if (
          options.maxBatches !== undefined &&
          completedBatches >= options.maxBatches
        ) {
          stopRequested = true;
        }
      } catch (error) {
        const normalized = asError(error);
        await options.onError?.(normalized);
        if (options.stopOnError === true) {
          throw normalized;
        }
      }

      if (!stopRequested && !signal.aborted) {
        await sleep(options.intervalMs, signal);
      }
    }
  }

  return {
    start() {
      if (running) {
        throw new Error(
          "External observation collection polling runtime is already running."
        );
      }
      stopRequested = false;
      completedBatches = 0;
      running = true;
      controller = new AbortController();
      donePromise = runLoop(controller.signal).finally(() => {
        running = false;
        controller = undefined;
      });
    },
    async stop() {
      stopRequested = true;
      controller?.abort();
      await donePromise;
    },
    done() {
      return donePromise;
    },
    isRunning() {
      return running;
    }
  };
}

async function collectConnection(
  input: CollectExternalObservationsBatchInput,
  connection: OAuthConnectionRecord,
  result: CollectExternalObservationsBatchResult
): Promise<void> {
  if (connection.accessTokenSecretRef === undefined) {
    result.failed += 1;
    return;
  }

  try {
    const refreshed = await refreshConnectionIfConfigured(input, connection);
    const token =
      refreshed ??
      (await input.vault.getSecret({
        organizationId: connection.organizationId,
        secretRef: connection.accessTokenSecretRef
      }));
    const records = await collectorFor(
      input.collectors,
      connection.provider
    ).collectExternalObservations({
      connection,
      accessToken: token.value,
      now: input.now
    });
    result.collected += records.length;

    for (const record of records) {
      await input.externalObservations.upsertExternalObservation(record);
      result.stored += 1;
    }
  } catch {
    result.failed += 1;
  }
}

async function refreshConnectionIfConfigured(
  input: CollectExternalObservationsBatchInput,
  connection: OAuthConnectionRecord
): Promise<{ value: string } | undefined> {
  const refresher = input.tokenRefreshers?.[connection.provider];
  if (refresher === undefined) {
    return undefined;
  }
  if (input.vault.putSecret === undefined) {
    throw new Error(
      "External observation token refresh requires a writable token vault."
    );
  }

  const refreshToken = await input.vault.getSecret({
    organizationId: connection.organizationId,
    secretRef: connection.refreshTokenSecretRef
  });
  const refreshed = await refresher.refreshAccessToken({
    connection,
    refreshToken: refreshToken.value,
    now: input.now
  });
  await writeRefreshedTokens(input, connection, refreshed);
  await input.oauthConnections.upsertOAuthConnection(
    refreshedConnection(connection, refreshed, input.now)
  );
  return {
    value: refreshed.accessToken
  };
}

async function writeRefreshedTokens(
  input: CollectExternalObservationsBatchInput,
  connection: OAuthConnectionRecord,
  refreshed: ExternalObservationOAuthRefreshResult
): Promise<void> {
  if (connection.accessTokenSecretRef === undefined) {
    throw new Error(
      "External observation token refresh requires an access token secret ref."
    );
  }
  if (input.vault.putSecret === undefined) {
    throw new Error(
      "External observation token refresh requires a writable token vault."
    );
  }
  await input.vault.putSecret({
    organizationId: connection.organizationId,
    secretRef: connection.accessTokenSecretRef,
    value: refreshed.accessToken
  });
  if (refreshed.refreshToken !== undefined) {
    await input.vault.putSecret({
      organizationId: connection.organizationId,
      secretRef: connection.refreshTokenSecretRef,
      value: refreshed.refreshToken
    });
  }
}

function refreshedConnection(
  connection: OAuthConnectionRecord,
  refreshed: ExternalObservationOAuthRefreshResult,
  now: string
): OAuthConnectionRecord {
  const next: OAuthConnectionRecord = {
    ...connection,
    status: "active",
    lastRefreshAt: now
  };
  delete next.lastError;
  if (refreshed.expiresAt !== undefined) {
    next.expiresAt = refreshed.expiresAt;
  }
  return next;
}

function collectorFor(
  collectors: ExternalObservationProviderCollectors,
  provider: ExternalObservationProvider
): ExternalObservationProviderCollector {
  if (provider === "google") {
    return collectors.google;
  }
  if (provider === "yandex") {
    return collectors.yandex;
  }
  throw new Error(
    `Unsupported external observation provider ${String(provider)}.`
  );
}

function asError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  return new Error(String(error));
}

function defaultSleep(intervalMs: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const timeout = setTimeout(resolve, intervalMs);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timeout);
        resolve();
      },
      {
        once: true
      }
    );
  });
}
