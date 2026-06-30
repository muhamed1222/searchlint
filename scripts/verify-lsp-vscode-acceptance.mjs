#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const reportPath = path.join(
  repoRoot,
  "reports/lsp-vscode-acceptance-report.json"
);
const samplePath = path.join(
  repoRoot,
  "docs/examples/lsp-vscode-acceptance-report.sample.json"
);
const fixedGeneratedAt = "2026-06-22T00:00:00.000Z";

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

async function readText(filePath) {
  return readFile(filePath, "utf8");
}

async function formatJson(value) {
  const prettier = await import("prettier");
  return prettier.format(JSON.stringify(value), { parser: "json" });
}

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

function caseResult(id, status, evidence, notes = []) {
  return { id, status, evidence, notes };
}

async function main() {
  run("pnpm", ["build"], { stdio: "inherit" });

  const {
    createSearchLintDocumentCodeActions,
    createSearchLintDocumentCompletions,
    createSearchLintDocumentDefinition,
    createSearchLintDocumentDiagnostics,
    createSearchLintDocumentHover,
    createSearchLintDocumentReferences,
    createSearchLintDocumentRenameEdit,
    formatSearchLintDocumentText
  } = await import("../packages/lsp/dist/src/index.js");
  const { createSearchLintLanguageServer } =
    await import("../packages/language-server/dist/src/server.js");

  const source = `language 1
site "https://example.com"
let schemas ["Product"]
policy productPage {
  schema $schemas
}
route "/products/**" {
  use productPage
  severity SL-INDEX-001 fatal
}
`;
  const uri = "file:///searchlint.seo";
  const cases = [];

  const diagnostics = createSearchLintDocumentDiagnostics(source).diagnostics;
  assert(
    diagnostics.some((diagnostic) => diagnostic.code === "SLANG203"),
    "LSP diagnostics must include semantic severity error"
  );
  const hover = createSearchLintDocumentHover(source, {
    line: 0,
    character: 2
  });
  assert(
    hover?.contents.includes("language 1"),
    "LSP hover must describe DSL constructs"
  );
  const completions = createSearchLintDocumentCompletions();
  assert(
    completions.some((completion) => completion.label === "route") &&
      completions.some((completion) => completion.label === "google"),
    "LSP completions must include keywords and provider enums"
  );
  const formatted = formatSearchLintDocumentText(source);
  assert(
    formatted.includes('route "/products/**" {'),
    "Formatter must use shared DSL formatter"
  );
  const actions = createSearchLintDocumentCodeActions(uri, source, diagnostics);
  assert(
    actions.some(
      (action) => action.title === "Replace with severity 'warning'"
    ),
    "LSP code actions must include severity quick fixes"
  );
  cases.push(
    caseResult("diagnostics-hover-completion-format-actions", "PASS", {
      diagnosticCodes: diagnostics.map((diagnostic) => diagnostic.code),
      completionCount: completions.length,
      actionTitles: actions.map((action) => action.title)
    })
  );

  const definition = createSearchLintDocumentDefinition(uri, source, {
    line: 7,
    character: 7
  });
  const references = createSearchLintDocumentReferences(uri, source, {
    line: 7,
    character: 7
  });
  const rename = createSearchLintDocumentRenameEdit(
    uri,
    source,
    {
      line: 7,
      character: 7
    },
    "catalogPage"
  );
  assert(definition?.range.start.line === 3, "Policy definition must resolve");
  assert(
    references.length === 2,
    "Policy references must include declaration and use site"
  );
  assert(
    rename?.changes[uri]?.length === 2,
    "Policy rename must edit declaration and reference"
  );
  cases.push(
    caseResult("definition-references-rename", "PASS", {
      definition,
      referenceCount: references.length,
      renameEditCount: rename?.changes[uri]?.length ?? 0
    })
  );

  const connection = createConnectionStub();
  const server = createSearchLintLanguageServer(connection.connection);
  const capabilities = server.initializeResult.capabilities;
  assert(
    capabilities.hoverProvider === true,
    "Language server must provide hover"
  );
  assert(
    capabilities.completionProvider,
    "Language server must provide completion"
  );
  assert(
    capabilities.documentFormattingProvider === true,
    "Language server must provide formatting"
  );
  assert(
    capabilities.codeActionProvider === true,
    "Language server must provide code actions"
  );
  assert(
    capabilities.definitionProvider === true,
    "Language server must provide definitions"
  );
  assert(
    capabilities.referencesProvider === true,
    "Language server must provide references"
  );
  assert(
    capabilities.renameProvider === true,
    "Language server must provide rename"
  );
  assert(
    ["definition", "references", "rename"].every(
      (handler) => typeof connection.handlers[handler] === "function"
    ),
    "Language server must register definition/references/rename handlers"
  );
  cases.push(
    caseResult("language-server-capabilities", "PASS", {
      capabilities: {
        hoverProvider: capabilities.hoverProvider,
        completionProvider: Boolean(capabilities.completionProvider),
        documentFormattingProvider: capabilities.documentFormattingProvider,
        codeActionProvider: capabilities.codeActionProvider,
        definitionProvider: capabilities.definitionProvider,
        referencesProvider: capabilities.referencesProvider,
        renameProvider: capabilities.renameProvider
      }
    })
  );

  const manifest = await readJson(
    path.join(repoRoot, "apps/vscode/package.json")
  );
  const requiredFiles = ["README.md", "CHANGELOG.md", "PRIVACY.md"];
  for (const fileName of requiredFiles) {
    assert(
      await exists(path.join(repoRoot, "apps/vscode", fileName)),
      `VS Code ${fileName} must exist`
    );
    assert(
      manifest.files.includes(fileName),
      `VS Code manifest files must include ${fileName}`
    );
  }
  assert(
    manifest.version === "1.0.0-beta.0",
    "VS Code extension must use beta version"
  );
  assert(
    manifest.license === "Apache-2.0",
    "VS Code extension must declare Apache-2.0"
  );
  assert(
    manifest.contributes.languages.length === 1,
    "VS Code extension must contribute language"
  );
  assert(
    manifest.contributes.commands.length === 1,
    "VS Code extension must contribute command"
  );
  assert(
    manifest.activationEvents.includes("onLanguage:searchlint-seo"),
    "VS Code extension must activate on SearchLint language"
  );
  assert(
    await exists(
      path.join(repoRoot, "apps/vscode/dist/src/server-node-shim.js")
    ),
    "VS Code extension server shim must build"
  );
  const privacy = await readFile(
    path.join(repoRoot, "apps/vscode/PRIVACY.md"),
    "utf8"
  );
  assert(
    privacy.includes("does not include telemetry"),
    "VS Code privacy statement must mention no telemetry"
  );
  cases.push(
    caseResult("vscode-extension-local-release-metadata", "PASS", {
      version: manifest.version,
      private: manifest.private,
      preview: manifest.preview,
      files: requiredFiles,
      languageId: manifest.contributes.languages[0].id,
      command: manifest.contributes.commands[0].command
    })
  );

  const assetFiles = [
    manifest.icon,
    "assets/screenshots/diagnostics.svg",
    "assets/screenshots/quick-fix.svg"
  ];
  assert(manifest.icon === "assets/icon.svg", "VS Code icon must be declared");
  assert(
    manifest.files.includes("assets"),
    "VS Code manifest files must include assets"
  );
  const readme = await readText(path.join(repoRoot, "apps/vscode/README.md"));
  for (const assetFile of assetFiles) {
    const assetPath = path.join(repoRoot, "apps/vscode", assetFile);
    assert(await exists(assetPath), `VS Code asset must exist: ${assetFile}`);
    const svg = await readText(assetPath);
    assert(
      svg.includes("<svg") && svg.includes("</svg>"),
      `VS Code asset must be SVG: ${assetFile}`
    );
    assert(
      /<title\b/.test(svg) && /<desc\b/.test(svg),
      `VS Code asset must include accessible title and description: ${assetFile}`
    );
  }
  const screenshots = assetFiles.filter((assetFile) =>
    assetFile.startsWith("assets/screenshots/")
  );
  for (const screenshot of screenshots) {
    assert(
      readme.includes(screenshot),
      `VS Code README must reference screenshot: ${screenshot}`
    );
  }
  cases.push(
    caseResult("vscode-extension-release-assets", "PASS", {
      icon: manifest.icon,
      packageFilesIncludeAssets: manifest.files.includes("assets"),
      screenshots,
      readmeReferences: screenshots
    })
  );

  const failedCases = cases.filter((item) => item.status !== "PASS");
  const summary = {
    status: failedCases.length === 0 ? "PASS" : "FAIL",
    generatedAt: fixedGeneratedAt,
    nodeVersion: process.version,
    caseCount: cases.length,
    passed: cases.length - failedCases.length,
    failed: failedCases.length
  };
  const report = {
    schemaVersion: 1,
    summary,
    cases,
    limitations: [
      "Definition, references, and rename are same-document features for policies and variables.",
      "Real VSIX install, Extension Host E2E, Marketplace publisher setup, screenshots, signing, and publication remain release gates.",
      "The VS Code extension remains private until publication is explicitly approved."
    ]
  };

  await mkdir(path.dirname(reportPath), { recursive: true });
  await mkdir(path.dirname(samplePath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(samplePath, await formatJson(report));

  if (summary.status !== "PASS") {
    process.exitCode = 1;
  }

  console.log(
    `LSP/VS Code acceptance ${summary.status}: ${summary.passed}/${summary.caseCount} cases passed`
  );
  console.log(`Report: ${path.relative(repoRoot, reportPath)}`);
  console.log(`Sample: ${path.relative(repoRoot, samplePath)}`);
}

function createConnectionStub() {
  const handlers = {};
  return {
    handlers,
    connection: {
      sendDiagnostics() {},
      onInitialize(handler) {
        handlers.initialize = handler;
      },
      onDidOpenTextDocument(handler) {
        handlers.open = handler;
      },
      onDidChangeTextDocument(handler) {
        handlers.change = handler;
      },
      onDidCloseTextDocument(handler) {
        handlers.close = handler;
      },
      onHover(handler) {
        handlers.hover = handler;
      },
      onCompletion(handler) {
        handlers.completion = handler;
      },
      onDocumentFormatting(handler) {
        handlers.formatting = handler;
      },
      onCodeAction(handler) {
        handlers.codeAction = handler;
      },
      onDefinition(handler) {
        handlers.definition = handler;
      },
      onReferences(handler) {
        handlers.references = handler;
      },
      onRenameRequest(handler) {
        handlers.rename = handler;
      }
    }
  };
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
