#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { format } from "prettier";

const reportPath = "reports/notification-redaction-review-report.json";
const samplePath =
  "docs/examples/notification-redaction-review-report.sample.json";

const commands = [
  {
    name: "workerProductionLogSinkTests",
    command: "pnpm",
    args: [
      "--filter",
      "@searchlint/workers",
      "test",
      "--",
      "production-log-sink.test.ts"
    ]
  },
  {
    name: "apiObservabilityRedactionTests",
    command: "pnpm",
    args: [
      "--filter",
      "@searchlint/api",
      "test",
      "--",
      "observability-release.test.ts"
    ]
  },
  {
    name: "workersBuild",
    command: "pnpm",
    args: ["--filter", "@searchlint/workers", "build"]
  },
  {
    name: "apiBuild",
    command: "pnpm",
    args: ["--filter", "@searchlint/api", "build"]
  }
];

const commandResults = commands.map(runCommand);
const workers = await import(
  pathToFileURL(path.resolve("services/workers/dist/src/index.js")).href
);
const api = await import(
  pathToFileURL(path.resolve("services/api/dist/src/index.js")).href
);

const workerLogCase = verifyWorkerNotificationLogs(workers);
const telemetryCase = verifyApiTelemetryPayload(api);
const reviewPacket = {
  reviewedArtifacts: [
    "services/workers/src/production-log-sink.ts",
    "services/api/src/observability-release.ts",
    "services/workers/src/notification-delivery-worker.ts",
    "docs/NOTIFICATIONS_ACCEPTANCE.md",
    "docs/NOTIFICATION_WORKERS_STATIC_CONTRACT.md",
    "docs/NOTIFICATION_SETTINGS_PERSISTENCE_STATIC_CONTRACT.md"
  ],
  syntheticInputsOnly: true,
  liveDeploymentReviewed: false
};

const report = {
  generatedBy: "searchlint-notification-redaction-review-verifier",
  generatedAt: "2026-06-23T00:00:00.000Z",
  status: "static-redaction-review-passed-live-release-blocked",
  scope: {
    proofType:
      "deterministic static notification log and telemetry redaction review packet",
    doesNotClaim: [
      "live CloudWatch log inspection",
      "live OTLP collector inspection",
      "live notification provider delivery",
      "production incident-channel delivery",
      "real provider credential handling"
    ]
  },
  commands: commandResults,
  reviewPacket,
  cases: {
    workerNotificationLogs: workerLogCase,
    apiTelemetryPayload: telemetryCase
  },
  assertions: [
    "Notification delivery batch logs contain aggregate counters only.",
    "Notification worker runtime error messages redact secret-like values before body/attribute emission.",
    "Telemetry redaction removes secret-bearing notification payload fields and values.",
    "Generated evidence contains no raw provider tokens, webhook secrets, database URLs, private keys, or bearer tokens."
  ],
  remainingReleaseGates: [
    "Inspect deployed CloudWatch logs after live notification provider delivery.",
    "Inspect deployed OTLP logs, metrics, and traces after live notification provider delivery.",
    "Verify production incident-channel alert delivery and acknowledgement.",
    "Repeat redaction review with production log export owned by the release owner."
  ]
};

assertNoSensitiveValues(report);

await mkdir(path.dirname(reportPath), { recursive: true });
await mkdir(path.dirname(samplePath), { recursive: true });
await writeJson(reportPath, report);
await writeJson(samplePath, report);

console.log(
  `Notification redaction review PASS: workerFindings=${workerLogCase.redactedErrorMessages}, telemetryFindings=${telemetryCase.findingCount}`
);
console.log(`Report: ${reportPath}`);
console.log(`Sample: ${samplePath}`);

function verifyWorkerNotificationLogs(workers) {
  const batchRecord = workers.outboxWorkerProductionLogRecord(
    {
      kind: "notification-delivery-batch",
      result: {
        selected: 4,
        delivered: 2,
        retryScheduled: 1,
        failed: 1,
        attempts: [
          {
            id: "attempt-1",
            taskId: "task-1",
            organizationId: "org-1",
            channelId: "webhook-1",
            channelKind: "webhook",
            status: "retry_scheduled",
            attemptedAt: "2026-06-23T00:00:00.000Z",
            attempt: 1,
            failureReason: "Bearer provider-token",
            nextRetryAt: "2026-06-23T00:05:00.000Z"
          }
        ]
      }
    },
    {
      clock: fixedClock(),
      workerKind: "notification-delivery-worker"
    }
  );
  const errorRecord = workers.outboxWorkerProductionLogRecord(
    {
      kind: "error",
      phase: "notification-delivery",
      error: new Error(
        "delivery failed Bearer slack-token xoxb_notification_token whsec_123456 postgres://user:pass@db.example.test:5432/app"
      )
    },
    {
      clock: fixedClock(),
      workerKind: "notification-delivery-worker"
    }
  );

  expectEqual(
    batchRecord.eventName,
    "searchlint.worker.notification_delivery_batch"
  );
  expectEqual(batchRecord.body.selected, 4);
  expectEqual(batchRecord.body.delivered, 2);
  expectEqual(batchRecord.body.retryScheduled, 1);
  expectEqual(batchRecord.body.failed, 1);
  expectEqual(workers.workerLogRecordContainsSecret(batchRecord), false);
  expectEqual(workers.workerLogRecordContainsSecret(errorRecord), false);
  assertNoSensitiveValues(batchRecord);
  assertNoSensitiveValues(errorRecord);

  return {
    batchEventName: batchRecord.eventName,
    batchBody: batchRecord.body,
    batchAttributes: batchRecord.attributes,
    redactedErrorMessages: countRedactedMarkers(errorRecord),
    errorPhase: errorRecord.body.phase,
    errorContainsSecret: false
  };
}

function verifyApiTelemetryPayload(api) {
  const payload = {
    notification: {
      channelKind: "webhook",
      targetDisplay: "https://hooks.example.test/searchlint",
      targetSecretRef: "secret://org-1/notifications/webhook-1",
      authorization: "Bearer notification-provider-token",
      webhookSecret: "whsec_123456789",
      cookie: "session=notification-secret"
    },
    delivery: {
      failureReason:
        "provider failed with postgres://user:pass@db.example.test:5432/app"
    }
  };
  const result = api.redactTelemetryPayload(payload);

  expectEqual(result.findings.length >= 5, true);
  expectEqual(api.telemetryPayloadContainsSecret(result.redacted), false);
  assertNoSensitiveValues(result.redacted);

  return {
    findingCount: result.findings.length,
    redactedPaths: result.findings.map((finding) => finding.path).sort(),
    sanitizedPayload: result.redacted
  };
}

function fixedClock() {
  return {
    now() {
      return "2026-06-23T00:00:00.000Z";
    }
  };
}

function countRedactedMarkers(value) {
  return JSON.stringify(value).split("[REDACTED]").length - 1;
}

function runCommand(commandSpec) {
  const result = spawnSync(commandSpec.command, commandSpec.args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  const commandLine = [commandSpec.command, ...commandSpec.args].join(" ");
  if (result.status !== 0) {
    throw new Error(
      `${commandLine} failed with exit ${result.status}\n${result.stdout}\n${result.stderr}`
    );
  }
  return {
    name: commandSpec.name,
    command: commandLine,
    status: "passed"
  };
}

function expectEqual(actual, expected) {
  if (actual !== expected) {
    throw new Error(
      `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}.`
    );
  }
}

function assertNoSensitiveValues(value) {
  const text = JSON.stringify(value);
  for (const forbidden of [
    "slack-token",
    "notification-provider-token",
    "xoxb_notification_token",
    "whsec_",
    "postgres://",
    "-----BEGIN",
    "session=notification-secret",
    "provider-token"
  ]) {
    if (text.includes(forbidden)) {
      throw new Error(
        `Forbidden sensitive value found in evidence: ${forbidden}`
      );
    }
  }
}

async function writeJson(filePath, value) {
  const json = await format(JSON.stringify(value), { parser: "json" });
  await writeFile(filePath, json, "utf8");
}
