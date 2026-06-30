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
