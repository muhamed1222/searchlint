import { describe, expect, it } from "vitest";

import {
  cloudWatchLogProvisioningContract,
  validateCloudWatchLogProvisioningContract
} from "../src/index.js";

describe("cloudWatchLogProvisioningContract", () => {
  it("defines CloudWatch log groups for API and worker JSON-line records", () => {
    expect(
      validateCloudWatchLogProvisioningContract(
        cloudWatchLogProvisioningContract
      )
    ).toEqual([]);
    expect(cloudWatchLogProvisioningContract.provider).toBe(
      "aws-cloudwatch-logs"
    );
    expect(
      cloudWatchLogProvisioningContract.groups.map((group) => ({
        name: group.name,
        producer: group.producer,
        packageName: group.packageName,
        serviceName: group.serviceName,
        source: group.source,
        encoding: group.encoding,
        retentionDays: group.retentionDays,
        kmsKeyArnEnv: group.encryption.kmsKeyArnEnv
      }))
    ).toEqual([
      {
        name: "/aws/ecs/searchlint-cloud-api",
        producer: "api",
        packageName: "@searchlint/api",
        serviceName: "searchlint-cloud-api",
        source: "ecs-container-stdout-stderr",
        encoding: "json-lines",
        retentionDays: 30,
        kmsKeyArnEnv: "SEARCHLINT_CLOUDWATCH_LOGS_KMS_KEY_ARN"
      },
      {
        name: "/aws/ecs/searchlint-cloud-worker",
        producer: "worker",
        packageName: "@searchlint/workers",
        serviceName: "searchlint-cloud-worker",
        source: "ecs-container-stdout-stderr",
        encoding: "json-lines",
        retentionDays: 30,
        kmsKeyArnEnv: "SEARCHLINT_CLOUDWATCH_LOGS_KMS_KEY_ARN"
      }
    ]);
  });

  it("declares required API request log attributes", () => {
    const apiGroup = cloudWatchLogProvisioningContract.groups.find(
      (group) => group.producer === "api"
    );

    expect(apiGroup?.events).toEqual([
      {
        eventName: "searchlint.api.request",
        requiredAttributes: [
          "http.request.method",
          "url.path",
          "http.response.status_code",
          "http.server.duration_ms",
          "searchlint.request_id",
          "searchlint.rate_limited",
          "searchlint.timed_out"
        ]
      }
    ]);
  });

  it("declares required worker lifecycle, batch, crawler, and error attributes", () => {
    const workerGroup = cloudWatchLogProvisioningContract.groups.find(
      (group) => group.producer === "worker"
    );

    expect(workerGroup?.events.map((event) => event.eventName)).toEqual([
      "searchlint.worker.lifecycle",
      "searchlint.worker.outbox_batch",
      "searchlint.worker.crawler_batch",
      "searchlint.worker.error"
    ]);
    expect(workerGroup?.events[2]?.requiredAttributes).toContain(
      "searchlint.crawler.deleted"
    );
    expect(workerGroup?.events[3]?.requiredAttributes).toContain(
      "error.message"
    );
  });

  it("rejects provider, group, retention, source, encoding, and KMS drift", () => {
    const issues = validateCloudWatchLogProvisioningContract({
      ...cloudWatchLogProvisioningContract,
      provider: "other" as "aws-cloudwatch-logs",
      groups: [
        {
          ...cloudWatchLogProvisioningContract.groups[0]!,
          name: "/wrong/searchlint-cloud-api",
          source: "other" as "ecs-container-stdout-stderr",
          encoding: "other" as "json-lines",
          retentionDays: 0,
          encryption: {
            kmsKeyRequired: false as true,
            kmsKeyArnEnv:
              "OTHER_ENV" as "SEARCHLINT_CLOUDWATCH_LOGS_KMS_KEY_ARN"
          }
        }
      ]
    });

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "provider" }),
        expect.objectContaining({ path: "groups" }),
        expect.objectContaining({
          path: "groups./wrong/searchlint-cloud-api.name"
        }),
        expect.objectContaining({
          path: "groups./wrong/searchlint-cloud-api.retentionDays"
        }),
        expect.objectContaining({
          path: "groups./wrong/searchlint-cloud-api.encryption.kmsKeyRequired"
        }),
        expect.objectContaining({
          path: "groups./wrong/searchlint-cloud-api.encryption.kmsKeyArnEnv"
        })
      ])
    );
  });

  it("rejects missing required event names and attributes", () => {
    const issues = validateCloudWatchLogProvisioningContract({
      ...cloudWatchLogProvisioningContract,
      groups: [
        {
          ...cloudWatchLogProvisioningContract.groups[0]!,
          events: [
            {
              eventName: "searchlint.api.request",
              requiredAttributes: ["http.request.method"]
            }
          ]
        },
        {
          ...cloudWatchLogProvisioningContract.groups[1]!,
          events: [
            {
              eventName: "searchlint.worker.lifecycle",
              requiredAttributes: ["searchlint.worker.kind"]
            }
          ]
        }
      ]
    });

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "groups./aws/ecs/searchlint-cloud-api.events.searchlint.api.request.requiredAttributes"
        }),
        expect.objectContaining({
          path: "groups./aws/ecs/searchlint-cloud-worker.events"
        }),
        expect.objectContaining({
          path: "groups./aws/ecs/searchlint-cloud-worker.events.searchlint.worker.lifecycle.requiredAttributes"
        })
      ])
    );
  });
});
