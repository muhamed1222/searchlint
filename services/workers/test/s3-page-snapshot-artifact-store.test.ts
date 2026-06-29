import { PutObjectCommand } from "@aws-sdk/client-s3";
import type { PutObjectCommandOutput } from "@aws-sdk/client-s3";
import type { PageSnapshot } from "@searchlint/core";
import { describe, expect, it } from "vitest";

import { createS3PageSnapshotArtifactStore } from "../src/index.js";
import type { S3PageSnapshotPutObjectClient } from "../src/index.js";

describe("createS3PageSnapshotArtifactStore", () => {
  it("stores page snapshots as deterministic JSON objects", async () => {
    const harness = createHarness();
    const store = createS3PageSnapshotArtifactStore({
      client: harness.client,
      bucket: " searchlint-artifacts ",
      keyPrefix: "/prod/"
    });
    const artifact = pageSnapshotArtifact();

    await expect(store.putPageSnapshot(artifact)).resolves.toEqual({
      artifactUri:
        "s3://searchlint-artifacts/prod/organizations/org-1/projects/project-1/environments/env-1/snapshots/snapshot-1/snapshot.json",
      byteSize: JSON.stringify(artifact).length,
      sha256: "da15a92a00e6815c798f4ef68085ad596cba5d0dc35b5c9c5b536a07d6d4b6af"
    });

    expect(harness.commands).toHaveLength(1);
    expect(harness.commands[0]?.input).toEqual({
      Bucket: "searchlint-artifacts",
      Key: "prod/organizations/org-1/projects/project-1/environments/env-1/snapshots/snapshot-1/snapshot.json",
      Body: JSON.stringify(artifact),
      ContentType: "application/json",
      ContentLength: JSON.stringify(artifact).length,
      Metadata: {
        "searchlint-artifact-type": "page.snapshot",
        "searchlint-byte-size": String(JSON.stringify(artifact).length),
        "searchlint-sha256":
          "da15a92a00e6815c798f4ef68085ad596cba5d0dc35b5c9c5b536a07d6d4b6af"
      }
    });
  });

  it("encodes tenant identifiers and snapshot ids in object keys", async () => {
    const harness = createHarness();
    const store = createS3PageSnapshotArtifactStore({
      client: harness.client,
      bucket: "searchlint-artifacts"
    });

    await store.putPageSnapshot(
      pageSnapshotArtifact({
        organizationId: "org/one",
        projectId: "project one",
        environmentId: "env#1",
        snapshotId: "snapshot?1"
      })
    );

    expect(harness.commands[0]?.input.Key).toBe(
      "organizations/org%2Fone/projects/project%20one/environments/env%231/snapshots/snapshot%3F1/snapshot.json"
    );
  });

  it("rejects empty buckets before sending", () => {
    const harness = createHarness();

    expect(() =>
      createS3PageSnapshotArtifactStore({
        client: harness.client,
        bucket: " "
      })
    ).toThrow("S3 artifact bucket is required.");
    expect(harness.commands).toEqual([]);
  });

  it("propagates S3 put failures", async () => {
    const harness = createHarness({
      sendError: new Error("S3 put failed")
    });
    const store = createS3PageSnapshotArtifactStore({
      client: harness.client,
      bucket: "searchlint-artifacts"
    });

    await expect(store.putPageSnapshot(pageSnapshotArtifact())).rejects.toThrow(
      "S3 put failed"
    );
    expect(harness.commands).toHaveLength(1);
  });
});

function pageSnapshotArtifact(
  overrides: Partial<{
    organizationId: string;
    projectId: string;
    environmentId: string;
    snapshotId: string;
  }> = {}
) {
  return {
    schemaVersion: 1 as const,
    type: "page.snapshot" as const,
    organizationId: "org-1",
    projectId: "project-1",
    environmentId: "env-1",
    snapshotId: "snapshot-1",
    snapshot: pageSnapshot(),
    ...overrides
  };
}

function pageSnapshot(): PageSnapshot {
  return {
    pageUrl: "https://example.com/",
    route: "/",
    capturedAt: "2026-06-23T00:00:00.000Z",
    http: {
      status: 200,
      finalUrl: "https://example.com/",
      headers: {
        "content-type": "text/html"
      }
    },
    rawHtml: "<html><head><title>Example</title></head><body></body></html>",
    renderedDom:
      "<html><head><title>Example</title></head><body><main></main></body></html>"
  };
}

function createHarness(options: { sendError?: Error } = {}) {
  const commands: PutObjectCommand[] = [];
  const client: S3PageSnapshotPutObjectClient = {
    async send(command) {
      if (!(command instanceof PutObjectCommand)) {
        throw new Error("Expected PutObjectCommand.");
      }
      commands.push(command);
      if (options.sendError) {
        throw options.sendError;
      }
      return {
        ETag: "etag-1",
        $metadata: {}
      } satisfies PutObjectCommandOutput;
    }
  };

  return {
    client,
    commands
  };
}
