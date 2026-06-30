# ExecPlan 461: P1 Owner Dispatch Runbook

## Purpose

The release evidence control board points to a local P1 dispatch zip file under
`/tmp`, which helps this machine but is not durable for GitHub readers or
external owners. P1 package evidence is already described in generated owner
runbooks, but there is no single repository entry point that maps issue `#21`
through issue `#25` to their required evidence packages, durable source files,
commands, and forbidden release actions.

This plan adds that durable P1 dispatch entry point without changing release
readiness or claiming any external evidence.

## Scope

- Add `docs/RELEASE_P1_OWNER_DISPATCH_RUNBOOK.md`.
- Link the P1 runbook from `docs/RELEASE_EVIDENCE_CONTROL_BOARD.md`.
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
- [x] `docs/RELEASE_OWNER_EVIDENCE_RUNBOOK.md`
- [x] `docs/RELEASE_OWNER_EVIDENCE_PACKAGE_STATUS.md`
- [x] `docs/PUBLICATION_PACKAGE_OWNER_INPUT_GUIDE.md`
- [x] `docs/PACKAGE_PUBLICATION_READINESS.md`
- [x] `docs/SECURITY_PRIVACY_RELEASE_GATE.md`
- [x] `docs/SEARCHLINT_1_0_FINAL_RELEASE_GATE.md`

## Acceptance Criteria

- A GitHub-readable P1 dispatch runbook exists.
- The runbook covers issue `#21` through issue `#25`.
- The runbook links durable repository sources for evidence paths and templates.
- The runbook lists package-level required evidence classes and validation
  commands.
- The runbook clearly says it is not evidence, sign-off, approval, or release
  approval.
- The control board links the P1 dispatch runbook.
- The control board points to the latest verified `main` commit and CI run.
- The control board still states that final release is blocked.
- The control board still states `522/599` done, `77` remaining, `0/60` real
  owner evidence inputs, and `108` missing evidence paths.
- The board and runbook still forbid `v1.0.0`, final publication, public website
  launch, and announcement while `pnpm final-release:gate` is blocked.
- Formatting and release validation pass.

## Progress

- [x] Required reading completed.
- [x] P1 dispatch runbook added.
- [x] Control board linked to the P1 dispatch runbook.

## Decision Log

- 2026-06-30: Keep local `/tmp` packet paths only as artifact references because
  they are useful for the current operator but not durable evidence.
- 2026-06-30: Keep P1 evidence path details in generated owner runbooks and
  package status docs to avoid duplicating 49 owner input paths in a manual
  dispatch page.
- 2026-06-30: Do not add generated evidence or owner JSON files because P1
  remains externally blocked.

## Evidence

- `pnpm final-release:gate`
- `pnpm exec prettier --check docs/RELEASE_P1_OWNER_DISPATCH_RUNBOOK.md docs/RELEASE_EVIDENCE_CONTROL_BOARD.md plans/461_P1_OWNER_DISPATCH_RUNBOOK.md`
- `pnpm lint`
- `git diff --check`
