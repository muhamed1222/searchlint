# Diagnostic Schema

## Confirmed Type From Development Plan

```ts
type Diagnostic = {
  id: string;
  severity: "blocker" | "error" | "warning" | "info";
  confidence: "certain" | "likely" | "heuristic";

  pageUrl: string;
  route?: string;

  source:
    | "source-code"
    | "raw-html"
    | "rendered-dom"
    | "http-header"
    | "crawler"
    | "google"
    | "yandex";

  title: string;
  evidence: string;
  expected?: string;
  actual?: string;

  file?: string;
  line?: number;
  selector?: string;

  observedAt: string;
  fingerprint: string;
};
```

## Approved Evidence Extension

Approved by OD-006 and ADR `../docs/adr/0006-diagnostic-evidence.md`:

- `evidence` remains required and human-readable.
- `structuredEvidence` is optional.
- `fingerprint` is stable.
- data source is required.
- confidence level is required.

Draft extension:

```ts
type DiagnosticWithStructuredEvidence = Diagnostic & {
  structuredEvidence?: StructuredEvidence[];
};
```

Final `StructuredEvidence` variants are not defined in this documentation step.

## Source Location Confidence

Approved by OD-013:

- `EXACT`
- `RELATED`
- `RUNTIME`
- `EXTERNAL`

`file` and `line` may be populated only for `EXACT` locations.

## External Observation Freshness

Approved by OD-011:

External observations referenced by diagnostics must include:

- `observedAt`;
- `fetchedAt`;
- freshness status;
- quota information when provider quota applies.

## Invariants

- Every diagnostic has a stable ID.
- Every diagnostic has severity.
- Every diagnostic has confidence.
- Every diagnostic has evidence.
- Every diagnostic has a fingerprint.
- File and line must not be fabricated.
- Blockers cannot rely only on subjective heuristics.

## Language Diagnostics

SearchLint DSL parser and semantic diagnostics use stable `SLANG###` codes,
human-readable messages, and exact source spans with `offset`, `line`, and
`column`. LSP diagnostics are derived from the same shared language diagnostics;
the LSP adapter must not reparse or invent locations.

## Still Pending

- exact JSON Schema format;
- structured evidence variants;
- fingerprint algorithm;
- stable rule ID namespace;
- contract migration policy: OD-025.
