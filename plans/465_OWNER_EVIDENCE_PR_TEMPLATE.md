# ExecPlan 465: Owner Evidence PR Template

Status date: 2026-06-30

## Context

SearchLint 1.0 remains externally blocked by missing owner evidence. The
repository has owner-facing runbooks, a control board, an action queue, an
outreach message kit, and a status digest, but GitHub does not yet provide a
dedicated PR template for submitting real owner evidence safely.

This plan adds that PR template. It does not create evidence, approve release,
or change verifier behavior.

## Scope

- Add `.github/PULL_REQUEST_TEMPLATE/release-owner-evidence.md`.
- Link the template from `docs/RELEASE_OWNER_STATUS_DIGEST.md`.
- Link the template from `docs/RELEASE_EXTERNAL_OWNER_ACTION_QUEUE.md`.

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
- [x] `docs/RELEASE_OWNER_STATUS_DIGEST.md`
- [x] `docs/RELEASE_EXTERNAL_OWNER_ACTION_QUEUE.md`

## Acceptance Criteria

- The PR template states that evidence PRs do not approve SearchLint 1.0 by
  themselves.
- The PR template captures issue, package, owner lane, evidence paths, source,
  date, environment, and related owner guide.
- The PR template requires a sanitization checklist that rejects secrets,
  private data, raw provider payloads, and placeholder values.
- The PR template lists first verifier commands for issues `#19` through `#25`.
- The PR template repeats the forbidden final release actions while
  `pnpm final-release:gate` is blocked.
- Release orchestration docs link the template.

## Progress

- [x] Required reading completed.
- [x] PR template added.
- [x] Digest linked to PR template.
- [x] External owner action queue linked to PR template.
- [x] Validation run.

## Decision Log

- 2026-06-30: Use a named PR template under
  `.github/PULL_REQUEST_TEMPLATE/release-owner-evidence.md` so normal code PRs
  are not forced through evidence-specific fields.
- 2026-06-30: Keep the template procedural only. It must route evidence through
  existing verifiers rather than declaring any lane complete.

## Validation

Run:

```bash
pnpm install --frozen-lockfile
pnpm exec prettier --check .github/PULL_REQUEST_TEMPLATE/release-owner-evidence.md docs/RELEASE_OWNER_STATUS_DIGEST.md docs/RELEASE_EXTERNAL_OWNER_ACTION_QUEUE.md plans/465_OWNER_EVIDENCE_PR_TEMPLATE.md
git diff --check
pnpm final-release:gate
pnpm lint
```
