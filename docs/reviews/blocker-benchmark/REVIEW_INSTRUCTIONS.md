# Blocker Benchmark Review Instructions

## Reviewer Role

Reviewers independently confirm expected blocker benchmark outcomes. Reviewers
must not be the engineer who implemented the rule, authored the benchmark
fixture, or adjusted the expected result being reviewed.

Do not use training fixtures or implementation-tuning fixtures when making a
release approval decision.

## Confusion Matrix Terms

- `TP`: true positive. SearchLint emits the blocker diagnostic when the expected
  result is `trigger`.
- `FP`: false positive. SearchLint emits the blocker diagnostic when the
  expected result is `no-trigger`.
- `FN`: false negative. SearchLint does not emit the blocker diagnostic when the
  expected result is `trigger`.
- `TN`: true negative. SearchLint does not emit the blocker diagnostic when the
  expected result is `no-trigger`.

## How To Read Cases

The adjudication verifier expands benchmark units from
`reports/blocker-precision-report.json`.

Case IDs have this deterministic shape:

```text
<ruleId>:positive:<fixtureId>:<unitNumber>
<ruleId>:negative:<fixtureId>:<unitNumber>
```

Examples:

```text
SL-HTTP-001:positive:positive-http-index:001
SL-HTTP-001:negative:negative-no-evidence:001
```

Positive case IDs represent expected `trigger` outcomes. Negative case IDs
represent expected `no-trigger` outcomes.

## Review Actions

For every case ID, choose exactly one outcome:

- approve: expected result and evidence requirement are correct;
- reject: expected result is wrong and must be changed;
- dispute: more information or adjudication is required.

A case must not appear in more than one list.

## Approve Criteria

Approve only when:

- the case belongs to the declared benchmark version;
- the rule ID is one of the 14 blocker rules;
- the expected `trigger` or `no-trigger` label is correct;
- required evidence is reviewable for trigger cases;
- the case does not depend on training fixtures;
- the fixture contains no personal data, secrets, OAuth tokens, API keys,
  private URLs, raw customer payloads, or database connection strings.

## Reject Criteria

Reject when:

- expected result is wrong;
- evidence is insufficient or misleading;
- the case appears to be a training fixture;
- the case includes sensitive or non-reviewable data;
- the case belongs to the wrong rule or benchmark version.

## Disputed Cases

Use `disputedCaseIds` when reviewer judgment cannot be completed.

Disputed cases block OD-023 release acceptance until adjudicated. The
adjudication decision must be recorded in `ADJUDICATION_LOG.md` and in the
machine-readable adjudication summary produced by `pnpm rule-qa:review`.

## Sign-Off

Reviewer sign-off is recorded in the review JSON file with:

- reviewer identity fields;
- benchmark version;
- reviewed case count;
- approved/rejected/disputed case IDs;
- comments;
- signed statement.

The `signedStatement` must explicitly state that the reviewer independently
reviewed the expected results and did not use training fixtures.
