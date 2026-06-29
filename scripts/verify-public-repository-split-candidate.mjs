#!/usr/bin/env node
import { createHash } from "node:crypto";
import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  writeFile
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { format } from "prettier";

const repoRoot = process.cwd();
const manifestPath = "specs/PUBLIC_REPOSITORY_EXPORT_MANIFEST.json";
const reportPath = "reports/public-repository-split-candidate-report.json";
const samplePath =
  "docs/examples/public-repository-split-candidate-report.sample.json";
const generatedAt = "2026-06-23T00:00:00.000Z";

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const tempRoot = await mkdtemp(
  path.join(os.tmpdir(), "searchlint-public-repository-candidate-")
);
const candidateRoot = path.join(tempRoot, "public-repository");
const issues = [];

try {
  await mkdir(candidateRoot, { recursive: true });
  const copied = await copyCandidateTree(candidateRoot);
  const files = await collectFiles(candidateRoot);
  const forbiddenPathFindings = findForbiddenPaths(files);
  const packageFindings = await validateCandidatePackages(candidateRoot);
  const candidateHash = await hashCandidateTree(candidateRoot, files);

  issues.push(...forbiddenPathFindings, ...packageFindings.issues);

  const report = {
    generatedBy: "searchlint-public-repository-split-candidate-verifier",
    generatedAt,
    status: issues.length === 0 ? "PASS" : "FAIL",
    scope: {
      proofType: "mechanically assembled public repository split candidate",
      manifest: manifestPath,
      decision: manifest.decision,
      adr: manifest.adr,
      doesNotClaim: [
        "public Git repository created",
        "private cloud repository created",
        "legal approval completed",
        "public candidate install/build/test passed",
        "npm or VS Code publication"
      ]
    },
    candidate: {
      root: "<temporary>",
      publicIncludePathCount: manifest.publicIncludePaths.length,
      copiedPathCount: copied.length,
      fileCount: files.length,
      packageCount: packageFindings.packages.length,
      sha256: candidateHash
    },
    copiedPaths: copied,
    forbiddenPathChecks: {
      status: forbiddenPathFindings.length === 0 ? "pass" : "fail",
      privateExcludePaths: manifest.privateExcludePaths,
      generatedExcludePaths: manifest.generatedExcludePaths,
      sensitiveExcludeGlobs: manifest.sensitiveExcludeGlobs,
      findings: forbiddenPathFindings
    },
    packages: packageFindings.packages,
    issues,
    remainingReleaseGates: [
      "Run install/build/lint/typecheck/test/release checks inside a reviewed public candidate repository.",
      "Complete legal review of LICENSE, NOTICE, CONTRIBUTING, SECURITY, trademark policy, package metadata, and repository boundary.",
      "Create and protect the real hosted public repository.",
      "Move or keep closed dashboard/API/workers/infra operations in the private cloud repository."
    ]
  };

  assertNoSensitiveValues(JSON.stringify(report));
  await writeJson(reportPath, report);
  await writeJson(samplePath, report);

  if (issues.length > 0) {
    for (const issue of issues) {
      console.error(`${issue.code}: ${issue.message}`);
    }
    throw new Error(
      `Public repository split candidate failed with ${issues.length} issue(s).`
    );
  }

  console.log(
    `Public repository split candidate PASS: ${files.length} files, ${packageFindings.packages.length} packages`
  );
  console.log(`Report: ${reportPath}`);
  console.log(`Sample: ${samplePath}`);
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}

async function copyCandidateTree(targetRoot) {
  const copied = [];
  for (const includePath of manifest.publicIncludePaths.map(normalizePath)) {
    assertSafeRelativePath(includePath);
    const source = path.join(repoRoot, includePath);
    const destination = path.join(targetRoot, includePath);
    const sourceStat = await stat(source);
    if (sourceStat.isDirectory()) {
      await copyDirectory(source, destination);
    } else if (sourceStat.isFile()) {
      await mkdir(path.dirname(destination), { recursive: true });
      await writeFile(destination, await readFile(source));
    } else {
      throw new Error(`${includePath} is neither a file nor directory.`);
    }
    copied.push(includePath);
  }
  return copied.sort();
}

async function copyDirectory(sourceDirectory, destinationDirectory) {
  await mkdir(destinationDirectory, { recursive: true });
  const entries = await readdir(sourceDirectory, { withFileTypes: true });
  for (const entry of entries) {
    const sourceEntry = path.join(sourceDirectory, entry.name);
    const destinationEntry = path.join(destinationDirectory, entry.name);
    const relativeSource = normalizePath(path.relative(repoRoot, sourceEntry));
    if (isGeneratedPath(relativeSource) || isSensitivePath(relativeSource)) {
      continue;
    }
    if (entry.isDirectory()) {
      await copyDirectory(sourceEntry, destinationEntry);
    } else if (entry.isFile()) {
      await mkdir(path.dirname(destinationEntry), { recursive: true });
      await writeFile(destinationEntry, await readFile(sourceEntry));
    }
  }
}

async function collectFiles(root) {
  const files = [];
  await collectFilesInto(root, "", files);
  return files.sort();
}

async function collectFilesInto(root, relativeDirectory, files) {
  const absoluteDirectory = path.join(root, relativeDirectory);
  const entries = await readdir(absoluteDirectory, { withFileTypes: true });
  for (const entry of entries) {
    const relativeEntry = normalizePath(
      path.join(relativeDirectory, entry.name)
    );
    if (entry.isDirectory()) {
      await collectFilesInto(root, relativeEntry, files);
    } else if (entry.isFile()) {
      files.push(relativeEntry);
    }
  }
}

function findForbiddenPaths(files) {
  const findings = [];
  for (const file of files) {
    if (matchesAnyPath(file, manifest.privateExcludePaths)) {
      findings.push(issue("PRIVATE_PATH_INCLUDED", `${file} is private.`));
    }
    if (matchesAnyPath(file, manifest.generatedExcludePaths)) {
      findings.push(issue("GENERATED_PATH_INCLUDED", `${file} is generated.`));
    }
    if (isSensitivePath(file)) {
      findings.push(issue("SENSITIVE_PATH_INCLUDED", `${file} is sensitive.`));
    }
  }
  return findings;
}

async function validateCandidatePackages(root) {
  const issues = [];
  const packages = [];
  const privatePackageNames = new Set(manifest.privatePackageNames);

  for (const packagePath of manifest.publicPackagePaths.map(normalizePath)) {
    const packageJsonPath = path.join(root, packagePath, "package.json");
    const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
    const dependencies = dependencyEntries(packageJson);
    const privateDependencies = dependencies.filter((dependency) =>
      privatePackageNames.has(dependency.name)
    );
    for (const dependency of privateDependencies) {
      issues.push(
        issue(
          "PUBLIC_PACKAGE_PRIVATE_DEPENDENCY",
          `${packagePath} depends on private package ${dependency.name}.`
        )
      );
    }
    packages.push({
      path: packagePath,
      name: packageJson.name,
      private: packageJson.private === true,
      dependencyCount: dependencies.length,
      privateDependencyCount: privateDependencies.length,
      status: privateDependencies.length === 0 ? "pass" : "fail"
    });
  }

  return { packages, issues };
}

async function hashCandidateTree(root, files) {
  const hash = createHash("sha256");
  for (const file of files) {
    hash.update(file);
    hash.update("\0");
    hash.update(await readFile(path.join(root, file)));
    hash.update("\0");
  }
  return hash.digest("hex");
}

function dependencyEntries(packageJson) {
  return [
    ...entries(packageJson.dependencies, "dependencies"),
    ...entries(packageJson.peerDependencies, "peerDependencies"),
    ...entries(packageJson.optionalDependencies, "optionalDependencies"),
    ...entries(packageJson.devDependencies, "devDependencies")
  ];
}

function entries(value, field) {
  if (value === undefined) return [];
  return Object.keys(value).map((name) => ({ field, name }));
}

function matchesAnyPath(file, paths) {
  return paths.some((entry) => {
    const normalized = normalizePath(entry);
    return file === normalized || file.startsWith(`${normalized}/`);
  });
}

function isGeneratedPath(file) {
  return matchesAnyPath(file, manifest.generatedExcludePaths);
}

function isSensitivePath(file) {
  return manifest.sensitiveExcludeGlobs.some((glob) =>
    globMatchesPath(glob, file)
  );
}

function globMatchesPath(glob, file) {
  const basename = path.posix.basename(file);
  if (glob === basename || glob === file) return true;
  if (glob.endsWith(".*")) {
    return basename.startsWith(glob.slice(0, -1));
  }
  if (glob.startsWith("*.")) {
    return basename.endsWith(glob.slice(1));
  }
  return false;
}

function assertSafeRelativePath(relativePath) {
  if (
    relativePath === "" ||
    relativePath.startsWith("../") ||
    path.isAbsolute(relativePath)
  ) {
    throw new Error(`Unsafe public include path: ${relativePath}`);
  }
}

function normalizePath(value) {
  return value.split(path.sep).join("/");
}

function issue(code, message) {
  return { severity: "blocker", code, message };
}

function assertNoSensitiveValues(text) {
  const forbidden = [
    /private_key/i,
    /client-secret/i,
    /authorization:/i,
    /bearer\s+/i,
    /cookie:/i,
    /set-cookie:/i,
    /sk_live/i,
    /whsec_/i,
    /postgres:\/\//i,
    /-----BEGIN PRIVATE KEY-----/i,
    /ya29\./i,
    /xox[baprs]-/i
  ];
  const match = forbidden.find((pattern) => pattern.test(text));
  if (match) {
    throw new Error(
      `Sensitive value leaked into repository split evidence: ${match}`
    );
  }
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(
    filePath,
    await format(`${JSON.stringify(value, null, 2)}\n`, { parser: "json" })
  );
}
