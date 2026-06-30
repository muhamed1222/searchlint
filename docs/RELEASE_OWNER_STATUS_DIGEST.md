# SearchLint 1.0 Owner Status Digest

Status date: 2026-06-30

This digest is the short operator-facing status format for SearchLint 1.0 owner
evidence collection. It is meant for issue comments, handoff messages, and daily
release check-ins. It does not create evidence, approve release, or replace any
verifier.

## Current Verified Baseline

- Baseline commit: `1c94ca5400dc98ae456db6b34e0db9618a9fb0ab`
- Baseline CI: passed in GitHub Actions run
  `https://github.com/muhamed1222/searchlint/actions/runs/28464174357`
- Final release gate: `BLOCKED`
- Release readiness: 522/599 done; 77 remaining
- Real owner evidence inputs: 0/60 present
- Owner evidence files present: 0/51
- Missing evidence paths: 108
- Final gate blockers: 15/20 final gates blocked or missing
- `v1.0.0`: absent and must not be created yet

Authoritative status commands:

```bash
pnpm release:evidence-readiness
pnpm final-release:gate
```

## Digest To Send

```text
SearchLint 1.0 release status:

- main: 1c94ca5400dc98ae456db6b34e0db9618a9fb0ab
- CI: https://github.com/muhamed1222/searchlint/actions/runs/28464174357
- final release gate: BLOCKED
- readiness: 522/599 done, 77 remaining
- owner evidence: 0/60 owner inputs present, 0/51 owner evidence files present
- missing evidence paths: 108
- final blockers: 15/20 final gates blocked or missing
- v1.0.0: absent and must not be created yet

Current priority:

1. Issue #19: collect reviewer delivery evidence and two independent reviewer
   JSON files.
2. Issue #20: collect sanitized legal/accountable-owner approval JSON.
3. Issue #24: route OAuth vault security review, overlay accessibility review,
   penetration-test summary, DAST, and deployed website evidence.
4. Issue #21, #22, and #23: collect publication, platform, provider, and
   billing evidence without final release actions.
5. Issue #25: keep final release blocked until issues #19 through #24 pass and
   pnpm final-release:gate passes from a fresh checkout.

Use:

- docs/RELEASE_EVIDENCE_CONTROL_BOARD.md
- docs/RELEASE_EXTERNAL_OWNER_ACTION_QUEUE.md
- docs/RELEASE_OWNER_OUTREACH_MESSAGE_KIT.md

Do not create v1.0.0, run final npm publish, run final vsce publish, publish
the public website as SearchLint 1.0, or announce SearchLint 1.0 while
pnpm final-release:gate remains blocked.
```

## P0 Digest

```text
P0 release blockers:

- #19 Reviewer and Rule Quality:
  - required first file: docs/reviews/blocker-benchmark/DELIVERY_EVIDENCE.json
  - required reviewer files:
    docs/reviews/blocker-benchmark/reviewer-1.review.json
    docs/reviews/blocker-benchmark/reviewer-2.review.json
  - first verifier: pnpm rule-qa:review-delivery

- #20 Governance and Legal:
  - required file: docs/legal-release-approval.json
  - first verifier: pnpm legal:release-gate

P0 is not complete until the real evidence files exist, are sanitized, and the
dedicated verifiers plus pnpm release:evidence-readiness and
pnpm final-release:gate have been rerun.
```

## P1 Digest

```text
P1 release blockers:

- #24 Security, Accessibility, Website:
  - docs/reviews/oauth-vault-security/reviewer-1.review.json
  - docs/reviews/oauth-vault-security/reviewer-2.review.json
  - docs/reviews/overlay-accessibility/reviewer.review.json
  - docs/reviews/penetration-test/report-summary.json
  - first verifiers:
    pnpm oauth-vault:security-review
    pnpm overlay:manual-a11y-review
    pnpm security:pentest

- #21 npm and VS Code Publication:
  - start with:
    docs/release-owner-evidence/7-vs-code-i-lsp-nastroit-publisher-account.json
  - first verifier: pnpm vscode:update-e2e

- #22 Production Platform:
  - start with: docs/live-backup-restore-drill.json
  - first verifier: pnpm backup:restore-live-gate

- #23 Live Provider Acceptance:
  - start with:
    docs/release-owner-evidence/18-google-search-console-provesti-live-acceptance-na-realnom-saite.json
  - billing start:
    docs/release-owner-evidence/25-billing-provesti-live-stripe-acceptance.json
  - first verifiers:
    pnpm google:gsc:acceptance
    pnpm billing:live-stripe-final-acceptance-packet

- #25 Final Release:
  - keep blocked until issues #19 through #24 pass.
  - do not create v1.0.0 or final publications before pnpm final-release:gate
    passes.
```

## Update Procedure

When posting a fresh digest:

1. Pull or clone current `main`.
2. Run `pnpm final-release:gate`.
3. Confirm the latest `main` CI run is completed and successful.
4. Copy the digest text above and replace baseline values if they changed.
5. Link any newly returned evidence files and the verifier output that proves
   them.

If a real evidence file arrives, do not mark the lane complete from the digest.
Run the lane-specific verifier first, then rerun:

```bash
pnpm release:evidence-readiness
pnpm final-release:gate
```

## Non-Claims

- This digest is not release evidence.
- This digest is not reviewer sign-off.
- This digest is not legal advice or legal approval.
- This digest is not provider, platform, security, accessibility, publication,
  or final release evidence.
- This digest does not change SearchLint 1.0 release scope.
- SearchLint 1.0 remains blocked while required owner evidence is missing.
