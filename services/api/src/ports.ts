import type {
  AuditEvent,
  BillableUsageEvent,
  CloudOutboxEvent,
  CrawlJobPayload,
  CrawlRequest,
  DashboardSnapshotPayload,
  DiagnosticRecord,
  EntitlementDecision,
  Environment,
  ExternalObservationProvider,
  ExternalObservationRecord,
  MetricEvent,
  OAuthConnectionRecord,
  Organization,
  OrganizationMembership,
  Project,
  ReportArtifact,
  StripeWebhookApplyResult
} from "./types.js";
import type { StripeWebhookNormalizedEvent } from "./stripe-webhook.js";

export type RelationalStore = {
  createOrganization(input: Organization): Promise<Organization>;
  createMembership(
    input: OrganizationMembership
  ): Promise<OrganizationMembership>;
  getMembership(
    organizationId: string,
    principalId: string
  ): Promise<OrganizationMembership | undefined>;
  updateMembershipRole(input: {
    organizationId: string;
    principalId: string;
    role: OrganizationMembership["role"];
  }): Promise<OrganizationMembership | undefined>;
  removeMembership(input: {
    organizationId: string;
    principalId: string;
  }): Promise<OrganizationMembership | undefined>;
  createProject(input: Project): Promise<Project>;
  getProject(
    organizationId: string,
    projectId: string
  ): Promise<Project | undefined>;
  createEnvironment(input: Environment): Promise<Environment>;
  getEnvironment(
    organizationId: string,
    environmentId: string
  ): Promise<Environment | undefined>;
  createCrawlRequest(input: CrawlRequest): Promise<CrawlRequest>;
  getCrawlRequest(
    organizationId: string,
    crawlRequestId: string
  ): Promise<CrawlRequest | undefined>;
};

export type JobQueue = {
  enqueueCrawl(payload: CrawlJobPayload): Promise<{ jobId: string }>;
};

export type EntitlementStore = {
  canStartCrawl(input: {
    organizationId: string;
    projectId: string;
    environmentId: string;
    maxUrls: number;
  }): Promise<EntitlementDecision>;
  canUseExternalApiInspection(input: {
    organizationId: string;
    provider: "google" | "yandex";
    inspections: number;
  }): Promise<EntitlementDecision>;
};

export type AuditLog = {
  append(event: AuditEvent): Promise<void>;
};

export type MetricsStore = {
  record(event: MetricEvent): Promise<void>;
};

export type DashboardSnapshotStore = {
  getDashboardSnapshot(input: {
    organizationId: string;
    projectId: string;
    environmentId: string;
  }): Promise<DashboardSnapshotPayload | undefined>;
};

export type DiagnosticStore = {
  upsertDiagnostic(input: DiagnosticRecord): Promise<DiagnosticRecord>;
};

export type ExternalObservationStore = {
  upsertExternalObservation(
    input: ExternalObservationRecord
  ): Promise<ExternalObservationRecord>;
  selectExternalObservations(input: {
    organizationId: string;
    projectId: string;
    environmentId: string;
    provider?: ExternalObservationProvider;
    limit: number;
  }): Promise<readonly ExternalObservationRecord[]>;
};

export type OAuthConnectionStore = {
  upsertOAuthConnection(
    input: OAuthConnectionRecord
  ): Promise<OAuthConnectionRecord>;
  getOAuthConnection(input: {
    organizationId: string;
    projectId: string;
    environmentId: string;
    provider: ExternalObservationProvider;
  }): Promise<OAuthConnectionRecord | undefined>;
  selectOAuthConnectionsDueForRefresh(input: {
    now: string;
    provider?: ExternalObservationProvider;
    limit: number;
  }): Promise<readonly OAuthConnectionRecord[]>;
  markOAuthConnectionRevoked(input: {
    organizationId: string;
    id: string;
  }): Promise<OAuthConnectionRecord | undefined>;
};

export type ExternalProviderOAuthTokenExchangeResult = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
  scopes?: readonly string[];
};

export type ExternalProviderOAuthTokenExchanger = {
  exchangeAuthorizationCode(input: {
    organizationId: string;
    projectId: string;
    environmentId: string;
    provider: ExternalObservationProvider;
    code: string;
    redirectUri: string;
    codeVerifier?: string;
    signal?: AbortSignal;
  }): Promise<ExternalProviderOAuthTokenExchangeResult>;
};

export type ExternalProviderOAuthAuthorizationUrlBuilder = {
  buildAuthorizationUrl(input: {
    organizationId: string;
    projectId: string;
    environmentId: string;
    provider: ExternalObservationProvider;
    state: string;
    redirectUri?: string;
    scopes?: readonly string[];
    pkce?: {
      codeChallenge: string;
      method: "S256";
    };
  }): Promise<{
    provider: ExternalObservationProvider;
    authorizationUrl: string;
    state: string;
    redirectUri: string;
    scopes: readonly string[];
    pkceRequired: boolean;
  }>;
};

export type ExternalProviderAccountResolver = {
  resolveProviderAccountId(input: {
    organizationId: string;
    projectId: string;
    environmentId: string;
    provider: ExternalObservationProvider;
    accessToken: string;
    signal?: AbortSignal;
  }): Promise<{ providerAccountId: string }>;
};

export type UsageMeter = {
  record(event: BillableUsageEvent): Promise<void>;
};

export type ReportRetentionStore = {
  insertReportArtifact(input: ReportArtifact): Promise<ReportArtifact>;
  selectExpiredReportArtifacts(input: {
    now: string;
    limit: number;
  }): Promise<readonly ReportArtifact[]>;
  markReportArtifactDeleting(input: {
    organizationId: string;
    id: string;
  }): Promise<ReportArtifact | undefined>;
  markReportArtifactDeleted(input: {
    organizationId: string;
    id: string;
  }): Promise<ReportArtifact | undefined>;
  markReportArtifactDeletionFailed(input: {
    organizationId: string;
    id: string;
  }): Promise<ReportArtifact | undefined>;
};

export type StripeWebhookStore = {
  apply(event: StripeWebhookNormalizedEvent): Promise<StripeWebhookApplyResult>;
};

export type OutboxStore = {
  append(event: CloudOutboxEvent): Promise<CloudOutboxEvent>;
};

export type CloudTransactionDependencies = {
  store: RelationalStore;
  auditLog: AuditLog;
  metrics: MetricsStore;
  diagnostics?: DiagnosticStore;
  usageMeter?: UsageMeter;
  outbox?: OutboxStore;
  oauthConnections?: OAuthConnectionStore;
};

export type CloudTransactionManager = {
  transaction<T>(
    operation: (dependencies: CloudTransactionDependencies) => Promise<T>
  ): Promise<T>;
};

export type ArtifactStore = {
  put(input: {
    organizationId: string;
    key: string;
    body: string;
  }): Promise<{ artifactUri: string }>;
};

export type SecretVault = {
  putSecret(input: {
    organizationId: string;
    key: string;
    value: string;
  }): Promise<{ secretRef: string }>;
  deleteSecret(input: {
    organizationId: string;
    secretRef: string;
  }): Promise<void>;
};
