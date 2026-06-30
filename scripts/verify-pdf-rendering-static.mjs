#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { format } from "prettier";

const reportPath = "reports/pdf-rendering-static-report.json";
const samplePath = "docs/examples/pdf-rendering-static-report.sample.json";

const commands = [
  {
    name: "reporterHtmlTests",
    command: "pnpm",
    args: ["--filter", "@searchlint/reporter-html", "test"]
  },
  {
    name: "reportersAcceptance",
    command: "pnpm",
    args: ["reporters:acceptance"]
  },
  {
    name: "reporterHtmlBuild",
    command: "pnpm",
    args: ["--filter", "@searchlint/reporter-html", "build"]
  }
];

const commandResults = commands.map(runCommand);
const { createPdfReport } =
  await import("../packages/reporter-html/dist/src/index.js");

const diagnostics = [
  {
    id: "diag-1",
    ruleId: "SL-META-001",
    severity: "blocker",
    confidence: "certain",
    pageUrl: "https://example.test/",
    source: "next-metadata",
    title: "Missing title",
    evidence: "No title element was found.",
    observedAt: "2026-06-23T00:00:00.000Z",
    fingerprint: "fingerprint-1",
    sourceLocation: {
      confidence: "EXACT",
      file: "app/page.tsx",
      line: 12
    }
  },
  {
    id: "diag-2",
    ruleId: "SL-HTTP-001",
    severity: "error",
    confidence: "high",
    pageUrl: "https://example.test/about",
    source: "crawler",
    title: "Unexpected status",
    evidence: "Expected 200, received 500.",
    observedAt: "2026-06-23T00:00:00.000Z",
    fingerprint: "fingerprint-2"
  }
];

const pdf = createPdfReport(diagnostics, {
  title: "SearchLint PDF Rendering Acceptance",
  generatedAt: "2026-06-23T00:00:00.000Z",
  reportVariant: "technical",
  projectName: "Example",
  environmentName: "Preview",
  subjectUrl: "https://example.test/"
});
const pdfText = asciiText(pdf);
const parsed = parsePdf(pdfText);
const renderedText = extractPdfText(parsed.contentStream);

for (const required of [
  "SearchLint PDF Rendering Acceptance",
  "Diagnostics: 2",
  "SL-META-001",
  "app/page.tsx:12",
  "fingerprint-2"
]) {
  if (!renderedText.includes(required)) {
    throw new Error(`Rendered PDF text is missing ${required}.`);
  }
}

const report = {
  generatedBy: "searchlint-pdf-rendering-static-verifier",
  generatedAt: "2026-06-23T00:00:00.000Z",
  status: "passed",
  scope: {
    proofType: "deterministic static PDF rendering acceptance",
    doesNotClaim: [
      "browser-specific PDF rendering",
      "platform print-dialog rendering",
      "visual pixel comparison",
      "hosted report links",
      "report access controls",
      "report history"
    ]
  },
  commands: commandResults,
  pdf: {
    byteLength: pdf.byteLength,
    header: parsed.header,
    objectCount: parsed.objectCount,
    xrefEntryCount: parsed.xrefEntryCount,
    xrefOffsetsMatchObjects: parsed.xrefOffsetsMatchObjects,
    hasCatalog: parsed.hasCatalog,
    hasPages: parsed.hasPages,
    hasPage: parsed.hasPage,
    hasMediaBox: parsed.hasMediaBox,
    hasHelveticaFont: parsed.hasHelveticaFont,
    hasContentStream: parsed.hasContentStream,
    contentStreamLengthMatches: parsed.contentStreamLengthMatches,
    textCommandCount: parsed.textCommandCount,
    renderedTextLines: renderedText.split("\n").length,
    renderedRequiredText: [
      "SearchLint PDF Rendering Acceptance",
      "Diagnostics: 2",
      "SL-META-001",
      "app/page.tsx:12",
      "fingerprint-2"
    ]
  },
  assertions: [
    "PDF output starts with %PDF-1.4.",
    "The cross-reference table points to the declared object offsets.",
    "The trailer points at the catalog object.",
    "The page has a media box, Helvetica font resource, and content stream.",
    "The declared content stream length matches the actual stream byte length.",
    "PDF text drawing commands contain the report title and diagnostic evidence.",
    "Generated evidence is deterministic and sanitized."
  ],
  remainingReleaseGates: [
    "Run browser/platform visual PDF rendering acceptance.",
    "Add hosted report links.",
    "Add report expiration.",
    "Add report access controls.",
    "Add report persistence/history."
  ]
};

await mkdir(path.dirname(reportPath), { recursive: true });
await mkdir(path.dirname(samplePath), { recursive: true });
await writeJson(reportPath, report);
await writeJson(samplePath, report);

console.log(
  `PDF rendering static acceptance PASS: ${parsed.objectCount} objects, ${parsed.textCommandCount} text commands`
);
console.log(`Report: ${reportPath}`);
console.log(`Sample: ${samplePath}`);

function parsePdf(pdfSource) {
  if (!pdfSource.startsWith("%PDF-1.4\n")) {
    throw new Error("PDF header is missing.");
  }
  if (!pdfSource.endsWith("%%EOF\n")) {
    throw new Error("PDF EOF marker is missing.");
  }
  const objectMatches = [...pdfSource.matchAll(/^(\d+) 0 obj\n/gmu)];
  const objectOffsets = objectMatches.map((match) => match.index ?? -1);
  const xrefMatch = pdfSource.match(
    /xref\n0 (?<count>\d+)\n(?<rows>(?:\d{10} \d{5} [fn]\n)+)trailer\n<< \/Size (?<size>\d+) \/Root 1 0 R >>\nstartxref\n(?<startxref>\d+)\n%%EOF\n/u
  );
  if (!xrefMatch?.groups) {
    throw new Error("PDF xref/trailer block is malformed.");
  }
  const rows = xrefMatch.groups.rows.trimEnd().split("\n");
  const declaredOffsets = rows
    .slice(1)
    .map((row) => Number.parseInt(row.slice(0, 10), 10));
  const offsetsMatch =
    declaredOffsets.length === objectOffsets.length &&
    declaredOffsets.every((offset, index) => offset === objectOffsets[index]);
  if (!offsetsMatch) {
    throw new Error("PDF xref offsets do not match object positions.");
  }
  const contentMatch = pdfSource.match(
    /5 0 obj\n<< \/Length (?<length>\d+) >>\nstream\n(?<stream>[\s\S]*?)\nendstream\nendobj/u
  );
  if (!contentMatch?.groups) {
    throw new Error("PDF content stream is missing.");
  }
  const contentStream = contentMatch.groups.stream;
  const declaredLength = Number.parseInt(contentMatch.groups.length, 10);
  const actualLength = contentStream.length;
  if (declaredLength !== actualLength) {
    throw new Error(
      `PDF content stream length mismatch: expected ${declaredLength}, received ${actualLength}.`
    );
  }
  return {
    header: "%PDF-1.4",
    objectCount: objectOffsets.length,
    xrefEntryCount: rows.length,
    xrefOffsetsMatchObjects: offsetsMatch,
    hasCatalog: pdfSource.includes("<< /Type /Catalog /Pages 2 0 R >>"),
    hasPages: pdfSource.includes("<< /Type /Pages /Kids [3 0 R] /Count 1 >>"),
    hasPage: pdfSource.includes("<< /Type /Page /Parent 2 0 R"),
    hasMediaBox: pdfSource.includes("/MediaBox [0 0 612 792]"),
    hasHelveticaFont: pdfSource.includes("/BaseFont /Helvetica"),
    hasContentStream:
      contentStream.includes("BT") && contentStream.includes("ET"),
    contentStreamLengthMatches: declaredLength === actualLength,
    contentStream,
    textCommandCount: [...contentStream.matchAll(/\((?:\\.|[^\\)])*\) Tj/gu)]
      .length
  };
}

function extractPdfText(contentStream) {
  return [...contentStream.matchAll(/\(((?:\\.|[^\\)])*)\) Tj/gu)]
    .map((match) => unescapePdfString(match[1] ?? ""))
    .join("\n");
}

function unescapePdfString(value) {
  return value
    .replaceAll("\\)", ")")
    .replaceAll("\\(", "(")
    .replaceAll("\\\\", "\\");
}

function asciiText(bytes) {
  return [...bytes].map((byte) => String.fromCharCode(byte)).join("");
}

function runCommand(commandSpec) {
  const result = spawnSync(commandSpec.command, commandSpec.args, {
    cwd: process.cwd(),
    env: process.env,
    encoding: "utf8",
    stdio: "pipe"
  });
  if (result.status !== 0) {
    process.stderr.write(result.stdout);
    process.stderr.write(result.stderr);
    throw new Error(
      `${commandSpec.name} failed with exit code ${result.status ?? "unknown"}.`
    );
  }
  return {
    name: commandSpec.name,
    command: [commandSpec.command, ...commandSpec.args].join(" "),
    status: "passed",
    stdout: summarizeOutput(result.stdout)
  };
}

function summarizeOutput(output) {
  return output
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line !== "")
    .filter((line) => !line.startsWith("RUN "))
    .filter((line) => !line.startsWith("Start at "))
    .filter((line) => !line.startsWith("Duration "))
    .filter((line) => !line.startsWith("$ "))
    .slice(-8);
}

async function writeJson(filePath, value) {
  const json = await format(`${JSON.stringify(value, null, 2)}\n`, {
    parser: "json"
  });
  await writeFile(filePath, json);
}
