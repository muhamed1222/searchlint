# OAuth Vault Security

This document records deterministic local/static proof for OAuth token storage,
refresh, rotation, and revocation boundaries. It does not claim deployed AWS
vault infrastructure or live provider credentials.

## Deterministic Proof

- CloudFormation contracts define real AWS KMS and real AWS Secrets Manager
  resources for the intended deployment boundary.
- API and worker tests verify that persisted records store secret references
  rather than raw OAuth token values.
- Token write/read, refresh, rotation, revocation, deletion, recovery-window,
  audit, metrics, and tenant-scope contracts are verified through injected
  deterministic ports.
- Sanitized evidence must not include raw OAuth token values.

## Remaining Runtime Gates

The following gates require owner-controlled infrastructure:

- deploy the real AWS KMS key and real AWS Secrets Manager namespace;
- populate production Google and Yandex provider credentials;
- run live OAuth token write/read/delete proof against Secrets Manager;
- verify refresh and revocation against live provider endpoints;
- verify dashboard connector UI for connect, refresh, revoke, and failure
  states;
- complete external security review of token storage, logging, and rotation
  boundaries.

## Evidence Policy

Never commit raw OAuth token values, provider client secrets, refresh tokens, or
authorization codes. Runtime evidence must show sanitized secret references,
timestamps, provider names, and status outcomes only.
