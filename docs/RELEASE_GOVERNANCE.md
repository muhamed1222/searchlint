# Release Governance

Status date: 2026-06-30

This document records the governance rules for SearchLint 1.0 release actions.
It does not approve a release.

## Required Release Authorities

SearchLint 1.0 may be tagged, published, or publicly announced only after the
dedicated release gates pass:

- independent blocker benchmark reviewer sign-off;
- legal release approval;
- hosted GitHub branch protection and required CI evidence;
- public/private repository boundary approval;
- npm package publication readiness;
- VS Code Marketplace readiness;
- public website and onboarding readiness;
- security, privacy, DAST, penetration test, and accessibility review;
- live provider, production platform, billing, backup, and final RC evidence.

## Forbidden Early Actions

Until `pnpm final-release:gate` passes, do not create `v1.0.0`, publish final
npm packages, publish the VS Code extension, launch the public website, or
announce SearchLint 1.0 as released.

## Evidence Rules

Machine-readable JSON evidence is preferred for gates that depend on external
systems. Screenshots alone are not sufficient. Evidence must not contain tokens,
credentials, private keys, cookies, database URLs, customer data, or other
secrets.

## Branch Protection

The `main` branch must require the approved CI checks, at least one approving
review, stale review dismissal, conversation resolution, linear history, and no
force pushes or deletions.

## Release Gate

This governance document must be reviewed with the license, notice, contribution
policy, security policy, trademark policy, package metadata, and public/private
repository boundary before public release.
