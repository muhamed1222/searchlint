#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
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
const reportPath = "reports/public-repository-candidate-validation-report.json";
const samplePath =
  "docs/examples/public-repository-candidate-validation-report.sample.json";
const generatedAt = "2026-06-23T00:00:00.000Z";
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const tempRoot = await mkdtemp(
  path.join(os.tmpdir(), "searchlint-public-candidate-validation-")
);
const candidateRoot = path.join(tempRoot, "public-repository");

try {
  await mkdir(candidateRoot, { recursive: true });
  const copiedPaths = await copyCandidateTree(candidateRoot);
  const files = await collectFiles(candidateRoot);
  const candidateHash = await hashCandidateTree(candidateRoot, files);
  const forbiddenFindings = findForbiddenPaths(files);

  const commands = [
    runCandidateCommand("install", ["install", "--frozen-lockfile"]),
    runCandidateCommand("build", ["-r", "--if-present", "build"]),
    runCandidateCommand("typecheck", ["-r", "--if-present", "typecheck"]),
    runCandidateCommand("test", ["-r", "--if-present", "test"]),
    runCandidateCommand("verifyRelease", ["verify:release"])
  ];
  const failedCommands = commands.filter((command) => command.exitCode !== 0);
  const issues = [
    ...forbiddenFindings,
    ...failedCommands.map((command) =>
      issue(
        "PUBLIC_CANDIDATE_COMMAND_FAILED",
        `${command.name} failed with exit code ${command.exitCode}.`
      )
    )
  ];

  const report = {
    generatedBy: "searchlint-public-repository-candidate-validation-verifier",
    generatedAt,
    status: issues.length === 0 ? "PASS" : "FAIL",
    scope: {
      proofType: "standalone temporary public repository candidate validation",
      manifest: manifestPath,
      decision: manifest.decision,
      adr: manifest.adr,
      doesNotClaim: [
        "hosted public Git repository created",
        "hosted public CI passed",
        "legal approval completed",
        "npm or VS Code publication"
      ]
    },
    candidate: {
      root: "<temporary>",
      publicIncludePathCount: manifest.publicIncludePaths.length,
      copiedPathCount: copiedPaths.length,
      fileCount: files.length,
      sha256: candidateHash
    },
    commands,
    forbiddenPathChecks: {
      status: forbiddenFindings.length === 0 ? "pass" : "fail",
      findings: forbiddenFindings
    },
    issues,
    remainingReleaseGates: [
      "Create the hosted public repository.",
      "Run the same validation in hosted CI for the public repository.",
      "Complete legal review of the public repository boundary and public files.",
      "Publish public npm packages and the VS Code extension only after release approval."
    ]
  };

  assertNoSensitiveValues(JSON.stringify(report));
  await writeJson(reportPath, report);
  await writeJson(samplePath, report);

  if (issues.length > 0) {
    for (const entry of issues) {
      console.error(`${entry.code}: ${entry.message}`);
    }
    throw new Error(
      `Public repository candidate validation failed with ${issues.length} issue(s).`
    );
  }

  console.log(
    `Public repository candidate validation PASS: ${files.length} files, ${commands.length} command(s)`
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

function runCandidateCommand(name, args) {
  const startedAt = Date.now();
  const result = spawnSync("pnpm", args, {
    cwd: candidateRoot,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 1024 * 1024 * 20
  });
  return {
    name,
    command: `pnpm ${args.join(" ")}`,
    exitCode: result.status ?? 1,
    durationMs: Date.now() - startedAt,
    stdoutTail: tailLines(result.stdout ?? ""),
    stderrTail: tailLines(result.stderr ?? "")
  };
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
  if (glob.endsWith(".*")) return basename.startsWith(glob.slice(0, -1));
  if (glob.startsWith("*.")) return basename.endsWith(glob.slice(1));
  return false;
}

function tailLines(value) {
  const sanitized = value
    .split(tempRoot)
    .join("<temporary>")
    .split(candidateRoot)
    .join("<temporary>/public-repository")
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0)
    .slice(-40)
    .join("\n");
  return sanitized.length > 4000 ? sanitized.slice(-4000) : sanitized;
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
      `Sensitive value leaked into public candidate validation evidence: ${match}`
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
