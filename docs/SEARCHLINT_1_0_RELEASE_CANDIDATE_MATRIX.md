# SearchLint 1.0 Release Candidate Matrix

Status date: 2026-06-22

`pnpm rc:matrix` verifies that the repository has a complete release-candidate
matrix for SearchLint 1.0. The matrix is an aggregation gate. It does not mean
the release candidate has passed.

## Verdict

Current RC status: `blocked`.

The repository has deterministic evidence for many product surfaces, but final
SearchLint 1.0 RC is blocked by independent reviewer sign-off, legal approval,
repository split, public package publication, VS Code Marketplace publication,
live cloud deployment, live Google/Yandex acceptance, live billing,
DAST/pentest, deployed production security review, and final tag/publication
work.

## Matrix Semantics

- `evidence-present`: deterministic repository evidence exists.
- `blocked`: required release evidence does not exist yet.
- `not-applicable`: intentionally outside this matrix.

## Required RC Areas

The RC verifier covers:

- project governance and baseline;
- rule QA and blocker precision;
- core/local developer product;
- DSL/config;
- Next.js analyzer and zero production impact;
- badge/overlay;
- LSP and VS Code extension;
- npm packages;
- CLI and crawler;
- reporters;
- database and object storage;
- backend API;
- queues/workers;
- auth/RBAC;
- OAuth vault;
- dashboard;
- Google/Yandex/PageSpeed/CrUX integrations;
- history/correlation;
- notifications;
- billing;
- agency mode;
- observability;
- security/privacy;
- release documentation;
- public website/onboarding;
- legal/repository boundary;
- final tag and publication.

## Evidence Output

The verifier writes:

- `reports/searchlint-1-0-rc-matrix-report.json`
- `docs/examples/searchlint-1-0-rc-matrix-report.sample.json`

The checked sample is deterministic and sanitized. Generated reports under
`reports/` remain CI artifacts unless the release process explicitly changes the
evidence policy.

## Reports Evidence

Reports now have aggregate deterministic evidence through
`pnpm reports:final-readiness`, covering SARIF, JUnit, HTML, binary PDF export,
static PDF rendering, hosted report links static contract, expiration static
contract, access controls static contract, and report history static contract.
Live cloud deployment, object storage, dashboard E2E, and identity-provider
behavior remain covered by their own RC gates.

## Zero-Impact Evidence

Zero production impact now has aggregate deterministic evidence through
`pnpm zero-impact:final`, covering Next.js 15/16 App Router and Pages Router
fixtures installed from packed public package candidates. The gate proves zero
SearchLint production client bytes, zero SearchLint client/server modules, zero
production request delta, zero SearchLint DOM nodes, zero SearchLint globals,
zero SearchLint listeners/observers, and unchanged normalized route HTML and
headers. Public npm registry publication remains covered by the npm package
gates.

## Documentation Evidence

Release documentation now has aggregate deterministic evidence through
`pnpm docs:final-readiness`, covering release-doc acceptance, public
website/onboarding source acceptance, generated rule docs freshness, required
release documentation files, JSON sample evidence, and release-honesty markers
stating that SearchLint 1.0 is not released while final gates remain blocked.
Deployed public website/domain/CDN, live onboarding/signup, and final
legal/marketing approval remain separate gates.

## Onboarding Evidence

Source-level onboarding now has aggregate deterministic evidence through
`pnpm onboarding:final`, covering the onboarding guide, installation and quick
start paths, Next.js/CLI/VS Code/provider guidance, onboarding wizard inputs and
outputs, demo project starter configuration, and release-honesty markers.
Deployed public website/domain/CDN, live signup/auth onboarding, live cloud
project creation, and final legal/marketing approval remain separate gates.

## Remaining RC Blockers

The current matrix is expected to remain blocked until:

- two real blocker benchmark reviewer files are supplied and approved;
- legal review approves public/private repository boundary and public docs;
- repository split is completed;
- branch protection and required checks are configured in GitHub;
- public npm packages are published and installed from the registry;
- VS Code extension is published and verified from Marketplace;
- live AWS cloud deployment evidence exists;
- live Google/Yandex/PageSpeed/CrUX acceptance exists;
- live Stripe billing acceptance exists;
- DAST and penetration test evidence exists;
- public website is deployed;
- final RC matrix passes against deployed/public artifacts;
- `v1.0.0` is tagged and public release evidence is recorded.
