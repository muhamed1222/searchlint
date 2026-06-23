declare module "node:fs/promises" {
  export type Dirent = {
    name: string;
    isDirectory(): boolean;
    isFile(): boolean;
  };

  export function mkdir(
    path: string,
    options?: { recursive?: boolean }
  ): Promise<void>;
  export function mkdtemp(prefix: string): Promise<string>;
  export function readdir(
    path: string,
    options: { withFileTypes: true }
  ): Promise<Dirent[]>;
  export function readFile(path: string, encoding: "utf8"): Promise<string>;
  export function rm(
    path: string,
    options?: { recursive?: boolean; force?: boolean }
  ): Promise<void>;
  export function writeFile(path: string, content: string): Promise<void>;
}

declare module "node:os" {
  export function tmpdir(): string;
}

declare module "node:path" {
  export const sep: string;
  export function join(...segments: string[]): string;
}

declare module "node:process" {
  export const argv: string[];
  export let exitCode: number | undefined;
  export const stdout: {
    write(chunk: string): void;
  };
  export const stderr: {
    write(chunk: string): void;
  };
}

declare const URL: {
  new (url: string): {
    pathname: string;
  };
};

declare function fetch(url: string): Promise<{
  status: number;
  url: string;
  headers: {
    forEach(callback: (value: string, key: string) => void): void;
  };
  text(): Promise<string>;
}>;
