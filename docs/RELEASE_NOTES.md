# SearchLint Release Notes

Status date: 2026-06-23

SearchLint 1.0 is not released. These notes describe the current local readiness
line and the evidence that has been prepared for release review. They are not a
public launch announcement, npm final publication notice, Marketplace
publication notice, or legal approval.

## Current Published Beta Line

Public npm beta packages are published only when the release owner has completed
the npm publication workflow and captured the required owner evidence. The
repository currently keeps local beta package readiness evidence separate from
final SearchLint 1.0 approval.

The current beta line uses explicit `1.0.0-beta.*` versions for public package
candidates and keeps cloud/runtime applications private. This line exists to
prove package manifests, provenance configuration, tarball contents, local
registry install behavior, and clean consumer installation behavior before final
release gates are closed.

## 1.0.0-beta.0 Local Readiness Notes

The `1.0.0-beta.0` readiness checkpoint covers deterministic local developer
product evidence. It does not prove live cloud deployment, external provider
acceptance, billing acceptance, VS Code Marketplace publication, npm final
publication, legal approval, or the final `v1.0.0` tag.

## Included Local Surfaces

- Shared deterministic rule engine and 120-rule catalog.
- CLI package candidate and package-manager acceptance path.
- Next.js analyzer and zero-production-impact verification.
- Overlay, LSP, VS Code extension package, and reporter surfaces.
- SARIF, JUnit, HTML, and deterministic binary PDF report generation.
- Public package dry-run, npm-like registry install, public registry install,
  and hosted release workflow contract checks.

## Verified Evidence Commands

The local readiness line is intended to be checked with:

```bash
pnpm rule-qa
pnpm rule-qa:review
pnpm cli:package-manager-acceptance
pnpm reporters:acceptance
pnpm package:dry-run
pnpm package:registry-install
pnpm package:release-workflow
pnpm package:beta-prep
pnpm final-release:gate
```

`pnpm rule-qa` verifies deterministic rule execution. `pnpm rule-qa:review`
remains blocked until two independent OD-023 reviewer sign-offs exist.
`pnpm cli:package-manager-acceptance` covers CLI package-manager behavior.
`pnpm reporters:acceptance` covers release reporter documentation and the
deterministic binary PDF reporter path.

## Known Limitations

- SearchLint 1.0 is not released.
- Final npm publication evidence is missing.
- VS Code Marketplace publication evidence is missing.
- Public website deployment and copy approval are missing.
- Live AWS/RDS/API/SQS/S3/Cognito/OAuth/dashboard evidence is missing.
- Live Google, Yandex, PageSpeed, CrUX, notification, billing, and agency-mode
  provider acceptance is missing.
- Security release gates still require DAST, penetration test, and reviewer
  evidence.
- The public/private repository boundary still requires legal and release-owner
  sign-off.
- Final `v1.0.0` tag creation is forbidden while final gates remain blocked.

## 1.0.0 Final Release Gates

Final SearchLint 1.0 release remains blocked until:

- two independent OD-023 reviewer sign-offs exist;
- legal review approves the release scope, package metadata, trademarks, public
  repository boundary, and privacy/security materials;
- npm beta and final publication evidence is captured without secrets;
- VS Code Marketplace publication evidence is captured without secrets;
- live cloud, provider, billing, observability, security, public website, and
  onboarding evidence is captured;
- `pnpm final-release:gate` reports that all final release gates are closed.

## Reader Guidance

Use these files for the current release state:

- `CHANGELOG.md`
- `docs/INSTALLATION.md`
- `docs/PROJECT_PROGRESS.md`
- `docs/SEARCHLINT_1_0_MASTER_CHECKLIST.md`
- `docs/RELEASE_GAP_MATRIX.md`
- `docs/COMPATIBILITY_MATRIX.md`
- `docs/CURRENT_PRODUCT_STATUS.md`

Do not treat these release notes as final release approval. The authoritative
final verdict remains the output of `pnpm final-release:gate`.
