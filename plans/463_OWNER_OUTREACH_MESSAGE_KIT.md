# ExecPlan 463: Owner Outreach Message Kit

Status date: 2026-06-30

## Context

SearchLint 1.0 remains externally blocked. The repository now has P0 and P1
dispatch runbooks plus an external owner action queue, but operators still need
copy-paste outreach text that asks each owner for the correct sanitized evidence
without implying that the request itself is approval.

This plan adds a durable message kit and links it from the current release
orchestration docs. It does not create owner evidence and does not change
release readiness.

## Scope

- Add `docs/RELEASE_OWNER_OUTREACH_MESSAGE_KIT.md`.
- Link the message kit from `docs/RELEASE_EVIDENCE_CONTROL_BOARD.md`.
- Link the message kit from `docs/RELEASE_EXTERNAL_OWNER_ACTION_QUEUE.md`.
- Refresh orchestration baselines to the latest verified `main` commit.

## Non-Goals

- Do not add generated evidence files.
- Do not add owner approval JSON.
- Do not change verifier logic.
- Do not create `v1.0.0`.
- Do not run final `npm publish` or final `vsce publish`.
- Do not announce SearchLint 1.0.

## Required Reading

- [x] `SEARCHLINT_1_0_DEVELOPMENT_PLAN.md`
- [x] `docs/PRODUCT_SPEC.md`
- [x] `docs/ARCHITECTURE.md`
- [x] `docs/TECH_STACK.md`
- [x] `docs/DEFINITION_OF_DONE.md`
- [x] `docs/OPEN_DECISIONS.md`
- [x] `docs/RELEASE_EVIDENCE_CONTROL_BOARD.md`
- [x] `docs/RELEASE_EXTERNAL_OWNER_ACTION_QUEUE.md`
- [x] `docs/RELEASE_P0_OWNER_DISPATCH_RUNBOOK.md`
- [x] `docs/RELEASE_P1_OWNER_DISPATCH_RUNBOOK.md`

## Acceptance Criteria

- The message kit includes owner-specific outreach text for issues `#19` through
  `#25`.
- The message kit states that it is not evidence, sign-off, legal approval, or
  release approval.
- The message kit tells owners to return sanitized machine-readable evidence at
  exact required paths.
- The message kit repeats the forbidden final release actions while
  `pnpm final-release:gate` is blocked.
- The control board and external owner action queue link the message kit.
- Validation commands pass or documented blockers remain honest.

## Progress

- [x] Required reading completed.
- [x] Message kit added.
- [x] Control board linked to the message kit.
- [x] External owner action queue linked to the message kit.
- [x] Validation run.

## Decision Log

- 2026-06-30: Keep this as an orchestration-only docs change. Outreach text can
  reduce owner handoff ambiguity, but it must not create or imply release
  evidence.
- 2026-06-30: Keep final-release actions explicitly forbidden in every relevant
  owner lane because the final gate remains blocked.

## Validation

Run:

```bash
pnpm install --frozen-lockfile
pnpm exec prettier --check docs/RELEASE_OWNER_OUTREACH_MESSAGE_KIT.md docs/RELEASE_EVIDENCE_CONTROL_BOARD.md docs/RELEASE_EXTERNAL_OWNER_ACTION_QUEUE.md plans/463_OWNER_OUTREACH_MESSAGE_KIT.md
git diff --check
pnpm final-release:gate
pnpm lint
```
