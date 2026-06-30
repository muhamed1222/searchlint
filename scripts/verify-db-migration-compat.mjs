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
const reportPath = path.join(
  repoRoot,
  "reports/db-migration-compat-report.json"
);
const samplePath = path.join(
  repoRoot,
  "docs/examples/db-migration-compat-report.sample.json"
);
const migrationTestPath = path.join(
  repoRoot,
  "services/api/test/postgres-migrations.test.ts"
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
    "postgres-migrations.test.ts",
    "postgres-integration.test.ts"
  ]);
  run("pnpm", ["--filter", "@searchlint/api", "build"]);

  const migrationsModule =
    await import("../services/api/dist/src/postgres-migrations.js");
  const migrations = migrationsModule.createCurrentCloudSchemaMigrations();
  const migrationTests = await readFile(migrationTestPath, "utf8");

  assert(
    migrations.length >= 2,
    "Current cloud schema must have a base migration and at least one follow-up migration."
  );
  assert(
    migrations[0]?.id === "cloud-persistence-schema-v1",
    "First migration must be the cloud persistence schema v1 base migration."
  );
  assert(
    migrations[1]?.id === "cloud-crawl-execution-metadata-v1",
    "Second migration must be the additive crawl execution metadata migration."
  );

  const migrationIds = migrations.map((migration) => migration.id);
  assert(
    new Set(migrationIds).size === migrationIds.length,
    "Migration ids must be unique."
  );

  for (const migration of migrations) {
    assert(
      /^[a-f0-9]{64}$/u.test(migration.checksum),
      `Migration ${migration.id} checksum must be sha256.`
    );
    assert(
      migration.statements.length > 0,
      `Migration ${migration.id} must contain SQL statements.`
    );
  }

  const additiveMigration = migrations[1];
  for (const statement of additiveMigration.statements) {
    assert(
      statement.startsWith(
        'ALTER TABLE "crawl_requests" ADD COLUMN IF NOT EXISTS '
      ),
      "Additive migration must use ALTER TABLE ADD COLUMN IF NOT EXISTS."
    );
  }
  assert(
    !migrations[0].statements.join("\n").includes('"started_at"'),
    "Base schema v1 migration must not be rewritten with additive crawl metadata columns."
  );

  const requiredTestEvidence = [
    ["pending-apply", "applies pending statements"],
    ["idempotent-skip", "skips already applied migrations"],
    ["checksum-drift", "rejects checksum drift"],
    ["rollback-release", "rolls back and releases"],
    ["empty-migration", "rejects empty migration SQL"]
  ];
  for (const [, phrase] of requiredTestEvidence) {
    assert(
      migrationTests.includes(phrase),
      `postgres-migrations.test.ts must cover: ${phrase}.`
    );
  }

  const migrationSummaries = migrations.map((migration, index) => ({
    order: index + 1,
    id: migration.id,
    checksum: migration.checksum,
    statementCount: migration.statements.length,
    compatibilityRole: index === 0 ? "base-schema" : "additive-follow-up"
  }));

  const report = {
    schemaVersion: 1,
    generatedBy: "searchlint-db-migration-compat-verifier",
    generatedAt,
    status: "passed",
    methodology: {
      liveDatabaseAccess: "not used by verifier",
      scope:
        "local PostgreSQL migration chain, migration ledger behavior, and additive schema compatibility",
      tests: [
        "services/api/test/postgres-migrations.test.ts",
        "services/api/test/postgres-integration.test.ts"
      ]
    },
    migrationChain: {
      status: "passed",
      migrationCount: migrations.length,
      migrations: migrationSummaries
    },
    compatibilityChecks: [
      {
        id: "ordered-base-then-additive",
        status: "passed",
        evidence:
          "cloud-persistence-schema-v1 is followed by cloud-crawl-execution-metadata-v1"
      },
      {
        id: "stable-checksums",
        status: "passed",
        evidence: "all migration checksums are deterministic sha256 digests"
      },
      {
        id: "base-schema-not-rewritten",
        status: "passed",
        evidence:
          "crawl execution metadata columns are absent from the base v1 migration"
      },
      {
        id: "additive-if-not-exists",
        status: "passed",
        evidence:
          "follow-up crawl metadata migration uses ADD COLUMN IF NOT EXISTS"
      },
      {
        id: "ledger-behavior",
        status: "passed",
        evidence:
          "tests cover apply, skip, checksum drift rejection, rollback, release, and empty migration rejection"
      }
    ],
    remainingGates: [
      "live RDS migration execution",
      "future-version upgrade rehearsal when a v2 schema exists",
      "data backfill compatibility proof for any future non-additive migration",
      "backup restore and point-in-time recovery drills before production release"
    ]
  };

  await mkdir(path.dirname(reportPath), { recursive: true });
  await mkdir(path.dirname(samplePath), { recursive: true });
  await writeJson(reportPath, report);
  await writeJson(samplePath, report);

  console.log(
    `DB migration compatibility PASS: migrations=${migrations.length}, ids=${migrationIds.join(",")}`
  );
  console.log(`Report: ${path.relative(repoRoot, reportPath)}`);
  console.log(`Sample: ${path.relative(repoRoot, samplePath)}`);
}

async function writeJson(filePath, data) {
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
