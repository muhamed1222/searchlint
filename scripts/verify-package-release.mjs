#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const publicPackages = [
  "packages/browser",
  "packages/cli",
  "packages/core",
  "packages/crawler",
  "packages/html",
  "packages/http",
  "packages/language",
  "packages/language-server",
  "packages/lsp",
  "packages/next",
  "packages/overlay",
  "packages/reporter-html",
  "packages/reporter-junit",
  "packages/reporter-sarif",
  "packages/searchlint",
  "packages/source"
];

const packageStatuses = new Map();

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    env: { ...process.env, ...options.env },
    encoding: "utf8",
    stdio: options.stdio ?? "pipe"
  });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function flattenExportTargets(exportsValue) {
  if (typeof exportsValue === "string") {
    return [exportsValue];
  }

  if (exportsValue && typeof exportsValue === "object") {
    return Object.values(exportsValue).flatMap((value) =>
      flattenExportTargets(value)
    );
  }

  return [];
}

function mark(packageName, step) {
  packageStatuses.set(packageName, {
    ...packageStatuses.get(packageName),
    [step]: "pass"
  });
}

async function verifyManifest(packageDir) {
  const packageJsonPath = path.join(repoRoot, packageDir, "package.json");
  const manifest = await readJson(packageJsonPath);
  const targets = [
    ...flattenExportTargets(manifest.exports),
    ...Object.values(manifest.bin ?? {})
  ];

  assert(
    targets.length > 0,
    `${manifest.name} must declare package exports or bin entries`
  );
  assert(
    manifest.engines?.pnpm === undefined,
    `${manifest.name} must not publish engines.pnpm; package-manager requirements belong to repository tooling, not consumer package metadata`
  );
  assert(
    targets.every((target) => !target.startsWith("./src/")),
    `${manifest.name} exports/bin must not point at src`
  );
  assert(
    targets.every(
      (target) => !target.endsWith(".ts") || target.endsWith(".d.ts")
    ),
    `${manifest.name} exports/bin must not point at TypeScript runtime files`
  );
  assert(
    targets
      .filter((target) => !target.endsWith(".d.ts"))
      .every((target) => target.startsWith("./dist/")),
    `${manifest.name} runtime exports/bin must point at dist`
  );

  mark(manifest.name, "manifest");
  return manifest;
}

async function verifyTarballContents(packageName, tarballPath) {
  const entries = run("tar", ["-tzf", tarballPath]).trim().split("\n");
  assert(
    entries.some((entry) => entry === "package/package.json"),
    `${packageName} tarball must include package.json`
  );
  assert(
    entries.some((entry) => entry.startsWith("package/dist/src/")),
    `${packageName} tarball must include dist/src`
  );
  assert(
    entries.every((entry) => !entry.startsWith("package/src/")),
    `${packageName} tarball must not include src artifacts`
  );
  assert(
    entries.every((entry) => !entry.includes("/test/")),
    `${packageName} tarball must not include test artifacts`
  );
  assert(
    entries.every((entry) => !entry.endsWith(".ts") || entry.endsWith(".d.ts")),
    `${packageName} tarball must not include runtime TypeScript files`
  );

  const packedManifest = JSON.parse(
    run("tar", ["-xOf", tarballPath, "package/package.json"])
  );
  const dependencyBlocks = [
    packedManifest.dependencies,
    packedManifest.peerDependencies,
    packedManifest.optionalDependencies
  ].filter(Boolean);
  assert(
    packedManifest.engines?.pnpm === undefined,
    `${packageName} packed manifest must not include engines.pnpm`
  );
  for (const dependencies of dependencyBlocks) {
    for (const [dependencyName, range] of Object.entries(dependencies)) {
      assert(
        !String(range).startsWith("workspace:"),
        `${packageName} packed dependency ${dependencyName} must not use workspace:`
      );
    }
  }

  mark(packageName, "pack");
}

async function writeConsumerFiles(
  consumerDir,
  catalogText,
  manifests,
  tarballs
) {
  const dependencies = Object.fromEntries(
    manifests.map(({ manifest }, index) => [
      manifest.name,
      `file:${tarballs[index]}`
    ])
  );
  await writeFile(
    path.join(consumerDir, "package.json"),
    JSON.stringify(
      {
        type: "module",
        private: true,
        dependencies,
        devDependencies: {
          typescript: "6.0.3"
        }
      },
      null,
      2
    )
  );
  await writeFile(
    path.join(consumerDir, "pnpm-workspace.yaml"),
    `overrides:
${Object.entries(dependencies)
  .map(
    ([dependencyName, dependencyPath]) =>
      `  "${dependencyName}": ${dependencyPath}`
  )
  .join("\n")}
`
  );
  await writeFile(
    path.join(consumerDir, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          module: "NodeNext",
          moduleResolution: "NodeNext",
          target: "ES2024",
          strict: true,
          skipLibCheck: false,
          noEmit: true
        },
        include: ["consumer-types.ts"]
      },
      null,
      2
    )
  );
  await writeFile(path.join(consumerDir, "catalog.yaml"), catalogText);
  await writeFile(
    path.join(consumerDir, "route.json"),
    JSON.stringify({ route: "/products/**", indexable: true }, null, 2)
  );
  await writeFile(
    path.join(consumerDir, "snapshot.json"),
    JSON.stringify(
      {
        pageUrl: "https://example.com/products/1",
        route: "/products/**",
        capturedAt: "2026-06-21T00:00:00.000Z",
        http: {
          statusCode: 200,
          finalUrl: "https://example.com/products/1",
          headers: { "content-type": "text/html" },
          redirectChain: []
        },
        rawHtml:
          '<html lang="en"><head><meta name="robots" content="noindex"></head><body><h1>Product</h1></body></html>',
        renderedDom:
          '<html lang="en"><head><meta name="robots" content="noindex"></head><body><h1>Product</h1></body></html>'
      },
      null,
      2
    )
  );
  await writeFile(
    path.join(consumerDir, "searchlint.seo"),
    `language 1
site "https://example.com"
route "/**" {
  indexable true
}
`
  );
  await writeFile(
    path.join(consumerDir, "consumer-smoke.mjs"),
    `import { readFile } from "node:fs/promises";
import * as browser from "@searchlint/browser";
import * as cli from "@searchlint/cli";
import * as cliNode from "@searchlint/cli/node";
import * as core from "@searchlint/core";
import * as crawler from "@searchlint/crawler";
import * as html from "@searchlint/html";
import * as http from "@searchlint/http";
import * as language from "@searchlint/language";
import * as languageServer from "searchlint-language-server";
import * as lsp from "@searchlint/lsp";
import * as next from "@searchlint/next";
import * as overlay from "@searchlint/overlay";
import * as htmlReport from "@searchlint/reporter-html";
import * as junit from "@searchlint/reporter-junit";
import * as sarif from "@searchlint/reporter-sarif";
import * as source from "@searchlint/source";

const modules = { browser, cli, cliNode, core, crawler, html, http, language, languageServer, lsp, next, overlay, htmlReport, junit, sarif, source };
for (const [name, module] of Object.entries(modules)) {
  if (Object.keys(module).length === 0) {
    throw new Error(name + " exposes no public runtime exports");
  }
}

const catalogText = await readFile("catalog.yaml", "utf8");
const catalog = core.parseRuleCatalogYaml(catalogText);
if (catalog.rules.length !== 120) {
  throw new Error("expected 120 catalog rules, got " + catalog.rules.length);
}

const registry = core.createRuleCatalogRegistry(catalog);
const rules = [
  ...core.createCoreHttpAndIndexabilityRules(registry),
  ...core.createCoreTitleMetadataRules(registry),
  ...core.createCoreCanonicalHreflangRules(registry),
  ...core.createCoreStructuralMediaSchemaLinkRules(registry),
  ...core.createCoreRobotsSitemapPerformanceRules(registry)
];
const snapshot = JSON.parse(await readFile("snapshot.json", "utf8"));
const engineResult = await core.runRuleEngine({
  rules,
  snapshot,
  routeContracts: [{ route: "/products/**", indexable: true }],
  options: { now: "2026-06-21T00:00:00.000Z" }
});
if (engineResult.executedRuleIds.length !== 120) {
  throw new Error("expected 120 executed rules, got " + engineResult.executedRuleIds.length);
}
if (!engineResult.diagnostics.some((diagnostic) => diagnostic.ruleId === "SL-INDEX-001")) {
  throw new Error("catalog E2E did not produce SL-INDEX-001");
}

const parsedConfig = language.parseSearchLintDocument(\`language 1
site "https://example.com"
let schemas ["Product", "BreadcrumbList"]
policy productPage {
  schema $schemas
}
route "/products/[slug]" {
  use productPage
  indexable true
}
\`);
if (parsedConfig.diagnostics.length !== 0) {
  throw new Error("installed language parser rejected public DSL v1");
}
const compiledConfig = language.compileSearchLintDocument(parsedConfig.ast);
if (compiledConfig.diagnostics.length !== 0 || !compiledConfig.config) {
  throw new Error("installed language compiler rejected public DSL v1");
}
if (compiledConfig.config.routePrecedence[0] !== "/products/[slug]") {
  throw new Error("installed language compiler produced unstable route precedence");
}

const crawlResult = await cli.analyzeCrawl(
  {
    catalogPath: "catalog.yaml",
    configPath: "searchlint.seo",
    format: "json",
    failOn: "none",
    now: "2026-06-21T00:00:00.000Z",
    crawl: {
      startUrl: "https://example.com/",
      maxUrls: 1,
      respectRobotsTxt: false
    }
  },
  {
    async readText(path) {
      return await readFile(path, "utf8");
    }
  },
  {
    async fetch(url) {
      return {
        url,
        statusCode: 200,
        headers: { "content-type": "text/html" },
        body: '<html><head><meta name="robots" content="noindex"></head><body><h1>Home</h1></body></html>'
      };
    }
  }
);
if (crawlResult.executedRuleIds.length !== 120) {
  throw new Error("expected 120 crawler executed rules, got " + crawlResult.executedRuleIds.length);
}
if (!crawlResult.diagnostics.some((diagnostic) => diagnostic.ruleId === "SL-INDEX-001")) {
  throw new Error("crawler smoke did not produce SL-INDEX-001");
}
`
  );
  await writeFile(
    path.join(consumerDir, "consumer-types.ts"),
    `import { analyzeCrawl } from "@searchlint/cli";
import {
  parseRuleCatalogYaml,
  type Diagnostic,
  type RuleCatalog
} from "@searchlint/core";
import { crawlSite, type CrawlOptions } from "@searchlint/crawler";
import { deriveBadgeState, type BadgeState } from "@searchlint/overlay";
import { createHtmlReport } from "@searchlint/reporter-html";

const catalog: RuleCatalog = parseRuleCatalogYaml("categories: []\\nrules: []\\n");
const diagnostics: Diagnostic[] = [];
const options: CrawlOptions = { startUrl: "https://example.com/" };
const badgeState: BadgeState = deriveBadgeState(diagnostics);
const report: string = createHtmlReport(diagnostics);

void catalog;
void diagnostics;
void options;
void badgeState;
void report;
void analyzeCrawl;
void crawlSite;
`
  );
}

async function main() {
  console.log(`Node.js ${process.version}`);
  console.log(run("pnpm", ["--version"]).trim());
  run("pnpm", ["build"], { stdio: "inherit" });

  const manifests = [];
  for (const packageDir of publicPackages) {
    manifests.push({ packageDir, manifest: await verifyManifest(packageDir) });
  }

  const packDir = await mkdtemp(path.join(tmpdir(), "searchlint-packs-"));
  const tarballs = [];
  for (const { packageDir, manifest } of manifests) {
    const before = new Set(await readdir(packDir));
    run(
      "pnpm",
      [
        "--dir",
        path.join(repoRoot, packageDir),
        "pack",
        "--pack-destination",
        packDir
      ],
      {
        stdio: "inherit"
      }
    );
    const after = await readdir(packDir);
    const created = after
      .filter((entry) => !before.has(entry) && entry.endsWith(".tgz"))
      .map((entry) => path.join(packDir, entry));
    assert(
      created.length === 1,
      `${manifest.name} pack must create one tarball`
    );
    await verifyTarballContents(manifest.name, created[0]);
    tarballs.push(created[0]);
  }

  const consumerDir = await mkdtemp(
    path.join(tmpdir(), "searchlint-consumer-")
  );
  const catalogText = await readFile(
    path.join(repoRoot, "specs/RULE_CATALOG.yaml"),
    "utf8"
  );
  await writeConsumerFiles(consumerDir, catalogText, manifests, tarballs);
  run("pnpm", ["install"], {
    cwd: consumerDir,
    stdio: "inherit"
  });
  for (const { manifest } of manifests) {
    mark(manifest.name, "install");
  }

  run("node", ["consumer-smoke.mjs"], { cwd: consumerDir, stdio: "inherit" });
  for (const { manifest } of manifests) {
    mark(manifest.name, "import");
  }

  run("pnpm", ["exec", "tsc", "-p", "tsconfig.json"], {
    cwd: consumerDir,
    stdio: "inherit"
  });
  for (const { manifest } of manifests) {
    mark(manifest.name, "types");
  }

  const cliOutput = run(
    "pnpm",
    [
      "exec",
      "searchlint",
      "--snapshot",
      "snapshot.json",
      "--catalog",
      "catalog.yaml",
      "--route-contract",
      "route.json",
      "--format",
      "json",
      "--fail-on",
      "none",
      "--now",
      "2026-06-21T00:00:00.000Z"
    ],
    { cwd: consumerDir }
  );
  const cliJson = JSON.parse(cliOutput);
  assert(
    cliJson.executedRuleIds.length === 120,
    `CLI smoke expected 120 executed rules, got ${cliJson.executedRuleIds.length}`
  );
  assert(
    cliJson.diagnostics.some(
      (diagnostic) => diagnostic.ruleId === "SL-INDEX-001"
    ),
    "CLI smoke did not produce SL-INDEX-001"
  );

  console.log("package | pack | install | import | types");
  console.log("--- | --- | --- | --- | ---");
  for (const { manifest } of manifests) {
    const status = packageStatuses.get(manifest.name);
    console.log(
      `${manifest.name} | ${status.pack} | ${status.install} | ${status.import} | ${status.types}`
    );
  }
  console.log("release acceptance verification passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
