import { describe, expect, it } from "vitest";

import { createObjectStorageRestorePlan } from "../src/index.js";

describe("createObjectStorageRestorePlan", () => {
  it("creates restore verification plans from s3 artifact metadata", () => {
    expect(
      createObjectStorageRestorePlan({
        artifactUri:
          "s3://searchlint-artifacts/prod/organizations/org-1/projects/project-1/environments/env-1/crawls/crawl-1/result.json",
        artifactType: "crawl-result",
        scope: {
          organizationId: "org-1",
          projectId: "project-1",
          environmentId: "env-1"
        },
        expectedByteSize: 12345,
        expectedSha256:
          "bfda7f68fb7a4acf3c475089bd0710f3ccaaecdb609998de0f20fdd7d48a73bb",
        requestedAt: "2026-06-22T10:00:00.000Z"
      })
    ).toEqual({
      artifactUri:
        "s3://searchlint-artifacts/prod/organizations/org-1/projects/project-1/environments/env-1/crawls/crawl-1/result.json",
      artifactType: "crawl-result",
      bucket: "searchlint-artifacts",
      key: "prod/organizations/org-1/projects/project-1/environments/env-1/crawls/crawl-1/result.json",
      scope: {
        organizationId: "org-1",
        projectId: "project-1",
        environmentId: "env-1"
      },
      expectedByteSize: 12345,
      expectedSha256:
        "bfda7f68fb7a4acf3c475089bd0710f3ccaaecdb609998de0f20fdd7d48a73bb",
      requestedAt: "2026-06-22T10:00:00.000Z",
      validationSteps: [
        "download object from isolated restore target",
        "verify byte size equals expectedByteSize",
        "verify SHA-256 digest equals expectedSha256",
        "verify restored object tenant scope matches organization/project/environment",
        "verify deleted artifacts are not restored into active service"
      ]
    });
  });

  it("rejects invalid restore verification metadata", () => {
    const valid = {
      artifactUri: "s3://bucket/key.json",
      artifactType: "report" as const,
      scope: {
        organizationId: "org-1",
        projectId: "project-1",
        environmentId: "env-1"
      },
      expectedByteSize: 10,
      expectedSha256:
        "bfda7f68fb7a4acf3c475089bd0710f3ccaaecdb609998de0f20fdd7d48a73bb",
      requestedAt: "2026-06-22T10:00:00.000Z"
    };

    expect(() =>
      createObjectStorageRestorePlan({ ...valid, expectedByteSize: 0 })
    ).toThrow("Restore plan expected byte size must be a positive integer.");
    expect(() =>
      createObjectStorageRestorePlan({ ...valid, expectedSha256: "not-sha" })
    ).toThrow("Restore plan expected SHA-256 must be a lowercase hex digest.");
    expect(() =>
      createObjectStorageRestorePlan({
        ...valid,
        scope: { ...valid.scope, organizationId: " " }
      })
    ).toThrow("Restore plan organizationId is required.");
    expect(() =>
      createObjectStorageRestorePlan({ ...valid, requestedAt: "not-a-date" })
    ).toThrow("Restore plan requestedAt must be an ISO timestamp.");
  });
});
