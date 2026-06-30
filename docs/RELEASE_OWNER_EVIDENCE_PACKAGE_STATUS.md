# Release Owner Evidence Package Status

Generated at: 2026-06-23T00:00:00.000Z

This status is generated from
`reports/release-owner-evidence-runbook-report.json` and
`reports/release-evidence-intake-status-report.json`. It tracks owner evidence
packages. It does not create evidence or close release gates.

## Summary

- status: `blocked_waiting_for_owner_evidence`
- packages: 0/7 complete
- missing owner inputs: 60
- present owner inputs: 0
- release gate claim: `not_claimed`

## Packages

| Package                            | Status                           | Missing | Present | Blocked/failing |
| ---------------------------------- | -------------------------------- | ------: | ------: | --------------: |
| Reviewer And Rule Quality          | `blocked_missing_owner_evidence` |       3 |       0 |               3 |
| Governance And Legal               | `blocked_missing_owner_evidence` |       1 |       0 |               1 |
| npm And VS Code Publication        | `blocked_missing_owner_evidence` |       7 |       0 |               7 |
| Production Platform                | `blocked_missing_owner_evidence` |      21 |       0 |              21 |
| Live Provider Acceptance           | `blocked_missing_owner_evidence` |      17 |       0 |              17 |
| Security Accessibility And Website | `blocked_missing_owner_evidence` |       8 |       0 |               8 |
| Final Release                      | `blocked_missing_owner_evidence` |       3 |       0 |               3 |

## Reviewer And Rule Quality

Status: `blocked_missing_owner_evidence`

- `docs/reviews/blocker-benchmark/DELIVERY_EVIDENCE.json`: `missing`; templates
  4; commands `pnpm rule-qa:review-delivery`
- `docs/reviews/blocker-benchmark/reviewer-1.review.json`: `missing`; templates
  4; commands `pnpm rule-qa:review`
- `docs/reviews/blocker-benchmark/reviewer-2.review.json`: `missing`; templates
  4; commands `pnpm rule-qa:review`

## Governance And Legal

Status: `blocked_missing_owner_evidence`

- `docs/legal-release-approval.json`: `missing`; templates 1; commands
  `pnpm legal:release-gate`

## npm And VS Code Publication

Status: `blocked_missing_owner_evidence`

- `docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-npm-pakety-opublikovany.json`:
  `missing`; templates 1; commands `pnpm final-release:gate`
- `docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-vs-code-extension-opublikovan.json`:
  `missing`; templates 1; commands `pnpm vscode:update-e2e`
- `docs/release-owner-evidence/7-vs-code-i-lsp-nastroit-publisher-account.json`:
  `missing`; templates 1; commands `pnpm vscode:update-e2e`
- `docs/release-owner-evidence/7-vs-code-i-lsp-podpisat-i-opublikovat-extension.json`:
  `missing`; templates 1; commands `pnpm vscode:update-e2e`
- `docs/release-owner-evidence/8-npm-pakety-opublikovat-beta-packages.json`:
  `missing`; templates 1; commands `pnpm package:beta-publication-gate`
- `docs/release-owner-evidence/8-npm-pakety-podgotovit-finalnuyu-publikaciyu-1-0-0.json`:
  `missing`; templates 1; commands `pnpm final-release:gate`
- `docs/release-owner-evidence/8-npm-pakety-zamenit-0-0-0-beta-versions-na-final-release-versions.json`:
  `missing`; templates 1; commands `pnpm final-release:gate`

## Production Platform

Status: `blocked_missing_owner_evidence`

- `docs/live-backup-restore-drill.json`: `missing`; templates 1; commands
  `pnpm backup:restore-live-gate`
- `docs/release-owner-evidence/10-crawler-proverit-100-000-url-v-cloud.json`:
  `missing`; templates 1; commands `pnpm crawler:acceptance`
- `docs/release-owner-evidence/11-postgresql-i-hranenie-dannyh-razvernut-nastoyashii-postgresql-rds.json`:
  `missing`; templates 1; commands `pnpm verify:postgres`
- `docs/release-owner-evidence/12-s3-object-storage-razvernut-realnoe-object-storage.json`:
  `missing`; templates 1; commands `pnpm object-storage:acceptance`
- `docs/release-owner-evidence/13-backend-api-razvernut-production-api.json`:
  `missing`; templates 1; commands `pnpm api:acceptance`
- `docs/release-owner-evidence/22-istoriya-i-korrelyaciya-provesti-deployed-dashboard-timeline-acceptance.json`:
  `missing`; templates 1; commands `pnpm dashboard:production-e2e`
- `docs/release-owner-evidence/25-billing-proverit-deployed-stripe-webhook-persistence-on-rds.json`:
  `missing`; templates 1; commands `pnpm verify:postgres`
- `docs/release-owner-evidence/26-agency-mode-razvernut-client-portal.json`:
  `missing`; templates 1; commands `pnpm agency:client-access-browser-e2e`
- `docs/release-owner-evidence/27-observability-podklyuchit-cloudwatch-otlp.json`:
  `missing`; templates 1; commands `pnpm observability:acceptance`
- `docs/release-owner-evidence/27-observability-razvernut-logging.json`:
  `missing`; templates 1; commands `pnpm observability:acceptance`
- `docs/release-owner-evidence/27-observability-razvernut-metrics.json`:
  `missing`; templates 1; commands `pnpm observability:acceptance`
- `docs/release-owner-evidence/27-observability-razvernut-tracing.json`:
  `missing`; templates 1; commands `pnpm observability:acceptance`
- `docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-agency-mode-gotov.json`:
  `missing`; templates 1; commands `pnpm agency:acceptance`
- `docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-api-deployment-proof-proiden.json`:
  `missing`; templates 1; commands `pnpm api:acceptance`
- `docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-cognito-rbac-proof-proiden.json`:
  `missing`; templates 1; commands `pnpm auth:acceptance`
- `docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-dashboard-production-e2e-proiden.json`:
  `missing`; templates 1; commands `pnpm dashboard:production-e2e`
- `docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-oauth-vault-proof-proiden.json`:
  `missing`; templates 1; commands `pnpm oauth-vault:acceptance`
- `docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-observability-gotova.json`:
  `missing`; templates 1; commands `pnpm observability:acceptance`
- `docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-postgresql-rds-proof-proiden.json`:
  `missing`; templates 1; commands `pnpm verify:postgres`
- `docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-s3-proof-proiden.json`:
  `missing`; templates 1; commands `pnpm object-storage:acceptance`
- `docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-workers-sqs-proof-proiden.json`:
  `missing`; templates 1; commands `pnpm workers:acceptance`

## Live Provider Acceptance

Status: `blocked_missing_owner_evidence`

- `docs/release-owner-evidence/18-google-search-console-provesti-live-acceptance-na-realnom-saite.json`:
  `missing`; templates 1; commands `pnpm google:gsc:acceptance`
- `docs/release-owner-evidence/19-pagespeed-i-crux-provesti-live-acceptance.json`:
  `missing`; templates 1; commands `pnpm google:performance:acceptance`
- `docs/release-owner-evidence/20-yandeks-vebmaster-provesti-live-acceptance.json`:
  `missing`; templates 1; commands `pnpm yandex:acceptance`
- `docs/release-owner-evidence/21-yandeks-metrika-provesti-live-acceptance.json`:
  `missing`; templates 1; commands `pnpm yandex:acceptance`
- `docs/release-owner-evidence/24-notifications-provesti-live-email-delivery-acceptance.json`:
  `missing`; templates 1; commands `pnpm notifications:acceptance`
- `docs/release-owner-evidence/24-notifications-provesti-live-slack-delivery-acceptance.json`:
  `missing`; templates 1; commands `pnpm notifications:acceptance`
- `docs/release-owner-evidence/24-notifications-provesti-live-telegram-delivery-acceptance-esli-nuzhen.json`:
  `missing`; templates 1; commands `pnpm notifications:acceptance`
- `docs/release-owner-evidence/24-notifications-provesti-live-webhook-delivery-acceptance.json`:
  `missing`; templates 1; commands `pnpm notifications:acceptance`
- `docs/release-owner-evidence/25-billing-provesti-live-customer-portal-acceptance.json`:
  `missing`; templates 1; commands
  `pnpm billing:live-stripe-final-acceptance-packet`
- `docs/release-owner-evidence/25-billing-provesti-live-stripe-acceptance.json`:
  `missing`; templates 1; commands
  `pnpm billing:live-stripe-final-acceptance-packet`
- `docs/release-owner-evidence/25-billing-provesti-live-subscription-trial-upgrade-downgrade-cancellation-acceptance.json`:
  `missing`; templates 1; commands
  `pnpm billing:live-stripe-final-acceptance-packet`
- `docs/release-owner-evidence/26-agency-mode-proverit-client-invite-email-delivery.json`:
  `missing`; templates 1; commands `pnpm notifications:acceptance`
- `docs/release-owner-evidence/26-agency-mode-realizovat-live-agency-billing.json`:
  `missing`; templates 1; commands
  `pnpm billing:live-stripe-final-acceptance-packet`
- `docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-billing-live-acceptance-proiden.json`:
  `missing`; templates 1; commands
  `pnpm billing:live-stripe-final-acceptance-packet`
- `docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-google-live-acceptance-proiden.json`:
  `missing`; templates 1; commands `pnpm google:gsc:acceptance`
- `docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-notifications-gotovy.json`:
  `missing`; templates 1; commands `pnpm notifications:acceptance`
- `docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-yandex-live-acceptance-proiden.json`:
  `missing`; templates 1; commands `pnpm yandex:acceptance`

## Security Accessibility And Website

Status: `blocked_missing_owner_evidence`

- `docs/release-owner-evidence/28-security-i-privacy-provesti-dast.json`:
  `missing`; templates 1; commands `pnpm security:dast`
- `docs/release-owner-evidence/28-security-i-privacy-zavershit-security-release-gate.json`:
  `missing`; templates 1; commands `pnpm security:dast`
- `docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-public-website-gotov.json`:
  `missing`; templates 1; commands `pnpm website:acceptance`
- `docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-security-audit-proiden.json`:
  `missing`; templates 1; commands `pnpm security:dast`
- `docs/reviews/oauth-vault-security/reviewer-1.review.json`: `missing`;
  templates 1; commands `pnpm oauth-vault:security-review`
- `docs/reviews/oauth-vault-security/reviewer-2.review.json`: `missing`;
  templates 1; commands `pnpm oauth-vault:security-review`
- `docs/reviews/overlay-accessibility/reviewer.review.json`: `missing`;
  templates 1; commands `pnpm overlay:manual-a11y-review`
- `docs/reviews/penetration-test/report-summary.json`: `missing`; templates 1;
  commands `pnpm security:pentest`

## Final Release

Status: `blocked_missing_owner_evidence`

- `docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-opublikovan-searchlint-1-0.json`:
  `missing`; templates 1; commands `pnpm final-release:gate`
- `docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-release-candidate-proshel-polnuyu-matricu.json`:
  `missing`; templates 1; commands `pnpm final-release:gate`
- `docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-sozdan-git-tag-v1-0-0.json`:
  `missing`; templates 1; commands `pnpm final-release:gate`

## Non-Claims

- This verifier does not create owner evidence.
- This verifier does not close release gates.
- Package status is informational until real evidence exists and dedicated
  verifiers pass.
