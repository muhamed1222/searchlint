# Public/Private Repository Boundary Plan

Status date: 2026-06-22

This plan prepares the repository boundary required by OD-016 and ADR 0028. It
does not move code and does not create repositories.

`pnpm repo:public-boundary` verifies the current public repository candidate
manifest at `specs/PUBLIC_REPOSITORY_EXPORT_MANIFEST.json`. The current result
is `PASS`: the candidate include set excludes closed cloud implementation paths,
and public package/VS Code dependencies do not cross into private cloud package
names.

## Boundary Rule

Public repository:

- local developer tools;
- deterministic rule engine;
- DSL/LSP;
- Next.js development integration;
- overlay/badge;
- reporters;
- VS Code extension;
- specs and local product documentation;
- deterministic fixtures and sanitized examples required by public tests.

Private repository:

- hosted dashboard;
- cloud API;
- workers;
- AWS/IaC/deployment assets;
- billing;
- OAuth vault operations;
- hosted reports;
- SaaS operations;
- private runbooks, credentials, customer data, and operational evidence.

## Proposed Public Repository Include Paths

| Path                                 | Public action                        | Notes                                                      |
| ------------------------------------ | ------------------------------------ | ---------------------------------------------------------- |
| `.github/`                           | Review before include                | CI must not reference private-only paths after split       |
| `.gitignore`                         | Include                              | Must keep generated and secret files ignored               |
| `.prettierignore`                    | Include                              | Formatting support                                         |
| `AGENTS.md`                          | Review before include                | Remove private-cloud instructions if needed                |
| `README.md`                          | Include after legal review           | Must describe public local product accurately              |
| `SEARCHLINT_1_0_DEVELOPMENT_PLAN.md` | Review before include                | May mention full product; ensure public/private framing    |
| `LICENSE`                            | Include after legal review           | Apache-2.0 public scope                                    |
| `NOTICE`                             | Include after legal review           | Attribution/trademark language                             |
| `CONTRIBUTING.md`                    | Include after legal review           | DCO and public contribution scope                          |
| `DCO.md`                             | Include after legal review           | DCO 1.1                                                    |
| `SECURITY.md`                        | Include after legal/security review  | Public contact/SLA required                                |
| `package.json`                       | Include after package metadata split | Root scripts must not require private packages             |
| `pnpm-lock.yaml`                     | Include after dependency review      | Must not expose private registry credentials               |
| `pnpm-workspace.yaml`                | Include after workspace split        | Must include public packages only                          |
| `turbo.json`                         | Include after workspace split        | Must not require private tasks                             |
| `eslint.config.js`                   | Include                              | Public lint config                                         |
| `prettier.config.js`                 | Include                              | Public formatting config                                   |
| `tsconfig.json`                      | Include                              | Public TypeScript config                                   |
| `tsconfig.base.json`                 | Include                              | Public TypeScript base config                              |
| `packages/browser`                   | Include                              | Public local package                                       |
| `packages/cli`                       | Include                              | Public local package                                       |
| `packages/core`                      | Include                              | Public local package                                       |
| `packages/crawler`                   | Include                              | Public local package                                       |
| `packages/html`                      | Include                              | Public local package                                       |
| `packages/http`                      | Include                              | Public local package                                       |
| `packages/language`                  | Include                              | Public local package                                       |
| `packages/language-server`           | Include                              | Public local package                                       |
| `packages/lsp`                       | Include                              | Public local package                                       |
| `packages/next`                      | Include                              | Public local package                                       |
| `packages/overlay`                   | Include                              | Public local package                                       |
| `packages/reporter-html`             | Include                              | Public local package                                       |
| `packages/reporter-junit`            | Include                              | Public local package                                       |
| `packages/reporter-sarif`            | Include                              | Public local package                                       |
| `packages/source`                    | Include                              | Public local package                                       |
| `apps/vscode`                        | Include                              | Public VS Code extension                                   |
| `specs`                              | Include                              | Public contracts                                           |
| `docs/examples`                      | Include                              | Sanitized examples only                                    |
| public local docs under `docs/`      | Include after review                 | Exclude private cloud/SaaS ops docs                        |
| `plans/`                             | Review before include                | Public repo may include only public/local governance plans |
| `scripts/`                           | Review before include                | Keep only scripts required by public packages/checks       |

## Proposed Private Repository Paths

| Path or surface                                                       | Private action               | Reason                         |
| --------------------------------------------------------------------- | ---------------------------- | ------------------------------ |
| `apps/dashboard`                                                      | Keep private                 | Closed commercial dashboard    |
| `services/api`                                                        | Keep private                 | Closed commercial API          |
| `services/workers`                                                    | Keep private                 | Closed commercial workers      |
| `infra`                                                               | Keep private                 | Deployment/IaC scope           |
| `Dockerfile.api`                                                      | Keep private unless reviewed | Cloud API runtime              |
| `Dockerfile.worker`                                                   | Keep private unless reviewed | Cloud worker runtime           |
| cloud-specific docs under `docs/`                                     | Keep private or redact       | SaaS operations and deployment |
| cloud-specific plans under `plans/`                                   | Keep private or redact       | SaaS implementation history    |
| generated `reports/`                                                  | Exclude                      | Generated evidence artifacts   |
| `node_modules/`, `dist/`, `.next/`, `.turbo/`, `.cache/`, `coverage/` | Exclude                      | Generated/local artifacts      |
| `.env`, `.env.*`, credentials, tokens, private keys                   | Exclude                      | Sensitive files                |

## Split Preparation Steps

1. Freeze the current monorepo baseline after owner review.
2. Run the sensitive/generated-file scan from
   `docs/BASELINE_READINESS_AUDIT.md`.
3. Classify every path as public, private, generated, or sensitive.
4. Create a temporary public-repo candidate tree from include paths only.
5. Run install, build, lint, typecheck, test, release verification, Next
   fixtures, and rule QA inside the candidate tree.
6. Remove or rewrite scripts that depend on private cloud packages.
7. Verify package manifests do not reference private paths or unpublished
   private packages.
8. Review public docs for cloud/SaaS implementation leakage.
9. Run license/notice/security/trademark review.
10. Obtain owner and legal sign-off before publishing the public repository.

## Public Candidate Validation Commands

Run inside the public candidate repository:

```bash
pnpm install --frozen-lockfile
pnpm format
pnpm lint
pnpm typecheck
pnpm test
pnpm verify:release
pnpm verify:next-fixtures
pnpm rule-qa
```

`pnpm rule-qa:review` becomes required only after real independent reviewer
files are added to the public or release-evidence repository according to the
approved evidence policy.

## Known Split Risks

- Root scripts currently include cloud validators and may need public/private
  script variants.
- Workspace dependencies may currently assume private packages exist.
- Documentation may describe private cloud internals and must be reviewed before
  public release.
- CI currently includes cloud Docker and PostgreSQL jobs that may not belong in
  the public repository.
- The public package lockfile must not retain private package references that
  make clean public install impossible.

## Pass Criteria

Repository boundary preparation passes only when:

- every path is classified;
- the public candidate tree contains no private cloud/SaaS implementation;
- no generated or sensitive files are included;
- public candidate validation commands pass;
- legal review approves the boundary;
- package publication and VS Code release use only public-scope code and docs.

## Current Static Boundary Evidence

- Manifest: `specs/PUBLIC_REPOSITORY_EXPORT_MANIFEST.json`
- Command: `pnpm repo:public-boundary`
- Sample: `docs/examples/public-repository-boundary-report.sample.json`
- Result: public candidate include paths do not include `apps/dashboard`,
  `services/api`, `services/workers`, `infra`, cloud Dockerfiles, generated
  artifacts, or sensitive local environment files.
- Result: public packages and `apps/vscode` do not depend on `@searchlint/api`,
  `@searchlint/dashboard`, or `@searchlint/workers`.
- Command: `pnpm repo:public-split-candidate`
- Sample: `docs/examples/public-repository-split-candidate-report.sample.json`
- Result: a temporary public repository candidate tree is mechanically assembled
  from 39 allowed include paths with 250 files and 16 public package manifests.
- Result: the assembled candidate excludes private cloud implementation paths,
  generated paths, and sensitive path patterns.
- Command: `pnpm repo:public-candidate-validation`
- Sample:
  `docs/examples/public-repository-candidate-validation-report.sample.json`
- Result: the temporary public candidate passes
  `pnpm install --frozen-lockfile`, `pnpm -r --if-present build`,
  `pnpm -r --if-present typecheck`, `pnpm -r --if-present test`, and
  `pnpm verify:release`.
- Remaining gates: hosted public repository creation/protection, hosted public
  CI, legal review, npm publication, and VS Code Marketplace publication.
