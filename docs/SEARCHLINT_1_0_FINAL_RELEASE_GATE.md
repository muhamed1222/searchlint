# SearchLint 1.0 Final Release Gate

Status date: 2026-06-22

Current final release verdict: `BLOCKED`.

This document is the final gate before creating Git tag `v1.0.0`, publishing npm
packages, publishing the VS Code extension, deploying the public website, and
announcing SearchLint 1.0.

Use `docs/RELEASE_EVIDENCE_CONTROL_BOARD.md` to route the remaining external
evidence packages before this final gate is retried. The control board is not
release evidence and does not approve the final release.

## Gate Semantics

`pnpm final-release:gate` verifies that the repository has explicit final
release-gate evidence and that the current blocked state is recorded. It does
not approve the release.

The command must continue to block final release until all required external,
live, legal, and publication evidence exists.

The command also runs `pnpm release:evidence-readiness` before evaluating the
final gate so the latest owner-evidence, template, missing-evidence, and intake
status is part of the final release report.

## Required Final Evidence

| Gate                     | Current status | Required evidence                                                                                                                                                                     |
| ------------------------ | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OD-023 reviewer sign-off | Blocked        | Real `reviewer-1.review.json` and `reviewer-2.review.json` with complete benchmark coverage and no unresolved disputes                                                                |
| Rule QA final gate       | Blocked        | Successful `pnpm rule-qa:review` after independent review                                                                                                                             |
| Legal approval           | Blocked        | Approved `LICENSE`, `NOTICE`, `CONTRIBUTING.md`, `DCO.md`, `SECURITY.md`, trademark policy, package metadata, VS Code copy, website copy, and repository boundary                     |
| Repository split         | Blocked        | Public/private split evidence proving private cloud code is excluded from the public repository                                                                                       |
| Branch protection and CI | Blocked        | Protected main branch and required CI checks configured in repository hosting                                                                                                         |
| npm packages             | Blocked        | Trusted publishing, provenance, beta/final publication, and clean install from the public registry                                                                                    |
| VS Code extension        | Blocked        | Marketplace publisher setup, production VSIX, Marketplace publication, and clean install evidence                                                                                     |
| Public website/docs      | Blocked        | Deployed public website/docs with approved copy and support/security routing                                                                                                          |
| Onboarding               | Evidence       | `pnpm onboarding:final` passes for source-level onboarding guide, wizard inputs/outputs, demo project, and release-honesty markers                                                    |
| Zero production impact   | Evidence       | `pnpm zero-impact:final` passes for Next.js 15/16 App Router and Pages Router real fixtures installed from packed public package candidates                                           |
| PostgreSQL/RDS           | Blocked        | Live RDS deployment, migrations, connection pooling, backups, restore, and load evidence                                                                                              |
| S3/Object storage        | Blocked        | Live object storage upload/download/delete/signed URL/restore/access-log evidence                                                                                                     |
| Backend API              | Blocked        | Live API Gateway/ECS/RDS deployment, OpenAPI conformance, load testing, and security testing                                                                                          |
| Queues/workers           | Blocked        | Live SQS/DLQ/ECS/EventBridge workers, retries, autoscaling, cancellation, metrics, and alerts                                                                                         |
| Auth/RBAC                | Blocked        | Live Cognito/OIDC registration, login, logout, MFA, invite, permissions, tenant isolation, and audit evidence                                                                         |
| OAuth vault              | Blocked        | Live KMS/Secrets Manager token write/read/refresh/rotation/revocation and external security review                                                                                    |
| Dashboard                | Blocked        | Production dashboard E2E with auth/API integration, accessibility, visual, and browser compatibility evidence                                                                         |
| Google integrations      | Blocked        | Live Google OAuth, Search Console, URL Inspection, PageSpeed, CrUX, quota, freshness, and dashboard evidence                                                                          |
| Yandex integrations      | Blocked        | Live Yandex OAuth, Webmaster, Metrica, quota, freshness, and dashboard evidence                                                                                                       |
| Billing                  | Blocked        | Live Stripe products/prices, checkout, portal, subscriptions, webhooks, entitlements, and billing UI evidence                                                                         |
| Reports                  | Evidence       | `pnpm reports:final-readiness` passes for final report formats, PDF rendering, hosted links static contract, access controls static contract, expiration, and history static contract |
| Notifications            | Blocked        | Live email/Slack/webhook/Telegram delivery, scheduler, settings persistence, retries, and redaction evidence                                                                          |
| Agency mode              | Blocked        | Deployed client portal, live agency billing, hosted white-label reports, and client invite evidence                                                                                   |
| Observability            | Blocked        | Live logging, metrics, tracing, dashboards, alerts, error tracking, incident delivery, and redaction evidence                                                                         |
| Security/privacy         | Blocked        | DAST, penetration test, final security approval, deployed production security review, and live privacy export/deletion evidence                                                       |
| Documentation            | Evidence       | `pnpm docs:final-readiness` passes for final README, installation, compatibility, contribution, changelog, release notes, support, upgrade, onboarding-source, and demo documentation |
| Final RC matrix          | Blocked        | Passing final RC matrix against deployed and public artifacts                                                                                                                         |
| Git tag                  | Blocked        | `v1.0.0` tag created only after all gates pass                                                                                                                                        |
| Public release           | Blocked        | SearchLint 1.0 release evidence and announcement after tag/publication                                                                                                                |

## Forbidden Actions While Blocked

- Do not create `v1.0.0`.
- Do not publish final npm packages.
- Do not publish the VS Code extension as SearchLint 1.0.
- Do not announce SearchLint 1.0.
- Do not mark SearchLint 1.0 release gate as passed.

## Current Evidence

- `docs/RELEASE_EVIDENCE_READINESS_SUMMARY.md`
- `docs/examples/release-evidence-readiness-summary-report.sample.json`
- `docs/SEARCHLINT_1_0_RELEASE_CANDIDATE_MATRIX.md`
- `docs/examples/searchlint-1-0-rc-matrix-report.sample.json`
- `docs/PACKAGE_PUBLICATION_READINESS.md`
- `docs/LEGAL_RELEASE_GATE_CHECKLIST.md`
- `docs/PUBLIC_PRIVATE_REPOSITORY_BOUNDARY_PLAN.md`
- `docs/ZERO_PRODUCTION_IMPACT_FINAL_GATE.md`
- `docs/examples/zero-production-impact-final-report.sample.json`
- `docs/REPORTS_FINAL_READINESS.md`
- `docs/examples/reports-final-readiness-report.sample.json`
- `docs/DOCUMENTATION_FINAL_READINESS.md`
- `docs/examples/documentation-final-readiness-report.sample.json`
- `docs/ONBOARDING_FINAL_READINESS.md`
- `docs/examples/onboarding-source-final-report.sample.json`
- `docs/SEARCHLINT_1_0_MASTER_CHECKLIST.md`

## Pass Criteria

This final gate passes only when every gate above has real evidence and
`pnpm final-release:gate` is updated to verify a passed release state instead of
the current blocked state.
