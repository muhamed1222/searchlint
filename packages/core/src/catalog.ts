import type { Confidence, DiagnosticSource, Rule, Severity } from "./types.js";

export type RuleScope = "page" | "site";

export type ProviderScope = "core" | "google" | "yandex" | "external";

export type RuleCatalogCategory = {
  id: string;
  title: string;
  targetCount: number;
};

export type RuleCatalogEntry = {
  id: string;
  name: string;
  category: string;
  defaultSeverity: Severity;
  confidence: Confidence;
  scope: RuleScope;
  sources: readonly DiagnosticSource[];
  providerScope: ProviderScope;
  description: string;
  checkingAlgorithm: string;
  requiredEvidence: readonly string[];
  fix: string;
  testExamples: readonly string[];
  documentation: string;
  version: string;
};

export type RuleCatalog = {
  version: number;
  status: string;
  source: string;
  targetRuleCount: number;
  ruleIdPattern: string;
  requiredRuleFields: readonly string[];
  qualityConstraints: readonly string[];
  categories: readonly RuleCatalogCategory[];
  rules: readonly RuleCatalogEntry[];
};

export type RuleCatalogRegistry = {
  readonly catalog: RuleCatalog;
  listRules(): readonly RuleCatalogEntry[];
  getRule(ruleId: string): RuleCatalogEntry | undefined;
  requireRule(ruleId: string): RuleCatalogEntry;
  listByCategory(category: string): readonly RuleCatalogEntry[];
};

const requiredRuleFields = [
  "id",
  "name",
  "category",
  "defaultSeverity",
  "confidence",
  "scope",
  "sources",
  "providerScope",
  "description",
  "checkingAlgorithm",
  "requiredEvidence",
  "fix",
  "testExamples",
  "documentation",
  "version"
] as const;

const severities = new Set<Severity>(["blocker", "error", "warning", "info"]);
const confidences = new Set<Confidence>(["certain", "likely", "heuristic"]);
const ruleScopes = new Set<RuleScope>(["page", "site"]);
const providerScopes = new Set<ProviderScope>([
  "core",
  "google",
  "yandex",
  "external"
]);
const diagnosticSources = new Set<DiagnosticSource>([
  "source-code",
  "raw-html",
  "rendered-dom",
  "http-header",
  "robots-txt",
  "sitemap",
  "crawler",
  "google",
  "yandex"
]);

type MutableRuleEntry = Partial<
  Record<(typeof requiredRuleFields)[number], unknown>
>;

type ParseSection =
  | "root"
  | "requiredRuleFields"
  | "qualityConstraints"
  | "categories"
  | "rules";

function parseScalar(rawValue: string): string | number | readonly string[] {
  const value = rawValue.trim();
  if (value.startsWith("[") && value.endsWith("]")) {
    const inner = value.slice(1, -1).trim();
    return inner.length === 0
      ? []
      : inner.split(",").map((item) => item.trim().replace(/^"|"$/g, ""));
  }

  const unquoted = value.replace(/^"|"$/g, "");
  if (/^\d+$/.test(unquoted)) {
    return Number(unquoted);
  }

  return unquoted;
}

function normalizeMultilineValue(lines: readonly string[]): unknown {
  const joined = lines
    .map((line) => line.trim().replace(/^"|"$/g, ""))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  return parseScalar(joined);
}

function commitPendingMultiline(
  target: Record<string, unknown> | undefined,
  key: string | undefined,
  lines: string[]
): undefined {
  if (target && key) {
    target[key] = normalizeMultilineValue(lines);
  }
  lines.length = 0;
  return undefined;
}

function asString(value: unknown, field: string, ruleId?: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(
      `${ruleId ?? "catalog"} ${field} invalid: expected non-empty string`
    );
  }
  return value;
}

function asNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(`catalog ${field} invalid: expected number`);
  }
  return value;
}

function asStringArray(
  value: unknown,
  field: string,
  ruleId?: string
): readonly string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(
      `${ruleId ?? "catalog"} ${field} invalid: expected string array`
    );
  }
  return value;
}

function assertKnown<T extends string>(
  value: string,
  allowed: ReadonlySet<T>,
  field: string,
  ruleId: string
): T {
  if (!allowed.has(value as T)) {
    throw new Error(`${ruleId} ${field} invalid: unsupported value ${value}`);
  }
  return value as T;
}

function toRuleEntry(rawRule: MutableRuleEntry): RuleCatalogEntry {
  const id = asString(rawRule.id, "id");
  for (const field of requiredRuleFields) {
    if (!(field in rawRule)) {
      throw new Error(`${id} ${field} invalid: missing required field`);
    }
  }

  const sources = asStringArray(rawRule.sources, "sources", id).map((source) =>
    assertKnown(source, diagnosticSources, "sources", id)
  );

  return {
    id,
    name: asString(rawRule.name, "name", id),
    category: asString(rawRule.category, "category", id),
    defaultSeverity: assertKnown(
      asString(rawRule.defaultSeverity, "defaultSeverity", id),
      severities,
      "defaultSeverity",
      id
    ),
    confidence: assertKnown(
      asString(rawRule.confidence, "confidence", id),
      confidences,
      "confidence",
      id
    ),
    scope: assertKnown(
      asString(rawRule.scope, "scope", id),
      ruleScopes,
      "scope",
      id
    ),
    sources,
    providerScope: assertKnown(
      asString(rawRule.providerScope, "providerScope", id),
      providerScopes,
      "providerScope",
      id
    ),
    description: asString(rawRule.description, "description", id),
    checkingAlgorithm: asString(
      rawRule.checkingAlgorithm,
      "checkingAlgorithm",
      id
    ),
    requiredEvidence: asStringArray(
      rawRule.requiredEvidence,
      "requiredEvidence",
      id
    ),
    fix: asString(rawRule.fix, "fix", id),
    testExamples: asStringArray(rawRule.testExamples, "testExamples", id),
    documentation: asString(rawRule.documentation, "documentation", id),
    version: asString(rawRule.version, "version", id)
  };
}

export function parseRuleCatalogYaml(yaml: string): RuleCatalog {
  const lines = yaml.split(/\r?\n/);
  const root: Record<string, unknown> = {};
  const categories: RuleCatalogCategory[] = [];
  const rawRules: MutableRuleEntry[] = [];
  const requiredFields: string[] = [];
  const qualityConstraints: string[] = [];
  let section: ParseSection = "root";
  let currentCategory: Partial<RuleCatalogCategory> | undefined;
  let currentRule: MutableRuleEntry | undefined;
  let multilineTarget: Record<string, unknown> | undefined;
  let multilineKey: string | undefined;
  const multilineLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0) {
      continue;
    }

    if (/^[A-Za-z][A-Za-z0-9]*:/.test(line)) {
      multilineKey = commitPendingMultiline(
        multilineTarget,
        multilineKey,
        multilineLines
      );
    }

    if (trimmed === "requiredRuleFields:") {
      section = "requiredRuleFields";
      continue;
    }
    if (trimmed === "qualityConstraints:") {
      section = "qualityConstraints";
      continue;
    }
    if (trimmed === "categories:") {
      section = "categories";
      continue;
    }
    if (trimmed === "rules:") {
      section = "rules";
      continue;
    }

    if (multilineKey && line.startsWith("      ")) {
      multilineLines.push(trimmed);
      continue;
    }

    const rootMatch = line.match(/^([A-Za-z][A-Za-z0-9]*):\s*(.+)$/);
    if (section === "root" && rootMatch) {
      root[rootMatch[1]!] = parseScalar(rootMatch[2]!);
      continue;
    }

    const listItemMatch = line.match(/^  -\s+(.+)$/);
    if (listItemMatch && section === "requiredRuleFields") {
      requiredFields.push(listItemMatch[1]!.trim());
      continue;
    }
    if (listItemMatch && section === "qualityConstraints") {
      qualityConstraints.push(listItemMatch[1]!.trim());
      continue;
    }

    const categoryStartMatch = line.match(/^  - id:\s*(.+)$/);
    if (categoryStartMatch && section === "categories") {
      if (currentCategory) {
        categories.push(currentCategory as RuleCatalogCategory);
      }
      currentCategory = { id: String(parseScalar(categoryStartMatch[1]!)) };
      continue;
    }

    const ruleStartMatch = line.match(/^  - id:\s*(.+)$/);
    if (ruleStartMatch && section === "rules") {
      multilineKey = commitPendingMultiline(
        multilineTarget,
        multilineKey,
        multilineLines
      );
      currentRule = { id: String(parseScalar(ruleStartMatch[1]!)) };
      rawRules.push(currentRule);
      continue;
    }

    const nestedFieldMatch = line.match(/^    ([A-Za-z][A-Za-z0-9]*):(.*)$/);
    if (nestedFieldMatch && section === "categories" && currentCategory) {
      const key = nestedFieldMatch[1]!;
      const value = nestedFieldMatch[2]!.trim();
      (currentCategory as Record<string, unknown>)[key] = parseScalar(value);
      continue;
    }

    if (nestedFieldMatch && section === "rules" && currentRule) {
      multilineKey = commitPendingMultiline(
        multilineTarget,
        multilineKey,
        multilineLines
      );
      const key = nestedFieldMatch[1]!;
      const value = nestedFieldMatch[2]!.trim();
      if (value.length === 0) {
        multilineTarget = currentRule;
        multilineKey = key;
        continue;
      }
      currentRule[key as keyof MutableRuleEntry] = parseScalar(value);
      continue;
    }
  }

  commitPendingMultiline(multilineTarget, multilineKey, multilineLines);
  if (currentCategory) {
    categories.push(currentCategory as RuleCatalogCategory);
  }

  const catalog = {
    version: asNumber(root.version, "version"),
    status: asString(root.status, "status"),
    source: asString(root.source, "source"),
    targetRuleCount: asNumber(root.targetRuleCount, "targetRuleCount"),
    ruleIdPattern: asString(root.ruleIdPattern, "ruleIdPattern"),
    requiredRuleFields: requiredFields,
    qualityConstraints,
    categories,
    rules: rawRules.map(toRuleEntry)
  };

  validateRuleCatalog(catalog);
  return catalog;
}

export function validateRuleCatalog(catalog: RuleCatalog): void {
  if (catalog.rules.length !== catalog.targetRuleCount) {
    throw new Error(
      `expected ${catalog.targetRuleCount} rules, found ${catalog.rules.length}`
    );
  }

  const ids = new Set<string>();
  const categoryIds = new Set(
    catalog.categories.map((category) => category.id)
  );
  const categoryCounts = new Map<string, number>();
  for (const rule of catalog.rules) {
    if (ids.has(rule.id)) {
      throw new Error(`${rule.id} id invalid: duplicate rule id`);
    }
    ids.add(rule.id);

    if (!categoryIds.has(rule.category)) {
      throw new Error(
        `${rule.id} category invalid: unknown category ${rule.category}`
      );
    }

    categoryCounts.set(
      rule.category,
      (categoryCounts.get(rule.category) ?? 0) + 1
    );

    if (rule.defaultSeverity === "blocker" && rule.confidence === "heuristic") {
      throw new Error(
        `${rule.id} confidence invalid: blocker cannot be heuristic`
      );
    }

    if (rule.name.includes("meta-keywords") || rule.name.includes("keywords")) {
      throw new Error(
        `${rule.id} name invalid: meta keywords checks are forbidden`
      );
    }

    if (
      rule.name.includes("title-length") &&
      ["blocker", "error"].includes(rule.defaultSeverity)
    ) {
      throw new Error(
        `${rule.id} defaultSeverity invalid: title length cannot be blocker or error`
      );
    }

    const hasGoogle = rule.sources.includes("google");
    const hasYandex = rule.sources.includes("yandex");
    if (hasGoogle && hasYandex && rule.providerScope !== "external") {
      throw new Error(
        `${rule.id} providerScope invalid: Google and Yandex sources require external scope`
      );
    }
    if (rule.providerScope === "google" && (!hasGoogle || hasYandex)) {
      throw new Error(
        `${rule.id} providerScope invalid: google scope requires Google-only provider evidence`
      );
    }
    if (rule.providerScope === "yandex" && (!hasYandex || hasGoogle)) {
      throw new Error(
        `${rule.id} providerScope invalid: yandex scope requires Yandex-only provider evidence`
      );
    }
    if (rule.providerScope === "external" && (!hasGoogle || !hasYandex)) {
      throw new Error(
        `${rule.id} providerScope invalid: external scope requires Google and Yandex evidence`
      );
    }
    if (rule.providerScope === "core" && hasGoogle && hasYandex) {
      throw new Error(
        `${rule.id} providerScope invalid: core scope cannot mix Google and Yandex evidence`
      );
    }
  }

  for (const category of catalog.categories) {
    const actualCount = categoryCounts.get(category.id) ?? 0;
    if (actualCount !== category.targetCount) {
      throw new Error(
        `catalog categories invalid: ${category.id} expected ${category.targetCount} rules, found ${actualCount}`
      );
    }
  }
}

export function createRuleCatalogRegistry(
  catalog: RuleCatalog
): RuleCatalogRegistry {
  validateRuleCatalog(catalog);
  const orderedRules = [...catalog.rules].sort((a, b) =>
    a.id.localeCompare(b.id)
  );
  const byId = new Map(orderedRules.map((rule) => [rule.id, rule]));

  return {
    catalog,
    listRules() {
      return orderedRules;
    },
    getRule(ruleId: string) {
      return byId.get(ruleId);
    },
    requireRule(ruleId: string) {
      const rule = byId.get(ruleId);
      if (!rule) {
        throw new Error(`unknown rule ${ruleId}`);
      }
      return rule;
    },
    listByCategory(category: string) {
      return orderedRules.filter((rule) => rule.category === category);
    }
  };
}

export function createCatalogBackedRule(
  entry: RuleCatalogEntry,
  run: Rule["run"],
  options: Pick<Rule, "dependencies" | "priority"> = {}
): Rule {
  return {
    id: entry.id,
    defaultSeverity: entry.defaultSeverity,
    defaultConfidence: entry.confidence,
    sources: entry.sources,
    run,
    ...options
  };
}
