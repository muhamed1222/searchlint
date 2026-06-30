# Open Decisions

Status date: 2026-06-30

This file records unresolved decisions and source-of-truth gaps. It exists
because `AGENTS.md` requires contradictions to be recorded here.

## OD-026: Required Reading Documents Were Missing From Published Main

Status: recorded

`AGENTS.md` requires these files to be read before code, documentation, specs,
plans, tooling, CI, or repository-structure changes:

- `docs/PRODUCT_SPEC.md`
- `docs/ARCHITECTURE.md`
- `docs/TECH_STACK.md`
- `docs/DEFINITION_OF_DONE.md`
- `docs/OPEN_DECISIONS.md`

On 2026-06-30, the published `main` branch did not contain those files even
though `AGENTS.md` required them. This caused a procedural source-of-truth gap
for future changes.

Resolution path: add the missing required-reading documents as governance
reconciliation docs derived from `SEARCHLINT_1_0_DEVELOPMENT_PLAN.md`,
`README.md`, `docs/RELEASE_GOVERNANCE.md`, and the current release gate docs.

## OD-029: Historical ExecPlan Index Is Not Present On Published Main

Status: open

The current `main` branch contains only a small subset of historical ExecPlans
even though multiple docs reference earlier plan numbers. This does not by
itself change release readiness, but it makes historical traceability weaker.

Resolution path: either restore the historical ExecPlan archive or document the
intentional archive boundary and ensure new multi-step changes create current
plans in `plans/`.

## OD-030: SearchLint 1.0 Final Release Remains Externally Blocked

Status: open

`pnpm final-release:gate` remains blocked until real owner, reviewer, legal,
provider, publication, deployment, security, backup, and final release evidence
exists. Generated templates, runbooks, and sample reports are not sufficient.

Resolution path: follow `docs/RELEASE_OWNER_ACTION_RUNBOOK.md` and
`docs/RELEASE_OWNER_EVIDENCE_RUNBOOK.md`, then rerun
`pnpm release:evidence-readiness` and `pnpm final-release:gate`.
