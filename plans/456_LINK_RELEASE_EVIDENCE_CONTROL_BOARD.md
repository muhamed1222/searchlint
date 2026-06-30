# ExecPlan 456: Link Release Evidence Control Board

## Purpose

`docs/RELEASE_EVIDENCE_CONTROL_BOARD.md` is now the versioned orchestration
board for release evidence issues `#19` through `#25`. The generated runbooks
and final gate documents should point readers to that board so owner routing is
discoverable without searching pull requests or issue comments.

## Scope

- Add short control-board references to:
  - `docs/RELEASE_OWNER_ACTION_RUNBOOK.md`
  - `docs/RELEASE_OWNER_EVIDENCE_RUNBOOK.md`
  - `docs/SEARCHLINT_1_0_FINAL_RELEASE_GATE.md`
  - `docs/RELEASE_EVIDENCE_READINESS_SUMMARY.md`
- Keep all release counters, statuses, and non-claims unchanged.

## Non-goals

- No owner evidence.
- No release approval.
- No generated report regeneration.
- No package, source, CI, or lockfile changes.
- No `v1.0.0` tag or publication action.

## Required Reading

- [x] `AGENTS.md`
- [x] `SEARCHLINT_1_0_DEVELOPMENT_PLAN.md`
- [x] `docs/PRODUCT_SPEC.md`
- [x] `docs/ARCHITECTURE.md`
- [x] `docs/TECH_STACK.md`
- [x] `docs/DEFINITION_OF_DONE.md`
- [x] `docs/OPEN_DECISIONS.md`
- [x] `docs/RELEASE_OWNER_ACTION_RUNBOOK.md`
- [x] `docs/RELEASE_OWNER_EVIDENCE_RUNBOOK.md`
- [x] `docs/SEARCHLINT_1_0_FINAL_RELEASE_GATE.md`
- [x] `docs/RELEASE_EVIDENCE_READINESS_SUMMARY.md`

## Acceptance Criteria

- The release owner action runbook links to the control board.
- The release owner evidence runbook links to the control board.
- The final release gate document links to the control board.
- The release evidence readiness summary links to the control board.
- The added text clearly states that the board is orchestration only and does
  not replace evidence or approval.
- Formatting and lint validation pass.

## Progress

- [x] Required reading completed.
- [x] Control-board links added.

## Decision Log

- 2026-06-30: Add links manually instead of regenerating release reports,
  because this change is a discoverability update and must not alter generated
  release counters or evidence status.

## Evidence

- `pnpm exec prettier --check docs/RELEASE_OWNER_ACTION_RUNBOOK.md docs/RELEASE_OWNER_EVIDENCE_RUNBOOK.md docs/SEARCHLINT_1_0_FINAL_RELEASE_GATE.md docs/RELEASE_EVIDENCE_READINESS_SUMMARY.md plans/456_LINK_RELEASE_EVIDENCE_CONTROL_BOARD.md`
- `pnpm lint`
