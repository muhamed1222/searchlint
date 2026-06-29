import { readFile } from "node:fs/promises";
import { join } from "node:path";

const workspacePackages = [
  "packages/language",
  "packages/core",
  "packages/browser",
  "packages/http",
  "packages/html",
  "packages/overlay",
  "packages/next",
  "packages/source",
  "packages/crawler",
  "packages/cli",
  "packages/reporter-sarif",
  "packages/reporter-junit",
  "packages/reporter-html",
  "packages/lsp",
  "packages/language-server",
  "apps/dashboard",
  "apps/vscode",
  "services/api",
  "services/workers"
];

const dependencyFields = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies"
];

const forbiddenByPackage = new Map([
  [
    "@searchlint/core",
    [
      "@searchlint/overlay",
      "@searchlint/cli",
      "@searchlint/lsp",
      "@searchlint/crawler"
    ]
  ],
  ["@searchlint/overlay", ["@searchlint/api", "@searchlint/workers"]],
  ["@searchlint/reporter-sarif", ["@searchlint/overlay"]],
  ["@searchlint/reporter-junit", ["@searchlint/overlay"]],
  ["@searchlint/reporter-html", ["@searchlint/overlay"]]
]);

const allowedPublicUnscopedPackages = new Set(["searchlint-language-server"]);

const manifests = [];

for (const packageDir of workspacePackages) {
  const manifestPath = join(packageDir, "package.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  manifests.push({ dir: packageDir, manifest });
}

const names = new Set(manifests.map(({ manifest }) => manifest.name));

for (const { dir, manifest } of manifests) {
  if (!manifest.name) {
    throw new Error(`${dir}/package.json is missing name`);
  }

  if (
    !manifest.private &&
    !manifest.name.startsWith("@searchlint/") &&
    !allowedPublicUnscopedPackages.has(manifest.name)
  ) {
    throw new Error(`${manifest.name} must use the @searchlint scope`);
  }

  const dependencies = new Set();
  for (const field of dependencyFields) {
    for (const dependencyName of Object.keys(manifest[field] ?? {})) {
      dependencies.add(dependencyName);
    }
  }

  const forbidden = forbiddenByPackage.get(manifest.name) ?? [];
  for (const dependencyName of forbidden) {
    if (dependencies.has(dependencyName)) {
      throw new Error(`${manifest.name} must not depend on ${dependencyName}`);
    }
  }

  if (
    manifest.name !== "@searchlint/core" &&
    manifest.searchlint?.ownsRuleEngine === true
  ) {
    throw new Error(`${manifest.name} must not own the rule engine`);
  }

  for (const dependencyName of dependencies) {
    if (
      dependencyName.startsWith("@searchlint/") &&
      !names.has(dependencyName)
    ) {
      throw new Error(
        `${manifest.name} depends on unknown workspace package ${dependencyName}`
      );
    }
  }
}

console.log(`verified ${manifests.length} workspace package boundaries`);
