import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, sep } from "node:path";

import { runSearchLintCli, type CliIo } from "./index.js";
import type { CrawlResponse } from "@searchlint/crawler";

export type CliWritable = {
  write(chunk: string): void;
};

export type CliProcessLike = {
  argv: readonly string[];
  stdout: CliWritable;
  stderr: CliWritable;
  exitCode: number | undefined;
};

export function createNodeCliIo(): CliIo {
  return {
    readText(path: string): Promise<string> {
      return readFile(path, "utf8");
    },
    writeText(path: string, content: string): Promise<void> {
      return writeFile(path, content);
    },
    async exists(path: string): Promise<boolean> {
      try {
        await readFile(path, "utf8");
        return true;
      } catch {
        return false;
      }
    },
    listFiles(root: string): Promise<readonly string[]> {
      return listProjectFiles(root);
    },
    async fetchUrl(url: string): Promise<CrawlResponse> {
      const response = await fetch(url);
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });

      return {
        url: response.url,
        statusCode: response.status,
        headers,
        body: await response.text()
      };
    }
  };
}

const ignoredDirectories = new Set([
  ".git",
  ".next",
  "node_modules",
  "dist",
  "build",
  "coverage"
]);

export async function listProjectFiles(
  root: string
): Promise<readonly string[]> {
  const files: string[] = [];
  await walkProject(root, root, files);
  return files.sort((left, right) => left.localeCompare(right));
}

async function walkProject(
  root: string,
  directory: string,
  files: string[]
): Promise<void> {
  const entries = await readdir(directory, { withFileTypes: true });
  const sortedEntries = entries.sort((left, right) =>
    left.name.localeCompare(right.name)
  );

  for (const entry of sortedEntries) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) {
      continue;
    }

    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      await walkProject(root, entryPath, files);
      continue;
    }

    if (entry.isFile()) {
      files.push(normalizePath(entryPath));
    }
  }
}

function normalizePath(path: string): string {
  return sep === "/" ? path : path.split(sep).join("/");
}

export async function runSearchLintNodeCli(
  processLike: CliProcessLike,
  io: CliIo = createNodeCliIo()
): Promise<number> {
  const result = await runSearchLintCli(processLike.argv.slice(2), io);

  if (result.stdout.length > 0) {
    processLike.stdout.write(result.stdout);
  }

  if (result.stderr.length > 0) {
    processLike.stderr.write(`${result.stderr}\n`);
  }

  processLike.exitCode = result.exitCode;
  return result.exitCode;
}
