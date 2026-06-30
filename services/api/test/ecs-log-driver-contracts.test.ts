import { describe, expect, it } from "vitest";

import {
  ecsAwslogsLogDriverContract,
  validateEcsAwslogsLogDriverContract
} from "../src/index.js";

describe("ecsAwslogsLogDriverContract", () => {
  it("defines awslogs configuration for API and worker containers", () => {
    expect(
      validateEcsAwslogsLogDriverContract(ecsAwslogsLogDriverContract)
    ).toEqual([]);
    expect(ecsAwslogsLogDriverContract).toMatchObject({
      id: "searchlint-ecs-awslogs-log-driver-v1",
      contractVersion: 1,
      provider: "aws-ecs-log-configuration",
      runtime: "aws-ecs-fargate"
    });
    expect(
      ecsAwslogsLogDriverContract.containers.map((container) => ({
        producer: container.producer,
        serviceName: container.serviceName,
        packageName: container.packageName,
        logGroupName: container.logGroupName,
        logDriver: container.logDriver,
        regionEnv: container.regionEnv,
        streamPrefix: container.streamPrefix,
        mode: container.mode,
        maxBufferSize: container.maxBufferSize
      }))
    ).toEqual([
      {
        producer: "api",
        serviceName: "searchlint-cloud-api",
        packageName: "@searchlint/api",
        logGroupName: "/aws/ecs/searchlint-cloud-api",
        logDriver: "awslogs",
        regionEnv: "SEARCHLINT_AWS_REGION",
        streamPrefix: "searchlint-cloud-api",
        mode: "non-blocking",
        maxBufferSize: "25m"
      },
      {
        producer: "worker",
        serviceName: "searchlint-cloud-worker",
        packageName: "@searchlint/workers",
        logGroupName: "/aws/ecs/searchlint-cloud-worker",
        logDriver: "awslogs",
        regionEnv: "SEARCHLINT_AWS_REGION",
        streamPrefix: "searchlint-cloud-worker",
        mode: "non-blocking",
        maxBufferSize: "25m"
      }
    ]);
  });

  it("declares the CloudWatch Logs execution-role write permissions", () => {
    expect(ecsAwslogsLogDriverContract.executionRole.requiredActions).toEqual([
      "logs:CreateLogStream",
      "logs:PutLogEvents"
    ]);
  });

  it("rejects driver, group, region, stream, mode, buffer, and permission drift", () => {
    const issues = validateEcsAwslogsLogDriverContract({
      ...ecsAwslogsLogDriverContract,
      provider: "other" as "aws-ecs-log-configuration",
      containers: [
        {
          ...ecsAwslogsLogDriverContract.containers[0]!,
          logDriver: "json-file" as "awslogs",
          regionEnv: "AWS_REGION" as "SEARCHLINT_AWS_REGION",
          logGroupName: "/wrong/searchlint-cloud-api",
          streamPrefix: "wrong" as "searchlint-cloud-api",
          mode: "blocking" as "non-blocking",
          maxBufferSize: "1m" as "25m"
        }
      ],
      executionRole: {
        requiredActions: ["logs:CreateLogGroup" as "logs:CreateLogStream"]
      }
    });

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "provider" }),
        expect.objectContaining({ path: "containers" }),
        expect.objectContaining({ path: "containers.api.logGroupName" }),
        expect.objectContaining({ path: "containers.api.streamPrefix" }),
        expect.objectContaining({ path: "containers.api.logDriver" }),
        expect.objectContaining({ path: "containers.api.regionEnv" }),
        expect.objectContaining({ path: "containers.api.mode" }),
        expect.objectContaining({ path: "containers.api.maxBufferSize" }),
        expect.objectContaining({ path: "executionRole.requiredActions" })
      ])
    );
  });
});
