import { describe, expect, it } from "vitest";

import {
  cloudApiDeploymentContract,
  cloudApiRateLimitProvisioningContract,
  cloudHttpRouteContracts,
  cloudPersistenceSchema,
  persistenceColumnNames,
  persistenceTable,
  routeContractForOperation,
  validateCloudApiDeploymentContract,
  validateCloudApiRateLimitProvisioningContract
} from "../src/index.js";

describe("cloudHttpRouteContracts", () => {
  it("declares stable v1 contracts for current application service operations", () => {
    expect(
      cloudHttpRouteContracts.map((contract) => contract.operation)
    ).toEqual([
      "createOrganization",
      "addMember",
      "createProject",
      "createEnvironment",
      "getDashboardSnapshot",
      "requestCrawl",
      "startExternalProviderOAuthConnection",
      "completeExternalProviderOAuthConnection",
      "acceptStripeWebhook"
    ]);

    for (const contract of cloudHttpRouteContracts) {
      expect(contract.apiVersion).toBe("v1");
      expect(contract.path).toMatch(/^\/v1\//);
      expect(contract.stability).toBe("stable");
      expect(contract.requestSchemaVersion).toMatch(/\.v1$/);
      expect(contract.responseSchemaVersion).toMatch(/\.v1$/);
    }
  });

  it("maps permissioned operations to the RBAC permission they require", () => {
    expect(
      routeContractForOperation("createOrganization").permission
    ).toBeUndefined();
    expect(routeContractForOperation("addMember").permission).toBe(
      "member:manage"
    );
    expect(routeContractForOperation("createProject").permission).toBe(
      "project:create"
    );
    expect(routeContractForOperation("createEnvironment").permission).toBe(
      "environment:create"
    );
    expect(routeContractForOperation("getDashboardSnapshot")).toMatchObject({
      method: "GET",
      path: "/v1/organizations/{organizationId}/projects/{projectId}/environments/{environmentId}/dashboard-snapshot",
      permission: "project:read",
      requestSchemaVersion: "cloud.getDashboardSnapshot.v1",
      responseSchemaVersion: "cloud.dashboardSnapshot.v1"
    });
    expect(routeContractForOperation("requestCrawl").permission).toBe(
      "crawl:create"
    );
    expect(
      routeContractForOperation("startExternalProviderOAuthConnection")
    ).toMatchObject({
      method: "POST",
      path: "/v1/organizations/{organizationId}/projects/{projectId}/environments/{environmentId}/external-providers/{provider}/oauth/start",
      permission: "connector:manage",
      requestSchemaVersion: "cloud.startExternalProviderOAuthConnection.v1",
      responseSchemaVersion: "cloud.externalProviderOAuthAuthorization.v1"
    });
    expect(
      routeContractForOperation("completeExternalProviderOAuthConnection")
    ).toMatchObject({
      method: "POST",
      path: "/v1/organizations/{organizationId}/projects/{projectId}/environments/{environmentId}/external-providers/{provider}/oauth/callback",
      permission: "connector:manage",
      requestSchemaVersion: "cloud.completeExternalProviderOAuthConnection.v1",
      responseSchemaVersion: "cloud.oauthConnection.v1"
    });
    expect(
      routeContractForOperation("acceptStripeWebhook").permission
    ).toBeUndefined();
  });
});

describe("cloudApiDeploymentContract", () => {
  it("defines the approved API Gateway and ECS/Fargate runtime target", () => {
    expect(
      validateCloudApiDeploymentContract(cloudApiDeploymentContract)
    ).toEqual([]);
    expect(cloudApiDeploymentContract.ingress.kind).toBe(
      "aws-api-gateway-http-api"
    );
    expect(cloudApiDeploymentContract.runtime.compute).toBe("aws-ecs-fargate");
    expect(cloudApiDeploymentContract.runtime.nodeMajor).toBe(24);
    expect(cloudApiDeploymentContract.runtime.serverAdapter).toBe("node:http");
    expect(cloudApiDeploymentContract.runtime.healthCheckPath).toBe("/healthz");
    expect(cloudApiDeploymentContract.runtime.shutdownSignals).toEqual([
      "SIGTERM",
      "SIGINT"
    ]);
    expect(cloudApiDeploymentContract.rateLimit).toEqual({
      store: "postgres",
      distributedStoreFactory: "createPostgresDistributedRateLimitStore",
      modeEnv: "SEARCHLINT_API_RATE_LIMIT_STORE",
      windowMsEnv: "SEARCHLINT_API_RATE_LIMIT_WINDOW_MS",
      maxRequestsEnv: "SEARCHLINT_API_RATE_LIMIT_MAX_REQUESTS",
      failClosed: true
    });
    expect(cloudApiDeploymentContract.ingress.routes).toEqual(
      cloudHttpRouteContracts.map((contract) => ({
        operation: contract.operation,
        method: contract.method,
        path: contract.path,
        apiVersion: contract.apiVersion,
        stability: contract.stability,
        requestSchemaVersion: contract.requestSchemaVersion,
        responseSchemaVersion: contract.responseSchemaVersion
      }))
    );
  });

  it("rejects deployment drift from current route and runtime contracts", () => {
    const issues = validateCloudApiDeploymentContract({
      ...cloudApiDeploymentContract,
      ingress: {
        ...cloudApiDeploymentContract.ingress,
        routes: [
          {
            ...cloudApiDeploymentContract.ingress.routes[0]!,
            path: "/v2/organizations"
          }
        ]
      },
      runtime: {
        ...cloudApiDeploymentContract.runtime,
        nodeMajor: 20 as 24,
        containerPort: 0,
        healthCheckPath: "/readyz" as "/healthz",
        shutdownSignals: ["SIGTERM"] as unknown as ["SIGTERM", "SIGINT"]
      },
      rateLimit: {
        ...cloudApiDeploymentContract.rateLimit,
        store: "memory" as "postgres",
        distributedStoreFactory:
          "createMemoryDistributedRateLimitStore" as "createPostgresDistributedRateLimitStore",
        failClosed: false as true
      },
      environment: {
        ...cloudApiDeploymentContract.environment,
        variables: []
      }
    });

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "runtime.nodeMajor" }),
        expect.objectContaining({ path: "runtime.healthCheckPath" }),
        expect.objectContaining({ path: "runtime.containerPort" }),
        expect.objectContaining({ path: "runtime.shutdownSignals" }),
        expect.objectContaining({ path: "rateLimit.store" }),
        expect.objectContaining({
          path: "rateLimit.distributedStoreFactory"
        }),
        expect.objectContaining({ path: "rateLimit.failClosed" }),
        expect.objectContaining({
          path: "ingress.routes.createOrganization.path"
        }),
        expect.objectContaining({ path: "environment.variables" })
      ])
    );
  });
});

describe("cloudApiRateLimitProvisioningContract", () => {
  it("declares the approved PostgreSQL-backed distributed rate-limit provisioning target", () => {
    expect(
      validateCloudApiRateLimitProvisioningContract(
        cloudApiRateLimitProvisioningContract
      )
    ).toEqual([]);
    expect(cloudApiRateLimitProvisioningContract.store).toEqual({
      provider: "aws-rds-postgresql",
      tableName: "rate_limit_windows",
      schemaVersion: "cloud.rate_limit_windows.v1",
      migrationRequired: true,
      algorithm: "fixed-window-insert-on-conflict",
      resetIndexName: "rate_limit_windows_reset_idx"
    });
    expect(cloudApiRateLimitProvisioningContract.runtime).toEqual({
      packageName: "@searchlint/api",
      storeFactory: "createPostgresDistributedRateLimitStore",
      modeEnv: "SEARCHLINT_API_RATE_LIMIT_STORE",
      modeValue: "postgres",
      windowMsEnv: "SEARCHLINT_API_RATE_LIMIT_WINDOW_MS",
      maxRequestsEnv: "SEARCHLINT_API_RATE_LIMIT_MAX_REQUESTS",
      failClosed: true
    });
  });

  it("declares required environment variables and least-privilege secret access", () => {
    expect(cloudApiRateLimitProvisioningContract.environment.variables).toEqual(
      [
        {
          name: "SEARCHLINT_API_RATE_LIMIT_STORE",
          required: true,
          secretSource: "plain-env"
        },
        {
          name: "SEARCHLINT_API_RATE_LIMIT_WINDOW_MS",
          required: true,
          secretSource: "plain-env"
        },
        {
          name: "SEARCHLINT_API_RATE_LIMIT_MAX_REQUESTS",
          required: true,
          secretSource: "plain-env"
        },
        {
          name: "SEARCHLINT_POSTGRES_DATABASE_URL",
          required: true,
          secretSource: "aws-secrets-manager"
        },
        {
          name: "SEARCHLINT_POSTGRES_SSL_MODE",
          required: true,
          secretSource: "plain-env"
        }
      ]
    );
    expect(cloudApiRateLimitProvisioningContract.iam.statements).toEqual([
      {
        principal: "cloud-api-task",
        actions: ["secretsmanager:GetSecretValue", "kms:Decrypt"],
        resources: [
          "postgresDatabaseSecretArn",
          "postgresDatabaseSecretKmsKeyArn"
        ]
      }
    ]);
  });

  it("rejects rate-limit provider, store, runtime, environment, and IAM drift", () => {
    const issues = validateCloudApiRateLimitProvisioningContract({
      ...cloudApiRateLimitProvisioningContract,
      store: {
        ...cloudApiRateLimitProvisioningContract.store,
        provider: "redis" as "aws-rds-postgresql",
        tableName: "other" as "rate_limit_windows",
        algorithm: "token-bucket" as "fixed-window-insert-on-conflict",
        migrationRequired: false as true,
        resetIndexName: "other" as "rate_limit_windows_reset_idx"
      },
      runtime: {
        ...cloudApiRateLimitProvisioningContract.runtime,
        packageName: "other" as "@searchlint/api",
        storeFactory:
          "createMemoryDistributedRateLimitStore" as "createPostgresDistributedRateLimitStore",
        modeValue: "memory" as "postgres",
        failClosed: false as true
      },
      environment: {
        variables: [
          {
            name: "SEARCHLINT_POSTGRES_DATABASE_URL",
            required: false,
            secretSource: "plain-env"
          }
        ]
      },
      iam: {
        statements: [
          {
            principal: "cloud-api-task",
            actions: ["rds-db:connect" as "secretsmanager:GetSecretValue"],
            resources: ["*" as "postgresDatabaseSecretArn"]
          }
        ]
      }
    });

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "store.provider" }),
        expect.objectContaining({ path: "store.tableName" }),
        expect.objectContaining({ path: "store.migrationRequired" }),
        expect.objectContaining({ path: "store.algorithm" }),
        expect.objectContaining({ path: "store.resetIndexName" }),
        expect.objectContaining({ path: "runtime.packageName" }),
        expect.objectContaining({ path: "runtime.storeFactory" }),
        expect.objectContaining({ path: "runtime.modeValue" }),
        expect.objectContaining({ path: "runtime.failClosed" }),
        expect.objectContaining({ path: "environment.variables" }),
        expect.objectContaining({
          path: "environment.variables.SEARCHLINT_POSTGRES_DATABASE_URL.required"
        }),
        expect.objectContaining({
          path: "environment.variables.SEARCHLINT_POSTGRES_DATABASE_URL.secretSource"
        }),
        expect.objectContaining({
          path: "iam.statements.cloud-api-task.actions"
        }),
        expect.objectContaining({
          path: "iam.statements.cloud-api-task.resources"
        })
      ])
    );
  });
});

describe("cloudPersistenceSchema", () => {
  it("defines the initial cloud tables with schema versions", () => {
    expect(cloudPersistenceSchema.map((table) => table.name)).toEqual([
      "organizations",
      "organization_memberships",
      "projects",
      "environments",
      "crawl_requests",
      "audit_events",
      "metric_events",
      "outbox_events",
      "organization_entitlements",
      "stripe_billing_identities",
      "stripe_webhook_events",
      "usage_counters",
      "billable_usage_events",
      "agency_client_workspaces",
      "agency_shared_rule_policies",
      "agency_client_projects",
      "agency_white_label_brands",
      "report_artifacts",
      "dashboard_snapshots",
      "deployment_history",
      "page_snapshot_history",
      "history_rollups",
      "diagnostics",
      "external_observations",
      "oauth_connections",
      "notification_channels",
      "notification_rules",
      "notification_delivery_attempts",
      "rate_limit_windows"
    ]);

    for (const table of cloudPersistenceSchema) {
      expect(table.schemaVersion).toMatch(/^cloud\..+\.v1$/);
      expect(persistenceColumnNames(table)).toContain("schema_version");
    }
  });

  it("keeps tenant-scoped tables organization-scoped and indexed", () => {
    const tenantTables = cloudPersistenceSchema.filter(
      (table) => table.tenantScoped
    );

    expect(tenantTables.length).toBeGreaterThan(0);
    for (const table of tenantTables) {
      expect(persistenceColumnNames(table)).toContain("organization_id");
      expect(
        table.indexes.some((index) => index.columns.includes("organization_id"))
      ).toBe(true);
    }
  });

  it("includes retention and deletion metadata for retained tables", () => {
    for (const table of cloudPersistenceSchema) {
      const columns = persistenceColumnNames(table);
      expect(columns).toContain("retention_until");
      expect(columns).toContain("deletion_state");
    }

    expect(persistenceTable("crawl_requests")?.retentionClass).toBe(
      "crawl_artifact"
    );
    expect(persistenceTable("audit_events")?.retentionClass).toBe("audit_log");
    expect(persistenceTable("metric_events")?.retentionClass).toBe(
      "metric_event"
    );
    expect(persistenceTable("outbox_events")?.retentionClass).toBe(
      "outbox_event"
    );
    expect(persistenceTable("organization_entitlements")?.retentionClass).toBe(
      "billing_record"
    );
    expect(persistenceTable("stripe_billing_identities")?.retentionClass).toBe(
      "billing_record"
    );
    expect(persistenceTable("stripe_webhook_events")?.retentionClass).toBe(
      "billing_record"
    );
    expect(persistenceTable("usage_counters")?.retentionClass).toBe(
      "billing_record"
    );
    expect(persistenceTable("billable_usage_events")?.retentionClass).toBe(
      "billing_record"
    );
    expect(persistenceTable("agency_client_workspaces")?.retentionClass).toBe(
      "diagnostic_summary"
    );
    expect(
      persistenceTable("agency_shared_rule_policies")?.retentionClass
    ).toBe("diagnostic_summary");
    expect(persistenceTable("agency_client_projects")?.retentionClass).toBe(
      "diagnostic_summary"
    );
    expect(persistenceTable("agency_white_label_brands")?.retentionClass).toBe(
      "diagnostic_summary"
    );
    expect(persistenceTable("report_artifacts")?.retentionClass).toBe(
      "report_artifact"
    );
    expect(persistenceTable("dashboard_snapshots")?.retentionClass).toBe(
      "diagnostic_summary"
    );
    expect(persistenceTable("deployment_history")?.retentionClass).toBe(
      "diagnostic_summary"
    );
    expect(persistenceTable("page_snapshot_history")?.retentionClass).toBe(
      "crawl_artifact"
    );
    expect(persistenceTable("history_rollups")?.retentionClass).toBe(
      "diagnostic_summary"
    );
    expect(persistenceTable("diagnostics")?.retentionClass).toBe(
      "diagnostic_summary"
    );
    expect(persistenceTable("oauth_connections")?.retentionClass).toBe(
      "oauth_secret"
    );
    expect(persistenceTable("rate_limit_windows")?.retentionClass).toBe(
      "rate_limit_window"
    );
  });

  it("declares billing entitlement and usage counter storage", () => {
    expect(
      persistenceTable("organization_entitlements")?.columns.map(
        (column) => column.name
      )
    ).toEqual([
      "id",
      "organization_id",
      "schema_version",
      "created_at",
      "retention_until",
      "deletion_state",
      "plan_tier",
      "status",
      "current_period_start",
      "current_period_end",
      "crawl_max_urls_per_run",
      "monthly_crawled_urls_limit",
      "external_api_monthly_limit",
      "report_retention_days",
      "source"
    ]);
    expect(persistenceTable("organization_entitlements")?.indexes).toEqual([
      {
        name: "organization_entitlements_org_status_idx",
        columns: ["organization_id", "status", "current_period_end"]
      }
    ]);
    expect(
      persistenceTable("usage_counters")?.columns.map((column) => column.name)
    ).toEqual([
      "id",
      "organization_id",
      "schema_version",
      "created_at",
      "retention_until",
      "deletion_state",
      "counter_name",
      "period_start",
      "period_end",
      "used"
    ]);
    expect(persistenceTable("usage_counters")?.indexes).toEqual([
      {
        name: "usage_counters_unique_period_idx",
        columns: ["organization_id", "counter_name", "period_start"],
        unique: true
      },
      {
        name: "usage_counters_org_period_idx",
        columns: ["organization_id", "period_end"]
      }
    ]);
    expect(
      persistenceTable("billable_usage_events")?.columns.map(
        (column) => column.name
      )
    ).toEqual([
      "id",
      "organization_id",
      "schema_version",
      "created_at",
      "retention_until",
      "deletion_state",
      "counter_name",
      "idempotency_key",
      "amount",
      "period_start",
      "period_end",
      "occurred_at",
      "source",
      "subject_type",
      "subject_id"
    ]);
    expect(persistenceTable("billable_usage_events")?.indexes).toEqual([
      {
        name: "billable_usage_events_idempotency_idx",
        columns: ["organization_id", "idempotency_key"],
        unique: true
      },
      {
        name: "billable_usage_events_org_counter_time_idx",
        columns: ["organization_id", "counter_name", "occurred_at"]
      }
    ]);
    expect(
      persistenceTable("stripe_billing_identities")?.columns.map(
        (column) => column.name
      )
    ).toEqual([
      "id",
      "organization_id",
      "schema_version",
      "created_at",
      "retention_until",
      "deletion_state",
      "stripe_customer_id",
      "stripe_subscription_id",
      "plan_tier",
      "active"
    ]);
    expect(persistenceTable("stripe_billing_identities")?.indexes).toEqual([
      {
        name: "stripe_billing_identities_customer_idx",
        columns: ["stripe_customer_id", "active"]
      },
      {
        name: "stripe_billing_identities_subscription_idx",
        columns: ["stripe_subscription_id", "active"]
      },
      {
        name: "stripe_billing_identities_org_customer_idx",
        columns: ["organization_id", "stripe_customer_id"],
        unique: true
      }
    ]);
    expect(
      persistenceTable("stripe_webhook_events")?.columns.map(
        (column) => column.name
      )
    ).toEqual([
      "id",
      "organization_id",
      "schema_version",
      "created_at",
      "retention_until",
      "deletion_state",
      "stripe_event_id",
      "stripe_event_type",
      "intent_kind",
      "processed_at"
    ]);
    expect(persistenceTable("stripe_webhook_events")?.indexes).toEqual([
      {
        name: "stripe_webhook_events_idempotency_idx",
        columns: ["organization_id", "stripe_event_id"],
        unique: true
      },
      {
        name: "stripe_webhook_events_org_time_idx",
        columns: ["organization_id", "processed_at"]
      }
    ]);
  });

  it("declares fixed-window rate limit storage", () => {
    const columns = persistenceTable("rate_limit_windows")?.columns ?? [];
    expect(columns.map((column) => column.name)).toEqual([
      "key",
      "schema_version",
      "created_at",
      "updated_at",
      "retention_until",
      "deletion_state",
      "window_started_at",
      "reset_at",
      "window_ms",
      "limit_count",
      "consumed_count"
    ]);
    expect(persistenceTable("rate_limit_windows")?.indexes).toEqual([
      {
        name: "rate_limit_windows_reset_idx",
        columns: ["reset_at"]
      },
      {
        name: "rate_limit_windows_deletion_state_idx",
        columns: ["deletion_state"]
      }
    ]);
  });

  it("declares agency client workspace production persistence", () => {
    expect(
      persistenceTable("agency_client_workspaces")?.columns.map(
        (column) => column.name
      )
    ).toEqual([
      "id",
      "organization_id",
      "schema_version",
      "created_at",
      "retention_until",
      "deletion_state",
      "client_name",
      "status",
      "owner_principal_id"
    ]);
    expect(persistenceTable("agency_client_workspaces")?.indexes).toEqual([
      {
        name: "agency_client_workspaces_org_status_idx",
        columns: ["organization_id", "status", "client_name"]
      }
    ]);
    expect(
      persistenceTable("agency_shared_rule_policies")?.columns.map(
        (column) => column.name
      )
    ).toEqual([
      "id",
      "organization_id",
      "schema_version",
      "created_at",
      "retention_until",
      "deletion_state",
      "name",
      "rule_ids",
      "severity_overrides"
    ]);
    expect(persistenceTable("agency_shared_rule_policies")?.indexes).toEqual([
      {
        name: "agency_shared_rule_policies_org_name_idx",
        columns: ["organization_id", "name"]
      }
    ]);
    expect(
      persistenceTable("agency_client_projects")?.columns.map(
        (column) => column.name
      )
    ).toEqual([
      "id",
      "organization_id",
      "schema_version",
      "created_at",
      "retention_until",
      "deletion_state",
      "workspace_id",
      "project_id",
      "environment_id",
      "display_name",
      "site_url",
      "health_score",
      "open_diagnostics",
      "blocker_diagnostics",
      "last_crawl_at",
      "assignee_principal_id",
      "shared_policy_id",
      "sla_due_at"
    ]);
    expect(persistenceTable("agency_client_projects")?.indexes).toEqual([
      {
        name: "agency_client_projects_workspace_idx",
        columns: ["organization_id", "workspace_id", "display_name"]
      },
      {
        name: "agency_client_projects_project_unique_idx",
        columns: ["organization_id", "workspace_id", "project_id"],
        unique: true
      }
    ]);
    expect(
      persistenceTable("agency_white_label_brands")?.columns.map(
        (column) => column.name
      )
    ).toEqual([
      "id",
      "organization_id",
      "schema_version",
      "created_at",
      "retention_until",
      "deletion_state",
      "workspace_id",
      "brand_label",
      "logo_uri",
      "primary_color",
      "report_footer"
    ]);
    expect(persistenceTable("agency_white_label_brands")?.indexes).toEqual([
      {
        name: "agency_white_label_brands_workspace_unique_idx",
        columns: ["organization_id", "workspace_id"],
        unique: true
      }
    ]);
  });

  it("declares report artifact retention metadata", () => {
    expect(
      persistenceTable("report_artifacts")?.columns.map((column) => column.name)
    ).toEqual([
      "id",
      "organization_id",
      "schema_version",
      "created_at",
      "retention_until",
      "deletion_state",
      "project_id",
      "environment_id",
      "report_kind",
      "artifact_uri",
      "pinned",
      "generated_at"
    ]);
    expect(persistenceTable("report_artifacts")?.indexes).toEqual([
      {
        name: "report_artifacts_expiry_idx",
        columns: ["deletion_state", "pinned", "retention_until", "created_at"]
      },
      {
        name: "report_artifacts_environment_idx",
        columns: ["organization_id", "environment_id", "generated_at"]
      }
    ]);
  });

  it("declares dashboard snapshot materialization storage", () => {
    expect(
      persistenceTable("dashboard_snapshots")?.columns.map(
        (column) => column.name
      )
    ).toEqual([
      "id",
      "organization_id",
      "schema_version",
      "created_at",
      "retention_until",
      "deletion_state",
      "project_id",
      "environment_id",
      "payload",
      "materialized_at"
    ]);
    expect(persistenceTable("dashboard_snapshots")?.indexes).toEqual([
      {
        name: "dashboard_snapshots_environment_unique_idx",
        columns: ["organization_id", "project_id", "environment_id"],
        unique: true
      },
      {
        name: "dashboard_snapshots_materialized_idx",
        columns: ["organization_id", "materialized_at"]
      }
    ]);
  });

  it("declares deployment history production persistence", () => {
    expect(
      persistenceTable("deployment_history")?.columns.map(
        (column) => column.name
      )
    ).toEqual([
      "id",
      "organization_id",
      "schema_version",
      "created_at",
      "retention_until",
      "deletion_state",
      "project_id",
      "environment_id",
      "deployment_id",
      "commit_sha",
      "status",
      "deployed_at",
      "actor",
      "source",
      "annotations"
    ]);
    expect(persistenceTable("deployment_history")?.indexes).toEqual([
      {
        name: "deployment_history_environment_time_idx",
        columns: ["organization_id", "environment_id", "deployed_at"]
      },
      {
        name: "deployment_history_unique_idx",
        columns: [
          "organization_id",
          "project_id",
          "environment_id",
          "deployment_id"
        ],
        unique: true
      }
    ]);
  });

  it("declares page snapshot history production persistence", () => {
    expect(
      persistenceTable("page_snapshot_history")?.columns.map(
        (column) => column.name
      )
    ).toEqual([
      "id",
      "organization_id",
      "schema_version",
      "created_at",
      "retention_until",
      "deletion_state",
      "project_id",
      "environment_id",
      "page_url",
      "captured_at",
      "artifact_references",
      "diagnostic_fingerprints"
    ]);
    expect(persistenceTable("page_snapshot_history")?.indexes).toEqual([
      {
        name: "page_snapshot_history_environment_time_idx",
        columns: ["organization_id", "environment_id", "captured_at"]
      },
      {
        name: "page_snapshot_history_unique_idx",
        columns: [
          "organization_id",
          "project_id",
          "environment_id",
          "page_url",
          "captured_at"
        ],
        unique: true
      }
    ]);
  });

  it("declares history rollup production persistence", () => {
    expect(
      persistenceTable("history_rollups")?.columns.map((column) => column.name)
    ).toEqual([
      "id",
      "organization_id",
      "schema_version",
      "created_at",
      "retention_until",
      "deletion_state",
      "project_id",
      "environment_id",
      "rollup_kind",
      "rollup_key",
      "period_start",
      "period_end",
      "dimensions",
      "metrics",
      "generated_at"
    ]);
    expect(persistenceTable("history_rollups")?.indexes).toEqual([
      {
        name: "history_rollups_environment_time_idx",
        columns: [
          "organization_id",
          "environment_id",
          "rollup_kind",
          "period_start"
        ]
      },
      {
        name: "history_rollups_unique_idx",
        columns: [
          "organization_id",
          "project_id",
          "environment_id",
          "rollup_kind",
          "rollup_key",
          "period_start"
        ],
        unique: true
      }
    ]);
  });

  it("declares persisted diagnostic storage", () => {
    expect(
      persistenceTable("diagnostics")?.columns.map((column) => column.name)
    ).toEqual([
      "id",
      "organization_id",
      "schema_version",
      "created_at",
      "retention_until",
      "deletion_state",
      "project_id",
      "environment_id",
      "crawl_request_id",
      "rule_id",
      "severity",
      "confidence",
      "page_url",
      "route",
      "source",
      "title",
      "evidence",
      "expected",
      "actual",
      "source_location",
      "structured_evidence",
      "observed_at",
      "fingerprint"
    ]);
    expect(persistenceTable("diagnostics")?.indexes).toEqual([
      {
        name: "diagnostics_environment_severity_idx",
        columns: [
          "organization_id",
          "environment_id",
          "severity",
          "observed_at"
        ]
      },
      {
        name: "diagnostics_fingerprint_unique_idx",
        columns: [
          "organization_id",
          "project_id",
          "environment_id",
          "fingerprint"
        ],
        unique: true
      }
    ]);
  });

  it("declares persisted external observation storage", () => {
    expect(
      persistenceTable("external_observations")?.columns.map(
        (column) => column.name
      )
    ).toEqual([
      "id",
      "organization_id",
      "schema_version",
      "created_at",
      "retention_until",
      "deletion_state",
      "project_id",
      "environment_id",
      "provider",
      "source",
      "subject_url",
      "observed_at",
      "fetched_at",
      "freshness",
      "payload",
      "quota",
      "sampling",
      "fingerprint"
    ]);
    expect(persistenceTable("external_observations")?.indexes).toEqual([
      {
        name: "external_observations_provider_time_idx",
        columns: [
          "organization_id",
          "environment_id",
          "provider",
          "observed_at"
        ]
      },
      {
        name: "external_observations_fingerprint_unique_idx",
        columns: [
          "organization_id",
          "project_id",
          "environment_id",
          "provider",
          "fingerprint"
        ],
        unique: true
      }
    ]);
    expect(persistenceTable("external_observations")?.retentionClass).toBe(
      "diagnostic_summary"
    );
  });

  it("declares OAuth connection metadata without raw token columns", () => {
    expect(
      persistenceTable("oauth_connections")?.columns.map(
        (column) => column.name
      )
    ).toEqual([
      "id",
      "organization_id",
      "schema_version",
      "created_at",
      "retention_until",
      "deletion_state",
      "project_id",
      "environment_id",
      "provider",
      "provider_account_id",
      "scopes",
      "access_token_secret_ref",
      "refresh_token_secret_ref",
      "expires_at",
      "last_refresh_at",
      "last_error",
      "status"
    ]);
    expect(
      persistenceTable("oauth_connections")?.columns.map(
        (column) => column.name
      )
    ).not.toEqual(expect.arrayContaining(["access_token", "refresh_token"]));
    expect(persistenceTable("oauth_connections")?.indexes).toEqual([
      {
        name: "oauth_connections_unique_provider_account_idx",
        columns: [
          "organization_id",
          "project_id",
          "environment_id",
          "provider",
          "provider_account_id"
        ],
        unique: true
      },
      {
        name: "oauth_connections_active_provider_idx",
        columns: [
          "organization_id",
          "project_id",
          "environment_id",
          "provider",
          "status"
        ]
      },
      {
        name: "oauth_connections_refresh_due_idx",
        columns: ["status", "expires_at", "provider", "created_at"]
      }
    ]);
    expect(persistenceTable("oauth_connections")?.retentionClass).toBe(
      "oauth_secret"
    );
  });

  it("declares crawl request execution metadata as nullable persisted fields", () => {
    const columns = persistenceTable("crawl_requests")?.columns ?? [];
    expect(
      columns
        .filter((column) =>
          [
            "started_at",
            "completed_at",
            "failed_at",
            "last_error",
            "artifact_uri"
          ].includes(column.name)
        )
        .map((column) => ({
          name: column.name,
          nullable: column.nullable,
          type: column.type
        }))
    ).toEqual([
      { name: "started_at", nullable: true, type: "timestamp" },
      { name: "completed_at", nullable: true, type: "timestamp" },
      { name: "failed_at", nullable: true, type: "timestamp" },
      { name: "last_error", nullable: true, type: "text" },
      { name: "artifact_uri", nullable: true, type: "text" }
    ]);
  });
});
