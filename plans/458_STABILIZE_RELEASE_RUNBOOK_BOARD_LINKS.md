# ExecPlan 458: Stabilize Release Runbook Board Links

## Purpose

`docs/RELEASE_OWNER_ACTION_RUNBOOK.md` and
`docs/RELEASE_OWNER_EVIDENCE_RUNBOOK.md` are generated release-orchestration
documents. Both docs point owners to `docs/RELEASE_EVIDENCE_CONTROL_BOARD.md`,
but fresh generator runs removed those board sections.

This plan makes the control-board routing text reproducible from the generators
and keeps release evidence status unchanged.

## Scope

- Update `scripts/generate-release-owner-action-runbook.mjs` so the generated
  owner action runbook includes the orchestration board section.
- Update `scripts/generate-release-owner-evidence-runbook.mjs` so the generated
  owner evidence runbook includes the orchestration board section.
- Make the owner evidence runbook generator resolve repository Prettier config
  before writing markdown and JSON.
- Regenerate the affected runbooks.

## Non-goals

- No owner, reviewer, legal, provider, publication, deployment, security,
  backup, or final release evidence.
- No release gate closure.
- No change to release counters or final release semantics.
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
- [x] `docs/RELEASE_OWNER_ACTION_RUNBOOK.md`
- [x] `docs/RELEASE_OWNER_EVIDENCE_RUNBOOK.md`
- [x] `scripts/generate-release-owner-action-runbook.mjs`
- [x] `scripts/generate-release-owner-evidence-runbook.mjs`

## Acceptance Criteria

- `pnpm release:owner-runbook` preserves the action runbook orchestration board
  section.
- `pnpm release:owner-evidence-runbook` preserves the evidence runbook
  orchestration board section.
- The generated markdown respects repository Prettier config.
- `pnpm final-release:gate` remains blocked on missing external evidence and
  does not create `v1.0.0`.
- Formatting and lint validation pass.

## Progress

- [x] Required reading completed.
- [x] Owner action runbook generator updated.
- [x] Owner evidence runbook generator updated.

## Decision Log

- 2026-06-30: Keep board links in generators instead of hand-editing generated
  runbooks, because release orchestration docs must survive fresh verifier runs.
- 2026-06-30: Resolve repository Prettier config in the owner evidence runbook
  generator so generated markdown matches the checked-in style.

## Evidence

- `pnpm release:owner-runbook`
- `pnpm release:owner-evidence-runbook`
- `pnpm final-release:gate`
- `pnpm exec prettier --check scripts/generate-release-owner-action-runbook.mjs scripts/generate-release-owner-evidence-runbook.mjs docs/RELEASE_OWNER_ACTION_RUNBOOK.md docs/RELEASE_OWNER_EVIDENCE_RUNBOOK.md plans/458_STABILIZE_RELEASE_RUNBOOK_BOARD_LINKS.md`
- `pnpm lint`
