# Auth RBAC Acceptance

This document records deterministic local/static proof for authentication,
authorization, tenant isolation, and membership behavior. It does not claim a
deployed identity provider.

## Deterministic Proof

- Cognito CloudFormation shape and runtime configuration contracts are checked
  statically.
- API tests verify JWT principal extraction, authorization short-circuiting,
  RBAC matrix behavior, organization membership lifecycle, member removal,
  ownership transfer, tenant-scoped project/environment access, audit events,
  and active-only PostgreSQL membership writes.
- Repository contracts keep membership reads tenant-scoped and active-only.

## Remaining Runtime Gates

Verifier keywords: signup, password reset, MFA, invite email, dashboard
team-management UI.

The following release gates require owner-controlled infrastructure and user
flows:

- deploy and verify real Cognito user pool and app client configuration;
- verify signup, login, logout, refresh token, session expiry, and password
  reset flows;
- verify email verification, MFA, and invite email delivery;
- verify dashboard team-management UI for member removal, ownership transfer,
  and role changes;
- verify deployed Cloud API authentication against the production Cognito issuer
  and JWKS URL.

## Evidence Policy

Runtime auth evidence must be sanitized. Do not commit real tokens, passwords,
authorization headers, email addresses, or provider secrets.
