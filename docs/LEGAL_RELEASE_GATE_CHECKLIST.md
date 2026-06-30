# Legal Release Gate Checklist

Status date: 2026-06-22

This checklist operationalizes OD-016 and ADR 0028. It is not legal approval.
SearchLint public release remains blocked until qualified legal review approves
the items below.

Machine-readable verification is provided by:

```bash
pnpm legal:release-gate
```

The command is expected to fail until `docs/legal-release-approval.json`
contains real qualified approval.

## Release Gate Status

| Gate                                      | Status                        | Evidence required                                                      |
| ----------------------------------------- | ----------------------------- | ---------------------------------------------------------------------- |
| Apache-2.0 public-scope license review    | Pending legal review          | Approved `LICENSE` and package metadata                                |
| `NOTICE` review                           | Pending legal review          | Approved attribution and trademark exclusion language                  |
| `CONTRIBUTING.md` review                  | Pending legal review          | Approved contribution scope and DCO process                            |
| `DCO.md` review                           | Pending legal review          | Approved DCO 1.1 usage and sign-off process                            |
| `SECURITY.md` review                      | Pending legal/security review | Approved contact, response SLA, disclosure, supported versions         |
| Trademark policy review                   | Pending legal review          | Approved policy for SearchLint name/logo/service marks                 |
| Public/private repository boundary review | Pending legal/owner review    | Approved path-level split plan                                         |
| Package metadata review                   | Pending legal/release review  | Approved license, repository, homepage, bugs, keywords, files, exports |
| VS Code Marketplace copy review           | Pending legal/release review  | Approved name, logo, privacy, telemetry, support copy                  |
| Website/onboarding copy review            | Pending legal/release review  | Approved public product, pricing, trademark, privacy, support copy     |

## Public Scope To Review

Public/open-source release candidates:

- `packages/browser`
- `packages/cli`
- `packages/core`
- `packages/crawler`
- `packages/html`
- `packages/http`
- `packages/language`
- `packages/language-server`
- `packages/lsp`
- `packages/next`
- `packages/overlay`
- `packages/reporter-html`
- `packages/reporter-junit`
- `packages/reporter-sarif`
- `packages/source`
- `apps/vscode`
- `specs`
- local developer product docs
- deterministic test fixtures required by public local tools
- sanitized examples under `docs/examples`

## Private Commercial Scope To Exclude

The following must not be released into the public repository without a future
approved ADR and legal review:

- `apps/dashboard`
- `services/api`
- `services/workers`
- `infra`
- dashboard implementation
- API implementation
- worker implementation
- billing implementation
- OAuth vault operations
- hosted reports implementation
- SaaS operations docs
- production deployment runbooks
- secrets, credentials, tokens, customer data, or private operational evidence

## Required Legal Questions

The owner/legal reviewer must explicitly answer:

1. Is Apache-2.0 acceptable for the listed public local developer scope?
2. Does the `NOTICE` file include the correct copyright holder and attribution?
3. Is the trademark exclusion language sufficient?
4. Is the draft trademark policy acceptable for public release?
5. Is DCO 1.1 sufficient for contributions, or is a CLA required?
6. Is the public contribution scope narrow enough to exclude commercial cloud
   implementation?
7. Does the repository split plan fully exclude private cloud/SaaS code?
8. Are package names, README text, VS Code Marketplace text, website text, and
   screenshots consistent with the trademark and licensing policy?
9. Does the security policy identify an approved vulnerability contact and
   disclosure timeline?
10. Are privacy, telemetry, benchmark, and fixture data policies adequate before
    public release?

## Files Requiring Legal Approval

- `LICENSE`
- `NOTICE`
- `CONTRIBUTING.md`
- `DCO.md`
- `SECURITY.md`
- `docs/TRADEMARK_POLICY_DRAFT.md`
- `docs/RELEASE_GOVERNANCE.md`
- `docs/PACKAGE_PUBLIC_PRIVATE_MATRIX.md`
- `docs/PUBLIC_PRIVATE_REPOSITORY_BOUNDARY_PLAN.md`
- package manifests for public packages
- VS Code Marketplace README/changelog/privacy copy
- public website and onboarding copy

## Pass Criteria

This gate passes only when:

- the legal reviewer approves the files above;
- `pnpm legal:release-gate` passes with `docs/legal-release-approval.json`
  evidence;
- required text changes are committed;
- public/private repository split is reviewed against the approved boundary;
- package publication and VS Code publication use the approved metadata/copy;
- `docs/PROJECT_PROGRESS.md` and `docs/SEARCHLINT_1_0_MASTER_CHECKLIST.md` are
  updated with evidence links.

Until then, the legal release gate remains open.
