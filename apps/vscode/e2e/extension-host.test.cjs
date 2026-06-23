const assert = require("node:assert/strict");
const vscode = require("vscode");

async function run() {
  const document = await vscode.workspace.openTextDocument({
    language: "searchlint-seo",
    content:
      'language 1\nsite "https://example.com"\nroute "/" {\n  indexable true\n}\n'
  });
  await vscode.window.showTextDocument(document);

  const extension = vscode.extensions.all.find(
    (item) => item.packageJSON?.name === "searchlint-vscode"
  );
  assert.ok(extension, "SearchLint extension must be visible to VS Code.");

  await extension.activate();
  assert.equal(extension.isActive, true, "SearchLint extension must activate.");

  const commands = await vscode.commands.getCommands(true);
  assert.ok(
    commands.includes("searchlint.openOverlay"),
    "SearchLint overlay command must be registered."
  );

  await vscode.workspace
    .getConfiguration("searchlint")
    .update("overlayUrl", "http://127.0.0.1:65535", true);
  await vscode.commands.executeCommand("searchlint.openOverlay");

  assert.equal(
    document.languageId,
    "searchlint-seo",
    "searchlint.seo document must keep the contributed language id."
  );
}

module.exports = { run };
