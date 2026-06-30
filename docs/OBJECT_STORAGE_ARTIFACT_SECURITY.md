# Object Storage Artifact Security

This document records the deterministic contract proof for SearchLint object
storage artifact handling. It does not claim a deployed S3 environment or live
runtime proof.

## Deterministic Proof

- Worker tests verify that crawl and report artifact keys are tenant scoped by
  organization, project, and environment identifiers.
- The S3 report artifact store accepts only complete `s3://bucket/key` artifact
  URIs and rejects non-S3 or incomplete locations before sending requests.
- Report artifact deletion is metadata selected and limited to expired report
  artifacts.
- CloudFormation contracts define private artifact buckets, public access block,
  bucket owner enforced object ownership, encryption, versioning, TLS-only
  bucket policies, lifecycle expiration, and access logs.
- Signed URLs are covered at the authorization boundary by local contract tests;
  they are not generated against live AWS in this proof.

## Release Boundaries

The following remain owner-operated runtime gates before production release:

- real S3 upload/download/delete proof for crawl and report artifacts;
- deployed signed URLs with expiration, scope checks, and access denial proof;
- live tenant isolation checks across organizations, projects, and environments;
- review of deployed S3 access logs after real artifact operations;
- restore proof for deleted or versioned artifacts;
- large artifacts and multipart transfer behavior in the deployed bucket.

## Evidence Policy

Do not add synthetic S3 evidence to this repository. Runtime evidence must come
from a deployed environment and should include sanitized command output, object
metadata, timestamps, and the environment where it was captured.
