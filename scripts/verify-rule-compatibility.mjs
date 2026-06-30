#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const catalogPath = path.join(repoRoot, "specs/RULE_CATALOG.yaml");
const baselinePath = path.join(
  repoRoot,
  "specs/RULE_COMPATIBILITY_BASELINE.json"
);
const reportPath = path.join(
  repoRoot,
  "reports/rule-compatibility-report.json"
);
const samplePath = path.join(
  repoRoot,
  "docs/examples/rule-compatibility-report.sample.json"
);
const fixedGeneratedAt = "2026-06-22T00:00:00.000Z";
const writeBaseline = process.argv.includes("--write-baseline");

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    env: { ...process.env, ...options.env },
    encoding: "utf8",
    stdio: options.stdio ?? "pipe"
  });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  run("pnpm", ["build"], { stdio: "inherit" });
  const core = await import("../packages/core/dist/src/index.js");
  const catalog = core.parseRuleCatalogYaml(
    await readFile(catalogPath, "utf8")
  );
  const current = createBaseline(catalog, core);

  if (writeBaseline) {
    await writeJson(baselinePath, current);
  }

  const baseline = JSON.parse(await readFile(baselinePath, "utf8"));
  const findings = compareBaseline(baseline, current);
  const status = findings.length === 0 ? "passed" : "failed";
  const report = {
    generatedBy: "searchlint-rule-compatibility-verifier",
    generatedAt: new Date().toISOString(),
    status,
    baselineVersion: baseline.baselineVersion,
    catalogVersion: current.catalogVersion,
    summary: {
      baselineRuleCount: baseline.rules.length,
      currentRuleCount: current.rules.length,
      findingCount: findings.length,
      compatibilityExceptionCount: baseline.compatibilityExceptions.length
    },
    findings
  };
  const sample = {
    ...report,
    generatedAt: fixedGeneratedAt
  };

  await mkdir(path.dirname(reportPath), { recursive: true });
  await mkdir(path.dirname(samplePath), { recursive: true });
  await writeJson(reportPath, report);
  await writeJson(samplePath, sample);

  assert(status === "passed", "rule compatibility verification failed");

  console.log(
    `Rule compatibility PASS: ${current.rules.length} rule IDs, ${baseline.compatibilityExceptions.length} compatibility exception(s)`
  );
  console.log(`Report: ${path.relative(repoRoot, reportPath)}`);
  console.log(`Sample: ${path.relative(repoRoot, samplePath)}`);
}

function createBaseline(catalog, core) {
  return {
    baselineVersion: "searchlint-1.0.0-rule-compatibility",
    generatedAt: fixedGeneratedAt,
    catalogVersion: catalog.version,
    ruleCount: catalog.rules.length,
    compatibilityExceptions: [],
    rules: catalog.rules.map((rule) => ({
      id: rule.id,
      name: rule.name,
      category: rule.category,
      defaultSeverity: rule.defaultSeverity,
      confidence: rule.confidence,
      scope: rule.scope,
      sources: rule.sources,
      providerScope: rule.providerScope,
      version: rule.version,
      fingerprintSample: core.createDiagnosticFingerprint({
        ruleId: rule.id,
        severity: rule.defaultSeverity,
        confidence: rule.confidence,
        pageUrl: `https://compatibility.searchlint.test/rules/${rule.id}`,
        source: rule.sources[0],
        title: rule.name,
        evidence: `Compatibility baseline evidence for ${rule.id}.`,
        observedAt: fixedGeneratedAt
      })
    }))
  };
}

function compareBaseline(baseline, current) {
  const findings = [];
  const exceptions = new Set(
    baseline.compatibilityExceptions.map(
      (item) => `${item.ruleId}:${item.field}`
    )
  );
  const baselineById = new Map(baseline.rules.map((rule) => [rule.id, rule]));
  const currentById = new Map(current.rules.map((rule) => [rule.id, rule]));

  for (const rule of baseline.rules) {
    const currentRule = currentById.get(rule.id);
    if (!currentRule) {
      findings.push(finding(rule.id, "removed-rule", "rule ID was removed"));
      continue;
    }
    compareField(findings, exceptions, rule, currentRule, "name");
    compareField(findings, exceptions, rule, currentRule, "category");
    compareField(findings, exceptions, rule, currentRule, "defaultSeverity");
    compareField(findings, exceptions, rule, currentRule, "confidence");
    compareField(findings, exceptions, rule, currentRule, "scope");
    compareField(findings, exceptions, rule, currentRule, "providerScope");
    compareField(findings, exceptions, rule, currentRule, "version");
    compareField(findings, exceptions, rule, currentRule, "fingerprintSample");
    compareArrayField(findings, exceptions, rule, currentRule, "sources");
  }

  for (const rule of current.rules) {
    if (!baselineById.has(rule.id)) {
      findings.push(
        finding(
          rule.id,
          "new-rule-without-baseline",
          "rule ID is not in baseline"
        )
      );
    }
  }

  return findings;
}

function compareField(findings, exceptions, baselineRule, currentRule, field) {
  if (baselineRule[field] === currentRule[field]) {
    return;
  }
  if (exceptions.has(`${baselineRule.id}:${field}`)) {
    return;
  }
  findings.push(
    finding(
      baselineRule.id,
      `${field}-changed`,
      `${field} changed from ${JSON.stringify(baselineRule[field])} to ${JSON.stringify(currentRule[field])}`
    )
  );
}

function compareArrayField(
  findings,
  exceptions,
  baselineRule,
  currentRule,
  field
) {
  if (
    JSON.stringify(baselineRule[field]) === JSON.stringify(currentRule[field])
  ) {
    return;
  }
  if (exceptions.has(`${baselineRule.id}:${field}`)) {
    return;
  }
  findings.push(
    finding(
      baselineRule.id,
      `${field}-changed`,
      `${field} changed from ${JSON.stringify(baselineRule[field])} to ${JSON.stringify(currentRule[field])}`
    )
  );
}

function finding(ruleId, code, message) {
  return { ruleId, code, message };
}

async function writeJson(filePath, data) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
