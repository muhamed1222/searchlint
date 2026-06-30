# Review Form Template

Use this checklist while preparing
`docs/reviews/blocker-benchmark/reviewer-1.review.json` or
`docs/reviews/blocker-benchmark/reviewer-2.review.json`.

## Reviewer

- Reviewer ID:
- Reviewer name:
- Review date:
- Benchmark version:

## Required Checks

- [ ] I reviewed the benchmark version in
      `reports/blocker-precision-report.json`.
- [ ] I reviewed every expanded benchmark case ID.
- [ ] I confirmed the expected result for every approved case.
- [ ] I did not use training fixtures to decide expected results.
- [ ] I marked rejected cases in `rejectedCaseIds`.
- [ ] I marked unresolved cases in `disputedCaseIds`.
- [ ] I added comments for rejected or disputed cases.
- [ ] I included a signed statement.

## Machine-Readable JSON Shape

```json
{
  "schemaVersion": 1,
  "reviewerId": "reviewer-1",
  "reviewerName": "Reviewer Name",
  "reviewedAt": "2026-06-22T00:00:00.000Z",
  "benchmarkVersion": "0.1.0-synthetic",
  "reviewedCaseCount": 1960,
  "approvedCaseIds": ["SL-HTTP-001:positive:positive-http-index:001"],
  "rejectedCaseIds": [],
  "disputedCaseIds": [],
  "comments": [
    {
      "caseId": "SL-HTTP-001:positive:positive-http-index:001",
      "comment": "Expected trigger is correct."
    }
  ],
  "signedStatement": "I independently reviewed the expected results for benchmark version 0.1.0-synthetic and did not use training fixtures."
}
```

Do not commit placeholder reviewer files as real sign-off.
