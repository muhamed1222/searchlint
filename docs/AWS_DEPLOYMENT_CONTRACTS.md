# AWS Deployment Contracts

This document records the static AWS deployment contracts that are checked in
the repository. It does not claim deployed AWS infrastructure.

## Static Infrastructure Contracts

- Cloud API contracts cover API Gateway, VPC Link, internal ALB, ECS/Fargate
  service and task definitions, IAM roles, log groups, environment variables,
  and Secrets Manager boundaries.
- Auth contracts cover Cognito user pool and app client shape.
- Data contracts cover RDS PostgreSQL networking, encryption, generated password
  secret, and database URL secret boundaries.
- Object storage contracts cover private S3 artifact buckets, access-log bucket,
  encryption, TLS-only access, lifecycle rules, versioning, and public access
  block.
- Worker contracts cover crawler worker SQS queue and DLQ, ECS/Fargate worker
  service/task definition, log groups, IAM permissions, Secrets Manager
  boundary, S3 artifact-write permission, and KMS data-key permission.
- Scheduler contracts cover EventBridge scheduled invocation proof for report
  artifact cleanup and external observation tasks.

## Remaining Runtime Gates

The static proof must be followed by owner-operated live evidence:

- deploy API, worker, scheduler, database, auth, vault, observability, and
  object storage stacks;
- prove live enqueue/dequeue on the crawler worker SQS queue and DLQ behavior;
- prove EventBridge scheduled invocation proof in AWS with task execution logs;
- verify secrets, network isolation, public ingress boundaries, log retention,
  alert routes, and rollback behavior in the deployed account.

## Evidence Policy

Do not add fake AWS deployment output. Runtime evidence must be captured from
the production or release-candidate AWS account and sanitized before commit.
