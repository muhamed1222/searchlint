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
  "reports/next-generated-images-report.json"
);
const samplePath = path.join(
  repoRoot,
  "docs/examples/next-generated-images-report.sample.json"
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
const routes = ["/opengraph-image", "/twitter-image"];
const searchLintRuntimePattern =
  /@searchlint|searchlint-dev-overlay|__SEARCHLINT_DEV_OVERLAY__|__SEARCHLINT_RULE_CATALOG__|createSearchLintOverlayRuntime|withSearchLint/i;

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    env: { ...process.env, PATH: `${nodeBinDir}:${process.env.PATH}` },
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
    `Next generated image verification must run under Node.js 24, got ${process.version}`
  );

  const workDir = await mkdtemp(
    path.join(tmpdir(), "searchlint-next-generated-images-")
  );
  const report = {
    schemaVersion: 1,
    generatedAt: fixedGeneratedAt,
    nodeVersion: process.version,
    status: "PASS",
    policy: packagePolicy,
    routes: [],
    limitations: [
      "Runtime generated image acceptance covers Next.js 16 App Router, the primary OD-003 development/test target.",
      "CMS/API metadata runtime values are not executed.",
      "Streaming metadata runtime behavior is not covered.",
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
      env: { CI: "1" }
    });
    run("pnpm", ["build"], {
      cwd: enabledDir,
      stdio: "inherit",
      env: { CI: "1" }
    });

    const cleanRuntime = await collectGeneratedImages(cleanDir);
    const enabledRuntime = await collectGeneratedImages(enabledDir);
    for (const route of routes) {
      const clean = cleanRuntime.routes[route];
      const searchlint = enabledRuntime.routes[route];
      assert(clean.status === 200, `${route} clean status must be 200`);
      assert(
        searchlint.status === 200,
        `${route} SearchLint status must be 200`
      );
      assert(
        clean.contentType.startsWith("image/"),
        `${route} clean content type must be image/*`
      );
      assert(
        searchlint.contentType === clean.contentType,
        `${route} content type must remain unchanged`
      );
      assert(
        searchlint.bytes === clean.bytes,
        `${route} byte length must remain unchanged`
      );
      assert(
        searchlint.containsSearchLintRuntime === false,
        `${route} must not contain SearchLint runtime markers`
      );

      report.routes.push({
        route,
        status: "PASS",
        clean,
        searchlint,
        comparison: {
          statusChanged: searchlint.status !== clean.status,
          contentTypeChanged: searchlint.contentType !== clean.contentType,
          bytesChanged: searchlint.bytes !== clean.bytes,
          searchLintRuntimeMarkers: searchlint.containsSearchLintRuntime
        }
      });
    }
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }

  await mkdir(path.dirname(reportPath), { recursive: true });
  await mkdir(path.dirname(samplePath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(samplePath, `${JSON.stringify(report, null, 2)}\n`);
  run("pnpm", ["exec", "prettier", "--write", samplePath]);

  console.log(
    `Next generated images ${report.status}: ${report.routes.length}/${routes.length} routes passed`
  );
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
  await mkdir(path.join(projectDir, "app"), { recursive: true });
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
    `export const metadata = {
  title: "Generated Image Fixture",
  description: "Runtime generated image fixture"
};

export default function Layout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
`
  );
  await writeFile(
    path.join(projectDir, "app", "page.jsx"),
    `export default function Page() {
  return <main><h1>Generated Image Fixture</h1></main>;
}
`
  );
  await writeGeneratedImageFile(
    path.join(projectDir, "app", "opengraph-image.jsx"),
    "Open Graph Runtime Image",
    "#0f172a"
  );
  await writeGeneratedImageFile(
    path.join(projectDir, "app", "twitter-image.jsx"),
    "Twitter Runtime Image",
    "#155e75"
  );
}

async function writeGeneratedImageFile(filePath, label, background) {
  await writeFile(
    filePath,
    `import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const alt = "${label}";
export const size = {
  width: 1200,
  height: 630
};
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "${background}",
          color: "white",
          display: "flex",
          fontSize: 72,
          fontWeight: 700,
          height: "100%",
          justifyContent: "center",
          width: "100%"
        }}
      >
        ${label}
      </div>
    ),
    size
  );
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

async function collectGeneratedImages(projectDir) {
  const port = await getFreePort();
  const server = startProcess(
    "pnpm",
    ["exec", "next", "start", "-p", String(port)],
    {
      cwd: projectDir,
      env: { CI: "1" }
    }
  );
  try {
    await waitForHttp(`http://127.0.0.1:${port}/`, server);
    const routeEvidence = {};
    for (const route of routes) {
      routeEvidence[route] = await fetchImageEvidence(
        `http://127.0.0.1:${port}${route}`
      );
    }
    return { port, routes: routeEvidence };
  } finally {
    await stopProcess(server);
  }
}

async function fetchImageEvidence(url) {
  const response = await fetch(url);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const textProbe = Buffer.from(bytes).toString("latin1");
  return {
    status: response.status,
    contentType: response.headers.get("content-type") ?? "",
    bytes: bytes.byteLength,
    containsSearchLintRuntime: searchLintRuntimePattern.test(textProbe)
  };
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
