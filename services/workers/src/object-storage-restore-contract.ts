import { parseS3ArtifactUri } from "./s3-report-artifact-store.js";

export type ObjectStorageRestoreScope = {
  organizationId: string;
  projectId: string;
  environmentId: string;
};

export type ObjectStorageRestorePlanInput = {
  artifactUri: string;
  artifactType: "crawl-result" | "report";
  scope: ObjectStorageRestoreScope;
  expectedByteSize: number;
  expectedSha256: string;
  requestedAt: string;
};

export type ObjectStorageRestorePlan = {
  artifactUri: string;
  artifactType: "crawl-result" | "report";
  bucket: string;
  key: string;
  scope: ObjectStorageRestoreScope;
  expectedByteSize: number;
  expectedSha256: string;
  requestedAt: string;
  validationSteps: readonly string[];
};

export function createObjectStorageRestorePlan(
  input: ObjectStorageRestorePlanInput
): ObjectStorageRestorePlan {
  validateRestorePlanInput(input);
  const target = parseS3ArtifactUri(input.artifactUri);
  return {
    artifactUri: input.artifactUri,
    artifactType: input.artifactType,
    bucket: target.bucket,
    key: target.key,
    scope: input.scope,
    expectedByteSize: input.expectedByteSize,
    expectedSha256: input.expectedSha256,
    requestedAt: input.requestedAt,
    validationSteps: [
      "download object from isolated restore target",
      "verify byte size equals expectedByteSize",
      "verify SHA-256 digest equals expectedSha256",
      "verify restored object tenant scope matches organization/project/environment",
      "verify deleted artifacts are not restored into active service"
    ]
  };
}

function validateRestorePlanInput(input: ObjectStorageRestorePlanInput): void {
  if (!Number.isInteger(input.expectedByteSize) || input.expectedByteSize < 1) {
    throw new Error(
      "Restore plan expected byte size must be a positive integer."
    );
  }
  if (!/^[a-f0-9]{64}$/u.test(input.expectedSha256)) {
    throw new Error(
      "Restore plan expected SHA-256 must be a lowercase hex digest."
    );
  }
  for (const [name, value] of Object.entries(input.scope)) {
    if (value.trim().length === 0) {
      throw new Error(`Restore plan ${name} is required.`);
    }
  }
  if (Number.isNaN(Date.parse(input.requestedAt))) {
    throw new Error("Restore plan requestedAt must be an ISO timestamp.");
  }
}
