#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const reportPath = path.join(
  repoRoot,
  "reports/backend-api-postgresql-integration-report.json"
);
const samplePath = path.join(
  repoRoot,
  "docs/examples/backend-api-postgresql-integration-report.sample.json"
);
const generatedAt = "2026-06-23T00:00:00.000Z";

const providedDatabaseUrl =
  process.env.SEARCHLINT_POSTGRES_TEST_DATABASE_URL?.trim();

const dockerImage =
  process.env.SEARCHLINT_POSTGRES_DOCKER_IMAGE?.trim() || "postgres:16-alpine";
const dockerUser = "searchlint";
const dockerPassword = "searchlint";
const dockerDatabase = "searchlint";
const containerName = `searchlint-postgres-${process.pid}-${Date.now()}`;

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

async function main() {
  if (providedDatabaseUrl) {
    console.log("Using provided PostgreSQL test database URL.");
    runIntegration(providedDatabaseUrl);
    await writeReport("provided-database-url");
    return;
  }

  if (!dockerAvailable()) {
    await runLocalPostgresBinaries();
    return;
  }

  let containerStarted = false;
  try {
    console.log(`Starting temporary PostgreSQL container ${containerName}.`);
    run("docker", [
      "run",
      "--detach",
      "--rm",
      "--name",
      containerName,
      "--env",
      `POSTGRES_USER=${dockerUser}`,
      "--env",
      `POSTGRES_PASSWORD=${dockerPassword}`,
      "--env",
      `POSTGRES_DB=${dockerDatabase}`,
      "--publish",
      "127.0.0.1::5432",
      dockerImage
    ]);
    containerStarted = true;

    waitForContainerPostgres();
    const port = mappedPostgresPort();
    const databaseUrl = `postgres://${dockerUser}:${dockerPassword}@127.0.0.1:${port}/${dockerDatabase}`;
    runIntegration(databaseUrl);
    await writeReport("temporary-docker-postgres");
  } finally {
    if (containerStarted) {
      console.log(`Stopping temporary PostgreSQL container ${containerName}.`);
      spawnSync("docker", ["rm", "--force", containerName], {
        stdio: "ignore"
      });
    }
  }
}

async function runLocalPostgresBinaries() {
  assertCommandAvailable("initdb");
  assertCommandAvailable("pg_ctl");
  assertCommandAvailable("createdb");

  const dataDirectory = await mkdtemp(
    path.join(tmpdir(), "searchlint-postgres-")
  );
  const port = String(20_000 + (process.pid % 20_000));
  let started = false;

  try {
    console.log("Starting temporary local PostgreSQL cluster.");
    run("initdb", [
      "--pgdata",
      dataDirectory,
      "--username",
      dockerUser,
      "--auth",
      "trust",
      "--no-locale"
    ]);
    runQuiet("pg_ctl", [
      "--pgdata",
      dataDirectory,
      "--options",
      `-F -p ${port} -c listen_addresses=127.0.0.1`,
      "--wait",
      "start"
    ]);
    started = true;
    run("createdb", [
      "--host",
      "127.0.0.1",
      "--port",
      port,
      "--username",
      dockerUser,
      dockerDatabase
    ]);

    const databaseUrl = `postgres://${dockerUser}@127.0.0.1:${port}/${dockerDatabase}`;
    runIntegration(databaseUrl);
    await writeReport("temporary-local-postgres-binaries");
  } finally {
    if (started) {
      console.log("Stopping temporary local PostgreSQL cluster.");
      spawnSync("pg_ctl", ["--pgdata", dataDirectory, "--wait", "stop"], {
        stdio: "ignore"
      });
    }
    await rm(dataDirectory, { recursive: true, force: true });
  }
}

async function writeReport(mode) {
  const report = {
    schemaVersion: 1,
    generatedBy: "searchlint-backend-api-postgresql-integration-verifier",
    generatedAt,
    status: "passed",
    execution: {
      mode,
      dockerImage: mode === "temporary-docker-postgres" ? dockerImage : null,
      localPostgresBinaries:
        mode === "temporary-local-postgres-binaries"
          ? ["initdb", "pg_ctl", "createdb"]
          : [],
      databaseUrlRedacted: true,
      testFile: "services/api/test/postgres-integration.test.ts",
      command:
        "pnpm --filter @searchlint/api exec vitest run test/postgres-integration.test.ts"
    },
    coverage: {
      realPostgresDatabase: true,
      currentMigrationsApply: true,
      migrationReplayIsIdempotent: true,
      apiUsesPostgresBackedPorts: true,
      authorizationMatrixCovered: true,
      forbiddenRbacCasesRejectWithoutSideEffects: true
    },
    assertions: [
      {
        id: "postgres-migrations-apply",
        status: "passed",
        evidence:
          "Integration test applies current migrations against a real PostgreSQL schema."
      },
      {
        id: "postgres-migrations-idempotent",
        status: "passed",
        evidence:
          "Integration test reruns migrations and verifies all current migration IDs are skipped."
      },
      {
        id: "api-postgres-backed-ports",
        status: "passed",
        evidence:
          "Integration test constructs Cloud API dependencies from PostgreSQL relational, audit, metrics, transaction, and outbox ports."
      },
      {
        id: "api-rbac-authorization-matrix",
        status: "passed",
        evidence:
          "Integration test executes allowed member, project, environment, and crawl operations for every role with permission."
      },
      {
        id: "api-rbac-forbidden-side-effects",
        status: "passed",
        evidence:
          "Integration test snapshots PostgreSQL table counts and verifies forbidden operations do not mutate side-effect tables."
      }
    ],
    releaseGates: {
      backendApiPostgresqlIntegration: "passed",
      productionApiDeployment: "not_claimed",
      productionRdsDeployment: "not_claimed",
      productionMigrationRun: "not_claimed"
    }
  };

  assertNoSensitiveValues(JSON.stringify(report));
  await writeJson(reportPath, report);
  await writeJson(samplePath, report);
  console.log("Backend API PostgreSQL integration PASS.");
  console.log(`Report: ${path.relative(repoRoot, reportPath)}`);
  console.log(`Sample: ${path.relative(repoRoot, samplePath)}`);
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function assertNoSensitiveValues(text) {
  const forbidden = [
    /postgres:\/\/(?!\[REDACTED\])/i,
    /postgresql:\/\/(?!\[REDACTED\])/i,
    /password=/i,
    /private_key/i,
    /client-secret/i,
    /authorization:/i,
    /bearer\s+/i,
    /cookie:/i,
    /set-cookie:/i,
    /sk_live/i,
    /whsec_/i,
    /-----BEGIN PRIVATE KEY-----/i
  ];
  const match = forbidden.find((pattern) => pattern.test(text));
  if (match) {
    throw new Error(
      `Sensitive value leaked into PostgreSQL integration evidence: ${match}`
    );
  }
}

function dockerAvailable() {
  const dockerVersion = spawnSync("docker", ["--version"], {
    encoding: "utf8"
  });
  if (dockerVersion.status !== 0) {
    return false;
  }

  const dockerInfo = spawnSync("docker", ["info"], {
    encoding: "utf8",
    stdio: "pipe"
  });
  if (dockerInfo.status !== 0) {
    return false;
  }
  return true;
}

function assertCommandAvailable(command) {
  const result = spawnSync(command, ["--version"], {
    encoding: "utf8"
  });
  if (result.status !== 0) {
    throw new Error(
      `${command} is required when Docker and SEARCHLINT_POSTGRES_TEST_DATABASE_URL are unavailable.`
    );
  }
}

function waitForContainerPostgres() {
  const startedAt = Date.now();
  const timeoutMs = 30_000;

  while (Date.now() - startedAt < timeoutMs) {
    const ready = spawnSync(
      "docker",
      [
        "exec",
        containerName,
        "pg_isready",
        "--username",
        dockerUser,
        "--dbname",
        dockerDatabase
      ],
      {
        encoding: "utf8",
        stdio: "ignore"
      }
    );
    if (ready.status === 0) {
      return;
    }
    sleep(500);
  }

  throw new Error("Timed out waiting for PostgreSQL container readiness.");
}

function mappedPostgresPort() {
  const output = run("docker", ["port", containerName, "5432/tcp"]);
  const line = output.trim().split("\n").at(0);
  const port = line?.split(":").at(-1);
  if (!port || !/^\d+$/.test(port)) {
    throw new Error("Could not determine mapped PostgreSQL port.");
  }
  return port;
}

function runIntegration(databaseUrl) {
  console.log("Running PostgreSQL migration integration proof.");
  const result = spawnSync(
    pnpmCommand(),
    [
      "--filter",
      "@searchlint/api",
      "exec",
      "vitest",
      "run",
      "test/postgres-integration.test.ts"
    ],
    {
      env: {
        ...process.env,
        SEARCHLINT_POSTGRES_TEST_DATABASE_URL: databaseUrl,
        SEARCHLINT_POSTGRES_TEST_SSL_MODE:
          process.env.SEARCHLINT_POSTGRES_TEST_SSL_MODE ?? "disable"
      },
      stdio: "inherit"
    }
  );

  if (result.status !== 0) {
    throw new Error("PostgreSQL migration integration proof failed.");
  }
}

function run(command, args) {
  return execFileSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"]
  });
}

function runQuiet(command, args) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: "ignore"
  });
  if (result.status !== 0) {
    throw new Error(`${command} failed with exit code ${result.status}.`);
  }
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function pnpmCommand() {
  return process.platform === "win32" ? "pnpm.cmd" : "pnpm";
}
