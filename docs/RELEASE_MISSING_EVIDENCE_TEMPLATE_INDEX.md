# Release Missing Evidence Template Index

Status date: 2026-06-23

This document is generated from
`reports/release-evidence-intake-status-report.json`. It maps each missing
owner-provided evidence file to existing templates, instructions, related gates,
and commands.

Templates are not release evidence. They only define the shape of real owner,
reviewer, legal, security, deployment, provider, publication, backup, or final
release evidence.

## Summary

- status: `template_index_ready`
- open gates: 77
- missing owner input files: 60
- missing owner input files with templates/instructions: 60
- missing owner input files without templates/instructions: 0

## Missing Evidence Inputs

| Missing evidence                                                                                                         | Templates / instructions                                                                                                                                                                                                             | Related command(s)                                 |
| ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------- |
| `docs/legal-release-approval.json`                                                                                       | `docs/legal-release-approval.example.json`                                                                                                                                                                                           | `pnpm legal:release-gate`                          |
| `docs/live-backup-restore-drill.json`                                                                                    | `docs/live-backup-restore-drill.example.json`                                                                                                                                                                                        | `pnpm backup:restore-live-gate`                    |
| `docs/release-owner-evidence/10-crawler-proverit-100-000-url-v-cloud.json`                                               | `docs/release-owner-evidence/templates/10-crawler-proverit-100-000-url-v-cloud.example.json`                                                                                                                                         | `pnpm crawler:acceptance`                          |
| `docs/release-owner-evidence/11-postgresql-i-hranenie-dannyh-razvernut-nastoyashii-postgresql-rds.json`                  | `docs/release-owner-evidence/templates/11-postgresql-i-hranenie-dannyh-razvernut-nastoyashii-postgresql-rds.example.json`                                                                                                            | `pnpm verify:postgres`                             |
| `docs/release-owner-evidence/12-s3-object-storage-razvernut-realnoe-object-storage.json`                                 | `docs/release-owner-evidence/templates/12-s3-object-storage-razvernut-realnoe-object-storage.example.json`                                                                                                                           | `pnpm object-storage:acceptance`                   |
| `docs/release-owner-evidence/13-backend-api-razvernut-production-api.json`                                               | `docs/release-owner-evidence/templates/13-backend-api-razvernut-production-api.example.json`                                                                                                                                         | `pnpm api:acceptance`                              |
| `docs/release-owner-evidence/18-google-search-console-provesti-live-acceptance-na-realnom-saite.json`                    | `docs/release-owner-evidence/templates/18-google-search-console-provesti-live-acceptance-na-realnom-saite.example.json`                                                                                                              | `pnpm google:gsc:acceptance`                       |
| `docs/release-owner-evidence/19-pagespeed-i-crux-provesti-live-acceptance.json`                                          | `docs/release-owner-evidence/templates/19-pagespeed-i-crux-provesti-live-acceptance.example.json`                                                                                                                                    | `pnpm google:performance:acceptance`               |
| `docs/release-owner-evidence/20-yandeks-vebmaster-provesti-live-acceptance.json`                                         | `docs/release-owner-evidence/templates/20-yandeks-vebmaster-provesti-live-acceptance.example.json`                                                                                                                                   | `pnpm yandex:acceptance`                           |
| `docs/release-owner-evidence/21-yandeks-metrika-provesti-live-acceptance.json`                                           | `docs/release-owner-evidence/templates/21-yandeks-metrika-provesti-live-acceptance.example.json`                                                                                                                                     | `pnpm yandex:acceptance`                           |
| `docs/release-owner-evidence/22-istoriya-i-korrelyaciya-provesti-deployed-dashboard-timeline-acceptance.json`            | `docs/release-owner-evidence/templates/22-istoriya-i-korrelyaciya-provesti-deployed-dashboard-timeline-acceptance.example.json`                                                                                                      | `pnpm dashboard:production-e2e`                    |
| `docs/release-owner-evidence/24-notifications-provesti-live-email-delivery-acceptance.json`                              | `docs/release-owner-evidence/templates/24-notifications-provesti-live-email-delivery-acceptance.example.json`                                                                                                                        | `pnpm notifications:acceptance`                    |
| `docs/release-owner-evidence/24-notifications-provesti-live-slack-delivery-acceptance.json`                              | `docs/release-owner-evidence/templates/24-notifications-provesti-live-slack-delivery-acceptance.example.json`                                                                                                                        | `pnpm notifications:acceptance`                    |
| `docs/release-owner-evidence/24-notifications-provesti-live-telegram-delivery-acceptance-esli-nuzhen.json`               | `docs/release-owner-evidence/templates/24-notifications-provesti-live-telegram-delivery-acceptance-esli-nuzhen.example.json`                                                                                                         | `pnpm notifications:acceptance`                    |
| `docs/release-owner-evidence/24-notifications-provesti-live-webhook-delivery-acceptance.json`                            | `docs/release-owner-evidence/templates/24-notifications-provesti-live-webhook-delivery-acceptance.example.json`                                                                                                                      | `pnpm notifications:acceptance`                    |
| `docs/release-owner-evidence/25-billing-proverit-deployed-stripe-webhook-persistence-on-rds.json`                        | `docs/release-owner-evidence/templates/25-billing-proverit-deployed-stripe-webhook-persistence-on-rds.example.json`                                                                                                                  | `pnpm verify:postgres`                             |
| `docs/release-owner-evidence/25-billing-provesti-live-customer-portal-acceptance.json`                                   | `docs/release-owner-evidence/templates/25-billing-provesti-live-customer-portal-acceptance.example.json`                                                                                                                             | `pnpm billing:live-stripe-final-acceptance-packet` |
| `docs/release-owner-evidence/25-billing-provesti-live-stripe-acceptance.json`                                            | `docs/release-owner-evidence/templates/25-billing-provesti-live-stripe-acceptance.example.json`                                                                                                                                      | `pnpm billing:live-stripe-final-acceptance-packet` |
| `docs/release-owner-evidence/25-billing-provesti-live-subscription-trial-upgrade-downgrade-cancellation-acceptance.json` | `docs/release-owner-evidence/templates/25-billing-provesti-live-subscription-trial-upgrade-downgrade-cancellation-acceptance.example.json`                                                                                           | `pnpm billing:live-stripe-final-acceptance-packet` |
| `docs/release-owner-evidence/26-agency-mode-proverit-client-invite-email-delivery.json`                                  | `docs/release-owner-evidence/templates/26-agency-mode-proverit-client-invite-email-delivery.example.json`                                                                                                                            | `pnpm notifications:acceptance`                    |
| `docs/release-owner-evidence/26-agency-mode-razvernut-client-portal.json`                                                | `docs/release-owner-evidence/templates/26-agency-mode-razvernut-client-portal.example.json`                                                                                                                                          | `pnpm agency:client-access-browser-e2e`            |
| `docs/release-owner-evidence/26-agency-mode-realizovat-live-agency-billing.json`                                         | `docs/release-owner-evidence/templates/26-agency-mode-realizovat-live-agency-billing.example.json`                                                                                                                                   | `pnpm billing:live-stripe-final-acceptance-packet` |
| `docs/release-owner-evidence/27-observability-podklyuchit-cloudwatch-otlp.json`                                          | `docs/release-owner-evidence/templates/27-observability-podklyuchit-cloudwatch-otlp.example.json`                                                                                                                                    | `pnpm observability:acceptance`                    |
| `docs/release-owner-evidence/27-observability-razvernut-logging.json`                                                    | `docs/release-owner-evidence/templates/27-observability-razvernut-logging.example.json`                                                                                                                                              | `pnpm observability:acceptance`                    |
| `docs/release-owner-evidence/27-observability-razvernut-metrics.json`                                                    | `docs/release-owner-evidence/templates/27-observability-razvernut-metrics.example.json`                                                                                                                                              | `pnpm observability:acceptance`                    |
| `docs/release-owner-evidence/27-observability-razvernut-tracing.json`                                                    | `docs/release-owner-evidence/templates/27-observability-razvernut-tracing.example.json`                                                                                                                                              | `pnpm observability:acceptance`                    |
| `docs/release-owner-evidence/28-security-i-privacy-provesti-dast.json`                                                   | `docs/release-owner-evidence/templates/28-security-i-privacy-provesti-dast.example.json`                                                                                                                                             | `pnpm security:dast`                               |
| `docs/release-owner-evidence/28-security-i-privacy-zavershit-security-release-gate.json`                                 | `docs/release-owner-evidence/templates/28-security-i-privacy-zavershit-security-release-gate.example.json`                                                                                                                           | `pnpm security:dast`                               |
| `docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-agency-mode-gotov.json`                             | `docs/release-owner-evidence/templates/31-finalnyi-searchlint-1-0-release-gate-agency-mode-gotov.example.json`                                                                                                                       | `pnpm agency:acceptance`                           |
| `docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-api-deployment-proof-proiden.json`                  | `docs/release-owner-evidence/templates/31-finalnyi-searchlint-1-0-release-gate-api-deployment-proof-proiden.example.json`                                                                                                            | `pnpm api:acceptance`                              |
| `docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-billing-live-acceptance-proiden.json`               | `docs/release-owner-evidence/templates/31-finalnyi-searchlint-1-0-release-gate-billing-live-acceptance-proiden.example.json`                                                                                                         | `pnpm billing:live-stripe-final-acceptance-packet` |
| `docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-cognito-rbac-proof-proiden.json`                    | `docs/release-owner-evidence/templates/31-finalnyi-searchlint-1-0-release-gate-cognito-rbac-proof-proiden.example.json`                                                                                                              | `pnpm auth:acceptance`                             |
| `docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-dashboard-production-e2e-proiden.json`              | `docs/release-owner-evidence/templates/31-finalnyi-searchlint-1-0-release-gate-dashboard-production-e2e-proiden.example.json`                                                                                                        | `pnpm dashboard:production-e2e`                    |
| `docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-google-live-acceptance-proiden.json`                | `docs/release-owner-evidence/templates/31-finalnyi-searchlint-1-0-release-gate-google-live-acceptance-proiden.example.json`                                                                                                          | `pnpm google:gsc:acceptance`                       |
| `docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-notifications-gotovy.json`                          | `docs/release-owner-evidence/templates/31-finalnyi-searchlint-1-0-release-gate-notifications-gotovy.example.json`                                                                                                                    | `pnpm notifications:acceptance`                    |
| `docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-npm-pakety-opublikovany.json`                       | `docs/release-owner-evidence/templates/31-finalnyi-searchlint-1-0-release-gate-npm-pakety-opublikovany.example.json`                                                                                                                 | `pnpm final-release:gate`                          |
| `docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-oauth-vault-proof-proiden.json`                     | `docs/release-owner-evidence/templates/31-finalnyi-searchlint-1-0-release-gate-oauth-vault-proof-proiden.example.json`                                                                                                               | `pnpm oauth-vault:acceptance`                      |
| `docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-observability-gotova.json`                          | `docs/release-owner-evidence/templates/31-finalnyi-searchlint-1-0-release-gate-observability-gotova.example.json`                                                                                                                    | `pnpm observability:acceptance`                    |
| `docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-opublikovan-searchlint-1-0.json`                    | `docs/release-owner-evidence/templates/31-finalnyi-searchlint-1-0-release-gate-opublikovan-searchlint-1-0.example.json`                                                                                                              | `pnpm final-release:gate`                          |
| `docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-postgresql-rds-proof-proiden.json`                  | `docs/release-owner-evidence/templates/31-finalnyi-searchlint-1-0-release-gate-postgresql-rds-proof-proiden.example.json`                                                                                                            | `pnpm verify:postgres`                             |
| `docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-public-website-gotov.json`                          | `docs/release-owner-evidence/templates/31-finalnyi-searchlint-1-0-release-gate-public-website-gotov.example.json`                                                                                                                    | `pnpm website:acceptance`                          |
| `docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-release-candidate-proshel-polnuyu-matricu.json`     | `docs/release-owner-evidence/templates/31-finalnyi-searchlint-1-0-release-gate-release-candidate-proshel-polnuyu-matricu.example.json`                                                                                               | `pnpm final-release:gate`                          |
| `docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-s3-proof-proiden.json`                              | `docs/release-owner-evidence/templates/31-finalnyi-searchlint-1-0-release-gate-s3-proof-proiden.example.json`                                                                                                                        | `pnpm object-storage:acceptance`                   |
| `docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-security-audit-proiden.json`                        | `docs/release-owner-evidence/templates/31-finalnyi-searchlint-1-0-release-gate-security-audit-proiden.example.json`                                                                                                                  | `pnpm security:dast`                               |
| `docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-sozdan-git-tag-v1-0-0.json`                         | `docs/release-owner-evidence/templates/31-finalnyi-searchlint-1-0-release-gate-sozdan-git-tag-v1-0-0.example.json`                                                                                                                   | `pnpm final-release:gate`                          |
| `docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-vs-code-extension-opublikovan.json`                 | `docs/release-owner-evidence/templates/31-finalnyi-searchlint-1-0-release-gate-vs-code-extension-opublikovan.example.json`                                                                                                           | `pnpm vscode:update-e2e`                           |
| `docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-workers-sqs-proof-proiden.json`                     | `docs/release-owner-evidence/templates/31-finalnyi-searchlint-1-0-release-gate-workers-sqs-proof-proiden.example.json`                                                                                                               | `pnpm workers:acceptance`                          |
| `docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-yandex-live-acceptance-proiden.json`                | `docs/release-owner-evidence/templates/31-finalnyi-searchlint-1-0-release-gate-yandex-live-acceptance-proiden.example.json`                                                                                                          | `pnpm yandex:acceptance`                           |
| `docs/release-owner-evidence/7-vs-code-i-lsp-nastroit-publisher-account.json`                                            | `docs/release-owner-evidence/templates/7-vs-code-i-lsp-nastroit-publisher-account.example.json`                                                                                                                                      | `pnpm vscode:update-e2e`                           |
| `docs/release-owner-evidence/7-vs-code-i-lsp-podpisat-i-opublikovat-extension.json`                                      | `docs/release-owner-evidence/templates/7-vs-code-i-lsp-podpisat-i-opublikovat-extension.example.json`                                                                                                                                | `pnpm vscode:update-e2e`                           |
| `docs/release-owner-evidence/8-npm-pakety-opublikovat-beta-packages.json`                                                | `docs/release-owner-evidence/templates/8-npm-pakety-opublikovat-beta-packages.example.json`                                                                                                                                          | `pnpm package:beta-publication-gate`               |
| `docs/release-owner-evidence/8-npm-pakety-podgotovit-finalnuyu-publikaciyu-1-0-0.json`                                   | `docs/release-owner-evidence/templates/8-npm-pakety-podgotovit-finalnuyu-publikaciyu-1-0-0.example.json`                                                                                                                             | `pnpm final-release:gate`                          |
| `docs/release-owner-evidence/8-npm-pakety-zamenit-0-0-0-beta-versions-na-final-release-versions.json`                    | `docs/release-owner-evidence/templates/8-npm-pakety-zamenit-0-0-0-beta-versions-na-final-release-versions.example.json`                                                                                                              | `pnpm final-release:gate`                          |
| `docs/reviews/blocker-benchmark/DELIVERY_EVIDENCE.json`                                                                  | `docs/reviews/blocker-benchmark/DELIVERY_EVIDENCE.example.json`<br>`docs/reviews/blocker-benchmark/README.md`<br>`docs/reviews/blocker-benchmark/REVIEW_INSTRUCTIONS.md`<br>`docs/reviews/blocker-benchmark/REVIEW_FORM_TEMPLATE.md` | `pnpm rule-qa:review-delivery`                     |
| `docs/reviews/blocker-benchmark/reviewer-1.review.json`                                                                  | `docs/reviews/blocker-benchmark/reviewer-1.review.example.json`<br>`docs/reviews/blocker-benchmark/README.md`<br>`docs/reviews/blocker-benchmark/REVIEW_INSTRUCTIONS.md`<br>`docs/reviews/blocker-benchmark/REVIEW_FORM_TEMPLATE.md` | `pnpm rule-qa:review`                              |
| `docs/reviews/blocker-benchmark/reviewer-2.review.json`                                                                  | `docs/reviews/blocker-benchmark/reviewer-2.review.example.json`<br>`docs/reviews/blocker-benchmark/README.md`<br>`docs/reviews/blocker-benchmark/REVIEW_INSTRUCTIONS.md`<br>`docs/reviews/blocker-benchmark/REVIEW_FORM_TEMPLATE.md` | `pnpm rule-qa:review`                              |
| `docs/reviews/oauth-vault-security/reviewer-1.review.json`                                                               | `docs/reviews/oauth-vault-security/REVIEW_FORM_TEMPLATE.md`                                                                                                                                                                          | `pnpm oauth-vault:security-review`                 |
| `docs/reviews/oauth-vault-security/reviewer-2.review.json`                                                               | `docs/reviews/oauth-vault-security/REVIEW_FORM_TEMPLATE.md`                                                                                                                                                                          | `pnpm oauth-vault:security-review`                 |
| `docs/reviews/overlay-accessibility/reviewer.review.json`                                                                | `docs/reviews/overlay-accessibility/REVIEW_FORM_TEMPLATE.md`                                                                                                                                                                         | `pnpm overlay:manual-a11y-review`                  |
| `docs/reviews/penetration-test/report-summary.json`                                                                      | `docs/reviews/penetration-test/REPORT_SUMMARY_TEMPLATE.md`                                                                                                                                                                           | `pnpm security:pentest`                            |

## Owner Actions

### docs/legal-release-approval.json

Create docs/legal-release-approval.json from the listed template/instructions
using real owner or reviewer evidence, then run pnpm legal:release-gate.

Related gates:

- 1. Управление проектом: Провести юридическую проверку публичной и закрытой
     частей проекта; command `pnpm legal:release-gate`
- 31. Финальный SearchLint 1.0 Release Gate: Legal review завершён; command
      `pnpm legal:release-gate`

### docs/live-backup-restore-drill.json

Create docs/live-backup-restore-drill.json from the listed template/instructions
using real owner or reviewer evidence, then run pnpm backup:restore-live-gate.

Related gates:

- 31. Финальный SearchLint 1.0 Release Gate: Backup/restore проверены; command
      `pnpm backup:restore-live-gate`

### docs/release-owner-evidence/10-crawler-proverit-100-000-url-v-cloud.json

Create docs/release-owner-evidence/10-crawler-proverit-100-000-url-v-cloud.json
from the listed template/instructions using real owner or reviewer evidence,
then run pnpm crawler:acceptance.

Related gates:

- 10. Crawler: Проверить 100 000 URL в cloud; command `pnpm crawler:acceptance`

### docs/release-owner-evidence/11-postgresql-i-hranenie-dannyh-razvernut-nastoyashii-postgresql-rds.json

Create
docs/release-owner-evidence/11-postgresql-i-hranenie-dannyh-razvernut-nastoyashii-postgresql-rds.json
from the listed template/instructions using real owner or reviewer evidence,
then run pnpm verify:postgres.

Related gates:

- 11. PostgreSQL и хранение данных: Развернуть настоящий PostgreSQL/RDS; command
      `pnpm verify:postgres`

### docs/release-owner-evidence/12-s3-object-storage-razvernut-realnoe-object-storage.json

Create
docs/release-owner-evidence/12-s3-object-storage-razvernut-realnoe-object-storage.json
from the listed template/instructions using real owner or reviewer evidence,
then run pnpm object-storage:acceptance.

Related gates:

- 12. S3/Object Storage: Развернуть реальное object storage; command
      `pnpm object-storage:acceptance`

### docs/release-owner-evidence/13-backend-api-razvernut-production-api.json

Create docs/release-owner-evidence/13-backend-api-razvernut-production-api.json
from the listed template/instructions using real owner or reviewer evidence,
then run pnpm api:acceptance.

Related gates:

- 13. Backend API: Развернуть production API; command `pnpm api:acceptance`

### docs/release-owner-evidence/18-google-search-console-provesti-live-acceptance-na-realnom-saite.json

Create
docs/release-owner-evidence/18-google-search-console-provesti-live-acceptance-na-realnom-saite.json
from the listed template/instructions using real owner or reviewer evidence,
then run pnpm google:gsc:acceptance.

Related gates:

- 18. Google Search Console: Провести live acceptance на реальном сайте; command
      `pnpm google:gsc:acceptance`

### docs/release-owner-evidence/19-pagespeed-i-crux-provesti-live-acceptance.json

Create
docs/release-owner-evidence/19-pagespeed-i-crux-provesti-live-acceptance.json
from the listed template/instructions using real owner or reviewer evidence,
then run pnpm google:performance:acceptance.

Related gates:

- 19. PageSpeed и CrUX: Провести live acceptance; command
      `pnpm google:performance:acceptance`

### docs/release-owner-evidence/20-yandeks-vebmaster-provesti-live-acceptance.json

Create
docs/release-owner-evidence/20-yandeks-vebmaster-provesti-live-acceptance.json
from the listed template/instructions using real owner or reviewer evidence,
then run pnpm yandex:acceptance.

Related gates:

- 20. Яндекс.Вебмастер: Провести live acceptance; command
      `pnpm yandex:acceptance`

### docs/release-owner-evidence/21-yandeks-metrika-provesti-live-acceptance.json

Create
docs/release-owner-evidence/21-yandeks-metrika-provesti-live-acceptance.json
from the listed template/instructions using real owner or reviewer evidence,
then run pnpm yandex:acceptance.

Related gates:

- 21. Яндекс.Метрика: Провести live acceptance; command `pnpm yandex:acceptance`

### docs/release-owner-evidence/22-istoriya-i-korrelyaciya-provesti-deployed-dashboard-timeline-acceptance.json

Create
docs/release-owner-evidence/22-istoriya-i-korrelyaciya-provesti-deployed-dashboard-timeline-acceptance.json
from the listed template/instructions using real owner or reviewer evidence,
then run pnpm dashboard:production-e2e.

Related gates:

- 22. История и корреляция: Провести deployed dashboard timeline acceptance;
      command `pnpm dashboard:production-e2e`

### docs/release-owner-evidence/24-notifications-provesti-live-email-delivery-acceptance.json

Create
docs/release-owner-evidence/24-notifications-provesti-live-email-delivery-acceptance.json
from the listed template/instructions using real owner or reviewer evidence,
then run pnpm notifications:acceptance.

Related gates:

- 24. Notifications: Провести live email delivery acceptance; command
      `pnpm notifications:acceptance`

### docs/release-owner-evidence/24-notifications-provesti-live-slack-delivery-acceptance.json

Create
docs/release-owner-evidence/24-notifications-provesti-live-slack-delivery-acceptance.json
from the listed template/instructions using real owner or reviewer evidence,
then run pnpm notifications:acceptance.

Related gates:

- 24. Notifications: Провести live Slack delivery acceptance; command
      `pnpm notifications:acceptance`

### docs/release-owner-evidence/24-notifications-provesti-live-telegram-delivery-acceptance-esli-nuzhen.json

Create
docs/release-owner-evidence/24-notifications-provesti-live-telegram-delivery-acceptance-esli-nuzhen.json
from the listed template/instructions using real owner or reviewer evidence,
then run pnpm notifications:acceptance.

Related gates:

- 24. Notifications: Провести live Telegram delivery acceptance, если нужен;
      command `pnpm notifications:acceptance`

### docs/release-owner-evidence/24-notifications-provesti-live-webhook-delivery-acceptance.json

Create
docs/release-owner-evidence/24-notifications-provesti-live-webhook-delivery-acceptance.json
from the listed template/instructions using real owner or reviewer evidence,
then run pnpm notifications:acceptance.

Related gates:

- 24. Notifications: Провести live webhook delivery acceptance; command
      `pnpm notifications:acceptance`

### docs/release-owner-evidence/25-billing-proverit-deployed-stripe-webhook-persistence-on-rds.json

Create
docs/release-owner-evidence/25-billing-proverit-deployed-stripe-webhook-persistence-on-rds.json
from the listed template/instructions using real owner or reviewer evidence,
then run pnpm verify:postgres.

Related gates:

- 25. Billing: Проверить deployed Stripe webhook persistence on RDS; command
      `pnpm verify:postgres`

### docs/release-owner-evidence/25-billing-provesti-live-customer-portal-acceptance.json

Create
docs/release-owner-evidence/25-billing-provesti-live-customer-portal-acceptance.json
from the listed template/instructions using real owner or reviewer evidence,
then run pnpm billing:live-stripe-final-acceptance-packet.

Related gates:

- 25. Billing: Провести live customer portal acceptance; command
      `pnpm billing:live-stripe-final-acceptance-packet`

### docs/release-owner-evidence/25-billing-provesti-live-stripe-acceptance.json

Create
docs/release-owner-evidence/25-billing-provesti-live-stripe-acceptance.json from
the listed template/instructions using real owner or reviewer evidence, then run
pnpm billing:live-stripe-final-acceptance-packet.

Related gates:

- 25. Billing: Провести live Stripe acceptance; command
      `pnpm billing:live-stripe-final-acceptance-packet`

### docs/release-owner-evidence/25-billing-provesti-live-subscription-trial-upgrade-downgrade-cancellation-acceptance.json

Create
docs/release-owner-evidence/25-billing-provesti-live-subscription-trial-upgrade-downgrade-cancellation-acceptance.json
from the listed template/instructions using real owner or reviewer evidence,
then run pnpm billing:live-stripe-final-acceptance-packet.

Related gates:

- 25. Billing: Провести live subscription/trial/upgrade/downgrade/cancellation
      acceptance; command `pnpm billing:live-stripe-final-acceptance-packet`

### docs/release-owner-evidence/26-agency-mode-proverit-client-invite-email-delivery.json

Create
docs/release-owner-evidence/26-agency-mode-proverit-client-invite-email-delivery.json
from the listed template/instructions using real owner or reviewer evidence,
then run pnpm notifications:acceptance.

Related gates:

- 26. Agency mode: Проверить client invite email delivery; command
      `pnpm notifications:acceptance`

### docs/release-owner-evidence/26-agency-mode-razvernut-client-portal.json

Create docs/release-owner-evidence/26-agency-mode-razvernut-client-portal.json
from the listed template/instructions using real owner or reviewer evidence,
then run pnpm agency:client-access-browser-e2e.

Related gates:

- 26. Agency mode: Развернуть client portal; command
      `pnpm agency:client-access-browser-e2e`

### docs/release-owner-evidence/26-agency-mode-realizovat-live-agency-billing.json

Create
docs/release-owner-evidence/26-agency-mode-realizovat-live-agency-billing.json
from the listed template/instructions using real owner or reviewer evidence,
then run pnpm billing:live-stripe-final-acceptance-packet.

Related gates:

- 26. Agency mode: Реализовать live agency billing; command
      `pnpm billing:live-stripe-final-acceptance-packet`

### docs/release-owner-evidence/27-observability-podklyuchit-cloudwatch-otlp.json

Create
docs/release-owner-evidence/27-observability-podklyuchit-cloudwatch-otlp.json
from the listed template/instructions using real owner or reviewer evidence,
then run pnpm observability:acceptance.

Related gates:

- 27. Observability: Подключить CloudWatch/OTLP; command
      `pnpm observability:acceptance`

### docs/release-owner-evidence/27-observability-razvernut-logging.json

Create docs/release-owner-evidence/27-observability-razvernut-logging.json from
the listed template/instructions using real owner or reviewer evidence, then run
pnpm observability:acceptance.

Related gates:

- 27. Observability: Развернуть logging; command `pnpm observability:acceptance`

### docs/release-owner-evidence/27-observability-razvernut-metrics.json

Create docs/release-owner-evidence/27-observability-razvernut-metrics.json from
the listed template/instructions using real owner or reviewer evidence, then run
pnpm observability:acceptance.

Related gates:

- 27. Observability: Развернуть metrics; command `pnpm observability:acceptance`

### docs/release-owner-evidence/27-observability-razvernut-tracing.json

Create docs/release-owner-evidence/27-observability-razvernut-tracing.json from
the listed template/instructions using real owner or reviewer evidence, then run
pnpm observability:acceptance.

Related gates:

- 27. Observability: Развернуть tracing; command `pnpm observability:acceptance`

### docs/release-owner-evidence/28-security-i-privacy-provesti-dast.json

Create docs/release-owner-evidence/28-security-i-privacy-provesti-dast.json from
the listed template/instructions using real owner or reviewer evidence, then run
pnpm security:dast.

Related gates:

- 28. Security и Privacy: Провести DAST; command `pnpm security:dast`

### docs/release-owner-evidence/28-security-i-privacy-zavershit-security-release-gate.json

Create
docs/release-owner-evidence/28-security-i-privacy-zavershit-security-release-gate.json
from the listed template/instructions using real owner or reviewer evidence,
then run pnpm security:dast.

Related gates:

- 28. Security и Privacy: Завершить security release gate; command
      `pnpm security:dast`

### docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-agency-mode-gotov.json

Create
docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-agency-mode-gotov.json
from the listed template/instructions using real owner or reviewer evidence,
then run pnpm agency:acceptance.

Related gates:

- 31. Финальный SearchLint 1.0 Release Gate: Agency mode готов; command
      `pnpm agency:acceptance`

### docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-api-deployment-proof-proiden.json

Create
docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-api-deployment-proof-proiden.json
from the listed template/instructions using real owner or reviewer evidence,
then run pnpm api:acceptance.

Related gates:

- 31. Финальный SearchLint 1.0 Release Gate: API deployment proof пройден;
      command `pnpm api:acceptance`

### docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-billing-live-acceptance-proiden.json

Create
docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-billing-live-acceptance-proiden.json
from the listed template/instructions using real owner or reviewer evidence,
then run pnpm billing:live-stripe-final-acceptance-packet.

Related gates:

- 31. Финальный SearchLint 1.0 Release Gate: Billing live acceptance пройден;
      command `pnpm billing:live-stripe-final-acceptance-packet`

### docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-cognito-rbac-proof-proiden.json

Create
docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-cognito-rbac-proof-proiden.json
from the listed template/instructions using real owner or reviewer evidence,
then run pnpm auth:acceptance.

Related gates:

- 31. Финальный SearchLint 1.0 Release Gate: Cognito/RBAC proof пройден; command
      `pnpm auth:acceptance`

### docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-dashboard-production-e2e-proiden.json

Create
docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-dashboard-production-e2e-proiden.json
from the listed template/instructions using real owner or reviewer evidence,
then run pnpm dashboard:production-e2e.

Related gates:

- 31. Финальный SearchLint 1.0 Release Gate: Dashboard production E2E пройден;
      command `pnpm dashboard:production-e2e`

### docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-google-live-acceptance-proiden.json

Create
docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-google-live-acceptance-proiden.json
from the listed template/instructions using real owner or reviewer evidence,
then run pnpm google:gsc:acceptance.

Related gates:

- 31. Финальный SearchLint 1.0 Release Gate: Google live acceptance пройден;
      command `pnpm google:gsc:acceptance`

### docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-notifications-gotovy.json

Create
docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-notifications-gotovy.json
from the listed template/instructions using real owner or reviewer evidence,
then run pnpm notifications:acceptance.

Related gates:

- 31. Финальный SearchLint 1.0 Release Gate: Notifications готовы; command
      `pnpm notifications:acceptance`

### docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-npm-pakety-opublikovany.json

Create
docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-npm-pakety-opublikovany.json
from the listed template/instructions using real owner or reviewer evidence,
then run pnpm final-release:gate.

Related gates:

- 31. Финальный SearchLint 1.0 Release Gate: npm-пакеты опубликованы; command
      `pnpm final-release:gate`

### docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-oauth-vault-proof-proiden.json

Create
docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-oauth-vault-proof-proiden.json
from the listed template/instructions using real owner or reviewer evidence,
then run pnpm oauth-vault:acceptance.

Related gates:

- 31. Финальный SearchLint 1.0 Release Gate: OAuth vault proof пройден; command
      `pnpm oauth-vault:acceptance`

### docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-observability-gotova.json

Create
docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-observability-gotova.json
from the listed template/instructions using real owner or reviewer evidence,
then run pnpm observability:acceptance.

Related gates:

- 31. Финальный SearchLint 1.0 Release Gate: Observability готова; command
      `pnpm observability:acceptance`

### docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-opublikovan-searchlint-1-0.json

Create
docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-opublikovan-searchlint-1-0.json
from the listed template/instructions using real owner or reviewer evidence,
then run pnpm final-release:gate.

Related gates:

- 31. Финальный SearchLint 1.0 Release Gate: Опубликован SearchLint 1.0; command
      `pnpm final-release:gate`

### docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-postgresql-rds-proof-proiden.json

Create
docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-postgresql-rds-proof-proiden.json
from the listed template/instructions using real owner or reviewer evidence,
then run pnpm verify:postgres.

Related gates:

- 31. Финальный SearchLint 1.0 Release Gate: PostgreSQL/RDS proof пройден;
      command `pnpm verify:postgres`

### docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-public-website-gotov.json

Create
docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-public-website-gotov.json
from the listed template/instructions using real owner or reviewer evidence,
then run pnpm website:acceptance.

Related gates:

- 31. Финальный SearchLint 1.0 Release Gate: Public website готов; command
      `pnpm website:acceptance`

### docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-release-candidate-proshel-polnuyu-matricu.json

Create
docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-release-candidate-proshel-polnuyu-matricu.json
from the listed template/instructions using real owner or reviewer evidence,
then run pnpm final-release:gate.

Related gates:

- 31. Финальный SearchLint 1.0 Release Gate: Release candidate прошёл полную
      матрицу; command `pnpm final-release:gate`

### docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-s3-proof-proiden.json

Create
docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-s3-proof-proiden.json
from the listed template/instructions using real owner or reviewer evidence,
then run pnpm object-storage:acceptance.

Related gates:

- 31. Финальный SearchLint 1.0 Release Gate: S3 proof пройден; command
      `pnpm object-storage:acceptance`

### docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-security-audit-proiden.json

Create
docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-security-audit-proiden.json
from the listed template/instructions using real owner or reviewer evidence,
then run pnpm security:dast.

Related gates:

- 31. Финальный SearchLint 1.0 Release Gate: Security audit пройден; command
      `pnpm security:dast`

### docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-sozdan-git-tag-v1-0-0.json

Create
docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-sozdan-git-tag-v1-0-0.json
from the listed template/instructions using real owner or reviewer evidence,
then run pnpm final-release:gate.

Related gates:

- 31. Финальный SearchLint 1.0 Release Gate: Создан Git tag v1.0.0; command
      `pnpm final-release:gate`

### docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-vs-code-extension-opublikovan.json

Create
docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-vs-code-extension-opublikovan.json
from the listed template/instructions using real owner or reviewer evidence,
then run pnpm vscode:update-e2e.

Related gates:

- 31. Финальный SearchLint 1.0 Release Gate: VS Code extension опубликован;
      command `pnpm vscode:update-e2e`

### docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-workers-sqs-proof-proiden.json

Create
docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-workers-sqs-proof-proiden.json
from the listed template/instructions using real owner or reviewer evidence,
then run pnpm workers:acceptance.

Related gates:

- 31. Финальный SearchLint 1.0 Release Gate: Workers/SQS proof пройден; command
      `pnpm workers:acceptance`

### docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-yandex-live-acceptance-proiden.json

Create
docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-yandex-live-acceptance-proiden.json
from the listed template/instructions using real owner or reviewer evidence,
then run pnpm yandex:acceptance.

Related gates:

- 31. Финальный SearchLint 1.0 Release Gate: Yandex live acceptance пройден;
      command `pnpm yandex:acceptance`

### docs/release-owner-evidence/7-vs-code-i-lsp-nastroit-publisher-account.json

Create
docs/release-owner-evidence/7-vs-code-i-lsp-nastroit-publisher-account.json from
the listed template/instructions using real owner or reviewer evidence, then run
pnpm vscode:update-e2e.

Related gates:

- 7. VS Code и LSP: Настроить publisher account; command
     `pnpm vscode:update-e2e`

### docs/release-owner-evidence/7-vs-code-i-lsp-podpisat-i-opublikovat-extension.json

Create
docs/release-owner-evidence/7-vs-code-i-lsp-podpisat-i-opublikovat-extension.json
from the listed template/instructions using real owner or reviewer evidence,
then run pnpm vscode:update-e2e.

Related gates:

- 7. VS Code и LSP: Подписать и опубликовать extension; command
     `pnpm vscode:update-e2e`

### docs/release-owner-evidence/8-npm-pakety-opublikovat-beta-packages.json

Create docs/release-owner-evidence/8-npm-pakety-opublikovat-beta-packages.json
from the listed template/instructions using real owner or reviewer evidence,
then run pnpm package:beta-publication-gate.

Related gates:

- 8. npm-пакеты: Опубликовать beta packages; command
     `pnpm package:beta-publication-gate`

### docs/release-owner-evidence/8-npm-pakety-podgotovit-finalnuyu-publikaciyu-1-0-0.json

Create
docs/release-owner-evidence/8-npm-pakety-podgotovit-finalnuyu-publikaciyu-1-0-0.json
from the listed template/instructions using real owner or reviewer evidence,
then run pnpm final-release:gate.

Related gates:

- 8. npm-пакеты: Подготовить финальную публикацию 1.0.0; command
     `pnpm final-release:gate`

### docs/release-owner-evidence/8-npm-pakety-zamenit-0-0-0-beta-versions-na-final-release-versions.json

Create
docs/release-owner-evidence/8-npm-pakety-zamenit-0-0-0-beta-versions-na-final-release-versions.json
from the listed template/instructions using real owner or reviewer evidence,
then run pnpm final-release:gate.

Related gates:

- 8. npm-пакеты: Заменить `0.0.0`/beta versions на final release versions;
     command `pnpm final-release:gate`

### docs/reviews/blocker-benchmark/DELIVERY_EVIDENCE.json

Create docs/reviews/blocker-benchmark/DELIVERY_EVIDENCE.json from the listed
template/instructions using real owner or reviewer evidence, then run pnpm
rule-qa:review-delivery.

Related gates:

- 2. Независимая проверка blocker-правил: Передать им review packet; command
     `pnpm rule-qa:review-delivery`

### docs/reviews/blocker-benchmark/reviewer-1.review.json

Create docs/reviews/blocker-benchmark/reviewer-1.review.json from the listed
template/instructions using real owner or reviewer evidence, then run pnpm
rule-qa:review.

Related gates:

- 2. Независимая проверка blocker-правил: Найти двух независимых reviewers;
     command `pnpm rule-qa:review`
- 2. Независимая проверка blocker-правил: Проверить все 1960 benchmark cases;
     command `pnpm rule-qa:review`
- 2. Независимая проверка blocker-правил: Получить reviewer-1.review.json;
     command `pnpm rule-qa:review`
- 2. Независимая проверка blocker-правил: Получить reviewer-2.review.json;
     command `pnpm rule-qa:review`
- 2. Независимая проверка blocker-правил: Проверить полный coverage обоих
     review-файлов; command `pnpm rule-qa:review`
- 2. Независимая проверка blocker-правил: Проверить совпадение benchmarkVersion;
     command `pnpm rule-qa:review`
- 2. Независимая проверка blocker-правил: Разобрать disagreements; command
     `pnpm rule-qa:review`
- 2. Независимая проверка blocker-правил: Провести adjudication disputed cases;
     command `pnpm rule-qa:review`
- 2. Независимая проверка blocker-правил: Повторно запустить pnpm
     rule-qa:review; command `pnpm rule-qa:review`
- 2. Независимая проверка blocker-правил: Получить успешный OD-023 release gate;
     command `pnpm rule-qa:review`
- 2. Независимая проверка blocker-правил: Сохранить reviewer evidence и итоговый
     отчёт; command `pnpm rule-qa:review`
- 3. Core и все 120 правил: Подтвердить release-quality всех 120 правил после
     reviewer gate; command `pnpm rule-qa:review`
- 31. Финальный SearchLint 1.0 Release Gate: Все два reviewer sign-off получены;
      command `pnpm rule-qa:review`

### docs/reviews/blocker-benchmark/reviewer-2.review.json

Create docs/reviews/blocker-benchmark/reviewer-2.review.json from the listed
template/instructions using real owner or reviewer evidence, then run pnpm
rule-qa:review.

Related gates:

- 2. Независимая проверка blocker-правил: Найти двух независимых reviewers;
     command `pnpm rule-qa:review`
- 2. Независимая проверка blocker-правил: Проверить все 1960 benchmark cases;
     command `pnpm rule-qa:review`
- 2. Независимая проверка blocker-правил: Получить reviewer-1.review.json;
     command `pnpm rule-qa:review`
- 2. Независимая проверка blocker-правил: Получить reviewer-2.review.json;
     command `pnpm rule-qa:review`
- 2. Независимая проверка blocker-правил: Проверить полный coverage обоих
     review-файлов; command `pnpm rule-qa:review`
- 2. Независимая проверка blocker-правил: Проверить совпадение benchmarkVersion;
     command `pnpm rule-qa:review`
- 2. Независимая проверка blocker-правил: Разобрать disagreements; command
     `pnpm rule-qa:review`
- 2. Независимая проверка blocker-правил: Провести adjudication disputed cases;
     command `pnpm rule-qa:review`
- 2. Независимая проверка blocker-правил: Повторно запустить pnpm
     rule-qa:review; command `pnpm rule-qa:review`
- 2. Независимая проверка blocker-правил: Получить успешный OD-023 release gate;
     command `pnpm rule-qa:review`
- 2. Независимая проверка blocker-правил: Сохранить reviewer evidence и итоговый
     отчёт; command `pnpm rule-qa:review`
- 3. Core и все 120 правил: Подтвердить release-quality всех 120 правил после
     reviewer gate; command `pnpm rule-qa:review`
- 31. Финальный SearchLint 1.0 Release Gate: Все два reviewer sign-off получены;
      command `pnpm rule-qa:review`

### docs/reviews/oauth-vault-security/reviewer-1.review.json

Create docs/reviews/oauth-vault-security/reviewer-1.review.json from the listed
template/instructions using real owner or reviewer evidence, then run pnpm
oauth-vault:security-review.

Related gates:

- 16. OAuth vault: Провести external security review vault; command
      `pnpm oauth-vault:security-review`

### docs/reviews/oauth-vault-security/reviewer-2.review.json

Create docs/reviews/oauth-vault-security/reviewer-2.review.json from the listed
template/instructions using real owner or reviewer evidence, then run pnpm
oauth-vault:security-review.

Related gates:

- 16. OAuth vault: Провести external security review vault; command
      `pnpm oauth-vault:security-review`

### docs/reviews/overlay-accessibility/reviewer.review.json

Create docs/reviews/overlay-accessibility/reviewer.review.json from the listed
template/instructions using real owner or reviewer evidence, then run pnpm
overlay:manual-a11y-review.

Related gates:

- 6. Badge и Overlay: Провести ручной accessibility audit; command
     `pnpm overlay:manual-a11y-review`
- 6. Badge и Overlay: Проверить screen readers; command
     `pnpm overlay:manual-a11y-review`
- 31. Финальный SearchLint 1.0 Release Gate: Overlay release acceptance пройден;
      command `pnpm overlay:manual-a11y-review`

### docs/reviews/penetration-test/report-summary.json

Create docs/reviews/penetration-test/report-summary.json from the listed
template/instructions using real owner or reviewer evidence, then run pnpm
security:pentest.

Related gates:

- 28. Security и Privacy: Провести penetration test; command
      `pnpm security:pentest`
- 31. Финальный SearchLint 1.0 Release Gate: Penetration test пройден; command
      `pnpm security:pentest`

## Non-Claims

- Templates and instructions are not owner evidence.
- This report does not create reviewer, legal, security, deployment, provider,
  publication, backup, or final release sign-off.
- Checklist items remain open until real evidence files exist and the related
  verifier passes.
