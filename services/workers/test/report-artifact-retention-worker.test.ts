import { describe, expect, it } from "vitest";

import { deleteExpiredReportArtifacts } from "../src/index.js";
import type { ReportArtifact, ReportRetentionStore } from "@searchlint/api";
import type { ReportArtifactObjectStore } from "../src/index.js";

const now = "2026-09-20T00:00:00.000Z";

describe("deleteExpiredReportArtifacts", () => {
  it("deletes leased report artifact payloads before marking metadata deleted", async () => {
    const harness = createHarness({
      expired: [reportArtifact()]
    });

    await expect(
      deleteExpiredReportArtifacts({
        store: harness.store,
        objectStore: harness.objectStore,
        now,
        limit: 10
      })
    ).resolves.toEqual({
      selected: 1,
      leased: 1,
      deleted: 1,
      failed: 0,
      skipped: 0
    });

    expect(harness.events).toEqual([
      "select:2026-09-20T00:00:00.000Z:10",
      "lease:report-1",
      "object-delete:s3://searchlint-reports/org-1/report-1.html",
      "metadata-deleted:report-1"
    ]);
  });

  it("marks metadata deleted without object calls when artifact URI is absent", async () => {
    const artifact = reportArtifact();
    delete artifact.artifactUri;
    const harness = createHarness({
      expired: [artifact]
    });

    await expect(
      deleteExpiredReportArtifacts({
        store: harness.store,
        objectStore: harness.objectStore,
        now,
        limit: 10
      })
    ).resolves.toEqual({
      selected: 1,
      leased: 1,
      deleted: 1,
      failed: 0,
      skipped: 0
    });

    expect(harness.events).toEqual([
      "select:2026-09-20T00:00:00.000Z:10",
      "lease:report-1",
      "metadata-deleted:report-1"
    ]);
  });

  it("skips rows that cannot be leased", async () => {
    const harness = createHarness({
      expired: [reportArtifact()],
      leaseMissing: true
    });

    await expect(
      deleteExpiredReportArtifacts({
        store: harness.store,
        objectStore: harness.objectStore,
        now,
        limit: 10
      })
    ).resolves.toEqual({
      selected: 1,
      leased: 0,
      deleted: 0,
      failed: 0,
      skipped: 1
    });

    expect(harness.events).toEqual([
      "select:2026-09-20T00:00:00.000Z:10",
      "lease:report-1"
    ]);
  });

  it("returns leased rows to active when object deletion fails", async () => {
    const harness = createHarness({
      expired: [reportArtifact()],
      deleteError: new Error("S3 delete failed")
    });

    await expect(
      deleteExpiredReportArtifacts({
        store: harness.store,
        objectStore: harness.objectStore,
        now,
        limit: 10
      })
    ).resolves.toEqual({
      selected: 1,
      leased: 1,
      deleted: 0,
      failed: 1,
      skipped: 0
    });

    expect(harness.events).toEqual([
      "select:2026-09-20T00:00:00.000Z:10",
      "lease:report-1",
      "object-delete:s3://searchlint-reports/org-1/report-1.html",
      "metadata-active:report-1"
    ]);
  });

  it("rejects invalid limits before querying", async () => {
    const harness = createHarness({
      expired: []
    });

    await expect(
      deleteExpiredReportArtifacts({
        store: harness.store,
        objectStore: harness.objectStore,
        now,
        limit: 0
      })
    ).rejects.toThrow("Report artifact deletion limit must be positive.");
    expect(harness.events).toEqual([]);
  });
});

function createHarness(options: {
  expired: readonly ReportArtifact[];
  leaseMissing?: boolean;
  deleteError?: Error;
}) {
  const events: string[] = [];
  const store: ReportRetentionStore = {
    async insertReportArtifact(input) {
      return input;
    },
    async selectExpiredReportArtifacts(input) {
      events.push(`select:${input.now}:${input.limit}`);
      return options.expired;
    },
    async markReportArtifactDeleting(input) {
      events.push(`lease:${input.id}`);
      if (options.leaseMissing) {
        return undefined;
      }
      const selected =
        options.expired.find((artifact) => artifact.id === input.id) ??
        reportArtifact();
      return {
        ...selected,
        id: input.id,
        organizationId: input.organizationId,
        deletionState: "deleting"
      };
    },
    async markReportArtifactDeleted(input) {
      events.push(`metadata-deleted:${input.id}`);
      const artifact: ReportArtifact = {
        ...reportArtifact(),
        id: input.id,
        organizationId: input.organizationId,
        deletionState: "deleted"
      };
      delete artifact.artifactUri;
      return artifact;
    },
    async markReportArtifactDeletionFailed(input) {
      events.push(`metadata-active:${input.id}`);
      return {
        ...reportArtifact(),
        id: input.id,
        organizationId: input.organizationId,
        deletionState: "active"
      };
    }
  };
  const objectStore: ReportArtifactObjectStore = {
    async deleteReportArtifact(input) {
      events.push(`object-delete:${input.artifactUri}`);
      if (options.deleteError) {
        throw options.deleteError;
      }
    }
  };

  return {
    events,
    objectStore,
    store
  };
}

function reportArtifact(): ReportArtifact {
  return {
    id: "report-1",
    organizationId: "org-1",
    projectId: "project-1",
    environmentId: "env-1",
    reportKind: "html",
    artifactUri: "s3://searchlint-reports/org-1/report-1.html",
    pinned: false,
    generatedAt: "2026-06-21T00:00:00.000Z",
    retentionUntil: "2026-09-19T00:00:00.000Z",
    deletionState: "active",
    createdAt: "2026-06-21T00:00:00.000Z"
  };
}
