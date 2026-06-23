import {
  crawlSite,
  type CrawlCheckpoint,
  type CrawlOptions,
  type CrawlResponse,
  type CrawlResult,
  type CrawlerFetcher
} from "@searchlint/crawler";
import {
  createCoreCanonicalHreflangRules,
  createCoreHttpAndIndexabilityRules,
  createCoreRobotsSitemapPerformanceRules,
  createCoreStructuralMediaSchemaLinkRules,
  createCoreTitleMetadataRules,
  createRuleCatalogRegistry,
  compareDiagnosticsToBaseline,
  parseRuleCatalogYaml,
  runRuleEngine,
  type BaselineComparisonResult,
  type BaselineEntry,
  type Diagnostic,
  type PageSnapshot,
  type RouteContract,
  type Rule,
  type RuleEngineResult,
  type Severity,
  type SiteGraphSnapshot,
  type SourceCodeFinding,
  type SourceRouteSocialImageSummary
} from "@searchlint/core";
import { createHtmlSnapshotFragment } from "@searchlint/html";
import { createHttpSnapshotFragment } from "@searchlint/http";
import {
  compileSearchLintDocument,
  parseSearchLintDocument,
  type CompiledSearchLintConfig,
  type SemanticDiagnostic
} from "@searchlint/language";
import {
  buildNextRouteMetadataSummaries,
  buildNextRouteModel,
  discoverNextProjectSourceFiles,
  type NextRouteSourceFinding
} from "@searchlint/next";
import { createJUnitReport } from "@searchlint/reporter-junit";
import { createHtmlReport } from "@searchlint/reporter-html";
import {
  createSarifReport,
  stringifySarifReport
} from "@searchlint/reporter-sarif";
import { analyzeNextSourceFiles, type SourceFile } from "@searchlint/source";

export type CliOutputFormat = "json" | "text" | "sarif" | "junit" | "html";
export type CliFailOn = Severity | "none";

type CliSharedOptions = {
  catalogPath: string;
  baselinePath?: string;
  configPath?: string;
  format: CliOutputFormat;
  failOn: CliFailOn;
  now?: string;
};

export type CliSnapshotOptions = CliSharedOptions & {
  mode: "snapshot";
  snapshotPath: string;
  routeContractPath?: string;
  sourceFilePaths?: readonly string[];
  nextProjectFilePaths?: readonly string[];
  nextProjectRoots?: readonly string[];
};

export type CliCrawlRunOptions = CliSharedOptions & {
  mode: "crawl";
  crawl: CrawlOptions;
  checkpointPath?: string;
  resumePath?: string;
};

export type CliOptions = CliSnapshotOptions | CliCrawlRunOptions;

export type CliIo = {
  readText(path: string): Promise<string>;
  writeText?(path: string, content: string): Promise<void>;
  writeTextAtomic?(path: string, content: string): Promise<void>;
  exists?(path: string): Promise<boolean>;
  listFiles?(root: string): Promise<readonly string[]>;
  fetchUrl?(url: string): Promise<CrawlResponse>;
  crawlSignal?: CrawlOptions["signal"];
};

export type CliRunResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
  engineResult?: RuleEngineResult;
  crawlAnalysis?: CrawlAnalysisResult;
  baselineComparison?: BaselineComparisonResult;
};

export type CliCrawlOptions = {
  crawl: CrawlOptions;
  catalogPath: string;
  configPath?: string;
  format: CliOutputFormat;
  failOn: CliFailOn;
  now?: string;
};

export type CrawlAnalysisPageResult = {
  url: string;
  engineResult: RuleEngineResult;
};

export type CrawlAnalysisResult = {
  crawlResult: CrawlResult;
  pageResults: readonly CrawlAnalysisPageResult[];
  diagnostics: readonly Diagnostic[];
  executedRuleIds: readonly string[];
};

type CliParsedCommand =
  | {
      ok: true;
      command: "analysis";
      options: CliOptions;
    }
  | {
      ok: true;
      command: "baseline";
      options: CliOptions;
    }
  | {
      ok: true;
      command: "completion";
      shell: "bash" | "zsh" | "fish";
    }
  | {
      ok: true;
      command: "config-validate";
      configPath?: string;
    }
  | {
      ok: true;
      command: "doctor";
    }
  | {
      ok: true;
      command: "help";
    }
  | {
      ok: true;
      command: "init";
      printConfig: boolean;
      siteUrl?: string;
    }
  | {
      ok: true;
      command: "migrate-config";
      from: number;
      to: number;
      writePath: string;
    }
  | {
      ok: true;
      command: "version";
    }
  | {
      ok: false;
      error: string;
    };

export const searchLintCliVersion = "1.0.0-beta.18";
const searchLintCliPackageRange = "beta";
const searchLintNextPackageRange = "beta";

const severityRank: Record<Severity, number> = {
  blocker: 4,
  error: 3,
  warning: 2,
  info: 1
};

export async function runSearchLintCli(
  args: readonly string[],
  io: CliIo
): Promise<CliRunResult> {
  const parsed = parseCliCommand(args);
  if (!parsed.ok) {
    return {
      exitCode: 1,
      stdout: "",
      stderr: parsed.error
    };
  }

  try {
    if (parsed.command === "help") {
      return {
        exitCode: 0,
        stdout: usageText(),
        stderr: ""
      };
    }

    if (parsed.command === "version") {
      return {
        exitCode: 0,
        stdout: `searchlint ${searchLintCliVersion}\n`,
        stderr: ""
      };
    }

    if (parsed.command === "doctor") {
      return {
        exitCode: 0,
        stdout: await doctorText(io),
        stderr: ""
      };
    }

    if (parsed.command === "completion") {
      return {
        exitCode: 0,
        stdout: completionScript(parsed.shell),
        stderr: ""
      };
    }

    if (parsed.command === "init") {
      if (parsed.printConfig) {
        return {
          exitCode: 0,
          stdout: defaultConfigTemplate(parsed.siteUrl),
          stderr: ""
        };
      }
      return await initializeLocalProject(io, parsed.siteUrl);
    }

    if (parsed.command === "config-validate") {
      const configPath = parsed.configPath ?? (await resolveConfigPath({}, io));
      if (configPath === undefined) {
        throw new Error("Missing --config path and no searchlint.seo found.");
      }
      compileSearchLintConfig(await io.readText(configPath), configPath);
      return {
        exitCode: 0,
        stdout: `${configPath} is valid.\n`,
        stderr: ""
      };
    }

    if (parsed.command === "migrate-config") {
      return await migrateConfig(parsed, io);
    }

    if (parsed.command === "baseline") {
      if (parsed.options.mode === "crawl") {
        const result = await analyzeCrawl(
          parsed.options,
          io,
          assertCliFetcher(io, "baseline")
        );

        return {
          exitCode: 0,
          stdout: formatBaselineEntries(result.diagnostics),
          stderr: "",
          crawlAnalysis: result
        };
      }

      const result = await analyzeSnapshot(parsed.options, io);

      return {
        exitCode: 0,
        stdout: formatBaselineEntries(result.diagnostics),
        stderr: "",
        engineResult: result
      };
    }

    if (parsed.options.mode === "crawl") {
      if (!io.fetchUrl) {
        throw new Error("--crawl requires CliIo.fetchUrl.");
      }

      const crawlOptions = await prepareCrawlRunOptions(parsed.options, io);
      const crawlAnalysis = await analyzeCrawl(
        crawlOptions,
        io,
        createIoFetcher(io)
      );
      await writeCrawlCheckpointIfInterrupted(crawlOptions, crawlAnalysis, io);
      const baselineComparison =
        crawlOptions.baselinePath === undefined
          ? undefined
          : compareDiagnosticsToBaseline(
              crawlAnalysis.diagnostics,
              await loadBaselineEntries(crawlOptions.baselinePath, io)
            );
      const diagnosticsForFailure =
        baselineComparison?.newDiagnostics ?? crawlAnalysis.diagnostics;

      return {
        exitCode: shouldFail(diagnosticsForFailure, crawlOptions.failOn)
          ? 2
          : 0,
        stdout: formatCrawlAnalysisResult(crawlAnalysis, crawlOptions.format),
        stderr: "",
        crawlAnalysis,
        ...(baselineComparison === undefined ? {} : { baselineComparison })
      };
    }

    const result = await analyzeSnapshot(parsed.options, io);
    const baselineComparison =
      parsed.options.baselinePath === undefined
        ? undefined
        : compareDiagnosticsToBaseline(
            result.diagnostics,
            await loadBaselineEntries(parsed.options.baselinePath, io)
          );
    const diagnosticsForFailure =
      baselineComparison?.newDiagnostics ?? result.diagnostics;
    return {
      exitCode: shouldFail(diagnosticsForFailure, parsed.options.failOn)
        ? 2
        : 0,
      stdout: formatEngineResult(result, parsed.options.format),
      stderr: "",
      engineResult: result,
      ...(baselineComparison === undefined ? {} : { baselineComparison })
    };
  } catch (error) {
    return {
      exitCode: 1,
      stdout: "",
      stderr: error instanceof Error ? error.message : String(error)
    };
  }
}

function assertCliFetcher(io: CliIo, command: string): CrawlerFetcher {
  if (!io.fetchUrl) {
    throw new Error(
      `searchlint ${command} requires CliIo.fetchUrl in crawl mode.`
    );
  }

  return createIoFetcher(io);
}

export async function analyzeSnapshot(
  options: CliSnapshotOptions,
  io: CliIo
): Promise<RuleEngineResult> {
  const configPath = await resolveConfigPath(options, io);
  const [catalogText, snapshotText, configText, routeContractText] =
    await Promise.all([
      io.readText(options.catalogPath),
      io.readText(options.snapshotPath),
      configPath ? io.readText(configPath) : Promise.resolve(undefined),
      options.routeContractPath
        ? io.readText(options.routeContractPath)
        : Promise.resolve(undefined)
    ]);

  const registry = createRuleCatalogRegistry(parseRuleCatalogYaml(catalogText));
  const compiledConfig =
    configText === undefined
      ? undefined
      : compileSearchLintConfig(configText, configPath!);
  const snapshot = await enrichSnapshotWithSourceFiles(
    parseJsonObject<PageSnapshot>(snapshotText, options.snapshotPath),
    options.sourceFilePaths ?? [],
    options.nextProjectFilePaths ?? [],
    options.nextProjectRoots ?? [],
    io
  );
  const routeContracts =
    routeContractText === undefined
      ? compiledConfig?.routeContracts
      : parseRouteContracts(routeContractText, options.routeContractPath!);

  const engineInput = {
    rules: createLocalCoreRules(registry),
    snapshot,
    ...(compiledConfig?.siteUrl === undefined
      ? {}
      : { siteUrl: compiledConfig.siteUrl })
  };
  const input =
    routeContracts === undefined
      ? engineInput
      : { ...engineInput, routeContracts };

  const engineOptions = {
    ...(options.now === undefined ? {} : { now: options.now }),
    ...(compiledConfig?.suppressions === undefined
      ? {}
      : { suppressions: compiledConfig.suppressions })
  };

  return runRuleEngine(
    Object.keys(engineOptions).length === 0
      ? input
      : { ...input, options: engineOptions }
  );
}

function createIoFetcher(io: CliIo): CrawlerFetcher {
  return {
    fetch(url: string): Promise<CrawlResponse> {
      if (!io.fetchUrl) {
        throw new Error("--crawl requires CliIo.fetchUrl.");
      }
      return io.fetchUrl(url);
    }
  };
}

async function resolveConfigPath(
  options: { configPath?: string },
  io: CliIo
): Promise<string | undefined> {
  if (options.configPath !== undefined) {
    return options.configPath;
  }
  if (!io.exists) {
    return undefined;
  }

  return (await io.exists("searchlint.seo")) ? "searchlint.seo" : undefined;
}

export async function analyzeCrawl(
  options: CliCrawlOptions,
  io: CliIo,
  fetcher: CrawlerFetcher
): Promise<CrawlAnalysisResult> {
  const configPath = await resolveConfigPath(options, io);
  const [catalogText, configText] = await Promise.all([
    io.readText(options.catalogPath),
    configPath ? io.readText(configPath) : Promise.resolve(undefined)
  ]);
  const registry = createRuleCatalogRegistry(parseRuleCatalogYaml(catalogText));
  const compiledConfig =
    configText === undefined
      ? undefined
      : compileSearchLintConfig(configText, configPath!);
  const observedAt = options.now ?? new Date().toISOString();
  const rules = createLocalCoreRules(registry);
  const crawlResult = await crawlSite(options.crawl, fetcher);
  const siteGraph = createSiteGraphFromCrawl(crawlResult);
  const pageResults: CrawlAnalysisPageResult[] = [];

  for (const page of crawlResult.pages) {
    const snapshot = createSnapshotFromCrawledPage(
      page,
      observedAt,
      crawlResult.robotsTxt,
      crawlResult.sitemap,
      siteGraph
    );
    const engineResult = await runRuleEngine({
      rules,
      snapshot,
      ...(compiledConfig?.siteUrl === undefined
        ? {}
        : { siteUrl: compiledConfig.siteUrl }),
      ...(compiledConfig?.routeContracts === undefined
        ? {}
        : { routeContracts: compiledConfig.routeContracts }),
      options: {
        now: observedAt,
        ...(compiledConfig?.suppressions === undefined
          ? {}
          : { suppressions: compiledConfig.suppressions })
      }
    });
    pageResults.push({ url: page.url, engineResult });
  }

  return {
    crawlResult,
    pageResults,
    diagnostics: pageResults.flatMap((page) => page.engineResult.diagnostics),
    executedRuleIds: uniqueStable(
      pageResults.flatMap((page) => page.engineResult.executedRuleIds)
    )
  };
}

async function prepareCrawlRunOptions(
  options: CliCrawlRunOptions,
  io: CliIo
): Promise<CliCrawlRunOptions> {
  const resumeFrom =
    options.resumePath === undefined
      ? undefined
      : parseJsonObject<CrawlCheckpoint>(
          await io.readText(options.resumePath),
          options.resumePath
        );
  const crawl = {
    ...options.crawl,
    ...(resumeFrom === undefined ? {} : { resumeFrom }),
    ...(io.crawlSignal === undefined ? {} : { signal: io.crawlSignal })
  };

  return { ...options, crawl };
}

async function writeCrawlCheckpointIfInterrupted(
  options: CliCrawlRunOptions,
  analysis: CrawlAnalysisResult,
  io: CliIo
): Promise<void> {
  if (options.checkpointPath === undefined) {
    return;
  }
  const recovery = analysis.crawlResult.recovery;
  if (recovery?.interrupted !== true) {
    return;
  }
  const write = io.writeTextAtomic ?? io.writeText;
  if (!write) {
    throw new Error(
      "--checkpoint requires CliIo.writeText or writeTextAtomic."
    );
  }
  await write(
    options.checkpointPath,
    `${JSON.stringify(recovery.checkpoint, null, 2)}\n`
  );
}

export function parseCliArgs(args: readonly string[]):
  | {
      ok: true;
      options: CliOptions;
    }
  | {
      ok: false;
      error: string;
    } {
  const values = new Map<string, string>();
  const repeatedValues = new Map<string, string[]>();
  const flagsWithValues = new Set([
    "--snapshot",
    "--crawl",
    "--catalog",
    "--baseline",
    "--config",
    "--route-contract",
    "--source-file",
    "--next-project-file",
    "--next-project-root",
    "--max-urls",
    "--max-depth",
    "--max-links-per-page",
    "--max-query-variants-per-path",
    "--max-response-bytes",
    "--max-redirects",
    "--retry-attempts",
    "--request-timeout-ms",
    "--allow-private-networks",
    "--same-origin",
    "--respect-robots",
    "--user-agent",
    "--checkpoint",
    "--resume",
    "--format",
    "--fail-on",
    "--now"
  ]);

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg) {
      continue;
    }

    if (!flagsWithValues.has(arg)) {
      return { ok: false, error: `Unknown argument '${arg}'.` };
    }

    const value = args[index + 1];
    if (!value || value.startsWith("--")) {
      return { ok: false, error: `Missing value for '${arg}'.` };
    }

    if (
      arg === "--source-file" ||
      arg === "--next-project-file" ||
      arg === "--next-project-root"
    ) {
      const valuesForArg = repeatedValues.get(arg) ?? [];
      valuesForArg.push(value);
      repeatedValues.set(arg, valuesForArg);
    } else {
      values.set(arg, value);
    }
    index += 1;
  }

  const snapshotPath = values.get("--snapshot");
  const crawlUrl = values.get("--crawl");
  const catalogPath = values.get("--catalog");
  if (!snapshotPath && !crawlUrl) {
    return { ok: false, error: "Missing required --snapshot or --crawl path." };
  }
  if (snapshotPath && crawlUrl) {
    return { ok: false, error: "Use either --snapshot or --crawl, not both." };
  }
  if (!catalogPath) {
    return { ok: false, error: "Missing required --catalog path." };
  }

  const format = parseFormat(values.get("--format") ?? "text");
  if (!format) {
    return {
      ok: false,
      error: "Invalid --format. Use json, text, sarif, junit, or html."
    };
  }

  const failOn = parseFailOn(values.get("--fail-on") ?? "error");
  if (!failOn) {
    return {
      ok: false,
      error: "Invalid --fail-on. Use blocker, error, warning, info, or none."
    };
  }

  const options: CliOptions = snapshotPath
    ? {
        mode: "snapshot",
        snapshotPath,
        catalogPath,
        format,
        failOn
      }
    : {
        mode: "crawl",
        catalogPath,
        format,
        failOn,
        crawl: {
          startUrl: crawlUrl!
        }
      };
  const baselinePath = values.get("--baseline");
  if (baselinePath !== undefined) {
    options.baselinePath = baselinePath;
  }
  const configPath = values.get("--config");
  if (configPath !== undefined) {
    options.configPath = configPath;
  }
  const routeContractPath = values.get("--route-contract");
  if (routeContractPath !== undefined) {
    if (options.mode === "crawl") {
      return {
        ok: false,
        error: "--route-contract is only supported in snapshot mode."
      };
    }
    options.routeContractPath = routeContractPath;
  }
  const sourceFilePaths = repeatedValues.get("--source-file");
  if (sourceFilePaths !== undefined) {
    if (options.mode === "crawl") {
      return {
        ok: false,
        error: "--source-file is only supported in snapshot mode."
      };
    }
    options.sourceFilePaths = sourceFilePaths;
  }
  const nextProjectFilePaths = repeatedValues.get("--next-project-file");
  if (nextProjectFilePaths !== undefined) {
    if (options.mode === "crawl") {
      return {
        ok: false,
        error: "--next-project-file is only supported in snapshot mode."
      };
    }
    options.nextProjectFilePaths = nextProjectFilePaths;
  }
  const nextProjectRoots = repeatedValues.get("--next-project-root");
  if (nextProjectRoots !== undefined) {
    if (options.mode === "crawl") {
      return {
        ok: false,
        error: "--next-project-root is only supported in snapshot mode."
      };
    }
    options.nextProjectRoots = nextProjectRoots;
  }
  const maxUrls = values.get("--max-urls");
  if (maxUrls !== undefined) {
    if (options.mode === "snapshot") {
      return {
        ok: false,
        error: "--max-urls is only supported in crawl mode."
      };
    }
    const parsedMaxUrls = Number(maxUrls);
    if (!Number.isInteger(parsedMaxUrls) || parsedMaxUrls < 1) {
      return { ok: false, error: "--max-urls must be a positive integer." };
    }
    options.crawl.maxUrls = parsedMaxUrls;
  }
  const positiveIntegerCrawlOptions = [
    ["--max-depth", "maxDepth"],
    ["--max-links-per-page", "maxLinksPerPage"],
    ["--max-query-variants-per-path", "maxQueryVariantsPerPath"],
    ["--max-response-bytes", "maxResponseBytes"],
    ["--max-redirects", "maxRedirects"],
    ["--request-timeout-ms", "requestTimeoutMs"]
  ] as const;
  for (const [flag, optionName] of positiveIntegerCrawlOptions) {
    const value = values.get(flag);
    if (value === undefined) {
      continue;
    }
    if (options.mode === "snapshot") {
      return {
        ok: false,
        error: `${flag} is only supported in crawl mode.`
      };
    }
    const parsedValue = Number(value);
    if (!Number.isInteger(parsedValue) || parsedValue < 1) {
      return { ok: false, error: `${flag} must be a positive integer.` };
    }
    options.crawl[optionName] = parsedValue;
  }
  const retryAttempts = values.get("--retry-attempts");
  if (retryAttempts !== undefined) {
    if (options.mode === "snapshot") {
      return {
        ok: false,
        error: "--retry-attempts is only supported in crawl mode."
      };
    }
    const parsedRetryAttempts = Number(retryAttempts);
    if (!Number.isInteger(parsedRetryAttempts) || parsedRetryAttempts < 0) {
      return {
        ok: false,
        error: "--retry-attempts must be a non-negative integer."
      };
    }
    options.crawl.retryAttempts = parsedRetryAttempts;
  }
  const allowPrivateNetworks = values.get("--allow-private-networks");
  if (allowPrivateNetworks !== undefined) {
    if (options.mode === "snapshot") {
      return {
        ok: false,
        error: "--allow-private-networks is only supported in crawl mode."
      };
    }
    const parsedAllowPrivateNetworks = parseBoolean(allowPrivateNetworks);
    if (parsedAllowPrivateNetworks === undefined) {
      return {
        ok: false,
        error: "--allow-private-networks must be true or false."
      };
    }
    options.crawl.allowPrivateNetworks = parsedAllowPrivateNetworks;
  }
  const sameOrigin = values.get("--same-origin");
  if (sameOrigin !== undefined) {
    if (options.mode === "snapshot") {
      return {
        ok: false,
        error: "--same-origin is only supported in crawl mode."
      };
    }
    const parsedSameOrigin = parseBoolean(sameOrigin);
    if (parsedSameOrigin === undefined) {
      return { ok: false, error: "--same-origin must be true or false." };
    }
    options.crawl.sameOrigin = parsedSameOrigin;
  }
  const respectRobots = values.get("--respect-robots");
  if (respectRobots !== undefined) {
    if (options.mode === "snapshot") {
      return {
        ok: false,
        error: "--respect-robots is only supported in crawl mode."
      };
    }
    const parsedRespectRobots = parseBoolean(respectRobots);
    if (parsedRespectRobots === undefined) {
      return { ok: false, error: "--respect-robots must be true or false." };
    }
    options.crawl.respectRobotsTxt = parsedRespectRobots;
  }
  const userAgent = values.get("--user-agent");
  if (userAgent !== undefined) {
    if (options.mode === "snapshot") {
      return {
        ok: false,
        error: "--user-agent is only supported in crawl mode."
      };
    }
    options.crawl.userAgent = userAgent;
  }
  const checkpointPath = values.get("--checkpoint");
  if (checkpointPath !== undefined) {
    if (options.mode === "snapshot") {
      return {
        ok: false,
        error: "--checkpoint is only supported in crawl mode."
      };
    }
    options.checkpointPath = checkpointPath;
  }
  const resumePath = values.get("--resume");
  if (resumePath !== undefined) {
    if (options.mode === "snapshot") {
      return {
        ok: false,
        error: "--resume is only supported in crawl mode."
      };
    }
    options.resumePath = resumePath;
  }
  const now = values.get("--now");
  if (now !== undefined) {
    options.now = now;
  }

  return { ok: true, options };
}

function parseCliCommand(args: readonly string[]): CliParsedCommand {
  const command = args[0];
  if (command === "--help" || command === "-h" || command === "help") {
    return { ok: true, command: "help" };
  }

  if (command === "--version" || command === "-v" || command === "version") {
    return { ok: true, command: "version" };
  }

  if (command === "doctor") {
    if (args.length > 1) {
      return {
        ok: false,
        error: "searchlint doctor does not accept arguments."
      };
    }
    return { ok: true, command: "doctor" };
  }

  if (command === "completion") {
    return parseCompletionCommand(args.slice(1));
  }

  if (command === "check") {
    return parseAnalysisCommand(normalizeCommandArgs(args.slice(1)));
  }

  if (command === "crawl") {
    const normalized = normalizeCommandArgs(
      args.slice(1).map((arg) => (arg === "--url" ? "--crawl" : arg))
    );
    return parseAnalysisCommand(normalized);
  }

  if (command === "init") {
    return parseInitCommand(args.slice(1));
  }

  if (command === "config") {
    return parseConfigCommand(args.slice(1));
  }

  if (command === "migrate-config") {
    return parseMigrateConfigCommand(args.slice(1));
  }

  if (command === "baseline") {
    return parseBaselineCommand(args.slice(1));
  }

  if (command && !command.startsWith("--")) {
    return {
      ok: false,
      error: `Unknown command '${command}'. Run searchlint --help.`
    };
  }

  return parseAnalysisCommand(args);
}

function parseAnalysisCommand(args: readonly string[]): CliParsedCommand {
  const parsed = parseCliArgs(args);
  return parsed.ok
    ? { ok: true, command: "analysis", options: parsed.options }
    : parsed;
}

function parseBaselineCommand(args: readonly string[]): CliParsedCommand {
  const normalized = normalizeCommandArgs(args);
  const parsed = parseCliArgs(ensureFlagValue(normalized, "--fail-on", "none"));
  if (!parsed.ok) {
    return parsed;
  }

  return { ok: true, command: "baseline", options: parsed.options };
}

function parseMigrateConfigCommand(args: readonly string[]): CliParsedCommand {
  const values = parseExactFlagValues(
    args,
    new Set(["--from", "--to", "--write"])
  );
  if (!values.ok) {
    return values;
  }

  const from = values.values.get("--from");
  const to = values.values.get("--to");
  const writePath = values.values.get("--write");
  if (from === undefined || to === undefined || writePath === undefined) {
    return {
      ok: false,
      error:
        "Usage: searchlint migrate-config --from 1 --to 1 --write searchlint.seo"
    };
  }

  const fromVersion = parsePositiveInteger(from);
  const toVersion = parsePositiveInteger(to);
  if (fromVersion === undefined || toVersion === undefined) {
    return {
      ok: false,
      error: "--from and --to must be positive integer language versions."
    };
  }

  return {
    ok: true,
    command: "migrate-config",
    from: fromVersion,
    to: toVersion,
    writePath
  };
}

function parseConfigCommand(args: readonly string[]): CliParsedCommand {
  const subcommand = args[0];
  if (subcommand !== "validate") {
    return {
      ok: false,
      error: "Unknown config command. Use searchlint config validate."
    };
  }

  const rest = args.slice(1);
  if (rest.length === 0) {
    return { ok: true, command: "config-validate" };
  }

  if (rest.length === 2 && rest[0] === "--config") {
    const configPath = rest[1];
    if (configPath === undefined) {
      return {
        ok: false,
        error: "Usage: searchlint config validate [--config searchlint.seo]"
      };
    }
    return {
      ok: true,
      command: "config-validate",
      configPath
    };
  }

  return {
    ok: false,
    error: "Usage: searchlint config validate [--config searchlint.seo]"
  };
}

function parseCompletionCommand(args: readonly string[]): CliParsedCommand {
  const shell = args[0];
  if (
    args.length !== 1 ||
    (shell !== "bash" && shell !== "zsh" && shell !== "fish")
  ) {
    return {
      ok: false,
      error: "Usage: searchlint completion <bash|zsh|fish>"
    };
  }

  return {
    ok: true,
    command: "completion",
    shell
  };
}

function parseInitCommand(args: readonly string[]): CliParsedCommand {
  let printConfig = false;
  let siteUrl: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--print-config") {
      if (printConfig) {
        return {
          ok: false,
          error:
            "Usage: searchlint init [--site https://example.com] [--print-config]"
        };
      }
      printConfig = true;
      continue;
    }

    if (arg === "--site") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) {
        return { ok: false, error: "Missing value for '--site'." };
      }
      if (siteUrl !== undefined) {
        return {
          ok: false,
          error:
            "Usage: searchlint init [--site https://example.com] [--print-config]"
        };
      }
      if (!isHttpUrl(value)) {
        return {
          ok: false,
          error: "--site must be an absolute http or https URL."
        };
      }
      siteUrl = value;
      index += 1;
      continue;
    }

    return {
      ok: false,
      error:
        "Usage: searchlint init [--site https://example.com] [--print-config]"
    };
  }

  return {
    ok: true,
    command: "init",
    printConfig,
    ...(siteUrl === undefined ? {} : { siteUrl })
  };
}

function parseExactFlagValues(
  args: readonly string[],
  allowedFlags: ReadonlySet<string>
):
  | {
      ok: true;
      values: Map<string, string>;
    }
  | {
      ok: false;
      error: string;
    } {
  const values = new Map<string, string>();
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg) {
      continue;
    }
    if (!allowedFlags.has(arg)) {
      return { ok: false, error: `Unknown argument '${arg}'.` };
    }

    const value = args[index + 1];
    if (!value || value.startsWith("--")) {
      return { ok: false, error: `Missing value for '${arg}'.` };
    }
    values.set(arg, value);
    index += 1;
  }
  return { ok: true, values };
}

function normalizeCommandArgs(args: readonly string[]): readonly string[] {
  return args.flatMap((arg) => {
    if (arg === "--url") {
      return ["--crawl"];
    }
    return [arg];
  });
}

function ensureFlagValue(
  args: readonly string[],
  flag: string,
  value: string
): readonly string[] {
  return args.includes(flag) ? args : [...args, flag, value];
}

async function enrichSnapshotWithSourceFiles(
  snapshot: PageSnapshot,
  sourceFilePaths: readonly string[],
  nextProjectFilePaths: readonly string[],
  nextProjectRoots: readonly string[],
  io: CliIo
): Promise<PageSnapshot> {
  const rootFilePaths = await listNextProjectRootFiles(nextProjectRoots, io);
  const discovery = discoverNextProjectSourceFiles([
    ...nextProjectFilePaths,
    ...rootFilePaths
  ]);
  const discoveredSourceFilePaths = discovery.sourceFiles.map(
    (file) => file.path
  );
  const allSourceFilePaths = uniqueStable([
    ...sourceFilePaths,
    ...discoveredSourceFilePaths
  ]);

  if (allSourceFilePaths.length === 0) {
    return snapshot;
  }

  const newSourceFiles: SourceFile[] = await Promise.all(
    allSourceFilePaths.map(async (path) => ({
      path,
      content: await io.readText(path)
    }))
  );
  const existingSourceFiles = snapshot.sourceCode?.files ?? [];
  const files = [...existingSourceFiles, ...newSourceFiles];
  const findings = analyzeNextSourceFiles(files).findings;
  const routeSourceFindings = toNextRouteSourceFindings(findings);
  const routeModel = buildNextRouteModel(
    discovery.sourceFiles,
    routeSourceFindings
  );
  const routeMetadata = buildNextRouteMetadataSummaries(
    routeModel,
    routeSourceFindings
  );
  const routeSocialImages = buildRouteSocialImageSummaries(findings);

  return {
    ...snapshot,
    sourceCode: {
      files,
      findings,
      routeMetadata,
      routeSocialImages
    }
  };
}

function buildRouteSocialImageSummaries(
  findings: readonly SourceCodeFinding[]
): readonly SourceRouteSocialImageSummary[] {
  const summaries = new Map<string, SourceRouteSocialImageSummary>();

  for (const finding of findings) {
    if (
      finding.kind !== "opengraph-image-file" &&
      finding.kind !== "twitter-image-file"
    ) {
      continue;
    }

    const key = `${finding.router ?? ""}\u0000${finding.route ?? ""}`;
    const existing = summaries.get(key) ?? {
      ...(finding.route === undefined ? {} : { route: finding.route }),
      ...(finding.router === undefined ? {} : { router: finding.router }),
      openGraphImageFiles: [],
      twitterImageFiles: []
    };

    summaries.set(key, {
      ...existing,
      openGraphImageFiles:
        finding.kind === "opengraph-image-file"
          ? uniqueStable([...existing.openGraphImageFiles, finding.file])
          : existing.openGraphImageFiles,
      twitterImageFiles:
        finding.kind === "twitter-image-file"
          ? uniqueStable([...existing.twitterImageFiles, finding.file])
          : existing.twitterImageFiles
    });
  }

  return [...summaries.values()].sort((left, right) => {
    const routeOrder = (left.route ?? "").localeCompare(right.route ?? "");
    return routeOrder === 0
      ? (left.router ?? "").localeCompare(right.router ?? "")
      : routeOrder;
  });
}

function toNextRouteSourceFindings(
  findings: readonly SourceCodeFinding[]
): readonly NextRouteSourceFinding[] {
  return findings.flatMap((finding) => {
    if (
      finding.kind !== "static-metadata-object" &&
      finding.kind !== "static-metadata-field" &&
      finding.kind !== "generate-metadata"
    ) {
      return [];
    }

    return [
      {
        kind: finding.kind,
        file: finding.file,
        ...(finding.field === undefined ? {} : { field: finding.field })
      }
    ];
  });
}

async function listNextProjectRootFiles(
  roots: readonly string[],
  io: CliIo
): Promise<readonly string[]> {
  if (roots.length === 0) {
    return [];
  }

  if (!io.listFiles) {
    throw new Error("--next-project-root requires CliIo.listFiles.");
  }

  const filesByRoot = await Promise.all(
    roots.map((root) => io.listFiles!(root))
  );
  return filesByRoot.flat();
}

export function formatEngineResult(
  result: RuleEngineResult,
  format: CliOutputFormat
): string {
  if (format === "json") {
    return `${JSON.stringify(result, null, 2)}\n`;
  }

  if (format === "sarif") {
    return stringifySarifReport(createSarifReport(result.diagnostics));
  }

  if (format === "junit") {
    return createJUnitReport(result.diagnostics);
  }

  if (format === "html") {
    return createHtmlReport(result.diagnostics, {
      title: "SearchLint Check Report"
    });
  }

  if (result.diagnostics.length === 0) {
    return `SearchLint found 0 diagnostics. Executed ${result.executedRuleIds.length} rules.\n`;
  }

  return `${result.diagnostics.map(formatDiagnosticLine).join("\n")}\n`;
}

export function shouldFail(
  diagnostics: readonly Diagnostic[],
  failOn: CliFailOn
): boolean {
  if (failOn === "none") {
    return false;
  }

  const threshold = severityRank[failOn];
  return diagnostics.some(
    (diagnostic) => severityRank[diagnostic.severity] >= threshold
  );
}

export function formatCrawlAnalysisResult(
  result: CrawlAnalysisResult,
  format: CliOutputFormat
): string {
  if (format === "json") {
    return `${JSON.stringify(result, null, 2)}\n`;
  }

  if (format === "sarif") {
    return stringifySarifReport(createSarifReport(result.diagnostics));
  }

  if (format === "junit") {
    return createJUnitReport(result.diagnostics);
  }

  if (format === "html") {
    return createHtmlReport(result.diagnostics, {
      title: "SearchLint Crawl Report"
    });
  }

  if (result.diagnostics.length === 0) {
    return `SearchLint crawled ${result.pageResults.length} pages and found 0 diagnostics. Executed ${result.executedRuleIds.length} rules.\n`;
  }

  return `${result.diagnostics.map(formatDiagnosticLine).join("\n")}\n`;
}

export function formatBaselineEntries(
  diagnostics: readonly Diagnostic[]
): string {
  return `${JSON.stringify(
    {
      entries: diagnostics.map((diagnostic) => ({
        fingerprint: diagnostic.fingerprint,
        ruleId: diagnostic.ruleId,
        ...(diagnostic.pageUrl === undefined
          ? {}
          : { pageUrl: diagnostic.pageUrl })
      }))
    },
    null,
    2
  )}\n`;
}

export function usageText(): string {
  return `SearchLint CLI

Usage:
  searchlint check --snapshot <snapshot.json> --catalog <RULE_CATALOG.yaml> [options]
  searchlint crawl --url <https://example.com/> --catalog <RULE_CATALOG.yaml> [options]
  searchlint init
  searchlint init --print-config
  searchlint doctor
  searchlint completion <bash|zsh|fish>
  searchlint --version
  searchlint config validate [--config searchlint.seo]
  searchlint migrate-config --from 1 --to 1 --write searchlint.seo
  searchlint baseline --snapshot <snapshot.json> --catalog <RULE_CATALOG.yaml> [options]

Options:
  --config <path>              SearchLint DSL config path. Defaults to searchlint.seo when present.
  --baseline <path>            Existing baseline JSON used for fail policy.
  --format <text|json|sarif|junit|html>
  --fail-on <blocker|error|warning|info|none>
  --now <iso-date>             Deterministic observation date for time-based evidence.
  --route-contract <path>      Snapshot-only route contract JSON.
  --source-file <path>         Snapshot-only source file, repeatable.
  --next-project-root <path>   Snapshot-only Next.js project root discovery, repeatable.
  --max-urls <number>          Crawl-only URL limit.
  --max-depth <number>         Crawl-only link-depth limit.
  --max-links-per-page <number>
  --max-query-variants-per-path <number>
  --max-response-bytes <number>
  --max-redirects <number>
  --retry-attempts <number>
  --request-timeout-ms <number>
  --allow-private-networks <true|false>
  --checkpoint <path>        Crawl-only recovery checkpoint output on interruption.
  --resume <path>            Crawl-only recovery checkpoint input.
  --same-origin <true|false>   Crawl-only same-origin policy.
  --respect-robots <true|false>
  --user-agent <value>

Exit codes:
  0  Command completed and fail policy did not fail.
  1  Invalid arguments, invalid config, invalid input, or runtime error.
  2  Diagnostics violate --fail-on.
`;
}

async function initializeLocalProject(
  io: CliIo,
  siteUrl?: string
): Promise<CliRunResult> {
  if (io.writeText === undefined || io.exists === undefined) {
    throw new Error(
      "searchlint init requires filesystem write and exists support."
    );
  }

  const packageJsonExists = await io.exists("package.json");
  if (!packageJsonExists) {
    throw new Error(
      "searchlint init must be run from a project root containing package.json."
    );
  }

  const packageJsonText = await io.readText("package.json");
  const packageJson = parsePackageJson(packageJsonText);
  const nextConfigPath = await findNextConfigPath(io);
  const isNextProject =
    nextConfigPath !== undefined || packageUsesDependency(packageJson, "next");
  if (!isNextProject) {
    throw new Error(
      "searchlint init currently supports Next.js projects only. Run it from a project with next in package.json or an existing next.config.js/mjs file."
    );
  }

  const changed: string[] = [];
  const created: string[] = [];
  const resolvedSite = resolveInitSite(siteUrl, packageJson);

  if (!(await io.exists("searchlint.seo"))) {
    await io.writeText("searchlint.seo", defaultConfigTemplate(resolvedSite.url));
    created.push("searchlint.seo");
  }

  const nextConfigResult = await ensureNextConfig(io, nextConfigPath);
  changed.push(...nextConfigResult.changed);
  created.push(...nextConfigResult.created);

  const packageUpdate = ensurePackageOnboarding(packageJson);
  const packageManager = await detectPackageManager(io, packageJson);
  if (packageUpdate.changed) {
    await io.writeText(
      "package.json",
      `${JSON.stringify(packageJson, null, 2)}\n`
    );
    changed.push("package.json");
  }

  const lines = [
    "SearchLint initialized for local Next.js development.",
    "",
    created.length > 0 ? `Created: ${created.join(", ")}` : "Created: none",
    changed.length > 0 ? `Updated: ${changed.join(", ")}` : "Updated: none",
    `Site: ${resolvedSite.url} (${resolvedSite.source})`,
    "",
    "Next step:",
    ...(packageUpdate.addedDependencies.length > 0
      ? [`  ${installCommand(packageManager)}`]
      : []),
    `  ${runScriptCommand(packageManager, "searchlint:verify")}`,
    `  ${runScriptCommand(packageManager, "dev")}`,
    "",
    "Open your local site and click the SearchLint badge to inspect the current page."
  ];

  return {
    exitCode: 0,
    stdout: `${lines.join("\n")}\n`,
    stderr: ""
  };
}

type PackageManager = "npm" | "pnpm" | "yarn";

async function detectPackageManager(
  io: CliIo,
  packageJson: Record<string, unknown>
): Promise<PackageManager> {
  const packageManager = packageJson.packageManager;
  if (typeof packageManager === "string") {
    if (packageManager.startsWith("pnpm@")) {
      return "pnpm";
    }
    if (packageManager.startsWith("yarn@")) {
      return "yarn";
    }
    if (packageManager.startsWith("npm@")) {
      return "npm";
    }
  }

  if ((await io.exists?.("pnpm-lock.yaml")) === true) {
    return "pnpm";
  }
  if ((await io.exists?.("yarn.lock")) === true) {
    return "yarn";
  }
  return "npm";
}

function installCommand(packageManager: PackageManager): string {
  return packageManager === "yarn" ? "yarn install" : `${packageManager} install`;
}

function runScriptCommand(
  packageManager: PackageManager,
  scriptName: string
): string {
  return packageManager === "npm"
    ? `npm run ${scriptName}`
    : `${packageManager} ${scriptName}`;
}

function parsePackageJson(packageJsonText: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(packageJsonText) as unknown;
    if (
      parsed === null ||
      typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {
      throw new Error("package.json root must be an object.");
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    throw new Error(
      `Cannot parse package.json: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

function packageUsesDependency(
  packageJson: Record<string, unknown>,
  dependencyName: string
): boolean {
  return [
    packageJson.dependencies,
    packageJson.devDependencies,
    packageJson.peerDependencies,
    packageJson.optionalDependencies
  ].some(
    (dependencies) =>
      dependencies !== null &&
      typeof dependencies === "object" &&
      !Array.isArray(dependencies) &&
      Object.prototype.hasOwnProperty.call(dependencies, dependencyName)
  );
}

const nextConfigCandidates = [
  "next.config.mjs",
  "next.config.js",
  "next.config.cjs",
  "next.config.ts"
] as const;

async function findNextConfigPath(io: CliIo): Promise<string | undefined> {
  for (const candidate of nextConfigCandidates) {
    if ((await io.exists?.(candidate)) === true) {
      return candidate;
    }
  }
  return undefined;
}

type FileMutationResult = {
  created: string[];
  changed: string[];
};

async function ensureNextConfig(
  io: CliIo,
  nextConfigPath: string | undefined
): Promise<FileMutationResult> {
  if (io.writeText === undefined) {
    throw new Error("searchlint init requires filesystem write support.");
  }

  if (nextConfigPath === undefined) {
    await io.writeText(
      "next.config.mjs",
      `import { withSearchLint } from "@searchlint/next";\n\nconst nextConfig = {};\n\nexport default withSearchLint(nextConfig);\n`
    );
    return { created: ["next.config.mjs"], changed: [] };
  }

  const current = await io.readText(nextConfigPath);
  if (current.includes("withSearchLint(")) {
    return { created: [], changed: [] };
  }

  const patched = patchNextConfig(current, nextConfigPath);
  await io.writeText(nextConfigPath, patched);
  return { created: [], changed: [nextConfigPath] };
}

function patchNextConfig(source: string, filePath: string): string {
  if (filePath.endsWith(".mjs")) {
    return patchEsmNextConfig(source, filePath);
  }
  if (filePath.endsWith(".ts")) {
    return patchEsmNextConfig(source, filePath);
  }
  if (filePath.endsWith(".js")) {
    if (isCommonJsNextConfig(source)) {
      return patchCommonJsNextConfig(source, filePath);
    }
    return patchEsmNextConfig(source, filePath);
  }
  if (filePath.endsWith(".cjs")) {
    return patchCommonJsNextConfig(source, filePath);
  }
  throw new Error(`Unsupported Next.js config file: ${filePath}`);
}

function patchEsmNextConfig(source: string, filePath: string): string {
  const importLine = `import { withSearchLint } from "@searchlint/next";`;
  const withImport = source.includes(importLine)
    ? source
    : `${importLine}\n${source}`;

  const exportDefaultMatch = withImport.match(
    /export\s+default\s+([A-Za-z_$][\w$]*);?/
  );
  if (exportDefaultMatch) {
    const binding = exportDefaultMatch[1];
    return withImport.replace(
      exportDefaultMatch[0],
      `export default withSearchLint(${binding});`
    );
  }

  const inlineObjectMatch = withImport.match(
    /export\s+default\s+({[\s\S]*?});?\s*$/
  );
  if (inlineObjectMatch) {
    return withImport.replace(
      inlineObjectMatch[0],
      `export default withSearchLint(${inlineObjectMatch[1]});\n`
    );
  }

  throw new Error(
    `searchlint init could not safely patch ${filePath}. Expected 'export default nextConfig' or an inline object export.`
  );
}

function patchCommonJsNextConfig(source: string, filePath: string): string {
  const moduleExportMatch = source.match(
    /module\.exports\s*=\s*([A-Za-z_$][\w$]*);?/
  );
  if (moduleExportMatch) {
    const binding = moduleExportMatch[1];
    const withoutExport = source.replace(
      moduleExportMatch[0],
      `const __searchlintNextConfig = ${binding};`
    );
    return `${withoutExport.trimEnd()}\n\nmodule.exports = async (phase, defaults) => {\n  const { withSearchLint } = await import("@searchlint/next");\n  return withSearchLint(__searchlintNextConfig)(phase, defaults);\n};\n`;
  }

  const inlineObjectMatch = source.match(
    /module\.exports\s*=\s*({[\s\S]*?});?\s*$/
  );
  if (inlineObjectMatch) {
    const withoutExport = source.replace(
      inlineObjectMatch[0],
      `const __searchlintNextConfig = ${inlineObjectMatch[1]};\n`
    );
    return `${withoutExport.trimEnd()}\n\nmodule.exports = async (phase, defaults) => {\n  const { withSearchLint } = await import("@searchlint/next");\n  return withSearchLint(__searchlintNextConfig)(phase, defaults);\n};\n`;
  }

  throw new Error(
    `searchlint init could not safely patch ${filePath}. Expected 'module.exports = nextConfig' or an inline object export.`
  );
}

function isCommonJsNextConfig(source: string): boolean {
  return source.includes("module.exports") || source.includes("require(");
}

function ensurePackageOnboarding(packageJson: Record<string, unknown>): {
  changed: boolean;
  addedDependencies: string[];
} {
  if (
    packageJson.scripts === undefined ||
    packageJson.scripts === null ||
    typeof packageJson.scripts !== "object" ||
    Array.isArray(packageJson.scripts)
  ) {
    packageJson.scripts = {};
  }

  const scripts = packageJson.scripts as Record<string, unknown>;
  let changed = false;
  const addedDependencies: string[] = [];
  const nextVersion = findPackageDependencyVersion(packageJson, "next");
  if (
    typeof scripts.dev === "string" &&
    shouldForceWebpackDevScript(scripts.dev, nextVersion)
  ) {
    scripts.dev = `${scripts.dev} --webpack`;
    changed = true;
  }
  if (scripts.searchlint === undefined) {
    scripts.searchlint = "searchlint doctor";
    changed = true;
  }
  if (scripts["searchlint:config"] === undefined) {
    scripts["searchlint:config"] =
      "searchlint config validate --config searchlint.seo";
    changed = true;
  }
  if (scripts["searchlint:verify"] === undefined) {
    scripts["searchlint:verify"] =
      "searchlint doctor && searchlint config validate --config searchlint.seo";
    changed = true;
  }
  const addedCli = ensureDevDependency(
    packageJson,
    "@searchlint/cli",
    searchLintCliPackageRange
  );
  if (addedCli) {
    addedDependencies.push("@searchlint/cli");
    changed = true;
  }
  const addedNext = ensureDevDependency(
    packageJson,
    "@searchlint/next",
    searchLintNextPackageRange
  );
  if (addedNext) {
    addedDependencies.push("@searchlint/next");
    changed = true;
  }
  return { changed, addedDependencies };
}

function ensureDevDependency(
  packageJson: Record<string, unknown>,
  dependencyName: string,
  versionRange: string
): boolean {
  if (findPackageDependencyVersion(packageJson, dependencyName) !== undefined) {
    return false;
  }

  if (
    packageJson.devDependencies === undefined ||
    packageJson.devDependencies === null ||
    typeof packageJson.devDependencies !== "object" ||
    Array.isArray(packageJson.devDependencies)
  ) {
    packageJson.devDependencies = {};
  }

  (packageJson.devDependencies as Record<string, unknown>)[dependencyName] =
    versionRange;
  return true;
}

function findPackageDependencyVersion(
  packageJson: Record<string, unknown>,
  dependencyName: string
): string | undefined {
  for (const dependencyField of [
    packageJson.dependencies,
    packageJson.devDependencies,
    packageJson.peerDependencies,
    packageJson.optionalDependencies
  ]) {
    if (
      dependencyField !== null &&
      typeof dependencyField === "object" &&
      !Array.isArray(dependencyField) &&
      typeof (dependencyField as Record<string, unknown>)[dependencyName] ===
        "string"
    ) {
      return (dependencyField as Record<string, string>)[dependencyName];
    }
  }
  return undefined;
}

function shouldForceWebpackDevScript(
  devScript: string,
  nextVersion: string | undefined
): boolean {
  if (!usesNext16OrNewer(nextVersion)) {
    return false;
  }
  const normalized = devScript.trim().replace(/\s+/g, " ");
  if (!/^next dev(?:\s|$)/.test(normalized)) {
    return false;
  }
  return !/\s--(?:webpack|turbo|turbopack)(?:\s|$)/.test(normalized);
}

function usesNext16OrNewer(versionRange: string | undefined): boolean {
  if (versionRange === undefined) {
    return false;
  }
  const match = versionRange.match(/\d+/);
  return match !== null && Number.parseInt(match[0], 10) >= 16;
}

export async function doctorText(io?: CliIo): Promise<string> {
  const projectStatus =
    io === undefined
      ? []
      : [
          `project: ${await doctorProjectStatus(io)}`,
          `config: ${await doctorConfigStatus(io)}`,
          `next: ${await doctorNextStatus(io)}`
        ];

  return `SearchLint doctor

version: ${searchLintCliVersion}
node: >=24.0.0 required
package-manager: pnpm >=11.0.0 <12.0.0 supported
${projectStatus.length > 0 ? `${projectStatus.join("\n")}\n` : ""}config: run "searchlint config validate --config searchlint.seo"
status: local CLI runtime checks passed
`;
}

async function doctorProjectStatus(io: CliIo): Promise<string> {
  return (await pathExists(io, "package.json"))
    ? "package.json found"
    : "package.json not found; run from a project root";
}

async function doctorConfigStatus(io: CliIo): Promise<string> {
  return (await pathExists(io, "searchlint.seo"))
    ? "searchlint.seo found"
    : "searchlint.seo missing; run \"searchlint init\"";
}

async function doctorNextStatus(io: CliIo): Promise<string> {
  const packageJson = await readJsonIfExists(io, "package.json");
  const nextVersion =
    packageJson === undefined
      ? undefined
      : findPackageDependencyVersion(packageJson, "next");
  const nextConfig = await findNextConfigStatus(io);

  if (nextVersion === undefined && nextConfig === undefined) {
    return "Next.js not detected";
  }

  if (nextConfig === undefined) {
    return "Next.js dependency found; next.config.* missing";
  }

  if (nextConfig.usesSearchLint) {
    return `${nextConfig.path} uses withSearchLint`;
  }

  return `${nextConfig.path} does not use withSearchLint; run "searchlint init"`;
}

async function readJsonIfExists(
  io: CliIo,
  path: string
): Promise<Record<string, unknown> | undefined> {
  if (!(await pathExists(io, path))) {
    return undefined;
  }

  try {
    const value = JSON.parse(await io.readText(path));
    return value !== null && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

async function findNextConfigStatus(
  io: CliIo
): Promise<{ path: string; usesSearchLint: boolean } | undefined> {
  for (const path of nextConfigCandidates) {
    if (!(await pathExists(io, path))) {
      continue;
    }
    return {
      path,
      usesSearchLint: (await io.readText(path)).includes("withSearchLint(")
    };
  }
  return undefined;
}

async function pathExists(io: CliIo, path: string): Promise<boolean> {
  if (io.exists !== undefined) {
    return await io.exists(path);
  }

  try {
    await io.readText(path);
    return true;
  } catch {
    return false;
  }
}

export function completionScript(shell: "bash" | "zsh" | "fish"): string {
  const commands = [
    "check",
    "crawl",
    "init",
    "doctor",
    "completion",
    "config",
    "migrate-config",
    "baseline",
    "help"
  ];
  const options = [
    "--help",
    "--version",
    "--snapshot",
    "--catalog",
    "--config",
    "--baseline",
    "--format",
    "--fail-on",
    "--now",
    "--route-contract",
    "--source-file",
    "--next-project-root",
    "--url",
    "--max-urls",
    "--max-depth",
    "--max-links-per-page",
    "--max-query-variants-per-path",
    "--max-response-bytes",
    "--max-redirects",
    "--retry-attempts",
    "--request-timeout-ms",
    "--allow-private-networks",
    "--checkpoint",
    "--resume",
    "--same-origin",
    "--respect-robots",
    "--user-agent"
  ];
  const words = [...commands, ...options].join(" ");

  if (shell === "fish") {
    return `complete -c searchlint -f -a "${words}"\n`;
  }

  if (shell === "zsh") {
    return `#compdef searchlint
_searchlint() {
  compadd ${words}
}
compdef _searchlint searchlint
`;
  }

  return `_searchlint_completion() {
  COMPREPLY=($(compgen -W "${words}" -- "\${COMP_WORDS[COMP_CWORD]}"))
}
complete -F _searchlint_completion searchlint
`;
}

export function defaultConfigTemplate(siteUrl = "https://example.com"): string {
  return `language 1

site "${siteUrl}"

route "/" {
  indexable true
}
`;
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(value);
}

function inferSiteUrl(packageJson: Record<string, unknown>): string | undefined {
  const homepage = packageJson.homepage;
  if (typeof homepage === "string" && isHttpUrl(homepage)) {
    return homepage;
  }
  return undefined;
}

type InitSiteSource = "--site" | "package.json homepage" | "default";

function resolveInitSite(
  siteUrl: string | undefined,
  packageJson: Record<string, unknown>
): { url: string; source: InitSiteSource } {
  if (siteUrl !== undefined) {
    return { url: siteUrl, source: "--site" };
  }

  const homepage = inferSiteUrl(packageJson);
  if (homepage !== undefined) {
    return { url: homepage, source: "package.json homepage" };
  }

  return { url: "https://example.com", source: "default" };
}

function createLocalCoreRules(
  registry: ReturnType<typeof createRuleCatalogRegistry>
): readonly Rule[] {
  return [
    ...createCoreHttpAndIndexabilityRules(registry),
    ...createCoreTitleMetadataRules(registry),
    ...createCoreCanonicalHreflangRules(registry),
    ...createCoreStructuralMediaSchemaLinkRules(registry),
    ...createCoreRobotsSitemapPerformanceRules(registry)
  ];
}

function parseFormat(value: string): CliOutputFormat | undefined {
  return ["json", "text", "sarif", "junit", "html"].includes(value)
    ? (value as CliOutputFormat)
    : undefined;
}

function parseFailOn(value: string): CliFailOn | undefined {
  return ["blocker", "error", "warning", "info", "none"].includes(value)
    ? (value as CliFailOn)
    : undefined;
}

function parsePositiveInteger(value: string): number | undefined {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

async function migrateConfig(
  parsed: Extract<CliParsedCommand, { command: "migrate-config" }>,
  io: CliIo
): Promise<CliRunResult> {
  if (parsed.from !== 1) {
    throw new Error(
      `Unsupported source language version ${parsed.from}. Only version 1 is supported.`
    );
  }
  if (parsed.to !== 1) {
    throw new Error(
      `Unsupported target language version ${parsed.to}. No migration is available until a future language version is approved.`
    );
  }
  const write = io.writeTextAtomic ?? io.writeText;
  if (!write) {
    throw new Error(
      "migrate-config requires CliIo.writeText or writeTextAtomic."
    );
  }

  const source = await io.readText(parsed.writePath);
  const compiled = compileSearchLintConfig(source, parsed.writePath);
  if (compiled.languageVersion !== parsed.from) {
    throw new Error(
      `${parsed.writePath} uses language ${compiled.languageVersion}, not --from ${parsed.from}.`
    );
  }

  await write(`${parsed.writePath}.bak`, source);
  await write(parsed.writePath, source);
  return {
    exitCode: 0,
    stdout: `${parsed.writePath} already uses language ${parsed.to}; no migration was needed. Backup written to ${parsed.writePath}.bak.\n`,
    stderr: ""
  };
}

function parseBoolean(value: string): boolean | undefined {
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  return undefined;
}

function createSnapshotFromCrawledPage(
  page: CrawlResult["pages"][number],
  capturedAt: string,
  robotsTxt: CrawlResult["robotsTxt"] | undefined,
  sitemap: CrawlResult["sitemap"] | undefined,
  siteGraph?: SiteGraphSnapshot
): PageSnapshot {
  return {
    route: routeFromUrl(page.url),
    ...createHtmlSnapshotFragment({
      pageUrl: page.url,
      capturedAt,
      rawHtml: page.body,
      renderedDom: page.body
    }),
    ...createHttpSnapshotFragment({
      finalUrl: page.finalUrl ?? page.url,
      statusCode: page.statusCode,
      headers: page.headers,
      redirectChain: page.redirectChain ?? []
    }),
    ...(siteGraph === undefined ? {} : { siteGraph }),
    ...(robotsTxt === undefined
      ? {}
      : {
          robotsTxt: {
            url: robotsTxt.url,
            statusCode: robotsTxt.statusCode,
            body: robotsTxt.body
          }
        }),
    ...(sitemap === undefined
      ? {}
      : {
          sitemap: {
            url: sitemap.url,
            statusCode: sitemap.statusCode,
            ...(sitemap.contentType === undefined
              ? {}
              : { contentType: sitemap.contentType }),
            body: sitemap.body
          }
        })
  };
}

function createSiteGraphFromCrawl(
  crawlResult: CrawlResult
): SiteGraphSnapshot | undefined {
  if (crawlResult.pages.length === 0) {
    return undefined;
  }

  const linkDepths = crawlDepths(crawlResult);
  return {
    pages: crawlResult.pages.map((page) => {
      const canonicalUrl = canonicalHref(page.body, page.url);
      const title = titleText(page.body);
      const description = metaDescription(page.body);
      const hreflangLinks = htmlHreflangLinks(page.body, page.url);
      const assetUrls = htmlAssetUrls(page.body, page.url);
      const pagination = htmlPagination(page.body, page.url);
      const soft404Signals = htmlSoft404Signals(page.body);

      return {
        url: page.url,
        statusCode: page.statusCode,
        ...(page.finalUrl === undefined ? {} : { finalUrl: page.finalUrl }),
        ...(page.redirectChain === undefined
          ? {}
          : { redirectChain: page.redirectChain }),
        ...(canonicalUrl === undefined ? {} : { canonicalUrl }),
        ...(hreflangLinks.length === 0 ? {} : { hreflangLinks }),
        ...(assetUrls.length === 0 ? {} : { assetUrls }),
        ...(pagination === undefined ? {} : { pagination }),
        ...(title === undefined ? {} : { title }),
        ...(description === undefined ? {} : { description }),
        indexable: observedIndexable(page),
        ...(soft404Signals.length === 0 ? {} : { soft404Signals }),
        ...(linkDepths.get(page.url) === undefined
          ? {}
          : { crawlDepth: linkDepths.get(page.url)! })
      };
    }),
    links: crawlResult.pages.flatMap((page) =>
      htmlAnchorLinks(page.body, page.url).map((link) => ({
        sourceUrl: page.url,
        targetUrl: link.targetUrl,
        ...(link.rel === undefined ? {} : { rel: link.rel }),
        ...(link.text === undefined ? {} : { text: link.text })
      }))
    )
  };
}

function crawlDepths(crawlResult: CrawlResult): ReadonlyMap<string, number> {
  const depths = new Map<string, number>();
  const start = crawlResult.pages[0]?.url;
  if (!start) {
    return depths;
  }

  depths.set(start, 0);
  for (const page of crawlResult.pages) {
    const currentDepth = depths.get(page.url);
    if (currentDepth === undefined) {
      continue;
    }
    for (const targetUrl of page.discoveredLinks) {
      if (!depths.has(targetUrl)) {
        depths.set(targetUrl, currentDepth + 1);
      }
    }
  }
  return depths;
}

function titleText(html: string): string | undefined {
  return html.match(/<title(?:\s[^>]*)?>([\s\S]*?)<\/title>/i)?.[1]?.trim();
}

function metaDescription(html: string): string | undefined {
  const tag = html.match(
    /<meta\s+[^>]*(?:name|property)=["']description["'][^>]*>/i
  )?.[0];
  return tag?.match(/\bcontent=["']([^"']*)["']/i)?.[1]?.trim();
}

function htmlAnchorLinks(
  html: string,
  pageUrl: string
): readonly { targetUrl: string; rel?: string; text?: string }[] {
  return [
    ...html.matchAll(
      /<a\s+[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
    )
  ]
    .map((match) => {
      const targetUrl = resolveHrefAgainstPage(match[1] ?? "", pageUrl);
      if (!targetUrl) {
        return undefined;
      }
      const tag = match[0] ?? "";
      const rel = tag.match(/\brel=["']([^"']+)["']/i)?.[1]?.trim();
      const text = (match[2] ?? "")
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      return {
        targetUrl,
        ...(rel ? { rel } : {}),
        ...(text ? { text } : {})
      };
    })
    .filter(
      (link): link is { targetUrl: string; rel?: string; text?: string } =>
        link !== undefined
    );
}

function htmlHreflangLinks(
  html: string,
  pageUrl: string
): readonly { hreflang: string; url: string }[] {
  return [
    ...html.matchAll(
      /<link\s+[^>]*rel=["'][^"']*\balternate\b[^"']*["'][^>]*>/gi
    )
  ]
    .map((match) => {
      const tag = match[0] ?? "";
      const hreflang = tag.match(/\bhreflang=["']([^"']+)["']/i)?.[1]?.trim();
      const href = tag.match(/\bhref=["']([^"']+)["']/i)?.[1]?.trim();
      const url = href ? resolveHrefAgainstPage(href, pageUrl) : undefined;
      return hreflang && url ? { hreflang, url } : undefined;
    })
    .filter((entry): entry is { hreflang: string; url: string } =>
      Boolean(entry)
    );
}

function htmlAssetUrls(html: string, pageUrl: string): readonly string[] {
  return uniqueStable(
    [
      ...[...html.matchAll(/<script\s+[^>]*src=["']([^"']+)["'][^>]*>/gi)].map(
        (match) => match[1] ?? ""
      ),
      ...[
        ...html.matchAll(
          /<link\s+[^>]*rel=["'][^"']*stylesheet[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>/gi
        )
      ].map((match) => match[1] ?? ""),
      ...[...html.matchAll(/<img\s+[^>]*src=["']([^"']+)["'][^>]*>/gi)].map(
        (match) => match[1] ?? ""
      )
    ]
      .map((url) => resolveHrefAgainstPage(url, pageUrl))
      .filter((url): url is string => Boolean(url))
  );
}

function htmlPagination(
  html: string,
  pageUrl: string
): { previousUrl?: string; nextUrl?: string } | undefined {
  const previousUrl = htmlPaginationUrl(html, pageUrl, "prev");
  const nextUrl = htmlPaginationUrl(html, pageUrl, "next");
  return previousUrl || nextUrl
    ? {
        ...(previousUrl ? { previousUrl } : {}),
        ...(nextUrl ? { nextUrl } : {})
      }
    : undefined;
}

function htmlPaginationUrl(
  html: string,
  pageUrl: string,
  rel: "prev" | "next"
): string | undefined {
  const pattern = new RegExp(
    `<a\\s+[^>]*rel=["'][^"']*\\b${rel}\\b[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>|<link\\s+[^>]*rel=["'][^"']*\\b${rel}\\b[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>`,
    "i"
  );
  const match = html.match(pattern);
  const href = match?.[1] ?? match?.[2];
  return href ? resolveHrefAgainstPage(href, pageUrl) : undefined;
}

function htmlSoft404Signals(html: string): readonly string[] {
  const text = html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();
  const signals: string[] = [];
  if (/\b(not found|page not found|404|does not exist)\b/.test(text)) {
    signals.push("not-found-copy");
  }
  if (text.trim().length > 0 && text.trim().length < 120) {
    signals.push("thin-content");
  }
  return signals;
}

function observedIndexable(page: CrawlResult["pages"][number]): boolean {
  const directives = [
    ...splitDirectiveList(headerValue(page.headers, "x-robots-tag") ?? ""),
    ...htmlRobotDirectives(page.body)
  ];

  return !directives.includes("noindex") && !directives.includes("none");
}

function htmlRobotDirectives(html: string): readonly string[] {
  return [
    ...html.matchAll(
      /<meta\s+[^>]*(?:name|property)=["'](?:robots|googlebot|yandex)["'][^>]*>/gi
    )
  ].flatMap((match) =>
    splitDirectiveList(match[0].match(/\bcontent=["']([^"']*)["']/i)?.[1] ?? "")
  );
}

function splitDirectiveList(value: string): readonly string[] {
  return value
    .split(/[,\s]+/)
    .map((directive) => directive.trim().toLowerCase())
    .filter(Boolean);
}

function headerValue(
  headers: Readonly<Record<string, string>>,
  headerName: string
): string | undefined {
  const lowerName = headerName.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === lowerName) {
      return value;
    }
  }

  return undefined;
}

function canonicalHref(html: string, pageUrl: string): string | undefined {
  const match = html.match(
    /<link\s+[^>]*rel=["'][^"']*\bcanonical\b[^"']*["'][^>]*>/i
  );
  const tag = match?.[0];
  if (!tag) {
    return undefined;
  }

  const href = tag.match(/\bhref=["']([^"']+)["']/i)?.[1];
  if (!href) {
    return undefined;
  }

  return resolveHrefAgainstPage(href, pageUrl);
}

function resolveHrefAgainstPage(
  href: string,
  pageUrl: string
): string | undefined {
  if (/^https?:\/\//i.test(href)) {
    return href;
  }

  const pageMatch = pageUrl.match(/^(https?:)\/\/([^/?#]+)([^?#]*)?/i);
  if (!pageMatch) {
    return undefined;
  }

  if (href.startsWith("/")) {
    return `${pageMatch[1]}//${pageMatch[2]}${href}`;
  }

  const basePath = pageMatch[3] ?? "/";
  const baseDirectory = basePath.endsWith("/")
    ? basePath
    : basePath.replace(/\/[^/]*$/, "/");
  return `${pageMatch[1]}//${pageMatch[2]}${baseDirectory}${href}`;
}

function routeFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    return pathname.length === 0 ? "/" : pathname;
  } catch {
    return "/";
  }
}

function parseJsonObject<T>(source: string, path: string): T {
  const parsed: unknown = JSON.parse(source);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${path} must contain a JSON object.`);
  }

  return parsed as T;
}

function compileSearchLintConfig(
  source: string,
  path: string
): CompiledSearchLintConfig {
  const parsed = parseSearchLintDocument(source);
  if (parsed.diagnostics.length > 0) {
    throw new Error(formatConfigDiagnostics(path, parsed.diagnostics));
  }

  const compiled = compileSearchLintDocument(parsed.ast);
  if (compiled.diagnostics.length > 0 || !compiled.config) {
    throw new Error(formatConfigDiagnostics(path, compiled.diagnostics));
  }

  return compiled.config;
}

function formatConfigDiagnostics(
  path: string,
  diagnostics: readonly SemanticDiagnostic[]
): string {
  const diagnosticCount = diagnostics.length;
  const details = diagnostics
    .map(
      (diagnostic) =>
        `- ${diagnostic.code} at line ${diagnostic.span.start.line}, column ${diagnostic.span.start.column}: ${diagnostic.message}`
    )
    .join("\n");
  return [
    `${path} contains invalid SearchLint config.`,
    `Diagnostics: ${diagnosticCount}`,
    details,
    `Next step: fix the config and run \`searchlint config validate --config ${path}\`.`
  ].join("\n");
}

function parseRouteContracts(
  source: string,
  path: string
): readonly RouteContract[] {
  const parsed: unknown = JSON.parse(source);
  const candidates = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === "object"
      ? Array.isArray((parsed as { routeContracts?: unknown }).routeContracts)
        ? (parsed as { routeContracts: unknown[] }).routeContracts
        : [parsed]
      : undefined;

  if (!candidates) {
    throw new Error(
      `${path} must contain a route contract object, array, or config object.`
    );
  }

  return candidates.map((candidate, index) =>
    parseRouteContract(candidate, path, index)
  );
}

function parseRouteContract(
  candidate: unknown,
  path: string,
  index: number
): RouteContract {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    throw new Error(`${path} route contract ${index} must be an object.`);
  }

  const route = (candidate as { route?: unknown }).route;
  const indexable = (candidate as { indexable?: unknown }).indexable;
  if (typeof route !== "string" || route.length === 0) {
    throw new Error(`${path} route contract ${index} must contain a route.`);
  }
  if (typeof indexable !== "boolean") {
    throw new Error(
      `${path} route contract ${index} must contain boolean indexable.`
    );
  }

  const requiredSeverityOverrides = (
    candidate as { requiredSeverityOverrides?: unknown }
  ).requiredSeverityOverrides;
  if (requiredSeverityOverrides === undefined) {
    return { route, indexable };
  }
  if (
    !requiredSeverityOverrides ||
    typeof requiredSeverityOverrides !== "object" ||
    Array.isArray(requiredSeverityOverrides)
  ) {
    throw new Error(
      `${path} route contract ${index} severity overrides must be an object.`
    );
  }

  return {
    route,
    indexable,
    requiredSeverityOverrides: requiredSeverityOverrides as Readonly<
      Record<string, Severity>
    >
  };
}

async function loadBaselineEntries(
  path: string,
  io: CliIo
): Promise<readonly BaselineEntry[]> {
  const parsed = parseJsonObject<{ entries?: unknown }>(
    await io.readText(path),
    path
  );
  if (!Array.isArray(parsed.entries)) {
    throw new Error(`${path} must contain a baseline entries array.`);
  }

  return parsed.entries.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error(`${path} baseline entry ${index} must be an object.`);
    }

    const fingerprint = (entry as { fingerprint?: unknown }).fingerprint;
    if (typeof fingerprint !== "string" || fingerprint.length === 0) {
      throw new Error(
        `${path} baseline entry ${index} must contain a fingerprint.`
      );
    }

    const baselineEntry: BaselineEntry = { fingerprint };
    copyOptionalString(entry, baselineEntry, "ruleId");
    copyOptionalString(entry, baselineEntry, "pageUrl");
    copyOptionalString(entry, baselineEntry, "acceptedAt");
    copyOptionalString(entry, baselineEntry, "reason");
    return baselineEntry;
  });
}

function copyOptionalString(
  source: object,
  target: BaselineEntry,
  key: keyof Omit<BaselineEntry, "fingerprint">
): void {
  const value = (source as Record<string, unknown>)[key];
  if (value === undefined) {
    return;
  }

  if (typeof value !== "string") {
    throw new Error(`Baseline entry field '${key}' must be a string.`);
  }

  target[key] = value;
}

function formatDiagnosticLine(diagnostic: Diagnostic): string {
  return [
    diagnostic.ruleId,
    diagnostic.severity,
    diagnostic.source,
    diagnostic.pageUrl,
    diagnostic.evidence
  ].join(" | ");
}

function uniqueStable(values: readonly string[]): readonly string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }
    seen.add(value);
    result.push(value);
  }
  return result;
}
