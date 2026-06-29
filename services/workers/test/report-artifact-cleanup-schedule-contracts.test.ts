import { describe, expect, it } from "vitest";

import {
  reportArtifactCleanupScheduleContract,
  validateReportArtifactCleanupScheduleContract
} from "../src/index.js";

describe("reportArtifactCleanupScheduleContract", () => {
  it("defines the EventBridge to ECS/Fargate cleanup schedule target", () => {
    expect(
      validateReportArtifactCleanupScheduleContract(
        reportArtifactCleanupScheduleContract
      )
    ).toEqual([]);

    expect(reportArtifactCleanupScheduleContract.provider).toBe(
      "aws-eventbridge-scheduler"
    );
    expect(reportArtifactCleanupScheduleContract.schedule.expression).toBe(
      "rate(15 minutes)"
    );
    expect(reportArtifactCleanupScheduleContract.target).toMatchObject({
      kind: "aws-ecs-fargate-task",
      packageName: "@searchlint/workers",
      binName: "searchlint-report-artifact-cleanup-worker",
      nodeMajor: 24,
      workerKind: "report-artifact-cleanup-poller",
      launchType: "FARGATE",
      networkMode: "awsvpc"
    });
  });

  it("declares required PostgreSQL and cleanup worker environment variables", () => {
    expect(reportArtifactCleanupScheduleContract.environment.variables).toEqual(
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
          name: "SEARCHLINT_WORKER_REPORT_ARTIFACT_CLEANUP_POLL_INTERVAL_MS",
          required: false,
          secretSource: "plain-env"
        },
        {
          name: "SEARCHLINT_WORKER_REPORT_ARTIFACT_CLEANUP_BATCH_SIZE",
          required: false,
          secretSource: "plain-env"
        }
      ])
    );
  });

  it("rejects schedule, target, and environment drift", () => {
    const issues = validateReportArtifactCleanupScheduleContract({
      ...reportArtifactCleanupScheduleContract,
      provider: "other" as "aws-eventbridge-scheduler",
      schedule: {
        expression: "rate(1 day)" as "rate(15 minutes)",
        flexibleTimeWindow: "FLEXIBLE" as "OFF",
        retryAttempts: -1 as 2,
        deadLetterQueueRequired: false as true
      },
      target: {
        kind: "other" as "aws-ecs-fargate-task",
        packageName: "other" as "@searchlint/workers",
        binName: "other" as "searchlint-report-artifact-cleanup-worker",
        nodeMajor: 20 as 24,
        workerKind: "other" as "report-artifact-cleanup-poller",
        launchType: "EC2" as "FARGATE",
        networkMode: "bridge" as "awsvpc"
      },
      environment: {
        postgresEnvPrefix: "POSTGRES" as "SEARCHLINT_POSTGRES",
        workerEnvPrefix: "WORKER" as "SEARCHLINT_WORKER",
        variables: []
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
          path: "environment.variables.SEARCHLINT_POSTGRES_DATABASE_URL.secretSource"
        })
      ])
    );
  });
});
