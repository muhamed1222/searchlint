# Rule API

## Confirmed Rule Engine Requirements

The core rule system must support:

- synchronous and asynchronous rules;
- page-level rules;
- site-level rules;
- dependencies between rules;
- priorities;
- different requirements for different routes;
- Google-specific rules;
- Yandex-specific rules;
- custom rules;
- suppressions with mandatory reasons;
- baselines of known problems;
- comparison of two checks;
- stable identifiers.

## Approved Rule Catalog Policy

Approved by OD-005 and ADR `../docs/adr/0005-rule-catalog-policy.md`:

- approve the catalog schema first;
- define all 120 SearchLint 1.0 rule entries in `RULE_CATALOG.yaml`;
- do this before mass rule implementation starts.

Rule compatibility for SearchLint 1.0 is checked by
`../specs/RULE_COMPATIBILITY_BASELINE.json` and `pnpm rule:compatibility`. The
compatibility baseline pins rule IDs, default severity, confidence, sources,
provider scope, version, and deterministic sample fingerprints.

## Confirmed Rule Metadata Requirements

Each rule must have:

- permanent ID;
- description;
- severity;
- confidence;
- list of sources;
- checking algorithm;
- evidence;
- fix;
- test examples;
- documentation;
- version;
- provider scope.

## Confirmed Quality Constraints

- A blocker cannot be based on a subjective heuristic.
- Title length is not a hard error.
- `meta keywords` is not checked.
- `noindex` is evaluated according to route purpose.
- Google and Yandex rules are not mixed.
- Users can change severity through the DSL.

## DSL and AST Requirement

Approved by OD-004:

Parser, formatter, typechecker, and LSP must share one AST model.

## SearchLint Config Contract

Accepted by ADR `../docs/adr/0015-dsl-public-contract-and-versioning.md`:

- `searchlint.seo` language version 1 is the public DSL configuration contract;
- rule references in config use stable catalog rule IDs;
- severity overrides use `severity <rule-id> <blocker|error|warning|info>`;
- suppressions use `suppress <rule-id> { reason "<non-empty reason>" }`;
- provider-specific rules are scoped inside `provider google|yandex` blocks and
  must not mix providers;
- custom rules are references only in language version 1; local execution is
  allowed only through the declarative sandbox in
  `../docs/CUSTOM_RULE_EXECUTION_POLICY.md`;
- invalid config is rejected with language diagnostics rather than silently
  falling back or coercing values.

## Custom Rule Execution Policy

Approved by OD-021 and ADR `../docs/adr/0023-custom-rule-plugin-sandboxing.md`:

- SearchLint 1.0 does not execute third-party JavaScript or native code in the
  cloud.
- Local custom rules use declarative definitions converted to standard
  `@searchlint/core` rules by `createLocalCustomRule` or
  `createLocalCustomRules`.
- Declarative custom rules inspect only bounded `PageSnapshot` fields already
  collected by first-party SearchLint collectors.
- The local sandbox provides no filesystem, network, process, import, package,
  token vault, database, or arbitrary workspace-code access.
- The local sandbox enforces rule count, report count, string length, text-byte,
  and evaluation-step limits.
- Custom rule diagnostics still pass through the shared diagnostic validator,
  including non-heuristic blocker and evidence requirements.

## Still Pending

- arbitrary-code plugin execution is not part of SearchLint 1.0;
- cloud custom-code execution remains prohibited until a future ADR;
- rule marketplace support is deferred;
- future public API compatibility changes remain governed by OD-017;
- broader non-DSL contract migration policy remains governed by OD-025.
