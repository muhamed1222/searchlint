# ExecPlan 455: Release Evidence Control Board

## Purpose

The remaining SearchLint 1.0 release work is blocked on external reviewer,
legal, provider, deployment, publication, security, accessibility, and final
release evidence. The handoff packets and GitHub comments exist, but the
repository needs one versioned orchestration board that routes owners to the
correct issues, packets, checksums, and next actions without claiming release
approval.

## Scope

- Add `docs/RELEASE_EVIDENCE_CONTROL_BOARD.md`.
- Record the current release gate state, issue routing, packet checksums, owner
  actions, dispatch packets, priority order, and forbidden actions.
- Keep the board explicitly non-authorizing.

## Non-goals

- No release approval.
- No owner, reviewer, legal, provider, deployment, security, or publication
  evidence fabrication.
- No `v1.0.0` tag.
- No npm or VS Code publication.
- No package, source, CI, or lockfile changes.

## Required Reading

- [x] `AGENTS.md`
- [x] `SEARCHLINT_1_0_DEVELOPMENT_PLAN.md`
- [x] `docs/PRODUCT_SPEC.md`
- [x] `docs/ARCHITECTURE.md`
- [x] `docs/TECH_STACK.md`
- [x] `docs/DEFINITION_OF_DONE.md`
- [x] `docs/OPEN_DECISIONS.md`
- [x] `docs/SEARCHLINT_1_0_FINAL_RELEASE_GATE.md`
- [x] `docs/RELEASE_EVIDENCE_READINESS_SUMMARY.md`

## Acceptance Criteria

- The control board lists `#19` through `#25` with priority, status, packet
  path, checksum, and next owner action.
- The board points to the current machine-readable release status documents and
  reports.
- The board explicitly states that packets and dispatch notes are not release
  evidence.
- The board preserves the final-release forbidden actions while the gate is
  blocked.
- Formatting and lint validation pass.

## Progress

- [x] Required reading completed.
- [x] Control board added.
- [x] ExecPlan added.

## Decision Log

- 2026-06-30: Keep local packet paths in the board because the release
  orchestration packets are local handoff artifacts, not repository evidence.
- 2026-06-30: Do not add generated reports or external evidence files in this
  change. The board is a routing document only.

## Evidence

- `docs/RELEASE_EVIDENCE_CONTROL_BOARD.md`
- `pnpm exec prettier --check docs/RELEASE_EVIDENCE_CONTROL_BOARD.md plans/455_RELEASE_EVIDENCE_CONTROL_BOARD.md`
- `pnpm lint`
