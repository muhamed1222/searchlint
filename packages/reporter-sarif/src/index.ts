import type { Diagnostic, Severity } from "@searchlint/core";

export type SarifReportOptions = {
  toolName?: string;
  informationUri?: string;
};

export type SarifReport = {
  $schema: string;
  version: "2.1.0";
  runs: readonly SarifRun[];
};

export type SarifRun = {
  tool: {
    driver: {
      name: string;
      informationUri?: string;
      rules: readonly SarifRule[];
    };
  };
  results: readonly SarifResult[];
};

export type SarifRule = {
  id: string;
  name: string;
  shortDescription: {
    text: string;
  };
};

export type SarifResult = {
  ruleId: string;
  level: "error" | "warning" | "note";
  message: {
    text: string;
  };
  locations: readonly SarifLocation[];
  properties: Readonly<Record<string, string>>;
};

export type SarifLocation = {
  physicalLocation: {
    artifactLocation: {
      uri: string;
    };
    region?: {
      startLine: number;
    };
  };
};

export function createSarifReport(
  diagnostics: readonly Diagnostic[],
  options: SarifReportOptions = {}
): SarifReport {
  const rules = [
    ...new Map(
      diagnostics.map((diagnostic) => [diagnostic.ruleId, diagnostic])
    ).values()
  ]
    .map((diagnostic) => ({
      id: diagnostic.ruleId,
      name: diagnostic.ruleId,
      shortDescription: {
        text: diagnostic.title
      }
    }))
    .sort((left, right) => left.id.localeCompare(right.id));

  const driver = {
    name: options.toolName ?? "SearchLint",
    ...(options.informationUri
      ? { informationUri: options.informationUri }
      : {}),
    rules
  };

  return {
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    version: "2.1.0",
    runs: [
      {
        tool: { driver },
        results: diagnostics.map(toSarifResult)
      }
    ]
  };
}

export function stringifySarifReport(report: SarifReport): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}

function toSarifResult(diagnostic: Diagnostic): SarifResult {
  return {
    ruleId: diagnostic.ruleId,
    level: sarifLevel(diagnostic.severity),
    message: {
      text: [
        diagnostic.title,
        diagnostic.evidence,
        diagnostic.expected ? `Expected: ${diagnostic.expected}` : undefined,
        diagnostic.actual ? `Actual: ${diagnostic.actual}` : undefined
      ]
        .filter((part): part is string => Boolean(part))
        .join("\n")
    },
    locations: [sarifLocation(diagnostic)],
    properties: {
      severity: diagnostic.severity,
      confidence: diagnostic.confidence,
      source: diagnostic.source,
      pageUrl: diagnostic.pageUrl,
      observedAt: diagnostic.observedAt,
      fingerprint: diagnostic.fingerprint
    }
  };
}

function sarifLocation(diagnostic: Diagnostic): SarifLocation {
  const sourceLocation = diagnostic.sourceLocation;
  const uri =
    sourceLocation?.confidence === "EXACT" && sourceLocation.file
      ? sourceLocation.file
      : diagnostic.pageUrl;
  const physicalLocation: SarifLocation["physicalLocation"] = {
    artifactLocation: { uri }
  };

  if (
    sourceLocation?.confidence === "EXACT" &&
    sourceLocation.line !== undefined
  ) {
    physicalLocation.region = { startLine: sourceLocation.line };
  }

  return { physicalLocation };
}

function sarifLevel(severity: Severity): SarifResult["level"] {
  if (severity === "blocker" || severity === "error") {
    return "error";
  }
  if (severity === "warning") {
    return "warning";
  }
  return "note";
}
