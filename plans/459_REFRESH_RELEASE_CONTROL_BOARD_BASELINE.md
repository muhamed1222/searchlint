# ExecPlan 459: Refresh Release Control Board Baseline

## Purpose

`docs/RELEASE_EVIDENCE_CONTROL_BOARD.md` is the owner-facing release evidence
orchestration board. Its baseline still pointed at an older verified `main`
commit even though subsequent orchestration fixes were merged and verified.

This plan refreshes the board to the latest verified `main` baseline without
changing release readiness or claiming any external evidence.

## Scope

- Update the control board baseline commit to
  `b6aa71be4751496856668de924aa341847403ac4`.
- Update the baseline GitHub Actions run to
  `https://github.com/muhamed1222/searchlint/actions/runs/28460679452`.
- Note that the baseline includes generated-release-doc reproducibility fixes
  through ExecPlan 458.
- Keep release readiness, owner evidence, missing evidence, and forbidden action
  status unchanged.

## Non-goals

- No owner, reviewer, legal, provider, publication, deployment, security,
  backup, or final release evidence.
- No release gate closure.
- No generated report counter changes.
- No package, lockfile, CI, source package, or release action changes.
- No `v1.0.0` tag or publication action.

## Required Reading

- [x] `AGENTS.md`
- [x] `SEARCHLINT_1_0_DEVELOPMENT_PLAN.md`
- [x] `docs/PRODUCT_SPEC.md`
- [x] `docs/ARCHITECTURE.md`
- [x] `docs/TECH_STACK.md`
- [x] `docs/DEFINITION_OF_DONE.md`
- [x] `docs/OPEN_DECISIONS.md`
- [x] `docs/RELEASE_EVIDENCE_CONTROL_BOARD.md`

## Acceptance Criteria

- The control board points to the latest verified `main` commit and CI run.
- The board still states that final release is blocked.
- The board still states `522/599` done, `77` remaining, `0/60` real owner
  evidence inputs, and `108` missing evidence paths.
- The board still forbids `v1.0.0`, final publication, public website launch,
  and announcement while `pnpm final-release:gate` is blocked.
- Formatting and release validation pass.

## Progress

- [x] Required reading completed.
- [x] Control board baseline updated.

## Decision Log

- 2026-06-30: Refresh only the verified baseline metadata, because external
  evidence status has not changed.

## Evidence

- `pnpm final-release:gate`
- `pnpm exec prettier --check docs/RELEASE_EVIDENCE_CONTROL_BOARD.md plans/459_REFRESH_RELEASE_CONTROL_BOARD_BASELINE.md`
- `pnpm lint`
