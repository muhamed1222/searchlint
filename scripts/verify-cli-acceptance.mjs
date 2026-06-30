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

const fixedNow = "2026-06-22T00:00:00.000Z";

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

  const packDir = await mkdtemp(path.join(tmpdir(), "searchlint-cli-packs-"));
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

async function writeConsumerProject(consumerDir, packed) {
  const dependencies = Object.fromEntries(
    packed.map(({ name, tarball }) => [name, `file:${tarball}`])
  );
  await writeFile(
    path.join(consumerDir, "package.json"),
    `${JSON.stringify(
      {
        private: true,
        type: "module",
        dependencies
      },
      null,
      2
    )}\n`
  );
  await writeFile(
    path.join(consumerDir, "pnpm-workspace.yaml"),
    `overrides:
${Object.entries(dependencies)
  .map(([name, tarball]) => `  "${name}": ${tarball}`)
  .join("\n")}
`
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

function searchlint(consumerDir, args) {
  return runStatus("pnpm", ["exec", "searchlint", ...args], {
    cwd: consumerDir
  });
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

async function main() {
  const { packDir, packed } = await packPublicPackages();
  const consumerDir = await mkdtemp(
    path.join(tmpdir(), "searchlint-cli-consumer-")
  );
  const results = [];

  try {
    await writeConsumerProject(consumerDir, packed);
    run("pnpm", ["install"], { cwd: consumerDir, stdio: "inherit" });

    record(
      results,
      "version",
      searchlint(consumerDir, ["--version"]),
      (result) => {
        assert(result.status === 0, "--version must exit 0");
        assert(
          result.stdout === "searchlint 1.0.0-beta.0\n",
          "--version output drifted"
        );
        assert(result.stderr === "", "--version must not write stderr");
      }
    );

    record(results, "doctor", searchlint(consumerDir, ["doctor"]), (result) => {
      assert(result.status === 0, "doctor must exit 0");
      assert(
        result.stdout.includes("SearchLint doctor"),
        "doctor header missing"
      );
      assert(
        result.stdout.includes("status: local CLI runtime checks passed"),
        "doctor status missing"
      );
    });

    record(
      results,
      "completion-bash",
      searchlint(consumerDir, ["completion", "bash"]),
      (result) => {
        assert(result.status === 0, "completion bash must exit 0");
        assert(
          result.stdout.includes(
            "complete -F _searchlint_completion searchlint"
          ),
          "bash completion missing"
        );
      }
    );

    record(results, "init", searchlint(consumerDir, ["init"]), (result) => {
      assert(result.status === 0, "init must exit 0");
      assert(
        result.stdout.includes('site "https://example.com"'),
        "init template missing site"
      );
    });

    record(
      results,
      "config-validate",
      searchlint(consumerDir, [
        "config",
        "validate",
        "--config",
        "searchlint.seo"
      ]),
      (result) => {
        assert(result.status === 0, "config validate must exit 0");
        assert(
          result.stdout.includes("searchlint.seo is valid."),
          "config validate output missing"
        );
      }
    );

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
        assert(result.status === 0, "check json must exit 0");
        const parsed = JSON.parse(result.stdout);
        assert(
          parsed.executedRuleIds.length === 120,
          "check json must execute 120 rules"
        );
        assert(
          Array.isArray(parsed.diagnostics),
          "check json diagnostics missing"
        );
      }
    );

    for (const format of ["text", "sarif", "junit", "html"]) {
      record(
        results,
        `check-${format}`,
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
          format,
          "--fail-on",
          "none",
          "--now",
          fixedNow
        ]),
        (result) => {
          assert(result.status === 0, `check ${format} must exit 0`);
          assert(result.stdout.length > 0, `check ${format} must write stdout`);
        }
      );
    }

    record(
      results,
      "baseline",
      searchlint(consumerDir, [
        "baseline",
        "--snapshot",
        "snapshot.json",
        "--catalog",
        "catalog.yaml",
        "--route-contract",
        "route.json",
        "--now",
        fixedNow
      ]),
      (result) => {
        assert(result.status === 0, "baseline must exit 0");
        const parsed = JSON.parse(result.stdout);
        assert(parsed.entries.length > 0, "baseline must emit entries");
      }
    );

    record(
      results,
      "migrate-config",
      searchlint(consumerDir, [
        "migrate-config",
        "--from",
        "1",
        "--to",
        "1",
        "--write",
        "searchlint.seo"
      ]),
      (result) => {
        assert(result.status === 0, "migrate-config must exit 0");
        assert(
          result.stdout.includes(
            "searchlint.seo already uses language 1; no migration was needed."
          ),
          "migration output missing"
        );
      }
    );

    record(
      results,
      "fail-on-blocker",
      searchlint(consumerDir, [
        "check",
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
        fixedNow
      ]),
      (result) => {
        assert(result.status === 2, "fail-on blocker must exit 2");
      }
    );

    record(
      results,
      "invalid-args",
      searchlint(consumerDir, ["completion", "powershell"]),
      (result) => {
        assert(result.status === 1, "invalid args must exit 1");
        assert(
          result.stderr.includes("Usage: searchlint completion"),
          "invalid args stderr missing"
        );
      }
    );

    const report = {
      generatedAt: fixedNow,
      status: "PASS",
      platform: process.platform,
      nodeVersion: process.version,
      packageManager: `pnpm ${run("pnpm", ["--version"]).trim()}`,
      packageCount: packed.length,
      commandCount: results.length,
      results
    };

    await mkdir(path.join(repoRoot, "reports"), { recursive: true });
    await writeFile(
      path.join(repoRoot, "reports/cli-acceptance-report.json"),
      `${JSON.stringify(report, null, 2)}\n`
    );
    await mkdir(path.join(repoRoot, "docs/examples"), { recursive: true });
    await writeFile(
      path.join(repoRoot, "docs/examples/cli-acceptance-report.sample.json"),
      `${JSON.stringify(report, null, 2)}\n`
    );

    console.log(
      `CLI acceptance passed: ${results.length} commands, ${packed.length} packages, ${process.platform}, ${process.version}`
    );
  } finally {
    await rm(packDir, { recursive: true, force: true });
    await rm(consumerDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
