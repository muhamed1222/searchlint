import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  compileSearchLintProject,
  parseSearchLintDocument
} from "../src/index.js";

const fixturesDirectory = join(
  dirname(fileURLToPath(import.meta.url)),
  "fixtures"
);

function readFixture(name: string): string {
  return readFileSync(join(fixturesDirectory, name), "utf8");
}

describe("SearchLint language fixtures", () => {
  it("parses and compiles the valid public searchlint.seo fixture", async () => {
    const result = await compileSearchLintProject(
      readFixture("valid-public.seo"),
      {
        path: join(fixturesDirectory, "valid-public.seo"),
        environment: "production",
        resolveImport(input) {
          return {
            path: join(fixturesDirectory, input.path.replace("./", "")),
            source: readFixture(input.path.replace("./", ""))
          };
        }
      }
    );

    expect(result.diagnostics).toEqual([]);
    expect(result.config).toMatchObject({
      contractVersion: 1,
      languageVersion: 1,
      environment: "production",
      siteUrl: "https://www.example.com",
      policies: ["productPage", "sharedPolicy"],
      routePrecedence: ["/admin/**", "/products/[slug]"]
    });
    expect(result.config?.routeContracts).toEqual([
      {
        route: "/admin/**",
        indexable: false
      },
      {
        route: "/products/[slug]",
        indexable: true,
        canonicalPolicy: "self",
        hreflang: ["en", "ru"],
        requiredSchemas: ["BreadcrumbList", "Product", "BreadcrumbList"]
      }
    ]);
  });

  it("reports invalid syntax fixture diagnostics before semantic compile", () => {
    const parsed = parseSearchLintDocument(readFixture("invalid-syntax.seo"));

    expect(parsed.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "SLANG002"
    );
    expect(parsed.diagnostics[0]?.span.start.line).toBe(5);
  });

  it("reports semantic fixture diagnostics without silent fallback", async () => {
    const result = await compileSearchLintProject(
      readFixture("semantic-errors.seo"),
      {
        path: join(fixturesDirectory, "semantic-errors.seo")
      }
    );

    expect(result.config).toBeUndefined();
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
      expect.arrayContaining([
        "SLANG201",
        "SLANG210",
        "SLANG213",
        "SLANG216",
        "SLANG219"
      ])
    );
    for (const diagnostic of result.diagnostics) {
      expect(diagnostic.message).not.toMatch(/fallback|coerc/i);
      expect(diagnostic.span.start.line).toBeGreaterThan(0);
      expect(diagnostic.span.start.column).toBeGreaterThan(0);
    }
  });
});
