# Current Product Status

Status date: 2026-06-23

## Audit Verdict

SearchLint currently has a substantial local developer-analysis foundation, but
it is not release-ready and it is not a complete SearchLint 1.0 product.

The shared core contains implementation bindings for all 120 catalog rule IDs,
the real checked-in catalog now loads through the production loader, and the
implemented public package candidates can be built, packed, installed, imported,
and typechecked from a clean consumer project. The development badge/overlay and
Next.js dev-only integration now have local runtime and zero-impact fixture
coverage. Major 1.0 product surfaces remain scaffold-only or not started.

## Environment

| Check                                                    | Result                                                                       |
| -------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Local default Node                                       | `v22.22.2`                                                                   |
| Required Node                                            | `>=24.0.0`                                                                   |
| Node 24 audit runtime                                    | `v24.17.0` via `npx -y node@24`                                              |
| pnpm                                                     | `11.8.0`                                                                     |
| `pnpm install --frozen-lockfile`                         | Passed under Node 24                                                         |
| `pnpm format`                                            | Passed under Node 24                                                         |
| `pnpm lint`                                              | Passed under Node 24                                                         |
| `pnpm typecheck`                                         | Passed under Node 24                                                         |
| `pnpm test`                                              | Passed under Node 24 across 19 workspace projects                            |
| `pnpm verify:release`                                    | Passed under Node 24                                                         |
| `pnpm package:dry-run`                                   | Passed under Node 24; still blocked on approved public URLs/legal gates      |
| `pnpm package:registry-install`                          | Passed under Node 24 for ephemeral npm-like registry install acceptance      |
| `pnpm package:release-workflow`                          | Passed under Node 24 for hosted npm release workflow static contract         |
| `pnpm package:metadata-approval`                         | Expected fail until owner-approved public package URLs exist                 |
| `pnpm verify:zero-impact`                                | Passed under Node 24                                                         |
| `pnpm zero-impact:final`                                 | Passed under Node 24 for aggregate zero-production-impact final evidence     |
| `pnpm verify:next-fixtures`                              | Passed under Node 24 for four real fixtures                                  |
| `pnpm overlay:manual-a11y-review`                        | Expected fail until real manual WCAG/screen-reader reviewer evidence exists  |
| `pnpm lsp-vscode:acceptance`                             | Passed under Node 24 for LSP, VS Code metadata, icon, and screenshots        |
| `pnpm lsp:workspace-acceptance`                          | Passed under Node 24 for multi-file/stale/large-workspace LSP acceptance     |
| `pnpm vscode:vsix-readiness`                             | Passed under Node 24 for generated local VSIX package readiness              |
| `pnpm vscode:clean-install-e2e`                          | Passed under Node 24 using isolated downloaded VS Code test host             |
| `pnpm vscode:update-e2e`                                 | Passed under Node 24 for local VSIX update from alpha to beta                |
| `pnpm rule-qa`                                           | Passed; generated rule QA and blocker reports                                |
| `pnpm rule-qa:review-handoff`                            | Passed under Node 24 for blocker benchmark review handoff packet             |
| `pnpm rule-qa:review-delivery`                           | Expected fail until owner-provided review packet delivery evidence exists    |
| `pnpm rule-qa:review`                                    | Expected fail: missing real reviewer files                                   |
| `pnpm reporters:acceptance`                              | Passed under Node 24 for SARIF/JUnit/HTML/PDF reporter acceptance            |
| `pnpm reporters:pdf-rendering`                           | Passed under Node 24 for deterministic static PDF rendering acceptance       |
| `pnpm reports:hosted-links-static`                       | Passed under Node 24 for hosted report link static contract                  |
| `pnpm reports:expiration-static`                         | Passed under Node 24 for report expiration static contract                   |
| `pnpm reports:access-controls-static`                    | Passed under Node 24 for hosted report access-control static contract        |
| `pnpm reports:history-static`                            | Passed under Node 24 for hosted report history static contract               |
| `pnpm reports:final-readiness`                           | Passed under Node 24 for aggregate reports final-readiness evidence          |
| `pnpm cli:acceptance`                                    | Passed under Node 24 for local pnpm tarball install on macOS                 |
| `pnpm cli:windows-acceptance`                            | Passed under Node 24; native Windows runner proof remains blocked            |
| `pnpm google:oauth-static`                               | Passed under Node 24 for static Google OAuth app configuration readiness     |
| `pnpm google:consent-readiness`                          | Passed under Node 24 for Google consent verification readiness packet        |
| `pnpm google:gsc-site-static`                            | Passed under Node 24 for static Search Console site connection readiness     |
| `pnpm google:gsc-retry-backoff`                          | Passed under Node 24 for deterministic Google GSC retry/backoff acceptance   |
| `pnpm google:gsc-stale-states`                           | Passed under Node 24 for deterministic Google GSC stale-state acceptance     |
| `pnpm google:performance:acceptance`                     | Passed under Node 24 for deterministic PageSpeed/CrUX proof                  |
| `pnpm google:performance-history`                        | Passed under Node 24 for deterministic PageSpeed/CrUX metric history         |
| `pnpm yandex:oauth-static`                               | Passed under Node 24 for static Yandex OAuth app configuration readiness     |
| `pnpm yandex:webmaster-site-static`                      | Passed under Node 24 for static Yandex Webmaster site connection readiness   |
| `pnpm yandex:metrica-counter-static`                     | Passed under Node 24 for static Yandex Metrica counter connection readiness  |
| `pnpm yandex:acceptance`                                 | Passed under Node 24 for deterministic Yandex proof                          |
| `pnpm history:acceptance`                                | Passed under Node 24 for deterministic history proof                         |
| `pnpm history:deployment-persistence`                    | Passed under Node 24 for deployment history persistence contract/store proof |
| `pnpm history:page-snapshot-persistence`                 | Passed under Node 24 for page snapshot history persistence contract/store    |
| `pnpm history:rollup-persistence`                        | Passed under Node 24 for diagnostic/external-observation rollup persistence  |
| `pnpm notifications:acceptance`                          | Passed under Node 24 for deterministic notifications proof                   |
| `pnpm notifications:workers-static`                      | Passed under Node 24 for notification worker/scheduler static contract       |
| `pnpm notifications:persistence-static`                  | Passed under Node 24 for notification settings persistence static contract   |
| `pnpm notifications:redaction-review`                    | Passed under Node 24 for notification log/telemetry redaction review packet  |
| `pnpm billing:pricing-static`                            | Passed under Node 24 for public pricing/Stripe blueprint static packet       |
| `pnpm billing:stripe-setup-packet`                       | Passed under Node 24 for Stripe products/prices live setup packet            |
| `pnpm billing:checkout-acceptance-packet`                | Passed under Node 24 for live checkout payment acceptance packet             |
| `pnpm billing:customer-portal-acceptance-packet`         | Passed under Node 24 for live customer portal acceptance packet              |
| `pnpm billing:subscription-lifecycle-acceptance-packet`  | Passed under Node 24 for live subscription lifecycle acceptance packet       |
| `pnpm billing:webhook-rds-acceptance-packet`             | Passed under Node 24 for deployed Stripe webhook RDS acceptance packet       |
| `pnpm billing:live-stripe-final-acceptance-packet`       | Passed under Node 24 for final live Stripe acceptance packet                 |
| `pnpm billing:acceptance`                                | Passed under Node 24 for deterministic billing proof                         |
| `pnpm agency:acceptance`                                 | Passed under Node 24 for deterministic agency proof                          |
| `pnpm agency:persistence-acceptance-packet`              | Passed under Node 24 for agency production persistence packet                |
| `pnpm agency:client-workspace-persistence`               | Passed under Node 24 for agency client workspace persistence contract/store  |
| `pnpm agency:client-access-browser-e2e`                  | Passed under Node 24 for local hosted-dashboard client-access browser E2E    |
| `pnpm agency:hosted-white-label-links`                   | Passed under Node 24 for agency hosted white-label report-link contracts     |
| `pnpm agency:brand-domain-contract`                      | Passed under Node 24 for agency brand asset and custom-domain contracts      |
| `pnpm observability:acceptance`                          | Passed under Node 24 for deterministic observability proof                   |
| `pnpm observability:error-tracking`                      | Passed under Node 24 for deterministic error-tracking contract               |
| `pnpm security:acceptance`                               | Passed under Node 24; external release gates remain blocked                  |
| `pnpm security:dependency-audit`                         | Passed under Node 24 with 0 reported pnpm audit vulnerabilities              |
| `pnpm security:sast`                                     | Passed under Node 24 with 0 unreviewed static SAST findings                  |
| `pnpm security:dast`                                     | Expected fail until deployed DAST dashboard/API targets are configured       |
| `pnpm security:pentest`                                  | Expected fail until DAST pass, independent report, and owner approval exist  |
| `pnpm security:privacy-requests`                         | Passed under Node 24 for deterministic privacy request execution             |
| `pnpm website:acceptance`                                | Passed under Node 24 for website/onboarding source proof                     |
| `pnpm onboarding:final`                                  | Passed under Node 24 for source-level onboarding final evidence              |
| `pnpm governance:required-ci-checks`                     | Passed under Node 24 for hosted GitHub required status checks                |
| `pnpm governance:hosted-github-evidence`                 | Passed under Node 24 for hosted GitHub governance evidence                   |
| `pnpm governance:hosted-github-evidence:self-test`       | Passed under Node 24 for hosted GitHub evidence verifier hardening           |
| `pnpm governance:hosted-github-evidence:runbook`         | Passed under Node 24; ready for hosted GitHub owner collection               |
| `pnpm governance:hosted-github-evidence:owner-guide`     | Passed under Node 24 for exact hosted GitHub owner input guide               |
| `pnpm release:owner-evidence-runbook`                    | Passed under Node 24 for aggregated 63-input owner evidence runbook          |
| `pnpm release:owner-evidence-package-status`             | Passed under Node 24 for 7-package owner evidence status                     |
| `pnpm release:governance-legal-package`                  | Expected fail until hosted GitHub evidence and legal approval exist          |
| `pnpm release:publication-package:owner-guide`           | Passed under Node 24 for exact npm/VS Code publication owner input guide     |
| `pnpm release:publication-package`                       | Expected fail until npm/VS Code publication owner evidence exists            |
| `pnpm release:reviewer-rule-quality-package`             | Expected fail until delivery evidence and two reviewer files exist           |
| `pnpm release:reviewer-rule-quality-owner-guide`         | Passed under Node 24 for exact reviewer/rule-quality owner input guide       |
| `pnpm release:reviewer-rule-quality-preflight:self-test` | Passed under Node 24 for reviewer/rule-quality evidence preflight self-test  |
| `pnpm legal:release-gate`                                | Expected fail until qualified legal approval evidence exists                 |
| `pnpm legal:release-gate:owner-guide`                    | Passed under Node 24 for exact legal approval owner input guide              |
| `pnpm docs:final-readiness`                              | Passed under Node 24 for aggregate release documentation readiness           |
| `pnpm rc:matrix`                                         | Passed under Node 24; SearchLint 1.0 RC remains blocked                      |
| `pnpm final-release:gate`                                | Passed under Node 24; final release remains blocked                          |
| `pnpm repo:public-boundary`                              | Passed under Node 24 for static public repository boundary verification      |
| `pnpm repo:public-split-candidate`                       | Passed under Node 24 for mechanical public repository candidate assembly     |
| `pnpm repo:public-candidate-validation`                  | Passed under Node 24 for temporary public candidate install/build/test       |
| `pnpm workers:concurrency`                               | Passed under Node 24 for local worker concurrency contract                   |
| `pnpm workers:backoff-cancel`                            | Passed under Node 24 for worker backoff/cancellation proof                   |
| `pnpm workers:job-history`                               | Passed under Node 24 for worker job-history local proof                      |
| `pnpm db:pool-transaction`                               | Passed under Node 24 for DB pool/transaction contract                        |
| `pnpm db:restore-pitr`                                   | Passed under Node 24 for DB restore/PITR local contract                      |
| `pnpm db:migrations-real`                                | Passed under Node 24 for real temporary PostgreSQL migration execution       |
| `pnpm verify:postgres`                                   | Passed under Node 24 against a real temporary local PostgreSQL database      |
| `pnpm backup:restore-live-gate`                          | Expected fail until live RDS/PITR/S3 restore drill evidence exists           |
| `pnpm release:production-platform-package`               | Expected fail until production platform owner evidence exists                |
| `pnpm db:load-benchmark`                                 | Passed under Node 24 for DB load benchmark local contract                    |
| `pnpm object-storage:upload-contract`                    | Passed under Node 24 for snapshot and crawl artifact upload contracts        |
| `pnpm core:benchmark`                                    | Passed under Node 24 for 120-rule local engine benchmark                     |
| `pnpm rule:compatibility`                                | Passed under Node 24 for 120-rule compatibility baseline                     |
| `pnpm core:real-corpus`                                  | Passed under Node 24 for real-site-derived regression corpus                 |
| `pnpm core:false-positive-review`                        | Passed under Node 24 for real-project false-positive review gate             |
| `pnpm core:large-site`                                   | Passed under Node 24 for large-site rule execution                           |
| `pnpm crawler:recovery`                                  | Passed under Node 24 for crawler checkpoint/resume recovery                  |
| `pnpm crawler:dedupe-rate`                               | Passed under Node 24 for crawler rate/dedupe acceptance                      |
| `pnpm dashboard:static-deployment`                       | Passed under Node 24 for static dashboard deployment readiness               |
| `pnpm dashboard:api-connection-static`                   | Passed under Node 24 for static dashboard API connection readiness           |
| `pnpm dashboard:auth-connection-static`                  | Passed under Node 24 for static dashboard auth connection readiness          |
| `pnpm dashboard:production-e2e`                          | Passed under Node 24 in harness mode; live deployed URL gate remains blocked |

The default installed Node on the machine is still Node 22, but the requested
final validation commands were executed successfully through a Node 24 runtime.

## Baseline Commit Evidence

Completed 389 scope:

- confirmed current branch is `main`;
- confirmed repository history includes
  `0de41d7 chore: establish SearchLint baseline`;
- confirmed follow-up rule QA evidence commit exists as
  `425fe6d test: add rule QA matrix and blocker precision evidence`;
- updated baseline governance docs and the master checklist to mark only the
  proven baseline commit item complete;
- hosted branch protection and required hosted CI checks remain open external
  gates.

## Branch Protection Owner Gate

Completed 390 scope:

- added `pnpm governance:branch-protection`;
- added reviewed payload `docs/github/branch-protection-main.json`;
- added `docs/BRANCH_PROTECTION_OWNER_GATE.md`;
- generated deterministic sanitized evidence at
  `docs/examples/branch-protection-owner-gate-report.sample.json`;
- confirmed the current checkout has no GitHub `origin` remote, so the verifier
  fails as expected with `blocked_until_remote`;
- protected branch and required hosted CI checks remain open until a real GitHub
  repository remote exists and hosted branch protection is configured.

## Required CI Checks Owner Gate

Completed 434 scope:

- added `pnpm governance:required-ci-checks`;
- added `docs/REQUIRED_CI_CHECKS_OWNER_GATE.md`;
- generated deterministic sanitized evidence at
  `docs/examples/required-ci-checks-owner-gate-report.sample.json`;
- verified `.github/workflows/ci.yml` and
  `docs/github/branch-protection-main.json` agree on the required status checks;
- confirmed hosted GitHub `main` enforces the seven required CI checks.

## Hosted GitHub Governance Evidence Verifier

Completed 435 scope:

- added `pnpm governance:hosted-github-evidence`;
- added `docs/GITHUB_GOVERNANCE_EVIDENCE.md`;
- added template `docs/github/hosted-governance-evidence.example.json`;
- added expected real evidence path
  `docs/github/hosted-governance-evidence.json` to protected-branch and
  required-CI owner-gate evidence mapping;
- generated deterministic sanitized sample evidence at
  `docs/examples/hosted-github-governance-evidence-report.sample.json`;
- confirmed `docs/github/hosted-governance-evidence.json` validates the hosted
  GitHub repository, protected `main` branch, and seven required CI checks.

Completed 436 scope:

- added `pnpm governance:hosted-github-evidence:self-test`;
- self-test covers valid hosted GitHub governance evidence plus rejected missing
  required checks, copied placeholders, sensitive GitHub tokens, weak branch
  protection, and failed CI run evidence;
- generated deterministic sanitized self-test evidence at
  `docs/examples/hosted-github-governance-evidence-self-test-report.sample.json`;
- hosted GitHub evidence is present; the broader release gate remains blocked on
  other external owner evidence.

Completed 437 scope:

- added `pnpm governance:hosted-github-evidence:runbook`;
- generated `docs/GITHUB_GOVERNANCE_EVIDENCE_COLLECTION_RUNBOOK.md`;
- generated deterministic sanitized runbook evidence at
  `docs/examples/hosted-github-governance-evidence-runbook-report.sample.json`;
- runbook lists exact non-mutating `git` and `gh` commands for collecting
  branch-protection and latest successful CI metadata;
- current runbook status is `ready_for_owner_collection` for the hosted GitHub
  repository.

Completed 443 scope:

- added `pnpm governance:hosted-github-evidence:owner-guide`;
- generated `docs/GITHUB_GOVERNANCE_OWNER_INPUT_GUIDE.md`;
- generated deterministic sanitized sample evidence at
  `docs/examples/hosted-github-governance-owner-guide-report.sample.json`;
- documented the exact hosted GitHub evidence file, template, seven required
  checks, collection commands, validation commands, forbidden evidence classes,
  self-test status, and current package status;
- current status remains `owner_input_required` because
  `docs/github/hosted-governance-evidence.json` is missing and no real GitHub
  `origin` is configured.

Completed 444 scope:

- added `pnpm legal:release-gate:owner-guide`;
- generated `docs/LEGAL_RELEASE_APPROVAL_OWNER_INPUT_GUIDE.md`;
- generated deterministic sanitized sample evidence at
  `docs/examples/legal-release-approval-owner-guide-report.sample.json`;
- documented the exact legal approval file, template, 14 required files, 8
  required scopes, 10 required answer keys, validation commands, forbidden
  evidence classes, and current package status;
- current status remains `owner_input_required` because
  `docs/legal-release-approval.json` is missing.

Completed 445 scope:

- added `pnpm release:governance-legal-package`;
- generated `docs/GOVERNANCE_LEGAL_PACKAGE_GATE.md`;
- generated deterministic sanitized sample evidence at
  `docs/examples/governance-legal-package-gate-report.sample.json`;
- aggregated hosted GitHub owner guide, legal owner guide, hosted GitHub
  evidence, branch protection, required CI checks, legal release gate, and owner
  package status into one package-level gate;
- current status remains `blocked_missing_governance_legal_evidence` because
  `docs/github/hosted-governance-evidence.json` and
  `docs/legal-release-approval.json` are missing.

Completed 446 scope:

- added `pnpm release:publication-package:owner-guide`;
- generated `docs/PUBLICATION_PACKAGE_OWNER_INPUT_GUIDE.md`;
- generated deterministic sanitized sample evidence at
  `docs/examples/publication-package-owner-guide-report.sample.json`;
- documented the nine required npm/VS Code publication owner inputs, related
  gates, evidence groups, forbidden evidence classes, and non-claims;
- current status remains `owner_input_required` because all nine publication
  owner input files are missing.

Completed 447 scope:

- added `pnpm release:publication-package`;
- generated `docs/PUBLICATION_PACKAGE_GATE.md`;
- generated deterministic sanitized sample evidence at
  `docs/examples/publication-package-gate-report.sample.json`;
- aggregated publication owner guide, package metadata approval, beta
  publication gate, npm-like registry install, VS Code local update E2E, final
  release gate, and owner package status into one package-level gate;
- current status remains `blocked_missing_publication_evidence` with nine
  missing owner input files and one expected failing command:
  `pnpm package:metadata-approval`.

Completed 448 scope:

- added `pnpm release:production-platform-package`;
- generated `docs/PRODUCTION_PLATFORM_PACKAGE_GATE.md`;
- generated deterministic sanitized sample evidence at
  `docs/examples/production-platform-package-gate-report.sample.json`;
- aggregated production platform owner package status, backup/restore live gate,
  crawler acceptance, PostgreSQL proof, object storage, API, dashboard
  production E2E harness, agency, observability, auth, OAuth vault, and workers
  acceptance into one package-level gate;
- current status remains `blocked_missing_production_platform_evidence` with 21
  missing owner input files and one expected failing command:
  `pnpm backup:restore-live-gate`.

Completed 449 scope:

- added `pnpm site:outlivion-live-crawl`;
- added a cautious owner-authorized live-site crawl verifier for
  `https://outlivion.space/`;
- generated sanitized live-site evidence at
  `reports/outlivion-live-site-crawl-report.json`;
- generated sanitized sample evidence at
  `docs/examples/outlivion-live-site-crawl-report.sample.json`;
- verified `robots.txt` and sitemap access, then crawled 126 sitemap URLs with
  same-origin, robots-aware, bounded crawler settings;
- recorded 126 crawled pages, 128 total requests, 0 failed URLs, 6 skipped URLs,
  0 duplicate-content groups, and 692 diagnostics;
- current release status remains blocked because this real-site crawl evidence
  does not replace OD-023 independent reviewer sign-off, Google/Yandex live
  provider acceptance, cloud 100,000 URL crawl proof, or final release gates.

Completed 450 scope:

- changed `searchlint init` from config-only output into local Next.js dev badge
  onboarding;
- preserved the old config generator as `searchlint init --print-config`;
- `searchlint init` now detects Next.js projects, creates `searchlint.seo` when
  missing, patches supported `next.config.mjs`, `next.config.js`, and
  `next.config.cjs` files, and adds local SearchLint package scripts;
- unsupported `next.config.ts` patching fails with a clear message instead of
  rewriting the file;
- `@searchlint/next` now includes a generated bundled rule catalog module, so
  ordinary Next.js setup can use `withSearchLint(nextConfig)` without manually
  passing `catalogText`;
- `@searchlint/next` package tarballs include `RULE_CATALOG.yaml` and the
  generated catalog module;
- Next.js docs, installation docs, CLI usage docs, and README now describe the
  one-command local badge flow: `searchlint init`, then `npm run dev`;
- `pnpm verify:next-fixtures` passed for four clean Next.js 15/16 App/Pages
  fixture projects, verifying dev badge/overlay behavior and production
  zero-impact comparison.

Completed 438 scope:

- added `pnpm release:owner-evidence-runbook`;
- generated `docs/RELEASE_OWNER_EVIDENCE_RUNBOOK.md`;
- generated deterministic sanitized sample evidence at
  `docs/examples/release-owner-evidence-runbook-report.sample.json`;
- grouped all 63 missing owner-input evidence files into practical owner
  evidence packages with templates, related commands, gate counts, and owner
  actions;
- real owner evidence remains 0/52 and release readiness remains
  `blocked_external_evidence`.

Completed 439 scope:

- added `pnpm release:owner-evidence-package-status`;
- generated `docs/RELEASE_OWNER_EVIDENCE_PACKAGE_STATUS.md`;
- generated deterministic sanitized sample evidence at
  `docs/examples/release-owner-evidence-package-status-report.sample.json`;
- verified the current owner evidence package status is 0/7 complete and 7/7
  blocked with 63 missing owner-input files;
- release readiness remains `blocked_external_evidence` and no release gate is
  closed by this package-status report.

Completed 440 scope:

- added `pnpm release:reviewer-rule-quality-package`;
- generated `docs/REVIEWER_RULE_QUALITY_PACKAGE_GATE.md`;
- generated deterministic sanitized sample evidence at
  `docs/examples/reviewer-rule-quality-package-gate-report.sample.json`;
- verified the first critical-path package remains
  `blocked_missing_reviewer_evidence` because
  `docs/reviews/blocker-benchmark/DELIVERY_EVIDENCE.json`,
  `docs/reviews/blocker-benchmark/reviewer-1.review.json`, and
  `docs/reviews/blocker-benchmark/reviewer-2.review.json` are missing;
- confirmed `pnpm rule-qa` passes, while `pnpm rule-qa:review-delivery` and
  `pnpm rule-qa:review` fail as expected until real owner/reviewer evidence is
  supplied.

Completed 441 scope:

- added `pnpm release:reviewer-rule-quality-owner-guide`;
- generated `docs/REVIEWER_RULE_QUALITY_OWNER_INPUT_GUIDE.md`;
- generated deterministic sanitized sample evidence at
  `docs/examples/reviewer-rule-quality-owner-input-guide-report.sample.json`;
- documented the exact three owner/reviewer inputs, their template sources,
  required packet files, benchmark version, 1960-case benchmark size, case-index
  SHA-256, blocker rule IDs, and validation commands for the
  `01-reviewer-rule-quality` package;
- current status remains `owner_input_required` because all three real
  owner/reviewer files are still missing.

Completed 442 scope:

- added `pnpm release:reviewer-rule-quality-preflight:self-test`;
- generated deterministic sanitized sample evidence at
  `docs/examples/reviewer-rule-quality-preflight-self-test-report.sample.json`;
- hardened `pnpm rule-qa:review-delivery` so copied delivery template values
  such as `owner-managed-channel`, generic reviewer labels, generic independence
  statements, and the generated owner attestation statement are rejected;
- verified 5/5 temporary-workspace self-test cases: valid delivery evidence
  passes, copied delivery example fails, valid two-reviewer files pass, copied
  reviewer examples fail, and incomplete reviewer coverage fails;
- real owner/reviewer files remain missing, so OD-023 and the
  `01-reviewer-rule-quality` package remain blocked externally.

## VS Code Clean Install And Extension Host E2E

Completed 391 scope:

- added `@vscode/test-electron` as the isolated VS Code test host harness;
- added `apps/vscode/e2e/extension-host.test.cjs`;
- added `publisher: searchlint` to the VS Code extension manifest so installed
  VSIX id is stable as `searchlint.searchlint-vscode`;
- updated `pnpm vscode:clean-install-e2e` to build the local VSIX, download an
  isolated VS Code stable test host, install the generated VSIX into isolated
  user-data/extensions directories, and run Extension Host E2E assertions;
- `pnpm vscode:clean-install-e2e` passed under Node 24;
- Marketplace publisher setup, signing, publication, and Marketplace auto-update
  after publication remain open external release gates.

## VS Code Local VSIX Update Acceptance

Completed 393 scope:

- added `pnpm vscode:update-e2e`;
- added `scripts/verify-vscode-update-e2e.mjs`;
- the verifier runs `pnpm vscode:vsix-readiness`, builds a temporary previous
  `1.0.0-alpha.0` VSIX from the current package payload without modifying
  repository package metadata, installs it into isolated VS Code user-data and
  extensions directories, installs the current `1.0.0-beta.0` VSIX with
  `--force`, and verifies the installed extension changes from
  `searchlint.searchlint-vscode@1.0.0-alpha.0` to
  `searchlint.searchlint-vscode@1.0.0-beta.0`;
- `pnpm vscode:update-e2e` passed under Node 24;
- Marketplace publisher setup, signing, publication, and Marketplace auto-update
  after publication remain open external release gates.

## Report Expiration Static Contract

Completed 333 scope:

- added `plans/333_REPORT_EXPIRATION_STATIC_CONTRACT.md`;
- added `pnpm reports:expiration-static`;
- added `scripts/verify-report-expiration-static.mjs`;
- the verifier runs report artifact retention worker tests, hosted report links
  static contract, and worker build before evaluating expiration behavior;
- the verifier proves expiration is driven by `retentionUntil`, selects only
  active unpinned expired artifacts, excludes active unexpired and pinned
  expired artifacts, leases metadata before object deletion, deletes object
  payloads before marking metadata deleted, and rejects expired artifacts before
  hosted-link presigning;
- the verifier writes deterministic sanitized evidence to
  `docs/examples/report-expiration-static-report.sample.json`;
- `docs/REPORT_EXPIRATION_STATIC_CONTRACT.md` documents the static contract and
  explicitly leaves deployed cleanup worker behavior, live S3 deletion, deployed
  API/dashboard expiration behavior, live identity-provider access controls, and
  live report history UI/API behavior as open release gates.

## Report Access Controls Static Contract

Completed 334 scope:

- added `plans/334_REPORT_ACCESS_CONTROLS_STATIC_CONTRACT.md`;
- added `pnpm reports:access-controls-static`;
- added `services/api/src/report-access-control.ts`;
- added focused API tests for report access decisions;
- the verifier runs report access-control tests, hosted report links static
  contract, API build, and worker build before evaluating authorization
  behavior;
- the verifier proves an actor must have matching organization membership,
  `report:read` permission, matching report artifact organization/project/
  environment scope, active artifact state, and unexpired artifact metadata
  before a hosted report signed URL is created;
- denied cases do not call the signed URL presigner;
- the verifier writes deterministic sanitized evidence to
  `docs/examples/report-access-controls-static-report.sample.json`;
- `docs/REPORT_ACCESS_CONTROLS_STATIC_CONTRACT.md` documents the static contract
  and explicitly leaves deployed hosted report API routes, live
  identity-provider session/RBAC denial acceptance, live S3 behavior, dashboard
  report UI access-control E2E, and live report history UI/API behavior as open
  release gates.

## Report History Static Contract

Completed 335 scope:

- added `plans/335_REPORT_HISTORY_STATIC_CONTRACT.md`;
- added `pnpm reports:history-static`;
- added `services/api/src/report-history.ts`;
- added focused API tests for scoped report history listing and summary output;
- the verifier runs report history tests, report access-control static contract,
  and API build before evaluating report history behavior;
- the verifier proves report history is scoped by organization, project, and
  environment, lists only active report artifacts, orders by `generatedAt`
  descending, enforces limits from 1 to 100, and summarizes report kind counts,
  pinned count, artifact availability, latest generated timestamp, and earliest
  retention timestamp;
- the verifier writes deterministic sanitized evidence to
  `docs/examples/report-history-static-report.sample.json`;
- `docs/REPORT_HISTORY_STATIC_CONTRACT.md` documents the static contract and
  explicitly leaves deployed hosted report history API routes, dashboard report
  history UI, live identity-provider E2E, live object storage retrieval, and
  production report persistence migration as open release gates.

## Reports Final Readiness

Completed 385 scope:

- added `plans/385_REPORTS_FINAL_READINESS_GATE.md`;
- added `pnpm reports:final-readiness`;
- added `scripts/verify-reports-final-readiness.mjs`;
- the verifier runs SARIF/JUnit/HTML/PDF reporter acceptance, static PDF
  rendering, hosted report links static contract, report expiration static
  contract, report access-controls static contract, and report history static
  contract;
- the verifier checks required report docs and sanitized sample evidence;
- the verifier writes deterministic sanitized evidence to
  `docs/examples/reports-final-readiness-report.sample.json`;
- `docs/REPORTS_FINAL_READINESS.md` documents the aggregate gate and explicitly
  leaves live hosted report API routes, live S3 signed URL behavior, live
  identity-provider access-control E2E, deployed dashboard report-history UI,
  and SearchLint 1.0 final approval as separate gates.

## Zero Production Impact Final Gate

Completed 386 scope:

- added `plans/386_ZERO_PRODUCTION_IMPACT_FINAL_GATE_AGGREGATION.md`;
- added `pnpm zero-impact:final`;
- added `scripts/verify-zero-production-impact-final.mjs`;
- the verifier runs `pnpm verify:zero-impact` and `pnpm verify:next-fixtures`;
- the verifier parses `reports/next-fixture-zero-impact-report.json` and proves
  all four approved Next.js 15/16 App Router and Pages Router fixtures pass with
  zero SearchLint production client bytes, zero SearchLint client/server module
  matches, zero production request delta, zero SearchLint DOM nodes, zero
  SearchLint globals, zero SearchLint listeners/observers, and unchanged
  normalized route HTML and headers;
- the verifier writes deterministic sanitized evidence to
  `docs/examples/zero-production-impact-final-report.sample.json`;
- `docs/ZERO_PRODUCTION_IMPACT_FINAL_GATE.md` documents the aggregate gate and
  explicitly leaves public npm registry publication and SearchLint 1.0 final
  approval as separate gates.

## Documentation Final Readiness

Completed 387 scope:

- added `plans/387_DOCUMENTATION_FINAL_READINESS_GATE.md`;
- added `pnpm docs:final-readiness`;
- added `scripts/verify-documentation-final-readiness.mjs`;
- the verifier runs `pnpm reporters:acceptance`, `pnpm website:acceptance`, and
  `pnpm docs:rules:check`;
- the verifier checks required release documentation files, documentation sample
  JSON, and release-honesty markers stating SearchLint 1.0 is not released while
  final gates remain blocked;
- the verifier writes deterministic sanitized evidence to
  `docs/examples/documentation-final-readiness-report.sample.json`;
- `docs/DOCUMENTATION_FINAL_READINESS.md` documents the aggregate gate and
  explicitly leaves deployed public website, final legal/marketing/privacy/
  pricing approval, live onboarding/signup, and SearchLint 1.0 final approval as
  separate gates.

## Hosted Report Links Static Contract

Completed 332 scope:

- added `plans/332_HOSTED_REPORT_LINKS_STATIC_CONTRACT.md`;
- added `pnpm reports:hosted-links-static`;
- added `scripts/verify-hosted-report-links-static.mjs`;
- the verifier runs focused worker signed URL tests, object-storage signed URL
  acceptance, and worker build before evaluating hosted report link behavior;
- the verifier proves hosted report links go through the report artifact signed
  URL service, require matching organization/project/environment scope, reject
  inactive or expired artifacts, enforce positive bounded TTL, use `s3://`
  artifact URIs, and keep audit evidence free of signed URL query secrets;
- the verifier writes deterministic sanitized evidence to
  `docs/examples/hosted-report-links-static-report.sample.json`;
- `docs/HOSTED_REPORT_LINKS_STATIC_CONTRACT.md` documents the static contract
  and explicitly leaves deployed hosted report API routes, live S3 behavior,
  live identity-provider access controls, and live report history UI/API
  behavior as open release gates.

## PDF Rendering Static Acceptance

Completed 331 scope:

- added `plans/331_PDF_RENDERING_STATIC_ACCEPTANCE.md`;
- added `pnpm reporters:pdf-rendering`;
- added `scripts/verify-pdf-rendering-static.mjs`;
- the verifier runs reporter HTML tests, reporter acceptance, and reporter HTML
  build before parsing a generated PDF artifact;
- the verifier checks `%PDF-1.4`, EOF, catalog, pages, page, media box,
  Helvetica font resource, content stream, content stream byte length, xref
  offsets, trailer root, text drawing commands, and extracted report evidence;
- the verifier writes deterministic sanitized evidence to
  `docs/examples/pdf-rendering-static-report.sample.json`;
- `docs/PDF_RENDERING_STATIC_ACCEPTANCE.md` documents the static rendering proof
  and explicitly leaves browser/platform visual rendering, live hosted report
  routes, live access controls, and live report history UI/API behavior as open
  release gates.

## PDF Report Export

Completed 330 scope:

- added `plans/330_PDF_REPORT_EXPORT.md`;
- added `createPdfReport` to `@searchlint/reporter-html`;
- the reporter now emits a deterministic `%PDF-1.4` `Uint8Array` containing a
  catalog, page tree, Helvetica font, content stream, xref table, and EOF
  marker;
- the PDF summary preserves report metadata, diagnostic counts, severity counts,
  rule IDs, exact source locations when proven, and fingerprints;
- reporter unit tests now verify deterministic binary PDF output and structure;
- `pnpm reporters:acceptance` now verifies binary PDF export alongside SARIF,
  JUnit, HTML templates, and release documentation;
- `docs/PDF_REPORT_EXPORT.md` documents the API and explicitly leaves visual PDF
  rendering acceptance, live hosted report routes, live access controls, report
  persistence, live report history UI/API behavior, and dashboard report UI
  integration as open release gates.

## Yandex Metrica Counter Connection Static Readiness

Completed 329 scope:

- added `plans/329_YANDEX_METRICA_COUNTER_CONNECTION_STATIC_READINESS.md`;
- added `pnpm yandex:metrica-counter-static`;
- added `scripts/verify-yandex-metrica-counter-connection-static.mjs`;
- the verifier runs Yandex OAuth static readiness and deterministic Yandex
  Webmaster/Metrica acceptance as prerequisites;
- the verifier proves static counter connection contracts preserve organization,
  project, environment, provider, counter id, counter name, connected site URLs,
  date range, metrics, goal metadata, and read-only Metrica scopes;
- landing-page query targets are checked for containment by connected counter
  site URLs before being accepted by the static contract;
- the verifier writes deterministic sanitized evidence to
  `docs/examples/yandex-metrica-counter-connection-static-report.sample.json`;
- `docs/YANDEX_METRICA_COUNTER_CONNECTION_STATIC_READINESS.md` documents the
  static counter connection contract and explicitly leaves real Metrica counter
  access, live provider calls, live OAuth token storage, and dashboard connector
  proof as open release gates.

## Yandex Webmaster Site Connection Static Readiness

Completed 328 scope:

- added `plans/328_YANDEX_WEBMASTER_SITE_CONNECTION_STATIC_READINESS.md`;
- added `pnpm yandex:webmaster-site-static`;
- added `scripts/verify-yandex-webmaster-site-connection-static.mjs`;
- the verifier runs Yandex OAuth static readiness and deterministic Yandex
  Webmaster/Metrica acceptance as prerequisites;
- the verifier proves static host connection contracts preserve organization,
  project, environment, provider, Yandex Webmaster host id, verified host,
  project base URL, and read-only Webmaster scopes;
- URL-status and sitemap targets are checked for containment by the connected
  verified host before being accepted by the static contract;
- the verifier writes deterministic sanitized evidence to
  `docs/examples/yandex-webmaster-site-connection-static-report.sample.json`;
- `docs/YANDEX_WEBMASTER_SITE_CONNECTION_STATIC_READINESS.md` documents the
  static site connection contract and explicitly leaves real Yandex Webmaster
  site ownership, live provider calls, live OAuth token storage, and dashboard
  connector proof as open release gates.

## Yandex OAuth App Static Readiness

Completed 327 scope:

- added `plans/327_YANDEX_OAUTH_APP_STATIC_CONFIGURATION_READINESS.md`;
- added `pnpm yandex:oauth-static`;
- added `scripts/verify-yandex-oauth-app-static.mjs`;
- the verifier runs API external-provider OAuth authorization tests, dashboard
  provider settings verification, OAuth callback static verification, Yandex
  deterministic acceptance, and API build;
- the verifier imports the built API package and proves the Yandex OAuth app
  static contract uses `https://oauth.yandex.com/authorize`, an HTTPS
  provider-specific redirect URI, authorization-code flow, the required
  `login:email`, `webmaster:read`, and `metrika:read` scopes, no Google-only
  consent prompt, and no PKCE requirement in the current Yandex contract;
- the verifier writes deterministic sanitized evidence to
  `docs/examples/yandex-oauth-app-static-report.sample.json`;
- `docs/YANDEX_OAUTH_APP_STATIC_READINESS.md` documents the static Yandex OAuth
  app contract and explicitly leaves real Yandex OAuth app creation, live
  authorization-code exchange, live Webmaster site connection, live Metrica
  counter connection, and live dashboard connector proof as open release gates.

## Google Performance Metric History Static Acceptance

Completed 326 scope:

- added `plans/326_GOOGLE_PERFORMANCE_METRIC_HISTORY_STATIC_ACCEPTANCE.md`;
- added `pnpm google:performance-history`;
- added `services/api/src/google-performance-history.ts`;
- added `services/api/test/google-performance-history.test.ts`;
- added `scripts/verify-google-performance-history.mjs`;
- the API now extracts LCP, INP, and CLS history points from PageSpeed lab data,
  PageSpeed field page data, PageSpeed field origin data, and CrUX field data;
- CrUX missing-data observations produce zero metric points instead of fake
  measurements;
- performance points are converted into existing `MetricEvent` records with
  project, environment, subject URL, source, unit, freshness, and sampled
  dimensions;
- the verifier runs focused API tests, deterministic PageSpeed/CrUX acceptance,
  and API build before writing sanitized evidence to
  `docs/examples/google-performance-history-report.sample.json`;
- `docs/GOOGLE_PERFORMANCE_METRIC_HISTORY_STATIC_ACCEPTANCE.md` documents the
  contract and explicitly leaves live Google performance APIs, deployed
  historical storage, dashboard charting from live data, and retention/deletion
  proof as open release gates.

## Google Search Console Stale States Static Acceptance

Completed 325 scope:

- added `plans/325_GOOGLE_SEARCH_CONSOLE_STALE_STATES_STATIC_ACCEPTANCE.md`;
- added `pnpm google:gsc-stale-states`;
- added `services/api/src/google-provider-stale-state.ts`;
- added `services/api/test/google-provider-stale-state.test.ts`;
- wired the Google provider adapter to the exported freshness/stale-state
  contract;
- added `scripts/verify-google-search-console-stale-states.mjs`;
- the API freshness contract classifies Google observations as `fresh` through 7
  days, `stale` through 30 days, `expired` after 30 days, and `unknown` for
  invalid timestamps;
- the verifier runs focused API tests, deterministic Google Search Console
  acceptance, API build, dashboard build, and HTML reporter build before writing
  sanitized evidence to
  `docs/examples/google-search-console-stale-states-report.sample.json`;
- `docs/GOOGLE_SEARCH_CONSOLE_STALE_STATES_STATIC_ACCEPTANCE.md` documents the
  contract and explicitly leaves live Google stale-state behavior, scheduler
  transitions, live dashboard connector rendering, and stale-observation
  notification evidence as open release gates.

## Google Search Console Retry/Backoff Static Acceptance

Completed 324 scope:

- added `plans/324_GOOGLE_SEARCH_CONSOLE_RETRY_BACKOFF_STATIC_ACCEPTANCE.md`;
- added `pnpm google:gsc-retry-backoff`;
- added `services/api/src/google-provider-retry-policy.ts`;
- added `services/api/test/google-provider-retry-policy.test.ts`;
- added `scripts/verify-google-search-console-retry-backoff.mjs`;
- the API retry policy classifies Google `429`, `500`, `503`, and `504` failures
  as retryable and `400`, `401`, `403`, and `404` failures as non-retryable;
- the API retry policy supports deterministic bounded exponential backoff and
  `Retry-After` seconds/date handling;
- the verifier runs focused API tests, deterministic Google Search Console
  acceptance, and API build before writing sanitized evidence to
  `docs/examples/google-search-console-retry-backoff-report.sample.json`;
- `docs/GOOGLE_SEARCH_CONSOLE_RETRY_BACKOFF_STATIC_ACCEPTANCE.md` documents the
  contract and explicitly leaves live Google quota/rate-limit behavior,
  scheduler persistence, deployed worker metrics, and repeated-retry stale-state
  proof as open release gates.

## Google Search Console Site Connection Static Readiness

Completed 323 scope:

- added `plans/323_GOOGLE_SEARCH_CONSOLE_SITE_CONNECTION_STATIC_READINESS.md`;
- added `pnpm google:gsc-site-static`;
- added `scripts/verify-google-search-console-site-connection-static.mjs`;
- the verifier runs Google OAuth static readiness and deterministic Google
  Search Console acceptance before evaluating site-connection readiness;
- the verifier proves static domain-property and URL-prefix-property contracts,
  tenant/project/environment binding, URL/sitemap containment, Search Console
  readonly scope use, and sanitized evidence;
- the verifier writes deterministic sanitized evidence to
  `docs/examples/google-search-console-site-connection-static-report.sample.json`;
- `docs/GOOGLE_SEARCH_CONSOLE_SITE_CONNECTION_STATIC_READINESS.md` documents the
  contract and explicitly leaves live Google property ownership, live OAuth
  exchange, live provider calls, and live dashboard connector proof as open
  release gates.

## Google Consent Verification Readiness

Completed 322 scope:

- added `plans/322_GOOGLE_CONSENT_VERIFICATION_READINESS.md`;
- added `pnpm google:consent-readiness`;
- added `scripts/verify-google-consent-verification-readiness.mjs`;
- the verifier runs Google OAuth static readiness, security/privacy acceptance,
  and website/onboarding acceptance;
- the verifier checks reviewer-facing privacy, terms, support, vulnerability
  disclosure, public website/onboarding, and Google OAuth readiness documents;
- the verifier records sensitive-scope rationale, token-storage posture,
  requested owner evidence, and remaining live Google approval gates;
- the verifier writes deterministic sanitized evidence to
  `docs/examples/google-consent-verification-readiness-report.sample.json`;
- `docs/GOOGLE_CONSENT_VERIFICATION_READINESS.md` documents the packet and
  explicitly leaves Google Cloud Console submission, consent approval, live
  Search Console property connection, and live provider acceptance as open
  release gates.

## Google OAuth App Static Readiness

Completed 321 scope:

- added `plans/321_GOOGLE_OAUTH_APP_STATIC_CONFIGURATION_READINESS.md`;
- added `pnpm google:oauth-static`;
- added `scripts/verify-google-oauth-app-static.mjs`;
- the verifier runs API external-provider OAuth authorization tests, dashboard
  provider settings verification, OAuth callback static verification, Google
  Search Console deterministic acceptance, and API build;
- the verifier imports the built API package and proves the Google OAuth app
  static contract uses `https://accounts.google.com/o/oauth2/v2/auth`, an HTTPS
  provider-specific redirect URI, authorization-code flow, offline access,
  consent prompt, Search Console readonly scope, and PKCE S256;
- the verifier writes deterministic sanitized evidence to
  `docs/examples/google-oauth-app-static-report.sample.json`;
- `docs/GOOGLE_OAUTH_APP_STATIC_READINESS.md` documents the static Google OAuth
  app contract and explicitly leaves real Google Cloud Console app creation,
  consent verification, live OAuth exchange, live Search Console property
  connection, and live dashboard connector proof as open release gates.

## Dashboard Production E2E Deployed URL Harness

Completed 320 scope:

- added `plans/320_DASHBOARD_PRODUCTION_E2E_DEPLOYED_URL_ACCEPTANCE.md`;
- added `pnpm dashboard:production-e2e`;
- added `scripts/verify-dashboard-production-e2e-deployed-url.mjs`;
- the verifier runs dashboard static deployment readiness, API connection static
  readiness, auth connection static readiness, and hosted/local dashboard
  acceptance before considering deployed-URL E2E;
- live mode is explicit through `SEARCHLINT_DASHBOARD_E2E_LIVE=1`;
- live mode requires `SEARCHLINT_DASHBOARD_BASE_URL`,
  `SEARCHLINT_DASHBOARD_API_BASE_URL`, and
  `SEARCHLINT_DASHBOARD_COGNITO_HOSTED_UI_DOMAIN`;
- persisted reports redact live URL values;
- the current deterministic sample records `harness-ready-live-gate-blocked`,
  because no real CloudFront/API/Cognito deployment URLs are provided in this
  checkout;
- `docs/DASHBOARD_PRODUCTION_E2E_DEPLOYED_URL.md` documents the harness and the
  remaining live release gates.

## Dashboard Auth Connection Static Readiness

Completed 319 scope:

- added `plans/319_DASHBOARD_AUTH_CONNECTION_STATIC_READINESS.md`;
- added `pnpm dashboard:auth-connection-static`;
- added `scripts/verify-dashboard-auth-connection-static.mjs`;
- the verifier builds `@searchlint/dashboard`, runs dashboard auth/API unit
  tests, runs Cognito/OIDC, login, logout, refresh-token, session-expiry, and
  hosted/local dashboard acceptance verifiers;
- the verifier imports the built dashboard package and proves missing, valid,
  and expired session route intents;
- the verifier proves Cognito Hosted UI authorization URLs use
  authorization-code flow with PKCE S256;
- the verifier proves Cognito logout URL construction with the configured
  post-logout redirect URI;
- the verifier proves expired stored sessions refresh through the Cognito token
  endpoint before dashboard API requests, save the refreshed session, and use
  the refreshed bearer token;
- the verifier writes deterministic sanitized evidence to
  `docs/examples/dashboard-auth-connection-static-report.sample.json`;
- `docs/DASHBOARD_AUTH_CONNECTION_STATIC_READINESS.md` documents the static auth
  connection readiness contract and explicitly leaves deployed Cognito, live
  Hosted UI E2E, live email/MFA/password-reset/session-expiry behavior, deployed
  dashboard API auth, and production session security review as open release
  gates.

## Dashboard API Connection Static Readiness

Completed 318 scope:

- added `plans/318_DASHBOARD_PRODUCTION_API_CONNECTION_STATIC_READINESS.md`;
- added `pnpm dashboard:api-connection-static`;
- added `scripts/verify-dashboard-api-connection-static.mjs`;
- the verifier builds `@searchlint/api` and `@searchlint/dashboard`, runs their
  unit tests, runs backend API acceptance, and runs hosted/local dashboard
  route-flow acceptance;
- the verifier imports built dashboard/API packages and proves dashboard actions
  resolve to checked stable `/v1` Cloud API route contracts;
- the verifier proves dashboard fetch transport sends bearer authorization, API
  version, operation, dashboard action, request schema, and response schema
  headers;
- the verifier proves `getDashboardSnapshot` uses `GET` and sends no JSON body
  or `content-type` header;
- the verifier writes deterministic sanitized evidence to
  `docs/examples/dashboard-api-connection-static-report.sample.json`;
- `docs/DASHBOARD_API_CONNECTION_STATIC_READINESS.md` documents the static API
  connection readiness contract and explicitly leaves deployed API Gateway/ECS,
  live Cognito authorization, live RDS-backed dashboard data, real production
  API base URL wiring, and production dashboard E2E as open release gates.

## Dashboard Static Deployment Readiness

Completed 317 scope:

- added `plans/317_DASHBOARD_PRODUCTION_DEPLOYMENT_STATIC_READINESS.md`;
- added `pnpm dashboard:static-deployment`;
- added `scripts/verify-dashboard-static-deployment-readiness.mjs`;
- the verifier proves the dashboard package builds, generated browser assets
  validate, hosted/local browser load, bundle load, route-flow, accessibility,
  and visual checks pass, and the AWS dashboard S3/CloudFront static hosting
  template passes IaC verification;
- the verifier writes deterministic sanitized evidence to
  `docs/examples/dashboard-static-deployment-readiness-report.sample.json`;
- `docs/DASHBOARD_STATIC_DEPLOYMENT_READINESS.md` documents the static hosting
  readiness contract and explicitly leaves real AWS deployment, S3 upload,
  deployed CloudFront URL E2E, live Cognito/API behavior, and external
  accessibility review as open release gates.

## Final Release Gate

Completed for the current blocked state:

- `docs/SEARCHLINT_1_0_FINAL_RELEASE_GATE.md` documents the final SearchLint 1.0
  release gate and the current `BLOCKED` verdict.
- `pnpm final-release:gate` verifies the RC matrix remains blocked, no local
  `v1.0.0` tag exists, and final release must not be published yet.
- The command writes deterministic evidence to
  `docs/examples/final-release-gate-report.sample.json` and
  `reports/final-release-gate-report.json`.

Still blocked:

- no `v1.0.0` tag;
- no final npm publication;
- no VS Code Marketplace publication;
- no public SearchLint 1.0 announcement;
- missing independent reviewer approvals, legal approval, repository split, live
  cloud/provider/billing evidence, external security audits, and final RC pass.

## Rule Status

| Rule acceptance layer                            | Status                                                                                                                               |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| Catalog count and category validation            | Completed: 120/120 unique catalog IDs                                                                                                |
| Shared core implementation bindings              | Completed: 120/120 unique rule IDs bound in `packages/core/src/builtin-rules.ts`                                                     |
| Core tests mention every rule ID                 | Completed: 120/120 rule IDs mentioned in core tests                                                                                  |
| Real checked-in catalog consumed by CLI/crawler  | Completed: CLI and crawler tests execute the real `specs/RULE_CATALOG.yaml` through the production loader                            |
| Positive/negative/edge-case proof for every rule | Completed for deterministic synthetic QA: 120/120 rules pass positive, negative, and edge-case fixtures through `pnpm rule-qa`       |
| Blocker precision evidence                       | Blocked for release: synthetic OD-023-sized benchmark reports precision/recall metrics, but independent reviewer sign-off is missing |
| Suppression/baseline/route-contract coverage     | Partial: core and CLI tests cover these mechanisms, and real-catalog E2E now passes                                                  |
| Shared availability through core, CLI, crawler   | Completed locally: production catalog loader, registry, core, CLI, and crawler smoke paths pass                                      |
| Rule compatibility baseline                      | Completed locally: 120/120 rule IDs, severities, confidence levels, sources, provider scopes, versions, and sample fingerprints pass |

Summary:

- Verified implementation bindings: 120
- Deterministic positive/negative/edge QA coverage: 120/120
- Missing implementation bindings: 0
- Fully release-verified rules through real catalog E2E: 120 through catalog
  loader, registry, core, CLI, and crawler smoke paths
- Blocker precision synthetic benchmark: 14 blocker rules, 560 TP, 0 FP, 0 FN,
  1,400 TN, precision 100%, recall 100%, one-sided 95% Wilson lower bound
  99.51919019004366%.
- OD-023 release gate: not passed because two independent expected-result
  reviewer sign-offs are not present.
- Independent review packet and verifier now exist, but real
  `reviewer-1.review.json` and `reviewer-2.review.json` files have not been
  supplied by the project owner.

## Core

Completed:

- Deterministic rule ordering, dependency validation, duplicate ID rejection,
  and cycle rejection.
- Stable fingerprint creation.
- Diagnostic validation for required evidence, non-heuristic blockers, and
  exact-only file/line locations.
- Severity overrides.
- Suppressions with required reasons.
- Baseline comparison for new, unchanged, and resolved diagnostics.
- Route matching and route-contract selection.
- Structured evidence support.
- Shared rule implementation ownership in `@searchlint/core`.
- Local-only declarative custom rule sandbox through `createLocalCustomRule` and
  `createLocalCustomRules`, with cloud execution rejection, snapshot-only
  access, definition/report/text/evaluation-step limits, and standard diagnostic
  validation.
- Local rule-engine performance benchmark through `pnpm core:benchmark`, using
  all 120 built-in catalog rules across 100 synthetic large snapshots with
  elapsed-time, per-snapshot, and heap-delta gates.
- Rule compatibility baseline through `pnpm rule:compatibility`, covering all
  120 rule IDs, default severity, confidence, source list, provider scope,
  version, and deterministic sample fingerprints.
- Real-site-derived regression corpus through `pnpm core:real-corpus`, covering
  5 sanitized public-site snapshots, all 120 built-in rules, 600 rule
  executions, per-case emitted rule IDs, and fingerprint digests.
- Large-site rule execution through `pnpm core:large-site`, covering 3 large
  site-shaped scenarios, 10,500 pages, 42,500 links, all 120 built-in rules, 360
  rule executions, elapsed-time gates, and heap gates.

Partial:

- Final public contract/versioning policy is still pending under OD-017 and
  OD-025.
- Source confidence exists, but broad source localization is still limited to
  implemented static-analysis cases.
- The rule suite is large and compact; more fixture-per-rule acceptance tests
  now exist for deterministic synthetic QA; independent benchmark review is
  still required before release confidence.

## End-to-End

Existing tests cover crawler to PageSnapshot-like snapshots, core diagnostics,
CLI formatting, SARIF, JUnit, route contracts, suppressions, baselines, robots
and sitemap artifacts, site graph evidence, duplicate metadata, hreflang
reciprocity, and noindex graph evidence.

Release acceptance coverage now includes:

- `specs/RULE_CATALOG.yaml` loaded by the production loader;
- 120 catalog entries bound one-to-one to shared core implementations;
- catalog -> registry -> core -> diagnostics E2E;
- CLI snapshot smoke through the real catalog;
- crawler -> snapshot -> core -> diagnostic smoke through the real catalog;
- rule QA matrix for all 120 catalog rules with positive, negative, edge-case,
  expected diagnostic, actual diagnostic, pass/fail, and coverage note fields;
- blocker precision report for the 14 catalog-default blocker rules with TP, FP,
  FN, TN, precision, recall, Wilson lower bound, and release-gate fields;
- public CLI command tests for `check`, `crawl`, `init`, `config validate`,
  `migrate-config`, `baseline`, help output, and exit-code behavior;
- invalid catalog cases for required field types, duplicate IDs, missing fields,
  heuristic blockers, forbidden `meta keywords`, title hard errors, and
  provider/category mismatches.
- local custom rule sandbox tests for cloud rejection, snapshot-only execution,
  workspace-access hook absence, oversized definitions, rule/report/text/
  evaluation-step limits, and standard diagnostic validation.
- local rule-engine benchmark evidence for all 120 built-in rules through
  `docs/examples/core-rule-engine-performance-report.sample.json`.
- rule compatibility evidence through
  `docs/examples/rule-compatibility-report.sample.json`.
- real-site-derived regression corpus evidence through
  `docs/examples/real-site-regression-corpus-report.sample.json`.
- real-project false-positive review evidence through
  `docs/examples/real-project-false-positive-review-report.sample.json`; the
  current 17 corpus diagnostics are reviewed as non-blocking `info` guidance.

## DSL and LSP

Completed:

- Hand-written lexer/parser foundation.
- Shared AST model in `@searchlint/language`.
- Formal language version 1 grammar in `specs/searchlint.ebnf`.
- Public `searchlint.seo` config contract in
  `specs/SEARCHLINT_LANGUAGE_SPEC.md`.
- Semantic diagnostics for language/site/routes, imports, variables, policies,
  route groups, environments, provider blocks, custom rule references, severity
  overrides, suppressions, and hreflang.
- Deterministic compiled intermediate config from the shared compiler.
- `pnpm dsl:acceptance` covers parser/formatter/compiler compatibility, imports,
  import cycles, POSIX paths, Windows-style resolver path strings, environment
  precedence, policy inheritance, route-specific overrides, large configs,
  unsupported versions, real example configs, migration backup evidence, and
  atomic migration write usage through the CLI IO boundary.
- `pnpm dsl:windows-paths` covers the Windows paths acceptance packet by
  requiring `pnpm dsl:acceptance`, checking the
  `windows-style-project-paths-preserved` sample evidence, and preserving the
  non-native Windows limitation until owner-provided Windows runner evidence is
  supplied.
- LSP-compatible diagnostic mapping using the shared language package.
- CLI `searchlint migrate-config --from 1 --to 1 --write <path>` command for
  validated language-version 1 config preservation and byte-for-byte `.bak`
  backup creation.
- JSON-RPC language-server transport for `searchlint.seo`.
- VS Code extension package with `.seo` language contribution, diagnostics,
  hover, completion, formatting, deterministic local quick fixes, and
  `SearchLint: Open SearchLint Overlay` command wiring.
- Same-document LSP go to definition, references, and rename for DSL policies
  and variables, exposed through the language server and covered by
  deterministic LSP/VS Code acceptance evidence.
- Multi-file LSP invalidation, stale diagnostic cleanup on document change and
  close, and 260-document large-workspace acceptance through
  `pnpm lsp:workspace-acceptance`.
- VS Code beta package metadata, Apache-2.0 license metadata, README, changelog,
  privacy statement, extension icon, and deterministic screenshot assets for
  local extension release readiness.
- Generated local VSIX package readiness through `pnpm vscode:vsix-readiness`,
  including VSIX manifest, content types, extension payload, assets, and runtime
  dependency entries.

Completed:

- Custom rule references remain part of the DSL contract, and local execution is
  now provided by the declarative `@searchlint/core` sandbox documented in
  `docs/CUSTOM_RULE_EXECUTION_POLICY.md`.

Partial:

- Real Windows/Linux/macOS filesystem matrix acceptance for DSL migration is not
  complete.
- Future language-version migration remains blocked until a future
  language-version ADR is approved.
- Marketplace publication remains unreleased.
- CodeLens, cross-file project-wide references/rename, Marketplace publisher
  setup, signing, publication, and Marketplace auto-update after publication
  remain incomplete.

## Next.js Analyzer

Completed:

- Structural source path classification for App Router, Pages Router, metadata
  files, generated image files, route handlers, and Next config files.
- Deterministic route model for App and Pages Router routes, including root
  routes, dynamic routes, catch-all routes, optional catch-all routes, route
  groups, parallel route slots, and intercepting route segments.
- Layout association and structural metadata summary for App Router routes.
- Source signal detection for static metadata, `generateMetadata`,
  `generateSitemaps`, `generateStaticParams`, generated images, special files,
  Pages Router `<Head>`, middleware/proxy files, and statically visible
  `<Image unoptimized>`.
- Structural Next config awareness and literal-entry extraction for statically
  visible `redirects` and `rewrites` exports.
- Deterministic Next config summary for config files, redirect files, rewrite
  files, redirect entries, and rewrite entries.
- `pnpm next:acceptance` verifies deterministic synthetic Next analyzer
  acceptance and writes
  `docs/examples/next-analyzer-acceptance-report.sample.json`.
- `pnpm next:source-mapping` verifies filesystem-backed App Router and Pages
  Router source mapping acceptance and writes
  `docs/examples/next-source-mapping-report.sample.json`.
- `pnpm next:compatibility-matrix` verifies the expanded Next 15/16 App/Pages
  compatibility matrix and writes
  `docs/examples/next-compatibility-matrix-report.sample.json`.
- `pnpm next:generated-images` verifies runtime-generated Open Graph and Twitter
  image route responses and writes
  `docs/examples/next-generated-images-report.sample.json`.
- `pnpm next:streaming-metadata` verifies asynchronous App Router
  `generateMetadata` runtime response equality for clean and SearchLint-enabled
  Next.js 16 production servers and writes
  `docs/examples/next-streaming-metadata-report.sample.json`.
- `pnpm next:cms-api-metadata` verifies runtime metadata fetched from a
  deterministic CMS/API endpoint for clean and SearchLint-enabled Next.js 16
  production servers and writes
  `docs/examples/next-cms-api-metadata-report.sample.json`.
- `pnpm next:dynamic-routes-runtime` verifies production runtime behavior for
  async environment-derived `redirects()` and `rewrites()` in clean and
  SearchLint-enabled Next.js 16 apps and writes
  `docs/examples/next-dynamic-routes-runtime-report.sample.json`.
- `pnpm next:middleware-runtime` verifies production middleware response-header
  and rewrite behavior in clean and SearchLint-enabled Next.js 16 apps and
  writes `docs/examples/next-middleware-runtime-report.sample.json`.
- `pnpm next:proxy-runtime` verifies production proxy response-header and
  rewrite behavior in clean and SearchLint-enabled Next.js 16 apps and writes
  `docs/examples/next-proxy-runtime-report.sample.json`.

Partial:

- Dynamic metadata is identified as a related source contribution, but runtime
  values are not evaluated.
- Development-only Next.js config integration is covered by fixture-shape tests
  for Next.js 15/16 App Router and Pages Router.
- Zero-production-impact fixture-shape checks pass for Next.js 15/16 App Router
  and Pages Router.
- Real upstream Next.js 15/16 fixture projects now pass development E2E and
  production build/start zero-impact comparison through `pnpm pack` tarball
  installation.
- No metadata value evaluation from imports or dynamic functions.
- Redirects and rewrites are statically extracted only for simple literal config
  entries; dynamic config execution remains intentionally unsupported.
- Pages Router `<Head>` route-file usage is statically detected; `_app`,
  `_document`, and runtime behavior are not complete.
- OG/Twitter generated image source existence and runtime image route output are
  both verified for Next.js 16 App Router.
- Streaming metadata runtime behavior is verified for deterministic async
  `generateMetadata` values in a Next.js 16 App Router production route.
- CMS/API-provided metadata runtime behavior is verified against a
  verifier-owned deterministic HTTP endpoint. This is not a real external CMS
  vendor acceptance.
- Dynamic redirect/rewrite runtime behavior is verified in production Next.js 16
  apps. The source analyzer still does not execute arbitrary project config
  code.
- Middleware file source signals are statically detected and deterministic
  production middleware header/rewrite behavior is verified for the deprecated
  convention.
- Proxy file source signals are statically detected and deterministic production
  proxy header/rewrite behavior is verified for the current Next.js 16
  convention. Expanded middleware/proxy scenarios such as auth, cookies, geo,
  and deployed Edge-provider behavior remain outside these local verifiers.

Completed 352 scope:

- added `plans/352_NEXT_ANALYZER_PAGES_HEAD_REDIRECT_REWRITE_ACCEPTANCE.md`;
- `@searchlint/source` now emits `pages-head` findings for Pages Router route
  files that import and render `next/head`, with exact file/line evidence;
- `@searchlint/source` now emits `middleware-file` findings for supported
  `middleware.*` files, with exact file/line evidence;
- `@searchlint/source` now extracts simple literal `source`, `destination`, and
  `permanent` values from statically visible Next config `redirects` and
  `rewrites` arrays without executing project code;
- `@searchlint/next` now includes stable redirect and rewrite entries in
  `buildNextConfigSummary`;
- `pnpm next:acceptance` now verifies Pages Router `<Head>`, redirect/rewrite
  entries, middleware source signals, and source analyzer fixture kind coverage.

Completed 353 scope:

- added `plans/353_NEXT_ANALYZER_REAL_PROJECT_SOURCE_MAPPING_ACCEPTANCE.md`;
- added `pnpm next:source-mapping`;
- added `scripts/verify-next-real-source-mapping.mjs`;
- the verifier writes realistic App Router and Pages Router project trees to a
  temporary filesystem location, reads source files from disk, runs
  `@searchlint/source` and `@searchlint/next`, and removes the temp projects
  after verification;
- exact source findings are checked against the actual file line text for static
  metadata fields, Pages Router `<Head>`, unoptimized Next image usage,
  middleware files, generated image files, robots files, and special route
  files;
- related source findings are checked to ensure `generateMetadata`,
  `generateStaticParams`, `generateSitemaps`, and Next config redirect/rewrite
  signals do not fabricate exact line locations;
- the verifier writes deterministic sanitized evidence to
  `docs/examples/next-source-mapping-report.sample.json`.

Completed 354 scope:

- added `plans/354_NEXT_COMPATIBILITY_MATRIX_EXPANSION.md`;
- added `pnpm next:compatibility-matrix`;
- added `scripts/verify-next-compatibility-matrix.mjs`;
- the verifier runs `pnpm next:acceptance`, `pnpm next:source-mapping`,
  `pnpm verify:zero-impact`, and `pnpm verify:next-fixtures`;
- the matrix records four supported OD-003 fixture rows: `next15-app`,
  `next15-pages`, `next16-app`, and `next16-pages`, using the current
  security-patched fixture versions from
  `scripts/verify-real-next-fixtures.mjs`;
- the matrix records 18 feature rows covering analyzer route/source features,
  root and `src/` source roots, JavaScript/JSX and TypeScript/TSX source
  coverage, source mapping, and zero-production-impact/real-fixture evidence;
- the verifier writes deterministic sanitized evidence to
  `docs/examples/next-compatibility-matrix-report.sample.json`.

Completed 355 scope:

- added `plans/355_NEXT_RUNTIME_GENERATED_IMAGE_ACCEPTANCE.md`;
- added `pnpm next:generated-images`;
- added `scripts/verify-next-generated-images.mjs`;
- the verifier creates clean and SearchLint-enabled Next.js 16 App Router
  projects with runtime `opengraph-image.jsx` and `twitter-image.jsx` routes
  using `ImageResponse`;
- the verifier installs dependencies, builds both projects, starts production
  servers, fetches `/opengraph-image` and `/twitter-image`, and verifies HTTP
  200, `image/png`, unchanged byte length, and absence of SearchLint runtime
  markers in the SearchLint-enabled responses;
- the verifier writes deterministic sanitized evidence to
  `docs/examples/next-generated-images-report.sample.json`.

Completed 356 scope:

- added `plans/356_NEXT_STREAMING_METADATA_RUNTIME_ACCEPTANCE.md`;
- added `pnpm next:streaming-metadata`;
- added `scripts/verify-next-streaming-metadata.mjs`;
- the verifier creates clean and SearchLint-enabled Next.js 16 App Router
  projects with an asynchronous dynamic-route `generateMetadata`;
- the verifier installs dependencies, builds both projects, starts production
  servers, fetches `/products/streaming`, and verifies HTTP 200, HTML content
  type, resolved title/description equality, and absence of SearchLint runtime
  markers in the SearchLint-enabled response;
- the verifier writes deterministic sanitized evidence to
  `docs/examples/next-streaming-metadata-report.sample.json`.

Completed 357 scope:

- added `plans/357_NEXT_CMS_API_METADATA_RUNTIME_ACCEPTANCE.md`;
- added `pnpm next:cms-api-metadata`;
- added `scripts/verify-next-cms-api-metadata.mjs`;
- the verifier starts a deterministic local CMS/API HTTP endpoint controlled by
  the test harness;
- the verifier creates clean and SearchLint-enabled Next.js 16 App Router
  projects with a dynamic-route `generateMetadata` that fetches `title` and
  `description` from the CMS/API endpoint at runtime;
- the verifier installs dependencies, builds both projects, starts production
  servers, fetches `/cms-api/api-product`, and verifies HTTP 200, HTML content
  type, resolved title/description equality, CMS/API request count, and absence
  of SearchLint runtime markers in the SearchLint-enabled response;
- the verifier writes deterministic sanitized evidence to
  `docs/examples/next-cms-api-metadata-report.sample.json`.

Completed 358 scope:

- added `plans/358_NEXT_DYNAMIC_REDIRECT_REWRITE_RUNTIME_ACCEPTANCE.md`;
- added `pnpm next:dynamic-routes-runtime`;
- added `scripts/verify-next-dynamic-routes-runtime.mjs`;
- the verifier creates clean and SearchLint-enabled Next.js 16 App Router
  projects with async environment-derived `redirects()` and `rewrites()` in
  `next.config.mjs`;
- the verifier installs dependencies, builds both projects, starts production
  servers, fetches the dynamic redirect source and rewrite source, and verifies
  redirect status/location equality, rewritten page evidence equality, and
  absence of SearchLint runtime markers in SearchLint-enabled responses;
- the verifier writes deterministic sanitized evidence to
  `docs/examples/next-dynamic-routes-runtime-report.sample.json`.

Completed 359 scope:

- added `plans/359_NEXT_MIDDLEWARE_RUNTIME_ACCEPTANCE.md`;
- added `pnpm next:middleware-runtime`;
- added `scripts/verify-next-middleware-runtime.mjs`;
- the verifier creates clean and SearchLint-enabled Next.js 16 App Router
  projects with root `middleware.js`;
- the verifier installs dependencies, builds both projects, starts production
  servers, fetches a middleware header route and middleware rewrite source, and
  verifies response-header equality, rewritten page evidence equality, and
  absence of SearchLint runtime markers in SearchLint-enabled responses;
- the verifier writes deterministic sanitized evidence to
  `docs/examples/next-middleware-runtime-report.sample.json`;
- Next.js 16 emits a deprecation warning for the `middleware` file convention in
  favor of `proxy`, but the compatibility runtime behavior is still verified.

Completed 360 scope:

- added `plans/360_NEXT_PROXY_FILE_COMPATIBILITY_ACCEPTANCE.md`;
- added `proxy-file` source finding support for `proxy.js` and `proxy.ts`;
- `@searchlint/next` now classifies `proxy.*` as the Next middleware/proxy
  source family;
- `pnpm next:acceptance` now verifies static `proxy-file` source evidence;
- added `pnpm next:proxy-runtime`;
- added `scripts/verify-next-proxy-runtime.mjs`;
- the verifier creates clean and SearchLint-enabled Next.js 16 App Router
  projects with root `proxy.js`;
- the verifier installs dependencies, builds both projects, starts production
  servers, fetches a proxy header route and proxy rewrite source, and verifies
  response-header equality, rewritten page evidence equality, and absence of
  SearchLint runtime markers in SearchLint-enabled responses;
- the verifier writes deterministic sanitized evidence to
  `docs/examples/next-proxy-runtime-report.sample.json`.

## Packages

Implemented package foundations:

- `@searchlint/core`
- `@searchlint/cli`
- `@searchlint/crawler`
- `@searchlint/html`
- `@searchlint/http`
- `@searchlint/language`
- `@searchlint/lsp`
- `@searchlint/next`
- `@searchlint/source`
- `@searchlint/browser`
- `@searchlint/reporter-html`
- `@searchlint/reporter-sarif`
- `@searchlint/reporter-junit`
- `@searchlint/overlay`
- `@searchlint/api`
- `@searchlint/workers`
- `@searchlint/dashboard`

Dashboard foundation:

- `@searchlint/dashboard` now builds, typechecks, and tests as a
  framework-neutral dashboard foundation with typed snapshot contracts,
  deterministic summary derivation, localizable message keys, checked `/v1`
  route mappings, and an accessible static HTML shell.

## Dev Badge and Overlay

Completed locally:

- badge states: checking, clean, info, warnings, errors, blocked;
- diagnostic counts and overlay opening;
- diagnostic list filtered by severity, category, and source;
- title, explanation, evidence, expected/actual, route, URL, confidence, source
  type, raw HTML, and rendered DOM rendering;
- file/line display only through `EXACT` source locations;
- selector-based DOM highlight action;
- copy diagnostic, suppression action, and rerun action hooks;
- Shadow DOM isolation;
- keyboard/focus markers and ARIA dialog/list semantics;
- deterministic overlay accessibility contract report;
- `pnpm overlay:acceptance` deterministic HTML/CSS acceptance report;
- named severity/category/source filters and named close/rerun/copy/suppress/
  highlight controls;
- polite live diagnostic count;
- deterministic badge/panel positions;
- RTL direction contract;
- high-contrast and reduced-motion CSS hooks;
- runtime error fallback state with alert semantics;
- long diagnostics and 1,000 diagnostics render with wrapping safeguards;
- keyboard open and Escape focus restoration in real Next.js fixtures;
- navigation and mutation observer rerun hooks with cleanup;
- OD-022 accessibility baseline approved through ADR-0022.

Partial:

- Full manual WCAG audit, visual-regression coverage, and future dashboard
  application of ADR-0022 remain pending.
- Manual screen-reader, high-contrast OS/browser, zoom, RTL screenshot, mobile
  viewport, and pixel-diff visual review remain pending release gates.
- Browser E2E now includes real Next.js 15/16 App/Pages fixture projects with
  Playwright checks for badge/overlay behavior, keyboard opening, Escape focus
  restoration, named controls, live status, navigation, Fast Refresh, Shadow DOM
  isolation, cleanup, and zero production impact.
- The Next.js integration wrapper is phase-aware: production build phases return
  the original Next.js config without adding a SearchLint webpack hook, while
  development server phases add the dev client integration.

Overlay visual and responsive readiness:

- `pnpm overlay:visual-regression` runs `pnpm overlay:acceptance`, records
  deterministic overlay scenario hashes, and verifies mobile viewport, 200-400%
  zoom, forced-colors/high-contrast, style-conflict isolation, and final
  deterministic UX contracts;
- manual WCAG and screen-reader reviews remain open release gates.

Overlay manual accessibility review packet:

- `pnpm overlay:manual-a11y-review` runs the existing automated overlay
  acceptance, visual/responsive, and real Next fixture gates before validating
  `docs/reviews/overlay-accessibility/reviewer.review.json`;
- `docs/reviews/overlay-accessibility/` now contains reviewer instructions, the
  machine-readable review schema, current blocked status, and an example JSON
  template;
- the command is expected to fail until a real reviewer records manual WCAG 2.2
  AA and screen-reader evidence with no rejected or disputed scenarios.

Package audit result:

- `pnpm pack` succeeds for implemented package candidates.
- Tarballs include `dist/src`, generated declarations, and `package.json`.
- Tarballs exclude `src/**`, `test/**`, and runtime `.ts` artifacts.
- Package `exports` and the CLI `bin` point to `dist`, not `src/*.ts`.
- Clean consumer install succeeds with the full local tarball set and does not
  fetch internal `@searchlint/*` packages from npm.
- Runtime imports, `searchlint` CLI smoke, catalog E2E, crawler smoke, and
  consumer TypeScript typecheck pass.

Package publication readiness:

- public npm package candidates use `1.0.0-beta.0` metadata;
- public npm package candidates are no longer marked `private: true`;
- public npm package candidates declare `Apache-2.0`, Node.js/pnpm engines,
  keywords, explicit `sideEffects: false` tree-shaking metadata, and npm
  provenance metadata;
- private cloud packages remain `private: true`;
- `pnpm package:dry-run` runs `pnpm pack --dry-run` for 15 public npm package
  candidates, records tree-shaking readiness evidence, and writes
  `docs/examples/package-publication-dry-run-report.sample.json`;
- `pnpm package:registry-install` serves packed public package candidates
  through an ephemeral npm-compatible HTTP registry, installs `@searchlint/cli`
  and `@searchlint/core` into a clean npm consumer project, verifies installed
  CLI version/doctor/JSON check, and writes
  `docs/examples/npm-like-registry-install-report.sample.json`;
- `.github/workflows/npm-release.yml` defines a manual hosted npm release
  workflow with `publish=false` by default, `id-token: write`, Node.js 24, npm
  registry URL configuration, pre-publish package gates, and
  `npm publish --provenance --access public` behind owner-controlled dispatch;
- `pnpm package:release-workflow` verifies the hosted npm release workflow
  contract and writes `docs/examples/npm-release-workflow-report.sample.json`;
- `pnpm package:beta-prep` verifies the prepared `1.0.0-beta.0` public package
  candidate set, private cloud package exclusions, package dry-run,
  npm-like-registry install, hosted release workflow contract, release notes,
  and changelog, then writes
  `docs/examples/prerelease-beta-preparation-report.sample.json`;
- `pnpm package:beta-publication-gate` verifies the owner-controlled beta
  publication gate, required legal/GitHub/npm evidence, absence of npm token
  secrets in the trusted publishing path, and required post-publication evidence
  while keeping the gate status `BLOCKED_EXTERNAL_EVIDENCE`;
- current package publication status is still `BLOCKED` because repository,
  homepage, and bugs metadata require approved public URLs/routing, legal review
  is still pending, npm-side trusted publisher bindings are not proven, and no
  package has been published.

## CLI and CI

Completed locally:

- public `searchlint check` command for snapshot analysis;
- public `searchlint crawl --url` command for local crawl analysis;
- crawl checkpoint/resume file UX through `--checkpoint <path>` and
  `--resume <path>`;
- crawl safety flags for local URL limit, depth, links per page, query variants
  per path, response bytes, redirects, retry attempts, request timeout,
  private-network policy, same-origin policy, robots policy, and user agent;
- public `searchlint init` command for deterministic starter config output;
- public `searchlint config validate` command for DSL validation;
- actionable invalid config errors with path, diagnostic count, per-diagnostic
  code/line/column/message, and next-step command;
- public `searchlint migrate-config` command for validated language-version 1
  config preservation and `.bak` backup creation;
- public `searchlint baseline` command for deterministic baseline entries;
- public `searchlint --version` command for installed version diagnostics;
- public `searchlint doctor` command for deterministic local runtime
  diagnostics;
- public `searchlint completion bash|zsh|fish` command for deterministic shell
  completion output;
- legacy `--snapshot` and `--crawl` flag mode remains supported;
- documented exit codes: `0` pass, `1` invalid input/runtime error, `2`
  diagnostics violate `--fail-on`;
- `pnpm cli:acceptance` installs 15 packed public package tarballs into a clean
  temporary consumer project and verifies 14 installed CLI commands/output
  formats/exit-code cases on macOS with pnpm;
- `pnpm cli:package-manager-acceptance` installs the same packed public package
  tarballs into clean temporary npm and Yarn consumer projects and verifies
  installed `searchlint --version`, `searchlint doctor`, and a JSON check that
  executes all 120 rule IDs;
- `pnpm cli:linux-acceptance` runs installed CLI acceptance and CI environment
  acceptance, then writes a Linux CLI acceptance packet that records whether
  native Linux runner evidence was present in the current run;
- `pnpm cli:windows-acceptance` runs installed CLI acceptance and
  package-manager acceptance, then writes a Windows CLI acceptance packet that
  records whether native Windows runner evidence was present in the current run;
- sanitized sample evidence is stored at
  `docs/examples/cli-acceptance-report.sample.json`;
- package-manager sample evidence is stored at
  `docs/examples/cli-package-manager-acceptance-report.sample.json`;
- Linux CLI packet sample evidence is stored at
  `docs/examples/linux-cli-acceptance-packet-report.sample.json`;
- Windows CLI packet sample evidence is stored at
  `docs/examples/windows-cli-acceptance-packet-report.sample.json`;
- package documentation is consolidated in `docs/PACKAGE_DOCUMENTATION.md` and
  checked by `pnpm reporters:acceptance`;
- contribution documentation is consolidated in `CONTRIBUTING.md` and `DCO.md`
  and checked by `pnpm reporters:acceptance`; legal approval remains a separate
  release gate;
- security documentation is consolidated in `SECURITY.md`,
  `docs/SECURITY_MODEL.md`, and `docs/SECURITY_PRIVACY_RELEASE_GATE.md` and
  checked by `pnpm reporters:acceptance`; dependency audit is covered by
  `pnpm security:dependency-audit`; static SAST is covered by
  `pnpm security:sast`; DAST, penetration testing, legal/security approval, and
  production security review remain separate release gates;
- project-level changelog documentation is consolidated in `CHANGELOG.md` and
  checked by `pnpm reporters:acceptance`; it records pre-release readiness only
  and does not claim SearchLint 1.0 is released;
- release notes are consolidated in `docs/RELEASE_NOTES.md` and checked by
  `pnpm reporters:acceptance`; they document `1.0.0-beta.0` local readiness,
  known limitations, and final `1.0.0` release gates without claiming a public
  release;
- compatibility matrix documentation is consolidated in
  `docs/COMPATIBILITY_MATRIX.md` and checked by `pnpm reporters:acceptance`; it
  indexes verified, partial, blocked, and not-claimed compatibility surfaces
  without claiming Windows/Linux, real npm registry, VS Code Marketplace, live
  cloud/provider/billing, or final security compatibility;
- installation documentation is consolidated in `docs/INSTALLATION.md` and
  checked by `pnpm reporters:acceptance`; it documents current local tarball and
  monorepo verification paths, intended post-publication install commands, and
  explicitly leaves public registry install and VS Code Marketplace install as
  release gates;
- root README release documentation is checked by `pnpm reporters:acceptance`;
  it now covers current status, install/quick-start entry points, local
  developer surfaces, closed cloud/commercial boundaries, validation commands,
  release gates, and the documentation map without claiming SearchLint 1.0 is
  released;
- `pnpm crawler:acceptance` proves deterministic local crawler
  scale/resilience/security behavior, including a 10,000 URL synthetic crawl,
  robots crawl-delay parsing, URL explosion controls, redirect-loop and
  oversized-response failure reporting, retry/timeout/cancellation behavior,
  private-network blocking, and crawl artifact summaries;
- sanitized crawler evidence is stored at
  `docs/examples/crawler-acceptance-report.sample.json`;
- `pnpm crawler:recovery` proves local checkpoint/resume recovery for
  interrupted crawler runs without refetching completed pages;
- sanitized crawler recovery evidence is stored at
  `docs/examples/crawler-recovery-report.sample.json`;
- `pnpm crawler:session` proves deterministic local authenticated request
  headers, `Set-Cookie` session replay, initial session cookies, and
  origin/path/secure cookie isolation;
- sanitized crawler session evidence is stored at
  `docs/examples/crawler-session-report.sample.json`;
- `pnpm crawler:dedupe-rate` proves deterministic local per-origin request
  pacing and duplicate-content grouping by normalized body hash;
- sanitized crawler rate/dedupe evidence is stored at
  `docs/examples/crawler-dedupe-rate-report.sample.json`;
- `pnpm site:outlivion-live-crawl` proves a cautious owner-authorized real-site
  crawl against `https://outlivion.space/`: 126 sitemap URLs crawled, 0 failed
  URLs, 6 skipped URLs, 692 diagnostics, and no full HTML body persistence;
- sanitized Outlivion live-site evidence is stored at
  `reports/outlivion-live-site-crawl-report.json` and
  `docs/examples/outlivion-live-site-crawl-report.sample.json`;
- CI usage snippets for GitHub Actions, GitLab CI, Bitbucket Pipelines, Jenkins,
  and Docker are documented in `docs/CLI_CI_USAGE.md`.
- `pnpm cli:ci-environments` verifies the documented CI environment snippets and
  the repository's static GitHub Actions workflow contract, then writes
  sanitized evidence to
  `docs/examples/ci-environments-acceptance-packet-report.sample.json`; live
  hosted CI runner execution remains a release gate.

Partial:

- Real repository CI workflow files are intentionally not created in this
  ExecPlan.
- Native Windows/Linux runner proof, public registry install, and shell sourcing
  in actual user shells remain release gates.
- Cloud-scale 100,000 URL crawling, real external-site load testing, live
  login-flow automation, worker concurrency, distributed rate limiting, and real
  distributed crawl cost controls remain release gates.
- Broader compatibility against published registry packages remains pending
  until public package publication decisions are approved.

## Reports

Completed locally:

- `docs/REPORT_TEMPLATES.md` defines the local report template contract before
  report implementation, as required by ADR-0012.
- `@searchlint/reporter-html` emits deterministic self-contained HTML reports.
- HTML reports include executive summary, technical report, developer
  diagnostics, client/white-label summary, before/after comparison, deployment
  report, Google/Yandex external-observation report, severity counts, affected
  page count, top rule categories, and print CSS.
- HTML escaping covers report metadata, diagnostic titles, evidence, URLs, and
  source fields, plus external-observation subject URLs and payload summaries.
- Exact source locations are rendered only when diagnostic source confidence is
  `EXACT`.
- CLI `searchlint check` and `searchlint crawl` support `--format html`.
- `pnpm reporters:acceptance` verifies SARIF, JUnit, HTML local report
  templates, print/PDF-ready HTML, and release documentation coverage.
- sanitized reporter/release docs evidence is stored at
  `docs/examples/reporters-release-docs-acceptance-report.sample.json`.
- `@searchlint/reporter-html` builds, typechecks, tests, packs, installs,
  imports, and typechecks from clean consumer verification.
- Release notes, support policy, deprecation policy, versioning policy, upgrade
  guide, and incident/support process documents exist and are linked from
  `README.md`.

Partial:

- Binary PDF export and deterministic static PDF rendering evidence exist.
- Hosted share links, expiration, access controls, and report history have
  deterministic static contracts; live hosted report routes, live
  identity-provider access control, cloud report persistence, dashboard reports
  UI/history, white-label agency workspaces, and live Google/Yandex API-backed
  report inputs are not implemented.

## Rule Documentation

Completed locally:

- `docs/rules/README.md` generated as the 120-rule index;
- 120/120 catalog-declared rule documentation files generated under
  `docs/rules/`;
- every generated rule page includes metadata, severity, confidence, sources,
  required evidence, trigger logic, false-positive guidance, fix guidance,
  fixture references, and implementation surface notes;
- `scripts/generate-rule-docs.mjs --check` verifies generated docs are present
  and up to date;
- `pnpm lint` now includes the generated rule documentation freshness gate.

Partial:

- The generated docs intentionally do not invent concrete HTML/DSL snippets when
  the catalog only provides fixture references and fix guidance.
- Final public docs site/navigation is not implemented.

## Dashboard

Completed locally:

- `@searchlint/dashboard` has build/typecheck/test setup.
- Dashboard snapshot contracts cover organization, project, environment,
  diagnostics, crawl runs, trend points, Google/Yandex external observations,
  report summaries, quota usage, and team members.
- Dashboard summary derivation counts diagnostics, affected pages, severity
  totals, latest crawl state, stale external observations, reports, team
  members, and exhausted quotas deterministically.
- Dashboard action routes reuse checked `/v1` cloud API contracts instead of
  duplicating endpoint strings.
- Dashboard project route contracts build and parse deterministic local paths
  for onboarding, overview, issues, diagnostics, crawl history, trends, external
  observations, reports, organization, site, environments, team, billing,
  settings, and audit-log views with encoded organization/project/environment
  IDs.
- Dashboard project view model combines a snapshot and active project route into
  a canonical route, summary, active view label, and navigation items while
  rejecting route/snapshot identity mismatches.
- Dashboard project section model maps every active project view to typed,
  deterministically ordered section data for onboarding, overview, issues,
  diagnostics, crawl history, trends, external observations, reports, deployment
  history, organization, site, environments, team members, billing/usage,
  settings route contracts, and audit-log summaries.
- Dashboard active project view HTML renderer turns the project view model into
  a complete accessible HTML document for one active section, with navigation
  current state and escaped section data.
- Dashboard project route render resolver parses local project paths into
  project view models and active HTML output, returning `notFound` for unknown
  routes while preserving route/snapshot identity checks.
- Dashboard project snapshot loader render boundary parses local project paths,
  calls an injected snapshot loader with decoded route IDs, distinguishes route
  `notFound` from missing snapshots, and reuses the active-view renderer after
  loading.
- Dashboard runtime orchestrator gates project routes through stored-session
  auth route intents, parses local project routes, fetches snapshots through the
  typed dashboard API client, renders active project views, and returns explicit
  redirect, not-found, snapshot-missing, rendered, and API-error states without
  DOM side effects.
- Dashboard browser runtime routing boundary reads the current local browser
  pathname through an injected location port, delegates to the existing project
  runtime resolver, redirects auth intents through an injected navigation port,
  and renders project HTML, not-found, snapshot-missing, and API-error states
  through typed render ports without React/Next.js or direct DOM globals.
- Dashboard browser DOM app-shell adapter implements the runtime render port for
  an injected root element, writes rendered project HTML and accessible
  not-found, snapshot-missing, and API-error states, sets stable runtime-state
  attributes, updates an injected document title, and focuses the root when
  supported without direct `document` or `window` global access.
- Dashboard browser history runtime registers injected `popstate` and click
  listeners, boots the current dashboard path, intercepts same-origin local
  dashboard link clicks, pushes local dashboard paths through an injected
  history port, reruns the browser runtime after navigation, ignores external
  and modified clicks, and removes listeners through an explicit `stop`
  lifecycle without direct browser globals.
- Dashboard browser app bootstrap composition validates injected browser/config
  ports, composes browser session storage, stored-session Cognito dashboard API
  client, DOM app-shell renderer, and browser-history runtime, starts the
  runtime once, and returns a running app handle with `navigate` and `stop`
  lifecycle methods without direct browser globals.
- Dashboard hosted HTML shell contract renders a deterministic hostable document
  with an accessible boot root, serialized bootstrap JSON, module entry script,
  optional CSP nonce, optional stylesheet links, and safe text/URL/JSON escaping
  without claiming a deployed dashboard runtime.
- Dashboard browser entry contract reads hosted shell bootstrap JSON from the
  document, resolves the dashboard root by ID, binds browser-like
  location/history/sessionStorage/fetch/event/navigation ports, starts the
  framework-neutral dashboard browser app, and fails deterministically before
  startup side effects when shell config or browser ports are invalid.
- Dashboard browser entry package exports expose explicit and auto-start module
  entry points at `@searchlint/dashboard/browser-entry` and
  `@searchlint/dashboard/browser-entry.auto`, with typed global configuration,
  global running-app promise exposure, and `dist/src` package targets.
- Dashboard hostable browser asset pipeline declares the dashboard entry asset
  in package metadata, generates
  `dist/assets/searchlint-dashboard-browser-entry.auto.js` and
  `dist/assets/searchlint-dashboard-assets.json` during dashboard package build,
  records byte size and SHA-256 hash, and verifies the generated artifact in the
  repository lint gate.
- Dashboard bundled browser asset generation emits
  `dist/assets/searchlint-dashboard/searchlint-dashboard.bundle.min.js`, records
  bundle metadata in the generated asset manifest, verifies no runtime imports
  remain in the bundle, and proves the bundle boots the hosted dashboard in
  Chromium.
- Dashboard API request contracts build action requests from checked `/v1`
  routes, substitute encoded path parameters, preserve schema versions, validate
  current action bodies, support the stable `getDashboardSnapshot` GET route and
  `startExternalProviderOAuthConnection` and
  `completeExternalProviderOAuthConnection` external-provider OAuth routes,
  reject unsupported providers and malformed start/callback bodies before
  transport calls, and use an injected async transport boundary.
- Dashboard authenticated fetch transport builds absolute API URLs, sends bearer
  tokens and schema-version headers, serializes JSON bodies only for requests
  that have bodies, normalizes JSON and text responses, and maps missing tokens,
  invalid base URLs, and fetch failures to deterministic client errors.
- Dashboard session token provider models Cognito/OIDC bearer sessions, enforces
  expiry with configurable skew, supports an injected refresh callback, and
  rejects invalid or expired sessions deterministically without adding browser
  storage.
- Dashboard stored-session access-token provider loads persisted
  `DashboardAuthSession` values through an injected store, refreshes near-expiry
  sessions through an injected callback, saves validated refreshed sessions, and
  reuses the refreshed token in memory for API transport calls.
- Dashboard stored auth session lifecycle resolves persisted sessions as
  missing, valid, or expired with the same clock/skew semantics and clears
  persisted sessions through the injected session store for sign-out handling.
- Dashboard auth route-intent boundary converts missing, valid, and expired
  persisted auth sessions into explicit sign-in, dashboard, or session-expired
  route intents without browser navigation or framework routing.
- Dashboard Cognito hosted logout/sign-out boundary builds deterministic
  app-client logout URLs, validates logout inputs before session clearing, and
  clears persisted sessions through the injected store without browser
  navigation.
- Dashboard Cognito stored-session API client composition wires the persisted
  session store, Cognito refresh-token grant adapter, stored-session token
  provider, authenticated fetch transport, and typed dashboard API client
  through injected fetch and storage ports.
- Dashboard Cognito hosted UI contracts build deterministic authorization-code
  PKCE URLs and parse callbacks with state validation, provider-error mapping,
  and typed authorization-code results.
- Dashboard Cognito PKCE callback completion consumes persisted pending auth
  state, exchanges authorization codes through the injected Cognito token fetch,
  persists validated `DashboardAuthSession` values, and avoids session writes on
  authorization or token provider failures.
- Dashboard Cognito token exchange contracts post authorization-code PKCE forms
  through an injected fetch boundary and parse validated bearer token responses
  into `DashboardAuthSession` values without adding browser storage.
- Dashboard Cognito refresh-token adapter posts refresh-token grant forms
  through the same injected token endpoint fetch boundary, maps
  provider/malformed/ transport failures deterministically, and preserves the
  current refresh token when the provider response omits a replacement.
- Dashboard Cognito PKCE pending-auth lifecycle contracts preserve state, nonce,
  code challenge, redirect URI, and verifier through an injected store, consume
  callbacks into token exchange requests, enforce expiry, and delete consumed or
  invalid pending states deterministically.
- Dashboard external-provider OAuth pending-state lifecycle contracts preserve
  provider, tenant/project/environment identity, state, redirect URI, scopes,
  and optional verifier through an injected store, call the authorization-start
  API before redirect, consume provider callbacks into backend completion
  requests, enforce expiry, and delete consumed or invalid pending states
  deterministically.
- Dashboard external-provider OAuth browser redirect boundary calls the checked
  start/pending-state helper and assigns the returned Google/Yandex
  authorization URL through an injected navigation port, mapping navigation
  failures to deterministic dashboard client errors without direct `window`
  access in shared logic.
- Dashboard browser PKCE storage adapter serializes pending auth state through a
  storage-like port with deterministic namespaced keys, JSON/shape validation,
  invalid-state cleanup, and storage failure mapping.
- Dashboard browser external-provider OAuth storage adapter serializes pending
  Google/Yandex connector state through a storage-like port with deterministic
  namespaced keys, JSON/shape validation, invalid-state cleanup, and storage
  failure mapping.
- Dashboard browser session storage adapter persists validated
  `DashboardAuthSession` values through the same storage-like port with
  deterministic namespaced keys, JSON/session validation, invalid-session
  cleanup, and storage failure mapping.
- Dashboard external-observation views now include Google/Yandex connector
  controls and connection statuses derived from observations, with checked
  authorization-start action metadata and no live-success claim when
  observations are absent.
- Dashboard settings now include hosted/local Google/Yandex provider settings,
  with connection status, observed subject counts, checked OAuth start route
  contracts, required scopes, and callback URIs.
- Dashboard settings now include hosted/local notifications UI, with visible
  summary counts, notification channels, notification rules, and recent delivery
  history.
- Dashboard team view now includes hosted/local Team/RBAC management UI, with
  principal IDs, role permission summaries, checked add-member route evidence,
  and management actions for invite, removal, and ownership transfer.
- Dashboard trends view now renders hosted/local deployment history records,
  including deployment time, environment, commit reference, status, diagnostics
  before/after, delta, and annotation.
- Dashboard hosted/local production-like acceptance now covers all current
  project dashboard views through `pnpm dashboard:acceptance`, including seeded
  Cognito-like session state, local `/v1` dashboard snapshot responses,
  anonymous redirect behavior, hosted route-flow checks, accessibility checks,
  and visual screenshot/layout checks.
- User-facing dashboard labels are routed through message keys.
- The static dashboard HTML shell exposes accessible landmarks, headings, named
  sections, empty states, error states, and labelled tables for onboarding,
  overview, issues, diagnostics, crawl history, trends, external observations,
  reports, organization, site, environments, team, billing, settings, and audit
  log.
- Tests cover summary derivation, route mapping, API request construction,
  validation failures, injected transport invocation, authenticated fetch
  transport behavior, session token provider behavior, stored-session token
  provider behavior, project route contract behavior, project view model
  behavior, project section model behavior, active project view HTML rendering,
  project route render resolver behavior, loader-backed project route rendering
  behavior, dashboard runtime orchestration behavior, stored auth session
  lifecycle behavior, auth route-intent behavior, Cognito hosted logout/sign-out
  behavior, stored-session API client composition behavior, Cognito hosted UI
  authorization URL/callback behavior, Cognito PKCE callback completion
  behavior, Cognito token exchange behavior, Cognito refresh-token adapter
  behavior, PKCE pending-auth lifecycle behavior, browser PKCE storage adapter
  behavior, external-provider OAuth browser redirect behavior, dashboard browser
  runtime routing behavior, dashboard browser DOM app-shell adapter behavior,
  dashboard browser history runtime behavior, dashboard browser app bootstrap
  composition behavior, hosted dashboard HTML shell rendering behavior, browser
  entry startup behavior, browser entry package export behavior, hostable
  browser asset metadata behavior, browser session storage adapter behavior,
  message key coverage, accessibility-oriented landmarks/table labels,
  deterministic diagnostic ordering, and HTML escaping.

Partial:

- No deployed Next.js/React dashboard runtime.
- No deployed Next.js/React dashboard shell, deployed dashboard runtime, live
  OAuth credential proof, provider credential env wiring, live Stripe-backed
  billing UI, pixel-perfect visual regression service, or external WCAG/axe
  dashboard accessibility pass.
- Dashboard snapshot database aggregation adapters for Google/Yandex external
  observations, user profiles, and richer report diagnostic totals are not
  implemented yet.
- Dashboard report UI, issue/evidence views, team read UI, and quota summary UI
  have hosted/local proof; before/after charts, Google/Yandex live rendering,
  team settings mutations, invite flows, billing mutations, and quota management
  remain foundation-only.

## Repository Hygiene

Findings:

- `apps/dashboard` now contains a tested framework-neutral dashboard foundation;
  `services/api` and `services/workers` contain substantial local cloud backend
  and worker foundations, but deployed runtime proof remains missing.
- `services/workers` now contains outbox dispatching, SQS/S3/PostgreSQL worker
  adapters, long-running crawler and cleanup worker runtimes, executable Node
  entrypoints, Docker image coverage, and checked AWS IaC templates; deployed
  AWS runtime proof remains missing.
- `pnpm workers:acceptance` now provides deterministic evidence for the SQS/DLQ
  provisioning contract, SQS enqueue/dequeue and retry/delete semantics, crawler
  worker ECS/Fargate template shape, worker lifecycle and structured logs,
  report artifact cleanup scheduler, external observation scheduler, and
  queue/worker/scheduler documentation.
- `pnpm workers:backoff-cancel` now provides deterministic evidence for local
  worker retry backoff through SQS message visibility changes and crawl job
  cancellation through a pre-execution guard with structured counters.
- `pnpm workers:job-history` now provides deterministic evidence for worker
  crawl job history through tenant/project/environment-scoped PostgreSQL history
  queries and lifecycle summary counts.
- `pnpm auth:acceptance` now provides deterministic evidence for the Cognito
  provisioning contract, Cognito JWT principal extraction, SearchLint-owned RBAC
  role/permission matrix, organization/project/environment lifecycle, member
  removal, ownership transfer, tenant isolation checks, audit events, and
  PostgreSQL membership SQL contracts.
- Focused synthetic catalog tests still exist for narrow invalid cases, but the
  test suite now also covers the real checked-in catalog through core, CLI, and
  crawler release smoke paths.
- `git status --short` shows the repository contents as untracked in this
  checkout, so tracked diff review is not reliable here.

No broad TODO/FIXME backlog was found in implementation source, but deployed
cloud/dashboard runtime acceptance remains an implementation gap.

## Cloud Decisions

Completed:

- OD-009 is approved in `docs/adr/0016-cloud-architecture-provider.md`.
- OD-010 is approved in `docs/adr/0017-auth-organizations-rbac.md`.
- OD-017 is approved in `docs/adr/0018-public-api-sdk-compatibility.md`.
- OD-018 is approved in `docs/adr/0019-data-retention-deletion.md`.
- OD-019 is approved in `docs/adr/0020-analytical-storage.md`.
- OD-020 is approved in `docs/adr/0021-billing-plans-product-limits.md`.
- OD-021 is approved in `docs/adr/0023-custom-rule-plugin-sandboxing.md`.
- OD-024 is approved in `docs/adr/0024-localization-policy.md`.
- OD-025 is approved in `docs/adr/0025-data-contract-migrations.md`.
- OD-027 is approved in `docs/adr/0027-docker-base-image.md`.
- SearchLint Cloud 1.0 primary provider is AWS.
- API and worker runtime topology is containerized Node.js on ECS with Fargate.
- API and worker runtime containers use the official Node.js 24 Debian Bookworm
  slim image family, `node:24-bookworm-slim`, with release digest pinning
  deferred to the image build/deployment pipeline.
- Product Dockerfiles now exist for the API and crawler worker services, with a
  static Dockerfile verifier wired into `pnpm lint`.
- CI now includes a build-only Docker image gate for the API and crawler worker
  images, with a static workflow verifier wired into `pnpm lint`.
- The same CI gate now scans the locally built API and crawler worker images for
  `CRITICAL` OS/library vulnerabilities before later registry or ECS work.
- The same CI gate now generates CycloneDX SBOM artifacts for the locally built
  API and crawler worker images.
- The generated SBOM artifacts now receive signed GitHub build-provenance
  attestations.
- Cloud storage, queue, and vault boundaries are RDS PostgreSQL, S3, SQS, AWS
  KMS, AWS Secrets Manager, and internal provider ports.
- Authentication uses Amazon Cognito user pools with SearchLint-owned
  organization RBAC.
- Billing uses Stripe Billing with SearchLint-owned entitlement enforcement.
- Analytical storage starts in PostgreSQL metric events and rollups behind a
  `MetricsStore` port.
- SearchLint 1.0 forbids third-party custom code execution in cloud.
- Cloud APIs start at `/v1`, persisted artifacts use per-contract schema
  versions, and dashboard/report UI uses localizable message keys.

Still pending before final release:

- OD-016 open-source/commercial licensing boundary;
- OD-023 blocker precision measurement method.

Completed backend foundation:

- `@searchlint/api` builds, typechecks, and tests.
- Cloud API foundation exports tenant-scoped domain types, RBAC helpers,
  provider ports, and application-service contracts.
- `@searchlint/api` exports stable `/v1` route contracts for current cloud
  service operations, including the `getDashboardSnapshot` dashboard read
  contract.
- `@searchlint/api` includes an injected dashboard snapshot runtime handler
  boundary with API-owned payload contracts, `project:read` authorization,
  project/environment identity checks, and deterministic missing-store or
  missing-snapshot errors.
- `@searchlint/api` includes PostgreSQL dashboard snapshot persistence
  contracts, parameterized upsert/select SQL, a query-executor-backed
  `DashboardSnapshotStore` adapter, and API process wiring for the
  `getDashboardSnapshot` route.
- `@searchlint/api` includes a dashboard snapshot materialization boundary that
  turns typed source inputs into deterministic dashboard snapshot JSON, derives
  current diagnostic trend points when historical trend inputs are absent, and
  writes the current snapshot through PostgreSQL upsert.
- `@searchlint/api` includes a PostgreSQL dashboard snapshot source loader for
  existing cloud tables: organization/project/environment identity, recent crawl
  requests, report artifact metadata, Google/Yandex external observations,
  membership roles, and entitlement-backed quota usage.
- `@searchlint/api` includes persisted PostgreSQL diagnostic storage with
  environment-scoped selectors and dashboard snapshot loader mapping for rule
  IDs, severity, confidence, evidence, source location, structured evidence,
  observation time, and fingerprint.
- `@searchlint/api` includes an internal crawl diagnostic ingestion boundary
  with `diagnostic:write` authorization, project/environment/crawl-request
  identity checks, diagnostic enum/evidence validation, API-owned ids,
  PostgreSQL-backed upserts, audit events, and metrics.
- `@searchlint/api` includes provider-aware external observation persistence
  contracts and a PostgreSQL adapter for Google/Yandex observation records,
  preserving provider/source, subject URL, observed/fetched timestamps,
  freshness, quota, sampling, raw payload evidence, fingerprint idempotency, and
  provider/source mismatch rejection.
- `@searchlint/api` includes a Google provider adapter foundation with injected
  HTTP transport for URL Inspection, Search Analytics, and Sitemap responses,
  normalizing mocked provider payloads into Google external observations with
  freshness, quota, raw payload evidence, and stable fingerprints.
- `@searchlint/api` includes a Yandex provider adapter foundation with injected
  HTTP transport for Webmaster URL-status, Webmaster Sitemap, and Metrica
  landing-page responses, normalizing mocked provider payloads into Yandex
  external observations with freshness, quota, sampling, raw payload evidence,
  and stable fingerprints.
- `@searchlint/api` includes OAuth connection metadata and vault-reference
  storage contracts for Google/Yandex provider connections, including PostgreSQL
  schema/SQL/store coverage for provider account ids, scopes, expiry, status,
  refresh scheduling selection, revocation, and secret refs without persisting
  raw OAuth token values.
- `@searchlint/api` includes a backend external-provider OAuth connection
  completion operation and stable `/v1` route contract. The operation requires
  `connector:manage`, validates project/environment identity before provider
  exchange, exchanges authorization codes through injected provider ports,
  resolves provider account ids through an injected resolver, writes access and
  refresh tokens through the `SecretVault` port, and upserts
  `OAuthConnectionRecord` metadata without persisting raw token values.
- `@searchlint/workers` includes an external observation collection
  orchestration foundation that selects due OAuth connections, resolves access
  tokens through an injected vault reader, optionally refreshes Google/Yandex
  OAuth access tokens before provider collection, writes refreshed/rotated token
  values through a writable vault, routes Google/Yandex connections to
  provider-specific collectors, persists returned external observations, and
  exposes a polling runtime with deterministic batch counters.
- `@searchlint/workers` includes an external observation collection process
  factory and `searchlint-external-observation-worker` executable boundary with
  Postgres/provider/poll/batch/OTLP env parsing, lifecycle wiring, production
  batch/error logging, focused Node runner tests, target-driven provider
  collector wiring, and optional Google/Yandex OAuth refresh credential env
  wiring.
- `@searchlint/workers` includes an AWS Secrets Manager access-token vault
  adapter for external observation collection. The adapter maps SearchLint
  `secret://...` OAuth refs to AWS Secrets Manager `SecretId` values, supports a
  deployed secret-name prefix, rejects cross-organization refs before the AWS
  call, rejects unsupported/empty/binary-only secrets, supports
  `PutSecretValueCommand` writes for refreshed token values, supports
  `DeleteSecretCommand` deletion with a recovery window, and is now the default
  external-observation process vault. Dashboard connection UI, live credential
  proof, deployed scheduler wiring, production provider credential env wiring,
  and deployed AWS runtime proof remain incomplete.
- `pnpm oauth-vault:acceptance` verifies deterministic KMS/Secrets Manager
  template shape, OAuth token write/read/refresh/rotation/revocation, secret
  deletion with recovery window, tenant-scoped secret refs, audit/metrics, and
  sanitized no-raw-token report evidence.
- `@searchlint/workers` includes Google/Yandex external observation provider
  collectors that call the existing `@searchlint/api` Google and Yandex provider
  adapters. Process env can configure subject URLs, sitemap URLs, Google Search
  Analytics date range, and Yandex Metrica counter/date range. Automatic target
  discovery, PageSpeed/CrUX, exact live endpoint proof, and deployed live
  credential proof remain incomplete.
- `@searchlint/api` includes a framework-neutral HTTP dispatcher for current
  `/v1` operations, including the `getDashboardSnapshot` route.
- `@searchlint/api` includes a built-in Node.js `node:http` server adapter that
  delegates to the shared dispatcher, serves `/healthz`, serializes JSON
  responses, and handles unsupported methods, invalid JSON, and oversized
  request bodies deterministically.
- The Node.js HTTP server adapter includes structured request log events,
  deterministic request IDs, opt-in dispatcher timeouts, and opt-in in-memory
  rate limiting.
- The Node.js HTTP runtime exposes an explicit graceful shutdown boundary that
  closes the server, aborts in-flight request signals, tracks open sockets, and
  force-destroys remaining sockets after a configurable grace period.
- The Node.js HTTP runtime includes injectable `SIGTERM`/`SIGINT` shutdown
  signal wiring that reuses the explicit shutdown boundary without calling
  `process.exit()`.
- `@searchlint/api` exports a typed API Gateway/ECS/Fargate deployment contract
  for the current Node.js 24 `node:http` runtime, `/healthz`, request IDs,
  shutdown signals, body limits, dispatcher timeout, CloudWatch structured
  logging expectation, PostgreSQL env wiring, and current `/v1` route contracts.
- `@searchlint/api` includes a deployment-contract validator that rejects drift
  from the approved AWS API Gateway HTTP API, ECS/Fargate runtime, Node.js 24,
  built-in `node:http` adapter, current route contracts, `/healthz`,
  `SIGTERM`/`SIGINT`, and required PostgreSQL env variables.
- `@searchlint/api` includes a Cognito/OIDC JWT verifier and Node HTTP principal
  extractor that validates bearer token shape, RS256 signatures, issuer,
  audience/client ID, token use, time claims, key IDs, and maps valid tokens
  into the existing `Principal` contract.
- `@searchlint/api` includes a remote Cognito/OIDC JWKS provider with HTTPS URL
  enforcement, injected fetch boundary, deterministic TTL cache, shared
  in-flight fetches, timeout handling, JWKS shape validation, and stale-cache
  fallback after a successful fetch.
- `@searchlint/api` has route-level Node HTTP acceptance tests proving Cognito
  bearer tokens become dispatcher principals and missing/invalid credentials
  return deterministic `401 UNAUTHENTICATED` responses before application
  dispatch.
- `@searchlint/api` exports persistence schema contracts with tenant scope,
  schema versions, retention/deletion metadata, and indexes.
- `@searchlint/api` can generate deterministic PostgreSQL DDL from the
  persistence schema contracts.
- `@searchlint/api` exports deterministic PostgreSQL repository SQL contracts
  for current relational store operations.
- `@searchlint/api` includes a PostgreSQL-backed `RelationalStore` adapter
  boundary using a framework-neutral query executor.
- `@searchlint/api` includes a cloud transaction manager port for DB-side
  state-changing operations.
- `@searchlint/api` includes a `pg`-backed query executor and cloud transaction
  manager that runs `BEGIN`, transaction-scoped writes, `COMMIT`, `ROLLBACK`,
  and client release through a concrete PostgreSQL client boundary.
- `pnpm db:pool-transaction` provides deterministic evidence for PostgreSQL pool
  env parsing and transaction manager semantics without live DB access.
- `pnpm db:tenant-rbac` provides deterministic evidence for local data-layer
  tenant/RBAC contracts: tenant-scoped schema metadata, PostgreSQL
  `organization_id` SQL filters, API RBAC tests, PostgreSQL repository SQL
  tests, and sanitized machine-readable evidence without live DB access.
- `@searchlint/api` includes a deterministic PostgreSQL migration runner for the
  current cloud persistence schema, with a migration ledger, checksums,
  idempotent skips, checksum-drift rejection, transaction commit/rollback, and
  client release.
- `pnpm db:migration-compat` provides deterministic evidence for local
  PostgreSQL migration compatibility: ordered base-schema and additive
  migrations, stable migration checksums, additive `ADD COLUMN IF NOT EXISTS`
  evolution, and migration-runner coverage for apply, skip, checksum drift,
  rollback, release, and empty migration rejection without live DB access.
- `@searchlint/api` includes a monitored PostgreSQL query-executor wrapper that
  records sanitized query observations with duration, row count, statement type,
  query fingerprint, success/failure status, and slow-query status without SQL
  parameter values.
- `pnpm db:query-monitoring` provides deterministic evidence for database
  monitoring and slow-query monitoring at the API PostgreSQL query-executor
  boundary, including success, failure, slow-query classification, sink-failure
  isolation, and transaction-manager wiring without live DB access.
- `pnpm db:restore-pitr` provides deterministic evidence for PostgreSQL restore
  and point-in-time recovery validation plans: isolated targets, schema SQL
  checksum, migration ledger checksums, RPO/RTO calculations, and required
  post-restore tenant/RBAC, API/dashboard, and deletion-state checks without
  live DB access.
- `pnpm db:load-benchmark` provides deterministic evidence for local database
  load testing at the API query-executor boundary: 1,200 generated SQL
  operations, concurrency 24, INSERT/SELECT/UPDATE statement mix, 0 failures,
  deterministic p95 duration, and sanitized query-fingerprint evidence without
  live DB access.
- `@searchlint/api` includes PostgreSQL env-to-pool wiring with explicit
  database URL, pool sizing, timeout, and SSL-mode validation.
- `@searchlint/api` includes an opt-in PostgreSQL integration harness for
  running current migrations against a real database when
  `SEARCHLINT_POSTGRES_TEST_DATABASE_URL` is provided.
- The repository includes `pnpm verify:postgres`, which runs the PostgreSQL
  migration integration proof against either an explicit database URL or a
  temporary local Docker PostgreSQL container.
- CI includes a PostgreSQL service-container job that runs
  `pnpm verify:postgres`.
- `pnpm storage:backup:acceptance` verifies deterministic storage readiness:
  persistence schema tenant/retention/deletion/index invariants, migration IDs
  and checksums, private encrypted RDS IaC backup controls, private encrypted S3
  artifact bucket controls, TLS-only bucket policies, lifecycle cleanup, and
  backup/restore/RPO/RTO documentation coverage.
- sanitized storage/backup readiness evidence is stored at
  `docs/examples/storage-backup-readiness-report.sample.json`.
- `docs/DATABASE_STORAGE_BACKUP_RESTORE.md` defines the PostgreSQL/S3 backup,
  restore, retention/deletion, RPO/RTO, and real deployment gate contract.
- `pnpm object-storage:acceptance` verifies deterministic artifact object
  storage security contracts: private encrypted versioned S3 artifact buckets,
  TLS-only bucket policies, access-log bucket configuration, lifecycle and
  multipart cleanup, tenant-scoped crawl artifact keys, `s3://`-only report
  artifact deletion boundaries, and remaining runtime gates.
- sanitized object-storage artifact security evidence is stored at
  `docs/examples/object-storage-artifact-security-report.sample.json`.
- `@searchlint/workers` includes a hosted report artifact signed URL
  authorization service behind an injected presigner port, with organization,
  project, environment, active/deleted, expiry, TTL, and sanitized audit
  controls.
- `pnpm object-storage:signed-url` verifies deterministic signed URL
  authorization evidence for hosted report artifacts without live S3 access.
- `pnpm object-storage:tenant-logs` verifies deterministic object-storage tenant
  isolation and access-log contracts: tenant-scoped crawl keys, encoded path
  segments, report signed URL cross-scope denial, metadata-governed `s3://`
  deletion, S3 access-log destination/prefix/retention, and access-loggable key
  hygiene without live S3 access.
- `@searchlint/workers` records crawl artifact `ContentLength`, byte-size
  metadata, and SHA-256 metadata at the S3 adapter boundary, and exports a
  restore verification plan helper for artifact URI, tenant scope, byte size,
  digest, and validation steps.
- `pnpm object-storage:large-restore` verifies deterministic large artifact
  metadata and restore verification contracts without live S3 access.
- `docs/OBJECT_STORAGE_ARTIFACT_SECURITY.md` documents the artifact bucket,
  tenant isolation, retention/deletion, signed URL, large artifact, access log,
  restore, and real S3 release-gate boundaries.
- `pnpm api:acceptance` verifies deterministic backend API route/deployment and
  security contracts: stable `/v1` route contracts, checked OpenAPI 3.1
  artifact, API Gateway/ECS/Fargate CloudFormation shape, Node HTTP runtime
  authentication, request validation, rate limiting, timeout/cancellation,
  deterministic error envelopes, request IDs, structured logging, RBAC/tenant
  identity tests, idempotency keys, and audit-event paths.
- sanitized backend API acceptance evidence is stored at
  `docs/examples/backend-api-acceptance-report.sample.json`.
- `specs/openapi/searchlint-cloud-api-v1.openapi.json` is generated from the
  current checked route contracts and is now part of the backend API acceptance
  evidence.
- `docs/BACKEND_API_DEPLOYMENT_SECURITY_ACCEPTANCE.md` documents the accepted
  local/static API proof and the remaining real production deployment, live
  PostgreSQL, load, DAST, and penetration-test gates.
- `@searchlint/api` includes durable outbox schema, SQL contracts, port, and
  query-executor-backed append adapter for DB-to-queue handoff.
- `@searchlint/workers` includes a framework-neutral outbox dispatcher boundary
  that selects due events, leases before publishing, publishes through an
  abstract port, and records published or failed outcomes.
- `@searchlint/workers` includes an SQS-backed outbox publisher adapter for
  `crawl.requested` messages with deterministic JSON bodies, message attributes,
  and standard/FIFO queue validation.
- `@searchlint/workers` includes a framework-neutral long-running outbox polling
  runtime with explicit start/stop/done lifecycle, sequential dispatches,
  abortable interval sleep, batch/error callbacks, and configurable
  stop-on-error behavior.
- `@searchlint/workers` includes local bounded crawler batch concurrency through
  `consumeSqsCrawlBatch({ concurrency })`, with deterministic evidence from
  `pnpm workers:concurrency`.
- `@searchlint/workers` includes a PostgreSQL-backed outbox dispatch store
  adapter that reuses the `@searchlint/api` outbox SQL contracts through the
  shared query-executor boundary.
- `@searchlint/workers` includes worker process lifecycle helpers for start/stop
  wrapping, `SIGTERM`/`SIGINT` shutdown binding, ECS-compatible
  `ready`/`draining`/`stopped`/`failed` states, and injectable exit-code policy.
- `@searchlint/workers` exports a typed ECS/Fargate worker deployment contract
  and validator for the current outbox polling runtime, PostgreSQL/SQS
  environment wiring, CloudWatch logging expectation, shutdown signals, and SQS
  DLQ requirement.
- `@searchlint/workers` now has a production log sink boundary that maps worker
  lifecycle, outbox batch, and runtime error events to stable JSON lines for
  container log collection.
- `@searchlint/workers` now has a side-effect-light crawler worker process
  factory that validates PostgreSQL/SQS/S3 environment, assembles PostgreSQL
  target and job stores, SQS polling, S3 artifact storage, Node fetch, runtime
  wrapping, structured crawler batch/error logs, and explicit lifecycle
  installation without starting the process automatically.
- `@searchlint/workers` now declares a `searchlint-crawler-worker` executable
  bin that binds Node process environment, `SIGTERM`/`SIGINT` lifecycle
  handling, runtime start/done, stderr startup/runtime failures, and
  process-exit-code mapping to the crawler worker process factory.
- `@searchlint/workers` exports a typed SQS/DLQ/IAM provisioning contract and
  validator for the crawl request queue target that future IaC must satisfy.
- `@searchlint/workers` includes a cloud crawler execution boundary that
  resolves `crawl.requested` targets through an injected storage port, runs the
  shared crawler, and records running/succeeded/failed job state through an
  injected store port.
- `@searchlint/workers` now includes PostgreSQL-backed crawl target and crawl
  status adapters that resolve environment `base_url` values and update
  `crawl_requests.status` through exported API SQL contracts.
- Persistence schema validation rejects missing tenant, schema-version,
  retention/deletion, and index-column invariants before SQL generation.
- Membership records now carry stable IDs matching the persistence schema.
- Crawl requests now carry explicit lifecycle status matching the persistence
  schema.
- Organization, member, project, environment, and crawl-request workflows
  enforce organization membership and permission checks.
- Current protected cloud operations have table-driven authorization matrix
  acceptance covering allowed and forbidden roles for member management, project
  creation, environment creation, and crawl requests.
- Forbidden authorization-matrix calls leave audit events, metrics, queues,
  memberships, projects, environments, and crawl requests unchanged.
- `pnpm verify:postgres` now includes an opt-in PostgreSQL-backed authorization
  matrix acceptance test for the same protected operations.
- Crawl request creation checks entitlements before queue handoff.
- Crawl request creation validates `maxUrls` before entitlement or queue side
  effects.
- Dispatcher maps missing auth, invalid input, not found, forbidden, entitlement
  denial, and internal errors to deterministic HTTP responses.
- The Node HTTP API runtime now has ECS-compatible task lifecycle wiring with
  observable `ready`, `draining`, `stopped`, and `failed` states around the
  existing shutdown boundary.
- The Node HTTP API runtime now has an explicit process exit-code policy that
  maps graceful shutdown to `0` and forced or failed shutdown to `1` through an
  injectable `process.exitCode` sink without calling `process.exit()`.
- The Node HTTP API runtime now has a production log sink boundary that maps
  structured request events to OpenTelemetry-shaped JSON lines for container log
  collection.
- `@searchlint/api` now exports a CloudWatch Logs provisioning contract covering
  API and worker log groups, JSON-lines container stdout/stderr collection,
  required event names and attributes, 30-day retention, and KMS key ARN env
  requirements.
- `@searchlint/api` now exports an ECS `awslogs` log-driver contract tying API
  and worker containers to those CloudWatch log groups with same-region
  `SEARCHLINT_AWS_REGION`, non-blocking mode, explicit buffer sizing, and
  execution-role log stream write permissions.
- `@searchlint/api` now exports an observability exporter contract tying
  OpenTelemetry OTLP environment wiring and CloudWatch EMF metric extraction to
  the approved API/worker structured log events.
- `@searchlint/api` now exports a CloudWatch EMF runtime mapper that turns
  approved API/worker production log records into deterministic EMF metric
  documents without AWS calls or runtime exporter SDK coupling.
- `@searchlint/api` now exports an OTLP runtime config parser that validates the
  approved OpenTelemetry environment variables, endpoint URL, protocol, timeout,
  and secret-bearing header pairs before future SDK/exporter startup.
- The Cloud API process now includes validated OTLP observability config in its
  process configuration and rejects invalid OpenTelemetry environment settings
  before PostgreSQL pools or HTTP runtime clients are created.
- The Cloud API process now includes validated Cognito issuer, audience, JWKS
  URL, and token-use config, and creates the Cognito principal extractor from
  runtime env by default while preserving injectable principal extraction for
  tests and embedding.
- The crawler worker process now includes validated OTLP observability config in
  its process configuration and rejects invalid OpenTelemetry environment
  settings before PostgreSQL, SQS, or S3 clients are created.
- `@searchlint/api` now exports an OTLP exporter lifecycle boundary with
  deterministic startup/shutdown idempotency, timeout handling, and failure
  states for the future real OpenTelemetry exporter runtime.
- `@searchlint/api` now exports a real OpenTelemetry OTLP SDK adapter that
  constructs log and metric exporters/providers from the validated runtime
  config through the lifecycle boundary without test-time network requests.
- The Cloud API and crawler worker Node runners now start the OTLP exporter
  lifecycle before listening or polling and shut it down on normal completion,
  signal-driven shutdown, and startup/runtime failure paths.
- `@searchlint/api` now exports a CloudWatch/OTLP IaC provisioning target
  contract that ties the approved CloudWatch log groups, ECS `awslogs` wiring,
  OpenTelemetry OTLP task environment variables, Secrets Manager-backed OTLP
  headers, and CloudWatch EMF namespace/dimensions to API and crawler worker
  service wiring for future IaC.
- `@searchlint/api` now exports a Cognito user-pool provisioning contract that
  ties the approved managed auth model to API bearer-token verification through
  issuer, audience, JWKS URL, token-use environment wiring, RS256 access tokens,
  verified email sign-in, password/MFA policy, and an explicit rule that Cognito
  groups are not the tenant RBAC source of truth.
- `@searchlint/api` now exports a Stripe Billing contract that ties approved
  plan tiers to SearchLint-owned entitlement limits, required secret environment
  variables, subscription lifecycle webhook events, Stripe status to entitlement
  status mappings, idempotency by Stripe event id, and an explicit rule that
  Stripe webhooks do not grant tenant authorization directly.
- `@searchlint/api` now includes a Stripe webhook boundary that verifies raw
  payload signatures with `Stripe-Signature`, enforces replay tolerance, accepts
  only approved webhook events, maps subscription statuses through the billing
  contract, and normalizes subscription/payment events into deterministic
  intents without Stripe SDK or database side effects.
- The Node HTTP API runtime now has a distributed rate-limit store boundary and
  can enforce injected distributed decisions before body parsing or application
  dispatch.
- `@searchlint/api` now includes a PostgreSQL-backed distributed rate-limit
  store with a `rate_limit_windows` table contract and atomic fixed-window
  `INSERT ... ON CONFLICT` consumption query.
- `@searchlint/api` now exports a typed API rate-limit provisioning contract for
  the PostgreSQL/RDS-backed store and the API deployment contract requires
  rate-limit mode, window, and max-request environment variables.
- `@searchlint/api` now includes a side-effect-light API process factory that
  parses PostgreSQL/rate-limit env, assembles the cloud API, PostgreSQL stores,
  transaction manager, outbox, production request logging, Node HTTP runtime,
  and PostgreSQL-backed distributed rate-limit store without starting a listener
  or installing signal handlers by default.
- `@searchlint/api` now declares a `searchlint-api` executable bin and Node
  runner that parses `SEARCHLINT_API_PORT`/`SEARCHLINT_API_HOST`, creates the
  API process, installs lifecycle handling, starts the HTTP listener, waits for
  server close, and maps startup/listen/runtime failures to deterministic
  process exit codes.
- `@searchlint/api` now includes PostgreSQL-backed organization entitlement and
  usage-counter storage plus a crawl entitlement store that enforces per-run and
  monthly crawled-URL limits from SearchLint-owned data.
- `@searchlint/api` now records idempotent billable `crawl.urls` usage events
  after successful crawl request creation and increments PostgreSQL
  `usage_counters` only when the crawl request idempotency key is new.
- `@searchlint/api` now enforces SearchLint-owned external API inspection quota
  checks against `external_api_monthly_limit` and records idempotent
  `external_api.inspections` usage through caller-provided idempotency keys.
- `@searchlint/api` now declares `report_artifacts` metadata storage with report
  artifact retention class, pinned-artifact exclusion, expiry selection,
  active-to-deleting and deleting-to-deleted transitions, and a PostgreSQL
  report retention store that clears the artifact URI after deletion state is
  recorded.
- `@searchlint/workers` now has a report artifact deletion boundary that leases
  expired report artifacts, deletes S3 payloads through an injected object
  store, marks metadata deleted after payload deletion, and returns rows to
  active state when object deletion fails so retries remain possible.
- `@searchlint/workers` now exports a report artifact cleanup polling runtime
  with start/stop/done/isRunning lifecycle semantics, injected sleep,
  onBatch/onError callbacks, stop-on-error mode, abortable sleeps, a
  side-effect-light cleanup process factory, a
  `searchlint-report-artifact-cleanup-worker` executable Node entrypoint,
  structured cleanup batch logs, and a typed EventBridge Scheduler to
  ECS/Fargate cleanup task contract.
- The repository now includes `infra/aws/cognito-user-pool.cloudformation.json`,
  `infra/aws/secret-vault-kms.cloudformation.json`,
  `infra/aws/rds-postgres.cloudformation.json`,
  `infra/aws/artifact-storage-s3.cloudformation.json`,
  `infra/aws/observability-cloudwatch.cloudformation.json`,
  `infra/aws/cloud-api-ecs-fargate.cloudformation.json`,
  `infra/aws/crawler-worker-ecs-fargate.cloudformation.json`,
  `infra/aws/report-artifact-cleanup-schedule.cloudformation.json`,
  `docs/AWS_DEPLOYMENT_CONTRACTS.md`, and `scripts/verify-aws-iac.mjs`;
  `pnpm lint` validates the Cloud API HTTP API, VPC Link, internal ALB, ECS
  service/task definition, API env/secrets boundaries, Cognito user pool, API
  app client, coarse platform-access group, password/MFA/email verification
  policy, Cognito runtime outputs, KMS service-secret key, key rotation, KMS
  alias, Stripe webhook secret slot, OTLP headers secret slot, KMS-encrypted
  managed secrets, RDS PostgreSQL instance, subnet group, security group,
  generated password secret, database URL secret, private networking,
  encryption, deletion-protection default, S3 crawl/report artifact buckets,
  artifact access-log bucket, public-access block, bucket-owner-enforced
  ownership, encryption, versioning, TLS-only bucket policies, S3 server access
  logging configuration, crawl artifact lifecycle expiration including
  noncurrent versions, CloudWatch log groups, KMS log encryption, default log
  retention, observability metric filters and alarms, optional OTLP headers
  secret injection for API/worker tasks, crawler worker SQS queue, DLQ,
  ECS/Fargate service/task definition, CloudWatch log group, IAM roles, Secrets
  Manager boundary, S3 write permission, KMS data-key permission for encrypted
  artifact writes, disabled public IP assignment, and crawler executable
  command, plus the report artifact cleanup EventBridge Scheduler, ECS/Fargate
  task definition, DLQ, CloudWatch log group, IAM roles, Secrets Manager
  boundary, S3 delete permission, disabled public IP assignment, and cleanup
  executable command without requiring AWS credentials.
- The repository now includes `Dockerfile.api`, `Dockerfile.worker`,
  `.dockerignore`, `docs/CONTAINER_IMAGE_CONTRACTS.md`, and
  `scripts/verify-dockerfiles.mjs`; `pnpm lint` validates the approved
  `node:24-bookworm-slim` build/runtime stages, non-root runtime user, deployed
  `/app` runtime copy, service commands, API port defaults, and required
  dockerignore exclusions without needing a Docker daemon.
- The GitHub Actions workflow now includes a `docker-image-build` job that
  installs with the approved Node 24/pnpm 11.8.0 toolchain, verifies the
  Dockerfile contract, and builds `searchlint-api:ci` plus
  `searchlint-crawler-worker:ci` without registry login or image push.
- `scripts/verify-ci-workflow.mjs` is wired into `pnpm lint` and validates the
  Docker image build and vulnerability scan CI contract without needing a Docker
  daemon.
- The `docker-image-build` job scans both locally built `:ci` images with Trivy
  and fails on `CRITICAL` OS/library vulnerabilities.
- The same job generates and uploads CycloneDX SBOM artifacts for
  `searchlint-api:ci` and `searchlint-crawler-worker:ci`.
- The same job signs GitHub build-provenance attestations for the uploaded SBOM
  artifacts.
- State-changing operations emit audit events.
- Crawl queueing emits a metrics event.

Still not implemented:

- real AWS deployment of the Cloud API Gateway/ECS CloudFormation stack and live
  API base-URL smoke proof;
- real AWS deployment of the Cognito user-pool CloudFormation stack;
- real AWS deployment of the KMS/Secrets Manager vault CloudFormation stack;
- real AWS deployment of the RDS PostgreSQL CloudFormation stack;
- real AWS deployment of the S3 artifact storage CloudFormation stack;
- real AWS deployment of the crawler worker SQS/ECS CloudFormation stack;
- real AWS deployment of the report artifact cleanup CloudFormation stack;
- registry publication, release digest pinning, and container image signing/
  provenance;
- real AWS deployment of the CloudWatch/OTLP observability CloudFormation stack
  and live log/metric/alarm/OTLP export proof;
- database/provider-level request cancellation;
- real PostgreSQL integration evidence in this checkout run, because local
  Docker daemon is unavailable and no test database URL is configured;
- live RDS migration execution evidence in this checkout run, because the same
  real database prerequisite is unavailable locally;
- real backend API load testing, DAST, penetration testing, and deployed API
  Gateway/ECS/CloudWatch runtime evidence;
- live PostgreSQL-backed authorization-matrix evidence in this checkout run,
  because the same real database prerequisite is unavailable locally;
- deployed RDS migration and connectivity proof;
- real backup restore drill and point-in-time recovery drill;
- real database load test, deployed database metrics dashboard, production
  slow-query review, and database alerts;
- real S3 upload/download/delete proof, live signed URL runtime proof, live
  object restore proof, live large artifact transfer proof, and live access-log
  review after deployed operations;
- actual SQS queue, dead-letter queue, IAM resource creation, deployed
  distributed concurrency, and runtime dequeue/write proof;
- live EventBridge scheduled invocation proof, live worker autoscaling behavior,
  live worker metric export, deployed worker alert routing, and DLQ replay
  evidence;
- deployed migration workflow;
- deployed Cognito auth proof against the Cloud API runtime;
- live signup, login, logout, refresh-token, password-reset, email-verification,
  MFA, session-expiry, invite email delivery, and dashboard team-management UI
  proof;
- real KMS/Secrets Manager OAuth token vault deployment, live token
  write/read/delete proof, and live provider credential proof;
- live Google/Yandex token refresh/revocation proof and deployed log/telemetry
  secret-redaction review;
- real deployed Stripe webhook persistence on RDS, Google/Yandex OAuth/scheduler
  wiring, live provider credential proof, richer external observation
  detail/report rendering, report artifact cleanup deployed AWS runtime proof,
  billing UI, and quota dashboard;
- deployed AWS RDS/KMS/Secrets Manager runtime proof, real secret population
  proof, and deployed SQS/S3 runtime proof;
- crawler worker crawl-scale acceptance;
- deployed interactive dashboard app, production dashboard URL browser
  acceptance, live auth/API dashboard E2E, external WCAG audit, and production
  visual regression service.
- real Google OAuth app setup, Google app verification, live Search Console
  property connection, live URL Inspection, live Search Analytics, live sitemap
  status, live Google quota/retry/backoff/stale-state proof, and live dashboard
  connector proof.
- live PageSpeed Insights acceptance, live CrUX acceptance, historical
  performance metric rollups, production performance dashboard visualization,
  and live performance API quota/retry/backoff/stale-state proof.
- real Yandex OAuth application setup, live Webmaster site connection, live
  Metrica counter connection, exact live Yandex endpoint conformance, live
  Webmaster/Metrica API data, live quota/retry/backoff/stale-state proof, and
  live dashboard connector proof.
- production deployment history persistence, page snapshot history persistence,
  diagnostic/external-observation history rollups, deployed dashboard timeline
  acceptance, production anomaly alerting, and analyst review workflow.
- live email, Slack, webhook, and optional Telegram notification delivery,
  deployed notification workers/scheduler, production notification settings
  persistence, full dashboard notification editing, and deployed log/telemetry
  redaction review.
- real Stripe products/prices, live checkout payment, live customer portal, live
  subscription/trial/upgrade/downgrade/cancellation/invoice flows, deployed
  Stripe webhook persistence against production RDS, deployed billing UI E2E,
  and final pricing/legal terms.
- deployed client portal, production identity-provider client sessions, live
  agency billing, live hosted report API/S3 acceptance, live brand asset
  upload/DNS/CloudFront/TLS proof, and client invite email delivery.
- live logging/metrics/tracing deployment, deployed CloudWatch dashboards, live
  OTLP export, production incident delivery, external error tracking, and
  deployed telemetry redaction review.
- DAST against a deployed target, independent penetration test, legal/security
  approval, live production security review, and live privacy export/deletion
  execution.
- deployed public website domain/CDN, final marketing/pricing/legal copy
  approval, live onboarding/signup flow, analytics/privacy review, and deployed
  public link/screenshot verification.
- final SearchLint 1.0 RC pass, which requires reviewer, legal, publication,
  deployed cloud, live integration, security audit, public website, and tag
  evidence.

## Readiness Estimate

Method: weighted acceptance estimate against the 1.0 product scope, not a line
count. "Complete" requires implementation, tests, installability or runtime
availability where relevant, and real pipeline validation.

| Area                | Estimate | Reason                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------- | -------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Core                |      78% | 120/120 rule bindings, production catalog E2E, and passing tests; per-rule acceptance depth and public contract/versioning still need release proof                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Developer product   |      71% | CLI/crawler/reporters/DSL/LSP foundations, public CLI subcommands including migrate-config, generated 120-rule docs, deterministic HTML reports, structural Next config awareness, JSON-RPC language server, VS Code extension package, package tarball contract, DSL v1 public config contract, dev badge/overlay accessibility contract, and real Next zero-impact fixtures pass; marketplace packaging and broader editor/report acceptance remain incomplete                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Cloud               |      75% | Cloud decisions are approved and the API foundation includes RBAC, ports, route contracts, persistence schema contracts, PostgreSQL DDL generation, repository SQL contracts, a query-executor-backed relational store adapter, DB-side transaction boundary, `pg` query executor, transaction SQL manager, deterministic migration runner, PostgreSQL env wiring, an opt-in real database integration harness, explicit PostgreSQL verification command, CI service-container migration proof job, durable outbox contracts, an HTTP dispatcher, a hardened Node.js HTTP runtime with graceful shutdown, signal binding, ECS-compatible task lifecycle state wiring, explicit process exit-code policy, production JSON log sink boundary, distributed rate-limit store boundary, a PostgreSQL-backed distributed rate-limit store, a typed API rate-limit provisioning contract and deployment env requirements, a side-effect-light API process factory with PostgreSQL/rate-limit env wiring, an executable API listener entrypoint for container/process-manager invocation, PostgreSQL-backed organization entitlement and usage-counter storage with crawl limit enforcement, idempotent billable crawl usage event recording with aggregate counter increments, a Stripe Billing contract for plan tiers, webhook events, status mappings, and SearchLint-owned entitlement updates, a Stripe webhook signature verification and event normalization boundary, a signed raw-body Stripe webhook Node HTTP ingress route, PostgreSQL schema/SQL contracts for Stripe billing identity mappings and processed webhook events, and a PostgreSQL-backed Stripe webhook persistence adapter, SearchLint-owned external API inspection quota enforcement with idempotent usage metering, PostgreSQL report artifact retention metadata enforcement, persisted diagnostic storage, API-owned crawl diagnostic ingestion with audit/metrics, provider-aware PostgreSQL Google/Yandex external observation storage, S3-backed physical report artifact deletion boundary, report artifact cleanup polling runtime, report artifact cleanup process/env wiring, typed EventBridge-to-ECS schedule contract, checked CloudFormation template for report artifact cleanup scheduling, AWS IaC verifier wired into lint, an approved Node.js 24 Debian Bookworm slim Docker runtime image decision, product Dockerfiles with a static Dockerfile contract verifier, a Docker image CI gate that builds, vulnerability-scans, generates SBOM artifacts, and signs SBOM provenance attestations for API and crawler worker images, a CloudWatch Logs provisioning contract, ECS awslogs log-driver contract, observability exporter contract, CloudWatch EMF runtime mapper, OTLP runtime config parser, API process-level OTLP config validation, crawler worker process-level OTLP config validation, an OTLP exporter lifecycle boundary, a real OpenTelemetry OTLP SDK adapter for API/worker observability, API/worker process lifecycle wiring for OTLP startup and shutdown, a CloudWatch/OTLP IaC provisioning target contract for API/worker task environment and EMF wiring, a Cognito user-pool provisioning target contract, a typed API Gateway/ECS/Fargate deployment contract with validator, checked CloudFormation template for API Gateway HTTP API to ECS/Fargate service, Cognito/OIDC JWT verifier, remote JWKS provider, Node principal extractor, route-level auth acceptance tests, table-driven current-operation authorization matrix tests, and an opt-in PostgreSQL-backed authorization matrix acceptance test, audit, metrics, and tests; the worker package now has an outbox dispatcher boundary, an SQS publisher adapter for deterministic `crawl.requested` messages, a long-running outbox polling runtime, a PostgreSQL outbox dispatch store adapter, process lifecycle helpers for shutdown signals, ECS-compatible states, exit-code policy, a typed ECS/Fargate/SQS/RDS worker deployment contract with validator, a production JSON log sink boundary, a typed SQS/DLQ/IAM provisioning contract with validator, a cloud crawler execution boundary that runs the shared crawler through injected ports, PostgreSQL adapters for crawl target resolution and crawl lifecycle status updates, an additive crawl execution metadata schema migration for timestamps, failure text, and artifact references, an S3 crawl artifact store adapter wired through an injected artifact-store port, a concrete SQS crawler batch consumer with delete-on-success and retry-on-failure behavior, a long-running SQS crawler polling runtime with start/stop/error hooks, a side-effect-light crawler worker process factory that validates env and assembles PostgreSQL/SQS/S3/fetch/log/lifecycle wiring, shared-core crawler diagnostic analysis, PostgreSQL diagnostic ingestion from the worker executable before crawl success, Docker runtime rule-catalog packaging, ECS task rule-catalog env wiring, and a `searchlint-crawler-worker` executable Node entrypoint for process-manager/container invocation, plus a report artifact cleanup process factory, `searchlint-report-artifact-cleanup-worker` executable, cleanup batch logs, and typed EventBridge Scheduler to ECS/Fargate cleanup task contract; successful local real PostgreSQL run in this checkout, successful local PostgreSQL-backed authorization matrix evidence, deployed RDS migration and connectivity proof, deployed infrastructure proof beyond the checked API, Cognito, KMS/Secrets Manager, RDS, S3, CloudWatch observability, crawler worker, and cleanup templates, registry publication, release digest pinning, container image signing/provenance, deployed Cloud API Gateway/ECS runtime proof, deployed CloudWatch/OTLP observability runtime proof, database/provider-level cancellation, actual AWS Cognito user-pool resource creation/deployment, real deployed Stripe webhook persistence on RDS, real deployed Google/Yandex provider adapters, OAuth/scheduler wiring, richer external observation detail rendering, report artifact cleanup deployed AWS runtime proof, actual queue resource creation/deployment wiring and deployed S3 runtime proof, deployed crawler worker runtime proof, dashboard, and external integrations are still missing |
| Full SearchLint 1.0 |      26% | Core-heavy foundation exists, and dashboard now has contract/render plus API request/client/fetch transport/session-token/hosted-UI/token-exchange/PKCE-pending-auth/browser-storage/session-storage foundations, but major deployed cloud runtime proof, external integrations, binary/hosted reports, interactive dashboard app, and final release requirements are missing                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

## Active ExecPlan

Last completed ExecPlan: `plans/263_SEARCHLINT_1_0_RELEASE_CANDIDATE_MATRIX.md`.

Completed 263 scope:

- added `pnpm rc:matrix`;
- added `docs/SEARCHLINT_1_0_RELEASE_CANDIDATE_MATRIX.md`;
- added `scripts/verify-release-candidate-matrix.mjs`;
- generated deterministic sanitized evidence at
  `docs/examples/searchlint-1-0-rc-matrix-report.sample.json`;
- verified 30 RC gates across governance, rule QA, local product, IDE, npm,
  cloud, storage, API, workers, auth, OAuth, dashboard, integrations, reports,
  history, notifications, billing, agency, observability, security, website,
  legal, repository boundary, and final publication;
- `pnpm rc:matrix` passed under Node 24 as a matrix integrity verifier;
- RC report status remains `blocked` with release blockers for reviewer files,
  legal/repository boundary, npm/VS Code publication, live cloud/provider/
  billing/security/website evidence, and final tag/public release.

Completed 262 scope:

- added `pnpm website:acceptance`;
- added `docs/PUBLIC_WEBSITE_ONBOARDING.md`;
- added `docs/ONBOARDING_GUIDE.md`;
- added `docs/FAQ.md`;
- added `docs/TROUBLESHOOTING.md`;
- added `docs/API_DOCUMENTATION.md`;
- added deterministic demo project files under `docs/examples/demo-project/`;
- added `scripts/verify-public-website-onboarding.mjs`;
- generated deterministic sanitized evidence at
  `docs/examples/public-website-onboarding-report.sample.json`;
- verified public website/onboarding source coverage for product, local tools,
  cloud platform, pricing, installation, quick start, Next.js, CLI, VS Code,
  Google/Yandex, rule catalog, DSL, API documentation, examples, FAQ,
  troubleshooting, onboarding wizard, demo project, and contact/support flow;
- `pnpm website:acceptance` passed under Node 24 with 19/19 coverage items;
- deployed public website, final marketing/pricing/legal approval, live
  onboarding/signup, analytics/privacy review, and deployed public link/
  screenshot verification remain open release gates.

Completed 388 scope:

- added `pnpm onboarding:final`;
- added `docs/ONBOARDING_FINAL_READINESS.md`;
- generated deterministic sanitized evidence at
  `docs/examples/onboarding-source-final-report.sample.json`;
- verified source-level onboarding guide sections, installation and quick-start
  paths, Next.js/CLI/VS Code/provider guidance, onboarding wizard inputs and
  outputs, demo project starter configuration, and release-honesty markers;
- `pnpm onboarding:final` passed under Node 24 with 8 required guide sections
  and 7 wizard inputs verified;
- deployed public website/domain/CDN, live signup/auth onboarding, live cloud
  project creation, final marketing/pricing/legal approval, analytics/privacy
  review, and deployed public link/screenshot verification remain open release
  gates.

Completed 261 scope:

- added `pnpm security:acceptance`;
- added `services/api/src/security-privacy-release.ts`;
- added focused security/privacy release tests;
- added `scripts/verify-security-privacy-acceptance.mjs`;
- added `docs/SECURITY_PRIVACY_RELEASE_GATE.md`;
- added draft `docs/PRIVACY_POLICY.md`, `docs/TERMS_OF_SERVICE.md`,
  `docs/DPA.md`, and `docs/VULNERABILITY_DISCLOSURE.md`;
- generated deterministic sanitized evidence at
  `docs/examples/security-privacy-acceptance-report.sample.json`;
- verified deterministic threat-model mapping, SSRF/private-network evidence,
  XSS escaping/security-header evidence, CSRF/request-boundary posture,
  injection safeguards, OAuth attack controls, tenant isolation, secrets
  handling, encryption-at-rest/in-transit contracts, backup/restore/retention
  evidence, privacy request plans, and vulnerability disclosure posture;
- `pnpm security:acceptance` passed under Node 24 with 4/4 evidence groups;
- `pnpm security:dependency-audit` passed with 0 reported pnpm audit
  vulnerabilities;
- `pnpm security:sast` passed with repository-owned static analysis evidence and
  0 unreviewed findings;
- `pnpm security:privacy-requests` passed with deterministic user data export,
  account deletion, and organization deletion execution contracts;
- `pnpm security:dast` now exists and writes sanitized blocked evidence until
  deployed production-equivalent dashboard/API targets are provided through
  `SEARCHLINT_DAST_LIVE=1`, `SEARCHLINT_DAST_DASHBOARD_URL`, and
  `SEARCHLINT_DAST_API_URL`;
- `pnpm security:pentest` now exists and writes sanitized blocked evidence until
  a passed DAST report, independent penetration-test report summary, remediation
  evidence, and owner approval are provided;
- DAST pass, independent penetration-test pass, legal/security approval,
  deployed production security review, and live privacy export/deletion
  execution remain open release gates.

Completed 260 scope:

- added `pnpm observability:acceptance`;
- added `services/api/src/observability-release.ts`;
- added focused observability release tests;
- added `scripts/verify-observability-acceptance.mjs`;
- added `docs/OBSERVABILITY_INCIDENTS_TELEMETRY.md`;
- generated deterministic sanitized evidence at
  `docs/examples/observability-acceptance-report.sample.json`;
- verified deterministic API, worker, crawler, database, integration, quota,
  business, and incident metric categories;
- verified dashboard widget modeling, alert threshold evaluation, incident
  notification routing, and structured log/metric/trace/incident payload
  redaction;
- `pnpm observability:acceptance` passed under Node 24 with 3/3 evidence groups;
- live logging/metrics/tracing deployment, deployed CloudWatch dashboard
  inspection, live OTLP export, production incident delivery, external error
  tracking, and deployed telemetry redaction review remain open release gates.

Completed 259 scope:

- added `pnpm agency:acceptance`;
- added `services/api/src/agency-mode.ts`;
- added focused agency-mode tests;
- extended dashboard billing rendering with agency client portfolio evidence;
- added `scripts/verify-agency-acceptance.mjs`;
- added `docs/AGENCY_MODE_ACCEPTANCE.md`;
- generated deterministic sanitized evidence at
  `docs/examples/agency-acceptance-report.sample.json`;
- verified deterministic client workspaces, multi-client portfolio, agency/
  client RBAC, client read-only access, white-label brand options, shared rule
  policy, bulk monitoring, SLA tracking, assignees, onboarding, agency billing,
  dashboard portfolio rendering, and local white-label report rendering;
- `pnpm agency:acceptance` passed under Node 24 with 3/3 evidence groups;
- production workspace persistence is covered separately by ExecPlan 403;
  deployed client portal, client-access browser E2E, live agency billing, hosted
  white-label report links, brand upload/custom domains, and client invite
  delivery remain open release gates.

Completed 346 scope:

- added `plans/346_AGENCY_PRODUCTION_PERSISTENCE_ACCEPTANCE_PACKET.md`;
- added `pnpm agency:persistence-acceptance-packet`;
- added `agencyProductionPersistenceAcceptancePacket()` with required deployed
  inputs, sanitized evidence requirements, pass criteria, and forbidden evidence
  classes;
- added focused agency-mode tests proving the packet blocks fake completion;
- added `scripts/verify-agency-persistence-acceptance-packet.mjs`;
- added `docs/AGENCY_PRODUCTION_PERSISTENCE_ACCEPTANCE_PACKET.md`;
- generated deterministic sanitized evidence at
  `docs/examples/agency-persistence-acceptance-packet-report.sample.json`;
- deployed agency workspace persistence, live RDS connectivity, deployed
  dashboard/API reads, tenant-isolation proof, client portal deployment, and
  owner approval remain open release gates.

Completed 403 scope:

- added `pnpm agency:client-workspace-persistence`;
- added cloud persistence schema contracts for `agency_client_workspaces`,
  `agency_shared_rule_policies`, `agency_client_projects`, and
  `agency_white_label_brands`;
- added deterministic PostgreSQL upsert/list SQL helpers for client workspaces,
  projects, shared policies, and white-label brands;
- added a typed PostgreSQL agency client workspace store that maps persisted
  rows back into the existing agency domain records;
- added focused schema, DDL, and store tests;
- added `scripts/verify-agency-client-workspace-persistence.mjs`;
- generated deterministic sanitized evidence at
  `docs/examples/agency-client-workspace-persistence-report.sample.json`;
- `pnpm agency:client-workspace-persistence` passed under Node 24;
- deployed owner evidence, client portal deployment, live agency billing, hosted
  white-label report links, brand asset upload/custom domains, and client invite
  email delivery remain open release gates.

Completed 404 scope:

- added `pnpm agency:client-access-browser-e2e`;
- added optional dashboard `viewerRole` handling so client snapshots do not
  render team-management mutation controls or owner/admin permission rows;
- added a Chromium verifier that serves the hosted dashboard shell locally,
  seeds a `client` session, and checks billing, reports, diagnostics, and team
  routes with positive and negative assertions;
- generated deterministic sanitized evidence at
  `docs/examples/agency-client-access-browser-e2e-report.sample.json`;
- `pnpm agency:client-access-browser-e2e` passed under Node 24 with 23 browser
  assertions;
- deployed client portal URL, production identity-provider session evidence,
  live agency billing, live hosted report API/S3 acceptance, custom domains/
  brand asset upload, and invite email delivery remain open release gates.

Completed 405 scope:

- added `pnpm agency:hosted-white-label-links`;
- added `createAgencyHostedWhiteLabelReportLinkGrant()` to bind active client
  workspace, matching client project, matching white-label brand, `agency`
  report artifact, artifact URI, and `report:read` authorization before signed
  URL creation;
- added deterministic denial reasons for archived workspace, brand mismatch,
  non-agency report, missing artifact URI, and missing membership;
- added verifier coverage that composes the API grant with the existing worker
  signed URL service and redacts URL query secrets;
- generated deterministic sanitized evidence at
  `docs/examples/agency-hosted-white-label-report-links-report.sample.json`;
- `pnpm agency:hosted-white-label-links` passed under Node 24 with 5 denial
  cases;
- deployed hosted report API route, live S3 signed URL acceptance, production
  identity-provider browser flow, custom domain routing, and brand asset upload
  remain open release gates.

Completed 406 scope:

- added `pnpm agency:brand-domain-contract`;
- added `createAgencyBrandAssetUploadGrant()` for active workspace, supported
  image type, bounded byte length, valid SHA-256, safe filename extension, and
  deterministic S3 object URI/key metadata without raw asset bytes;
- added `verifyAgencyCustomDomain()` for active workspace, normalized hostname,
  bounded verification token, and matching DNS TXT value;
- added focused allow/deny API tests for brand assets and custom domains;
- generated deterministic sanitized evidence at
  `docs/examples/agency-brand-domain-contract-report.sample.json`;
- `pnpm agency:brand-domain-contract` passed under Node 24 with 5 asset-denial
  cases and 4 domain-denial cases;
- live S3 object upload, live DNS lookup, CloudFront custom-domain routing, and
  ACM/TLS certificate proof remain open deployment gates if custom domains are
  enabled.

Completed 407 scope:

- extended `pnpm verify:postgres` to fall back from Docker to temporary local
  PostgreSQL binaries when `SEARCHLINT_POSTGRES_TEST_DATABASE_URL` is not set;
- fixed PostgreSQL adapter timestamp normalization for real `pg` `Date` values
  in relational-store and outbox-store rows;
- added focused unit coverage for `Date` timestamp normalization;
- generated deterministic sanitized evidence at
  `docs/examples/backend-api-postgresql-integration-report.sample.json`;
- `pnpm verify:postgres` passed under Node 24 against a real temporary local
  PostgreSQL database, covering migration apply/replay and PostgreSQL-backed
  authorization matrix behavior;
- deployed production API, deployed RDS, production migration execution, and
  live RDS connectivity remain separate release gates.

Completed 408 scope:

- added `pnpm db:migrations-real`;
- added a dedicated real-PostgreSQL migration execution verifier that builds
  `@searchlint/api`, starts a temporary PostgreSQL database, applies the current
  migration chain, reruns the chain for idempotent skip behavior, checks the
  migration ledger IDs/checksums, and verifies representative migrated columns;
- generated deterministic sanitized evidence at
  `docs/examples/db-migrations-real-postgres-report.sample.json`;
- `pnpm db:migrations-real` passed under Node 24 with 2 migrations applied on
  first run and 2 migrations skipped on replay;
- deployed RDS, production migration workflow, production connectivity, and
  backup/restore proof remain separate release gates.

Completed 409 scope:

- added `createS3PageSnapshotArtifactStore()` to provide a concrete
  tenant-scoped S3 PutObject boundary for page snapshot artifacts;
- added focused snapshot upload tests for deterministic JSON body, content
  length, SHA-256 metadata, artifact type metadata, tenant key encoding, empty
  bucket rejection, and S3 put failure propagation;
- added `pnpm object-storage:upload-contract`, which runs focused crawl and
  snapshot upload tests, builds `@searchlint/workers`, verifies built snapshot
  and crawl PutObject command shapes through injected clients, and writes
  deterministic sanitized evidence;
- generated deterministic sanitized evidence at
  `docs/examples/object-storage-upload-contract-report.sample.json`;
- `pnpm object-storage:upload-contract` passed under Node 24;
- real S3 deployment, live upload/download/delete, deployed IAM denial,
  access-log review, and final S3 proof remain separate release gates.

Completed 410 scope:

- added `pnpm release:owner-gates`;
- added `scripts/verify-release-owner-gate-actions.mjs`;
- added `docs/RELEASE_OWNER_GATE_ACTIONS.md`;
- generated deterministic sanitized evidence at
  `docs/examples/release-owner-gate-actions-report.sample.json`;
- the verifier parses `docs/SEARCHLINT_1_0_MASTER_CHECKLIST.md` and reports the
  current count as 515 checked, 84 open, 599 total;
- every open checklist item is represented once in the owner-gate report with a
  gate type, required evidence, next owner action, and related command where one
  exists;
- this plan intentionally does not mark any open master-checklist item complete:
  reviewer sign-off, legal approval, hosted GitHub governance, deployment,
  publication, live provider acceptance, accessibility review, DAST, pentest,
  and final release actions remain separate gates.

Completed 411 scope:

- added `pnpm repo:public-split-candidate`;
- added `scripts/verify-public-repository-split-candidate.mjs`;
- generated deterministic sanitized evidence at
  `docs/examples/public-repository-split-candidate-report.sample.json`;
- the verifier mechanically assembles the public repository candidate tree from
  `specs/PUBLIC_REPOSITORY_EXPORT_MANIFEST.json` in a temporary directory;
- the candidate tree contains 250 files and 16 public package manifests copied
  from 39 allowed include paths;
- the candidate tree hash is
  `e2819f86f7678e26f3212ada4e5847f46be0fb43d05717fada50d53c77a4d158`;
- private cloud paths (`apps/dashboard`, `services/api`, `services/workers`,
  `infra`, cloud Dockerfiles), generated paths, and sensitive path patterns are
  absent from the assembled candidate;
- this closes the repository-split preparation checklist item but does not claim
  legal approval, hosted public repository creation, public candidate
  install/build/test, npm publication, or VS Code Marketplace publication.

Completed 412 scope:

- added `pnpm repo:public-candidate-validation`;
- added `scripts/verify-public-repository-candidate-validation.mjs`;
- added `scripts/build-package.mjs` to the public export manifest because public
  package build scripts depend on it;
- generated deterministic sanitized evidence at
  `docs/examples/public-repository-candidate-validation-report.sample.json`;
- the verifier assembles a temporary public repository candidate and runs:
  `pnpm install --frozen-lockfile`, `pnpm -r --if-present build`,
  `pnpm -r --if-present typecheck`, `pnpm -r --if-present test`, and
  `pnpm verify:release`;
- all five commands passed inside the temporary public candidate workspace;
- hosted public repository creation/protection, hosted public CI, legal review,
  npm publication, and VS Code Marketplace publication remain separate release
  gates.

Completed 347 scope:

- added `plans/347_PACKAGE_MANIFEST_TECHNICAL_READINESS.md`;
- strengthened `pnpm package:dry-run` so every public npm package candidate now
  records `technicalReadiness` evidence for `files`, runtime exports/bin
  targets, exported declaration targets, peer/runtime dependency graph
  boundaries, and dry-run pack output;
- public package dependency graph checks reject crossings into private cloud
  packages and unknown `@searchlint/*` packages;
- regenerated `docs/examples/package-publication-dry-run-report.sample.json`
  with the new machine-readable evidence;
- repository, homepage, bugs, trusted publishing, beta publication, registry
  install, final `1.0.0`, and legal review remain open release gates.

Completed 348 scope:

- added `plans/348_VSCODE_EXTENSION_RELEASE_ASSETS.md`;
- added deterministic VS Code extension assets under `apps/vscode/assets/`:
  `icon.svg`, `screenshots/diagnostics.svg`, and `screenshots/quick-fix.svg`;
- declared `icon` and packaged `assets` in `apps/vscode/package.json`;
- updated the VS Code README to reference both screenshot assets;
- extended `pnpm lsp-vscode:acceptance` so release assets, README references,
  package file allowlist, and local LSP/metadata behavior are verified together;
- regenerated deterministic sanitized evidence at
  `docs/examples/lsp-vscode-acceptance-report.sample.json`;
- clean VS Code install, Extension Host E2E, publisher account setup, signing,
  Marketplace publication, and Marketplace auto-update after publication remain
  open release gates.

Completed 349 scope:

- added `plans/349_VSCODE_PRODUCTION_VSIX_BUILD_READINESS.md`;
- added `pnpm vscode:vsix-readiness`;
- added `scripts/verify-vscode-vsix-readiness.mjs`;
- the verifier runs `pnpm lsp-vscode:acceptance`, assembles a generated local
  VSIX artifact at `reports/searchlint-vscode-1.0.0-beta.0.vsix`, and verifies
  `[Content_Types].xml`, `extension.vsixmanifest`, extension manifest, runtime
  entrypoint, assets, README/changelog/privacy files, language configuration,
  and runtime dependency entries;
- generated deterministic sanitized evidence at
  `docs/examples/vscode-vsix-readiness-report.sample.json`;
- clean VS Code install, Extension Host E2E, publisher account setup, signing,
  Marketplace publication, and Marketplace auto-update after publication remain
  open release gates.

Completed 350 scope:

- added `plans/350_VSCODE_CLEAN_INSTALL_AND_EXTENSION_HOST_E2E_PACKET.md`;
- added `pnpm vscode:clean-install-e2e`;
- added `scripts/verify-vscode-clean-install-e2e.mjs`;
- the verifier runs `pnpm vscode:vsix-readiness`, probes
  `SEARCHLINT_VSCODE_CLI`, `code`, `code-insiders`, and common macOS VS Code CLI
  paths, and writes deterministic evidence;
- in this checkout the verifier fails as expected with
  `blocked_until_vscode_cli` because no VS Code CLI is available;
- generated deterministic sanitized evidence at
  `docs/examples/vscode-clean-install-e2e-report.sample.json`;
- clean VS Code install, Extension Host E2E, publisher account setup, signing,
  Marketplace publication, and Marketplace auto-update after publication remain
  open release gates.

Completed 351 scope:

- added `plans/351_LSP_MULTIFILE_INVALIDATION_AND_STALE_DIAGNOSTICS.md`;
- added `pnpm lsp:workspace-acceptance`;
- added `scripts/verify-lsp-workspace-acceptance.mjs`;
- extended language-server tests for multiple open documents, isolated
  invalidation, valid-change stale diagnostic cleanup, and close cleanup;
- generated deterministic sanitized evidence at
  `docs/examples/lsp-workspace-acceptance-report.sample.json`;
- verified 260 open documents, 26 initially invalid documents, 10 targeted
  mutations, 25 closes, and 0 closed documents left tracked;
- clean VS Code install, Extension Host E2E, publisher account setup, signing,
  Marketplace publication, Marketplace auto-update after publication, and
  cross-file project-wide references/rename remain open release gates.

Completed 258 scope:

- added `pnpm billing:acceptance`;
- added `services/api/src/billing-product.ts`;
- added focused billing product tests;
- extended dashboard billing rendering with subscription, plan, trial, invoice,
  usage, and overage policy evidence;
- added `scripts/verify-billing-acceptance.mjs`;
- added `docs/BILLING_ACCEPTANCE.md`;
- generated deterministic sanitized evidence at
  `docs/examples/billing-acceptance-report.sample.json`;
- verified deterministic Stripe Billing contract, starter/team/agency/
  enterprise plan limits, checkout request shape, customer portal request shape,
  subscription lifecycle summary, trial state, upgrade/downgrade intent,
  cancellation intent, invoice summary, usage-limit calculations, overage
  policy, Stripe webhook parsing, and dashboard consumption;
- `pnpm billing:acceptance` passed under Node 24 with 5/5 evidence groups;
- live Stripe product/price setup, checkout, portal, subscription lifecycle,
  invoice settlement, deployed webhook persistence, production billing UI E2E,
  and final pricing/legal terms remain open release gates.

Completed 257 scope:

- added `pnpm notifications:acceptance`;
- added `services/api/src/notifications.ts`;
- added notification domain types for channels, rules, events, delivery tasks,
  delivery attempts, and delivery statuses;
- added focused notification tests;
- added dashboard settings rendering for notification channels, rules, and
  delivery history;
- added `scripts/verify-notifications-acceptance.mjs`;
- added `docs/NOTIFICATIONS_ACCEPTANCE.md`;
- generated deterministic sanitized evidence at
  `docs/examples/notifications-acceptance-report.sample.json`;
- verified deterministic email, Slack, webhook, and Telegram channel modeling,
  event/rule evaluation, severity thresholds, immediate/daily/weekly digest
  scheduling, mute/snooze suppression, retry planning, delivery history summary,
  notification metric events, target sanitization, and dashboard consumption;
- `pnpm notifications:acceptance` passed under Node 24 with 2/2 evidence groups;
- live provider delivery, deployed notification workers/schedulers, production
  persistence, full dashboard editing, and deployed redaction review remain open
  release gates.

Completed 336 scope:

- added `plans/336_NOTIFICATION_WORKERS_AND_SCHEDULER_STATIC_CONTRACT.md`;
- added `pnpm notifications:workers-static`;
- added `services/workers/src/notification-delivery-worker.ts`;
- added `services/workers/src/notification-delivery-schedule-contracts.ts`;
- added focused worker tests for delivered, retry-scheduled, failed, and invalid
  limit paths;
- added `scripts/verify-notification-workers-static.mjs`;
- added `docs/NOTIFICATION_WORKERS_STATIC_CONTRACT.md`;
- generated deterministic sanitized evidence at
  `docs/examples/notification-workers-static-report.sample.json`;
- verified due task selection through a store port, channel-specific delivery
  sink ports, delivered attempt recording, bounded retry scheduling, exhausted
  failed attempt handling, and EventBridge Scheduler to ECS Fargate task static
  configuration;
- live provider delivery, deployed ECS/EventBridge runtime, production
  notification persistence, and deployed log/telemetry redaction review remain
  open release gates.

Completed 337 scope:

- added `plans/337_NOTIFICATION_SETTINGS_PERSISTENCE_STATIC_CONTRACT.md`;
- added `pnpm notifications:persistence-static`;
- added `services/api/src/postgres-notification-settings-store.ts`;
- added focused persistence tests for exact SQL, scoped selections, secret-ref
  handling, bounded delivery history reads, and malformed-row failures;
- added `scripts/verify-notification-settings-persistence-static.mjs`;
- added `docs/NOTIFICATION_SETTINGS_PERSISTENCE_STATIC_CONTRACT.md`;
- generated deterministic sanitized evidence at
  `docs/examples/notification-settings-persistence-static-report.sample.json`;
- verified tenant-scoped schema contracts for notification channels, rules, and
  delivery attempts;
- real RDS migration application, production API/dashboard persistence wiring,
  live provider delivery, and deployed log/telemetry redaction review remain
  open release gates.

Completed 338 scope:

- added `plans/338_NOTIFICATION_DEPLOYED_REDACTION_REVIEW_PACKET.md`;
- added `pnpm notifications:redaction-review`;
- extended worker production log records with notification-delivery aggregate
  batch counters;
- added worker runtime error-message redaction before structured log body and
  attribute emission;
- added focused worker log-sink tests for notification aggregate logging and
  secret-bearing runtime errors;
- added `scripts/verify-notification-redaction-review.mjs`;
- added `docs/NOTIFICATION_REDACTION_REVIEW.md`;
- generated deterministic sanitized evidence at
  `docs/examples/notification-redaction-review-report.sample.json`;
- verified API telemetry redaction against notification-shaped payloads;
- live provider delivery and real deployed CloudWatch/OTLP log inspection remain
  open release gates.

Completed 339 scope:

- added `plans/339_BILLING_PUBLIC_PRICING_AND_STRIPE_PRODUCT_READINESS.md`;
- added `pnpm billing:pricing-static`;
- added public billing release-candidate pricing helpers for starter, team,
  agency, and enterprise;
- added Stripe product/price blueprint helpers with stable product lookup keys,
  monthly price lookup keys, USD currency, and SearchLint entitlement metadata;
- added focused billing-product tests for pricing tier order, release-candidate
  prices, enterprise contact-sales handling, and Stripe blueprint consistency;
- added `scripts/verify-billing-pricing-static.mjs`;
- added `docs/BILLING_PRICING_STATIC_PACKET.md`;
- generated deterministic sanitized evidence at
  `docs/examples/billing-pricing-static-report.sample.json`;
- owner/legal approval, real Stripe product/price creation, live checkout,
  portal, subscription, invoice, webhook, and production billing UI E2E remain
  open release gates.

Completed 340 scope:

- added `plans/340_STRIPE_PRODUCTS_PRICES_LIVE_SETUP_PACKET.md`;
- added `pnpm billing:stripe-setup-packet`;
- added `stripeProductPriceSetupPacket()` to produce product create requests,
  self-serve monthly price create requests, idempotency keys, and verification
  checks;
- added focused billing-product tests for the Stripe setup packet;
- added `scripts/verify-stripe-setup-packet.mjs`;
- added `docs/STRIPE_PRODUCTS_PRICES_SETUP_PACKET.md`;
- generated deterministic sanitized evidence at
  `docs/examples/stripe-setup-packet-report.sample.json`;
- real Stripe API mutation, product/price ID verification, live checkout,
  portal, subscription, invoice, webhook acceptance, and legal approval remain
  open release gates.

Completed 341 scope:

- added `plans/341_LIVE_STRIPE_CHECKOUT_PAYMENT_ACCEPTANCE_PACKET.md`;
- added `pnpm billing:checkout-acceptance-packet`;
- added `stripeCheckoutPaymentAcceptancePacket()` with required live setup
  inputs, sanitized evidence requirements, pass criteria, and forbidden evidence
  classes;
- added focused billing-product tests proving the packet blocks fake completion;
- added `scripts/verify-live-stripe-checkout-acceptance-packet.mjs`;
- added `docs/LIVE_STRIPE_CHECKOUT_PAYMENT_ACCEPTANCE_PACKET.md`;
- generated deterministic sanitized evidence at
  `docs/examples/live-stripe-checkout-acceptance-packet-report.sample.json`;
- live checkout session creation, completed test payment/trial checkout, live
  webhook receipt, SearchLint entitlement update, and owner approval remain open
  release gates.

Completed 342 scope:

- added `plans/342_LIVE_STRIPE_CUSTOMER_PORTAL_ACCEPTANCE_PACKET.md`;
- added `pnpm billing:customer-portal-acceptance-packet`;
- added `stripeCustomerPortalAcceptancePacket()` with required live setup
  inputs, sanitized evidence requirements, pass criteria, and forbidden evidence
  classes;
- added focused billing-product tests proving the packet blocks fake completion;
- added `scripts/verify-live-stripe-customer-portal-acceptance-packet.mjs`;
- added `docs/LIVE_STRIPE_CUSTOMER_PORTAL_ACCEPTANCE_PACKET.md`;
- generated deterministic sanitized evidence at
  `docs/examples/live-stripe-customer-portal-acceptance-packet-report.sample.json`;
- live portal session creation, portal redirect/return, plan change or
  cancellation action, live webhook receipt, SearchLint entitlement update, and
  owner approval remain open release gates.

Completed 343 scope:

- added `plans/343_LIVE_STRIPE_SUBSCRIPTION_LIFECYCLE_ACCEPTANCE_PACKET.md`;
- added `pnpm billing:subscription-lifecycle-acceptance-packet`;
- added `stripeSubscriptionLifecycleAcceptancePacket()` with required live setup
  inputs, lifecycle scenarios, sanitized evidence requirements, pass criteria,
  and forbidden evidence classes;
- added focused billing-product tests proving the packet blocks fake completion;
- added
  `scripts/verify-live-stripe-subscription-lifecycle-acceptance-packet.mjs`;
- added `docs/LIVE_STRIPE_SUBSCRIPTION_LIFECYCLE_ACCEPTANCE_PACKET.md`;
- generated deterministic sanitized evidence at
  `docs/examples/live-stripe-subscription-lifecycle-acceptance-packet-report.sample.json`;
- live trial checkout, paid checkout, upgrade, downgrade, cancellation, invoice
  settlement, live webhook receipt, SearchLint entitlement update, and owner
  approval remain open release gates.

Completed 344 scope:

- added
  `plans/344_DEPLOYED_STRIPE_WEBHOOK_PERSISTENCE_RDS_ACCEPTANCE_PACKET.md`;
- added `pnpm billing:webhook-rds-acceptance-packet`;
- added `stripeWebhookRdsPersistenceAcceptancePacket()` with required deployed
  inputs, sanitized evidence requirements, pass criteria, and forbidden evidence
  classes;
- added focused billing-product tests proving the packet blocks fake completion;
- added `scripts/verify-stripe-webhook-rds-acceptance-packet.mjs`;
- added `docs/STRIPE_WEBHOOK_RDS_ACCEPTANCE_PACKET.md`;
- generated deterministic sanitized evidence at
  `docs/examples/stripe-webhook-rds-acceptance-packet-report.sample.json`;
- deployed API webhook receipt, live RDS connectivity, real Stripe webhook
  delivery, deployed duplicate replay proof, deployed entitlement mutation, and
  owner approval remain open release gates.

Completed 345 scope:

- added `plans/345_LIVE_STRIPE_FINAL_ACCEPTANCE_PACKET.md`;
- added `pnpm billing:live-stripe-final-acceptance-packet`;
- added `stripeFinalAcceptancePacket()` with required predecessor gates, final
  owner evidence requirements, pass criteria, and forbidden evidence classes;
- added focused billing-product tests proving the packet blocks fake completion;
- added `scripts/verify-live-stripe-final-acceptance-packet.mjs`;
- added `docs/LIVE_STRIPE_FINAL_ACCEPTANCE_PACKET.md`;
- generated deterministic sanitized evidence at
  `docs/examples/live-stripe-final-acceptance-packet-report.sample.json`;
- real products/prices, live checkout, live portal, live lifecycle, deployed
  webhook/RDS, billing UI E2E, legal/pricing approval, and owner final sign-off
  remain open release gates.

Completed 256 scope:

- added `pnpm history:acceptance`;
- added `services/api/src/history-correlation.ts`;
- added focused history/correlation tests;
- added `scripts/verify-history-correlation-acceptance.mjs`;
- added `docs/HISTORY_CORRELATION_ACCEPTANCE.md`;
- generated deterministic sanitized evidence at
  `docs/examples/history-correlation-acceptance-report.sample.json`;
- verified deterministic deployment history, commit references, page snapshot
  history, diagnostic history, external-observation history, stable timeline
  ordering, before/after comparison, deployment correlation with
  `correlated-not-causal`, trend summary, anomaly detection, metric-event
  generation, dashboard consumption, and HTML report consumption;
- `pnpm history:acceptance` passed under Node 24 with 3/3 evidence groups;
- deployment history, page snapshot history, and diagnostic/external-observation
  rollup persistence are covered separately by ExecPlans 400-402; deployed
  rollup generation, deployed dashboard timeline, production anomaly alerting,
  and causal inference remain open release gates.

Completed 400 scope:

- added `pnpm history:deployment-persistence`;
- added `deployment_history` to the cloud persistence schema with tenant,
  retention, deletion, project, environment, deployment ID, commit SHA, status,
  deployed timestamp, actor, source, and JSON annotations columns;
- added deterministic upsert/list SQL helpers and a PostgreSQL deployment
  history store;
- added focused schema, DDL, SQL, and store tests;
- added `scripts/verify-deployment-history-persistence.mjs`;
- generated deterministic sanitized evidence at
  `docs/examples/deployment-history-persistence-report.sample.json`;
- `pnpm history:deployment-persistence` passed under Node 24;
- live RDS deployment/migration, live S3 artifact lifecycle proof, deployed
  rollup generation, and deployed dashboard timeline acceptance remain open
  release gates after ExecPlan 402.

Completed 401 scope:

- added `pnpm history:page-snapshot-persistence`;
- added `page_snapshot_history` to the cloud persistence schema with tenant,
  retention, deletion, project, environment, page URL, captured timestamp,
  artifact references, and diagnostic fingerprints columns;
- added deterministic upsert/list SQL helpers and a PostgreSQL page snapshot
  history store;
- added focused schema, DDL, SQL, and store tests;
- added `scripts/verify-page-snapshot-history-persistence.mjs`;
- generated deterministic sanitized evidence at
  `docs/examples/page-snapshot-history-persistence-report.sample.json`;
- `pnpm history:page-snapshot-persistence` passed under Node 24;
- live RDS deployment/migration, live S3 artifact lifecycle proof, deployed
  rollup generation, and deployed dashboard timeline acceptance remain open
  release gates after ExecPlan 402.

Completed 402 scope:

- added `pnpm history:rollup-persistence`;
- added `history_rollups` to the cloud persistence schema with tenant,
  retention, deletion, project, environment, rollup kind, rollup key, period
  bounds, JSON dimensions, JSON metrics, and generated timestamp columns;
- added deterministic upsert/list SQL helpers and a PostgreSQL history rollup
  store for diagnostic and external-observation aggregate records;
- added focused schema, DDL, SQL, and store tests;
- added `scripts/verify-history-rollup-persistence.mjs`;
- generated deterministic sanitized evidence at
  `docs/examples/history-rollup-persistence-report.sample.json`;
- `pnpm history:rollup-persistence` passed under Node 24;
- live RDS deployment/migration, deployed rollup generation, and deployed
  dashboard timeline acceptance remain open release gates.

Completed 255 scope:

- added `pnpm yandex:acceptance`;
- added `scripts/verify-yandex-acceptance.mjs`;
- added `docs/YANDEX_ACCEPTANCE.md`;
- generated deterministic sanitized evidence at
  `docs/examples/yandex-acceptance-report.sample.json`;
- verified deterministic Webmaster URL-status request shape and payload evidence
  for indexing state, searchable status, exclusion reason, last crawl, HTTP
  status, important URL flag, and diagnostics;
- verified deterministic Webmaster sitemap request shape and sitemap status
  payload evidence;
- verified deterministic Metrica landing-page request shape, filter escaping,
  selected metrics, organic source, landing page, visits, bounce rate,
  conversions, goal conversion rate, goal metadata, and sampling evidence;
- verified Yandex quota header normalization, freshness classification, and
  OAuth-vault-backed worker collection into `yandex.webmaster` and
  `yandex.metrica` observations with stable tenant/project/environment/provider/
  source fingerprints;
- verified dashboard and HTML reporter consumption of supplied Yandex
  observations without live provider calls;
- `pnpm yandex:acceptance` passed under Node 24 with 4/4 evidence groups;
- real Yandex OAuth app setup, live Webmaster site connection, live Metrica
  counter connection, exact live endpoint conformance, live quota/retry/
  backoff/stale-state behavior, and live dashboard connector proof remain open
  release gates.

Completed 254 scope:

- added `pnpm google:performance:acceptance`;
- added `scripts/verify-google-performance-acceptance.mjs`;
- added `docs/GOOGLE_PERFORMANCE_ACCEPTANCE.md`;
- generated deterministic sanitized evidence at
  `docs/examples/google-performance-acceptance-report.sample.json`;
- verified deterministic PageSpeed request shape for URL, strategy, and
  categories;
- verified deterministic CrUX request shape for URL, form factor, and effective
  connection type;
- verified PageSpeed lab LCP, INP, and CLS metrics, PageSpeed field page LCP,
  INP, and CLS metrics, PageSpeed field origin LCP, INP, and CLS metrics, and
  CrUX field LCP, INP, and CLS metrics;
- verified CrUX missing-data representation through sampled `missing` state;
- verified quota header normalization, freshness classification, and
  OAuth-vault-backed worker collection into `google.pagespeed` and `google.crux`
  observations with stable tenant/project/environment/provider/ source
  fingerprints;
- verified dashboard and HTML reporter consumption of supplied PageSpeed/CrUX
  observations without live provider calls;
- `pnpm google:performance:acceptance` passed under Node 24 with 4/4 evidence
  groups;
- real PageSpeed Insights calls, real CrUX calls, production quota/retry/
  backoff/stale-state proof, historical performance metric rollups, and live
  dashboard performance visualization remain open release gates.

Completed 253 scope:

- added `pnpm google:gsc:acceptance`;
- added `scripts/verify-google-search-console-acceptance.mjs`;
- added `docs/GOOGLE_SEARCH_CONSOLE_ACCEPTANCE.md`;
- generated deterministic sanitized evidence at
  `docs/examples/google-search-console-acceptance-report.sample.json`;
- verified deterministic Google URL Inspection request shape and payload
  evidence for coverage state, last crawl, Google canonical, user canonical, and
  rich-result verdict;
- verified deterministic Google Search Analytics request shape and payload
  evidence for clicks, impressions, CTR, and average position;
- verified deterministic Google sitemap status payload evidence, quota header
  normalization, and freshness classification;
- verified external-observation worker collection through the OAuth vault
  access-token boundary and `ExternalObservationStore` persistence with stable
  tenant/project/environment/provider/source fingerprints;
- verified dashboard and HTML reporter consumption of supplied Google
  observations without live provider calls;
- `pnpm google:gsc:acceptance` passed under Node 24 with 4/4 evidence groups;
- real Google OAuth app setup, app verification, live Search Console property
  connection, live URL Inspection, live Search Analytics, live sitemap status,
  live Google quota/retry/backoff/stale-state behavior, and live dashboard
  connector proof remain open release gates.

Completed 252 scope:

- extended dashboard project views to onboarding, issues, organization, site,
  environments, billing, settings, and audit log alongside the existing
  overview, diagnostics, crawl history, trends, external observations, reports,
  and team views;
- added deterministic empty-state rows for dashboard data tables;
- extended hosted route-flow browser acceptance across all current project
  dashboard views;
- extended hosted accessibility acceptance for the expanded navigation order,
  current-page state, keyboard navigation, loading, and error focus states;
- added `pnpm dashboard:acceptance`;
- added `scripts/verify-dashboard-production-e2e-accessibility.mjs`;
- added `docs/DASHBOARD_PRODUCTION_E2E_ACCESSIBILITY.md`;
- generated deterministic sanitized evidence at
  `docs/examples/dashboard-production-e2e-accessibility-report.sample.json`;
- `pnpm dashboard:acceptance` passed under Node 24 with 5/5 command groups and
  149/149 dashboard tests passing;
- real dashboard deployment, live Cognito/API dashboard E2E, live Google/Yandex
  connector UI, live Stripe-backed billing UI, external WCAG audit, and
  production visual-regression service remain open release gates.

Completed 251 scope:

- added `revokeExternalProviderOAuthConnection`;
- extended `SecretVault` with `deleteSecret`;
- added Secrets Manager token secret deletion with a 7-day recovery window;
- added `pnpm oauth-vault:acceptance`;
- added `scripts/verify-oauth-vault-security.mjs`;
- added `docs/OAUTH_VAULT_SECURITY.md`;
- generated deterministic sanitized evidence at
  `docs/examples/oauth-vault-security-report.sample.json`;
- verified KMS/Secrets Manager template shape, token write/read/refresh/
  rotation/revocation, tenant-scoped secret refs, audit/metrics,
  deletion/recovery-window contract, and sanitized evidence with no raw token
  markers;
- real KMS/Secrets Manager deployment, live secret population, live
  Google/Yandex credentials, live provider revocation endpoints, dashboard
  connector UI, deployed log/telemetry review, and external vault security
  review remain open release gates.

Completed 250 scope:

- added API operations for member removal and ownership transfer;
- added tenant-scoped PostgreSQL membership role update and soft-delete SQL
  contracts plus relational-store methods;
- added audit actions for `member.removed` and `ownership.transferred`;
- added `pnpm auth:acceptance`;
- added `scripts/verify-auth-rbac-acceptance.mjs`;
- added `docs/AUTH_RBAC_ACCEPTANCE.md`;
- generated deterministic evidence at
  `docs/examples/auth-rbac-acceptance-report.sample.json`;
- verified Cognito provisioning/CloudFormation contract, Cognito JWT principal
  extraction, Node HTTP auth short-circuit behavior, RBAC matrix,
  organization/member/project/environment lifecycle, member removal, ownership
  transfer, tenant isolation, audit evidence, and PostgreSQL membership SQL
  contracts;
- `pnpm auth:acceptance` passed under Node 24 with 6/6 verifier cases and
  373/375 `@searchlint/api` tests passing, with the same 2 existing skipped API
  tests;
- real Cognito deployment, signup/login/logout, refresh tokens, password reset,
  email verification, MFA, session expiry, invite email delivery, dashboard team
  UI, and live deployed Cloud API auth proof remain open release gates.

Completed 249 scope:

- added `pnpm workers:acceptance`;
- added `scripts/verify-workers-queues-scheduler.mjs`;
- added `docs/WORKERS_QUEUES_SCHEDULER_PROOF.md`;
- generated deterministic evidence at
  `docs/examples/workers-queues-scheduler-report.sample.json`;
- verified SQS/DLQ provisioning, enqueue/dequeue, retry/delete semantics,
  crawler worker ECS/Fargate static contract, worker lifecycle, structured logs,
  report artifact cleanup scheduler, external observation scheduler, and
  remaining runtime-gate documentation;
- `pnpm workers:acceptance` passed under Node 24 with 7/7 verifier cases and
  188/188 `@searchlint/workers` tests;
- real SQS/DLQ/ECS/EventBridge deployment, live enqueue/dequeue, live
  autoscaling behavior, worker metrics/alerts, and DLQ replay remain open
  release gates.

Completed 288 scope:

- added `services/workers/src/worker-metrics-alerts.ts`;
- exported deterministic worker metric mapping and alert-definition contracts
  from `@searchlint/workers`;
- added `pnpm workers:metrics-alerts`;
- added `scripts/verify-worker-metrics-alerts.mjs`;
- added deterministic evidence at
  `docs/examples/worker-metrics-alerts-report.sample.json`;
- added `docs/WORKER_METRICS_ALERTS.md`;
- verified crawler, cleanup, external observation, outbox, runtime-error,
  DLQ-depth, and queue-age metrics;
- verified alert definitions for worker runtime errors, crawler failures,
  cleanup failures, external observation failures, DLQ depth, queue age, and
  crawler retry/backoff pressure;
- `pnpm workers:metrics-alerts` passed under Node 24 with 7/7 verifier cases;
- live CloudWatch/OTLP metric export, deployed alarms, alert-action routing, and
  production incident-response evidence remain open release gates.

Completed 289 scope:

- reconciled the existing local worker concurrency evidence from ExecPlan 276
  with the master checklist item `Проверить concurrency`;
- updated `scripts/verify-worker-concurrency.mjs` so generated JSON evidence is
  Prettier-formatted;
- formatted the eight pre-existing deterministic sample JSON files that blocked
  repository-wide formatting;
- `pnpm workers:concurrency` passed under Node 24;
- `pnpm format` passed under Node 24;
- real SQS/ECS distributed concurrency and autoscaling remain open cloud release
  gates.

Completed 290 scope:

- added `services/workers/src/worker-autoscaling-contracts.ts`;
- exported `crawlerWorkerAutoscalingContract` and
  `validateWorkerAutoscalingContract` from `@searchlint/workers`;
- added Application Auto Scaling parameters and resources to
  `infra/aws/crawler-worker-ecs-fargate.cloudformation.json`;
- added `CrawlerWorkerAutoscalingRole`, `CrawlerWorkerScalableTarget`, and
  `CrawlerWorkerBacklogScalingPolicy`;
- added `pnpm workers:autoscaling`;
- added deterministic evidence at
  `docs/examples/worker-autoscaling-report.sample.json`;
- added `docs/WORKER_AUTOSCALING_STATIC_CONTRACT.md`;
- `pnpm workers:autoscaling` passed under Node 24 with 5/5 verifier cases;
- live ECS service deployment, live Application Auto Scaling deployment, SQS
  backlog pressure testing, and recorded scale-out/scale-in events remain open
  cloud release gates.

Completed 291 scope:

- added `services/api/src/pagination.ts`;
- exported reusable Cloud API cursor pagination helpers and contracts from
  `@searchlint/api`;
- added `pnpm api:pagination`;
- added deterministic evidence at
  `docs/examples/api-pagination-report.sample.json`;
- added `docs/API_PAGINATION_ACCEPTANCE.md`;
- added reusable OpenAPI v1 pagination components: `PaginationFirst`,
  `PaginationAfter`, and `PageInfo`;
- `pnpm api:pagination` passed under Node 24 with 4/4 verifier cases;
- `pnpm api:acceptance` passed under Node 24 with 7/7 verifier cases after
  regenerating the checked OpenAPI artifact;
- no new list endpoints were added, and real database/deployed pagination
  performance remains an open cloud release gate.

Completed 292 scope:

- added `services/api/src/api-load-benchmark.ts`;
- exported `runApiLoadBenchmark` and API load benchmark report types from
  `@searchlint/api`;
- added `pnpm api:load-benchmark`;
- added deterministic evidence at
  `docs/examples/api-load-benchmark-report.sample.json`;
- added `docs/API_LOAD_TESTING.md`;
- the local benchmark runs 1,500 deterministic Cloud API v1 dispatcher requests
  with concurrency 48 across organization, member, project, environment,
  dashboard snapshot, crawl request, Google OAuth start, Yandex OAuth callback,
  and unauthenticated rejection paths;
- `pnpm api:load-benchmark` passed under Node 24 with 0 unexpected requests and
  deterministic p95 32 ms against the local benchmark threshold of 35 ms;
- real API Gateway/ECS/RDS load testing, production-shaped datasets, deployed
  CloudWatch metrics/alarms, and DAST/pentest remain open cloud release gates.

Completed 293 scope:

- added `pnpm api:security`;
- added `scripts/verify-api-security-testing.mjs`;
- added deterministic evidence at
  `docs/examples/api-security-testing-report.sample.json`;
- added `docs/API_SECURITY_TESTING.md`;
- local/static API security testing now verifies authentication failure
  boundaries, Cognito invalid-token rejection, RBAC/tenant identity checks,
  request validation, unsupported methods, body-size limits, rate limiting,
  timeout/abort behavior, Stripe webhook signature boundaries, idempotency/audit
  evidence, static deployment security controls, and sensitive evidence
  redaction;
- `pnpm api:security` passed under Node 24 with 7/7 local/static security cases;
- DAST, independent penetration testing, API Gateway/WAF/security-header review,
  live Cognito/JWKS validation, deployed RDS tenant-isolation proof, and
  deployed CloudWatch security telemetry remain open release gates.

Completed 294 scope:

- added `pnpm workers:sqs-dlq`;
- added `scripts/verify-worker-sqs-dlq.mjs`;
- added deterministic evidence at
  `docs/examples/worker-sqs-dlq-report.sample.json`;
- added `docs/WORKER_SQS_DLQ_STATIC_CONTRACT.md`;
- the focused verifier proves the typed `cloudWorkerSqsProvisioningContract` and
  crawler-worker CloudFormation resources for `CrawlerWorkerQueue` and
  `CrawlerWorkerDeadLetterQueue`;
- static evidence covers SQS-managed encryption, 14-day retention, long polling,
  visibility timeout, redrive to DLQ, max receive count 5, queue URL output,
  queue ARN output, and DLQ ARN output;
- `pnpm workers:sqs-dlq` passed under Node 24;
- real AWS SQS/DLQ deployment, live queue URLs/ARNs from deployed stacks, live
  enqueue/dequeue, live redrive, CloudWatch SQS metrics, and DLQ replay runbooks
  remain open release gates.

Completed 295 scope:

- added `pnpm workers:containers`;
- added `scripts/verify-worker-containers.mjs`;
- added deterministic evidence at
  `docs/examples/worker-containers-report.sample.json`;
- added `docs/WORKER_CONTAINER_STATIC_DEPLOYMENT.md`;
- the focused verifier proves `Dockerfile.worker`, typed worker deployment
  contract, crawler-worker ECS/Fargate TaskDefinition, and crawler-worker ECS
  Service shape;
- static evidence covers Node.js 24 Bookworm slim runtime, pnpm frozen-lockfile
  build, production deploy to `/app`, non-root `node` runtime, built worker
  entrypoint, runtime `RULE_CATALOG.yaml` copy, Fargate/awsvpc, private service
  networking, awslogs, Secrets Manager database URL injection, and required
  SQS/PostgreSQL/artifact/rule/OTLP environment variables;
- `pnpm workers:containers` passed under Node 24;
- real worker image build, registry publication, live ECS deployment, running
  task health, startup logs, live worker metrics, and live shutdown behavior
  remain open release gates.

Completed 296 scope:

- added `pnpm auth:cognito-oidc`;
- added `scripts/verify-cognito-oidc-static.mjs`;
- added deterministic evidence at
  `docs/examples/cognito-oidc-static-report.sample.json`;
- added `docs/COGNITO_OIDC_STATIC_PROVISIONING.md`;
- the focused verifier proves the typed Cognito user-pool provisioning contract,
  Cognito CloudFormation user pool, API app client, platform-access group,
  outputs, and Cloud API ECS Cognito environment wiring;
- static evidence covers email sign-in, email verification, password policy,
  optional software-token MFA, non-secret API app client, SRP auth,
  refresh-token auth, issuer output, audience output, JWKS URL output, token-use
  output, and coarse platform-access group output;
- `pnpm auth:cognito-oidc` passed under Node 24;
- real Cognito deployment, live signup/login/logout, refresh-token,
  password-reset, email-verification, MFA, session-expiry, invite acceptance,
  and live Cloud API auth proof remain open release gates.

Completed 297 scope:

- added `pnpm auth:registration-static`;
- added `scripts/verify-auth-registration-static.mjs`;
- added deterministic evidence at
  `docs/examples/auth-registration-static-report.sample.json`;
- added `docs/AUTH_REGISTRATION_STATIC_ACCEPTANCE.md`;
- extended the Cognito provisioning contract with self-service signup and Hosted
  UI authorization-code PKCE app-client requirements;
- extended the Cognito CloudFormation template with self-service signup, Hosted
  UI domain provisioning, OAuth code flow, callback/logout URL allowlists, OIDC
  scopes, and `PreventUserExistenceErrors`;
- extended AWS IaC verification so `pnpm lint` checks the registration Hosted UI
  contract;
- static evidence covers dashboard Cognito authorization URL generation, pending
  PKCE state storage, callback parsing, authorization-code token exchange, and
  session persistence through injected ports;
- `pnpm auth:registration-static` passed under Node 24;
- real Cognito deployment, real user creation, live signup email delivery, email
  verification completion, MFA challenge, deployed dashboard registration E2E,
  and deployed Cloud API token acceptance remain open release gates.

Completed 298 scope:

- added `pnpm auth:login-static`;
- added `scripts/verify-auth-login-static.mjs`;
- added deterministic evidence at
  `docs/examples/auth-login-static-report.sample.json`;
- added `docs/AUTH_LOGIN_STATIC_ACCEPTANCE.md`;
- static evidence covers Cognito Hosted UI authorization-code PKCE login start,
  callback state validation, authorization-code token exchange, dashboard
  Cognito bearer-session persistence, authenticated dashboard API requests using
  `Authorization: Bearer ...`, authenticated route intent, and API-side Cognito
  bearer tests;
- `pnpm auth:login-static` passed under Node 24;
- real Cognito deployment, live browser login, AWS-issued tokens, Hosted UI
  cookie/redirect behavior, deployed dashboard login E2E, and deployed Cloud API
  bearer-token acceptance remain open release gates.

Completed 299 scope:

- added `pnpm auth:logout-static`;
- added `scripts/verify-auth-logout-static.mjs`;
- added deterministic evidence at
  `docs/examples/auth-logout-static-report.sample.json`;
- added `docs/AUTH_LOGOUT_STATIC_ACCEPTANCE.md`;
- static evidence covers Cognito Hosted UI logout URL construction, signed-out
  redirect URI preservation, optional logout state, injected session-store
  deletion, post-logout missing-session route intent, invalid-input session
  preservation, and storage-delete failure blocking;
- `pnpm auth:logout-static` passed under Node 24;
- real Cognito deployment, live browser logout, Hosted UI cookie clearing,
  refresh-token revocation or documented non-revocation policy, and deployed
  dashboard logout E2E remain open release gates.

Completed 300 scope:

- added `pnpm auth:refresh-static`;
- added `scripts/verify-auth-refresh-static.mjs`;
- added deterministic evidence at
  `docs/examples/auth-refresh-static-report.sample.json`;
- added `docs/AUTH_REFRESH_TOKEN_STATIC_ACCEPTANCE.md`;
- static evidence covers Cognito `ALLOW_REFRESH_TOKEN_AUTH`, 30-day refresh
  validity, refresh-token grant request construction, refresh-token preservation
  when Cognito omits rotation, rotated refresh-token preservation when Cognito
  returns one, expired stored-session refresh before dashboard API calls,
  refreshed session persistence, refreshed bearer-token API use, and
  missing-refresh-token failure before token/API fetch;
- `pnpm auth:refresh-static` passed under Node 24;
- real Cognito deployment, live refresh-token grant with AWS-issued tokens,
  provider-side rotation semantics, refresh-token revocation or documented
  non-revocation policy, and deployed dashboard/API refresh behavior remain open
  release gates.

Completed 301 scope:

- added `pnpm auth:password-reset-static`;
- added `scripts/verify-auth-password-reset-static.mjs`;
- added deterministic evidence at
  `docs/examples/auth-password-reset-static-report.sample.json`;
- added `docs/AUTH_PASSWORD_RESET_STATIC_ACCEPTANCE.md`;
- extended the Cognito provisioning contract with verified-email account
  recovery requirements;
- extended the Cognito CloudFormation template with `AccountRecoverySetting`;
- extended AWS IaC verification so `pnpm lint` checks password-reset recovery
  settings;
- static evidence covers verified-email account recovery, auto-verified email,
  email update verification, password policy, public/no-secret app client,
  `PreventUserExistenceErrors`, Cognito IdP support, and contract/template
  agreement;
- `pnpm auth:password-reset-static` passed under Node 24;
- real Cognito deployment, live forgot-password request, reset email delivery,
  confirmation-code handling, password update, and deployed dashboard/API
  password-reset behavior remain open release gates.

Completed 302 scope:

- added `pnpm auth:email-verification-static`;
- added `scripts/verify-auth-email-verification-static.mjs`;
- added deterministic evidence at
  `docs/examples/auth-email-verification-static-report.sample.json`;
- added `docs/AUTH_EMAIL_VERIFICATION_STATIC_ACCEPTANCE.md`;
- static evidence covers email sign-in, required verified email, Cognito
  `UsernameAttributes` and `AutoVerifiedAttributes`, verification before email
  updates, required mutable email schema, Hosted UI email scope, verified-email
  account recovery, and typed-contract/CloudFormation agreement;
- `pnpm auth:email-verification-static` passed under Node 24;
- real Cognito deployment, verification email delivery, confirmation-code
  handling, resend behavior, bounce/failure handling, and deployed dashboard/API
  email-verification behavior remain open release gates.

Completed 303 scope:

- added `pnpm auth:mfa-static`;
- added `scripts/verify-auth-mfa-static.mjs`;
- added deterministic evidence at
  `docs/examples/auth-mfa-static-report.sample.json`;
- added `docs/AUTH_MFA_STATIC_ACCEPTANCE.md`;
- static evidence covers optional software-token MFA in the typed Cognito
  contract, matching CloudFormation `MfaConfiguration: OPTIONAL`,
  `SOFTWARE_TOKEN_MFA`, and Hosted UI/app-client compatibility for browser PKCE
  flows;
- `pnpm auth:mfa-static` passed under Node 24;
- real Cognito deployment, live software-token MFA enrollment, live TOTP
  challenge behavior, MFA recovery/fallback behavior, and deployed dashboard/API
  MFA behavior remain open release gates.

Completed 304 scope:

- added `pnpm auth:session-expiry-static`;
- added `scripts/verify-auth-session-expiry-static.mjs`;
- added deterministic evidence at
  `docs/examples/auth-session-expiry-static-report.sample.json`;
- added `docs/AUTH_SESSION_EXPIRY_STATIC_ACCEPTANCE.md`;
- static evidence covers Cognito access-token, ID-token, and refresh-token
  validity settings, dashboard stored-session valid/expired/missing
  classification, expired-session route intent, fail-fast expired sessions
  without refresh tokens, near-expiry refresh and persistence, and invalid
  expiry-skew rejection;
- `pnpm auth:session-expiry-static` passed under Node 24;
- real Cognito deployment, AWS-issued token expiry in a real browser session,
  live refresh-token expiry/revocation behavior, live browser cookie/session
  expiry, and deployed dashboard/API session-expiry behavior remain open release
  gates.

Completed 305 scope:

- added `pnpm auth:oauth-callbacks-static`;
- added `scripts/verify-auth-oauth-callbacks-static.mjs`;
- added deterministic evidence at
  `docs/examples/auth-oauth-callbacks-static-report.sample.json`;
- added `docs/AUTH_OAUTH_CALLBACKS_STATIC_ACCEPTANCE.md`;
- static evidence covers Cognito Hosted UI PKCE callback state lookup, code
  extraction, state validation, provider-error handling, pending-state deletion,
  token-exchange request construction, and session persistence;
- static evidence also covers Google/Yandex external-provider OAuth start,
  pending-state persistence, callback state/code validation, provider-error
  handling, completion request construction, API completion, and invalid
  provider callback rejection before application code;
- `pnpm auth:oauth-callbacks-static` passed under Node 24;
- deployed Cognito Hosted UI callback routes, AWS-issued Cognito callback/token
  exchange, live Google/Yandex OAuth app setup, live provider callback code
  exchange/token storage, and deployed dashboard/API callback behavior remain
  open release gates.

Completed 306 scope:

- added `services/api/src/invite-flow.ts`;
- added `services/api/test/invite-flow.test.ts`;
- exported invite-flow contracts from `@searchlint/api`;
- added `pnpm auth:invite-flow-static`;
- added `scripts/verify-auth-invite-flow-static.mjs`;
- added deterministic evidence at
  `docs/examples/auth-invite-flow-static-report.sample.json`;
- added `docs/AUTH_INVITE_FLOW_STATIC_ACCEPTANCE.md`;
- static evidence covers invitation creation, normalized invitee email,
  non-owner role restrictions, expiry, raw-token-free SHA-256 token
  fingerprinting, acceptance URL and email payload generation, invitation
  acceptance into a membership, revocation, audit events, and negative cases;
- `pnpm auth:invite-flow-static` passed under Node 24;
- deployed API invitation persistence, real invite email delivery,
  bounce/failure handling, deployed dashboard acceptance, and Cognito user
  creation from invitations remain open release gates.

Completed 307 scope:

- added `pnpm oauth-vault:kms-static`;
- added `scripts/verify-oauth-vault-kms-static.mjs`;
- added deterministic evidence at
  `docs/examples/oauth-vault-kms-static-report.sample.json`;
- added `docs/OAUTH_VAULT_KMS_STATIC_PROVISIONING.md`;
- static evidence covers the OAuth vault customer-managed KMS key,
  `EnableKeyRotation`, account-root IAM policy administration, stable SearchLint
  namespaced alias, alias target, and downstream key outputs;
- `pnpm oauth-vault:kms-static` passed under Node 24;
- real AWS KMS deployment, deployed key ARN/alias verification, production
  secret wiring, and external vault security review remain open release gates.

Completed 308 scope:

- added `pnpm oauth-vault:secrets-static`;
- added `scripts/verify-oauth-vault-secrets-static.mjs`;
- added deterministic evidence at
  `docs/examples/oauth-vault-secrets-static-report.sample.json`;
- added `docs/OAUTH_VAULT_SECRETS_MANAGER_STATIC_PROVISIONING.md`;
- static evidence covers the OAuth vault Secrets Manager secret slots for Stripe
  webhook and OTLP headers, stable SearchLint namespaced secret paths, runtime
  environment descriptions, customer-managed KMS encryption references,
  generated placeholder configuration, plaintext `SecretString` absence, and
  downstream secret ARN outputs;
- `pnpm oauth-vault:secrets-static` passed under Node 24;
- real AWS Secrets Manager deployment, live secret population, production
  provider credentials, live OAuth token write/read/delete against AWS, and
  external vault security review remain open release gates.

Completed 309 scope:

- added `docs/reviews/oauth-vault-security/` review packet;
- added `docs/reviews/oauth-vault-security/review-scope.json`;
- added example reviewer templates only; no fake real reviewer files were
  created;
- added `pnpm oauth-vault:security-review`;
- added `scripts/verify-oauth-vault-security-review.mjs`;
- added deterministic blocked-state evidence at
  `docs/examples/oauth-vault-security-review-report.sample.json`;
- the verifier runs KMS static provisioning, Secrets Manager static
  provisioning, and OAuth vault acceptance evidence before checking reviewer
  files;
- `pnpm oauth-vault:security-review` fails clearly without real
  `reviewer-1.review.json` and `reviewer-2.review.json`, and `.example.json`
  files do not count as sign-off;
- the master checklist item for external vault security review remains open
  until two real independent reviewer approvals are supplied and the verifier
  passes.

Completed 310 scope:

- added optional `organizationSwitchTargets` to `DashboardSnapshot`;
- added route-safe `organizationSwitcher` items to dashboard project view
  models;
- rendered an accessible `Organization switcher` navigation landmark in the
  dashboard header;
- added unit coverage for current state, sorting, custom base paths, escaping,
  and invalid switch target rejection;
- extended hosted/local route-flow acceptance to switch from Acme Agency to Beta
  Studio and back through dashboard snapshot API paths;
- added `pnpm dashboard:organization-switcher`;
- added deterministic evidence at
  `docs/examples/dashboard-organization-switcher-report.sample.json`;
- added `docs/DASHBOARD_ORGANIZATION_SWITCHER.md`;
- production dashboard deployment, live Cognito/API membership discovery, live
  switcher data, and production E2E remain open release gates.

Completed 311 scope:

- added optional `projectManagement` records to `DashboardSnapshot`;
- added sorted project management rows to the dashboard Organization view model;
- rendered a `Project management` table in the Organization view;
- marked the current project deterministically;
- rendered the checked `createProject` Cloud API route contract in the
  management view;
- added unit coverage for sorting, current state, escaping, invalid project
  records, and route contract evidence;
- extended hosted/local route-flow acceptance to observe project management
  content in the Organization view;
- added `pnpm dashboard:project-management`;
- added deterministic evidence at
  `docs/examples/dashboard-project-management-report.sample.json`;
- added `docs/DASHBOARD_PROJECT_MANAGEMENT.md`;
- production dashboard deployment, live API-backed project lists and project
  creation, live auth/RBAC enforcement, and production E2E remain open release
  gates.

Completed 312 scope:

- added optional `crawlSchedules` records to `DashboardSnapshot`;
- added sorted crawl schedule records to the dashboard Crawl History view model;
- rendered a `Crawl scheduling` table in Crawl History;
- surfaced the checked `requestCrawl` Cloud API route contract in Crawl History;
- added unit coverage for enabled/paused state, sorted schedules, escaping, and
  route contract evidence;
- extended hosted/local route-flow acceptance to observe crawl scheduling
  content in Crawl History;
- added `pnpm dashboard:crawl-scheduling`;
- added deterministic evidence at
  `docs/examples/dashboard-crawl-scheduling-report.sample.json`;
- added `docs/DASHBOARD_CRAWL_SCHEDULING.md`;
- production dashboard deployment, live API-backed schedule persistence, live
  scheduler execution, live RBAC enforcement, and production E2E remain open
  release gates.

Completed 313 scope:

- added optional `deploymentHistory` records to `DashboardSnapshot`;
- added sorted deployment history records to the dashboard Trends view model;
- rendered a `Deployment history` table in Trends with commit refs, status,
  before/after diagnostic counts, delta, and annotation;
- added unit coverage for sorted deployments and rendered deployment history;
- extended hosted/local route-flow acceptance to observe deployment history
  content in Trends;
- added `pnpm dashboard:deployment-history`;
- added deterministic evidence at
  `docs/examples/dashboard-deployment-history-report.sample.json`;
- added `docs/DASHBOARD_DEPLOYMENT_HISTORY.md`;
- production dashboard deployment, live deployment ingestion, live Cloud API
  persistence, live deployment/diagnostic correlation, and production E2E remain
  open release gates.

Completed 314 scope:

- added Google/Yandex provider settings to the dashboard Settings view model;
- rendered a `Google/Yandex settings` table with connection status, observed
  subject count, checked OAuth start route, required scopes, and callback URI;
- added unit coverage for Google and Yandex settings model/rendering;
- extended hosted/local route-flow acceptance to observe provider settings
  content in Settings;
- added `pnpm dashboard:provider-settings`;
- added deterministic evidence at
  `docs/examples/dashboard-provider-settings-report.sample.json`;
- added `docs/DASHBOARD_PROVIDER_SETTINGS.md`;
- production dashboard deployment, live Google/Yandex OAuth app configuration,
  live credential persistence, live provider access, and production E2E remain
  open release gates.

Completed 315 scope:

- rendered a visible dashboard `Notification settings` panel in Settings;
- added notification summary counts for enabled channels, enabled rules, and
  retry-scheduled delivery attempts;
- kept notification channel, rule, and delivery-history tables visible with
  sanitized targets and failure evidence;
- added unit coverage for the notifications UI panel and summary;
- extended hosted/local route-flow acceptance to observe notifications UI
  content in Settings;
- added `pnpm dashboard:notifications-ui`;
- added deterministic evidence at
  `docs/examples/dashboard-notifications-ui-report.sample.json`;
- added `docs/DASHBOARD_NOTIFICATIONS_UI.md`;
- production dashboard deployment, live provider delivery, production
  notification persistence, deployed workers/scheduler, and production E2E
  remain open release gates.

Completed 316 scope:

- rendered team members with principal IDs, display names, and roles;
- added a `Team/RBAC management` panel with deterministic role permission
  summaries;
- added management actions for inviting members, removing members, and
  transferring ownership;
- surfaced the checked `addMember` Cloud API route contract;
- added unit coverage for Team/RBAC model and rendering;
- extended hosted/local route-flow acceptance to observe Team/RBAC UI content in
  Team;
- added `pnpm dashboard:team-rbac-ui`;
- added deterministic evidence at
  `docs/examples/dashboard-team-rbac-ui-report.sample.json`;
- added `docs/DASHBOARD_TEAM_RBAC_UI.md`;
- production dashboard deployment, live team mutation forms, live invite email
  delivery, deployed auth/RBAC enforcement, and production E2E remain open
  release gates.

Completed 239 scope:

- added `searchlint --version`;
- added `searchlint doctor`;
- added `searchlint completion bash|zsh|fish`;
- added installed CLI acceptance verifier `pnpm cli:acceptance`;
- added `scripts/verify-cli-acceptance.mjs`;
- added `docs/CLI_ACCEPTANCE.md`;
- added sanitized CLI acceptance sample evidence under `docs/examples`;
- `pnpm --filter @searchlint/cli test`, `pnpm verify:release`,
  `pnpm cli:acceptance`, and `pnpm lint` passed under Node 24 in this checkout;
- full CLI release acceptance remains open for native Windows/Linux runner
  proof, public registry install, and real-shell completion sourcing.

Completed 238 scope:

- public npm package candidates now use `1.0.0-beta.0`;
- public npm package candidates are no longer marked `private: true`;
- public npm package candidates declare `Apache-2.0`, engines, keywords, and
  provenance metadata;
- private cloud packages remain `private: true`;
- added `pnpm package:dry-run`;
- added `scripts/verify-package-publication-readiness.mjs`;
- added `docs/PACKAGE_PUBLICATION_READINESS.md`;
- added sanitized dry-run sample evidence under `docs/examples`;
- `pnpm verify:release`, `pnpm package:dry-run`, and `pnpm lint` passed under
  Node 24 in this checkout;
- npm publication remains blocked on approved repository/homepage/bugs routing,
  legal review, trusted publishing setup, and real beta publication evidence.

Controlling remaining-roadmap ExecPlan:
`plans/191_SEARCHLINT_1_0_REMAINING_EXECUTION_PLAN.md`.

External validation pending from ExecPlan:
`plans/101_POSTGRES_AUTHORIZATION_MATRIX_ACCEPTANCE.md`.

Recommended next step: prove live Google/Yandex credentials, deployed dashboard
hosting runtime, or deployed external-observation AWS runtime. Other open
release paths remain full WCAG/axe dashboard acceptance, pixel-perfect visual
regression service, deployed Cloud API Gateway/ECS runtime proof, deployed RDS
migration proof, SQS/IAM/worker runtime proof, deployed Cognito auth proof,
registry publication and release digest pinning plus container image
signing/provenance, and real AWS log/metric/alarm/OTLP export proof.

Completed 230 scope:

- added `plans/230_DASHBOARD_STATIC_HOSTING_AWS_IAC.md`;
- added `infra/aws/dashboard-static-hosting.cloudformation.json`;
- the dashboard hosting template provisions a private S3 dashboard asset bucket,
  CloudFront origin access control, CloudFront distribution, response security
  headers policy, SPA fallback from 403/404 to `index.html`, and outputs for
  bucket/distribution/base URL;
- the template blocks public S3 access, enforces bucket-owner object ownership,
  enables bucket versioning, configures server-side encryption, redirects HTTP
  viewers to HTTPS, requires TLS 1.2+, enables compression, and restricts bucket
  reads to the CloudFront distribution;
- extended `scripts/verify-aws-iac.mjs` to validate the dashboard static hosting
  template alongside the other AWS templates;
- focused validation passed: `node scripts/verify-aws-iac.mjs`.

Completed 229 scope:

- added `plans/229_EXTERNAL_OBSERVATION_EVENTBRIDGE_SCHEDULE.md`;
- added a typed external-observation EventBridge Scheduler to ECS/Fargate
  contract exported from `@searchlint/workers`;
- collection polling/runtime process config now supports bounded
  `SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_MAX_BATCHES` execution for scheduled
  one-shot ECS task invocations;
- added `infra/aws/external-observation-schedule.cloudformation.json` with
  hourly EventBridge Scheduler, DLQ, Fargate task definition, private awsvpc
  networking, CloudWatch logs, scheduler/task roles, PostgreSQL secret
  injection, optional OAuth/OTLP secret injection, and Secrets Manager
  read/write IAM for refreshed OAuth tokens;
- extended `scripts/verify-aws-iac.mjs` to validate the external-observation
  schedule template, env/secret boundaries, command, DLQ/retry policy, no public
  IP assignment, and scheduler/task IAM permissions;
- workers tests cover schedule contract drift, max-batches process env parsing,
  invalid max-batches values, and runtime stop-after-max-batches behavior;
- focused validation passed: `pnpm --filter @searchlint/workers test` and
  `node scripts/verify-aws-iac.mjs`.

Completed 228 scope:

- added `plans/228_GOOGLE_PAGESPEED_CRUX_COLLECTORS.md`;
- extended `GoogleProviderAdapter` with `runPageSpeed` and `queryCrux`;
- PageSpeed observations now call the PageSpeed endpoint with configured URL,
  strategy, and categories, then normalize the payload into `google.pagespeed`
  external-observation records;
- CrUX observations now call the CrUX endpoint with configured URL, form factor,
  and effective connection type, then normalize the payload into sampled
  `google.crux` external-observation records;
- Google external observation targets now support `pagespeed` and `crux` kinds;
- worker target config now supports `googlePageSpeed` and `googleCrux` options;
- external observation collection process env parsing now supports PageSpeed and
  CrUX enablement/options;
- API and workers tests cover PageSpeed/CrUX request shape, observation
  normalization, target generation, collector routing, and invalid env values;
- focused validation passed: `pnpm --filter @searchlint/api test` and
  `pnpm --filter @searchlint/workers test`.

Completed 227 scope:

- added `plans/227_EXTERNAL_OBSERVATION_TARGET_DISCOVERY.md`;
- extended external observation target config with deterministic discovery site
  URLs, discovery sitemap URLs, and a bounded maximum subject URL count;
- `createConfiguredExternalObservationTargetResolver` now combines explicit
  subject/sitemap URLs with discovered site-root targets and default
  `/sitemap.xml` targets;
- target discovery deduplicates subject and sitemap URLs in first-seen order and
  enforces the configured subject URL cap;
- external observation collection process env parsing now supports
  `SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_DISCOVERY_SITE_URLS`,
  `SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_DISCOVERY_SITEMAP_URLS`, and
  `SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_DISCOVERY_MAX_SUBJECT_URLS`;
- workers tests cover explicit-plus-discovered Google/Yandex target composition,
  invalid discovery limits, and process env parsing;
- focused validation passed: `pnpm --filter @searchlint/workers test`.

Completed 226 scope:

- added `plans/226_DASHBOARD_BUNDLED_BROWSER_ASSET.md`;
- extended dashboard package metadata with a bundled browser asset target;
- extended `scripts/build-package.mjs` to emit
  `dist/assets/searchlint-dashboard/searchlint-dashboard.bundle.min.js` from the
  checked dashboard ESM graph without a new bundler dependency;
- generated dashboard asset manifests now record bundle module script, bytes,
  SHA-256 hash, compact module-graph bytes, and source module list;
- extended `scripts/verify-dashboard-browser-assets.mjs` to verify bundle
  metadata, bounded size overhead, and absence of runtime import statements;
- added `scripts/verify-dashboard-hosted-bundle-load.mjs`, which serves the
  hosted shell with the bundled asset as the entry module and proves the
  dashboard overview renders in Chromium;
- wired hosted bundle load verification into `pnpm lint`;
- focused validation passed: API build, dashboard build, dashboard browser asset
  verifier, and dashboard hosted bundle load verifier.

Completed 225 scope:

- added `plans/225_DASHBOARD_HOSTED_VISUAL_SCREENSHOT_BASELINE.md`;
- added `scripts/verify-dashboard-hosted-visual.mjs`, which serves the generated
  dashboard shell/assets and deterministic API fixture from a local HTTP origin;
- verifier captures representative screenshots:
  `reports/dashboard-visual/desktop-diagnostics.png`,
  `reports/dashboard-visual/mobile-overview.png`, and
  `reports/dashboard-visual/desktop-external-observations.png`;
- verifier writes `reports/dashboard-visual/report.json` with viewport,
  screenshot path, byte size, SHA-256 hash, PNG dimensions/color count, and
  layout boxes;
- verifier validates screenshots as nonblank PNG files using an internal PNG
  decoder;
- verifier checks no horizontal overflow at tested viewports;
- verifier checks header, navigation, and main content boxes have positive
  dimensions and are vertically ordered without critical overlap;
- wired visual verifier into `pnpm lint`;
- focused validation passed: API build, dashboard build, and dashboard hosted
  visual verifier.

Completed 224 scope:

- added `plans/224_DASHBOARD_HOSTED_ACCESSIBILITY_BASELINE.md`;
- added `scripts/verify-dashboard-hosted-accessibility.mjs`, which serves the
  generated dashboard shell/assets and deterministic API fixtures from a local
  HTTP origin;
- accessibility verifier checks banner, labelled navigation, main landmark, H1,
  active H2, labelled diagnostics table, and representative table cells in
  Chromium;
- verifier checks dashboard navigation links have non-empty accessible names and
  the active link exposes `aria-current="page"`;
- verifier proves focus lands on the dashboard root after render, `Tab` reaches
  navigation links, and `Enter` activates keyboard navigation;
- verifier proves API-error status rendering exposes a focusable
  `main.searchlint-dashboard-shell[tabindex="-1"]` status landmark while focus
  remains on the dashboard root;
- verifier fails on page errors or console errors;
- wired accessibility baseline verifier into `pnpm lint`;
- focused validation passed: API build, dashboard build, and dashboard hosted
  accessibility verifier.

Completed 223 scope:

- added `plans/223_DASHBOARD_HOSTED_BROWSER_ROUTE_FLOW_ACCEPTANCE.md`;
- added `scripts/verify-dashboard-hosted-route-flows.mjs`, which serves the
  generated dashboard shell/assets and deterministic mock API snapshot from a
  local HTTP origin;
- route-flow verifier seeds a browser auth session and checks overview,
  diagnostics, crawl history, trends, external observations, reports, and team
  dashboard routes in Chromium;
- verifier clicks in-app dashboard navigation links and confirms browser history
  paths for covered routes;
- verifier checks representative rendered values for diagnostics, crawl runs,
  trends, external observations, reports, quotas, and team members;
- verifier proves unauthenticated project-route access redirects to `/sign-in`;
- verifier fails on page errors or console errors;
- wired route-flow verifier into `pnpm lint`;
- focused validation passed: API build, dashboard build, dashboard browser asset
  verifier, hosted browser-load verifier, and hosted route-flow verifier.

Completed 222 scope:

- added `plans/222_DASHBOARD_HOSTED_SHELL_IMPORT_MAP_AND_BROWSER_LOAD_PROOF.md`;
- added hosted shell import-map types and rendering before the dashboard module
  entry script;
- added `dashboardHostedShellAssetsFromManifest` to convert the generated
  dashboard asset manifest into hosted shell asset config;
- added deterministic import-map specifier and module URL validation;
- fixed hosted browser entry startup to wrap `window.fetch` before passing it to
  the API client, avoiding Chromium unbound-fetch `Illegal invocation`;
- added `scripts/verify-dashboard-hosted-browser-load.mjs`, which serves the
  generated shell/assets, seeds browser sessionStorage, returns a mock dashboard
  snapshot, and proves Chromium renders the dashboard overview from the
  generated ESM graph;
- wired the hosted browser-load verifier into `pnpm lint`;
- focused validation passed: API build, dashboard build, dashboard browser asset
  verifier, hosted browser-load verifier, dashboard typecheck, and 2 test files
  / 148 tests.

Completed 221 scope:

- added `plans/221_DASHBOARD_BROWSER_ASSET_GRAPH_AND_IMPORT_MAP.md`;
- exposed `@searchlint/api/http-contracts` as a browser-safe route-contract
  package subpath;
- moved dashboard runtime route-contract imports to
  `@searchlint/api/http-contracts` instead of the API package root;
- changed `searchlint.dashboardBrowserAssets` to declare a hosted ESM asset
  graph under `dist/assets/searchlint-dashboard/`;
- extended `scripts/build-package.mjs` to copy all declared dashboard modules
  and import-map vendor modules, recording bytes and SHA-256 hashes for each;
- extended `scripts/verify-dashboard-browser-assets.mjs` to reject unresolved
  relative imports and bare imports not mapped to generated assets;
- added dashboard DOM libs to the dashboard TypeScript config for browser-facing
  code;
- focused validation passed: API build, dashboard build, and dashboard browser
  asset verifier.

Completed 220 scope:

- added `plans/220_DASHBOARD_HOSTABLE_BROWSER_ASSET_PIPELINE.md`;
- added `searchlint.dashboardBrowserAssets` metadata to
  `apps/dashboard/package.json`;
- extended `scripts/build-package.mjs` to generate declared dashboard browser
  assets and manifest files after TypeScript build;
- added `scripts/verify-dashboard-browser-assets.mjs` and wired it into
  `pnpm lint`;
- focused validation passed: dashboard build plus dashboard browser asset
  verifier, `@searchlint/dashboard` typecheck, and 2 test files / 147 tests.

Completed 219 scope:

- added `plans/219_DASHBOARD_BROWSER_ENTRY_PACKAGE_EXPORT.md`;
- added `apps/dashboard/src/browser-entry.ts` with explicit and global-scope
  dashboard browser entry startup helpers;
- added `apps/dashboard/src/browser-entry.auto.ts` as the auto-start browser
  module entry point;
- exported `@searchlint/dashboard/browser-entry` and
  `@searchlint/dashboard/browser-entry.auto` from the dashboard package manifest
  with `dist/src` runtime and declaration targets;
- focused dashboard validation passed: `@searchlint/dashboard` typecheck and 2
  test files / 147 tests.

Completed 218 scope:

- added `plans/218_DASHBOARD_BROWSER_ENTRY_MODULE_CONTRACT.md`;
- added typed dashboard browser entry document/window/location ports;
- added `startDashboardHostedBrowserEntry`, which reads hosted shell bootstrap
  JSON, resolves the root/config script IDs, binds browser-like ports, and
  starts `startDashboardBrowserApp`;
- invalid shell config, missing root/config script, malformed JSON, and missing
  browser ports fail before API fetch or listener side effects;
- focused dashboard validation passed: `@searchlint/dashboard` typecheck and 2
  test files / 143 tests.

Completed 217 scope:

- added `plans/217_DASHBOARD_HOSTED_HTML_SHELL_CONTRACT.md`;
- added typed hosted dashboard shell and bootstrap config contracts;
- added deterministic hosted HTML shell rendering with accessible boot root,
  JSON bootstrap config script, browser module script, optional CSP nonce, and
  optional stylesheet links;
- escaped shell text/URLs and JSON script content before emission;
- invalid shell IDs, asset URLs, and bootstrap config fail deterministically
  before rendering;
- focused dashboard validation passed: `@searchlint/dashboard` typecheck and 2
  test files / 139 tests.

Completed 216 scope:

- added `plans/216_DASHBOARD_BROWSER_APP_BOOTSTRAP_COMPOSITION.md`;
- added a typed dashboard browser app bootstrap config and running app handle;
- composed browser auth session storage, stored-session Cognito dashboard API
  client, DOM app-shell renderer, and browser-history runtime from injected
  ports/config;
- successful bootstrap validates config, starts the runtime once, renders the
  current project route through the real dashboard API fetch transport, and
  returns `navigate`/`stop` lifecycle methods;
- invalid config fails before API, history, navigation, or render side effects;
- focused dashboard validation passed: `@searchlint/dashboard` typecheck and 2
  test files / 136 tests.

Completed 215 scope:

- added `plans/215_DASHBOARD_BROWSER_HISTORY_RUNTIME.md`;
- added typed dashboard browser history, event-target, link, and click-event
  ports;
- added a dashboard browser history runtime factory with `start`, `navigate`,
  and `stop` lifecycle methods;
- initial mount renders the current browser path and registers `popstate` and
  click listeners through injected event targets;
- `popstate` reruns the dashboard browser runtime for the current location;
- same-origin local dashboard link clicks are prevented, pushed to the injected
  history port, and rerendered, while external, modified, non-left, and
  out-of-base clicks are ignored;
- `stop` removes listeners and prevents further controller navigation effects;
- focused dashboard validation passed: `@searchlint/dashboard` typecheck and 2
  test files / 134 tests.

Completed 214 scope:

- added `plans/214_DASHBOARD_BROWSER_DOM_APP_SHELL_ADAPTER.md`;
- added typed dashboard DOM-like root/document ports;
- added a browser DOM app-shell renderer factory that implements the dashboard
  runtime render port for an injected root element;
- rendered successful dashboard HTML, not-found, snapshot-missing, and API-error
  states with stable runtime-state attributes, escaped dynamic values, optional
  injected document-title updates, and optional root focus;
- kept the adapter dependency-free with no direct `document` or `window`
  globals;
- focused dashboard validation passed: `@searchlint/dashboard` typecheck and 2
  test files / 128 tests.

Completed 213 scope:

- added `plans/213_DASHBOARD_BROWSER_RUNTIME_ROUTING_BOUNDARY.md`;
- added a typed dashboard browser location port and project runtime renderer
  port;
- added dashboard browser runtime routing orchestration that reads the current
  pathname, delegates to the existing auth/session/API project runtime resolver,
  redirects auth intents through the injected navigation port, and renders
  project HTML, not-found, snapshot-missing, and API-error states through typed
  render ports;
- kept the browser runtime boundary framework-neutral, with no React/Next.js
  shell and no direct DOM globals;
- focused dashboard validation passed: `@searchlint/dashboard` typecheck and 2
  test files / 125 tests.

Completed 212 scope:

- added `plans/212_DASHBOARD_EXTERNAL_PROVIDER_OAUTH_BROWSER_REDIRECT.md`;
- added a typed dashboard browser navigation assignment port;
- added external-provider OAuth redirect orchestration that calls the checked
  start/pending-state helper and assigns the returned provider authorization URL
  through the injected navigation port;
- kept shared dashboard OAuth redirect logic free of direct `window` access;
- mapped browser navigation assignment failures to deterministic dashboard
  client errors;
- focused dashboard validation passed: `@searchlint/dashboard` typecheck and 2
  test files / 120 tests.

Completed 211 scope:

- added `plans/211_DASHBOARD_EXTERNAL_PROVIDER_OAUTH_PENDING_STATE.md`;
- added dashboard external-provider OAuth pending-state contracts and a
  storage-backed browser adapter;
- added start orchestration that calls `startExternalProviderOAuthConnection`,
  validates provider/state response, saves pending state, and returns the
  provider authorization URL without mutating browser location;
- added callback consumption that validates provider errors, state, code,
  expiry, and pending-state shape, then deletes consumed or invalid pending
  state and prepares the backend callback completion request;
- added callback completion that calls `completeExternalProviderOAuthConnection`
  with the pending redirect URI, authorization code, optional verifier, and
  stored provider scopes;
- focused dashboard validation passed: `@searchlint/dashboard` typecheck and 2
  test files / 117 tests.

Completed 210 scope:

- added `plans/210_EXTERNAL_PROVIDER_OAUTH_AUTHORIZATION_START.md`;
- added `startExternalProviderOAuthConnection` to the Cloud API service, checked
  `/v1` HTTP route contracts, dispatcher, dashboard action map, and dashboard
  API client;
- added deterministic Google/Yandex provider authorization URL generation with
  provider scopes, state, redirect URI, client ID, offline access, Google
  consent prompt, and optional PKCE enforcement;
- added API process env parsing and deployment/IaC contract wiring for
  Google/Yandex OAuth client IDs, authorization endpoints, redirect URIs,
  scopes, and Google PKCE requirement;
- kept the start operation side-effect-light: it verifies `connector:manage` and
  project/environment identity, then returns the authorization URL without token
  exchange, vault writes, or OAuth connection persistence;
- moved visible dashboard connector controls to the authorization-start action,
  leaving callback completion as the return leg;
- focused validation passed: `@searchlint/api` typecheck, 41 test files passed /
  1 skipped, 365 tests passed / 2 skipped; `@searchlint/dashboard` typecheck and
  2 test files / 110 tests; AWS IaC verifier passed.

Completed 209 scope:

- added `plans/209_DASHBOARD_EXTERNAL_PROVIDER_CONNECTOR_UI.md`;
- added `completeExternalProviderOAuthConnection` to the dashboard action and
  API-client surfaces;
- mapped the dashboard action to the checked backend callback route contract
  with encoded organization/project/environment/provider path parameters;
- added deterministic dashboard request validation for provider, authorization
  code, redirect URI, optional PKCE verifier, and optional scopes;
- extended the authenticated fetch transport coverage for the OAuth callback
  action, operation/schema headers, bearer auth, and JSON body;
- added Google/Yandex connector controls to the external-observations section,
  with statuses derived from observation freshness instead of the existence of
  UI controls;
- focused dashboard validation passed: `@searchlint/dashboard` typecheck and 2
  test files / 108 tests.

Completed 208 scope:

- added `plans/208_EXTERNAL_PROVIDER_OAUTH_CONNECTION_CALLBACK.md`;
- added `completeExternalProviderOAuthConnection` to the Cloud API service
  surface;
- added provider OAuth token exchange and provider account resolver ports;
- added SecretVault-backed access-token and refresh-token writes for external
  provider connection completion;
- added OAuth connection metadata upsert through `OAuthConnectionStore`, with
  provider account id, normalized scopes, access/refresh secret refs, expiry,
  active status, and timestamps;
- added `oauth_connection.completed` audit action and metric emission without
  raw token values;
- added a stable
  `/v1/organizations/{organizationId}/projects/{projectId}/environments/{environmentId}/external-providers/{provider}/oauth/callback`
  HTTP route contract and dispatcher support;
- extended the PostgreSQL transaction manager to include OAuth connection stores
  when configured;
- focused API validation passed: `@searchlint/api` typecheck and 40 test files
  passed / 1 skipped, 357 tests passed / 2 skipped.

Completed 207 scope:

- added `plans/207_EXTERNAL_OBSERVATION_OAUTH_REFRESH_AND_SECRET_WRITES.md`;
- added `services/workers/src/external-observation-oauth-refresh.ts`;
- exported OAuth refresh boundary types, Google/Yandex refresh factories, and
  refresh errors from `@searchlint/workers`;
- Google and Yandex refresh adapters now post refresh-token grant requests
  through injected fetch, parse refreshed access tokens, optional rotated
  refresh tokens, and optional expiry, and surface provider status/payload on
  failed refresh requests;
- the external observation Secrets Manager vault now supports
  `PutSecretValueCommand` writes for refreshed token values while preserving
  deterministic secret ref validation;
- external observation collection now refreshes configured provider tokens
  before provider collection, writes refreshed access tokens, writes rotated
  refresh tokens, persists refreshed connection metadata, and keeps the existing
  no-refresh access-token read path intact;
- the external observation collection process now supports optional Google and
  Yandex OAuth refresh client credential env wiring;
- focused workers validation passed: `@searchlint/workers` typecheck and 28 test
  files / 179 tests.

Completed 206 scope:

- added `plans/206_EXTERNAL_OBSERVATION_PROVIDER_COLLECTORS.md`;
- added `services/workers/src/external-observation-provider-collectors.ts`;
- exported provider collector factories, target resolver contracts, target
  config, and Google/Yandex target union types from `@searchlint/workers`;
- Google collector now calls the existing `@searchlint/api` Google provider
  adapter for URL Inspection, Search Analytics, and Sitemaps;
- Yandex collector now calls the existing `@searchlint/api` Yandex provider
  adapter for Webmaster URL status, Webmaster Sitemaps, and Metrica landing
  pages;
- external observation process env parsing now supports subject URLs, sitemap
  URLs, Google Search Analytics date range/dimensions, and Yandex Metrica
  counter/date range/metrics;
- default external-observation process collectors now use the provider adapters
  with injectable provider fetch;
- empty target config returns no observations without provider calls;
- added focused tests for target resolver output, Google/Yandex adapter routing,
  process env parsing, invalid date ranges, and default process collector
  wiring;
- full Node 24 validation passed: `pnpm format`, `pnpm lint`, `pnpm typecheck`,
  and `pnpm test`.

Completed 205 scope:

- added `plans/205_EXTERNAL_OBSERVATION_SECRETS_MANAGER_VAULT.md`;
- added `services/workers/src/secrets-manager-external-observation-vault.ts`;
- added `@aws-sdk/client-secrets-manager` to `@searchlint/workers`;
- exported `createSecretsManagerExternalObservationAccessTokenVault`,
  `createSearchLintSecretRefResolver`, and related public types from
  `@searchlint/workers`;
- SearchLint `secret://...` OAuth refs now map to AWS Secrets Manager `SecretId`
  values through a deterministic resolver;
- deployed secret-name prefixes are supported and duplicate slashes are
  normalized;
- missing, empty, unsupported, and binary-only token secrets fail with
  deterministic errors;
- the external observation collection process now uses the Secrets Manager
  access-token vault by default while still allowing tests and future live
  composition to inject a vault;
- focused workers validation passed: `@searchlint/workers` typecheck and 26 test
  files / 163 tests.

Completed 204 scope:

- added `plans/204_EXTERNAL_OBSERVATION_COLLECTION_PROCESS.md`;
- added `services/workers/src/external-observation-collection-process.ts`;
- added `services/workers/src/external-observation-collection-node.ts`;
- added `services/workers/src/external-observation-collection-bin.ts`;
- exported the external observation collection process factory, config parser,
  Node runner, and public types from `@searchlint/workers`;
- added the `searchlint-external-observation-worker` executable package bin;
- process env parsing now covers Postgres database URL, provider filter, poll
  interval, batch size, and shared OTLP runtime config;
- process wiring now connects PostgreSQL OAuth/external-observation stores,
  injected vault/collector factories, polling runtime, OTLP lifecycle, lifecycle
  logging, batch logging, and error logging;
- production log records now include external-observation selected, collected,
  stored, failed, and skipped counters;
- added focused tests for config parsing, invalid env, batch logging, lifecycle
  install, production log mapping, and Node runner success/failure;
- full Node 24 validation passed: `pnpm format`, `pnpm lint`, `pnpm typecheck`,
  and `pnpm test`.

Completed 170 scope:

- added `plans/170_DASHBOARD_BROWSER_SESSION_STORAGE_ADAPTER.md`;
- added dashboard auth session store contracts and browser storage-backed
  session store options;
- added a storage-backed current-session store factory for browser runtimes
  without adding a DOM global dependency;
- saved dashboard auth sessions now serialize under deterministic namespaced
  keys;
- loaded sessions are parsed, validated with the existing `DashboardAuthSession`
  rules, and cleaned up on corrupt JSON or invalid stored values;
- storage read, write, delete, and cleanup failures map to deterministic client
  errors;
- added tests for save/load/delete, key namespacing, corrupt JSON cleanup,
  invalid stored session cleanup, invalid namespace rejection, and storage
  failure mapping.

Completed 169 scope:

- added `plans/169_DASHBOARD_BROWSER_PKCE_STORAGE_ADAPTER.md`;
- added a minimal dashboard browser storage-like contract and PKCE storage
  adapter options;
- added a storage-backed `DashboardCognitoPendingAuthStore` factory for browser
  runtimes without adding a DOM global dependency;
- saved pending PKCE auth states now serialize under deterministic namespaced
  keys;
- loaded pending states are parsed, shape-validated, and cleaned up on corrupt
  JSON or invalid stored values;
- storage read, write, delete, and cleanup failures map to deterministic client
  errors;
- added tests for save/load/delete, key namespacing, corrupt JSON cleanup,
  invalid stored state cleanup, invalid namespace rejection, and storage failure
  mapping.

Completed 168 scope:

- added `plans/168_DASHBOARD_COGNITO_PKCE_PENDING_AUTH_LIFECYCLE.md`;
- added dashboard Cognito pending PKCE auth state and store contracts;
- auth start now stores state, nonce, code challenge, redirect URI, PKCE
  verifier, creation time, and expiry through an injected store;
- auth start returns the deterministic hosted UI authorization URL plus the
  stored pending state;
- callback consumption now loads pending state by callback `state`, validates
  expiry, parses the callback through the existing state validator, deletes the
  pending state, and returns a complete token exchange request with the
  preserved verifier;
- missing pending state, expired pending state, invalid TTL values, provider
  callback errors, and invalid loaded pending state fail deterministically;
- added tests for pending-state writes, invalid TTLs, successful callback
  consumption, missing state, expired state, provider-error cleanup, and token
  exchange request mapping.

Completed 167 scope:

- added `plans/167_DASHBOARD_COGNITO_TOKEN_EXCHANGE_CONTRACTS.md`;
- added dashboard Cognito token endpoint exchange request, fetch, response, and
  options contracts;
- token exchange now validates hosted UI domain, client ID, redirect URI,
  authorization code, and PKCE verifier before fetch execution;
- token requests use deterministic `/oauth2/token` POST forms with
  `grant_type=authorization_code`, `client_id`, `redirect_uri`, `code`, and
  `code_verifier`;
- successful Cognito responses are parsed into validated `DashboardAuthSession`
  values with injected-clock expiry;
- optional `id_token` and `refresh_token` values are preserved when present;
- provider errors, malformed JSON, malformed token responses, invalid bearer
  type, invalid expiry, and transport failures fail deterministically;
- added tests for request construction, validation failures, successful session
  mapping, provider errors, malformed responses, and transport failure mapping.

Completed 166 scope:

- added `plans/166_DASHBOARD_COGNITO_HOSTED_UI_PKCE_CONTRACTS.md`;
- added dashboard Cognito hosted UI config, auth request, pending state,
  callback input, and callback result contracts;
- authorization URL builder now emits deterministic authorization-code PKCE URLs
  with client ID, redirect URI, sorted/deduplicated scopes, state, nonce, code
  challenge, and `code_challenge_method=S256`;
- hosted UI domain, redirect URI, state, nonce, code challenge, and scopes are
  validated before URL construction;
- callback parser validates absolute callback URLs and expected state;
- successful callbacks return typed authorization-code results with optional
  issuer;
- provider errors, missing codes, invalid callback URLs, and state mismatches
  fail deterministically;
- added tests for URL construction, validation failures, successful callback
  parsing, state mismatch, provider errors, and missing-code callbacks.

Completed 165 scope:

- added `plans/165_DASHBOARD_SESSION_TOKEN_PROVIDER.md`;
- added dashboard Cognito/OIDC auth session contracts;
- added a session-backed access token provider compatible with dashboard
  authenticated fetch transport;
- token provider validates bearer token type, Cognito identity provider,
  non-empty access tokens, and positive epoch-second expiry;
- token provider enforces expiry with injected clock and configurable skew;
- expired sessions can use an injected refresh callback, while invalid or
  already expired refresh results fail deterministically;
- provider remains storage-free and framework-neutral;
- added tests for valid sessions, invalid sessions, expiry without refresh,
  refresh inside skew, refresh caching, invalid refresh results, and expired
  refresh results.

Completed 164 scope:

- added `plans/164_DASHBOARD_AUTHENTICATED_FETCH_TRANSPORT.md`;
- added a fetch-compatible authenticated dashboard API transport factory;
- the transport resolves bearer tokens from a string or async provider and
  rejects missing tokens before fetch execution;
- the transport builds absolute API URLs from configured base URL plus checked
  dashboard request paths;
- the transport sends JSON bodies, authorization, operation/action, API version,
  and schema-version headers;
- the transport normalizes JSON and text responses into the dashboard API
  response envelope;
- invalid base URLs and fetch failures map to deterministic dashboard client
  errors;
- added tests for authenticated request construction, schema headers, custom
  header precedence, text responses, missing token failures, invalid base URL
  failures, and fetch failure mapping.

Completed 163 scope:

- added `plans/163_DASHBOARD_API_CLIENT_CONTRACTS.md`;
- added dashboard API request and response envelope contracts;
- dashboard API requests are built from checked `/v1` cloud route contracts
  instead of copied endpoint strings;
- required dashboard path parameters are validated and URL-encoded before
  transport execution;
- create project, create environment, request crawl, and add member request
  bodies are validated before transport execution;
- added a Promise-based injected transport boundary and client wrapper for the
  current dashboard actions;
- added tests for route-derived request construction, schema version
  preservation, validation failures, transport invocation, and no-transport
  behavior after invalid input.

Completed 162 scope:

- added `plans/162_DASHBOARD_FOUNDATION_CONTRACTS.md`;
- added build/typecheck/test setup to `@searchlint/dashboard`;
- added typed dashboard snapshot contracts for organizations, projects,
  environments, diagnostics, crawl runs, trend points, Google/Yandex external
  observations, report summaries, quota usage, and team members;
- added deterministic dashboard summary derivation;
- dashboard action routes now reuse checked `/v1` cloud API route contracts;
- dashboard labels are routed through localizable message keys;
- added a deterministic accessible static HTML shell for overview, diagnostics,
  crawl history, trends, external observations, reports, and team sections;
- added tests for summary counts, route mapping, message key coverage,
  accessibility-oriented HTML structure, deterministic ordering, and HTML
  escaping;
- implementation-scope validation now includes `apps/dashboard/src` and
  `apps/dashboard/test`.

Completed 161 scope:

- added `plans/161_DSL_MIGRATE_CONFIG_CLI_COMMAND.md`;
- added public CLI parsing for
  `searchlint migrate-config --from 1 --to 1 --write <path>`;
- the command validates the target config through the shared SearchLint language
  parser and compiler before writing;
- the supported language-version `1 -> 1` path preserves file contents
  byte-for-byte, including comments, and writes a byte-for-byte `.bak` backup;
- unsupported source or target versions fail deterministically instead of
  inventing an unapproved future migration;
- Node CLI IO now supports filesystem writes for commands that mutate files;
- CLI usage docs, language spec, and ADR-0015 now document the approved
  language-version 1 migration behavior.

Completed 240 scope:

- added `plans/240_DSL_CONFIG_MIGRATION_AND_COMPATIBILITY_ACCEPTANCE.md`;
- added `pnpm dsl:acceptance`;
- added `scripts/verify-dsl-config-compatibility.mjs`;
- added `docs/DSL_CONFIG_COMPATIBILITY.md`;
- added `docs/DSL_MIGRATION_GUIDE.md`;
- added `docs/examples/dsl-config-compatibility-report.sample.json`;
- added starter templates in `docs/examples/config-templates/`;
- `searchlint migrate-config --from 1 --to 1 --write <path>` now writes a
  byte-for-byte `.bak` backup while preserving the primary file;
- the verifier generates `reports/dsl-config-compatibility-report.json` as
  ignored CI/artifact evidence.

Completed 160 scope:

- added `plans/160_CLOUDWATCH_OTLP_OBSERVABILITY_AWS_IAC_TEMPLATE.md`;
- added `infra/aws/observability-cloudwatch.cloudformation.json`;
- CloudWatch observability CloudFormation template provisions log groups for the
  Cloud API, crawler worker, and report artifact cleanup runtimes;
- log groups use a deployment-supplied KMS key and default to 30-day retention;
- template provisions metric filters and alarms for API 5xx responses, API
  timeouts, crawler failures, report artifact cleanup failures, and worker error
  records;
- template outputs log group names and alarm names for deployment/runbook use;
- `scripts/verify-aws-iac.mjs` now validates the observability stack alongside
  the other AWS templates.

Completed 159 scope:

- added `plans/159_KMS_SECRETS_MANAGER_VAULT_AWS_IAC_TEMPLATE.md`;
- added `infra/aws/secret-vault-kms.cloudformation.json`;
- KMS/Secrets Manager CloudFormation template provisions a customer-managed KMS
  key for SearchLint service secrets and future OAuth token envelope encryption;
- KMS key rotation is enabled and a stable `alias/searchlint/.../secrets` alias
  is declared;
- template provisions generated-placeholder Secrets Manager slots for
  `SEARCHLINT_STRIPE_WEBHOOK_SECRET` and `OTEL_EXPORTER_OTLP_HEADERS`;
- managed service secrets are encrypted with the SearchLint KMS key;
- Cloud API, crawler worker, and report artifact cleanup templates now accept an
  optional `OtelHeadersSecretArn` and inject `OTEL_EXPORTER_OTLP_HEADERS`
  through ECS container secrets rather than plaintext environment variables;
- template outputs the KMS key ARN, KMS alias name, Stripe webhook secret ARN,
  and OTLP headers secret ARN;
- `scripts/verify-aws-iac.mjs` now validates the KMS/Secrets Manager vault
  template and OTLP headers secret wiring alongside the other AWS templates.

Completed 158 scope:

- added `plans/158_S3_ARTIFACT_STORAGE_AWS_IAC_TEMPLATE.md`;
- added `infra/aws/artifact-storage-s3.cloudformation.json`;
- S3 artifact storage CloudFormation template provisions separate crawl and
  report artifact buckets;
- both buckets block public access, enforce bucket-owner object ownership,
  enable versioning, and configure server-side encryption;
- bucket policies deny non-TLS access;
- crawl artifacts under the configured prefix have lifecycle expiration;
- crawl artifact lifecycle expiration covers noncurrent versions under bucket
  versioning;
- crawler worker IAM allows KMS data-key generation for KMS-encrypted artifact
  writes;
- report artifacts intentionally avoid bucket lifecycle expiration so deletion
  remains governed by PostgreSQL metadata retention and the report artifact
  cleanup worker;
- template outputs crawl bucket name/ARN/key prefix and report bucket name/ARN
  for existing worker and cleanup stacks;
- `scripts/verify-aws-iac.mjs` now validates the S3 artifact storage
  CloudFormation template alongside the Cognito, RDS, Cloud API, crawler worker,
  and report artifact cleanup templates.

Completed 157 scope:

- added `plans/157_RDS_POSTGRES_AWS_IAC_TEMPLATE.md`;
- added `infra/aws/rds-postgres.cloudformation.json`;
- RDS PostgreSQL CloudFormation template provisions a private encrypted DB
  instance, DB subnet group, database security group, generated password secret,
  and PostgreSQL database URL secret;
- database security group allows inbound TCP 5432 only from the API and crawler
  worker ECS service security group IDs supplied by deployment;
- database URL secret is compatible with the Cloud API and worker
  `SEARCHLINT_POSTGRES_DATABASE_URL` runtime contract;
- template outputs the database URL secret ARN, endpoint address, endpoint port,
  database security group ID, and `PostgresSslMode=require`;
- `scripts/verify-aws-iac.mjs` now validates the RDS PostgreSQL CloudFormation
  template alongside the Cognito, Cloud API, crawler worker, and report artifact
  cleanup templates.

Completed 156 scope:

- added `plans/156_COGNITO_USER_POOL_AWS_IAC_AND_API_WIRING.md`;
- added `infra/aws/cognito-user-pool.cloudformation.json`;
- Cognito CloudFormation template provisions a user pool, API app client, and
  coarse platform-access group;
- user pool template uses email sign-in, verified email, minimum 12-character
  password policy with lowercase/uppercase/number/symbol requirements, optional
  MFA, and software-token MFA;
- API app client has `GenerateSecret: false`;
- Cognito template outputs issuer, audience/client ID, JWKS URL, and access
  token-use values for API runtime env wiring;
- Cloud API process now parses Cognito env and creates the remote JWKS-backed
  Cognito principal extractor by default;
- Cloud API ECS template now declares the Cognito env variables required by the
  API process;
- `scripts/verify-aws-iac.mjs` now validates the Cognito CloudFormation template
  and Cloud API Cognito env wiring.

Completed 155 scope:

- added `plans/155_CRAWLER_WORKER_AWS_IAC_TEMPLATE.md`;
- added `infra/aws/crawler-worker-ecs-fargate.cloudformation.json`;
- crawler worker CloudFormation template provisions a standard SQS crawl request
  queue, dead-letter queue, CloudWatch log group, ECS/Fargate task definition,
  private ECS service, service security group, task execution role, and task
  role;
- crawler worker container command is `node dist/src/bin.js`;
- crawler worker runtime environment includes SQS queue URL, crawl artifact S3
  bucket/prefix, PostgreSQL SSL mode, crawler polling settings, and OTLP
  variables;
- PostgreSQL database URL is injected through ECS container secrets rather than
  plaintext environment variables;
- worker task role allows SQS receive/delete/change-visibility/get-attributes
  and S3 artifact writes;
- `scripts/verify-aws-iac.mjs` now validates the crawler worker CloudFormation
  template alongside the Cloud API and cleanup templates.

Completed 113 scope:

- added crawl request lifecycle SQL contracts in
  `services/api/src/postgres-repository-sql.ts`;
- exported `markCrawlRequestRunningSql`, `markCrawlRequestSucceededSql`, and
  `markCrawlRequestFailedSql` from `@searchlint/api`;
- lifecycle SQL updates only active crawl requests in the expected prior state:
  queued to running, running to succeeded, and running to failed;
- added `services/workers/src/postgres-crawl-job-store.ts`;
- exported `createPostgresCloudCrawlTargetResolver` and
  `createPostgresCloudCrawlJobStore` from `@searchlint/workers`;
- target resolver reads active environment rows and returns `base_url` as the
  crawl target start URL;
- target resolver rejects project/environment mismatches before crawling;
- job store updates crawl request lifecycle status through the shared API SQL
  contracts;
- job store reports deterministic errors when lifecycle transitions update no
  row.

Completed 112 scope:

- added `services/workers/src/crawler-execution-worker.ts`;
- added `@searchlint/crawler` as a runtime dependency of `@searchlint/workers`;
- exported `executeCrawlRequestedJob` and crawler execution boundary types from
  `@searchlint/workers`;
- crawler jobs resolve their target URL and optional crawl settings through an
  injected resolver instead of reading URLs from queue payloads;
- execution enforces `CrawlJobPayload.maxUrls`;
- execution marks jobs running before invoking the crawler;
- execution calls the shared `@searchlint/crawler` pipeline;
- successful crawls are marked succeeded with the crawl result and completion
  time;
- missing targets, invalid payloads, and crawler failures are marked failed with
  deterministic error text;
- execution returns a deterministic summary for observability.

Completed 111 scope:

- added `services/workers/src/sqs-provisioning-contracts.ts`;
- exported `cloudWorkerSqsProvisioningContract` and
  `validateCloudWorkerSqsProvisioningContract` from `@searchlint/workers`;
- contract targets AWS SQS for the `searchlint-crawl-requests` standard queue;
- contract binds crawl queue URLs to `SEARCHLINT_CRAWL_QUEUE_URL`;
- contract defines `crawl.requested` as the only current message type;
- contract defines `searchlint-crawl-requests-dlq` redrive settings;
- contract defines queue visibility timeout, retention, long polling, and
  SQS-managed encryption expectations;
- contract defines least-privilege outbox-poller IAM permissions for
  `sqs:SendMessage` and `sqs:GetQueueAttributes` against the symbolic crawl
  queue ARN;
- validator rejects queue, DLQ, and IAM drift.

Completed 110 scope:

- added `services/workers/src/production-log-sink.ts`;
- exported `createOutboxWorkerProductionLogSink` and
  `outboxWorkerProductionLogRecord` from `@searchlint/workers`;
- lifecycle events map to JSON records with worker lifecycle state, shutdown
  signal, shutdown result, and error attributes;
- outbox polling batch results map to JSON records with selected, leased,
  published, failed, and skipped counters;
- runtime errors map to JSON records with error message and optional phase;
- sink writes JSON lines to stdout by default and can route error records to
  stderr;
- writer failures are isolated from worker polling and shutdown paths.

Completed 109 scope:

- added `services/workers/src/deployment-contracts.ts`;
- exported `cloudWorkerDeploymentContract` and
  `validateCloudWorkerDeploymentContract` from `@searchlint/workers`;
- worker deployment contract pins AWS ECS/Fargate, Node.js 24,
  `@searchlint/workers`, and the outbox polling runtime kind;
- contract requires `SIGTERM`/`SIGINT` handling, positive poll interval, and
  positive batch size;
- contract declares AWS SQS, `crawl.requested` messages, FIFO support,
  `SEARCHLINT_CRAWL_QUEUE_URL`, and required DLQ configuration;
- contract declares PostgreSQL env prefix and requires
  `SEARCHLINT_POSTGRES_DATABASE_URL` from AWS Secrets Manager plus
  `SEARCHLINT_POSTGRES_SSL_MODE`;
- contract requires structured worker logs to AWS CloudWatch;
- validator rejects runtime, queue, observability, and environment drift.

Completed 108 scope:

- added `services/workers/src/worker-lifecycle.ts`;
- exported `createOutboxWorkerRuntime`, `installOutboxWorkerShutdownSignals`,
  `installOutboxWorkerEcsTaskLifecycle`, and
  `installOutboxWorkerProcessExitPolicy` from `@searchlint/workers`;
- worker runtime wrapper starts and stops the wrapped outbox polling runtime;
- shutdown signal binding registers `SIGTERM` and `SIGINT`, removes listeners on
  first shutdown, reuses duplicate signal shutdowns, and preserves shutdown
  errors;
- ECS lifecycle helper reports `ready`, `draining`, `stopped`, and `failed`
  states;
- process exit policy maps successful shutdown to exit code `0` and failed
  shutdown to exit code `1` through an injectable sink without calling
  `process.exit()`.

Completed 107 scope:

- added `createPostgresOutboxDispatchStore` in
  `services/workers/src/postgres-outbox-dispatch-store.ts`;
- exported the PostgreSQL dispatch store adapter from `@searchlint/workers`;
- adapter uses `selectPendingOutboxEventsSql`, `markOutboxEventProcessingSql`,
  `markOutboxEventPublishedSql`, and `markOutboxEventFailedSql` from
  `@searchlint/api`;
- adapter uses the shared `PostgresQueryExecutor` boundary instead of importing
  a database client;
- selected rows map to the shared `CloudOutboxEvent` contract;
- transition queries return `undefined` when PostgreSQL returns no row;
- malformed outbox rows are rejected deterministically before dispatch can
  publish invalid work.

Completed 106 scope:

- added `createOutboxPollingRuntime` in `services/workers/src/index.ts`;
- exported polling runtime lifecycle and sleep types from `@searchlint/workers`;
- runtime reuses `dispatchOutboxBatch` and does not duplicate outbox dispatch
  logic;
- runtime exposes `start`, `stop`, `done`, and `isRunning`;
- runtime polls sequentially, waits the configured interval between polls, and
  uses abortable sleep for clean stop behavior;
- `stop` waits for the current dispatch to finish;
- batch results and runtime errors are observable through callbacks;
- dispatch errors continue polling by default and can stop the runtime with
  `stopOnError: true`.

Completed 105 scope:

- added `DistributedRateLimitStore` and `createMemoryDistributedRateLimitStore`
  in `services/api/src/distributed-rate-limit.ts`;
- exported distributed rate-limit types and memory store from `@searchlint/api`;
- `NodeHttpRateLimitOptions` now supports an injected distributed store and
  clock;
- distributed decisions run before body parsing or application dispatch;
- denied distributed decisions return HTTP `429` and preserve request log
  `rateLimited: true`.

Completed 104 scope:

- added `createNodeHttpProductionLogSink` and `nodeHttpProductionLogRecord` in
  `services/api/src/production-log-sink.ts`;
- exported production log sink helper and types from `@searchlint/api`;
- request logs map to stable OpenTelemetry-shaped JSON records with service,
  event, severity, request, HTTP, and SearchLint attributes;
- JSON-line output writes through injected stdout/stderr writers;
- error records can route to stderr;
- writer failures are isolated from request handling.

Completed 103 scope:

- added `installNodeHttpProcessExitPolicy` in
  `services/api/src/node-http-server.ts`;
- exported process exit policy helper and types from `@searchlint/api`;
- graceful shutdown sets exit code `0`;
- forced shutdown and failed shutdown set exit code `1`;
- custom success, forced, and failure exit codes are supported;
- exit code assignment goes through an injectable sink and does not call
  `process.exit()`.

Completed 102 scope:

- added `installNodeHttpEcsTaskLifecycle` in
  `services/api/src/node-http-server.ts`;
- exported lifecycle helper and event/state types from `@searchlint/api`;
- lifecycle state starts as `ready`, moves to `draining` on the first shutdown
  signal, then moves to `stopped` or `failed` when shutdown resolves or rejects;
- duplicate signals reuse the existing shutdown promise and do not emit
  duplicate lifecycle transitions;
- uninstall removes signal listeners without triggering shutdown.

In-progress 101 scope:

- added an opt-in PostgreSQL-backed authorization matrix acceptance test in
  `services/api/test/postgres-integration.test.ts`;
- the test applies current migrations, builds the API on PostgreSQL-backed
  relational/audit/metrics/outbox ports, and covers `addMember`,
  `createProject`, `createEnvironment`, and `requestCrawl`;
- forbidden calls are expected to fail with `FORBIDDEN` and leave persisted
  side-effect counts unchanged;
- local `pnpm verify:postgres` did not run because Docker daemon is unavailable
  and no test database URL is configured.

Completed 100 scope:

- added table-driven authorization matrix tests in
  `services/api/test/api.test.ts`;
- covered `addMember`, `createProject`, `createEnvironment`, and `requestCrawl`;
- allowed roles are derived from `permissionsByRole` and verified to succeed;
- forbidden roles are verified to fail with `FORBIDDEN`;
- forbidden calls are verified to leave audit events, metrics, queues,
  memberships, projects, environments, and crawl requests unchanged.

Completed 099 scope:

- added route-level Cognito acceptance tests in
  `services/api/test/node-http-server.test.ts`;
- valid signed Cognito/OIDC bearer tokens now prove the full path from
  `Authorization` header to `Principal` to dispatcher to application actor;
- missing bearer credentials return the existing deterministic
  `401 UNAUTHENTICATED` response;
- invalid bearer credentials return the existing deterministic
  `401 UNAUTHENTICATED` response before application dispatch.

Completed 098 scope:

- added `createRemoteJwksProvider` to `services/api/src/cognito-auth.ts`;
- exported remote JWKS provider types and factory from `@searchlint/api`;
- remote provider requires HTTPS JWKS URLs;
- remote provider uses an injected fetch boundary and validates JWKS shape
  before caching;
- remote provider reuses cached keys before TTL expiry, refreshes after TTL
  expiry, shares in-flight fetches, times out stalled fetches, and falls back to
  the last cached JWKS after transient refresh failures;
- added deterministic unit tests for cache, refresh, timeout, invalid response,
  stale-cache fallback, and verifier wiring.

Completed 097 scope:

- added `services/api/src/cognito-auth.ts`;
- exported `verifyCognitoJwt` and `createCognitoPrincipalExtractor` from
  `@searchlint/api`;
- verifier validates JWT shape, RS256 algorithm, key ID, RSA signature, issuer,
  audience/client ID, token use, expiration, not-before time, and subject;
- Node HTTP principal extractor reads `Authorization: Bearer ...` and maps valid
  Cognito/OIDC tokens into the existing `Principal` contract;
- invalid or missing credentials return no principal so the existing dispatcher
  continues to produce deterministic `401` responses;
- added deterministic unit tests with generated RSA/JWKS fixtures.

Completed 096 scope:

- added `services/api/src/deployment-contracts.ts`;
- exported `cloudApiDeploymentContract` and `validateCloudApiDeploymentContract`
  from `@searchlint/api`;
- default contract targets AWS API Gateway HTTP API, ECS/Fargate, Node.js 24,
  the built-in `node:http` adapter, `/healthz`, `SIGTERM`/`SIGINT`, structured
  request logs, and current `/v1` route contracts;
- validator rejects runtime, route, health check, shutdown signal, container
  port, and PostgreSQL env drift;
- added unit tests for the default deployment contract and invalid drift.

Completed 095 scope:

- added `scripts/verify-postgres-service.mjs`;
- added root command `pnpm verify:postgres`;
- verifier uses `SEARCHLINT_POSTGRES_TEST_DATABASE_URL` when provided;
- verifier starts a temporary local Docker PostgreSQL container when no database
  URL is provided;
- verifier waits for readiness, runs the existing API PostgreSQL integration
  test, and cleans up temporary containers;
- added a GitHub Actions PostgreSQL service-container job that runs
  `pnpm verify:postgres`;
- kept default `pnpm test` external-service-free;
- local `pnpm verify:postgres` was attempted in this checkout and failed because
  Docker daemon is unavailable and no test database URL is configured.
