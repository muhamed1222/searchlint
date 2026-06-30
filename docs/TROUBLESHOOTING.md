# SearchLint Troubleshooting

Status date: 2026-06-30

This page is public website source material for local onboarding. It does not
replace release evidence or live support operations.

## Installation Problems

If package installation fails, verify that the package has actually been
published, the package manager version matches repository requirements, and the
project is using a supported Node.js runtime.

## No Diagnostics Appear

Check that `searchlint.seo` exists, the target route is covered by a route
contract, and the command is running against the intended local project.

## Next.js Integration Does Not Load

Confirm that the integration is running only in development mode. Production
builds must not include SearchLint runtime code, network requests, or background
hooks.

## Provider Evidence Is Missing

Google and Yandex diagnostics that depend on provider observations require
fresh, dated, real provider evidence. Missing provider evidence should remain
blocked rather than being replaced by examples or assumptions.

## Reports Are Not Accepted In CI

Use the structured reports and exit codes from the CLI. CI should fail only on
the configured severity policy and must not infer file, line, selector, or
provider evidence that was not collected.
