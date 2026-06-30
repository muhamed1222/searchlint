export type CloudWatchLogProvisioningProvider = "aws-cloudwatch-logs";
export type CloudWatchLogProducerKind = "api" | "worker";
export type CloudWatchLogSource = "ecs-container-stdout-stderr";
export type CloudWatchLogEncoding = "json-lines";

export type CloudWatchLogEncryptionContract = {
  kmsKeyRequired: true;
  kmsKeyArnEnv: "SEARCHLINT_CLOUDWATCH_LOGS_KMS_KEY_ARN";
};

export type CloudWatchLogEventContract = {
  eventName: string;
  requiredAttributes: readonly string[];
};

export type CloudWatchLogGroupContract = {
  name: string;
  producer: CloudWatchLogProducerKind;
  packageName: "@searchlint/api" | "@searchlint/workers";
  serviceName: "searchlint-cloud-api" | "searchlint-cloud-worker";
  source: CloudWatchLogSource;
  encoding: CloudWatchLogEncoding;
  retentionDays: number;
  encryption: CloudWatchLogEncryptionContract;
  events: readonly CloudWatchLogEventContract[];
};

export type CloudWatchLogProvisioningContract = {
  id: "searchlint-cloudwatch-logs-v1";
  contractVersion: 1;
  provider: CloudWatchLogProvisioningProvider;
  groups: readonly CloudWatchLogGroupContract[];
};

export type CloudWatchLogProvisioningValidationIssue = {
  path: string;
  message: string;
};

const kmsKeyArnEnv = "SEARCHLINT_CLOUDWATCH_LOGS_KMS_KEY_ARN";
const source = "ecs-container-stdout-stderr";
const encoding = "json-lines";
const retentionDays = 30;

const apiGroupName = "/aws/ecs/searchlint-cloud-api";
const workerGroupName = "/aws/ecs/searchlint-cloud-worker";

export const cloudWatchLogProvisioningContract: CloudWatchLogProvisioningContract =
  {
    id: "searchlint-cloudwatch-logs-v1",
    contractVersion: 1,
    provider: "aws-cloudwatch-logs",
    groups: [
      {
        name: apiGroupName,
        producer: "api",
        packageName: "@searchlint/api",
        serviceName: "searchlint-cloud-api",
        source,
        encoding,
        retentionDays,
        encryption: {
          kmsKeyRequired: true,
          kmsKeyArnEnv
        },
        events: [
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
        ]
      },
      {
        name: workerGroupName,
        producer: "worker",
        packageName: "@searchlint/workers",
        serviceName: "searchlint-cloud-worker",
        source,
        encoding,
        retentionDays,
        encryption: {
          kmsKeyRequired: true,
          kmsKeyArnEnv
        },
        events: [
          {
            eventName: "searchlint.worker.lifecycle",
            requiredAttributes: [
              "searchlint.worker.kind",
              "searchlint.worker.event_kind",
              "searchlint.worker.lifecycle_state"
            ]
          },
          {
            eventName: "searchlint.worker.outbox_batch",
            requiredAttributes: [
              "searchlint.worker.kind",
              "searchlint.worker.event_kind",
              "searchlint.outbox.selected",
              "searchlint.outbox.leased",
              "searchlint.outbox.published",
              "searchlint.outbox.failed",
              "searchlint.outbox.skipped"
            ]
          },
          {
            eventName: "searchlint.worker.crawler_batch",
            requiredAttributes: [
              "searchlint.worker.kind",
              "searchlint.worker.event_kind",
              "searchlint.crawler.received",
              "searchlint.crawler.handled",
              "searchlint.crawler.succeeded",
              "searchlint.crawler.failed",
              "searchlint.crawler.invalid",
              "searchlint.crawler.deleted",
              "searchlint.crawler.skipped"
            ]
          },
          {
            eventName: "searchlint.worker.error",
            requiredAttributes: [
              "searchlint.worker.kind",
              "searchlint.worker.event_kind",
              "error.message"
            ]
          }
        ]
      }
    ]
  };

export function validateCloudWatchLogProvisioningContract(
  contract: CloudWatchLogProvisioningContract
): CloudWatchLogProvisioningValidationIssue[] {
  const issues: CloudWatchLogProvisioningValidationIssue[] = [];

  expectEqual(issues, "id", contract.id, "searchlint-cloudwatch-logs-v1");
  expectEqual(issues, "contractVersion", contract.contractVersion, 1);
  expectEqual(issues, "provider", contract.provider, "aws-cloudwatch-logs");

  const groups = new Map(contract.groups.map((group) => [group.name, group]));
  validateRequiredGroup(issues, groups, apiExpectedGroup());
  validateRequiredGroup(issues, groups, workerExpectedGroup());

  for (const group of contract.groups) {
    validateGroup(group, issues);
  }

  return issues;
}

function validateRequiredGroup(
  issues: CloudWatchLogProvisioningValidationIssue[],
  groups: ReadonlyMap<string, CloudWatchLogGroupContract>,
  expected: CloudWatchLogGroupContract
): void {
  const group = groups.get(expected.name);
  if (!group) {
    issues.push({
      path: "groups",
      message: `${expected.name} log group is required.`
    });
    return;
  }

  const basePath = `groups.${expected.name}`;
  expectEqual(
    issues,
    `${basePath}.producer`,
    group.producer,
    expected.producer
  );
  expectEqual(
    issues,
    `${basePath}.packageName`,
    group.packageName,
    expected.packageName
  );
  expectEqual(
    issues,
    `${basePath}.serviceName`,
    group.serviceName,
    expected.serviceName
  );
  expectEqual(issues, `${basePath}.source`, group.source, expected.source);
  expectEqual(
    issues,
    `${basePath}.encoding`,
    group.encoding,
    expected.encoding
  );
  validateExpectedEvents(issues, basePath, group, expected.events);
}

function validateGroup(
  group: CloudWatchLogGroupContract,
  issues: CloudWatchLogProvisioningValidationIssue[]
): void {
  const basePath = `groups.${group.name}`;

  if (!group.name.startsWith("/aws/ecs/searchlint-cloud-")) {
    issues.push({
      path: `${basePath}.name`,
      message: "Log group name must use the /aws/ecs/searchlint-cloud- prefix."
    });
  }

  if (!Number.isInteger(group.retentionDays) || group.retentionDays < 1) {
    issues.push({
      path: `${basePath}.retentionDays`,
      message: "CloudWatch log retention days must be a positive integer."
    });
  }

  expectEqual(
    issues,
    `${basePath}.encryption.kmsKeyRequired`,
    group.encryption.kmsKeyRequired,
    true
  );
  expectEqual(
    issues,
    `${basePath}.encryption.kmsKeyArnEnv`,
    group.encryption.kmsKeyArnEnv,
    kmsKeyArnEnv
  );

  if (group.events.length < 1) {
    issues.push({
      path: `${basePath}.events`,
      message: "At least one structured event contract is required."
    });
  }
}

function validateExpectedEvents(
  issues: CloudWatchLogProvisioningValidationIssue[],
  basePath: string,
  group: CloudWatchLogGroupContract,
  expectedEvents: readonly CloudWatchLogEventContract[]
): void {
  const events = new Map(group.events.map((event) => [event.eventName, event]));

  for (const expectedEvent of expectedEvents) {
    const event = events.get(expectedEvent.eventName);
    if (!event) {
      issues.push({
        path: `${basePath}.events`,
        message: `${expectedEvent.eventName} event contract is required.`
      });
      continue;
    }

    for (const attribute of expectedEvent.requiredAttributes) {
      if (!event.requiredAttributes.includes(attribute)) {
        issues.push({
          path: `${basePath}.events.${expectedEvent.eventName}.requiredAttributes`,
          message: `${attribute} attribute is required.`
        });
      }
    }
  }
}

function apiExpectedGroup(): CloudWatchLogGroupContract {
  return cloudWatchLogProvisioningContract.groups[0]!;
}

function workerExpectedGroup(): CloudWatchLogGroupContract {
  return cloudWatchLogProvisioningContract.groups[1]!;
}

function expectEqual(
  issues: CloudWatchLogProvisioningValidationIssue[],
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
