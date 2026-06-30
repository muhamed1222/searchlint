#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { format } from "prettier";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const npmRegistry = "https://registry.npmjs.org";
const fixedNow = "2026-06-30T00:00:00.000Z";
const reportPath = path.join(
  repoRoot,
  "reports/public-npm-registry-install-report.json"
);
const samplePath = path.join(
  repoRoot,
  "docs/examples/public-npm-registry-install-report.sample.json"
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
  "packages/source",
  "packages/searchlint"
];
const privatePackageNames = [
  "@searchlint/api",
  "@searchlint/workers",
  "@searchlint/dashboard"
];

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    env: { ...process.env, ...options.env },
    encoding: "utf8",
    stdio: options.stdio ?? "pipe",
    maxBuffer: 20 * 1024 * 1024
  });
}

function runStatus(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    env: { ...process.env, ...options.env },
    encoding: "utf8",
    timeout: options.timeout ?? 120000,
    maxBuffer: 20 * 1024 * 1024
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    error: result.error?.message
  };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(repoRoot, relativePath), "utf8"));
}

async function packageManifest(packageDir) {
  return await readJson(`${packageDir}/package.json`);
}

function npmViewJson(packageSpec) {
  return JSON.parse(
    run("npm", ["view", packageSpec, "--json", "--registry", npmRegistry])
  );
}

function npmViewStatus(packageName) {
  return runStatus("npm", [
    "view",
    packageName,
    "version",
    "--json",
    "--registry",
    npmRegistry
  ]);
}

function summarizeOutput(output) {
  return String(output)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-20);
}

async function writeConsumerProject(consumerDir, packages) {
  const dependencies = Object.fromEntries(
    packages.map((item) => [item.name, item.version])
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
    path.join(consumerDir, "searchlint.seo"),
    `language 1

site "https://example.com"

route "/products/**" {
  indexable true
}
`
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
  return runStatus(
    path.join(consumerDir, "node_modules/.bin/searchlint"),
    args,
    {
      cwd: consumerDir
    }
  );
}

async function main() {
  if (!process.version.startsWith("v24.")) {
    throw new Error(
      `public npm registry install acceptance must run under Node.js 24, got ${process.version}`
    );
  }

  const packageReports = [];
  for (const packageDir of publicPackages) {
    const manifest = await packageManifest(packageDir);
    const published = npmViewJson(`${manifest.name}@${manifest.version}`);
    assert(
      published.name === manifest.name,
      `${manifest.name} npm metadata name drifted`
    );
    assert(
      published.version === manifest.version,
      `${manifest.name} npm metadata version drifted`
    );
    assert(
      published["dist-tags"]?.beta === manifest.version,
      `${manifest.name} beta dist-tag must point at ${manifest.version}`
    );
    assert(
      published["dist-tags"]?.latest === manifest.version,
      `${manifest.name} latest dist-tag must point at ${manifest.version}`
    );
    assert(
      typeof published.dist?.tarball === "string" &&
        published.dist.tarball.startsWith(`${npmRegistry}/`),
      `${manifest.name} must expose an npm registry tarball URL`
    );
    assert(
      typeof published.dist?.integrity === "string" &&
        published.dist.integrity.startsWith("sha512-"),
      `${manifest.name} must expose sha512 integrity`
    );
    assert(
      Array.isArray(published.dist?.signatures) &&
        published.dist.signatures.length > 0,
      `${manifest.name} must expose npm registry signatures`
    );
    packageReports.push({
      name: manifest.name,
      version: manifest.version,
      betaDistTag: published["dist-tags"].beta,
      latestDistTag: published["dist-tags"].latest,
      publishedAt: published.time?.[manifest.version] ?? null,
      tarballHost: new URL(published.dist.tarball).host,
      hasIntegrity: true,
      signatureCount: published.dist.signatures.length
    });
  }

  const privatePackageReports = privatePackageNames.map((name) => {
    const result = npmViewStatus(name);
    assert(result.status !== 0, `${name} must not be publicly visible on npm`);
    assert(
      /E404|not found|Not Found/i.test(result.stderr + result.stdout),
      `${name} npm absence must be an npm 404/not found response`
    );
    return {
      name,
      visibleOnNpm: false,
      npmStatus: result.status,
      summary: summarizeOutput(result.stderr + result.stdout).slice(0, 4)
    };
  });

  const consumerDir = await mkdtemp(
    path.join(tmpdir(), "searchlint-public-npm-consumer-")
  );
  const commandResults = [];
  try {
    await writeConsumerProject(consumerDir, packageReports);
    const install = runStatus(
      "npm",
      [
        "install",
        "--registry",
        npmRegistry,
        "--cache",
        path.join(consumerDir, ".npm-cache"),
        "--prefer-online",
        "--ignore-scripts",
        "--no-audit",
        "--no-fund",
        "--package-lock=false"
      ],
      { cwd: consumerDir, timeout: 120000 }
    );
    assert(
      install.status === 0,
      `public npm install failed: ${install.stderr.slice(0, 2000)}`
    );
    commandResults.push({
      command: "npm install --registry https://registry.npmjs.org",
      status: "passed",
      outputSummary: summarizeOutput(install.stdout)
    });

    const expectedSearchlint = packageReports.find(
      (item) => item.name === "searchlint"
    );
    const version = searchlint(consumerDir, ["--version"]);
    assert(version.status === 0, "searchlint --version must pass");
    assert(
      version.stdout === `searchlint ${expectedSearchlint.version}\n`,
      "searchlint --version output must match published wrapper version"
    );
    commandResults.push({
      command: "searchlint --version",
      status: "passed",
      outputSummary: summarizeOutput(version.stdout)
    });

    const doctor = searchlint(consumerDir, ["doctor"]);
    assert(doctor.status === 0, "searchlint doctor must pass");
    assert(
      doctor.stdout.includes("status: local CLI runtime checks passed"),
      "doctor must report local runtime checks passed"
    );
    commandResults.push({
      command: "searchlint doctor",
      status: "passed",
      outputSummary: summarizeOutput(doctor.stdout)
    });

    const check = searchlint(consumerDir, [
      "check",
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
      fixedNow
    ]);
    assert(check.status === 0, "searchlint check must pass");
    const parsed = JSON.parse(check.stdout);
    assert(
      parsed.executedRuleIds.length === 120,
      "searchlint check must execute all 120 rules"
    );
    commandResults.push({
      command: "searchlint check --format json",
      status: "passed",
      outputSummary: [
        `executedRuleIds=${parsed.executedRuleIds.length}`,
        `diagnostics=${parsed.diagnostics.length}`
      ]
    });
  } finally {
    await rm(consumerDir, { recursive: true, force: true });
  }

  const report = {
    schemaVersion: 1,
    generatedBy: "searchlint-public-npm-registry-install-verifier",
    generatedAt: fixedNow,
    status: "PASS",
    registry: npmRegistry,
    publicPackageCount: packageReports.length,
    privatePackageCount: privatePackageReports.length,
    publicPackages: packageReports,
    privatePackages: privatePackageReports,
    commandResults,
    releaseEvidence: {
      betaPackagesPublished: true,
      cleanPublicRegistryInstallPassed: true,
      privateCloudPackagesNotPublished: true
    }
  };

  assertNoSensitiveValues(JSON.stringify(report));
  await mkdir(path.dirname(reportPath), { recursive: true });
  await mkdir(path.dirname(samplePath), { recursive: true });
  await writeFile(
    reportPath,
    await format(JSON.stringify(report), { parser: "json" })
  );
  await writeFile(
    samplePath,
    await format(JSON.stringify(report), { parser: "json" })
  );
  console.log(
    `public npm registry install PASS: ${packageReports.length} public packages, ${commandResults.length} clean consumer commands`
  );
  console.log(`Report: ${path.relative(repoRoot, reportPath)}`);
  console.log(`Sample: ${path.relative(repoRoot, samplePath)}`);
}

function assertNoSensitiveValues(serialized) {
  const forbidden = [
    /npm_[A-Za-z0-9]{20,}/,
    /ghp_[A-Za-z0-9_]{20,}/,
    /authorization/i,
    /bearer\s+[A-Za-z0-9._-]+/i,
    /password/i,
    /secret/i,
    /private[_-]?key/i
  ];
  for (const pattern of forbidden) {
    if (pattern.test(serialized)) {
      throw new Error(`Sensitive value pattern detected: ${pattern}`);
    }
  }
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
