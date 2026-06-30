# OAuth Vault Security Review Form Template

Create one real review file per reviewer:

```text
docs/reviews/oauth-vault-security/reviewer-1.review.json
docs/reviews/oauth-vault-security/reviewer-2.review.json
```

Do not rename `.example.json` files unless a real independent reviewer has
completed the review.

## Schema

```json
{
  "schemaVersion": 1,
  "reviewerId": "stable-reviewer-id",
  "reviewerName": "Reviewer Name",
  "reviewedAt": "2026-06-22T00:00:00.000Z",
  "reviewScopeVersion": "oauth-vault-security-review-2026-06-22",
  "reviewedEvidenceIds": ["kms-static-provisioning"],
  "approvedEvidenceIds": ["kms-static-provisioning"],
  "rejectedEvidenceIds": [],
  "disputedEvidenceIds": [],
  "comments": [
    {
      "evidenceId": "kms-static-provisioning",
      "comment": "No issues found."
    }
  ],
  "signedStatement": "I independently reviewed the SearchLint OAuth vault evidence for the listed scope and approve the expected security posture for this release gate."
}
```

The real file must cover every evidence id listed in `review-scope.json`.
