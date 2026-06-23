# Security Policy

## Supported Scope

SearchLint's public security policy applies to the public local developer
product scope after public release:

- local/core packages;
- CLI;
- crawler;
- DSL/language and LSP;
- Next.js integration;
- overlay;
- reporters;
- VS Code extension;
- specs and documentation for the local developer product.

The closed commercial cloud scope is handled through private operational
security processes:

- dashboard;
- API;
- workers;
- infrastructure;
- billing;
- OAuth vault operations;
- hosted reports;
- SaaS operations.

## Reporting a Vulnerability

Before public release, report vulnerabilities privately to the project owner.

Before any public release, this file must be legally reviewed and updated with
the approved security contact, expected response timelines, disclosure process,
and supported version policy.

Do not file public issues for suspected vulnerabilities involving:

- OAuth tokens;
- API keys;
- database URLs;
- private customer data;
- bypasses of tenant isolation;
- crawler SSRF or internal network access;
- billing or entitlement bypasses.

## Release Gate

SearchLint public release requires legal and security review of:

- this security policy;
- public/private repository boundary;
- package metadata;
- dependency and vulnerability scan process;
- sensitive fixture and benchmark data policy;
- trademark and disclosure language.
