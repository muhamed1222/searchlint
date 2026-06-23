import {
  CodeActionKind,
  CompletionItemKind,
  DiagnosticSeverity,
  InsertTextFormat,
  TextDocumentSyncKind,
  type CodeAction,
  type CompletionItem,
  type Connection,
  type Diagnostic,
  type Hover,
  type InitializeResult,
  type Location,
  type TextEdit,
  type WorkspaceEdit
} from "vscode-languageserver/node";
import {
  TextDocument,
  type TextDocumentContentChangeEvent
} from "vscode-languageserver-textdocument";

import {
  createSearchLintDocumentCodeActions,
  createSearchLintDocumentCompletions,
  createSearchLintDocumentDefinition,
  createSearchLintDocumentDiagnostics,
  createSearchLintDocumentHover,
  createSearchLintDocumentReferences,
  createSearchLintDocumentRenameEdit,
  formatSearchLintDocumentText,
  type LspRange,
  type SearchLintCodeAction,
  type SearchLintCompletionItem,
  type SearchLintLspDiagnostic,
  type SearchLintRenameEdit,
  type SearchLintRuleCatalogProvider
} from "@searchlint/lsp";

type TextDocumentItem = {
  uri: string;
  languageId: string;
  version: number;
  text: string;
};

export type SearchLintLanguageServerOptions = {
  catalog?: SearchLintRuleCatalogProvider;
};

export type SearchLintLanguageServer = {
  initializeResult: InitializeResult;
  openDocument(document: TextDocumentItem): Promise<void>;
  changeDocument(
    uri: string,
    version: number,
    changes: readonly TextDocumentContentChangeEvent[]
  ): Promise<void>;
  closeDocument(uri: string): void;
  getDocumentDiagnostics(uri: string): readonly SearchLintLspDiagnostic[];
  getDocumentText(uri: string): string | undefined;
};

const searchLintLanguageId = "searchlint-seo";

export function createSearchLintLanguageServer(
  connection: Connection,
  options: SearchLintLanguageServerOptions = {}
): SearchLintLanguageServer {
  const documents = new Map<string, TextDocument>();
  const diagnosticsByUri = new Map<
    string,
    readonly SearchLintLspDiagnostic[]
  >();

  const initializeResult: InitializeResult = {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      hoverProvider: true,
      completionProvider: {
        triggerCharacters: [" ", "-", "S", "s"]
      },
      documentFormattingProvider: true,
      codeActionProvider: true,
      definitionProvider: true,
      referencesProvider: true,
      renameProvider: true
    }
  };

  async function publishDiagnostics(document: TextDocument): Promise<void> {
    const result = createSearchLintDocumentDiagnostics(document.getText());
    diagnosticsByUri.set(document.uri, result.diagnostics);
    connection.sendDiagnostics({
      uri: document.uri,
      diagnostics: result.diagnostics.map(toProtocolDiagnostic)
    });
  }

  async function openDocument(document: TextDocumentItem): Promise<void> {
    const textDocument = TextDocument.create(
      document.uri,
      document.languageId || searchLintLanguageId,
      document.version,
      document.text
    );
    documents.set(document.uri, textDocument);
    await publishDiagnostics(textDocument);
  }

  async function changeDocument(
    uri: string,
    version: number,
    changes: readonly TextDocumentContentChangeEvent[]
  ): Promise<void> {
    const current = documents.get(uri);
    if (!current) {
      return;
    }

    const updated = TextDocument.update(current, [...changes], version);
    documents.set(uri, updated);
    await publishDiagnostics(updated);
  }

  function closeDocument(uri: string): void {
    documents.delete(uri);
    diagnosticsByUri.delete(uri);
    connection.sendDiagnostics({ uri, diagnostics: [] });
  }

  connection.onInitialize(() => initializeResult);
  connection.onDidOpenTextDocument(async ({ textDocument }) => {
    await openDocument(textDocument);
  });
  connection.onDidChangeTextDocument(
    async ({ textDocument, contentChanges }) => {
      await changeDocument(
        textDocument.uri,
        textDocument.version,
        contentChanges
      );
    }
  );
  connection.onDidCloseTextDocument(({ textDocument }) => {
    closeDocument(textDocument.uri);
  });
  connection.onHover(({ textDocument, position }): Hover | undefined => {
    const document = documents.get(textDocument.uri);
    if (!document) {
      return undefined;
    }

    const hover = createSearchLintDocumentHover(
      document.getText(),
      position,
      options.catalog
    );
    if (!hover) {
      return undefined;
    }

    return {
      contents: {
        kind: "markdown",
        value: hover.contents
      },
      ...(hover.range ? { range: hover.range } : {})
    };
  });
  connection.onCompletion((): CompletionItem[] =>
    createSearchLintDocumentCompletions(options.catalog).map(toCompletionItem)
  );
  connection.onDocumentFormatting(({ textDocument }): TextEdit[] => {
    const document = documents.get(textDocument.uri);
    if (!document) {
      return [];
    }

    return [
      {
        range: {
          start: document.positionAt(0),
          end: document.positionAt(document.getText().length)
        },
        newText: formatSearchLintDocumentText(document.getText())
      }
    ];
  });
  connection.onCodeAction(({ textDocument }): CodeAction[] => {
    const document = documents.get(textDocument.uri);
    if (!document) {
      return [];
    }

    return createSearchLintDocumentCodeActions(
      textDocument.uri,
      document.getText(),
      diagnosticsByUri.get(textDocument.uri) ?? []
    ).map(toCodeAction);
  });
  connection.onDefinition(({ textDocument, position }): Location[] => {
    const document = documents.get(textDocument.uri);
    if (!document) {
      return [];
    }
    const definition = createSearchLintDocumentDefinition(
      textDocument.uri,
      document.getText(),
      position
    );
    return definition ? [definition] : [];
  });
  connection.onReferences(({ textDocument, position, context }): Location[] => {
    const document = documents.get(textDocument.uri);
    if (!document) {
      return [];
    }
    return [
      ...createSearchLintDocumentReferences(
        textDocument.uri,
        document.getText(),
        position,
        context.includeDeclaration
      )
    ];
  });
  connection.onRenameRequest(({ textDocument, position, newName }) => {
    const document = documents.get(textDocument.uri);
    if (!document) {
      return null;
    }
    const edit =
      createSearchLintDocumentRenameEdit(
        textDocument.uri,
        document.getText(),
        position,
        newName
      ) ?? null;
    return edit ? toProtocolWorkspaceEdit(edit) : null;
  });

  return {
    initializeResult,
    openDocument,
    changeDocument,
    closeDocument,
    getDocumentDiagnostics(uri) {
      return diagnosticsByUri.get(uri) ?? [];
    },
    getDocumentText(uri) {
      return documents.get(uri)?.getText();
    }
  };
}

function toProtocolDiagnostic(diagnostic: SearchLintLspDiagnostic): Diagnostic {
  return {
    range: diagnostic.range,
    severity: DiagnosticSeverity.Error,
    code: diagnostic.code,
    source: diagnostic.source,
    message: diagnostic.message,
    data: diagnostic.data
  };
}

function toCompletionItem(item: SearchLintCompletionItem): CompletionItem {
  return {
    label: item.label,
    kind: toCompletionItemKind(item.kind),
    detail: item.detail,
    ...(item.documentation ? { documentation: item.documentation } : {}),
    ...(item.insertText
      ? {
          insertText: item.insertText,
          insertTextFormat: InsertTextFormat.PlainText
        }
      : {})
  };
}

function toCompletionItemKind(
  kind: SearchLintCompletionItem["kind"]
): CompletionItemKind {
  if (kind === "keyword") {
    return CompletionItemKind.Keyword;
  }

  if (kind === "enum") {
    return CompletionItemKind.EnumMember;
  }

  return CompletionItemKind.Reference;
}

function toCodeAction(action: SearchLintCodeAction): CodeAction {
  return {
    title: action.title,
    kind: CodeActionKind.QuickFix,
    diagnostics: action.diagnostics.map(toProtocolDiagnostic),
    edit: {
      changes: Object.fromEntries(
        Object.entries(action.edit.changes).map(([uri, edits]) => [
          uri,
          edits.map(toProtocolTextEdit)
        ])
      )
    }
  };
}

function toProtocolWorkspaceEdit(edit: SearchLintRenameEdit): WorkspaceEdit {
  return {
    changes: Object.fromEntries(
      Object.entries(edit.changes).map(([uri, edits]) => [
        uri,
        edits.map(toProtocolTextEdit)
      ])
    )
  };
}

function toProtocolTextEdit(edit: {
  range: LspRange;
  newText: string;
}): TextEdit {
  return edit;
}
