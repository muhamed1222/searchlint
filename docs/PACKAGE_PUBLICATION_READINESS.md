# Package Publication Readiness

Status date: 2026-06-22

This document records npm publication readiness for the public local developer
packages. It does not publish packages.

## Current Status

Status: BLOCKED

Public package candidates now have beta package metadata for fields that can be
set without inventing external URLs:

- version: `1.0.0-beta.0`
- license: `Apache-2.0`
- explicit descriptions
- Node.js and pnpm engines
- keywords
- package `files` allowlists
- runtime `exports`/`bin` targets that point to `dist`
- exported type declaration targets
- explicit `sideEffects: false` tree-shaking metadata
- public package dependency graph checks, including `peerDependencies`
- `publishConfig.provenance: true`
- `publishConfig.access: public` for scoped public packages
- no `private: true` flag on public npm package candidates

Cloud packages remain private:

- `@searchlint/dashboard`
- `@searchlint/api`
- `@searchlint/workers`

## Publication Blockers

The following metadata intentionally remains blocked until owner/legal approval:

- `repository`: requires approved public repository URL and package `directory`
  mappings.
- `homepage`: requires approved public website/docs URL.
- `bugs`: requires approved public issue/security routing.
- `pnpm package:metadata-approval` verifies the owner-approved URL packet before
  those fields may be copied into public package manifests.
- npm trusted publishing: repository-side workflow readiness exists; npm-side
  trusted publisher bindings and hosted run proof remain required.
- final versions: require release candidate approval before `1.0.0`.
- legal approval: required for package metadata, license, notice, trademark,
  README, and public/private repository boundary.

Do not invent placeholder URLs in package manifests.

## Public Package Candidates

| Package                      | Version        | npm state                                       |
| ---------------------------- | -------------- | ----------------------------------------------- |
| `@searchlint/browser`        | `1.0.0-beta.0` | dry-run candidate, blocked on public URLs/legal |
| `@searchlint/cli`            | `1.0.0-beta.0` | dry-run candidate, blocked on public URLs/legal |
| `@searchlint/core`           | `1.0.0-beta.0` | dry-run candidate, blocked on public URLs/legal |
| `@searchlint/crawler`        | `1.0.0-beta.0` | dry-run candidate, blocked on public URLs/legal |
| `@searchlint/html`           | `1.0.0-beta.0` | dry-run candidate, blocked on public URLs/legal |
| `@searchlint/http`           | `1.0.0-beta.0` | dry-run candidate, blocked on public URLs/legal |
| `@searchlint/language`       | `1.0.0-beta.0` | dry-run candidate, blocked on public URLs/legal |
| `searchlint-language-server` | `1.0.0-beta.0` | dry-run candidate, blocked on public URLs/legal |
| `@searchlint/lsp`            | `1.0.0-beta.0` | dry-run candidate, blocked on public URLs/legal |
| `@searchlint/next`           | `1.0.0-beta.0` | dry-run candidate, blocked on public URLs/legal |
| `@searchlint/overlay`        | `1.0.0-beta.0` | dry-run candidate, blocked on public URLs/legal |
| `@searchlint/reporter-html`  | `1.0.0-beta.0` | dry-run candidate, blocked on public URLs/legal |
| `@searchlint/reporter-junit` | `1.0.0-beta.0` | dry-run candidate, blocked on public URLs/legal |
| `@searchlint/reporter-sarif` | `1.0.0-beta.0` | dry-run candidate, blocked on public URLs/legal |
| `@searchlint/source`         | `1.0.0-beta.0` | dry-run candidate, blocked on public URLs/legal |

## Verification Command

Run:

```bash
pnpm package:dry-run
pnpm package:metadata-approval
```

The command:

- builds the workspace;
- validates public package metadata that can be checked locally;
- verifies package `files`, runtime export/bin targets, declaration targets,
  tree-shaking readiness, and public/private dependency graph boundaries;
- verifies private cloud packages remain private;
- runs `pnpm pack --dry-run` for every public npm package candidate;
- writes `reports/package-publication-dry-run-report.json`;
- writes sanitized sample evidence to
  `docs/examples/package-publication-dry-run-report.sample.json`.

The command may report `BLOCKED` while still exiting successfully when dry-runs
pass and remaining blockers are owner/legal metadata decisions.

It exits non-zero only for local technical failures such as failed pack dry-runs
or private cloud packages losing `private: true`.

## Technical Readiness Evidence

`pnpm package:dry-run` now records per-package `technicalReadiness` evidence in
the JSON report:

- `files`: exact allowlist must be `dist/src` and `package.json`, except
  `@searchlint/next`, which must also include `RULE_CATALOG.yaml` so local dev
  badge onboarding can run outside the monorepo without a manual catalog path.
- `exports`: runtime exports and CLI binaries must point to built `dist`
  artifacts and must not point to runtime `.ts` files.
- `types`: exported declaration targets must point to `.d.ts` files under
  `dist`.
- `treeShaking`: package manifests must be ESM-only and declare
  `sideEffects: false`; library packages must expose ESM import targets.
- `dependencyGraph`: runtime, peer, and optional dependencies must not cross
  from public packages into private cloud packages or unknown `@searchlint/*`
  packages.
- `pack`: dry-run tarballs must build successfully.

This proves technical manifest readiness for the current beta candidates. It
does not prove npm publication readiness because approved public URLs, legal
review, trusted publishing, beta publication, registry install, and final
`1.0.0` release are still missing.

`pnpm package:metadata-approval` writes:

- `reports/public-package-metadata-approval-report.json`
- `docs/examples/public-package-metadata-approval-report.sample.json`

It is expected to fail until `docs/package-metadata-approval.json` exists with
real owner-approved `repository`, `homepage`, `bugs`, and package directory
mapping values.

Reader-facing package documentation is maintained in
`docs/PACKAGE_DOCUMENTATION.md`.

## Not Started

- npm organization setup;
- npm-side trusted publisher binding;
- hosted npm provenance workflow execution proof;
- beta publication;
- clean install from a real npm registry;
- final `1.0.0` publication.
