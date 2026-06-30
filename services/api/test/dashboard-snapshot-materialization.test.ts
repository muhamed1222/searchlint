import { describe, expect, it } from "vitest";

import { createDashboardSnapshotPayload } from "../src/index.js";
import type {
  CreateDashboardSnapshotPayloadInput,
  DashboardSnapshotDiagnostic
} from "../src/index.js";

describe("createDashboardSnapshotPayload", () => {
  it("creates deterministic dashboard payloads and derives diagnostic trends", () => {
    const payload = createDashboardSnapshotPayload({
      ...baseInput(),
      diagnostics: [
        diagnostic({
          id: "diagnostic-warning",
          ruleId: "SL-WARN-001",
          severity: "warning",
          observedAt: "2026-06-20T12:00:00.000Z",
          fingerprint: "fingerprint-warning"
        }),
        diagnostic({
          id: "diagnostic-blocker",
          ruleId: "SL-BLOCK-001",
          severity: "blocker",
          observedAt: "2026-06-21T12:00:00.000Z",
          fingerprint: "fingerprint-blocker"
        }),
        diagnostic({
          id: "diagnostic-error",
          ruleId: "SL-ERR-001",
          severity: "error",
          observedAt: "2026-06-21T13:00:00.000Z",
          fingerprint: "fingerprint-error"
        })
      ],
      crawlRuns: [
        {
          id: "crawl-old",
          status: "succeeded",
          requestedAt: "2026-06-20T00:00:00.000Z",
          finishedAt: "2026-06-20T00:05:00.000Z",
          crawledUrls: 10,
          failedUrls: 1
        },
        {
          id: "crawl-new",
          status: "running",
          requestedAt: "2026-06-21T00:00:00.000Z",
          crawledUrls: 4,
          failedUrls: 0
        }
      ],
      externalObservations: [
        {
          id: "yandex-1",
          provider: "yandex",
          subjectUrl: "https://example.test/about",
          status: "stale",
          observedAt: "2026-06-20T00:00:00.000Z",
          fetchedAt: "2026-06-20T00:01:00.000Z",
          summary: "Yandex observation is stale."
        },
        {
          id: "google-1",
          provider: "google",
          subjectUrl: "https://example.test/",
          status: "fresh",
          observedAt: "2026-06-21T00:00:00.000Z",
          fetchedAt: "2026-06-21T00:01:00.000Z",
          summary: "Google observation is fresh."
        }
      ],
      reports: [
        {
          id: "report-old",
          title: "Old report",
          generatedAt: "2026-06-19T00:00:00.000Z",
          locale: "en",
          totalDiagnostics: 5
        },
        {
          id: "report-new",
          title: "New report",
          generatedAt: "2026-06-21T00:00:00.000Z",
          locale: "en",
          totalDiagnostics: 3
        }
      ],
      quotas: [
        {
          label: "External API inspections",
          used: 10,
          limit: 100
        },
        {
          label: "Crawled URLs",
          used: 50,
          limit: 1000
        }
      ],
      teamMembers: [
        {
          principalId: "principal-viewer",
          displayName: "Viewer",
          role: "viewer"
        },
        {
          principalId: "principal-owner",
          displayName: "Owner",
          role: "owner"
        }
      ]
    });

    expect(payload).toMatchObject({
      organization: {
        id: "org-1",
        name: "Acme"
      },
      project: {
        id: "project-1",
        name: "Marketing",
        siteUrl: "https://example.test"
      },
      environment: {
        id: "env-1",
        name: "Production",
        baseUrl: "https://example.test"
      }
    });
    expect(arrayField(payload, "diagnostics").map((item) => item.id)).toEqual([
      "diagnostic-blocker",
      "diagnostic-error",
      "diagnostic-warning"
    ]);
    expect(arrayField(payload, "crawlRuns").map((item) => item.id)).toEqual([
      "crawl-new",
      "crawl-old"
    ]);
    expect(arrayField(payload, "trends")).toEqual([
      {
        date: "2026-06-20",
        diagnostics: 1,
        blockers: 0,
        errors: 0,
        warnings: 1,
        infos: 0
      },
      {
        date: "2026-06-21",
        diagnostics: 2,
        blockers: 1,
        errors: 1,
        warnings: 0,
        infos: 0
      }
    ]);
    expect(
      arrayField(payload, "externalObservations").map((item) => item.id)
    ).toEqual(["google-1", "yandex-1"]);
    expect(arrayField(payload, "reports").map((item) => item.id)).toEqual([
      "report-new",
      "report-old"
    ]);
    expect(arrayField(payload, "quotas").map((item) => item.label)).toEqual([
      "Crawled URLs",
      "External API inspections"
    ]);
    expect(arrayField(payload, "teamMembers").map((item) => item.role)).toEqual(
      ["owner", "viewer"]
    );
  });

  it("uses explicit trend points when historical trends are supplied", () => {
    const payload = createDashboardSnapshotPayload({
      ...baseInput(),
      diagnostics: [
        diagnostic({
          severity: "blocker",
          observedAt: "2026-06-21T00:00:00.000Z"
        })
      ],
      trends: [
        {
          date: "2026-06-01",
          diagnostics: 7,
          blockers: 1,
          errors: 2,
          warnings: 3,
          infos: 1
        }
      ]
    });

    expect(arrayField(payload, "trends")).toEqual([
      {
        date: "2026-06-01",
        diagnostics: 7,
        blockers: 1,
        errors: 2,
        warnings: 3,
        infos: 1
      }
    ]);
  });

  it("rejects invalid numeric counters", () => {
    expect(() =>
      createDashboardSnapshotPayload({
        ...baseInput(),
        quotas: [
          {
            label: "Crawled URLs",
            used: -1,
            limit: 100
          }
        ]
      })
    ).toThrow("Expected quotas.used to be a non-negative integer.");
  });
});

function baseInput(): CreateDashboardSnapshotPayloadInput {
  return {
    organization: {
      id: "org-1",
      name: "Acme"
    },
    project: {
      id: "project-1",
      name: "Marketing",
      siteUrl: "https://example.test"
    },
    environment: {
      id: "env-1",
      name: "Production",
      baseUrl: "https://example.test"
    }
  };
}

function diagnostic(
  overrides: Partial<DashboardSnapshotDiagnostic> = {}
): DashboardSnapshotDiagnostic {
  return {
    id: "diagnostic-1",
    ruleId: "SL-TEST-001",
    severity: "info",
    confidence: "certain",
    pageUrl: "https://example.test/",
    source: "crawler",
    title: "Diagnostic",
    evidence: "Evidence",
    observedAt: "2026-06-21T00:00:00.000Z",
    fingerprint: "fingerprint-1",
    ...overrides
  };
}

function arrayField(
  payload: Readonly<Record<string, unknown>>,
  field: string
): Array<Record<string, unknown>> {
  const value = payload[field];
  if (!Array.isArray(value)) {
    throw new Error(`${field} must be an array.`);
  }
  return value as Array<Record<string, unknown>>;
}
