import { describe, expect, it } from "vitest";

import {
  cloudWorkerDeploymentContract,
  validateCloudWorkerDeploymentContract
} from "../src/index.js";

describe("cloudWorkerDeploymentContract", () => {
  it("defines the approved ECS/Fargate outbox worker runtime target", () => {
    expect(
      validateCloudWorkerDeploymentContract(cloudWorkerDeploymentContract)
    ).toEqual([]);
    expect(cloudWorkerDeploymentContract.runtime.compute).toBe(
      "aws-ecs-fargate"
    );
    expect(cloudWorkerDeploymentContract.runtime.nodeMajor).toBe(24);
    expect(cloudWorkerDeploymentContract.runtime.workerKind).toBe(
      "outbox-poller"
    );
    expect(cloudWorkerDeploymentContract.runtime.packageName).toBe(
      "@searchlint/workers"
    );
    expect(cloudWorkerDeploymentContract.runtime.shutdownSignals).toEqual([
      "SIGTERM",
      "SIGINT"
    ]);
    expect(cloudWorkerDeploymentContract.queue.provider).toBe("aws-sqs");
    expect(cloudWorkerDeploymentContract.queue.messageTypes).toEqual([
      "crawl.requested"
    ]);
    expect(cloudWorkerDeploymentContract.queue.deadLetterQueueRequired).toBe(
      true
    );
    expect(cloudWorkerDeploymentContract.observability.logSink).toBe(
      "aws-cloudwatch"
    );
  });

  it("declares required PostgreSQL, SQS, and worker environment variables", () => {
    expect(cloudWorkerDeploymentContract.environment.variables).toEqual(
      expect.arrayContaining([
        {
          name: "SEARCHLINT_POSTGRES_DATABASE_URL",
          required: true,
          secretSource: "aws-secrets-manager"
        },
        {
          name: "SEARCHLINT_POSTGRES_SSL_MODE",
          required: true,
          secretSource: "plain-env"
        },
        {
          name: "SEARCHLINT_CRAWL_QUEUE_URL",
          required: true,
          secretSource: "plain-env"
        },
        {
          name: "SEARCHLINT_CRAWL_ARTIFACT_BUCKET",
          required: true,
          secretSource: "plain-env"
        },
        {
          name: "SEARCHLINT_RULE_CATALOG_PATH",
          required: true,
          secretSource: "plain-env"
        },
        {
          name: "SEARCHLINT_WORKER_OUTBOX_POLL_INTERVAL_MS",
          required: false,
          secretSource: "plain-env"
        },
        {
          name: "SEARCHLINT_WORKER_OUTBOX_BATCH_SIZE",
          required: false,
          secretSource: "plain-env"
        }
      ])
    );
  });

  it("rejects runtime and queue drift", () => {
    const issues = validateCloudWorkerDeploymentContract({
      ...cloudWorkerDeploymentContract,
      runtime: {
        ...cloudWorkerDeploymentContract.runtime,
        compute: "other" as "aws-ecs-fargate",
        nodeMajor: 20 as 24,
        workerKind: "other" as "outbox-poller",
        packageName: "other" as "@searchlint/workers",
        shutdownSignals: ["SIGTERM"] as unknown as ["SIGTERM", "SIGINT"],
        pollIntervalMs: 0,
        batchSize: 0,
        stopOnError: true as false
      },
      queue: {
        ...cloudWorkerDeploymentContract.queue,
        provider: "other" as "aws-sqs",
        messageTypes: []
      }
    });

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "runtime.compute" }),
        expect.objectContaining({ path: "runtime.nodeMajor" }),
        expect.objectContaining({ path: "runtime.workerKind" }),
        expect.objectContaining({ path: "runtime.packageName" }),
        expect.objectContaining({ path: "runtime.shutdownSignals" }),
        expect.objectContaining({ path: "runtime.pollIntervalMs" }),
        expect.objectContaining({ path: "runtime.batchSize" }),
        expect.objectContaining({ path: "runtime.stopOnError" }),
        expect.objectContaining({ path: "queue.provider" }),
        expect.objectContaining({ path: "queue.messageTypes" })
      ])
    );
  });

  it("rejects observability and environment drift", () => {
    const issues = validateCloudWorkerDeploymentContract({
      ...cloudWorkerDeploymentContract,
      observability: {
        structuredWorkerLogs: false as true,
        logSink: "other" as "aws-cloudwatch",
        lifecycleStateField: "workerState" as "state"
      },
      environment: {
        ...cloudWorkerDeploymentContract.environment,
        postgresEnvPrefix: "POSTGRES" as "SEARCHLINT_POSTGRES",
        workerEnvPrefix: "WORKER" as "SEARCHLINT_WORKER",
        variables: []
      }
    });

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "observability.structuredWorkerLogs"
        }),
        expect.objectContaining({ path: "observability.logSink" }),
        expect.objectContaining({ path: "observability.lifecycleStateField" }),
        expect.objectContaining({ path: "environment.postgresEnvPrefix" }),
        expect.objectContaining({ path: "environment.workerEnvPrefix" }),
        expect.objectContaining({ path: "environment.variables" }),
        expect.objectContaining({
          path: "environment.variables.SEARCHLINT_POSTGRES_DATABASE_URL.secretSource"
        })
      ])
    );
  });

  it("requires critical variables to be marked required", () => {
    const issues = validateCloudWorkerDeploymentContract({
      ...cloudWorkerDeploymentContract,
      environment: {
        ...cloudWorkerDeploymentContract.environment,
        variables: cloudWorkerDeploymentContract.environment.variables.map(
          (variable) =>
            variable.name === "SEARCHLINT_CRAWL_QUEUE_URL"
              ? {
                  ...variable,
                  required: false
                }
              : variable
        )
      }
    });

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "environment.variables.SEARCHLINT_CRAWL_QUEUE_URL.required"
        })
      ])
    );
  });
});
