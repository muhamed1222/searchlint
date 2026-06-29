#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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

const privatePackages = ["apps/dashboard", "services/api", "services/workers"];
const publicPackageNames = new Set();
const privatePackageNames = new Set();

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    env: { ...process.env, ...options.env },
    encoding: "utf8",
    stdio: options.stdio ?? "pipe"
  });
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function formatJson(value) {
  const prettier = await import("prettier");
  return prettier.format(JSON.stringify(value), { parser: "json" });
}

function addIssue(issues, field, message, severity = "error") {
  issues.push({ field, severity, message });
}

function flattenExportEntries(exportsValue, exportPath = ".") {
  if (typeof exportsValue === "string") {
    return [
      {
        exportPath,
        condition: "default",
        target: exportsValue
      }
    ];
  }

  if (exportsValue && typeof exportsValue === "object") {
    return Object.entries(exportsValue).flatMap(([key, value]) => {
      const nextExportPath = key.startsWith(".") ? key : exportPath;
      const condition = key.startsWith(".") ? "default" : key;

      if (typeof value === "string") {
        return [{ exportPath: nextExportPath, condition, target: value }];
      }

      return flattenExportEntries(value, nextExportPath).map((entry) => ({
        ...entry,
        condition: entry.condition === "default" ? condition : entry.condition
      }));
    });
  }

  return [];
}

function dependencyEntries(manifest) {
  return [
    ["dependencies", manifest.dependencies],
    ["peerDependencies", manifest.peerDependencies],
    ["optionalDependencies", manifest.optionalDependencies]
  ].flatMap(([field, dependencies]) =>
    Object.entries(dependencies ?? {}).map(([name, range]) => ({
      field,
      name,
      range: String(range)
    }))
  );
}

function expectedPackageFiles(manifest) {
  const expectedFiles = ["dist/src", "package.json"];
  if (manifest.name === "@searchlint/next") {
    expectedFiles.push("RULE_CATALOG.yaml");
  }
  return expectedFiles;
}

function validateFilesContract(manifest, issues) {
  const expectedFiles = expectedPackageFiles(manifest);

  if (!Array.isArray(manifest.files)) {
    addIssue(issues, "files", "files must be an explicit allowlist");
    return {
      status: "fail",
      expected: expectedFiles,
      actual: manifest.files ?? null
    };
  }

  for (const expected of expectedFiles) {
    if (!manifest.files.includes(expected)) {
      addIssue(issues, "files", `files must include ${expected}`);
    }
  }

  const unexpected = manifest.files.filter(
    (entry) => !expectedFiles.includes(entry)
  );
  if (unexpected.length > 0) {
    addIssue(
      issues,
      "files",
      `files must not include extra entries: ${unexpected.join(", ")}`
    );
  }

  return {
    status: unexpected.length === 0 ? "pass" : "fail",
    expected: expectedFiles,
    actual: manifest.files
  };
}

function validateExportsContract(manifest, issues) {
  const exportEntries = flattenExportEntries(manifest.exports);
  const binEntries = Object.entries(manifest.bin ?? {}).map(
    ([name, target]) => ({
      exportPath: `bin:${name}`,
      condition: "bin",
      target
    })
  );
  const runtimeTargets = [...exportEntries, ...binEntries].filter(
    (entry) => !String(entry.target).endsWith(".d.ts")
  );
  const typeTargets = exportEntries.filter(
    (entry) => entry.condition === "types"
  );
  const topLevelTypesTarget =
    Object.keys(manifest.bin ?? {}).length > 0 &&
    typeof manifest.types === "string"
      ? {
          exportPath: "types",
          condition: "types",
          target: manifest.types
        }
      : undefined;

  if (exportEntries.length === 0 && binEntries.length === 0) {
    addIssue(issues, "exports", "exports or bin is required");
  }

  for (const entry of runtimeTargets) {
    if (!String(entry.target).startsWith("./dist/")) {
      addIssue(
        issues,
        "exports",
        `${entry.exportPath} ${entry.condition} must point to dist`
      );
    }
    if (
      String(entry.target).endsWith(".ts") &&
      !String(entry.target).endsWith(".d.ts")
    ) {
      addIssue(
        issues,
        "exports",
        `${entry.exportPath} ${entry.condition} must not point at runtime TypeScript`
      );
    }
  }

  if (!manifest.exports && !topLevelTypesTarget) {
    addIssue(
      issues,
      "types",
      "public packages must expose declaration targets through exports.types or bin package types"
    );
  }

  for (const entry of [
    ...typeTargets,
    ...(topLevelTypesTarget ? [topLevelTypesTarget] : [])
  ]) {
    if (!String(entry.target).startsWith("./dist/")) {
      addIssue(
        issues,
        "types",
        `${entry.exportPath} types target must point to dist`
      );
    }
    if (!String(entry.target).endsWith(".d.ts")) {
      addIssue(
        issues,
        "types",
        `${entry.exportPath} types target must point to a .d.ts file`
      );
    }
  }

  return {
    status:
      runtimeTargets.every(
        (entry) =>
          String(entry.target).startsWith("./dist/") &&
          (!String(entry.target).endsWith(".ts") ||
            String(entry.target).endsWith(".d.ts"))
      ) &&
      (typeTargets.length > 0 || Boolean(topLevelTypesTarget))
        ? "pass"
        : "fail",
    runtimeTargets,
    typeTargets,
    topLevelTypesTarget
  };
}

function validateDependencyGraph(manifest, issues) {
  const dependencies = dependencyEntries(manifest);
  const privateCrossings = dependencies.filter((dependency) =>
    privatePackageNames.has(dependency.name)
  );
  const unknownSearchLintDependencies = dependencies.filter(
    (dependency) =>
      dependency.name.startsWith("@searchlint/") &&
      !publicPackageNames.has(dependency.name)
  );

  for (const dependency of privateCrossings) {
    addIssue(
      issues,
      "dependencyGraph",
      `${dependency.field}.${dependency.name} crosses into a private cloud package`
    );
  }

  for (const dependency of unknownSearchLintDependencies) {
    addIssue(
      issues,
      "dependencyGraph",
      `${dependency.field}.${dependency.name} is not in the approved public package allowlist`
    );
  }

  return {
    status:
      privateCrossings.length === 0 &&
      unknownSearchLintDependencies.length === 0
        ? "pass"
        : "fail",
    dependencies,
    privateCrossings,
    unknownSearchLintDependencies
  };
}

function validateTreeShakingContract(manifest, exportsCheck, issues) {
  const runtimeTargets = exportsCheck.runtimeTargets.filter(
    (entry) => entry.condition !== "bin"
  );
  const checks = {
    typeModule: manifest.type === "module",
    sideEffectsFalse: manifest.sideEffects === false,
    hasEsmRuntimeExports: runtimeTargets.some(
      (entry) => entry.condition === "import"
    )
  };

  if (!checks.typeModule) {
    addIssue(
      issues,
      "type",
      "public packages must be ESM-only for tree-shaking readiness"
    );
  }

  if (!checks.sideEffectsFalse) {
    addIssue(
      issues,
      "sideEffects",
      "public packages must declare sideEffects false for tree-shaking readiness"
    );
  }

  if (!checks.hasEsmRuntimeExports && !manifest.bin) {
    addIssue(
      issues,
      "exports",
      "public library packages must expose ESM import targets for tree-shaking readiness"
    );
  }

  return {
    status:
      Object.values(checks).every(Boolean) || Boolean(manifest.bin)
        ? checks.typeModule && checks.sideEffectsFalse
          ? "pass"
          : "fail"
        : "fail",
    sideEffects: manifest.sideEffects ?? null,
    type: manifest.type ?? null,
    esmRuntimeTargets: runtimeTargets.filter(
      (entry) => entry.condition === "import"
    ),
    checks
  };
}

function validatePublicManifest(manifest, packageDir) {
  const issues = [];

  if (manifest.private === true) {
    addIssue(
      issues,
      "private",
      "public package candidates must not be private"
    );
  }

  if (!/^1\.0\.0-beta\.\d+$/.test(manifest.version ?? "")) {
    addIssue(
      issues,
      "version",
      "public package candidates must use an explicit 1.0.0 beta version"
    );
  }

  if (manifest.license !== "Apache-2.0") {
    addIssue(
      issues,
      "license",
      "public package candidates must use Apache-2.0"
    );
  }

  if (!manifest.description) {
    addIssue(issues, "description", "description is required");
  }

  const filesCheck = validateFilesContract(manifest, issues);
  const exportsCheck = validateExportsContract(manifest, issues);
  const dependencyGraphCheck = validateDependencyGraph(manifest, issues);
  const treeShakingCheck = validateTreeShakingContract(
    manifest,
    exportsCheck,
    issues
  );

  if (manifest.engines?.node !== ">=24.0.0") {
    addIssue(issues, "engines.node", "node engine must be >=24.0.0");
  }

  if (manifest.engines?.pnpm !== undefined) {
    addIssue(
      issues,
      "engines.pnpm",
      "public npm package engines must not declare package-manager-only pnpm constraints"
    );
  }

  if (!Array.isArray(manifest.keywords) || manifest.keywords.length < 3) {
    addIssue(issues, "keywords", "keywords must describe the public package");
  }

  if (manifest.name?.startsWith("@searchlint/")) {
    if (manifest.publishConfig?.access !== "public") {
      addIssue(
        issues,
        "publishConfig.access",
        "scoped public packages must declare public npm access"
      );
    }
  }

  if (manifest.publishConfig?.provenance !== true) {
    addIssue(
      issues,
      "publishConfig.provenance",
      "npm provenance must be enabled"
    );
  }

  if (!manifest.repository) {
    addIssue(
      issues,
      "repository",
      "repository metadata is pending until the public repository URL is approved",
      "blocker"
    );
  }

  if (!manifest.homepage) {
    addIssue(
      issues,
      "homepage",
      "homepage metadata is pending until the public website URL is approved",
      "blocker"
    );
  }

  if (!manifest.bugs) {
    addIssue(
      issues,
      "bugs",
      "bugs metadata is pending until public issue/security routing is approved",
      "blocker"
    );
  }

  return {
    packageDir,
    name: manifest.name,
    version: manifest.version,
    private: manifest.private === true,
    publishConfig: manifest.publishConfig ?? null,
    technicalReadiness: {
      files: filesCheck,
      exports: {
        status: exportsCheck.status,
        runtimeTargets: exportsCheck.runtimeTargets
      },
      types: {
        status: exportsCheck.typeTargets.length > 0 ? "pass" : "fail",
        typeTargets: exportsCheck.typeTargets
      },
      dependencyGraph: dependencyGraphCheck,
      treeShaking: treeShakingCheck
    },
    metadataIssues: issues
  };
}

function validatePrivateManifest(manifest, packageDir) {
  const issues = [];
  if (manifest.private !== true) {
    addIssue(issues, "private", "private cloud packages must remain private");
  }
  return {
    packageDir,
    name: manifest.name,
    version: manifest.version,
    private: manifest.private === true,
    metadataIssues: issues
  };
}

async function runPackDryRun(packageDir) {
  const dryRunDir = await mkdtemp(
    path.join(tmpdir(), "searchlint-pack-dry-run-")
  );
  try {
    const output = run(
      "pnpm",
      [
        "--dir",
        path.join(repoRoot, packageDir),
        "pack",
        "--dry-run",
        "--pack-destination",
        dryRunDir
      ],
      { stdio: "pipe" }
    );
    await rm(dryRunDir, { recursive: true, force: true });
    return {
      status: "pass",
      output: output
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
    };
  } catch (error) {
    await rm(dryRunDir, { recursive: true, force: true });
    return {
      status: "fail",
      output: String(error.stdout ?? error.message)
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
    };
  }
}

async function main() {
  run("pnpm", ["build"], { stdio: "inherit" });

  for (const packageDir of publicPackages) {
    const manifest = await readJson(
      path.join(repoRoot, packageDir, "package.json")
    );
    publicPackageNames.add(manifest.name);
  }

  for (const packageDir of privatePackages) {
    const manifest = await readJson(
      path.join(repoRoot, packageDir, "package.json")
    );
    privatePackageNames.add(manifest.name);
  }

  const publicResults = [];
  for (const packageDir of publicPackages) {
    const manifest = await readJson(
      path.join(repoRoot, packageDir, "package.json")
    );
    const metadata = validatePublicManifest(manifest, packageDir);
    metadata.packDryRun = await runPackDryRun(packageDir);
    publicResults.push(metadata);
  }

  const privateResults = [];
  for (const packageDir of privatePackages) {
    const manifest = await readJson(
      path.join(repoRoot, packageDir, "package.json")
    );
    privateResults.push(validatePrivateManifest(manifest, packageDir));
  }

  const blockers = publicResults.flatMap((result) =>
    result.metadataIssues
      .filter(
        (issue) => issue.severity === "blocker" || issue.severity === "error"
      )
      .map((issue) => ({
        packageDir: result.packageDir,
        packageName: result.name,
        ...issue
      }))
  );
  const failedDryRuns = publicResults.filter(
    (result) => result.packDryRun.status !== "pass"
  );
  const privateErrors = privateResults.flatMap((result) =>
    result.metadataIssues.map((issue) => ({
      packageDir: result.packageDir,
      packageName: result.name,
      ...issue
    }))
  );

  const report = {
    generatedAt: "2026-06-22T00:00:00.000Z",
    status:
      blockers.length === 0 &&
      failedDryRuns.length === 0 &&
      privateErrors.length === 0
        ? "READY"
        : "BLOCKED",
    publicPackageCount: publicResults.length,
    privatePackageCount: privateResults.length,
    blockers,
    failedDryRuns: failedDryRuns.map((result) => ({
      packageDir: result.packageDir,
      packageName: result.name,
      output: result.packDryRun.output
    })),
    privateErrors,
    publicPackages: publicResults,
    privatePackages: privateResults
  };

  await mkdir(path.join(repoRoot, "reports"), { recursive: true });
  await writeFile(
    path.join(repoRoot, "reports/package-publication-dry-run-report.json"),
    `${JSON.stringify(report, null, 2)}\n`
  );
  await mkdir(path.join(repoRoot, "docs/examples"), { recursive: true });
  await writeFile(
    path.join(
      repoRoot,
      "docs/examples/package-publication-dry-run-report.sample.json"
    ),
    await formatJson(report)
  );

  console.log(
    `package publication dry-run status: ${report.status}; public packages: ${report.publicPackageCount}; blockers: ${report.blockers.length}; failed dry-runs: ${report.failedDryRuns.length}`
  );
  if (report.blockers.length > 0) {
    console.log("publication blockers:");
    for (const blocker of report.blockers) {
      console.log(
        `- ${blocker.packageName} ${blocker.field}: ${blocker.message}`
      );
    }
  }

  if (failedDryRuns.length > 0 || privateErrors.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
