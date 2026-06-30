#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { format } from "prettier";

const reportPath = "reports/google-consent-verification-readiness-report.json";
const samplePath =
  "docs/examples/google-consent-verification-readiness-report.sample.json";

const commands = [
  {
    name: "googleOAuthStatic",
    command: "pnpm",
    args: ["google:oauth-static"]
  },
  {
    name: "securityPrivacyAcceptance",
    command: "pnpm",
    args: ["security:acceptance"]
  },
  {
    name: "websiteAcceptance",
    command: "pnpm",
    args: ["website:acceptance"]
  }
];

const commandResults = commands.map(runCommand);
const requiredDocs = [
  {
    path: "docs/GOOGLE_OAUTH_APP_STATIC_READINESS.md",
    requires: [
      "https://accounts.google.com/o/oauth2/v2/auth",
      "https://www.googleapis.com/auth/webmasters.readonly",
      "PKCE S256"
    ]
  },
  {
    path: "docs/PRIVACY_POLICY.md",
    requires: ["OAuth tokens", "Google/Yandex connection metadata"]
  },
  {
    path: "docs/SECURITY_PRIVACY_RELEASE_GATE.md",
    requires: ["OAuth vault handling", "Secrets handling"]
  },
  {
    path: "docs/SUPPORT_POLICY.md",
    requires: ["Support Channels", "security disclosures"]
  },
  {
    path: "docs/VULNERABILITY_DISCLOSURE.md",
    requires: ["OAuth tokens", "approved security contact"]
  },
  {
    path: "docs/PUBLIC_WEBSITE_ONBOARDING.md",
    requires: ["/integrations/google-yandex", "Google/Yandex integration"]
  },
  {
    path: "docs/TERMS_OF_SERVICE.md",
    requires: ["acceptable-use", "legal review"]
  }
];

const documentEvidence = [];
for (const doc of requiredDocs) {
  const content = await readFile(doc.path, "utf8");
  const missing = doc.requires.filter((needle) => !content.includes(needle));
  if (missing.length > 0) {
    throw new Error(
      `${doc.path} is missing required text: ${missing.join(", ")}`
    );
  }
  documentEvidence.push({
    path: doc.path,
    requiredTextCount: doc.requires.length,
    status: "present"
  });
}

const report = {
  generatedBy: "searchlint-google-consent-verification-readiness-verifier",
  generatedAt: "2026-06-23T00:00:00.000Z",
  status: "readiness-passed-live-google-approval-blocked",
  scope: {
    proofType:
      "deterministic Google OAuth consent verification readiness packet",
    doesNotClaim: [
      "Google OAuth consent screen submitted",
      "Google OAuth consent screen approved",
      "Google Cloud Console project configured",
      "live Google verification completed",
      "Search Console property ownership verified"
    ]
  },
  commands: commandResults,
  documents: documentEvidence,
  googleConsentPacket: {
    appType: "external web application",
    sensitiveScopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
    nonSensitiveScopes: ["openid", "email"],
    dataUseSummary:
      "SearchLint reads Search Console and URL Inspection data to render deterministic SEO diagnostics, dashboard observations, and reports for user-configured sites.",
    tokenStorageSummary:
      "OAuth tokens must be stored through the SearchLint OAuth vault boundary and must not appear in logs, telemetry, reports, or checked evidence samples.",
    userFacingDocuments: [
      "docs/PRIVACY_POLICY.md",
      "docs/TERMS_OF_SERVICE.md",
      "docs/SUPPORT_POLICY.md",
      "docs/VULNERABILITY_DISCLOSURE.md",
      "docs/PUBLIC_WEBSITE_ONBOARDING.md"
    ],
    requestedVerificationEvidence: [
      "approved production privacy policy URL",
      "approved app home page URL",
      "approved support/contact URL",
      "authorized JavaScript origins",
      "authorized redirect URIs",
      "screen recording or reviewer notes if Google requests functional proof",
      "domain ownership proof if Google requires it"
    ]
  },
  assertions: [
    "Google OAuth static app configuration readiness passes.",
    "Security/privacy acceptance passes before consent readiness is reported.",
    "Public website/onboarding source includes Google/Yandex integration guidance.",
    "Privacy policy draft covers OAuth token handling and Google/Yandex connection metadata.",
    "Vulnerability disclosure and support policy drafts exist for reviewer-facing contact posture.",
    "The report explicitly blocks live Google approval until Google Console submission and approval exist."
  ],
  remainingReleaseGates: [
    "Approve and publish final privacy policy, terms, support, and vulnerability disclosure URLs.",
    "Create or update the real Google Cloud Console OAuth consent screen.",
    "Configure authorized domains, JavaScript origins, and redirect URIs.",
    "Submit Google OAuth verification if required for the requested scopes.",
    "Store owner-provided Google approval evidence outside generated reports.",
    "Connect real Search Console properties and run live provider acceptance."
  ]
};

assertNoSecrets(JSON.stringify(report));
await mkdir(path.dirname(reportPath), { recursive: true });
await mkdir(path.dirname(samplePath), { recursive: true });
await writeJson(reportPath, report);
await writeJson(samplePath, report);

console.log(
  `Google consent verification readiness PASS: ${documentEvidence.length} documents checked`
);
console.log(`Report: ${reportPath}`);
console.log(`Sample: ${samplePath}`);

function runCommand(commandSpec) {
  const result = spawnSync(commandSpec.command, commandSpec.args, {
    cwd: process.cwd(),
    env: process.env,
    encoding: "utf8",
    stdio: "pipe"
  });
  if (result.status !== 0) {
    process.stderr.write(result.stdout);
    process.stderr.write(result.stderr);
    throw new Error(
      `${commandSpec.name} failed with exit code ${result.status ?? "unknown"}.`
    );
  }
  return {
    name: commandSpec.name,
    command: [commandSpec.command, ...commandSpec.args].join(" "),
    status: "passed",
    stdout: summarizeOutput(result.stdout)
  };
}

function summarizeOutput(output) {
  return output
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line !== "")
    .filter((line) => !line.startsWith("RUN "))
    .filter((line) => !line.startsWith("Start at "))
    .filter((line) => !line.startsWith("Duration "))
    .filter((line) => !line.startsWith("$ "))
    .slice(-8);
}

function assertNoSecrets(text) {
  const forbidden = [
    /ya29\.[A-Za-z0-9_-]+/u,
    /refresh[_-]?token["':= ]+[A-Za-z0-9._-]+/iu,
    /client[_-]?secret["':= ]+[A-Za-z0-9._-]+/iu,
    /authorization:\s*bearer\s+[A-Za-z0-9._-]+/iu
  ];
  for (const pattern of forbidden) {
    if (pattern.test(text)) {
      throw new Error(
        `Consent readiness report contains secret-like text: ${pattern}`
      );
    }
  }
}

async function writeJson(filePath, value) {
  const json = await format(`${JSON.stringify(value, null, 2)}\n`, {
    parser: "json"
  });
  await writeFile(filePath, json);
}
