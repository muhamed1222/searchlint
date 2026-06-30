# SearchLint 1.0 Release Evidence Control Board

Status date: 2026-06-30

This document is an orchestration board for the remaining SearchLint 1.0 release
evidence work. It does not approve SearchLint 1.0, does not replace real owner
evidence, and does not close any release gate.

## Last Verified Baseline

- Verified baseline commit: `ae5cd871ae85ca030e06906b1eedc8646b097555`
- Baseline CI: passed in GitHub Actions run
  `https://github.com/muhamed1222/searchlint/actions/runs/28462720725`
- Final release gate: `blocked`
- Release readiness: 522/599 done; 77 remaining
- Real owner evidence inputs: 0/60 present
- Missing evidence paths: 108
- `v1.0.0`: absent and must not be created yet

This baseline includes the GitHub-readable P1 owner dispatch runbook through
ExecPlan 461. `main` may advance as orchestration-only changes are merged.
Before using this board to close a release gate, rerun the affected verifier
plus `pnpm release:evidence-readiness` and `pnpm final-release:gate` from a
fresh checkout.

## Source Of Truth

Use these generated repository documents and reports for machine-readable
status:

- `docs/RELEASE_EVIDENCE_READINESS_SUMMARY.md`
- `docs/RELEASE_EVIDENCE_INTAKE_STATUS.md`
- `docs/RELEASE_OWNER_EVIDENCE_READINESS_INDEX.md`
- `docs/SEARCHLINT_1_0_FINAL_RELEASE_GATE.md`
- `docs/RELEASE_EXTERNAL_OWNER_ACTION_QUEUE.md`
- `reports/release-evidence-readiness-summary-report.json`
- `reports/release-evidence-intake-status-report.json`
- `reports/release-owner-evidence-readiness-report.json`
- `reports/final-release-gate-report.json`

The GitHub milestone is:

- `https://github.com/muhamed1222/searchlint/milestone/1`

## Issue Board

| Issue | Priority | Package                          | Status                                    | Packet                                                                                 | SHA-256                                                            | Next owner action                                                                                                                                               |
| ----- | -------- | -------------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `#19` | P0       | Reviewer and Rule Quality        | Waiting for external reviewers            | `/tmp/searchlint-reviewer-handoff/searchlint-blocker-review-packet.zip`                | `5a1a36d17aae0ec1ab4f3b6ca7511ecd5f02386418561f77c45e9380ff79b3cd` | Send packet to two independent reviewers, collect delivery evidence and reviewer JSON files, then run `pnpm rule-qa:review-delivery` and `pnpm rule-qa:review`. |
| `#20` | P0       | Governance and Legal             | Waiting for legal/owner approval          | `/tmp/searchlint-legal-review/searchlint-legal-review-packet.zip`                      | `4a912dbe1f63ff21b95ee79c4aca4766259bb652e9eea649f91b7c734b90d635` | Get sanitized `docs/legal-release-approval.json`, then run `pnpm legal:release-gate`.                                                                           |
| `#21` | P1       | npm and VS Code Publication      | Waiting for publication owner evidence    | `/tmp/searchlint-publication-review/searchlint-publication-packet.zip`                 | `f3d67f6b470f5e4bc3921218190bc4514e2ee6a80728fb5ef4e0339bdcc9b2ea` | Complete metadata, trusted publishing, registry, and Marketplace evidence without final 1.0.0 publication.                                                      |
| `#22` | P1       | Production Platform              | Waiting for deployed platform evidence    | `/tmp/searchlint-platform-review/searchlint-platform-packet.zip`                       | `2dd9fb9b54dedeba7fb7e19cea2d228c1a09d1d6af1efc22b90404f5638c8846` | Provide sanitized live API, dashboard, worker, database, storage, auth, observability, and backup/restore evidence.                                             |
| `#23` | P1       | Live Provider Acceptance         | Waiting for provider owner evidence       | `/tmp/searchlint-provider-review/searchlint-provider-packet.zip`                       | `48959ed07052c79b77e3d6c1c4c73b82f80608116c72ff2c015d0e581c88407d` | Provide dated live Google, Yandex, notifications, and billing/provider acceptance evidence.                                                                     |
| `#24` | P1       | Security, Accessibility, Website | Waiting for real review/deployed evidence | `/tmp/searchlint-security-review/searchlint-security-accessibility-website-packet.zip` | `62ad031de60de32960fafb84c7d06370ab7e9941efd33613766f5be7f142d156` | Provide DAST, pentest, OAuth vault reviewer, overlay accessibility reviewer, and deployed public website evidence.                                              |
| `#25` | P1       | Final Release                    | Waiting for upstream packages             | `/tmp/searchlint-final-release-review/searchlint-final-release-packet.zip`             | `c32ad203c57c507f86bc64f452b83e249c5b0125a99028e875521e5a21ba6889` | Keep blocked until `#19` through `#24` pass and `pnpm final-release:gate` passes from a fresh checkout.                                                         |

The consolidated local control packet is:

- `/tmp/searchlint-release-control/searchlint-release-control-packet.zip`
- SHA-256: `bf94e4b774b1322ff14fe0c66fa2479d19d9cd9aafd6b716de854ccfdf309585`

## Dispatch Packets

Ready-to-send owner instructions were prepared as local orchestration artifacts:

- GitHub-readable P0 dispatch runbook:
  `docs/RELEASE_P0_OWNER_DISPATCH_RUNBOOK.md`
- P0 dispatch packet:
  `/tmp/searchlint-p0-dispatch/searchlint-p0-dispatch-packet.zip`
- P0 dispatch SHA-256:
  `fad56d281077c24b8ce43df394232b6e6226a99039cc01ae732407132c2874cc`
- P1 dispatch packet:
  `/tmp/searchlint-p1-dispatch/searchlint-p1-dispatch-packet.zip`
- P1 dispatch SHA-256:
  `774c95b358fa4c2cd3f83f9a38332424ab4d9dcd0f4651c32ab2d521a0c96d9d`
- GitHub-readable P1 dispatch runbook:
  `docs/RELEASE_P1_OWNER_DISPATCH_RUNBOOK.md`
- External owner action queue: `docs/RELEASE_EXTERNAL_OWNER_ACTION_QUEUE.md`

These dispatch packets are not release evidence. They only reduce owner handoff
ambiguity.

## Priority Order

1. Complete `#19` and `#20` first. Reviewer sign-off and legal/governance
   approval are P0 blockers.
2. Complete `#22`, `#23`, and `#24` next. These require live deployment,
   provider, security, accessibility, and public website evidence.
3. Complete `#21` after owner-controlled package and Marketplace evidence
   exists, but before final publication.
4. Complete `#25` only after upstream evidence packages pass and
   `pnpm final-release:gate` passes from a fresh checkout.

## Forbidden Actions While Blocked

Do not perform these actions until `pnpm final-release:gate` passes:

- create Git tag `v1.0.0`;
- run final `npm publish`;
- run final `vsce publish`;
- release the public website as SearchLint 1.0;
- announce SearchLint 1.0.

## Validation After Evidence Arrives

After a real evidence PR is opened, run the dedicated verifier for the affected
package, then run:

```bash
pnpm release:evidence-readiness
pnpm final-release:gate
```

SearchLint 1.0 remains blocked until those commands prove the release is ready.
