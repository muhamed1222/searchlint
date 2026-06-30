# Reviewer Rule Quality Owner Input Guide

Generated at: 2026-06-23T00:00:00.000Z

This guide covers the first critical-path owner evidence package:
`01-reviewer-rule-quality` (Reviewer And Rule Quality). It is a completion guide
only; it does not create or imply reviewer sign-off.

## Current Status

- status: `owner_input_required`
- missing required inputs: 3/3
- benchmark version: `0.1.0-synthetic`
- benchmark cases: 1960 (560 positive, 1400 negative)
- case index SHA-256:
  `7fbf01dcd80aaa2517a2ad25d8d8388935ff64c83a30c596692055305ede8357`

## Required Inputs

| Required file                                           | Owner                  | Template                                                        | Validation                     | Status    |
| ------------------------------------------------------- | ---------------------- | --------------------------------------------------------------- | ------------------------------ | --------- |
| `docs/reviews/blocker-benchmark/DELIVERY_EVIDENCE.json` | project owner          | `docs/reviews/blocker-benchmark/DELIVERY_EVIDENCE.example.json` | `pnpm rule-qa:review-delivery` | `missing` |
| `docs/reviews/blocker-benchmark/reviewer-1.review.json` | independent reviewer 1 | `docs/reviews/blocker-benchmark/reviewer-1.review.example.json` | `pnpm rule-qa:review`          | `missing` |
| `docs/reviews/blocker-benchmark/reviewer-2.review.json` | independent reviewer 2 | `docs/reviews/blocker-benchmark/reviewer-2.review.example.json` | `pnpm rule-qa:review`          | `missing` |

## Required Packet Files

- `docs/reviews/blocker-benchmark/HANDOFF_MANIFEST.json`
- `docs/reviews/blocker-benchmark/BENCHMARK_CASE_INDEX.json`
- `docs/reviews/blocker-benchmark/README.md`
- `docs/reviews/blocker-benchmark/REVIEW_INSTRUCTIONS.md`
- `docs/reviews/blocker-benchmark/REVIEW_FORM_TEMPLATE.md`
- `docs/reviews/blocker-benchmark/ADJUDICATION_LOG.md`
- `docs/reviews/blocker-benchmark/REVIEW_STATUS.md`
- `docs/reviews/blocker-benchmark/reviewer-1.review.example.json`
- `docs/reviews/blocker-benchmark/reviewer-2.review.example.json`

## Blocker Rules Under Review

`SL-CANON-002`, `SL-CANON-008`, `SL-HTTP-001`, `SL-HTTP-003`, `SL-HTTP-005`,
`SL-HTTP-006`, `SL-INDEX-001`, `SL-INDEX-002`, `SL-INDEX-003`, `SL-INDEX-004`,
`SL-INDEX-007`, `SL-INDEX-008`, `SL-META-001`, `SL-META-002`

## Owner Procedure

- Run pnpm release:reviewer-rule-quality-owner-guide to refresh this guide.
- Send every required packet file to two independent reviewers.
- Create DELIVERY_EVIDENCE.json from its example template using real delivery
  details.
- Replace default deliveryChannel, reviewerDisplayName, independenceStatement,
  and ownerAttestation.signedStatement values.
- Collect reviewer-1.review.json and reviewer-2.review.json from the independent
  reviewers.
- Do not copy example signedStatement values into real evidence.
- Run pnpm rule-qa:review-delivery and pnpm rule-qa:review.
- Resolve rejected, disputed, or conflicting cases before claiming OD-023
  complete.
- Run pnpm release:reviewer-rule-quality-package and pnpm
  release:evidence-readiness.

## Reviewer Procedure

- Use BENCHMARK_CASE_INDEX.json as the review case list.
- Do not use training fixtures as the basis for approval.
- Put every reviewed case ID in exactly one of approvedCaseIds, rejectedCaseIds,
  or disputedCaseIds.
- Set reviewedCaseCount to the full expected case count.
- Use the current benchmarkVersion from the handoff manifest.
- Write a real signedStatement that does not contain example-only language.

## Validation Commands

- `pnpm rule-qa:review-delivery`
- `pnpm rule-qa:review`
- `pnpm release:reviewer-rule-quality-package`
- `pnpm release:evidence-readiness`

## Non-Claims

- This guide does not create delivery evidence.
- This guide does not create reviewer sign-off.
- Example JSON files are templates only.
- Codex is not an independent reviewer for OD-023.
- SearchLint 1.0 remains blocked while owner/reviewer inputs are missing.
