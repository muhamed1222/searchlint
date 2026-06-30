# Backend API Deployment Security Acceptance

This document records the accepted deterministic local/static acceptance proof
for the SearchLint Cloud API. It does not claim a real production deployment.

## Deterministic Proof

- Route contracts and the checked OpenAPI artifact define the stable `/v1`
  request and response surface.
- API Gateway and ECS/Fargate CloudFormation templates are checked for the
  expected deployment shape without AWS credentials.
- Node HTTP dispatcher tests verify authentication short-circuiting, request
  validation, deterministic error envelopes, request IDs, timeouts,
  cancellation, rate-limit behavior, idempotency, audit paths, and domain error
  mapping.
- PostgreSQL integration contracts verify deterministic SQL behavior locally
  rather than against a live production database.

## Remaining Production Gates

The following gates must be completed with owner-controlled infrastructure:

- deploy the real production deployment for API Gateway, ECS/Fargate, RDS,
  Cognito, Stripe, and Secrets Manager;
- verify OpenAPI compatibility against the deployed API;
- run load testing with production-like concurrency and payload sizes;
- run security testing, including DAST and penetration-test coverage;
- capture sanitized production acceptance evidence for auth, billing,
  persistence, observability, and operational rollback paths.

## Evidence Policy

Local/static acceptance is sufficient only for repository gating. Production
release evidence must identify the deployed environment, observation time,
commands or test runner used, and sanitized outputs.
