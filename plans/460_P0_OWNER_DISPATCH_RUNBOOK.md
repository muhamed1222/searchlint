# ExecPlan 460: P0 Owner Dispatch Runbook

## Purpose

The release evidence control board points to local P0 dispatch zip files under
`/tmp`, which helps this machine but is not durable for GitHub readers or
external owners. The P0 reviewer and legal owner guides already exist in the
repository, but there is no single repository entry point that ties issue `#19`
and issue `#20` to their required files, commands, and forbidden release
actions.

This plan adds that durable P0 dispatch entry point without changing release
readiness or claiming any external evidence.

## Scope

- Add `docs/RELEASE_P0_OWNER_DISPATCH_RUNBOOK.md`.
- Link the P0 runbook from `docs/RELEASE_EVIDENCE_CONTROL_BOARD.md`.
- Refresh the control board baseline to the latest verified `main` commit and CI
  run.
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
- [x] `docs/REVIEWER_RULE_QUALITY_OWNER_INPUT_GUIDE.md`
- [x] `docs/LEGAL_RELEASE_APPROVAL_OWNER_INPUT_GUIDE.md`
- [x] `docs/reviews/blocker-benchmark/README.md`
- [x] `docs/reviews/blocker-benchmark/REVIEW_INSTRUCTIONS.md`

## Acceptance Criteria

- A GitHub-readable P0 dispatch runbook exists.
- The runbook covers issue `#19` reviewer/rule-quality dispatch and issue `#20`
  legal/governance dispatch.
- The runbook lists the required real evidence files and validation commands.
- The runbook clearly says it is not evidence, sign-off, legal advice, legal
  approval, or release approval.
- The control board links the P0 dispatch runbook.
- The control board still states that final release is blocked.
- The control board still states `522/599` done, `77` remaining, `0/60` real
  owner evidence inputs, and `108` missing evidence paths.
- The board and runbook still forbid `v1.0.0`, final publication, public website
  launch, and announcement while `pnpm final-release:gate` is blocked.
- Formatting and release validation pass.

## Progress

- [x] Required reading completed.
- [x] P0 dispatch runbook added.
- [x] Control board linked to the P0 dispatch runbook.

## Decision Log

- 2026-06-30: Keep local `/tmp` packet paths only as artifact references because
  they are useful for the current operator but not durable evidence.
- 2026-06-30: Do not add generated evidence or owner JSON files because P0
  remains externally blocked.

## Evidence

- `pnpm final-release:gate`
- `pnpm exec prettier --check docs/RELEASE_P0_OWNER_DISPATCH_RUNBOOK.md docs/RELEASE_EVIDENCE_CONTROL_BOARD.md plans/460_P0_OWNER_DISPATCH_RUNBOOK.md`
- `pnpm lint`
- `git diff --check`
