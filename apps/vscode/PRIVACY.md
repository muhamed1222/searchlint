# Privacy

SearchLint for VS Code is a local developer extension.

- The extension does not include telemetry.
- The extension does not send `searchlint.seo` contents to SearchLint servers.
- The extension starts the local SearchLint language server from the extension
  package.
- The overlay command opens only the URL configured by the user in
  `searchlint.overlayUrl`.

Future hosted SearchLint Cloud features must document separate privacy behavior
before release.
