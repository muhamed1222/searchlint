# Release Owner Action Runbook

Status date: 2026-06-23

This runbook is generated from `reports/release-owner-gate-actions-report.json`.
It groups the remaining SearchLint 1.0 gates by practical execution phase.

It does not close any gate and does not provide owner, legal, reviewer,
deployed, live provider, publication, or final release evidence.

## Orchestration Board

Use `docs/RELEASE_EVIDENCE_CONTROL_BOARD.md` for the current owner-routing board
across release evidence issues `#19` through `#25`, including packet checksums,
dispatch packet references, priority order, and forbidden release actions.

## Current Count

- checked: 522
- open: 77
- total: 599
- actionability: passed

## How To Use

1. Start with phase 1 and work downward unless an owner explicitly chooses a
   parallel track.
2. For each gate, produce the listed evidence paths and run the related command.
3. Mark a master-checklist item complete only after direct evidence exists and
   the relevant verifier passes.
4. Regenerate this runbook after every completed external gate.

## Phase Summary

| Phase                                    | Gates | Gate types                                                                                    |
| ---------------------------------------- | ----: | --------------------------------------------------------------------------------------------- |
| Reviewer And Rule Quality Gates          |    17 | independent_reviewer_gate, independent_reviewer_delivery_gate, rule_quality_final_gate        |
| Governance Legal And Repository Gates    |     2 | legal_owner_gate                                                                              |
| npm And VS Code Publication Gates        |     7 | vscode_marketplace_gate, npm_publication_gate                                                 |
| Production Platform Gates                |    21 | production_deployment_gate                                                                    |
| Live Provider Acceptance Gates           |    17 | live_provider_acceptance_gate                                                                 |
| Accessibility Security And Website Gates |    10 | manual_accessibility_review_gate, external_security_review_gate, deployed_public_website_gate |
| Final Release Gates                      |     3 | final_release_action_gate                                                                     |

## Reviewer And Rule Quality Gates

Complete OD-023 delivery, independent reviewer files, adjudication, and final
rule-quality confirmation.

Open gates: 17

### 1. 2. Независимая проверка blocker-правил - Найти двух независимых reviewers

- gate type: `independent_reviewer_gate`
- command: `pnpm rule-qa:review`
- required evidence: Two real independent reviewer JSON files, full benchmark
  coverage, matching benchmarkVersion, adjudicated disagreements, and passing
  pnpm rule-qa:review.
- next owner action: Select two independent reviewers, collect
  reviewer-1.review.json and reviewer-2.review.json, adjudicate disputes, then
  rerun the review gate.
- evidence paths:
  - `docs/reviews/blocker-benchmark/reviewer-1.review.json`
  - `docs/reviews/blocker-benchmark/reviewer-2.review.json`
  - `reports/blocker-benchmark-adjudication-summary.json`

### 2. 2. Независимая проверка blocker-правил - Передать им review packet

- gate type: `independent_reviewer_delivery_gate`
- command: `pnpm rule-qa:review-delivery`
- required evidence: Owner-provided DELIVERY_EVIDENCE.json proving the blocker
  benchmark review packet was sent to two intended independent reviewers, with
  matching benchmarkVersion and case-index SHA-256.
- next owner action: Send the handoff packet to two intended independent
  reviewers, provide DELIVERY_EVIDENCE.json, then run the delivery gate.
- evidence paths:
  - `docs/reviews/blocker-benchmark/DELIVERY_EVIDENCE.json`
  - `reports/blocker-benchmark-review-delivery-report.json`

### 3. 2. Независимая проверка blocker-правил - Проверить все 1960 benchmark cases

- gate type: `independent_reviewer_gate`
- command: `pnpm rule-qa:review`
- required evidence: Two real independent reviewer JSON files, full benchmark
  coverage, matching benchmarkVersion, adjudicated disagreements, and passing
  pnpm rule-qa:review.
- next owner action: Select two independent reviewers, collect
  reviewer-1.review.json and reviewer-2.review.json, adjudicate disputes, then
  rerun the review gate.
- evidence paths:
  - `docs/reviews/blocker-benchmark/reviewer-1.review.json`
  - `docs/reviews/blocker-benchmark/reviewer-2.review.json`
  - `reports/blocker-benchmark-adjudication-summary.json`

### 4. 2. Независимая проверка blocker-правил - Получить reviewer-1.review.json

- gate type: `independent_reviewer_gate`
- command: `pnpm rule-qa:review`
- required evidence: Two real independent reviewer JSON files, full benchmark
  coverage, matching benchmarkVersion, adjudicated disagreements, and passing
  pnpm rule-qa:review.
- next owner action: Select two independent reviewers, collect
  reviewer-1.review.json and reviewer-2.review.json, adjudicate disputes, then
  rerun the review gate.
- evidence paths:
  - `docs/reviews/blocker-benchmark/reviewer-1.review.json`
  - `docs/reviews/blocker-benchmark/reviewer-2.review.json`
  - `reports/blocker-benchmark-adjudication-summary.json`

### 5. 2. Независимая проверка blocker-правил - Получить reviewer-2.review.json

- gate type: `independent_reviewer_gate`
- command: `pnpm rule-qa:review`
- required evidence: Two real independent reviewer JSON files, full benchmark
  coverage, matching benchmarkVersion, adjudicated disagreements, and passing
  pnpm rule-qa:review.
- next owner action: Select two independent reviewers, collect
  reviewer-1.review.json and reviewer-2.review.json, adjudicate disputes, then
  rerun the review gate.
- evidence paths:
  - `docs/reviews/blocker-benchmark/reviewer-1.review.json`
  - `docs/reviews/blocker-benchmark/reviewer-2.review.json`
  - `reports/blocker-benchmark-adjudication-summary.json`

### 6. 2. Независимая проверка blocker-правил - Проверить полный coverage обоих review-файлов

- gate type: `independent_reviewer_gate`
- command: `pnpm rule-qa:review`
- required evidence: Two real independent reviewer JSON files, full benchmark
  coverage, matching benchmarkVersion, adjudicated disagreements, and passing
  pnpm rule-qa:review.
- next owner action: Select two independent reviewers, collect
  reviewer-1.review.json and reviewer-2.review.json, adjudicate disputes, then
  rerun the review gate.
- evidence paths:
  - `docs/reviews/blocker-benchmark/reviewer-1.review.json`
  - `docs/reviews/blocker-benchmark/reviewer-2.review.json`
  - `reports/blocker-benchmark-adjudication-summary.json`

### 7. 2. Независимая проверка blocker-правил - Проверить совпадение benchmarkVersion

- gate type: `independent_reviewer_gate`
- command: `pnpm rule-qa:review`
- required evidence: Two real independent reviewer JSON files, full benchmark
  coverage, matching benchmarkVersion, adjudicated disagreements, and passing
  pnpm rule-qa:review.
- next owner action: Select two independent reviewers, collect
  reviewer-1.review.json and reviewer-2.review.json, adjudicate disputes, then
  rerun the review gate.
- evidence paths:
  - `docs/reviews/blocker-benchmark/reviewer-1.review.json`
  - `docs/reviews/blocker-benchmark/reviewer-2.review.json`
  - `reports/blocker-benchmark-adjudication-summary.json`

### 8. 2. Независимая проверка blocker-правил - Разобрать disagreements

- gate type: `independent_reviewer_gate`
- command: `pnpm rule-qa:review`
- required evidence: Two real independent reviewer JSON files, full benchmark
  coverage, matching benchmarkVersion, adjudicated disagreements, and passing
  pnpm rule-qa:review.
- next owner action: Select two independent reviewers, collect
  reviewer-1.review.json and reviewer-2.review.json, adjudicate disputes, then
  rerun the review gate.
- evidence paths:
  - `docs/reviews/blocker-benchmark/reviewer-1.review.json`
  - `docs/reviews/blocker-benchmark/reviewer-2.review.json`
  - `reports/blocker-benchmark-adjudication-summary.json`

### 9. 2. Независимая проверка blocker-правил - Провести adjudication disputed cases

- gate type: `independent_reviewer_gate`
- command: `pnpm rule-qa:review`
- required evidence: Two real independent reviewer JSON files, full benchmark
  coverage, matching benchmarkVersion, adjudicated disagreements, and passing
  pnpm rule-qa:review.
- next owner action: Select two independent reviewers, collect
  reviewer-1.review.json and reviewer-2.review.json, adjudicate disputes, then
  rerun the review gate.
- evidence paths:
  - `docs/reviews/blocker-benchmark/reviewer-1.review.json`
  - `docs/reviews/blocker-benchmark/reviewer-2.review.json`
  - `reports/blocker-benchmark-adjudication-summary.json`

### 10. 2. Независимая проверка blocker-правил - Повторно запустить pnpm rule-qa:review

- gate type: `independent_reviewer_gate`
- command: `pnpm rule-qa:review`
- required evidence: Two real independent reviewer JSON files, full benchmark
  coverage, matching benchmarkVersion, adjudicated disagreements, and passing
  pnpm rule-qa:review.
- next owner action: Select two independent reviewers, collect
  reviewer-1.review.json and reviewer-2.review.json, adjudicate disputes, then
  rerun the review gate.
- evidence paths:
  - `docs/reviews/blocker-benchmark/reviewer-1.review.json`
  - `docs/reviews/blocker-benchmark/reviewer-2.review.json`
  - `reports/blocker-benchmark-adjudication-summary.json`

### 11. 2. Независимая проверка blocker-правил - Получить успешный OD-023 release gate

- gate type: `independent_reviewer_gate`
- command: `pnpm rule-qa:review`
- required evidence: Two real independent reviewer JSON files, full benchmark
  coverage, matching benchmarkVersion, adjudicated disagreements, and passing
  pnpm rule-qa:review.
- next owner action: Select two independent reviewers, collect
  reviewer-1.review.json and reviewer-2.review.json, adjudicate disputes, then
  rerun the review gate.
- evidence paths:
  - `docs/reviews/blocker-benchmark/reviewer-1.review.json`
  - `docs/reviews/blocker-benchmark/reviewer-2.review.json`
  - `reports/blocker-benchmark-adjudication-summary.json`

### 12. 2. Независимая проверка blocker-правил - Сохранить reviewer evidence и итоговый отчёт

- gate type: `independent_reviewer_gate`
- command: `pnpm rule-qa:review`
- required evidence: Two real independent reviewer JSON files, full benchmark
  coverage, matching benchmarkVersion, adjudicated disagreements, and passing
  pnpm rule-qa:review.
- next owner action: Select two independent reviewers, collect
  reviewer-1.review.json and reviewer-2.review.json, adjudicate disputes, then
  rerun the review gate.
- evidence paths:
  - `docs/reviews/blocker-benchmark/reviewer-1.review.json`
  - `docs/reviews/blocker-benchmark/reviewer-2.review.json`
  - `reports/blocker-benchmark-adjudication-summary.json`

### 13. 2. Независимая проверка blocker-правил - Обновить статус Rule QA на VERIFIED_COMPLETE

- gate type: `rule_quality_final_gate`
- command: `pnpm rule-qa:review`
- required evidence: Passed independent OD-023 reviewer gate plus
  release-quality confirmation for all 120 rules.
- next owner action: Complete the independent reviewer gate, then rerun rule QA
  and update status.
- evidence paths:
  - `reports/blocker-benchmark-adjudication-summary.json`
  - `reports/rule-qa-summary.json`

### 14. 3. Core и все 120 правил - Подтвердить release-quality всех 120 правил после reviewer gate

- gate type: `independent_reviewer_gate`
- command: `pnpm rule-qa:review`
- required evidence: Two real independent reviewer JSON files, full benchmark
  coverage, matching benchmarkVersion, adjudicated disagreements, and passing
  pnpm rule-qa:review.
- next owner action: Select two independent reviewers, collect
  reviewer-1.review.json and reviewer-2.review.json, adjudicate disputes, then
  rerun the review gate.
- evidence paths:
  - `docs/reviews/blocker-benchmark/reviewer-1.review.json`
  - `docs/reviews/blocker-benchmark/reviewer-2.review.json`
  - `reports/blocker-benchmark-adjudication-summary.json`

### 15. 31. Финальный SearchLint 1.0 Release Gate - Все два reviewer sign-off получены

- gate type: `independent_reviewer_gate`
- command: `pnpm rule-qa:review`
- required evidence: Two real independent reviewer JSON files, full benchmark
  coverage, matching benchmarkVersion, adjudicated disagreements, and passing
  pnpm rule-qa:review.
- next owner action: Select two independent reviewers, collect
  reviewer-1.review.json and reviewer-2.review.json, adjudicate disputes, then
  rerun the review gate.
- evidence paths:
  - `docs/reviews/blocker-benchmark/reviewer-1.review.json`
  - `docs/reviews/blocker-benchmark/reviewer-2.review.json`
  - `reports/blocker-benchmark-adjudication-summary.json`

### 16. 31. Финальный SearchLint 1.0 Release Gate - Rule QA gate прошёл

- gate type: `rule_quality_final_gate`
- command: `pnpm rule-qa:review`
- required evidence: Passed independent OD-023 reviewer gate plus
  release-quality confirmation for all 120 rules.
- next owner action: Complete the independent reviewer gate, then rerun rule QA
  and update status.
- evidence paths:
  - `reports/blocker-benchmark-adjudication-summary.json`
  - `reports/rule-qa-summary.json`

### 17. 31. Финальный SearchLint 1.0 Release Gate - Все 120 правил verified

- gate type: `rule_quality_final_gate`
- command: `pnpm rule-qa:review`
- required evidence: Passed independent OD-023 reviewer gate plus
  release-quality confirmation for all 120 rules.
- next owner action: Complete the independent reviewer gate, then rerun rule QA
  and update status.
- evidence paths:
  - `reports/blocker-benchmark-adjudication-summary.json`
  - `reports/rule-qa-summary.json`

## Governance Legal And Repository Gates

Finish legal approval and hosted GitHub/repository governance before publication
or public launch.

Open gates: 2

### 1. 1. Управление проектом - Провести юридическую проверку публичной и закрытой частей проекта

- gate type: `legal_owner_gate`
- command: `pnpm legal:release-gate`
- required evidence: Qualified legal/owner approval JSON plus reviewed
  public/private repository boundary evidence.
- next owner action: Complete legal review and provide the approved release-gate
  evidence file.
- evidence paths:
  - `docs/legal-release-approval.json`
  - `reports/legal-release-approval-report.json`

### 2. 31. Финальный SearchLint 1.0 Release Gate - Legal review завершён

- gate type: `legal_owner_gate`
- command: `pnpm legal:release-gate`
- required evidence: Qualified legal/owner approval JSON plus reviewed
  public/private repository boundary evidence.
- next owner action: Complete legal review and provide the approved release-gate
  evidence file.
- evidence paths:
  - `docs/legal-release-approval.json`
  - `reports/legal-release-approval-report.json`

## npm And VS Code Publication Gates

Complete public package metadata, npm publication, Marketplace publisher, and
extension publication evidence.

Open gates: 7

### 1. 7. VS Code и LSP - Настроить publisher account

- gate type: `vscode_marketplace_gate`
- command: `pnpm vscode:update-e2e`
- required evidence: VS Code Marketplace publisher account configured for
  SearchLint plus local VSIX readiness/update evidence.
- next owner action: Configure the Marketplace publisher account, keep the local
  VSIX/update evidence current, and preserve publisher setup evidence outside
  secrets.
- evidence paths:
  - `docs/release-owner-evidence/7-vs-code-i-lsp-nastroit-publisher-account.json`
  - `reports/vscode-vsix-readiness-report.json`
  - `reports/vscode-update-e2e-report.json`

### 2. 7. VS Code и LSP - Подписать и опубликовать extension

- gate type: `vscode_marketplace_gate`
- command: `pnpm vscode:update-e2e`
- required evidence: Signed and published VS Code extension on Marketplace,
  publisher metadata, and clean install/update evidence after publication.
- next owner action: After publisher setup and legal approval, publish the VSIX
  through the Marketplace flow and preserve publication/install evidence.
- evidence paths:
  - `docs/release-owner-evidence/7-vs-code-i-lsp-podpisat-i-opublikovat-extension.json`
  - `reports/vscode-vsix-readiness-report.json`
  - `reports/vscode-clean-install-e2e-report.json`
  - `reports/vscode-update-e2e-report.json`

### 3. 8. npm-пакеты - Заменить `0.0.0`/beta versions на final release versions

- gate type: `npm_publication_gate`
- command: `pnpm final-release:gate`
- required evidence: Final 1.0.0 version approval, passing RC matrix, hosted npm
  publication proof, provenance, and clean public registry install.
- next owner action: Run final publication only after all release gates pass,
  then preserve npm publication and install evidence.
- evidence paths:
  - `docs/release-owner-evidence/8-npm-pakety-zamenit-0-0-0-beta-versions-na-final-release-versions.json`
  - `reports/final-release-gate-report.json`
  - `reports/searchlint-1-0-rc-matrix-report.json`

### 4. 8. npm-пакеты - Опубликовать beta packages

- gate type: `npm_publication_gate`
- command: `pnpm package:beta-publication-gate`
- required evidence: Hosted npm workflow publication proof for 1.0.0-beta.0, npm
  provenance, beta dist-tag, and no private package publication.
- next owner action: Complete legal/package metadata gates, configure npm
  trusted publishing, run the hosted workflow with publish=true and tag=beta,
  then preserve publication evidence.
- evidence paths:
  - `docs/release-owner-evidence/8-npm-pakety-opublikovat-beta-packages.json`
  - `reports/beta-package-publication-gate-report.json`
  - `reports/prerelease-beta-preparation-report.json`

### 5. 8. npm-пакеты - Подготовить финальную публикацию 1.0.0

- gate type: `npm_publication_gate`
- command: `pnpm final-release:gate`
- required evidence: Final 1.0.0 version approval, passing RC matrix, hosted npm
  publication proof, provenance, and clean public registry install.
- next owner action: Run final publication only after all release gates pass,
  then preserve npm publication and install evidence.
- evidence paths:
  - `docs/release-owner-evidence/8-npm-pakety-podgotovit-finalnuyu-publikaciyu-1-0-0.json`
  - `reports/final-release-gate-report.json`
  - `reports/searchlint-1-0-rc-matrix-report.json`

### 6. 31. Финальный SearchLint 1.0 Release Gate - npm-пакеты опубликованы

- gate type: `npm_publication_gate`
- command: `pnpm final-release:gate`
- required evidence: Final 1.0.0 version approval, passing RC matrix, hosted npm
  publication proof, provenance, and clean public registry install.
- next owner action: Run final publication only after all release gates pass,
  then preserve npm publication and install evidence.
- evidence paths:
  - `docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-npm-pakety-opublikovany.json`
  - `reports/final-release-gate-report.json`
  - `reports/searchlint-1-0-rc-matrix-report.json`

### 7. 31. Финальный SearchLint 1.0 Release Gate - VS Code extension опубликован

- gate type: `vscode_marketplace_gate`
- command: `pnpm vscode:update-e2e`
- required evidence: Signed and published VS Code extension on Marketplace,
  publisher metadata, and clean install/update evidence after publication.
- next owner action: After publisher setup and legal approval, publish the VSIX
  through the Marketplace flow and preserve publication/install evidence.
- evidence paths:
  - `docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-vs-code-extension-opublikovan.json`
  - `reports/vscode-vsix-readiness-report.json`
  - `reports/vscode-clean-install-e2e-report.json`
  - `reports/vscode-update-e2e-report.json`

## Production Platform Gates

Deploy and verify cloud runtime, storage, database, API, workers, auth,
dashboard, observability, backup, and agency surfaces.

Open gates: 21

### 1. 10. Crawler - Проверить 100 000 URL в cloud

- gate type: `production_deployment_gate`
- command: `pnpm crawler:acceptance`
- required evidence: Cloud crawler execution evidence for 100,000 URLs,
  including deployed worker/resource identifiers, crawl summary,
  failure/retry/cost controls, and sanitized artifacts.
- next owner action: Run the cloud crawler scale acceptance in the deployed
  environment and preserve sanitized evidence.
- evidence paths:
  - `docs/release-owner-evidence/10-crawler-proverit-100-000-url-v-cloud.json`
  - `reports/crawler-acceptance-report.json`

### 2. 11. PostgreSQL и хранение данных - Развернуть настоящий PostgreSQL/RDS

- gate type: `production_deployment_gate`
- command: `pnpm verify:postgres`
- required evidence: Production-equivalent deployed target evidence, sanitized
  URLs/resource identifiers, and passing focused deployed acceptance command.
- next owner action: Deploy the target surface in the approved environment and
  capture sanitized deployed acceptance evidence.
- evidence paths:
  - `docs/release-owner-evidence/11-postgresql-i-hranenie-dannyh-razvernut-nastoyashii-postgresql-rds.json`
  - `reports/backend-api-postgresql-integration-report.json`
  - `reports/db-migrations-real-postgres-report.json`

### 3. 12. S3/Object Storage - Развернуть реальное object storage

- gate type: `production_deployment_gate`
- command: `pnpm object-storage:acceptance`
- required evidence: Production-equivalent deployed target evidence, sanitized
  URLs/resource identifiers, and passing focused deployed acceptance command.
- next owner action: Deploy the target surface in the approved environment and
  capture sanitized deployed acceptance evidence.
- evidence paths:
  - `docs/release-owner-evidence/12-s3-object-storage-razvernut-realnoe-object-storage.json`
  - `reports/object-storage-artifact-security-report.json`
  - `reports/object-storage-upload-contract-report.json`

### 4. 13. Backend API - Развернуть production API

- gate type: `production_deployment_gate`
- command: `pnpm api:acceptance`
- required evidence: Production-equivalent deployed target evidence, sanitized
  URLs/resource identifiers, and passing focused deployed acceptance command.
- next owner action: Deploy the target surface in the approved environment and
  capture sanitized deployed acceptance evidence.
- evidence paths:
  - `docs/release-owner-evidence/13-backend-api-razvernut-production-api.json`
  - `reports/backend-api-acceptance-report.json`

### 5. 22. История и корреляция - Провести deployed dashboard timeline acceptance

- gate type: `production_deployment_gate`
- command: `pnpm dashboard:production-e2e`
- required evidence: Production-equivalent deployed target evidence, sanitized
  URLs/resource identifiers, and passing focused deployed acceptance command.
- next owner action: Deploy the target surface in the approved environment and
  capture sanitized deployed acceptance evidence.
- evidence paths:
  - `docs/release-owner-evidence/22-istoriya-i-korrelyaciya-provesti-deployed-dashboard-timeline-acceptance.json`
  - `reports/dashboard-production-e2e-deployed-url-report.json`

### 6. 25. Billing - Проверить deployed Stripe webhook persistence on RDS

- gate type: `production_deployment_gate`
- command: `pnpm verify:postgres`
- required evidence: Production-equivalent deployed target evidence, sanitized
  URLs/resource identifiers, and passing focused deployed acceptance command.
- next owner action: Deploy the target surface in the approved environment and
  capture sanitized deployed acceptance evidence.
- evidence paths:
  - `docs/release-owner-evidence/25-billing-proverit-deployed-stripe-webhook-persistence-on-rds.json`
  - `reports/stripe-webhook-rds-acceptance-packet-report.json`

### 7. 26. Agency mode - Развернуть client portal

- gate type: `production_deployment_gate`
- command: `pnpm agency:client-access-browser-e2e`
- required evidence: Production-equivalent deployed target evidence, sanitized
  URLs/resource identifiers, and passing focused deployed acceptance command.
- next owner action: Deploy the target surface in the approved environment and
  capture sanitized deployed acceptance evidence.
- evidence paths:
  - `docs/release-owner-evidence/26-agency-mode-razvernut-client-portal.json`
  - `reports/agency-client-access-browser-e2e-report.json`

### 8. 27. Observability - Развернуть logging

- gate type: `production_deployment_gate`
- command: `pnpm observability:acceptance`
- required evidence: Production-equivalent deployed target evidence, sanitized
  URLs/resource identifiers, and passing focused deployed acceptance command.
- next owner action: Deploy the target surface in the approved environment and
  capture sanitized deployed acceptance evidence.
- evidence paths:
  - `docs/release-owner-evidence/27-observability-razvernut-logging.json`
  - `reports/observability-acceptance-report.json`
  - `reports/observability-error-tracking-report.json`

### 9. 27. Observability - Развернуть metrics

- gate type: `production_deployment_gate`
- command: `pnpm observability:acceptance`
- required evidence: Production-equivalent deployed target evidence, sanitized
  URLs/resource identifiers, and passing focused deployed acceptance command.
- next owner action: Deploy the target surface in the approved environment and
  capture sanitized deployed acceptance evidence.
- evidence paths:
  - `docs/release-owner-evidence/27-observability-razvernut-metrics.json`
  - `reports/observability-acceptance-report.json`
  - `reports/observability-error-tracking-report.json`

### 10. 27. Observability - Развернуть tracing

- gate type: `production_deployment_gate`
- command: `pnpm observability:acceptance`
- required evidence: Production-equivalent deployed target evidence, sanitized
  URLs/resource identifiers, and passing focused deployed acceptance command.
- next owner action: Deploy the target surface in the approved environment and
  capture sanitized deployed acceptance evidence.
- evidence paths:
  - `docs/release-owner-evidence/27-observability-razvernut-tracing.json`
  - `reports/observability-acceptance-report.json`
  - `reports/observability-error-tracking-report.json`

### 11. 27. Observability - Подключить CloudWatch/OTLP

- gate type: `production_deployment_gate`
- command: `pnpm observability:acceptance`
- required evidence: Production-equivalent deployed target evidence, sanitized
  URLs/resource identifiers, and passing focused deployed acceptance command.
- next owner action: Deploy the target surface in the approved environment and
  capture sanitized deployed acceptance evidence.
- evidence paths:
  - `docs/release-owner-evidence/27-observability-podklyuchit-cloudwatch-otlp.json`
  - `reports/observability-acceptance-report.json`
  - `reports/observability-error-tracking-report.json`

### 12. 31. Финальный SearchLint 1.0 Release Gate - PostgreSQL/RDS proof пройден

- gate type: `production_deployment_gate`
- command: `pnpm verify:postgres`
- required evidence: Production-equivalent deployed target evidence, sanitized
  URLs/resource identifiers, and passing focused deployed acceptance command.
- next owner action: Deploy the target surface in the approved environment and
  capture sanitized deployed acceptance evidence.
- evidence paths:
  - `docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-postgresql-rds-proof-proiden.json`
  - `reports/backend-api-postgresql-integration-report.json`
  - `reports/db-migrations-real-postgres-report.json`

### 13. 31. Финальный SearchLint 1.0 Release Gate - API deployment proof пройден

- gate type: `production_deployment_gate`
- command: `pnpm api:acceptance`
- required evidence: Production-equivalent deployed target evidence, sanitized
  URLs/resource identifiers, and passing focused deployed acceptance command.
- next owner action: Deploy the target surface in the approved environment and
  capture sanitized deployed acceptance evidence.
- evidence paths:
  - `docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-api-deployment-proof-proiden.json`
  - `reports/backend-api-acceptance-report.json`

### 14. 31. Финальный SearchLint 1.0 Release Gate - Workers/SQS proof пройден

- gate type: `production_deployment_gate`
- command: `pnpm workers:acceptance`
- required evidence: Production-equivalent deployed target evidence, sanitized
  URLs/resource identifiers, and passing focused deployed acceptance command.
- next owner action: Deploy the target surface in the approved environment and
  capture sanitized deployed acceptance evidence.
- evidence paths:
  - `docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-workers-sqs-proof-proiden.json`
  - `reports/workers-queues-scheduler-report.json`
  - `reports/worker-containers-report.json`
  - `reports/worker-sqs-dlq-report.json`

### 15. 31. Финальный SearchLint 1.0 Release Gate - S3 proof пройден

- gate type: `production_deployment_gate`
- command: `pnpm object-storage:acceptance`
- required evidence: Production-equivalent deployed target evidence, sanitized
  URLs/resource identifiers, and passing focused deployed acceptance command.
- next owner action: Deploy the target surface in the approved environment and
  capture sanitized deployed acceptance evidence.
- evidence paths:
  - `docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-s3-proof-proiden.json`
  - `reports/object-storage-artifact-security-report.json`
  - `reports/object-storage-upload-contract-report.json`

### 16. 31. Финальный SearchLint 1.0 Release Gate - Cognito/RBAC proof пройден

- gate type: `production_deployment_gate`
- command: `pnpm auth:acceptance`
- required evidence: Production-equivalent deployed target evidence, sanitized
  URLs/resource identifiers, and passing focused deployed acceptance command.
- next owner action: Deploy the target surface in the approved environment and
  capture sanitized deployed acceptance evidence.
- evidence paths:
  - `docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-cognito-rbac-proof-proiden.json`
  - `reports/auth-rbac-acceptance-report.json`
  - `reports/cognito-oidc-static-report.json`

### 17. 31. Финальный SearchLint 1.0 Release Gate - OAuth vault proof пройден

- gate type: `production_deployment_gate`
- command: `pnpm oauth-vault:acceptance`
- required evidence: Deployed KMS/Secrets Manager OAuth vault acceptance
  evidence plus external security review sign-off.
- next owner action: Run deployed OAuth vault acceptance and complete the
  independent vault security review.
- evidence paths:
  - `docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-oauth-vault-proof-proiden.json`
  - `reports/oauth-vault-security-report.json`
  - `reports/oauth-vault-security-review-report.json`

### 18. 31. Финальный SearchLint 1.0 Release Gate - Dashboard production E2E пройден

- gate type: `production_deployment_gate`
- command: `pnpm dashboard:production-e2e`
- required evidence: Production-equivalent deployed target evidence, sanitized
  URLs/resource identifiers, and passing focused deployed acceptance command.
- next owner action: Deploy the target surface in the approved environment and
  capture sanitized deployed acceptance evidence.
- evidence paths:
  - `docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-dashboard-production-e2e-proiden.json`
  - `reports/dashboard-production-e2e-deployed-url-report.json`

### 19. 31. Финальный SearchLint 1.0 Release Gate - Agency mode готов

- gate type: `production_deployment_gate`
- command: `pnpm agency:acceptance`
- required evidence: Agency mode deterministic evidence plus deployed
  persistence, client access, hosted white-label links, and billing evidence.
- next owner action: Run agency acceptance and deployed agency evidence gates,
  then preserve live billing/client access evidence.
- evidence paths:
  - `docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-agency-mode-gotov.json`
  - `reports/agency-acceptance-report.json`
  - `reports/agency-persistence-acceptance-packet-report.json`
  - `reports/agency-client-access-browser-e2e-report.json`

### 20. 31. Финальный SearchLint 1.0 Release Gate - Observability готова

- gate type: `production_deployment_gate`
- command: `pnpm observability:acceptance`
- required evidence: Production-equivalent deployed target evidence, sanitized
  URLs/resource identifiers, and passing focused deployed acceptance command.
- next owner action: Deploy the target surface in the approved environment and
  capture sanitized deployed acceptance evidence.
- evidence paths:
  - `docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-observability-gotova.json`
  - `reports/observability-acceptance-report.json`
  - `reports/observability-error-tracking-report.json`

### 21. 31. Финальный SearchLint 1.0 Release Gate - Backup/restore проверены

- gate type: `production_deployment_gate`
- command: `pnpm backup:restore-live-gate`
- required evidence: Live RDS backup restore, RDS PITR, and S3 object restore
  drill evidence.
- next owner action: Provide live backup/restore drill evidence and run the
  backup restore live gate.
- evidence paths:
  - `docs/live-backup-restore-drill.json`
  - `reports/live-backup-restore-drill-report.json`

## Live Provider Acceptance Gates

Run live Google, Yandex, PageSpeed/CrUX, Stripe, notification, and related
provider acceptance.

Open gates: 17

### 1. 18. Google Search Console - Провести live acceptance на реальном сайте

- gate type: `live_provider_acceptance_gate`
- command: `pnpm google:gsc:acceptance`
- required evidence: Live provider account/configuration evidence, sanitized API
  response or delivery proof, quota/freshness handling, and passing live
  acceptance command.
- next owner action: Provide live provider credentials/configuration outside the
  repo, run the relevant acceptance packet, and store sanitized evidence.
- evidence paths:
  - `docs/release-owner-evidence/18-google-search-console-provesti-live-acceptance-na-realnom-saite.json`
  - `reports/google-search-console-acceptance-report.json`

### 2. 19. PageSpeed и CrUX - Провести live acceptance

- gate type: `live_provider_acceptance_gate`
- command: `pnpm google:performance:acceptance`
- required evidence: Live provider account/configuration evidence, sanitized API
  response or delivery proof, quota/freshness handling, and passing live
  acceptance command.
- next owner action: Provide live provider credentials/configuration outside the
  repo, run the relevant acceptance packet, and store sanitized evidence.
- evidence paths:
  - `docs/release-owner-evidence/19-pagespeed-i-crux-provesti-live-acceptance.json`
  - `reports/google-performance-acceptance-report.json`
  - `reports/google-performance-history-report.json`

### 3. 20. Яндекс.Вебмастер - Провести live acceptance

- gate type: `live_provider_acceptance_gate`
- command: `pnpm yandex:acceptance`
- required evidence: Live provider account/configuration evidence, sanitized API
  response or delivery proof, quota/freshness handling, and passing live
  acceptance command.
- next owner action: Provide live provider credentials/configuration outside the
  repo, run the relevant acceptance packet, and store sanitized evidence.
- evidence paths:
  - `docs/release-owner-evidence/20-yandeks-vebmaster-provesti-live-acceptance.json`
  - `reports/yandex-acceptance-report.json`

### 4. 21. Яндекс.Метрика - Провести live acceptance

- gate type: `live_provider_acceptance_gate`
- command: `pnpm yandex:acceptance`
- required evidence: Live provider account/configuration evidence, sanitized API
  response or delivery proof, quota/freshness handling, and passing live
  acceptance command.
- next owner action: Provide live provider credentials/configuration outside the
  repo, run the relevant acceptance packet, and store sanitized evidence.
- evidence paths:
  - `docs/release-owner-evidence/21-yandeks-metrika-provesti-live-acceptance.json`
  - `reports/yandex-acceptance-report.json`

### 5. 24. Notifications - Провести live email delivery acceptance

- gate type: `live_provider_acceptance_gate`
- command: `pnpm notifications:acceptance`
- required evidence: Live provider account/configuration evidence, sanitized API
  response or delivery proof, quota/freshness handling, and passing live
  acceptance command.
- next owner action: Provide live provider credentials/configuration outside the
  repo, run the relevant acceptance packet, and store sanitized evidence.
- evidence paths:
  - `docs/release-owner-evidence/24-notifications-provesti-live-email-delivery-acceptance.json`
  - `reports/notifications-acceptance-report.json`

### 6. 24. Notifications - Провести live Slack delivery acceptance

- gate type: `live_provider_acceptance_gate`
- command: `pnpm notifications:acceptance`
- required evidence: Live provider account/configuration evidence, sanitized API
  response or delivery proof, quota/freshness handling, and passing live
  acceptance command.
- next owner action: Provide live provider credentials/configuration outside the
  repo, run the relevant acceptance packet, and store sanitized evidence.
- evidence paths:
  - `docs/release-owner-evidence/24-notifications-provesti-live-slack-delivery-acceptance.json`
  - `reports/notifications-acceptance-report.json`

### 7. 24. Notifications - Провести live webhook delivery acceptance

- gate type: `live_provider_acceptance_gate`
- command: `pnpm notifications:acceptance`
- required evidence: Live provider account/configuration evidence, sanitized API
  response or delivery proof, quota/freshness handling, and passing live
  acceptance command.
- next owner action: Provide live provider credentials/configuration outside the
  repo, run the relevant acceptance packet, and store sanitized evidence.
- evidence paths:
  - `docs/release-owner-evidence/24-notifications-provesti-live-webhook-delivery-acceptance.json`
  - `reports/notifications-acceptance-report.json`

### 8. 24. Notifications - Провести live Telegram delivery acceptance, если нужен

- gate type: `live_provider_acceptance_gate`
- command: `pnpm notifications:acceptance`
- required evidence: Live provider account/configuration evidence, sanitized API
  response or delivery proof, quota/freshness handling, and passing live
  acceptance command.
- next owner action: Provide live provider credentials/configuration outside the
  repo, run the relevant acceptance packet, and store sanitized evidence.
- evidence paths:
  - `docs/release-owner-evidence/24-notifications-provesti-live-telegram-delivery-acceptance-esli-nuzhen.json`
  - `reports/notifications-acceptance-report.json`

### 9. 25. Billing - Провести live customer portal acceptance

- gate type: `live_provider_acceptance_gate`
- command: `pnpm billing:live-stripe-final-acceptance-packet`
- required evidence: Live provider account/configuration evidence, sanitized API
  response or delivery proof, quota/freshness handling, and passing live
  acceptance command.
- next owner action: Provide live provider credentials/configuration outside the
  repo, run the relevant acceptance packet, and store sanitized evidence.
- evidence paths:
  - `docs/release-owner-evidence/25-billing-provesti-live-customer-portal-acceptance.json`
  - `reports/live-stripe-customer-portal-acceptance-packet-report.json`

### 10. 25. Billing - Провести live subscription/trial/upgrade/downgrade/cancellation acceptance

- gate type: `live_provider_acceptance_gate`
- command: `pnpm billing:live-stripe-final-acceptance-packet`
- required evidence: Live provider account/configuration evidence, sanitized API
  response or delivery proof, quota/freshness handling, and passing live
  acceptance command.
- next owner action: Provide live provider credentials/configuration outside the
  repo, run the relevant acceptance packet, and store sanitized evidence.
- evidence paths:
  - `docs/release-owner-evidence/25-billing-provesti-live-subscription-trial-upgrade-downgrade-cancellation-acceptance.json`
  - `reports/live-stripe-final-acceptance-packet-report.json`

### 11. 25. Billing - Провести live Stripe acceptance

- gate type: `live_provider_acceptance_gate`
- command: `pnpm billing:live-stripe-final-acceptance-packet`
- required evidence: Live provider account/configuration evidence, sanitized API
  response or delivery proof, quota/freshness handling, and passing live
  acceptance command.
- next owner action: Provide live provider credentials/configuration outside the
  repo, run the relevant acceptance packet, and store sanitized evidence.
- evidence paths:
  - `docs/release-owner-evidence/25-billing-provesti-live-stripe-acceptance.json`
  - `reports/live-stripe-final-acceptance-packet-report.json`

### 12. 26. Agency mode - Реализовать live agency billing

- gate type: `live_provider_acceptance_gate`
- command: `pnpm billing:live-stripe-final-acceptance-packet`
- required evidence: Live provider account/configuration evidence, sanitized API
  response or delivery proof, quota/freshness handling, and passing live
  acceptance command.
- next owner action: Provide live provider credentials/configuration outside the
  repo, run the relevant acceptance packet, and store sanitized evidence.
- evidence paths:
  - `docs/release-owner-evidence/26-agency-mode-realizovat-live-agency-billing.json`
  - `reports/live-stripe-final-acceptance-packet-report.json`

### 13. 26. Agency mode - Проверить client invite email delivery

- gate type: `live_provider_acceptance_gate`
- command: `pnpm notifications:acceptance`
- required evidence: Live provider account/configuration evidence, sanitized API
  response or delivery proof, quota/freshness handling, and passing live
  acceptance command.
- next owner action: Provide live provider credentials/configuration outside the
  repo, run the relevant acceptance packet, and store sanitized evidence.
- evidence paths:
  - `docs/release-owner-evidence/26-agency-mode-proverit-client-invite-email-delivery.json`
  - `reports/notifications-acceptance-report.json`

### 14. 31. Финальный SearchLint 1.0 Release Gate - Google live acceptance пройден

- gate type: `live_provider_acceptance_gate`
- command: `pnpm google:gsc:acceptance`
- required evidence: Live provider account/configuration evidence, sanitized API
  response or delivery proof, quota/freshness handling, and passing live
  acceptance command.
- next owner action: Provide live provider credentials/configuration outside the
  repo, run the relevant acceptance packet, and store sanitized evidence.
- evidence paths:
  - `docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-google-live-acceptance-proiden.json`
  - `reports/google-search-console-acceptance-report.json`

### 15. 31. Финальный SearchLint 1.0 Release Gate - Yandex live acceptance пройден

- gate type: `live_provider_acceptance_gate`
- command: `pnpm yandex:acceptance`
- required evidence: Live provider account/configuration evidence, sanitized API
  response or delivery proof, quota/freshness handling, and passing live
  acceptance command.
- next owner action: Provide live provider credentials/configuration outside the
  repo, run the relevant acceptance packet, and store sanitized evidence.
- evidence paths:
  - `docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-yandex-live-acceptance-proiden.json`
  - `reports/yandex-acceptance-report.json`

### 16. 31. Финальный SearchLint 1.0 Release Gate - Billing live acceptance пройден

- gate type: `live_provider_acceptance_gate`
- command: `pnpm billing:live-stripe-final-acceptance-packet`
- required evidence: Live provider account/configuration evidence, sanitized API
  response or delivery proof, quota/freshness handling, and passing live
  acceptance command.
- next owner action: Provide live provider credentials/configuration outside the
  repo, run the relevant acceptance packet, and store sanitized evidence.
- evidence paths:
  - `docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-billing-live-acceptance-proiden.json`
  - `reports/live-stripe-final-acceptance-packet-report.json`

### 17. 31. Финальный SearchLint 1.0 Release Gate - Notifications готовы

- gate type: `live_provider_acceptance_gate`
- command: `pnpm notifications:acceptance`
- required evidence: Notification contracts, persistence/redaction evidence, and
  live provider delivery evidence for the enabled channels.
- next owner action: Run notification acceptance plus live provider delivery
  checks and preserve sanitized delivery evidence.
- evidence paths:
  - `docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-notifications-gotovy.json`
  - `reports/notifications-acceptance-report.json`
  - `reports/notification-workers-static-report.json`
  - `reports/notification-settings-persistence-static-report.json`
  - `reports/notification-redaction-review-report.json`

## Accessibility Security And Website Gates

Complete manual accessibility, DAST, penetration testing, security gates, and
deployed public website evidence.

Open gates: 10

### 1. 6. Badge и Overlay - Провести ручной accessibility audit

- gate type: `manual_accessibility_review_gate`
- command: `pnpm overlay:manual-a11y-review`
- required evidence: Manual accessibility review evidence for the required
  assistive technology/browser matrix.
- next owner action: Run the manual accessibility review and record reviewer
  evidence.
- evidence paths:
  - `docs/reviews/overlay-accessibility/reviewer.review.json`
  - `reports/overlay-manual-a11y-review-report.json`

### 2. 6. Badge и Overlay - Проверить screen readers

- gate type: `manual_accessibility_review_gate`
- command: `pnpm overlay:manual-a11y-review`
- required evidence: Manual accessibility review evidence for the required
  assistive technology/browser matrix.
- next owner action: Run the manual accessibility review and record reviewer
  evidence.
- evidence paths:
  - `docs/reviews/overlay-accessibility/reviewer.review.json`
  - `reports/overlay-manual-a11y-review-report.json`

### 3. 16. OAuth vault - Провести external security review vault

- gate type: `external_security_review_gate`
- command: `pnpm oauth-vault:security-review`
- required evidence: Two real independent OAuth vault security reviewer files
  plus passing vault security review report.
- next owner action: Provide real OAuth vault security reviewer evidence and
  rerun the vault security review gate.
- evidence paths:
  - `docs/reviews/oauth-vault-security/reviewer-1.review.json`
  - `docs/reviews/oauth-vault-security/reviewer-2.review.json`
  - `reports/oauth-vault-security-review-report.json`

### 4. 28. Security и Privacy - Провести DAST

- gate type: `external_security_review_gate`
- command: `pnpm security:dast`
- required evidence: Passed deployed-target DAST, independent penetration-test
  report, remediation sign-off, and security/legal approval.
- next owner action: Run DAST against deployed production-equivalent targets,
  commission independent penetration testing, remediate findings, and approve
  the final gate.
- evidence paths:
  - `docs/release-owner-evidence/28-security-i-privacy-provesti-dast.json`
  - `reports/dast-release-gate-report.json`

### 5. 28. Security и Privacy - Провести penetration test

- gate type: `external_security_review_gate`
- command: `pnpm security:pentest`
- required evidence: Passed deployed-target DAST, independent penetration-test
  report, remediation sign-off, and security/legal approval.
- next owner action: Run DAST against deployed production-equivalent targets,
  commission independent penetration testing, remediate findings, and approve
  the final gate.
- evidence paths:
  - `docs/reviews/penetration-test/report-summary.json`
  - `reports/penetration-test-release-gate-report.json`

### 6. 28. Security и Privacy - Завершить security release gate

- gate type: `external_security_review_gate`
- command: `pnpm security:dast`
- required evidence: Passed deployed-target DAST, independent penetration-test
  report, remediation sign-off, and security/legal approval.
- next owner action: Run DAST against deployed production-equivalent targets,
  commission independent penetration testing, remediate findings, and approve
  the final gate.
- evidence paths:
  - `docs/release-owner-evidence/28-security-i-privacy-zavershit-security-release-gate.json`
  - `reports/security-privacy-acceptance-report.json`
  - `reports/dast-release-gate-report.json`
  - `reports/penetration-test-release-gate-report.json`

### 7. 31. Финальный SearchLint 1.0 Release Gate - Overlay release acceptance пройден

- gate type: `manual_accessibility_review_gate`
- command: `pnpm overlay:manual-a11y-review`
- required evidence: Overlay automated acceptance, visual regression, and manual
  accessibility/screen-reader reviewer evidence.
- next owner action: Run overlay acceptance/visual checks and provide real
  manual accessibility reviewer evidence.
- evidence paths:
  - `reports/overlay-acceptance-report.json`
  - `reports/overlay-visual-regression-report.json`
  - `docs/reviews/overlay-accessibility/reviewer.review.json`
  - `reports/overlay-manual-a11y-review-report.json`

### 8. 31. Финальный SearchLint 1.0 Release Gate - Security audit пройден

- gate type: `external_security_review_gate`
- command: `pnpm security:dast`
- required evidence: Passed deployed-target DAST, independent penetration-test
  report, remediation sign-off, and security/legal approval.
- next owner action: Run DAST against deployed production-equivalent targets,
  commission independent penetration testing, remediate findings, and approve
  the final gate.
- evidence paths:
  - `docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-security-audit-proiden.json`
  - `reports/security-privacy-acceptance-report.json`
  - `reports/dast-release-gate-report.json`
  - `reports/penetration-test-release-gate-report.json`

### 9. 31. Финальный SearchLint 1.0 Release Gate - Penetration test пройден

- gate type: `external_security_review_gate`
- command: `pnpm security:pentest`
- required evidence: Passed deployed-target DAST, independent penetration-test
  report, remediation sign-off, and security/legal approval.
- next owner action: Run DAST against deployed production-equivalent targets,
  commission independent penetration testing, remediate findings, and approve
  the final gate.
- evidence paths:
  - `docs/reviews/penetration-test/report-summary.json`
  - `reports/penetration-test-release-gate-report.json`

### 10. 31. Финальный SearchLint 1.0 Release Gate - Public website готов

- gate type: `deployed_public_website_gate`
- command: `pnpm website:acceptance`
- required evidence: Deployed website domain/CDN evidence, approved
  marketing/legal copy, live link validation, and screenshots if required.
- next owner action: Deploy the public website and capture sanitized deployed
  website acceptance evidence.
- evidence paths:
  - `docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-public-website-gotov.json`
  - `reports/public-website-onboarding-report.json`

## Final Release Gates

Run final RC, tag, and publication only after every prerequisite gate has
evidence.

Open gates: 3

### 1. 31. Финальный SearchLint 1.0 Release Gate - Release candidate прошёл полную матрицу

- gate type: `final_release_action_gate`
- command: `pnpm final-release:gate`
- required evidence: Passing full release-candidate matrix, signed tag,
  publication proof, and final release approval.
- next owner action: Run the final release gates only after all prerequisite
  gates pass.
- evidence paths:
  - `docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-release-candidate-proshel-polnuyu-matricu.json`
  - `reports/final-release-gate-report.json`
  - `docs/examples/final-release-gate-report.sample.json`

### 2. 31. Финальный SearchLint 1.0 Release Gate - Создан Git tag v1.0.0

- gate type: `final_release_action_gate`
- command: `pnpm final-release:gate`
- required evidence: Passing full release-candidate matrix, signed tag,
  publication proof, and final release approval.
- next owner action: Run the final release gates only after all prerequisite
  gates pass.
- evidence paths:
  - `docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-sozdan-git-tag-v1-0-0.json`
  - `reports/final-release-gate-report.json`
  - `docs/examples/final-release-gate-report.sample.json`

### 3. 31. Финальный SearchLint 1.0 Release Gate - Опубликован SearchLint 1.0

- gate type: `final_release_action_gate`
- command: `pnpm final-release:gate`
- required evidence: Passing full release-candidate matrix, signed tag,
  publication proof, and final release approval.
- next owner action: Run the final release gates only after all prerequisite
  gates pass.
- evidence paths:
  - `docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-opublikovan-searchlint-1-0.json`
  - `reports/final-release-gate-report.json`
  - `docs/examples/final-release-gate-report.sample.json`

## Non-Claims

- SearchLint 1.0 is not release-ready.
- This runbook does not publish npm packages or the VS Code extension.
- This runbook does not deploy the cloud platform or call live providers.
- This runbook does not replace legal, reviewer, security, or owner approval.
