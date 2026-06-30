# SearchLint CLI and CI Usage

Status date: 2026-06-30

This page is public onboarding source for CLI and CI usage. It does not claim
final package publication.

## CLI Usage

The CLI runs deterministic audits against local projects, route contracts, HTML,
HTTP evidence, crawler snapshots, and supported provider evidence when that
evidence exists.

## CI Usage

CI should consume stable exit codes and structured reports. Supported report
families include JSON, SARIF, JUnit, HTML, and PDF where configured by the
release candidate.

## Evidence Boundary

CI must not invent missing file, line, selector, route, or provider evidence.
When evidence is unavailable, the correct status is missing or blocked.
