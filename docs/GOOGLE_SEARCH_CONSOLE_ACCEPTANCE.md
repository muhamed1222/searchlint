# Google Search Console Acceptance

Status date: 2026-06-22

This document records the deterministic local/static Google Search Console
acceptance proof added by ExecPlan 253. It is not a live Google Search Console
release gate.

## Command

```bash
pnpm google:gsc:acceptance
```

The command builds the affected API, worker, dashboard, and HTML reporter
packages, runs focused Google provider and external-observation worker tests,
then writes deterministic evidence to:

- `reports/google-search-console-acceptance-report.json`
- `docs/examples/google-search-console-acceptance-report.sample.json`

The checked sample is sanitized. The verifier fails if the generated evidence
contains raw token markers such as access tokens, refresh tokens, authorization
codes, or client secrets.

## Verified Scope

The acceptance verifier proves the current local/static implementation can:

- map URL Inspection requests to the expected Google endpoint and request body;
- preserve URL Inspection coverage state, last crawl time, Google canonical,
  user canonical, and rich-result verdict payload evidence;
- map Search Analytics requests and preserve clicks, impressions, CTR, and
  average position;
- map sitemap status requests and preserve sitemap status payload evidence;
- normalize provider quota headers into quota evidence;
- classify deterministic mocked observations as fresh;
- collect Google observations through the external-observation worker using an
  OAuth vault access-token boundary;
- persist collected observations through the `ExternalObservationStore` boundary
  with tenant, project, environment, provider, source, subject URL, and stable
  fingerprints;
- render supplied Google observations in the dashboard snapshot HTML without
  performing a live provider call;
- render supplied Google observations in the HTML reporter.

## Evidence Shape

The JSON report contains:

- command results for the focused tests and package builds;
- adapter evidence for URL Inspection, Search Analytics, sitemap, quota, and
  freshness;
- worker evidence for provider selection, vault reads, stored records, and
  stable fingerprints;
- dashboard evidence proving user-visible summaries for URL Inspection, Search
  Analytics, and sitemap observations;
- report evidence proving Google observations render in the report template;
- remaining live release gates.

## Explicit Non-Claims

This proof does not claim:

- a configured real Google OAuth app;
- Google OAuth app verification or approved redirect URIs;
- Search Console property ownership verification;
- a live Search Console site connection;
- a live URL Inspection call;
- live Search Analytics data;
- live sitemap status data from Google;
- live Google quota, retry/backoff, or stale-state behavior;
- PageSpeed or CrUX acceptance;
- live dashboard connector status against real Google credentials.

## Remaining Release Gates

Before SearchLint 1.0 can claim Google Search Console readiness, the project
still needs:

- a configured Google OAuth app with approved redirect URIs;
- verified Search Console property connection for target sites;
- live Search Analytics acceptance for clicks, impressions, CTR, and average
  position;
- live URL Inspection acceptance for coverage, last crawl, Google canonical,
  user canonical, and rich-result observations;
- live sitemap status acceptance;
- production credential proof for quota, retry/backoff, and stale-state
  behavior;
- dashboard connector status and settings proof against live Google credentials.
