# Legal Release Approval Owner Input Guide

Generated at: 2026-06-23T00:00:00.000Z

This guide covers the owner-provided legal release approval evidence. It is not
legal advice and is not release approval.

## Current Status

- status: `owner_input_required`
- approval file: `docs/legal-release-approval.json`
- template: `docs/legal-release-approval.example.json`
- governance package: `blocked_missing_owner_evidence`
- legal approval intake: `missing`

## Required Approved Files

- `LICENSE`
- `NOTICE`
- `CONTRIBUTING.md`
- `DCO.md`
- `SECURITY.md`
- `docs/TRADEMARK_POLICY_DRAFT.md`
- `docs/RELEASE_GOVERNANCE.md`
- `docs/PACKAGE_PUBLIC_PRIVATE_MATRIX.md`
- `docs/PUBLIC_PRIVATE_REPOSITORY_BOUNDARY_PLAN.md`
- `docs/PACKAGE_PUBLICATION_READINESS.md`
- `docs/PACKAGE_DOCUMENTATION.md`
- `docs/VSCODE_LSP_USAGE.md`
- `docs/PUBLIC_WEBSITE_ONBOARDING.md`
- `docs/ONBOARDING_GUIDE.md`

## Required Approved Scopes

- Apache-2.0 public local/core package scope
- closed commercial cloud/SaaS boundary
- SearchLint trademark reservation
- DCO 1.1 contribution process
- public/private repository boundary
- public package metadata
- VS Code Marketplace copy
- public website and onboarding copy

## Required Legal Answers

- `apache2PublicScopeAccepted`: must be `yes`
- `noticeApproved`: must be `yes`
- `trademarkExclusionSufficient`: must be `yes`
- `trademarkPolicyApproved`: must be `yes`
- `dco11Accepted`: must be `yes`
- `contributionScopeExcludesCloud`: must be `yes`
- `repositorySplitExcludesPrivateCloud`: must be `yes`
- `publicCopyConsistentWithTrademarkAndLicense`: must be `yes`
- `securityPolicyApproved`: must be `yes`
- `privacyTelemetryBenchmarkFixturePoliciesApproved`: must be `yes`

## Required JSON Fields

- `schemaVersion`
- `approvedBy`
- `reviewerRole`
- `reviewedAt`
- `approvalId`
- `approvedScopes`
- `approvedFiles`
- `requiredAnswers`
- `requiredChanges`
- `signedStatement`

## Validation Commands

```bash
pnpm legal:release-gate
pnpm release:owner-evidence-package-status
pnpm release:evidence-readiness
pnpm final-release:gate
```

## Owner Procedure

- Send the listed legal materials and scope list to a qualified legal reviewer
  or owner counsel.
- Create docs/legal-release-approval.json from
  docs/legal-release-approval.example.json only after qualified legal review is
  complete.
- Replace every example value with real reviewer, role, timestamp, approval ID,
  and approval statement.
- Include every required file and scope in the approved lists.
- Answer every required legal question with yes only if it was actually
  approved.
- Leave requiredChanges empty only after all legal changes are resolved.
- Run pnpm legal:release-gate and the aggregate release evidence checks.

## Forbidden Evidence

- copied example approval values
- template or placeholder reviewer names
- approval with unresolved requiredChanges
- partial file approval
- partial scope approval
- answers other than yes for required legal questions
- screenshots or chat notes without machine-readable JSON
- legal approval containing secrets, tokens, private keys, or credentials

## Non-Claims

- This guide does not provide legal advice.
- This guide does not create legal approval.
- This guide does not close package, VS Code, public repository, or final
  release gates.
- Real legal approval remains owner-provided external proof.
