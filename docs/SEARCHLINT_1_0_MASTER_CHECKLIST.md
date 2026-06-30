# SearchLint 1.0 Master Checklist

This checklist is the owner-provided master remaining-work map for SearchLint
1.0, captured as the repository-level checklist that must be updated after every
completed ExecPlan. It preserves the full checklist supplied by the owner and
uses checkboxes to show which items already have repository evidence.

Checked items reflect the current repository progress annotations. They do not
replace the final release gates in section 31 unless the corresponding final
gate is also checked.

After each ExecPlan, update this file to mark completed items, add evidence
links, and keep the critical path current.

Canonical source captured from the owner-provided SearchLint 1.0 master
remaining-work checklist and refreshed from the owner-provided checklist on
2026-06-23. Do not treat this file as a release approval document: the final
SearchLint 1.0 release is approved only when the section 31 release gates are
checked with evidence.

## 1. Управление проектом

- [x] Сделать первый нормальный baseline commit, если он ещё не сделан
- [x] Убедиться, что репозиторий больше не отображается полностью как untracked
- [x] Настроить protected branches
- [x] Настроить обязательные CI-проверки перед merge
- [x] Создать docs/PROJECT_PROGRESS.md
- [x] Обновлять прогресс после каждого ExecPlan
- [x] Зафиксировать критический путь до 1.0
- [x] Зафиксировать список оставшихся ExecPlan
- [ ] Провести юридическую проверку публичной и закрытой частей проекта
- [x] Подготовить фактическое разделение public repository и private cloud
      repository
- [x] Проверить, что закрытый cloud-код не попадёт в публичный репозиторий
- [x] Подготовить legal release-gate checklist
- [x] Подготовить public/private repository boundary plan

## 2. Независимая проверка blocker-правил

- [ ] Найти двух независимых reviewers
- [ ] Передать им review packet
- [ ] Проверить все 1960 benchmark cases
- [ ] Получить reviewer-1.review.json
- [ ] Получить reviewer-2.review.json
- [ ] Проверить полный coverage обоих review-файлов
- [ ] Проверить совпадение benchmarkVersion
- [ ] Разобрать disagreements
- [ ] Провести adjudication disputed cases
- [ ] Повторно запустить pnpm rule-qa:review
- [ ] Получить успешный OD-023 release gate
- [ ] Сохранить reviewer evidence и итоговый отчёт
- [ ] Обновить статус Rule QA на VERIFIED_COMPLETE

## 3. Core и все 120 правил

- [ ] Подтвердить release-quality всех 120 правил после reviewer gate
- [x] Проверить стабильность fingerprints между версиями
- [x] Проверить backward compatibility rule IDs
- [x] Добавить реальный regression corpus из настоящих сайтов
- [x] Проверить ложные срабатывания на реальных проектах
- [x] Проверить работу всех правил на больших сайтах
- [x] Проверить производительность rule engine
- [x] Проверить память и время выполнения
- [x] Добавить benchmark производительности
- [x] Зафиксировать правила изменения severity
- [x] Зафиксировать policy удаления и deprecation правил
- [x] Завершить custom rule execution policy
- [x] Реализовать безопасный sandbox для custom rules
- [x] Запретить custom rules доступ к произвольному workspace-коду
- [x] Добавить лимиты CPU, памяти и времени для custom rules
- [x] Добавить тесты безопасности custom rule sandbox

## 4. DSL и конфигурация

- [x] Финально проверить searchlint.seo v1
- [x] Завершить migration guide
- [x] Проверить searchlint migrate-config
- [x] Проверить atomic write
- [x] Проверить backup
- [x] Проверить Windows paths
- [x] Проверить POSIX paths
- [x] Проверить import cycles
- [x] Проверить большие конфигурации
- [x] Проверить сложное наследование policies
- [x] Проверить environment precedence
- [x] Зафиксировать config compatibility policy
- [x] Зафиксировать deprecation policy DSL
- [x] Добавить реальные примеры конфигураций
- [x] Добавить starter templates для разных типов сайтов

## 5. Next.js analyzer

- [x] Улучшить анализ dynamic metadata
- [x] Улучшить анализ generateMetadata
- [x] Поддержать metadata, приходящую из CMS/API
- [x] Улучшить анализ layout inheritance
- [x] Улучшить поддержку Pages Router `<Head>`
- [x] Полностью проверить redirects
- [x] Полностью проверить rewrites
- [x] Проверить runtime-generated Open Graph images
- [x] Проверить runtime-generated Twitter images
- [x] Проверить dynamic routes
- [x] Проверить catch-all routes
- [x] Проверить optional catch-all routes
- [x] Проверить route groups
- [x] Проверить parallel routes
- [x] Проверить intercepting routes
- [x] Проверить middleware
- [x] Проверить streaming metadata
- [x] Расширить compatibility matrix
- [x] Добавить полные source-analyzer fixtures
- [x] Проверить source mapping на реальных проектах

## 6. Badge и Overlay

- [x] Провести полный visual regression audit
- [ ] Провести ручной accessibility audit
- [x] Утвердить WCAG acceptance criteria
- [ ] Проверить screen readers
- [x] Проверить keyboard-only navigation
- [x] Проверить high contrast mode
- [x] Проверить zoom 200-400%
- [x] Проверить reduced motion
- [x] Проверить RTL layout
- [x] Проверить длинные diagnostics
- [x] Проверить тысячи diagnostics
- [x] Проверить мобильные viewport
- [x] Проверить разные позиции badge
- [x] Проверить конфликт со стилями реальных сайтов
- [x] Проверить Shadow DOM isolation
- [x] Проверить cleanup observers/listeners
- [x] Проверить многократный Fast Refresh
- [x] Проверить client navigation
- [x] Проверить ошибку самого SearchLint runtime
- [x] Добавить понятное fallback-состояние overlay
- [x] Зафиксировать финальный UX overlay

## 7. VS Code и LSP

- [x] Завершить LSP transport release acceptance
- [x] Проверить diagnostics
- [x] Проверить formatting
- [x] Проверить hover
- [x] Проверить completion
- [x] Проверить go to definition
- [x] Проверить references
- [x] Проверить rename
- [x] Проверить code actions
- [x] Проверить multi-file invalidation
- [x] Проверить stale diagnostic cleanup
- [x] Проверить большие workspaces
- [x] Собрать production VSIX
- [x] Установить VSIX в чистую VS Code среду
- [x] Пройти VS Code Extension Host E2E
- [x] Добавить extension icon
- [x] Добавить Marketplace README
- [x] Добавить screenshots
- [x] Добавить changelog
- [x] Добавить privacy/telemetry statement
- [ ] Настроить publisher account
- [x] Подготовить Marketplace metadata
- [ ] Подписать и опубликовать extension
- [x] Проверить обновление extension между версиями

## 8. npm-пакеты

- [x] Определить публичные версии пакетов
- [ ] Заменить `0.0.0`/beta versions на final release versions
- [x] Убрать `private: true` у публичных npm-пакетов
- [x] Оставить `private: true` у cloud-пакетов
- [x] Добавить license
- [x] Добавить repository
- [x] Добавить homepage
- [x] Добавить bugs
- [x] Добавить keywords
- [x] Добавить engines
- [x] Добавить files
- [x] Проверить exports
- [x] Проверить type declarations
- [x] Проверить peer dependencies
- [x] Проверить package dependency graph
- [x] Проверить tree-shaking
- [x] Добавить npm provenance metadata
- [x] Настроить npm provenance в hosted release workflow
- [x] Настроить trusted publishing repository-side workflow readiness
- [x] Настроить release workflow
- [x] Добавить npm dry-run
- [x] Протестировать установку из npm-like registry
- [x] Подготовить prerelease 1.0.0-beta
- [ ] Опубликовать beta packages
- [x] Проверить чистую установку опубликованных packages
- [ ] Подготовить финальную публикацию 1.0.0

## 9. CLI и локальный продукт

- [x] Провести локальный CLI acceptance
- [x] Проверить команды в чистом проекте через pnpm tarball install
- [x] Проверить exit codes
- [x] Проверить Windows
- [x] Проверить macOS
- [x] Проверить Linux
- [x] Проверить npm
- [x] Проверить pnpm
- [x] Проверить Yarn
- [x] Проверить CI environments
- [x] Добавить shell completion
- [x] Добавить понятные ошибки конфигурации
- [x] Добавить searchlint doctor
- [x] Добавить version diagnostics
- [x] Проверить interrupted crawl recovery
- [x] Проверить baseline migration
- [x] Проверить SARIF output
- [x] Проверить JUnit output
- [x] Проверить HTML output
- [x] Завершить CLI documentation для текущего локального acceptance scope

## 10. Crawler

- [x] Провести нагрузочное тестирование
- [x] Проверить 10 000 URL локально
- [ ] Проверить 100 000 URL в cloud
- [x] Проверить resumable crawl
- [x] Проверить robots-aware crawling
- [x] Проверить crawl-delay policy
- [x] Проверить redirect loops
- [x] Проверить infinite URL spaces
- [x] Проверить query parameter explosion
- [x] Проверить canonical normalization
- [x] Проверить rate limiting
- [x] Проверить retry policy
- [x] Проверить timeout policy
- [x] Проверить cancellation
- [x] Проверить duplicate content handling
- [x] Проверить authenticated crawl
- [x] Проверить cookie/session handling
- [x] Проверить crawl artifacts
- [x] Проверить SSRF protection
- [x] Проверить private network protection
- [x] Проверить malicious HTML
- [x] Проверить large responses
- [x] Проверить memory limits
- [x] Проверить worker concurrency
- [x] Проверить crawl cost controls

## 11. PostgreSQL и хранение данных

- [ ] Развернуть настоящий PostgreSQL/RDS
- [x] Выполнить database migrations
- [x] Проверить schema
- [x] Проверить connection pooling
- [x] Проверить transactions
- [x] Проверить tenant isolation
- [x] Проверить RBAC на уровне данных
- [x] Проверить indexes
- [x] Проверить retention
- [x] Проверить deletion
- [x] Проверить backup
- [x] Проверить restore
- [x] Проверить point-in-time recovery
- [x] Провести нагрузочное тестирование БД
- [x] Проверить миграции между версиями
- [x] Добавить database monitoring
- [x] Добавить slow-query monitoring
- [x] Зафиксировать RPO/RTO

## 12. S3/Object Storage

- [ ] Развернуть реальное object storage
- [x] Проверить загрузку snapshots
- [x] Проверить загрузку crawl artifacts
- [x] Проверить encryption
- [x] Проверить signed URLs
- [x] Проверить lifecycle policies
- [x] Проверить retention
- [x] Проверить deletion
- [x] Проверить tenant isolation
- [x] Проверить tenant-scoped object key contract
- [x] Проверить большие artifacts
- [x] Проверить multipart upload
- [x] Проверить restore
- [x] Проверить access logs
- [x] Проверить access-log bucket configuration

## 13. Backend API

- [ ] Развернуть production API
- [x] Проверить API Gateway static contract
- [x] Проверить ECS/container runtime static contract
- [x] Проверить PostgreSQL integration
- [x] Проверить authentication middleware
- [x] Проверить authorization middleware
- [x] Проверить tenant identity checks locally
- [x] Проверить request validation
- [x] Проверить rate limiting
- [x] Проверить idempotency
- [x] Проверить pagination
- [x] Проверить cancellation/timeout path locally
- [x] Проверить error responses
- [x] Проверить audit logs locally
- [x] Проверить API versioning
- [x] Зафиксировать public API compatibility policy
- [x] Добавить OpenAPI specification
- [x] Добавить API integration tests
- [x] Провести load testing locally through deterministic API request-mix
      benchmark
- [x] Провести security testing locally through deterministic API security
      verifier

## 14. Queues и Workers

- [x] Развернуть SQS static provisioning contract
- [x] Развернуть DLQ static provisioning contract
- [x] Развернуть worker containers static deployment contract
- [x] Проверить enqueue/dequeue locally through deterministic SQS consumer tests
- [x] Проверить retries locally through delete-on-success/retry-on-failure tests
- [x] Проверить backoff
- [x] Проверить dead-letter handling static contract
- [x] Проверить idempotency through FIFO deduplication contract
- [x] Проверить job cancellation
- [x] Проверить worker lifecycle shutdown locally
- [x] Проверить job timeout/visibility-timeout static contract
- [x] Проверить concurrency
- [x] Проверить autoscaling static contract
- [x] Проверить crawl workers local/static contract
- [x] Проверить cleanup workers local/static contract
- [x] Проверить external observation workers local/static contract
- [x] Проверить scheduler static EventBridge contract
- [x] Проверить job history
- [x] Проверить failure recovery locally through retry/delete and cleanup
      rollback evidence
- [x] Добавить worker metrics
- [x] Добавить worker alerts

## 15. Authentication и RBAC

- [x] Развернуть Cognito/OIDC static provisioning contract
- [x] Проверить регистрацию static Hosted UI/PKCE contract
- [x] Проверить вход static Hosted UI/session contract
- [x] Проверить выход static Hosted UI/session clearing contract
- [x] Проверить refresh tokens static grant/session contract
- [x] Проверить password reset static verified-email recovery contract
- [x] Проверить email verification static verified-email contract
- [x] Проверить MFA static software-token contract
- [x] Проверить session expiry static dashboard/Cognito contract
- [x] Проверить OAuth callbacks static Cognito/provider contract
- [x] Реализовать organizations API foundation
- [x] Реализовать projects API foundation
- [x] Реализовать environments API foundation
- [x] Реализовать roles
- [x] Реализовать permissions
- [x] Проверить RBAC matrix locally
- [x] Проверить tenant isolation locally
- [x] Проверить invite flow static invitation contract
- [x] Проверить member removal locally
- [x] Проверить ownership transfer locally
- [x] Добавить audit log foundation

## 16. OAuth vault

- [x] Развернуть KMS static provisioning contract
- [x] Развернуть Secrets Manager static provisioning contract
- [x] Проверить запись OAuth tokens locally through SecretVault
- [x] Проверить чтение OAuth tokens locally through Secrets Manager vault
- [x] Проверить encryption/decryption static KMS/IAM contract
- [x] Проверить token refresh locally
- [x] Проверить token rotation locally
- [x] Проверить token revocation locally
- [x] Проверить tenant isolation locally
- [x] Проверить audit logs locally
- [x] Проверить deletion locally through vault delete contract
- [x] Проверить recovery static Secrets Manager recovery-window contract
- [x] Запретить вывод secrets в logs through sanitized evidence checks
- [ ] Провести external security review vault

## 17. Dashboard

- [x] Подготовить static production dashboard deployment readiness contract
- [x] Подготовить static production API connection readiness contract
- [x] Подготовить static dashboard auth connection readiness contract
- [x] Реализовать hosted/local onboarding view
- [x] Реализовать hosted/local organization switcher
- [x] Реализовать hosted/local project management
- [x] Реализовать hosted/local site management view
- [x] Реализовать hosted/local environment management view
- [x] Реализовать hosted/local issues dashboard
- [x] Реализовать hosted/local page diagnostics
- [x] Реализовать hosted/local evidence view
- [x] Реализовать hosted/local crawl history
- [x] Реализовать hosted/local crawl scheduling
- [x] Реализовать hosted/local deployment history
- [x] Реализовать hosted/local Google/Yandex settings
- [x] Реализовать hosted/local integration status
- [x] Реализовать hosted/local reports UI
- [x] Реализовать hosted/local team/RBAC management UI
- [x] Реализовать hosted/local team/RBAC read UI
- [x] Реализовать hosted/local billing/usage summary UI
- [x] Реализовать hosted/local usage/limits UI
- [x] Реализовать hosted/local notifications UI
- [x] Реализовать hosted/local loading states
- [x] Реализовать hosted/local empty states
- [x] Реализовать hosted/local error states
- [x] Провести hosted/local accessibility acceptance
- [x] Провести hosted/local visual baseline
- [x] Провести hosted/local Chromium browser compatibility smoke
- [x] Подготовить production E2E deployed URL acceptance harness

## 18. Google Search Console

- [x] Подготовить static Google OAuth app configuration readiness
- [x] Подготовить Google consent verification readiness packet
- [x] Подготовить static Search Console site connection readiness contract
- [x] Получать Search Analytics deterministically through provider adapter
- [x] Получать clicks deterministically from Search Analytics payload
- [x] Получать impressions deterministically from Search Analytics payload
- [x] Получать CTR deterministically from Search Analytics payload
- [x] Получать average position deterministically from Search Analytics payload
- [x] Получать sitemap status deterministically through provider adapter
- [x] Получать URL Inspection deterministically through provider adapter
- [x] Получать last crawl deterministically from URL Inspection payload
- [x] Получать Google canonical deterministically from URL Inspection payload
- [x] Получать user canonical deterministically from URL Inspection payload
- [x] Получать rich result observations deterministically from URL Inspection
      payload
- [x] Проверить quotas deterministically from provider headers
- [x] Проверить retry/backoff deterministically through static Google provider
      policy
- [x] Проверить freshness deterministically
- [x] Проверить stale states deterministically through static Google freshness
      policy
- [x] Проверить token refresh/vault collection boundary locally
- [ ] Провести live acceptance на реальном сайте
- [x] Добавить hosted/local Google integration dashboard rendering

## 19. PageSpeed и CrUX

- [x] Подключить PageSpeed Insights deterministically through provider adapter
- [x] Подключить CrUX deterministically through provider adapter
- [x] Получать LCP deterministically from PageSpeed/CrUX payloads
- [x] Получать INP deterministically from PageSpeed/CrUX payloads
- [x] Получать CLS deterministically from PageSpeed/CrUX payloads
- [x] Различать lab и field data deterministically
- [x] Различать page и origin data deterministically
- [x] Показывать отсутствие данных deterministically through CrUX missing-data
      state
- [x] Проверить API quotas deterministically from provider headers
- [x] Проверить freshness deterministically
- [x] Добавить историю показателей deterministically through metric events
- [x] Добавить hosted/local dashboard performance observation rendering
- [ ] Провести live acceptance

## 20. Яндекс.Вебмастер

- [x] Подготовить static Yandex OAuth app configuration readiness
- [x] Подготовить static Yandex Webmaster site connection readiness
- [x] Получать indexing state deterministically from Webmaster URL-status
      payload
- [x] Получать searchable status deterministically from Webmaster URL-status
      payload
- [x] Получать exclusion reasons deterministically from Webmaster URL-status
      payload
- [x] Получать last crawl deterministically from Webmaster URL-status payload
- [x] Получать HTTP status deterministically from Webmaster URL-status payload
- [x] Получать sitemap status deterministically through provider adapter
- [x] Получать important URLs deterministically from Webmaster URL-status
      payload
- [x] Получать diagnostics deterministically from Webmaster URL-status payload
- [x] Проверить quotas deterministically from provider headers
- [x] Проверить freshness deterministically
- [x] Проверить token refresh/vault collection boundary locally
- [ ] Провести live acceptance
- [x] Добавить hosted/local Webmaster dashboard rendering

## 21. Яндекс.Метрика

- [x] Подготовить static Yandex Metrica counter connection readiness
- [x] Получать organic traffic deterministically from Metrica payload
- [x] Получать landing pages deterministically from Metrica payload
- [x] Получать sources deterministically from Metrica payload
- [x] Получать visits deterministically from Metrica payload
- [x] Получать bounce rate deterministically from Metrica payload
- [x] Получать conversions deterministically from Metrica payload
- [x] Получать goal data deterministically from Metrica payload
- [x] Показывать sampling deterministically
- [x] Проверить quotas deterministically from provider headers
- [x] Проверить freshness deterministically
- [ ] Провести live acceptance
- [x] Добавить hosted/local Metrica dashboard rendering

## 22. История и корреляция

- [x] Моделировать deployment history deterministically
- [x] Моделировать commit references deterministically
- [x] Моделировать page snapshots deterministically
- [x] Моделировать diagnostics history deterministically
- [x] Моделировать Google/Yandex observations history deterministically
- [x] Реализовать before/after comparisons deterministically
- [x] Реализовать deployment correlation deterministically
- [x] Реализовать trend analysis deterministically
- [x] Реализовать anomaly detection deterministically
- [x] Различать correlation и causation in model/report wording
- [x] Добавить deterministic timeline model
- [x] Добавить deployment annotations to timeline/correlation model
- [x] Добавить historical reports through existing HTML report sections
- [x] Хранить deployment history in production persistence
- [x] Хранить page snapshots in production persistence
- [x] Хранить diagnostics/external-observation rollups in production persistence
- [ ] Провести deployed dashboard timeline acceptance

## 23. Reports

- [x] Завершить HTML reports
- [x] Реализовать настоящий PDF export deterministically through binary PDF
      writer
- [x] Проверить PDF rendering deterministically through static PDF parser
- [x] Реализовать technical report
- [x] Реализовать client report
- [x] Реализовать executive report
- [x] Реализовать before/after report
- [x] Реализовать deployment report
- [x] Реализовать Google report
- [x] Реализовать Yandex report
- [x] Реализовать white-label report
- [x] Реализовать hosted report links static contract
- [x] Реализовать expiration static contract
- [x] Реализовать access controls static contract
- [x] Реализовать report history static contract

## 24. Notifications

- [x] Определить notification model deterministically
- [x] Моделировать email notifications deterministically
- [x] Моделировать Slack notifications deterministically
- [x] Моделировать webhook notifications deterministically
- [x] Моделировать Telegram notifications deterministically
- [x] Настроить notification rules deterministically
- [x] Настроить severity thresholds deterministically
- [x] Настроить digests deterministically
- [x] Добавить mute/snooze deterministically
- [x] Добавить delivery history deterministically
- [x] Добавить retry planning deterministically
- [x] Добавить failure handling evidence deterministically
- [x] Добавить notification settings UI rendering
- [ ] Провести live email delivery acceptance
- [ ] Провести live Slack delivery acceptance
- [ ] Провести live webhook delivery acceptance
- [ ] Провести live Telegram delivery acceptance, если нужен
- [x] Развернуть notification workers/scheduler static contract
- [x] Добавить production notification settings persistence static contract
- [x] Провести deployed log/telemetry redaction review static packet

## 25. Billing

- [x] Подготовить финальные публичные тарифы release-candidate static packet
- [x] Утвердить deterministic plan limits in ADR-0021 contract
- [x] Моделировать Stripe checkout request shape deterministically
- [x] Моделировать customer portal request shape deterministically
- [x] Моделировать subscriptions deterministically
- [x] Моделировать trials deterministically
- [x] Моделировать upgrades/downgrades deterministically
- [x] Моделировать cancellations deterministically
- [x] Моделировать invoices deterministically
- [x] Реализовать webhook processing boundary
- [x] Реализовать entitlement checks
- [x] Реализовать usage limits
- [x] Реализовать overage policy deterministically
- [x] Реализовать hosted/local billing UI rendering
- [x] Подготовить real Stripe products/prices live setup packet
- [x] Подготовить live checkout payment acceptance owner-evidence packet
- [x] Подготовить live customer portal acceptance owner-evidence packet
- [ ] Провести live customer portal acceptance
- [x] Подготовить live subscription lifecycle acceptance owner-evidence packet
- [ ] Провести live subscription/trial/upgrade/downgrade/cancellation acceptance
- [x] Подготовить deployed Stripe webhook RDS persistence owner-evidence packet
- [ ] Проверить deployed Stripe webhook persistence on RDS
- [x] Подготовить final live Stripe acceptance owner-evidence packet
- [ ] Провести live Stripe acceptance

## 26. Agency mode

- [x] Моделировать client workspaces deterministically
- [x] Моделировать multiple clients deterministically
- [x] Реализовать hosted/local portfolio dashboard rendering
- [x] Зафиксировать agency/client roles через existing RBAC
- [x] Моделировать client read-only access deterministically
- [x] Моделировать white-label branding deterministically
- [x] Реализовать local white-label report templates
- [x] Моделировать shared rule policies deterministically
- [x] Моделировать bulk monitoring deterministically
- [x] Моделировать SLA tracking deterministically
- [x] Моделировать assignees deterministically
- [x] Моделировать agency onboarding deterministically
- [x] Моделировать agency billing summary deterministically
- [x] Подготовить production client workspace persistence owner-evidence packet
- [x] Реализовать production client workspace persistence
- [ ] Развернуть client portal
- [x] Провести client-access browser E2E
- [ ] Реализовать live agency billing
- [x] Реализовать hosted white-label report links
- [x] Реализовать brand asset upload/custom domains, если требуется
- [ ] Проверить client invite email delivery

## 27. Observability

- [ ] Развернуть logging
- [ ] Развернуть metrics
- [ ] Развернуть tracing
- [ ] Подключить CloudWatch/OTLP
- [x] Добавить API metrics
- [x] Добавить worker metrics
- [x] Добавить crawler metrics
- [x] Добавить DB metrics
- [x] Добавить integration metrics
- [x] Добавить quota metrics
- [x] Добавить business metrics
- [x] Создать dashboards
- [x] Создать alerts
- [x] Настроить error tracking
- [x] Настроить incident notifications
- [x] Проверить log redaction
- [x] Проверить отсутствие secrets в telemetry

## 28. Security и Privacy

- [x] Провести threat-model review
- [x] Провести dependency audit
- [x] Провести SAST
- [ ] Провести DAST
- [ ] Провести penetration test
- [x] Проверить SSRF
- [x] Проверить XSS
- [x] Проверить CSRF
- [x] Проверить injection attacks
- [x] Проверить OAuth attacks
- [x] Проверить tenant isolation
- [x] Проверить secrets handling
- [x] Проверить encryption at rest
- [x] Проверить encryption in transit
- [x] Проверить backup security
- [x] Проверить restore process
- [x] Реализовать user data export
- [x] Реализовать account deletion
- [x] Реализовать organization deletion
- [x] Реализовать retention policies
- [x] Подготовить privacy policy
- [x] Подготовить terms of service
- [x] Подготовить DPA при необходимости
- [x] Настроить vulnerability disclosure
- [ ] Завершить security release gate

## 29. Public website и onboarding

- [x] Создать публичный сайт SearchLint
- [x] Описать продукт
- [x] Описать local tools
- [x] Описать cloud platform
- [x] Описать тарифы
- [x] Добавить installation guide
- [x] Добавить quick start
- [x] Добавить Next.js guide
- [x] Добавить CLI guide
- [x] Добавить VS Code guide
- [x] Добавить Google/Yandex guide
- [x] Добавить rule catalog
- [x] Добавить DSL documentation
- [x] Добавить API documentation
- [x] Добавить examples
- [x] Добавить FAQ
- [x] Добавить troubleshooting
- [x] Добавить onboarding wizard
- [x] Добавить demo project
- [x] Добавить contact/support flow

## 30. Release documentation

- [x] Завершить README
- [x] Завершить installation docs
- [x] Завершить migration guide
- [x] Завершить compatibility matrix
- [x] Завершить security docs
- [x] Завершить contribution guide
- [x] Завершить package docs
- [x] Завершить changelog
- [x] Завершить release notes
- [x] Добавить support policy
- [x] Добавить deprecation policy
- [x] Добавить versioning policy
- [x] Добавить upgrade guide
- [x] Добавить incident/support process

## 31. Финальный SearchLint 1.0 Release Gate

- [ ] Все два reviewer sign-off получены
- [ ] Rule QA gate прошёл
- [ ] Все 120 правил verified
- [ ] npm-пакеты опубликованы
- [ ] VS Code extension опубликован
- [ ] Overlay release acceptance пройден
- [x] Zero production impact подтверждён
- [ ] PostgreSQL/RDS proof пройден
- [ ] API deployment proof пройден
- [ ] Workers/SQS proof пройден
- [ ] S3 proof пройден
- [ ] Cognito/RBAC proof пройден
- [ ] OAuth vault proof пройден
- [ ] Dashboard production E2E пройден
- [ ] Google live acceptance пройден
- [ ] Yandex live acceptance пройден
- [ ] Billing live acceptance пройден
- [x] Reports готовы
- [ ] Notifications готовы
- [ ] Agency mode готов
- [ ] Observability готова
- [ ] Security audit пройден
- [ ] Penetration test пройден
- [ ] Backup/restore проверены
- [x] Documentation завершена
- [ ] Public website готов
- [x] Onboarding готов
- [ ] Legal review завершён
- [x] Release candidate matrix создана
- [x] Final release gate verifier создан
- [ ] Release candidate прошёл полную матрицу
- [ ] Создан Git tag v1.0.0
- [ ] Опубликован SearchLint 1.0

## Критический путь

```text
Reviewer approvals
→ Local release readiness
→ PostgreSQL/RDS
→ API
→ Workers/Auth/Storage
→ Dashboard
→ Google/Yandex
→ Billing/Reports/Agency
→ Security/Observability
→ Documentation/Onboarding
→ SearchLint 1.0 RC
→ Release
```
