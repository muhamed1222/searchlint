# SearchLint 1.0 P0 Owner Dispatch Runbook

Status date: 2026-06-30

This runbook is the owner-facing dispatch entry point for the two P0 external
evidence packages that currently block SearchLint 1.0. It does not create
reviewer sign-off, legal approval, or release approval.

## Current Baseline

- Baseline commit: `ae5cd871ae85ca030e06906b1eedc8646b097555`
- Baseline CI: passed in GitHub Actions run
  `https://github.com/muhamed1222/searchlint/actions/runs/28462720725`
- Final release gate: `BLOCKED`
- Release readiness: 522/599 done; 77 remaining
- Real owner evidence inputs: 0/60 present
- Missing evidence paths: 108
- `v1.0.0`: absent and must not be created yet

Before claiming that either P0 gate is complete, rerun the affected verifier and
then rerun:

```bash
pnpm release:evidence-readiness
pnpm final-release:gate
```

## P0 Scope

| Issue | Package                   | Current status                   | Required owner outcome                            |
| ----- | ------------------------- | -------------------------------- | ------------------------------------------------- |
| `#19` | Reviewer and Rule Quality | Waiting for external reviewers   | Delivery evidence and two reviewer JSON files     |
| `#20` | Governance and Legal      | Waiting for legal/owner approval | Sanitized legal release approval JSON and reports |

GitHub issue links:

- `https://github.com/muhamed1222/searchlint/issues/19`
- `https://github.com/muhamed1222/searchlint/issues/20`

## Dispatch Rule

Prefer the repository files listed below as the durable source of truth. Local
zip packets can be used when available, but they are not release evidence and
are not accessible to all GitHub readers.

Local P0 orchestration artifacts:

- Reviewer packet:
  `/tmp/searchlint-reviewer-handoff/searchlint-blocker-review-packet.zip`
- Reviewer packet SHA-256:
  `5a1a36d17aae0ec1ab4f3b6ca7511ecd5f02386418561f77c45e9380ff79b3cd`
- Legal packet:
  `/tmp/searchlint-legal-review/searchlint-legal-review-packet.zip`
- Legal packet SHA-256:
  `4a912dbe1f63ff21b95ee79c4aca4766259bb652e9eea649f91b7c734b90d635`
- Consolidated P0 dispatch packet:
  `/tmp/searchlint-p0-dispatch/searchlint-p0-dispatch-packet.zip`
- Consolidated P0 dispatch SHA-256:
  `fad56d281077c24b8ce43df394232b6e6226a99039cc01ae732407132c2874cc`

## Issue 19: Reviewer And Rule Quality

Owner guide:

- `docs/REVIEWER_RULE_QUALITY_OWNER_INPUT_GUIDE.md`

Reviewer packet files:

- `docs/reviews/blocker-benchmark/HANDOFF_MANIFEST.json`
- `docs/reviews/blocker-benchmark/BENCHMARK_CASE_INDEX.json`
- `docs/reviews/blocker-benchmark/README.md`
- `docs/reviews/blocker-benchmark/REVIEW_INSTRUCTIONS.md`
- `docs/reviews/blocker-benchmark/REVIEW_FORM_TEMPLATE.md`
- `docs/reviews/blocker-benchmark/ADJUDICATION_LOG.md`
- `docs/reviews/blocker-benchmark/REVIEW_STATUS.md`
- `docs/reviews/blocker-benchmark/reviewer-1.review.example.json`
- `docs/reviews/blocker-benchmark/reviewer-2.review.example.json`
- `docs/reviews/blocker-benchmark/DELIVERY_EVIDENCE.example.json`

Required real evidence files:

- `docs/reviews/blocker-benchmark/DELIVERY_EVIDENCE.json`
- `docs/reviews/blocker-benchmark/reviewer-1.review.json`
- `docs/reviews/blocker-benchmark/reviewer-2.review.json`

Owner steps:

1. Send the reviewer packet files to two independent reviewers.
2. Create `DELIVERY_EVIDENCE.json` from the example only after real delivery.
3. Collect `reviewer-1.review.json` and `reviewer-2.review.json` from the
   reviewers.
4. Confirm no example-only signed statements or placeholder reviewer identities
   remain.
5. Run the reviewer validation commands.

Validation commands:

```bash
pnpm rule-qa:review-delivery
pnpm rule-qa:review
pnpm release:reviewer-rule-quality-package
pnpm release:evidence-readiness
pnpm final-release:gate
```

Reviewer dispatch message:

```text
Please independently review the SearchLint blocker benchmark packet for OD-023.
Use the repository packet files under docs/reviews/blocker-benchmark/, complete
the assigned review JSON file, and do not use training fixtures or example
signed statements as release evidence.
```

## Issue 20: Governance And Legal

Owner guide:

- `docs/LEGAL_RELEASE_APPROVAL_OWNER_INPUT_GUIDE.md`

Review materials:

- `LICENSE`
- `NOTICE`
- `CONTRIBUTING.md`
- `DCO.md`
- `SECURITY.md`
- `docs/TRADEMARK_POLICY_DRAFT.md`
- `docs/RELEASE_GOVERNANCE.md`
- `docs/PACKAGE_PUBLIC_PRIVATE_MATRIX.md`
- `docs/PUBLIC_PRIVATE_REPOSITORY_BOUNDARY_PLAN.md`
- `docs/PACKAGE_PUBLICATION_READINESS.md`
- `docs/PACKAGE_DOCUMENTATION.md`
- `docs/VSCODE_LSP_USAGE.md`
- `docs/PUBLIC_WEBSITE_ONBOARDING.md`
- `docs/ONBOARDING_GUIDE.md`

Template:

- `docs/legal-release-approval.example.json`

Required real evidence file:

- `docs/legal-release-approval.json`

Owner steps:

1. Send the review materials and required approval scopes to qualified legal
   counsel or the accountable owner.
2. Create `docs/legal-release-approval.json` from the example only after the
   legal review is complete.
3. Replace every example value with the real reviewer identity, role, timestamp,
   approval ID, approval answers, and signed statement.
4. Leave `requiredChanges` empty only after all requested legal changes are
   resolved.
5. Run the legal validation commands.

Validation commands:

```bash
pnpm legal:release-gate
pnpm release:governance-legal-package
pnpm release:evidence-readiness
pnpm final-release:gate
```

Legal dispatch message:

```text
Please review the SearchLint 1.0 public/local package scope, closed
commercial-cloud boundary, licensing, trademark, contribution, security,
Marketplace, and public website materials listed in
docs/LEGAL_RELEASE_APPROVAL_OWNER_INPUT_GUIDE.md. Only return
docs/legal-release-approval.json after the review is complete and all required
answers are actually approved.
```

## Forbidden Actions While P0 Is Blocked

Do not perform these actions until the P0 gates pass and the final release gate
passes from a fresh checkout:

- create Git tag `v1.0.0`;
- run final `npm publish`;
- run final `vsce publish`;
- release the public website as SearchLint 1.0;
- announce SearchLint 1.0.

## Non-Claims

- This runbook is not reviewer sign-off.
- This runbook is not legal advice.
- This runbook is not legal approval.
- Local zip packet paths are orchestration references, not release evidence.
- Example files are templates only.
- SearchLint 1.0 remains blocked while required P0 evidence is missing.
