# Package Public/Private Matrix

Status date: 2026-06-30

This matrix classifies SearchLint packages for public release review. It does
not publish packages and does not approve package metadata.

## Public Package Candidates

| Package                      | Scope                                 | Publication state |
| ---------------------------- | ------------------------------------- | ----------------- |
| `@searchlint/browser`        | Browser-side local collection helpers | Public candidate  |
| `@searchlint/cli`            | CLI entry point                       | Public candidate  |
| `@searchlint/core`           | Deterministic rule engine             | Public candidate  |
| `@searchlint/crawler`        | Local crawler package                 | Public candidate  |
| `@searchlint/html`           | HTML parsing helpers                  | Public candidate  |
| `@searchlint/http`           | HTTP collection helpers               | Public candidate  |
| `@searchlint/language`       | SearchLint language parser/contracts  | Public candidate  |
| `searchlint-language-server` | Language server runtime               | Public candidate  |
| `@searchlint/lsp`            | LSP helpers                           | Public candidate  |
| `@searchlint/next`           | Next.js development integration       | Public candidate  |
| `@searchlint/overlay`        | Development overlay and badge         | Public candidate  |
| `@searchlint/reporter-html`  | HTML reporter                         | Public candidate  |
| `@searchlint/reporter-junit` | JUnit reporter                        | Public candidate  |
| `@searchlint/reporter-sarif` | SARIF reporter                        | Public candidate  |
| `@searchlint/source`         | Source analysis helpers               | Public candidate  |

## Private Package Surfaces

| Surface                                                   | Private reason                      |
| --------------------------------------------------------- | ----------------------------------- |
| `@searchlint/dashboard`                                   | Closed commercial dashboard         |
| `@searchlint/api`                                         | Closed commercial API               |
| `@searchlint/workers`                                     | Closed commercial workers           |
| `infra/`                                                  | Deployment and cloud infrastructure |
| Billing, OAuth vault, hosted reports, and SaaS operations | Closed commercial scope             |

## Release Gate

Package publication remains blocked until public package metadata, legal review,
trusted publishing, registry install, and final release gates pass.
