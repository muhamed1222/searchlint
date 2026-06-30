# Yandex Webmaster and Metrica Acceptance

Status date: 2026-06-22

This document records the deterministic local/static Yandex Webmaster and Yandex
Metrica acceptance proof added by ExecPlan 255. It is not a live Yandex release
gate.

## Command

```bash
pnpm yandex:acceptance
```

The command builds the affected API, worker, dashboard, and HTML reporter
packages, runs focused Yandex provider and external-observation worker tests,
then writes deterministic evidence to:

- `reports/yandex-acceptance-report.json`
- `docs/examples/yandex-acceptance-report.sample.json`

The checked sample is sanitized. The verifier fails if the generated evidence
contains raw token markers such as access tokens, refresh tokens, authorization
codes, or client secrets.

## Verified Scope

The acceptance verifier proves the current local/static implementation can:

- map Webmaster URL-status requests for configured site host and subject URL;
- preserve Webmaster indexing state, searchable status, exclusion reason, last
  crawl time, HTTP status, important URL flag, and diagnostics payload evidence;
- map Webmaster sitemap status requests and preserve sitemap status payload
  evidence;
- map Metrica landing-page requests with date range, metrics, dimensions, and
  escaped landing-page filters;
- preserve Metrica organic source, landing page, visits, bounce rate,
  conversions, goal conversion rate, goal metadata, and sampling payload
  evidence;
- normalize Yandex quota headers into quota evidence;
- classify deterministic mocked observations as fresh;
- collect Yandex observations through the external-observation worker using an
  OAuth vault access-token boundary;
- persist collected observations through the `ExternalObservationStore` boundary
  with tenant, project, environment, provider, source, subject URL, and stable
  fingerprints;
- render supplied Yandex observations in the dashboard snapshot HTML without
  performing a live provider call;
- render supplied Yandex observations in the HTML reporter.

## Evidence Shape

The JSON report contains:

- command results for the focused tests and package builds;
- adapter evidence for Webmaster URL status, Webmaster sitemap, Metrica, quota,
  freshness, and sampling;
- worker evidence for provider selection, vault reads, stored records, and
  stable fingerprints;
- dashboard evidence proving user-visible summaries for Webmaster, sitemap, and
  Metrica observations;
- report evidence proving Yandex observations render in the report template;
- remaining live release gates.
- separate static OAuth app readiness evidence is tracked through
  `pnpm yandex:oauth-static` and `docs/YANDEX_OAUTH_APP_STATIC_READINESS.md`.
- separate static Webmaster site connection readiness evidence is tracked
  through `pnpm yandex:webmaster-site-static` and
  `docs/YANDEX_WEBMASTER_SITE_CONNECTION_STATIC_READINESS.md`.
- separate static Metrica counter connection readiness evidence is tracked
  through `pnpm yandex:metrica-counter-static` and
  `docs/YANDEX_METRICA_COUNTER_CONNECTION_STATIC_READINESS.md`.

## Explicit Non-Claims

This proof does not claim:

- a configured real Yandex OAuth application; static configuration readiness is
  tracked separately and is not a live app proof;
- a live Yandex Webmaster site connection; static site connection readiness is
  tracked separately and is not a live ownership proof;
- a live Yandex Metrica counter connection; static counter connection readiness
  is tracked separately and is not a live counter access proof;
- exact live Yandex endpoint conformance;
- live Webmaster or Metrica API data;
- live Yandex quota, retry/backoff, or stale-state behavior;
- live dashboard connector status against real Yandex credentials.

## Remaining Release Gates

Before SearchLint 1.0 can claim Yandex readiness, the project still needs:

- a configured Yandex OAuth application with approved redirect URIs;
- real Yandex Webmaster site connection;
- real Yandex Metrica counter connection;
- live Webmaster URL status acceptance for indexing state, searchable status,
  exclusion reasons, last crawl, HTTP status, important URLs, and diagnostics;
- live Webmaster sitemap status acceptance;
- live Metrica acceptance for organic traffic, landing pages, sources, visits,
  bounce rate, conversions, goal data, and sampling;
- production credential proof for quota, retry/backoff, and stale-state
  behavior;
- dashboard connector status and settings proof against live Yandex credentials.
