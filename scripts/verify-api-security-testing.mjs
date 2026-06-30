#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { format } from "prettier";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const generatedAt = "2026-06-22T00:00:00.000Z";
const reportPath = path.join(
  repoRoot,
  "reports/api-security-testing-report.json"
);
const samplePath = path.join(
  repoRoot,
  "docs/examples/api-security-testing-report.sample.json"
);

const targetedTests = [
  "node-http-server.test.ts",
  "http-dispatcher.test.ts",
  "api.test.ts",
  "cognito-auth.test.ts",
  "stripe-webhook.test.ts",
  "contracts.test.ts"
];

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    env: { ...process.env, ...options.env },
    encoding: "utf8",
    stdio: options.stdio ?? "pipe"
  });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  run("pnpm", ["--filter", "@searchlint/api", "test", "--", ...targetedTests]);
  run("pnpm", ["--filter", "@searchlint/api", "build"]);

  const files = {
    nodeHttpServer: await readText(
      "services/api/test/node-http-server.test.ts"
    ),
    dispatcher: await readText("services/api/test/http-dispatcher.test.ts"),
    api: await readText("services/api/test/api.test.ts"),
    cognito: await readText("services/api/test/cognito-auth.test.ts"),
    stripe: await readText("services/api/test/stripe-webhook.test.ts"),
    contracts: await readText("services/api/test/contracts.test.ts"),
    runtime: await readText("services/api/src/node-http-server.ts"),
    deployment: await readText("services/api/src/deployment-contracts.ts"),
    cloudFormation: await readText(
      "infra/aws/cloud-api-ecs-fargate.cloudformation.json"
    ),
    backendSecurityDoc: await readText(
      "docs/BACKEND_API_DEPLOYMENT_SECURITY_ACCEPTANCE.md"
    )
  };

  const cases = [
    caseFromEvidence({
      id: "api-authentication",
      controls: ["missing principal 401", "invalid Cognito bearer 401"],
      evidenceFiles: [
        "services/api/test/node-http-server.test.ts",
        "services/api/test/cognito-auth.test.ts"
      ],
      checks: [
        [
          files.nodeHttpServer,
          "passes missing principals through the dispatcher authentication path"
        ],
        [
          files.nodeHttpServer,
          "returns 401 for invalid Cognito bearer credentials before application dispatch"
        ],
        [
          files.cognito,
          "rejects invalid Cognito tokens without producing a principal"
        ]
      ]
    }),
    caseFromEvidence({
      id: "api-authorization-tenant-identity",
      controls: [
        "RBAC permission checks",
        "organization/project/environment identity checks"
      ],
      evidenceFiles: ["services/api/test/api.test.ts"],
      checks: [
        [files.api, "authorizationMatrix"],
        [
          files.api,
          "does not load dashboard snapshots when authorization or route identity checks fail"
        ],
        [
          files.api,
          "records crawl diagnostics after authorization and crawl identity checks"
        ]
      ]
    }),
    caseFromEvidence({
      id: "api-request-validation-boundaries",
      controls: [
        "invalid JSON",
        "invalid request bodies",
        "unsupported method",
        "body-size limit"
      ],
      evidenceFiles: [
        "services/api/test/node-http-server.test.ts",
        "services/api/test/http-dispatcher.test.ts"
      ],
      checks: [
        [
          files.nodeHttpServer,
          "returns 400 for invalid JSON before application dispatch"
        ],
        [
          files.nodeHttpServer,
          "returns 413 for oversized bodies before application dispatch"
        ],
        [files.nodeHttpServer, "returns 405 for unsupported HTTP methods"],
        [
          files.dispatcher,
          "returns 400 for invalid request bodies before calling application code"
        ]
      ]
    }),
    caseFromEvidence({
      id: "api-abuse-controls",
      controls: [
        "rate limiting",
        "timeout cancellation",
        "request abort signal"
      ],
      evidenceFiles: ["services/api/test/node-http-server.test.ts"],
      checks: [
        [
          files.nodeHttpServer,
          "returns 429 for rate-limited requests before body parsing or application dispatch"
        ],
        [
          files.nodeHttpServer,
          "returns 504 when dispatcher processing exceeds the configured timeout"
        ],
        [files.runtime, "requestController.abort"]
      ]
    }),
    caseFromEvidence({
      id: "stripe-webhook-signature-boundary",
      controls: [
        "raw body handling",
        "signature required",
        "invalid signature rejection",
        "timestamp tolerance"
      ],
      evidenceFiles: [
        "services/api/test/node-http-server.test.ts",
        "services/api/test/stripe-webhook.test.ts"
      ],
      checks: [
        [
          files.nodeHttpServer,
          "accepts signed Stripe webhook requests without a principal or JSON pre-parsing"
        ],
        [
          files.nodeHttpServer,
          "returns 400 for Stripe webhook requests without a signature header"
        ],
        [
          files.nodeHttpServer,
          "returns 400 for Stripe webhook requests with invalid signatures"
        ],
        [files.stripe, "rejects stale signatures"]
      ]
    }),
    caseFromEvidence({
      id: "api-idempotency-audit-observability",
      controls: [
        "idempotency key evidence",
        "audit events",
        "structured request logs"
      ],
      evidenceFiles: [
        "services/api/test/api.test.ts",
        "services/api/test/node-http-server.test.ts"
      ],
      checks: [
        [files.api, "idempotencyKey"],
        [files.api, "auditEvents"],
        [
          files.nodeHttpServer,
          "reuses incoming request IDs in structured request logs"
        ]
      ]
    }),
    caseFromEvidence({
      id: "api-deployment-security-static-contract",
      controls: [
        "private ECS networking",
        "Secrets Manager",
        "rate-limit fail-closed",
        "dispatch timeout"
      ],
      evidenceFiles: [
        "services/api/src/deployment-contracts.ts",
        "infra/aws/cloud-api-ecs-fargate.cloudformation.json",
        "services/api/test/contracts.test.ts"
      ],
      checks: [
        [files.cloudFormation, '"AssignPublicIp": "DISABLED"'],
        [files.deployment, "Secrets Manager"],
        [files.deployment, "failClosed"],
        [files.deployment, "Dispatch timeout must be a positive integer"],
        [files.contracts, "acceptStripeWebhook"]
      ]
    })
  ];

  const output = {
    schemaVersion: 1,
    generatedBy: "searchlint-api-security-testing-verifier",
    generatedAt,
    status: "local-static-security-testing-passed-release-blocked",
    scope: {
      proofType: "deterministic local/static Backend API security testing",
      liveApiAccess: "not used by verifier",
      doesNotClaim: [
        "DAST",
        "penetration test",
        "production API Gateway/WAF security approval",
        "live Cognito issuer/JWKS validation",
        "deployed tenant-isolation proof",
        "deployed CloudWatch security telemetry"
      ]
    },
    commands: [
      {
        command: `pnpm --filter @searchlint/api test -- ${targetedTests.join(" ")}`,
        status: "passed"
      },
      {
        command: "pnpm --filter @searchlint/api build",
        status: "passed"
      }
    ],
    cases,
    summary: {
      caseCount: cases.length,
      passedCases: cases.filter((entry) => entry.status === "passed").length,
      blockedReleaseGates: 6
    },
    remainingReleaseGates: [
      "Run DAST against a deployed production-equivalent API target.",
      "Complete independent penetration testing and remediation sign-off.",
      "Review API Gateway/WAF/security-header configuration after deployment.",
      "Validate Cognito issuer/JWKS integration against the deployed API.",
      "Prove tenant isolation against deployed RDS with real test tenants.",
      "Verify deployed CloudWatch security logs, metrics, and alarms."
    ]
  };

  assertNoSensitiveValues(JSON.stringify(output));
  await mkdir(path.dirname(reportPath), { recursive: true });
  await mkdir(path.dirname(samplePath), { recursive: true });
  await writeJson(reportPath, output);
  await writeJson(samplePath, output);

  console.log(
    `API security testing PASS: ${output.summary.passedCases}/${output.summary.caseCount} local/static cases passed; release remains blocked by ${output.summary.blockedReleaseGates} live gate(s)`
  );
  console.log(`Report: ${path.relative(repoRoot, reportPath)}`);
  console.log(`Sample: ${path.relative(repoRoot, samplePath)}`);
}

function caseFromEvidence(input) {
  for (const [content, phrase] of input.checks) {
    assert(
      content.includes(phrase),
      `${input.id} missing evidence phrase: ${phrase}`
    );
  }
  return {
    id: input.id,
    status: "passed",
    controls: input.controls,
    evidenceFiles: input.evidenceFiles
  };
}

async function readText(relativePath) {
  return readFile(path.join(repoRoot, relativePath), "utf8");
}

function assertNoSensitiveValues(text) {
  const forbidden = [
    /private_key/i,
    /client-secret/i,
    /authorization:/i,
    /bearer\s+[A-Za-z0-9._-]{8,}/i,
    /sk_live/i,
    /whsec_[A-Za-z0-9]/i,
    /postgres:\/\/user/i,
    /-----BEGIN PRIVATE KEY-----/i,
    /ya29\./i,
    /xox[baprs]-/i,
    /secret-load-token/i
  ];
  const match = forbidden.find((pattern) => pattern.test(text));
  if (match) {
    throw new Error(
      `Sensitive value leaked into API security evidence: ${match}`
    );
  }
}

async function writeJson(filePath, data) {
  await writeFile(
    filePath,
    await format(JSON.stringify(data), { parser: "json" })
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
