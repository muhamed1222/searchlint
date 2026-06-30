#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const generatedAt = "2026-06-22T00:00:00.000Z";
const reportPath = path.join(repoRoot, "reports/db-tenant-rbac-report.json");
const samplePath = path.join(
  repoRoot,
  "docs/examples/db-tenant-rbac-report.sample.json"
);

const schemaPath = path.join(repoRoot, "services/api/src/schema-contracts.ts");
const sqlPath = path.join(
  repoRoot,
  "services/api/src/postgres-repository-sql.ts"
);

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    env: { ...process.env, ...options.env },
    encoding: "utf8",
    stdio: options.stdio ?? "pipe"
  });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  run("pnpm", [
    "--filter",
    "@searchlint/api",
    "test",
    "--",
    "api.test.ts",
    "postgres-relational-store.test.ts",
    "postgres-repository-sql.test.ts",
    "contracts.test.ts"
  ]);

  const [schemaText, sqlText] = await Promise.all([
    readFile(schemaPath, "utf8"),
    readFile(sqlPath, "utf8")
  ]);
  const tenantScopedCount = countMatches(schemaText, /tenantScoped:\s*true/g);
  const tenantColumnCount = countMatches(
    schemaText,
    /name:\s*"organization_id"/g
  );
  const orgFilterCount = countMatches(
    sqlText,
    /"organization_id"\s*=\s*\$\d+/g
  );
  const orgValueCount = countMatches(sqlText, /organizationId/g);

  assert(
    schemaText.includes("const standardTenantColumns") &&
      schemaText.includes(
        '{ name: "organization_id", type: "text", nullable: false }'
      ),
    "Tenant-scoped schema must define non-null organization_id."
  );
  assert(tenantScopedCount >= 10, "Expected multiple tenant-scoped tables.");
  assert(
    tenantColumnCount >= 1 && schemaText.includes("...standardTenantColumns"),
    "Tenant-scoped tables must include standard tenant columns."
  );
  assert(
    orgFilterCount >= 10,
    "PostgreSQL SQL contracts must include organization_id filters."
  );
  assert(
    orgValueCount >= orgFilterCount,
    "PostgreSQL SQL contracts must bind organizationId values."
  );

  const report = {
    schemaVersion: 1,
    generatedBy: "searchlint-db-tenant-rbac-verifier",
    generatedAt,
    status: "passed",
    methodology: {
      liveDatabaseAccess: "not used by verifier",
      scope:
        "local @searchlint/api tenant-scoped schema, PostgreSQL SQL contracts, and API RBAC tests",
      tests: [
        "services/api/test/api.test.ts",
        "services/api/test/postgres-relational-store.test.ts",
        "services/api/test/postgres-repository-sql.test.ts",
        "services/api/test/contracts.test.ts"
      ]
    },
    tenantIsolation: {
      status: "passed",
      evidence: {
        tenantScopedTableCount: tenantScopedCount,
        organizationIdColumnOccurrences: tenantColumnCount,
        standardTenantColumnsUsed: schemaText.includes(
          "...standardTenantColumns"
        ),
        organizationIdSqlFilterOccurrences: orgFilterCount,
        checkedBehaviors: [
          "tenant-scoped schema contracts use organization_id",
          "PostgreSQL read/write SQL contracts bind organizationId",
          "dashboard and repository SQL tests cover tenant-scoped queries",
          "API tests verify cross-organization writes are rejected without side effects"
        ]
      }
    },
    rbacDataLayer: {
      status: "passed",
      evidence: {
        authorizationSource:
          "SearchLint-owned PostgreSQL organization memberships",
        checkedBehaviors: [
          "API authorization matrix is covered by local tests",
          "membership role SQL is tenant-scoped by organization_id",
          "member removal and ownership transfer writes run through transaction-scoped ports",
          "unauthorized operations preserve side-effect snapshots"
        ]
      }
    },
    remainingGates: [
      "live PostgreSQL-backed authorization matrix run",
      "deployed RDS tenant isolation proof",
      "database row-level security decision if required later",
      "external security review of tenant isolation"
    ]
  };

  await mkdir(path.dirname(reportPath), { recursive: true });
  await mkdir(path.dirname(samplePath), { recursive: true });
  await writeJson(reportPath, report);
  await writeJson(samplePath, report);

  console.log(
    `DB tenant/RBAC PASS: tenantTables=${tenantScopedCount}, orgFilters=${orgFilterCount}`
  );
  console.log(`Report: ${path.relative(repoRoot, reportPath)}`);
  console.log(`Sample: ${path.relative(repoRoot, samplePath)}`);
}

function countMatches(text, pattern) {
  return [...text.matchAll(pattern)].length;
}

async function writeJson(filePath, data) {
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
