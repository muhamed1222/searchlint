# Release Owner Evidence Runbook

Generated at: 2026-06-23T00:00:00.000Z

This runbook aggregates missing owner evidence inputs from
`reports/release-missing-evidence-template-index-report.json`. It does not
create evidence and it does not close release gates.

## Summary

- status: `blocked_waiting_for_owner_evidence`
- checklist: 522/599 done; 77 remaining
- missing owner inputs: 60
- evidence packages: 7
- real owner evidence files: 0
- release gate claim: `not_claimed`

## Package Summary

| Package                            | Missing inputs | Related commands                                                                                                                                                                                                                                                                                                                                                                         |
| ---------------------------------- | -------------: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reviewer And Rule Quality          |              3 | `pnpm rule-qa:review-delivery`<br>`pnpm rule-qa:review`                                                                                                                                                                                                                                                                                                                                  |
| Governance And Legal               |              1 | `pnpm legal:release-gate`                                                                                                                                                                                                                                                                                                                                                                |
| npm And VS Code Publication        |              7 | `pnpm final-release:gate`<br>`pnpm vscode:update-e2e`<br>`pnpm package:beta-publication-gate`                                                                                                                                                                                                                                                                                            |
| Production Platform                |             21 | `pnpm backup:restore-live-gate`<br>`pnpm crawler:acceptance`<br>`pnpm verify:postgres`<br>`pnpm object-storage:acceptance`<br>`pnpm api:acceptance`<br>`pnpm dashboard:production-e2e`<br>`pnpm agency:client-access-browser-e2e`<br>`pnpm observability:acceptance`<br>`pnpm agency:acceptance`<br>`pnpm auth:acceptance`<br>`pnpm oauth-vault:acceptance`<br>`pnpm workers:acceptance` |
| Live Provider Acceptance           |             17 | `pnpm google:gsc:acceptance`<br>`pnpm google:performance:acceptance`<br>`pnpm yandex:acceptance`<br>`pnpm notifications:acceptance`<br>`pnpm billing:live-stripe-final-acceptance-packet`                                                                                                                                                                                                |
| Security Accessibility And Website |              8 | `pnpm security:dast`<br>`pnpm website:acceptance`<br>`pnpm oauth-vault:security-review`<br>`pnpm overlay:manual-a11y-review`<br>`pnpm security:pentest`                                                                                                                                                                                                                                  |
| Final Release                      |              3 | `pnpm final-release:gate`                                                                                                                                                                                                                                                                                                                                                                |

## Reviewer And Rule Quality

Independent OD-023 reviewer delivery, review files, adjudication, and final rule
quality evidence.

### docs/reviews/blocker-benchmark/DELIVERY_EVIDENCE.json

- templates: `docs/reviews/blocker-benchmark/DELIVERY_EVIDENCE.example.json`,
  `docs/reviews/blocker-benchmark/README.md`,
  `docs/reviews/blocker-benchmark/REVIEW_INSTRUCTIONS.md`,
  `docs/reviews/blocker-benchmark/REVIEW_FORM_TEMPLATE.md`
- related commands: `pnpm rule-qa:review-delivery`
- related gate count: 1
- owner action: Create docs/reviews/blocker-benchmark/DELIVERY_EVIDENCE.json
  from the listed template/instructions using real owner or reviewer evidence,
  then run pnpm rule-qa:review-delivery.

### docs/reviews/blocker-benchmark/reviewer-1.review.json

- templates: `docs/reviews/blocker-benchmark/reviewer-1.review.example.json`,
  `docs/reviews/blocker-benchmark/README.md`,
  `docs/reviews/blocker-benchmark/REVIEW_INSTRUCTIONS.md`,
  `docs/reviews/blocker-benchmark/REVIEW_FORM_TEMPLATE.md`
- related commands: `pnpm rule-qa:review`
- related gate count: 13
- owner action: Create docs/reviews/blocker-benchmark/reviewer-1.review.json
  from the listed template/instructions using real owner or reviewer evidence,
  then run pnpm rule-qa:review.

### docs/reviews/blocker-benchmark/reviewer-2.review.json

- templates: `docs/reviews/blocker-benchmark/reviewer-2.review.example.json`,
  `docs/reviews/blocker-benchmark/README.md`,
  `docs/reviews/blocker-benchmark/REVIEW_INSTRUCTIONS.md`,
  `docs/reviews/blocker-benchmark/REVIEW_FORM_TEMPLATE.md`
- related commands: `pnpm rule-qa:review`
- related gate count: 13
- owner action: Create docs/reviews/blocker-benchmark/reviewer-2.review.json
  from the listed template/instructions using real owner or reviewer evidence,
  then run pnpm rule-qa:review.

## Governance And Legal

Hosted GitHub governance and qualified legal approval evidence.

### docs/legal-release-approval.json

- templates: `docs/legal-release-approval.example.json`
- related commands: `pnpm legal:release-gate`
- related gate count: 2
- owner action: Create docs/legal-release-approval.json from the listed
  template/instructions using real owner or reviewer evidence, then run pnpm
  legal:release-gate.

## npm And VS Code Publication

npm package publication, final version, clean install, VS Code publisher, and
Marketplace evidence.

### docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-npm-pakety-opublikovany.json

- templates:
  `docs/release-owner-evidence/templates/31-finalnyi-searchlint-1-0-release-gate-npm-pakety-opublikovany.example.json`
- related commands: `pnpm final-release:gate`
- related gate count: 1
- owner action: Create
  docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-npm-pakety-opublikovany.json
  from the listed template/instructions using real owner or reviewer evidence,
  then run pnpm final-release:gate.

### docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-vs-code-extension-opublikovan.json

- templates:
  `docs/release-owner-evidence/templates/31-finalnyi-searchlint-1-0-release-gate-vs-code-extension-opublikovan.example.json`
- related commands: `pnpm vscode:update-e2e`
- related gate count: 1
- owner action: Create
  docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-vs-code-extension-opublikovan.json
  from the listed template/instructions using real owner or reviewer evidence,
  then run pnpm vscode:update-e2e.

### docs/release-owner-evidence/7-vs-code-i-lsp-nastroit-publisher-account.json

- templates:
  `docs/release-owner-evidence/templates/7-vs-code-i-lsp-nastroit-publisher-account.example.json`
- related commands: `pnpm vscode:update-e2e`
- related gate count: 1
- owner action: Create
  docs/release-owner-evidence/7-vs-code-i-lsp-nastroit-publisher-account.json
  from the listed template/instructions using real owner or reviewer evidence,
  then run pnpm vscode:update-e2e.

### docs/release-owner-evidence/7-vs-code-i-lsp-podpisat-i-opublikovat-extension.json

- templates:
  `docs/release-owner-evidence/templates/7-vs-code-i-lsp-podpisat-i-opublikovat-extension.example.json`
- related commands: `pnpm vscode:update-e2e`
- related gate count: 1
- owner action: Create
  docs/release-owner-evidence/7-vs-code-i-lsp-podpisat-i-opublikovat-extension.json
  from the listed template/instructions using real owner or reviewer evidence,
  then run pnpm vscode:update-e2e.

### docs/release-owner-evidence/8-npm-pakety-opublikovat-beta-packages.json

- templates:
  `docs/release-owner-evidence/templates/8-npm-pakety-opublikovat-beta-packages.example.json`
- related commands: `pnpm package:beta-publication-gate`
- related gate count: 1
- owner action: Create
  docs/release-owner-evidence/8-npm-pakety-opublikovat-beta-packages.json from
  the listed template/instructions using real owner or reviewer evidence, then
  run pnpm package:beta-publication-gate.

### docs/release-owner-evidence/8-npm-pakety-podgotovit-finalnuyu-publikaciyu-1-0-0.json

- templates:
  `docs/release-owner-evidence/templates/8-npm-pakety-podgotovit-finalnuyu-publikaciyu-1-0-0.example.json`
- related commands: `pnpm final-release:gate`
- related gate count: 1
- owner action: Create
  docs/release-owner-evidence/8-npm-pakety-podgotovit-finalnuyu-publikaciyu-1-0-0.json
  from the listed template/instructions using real owner or reviewer evidence,
  then run pnpm final-release:gate.

### docs/release-owner-evidence/8-npm-pakety-zamenit-0-0-0-beta-versions-na-final-release-versions.json

- templates:
  `docs/release-owner-evidence/templates/8-npm-pakety-zamenit-0-0-0-beta-versions-na-final-release-versions.example.json`
- related commands: `pnpm final-release:gate`
- related gate count: 1
- owner action: Create
  docs/release-owner-evidence/8-npm-pakety-zamenit-0-0-0-beta-versions-na-final-release-versions.json
  from the listed template/instructions using real owner or reviewer evidence,
  then run pnpm final-release:gate.

## Production Platform

Cloud runtime, database, object storage, API, workers, dashboard, backup,
observability, and agency evidence.

### docs/live-backup-restore-drill.json

- templates: `docs/live-backup-restore-drill.example.json`
- related commands: `pnpm backup:restore-live-gate`
- related gate count: 1
- owner action: Create docs/live-backup-restore-drill.json from the listed
  template/instructions using real owner or reviewer evidence, then run pnpm
  backup:restore-live-gate.

### docs/release-owner-evidence/10-crawler-proverit-100-000-url-v-cloud.json

- templates:
  `docs/release-owner-evidence/templates/10-crawler-proverit-100-000-url-v-cloud.example.json`
- related commands: `pnpm crawler:acceptance`
- related gate count: 1
- owner action: Create
  docs/release-owner-evidence/10-crawler-proverit-100-000-url-v-cloud.json from
  the listed template/instructions using real owner or reviewer evidence, then
  run pnpm crawler:acceptance.

### docs/release-owner-evidence/11-postgresql-i-hranenie-dannyh-razvernut-nastoyashii-postgresql-rds.json

- templates:
  `docs/release-owner-evidence/templates/11-postgresql-i-hranenie-dannyh-razvernut-nastoyashii-postgresql-rds.example.json`
- related commands: `pnpm verify:postgres`
- related gate count: 1
- owner action: Create
  docs/release-owner-evidence/11-postgresql-i-hranenie-dannyh-razvernut-nastoyashii-postgresql-rds.json
  from the listed template/instructions using real owner or reviewer evidence,
  then run pnpm verify:postgres.

### docs/release-owner-evidence/12-s3-object-storage-razvernut-realnoe-object-storage.json

- templates:
  `docs/release-owner-evidence/templates/12-s3-object-storage-razvernut-realnoe-object-storage.example.json`
- related commands: `pnpm object-storage:acceptance`
- related gate count: 1
- owner action: Create
  docs/release-owner-evidence/12-s3-object-storage-razvernut-realnoe-object-storage.json
  from the listed template/instructions using real owner or reviewer evidence,
  then run pnpm object-storage:acceptance.

### docs/release-owner-evidence/13-backend-api-razvernut-production-api.json

- templates:
  `docs/release-owner-evidence/templates/13-backend-api-razvernut-production-api.example.json`
- related commands: `pnpm api:acceptance`
- related gate count: 1
- owner action: Create
  docs/release-owner-evidence/13-backend-api-razvernut-production-api.json from
  the listed template/instructions using real owner or reviewer evidence, then
  run pnpm api:acceptance.

### docs/release-owner-evidence/22-istoriya-i-korrelyaciya-provesti-deployed-dashboard-timeline-acceptance.json

- templates:
  `docs/release-owner-evidence/templates/22-istoriya-i-korrelyaciya-provesti-deployed-dashboard-timeline-acceptance.example.json`
- related commands: `pnpm dashboard:production-e2e`
- related gate count: 1
- owner action: Create
  docs/release-owner-evidence/22-istoriya-i-korrelyaciya-provesti-deployed-dashboard-timeline-acceptance.json
  from the listed template/instructions using real owner or reviewer evidence,
  then run pnpm dashboard:production-e2e.

### docs/release-owner-evidence/25-billing-proverit-deployed-stripe-webhook-persistence-on-rds.json

- templates:
  `docs/release-owner-evidence/templates/25-billing-proverit-deployed-stripe-webhook-persistence-on-rds.example.json`
- related commands: `pnpm verify:postgres`
- related gate count: 1
- owner action: Create
  docs/release-owner-evidence/25-billing-proverit-deployed-stripe-webhook-persistence-on-rds.json
  from the listed template/instructions using real owner or reviewer evidence,
  then run pnpm verify:postgres.

### docs/release-owner-evidence/26-agency-mode-razvernut-client-portal.json

- templates:
  `docs/release-owner-evidence/templates/26-agency-mode-razvernut-client-portal.example.json`
- related commands: `pnpm agency:client-access-browser-e2e`
- related gate count: 1
- owner action: Create
  docs/release-owner-evidence/26-agency-mode-razvernut-client-portal.json from
  the listed template/instructions using real owner or reviewer evidence, then
  run pnpm agency:client-access-browser-e2e.

### docs/release-owner-evidence/27-observability-podklyuchit-cloudwatch-otlp.json

- templates:
  `docs/release-owner-evidence/templates/27-observability-podklyuchit-cloudwatch-otlp.example.json`
- related commands: `pnpm observability:acceptance`
- related gate count: 1
- owner action: Create
  docs/release-owner-evidence/27-observability-podklyuchit-cloudwatch-otlp.json
  from the listed template/instructions using real owner or reviewer evidence,
  then run pnpm observability:acceptance.

### docs/release-owner-evidence/27-observability-razvernut-logging.json

- templates:
  `docs/release-owner-evidence/templates/27-observability-razvernut-logging.example.json`
- related commands: `pnpm observability:acceptance`
- related gate count: 1
- owner action: Create
  docs/release-owner-evidence/27-observability-razvernut-logging.json from the
  listed template/instructions using real owner or reviewer evidence, then run
  pnpm observability:acceptance.

### docs/release-owner-evidence/27-observability-razvernut-metrics.json

- templates:
  `docs/release-owner-evidence/templates/27-observability-razvernut-metrics.example.json`
- related commands: `pnpm observability:acceptance`
- related gate count: 1
- owner action: Create
  docs/release-owner-evidence/27-observability-razvernut-metrics.json from the
  listed template/instructions using real owner or reviewer evidence, then run
  pnpm observability:acceptance.

### docs/release-owner-evidence/27-observability-razvernut-tracing.json

- templates:
  `docs/release-owner-evidence/templates/27-observability-razvernut-tracing.example.json`
- related commands: `pnpm observability:acceptance`
- related gate count: 1
- owner action: Create
  docs/release-owner-evidence/27-observability-razvernut-tracing.json from the
  listed template/instructions using real owner or reviewer evidence, then run
  pnpm observability:acceptance.

### docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-agency-mode-gotov.json

- templates:
  `docs/release-owner-evidence/templates/31-finalnyi-searchlint-1-0-release-gate-agency-mode-gotov.example.json`
- related commands: `pnpm agency:acceptance`
- related gate count: 1
- owner action: Create
  docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-agency-mode-gotov.json
  from the listed template/instructions using real owner or reviewer evidence,
  then run pnpm agency:acceptance.

### docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-api-deployment-proof-proiden.json

- templates:
  `docs/release-owner-evidence/templates/31-finalnyi-searchlint-1-0-release-gate-api-deployment-proof-proiden.example.json`
- related commands: `pnpm api:acceptance`
- related gate count: 1
- owner action: Create
  docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-api-deployment-proof-proiden.json
  from the listed template/instructions using real owner or reviewer evidence,
  then run pnpm api:acceptance.

### docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-cognito-rbac-proof-proiden.json

- templates:
  `docs/release-owner-evidence/templates/31-finalnyi-searchlint-1-0-release-gate-cognito-rbac-proof-proiden.example.json`
- related commands: `pnpm auth:acceptance`
- related gate count: 1
- owner action: Create
  docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-cognito-rbac-proof-proiden.json
  from the listed template/instructions using real owner or reviewer evidence,
  then run pnpm auth:acceptance.

### docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-dashboard-production-e2e-proiden.json

- templates:
  `docs/release-owner-evidence/templates/31-finalnyi-searchlint-1-0-release-gate-dashboard-production-e2e-proiden.example.json`
- related commands: `pnpm dashboard:production-e2e`
- related gate count: 1
- owner action: Create
  docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-dashboard-production-e2e-proiden.json
  from the listed template/instructions using real owner or reviewer evidence,
  then run pnpm dashboard:production-e2e.

### docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-oauth-vault-proof-proiden.json

- templates:
  `docs/release-owner-evidence/templates/31-finalnyi-searchlint-1-0-release-gate-oauth-vault-proof-proiden.example.json`
- related commands: `pnpm oauth-vault:acceptance`
- related gate count: 1
- owner action: Create
  docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-oauth-vault-proof-proiden.json
  from the listed template/instructions using real owner or reviewer evidence,
  then run pnpm oauth-vault:acceptance.

### docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-observability-gotova.json

- templates:
  `docs/release-owner-evidence/templates/31-finalnyi-searchlint-1-0-release-gate-observability-gotova.example.json`
- related commands: `pnpm observability:acceptance`
- related gate count: 1
- owner action: Create
  docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-observability-gotova.json
  from the listed template/instructions using real owner or reviewer evidence,
  then run pnpm observability:acceptance.

### docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-postgresql-rds-proof-proiden.json

- templates:
  `docs/release-owner-evidence/templates/31-finalnyi-searchlint-1-0-release-gate-postgresql-rds-proof-proiden.example.json`
- related commands: `pnpm verify:postgres`
- related gate count: 1
- owner action: Create
  docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-postgresql-rds-proof-proiden.json
  from the listed template/instructions using real owner or reviewer evidence,
  then run pnpm verify:postgres.

### docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-s3-proof-proiden.json

- templates:
  `docs/release-owner-evidence/templates/31-finalnyi-searchlint-1-0-release-gate-s3-proof-proiden.example.json`
- related commands: `pnpm object-storage:acceptance`
- related gate count: 1
- owner action: Create
  docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-s3-proof-proiden.json
  from the listed template/instructions using real owner or reviewer evidence,
  then run pnpm object-storage:acceptance.

### docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-workers-sqs-proof-proiden.json

- templates:
  `docs/release-owner-evidence/templates/31-finalnyi-searchlint-1-0-release-gate-workers-sqs-proof-proiden.example.json`
- related commands: `pnpm workers:acceptance`
- related gate count: 1
- owner action: Create
  docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-workers-sqs-proof-proiden.json
  from the listed template/instructions using real owner or reviewer evidence,
  then run pnpm workers:acceptance.

## Live Provider Acceptance

Live Google, Yandex, Stripe, notifications, and other provider acceptance
evidence.

### docs/release-owner-evidence/18-google-search-console-provesti-live-acceptance-na-realnom-saite.json

- templates:
  `docs/release-owner-evidence/templates/18-google-search-console-provesti-live-acceptance-na-realnom-saite.example.json`
- related commands: `pnpm google:gsc:acceptance`
- related gate count: 1
- owner action: Create
  docs/release-owner-evidence/18-google-search-console-provesti-live-acceptance-na-realnom-saite.json
  from the listed template/instructions using real owner or reviewer evidence,
  then run pnpm google:gsc:acceptance.

### docs/release-owner-evidence/19-pagespeed-i-crux-provesti-live-acceptance.json

- templates:
  `docs/release-owner-evidence/templates/19-pagespeed-i-crux-provesti-live-acceptance.example.json`
- related commands: `pnpm google:performance:acceptance`
- related gate count: 1
- owner action: Create
  docs/release-owner-evidence/19-pagespeed-i-crux-provesti-live-acceptance.json
  from the listed template/instructions using real owner or reviewer evidence,
  then run pnpm google:performance:acceptance.

### docs/release-owner-evidence/20-yandeks-vebmaster-provesti-live-acceptance.json

- templates:
  `docs/release-owner-evidence/templates/20-yandeks-vebmaster-provesti-live-acceptance.example.json`
- related commands: `pnpm yandex:acceptance`
- related gate count: 1
- owner action: Create
  docs/release-owner-evidence/20-yandeks-vebmaster-provesti-live-acceptance.json
  from the listed template/instructions using real owner or reviewer evidence,
  then run pnpm yandex:acceptance.

### docs/release-owner-evidence/21-yandeks-metrika-provesti-live-acceptance.json

- templates:
  `docs/release-owner-evidence/templates/21-yandeks-metrika-provesti-live-acceptance.example.json`
- related commands: `pnpm yandex:acceptance`
- related gate count: 1
- owner action: Create
  docs/release-owner-evidence/21-yandeks-metrika-provesti-live-acceptance.json
  from the listed template/instructions using real owner or reviewer evidence,
  then run pnpm yandex:acceptance.

### docs/release-owner-evidence/24-notifications-provesti-live-email-delivery-acceptance.json

- templates:
  `docs/release-owner-evidence/templates/24-notifications-provesti-live-email-delivery-acceptance.example.json`
- related commands: `pnpm notifications:acceptance`
- related gate count: 1
- owner action: Create
  docs/release-owner-evidence/24-notifications-provesti-live-email-delivery-acceptance.json
  from the listed template/instructions using real owner or reviewer evidence,
  then run pnpm notifications:acceptance.

### docs/release-owner-evidence/24-notifications-provesti-live-slack-delivery-acceptance.json

- templates:
  `docs/release-owner-evidence/templates/24-notifications-provesti-live-slack-delivery-acceptance.example.json`
- related commands: `pnpm notifications:acceptance`
- related gate count: 1
- owner action: Create
  docs/release-owner-evidence/24-notifications-provesti-live-slack-delivery-acceptance.json
  from the listed template/instructions using real owner or reviewer evidence,
  then run pnpm notifications:acceptance.

### docs/release-owner-evidence/24-notifications-provesti-live-telegram-delivery-acceptance-esli-nuzhen.json

- templates:
  `docs/release-owner-evidence/templates/24-notifications-provesti-live-telegram-delivery-acceptance-esli-nuzhen.example.json`
- related commands: `pnpm notifications:acceptance`
- related gate count: 1
- owner action: Create
  docs/release-owner-evidence/24-notifications-provesti-live-telegram-delivery-acceptance-esli-nuzhen.json
  from the listed template/instructions using real owner or reviewer evidence,
  then run pnpm notifications:acceptance.

### docs/release-owner-evidence/24-notifications-provesti-live-webhook-delivery-acceptance.json

- templates:
  `docs/release-owner-evidence/templates/24-notifications-provesti-live-webhook-delivery-acceptance.example.json`
- related commands: `pnpm notifications:acceptance`
- related gate count: 1
- owner action: Create
  docs/release-owner-evidence/24-notifications-provesti-live-webhook-delivery-acceptance.json
  from the listed template/instructions using real owner or reviewer evidence,
  then run pnpm notifications:acceptance.

### docs/release-owner-evidence/25-billing-provesti-live-customer-portal-acceptance.json

- templates:
  `docs/release-owner-evidence/templates/25-billing-provesti-live-customer-portal-acceptance.example.json`
- related commands: `pnpm billing:live-stripe-final-acceptance-packet`
- related gate count: 1
- owner action: Create
  docs/release-owner-evidence/25-billing-provesti-live-customer-portal-acceptance.json
  from the listed template/instructions using real owner or reviewer evidence,
  then run pnpm billing:live-stripe-final-acceptance-packet.

### docs/release-owner-evidence/25-billing-provesti-live-stripe-acceptance.json

- templates:
  `docs/release-owner-evidence/templates/25-billing-provesti-live-stripe-acceptance.example.json`
- related commands: `pnpm billing:live-stripe-final-acceptance-packet`
- related gate count: 1
- owner action: Create
  docs/release-owner-evidence/25-billing-provesti-live-stripe-acceptance.json
  from the listed template/instructions using real owner or reviewer evidence,
  then run pnpm billing:live-stripe-final-acceptance-packet.

### docs/release-owner-evidence/25-billing-provesti-live-subscription-trial-upgrade-downgrade-cancellation-acceptance.json

- templates:
  `docs/release-owner-evidence/templates/25-billing-provesti-live-subscription-trial-upgrade-downgrade-cancellation-acceptance.example.json`
- related commands: `pnpm billing:live-stripe-final-acceptance-packet`
- related gate count: 1
- owner action: Create
  docs/release-owner-evidence/25-billing-provesti-live-subscription-trial-upgrade-downgrade-cancellation-acceptance.json
  from the listed template/instructions using real owner or reviewer evidence,
  then run pnpm billing:live-stripe-final-acceptance-packet.

### docs/release-owner-evidence/26-agency-mode-proverit-client-invite-email-delivery.json

- templates:
  `docs/release-owner-evidence/templates/26-agency-mode-proverit-client-invite-email-delivery.example.json`
- related commands: `pnpm notifications:acceptance`
- related gate count: 1
- owner action: Create
  docs/release-owner-evidence/26-agency-mode-proverit-client-invite-email-delivery.json
  from the listed template/instructions using real owner or reviewer evidence,
  then run pnpm notifications:acceptance.

### docs/release-owner-evidence/26-agency-mode-realizovat-live-agency-billing.json

- templates:
  `docs/release-owner-evidence/templates/26-agency-mode-realizovat-live-agency-billing.example.json`
- related commands: `pnpm billing:live-stripe-final-acceptance-packet`
- related gate count: 1
- owner action: Create
  docs/release-owner-evidence/26-agency-mode-realizovat-live-agency-billing.json
  from the listed template/instructions using real owner or reviewer evidence,
  then run pnpm billing:live-stripe-final-acceptance-packet.

### docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-billing-live-acceptance-proiden.json

- templates:
  `docs/release-owner-evidence/templates/31-finalnyi-searchlint-1-0-release-gate-billing-live-acceptance-proiden.example.json`
- related commands: `pnpm billing:live-stripe-final-acceptance-packet`
- related gate count: 1
- owner action: Create
  docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-billing-live-acceptance-proiden.json
  from the listed template/instructions using real owner or reviewer evidence,
  then run pnpm billing:live-stripe-final-acceptance-packet.

### docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-google-live-acceptance-proiden.json

- templates:
  `docs/release-owner-evidence/templates/31-finalnyi-searchlint-1-0-release-gate-google-live-acceptance-proiden.example.json`
- related commands: `pnpm google:gsc:acceptance`
- related gate count: 1
- owner action: Create
  docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-google-live-acceptance-proiden.json
  from the listed template/instructions using real owner or reviewer evidence,
  then run pnpm google:gsc:acceptance.

### docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-notifications-gotovy.json

- templates:
  `docs/release-owner-evidence/templates/31-finalnyi-searchlint-1-0-release-gate-notifications-gotovy.example.json`
- related commands: `pnpm notifications:acceptance`
- related gate count: 1
- owner action: Create
  docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-notifications-gotovy.json
  from the listed template/instructions using real owner or reviewer evidence,
  then run pnpm notifications:acceptance.

### docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-yandex-live-acceptance-proiden.json

- templates:
  `docs/release-owner-evidence/templates/31-finalnyi-searchlint-1-0-release-gate-yandex-live-acceptance-proiden.example.json`
- related commands: `pnpm yandex:acceptance`
- related gate count: 1
- owner action: Create
  docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-yandex-live-acceptance-proiden.json
  from the listed template/instructions using real owner or reviewer evidence,
  then run pnpm yandex:acceptance.

## Security Accessibility And Website

Manual accessibility, external security review, DAST, pentest, security gate,
and public website evidence.

### docs/release-owner-evidence/28-security-i-privacy-provesti-dast.json

- templates:
  `docs/release-owner-evidence/templates/28-security-i-privacy-provesti-dast.example.json`
- related commands: `pnpm security:dast`
- related gate count: 1
- owner action: Create
  docs/release-owner-evidence/28-security-i-privacy-provesti-dast.json from the
  listed template/instructions using real owner or reviewer evidence, then run
  pnpm security:dast.

### docs/release-owner-evidence/28-security-i-privacy-zavershit-security-release-gate.json

- templates:
  `docs/release-owner-evidence/templates/28-security-i-privacy-zavershit-security-release-gate.example.json`
- related commands: `pnpm security:dast`
- related gate count: 1
- owner action: Create
  docs/release-owner-evidence/28-security-i-privacy-zavershit-security-release-gate.json
  from the listed template/instructions using real owner or reviewer evidence,
  then run pnpm security:dast.

### docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-public-website-gotov.json

- templates:
  `docs/release-owner-evidence/templates/31-finalnyi-searchlint-1-0-release-gate-public-website-gotov.example.json`
- related commands: `pnpm website:acceptance`
- related gate count: 1
- owner action: Create
  docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-public-website-gotov.json
  from the listed template/instructions using real owner or reviewer evidence,
  then run pnpm website:acceptance.

### docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-security-audit-proiden.json

- templates:
  `docs/release-owner-evidence/templates/31-finalnyi-searchlint-1-0-release-gate-security-audit-proiden.example.json`
- related commands: `pnpm security:dast`
- related gate count: 1
- owner action: Create
  docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-security-audit-proiden.json
  from the listed template/instructions using real owner or reviewer evidence,
  then run pnpm security:dast.

### docs/reviews/oauth-vault-security/reviewer-1.review.json

- templates: `docs/reviews/oauth-vault-security/REVIEW_FORM_TEMPLATE.md`
- related commands: `pnpm oauth-vault:security-review`
- related gate count: 1
- owner action: Create docs/reviews/oauth-vault-security/reviewer-1.review.json
  from the listed template/instructions using real owner or reviewer evidence,
  then run pnpm oauth-vault:security-review.

### docs/reviews/oauth-vault-security/reviewer-2.review.json

- templates: `docs/reviews/oauth-vault-security/REVIEW_FORM_TEMPLATE.md`
- related commands: `pnpm oauth-vault:security-review`
- related gate count: 1
- owner action: Create docs/reviews/oauth-vault-security/reviewer-2.review.json
  from the listed template/instructions using real owner or reviewer evidence,
  then run pnpm oauth-vault:security-review.

### docs/reviews/overlay-accessibility/reviewer.review.json

- templates: `docs/reviews/overlay-accessibility/REVIEW_FORM_TEMPLATE.md`
- related commands: `pnpm overlay:manual-a11y-review`
- related gate count: 3
- owner action: Create docs/reviews/overlay-accessibility/reviewer.review.json
  from the listed template/instructions using real owner or reviewer evidence,
  then run pnpm overlay:manual-a11y-review.

### docs/reviews/penetration-test/report-summary.json

- templates: `docs/reviews/penetration-test/REPORT_SUMMARY_TEMPLATE.md`
- related commands: `pnpm security:pentest`
- related gate count: 2
- owner action: Create docs/reviews/penetration-test/report-summary.json from
  the listed template/instructions using real owner or reviewer evidence, then
  run pnpm security:pentest.

## Final Release

Final RC, git tag, and SearchLint 1.0 publication evidence.

### docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-opublikovan-searchlint-1-0.json

- templates:
  `docs/release-owner-evidence/templates/31-finalnyi-searchlint-1-0-release-gate-opublikovan-searchlint-1-0.example.json`
- related commands: `pnpm final-release:gate`
- related gate count: 1
- owner action: Create
  docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-opublikovan-searchlint-1-0.json
  from the listed template/instructions using real owner or reviewer evidence,
  then run pnpm final-release:gate.

### docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-release-candidate-proshel-polnuyu-matricu.json

- templates:
  `docs/release-owner-evidence/templates/31-finalnyi-searchlint-1-0-release-gate-release-candidate-proshel-polnuyu-matricu.example.json`
- related commands: `pnpm final-release:gate`
- related gate count: 1
- owner action: Create
  docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-release-candidate-proshel-polnuyu-matricu.json
  from the listed template/instructions using real owner or reviewer evidence,
  then run pnpm final-release:gate.

### docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-sozdan-git-tag-v1-0-0.json

- templates:
  `docs/release-owner-evidence/templates/31-finalnyi-searchlint-1-0-release-gate-sozdan-git-tag-v1-0-0.example.json`
- related commands: `pnpm final-release:gate`
- related gate count: 1
- owner action: Create
  docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-sozdan-git-tag-v1-0-0.json
  from the listed template/instructions using real owner or reviewer evidence,
  then run pnpm final-release:gate.

## Non-Claims

- This runbook does not create owner evidence.
- This runbook does not close release gates.
- Templates and instructions are not release evidence.
- SearchLint 1.0 remains blocked until real owner, reviewer, legal, security,
  provider, deployment, publication, backup, and final release evidence exists
  and dedicated verifiers pass.
