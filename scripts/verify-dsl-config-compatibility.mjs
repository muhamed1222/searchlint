#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const reportPath = path.join(
  repoRoot,
  "reports/dsl-config-compatibility-report.json"
);
const samplePath = path.join(
  repoRoot,
  "docs/examples/dsl-config-compatibility-report.sample.json"
);
const fixedGeneratedAt = "2026-06-22T00:00:00.000Z";

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    env: { ...process.env, ...options.env },
    encoding: "utf8",
    stdio: options.stdio ?? "pipe"
  });
}

function runStatus(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    env: { ...process.env, ...options.env },
    encoding: "utf8"
  });

  return {
    status: result.status ?? 1,
    stdout: result.stdout,
    stderr: result.stderr
  };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function caseResult(id, status, evidence, notes = []) {
  return { id, status, evidence, notes };
}

async function main() {
  run("pnpm", ["build"], { stdio: "inherit" });

  const {
    compileSearchLintDocument,
    compileSearchLintProject,
    formatSearchLintDocument,
    parseSearchLintDocument
  } = await import("../packages/language/dist/src/index.js");

  const cases = [];

  const publicConfig = `language 1
import "./policies.seo"
site "https://staging.example.com"
let productSchemas ["Product", "BreadcrumbList"]

route "/products/**" {
  indexable false
}

environment production {
  site "https://www.example.com"
  route "/products/[slug]" {
    use productPage
    indexable true
    severity SL-SCHEMA-001 blocker
    provider google {
      require ["rich-result"]
      rule SL-GOOGLE-RICH-001
    }
  }
}
`;

  const project = await compileSearchLintProject(publicConfig, {
    path: "/repo/searchlint.seo",
    environment: "production",
    resolveImport(input) {
      assert(
        input.path === "./policies.seo",
        "POSIX import path must be passed to resolver"
      );
      assert(
        input.fromPath === "/repo/searchlint.seo",
        "POSIX fromPath must be preserved"
      );
      return {
        path: "/repo/policies.seo",
        source: `policy productPage {
  schema $productSchemas
  title {
    required true
  }
}
`
      };
    }
  });
  assert(
    project.diagnostics.length === 0,
    "Public project config must compile"
  );
  assert(
    project.config.siteUrl === "https://www.example.com",
    "Environment site must override base site"
  );
  assert(
    project.config.routePrecedence[0] === "/products/[slug]",
    "Route precedence must prefer dynamic slug route over recursive wildcard"
  );
  assert(
    project.config.routeContracts.some(
      (route) =>
        route.route === "/products/[slug]" &&
        route.indexable === true &&
        route.requiredSchemas?.includes("Product") &&
        route.requiredSeverityOverrides?.["SL-SCHEMA-001"] === "blocker"
    ),
    "Policy inheritance and route-specific severity override must compile"
  );
  cases.push(
    caseResult("compile-project-posix-imports-env-policy-precedence", "PASS", {
      loadedPaths: project.loadedPaths,
      siteUrl: project.config.siteUrl,
      routePrecedence: project.config.routePrecedence
    })
  );

  const parsed = parseSearchLintDocument(`language 1
site "https://example.com"
route "/" {
  indexable true
  title {
    required true
  }
}
`);
  assert(parsed.diagnostics.length === 0, "Formatter input must parse");
  const formatted = formatSearchLintDocument(parsed.ast);
  const reparsed = parseSearchLintDocument(formatted);
  assert(reparsed.diagnostics.length === 0, "Formatted config must parse");
  const before = compileSearchLintDocument(parsed.ast);
  const after = compileSearchLintDocument(reparsed.ast);
  assert(
    JSON.stringify(before.config) === JSON.stringify(after.config),
    "Formatter roundtrip must preserve compiled config"
  );
  cases.push(
    caseResult("formatter-roundtrip-preserves-compiled-config", "PASS", {
      formattedLineCount: formatted.trimEnd().split("\n").length
    })
  );

  const unsupported = compileSearchLintDocument(
    parseSearchLintDocument(`language 2
site "https://example.com"
`).ast
  );
  assert(
    unsupported.diagnostics.some(
      (diagnostic) => diagnostic.code === "SLANG207"
    ),
    "Unsupported language version must be rejected"
  );
  cases.push(
    caseResult("unsupported-language-version-rejected", "PASS", {
      diagnosticCodes: unsupported.diagnostics.map(
        (diagnostic) => diagnostic.code
      )
    })
  );

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
  assert(
    cycle.diagnostics.some((diagnostic) => diagnostic.code === "SLANG230"),
    "Import cycles must be rejected"
  );
  cases.push(
    caseResult("import-cycle-rejected", "PASS", {
      diagnosticCodes: cycle.diagnostics.map((diagnostic) => diagnostic.code)
    })
  );

  const windowsStyle = await compileSearchLintProject(
    `language 1
import "./policies.seo"
site "https://example.com"
route "/" {
  use basePage
}
`,
    {
      path: "C:\\repo\\searchlint.seo",
      resolveImport(input) {
        assert(
          input.fromPath === "C:\\repo\\searchlint.seo",
          "Windows fromPath string must be preserved"
        );
        return {
          path: "C:\\repo\\policies.seo",
          source: `policy basePage {
  indexable true
}
`
        };
      }
    }
  );
  assert(
    windowsStyle.diagnostics.length === 0,
    "Windows-style project paths must compile through resolver"
  );
  cases.push(
    caseResult("windows-style-project-paths-preserved", "PASS", {
      loadedPaths: windowsStyle.loadedPaths
    })
  );

  const largeRoutes = Array.from({ length: 250 }, (_, index) => {
    return `route "/section-${String(index).padStart(3, "0")}/**" {
  indexable true
}`;
  }).join("\n\n");
  const large = compileSearchLintDocument(
    parseSearchLintDocument(`language 1
site "https://example.com"
${largeRoutes}
`).ast
  );
  assert(
    large.diagnostics.length === 0,
    "Large config must compile without diagnostics"
  );
  assert(
    large.config.routeContracts.length === 250,
    "Large config must keep every route"
  );
  cases.push(
    caseResult("large-config-250-routes", "PASS", {
      routeCount: large.config.routeContracts.length
    })
  );

  const exampleConfigPaths = [
    ...(await listExampleConfigs("docs/examples/config-templates")),
    "docs/examples/demo-project/searchlint.seo"
  ];
  const exampleResults = [];
  for (const relativePath of exampleConfigPaths) {
    const source = await readFile(path.join(repoRoot, relativePath), "utf8");
    const compiled = compileSearchLintDocument(
      parseSearchLintDocument(source).ast,
      { path: relativePath }
    );
    assert(
      compiled.diagnostics.length === 0,
      `${relativePath} must compile without diagnostics`
    );
    exampleResults.push({
      path: relativePath,
      routeCount: compiled.config.routeContracts.length
    });
  }
  cases.push(
    caseResult("real-example-configs-compile", "PASS", {
      configCount: exampleResults.length,
      configs: exampleResults
    })
  );

  const missingEnvironment = compileSearchLintDocument(
    parseSearchLintDocument(`language 1
site "https://example.com"
`).ast,
    { environment: "production" }
  );
  assert(
    missingEnvironment.diagnostics.some(
      (diagnostic) => diagnostic.code === "SLANG229"
    ),
    "Missing selected environment must be rejected"
  );
  cases.push(
    caseResult("missing-environment-rejected", "PASS", {
      diagnosticCodes: missingEnvironment.diagnostics.map(
        (diagnostic) => diagnostic.code
      )
    })
  );

  const tempDir = await mkdtemp(path.join(tmpdir(), "searchlint-dsl-"));
  try {
    const configPath = path.join(tempDir, "searchlint.seo");
    const source = `# Preserve comment
language 1

site "https://example.com"
route "/" {
  indexable true
}
`;
    await writeFile(configPath, source);
    const cli = runStatus(
      "node",
      [
        path.join(repoRoot, "packages/cli/dist/src/bin.js"),
        "migrate-config",
        "--from",
        "1",
        "--to",
        "1",
        "--write",
        "searchlint.seo"
      ],
      { cwd: tempDir }
    );
    assert(cli.status === 0, `migrate-config must pass: ${cli.stderr}`);
    const migrated = await readFile(configPath, "utf8");
    const backup = await readFile(`${configPath}.bak`, "utf8");
    assert(
      migrated === source,
      "migrate-config must preserve primary file byte-for-byte"
    );
    assert(
      backup === source,
      "migrate-config must create byte-for-byte backup"
    );
    cases.push(
      caseResult("migrate-config-preserves-bytes-and-writes-backup", "PASS", {
        stdout: cli.stdout.trim(),
        backupFile: "searchlint.seo.bak",
        writeMode: "filesystem-cli-atomic-boundary-covered-by-cli-tests"
      })
    );
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }

  const failedCases = cases.filter((item) => item.status !== "PASS");
  const summary = {
    status: failedCases.length === 0 ? "PASS" : "FAIL",
    generatedAt: fixedGeneratedAt,
    nodeVersion: process.version,
    caseCount: cases.length,
    passed: cases.length - failedCases.length,
    failed: failedCases.length,
    scope: [
      "searchlint.seo language version 1",
      "parser/formatter/compiler",
      "imports and import cycles",
      "environment precedence",
      "policy inheritance and route-specific overrides",
      "large configuration compilation",
      "real example configuration compilation",
      "migrate-config byte preservation, backup, and atomic write boundary"
    ]
  };
  const report = {
    schemaVersion: 1,
    summary,
    cases,
    limitations: [
      "Windows path coverage is resolver-level string preservation on this non-Windows host.",
      "Future language target migrations remain blocked until a new language version ADR exists."
    ]
  };

  await mkdir(path.dirname(reportPath), { recursive: true });
  await mkdir(path.dirname(samplePath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(samplePath, `${JSON.stringify(report, null, 2)}\n`);

  if (summary.status !== "PASS") {
    process.exitCode = 1;
  }

  console.log(
    `DSL/config compatibility ${summary.status}: ${summary.passed}/${summary.caseCount} cases passed`
  );
  console.log(`Report: ${path.relative(repoRoot, reportPath)}`);
  console.log(`Sample: ${path.relative(repoRoot, samplePath)}`);
}

async function listExampleConfigs(relativeDir) {
  const dir = path.join(repoRoot, relativeDir);
  const entries = await readdir(dir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".searchlint.seo"))
    .map((entry) => path.join(relativeDir, entry.name))
    .sort();
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
