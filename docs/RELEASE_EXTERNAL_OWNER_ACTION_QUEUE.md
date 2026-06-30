# SearchLint 1.0 External Owner Action Queue

Status date: 2026-06-30

This queue is the working order for collecting the remaining external owner
evidence. It does not create evidence, does not replace generated release
status, and does not approve SearchLint 1.0.

## Current Baseline

- Baseline commit: `1c94ca5400dc98ae456db6b34e0db9618a9fb0ab`
- Baseline CI: passed in GitHub Actions run
  `https://github.com/muhamed1222/searchlint/actions/runs/28464174357`
- Final release gate: `BLOCKED`
- Release readiness: 522/599 done; 77 remaining
- Real owner evidence inputs: 0/60 present
- Missing evidence paths: 108
- `v1.0.0`: absent and must not be created yet

Authoritative generated status remains:

- `docs/RELEASE_EVIDENCE_READINESS_SUMMARY.md`
- `docs/RELEASE_OWNER_EVIDENCE_PACKAGE_STATUS.md`
- `docs/RELEASE_OWNER_EVIDENCE_RUNBOOK.md`
- `docs/RELEASE_OWNER_EVIDENCE_READINESS_INDEX.md`
- `docs/RELEASE_MISSING_EVIDENCE_TEMPLATE_INDEX.md`
- `docs/SEARCHLINT_1_0_FINAL_RELEASE_GATE.md`
- `docs/RELEASE_OWNER_OUTREACH_MESSAGE_KIT.md`
- `docs/RELEASE_OWNER_STATUS_DIGEST.md`

After any real evidence lands, rerun the affected verifier and then rerun:

```bash
pnpm release:evidence-readiness
pnpm final-release:gate
```

## Queue Policy

Work in this order:

1. P0 owner inputs that unblock decision quality and legal permission.
2. External reviews that can run in parallel with owner-controlled platform
   work.
3. Owner-controlled publication, deployment, provider, and security packages.
4. Final release only after all upstream packages pass.

Do not copy example values into real evidence. Do not commit secrets, tokens,
credentials, cookies, private keys, private registry URLs with credentials,
database URLs, customer data, or raw provider payloads.

## Action Queue

| Order | Issue | Owner lane                  | Package                            | Missing inputs | First artifact to obtain                                                                                             | First verifier                                     | Status                        |
| ----: | ----- | --------------------------- | ---------------------------------- | -------------: | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ----------------------------- |
|     1 | `#19` | Independent reviewers       | Reviewer And Rule Quality          |              3 | `docs/reviews/blocker-benchmark/DELIVERY_EVIDENCE.json`                                                              | `pnpm rule-qa:review-delivery`                     | Waiting for real reviewers    |
|     2 | `#20` | Legal or accountable owner  | Governance And Legal               |              1 | `docs/legal-release-approval.json`                                                                                   | `pnpm legal:release-gate`                          | Waiting for legal approval    |
|     3 | `#24` | Security reviewers          | Security Accessibility And Website |              8 | `docs/reviews/oauth-vault-security/reviewer-1.review.json` and `reviewer-2.review.json`                              | `pnpm oauth-vault:security-review`                 | Waiting for external review   |
|     4 | `#24` | Accessibility reviewer      | Security Accessibility And Website |              8 | `docs/reviews/overlay-accessibility/reviewer.review.json`                                                            | `pnpm overlay:manual-a11y-review`                  | Waiting for external review   |
|     5 | `#24` | Security or AppSec owner    | Security Accessibility And Website |              8 | `docs/reviews/penetration-test/report-summary.json`                                                                  | `pnpm security:pentest`                            | Waiting for external review   |
|     6 | `#21` | Publication owner           | npm And VS Code Publication        |              7 | `docs/release-owner-evidence/7-vs-code-i-lsp-nastroit-publisher-account.json`                                        | `pnpm vscode:update-e2e`                           | Waiting for publication owner |
|     7 | `#22` | Platform or DevOps owner    | Production Platform                |             21 | `docs/live-backup-restore-drill.json`                                                                                | `pnpm backup:restore-live-gate`                    | Waiting for deployed evidence |
|     8 | `#23` | Provider integrations owner | Live Provider Acceptance           |             17 | `docs/release-owner-evidence/18-google-search-console-provesti-live-acceptance-na-realnom-saite.json`                | `pnpm google:gsc:acceptance`                       | Waiting for provider evidence |
|     9 | `#23` | Billing owner               | Live Provider Acceptance           |             17 | `docs/release-owner-evidence/25-billing-provesti-live-stripe-acceptance.json`                                        | `pnpm billing:live-stripe-final-acceptance-packet` | Waiting for billing evidence  |
|    10 | `#25` | Release owner               | Final Release                      |              3 | `docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-release-candidate-proshel-polnuyu-matricu.json` | `pnpm final-release:gate`                          | Blocked by upstream packages  |

The full file list for every package is in
`docs/RELEASE_OWNER_EVIDENCE_PACKAGE_STATUS.md`. Use this queue to start work,
not to decide completion.

## Immediate Dispatch Packets

Ready-to-send outreach text for all lanes is in
`docs/RELEASE_OWNER_OUTREACH_MESSAGE_KIT.md`.

The short reusable owner follow-up digest is in
`docs/RELEASE_OWNER_STATUS_DIGEST.md`.

### Reviewer Dispatch

Use issue `#19` and `docs/RELEASE_P0_OWNER_DISPATCH_RUNBOOK.md`.

Required packet source:

- `docs/reviews/blocker-benchmark/HANDOFF_MANIFEST.json`
- `docs/reviews/blocker-benchmark/BENCHMARK_CASE_INDEX.json`
- `docs/reviews/blocker-benchmark/README.md`
- `docs/reviews/blocker-benchmark/REVIEW_INSTRUCTIONS.md`
- `docs/reviews/blocker-benchmark/REVIEW_FORM_TEMPLATE.md`
- `docs/reviews/blocker-benchmark/DELIVERY_EVIDENCE.example.json`
- `docs/reviews/blocker-benchmark/reviewer-1.review.example.json`
- `docs/reviews/blocker-benchmark/reviewer-2.review.example.json`

Expected returned files:

- `docs/reviews/blocker-benchmark/DELIVERY_EVIDENCE.json`
- `docs/reviews/blocker-benchmark/reviewer-1.review.json`
- `docs/reviews/blocker-benchmark/reviewer-2.review.json`

### Legal Dispatch

Use issue `#20`, `docs/RELEASE_P0_OWNER_DISPATCH_RUNBOOK.md`, and
`docs/LEGAL_RELEASE_APPROVAL_OWNER_INPUT_GUIDE.md`.

Expected returned file:

- `docs/legal-release-approval.json`

### Security Review Dispatch

Use issue `#24`, `docs/RELEASE_P1_OWNER_DISPATCH_RUNBOOK.md`, and
`docs/SECURITY_PRIVACY_RELEASE_GATE.md`.

Expected returned files:

- `docs/reviews/oauth-vault-security/reviewer-1.review.json`
- `docs/reviews/oauth-vault-security/reviewer-2.review.json`
- `docs/reviews/overlay-accessibility/reviewer.review.json`
- `docs/reviews/penetration-test/report-summary.json`

### Publication Dispatch

Use issue `#21`, `docs/RELEASE_P1_OWNER_DISPATCH_RUNBOOK.md`, and
`docs/PUBLICATION_PACKAGE_OWNER_INPUT_GUIDE.md`.

Start with owner-controlled publisher and metadata evidence before final
publication evidence. Final npm publication, final VS Code publication, final
`1.0.0` package versions, and `v1.0.0` must wait until the final release gate
passes.

## Completion Rule

An item is complete only when:

- the real evidence file exists in the required path;
- the file is sanitized and contains no forbidden secrets;
- its dedicated verifier passes;
- `pnpm release:evidence-readiness` reflects the new evidence;
- `pnpm final-release:gate` is rerun and either remains honestly blocked or
  passes after every upstream gate is complete.

## Forbidden Actions While Blocked

Do not perform these actions until `pnpm final-release:gate` passes from a fresh
checkout:

- create Git tag `v1.0.0`;
- run final `npm publish`;
- run final `vsce publish`;
- release the public website as SearchLint 1.0;
- announce SearchLint 1.0.

## Non-Claims

- This queue is not release evidence.
- This queue is not reviewer sign-off.
- This queue is not legal advice or legal approval.
- This queue is not provider, platform, security, publication, or final release
  evidence.
- Example files and templates do not count as real owner inputs.
- SearchLint 1.0 remains blocked while required owner evidence is missing.
