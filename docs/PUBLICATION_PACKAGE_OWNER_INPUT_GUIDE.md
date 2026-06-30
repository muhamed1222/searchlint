# Publication Package Owner Input Guide

Generated at: 2026-06-23T00:00:00.000Z

This guide covers owner-provided npm and VS Code publication evidence. It does
not publish packages, publish the extension, change versions, or close release
gates.

## Current Status

- status: `owner_input_required`
- package: `03-publication` - npm And VS Code Publication
- package status: `blocked_missing_owner_evidence`
- missing owner inputs: 7
- present owner inputs: 0
- blocked or failing evidence: 7
- template-covered inputs: 7

## Required Evidence Files

- `docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-npm-pakety-opublikovany.json` -
  `missing`, templates: 1, commands: `pnpm final-release:gate`
- `docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-vs-code-extension-opublikovan.json` -
  `missing`, templates: 1, commands: `pnpm vscode:update-e2e`
- `docs/release-owner-evidence/7-vs-code-i-lsp-nastroit-publisher-account.json` -
  `missing`, templates: 1, commands: `pnpm vscode:update-e2e`
- `docs/release-owner-evidence/7-vs-code-i-lsp-podpisat-i-opublikovat-extension.json` -
  `missing`, templates: 1, commands: `pnpm vscode:update-e2e`
- `docs/release-owner-evidence/8-npm-pakety-opublikovat-beta-packages.json` -
  `missing`, templates: 1, commands: `pnpm package:beta-publication-gate`
- `docs/release-owner-evidence/8-npm-pakety-podgotovit-finalnuyu-publikaciyu-1-0-0.json` -
  `missing`, templates: 1, commands: `pnpm final-release:gate`
- `docs/release-owner-evidence/8-npm-pakety-zamenit-0-0-0-beta-versions-na-final-release-versions.json` -
  `missing`, templates: 1, commands: `pnpm final-release:gate`

## Evidence Groups

### Public Package Metadata

Provide owner-approved public repository, homepage, issue routing, and
package-directory metadata before public manifests are changed.

### npm Beta And Final Publication

Provide sanitized npm beta/final publication evidence, version evidence, and
clean-install evidence from an npm-like registry or the real npm registry.

- `docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-npm-pakety-opublikovany.json`
- `docs/release-owner-evidence/8-npm-pakety-opublikovat-beta-packages.json`
- `docs/release-owner-evidence/8-npm-pakety-podgotovit-finalnuyu-publikaciyu-1-0-0.json`
- `docs/release-owner-evidence/8-npm-pakety-zamenit-0-0-0-beta-versions-na-final-release-versions.json`

### VS Code Publisher And Marketplace Publication

Provide sanitized publisher-account and Marketplace publication evidence for the
SearchLint VS Code extension.

- `docs/release-owner-evidence/31-finalnyi-searchlint-1-0-release-gate-vs-code-extension-opublikovan.json`
- `docs/release-owner-evidence/7-vs-code-i-lsp-nastroit-publisher-account.json`
- `docs/release-owner-evidence/7-vs-code-i-lsp-podpisat-i-opublikovat-extension.json`

## Validation Commands

```bash
pnpm final-release:gate
pnpm vscode:update-e2e
pnpm package:beta-publication-gate
pnpm package:metadata-approval
pnpm package:registry-install
pnpm release:owner-evidence-package-status
```

## Owner Procedure

- Collect real owner-controlled publication evidence only after the package
  metadata, npm publishing, and VS Code Marketplace actions have actually
  happened.
- Create each required JSON file from its matching template or gate
  instructions, replacing every example value with real sanitized evidence.
- Keep npm tokens, VS Code PATs, private registry credentials, cookies, private
  keys, database URLs, and Authorization headers out of committed evidence.
- Run the package metadata, npm, VS Code, final-release, and owner package
  status commands after the files are populated.
- Do not reuse beta evidence as final 1.0 publication evidence unless the
  specific gate explicitly accepts that evidence class.

## Forbidden Evidence

- copied templates or placeholder values
- screenshots without machine-readable JSON
- npm tokens, automation tokens, or registry credentials
- VS Code Marketplace PATs or publisher secrets
- private package registry URLs containing credentials
- local dry-run output presented as real publication proof
- beta publication evidence presented as final 1.0.0 publication proof
- Marketplace draft or local VSIX evidence presented as published extension
  proof
- Git tags or package versions claimed without matching release evidence

## Non-Claims

- This guide does not publish npm packages.
- This guide does not publish the VS Code extension.
- This guide does not change package versions or package privacy flags.
- This guide does not create a release tag.
- This guide does not close publication or final release gates.
