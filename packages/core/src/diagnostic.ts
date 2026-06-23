import { createDiagnosticFingerprint } from "./fingerprint.js";
import type { Diagnostic, DiagnosticInput, Suppression } from "./types.js";

export function createDiagnostic(input: DiagnosticInput): Diagnostic {
  if (input.ruleId.trim().length === 0) {
    throw new Error("diagnostic ruleId is required");
  }

  if (input.evidence.trim().length === 0) {
    throw new Error(`${input.ruleId} diagnostic evidence is required`);
  }

  if (input.severity === "blocker" && input.confidence === "heuristic") {
    throw new Error(`${input.ruleId} cannot emit a heuristic blocker`);
  }

  if (Number.isNaN(Date.parse(input.observedAt))) {
    throw new Error(
      `${input.ruleId} diagnostic observedAt must be an ISO date`
    );
  }

  const location = input.sourceLocation;
  if (
    location &&
    (location.file !== undefined || location.line !== undefined)
  ) {
    if (location.confidence !== "EXACT") {
      throw new Error(
        `${input.ruleId} cannot include file or line without EXACT source confidence`
      );
    }
  }

  const fingerprint = createDiagnosticFingerprint(input);

  return {
    ...input,
    id: `${input.ruleId}:${fingerprint.slice(0, 16)}`,
    fingerprint
  };
}

export function validateSuppressions(
  suppressions: readonly Suppression[]
): void {
  for (const suppression of suppressions) {
    if (suppression.ruleId.trim().length === 0) {
      throw new Error("suppression ruleId is required");
    }

    if (suppression.reason.trim().length === 0) {
      throw new Error(`${suppression.ruleId} suppression reason is required`);
    }
  }
}

export function isSuppressed(
  diagnostic: Diagnostic,
  suppressions: readonly Suppression[]
): boolean {
  return suppressions.some((suppression) => {
    if (suppression.ruleId !== diagnostic.ruleId) {
      return false;
    }

    if (suppression.pageUrl && suppression.pageUrl !== diagnostic.pageUrl) {
      return false;
    }

    if (suppression.route && suppression.route !== diagnostic.route) {
      return false;
    }

    return true;
  });
}
