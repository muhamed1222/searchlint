# SearchLint Public Website and Onboarding Source

Status date: 2026-06-22

This document is the source package for the SearchLint public website and
onboarding content. It is deterministic documentation evidence, not a deployed
public domain.

## Website Navigation

| Page                          | Purpose                                                           | Source                                                                  |
| ----------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `/`                           | Product overview, local tools, cloud platform, and release status | this document                                                           |
| `/install`                    | Installation and quick start                                      | `docs/ONBOARDING_GUIDE.md`                                              |
| `/nextjs`                     | Next.js setup and zero-production-impact guidance                 | `docs/NEXTJS_INSTALLATION.md`                                           |
| `/cli`                        | CLI and CI usage                                                  | `docs/CLI_CI_USAGE.md`                                                  |
| `/vscode`                     | VS Code and LSP usage                                             | `docs/VSCODE_LSP_USAGE.md`                                              |
| `/rules`                      | Rule catalog                                                      | `docs/rules/README.md`                                                  |
| `/dsl`                        | `searchlint.seo` DSL                                              | `specs/SEARCHLINT_LANGUAGE_SPEC.md`                                     |
| `/api`                        | Cloud API documentation source                                    | `docs/API_DOCUMENTATION.md`                                             |
| `/integrations/google-yandex` | Google/Yandex integration guidance                                | `docs/GOOGLE_SEARCH_CONSOLE_ACCEPTANCE.md`, `docs/YANDEX_ACCEPTANCE.md` |
| `/examples`                   | Demo project and sample reports                                   | `docs/examples/demo-project/README.md`                                  |
| `/faq`                        | FAQ                                                               | `docs/FAQ.md`                                                           |
| `/troubleshooting`            | Troubleshooting                                                   | `docs/TROUBLESHOOTING.md`                                               |
| `/support`                    | Support, security, and contact flow                               | `docs/SUPPORT_POLICY.md`, `docs/VULNERABILITY_DISCLOSURE.md`            |

## Product Overview

SearchLint is a deterministic SEO diagnostics product for local development, CI,
IDE workflows, crawling, reporting, and a future hosted cloud platform. Rule
execution is deterministic and does not use AI.

## Local Tools

The public local developer product includes:

- `@searchlint/core`;
- CLI;
- crawler;
- `searchlint.seo` DSL;
- LSP and VS Code extension;
- Next.js development integration;
- badge and overlay;
- SARIF, JUnit, and HTML reporters;
- rule catalog, specs, and local documentation.

## Cloud Platform

The closed commercial cloud platform includes dashboard, API, workers, hosted
reports, OAuth vault operations, billing, external integrations, observability,
and SaaS operations. The current repository contains deterministic contracts and
acceptance evidence, but live cloud deployment remains a release gate.

## Pricing

Pricing source remains a release-gated commercial topic. Current deterministic
billing evidence covers starter, team, agency, and enterprise plan-limit
contracts in `docs/BILLING_ACCEPTANCE.md`. Release-candidate public pricing and
Stripe product/price setup are documented in
`docs/BILLING_PRICING_STATIC_PACKET.md`. Public pricing copy requires final
owner and legal approval before publication.

## Public Release Warning

The public website must not claim:

- published npm packages before package publication is complete;
- a published VS Code extension before Marketplace release is complete;
- live cloud availability before deployed acceptance is complete;
- live Google/Yandex integrations before provider acceptance is complete;
- security/pentest completion before external evidence exists.

## Acceptance Evidence

`pnpm website:acceptance` verifies this source package, the linked onboarding
docs, and the demo project.
