import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  configurationSection,
  openOverlayCommand,
  overlayUrlConfigurationKey,
  searchLintLanguageId
} from "../src/extension-contract.js";

describe("SearchLint VS Code extension metadata", () => {
  const packageRoot = fileURLToPath(new URL("..", import.meta.url));

  it("exports stable command, language, and configuration identifiers", () => {
    expect(searchLintLanguageId).toBe("searchlint-seo");
    expect(openOverlayCommand).toBe("searchlint.openOverlay");
    expect(configurationSection).toBe("searchlint");
    expect(overlayUrlConfigurationKey).toBe("overlayUrl");
  });

  it("declares local release metadata without telemetry claims", () => {
    const manifest = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8")
    ) as {
      version: string;
      license: string;
      files: string[];
      publisher: string;
      contributes: {
        languages: unknown[];
        commands: unknown[];
      };
    };

    expect(manifest.version).toBe("1.0.0-beta.0");
    expect(manifest.publisher).toBe("searchlint");
    expect(manifest.license).toBe("Apache-2.0");
    expect(manifest.files).toEqual(
      expect.arrayContaining(["README.md", "CHANGELOG.md", "PRIVACY.md"])
    );
    expect(manifest.contributes.languages).toHaveLength(1);
    expect(manifest.contributes.commands).toHaveLength(1);

    const privacy = readFileSync(
      new URL("../PRIVACY.md", import.meta.url),
      "utf8"
    );
    expect(privacy).toContain("does not include telemetry");
    expect(packageRoot).toContain("apps/vscode");
  });
});
