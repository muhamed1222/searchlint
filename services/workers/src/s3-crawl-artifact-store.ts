import {
  PutObjectCommand,
  type PutObjectCommandOutput,
  type S3Client
} from "@aws-sdk/client-s3";
import { createHash } from "node:crypto";

import type { CloudCrawlArtifactStore } from "./crawler-execution-worker.js";

export type S3PutObjectClient = Pick<S3Client, "send">;

export type S3CrawlArtifactStoreOptions = {
  client: S3PutObjectClient;
  bucket: string;
  keyPrefix?: string;
};

export function createS3CrawlArtifactStore(
  options: S3CrawlArtifactStoreOptions
): CloudCrawlArtifactStore {
  const config = validateOptions(options);
  return {
    async putCrawlResult(artifact) {
      const key = crawlResultKey(config.keyPrefix, artifact.payload);
      const body = JSON.stringify(artifact);
      const byteSize = Buffer.byteLength(body, "utf8");
      const sha256 = sha256Hex(body);
      await config.client.send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: key,
          Body: body,
          ContentType: "application/json",
          ContentLength: byteSize,
          Metadata: {
            "searchlint-sha256": sha256,
            "searchlint-byte-size": String(byteSize)
          }
        })
      );
      return {
        artifactUri: `s3://${config.bucket}/${key}`,
        byteSize,
        sha256
      };
    }
  };
}

function crawlResultKey(
  keyPrefix: string | undefined,
  payload: {
    organizationId: string;
    projectId: string;
    environmentId: string;
    crawlRequestId: string;
  }
): string {
  return [
    keyPrefix,
    "organizations",
    pathSegment(payload.organizationId),
    "projects",
    pathSegment(payload.projectId),
    "environments",
    pathSegment(payload.environmentId),
    "crawls",
    pathSegment(payload.crawlRequestId),
    "result.json"
  ]
    .filter((part): part is string => part !== undefined && part.length > 0)
    .join("/");
}

function pathSegment(value: string): string {
  return encodeURIComponent(value);
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

type ValidS3Options = {
  client: {
    send(command: PutObjectCommand): Promise<PutObjectCommandOutput>;
  };
  bucket: string;
  keyPrefix?: string;
};

function validateOptions(options: S3CrawlArtifactStoreOptions): ValidS3Options {
  const bucket = options.bucket.trim();
  if (bucket.length === 0) {
    throw new Error("S3 artifact bucket is required.");
  }

  const keyPrefix = options.keyPrefix
    ?.trim()
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");

  return {
    client: options.client,
    bucket,
    ...(keyPrefix === undefined || keyPrefix.length === 0 ? {} : { keyPrefix })
  };
}
