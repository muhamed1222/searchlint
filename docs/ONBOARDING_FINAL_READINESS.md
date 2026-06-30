# Onboarding Final Readiness

Status date: 2026-06-23

`pnpm onboarding:final` is the aggregate deterministic gate for SearchLint
source-level onboarding readiness.

## Verified Scope

The command verifies:

- public website/onboarding source acceptance;
- documentation final readiness;
- installation and quick-start onboarding source;
- Next.js, CLI, VS Code, Google/Yandex, and demo-project onboarding paths;
- onboarding wizard input questions;
- onboarding wizard output contract;
- deterministic demo project files and starter `searchlint.seo`;
- release-honesty markers that leave live provider, cloud, signup, and deployed
  website gates open.

## Command

```bash
pnpm onboarding:final
```

The command runs:

- `pnpm website:acceptance`;
- `pnpm docs:final-readiness`.

## Evidence

The verifier writes:

```text
reports/onboarding-source-final-report.json
docs/examples/onboarding-source-final-report.sample.json
```

Generated reports under `reports/` remain CI artifacts. The checked-in sample is
deterministic and sanitized.

## Non-Claims

This gate does not claim:

- deployed public website;
- live signup/auth onboarding;
- live cloud project creation wizard;
- final marketing, legal, privacy, pricing, or support approval;
- SearchLint 1.0 final release approval.

Those remain covered by separate public website, cloud, legal, and final release
gates.
