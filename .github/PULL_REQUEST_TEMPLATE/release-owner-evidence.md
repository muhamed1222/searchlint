# Release Owner Evidence PR

Use this template only for real SearchLint 1.0 owner, reviewer, provider,
security, legal, publication, platform, or final release evidence.

This PR does not approve SearchLint 1.0 by itself. A release lane is complete
only after the required evidence files are committed, sanitized, and verified by
the lane-specific command plus `pnpm release:evidence-readiness` and
`pnpm final-release:gate`.

## Evidence Lane

- Issue:
- Package:
- Owner lane:
- Evidence files added or updated:

## Evidence Source

- Reviewer, owner, provider, or system that produced the evidence:
- Observation or approval date:
- Environment or target tested:
- Related packet, runbook, or owner guide:

## Sanitization Checklist

- [ ] No secrets, tokens, credentials, cookies, private keys, database URLs, or
      raw provider payloads are included.
- [ ] No private customer data, payment details, personal contact data, or
      privileged legal analysis is included.
- [ ] Example values and placeholder identities were replaced with real
      sanitized evidence values.
- [ ] Screenshots or logs, if referenced, are redacted or replaced with
      machine-readable sanitized summaries.
- [ ] The evidence file is committed at the exact path required by
      `docs/RELEASE_OWNER_EVIDENCE_PACKAGE_STATUS.md`.

## Required Verification

Run the lane-specific verifier first.

Common first verifiers:

- Issue `#19`: `pnpm rule-qa:review-delivery` and `pnpm rule-qa:review`
- Issue `#20`: `pnpm legal:release-gate`
- Issue `#21`: `pnpm vscode:update-e2e`
- Issue `#22`: `pnpm backup:restore-live-gate`
- Issue `#23`: `pnpm google:gsc:acceptance` or
  `pnpm billing:live-stripe-final-acceptance-packet`
- Issue `#24`: `pnpm oauth-vault:security-review`,
  `pnpm overlay:manual-a11y-review`, `pnpm security:pentest`, or
  `pnpm security:dast`
- Issue `#25`: `pnpm rc:matrix` and `pnpm final-release:gate`

Then run:

```bash
pnpm release:evidence-readiness
pnpm final-release:gate
```

## Verification Output

- Lane-specific verifier:
- `pnpm release:evidence-readiness`:
- `pnpm final-release:gate`:
- Current expected final gate status:

## Forbidden Actions

- [ ] This PR does not create `v1.0.0`.
- [ ] This PR does not run final `npm publish`.
- [ ] This PR does not run final `vsce publish`.
- [ ] This PR does not release the public website as SearchLint 1.0.
- [ ] This PR does not announce SearchLint 1.0.

## Notes

- Use `docs/RELEASE_OWNER_STATUS_DIGEST.md` for current release status.
- Use `docs/RELEASE_EXTERNAL_OWNER_ACTION_QUEUE.md` for first evidence paths.
- Use `docs/RELEASE_OWNER_OUTREACH_MESSAGE_KIT.md` for owner messages.
- Use `docs/RELEASE_OWNER_EVIDENCE_PACKAGE_STATUS.md` for the full evidence file
  list.
