# ExecPlan 464: Owner Status Digest

Status date: 2026-06-30

## Context

SearchLint 1.0 remains blocked by external owner evidence. The repository has a
control board, action queue, dispatch runbooks, and an outreach message kit, but
operators still need a short reusable status digest for daily issue comments and
owner check-ins.

This plan adds that digest and refreshes orchestration baselines to the latest
verified `main`. It does not create owner evidence and does not change release
readiness.

## Scope

- Add `docs/RELEASE_OWNER_STATUS_DIGEST.md`.
- Link the digest from the release control board.
- Link the digest from the external owner action queue.
- Link the digest from the outreach message kit.
- Refresh orchestration baselines to `1c94ca5400dc98ae456db6b34e0db9618a9fb0ab`
  and CI run `28464174357`.

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
- [x] `docs/RELEASE_OWNER_OUTREACH_MESSAGE_KIT.md`

## Acceptance Criteria

- The digest captures the current verified `main`, CI, final gate status,
  release readiness count, owner evidence count, missing evidence count, and
  forbidden actions.
- The digest lists P0 and P1 next owner actions without marking any lane
  complete.
- The digest links to the durable control board, action queue, and message kit.
- The control board, action queue, and message kit link the digest.
- Validation commands pass or documented blockers remain honest.

## Progress

- [x] Required reading completed.
- [x] Digest added.
- [x] Control board linked to digest.
- [x] External owner action queue linked to digest.
- [x] Outreach message kit linked to digest.
- [x] Validation run.

## Decision Log

- 2026-06-30: Keep this as an orchestration-only document. Status digests make
  owner follow-up easier, but the generated release reports and verifier
  commands remain authoritative.
- 2026-06-30: Keep all final release actions explicitly forbidden because
  `pnpm final-release:gate` remains blocked.

## Validation

Run:

```bash
pnpm install --frozen-lockfile
pnpm exec prettier --check docs/RELEASE_OWNER_STATUS_DIGEST.md docs/RELEASE_EVIDENCE_CONTROL_BOARD.md docs/RELEASE_EXTERNAL_OWNER_ACTION_QUEUE.md docs/RELEASE_OWNER_OUTREACH_MESSAGE_KIT.md plans/464_OWNER_STATUS_DIGEST.md
git diff --check
pnpm final-release:gate
pnpm lint
```
