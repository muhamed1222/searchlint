# Google PageSpeed and CrUX Acceptance

Status date: 2026-06-22

This document records the deterministic local/static PageSpeed and CrUX
acceptance proof added by ExecPlan 254. It is not a live PageSpeed Insights or
CrUX release gate.

## Command

```bash
pnpm google:performance:acceptance
```

The command builds the affected API, worker, dashboard, and HTML reporter
packages, runs focused Google provider and external-observation worker tests,
then writes deterministic evidence to:

- `reports/google-performance-acceptance-report.json`
- `docs/examples/google-performance-acceptance-report.sample.json`

The checked sample is sanitized. The verifier fails if the generated evidence
contains raw token markers such as access tokens, refresh tokens, authorization
codes, or client secrets.

## Verified Scope

The acceptance verifier proves the current local/static implementation can:

- map PageSpeed Insights requests with configured URL, strategy, and categories;
- map CrUX requests with configured URL, form factor, and effective connection
  type;
- preserve PageSpeed lab LCP, INP, and CLS metrics from Lighthouse audits;
- preserve PageSpeed field page LCP, INP, and CLS metrics from
  `loadingExperience`;
- preserve PageSpeed field origin LCP, INP, and CLS metrics from
  `originLoadingExperience`;
- preserve CrUX field LCP, INP, and CLS metrics from CrUX records;
- represent CrUX missing-data responses as sampled observations with a `missing`
  sampling state instead of a provider failure;
- normalize provider quota headers into quota evidence;
- classify deterministic mocked observations as fresh;
- collect PageSpeed and CrUX observations through the external-observation
  worker using an OAuth vault access-token boundary;
- persist collected observations through the `ExternalObservationStore` boundary
  with tenant, project, environment, provider, source, subject URL, and stable
  fingerprints;
- render supplied PageSpeed and CrUX observations in the dashboard snapshot HTML
  without performing a live provider call;
- render supplied PageSpeed and CrUX observations in the HTML reporter.

## Evidence Shape

The JSON report contains:

- command results for the focused tests and package builds;
- adapter evidence for PageSpeed, CrUX, quota, freshness, sampling, and missing
  data;
- metric summaries for lab data, field page data, field origin data, and CrUX
  field data;
- worker evidence for provider selection, vault reads, stored records, and
  stable fingerprints;
- dashboard evidence proving user-visible summaries for PageSpeed and CrUX
  observations;
- report evidence proving PageSpeed and CrUX observations render in the report
  template;
- remaining live release gates.

## Explicit Non-Claims

This proof does not claim:

- a configured real Google OAuth app;
- live PageSpeed Insights API data;
- live CrUX API data;
- live PageSpeed or CrUX quota acceptance;
- live retry/backoff or stale-state behavior;
- historical production metric storage;
- production dashboard performance charting;
- live dashboard connector status against real Google credentials.

## Remaining Release Gates

Before SearchLint 1.0 can claim PageSpeed/CrUX readiness, the project still
needs:

- a configured Google OAuth app with approved redirect URIs;
- live PageSpeed Insights acceptance for LCP, INP, CLS, lab data, field page
  data, and field origin data;
- live CrUX acceptance for LCP, INP, CLS, form-factor filtering, and missing
  data states;
- historical performance metric rollups for dashboard trend analysis;
- production credential proof for quota, retry/backoff, and stale-state
  behavior;
- dashboard performance visualizations against live Google credentials.
