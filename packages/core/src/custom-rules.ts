import type {
  Confidence,
  DiagnosticSource,
  Rule,
  RuleReport,
  Severity
} from "./types.js";

export type CustomRuleExecutionEnvironment = "local" | "cloud";

export type CustomRuleSandboxPolicy = {
  environment: CustomRuleExecutionEnvironment;
  maxRules?: number;
  maxReportsPerRule?: number;
  maxNeedleLength?: number;
  maxTextBytesPerRule?: number;
  maxEvaluationStepsPerRule?: number;
};

export type CustomRuleCondition =
  | {
      kind: "raw-html-includes";
      value: string;
    }
  | {
      kind: "rendered-dom-includes";
      value: string;
    }
  | {
      kind: "http-header-equals";
      name: string;
      value: string;
    }
  | {
      kind: "route-matches";
      value: string;
    }
  | {
      kind: "source-finding-kind-exists";
      value: string;
    };

export type CustomRuleDefinition = {
  id: string;
  defaultSeverity: Severity;
  defaultConfidence: Confidence;
  source: DiagnosticSource;
  title: string;
  evidence: string;
  expected?: string;
  actual?: string;
  conditions: readonly CustomRuleCondition[];
};

type ResolvedPolicy = Required<
  Pick<
    CustomRuleSandboxPolicy,
    | "maxRules"
    | "maxReportsPerRule"
    | "maxNeedleLength"
    | "maxTextBytesPerRule"
    | "maxEvaluationStepsPerRule"
  >
> &
  Pick<CustomRuleSandboxPolicy, "environment">;

const defaultPolicy: ResolvedPolicy = {
  environment: "local",
  maxRules: 50,
  maxReportsPerRule: 10,
  maxNeedleLength: 512,
  maxTextBytesPerRule: 1_000_000,
  maxEvaluationStepsPerRule: 100
};

const ruleIdPattern = /^[A-Z][A-Z0-9-]*-[A-Z0-9-]+$/u;

export function createLocalCustomRules(
  definitions: readonly CustomRuleDefinition[],
  policy: CustomRuleSandboxPolicy = { environment: "local" }
): readonly Rule[] {
  const resolvedPolicy = resolvePolicy(policy);
  if (definitions.length > resolvedPolicy.maxRules) {
    throw new Error(
      `custom rule count ${definitions.length} exceeds limit ${resolvedPolicy.maxRules}`
    );
  }

  return definitions.map((definition) =>
    createLocalCustomRule(definition, resolvedPolicy)
  );
}

export function createLocalCustomRule(
  definition: CustomRuleDefinition,
  policy: CustomRuleSandboxPolicy = { environment: "local" }
): Rule {
  const resolvedPolicy = resolvePolicy(policy);
  validateDefinition(definition, resolvedPolicy);

  return {
    id: definition.id,
    defaultSeverity: definition.defaultSeverity,
    defaultConfidence: definition.defaultConfidence,
    sources: [definition.source],
    run(context) {
      let steps = 0;
      const tick = () => {
        steps += 1;
        if (steps > resolvedPolicy.maxEvaluationStepsPerRule) {
          throw new Error(
            `${definition.id} exceeded custom rule evaluation step limit ${resolvedPolicy.maxEvaluationStepsPerRule}`
          );
        }
      };

      const reports: RuleReport[] = [];
      const matched = definition.conditions.every((condition) => {
        tick();
        return evaluateCondition(condition, context, resolvedPolicy);
      });

      if (matched) {
        const report: RuleReport = {
          pageUrl: context.snapshot.pageUrl,
          source: definition.source,
          title: definition.title,
          evidence: definition.evidence
        };
        if (context.snapshot.route) {
          report.route = context.snapshot.route;
        }
        if (definition.expected) {
          report.expected = definition.expected;
        }
        if (definition.actual) {
          report.actual = definition.actual;
        }
        reports.push(report);
      }

      if (reports.length > resolvedPolicy.maxReportsPerRule) {
        throw new Error(
          `${definition.id} exceeded custom rule report limit ${resolvedPolicy.maxReportsPerRule}`
        );
      }

      return reports;
    }
  };
}

function resolvePolicy(policy: CustomRuleSandboxPolicy): ResolvedPolicy {
  if (policy.environment !== "local") {
    throw new Error(
      "custom rule execution is local-only; cloud custom code execution is prohibited"
    );
  }

  return {
    environment: "local",
    maxRules: policy.maxRules ?? defaultPolicy.maxRules,
    maxReportsPerRule:
      policy.maxReportsPerRule ?? defaultPolicy.maxReportsPerRule,
    maxNeedleLength: policy.maxNeedleLength ?? defaultPolicy.maxNeedleLength,
    maxTextBytesPerRule:
      policy.maxTextBytesPerRule ?? defaultPolicy.maxTextBytesPerRule,
    maxEvaluationStepsPerRule:
      policy.maxEvaluationStepsPerRule ??
      defaultPolicy.maxEvaluationStepsPerRule
  };
}

function validateDefinition(
  definition: CustomRuleDefinition,
  policy: ResolvedPolicy
): void {
  if (!ruleIdPattern.test(definition.id)) {
    throw new Error(`invalid custom rule id ${definition.id}`);
  }
  if (definition.conditions.length === 0) {
    throw new Error(`${definition.id} must define at least one condition`);
  }
  if (definition.conditions.length > policy.maxEvaluationStepsPerRule) {
    throw new Error(
      `${definition.id} condition count ${definition.conditions.length} exceeds evaluation step limit ${policy.maxEvaluationStepsPerRule}`
    );
  }

  for (const condition of definition.conditions) {
    const values =
      condition.kind === "http-header-equals"
        ? [condition.name, condition.value]
        : [condition.value];
    for (const value of values) {
      if (value.length === 0) {
        throw new Error(`${definition.id} custom rule condition is empty`);
      }
      if (value.length > policy.maxNeedleLength) {
        throw new Error(
          `${definition.id} custom rule condition exceeds needle limit ${policy.maxNeedleLength}`
        );
      }
    }
  }
}

function evaluateCondition(
  condition: CustomRuleCondition,
  context: Parameters<Rule["run"]>[0],
  policy: ResolvedPolicy
): boolean {
  switch (condition.kind) {
    case "raw-html-includes":
      return boundedIncludes(
        context.snapshot.rawHtml,
        condition.value,
        policy.maxTextBytesPerRule
      );
    case "rendered-dom-includes":
      return boundedIncludes(
        context.snapshot.renderedDom,
        condition.value,
        policy.maxTextBytesPerRule
      );
    case "http-header-equals": {
      const actual =
        context.snapshot.http?.headers[condition.name.toLowerCase()] ??
        context.snapshot.http?.headers[condition.name];
      return actual === condition.value;
    }
    case "route-matches":
      return context.snapshot.route === condition.value;
    case "source-finding-kind-exists":
      return (
        context.snapshot.sourceCode?.findings?.some(
          (finding) => finding.kind === condition.value
        ) ?? false
      );
  }
}

function boundedIncludes(
  source: string | undefined,
  needle: string,
  maxTextBytes: number
): boolean {
  if (!source) {
    return false;
  }
  if (utf8ByteLength(source) > maxTextBytes) {
    throw new Error(
      `custom rule text input exceeds limit ${maxTextBytes} byte(s)`
    );
  }
  return source.includes(needle);
}

function utf8ByteLength(value: string): number {
  let length = 0;
  for (const char of value) {
    const codePoint = char.codePointAt(0) ?? 0;
    if (codePoint <= 0x7f) {
      length += 1;
    } else if (codePoint <= 0x7ff) {
      length += 2;
    } else if (codePoint <= 0xffff) {
      length += 3;
    } else {
      length += 4;
    }
  }
  return length;
}
