# SearchLint Repository Instructions

## Required Reading

Before changing code, documentation, specs, plans, tooling, CI, or repository
structure, read:

1. `SEARCHLINT_1_0_DEVELOPMENT_PLAN.md`
2. `docs/PRODUCT_SPEC.md`
3. `docs/ARCHITECTURE.md`
4. `docs/TECH_STACK.md`
5. `docs/DEFINITION_OF_DONE.md`
6. `docs/OPEN_DECISIONS.md`
7. The relevant ExecPlan from `plans/`

Do not begin implementation until the relevant specifications and ExecPlan have
been read.

## Source-of-Truth Priority

When documents conflict, use this priority:

1. Approved ADR in `docs/adr/`
2. `docs/PRODUCT_SPEC.md`
3. `docs/ARCHITECTURE.md`
4. Technical contracts in `specs/`
5. Active ExecPlan in `plans/`
6. `SEARCHLINT_1_0_DEVELOPMENT_PLAN.md`
7. Current task description

Do not silently resolve contradictions. Record them in the active ExecPlan under
`Decision log` and, when the decision is still open, in
`docs/OPEN_DECISIONS.md`.

## Product Invariants

- SearchLint 1.0 is the full product described in
  `SEARCHLINT_1_0_DEVELOPMENT_PLAN.md`.
- Do not simplify the product into an MVP, prototype, badge-only tool, or
  partial rewrite unless an approved ADR changes the release scope.
- SearchLint must add 0 KB of production code to the end user's production site.
- SearchLint must create 0 production HTTP requests.
- SearchLint must register 0 production background processes or runtime hooks.
- Rule execution and severity calculation must not require AI.
- The diagnostic engine must be deterministic: the same input must produce the
  same diagnostics.
- Overlay, CLI, IDE/LSP, Crawler, CI, and Cloud must use the same rule engine.
- Do not duplicate rule logic between Overlay, CLI, IDE/LSP, Crawler, CI, and
  Cloud.
- Every diagnostic must include a stable rule ID and evidence.
- Never invent a file, line, source, selector, external observation, or evidence
  for a diagnostic.
- File and line locations may be shown only when proven by source analysis.
- External search-engine observations must include their observation date and
  freshness.
- Blockers must never rely only on subjective heuristics.

## ExecPlan Requirement

Every large feature, architectural change, package boundary change, public
contract change, or multi-step implementation requires an ExecPlan in `plans/`.

The ExecPlan must be created or updated before implementation starts and must
stay current as facts, progress, risks, and decisions change.

## Development Workflow

For every task:

1. Read the required documents.
2. Analyze the current repository state before editing.
3. Update or create the relevant ExecPlan when the task is large or
   architectural.
4. Define acceptance criteria before implementation.
5. Make the smallest complete change that satisfies the task.
6. Add or update tests when behavior changes.
7. Update documentation and specs when contracts or behavior change.
8. Run the documented validation commands for the current repository state.
9. Review the complete diff before marking work complete.

## Current Foundation Constraint

OD-001 through OD-008 and OD-011 through OD-015 are approved. Package manager
files, dependency installation, lockfile creation, and CI workflow creation are
allowed only inside approved ExecPlan 002.

Until ExecPlan 002 is explicitly started:

- do not create product source code;
- do not install dependencies;
- do not create package manager lockfiles;
- do not create or modify CI workflows;
- do not create fake implementations or no-op product scripts.

Pending OD-009, OD-010, and OD-016 through OD-025 must not be implemented before
their ADRs are accepted.

## Completion Requirements

A task is complete only when:

- acceptance criteria are satisfied;
- tests required by the task exist or the absence of tests is explicitly
  justified;
- relevant documentation is updated;
- relevant specs are updated;
- validation commands for the current stage pass or blockers are documented;
- no unrelated files were modified;
- the active ExecPlan reflects the actual state;
- the final diff has been reviewed for regressions.
