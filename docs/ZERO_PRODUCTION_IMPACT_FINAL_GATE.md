# Zero Production Impact Final Gate

Status date: 2026-06-23

`pnpm zero-impact:final` is the aggregate deterministic gate for the SearchLint
zero-production-impact invariant.

## Verified Scope

The command verifies the approved Next.js compatibility matrix:

- Next.js 15 App Router;
- Next.js 15 Pages Router;
- Next.js 16 App Router;
- Next.js 16 Pages Router.

For each fixture, the verifier proves:

- SearchLint dev client injection happens only in development;
- packed public package candidates install into clean fixture projects;
- production client chunks contain 0 SearchLint bytes;
- production client chunks contain 0 SearchLint modules;
- production server chunks contain 0 SearchLint modules;
- production browser requests have 0 SearchLint request delta;
- production runtime has 0 SearchLint DOM nodes;
- production runtime has 0 SearchLint globals;
- production runtime has 0 SearchLint listeners and observers;
- normalized route HTML and response headers are unchanged.

## Command

```bash
pnpm zero-impact:final
```

The command runs:

- `pnpm verify:zero-impact`;
- `pnpm verify:next-fixtures`.

It then parses `reports/next-fixture-zero-impact-report.json` and writes a
sanitized aggregate report.

## Evidence

The verifier writes:

```text
reports/zero-production-impact-final-report.json
docs/examples/zero-production-impact-final-report.sample.json
```

Generated reports under `reports/` remain CI artifacts. The checked-in sample is
deterministic and sanitized.

## Non-Claims

This gate does not claim:

- packages downloaded from the public npm registry;
- Next.js versions outside the approved OD-003 matrix;
- cloud/dashboard production E2E;
- SearchLint 1.0 final release approval.

Those remain covered by separate final release gates.
