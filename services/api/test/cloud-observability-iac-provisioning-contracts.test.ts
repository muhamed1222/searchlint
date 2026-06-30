import { describe, expect, it } from "vitest";

import {
  cloudObservabilityIacProvisioningContract,
  validateCloudObservabilityIacProvisioningContract
} from "../src/index.js";

describe("cloudObservabilityIacProvisioningContract", () => {
  it("defines the approved CloudWatch and OTLP IaC provisioning target", () => {
    expect(
      validateCloudObservabilityIacProvisioningContract(
        cloudObservabilityIacProvisioningContract
      )
    ).toEqual([]);

    expect(cloudObservabilityIacProvisioningContract).toMatchObject({
      id: "searchlint-cloud-observability-iac-provisioning-v1",
      contractVersion: 1,
      provider: "aws-cloudwatch-opentelemetry",
      runtime: "aws-ecs-fargate",
      iacTool: "tool-agnostic",
      references: {
        cloudWatchLogsContractId: "searchlint-cloudwatch-logs-v1",
        ecsAwslogsContractId: "searchlint-ecs-awslogs-log-driver-v1",
        observabilityExporterContractId: "searchlint-observability-exporter-v1"
      }
    });
  });

  it("declares API and worker service wiring", () => {
    expect(
      cloudObservabilityIacProvisioningContract.services.map((service) => ({
        producer: service.producer,
        serviceName: service.serviceName,
        packageName: service.packageName,
        logGroupName: service.logGroupName,
        logDriver: service.logDriver,
        namespace: service.cloudWatchEmf.namespace,
        dimensions: service.cloudWatchEmf.dimensions,
        protocol: service.otlp.protocol
      }))
    ).toEqual([
      {
        producer: "api",
        serviceName: "searchlint-cloud-api",
        packageName: "@searchlint/api",
        logGroupName: "/aws/ecs/searchlint-cloud-api",
        logDriver: "awslogs",
        namespace: "SearchLint/Cloud",
        dimensions: ["ServiceName", "EventName", "Environment"],
        protocol: "http/protobuf"
      },
      {
        producer: "worker",
        serviceName: "searchlint-cloud-worker",
        packageName: "@searchlint/workers",
        logGroupName: "/aws/ecs/searchlint-cloud-worker",
        logDriver: "awslogs",
        namespace: "SearchLint/Cloud",
        dimensions: ["ServiceName", "EventName", "Environment"],
        protocol: "http/protobuf"
      }
    ]);
  });

  it("declares OTLP task environment wiring with secret-bearing headers", () => {
    for (const service of cloudObservabilityIacProvisioningContract.services) {
      expect(
        service.environment.map((variable) => ({
          name: variable.name,
          required: variable.required,
          secretSource: variable.secretSource,
          value: variable.value
        }))
      ).toEqual([
        {
          name: "OTEL_SERVICE_NAME",
          required: true,
          secretSource: "plain-env",
          value: service.serviceName
        },
        {
          name: "SEARCHLINT_ENVIRONMENT",
          required: true,
          secretSource: "plain-env",
          value: undefined
        },
        {
          name: "OTEL_EXPORTER_OTLP_ENDPOINT",
          required: true,
          secretSource: "plain-env",
          value: undefined
        },
        {
          name: "OTEL_EXPORTER_OTLP_PROTOCOL",
          required: true,
          secretSource: "plain-env",
          value: undefined
        },
        {
          name: "OTEL_EXPORTER_OTLP_HEADERS",
          required: false,
          secretSource: "aws-secrets-manager",
          value: undefined
        },
        {
          name: "OTEL_EXPORTER_OTLP_TIMEOUT",
          required: true,
          secretSource: "plain-env",
          value: undefined
        }
      ]);
    }
  });

  it("rejects references, missing service wiring, and OTLP drift", () => {
    const issues = validateCloudObservabilityIacProvisioningContract({
      ...cloudObservabilityIacProvisioningContract,
      references: {
        ...cloudObservabilityIacProvisioningContract.references,
        cloudWatchLogsContractId:
          "other-cloudwatch-contract" as "searchlint-cloudwatch-logs-v1"
      },
      services: [
        {
          ...cloudObservabilityIacProvisioningContract.services[0]!,
          logGroupName: "/aws/ecs/wrong",
          cloudWatchEmf: {
            ...cloudObservabilityIacProvisioningContract.services[0]!
              .cloudWatchEmf,
            namespace: "SearchLint/Dev" as "SearchLint/Cloud",
            dimensions: [
              "ServiceName",
              "RequestId",
              "Environment"
            ] as unknown as ["ServiceName", "EventName", "Environment"]
          },
          otlp: {
            ...cloudObservabilityIacProvisioningContract.services[0]!.otlp,
            protocol: "grpc" as "http/protobuf"
          },
          environment:
            cloudObservabilityIacProvisioningContract.services[0]!.environment.filter(
              (variable) => variable.name !== "OTEL_EXPORTER_OTLP_ENDPOINT"
            ).map((variable) =>
              variable.name === "OTEL_EXPORTER_OTLP_HEADERS"
                ? { ...variable, secretSource: "plain-env" as const }
                : variable
            )
        }
      ]
    });

    expect(issues).toEqual(
      expect.arrayContaining([
        {
          path: "references.cloudWatchLogsContractId",
          message:
            "references.cloudWatchLogsContractId must be searchlint-cloudwatch-logs-v1."
        },
        {
          path: "services.api.logGroupName",
          message:
            "services.api.logGroupName must be /aws/ecs/searchlint-cloud-api."
        },
        {
          path: "services.api.cloudWatchEmf.namespace",
          message:
            "services.api.cloudWatchEmf.namespace must be SearchLint/Cloud."
        },
        {
          path: "services.api.cloudWatchEmf.dimensions",
          message: "EventName is required."
        },
        {
          path: "services.api.cloudWatchEmf.dimensions",
          message: "RequestId is not part of the approved set."
        },
        {
          path: "services.api.otlp.protocol",
          message: "services.api.otlp.protocol must be http/protobuf."
        },
        {
          path: "services.api.environment",
          message: "OTEL_EXPORTER_OTLP_ENDPOINT environment wiring is required."
        },
        {
          path: "services.api.environment.OTEL_EXPORTER_OTLP_HEADERS.secretSource",
          message:
            "services.api.environment.OTEL_EXPORTER_OTLP_HEADERS.secretSource must be aws-secrets-manager."
        },
        {
          path: "services",
          message: "worker observability service wiring is required."
        }
      ])
    );
  });
});
