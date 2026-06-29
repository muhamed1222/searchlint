#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

const dashboardPackagePath = "apps/dashboard/package.json";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function verifyDashboardBrowserAssets() {
  const dashboardManifest = await readJson(dashboardPackagePath);
  const assetConfigs = dashboardManifest.searchlint?.dashboardBrowserAssets;
  assert(
    Array.isArray(assetConfigs) && assetConfigs.length > 0,
    "@searchlint/dashboard must declare searchlint.dashboardBrowserAssets"
  );

  for (const assetConfig of assetConfigs) {
    verifyAssetConfig(assetConfig);
    const assetManifest = await readJson(
      `apps/dashboard/${assetConfig.manifest}`
    );

    assert(
      assetManifest.generatedBy ===
        "searchlint-dashboard-browser-asset-pipeline",
      `${assetConfig.name} manifest generatedBy is invalid`
    );
    assert(
      assetManifest.entry?.name === assetConfig.name,
      `${assetConfig.name} manifest entry name mismatch`
    );
    assert(
      assetManifest.entry?.moduleScript === assetConfig.moduleScript,
      `${assetConfig.name} manifest entry moduleScript mismatch`
    );
    assert(
      Array.isArray(assetManifest.assets) && assetManifest.assets.length > 0,
      `${assetConfig.name} manifest must contain generated assets`
    );

    const moduleConfigs = collectAssetModuleConfigs(assetConfig);
    assert(
      assetManifest.assets.length === moduleConfigs.length,
      `${assetConfig.name} manifest asset count mismatch`
    );

    const manifestAssetsByName = new Map(
      assetManifest.assets.map((asset) => [asset.name, asset])
    );
    const generatedAssetsByAssetPath = new Map();
    const generatedAssetsByModuleScript = new Map();

    for (const moduleConfig of moduleConfigs) {
      verifyModuleConfig(assetConfig.name, moduleConfig);
      const manifestAsset = manifestAssetsByName.get(moduleConfig.name);
      assert(
        manifestAsset !== undefined,
        `${assetConfig.name} manifest missing ${moduleConfig.name}`
      );
      const [sourceBytes, assetBytes] = await Promise.all([
        readFile(resolveDashboardPath(moduleConfig.source)),
        readFile(resolveDashboardPath(moduleConfig.asset))
      ]);

      assert(
        sourceBytes.equals(assetBytes),
        `${moduleConfig.name} generated browser asset must match its built source`
      );
      const hash = createHash("sha256").update(assetBytes).digest("hex");
      assert(
        manifestAsset.name === moduleConfig.name,
        `${moduleConfig.name} manifest name mismatch`
      );
      assert(
        manifestAsset.source === moduleConfig.source,
        `${moduleConfig.name} manifest source mismatch`
      );
      assert(
        manifestAsset.asset === moduleConfig.asset,
        `${moduleConfig.name} manifest asset mismatch`
      );
      assert(
        manifestAsset.moduleScript === moduleConfig.moduleScript,
        `${moduleConfig.name} manifest moduleScript mismatch`
      );
      assert(
        manifestAsset.bytes === assetBytes.byteLength,
        `${moduleConfig.name} manifest byte size mismatch`
      );
      assert(
        manifestAsset.sha256 === hash,
        `${moduleConfig.name} manifest sha256 mismatch`
      );

      generatedAssetsByAssetPath.set(moduleConfig.asset, {
        ...moduleConfig,
        sourceText: assetBytes.toString("utf8")
      });
      generatedAssetsByModuleScript.set(
        moduleConfig.moduleScript,
        moduleConfig
      );
    }

    const manifestImportMap = assetManifest.importMap?.imports ?? {};
    assert(
      JSON.stringify(manifestImportMap) ===
        JSON.stringify(expectedManifestImportMap(assetConfig)),
      `${assetConfig.name} manifest import map mismatch`
    );
    assert(
      generatedAssetsByModuleScript.has(assetConfig.moduleScript),
      `${assetConfig.name} moduleScript must point to a generated asset`
    );
    await verifyGeneratedBundle({
      assetName: assetConfig.name,
      assetConfig,
      assetManifest,
      moduleConfigs,
      generatedAssetsByModuleScript
    });

    verifyGeneratedImportGraph({
      assetName: assetConfig.name,
      generatedAssetsByAssetPath,
      generatedAssetsByModuleScript,
      importMap: manifestImportMap
    });
  }

  console.log(
    `verified ${assetConfigs.length} SearchLint dashboard browser asset manifest`
  );
}

async function verifyGeneratedBundle({
  assetName,
  assetConfig,
  assetManifest,
  moduleConfigs,
  generatedAssetsByModuleScript
}) {
  const bundleConfig = assetConfig.bundle;
  const manifestBundle = assetManifest.bundle;
  assert(
    manifestBundle !== undefined,
    `${assetName} manifest must contain bundle metadata`
  );
  assert(
    manifestBundle.name === bundleConfig.name,
    `${assetName} bundle manifest name mismatch`
  );
  assert(
    manifestBundle.asset === bundleConfig.asset,
    `${assetName} bundle manifest asset mismatch`
  );
  assert(
    manifestBundle.moduleScript === bundleConfig.moduleScript,
    `${assetName} bundle manifest moduleScript mismatch`
  );
  assert(
    !generatedAssetsByModuleScript.has(bundleConfig.moduleScript),
    `${assetName} bundled moduleScript must be separate from copied ESM assets`
  );

  const bundleBytes = await readFile(resolveDashboardPath(bundleConfig.asset));
  const bundleHash = createHash("sha256").update(bundleBytes).digest("hex");
  assert(
    manifestBundle.bytes === bundleBytes.byteLength,
    `${assetName} bundle byte size mismatch`
  );
  assert(
    manifestBundle.sha256 === bundleHash,
    `${assetName} bundle sha256 mismatch`
  );
  assert(
    Array.isArray(manifestBundle.modules) &&
      manifestBundle.modules.length === moduleConfigs.length,
    `${assetName} bundle module list mismatch`
  );
  assert(
    manifestBundle.bytes <=
      Math.ceil(manifestBundle.compactModuleGraphBytes * 1.05),
    `${assetName} bundle must stay within 5% of the compact module graph`
  );

  const bundleText = bundleBytes.toString("utf8");
  assert(
    collectRuntimeImportSpecifiers(bundleText).length === 0,
    `${assetName} bundle must not contain runtime import statements`
  );
  assert(
    bundleText.includes("__searchlintDashboardBundleModules"),
    `${assetName} bundle must contain the dashboard module wrapper`
  );
}

function collectAssetModuleConfigs(assetConfig) {
  const importMapModules = Object.entries(
    assetConfig.importMap?.imports ?? {}
  ).map(([specifier, moduleConfig]) => ({
    ...moduleConfig,
    specifier
  }));

  return [...assetConfig.modules, ...importMapModules];
}

function expectedManifestImportMap(assetConfig) {
  return Object.fromEntries(
    Object.entries(assetConfig.importMap?.imports ?? {}).map(
      ([specifier, moduleConfig]) => [specifier, moduleConfig.moduleScript]
    )
  );
}

function verifyImportMapConfig(assetName, importMap) {
  const imports = importMap?.imports ?? {};
  assert(
    imports && typeof imports === "object" && !Array.isArray(imports),
    `${assetName} importMap.imports must be an object`
  );
  for (const [specifier, moduleConfig] of Object.entries(imports)) {
    assert(
      typeof specifier === "string" && specifier.length > 0,
      `${assetName} import map specifier must be non-empty`
    );
    verifyModuleConfig(assetName, {
      ...moduleConfig,
      specifier
    });
  }
}

function verifyGeneratedImportGraph({
  assetName,
  generatedAssetsByAssetPath,
  generatedAssetsByModuleScript,
  importMap
}) {
  for (const generatedAsset of generatedAssetsByAssetPath.values()) {
    for (const specifier of collectRuntimeImportSpecifiers(
      generatedAsset.sourceText
    )) {
      if (specifier.startsWith("./") || specifier.startsWith("../")) {
        const resolvedAsset = path.posix.normalize(
          path.posix.join(path.posix.dirname(generatedAsset.asset), specifier)
        );
        assert(
          generatedAssetsByAssetPath.has(resolvedAsset),
          `${assetName} unresolved relative import ${specifier} from ${generatedAsset.asset}`
        );
        continue;
      }

      if (specifier.startsWith("/")) {
        assert(
          generatedAssetsByModuleScript.has(specifier),
          `${assetName} unresolved absolute import ${specifier} from ${generatedAsset.asset}`
        );
        continue;
      }

      const mappedModuleScript = importMap[specifier];
      assert(
        typeof mappedModuleScript === "string" &&
          generatedAssetsByModuleScript.has(mappedModuleScript),
        `${assetName} bare import ${specifier} from ${generatedAsset.asset} must be mapped to a generated asset`
      );
    }
  }
}

function collectRuntimeImportSpecifiers(sourceText) {
  const specifiers = [];
  const patterns = [
    /\bimport\s+(?:[^'"]*?\s+from\s*)?["']([^"']+)["']/g,
    /\bexport\s+[^'"]*?\s+from\s+["']([^"']+)["']/g,
    /\bimport\(\s*["']([^"']+)["']\s*\)/g
  ];

  for (const pattern of patterns) {
    for (const match of sourceText.matchAll(pattern)) {
      specifiers.push(match[1]);
    }
  }

  return specifiers;
}

function resolveDashboardPath(filePath) {
  return path.join("apps/dashboard", filePath);
}

function verifyModuleConfig(assetName, moduleConfig) {
  for (const key of ["name", "source", "asset", "moduleScript"]) {
    assert(
      typeof moduleConfig[key] === "string" && moduleConfig[key].length > 0,
      `${assetName} dashboard browser module requires ${key}`
    );
  }
  assert(
    moduleConfig.asset.startsWith("dist/assets/"),
    `${moduleConfig.name} asset must point at dist/assets`
  );
  assert(
    moduleConfig.moduleScript.startsWith("/assets/"),
    `${moduleConfig.name} moduleScript must be an absolute asset path`
  );
}

function verifyAssetConfig(assetConfig) {
  for (const key of ["name", "manifest", "moduleScript"]) {
    assert(
      typeof assetConfig[key] === "string" && assetConfig[key].length > 0,
      `dashboardBrowserAssets entry requires ${key}`
    );
  }
  assert(
    Array.isArray(assetConfig.modules) && assetConfig.modules.length > 0,
    `${assetConfig.name} must declare generated browser modules`
  );
  assert(
    assetConfig.manifest.startsWith("dist/assets/"),
    `${assetConfig.name} manifest must point at dist/assets`
  );
  assert(
    assetConfig.moduleScript.startsWith("/assets/"),
    `${assetConfig.name} moduleScript must be an absolute asset path`
  );
  verifyBundleConfig(assetConfig);
  verifyImportMapConfig(assetConfig.name, assetConfig.importMap);
}

function verifyBundleConfig(assetConfig) {
  const bundleConfig = assetConfig.bundle;
  assert(
    bundleConfig && typeof bundleConfig === "object",
    `${assetConfig.name} dashboardBrowserAssets entry requires bundle`
  );
  for (const key of ["name", "asset", "moduleScript"]) {
    assert(
      typeof bundleConfig[key] === "string" && bundleConfig[key].length > 0,
      `${assetConfig.name} dashboard browser bundle requires ${key}`
    );
  }
  assert(
    bundleConfig.asset.startsWith("dist/assets/"),
    `${assetConfig.name} bundle asset must point at dist/assets`
  );
  assert(
    bundleConfig.moduleScript.startsWith("/assets/"),
    `${assetConfig.name} bundle moduleScript must be an absolute asset path`
  );
}

await verifyDashboardBrowserAssets();
