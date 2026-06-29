export type OrganizationRole =
  | "owner"
  | "admin"
  | "developer"
  | "analyst"
  | "client";

export type CloudPermission =
  | "organization:manage"
  | "member:manage"
  | "billing:manage"
  | "project:create"
  | "project:read"
  | "project:update"
  | "environment:create"
  | "environment:read"
  | "crawl:create"
  | "diagnostic:read"
  | "diagnostic:write"
  | "report:read"
  | "connector:manage";

export type Principal = {
  id: string;
  externalSubject: string;
  email?: string;
};

export type Organization = {
  id: string;
  name: string;
  createdAt: string;
};

export type OrganizationMembership = {
  id: string;
  organizationId: string;
  principalId: string;
  role: OrganizationRole;
  createdAt: string;
};

export type Project = {
  id: string;
  organizationId: string;
  name: string;
  siteUrl: string;
  createdAt: string;
};

export type Environment = {
  id: string;
  organizationId: string;
  projectId: string;
  name: string;
  baseUrl: string;
  createdAt: string;
};

export type DashboardSnapshotPayload = Readonly<Record<string, unknown>>;

export type DiagnosticSeverity = "blocker" | "error" | "warning" | "info";

export type DiagnosticConfidence = "certain" | "likely" | "heuristic";

export type DiagnosticSource =
  | "source-code"
  | "raw-html"
  | "rendered-dom"
  | "http-header"
  | "crawler"
  | "google"
  | "yandex";

export type DiagnosticSourceLocation = {
  file?: string;
  line?: number;
  column?: number;
  selector?: string;
  confidence: "exact" | "related";
};

export type DiagnosticStructuredEvidence = Readonly<Record<string, unknown>>;

export type DiagnosticRecord = {
  id: string;
  organizationId: string;
  projectId: string;
  environmentId: string;
  crawlRequestId?: string;
  ruleId: string;
  severity: DiagnosticSeverity;
  confidence: DiagnosticConfidence;
  pageUrl: string;
  route?: string;
  source: DiagnosticSource;
  title: string;
  evidence: string;
  expected?: string;
  actual?: string;
  sourceLocation?: DiagnosticSourceLocation;
  structuredEvidence?: readonly DiagnosticStructuredEvidence[];
  observedAt: string;
  fingerprint: string;
  retentionUntil?: string;
  deletionState: "active" | "deleting" | "deleted";
  createdAt: string;
};

export type CrawlRequest = {
  id: string;
  organizationId: string;
  projectId: string;
  environmentId: string;
  requestedBy: string;
  maxUrls: number;
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  failedAt?: string;
  lastError?: string;
  artifactUri?: string;
};

export type CrawlJobPayload = {
  crawlRequestId: string;
  organizationId: string;
  projectId: string;
  environmentId: string;
  maxUrls: number;
};

export type CloudOutboxTopic = "crawl.requested";

export type CloudOutboxStatus =
  | "pending"
  | "processing"
  | "published"
  | "failed";

export type CloudOutboxEvent = {
  id: string;
  organizationId: string;
  topic: CloudOutboxTopic;
  payload: CrawlJobPayload;
  status: CloudOutboxStatus;
  attempts: number;
  createdAt: string;
  availableAt: string;
  lockedAt?: string;
  publishedAt?: string;
  lastError?: string;
};

export type PlanTier = "starter" | "team" | "agency" | "enterprise";

export type EntitlementStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "cancelled"
  | "expired";

export type OrganizationEntitlement = {
  id: string;
  organizationId: string;
  planTier: PlanTier;
  status: EntitlementStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  crawlMaxUrlsPerRun: number;
  monthlyCrawledUrlsLimit: number;
  externalApiMonthlyLimit: number;
  reportRetentionDays: number;
  source: "stripe" | "manual";
  createdAt: string;
};

export type StripeBillingIdentity = {
  id: string;
  organizationId: string;
  stripeCustomerId: string;
  stripeSubscriptionId?: string;
  planTier: PlanTier;
  active: boolean;
  createdAt: string;
};

export type StripeWebhookProcessedEvent = {
  id: string;
  organizationId: string;
  stripeEventId: string;
  stripeEventType: string;
  intentKind: "subscription-entitlement-update" | "payment-signal";
  processedAt: string;
};

export type StripeWebhookApplyResult =
  | {
      status: "applied";
      organizationId: string;
      stripeEventId: string;
    }
  | {
      status: "duplicate";
      organizationId: string;
      stripeEventId: string;
    }
  | {
      status: "ignored";
      reason: string;
      stripeEventId: string;
    };

export type UsageCounter = {
  id: string;
  organizationId: string;
  counterName: "crawl.urls" | "external_api.inspections";
  periodStart: string;
  periodEnd: string;
  used: number;
  createdAt: string;
};

export type BillableUsageCounterName = UsageCounter["counterName"];

export type BillableUsageEvent = {
  id: string;
  organizationId: string;
  counterName: BillableUsageCounterName;
  idempotencyKey: string;
  amount: number;
  periodStart: string;
  periodEnd: string;
  occurredAt: string;
  source: "crawl.requested" | "external_api.inspection";
  subjectType: string;
  subjectId: string;
};

export type ReportArtifactKind =
  | "html"
  | "pdf"
  | "executive"
  | "developer"
  | "agency";

export type ReportArtifact = {
  id: string;
  organizationId: string;
  projectId: string;
  environmentId: string;
  reportKind: ReportArtifactKind;
  artifactUri?: string;
  pinned: boolean;
  generatedAt: string;
  retentionUntil?: string;
  deletionState: "active" | "deleting" | "deleted";
  createdAt: string;
};

export type ExternalObservationProvider = "google" | "yandex";

export type ExternalObservationFreshness =
  | "fresh"
  | "stale"
  | "expired"
  | "unknown";

export type ExternalObservationSource =
  | "google.searchConsole"
  | "google.urlInspection"
  | "google.searchAnalytics"
  | "google.sitemap"
  | "google.pagespeed"
  | "google.crux"
  | "yandex.webmaster"
  | "yandex.metrica";

export type ExternalObservationPayload = Readonly<Record<string, unknown>>;

export type ExternalObservationQuota = {
  limit?: number;
  remaining?: number;
  resetAt?: string;
};

export type ExternalObservationSampling = {
  sampled: boolean;
  state?: string;
};

export type ExternalObservationRecord = {
  id: string;
  organizationId: string;
  projectId: string;
  environmentId: string;
  provider: ExternalObservationProvider;
  source: ExternalObservationSource;
  subjectUrl: string;
  observedAt: string;
  fetchedAt: string;
  freshness: ExternalObservationFreshness;
  payload: ExternalObservationPayload;
  quota?: ExternalObservationQuota;
  sampling?: ExternalObservationSampling;
  fingerprint: string;
  retentionUntil?: string;
  deletionState: "active" | "deleting" | "deleted";
  createdAt: string;
};

export type NotificationChannelKind =
  | "email"
  | "slack"
  | "webhook"
  | "telegram";

export type NotificationChannelTarget = {
  display: string;
  secretRef?: string;
};

export type NotificationChannel = {
  id: string;
  organizationId: string;
  projectId: string;
  environmentId: string;
  kind: NotificationChannelKind;
  name: string;
  target: NotificationChannelTarget;
  enabled: boolean;
  createdAt: string;
};

export type NotificationEventKind =
  | "diagnostic.created"
  | "crawl.completed"
  | "deployment.correlated"
  | "external_observation.stale"
  | "quota.exhausted"
  | "report.generated"
  | "billing.action_required";

export type NotificationRule = {
  id: string;
  organizationId: string;
  projectId: string;
  environmentId: string;
  name: string;
  eventKinds: readonly NotificationEventKind[];
  channelIds: readonly string[];
  severityThreshold?: DiagnosticSeverity;
  digest: "immediate" | "daily" | "weekly";
  mutedUntil?: string;
  snoozedUntil?: string;
  enabled: boolean;
  createdAt: string;
};

export type NotificationEvent = {
  id: string;
  organizationId: string;
  projectId: string;
  environmentId: string;
  kind: NotificationEventKind;
  occurredAt: string;
  severity?: DiagnosticSeverity;
  subject: string;
  summary: string;
  evidence: string;
};

export type NotificationDeliveryTask = {
  id: string;
  organizationId: string;
  projectId: string;
  environmentId: string;
  ruleId: string;
  channelId: string;
  channelKind: NotificationChannelKind;
  targetDisplay: string;
  digest: NotificationRule["digest"];
  eventIds: readonly string[];
  scheduledFor: string;
  subject: string;
  body: string;
};

export type NotificationDeliveryStatus =
  | "pending"
  | "delivered"
  | "failed"
  | "retry_scheduled"
  | "suppressed";

export type NotificationDeliveryAttempt = {
  id: string;
  taskId: string;
  organizationId: string;
  channelId: string;
  channelKind: NotificationChannelKind;
  status: NotificationDeliveryStatus;
  attemptedAt: string;
  attempt: number;
  failureReason?: string;
  nextRetryAt?: string;
};

export type OAuthConnectionStatus = "active" | "expired" | "revoked" | "error";

export type OAuthConnectionRecord = {
  id: string;
  organizationId: string;
  projectId: string;
  environmentId: string;
  provider: ExternalObservationProvider;
  providerAccountId: string;
  scopes: readonly string[];
  accessTokenSecretRef?: string;
  refreshTokenSecretRef: string;
  expiresAt?: string;
  lastRefreshAt?: string;
  lastError?: string;
  status: OAuthConnectionStatus;
  retentionUntil?: string;
  deletionState: "active" | "deleting" | "deleted";
  createdAt: string;
};

export type BillableUsageIntent = {
  counterName: BillableUsageCounterName;
  amount: number;
  periodStart: string;
  periodEnd: string;
};

export type EntitlementDecision =
  | {
      allowed: true;
      billableUsage?: BillableUsageIntent;
    }
  | {
      allowed: false;
      reason: string;
    };

export type AuditAction =
  | "organization.created"
  | "member.added"
  | "member.removed"
  | "ownership.transferred"
  | "project.created"
  | "environment.created"
  | "crawl.requested"
  | "diagnostics.ingested"
  | "oauth_connection.completed"
  | "oauth_connection.revoked";

export type AuditEvent = {
  id: string;
  organizationId: string;
  actorPrincipalId: string;
  action: AuditAction;
  targetType: string;
  targetId: string;
  occurredAt: string;
};

export type MetricEvent = {
  id: string;
  organizationId: string;
  name: string;
  value: number;
  occurredAt: string;
  dimensions: Readonly<Record<string, string>>;
};

export type CloudApiErrorCode =
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "ENTITLEMENT_DENIED"
  | "INVALID_INPUT";

export class CloudApiError extends Error {
  readonly code: CloudApiErrorCode;

  constructor(code: CloudApiErrorCode, message: string) {
    super(message);
    this.name = "CloudApiError";
    this.code = code;
  }
}
