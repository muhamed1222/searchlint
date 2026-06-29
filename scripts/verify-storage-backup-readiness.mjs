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
const reportPath = path.join(
  repoRoot,
  "reports/storage-backup-readiness-report.json"
);
const samplePath = path.join(
  repoRoot,
  "docs/examples/storage-backup-readiness-report.sample.json"
);
const fixedGeneratedAt = "2026-06-22T00:00:00.000Z";

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

function caseResult(id, status, evidence, notes = []) {
  return { id, status, evidence, notes };
}

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(repoRoot, relativePath), "utf8"));
}

async function main() {
  run("pnpm", ["build"], { stdio: "inherit" });

  const schemaModule =
    await import("../services/api/dist/src/schema-contracts.js");
  const ddlModule = await import("../services/api/dist/src/postgres-ddl.js");
  const migrationsModule =
    await import("../services/api/dist/src/postgres-migrations.js");

  const schema = schemaModule.cloudPersistenceSchema;
  const issues = ddlModule.validatePersistenceSchema(schema);
  assert(issues.length === 0, "Persistence schema must validate");
  const tenantScoped = schema.filter((table) => table.tenantScoped);
  assert(tenantScoped.length > 0, "Schema must contain tenant-scoped tables");
  for (const table of schema) {
    const columns = new Set(table.columns.map((column) => column.name));
    assert(
      columns.has("schema_version"),
      `${table.name} missing schema_version`
    );
    assert(
      columns.has("retention_until"),
      `${table.name} missing retention_until`
    );
    assert(
      columns.has("deletion_state"),
      `${table.name} missing deletion_state`
    );
    if (table.tenantScoped) {
      assert(
        columns.has("organization_id"),
        `${table.name} missing organization_id`
      );
      assert(
        table.indexes.some((index) =>
          index.columns.includes("organization_id")
        ),
        `${table.name} must have at least one organization_id index`
      );
    }
  }
  const schemaSql = ddlModule.createPostgresSchemaSql(schema);
  const schemaHash = sha256(schemaSql);
  const cases = [
    caseResult("postgres-schema-contracts", "PASS", {
      tableCount: schema.length,
      tenantScopedTableCount: tenantScoped.length,
      retentionClasses: [
        ...new Set(schema.map((table) => table.retentionClass))
      ].sort(),
      schemaSqlSha256: schemaHash
    })
  ];

  const migrations = migrationsModule.createCurrentCloudSchemaMigrations();
  assert(
    migrations.length >= 2,
    "Current cloud schema migrations must be present"
  );
  for (const migration of migrations) {
    assert(migration.id, "Migration id is required");
    assert(
      /^[a-f0-9]{64}$/u.test(migration.checksum),
      "Migration checksum must be sha256"
    );
    assert(
      migration.statements.length > 0,
      "Migration must include SQL statements"
    );
  }
  cases.push(
    caseResult("postgres-migrations", "PASS", {
      migrationIds: migrations.map((migration) => migration.id),
      checksums: Object.fromEntries(
        migrations.map((migration) => [migration.id, migration.checksum])
      ),
      statementCounts: Object.fromEntries(
        migrations.map((migration) => [
          migration.id,
          migration.statements.length
        ])
      )
    })
  );

  const rds = await readJson("infra/aws/rds-postgres.cloudformation.json");
  const rdsResources = rds.Resources ?? {};
  const instance = requiredResource(
    rdsResources,
    "PostgresInstance",
    "AWS::RDS::DBInstance"
  ).Properties;
  assert(instance.Engine === "postgres", "RDS engine must be postgres");
  assert(instance.PubliclyAccessible === false, "RDS must not be public");
  assert(instance.StorageEncrypted === true, "RDS storage must be encrypted");
  assert(instance.StorageType === "gp3", "RDS storage type must be gp3");
  assert(
    JSON.stringify(instance.BackupRetentionPeriod).includes(
      "BackupRetentionDays"
    ),
    "RDS backup retention must be parameterized"
  );
  assert(
    JSON.stringify(instance.DeletionProtection).includes(
      "EnableDeletionProtection"
    ),
    "RDS deletion protection must be controlled by condition"
  );
  const rdsParams = rds.Parameters ?? {};
  assert(
    rdsParams.BackupRetentionDays?.MinValue >= 1,
    "RDS backup retention must enable PITR-compatible backups"
  );
  requiredResource(
    rdsResources,
    "PostgresDatabaseUrlSecret",
    "AWS::SecretsManager::Secret"
  );
  requiredResource(
    rdsResources,
    "PostgresSecurityGroup",
    "AWS::EC2::SecurityGroup"
  );
  cases.push(
    caseResult("rds-backup-readiness-iac", "PASS", {
      engine: instance.Engine,
      publiclyAccessible: instance.PubliclyAccessible,
      storageEncrypted: instance.StorageEncrypted,
      storageType: instance.StorageType,
      backupRetentionDefaultDays: rdsParams.BackupRetentionDays?.Default,
      backupRetentionMaxDays: rdsParams.BackupRetentionDays?.MaxValue,
      deletionProtectionDefault: rdsParams.DeletionProtection?.Default
    })
  );

  const s3 = await readJson(
    "infra/aws/artifact-storage-s3.cloudformation.json"
  );
  const s3Resources = s3.Resources ?? {};
  const crawlBucket = requiredResource(
    s3Resources,
    "CrawlArtifactBucket",
    "AWS::S3::Bucket"
  ).Properties;
  const reportBucket = requiredResource(
    s3Resources,
    "ReportArtifactBucket",
    "AWS::S3::Bucket"
  ).Properties;
  for (const [name, bucket] of [
    ["crawl", crawlBucket],
    ["report", reportBucket]
  ]) {
    assert(
      bucket.PublicAccessBlockConfiguration?.BlockPublicPolicy === true,
      `${name} bucket must block public policy`
    );
    assert(
      bucket.VersioningConfiguration?.Status === "Enabled",
      `${name} bucket must enable versioning`
    );
    assert(
      bucket.BucketEncryption?.ServerSideEncryptionConfiguration?.length > 0,
      `${name} bucket must configure encryption`
    );
    assert(
      bucket.LifecycleConfiguration?.Rules?.some(
        (rule) => rule.AbortIncompleteMultipartUpload?.DaysAfterInitiation === 7
      ),
      `${name} bucket must abort incomplete multipart uploads`
    );
  }
  assert(
    crawlBucket.LifecycleConfiguration?.Rules?.some(
      (rule) => rule.ExpirationInDays?.Ref === "CrawlArtifactExpirationDays"
    ),
    "Crawl bucket must expire raw crawl artifacts"
  );
  assertHasTlsOnlyPolicy(s3Resources, "CrawlArtifactBucketPolicy");
  assertHasTlsOnlyPolicy(s3Resources, "ReportArtifactBucketPolicy");
  cases.push(
    caseResult("s3-artifact-storage-readiness-iac", "PASS", {
      crawlBucketVersioning: crawlBucket.VersioningConfiguration?.Status,
      reportBucketVersioning: reportBucket.VersioningConfiguration?.Status,
      crawlLifecycleRules:
        crawlBucket.LifecycleConfiguration?.Rules?.length ?? 0,
      reportLifecycleRules:
        reportBucket.LifecycleConfiguration?.Rules?.length ?? 0,
      tlsOnlyPolicies: [
        "CrawlArtifactBucketPolicy",
        "ReportArtifactBucketPolicy"
      ]
    })
  );

  const docs = await readFile(
    path.join(repoRoot, "docs/DATABASE_STORAGE_BACKUP_RESTORE.md"),
    "utf8"
  );
  const normalizedDocs = docs.toLowerCase();
  for (const phrase of [
    "RPO",
    "RTO",
    "point-in-time recovery",
    "restore drill",
    "retention",
    "deletion",
    "real deployment gate"
  ]) {
    assert(
      normalizedDocs.includes(phrase.toLowerCase()),
      `Database storage doc must include ${phrase}`
    );
  }
  cases.push(
    caseResult("backup-restore-documentation", "PASS", {
      document: "docs/DATABASE_STORAGE_BACKUP_RESTORE.md",
      rpo: "24 hours maximum for 1.0 baseline until production SLO is tightened",
      rto: "4 hours maximum for 1.0 baseline until production SLO is tightened",
      realDeploymentGate: true
    })
  );

  const report = {
    schemaVersion: 1,
    summary: {
      status: "PASS",
      generatedAt: fixedGeneratedAt,
      nodeVersion: process.version,
      caseCount: cases.length,
      passed: cases.length,
      failed: 0
    },
    cases,
    limitations: [
      "This verifier checks deterministic schema, migration, RDS IaC, S3 IaC, and backup/restore documentation contracts.",
      "It does not deploy AWS resources, run migrations against RDS, perform backup restore, perform PITR, or upload/download S3 artifacts.",
      "`pnpm verify:postgres` remains the real PostgreSQL execution proof and requires Docker or SEARCHLINT_POSTGRES_TEST_DATABASE_URL."
    ]
  };

  await mkdir(path.dirname(reportPath), { recursive: true });
  await mkdir(path.dirname(samplePath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(samplePath, `${JSON.stringify(report, null, 2)}\n`);

  console.log(
    `Storage backup readiness ${report.summary.status}: ${report.summary.passed}/${report.summary.caseCount} cases passed`
  );
  console.log(`Report: ${path.relative(repoRoot, reportPath)}`);
  console.log(`Sample: ${path.relative(repoRoot, samplePath)}`);
}

function requiredResource(resources, name, type) {
  const resource = resources[name];
  assert(resource, `${name} must exist`);
  assert(resource.Type === type, `${name} must be ${type}`);
  return resource;
}

function assertHasTlsOnlyPolicy(resources, name) {
  const policy = requiredResource(resources, name, "AWS::S3::BucketPolicy");
  const statements = policy.Properties?.PolicyDocument?.Statement ?? [];
  assert(
    statements.some(
      (statement) =>
        statement.Effect === "Deny" &&
        JSON.stringify(statement.Condition).includes("aws:SecureTransport")
    ),
    `${name} must deny insecure transport`
  );
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
