import {
  createDiagnostic,
  isSuppressed,
  validateSuppressions
} from "./diagnostic.js";
import { resolveRouteContract } from "./routes.js";
import type {
  Confidence,
  Diagnostic,
  Rule,
  RuleEngineInput,
  RuleEngineResult,
  RuleReport,
  Severity
} from "./types.js";

function compareRule(a: Rule, b: Rule): number {
  const priorityDelta = (b.priority ?? 0) - (a.priority ?? 0);
  return priorityDelta === 0 ? a.id.localeCompare(b.id) : priorityDelta;
}

function orderRules(rules: readonly Rule[]): Rule[] {
  const byId = new Map<string, Rule>();
  const remainingDependencies = new Map<string, Set<string>>();
  const dependents = new Map<string, Set<string>>();

  for (const rule of rules) {
    if (byId.has(rule.id)) {
      throw new Error(`duplicate rule id ${rule.id}`);
    }
    byId.set(rule.id, rule);
  }

  for (const rule of rules) {
    const dependencies = new Set(rule.dependencies ?? []);
    for (const dependency of dependencies) {
      if (!byId.has(dependency)) {
        throw new Error(`${rule.id} depends on unknown rule ${dependency}`);
      }

      const dependentRules = dependents.get(dependency) ?? new Set<string>();
      dependentRules.add(rule.id);
      dependents.set(dependency, dependentRules);
    }
    remainingDependencies.set(rule.id, dependencies);
  }

  const ready = [...rules]
    .filter((rule) => remainingDependencies.get(rule.id)?.size === 0)
    .sort(compareRule);
  const ordered: Rule[] = [];

  while (ready.length > 0) {
    const rule = ready.shift();
    if (!rule) {
      break;
    }

    ordered.push(rule);

    for (const dependentId of dependents.get(rule.id) ?? []) {
      const dependencies = remainingDependencies.get(dependentId);
      dependencies?.delete(rule.id);

      if (dependencies?.size === 0) {
        const dependentRule = byId.get(dependentId);
        if (dependentRule) {
          ready.push(dependentRule);
          ready.sort(compareRule);
        }
      }
    }
  }

  if (ordered.length !== rules.length) {
    throw new Error("rule dependency graph contains a cycle");
  }

  return ordered;
}

function toDiagnosticInput(
  rule: Rule,
  report: RuleReport,
  severity: Severity,
  confidence: Confidence,
  observedAt: string
): Parameters<typeof createDiagnostic>[0] {
  return {
    ...report,
    ruleId: rule.id,
    severity,
    confidence,
    observedAt: report.observedAt ?? observedAt
  };
}

export async function runRuleEngine(
  input: RuleEngineInput
): Promise<RuleEngineResult> {
  const suppressions = input.options?.suppressions ?? [];
  validateSuppressions(suppressions);

  const observedAt = input.options?.now ?? new Date().toISOString();
  const orderedRules = orderRules(input.rules);
  const routeContract =
    input.routeContract ??
    (input.routeContracts
      ? resolveRouteContract(input.snapshot, input.routeContracts)
      : undefined);
  const diagnostics: Diagnostic[] = [];

  for (const rule of orderedRules) {
    const context = {
      snapshot: input.snapshot,
      now: observedAt
    };
    const reports = await rule.run(
      routeContract ? { ...context, routeContract } : context
    );

    for (const report of reports) {
      const severity =
        input.options?.severityOverrides?.[rule.id] ??
        routeContract?.requiredSeverityOverrides?.[rule.id] ??
        report.severity ??
        rule.defaultSeverity;
      const confidence = report.confidence ?? rule.defaultConfidence;
      const diagnostic = createDiagnostic(
        toDiagnosticInput(rule, report, severity, confidence, observedAt)
      );

      if (!isSuppressed(diagnostic, suppressions)) {
        diagnostics.push(diagnostic);
      }
    }
  }

  diagnostics.sort((a, b) => {
    const pageDelta = a.pageUrl.localeCompare(b.pageUrl);
    if (pageDelta !== 0) {
      return pageDelta;
    }

    return a.id.localeCompare(b.id);
  });

  return {
    diagnostics,
    executedRuleIds: orderedRules.map((rule) => rule.id)
  };
}
