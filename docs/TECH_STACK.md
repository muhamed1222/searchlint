# SearchLint Tech Stack

Status date: 2026-06-30

This document records the current stack expected by repository workflows and
release validation.

## Runtime and Tooling

- Node.js: 24 LTS or newer compatible Node 24 runtime.
- pnpm: 11.x.
- TypeScript: package-managed TypeScript 6.x.
- Test runner: Vitest plus Playwright where browser evidence is required.
- Formatting: Prettier.
- Linting: ESLint plus repository-specific verifier scripts.

Use the package manager and versions declared in `package.json` and
`pnpm-lock.yaml`.

## Repository Shape

SearchLint is a pnpm workspace monorepo. Key workspace areas include:

- `packages/core`
- `packages/cli`
- `packages/browser`
- `packages/html`
- `packages/http`
- `packages/next`
- `packages/overlay`
- `packages/source`
- `packages/lsp`
- `packages/language`
- `packages/language-server`
- reporter packages
- `apps/vscode`
- `apps/dashboard`
- `services/api`
- `services/workers`
- `infra`
- `docs`
- `scripts`
- `specs`

## Validation Commands

The normal validation set is:

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

Release-specific commands are listed in `package.json` scripts and summarized
by:

```bash
pnpm release:evidence-readiness
pnpm final-release:gate
```

## Production Deployment Stack

The planned full SearchLint 1.0 cloud stack includes PostgreSQL/RDS, object
storage, queues, workers, auth/RBAC, OAuth vault, dashboard hosting, billing,
observability, and provider integrations.

Static contracts for these surfaces do not replace live production evidence. The
release gate remains blocked until dedicated live verifier commands and owner
evidence pass.

## Dependency and Supply-Chain Rules

- Do not add dependencies speculatively.
- Do not create or update lockfiles outside the approved task scope.
- Do not publish final packages while `pnpm final-release:gate` is blocked.
- Do not introduce runtime SearchLint code into production user sites.
