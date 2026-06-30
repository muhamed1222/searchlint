import {
  PutObjectCommand,
  type PutObjectCommandOutput,
  type S3Client
} from "@aws-sdk/client-s3";
import type { PageSnapshot } from "@searchlint/core";
import { createHash } from "node:crypto";

export type S3PageSnapshotPutObjectClient = Pick<S3Client, "send">;

export type PageSnapshotArtifact = {
  schemaVersion: 1;
  type: "page.snapshot";
  organizationId: string;
  projectId: string;
  environmentId: string;
  snapshotId: string;
  snapshot: PageSnapshot;
};

export type PageSnapshotArtifactUploadResult = {
  artifactUri: string;
  byteSize: number;
  sha256: string;
};

export type S3PageSnapshotArtifactStoreOptions = {
  client: S3PageSnapshotPutObjectClient;
  bucket: string;
  keyPrefix?: string;
};

export type S3PageSnapshotArtifactStore = {
  putPageSnapshot(
    artifact: PageSnapshotArtifact
  ): Promise<PageSnapshotArtifactUploadResult>;
};

export function createS3PageSnapshotArtifactStore(
  options: S3PageSnapshotArtifactStoreOptions
): S3PageSnapshotArtifactStore {
  const config = validateOptions(options);
  return {
    async putPageSnapshot(artifact) {
      const key = pageSnapshotKey(config.keyPrefix, artifact);
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
            "searchlint-byte-size": String(byteSize),
            "searchlint-artifact-type": "page.snapshot"
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

function pageSnapshotKey(
  keyPrefix: string | undefined,
  artifact: {
    organizationId: string;
    projectId: string;
    environmentId: string;
    snapshotId: string;
  }
): string {
  return [
    keyPrefix,
    "organizations",
    pathSegment(artifact.organizationId),
    "projects",
    pathSegment(artifact.projectId),
    "environments",
    pathSegment(artifact.environmentId),
    "snapshots",
    pathSegment(artifact.snapshotId),
    "snapshot.json"
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

function validateOptions(
  options: S3PageSnapshotArtifactStoreOptions
): ValidS3Options {
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
