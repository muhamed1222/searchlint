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

- `@searchlint/cli@1.0.0-beta.8` and `@searchlint/next@1.0.0-beta.6` are the
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
  `@searchlint/core@1.0.0-beta.2`, `@searchlint/browser@1.0.0-beta.1`,
  `@searchlint/overlay@1.0.0-beta.5`, `@searchlint/next@1.0.0-beta.7`, and
  `@searchlint/cli@1.0.0-beta.9`.
- Reinstalling `@searchlint/cli@beta` and `@searchlint/next@beta` in the
  Outlivion test site from npm preserved the improved `SL-IMG-007` evidence.

## Validation

- `pnpm --filter @searchlint/core typecheck`
- `pnpm --filter @searchlint/core test`
- `pnpm --filter @searchlint/cli test`
- `pnpm --filter @searchlint/next test`
- `pnpm --filter @searchlint/overlay test`

## Decision Log

- This plan treats Outlivion pages as acceptance evidence only. SEO fixes to
  Outlivion are out of scope.
