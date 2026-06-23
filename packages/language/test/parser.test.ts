import { describe, expect, it } from "vitest";

import {
  formatSearchLintDocument,
  parseSearchLintDocument
} from "../src/index.js";

const documentedExample = `language 1

site "https://example.com"

route "/products/**" {
  type Product
  indexable true
  canonical self

  title {
    required true
  }

  description {
    required true
  }

  schema Product
}

route "/admin/**" {
  indexable false
}
`;

describe("parseSearchLintDocument", () => {
  it("parses the documented language example", () => {
    const result = parseSearchLintDocument(documentedExample);

    expect(result.diagnostics).toEqual([]);
    expect(result.ast.declarations).toHaveLength(4);
    expect(result.ast.declarations[0]?.kind).toBe("LanguageDeclaration");
    expect(result.ast.declarations[1]?.kind).toBe("SiteDeclaration");
    expect(result.ast.declarations[2]?.kind).toBe("RouteDeclaration");
  });

  it("preserves route policies and nested blocks in one shared AST", () => {
    const result = parseSearchLintDocument(`language 1
site "https://example.com"
route "/blog/**" {
  provider google {
    severity SL-INDEX-001 blocker
  }
  suppress SL-TITLE-003 {
    reason "Legacy title migration"
  }
}
`);

    expect(result.diagnostics).toEqual([]);
    const route = result.ast.declarations[2];
    expect(route?.kind).toBe("RouteDeclaration");
    if (route?.kind !== "RouteDeclaration") {
      throw new Error("expected route declaration");
    }

    expect(route.body).toHaveLength(2);
    expect(route.body[0]?.kind).toBe("BlockDeclaration");
    expect(route.body[1]?.kind).toBe("BlockDeclaration");
  });

  it("parses language v1 public config constructs", () => {
    const result = parseSearchLintDocument(`language 1
import "./shared.seo"
site "https://example.com"
let schemas ["Product", "BreadcrumbList"]

policy productPage {
  schema $schemas
  title {
    required true
  }
}

group "catalog" {
  route "/products/[slug]" {
    use productPage
    provider google {
      require ["rich-result"]
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
  }
}
`);

    expect(result.diagnostics).toEqual([]);
    expect(
      result.ast.declarations.map((declaration) => declaration.kind)
    ).toEqual([
      "LanguageDeclaration",
      "ImportDeclaration",
      "SiteDeclaration",
      "VariableDeclaration",
      "PolicyDeclaration",
      "RouteGroupDeclaration",
      "EnvironmentDeclaration"
    ]);
  });

  it("reports stable syntax diagnostics with spans", () => {
    const result = parseSearchLintDocument(`language
site "https://example.com
`);

    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "SLANG100"
    );
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "SLANG001"
    );
    expect(result.diagnostics[0]?.span.start.line).toBeGreaterThan(0);
    expect(result.diagnostics[0]?.span.start.column).toBeGreaterThan(0);
  });

  it("formats parsed documents deterministically", () => {
    const first = parseSearchLintDocument(documentedExample);
    const formatted = formatSearchLintDocument(first.ast);
    const second = parseSearchLintDocument(formatted);

    expect(second.diagnostics).toEqual([]);
    expect(formatSearchLintDocument(second.ast)).toBe(formatted);
    expect(formatted).toContain('route "/products/**" {');
    expect(formatted).toContain("  indexable true");
  });

  it("round-trips lists, variables, groups, policies, and environments", () => {
    const source = `language 1
site "https://example.com"
let schemas ["Product", "BreadcrumbList"]
policy productPage {
  schema $schemas
}
group "catalog" {
  route "/products/**" {
    use productPage
  }
}
`;
    const first = parseSearchLintDocument(source);
    const formatted = formatSearchLintDocument(first.ast);
    const second = parseSearchLintDocument(formatted);

    expect(first.diagnostics).toEqual([]);
    expect(second.diagnostics).toEqual([]);
    expect(formatSearchLintDocument(second.ast)).toBe(formatted);
    expect(formatted).toContain('let schemas ["Product", "BreadcrumbList"]');
    expect(formatted).toContain('  route "/products/**" {');
  });
});
