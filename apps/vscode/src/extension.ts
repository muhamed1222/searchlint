import path from "node:path";

import * as vscode from "vscode";
import {
  LanguageClient,
  TransportKind,
  type LanguageClientOptions,
  type ServerOptions
} from "vscode-languageclient/node";

import {
  configurationSection,
  openOverlayCommand,
  overlayUrlConfigurationKey,
  searchLintLanguageId
} from "./extension-contract.js";

type ExtensionRuntime = {
  client: LanguageClient;
};

export async function activate(
  context: vscode.ExtensionContext
): Promise<ExtensionRuntime> {
  const client = createLanguageClient(context);
  context.subscriptions.push(
    client,
    vscode.commands.registerCommand(openOverlayCommand, async () => {
      await openConfiguredOverlay();
    })
  );

  await client.start();
  return { client };
}

export async function deactivate(): Promise<void> {
  return undefined;
}

export function createLanguageClient(
  context: vscode.ExtensionContext
): LanguageClient {
  const serverModule = context.asAbsolutePath(
    path.join("dist", "src", "server-node-shim.js")
  );
  const serverOptions: ServerOptions = {
    run: {
      module: serverModule,
      transport: TransportKind.ipc
    },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: {
        execArgv: ["--nolazy", "--inspect=6009"]
      }
    }
  };
  const clientOptions: LanguageClientOptions = {
    documentSelector: [
      {
        scheme: "file",
        language: searchLintLanguageId
      }
    ]
  };

  return new LanguageClient(
    "searchlint",
    "SearchLint Language Server",
    serverOptions,
    clientOptions
  );
}

export async function openConfiguredOverlay(): Promise<void> {
  const overlayUrl = vscode.workspace
    .getConfiguration(configurationSection)
    .get<string>(overlayUrlConfigurationKey, "")
    .trim();

  if (!overlayUrl) {
    await vscode.window.showInformationMessage(
      "SearchLint overlay URL is not configured."
    );
    return;
  }

  await vscode.env.openExternal(vscode.Uri.parse(overlayUrl));
}
