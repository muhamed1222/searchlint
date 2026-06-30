# Report Summary Template

Create the real report summary at:

```text
docs/reviews/penetration-test/report-summary.json
```

## Machine-Readable Shape

```json
{
  "schemaVersion": 1,
  "reportId": "pentest-2026-rc1",
  "reviewerOrganization": "Independent Security Firm",
  "reviewerTeam": "Application Security Team",
  "reviewPeriod": {
    "startedAt": "2026-06-23T00:00:00.000Z",
    "endedAt": "2026-06-30T00:00:00.000Z"
  },
  "testedRelease": {
    "version": "1.0.0-rc.1",
    "commit": "abcdef1234567890",
    "environment": "production-equivalent staging"
  },
  "methodology": [
    "OWASP Web Security Testing Guide",
    "OWASP API Security Top 10"
  ],
  "targetClasses": [
    "dashboard",
    "api",
    "auth",
    "oauth-vault",
    "crawler",
    "reports",
    "billing"
  ],
  "severitySummary": {
    "critical": 0,
    "high": 0,
    "medium": 0,
    "low": 0,
    "informational": 0
  },
  "findings": [],
  "openCriticalHighMediumCount": 0,
  "signedStatement": "We independently tested the SearchLint 1.0 release candidate and found no unresolved critical, high, or medium findings."
}
```

Do not include raw secrets, tokens, cookies, customer data, or exploit payloads
that could be directly reused.
