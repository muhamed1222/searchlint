#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
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
  "packages/source"
];

const fixedNow = "2026-06-23T00:00:00.000Z";

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

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function packPublicPackages() {
  run("pnpm", ["build"], { stdio: "inherit" });

  const packDir = await mkdtemp(
    path.join(tmpdir(), "searchlint-cli-package-manager-packs-")
  );
  const packed = [];
  for (const packageDir of publicPackages) {
    const manifest = await readJson(
      path.join(repoRoot, packageDir, "package.json")
    );
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
      { stdio: "inherit" }
    );
    const after = await readdir(packDir);
    const created = after
      .filter((entry) => !before.has(entry) && entry.endsWith(".tgz"))
      .map((entry) => path.join(packDir, entry));
    assert(created.length === 1, `${manifest.name} must create one tarball`);
    packed.push({ name: manifest.name, tarball: created[0] });
  }
  return { packDir, packed };
}

async function writeConsumerProject(consumerDir, packed, packageManager) {
  const dependencies = Object.fromEntries(
    packed.map(({ name, tarball }) => [name, `file:${tarball}`])
  );
  const manifest = {
    private: true,
    type: "module",
    dependencies
  };

  if (packageManager === "yarn") {
    manifest.packageManager = "yarn@4.12.0";
    manifest.resolutions = dependencies;
    await writeFile(
      path.join(consumerDir, ".yarnrc.yml"),
      "nodeLinker: node-modules\nenableGlobalCache: true\n"
    );
  }

  await writeFile(
    path.join(consumerDir, "package.json"),
    `${JSON.stringify(manifest, null, 2)}\n`
  );
  await writeFile(
    path.join(consumerDir, "searchlint.seo"),
    `language 1

site "https://example.com"

route "/products/**" {
  indexable true
}
`
  );
  await writeFile(
    path.join(consumerDir, "route.json"),
    `${JSON.stringify({ route: "/products/**", indexable: true }, null, 2)}\n`
  );
  await writeFile(
    path.join(consumerDir, "snapshot.json"),
    `${JSON.stringify(
      {
        pageUrl: "https://example.com/products/1",
        route: "/products/**",
        capturedAt: fixedNow,
        http: {
          statusCode: 200,
          finalUrl: "https://example.com/products/1",
          headers: {
            "content-type": "text/html"
          },
          redirectChain: []
        },
        rawHtml:
          '<!doctype html><html lang="en"><head><meta name="robots" content="noindex"></head><body><h1>Product</h1></body></html>',
        renderedDom:
          '<!doctype html><html lang="en"><head><meta name="robots" content="noindex"></head><body><h1>Product</h1></body></html>'
      },
      null,
      2
    )}\n`
  );
  await writeFile(
    path.join(consumerDir, "catalog.yaml"),
    await readFile(path.join(repoRoot, "specs/RULE_CATALOG.yaml"), "utf8")
  );
}

function installConsumer(consumerDir, packageManager) {
  if (packageManager === "npm") {
    run(
      "npm",
      [
        "install",
        "--ignore-scripts",
        "--no-audit",
        "--no-fund",
        "--package-lock=false"
      ],
      { cwd: consumerDir, stdio: "inherit" }
    );
    return;
  }

  run("corepack", ["yarn", "install", "--mode=skip-build"], {
    cwd: consumerDir,
    stdio: "inherit"
  });
}

function searchlint(consumerDir, args) {
  return runStatus(
    path.join(consumerDir, "node_modules/.bin/searchlint"),
    args,
    {
      cwd: consumerDir
    }
  );
}

function record(results, name, result, validate) {
  validate(result);
  results.push({
    name,
    exitCode: result.status,
    stdoutBytes: result.stdout.length,
    stderrBytes: result.stderr.length,
    status: "pass"
  });
}

async function verifyPackageManager(packageManager, packed) {
  const consumerDir = await mkdtemp(
    path.join(tmpdir(), `searchlint-cli-${packageManager}-consumer-`)
  );
  const results = [];

  try {
    await writeConsumerProject(consumerDir, packed, packageManager);
    installConsumer(consumerDir, packageManager);

    record(
      results,
      "version",
      searchlint(consumerDir, ["--version"]),
      (result) => {
        assert(result.status === 0, `${packageManager} --version must exit 0`);
        assert(
          result.stdout === "searchlint 1.0.0-beta.0\n",
          `${packageManager} --version output drifted`
        );
        assert(result.stderr === "", `${packageManager} --version stderr`);
      }
    );

    record(results, "doctor", searchlint(consumerDir, ["doctor"]), (result) => {
      assert(result.status === 0, `${packageManager} doctor must exit 0`);
      assert(
        result.stdout.includes("SearchLint doctor"),
        `${packageManager} doctor header missing`
      );
      assert(
        result.stdout.includes("status: local CLI runtime checks passed"),
        `${packageManager} doctor status missing`
      );
    });

    record(
      results,
      "check-json",
      searchlint(consumerDir, [
        "check",
        "--snapshot",
        "snapshot.json",
        "--catalog",
        "catalog.yaml",
        "--config",
        "searchlint.seo",
        "--route-contract",
        "route.json",
        "--format",
        "json",
        "--fail-on",
        "none",
        "--now",
        fixedNow
      ]),
      (result) => {
        assert(result.status === 0, `${packageManager} check json exit`);
        const parsed = JSON.parse(result.stdout);
        assert(
          parsed.executedRuleIds.length === 120,
          `${packageManager} check json must execute 120 rules`
        );
        assert(
          Array.isArray(parsed.diagnostics),
          `${packageManager} check json diagnostics missing`
        );
      }
    );

    return {
      packageManager,
      status: "PASS",
      commandCount: results.length,
      results
    };
  } finally {
    await rm(consumerDir, { recursive: true, force: true });
  }
}

async function main() {
  if (!process.version.startsWith("v24.")) {
    throw new Error(
      `CLI package-manager acceptance must run under Node.js 24, got ${process.version}`
    );
  }

  const { packDir, packed } = await packPublicPackages();

  try {
    const packageManagers = [
      await verifyPackageManager("npm", packed),
      await verifyPackageManager("yarn", packed)
    ];

    const report = {
      generatedAt: fixedNow,
      status: "PASS",
      platform: process.platform,
      nodeVersion: process.version,
      packageCount: packed.length,
      packageManagers,
      limitations: [
        "Uses local package tarballs, not a real npm registry.",
        "Does not prove Windows, Linux, or hosted CI environment acceptance.",
        "Yarn acceptance uses Corepack-managed Yarn 4 with nodeLinker node-modules."
      ]
    };

    await mkdir(path.join(repoRoot, "reports"), { recursive: true });
    await writeFile(
      path.join(repoRoot, "reports/cli-package-manager-acceptance-report.json"),
      `${JSON.stringify(report, null, 2)}\n`
    );
    await mkdir(path.join(repoRoot, "docs/examples"), { recursive: true });
    await writeFile(
      path.join(
        repoRoot,
        "docs/examples/cli-package-manager-acceptance-report.sample.json"
      ),
      `${JSON.stringify(report, null, 2)}\n`
    );

    console.log(
      `CLI package-manager acceptance passed: ${packageManagers.length} package managers, ${packed.length} packages, ${process.platform}, ${process.version}`
    );
  } finally {
    await rm(packDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
