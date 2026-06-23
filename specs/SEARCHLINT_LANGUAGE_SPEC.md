# SearchLint Language Specification

Status date: 2026-06-21

## Purpose

`searchlint.seo` is SearchLint's stable public configuration contract for
language version 1. The same file must be interpreted by CLI, crawler, overlay,
CI, LSP, and future cloud execution through the shared `@searchlint/language`
parser, AST, formatter, semantic validator, and compiler.

## Discovery

- Default config file name: `searchlint.seo`.
- Discovery starts at the project root provided by the caller and walks upward
  until the filesystem root.
- The first `searchlint.seo` found is the project entry config.
- Callers may pass an explicit config path; explicit paths do not trigger upward
  discovery.
- Imports are resolved relative to the importing file.
- Imported paths must be relative file paths ending in `.seo`.
- Missing imports and import cycles are semantic errors.
- No silent fallback config is allowed.

## Syntax

Formal grammar: `specs/searchlint.ebnf`.

Language version 1 supports:

- `language 1`
- `import "./shared.seo"`
- `site "https://example.com"`
- `let name value`
- `environment production { ... }`
- `policy name { ... }`
- `group "name" { route "/path/**" { ... } }`
- `route "/path/**" { ... }`
- line comments with `#` or `//`
- strings, numbers, booleans, identifiers, `$variable` references, and lists.

## Public Surface

Example:

```text
language 1
import "./policies.seo"
site "https://example.com"
let productSchemas ["Product", "BreadcrumbList"]

policy productPage {
  schema $productSchemas
  title {
    required true
  }
  severity SL-SCHEMA-001 error
}

group "catalog" {
  route "/products/[slug]" {
    use productPage
    indexable true
    canonical self
    provider google {
      require ["rich-result"]
      rule SL-GOOGLE-RICH-001
    }
    custom "@acme/searchlint-rule" {
      severity warning
    }
  }
}

environment production {
  site "https://www.example.com"
  route "/admin/**" {
    indexable false
    suppress SL-INDEX-001 {
      reason "Admin pages are intentionally private."
    }
  }
}
```

## Route Patterns and Precedence

Route patterns are slash-prefixed strings.

Supported segments:

- literal segment: `/products`
- single segment wildcard: `*`
- recursive wildcard: `**`
- Next.js dynamic segment: `[slug]`
- Next.js catch-all segment: `[...slug]`
- Next.js optional catch-all segment: `[[...slug]]`

Precedence is deterministic:

1. more literal segments;
2. more total segments;
3. lexical route pattern order.

## Environment Precedence

Base declarations apply first. If a caller selects an environment, declarations
inside that environment apply after base declarations.

Environment `site` overrides base `site`. Environment routes are added to the
compiled route set. Duplicate environment names are errors. Selecting a missing
environment is an error.

## Variables and Policies

Variables are immutable within a compiled declaration set. Duplicate variables
are errors.

Policies are reusable route-member blocks. `use policyName` expands the policy
at the route position before route-specific members are compiled. Route-specific
members can override inherited severity and route requirements by declaring the
same rule/field later in the route. Unknown policies are errors.

## Route Members

Language version 1 route properties:

- `type <identifier|string>`
- `indexable <boolean>`
- `canonical self | <string>`
- `schema <identifier|string|list>`
- `severity <rule-id> <blocker|error|warning|info>`
- `use <policy-name>`
- `important <boolean>`
- `crawlDepth <number>`

Language version 1 route blocks:

- `title { required <boolean> }`
- `description { required <boolean> }`
- `metadata { ... }`
- `canonical { ... }`
- `hreflang { ... }`
- `schema { ... }`
- `pagination { required <boolean> }`
- `source "<file>" { line <number>; column <number> }`
- `suppress <rule-id> { reason "<non-empty reason>" }`
- `provider google|yandex { ... }`
- `custom "<rule-reference>" { severity <severity> }`

Custom rules are references only in language version 1. Local execution uses the
declarative sandbox policy in `../docs/CUSTOM_RULE_EXECUTION_POLICY.md`; cloud
custom code execution remains prohibited by OD-021.

## Provider Rules

Provider blocks are provider-scoped and must not mix Google and Yandex semantics
in a single declaration:

```text
provider google {
  require ["rich-result"]
  rule SL-GOOGLE-RICH-001
}
```

Allowed providers: `google`, `yandex`.

## Suppressions

Suppressions must include a non-empty `reason` string. Route-level suppressions
apply only to the route where they are declared after policy expansion.

## Errors

Invalid syntax and invalid semantics produce machine-readable diagnostics with:

- stable code, such as `SLANG201`;
- human-readable message;
- exact source span with line, column, and offset.

Invalid config is not accepted silently. The compiler returns no config when
syntax or semantic diagnostics exist.

## Compiled Intermediate Contract

The compiler emits deterministic JSON-compatible data:

```ts
type CompiledSearchLintConfig = {
  contractVersion: 1;
  languageVersion: 1;
  siteUrl: string;
  environment?: string;
  imports: string[];
  variables: Record<string, string | number | boolean | unknown[]>;
  policies: string[];
  routeContracts: RouteContract[];
  routePrecedence: string[];
  suppressions: Suppression[];
  providerRules: ProviderRule[];
  customRules: CustomRuleReference[];
};
```

Object keys and arrays are sorted deterministically where order is not semantic.

## Versioning and Migrations

- Current language version: `1`.
- Parsers and compilers must reject unsupported language versions.
- Breaking grammar or compiled-contract changes require a new language version
  and ADR.
- Deprecated syntax must produce migration diagnostics before removal.
- Rule IDs referenced from config are stable and must not be renamed silently.
- Migration command contract:

```bash
searchlint migrate-config --from 1 --to 1 --write searchlint.seo
```

Language version 1 is the only approved public version. The supported `1 -> 1`
path validates the config and preserves file contents byte-for-byte. Future
target versions must be rejected until a new language version and ADR exist. The
migration command must be deterministic and must preserve comments when the
formatter can do so. License and commercial distribution policy are not decided
by this language contract; OD-016 remains pending.
