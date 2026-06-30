# ExecPlan 454: Final Release Fresh Run Determinism

## Purpose

`pnpm final-release:gate` must produce stable checked-in release readiness
documents from a fresh checkout. The final release gate report is both consumed
by the evidence readiness intake and produced by the final release gate itself,
so a fresh run can otherwise classify `reports/final-release-gate-report.json`
as missing before the command writes the final blocked report.

This plan keeps the release blocked while making the final release gate's
generated evidence classification deterministic.

## Scope

- Seed `reports/final-release-gate-report.json` with an explicit blocked
  preflight report before running `pnpm release:evidence-readiness`.
- Keep the preflight report non-authorizing and replace it with the complete
  final release gate report before the command exits.
- Regenerate release evidence readiness docs and samples from a fresh run.
- Remove the `OD-027` numbering collision in `docs/OPEN_DECISIONS.md`; published
  docs already use `OD-027` for the Docker base-image decision.

## Non-goals

- No final release approval.
- No v1.0.0 tag.
- No npm or VS Code publication.
- No owner, reviewer, legal, provider, deployment, backup, or security evidence
  fabrication.
- No broad ADR archive reconstruction.

## Required Reading

- [x] `AGENTS.md`
- [x] `SEARCHLINT_1_0_DEVELOPMENT_PLAN.md`
- [x] `docs/PRODUCT_SPEC.md`
- [x] `docs/ARCHITECTURE.md`
- [x] `docs/TECH_STACK.md`
- [x] `docs/DEFINITION_OF_DONE.md`
- [x] `docs/OPEN_DECISIONS.md`
- [x] `plans/453_REQUIRED_READING_DOCS_RECONCILIATION.md`
- [x] `scripts/verify-final-release-gate.mjs`
- [x] `scripts/verify-release-evidence-readiness.mjs`
- [x] `scripts/verify-release-evidence-intake-status.mjs`

## Acceptance Criteria

- A fresh `pnpm final-release:gate` keeps
  `reports/final-release-gate-report.json` classified as
  `present_blocked_or_failing` in generated readiness docs.
- Generated readiness docs remain at 522/599 done, 77 open gates, and 108
  missing evidence paths for the current blocked release state.
- The final report still has `status: "blocked"` and does not create a `v1.0.0`
  tag.
- `docs/OPEN_DECISIONS.md` no longer reuses `OD-027` for the historical ExecPlan
  traceability gap.
- `pnpm format`, `pnpm lint`, and `pnpm final-release:gate` pass as validation
  commands for this plan.

## Progress

- [x] ExecPlan created.
- [x] Final release preflight blocked report added.
- [x] Open decision numbering collision removed.
- [x] Generated readiness docs refreshed.
- [x] Validation commands passed.

## Decision Log

- 2026-06-30: Use a blocked preflight JSON file instead of removing
  `reports/final-release-gate-report.json` from evidence intake, because final
  release readiness should continue to surface the final gate's blocked status
  when that command is the command being run.
- 2026-06-30: Renumber the newly added open decisions instead of changing the
  established Docker base-image `OD-027` references.

## Evidence

- `pnpm final-release:gate` generated 522/599 done, 77 remaining, 108 missing
  evidence paths, and left SearchLint 1.0 final release blocked.
- `docs/examples/release-evidence-intake-status-report.sample.json` continues to
  classify `reports/final-release-gate-report.json` as
  `present_blocked_or_failing` using the complete final report, not the
  preflight report.
- `pnpm lint` passed.
- `pnpm format` passed after formatting this ExecPlan.
