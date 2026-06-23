import {
  formatSearchLintDocument,
  compileSearchLintDocument,
  parseSearchLintDocument,
  type SourceSpan,
  type SyntaxDiagnostic
} from "@searchlint/language";
import type { RuleCatalogEntry } from "@searchlint/core";

export type LspPosition = {
  line: number;
  character: number;
};

export type LspRange = {
  start: LspPosition;
  end: LspPosition;
};

export type SearchLintLspDiagnosticSeverity = 1 | 2 | 3 | 4;

export type SearchLintLspDiagnostic = {
  range: LspRange;
  severity: SearchLintLspDiagnosticSeverity;
  code: string;
  source: "searchlint";
  message: string;
  data: {
    kind: "syntax" | "semantic";
  };
};

export type SearchLintDocumentDiagnosticsResult = {
  diagnostics: readonly SearchLintLspDiagnostic[];
};

export type SearchLintHover = {
  contents: string;
  range?: LspRange;
};

export type SearchLintCompletionItemKind = "keyword" | "enum" | "reference";

export type SearchLintCompletionItem = {
  label: string;
  kind: SearchLintCompletionItemKind;
  detail: string;
  insertText?: string;
  documentation?: string;
};

export type SearchLintTextEdit = {
  range: LspRange;
  newText: string;
};

export type SearchLintLocation = {
  uri: string;
  range: LspRange;
};

export type SearchLintCodeAction = {
  title: string;
  kind: "quickfix";
  diagnostics: readonly SearchLintLspDiagnostic[];
  edit: {
    changes: Record<string, readonly SearchLintTextEdit[]>;
  };
};

export type SearchLintRenameEdit = {
  changes: Record<string, readonly SearchLintTextEdit[]>;
};

export type SearchLintRuleCatalogProvider = {
  listRules(): readonly RuleCatalogEntry[];
  getRule(ruleId: string): RuleCatalogEntry | undefined;
};

const errorSeverity = 1 satisfies SearchLintLspDiagnosticSeverity;
const severityLiterals = ["blocker", "error", "warning", "info"] as const;
const providerLiterals = ["google", "yandex"] as const;
const keywordCompletions = [
  {
    label: "route",
    kind: "keyword",
    detail: "SearchLint route contract",
    insertText: 'route "/path/**" {\n  indexable true\n}'
  },
  {
    label: "severity",
    kind: "keyword",
    detail: "Override a rule severity",
    insertText: "severity SL-RULE-001 warning"
  },
  {
    label: "suppress",
    kind: "keyword",
    detail: "Suppress a rule with a required reason",
    insertText:
      'suppress SL-RULE-001 {\n  reason "Document why this is intentional."\n}'
  }
] satisfies readonly SearchLintCompletionItem[];

const dslConstructs = new Map<string, string>([
  [
    "language",
    "`language 1` declares the SearchLint DSL language version. Version 1 is the current public contract."
  ],
  [
    "site",
    "`site` declares the canonical project site URL used by CLI, crawler, overlay, CI, LSP, and future cloud execution."
  ],
  [
    "route",
    "`route` defines a route contract with deterministic Next.js-aware pattern matching."
  ],
  [
    "group",
    "`group` organizes route declarations without changing rule behavior."
  ],
  [
    "policy",
    "`policy` defines reusable route members that can be applied with `use`."
  ],
  ["use", "`use` expands a named policy at the route position."],
  [
    "environment",
    "`environment` applies environment-specific site and route declarations after base declarations."
  ],
  [
    "severity",
    "`severity <rule-id> <blocker|error|warning|info>` overrides a rule severity for the current route."
  ],
  [
    "suppress",
    "`suppress <rule-id>` disables a rule for the current route and must include a non-empty reason."
  ],
  [
    "provider",
    "`provider google|yandex` scopes declarations to one search provider without mixing provider semantics."
  ],
  [
    "custom",
    "`custom` references an external custom rule. Execution sandboxing remains outside language version 1."
  ],
  [
    "canonical",
    "`canonical` declares canonical URL policy, including the `self` shorthand."
  ],
  [
    "indexable",
    "`indexable` declares whether a route is expected to be indexable."
  ],
  ["schema", "`schema` declares required structured data types."],
  ["reason", "`reason` documents why a suppression is intentional."]
]);

export function createSearchLintDocumentDiagnostics(
  source: string
): SearchLintDocumentDiagnosticsResult {
  const parsed = parseSearchLintDocument(source);
  const compiled = compileSearchLintDocument(parsed.ast);

  return {
    diagnostics: [
      ...toLspDiagnostics(parsed.diagnostics, "syntax"),
      ...toLspDiagnostics(compiled.diagnostics, "semantic")
    ]
  };
}

export function createSearchLintDocumentHover(
  source: string,
  position: LspPosition,
  catalog?: SearchLintRuleCatalogProvider
): SearchLintHover | undefined {
  const word = findWordAtPosition(source, position);
  if (!word) {
    return undefined;
  }

  const rule = catalog?.getRule(word.text);
  if (rule) {
    return {
      range: word.range,
      contents: [
        `**${rule.id}: ${rule.name}**`,
        "",
        rule.description,
        "",
        `Severity: \`${rule.defaultSeverity}\``,
        `Confidence: \`${rule.confidence}\``,
        `Sources: ${rule.sources.map((sourceName) => `\`${sourceName}\``).join(", ")}`,
        "",
        `Fix: ${rule.fix}`,
        "",
        `Docs: \`${rule.documentation}\``
      ].join("\n")
    };
  }

  const construct = dslConstructs.get(word.text);
  if (!construct) {
    return undefined;
  }

  return {
    range: word.range,
    contents: construct
  };
}

export function createSearchLintDocumentCompletions(
  catalog?: SearchLintRuleCatalogProvider
): readonly SearchLintCompletionItem[] {
  return [
    ...keywordCompletions,
    ...severityLiterals.map((severity) => ({
      label: severity,
      kind: "enum" as const,
      detail: "SearchLint diagnostic severity"
    })),
    ...providerLiterals.map((provider) => ({
      label: provider,
      kind: "enum" as const,
      detail: "Search provider block name"
    })),
    ...(catalog?.listRules() ?? []).map((rule) => ({
      label: rule.id,
      kind: "reference" as const,
      detail: `${rule.defaultSeverity} ${rule.name}`,
      documentation: rule.description
    }))
  ];
}

export function formatSearchLintDocumentText(source: string): string {
  const parsed = parseSearchLintDocument(source);
  return formatSearchLintDocument(parsed.ast);
}

export function createSearchLintDocumentCodeActions(
  uri: string,
  source: string,
  diagnostics: readonly SearchLintLspDiagnostic[]
): readonly SearchLintCodeAction[] {
  const actions: SearchLintCodeAction[] = [];

  if (!hasLanguageDeclaration(source)) {
    actions.push({
      title: "Add SearchLint language version",
      kind: "quickfix",
      diagnostics: [],
      edit: {
        changes: {
          [uri]: [
            {
              range: {
                start: { line: 0, character: 0 },
                end: { line: 0, character: 0 }
              },
              newText: "language 1\n"
            }
          ]
        }
      }
    });
  }

  for (const diagnostic of diagnostics) {
    if (diagnostic.code === "SLANG203") {
      actions.push(
        ...severityLiterals.map((severity) => ({
          title: `Replace with severity '${severity}'`,
          kind: "quickfix" as const,
          diagnostics: [diagnostic],
          edit: {
            changes: {
              [uri]: [
                {
                  range: diagnostic.range,
                  newText: severity
                }
              ]
            }
          }
        }))
      );
    }

    if (
      diagnostic.code === "SLANG205" &&
      diagnostic.range.start.line === diagnostic.range.end.line
    ) {
      actions.push({
        title: "Replace suppression reason with placeholder",
        kind: "quickfix",
        diagnostics: [diagnostic],
        edit: {
          changes: {
            [uri]: [
              {
                range: diagnostic.range,
                newText: '"Document why this is intentional."'
              }
            ]
          }
        }
      });
    }
  }

  return actions;
}

export function createSearchLintDocumentDefinition(
  uri: string,
  source: string,
  position: LspPosition
): SearchLintLocation | undefined {
  const symbol = findResolvableSymbolAtPosition(source, position);
  if (!symbol) {
    return undefined;
  }

  const declaration = findSymbolDeclaration(source, symbol);
  return declaration ? { uri, range: declaration.range } : undefined;
}

export function createSearchLintDocumentReferences(
  uri: string,
  source: string,
  position: LspPosition,
  includeDeclaration = true
): readonly SearchLintLocation[] {
  const symbol = findResolvableSymbolAtPosition(source, position);
  if (!symbol) {
    return [];
  }

  return findSymbolOccurrences(source, symbol)
    .filter(
      (occurrence) => includeDeclaration || occurrence.kind !== "declaration"
    )
    .map((occurrence) => ({ uri, range: occurrence.range }));
}

export function createSearchLintDocumentRenameEdit(
  uri: string,
  source: string,
  position: LspPosition,
  newName: string
): SearchLintRenameEdit | undefined {
  if (!/^[A-Za-z_][A-Za-z0-9_-]*$/u.test(newName)) {
    return undefined;
  }

  const references = createSearchLintDocumentReferences(
    uri,
    source,
    position,
    true
  );
  if (references.length === 0) {
    return undefined;
  }

  return {
    changes: {
      [uri]: references.map((reference) => ({
        range: reference.range,
        newText: newName
      }))
    }
  };
}

function toLspDiagnostics(
  diagnostics: readonly SyntaxDiagnostic[],
  kind: "syntax" | "semantic"
): readonly SearchLintLspDiagnostic[] {
  return diagnostics.map((diagnostic) => ({
    range: toLspRange(diagnostic.span),
    severity: errorSeverity,
    code: diagnostic.code,
    source: "searchlint",
    message: diagnostic.message,
    data: { kind }
  }));
}

function toLspRange(span: SourceSpan): LspRange {
  return {
    start: toLspPosition(span.start),
    end: toLspPosition(span.end)
  };
}

function toLspPosition(position: SourceSpan["start"]): LspPosition {
  return {
    line: Math.max(0, position.line - 1),
    character: Math.max(0, position.column - 1)
  };
}

function hasLanguageDeclaration(source: string): boolean {
  return /^\s*language\s+1\b/m.test(source);
}

function findWordAtPosition(
  source: string,
  position: LspPosition
): { text: string; range: LspRange } | undefined {
  const line = source.split(/\r?\n/u)[position.line] ?? "";
  const boundedCharacter = Math.max(
    0,
    Math.min(position.character, line.length)
  );
  const before = line.slice(0, boundedCharacter);
  const after = line.slice(boundedCharacter);
  const beforeMatch = /[A-Za-z0-9_-]*$/u.exec(before);
  const afterMatch = /^[A-Za-z0-9_-]*/u.exec(after);
  const start = boundedCharacter - (beforeMatch?.[0].length ?? 0);
  const end = boundedCharacter + (afterMatch?.[0].length ?? 0);
  const text = line.slice(start, end);

  if (!text) {
    return undefined;
  }

  return {
    text,
    range: {
      start: { line: position.line, character: start },
      end: { line: position.line, character: end }
    }
  };
}

type SearchLintResolvableSymbol = {
  name: string;
  type: "policy" | "variable";
};

type SearchLintSymbolOccurrence = {
  kind: "declaration" | "reference";
  range: LspRange;
};

function findResolvableSymbolAtPosition(
  source: string,
  position: LspPosition
): SearchLintResolvableSymbol | undefined {
  const word = findWordAtPosition(source, position);
  if (!word) {
    return undefined;
  }

  for (const symbol of collectResolvableSymbols(source)) {
    if (
      symbol.name === word.text &&
      symbol.occurrences.some((occurrence) =>
        rangesEqual(occurrence.range, word.range)
      )
    ) {
      return { name: symbol.name, type: symbol.type };
    }
  }

  return undefined;
}

function findSymbolDeclaration(
  source: string,
  symbol: SearchLintResolvableSymbol
): SearchLintSymbolOccurrence | undefined {
  return collectResolvableSymbols(source)
    .find((item) => item.name === symbol.name && item.type === symbol.type)
    ?.occurrences.find((occurrence) => occurrence.kind === "declaration");
}

function findSymbolOccurrences(
  source: string,
  symbol: SearchLintResolvableSymbol
): readonly SearchLintSymbolOccurrence[] {
  return (
    collectResolvableSymbols(source).find(
      (item) => item.name === symbol.name && item.type === symbol.type
    )?.occurrences ?? []
  );
}

function collectResolvableSymbols(source: string): readonly {
  name: string;
  type: "policy" | "variable";
  occurrences: readonly SearchLintSymbolOccurrence[];
}[] {
  const symbols = new Map<
    string,
    {
      name: string;
      type: "policy" | "variable";
      occurrences: SearchLintSymbolOccurrence[];
    }
  >();
  const lines = source.split(/\r?\n/u);

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex] ?? "";
    collectLineSymbol(
      symbols,
      line,
      lineIndex,
      /\bpolicy\s+([A-Za-z_][A-Za-z0-9_-]*)/gu,
      "policy",
      "declaration"
    );
    collectLineSymbol(
      symbols,
      line,
      lineIndex,
      /\buse\s+([A-Za-z_][A-Za-z0-9_-]*)/gu,
      "policy",
      "reference"
    );
    collectLineSymbol(
      symbols,
      line,
      lineIndex,
      /\b(?:let|variable)\s+([A-Za-z_][A-Za-z0-9_-]*)/gu,
      "variable",
      "declaration"
    );
    collectLineSymbol(
      symbols,
      line,
      lineIndex,
      /\$([A-Za-z_][A-Za-z0-9_-]*)/gu,
      "variable",
      "reference"
    );
  }

  return [...symbols.values()].sort((left, right) => {
    const typeOrder = left.type.localeCompare(right.type);
    return typeOrder === 0 ? left.name.localeCompare(right.name) : typeOrder;
  });
}

function collectLineSymbol(
  symbols: Map<
    string,
    {
      name: string;
      type: "policy" | "variable";
      occurrences: SearchLintSymbolOccurrence[];
    }
  >,
  line: string,
  lineIndex: number,
  pattern: RegExp,
  type: "policy" | "variable",
  kind: "declaration" | "reference"
): void {
  for (const match of line.matchAll(pattern)) {
    const name = match[1];
    if (!name || match.index === undefined) {
      continue;
    }
    const character = match.index + match[0].lastIndexOf(name);
    const key = `${type}:${name}`;
    const symbol =
      symbols.get(key) ??
      ({
        name,
        type,
        occurrences: []
      } satisfies {
        name: string;
        type: "policy" | "variable";
        occurrences: SearchLintSymbolOccurrence[];
      });
    symbol.occurrences.push({
      kind,
      range: {
        start: { line: lineIndex, character },
        end: { line: lineIndex, character: character + name.length }
      }
    });
    symbols.set(key, symbol);
  }
}

function rangesEqual(left: LspRange, right: LspRange): boolean {
  return (
    left.start.line === right.start.line &&
    left.start.character === right.start.character &&
    left.end.line === right.end.line &&
    left.end.character === right.end.character
  );
}
