import { describe, expect, it } from "vitest";

import {
  createPostgresRestorePitrPlan,
  createCurrentCloudSchemaMigrations
} from "../src/index.js";

const schemaSqlSha256 =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

describe("createPostgresRestorePitrPlan", () => {
  it("creates backup restore validation plans with RPO and RTO evidence", () => {
    const plan = createPostgresRestorePitrPlan({
      mode: "backup-restore",
      sourceEnvironment: "production",
      isolatedTargetEnvironment: "restore-drill-2026-06-22",
      requestedAt: "2026-06-22T12:00:00.000Z",
      recoverySourceAt: "2026-06-22T00:00:00.000Z",
      restoreStartedAt: "2026-06-22T12:15:00.000Z",
      restoreCompletedAt: "2026-06-22T13:00:00.000Z",
      validationCompletedAt: "2026-06-22T14:00:00.000Z",
      schemaSqlSha256,
      migrationLedger: createCurrentCloudSchemaMigrations()
    });

    expect(plan).toEqual(
      expect.objectContaining({
        mode: "backup-restore",
        sourceEnvironment: "production",
        isolatedTargetEnvironment: "restore-drill-2026-06-22",
        rpoHours: 12,
        rtoHours: 1.75,
        rpoWithinTarget: true,
        rtoWithinTarget: true
      })
    );
    expect(plan.migrationLedger.map((entry) => entry.id)).toEqual([
      "cloud-persistence-schema-v1",
      "cloud-crawl-execution-metadata-v1"
    ]);
    expect(plan.validationSteps).toContain(
      "verify deleted tenants remain excluded from active service after restore"
    );
  });

  it("creates point-in-time recovery validation plans", () => {
    const plan = createPostgresRestorePitrPlan({
      mode: "point-in-time-recovery",
      sourceEnvironment: "production",
      isolatedTargetEnvironment: "pitr-drill-2026-06-22",
      requestedAt: "2026-06-22T12:00:00.000Z",
      recoverySourceAt: "2026-06-22T11:55:00.000Z",
      restoreStartedAt: "2026-06-22T12:05:00.000Z",
      restoreCompletedAt: "2026-06-22T13:05:00.000Z",
      validationCompletedAt: "2026-06-22T14:30:00.000Z",
      schemaSqlSha256,
      migrationLedger: createCurrentCloudSchemaMigrations()
    });

    expect(plan.mode).toBe("point-in-time-recovery");
    expect(plan.rpoHours).toBe(5 / 60);
    expect(plan.rtoHours).toBe(2.4166666666666665);
    expect(plan.rpoWithinTarget).toBe(true);
    expect(plan.rtoWithinTarget).toBe(true);
  });

  it("rejects invalid restore evidence before a drill can be recorded", () => {
    expect(() =>
      createPostgresRestorePitrPlan({
        mode: "backup-restore",
        sourceEnvironment: "production",
        isolatedTargetEnvironment: "production",
        requestedAt: "2026-06-22T12:00:00.000Z",
        recoverySourceAt: "2026-06-22T00:00:00.000Z",
        restoreStartedAt: "2026-06-22T12:15:00.000Z",
        restoreCompletedAt: "2026-06-22T13:00:00.000Z",
        validationCompletedAt: "2026-06-22T14:00:00.000Z",
        schemaSqlSha256,
        migrationLedger: createCurrentCloudSchemaMigrations()
      })
    ).toThrow(
      "PostgreSQL restore target must be isolated from the source environment."
    );

    expect(() =>
      createPostgresRestorePitrPlan({
        mode: "point-in-time-recovery",
        sourceEnvironment: "production",
        isolatedTargetEnvironment: "pitr-drill",
        requestedAt: "2026-06-22T12:00:00.000Z",
        recoverySourceAt: "2026-06-22T12:01:00.000Z",
        restoreStartedAt: "2026-06-22T12:15:00.000Z",
        restoreCompletedAt: "2026-06-22T13:00:00.000Z",
        validationCompletedAt: "2026-06-22T14:00:00.000Z",
        schemaSqlSha256,
        migrationLedger: createCurrentCloudSchemaMigrations()
      })
    ).toThrow("PostgreSQL recovery source cannot be after requestedAt.");

    expect(() =>
      createPostgresRestorePitrPlan({
        mode: "backup-restore",
        sourceEnvironment: "production",
        isolatedTargetEnvironment: "restore-drill",
        requestedAt: "2026-06-22T12:00:00.000Z",
        recoverySourceAt: "2026-06-22T00:00:00.000Z",
        restoreStartedAt: "2026-06-22T12:15:00.000Z",
        restoreCompletedAt: "2026-06-22T13:00:00.000Z",
        validationCompletedAt: "2026-06-22T14:00:00.000Z",
        schemaSqlSha256: "not-a-sha",
        migrationLedger: createCurrentCloudSchemaMigrations()
      })
    ).toThrow("schemaSqlSha256 must be a lowercase sha256 digest.");
  });
});
