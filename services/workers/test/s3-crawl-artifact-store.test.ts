import { PutObjectCommand } from "@aws-sdk/client-s3";
import type { PutObjectCommandOutput } from "@aws-sdk/client-s3";
import { describe, expect, it } from "vitest";

import { createS3CrawlArtifactStore } from "../src/index.js";
import type { S3PutObjectClient } from "../src/index.js";
import type { CrawlJobPayload } from "@searchlint/api";

describe("createS3CrawlArtifactStore", () => {
  it("stores crawl result artifacts as deterministic JSON objects", async () => {
    const harness = createHarness();
    const store = createS3CrawlArtifactStore({
      client: harness.client,
      bucket: " searchlint-artifacts ",
      keyPrefix: "/prod/"
    });

    await expect(store.putCrawlResult(crawlArtifact())).resolves.toEqual({
      artifactUri:
        "s3://searchlint-artifacts/prod/organizations/org-1/projects/project-1/environments/env-1/crawls/crawl-1/result.json",
      byteSize: JSON.stringify(crawlArtifact()).length,
      sha256: "767ad9095c85f1c359bf3d811796b904f5f1a58c23e7c7ad82a2678e07a02b5e"
    });

    expect(harness.commands).toHaveLength(1);
    expect(harness.commands[0]?.input).toEqual({
      Bucket: "searchlint-artifacts",
      Key: "prod/organizations/org-1/projects/project-1/environments/env-1/crawls/crawl-1/result.json",
      Body: JSON.stringify(crawlArtifact()),
      ContentType: "application/json",
      ContentLength: JSON.stringify(crawlArtifact()).length,
      Metadata: {
        "searchlint-byte-size": String(JSON.stringify(crawlArtifact()).length),
        "searchlint-sha256":
          "767ad9095c85f1c359bf3d811796b904f5f1a58c23e7c7ad82a2678e07a02b5e"
      }
    });
  });

  it("stores large crawl artifacts with byte size and SHA-256 metadata", async () => {
    const harness = createHarness();
    const store = createS3CrawlArtifactStore({
      client: harness.client,
      bucket: "searchlint-artifacts",
      keyPrefix: "prod"
    });
    const artifact = crawlArtifact({
      maxUrls: 1000
    });
    (artifact.result as { pages: unknown[] }).pages = Array.from(
      { length: 1500 },
      (_, index) => ({
        url: `https://example.com/page-${index}`,
        status: 200,
        finalUrl: `https://example.com/page-${index}`,
        title: `Large page ${index}`,
        meta: {
          description: "x".repeat(200)
        },
        headings: [{ level: 1, text: `Page ${index}` }],
        links: [],
        images: [],
        canonical: `https://example.com/page-${index}`,
        rawHtml: "<html></html>",
        renderedHtml: "<html></html>",
        headers: {}
      })
    );

    const result = await store.putCrawlResult(artifact);
    const body = String(harness.commands[0]?.input.Body);

    expect(result.byteSize).toBeGreaterThan(500_000);
    expect(result.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(harness.commands[0]?.input.ContentLength).toBe(result.byteSize);
    expect(harness.commands[0]?.input.Metadata).toEqual({
      "searchlint-byte-size": String(result.byteSize),
      "searchlint-sha256": result.sha256
    });
    expect(Buffer.byteLength(body, "utf8")).toBe(result.byteSize);
  });

  it("encodes tenant identifiers in object keys", async () => {
    const harness = createHarness();
    const store = createS3CrawlArtifactStore({
      client: harness.client,
      bucket: "searchlint-artifacts"
    });

    await store.putCrawlResult(
      crawlArtifact({
        organizationId: "org/one",
        projectId: "project one",
        environmentId: "env#1",
        crawlRequestId: "crawl?1"
      })
    );

    expect(harness.commands[0]?.input.Key).toBe(
      "organizations/org%2Fone/projects/project%20one/environments/env%231/crawls/crawl%3F1/result.json"
    );
  });

  it("rejects empty buckets before sending", () => {
    const harness = createHarness();

    expect(() =>
      createS3CrawlArtifactStore({
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
    const store = createS3CrawlArtifactStore({
      client: harness.client,
      bucket: "searchlint-artifacts"
    });

    await expect(store.putCrawlResult(crawlArtifact())).rejects.toThrow(
      "S3 put failed"
    );
    expect(harness.commands).toHaveLength(1);
  });
});

function crawlArtifact(payloadOverrides: Partial<CrawlJobPayload> = {}) {
  return {
    schemaVersion: 1 as const,
    type: "crawl.result" as const,
    payload: {
      crawlRequestId: "crawl-1",
      organizationId: "org-1",
      projectId: "project-1",
      environmentId: "env-1",
      maxUrls: 5,
      ...payloadOverrides
    },
    target: {
      startUrl: "https://example.com/"
    },
    result: {
      startUrl: "https://example.com/",
      pages: [],
      skipped: []
    },
    completedAt: "2026-06-21T00:00:01.000Z"
  };
}

function createHarness(options: { sendError?: Error } = {}) {
  const commands: PutObjectCommand[] = [];
  const client: S3PutObjectClient = {
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
