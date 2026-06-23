import type { RouteContract, Severity, Suppression } from "@searchlint/core";

import type {
  BlockDeclarationNode,
  EnvironmentDeclarationNode,
  ImportDeclarationNode,
  LiteralNode,
  PolicyDeclarationNode,
  PropertyDeclarationNode,
  RouteDeclarationNode,
  RouteGroupDeclarationNode,
  RouteMemberNode,
  SearchLintDocumentNode,
  SourceSpan,
  SyntaxDiagnostic,
  TopLevelDeclarationNode,
  VariableDeclarationNode
} from "./ast.js";
import { parseSearchLintDocument } from "./parser.js";

export type SemanticDiagnostic = SyntaxDiagnostic;

export type CompiledValue =
  | string
  | number
  | boolean
  | readonly CompiledValue[];

export type CompiledProviderRule = {
  provider: "google" | "yandex";
  route: string;
  ruleId?: string;
  required?: readonly string[];
  severityOverrides?: Readonly<Record<string, Severity>>;
};

export type CompiledCustomRuleReference = {
  route: string;
  id: string;
  severity?: Severity;
};

export type CompiledSearchLintConfig = {
  contractVersion: 1;
  languageVersion: 1;
  siteUrl: string;
  environment?: string;
  imports: readonly string[];
  variables: Readonly<Record<string, CompiledValue>>;
  policies: readonly string[];
  routeContracts: readonly RouteContract[];
  routePrecedence: readonly string[];
  suppressions: readonly Suppression[];
  providerRules: readonly CompiledProviderRule[];
  customRules: readonly CompiledCustomRuleReference[];
};

export type CompileResult = {
  config?: CompiledSearchLintConfig;
  diagnostics: readonly SemanticDiagnostic[];
};

export type CompileProjectResult = CompileResult & {
  loadedPaths: readonly string[];
};

export type ImportResolverInput = {
  path: string;
  fromPath?: string;
};

export type ImportResolverResult = {
  path: string;
  source: string;
};

export type CompileProjectOptions = {
  path?: string;
  environment?: string;
  resolveImport?: (
    input: ImportResolverInput
  ) =>
    | ImportResolverResult
    | undefined
    | Promise<ImportResolverResult | undefined>;
};

const supportedLanguageVersions = new Set([1]);
const severities = new Set<Severity>(["blocker", "error", "warning", "info"]);
const providers = new Set(["google", "yandex"]);
const routeProperties = new Set([
  "type",
  "indexable",
  "canonical",
  "hreflang",
  "schema",
  "severity",
  "use",
  "important",
  "crawlDepth"
]);
const routeBlocks = new Set([
  "title",
  "description",
  "metadata",
  "canonical",
  "hreflang",
  "schema",
  "suppress",
  "provider",
  "custom",
  "source",
  "pagination"
]);

function diagnostic(
  code: string,
  message: string,
  span: SourceSpan
): SemanticDiagnostic {
  return { code, message, span };
}

function literalText(literal: LiteralNode): string {
  if (literal.kind === "Identifier" || literal.kind === "VariableReference") {
    return literal.name;
  }

  if (literal.kind === "ListLiteral") {
    return literal.values.map((value) => literalText(value)).join(",");
  }

  return String(literal.value);
}

function resolveLiteral(
  literal: LiteralNode,
  variables: ReadonlyMap<string, CompiledValue>,
  diagnostics: SemanticDiagnostic[]
): CompiledValue | undefined {
  if (literal.kind === "Identifier" || literal.kind === "StringLiteral") {
    return literalText(literal);
  }
  if (literal.kind === "NumberLiteral" || literal.kind === "BooleanLiteral") {
    return literal.value;
  }
  if (literal.kind === "ListLiteral") {
    const values: CompiledValue[] = [];
    for (const item of literal.values) {
      const value = resolveLiteral(item, variables, diagnostics);
      if (value !== undefined) {
        values.push(value);
      }
    }
    return values;
  }

  const value = variables.get(literal.name);
  if (value === undefined) {
    diagnostics.push(
      diagnostic(
        "SLANG210",
        `Unknown variable '${literal.name}'.`,
        literal.span
      )
    );
  }
  return value;
}

function requireString(
  literal: LiteralNode,
  variables: ReadonlyMap<string, CompiledValue>,
  diagnostics: SemanticDiagnostic[],
  code: string,
  message: string
): string | undefined {
  const value = resolveLiteral(literal, variables, diagnostics);
  if (typeof value !== "string") {
    diagnostics.push(diagnostic(code, message, literal.span));
    return undefined;
  }
  return value;
}

function requireBoolean(
  literal: LiteralNode,
  variables: ReadonlyMap<string, CompiledValue>,
  diagnostics: SemanticDiagnostic[],
  code: string,
  message: string
): boolean | undefined {
  const value = resolveLiteral(literal, variables, diagnostics);
  if (typeof value !== "boolean") {
    diagnostics.push(diagnostic(code, message, literal.span));
    return undefined;
  }
  return value;
}

function requireStringList(
  literal: LiteralNode,
  variables: ReadonlyMap<string, CompiledValue>,
  diagnostics: SemanticDiagnostic[],
  code: string,
  message: string
): readonly string[] | undefined {
  const value = resolveLiteral(literal, variables, diagnostics);
  if (
    !Array.isArray(value) ||
    !value.every((item) => typeof item === "string")
  ) {
    diagnostics.push(diagnostic(code, message, literal.span));
    return undefined;
  }
  return value;
}

function findProperty(
  body: readonly RouteMemberNode[],
  name: string
): PropertyDeclarationNode | undefined {
  return body.find(
    (member): member is PropertyDeclarationNode =>
      member.kind === "PropertyDeclaration" && member.name.name === name
  );
}

function findProperties(
  body: readonly RouteMemberNode[],
  name: string
): readonly PropertyDeclarationNode[] {
  return body.filter(
    (member): member is PropertyDeclarationNode =>
      member.kind === "PropertyDeclaration" && member.name.name === name
  );
}

function collectDeclarations(
  document: SearchLintDocumentNode,
  environment?: string
): readonly TopLevelDeclarationNode[] {
  const declarations = document.declarations.filter(
    (declaration) => declaration.kind !== "EnvironmentDeclaration"
  );
  const selected = document.declarations.find(
    (declaration): declaration is EnvironmentDeclarationNode =>
      declaration.kind === "EnvironmentDeclaration" &&
      declaration.name.name === environment
  );
  return selected ? [...declarations, ...selected.body] : declarations;
}

function compileVariables(
  declarations: readonly TopLevelDeclarationNode[],
  diagnostics: SemanticDiagnostic[]
): Map<string, CompiledValue> {
  const variables = new Map<string, CompiledValue>();
  for (const declaration of declarations) {
    if (declaration.kind !== "VariableDeclaration") continue;
    if (variables.has(declaration.name.name)) {
      diagnostics.push(
        diagnostic(
          "SLANG211",
          `Duplicate variable '${declaration.name.name}'.`,
          declaration.name.span
        )
      );
      continue;
    }
    const value = resolveLiteral(declaration.value, variables, diagnostics);
    if (value !== undefined) {
      variables.set(declaration.name.name, value);
    }
  }
  return variables;
}

function compilePolicies(
  declarations: readonly TopLevelDeclarationNode[],
  diagnostics: SemanticDiagnostic[]
): Map<string, readonly RouteMemberNode[]> {
  const policies = new Map<string, readonly RouteMemberNode[]>();
  for (const declaration of declarations) {
    if (declaration.kind !== "PolicyDeclaration") continue;
    if (policies.has(declaration.name.name)) {
      diagnostics.push(
        diagnostic(
          "SLANG212",
          `Duplicate policy '${declaration.name.name}'.`,
          declaration.name.span
        )
      );
      continue;
    }
    policies.set(declaration.name.name, declaration.body);
  }
  return policies;
}

function routeDeclarations(
  declarations: readonly TopLevelDeclarationNode[]
): readonly RouteDeclarationNode[] {
  return declarations.flatMap((declaration) => {
    if (declaration.kind === "RouteDeclaration") return [declaration];
    if (declaration.kind === "RouteGroupDeclaration") return declaration.body;
    return [];
  });
}

function expandPolicies(
  route: RouteDeclarationNode,
  policies: ReadonlyMap<string, readonly RouteMemberNode[]>,
  diagnostics: SemanticDiagnostic[]
): readonly RouteMemberNode[] {
  const expanded: RouteMemberNode[] = [];
  for (const member of route.body) {
    if (member.kind === "PropertyDeclaration" && member.name.name === "use") {
      const policy = policies.get(literalText(member.value));
      if (!policy) {
        diagnostics.push(
          diagnostic(
            "SLANG213",
            `Unknown policy '${literalText(member.value)}'.`,
            member.value.span
          )
        );
        continue;
      }
      expanded.push(...policy);
      continue;
    }
    expanded.push(member);
  }
  return expanded;
}

function validateRouteMembers(
  route: RouteDeclarationNode,
  body: readonly RouteMemberNode[],
  diagnostics: SemanticDiagnostic[]
): void {
  for (const member of body) {
    if (
      member.kind === "PropertyDeclaration" &&
      !routeProperties.has(member.name.name)
    ) {
      diagnostics.push(
        diagnostic(
          "SLANG214",
          `Unknown route property '${member.name.name}'.`,
          member.name.span
        )
      );
    }
    if (
      member.kind === "BlockDeclaration" &&
      !routeBlocks.has(member.name.name)
    ) {
      diagnostics.push(
        diagnostic(
          "SLANG215",
          `Unknown route block '${member.name.name}'.`,
          member.name.span
        )
      );
    }
  }

  if (!route.pattern.value.startsWith("/")) {
    diagnostics.push(
      diagnostic(
        "SLANG216",
        "Route pattern must start with '/'.",
        route.pattern.span
      )
    );
  }
}

function compileIndexable(
  route: RouteDeclarationNode,
  body: readonly RouteMemberNode[],
  variables: ReadonlyMap<string, CompiledValue>,
  diagnostics: SemanticDiagnostic[]
): boolean {
  const indexable = findProperty(body, "indexable");
  if (!indexable) {
    return true;
  }

  return (
    requireBoolean(
      indexable.value,
      variables,
      diagnostics,
      "SLANG201",
      "indexable must be true or false."
    ) ?? true
  );
}

function compileSeverityOverrides(
  body: readonly RouteMemberNode[],
  variables: ReadonlyMap<string, CompiledValue>,
  diagnostics: SemanticDiagnostic[]
): Readonly<Record<string, Severity>> | undefined {
  const overrides: Record<string, Severity> = {};

  for (const member of body) {
    const severityDeclarations =
      member.kind === "PropertyDeclaration" && member.name.name === "severity"
        ? [member]
        : member.kind === "BlockDeclaration" && member.name.name === "provider"
          ? member.body.filter(
              (nested): nested is PropertyDeclarationNode =>
                nested.kind === "PropertyDeclaration" &&
                nested.name.name === "severity"
            )
          : [];

    for (const severityDeclaration of severityDeclarations) {
      const [ruleId, severity] = severityDeclaration.values;
      if (!ruleId || !severity) {
        diagnostics.push(
          diagnostic(
            "SLANG202",
            "severity requires a rule ID and severity value.",
            severityDeclaration.span
          )
        );
        continue;
      }

      const ruleIdText = requireString(
        ruleId,
        variables,
        diagnostics,
        "SLANG217",
        "severity rule ID must be a string or identifier."
      );
      const severityText = requireString(
        severity,
        variables,
        diagnostics,
        "SLANG203",
        "severity must be blocker, error, warning, or info."
      );
      if (!ruleIdText || !severityText) continue;
      if (!severities.has(severityText as Severity)) {
        diagnostics.push(
          diagnostic(
            "SLANG203",
            "severity must be blocker, error, warning, or info.",
            severity.span
          )
        );
        continue;
      }
      overrides[ruleIdText] = severityText as Severity;
    }
  }

  return Object.keys(overrides).sort().length > 0
    ? Object.fromEntries(
        Object.entries(overrides).sort(([left], [right]) =>
          left.localeCompare(right)
        )
      )
    : undefined;
}

function compileStringOrStringList(
  literal: LiteralNode,
  variables: ReadonlyMap<string, CompiledValue>,
  diagnostics: SemanticDiagnostic[],
  code: string,
  message: string
): readonly string[] | undefined {
  const value = resolveLiteral(literal, variables, diagnostics);
  if (typeof value === "string") {
    return [value];
  }
  if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
    return value;
  }
  diagnostics.push(diagnostic(code, message, literal.span));
  return undefined;
}

function findReason(
  block: BlockDeclarationNode
): PropertyDeclarationNode | undefined {
  return findProperty(block.body, "reason");
}

function compileSuppressions(
  route: RouteDeclarationNode,
  body: readonly RouteMemberNode[],
  variables: ReadonlyMap<string, CompiledValue>,
  diagnostics: SemanticDiagnostic[]
): Suppression[] {
  const suppressions: Suppression[] = [];

  for (const member of body) {
    if (member.kind !== "BlockDeclaration" || member.name.name !== "suppress") {
      continue;
    }
    if (!member.argument) {
      diagnostics.push(
        diagnostic("SLANG204", "suppress requires a rule ID.", member.name.span)
      );
      continue;
    }
    const ruleId = requireString(
      member.argument,
      variables,
      diagnostics,
      "SLANG218",
      "suppress rule ID must be a string or identifier."
    );
    const reason = findReason(member);
    if (!reason) {
      diagnostics.push(
        diagnostic(
          "SLANG205",
          "suppress requires a non-empty reason string.",
          member.span
        )
      );
      continue;
    }
    const reasonText = requireString(
      reason.value,
      variables,
      diagnostics,
      "SLANG205",
      "suppress requires a non-empty reason string."
    )?.trim();
    if (!ruleId || !reasonText) {
      diagnostics.push(
        diagnostic(
          "SLANG205",
          "suppress requires a non-empty reason string.",
          reason.value.span
        )
      );
      continue;
    }
    suppressions.push({
      ruleId,
      reason: reasonText,
      route: route.pattern.value
    });
  }

  return suppressions;
}

function compileProviderRules(
  route: RouteDeclarationNode,
  body: readonly RouteMemberNode[],
  variables: ReadonlyMap<string, CompiledValue>,
  diagnostics: SemanticDiagnostic[]
): CompiledProviderRule[] {
  const result: CompiledProviderRule[] = [];
  for (const member of body) {
    if (member.kind !== "BlockDeclaration" || member.name.name !== "provider") {
      continue;
    }
    if (!member.argument) {
      diagnostics.push(
        diagnostic(
          "SLANG219",
          "provider requires google or yandex.",
          member.name.span
        )
      );
      continue;
    }
    const provider = requireString(
      member.argument,
      variables,
      diagnostics,
      "SLANG219",
      "provider requires google or yandex."
    );
    if (!provider || !providers.has(provider)) {
      diagnostics.push(
        diagnostic(
          "SLANG219",
          "provider requires google or yandex.",
          member.argument.span
        )
      );
      continue;
    }
    const required = findProperty(member.body, "require");
    const rule = findProperty(member.body, "rule");
    const ruleId = rule
      ? requireString(
          rule.value,
          variables,
          diagnostics,
          "SLANG220",
          "provider rule must be a string or identifier."
        )
      : undefined;
    const requiredValues = required
      ? required.value.kind === "ListLiteral"
        ? requireStringList(
            required.value,
            variables,
            diagnostics,
            "SLANG221",
            "provider require must be a string list."
          )
        : [
            requireString(
              required.value,
              variables,
              diagnostics,
              "SLANG221",
              "provider require must be a string or string list."
            ) ?? ""
          ].filter(Boolean)
      : undefined;
    const severityOverrides = compileSeverityOverrides(
      member.body,
      variables,
      diagnostics
    );
    result.push({
      provider: provider as "google" | "yandex",
      route: route.pattern.value,
      ...(ruleId ? { ruleId } : {}),
      ...(requiredValues ? { required: requiredValues } : {}),
      ...(severityOverrides ? { severityOverrides } : {})
    });
  }
  return result;
}

function compileCustomRules(
  route: RouteDeclarationNode,
  body: readonly RouteMemberNode[],
  variables: ReadonlyMap<string, CompiledValue>,
  diagnostics: SemanticDiagnostic[]
): CompiledCustomRuleReference[] {
  const result: CompiledCustomRuleReference[] = [];
  for (const member of body) {
    if (member.kind !== "BlockDeclaration" || member.name.name !== "custom") {
      continue;
    }
    if (!member.argument) {
      diagnostics.push(
        diagnostic(
          "SLANG222",
          "custom requires a rule reference.",
          member.name.span
        )
      );
      continue;
    }
    const id = requireString(
      member.argument,
      variables,
      diagnostics,
      "SLANG222",
      "custom requires a rule reference."
    );
    if (!id) continue;
    const severity = findProperty(member.body, "severity");
    const severityText = severity
      ? requireString(
          severity.value,
          variables,
          diagnostics,
          "SLANG203",
          "severity must be blocker, error, warning, or info."
        )
      : undefined;
    if (
      severityText !== undefined &&
      !severities.has(severityText as Severity)
    ) {
      diagnostics.push(
        diagnostic(
          "SLANG203",
          "severity must be blocker, error, warning, or info.",
          severity?.value.span ?? member.span
        )
      );
      continue;
    }
    result.push({
      route: route.pattern.value,
      id,
      ...(severityText ? { severity: severityText as Severity } : {})
    });
  }
  return result;
}

function compileRoute(
  route: RouteDeclarationNode,
  body: readonly RouteMemberNode[],
  variables: ReadonlyMap<string, CompiledValue>,
  diagnostics: SemanticDiagnostic[]
): RouteContract {
  const severityOverrides = compileSeverityOverrides(
    body,
    variables,
    diagnostics
  );
  const schemas = findProperties(body, "schema");
  const canonical = findProperty(body, "canonical");
  const hreflang = findProperty(body, "hreflang");
  const important = findProperty(body, "important");
  const crawlDepth = findProperty(body, "crawlDepth");
  const pagination = body.find(
    (member): member is BlockDeclarationNode =>
      member.kind === "BlockDeclaration" && member.name.name === "pagination"
  );
  const requiredSchemas = schemas.flatMap(
    (schema) =>
      compileStringOrStringList(
        schema.value,
        variables,
        diagnostics,
        "SLANG223",
        "schema must be an identifier, string, or string list."
      ) ?? []
  );

  const contract: RouteContract = {
    route: route.pattern.value,
    indexable: compileIndexable(route, body, variables, diagnostics),
    ...(canonical
      ? {
          canonicalPolicy:
            literalText(canonical.value) === "self" ? "self" : "custom"
        }
      : {}),
    ...(requiredSchemas && requiredSchemas.length > 0
      ? { requiredSchemas }
      : {}),
    ...(hreflang
      ? {
          hreflang:
            compileStringOrStringList(
              hreflang.value,
              variables,
              diagnostics,
              "SLANG223",
              "hreflang must be an identifier, string, or string list."
            ) ?? []
        }
      : {}),
    ...(severityOverrides
      ? { requiredSeverityOverrides: severityOverrides }
      : {}),
    ...(important
      ? {
          important:
            requireBoolean(
              important.value,
              variables,
              diagnostics,
              "SLANG224",
              "important must be true or false."
            ) ?? false
        }
      : {}),
    ...(crawlDepth && crawlDepth.value.kind === "NumberLiteral"
      ? { crawlDepthPolicyMax: crawlDepth.value.value }
      : {}),
    ...(pagination
      ? {
          pagination: {
            required:
              requireBoolean(
                findProperty(pagination.body, "required")?.value ??
                  pagination.argument ?? {
                    kind: "BooleanLiteral",
                    value: true,
                    span: pagination.name.span
                  },
                variables,
                diagnostics,
                "SLANG225",
                "pagination required must be true or false."
              ) ?? true
          }
        }
      : {})
  };

  return contract;
}

function compareRouteSpecificity(left: string, right: string): number {
  const leftSegments = left.split("/").filter(Boolean);
  const rightSegments = right.split("/").filter(Boolean);
  const literal = (segment: string) =>
    segment !== "*" && segment !== "**" && !segment.startsWith("[");
  const leftLiteral = leftSegments.filter(literal).length;
  const rightLiteral = rightSegments.filter(literal).length;
  if (leftLiteral !== rightLiteral) return rightLiteral - leftLiteral;
  if (leftSegments.length !== rightSegments.length) {
    return rightSegments.length - leftSegments.length;
  }
  return left.localeCompare(right);
}

function validateDuplicateTopLevel(
  declarations: readonly TopLevelDeclarationNode[],
  diagnostics: SemanticDiagnostic[]
): void {
  const languages = declarations.filter(
    (item) => item.kind === "LanguageDeclaration"
  );
  if (languages.length > 1) {
    diagnostics.push(
      diagnostic(
        "SLANG226",
        "Duplicate language declaration.",
        languages[1]!.span
      )
    );
  }
}

function validateDuplicateSites(
  document: SearchLintDocumentNode,
  diagnostics: SemanticDiagnostic[]
): void {
  const baseSites = document.declarations.filter(
    (item) => item.kind === "SiteDeclaration"
  );
  if (baseSites.length > 1) {
    diagnostics.push(
      diagnostic("SLANG227", "Duplicate site declaration.", baseSites[1]!.span)
    );
  }
  for (const environment of document.declarations) {
    if (environment.kind !== "EnvironmentDeclaration") continue;
    const environmentSites = environment.body.filter(
      (item) => item.kind === "SiteDeclaration"
    );
    if (environmentSites.length > 1) {
      diagnostics.push(
        diagnostic(
          "SLANG227",
          "Duplicate site declaration.",
          environmentSites[1]!.span
        )
      );
    }
  }
}

function validateEnvironmentSelection(
  document: SearchLintDocumentNode,
  environment: string | undefined,
  diagnostics: SemanticDiagnostic[]
): void {
  const names = new Set<string>();
  for (const declaration of document.declarations) {
    if (declaration.kind !== "EnvironmentDeclaration") continue;
    if (names.has(declaration.name.name)) {
      diagnostics.push(
        diagnostic(
          "SLANG228",
          `Duplicate environment '${declaration.name.name}'.`,
          declaration.name.span
        )
      );
    }
    names.add(declaration.name.name);
  }
  if (environment && !names.has(environment)) {
    diagnostics.push(
      diagnostic(
        "SLANG229",
        `Unknown environment '${environment}'.`,
        document.span
      )
    );
  }
}

export function compileSearchLintDocument(
  document: SearchLintDocumentNode,
  options: Pick<CompileProjectOptions, "environment"> = {}
): CompileResult {
  const diagnostics: SemanticDiagnostic[] = [];
  validateEnvironmentSelection(document, options.environment, diagnostics);
  validateDuplicateSites(document, diagnostics);
  const declarations = collectDeclarations(document, options.environment);
  validateDuplicateTopLevel(declarations, diagnostics);

  const language = declarations.find(
    (declaration) => declaration.kind === "LanguageDeclaration"
  );
  const site = [...declarations]
    .reverse()
    .find((declaration) => declaration.kind === "SiteDeclaration");
  const imports = declarations.filter(
    (declaration): declaration is ImportDeclarationNode =>
      declaration.kind === "ImportDeclaration"
  );

  if (!language) {
    diagnostics.push(
      diagnostic("SLANG206", "language declaration is required.", document.span)
    );
  } else if (!supportedLanguageVersions.has(language.version.value)) {
    diagnostics.push(
      diagnostic(
        "SLANG207",
        `Unsupported language version ${language.version.value}.`,
        language.version.span
      )
    );
  }

  if (!site) {
    diagnostics.push(
      diagnostic("SLANG208", "site declaration is required.", document.span)
    );
  }

  const variables = compileVariables(declarations, diagnostics);
  const policies = compilePolicies(declarations, diagnostics);
  const routes = routeDeclarations(declarations);
  const routePatterns = new Map<string, SourceSpan>();
  const routeContracts: RouteContract[] = [];
  const suppressions: Suppression[] = [];
  const providerRules: CompiledProviderRule[] = [];
  const customRules: CompiledCustomRuleReference[] = [];

  for (const route of routes) {
    const existing = routePatterns.get(route.pattern.value);
    if (existing) {
      diagnostics.push(
        diagnostic(
          "SLANG209",
          `Duplicate route '${route.pattern.value}'.`,
          route.pattern.span
        )
      );
      continue;
    }
    routePatterns.set(route.pattern.value, route.pattern.span);

    const body = expandPolicies(route, policies, diagnostics);
    validateRouteMembers(route, body, diagnostics);
    routeContracts.push(compileRoute(route, body, variables, diagnostics));
    suppressions.push(
      ...compileSuppressions(route, body, variables, diagnostics)
    );
    providerRules.push(
      ...compileProviderRules(route, body, variables, diagnostics)
    );
    customRules.push(
      ...compileCustomRules(route, body, variables, diagnostics)
    );
  }

  if (diagnostics.length > 0 || !language || !site) {
    return { diagnostics };
  }

  const routePrecedence = [...routeContracts]
    .map((route) => route.route)
    .sort(compareRouteSpecificity);

  return {
    config: {
      contractVersion: 1,
      languageVersion: 1,
      siteUrl: site.url.value,
      ...(options.environment ? { environment: options.environment } : {}),
      imports: imports.map((item) => item.path.value).sort(),
      variables: Object.fromEntries([...variables.entries()].sort()),
      policies: [...policies.keys()].sort(),
      routeContracts: [...routeContracts].sort((left, right) =>
        left.route.localeCompare(right.route)
      ),
      routePrecedence,
      suppressions: [...suppressions].sort((left, right) =>
        `${left.route ?? ""}:${left.ruleId}`.localeCompare(
          `${right.route ?? ""}:${right.ruleId}`
        )
      ),
      providerRules: [...providerRules].sort((left, right) =>
        `${left.route}:${left.provider}:${left.ruleId ?? ""}`.localeCompare(
          `${right.route}:${right.provider}:${right.ruleId ?? ""}`
        )
      ),
      customRules: [...customRules].sort((left, right) =>
        `${left.route}:${left.id}`.localeCompare(`${right.route}:${right.id}`)
      )
    },
    diagnostics
  };
}

export async function compileSearchLintProject(
  source: string,
  options: CompileProjectOptions = {}
): Promise<CompileProjectResult> {
  const entryPath = options.path ?? "searchlint.seo";
  const loadedPaths: string[] = [];
  const diagnostics: SemanticDiagnostic[] = [];
  const declarations = await loadDeclarations(
    source,
    entryPath,
    options,
    [],
    loadedPaths,
    diagnostics
  );
  const document: SearchLintDocumentNode = {
    ...parseSearchLintDocument(source).ast,
    declarations
  };
  const compiled = compileSearchLintDocument(document, {
    ...(options.environment ? { environment: options.environment } : {})
  });
  const combinedDiagnostics = [...diagnostics, ...compiled.diagnostics];
  if (combinedDiagnostics.length > 0) {
    return {
      diagnostics: combinedDiagnostics,
      loadedPaths
    };
  }
  return {
    ...compiled,
    diagnostics: combinedDiagnostics,
    loadedPaths
  };
}

async function loadDeclarations(
  source: string,
  currentPath: string,
  options: CompileProjectOptions,
  stack: readonly string[],
  loadedPaths: string[],
  diagnostics: SemanticDiagnostic[]
): Promise<TopLevelDeclarationNode[]> {
  if (stack.includes(currentPath)) {
    const parsed = parseSearchLintDocument(source);
    diagnostics.push(
      diagnostic(
        "SLANG230",
        `Import cycle detected: ${[...stack, currentPath].join(" -> ")}.`,
        parsed.ast.span
      )
    );
    return [];
  }

  loadedPaths.push(currentPath);
  const parsed = parseSearchLintDocument(source);
  diagnostics.push(...parsed.diagnostics);
  const result: TopLevelDeclarationNode[] = [];

  for (const declaration of parsed.ast.declarations) {
    if (declaration.kind !== "ImportDeclaration") {
      result.push(declaration);
      continue;
    }
    if (!options.resolveImport) {
      diagnostics.push(
        diagnostic(
          "SLANG231",
          "Import resolver is required for import declarations.",
          declaration.path.span
        )
      );
      continue;
    }
    const resolved = await options.resolveImport({
      path: declaration.path.value,
      fromPath: currentPath
    });
    if (!resolved) {
      diagnostics.push(
        diagnostic(
          "SLANG232",
          `Unable to resolve import '${declaration.path.value}'.`,
          declaration.path.span
        )
      );
      continue;
    }
    result.push(declaration);
    result.push(
      ...(await loadDeclarations(
        resolved.source,
        resolved.path,
        options,
        [...stack, currentPath],
        loadedPaths,
        diagnostics
      ))
    );
  }

  return result;
}
