#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const vscodeRoot = path.join(repoRoot, "apps/vscode");
const fixedGeneratedAt = "2026-06-23T00:00:00.000Z";
const reportPath = path.join(
  repoRoot,
  "reports/vscode-vsix-readiness-report.json"
);
const samplePath = path.join(
  repoRoot,
  "docs/examples/vscode-vsix-readiness-report.sample.json"
);

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    env: { ...process.env, ...options.env },
    encoding: "utf8",
    stdio: options.stdio ?? "pipe"
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

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function formatJson(value) {
  const prettier = await import("prettier");
  return prettier.format(JSON.stringify(value), { parser: "json" });
}

function xmlEscape(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function copyPackagePayload(sourceRoot, destinationRoot, manifest) {
  for (const entry of manifest.files) {
    await cp(path.join(sourceRoot, entry), path.join(destinationRoot, entry), {
      recursive: true,
      dereference: true
    });
  }
}

async function copyWorkspaceRuntimePackage(packageDir, destinationRoot) {
  const sourceRoot = path.join(repoRoot, packageDir);
  const manifest = await readJson(path.join(sourceRoot, "package.json"));
  const packageDestination = path.join(
    destinationRoot,
    "node_modules",
    ...manifest.name.split("/")
  );
  await mkdir(packageDestination, { recursive: true });
  await copyPackagePayload(sourceRoot, packageDestination, manifest);
  return manifest.name;
}

async function copyExternalRuntimePackage(sourcePath, destinationRoot, name) {
  await cp(sourcePath, path.join(destinationRoot, "node_modules", name), {
    recursive: true,
    dereference: true,
    filter: (entry) => !entry.includes(`${path.sep}.vite${path.sep}`)
  });
}

function contentTypesXml() {
  return `<?xml version="1.0" encoding="utf-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="json" ContentType="application/json" />
  <Default Extension="js" ContentType="application/javascript" />
  <Default Extension="d.ts" ContentType="text/plain" />
  <Default Extension="md" ContentType="text/markdown" />
  <Default Extension="svg" ContentType="image/svg+xml" />
  <Default Extension="xml" ContentType="text/xml" />
  <Override PartName="/extension.vsixmanifest" ContentType="text/xml" />
</Types>
`;
}

function vsixManifestXml(manifest) {
  return `<?xml version="1.0" encoding="utf-8"?>
<PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011">
  <Metadata>
    <Identity Id="${xmlEscape(manifest.name)}" Version="${xmlEscape(
      manifest.version
    )}" Language="en-US" Publisher="searchlint" />
    <DisplayName>${xmlEscape(manifest.displayName)}</DisplayName>
    <Description xml:space="preserve">${xmlEscape(
      manifest.description
    )}</Description>
    <Tags>${xmlEscape(manifest.keywords.join(","))}</Tags>
    <License>Apache-2.0</License>
  </Metadata>
  <Installation>
    <InstallationTarget Id="Microsoft.VisualStudio.Code" Version="${xmlEscape(
      manifest.engines.vscode
    )}" />
  </Installation>
  <Assets>
    <Asset Type="Microsoft.VisualStudio.Code.Manifest" Path="extension/package.json" Addressable="true" />
  </Assets>
</PackageManifest>
`;
}

function requiredVsixEntries(manifest) {
  return [
    "[Content_Types].xml",
    "extension.vsixmanifest",
    "extension/package.json",
    `extension/${manifest.main.replace(/^\.\//, "")}`,
    `extension/${manifest.icon}`,
    "extension/assets/screenshots/diagnostics.svg",
    "extension/assets/screenshots/quick-fix.svg",
    "extension/language-configuration.json",
    "extension/README.md",
    "extension/CHANGELOG.md",
    "extension/PRIVACY.md",
    "extension/dist/src/server-node-shim.js",
    "extension/node_modules/vscode-languageclient/package.json",
    "extension/node_modules/searchlint-language-server/package.json",
    "extension/node_modules/@searchlint/lsp/package.json",
    "extension/node_modules/@searchlint/core/package.json",
    "extension/node_modules/@searchlint/language/package.json"
  ];
}

async function main() {
  run("pnpm", ["lsp-vscode:acceptance"], { stdio: "inherit" });

  const manifest = await readJson(path.join(vscodeRoot, "package.json"));
  const tempRoot = await mkdtemp(path.join(tmpdir(), "searchlint-vsix-"));
  const stagingRoot = path.join(tempRoot, "vsix");
  const extensionRoot = path.join(stagingRoot, "extension");
  const artifactName = `${manifest.name}-${manifest.version}.vsix`;
  const artifactPath = path.join(repoRoot, "reports", artifactName);

  try {
    await mkdir(extensionRoot, { recursive: true });
    await copyPackagePayload(vscodeRoot, extensionRoot, manifest);
    await mkdir(path.join(extensionRoot, "node_modules"), { recursive: true });

    await copyWorkspaceRuntimePackage(
      "packages/language-server",
      extensionRoot
    );
    await copyWorkspaceRuntimePackage("packages/lsp", extensionRoot);
    await copyWorkspaceRuntimePackage("packages/core", extensionRoot);
    await copyWorkspaceRuntimePackage("packages/language", extensionRoot);
    await copyExternalRuntimePackage(
      path.join(vscodeRoot, "node_modules/vscode-languageclient"),
      extensionRoot,
      "vscode-languageclient"
    );
    await copyExternalRuntimePackage(
      path.join(
        repoRoot,
        "packages/language-server/node_modules/vscode-languageserver"
      ),
      extensionRoot,
      "vscode-languageserver"
    );
    await copyExternalRuntimePackage(
      path.join(
        repoRoot,
        "packages/language-server/node_modules/vscode-languageserver-textdocument"
      ),
      extensionRoot,
      "vscode-languageserver-textdocument"
    );

    await writeFile(
      path.join(stagingRoot, "[Content_Types].xml"),
      contentTypesXml()
    );
    await writeFile(
      path.join(stagingRoot, "extension.vsixmanifest"),
      vsixManifestXml(manifest)
    );

    await mkdir(path.dirname(artifactPath), { recursive: true });
    if (await exists(artifactPath)) {
      await rm(artifactPath, { force: true });
    }
    run("zip", ["-X", "-qr", artifactPath, "."], { cwd: stagingRoot });

    const entries = run("unzip", ["-Z1", artifactPath])
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .sort();
    const requiredEntries = requiredVsixEntries(manifest);
    for (const entry of requiredEntries) {
      assert(entries.includes(entry), `VSIX missing required entry: ${entry}`);
    }

    const packagedManifest = await readJson(
      path.join(extensionRoot, "package.json")
    );
    assert(
      packagedManifest.publisher === "searchlint",
      "VSIX packaged manifest must keep publisher"
    );
    assert(
      packagedManifest.version === "1.0.0-beta.0",
      "VSIX packaged manifest must keep beta version"
    );
    assert(
      packagedManifest.icon === "assets/icon.svg",
      "VSIX packaged manifest must keep icon"
    );
    assert(
      packagedManifest.files.includes("assets"),
      "VSIX packaged manifest must include assets in files"
    );
    assert(
      packagedManifest.contributes.languages[0].id === "searchlint-seo",
      "VSIX packaged manifest must contribute SearchLint language"
    );
    assert(
      packagedManifest.contributes.commands[0].command ===
        "searchlint.openOverlay",
      "VSIX packaged manifest must contribute overlay command"
    );

    const artifactStat = await stat(artifactPath);
    const report = {
      schemaVersion: 1,
      generatedAt: fixedGeneratedAt,
      status: "PASS",
      nodeVersion: process.version,
      artifact: {
        path: path.relative(repoRoot, artifactPath),
        sizeBytes: artifactStat.size,
        generatedArtifact: true
      },
      manifest: {
        name: packagedManifest.name,
        version: packagedManifest.version,
        private: packagedManifest.private,
        preview: packagedManifest.preview,
        icon: packagedManifest.icon,
        main: packagedManifest.main,
        languageId: packagedManifest.contributes.languages[0].id,
        command: packagedManifest.contributes.commands[0].command
      },
      archive: {
        entryCount: entries.length,
        requiredEntries,
        requiredEntriesPresent: true,
        hasVsixManifest: entries.includes("extension.vsixmanifest"),
        hasContentTypes: entries.includes("[Content_Types].xml"),
        includesRuntimeDependencies: [
          "vscode-languageclient",
          "searchlint-language-server",
          "@searchlint/lsp",
          "@searchlint/core",
          "@searchlint/language"
        ]
      },
      remainingReleaseGates: [
        "clean VS Code install",
        "VS Code Extension Host E2E",
        "Marketplace publisher account setup",
        "VSIX signing",
        "Marketplace publication",
        "extension update acceptance"
      ]
    };

    await mkdir(path.dirname(reportPath), { recursive: true });
    await mkdir(path.dirname(samplePath), { recursive: true });
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    await writeFile(samplePath, await formatJson(report));

    console.log(
      `VS Code VSIX readiness PASS: entries=${entries.length}, artifact=${report.artifact.path}`
    );
    console.log(`Sample: ${path.relative(repoRoot, samplePath)}`);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
