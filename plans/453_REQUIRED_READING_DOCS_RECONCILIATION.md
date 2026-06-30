# ExecPlan 453: Required Reading Docs Reconciliation

## Purpose

Reconcile the repository governance contract with the published `main` branch.
`AGENTS.md` requires several source-of-truth documents before changes begin, but
those documents were missing from `main`.

This plan adds the missing required-reading documents without changing product
code, package manager files, CI, release evidence, or final release status.

## Scope

- Add `docs/PRODUCT_SPEC.md`.
- Add `docs/ARCHITECTURE.md`.
- Add `docs/TECH_STACK.md`.
- Add `docs/DEFINITION_OF_DONE.md`.
- Add `docs/OPEN_DECISIONS.md`.
- Record the missing-docs source-of-truth gap in `docs/OPEN_DECISIONS.md`.

## Non-Goals

- Do not approve SearchLint 1.0 release.
- Do not create real owner, reviewer, legal, provider, publication, deployment,
  backup, security, or final release evidence.
- Do not change code, CI, package manifests, lockfiles, or generated release
  gate semantics.
- Do not create `v1.0.0`.

## Required Reading

- [x] `AGENTS.md`
- [x] `SEARCHLINT_1_0_DEVELOPMENT_PLAN.md`
- [x] `README.md`
- [x] `docs/RELEASE_GOVERNANCE.md`
- [x] `docs/SEARCHLINT_1_0_FINAL_RELEASE_GATE.md`
- [x] `docs/RELEASE_EVIDENCE_READINESS_SUMMARY.md`
- [x] `docs/RELEASE_OWNER_EVIDENCE_READINESS_INDEX.md`
- [x] `docs/RELEASE_EVIDENCE_INTAKE_STATUS.md`
- [x] `docs/RELEASE_OWNER_ACTION_RUNBOOK.md`
- [x] `docs/RELEASE_OWNER_EVIDENCE_RUNBOOK.md`
- [x] `docs/RELEASE_OWNER_EVIDENCE_PACKAGE_STATUS.md`
- [x] `docs/RELEASE_MISSING_EVIDENCE_TEMPLATE_INDEX.md`

The five missing required-reading files could not be read before this plan
because they did not exist on `main`. This contradiction is recorded in
`docs/OPEN_DECISIONS.md`.

## Acceptance Criteria

- All five documents required by `AGENTS.md` exist on `main`.
- The new docs preserve the full SearchLint 1.0 scope.
- The new docs state that final release remains blocked until real external
  evidence exists.
- `docs/OPEN_DECISIONS.md` records the missing-docs reconciliation.
- `pnpm format` passes.
- `pnpm final-release:gate` remains blocked for the same external-evidence
  reasons and does not create `v1.0.0`.

## Progress

- [x] Missing required-reading docs identified on published `main`.
- [x] Reconciliation plan created.
- [x] Required docs added.
- [x] Validation run.

## Decision Log

- 2026-06-30: Add concise governance source docs instead of weakening
  `AGENTS.md`, because the repository already requires these docs and other
  files reference them.
- 2026-06-30: Keep this PR documentation-only so it does not alter release gate
  counters or fabricate external evidence.

## Evidence

- Added all five `AGENTS.md` required-reading docs that were missing from
  published `main`.
- `pnpm final-release:gate` regenerated release evidence readiness. The final
  gate remained blocked and did not create `v1.0.0`.
- The readiness missing evidence path count changed from 109 to 108 because
  `docs/OPEN_DECISIONS.md` now exists as a real governance document.
- Validation:
  - `pnpm final-release:gate`
  - `pnpm exec prettier --write docs/PRODUCT_SPEC.md docs/ARCHITECTURE.md docs/TECH_STACK.md docs/DEFINITION_OF_DONE.md docs/OPEN_DECISIONS.md plans/453_REQUIRED_READING_DOCS_RECONCILIATION.md`
