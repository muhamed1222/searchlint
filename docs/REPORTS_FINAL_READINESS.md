# Reports Final Readiness

Status date: 2026-06-23

`pnpm reports:final-readiness` is the aggregate deterministic gate for the
SearchLint 1.0 report surface.

## Verified Scope

The command verifies that the following report capabilities have current
evidence:

- SARIF reporter output;
- JUnit reporter output;
- HTML local report templates;
- binary PDF export;
- deterministic static PDF rendering;
- technical, client, executive, developer, before/after, deployment, Google,
  Yandex, and white-label report variants;
- hosted report links static contract;
- report expiration static contract;
- hosted report access-controls static contract;
- report history static contract.

## Command

```bash
pnpm reports:final-readiness
```

The command runs:

- `pnpm reporters:acceptance`;
- `pnpm reporters:pdf-rendering`;
- `pnpm reports:hosted-links-static`;
- `pnpm reports:expiration-static`;
- `pnpm reports:access-controls-static`;
- `pnpm reports:history-static`.

It also verifies the required report documents and sanitized sample evidence.

## Evidence

The verifier writes:

```text
reports/reports-final-readiness-report.json
docs/examples/reports-final-readiness-report.sample.json
```

Generated reports under `reports/` remain CI artifacts. The checked-in sample is
deterministic and sanitized.

## Non-Claims

This gate does not claim:

- live hosted report API route deployment;
- live S3 signed URL behavior;
- live identity-provider access-control E2E;
- deployed dashboard report-history UI;
- cloud deployment readiness outside report contracts;
- SearchLint 1.0 final release approval.

Those remain covered by separate final release gates.
