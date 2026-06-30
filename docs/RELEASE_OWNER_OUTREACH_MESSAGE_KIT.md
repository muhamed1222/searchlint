# SearchLint 1.0 Owner Outreach Message Kit

Status date: 2026-06-30

This kit provides ready-to-send outreach text for the external owner evidence
lanes that currently block SearchLint 1.0. It does not create evidence, does not
approve release, and does not replace the repository verifier commands.

## Current Baseline

- Baseline commit: `5b088433aace4c935516ee365d4e06559207ce68`
- Baseline CI: passed in GitHub Actions run
  `https://github.com/muhamed1222/searchlint/actions/runs/28463386901`
- Final release gate: `BLOCKED`
- Release readiness: 522/599 done; 77 remaining
- Real owner evidence inputs: 0/60 present
- Missing evidence paths: 108
- `v1.0.0`: absent and must not be created yet

Before claiming that any lane is complete, run the dedicated verifier for that
lane and then rerun:

```bash
pnpm release:evidence-readiness
pnpm final-release:gate
```

## Sending Rules

- Send only sanitized review packets, repository links, and public-safe
  instructions.
- Do not request or accept secrets, tokens, credentials, cookies, private keys,
  database URLs, raw customer data, or raw provider payloads in issue comments.
- Ask owners to return machine-readable JSON at the exact required evidence
  paths.
- Treat example files as templates only.
- Keep final npm publication, final VS Code publication, public 1.0 launch,
  public announcement, and `v1.0.0` blocked until `pnpm final-release:gate`
  passes from a fresh checkout.

## P0 Reviewer Outreach For Issue 19

Send to each independent reviewer:

```text
Subject: SearchLint 1.0 independent blocker benchmark review

Please independently review the SearchLint blocker benchmark packet for the
SearchLint 1.0 release gate.

Repository issue: https://github.com/muhamed1222/searchlint/issues/19
Owner guide: docs/REVIEWER_RULE_QUALITY_OWNER_INPUT_GUIDE.md
Dispatch runbook: docs/RELEASE_P0_OWNER_DISPATCH_RUNBOOK.md

Please use the files under docs/reviews/blocker-benchmark/ and return only the
assigned sanitized review JSON:

- docs/reviews/blocker-benchmark/reviewer-1.review.json
- docs/reviews/blocker-benchmark/reviewer-2.review.json

Do not use example signed statements as release evidence. Do not include
secrets or private customer data. The review is complete only after the
repository verifier commands pass.
```

Send to the owner routing the reviewer packet:

```text
Please send the reviewer packet to two independent reviewers and record real
delivery evidence at:

- docs/reviews/blocker-benchmark/DELIVERY_EVIDENCE.json

Use docs/reviews/blocker-benchmark/DELIVERY_EVIDENCE.example.json only as a
template. After the reviewer JSON files are returned, run:

pnpm rule-qa:review-delivery
pnpm rule-qa:review
pnpm release:reviewer-rule-quality-package
pnpm release:evidence-readiness
pnpm final-release:gate
```

## P0 Legal Outreach For Issue 20

Send to counsel or accountable owner:

```text
Subject: SearchLint 1.0 legal and governance release approval review

Please review the SearchLint 1.0 public/local package scope, closed
commercial-cloud boundary, licensing, trademark, contribution, security,
Marketplace, and public website materials.

Repository issue: https://github.com/muhamed1222/searchlint/issues/20
Owner guide: docs/LEGAL_RELEASE_APPROVAL_OWNER_INPUT_GUIDE.md
Dispatch runbook: docs/RELEASE_P0_OWNER_DISPATCH_RUNBOOK.md

Required returned file:

- docs/legal-release-approval.json

Please return the JSON only after the review is complete and all required
answers are actually approved. Leave requiredChanges empty only if every
requested change has been resolved. Do not include privileged legal analysis,
secrets, credentials, customer data, or private provider payloads in the
repository.
```

Validation after the file is committed:

```bash
pnpm legal:release-gate
pnpm release:governance-legal-package
pnpm release:evidence-readiness
pnpm final-release:gate
```

## Security And Accessibility Outreach For Issue 24

Send to OAuth vault security reviewers:

```text
Subject: SearchLint 1.0 OAuth vault external security review

Please complete an external security review for the SearchLint OAuth vault
release gate.

Repository issue: https://github.com/muhamed1222/searchlint/issues/24
Supporting doc: docs/SECURITY_PRIVACY_RELEASE_GATE.md
Dispatch runbook: docs/RELEASE_P1_OWNER_DISPATCH_RUNBOOK.md

Required returned files:

- docs/reviews/oauth-vault-security/reviewer-1.review.json
- docs/reviews/oauth-vault-security/reviewer-2.review.json

Return sanitized machine-readable review JSON only. Do not include secrets,
tokens, credentials, cookies, private keys, customer data, or raw provider
payloads.
```

Send to accessibility reviewer:

```text
Subject: SearchLint 1.0 overlay manual accessibility review

Please complete the manual accessibility review for the SearchLint development
overlay.

Repository issue: https://github.com/muhamed1222/searchlint/issues/24
Supporting doc: docs/SECURITY_PRIVACY_RELEASE_GATE.md
Dispatch runbook: docs/RELEASE_P1_OWNER_DISPATCH_RUNBOOK.md

Required returned file:

- docs/reviews/overlay-accessibility/reviewer.review.json

Return sanitized machine-readable review JSON only. Include tested environment,
assistive technology coverage, findings, and final status.
```

Send to AppSec or penetration-test owner:

```text
Subject: SearchLint 1.0 deployed target penetration-test summary

Please provide the sanitized penetration-test summary required for SearchLint
1.0 release readiness.

Repository issue: https://github.com/muhamed1222/searchlint/issues/24
Supporting doc: docs/SECURITY_PRIVACY_RELEASE_GATE.md
Dispatch runbook: docs/RELEASE_P1_OWNER_DISPATCH_RUNBOOK.md

Required returned file:

- docs/reviews/penetration-test/report-summary.json

Return only the sanitized summary and remediation status. Do not commit exploit
payloads, secrets, raw scan data containing credentials, customer data, or
private infrastructure details.
```

Validation after issue 24 evidence is committed:

```bash
pnpm security:dast
pnpm security:pentest
pnpm oauth-vault:security-review
pnpm overlay:manual-a11y-review
pnpm website:acceptance
pnpm release:evidence-readiness
pnpm final-release:gate
```

## Publication Owner Outreach For Issue 21

Send to publication owner:

```text
Subject: SearchLint 1.0 npm and VS Code publication readiness evidence

Please provide the owner-controlled publication readiness evidence for
SearchLint 1.0 without performing final 1.0 publication yet.

Repository issue: https://github.com/muhamed1222/searchlint/issues/21
Owner guide: docs/PUBLICATION_PACKAGE_OWNER_INPUT_GUIDE.md
Dispatch runbook: docs/RELEASE_P1_OWNER_DISPATCH_RUNBOOK.md

Start with:

- docs/release-owner-evidence/7-vs-code-i-lsp-nastroit-publisher-account.json

Then complete the remaining publication evidence listed in
docs/RELEASE_OWNER_EVIDENCE_PACKAGE_STATUS.md.

Do not create final 1.0.0 package versions, run final npm publish, run final
vsce publish, or create v1.0.0 until pnpm final-release:gate passes from a
fresh checkout.
```

Validation after the publication evidence is committed:

```bash
pnpm release:publication-package:owner-guide
pnpm package:metadata-approval
pnpm package:beta-publication-gate
pnpm package:registry-install
pnpm vscode:update-e2e
pnpm release:publication-package
pnpm release:evidence-readiness
pnpm final-release:gate
```

## Platform Owner Outreach For Issue 22

Send to platform or DevOps owner:

```text
Subject: SearchLint 1.0 production platform evidence package

Please provide the sanitized live production platform evidence required for the
SearchLint 1.0 release gate.

Repository issue: https://github.com/muhamed1222/searchlint/issues/22
Dispatch runbook: docs/RELEASE_P1_OWNER_DISPATCH_RUNBOOK.md
Evidence index: docs/RELEASE_OWNER_EVIDENCE_PACKAGE_STATUS.md

Start with:

- docs/live-backup-restore-drill.json

Then complete the live API, dashboard, worker, PostgreSQL/RDS, object storage,
auth/RBAC, OAuth vault, observability, and agency/client portal evidence listed
for the Production Platform package.

Return sanitized machine-readable JSON only. Do not include credentials,
database URLs, raw customer data, provider secrets, private keys, or internal
payloads that cannot be committed.
```

Validation after platform evidence is committed:

```bash
pnpm backup:restore-live-gate
pnpm crawler:acceptance
pnpm verify:postgres
pnpm object-storage:acceptance
pnpm api:acceptance
pnpm workers:acceptance
pnpm auth:acceptance
pnpm oauth-vault:acceptance
pnpm dashboard:production-e2e
pnpm observability:acceptance
pnpm agency:acceptance
pnpm release:production-platform-package
pnpm release:evidence-readiness
pnpm final-release:gate
```

## Provider Owner Outreach For Issue 23

Send to provider integrations owner:

```text
Subject: SearchLint 1.0 live provider acceptance evidence

Please provide dated live provider acceptance evidence for the SearchLint 1.0
release gate.

Repository issue: https://github.com/muhamed1222/searchlint/issues/23
Dispatch runbook: docs/RELEASE_P1_OWNER_DISPATCH_RUNBOOK.md
Evidence index: docs/RELEASE_OWNER_EVIDENCE_PACKAGE_STATUS.md

Start with:

- docs/release-owner-evidence/18-google-search-console-provesti-live-acceptance-na-realnom-saite.json

Then complete the live Google Search Console, PageSpeed/CrUX, Yandex Webmaster,
Yandex Metrica, notifications, billing-provider, and agency-provider evidence
listed for the Live Provider Acceptance package.

Return sanitized machine-readable JSON only. Do not include OAuth tokens,
provider secrets, cookies, private API payloads, customer data, or screenshots
with sensitive data.
```

Send to billing owner:

```text
Subject: SearchLint 1.0 live billing acceptance evidence

Please provide the live Stripe billing acceptance evidence required for the
SearchLint 1.0 release gate.

Repository issue: https://github.com/muhamed1222/searchlint/issues/23
Dispatch runbook: docs/RELEASE_P1_OWNER_DISPATCH_RUNBOOK.md

Start with:

- docs/release-owner-evidence/25-billing-provesti-live-stripe-acceptance.json

Return sanitized machine-readable JSON only. Do not include Stripe secrets,
customer payment data, raw webhook secrets, or private customer identifiers.
```

Validation after provider evidence is committed:

```bash
pnpm google:gsc:acceptance
pnpm google:performance:acceptance
pnpm yandex:acceptance
pnpm notifications:acceptance
pnpm billing:live-stripe-final-acceptance-packet
pnpm release:evidence-readiness
pnpm final-release:gate
```

## Final Release Owner Outreach For Issue 25

Send only after issues `#19` through `#24` pass:

```text
Subject: SearchLint 1.0 final release gate review

Please perform the final release gate review only after issues #19 through #24
have passed and the dedicated package verifier commands are green.

Repository issue: https://github.com/muhamed1222/searchlint/issues/25
Final gate doc: docs/SEARCHLINT_1_0_FINAL_RELEASE_GATE.md
Release candidate matrix: docs/SEARCHLINT_1_0_RELEASE_CANDIDATE_MATRIX.md

Required first returned file:

- docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-release-candidate-proshel-polnuyu-matricu.json

Do not create v1.0.0, run final npm publish, run final vsce publish, publish
the public website as SearchLint 1.0, or announce SearchLint 1.0 until
pnpm final-release:gate passes from a fresh checkout.
```

Final validation:

```bash
pnpm rc:matrix
pnpm release:evidence-readiness
pnpm final-release:gate
```

## Non-Claims

- This kit is not release evidence.
- This kit is not reviewer sign-off.
- This kit is not legal advice or legal approval.
- This kit is not provider, platform, security, accessibility, publication, or
  final release evidence.
- This kit does not change SearchLint 1.0 release scope.
- SearchLint 1.0 remains blocked while required owner evidence is missing.
