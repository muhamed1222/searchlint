# Package Documentation

Status date: 2026-06-30

This document records reader-facing package documentation requirements for the
SearchLint public package candidates. It does not publish packages.

## Required Package Documentation

Each public package candidate must provide enough documentation for a clean
install user to understand:

- package purpose;
- supported Node.js and pnpm versions;
- installation command;
- primary import or CLI usage;
- production impact claim, where applicable;
- relationship to the shared deterministic rule engine;
- license and trademark boundary;
- where to report bugs or security issues after public release.

## Publication Boundary

Public documentation must describe local developer tooling and deterministic
analysis behavior. It must not describe private SaaS operations as if they are
included in the public package release.

## Release Gate

Package documentation must be reviewed with package metadata, public repository
boundary, VS Code Marketplace copy, public website copy, and legal approval
before public package publication.
