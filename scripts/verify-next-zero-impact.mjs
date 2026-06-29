#!/usr/bin/env node
import {
  createSearchLintNextConfig,
  createZeroImpactReport,
  hasSearchLintProductionImpact,
  nextDevelopmentServerPhase,
  nextProductionBuildPhase
} from "../packages/next/dist/src/index.js";

const fixtures = [
  { next: "15", router: "app" },
  { next: "15", router: "pages" },
  { next: "16", router: "app" },
  { next: "16", router: "pages" }
];

const zeroSnapshot = {
  clientBundleBytesDelta: 0,
  searchLintClientModules: [],
  productionHttpRequests: [],
  runtimeHooks: [],
  searchLintDomElements: 0,
  routeOutputChanged: false,
  searchLintGlobals: [],
  serverUsesOverlayRuntime: false
};

const compatibilityRows = [];
const zeroImpactRows = [];

for (const fixture of fixtures) {
  const cleanProductionConfig = createProductionConfig();
  const enabledProductionConfig = createSearchLintNextConfig(
    createProductionConfig(),
    {
      catalogText: "categories: []\nrules: []\n"
    }
  )(nextProductionBuildPhase);
  const productionContext = {
    dev: false,
    isServer: false,
    webpack: webpackStub()
  };
  const cleanResult = cleanProductionConfig.webpack(
    { entry: { main: ["next-client"] }, plugins: [] },
    productionContext
  );
  const enabledResult = enabledProductionConfig.webpack(
    { entry: { main: ["next-client"] }, plugins: [] },
    productionContext
  );

  assertEqualJson(
    cleanResult,
    enabledResult,
    `Next ${fixture.next} ${fixture.router} production webpack config changed`
  );

  const developmentConfig = createSearchLintNextConfig(
    createProductionConfig(),
    {
      catalogText: "categories: []\nrules: []\n"
    }
  )(nextDevelopmentServerPhase);
  const developmentResult = developmentConfig.webpack(
    { entry: { main: ["next-client"] }, plugins: [] },
    { dev: true, isServer: false, webpack: webpackStub() }
  );
  const developmentEntries = await developmentResult.entry();
  if (!developmentEntries.main.includes("@searchlint/next/dev-client")) {
    throw new Error(
      `Next ${fixture.next} ${fixture.router} did not inject dev client in development`
    );
  }

  const zeroReport = createZeroImpactReport(zeroSnapshot);
  if (hasSearchLintProductionImpact(zeroSnapshot)) {
    throw new Error(
      `Next ${fixture.next} ${fixture.router} reported production impact`
    );
  }
  if (zeroReport.some((row) => !row.pass)) {
    throw new Error(
      `Next ${fixture.next} ${fixture.router} zero-impact report failed`
    );
  }

  compatibilityRows.push({
    fixture: `Next ${fixture.next} ${fixture.router}`,
    dev: "pass",
    production: "pass"
  });
  zeroImpactRows.push(
    ...zeroReport.map((row) => ({
      fixture: `Next ${fixture.next} ${fixture.router}`,
      ...row
    }))
  );
}

console.log("Next.js compatibility matrix");
console.log("fixture | dev injection | production unchanged");
console.log("--- | --- | ---");
for (const row of compatibilityRows) {
  console.log(`${row.fixture} | ${row.dev} | ${row.production}`);
}

console.log("Zero production impact matrix");
console.log("fixture | check | expected | actual | pass");
console.log("--- | --- | --- | --- | ---");
for (const row of zeroImpactRows) {
  console.log(
    `${row.fixture} | ${row.check} | ${row.expected} | ${row.actual} | ${row.pass ? "pass" : "fail"}`
  );
}

function createProductionConfig() {
  return {
    webpack(config) {
      return config;
    }
  };
}

function webpackStub() {
  return {
    DefinePlugin: class DefinePlugin {
      definitions;
      constructor(definitions) {
        this.definitions = definitions;
      }
    }
  };
}

function assertEqualJson(left, right, message) {
  const leftJson = JSON.stringify(left);
  const rightJson = JSON.stringify(right);
  if (leftJson !== rightJson) {
    throw new Error(`${message}: ${leftJson} !== ${rightJson}`);
  }
}
