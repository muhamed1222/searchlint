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
  "reports/next-dynamic-routes-runtime-report.json"
);
const samplePath = path.join(
  repoRoot,
  "docs/examples/next-dynamic-routes-runtime-report.sample.json"
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
const routeSuffix = "dynamic";
const redirectSource = `/legacy-${routeSuffix}`;
const redirectTarget = `/modern-${routeSuffix}`;
const rewriteSource = `/rewrite-${routeSuffix}`;
const rewriteTarget = `/rewritten-${routeSuffix}`;
const expectedRedirectHeading = "Modern dynamic route";
const expectedRewriteHeading = "Rewritten dynamic route";
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
    `Next dynamic routes runtime verification must run under Node.js 24, got ${process.version}`
  );

  const workDir = await mkdtemp(
    path.join(tmpdir(), "searchlint-next-dynamic-routes-runtime-")
  );
  const report = {
    schemaVersion: 1,
    generatedAt: fixedGeneratedAt,
    nodeVersion: process.version,
    status: "PASS",
    policy: packagePolicy,
    routeConfig: {
      routeSuffix,
      redirectSource,
      redirectTarget,
      rewriteSource,
      rewriteTarget
    },
    clean: undefined,
    searchlint: undefined,
    comparison: undefined,
    limitations: [
      "Dynamic redirect/rewrite runtime acceptance covers Next.js 16 App Router, the primary OD-003 development/test target.",
      "The verifier proves production runtime behavior; the source analyzer still does not execute arbitrary user config code.",
      "Middleware runtime behavior is not covered."
    ]
  };

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
      env: { CI: "1", NEXT_DYNAMIC_ROUTE_SUFFIX: routeSuffix }
    });
    run("pnpm", ["build"], {
      cwd: enabledDir,
      stdio: "inherit",
      env: { CI: "1", NEXT_DYNAMIC_ROUTE_SUFFIX: routeSuffix }
    });

    const clean = await collectRuntimeEvidence(cleanDir);
    const searchlint = await collectRuntimeEvidence(enabledDir);
    assert(
      clean.redirect.status === searchlint.redirect.status,
      "redirect status must match"
    );
    assert(
      clean.redirect.location === searchlint.redirect.location,
      "redirect location must match"
    );
    assert(
      clean.redirect.location === redirectTarget,
      "redirect location must use dynamic target"
    );
    assert(
      clean.redirectTarget.heading === expectedRedirectHeading,
      "redirect target must render expected page"
    );
    assert(
      searchlint.redirectTarget.heading === clean.redirectTarget.heading,
      "SearchLint redirect target heading must match clean"
    );
    assert(
      clean.rewrite.status === 200 && searchlint.rewrite.status === 200,
      "rewrite route must return HTTP 200"
    );
    assert(
      clean.rewrite.heading === expectedRewriteHeading,
      "rewrite source must render rewritten target page"
    );
    assert(
      searchlint.rewrite.heading === clean.rewrite.heading,
      "SearchLint rewrite heading must match clean"
    );
    assert(
      searchlint.redirectTarget.containsSearchLintRuntime === false,
      "SearchLint redirect target must not contain runtime markers"
    );
    assert(
      searchlint.rewrite.containsSearchLintRuntime === false,
      "SearchLint rewrite response must not contain runtime markers"
    );

    report.clean = clean;
    report.searchlint = searchlint;
    report.comparison = {
      redirectStatusChanged:
        searchlint.redirect.status !== clean.redirect.status,
      redirectLocationChanged:
        searchlint.redirect.location !== clean.redirect.location,
      redirectTargetHeadingChanged:
        searchlint.redirectTarget.heading !== clean.redirectTarget.heading,
      rewriteStatusChanged: searchlint.rewrite.status !== clean.rewrite.status,
      rewriteHeadingChanged:
        searchlint.rewrite.heading !== clean.rewrite.heading,
      searchLintRuntimeMarkers:
        searchlint.redirectTarget.containsSearchLintRuntime ||
        searchlint.rewrite.containsSearchLintRuntime
    };
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }

  await mkdir(path.dirname(reportPath), { recursive: true });
  await mkdir(path.dirname(samplePath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(samplePath, `${JSON.stringify(report, null, 2)}\n`);
  run("pnpm", ["exec", "prettier", "--write", samplePath]);

  console.log(`Next dynamic routes runtime ${report.status}`);
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
  await mkdir(path.join(projectDir, "app", "modern-dynamic"), {
    recursive: true
  });
  await mkdir(path.join(projectDir, "app", "rewritten-dynamic"), {
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

function buildRoute(name) {
  return \`/\${name}-\${process.env.NEXT_DYNAMIC_ROUTE_SUFFIX ?? "dynamic"}\`;
}

const config = {
  async redirects() {
    return [{
      source: buildRoute("legacy"),
      destination: buildRoute("modern"),
      permanent: false
    }];
  },
  async rewrites() {
    return [{
      source: buildRoute("rewrite"),
      destination: buildRoute("rewritten")
    }];
  }
};

export default withSearchLint(config, {
  catalogText: readFileSync("./searchlint/RULE_CATALOG.yaml", "utf8")
});
`
    );
  } else {
    await writeFile(
      path.join(projectDir, "next.config.mjs"),
      `function buildRoute(name) {
  return \`/\${name}-\${process.env.NEXT_DYNAMIC_ROUTE_SUFFIX ?? "dynamic"}\`;
}

export default {
  async redirects() {
    return [{
      source: buildRoute("legacy"),
      destination: buildRoute("modern"),
      permanent: false
    }];
  },
  async rewrites() {
    return [{
      source: buildRoute("rewrite"),
      destination: buildRoute("rewritten")
    }];
  }
};
`
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
    path.join(projectDir, "app", "modern-dynamic", "page.jsx"),
    `export default function ModernDynamicPage() {
  return <main><h1>${expectedRedirectHeading}</h1></main>;
}
`
  );
  await writeFile(
    path.join(projectDir, "app", "rewritten-dynamic", "page.jsx"),
    `export default function RewrittenDynamicPage() {
  return <main><h1>${expectedRewriteHeading}</h1></main>;
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

async function collectRuntimeEvidence(projectDir) {
  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const server = startProcess(
    "pnpm",
    ["exec", "next", "start", "-p", String(port)],
    {
      cwd: projectDir,
      env: { CI: "1", NEXT_DYNAMIC_ROUTE_SUFFIX: routeSuffix }
    }
  );
  try {
    await waitForHttp(`${baseUrl}${redirectTarget}`, server);
    const redirect = await fetchRedirect(`${baseUrl}${redirectSource}`);
    const redirectTargetResponse = await fetchHtml(
      `${baseUrl}${redirectTarget}`
    );
    const rewrite = await fetchHtml(`${baseUrl}${rewriteSource}`);
    return {
      redirect,
      redirectTarget: redirectTargetResponse,
      rewrite
    };
  } finally {
    await stopProcess(server);
  }
}

async function fetchRedirect(url) {
  const response = await fetch(url, { redirect: "manual" });
  return {
    status: response.status,
    location: normalizeLocation(response.headers.get("location") ?? "")
  };
}

async function fetchHtml(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 SearchLintDynamicRoutesRuntimeAcceptance"
    }
  });
  const html = await response.text();
  return {
    status: response.status,
    contentType: response.headers.get("content-type") ?? "",
    heading: extractHeading(html),
    bytes: Buffer.byteLength(html),
    containsSearchLintRuntime: searchLintRuntimePattern.test(html)
  };
}

function normalizeLocation(location) {
  try {
    return new URL(location).pathname;
  } catch {
    return location;
  }
}

function extractHeading(html) {
  return decodeHtml(html.match(/<h1>(.*?)<\/h1>/i)?.[1] ?? "");
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
