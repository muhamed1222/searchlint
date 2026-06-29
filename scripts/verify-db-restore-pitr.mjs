#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const generatedAt = "2026-06-22T00:00:00.000Z";
const reportPath = path.join(repoRoot, "reports/db-restore-pitr-report.json");
const samplePath = path.join(
  repoRoot,
  "docs/examples/db-restore-pitr-report.sample.json"
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
    "postgres-restore-pitr.test.ts",
    "postgres-migrations.test.ts"
  ]);
  run("pnpm", ["--filter", "@searchlint/api", "build"]);

  const [api, ddl] = await Promise.all([
    import("../services/api/dist/src/index.js"),
    import("../services/api/dist/src/postgres-ddl.js")
  ]);
  const source = await readFile(
    path.join(repoRoot, "services/api/src/postgres-restore-pitr.ts"),
    "utf8"
  );
  const tests = await readFile(
    path.join(repoRoot, "services/api/test/postgres-restore-pitr.test.ts"),
    "utf8"
  );

  for (const phrase of [
    "verify deleted tenants remain excluded from active service after restore",
    "real RDS backup restore drill",
    "real RDS point-in-time recovery drill"
  ]) {
    assert(source.includes(phrase), `Restore/PITR source missing ${phrase}`);
  }
  for (const phrase of [
    "creates backup restore validation plans",
    "creates point-in-time recovery validation plans",
    "rejects invalid restore evidence"
  ]) {
    assert(tests.includes(phrase), `Restore/PITR tests missing ${phrase}`);
  }

  const schemaSql = ddl.createPostgresSchemaSql(api.cloudPersistenceSchema);
  const schemaSqlSha256 = sha256(schemaSql);
  const migrationLedger = api.createCurrentCloudSchemaMigrations();
  const backupPlan = api.createPostgresRestorePitrPlan({
    mode: "backup-restore",
    sourceEnvironment: "production",
    isolatedTargetEnvironment: "restore-drill-2026-06-22",
    requestedAt: "2026-06-22T12:00:00.000Z",
    recoverySourceAt: "2026-06-22T00:00:00.000Z",
    restoreStartedAt: "2026-06-22T12:15:00.000Z",
    restoreCompletedAt: "2026-06-22T13:00:00.000Z",
    validationCompletedAt: "2026-06-22T14:00:00.000Z",
    schemaSqlSha256,
    migrationLedger
  });
  const pitrPlan = api.createPostgresRestorePitrPlan({
    mode: "point-in-time-recovery",
    sourceEnvironment: "production",
    isolatedTargetEnvironment: "pitr-drill-2026-06-22",
    requestedAt: "2026-06-22T12:00:00.000Z",
    recoverySourceAt: "2026-06-22T11:55:00.000Z",
    restoreStartedAt: "2026-06-22T12:05:00.000Z",
    restoreCompletedAt: "2026-06-22T13:05:00.000Z",
    validationCompletedAt: "2026-06-22T14:30:00.000Z",
    schemaSqlSha256,
    migrationLedger
  });

  assert(
    backupPlan.rpoWithinTarget,
    "Backup restore RPO must be within target"
  );
  assert(
    backupPlan.rtoWithinTarget,
    "Backup restore RTO must be within target"
  );
  assert(pitrPlan.rpoWithinTarget, "PITR RPO must be within target");
  assert(pitrPlan.rtoWithinTarget, "PITR RTO must be within target");
  assert(
    backupPlan.validationSteps.length >= 7,
    "Backup restore plan must include validation steps"
  );
  assert(
    pitrPlan.validationSteps.length >= 7,
    "PITR plan must include validation steps"
  );

  const report = {
    schemaVersion: 1,
    generatedBy: "searchlint-db-restore-pitr-verifier",
    generatedAt,
    status: "passed",
    methodology: {
      liveDatabaseAccess: "not used by verifier",
      scope:
        "local PostgreSQL restore and point-in-time recovery validation-plan contract",
      tests: [
        "services/api/test/postgres-restore-pitr.test.ts",
        "services/api/test/postgres-migrations.test.ts"
      ]
    },
    schema: {
      tableCount: api.cloudPersistenceSchema.length,
      schemaSqlSha256
    },
    migrationLedger: migrationLedger.map((entry, index) => ({
      order: index + 1,
      id: entry.id,
      checksum: entry.checksum
    })),
    restorePlans: [summarizePlan(backupPlan), summarizePlan(pitrPlan)],
    acceptance: {
      localRestoreContract: "passed",
      localPointInTimeRecoveryContract: "passed",
      rpoTargetHours: backupPlan.rpoTargetHours,
      rtoTargetHours: backupPlan.rtoTargetHours
    },
    remainingGates: [
      "real AWS RDS deployment",
      "real RDS backup restore drill",
      "real RDS point-in-time recovery drill",
      "restored database tenant/RBAC validation against deployed infrastructure",
      "recorded production RPO/RTO evidence"
    ]
  };

  await mkdir(path.dirname(reportPath), { recursive: true });
  await mkdir(path.dirname(samplePath), { recursive: true });
  await writeJson(reportPath, report);
  await writeJson(samplePath, report);

  console.log(
    `DB restore/PITR contract PASS: plans=${report.restorePlans.length}, schema=${schemaSqlSha256}`
  );
  console.log(`Report: ${path.relative(repoRoot, reportPath)}`);
  console.log(`Sample: ${path.relative(repoRoot, samplePath)}`);
}

function summarizePlan(plan) {
  return {
    mode: plan.mode,
    sourceEnvironment: plan.sourceEnvironment,
    isolatedTargetEnvironment: plan.isolatedTargetEnvironment,
    recoverySourceAt: plan.recoverySourceAt,
    rpoHours: plan.rpoHours,
    rtoHours: plan.rtoHours,
    rpoWithinTarget: plan.rpoWithinTarget,
    rtoWithinTarget: plan.rtoWithinTarget,
    validationSteps: plan.validationSteps,
    remainingLiveEvidence: plan.remainingLiveEvidence
  };
}

async function writeJson(filePath, data) {
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
