import { roleHasPermission } from "./rbac.js";
import type {
  AuditEvent,
  CloudPermission,
  CloudOutboxEvent,
  CrawlRequest,
  DashboardSnapshotPayload,
  DiagnosticConfidence,
  DiagnosticRecord,
  DiagnosticSeverity,
  DiagnosticSource,
  DiagnosticSourceLocation,
  DiagnosticStructuredEvidence,
  Environment,
  ExternalObservationProvider,
  MetricEvent,
  OAuthConnectionRecord,
  Organization,
  OrganizationMembership,
  Principal,
  Project
} from "./types.js";
import { CloudApiError } from "./types.js";
import type {
  AuditLog,
  CloudTransactionDependencies,
  CloudTransactionManager,
  DashboardSnapshotStore,
  DiagnosticStore,
  EntitlementStore,
  ExternalProviderAccountResolver,
  ExternalProviderOAuthAuthorizationUrlBuilder,
  ExternalProviderOAuthTokenExchanger,
  JobQueue,
  MetricsStore,
  OAuthConnectionStore,
  OutboxStore,
  RelationalStore,
  SecretVault,
  UsageMeter
} from "./ports.js";

export type Clock = {
  now(): string;
};

export type IdGenerator = {
  nextId(prefix: string): string;
};

export type CloudRequestContext = {
  signal?: AbortSignal;
};

export type CloudApiDependencies = {
  store: RelationalStore;
  queue: JobQueue;
  entitlements: EntitlementStore;
  auditLog: AuditLog;
  metrics: MetricsStore;
  dashboardSnapshots?: DashboardSnapshotStore;
  diagnostics?: DiagnosticStore;
  oauthConnections?: OAuthConnectionStore;
  secretVault?: SecretVault;
  externalProviderOAuthAuthorizationUrlBuilder?: ExternalProviderOAuthAuthorizationUrlBuilder;
  externalProviderOAuthTokenExchanger?: ExternalProviderOAuthTokenExchanger;
  externalProviderAccountResolver?: ExternalProviderAccountResolver;
  usageMeter?: UsageMeter;
  outbox?: OutboxStore;
  transactionManager?: CloudTransactionManager;
  clock: Clock;
  ids: IdGenerator;
};

export type CreateOrganizationInput = CloudRequestContext & {
  actor: Principal;
  name: string;
};

export type AddMemberInput = CloudRequestContext & {
  actor: Principal;
  organizationId: string;
  principalId: string;
  role: OrganizationMembership["role"];
};

export type RemoveMemberInput = CloudRequestContext & {
  actor: Principal;
  organizationId: string;
  principalId: string;
};

export type TransferOwnershipInput = CloudRequestContext & {
  actor: Principal;
  organizationId: string;
  newOwnerPrincipalId: string;
};

export type CreateProjectInput = CloudRequestContext & {
  actor: Principal;
  organizationId: string;
  name: string;
  siteUrl: string;
};

export type CreateEnvironmentInput = CloudRequestContext & {
  actor: Principal;
  organizationId: string;
  projectId: string;
  name: string;
  baseUrl: string;
};

export type RequestCrawlInput = CloudRequestContext & {
  actor: Principal;
  organizationId: string;
  projectId: string;
  environmentId: string;
  maxUrls: number;
};

export type GetDashboardSnapshotInput = CloudRequestContext & {
  actor: Principal;
  organizationId: string;
  projectId: string;
  environmentId: string;
};

export type RecordExternalApiInspectionUsageInput = CloudRequestContext & {
  actor: Principal;
  organizationId: string;
  provider: "google" | "yandex";
  inspections: number;
  idempotencyKey: string;
  subjectId: string;
};

export type CrawlDiagnosticIngestionItem = {
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
};

export type RecordCrawlDiagnosticsInput = CloudRequestContext & {
  actor: Principal;
  organizationId: string;
  projectId: string;
  environmentId: string;
  crawlRequestId: string;
  diagnostics: readonly CrawlDiagnosticIngestionItem[];
};

export type CompleteExternalProviderOAuthConnectionInput =
  CloudRequestContext & {
    actor: Principal;
    organizationId: string;
    projectId: string;
    environmentId: string;
    provider: ExternalObservationProvider;
    code: string;
    redirectUri: string;
    codeVerifier?: string;
    scopes?: readonly string[];
  };

export type RevokeExternalProviderOAuthConnectionInput = CloudRequestContext & {
  actor: Principal;
  organizationId: string;
  projectId: string;
  environmentId: string;
  provider: ExternalObservationProvider;
};

export type StartExternalProviderOAuthConnectionInput = CloudRequestContext & {
  actor: Principal;
  organizationId: string;
  projectId: string;
  environmentId: string;
  provider: ExternalObservationProvider;
  state: string;
  redirectUri?: string;
  scopes?: readonly string[];
  codeChallenge?: string;
};

export function createCloudApi(dependencies: CloudApiDependencies): {
  createOrganization(input: CreateOrganizationInput): Promise<{
    organization: Organization;
    membership: OrganizationMembership;
  }>;
  addMember(input: AddMemberInput): Promise<OrganizationMembership>;
  removeMember(input: RemoveMemberInput): Promise<OrganizationMembership>;
  transferOwnership(input: TransferOwnershipInput): Promise<{
    previousOwner: OrganizationMembership;
    newOwner: OrganizationMembership;
  }>;
  createProject(input: CreateProjectInput): Promise<Project>;
  createEnvironment(input: CreateEnvironmentInput): Promise<Environment>;
  requestCrawl(input: RequestCrawlInput): Promise<{
    crawlRequest: CrawlRequest;
    jobId: string;
  }>;
  getDashboardSnapshot(
    input: GetDashboardSnapshotInput
  ): Promise<DashboardSnapshotPayload>;
  recordExternalApiInspectionUsage(
    input: RecordExternalApiInspectionUsageInput
  ): Promise<{ recorded: true; idempotencyKey: string }>;
  recordCrawlDiagnostics(
    input: RecordCrawlDiagnosticsInput
  ): Promise<{ recorded: number; crawlRequestId: string }>;
  completeExternalProviderOAuthConnection(
    input: CompleteExternalProviderOAuthConnectionInput
  ): Promise<{ oauthConnection: OAuthConnectionRecord }>;
  revokeExternalProviderOAuthConnection(
    input: RevokeExternalProviderOAuthConnectionInput
  ): Promise<{ oauthConnection: OAuthConnectionRecord }>;
  startExternalProviderOAuthConnection(
    input: StartExternalProviderOAuthConnectionInput
  ): Promise<{
    provider: ExternalObservationProvider;
    authorizationUrl: string;
    state: string;
    redirectUri: string;
    scopes: readonly string[];
    pkceRequired: boolean;
  }>;
} {
  return {
    async createOrganization(input) {
      const organization: Organization = {
        id: dependencies.ids.nextId("org"),
        name: input.name,
        createdAt: dependencies.clock.now()
      };
      const membership: OrganizationMembership = {
        id: dependencies.ids.nextId("membership"),
        organizationId: organization.id,
        principalId: input.actor.id,
        role: "owner",
        createdAt: organization.createdAt
      };

      return writeTransaction(dependencies, async (transaction) => {
        const createdOrganization =
          await transaction.store.createOrganization(organization);
        const createdMembership =
          await transaction.store.createMembership(membership);
        await audit(dependencies, transaction, {
          organizationId: organization.id,
          actorPrincipalId: input.actor.id,
          action: "organization.created",
          targetType: "organization",
          targetId: organization.id
        });

        return {
          organization: createdOrganization,
          membership: createdMembership
        };
      });
    },

    async addMember(input) {
      await requirePermission(
        dependencies,
        input.organizationId,
        input.actor,
        "member:manage"
      );
      return writeTransaction(dependencies, async (transaction) => {
        const membership = await transaction.store.createMembership({
          id: dependencies.ids.nextId("membership"),
          organizationId: input.organizationId,
          principalId: input.principalId,
          role: input.role,
          createdAt: dependencies.clock.now()
        });
        await audit(dependencies, transaction, {
          organizationId: input.organizationId,
          actorPrincipalId: input.actor.id,
          action: "member.added",
          targetType: "principal",
          targetId: input.principalId
        });
        return membership;
      });
    },

    async removeMember(input) {
      await requirePermission(
        dependencies,
        input.organizationId,
        input.actor,
        "member:manage"
      );
      if (input.principalId === input.actor.id) {
        throw new CloudApiError(
          "INVALID_INPUT",
          "Members cannot remove their own membership."
        );
      }
      const targetMembership = await dependencies.store.getMembership(
        input.organizationId,
        input.principalId
      );
      if (!targetMembership) {
        throw new CloudApiError("NOT_FOUND", "Membership was not found.");
      }
      if (targetMembership.role === "owner") {
        throw new CloudApiError(
          "INVALID_INPUT",
          "Organization ownership must be transferred before removing an owner."
        );
      }

      return writeTransaction(dependencies, async (transaction) => {
        const removed = await transaction.store.removeMembership({
          organizationId: input.organizationId,
          principalId: input.principalId
        });
        if (!removed) {
          throw new CloudApiError("NOT_FOUND", "Membership was not found.");
        }
        await audit(dependencies, transaction, {
          organizationId: input.organizationId,
          actorPrincipalId: input.actor.id,
          action: "member.removed",
          targetType: "principal",
          targetId: input.principalId
        });
        return removed;
      });
    },

    async transferOwnership(input) {
      await requirePermission(
        dependencies,
        input.organizationId,
        input.actor,
        "organization:manage"
      );
      if (input.newOwnerPrincipalId === input.actor.id) {
        throw new CloudApiError(
          "INVALID_INPUT",
          "New owner must be a different organization member."
        );
      }
      const currentOwnerMembership = await dependencies.store.getMembership(
        input.organizationId,
        input.actor.id
      );
      if (!currentOwnerMembership || currentOwnerMembership.role !== "owner") {
        throw new CloudApiError(
          "FORBIDDEN",
          "Only the current organization owner can transfer ownership."
        );
      }
      const targetMembership = await dependencies.store.getMembership(
        input.organizationId,
        input.newOwnerPrincipalId
      );
      if (!targetMembership) {
        throw new CloudApiError("NOT_FOUND", "Membership was not found.");
      }

      return writeTransaction(dependencies, async (transaction) => {
        const previousOwner = await transaction.store.updateMembershipRole({
          organizationId: input.organizationId,
          principalId: input.actor.id,
          role: "admin"
        });
        const newOwner = await transaction.store.updateMembershipRole({
          organizationId: input.organizationId,
          principalId: input.newOwnerPrincipalId,
          role: "owner"
        });
        if (!previousOwner || !newOwner) {
          throw new CloudApiError("NOT_FOUND", "Membership was not found.");
        }
        await audit(dependencies, transaction, {
          organizationId: input.organizationId,
          actorPrincipalId: input.actor.id,
          action: "ownership.transferred",
          targetType: "principal",
          targetId: input.newOwnerPrincipalId
        });
        return {
          previousOwner,
          newOwner
        };
      });
    },

    async createProject(input) {
      await requirePermission(
        dependencies,
        input.organizationId,
        input.actor,
        "project:create"
      );
      return writeTransaction(dependencies, async (transaction) => {
        const project = await transaction.store.createProject({
          id: dependencies.ids.nextId("project"),
          organizationId: input.organizationId,
          name: input.name,
          siteUrl: input.siteUrl,
          createdAt: dependencies.clock.now()
        });
        await audit(dependencies, transaction, {
          organizationId: input.organizationId,
          actorPrincipalId: input.actor.id,
          action: "project.created",
          targetType: "project",
          targetId: project.id
        });
        return project;
      });
    },

    async createEnvironment(input) {
      await requirePermission(
        dependencies,
        input.organizationId,
        input.actor,
        "environment:create"
      );
      const project = await dependencies.store.getProject(
        input.organizationId,
        input.projectId
      );
      if (!project) {
        throw new CloudApiError("NOT_FOUND", "Project was not found.");
      }
      return writeTransaction(dependencies, async (transaction) => {
        const environment = await transaction.store.createEnvironment({
          id: dependencies.ids.nextId("env"),
          organizationId: input.organizationId,
          projectId: input.projectId,
          name: input.name,
          baseUrl: input.baseUrl,
          createdAt: dependencies.clock.now()
        });
        await audit(dependencies, transaction, {
          organizationId: input.organizationId,
          actorPrincipalId: input.actor.id,
          action: "environment.created",
          targetType: "environment",
          targetId: environment.id
        });
        return environment;
      });
    },

    async requestCrawl(input) {
      if (!Number.isInteger(input.maxUrls) || input.maxUrls < 1) {
        throw new CloudApiError(
          "INVALID_INPUT",
          "maxUrls must be a positive integer."
        );
      }
      await requirePermission(
        dependencies,
        input.organizationId,
        input.actor,
        "crawl:create"
      );
      const project = await dependencies.store.getProject(
        input.organizationId,
        input.projectId
      );
      if (!project) {
        throw new CloudApiError("NOT_FOUND", "Project was not found.");
      }
      const environment = await dependencies.store.getEnvironment(
        input.organizationId,
        input.environmentId
      );
      if (!environment || environment.projectId !== project.id) {
        throw new CloudApiError("NOT_FOUND", "Environment was not found.");
      }
      const entitlement = await dependencies.entitlements.canStartCrawl({
        organizationId: input.organizationId,
        projectId: input.projectId,
        environmentId: input.environmentId,
        maxUrls: input.maxUrls
      });
      if (!entitlement.allowed) {
        throw new CloudApiError("ENTITLEMENT_DENIED", entitlement.reason);
      }

      const crawlRequest = await writeTransaction(
        dependencies,
        async (transaction) => {
          const createdCrawlRequest =
            await transaction.store.createCrawlRequest({
              id: dependencies.ids.nextId("crawl"),
              organizationId: input.organizationId,
              projectId: input.projectId,
              environmentId: input.environmentId,
              requestedBy: input.actor.id,
              maxUrls: input.maxUrls,
              status: "queued",
              createdAt: dependencies.clock.now()
            });
          await audit(dependencies, transaction, {
            organizationId: input.organizationId,
            actorPrincipalId: input.actor.id,
            action: "crawl.requested",
            targetType: "crawlRequest",
            targetId: createdCrawlRequest.id
          });
          await metric(dependencies, transaction, {
            organizationId: input.organizationId,
            name: "crawl.requested",
            value: 1,
            dimensions: {
              projectId: input.projectId,
              environmentId: input.environmentId
            }
          });
          const outboxEvent = transaction.outbox
            ? await transaction.outbox.append({
                id: dependencies.ids.nextId("outbox"),
                organizationId: input.organizationId,
                topic: "crawl.requested",
                payload: crawlJobPayload(createdCrawlRequest),
                status: "pending",
                attempts: 0,
                createdAt: createdCrawlRequest.createdAt,
                availableAt: createdCrawlRequest.createdAt
              })
            : undefined;
          if (entitlement.billableUsage && transaction.usageMeter) {
            await transaction.usageMeter.record({
              id: dependencies.ids.nextId("usage"),
              organizationId: input.organizationId,
              counterName: entitlement.billableUsage.counterName,
              idempotencyKey: createdCrawlRequest.id,
              amount: entitlement.billableUsage.amount,
              periodStart: entitlement.billableUsage.periodStart,
              periodEnd: entitlement.billableUsage.periodEnd,
              occurredAt: createdCrawlRequest.createdAt,
              source: "crawl.requested",
              subjectType: "crawlRequest",
              subjectId: createdCrawlRequest.id
            });
          }
          return {
            crawlRequest: createdCrawlRequest,
            outboxEvent
          };
        }
      );
      if (crawlRequest.outboxEvent) {
        return {
          crawlRequest: crawlRequest.crawlRequest,
          jobId: crawlRequest.outboxEvent.id
        };
      }

      const queued = await dependencies.queue.enqueueCrawl(
        crawlJobPayload(crawlRequest.crawlRequest)
      );

      return { crawlRequest: crawlRequest.crawlRequest, jobId: queued.jobId };
    },

    async getDashboardSnapshot(input) {
      await requirePermission(
        dependencies,
        input.organizationId,
        input.actor,
        "project:read"
      );
      const project = await dependencies.store.getProject(
        input.organizationId,
        input.projectId
      );
      if (!project) {
        throw new CloudApiError("NOT_FOUND", "Project was not found.");
      }
      const environment = await dependencies.store.getEnvironment(
        input.organizationId,
        input.environmentId
      );
      if (!environment || environment.projectId !== project.id) {
        throw new CloudApiError("NOT_FOUND", "Environment was not found.");
      }
      if (!dependencies.dashboardSnapshots) {
        throw new CloudApiError(
          "INVALID_INPUT",
          "Dashboard snapshot store is not configured."
        );
      }
      const snapshot =
        await dependencies.dashboardSnapshots.getDashboardSnapshot({
          organizationId: input.organizationId,
          projectId: input.projectId,
          environmentId: input.environmentId
        });
      if (!snapshot) {
        throw new CloudApiError(
          "NOT_FOUND",
          "Dashboard snapshot was not found."
        );
      }
      return snapshot;
    },

    async recordExternalApiInspectionUsage(input) {
      if (!Number.isInteger(input.inspections) || input.inspections < 1) {
        throw new CloudApiError(
          "INVALID_INPUT",
          "inspections must be a positive integer."
        );
      }
      if (input.idempotencyKey.trim().length === 0) {
        throw new CloudApiError(
          "INVALID_INPUT",
          "idempotencyKey must be a non-empty string."
        );
      }
      if (input.subjectId.trim().length === 0) {
        throw new CloudApiError(
          "INVALID_INPUT",
          "subjectId must be a non-empty string."
        );
      }
      await requirePermission(
        dependencies,
        input.organizationId,
        input.actor,
        "connector:manage"
      );

      const entitlement =
        await dependencies.entitlements.canUseExternalApiInspection({
          organizationId: input.organizationId,
          provider: input.provider,
          inspections: input.inspections
        });
      if (!entitlement.allowed) {
        throw new CloudApiError("ENTITLEMENT_DENIED", entitlement.reason);
      }

      const occurredAt = dependencies.clock.now();
      await writeTransaction(dependencies, async (transaction) => {
        if (entitlement.billableUsage && transaction.usageMeter) {
          await transaction.usageMeter.record({
            id: dependencies.ids.nextId("usage"),
            organizationId: input.organizationId,
            counterName: entitlement.billableUsage.counterName,
            idempotencyKey: input.idempotencyKey,
            amount: entitlement.billableUsage.amount,
            periodStart: entitlement.billableUsage.periodStart,
            periodEnd: entitlement.billableUsage.periodEnd,
            occurredAt,
            source: "external_api.inspection",
            subjectType: `${input.provider}.externalApiInspection`,
            subjectId: input.subjectId
          });
        }
        await metric(dependencies, transaction, {
          organizationId: input.organizationId,
          name: "external_api.inspection.recorded",
          value: input.inspections,
          dimensions: {
            provider: input.provider,
            subjectId: input.subjectId
          }
        });
      });

      return {
        recorded: true,
        idempotencyKey: input.idempotencyKey
      };
    },

    async recordCrawlDiagnostics(input) {
      await requirePermission(
        dependencies,
        input.organizationId,
        input.actor,
        "diagnostic:write"
      );
      if (!dependencies.diagnostics) {
        throw new CloudApiError(
          "INVALID_INPUT",
          "Diagnostic store is not configured."
        );
      }
      const project = await dependencies.store.getProject(
        input.organizationId,
        input.projectId
      );
      if (!project) {
        throw new CloudApiError("NOT_FOUND", "Project was not found.");
      }
      const environment = await dependencies.store.getEnvironment(
        input.organizationId,
        input.environmentId
      );
      if (!environment || environment.projectId !== project.id) {
        throw new CloudApiError("NOT_FOUND", "Environment was not found.");
      }
      const crawlRequest = await dependencies.store.getCrawlRequest(
        input.organizationId,
        input.crawlRequestId
      );
      if (
        !crawlRequest ||
        crawlRequest.projectId !== project.id ||
        crawlRequest.environmentId !== environment.id
      ) {
        throw new CloudApiError("NOT_FOUND", "Crawl request was not found.");
      }

      const createdAt = dependencies.clock.now();
      const diagnostics = input.diagnostics.map((diagnostic, index) =>
        diagnosticRecordFromInput(
          dependencies,
          input,
          diagnostic,
          index,
          createdAt
        )
      );
      if (diagnostics.length === 0) {
        return { recorded: 0, crawlRequestId: input.crawlRequestId };
      }

      await writeTransaction(dependencies, async (transaction) => {
        if (!transaction.diagnostics) {
          throw new CloudApiError(
            "INVALID_INPUT",
            "Diagnostic store is not configured."
          );
        }
        for (const diagnostic of diagnostics) {
          await transaction.diagnostics.upsertDiagnostic(diagnostic);
        }
        await audit(dependencies, transaction, {
          organizationId: input.organizationId,
          actorPrincipalId: input.actor.id,
          action: "diagnostics.ingested",
          targetType: "crawlRequest",
          targetId: input.crawlRequestId
        });
        await metric(dependencies, transaction, {
          organizationId: input.organizationId,
          name: "diagnostics.ingested",
          value: diagnostics.length,
          dimensions: {
            projectId: input.projectId,
            environmentId: input.environmentId,
            crawlRequestId: input.crawlRequestId
          }
        });
      });

      return {
        recorded: diagnostics.length,
        crawlRequestId: input.crawlRequestId
      };
    },

    async completeExternalProviderOAuthConnection(input) {
      await requirePermission(
        dependencies,
        input.organizationId,
        input.actor,
        "connector:manage"
      );
      const oauthConnections = requiredDependency(
        dependencies.oauthConnections,
        "OAuth connection store is not configured."
      );
      const secretVault = requiredDependency(
        dependencies.secretVault,
        "Secret vault is not configured."
      );
      const tokenExchanger = requiredDependency(
        dependencies.externalProviderOAuthTokenExchanger,
        "External provider OAuth token exchanger is not configured."
      );
      const accountResolver = requiredDependency(
        dependencies.externalProviderAccountResolver,
        "External provider account resolver is not configured."
      );
      const project = await dependencies.store.getProject(
        input.organizationId,
        input.projectId
      );
      if (!project) {
        throw new CloudApiError("NOT_FOUND", "Project was not found.");
      }
      const environment = await dependencies.store.getEnvironment(
        input.organizationId,
        input.environmentId
      );
      if (!environment || environment.projectId !== project.id) {
        throw new CloudApiError("NOT_FOUND", "Environment was not found.");
      }
      const code = nonEmptyInput(input.code, "code");
      const redirectUri = nonEmptyInput(input.redirectUri, "redirectUri");
      const codeVerifier =
        input.codeVerifier === undefined
          ? undefined
          : nonEmptyInput(input.codeVerifier, "codeVerifier");
      const requestedScopes = input.scopes?.map((scope) =>
        nonEmptyInput(scope, "scopes")
      );

      const exchanged = await tokenExchanger.exchangeAuthorizationCode({
        organizationId: input.organizationId,
        projectId: input.projectId,
        environmentId: input.environmentId,
        provider: input.provider,
        code,
        redirectUri,
        ...(codeVerifier === undefined ? {} : { codeVerifier }),
        ...(input.signal === undefined ? {} : { signal: input.signal })
      });
      const accessToken = nonEmptyInput(exchanged.accessToken, "accessToken");
      const refreshToken = nonEmptyInput(
        exchanged.refreshToken,
        "refreshToken"
      );
      const scopes = normalizedScopes(exchanged.scopes ?? requestedScopes);
      const providerAccount = await accountResolver.resolveProviderAccountId({
        organizationId: input.organizationId,
        projectId: input.projectId,
        environmentId: input.environmentId,
        provider: input.provider,
        accessToken,
        ...(input.signal === undefined ? {} : { signal: input.signal })
      });
      const providerAccountId = nonEmptyInput(
        providerAccount.providerAccountId,
        "providerAccountId"
      );

      const now = dependencies.clock.now();
      const connectionId = dependencies.ids.nextId("oauth");
      const accessSecret = await secretVault.putSecret({
        organizationId: input.organizationId,
        key: oauthSecretKey(input, connectionId, "access-token"),
        value: accessToken
      });
      const refreshSecret = await secretVault.putSecret({
        organizationId: input.organizationId,
        key: oauthSecretKey(input, connectionId, "refresh-token"),
        value: refreshToken
      });
      const connection: OAuthConnectionRecord = {
        id: connectionId,
        organizationId: input.organizationId,
        projectId: input.projectId,
        environmentId: input.environmentId,
        provider: input.provider,
        providerAccountId,
        scopes,
        accessTokenSecretRef: accessSecret.secretRef,
        refreshTokenSecretRef: refreshSecret.secretRef,
        ...(exchanged.expiresAt === undefined
          ? {}
          : { expiresAt: exchanged.expiresAt }),
        lastRefreshAt: now,
        status: "active",
        deletionState: "active",
        createdAt: now
      };

      const oauthConnection = await writeTransaction(
        dependencies,
        async (transaction) => {
          if (!transaction.oauthConnections) {
            throw new CloudApiError(
              "INVALID_INPUT",
              "OAuth connection store is not configured."
            );
          }
          const stored =
            await transaction.oauthConnections.upsertOAuthConnection(
              connection
            );
          await audit(dependencies, transaction, {
            organizationId: input.organizationId,
            actorPrincipalId: input.actor.id,
            action: "oauth_connection.completed",
            targetType: "oauthConnection",
            targetId: stored.id
          });
          await metric(dependencies, transaction, {
            organizationId: input.organizationId,
            name: "oauth_connection.completed",
            value: 1,
            dimensions: {
              projectId: input.projectId,
              environmentId: input.environmentId,
              provider: input.provider
            }
          });
          return stored;
        }
      );

      return { oauthConnection };
    },

    async revokeExternalProviderOAuthConnection(input) {
      await requirePermission(
        dependencies,
        input.organizationId,
        input.actor,
        "connector:manage"
      );
      const oauthConnections = requiredDependency(
        dependencies.oauthConnections,
        "OAuth connection store is not configured."
      );
      const secretVault = requiredDependency(
        dependencies.secretVault,
        "Secret vault is not configured."
      );
      const project = await dependencies.store.getProject(
        input.organizationId,
        input.projectId
      );
      if (!project) {
        throw new CloudApiError("NOT_FOUND", "Project was not found.");
      }
      const environment = await dependencies.store.getEnvironment(
        input.organizationId,
        input.environmentId
      );
      if (!environment || environment.projectId !== project.id) {
        throw new CloudApiError("NOT_FOUND", "Environment was not found.");
      }

      const connection = await oauthConnections.getOAuthConnection({
        organizationId: input.organizationId,
        projectId: input.projectId,
        environmentId: input.environmentId,
        provider: input.provider
      });
      if (!connection) {
        throw new CloudApiError("NOT_FOUND", "OAuth connection was not found.");
      }

      if (connection.accessTokenSecretRef !== undefined) {
        await secretVault.deleteSecret({
          organizationId: input.organizationId,
          secretRef: connection.accessTokenSecretRef
        });
      }
      await secretVault.deleteSecret({
        organizationId: input.organizationId,
        secretRef: connection.refreshTokenSecretRef
      });

      const oauthConnection = await writeTransaction(
        dependencies,
        async (transaction) => {
          if (!transaction.oauthConnections) {
            throw new CloudApiError(
              "INVALID_INPUT",
              "OAuth connection store is not configured."
            );
          }
          const revoked =
            await transaction.oauthConnections.markOAuthConnectionRevoked({
              organizationId: input.organizationId,
              id: connection.id
            });
          if (!revoked) {
            throw new CloudApiError(
              "NOT_FOUND",
              "OAuth connection was not found."
            );
          }
          await audit(dependencies, transaction, {
            organizationId: input.organizationId,
            actorPrincipalId: input.actor.id,
            action: "oauth_connection.revoked",
            targetType: "oauthConnection",
            targetId: revoked.id
          });
          await metric(dependencies, transaction, {
            organizationId: input.organizationId,
            name: "oauth_connection.revoked",
            value: 1,
            dimensions: {
              projectId: input.projectId,
              environmentId: input.environmentId,
              provider: input.provider
            }
          });
          return revoked;
        }
      );

      return { oauthConnection };
    },

    async startExternalProviderOAuthConnection(input) {
      await requirePermission(
        dependencies,
        input.organizationId,
        input.actor,
        "connector:manage"
      );
      const authorizationUrlBuilder = requiredDependency(
        dependencies.externalProviderOAuthAuthorizationUrlBuilder,
        "External provider OAuth authorization URL builder is not configured."
      );
      const project = await dependencies.store.getProject(
        input.organizationId,
        input.projectId
      );
      if (!project) {
        throw new CloudApiError("NOT_FOUND", "Project was not found.");
      }
      const environment = await dependencies.store.getEnvironment(
        input.organizationId,
        input.environmentId
      );
      if (!environment || environment.projectId !== project.id) {
        throw new CloudApiError("NOT_FOUND", "Environment was not found.");
      }
      const state = nonEmptyInput(input.state, "state");
      const codeChallenge =
        input.codeChallenge === undefined
          ? undefined
          : nonEmptyInput(input.codeChallenge, "codeChallenge");
      const scopes = input.scopes?.map((scope) =>
        nonEmptyInput(scope, "scopes")
      );

      const result = await authorizationUrlBuilder.buildAuthorizationUrl({
        organizationId: input.organizationId,
        projectId: input.projectId,
        environmentId: input.environmentId,
        provider: input.provider,
        state,
        ...(input.redirectUri === undefined
          ? {}
          : { redirectUri: nonEmptyInput(input.redirectUri, "redirectUri") }),
        ...(scopes === undefined ? {} : { scopes }),
        ...(codeChallenge === undefined
          ? {}
          : {
              pkce: {
                codeChallenge,
                method: "S256"
              }
            })
      });

      return result;
    }
  };
}

async function requirePermission(
  dependencies: CloudApiDependencies,
  organizationId: string,
  principal: Principal,
  permission: CloudPermission
): Promise<void> {
  const membership = await dependencies.store.getMembership(
    organizationId,
    principal.id
  );
  if (!membership || !roleHasPermission(membership.role, permission)) {
    throw new CloudApiError("FORBIDDEN", `Missing permission ${permission}.`);
  }
}

async function writeTransaction<T>(
  dependencies: CloudApiDependencies,
  operation: (dependencies: CloudTransactionDependencies) => Promise<T>
): Promise<T> {
  if (dependencies.transactionManager) {
    return dependencies.transactionManager.transaction(operation);
  }
  return operation({
    store: dependencies.store,
    auditLog: dependencies.auditLog,
    metrics: dependencies.metrics,
    ...(dependencies.diagnostics
      ? { diagnostics: dependencies.diagnostics }
      : {}),
    ...(dependencies.usageMeter ? { usageMeter: dependencies.usageMeter } : {}),
    ...(dependencies.outbox ? { outbox: dependencies.outbox } : {}),
    ...(dependencies.oauthConnections
      ? { oauthConnections: dependencies.oauthConnections }
      : {})
  });
}

function requiredDependency<T>(value: T | undefined, message: string): T {
  if (value === undefined) {
    throw new CloudApiError("INVALID_INPUT", message);
  }
  return value;
}

function nonEmptyInput(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new CloudApiError(
      "INVALID_INPUT",
      `${field} must be a non-empty string.`
    );
  }
  return value;
}

function normalizedScopes(
  value: readonly string[] | undefined
): readonly string[] {
  const scopes = (value ?? []).map((scope) => nonEmptyInput(scope, "scopes"));
  if (scopes.length === 0) {
    throw new CloudApiError(
      "INVALID_INPUT",
      "scopes must include at least one scope."
    );
  }
  return [...new Set(scopes)].sort();
}

function oauthSecretKey(
  input: CompleteExternalProviderOAuthConnectionInput,
  connectionId: string,
  tokenKind: "access-token" | "refresh-token"
): string {
  return [
    input.projectId,
    input.environmentId,
    "external-providers",
    input.provider,
    connectionId,
    tokenKind
  ].join("/");
}

function diagnosticRecordFromInput(
  dependencies: CloudApiDependencies,
  input: RecordCrawlDiagnosticsInput,
  diagnostic: CrawlDiagnosticIngestionItem,
  index: number,
  createdAt: string
): DiagnosticRecord {
  validateDiagnosticIngestionItem(diagnostic, index);
  const record: DiagnosticRecord = {
    id: dependencies.ids.nextId("diagnostic"),
    organizationId: input.organizationId,
    projectId: input.projectId,
    environmentId: input.environmentId,
    crawlRequestId: input.crawlRequestId,
    ruleId: diagnostic.ruleId,
    severity: diagnostic.severity,
    confidence: diagnostic.confidence,
    pageUrl: diagnostic.pageUrl,
    source: diagnostic.source,
    title: diagnostic.title,
    evidence: diagnostic.evidence,
    observedAt: diagnostic.observedAt,
    fingerprint: diagnostic.fingerprint,
    deletionState: "active",
    createdAt
  };
  assignOptionalDiagnosticString(record, "route", diagnostic.route, index);
  assignOptionalDiagnosticString(
    record,
    "expected",
    diagnostic.expected,
    index
  );
  assignOptionalDiagnosticString(record, "actual", diagnostic.actual, index);
  if (diagnostic.sourceLocation !== undefined) {
    record.sourceLocation = diagnostic.sourceLocation;
  }
  if (diagnostic.structuredEvidence !== undefined) {
    record.structuredEvidence = diagnostic.structuredEvidence;
  }
  return record;
}

function validateDiagnosticIngestionItem(
  diagnostic: CrawlDiagnosticIngestionItem,
  index: number
): void {
  requireNonEmpty(diagnostic.ruleId, `diagnostics[${index}].ruleId`);
  requireNonEmpty(diagnostic.pageUrl, `diagnostics[${index}].pageUrl`);
  requireNonEmpty(diagnostic.title, `diagnostics[${index}].title`);
  requireNonEmpty(diagnostic.evidence, `diagnostics[${index}].evidence`);
  requireNonEmpty(diagnostic.observedAt, `diagnostics[${index}].observedAt`);
  requireNonEmpty(diagnostic.fingerprint, `diagnostics[${index}].fingerprint`);
  validateSeverity(diagnostic.severity, index);
  validateConfidence(diagnostic.confidence, index);
  validateSource(diagnostic.source, index);
  if (diagnostic.sourceLocation !== undefined) {
    validateSourceLocation(diagnostic.sourceLocation, index);
  }
  if (diagnostic.structuredEvidence !== undefined) {
    validateStructuredEvidence(diagnostic.structuredEvidence, index);
  }
}

function assignOptionalDiagnosticString(
  record: DiagnosticRecord,
  field: "route" | "expected" | "actual",
  value: string | undefined,
  index: number
): void {
  if (value === undefined) {
    return;
  }
  if (typeof value !== "string") {
    throw new CloudApiError(
      "INVALID_INPUT",
      `diagnostics[${index}].${field} must be a string when present.`
    );
  }
  record[field] = value;
}

function requireNonEmpty(value: unknown, field: string): void {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new CloudApiError(
      "INVALID_INPUT",
      `${field} must be a non-empty string.`
    );
  }
}

function validateSeverity(value: unknown, index: number): void {
  if (
    value !== "blocker" &&
    value !== "error" &&
    value !== "warning" &&
    value !== "info"
  ) {
    throw new CloudApiError(
      "INVALID_INPUT",
      `diagnostics[${index}].severity must be a SearchLint diagnostic severity.`
    );
  }
}

function validateConfidence(value: unknown, index: number): void {
  if (value !== "certain" && value !== "likely" && value !== "heuristic") {
    throw new CloudApiError(
      "INVALID_INPUT",
      `diagnostics[${index}].confidence must be a SearchLint diagnostic confidence.`
    );
  }
}

function validateSource(value: unknown, index: number): void {
  if (
    value !== "source-code" &&
    value !== "raw-html" &&
    value !== "rendered-dom" &&
    value !== "http-header" &&
    value !== "crawler" &&
    value !== "google" &&
    value !== "yandex"
  ) {
    throw new CloudApiError(
      "INVALID_INPUT",
      `diagnostics[${index}].source must be a SearchLint diagnostic source.`
    );
  }
}

function validateSourceLocation(
  value: DiagnosticSourceLocation,
  index: number
): void {
  if (!isPlainObject(value)) {
    throw new CloudApiError(
      "INVALID_INPUT",
      `diagnostics[${index}].sourceLocation must be an object.`
    );
  }
  if (value.confidence !== "exact" && value.confidence !== "related") {
    throw new CloudApiError(
      "INVALID_INPUT",
      `diagnostics[${index}].sourceLocation.confidence must be exact or related.`
    );
  }
}

function validateStructuredEvidence(
  value: readonly DiagnosticStructuredEvidence[],
  index: number
): void {
  if (!Array.isArray(value) || !value.every(isPlainObject)) {
    throw new CloudApiError(
      "INVALID_INPUT",
      `diagnostics[${index}].structuredEvidence must be an object array.`
    );
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function crawlJobPayload(
  crawlRequest: CrawlRequest
): CloudOutboxEvent["payload"] {
  return {
    crawlRequestId: crawlRequest.id,
    organizationId: crawlRequest.organizationId,
    projectId: crawlRequest.projectId,
    environmentId: crawlRequest.environmentId,
    maxUrls: crawlRequest.maxUrls
  };
}

async function audit(
  dependencies: CloudApiDependencies,
  transaction: CloudTransactionDependencies,
  input: Omit<AuditEvent, "id" | "occurredAt">
): Promise<void> {
  await transaction.auditLog.append({
    id: dependencies.ids.nextId("audit"),
    occurredAt: dependencies.clock.now(),
    ...input
  });
}

async function metric(
  dependencies: CloudApiDependencies,
  transaction: CloudTransactionDependencies,
  input: Omit<MetricEvent, "id" | "occurredAt">
): Promise<void> {
  await transaction.metrics.record({
    id: dependencies.ids.nextId("metric"),
    occurredAt: dependencies.clock.now(),
    ...input
  });
}
