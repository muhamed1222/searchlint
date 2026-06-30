import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import type { DeleteObjectCommandOutput } from "@aws-sdk/client-s3";
import { describe, expect, it } from "vitest";

import {
  createReportArtifactSignedUrlService,
  createS3ReportArtifactObjectStore,
  parseS3ArtifactUri
} from "../src/index.js";
import type {
  ReportArtifactSignedUrlPresigner,
  S3DeleteObjectClient
} from "../src/index.js";

describe("createS3ReportArtifactObjectStore", () => {
  it("deletes report artifact objects from s3 URIs", async () => {
    const harness = createHarness();
    const store = createS3ReportArtifactObjectStore({
      client: harness.client
    });

    await expect(
      store.deleteReportArtifact({
        artifactUri: "s3://searchlint-reports/org-1/reports/report-1.html"
      })
    ).resolves.toBeUndefined();

    expect(harness.commands).toHaveLength(1);
    expect(harness.commands[0]?.input).toEqual({
      Bucket: "searchlint-reports",
      Key: "org-1/reports/report-1.html"
    });
  });

  it("parses valid s3 artifact URIs", () => {
    expect(parseS3ArtifactUri("s3://bucket/path/to/report.html")).toEqual({
      bucket: "bucket",
      key: "path/to/report.html"
    });
  });

  it("rejects non-s3 and incomplete artifact URIs before sending", async () => {
    const harness = createHarness();
    const store = createS3ReportArtifactObjectStore({
      client: harness.client
    });

    await expect(
      store.deleteReportArtifact({ artifactUri: "https://bucket/key" })
    ).rejects.toThrow("Report artifact URI must use the s3:// scheme.");
    await expect(
      store.deleteReportArtifact({ artifactUri: "s3://bucket" })
    ).rejects.toThrow("Report artifact URI must include an S3 object key.");
    await expect(
      store.deleteReportArtifact({ artifactUri: "not a uri" })
    ).rejects.toThrow("Report artifact URI must be a valid s3:// URI.");
    expect(harness.commands).toEqual([]);
  });

  it("propagates S3 delete failures", async () => {
    const harness = createHarness({
      sendError: new Error("S3 delete failed")
    });
    const store = createS3ReportArtifactObjectStore({
      client: harness.client
    });

    await expect(
      store.deleteReportArtifact({
        artifactUri: "s3://searchlint-reports/org-1/reports/report-1.html"
      })
    ).rejects.toThrow("S3 delete failed");
    expect(harness.commands).toHaveLength(1);
  });
});

describe("createReportArtifactSignedUrlService", () => {
  it("creates signed URLs only after matching report artifact scope", async () => {
    const presigner = new FakePresigner();
    const service = createReportArtifactSignedUrlService({
      presigner,
      maxTtlSeconds: 300
    });

    await expect(
      service.createSignedUrl({
        request: requestScope(),
        artifact: artifactMetadata(),
        ttlSeconds: 120,
        now: "2026-06-22T10:00:00.000Z"
      })
    ).resolves.toEqual({
      url: "https://signed.example.test/report?X-Amz-Signature=secret",
      expiresAt: "2026-06-22T10:02:00.000Z",
      audit: {
        artifactId: "report-1",
        organizationId: "org-1",
        projectId: "project-1",
        environmentId: "env-1",
        principalId: "principal-1",
        s3Bucket: "searchlint-reports",
        s3KeyFingerprint:
          "033e724460d953d7f1d743409ee863c489fee345d9b2282844041fe8ba86457a",
        ttlSeconds: 120
      }
    });
    expect(presigner.requests).toEqual([
      {
        bucket: "searchlint-reports",
        key: "org-1/projects/project-1/reports/report-1.html",
        expiresInSeconds: 120
      }
    ]);
  });

  it("rejects cross-scope report artifacts before presigning", async () => {
    const presigner = new FakePresigner();
    const service = createReportArtifactSignedUrlService({
      presigner
    });

    await expect(
      service.createSignedUrl({
        request: requestScope(),
        artifact: { ...artifactMetadata(), organizationId: "org-2" },
        ttlSeconds: 60,
        now: "2026-06-22T10:00:00.000Z"
      })
    ).rejects.toThrow("Report artifact organization scope mismatch.");
    await expect(
      service.createSignedUrl({
        request: requestScope(),
        artifact: { ...artifactMetadata(), projectId: "project-2" },
        ttlSeconds: 60,
        now: "2026-06-22T10:00:00.000Z"
      })
    ).rejects.toThrow("Report artifact project scope mismatch.");
    await expect(
      service.createSignedUrl({
        request: requestScope(),
        artifact: { ...artifactMetadata(), environmentId: "env-2" },
        ttlSeconds: 60,
        now: "2026-06-22T10:00:00.000Z"
      })
    ).rejects.toThrow("Report artifact environment scope mismatch.");
    expect(presigner.requests).toEqual([]);
  });

  it("rejects deleted or expired artifacts before presigning", async () => {
    const presigner = new FakePresigner();
    const service = createReportArtifactSignedUrlService({
      presigner
    });

    await expect(
      service.createSignedUrl({
        request: requestScope(),
        artifact: { ...artifactMetadata(), deletionState: "deleted" },
        ttlSeconds: 60,
        now: "2026-06-22T10:00:00.000Z"
      })
    ).rejects.toThrow("Report artifact is not active.");
    await expect(
      service.createSignedUrl({
        request: requestScope(),
        artifact: {
          ...artifactMetadata(),
          expiresAt: "2026-06-22T09:59:59.000Z"
        },
        ttlSeconds: 60,
        now: "2026-06-22T10:00:00.000Z"
      })
    ).rejects.toThrow("Report artifact is expired.");
    expect(presigner.requests).toEqual([]);
  });

  it("enforces short positive TTL and keeps audit data free of signed URL secrets", async () => {
    const service = createReportArtifactSignedUrlService({
      presigner: new FakePresigner(),
      maxTtlSeconds: 300
    });

    await expect(
      service.createSignedUrl({
        request: requestScope(),
        artifact: artifactMetadata(),
        ttlSeconds: 0,
        now: "2026-06-22T10:00:00.000Z"
      })
    ).rejects.toThrow("Signed URL TTL must be a positive integer.");
    await expect(
      service.createSignedUrl({
        request: requestScope(),
        artifact: artifactMetadata(),
        ttlSeconds: 301,
        now: "2026-06-22T10:00:00.000Z"
      })
    ).rejects.toThrow("Signed URL TTL exceeds the configured maximum.");

    const result = await service.createSignedUrl({
      request: requestScope(),
      artifact: artifactMetadata(),
      ttlSeconds: 300,
      now: "2026-06-22T10:00:00.000Z"
    });

    expect(JSON.stringify(result.audit)).not.toContain("X-Amz-Signature");
    expect(JSON.stringify(result.audit)).not.toContain("secret");
    expect(result.url).toContain("X-Amz-Signature");
  });
});

function createHarness(options: { sendError?: Error } = {}) {
  const commands: DeleteObjectCommand[] = [];
  const client: S3DeleteObjectClient = {
    async send(command) {
      if (!(command instanceof DeleteObjectCommand)) {
        throw new Error("Expected DeleteObjectCommand.");
      }
      commands.push(command);
      if (options.sendError) {
        throw options.sendError;
      }
      return {
        $metadata: {}
      } satisfies DeleteObjectCommandOutput;
    }
  };

  return {
    client,
    commands
  };
}

function requestScope() {
  return {
    organizationId: "org-1",
    projectId: "project-1",
    environmentId: "env-1",
    principalId: "principal-1"
  };
}

function artifactMetadata() {
  return {
    id: "report-1",
    organizationId: "org-1",
    projectId: "project-1",
    environmentId: "env-1",
    artifactUri:
      "s3://searchlint-reports/org-1/projects/project-1/reports/report-1.html",
    deletionState: "active" as const,
    expiresAt: "2026-06-22T11:00:00.000Z"
  };
}

class FakePresigner implements ReportArtifactSignedUrlPresigner {
  readonly requests: Array<{
    bucket: string;
    key: string;
    expiresInSeconds: number;
  }> = [];

  async createSignedGetUrl(input: {
    bucket: string;
    key: string;
    expiresInSeconds: number;
  }): Promise<string> {
    this.requests.push(input);
    return "https://signed.example.test/report?X-Amz-Signature=secret";
  }
}
