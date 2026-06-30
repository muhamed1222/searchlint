import { describe, expect, it } from "vitest";

import {
  CloudApiError,
  createCloudApi,
  createPgCloudTransactionManager,
  createPgPoolFromEnv,
  createPgQueryExecutor,
  createPostgresAuditLog,
  createPostgresMetricsStore,
  createPostgresRelationalStore,
  roleHasPermission,
  runPostgresMigrations
} from "../src/index.js";
import type {
  CloudApiDependencies,
  CloudPermission,
  CloudTransactionManager,
  JobQueue,
  OrganizationRole,
  Principal
} from "../src/index.js";

const integrationDatabaseUrl =
  process.env.SEARCHLINT_POSTGRES_TEST_DATABASE_URL;
const runIntegration = integrationDatabaseUrl ? describe : describe.skip;
const allRoles: readonly OrganizationRole[] = [
  "owner",
  "admin",
  "developer",
  "analyst",
  "client"
];

runIntegration("PostgreSQL integration", () => {
  it("applies current migrations against a real PostgreSQL database", async () => {
    const pool = createPgPoolFromEnv(
      {
        TEST_DATABASE_URL: integrationDatabaseUrl,
        TEST_POOL_MAX: "1",
        TEST_CONNECTION_TIMEOUT_MS: "5000",
        TEST_SSL_MODE: process.env.SEARCHLINT_POSTGRES_TEST_SSL_MODE
      },
      {
        prefix: "TEST"
      }
    );

    try {
      await pool.query(
        'DROP SCHEMA IF EXISTS "searchlint_integration" CASCADE;'
      );
      await pool.query('CREATE SCHEMA "searchlint_integration";');
      await pool.query('SET search_path TO "searchlint_integration";');

      const first = await runPostgresMigrations({
        pool,
        appliedAt: "2026-06-21T00:00:00.000Z"
      });
      const second = await runPostgresMigrations({
        pool,
        appliedAt: "2026-06-21T00:00:01.000Z"
      });
      const ledger = await pool.query(
        'SELECT "id" FROM "searchlint_schema_migrations" ORDER BY "id" ASC;'
      );

      expect(first).toEqual({
        applied: [
          "cloud-persistence-schema-v1",
          "cloud-crawl-execution-metadata-v1"
        ],
        skipped: []
      });
      expect(second).toEqual({
        applied: [],
        skipped: [
          "cloud-persistence-schema-v1",
          "cloud-crawl-execution-metadata-v1"
        ]
      });
      expect(ledger.rows).toEqual([
        {
          id: "cloud-crawl-execution-metadata-v1"
        },
        {
          id: "cloud-persistence-schema-v1"
        }
      ]);
    } finally {
      await pool.query(
        'DROP SCHEMA IF EXISTS "searchlint_integration" CASCADE;'
      );
      await pool.end();
    }
  });

  it("enforces the current authorization matrix through PostgreSQL-backed ports", async () => {
    const pool = createPgPoolFromEnv(
      {
        TEST_DATABASE_URL: integrationDatabaseUrl,
        TEST_POOL_MAX: "1",
        TEST_CONNECTION_TIMEOUT_MS: "5000",
        TEST_SSL_MODE: process.env.SEARCHLINT_POSTGRES_TEST_SSL_MODE
      },
      {
        prefix: "TEST"
      }
    );

    try {
      await resetPostgresSchema(pool, "searchlint_auth_matrix");
      await runPostgresMigrations({
        pool,
        appliedAt: "2026-06-21T00:00:00.000Z"
      });

      for (const authorizationCase of authorizationMatrix()) {
        const context = await createAuthorizationContext(
          postgresHarness(pool),
          authorizationCase.role,
          authorizationCase.operation
        );

        await expect(authorizationCase.execute(context)).resolves.toBeDefined();
      }

      for (const authorizationCase of forbiddenAuthorizationMatrix()) {
        const harness = postgresHarness(pool);
        const context = await createAuthorizationContext(
          harness,
          authorizationCase.role,
          authorizationCase.operation
        );
        const before = await sideEffectSnapshot(pool);
        const rejected = authorizationCase.execute(context);

        await expect(rejected).rejects.toMatchObject({
          code: "FORBIDDEN"
        });
        await expect(rejected).rejects.toBeInstanceOf(CloudApiError);
        await expect(sideEffectSnapshot(pool)).resolves.toEqual(before);
      }
    } finally {
      await pool.query(
        'DROP SCHEMA IF EXISTS "searchlint_auth_matrix" CASCADE;'
      );
      await pool.end();
    }
  });
});

type PgPool = ReturnType<typeof createPgPoolFromEnv>;

type AuthorizationOperation =
  | "addMember"
  | "createProject"
  | "createEnvironment"
  | "requestCrawl";

type AuthorizationContext = {
  api: ReturnType<typeof createCloudApi>;
  actor: Principal;
  organizationId: string;
  projectId: string;
  environmentId: string;
};

type AuthorizationCase = {
  operation: AuthorizationOperation;
  permission: CloudPermission;
  role: OrganizationRole;
  execute(context: AuthorizationContext): Promise<unknown>;
};

type AuthorizationOperationCase = Omit<AuthorizationCase, "role">;

type PostgresHarness = {
  api: ReturnType<typeof createCloudApi>;
};

function authorizationMatrix(): AuthorizationCase[] {
  return operationCases().flatMap((operation) =>
    allRoles
      .filter((role) => roleHasPermission(role, operation.permission))
      .map((role) => ({
        ...operation,
        role
      }))
  );
}

function forbiddenAuthorizationMatrix(): AuthorizationCase[] {
  return operationCases().flatMap((operation) =>
    allRoles
      .filter((role) => !roleHasPermission(role, operation.permission))
      .map((role) => ({
        ...operation,
        role
      }))
  );
}

function operationCases(): AuthorizationOperationCase[] {
  return [
    {
      operation: "addMember",
      permission: "member:manage",
      async execute(context) {
        return context.api.addMember({
          actor: context.actor,
          organizationId: context.organizationId,
          principalId: `${context.actor.id}-added`,
          role: "client"
        });
      }
    },
    {
      operation: "createProject",
      permission: "project:create",
      async execute(context) {
        return context.api.createProject({
          actor: context.actor,
          organizationId: context.organizationId,
          name: `${context.actor.id} project`,
          siteUrl: `https://${context.actor.id}.example.com`
        });
      }
    },
    {
      operation: "createEnvironment",
      permission: "environment:create",
      async execute(context) {
        return context.api.createEnvironment({
          actor: context.actor,
          organizationId: context.organizationId,
          projectId: context.projectId,
          name: `${context.actor.id} environment`,
          baseUrl: `https://${context.actor.id}.example.com`
        });
      }
    },
    {
      operation: "requestCrawl",
      permission: "crawl:create",
      async execute(context) {
        return context.api.requestCrawl({
          actor: context.actor,
          organizationId: context.organizationId,
          projectId: context.projectId,
          environmentId: context.environmentId,
          maxUrls: 10
        });
      }
    }
  ];
}

async function createAuthorizationContext(
  harness: PostgresHarness,
  role: OrganizationRole,
  operation: AuthorizationOperation
): Promise<AuthorizationContext> {
  const owner = principal(`owner-${role}-${operation}`);
  const actor = role === "owner" ? owner : principal(`${role}-${operation}`);
  const created = await harness.api.createOrganization({
    actor: owner,
    name: `Org ${role} ${operation}`
  });

  if (role !== "owner") {
    await harness.api.addMember({
      actor: owner,
      organizationId: created.organization.id,
      principalId: actor.id,
      role
    });
  }

  const project = await harness.api.createProject({
    actor: owner,
    organizationId: created.organization.id,
    name: `Project ${role} ${operation}`,
    siteUrl: `https://${role}-${operation}.example.com`
  });
  const environment = await harness.api.createEnvironment({
    actor: owner,
    organizationId: created.organization.id,
    projectId: project.id,
    name: `Environment ${role} ${operation}`,
    baseUrl: `https://${role}-${operation}.example.com`
  });

  return {
    api: harness.api,
    actor,
    organizationId: created.organization.id,
    projectId: project.id,
    environmentId: environment.id
  };
}

function postgresHarness(pool: PgPool): PostgresHarness {
  const executor = createPgQueryExecutor(pool);
  const queued: unknown[] = [];
  const transactionManager: CloudTransactionManager =
    createPgCloudTransactionManager({
      pool,
      outbox: true
    });
  const queue: JobQueue = {
    async enqueueCrawl(payload) {
      queued.push(payload);
      return {
        jobId: `queue-${queued.length}`
      };
    }
  };
  const dependencies: CloudApiDependencies = {
    store: createPostgresRelationalStore(executor),
    auditLog: createPostgresAuditLog(executor),
    metrics: createPostgresMetricsStore(executor),
    entitlements: {
      async canStartCrawl() {
        return {
          allowed: true
        };
      },
      async canUseExternalApiInspection() {
        return {
          allowed: true
        };
      }
    },
    queue,
    transactionManager,
    clock: {
      now() {
        return "2026-06-21T00:00:00.000Z";
      }
    },
    ids: deterministicIds()
  };

  return {
    api: createCloudApi(dependencies)
  };
}

function deterministicIds(): CloudApiDependencies["ids"] {
  return {
    nextId(prefix) {
      nextPostgresId += 1;
      return `${prefix}-${nextPostgresId}`;
    }
  };
}

let nextPostgresId = 0;

function principal(id: string): Principal {
  return {
    id,
    externalSubject: `sub:${id}`,
    email: `${id}@example.com`
  };
}

async function resetPostgresSchema(
  pool: PgPool,
  schema: string
): Promise<void> {
  await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE;`);
  await pool.query(`CREATE SCHEMA "${schema}";`);
  await pool.query(`SET search_path TO "${schema}";`);
}

async function sideEffectSnapshot(
  pool: PgPool
): Promise<Readonly<Record<string, number>>> {
  const tables = [
    "audit_events",
    "metric_events",
    "outbox_events",
    "organization_memberships",
    "projects",
    "environments",
    "crawl_requests"
  ] as const;
  const entries = await Promise.all(
    tables.map(async (table) => [table, await tableCount(pool, table)] as const)
  );
  return Object.fromEntries(entries);
}

async function tableCount(pool: PgPool, table: string): Promise<number> {
  const result = await pool.query<{ count: string }>(
    `SELECT COUNT(*) AS "count" FROM "${table}";`
  );
  return Number(result.rows[0]?.count ?? 0);
}
