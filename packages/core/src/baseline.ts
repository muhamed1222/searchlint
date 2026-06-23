import type { Diagnostic } from "./types.js";

export type BaselineEntry = {
  fingerprint: string;
  ruleId?: string;
  pageUrl?: string;
  acceptedAt?: string;
  reason?: string;
};

export type BaselineComparisonResult = {
  newDiagnostics: readonly Diagnostic[];
  unchangedDiagnostics: readonly Diagnostic[];
  resolvedBaselineEntries: readonly BaselineEntry[];
};

export function compareDiagnosticsToBaseline(
  diagnostics: readonly Diagnostic[],
  baselineEntries: readonly BaselineEntry[]
): BaselineComparisonResult {
  const baselineByFingerprint = new Map<string, BaselineEntry>();
  for (const entry of baselineEntries) {
    if (!baselineByFingerprint.has(entry.fingerprint)) {
      baselineByFingerprint.set(entry.fingerprint, entry);
    }
  }

  const currentFingerprints = new Set<string>();
  const newDiagnostics: Diagnostic[] = [];
  const unchangedDiagnostics: Diagnostic[] = [];

  for (const diagnostic of diagnostics) {
    currentFingerprints.add(diagnostic.fingerprint);
    if (baselineByFingerprint.has(diagnostic.fingerprint)) {
      unchangedDiagnostics.push(diagnostic);
    } else {
      newDiagnostics.push(diagnostic);
    }
  }

  const resolvedBaselineEntries = [...baselineByFingerprint.values()].filter(
    (entry) => !currentFingerprints.has(entry.fingerprint)
  );

  return {
    newDiagnostics,
    unchangedDiagnostics,
    resolvedBaselineEntries
  };
}
