import { describe, expect, it } from "vitest";

import { createSearchLintLanguageServer } from "../src/server.js";

function createConnectionStub() {
  const diagnostics: unknown[] = [];
  const handlers: Record<string, unknown> = {};

  return {
    diagnostics,
    handlers,
    connection: {
      sendDiagnostics(payload: unknown) {
        diagnostics.push(payload);
      },
      onInitialize(handler: unknown) {
        handlers.initialize = handler;
      },
      onDidOpenTextDocument(handler: unknown) {
        handlers.open = handler;
      },
      onDidChangeTextDocument(handler: unknown) {
        handlers.change = handler;
      },
      onDidCloseTextDocument(handler: unknown) {
        handlers.close = handler;
      },
      onHover(handler: unknown) {
        handlers.hover = handler;
      },
      onCompletion(handler: unknown) {
        handlers.completion = handler;
      },
      onDocumentFormatting(handler: unknown) {
        handlers.formatting = handler;
      },
      onCodeAction(handler: unknown) {
        handlers.codeAction = handler;
      },
      onDefinition(handler: unknown) {
        handlers.definition = handler;
      },
      onReferences(handler: unknown) {
        handlers.references = handler;
      },
      onRenameRequest(handler: unknown) {
        handlers.rename = handler;
      }
    } as never
  };
}

describe("createSearchLintLanguageServer", () => {
  it("publishes diagnostics and updates incremental document text", async () => {
    const stub = createConnectionStub();
    const server = createSearchLintLanguageServer(stub.connection);

    await server.openDocument({
      uri: "file:///searchlint.seo",
      languageId: "searchlint-seo",
      version: 1,
      text: `site "https://example.com"\n`
    });

    expect(server.getDocumentDiagnostics("file:///searchlint.seo")).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "SLANG206" })])
    );

    await server.changeDocument("file:///searchlint.seo", 2, [
      {
        text: `language 1\nsite "https://example.com"\n`
      }
    ]);

    expect(server.getDocumentDiagnostics("file:///searchlint.seo")).toEqual([]);
    expect(stub.diagnostics.length).toBe(2);
  });

  it("declares editor capabilities required by the VS Code extension", () => {
    const stub = createConnectionStub();
    const server = createSearchLintLanguageServer(stub.connection);

    expect(server.initializeResult.capabilities.hoverProvider).toBe(true);
    expect(
      server.initializeResult.capabilities.completionProvider
    ).toBeTruthy();
    expect(
      server.initializeResult.capabilities.documentFormattingProvider
    ).toBe(true);
    expect(server.initializeResult.capabilities.codeActionProvider).toBe(true);
    expect(server.initializeResult.capabilities.definitionProvider).toBe(true);
    expect(server.initializeResult.capabilities.referencesProvider).toBe(true);
    expect(server.initializeResult.capabilities.renameProvider).toBe(true);
  });

  it("registers definition, references, and rename handlers", () => {
    const stub = createConnectionStub();
    createSearchLintLanguageServer(stub.connection);

    expect(stub.handlers.definition).toBeTypeOf("function");
    expect(stub.handlers.references).toBeTypeOf("function");
    expect(stub.handlers.rename).toBeTypeOf("function");
  });

  it("invalidates one document without disturbing other open documents", async () => {
    const stub = createConnectionStub();
    const server = createSearchLintLanguageServer(stub.connection);

    await server.openDocument({
      uri: "file:///valid.searchlint.seo",
      languageId: "searchlint-seo",
      version: 1,
      text: `language 1
site "https://example.com"
`
    });
    await server.openDocument({
      uri: "file:///invalid.searchlint.seo",
      languageId: "searchlint-seo",
      version: 1,
      text: `site "https://example.com"
`
    });

    expect(
      server.getDocumentDiagnostics("file:///valid.searchlint.seo")
    ).toEqual([]);
    expect(
      server.getDocumentDiagnostics("file:///invalid.searchlint.seo")
    ).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "SLANG206" })])
    );

    await server.changeDocument("file:///invalid.searchlint.seo", 2, [
      {
        text: `language 1
site "https://example.com"
`
      }
    ]);

    expect(
      server.getDocumentDiagnostics("file:///valid.searchlint.seo")
    ).toEqual([]);
    expect(
      server.getDocumentDiagnostics("file:///invalid.searchlint.seo")
    ).toEqual([]);
    expect(stub.diagnostics).toHaveLength(3);
  });

  it("clears stale diagnostics when a document is closed", async () => {
    const stub = createConnectionStub();
    const server = createSearchLintLanguageServer(stub.connection);
    const uri = "file:///closed.searchlint.seo";

    await server.openDocument({
      uri,
      languageId: "searchlint-seo",
      version: 1,
      text: `site "https://example.com"
`
    });

    expect(server.getDocumentDiagnostics(uri)).not.toEqual([]);
    server.closeDocument(uri);

    expect(server.getDocumentDiagnostics(uri)).toEqual([]);
    expect(server.getDocumentText(uri)).toBeUndefined();
    expect(stub.diagnostics.at(-1)).toEqual({ uri, diagnostics: [] });
  });
});
