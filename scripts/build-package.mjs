#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { dirname } from "node:path";

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const generatedTextModules = packageJson.searchlint?.generatedTextModules;

if (Array.isArray(generatedTextModules)) {
  for (const moduleConfig of generatedTextModules) {
    if (
      typeof moduleConfig.source !== "string" ||
      moduleConfig.source.length === 0 ||
      typeof moduleConfig.target !== "string" ||
      moduleConfig.target.length === 0 ||
      typeof moduleConfig.exportName !== "string" ||
      moduleConfig.exportName.length === 0
    ) {
      throw new Error(
        "generatedTextModules entries require source, target, and exportName"
      );
    }
    const sourceText = readFileSync(moduleConfig.source, "utf8");
    mkdirSync(dirname(moduleConfig.target), { recursive: true });
    writeFileSync(
      moduleConfig.target,
      `export const ${moduleConfig.exportName} = ${JSON.stringify(sourceText)};\n`
    );
  }
}

rmSync("dist", { recursive: true, force: true });
execFileSync("tsc", ["-p", "tsconfig.build.json"], {
  stdio: "inherit"
});

const packageAssets = packageJson.searchlint?.copyAssets;
const dashboardBrowserAssets = packageJson.searchlint?.dashboardBrowserAssets;

if (Array.isArray(packageAssets)) {
  for (const asset of packageAssets) {
    if (
      typeof asset.source !== "string" ||
      asset.source.length === 0 ||
      typeof asset.target !== "string" ||
      asset.target.length === 0
    ) {
      throw new Error("copyAssets entries require source and target");
    }
    mkdirSync(dirname(asset.target), { recursive: true });
    copyFileSync(asset.source, asset.target);
  }
}

if (Array.isArray(dashboardBrowserAssets)) {
  for (const assetConfig of dashboardBrowserAssets) {
    buildDashboardBrowserAsset(assetConfig);
  }
}

function buildDashboardBrowserAsset(assetConfig) {
  for (const key of ["name", "manifest", "moduleScript"]) {
    if (typeof assetConfig[key] !== "string" || assetConfig[key].length === 0) {
      throw new Error(`dashboardBrowserAssets entry requires ${key}`);
    }
  }
  if (!Array.isArray(assetConfig.modules) || assetConfig.modules.length === 0) {
    throw new Error("dashboardBrowserAssets entry requires modules");
  }

  const importMapEntries = Object.entries(
    assetConfig.importMap?.imports ?? {}
  ).map(([specifier, moduleConfig]) => ({
    ...moduleConfig,
    specifier
  }));
  const moduleConfigs = [...assetConfig.modules, ...importMapEntries];
  const generatedModules = moduleConfigs.map(copyDashboardBrowserModule);
  const generatedBundle =
    assetConfig.bundle === undefined
      ? undefined
      : buildDashboardBrowserBundle(assetConfig, moduleConfigs);
  const importMap = {
    imports: Object.fromEntries(
      importMapEntries.map((moduleConfig) => [
        moduleConfig.specifier,
        moduleConfig.moduleScript
      ])
    )
  };

  const manifest = {
    generatedBy: "searchlint-dashboard-browser-asset-pipeline",
    entry: {
      name: assetConfig.name,
      moduleScript: assetConfig.moduleScript
    },
    ...(generatedBundle === undefined ? {} : { bundle: generatedBundle }),
    importMap,
    assets: generatedModules
  };

  mkdirSync(dirname(assetConfig.manifest), { recursive: true });
  writeFileSync(assetConfig.manifest, `${JSON.stringify(manifest, null, 2)}\n`);
}

function buildDashboardBrowserBundle(assetConfig, moduleConfigs) {
  const bundleConfig = assetConfig.bundle;
  for (const key of ["name", "asset", "moduleScript"]) {
    if (
      typeof bundleConfig[key] !== "string" ||
      bundleConfig[key].length === 0
    ) {
      throw new Error(`dashboard browser bundle requires ${key}`);
    }
  }

  const modulesByName = new Map(
    moduleConfigs.map((moduleConfig) => [moduleConfig.name, moduleConfig])
  );
  const orderedModuleNames = [
    "searchlint-api-http-contracts",
    "searchlint-dashboard-api-client",
    "searchlint-dashboard-index",
    "searchlint-dashboard-browser-entry",
    "searchlint-dashboard-browser-entry-auto"
  ];
  const missingModule = orderedModuleNames.find(
    (moduleName) => !modulesByName.has(moduleName)
  );
  if (missingModule !== undefined) {
    throw new Error(
      `${assetConfig.name} bundle requires dashboard module ${missingModule}`
    );
  }

  const moduleInputs = orderedModuleNames.map((moduleName) => {
    const moduleConfig = modulesByName.get(moduleName);
    return {
      name: moduleName,
      source: moduleConfig.source,
      exports: collectDashboardModuleExports(moduleConfig.source),
      sourceText: readFileSync(moduleConfig.source, "utf8")
    };
  });
  const compactModuleGraphBytes = Buffer.byteLength(
    moduleInputs
      .map((moduleInput) =>
        compactDashboardBrowserSource(moduleInput.sourceText)
      )
      .join("\n"),
    "utf8"
  );
  const bundleSource = createDashboardBrowserBundleSource(moduleInputs);
  const bundleBytes = Buffer.from(bundleSource, "utf8");

  mkdirSync(dirname(bundleConfig.asset), { recursive: true });
  writeFileSync(bundleConfig.asset, bundleBytes);

  return {
    name: bundleConfig.name,
    asset: bundleConfig.asset,
    moduleScript: bundleConfig.moduleScript,
    bytes: bundleBytes.byteLength,
    sha256: createHash("sha256").update(bundleBytes).digest("hex"),
    compactModuleGraphBytes,
    modules: moduleInputs.map((moduleInput) => ({
      name: moduleInput.name,
      source: moduleInput.source
    }))
  };
}

function collectDashboardModuleExports(sourcePath) {
  const sourceText = readFileSync(sourcePath, "utf8");
  const exports = [];
  const patterns = [
    /\bexport\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g,
    /\bexport\s+class\s+([A-Za-z_$][\w$]*)/g,
    /\bexport\s+const\s+([A-Za-z_$][\w$]*)/g
  ];

  for (const pattern of patterns) {
    for (const match of sourceText.matchAll(pattern)) {
      exports.push(match[1]);
    }
  }

  return exports;
}

function createDashboardBrowserBundleSource(moduleInputs) {
  const chunks = [
    "const __searchlintDashboardBundleModules = Object.create(null);"
  ];

  for (const moduleInput of moduleInputs) {
    chunks.push(
      `(()=>{`,
      createDashboardBrowserModulePrelude(moduleInput.name),
      transformDashboardBrowserModuleSource(moduleInput.sourceText),
      createDashboardBrowserModuleExportAssignment(moduleInput.exports),
      `})();`
    );
  }

  return `${compactDashboardBrowserSource(chunks.join("\n"))}\n`;
}

function createDashboardBrowserModulePrelude(moduleName) {
  if (moduleName === "searchlint-dashboard-api-client") {
    return "const {routeContractForOperation}=__searchlintDashboardBundleModules;";
  }
  if (moduleName === "searchlint-dashboard-index") {
    return [
      "const {routeContractForOperation,",
      "createDashboardBrowserAuthSessionStore,",
      "createDashboardCognitoStoredSessionApiClient,",
      "getDashboardStoredAuthSessionState}=__searchlintDashboardBundleModules;"
    ].join("");
  }
  if (moduleName === "searchlint-dashboard-browser-entry") {
    return "const {startDashboardHostedBrowserEntry}=__searchlintDashboardBundleModules;";
  }
  if (moduleName === "searchlint-dashboard-browser-entry-auto") {
    return "const {startSearchLintDashboardBrowserEntryFromGlobal}=__searchlintDashboardBundleModules;";
  }
  return "";
}

function transformDashboardBrowserModuleSource(sourceText) {
  return sourceText
    .replace(/^import\s+[^;]+;\n?/gm, "")
    .replace(/^export\s+\*\s+from\s+["'][^"']+["'];\n?/gm, "")
    .replace(/\bexport\s+(async\s+function)\s+/g, "$1 ")
    .replace(/\bexport\s+(function|class|const)\s+/g, "$1 ");
}

function createDashboardBrowserModuleExportAssignment(exports) {
  if (exports.length === 0) {
    return "";
  }
  return `Object.assign(__searchlintDashboardBundleModules,{${exports.join(",")}});`;
}

function compactDashboardBrowserSource(sourceText) {
  return sourceText
    .split("\n")
    .map((line) => line.trim())
    .filter(
      (line) => line.length > 0 && !line.startsWith("//# sourceMappingURL=")
    )
    .join("\n");
}

function copyDashboardBrowserModule(moduleConfig) {
  for (const key of ["name", "source", "asset", "moduleScript"]) {
    if (
      typeof moduleConfig[key] !== "string" ||
      moduleConfig[key].length === 0
    ) {
      throw new Error(`dashboard browser module requires ${key}`);
    }
  }

  const sourceBytes = readFileSync(moduleConfig.source);
  mkdirSync(dirname(moduleConfig.asset), { recursive: true });
  copyFileSync(moduleConfig.source, moduleConfig.asset);

  return {
    name: moduleConfig.name,
    source: moduleConfig.source,
    asset: moduleConfig.asset,
    moduleScript: moduleConfig.moduleScript,
    bytes: sourceBytes.byteLength,
    sha256: createHash("sha256").update(sourceBytes).digest("hex")
  };
}
