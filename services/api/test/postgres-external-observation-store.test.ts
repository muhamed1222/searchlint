import { describe, expect, it } from "vitest";

import { createPostgresExternalObservationStore } from "../src/index.js";
import type {
  ExternalObservationRecord,
  PostgresQuery,
  PostgresQueryExecutor,
  PostgresQueryResult
} from "../src/index.js";

describe("createPostgresExternalObservationStore", () => {
  it("upserts and selects Google observations through repository SQL contracts", async () => {
    const input = observationRecord();
    const executor = new RecordingExecutor([row(input), row(input)]);
    const store = createPostgresExternalObservationStore(executor);

    await expect(store.upsertExternalObservation(input)).resolves.toEqual(
      input
    );
    await expect(
      store.selectExternalObservations({
        organizationId: "org-1",
        projectId: "project-1",
        environmentId: "env-1",
        provider: "google",
        limit: 25
      })
    ).resolves.toEqual([input]);

    expect(executor.queries[0]?.text).toContain(
      'INSERT INTO "external_observations"'
    );
    expect(executor.queries[0]?.values).toContain(
      "cloud.external_observations.v1"
    );
    expect(executor.queries[0]?.values).toContain("google");
    expect(executor.queries[0]?.values).toContain("google.urlInspection");
    expect(executor.queries[1]?.text).toContain('FROM "external_observations"');
    expect(executor.queries[1]?.values).toEqual([
      "org-1",
      "project-1",
      "env-1",
      "google",
      "active",
      25
    ]);
  });

  it("upserts and selects Yandex observations with sampling evidence", async () => {
    const input = observationRecord({
      id: "observation-yandex-1",
      provider: "yandex",
      source: "yandex.metrica",
      payload: {
        landingPages: [
          {
            url: "https://example.test/",
            visits: 42
          }
        ]
      },
      sampling: {
        sampled: true,
        state: "sampled"
      },
      fingerprint: "yandex-metrica-home"
    });
    delete input.quota;
    const executor = new RecordingExecutor([row(input), row(input)]);
    const store = createPostgresExternalObservationStore(executor);

    await expect(store.upsertExternalObservation(input)).resolves.toEqual(
      input
    );
    await expect(
      store.selectExternalObservations({
        organizationId: "org-1",
        projectId: "project-1",
        environmentId: "env-1",
        provider: "yandex",
        limit: 25
      })
    ).resolves.toEqual([input]);

    expect(executor.queries[0]?.values).toContain("yandex");
    expect(executor.queries[0]?.values).toContain("yandex.metrica");
    expect(executor.queries[1]?.values).toEqual([
      "org-1",
      "project-1",
      "env-1",
      "yandex",
      "active",
      25
    ]);
  });

  it("rejects malformed provider rows", async () => {
    const executor = new RecordingExecutor([
      {
        ...row(observationRecord()),
        provider: "mixed"
      }
    ]);
    const store = createPostgresExternalObservationStore(executor);

    await expect(
      store.selectExternalObservations({
        organizationId: "org-1",
        projectId: "project-1",
        environmentId: "env-1",
        limit: 25
      })
    ).rejects.toThrow("Expected provider to be google or yandex.");
  });

  it("rejects provider/source mismatches", async () => {
    const executor = new RecordingExecutor([
      {
        ...row(observationRecord()),
        provider: "yandex",
        source: "google.urlInspection"
      }
    ]);
    const store = createPostgresExternalObservationStore(executor);

    await expect(
      store.selectExternalObservations({
        organizationId: "org-1",
        projectId: "project-1",
        environmentId: "env-1",
        limit: 25
      })
    ).rejects.toThrow(
      "Expected source to match external observation provider."
    );
  });

  it("rejects missing upsert rows", async () => {
    const executor = new RecordingExecutor([]);
    const store = createPostgresExternalObservationStore(executor);

    await expect(
      store.upsertExternalObservation(observationRecord())
    ).rejects.toThrow("upsertExternalObservation did not return a row.");
  });
});

class RecordingExecutor implements PostgresQueryExecutor {
  readonly queries: PostgresQuery[] = [];
  private readonly rows: Record<string, unknown>[][];

  constructor(rows: Record<string, unknown>[]) {
    this.rows = rows.map((item) => [item]);
  }

  async query<Row extends Record<string, unknown>>(
    query: PostgresQuery
  ): Promise<PostgresQueryResult<Row>> {
    this.queries.push(query);
    return {
      rows: (this.rows.shift() ?? []) as Row[]
    };
  }
}

function observationRecord(
  overrides: Partial<ExternalObservationRecord> = {}
): ExternalObservationRecord {
  return {
    id: "observation-1",
    organizationId: "org-1",
    projectId: "project-1",
    environmentId: "env-1",
    provider: "google",
    source: "google.urlInspection",
    subjectUrl: "https://example.test/",
    observedAt: "2026-06-21T00:00:00.000Z",
    fetchedAt: "2026-06-21T00:01:00.000Z",
    freshness: "fresh",
    payload: {
      inspectionResult: {
        verdict: "PASS"
      }
    },
    quota: {
      limit: 2000,
      remaining: 1999,
      resetAt: "2026-06-22T00:00:00.000Z"
    },
    sampling: {
      sampled: false
    },
    fingerprint: "google-url-inspection-home",
    deletionState: "active",
    createdAt: "2026-06-21T00:02:00.000Z",
    ...overrides
  };
}

function row(record: ExternalObservationRecord): Record<string, unknown> {
  return {
    id: record.id,
    organization_id: record.organizationId,
    project_id: record.projectId,
    environment_id: record.environmentId,
    provider: record.provider,
    source: record.source,
    subject_url: record.subjectUrl,
    observed_at: record.observedAt,
    fetched_at: record.fetchedAt,
    freshness: record.freshness,
    payload: record.payload,
    quota: record.quota ?? null,
    sampling: record.sampling ?? null,
    fingerprint: record.fingerprint,
    retention_until: record.retentionUntil ?? null,
    deletion_state: record.deletionState,
    created_at: record.createdAt
  };
}
