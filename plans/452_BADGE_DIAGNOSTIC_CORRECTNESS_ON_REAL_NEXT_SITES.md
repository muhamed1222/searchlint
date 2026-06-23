# ExecPlan 452: Badge Diagnostic Correctness On Real Next Sites

## Purpose

Verify that the local developer SearchLint badge is not only injected into a
Next.js dev site, but also reports truthful diagnostics on real rendered pages.

This plan is limited to the local developer product:

- `@searchlint/cli`
- `@searchlint/next`
- `@searchlint/overlay`
- shared browser/core diagnostic execution used by the badge

Outlivion is used only as a real Next.js test site. Do not change Outlivion
product code while executing this plan.

## Non-goals

- Do not start cloud, backend, dashboard, billing, Google/Yandex, VS Code
  publication, or repository split work.
- Do not fix SEO issues in the tested websites.
- Do not treat crawl/scan reports as the primary product path for this plan.
- Do not add new SEO rules unless a correctness defect proves an existing rule
  cannot express the observed behavior.

## Acceptance Criteria

- A real Next.js project can install beta packages, run `npx searchlint init`,
  and start local dev without manual config edits.
- The badge appears in development and does not require changes to the tested
  site source.
- The badge opens and closes reliably.
- For sampled real pages, each visible diagnostic is classified as one of:
  - true positive;
  - false positive;
  - unclear/needs rule wording;
  - runtime/overlay defect.
- False positives and runtime/overlay defects are fixed in SearchLint, not in
  the tested site.
- No production behavior is introduced or changed.
- Tests cover any deterministic overlay, Next integration, or rule behavior
  changed by this plan.

## Test Pages

Initial real-site acceptance pages:

- `http://localhost:3001/`
- `http://localhost:3001/blog`
- `http://localhost:3001/pricing`
- `http://localhost:3001/locations/germany-vpn`

## Progress

- [x] Owner selected real Next.js test site: Outlivion local dev.
- [x] Node 24 installed locally for package/runtime compatibility.
- [x] npm beta blocker for `next.config.ts` was fixed and published.
- [x] Local checkout synced with the published beta fix.
- [x] Badge presence verified on the sampled pages.
- [x] Overlay open/close behavior verified.
- [x] Visible diagnostics classified for sampled pages.
- [x] SearchLint defects fixed or recorded.
- [x] Validation commands run.

## Evidence Log

- `@searchlint/cli@1.0.0-beta.25` and `@searchlint/next@1.0.0-beta.11` are the
  current beta packages for the zero-manual-edit Next.js init path.
- `http://localhost:3001/blog` rendered the badge with `SearchLint info: 2`. The
  two diagnostics were `SL-HEAD-005` and `SL-META-009`, both heuristic
  info-level notes.
- `http://localhost:3001/` rendered the badge with `SearchLint warnings: 2`. The
  diagnostics were `SL-IMG-007` and `SL-META-009`.
- `http://localhost:3001/pricing` and
  `http://localhost:3001/locations/germany-vpn` rendered clean states with no
  diagnostics.
- Opening the badge panel set `aria-expanded="true"` and closing it through the
  icon button returned `aria-expanded="false"`.
- `SL-IMG-007` was a true-positive class on Outlivion because rendered images
  with `alt=""` exist, but the original evidence was too generic to identify the
  image. This plan improved image alt diagnostics to include image index, `src`,
  expected/actual values, runtime selector, and structured evidence.
- The improved local developer chain was published to npm with tag `beta`:
  `@searchlint/core@1.0.0-beta.4`, `@searchlint/browser@1.0.0-beta.3`,
  `@searchlint/overlay@1.0.0-beta.9`, `@searchlint/next@1.0.0-beta.11`, and
  `@searchlint/cli@1.0.0-beta.22`.
- Reinstalling `@searchlint/cli@beta` and `@searchlint/next@beta` in the
  Outlivion test site from npm preserved the improved `SL-IMG-007` evidence.
- `SL-META-009` now tolerates minor title-length overage up to 65 characters so
  the badge does not report 61-character titles as actionable guidance.
- `SL-HEAD-005` now tokenizes title and H1 text with Unicode-aware meaningful
  terms and records normalized token evidence.
- After installing `@searchlint/cli@1.0.0-beta.10` and
  `@searchlint/next@1.0.0-beta.11` from npm in the Outlivion test site, the Next
  badge path used `@searchlint/core@1.0.0-beta.4`.
- Playwright verification on `http://localhost:3000/blog` showed
  `SearchLint info: 1`; the former 61-character `SL-META-009` note was gone and
  the remaining `SL-HEAD-005` note showed the improved expected/actual wording.
- Playwright verification on `http://localhost:3000/pricing` and
  `http://localhost:3000/locations/germany-vpn` showed `SearchLint clean`.
- A fresh `create-next-app` TypeScript project installed `@searchlint/cli@beta`
  and `@searchlint/next@beta`, then `npx searchlint init` created
  `searchlint.seo` and patched `next.config.ts` without manual edits.
- The fresh smoke project rendered `searchlint-dev-overlay` at
  `http://localhost:3010` with the badge visible.
- `@searchlint/cli@1.0.0-beta.11` extended `searchlint doctor` with local
  project status: `package.json found`, `searchlint.seo found`, and
  `next.config.ts uses withSearchLint`.
- `@searchlint/cli@1.0.0-beta.12` adds `npm run searchlint:verify` during
  `searchlint init`. The script runs `searchlint doctor` and
  `searchlint config validate --config searchlint.seo`.
- Fresh `create-next-app` smoke verification confirmed that
  `npm run searchlint:verify` passes after `npx searchlint init`.
- `@searchlint/cli@1.0.0-beta.13` adds `searchlint init --site <url>` and
  `searchlint init --print-config --site <url>` so agency projects can create a
  site-specific `searchlint.seo` without manual editing.
- Fresh `create-next-app` smoke verification confirmed that
  `npx searchlint init --site https://client.example` writes that exact site URL
  and `npm run searchlint:verify` passes.
- `@searchlint/cli@1.0.0-beta.14` makes `searchlint init` add `@searchlint/cli`
  and `@searchlint/next` to `devDependencies` when missing. Existing SearchLint
  package versions are preserved.
- Fresh npx-style smoke verification confirmed this flow:
  `npx -y @searchlint/cli@beta init --site https://client.example`, then
  `npm install`, then `npm run searchlint:verify`.
- `@searchlint/cli@1.0.0-beta.15` updates `searchlint init` next-step output to
  include `npm install` only when the command added missing SearchLint
  dependencies. Fresh npx-style smoke verification confirmed the output order:
  `npm install`, `npm run searchlint:verify`, `npm run dev`.
- `@searchlint/cli@1.0.0-beta.16` makes `searchlint init` next-step output
  package-manager aware using `packageManager`, `pnpm-lock.yaml`, or
  `yarn.lock`. Smoke verification confirmed pnpm output: `pnpm install`,
  `pnpm searchlint:verify`, `pnpm dev`.
- `@searchlint/cli@1.0.0-beta.17` infers the starter `site` from an absolute
  `package.json` `homepage` URL when `--site` is not provided. Smoke
  verification confirmed `site "https://homepage.example"` output.
- `@searchlint/cli@1.0.0-beta.18` prints the resolved starter site and source in
  init output, for example `Site: https://client.example (--site)`. Smoke
  verification confirmed the summary line.
- `@searchlint/cli@1.0.0-beta.22` accepts the equals-form site option,
  `searchlint init --site=https://client.example`, and the positional fallback
  `searchlint init https://client.example` for package-manager argument
  forwarding.
- `@searchlint/cli@1.0.0-beta.23` adds `searchlint init --upgrade` for projects
  that already installed an older SearchLint beta. Normal init remains
  conservative and preserves existing SearchLint package versions; the upgrade
  flag rewrites existing `@searchlint/cli` and `@searchlint/next` ranges to the
  `beta` dist-tag and prints the package-manager install command.
- `@searchlint/cli@1.0.0-beta.25` changes `searchlint init --upgrade` to write
  exact tested beta versions for `searchlint`, `@searchlint/cli`, and
  `@searchlint/next`, because npm lockfiles can keep older beta versions when
  the dependency specifier is only `beta`.
- `searchlint@1.0.0-beta.25` is an unscoped npm wrapper around
  `@searchlint/cli`, so local onboarding can use
  `npx -y searchlint init --site=https://example.com` while preserving the
  scoped package as the implementation package. The npm `latest` and `beta`
  dist-tags both point at `searchlint@1.0.0-beta.25`.
- `@searchlint/overlay@1.0.0-beta.9` adds machine-readable diagnostic card
  attributes (`data-searchlint-rule-id`, severity, category, and source) so
  real-site smoke tests can verify the exact visible rule IDs without parsing
  human text.
- A second real Next.js 16 project, `vpn-tg-app`, was smoke-tested from a
  temporary copy at `http://localhost:3010`.
  `npx searchlint init --site=https://outlivion.space` patched `next.config.ts`,
  `npm run searchlint:verify` passed, and the browser rendered
  `searchlint-dev-overlay` without client errors.
- The `vpn-tg-app` smoke exposed an `SL-IMG-007` false positive for a decorative
  Next optimized image source ending in `shell-bg.png` with `alt=""`.
  `SL-IMG-007` now ignores explicitly decorative empty-alt images
  (`aria-hidden`, `role=presentation|none`, decorative data attributes) and
  obvious decorative asset filenames, including Next optimizer `url=...`
  sources.
- Re-running `vpn-tg-app` from npm-published packages
  (`@searchlint/cli@1.0.0-beta.22`, `@searchlint/next@1.0.0-beta.11`,
  `@searchlint/overlay@1.0.0-beta.9`, `@searchlint/core@1.0.0-beta.4`) rendered
  `searchlint-dev-overlay` at `http://localhost:3012/` with no client errors.
  The badge reported `SearchLint issues: 3`, and the diagnostics were
  `SL-CANON-001`, `SL-IMG-001`, and `SL-IMG-004`; `SL-IMG-007` was absent.
- Mixed-severity badge text now uses `issues` instead of reporting the total as
  the highest severity. For example, one error plus one warning plus one note
  renders as `3 issues`, not `3 errors`.
- A third real Next.js 16 project, `tropa_nartov_web`, was smoke-tested from a
  temporary copy at `http://localhost:3013`. The published packages
  `@searchlint/cli@1.0.0-beta.22` and `@searchlint/next@1.0.0-beta.11` patched
  `next.config.ts`, `npm run searchlint:verify` passed, and the browser rendered
  `searchlint-dev-overlay` with no client errors.
- The `tropa_nartov_web` smoke rendered `SearchLint issues: 13`. The visible
  diagnostics included canonical/social metadata gaps, multiple H1/heading
  structure notes, placeholder `href="#"`, and an icon-only social link without
  accessible text. Manual DOM inspection showed these link diagnostics are real
  page issues rather than SearchLint false positives.
- For multi-project local smoke tests, use `PORT=<port> npm run dev` or
  `PORT=<port> pnpm dev`. Passing `-- -p <port>` through an already patched
  `next dev --webpack` script can be interpreted by Next as a project directory.
- A fourth real Next.js 16 project, `ag-detail`, was smoke-tested from a
  temporary copy. With the correct site value, `site "https://ag-detail.ru"`,
  `npx searchlint init --site=https://ag-detail.ru` patched `next.config.ts`,
  `npm run searchlint:verify` passed, and `PORT=3015 npm run dev` rendered
  `searchlint-dev-overlay` with no SearchLint runtime errors.
- The `ag-detail` smoke rendered `SearchLint issues: 3`: `SL-IMG-007` for
  `/assets/link-arrow.svg` with `alt=""`, `SL-LINK-007` for an icon/link without
  accessible text, and `SL-META-009` for a 77-character title. Canonical
  host/scheme diagnostics were absent when `searchlint.seo` used the real
  production site URL.
- A control `ag-detail` smoke using the wrong site value
  `https://ag-detail.example` produced canonical host/scheme diagnostics against
  localhost. This confirmed that the local canonical suppressor depends on the
  configured `site` matching the production canonical host.
- `@searchlint/core@1.0.0-beta.5` suppresses `SL-IMG-007` for empty-alt
  duplicate image sources when another copy of the same normalized source is
  already described with a non-empty `alt` on the rendered page. This keeps
  unique content images actionable while avoiding duplicate logo/watermark
  noise on real Next pages, including Next optimizer `/_next/image?url=...`
  sources.
- The fix was published through the local developer beta chain:
  `@searchlint/browser@1.0.0-beta.4`, `@searchlint/next@1.0.0-beta.12`,
  `@searchlint/cli@1.0.0-beta.26`, and `searchlint@1.0.0-beta.26`. The
  unscoped `searchlint` npm `latest` and `beta` dist-tags both point to
  `1.0.0-beta.26`.
- Outlivion was upgraded through the public npm path with
  `npm exec --package=searchlint@latest -- searchlint init --upgrade
  --site=https://outlivion.space`, followed by `npm install` and
  `npm run searchlint:verify`. The local project reported
  `searchlint 1.0.0-beta.26`, `@searchlint/next@1.0.0-beta.12`, and
  `@searchlint/core@1.0.0-beta.5`.
- After restarting the Outlivion Next dev server, Playwright smoke checks on
  `/`, `/blog`, `/pricing`, and `/locations/germany-vpn` confirmed the overlay
  host attaches, the badge opens (`aria-expanded="false" -> "true"`), and no
  console errors were emitted. The duplicate empty-alt logo no longer triggers
  `SL-IMG-007`; the remaining homepage `SL-IMG-007` points to the unique
  rendered image source `/_next/image?url=%2Ftrust-vpn-route.png...`, which is
  still an actionable empty-alt content/decorative-classification issue for the
  tested site rather than a duplicate-logo false positive.

## Validation

- `pnpm --filter @searchlint/core typecheck`
- `pnpm --filter @searchlint/core test`
- `pnpm --filter @searchlint/browser typecheck`
- `pnpm --filter @searchlint/browser test`
- `pnpm --filter @searchlint/cli test`
- `pnpm --filter @searchlint/cli typecheck`
- `pnpm --filter searchlint typecheck`
- `pnpm --filter searchlint build`
- `pnpm --filter @searchlint/next typecheck`
- `pnpm --filter @searchlint/next test`
- `node scripts/verify-package-release.mjs`
- `pnpm --filter @searchlint/overlay test`
- `pnpm pack` for `packages/core`, `packages/browser`, `packages/overlay`,
  `packages/next`, and `packages/cli`

## Decision Log

- This plan treats Outlivion pages as acceptance evidence only. SEO fixes to
  Outlivion are out of scope.
