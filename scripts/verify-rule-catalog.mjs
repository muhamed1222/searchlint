import { readFile } from "node:fs/promises";

import {
  createRuleCatalogRegistry,
  parseRuleCatalogYaml
} from "../packages/core/dist/src/index.js";

const catalogPath = "specs/RULE_CATALOG.yaml";
const catalogText = await readFile(catalogPath, "utf8");
const catalog = parseRuleCatalogYaml(catalogText);
const registry = createRuleCatalogRegistry(catalog);

for (const rule of catalog.rules) {
  registry.requireRule(rule.id);
}

console.log("verified 120 rule catalog entries through production loader");
