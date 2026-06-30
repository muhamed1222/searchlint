# SearchLint 1.0 P1 Owner Dispatch Runbook

Status date: 2026-06-30

This runbook is the owner-facing dispatch entry point for the P1 external
evidence packages that remain after the P0 reviewer and legal packages are
routed. It does not create provider evidence, deployment evidence, publication
evidence, security evidence, or release approval.

## Current Baseline

- Baseline commit: `ae5cd871ae85ca030e06906b1eedc8646b097555`
- Baseline CI: passed in GitHub Actions run
  `https://github.com/muhamed1222/searchlint/actions/runs/28462720725`
- Final release gate: `BLOCKED`
- Release readiness: 522/599 done; 77 remaining
- Real owner evidence inputs: 0/60 present
- Missing evidence paths: 108
- `v1.0.0`: absent and must not be created yet

Before claiming that a P1 package is complete, rerun the affected verifier and
then rerun:

```bash
pnpm release:evidence-readiness
pnpm final-release:gate
```

## P1 Scope

| Issue | Package                          | Missing owner inputs | Current status                            |
| ----- | -------------------------------- | -------------------: | ----------------------------------------- |
| `#21` | npm and VS Code Publication      |                    7 | Waiting for publication owner evidence    |
| `#22` | Production Platform              |                   21 | Waiting for deployed platform evidence    |
| `#23` | Live Provider Acceptance         |                   17 | Waiting for provider owner evidence       |
| `#24` | Security, Accessibility, Website |                    8 | Waiting for real review/deployed evidence |
| `#25` | Final Release                    |                    3 | Waiting for upstream packages             |

GitHub issue links:

- `https://github.com/muhamed1222/searchlint/issues/21`
- `https://github.com/muhamed1222/searchlint/issues/22`
- `https://github.com/muhamed1222/searchlint/issues/23`
- `https://github.com/muhamed1222/searchlint/issues/24`
- `https://github.com/muhamed1222/searchlint/issues/25`

## Dispatch Rule

Prefer the repository files listed below as the durable source of truth. Local
zip packets can be used when available, but they are not release evidence and
are not accessible to all GitHub readers.

Durable repository sources:

- `docs/RELEASE_OWNER_EVIDENCE_RUNBOOK.md`
- `docs/RELEASE_OWNER_EVIDENCE_PACKAGE_STATUS.md`
- `docs/RELEASE_OWNER_EVIDENCE_READINESS_INDEX.md`
- `docs/RELEASE_MISSING_EVIDENCE_TEMPLATE_INDEX.md`
- `docs/RELEASE_EVIDENCE_CONTROL_BOARD.md`

Local P1 orchestration artifacts:

- Publication packet:
  `/tmp/searchlint-publication-review/searchlint-publication-packet.zip`
- Publication packet SHA-256:
  `f3d67f6b470f5e4bc3921218190bc4514e2ee6a80728fb5ef4e0339bdcc9b2ea`
- Production platform packet:
  `/tmp/searchlint-platform-review/searchlint-platform-packet.zip`
- Production platform packet SHA-256:
  `2dd9fb9b54dedeba7fb7e19cea2d228c1a09d1d6af1efc22b90404f5638c8846`
- Live provider packet:
  `/tmp/searchlint-provider-review/searchlint-provider-packet.zip`
- Live provider packet SHA-256:
  `48959ed07052c79b77e3d6c1c4c73b82f80608116c72ff2c015d0e581c88407d`
- Security, accessibility, and website packet:
  `/tmp/searchlint-security-review/searchlint-security-accessibility-website-packet.zip`
- Security, accessibility, and website packet SHA-256:
  `62ad031de60de32960fafb84c7d06370ab7e9941efd33613766f5be7f142d156`
- Final release packet:
  `/tmp/searchlint-final-release-review/searchlint-final-release-packet.zip`
- Final release packet SHA-256:
  `c32ad203c57c507f86bc64f452b83e249c5b0125a99028e875521e5a21ba6889`
- Consolidated P1 dispatch packet:
  `/tmp/searchlint-p1-dispatch/searchlint-p1-dispatch-packet.zip`
- Consolidated P1 dispatch SHA-256:
  `774c95b358fa4c2cd3f83f9a38332424ab4d9dcd0f4651c32ab2d521a0c96d9d`

## Issue 21: npm And VS Code Publication

Owner guide:

- `docs/PUBLICATION_PACKAGE_OWNER_INPUT_GUIDE.md`

Supporting docs:

- `docs/PACKAGE_PUBLICATION_READINESS.md`
- `docs/PACKAGE_DOCUMENTATION.md`
- `docs/PACKAGE_PUBLIC_PRIVATE_MATRIX.md`
- `docs/PUBLIC_PRIVATE_REPOSITORY_BOUNDARY_PLAN.md`

Required owner evidence package:

- Package: `npm And VS Code Publication`
- Missing owner inputs: 7
- Evidence paths and templates are listed in
  `docs/RELEASE_OWNER_EVIDENCE_PACKAGE_STATUS.md`.

Validation commands:

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

Do not run final `npm publish`, final `vsce publish`, or create final `1.0.0`
versions until `pnpm final-release:gate` passes.

## Issue 22: Production Platform

Owner evidence package:

- Package: `Production Platform`
- Missing owner inputs: 21
- Evidence paths and templates are listed in
  `docs/RELEASE_OWNER_EVIDENCE_PACKAGE_STATUS.md`.

Required evidence classes:

- live backup/restore drill;
- cloud crawler scale evidence;
- PostgreSQL/RDS deployment and migration evidence;
- object storage evidence;
- production API evidence;
- worker/SQS evidence;
- production dashboard evidence;
- auth/RBAC evidence;
- OAuth vault evidence;
- observability evidence;
- agency/client portal evidence.

Validation commands:

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

## Issue 23: Live Provider Acceptance

Owner evidence package:

- Package: `Live Provider Acceptance`
- Missing owner inputs: 17
- Evidence paths and templates are listed in
  `docs/RELEASE_OWNER_EVIDENCE_PACKAGE_STATUS.md`.

Required evidence classes:

- live Google Search Console evidence;
- live PageSpeed/CrUX evidence;
- live Yandex Webmaster and Metrica evidence;
- live notification provider delivery evidence;
- live Stripe billing evidence;
- agency billing and invite provider evidence.

Validation commands:

```bash
pnpm google:gsc:acceptance
pnpm google:performance:acceptance
pnpm yandex:acceptance
pnpm notifications:acceptance
pnpm billing:live-stripe-final-acceptance-packet
pnpm release:evidence-readiness
pnpm final-release:gate
```

## Issue 24: Security, Accessibility, Website

Owner evidence package:

- Package: `Security Accessibility And Website`
- Missing owner inputs: 8
- Evidence paths and templates are listed in
  `docs/RELEASE_OWNER_EVIDENCE_PACKAGE_STATUS.md`.

Supporting docs:

- `docs/SECURITY_PRIVACY_RELEASE_GATE.md`
- `docs/PUBLIC_WEBSITE_ONBOARDING.md`

Required evidence classes:

- deployed-target DAST;
- independent penetration-test summary;
- OAuth vault external security reviews;
- overlay manual accessibility review;
- deployed public website evidence.

Validation commands:

```bash
pnpm security:dast
pnpm security:pentest
pnpm oauth-vault:security-review
pnpm overlay:manual-a11y-review
pnpm website:acceptance
pnpm release:evidence-readiness
pnpm final-release:gate
```

## Issue 25: Final Release

Owner evidence package:

- Package: `Final Release`
- Missing owner inputs: 3
- Evidence paths and templates are listed in
  `docs/RELEASE_OWNER_EVIDENCE_PACKAGE_STATUS.md`.

Supporting docs:

- `docs/SEARCHLINT_1_0_FINAL_RELEASE_GATE.md`
- `docs/SEARCHLINT_1_0_RELEASE_CANDIDATE_MATRIX.md`
- `docs/RELEASE_NOTES.md`

Required order:

1. Complete issue `#19` through issue `#24`.
2. Rerun every affected package verifier.
3. Rerun `pnpm release:evidence-readiness`.
4. Rerun `pnpm final-release:gate` from a fresh checkout.
5. Create `v1.0.0`, run final publications, and publish the public release only
   after the final gate passes.

Validation commands:

```bash
pnpm rc:matrix
pnpm release:evidence-readiness
pnpm final-release:gate
```

## Forbidden Actions While P1 Is Blocked

Do not perform these actions until all upstream evidence packages pass and the
final release gate passes from a fresh checkout:

- create Git tag `v1.0.0`;
- run final `npm publish`;
- run final `vsce publish`;
- release the public website as SearchLint 1.0;
- announce SearchLint 1.0.

## Non-Claims

- This runbook is not publication evidence.
- This runbook is not deployment evidence.
- This runbook is not live provider evidence.
- This runbook is not security or accessibility sign-off.
- This runbook is not final release approval.
- Local zip packet paths are orchestration references, not release evidence.
- Example files and templates do not count as evidence.
- SearchLint 1.0 remains blocked while required P1 evidence is missing.
