# Blocker Benchmark Review Packet

Status date: 2026-06-23

This packet supports the OD-023 independent review requirement for the
SearchLint blocker precision benchmark.

Codex-generated evidence is not an independent reviewer sign-off. The benchmark
release gate can pass only after two real independent reviewer files are
provided and verified.

## Blocker Rules Under Review

The benchmark covers the 14 catalog-default blocker rules:

- `SL-HTTP-001`
- `SL-HTTP-003`
- `SL-HTTP-005`
- `SL-HTTP-006`
- `SL-INDEX-001`
- `SL-INDEX-002`
- `SL-INDEX-003`
- `SL-INDEX-004`
- `SL-INDEX-007`
- `SL-INDEX-008`
- `SL-META-001`
- `SL-META-002`
- `SL-CANON-002`
- `SL-CANON-008`

## Review Inputs

Generated benchmark artifact:

- `reports/blocker-precision-report.json`

Handoff artifacts generated from the benchmark:

- `docs/reviews/blocker-benchmark/HANDOFF_MANIFEST.json`
- `docs/reviews/blocker-benchmark/BENCHMARK_CASE_INDEX.json`

The handoff manifest records the benchmark version, 14 blocker rule IDs, 1,960
case count, required packet files, expected reviewer output paths, and owner
next actions. The case index lists every benchmark case ID exactly once for
reviewer tracking.

Reviewer files expected from the project owner:

- `docs/reviews/blocker-benchmark/reviewer-1.review.json`
- `docs/reviews/blocker-benchmark/reviewer-2.review.json`

Owner delivery evidence expected before claiming the packet was sent:

- `docs/reviews/blocker-benchmark/DELIVERY_EVIDENCE.json`

Templates:

- `docs/reviews/blocker-benchmark/reviewer-1.review.example.json`
- `docs/reviews/blocker-benchmark/reviewer-2.review.example.json`
- `docs/reviews/blocker-benchmark/DELIVERY_EVIDENCE.example.json`

Example files do not count as sign-off.

## Review Outcome

To verify the packet is handoff-ready without claiming reviewer approval, run:

```bash
pnpm rule-qa:review-handoff
```

The command regenerates the manifest, case index, generated report, and
sanitized sample. It does not create reviewer files and does not prove delivery
to reviewers.

To verify owner-provided packet delivery evidence, run:

```bash
pnpm rule-qa:review-delivery
```

The command validates `DELIVERY_EVIDENCE.json` against the handoff manifest,
case index SHA-256, required packet files, two intended reviewers, delivery
timestamp, channel, and owner attestation. It is expected to fail until the
project owner provides real delivery evidence.

Run:

```bash
pnpm rule-qa:review
```

The command regenerates blocker QA evidence, validates reviewer files, writes an
adjudication summary, and enforces the OD-023 blocker precision release gate.

Until real reviewer files exist, the expected result is failure with a clear
missing-reviewer message.
