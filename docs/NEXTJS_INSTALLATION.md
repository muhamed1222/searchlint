# SearchLint Next.js Installation

Status date: 2026-06-30

This page is public onboarding source for the Next.js integration. It does not
claim final package publication.

## Development Integration

SearchLint's Next.js integration is for local development feedback. It may show
the badge and overlay while developers inspect local routes.

## Production Boundary

The integration must be phase-aware. Production builds must include zero
SearchLint JavaScript, zero SearchLint HTTP requests, and zero SearchLint
background hooks.

## Verification

Use the repository's Next.js fixture and zero-impact verification commands to
prove the integration stays development-only.
