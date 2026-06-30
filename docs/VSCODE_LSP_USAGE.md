# VS Code and LSP Usage

Status date: 2026-06-22

## Scope

SearchLint provides a language-server-backed VS Code integration for
`searchlint.seo` files.

Implemented editor capabilities:

- `.seo` language registration through `searchlint-vscode`;
- JSON-RPC language server transport through `searchlint-language-server`;
- diagnostics from the shared `@searchlint/lsp` adapter;
- hover text for DSL constructs and known rule IDs;
- completion for route/severity/suppress keywords, provider names, severity
  values, and known rule IDs;
- document formatting through the shared `@searchlint/language` formatter;
- deterministic quick fixes for local DSL edits;
- same-document go to definition for policy and variable references;
- same-document references for policy and variable symbols;
- same-document rename edits for policy and variable symbols;
- multi-document invalidation that updates one open document without disturbing
  diagnostics for other open documents;
- stale diagnostic cleanup when an invalid document becomes valid or is closed;
- deterministic large-workspace acceptance over 260 open `searchlint.seo`
  documents;
- `SearchLint: Open SearchLint Overlay` command.

The editor integration does not own parser, semantic validation, formatting, or
rule catalog logic. Those remain shared package responsibilities.

## Packages

```text
packages/language-server
apps/vscode
```

`searchlint-language-server` is the Node language server package. It exposes:

```text
searchlint-language-server
```

as its CLI bin and uses `vscode-languageserver` for JSON-RPC transport.

`searchlint-vscode` is the VS Code extension package. It starts the shared
language server through a small node shim and contributes the `searchlint-seo`
language for `searchlint.seo` and `.seo` files.

The extension package includes deterministic release assets:

- `apps/vscode/assets/icon.svg`
- `apps/vscode/assets/screenshots/diagnostics.svg`
- `apps/vscode/assets/screenshots/quick-fix.svg`

The README references the screenshot assets so Marketplace package review can
inspect the editor diagnostics and quick-fix surfaces before publication.

## Overlay Command

The command `SearchLint: Open SearchLint Overlay` reads:

```text
searchlint.overlayUrl
```

If the value is empty, VS Code shows a clear unavailable-state message. If it is
configured, the extension opens the URL through VS Code's external URI handler.

Example workspace setting:

```json
{
  "searchlint.overlayUrl": "http://localhost:3000"
}
```

## Validation

Use Node.js 24 LTS and pnpm 11.

```bash
pnpm --filter @searchlint/lsp test
pnpm --filter searchlint-language-server test
pnpm --filter searchlint-vscode test
pnpm --filter @searchlint/lsp typecheck
pnpm --filter searchlint-language-server typecheck
pnpm --filter searchlint-vscode typecheck
pnpm lsp-vscode:acceptance
pnpm lsp:workspace-acceptance
pnpm vscode:vsix-readiness
pnpm vscode:clean-install-e2e
pnpm vscode:update-e2e
```

Release validation remains the root command set documented in
`docs/TECH_STACK.md`.

`pnpm lsp-vscode:acceptance` writes deterministic machine-readable evidence to
`reports/lsp-vscode-acceptance-report.json` and a sanitized sample to
`docs/examples/lsp-vscode-acceptance-report.sample.json`.

The verifier checks local LSP behavior, VS Code package metadata, the extension
icon, screenshot assets, package file allowlist, and README screenshot
references.

`pnpm lsp:workspace-acceptance` writes deterministic machine-readable evidence
to `reports/lsp-workspace-acceptance-report.json` and a sanitized sample to
`docs/examples/lsp-workspace-acceptance-report.sample.json`. The verifier checks
multi-file invalidation, stale diagnostic cleanup on change and close, and
large-workspace behavior for 260 open documents.

`pnpm vscode:vsix-readiness` builds a generated local VSIX artifact at
`reports/searchlint-vscode-1.0.0-beta.0.vsix`, verifies the VSIX manifest,
content types, extension manifest, runtime payload, assets, and runtime
dependency entries, then writes deterministic machine-readable evidence to
`reports/vscode-vsix-readiness-report.json` and a sanitized sample to
`docs/examples/vscode-vsix-readiness-report.sample.json`.

`pnpm vscode:clean-install-e2e` runs VSIX readiness, downloads an isolated VS
Code test host through `@vscode/test-electron`, installs the generated VSIX into
isolated temporary `--user-data-dir` and `--extensions-dir` directories, then
runs a VS Code Extension Host E2E test that opens a `searchlint.seo` document,
activates `searchlint-vscode`, checks the `searchlint.openOverlay` command, and
executes the configured overlay command path. It writes deterministic evidence
to `reports/vscode-clean-install-e2e-report.json` plus
`docs/examples/vscode-clean-install-e2e-report.sample.json`.

`pnpm vscode:update-e2e` runs VSIX readiness, builds a temporary previous
`1.0.0-alpha.0` VSIX without changing repository package metadata, installs it
into isolated VS Code user-data/extensions directories, installs the current
`1.0.0-beta.0` VSIX with `--force`, and verifies that
`searchlint.searchlint-vscode@1.0.0-beta.0` replaces the previous version. It
writes deterministic evidence to `reports/vscode-update-e2e-report.json` plus
`docs/examples/vscode-update-e2e-report.sample.json`.

## Non-goals

This integration does not implement cloud, dashboard, backend, Google, Yandex,
workers, auth/RBAC, billing, marketplace publication, real VSIX signing or clean
Marketplace release, publisher-account setup, or Marketplace auto-update
acceptance after publication.
