import type { Diagnostic, Severity } from "@searchlint/core";

export type HtmlReportOptions = {
  title?: string;
  generatedAt?: string;
  projectName?: string;
  environmentName?: string;
  subjectUrl?: string;
  brandLabel?: string;
  reportVariant?: HtmlReportVariant;
  audience?: HtmlReportAudience;
  comparison?: HtmlReportComparison;
  deployment?: HtmlReportDeployment;
  externalObservations?: readonly HtmlReportExternalObservation[];
};

export type PdfReportOptions = HtmlReportOptions & {
  maxDiagnostics?: number;
};

export type ReportSeverityCounts = Readonly<Record<Severity, number>>;

export type HtmlReportVariant =
  | "technical"
  | "client"
  | "executive"
  | "before-after"
  | "deployment"
  | "google"
  | "yandex"
  | "white-label";

export type HtmlReportAudience =
  | "developer"
  | "client"
  | "executive"
  | "agency"
  | "seo-operator";

export type HtmlReportComparison = {
  previousLabel: string;
  currentLabel: string;
  newDiagnostics: number;
  resolvedDiagnostics: number;
  unchangedDiagnostics: number;
  severityDelta: Readonly<Partial<Record<Severity, number>>>;
};

export type HtmlReportDeployment = {
  deploymentId: string;
  commitRef?: string;
  deployedAt: string;
  environmentName: string;
  status: "candidate" | "blocked" | "released" | "rolled-back";
};

export type HtmlReportExternalObservation = {
  id: string;
  provider: "google" | "yandex";
  source: string;
  subjectUrl: string;
  observedAt: string;
  fetchedAt: string;
  freshness: "fresh" | "stale" | "expired" | "unknown";
  quota?: {
    limit?: number;
    remaining?: number;
    resetAt?: string;
  };
  sampling?: {
    sampled: boolean;
    state?: string;
  };
  payload?: Readonly<Record<string, unknown>>;
};

export type ReportCategoryCount = {
  category: string;
  count: number;
};

export type HtmlReportSummary = {
  title: string;
  generatedAt: string;
  projectName?: string;
  environmentName?: string;
  subjectUrl?: string;
  brandLabel?: string;
  reportVariant: HtmlReportVariant;
  audience: HtmlReportAudience;
  totalDiagnostics: number;
  affectedPages: number;
  severityCounts: ReportSeverityCounts;
  blockerAndErrorCount: number;
  topRuleCategories: readonly ReportCategoryCount[];
};

export function createReportSummary(
  diagnostics: readonly Diagnostic[],
  options: HtmlReportOptions = {}
): HtmlReportSummary {
  const severityCounts: Record<Severity, number> = {
    blocker: 0,
    error: 0,
    warning: 0,
    info: 0
  };
  const pages = new Set<string>();
  const categories = new Map<string, number>();

  for (const diagnostic of diagnostics) {
    severityCounts[diagnostic.severity] += 1;
    pages.add(diagnostic.pageUrl);
    const category = categoryFromRuleId(diagnostic.ruleId);
    categories.set(category, (categories.get(category) ?? 0) + 1);
  }

  return {
    title: options.title ?? "SearchLint Report",
    generatedAt: options.generatedAt ?? new Date(0).toISOString(),
    ...(options.projectName === undefined
      ? {}
      : { projectName: options.projectName }),
    ...(options.environmentName === undefined
      ? {}
      : { environmentName: options.environmentName }),
    ...(options.subjectUrl === undefined
      ? {}
      : { subjectUrl: options.subjectUrl }),
    ...(options.brandLabel === undefined
      ? {}
      : { brandLabel: options.brandLabel }),
    reportVariant: options.reportVariant ?? "technical",
    audience: options.audience ?? "developer",
    totalDiagnostics: diagnostics.length,
    affectedPages: pages.size,
    severityCounts,
    blockerAndErrorCount: severityCounts.blocker + severityCounts.error,
    topRuleCategories: [...categories.entries()]
      .map(([category, count]) => ({ category, count }))
      .sort((left, right) => {
        const countOrder = right.count - left.count;
        return countOrder === 0
          ? left.category.localeCompare(right.category)
          : countOrder;
      })
  };
}

export function createHtmlReport(
  diagnostics: readonly Diagnostic[],
  options: HtmlReportOptions = {}
): string {
  const sortedDiagnostics = [...diagnostics].sort(compareDiagnostics);
  const summary = createReportSummary(sortedDiagnostics, options);
  const externalObservations = [...(options.externalObservations ?? [])].sort(
    compareExternalObservations
  );
  return stringifyHtmlReport(summary, sortedDiagnostics, externalObservations, {
    ...(options.comparison === undefined
      ? {}
      : { comparison: options.comparison }),
    ...(options.deployment === undefined
      ? {}
      : { deployment: options.deployment })
  });
}

export function createPdfReport(
  diagnostics: readonly Diagnostic[],
  options: PdfReportOptions = {}
): Uint8Array {
  const sortedDiagnostics = [...diagnostics].sort(compareDiagnostics);
  const summary = createReportSummary(sortedDiagnostics, options);
  const maxDiagnostics = options.maxDiagnostics ?? 25;
  const lines = pdfReportLines(summary, sortedDiagnostics, maxDiagnostics);
  return createSimplePdfDocument(lines);
}

export function stringifyHtmlReport(
  summary: HtmlReportSummary,
  diagnostics: readonly Diagnostic[],
  externalObservations: readonly HtmlReportExternalObservation[] = [],
  sections: {
    comparison?: HtmlReportComparison;
    deployment?: HtmlReportDeployment;
  } = {}
): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(summary.title)}</title>
  <style>
    :root {
      color-scheme: light;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #f8fafc;
      color: #0f172a;
    }
    body {
      margin: 0;
      background: #f8fafc;
    }
    main {
      max-width: 1120px;
      margin: 0 auto;
      padding: 32px 24px 56px;
    }
    header,
    section {
      border-bottom: 1px solid #cbd5e1;
      padding: 24px 0;
    }
    h1,
    h2,
    h3,
    p {
      margin: 0;
    }
    h1 {
      font-size: 30px;
      line-height: 1.2;
    }
    h2 {
      font-size: 20px;
      line-height: 1.3;
      margin-bottom: 16px;
    }
    h3 {
      font-size: 16px;
      line-height: 1.4;
      margin-bottom: 8px;
    }
    .meta,
    .muted {
      color: #475569;
      font-size: 14px;
    }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
      margin-top: 18px;
    }
    .metric,
    .diagnostic {
      border: 1px solid #cbd5e1;
      background: #ffffff;
      padding: 14px;
    }
    .metric strong {
      display: block;
      font-size: 24px;
      margin-top: 4px;
    }
    .severity-blocker {
      border-left: 5px solid #7f1d1d;
    }
    .severity-error {
      border-left: 5px solid #dc2626;
    }
    .severity-warning {
      border-left: 5px solid #d97706;
    }
    .severity-info {
      border-left: 5px solid #2563eb;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }
    th,
    td {
      border-bottom: 1px solid #e2e8f0;
      padding: 8px;
      text-align: left;
      vertical-align: top;
    }
    .diagnostic + .diagnostic {
      margin-top: 12px;
    }
    dl {
      display: grid;
      grid-template-columns: 160px 1fr;
      gap: 6px 12px;
      margin: 12px 0 0;
      font-size: 14px;
    }
    dt {
      color: #475569;
    }
    dd {
      margin: 0;
    }
    @media print {
      body {
        background: #ffffff;
      }
      main {
        max-width: none;
        padding: 0;
      }
      header,
      section {
        break-inside: avoid;
      }
      .diagnostic {
        break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <main>
    ${renderHeader(summary)}
    ${renderExecutiveSummary(summary)}
    ${renderTechnicalSummary(summary)}
    ${renderAgencySummary(summary)}
    ${renderDeveloperDiagnostics(diagnostics)}
    ${renderComparison(sections.comparison)}
    ${renderDeployment(sections.deployment)}
    ${renderExternalObservations(externalObservations)}
    ${renderPdfReadiness()}
  </main>
</body>
</html>
`;
}

function pdfReportLines(
  summary: HtmlReportSummary,
  diagnostics: readonly Diagnostic[],
  maxDiagnostics: number
): readonly string[] {
  const lines = [
    summary.title,
    `Generated: ${summary.generatedAt}`,
    `Report type: ${summary.reportVariant}`,
    `Audience: ${summary.audience}`,
    summary.projectName === undefined ? "" : `Project: ${summary.projectName}`,
    summary.environmentName === undefined
      ? ""
      : `Environment: ${summary.environmentName}`,
    summary.subjectUrl === undefined ? "" : `Subject: ${summary.subjectUrl}`,
    `Diagnostics: ${summary.totalDiagnostics}`,
    `Affected pages: ${summary.affectedPages}`,
    `Blocker/error diagnostics: ${summary.blockerAndErrorCount}`,
    `Severity counts: blocker ${summary.severityCounts.blocker}, error ${summary.severityCounts.error}, warning ${summary.severityCounts.warning}, info ${summary.severityCounts.info}`,
    "Diagnostics"
  ].filter((line) => line !== "");
  const diagnosticLines = diagnostics.slice(0, maxDiagnostics).map((item) => {
    const location =
      item.sourceLocation?.confidence === "EXACT"
        ? ` ${item.sourceLocation.file}:${item.sourceLocation.line}`
        : "";
    return `${item.severity.toUpperCase()} ${item.ruleId} ${item.title} ${item.pageUrl}${location} ${item.fingerprint}`;
  });
  const omittedCount = diagnostics.length - diagnosticLines.length;
  return [
    ...lines,
    ...(diagnosticLines.length === 0
      ? ["No diagnostics were provided."]
      : diagnosticLines),
    ...(omittedCount > 0
      ? [`${omittedCount} diagnostics omitted from this PDF summary.`]
      : []),
    "This PDF is generated directly by SearchLint from deterministic report input."
  ];
}

function createSimplePdfDocument(lines: readonly string[]): Uint8Array {
  const escapedLines = lines
    .flatMap((line) => wrapPdfLine(asciiOnly(line), 96))
    .slice(0, 42);
  const textCommands = escapedLines
    .map((line, index) =>
      index === 0
        ? `(${escapePdfString(line)}) Tj`
        : `0 -16 Td (${escapePdfString(line)}) Tj`
    )
    .join("\n");
  const content = `BT
/F1 11 Tf
50 790 Td
${textCommands}
ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${byteLength(content)} >>\nstream\n${content}\nendstream`
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xrefOffset = byteLength(pdf);
  const xrefRows = [
    "0000000000 65535 f",
    ...offsets
      .slice(1)
      .map((offset) => `${offset.toString().padStart(10, "0")} 00000 n`)
  ];
  pdf += `xref
0 ${objects.length + 1}
${xrefRows.join("\n")}
trailer
<< /Size ${objects.length + 1} /Root 1 0 R >>
startxref
${xrefOffset}
%%EOF
`;
  return asciiBytes(pdf);
}

function byteLength(value: string): number {
  return value.length;
}

function asciiBytes(value: string): Uint8Array {
  const bytes = new Uint8Array(value.length);
  for (let index = 0; index < value.length; index += 1) {
    bytes[index] = value.charCodeAt(index) & 0x7f;
  }
  return bytes;
}

function wrapPdfLine(value: string, maxLength: number): readonly string[] {
  if (value.length <= maxLength) {
    return [value];
  }
  const chunks: string[] = [];
  for (let index = 0; index < value.length; index += maxLength) {
    chunks.push(value.slice(index, index + maxLength));
  }
  return chunks;
}

function escapePdfString(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)");
}

function asciiOnly(value: string): string {
  return value.replace(/[^\x20-\x7e]/gu, "?");
}

function renderHeader(summary: HtmlReportSummary): string {
  return `<header>
  <h1>${escapeHtml(summary.title)}</h1>
  <p class="meta">Generated ${escapeHtml(summary.generatedAt)}</p>
  ${summary.projectName ? `<p class="meta">Project: ${escapeHtml(summary.projectName)}</p>` : ""}
  ${summary.environmentName ? `<p class="meta">Environment: ${escapeHtml(summary.environmentName)}</p>` : ""}
  ${summary.subjectUrl ? `<p class="meta">Subject: ${escapeHtml(summary.subjectUrl)}</p>` : ""}
  ${summary.brandLabel ? `<p class="meta">Prepared by ${escapeHtml(summary.brandLabel)}</p>` : ""}
  <p class="meta">Report type: ${escapeHtml(summary.reportVariant)}</p>
  <p class="meta">Audience: ${escapeHtml(summary.audience)}</p>
</header>`;
}

function renderExecutiveSummary(summary: HtmlReportSummary): string {
  const recommendation =
    summary.blockerAndErrorCount > 0
      ? "Resolve blocker and error diagnostics before treating this release as SEO-safe."
      : "No blocker or error diagnostics were found in this report input.";
  return `<section aria-labelledby="executive-summary">
  <h2 id="executive-summary">Executive Summary</h2>
  <p>${escapeHtml(recommendation)}</p>
  <div class="summary-grid">
    ${metric("Total diagnostics", summary.totalDiagnostics)}
    ${metric("Affected pages", summary.affectedPages)}
    ${metric("Blockers", summary.severityCounts.blocker)}
    ${metric("Errors", summary.severityCounts.error)}
    ${metric("Warnings", summary.severityCounts.warning)}
    ${metric("Info", summary.severityCounts.info)}
    ${metric("Blockers + errors", summary.blockerAndErrorCount)}
    ${metric("Top categories", summary.topRuleCategories.length)}
  </div>
  ${renderTopCategories(summary)}
</section>`;
}

function renderTechnicalSummary(summary: HtmlReportSummary): string {
  return `<section aria-labelledby="technical-report">
  <h2 id="technical-report">Technical Report</h2>
  <p>This report preserves deterministic diagnostic identifiers, exact evidence, source confidence, observed timestamps, and fingerprints for CLI, CI, baseline, and suppression workflows.</p>
  <p class="muted">Only source locations with EXACT confidence are rendered as file and line locations.</p>
</section>`;
}

function renderAgencySummary(summary: HtmlReportSummary): string {
  return `<section aria-labelledby="agency-summary">
  <h2 id="agency-summary">Client / White-Label Summary</h2>
  <p>${escapeHtml(summary.brandLabel ?? "SearchLint")} found ${summary.totalDiagnostics} diagnostic(s) across ${summary.affectedPages} affected page(s).</p>
  <p class="muted">This local report does not include cloud workspaces, RBAC, billing, client portals, hosted share links, or unsupported traffic/ranking claims.</p>
</section>`;
}

function renderDeveloperDiagnostics(
  diagnostics: readonly Diagnostic[]
): string {
  const body =
    diagnostics.length === 0
      ? '<p class="muted">No diagnostics were found.</p>'
      : diagnostics.map(renderDiagnostic).join("\n");
  return `<section aria-labelledby="developer-diagnostics">
  <h2 id="developer-diagnostics">Developer Diagnostics</h2>
  ${body}
</section>`;
}

function renderDiagnostic(diagnostic: Diagnostic): string {
  const sourceLocation = diagnostic.sourceLocation;
  const exactLocation =
    sourceLocation?.confidence === "EXACT" && sourceLocation.file
      ? `${sourceLocation.file}${sourceLocation.line === undefined ? "" : `:${sourceLocation.line}`}`
      : undefined;
  return `<article class="diagnostic severity-${diagnostic.severity}">
  <h3>${escapeHtml(diagnostic.ruleId)} ${escapeHtml(diagnostic.title)}</h3>
  <p>${escapeHtml(diagnostic.evidence)}</p>
  <dl>
    ${detail("Severity", diagnostic.severity)}
    ${detail("Confidence", diagnostic.confidence)}
    ${detail("Source", diagnostic.source)}
    ${detail("Page", diagnostic.pageUrl)}
    ${diagnostic.route ? detail("Route", diagnostic.route) : ""}
    ${diagnostic.expected ? detail("Expected", diagnostic.expected) : ""}
    ${diagnostic.actual ? detail("Actual", diagnostic.actual) : ""}
    ${exactLocation ? detail("Exact source", exactLocation) : ""}
    ${sourceLocation?.selector ? detail("Selector", sourceLocation.selector) : ""}
    ${detail("Observed", diagnostic.observedAt)}
    ${detail("Fingerprint", diagnostic.fingerprint)}
  </dl>
</article>`;
}

function renderTopCategories(summary: HtmlReportSummary): string {
  if (summary.topRuleCategories.length === 0) {
    return '<p class="muted">No rule categories were triggered.</p>';
  }
  return `<table aria-label="Top rule categories">
  <thead><tr><th>Category</th><th>Diagnostics</th></tr></thead>
  <tbody>
    ${summary.topRuleCategories
      .map(
        (entry) =>
          `<tr><td>${escapeHtml(entry.category)}</td><td>${entry.count}</td></tr>`
      )
      .join("\n")}
  </tbody>
</table>`;
}

function renderComparison(
  comparison: HtmlReportComparison | undefined
): string {
  if (!comparison) {
    return renderComparisonUnavailable();
  }

  return `<section aria-labelledby="comparison">
  <h2 id="comparison">Before / After Comparison</h2>
  <p>${escapeHtml(comparison.previousLabel)} compared with ${escapeHtml(comparison.currentLabel)}.</p>
  <div class="summary-grid">
    ${metric("New diagnostics", comparison.newDiagnostics)}
    ${metric("Resolved diagnostics", comparison.resolvedDiagnostics)}
    ${metric("Unchanged diagnostics", comparison.unchangedDiagnostics)}
    ${metric("Blocker delta", comparison.severityDelta.blocker ?? 0)}
    ${metric("Error delta", comparison.severityDelta.error ?? 0)}
    ${metric("Warning delta", comparison.severityDelta.warning ?? 0)}
    ${metric("Info delta", comparison.severityDelta.info ?? 0)}
  </div>
</section>`;
}

function renderComparisonUnavailable(): string {
  return `<section aria-labelledby="comparison">
  <h2 id="comparison">Before / After Comparison</h2>
  <p class="muted">Comparison data is not available for this single-run report.</p>
</section>`;
}

function renderDeployment(
  deployment: HtmlReportDeployment | undefined
): string {
  if (!deployment) {
    return `<section aria-labelledby="deployment-report">
  <h2 id="deployment-report">Deployment Report</h2>
  <p class="muted">Deployment metadata is not available for this local report input.</p>
</section>`;
  }

  return `<section aria-labelledby="deployment-report">
  <h2 id="deployment-report">Deployment Report</h2>
  <dl>
    ${detail("Deployment ID", deployment.deploymentId)}
    ${deployment.commitRef ? detail("Commit", deployment.commitRef) : ""}
    ${detail("Deployed", deployment.deployedAt)}
    ${detail("Environment", deployment.environmentName)}
    ${detail("Status", deployment.status)}
  </dl>
</section>`;
}

function renderExternalObservations(
  externalObservations: readonly HtmlReportExternalObservation[]
): string {
  if (externalObservations.length === 0) {
    return `<section aria-labelledby="external-observations">
  <h2 id="external-observations">External Observations</h2>
  <p class="muted">No Google or Yandex observations were provided in this report input.</p>
</section>`;
  }

  return `<section aria-labelledby="external-observations">
  <h2 id="external-observations">Google / Yandex Report</h2>
  <table aria-label="External observations">
    <thead><tr><th>Provider</th><th>Source</th><th>Freshness</th><th>Subject</th><th>Observed</th><th>Fetched</th><th>Quota</th><th>Sampling</th><th>Payload</th></tr></thead>
    <tbody>
      ${externalObservations.map(renderExternalObservationRow).join("\n")}
    </tbody>
  </table>
</section>`;
}

function renderPdfReadiness(): string {
  return `<section aria-labelledby="pdf-readiness">
  <h2 id="pdf-readiness">PDF Readiness</h2>
  <p class="muted">This local report is self-contained printable HTML with print CSS. Binary PDF rendering, hosted report links, expiration, access controls, and report history are not included in this local artifact.</p>
</section>`;
}

function renderExternalObservationRow(
  observation: HtmlReportExternalObservation
): string {
  return `<tr>
  <td>${escapeHtml(observation.provider)}</td>
  <td>${escapeHtml(observation.source)}</td>
  <td>${escapeHtml(observation.freshness)}</td>
  <td>${escapeHtml(observation.subjectUrl)}</td>
  <td>${escapeHtml(observation.observedAt)}</td>
  <td>${escapeHtml(observation.fetchedAt)}</td>
  <td>${escapeHtml(quotaSummary(observation.quota))}</td>
  <td>${escapeHtml(samplingSummary(observation.sampling))}</td>
  <td>${escapeHtml(payloadSummary(observation.payload))}</td>
</tr>`;
}

function quotaSummary(
  quota: HtmlReportExternalObservation["quota"] | undefined
): string {
  if (!quota) {
    return "not provided";
  }
  const counters =
    quota.remaining !== undefined && quota.limit !== undefined
      ? `${quota.remaining}/${quota.limit} remaining`
      : quota.remaining !== undefined
        ? `${quota.remaining} remaining`
        : quota.limit !== undefined
          ? `limit ${quota.limit}`
          : undefined;
  if (counters && quota.resetAt) {
    return `${counters}; resets ${quota.resetAt}`;
  }
  return counters ?? (quota.resetAt ? `resets ${quota.resetAt}` : "provided");
}

function samplingSummary(
  sampling: HtmlReportExternalObservation["sampling"] | undefined
): string {
  if (!sampling) {
    return "not provided";
  }
  const base = sampling.sampled ? "sampled" : "unsampled";
  return sampling.state ? `${base}: ${sampling.state}` : base;
}

function payloadSummary(
  payload: HtmlReportExternalObservation["payload"] | undefined
): string {
  if (!payload) {
    return "not provided";
  }
  return JSON.stringify(payload);
}

function metric(label: string, value: number): string {
  return `<div class="metric"><span>${escapeHtml(label)}</span><strong>${value}</strong></div>`;
}

function detail(label: string, value: string): string {
  return `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd>`;
}

function compareDiagnostics(left: Diagnostic, right: Diagnostic): number {
  const severityOrder =
    severityRank(right.severity) - severityRank(left.severity);
  if (severityOrder !== 0) {
    return severityOrder;
  }

  const ruleOrder = left.ruleId.localeCompare(right.ruleId);
  if (ruleOrder !== 0) {
    return ruleOrder;
  }

  const pageOrder = left.pageUrl.localeCompare(right.pageUrl);
  return pageOrder === 0
    ? left.fingerprint.localeCompare(right.fingerprint)
    : pageOrder;
}

function compareExternalObservations(
  left: HtmlReportExternalObservation,
  right: HtmlReportExternalObservation
): number {
  return (
    left.provider.localeCompare(right.provider) ||
    left.subjectUrl.localeCompare(right.subjectUrl) ||
    right.observedAt.localeCompare(left.observedAt) ||
    left.source.localeCompare(right.source) ||
    left.id.localeCompare(right.id)
  );
}

function severityRank(severity: Severity): number {
  if (severity === "blocker") {
    return 4;
  }
  if (severity === "error") {
    return 3;
  }
  if (severity === "warning") {
    return 2;
  }
  return 1;
}

function categoryFromRuleId(ruleId: string): string {
  const match = ruleId.match(/^SL-([A-Z]+)-/);
  return match?.[1] ?? "UNKNOWN";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
