# Workers Queues Scheduler Proof

This document records deterministic local/static proof for SearchLint worker,
queue, and scheduler behavior. It does not claim deployed AWS runtime behavior.

## Deterministic Proof

- Worker package tests cover SQS message enqueue/dequeue contracts, retry and
  delete semantics, DLQ routing boundaries, bounded crawler batch concurrency,
  worker lifecycle, structured logs, and side-effect-light process factories.
- Static infrastructure contracts define real SQS queues, DLQs, ECS/Fargate
  worker services, task definitions, IAM permissions, log groups, and
  EventBridge Scheduler targets.
- Scheduler contracts cover report artifact cleanup and external observation
  invocation shape.
- Deterministic local/static proof verifies these contracts without AWS
  credentials or deployed workers.

## Remaining Runtime Gates

The following gates require owner-operated infrastructure:

- deploy real SQS queues, DLQs, ECS/Fargate workers, EventBridge Scheduler, and
  CloudWatch log groups;
- verify live enqueue/dequeue, retry, delete, DLQ replay, and poisoned-message
  behavior;
- verify autoscaling under production-like backlog and batch pressure;
- verify worker alerts, queue-age alarms, DLQ-depth alarms, and incident
  routing;
- verify scheduled cleanup and external observation tasks with deployed logs and
  sanitized task execution evidence.

## Evidence Policy

Runtime evidence must identify the AWS account/environment, command or console
view used, observation time, and sanitized queue/task/log identifiers. Do not
commit AWS credentials, ARNs that should remain private, or customer data.
