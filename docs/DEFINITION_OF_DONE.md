# Definition of Done

Status date: 2026-06-30

This document defines completion requirements for repository tasks. It does not
approve SearchLint 1.0 release.

## General Task Completion

A task is done only when:

- the requested behavior or document state is implemented;
- the change preserves SearchLint 1.0 scope and product invariants;
- the smallest complete scoped change was made;
- relevant specs, docs, examples, or generated reports are updated;
- tests or verifiers cover changed behavior, or the absence of tests is
  explicitly justified;
- validation commands required by the active ExecPlan pass or blockers are
  documented;
- no unrelated files were modified;
- the final diff has been reviewed for regressions.

## Release Gate Completion

A release gate is done only when its dedicated verifier passes and required
evidence exists. Generated sample reports, templates, static readiness docs, or
owner runbooks do not close gates by themselves.

External gates require real evidence from the relevant owner, reviewer, legal
review, provider, marketplace, registry, deployment, security review, backup
drill, or final release action.

## Final Release Completion

SearchLint 1.0 is done only when:

- every final release gate has real passing evidence;
- `pnpm final-release:gate` passes in a current checkout;
- required GitHub hosted governance evidence is still valid;
- no forbidden final release action was performed early;
- `v1.0.0`, final npm publication, VS Code Marketplace release, public website
  launch, and public announcement happen only after the final gate passes.

## Evidence Quality

Evidence must be machine-readable where possible, sanitized, current, and tied
to the exact gate it is meant to close. Evidence must not include secrets,
tokens, credentials, cookies, database URLs, private keys, customer data, or
other sensitive material.

Do not invent evidence. If evidence is missing, the correct status is blocked or
missing, not passed.
