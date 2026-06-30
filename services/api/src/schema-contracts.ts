export type PersistenceColumnType =
  | "text"
  | "integer"
  | "timestamp"
  | "json"
  | "boolean";

export type PersistenceColumn = {
  name: string;
  type: PersistenceColumnType;
  nullable: boolean;
  primaryKey?: boolean;
  references?: string;
};

export type PersistenceIndex = {
  name: string;
  columns: readonly string[];
  unique?: boolean;
};

export type RetentionClass =
  | "none"
  | "oauth_secret"
  | "crawl_artifact"
  | "diagnostic_summary"
  | "report_artifact"
  | "audit_log"
  | "billing_record"
  | "outbox_event"
  | "metric_event"
  | "notification_setting"
  | "rate_limit_window";

export type PersistenceTableContract = {
  name: string;
  schemaVersion: string;
  tenantScoped: boolean;
  retentionClass: RetentionClass;
  columns: readonly PersistenceColumn[];
  indexes: readonly PersistenceIndex[];
};

const standardTenantColumns: readonly PersistenceColumn[] = [
  { name: "id", type: "text", nullable: false, primaryKey: true },
  { name: "organization_id", type: "text", nullable: false },
  { name: "schema_version", type: "text", nullable: false },
  { name: "created_at", type: "timestamp", nullable: false },
  { name: "retention_until", type: "timestamp", nullable: true },
  { name: "deletion_state", type: "text", nullable: false }
];

export const cloudPersistenceSchema: readonly PersistenceTableContract[] = [
  {
    name: "organizations",
    schemaVersion: "cloud.organizations.v1",
    tenantScoped: false,
    retentionClass: "none",
    columns: [
      { name: "id", type: "text", nullable: false, primaryKey: true },
      { name: "schema_version", type: "text", nullable: false },
      { name: "name", type: "text", nullable: false },
      { name: "created_at", type: "timestamp", nullable: false },
      { name: "retention_until", type: "timestamp", nullable: true },
      { name: "deletion_state", type: "text", nullable: false }
    ],
    indexes: [{ name: "organizations_name_idx", columns: ["name"] }]
  },
  {
    name: "organization_memberships",
    schemaVersion: "cloud.organization_memberships.v1",
    tenantScoped: true,
    retentionClass: "none",
    columns: [
      ...standardTenantColumns,
      {
        name: "principal_id",
        type: "text",
        nullable: false
      },
      { name: "role", type: "text", nullable: false }
    ],
    indexes: [
      {
        name: "organization_memberships_unique_member_idx",
        columns: ["organization_id", "principal_id"],
        unique: true
      }
    ]
  },
  {
    name: "projects",
    schemaVersion: "cloud.projects.v1",
    tenantScoped: true,
    retentionClass: "diagnostic_summary",
    columns: [
      ...standardTenantColumns,
      { name: "name", type: "text", nullable: false },
      { name: "site_url", type: "text", nullable: false }
    ],
    indexes: [{ name: "projects_org_idx", columns: ["organization_id"] }]
  },
  {
    name: "environments",
    schemaVersion: "cloud.environments.v1",
    tenantScoped: true,
    retentionClass: "diagnostic_summary",
    columns: [
      ...standardTenantColumns,
      {
        name: "project_id",
        type: "text",
        nullable: false,
        references: "projects.id"
      },
      { name: "name", type: "text", nullable: false },
      { name: "base_url", type: "text", nullable: false }
    ],
    indexes: [
      {
        name: "environments_project_idx",
        columns: ["organization_id", "project_id"]
      }
    ]
  },
  {
    name: "crawl_requests",
    schemaVersion: "cloud.crawl_requests.v1",
    tenantScoped: true,
    retentionClass: "crawl_artifact",
    columns: [
      ...standardTenantColumns,
      {
        name: "project_id",
        type: "text",
        nullable: false,
        references: "projects.id"
      },
      {
        name: "environment_id",
        type: "text",
        nullable: false,
        references: "environments.id"
      },
      { name: "requested_by", type: "text", nullable: false },
      { name: "max_urls", type: "integer", nullable: false },
      { name: "status", type: "text", nullable: false },
      { name: "started_at", type: "timestamp", nullable: true },
      { name: "completed_at", type: "timestamp", nullable: true },
      { name: "failed_at", type: "timestamp", nullable: true },
      { name: "last_error", type: "text", nullable: true },
      { name: "artifact_uri", type: "text", nullable: true }
    ],
    indexes: [
      {
        name: "crawl_requests_environment_idx",
        columns: ["organization_id", "environment_id", "created_at"]
      }
    ]
  },
  {
    name: "audit_events",
    schemaVersion: "cloud.audit_events.v1",
    tenantScoped: true,
    retentionClass: "audit_log",
    columns: [
      ...standardTenantColumns,
      { name: "actor_principal_id", type: "text", nullable: false },
      { name: "action", type: "text", nullable: false },
      { name: "target_type", type: "text", nullable: false },
      { name: "target_id", type: "text", nullable: false },
      { name: "occurred_at", type: "timestamp", nullable: false }
    ],
    indexes: [
      {
        name: "audit_events_org_time_idx",
        columns: ["organization_id", "occurred_at"]
      }
    ]
  },
  {
    name: "metric_events",
    schemaVersion: "cloud.metric_events.v1",
    tenantScoped: true,
    retentionClass: "metric_event",
    columns: [
      ...standardTenantColumns,
      { name: "name", type: "text", nullable: false },
      { name: "value", type: "integer", nullable: false },
      { name: "dimensions", type: "json", nullable: false },
      { name: "occurred_at", type: "timestamp", nullable: false }
    ],
    indexes: [
      {
        name: "metric_events_org_name_time_idx",
        columns: ["organization_id", "name", "occurred_at"]
      }
    ]
  },
  {
    name: "outbox_events",
    schemaVersion: "cloud.outbox_events.v1",
    tenantScoped: true,
    retentionClass: "outbox_event",
    columns: [
      ...standardTenantColumns,
      { name: "topic", type: "text", nullable: false },
      { name: "payload", type: "json", nullable: false },
      { name: "status", type: "text", nullable: false },
      { name: "attempts", type: "integer", nullable: false },
      { name: "available_at", type: "timestamp", nullable: false },
      { name: "locked_at", type: "timestamp", nullable: true },
      { name: "published_at", type: "timestamp", nullable: true },
      { name: "last_error", type: "text", nullable: true }
    ],
    indexes: [
      {
        name: "outbox_events_pending_idx",
        columns: ["status", "available_at", "created_at"]
      },
      {
        name: "outbox_events_org_status_idx",
        columns: ["organization_id", "status", "created_at"]
      }
    ]
  },
  {
    name: "organization_entitlements",
    schemaVersion: "cloud.organization_entitlements.v1",
    tenantScoped: true,
    retentionClass: "billing_record",
    columns: [
      ...standardTenantColumns,
      { name: "plan_tier", type: "text", nullable: false },
      { name: "status", type: "text", nullable: false },
      { name: "current_period_start", type: "timestamp", nullable: false },
      { name: "current_period_end", type: "timestamp", nullable: false },
      { name: "crawl_max_urls_per_run", type: "integer", nullable: false },
      { name: "monthly_crawled_urls_limit", type: "integer", nullable: false },
      { name: "external_api_monthly_limit", type: "integer", nullable: false },
      { name: "report_retention_days", type: "integer", nullable: false },
      { name: "source", type: "text", nullable: false }
    ],
    indexes: [
      {
        name: "organization_entitlements_org_status_idx",
        columns: ["organization_id", "status", "current_period_end"]
      }
    ]
  },
  {
    name: "stripe_billing_identities",
    schemaVersion: "cloud.stripe_billing_identities.v1",
    tenantScoped: true,
    retentionClass: "billing_record",
    columns: [
      ...standardTenantColumns,
      { name: "stripe_customer_id", type: "text", nullable: false },
      { name: "stripe_subscription_id", type: "text", nullable: true },
      { name: "plan_tier", type: "text", nullable: false },
      { name: "active", type: "boolean", nullable: false }
    ],
    indexes: [
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
    ]
  },
  {
    name: "stripe_webhook_events",
    schemaVersion: "cloud.stripe_webhook_events.v1",
    tenantScoped: true,
    retentionClass: "billing_record",
    columns: [
      ...standardTenantColumns,
      { name: "stripe_event_id", type: "text", nullable: false },
      { name: "stripe_event_type", type: "text", nullable: false },
      { name: "intent_kind", type: "text", nullable: false },
      { name: "processed_at", type: "timestamp", nullable: false }
    ],
    indexes: [
      {
        name: "stripe_webhook_events_idempotency_idx",
        columns: ["organization_id", "stripe_event_id"],
        unique: true
      },
      {
        name: "stripe_webhook_events_org_time_idx",
        columns: ["organization_id", "processed_at"]
      }
    ]
  },
  {
    name: "usage_counters",
    schemaVersion: "cloud.usage_counters.v1",
    tenantScoped: true,
    retentionClass: "billing_record",
    columns: [
      ...standardTenantColumns,
      { name: "counter_name", type: "text", nullable: false },
      { name: "period_start", type: "timestamp", nullable: false },
      { name: "period_end", type: "timestamp", nullable: false },
      { name: "used", type: "integer", nullable: false }
    ],
    indexes: [
      {
        name: "usage_counters_unique_period_idx",
        columns: ["organization_id", "counter_name", "period_start"],
        unique: true
      },
      {
        name: "usage_counters_org_period_idx",
        columns: ["organization_id", "period_end"]
      }
    ]
  },
  {
    name: "billable_usage_events",
    schemaVersion: "cloud.billable_usage_events.v1",
    tenantScoped: true,
    retentionClass: "billing_record",
    columns: [
      ...standardTenantColumns,
      { name: "counter_name", type: "text", nullable: false },
      { name: "idempotency_key", type: "text", nullable: false },
      { name: "amount", type: "integer", nullable: false },
      { name: "period_start", type: "timestamp", nullable: false },
      { name: "period_end", type: "timestamp", nullable: false },
      { name: "occurred_at", type: "timestamp", nullable: false },
      { name: "source", type: "text", nullable: false },
      { name: "subject_type", type: "text", nullable: false },
      { name: "subject_id", type: "text", nullable: false }
    ],
    indexes: [
      {
        name: "billable_usage_events_idempotency_idx",
        columns: ["organization_id", "idempotency_key"],
        unique: true
      },
      {
        name: "billable_usage_events_org_counter_time_idx",
        columns: ["organization_id", "counter_name", "occurred_at"]
      }
    ]
  },
  {
    name: "agency_client_workspaces",
    schemaVersion: "cloud.agency_client_workspaces.v1",
    tenantScoped: true,
    retentionClass: "diagnostic_summary",
    columns: [
      ...standardTenantColumns,
      { name: "client_name", type: "text", nullable: false },
      { name: "status", type: "text", nullable: false },
      { name: "owner_principal_id", type: "text", nullable: false }
    ],
    indexes: [
      {
        name: "agency_client_workspaces_org_status_idx",
        columns: ["organization_id", "status", "client_name"]
      }
    ]
  },
  {
    name: "agency_shared_rule_policies",
    schemaVersion: "cloud.agency_shared_rule_policies.v1",
    tenantScoped: true,
    retentionClass: "diagnostic_summary",
    columns: [
      ...standardTenantColumns,
      { name: "name", type: "text", nullable: false },
      { name: "rule_ids", type: "json", nullable: false },
      { name: "severity_overrides", type: "json", nullable: false }
    ],
    indexes: [
      {
        name: "agency_shared_rule_policies_org_name_idx",
        columns: ["organization_id", "name"]
      }
    ]
  },
  {
    name: "agency_client_projects",
    schemaVersion: "cloud.agency_client_projects.v1",
    tenantScoped: true,
    retentionClass: "diagnostic_summary",
    columns: [
      ...standardTenantColumns,
      {
        name: "workspace_id",
        type: "text",
        nullable: false,
        references: "agency_client_workspaces.id"
      },
      {
        name: "project_id",
        type: "text",
        nullable: false,
        references: "projects.id"
      },
      {
        name: "environment_id",
        type: "text",
        nullable: false,
        references: "environments.id"
      },
      { name: "display_name", type: "text", nullable: false },
      { name: "site_url", type: "text", nullable: false },
      { name: "health_score", type: "integer", nullable: false },
      { name: "open_diagnostics", type: "integer", nullable: false },
      { name: "blocker_diagnostics", type: "integer", nullable: false },
      { name: "last_crawl_at", type: "timestamp", nullable: true },
      { name: "assignee_principal_id", type: "text", nullable: true },
      {
        name: "shared_policy_id",
        type: "text",
        nullable: true,
        references: "agency_shared_rule_policies.id"
      },
      { name: "sla_due_at", type: "timestamp", nullable: true }
    ],
    indexes: [
      {
        name: "agency_client_projects_workspace_idx",
        columns: ["organization_id", "workspace_id", "display_name"]
      },
      {
        name: "agency_client_projects_project_unique_idx",
        columns: ["organization_id", "workspace_id", "project_id"],
        unique: true
      }
    ]
  },
  {
    name: "agency_white_label_brands",
    schemaVersion: "cloud.agency_white_label_brands.v1",
    tenantScoped: true,
    retentionClass: "diagnostic_summary",
    columns: [
      ...standardTenantColumns,
      {
        name: "workspace_id",
        type: "text",
        nullable: false,
        references: "agency_client_workspaces.id"
      },
      { name: "brand_label", type: "text", nullable: false },
      { name: "logo_uri", type: "text", nullable: true },
      { name: "primary_color", type: "text", nullable: true },
      { name: "report_footer", type: "text", nullable: true }
    ],
    indexes: [
      {
        name: "agency_white_label_brands_workspace_unique_idx",
        columns: ["organization_id", "workspace_id"],
        unique: true
      }
    ]
  },
  {
    name: "report_artifacts",
    schemaVersion: "cloud.report_artifacts.v1",
    tenantScoped: true,
    retentionClass: "report_artifact",
    columns: [
      ...standardTenantColumns,
      {
        name: "project_id",
        type: "text",
        nullable: false,
        references: "projects.id"
      },
      {
        name: "environment_id",
        type: "text",
        nullable: false,
        references: "environments.id"
      },
      { name: "report_kind", type: "text", nullable: false },
      { name: "artifact_uri", type: "text", nullable: true },
      { name: "pinned", type: "boolean", nullable: false },
      { name: "generated_at", type: "timestamp", nullable: false }
    ],
    indexes: [
      {
        name: "report_artifacts_expiry_idx",
        columns: ["deletion_state", "pinned", "retention_until", "created_at"]
      },
      {
        name: "report_artifacts_environment_idx",
        columns: ["organization_id", "environment_id", "generated_at"]
      }
    ]
  },
  {
    name: "dashboard_snapshots",
    schemaVersion: "cloud.dashboard_snapshots.v1",
    tenantScoped: true,
    retentionClass: "diagnostic_summary",
    columns: [
      ...standardTenantColumns,
      {
        name: "project_id",
        type: "text",
        nullable: false,
        references: "projects.id"
      },
      {
        name: "environment_id",
        type: "text",
        nullable: false,
        references: "environments.id"
      },
      { name: "payload", type: "json", nullable: false },
      { name: "materialized_at", type: "timestamp", nullable: false }
    ],
    indexes: [
      {
        name: "dashboard_snapshots_environment_unique_idx",
        columns: ["organization_id", "project_id", "environment_id"],
        unique: true
      },
      {
        name: "dashboard_snapshots_materialized_idx",
        columns: ["organization_id", "materialized_at"]
      }
    ]
  },
  {
    name: "deployment_history",
    schemaVersion: "cloud.deployment_history.v1",
    tenantScoped: true,
    retentionClass: "diagnostic_summary",
    columns: [
      ...standardTenantColumns,
      {
        name: "project_id",
        type: "text",
        nullable: false,
        references: "projects.id"
      },
      {
        name: "environment_id",
        type: "text",
        nullable: false,
        references: "environments.id"
      },
      { name: "deployment_id", type: "text", nullable: false },
      { name: "commit_sha", type: "text", nullable: false },
      { name: "status", type: "text", nullable: false },
      { name: "deployed_at", type: "timestamp", nullable: false },
      { name: "actor", type: "text", nullable: true },
      { name: "source", type: "text", nullable: false },
      { name: "annotations", type: "json", nullable: false }
    ],
    indexes: [
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
    ]
  },
  {
    name: "page_snapshot_history",
    schemaVersion: "cloud.page_snapshot_history.v1",
    tenantScoped: true,
    retentionClass: "crawl_artifact",
    columns: [
      ...standardTenantColumns,
      {
        name: "project_id",
        type: "text",
        nullable: false,
        references: "projects.id"
      },
      {
        name: "environment_id",
        type: "text",
        nullable: false,
        references: "environments.id"
      },
      { name: "page_url", type: "text", nullable: false },
      { name: "captured_at", type: "timestamp", nullable: false },
      { name: "artifact_references", type: "json", nullable: false },
      { name: "diagnostic_fingerprints", type: "json", nullable: false }
    ],
    indexes: [
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
    ]
  },
  {
    name: "history_rollups",
    schemaVersion: "cloud.history_rollups.v1",
    tenantScoped: true,
    retentionClass: "diagnostic_summary",
    columns: [
      ...standardTenantColumns,
      {
        name: "project_id",
        type: "text",
        nullable: false,
        references: "projects.id"
      },
      {
        name: "environment_id",
        type: "text",
        nullable: false,
        references: "environments.id"
      },
      { name: "rollup_kind", type: "text", nullable: false },
      { name: "rollup_key", type: "text", nullable: false },
      { name: "period_start", type: "timestamp", nullable: false },
      { name: "period_end", type: "timestamp", nullable: false },
      { name: "dimensions", type: "json", nullable: false },
      { name: "metrics", type: "json", nullable: false },
      { name: "generated_at", type: "timestamp", nullable: false }
    ],
    indexes: [
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
    ]
  },
  {
    name: "diagnostics",
    schemaVersion: "cloud.diagnostics.v1",
    tenantScoped: true,
    retentionClass: "diagnostic_summary",
    columns: [
      ...standardTenantColumns,
      {
        name: "project_id",
        type: "text",
        nullable: false,
        references: "projects.id"
      },
      {
        name: "environment_id",
        type: "text",
        nullable: false,
        references: "environments.id"
      },
      {
        name: "crawl_request_id",
        type: "text",
        nullable: true,
        references: "crawl_requests.id"
      },
      { name: "rule_id", type: "text", nullable: false },
      { name: "severity", type: "text", nullable: false },
      { name: "confidence", type: "text", nullable: false },
      { name: "page_url", type: "text", nullable: false },
      { name: "route", type: "text", nullable: true },
      { name: "source", type: "text", nullable: false },
      { name: "title", type: "text", nullable: false },
      { name: "evidence", type: "text", nullable: false },
      { name: "expected", type: "text", nullable: true },
      { name: "actual", type: "text", nullable: true },
      { name: "source_location", type: "json", nullable: true },
      { name: "structured_evidence", type: "json", nullable: true },
      { name: "observed_at", type: "timestamp", nullable: false },
      { name: "fingerprint", type: "text", nullable: false }
    ],
    indexes: [
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
    ]
  },
  {
    name: "external_observations",
    schemaVersion: "cloud.external_observations.v1",
    tenantScoped: true,
    retentionClass: "diagnostic_summary",
    columns: [
      ...standardTenantColumns,
      {
        name: "project_id",
        type: "text",
        nullable: false,
        references: "projects.id"
      },
      {
        name: "environment_id",
        type: "text",
        nullable: false,
        references: "environments.id"
      },
      { name: "provider", type: "text", nullable: false },
      { name: "source", type: "text", nullable: false },
      { name: "subject_url", type: "text", nullable: false },
      { name: "observed_at", type: "timestamp", nullable: false },
      { name: "fetched_at", type: "timestamp", nullable: false },
      { name: "freshness", type: "text", nullable: false },
      { name: "payload", type: "json", nullable: false },
      { name: "quota", type: "json", nullable: true },
      { name: "sampling", type: "json", nullable: true },
      { name: "fingerprint", type: "text", nullable: false }
    ],
    indexes: [
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
    ]
  },
  {
    name: "oauth_connections",
    schemaVersion: "cloud.oauth_connections.v1",
    tenantScoped: true,
    retentionClass: "oauth_secret",
    columns: [
      ...standardTenantColumns,
      {
        name: "project_id",
        type: "text",
        nullable: false,
        references: "projects.id"
      },
      {
        name: "environment_id",
        type: "text",
        nullable: false,
        references: "environments.id"
      },
      { name: "provider", type: "text", nullable: false },
      { name: "provider_account_id", type: "text", nullable: false },
      { name: "scopes", type: "json", nullable: false },
      { name: "access_token_secret_ref", type: "text", nullable: true },
      { name: "refresh_token_secret_ref", type: "text", nullable: false },
      { name: "expires_at", type: "timestamp", nullable: true },
      { name: "last_refresh_at", type: "timestamp", nullable: true },
      { name: "last_error", type: "text", nullable: true },
      { name: "status", type: "text", nullable: false }
    ],
    indexes: [
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
    ]
  },
  {
    name: "notification_channels",
    schemaVersion: "cloud.notification_channels.v1",
    tenantScoped: true,
    retentionClass: "notification_setting",
    columns: [
      ...standardTenantColumns,
      {
        name: "project_id",
        type: "text",
        nullable: false,
        references: "projects.id"
      },
      {
        name: "environment_id",
        type: "text",
        nullable: false,
        references: "environments.id"
      },
      { name: "kind", type: "text", nullable: false },
      { name: "name", type: "text", nullable: false },
      { name: "target_display", type: "text", nullable: false },
      { name: "target_secret_ref", type: "text", nullable: true },
      { name: "enabled", type: "boolean", nullable: false }
    ],
    indexes: [
      {
        name: "notification_channels_environment_idx",
        columns: ["organization_id", "project_id", "environment_id", "enabled"]
      }
    ]
  },
  {
    name: "notification_rules",
    schemaVersion: "cloud.notification_rules.v1",
    tenantScoped: true,
    retentionClass: "notification_setting",
    columns: [
      ...standardTenantColumns,
      {
        name: "project_id",
        type: "text",
        nullable: false,
        references: "projects.id"
      },
      {
        name: "environment_id",
        type: "text",
        nullable: false,
        references: "environments.id"
      },
      { name: "name", type: "text", nullable: false },
      { name: "event_kinds", type: "json", nullable: false },
      { name: "channel_ids", type: "json", nullable: false },
      { name: "severity_threshold", type: "text", nullable: true },
      { name: "digest", type: "text", nullable: false },
      { name: "muted_until", type: "timestamp", nullable: true },
      { name: "snoozed_until", type: "timestamp", nullable: true },
      { name: "enabled", type: "boolean", nullable: false }
    ],
    indexes: [
      {
        name: "notification_rules_environment_idx",
        columns: ["organization_id", "project_id", "environment_id", "enabled"]
      }
    ]
  },
  {
    name: "notification_delivery_attempts",
    schemaVersion: "cloud.notification_delivery_attempts.v1",
    tenantScoped: true,
    retentionClass: "notification_setting",
    columns: [
      ...standardTenantColumns,
      { name: "task_id", type: "text", nullable: false },
      { name: "channel_id", type: "text", nullable: false },
      { name: "channel_kind", type: "text", nullable: false },
      { name: "status", type: "text", nullable: false },
      { name: "attempted_at", type: "timestamp", nullable: false },
      { name: "attempt", type: "integer", nullable: false },
      { name: "failure_reason", type: "text", nullable: true },
      { name: "next_retry_at", type: "timestamp", nullable: true }
    ],
    indexes: [
      {
        name: "notification_delivery_attempts_task_idx",
        columns: ["organization_id", "task_id", "attempted_at"]
      },
      {
        name: "notification_delivery_attempts_status_idx",
        columns: ["organization_id", "status", "attempted_at"]
      }
    ]
  },
  {
    name: "rate_limit_windows",
    schemaVersion: "cloud.rate_limit_windows.v1",
    tenantScoped: false,
    retentionClass: "rate_limit_window",
    columns: [
      { name: "key", type: "text", nullable: false, primaryKey: true },
      { name: "schema_version", type: "text", nullable: false },
      { name: "created_at", type: "timestamp", nullable: false },
      { name: "updated_at", type: "timestamp", nullable: false },
      { name: "retention_until", type: "timestamp", nullable: true },
      { name: "deletion_state", type: "text", nullable: false },
      { name: "window_started_at", type: "timestamp", nullable: false },
      { name: "reset_at", type: "timestamp", nullable: false },
      { name: "window_ms", type: "integer", nullable: false },
      { name: "limit_count", type: "integer", nullable: false },
      { name: "consumed_count", type: "integer", nullable: false }
    ],
    indexes: [
      {
        name: "rate_limit_windows_reset_idx",
        columns: ["reset_at"]
      },
      {
        name: "rate_limit_windows_deletion_state_idx",
        columns: ["deletion_state"]
      }
    ]
  }
];

export function persistenceTable(
  name: string
): PersistenceTableContract | undefined {
  return cloudPersistenceSchema.find((table) => table.name === name);
}

export function persistenceColumnNames(
  table: PersistenceTableContract
): readonly string[] {
  return table.columns.map((column) => column.name);
}
