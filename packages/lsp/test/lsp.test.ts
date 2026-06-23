import { describe, expect, it } from "vitest";

import type { RuleCatalogEntry } from "@searchlint/core";

import {
  createSearchLintDocumentCodeActions,
  createSearchLintDocumentCompletions,
  createSearchLintDocumentDiagnostics,
  createSearchLintDocumentDefinition,
  createSearchLintDocumentHover,
  createSearchLintDocumentReferences,
  createSearchLintDocumentRenameEdit,
  formatSearchLintDocumentText
} from "../src/index.js";

const rule: RuleCatalogEntry = {
  id: "SL-INDEX-001",
  name: "indexable-route-has-noindex",
  category: "indexability",
  defaultSeverity: "blocker",
  confidence: "certain",
  scope: "page",
  sources: ["raw-html", "rendered-dom"],
  providerScope: "core",
  description: "An indexable route must not emit a noindex directive.",
  checkingAlgorithm: "Compare route contract with robots directives.",
  requiredEvidence: ["route-contract", "robots-directive"],
  fix: "Remove noindex or mark the route non-indexable.",
  testExamples: ["fixtures/indexability/noindex"],
  documentation: "docs/rules/SL-INDEX-001.md",
  version: "1.0.0"
};

const catalog = {
  listRules: () => [rule],
  getRule: (ruleId: string) => (ruleId === rule.id ? rule : undefined)
};

describe("createSearchLintDocumentDiagnostics", () => {
  it("returns no diagnostics for a valid .seo document", () => {
    const result = createSearchLintDocumentDiagnostics(`language 1
site "https://example.com"
route "/products/**" {
  indexable true
}
`);

    expect(result.diagnostics).toEqual([]);
  });

  it("maps syntax diagnostics to LSP-compatible ranges", () => {
    const result = createSearchLintDocumentDiagnostics(`language 1
site "https://example.com"
route "/products/**" {
  indexable @
}
`);

    expect(result.diagnostics).toContainEqual({
      range: {
        start: { line: 3, character: 12 },
        end: { line: 3, character: 13 }
      },
      severity: 1,
      code: "SLANG002",
      source: "searchlint",
      message: "Unexpected character '@'.",
      data: { kind: "syntax" }
    });
  });

  it("maps semantic diagnostics from the shared language compiler", () => {
    const result = createSearchLintDocumentDiagnostics(`language 1
site "https://example.com"
route "/products/**" {
  indexable maybe
}
`);

    expect(result.diagnostics).toContainEqual({
      range: {
        start: { line: 3, character: 12 },
        end: { line: 3, character: 17 }
      },
      severity: 1,
      code: "SLANG201",
      source: "searchlint",
      message: "indexable must be true or false.",
      data: { kind: "semantic" }
    });
  });

  it("keeps parser/compiler diagnostic parity for public DSL constructs", () => {
    const result = createSearchLintDocumentDiagnostics(`language 1
site "https://example.com"
route "/products/**" {
  use missingPolicy
  provider bing {
    require rich-result
  }
}
`);

    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
      expect.arrayContaining(["SLANG213", "SLANG219"])
    );
    expect(
      result.diagnostics.every(
        (diagnostic) => diagnostic.source === "searchlint"
      )
    ).toBe(true);
    expect(
      result.diagnostics.every((diagnostic) => diagnostic.range.start.line >= 0)
    ).toBe(true);
  });

  it("returns hover documentation for DSL constructs and rule IDs", () => {
    const constructHover = createSearchLintDocumentHover(
      'language 1\nsite "https://example.com"\n',
      { line: 0, character: 2 },
      catalog
    );
    const ruleHover = createSearchLintDocumentHover(
      `language 1
site "https://example.com"
route "/**" {
  severity SL-INDEX-001 blocker
}
`,
      { line: 3, character: 13 },
      catalog
    );

    expect(constructHover?.contents).toContain("DSL language version");
    expect(ruleHover?.contents).toContain("SL-INDEX-001");
    expect(ruleHover?.contents).toContain("noindex directive");
  });

  it("returns deterministic completions for DSL keywords, enums, and rules", () => {
    const completions = createSearchLintDocumentCompletions(catalog);

    expect(completions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "route", kind: "keyword" }),
        expect.objectContaining({ label: "warning", kind: "enum" }),
        expect.objectContaining({ label: "SL-INDEX-001", kind: "reference" })
      ])
    );
  });

  it("formats documents using the shared DSL formatter", () => {
    const formatted = formatSearchLintDocumentText(`language 1
site "https://example.com"
route "/products/**" { indexable true }
`);

    expect(formatted).toContain('route "/products/**" {');
    expect(formatted).toContain("  indexable true");
  });

  it("returns safe local quick fixes", () => {
    const source = `site "https://example.com"
route "/bad" {
  severity SL-INDEX-001 fatal
  suppress SL-TITLE-003 {
    reason ""
  }
}
`;
    const diagnostics = createSearchLintDocumentDiagnostics(source).diagnostics;
    const actions = createSearchLintDocumentCodeActions(
      "file:///searchlint.seo",
      source,
      diagnostics
    );

    expect(actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: "Add SearchLint language version" }),
        expect.objectContaining({ title: "Replace with severity 'warning'" }),
        expect.objectContaining({
          title: "Replace suppression reason with placeholder"
        })
      ])
    );
  });

  it("resolves same-document policy definitions and references", () => {
    const source = `language 1
site "https://example.com"
policy productPage {
  indexable true
}
route "/products/**" {
  use productPage
}
`;

    expect(
      createSearchLintDocumentDefinition("file:///searchlint.seo", source, {
        line: 6,
        character: 7
      })
    ).toEqual({
      uri: "file:///searchlint.seo",
      range: {
        start: { line: 2, character: 7 },
        end: { line: 2, character: 18 }
      }
    });
    expect(
      createSearchLintDocumentReferences("file:///searchlint.seo", source, {
        line: 6,
        character: 7
      }).map((location) => location.range.start)
    ).toEqual([
      { line: 2, character: 7 },
      { line: 6, character: 6 }
    ]);
  });

  it("renames same-document policy and variable references safely", () => {
    const source = `language 1
site "https://example.com"
let schemas ["Product"]
policy productPage {
  schema $schemas
}
route "/products/**" {
  use productPage
}
`;

    expect(
      createSearchLintDocumentRenameEdit(
        "file:///searchlint.seo",
        source,
        { line: 7, character: 7 },
        "catalogPage"
      )
    ).toEqual({
      changes: {
        "file:///searchlint.seo": [
          {
            range: {
              start: { line: 3, character: 7 },
              end: { line: 3, character: 18 }
            },
            newText: "catalogPage"
          },
          {
            range: {
              start: { line: 7, character: 6 },
              end: { line: 7, character: 17 }
            },
            newText: "catalogPage"
          }
        ]
      }
    });
    const variableRename = createSearchLintDocumentRenameEdit(
      "file:///searchlint.seo",
      source,
      { line: 4, character: 11 },
      "productSchemas"
    );
    expect(variableRename).toBeDefined();
    expect(
      variableRename?.changes["file:///searchlint.seo"]?.map(
        (edit) => edit.range.start
      )
    ).toEqual([
      { line: 2, character: 4 },
      { line: 4, character: 10 }
    ]);
    expect(
      createSearchLintDocumentRenameEdit(
        "file:///searchlint.seo",
        source,
        { line: 7, character: 7 },
        "not valid"
      )
    ).toBeUndefined();
  });
});
