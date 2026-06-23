# Contributing to SearchLint

SearchLint accepts contributions to the public local developer product scope
after the public repository boundary is approved.

## Public Contribution Scope

Contributions may target:

- local/core packages;
- CLI;
- crawler;
- DSL/language and LSP;
- Next.js integration;
- overlay;
- reporters;
- VS Code extension;
- specs and documentation for the local developer product;
- deterministic test fixtures and sanitized examples.

## Closed Commercial Scope

Contributions are not accepted in the public repository for:

- dashboard;
- API;
- workers;
- infrastructure;
- billing;
- OAuth vault operations;
- hosted reports;
- SaaS operations.

Those surfaces remain in the private commercial repository boundary unless a
future accepted ADR changes the model.

## Developer Certificate of Origin

SearchLint uses Developer Certificate of Origin 1.1.

Every commit must include a sign-off:

```text
Signed-off-by: Your Name <your.email@example.com>
```

Use:

```bash
git commit -s
```

The full DCO text is in `DCO.md`.

## License

Public-scope contributions are submitted under Apache-2.0 unless a file clearly
states another approved license.

The SearchLint name and logo are not granted by Apache-2.0 and are governed by
the SearchLint trademark policy.

## Release Gate

Public contribution intake and publication remain gated on legal review of:

- `LICENSE`;
- `NOTICE`;
- `CONTRIBUTING.md`;
- `SECURITY.md`;
- `DCO.md`;
- trademark policy;
- package metadata;
- public/private repository boundary.
