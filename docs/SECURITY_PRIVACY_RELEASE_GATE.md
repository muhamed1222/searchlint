# Security, Privacy, and Pentest Release Gate

Status date: 2026-06-22

`pnpm security:acceptance` verifies deterministic security/privacy release-gate
coverage for the current repository. It is not a substitute for DAST,
penetration testing, legal approval, or live production security review.

`pnpm security:dependency-audit` verifies the release-time dependency advisory
gate for the current pnpm lockfile and writes a machine-readable sanitized
report.

`pnpm security:sast` verifies the repository-owned static SAST gate for the
current product source.

`pnpm security:dast` verifies the deployed-target DAST release gate when live
production-equivalent dashboard and API URLs are explicitly provided.

`pnpm security:pentest` verifies the independent penetration-test release gate
when a passed DAST report, independent report summary, remediation evidence, and
owner approval are provided.

`pnpm security:privacy-requests` verifies deterministic execution contracts for
user data export, account deletion, and organization deletion.

## Verified Deterministic Scope

- Threat-model review mapped to current architecture and security model.
- SSRF/private-network crawler protection evidence.
- XSS output escaping and dashboard/report security-header contracts.
- CSRF/request-boundary posture for bearer-token JSON APIs.
- Injection protections through parameterized SQL and typed validation.
- OAuth vault handling, token references, refresh, and revocation evidence.
- Tenant isolation and RBAC evidence.
- Secrets handling and telemetry redaction evidence.
- Encryption-at-rest contracts for RDS, S3, CloudWatch logs, and KMS/Secrets
  Manager.
- Encryption-in-transit contracts for API/dashboard/object-storage boundaries.
- Backup, restore, retention, and deletion policy evidence.
- Privacy request lifecycle plans for data export, account deletion, and
  organization deletion.
- Deterministic privacy request execution contracts for data export, account
  deletion, and organization deletion.
- Draft privacy, terms, DPA, vulnerability disclosure, and security policy
  documents.
- Release-time dependency audit with zero reported pnpm audit vulnerabilities.
- Repository-owned static SAST with zero unreviewed findings.
- DAST release-gate harness and sanitized blocked evidence format.
- Independent penetration-test release-gate packet and sanitized blocked
  evidence format.

## Evidence

The verifier writes:

- `reports/security-privacy-acceptance-report.json`
- `docs/examples/security-privacy-acceptance-report.sample.json`

The checked sample is deterministic and sanitized. It must not include raw
tokens, private keys, API keys, database URLs, cookies, authorization headers,
customer data, or credentials.

## Command

```bash
pnpm security:acceptance
pnpm security:dependency-audit
pnpm security:sast
pnpm security:dast
pnpm security:pentest
pnpm security:privacy-requests
```

The command runs focused API tests, imports the built API surface, verifies
control coverage, verifies privacy request lifecycle plans, verifies disclosure
policy posture, and writes the machine-readable evidence report.

## Blocked External Gates

The release gate remains blocked until these independent artifacts exist:

- DAST run against a deployed production-equivalent target;
- owner review and approval of the DAST report;
- independent penetration test report summary, remediation evidence, and owner
  approval;
- legal/security review of public policies and repository boundary;
- deployed production security review for AWS, dashboard, API, workers, OAuth,
  billing, tenant isolation, logs, and telemetry.

## Not Claimed

This acceptance does not claim:

- DAST;
- penetration test;
- legal approval;
- production security review;
- live deployed privacy export/deletion execution;
- no known critical vulnerabilities across all future release artifacts.
