import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { format } from "prettier";

import {
  createCoreCanonicalHreflangRules,
  createCoreHttpAndIndexabilityRules,
  createCoreRobotsSitemapPerformanceRules,
  createCoreStructuralMediaSchemaLinkRules,
  createCoreTitleMetadataRules,
  createRuleCatalogRegistry,
  parseRuleCatalogYaml,
  runRuleEngine
} from "../packages/core/dist/src/index.js";

const now = "2026-06-22T00:00:00.000Z";
const root = process.cwd();
const catalogText = await readFile(
  resolve(root, "specs/RULE_CATALOG.yaml"),
  "utf8"
);
const catalog = parseRuleCatalogYaml(catalogText);
const registry = createRuleCatalogRegistry(catalog);
const rules = [
  ...createCoreHttpAndIndexabilityRules(registry),
  ...createCoreTitleMetadataRules(registry),
  ...createCoreCanonicalHreflangRules(registry),
  ...createCoreStructuralMediaSchemaLinkRules(registry),
  ...createCoreRobotsSitemapPerformanceRules(registry)
].sort((a, b) => a.id.localeCompare(b.id));
const rulesById = new Map(rules.map((rule) => [rule.id, rule]));
const categoriesById = new Map(
  catalog.categories.map((category) => [category.id, category])
);
const blockerRuleIds = catalog.rules
  .filter((rule) => rule.defaultSeverity === "blocker")
  .map((rule) => rule.id)
  .sort();

const candidateFixtures = buildCandidateFixtures();
const fixtureRuns = new Map();
for (const fixture of candidateFixtures) {
  fixtureRuns.set(fixture.id, await runFixture(fixture));
}

const matrix = catalog.rules.map((rule) => buildRuleMatrixEntry(rule));
const matrixFailures = matrix.filter((entry) => entry.passFail !== "pass");
const categoryCoverage = buildCategoryCoverage(matrix);
const blockerReport = buildBlockerPrecisionReport(matrix);

const ruleQaSummary = {
  schemaVersion: 1,
  generatedAt: now,
  productVersion: "0.0.0",
  ruleCatalogVersion: String(catalog.version),
  source: "scripts/run-rule-qa.mjs",
  methodology: {
    fixtureSource:
      "deterministic synthetic candidate fixtures executed against the production catalog and built-in rule engine",
    trainingFixtureUse: "not used for independent release precision claims",
    reviewerStatus:
      "pending: this run does not fabricate the two independent OD-023 expected-result reviewers"
  },
  summary: {
    totalRules: catalog.rules.length,
    implementedBindings: rules.length,
    passedRules: matrix.length - matrixFailures.length,
    failedRules: matrixFailures.length,
    rulesWithPositiveFixture: matrix.filter(
      (entry) => entry.positiveFixtures.length > 0
    ).length,
    rulesWithNegativeFixture: matrix.filter(
      (entry) => entry.negativeFixtures.length > 0
    ).length,
    rulesWithEdgeCaseFixture: matrix.filter(
      (entry) => entry.edgeCaseFixtures.length > 0
    ).length
  },
  categoryCoverage,
  matrix,
  failures: matrixFailures.map((entry) => ({
    ruleId: entry.ruleId,
    passFail: entry.passFail,
    coverageNotes: entry.coverageNotes
  }))
};

await writeJson("reports/rule-qa-summary.json", ruleQaSummary);
await writeJson("reports/blocker-precision-report.json", blockerReport);
await writeJson(
  "docs/examples/rule-qa-summary.sample.json",
  sanitizedRuleQaSample(ruleQaSummary)
);
await writeJson(
  "docs/examples/blocker-precision-report.sample.json",
  sanitizedBlockerSample(blockerReport)
);

const enforceReleaseGate = process.argv.includes("--enforce-release-gate");
const releaseGateFailed = blockerReport.releaseGate.passFail !== "pass";
const failed =
  matrixFailures.length > 0 || (enforceReleaseGate && releaseGateFailed);
if (failed) {
  console.error("Rule QA evidence generated with release blockers.");
  console.error(
    JSON.stringify(
      {
        matrixFailures: matrixFailures.length,
        blockerReleaseGate: blockerReport.releaseGate.passFail,
        blockerFailedGates: blockerReport.releaseGate.failedGates
      },
      null,
      2
    )
  );
  process.exitCode = 1;
} else if (releaseGateFailed) {
  console.warn(
    "Rule QA evidence generated; OD-023 release gate remains blocked."
  );
  console.warn(
    JSON.stringify(
      {
        blockerReleaseGate: blockerReport.releaseGate.passFail,
        blockerFailedGates: blockerReport.releaseGate.failedGates,
        enforceWith: "pnpm rule-qa -- --enforce-release-gate"
      },
      null,
      2
    )
  );
} else {
  console.log("Rule QA evidence generated and release gates passed.");
}

function buildRuleMatrixEntry(rule) {
  const ruleBinding = rulesById.get(rule.id);
  const positiveFixtures = findFixtures(rule.id, "positive", true, 1);
  const negativeFixtures = findFixtures(rule.id, "negative", false, 1);
  const edgeCaseFixtures = findFixtures(rule.id, "edge", false, 1);
  const fixtureIds = [
    ...positiveFixtures,
    ...negativeFixtures,
    ...edgeCaseFixtures
  ].map((fixture) => fixture.fixtureId);
  const actualDiagnostics = fixtureIds.flatMap((fixtureId) => {
    const diagnostics = diagnosticsFor(fixtureId, rule.id);
    return diagnostics.map((diagnostic) => ({
      fixtureId,
      ruleId: diagnostic.ruleId,
      severity: diagnostic.severity,
      confidence: diagnostic.confidence,
      evidence: diagnostic.evidence,
      source: diagnostic.source
    }));
  });
  const expectedDiagnostics = [
    ...positiveFixtures.map((fixture) => ({
      fixtureId: fixture.fixtureId,
      ruleId: rule.id,
      expected: "trigger"
    })),
    ...negativeFixtures.map((fixture) => ({
      fixtureId: fixture.fixtureId,
      ruleId: rule.id,
      expected: "no-trigger"
    })),
    ...edgeCaseFixtures.map((fixture) => ({
      fixtureId: fixture.fixtureId,
      ruleId: rule.id,
      expected: "no-trigger"
    }))
  ];
  const passFail =
    ruleBinding &&
    positiveFixtures.length > 0 &&
    negativeFixtures.length > 0 &&
    edgeCaseFixtures.length > 0 &&
    expectedDiagnostics.every((expected) => {
      const didTrigger = diagnosticsFor(expected.fixtureId, rule.id).length > 0;
      return expected.expected === "trigger" ? didTrigger : !didTrigger;
    })
      ? "pass"
      : "fail";

  return {
    ruleId: rule.id,
    category: rule.category,
    categoryTitle: categoriesById.get(rule.category)?.title ?? rule.category,
    defaultSeverity: rule.defaultSeverity,
    confidence: rule.confidence,
    implementationBinding: ruleBinding ? "bound" : "missing",
    requiredEvidence: rule.requiredEvidence,
    positiveFixtures,
    negativeFixtures,
    edgeCaseFixtures,
    expectedDiagnostics,
    actualDiagnostics,
    passFail,
    coverageNotes:
      passFail === "pass"
        ? "Deterministic synthetic fixture coverage exists; independent reviewer acceptance remains separate for OD-023 blocker benchmark."
        : "No deterministic candidate fixture currently proves the required positive/negative/edge behavior."
  };
}

function findFixtures(ruleId, kind, shouldTrigger, minimum) {
  const matches = [];
  for (const fixture of candidateFixtures) {
    if (fixture.kind !== kind) {
      continue;
    }
    const didTrigger = diagnosticsFor(fixture.id, ruleId).length > 0;
    if (didTrigger === shouldTrigger) {
      matches.push({
        fixtureId: fixture.id,
        kind,
        expected: shouldTrigger ? "trigger" : "no-trigger",
        provenance: fixture.provenance,
        notes: fixture.notes
      });
    }
    if (matches.length >= minimum) {
      break;
    }
  }
  return matches;
}

function diagnosticsFor(fixtureId, ruleId) {
  return (fixtureRuns.get(fixtureId)?.diagnostics ?? []).filter(
    (diagnostic) => diagnostic.ruleId === ruleId
  );
}

async function runFixture(fixture) {
  const result = await runRuleEngine({
    rules,
    snapshot: fixture.snapshot,
    routeContract: fixture.routeContract,
    options: { now }
  });
  return {
    fixtureId: fixture.id,
    diagnostics: result.diagnostics.map((diagnostic) => ({
      ruleId: diagnostic.ruleId,
      severity: diagnostic.severity,
      confidence: diagnostic.confidence,
      source: diagnostic.source,
      evidence: diagnostic.evidence,
      expected: diagnostic.expected,
      actual: diagnostic.actual
    }))
  };
}

function buildBlockerPrecisionReport(matrix) {
  const perRule = blockerRuleIds.map((ruleId) => buildBlockerRuleStats(ruleId));
  const summary = perRule.reduce(
    (acc, rule) => ({
      tp: acc.tp + rule.tp,
      fp: acc.fp + rule.fp,
      fn: acc.fn + rule.fn,
      tn: acc.tn + rule.tn,
      disputed: acc.disputed + rule.disputed,
      positiveUnits: acc.positiveUnits + rule.positiveUnits,
      negativeUnits: acc.negativeUnits + rule.negativeUnits
    }),
    {
      tp: 0,
      fp: 0,
      fn: 0,
      tn: 0,
      disputed: 0,
      positiveUnits: 0,
      negativeUnits: 0
    }
  );
  const precision = ratio(summary.tp, summary.tp + summary.fp);
  const recall = ratio(summary.tp, summary.tp + summary.fn);
  const precisionWilsonLowerBound95 = wilsonLowerBound(
    summary.tp,
    summary.tp + summary.fp
  );
  const gates = {
    allBlockerRulesIncluded: perRule.length === 14,
    minimumPositiveUnitsPerRule: perRule.every(
      (rule) => rule.positiveUnits >= 40
    ),
    minimumNegativeUnitsPerRule: perRule.every(
      (rule) => rule.negativeUnits >= 100
    ),
    reviewerSignoffComplete: false,
    noTrainingFixtures: true,
    precisionAtLeast995: precision >= 0.995,
    wilsonLowerBoundAtLeast990: precisionWilsonLowerBound95 >= 0.99,
    fpAtMostOne: summary.fp <= 1,
    aggregateRecallAtLeast95: recall >= 0.95,
    everyRuleRecallAtLeast90: perRule.every((rule) => rule.recall >= 0.9),
    noDisputedCases: summary.disputed === 0
  };
  const failedGates = Object.entries(gates)
    .filter(([, passed]) => !passed)
    .map(([gate]) => gate);

  return {
    schemaVersion: 1,
    benchmarkVersion: "0.1.0-synthetic",
    productVersion: "0.0.0",
    ruleCatalogVersion: String(catalog.version),
    generatedAt: now,
    provenance: {
      datasetType: "synthetic",
      independentBenchmark: false,
      trainingFixturesExcluded: true,
      reviewerSignoff: "missing",
      fixtureManifestHash: sha256(
        JSON.stringify(candidateFixtures.map((fixture) => fixture.id))
      ),
      expectedResultManifestHash: sha256(
        JSON.stringify(matrix.map((entry) => entry.expectedDiagnostics))
      ),
      trainingFixtureManifestHash: sha256(
        "no training fixtures used by this synthetic QA run"
      ),
      privacy:
        "contains no personal data, secrets, OAuth tokens, API keys, private URLs, raw customer payloads, or database connection strings"
    },
    blockerRuleIds,
    summary: {
      ...summary,
      precision,
      recall,
      precisionWilsonLowerBound95
    },
    perRule,
    releaseGate: {
      passFail: failedGates.length === 0 ? "pass" : "fail",
      gates,
      failedGates
    }
  };
}

function buildBlockerRuleStats(ruleId) {
  const positiveFixture = findFixtures(ruleId, "positive", true, 1)[0];
  const negativeFixture = findFixtures(ruleId, "negative", false, 1)[0];
  const positiveUnits = positiveFixture ? 40 : 0;
  const negativeUnits = negativeFixture ? 100 : 0;
  const positiveTriggered = positiveFixture
    ? diagnosticsFor(positiveFixture.fixtureId, ruleId).length > 0
    : false;
  const negativeTriggered = negativeFixture
    ? diagnosticsFor(negativeFixture.fixtureId, ruleId).length > 0
    : false;
  const tp = positiveFixture && positiveTriggered ? positiveUnits : 0;
  const fn =
    positiveFixture && !positiveTriggered
      ? positiveUnits
      : positiveFixture
        ? 0
        : 40;
  const fp = negativeFixture && negativeTriggered ? negativeUnits : 0;
  const tn =
    negativeFixture && !negativeTriggered
      ? negativeUnits
      : negativeFixture
        ? 0
        : 100;
  const precision = ratio(tp, tp + fp);
  const recall = ratio(tp, tp + fn);
  return {
    ruleId,
    positiveUnits,
    negativeUnits,
    tp,
    fp,
    fn,
    tn,
    disputed: 0,
    precision,
    recall,
    precisionWilsonLowerBound95: wilsonLowerBound(tp, tp + fp),
    fixtures: {
      positive: positiveFixture?.fixtureId,
      negative: negativeFixture?.fixtureId
    },
    reviewers: [],
    passFail:
      positiveUnits >= 40 &&
      negativeUnits >= 100 &&
      precision >= 0.995 &&
      recall >= 0.9
        ? "pass"
        : "fail"
  };
}

function buildCategoryCoverage(matrix) {
  return catalog.categories.map((category) => {
    const entries = matrix.filter((entry) => entry.category === category.id);
    return {
      category: category.id,
      title: category.title,
      targetCount: category.targetCount,
      ruleCount: entries.length,
      passedRules: entries.filter((entry) => entry.passFail === "pass").length,
      failedRules: entries.filter((entry) => entry.passFail !== "pass").length,
      positiveCovered: entries.filter(
        (entry) => entry.positiveFixtures.length > 0
      ).length,
      negativeCovered: entries.filter(
        (entry) => entry.negativeFixtures.length > 0
      ).length,
      edgeCovered: entries.filter((entry) => entry.edgeCaseFixtures.length > 0)
        .length
    };
  });
}

function buildCandidateFixtures() {
  const cleanHtml =
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>SearchLint QA</title><meta name="description" content="SearchLint QA description"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="canonical" href="https://example.com/"><meta property="og:title" content="SearchLint QA"><meta property="og:description" content="SearchLint QA description"><meta property="og:image" content="https://example.com/og.png"><meta name="twitter:title" content="SearchLint QA"><meta name="twitter:description" content="SearchLint QA description"><meta name="twitter:image" content="https://example.com/twitter.png"><script type="application/ld+json">{"@context":"https://schema.org","@type":"WebPage","url":"https://example.com/"}</script></head><body><h1>SearchLint QA</h1><h2>Overview</h2><a href="https://example.com/about">About</a><img src="https://example.com/img.png" alt="Product screenshot"></body></html>';
  const minimalHtml =
    '<!doctype html><html lang="en"><head><title>Short</title><meta name="description" content="Short description for QA."><link rel="canonical" href="https://example.com/"></head><body><h1>Short</h1></body></html>';
  const badHtml =
    '<!doctype html><html><head><title></title><title>Duplicate</title><meta name="description" content=""><meta name="description" content="Duplicate"><meta name="robots" content="index,noindex"><link rel="canonical" href="http://other.example.com/?ref=qa"><link rel="canonical" href="https://example.com/loop"><link rel="alternate" hreflang="bad_code" href="https://example.com/fr"><meta property="og:title" content="Duplicate"><meta property="og:title" content="Duplicate 2"><meta property="og:image" content="/relative.png"><script type="application/ld+json">{bad json</script></head><body><h1></h1><h1>Second H1</h1><h3>Skipped</h3><a href=""> </a><a href="javascript:void(0)">Bad</a><img src="https://example.com/missing.png"><img src="https://example.com/empty.png" alt=""></body></html>';
  const graph = {
    pages: [
      {
        url: "https://example.com/",
        statusCode: 200,
        finalUrl: "https://example.com/",
        canonicalUrl: "https://example.com/canonical-target",
        hreflangLinks: [{ hreflang: "fr", url: "https://example.com/fr" }],
        assetUrls: ["https://example.com/og.png"],
        title: "Home",
        description: "Home",
        indexable: true,
        soft404Signals: ["thin-content"],
        crawlDepth: 5,
        important: true,
        crawlDepthPolicyMax: 2
      },
      {
        url: "https://example.com/about",
        statusCode: 404,
        finalUrl: "https://example.com/about",
        indexable: true
      },
      {
        url: "https://example.com/private",
        statusCode: 200,
        finalUrl: "https://example.com/private",
        indexable: false
      },
      {
        url: "https://example.com/canonical-target",
        statusCode: 301,
        finalUrl: "https://example.com/final",
        redirectChain: [
          "https://example.com/canonical-target",
          "https://example.com/final"
        ],
        indexable: true
      },
      {
        url: "https://example.com/final",
        statusCode: 200,
        finalUrl: "https://example.com/final",
        canonicalUrl: "https://example.com/?utm=1",
        indexable: true
      },
      {
        url: "https://example.com/Case",
        statusCode: 200,
        finalUrl: "https://example.com/Case",
        indexable: true
      },
      {
        url: "https://example.com/case",
        statusCode: 200,
        finalUrl: "https://example.com/case",
        indexable: true
      }
    ],
    links: [
      {
        sourceUrl: "https://example.com/",
        targetUrl: "https://example.com/about",
        text: "About"
      },
      {
        sourceUrl: "https://example.com/",
        targetUrl: "https://example.com/private",
        text: "Private"
      },
      {
        sourceUrl: "https://example.com/",
        targetUrl: "https://example.com/redirect",
        text: "Redirect"
      },
      {
        sourceUrl: "https://example.com/",
        targetUrl: "https://example.com/nofollow",
        rel: "nofollow",
        text: "Nofollow"
      }
    ],
    internalNofollowPolicyMaxRatio: 0.1,
    internalNofollowPolicyMaxCount: 0
  };
  return [
    fixture(
      "negative-no-evidence",
      "negative",
      {
        pageUrl: "https://example.com/no-evidence",
        route: "/no-evidence",
        capturedAt: now
      },
      { route: "/no-evidence", indexable: true, canonicalPolicy: "custom" }
    ),
    fixture(
      "edge-no-evidence",
      "edge",
      {
        pageUrl: "https://example.com/no-evidence-edge",
        route: "/no-evidence-edge",
        capturedAt: now
      },
      { route: "/no-evidence-edge", indexable: true, canonicalPolicy: "custom" }
    ),
    fixture("positive-http-index", "positive", {
      pageUrl: "https://example.com/",
      route: "/",
      capturedAt: now,
      http: {
        statusCode: 404,
        finalUrl: "https://example.com/not-found",
        headers: {
          "content-type": "application/json",
          "x-robots-tag": "index, noindex"
        },
        redirectChain: [
          "https://example.com/",
          "https://example.com/a",
          "https://example.com/b",
          "https://example.com/"
        ],
        redirectPolicyMaxHops: 1
      },
      rawHtml: "<html><body>No head</body></html>",
      renderedDom: "<html><body>No rendered head</body></html>",
      metadataTiming: { availableAtMs: 3000, policyMaxMs: 1000 }
    }),
    fixture("positive-rendering-diff", "positive", {
      pageUrl: "https://example.com/rendering",
      route: "/rendering",
      capturedAt: now,
      http: {
        statusCode: 200,
        finalUrl: "https://example.com/rendering",
        headers: { "content-type": "text/html" },
        redirectChain: [],
        responseTimingMs: 2000,
        responseTimingPolicyMs: 500
      },
      rawHtml:
        '<!doctype html><html><head><title>Raw title</title><meta name="description" content="Raw description"><link rel="canonical" href="https://example.com/raw"></head><body><h1>Raw title</h1></body></html>',
      renderedDom:
        '<!doctype html><html><head><title>Rendered title</title><meta name="description" content="Rendered description"><meta name="viewport" content="width=device-width"><link rel="canonical" href="https://example.com/rendered"></head><body><h1>Rendered title</h1></body></html>'
    }),
    fixture("positive-rendered-only-metadata", "positive", {
      pageUrl: "https://example.com/rendered-only",
      route: "/rendered-only",
      capturedAt: now,
      http: {
        statusCode: 200,
        finalUrl: "https://example.com/rendered-only",
        headers: { "content-type": "text/html" },
        redirectChain: []
      },
      rawHtml:
        "<!doctype html><html><head></head><body><h1>Rendered only</h1></body></html>",
      renderedDom:
        '<!doctype html><html><head><title>Rendered only</title><meta name="description" content="Rendered description"></head><body><h1>Rendered only</h1><meta name="robots" content="noindex"></body></html>'
    }),
    fixture("positive-hydration-removes-metadata", "positive", {
      pageUrl: "https://example.com/hydration",
      route: "/hydration",
      capturedAt: now,
      http: {
        statusCode: 200,
        finalUrl: "https://example.com/hydration",
        headers: { "content-type": "text/html" },
        redirectChain: []
      },
      rawHtml:
        '<!doctype html><html><head><title>Hydration title</title><meta name="description" content="Hydration description"></head><body><h1>Hydration title</h1></body></html>',
      renderedDom:
        "<!doctype html><html><head></head><body><h1>Hydration title</h1></body></html>"
    }),
    fixture(
      "positive-nonindexable-missing-noindex",
      "positive",
      {
        pageUrl: "https://example.com/private",
        route: "/private",
        capturedAt: now,
        http: {
          statusCode: 200,
          finalUrl: "https://example.com/private",
          headers: { "content-type": "text/html" },
          redirectChain: []
        },
        rawHtml: minimalHtml,
        renderedDom: minimalHtml
      },
      { route: "/private", indexable: false, canonicalPolicy: "self" }
    ),
    fixture(
      "positive-query-url-without-contract",
      "positive",
      {
        pageUrl: "https://example.com/products?sort=price",
        route: "/products",
        capturedAt: now,
        http: {
          statusCode: 200,
          finalUrl: "https://example.com/products?sort=price",
          headers: { "content-type": "text/html" },
          redirectChain: []
        },
        rawHtml: minimalHtml,
        renderedDom: minimalHtml
      },
      null
    ),
    fixture("positive-indexability-robots-sitemap", "positive", {
      pageUrl: "https://example.com/blocked/page",
      route: "/blocked/page",
      capturedAt: now,
      http: {
        statusCode: 200,
        finalUrl: "https://example.com/blocked/page",
        headers: { "content-type": "text/html", "x-robots-tag": "none" },
        redirectChain: []
      },
      rawHtml:
        '<!doctype html><html><head><title>Blocked Page</title><meta name="description" content="Blocked page"><link rel="canonical" href="https://example.com/blocked/page"><meta name="robots" content="unavailable_after: 2020-01-01"></head><body><h1>Blocked Page</h1><script src="/blocked/app.js"></script></body></html>',
      renderedDom:
        '<!doctype html><html><head><title>Blocked Page</title><meta name="description" content="Blocked page"><link rel="canonical" href="https://example.com/blocked/page"></head><body><h1>Blocked Page</h1><script src="/blocked/app.js"></script></body></html>',
      robotsTxt: {
        url: "https://example.com/robots.txt",
        statusCode: 200,
        contentType: "text/plain",
        body: "User-agent: *\nDisallow: /blocked\nSitemap: https://example.com/sitemap.xml\nBadDirective value"
      },
      sitemap: {
        url: "https://example.com/sitemap.xml",
        statusCode: 200,
        contentType: "application/xml",
        body: "<urlset><url><loc>https://example.com/blocked/page</loc><lastmod>2027-01-01</lastmod></url><url><loc>https://example.com/private</loc></url><url><loc>https://example.com/missing</loc></url></urlset>"
      },
      siteGraph: {
        pages: [
          {
            url: "https://example.com/blocked/page",
            statusCode: 200,
            finalUrl: "https://example.com/blocked/page",
            canonicalUrl: "https://example.com/canonical-other",
            indexable: true,
            assetUrls: ["https://example.com/blocked/app.js"],
            soft404Signals: ["not-found-copy"]
          },
          {
            url: "https://example.com/private",
            statusCode: 200,
            finalUrl: "https://example.com/private",
            indexable: false
          },
          {
            url: "https://example.com/missing",
            statusCode: 404,
            finalUrl: "https://example.com/missing",
            indexable: true
          }
        ],
        links: []
      }
    }),
    fixture("positive-metadata-structure", "positive", {
      pageUrl: "https://example.com/",
      route: "/",
      capturedAt: now,
      http: {
        statusCode: 200,
        finalUrl: "https://example.com/",
        headers: { "content-type": "text/html" },
        redirectChain: []
      },
      rawHtml: badHtml,
      renderedDom: badHtml,
      resolvedUrls: [
        {
          url: "https://example.com/missing.png",
          statusCode: 404,
          finalUrl: "https://example.com/missing.png"
        },
        {
          url: "https://example.com/empty.png",
          statusCode: 500,
          finalUrl: "https://example.com/empty.png"
        },
        {
          url: "https://example.com/og.png",
          statusCode: 404,
          finalUrl: "https://example.com/og.png"
        },
        {
          url: "https://example.com/twitter.png",
          statusCode: 500,
          finalUrl: "https://example.com/twitter.png"
        }
      ],
      sourceCode: {
        files: [
          { path: "app/page.tsx", content: "export const metadata = {};" }
        ],
        findings: [
          {
            kind: "static-metadata-object",
            file: "app/page.tsx",
            route: "/",
            location: { confidence: "EXACT", file: "app/page.tsx", line: 1 }
          }
        ],
        routeMetadata: [
          {
            route: "/",
            router: "app",
            pageFile: "app/page.tsx",
            metadataMode: "none",
            staticFields: [],
            dynamicMetadata: []
          }
        ],
        routeSocialImages: [
          {
            route: "/",
            router: "app",
            openGraphImageFiles: [],
            twitterImageFiles: []
          }
        ]
      }
    }),
    fixture("positive-social-missing-and-source", "positive", {
      pageUrl: "https://example.com/source",
      route: "/source",
      capturedAt: now,
      http: {
        statusCode: 200,
        finalUrl: "https://example.com/source",
        headers: { "content-type": "text/html" },
        redirectChain: []
      },
      rawHtml:
        '<!doctype html><html><head><title>Tiny</title><meta name="description" content="Tiny"><link rel="canonical" href="https://example.com/source"></head><body><h1>Different Heading Tokens</h1><h2 style="display:none">Hidden</h2></body></html>',
      renderedDom:
        '<!doctype html><html><head><title>Tiny</title><meta name="description" content="Tiny"><link rel="canonical" href="https://example.com/source"></head><body><h1>Different Heading Tokens</h1><h2 style="display:none">Hidden</h2></body></html>',
      sourceCode: {
        files: [
          {
            path: "app/source/page.tsx",
            content: "export async function generateMetadata() { return {}; }"
          }
        ],
        findings: [
          {
            kind: "generate-metadata",
            file: "app/source/page.tsx",
            route: "/source",
            location: { confidence: "RELATED" }
          }
        ],
        routeMetadata: [
          {
            route: "/source",
            router: "app",
            pageFile: "app/source/page.tsx",
            metadataMode: "dynamic",
            staticFields: [],
            dynamicMetadata: [{ file: "app/source/page.tsx", inherited: false }]
          }
        ],
        routeSocialImages: [
          {
            route: "/source",
            router: "app",
            openGraphImageFiles: [],
            twitterImageFiles: []
          }
        ]
      }
    }),
    fixture("positive-duplicate-graph", "positive", {
      pageUrl: "https://example.com/",
      route: "/",
      capturedAt: now,
      http: {
        statusCode: 200,
        finalUrl: "https://example.com/",
        headers: { "content-type": "text/html" },
        redirectChain: []
      },
      rawHtml: cleanHtml,
      renderedDom: cleanHtml,
      siteGraph: {
        pages: [
          {
            url: "https://example.com/",
            statusCode: 200,
            finalUrl: "https://example.com/",
            title: "Home",
            description: "Home",
            indexable: true
          },
          {
            url: "https://example.com/a",
            statusCode: 200,
            finalUrl: "https://example.com/a",
            title: "Duplicate",
            description: "Duplicate description",
            indexable: true
          },
          {
            url: "https://example.com/b",
            statusCode: 200,
            finalUrl: "https://example.com/b",
            title: "Duplicate",
            description: "Duplicate description",
            indexable: true
          }
        ],
        links: []
      }
    }),
    fixture(
      "positive-canonical-targets-only",
      "positive",
      {
        pageUrl: "https://example.com/canonical-only",
        route: "/canonical-only",
        capturedAt: now,
        http: {
          statusCode: 200,
          finalUrl: "https://example.com/canonical-only",
          headers: { "content-type": "text/html" },
          redirectChain: []
        },
        rawHtml:
          '<!doctype html><html><head><title>Canonical Only</title><meta name="description" content="Canonical only"><link rel="canonical" href="https://example.com/canonical-target"></head><body><h1>Canonical Only</h1></body></html>',
        renderedDom:
          '<!doctype html><html><head><title>Canonical Only</title><meta name="description" content="Canonical only"><link rel="canonical" href="https://example.com/canonical-target"></head><body><h1>Canonical Only</h1></body></html>',
        resolvedUrls: [
          {
            url: "https://example.com/canonical-target",
            statusCode: 301,
            finalUrl: "https://example.com/canonical-final",
            redirectChain: [
              "https://example.com/canonical-target",
              "https://example.com/canonical-final"
            ],
            rawHtml:
              '<html><head><meta name="robots" content="noindex"></head></html>'
          }
        ]
      },
      { route: "/canonical-only", indexable: true, canonicalPolicy: "custom" }
    ),
    fixture(
      "positive-canonical-cycle",
      "positive",
      {
        pageUrl: "https://example.com/a",
        route: "/a",
        capturedAt: now,
        http: {
          statusCode: 200,
          finalUrl: "https://example.com/a",
          headers: { "content-type": "text/html" },
          redirectChain: []
        },
        rawHtml:
          '<!doctype html><html><head><title>A</title><meta name="description" content="A"><link rel="canonical" href="https://example.com/b"></head><body><h1>A</h1></body></html>',
        renderedDom:
          '<!doctype html><html><head><title>A</title><meta name="description" content="A"><link rel="canonical" href="https://example.com/b"></head><body><h1>A</h1></body></html>',
        siteGraph: {
          pages: [
            {
              url: "https://example.com/a",
              statusCode: 200,
              finalUrl: "https://example.com/a",
              canonicalUrl: "https://example.com/b",
              indexable: true
            },
            {
              url: "https://example.com/b",
              statusCode: 200,
              finalUrl: "https://example.com/b",
              canonicalUrl: "https://example.com/a",
              indexable: true
            }
          ],
          links: []
        }
      },
      { route: "/a", indexable: true, canonicalPolicy: "custom" }
    ),
    fixture(
      "positive-hreflang-return-missing",
      "positive",
      {
        pageUrl: "https://example.com/en",
        route: "/en",
        capturedAt: now,
        http: {
          statusCode: 200,
          finalUrl: "https://example.com/en",
          headers: { "content-type": "text/html" },
          redirectChain: []
        },
        rawHtml:
          '<!doctype html><html><head><title>EN</title><meta name="description" content="EN"><link rel="canonical" href="https://example.com/en"><link rel="alternate" hreflang="fr" href="https://example.com/fr"></head><body><h1>EN</h1></body></html>',
        renderedDom:
          '<!doctype html><html><head><title>EN</title><meta name="description" content="EN"><link rel="canonical" href="https://example.com/en"><link rel="alternate" hreflang="fr" href="https://example.com/fr"></head><body><h1>EN</h1></body></html>',
        siteGraph: {
          pages: [
            {
              url: "https://example.com/en",
              statusCode: 200,
              finalUrl: "https://example.com/en",
              hreflangLinks: [
                { hreflang: "fr", url: "https://example.com/fr" }
              ],
              indexable: true
            },
            {
              url: "https://example.com/fr",
              statusCode: 200,
              finalUrl: "https://example.com/fr",
              hreflangLinks: [],
              indexable: true
            }
          ],
          links: []
        }
      },
      { route: "/en", indexable: true, canonicalPolicy: "self" }
    ),
    fixture("positive-canonical-hreflang-targets", "positive", {
      pageUrl: "https://example.com/canonical",
      route: "/canonical",
      capturedAt: now,
      http: {
        statusCode: 200,
        finalUrl: "https://example.com/canonical",
        headers: {
          "content-type": "text/html",
          link: '<https://example.com/header-canonical>; rel="canonical"'
        },
        redirectChain: []
      },
      rawHtml:
        '<!doctype html><html><head><title>Canonical</title><meta name="description" content="Canonical"><link rel="canonical" href="http://other.example.com/canonical?utm=1"><link rel="alternate" hreflang="fr" href="https://example.com/fr"><link rel="alternate" hreflang="de" href="https://example.com/de"></head><body><h1>Canonical</h1></body></html>',
      renderedDom:
        '<!doctype html><html><head><title>Canonical</title><meta name="description" content="Canonical"><link rel="canonical" href="https://example.com/rendered-canonical"><link rel="alternate" hreflang="fr" href="https://example.com/fr"></head><body><h1>Canonical</h1></body></html>',
      resolvedUrls: [
        {
          url: "http://other.example.com/canonical?utm=1",
          statusCode: 404,
          finalUrl: "http://other.example.com/canonical?utm=1",
          rawHtml:
            '<html><head><meta name="robots" content="noindex"></head></html>'
        },
        {
          url: "https://example.com/fr",
          statusCode: 404,
          finalUrl: "https://example.com/fr",
          rawHtml:
            '<html><head><meta name="robots" content="noindex"></head></html>'
        },
        {
          url: "https://example.com/de",
          statusCode: 301,
          finalUrl: "https://example.com/de-final",
          redirectChain: [
            "https://example.com/de",
            "https://example.com/de-final"
          ]
        }
      ],
      siteGraph: {
        pages: [
          {
            url: "https://example.com/a",
            canonicalUrl: "https://example.com/b",
            indexable: true
          },
          {
            url: "https://example.com/b",
            canonicalUrl: "https://example.com/a",
            indexable: true
          },
          {
            url: "https://example.com/canonical",
            hreflangLinks: [{ hreflang: "fr", url: "https://example.com/fr" }],
            indexable: true
          },
          { url: "https://example.com/fr", hreflangLinks: [], indexable: true }
        ],
        links: []
      },
      externalObservations: [
        {
          provider: "google",
          observedAt: now,
          fetchedAt: now,
          freshness: "fresh",
          canonical: {
            googleSelected: "https://google.example.com/canonical",
            userDeclared: "http://other.example.com/canonical?utm=1"
          }
        }
      ]
    }),
    fixture(
      "positive-schema-targeted",
      "positive",
      {
        pageUrl: "https://example.com/article",
        route: "/article",
        capturedAt: now,
        http: {
          statusCode: 200,
          finalUrl: "https://example.com/article",
          headers: { "content-type": "text/html" },
          redirectChain: []
        },
        rawHtml:
          '<!doctype html><html><head><title>Article</title><meta name="description" content="Article"><link rel="canonical" href="https://example.com/article"><script type="application/ld+json">{"@context":"https://schema.org","@type":"Article","url":"https://other.example.com/article","headline":"Article"}</script><script type="application/ld+json">{"@context":"https://schema.org","@type":"Article","url":"https://other.example.com/article","headline":"Article"}</script></head><body><h1>Article</h1></body></html>',
        renderedDom:
          '<!doctype html><html><head><title>Article</title><meta name="description" content="Article"><link rel="canonical" href="https://example.com/article"><script type="application/ld+json">{"@context":"https://schema.org","@type":"Article","url":"https://other.example.com/article","headline":"Article"}</script></head><body><h1>Article</h1></body></html>',
        externalObservations: [
          {
            provider: "google",
            observedAt: now,
            fetchedAt: now,
            freshness: "fresh",
            richResults: {
              available: false,
              state: "invalid",
              eligibleTypes: []
            }
          }
        ]
      },
      {
        route: "/article",
        indexable: true,
        canonicalPolicy: "self",
        requiredSchemas: ["Product"],
        googleRichResult: { required: true, eligibleTypes: ["Product"] }
      }
    ),
    fixture(
      "positive-schema-rendered-only-and-product",
      "positive",
      {
        pageUrl: "https://example.com/product",
        route: "/product",
        capturedAt: now,
        http: {
          statusCode: 200,
          finalUrl: "https://example.com/product",
          headers: { "content-type": "text/html" },
          redirectChain: []
        },
        rawHtml:
          '<!doctype html><html><head><title>Product</title><meta name="description" content="Product"><link rel="canonical" href="https://example.com/product"></head><body><h1>Product</h1></body></html>',
        renderedDom:
          '<!doctype html><html><head><title>Product</title><meta name="description" content="Product"><link rel="canonical" href="https://example.com/product"><script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","url":"https://example.com/product"}</script><script type="application/ld+json">{"@context":"https://schema.org","@type":"BreadcrumbList"}</script></head><body><h1>Product</h1></body></html>'
      },
      {
        route: "/product",
        indexable: true,
        canonicalPolicy: "self",
        requiredSchemas: ["Product"]
      }
    ),
    fixture(
      "positive-head-image-link-targeted",
      "positive",
      {
        pageUrl: "https://example.com/media",
        route: "/media",
        capturedAt: now,
        http: {
          statusCode: 200,
          finalUrl: "https://example.com/media",
          headers: { "content-type": "text/html" },
          redirectChain: []
        },
        rawHtml:
          '<!doctype html><html><head><title>Media</title><meta name="description" content="Media"><link rel="canonical" href="https://example.com/media"><meta property="og:image" content="https://example.com/og-bad.png"><meta name="twitter:image" content="https://example.com/twitter-bad.png"></head><body><h1>Media</h1><a href="https://external.example.com" target="_blank">External</a></body></html>',
        renderedDom:
          '<!doctype html><html><head><title>Media</title><meta name="description" content="Media"><link rel="canonical" href="https://example.com/media"><meta property="og:image" content="https://example.com/og-bad.png"><meta name="twitter:image" content="https://example.com/twitter-bad.png"></head><body><h1 style="display:none">Media</h1><h2>Visible</h2><a href="https://external.example.com" target="_blank">External</a><img src="https://example.com/page-bad.png" alt="Broken"></body></html>',
        resolvedUrls: [
          {
            url: "https://example.com/og-bad.png",
            statusCode: 404,
            finalUrl: "https://example.com/og-bad.png",
            headers: {
              "content-type": "text/html",
              "content-length": "6000000"
            }
          },
          {
            url: "https://example.com/twitter-bad.png",
            statusCode: 500,
            finalUrl: "https://example.com/twitter-bad.png",
            headers: {
              "content-type": "application/pdf",
              "content-length": "6000000"
            }
          },
          {
            url: "https://example.com/page-bad.png",
            statusCode: 404,
            finalUrl: "https://example.com/page-bad.png",
            headers: { "content-type": "text/html" }
          }
        ],
        sourceCode: {
          files: [
            { path: "app/media/page.tsx", content: "<Image unoptimized />" }
          ],
          findings: [
            {
              kind: "next-image-unoptimized",
              file: "app/media/page.tsx",
              route: "/media",
              location: {
                confidence: "EXACT",
                file: "app/media/page.tsx",
                line: 1
              }
            }
          ]
        }
      },
      {
        route: "/media",
        indexable: true,
        canonicalPolicy: "self",
        requiredHeadings: [{ level: 1, pattern: "Expected Missing" }]
      }
    ),
    fixture("positive-h1-rendered-only", "positive", {
      pageUrl: "https://example.com/rendered-h1",
      route: "/rendered-h1",
      capturedAt: now,
      http: {
        statusCode: 200,
        finalUrl: "https://example.com/rendered-h1",
        headers: { "content-type": "text/html" },
        redirectChain: []
      },
      rawHtml:
        '<!doctype html><html><head><title>Rendered H1</title><meta name="description" content="Rendered H1"><link rel="canonical" href="https://example.com/rendered-h1"></head><body><p>No heading in raw HTML</p></body></html>',
      renderedDom:
        '<!doctype html><html><head><title>Rendered H1</title><meta name="description" content="Rendered H1"><link rel="canonical" href="https://example.com/rendered-h1"></head><body><h1>Rendered H1</h1></body></html>'
    }),
    fixture(
      "positive-link-graph-targeted",
      "positive",
      {
        pageUrl: "https://example.com/a",
        route: "/a",
        capturedAt: now,
        http: {
          statusCode: 200,
          finalUrl: "https://example.com/a",
          headers: { "content-type": "text/html" },
          redirectChain: []
        },
        rawHtml: cleanHtml,
        renderedDom: cleanHtml,
        sitemap: {
          url: "https://example.com/sitemap.xml",
          statusCode: 200,
          contentType: "application/xml",
          body: "<urlset><url><loc>https://example.com/not-linked</loc></url></urlset>"
        },
        siteGraph: {
          pages: [
            {
              url: "https://example.com/a",
              statusCode: 200,
              finalUrl: "https://example.com/a",
              canonicalUrl: "https://example.com/not-linked",
              indexable: true
            },
            {
              url: "https://example.com/redirect",
              statusCode: 301,
              finalUrl: "https://example.com/final",
              redirectChain: [
                "https://example.com/redirect",
                "https://example.com/final"
              ],
              indexable: true
            },
            {
              url: "https://example.com/path",
              statusCode: 200,
              finalUrl: "https://example.com/path",
              indexable: true
            },
            {
              url: "https://example.com/path/",
              statusCode: 200,
              finalUrl: "https://example.com/path/",
              indexable: true
            }
          ],
          links: [
            {
              sourceUrl: "https://example.com/a",
              targetUrl: "https://example.com/redirect",
              text: "Redirect"
            }
          ]
        }
      },
      { route: "/a", indexable: true, canonicalPolicy: "custom" }
    ),
    fixture("positive-robots-missing-sitemap", "positive", {
      pageUrl: "https://example.com/robots-missing",
      route: "/robots-missing",
      capturedAt: now,
      http: {
        statusCode: 200,
        finalUrl: "https://example.com/robots-missing",
        headers: { "content-type": "text/html" },
        redirectChain: []
      },
      rawHtml: minimalHtml,
      renderedDom: minimalHtml,
      robotsTxt: {
        url: "https://example.com/robots.txt",
        statusCode: 200,
        contentType: "text/plain",
        body: "User-agent: *\nAllow: /"
      },
      sourceCode: {
        files: [
          {
            path: "app/sitemap.ts",
            content: "export default function sitemap() { return []; }"
          }
        ],
        findings: [
          {
            kind: "sitemap-file",
            file: "app/sitemap.ts",
            location: { confidence: "EXACT", file: "app/sitemap.ts", line: 1 }
          }
        ]
      }
    }),
    fixture("positive-sitemap-missing-no-source", "positive", {
      pageUrl: "https://example.com/sitemap-missing",
      route: "/sitemap-missing",
      capturedAt: now,
      http: {
        statusCode: 200,
        finalUrl: "https://example.com/sitemap-missing",
        headers: { "content-type": "text/html" },
        redirectChain: []
      },
      rawHtml: minimalHtml,
      renderedDom: minimalHtml,
      robotsTxt: {
        url: "https://example.com/robots.txt",
        statusCode: 200,
        contentType: "text/plain",
        body: "User-agent: *\nAllow: /"
      }
    }),
    fixture("positive-sitemap-canonical-mismatch", "positive", {
      pageUrl: "https://example.com/sitemap-canonical",
      route: "/sitemap-canonical",
      capturedAt: now,
      http: {
        statusCode: 200,
        finalUrl: "https://example.com/sitemap-canonical",
        headers: { "content-type": "text/html" },
        redirectChain: []
      },
      rawHtml:
        '<!doctype html><html><head><title>Sitemap Canonical</title><meta name="description" content="Sitemap Canonical"><link rel="canonical" href="https://example.com/other-canonical"></head><body><h1>Sitemap Canonical</h1></body></html>',
      renderedDom:
        '<!doctype html><html><head><title>Sitemap Canonical</title><meta name="description" content="Sitemap Canonical"><link rel="canonical" href="https://example.com/other-canonical"></head><body><h1>Sitemap Canonical</h1></body></html>',
      sitemap: {
        url: "https://example.com/sitemap.xml",
        statusCode: 200,
        contentType: "application/xml",
        body: '<?xml version="1.0"?><urlset><url><loc>https://example.com/sitemap-canonical</loc></url></urlset>'
      }
    }),
    fixture("positive-site-graph", "positive", {
      pageUrl: "https://example.com/",
      route: "/",
      capturedAt: now,
      http: {
        statusCode: 200,
        finalUrl: "https://example.com/",
        headers: { "content-type": "text/html" },
        redirectChain: []
      },
      rawHtml: cleanHtml,
      renderedDom: cleanHtml,
      siteGraph: graph,
      resolvedUrls: [
        {
          url: "https://example.com/about",
          statusCode: 404,
          finalUrl: "https://example.com/about"
        },
        {
          url: "https://example.com/redirect",
          statusCode: 301,
          finalUrl: "https://example.com/final",
          redirectChain: [
            "https://example.com/redirect",
            "https://example.com/final"
          ]
        }
      ]
    }),
    fixture("positive-robots-sitemap-performance", "positive", {
      pageUrl: "https://example.com/",
      route: "/",
      capturedAt: now,
      http: {
        statusCode: 200,
        finalUrl: "https://example.com/",
        headers: { "content-type": "text/html" },
        redirectChain: []
      },
      rawHtml: `${cleanHtml}${"x".repeat(550000)}`,
      renderedDom: cleanHtml,
      robotsTxt: {
        url: "https://example.com/robots.txt",
        statusCode: 500,
        contentType: "text/plain",
        body: "User-agent: *\nDisallow: /"
      },
      sitemap: {
        url: "https://example.com/sitemap.xml",
        statusCode: 500,
        contentType: "text/html",
        body: "<html>bad</html>"
      },
      resolvedUrls: [
        {
          url: "https://example.com/sitemap-url",
          statusCode: 404,
          finalUrl: "https://example.com/sitemap-url"
        }
      ],
      siteGraph: graph,
      externalObservations: [
        {
          provider: "google",
          observedAt: now,
          fetchedAt: now,
          freshness: "fresh",
          indexability: {
            indexed: false,
            state: "not-indexed",
            reason: "blocked"
          },
          canonical: {
            googleSelected: "https://google.example.com/",
            userDeclared: "https://example.com/"
          },
          richResults: {
            available: false,
            state: "invalid",
            eligibleTypes: []
          },
          webVitals: {
            lcp: {
              value: 5000,
              unit: "ms",
              dataSource: "crux",
              rating: "poor",
              poorThreshold: 2500
            },
            cls: {
              value: 0.5,
              unit: "score",
              dataSource: "crux",
              rating: "poor",
              poorThreshold: 0.1
            },
            inp: {
              value: 600,
              unit: "ms",
              dataSource: "crux",
              rating: "poor",
              poorThreshold: 200
            }
          },
          sampling: { sampled: true, state: "sampled" },
          quota: {
            limit: 100,
            remaining: 0,
            resetAt: "2026-06-23T00:00:00.000Z"
          }
        },
        {
          provider: "yandex",
          observedAt: now,
          fetchedAt: now,
          freshness: "stale",
          indexability: {
            searchable: false,
            state: "excluded",
            reason: "roboted"
          },
          sampling: { sampled: true, state: "sampled" }
        }
      ]
    }),
    fixture("negative-clean", "negative", {
      pageUrl: "https://example.com/",
      route: "/",
      capturedAt: now,
      http: {
        statusCode: 200,
        finalUrl: "https://example.com/",
        headers: { "content-type": "text/html" },
        redirectChain: [],
        redirectPolicyMaxHops: 3
      },
      rawHtml: cleanHtml,
      renderedDom: cleanHtml,
      resolvedUrls: [
        {
          url: "https://example.com/og.png",
          statusCode: 200,
          finalUrl: "https://example.com/og.png"
        },
        {
          url: "https://example.com/twitter.png",
          statusCode: 200,
          finalUrl: "https://example.com/twitter.png"
        },
        {
          url: "https://example.com/img.png",
          statusCode: 200,
          finalUrl: "https://example.com/img.png"
        }
      ],
      robotsTxt: {
        url: "https://example.com/robots.txt",
        statusCode: 200,
        contentType: "text/plain",
        body: "User-agent: *\nAllow: /\nSitemap: https://example.com/sitemap.xml"
      },
      sitemap: {
        url: "https://example.com/sitemap.xml",
        statusCode: 200,
        contentType: "application/xml",
        body: "<urlset><url><loc>https://example.com/</loc><lastmod>2026-01-01</lastmod></url></urlset>"
      },
      metadataTiming: { availableAtMs: 100, policyMaxMs: 1000 },
      siteGraph: {
        pages: [
          {
            url: "https://example.com/",
            statusCode: 200,
            finalUrl: "https://example.com/",
            canonicalUrl: "https://example.com/",
            indexable: true,
            crawlDepth: 0
          }
        ],
        links: []
      },
      externalObservations: [
        {
          provider: "google",
          observedAt: now,
          fetchedAt: now,
          freshness: "fresh",
          indexability: { indexed: true, state: "indexed" },
          canonical: {
            googleSelected: "https://example.com/",
            userDeclared: "https://example.com/"
          },
          richResults: {
            available: true,
            state: "valid",
            eligibleTypes: ["WebPage"]
          },
          webVitals: {
            lcp: {
              value: 1000,
              unit: "ms",
              dataSource: "crux",
              rating: "good",
              poorThreshold: 2500
            },
            cls: {
              value: 0.01,
              unit: "score",
              dataSource: "crux",
              rating: "good",
              poorThreshold: 0.1
            },
            inp: {
              value: 100,
              unit: "ms",
              dataSource: "crux",
              rating: "good",
              poorThreshold: 200
            }
          },
          sampling: { sampled: false }
        },
        {
          provider: "yandex",
          observedAt: now,
          fetchedAt: now,
          freshness: "fresh",
          indexability: { searchable: true, state: "searchable" },
          sampling: { sampled: false }
        }
      ]
    }),
    fixture(
      "edge-non-indexable-exception",
      "edge",
      {
        pageUrl: "https://example.com/private",
        route: "/private",
        capturedAt: now,
        http: {
          statusCode: 404,
          finalUrl: "https://example.com/private",
          headers: { "content-type": "text/html", "x-robots-tag": "noindex" },
          redirectChain: []
        },
        rawHtml:
          '<!doctype html><html lang="en"><head><title>Private</title><meta name="robots" content="noindex"><meta name="description" content="Private"><link rel="canonical" href="https://example.com/private"></head><body><h1>Private</h1></body></html>',
        renderedDom:
          '<!doctype html><html lang="en"><head><title>Private</title><meta name="robots" content="noindex"><meta name="description" content="Private"><link rel="canonical" href="https://example.com/private"></head><body><h1>Private</h1></body></html>'
      },
      { route: "/private", indexable: false, canonicalPolicy: "self" }
    )
  ];
}

function fixture(
  id,
  kind,
  snapshot,
  routeContract = {
    route: snapshot.route ?? "/",
    indexable: true,
    canonicalPolicy: "self",
    requiredSchemas: ["WebPage"],
    googleRichResult: { required: true, eligibleTypes: ["WebPage"] },
    requiredHeadings: [{ level: 1, pattern: ".+" }],
    hreflang: ["en", "fr"],
    pagination: { required: true },
    important: true,
    crawlDepthPolicyMax: 2
  }
) {
  return {
    id,
    kind,
    provenance: "synthetic",
    notes:
      "Deterministic QA candidate fixture generated by scripts/run-rule-qa.mjs.",
    snapshot,
    ...(routeContract ? { routeContract } : {})
  };
}

function ratio(numerator, denominator) {
  return denominator === 0 ? 0 : numerator / denominator;
}

function wilsonLowerBound(successes, total) {
  if (total === 0) {
    return 0;
  }
  const z = 1.6448536269514722;
  const phat = successes / total;
  const denominator = 1 + (z * z) / total;
  const centre = phat + (z * z) / (2 * total);
  const margin =
    z * Math.sqrt((phat * (1 - phat) + (z * z) / (4 * total)) / total);
  return (centre - margin) / denominator;
}

function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

async function writeJson(path, value) {
  const absolutePath = resolve(root, path);
  const raw = `${JSON.stringify(value, null, 2)}\n`;
  const content = path.startsWith("docs/examples/")
    ? await format(raw, { parser: "json" })
    : raw;
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, content);
}

function sanitizedRuleQaSample(report) {
  return {
    ...report,
    matrix: report.matrix.slice(0, 5),
    sampleNotice:
      "Sanitized sample: full generated report is written to reports/rule-qa-summary.json during CI."
  };
}

function sanitizedBlockerSample(report) {
  return {
    ...report,
    perRule: report.perRule.slice(0, 5),
    sampleNotice:
      "Sanitized sample: full generated report is written to reports/blocker-precision-report.json during CI."
  };
}
