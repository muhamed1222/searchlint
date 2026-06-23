import type { Diagnostic } from "@searchlint/core";

export type JUnitReportOptions = {
  suiteName?: string;
};

export function createJUnitReport(
  diagnostics: readonly Diagnostic[],
  options: JUnitReportOptions = {}
): string {
  const failures = diagnostics.filter(isFailure).length;
  const testCases = diagnostics.map(formatTestCase).join("");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<testsuite name="${escapeXml(options.suiteName ?? "SearchLint")}" tests="${diagnostics.length}" failures="${failures}" errors="0" skipped="0">`,
    testCases,
    "</testsuite>",
    ""
  ].join("\n");
}

function formatTestCase(diagnostic: Diagnostic): string {
  const name = `${diagnostic.ruleId} ${diagnostic.pageUrl}`;
  const attributes = `classname="${escapeXml(diagnostic.source)}" name="${escapeXml(name)}"`;
  if (!isFailure(diagnostic)) {
    return `  <testcase ${attributes} />`;
  }

  return [
    `  <testcase ${attributes}>`,
    `    <failure type="${escapeXml(diagnostic.severity)}" message="${escapeXml(diagnostic.title)}">${escapeXml(formatFailureBody(diagnostic))}</failure>`,
    "  </testcase>"
  ].join("\n");
}

function formatFailureBody(diagnostic: Diagnostic): string {
  return [
    diagnostic.evidence,
    diagnostic.expected ? `Expected: ${diagnostic.expected}` : undefined,
    diagnostic.actual ? `Actual: ${diagnostic.actual}` : undefined,
    `Confidence: ${diagnostic.confidence}`,
    `Observed: ${diagnostic.observedAt}`,
    `Fingerprint: ${diagnostic.fingerprint}`
  ]
    .filter((part): part is string => Boolean(part))
    .join("\n");
}

function isFailure(diagnostic: Diagnostic): boolean {
  return diagnostic.severity === "blocker" || diagnostic.severity === "error";
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
