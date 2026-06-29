import { describe, expect, it } from "vitest";

import {
  collectExternalObservationsBatch,
  createExternalObservationCollectionPollingRuntime
} from "../src/index.js";
import type {
  CollectExternalObservationsBatchResult,
  ExternalObservationAccessTokenVault,
  ExternalObservationProviderCollector,
  ExternalObservationProviderCollectors
} from "../src/index.js";
import type {
  ExternalObservationProvider,
  ExternalObservationRecord,
  ExternalObservationStore,
  OAuthConnectionRecord,
  OAuthConnectionStore
} from "@searchlint/api";

describe("collectExternalObservationsBatch", () => {
  it("routes Google and Yandex connections through vault-backed collectors and stores observations", async () => {
    const google = connection({
      id: "google-connection",
      provider: "google",
      accessTokenSecretRef: "secret://org-1/google/access-token"
    });
    const yandex = connection({
      id: "yandex-connection",
      provider: "yandex",
      accessTokenSecretRef: "secret://org-1/yandex/access-token"
    });
    const oauthConnections = new RecordingOAuthConnectionStore([
      google,
      yandex
    ]);
    const externalObservations = new RecordingExternalObservationStore();
    const vault = new RecordingVault({
      "secret://org-1/google/access-token": "google-token",
      "secret://org-1/yandex/access-token": "yandex-token"
    });
    const collectors = recordingCollectors({
      google: [observation({ provider: "google" })],
      yandex: [
        observation({
          id: "yandex-observation-1",
          provider: "yandex",
          source: "yandex.webmaster",
          fingerprint: "yandex-observation"
        })
      ]
    });

    await expect(
      collectExternalObservationsBatch({
        oauthConnections,
        externalObservations,
        vault,
        collectors,
        now: "2026-06-21T00:00:00.000Z",
        limit: 10
      })
    ).resolves.toEqual({
      selected: 2,
      collected: 2,
      stored: 2,
      failed: 0,
      skipped: 0
    });

    expect(oauthConnections.selections).toEqual([
      {
        now: "2026-06-21T00:00:00.000Z",
        limit: 10
      }
    ]);
    expect(vault.requests).toEqual([
      {
        organizationId: "org-1",
        secretRef: "secret://org-1/google/access-token"
      },
      {
        organizationId: "org-1",
        secretRef: "secret://org-1/yandex/access-token"
      }
    ]);
    expect(collectors.google.calls).toEqual([
      {
        connectionId: "google-connection",
        accessToken: "google-token",
        now: "2026-06-21T00:00:00.000Z"
      }
    ]);
    expect(collectors.yandex.calls).toEqual([
      {
        connectionId: "yandex-connection",
        accessToken: "yandex-token",
        now: "2026-06-21T00:00:00.000Z"
      }
    ]);
    expect(
      externalObservations.records.map((record) => record.provider)
    ).toEqual(["google", "yandex"]);
  });

  it("passes provider filters to OAuth selection", async () => {
    const oauthConnections = new RecordingOAuthConnectionStore([]);

    await collectExternalObservationsBatch({
      oauthConnections,
      externalObservations: new RecordingExternalObservationStore(),
      vault: new RecordingVault({}),
      collectors: recordingCollectors({ google: [], yandex: [] }),
      now: "2026-06-21T00:00:00.000Z",
      provider: "google",
      limit: 25
    });

    expect(oauthConnections.selections).toEqual([
      {
        now: "2026-06-21T00:00:00.000Z",
        provider: "google",
        limit: 25
      }
    ]);
  });

  it("refreshes configured OAuth tokens before provider collection", async () => {
    const oauthConnections = new RecordingOAuthConnectionStore([
      connection({
        id: "google-connection",
        provider: "google",
        accessTokenSecretRef: "secret://org-1/google/access-token",
        refreshTokenSecretRef: "secret://org-1/google/refresh-token",
        lastError: "expired token"
      })
    ]);
    const externalObservations = new RecordingExternalObservationStore();
    const vault = new RecordingVault({
      "secret://org-1/google/refresh-token": "old-refresh-token"
    });
    const collectors = recordingCollectors({
      google: [observation({ provider: "google" })],
      yandex: []
    });

    await expect(
      collectExternalObservationsBatch({
        oauthConnections,
        externalObservations,
        vault,
        collectors,
        tokenRefreshers: {
          google: {
            async refreshAccessToken(input) {
              expect(input.refreshToken).toBe("old-refresh-token");
              expect(input.now).toBe("2026-06-21T00:00:00.000Z");
              return {
                accessToken: "new-access-token",
                refreshToken: "rotated-refresh-token",
                expiresAt: "2026-06-21T01:00:00.000Z"
              };
            }
          }
        },
        now: "2026-06-21T00:00:00.000Z",
        limit: 10
      })
    ).resolves.toEqual({
      selected: 1,
      collected: 1,
      stored: 1,
      failed: 0,
      skipped: 0
    });

    expect(vault.requests).toEqual([
      {
        organizationId: "org-1",
        secretRef: "secret://org-1/google/refresh-token"
      }
    ]);
    expect(vault.writes).toEqual([
      {
        organizationId: "org-1",
        secretRef: "secret://org-1/google/access-token",
        value: "new-access-token"
      },
      {
        organizationId: "org-1",
        secretRef: "secret://org-1/google/refresh-token",
        value: "rotated-refresh-token"
      }
    ]);
    expect(oauthConnections.upserts).toHaveLength(1);
    expect(oauthConnections.upserts[0]).toMatchObject({
      id: "google-connection",
      status: "active",
      lastRefreshAt: "2026-06-21T00:00:00.000Z",
      expiresAt: "2026-06-21T01:00:00.000Z"
    });
    expect(oauthConnections.upserts[0]?.lastError).toBeUndefined();
    expect(collectors.google.calls).toEqual([
      {
        connectionId: "google-connection",
        accessToken: "new-access-token",
        now: "2026-06-21T00:00:00.000Z"
      }
    ]);
  });

  it("keeps existing access-token reads when no refresher is configured", async () => {
    const oauthConnections = new RecordingOAuthConnectionStore([
      connection({
        accessTokenSecretRef: "secret://org-1/google/access-token",
        refreshTokenSecretRef: "secret://org-1/google/refresh-token"
      })
    ]);
    const vault = new RecordingVault({
      "secret://org-1/google/access-token": "stored-access-token",
      "secret://org-1/google/refresh-token": "stored-refresh-token"
    });
    const collectors = recordingCollectors({
      google: [observation({ provider: "google" })],
      yandex: []
    });

    await expect(
      collectExternalObservationsBatch({
        oauthConnections,
        externalObservations: new RecordingExternalObservationStore(),
        vault,
        collectors,
        tokenRefreshers: {},
        now: "2026-06-21T00:00:00.000Z",
        limit: 10
      })
    ).resolves.toMatchObject({
      failed: 0,
      stored: 1
    });

    expect(vault.requests).toEqual([
      {
        organizationId: "org-1",
        secretRef: "secret://org-1/google/access-token"
      }
    ]);
    expect(vault.writes).toEqual([]);
    expect(oauthConnections.upserts).toEqual([]);
    expect(collectors.google.calls[0]?.accessToken).toBe("stored-access-token");
  });

  it("isolates missing access tokens and collector failures per connection", async () => {
    const good = connection({
      id: "good",
      provider: "google",
      accessTokenSecretRef: "secret://org-1/google/access-token"
    });
    const missingAccessToken = connection({
      id: "missing",
      provider: "yandex"
    });
    delete missingAccessToken.accessTokenSecretRef;
    const failingCollector = connection({
      id: "failing",
      provider: "yandex",
      accessTokenSecretRef: "secret://org-1/yandex/access-token"
    });
    const externalObservations = new RecordingExternalObservationStore();
    const collectors = recordingCollectors({
      google: [observation({ provider: "google" })],
      yandex: new Error("provider unavailable")
    });

    await expect(
      collectExternalObservationsBatch({
        oauthConnections: new RecordingOAuthConnectionStore([
          good,
          missingAccessToken,
          failingCollector
        ]),
        externalObservations,
        vault: new RecordingVault({
          "secret://org-1/google/access-token": "google-token",
          "secret://org-1/yandex/access-token": "yandex-token"
        }),
        collectors,
        now: "2026-06-21T00:00:00.000Z",
        limit: 10
      })
    ).resolves.toEqual({
      selected: 3,
      collected: 1,
      stored: 1,
      failed: 2,
      skipped: 0
    });
    expect(externalObservations.records).toHaveLength(1);
  });

  it("isolates refresh failures without collecting stale provider data", async () => {
    const oauthConnections = new RecordingOAuthConnectionStore([
      connection({
        id: "refresh-failure",
        provider: "google",
        accessTokenSecretRef: "secret://org-1/google/access-token",
        refreshTokenSecretRef: "secret://org-1/google/refresh-token"
      })
    ]);
    const vault = new RecordingVault({
      "secret://org-1/google/refresh-token": "old-refresh-token"
    });
    const collectors = recordingCollectors({
      google: [observation({ provider: "google" })],
      yandex: []
    });

    await expect(
      collectExternalObservationsBatch({
        oauthConnections,
        externalObservations: new RecordingExternalObservationStore(),
        vault,
        collectors,
        tokenRefreshers: {
          google: {
            async refreshAccessToken() {
              throw new Error("refresh failed");
            }
          }
        },
        now: "2026-06-21T00:00:00.000Z",
        limit: 10
      })
    ).resolves.toEqual({
      selected: 1,
      collected: 0,
      stored: 0,
      failed: 1,
      skipped: 0
    });
    expect(vault.writes).toEqual([]);
    expect(oauthConnections.upserts).toEqual([]);
    expect(collectors.google.calls).toEqual([]);
  });

  it("rejects invalid collection limits", async () => {
    await expect(
      collectExternalObservationsBatch({
        oauthConnections: new RecordingOAuthConnectionStore([]),
        externalObservations: new RecordingExternalObservationStore(),
        vault: new RecordingVault({}),
        collectors: recordingCollectors({ google: [], yandex: [] }),
        now: "2026-06-21T00:00:00.000Z",
        limit: 0
      })
    ).rejects.toThrow(
      "External observation collection limit must be positive."
    );
  });
});

describe("createExternalObservationCollectionPollingRuntime", () => {
  it("runs collection batches until stopped", async () => {
    const batches: CollectExternalObservationsBatchResult[] = [];
    let sleepCalls = 0;
    const runtime = createExternalObservationCollectionPollingRuntime({
      oauthConnections: new RecordingOAuthConnectionStore([
        connection({
          accessTokenSecretRef: "secret://org-1/google/access-token"
        })
      ]),
      externalObservations: new RecordingExternalObservationStore(),
      vault: new RecordingVault({
        "secret://org-1/google/access-token": "google-token"
      }),
      collectors: recordingCollectors({
        google: [observation({ provider: "google" })],
        yandex: []
      }),
      now: "2026-06-21T00:00:00.000Z",
      limit: 1,
      intervalMs: 10,
      async sleep(_intervalMs, signal) {
        sleepCalls += 1;
        signal.dispatchEvent(new Event("abort"));
      },
      onBatch(result) {
        batches.push(result);
        void runtime.stop();
      }
    });

    runtime.start();
    await runtime.done();

    expect(runtime.isRunning()).toBe(false);
    expect(sleepCalls).toBe(0);
    expect(batches).toEqual([
      {
        selected: 1,
        collected: 1,
        stored: 1,
        failed: 0,
        skipped: 0
      }
    ]);
  });

  it("rejects duplicate starts and invalid intervals", () => {
    expect(() =>
      createExternalObservationCollectionPollingRuntime({
        oauthConnections: new RecordingOAuthConnectionStore([]),
        externalObservations: new RecordingExternalObservationStore(),
        vault: new RecordingVault({}),
        collectors: recordingCollectors({ google: [], yandex: [] }),
        now: "2026-06-21T00:00:00.000Z",
        limit: 1,
        intervalMs: 0
      })
    ).toThrow(
      "External observation collection polling interval must be a positive integer."
    );

    const runtime = createExternalObservationCollectionPollingRuntime({
      oauthConnections: new RecordingOAuthConnectionStore([]),
      externalObservations: new RecordingExternalObservationStore(),
      vault: new RecordingVault({}),
      collectors: recordingCollectors({ google: [], yandex: [] }),
      now: "2026-06-21T00:00:00.000Z",
      limit: 1,
      intervalMs: 10,
      sleep: (_intervalMs, signal) =>
        new Promise((resolve) => {
          signal.addEventListener("abort", () => resolve(), {
            once: true
          });
        })
    });

    runtime.start();
    expect(() => runtime.start()).toThrow(
      "External observation collection polling runtime is already running."
    );
    void runtime.stop();
  });

  it("stops after the configured maximum batch count", async () => {
    const batches: CollectExternalObservationsBatchResult[] = [];
    let sleepCalls = 0;
    const runtime = createExternalObservationCollectionPollingRuntime({
      oauthConnections: new RecordingOAuthConnectionStore([]),
      externalObservations: new RecordingExternalObservationStore(),
      vault: new RecordingVault({}),
      collectors: recordingCollectors({ google: [], yandex: [] }),
      now: "2026-06-21T00:00:00.000Z",
      limit: 1,
      intervalMs: 10,
      maxBatches: 1,
      async sleep() {
        sleepCalls += 1;
      },
      onBatch(result) {
        batches.push(result);
      }
    });

    runtime.start();
    await runtime.done();

    expect(runtime.isRunning()).toBe(false);
    expect(sleepCalls).toBe(0);
    expect(batches).toEqual([
      {
        selected: 0,
        collected: 0,
        stored: 0,
        failed: 0,
        skipped: 0
      }
    ]);
  });
});

class RecordingOAuthConnectionStore implements OAuthConnectionStore {
  readonly selections: {
    now: string;
    provider?: ExternalObservationProvider;
    limit: number;
  }[] = [];
  readonly upserts: OAuthConnectionRecord[] = [];

  constructor(private readonly connections: readonly OAuthConnectionRecord[]) {}

  async upsertOAuthConnection(
    input: OAuthConnectionRecord
  ): Promise<OAuthConnectionRecord> {
    this.upserts.push(input);
    return input;
  }

  async getOAuthConnection(): Promise<OAuthConnectionRecord | undefined> {
    return undefined;
  }

  async selectOAuthConnectionsDueForRefresh(input: {
    now: string;
    provider?: ExternalObservationProvider;
    limit: number;
  }): Promise<readonly OAuthConnectionRecord[]> {
    this.selections.push(input);
    return this.connections.filter(
      (connection) =>
        input.provider === undefined || connection.provider === input.provider
    );
  }

  async markOAuthConnectionRevoked(): Promise<
    OAuthConnectionRecord | undefined
  > {
    return undefined;
  }
}

class RecordingExternalObservationStore implements ExternalObservationStore {
  readonly records: ExternalObservationRecord[] = [];

  async upsertExternalObservation(
    input: ExternalObservationRecord
  ): Promise<ExternalObservationRecord> {
    this.records.push(input);
    return input;
  }

  async selectExternalObservations(): Promise<
    readonly ExternalObservationRecord[]
  > {
    return this.records;
  }
}

class RecordingVault implements ExternalObservationAccessTokenVault {
  readonly requests: { organizationId: string; secretRef: string }[] = [];
  readonly writes: {
    organizationId: string;
    secretRef: string;
    value: string;
  }[] = [];

  constructor(private readonly secrets: Readonly<Record<string, string>>) {}

  async getSecret(input: {
    organizationId: string;
    secretRef: string;
  }): Promise<{ value: string }> {
    this.requests.push(input);
    const value = this.secrets[input.secretRef];
    if (value === undefined) {
      throw new Error(`Missing secret ${input.secretRef}.`);
    }
    return { value };
  }

  async putSecret(input: {
    organizationId: string;
    secretRef: string;
    value: string;
  }): Promise<void> {
    this.writes.push(input);
  }
}

type RecordingCollector = ExternalObservationProviderCollector & {
  calls: { connectionId: string; accessToken: string; now: string }[];
};

function recordingCollectors(input: {
  google: readonly ExternalObservationRecord[] | Error;
  yandex: readonly ExternalObservationRecord[] | Error;
}): ExternalObservationProviderCollectors & {
  google: RecordingCollector;
  yandex: RecordingCollector;
} {
  return {
    google: recordingCollector(input.google),
    yandex: recordingCollector(input.yandex)
  };
}

function recordingCollector(
  output: readonly ExternalObservationRecord[] | Error
): RecordingCollector {
  const calls: RecordingCollector["calls"] = [];
  return {
    calls,
    async collectExternalObservations(input) {
      calls.push({
        connectionId: input.connection.id,
        accessToken: input.accessToken,
        now: input.now
      });
      if (output instanceof Error) {
        throw output;
      }
      return output;
    }
  };
}

function connection(
  overrides: Partial<OAuthConnectionRecord> = {}
): OAuthConnectionRecord {
  return {
    id: "connection-1",
    organizationId: "org-1",
    projectId: "project-1",
    environmentId: "env-1",
    provider: "google",
    providerAccountId: "sc-domain:example.test",
    scopes: ["scope-1"],
    accessTokenSecretRef: "secret://org-1/google/access-token",
    refreshTokenSecretRef: "secret://org-1/google/refresh-token",
    expiresAt: "2026-06-21T00:00:00.000Z",
    status: "active",
    deletionState: "active",
    createdAt: "2026-06-20T00:00:00.000Z",
    ...overrides
  };
}

function observation(
  overrides: Partial<ExternalObservationRecord> & {
    provider: ExternalObservationProvider;
  }
): ExternalObservationRecord {
  const { provider, ...rest } = overrides;
  return {
    id: "google-observation-1",
    organizationId: "org-1",
    projectId: "project-1",
    environmentId: "env-1",
    provider,
    source: provider === "google" ? "google.urlInspection" : "yandex.webmaster",
    subjectUrl: "https://example.test/",
    observedAt: "2026-06-21T00:00:00.000Z",
    fetchedAt: "2026-06-21T00:00:00.000Z",
    freshness: "fresh",
    payload: {},
    fingerprint: "google-observation",
    deletionState: "active",
    createdAt: "2026-06-21T00:00:00.000Z",
    ...rest
  };
}
