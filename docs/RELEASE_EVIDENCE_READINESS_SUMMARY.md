# Release Evidence Readiness Summary

Generated at: 2026-06-23T00:00:00.000Z

This aggregate status runs the release evidence readiness pipeline. It is not
release approval.

## Summary

- Status: `blocked_external_evidence`
- Checklist: 522/599 done; 77 remaining
- Owner input files: 0/60 present
- Release-owner-evidence directory files: 0/51 present
- Missing owner input files: 60
- Missing owner input files with templates: 60
- Missing owner input files without templates: 0
- Template-covered owner inputs: 60
- Evidence paths missing: 109
- Blocked/failing supporting reports: 1
- Gates missing external owner proof: 74
- Release gate claim: `not_claimed`

## Pipeline

| Step                             | Command                                         | Report                                                         | Status                               |
| -------------------------------- | ----------------------------------------------- | -------------------------------------------------------------- | ------------------------------------ |
| owner-evidence-self-test         | `pnpm release:owner-evidence:self-test`         | `reports/release-owner-evidence-self-test-report.json`         | `passed`                             |
| owner-evidence                   | `pnpm release:owner-evidence`                   | `reports/release-owner-evidence-report.json`                   | `passed`                             |
| owner-evidence-template-coverage | `pnpm release:owner-evidence:template-coverage` | `reports/release-owner-evidence-template-coverage-report.json` | `passed`                             |
| missing-evidence-templates       | `pnpm release:missing-evidence-templates`       | `reports/release-missing-evidence-template-index-report.json`  | `template_index_ready`               |
| owner-evidence-readiness         | `pnpm release:owner-evidence:readiness`         | `reports/release-owner-evidence-readiness-report.json`         | `blocked_waiting_for_owner_evidence` |
| evidence-intake                  | `pnpm release:evidence-intake`                  | `reports/release-evidence-intake-status-report.json`           | `blocked_external_evidence`          |

## Non-Claims

- This aggregate report does not close release gates.
- This aggregate report does not replace real owner, reviewer, legal, security,
  provider, deployment, publication, backup, or final release evidence.
- SearchLint 1.0 remains blocked while external evidence is missing or
  supporting reports are blocked.
