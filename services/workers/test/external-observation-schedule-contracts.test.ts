import { describe, expect, it } from "vitest";

import {
  externalObservationScheduleContract,
  validateExternalObservationScheduleContract
} from "../src/index.js";

describe("externalObservationScheduleContract", () => {
  it("defines the EventBridge to ECS/Fargate external observation schedule target", () => {
    expect(
      validateExternalObservationScheduleContract(
        externalObservationScheduleContract
      )
    ).toEqual([]);

    expect(externalObservationScheduleContract.provider).toBe(
      "aws-eventbridge-scheduler"
    );
    expect(externalObservationScheduleContract.schedule.expression).toBe(
      "rate(1 hour)"
    );
    expect(externalObservationScheduleContract.target).toMatchObject({
      kind: "aws-ecs-fargate-task",
      packageName: "@searchlint/workers",
      binName: "searchlint-external-observation-worker",
      nodeMajor: 24,
      workerKind: "external-observation-collector",
      launchType: "FARGATE",
      networkMode: "awsvpc"
    });
  });

  it("declares required PostgreSQL, provider, OAuth, and target environment variables", () => {
    expect(externalObservationScheduleContract.environment.variables).toEqual(
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
          name: "SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_POLL_INTERVAL_MS",
          required: false,
          secretSource: "plain-env"
        },
        {
          name: "SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_BATCH_SIZE",
          required: false,
          secretSource: "plain-env"
        },
        {
          name: "SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_MAX_BATCHES",
          required: true,
          secretSource: "plain-env"
        },
        {
          name: "SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_DISCOVERY_SITE_URLS",
          required: false,
          secretSource: "plain-env"
        },
        {
          name: "SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_GOOGLE_PAGESPEED_ENABLED",
          required: false,
          secretSource: "plain-env"
        },
        {
          name: "SEARCHLINT_WORKER_GOOGLE_OAUTH_CLIENT_SECRET",
          required: false,
          secretSource: "aws-secrets-manager"
        },
        {
          name: "SEARCHLINT_WORKER_YANDEX_OAUTH_CLIENT_SECRET",
          required: false,
          secretSource: "aws-secrets-manager"
        }
      ])
    );
  });

  it("rejects schedule, target, and environment drift", () => {
    const issues = validateExternalObservationScheduleContract({
      ...externalObservationScheduleContract,
      provider: "other" as "aws-eventbridge-scheduler",
      schedule: {
        expression: "rate(1 day)" as "rate(1 hour)",
        flexibleTimeWindow: "FLEXIBLE" as "OFF",
        retryAttempts: -1 as 2,
        deadLetterQueueRequired: false as true
      },
      target: {
        kind: "other" as "aws-ecs-fargate-task",
        packageName: "other" as "@searchlint/workers",
        binName: "other" as "searchlint-external-observation-worker",
        nodeMajor: 20 as 24,
        workerKind: "other" as "external-observation-collector",
        launchType: "EC2" as "FARGATE",
        networkMode: "bridge" as "awsvpc"
      },
      environment: {
        postgresEnvPrefix: "POSTGRES" as "SEARCHLINT_POSTGRES",
        workerEnvPrefix: "WORKER" as "SEARCHLINT_WORKER",
        variables: [
          {
            name: "SEARCHLINT_POSTGRES_DATABASE_URL",
            required: false,
            secretSource: "plain-env"
          },
          {
            name: "SEARCHLINT_WORKER_GOOGLE_OAUTH_CLIENT_SECRET",
            required: false,
            secretSource: "plain-env"
          }
        ]
      }
    });

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "provider" }),
        expect.objectContaining({ path: "schedule.expression" }),
        expect.objectContaining({ path: "schedule.flexibleTimeWindow" }),
        expect.objectContaining({ path: "schedule.retryAttempts" }),
        expect.objectContaining({ path: "schedule.deadLetterQueueRequired" }),
        expect.objectContaining({ path: "target.kind" }),
        expect.objectContaining({ path: "target.packageName" }),
        expect.objectContaining({ path: "target.binName" }),
        expect.objectContaining({ path: "target.nodeMajor" }),
        expect.objectContaining({ path: "target.workerKind" }),
        expect.objectContaining({ path: "target.launchType" }),
        expect.objectContaining({ path: "target.networkMode" }),
        expect.objectContaining({ path: "environment.postgresEnvPrefix" }),
        expect.objectContaining({ path: "environment.workerEnvPrefix" }),
        expect.objectContaining({ path: "environment.variables" }),
        expect.objectContaining({
          path: "environment.variables.SEARCHLINT_POSTGRES_DATABASE_URL.required"
        }),
        expect.objectContaining({
          path: "environment.variables.SEARCHLINT_POSTGRES_DATABASE_URL.secretSource"
        }),
        expect.objectContaining({
          path: "environment.variables.SEARCHLINT_WORKER_GOOGLE_OAUTH_CLIENT_SECRET.secretSource"
        })
      ])
    );
  });
});
