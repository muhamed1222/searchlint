import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  formatEngineResult,
  parseCliArgs,
  runSearchLintCli,
  shouldFail,
  type CliIo
} from "../src/index.js";

const localRuleIdsByCategory = {
  "http-rendering": [
    "SL-HTTP-001",
    "SL-HTTP-002",
    "SL-HTTP-003",
    "SL-HTTP-004",
    "SL-HTTP-005",
    "SL-HTTP-006",
    "SL-HTTP-007",
    "SL-HTTP-008",
    "SL-HTTP-009",
    "SL-HTTP-010",
    "SL-HTTP-011",
    "SL-HTTP-012"
  ],
  indexability: [
    "SL-INDEX-001",
    "SL-INDEX-002",
    "SL-INDEX-003",
    "SL-INDEX-004",
    "SL-INDEX-005",
    "SL-INDEX-006",
    "SL-INDEX-007",
    "SL-INDEX-008",
    "SL-INDEX-009",
    "SL-INDEX-010",
    "SL-INDEX-011",
    "SL-INDEX-012",
    "SL-INDEX-013",
    "SL-INDEX-014"
  ],
  "title-metadata": [
    "SL-META-001",
    "SL-META-002",
    "SL-META-003",
    "SL-META-004",
    "SL-META-005",
    "SL-META-006",
    "SL-META-007",
    "SL-META-008",
    "SL-META-009",
    "SL-META-010",
    "SL-META-011",
    "SL-META-012",
    "SL-META-013",
    "SL-META-014",
    "SL-META-015",
    "SL-META-016",
    "SL-META-017",
    "SL-META-018"
  ],
  "canonical-hreflang": [
    "SL-CANON-001",
    "SL-CANON-002",
    "SL-CANON-003",
    "SL-CANON-004",
    "SL-CANON-005",
    "SL-CANON-006",
    "SL-CANON-007",
    "SL-CANON-008",
    "SL-CANON-009",
    "SL-CANON-010",
    "SL-CANON-011",
    "SL-CANON-012",
    "SL-CANON-013",
    "SL-CANON-014",
    "SL-CANON-015",
    "SL-CANON-016"
  ],
  "headings-structure": [
    "SL-HEAD-001",
    "SL-HEAD-002",
    "SL-HEAD-003",
    "SL-HEAD-004",
    "SL-HEAD-005",
    "SL-HEAD-006",
    "SL-HEAD-007",
    "SL-HEAD-008"
  ],
  "images-social-preview": [
    "SL-IMG-001",
    "SL-IMG-002",
    "SL-IMG-003",
    "SL-IMG-004",
    "SL-IMG-005",
    "SL-IMG-006",
    "SL-IMG-007",
    "SL-IMG-008",
    "SL-IMG-009",
    "SL-IMG-010",
    "SL-IMG-011",
    "SL-IMG-012"
  ],
  "schema-org": [
    "SL-SCHEMA-001",
    "SL-SCHEMA-002",
    "SL-SCHEMA-003",
    "SL-SCHEMA-004",
    "SL-SCHEMA-005",
    "SL-SCHEMA-006",
    "SL-SCHEMA-007",
    "SL-SCHEMA-008",
    "SL-SCHEMA-009",
    "SL-SCHEMA-010"
  ],
  "links-site-graph": [
    "SL-LINK-001",
    "SL-LINK-002",
    "SL-LINK-003",
    "SL-LINK-004",
    "SL-LINK-005",
    "SL-LINK-006",
    "SL-LINK-007",
    "SL-LINK-008",
    "SL-LINK-009",
    "SL-LINK-010",
    "SL-LINK-011",
    "SL-LINK-012",
    "SL-LINK-013",
    "SL-LINK-014"
  ],
  "robots-sitemap": [
    "SL-ROBOTS-001",
    "SL-ROBOTS-002",
    "SL-ROBOTS-003",
    "SL-ROBOTS-004",
    "SL-ROBOTS-005",
    "SL-ROBOTS-006",
    "SL-ROBOTS-007",
    "SL-ROBOTS-008",
    "SL-ROBOTS-009",
    "SL-ROBOTS-010"
  ],
  "performance-technical": [
    "SL-PERF-001",
    "SL-PERF-002",
    "SL-PERF-003",
    "SL-PERF-004",
    "SL-PERF-005",
    "SL-PERF-006"
  ]
} as const;

const catalog = createCatalog();
const realCatalogPath = "../../specs/RULE_CATALOG.yaml";
const snapshot = {
  pageUrl: "https://example.com/products/1",
  route: "/products/**",
  capturedAt: "2026-06-20T00:00:00.000Z",
  http: {
    statusCode: 200,
    finalUrl: "https://example.com/products/1",
    headers: { "content-type": "text/html" },
    redirectChain: []
  },
  rawHtml:
    '<html lang="en"><head><title>Product</title></head><body><h1>Product</h1></body></html>',
  renderedDom:
    '<html lang="en"><head><title>Product</title></head><body><h1>Product</h1></body></html>'
};

describe("parseCliArgs", () => {
  it("requires snapshot and catalog paths", () => {
    expect(parseCliArgs(["--snapshot", "snapshot.json"])).toEqual({
      ok: false,
      error: "Missing required --catalog path."
    });

    expect(parseCliArgs(["--catalog", "catalog.yaml"])).toEqual({
      ok: false,
      error: "Missing required --snapshot or --crawl path."
    });
  });

  it("parses supported options", () => {
    expect(
      parseCliArgs([
        "--snapshot",
        "snapshot.json",
        "--catalog",
        "catalog.yaml",
        "--baseline",
        "baseline.json",
        "--config",
        "searchlint.seo",
        "--source-file",
        "app/products/[slug]/page.tsx",
        "--source-file",
        "app/products/[slug]/layout.tsx",
        "--next-project-file",
        "app/products/[slug]/page.tsx",
        "--next-project-root",
        "/repo",
        "--format",
        "json",
        "--fail-on",
        "warning",
        "--now",
        "2026-06-20T00:00:00.000Z"
      ])
    ).toEqual({
      ok: true,
      options: {
        mode: "snapshot",
        snapshotPath: "snapshot.json",
        catalogPath: "catalog.yaml",
        baselinePath: "baseline.json",
        configPath: "searchlint.seo",
        sourceFilePaths: [
          "app/products/[slug]/page.tsx",
          "app/products/[slug]/layout.tsx"
        ],
        nextProjectFilePaths: ["app/products/[slug]/page.tsx"],
        nextProjectRoots: ["/repo"],
        format: "json",
        failOn: "warning",
        now: "2026-06-20T00:00:00.000Z"
      }
    });
  });

  it("parses crawl options", () => {
    expect(
      parseCliArgs([
        "--crawl",
        "https://example.com/",
        "--catalog",
        "catalog.yaml",
        "--max-urls",
        "10",
        "--max-depth",
        "5",
        "--max-links-per-page",
        "50",
        "--max-query-variants-per-path",
        "3",
        "--max-response-bytes",
        "1000",
        "--max-redirects",
        "4",
        "--retry-attempts",
        "2",
        "--request-timeout-ms",
        "250",
        "--allow-private-networks",
        "false",
        "--same-origin",
        "false",
        "--respect-robots",
        "true",
        "--user-agent",
        "SearchLintBot",
        "--checkpoint",
        "crawl.checkpoint.json",
        "--resume",
        "previous.checkpoint.json",
        "--format",
        "json",
        "--fail-on",
        "warning"
      ])
    ).toEqual({
      ok: true,
      options: {
        mode: "crawl",
        catalogPath: "catalog.yaml",
        crawl: {
          startUrl: "https://example.com/",
          maxUrls: 10,
          maxDepth: 5,
          maxLinksPerPage: 50,
          maxQueryVariantsPerPath: 3,
          maxResponseBytes: 1000,
          maxRedirects: 4,
          retryAttempts: 2,
          requestTimeoutMs: 250,
          allowPrivateNetworks: false,
          sameOrigin: false,
          respectRobotsTxt: true,
          userAgent: "SearchLintBot"
        },
        checkpointPath: "crawl.checkpoint.json",
        resumePath: "previous.checkpoint.json",
        format: "json",
        failOn: "warning"
      }
    });
  });

  it("rejects crawl recovery flags in snapshot mode", () => {
    expect(
      parseCliArgs([
        "--snapshot",
        "snapshot.json",
        "--catalog",
        "catalog.yaml",
        "--checkpoint",
        "crawl.checkpoint.json"
      ])
    ).toEqual({
      ok: false,
      error: "--checkpoint is only supported in crawl mode."
    });
    expect(
      parseCliArgs([
        "--snapshot",
        "snapshot.json",
        "--catalog",
        "catalog.yaml",
        "--resume",
        "crawl.checkpoint.json"
      ])
    ).toEqual({
      ok: false,
      error: "--resume is only supported in crawl mode."
    });
  });

  it("accepts CI reporter output formats", () => {
    expect(
      parseCliArgs([
        "--snapshot",
        "snapshot.json",
        "--catalog",
        "catalog.yaml",
        "--format",
        "sarif"
      ])
    ).toMatchObject({
      ok: true,
      options: {
        format: "sarif"
      }
    });

    expect(
      parseCliArgs([
        "--snapshot",
        "snapshot.json",
        "--catalog",
        "catalog.yaml",
        "--format",
        "junit"
      ])
    ).toMatchObject({
      ok: true,
      options: {
        format: "junit"
      }
    });

    expect(
      parseCliArgs([
        "--snapshot",
        "snapshot.json",
        "--catalog",
        "catalog.yaml",
        "--format",
        "html"
      ])
    ).toMatchObject({
      ok: true,
      options: {
        format: "html"
      }
    });
  });
});

describe("runSearchLintCli", () => {
  it("prints public command usage", async () => {
    const result = await runSearchLintCli(["--help"], createIo({}));

    expect(result.exitCode, result.stderr).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("searchlint check --snapshot");
    expect(result.stdout).toContain("searchlint crawl --url");
    expect(result.stdout).toContain("searchlint doctor");
    expect(result.stdout).toContain("searchlint completion <bash|zsh|fish>");
    expect(result.stdout).toContain("searchlint --version");
    expect(result.stdout).toContain("Exit codes:");
  });

  it("prints version diagnostics", async () => {
    const result = await runSearchLintCli(["--version"], createIo({}));

    expect(result).toMatchObject({
      exitCode: 0,
      stdout: "searchlint 1.0.0-beta.0\n",
      stderr: ""
    });
  });

  it("prints doctor diagnostics", async () => {
    const result = await runSearchLintCli(["doctor"], createIo({}));

    expect(result.exitCode, result.stderr).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("SearchLint doctor");
    expect(result.stdout).toContain("version: 1.0.0-beta.0");
    expect(result.stdout).toContain("node: >=24.0.0 required");
    expect(result.stdout).toContain("status: local CLI runtime checks passed");
  });

  it("prints shell completion scripts", async () => {
    const bash = await runSearchLintCli(["completion", "bash"], createIo({}));
    const zsh = await runSearchLintCli(["completion", "zsh"], createIo({}));
    const fish = await runSearchLintCli(["completion", "fish"], createIo({}));

    expect(bash.exitCode, bash.stderr).toBe(0);
    expect(bash.stdout).toContain(
      "complete -F _searchlint_completion searchlint"
    );
    expect(bash.stdout).toContain("check crawl init doctor completion");

    expect(zsh.exitCode, zsh.stderr).toBe(0);
    expect(zsh.stdout).toContain("#compdef searchlint");
    expect(zsh.stdout).toContain("compdef _searchlint searchlint");

    expect(fish.exitCode, fish.stderr).toBe(0);
    expect(fish.stdout).toContain("complete -c searchlint");
  });

  it("rejects unsupported completion shells", async () => {
    const result = await runSearchLintCli(
      ["completion", "powershell"],
      createIo({})
    );

    expect(result).toMatchObject({
      exitCode: 1,
      stdout: "",
      stderr: "Usage: searchlint completion <bash|zsh|fish>"
    });
  });

  it("runs the public check command through snapshot analysis", async () => {
    const result = await runSearchLintCli(
      [
        "check",
        "--snapshot",
        "snapshot.json",
        "--catalog",
        "catalog.yaml",
        "--format",
        "json",
        "--fail-on",
        "none"
      ],
      createIo({
        "catalog.yaml": catalog,
        "snapshot.json": JSON.stringify(snapshot)
      })
    );

    expect(result.exitCode, result.stderr).toBe(0);
    expect(result.engineResult?.executedRuleIds.length).toBe(120);
    expect(JSON.parse(result.stdout)).toMatchObject({
      diagnostics: expect.any(Array),
      executedRuleIds: expect.any(Array)
    });
  });

  it("runs the public check command with HTML report output", async () => {
    const result = await runSearchLintCli(
      [
        "check",
        "--snapshot",
        "snapshot.json",
        "--catalog",
        "catalog.yaml",
        "--format",
        "html",
        "--fail-on",
        "none"
      ],
      createIo({
        "catalog.yaml": catalog,
        "snapshot.json": JSON.stringify(snapshot)
      })
    );

    expect(result.exitCode, result.stderr).toBe(0);
    expect(result.stdout).toContain("<!doctype html>");
    expect(result.stdout).toContain("SearchLint Check Report");
    expect(result.stdout).toContain("Executive Summary");
    expect(result.stdout).toContain("Developer Diagnostics");
  });

  it("runs the public crawl command with --url", async () => {
    const result = await runSearchLintCli(
      [
        "crawl",
        "--url",
        "https://example.com/",
        "--catalog",
        "catalog.yaml",
        "--format",
        "json",
        "--fail-on",
        "none",
        "--respect-robots",
        "false"
      ],
      createIo(
        {
          "catalog.yaml": catalog
        },
        undefined,
        false,
        {
          "https://example.com/": {
            url: "https://example.com/",
            statusCode: 200,
            headers: { "content-type": "text/html" },
            body: '<html lang="en"><head><title>Home</title></head><body><h1>Home</h1></body></html>'
          }
        }
      )
    );

    expect(result.exitCode, result.stderr).toBe(0);
    expect(result.crawlAnalysis?.pageResults).toHaveLength(1);
    expect(JSON.parse(result.stdout)).toMatchObject({
      crawlResult: expect.any(Object),
      diagnostics: expect.any(Array)
    });
  });

  it("runs the public crawl command with HTML report output", async () => {
    const result = await runSearchLintCli(
      [
        "crawl",
        "--url",
        "https://example.com/",
        "--catalog",
        "catalog.yaml",
        "--format",
        "html",
        "--fail-on",
        "none",
        "--respect-robots",
        "false"
      ],
      createIo(
        {
          "catalog.yaml": catalog
        },
        undefined,
        false,
        {
          "https://example.com/": {
            url: "https://example.com/",
            statusCode: 200,
            headers: { "content-type": "text/html" },
            body: '<html lang="en"><head><title>Home</title></head><body><h1>Home</h1></body></html>'
          }
        }
      )
    );

    expect(result.exitCode, result.stderr).toBe(0);
    expect(result.stdout).toContain("<!doctype html>");
    expect(result.stdout).toContain("SearchLint Crawl Report");
    expect(result.stdout).toContain("Client / White-Label Summary");
  });

  it("emits a deterministic starter config from init --print-config", async () => {
    const result = await runSearchLintCli(
      ["init", "--print-config"],
      createIo({})
    );

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("language 1");
    expect(result.stdout).toContain('site "https://example.com"');
    expect(result.stdout).toContain('route "/"');
  });

  it("initializes a Next.js project for local dev badge onboarding", async () => {
    const files: Record<string, string> = {
      "package.json": JSON.stringify({
        scripts: { dev: "next dev" },
        dependencies: { next: "16.2.9" }
      }),
      "next.config.mjs":
        "const nextConfig = { reactStrictMode: true };\n\nexport default nextConfig;\n"
    };
    const result = await runSearchLintCli(
      ["init"],
      createIo(files, undefined, true)
    );

    expect(result.exitCode, result.stderr).toBe(0);
    expect(result.stdout).toContain(
      "SearchLint initialized for local Next.js development."
    );
    expect(files["searchlint.seo"]).toContain("language 1");
    expect(files["next.config.mjs"]).toContain(
      'import { withSearchLint } from "@searchlint/next";'
    );
    expect(files["next.config.mjs"]).toContain(
      "export default withSearchLint(nextConfig);"
    );
    expect(JSON.parse(files["package.json"] ?? "{}").scripts).toMatchObject({
      dev: "next dev",
      searchlint: "searchlint doctor",
      "searchlint:config": "searchlint config validate --config searchlint.seo"
    });
  });

  it("keeps Next.js project initialization idempotent", async () => {
    const files = {
      "package.json": JSON.stringify({
        scripts: {
          dev: "next dev",
          searchlint: "searchlint doctor",
          "searchlint:config":
            "searchlint config validate --config searchlint.seo"
        },
        dependencies: { next: "16.2.9" }
      }),
      "searchlint.seo": 'language 1\n\nsite "https://example.com"\n',
      "next.config.mjs":
        'import { withSearchLint } from "@searchlint/next";\nconst nextConfig = {};\nexport default withSearchLint(nextConfig);\n'
    };
    const before = { ...files };
    const result = await runSearchLintCli(
      ["init"],
      createIo(files, undefined, true)
    );

    expect(result.exitCode, result.stderr).toBe(0);
    expect(files).toEqual(before);
    expect(result.stdout).toContain("Created: none");
    expect(result.stdout).toContain("Updated: none");
  });

  it("patches CommonJS Next.js configs with a dynamic ESM import", async () => {
    const files = {
      "package.json": JSON.stringify({ dependencies: { next: "16.2.9" } }),
      "next.config.cjs":
        "const nextConfig = { poweredByHeader: false };\nmodule.exports = nextConfig;\n"
    };
    const result = await runSearchLintCli(
      ["init"],
      createIo(files, undefined, true)
    );

    expect(result.exitCode, result.stderr).toBe(0);
    expect(files["next.config.cjs"]).toContain(
      'const { withSearchLint } = await import("@searchlint/next");'
    );
    expect(files["next.config.cjs"]).toContain(
      "return withSearchLint(__searchlintNextConfig)(phase, defaults);"
    );
  });

  it("fails clearly for unsupported TypeScript Next.js config patching", async () => {
    const result = await runSearchLintCli(
      ["init"],
      createIo(
        {
          "package.json": JSON.stringify({ dependencies: { next: "16.2.9" } }),
          "next.config.ts": "export default {};\n"
        },
        undefined,
        true
      )
    );

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("next.config.ts");
    expect(result.stderr).toContain("not supported yet");
  });

  it("validates explicit and discovered SearchLint configs", async () => {
    const validConfig = `language 1

site "https://example.com"

route "/" {
  indexable true
}
`;

    const explicit = await runSearchLintCli(
      ["config", "validate", "--config", "custom.seo"],
      createIo({ "custom.seo": validConfig })
    );
    const discovered = await runSearchLintCli(
      ["config", "validate"],
      createIo({ "searchlint.seo": validConfig }, undefined, true)
    );

    expect(explicit).toMatchObject({
      exitCode: 0,
      stdout: "custom.seo is valid.\n",
      stderr: ""
    });
    expect(discovered).toMatchObject({
      exitCode: 0,
      stdout: "searchlint.seo is valid.\n",
      stderr: ""
    });
  });

  it("returns exit code 1 for invalid public config validation", async () => {
    const result = await runSearchLintCli(
      ["config", "validate", "--config", "searchlint.seo"],
      createIo({
        "searchlint.seo": `language 99
`
      })
    );

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain(
      "searchlint.seo contains invalid SearchLint config."
    );
    expect(result.stderr).toContain("Diagnostics: 2");
    expect(result.stderr).toContain("- SLANG207 at line 1, column 10:");
    expect(result.stderr).toContain("- SLANG208 at line 1, column 1:");
    expect(result.stderr).toContain(
      "Next step: fix the config and run `searchlint config validate --config searchlint.seo`."
    );
  });

  it("migrates language version 1 configs without rewriting comments", async () => {
    const files: Record<string, string> = {
      "searchlint.seo": `# Project policy
language 1

site "https://example.com"

route "/" {
  // Keep this note during migration.
  indexable true
}
`
    };

    const result = await runSearchLintCli(
      [
        "migrate-config",
        "--from",
        "1",
        "--to",
        "1",
        "--write",
        "searchlint.seo"
      ],
      createIo(files)
    );

    expect(result).toMatchObject({
      exitCode: 0,
      stdout:
        "searchlint.seo already uses language 1; no migration was needed. Backup written to searchlint.seo.bak.\n",
      stderr: ""
    });
    expect(files["searchlint.seo"]).toContain("# Project policy");
    expect(files["searchlint.seo"]).toContain(
      "// Keep this note during migration."
    );
    expect(files["searchlint.seo.bak"]).toBe(files["searchlint.seo"]);
  });

  it("uses atomic writes for config migration when available", async () => {
    const files: Record<string, string> = {
      "searchlint.seo": `language 1

site "https://example.com"
`
    };
    const atomicWrites: string[] = [];

    const result = await runSearchLintCli(
      [
        "migrate-config",
        "--from",
        "1",
        "--to",
        "1",
        "--write",
        "searchlint.seo"
      ],
      createIo(files, undefined, false, undefined, atomicWrites)
    );

    expect(result.exitCode).toBe(0);
    expect(atomicWrites).toEqual(["searchlint.seo.bak", "searchlint.seo"]);
    expect(files["searchlint.seo.bak"]).toBe(files["searchlint.seo"]);
  });

  it("rejects unsupported config migration target versions", async () => {
    const files = {
      "searchlint.seo": `language 1

site "https://example.com"
`
    };

    const result = await runSearchLintCli(
      [
        "migrate-config",
        "--from",
        "1",
        "--to",
        "2",
        "--write",
        "searchlint.seo"
      ],
      createIo(files)
    );

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Unsupported target language version 2");
    expect(files["searchlint.seo"]).toBe(`language 1

site "https://example.com"
`);
  });

  it("requires complete config migration arguments", async () => {
    const result = await runSearchLintCli(
      ["migrate-config", "--from", "1", "--to", "1"],
      createIo({})
    );

    expect(result).toMatchObject({
      exitCode: 1,
      stdout: "",
      stderr:
        "Usage: searchlint migrate-config --from 1 --to 1 --write searchlint.seo"
    });
  });

  it("emits deterministic baseline entries without failing on diagnostics", async () => {
    const result = await runSearchLintCli(
      ["baseline", "--snapshot", "snapshot.json", "--catalog", "catalog.yaml"],
      createIo({
        "catalog.yaml": catalog,
        "snapshot.json": JSON.stringify({
          ...snapshot,
          rawHtml: "<html><body></body></html>",
          renderedDom: "<html><body></body></html>"
        })
      })
    );

    const parsed = JSON.parse(result.stdout);
    expect(result.exitCode).toBe(0);
    expect(parsed.entries.length).toBeGreaterThan(0);
    expect(parsed.entries[0]).toEqual({
      fingerprint: expect.any(String),
      ruleId: expect.any(String),
      pageUrl: "https://example.com/products/1"
    });
  });

  it("runs snapshot analysis through the real production catalog", async () => {
    const catalogText = await readFile(realCatalogPath, "utf8");
    const result = await runSearchLintCli(
      [
        "--snapshot",
        "snapshot.json",
        "--catalog",
        "specs/RULE_CATALOG.yaml",
        "--route-contract",
        "route.json",
        "--format",
        "json",
        "--fail-on",
        "none",
        "--now",
        "2026-06-21T00:00:00.000Z"
      ],
      createIo({
        "specs/RULE_CATALOG.yaml": catalogText,
        "snapshot.json": JSON.stringify({
          ...snapshot,
          rawHtml:
            '<html lang="en"><head><meta name="robots" content="noindex"></head><body><h1>Product</h1></body></html>',
          renderedDom:
            '<html lang="en"><head><meta name="robots" content="noindex"></head><body><h1>Product</h1></body></html>'
        }),
        "route.json": JSON.stringify({
          route: "/products/**",
          indexable: true
        })
      })
    );

    expect(result.exitCode).toBe(0);
    expect(result.engineResult?.executedRuleIds).toHaveLength(120);
    expect(result.engineResult?.diagnostics).toContainEqual(
      expect.objectContaining({
        ruleId: "SL-INDEX-001",
        severity: "blocker"
      })
    );
  });

  it("runs shared core rules and returns JSON diagnostics", async () => {
    const result = await runSearchLintCli(
      [
        "--snapshot",
        "snapshot.json",
        "--catalog",
        "catalog.yaml",
        "--route-contract",
        "route.json",
        "--format",
        "json",
        "--fail-on",
        "blocker",
        "--now",
        "2026-06-20T00:00:00.000Z"
      ],
      createIo({
        "catalog.yaml": catalog,
        "snapshot.json": JSON.stringify({
          ...snapshot,
          rawHtml:
            '<html lang="en"><head><meta name="robots" content="noindex"></head><body></body></html>'
        }),
        "route.json": JSON.stringify({
          route: "/products/**",
          indexable: true
        })
      })
    );

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toBe("");
    expect(
      result.engineResult?.diagnostics.map((diagnostic) => diagnostic.ruleId)
    ).toContain("SL-INDEX-001");
    expect(JSON.parse(result.stdout)).toMatchObject({
      diagnostics: expect.any(Array),
      executedRuleIds: expect.any(Array)
    });
  });

  it("uses route contract lists from compiled config files", async () => {
    const result = await runSearchLintCli(
      [
        "--snapshot",
        "snapshot.json",
        "--catalog",
        "catalog.yaml",
        "--route-contract",
        "searchlint-config.json",
        "--format",
        "json",
        "--fail-on",
        "none",
        "--now",
        "2026-06-20T00:00:00.000Z"
      ],
      createIo({
        "catalog.yaml": catalog,
        "snapshot.json": JSON.stringify({
          ...snapshot,
          route: "/products/sale/[slug]",
          pageUrl: "https://example.com/products/sale/widget",
          rawHtml:
            '<html lang="en"><head><title>Sale Product</title></head><body><h1>Sale Product</h1></body></html>',
          renderedDom:
            '<html lang="en"><head><title>Sale Product</title></head><body><h1>Sale Product</h1></body></html>'
        }),
        "searchlint-config.json": JSON.stringify({
          languageVersion: 1,
          siteUrl: "https://example.com",
          routeContracts: [
            {
              route: "/products/**",
              indexable: true
            },
            {
              route: "/products/sale/**",
              indexable: true,
              requiredSeverityOverrides: {
                "SL-META-005": "error"
              }
            }
          ],
          suppressions: []
        })
      })
    );

    const descriptionDiagnostic = result.engineResult?.diagnostics.find(
      (diagnostic) => diagnostic.ruleId === "SL-META-005"
    );

    expect(result.exitCode).toBe(0);
    expect(descriptionDiagnostic).toMatchObject({
      route: "/products/sale/**",
      severity: "error"
    });
  });

  it("uses SearchLint DSL config route contracts and suppressions", async () => {
    const result = await runSearchLintCli(
      [
        "--snapshot",
        "snapshot.json",
        "--catalog",
        "catalog.yaml",
        "--config",
        "searchlint.seo",
        "--format",
        "json",
        "--fail-on",
        "none",
        "--now",
        "2026-06-20T00:00:00.000Z"
      ],
      createIo({
        "catalog.yaml": catalog,
        "snapshot.json": JSON.stringify({
          ...snapshot,
          route: "/products/[slug]",
          rawHtml:
            '<html lang="en"><head><title>Product</title><meta name="robots" content="noindex"></head><body><h1>Product</h1></body></html>',
          renderedDom:
            '<html lang="en"><head><title>Product</title><meta name="robots" content="noindex"></head><body><h1>Product</h1></body></html>'
        }),
        "searchlint.seo": `language 1
site "https://example.com"
route "/products/**" {
  indexable true
  severity SL-META-005 error
  suppress SL-INDEX-001 {
    reason "Known staged noindex"
  }
}
`
      })
    );

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(
      result.engineResult?.diagnostics.map((diagnostic) => diagnostic.ruleId)
    ).not.toContain("SL-INDEX-001");
    expect(
      result.engineResult?.diagnostics.find(
        (diagnostic) => diagnostic.ruleId === "SL-META-005"
      )
    ).toMatchObject({
      route: "/products/**",
      severity: "error"
    });
  });

  it("discovers searchlint.seo when no config path is provided", async () => {
    const result = await runSearchLintCli(
      [
        "--snapshot",
        "snapshot.json",
        "--catalog",
        "catalog.yaml",
        "--format",
        "json",
        "--fail-on",
        "none",
        "--now",
        "2026-06-20T00:00:00.000Z"
      ],
      createIo(
        {
          "catalog.yaml": catalog,
          "snapshot.json": JSON.stringify({
            ...snapshot,
            route: "/products/[slug]",
            rawHtml:
              '<html lang="en"><head><title>Product</title></head><body><h1>Product</h1></body></html>',
            renderedDom:
              '<html lang="en"><head><title>Product</title></head><body><h1>Product</h1></body></html>'
          }),
          "searchlint.seo": `language 1
site "https://example.com"
route "/products/**" {
  indexable true
  severity SL-META-005 error
}
`
        },
        undefined,
        true
      )
    );

    expect(result.exitCode).toBe(0);
    expect(
      result.engineResult?.diagnostics.find(
        (diagnostic) => diagnostic.ruleId === "SL-META-005"
      )
    ).toMatchObject({
      route: "/products/**",
      severity: "error"
    });
  });

  it("uses explicit config before discovered searchlint.seo", async () => {
    const result = await runSearchLintCli(
      [
        "--snapshot",
        "snapshot.json",
        "--catalog",
        "catalog.yaml",
        "--config",
        "custom.seo",
        "--format",
        "json",
        "--fail-on",
        "none",
        "--now",
        "2026-06-20T00:00:00.000Z"
      ],
      createIo(
        {
          "catalog.yaml": catalog,
          "snapshot.json": JSON.stringify({
            ...snapshot,
            route: "/products/[slug]",
            rawHtml:
              '<html lang="en"><head><title>Product</title></head><body><h1>Product</h1></body></html>',
            renderedDom:
              '<html lang="en"><head><title>Product</title></head><body><h1>Product</h1></body></html>'
          }),
          "searchlint.seo": `language 1
site "https://example.com"
route "/products/**" {
  indexable true
  severity SL-META-005 blocker
}
`,
          "custom.seo": `language 1
site "https://example.com"
route "/products/**" {
  indexable true
  severity SL-META-005 info
}
`
        },
        undefined,
        true
      )
    );

    expect(result.exitCode).toBe(0);
    expect(
      result.engineResult?.diagnostics.find(
        (diagnostic) => diagnostic.ruleId === "SL-META-005"
      )
    ).toMatchObject({
      route: "/products/**",
      severity: "info"
    });
  });

  it("does not require config discovery support", async () => {
    const result = await runSearchLintCli(
      [
        "--snapshot",
        "snapshot.json",
        "--catalog",
        "catalog.yaml",
        "--format",
        "json",
        "--fail-on",
        "none"
      ],
      createIo({
        "catalog.yaml": catalog,
        "snapshot.json": JSON.stringify(snapshot)
      })
    );

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
  });

  it("returns a clear error for invalid SearchLint DSL config", async () => {
    const result = await runSearchLintCli(
      [
        "--snapshot",
        "snapshot.json",
        "--catalog",
        "catalog.yaml",
        "--config",
        "searchlint.seo",
        "--format",
        "json",
        "--fail-on",
        "none"
      ],
      createIo({
        "catalog.yaml": catalog,
        "snapshot.json": JSON.stringify(snapshot),
        "searchlint.seo": `language 99
route "/products/**" {
  indexable true
}
`
      })
    );

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain(
      "searchlint.seo contains invalid SearchLint config."
    );
    expect(result.stderr).toContain("Diagnostics: 2");
    expect(result.stderr).toContain("SLANG207");
    expect(result.stderr).toContain("SLANG208");
    expect(result.stderr).toContain("at line 1, column 1:");
    expect(result.stderr).toContain(
      "Next step: fix the config and run `searchlint config validate --config searchlint.seo`."
    );
  });

  it("returns text output and exit code 0 when fail-on is none", async () => {
    const result = await runSearchLintCli(
      [
        "--snapshot",
        "snapshot.json",
        "--catalog",
        "catalog.yaml",
        "--format",
        "text",
        "--fail-on",
        "none"
      ],
      createIo({
        "catalog.yaml": catalog,
        "snapshot.json": JSON.stringify({
          ...snapshot,
          rawHtml: "<html><body></body></html>",
          renderedDom: "<html><body></body></html>"
        })
      })
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("SL-HTTP-005 | blocker | raw-html");
    expect(result.stdout).toContain("Raw HTML was available");
  });

  it("runs crawl mode through the shared CLI entrypoint", async () => {
    const result = await runSearchLintCli(
      [
        "--crawl",
        "https://example.com/",
        "--catalog",
        "catalog.yaml",
        "--max-urls",
        "1",
        "--respect-robots",
        "false",
        "--format",
        "json",
        "--fail-on",
        "blocker"
      ],
      createIo(
        {
          "catalog.yaml": catalog
        },
        undefined,
        false,
        {
          "https://example.com/": {
            url: "https://example.com/",
            statusCode: 200,
            headers: { "content-type": "text/html" },
            body: "<html><body></body></html>"
          }
        }
      )
    );

    expect(result.exitCode).toBe(2);
    expect(result.crawlAnalysis?.pageResults).toHaveLength(1);
    expect(JSON.parse(result.stdout)).toMatchObject({
      crawlResult: {
        startUrl: "https://example.com/"
      },
      diagnostics: expect.any(Array)
    });
  });

  it("writes and resumes crawl checkpoints through CLI files", async () => {
    const files: Record<string, string> = {
      "catalog.yaml": catalog
    };
    const fetchCalls: string[] = [];
    const crawlSignal = { aborted: false } as {
      aborted: boolean;
    } & NonNullable<CliIo["crawlSignal"]>;
    const responses = {
      "https://example.com/": {
        url: "https://example.com/",
        statusCode: 200,
        headers: { "content-type": "text/html" },
        body: '<html><body><a href="/a">A</a><a href="/b">B</a></body></html>'
      },
      "https://example.com/a": {
        url: "https://example.com/a",
        statusCode: 200,
        headers: { "content-type": "text/html" },
        body: "<html><body>A</body></html>"
      },
      "https://example.com/b": {
        url: "https://example.com/b",
        statusCode: 200,
        headers: { "content-type": "text/html" },
        body: "<html><body>B</body></html>"
      }
    };
    const interruptedIo = createIo(
      files,
      undefined,
      false,
      responses,
      undefined,
      fetchCalls,
      crawlSignal
    );
    const originalFetch = interruptedIo.fetchUrl?.bind(interruptedIo);
    interruptedIo.fetchUrl = async (url) => {
      const result = await originalFetch!(url);
      if (url === "https://example.com/") {
        crawlSignal.aborted = true;
      }
      return result;
    };

    const interrupted = await runSearchLintCli(
      [
        "--crawl",
        "https://example.com/",
        "--catalog",
        "catalog.yaml",
        "--respect-robots",
        "false",
        "--checkpoint",
        "crawl.checkpoint.json",
        "--format",
        "json",
        "--fail-on",
        "none"
      ],
      interruptedIo
    );

    expect(interrupted.exitCode, interrupted.stderr).toBe(0);
    expect(files["crawl.checkpoint.json"]).toContain('"pendingQueue"');
    expect(interrupted.crawlAnalysis?.crawlResult.recovery).toMatchObject({
      interrupted: true
    });

    const resumed = await runSearchLintCli(
      [
        "--crawl",
        "https://example.com/",
        "--catalog",
        "catalog.yaml",
        "--respect-robots",
        "false",
        "--resume",
        "crawl.checkpoint.json",
        "--format",
        "json",
        "--fail-on",
        "none"
      ],
      createIo(files, undefined, false, responses, undefined, fetchCalls)
    );

    expect(resumed.exitCode, resumed.stderr).toBe(0);
    expect(resumed.crawlAnalysis?.crawlResult.recovery).toEqual({
      interrupted: false,
      resumed: true
    });
    expect(
      resumed.crawlAnalysis?.crawlResult.pages.map((page) => page.url)
    ).toEqual([
      "https://example.com/",
      "https://example.com/a",
      "https://example.com/b"
    ]);
    expect(
      fetchCalls.filter((url) => url === "https://example.com/")
    ).toHaveLength(1);
  });

  it("returns a clear error when crawl mode lacks fetch support", async () => {
    const result = await runSearchLintCli(
      [
        "--crawl",
        "https://example.com/",
        "--catalog",
        "catalog.yaml",
        "--respect-robots",
        "false"
      ],
      createIo({
        "catalog.yaml": catalog
      })
    );

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toBe("--crawl requires CliIo.fetchUrl.");
  });

  it("enriches snapshots with source findings from source files", async () => {
    const result = await runSearchLintCli(
      [
        "--snapshot",
        "snapshot.json",
        "--catalog",
        "catalog.yaml",
        "--source-file",
        "app/products/[slug]/page.tsx",
        "--format",
        "json",
        "--fail-on",
        "none"
      ],
      createIo({
        "catalog.yaml": catalog,
        "app/products/[slug]/page.tsx": `export const metadata = {
  title: "Product"
};
`,
        "snapshot.json": JSON.stringify({
          ...snapshot,
          rawHtml:
            '<html lang="en"><head><title>Product</title></head><body></body></html>',
          renderedDom:
            '<html lang="en"><head><title>Product</title></head><body></body></html>'
        })
      })
    );

    const diagnostic = result.engineResult?.diagnostics.find(
      (item) => item.ruleId === "SL-META-005"
    );
    expect(result.exitCode).toBe(0);
    expect(diagnostic).toMatchObject({
      source: "source-code",
      sourceLocation: {
        confidence: "EXACT",
        file: "app/products/[slug]/page.tsx",
        line: 1
      }
    });
    expect(JSON.parse(result.stdout)).toMatchObject({
      diagnostics: expect.arrayContaining([
        expect.objectContaining({
          ruleId: "SL-META-005",
          source: "source-code"
        })
      ])
    });
  });

  it("discovers Next.js source files from project file paths", async () => {
    const result = await runSearchLintCli(
      [
        "--snapshot",
        "snapshot.json",
        "--catalog",
        "catalog.yaml",
        "--next-project-file",
        "app/products/[slug]/page.tsx",
        "--next-project-file",
        ".next/server/app/products/[slug]/page.js",
        "--format",
        "json",
        "--fail-on",
        "none"
      ],
      createIo({
        "catalog.yaml": catalog,
        "app/products/[slug]/page.tsx": `export const metadata = {
  title: "Product"
};
`,
        "snapshot.json": JSON.stringify({
          ...snapshot,
          rawHtml:
            '<html lang="en"><head><title>Product</title></head><body></body></html>',
          renderedDom:
            '<html lang="en"><head><title>Product</title></head><body></body></html>'
        })
      })
    );

    expect(result.exitCode).toBe(0);
    expect(
      result.engineResult?.diagnostics.find(
        (item) => item.ruleId === "SL-META-005"
      )
    ).toMatchObject({
      source: "source-code",
      sourceLocation: {
        confidence: "EXACT",
        file: "app/products/[slug]/page.tsx",
        line: 1
      }
    });
  });

  it("uses route metadata summaries for route-aware source diagnostics", async () => {
    const result = await runSearchLintCli(
      [
        "--snapshot",
        "snapshot.json",
        "--catalog",
        "catalog.yaml",
        "--next-project-file",
        "app/products/[slug]/page.tsx",
        "--next-project-file",
        "app/blog/[slug]/page.tsx",
        "--format",
        "json",
        "--fail-on",
        "none"
      ],
      createIo({
        "catalog.yaml": catalog,
        "app/products/[slug]/page.tsx": `export const metadata = {
  title: "Product"
};
`,
        "app/blog/[slug]/page.tsx": `export const metadata = {
  description: "Blog description"
};
`,
        "snapshot.json": JSON.stringify({
          ...snapshot,
          route: "/products/[slug]",
          rawHtml:
            '<html lang="en"><head><title>Product</title></head><body></body></html>',
          renderedDom:
            '<html lang="en"><head><title>Product</title></head><body></body></html>'
        })
      })
    );

    expect(result.exitCode).toBe(0);
    expect(
      result.engineResult?.diagnostics.find(
        (item) => item.ruleId === "SL-META-005"
      )
    ).toMatchObject({
      source: "source-code",
      sourceLocation: {
        confidence: "EXACT",
        file: "app/products/[slug]/page.tsx",
        line: 1
      }
    });
  });

  it("enriches snapshots with route social image summaries", async () => {
    const result = await runSearchLintCli(
      [
        "--snapshot",
        "snapshot.json",
        "--catalog",
        "catalog.yaml",
        "--next-project-file",
        "app/products/[slug]/opengraph-image.tsx",
        "--next-project-file",
        "app/products/[slug]/twitter-image.tsx",
        "--format",
        "json",
        "--fail-on",
        "none"
      ],
      createIo({
        "catalog.yaml": catalog,
        "app/products/[slug]/opengraph-image.tsx":
          "export default function Image() { return null; }",
        "app/products/[slug]/twitter-image.tsx":
          "export default function Image() { return null; }",
        "snapshot.json": JSON.stringify({
          ...snapshot,
          route: "/products/[slug]",
          rawHtml:
            '<html lang="en"><head><title>Product</title></head><body></body></html>',
          renderedDom:
            '<html lang="en"><head><title>Product</title></head><body></body></html>'
        })
      })
    );

    expect(result.exitCode).toBe(0);
    expect(
      result.engineResult?.diagnostics.map((item) => item.ruleId)
    ).not.toEqual(expect.arrayContaining(["SL-IMG-001", "SL-IMG-004"]));
    expect(JSON.parse(result.stdout)).toMatchObject({
      diagnostics: expect.any(Array)
    });
  });

  it("discovers Next.js source files from project roots", async () => {
    const rootFile = "/repo/app/products/[slug]/page.tsx";
    const result = await runSearchLintCli(
      [
        "--snapshot",
        "snapshot.json",
        "--catalog",
        "catalog.yaml",
        "--next-project-root",
        "/repo",
        "--format",
        "json",
        "--fail-on",
        "none"
      ],
      createIo(
        {
          "catalog.yaml": catalog,
          [rootFile]: `export const metadata = {
  title: "Product"
};
`,
          "snapshot.json": JSON.stringify({
            ...snapshot,
            rawHtml:
              '<html lang="en"><head><title>Product</title></head><body></body></html>',
            renderedDom:
              '<html lang="en"><head><title>Product</title></head><body></body></html>'
          })
        },
        { "/repo": [rootFile, "/repo/.next/server/app/products/page.js"] }
      )
    );

    expect(result.exitCode).toBe(0);
    expect(
      result.engineResult?.diagnostics.find(
        (item) => item.ruleId === "SL-META-005"
      )
    ).toMatchObject({
      source: "source-code",
      sourceLocation: {
        confidence: "EXACT",
        file: rootFile,
        line: 1
      }
    });
  });

  it("requires listFiles when next project roots are provided", async () => {
    const result = await runSearchLintCli(
      [
        "--snapshot",
        "snapshot.json",
        "--catalog",
        "catalog.yaml",
        "--next-project-root",
        "/repo"
      ],
      createIo({
        "catalog.yaml": catalog,
        "snapshot.json": JSON.stringify(snapshot)
      })
    );

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toBe("--next-project-root requires CliIo.listFiles.");
  });

  it("returns SARIF output for snapshot diagnostics", async () => {
    const result = await runSearchLintCli(
      [
        "--snapshot",
        "snapshot.json",
        "--catalog",
        "catalog.yaml",
        "--format",
        "sarif",
        "--fail-on",
        "none"
      ],
      createIo({
        "catalog.yaml": catalog,
        "snapshot.json": JSON.stringify({
          ...snapshot,
          rawHtml: "<html><body></body></html>",
          renderedDom: "<html><body></body></html>"
        })
      })
    );

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      version: "2.1.0",
      runs: [
        {
          tool: {
            driver: {
              name: "SearchLint"
            }
          },
          results: expect.any(Array)
        }
      ]
    });
  });

  it("returns JUnit output for snapshot diagnostics", async () => {
    const result = await runSearchLintCli(
      [
        "--snapshot",
        "snapshot.json",
        "--catalog",
        "catalog.yaml",
        "--format",
        "junit",
        "--fail-on",
        "none"
      ],
      createIo({
        "catalog.yaml": catalog,
        "snapshot.json": JSON.stringify({
          ...snapshot,
          rawHtml: "<html><body></body></html>",
          renderedDom: "<html><body></body></html>"
        })
      })
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("<testsuite");
    expect(result.stdout).toContain("<failure");
  });

  it("uses baseline entries for fail policy without hiding diagnostics", async () => {
    const firstRun = await runSearchLintCli(
      [
        "--snapshot",
        "snapshot.json",
        "--catalog",
        "catalog.yaml",
        "--format",
        "json",
        "--fail-on",
        "blocker"
      ],
      createIo({
        "catalog.yaml": catalog,
        "snapshot.json": JSON.stringify({
          ...snapshot,
          rawHtml: "<html><body></body></html>",
          renderedDom: "<html><body></body></html>"
        })
      })
    );
    const entries = firstRun.engineResult?.diagnostics.map((diagnostic) => ({
      fingerprint: diagnostic.fingerprint,
      ruleId: diagnostic.ruleId,
      pageUrl: diagnostic.pageUrl,
      acceptedAt: "2026-06-20T00:00:00.000Z",
      reason: "accepted in test baseline"
    }));

    const result = await runSearchLintCli(
      [
        "--snapshot",
        "snapshot.json",
        "--catalog",
        "catalog.yaml",
        "--baseline",
        "baseline.json",
        "--format",
        "json",
        "--fail-on",
        "blocker"
      ],
      createIo({
        "catalog.yaml": catalog,
        "baseline.json": JSON.stringify({ entries }),
        "snapshot.json": JSON.stringify({
          ...snapshot,
          rawHtml: "<html><body></body></html>",
          renderedDom: "<html><body></body></html>"
        })
      })
    );

    expect(result.exitCode).toBe(0);
    expect(result.engineResult?.diagnostics.length).toBeGreaterThan(0);
    expect(result.baselineComparison).toMatchObject({
      newDiagnostics: [],
      unchangedDiagnostics: expect.any(Array),
      resolvedBaselineEntries: []
    });
    expect(JSON.parse(result.stdout)).toMatchObject({
      diagnostics: expect.any(Array),
      executedRuleIds: expect.any(Array)
    });
  });

  it("still fails when baseline does not contain new diagnostics", async () => {
    const result = await runSearchLintCli(
      [
        "--snapshot",
        "snapshot.json",
        "--catalog",
        "catalog.yaml",
        "--baseline",
        "baseline.json",
        "--format",
        "text",
        "--fail-on",
        "blocker"
      ],
      createIo({
        "catalog.yaml": catalog,
        "baseline.json": JSON.stringify({ entries: [] }),
        "snapshot.json": JSON.stringify({
          ...snapshot,
          rawHtml: "<html><body></body></html>",
          renderedDom: "<html><body></body></html>"
        })
      })
    );

    expect(result.exitCode).toBe(2);
    expect(result.baselineComparison?.newDiagnostics.length).toBeGreaterThan(0);
  });

  it("returns an error for invalid baseline input", async () => {
    const result = await runSearchLintCli(
      [
        "--snapshot",
        "snapshot.json",
        "--catalog",
        "catalog.yaml",
        "--baseline",
        "baseline.json",
        "--format",
        "text",
        "--fail-on",
        "blocker"
      ],
      createIo({
        "catalog.yaml": catalog,
        "baseline.json": JSON.stringify({
          entries: [{ ruleId: "SL-HTTP-005" }]
        }),
        "snapshot.json": JSON.stringify(snapshot)
      })
    );

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toBe(
      "baseline.json baseline entry 0 must contain a fingerprint."
    );
  });
});

describe("formatEngineResult and shouldFail", () => {
  it("formats an empty text summary", () => {
    expect(
      formatEngineResult(
        { diagnostics: [], executedRuleIds: ["SL-HTTP-001"] },
        "text"
      )
    ).toBe("SearchLint found 0 diagnostics. Executed 1 rules.\n");
  });

  it("applies severity thresholds deterministically", () => {
    expect(
      shouldFail(
        [
          {
            id: "d1",
            ruleId: "SL-TEST-001",
            severity: "warning",
            confidence: "certain",
            pageUrl: "https://example.com/",
            source: "raw-html",
            title: "Warning",
            evidence: "Evidence",
            observedAt: "2026-06-20T00:00:00.000Z",
            fingerprint: "fp"
          }
        ],
        "error"
      )
    ).toBe(false);
  });
});

function createIo(
  files: Readonly<Record<string, string>>,
  listedFiles?: Readonly<Record<string, readonly string[]>>,
  supportExists = false,
  fetchResponses?: Readonly<
    Record<
      string,
      {
        url: string;
        statusCode: number;
        headers: Readonly<Record<string, string>>;
        body: string;
      }
    >
  >,
  atomicWrites?: string[],
  fetchCalls?: string[],
  crawlSignal?: CliIo["crawlSignal"]
): CliIo {
  const io: CliIo = {
    async readText(path: string): Promise<string> {
      const content = files[path];
      if (content === undefined) {
        throw new Error(`Missing test file ${path}`);
      }
      return content;
    },
    async writeText(path: string, content: string): Promise<void> {
      (files as Record<string, string>)[path] = content;
    }
  };

  if (atomicWrites !== undefined) {
    io.writeTextAtomic = async (
      path: string,
      content: string
    ): Promise<void> => {
      atomicWrites.push(path);
      (files as Record<string, string>)[path] = content;
    };
  }

  if (listedFiles !== undefined) {
    io.listFiles = async (root: string): Promise<readonly string[]> => {
      const paths = listedFiles[root];
      if (paths === undefined) {
        throw new Error(`Missing test root ${root}`);
      }
      return paths;
    };
  }

  if (supportExists) {
    io.exists = async (path: string): Promise<boolean> =>
      files[path] !== undefined;
  }

  if (fetchResponses !== undefined) {
    io.fetchUrl = async (url: string) => {
      fetchCalls?.push(url);
      const response = fetchResponses[url];
      if (response === undefined) {
        throw new Error(`Unexpected fetch ${url}`);
      }
      return response;
    };
  }
  if (crawlSignal !== undefined) {
    io.crawlSignal = crawlSignal;
  }

  return io;
}

function createCatalog(): string {
  const categories = Object.entries(localRuleIdsByCategory)
    .map(
      ([id, rules]) => `  - id: ${id}
    title: ${id}
    targetCount: ${rules.length}`
    )
    .join("\n");

  const rules = Object.entries(localRuleIdsByCategory)
    .flatMap(([category, ids]) =>
      ids.map(
        (id) => `  - id: ${id}
    name: ${id.toLowerCase()}
    category: ${category}
    defaultSeverity: ${id === "SL-META-009" || id === "SL-META-010" || id === "SL-SCHEMA-010" || id === "SL-IMG-009" || id === "SL-IMG-012" || id === "SL-PERF-005" || id === "SL-PERF-006" ? "info" : id === "SL-PERF-001" || id === "SL-PERF-002" || id === "SL-PERF-003" || id === "SL-INDEX-013" || id === "SL-SCHEMA-007" || id === "SL-CANON-005" || id === "SL-IMG-005" || id === "SL-IMG-008" || id === "SL-ROBOTS-004" || id === "SL-ROBOTS-008" || id === "SL-ROBOTS-010" ? "warning" : id === "SL-HTTP-002" || id === "SL-INDEX-006" || id === "SL-INDEX-009" || id === "SL-SCHEMA-001" || id === "SL-SCHEMA-003" || id === "SL-CANON-003" || id === "SL-CANON-004" || id === "SL-CANON-012" || id === "SL-CANON-013" || id === "SL-IMG-002" || id === "SL-IMG-003" || id === "SL-IMG-010" || id === "SL-ROBOTS-001" || id === "SL-ROBOTS-002" || id === "SL-ROBOTS-003" || id === "SL-ROBOTS-005" || id === "SL-ROBOTS-006" ? "error" : "blocker"}
    confidence: certain
    scope: page
    sources: [${id === "SL-SCHEMA-010" ? "google" : id === "SL-INDEX-009" || id === "SL-CANON-012" ? "crawler, raw-html, http-header" : id === "SL-CANON-004" || id === "SL-CANON-005" || id === "SL-CANON-013" ? "crawler, http-header" : id === "SL-IMG-002" || id === "SL-IMG-005" || id === "SL-IMG-009" || id === "SL-IMG-010" ? "http-header, raw-html" : id === "SL-IMG-008" ? "http-header, rendered-dom" : id === "SL-IMG-012" ? "source-code, rendered-dom" : id === "SL-META-001" || id === "SL-META-005" ? "raw-html, rendered-dom, http-header, source-code" : "raw-html, rendered-dom, http-header"}]
    providerScope: ${id === "SL-SCHEMA-010" ? "google" : "core"}
    description: "Generated catalog entry for ${id}."
    checkingAlgorithm: "Run deterministic local rule."
    requiredEvidence: [evidence]
    fix: "Fix the observed issue."
    testExamples: [fixtures/${id}]
    documentation: docs/rules/${id}.md
    version: 1.0.0`
      )
    )
    .join("\n");

  return `version: 1
status: defined
source: test
targetRuleCount: ${Object.values(localRuleIdsByCategory).flat().length}
ruleIdPattern: "SL-{CATEGORY}-{NNN}"
requiredRuleFields:
  - id
  - name
  - category
  - defaultSeverity
  - confidence
  - scope
  - sources
  - providerScope
  - description
  - checkingAlgorithm
  - requiredEvidence
  - fix
  - testExamples
  - documentation
  - version
qualityConstraints:
  - blocker cannot be based on subjective heuristic
categories:
${categories}
rules:
${rules}
`;
}
