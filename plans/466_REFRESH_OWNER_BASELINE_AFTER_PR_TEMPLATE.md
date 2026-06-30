# ExecPlan 466: Refresh Owner Baseline After PR Template

Status date: 2026-06-30

## Context

SearchLint 1.0 remains externally blocked by missing owner evidence. PR #38
added `.github/PULL_REQUEST_TEMPLATE/release-owner-evidence.md` and merged to
`main` at `32220f61d9e02613b131b97d0a72ba412133ffc8` with CI run `28465399162`
passing.

Several operator-facing owner evidence docs still referenced the previous
orchestration baseline. This plan refreshes those baseline references so owner
handoffs use the current verified `main` commit and CI run.

## Scope

- Refresh the verified baseline in `docs/RELEASE_EVIDENCE_CONTROL_BOARD.md`.
- Refresh the baseline in `docs/RELEASE_EXTERNAL_OWNER_ACTION_QUEUE.md`.
- Refresh the baseline in `docs/RELEASE_OWNER_OUTREACH_MESSAGE_KIT.md`.
- Refresh the baseline and reusable digest text in
  `docs/RELEASE_OWNER_STATUS_DIGEST.md`.

## Non-Goals

- Do not create release evidence.
- Do not add owner approval JSON.
- Do not change verifier logic.
- Do not change release readiness counts.
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
- [x] `docs/RELEASE_OWNER_OUTREACH_MESSAGE_KIT.md`
- [x] `docs/RELEASE_OWNER_STATUS_DIGEST.md`

## Acceptance Criteria

- Operator-facing release docs cite `32220f61d9e02613b131b97d0a72ba412133ffc8`
  as the current verified orchestration baseline.
- Operator-facing release docs cite GitHub Actions run `28465399162` as the
  current passing baseline CI run.
- The refreshed docs continue to state that SearchLint 1.0 is blocked and that
  forbidden final release actions must not be taken.
- The change is documentation-only and does not alter release verifiers.

## Progress

- [x] Required reading completed.
- [x] Release evidence control board baseline refreshed.
- [x] External owner action queue baseline refreshed.
- [x] Owner outreach message kit baseline refreshed.
- [x] Owner status digest baseline refreshed.
- [x] Validation run.

## Decision Log

- 2026-06-30: Keep this as a baseline-only refresh. The stale historical
  baseline in prior ExecPlans remains historical context and is not rewritten.

## Validation

Run:

```bash
pnpm exec prettier --check docs/RELEASE_EVIDENCE_CONTROL_BOARD.md docs/RELEASE_EXTERNAL_OWNER_ACTION_QUEUE.md docs/RELEASE_OWNER_OUTREACH_MESSAGE_KIT.md docs/RELEASE_OWNER_STATUS_DIGEST.md plans/466_REFRESH_OWNER_BASELINE_AFTER_PR_TEMPLATE.md
git diff --check
pnpm final-release:gate
pnpm lint
```
