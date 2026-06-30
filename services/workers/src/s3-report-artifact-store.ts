import {
  DeleteObjectCommand,
  type DeleteObjectCommandOutput,
  type S3Client
} from "@aws-sdk/client-s3";
import { createHash } from "node:crypto";

import type { ReportArtifactObjectStore } from "./report-artifact-retention-worker.js";

export type S3DeleteObjectClient = Pick<S3Client, "send">;

export type S3ReportArtifactStoreOptions = {
  client: S3DeleteObjectClient;
};

export type ReportArtifactSignedUrlPresigner = {
  createSignedGetUrl(input: {
    bucket: string;
    key: string;
    expiresInSeconds: number;
  }): Promise<string>;
};

export type ReportArtifactSignedUrlMetadata = {
  id: string;
  organizationId: string;
  projectId: string;
  environmentId: string;
  artifactUri: string;
  deletionState: "active" | "deleting" | "deleted";
  expiresAt?: string;
};

export type CreateReportArtifactSignedUrlInput = {
  request: {
    organizationId: string;
    projectId: string;
    environmentId: string;
    principalId: string;
  };
  artifact: ReportArtifactSignedUrlMetadata;
  ttlSeconds: number;
  now: string;
};

export type ReportArtifactSignedUrlResult = {
  url: string;
  expiresAt: string;
  audit: {
    artifactId: string;
    organizationId: string;
    projectId: string;
    environmentId: string;
    principalId: string;
    s3Bucket: string;
    s3KeyFingerprint: string;
    ttlSeconds: number;
  };
};

export type ReportArtifactSignedUrlServiceOptions = {
  presigner: ReportArtifactSignedUrlPresigner;
  maxTtlSeconds?: number;
};

export function createS3ReportArtifactObjectStore(
  options: S3ReportArtifactStoreOptions
): ReportArtifactObjectStore {
  return {
    async deleteReportArtifact(input) {
      const target = parseS3ArtifactUri(input.artifactUri);
      await options.client.send(
        new DeleteObjectCommand({
          Bucket: target.bucket,
          Key: target.key
        })
      );
    }
  };
}

export function createReportArtifactSignedUrlService(
  options: ReportArtifactSignedUrlServiceOptions
): {
  createSignedUrl(
    input: CreateReportArtifactSignedUrlInput
  ): Promise<ReportArtifactSignedUrlResult>;
} {
  const maxTtlSeconds = options.maxTtlSeconds ?? 900;
  if (!Number.isInteger(maxTtlSeconds) || maxTtlSeconds < 1) {
    throw new Error("Signed URL max TTL must be a positive integer.");
  }

  return {
    async createSignedUrl(input) {
      validateSignedUrlInput(input, maxTtlSeconds);
      const target = parseS3ArtifactUri(input.artifact.artifactUri);
      const url = await options.presigner.createSignedGetUrl({
        bucket: target.bucket,
        key: target.key,
        expiresInSeconds: input.ttlSeconds
      });
      return {
        url,
        expiresAt: new Date(
          Date.parse(input.now) + input.ttlSeconds * 1000
        ).toISOString(),
        audit: {
          artifactId: input.artifact.id,
          organizationId: input.request.organizationId,
          projectId: input.request.projectId,
          environmentId: input.request.environmentId,
          principalId: input.request.principalId,
          s3Bucket: target.bucket,
          s3KeyFingerprint: fingerprintS3Key(target.key),
          ttlSeconds: input.ttlSeconds
        }
      };
    }
  };
}

export function parseS3ArtifactUri(uri: string): {
  bucket: string;
  key: string;
} {
  let parsed: URL;
  try {
    parsed = new URL(uri);
  } catch {
    throw new Error("Report artifact URI must be a valid s3:// URI.");
  }

  if (parsed.protocol !== "s3:") {
    throw new Error("Report artifact URI must use the s3:// scheme.");
  }

  const bucket = parsed.hostname.trim();
  const key = parsed.pathname.replace(/^\/+/, "");
  if (bucket.length === 0) {
    throw new Error("Report artifact URI must include an S3 bucket.");
  }
  if (key.length === 0) {
    throw new Error("Report artifact URI must include an S3 object key.");
  }

  return { bucket, key };
}

export type S3DeleteReportArtifactOutput = DeleteObjectCommandOutput;

function validateSignedUrlInput(
  input: CreateReportArtifactSignedUrlInput,
  maxTtlSeconds: number
): void {
  if (!Number.isInteger(input.ttlSeconds) || input.ttlSeconds < 1) {
    throw new Error("Signed URL TTL must be a positive integer.");
  }
  if (input.ttlSeconds > maxTtlSeconds) {
    throw new Error("Signed URL TTL exceeds the configured maximum.");
  }
  if (input.artifact.organizationId !== input.request.organizationId) {
    throw new Error("Report artifact organization scope mismatch.");
  }
  if (input.artifact.projectId !== input.request.projectId) {
    throw new Error("Report artifact project scope mismatch.");
  }
  if (input.artifact.environmentId !== input.request.environmentId) {
    throw new Error("Report artifact environment scope mismatch.");
  }
  if (input.artifact.deletionState !== "active") {
    throw new Error("Report artifact is not active.");
  }
  if (
    input.artifact.expiresAt !== undefined &&
    Date.parse(input.artifact.expiresAt) <= Date.parse(input.now)
  ) {
    throw new Error("Report artifact is expired.");
  }
}

function fingerprintS3Key(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}
