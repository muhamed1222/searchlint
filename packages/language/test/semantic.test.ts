import { describe, expect, it } from "vitest";

import {
  compileSearchLintProject,
  compileSearchLintDocument,
  parseSearchLintDocument
} from "../src/index.js";

function compile(source: string) {
  const parsed = parseSearchLintDocument(source);
  expect(parsed.diagnostics).toEqual([]);
  return compileSearchLintDocument(parsed.ast);
}

describe("compileSearchLintDocument", () => {
  it("compiles routes, indexability, severity overrides, and suppressions", () => {
    const result = compile(`language 1
site "https://example.com"
route "/products/**" {
  indexable true
  severity SL-INDEX-001 blocker
  suppress SL-TITLE-003 {
    reason "Legacy title migration"
  }
}
route "/admin/**" {
  indexable false
}
`);

    expect(result.diagnostics).toEqual([]);
    expect(result.config?.siteUrl).toBe("https://example.com");
    expect(result.config?.routeContracts).toEqual([
      {
        route: "/admin/**",
        indexable: false
      },
      {
        route: "/products/**",
        indexable: true,
        requiredSeverityOverrides: {
          "SL-INDEX-001": "blocker"
        }
      }
    ]);
    expect(result.config?.suppressions).toEqual([
      {
        ruleId: "SL-TITLE-003",
        reason: "Legacy title migration",
        route: "/products/**"
      }
    ]);
  });

  it("compiles public config v1 deterministically with policies, groups, providers, and custom rules", () => {
    const result = compile(`language 1
site "https://example.com"
let schemas ["Product", "BreadcrumbList"]
policy productPage {
  schema $schemas
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
route "/products/**" {
  indexable false
}
`);

    expect(result.diagnostics).toEqual([]);
    expect(result.config).toMatchObject({
      contractVersion: 1,
      languageVersion: 1,
      siteUrl: "https://example.com",
      variables: { schemas: ["Product", "BreadcrumbList"] },
      policies: ["productPage"],
      routePrecedence: ["/products/[slug]", "/products/**"],
      providerRules: [
        {
          provider: "google",
          route: "/products/[slug]",
          ruleId: "SL-GOOGLE-RICH-001",
          required: ["rich-result"]
        }
      ],
      customRules: [
        {
          route: "/products/[slug]",
          id: "@acme/searchlint-rule",
          severity: "warning"
        }
      ]
    });
    expect(result.config?.routeContracts).toEqual([
      {
        route: "/products/[slug]",
        indexable: true,
        canonicalPolicy: "self",
        requiredSchemas: ["Product", "BreadcrumbList"],
        requiredSeverityOverrides: {
          "SL-SCHEMA-001": "error"
        }
      },
      {
        route: "/products/**",
        indexable: false
      }
    ]);
    expect(JSON.stringify(result.config)).toBe(JSON.stringify(result.config));
  });

  it("applies environment declarations after the base document", () => {
    const parsed = parseSearchLintDocument(`language 1
site "https://staging.example.com"
route "/public/**" {
  indexable true
}
environment production {
  site "https://www.example.com"
  route "/admin/**" {
    indexable false
  }
}
`);
    const result = compileSearchLintDocument(parsed.ast, {
      environment: "production"
    });

    expect(result.diagnostics).toEqual([]);
    expect(result.config?.siteUrl).toBe("https://www.example.com");
    expect(result.config?.environment).toBe("production");
    expect(result.config?.routeContracts.map((route) => route.route)).toEqual([
      "/admin/**",
      "/public/**"
    ]);
  });

  it("resolves imports and rejects import cycles", async () => {
    const result = await compileSearchLintProject(
      `language 1
import "./policies.seo"
site "https://example.com"
route "/products/**" {
  use productPage
}
`,
      {
        path: "/repo/searchlint.seo",
        resolveImport(input) {
          expect(input).toEqual({
            path: "./policies.seo",
            fromPath: "/repo/searchlint.seo"
          });
          return {
            path: "/repo/policies.seo",
            source: `policy productPage {
  schema Product
}
`
          };
        }
      }
    );

    expect(result.diagnostics).toEqual([]);
    expect(result.loadedPaths).toEqual([
      "/repo/searchlint.seo",
      "/repo/policies.seo"
    ]);
    expect(result.config?.routeContracts[0]?.requiredSchemas).toEqual([
      "Product"
    ]);

    const cycle = await compileSearchLintProject(
      `language 1
import "./loop.seo"
site "https://example.com"
`,
      {
        path: "/repo/searchlint.seo",
        resolveImport() {
          return {
            path: "/repo/searchlint.seo",
            source: `language 1
site "https://example.com"
`
          };
        }
      }
    );

    expect(cycle.config).toBeUndefined();
    expect(cycle.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "SLANG230"
    );
  });

  it("reports missing site and unsupported language version", () => {
    const result = compile(`language 99
route "/products/**" {
  indexable true
}
`);

    expect(result.config).toBeUndefined();
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "SLANG207",
      "SLANG208"
    ]);
  });

  it("reports duplicate routes and invalid indexable values", () => {
    const result = compile(`language 1
site "https://example.com"
route "/dup" {
  indexable yes
}
route "/dup" {
  indexable false
}
`);

    expect(result.config).toBeUndefined();
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "SLANG201"
    );
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "SLANG209"
    );
  });

  it("rejects duplicate base site declarations without rejecting environment overrides", () => {
    const duplicate = compile(`language 1
site "https://one.example.com"
site "https://two.example.com"
route "/**" {
  indexable true
}
`);

    expect(duplicate.config).toBeUndefined();
    expect(
      duplicate.diagnostics.map((diagnostic) => diagnostic.code)
    ).toContain("SLANG227");

    const overrideParsed = parseSearchLintDocument(`language 1
site "https://staging.example.com"
environment production {
  site "https://www.example.com"
}
route "/**" {
  indexable true
}
`);
    const override = compileSearchLintDocument(overrideParsed.ast, {
      environment: "production"
    });

    expect(override.diagnostics).toEqual([]);
    expect(override.config?.siteUrl).toBe("https://www.example.com");
  });

  it("validates severity and suppression shape", () => {
    const result = compile(`language 1
site "https://example.com"
route "/bad" {
  severity SL-INDEX-001 fatal
  suppress SL-TITLE-003 {
    reason ""
  }
}
`);

    expect(result.config).toBeUndefined();
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "SLANG203"
    );
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "SLANG205"
    );
  });

  it("rejects unknown policies, variables, providers, route members, and environments", () => {
    const parsed = parseSearchLintDocument(`language 1
site "https://example.com"
route "relative" {
  use missingPolicy
  schema $missing
  provider bing {
    require rich-result
  }
  typo true
}
`);
    const result = compileSearchLintDocument(parsed.ast, {
      environment: "missing"
    });

    expect(result.config).toBeUndefined();
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
      expect.arrayContaining([
        "SLANG229",
        "SLANG213",
        "SLANG210",
        "SLANG219",
        "SLANG214",
        "SLANG216"
      ])
    );
  });

  it("reports exact semantic source locations", () => {
    const result = compile(`language 1
site "https://example.com"
route "/products/**" {
  indexable maybe
}
`);
    const diagnostic = result.diagnostics.find(
      (item) => item.code === "SLANG201"
    );

    expect(diagnostic?.span.start).toEqual({ offset: 73, line: 4, column: 13 });
    expect(diagnostic?.span.end.line).toBe(4);
    expect(diagnostic?.span.end.column).toBe(18);
  });
});
