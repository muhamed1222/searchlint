#!/usr/bin/env node
import { execFileSync, spawn } from "node:child_process";
import {
  cp,
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
const nodeBinDir = path.dirname(process.execPath);
const reportPath = path.join(
  repoRoot,
  "reports/next-cms-api-metadata-report.json"
);
const samplePath = path.join(
  repoRoot,
  "docs/examples/next-cms-api-metadata-report.sample.json"
);
const catalogPath = path.join(repoRoot, "specs/RULE_CATALOG.yaml");
const fixedGeneratedAt = "2026-06-23T00:00:00.000Z";
const packagePolicy = {
  pnpm: "11.8.0",
  next: "16.2.9",
  react: "19.2.7",
  reactDom: "19.2.7"
};
const publicPackageDirs = [
  "packages/browser",
  "packages/core",
  "packages/html",
  "packages/next",
  "packages/overlay"
];
const routePath = "/cms-api/api-product";
const expectedTitle = "CMS API Product api-product";
const expectedDescription = "CMS API metadata description for api-product";
const cmsApiPath = "/products/api-product";
const searchLintRuntimePattern =
  /@searchlint|searchlint-dev-overlay|__SEARCHLINT_DEV_OVERLAY__|__SEARCHLINT_RULE_CATALOG__|createSearchLintOverlayRuntime|withSearchLint/i;

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    env: {
      ...process.env,
      PATH: `${nodeBinDir}:${process.env.PATH}`,
      ...options.env
    },
    encoding: "utf8",
    stdio: options.stdio ?? "pipe"
  });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  assert(
    process.versions.node.split(".")[0] === "24",
    `Next CMS/API metadata verification must run under Node.js 24, got ${process.version}`
  );

  const workDir = await mkdtemp(
    path.join(tmpdir(), "searchlint-next-cms-api-metadata-")
  );
  const report = {
    schemaVersion: 1,
    generatedAt: fixedGeneratedAt,
    nodeVersion: process.version,
    status: "PASS",
    policy: packagePolicy,
    route: routePath,
    cmsApi: undefined,
    clean: undefined,
    searchlint: undefined,
    comparison: undefined,
    limitations: [
      "CMS/API metadata runtime acceptance covers a verifier-owned deterministic HTTP API, not a real external CMS vendor.",
      "Runtime CMS/API metadata acceptance covers Next.js 16 App Router, the primary OD-003 development/test target.",
      "Dynamic redirect/rewrite config execution is not covered.",
      "Middleware runtime behavior is not covered."
    ]
  };

  const cmsApi = await startCmsApi();
  try {
    const packDir = path.join(workDir, "tarballs");
    await mkdir(packDir, { recursive: true });
    run("pnpm", ["build"], { stdio: "inherit" });
    const packages = await packPublicPackages(packDir);
    const cleanDir = path.join(workDir, "clean");
    const enabledDir = path.join(workDir, "searchlint");
    await writeFixtureProject(cleanDir, packages, false);
    await writeFixtureProject(enabledDir, packages, true);
    await installFixture(cleanDir);
    await installFixture(enabledDir);
    await assertNoWorkspaceInstall(enabledDir);
    run("pnpm", ["build"], {
      cwd: cleanDir,
      stdio: "inherit",
      env: { CI: "1", CMS_API_URL: cmsApi.baseUrl }
    });
    run("pnpm", ["build"], {
      cwd: enabledDir,
      stdio: "inherit",
      env: { CI: "1", CMS_API_URL: cmsApi.baseUrl }
    });

    const clean = await collectMetadataResponse(cleanDir, cmsApi.baseUrl);
    const searchlint = await collectMetadataResponse(
      enabledDir,
      cmsApi.baseUrl
    );
    const requestCount = cmsApi.getRequestCount();
    assert(clean.status === 200, "clean route status must be 200");
    assert(searchlint.status === 200, "SearchLint route status must be 200");
    assert(
      clean.contentType.includes("text/html"),
      "clean response must be HTML"
    );
    assert(
      searchlint.contentType === clean.contentType,
      "SearchLint response content type must match clean response"
    );
    assert(
      clean.title === expectedTitle,
      "clean title must resolve CMS/API metadata"
    );
    assert(
      clean.description === expectedDescription,
      "clean description must resolve CMS/API metadata"
    );
    assert(
      searchlint.title === clean.title,
      "SearchLint title must match clean"
    );
    assert(
      searchlint.description === clean.description,
      "SearchLint description must match clean"
    );
    assert(
      searchlint.containsSearchLintRuntime === false,
      "SearchLint response must not contain runtime markers"
    );
    assert(
      requestCount >= 2,
      "CMS/API endpoint must be requested by clean and SearchLint apps"
    );

    report.cmsApi = {
      endpointPath: cmsApiPath,
      requestCount,
      payloadTitle: expectedTitle,
      payloadDescription: expectedDescription
    };
    report.clean = clean;
    report.searchlint = searchlint;
    report.comparison = {
      statusChanged: searchlint.status !== clean.status,
      contentTypeChanged: searchlint.contentType !== clean.contentType,
      titleChanged: searchlint.title !== clean.title,
      descriptionChanged: searchlint.description !== clean.description,
      searchLintRuntimeMarkers: searchlint.containsSearchLintRuntime
    };
  } finally {
    await cmsApi.stop();
    await rm(workDir, { recursive: true, force: true });
  }

  await mkdir(path.dirname(reportPath), { recursive: true });
  await mkdir(path.dirname(samplePath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(samplePath, `${JSON.stringify(report, null, 2)}\n`);
  run("pnpm", ["exec", "prettier", "--write", samplePath]);

  console.log(`Next CMS/API metadata ${report.status}: ${routePath}`);
  console.log(`Report: ${path.relative(repoRoot, reportPath)}`);
  console.log(`Sample: ${path.relative(repoRoot, samplePath)}`);
}

async function packPublicPackages(packDir) {
  const packages = new Map();
  for (const packageDir of publicPackageDirs) {
    const manifest = JSON.parse(
      await readFile(path.join(repoRoot, packageDir, "package.json"), "utf8")
    );
    const before = new Set(await readdir(packDir));
    run("pnpm", ["--dir", packageDir, "pack", "--pack-destination", packDir]);
    const after = await readdir(packDir);
    const created = after.find((entry) => !before.has(entry));
    assert(created, `pnpm pack did not create a tarball for ${manifest.name}`);
    packages.set(manifest.name, path.join(packDir, created));
  }
  return packages;
}

async function writeFixtureProject(projectDir, packages, searchlint) {
  await mkdir(path.join(projectDir, "app", "cms-api", "[slug]"), {
    recursive: true
  });
  await writeJson(path.join(projectDir, "package.json"), {
    private: true,
    type: "module",
    scripts: {
      build: "next build",
      start: "next start"
    },
    dependencies: {
      next: packagePolicy.next,
      react: packagePolicy.react,
      "react-dom": packagePolicy.reactDom,
      ...(searchlint
        ? { "@searchlint/next": `file:${packages.get("@searchlint/next")}` }
        : {})
    }
  });

  if (searchlint) {
    await writeFile(
      path.join(projectDir, "pnpm-workspace.yaml"),
      `overrides:
${[...packages.entries()]
  .map(([name, tarball]) => `  "${name}": "file:${tarball}"`)
  .join("\n")}
`
    );
    await mkdir(path.join(projectDir, "searchlint"), { recursive: true });
    await cp(
      catalogPath,
      path.join(projectDir, "searchlint", "RULE_CATALOG.yaml")
    );
    await writeFile(
      path.join(projectDir, "next.config.mjs"),
      `import { readFileSync } from "node:fs";
import { withSearchLint } from "@searchlint/next";

export default withSearchLint({}, {
  catalogText: readFileSync("./searchlint/RULE_CATALOG.yaml", "utf8")
});
`
    );
  } else {
    await writeFile(
      path.join(projectDir, "next.config.mjs"),
      "export default {};\n"
    );
  }

  await writeFile(
    path.join(projectDir, "app", "layout.jsx"),
    `export default function Layout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
`
  );
  await writeFile(
    path.join(projectDir, "app", "cms-api", "[slug]", "page.jsx"),
    `export const dynamic = "force-dynamic";

async function loadMetadata(slug) {
  const response = await fetch(\`\${process.env.CMS_API_URL}/products/\${slug}\`, {
    cache: "no-store"
  });
  if (!response.ok) {
    throw new Error(\`CMS API failed with HTTP \${response.status}\`);
  }
  return response.json();
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const metadata = await loadMetadata(slug);
  return {
    title: metadata.title,
    description: metadata.description
  };
}

export default async function ProductPage({ params }) {
  const { slug } = await params;
  return <main><h1>CMS/API metadata {slug}</h1></main>;
}
`
  );
}

async function installFixture(projectDir) {
  run(
    "pnpm",
    ["install", "--no-frozen-lockfile", "--dangerously-allow-all-builds"],
    {
      cwd: projectDir,
      stdio: "inherit",
      env: { CI: "1" }
    }
  );
}

async function assertNoWorkspaceInstall(projectDir) {
  const lockfile = await readFile(
    path.join(projectDir, "pnpm-lock.yaml"),
    "utf8"
  );
  assert(
    !lockfile.includes("workspace:"),
    `${projectDir} lockfile must not contain workspace dependencies`
  );
  assert(
    !lockfile.includes(repoRoot),
    `${projectDir} lockfile must not reference the monorepo root`
  );
}

async function collectMetadataResponse(projectDir, cmsApiUrl) {
  const port = await getFreePort();
  const server = startProcess(
    "pnpm",
    ["exec", "next", "start", "-p", String(port)],
    {
      cwd: projectDir,
      env: { CI: "1", CMS_API_URL: cmsApiUrl }
    }
  );
  try {
    await waitForHttp(`http://127.0.0.1:${port}${routePath}`, server);
    const response = await fetch(`http://127.0.0.1:${port}${routePath}`, {
      headers: {
        "user-agent": "Mozilla/5.0 SearchLintCmsApiMetadataRuntimeAcceptance"
      }
    });
    const html = await response.text();
    return {
      status: response.status,
      contentType: response.headers.get("content-type") ?? "",
      title: extractTitle(html),
      description: extractDescription(html),
      bytes: Buffer.byteLength(html),
      containsSearchLintRuntime: searchLintRuntimePattern.test(html)
    };
  } finally {
    await stopProcess(server);
  }
}

async function startCmsApi() {
  const port = await getFreePort();
  let requestCount = 0;
  const server = http.createServer((request, response) => {
    if (request.url === cmsApiPath) {
      requestCount += 1;
      response.writeHead(200, {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store"
      });
      response.end(
        JSON.stringify({
          title: expectedTitle,
          description: expectedDescription
        })
      );
      return;
    }
    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "not_found" }));
  });
  await new Promise((resolve, reject) => {
    server.listen(port, "127.0.0.1", resolve);
    server.on("error", reject);
  });
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    getRequestCount: () => requestCount,
    stop: () =>
      new Promise((resolve) => {
        server.close(() => resolve());
      })
  };
}

function extractTitle(html) {
  return decodeHtml(html.match(/<title>(.*?)<\/title>/i)?.[1] ?? "");
}

function extractDescription(html) {
  const match = html.match(
    /<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i
  );
  return decodeHtml(match?.[1] ?? "");
}

function decodeHtml(value) {
  return value
    .replaceAll("&quot;", '"')
    .replaceAll("&#x27;", "'")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function startProcess(command, args, options) {
  const child = spawn(command, args, {
    cwd: options.cwd,
    env: {
      ...process.env,
      PATH: `${nodeBinDir}:${process.env.PATH}`,
      ...options.env
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  child.stdout.on("data", () => undefined);
  child.stderr.on("data", () => undefined);
  return child;
}

async function stopProcess(child) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }
  child.kill("SIGTERM");
  await new Promise((resolve) => {
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      resolve();
    }, 5_000);
    child.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

async function waitForHttp(url, process) {
  const deadline = Date.now() + 90_000;
  let lastError;
  while (Date.now() < deadline) {
    if (process.exitCode !== null) {
      throw new Error(`server exited before ${url} became ready`);
    }
    try {
      await new Promise((resolve, reject) => {
        const request = http.get(url, (response) => {
          response.resume();
          response.on("end", () =>
            response.statusCode && response.statusCode < 500
              ? resolve()
              : reject(new Error(`HTTP ${response.statusCode}`))
          );
        });
        request.on("error", reject);
        request.setTimeout(2_000, () => request.destroy(new Error("timeout")));
      });
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  throw lastError ?? new Error(`timed out waiting for ${url}`);
}

async function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = http.createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() =>
        typeof address === "object" && address
          ? resolve(address.port)
          : reject(new Error("no port"))
      );
    });
    server.on("error", reject);
  });
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
