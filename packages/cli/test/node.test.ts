import { describe, expect, it } from "vitest";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createNodeCliIo,
  listProjectFiles,
  runSearchLintNodeCli
} from "../src/node.js";
import type { CliIo } from "../src/index.js";

describe("createNodeCliIo", () => {
  it("exposes a UTF-8 file reader", () => {
    const io = createNodeCliIo();

    expect(typeof io.readText).toBe("function");
    expect(typeof io.exists).toBe("function");
    expect(typeof io.listFiles).toBe("function");
    expect(typeof io.fetchUrl).toBe("function");
  });
});

describe("listProjectFiles", () => {
  it("lists files in stable order and skips ignored directories", async () => {
    const root = await mkdtemp(join(tmpdir(), "searchlint-next-root-"));
    try {
      await mkdir(join(root, "app", "z"), { recursive: true });
      await mkdir(join(root, "app", "a"), { recursive: true });
      await mkdir(join(root, ".next", "server"), { recursive: true });
      await mkdir(join(root, "node_modules", "pkg"), { recursive: true });
      await writeFile(join(root, "app", "z", "page.tsx"), "z");
      await writeFile(join(root, "app", "a", "page.tsx"), "a");
      await writeFile(join(root, ".next", "server", "page.js"), "ignored");
      await writeFile(join(root, "node_modules", "pkg", "index.js"), "ignored");

      const files = await listProjectFiles(root);

      expect(files).toEqual([
        join(root, "app", "a", "page.tsx"),
        join(root, "app", "z", "page.tsx")
      ]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("runSearchLintNodeCli", () => {
  it("writes stdout and stores a zero exit code", async () => {
    const processLike = createProcessLike([
      "node",
      "searchlint",
      "--snapshot",
      "snapshot.json",
      "--catalog",
      "catalog.yaml"
    ]);

    const exitCode = await runSearchLintNodeCli(
      processLike,
      createResultIo({
        "snapshot.json": "{}",
        "catalog.yaml": "invalid"
      })
    );

    expect(exitCode).toBe(1);
    expect(processLike.exitCode).toBe(1);
    expect(processLike.stderrOutput).toContain("catalog");
  });

  it("forwards argument validation errors to stderr", async () => {
    const processLike = createProcessLike(["node", "searchlint"]);

    const exitCode = await runSearchLintNodeCli(
      processLike,
      createResultIo({})
    );

    expect(exitCode).toBe(1);
    expect(processLike.exitCode).toBe(1);
    expect(processLike.stdoutOutput).toBe("");
    expect(processLike.stderrOutput).toBe(
      "Missing required --snapshot or --crawl path.\n"
    );
  });
});

function createResultIo(files: Readonly<Record<string, string>>): CliIo {
  return {
    async readText(path: string): Promise<string> {
      const content = files[path];
      if (content === undefined) {
        throw new Error(`Missing test file ${path}`);
      }
      return content;
    }
  };
}

function createProcessLike(argv: readonly string[]) {
  const processLike: {
    argv: readonly string[];
    stdoutOutput: string;
    stderrOutput: string;
    stdout: { write(chunk: string): void };
    stderr: { write(chunk: string): void };
    exitCode: number | undefined;
  } = {
    argv,
    stdoutOutput: "",
    stderrOutput: "",
    stdout: {
      write: (chunk: string) => {
        processLike.stdoutOutput += chunk;
      }
    },
    stderr: {
      write: (chunk: string) => {
        processLike.stderrOutput += chunk;
      }
    },
    exitCode: undefined as number | undefined
  };

  return processLike;
}
