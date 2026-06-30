# ExecPlan 462: External Owner Action Queue

## Purpose

SearchLint 1.0 remains externally blocked with 60 missing owner inputs. The P0
and P1 dispatch runbooks provide durable GitHub entry points, but operators
still need a single working queue that answers which external owner action to
start first, which artifact should be returned, and which verifier proves it.

This plan adds that queue without changing release readiness or claiming any
external evidence.

## Scope

- Add `docs/RELEASE_EXTERNAL_OWNER_ACTION_QUEUE.md`.
- Link the owner action queue from `docs/RELEASE_EVIDENCE_CONTROL_BOARD.md`.
- Refresh current orchestration baselines to the latest verified `main` commit
  and CI run in the control board and dispatch runbooks.
- Keep release readiness, owner evidence, missing evidence, and forbidden
  release action status unchanged.

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
- [x] `docs/RELEASE_OWNER_EVIDENCE_PACKAGE_STATUS.md`
- [x] `docs/RELEASE_P0_OWNER_DISPATCH_RUNBOOK.md`
- [x] `docs/RELEASE_P1_OWNER_DISPATCH_RUNBOOK.md`

## Acceptance Criteria

- A GitHub-readable external owner action queue exists.
- The queue lists immediate owner lanes for P0 and P1 external evidence.
- The queue links to durable source-of-truth runbooks and package status docs.
- The queue lists first artifacts and first verifier commands for each lane.
- The queue clearly states it is not evidence, sign-off, approval, or release
  approval.
- The control board links the queue.
- The control board and dispatch runbooks point to the latest verified `main`
  commit and CI run.
- The docs still state that final release is blocked.
- The docs still state `522/599` done, `77` remaining, `0/60` real owner
  evidence inputs, and `108` missing evidence paths.
- The docs still forbid `v1.0.0`, final publication, public website launch, and
  announcement while `pnpm final-release:gate` is blocked.
- Formatting and release validation pass.

## Progress

- [x] Required reading completed.
- [x] External owner action queue added.
- [x] Control board linked to the queue.
- [x] Orchestration baselines refreshed.

## Decision Log

- 2026-06-30: Keep full generated evidence path details in
  `docs/RELEASE_OWNER_EVIDENCE_PACKAGE_STATUS.md`; the queue lists first
  artifacts and owner lanes so it stays usable and avoids duplicating all 60
  owner inputs.
- 2026-06-30: Keep issue `#25` final release explicitly blocked until upstream
  issue `#19` through issue `#24` pass.
- 2026-06-30: Do not add generated evidence or owner JSON files because the
  release remains externally blocked.

## Evidence

- `pnpm final-release:gate`
- `pnpm exec prettier --check docs/RELEASE_EXTERNAL_OWNER_ACTION_QUEUE.md docs/RELEASE_EVIDENCE_CONTROL_BOARD.md docs/RELEASE_P0_OWNER_DISPATCH_RUNBOOK.md docs/RELEASE_P1_OWNER_DISPATCH_RUNBOOK.md plans/462_EXTERNAL_OWNER_ACTION_QUEUE.md`
- `pnpm lint`
- `git diff --check`
