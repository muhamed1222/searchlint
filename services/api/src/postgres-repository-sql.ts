import { persistenceTable } from "./schema-contracts.js";
import type {
  AuditEvent,
  BillableUsageEvent,
  CloudOutboxEvent,
  CrawlRequest,
  DashboardSnapshotPayload,
  Environment,
  ExternalObservationProvider,
  ExternalObservationRecord,
  MetricEvent,
  NotificationChannel,
  NotificationDeliveryAttempt,
  NotificationRule,
  OAuthConnectionRecord,
  Organization,
  OrganizationMembership,
  OrganizationEntitlement,
  Project,
  ReportArtifact,
  StripeWebhookProcessedEvent
} from "./types.js";

export type DeletionState = "active" | "deleting" | "deleted";

export type RetentionMetadata = {
  retentionUntil?: string | null;
  deletionState?: DeletionState;
};

export type PostgresQuery = {
  text: string;
  values: readonly unknown[];
};

export function insertOrganizationSql(
  record: Organization,
  metadata: RetentionMetadata = {}
): PostgresQuery {
  return insertSql(
    "organizations",
    [
      "id",
      "schema_version",
      "name",
      "created_at",
      "retention_until",
      "deletion_state"
    ],
    [
      record.id,
      schemaVersion("organizations"),
      record.name,
      record.createdAt,
      metadata.retentionUntil ?? null,
      metadata.deletionState ?? "active"
    ]
  );
}

export function selectOrganizationSql(organizationId: string): PostgresQuery {
  return selectOneSql(
    "organizations",
    ["id", "deletion_state"],
    [organizationId, "active"]
  );
}

export function insertMembershipSql(
  record: OrganizationMembership,
  metadata: RetentionMetadata = {}
): PostgresQuery {
  return insertSql(
    "organization_memberships",
    [
      "id",
      "organization_id",
      "schema_version",
      "created_at",
      "retention_until",
      "deletion_state",
      "principal_id",
      "role"
    ],
    [
      record.id,
      record.organizationId,
      schemaVersion("organization_memberships"),
      record.createdAt,
      metadata.retentionUntil ?? null,
      metadata.deletionState ?? "active",
      record.principalId,
      record.role
    ]
  );
}

export function selectMembershipSql(
  organizationId: string,
  principalId: string
): PostgresQuery {
  return selectOneSql(
    "organization_memberships",
    ["organization_id", "principal_id", "deletion_state"],
    [organizationId, principalId, "active"]
  );
}

export function selectOrganizationMembershipsSql(input: {
  organizationId: string;
}): PostgresQuery {
  return {
    text: 'SELECT * FROM "organization_memberships" WHERE "organization_id" = $1 AND "deletion_state" = $2 ORDER BY "role" ASC, "principal_id" ASC;',
    values: [input.organizationId, "active"]
  };
}

export function insertNotificationChannelSql(
  record: NotificationChannel,
  metadata: RetentionMetadata = {}
): PostgresQuery {
  return insertSql(
    "notification_channels",
    [
      "id",
      "organization_id",
      "schema_version",
      "created_at",
      "retention_until",
      "deletion_state",
      "project_id",
      "environment_id",
      "kind",
      "name",
      "target_display",
      "target_secret_ref",
      "enabled"
    ],
    [
      record.id,
      record.organizationId,
      schemaVersion("notification_channels"),
      record.createdAt,
      metadata.retentionUntil ?? null,
      metadata.deletionState ?? "active",
      record.projectId,
      record.environmentId,
      record.kind,
      record.name,
      record.target.display,
      record.target.secretRef ?? null,
      record.enabled
    ]
  );
}

export function insertNotificationRuleSql(
  record: NotificationRule,
  metadata: RetentionMetadata = {}
): PostgresQuery {
  return insertSql(
    "notification_rules",
    [
      "id",
      "organization_id",
      "schema_version",
      "created_at",
      "retention_until",
      "deletion_state",
      "project_id",
      "environment_id",
      "name",
      "event_kinds",
      "channel_ids",
      "severity_threshold",
      "digest",
      "muted_until",
      "snoozed_until",
      "enabled"
    ],
    [
      record.id,
      record.organizationId,
      schemaVersion("notification_rules"),
      record.createdAt,
      metadata.retentionUntil ?? null,
      metadata.deletionState ?? "active",
      record.projectId,
      record.environmentId,
      record.name,
      record.eventKinds,
      record.channelIds,
      record.severityThreshold ?? null,
      record.digest,
      record.mutedUntil ?? null,
      record.snoozedUntil ?? null,
      record.enabled
    ]
  );
}

export function insertNotificationDeliveryAttemptSql(
  record: NotificationDeliveryAttempt,
  metadata: RetentionMetadata = {}
): PostgresQuery {
  return insertSql(
    "notification_delivery_attempts",
    [
      "id",
      "organization_id",
      "schema_version",
      "created_at",
      "retention_until",
      "deletion_state",
      "task_id",
      "channel_id",
      "channel_kind",
      "status",
      "attempted_at",
      "attempt",
      "failure_reason",
      "next_retry_at"
    ],
    [
      record.id,
      record.organizationId,
      schemaVersion("notification_delivery_attempts"),
      record.attemptedAt,
      metadata.retentionUntil ?? null,
      metadata.deletionState ?? "active",
      record.taskId,
      record.channelId,
      record.channelKind,
      record.status,
      record.attemptedAt,
      record.attempt,
      record.failureReason ?? null,
      record.nextRetryAt ?? null
    ]
  );
}

export function selectNotificationChannelsSql(input: {
  organizationId: string;
  projectId: string;
  environmentId: string;
}): PostgresQuery {
  return {
    text: 'SELECT * FROM "notification_channels" WHERE "organization_id" = $1 AND "project_id" = $2 AND "environment_id" = $3 AND "deletion_state" = $4 ORDER BY "kind" ASC, "name" ASC, "id" ASC;',
    values: [
      input.organizationId,
      input.projectId,
      input.environmentId,
      "active"
    ]
  };
}

export function selectNotificationRulesSql(input: {
  organizationId: string;
  projectId: string;
  environmentId: string;
}): PostgresQuery {
  return {
    text: 'SELECT * FROM "notification_rules" WHERE "organization_id" = $1 AND "project_id" = $2 AND "environment_id" = $3 AND "deletion_state" = $4 ORDER BY "name" ASC, "id" ASC;',
    values: [
      input.organizationId,
      input.projectId,
      input.environmentId,
      "active"
    ]
  };
}

export function selectNotificationDeliveryAttemptsSql(input: {
  organizationId: string;
  limit: number;
}): PostgresQuery {
  return {
    text: 'SELECT * FROM "notification_delivery_attempts" WHERE "organization_id" = $1 AND "deletion_state" = $2 ORDER BY "attempted_at" DESC, "id" ASC LIMIT $3;',
    values: [input.organizationId, "active", input.limit]
  };
}

export function updateMembershipRoleSql(input: {
  organizationId: string;
  principalId: string;
  role: OrganizationMembership["role"];
}): PostgresQuery {
  return {
    text: 'UPDATE "organization_memberships" SET "role" = $1 WHERE "organization_id" = $2 AND "principal_id" = $3 AND "deletion_state" = $4 RETURNING *;',
    values: [input.role, input.organizationId, input.principalId, "active"]
  };
}

export function removeMembershipSql(input: {
  organizationId: string;
  principalId: string;
}): PostgresQuery {
  return {
    text: 'UPDATE "organization_memberships" SET "deletion_state" = $1 WHERE "organization_id" = $2 AND "principal_id" = $3 AND "deletion_state" = $4 RETURNING *;',
    values: ["deleted", input.organizationId, input.principalId, "active"]
  };
}

export function insertProjectSql(
  record: Project,
  metadata: RetentionMetadata = {}
): PostgresQuery {
  return insertSql(
    "projects",
    [
      "id",
      "organization_id",
      "schema_version",
      "created_at",
      "retention_until",
      "deletion_state",
      "name",
      "site_url"
    ],
    [
      record.id,
      record.organizationId,
      schemaVersion("projects"),
      record.createdAt,
      metadata.retentionUntil ?? null,
      metadata.deletionState ?? "active",
      record.name,
      record.siteUrl
    ]
  );
}

export function selectProjectSql(
  organizationId: string,
  projectId: string
): PostgresQuery {
  return selectOneSql(
    "projects",
    ["organization_id", "id", "deletion_state"],
    [organizationId, projectId, "active"]
  );
}

export function insertEnvironmentSql(
  record: Environment,
  metadata: RetentionMetadata = {}
): PostgresQuery {
  return insertSql(
    "environments",
    [
      "id",
      "organization_id",
      "schema_version",
      "created_at",
      "retention_until",
      "deletion_state",
      "project_id",
      "name",
      "base_url"
    ],
    [
      record.id,
      record.organizationId,
      schemaVersion("environments"),
      record.createdAt,
      metadata.retentionUntil ?? null,
      metadata.deletionState ?? "active",
      record.projectId,
      record.name,
      record.baseUrl
    ]
  );
}

export function selectEnvironmentSql(
  organizationId: string,
  environmentId: string
): PostgresQuery {
  return selectOneSql(
    "environments",
    ["organization_id", "id", "deletion_state"],
    [organizationId, environmentId, "active"]
  );
}

export function insertCrawlRequestSql(
  record: CrawlRequest,
  metadata: RetentionMetadata = {}
): PostgresQuery {
  return insertSql(
    "crawl_requests",
    [
      "id",
      "organization_id",
      "schema_version",
      "created_at",
      "retention_until",
      "deletion_state",
      "project_id",
      "environment_id",
      "requested_by",
      "max_urls",
      "status",
      "started_at",
      "completed_at",
      "failed_at",
      "last_error",
      "artifact_uri"
    ],
    [
      record.id,
      record.organizationId,
      schemaVersion("crawl_requests"),
      record.createdAt,
      metadata.retentionUntil ?? null,
      metadata.deletionState ?? "active",
      record.projectId,
      record.environmentId,
      record.requestedBy,
      record.maxUrls,
      record.status,
      record.startedAt ?? null,
      record.completedAt ?? null,
      record.failedAt ?? null,
      record.lastError ?? null,
      record.artifactUri ?? null
    ]
  );
}

export function selectCrawlRequestSql(
  organizationId: string,
  crawlRequestId: string
): PostgresQuery {
  return selectOneSql(
    "crawl_requests",
    ["organization_id", "id", "deletion_state"],
    [organizationId, crawlRequestId, "active"]
  );
}

export function selectDashboardCrawlRunsSql(input: {
  organizationId: string;
  projectId: string;
  environmentId: string;
  limit: number;
}): PostgresQuery {
  return {
    text: 'SELECT * FROM "crawl_requests" WHERE "organization_id" = $1 AND "project_id" = $2 AND "environment_id" = $3 AND "deletion_state" = $4 ORDER BY "created_at" DESC LIMIT $5;',
    values: [
      input.organizationId,
      input.projectId,
      input.environmentId,
      "active",
      input.limit
    ]
  };
}

export function markCrawlRequestRunningSql(input: {
  organizationId: string;
  id: string;
  startedAt: string;
}): PostgresQuery {
  return {
    text: 'UPDATE "crawl_requests" SET "status" = $1, "started_at" = $2, "completed_at" = $3, "failed_at" = $4, "last_error" = $5 WHERE "organization_id" = $6 AND "id" = $7 AND "status" = $8 AND "deletion_state" = $9 RETURNING *;',
    values: [
      "running",
      input.startedAt,
      null,
      null,
      null,
      input.organizationId,
      input.id,
      "queued",
      "active"
    ]
  };
}

export function markCrawlRequestSucceededSql(input: {
  organizationId: string;
  id: string;
  completedAt: string;
  artifactUri?: string;
}): PostgresQuery {
  return {
    text: 'UPDATE "crawl_requests" SET "status" = $1, "completed_at" = $2, "failed_at" = $3, "last_error" = $4, "artifact_uri" = $5 WHERE "organization_id" = $6 AND "id" = $7 AND "status" = $8 AND "deletion_state" = $9 RETURNING *;',
    values: [
      "succeeded",
      input.completedAt,
      null,
      null,
      input.artifactUri ?? null,
      input.organizationId,
      input.id,
      "running",
      "active"
    ]
  };
}

export function markCrawlRequestFailedSql(input: {
  organizationId: string;
  id: string;
  failedAt: string;
  lastError: string;
}): PostgresQuery {
  return {
    text: 'UPDATE "crawl_requests" SET "status" = $1, "failed_at" = $2, "last_error" = $3 WHERE "organization_id" = $4 AND "id" = $5 AND "status" = $6 AND "deletion_state" = $7 RETURNING *;',
    values: [
      "failed",
      input.failedAt,
      input.lastError,
      input.organizationId,
      input.id,
      "running",
      "active"
    ]
  };
}

export function insertAuditEventSql(
  record: AuditEvent,
  metadata: RetentionMetadata = {}
): PostgresQuery {
  return insertSql(
    "audit_events",
    [
      "id",
      "organization_id",
      "schema_version",
      "created_at",
      "retention_until",
      "deletion_state",
      "actor_principal_id",
      "action",
      "target_type",
      "target_id",
      "occurred_at"
    ],
    [
      record.id,
      record.organizationId,
      schemaVersion("audit_events"),
      record.occurredAt,
      metadata.retentionUntil ?? null,
      metadata.deletionState ?? "active",
      record.actorPrincipalId,
      record.action,
      record.targetType,
      record.targetId,
      record.occurredAt
    ]
  );
}

export function insertMetricEventSql(
  record: MetricEvent,
  metadata: RetentionMetadata = {}
): PostgresQuery {
  return insertSql(
    "metric_events",
    [
      "id",
      "organization_id",
      "schema_version",
      "created_at",
      "retention_until",
      "deletion_state",
      "name",
      "value",
      "dimensions",
      "occurred_at"
    ],
    [
      record.id,
      record.organizationId,
      schemaVersion("metric_events"),
      record.occurredAt,
      metadata.retentionUntil ?? null,
      metadata.deletionState ?? "active",
      record.name,
      record.value,
      record.dimensions,
      record.occurredAt
    ]
  );
}

export function insertOutboxEventSql(
  record: CloudOutboxEvent,
  metadata: RetentionMetadata = {}
): PostgresQuery {
  return insertSql(
    "outbox_events",
    [
      "id",
      "organization_id",
      "schema_version",
      "created_at",
      "retention_until",
      "deletion_state",
      "topic",
      "payload",
      "status",
      "attempts",
      "available_at",
      "locked_at",
      "published_at",
      "last_error"
    ],
    [
      record.id,
      record.organizationId,
      schemaVersion("outbox_events"),
      record.createdAt,
      metadata.retentionUntil ?? null,
      metadata.deletionState ?? "active",
      record.topic,
      record.payload,
      record.status,
      record.attempts,
      record.availableAt,
      record.lockedAt ?? null,
      record.publishedAt ?? null,
      record.lastError ?? null
    ]
  );
}

export function selectPendingOutboxEventsSql(input: {
  now: string;
  limit: number;
}): PostgresQuery {
  return {
    text: 'SELECT * FROM "outbox_events" WHERE "status" = $1 AND "available_at" <= $2 AND "deletion_state" = $3 ORDER BY "created_at" ASC LIMIT $4;',
    values: ["pending", input.now, "active", input.limit]
  };
}

export function markOutboxEventProcessingSql(input: {
  organizationId: string;
  id: string;
  lockedAt: string;
}): PostgresQuery {
  return {
    text: 'UPDATE "outbox_events" SET "status" = $1, "attempts" = "attempts" + 1, "locked_at" = $2 WHERE "organization_id" = $3 AND "id" = $4 AND "status" = $5 AND "deletion_state" = $6 RETURNING *;',
    values: [
      "processing",
      input.lockedAt,
      input.organizationId,
      input.id,
      "pending",
      "active"
    ]
  };
}

export function markOutboxEventPublishedSql(input: {
  organizationId: string;
  id: string;
  publishedAt: string;
}): PostgresQuery {
  return {
    text: 'UPDATE "outbox_events" SET "status" = $1, "published_at" = $2, "locked_at" = $3, "last_error" = $4 WHERE "organization_id" = $5 AND "id" = $6 AND "status" = $7 AND "deletion_state" = $8 RETURNING *;',
    values: [
      "published",
      input.publishedAt,
      null,
      null,
      input.organizationId,
      input.id,
      "processing",
      "active"
    ]
  };
}

export function markOutboxEventFailedSql(input: {
  organizationId: string;
  id: string;
  lastError: string;
  availableAt: string;
}): PostgresQuery {
  return {
    text: 'UPDATE "outbox_events" SET "status" = $1, "available_at" = $2, "locked_at" = $3, "last_error" = $4 WHERE "organization_id" = $5 AND "id" = $6 AND "status" = $7 AND "deletion_state" = $8 RETURNING *;',
    values: [
      "pending",
      input.availableAt,
      null,
      input.lastError,
      input.organizationId,
      input.id,
      "processing",
      "active"
    ]
  };
}

export function selectOrganizationEntitlementSql(
  organizationId: string
): PostgresQuery {
  return {
    text: 'SELECT * FROM "organization_entitlements" WHERE "organization_id" = $1 AND "deletion_state" = $2 ORDER BY "current_period_end" DESC LIMIT 1;',
    values: [organizationId, "active"]
  };
}

export function selectStripeBillingIdentitySql(input: {
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
}): PostgresQuery {
  if (input.stripeSubscriptionId && input.stripeCustomerId) {
    return {
      text: 'SELECT * FROM "stripe_billing_identities" WHERE "active" = $1 AND "deletion_state" = $2 AND ("stripe_subscription_id" = $3 OR "stripe_customer_id" = $4) ORDER BY CASE WHEN "stripe_subscription_id" = $3 THEN 0 ELSE 1 END ASC, "created_at" DESC LIMIT 1;',
      values: [
        true,
        "active",
        input.stripeSubscriptionId,
        input.stripeCustomerId
      ]
    };
  }

  if (input.stripeSubscriptionId) {
    return {
      text: 'SELECT * FROM "stripe_billing_identities" WHERE "active" = $1 AND "deletion_state" = $2 AND "stripe_subscription_id" = $3 ORDER BY "created_at" DESC LIMIT 1;',
      values: [true, "active", input.stripeSubscriptionId]
    };
  }

  if (input.stripeCustomerId) {
    return {
      text: 'SELECT * FROM "stripe_billing_identities" WHERE "active" = $1 AND "deletion_state" = $2 AND "stripe_customer_id" = $3 ORDER BY "created_at" DESC LIMIT 1;',
      values: [true, "active", input.stripeCustomerId]
    };
  }

  throw new Error(
    "Stripe billing identity lookup requires a customer or subscription id."
  );
}

export function recordStripeWebhookEventSql(
  record: StripeWebhookProcessedEvent,
  metadata: RetentionMetadata = {}
): PostgresQuery {
  return {
    text: 'INSERT INTO "stripe_webhook_events" ("id", "organization_id", "schema_version", "created_at", "retention_until", "deletion_state", "stripe_event_id", "stripe_event_type", "intent_kind", "processed_at") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $4) ON CONFLICT ("organization_id", "stripe_event_id") DO NOTHING RETURNING *;',
    values: [
      record.id,
      record.organizationId,
      schemaVersion("stripe_webhook_events"),
      record.processedAt,
      metadata.retentionUntil ?? null,
      metadata.deletionState ?? "active",
      record.stripeEventId,
      record.stripeEventType,
      record.intentKind
    ]
  };
}

export function upsertStripeOrganizationEntitlementSql(
  record: OrganizationEntitlement,
  metadata: RetentionMetadata = {}
): PostgresQuery {
  return {
    text: 'INSERT INTO "organization_entitlements" ("id", "organization_id", "schema_version", "created_at", "retention_until", "deletion_state", "plan_tier", "status", "current_period_start", "current_period_end", "crawl_max_urls_per_run", "monthly_crawled_urls_limit", "external_api_monthly_limit", "report_retention_days", "source") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) ON CONFLICT ("id") DO UPDATE SET "plan_tier" = EXCLUDED."plan_tier", "status" = EXCLUDED."status", "current_period_start" = EXCLUDED."current_period_start", "current_period_end" = EXCLUDED."current_period_end", "crawl_max_urls_per_run" = EXCLUDED."crawl_max_urls_per_run", "monthly_crawled_urls_limit" = EXCLUDED."monthly_crawled_urls_limit", "external_api_monthly_limit" = EXCLUDED."external_api_monthly_limit", "report_retention_days" = EXCLUDED."report_retention_days", "source" = EXCLUDED."source", "created_at" = EXCLUDED."created_at", "retention_until" = EXCLUDED."retention_until", "deletion_state" = EXCLUDED."deletion_state" RETURNING *;',
    values: [
      record.id,
      record.organizationId,
      schemaVersion("organization_entitlements"),
      record.createdAt,
      metadata.retentionUntil ?? null,
      metadata.deletionState ?? "active",
      record.planTier,
      record.status,
      record.currentPeriodStart,
      record.currentPeriodEnd,
      record.crawlMaxUrlsPerRun,
      record.monthlyCrawledUrlsLimit,
      record.externalApiMonthlyLimit,
      record.reportRetentionDays,
      record.source
    ]
  };
}

export function selectUsageCounterSql(input: {
  organizationId: string;
  counterName: string;
  periodStart: string;
}): PostgresQuery {
  return selectOneSql(
    "usage_counters",
    ["organization_id", "counter_name", "period_start", "deletion_state"],
    [input.organizationId, input.counterName, input.periodStart, "active"]
  );
}

export function recordUsageEventSql(
  record: BillableUsageEvent,
  metadata: RetentionMetadata = {}
): PostgresQuery {
  return {
    text: 'WITH inserted_event AS (INSERT INTO "billable_usage_events" ("id", "organization_id", "schema_version", "created_at", "retention_until", "deletion_state", "counter_name", "idempotency_key", "amount", "period_start", "period_end", "occurred_at", "source", "subject_type", "subject_id") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $4, $12, $13, $14) ON CONFLICT ("organization_id", "idempotency_key") DO NOTHING RETURNING "organization_id", "counter_name", "amount", "period_start", "period_end", "occurred_at") INSERT INTO "usage_counters" ("id", "organization_id", "schema_version", "created_at", "retention_until", "deletion_state", "counter_name", "period_start", "period_end", "used") SELECT $15, "organization_id", $16, "occurred_at", $5, $6, "counter_name", "period_start", "period_end", "amount" FROM inserted_event ON CONFLICT ("organization_id", "counter_name", "period_start") DO UPDATE SET "used" = "usage_counters"."used" + EXCLUDED."used", "period_end" = EXCLUDED."period_end", "created_at" = LEAST("usage_counters"."created_at", EXCLUDED."created_at") RETURNING *;',
    values: [
      record.id,
      record.organizationId,
      schemaVersion("billable_usage_events"),
      record.occurredAt,
      metadata.retentionUntil ?? null,
      metadata.deletionState ?? "active",
      record.counterName,
      record.idempotencyKey,
      record.amount,
      record.periodStart,
      record.periodEnd,
      record.source,
      record.subjectType,
      record.subjectId,
      `${record.id}:counter`,
      schemaVersion("usage_counters")
    ]
  };
}

export function insertReportArtifactSql(
  record: ReportArtifact,
  metadata: RetentionMetadata = {}
): PostgresQuery {
  return insertSql(
    "report_artifacts",
    [
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
    ],
    [
      record.id,
      record.organizationId,
      schemaVersion("report_artifacts"),
      record.createdAt,
      metadata.retentionUntil ?? record.retentionUntil ?? null,
      metadata.deletionState ?? record.deletionState,
      record.projectId,
      record.environmentId,
      record.reportKind,
      record.artifactUri ?? null,
      record.pinned,
      record.generatedAt
    ]
  );
}

export function selectExpiredReportArtifactsSql(input: {
  now: string;
  limit: number;
}): PostgresQuery {
  return {
    text: 'SELECT * FROM "report_artifacts" WHERE "deletion_state" = $1 AND "pinned" = $2 AND "retention_until" IS NOT NULL AND "retention_until" <= $3 ORDER BY "retention_until" ASC, "created_at" ASC LIMIT $4;',
    values: ["active", false, input.now, input.limit]
  };
}

export function selectDashboardReportArtifactsSql(input: {
  organizationId: string;
  projectId: string;
  environmentId: string;
  limit: number;
}): PostgresQuery {
  return {
    text: 'SELECT * FROM "report_artifacts" WHERE "organization_id" = $1 AND "project_id" = $2 AND "environment_id" = $3 AND "deletion_state" = $4 ORDER BY "generated_at" DESC LIMIT $5;',
    values: [
      input.organizationId,
      input.projectId,
      input.environmentId,
      "active",
      input.limit
    ]
  };
}

export function upsertAgencyClientWorkspaceSql(input: {
  id: string;
  organizationId: string;
  clientName: string;
  status: string;
  ownerPrincipalId: string;
  createdAt: string;
  retentionUntil?: string | null;
  deletionState?: DeletionState;
}): PostgresQuery {
  return {
    text: 'INSERT INTO "agency_client_workspaces" ("id", "organization_id", "schema_version", "created_at", "retention_until", "deletion_state", "client_name", "status", "owner_principal_id") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT ("id") DO UPDATE SET "schema_version" = EXCLUDED."schema_version", "retention_until" = EXCLUDED."retention_until", "deletion_state" = EXCLUDED."deletion_state", "client_name" = EXCLUDED."client_name", "status" = EXCLUDED."status", "owner_principal_id" = EXCLUDED."owner_principal_id" RETURNING *;',
    values: [
      input.id,
      input.organizationId,
      schemaVersion("agency_client_workspaces"),
      input.createdAt,
      input.retentionUntil ?? null,
      input.deletionState ?? "active",
      input.clientName,
      input.status,
      input.ownerPrincipalId
    ]
  };
}

export function selectAgencyClientWorkspacesSql(input: {
  organizationId: string;
  limit: number;
}): PostgresQuery {
  return {
    text: 'SELECT * FROM "agency_client_workspaces" WHERE "organization_id" = $1 AND "deletion_state" = $2 ORDER BY "status" ASC, "client_name" ASC, "id" ASC LIMIT $3;',
    values: [input.organizationId, "active", input.limit]
  };
}

export function upsertAgencySharedRulePolicySql(input: {
  id: string;
  organizationId: string;
  name: string;
  ruleIds: readonly string[];
  severityOverrides: Readonly<Record<string, unknown>>;
  createdAt: string;
  retentionUntil?: string | null;
  deletionState?: DeletionState;
}): PostgresQuery {
  return {
    text: 'INSERT INTO "agency_shared_rule_policies" ("id", "organization_id", "schema_version", "created_at", "retention_until", "deletion_state", "name", "rule_ids", "severity_overrides") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT ("id") DO UPDATE SET "schema_version" = EXCLUDED."schema_version", "retention_until" = EXCLUDED."retention_until", "deletion_state" = EXCLUDED."deletion_state", "name" = EXCLUDED."name", "rule_ids" = EXCLUDED."rule_ids", "severity_overrides" = EXCLUDED."severity_overrides" RETURNING *;',
    values: [
      input.id,
      input.organizationId,
      schemaVersion("agency_shared_rule_policies"),
      input.createdAt,
      input.retentionUntil ?? null,
      input.deletionState ?? "active",
      input.name,
      input.ruleIds,
      input.severityOverrides
    ]
  };
}

export function selectAgencySharedRulePoliciesSql(input: {
  organizationId: string;
  limit: number;
}): PostgresQuery {
  return {
    text: 'SELECT * FROM "agency_shared_rule_policies" WHERE "organization_id" = $1 AND "deletion_state" = $2 ORDER BY "name" ASC, "id" ASC LIMIT $3;',
    values: [input.organizationId, "active", input.limit]
  };
}

export function upsertAgencyClientProjectSql(input: {
  id: string;
  organizationId: string;
  workspaceId: string;
  projectId: string;
  environmentId: string;
  displayName: string;
  siteUrl: string;
  healthScore: number;
  openDiagnostics: number;
  blockerDiagnostics: number;
  lastCrawlAt?: string | null;
  assigneePrincipalId?: string | null;
  sharedPolicyId?: string | null;
  slaDueAt?: string | null;
  createdAt: string;
  retentionUntil?: string | null;
  deletionState?: DeletionState;
}): PostgresQuery {
  return {
    text: 'INSERT INTO "agency_client_projects" ("id", "organization_id", "schema_version", "created_at", "retention_until", "deletion_state", "workspace_id", "project_id", "environment_id", "display_name", "site_url", "health_score", "open_diagnostics", "blocker_diagnostics", "last_crawl_at", "assignee_principal_id", "shared_policy_id", "sla_due_at") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18) ON CONFLICT ("organization_id", "workspace_id", "project_id") DO UPDATE SET "schema_version" = EXCLUDED."schema_version", "retention_until" = EXCLUDED."retention_until", "deletion_state" = EXCLUDED."deletion_state", "environment_id" = EXCLUDED."environment_id", "display_name" = EXCLUDED."display_name", "site_url" = EXCLUDED."site_url", "health_score" = EXCLUDED."health_score", "open_diagnostics" = EXCLUDED."open_diagnostics", "blocker_diagnostics" = EXCLUDED."blocker_diagnostics", "last_crawl_at" = EXCLUDED."last_crawl_at", "assignee_principal_id" = EXCLUDED."assignee_principal_id", "shared_policy_id" = EXCLUDED."shared_policy_id", "sla_due_at" = EXCLUDED."sla_due_at" RETURNING *;',
    values: [
      input.id,
      input.organizationId,
      schemaVersion("agency_client_projects"),
      input.createdAt,
      input.retentionUntil ?? null,
      input.deletionState ?? "active",
      input.workspaceId,
      input.projectId,
      input.environmentId,
      input.displayName,
      input.siteUrl,
      input.healthScore,
      input.openDiagnostics,
      input.blockerDiagnostics,
      input.lastCrawlAt ?? null,
      input.assigneePrincipalId ?? null,
      input.sharedPolicyId ?? null,
      input.slaDueAt ?? null
    ]
  };
}

export function selectAgencyClientProjectsSql(input: {
  organizationId: string;
  workspaceId: string;
  limit: number;
}): PostgresQuery {
  return {
    text: 'SELECT * FROM "agency_client_projects" WHERE "organization_id" = $1 AND "workspace_id" = $2 AND "deletion_state" = $3 ORDER BY "display_name" ASC, "project_id" ASC LIMIT $4;',
    values: [input.organizationId, input.workspaceId, "active", input.limit]
  };
}

export function upsertAgencyWhiteLabelBrandSql(input: {
  id: string;
  organizationId: string;
  clientWorkspaceId: string;
  brandLabel: string;
  logoUri?: string | null;
  primaryColor?: string | null;
  reportFooter?: string | null;
  createdAt: string;
  retentionUntil?: string | null;
  deletionState?: DeletionState;
}): PostgresQuery {
  return {
    text: 'INSERT INTO "agency_white_label_brands" ("id", "organization_id", "schema_version", "created_at", "retention_until", "deletion_state", "workspace_id", "brand_label", "logo_uri", "primary_color", "report_footer") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) ON CONFLICT ("organization_id", "workspace_id") DO UPDATE SET "schema_version" = EXCLUDED."schema_version", "retention_until" = EXCLUDED."retention_until", "deletion_state" = EXCLUDED."deletion_state", "brand_label" = EXCLUDED."brand_label", "logo_uri" = EXCLUDED."logo_uri", "primary_color" = EXCLUDED."primary_color", "report_footer" = EXCLUDED."report_footer" RETURNING *;',
    values: [
      input.id,
      input.organizationId,
      schemaVersion("agency_white_label_brands"),
      input.createdAt,
      input.retentionUntil ?? null,
      input.deletionState ?? "active",
      input.clientWorkspaceId,
      input.brandLabel,
      input.logoUri ?? null,
      input.primaryColor ?? null,
      input.reportFooter ?? null
    ]
  };
}

export function selectAgencyWhiteLabelBrandsSql(input: {
  organizationId: string;
  limit: number;
}): PostgresQuery {
  return {
    text: 'SELECT * FROM "agency_white_label_brands" WHERE "organization_id" = $1 AND "deletion_state" = $2 ORDER BY "brand_label" ASC, "workspace_id" ASC LIMIT $3;',
    values: [input.organizationId, "active", input.limit]
  };
}

export function upsertDashboardDiagnosticSql(input: {
  id: string;
  organizationId: string;
  projectId: string;
  environmentId: string;
  crawlRequestId?: string | null;
  ruleId: string;
  severity: string;
  confidence: string;
  pageUrl: string;
  route?: string;
  source: string;
  title: string;
  evidence: string;
  expected?: string;
  actual?: string;
  sourceLocation?: Readonly<Record<string, unknown>> | null;
  structuredEvidence?: readonly unknown[] | null;
  observedAt: string;
  fingerprint: string;
  createdAt?: string;
  retentionUntil?: string | null;
  deletionState?: DeletionState;
}): PostgresQuery {
  return {
    text: 'INSERT INTO "diagnostics" ("id", "organization_id", "schema_version", "created_at", "retention_until", "deletion_state", "project_id", "environment_id", "crawl_request_id", "rule_id", "severity", "confidence", "page_url", "route", "source", "title", "evidence", "expected", "actual", "source_location", "structured_evidence", "observed_at", "fingerprint") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23) ON CONFLICT ("organization_id", "project_id", "environment_id", "fingerprint") DO UPDATE SET "schema_version" = EXCLUDED."schema_version", "retention_until" = EXCLUDED."retention_until", "deletion_state" = EXCLUDED."deletion_state", "crawl_request_id" = EXCLUDED."crawl_request_id", "rule_id" = EXCLUDED."rule_id", "severity" = EXCLUDED."severity", "confidence" = EXCLUDED."confidence", "page_url" = EXCLUDED."page_url", "route" = EXCLUDED."route", "source" = EXCLUDED."source", "title" = EXCLUDED."title", "evidence" = EXCLUDED."evidence", "expected" = EXCLUDED."expected", "actual" = EXCLUDED."actual", "source_location" = EXCLUDED."source_location", "structured_evidence" = EXCLUDED."structured_evidence", "observed_at" = EXCLUDED."observed_at" RETURNING *;',
    values: [
      input.id,
      input.organizationId,
      schemaVersion("diagnostics"),
      input.createdAt ?? input.observedAt,
      input.retentionUntil ?? null,
      input.deletionState ?? "active",
      input.projectId,
      input.environmentId,
      input.crawlRequestId ?? null,
      input.ruleId,
      input.severity,
      input.confidence,
      input.pageUrl,
      input.route ?? null,
      input.source,
      input.title,
      input.evidence,
      input.expected ?? null,
      input.actual ?? null,
      input.sourceLocation ?? null,
      input.structuredEvidence ?? null,
      input.observedAt,
      input.fingerprint
    ]
  };
}

export function selectDashboardDiagnosticsSql(input: {
  organizationId: string;
  projectId: string;
  environmentId: string;
  limit: number;
}): PostgresQuery {
  return {
    text: 'SELECT * FROM "diagnostics" WHERE "organization_id" = $1 AND "project_id" = $2 AND "environment_id" = $3 AND "deletion_state" = $4 ORDER BY "severity" ASC, "rule_id" ASC, "page_url" ASC, "fingerprint" ASC LIMIT $5;',
    values: [
      input.organizationId,
      input.projectId,
      input.environmentId,
      "active",
      input.limit
    ]
  };
}

export function upsertExternalObservationSql(
  input: ExternalObservationRecord
): PostgresQuery {
  return {
    text: 'INSERT INTO "external_observations" ("id", "organization_id", "schema_version", "created_at", "retention_until", "deletion_state", "project_id", "environment_id", "provider", "source", "subject_url", "observed_at", "fetched_at", "freshness", "payload", "quota", "sampling", "fingerprint") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18) ON CONFLICT ("organization_id", "project_id", "environment_id", "provider", "fingerprint") DO UPDATE SET "schema_version" = EXCLUDED."schema_version", "created_at" = EXCLUDED."created_at", "retention_until" = EXCLUDED."retention_until", "deletion_state" = EXCLUDED."deletion_state", "source" = EXCLUDED."source", "subject_url" = EXCLUDED."subject_url", "observed_at" = EXCLUDED."observed_at", "fetched_at" = EXCLUDED."fetched_at", "freshness" = EXCLUDED."freshness", "payload" = EXCLUDED."payload", "quota" = EXCLUDED."quota", "sampling" = EXCLUDED."sampling" RETURNING *;',
    values: [
      input.id,
      input.organizationId,
      schemaVersion("external_observations"),
      input.createdAt,
      input.retentionUntil ?? null,
      input.deletionState,
      input.projectId,
      input.environmentId,
      input.provider,
      input.source,
      input.subjectUrl,
      input.observedAt,
      input.fetchedAt,
      input.freshness,
      input.payload,
      input.quota ?? null,
      input.sampling ?? null,
      input.fingerprint
    ]
  };
}

export function selectExternalObservationsSql(input: {
  organizationId: string;
  projectId: string;
  environmentId: string;
  provider?: ExternalObservationProvider;
  limit: number;
}): PostgresQuery {
  if (input.provider === undefined) {
    return {
      text: 'SELECT * FROM "external_observations" WHERE "organization_id" = $1 AND "project_id" = $2 AND "environment_id" = $3 AND "deletion_state" = $4 ORDER BY "provider" ASC, "observed_at" DESC, "source" ASC, "subject_url" ASC LIMIT $5;',
      values: [
        input.organizationId,
        input.projectId,
        input.environmentId,
        "active",
        input.limit
      ]
    };
  }

  return {
    text: 'SELECT * FROM "external_observations" WHERE "organization_id" = $1 AND "project_id" = $2 AND "environment_id" = $3 AND "provider" = $4 AND "deletion_state" = $5 ORDER BY "observed_at" DESC, "source" ASC, "subject_url" ASC LIMIT $6;',
    values: [
      input.organizationId,
      input.projectId,
      input.environmentId,
      input.provider,
      "active",
      input.limit
    ]
  };
}

export function upsertOAuthConnectionSql(
  input: OAuthConnectionRecord
): PostgresQuery {
  return {
    text: 'INSERT INTO "oauth_connections" ("id", "organization_id", "schema_version", "created_at", "retention_until", "deletion_state", "project_id", "environment_id", "provider", "provider_account_id", "scopes", "access_token_secret_ref", "refresh_token_secret_ref", "expires_at", "last_refresh_at", "last_error", "status") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) ON CONFLICT ("organization_id", "project_id", "environment_id", "provider", "provider_account_id") DO UPDATE SET "schema_version" = EXCLUDED."schema_version", "created_at" = EXCLUDED."created_at", "retention_until" = EXCLUDED."retention_until", "deletion_state" = EXCLUDED."deletion_state", "scopes" = EXCLUDED."scopes", "access_token_secret_ref" = EXCLUDED."access_token_secret_ref", "refresh_token_secret_ref" = EXCLUDED."refresh_token_secret_ref", "expires_at" = EXCLUDED."expires_at", "last_refresh_at" = EXCLUDED."last_refresh_at", "last_error" = EXCLUDED."last_error", "status" = EXCLUDED."status" RETURNING *;',
    values: [
      input.id,
      input.organizationId,
      schemaVersion("oauth_connections"),
      input.createdAt,
      input.retentionUntil ?? null,
      input.deletionState,
      input.projectId,
      input.environmentId,
      input.provider,
      input.providerAccountId,
      input.scopes,
      input.accessTokenSecretRef ?? null,
      input.refreshTokenSecretRef,
      input.expiresAt ?? null,
      input.lastRefreshAt ?? null,
      input.lastError ?? null,
      input.status
    ]
  };
}

export function selectOAuthConnectionSql(input: {
  organizationId: string;
  projectId: string;
  environmentId: string;
  provider: ExternalObservationProvider;
}): PostgresQuery {
  return {
    text: 'SELECT * FROM "oauth_connections" WHERE "organization_id" = $1 AND "project_id" = $2 AND "environment_id" = $3 AND "provider" = $4 AND "status" = $5 AND "deletion_state" = $6 ORDER BY "created_at" DESC LIMIT 1;',
    values: [
      input.organizationId,
      input.projectId,
      input.environmentId,
      input.provider,
      "active",
      "active"
    ]
  };
}

export function selectOAuthConnectionsDueForRefreshSql(input: {
  now: string;
  provider?: ExternalObservationProvider;
  limit: number;
}): PostgresQuery {
  if (input.provider === undefined) {
    return {
      text: 'SELECT * FROM "oauth_connections" WHERE "status" = $1 AND "deletion_state" = $2 AND ("expires_at" IS NULL OR "expires_at" <= $3) ORDER BY "expires_at" ASC NULLS FIRST, "provider" ASC, "created_at" ASC LIMIT $4;',
      values: ["active", "active", input.now, input.limit]
    };
  }

  return {
    text: 'SELECT * FROM "oauth_connections" WHERE "status" = $1 AND "deletion_state" = $2 AND "provider" = $3 AND ("expires_at" IS NULL OR "expires_at" <= $4) ORDER BY "expires_at" ASC NULLS FIRST, "provider" ASC, "created_at" ASC LIMIT $5;',
    values: ["active", "active", input.provider, input.now, input.limit]
  };
}

export function markOAuthConnectionRevokedSql(input: {
  organizationId: string;
  id: string;
}): PostgresQuery {
  return {
    text: 'UPDATE "oauth_connections" SET "status" = $1, "last_error" = $2 WHERE "organization_id" = $3 AND "id" = $4 AND "deletion_state" = $5 RETURNING *;',
    values: ["revoked", null, input.organizationId, input.id, "active"]
  };
}

export function markReportArtifactDeletingSql(input: {
  organizationId: string;
  id: string;
}): PostgresQuery {
  return {
    text: 'UPDATE "report_artifacts" SET "deletion_state" = $1 WHERE "organization_id" = $2 AND "id" = $3 AND "deletion_state" = $4 RETURNING *;',
    values: ["deleting", input.organizationId, input.id, "active"]
  };
}

export function markReportArtifactDeletedSql(input: {
  organizationId: string;
  id: string;
}): PostgresQuery {
  return {
    text: 'UPDATE "report_artifacts" SET "deletion_state" = $1, "artifact_uri" = $2 WHERE "organization_id" = $3 AND "id" = $4 AND "deletion_state" = $5 RETURNING *;',
    values: ["deleted", null, input.organizationId, input.id, "deleting"]
  };
}

export function markReportArtifactDeletionFailedSql(input: {
  organizationId: string;
  id: string;
}): PostgresQuery {
  return {
    text: 'UPDATE "report_artifacts" SET "deletion_state" = $1 WHERE "organization_id" = $2 AND "id" = $3 AND "deletion_state" = $4 RETURNING *;',
    values: ["active", input.organizationId, input.id, "deleting"]
  };
}

export function upsertDashboardSnapshotSql(input: {
  id: string;
  organizationId: string;
  projectId: string;
  environmentId: string;
  payload: DashboardSnapshotPayload;
  materializedAt: string;
  retentionUntil?: string | null;
  deletionState?: DeletionState;
}): PostgresQuery {
  return {
    text: 'INSERT INTO "dashboard_snapshots" ("id", "organization_id", "schema_version", "created_at", "retention_until", "deletion_state", "project_id", "environment_id", "payload", "materialized_at") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $4) ON CONFLICT ("organization_id", "project_id", "environment_id") DO UPDATE SET "schema_version" = EXCLUDED."schema_version", "retention_until" = EXCLUDED."retention_until", "deletion_state" = EXCLUDED."deletion_state", "payload" = EXCLUDED."payload", "materialized_at" = EXCLUDED."materialized_at" RETURNING *;',
    values: [
      input.id,
      input.organizationId,
      schemaVersion("dashboard_snapshots"),
      input.materializedAt,
      input.retentionUntil ?? null,
      input.deletionState ?? "active",
      input.projectId,
      input.environmentId,
      input.payload
    ]
  };
}

export function selectDashboardSnapshotSql(input: {
  organizationId: string;
  projectId: string;
  environmentId: string;
}): PostgresQuery {
  return {
    text: 'SELECT * FROM "dashboard_snapshots" WHERE "organization_id" = $1 AND "project_id" = $2 AND "environment_id" = $3 AND "deletion_state" = $4 LIMIT 1;',
    values: [
      input.organizationId,
      input.projectId,
      input.environmentId,
      "active"
    ]
  };
}

export function upsertDeploymentHistorySql(input: {
  id: string;
  organizationId: string;
  projectId: string;
  environmentId: string;
  deploymentId: string;
  commitSha: string;
  status: string;
  deployedAt: string;
  actor?: string | null;
  source: string;
  annotations: Readonly<Record<string, unknown>>;
  createdAt?: string;
  retentionUntil?: string | null;
  deletionState?: DeletionState;
}): PostgresQuery {
  return {
    text: 'INSERT INTO "deployment_history" ("id", "organization_id", "schema_version", "created_at", "retention_until", "deletion_state", "project_id", "environment_id", "deployment_id", "commit_sha", "status", "deployed_at", "actor", "source", "annotations") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) ON CONFLICT ("organization_id", "project_id", "environment_id", "deployment_id") DO UPDATE SET "schema_version" = EXCLUDED."schema_version", "retention_until" = EXCLUDED."retention_until", "deletion_state" = EXCLUDED."deletion_state", "commit_sha" = EXCLUDED."commit_sha", "status" = EXCLUDED."status", "deployed_at" = EXCLUDED."deployed_at", "actor" = EXCLUDED."actor", "source" = EXCLUDED."source", "annotations" = EXCLUDED."annotations" RETURNING *;',
    values: [
      input.id,
      input.organizationId,
      schemaVersion("deployment_history"),
      input.createdAt ?? input.deployedAt,
      input.retentionUntil ?? null,
      input.deletionState ?? "active",
      input.projectId,
      input.environmentId,
      input.deploymentId,
      input.commitSha,
      input.status,
      input.deployedAt,
      input.actor ?? null,
      input.source,
      input.annotations
    ]
  };
}

export function selectDeploymentHistorySql(input: {
  organizationId: string;
  projectId: string;
  environmentId: string;
  limit: number;
}): PostgresQuery {
  return {
    text: 'SELECT * FROM "deployment_history" WHERE "organization_id" = $1 AND "project_id" = $2 AND "environment_id" = $3 AND "deletion_state" = $4 ORDER BY "deployed_at" DESC, "deployment_id" ASC LIMIT $5;',
    values: [
      input.organizationId,
      input.projectId,
      input.environmentId,
      "active",
      input.limit
    ]
  };
}

export function upsertPageSnapshotHistorySql(input: {
  id: string;
  organizationId: string;
  projectId: string;
  environmentId: string;
  pageUrl: string;
  capturedAt: string;
  artifactReferences: Readonly<Record<string, unknown>>;
  diagnosticFingerprints: readonly string[];
  createdAt?: string;
  retentionUntil?: string | null;
  deletionState?: DeletionState;
}): PostgresQuery {
  return {
    text: 'INSERT INTO "page_snapshot_history" ("id", "organization_id", "schema_version", "created_at", "retention_until", "deletion_state", "project_id", "environment_id", "page_url", "captured_at", "artifact_references", "diagnostic_fingerprints") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) ON CONFLICT ("organization_id", "project_id", "environment_id", "page_url", "captured_at") DO UPDATE SET "schema_version" = EXCLUDED."schema_version", "retention_until" = EXCLUDED."retention_until", "deletion_state" = EXCLUDED."deletion_state", "artifact_references" = EXCLUDED."artifact_references", "diagnostic_fingerprints" = EXCLUDED."diagnostic_fingerprints" RETURNING *;',
    values: [
      input.id,
      input.organizationId,
      schemaVersion("page_snapshot_history"),
      input.createdAt ?? input.capturedAt,
      input.retentionUntil ?? null,
      input.deletionState ?? "active",
      input.projectId,
      input.environmentId,
      input.pageUrl,
      input.capturedAt,
      input.artifactReferences,
      input.diagnosticFingerprints
    ]
  };
}

export function selectPageSnapshotHistorySql(input: {
  organizationId: string;
  projectId: string;
  environmentId: string;
  limit: number;
}): PostgresQuery {
  return {
    text: 'SELECT * FROM "page_snapshot_history" WHERE "organization_id" = $1 AND "project_id" = $2 AND "environment_id" = $3 AND "deletion_state" = $4 ORDER BY "captured_at" DESC, "page_url" ASC LIMIT $5;',
    values: [
      input.organizationId,
      input.projectId,
      input.environmentId,
      "active",
      input.limit
    ]
  };
}

export function upsertHistoryRollupSql(input: {
  id: string;
  organizationId: string;
  projectId: string;
  environmentId: string;
  rollupKind: string;
  rollupKey: string;
  periodStart: string;
  periodEnd: string;
  dimensions: Readonly<Record<string, unknown>>;
  metrics: Readonly<Record<string, unknown>>;
  generatedAt: string;
  createdAt?: string;
  retentionUntil?: string | null;
  deletionState?: DeletionState;
}): PostgresQuery {
  return {
    text: 'INSERT INTO "history_rollups" ("id", "organization_id", "schema_version", "created_at", "retention_until", "deletion_state", "project_id", "environment_id", "rollup_kind", "rollup_key", "period_start", "period_end", "dimensions", "metrics", "generated_at") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) ON CONFLICT ("organization_id", "project_id", "environment_id", "rollup_kind", "rollup_key", "period_start") DO UPDATE SET "schema_version" = EXCLUDED."schema_version", "retention_until" = EXCLUDED."retention_until", "deletion_state" = EXCLUDED."deletion_state", "period_end" = EXCLUDED."period_end", "dimensions" = EXCLUDED."dimensions", "metrics" = EXCLUDED."metrics", "generated_at" = EXCLUDED."generated_at" RETURNING *;',
    values: [
      input.id,
      input.organizationId,
      schemaVersion("history_rollups"),
      input.createdAt ?? input.generatedAt,
      input.retentionUntil ?? null,
      input.deletionState ?? "active",
      input.projectId,
      input.environmentId,
      input.rollupKind,
      input.rollupKey,
      input.periodStart,
      input.periodEnd,
      input.dimensions,
      input.metrics,
      input.generatedAt
    ]
  };
}

export function selectHistoryRollupsSql(input: {
  organizationId: string;
  projectId: string;
  environmentId: string;
  rollupKind?: string;
  limit: number;
}): PostgresQuery {
  if (input.rollupKind === undefined) {
    return {
      text: 'SELECT * FROM "history_rollups" WHERE "organization_id" = $1 AND "project_id" = $2 AND "environment_id" = $3 AND "deletion_state" = $4 ORDER BY "rollup_kind" ASC, "period_start" DESC, "rollup_key" ASC LIMIT $5;',
      values: [
        input.organizationId,
        input.projectId,
        input.environmentId,
        "active",
        input.limit
      ]
    };
  }

  return {
    text: 'SELECT * FROM "history_rollups" WHERE "organization_id" = $1 AND "project_id" = $2 AND "environment_id" = $3 AND "rollup_kind" = $4 AND "deletion_state" = $5 ORDER BY "period_start" DESC, "rollup_key" ASC LIMIT $6;',
    values: [
      input.organizationId,
      input.projectId,
      input.environmentId,
      input.rollupKind,
      "active",
      input.limit
    ]
  };
}

function insertSql(
  table: string,
  columns: readonly string[],
  values: readonly unknown[]
): PostgresQuery {
  return {
    text: `INSERT INTO ${identifier(table)} (${columns
      .map(identifier)
      .join(
        ", "
      )}) VALUES (${values.map((_, index) => `$${index + 1}`).join(", ")}) RETURNING *;`,
    values
  };
}

function selectOneSql(
  table: string,
  whereColumns: readonly string[],
  values: readonly unknown[]
): PostgresQuery {
  return {
    text: `SELECT * FROM ${identifier(table)} WHERE ${whereColumns
      .map((column, index) => `${identifier(column)} = $${index + 1}`)
      .join(" AND ")} LIMIT 1;`,
    values
  };
}

function schemaVersion(tableName: string): string {
  const table = persistenceTable(tableName);
  if (!table) {
    throw new Error(`Unknown persistence table ${tableName}`);
  }
  return table.schemaVersion;
}

function identifier(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}
