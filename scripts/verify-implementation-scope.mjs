import { readdir } from "node:fs/promises";
import { extname, join, relative } from "node:path";

const roots = ["packages", "apps", "services"];
const approvedImplementationRoots = new Set([
  "packages/browser/src",
  "packages/browser/test",
  "packages/cli/src",
  "packages/cli/test",
  "packages/core/src",
  "packages/core/test",
  "packages/crawler/src",
  "packages/crawler/test",
  "packages/html/src",
  "packages/html/test",
  "packages/http/src",
  "packages/http/test",
  "packages/language/src",
  "packages/language/test",
  "packages/lsp/src",
  "packages/lsp/test",
  "packages/language-server/src",
  "packages/language-server/test",
  "packages/overlay/src",
  "packages/overlay/test",
  "packages/next/src",
  "packages/next/test",
  "packages/reporter-html/src",
  "packages/reporter-html/test",
  "packages/reporter-junit/src",
  "packages/reporter-junit/test",
  "packages/reporter-sarif/src",
  "packages/reporter-sarif/test",
  "packages/source/src",
  "packages/source/test",
  "apps/dashboard/src",
  "apps/dashboard/test",
  "apps/vscode/assets",
  "apps/vscode/e2e",
  "apps/vscode/src",
  "apps/vscode/test",
  "services/api/src",
  "services/api/test",
  "services/workers/src",
  "services/workers/test"
]);
const approvedMetadataFiles = new Set([
  "package.json",
  "tsconfig.json",
  "tsconfig.build.json",
  "language-configuration.json",
  ".gitkeep",
  "README.md",
  "CHANGELOG.md",
  "PRIVACY.md"
]);
const implementationExtensions = new Set([
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".ts",
  ".tsx",
  ".css",
  ".html"
]);

function isApprovedImplementationFile(filePath) {
  return [...approvedImplementationRoots].some(
    (root) => filePath === root || filePath.startsWith(`${root}/`)
  );
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const violations = [];

  for (const entry of entries) {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist") {
        continue;
      }

      violations.push(...(await walk(entryPath)));
      continue;
    }

    const normalizedPath = relative(".", entryPath);
    if (isApprovedImplementationFile(normalizedPath)) {
      continue;
    }

    if (approvedMetadataFiles.has(entry.name)) {
      continue;
    }

    if (implementationExtensions.has(extname(entry.name))) {
      violations.push(normalizedPath);
      continue;
    }

    violations.push(normalizedPath);
  }

  return violations;
}

const violations = [];
for (const root of roots) {
  violations.push(...(await walk(root)));
}

if (violations.length > 0) {
  throw new Error(
    `product implementation exists outside approved ExecPlan scope:\n${violations.join(
      "\n"
    )}`
  );
}

console.log("verified product implementation scope");
