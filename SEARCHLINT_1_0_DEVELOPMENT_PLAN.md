# План разработки SearchLint 1.0

Чтобы план был точным, а не астрологией в Jira, фиксируем базу:

- **Срок:** 48 недель.
- **Команда:** 9-10 специалистов.
- **Ритм:** двухнедельные спринты.
- **Результат:** полноценный SearchLint 1.0.
- **Глубокая интеграция:** Next.js.
- **Общий режим:** проверка любого сайта через crawler.
- **Production-вес:** 0 KB, 0 запросов, 0 фоновых процессов.
- **ИИ:** не используется. Все проверки работают на правилах и алгоритмах.

## Команда

| Роль                           | Количество |
| ------------------------------ | ---------: |
| Product/Technical Lead         |          1 |
| Разработчики ядра, DSL и AST   |          2 |
| Next.js и Overlay-разработчики |          2 |
| Backend/Data-разработчики      |          2 |
| QA Automation                  |          1 |
| DevOps/Security                |          1 |
| UX/UI-дизайнер                 |        0,5 |
| Technical SEO-эксперт          |        0,5 |

## Архитектура продукта

```text
SearchLint Language
        ↓
Parser → AST → Validator → Intermediate Rules
        ↓
SearchLint Core
        ↓
Collectors
├── Source Code
├── Raw HTML
├── Rendered DOM
├── HTTP Headers
├── robots.txt
├── sitemap.xml
├── Crawler
├── Google
└── Yandex
        ↓
Diagnostics Engine
        ↓
├── Dev Badge
├── Error Overlay
├── CLI
├── CI/CD
├── VS Code / LSP
└── Cloud Dashboard
```

Все части используют **одно ядро правил**. Нельзя допустить, чтобы VS Code
говорил одно, бейджик другое, а dashboard третье. Люди и без нашей помощи
прекрасно умеют создавать противоречивые системы.

---

# Этап 1. Спецификация продукта

## Недели 1-4

### Разрабатываем

- полный PRD продукта;
- карту пользовательских сценариев;
- классификацию SEO-проблем;
- уровни критичности;
- структуру диагностического сообщения;
- архитектуру DSL;
- модель данных;
- прототип бейджика и overlay;
- прототип dashboard;
- threat model;
- стратегию нулевого production-веса.

### Уровни ошибок

```text
BLOCKER
Страница не может или не должна публиковаться.

ERROR
Серьёзная техническая проблема.

WARNING
Вероятная проблема, требующая проверки.

INFO
Рекомендация без блокировки.
```

### Стандарт каждой диагностики

```ts
type Diagnostic = {
  id: string;
  severity: "blocker" | "error" | "warning" | "info";
  confidence: "certain" | "likely" | "heuristic";

  pageUrl: string;
  route?: string;

  source:
    | "source-code"
    | "raw-html"
    | "rendered-dom"
    | "http-header"
    | "crawler"
    | "google"
    | "yandex";

  title: string;
  evidence: string;
  expected?: string;
  actual?: string;

  file?: string;
  line?: number;
  selector?: string;

  observedAt: string;
  fingerprint: string;
};
```

### Результат этапа

Утверждены:

- 120 правил версии 1.0;
- синтаксис языка;
- пользовательские интерфейсы;
- техническая архитектура;
- критерии готовности продукта;
- ограничения и допустимые ложные срабатывания.

---

# Этап 2. Собственный язык SearchLint

## Недели 5-8

Создаём полноценный DSL, например:

```text
searchlint.seo
```

Пример:

```text
language 1

site "https://example.com"

route "/products/**" {
  type Product
  indexable true
  canonical self

  title {
    required true
  }

  description {
    required true
  }

  schema Product
}

route "/admin/**" {
  indexable false
}
```

### Разрабатываем

- формальную грамматику;
- lexer;
- parser;
- AST;
- type checker;
- semantic validator;
- formatter;
- конфигурационные импорты;
- переменные и reusable policies;
- версионирование языка;
- миграции между версиями;
- понятные ошибки синтаксиса;
- промежуточное представление правил, которое использует ядро.

### Обязательные возможности языка

```text
site
environment
route
route group
page type
indexability
metadata requirements
canonical policy
hreflang policy
schema requirements
severity override
ignore/suppress
custom rules
provider-specific rules
```

### Критерий готовности

Один файл `.seo` одинаково интерпретируется:

- overlay;
- CLI;
- crawler;
- VS Code;
- CI;
- cloud-сервисом.

---

# Этап 3. Ядро анализа

## Недели 9-12

Разрабатываем пакет:

```text
@searchlint/core
```

### Основные модули

```text
Rule Engine
Diagnostic Engine
Severity Resolver
Route Contract Resolver
Evidence Collector
Fingerprint Generator
Suppression Engine
Baseline Comparator
Rule Version Manager
```

### Что должно поддерживать ядро

- синхронные и асинхронные правила;
- правила страницы и всего сайта;
- зависимости между правилами;
- приоритеты;
- разные требования для маршрутов;
- правила для Google и Яндекса;
- пользовательские правила;
- suppressions с обязательной причиной;
- baseline известных проблем;
- сравнение двух проверок;
- стабильные идентификаторы ошибок.

### Критерий готовности

Одинаковый вход всегда создаёт одинаковые diagnostics. Никаких вероятностных
решений и модельных «мне показалось».

---

# Этап 4. Сборщики данных страницы

## Недели 9-14, параллельно с ядром

Создаём collectors:

```text
@searchlint/browser
@searchlint/http
@searchlint/html
```

### Browser Collector

Собирает:

- итоговый DOM;
- содержимое `<head>`;
- title и metadata;
- заголовки;
- изображения;
- ссылки;
- JSON-LD;
- Open Graph;
- Twitter Cards;
- DOM-элементы и селекторы;
- изменения после навигации;
- изменения после Fast Refresh.

### HTTP Collector

Собирает:

- HTTP-код;
- redirect chain;
- `X-Robots-Tag`;
- content type;
- canonical headers;
- cache headers;
- response timing.

### Raw HTML Collector

Сравнивает:

```text
первоначальный HTML
против
DOM после выполнения JavaScript
```

Это обязательно, потому что Next.js поддерживает статическую и динамическую
metadata, а также streaming metadata. Значит, SearchLint должен понимать, когда
данные присутствуют сразу, а когда появляются после рендера. ([Next.js][1])

### Критерий готовности

Для любой открытой страницы система создаёт единый `PageSnapshot`, содержащий
код, HTTP, raw HTML и rendered DOM.

---

# Этап 5. Dev Badge и SEO Error Overlay

## Недели 13-18

Разрабатываем:

```text
@searchlint/overlay
```

### Бейджик

```text
SEO ✓
SEO 3
SEO BLOCKED
SEO CHECKING
```

### Панель

Разделы:

```text
Current Page
Source
Rendering
Indexability
Metadata
Structured Data
Links
Performance
Google
Yandex
History
```

### Возможности

- вывод ошибок в реальном времени;
- фильтрация по критичности;
- подсветка проблемного элемента;
- доказательство ошибки;
- ожидаемое и фактическое значение;
- указание источника;
- переход к файлу;
- копирование diagnostics;
- suppression с причиной;
- повторная проверка;
- сравнение raw HTML и DOM;
- отображение свежести внешних данных.

### Технические требования

- интерфейс изолируется через Shadow DOM;
- стили сайта не влияют на overlay;
- overlay автоматически обновляется после Fast Refresh;
- blocker может показывать полноэкранную ошибку;
- warning страницу не перекрывает;
- UI доступен с клавиатуры;
- overlay не попадает в production.

Next.js публично позволяет настраивать положение собственного dev indicator, но
не предоставляет стабильный публичный API для добавления в него произвольных
диагностик. Поэтому SearchLint создаёт отдельный overlay, не зависящий от
внутренних компонентов Next.js. ([Next.js][2])

---

# Этап 6. Next.js-анализатор и поиск файла

## Недели 15-22

Создаём:

```text
@searchlint/next
@searchlint/source
```

### Анализируем

- App Router;
- Pages Router;
- `metadata`;
- `generateMetadata`;
- metadata из layout;
- наследование metadata;
- streaming metadata;
- `robots.ts`;
- `sitemap.ts`;
- `generateSitemaps`;
- `generateStaticParams`;
- `opengraph-image`;
- `twitter-image`;
- redirect и rewrite;
- route handlers;
- HTTP headers;
- JSX/TSX;
- JSON-LD;
- динамические маршруты.

Next.js разрешает задавать metadata через статический объект и
`generateMetadata`; эти механизмы работают в серверных компонентах и могут
зависеть от динамических данных. Поэтому анализатор должен различать точную
статическую локализацию и приблизительную динамическую. ([Next.js][1])

### Результат диагностики

```text
Missing meta description

Route:
  /products/[slug]

Source:
  app/products/[slug]/page.tsx

Location:
  generateMetadata():34

Confidence:
  likely
```

### Уровни локализации

```text
EXACT
Известен файл и строка.

RELATED
Известен файл или функция, но значение приходит из CMS/API.

RUNTIME
Проблема найдена только в итоговой странице.

EXTERNAL
Проблема получена от Google или Яндекса.
```

### Критерий готовности

Для статически определяемых ошибок файл и строка находятся минимум в 90%
тестовых сценариев.

---

# Этап 7. Полный каталог SEO-правил

## Недели 17-24

Цель версии 1.0: **120 правил**.

| Категория                         | Количество |
| --------------------------------- | ---------: |
| HTTP и rendering                  |         12 |
| Indexability                      |         14 |
| Title и metadata                  |         18 |
| Canonical и hreflang              |         16 |
| Заголовки и структура             |          8 |
| Изображения и social preview      |         12 |
| Schema.org                        |         10 |
| Ссылки и site graph               |         14 |
| robots.txt и sitemap              |         10 |
| Performance и технические сигналы |          6 |

### Каждое правило получает

- постоянный ID;
- описание;
- severity;
- confidence;
- список источников;
- алгоритм проверки;
- доказательство;
- исправление;
- тестовые примеры;
- документацию;
- версию;
- provider scope.

### Контроль качества

- blocker не может основываться на субъективной эвристике;
- длина title не считается жёсткой ошибкой;
- `meta keywords` не проверяется;
- `noindex` оценивается с учётом назначения маршрута;
- правила Google и Яндекса не смешиваются;
- пользователь может изменить severity через DSL.

---

# Этап 8. Crawler всего сайта

## Недели 21-30

Создаём:

```text
@searchlint/crawler
```

### Режимы

```text
HTML crawl
Rendered crawl
Authenticated crawl
Sitemap crawl
Incremental crawl
Changed-routes crawl
Cloud distributed crawl
```

### Проверки

- все внутренние URL;
- страницы-сироты;
- битые ссылки;
- redirect chains;
- redirect loops;
- дубли title;
- дубли description;
- canonical graph;
- hreflang graph;
- sitemap coverage;
- robots conflicts;
- `404`, `410`, `500`;
- soft 404;
- страницы без входящих ссылок;
- индексируемые URL с параметрами;
- несогласованность HTTP и DOM;
- одинаковый контент на разных URL;
- страницы sitemap с `noindex`.

### Масштаб версии 1.0

```text
Локальный режим: до 10 000 URL
Cloud-режим: до 100 000 URL на проект
```

### Обязательные ограничения

- rate limiting;
- robots-aware crawling;
- настраиваемая concurrency;
- retry;
- timeout;
- canonical URL normalization;
- сохранение crawl snapshots;
- возобновление прерванного обхода.

---

# Этап 9. CLI, CI/CD и отчётные форматы

## Недели 25-32

Создаём:

```text
@searchlint/cli
@searchlint/reporter-sarif
@searchlint/reporter-junit
```

### Команды

```bash
searchlint init
searchlint dev
searchlint check
searchlint crawl
searchlint diff
searchlint baseline
searchlint report
searchlint doctor
```

### CI/CD

Поддержка:

- GitHub Actions;
- GitLab CI;
- Bitbucket;
- Jenkins;
- Vercel;
- универсального Docker image.

### Политики блокировки

```text
fail-on blocker
fail-on new-error
fail-on regression
fail-on rule-id
never fail on warning
```

### Форматы

```text
Terminal
JSON
SARIF
JUnit XML
HTML
PDF
```

### Критерий готовности

Новый blocker останавливает deployment, известные старые warnings не мешают
сборке.

---

# Этап 10. LSP и VS Code

## Недели 27-34

Создаём:

```text
searchlint-language-server
searchlint-vscode
```

Language Server Protocol позволяет переиспользовать один сервер диагностики в
разных редакторах, а не писать отдельный анализатор для каждого IDE. ([Visual
Studio Code][3])

### Для файлов `.seo`

- подсветка синтаксиса;
- autocomplete;
- форматирование;
- диагностика;
- hover-документация;
- go to definition;
- поиск references;
- rename;
- quick fixes;
- миграция версии языка.

### Для TSX/JSX

- SEO-ошибки в Problems;
- подчёркивание проблемной строки;
- CodeLens;
- переход к маршруту;
- открытие overlay;
- suppression;
- автоматическое добавление допустимого metadata-шаблона.

---

# Этап 11. Cloud Backend и Dashboard

## Недели 25-36

### Backend

Разрабатываем:

```text
API Gateway
Authentication
Organizations
Projects
Environments
RBAC
OAuth Vault
Job Queue
Crawler Workers
Diagnostics Storage
Metrics Storage
Notifications
Audit Log
```

### Основные сущности

```text
Organization
User
Project
Environment
Site
RouteContract
RuleSet
Snapshot
Diagnostic
CrawlRun
Deployment
Commit
ExternalObservation
Suppression
Connector
Notification
Report
```

### Dashboard

Разделы:

```text
Overview
Projects
Pages
Issues
Crawls
Deployments
Google
Yandex
Performance
Rules
Team
Reports
Settings
```

### Инфраструктура

- PostgreSQL для проектов и diagnostics;
- Redis для очередей и cache;
- объектное хранилище для HTML и crawl snapshots;
- аналитическое хранилище для временных метрик;
- KMS для OAuth-токенов;
- отдельные worker-процессы;
- audit log;
- резервное копирование;
- региональное удаление данных.

---

# Этап 12. Google-интеграции

## Недели 33-40

### Google Search Console

Подключаем:

- список сайтов;
- Search Analytics;
- URL Inspection;
- sitemap;
- clicks;
- impressions;
- CTR;
- average position;
- coverage observations;
- last crawl;
- user canonical;
- Google canonical;
- rich-result observations.

URL Inspection имеет лимит 2 000 запросов в сутки на один сайт, поэтому
архитектура должна включать cache, приоритетные URL и планировщик, а не дёргать
API после каждого нажатия клавиши. ([Google for Developers][4])

### PageSpeed и CrUX

Подключаем:

- lab-анализ;
- mobile/desktop;
- LCP;
- CLS;
- INP;
- историю полевых данных;
- различие page-level и origin-level данных.

PageSpeed объединяет лабораторные проверки и данные реальных пользователей, но
полевые данные могут отсутствовать у новых или малопосещаемых страниц. Это явно
показывается в интерфейсе, а не маскируется красивым нулём. ([Google for
Developers][5])

---

# Этап 13. Интеграции Яндекса

## Недели 35-42

### Яндекс.Вебмастер

Подключаем:

- проверку прав;
- список сайтов;
- indexing history;
- важные страницы;
- HTTP-статус обхода;
- searchable status;
- причины исключения;
- sitemap;
- site diagnostics;
- reindexing queue;
- внутренние и внешние ссылки.

API Вебмастера позволяет получать историю важных страниц, включая HTTP-статус
обхода, searchable state, title, description и причину исключения. ([Yandex][6])

### Яндекс.Метрика

Подключаем:

- поисковый трафик;
- landing pages;
- источники;
- визиты;
- отказы;
- глубину просмотра;
- конверсии;
- сравнение до и после deployment;
- сегментацию по поисковикам и страницам.

Метрика предоставляет статистику через dimensions и metrics, но может
использовать sampling при больших объёмах. SearchLint обязан показывать факт
sampling рядом с результатом. ([Yandex][7])

---

# Этап 14. История, корреляция и алгоритмы

## Недели 39-44

### Связываем

```text
Git commit
Deployment
Page snapshot
SEO diagnostic
Google crawl
Yandex crawl
Index status
Clicks
Impressions
Traffic
Conversion
```

### Алгоритмы без ИИ

- rolling median;
- EWMA;
- median absolute deviation;
- сравнение периодов;
- абсолютные и относительные пороги;
- сезонные сравнения;
- минимальный объём данных;
- confidence score;
- обнаружение новых регрессий;
- поиск временной корреляции.

### Пример

```text
12 июня:
Изменён canonical.

13 июня:
Google выбрал другой canonical.

16 июня:
Показы страницы снизились на 38%.

Вывод:
Изменение коррелирует со снижением.
Причинность не доказана.
```

### Уведомления

- новая blocker-ошибка;
- страница получила `noindex`;
- canonical изменился;
- страница выпала из поиска;
- поисковик выбрал другой canonical;
- sitemap начал возвращать ошибку;
- после deployment появились новые проблемы;
- упали показы или органический трафик.

---

# Этап 15. Отчёты и агентский режим

## Недели 41-45

### Отчёты

- технический;
- клиентский;
- executive summary;
- до/после;
- deployment report;
- Google/Yandex report;
- PDF, HTML и shareable link;
- white-label;
- брендирование агентства.

### Агентский режим

- несколько клиентов;
- несколько проектов;
- роли;
- шаблоны правил агентства;
- общие policies;
- массовый мониторинг;
- единая очередь критических проблем;
- SLA и ответственные;
- экспорт доказательств выполненной работы.

---

# Этап 16. Безопасность, нагрузка и релиз

## Недели 45-48

### Безопасность

- penetration test;
- проверка OAuth;
- шифрование токенов;
- RBAC;
- audit log;
- секреты через KMS;
- защита crawler от SSRF;
- allowlist частных сетей;
- rate limits;
- удаление данных;
- резервное восстановление;
- dependency audit.

### Тестирование

```text
Unit
Integration
Parser tests
Rule fixtures
AST fixtures
Browser E2E
Next.js compatibility
Crawler load tests
API contract tests
OAuth tests
Security tests
Visual regression
Bundle tests
```

### Обязательная проверка нулевого веса

Для каждого поддерживаемого Next.js-проекта CI сравнивает production build:

```text
Без SearchLint
против
С установленным SearchLint
```

Результат должен быть:

```text
Client bundle difference: 0 bytes
Production requests: 0
Production runtime hooks: 0
Core Web Vitals impact: 0
```

### Критерии выпуска SearchLint 1.0

- все 120 правил реализованы;
- DSL полностью документирован;
- overlay работает;
- файл и строка показываются для статически локализуемых проблем;
- crawler готов;
- CLI и CI готовы;
- VS Code и LSP готовы;
- cloud dashboard готов;
- Google подключён;
- Яндекс подключён;
- история и корреляция работают;
- отчёты готовы;
- production-вес подтверждён как 0;
- blocker precision не ниже 99,5%;
- нет известных критических уязвимостей;
- документация и migration guide опубликованы.

# Календарь целиком

```text
Недели 01-04  Спецификация и UX
Недели 05-08  DSL и язык
Недели 09-12  Ядро
Недели 09-14  Collectors
Недели 13-18  Badge и Overlay
Недели 15-22  Next.js и Source Mapping
Недели 17-24  Каталог правил
Недели 21-30  Crawler
Недели 25-32  CLI и CI/CD
Недели 27-34  LSP и VS Code
Недели 25-36  Backend и Dashboard
Недели 33-40  Google
Недели 35-42  Яндекс
Недели 39-44  История и алгоритмы
Недели 41-45  Отчёты и агентский режим
Недели 45-48  Security, QA и релиз
```

**Итог:** через 48 недель выходит не пробный бейджик, а полноценная технология
SearchLint 1.0 со своим языком, анализатором кода, overlay, crawler, IDE, CI,
dashboard и подключением поисковых систем.

[1]:
  https://nextjs.org/docs/app/api-reference/functions/generate-metadata
  "Functions: generateMetadata"
[2]:
  https://nextjs.org/docs/app/api-reference/config/next-config-js/devIndicators
  "devIndicators - next.config.js"
[3]:
  https://code.visualstudio.com/api/language-extensions/language-server-extension-guide
  "Language Server Extension Guide"
[4]:
  https://developers.google.com/webmaster-tools/limits
  "Usage Limits | Search Console API"
[5]:
  https://developers.google.com/speed/docs/insights/v5/get-started
  "Get Started with the PageSpeed Insights API"
[6]:
  https://yandex.com/dev/webmaster/doc/en/reference/host-id-important-urls-history
  "Getting the history of changes to an important page"
[7]: https://yandex.com/dev/metrika/en/stat/ "Introduction | Yandex Metrica API"
