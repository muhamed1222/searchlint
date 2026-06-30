# SearchLint Architecture

Status date: 2026-06-30

This document summarizes the current architectural source of truth required by
`AGENTS.md`. It is subordinate to approved ADRs when ADRs exist and must be kept
aligned with `SEARCHLINT_1_0_DEVELOPMENT_PLAN.md`.

## System Shape

SearchLint is organized around a shared deterministic diagnostics core:

```text
SearchLint Language
  -> Parser / AST / Validator
  -> Route contracts and rule configuration
  -> Shared rule engine
  -> Evidence collectors
  -> Diagnostics
  -> Overlay / CLI / CI / LSP / Crawler / Cloud
```

The same rule definitions and diagnostic contracts must be reused across local
and hosted surfaces. Rule logic must not be forked between overlay, CLI, IDE,
crawler, CI, and cloud.

## Evidence Sources

Supported evidence sources include:

- source code;
- raw HTML;
- rendered DOM;
- HTTP headers;
- robots.txt;
- sitemap.xml;
- crawler snapshots;
- Google observations;
- Yandex observations.

Diagnostics may cite only evidence that was actually collected or proven by the
current analysis path.

## Local Developer Architecture

The local developer product includes:

- SearchLint CLI and configuration commands;
- `searchlint.seo` language parsing and validation;
- Next.js development-only config wrapper;
- browser and HTTP collectors;
- Shadow DOM badge and overlay;
- JSON, SARIF, JUnit, HTML, and PDF reporting paths;
- LSP and VS Code extension packages.

The Next.js integration must remain development-only and phase-aware so
production builds do not include SearchLint code, requests, or runtime hooks.

## Cloud Architecture Boundary

The full 1.0 architecture includes API, workers, PostgreSQL/RDS, object storage,
queues, auth/RBAC, OAuth vault, dashboard, reports, billing, notifications,
observability, and agency mode. Static or local contract evidence is not live
production evidence.

Live cloud gates remain blocked until the relevant deployment, provider,
security, backup, billing, and final release evidence exists and passes the
dedicated verifier commands.

## Public and Private Boundary

The public local package candidates include CLI, core packages, crawler,
language/LSP, Next integration, overlay, reporters, specs, and public local
product documentation.

Closed commercial surfaces include dashboard, API, workers, infrastructure,
billing, OAuth vault operations, hosted reports, and SaaS operations. The final
public/private boundary requires owner/legal approval before release.

## Validation

Architecture-sensitive changes require an ExecPlan and must document:

- scope and non-goals;
- affected packages or services;
- invariant impact;
- evidence and validation commands;
- any source-of-truth conflict in `docs/OPEN_DECISIONS.md`.
