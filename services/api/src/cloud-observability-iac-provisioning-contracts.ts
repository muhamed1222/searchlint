import {
  cloudWatchLogProvisioningContract,
  type CloudWatchLogGroupContract,
  type CloudWatchLogProducerKind
} from "./cloudwatch-log-provisioning-contracts.js";
import { ecsAwslogsLogDriverContract } from "./ecs-log-driver-contracts.js";
import {
  observabilityExporterContract,
  type ObservabilityEnvironmentVariableName,
  type ObservabilityOtlpProtocol
} from "./observability-exporter-contracts.js";

export type CloudObservabilityIacProvisioningProvider =
  "aws-cloudwatch-opentelemetry";
export type CloudObservabilityIacRuntime = "aws-ecs-fargate";
export type CloudObservabilityIacTool = "tool-agnostic";
export type CloudObservabilityIacSecretSource =
  | "aws-secrets-manager"
  | "plain-env";

export type CloudObservabilityIacEnvironmentVariable = {
  name: ObservabilityEnvironmentVariableName;
  required: boolean;
  secretSource: CloudObservabilityIacSecretSource;
  value?: string;
};

export type CloudObservabilityIacServiceContract = {
  producer: CloudWatchLogProducerKind;
  serviceName: CloudWatchLogGroupContract["serviceName"];
  packageName: CloudWatchLogGroupContract["packageName"];
  logGroupName: CloudWatchLogGroupContract["name"];
  logDriver: "awslogs";
  cloudWatchEmf: {
    namespace: "SearchLint/Cloud";
    dimensions: readonly ["ServiceName", "EventName", "Environment"];
  };
  otlp: {
    protocol: ObservabilityOtlpProtocol;
    endpointEnv: "OTEL_EXPORTER_OTLP_ENDPOINT";
    protocolEnv: "OTEL_EXPORTER_OTLP_PROTOCOL";
    headersEnv: "OTEL_EXPORTER_OTLP_HEADERS";
    timeoutEnv: "OTEL_EXPORTER_OTLP_TIMEOUT";
  };
  environment: readonly CloudObservabilityIacEnvironmentVariable[];
};

export type CloudObservabilityIacProvisioningContract = {
  id: "searchlint-cloud-observability-iac-provisioning-v1";
  contractVersion: 1;
  provider: CloudObservabilityIacProvisioningProvider;
  runtime: CloudObservabilityIacRuntime;
  iacTool: CloudObservabilityIacTool;
  references: {
    cloudWatchLogsContractId: typeof cloudWatchLogProvisioningContract.id;
    ecsAwslogsContractId: typeof ecsAwslogsLogDriverContract.id;
    observabilityExporterContractId: typeof observabilityExporterContract.id;
  };
  services: readonly CloudObservabilityIacServiceContract[];
};

export type CloudObservabilityIacProvisioningValidationIssue = {
  path: string;
  message: string;
};

const requiredEnvironment =
  observabilityExporterContract.otlp.environmentVariables;

export const cloudObservabilityIacProvisioningContract: CloudObservabilityIacProvisioningContract =
  {
    id: "searchlint-cloud-observability-iac-provisioning-v1",
    contractVersion: 1,
    provider: "aws-cloudwatch-opentelemetry",
    runtime: "aws-ecs-fargate",
    iacTool: "tool-agnostic",
    references: {
      cloudWatchLogsContractId: cloudWatchLogProvisioningContract.id,
      ecsAwslogsContractId: ecsAwslogsLogDriverContract.id,
      observabilityExporterContractId: observabilityExporterContract.id
    },
    services: cloudWatchLogProvisioningContract.groups.map((group) =>
      serviceContractForLogGroup(group)
    )
  };

export function validateCloudObservabilityIacProvisioningContract(
  contract: CloudObservabilityIacProvisioningContract
): CloudObservabilityIacProvisioningValidationIssue[] {
  const issues: CloudObservabilityIacProvisioningValidationIssue[] = [];

  expectEqual(
    issues,
    "id",
    contract.id,
    "searchlint-cloud-observability-iac-provisioning-v1"
  );
  expectEqual(issues, "contractVersion", contract.contractVersion, 1);
  expectEqual(
    issues,
    "provider",
    contract.provider,
    "aws-cloudwatch-opentelemetry"
  );
  expectEqual(issues, "runtime", contract.runtime, "aws-ecs-fargate");
  expectEqual(issues, "iacTool", contract.iacTool, "tool-agnostic");
  validateReferences(contract, issues);
  validateServices(contract, issues);

  return issues;
}

function serviceContractForLogGroup(
  group: CloudWatchLogGroupContract
): CloudObservabilityIacServiceContract {
  return {
    producer: group.producer,
    serviceName: group.serviceName,
    packageName: group.packageName,
    logGroupName: group.name,
    logDriver: "awslogs",
    cloudWatchEmf: {
      namespace: observabilityExporterContract.cloudWatchEmf.namespace,
      dimensions: observabilityExporterContract.cloudWatchEmf.dimensions
    },
    otlp: {
      protocol: observabilityExporterContract.otlp.protocol,
      endpointEnv: "OTEL_EXPORTER_OTLP_ENDPOINT",
      protocolEnv: "OTEL_EXPORTER_OTLP_PROTOCOL",
      headersEnv: "OTEL_EXPORTER_OTLP_HEADERS",
      timeoutEnv: "OTEL_EXPORTER_OTLP_TIMEOUT"
    },
    environment: requiredEnvironment.map((variable) => ({
      name: variable.name,
      required: variable.required,
      secretSource: variable.secret ? "aws-secrets-manager" : "plain-env",
      ...(variable.name === "OTEL_SERVICE_NAME"
        ? { value: group.serviceName }
        : {})
    }))
  };
}

function validateReferences(
  contract: CloudObservabilityIacProvisioningContract,
  issues: CloudObservabilityIacProvisioningValidationIssue[]
): void {
  expectEqual(
    issues,
    "references.cloudWatchLogsContractId",
    contract.references.cloudWatchLogsContractId,
    cloudWatchLogProvisioningContract.id
  );
  expectEqual(
    issues,
    "references.ecsAwslogsContractId",
    contract.references.ecsAwslogsContractId,
    ecsAwslogsLogDriverContract.id
  );
  expectEqual(
    issues,
    "references.observabilityExporterContractId",
    contract.references.observabilityExporterContractId,
    observabilityExporterContract.id
  );
}

function validateServices(
  contract: CloudObservabilityIacProvisioningContract,
  issues: CloudObservabilityIacProvisioningValidationIssue[]
): void {
  const services = new Map(
    contract.services.map((service) => [service.producer, service])
  );
  const containers = new Map(
    ecsAwslogsLogDriverContract.containers.map((container) => [
      container.producer,
      container
    ])
  );

  for (const group of cloudWatchLogProvisioningContract.groups) {
    const service = services.get(group.producer);
    const basePath = `services.${group.producer}`;
    if (!service) {
      issues.push({
        path: "services",
        message: `${group.producer} observability service wiring is required.`
      });
      continue;
    }

    const container = containers.get(group.producer);
    expectEqual(
      issues,
      `${basePath}.serviceName`,
      service.serviceName,
      group.serviceName
    );
    expectEqual(
      issues,
      `${basePath}.packageName`,
      service.packageName,
      group.packageName
    );
    expectEqual(
      issues,
      `${basePath}.logGroupName`,
      service.logGroupName,
      group.name
    );
    expectEqual(
      issues,
      `${basePath}.logDriver`,
      service.logDriver,
      container?.logDriver ?? "awslogs"
    );
    validateServiceEmf(service, basePath, issues);
    validateServiceOtlp(service, basePath, issues);
    validateServiceEnvironment(service, group, basePath, issues);
  }
}

function validateServiceEmf(
  service: CloudObservabilityIacServiceContract,
  basePath: string,
  issues: CloudObservabilityIacProvisioningValidationIssue[]
): void {
  expectEqual(
    issues,
    `${basePath}.cloudWatchEmf.namespace`,
    service.cloudWatchEmf.namespace,
    observabilityExporterContract.cloudWatchEmf.namespace
  );
  expectSetEqual(
    issues,
    `${basePath}.cloudWatchEmf.dimensions`,
    service.cloudWatchEmf.dimensions,
    observabilityExporterContract.cloudWatchEmf.dimensions
  );
}

function validateServiceOtlp(
  service: CloudObservabilityIacServiceContract,
  basePath: string,
  issues: CloudObservabilityIacProvisioningValidationIssue[]
): void {
  expectEqual(
    issues,
    `${basePath}.otlp.protocol`,
    service.otlp.protocol,
    observabilityExporterContract.otlp.protocol
  );
  expectEqual(
    issues,
    `${basePath}.otlp.endpointEnv`,
    service.otlp.endpointEnv,
    "OTEL_EXPORTER_OTLP_ENDPOINT"
  );
  expectEqual(
    issues,
    `${basePath}.otlp.protocolEnv`,
    service.otlp.protocolEnv,
    "OTEL_EXPORTER_OTLP_PROTOCOL"
  );
  expectEqual(
    issues,
    `${basePath}.otlp.headersEnv`,
    service.otlp.headersEnv,
    "OTEL_EXPORTER_OTLP_HEADERS"
  );
  expectEqual(
    issues,
    `${basePath}.otlp.timeoutEnv`,
    service.otlp.timeoutEnv,
    "OTEL_EXPORTER_OTLP_TIMEOUT"
  );
}

function validateServiceEnvironment(
  service: CloudObservabilityIacServiceContract,
  group: CloudWatchLogGroupContract,
  basePath: string,
  issues: CloudObservabilityIacProvisioningValidationIssue[]
): void {
  const variables = new Map(
    service.environment.map((variable) => [variable.name, variable])
  );

  for (const expected of requiredEnvironment) {
    const variable = variables.get(expected.name);
    if (!variable) {
      issues.push({
        path: `${basePath}.environment`,
        message: `${expected.name} environment wiring is required.`
      });
      continue;
    }

    const variablePath = `${basePath}.environment.${expected.name}`;
    expectEqual(
      issues,
      `${variablePath}.required`,
      variable.required,
      expected.required
    );
    expectEqual(
      issues,
      `${variablePath}.secretSource`,
      variable.secretSource,
      expected.secret ? "aws-secrets-manager" : "plain-env"
    );
  }

  const serviceName = variables.get("OTEL_SERVICE_NAME");
  expectEqual(
    issues,
    `${basePath}.environment.OTEL_SERVICE_NAME.value`,
    serviceName?.value,
    group.serviceName
  );
}

function expectEqual(
  issues: CloudObservabilityIacProvisioningValidationIssue[],
  path: string,
  actual: unknown,
  expected: unknown
): void {
  if (actual !== expected) {
    issues.push({
      path,
      message: `${path} must be ${String(expected)}.`
    });
  }
}

function expectSetEqual(
  issues: CloudObservabilityIacProvisioningValidationIssue[],
  path: string,
  actual: readonly string[],
  expected: readonly string[]
): void {
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);

  for (const value of expectedSet) {
    if (!actualSet.has(value)) {
      issues.push({
        path,
        message: `${value} is required.`
      });
    }
  }

  for (const value of actualSet) {
    if (!expectedSet.has(value)) {
      issues.push({
        path,
        message: `${value} is not part of the approved set.`
      });
    }
  }
}
