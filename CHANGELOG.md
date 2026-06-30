# Changelog

All notable SearchLint project-level changes are documented here.

SearchLint 1.0 is not released. This changelog records pre-release readiness
work and local acceptance evidence only; it is not a public release
announcement.

Package-specific changelog notes may also exist in package directories, such as
`apps/vscode/CHANGELOG.md` for the VS Code extension.

## Unreleased

## Current Published Beta Line

Public npm beta packages are published only after the release owner completes
the approved publication workflow and captures the required sanitized evidence.
The current repository state records local beta readiness and package
publication preparation; it does not claim final SearchLint 1.0 release,
Marketplace publication, legal approval, or final npm publication.

### Release Gates

- OD-023 independent reviewer sign-off is still required before blocker rule
  precision can be treated as final release evidence.
- npm package publication, VS Code Marketplace publication, legal review, public
  repository boundary review, and final `v1.0.0` tagging remain open gates.
- Cloud platform, dashboard, external integrations, billing, observability,
  security audit, public website, and onboarding gates remain outside the local
  developer-product evidence already gathered.

### Documentation

- Release status is tracked in `docs/PROJECT_PROGRESS.md`,
  `docs/SEARCHLINT_1_0_MASTER_CHECKLIST.md`, `docs/RELEASE_GAP_MATRIX.md`, and
  `docs/RELEASE_NOTES.md`.
- Versioning and compatibility policy are tracked in `docs/VERSIONING_POLICY.md`
  and `docs/DEPRECATION_POLICY.md`.

## 1.0.0-beta.0

Draft local package and extension readiness checkpoint. This is not a published
npm, Marketplace, or SearchLint 1.0 release.

### Added

- Deterministic 120-rule catalog binding and rule QA evidence for local rule
  execution.
- `searchlint.seo` language v1 parser, formatter, compiler, and migration
  preservation evidence.
- Local CLI, crawler, Next analyzer, overlay, LSP, VS Code package, and reporter
  readiness evidence.
- SARIF, JUnit, HTML, and deterministic binary PDF reporter acceptance.
- Package metadata and local tarball dry-run evidence for public package
  candidates.
- Prerelease beta preparation verifier for the 15 public `1.0.0-beta.0` package
  candidates, private cloud package exclusions, local registry install evidence,
  hosted release workflow contract, release notes, and changelog checks.

### Changed

- Release documentation now distinguishes local developer-product readiness from
  full SearchLint 1.0 release readiness.
- Public package, contribution, security, support, versioning, deprecation,
  upgrade, and incident/support policies are documented but remain subject to
  release-gate review where applicable.

### Security

- Security and privacy release gates are documented in `SECURITY.md`,
  `docs/SECURITY_MODEL.md`, and `docs/SECURITY_PRIVACY_RELEASE_GATE.md`.
- External dependency audit, SAST, DAST, penetration test, legal review, and
  production security gates remain incomplete.

### Known Blockers

- SearchLint 1.0 is not released.
- `docs/RELEASE_NOTES.md` remains a draft until all release gates pass.
- The public/private repository boundary still requires legal and release review
  before public publication.
