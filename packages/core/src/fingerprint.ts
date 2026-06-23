import type { DiagnosticInput } from "./types.js";

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => canonicalize(item));
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(record)
        .filter((key) => record[key] !== undefined)
        .sort()
        .map((key) => [key, canonicalize(record[key])])
    );
  }

  return value;
}

export function createDiagnosticFingerprint(input: DiagnosticInput): string {
  const stablePayload = canonicalize({
    ruleId: input.ruleId,
    pageUrl: input.pageUrl,
    route: input.route,
    source: input.source,
    evidence: input.evidence,
    expected: input.expected,
    actual: input.actual,
    sourceLocation: input.sourceLocation
  });

  return stableHash(JSON.stringify(stablePayload));
}

function stableHash(value: string): string {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;

  for (const character of value) {
    hash ^= BigInt(character.codePointAt(0) ?? 0);
    hash = (hash * prime) & mask;
  }

  return hash.toString(16).padStart(16, "0");
}
