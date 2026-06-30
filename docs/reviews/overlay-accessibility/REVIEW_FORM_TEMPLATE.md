# Review Form Template

Create the real review file at:

```text
docs/reviews/overlay-accessibility/reviewer.review.json
```

Do not rename or commit `reviewer.review.example.json` as evidence until a real
reviewer has completed the review.

## Machine-Readable JSON Shape

```json
{
  "schemaVersion": 1,
  "reviewerId": "overlay-a11y-reviewer-1",
  "reviewerName": "Reviewer Name",
  "reviewedAt": "2026-06-23T00:00:00.000Z",
  "reviewedArtifact": "SearchLint development badge and overlay",
  "reviewedVersion": "1.0.0-beta.0",
  "assistiveTechnologies": [
    {
      "name": "VoiceOver",
      "version": "macOS 15",
      "platform": "macOS"
    }
  ],
  "browserMatrix": [
    {
      "browser": "Chromium",
      "version": "stable",
      "platform": "macOS"
    }
  ],
  "approvedScenarios": [
    "badge-accessible-name",
    "diagnostic-count-announcement"
  ],
  "rejectedScenarios": [],
  "disputedScenarios": [],
  "comments": [
    {
      "scenarioId": "badge-accessible-name",
      "comment": "Badge name was announced clearly."
    }
  ],
  "signedStatement": "I manually reviewed the SearchLint development badge and overlay against the required WCAG 2.2 AA and screen-reader scenarios."
}
```

The verifier rejects files that omit required scenarios, contain rejected or
disputed scenarios, look like examples, or lack a signed statement.
