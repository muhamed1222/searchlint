#!/usr/bin/env node
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile
} from "node:fs/promises";
import http from "node:http";
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
  "packages/source",
  "packages/searchlint"
];

const fixedNow = "2026-06-23T00:00:00.000Z";
const reportPath = path.join(
  repoRoot,
  "reports/npm-like-registry-install-report.json"
);
const samplePath = path.join(
  repoRoot,
  "docs/examples/npm-like-registry-install-report.sample.json"
);

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    env: { ...process.env, ...options.env },
    encoding: options.encoding ?? "utf8",
    stdio: options.stdio ?? "pipe"
  });
}

function runStatus(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    env: { ...process.env, ...options.env },
    encoding: "utf8",
    timeout: options.timeout
  });

  return {
    status: result.status ?? 1,
    stdout: result.stdout,
    stderr: result.stderr,
    error: result.error
  };
}

async function runAsync(command, args, options = {}) {
  return await new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? repoRoot,
      env: { ...process.env, ...options.env },
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = options.timeout
      ? setTimeout(() => {
          timedOut = true;
          child.kill("SIGTERM");
        }, options.timeout)
      : null;

    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      if (timer) clearTimeout(timer);
      resolve({ status: 1, stdout, stderr, error, timedOut });
    });
    child.on("close", (code) => {
      if (timer) clearTimeout(timer);
      resolve({ status: code ?? 1, stdout, stderr, timedOut });
    });
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

function packageTarballId(name, version) {
  return `${name.replace("/", "__")}@${version}.tgz`;
}

function tarballIntegrity(buffer) {
  return `sha512-${createHash("sha512").update(buffer).digest("base64")}`;
}

function tarballShasum(buffer) {
  return createHash("sha1").update(buffer).digest("hex");
}

async function packPublicPackages() {
  run("pnpm", ["build"], { stdio: "inherit" });

  const packDir = await mkdtemp(path.join(tmpdir(), "searchlint-registry-"));
  const packages = [];

  for (const packageDir of publicPackages) {
    const sourceManifest = await readJson(
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
    assert(
      created.length === 1,
      `${sourceManifest.name} must create one tarball`
    );
    const tarballPath = created[0];
    const tarballBuffer = await readFile(tarballPath);
    const packedManifest = JSON.parse(
      run("tar", ["-xOf", tarballPath, "package/package.json"])
    );

    assert(
      packedManifest.name === sourceManifest.name,
      `${packageDir} packed manifest name drifted`
    );
    assert(
      packedManifest.version === sourceManifest.version,
      `${packageDir} packed manifest version drifted`
    );

    const workspaceDependency = Object.entries(
      packedManifest.dependencies ?? {}
    ).find(([, range]) => String(range).startsWith("workspace:"));
    assert(
      !workspaceDependency,
      `${packedManifest.name} packed manifest still contains workspace dependency ${workspaceDependency?.[0]}`
    );

    packages.push({
      name: packedManifest.name,
      version: packedManifest.version,
      manifest: packedManifest,
      tarballPath,
      tarballBytes: tarballBuffer.length,
      integrity: tarballIntegrity(tarballBuffer),
      shasum: tarballShasum(tarballBuffer),
      tarballId: packageTarballId(packedManifest.name, packedManifest.version)
    });
  }

  return { packDir, packages };
}

function startRegistry(packages) {
  const byName = new Map(packages.map((item) => [item.name, item]));
  const byTarballId = new Map(packages.map((item) => [item.tarballId, item]));
  const requests = [];

  const server = http.createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const decodedPath = decodeURIComponent(url.pathname.replace(/^\//, ""));
    requests.push({
      method: request.method,
      path: decodedPath
    });

    if (request.method !== "GET") {
      response.writeHead(405);
      response.end("method not allowed");
      return;
    }

    if (decodedPath === "-/ping") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ ok: true }));
      return;
    }

    if (decodedPath.startsWith("tarballs/")) {
      const tarballId = decodedPath.slice("tarballs/".length);
      const item = byTarballId.get(tarballId);
      if (!item) {
        response.writeHead(404);
        response.end("tarball not found");
        return;
      }
      response.writeHead(200, {
        "content-type": "application/octet-stream"
      });
      createReadStream(item.tarballPath).pipe(response);
      return;
    }

    const item = byName.get(decodedPath);
    if (!item) {
      response.writeHead(404);
      response.end("package not found");
      return;
    }

    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    const metadata = {
      name: item.name,
      "dist-tags": {
        latest: item.version
      },
      versions: {
        [item.version]: {
          ...item.manifest,
          dist: {
            tarball: `${baseUrl}/tarballs/${encodeURIComponent(
              item.tarballId
            )}`,
            integrity: item.integrity,
            shasum: item.shasum
          }
        }
      }
    };

    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify(metadata));
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      resolve({
        server,
        registryUrl: `http://127.0.0.1:${server.address().port}`,
        requests
      });
    });
  });
}

async function writeConsumerProject(consumerDir) {
  const searchlintVersion = packageVersion("searchlint");
  await writeFile(
    path.join(consumerDir, "package.json"),
    `${JSON.stringify(
      {
        private: true,
        type: "module",
        dependencies: {
          searchlint: searchlintVersion
        }
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

let packageVersionByName = new Map();

function packageVersion(name) {
  const version = packageVersionByName.get(name);
  assert(version, `packed package ${name} is required`);
  return version;
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

async function closeServer(server) {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

async function main() {
  if (!process.version.startsWith("v24.")) {
    throw new Error(
      `npm-like registry install acceptance must run under Node.js 24, got ${process.version}`
    );
  }

  const { packDir, packages } = await packPublicPackages();
  packageVersionByName = new Map(
    packages.map((item) => [item.name, item.version])
  );
  const consumerDir = await mkdtemp(
    path.join(tmpdir(), "searchlint-registry-consumer-")
  );
  const { server, registryUrl, requests } = await startRegistry(packages);
  const results = [];

  try {
    await writeConsumerProject(consumerDir);
    const install = await runAsync(
      "npm",
      [
        "install",
        "--registry",
        registryUrl,
        "--cache",
        path.join(consumerDir, ".npm-cache"),
        "--prefer-online",
        "--ignore-scripts",
        "--no-audit",
        "--no-fund",
        "--package-lock=false"
      ],
      { cwd: consumerDir, timeout: 30000 }
    );
    assert(
      install.status === 0,
      `npm registry install failed or timed out: status=${install.status} timedOut=${install.timedOut} error=${install.error?.message ?? "none"} stderr=${install.stderr.slice(0, 2000)} requests=${JSON.stringify(requests.slice(-20))}`
    );

    record(
      results,
      "version",
      searchlint(consumerDir, ["--version"]),
      (result) => {
        assert(result.status === 0, "--version must exit 0");
        assert(
          result.stdout === `searchlint ${packageVersion("searchlint")}\n`,
          "--version output drifted"
        );
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
      "check-json",
      searchlint(consumerDir, [
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
      ]),
      (result) => {
        assert(result.status === 0, "check json must exit 0");
        const parsed = JSON.parse(result.stdout);
        assert(
          parsed.executedRuleIds.length === 120,
          "check json must execute 120 rules"
        );
      }
    );

    const packageRequests = requests
      .filter((item) => item.method === "GET")
      .map((item) => item.path);
    const requestedPackageNames = packages
      .map((item) => item.name)
      .filter((name) => packageRequests.includes(name));
    const requestedTarballs = packages
      .map((item) => item.tarballId)
      .filter((tarballId) => packageRequests.includes(`tarballs/${tarballId}`));

    assert(
      requestedPackageNames.includes("@searchlint/cli"),
      "registry install must request @searchlint/cli metadata"
    );
    assert(
      requestedPackageNames.includes("@searchlint/core"),
      "registry install must request @searchlint/core metadata"
    );
    assert(
      requestedTarballs.length >= requestedPackageNames.length,
      "registry install must fetch tarballs for requested packages"
    );

    const report = {
      schemaVersion: 1,
      generatedBy: "searchlint-npm-like-registry-install",
      generatedAt: fixedNow,
      status: "PASS",
      platform: process.platform,
      nodeVersion: process.version,
      packageCount: packages.length,
      installedRootDependencies: ["@searchlint/cli", "@searchlint/core"],
      registry: {
        type: "ephemeral-local-npm-compatible-http-registry",
        metadataRequests: requestedPackageNames,
        tarballFetchCount: requestedTarballs.length
      },
      commands: results,
      limitations: [
        "Uses an ephemeral local npm-compatible registry, not the public npm registry.",
        "Does not prove npm trusted publishing, hosted provenance, beta publication, or final publication.",
        "Does not prove package availability outside this repository checkout."
      ]
    };

    await mkdir(path.dirname(reportPath), { recursive: true });
    await mkdir(path.dirname(samplePath), { recursive: true });
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    await writeFile(samplePath, `${JSON.stringify(report, null, 2)}\n`);
    run("pnpm", [
      "exec",
      "prettier",
      "--write",
      path.relative(repoRoot, reportPath),
      path.relative(repoRoot, samplePath)
    ]);

    console.log(
      `npm-like registry install PASS: ${requestedPackageNames.length} metadata requests, ${requestedTarballs.length} tarballs`
    );
    console.log(`Report: ${path.relative(repoRoot, reportPath)}`);
    console.log(`Sample: ${path.relative(repoRoot, samplePath)}`);
  } finally {
    await closeServer(server);
    await rm(consumerDir, { recursive: true, force: true });
    await rm(packDir, { recursive: true, force: true });
  }
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
