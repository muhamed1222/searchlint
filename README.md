# SearchLint

SearchLint is a deterministic, rule-based SEO diagnostics product described in
`SEARCHLINT_1_0_DEVELOPMENT_PLAN.md`.

SearchLint 1.0 is not released. This repository currently contains local
developer-product evidence, package candidates, documentation, and cloud/SaaS
foundations. Public npm beta packages for the local developer product are
published for testing. The VS Code Marketplace extension, public website, and
production cloud platform are not launched yet.

## Current Status

Implemented and locally verified surfaces include:

- shared `@searchlint/core` rule engine with all 120 catalog rule IDs bound;
- real `specs/RULE_CATALOG.yaml` production-loader validation;
- `searchlint.seo` language version 1 grammar, parser, formatter, compiler,
  migration preservation, and public config contract;
- CLI, crawler, collectors, SARIF/JUnit/HTML/PDF reporters, source analyzer, LSP
  adapter, JSON-RPC language server, VS Code extension package, Next.js
  analyzer, development badge, and overlay foundations;
- development-only Next.js integration with zero-production-impact fixture
  evidence for Next.js 15/16 App Router and Pages Router;
- package metadata and local tarball install evidence for public package
  candidates;
- scaffold and static/local contract evidence for cloud/dashboard/API/workers
  surfaces.

Still blocked for SearchLint 1.0:

- OD-023 independent reviewer sign-off for blocker precision;
- public/private repository boundary and legal release review;
- stable npm `latest` publication, trusted publishing, provenance, and full
  release registry install;
- VS Code Marketplace publication and clean install E2E;
- production cloud, dashboard, auth/RBAC, Google/Yandex integrations, billing,
  hosted reports, notifications, agency mode, observability, security audit,
  penetration test, public website, onboarding, release candidate, and `v1.0.0`
  tag.

## Beta Install and Quick Start

The current tested path is the local Next.js developer badge. It is published
under the npm `beta` dist-tag:

```bash
npx -y @searchlint/cli@beta init --site https://example.com
npm install
npm run searchlint:verify
npm run dev
```

Expected `doctor` output in a patched Next.js project includes:

```text
project: package.json found
config: searchlint.seo found
next: next.config.ts uses withSearchLint
```

Open the local site and click the SearchLint badge. The badge is injected only
in local development through the Next.js config wrapper; it does not require a
component in the application source.

If a project already has an older beta installed, update prerelease packages
explicitly:

```bash
npm install -D @searchlint/cli@beta @searchlint/next@beta
```

Depending on the existing semver range, npm may keep an older prerelease such as
`1.0.0-beta.10` when using a caret range. Use the explicit `@beta` install
command above when testing a newly published beta.

The current verified beta versions are:

- `@searchlint/cli@1.0.0-beta.15`
- `@searchlint/next@1.0.0-beta.8`
- `@searchlint/core@1.0.0-beta.3`
- `@searchlint/browser@1.0.0-beta.2`
- `@searchlint/overlay@1.0.0-beta.6`

The broader package set is still prerelease. Stable 1.0 install commands will
use the normal package names after final release:

```bash
npm install -D @searchlint/cli @searchlint/core
pnpm add -D @searchlint/cli @searchlint/core
yarn add -D @searchlint/cli @searchlint/core
```

Create `searchlint.seo`:

```text
language 1
site "https://example.com"
let schemas ["Product", "BreadcrumbList"]

policy productPage {
  schema $schemas
  severity SL-SCHEMA-001 error
}

route "/products/[slug]" {
  use productPage
  indexable true
  canonical self
}
```

Validate the config:

```bash
searchlint config validate --config searchlint.seo
```

The language version 1 contract is documented in
`specs/SEARCHLINT_LANGUAGE_SPEC.md` and `specs/searchlint.ebnf`.

## Local Developer Surfaces

### CLI and CI

The CLI binary is `searchlint`.

```bash
searchlint --version
searchlint doctor
searchlint check --snapshot snapshot.json --catalog specs/RULE_CATALOG.yaml
searchlint crawl --url https://example.com --max-urls 100
```

CLI command, exit-code, reporter, baseline, crawl, and CI usage examples are
documented in `docs/CLI_CI_USAGE.md`.

### Next.js Development Integration

Use the local onboarding command in a Next.js project:

```bash
npx -y @searchlint/cli@beta init --site https://example.com
npm install
npm run searchlint:verify
npm run dev
```

Open the local site and click the SearchLint badge to inspect the current page.
The command patches supported Next.js config files and creates `searchlint.seo`
when missing. It does not crawl the public site.

The manual config wrapper is also available. The wrapper is phase-aware:
production phases return the original Next.js config without a SearchLint
webpack hook, while development client builds inject SearchLint's dev client.

```js
// next.config.mjs
import { withSearchLint } from "@searchlint/next";

const nextConfig = {};

export default withSearchLint(nextConfig);
```

The dev client mounts a Shadow DOM badge/overlay, analyzes the current page with
the shared core, reruns after navigation and DOM updates, and never requires a
badge component in production layouts. Setup details are in
`docs/NEXTJS_INSTALLATION.md`.

### VS Code and LSP

`searchlint-language-server` provides the JSON-RPC language-server transport for
`searchlint.seo`. `searchlint-vscode` contributes the VS Code language package,
diagnostics, hover, completion, formatting, safe quick fixes, definition,
references, rename, and the `SearchLint: Open SearchLint Overlay` command.

Usage, local VSIX readiness, and clean-install limitations are documented in
`docs/VSCODE_LSP_USAGE.md`.

## Cloud and Commercial Surfaces

The public/local side and closed commercial side are split by OD-016.

Public local-package candidates include the CLI, core packages, crawler,
DSL/LSP, Next integration, overlay, reporters, VS Code extension, specs, and
local-product documentation. Closed commercial surfaces include dashboard, API,
workers, infrastructure, billing, OAuth vault operations, hosted reports, and
SaaS operations.

Current cloud/dashboard/API/workers work is not a launched SaaS platform. Live
AWS, Google/Yandex, Stripe, security, observability, and production E2E gates
remain release blockers.

## Validation Commands

Use Node.js 24 LTS and pnpm 11.

```bash
pnpm install --frozen-lockfile
pnpm format
pnpm lint
pnpm typecheck
pnpm test
pnpm verify:release
pnpm verify:zero-impact
pnpm verify:next-fixtures
pnpm reporters:acceptance
```

The current local default Node may be older; validation can be run through the
bundled Node 24 runtime or an equivalent Node 24 environment.

Additional release evidence commands are documented in:

- `docs/COMPATIBILITY_MATRIX.md`
- `docs/PROJECT_PROGRESS.md`
- `docs/RELEASE_GAP_MATRIX.md`
- `docs/SEARCHLINT_1_0_MASTER_CHECKLIST.md`

## Release Gates

SearchLint 1.0 requires:

- two independent OD-023 blocker benchmark reviewer sign-offs;
- all 120 rules verified after reviewer adjudication;
- legal review of `LICENSE`, `NOTICE`, `CONTRIBUTING.md`, `SECURITY.md`,
  trademark policy, and public/private repository boundary;
- npm package publication with approved metadata, trusted publishing,
  provenance, and real registry install;
- VS Code Marketplace publication and clean install proof;
- zero-production-impact, CLI, DSL, Next analyzer, overlay, LSP, crawler,
  reporter, and package release acceptance;
- production PostgreSQL/RDS, S3, SQS/workers, API, auth/RBAC, OAuth vault,
  dashboard, Google/Yandex, billing, notifications, reports, agency,
  observability, security/privacy, public website, onboarding, and final release
  candidate gates;
- `v1.0.0` tag and public release.

## Documentation Map

Release readiness and support policies:

- `docs/INSTALLATION.md`
- `docs/COMPATIBILITY_MATRIX.md`
- `docs/RELEASE_NOTES.md`
- `CHANGELOG.md`
- `docs/PACKAGE_DOCUMENTATION.md`
- `docs/PUBLIC_WEBSITE_ONBOARDING.md`
- `docs/ONBOARDING_GUIDE.md`
- `docs/FAQ.md`
- `docs/TROUBLESHOOTING.md`
- `docs/API_DOCUMENTATION.md`
- `CONTRIBUTING.md`
- `DCO.md`
- `SECURITY.md`
- `docs/SECURITY_MODEL.md`
- `docs/SECURITY_PRIVACY_RELEASE_GATE.md`
- `docs/SUPPORT_POLICY.md`
- `docs/DEPRECATION_POLICY.md`
- `docs/VERSIONING_POLICY.md`
- `docs/UPGRADE_GUIDE.md`
- `docs/INCIDENT_SUPPORT_PROCESS.md`
- `docs/DSL_MIGRATION_GUIDE.md`
- `docs/CURRENT_PRODUCT_STATUS.md`
- `docs/RELEASE_GAP_MATRIX.md`
- `docs/PROJECT_PROGRESS.md`
- `docs/SEARCHLINT_1_0_MASTER_CHECKLIST.md`
