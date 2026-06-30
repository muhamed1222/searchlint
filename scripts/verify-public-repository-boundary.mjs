#!/usr/bin/env node
import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();
const manifestPath = "specs/PUBLIC_REPOSITORY_EXPORT_MANIFEST.json";
const reportPath = "reports/public-repository-boundary-report.json";
const samplePath =
  "docs/examples/public-repository-boundary-report.sample.json";

const sourceExtensions = new Set([
  ".cjs",
  ".cts",
  ".js",
  ".jsx",
  ".mjs",
  ".mts",
  ".ts",
  ".tsx"
]);

async function main() {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const issues = [];

  validateManifestShape(manifest, issues);
  const includePathResults = validateIncludePaths(manifest, issues);
  const packageResults = await validatePublicPackages(manifest, issues);
  const importResults = await validatePublicImports(manifest, issues);
  const sensitivityResults = validateSensitiveGeneratedExclusions(
    manifest,
    issues
  );

  const report = {
    generatedBy: "searchlint-public-repository-boundary-verifier",
    generatedAt: "2026-06-23T00:00:00.000Z",
    status: issues.length === 0 ? "PASS" : "FAIL",
    scope: {
      proofType: "static public repository candidate boundary verification",
      manifest: manifestPath,
      decision: manifest.decision,
      adr: manifest.adr,
      doesNotClaim: [
        "actual repository split completed",
        "legal approval completed",
        "public repository created",
        "private code removed from monorepo",
        "npm or VS Code publication"
      ]
    },
    summary: {
      publicIncludePathCount: manifest.publicIncludePaths.length,
      publicPackageCount: manifest.publicPackagePaths.length,
      privateExcludePathCount: manifest.privateExcludePaths.length,
      generatedExcludePathCount: manifest.generatedExcludePaths.length,
      sensitiveExcludeGlobCount: manifest.sensitiveExcludeGlobs.length,
      publicSourceFilesScanned: importResults.sourceFilesScanned,
      issueCount: issues.length
    },
    includePaths: includePathResults,
    packages: packageResults,
    imports: importResults,
    sensitiveGenerated: sensitivityResults,
    issues,
    remainingReleaseGates: [
      "Create the actual public repository candidate tree.",
      "Run public candidate install/build/lint/typecheck/test/release checks inside that tree.",
      "Complete legal review of LICENSE, NOTICE, CONTRIBUTING, SECURITY, trademark policy, package metadata, and repository boundary.",
      "Move closed dashboard/API/workers/infra operations into the private cloud repository."
    ]
  };

  assertNoSensitiveValues(JSON.stringify(report));
  await mkdir(path.dirname(reportPath), { recursive: true });
  await mkdir(path.dirname(samplePath), { recursive: true });
  await writeJson(reportPath, report);
  await writeJson(samplePath, report);

  if (issues.length > 0) {
    for (const issue of issues) {
      console.error(`${issue.code}: ${issue.message}`);
    }
    throw new Error(
      `Public repository boundary verification failed with ${issues.length} issue(s).`
    );
  }

  console.log(
    `Public repository boundary PASS: ${manifest.publicIncludePaths.length} include path(s), ${manifest.publicPackagePaths.length} public package path(s), ${importResults.sourceFilesScanned} source file(s) scanned`
  );
  console.log(`Report: ${reportPath}`);
  console.log(`Sample: ${samplePath}`);
}

function validateManifestShape(manifest, issues) {
  for (const field of [
    "publicIncludePaths",
    "publicPackagePaths",
    "privatePackageNames",
    "privateExcludePaths",
    "generatedExcludePaths",
    "sensitiveExcludeGlobs"
  ]) {
    if (!Array.isArray(manifest[field]) || manifest[field].length === 0) {
      addIssue(issues, "MANIFEST_FIELD", `${field} must be a non-empty array.`);
    }
  }
}

function validateIncludePaths(manifest, issues) {
  const includePaths = manifest.publicIncludePaths.map(normalizePath);
  const privatePaths = manifest.privateExcludePaths.map(normalizePath);
  const generatedPaths = manifest.generatedExcludePaths.map(normalizePath);
  const forbiddenOverlaps = [];

  for (const includePath of includePaths) {
    for (const privatePath of privatePaths) {
      if (sameOrChild(includePath, privatePath)) {
        forbiddenOverlaps.push({ includePath, forbiddenPath: privatePath });
      }
    }
    for (const generatedPath of generatedPaths) {
      if (sameOrChild(includePath, generatedPath)) {
        forbiddenOverlaps.push({ includePath, forbiddenPath: generatedPath });
      }
    }
  }

  for (const overlap of forbiddenOverlaps) {
    addIssue(
      issues,
      "PUBLIC_INCLUDE_FORBIDDEN_PATH",
      `${overlap.includePath} overlaps forbidden path ${overlap.forbiddenPath}.`
    );
  }

  return {
    status: forbiddenOverlaps.length === 0 ? "pass" : "fail",
    checked: includePaths.length,
    forbiddenOverlaps
  };
}

async function validatePublicPackages(manifest, issues) {
  const privatePackageNames = new Set(manifest.privatePackageNames);
  const packageReports = [];

  for (const packagePath of manifest.publicPackagePaths.map(normalizePath)) {
    const manifestFile = path.join(repoRoot, packagePath, "package.json");
    const packageJson = JSON.parse(await readFile(manifestFile, "utf8"));
    const dependencies = dependencyEntries(packageJson);
    const privateDependencies = dependencies.filter((dependency) =>
      privatePackageNames.has(dependency.name)
    );
    const privateFileTargets = [
      ...flattenStringTargets(packageJson.files ?? [], "files"),
      ...flattenExportTargets(packageJson.exports, "exports"),
      ...flattenStringTargets(Object.values(packageJson.bin ?? {}), "bin")
    ].filter((entry) => referencesPrivatePath(entry.target, manifest));

    for (const dependency of privateDependencies) {
      addIssue(
        issues,
        "PUBLIC_PACKAGE_PRIVATE_DEPENDENCY",
        `${packagePath} depends on private package ${dependency.name} through ${dependency.field}.`
      );
    }

    for (const target of privateFileTargets) {
      addIssue(
        issues,
        "PUBLIC_PACKAGE_PRIVATE_TARGET",
        `${packagePath} ${target.field} references private path ${target.target}.`
      );
    }

    packageReports.push({
      path: packagePath,
      name: packageJson.name,
      private: packageJson.private === true,
      dependencyCount: dependencies.length,
      privateDependencyCount: privateDependencies.length,
      privateFileTargetCount: privateFileTargets.length,
      status:
        privateDependencies.length === 0 && privateFileTargets.length === 0
          ? "pass"
          : "fail"
    });
  }

  return packageReports;
}

async function validatePublicImports(manifest, issues) {
  const files = [];
  for (const packagePath of manifest.publicPackagePaths.map(normalizePath)) {
    await collectSourceFiles(packagePath, files);
  }

  const privatePackagePattern = new RegExp(
    `(?:${manifest.privatePackageNames.map(escapeRegExp).join("|")})(?:[/\"'])`,
    "u"
  );
  const privatePathPattern =
    /(?:\.\.\/)+(?:apps\/dashboard|services\/api|services\/workers|infra)(?:\/|["'])/u;
  const matches = [];

  for (const file of files) {
    const text = await readFile(path.join(repoRoot, file), "utf8");
    if (privatePackagePattern.test(text) || privatePathPattern.test(text)) {
      matches.push(file);
      addIssue(
        issues,
        "PUBLIC_SOURCE_PRIVATE_IMPORT",
        `${file} references a private cloud package or implementation path.`
      );
    }
  }

  return {
    status: matches.length === 0 ? "pass" : "fail",
    sourceFilesScanned: files.length,
    privateReferenceFiles: matches
  };
}

function validateSensitiveGeneratedExclusions(manifest, issues) {
  const includePaths = manifest.publicIncludePaths.map(normalizePath);
  const sensitiveMatches = [];

  for (const includePath of includePaths) {
    if (isSensitivePath(includePath, manifest.sensitiveExcludeGlobs)) {
      sensitiveMatches.push(includePath);
      addIssue(
        issues,
        "PUBLIC_INCLUDE_SENSITIVE_PATH",
        `${includePath} matches sensitive path exclusion policy.`
      );
    }
  }

  return {
    status: sensitiveMatches.length === 0 ? "pass" : "fail",
    sensitiveMatches,
    generatedExcludePaths: manifest.generatedExcludePaths,
    sensitiveExcludeGlobs: manifest.sensitiveExcludeGlobs
  };
}

async function collectSourceFiles(relativeDirectory, files) {
  const absoluteDirectory = path.join(repoRoot, relativeDirectory);
  const entries = await readdir(absoluteDirectory, { withFileTypes: true });
  for (const entry of entries) {
    const relativeEntry = normalizePath(
      path.join(relativeDirectory, entry.name)
    );
    if (entry.isDirectory()) {
      if (["dist", "node_modules", "coverage"].includes(entry.name)) {
        continue;
      }
      await collectSourceFiles(relativeEntry, files);
      continue;
    }
    if (sourceExtensions.has(path.extname(entry.name))) {
      files.push(relativeEntry);
    }
  }
}

function dependencyEntries(manifest) {
  return [
    ["dependencies", manifest.dependencies],
    ["peerDependencies", manifest.peerDependencies],
    ["optionalDependencies", manifest.optionalDependencies],
    ["devDependencies", manifest.devDependencies]
  ].flatMap(([field, dependencies]) =>
    Object.entries(dependencies ?? {}).map(([name, range]) => ({
      field,
      name,
      range: String(range)
    }))
  );
}

function flattenExportTargets(value, field) {
  if (typeof value === "string") {
    return [{ field, target: value }];
  }
  if (Array.isArray(value)) {
    return value.flatMap((entry) => flattenExportTargets(entry, field));
  }
  if (value && typeof value === "object") {
    return Object.values(value).flatMap((entry) =>
      flattenExportTargets(entry, field)
    );
  }
  return [];
}

function flattenStringTargets(values, field) {
  return values
    .filter((value) => typeof value === "string")
    .map((target) => ({ field, target }));
}

function referencesPrivatePath(target, manifest) {
  const normalizedTarget = normalizePath(String(target).replace(/^\.\//u, ""));
  return manifest.privateExcludePaths
    .map(normalizePath)
    .some((privatePath) => sameOrChild(normalizedTarget, privatePath));
}

function isSensitivePath(value, globs) {
  return globs.some((glob) => {
    if (glob === ".env") {
      return value === ".env" || value.endsWith("/.env");
    }
    if (glob === ".env.*") {
      return /(^|\/)\.env\.[^/]+$/u.test(value);
    }
    if (glob.startsWith("*.")) {
      return value.endsWith(glob.slice(1));
    }
    return value === glob || value.endsWith(`/${glob}`);
  });
}

function sameOrChild(value, parent) {
  return value === parent || value.startsWith(`${parent}/`);
}

function normalizePath(value) {
  return value.split(path.sep).join("/");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function addIssue(issues, code, message) {
  issues.push({ code, message });
}

function assertNoSensitiveValues(text) {
  const forbidden = [
    /private_key/i,
    /client-secret/i,
    /authorization:/i,
    /bearer\s+/i,
    /sk_live_[A-Za-z0-9_]{8,}/i,
    /whsec_[A-Za-z0-9_]{8,}/i,
    /postgres:\/\/(?!\[REDACTED\])[A-Za-z0-9._%+-]+:[^@${\s"'`]+@/i,
    /-----BEGIN PRIVATE KEY-----/i,
    /ya29\.[A-Za-z0-9._-]{8,}/i,
    /xox[baprs]-[A-Za-z0-9-]{8,}/i
  ];
  const match = forbidden.find((pattern) => pattern.test(text));
  if (match) {
    throw new Error(
      `Sensitive value leaked into public repository boundary report: ${match}`
    );
  }
}

async function writeJson(filePath, data) {
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
