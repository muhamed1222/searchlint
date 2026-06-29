#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const fixedGeneratedAt = "2026-06-23T00:00:00.000Z";
const reportPath = path.join(
  repoRoot,
  "reports/lsp-workspace-acceptance-report.json"
);
const samplePath = path.join(
  repoRoot,
  "docs/examples/lsp-workspace-acceptance-report.sample.json"
);
const workspaceDocumentCount = 260;

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

async function formatJson(value) {
  const prettier = await import("prettier");
  return prettier.format(JSON.stringify(value), { parser: "json" });
}

function validDocument(index) {
  return `language 1
site "https://example${index}.com"
route "/products/${index}/**" {
  indexable true
}
`;
}

function invalidDocument(index) {
  return `site "https://example${index}.com"
route "/products/${index}/**" {
  indexable maybe
}
`;
}

function createConnectionStub() {
  const diagnostics = [];
  const handlers = {};
  return {
    diagnostics,
    handlers,
    connection: {
      sendDiagnostics(payload) {
        diagnostics.push(payload);
      },
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

function caseResult(id, evidence) {
  return { id, status: "PASS", evidence };
}

async function main() {
  run("pnpm", ["--filter", "searchlint-language-server", "test"], {
    stdio: "inherit"
  });
  run("pnpm", ["build"], { stdio: "inherit" });

  const { createSearchLintLanguageServer } =
    await import("../packages/language-server/dist/src/server.js");
  const stub = createConnectionStub();
  const server = createSearchLintLanguageServer(stub.connection);
  const cases = [];

  const validUri = "file:///workspace/valid.searchlint.seo";
  const invalidUri = "file:///workspace/invalid.searchlint.seo";
  await server.openDocument({
    uri: validUri,
    languageId: "searchlint-seo",
    version: 1,
    text: validDocument(1)
  });
  await server.openDocument({
    uri: invalidUri,
    languageId: "searchlint-seo",
    version: 1,
    text: invalidDocument(2)
  });
  const validBefore = server.getDocumentDiagnostics(validUri).length;
  const invalidBefore = server.getDocumentDiagnostics(invalidUri).length;
  await server.changeDocument(invalidUri, 2, [{ text: validDocument(2) }]);
  const validAfter = server.getDocumentDiagnostics(validUri).length;
  const invalidAfter = server.getDocumentDiagnostics(invalidUri).length;

  assert(validBefore === 0, "valid document must start clean");
  assert(invalidBefore > 0, "invalid document must start with diagnostics");
  assert(validAfter === 0, "unchanged valid document must stay clean");
  assert(invalidAfter === 0, "changed invalid document must clear diagnostics");
  cases.push(
    caseResult("multi-file-invalidation", {
      validBefore,
      invalidBefore,
      validAfter,
      invalidAfter,
      diagnosticPublishes: stub.diagnostics.length
    })
  );

  const staleUri = "file:///workspace/stale.searchlint.seo";
  await server.openDocument({
    uri: staleUri,
    languageId: "searchlint-seo",
    version: 1,
    text: invalidDocument(3)
  });
  const staleBefore = server.getDocumentDiagnostics(staleUri).length;
  await server.changeDocument(staleUri, 2, [{ text: validDocument(3) }]);
  const staleAfterChange = server.getDocumentDiagnostics(staleUri).length;
  server.closeDocument(staleUri);
  const staleAfterClose = server.getDocumentDiagnostics(staleUri).length;
  const staleClosePayload = stub.diagnostics.at(-1);
  assert(staleBefore > 0, "stale document must start with diagnostics");
  assert(staleAfterChange === 0, "valid change must clear stale diagnostics");
  assert(staleAfterClose === 0, "close must clear stored diagnostics");
  assert(
    staleClosePayload.uri === staleUri &&
      staleClosePayload.diagnostics.length === 0,
    "close must publish empty diagnostics"
  );
  cases.push(
    caseResult("stale-diagnostic-cleanup", {
      staleBefore,
      staleAfterChange,
      staleAfterClose,
      closePublishedEmptyDiagnostics: true
    })
  );

  const workspaceUris = [];
  for (let index = 0; index < workspaceDocumentCount; index += 1) {
    const uri = `file:///workspace/large/${index}.searchlint.seo`;
    workspaceUris.push(uri);
    await server.openDocument({
      uri,
      languageId: "searchlint-seo",
      version: 1,
      text: index % 10 === 0 ? invalidDocument(index) : validDocument(index)
    });
  }
  const initiallyInvalid = workspaceUris.filter(
    (uri) => server.getDocumentDiagnostics(uri).length > 0
  );
  const mutationTargets = initiallyInvalid.slice(0, 10);
  for (const [offset, uri] of mutationTargets.entries()) {
    await server.changeDocument(uri, 2, [
      { text: validDocument(1000 + offset) }
    ]);
  }
  const stillInvalidAfterMutation = workspaceUris.filter(
    (uri) => server.getDocumentDiagnostics(uri).length > 0
  );
  const closeTargets = workspaceUris.slice(0, 25);
  for (const uri of closeTargets) {
    server.closeDocument(uri);
  }
  const closedStillTracked = closeTargets.filter(
    (uri) =>
      server.getDocumentText(uri) !== undefined ||
      server.getDocumentDiagnostics(uri).length > 0
  );

  assert(
    initiallyInvalid.length === workspaceDocumentCount / 10,
    "large workspace must create expected invalid documents"
  );
  assert(
    stillInvalidAfterMutation.length ===
      initiallyInvalid.length - mutationTargets.length,
    "large workspace mutation must clear only changed invalid documents"
  );
  assert(
    closedStillTracked.length === 0,
    "closed documents must not remain tracked"
  );
  cases.push(
    caseResult("large-workspace", {
      workspaceDocumentCount,
      initiallyInvalid: initiallyInvalid.length,
      mutationTargets: mutationTargets.length,
      stillInvalidAfterMutation: stillInvalidAfterMutation.length,
      closeTargets: closeTargets.length,
      closedStillTracked: closedStillTracked.length,
      totalDiagnosticPublishes: stub.diagnostics.length
    })
  );

  const report = {
    schemaVersion: 1,
    generatedAt: fixedGeneratedAt,
    status: "PASS",
    nodeVersion: process.version,
    summary: {
      caseCount: cases.length,
      passed: cases.length,
      failed: 0,
      workspaceDocumentCount
    },
    cases,
    remainingReleaseGates: [
      "VS Code clean install",
      "VS Code Extension Host E2E",
      "Marketplace publisher setup",
      "VSIX signing",
      "Marketplace publication",
      "extension update acceptance",
      "cross-file references and rename index"
    ]
  };

  await mkdir(path.dirname(reportPath), { recursive: true });
  await mkdir(path.dirname(samplePath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(samplePath, await formatJson(report));

  console.log(
    `LSP workspace acceptance PASS: cases=${cases.length}, documents=${workspaceDocumentCount}`
  );
  console.log(`Report: ${path.relative(repoRoot, reportPath)}`);
  console.log(`Sample: ${path.relative(repoRoot, samplePath)}`);
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
