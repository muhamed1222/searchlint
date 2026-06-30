# SearchLint Onboarding Guide

Status date: 2026-06-30

This guide records the public onboarding path for SearchLint local developer
usage. It does not approve public launch.

## Local Developer Flow

1. Install the public package after publication.
2. Add SearchLint to a local Next.js development project.
3. Run the CLI or development integration locally.
4. Review deterministic diagnostics with stable rule IDs and evidence.
5. Use reporters or IDE/LSP surfaces as needed.

## Installation

Install the package only from the approved public package candidate after the
publication gate passes. Before that point, this guide describes the onboarding
shape but does not claim that final packages are available.

## Quick Start

Create a `searchlint.seo` file, run the CLI against a local project, and review
the generated diagnostics and reports. Diagnostics must include stable rule IDs
and evidence.

## Next.js Guide

Use the development-only Next.js integration when validating local routes. The
integration must remain phase-aware so production builds include no SearchLint
runtime code, requests, or hooks.

## CLI Guide

Use the CLI for local audits, CI checks, and report generation. CI usage should
consume deterministic exit codes and structured reports such as JSON, SARIF, and
JUnit.

## VS Code Guide

Use the VS Code and LSP surfaces for editor diagnostics backed by the same rule
engine as the CLI, overlay, crawler, CI, and cloud contracts.

## Google and Yandex Guide

Google and Yandex observations require dated provider evidence and freshness.
Provider-backed diagnostics must not be claimed until the relevant live
acceptance gates pass.

## Onboarding Wizard Source

The public onboarding wizard source must guide users through package
installation, `searchlint.seo` creation, local audit execution, and report
review without claiming unavailable release surfaces.

## Production Impact Boundary

SearchLint public local tooling must preserve the release invariant of zero
production JavaScript, zero production HTTP requests, and zero production
background processes on the end user's site.

## Evidence Expectations

Onboarding is release-ready only when clean install, Next.js fixture, CLI,
reporter, and zero-production-impact validation commands pass from the approved
public package candidate.

## Release Gate

This guide must be reviewed with package documentation, README, public website
copy, VS Code Marketplace copy, legal approval, and public/private repository
boundary before launch.
