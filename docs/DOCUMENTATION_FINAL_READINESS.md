# Documentation Final Readiness

Status date: 2026-06-23

`pnpm docs:final-readiness` is the aggregate deterministic gate for SearchLint
release documentation readiness.

## Verified Scope

The command verifies:

- release documentation acceptance;
- public website/onboarding source acceptance;
- generated rule documentation freshness;
- required release documentation files exist and are non-empty;
- required documentation sample evidence exists and parses as JSON;
- release docs honestly state that SearchLint 1.0 is not released while final
  gates remain blocked.

## Command

```bash
pnpm docs:final-readiness
```

The command runs:

- `pnpm reporters:acceptance`;
- `pnpm website:acceptance`;
- `pnpm docs:rules:check`.

## Evidence

The verifier writes:

```text
reports/documentation-final-readiness-report.json
docs/examples/documentation-final-readiness-report.sample.json
```

Generated reports under `reports/` remain CI artifacts. The checked-in sample is
deterministic and sanitized.

## Non-Claims

This gate does not claim:

- deployed public website;
- final marketing, legal, privacy, pricing, support, or trademark approval;
- live onboarding or signup;
- SearchLint 1.0 final release approval.

Those remain covered by separate public website, legal, onboarding, and final
release gates.
