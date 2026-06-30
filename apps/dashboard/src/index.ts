import type {
  CloudApiOperation,
  CloudHttpRouteContract
} from "@searchlint/api/http-contracts";
import { routeContractForOperation } from "@searchlint/api/http-contracts";
import type { Diagnostic, Severity } from "@searchlint/core";

import {
  createDashboardBrowserAuthSessionStore,
  createDashboardCognitoStoredSessionApiClient,
  getDashboardStoredAuthSessionState,
  type DashboardApiClient,
  type DashboardApiFetch,
  type DashboardAuthSession,
  type DashboardAuthSessionStore,
  type DashboardBrowserNavigationPort,
  type DashboardBrowserStorageLike,
  type DashboardCognitoTokenFetch,
  type DashboardSessionClock
} from "./api-client.js";

export * from "./api-client.js";

export type DashboardProvider = "google" | "yandex";
export type DashboardObservationStatus = "fresh" | "stale" | "missing";
export type DashboardCrawlStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled";
export type DashboardRole =
  | "owner"
  | "admin"
  | "developer"
  | "analyst"
  | "client"
  | "viewer";

export type DashboardOrganization = {
  id: string;
  name: string;
};

export type DashboardOrganizationSwitchTarget = {
  organizationId: string;
  organizationName: string;
  projectId: string;
  projectName: string;
  environmentId: string;
  environmentName: string;
};

export type DashboardProject = {
  id: string;
  name: string;
  siteUrl: string;
};

export type DashboardProjectManagementItem = {
  id: string;
  name: string;
  siteUrl: string;
  environmentCount: number;
  openDiagnostics: number;
  latestCrawlStatus?: DashboardCrawlStatus;
};

export type DashboardEnvironment = {
  id: string;
  name: string;
  baseUrl: string;
};

export type DashboardCrawlRun = {
  id: string;
  status: DashboardCrawlStatus;
  requestedAt: string;
  finishedAt?: string;
  crawledUrls: number;
  failedUrls: number;
};

export type DashboardCrawlSchedule = {
  id: string;
  name: string;
  cadence: "hourly" | "daily" | "weekly" | "monthly" | "manual";
  enabled: boolean;
  nextRunAt?: string;
  lastRunAt?: string;
  targetUrlCount: number;
};

export type DashboardTrendPoint = {
  date: string;
  diagnostics: number;
  blockers: number;
  errors: number;
  warnings: number;
  infos: number;
};

export type DashboardDeploymentRecord = {
  id: string;
  deployedAt: string;
  environmentName: string;
  commitRef: string;
  status: "succeeded" | "failed" | "rolled_back";
  diagnosticsBefore: number;
  diagnosticsAfter: number;
  annotation?: string;
};

export type DashboardExternalObservation = {
  id: string;
  provider: DashboardProvider;
  subjectUrl: string;
  status: DashboardObservationStatus;
  observedAt: string;
  fetchedAt: string;
  summary: string;
};

export type DashboardExternalProviderConnectorStatus =
  | "connected"
  | "stale"
  | "notConnected";

export type DashboardExternalProviderConnector = {
  provider: DashboardProvider;
  status: DashboardExternalProviderConnectorStatus;
  action: Extract<DashboardAction, "startExternalProviderOAuthConnection">;
  operation: CloudApiOperation;
  method: string;
  pathTemplate: string;
  requestSchemaVersion: string;
  responseSchemaVersion: string;
};

export type DashboardExternalProviderSettings = {
  provider: DashboardProvider;
  status: DashboardExternalProviderConnectorStatus;
  observedSubjectCount: number;
  oauthStartOperation: CloudApiOperation;
  oauthStartMethod: string;
  oauthStartPathTemplate: string;
  requiredScopes: readonly string[];
  redirectUri: string;
};

export type DashboardReportSummary = {
  id: string;
  title: string;
  generatedAt: string;
  locale: string;
  totalDiagnostics: number;
};

export type DashboardQuotaUsage = {
  label: string;
  used: number;
  limit: number;
};

export type DashboardBillingInvoice = {
  id: string;
  status: "draft" | "open" | "paid" | "void" | "uncollectible";
  amountDueCents: number;
  currency: string;
  dueAt?: string;
};

export type DashboardBillingSummary = {
  planTier: "starter" | "team" | "agency" | "enterprise";
  status: "trialing" | "active" | "past_due" | "cancelled" | "expired";
  source: "stripe" | "manual";
  currentPeriodEnd: string;
  trialEndsAt?: string;
  overagePolicy: "hard-cap" | "contract-override";
  invoices: readonly DashboardBillingInvoice[];
};

export type DashboardAgencyClientWorkspace = {
  id: string;
  clientName: string;
  status: "active" | "paused" | "archived";
  projectCount: number;
  openDiagnostics: number;
  blockerDiagnostics: number;
  healthScore: number;
  slaStatus: "on-track" | "due-soon" | "overdue" | "not-configured";
  assignee?: string;
};

export type DashboardAgencySummary = {
  clientCount: number;
  activeClientCount: number;
  projectCount: number;
  openDiagnostics: number;
  blockerDiagnostics: number;
  averageHealthScore: number;
  overdueSlaCount: number;
  brandLabel?: string;
  billingStatus?: "within-limit" | "limit-reached" | "over-limit";
  clients: readonly DashboardAgencyClientWorkspace[];
};

export type DashboardTeamMember = {
  principalId: string;
  displayName: string;
  role: DashboardRole;
};

export type DashboardTeamRbacRoleSummary = {
  role: DashboardRole;
  permissions: readonly string[];
  memberCount: number;
};

export type DashboardTeamManagementAction = {
  label: string;
  action?: DashboardAction;
  method?: string;
  pathTemplate?: string;
  evidence: string;
};

export type DashboardNotificationChannel = {
  id: string;
  kind: "email" | "slack" | "webhook" | "telegram";
  name: string;
  targetDisplay: string;
  enabled: boolean;
};

export type DashboardNotificationRule = {
  id: string;
  name: string;
  eventKinds: readonly string[];
  channelIds: readonly string[];
  severityThreshold?: Severity;
  digest: "immediate" | "daily" | "weekly";
  enabled: boolean;
  mutedUntil?: string;
  snoozedUntil?: string;
};

export type DashboardNotificationDeliveryAttempt = {
  id: string;
  channelKind: DashboardNotificationChannel["kind"];
  status: "pending" | "delivered" | "failed" | "retry_scheduled" | "suppressed";
  attemptedAt: string;
  attempt: number;
  failureReason?: string;
  nextRetryAt?: string;
};

export type DashboardSnapshot = {
  organization: DashboardOrganization;
  project: DashboardProject;
  environment: DashboardEnvironment;
  viewerRole?: DashboardRole;
  organizationSwitchTargets?: readonly DashboardOrganizationSwitchTarget[];
  projectManagement?: readonly DashboardProjectManagementItem[];
  diagnostics: readonly Diagnostic[];
  crawlRuns: readonly DashboardCrawlRun[];
  crawlSchedules?: readonly DashboardCrawlSchedule[];
  trends: readonly DashboardTrendPoint[];
  deploymentHistory?: readonly DashboardDeploymentRecord[];
  externalObservations: readonly DashboardExternalObservation[];
  reports: readonly DashboardReportSummary[];
  quotas: readonly DashboardQuotaUsage[];
  billing?: DashboardBillingSummary;
  agency?: DashboardAgencySummary;
  teamMembers: readonly DashboardTeamMember[];
  notificationChannels?: readonly DashboardNotificationChannel[];
  notificationRules?: readonly DashboardNotificationRule[];
  notificationDeliveryAttempts?: readonly DashboardNotificationDeliveryAttempt[];
};

export type DashboardSeverityCounts = Readonly<Record<Severity, number>>;

export type DashboardSummary = {
  organizationName: string;
  projectName: string;
  environmentName: string;
  siteUrl: string;
  totalDiagnostics: number;
  affectedPages: number;
  severityCounts: DashboardSeverityCounts;
  latestCrawl?: DashboardCrawlRun;
  staleExternalObservations: number;
  reportCount: number;
  teamMemberCount: number;
  exhaustedQuotaCount: number;
};

export type DashboardAction =
  | "createProject"
  | "createEnvironment"
  | "getDashboardSnapshot"
  | "requestCrawl"
  | "addMember"
  | "startExternalProviderOAuthConnection"
  | "completeExternalProviderOAuthConnection";

export type DashboardActionRoute = {
  action: DashboardAction;
  route: CloudHttpRouteContract;
};

export type DashboardProjectView =
  | "onboarding"
  | "overview"
  | "organization"
  | "site"
  | "environments"
  | "issues"
  | "diagnostics"
  | "crawlHistory"
  | "trends"
  | "externalObservations"
  | "reports"
  | "team"
  | "billing"
  | "settings"
  | "auditLog";

export type DashboardProjectRouteParams = {
  organizationId: string;
  projectId: string;
  environmentId: string;
};

export type DashboardProjectRouteRequest = DashboardProjectRouteParams & {
  view: DashboardProjectView;
  basePath?: string;
};

export type DashboardProjectRoute = {
  params: DashboardProjectRouteParams;
  view: DashboardProjectView;
  path: string;
};

export type DashboardProjectNavigationItem = {
  view: DashboardProjectView;
  label: string;
  path: string;
  current: boolean;
};

export type DashboardOrganizationSwitcherItem =
  DashboardOrganizationSwitchTarget & {
    path: string;
    current: boolean;
  };

export type DashboardProjectSectionModel =
  | {
      view: "onboarding";
      summary: DashboardSummary;
      checklist: readonly DashboardChecklistItem[];
    }
  | {
      view: "overview";
      summary: DashboardSummary;
      quotas: readonly DashboardQuotaUsage[];
    }
  | {
      view: "organization";
      organization: DashboardOrganization;
      teamMembers: readonly DashboardTeamMember[];
      projects: readonly DashboardProjectManagementViewItem[];
      createProjectRoute: DashboardActionRoute;
    }
  | {
      view: "site";
      project: DashboardProject;
      environment: DashboardEnvironment;
      affectedPages: number;
    }
  | {
      view: "environments";
      environment: DashboardEnvironment;
      latestCrawl?: DashboardCrawlRun;
    }
  | {
      view: "issues";
      summary: DashboardSummary;
      diagnostics: readonly Diagnostic[];
    }
  | {
      view: "diagnostics";
      diagnostics: readonly Diagnostic[];
    }
  | {
      view: "crawlHistory";
      crawlRuns: readonly DashboardCrawlRun[];
      crawlSchedules: readonly DashboardCrawlSchedule[];
      requestCrawlRoute: DashboardActionRoute;
    }
  | {
      view: "trends";
      trends: readonly DashboardTrendPoint[];
      deploymentHistory: readonly DashboardDeploymentRecord[];
    }
  | {
      view: "externalObservations";
      externalObservations: readonly DashboardExternalObservation[];
      connectors: readonly DashboardExternalProviderConnector[];
    }
  | {
      view: "reports";
      reports: readonly DashboardReportSummary[];
    }
  | {
      view: "team";
      teamMembers: readonly DashboardTeamMember[];
      roleSummaries: readonly DashboardTeamRbacRoleSummary[];
      managementActions: readonly DashboardTeamManagementAction[];
    }
  | {
      view: "billing";
      quotas: readonly DashboardQuotaUsage[];
      billing?: DashboardBillingSummary;
      agency?: DashboardAgencySummary;
    }
  | {
      view: "settings";
      actionRoutes: readonly DashboardActionRoute[];
      providerSettings: readonly DashboardExternalProviderSettings[];
      notificationChannels: readonly DashboardNotificationChannel[];
      notificationRules: readonly DashboardNotificationRule[];
      notificationDeliveryAttempts: readonly DashboardNotificationDeliveryAttempt[];
    }
  | {
      view: "auditLog";
      events: readonly DashboardAuditLogSummaryItem[];
    };

export type DashboardChecklistItem = {
  label: string;
  status: "complete" | "needsAttention";
  evidence: string;
};

export type DashboardAuditLogSummaryItem = {
  action: string;
  target: string;
  evidence: string;
};

export type DashboardProjectManagementViewItem =
  DashboardProjectManagementItem & {
    current: boolean;
  };

export type DashboardProjectViewModelRequest = DashboardProjectRouteRequest & {
  snapshot: DashboardSnapshot;
};

export type DashboardProjectViewModel = {
  route: DashboardProjectRoute;
  activeView: DashboardProjectView;
  activeViewLabel: string;
  summary: DashboardSummary;
  section: DashboardProjectSectionModel;
  navigation: readonly DashboardProjectNavigationItem[];
  organizationSwitcher: readonly DashboardOrganizationSwitcherItem[];
};

export type DashboardProjectRouteRenderRequest = {
  path: string;
  snapshot: DashboardSnapshot;
  basePath?: string;
};

export type DashboardProjectRouteRenderResult =
  | {
      status: "found";
      route: DashboardProjectRoute;
      model: DashboardProjectViewModel;
      html: string;
    }
  | {
      status: "notFound";
      path: string;
    };

export type DashboardProjectSnapshotLoader = (
  params: DashboardProjectRouteParams
) => DashboardSnapshot | undefined | Promise<DashboardSnapshot | undefined>;

export type DashboardProjectRouteLoaderRenderRequest = {
  path: string;
  basePath?: string;
  loadSnapshot: DashboardProjectSnapshotLoader;
};

export type DashboardProjectRouteLoaderRenderResult =
  | {
      status: "found";
      route: DashboardProjectRoute;
      snapshot: DashboardSnapshot;
      model: DashboardProjectViewModel;
      html: string;
    }
  | {
      status: "notFound";
      path: string;
    }
  | {
      status: "snapshotNotFound";
      route: DashboardProjectRoute;
    };

export type DashboardProjectRuntimeOptions = {
  path: string;
  basePath?: string;
  sessionStore: DashboardAuthSessionStore;
  clock: DashboardSessionClock;
  authRoutes: DashboardAuthRoutePaths;
  apiClient: DashboardApiClient;
  expirySkewSeconds?: number;
};

export type DashboardBrowserLocationPort = {
  pathname: string;
  origin?: string;
};

export type DashboardProjectBrowserRuntimeRenderer = {
  renderHtml(html: string): void | Promise<void>;
  renderNotFound(input: {
    path: string;
    session: DashboardAuthSession;
  }): void | Promise<void>;
  renderSnapshotNotFound(input: {
    route: DashboardProjectRoute;
    session: DashboardAuthSession;
  }): void | Promise<void>;
  renderApiError(input: {
    path: string;
    route?: DashboardProjectRoute;
    statusCode?: number;
    message: string;
    session: DashboardAuthSession;
  }): void | Promise<void>;
};

export type DashboardBrowserDomRootPort = {
  innerHTML: string;
  setAttribute?(name: string, value: string): void;
  removeAttribute?(name: string): void;
  focus?(): void;
};

export type DashboardBrowserDocumentPort = {
  title: string;
};

export type DashboardProjectBrowserDomRendererOptions = {
  root: DashboardBrowserDomRootPort;
  document?: DashboardBrowserDocumentPort;
  focusAfterRender?: boolean;
};

export type DashboardBrowserHistoryPort = {
  pushState(state: unknown, title: string, url: string): void;
};

export type DashboardBrowserEventListener = (event?: unknown) => void;

export type DashboardBrowserEventTargetPort = {
  addEventListener(type: string, listener: DashboardBrowserEventListener): void;
  removeEventListener(
    type: string,
    listener: DashboardBrowserEventListener
  ): void;
};

export type DashboardBrowserLinkPort = {
  href: string;
  origin?: string;
  pathname?: string;
  search?: string;
  hash?: string;
  target?: string;
  getAttribute?(name: string): string | null;
};

export type DashboardBrowserClickEventPort = {
  button?: number;
  defaultPrevented?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  target?: {
    closest(selector: string): DashboardBrowserLinkPort | null;
  };
  preventDefault(): void;
};

export type DashboardBrowserHistoryRuntimeOptions =
  DashboardProjectBrowserRuntimeOptions & {
    history: DashboardBrowserHistoryPort;
    eventTarget: DashboardBrowserEventTargetPort;
    linkEventTarget?: DashboardBrowserEventTargetPort;
  };

export type DashboardBrowserHistoryRuntime = {
  start(): Promise<DashboardProjectBrowserRuntimeResult>;
  navigate(path: string): Promise<DashboardProjectBrowserRuntimeResult>;
  stop(): void;
};

export type DashboardBrowserAppConfig = {
  root: DashboardBrowserDomRootPort;
  document?: DashboardBrowserDocumentPort;
  location: DashboardBrowserLocationPort;
  history: DashboardBrowserHistoryPort;
  eventTarget: DashboardBrowserEventTargetPort;
  linkEventTarget?: DashboardBrowserEventTargetPort;
  navigation: DashboardBrowserNavigationPort;
  storage: DashboardBrowserStorageLike;
  clock: DashboardSessionClock;
  authRoutes: DashboardAuthRoutePaths;
  apiBaseUrl: string;
  apiFetch: DashboardApiFetch;
  tokenFetch: DashboardCognitoTokenFetch;
  cognitoHostedUiDomain: string;
  cognitoClientId: string;
  basePath?: string;
  sessionStorageNamespace?: string;
  expirySkewSeconds?: number;
  headers?: Readonly<Record<string, string>>;
  signal?: unknown;
  focusAfterRender?: boolean;
};

export type DashboardBrowserApp = {
  runtime: DashboardBrowserHistoryRuntime;
  sessionStore: DashboardAuthSessionStore;
  apiClient: DashboardApiClient;
  renderer: DashboardProjectBrowserRuntimeRenderer;
  initialResult: DashboardProjectBrowserRuntimeResult;
  stop(): void;
  navigate(path: string): Promise<DashboardProjectBrowserRuntimeResult>;
};

export type DashboardHostedShellBootstrapConfig = {
  apiBaseUrl: string;
  cognitoHostedUiDomain: string;
  cognitoClientId: string;
  authRoutes: DashboardAuthRoutePaths;
  basePath?: string;
  sessionStorageNamespace?: string;
  expirySkewSeconds?: number;
  headers?: Readonly<Record<string, string>>;
  focusAfterRender?: boolean;
};

export type DashboardHostedImportMap = {
  imports: Readonly<Record<string, string>>;
};

export type DashboardHostedBrowserAssetManifest = {
  entry: {
    name: string;
    moduleScript: string;
  };
  importMap?: DashboardHostedImportMap;
};

export type DashboardHostedShellAssetConfig = {
  entryModuleUrl: string;
  importMap?: DashboardHostedImportMap;
};

export type DashboardHostedHtmlShellConfig = {
  title?: string;
  lang?: string;
  rootId?: string;
  configScriptId?: string;
  bootstrapConfig: DashboardHostedShellBootstrapConfig;
  entryModuleUrl: string;
  importMap?: DashboardHostedImportMap;
  stylesheetUrls?: readonly string[];
  cspNonce?: string;
};

export type DashboardBrowserEntryElementPort = DashboardBrowserDomRootPort & {
  textContent?: string | null;
};

export type DashboardBrowserEntryDocumentPort = DashboardBrowserDocumentPort &
  DashboardBrowserEventTargetPort & {
    getElementById(id: string): DashboardBrowserEntryElementPort | null;
  };

export type DashboardBrowserEntryLocationPort = DashboardBrowserLocationPort & {
  assign(url: string): void;
};

export type DashboardBrowserEntryWindowPort =
  DashboardBrowserEventTargetPort & {
    document: DashboardBrowserEntryDocumentPort;
    location: DashboardBrowserEntryLocationPort;
    history: DashboardBrowserHistoryPort;
    sessionStorage: DashboardBrowserStorageLike;
    fetch: DashboardApiFetch;
  };

export type DashboardBrowserEntryOptions = {
  window: DashboardBrowserEntryWindowPort;
  rootId?: string;
  configScriptId?: string;
  clock?: DashboardSessionClock;
  signal?: unknown;
};

export type DashboardProjectBrowserRuntimeOptions = Omit<
  DashboardProjectRuntimeOptions,
  "path"
> & {
  location: DashboardBrowserLocationPort;
  navigation: DashboardBrowserNavigationPort;
  renderer: DashboardProjectBrowserRuntimeRenderer;
};

export type DashboardProjectRuntimeState =
  | {
      status: "redirect";
      intent: Exclude<DashboardAuthRouteIntent, { action: "allow" }>;
    }
  | {
      status: "notFound";
      path: string;
      session: DashboardAuthSession;
    }
  | {
      status: "snapshotNotFound";
      route: DashboardProjectRoute;
      session: DashboardAuthSession;
    }
  | {
      status: "rendered";
      route: DashboardProjectRoute;
      snapshot: DashboardSnapshot;
      model: DashboardProjectViewModel;
      html: string;
      session: DashboardAuthSession;
    }
  | {
      status: "apiError";
      path: string;
      route?: DashboardProjectRoute;
      statusCode?: number;
      message: string;
      session: DashboardAuthSession;
    };

export type DashboardProjectBrowserRuntimeResult =
  | {
      effect: "redirect";
      state: Extract<DashboardProjectRuntimeState, { status: "redirect" }>;
    }
  | {
      effect: "renderHtml";
      state: Extract<DashboardProjectRuntimeState, { status: "rendered" }>;
    }
  | {
      effect: "renderNotFound";
      state: Extract<DashboardProjectRuntimeState, { status: "notFound" }>;
    }
  | {
      effect: "renderSnapshotNotFound";
      state: Extract<
        DashboardProjectRuntimeState,
        { status: "snapshotNotFound" }
      >;
    }
  | {
      effect: "renderApiError";
      state: Extract<DashboardProjectRuntimeState, { status: "apiError" }>;
    };

export type DashboardAuthRoutePaths = {
  signIn: string;
  dashboard: string;
  sessionExpired?: string;
};

export type DashboardAuthRouteIntent =
  | {
      action: "redirect";
      route: "signIn";
      path: string;
      reason: "missing-session";
    }
  | {
      action: "redirect";
      route: "signIn" | "sessionExpired";
      path: string;
      reason: "expired-session";
      session: DashboardAuthSession;
    }
  | {
      action: "allow";
      route: "dashboard";
      path: string;
      session: DashboardAuthSession;
    };

export type DashboardAuthRouteIntentOptions = {
  sessionStore: DashboardAuthSessionStore;
  clock: DashboardSessionClock;
  routes: DashboardAuthRoutePaths;
  expirySkewSeconds?: number;
};

export type DashboardMessageKey =
  | "dashboard.title"
  | "dashboard.onboarding"
  | "dashboard.overview"
  | "dashboard.organization"
  | "dashboard.site"
  | "dashboard.environments"
  | "dashboard.issues"
  | "dashboard.diagnostics"
  | "dashboard.crawlHistory"
  | "dashboard.trends"
  | "dashboard.externalObservations"
  | "dashboard.connectors"
  | "dashboard.connectGoogle"
  | "dashboard.connectYandex"
  | "dashboard.connectionStatus"
  | "dashboard.reports"
  | "dashboard.quota"
  | "dashboard.team"
  | "dashboard.billing"
  | "dashboard.settings"
  | "dashboard.auditLog"
  | "dashboard.totalDiagnostics"
  | "dashboard.affectedPages"
  | "dashboard.latestCrawl"
  | "dashboard.severity"
  | "dashboard.rule"
  | "dashboard.page"
  | "dashboard.evidence"
  | "dashboard.provider"
  | "dashboard.status"
  | "dashboard.generatedAt"
  | "dashboard.role"
  | "dashboard.requested"
  | "dashboard.crawledUrls"
  | "dashboard.failedUrls"
  | "dashboard.date"
  | "dashboard.total"
  | "dashboard.blockers"
  | "dashboard.errors"
  | "dashboard.warnings"
  | "dashboard.info"
  | "dashboard.subject"
  | "dashboard.observed"
  | "dashboard.summary"
  | "dashboard.titleColumn"
  | "dashboard.locale"
  | "dashboard.name"
  | "dashboard.action"
  | "dashboard.target"
  | "dashboard.path"
  | "dashboard.method"
  | "dashboard.evidenceStatus";

export const dashboardMessages: Readonly<Record<DashboardMessageKey, string>> =
  {
    "dashboard.title": "SearchLint Dashboard",
    "dashboard.onboarding": "Onboarding",
    "dashboard.overview": "Project Overview",
    "dashboard.organization": "Organization",
    "dashboard.site": "Site",
    "dashboard.environments": "Environments",
    "dashboard.issues": "Issues",
    "dashboard.diagnostics": "Diagnostics",
    "dashboard.crawlHistory": "Crawl History",
    "dashboard.trends": "Trends",
    "dashboard.externalObservations": "External Observations",
    "dashboard.connectors": "Connectors",
    "dashboard.connectGoogle": "Connect Google",
    "dashboard.connectYandex": "Connect Yandex",
    "dashboard.connectionStatus": "Connection status",
    "dashboard.reports": "Reports",
    "dashboard.quota": "Quota",
    "dashboard.team": "Team",
    "dashboard.billing": "Billing",
    "dashboard.settings": "Settings",
    "dashboard.auditLog": "Audit Log",
    "dashboard.totalDiagnostics": "Total diagnostics",
    "dashboard.affectedPages": "Affected pages",
    "dashboard.latestCrawl": "Latest crawl",
    "dashboard.severity": "Severity",
    "dashboard.rule": "Rule",
    "dashboard.page": "Page",
    "dashboard.evidence": "Evidence",
    "dashboard.provider": "Provider",
    "dashboard.status": "Status",
    "dashboard.generatedAt": "Generated at",
    "dashboard.role": "Role",
    "dashboard.requested": "Requested",
    "dashboard.crawledUrls": "Crawled URLs",
    "dashboard.failedUrls": "Failed URLs",
    "dashboard.date": "Date",
    "dashboard.total": "Total",
    "dashboard.blockers": "Blockers",
    "dashboard.errors": "Errors",
    "dashboard.warnings": "Warnings",
    "dashboard.info": "Info",
    "dashboard.subject": "Subject",
    "dashboard.observed": "Observed",
    "dashboard.summary": "Summary",
    "dashboard.titleColumn": "Title",
    "dashboard.locale": "Locale",
    "dashboard.name": "Name",
    "dashboard.action": "Action",
    "dashboard.target": "Target",
    "dashboard.path": "Path",
    "dashboard.method": "Method",
    "dashboard.evidenceStatus": "Evidence status"
  };

const actionOperations: Readonly<Record<DashboardAction, CloudApiOperation>> = {
  createProject: "createProject",
  createEnvironment: "createEnvironment",
  getDashboardSnapshot: "getDashboardSnapshot",
  requestCrawl: "requestCrawl",
  addMember: "addMember",
  startExternalProviderOAuthConnection: "startExternalProviderOAuthConnection",
  completeExternalProviderOAuthConnection:
    "completeExternalProviderOAuthConnection"
};

const dashboardProjectViewSegments: Readonly<
  Record<DashboardProjectView, string>
> = {
  onboarding: "onboarding",
  overview: "overview",
  organization: "organization",
  site: "site",
  environments: "environments",
  issues: "issues",
  diagnostics: "diagnostics",
  crawlHistory: "crawl-history",
  trends: "trends",
  externalObservations: "external-observations",
  reports: "reports",
  team: "team",
  billing: "billing",
  settings: "settings",
  auditLog: "audit-log"
};

const dashboardProjectViewOrder: readonly DashboardProjectView[] = [
  "onboarding",
  "overview",
  "issues",
  "diagnostics",
  "crawlHistory",
  "trends",
  "externalObservations",
  "reports",
  "organization",
  "site",
  "environments",
  "team",
  "billing",
  "settings",
  "auditLog"
];

const dashboardProjectViewMessageKeys: Readonly<
  Record<DashboardProjectView, DashboardMessageKey>
> = {
  onboarding: "dashboard.onboarding",
  overview: "dashboard.overview",
  organization: "dashboard.organization",
  site: "dashboard.site",
  environments: "dashboard.environments",
  issues: "dashboard.issues",
  diagnostics: "dashboard.diagnostics",
  crawlHistory: "dashboard.crawlHistory",
  trends: "dashboard.trends",
  externalObservations: "dashboard.externalObservations",
  reports: "dashboard.reports",
  team: "dashboard.team",
  billing: "dashboard.billing",
  settings: "dashboard.settings",
  auditLog: "dashboard.auditLog"
};

const dashboardRolePermissions: Readonly<
  Record<DashboardRole, readonly string[]>
> = {
  owner: [
    "organization:manage",
    "member:manage",
    "billing:manage",
    "project:create",
    "project:read",
    "project:update",
    "environment:create",
    "environment:read",
    "crawl:create",
    "diagnostic:read",
    "diagnostic:write",
    "report:read",
    "connector:manage"
  ],
  admin: [
    "member:manage",
    "project:create",
    "project:read",
    "project:update",
    "environment:create",
    "environment:read",
    "crawl:create",
    "diagnostic:read",
    "diagnostic:write",
    "report:read",
    "connector:manage"
  ],
  developer: [
    "project:read",
    "project:update",
    "environment:create",
    "environment:read",
    "crawl:create",
    "diagnostic:read",
    "diagnostic:write",
    "report:read"
  ],
  analyst: [
    "project:read",
    "environment:read",
    "diagnostic:read",
    "report:read"
  ],
  client: ["project:read", "report:read"],
  viewer: ["project:read", "diagnostic:read", "report:read"]
};

const dashboardProjectViewsBySegment = new Map(
  Object.entries(dashboardProjectViewSegments).map(([view, segment]) => [
    segment,
    view as DashboardProjectView
  ])
);

const severityRank: Readonly<Record<Severity, number>> = {
  blocker: 4,
  error: 3,
  warning: 2,
  info: 1
};

export function dashboardActionRoutes(): readonly DashboardActionRoute[] {
  return (Object.keys(actionOperations) as DashboardAction[]).map((action) => ({
    action,
    route: routeContractForOperation(actionOperations[action])
  }));
}

export function dashboardActionRoute(
  action: DashboardAction
): DashboardActionRoute {
  return {
    action,
    route: routeContractForOperation(actionOperations[action])
  };
}

export function createDashboardProjectRoutePath(
  request: DashboardProjectRouteRequest
): string {
  const basePath = normalizeDashboardRouteBasePath(request.basePath);
  const params = validateDashboardProjectRouteParams(request);
  const viewSegment = dashboardProjectViewSegments[request.view];
  if (viewSegment === undefined) {
    throw new Error(
      `Dashboard project view ${String(request.view)} is not supported.`
    );
  }

  return joinDashboardRoutePath([
    basePath,
    "organizations",
    encodeURIComponent(params.organizationId),
    "projects",
    encodeURIComponent(params.projectId),
    "environments",
    encodeURIComponent(params.environmentId),
    viewSegment
  ]);
}

export function parseDashboardProjectRoutePath(
  path: string,
  basePath = "/dashboard"
): DashboardProjectRoute | undefined {
  const normalizedBasePath = normalizeDashboardRouteBasePath(basePath);
  if (typeof path !== "string" || path.trim() === "" || !path.startsWith("/")) {
    return undefined;
  }

  const baseSegments = pathSegments(normalizedBasePath);
  const segments = pathSegments(path);
  const routeOffset = baseSegments.length;
  if (
    segments.length !== routeOffset + 7 ||
    !segmentsMatch(segments.slice(0, routeOffset), baseSegments) ||
    segments[routeOffset] !== "organizations" ||
    segments[routeOffset + 2] !== "projects" ||
    segments[routeOffset + 4] !== "environments"
  ) {
    return undefined;
  }

  const view = dashboardProjectViewsBySegment.get(segments[routeOffset + 6]!);
  if (view === undefined) {
    return undefined;
  }

  const params: DashboardProjectRouteParams = {
    organizationId: decodeRouteSegment(segments[routeOffset + 1]!),
    projectId: decodeRouteSegment(segments[routeOffset + 3]!),
    environmentId: decodeRouteSegment(segments[routeOffset + 5]!)
  };
  if (!isValidDashboardProjectRouteParams(params)) {
    return undefined;
  }

  return {
    params,
    view,
    path: createDashboardProjectRoutePath({
      ...params,
      view,
      basePath: normalizedBasePath
    })
  };
}

export function createDashboardProjectViewModel(
  request: DashboardProjectViewModelRequest
): DashboardProjectViewModel {
  const route: DashboardProjectRoute = {
    params: validateDashboardProjectRouteParams(request),
    view: request.view,
    path: createDashboardProjectRoutePath(request)
  };
  assertDashboardProjectRouteMatchesSnapshot(route.params, request.snapshot);
  const summary = createDashboardSummary(request.snapshot);

  return {
    route,
    activeView: route.view,
    activeViewLabel: dashboardProjectViewLabel(route.view),
    summary,
    section: createDashboardProjectSectionModel(request.snapshot, route.view),
    organizationSwitcher: createDashboardOrganizationSwitcherItems(
      request.snapshot,
      route,
      request.basePath
    ),
    navigation: dashboardProjectViewOrder.map((view) => ({
      view,
      label: dashboardProjectViewLabel(view),
      path: createDashboardProjectRoutePath(
        request.basePath === undefined
          ? {
              ...route.params,
              view
            }
          : {
              ...route.params,
              view,
              basePath: request.basePath
            }
      ),
      current: view === route.view
    }))
  };
}

export function createDashboardProjectSectionModel(
  snapshot: DashboardSnapshot,
  view: DashboardProjectView
): DashboardProjectSectionModel {
  switch (view) {
    case "onboarding":
      return {
        view,
        summary: createDashboardSummary(snapshot),
        checklist: createDashboardOnboardingChecklist(snapshot)
      };
    case "overview":
      return {
        view,
        summary: createDashboardSummary(snapshot),
        quotas: [...snapshot.quotas].sort((left, right) =>
          left.label.localeCompare(right.label)
        )
      };
    case "organization":
      return {
        view,
        organization: snapshot.organization,
        teamMembers: sortedTeamMembers(snapshot),
        projects: createDashboardProjectManagementItems(snapshot),
        createProjectRoute: dashboardActionRoute("createProject")
      };
    case "site":
      return {
        view,
        project: snapshot.project,
        environment: snapshot.environment,
        affectedPages: createDashboardSummary(snapshot).affectedPages
      };
    case "environments": {
      const latestCrawl = [...snapshot.crawlRuns].sort(compareCrawlRuns)[0];
      return {
        view,
        environment: snapshot.environment,
        ...(latestCrawl === undefined ? {} : { latestCrawl })
      };
    }
    case "issues":
      return {
        view,
        summary: createDashboardSummary(snapshot),
        diagnostics: [...snapshot.diagnostics].sort(compareDiagnostics)
      };
    case "diagnostics":
      return {
        view,
        diagnostics: [...snapshot.diagnostics].sort(compareDiagnostics)
      };
    case "crawlHistory":
      return {
        view,
        crawlRuns: [...snapshot.crawlRuns].sort(compareCrawlRuns),
        crawlSchedules: sortedCrawlSchedules(snapshot),
        requestCrawlRoute: dashboardActionRoute("requestCrawl")
      };
    case "trends":
      return {
        view,
        trends: [...snapshot.trends].sort((left, right) =>
          left.date.localeCompare(right.date)
        ),
        deploymentHistory: sortedDeploymentHistory(snapshot)
      };
    case "externalObservations":
      return {
        view,
        externalObservations: sortedExternalObservations(snapshot),
        connectors: createDashboardExternalProviderConnectors(snapshot)
      };
    case "reports":
      return {
        view,
        reports: sortedReports(snapshot)
      };
    case "team":
      return {
        view,
        teamMembers: sortedTeamMembers(snapshot),
        roleSummaries: createDashboardTeamRbacRoleSummaries(snapshot),
        managementActions: dashboardSnapshotHasPermission(
          snapshot,
          "member:manage"
        )
          ? createDashboardTeamManagementActions()
          : []
      };
    case "billing":
      return {
        view,
        quotas: [...snapshot.quotas].sort((left, right) =>
          left.label.localeCompare(right.label)
        ),
        ...(snapshot.billing === undefined
          ? {}
          : { billing: snapshot.billing }),
        ...(snapshot.agency === undefined ? {} : { agency: snapshot.agency })
      };
    case "settings":
      return {
        view,
        actionRoutes: dashboardActionRoutes(),
        providerSettings: createDashboardExternalProviderSettings(snapshot),
        notificationChannels: sortedNotificationChannels(snapshot),
        notificationRules: sortedNotificationRules(snapshot),
        notificationDeliveryAttempts:
          sortedNotificationDeliveryAttempts(snapshot)
      };
    case "auditLog":
      return {
        view,
        events: createDashboardAuditLogSummary(snapshot)
      };
  }
}

export function createDashboardOrganizationSwitcherItems(
  snapshot: DashboardSnapshot,
  route: DashboardProjectRoute,
  basePath?: string
): readonly DashboardOrganizationSwitcherItem[] {
  const currentTarget: DashboardOrganizationSwitchTarget = {
    organizationId: snapshot.organization.id,
    organizationName: snapshot.organization.name,
    projectId: snapshot.project.id,
    projectName: snapshot.project.name,
    environmentId: snapshot.environment.id,
    environmentName: snapshot.environment.name
  };
  const targetsByIdentity = new Map<
    string,
    DashboardOrganizationSwitchTarget
  >();
  for (const target of [
    currentTarget,
    ...(snapshot.organizationSwitchTargets ?? [])
  ]) {
    const validated = validateDashboardOrganizationSwitchTarget(target);
    targetsByIdentity.set(organizationSwitchIdentity(validated), validated);
  }

  return [...targetsByIdentity.values()]
    .sort(
      (left, right) =>
        left.organizationName.localeCompare(right.organizationName) ||
        left.projectName.localeCompare(right.projectName) ||
        left.environmentName.localeCompare(right.environmentName)
    )
    .map((target) => {
      const params = {
        organizationId: target.organizationId,
        projectId: target.projectId,
        environmentId: target.environmentId
      };
      const path = createDashboardProjectRoutePath(
        basePath === undefined
          ? {
              ...params,
              view: route.view
            }
          : {
              ...params,
              view: route.view,
              basePath
            }
      );
      return {
        ...target,
        path,
        current:
          route.params.organizationId === target.organizationId &&
          route.params.projectId === target.projectId &&
          route.params.environmentId === target.environmentId
      };
    });
}

export function createDashboardProjectManagementItems(
  snapshot: DashboardSnapshot
): readonly DashboardProjectManagementViewItem[] {
  const latestCrawlStatus =
    createDashboardSummary(snapshot).latestCrawl?.status;
  const currentProject: DashboardProjectManagementItem = {
    id: snapshot.project.id,
    name: snapshot.project.name,
    siteUrl: snapshot.project.siteUrl,
    environmentCount: 1,
    openDiagnostics: snapshot.diagnostics.length,
    ...(latestCrawlStatus === undefined ? {} : { latestCrawlStatus })
  };
  const projectsById = new Map<string, DashboardProjectManagementItem>();
  for (const project of [
    currentProject,
    ...(snapshot.projectManagement ?? [])
  ]) {
    const validated = validateDashboardProjectManagementItem(project);
    projectsById.set(validated.id, validated);
  }

  return [...projectsById.values()]
    .sort(
      (left, right) =>
        left.name.localeCompare(right.name) || left.id.localeCompare(right.id)
    )
    .map((project) => ({
      ...project,
      current: project.id === snapshot.project.id
    }));
}

export function renderDashboardProjectViewHtml(
  model: DashboardProjectViewModel
): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(model.activeViewLabel)} - ${escapeHtml(t("dashboard.title"))}</title>
</head>
<body>
  <header>
    <h1>${escapeHtml(t("dashboard.title"))}</h1>
    <p>${escapeHtml(model.summary.organizationName)} / ${escapeHtml(model.summary.projectName)} / ${escapeHtml(model.summary.environmentName)}</p>
    ${renderDashboardOrganizationSwitcher(model.organizationSwitcher)}
  </header>
  <nav aria-label="Project dashboard views">
    ${model.navigation.map(renderProjectNavigationItem).join("\n    ")}
  </nav>
  <main>
    ${renderDashboardProjectSectionHtml(model.section)}
  </main>
</body>
</html>`;
}

export function renderDashboardProjectRoute(
  request: DashboardProjectRouteRenderRequest
): DashboardProjectRouteRenderResult {
  const parsedRoute =
    request.basePath === undefined
      ? parseDashboardProjectRoutePath(request.path)
      : parseDashboardProjectRoutePath(request.path, request.basePath);

  if (parsedRoute === undefined) {
    return {
      status: "notFound",
      path: request.path
    };
  }

  const model = createDashboardProjectViewModel(
    request.basePath === undefined
      ? {
          snapshot: request.snapshot,
          ...parsedRoute.params,
          view: parsedRoute.view
        }
      : {
          snapshot: request.snapshot,
          ...parsedRoute.params,
          view: parsedRoute.view,
          basePath: request.basePath
        }
  );

  return {
    status: "found",
    route: model.route,
    model,
    html: renderDashboardProjectViewHtml(model)
  };
}

export async function renderDashboardProjectRouteWithSnapshotLoader(
  request: DashboardProjectRouteLoaderRenderRequest
): Promise<DashboardProjectRouteLoaderRenderResult> {
  const parsedRoute =
    request.basePath === undefined
      ? parseDashboardProjectRoutePath(request.path)
      : parseDashboardProjectRoutePath(request.path, request.basePath);

  if (parsedRoute === undefined) {
    return {
      status: "notFound",
      path: request.path
    };
  }

  const snapshot = await request.loadSnapshot(parsedRoute.params);
  if (snapshot === undefined) {
    return {
      status: "snapshotNotFound",
      route: parsedRoute
    };
  }

  const rendered = renderDashboardProjectRoute(
    request.basePath === undefined
      ? {
          path: request.path,
          snapshot
        }
      : {
          path: request.path,
          basePath: request.basePath,
          snapshot
        }
  );

  if (rendered.status !== "found") {
    throw new Error("Dashboard project route changed during snapshot render.");
  }

  return {
    ...rendered,
    snapshot
  };
}

export async function resolveDashboardProjectRuntimeState(
  options: DashboardProjectRuntimeOptions
): Promise<DashboardProjectRuntimeState> {
  const authIntent = await resolveDashboardAuthRouteIntent({
    sessionStore: options.sessionStore,
    clock: options.clock,
    routes: options.authRoutes,
    ...(options.expirySkewSeconds === undefined
      ? {}
      : { expirySkewSeconds: options.expirySkewSeconds })
  });

  if (authIntent.action === "redirect") {
    return {
      status: "redirect",
      intent: authIntent
    };
  }

  const parsedRoute =
    options.basePath === undefined
      ? parseDashboardProjectRoutePath(options.path)
      : parseDashboardProjectRoutePath(options.path, options.basePath);
  if (parsedRoute === undefined) {
    return {
      status: "notFound",
      path: options.path,
      session: authIntent.session
    };
  }

  let responseStatus: number;
  let responseBody: unknown;
  try {
    const response = await options.apiClient.getDashboardSnapshot(
      parsedRoute.params
    );
    responseStatus = response.status;
    responseBody = response.body;
  } catch (error) {
    return {
      status: "apiError",
      path: options.path,
      route: parsedRoute,
      message:
        error instanceof Error
          ? `Dashboard snapshot request failed: ${error.message}`
          : "Dashboard snapshot request failed.",
      session: authIntent.session
    };
  }

  if (responseStatus === 404) {
    return {
      status: "snapshotNotFound",
      route: parsedRoute,
      session: authIntent.session
    };
  }

  if (responseStatus !== 200) {
    return {
      status: "apiError",
      path: options.path,
      route: parsedRoute,
      statusCode: responseStatus,
      message: `Dashboard snapshot request returned HTTP ${responseStatus}.`,
      session: authIntent.session
    };
  }

  if (!isDashboardSnapshot(responseBody)) {
    return {
      status: "apiError",
      path: options.path,
      route: parsedRoute,
      statusCode: responseStatus,
      message: "Dashboard snapshot response body is invalid.",
      session: authIntent.session
    };
  }

  try {
    const rendered = renderDashboardProjectRoute(
      options.basePath === undefined
        ? {
            path: options.path,
            snapshot: responseBody
          }
        : {
            path: options.path,
            basePath: options.basePath,
            snapshot: responseBody
          }
    );
    if (rendered.status !== "found") {
      throw new Error("Dashboard project route changed during runtime render.");
    }

    return {
      status: "rendered",
      route: rendered.route,
      snapshot: responseBody,
      model: rendered.model,
      html: rendered.html,
      session: authIntent.session
    };
  } catch (error) {
    return {
      status: "apiError",
      path: options.path,
      route: parsedRoute,
      statusCode: responseStatus,
      message:
        error instanceof Error
          ? `Dashboard snapshot could not be rendered: ${error.message}`
          : "Dashboard snapshot could not be rendered.",
      session: authIntent.session
    };
  }
}

export async function runDashboardProjectBrowserRuntime(
  options: DashboardProjectBrowserRuntimeOptions
): Promise<DashboardProjectBrowserRuntimeResult> {
  const path = browserRuntimePath(options.location);
  const state = await resolveDashboardProjectRuntimeState(
    options.basePath === undefined
      ? {
          path,
          sessionStore: options.sessionStore,
          clock: options.clock,
          authRoutes: options.authRoutes,
          apiClient: options.apiClient,
          ...(options.expirySkewSeconds === undefined
            ? {}
            : { expirySkewSeconds: options.expirySkewSeconds })
        }
      : {
          path,
          basePath: options.basePath,
          sessionStore: options.sessionStore,
          clock: options.clock,
          authRoutes: options.authRoutes,
          apiClient: options.apiClient,
          ...(options.expirySkewSeconds === undefined
            ? {}
            : { expirySkewSeconds: options.expirySkewSeconds })
        }
  );

  switch (state.status) {
    case "redirect":
      await options.navigation.assign(state.intent.path);
      return {
        effect: "redirect",
        state
      };
    case "rendered":
      await options.renderer.renderHtml(state.html);
      return {
        effect: "renderHtml",
        state
      };
    case "notFound":
      await options.renderer.renderNotFound({
        path: state.path,
        session: state.session
      });
      return {
        effect: "renderNotFound",
        state
      };
    case "snapshotNotFound":
      await options.renderer.renderSnapshotNotFound({
        route: state.route,
        session: state.session
      });
      return {
        effect: "renderSnapshotNotFound",
        state
      };
    case "apiError":
      await options.renderer.renderApiError({
        path: state.path,
        ...(state.route === undefined ? {} : { route: state.route }),
        ...(state.statusCode === undefined
          ? {}
          : { statusCode: state.statusCode }),
        message: state.message,
        session: state.session
      });
      return {
        effect: "renderApiError",
        state
      };
  }
}

export function createDashboardProjectBrowserDomRenderer(
  options: DashboardProjectBrowserDomRendererOptions
): DashboardProjectBrowserRuntimeRenderer {
  const focusAfterRender = options.focusAfterRender ?? true;
  return {
    renderHtml(html) {
      renderDashboardDomState(options.root, "rendered", html);
      const title = dashboardDocumentTitle(html);
      if (title !== undefined && options.document !== undefined) {
        options.document.title = title;
      }
      focusDashboardRoot(options.root, focusAfterRender);
    },
    renderNotFound(input) {
      renderDashboardDomState(
        options.root,
        "not-found",
        renderDashboardRuntimeStatusShell({
          title: "Dashboard route not found",
          message: `No dashboard route matches ${input.path}.`,
          details: [
            `Signed in as ${input.session.subject ?? "authenticated user"}.`
          ]
        })
      );
      if (options.document !== undefined) {
        options.document.title = "Dashboard route not found - SearchLint";
      }
      focusDashboardRoot(options.root, focusAfterRender);
    },
    renderSnapshotNotFound(input) {
      renderDashboardDomState(
        options.root,
        "snapshot-not-found",
        renderDashboardRuntimeStatusShell({
          title: "Dashboard snapshot not found",
          message: `No dashboard snapshot is available for ${input.route.path}.`,
          details: [
            `Organization ${input.route.params.organizationId}`,
            `Project ${input.route.params.projectId}`,
            `Environment ${input.route.params.environmentId}`
          ]
        })
      );
      if (options.document !== undefined) {
        options.document.title = "Dashboard snapshot not found - SearchLint";
      }
      focusDashboardRoot(options.root, focusAfterRender);
    },
    renderApiError(input) {
      renderDashboardDomState(
        options.root,
        "api-error",
        renderDashboardRuntimeStatusShell({
          title: "Dashboard request failed",
          message: input.message,
          details: [
            `Path ${input.path}`,
            ...(input.route === undefined ? [] : [`Route ${input.route.path}`]),
            ...(input.statusCode === undefined
              ? []
              : [`HTTP ${input.statusCode}`])
          ]
        })
      );
      if (options.document !== undefined) {
        options.document.title = "Dashboard request failed - SearchLint";
      }
      focusDashboardRoot(options.root, focusAfterRender);
    }
  };
}

export function createDashboardBrowserHistoryRuntime(
  options: DashboardBrowserHistoryRuntimeOptions
): DashboardBrowserHistoryRuntime {
  let started = false;
  let stopped = false;
  const linkEventTarget = options.linkEventTarget ?? options.eventTarget;

  const runtimeOptionsForPath = (
    path: string
  ): DashboardProjectBrowserRuntimeOptions =>
    options.basePath === undefined
      ? {
          location: runtimeLocation(options.location, path),
          navigation: options.navigation,
          renderer: options.renderer,
          sessionStore: options.sessionStore,
          clock: options.clock,
          authRoutes: options.authRoutes,
          apiClient: options.apiClient,
          ...(options.expirySkewSeconds === undefined
            ? {}
            : { expirySkewSeconds: options.expirySkewSeconds })
        }
      : {
          location: runtimeLocation(options.location, path),
          navigation: options.navigation,
          renderer: options.renderer,
          basePath: options.basePath,
          sessionStore: options.sessionStore,
          clock: options.clock,
          authRoutes: options.authRoutes,
          apiClient: options.apiClient,
          ...(options.expirySkewSeconds === undefined
            ? {}
            : { expirySkewSeconds: options.expirySkewSeconds })
        };

  const runCurrent = () =>
    runDashboardProjectBrowserRuntime(
      runtimeOptionsForPath(options.location.pathname)
    );

  const navigate = async (
    path: string
  ): Promise<DashboardProjectBrowserRuntimeResult> => {
    const nextPath = requiredDashboardBrowserNavigationPath(
      path,
      options.basePath
    );
    if (stopped) {
      throw new Error("Dashboard browser history runtime has been stopped.");
    }
    options.history.pushState({}, "", nextPath);
    return runDashboardProjectBrowserRuntime(runtimeOptionsForPath(nextPath));
  };

  const popstateListener: DashboardBrowserEventListener = () => {
    if (!stopped) {
      void runCurrent();
    }
  };

  const clickListener: DashboardBrowserEventListener = (event) => {
    if (stopped || !isDashboardBrowserClickEvent(event)) {
      return;
    }
    const path = dashboardBrowserClickNavigationPath(
      event,
      options.location,
      options.basePath
    );
    if (path === undefined) {
      return;
    }
    event.preventDefault();
    void navigate(path);
  };

  return {
    async start() {
      if (!started) {
        stopped = false;
        started = true;
        options.eventTarget.addEventListener("popstate", popstateListener);
        linkEventTarget.addEventListener("click", clickListener);
      }
      return runCurrent();
    },
    navigate,
    stop() {
      if (!started || stopped) {
        return;
      }
      stopped = true;
      options.eventTarget.removeEventListener("popstate", popstateListener);
      linkEventTarget.removeEventListener("click", clickListener);
    }
  };
}

export async function startDashboardBrowserApp(
  config: DashboardBrowserAppConfig
): Promise<DashboardBrowserApp> {
  const validated = validateDashboardBrowserAppConfig(config);
  const sessionStore = createDashboardBrowserAuthSessionStore(
    validated.sessionStorageNamespace === undefined
      ? {
          storage: validated.storage
        }
      : {
          storage: validated.storage,
          namespace: validated.sessionStorageNamespace
        }
  );
  const apiClient = createDashboardCognitoStoredSessionApiClient({
    baseUrl: validated.apiBaseUrl,
    apiFetch: validated.apiFetch,
    tokenFetch: validated.tokenFetch,
    sessionStore,
    hostedUiDomain: validated.cognitoHostedUiDomain,
    clientId: validated.cognitoClientId,
    clock: validated.clock,
    ...(validated.expirySkewSeconds === undefined
      ? {}
      : { expirySkewSeconds: validated.expirySkewSeconds }),
    ...(validated.headers === undefined ? {} : { headers: validated.headers }),
    ...(validated.signal === undefined ? {} : { signal: validated.signal })
  });
  const renderer = createDashboardProjectBrowserDomRenderer({
    root: validated.root,
    ...(validated.document === undefined
      ? {}
      : { document: validated.document }),
    ...(validated.focusAfterRender === undefined
      ? {}
      : { focusAfterRender: validated.focusAfterRender })
  });
  const runtime = createDashboardBrowserHistoryRuntime(
    validated.basePath === undefined
      ? {
          location: validated.location,
          history: validated.history,
          eventTarget: validated.eventTarget,
          ...(validated.linkEventTarget === undefined
            ? {}
            : { linkEventTarget: validated.linkEventTarget }),
          navigation: validated.navigation,
          renderer,
          sessionStore,
          clock: validated.clock,
          authRoutes: validated.authRoutes,
          apiClient,
          ...(validated.expirySkewSeconds === undefined
            ? {}
            : { expirySkewSeconds: validated.expirySkewSeconds })
        }
      : {
          location: validated.location,
          history: validated.history,
          eventTarget: validated.eventTarget,
          ...(validated.linkEventTarget === undefined
            ? {}
            : { linkEventTarget: validated.linkEventTarget }),
          navigation: validated.navigation,
          renderer,
          basePath: validated.basePath,
          sessionStore,
          clock: validated.clock,
          authRoutes: validated.authRoutes,
          apiClient,
          ...(validated.expirySkewSeconds === undefined
            ? {}
            : { expirySkewSeconds: validated.expirySkewSeconds })
        }
  );
  const initialResult = await runtime.start();
  return {
    runtime,
    sessionStore,
    apiClient,
    renderer,
    initialResult,
    stop() {
      runtime.stop();
    },
    navigate(path) {
      return runtime.navigate(path);
    }
  };
}

export function renderDashboardHostedHtmlShell(
  config: DashboardHostedHtmlShellConfig
): string {
  const validated = validateDashboardHostedHtmlShellConfig(config);
  const title = escapeHtml(validated.title ?? "SearchLint Dashboard");
  const lang = escapeHtml(validated.lang ?? "en");
  const rootId = escapeHtml(validated.rootId ?? "searchlint-dashboard-root");
  const configScriptId = escapeHtml(
    validated.configScriptId ?? "searchlint-dashboard-config"
  );
  const nonceAttribute =
    validated.cspNonce === undefined
      ? ""
      : ` nonce="${escapeHtml(validated.cspNonce)}"`;
  const stylesheets = (validated.stylesheetUrls ?? [])
    .map(
      (href) =>
        `<link rel="stylesheet" href="${escapeHtml(requiredDashboardHostedUrl(href, "stylesheetUrl"))}">`
    )
    .join("\n  ");
  const stylesheetBlock = stylesheets === "" ? "" : `\n  ${stylesheets}`;
  const importMapBlock =
    validated.importMap === undefined
      ? ""
      : `\n  <script type="importmap"${nonceAttribute}>${escapeJsonScript(validated.importMap)}</script>`;

  return `<!doctype html>
<html lang="${lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>${stylesheetBlock}${importMapBlock}
</head>
<body>
  <div id="${rootId}" data-searchlint-dashboard-state="booting" tabindex="-1" aria-live="polite">
    <main class="searchlint-dashboard-shell" aria-labelledby="dashboard-boot-heading">
      <h1 id="dashboard-boot-heading">${title}</h1>
      <p>Loading dashboard.</p>
    </main>
  </div>
  <script id="${configScriptId}" type="application/json"${nonceAttribute}>${escapeJsonScript(validated.bootstrapConfig)}</script>
  <script type="module" src="${escapeHtml(validated.entryModuleUrl)}"${nonceAttribute}></script>
</body>
</html>`;
}

export function dashboardHostedShellAssetsFromManifest(
  manifest: DashboardHostedBrowserAssetManifest
): DashboardHostedShellAssetConfig {
  const validated = validateDashboardHostedBrowserAssetManifest(manifest);
  const importMap =
    validated.importMap === undefined
      ? undefined
      : validateDashboardHostedImportMap(validated.importMap);
  return {
    entryModuleUrl: requiredDashboardHostedUrl(
      validated.entry.moduleScript,
      "entryModuleUrl"
    ),
    ...(importMap === undefined ? {} : { importMap })
  };
}

export async function startDashboardHostedBrowserEntry(
  options: DashboardBrowserEntryOptions
): Promise<DashboardBrowserApp> {
  const validated = validateDashboardBrowserEntryOptions(options);
  const document = validated.window.document;
  const rootId = validated.rootId ?? "searchlint-dashboard-root";
  const configScriptId =
    validated.configScriptId ?? "searchlint-dashboard-config";
  const root = document.getElementById(rootId);
  if (root === null) {
    throw new Error(`Dashboard browser entry root #${rootId} was not found.`);
  }
  const configScript = document.getElementById(configScriptId);
  if (configScript === null) {
    throw new Error(
      `Dashboard browser entry config script #${configScriptId} was not found.`
    );
  }
  const bootstrapConfig = parseDashboardHostedBootstrapConfig(
    configScript.textContent,
    configScriptId
  );
  validateDashboardHostedBootstrapConfig(bootstrapConfig);
  const windowFetch: DashboardApiFetch = (url, init) =>
    validated.window.fetch(url, init);

  return startDashboardBrowserApp({
    root,
    document,
    location: validated.window.location,
    history: validated.window.history,
    eventTarget: validated.window,
    linkEventTarget: document,
    navigation: {
      assign(url) {
        validated.window.location.assign(url);
      }
    },
    storage: validated.window.sessionStorage,
    clock: validated.clock ?? { now: () => Date.now() },
    authRoutes: bootstrapConfig.authRoutes,
    apiBaseUrl: bootstrapConfig.apiBaseUrl,
    apiFetch: windowFetch,
    tokenFetch: windowFetch,
    cognitoHostedUiDomain: bootstrapConfig.cognitoHostedUiDomain,
    cognitoClientId: bootstrapConfig.cognitoClientId,
    ...(bootstrapConfig.basePath === undefined
      ? {}
      : { basePath: bootstrapConfig.basePath }),
    ...(bootstrapConfig.sessionStorageNamespace === undefined
      ? {}
      : { sessionStorageNamespace: bootstrapConfig.sessionStorageNamespace }),
    ...(bootstrapConfig.expirySkewSeconds === undefined
      ? {}
      : { expirySkewSeconds: bootstrapConfig.expirySkewSeconds }),
    ...(bootstrapConfig.headers === undefined
      ? {}
      : { headers: bootstrapConfig.headers }),
    ...(bootstrapConfig.focusAfterRender === undefined
      ? {}
      : { focusAfterRender: bootstrapConfig.focusAfterRender }),
    ...(validated.signal === undefined ? {} : { signal: validated.signal })
  });
}

export function renderDashboardProjectSectionHtml(
  section: DashboardProjectSectionModel
): string {
  switch (section.view) {
    case "onboarding":
      return `<section id="onboarding" aria-labelledby="onboarding-heading">
      <h2 id="onboarding-heading">${escapeHtml(t("dashboard.onboarding"))}</h2>
      ${renderOnboardingChecklist(section.checklist)}
    </section>`;
    case "overview":
      return `<section id="overview" aria-labelledby="overview-heading">
      <h2 id="overview-heading">${escapeHtml(t("dashboard.overview"))}</h2>
      ${renderOverviewSummary(section.summary)}
      ${renderQuotaTable(section.quotas)}
    </section>`;
    case "organization":
      return `<section id="organization" aria-labelledby="organization-heading">
      <h2 id="organization-heading">${escapeHtml(t("dashboard.organization"))}</h2>
      <dl>
        <dt>${escapeHtml(t("dashboard.name"))}</dt>
        <dd>${escapeHtml(section.organization.name)}</dd>
        <dt>${escapeHtml(t("dashboard.team"))}</dt>
        <dd>${section.teamMembers.length}</dd>
        <dt>Create project API</dt>
        <dd>${escapeHtml(section.createProjectRoute.route.method)} ${escapeHtml(section.createProjectRoute.route.path)}</dd>
      </dl>
      ${renderProjectManagementTable(section.projects)}
    </section>`;
    case "site":
      return `<section id="site" aria-labelledby="site-heading">
      <h2 id="site-heading">${escapeHtml(t("dashboard.site"))}</h2>
      <dl>
        <dt>Project</dt>
        <dd>${escapeHtml(section.project.name)}</dd>
        <dt>Site URL</dt>
        <dd>${escapeHtml(section.project.siteUrl)}</dd>
        <dt>Environment URL</dt>
        <dd>${escapeHtml(section.environment.baseUrl)}</dd>
        <dt>${escapeHtml(t("dashboard.affectedPages"))}</dt>
        <dd>${section.affectedPages}</dd>
      </dl>
    </section>`;
    case "environments":
      return `<section id="environments" aria-labelledby="environments-heading">
      <h2 id="environments-heading">${escapeHtml(t("dashboard.environments"))}</h2>
      ${renderEnvironmentTable(section.environment, section.latestCrawl)}
    </section>`;
    case "issues":
      return `<section id="issues" aria-labelledby="issues-heading">
      <h2 id="issues-heading">${escapeHtml(t("dashboard.issues"))}</h2>
      ${renderIssueSummaryTable(section.summary)}
      ${renderDiagnosticsTable(section.diagnostics)}
    </section>`;
    case "diagnostics":
      return `<section id="diagnostics" aria-labelledby="diagnostics-heading">
      <h2 id="diagnostics-heading">${escapeHtml(t("dashboard.diagnostics"))}</h2>
      ${renderDiagnosticsTable(section.diagnostics)}
    </section>`;
    case "crawlHistory":
      return `<section id="crawl-history" aria-labelledby="crawl-history-heading">
      <h2 id="crawl-history-heading">${escapeHtml(t("dashboard.crawlHistory"))}</h2>
      ${renderCrawlScheduleTable(section.crawlSchedules, section.requestCrawlRoute)}
      ${renderCrawlTable(section.crawlRuns)}
    </section>`;
    case "trends":
      return `<section id="trends" aria-labelledby="trends-heading">
      <h2 id="trends-heading">${escapeHtml(t("dashboard.trends"))}</h2>
      ${renderTrendTable(section.trends)}
      ${renderDeploymentHistoryTable(section.deploymentHistory)}
    </section>`;
    case "externalObservations":
      return `<section id="external-observations" aria-labelledby="external-observations-heading">
      <h2 id="external-observations-heading">${escapeHtml(t("dashboard.externalObservations"))}</h2>
      ${renderExternalProviderConnectors(section.connectors)}
      ${renderObservationTable(section.externalObservations)}
    </section>`;
    case "reports":
      return `<section id="reports" aria-labelledby="reports-heading">
      <h2 id="reports-heading">${escapeHtml(t("dashboard.reports"))}</h2>
      ${renderReportsTable(section.reports)}
    </section>`;
    case "team":
      return `<section id="team" aria-labelledby="team-heading">
      <h2 id="team-heading">${escapeHtml(t("dashboard.team"))}</h2>
      ${renderTeamTable(section.teamMembers)}
      ${renderTeamRbacMatrix(section.roleSummaries)}
      ${renderTeamManagementActions(section.managementActions)}
    </section>`;
    case "billing":
      return `<section id="billing" aria-labelledby="billing-heading">
      <h2 id="billing-heading">${escapeHtml(t("dashboard.billing"))}</h2>
      ${renderBillingSummaryTable(section.billing)}
      ${renderBillingInvoiceTable(section.billing?.invoices ?? [])}
      ${renderAgencyPortfolioTable(section.agency)}
      ${renderQuotaTable(section.quotas)}
    </section>`;
    case "settings":
      return `<section id="settings" aria-labelledby="settings-heading">
      <h2 id="settings-heading">${escapeHtml(t("dashboard.settings"))}</h2>
      ${renderExternalProviderSettingsTable(section.providerSettings)}
      ${renderNotificationSettingsPanel(section.notificationChannels, section.notificationRules, section.notificationDeliveryAttempts)}
      ${renderActionRouteTable(section.actionRoutes)}
    </section>`;
    case "auditLog":
      return `<section id="audit-log" aria-labelledby="audit-log-heading">
      <h2 id="audit-log-heading">${escapeHtml(t("dashboard.auditLog"))}</h2>
      ${renderAuditLogSummaryTable(section.events)}
    </section>`;
  }
}

export async function resolveDashboardAuthRouteIntent(
  options: DashboardAuthRouteIntentOptions
): Promise<DashboardAuthRouteIntent> {
  const routes = validateDashboardAuthRoutePaths(options.routes);
  const stateOptions = {
    sessionStore: options.sessionStore,
    clock: options.clock
  };
  const state = await getDashboardStoredAuthSessionState(
    options.expirySkewSeconds === undefined
      ? stateOptions
      : {
          ...stateOptions,
          expirySkewSeconds: options.expirySkewSeconds
        }
  );

  if (state.status === "missing") {
    return {
      action: "redirect",
      route: "signIn",
      path: routes.signIn,
      reason: "missing-session"
    };
  }

  if (state.status === "expired") {
    return {
      action: "redirect",
      route: routes.sessionExpired === undefined ? "signIn" : "sessionExpired",
      path: routes.sessionExpired ?? routes.signIn,
      reason: "expired-session",
      session: state.session
    };
  }

  return {
    action: "allow",
    route: "dashboard",
    path: routes.dashboard,
    session: state.session
  };
}

export function createDashboardSummary(
  snapshot: DashboardSnapshot
): DashboardSummary {
  const severityCounts: Record<Severity, number> = {
    blocker: 0,
    error: 0,
    warning: 0,
    info: 0
  };
  const pages = new Set<string>();
  for (const diagnostic of snapshot.diagnostics) {
    severityCounts[diagnostic.severity] += 1;
    pages.add(diagnostic.pageUrl);
  }

  const latestCrawl = [...snapshot.crawlRuns].sort(compareCrawlRuns)[0];

  return {
    organizationName: snapshot.organization.name,
    projectName: snapshot.project.name,
    environmentName: snapshot.environment.name,
    siteUrl: snapshot.project.siteUrl,
    totalDiagnostics: snapshot.diagnostics.length,
    affectedPages: pages.size,
    severityCounts,
    ...(latestCrawl === undefined ? {} : { latestCrawl }),
    staleExternalObservations: snapshot.externalObservations.filter(
      (observation) => observation.status !== "fresh"
    ).length,
    reportCount: snapshot.reports.length,
    teamMemberCount: snapshot.teamMembers.length,
    exhaustedQuotaCount: snapshot.quotas.filter(
      (quota) => quota.used >= quota.limit
    ).length
  };
}

export function renderDashboardHtml(snapshot: DashboardSnapshot): string {
  const summary = createDashboardSummary(snapshot);
  const diagnostics = [...snapshot.diagnostics].sort(compareDiagnostics);
  const crawlRuns = [...snapshot.crawlRuns].sort(compareCrawlRuns);
  const trends = [...snapshot.trends].sort((left, right) =>
    left.date.localeCompare(right.date)
  );
  const deploymentHistory = sortedDeploymentHistory(snapshot);
  const observations = [...snapshot.externalObservations].sort((left, right) =>
    compareExternalObservations(left, right)
  );
  const reports = sortedReports(snapshot);
  const teamMembers = sortedTeamMembers(snapshot);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(t("dashboard.title"))}</title>
</head>
<body>
  <header>
    <h1>${escapeHtml(t("dashboard.title"))}</h1>
    <p>${escapeHtml(summary.organizationName)} / ${escapeHtml(summary.projectName)} / ${escapeHtml(summary.environmentName)}</p>
  </header>
  <nav aria-label="Dashboard sections">
    <a href="#overview">${escapeHtml(t("dashboard.overview"))}</a>
    <a href="#diagnostics">${escapeHtml(t("dashboard.diagnostics"))}</a>
    <a href="#crawl-history">${escapeHtml(t("dashboard.crawlHistory"))}</a>
    <a href="#external-observations">${escapeHtml(t("dashboard.externalObservations"))}</a>
    <a href="#reports">${escapeHtml(t("dashboard.reports"))}</a>
    <a href="#team">${escapeHtml(t("dashboard.team"))}</a>
  </nav>
  <main>
    <section id="overview" aria-labelledby="overview-heading">
      <h2 id="overview-heading">${escapeHtml(t("dashboard.overview"))}</h2>
      <dl>
        <dt>${escapeHtml(t("dashboard.totalDiagnostics"))}</dt>
        <dd>${summary.totalDiagnostics}</dd>
        <dt>${escapeHtml(t("dashboard.affectedPages"))}</dt>
        <dd>${summary.affectedPages}</dd>
        <dt>${escapeHtml(t("dashboard.latestCrawl"))}</dt>
        <dd>${escapeHtml(summary.latestCrawl?.status ?? "none")}</dd>
        <dt>${escapeHtml(t("dashboard.quota"))}</dt>
        <dd>${summary.exhaustedQuotaCount} exhausted</dd>
      </dl>
    </section>
    <section id="diagnostics" aria-labelledby="diagnostics-heading">
      <h2 id="diagnostics-heading">${escapeHtml(t("dashboard.diagnostics"))}</h2>
      ${renderDiagnosticsTable(diagnostics)}
    </section>
    <section id="crawl-history" aria-labelledby="crawl-history-heading">
      <h2 id="crawl-history-heading">${escapeHtml(t("dashboard.crawlHistory"))}</h2>
      ${renderCrawlTable(crawlRuns)}
    </section>
    <section id="trends" aria-labelledby="trends-heading">
      <h2 id="trends-heading">${escapeHtml(t("dashboard.trends"))}</h2>
      ${renderTrendTable(trends)}
      ${renderDeploymentHistoryTable(deploymentHistory)}
    </section>
    <section id="external-observations" aria-labelledby="external-observations-heading">
      <h2 id="external-observations-heading">${escapeHtml(t("dashboard.externalObservations"))}</h2>
      ${renderObservationTable(observations)}
    </section>
    <section id="reports" aria-labelledby="reports-heading">
      <h2 id="reports-heading">${escapeHtml(t("dashboard.reports"))}</h2>
      ${renderReportsTable(reports)}
    </section>
    <section id="team" aria-labelledby="team-heading">
      <h2 id="team-heading">${escapeHtml(t("dashboard.team"))}</h2>
      ${renderTeamTable(teamMembers)}
    </section>
  </main>
</body>
</html>`;
}

function renderDiagnosticsTable(diagnostics: readonly Diagnostic[]): string {
  const rows =
    diagnostics.length === 0
      ? emptyTableRow(4, "No diagnostics.")
      : diagnostics
          .map(
            (diagnostic) => `<tr>
        <td>${escapeHtml(diagnostic.severity)}</td>
        <td>${escapeHtml(diagnostic.ruleId)}</td>
        <td>${escapeHtml(diagnostic.pageUrl)}</td>
        <td>${escapeHtml(diagnostic.evidence)}</td>
      </tr>`
          )
          .join("");
  return `<table aria-label="${escapeHtml(t("dashboard.diagnostics"))}">
    <thead><tr><th>${escapeHtml(t("dashboard.severity"))}</th><th>${escapeHtml(t("dashboard.rule"))}</th><th>${escapeHtml(t("dashboard.page"))}</th><th>${escapeHtml(t("dashboard.evidence"))}</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function renderOnboardingChecklist(
  checklist: readonly DashboardChecklistItem[]
): string {
  const items = checklist
    .map(
      (
        item
      ) => `<li data-dashboard-evidence-status="${escapeHtml(item.status)}">
        <strong>${escapeHtml(item.label)}</strong>
        <span>${escapeHtml(item.status)}</span>
        <span>${escapeHtml(item.evidence)}</span>
      </li>`
    )
    .join("");
  return `<ul aria-label="${escapeHtml(t("dashboard.onboarding"))}">${items}</ul>`;
}

function renderOverviewSummary(summary: DashboardSummary): string {
  return `<dl>
        <dt>${escapeHtml(t("dashboard.totalDiagnostics"))}</dt>
        <dd>${summary.totalDiagnostics}</dd>
        <dt>${escapeHtml(t("dashboard.affectedPages"))}</dt>
        <dd>${summary.affectedPages}</dd>
        <dt>${escapeHtml(t("dashboard.latestCrawl"))}</dt>
        <dd>${escapeHtml(summary.latestCrawl?.status ?? "none")}</dd>
        <dt>${escapeHtml(t("dashboard.quota"))}</dt>
        <dd>${summary.exhaustedQuotaCount} exhausted</dd>
      </dl>`;
}

function renderQuotaTable(quotas: readonly DashboardQuotaUsage[]): string {
  const rows =
    quotas.length === 0
      ? emptyTableRow(3, "No quota records.")
      : quotas
          .map(
            (quota) => `<tr>
        <td>${escapeHtml(quota.label)}</td>
        <td>${quota.used}</td>
        <td>${quota.limit}</td>
      </tr>`
          )
          .join("");
  return `<table aria-label="${escapeHtml(t("dashboard.quota"))}">
    <thead><tr><th>${escapeHtml(t("dashboard.name"))}</th><th>Used</th><th>Limit</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function renderBillingSummaryTable(
  billing: DashboardBillingSummary | undefined
): string {
  if (billing === undefined) {
    return `<table aria-label="Billing subscription">
    <tbody>${emptyTableRow(6, "No billing subscription.")}</tbody>
  </table>`;
  }
  return `<table aria-label="Billing subscription">
    <thead><tr><th>Plan</th><th>${escapeHtml(t("dashboard.status"))}</th><th>Source</th><th>Current period end</th><th>Trial ends</th><th>Overage policy</th></tr></thead>
    <tbody><tr>
      <td>${escapeHtml(billing.planTier)}</td>
      <td>${escapeHtml(billing.status)}</td>
      <td>${escapeHtml(billing.source)}</td>
      <td>${escapeHtml(billing.currentPeriodEnd)}</td>
      <td>${escapeHtml(billing.trialEndsAt ?? "none")}</td>
      <td>${escapeHtml(billing.overagePolicy)}</td>
    </tr></tbody>
  </table>`;
}

function renderBillingInvoiceTable(
  invoices: readonly DashboardBillingInvoice[]
): string {
  const rows =
    invoices.length === 0
      ? emptyTableRow(5, "No invoices.")
      : [...invoices]
          .sort((left, right) => left.id.localeCompare(right.id))
          .map(
            (invoice) => `<tr>
        <td>${escapeHtml(invoice.id)}</td>
        <td>${escapeHtml(invoice.status)}</td>
        <td>${escapeHtml(formatMoney(invoice.amountDueCents, invoice.currency))}</td>
        <td>${escapeHtml(invoice.currency.toUpperCase())}</td>
        <td>${escapeHtml(invoice.dueAt ?? "none")}</td>
      </tr>`
          )
          .join("");
  return `<table aria-label="Billing invoices">
    <thead><tr><th>Invoice</th><th>${escapeHtml(t("dashboard.status"))}</th><th>Amount due</th><th>Currency</th><th>Due</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function renderAgencyPortfolioTable(
  agency: DashboardAgencySummary | undefined
): string {
  if (agency === undefined) {
    return `<table aria-label="Agency portfolio">
    <tbody>${emptyTableRow(7, "No agency portfolio.")}</tbody>
  </table>`;
  }
  const rows =
    agency.clients.length === 0
      ? emptyTableRow(7, "No agency clients.")
      : [...agency.clients]
          .sort((left, right) =>
            left.clientName.localeCompare(right.clientName)
          )
          .map(
            (client) => `<tr>
        <td>${escapeHtml(client.clientName)}</td>
        <td>${escapeHtml(client.status)}</td>
        <td>${client.projectCount}</td>
        <td>${client.openDiagnostics}</td>
        <td>${client.blockerDiagnostics}</td>
        <td>${client.healthScore}</td>
        <td>${escapeHtml(client.slaStatus)}</td>
      </tr>`
          )
          .join("");
  return `<table aria-label="Agency portfolio">
    <caption>${escapeHtml(agency.brandLabel ?? "Agency portfolio")} - ${agency.activeClientCount}/${agency.clientCount} active clients, ${agency.overdueSlaCount} overdue SLA</caption>
    <thead><tr><th>Client</th><th>${escapeHtml(t("dashboard.status"))}</th><th>Projects</th><th>Diagnostics</th><th>Blockers</th><th>Health</th><th>SLA</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function renderCrawlTable(crawlRuns: readonly DashboardCrawlRun[]): string {
  const rows =
    crawlRuns.length === 0
      ? emptyTableRow(4, "No crawl runs.")
      : crawlRuns
          .map(
            (run) => `<tr>
        <td>${escapeHtml(run.status)}</td>
        <td>${escapeHtml(run.requestedAt)}</td>
        <td>${run.crawledUrls}</td>
        <td>${run.failedUrls}</td>
      </tr>`
          )
          .join("");
  return `<table aria-label="${escapeHtml(t("dashboard.crawlHistory"))}">
    <thead><tr><th>${escapeHtml(t("dashboard.status"))}</th><th>${escapeHtml(t("dashboard.requested"))}</th><th>${escapeHtml(t("dashboard.crawledUrls"))}</th><th>${escapeHtml(t("dashboard.failedUrls"))}</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function renderCrawlScheduleTable(
  schedules: readonly DashboardCrawlSchedule[],
  requestCrawlRoute: DashboardActionRoute
): string {
  const rows =
    schedules.length === 0
      ? emptyTableRow(6, "No crawl schedules.")
      : schedules
          .map(
            (schedule) => `<tr>
        <td>${escapeHtml(schedule.name)}</td>
        <td>${escapeHtml(schedule.cadence)}</td>
        <td>${escapeHtml(schedule.enabled ? "Enabled" : "Paused")}</td>
        <td>${escapeHtml(schedule.nextRunAt ?? "not scheduled")}</td>
        <td>${escapeHtml(schedule.lastRunAt ?? "never")}</td>
        <td>${schedule.targetUrlCount}</td>
      </tr>`
          )
          .join("");
  return `<h3>Crawl scheduling</h3>
  <dl>
    <dt>Request crawl API</dt>
    <dd>${escapeHtml(requestCrawlRoute.route.method)} ${escapeHtml(requestCrawlRoute.route.path)}</dd>
  </dl>
  <table aria-label="Crawl scheduling">
    <thead><tr><th>${escapeHtml(t("dashboard.name"))}</th><th>Cadence</th><th>${escapeHtml(t("dashboard.status"))}</th><th>Next run</th><th>Last run</th><th>Target URLs</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function renderTrendTable(trends: readonly DashboardTrendPoint[]): string {
  const rows =
    trends.length === 0
      ? emptyTableRow(6, "No trend points.")
      : trends
          .map(
            (point) => `<tr>
        <td>${escapeHtml(point.date)}</td>
        <td>${point.diagnostics}</td>
        <td>${point.blockers}</td>
        <td>${point.errors}</td>
        <td>${point.warnings}</td>
        <td>${point.infos}</td>
      </tr>`
          )
          .join("");
  return `<table aria-label="${escapeHtml(t("dashboard.trends"))}">
    <thead><tr><th>${escapeHtml(t("dashboard.date"))}</th><th>${escapeHtml(t("dashboard.total"))}</th><th>${escapeHtml(t("dashboard.blockers"))}</th><th>${escapeHtml(t("dashboard.errors"))}</th><th>${escapeHtml(t("dashboard.warnings"))}</th><th>${escapeHtml(t("dashboard.info"))}</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function renderDeploymentHistoryTable(
  deployments: readonly DashboardDeploymentRecord[]
): string {
  const rows =
    deployments.length === 0
      ? emptyTableRow(8, "No deployment history.")
      : deployments
          .map((deployment) => {
            const delta =
              deployment.diagnosticsAfter - deployment.diagnosticsBefore;
            return `<tr>
        <td>${escapeHtml(deployment.deployedAt)}</td>
        <td>${escapeHtml(deployment.environmentName)}</td>
        <td>${escapeHtml(deployment.commitRef)}</td>
        <td>${escapeHtml(deployment.status)}</td>
        <td>${deployment.diagnosticsBefore}</td>
        <td>${deployment.diagnosticsAfter}</td>
        <td>${delta > 0 ? `+${delta}` : delta}</td>
        <td>${escapeHtml(deployment.annotation ?? "")}</td>
      </tr>`;
          })
          .join("");
  return `<h3>Deployment history</h3>
  <table aria-label="Deployment history">
    <thead><tr><th>Deployed at</th><th>Environment</th><th>Commit</th><th>${escapeHtml(t("dashboard.status"))}</th><th>Before</th><th>After</th><th>Delta</th><th>Annotation</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function renderObservationTable(
  observations: readonly DashboardExternalObservation[]
): string {
  const rows =
    observations.length === 0
      ? emptyTableRow(5, "No external observations.")
      : observations
          .map(
            (observation) => `<tr>
        <td>${escapeHtml(observation.provider)}</td>
        <td>${escapeHtml(observation.status)}</td>
        <td>${escapeHtml(observation.subjectUrl)}</td>
        <td>${escapeHtml(observation.observedAt)}</td>
        <td>${escapeHtml(observation.summary)}</td>
      </tr>`
          )
          .join("");
  return `<table aria-label="${escapeHtml(t("dashboard.externalObservations"))}">
    <thead><tr><th>${escapeHtml(t("dashboard.provider"))}</th><th>${escapeHtml(t("dashboard.status"))}</th><th>${escapeHtml(t("dashboard.subject"))}</th><th>${escapeHtml(t("dashboard.observed"))}</th><th>${escapeHtml(t("dashboard.summary"))}</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function renderExternalProviderConnectors(
  connectors: readonly DashboardExternalProviderConnector[]
): string {
  const rows = connectors
    .map(
      (connector) => `<tr>
        <td>${escapeHtml(connector.provider)}</td>
        <td>${escapeHtml(connector.status)}</td>
        <td>
          <form method="${escapeHtml(connector.method.toLowerCase())}" action="${escapeHtml(connector.pathTemplate)}" data-dashboard-action="${escapeHtml(connector.action)}" data-dashboard-operation="${escapeHtml(connector.operation)}" data-provider="${escapeHtml(connector.provider)}" data-request-schema="${escapeHtml(connector.requestSchemaVersion)}" data-response-schema="${escapeHtml(connector.responseSchemaVersion)}">
            <input type="hidden" name="provider" value="${escapeHtml(connector.provider)}">
            <input type="hidden" name="state" value="">
            <input type="hidden" name="redirectUri" value="">
            <button type="submit">${escapeHtml(connector.provider === "google" ? t("dashboard.connectGoogle") : t("dashboard.connectYandex"))}</button>
          </form>
        </td>
      </tr>`
    )
    .join("");
  return `<table aria-label="${escapeHtml(t("dashboard.connectors"))}">
    <thead><tr><th>${escapeHtml(t("dashboard.provider"))}</th><th>${escapeHtml(t("dashboard.connectionStatus"))}</th><th>${escapeHtml(t("dashboard.connectors"))}</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function renderExternalProviderSettingsTable(
  settings: readonly DashboardExternalProviderSettings[]
): string {
  const rows = settings
    .map(
      (providerSettings) => `<tr>
        <td>${escapeHtml(providerSettings.provider)}</td>
        <td>${escapeHtml(providerSettings.status)}</td>
        <td>${providerSettings.observedSubjectCount}</td>
        <td>${escapeHtml(providerSettings.oauthStartMethod)} ${escapeHtml(providerSettings.oauthStartPathTemplate)}</td>
        <td>${escapeHtml(providerSettings.oauthStartOperation)}</td>
        <td>${escapeHtml(providerSettings.requiredScopes.join(", "))}</td>
        <td>${escapeHtml(providerSettings.redirectUri)}</td>
      </tr>`
    )
    .join("");
  return `<h3>Google/Yandex settings</h3>
  <table aria-label="Google/Yandex settings">
    <thead><tr><th>${escapeHtml(t("dashboard.provider"))}</th><th>${escapeHtml(t("dashboard.connectionStatus"))}</th><th>Observed subjects</th><th>OAuth start route</th><th>Operation</th><th>Required scopes</th><th>Redirect URI</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function renderReportsTable(
  reports: readonly DashboardReportSummary[]
): string {
  const rows =
    reports.length === 0
      ? emptyTableRow(4, "No reports.")
      : reports
          .map(
            (report) => `<tr>
        <td>${escapeHtml(report.title)}</td>
        <td>${escapeHtml(report.generatedAt)}</td>
        <td>${escapeHtml(report.locale)}</td>
        <td>${report.totalDiagnostics}</td>
      </tr>`
          )
          .join("");
  return `<table aria-label="${escapeHtml(t("dashboard.reports"))}">
    <thead><tr><th>${escapeHtml(t("dashboard.titleColumn"))}</th><th>${escapeHtml(t("dashboard.generatedAt"))}</th><th>${escapeHtml(t("dashboard.locale"))}</th><th>${escapeHtml(t("dashboard.total"))}</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function renderTeamTable(teamMembers: readonly DashboardTeamMember[]): string {
  const rows =
    teamMembers.length === 0
      ? emptyTableRow(3, "No team members.")
      : teamMembers
          .map(
            (member) => `<tr>
        <td>${escapeHtml(member.principalId)}</td>
        <td>${escapeHtml(member.displayName)}</td>
        <td>${escapeHtml(member.role)}</td>
      </tr>`
          )
          .join("");
  return `<table aria-label="${escapeHtml(t("dashboard.team"))}">
    <thead><tr><th>Principal</th><th>${escapeHtml(t("dashboard.name"))}</th><th>${escapeHtml(t("dashboard.role"))}</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function renderTeamRbacMatrix(
  roleSummaries: readonly DashboardTeamRbacRoleSummary[]
): string {
  const rows = roleSummaries
    .map(
      (summary) => `<tr>
        <td>${escapeHtml(summary.role)}</td>
        <td>${summary.memberCount}</td>
        <td>${escapeHtml(summary.permissions.join(", "))}</td>
      </tr>`
    )
    .join("");
  return `<h3>Team/RBAC management</h3>
  <table aria-label="Team RBAC matrix">
    <thead><tr><th>${escapeHtml(t("dashboard.role"))}</th><th>Members</th><th>Permissions</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function renderTeamManagementActions(
  actions: readonly DashboardTeamManagementAction[]
): string {
  if (actions.length === 0) {
    return "";
  }

  const rows = actions
    .map(
      (action) => `<tr>
        <td>${escapeHtml(action.label)}</td>
        <td>${escapeHtml(action.action ?? "static-contract")}</td>
        <td>${escapeHtml(action.method ?? "not-wired")}</td>
        <td>${escapeHtml(action.pathTemplate ?? "not-wired")}</td>
        <td>${escapeHtml(action.evidence)}</td>
      </tr>`
    )
    .join("");
  return `<h4>Team management actions</h4>
  <table aria-label="Team management actions">
    <thead><tr><th>${escapeHtml(t("dashboard.action"))}</th><th>API action</th><th>${escapeHtml(t("dashboard.method"))}</th><th>${escapeHtml(t("dashboard.path"))}</th><th>${escapeHtml(t("dashboard.evidenceStatus"))}</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function renderEnvironmentTable(
  environment: DashboardEnvironment,
  latestCrawl: DashboardCrawlRun | undefined
): string {
  return `<table aria-label="${escapeHtml(t("dashboard.environments"))}">
    <thead><tr><th>${escapeHtml(t("dashboard.name"))}</th><th>Base URL</th><th>${escapeHtml(t("dashboard.latestCrawl"))}</th></tr></thead>
    <tbody><tr><td>${escapeHtml(environment.name)}</td><td>${escapeHtml(environment.baseUrl)}</td><td>${escapeHtml(latestCrawl?.status ?? "none")}</td></tr></tbody>
  </table>`;
}

function renderIssueSummaryTable(summary: DashboardSummary): string {
  return `<table aria-label="${escapeHtml(t("dashboard.issues"))}">
    <thead><tr><th>${escapeHtml(t("dashboard.severity"))}</th><th>${escapeHtml(t("dashboard.total"))}</th></tr></thead>
    <tbody>
      <tr><td>${escapeHtml(t("dashboard.blockers"))}</td><td>${summary.severityCounts.blocker}</td></tr>
      <tr><td>${escapeHtml(t("dashboard.errors"))}</td><td>${summary.severityCounts.error}</td></tr>
      <tr><td>${escapeHtml(t("dashboard.warnings"))}</td><td>${summary.severityCounts.warning}</td></tr>
      <tr><td>${escapeHtml(t("dashboard.info"))}</td><td>${summary.severityCounts.info}</td></tr>
    </tbody>
  </table>`;
}

function renderActionRouteTable(
  actionRoutes: readonly DashboardActionRoute[]
): string {
  const rows = actionRoutes
    .map(
      ({ action, route }) => `<tr>
        <td>${escapeHtml(action)}</td>
        <td>${escapeHtml(route.method)}</td>
        <td>${escapeHtml(route.path)}</td>
        <td>${escapeHtml(route.stability)}</td>
      </tr>`
    )
    .join("");
  return `<table aria-label="${escapeHtml(t("dashboard.settings"))}">
    <thead><tr><th>${escapeHtml(t("dashboard.action"))}</th><th>${escapeHtml(t("dashboard.method"))}</th><th>${escapeHtml(t("dashboard.path"))}</th><th>Stability</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function renderNotificationChannelTable(
  channels: readonly DashboardNotificationChannel[]
): string {
  const rows =
    channels.length === 0
      ? emptyTableRow(5, "No notification channels.")
      : channels
          .map(
            (channel) => `<tr>
        <td>${escapeHtml(channel.name)}</td>
        <td>${escapeHtml(channel.kind)}</td>
        <td>${escapeHtml(channel.targetDisplay)}</td>
        <td>${escapeHtml(channel.enabled ? "enabled" : "disabled")}</td>
        <td>${escapeHtml(channel.id)}</td>
      </tr>`
          )
          .join("");
  return `<table aria-label="Notification channels">
    <thead><tr><th>${escapeHtml(t("dashboard.name"))}</th><th>Channel</th><th>${escapeHtml(t("dashboard.target"))}</th><th>${escapeHtml(t("dashboard.status"))}</th><th>ID</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function renderNotificationSettingsPanel(
  channels: readonly DashboardNotificationChannel[],
  rules: readonly DashboardNotificationRule[],
  attempts: readonly DashboardNotificationDeliveryAttempt[]
): string {
  const enabledChannelCount = channels.filter(
    (channel) => channel.enabled
  ).length;
  const enabledRuleCount = rules.filter((rule) => rule.enabled).length;
  const retryScheduledCount = attempts.filter(
    (attempt) => attempt.status === "retry_scheduled"
  ).length;
  return `<h3>Notification settings</h3>
  <h4>Notification summary</h4>
  <dl aria-label="Notification summary">
    <dt>Enabled channels</dt>
    <dd>${enabledChannelCount}</dd>
    <dt>Enabled rules</dt>
    <dd>${enabledRuleCount}</dd>
    <dt>Retry scheduled</dt>
    <dd>${retryScheduledCount}</dd>
  </dl>
  ${renderNotificationChannelTable(channels)}
  ${renderNotificationRuleTable(rules)}
  ${renderNotificationDeliveryHistoryTable(attempts)}`;
}

function renderNotificationRuleTable(
  rules: readonly DashboardNotificationRule[]
): string {
  const rows =
    rules.length === 0
      ? emptyTableRow(6, "No notification rules.")
      : rules
          .map(
            (rule) => `<tr>
        <td>${escapeHtml(rule.name)}</td>
        <td>${escapeHtml(rule.eventKinds.join(", "))}</td>
        <td>${escapeHtml(rule.severityThreshold ?? "none")}</td>
        <td>${escapeHtml(rule.digest)}</td>
        <td>${escapeHtml(rule.enabled ? "enabled" : "disabled")}</td>
        <td>${escapeHtml(notificationRulePauseSummary(rule))}</td>
      </tr>`
          )
          .join("");
  return `<table aria-label="Notification rules">
    <thead><tr><th>${escapeHtml(t("dashboard.name"))}</th><th>Events</th><th>Severity threshold</th><th>Digest</th><th>${escapeHtml(t("dashboard.status"))}</th><th>Pause</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function renderNotificationDeliveryHistoryTable(
  attempts: readonly DashboardNotificationDeliveryAttempt[]
): string {
  const rows =
    attempts.length === 0
      ? emptyTableRow(7, "No notification delivery history.")
      : attempts
          .map(
            (attempt) => `<tr>
        <td>${escapeHtml(attempt.id)}</td>
        <td>${escapeHtml(attempt.channelKind)}</td>
        <td>${escapeHtml(attempt.status)}</td>
        <td>${attempt.attempt}</td>
        <td>${escapeHtml(attempt.attemptedAt)}</td>
        <td>${escapeHtml(attempt.nextRetryAt ?? "none")}</td>
        <td>${escapeHtml(attempt.failureReason ?? "none")}</td>
      </tr>`
          )
          .join("");
  return `<table aria-label="Notification delivery history">
    <thead><tr><th>ID</th><th>Channel</th><th>${escapeHtml(t("dashboard.status"))}</th><th>Attempt</th><th>Attempted</th><th>Next retry</th><th>Failure</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function renderAuditLogSummaryTable(
  events: readonly DashboardAuditLogSummaryItem[]
): string {
  const rows =
    events.length === 0
      ? emptyTableRow(3, "No audit events.")
      : events
          .map(
            (event) => `<tr>
        <td>${escapeHtml(event.action)}</td>
        <td>${escapeHtml(event.target)}</td>
        <td>${escapeHtml(event.evidence)}</td>
      </tr>`
          )
          .join("");
  return `<table aria-label="${escapeHtml(t("dashboard.auditLog"))}">
    <thead><tr><th>${escapeHtml(t("dashboard.action"))}</th><th>${escapeHtml(t("dashboard.target"))}</th><th>${escapeHtml(t("dashboard.evidence"))}</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function emptyTableRow(colspan: number, message: string): string {
  return `<tr><td colspan="${colspan}">${escapeHtml(message)}</td></tr>`;
}

function renderProjectNavigationItem(
  item: DashboardProjectNavigationItem
): string {
  const current = item.current ? ' aria-current="page"' : "";
  return `<a href="${escapeHtml(item.path)}"${current}>${escapeHtml(item.label)}</a>`;
}

function renderProjectManagementTable(
  projects: readonly DashboardProjectManagementViewItem[]
): string {
  const rows =
    projects.length === 0
      ? emptyTableRow(6, "No projects.")
      : projects
          .map(
            (project) => `<tr>
        <td>${escapeHtml(project.name)}</td>
        <td>${escapeHtml(project.siteUrl)}</td>
        <td>${project.environmentCount}</td>
        <td>${project.openDiagnostics}</td>
        <td>${escapeHtml(project.latestCrawlStatus ?? "none")}</td>
        <td>${project.current ? "Current" : "Available"}</td>
      </tr>`
          )
          .join("");
  return `<h3>Project management</h3>
  <table aria-label="Project management">
    <thead><tr><th>${escapeHtml(t("dashboard.name"))}</th><th>Site URL</th><th>Environments</th><th>Open diagnostics</th><th>Latest crawl</th><th>Status</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function renderDashboardOrganizationSwitcher(
  items: readonly DashboardOrganizationSwitcherItem[]
): string {
  const links = items
    .map((item) => {
      const current = item.current ? ' aria-current="true"' : "";
      const label = `${item.organizationName} / ${item.projectName} / ${item.environmentName}`;
      return `<a href="${escapeHtml(item.path)}"${current}>${escapeHtml(label)}</a>`;
    })
    .join("\n      ");
  return `<nav aria-label="Organization switcher">
      ${links}
    </nav>`;
}

function compareDiagnostics(left: Diagnostic, right: Diagnostic): number {
  const severityOrder =
    severityRank[right.severity] - severityRank[left.severity];
  if (severityOrder !== 0) {
    return severityOrder;
  }
  return (
    left.ruleId.localeCompare(right.ruleId) ||
    left.pageUrl.localeCompare(right.pageUrl) ||
    left.fingerprint.localeCompare(right.fingerprint)
  );
}

function compareCrawlRuns(
  left: DashboardCrawlRun,
  right: DashboardCrawlRun
): number {
  return (
    right.requestedAt.localeCompare(left.requestedAt) ||
    left.id.localeCompare(right.id)
  );
}

function sortedCrawlSchedules(
  snapshot: DashboardSnapshot
): DashboardCrawlSchedule[] {
  return [...(snapshot.crawlSchedules ?? [])]
    .map(validateDashboardCrawlSchedule)
    .sort(
      (left, right) =>
        (left.nextRunAt ?? "").localeCompare(right.nextRunAt ?? "") ||
        left.id.localeCompare(right.id)
    );
}

function sortedDeploymentHistory(
  snapshot: DashboardSnapshot
): DashboardDeploymentRecord[] {
  return [...(snapshot.deploymentHistory ?? [])]
    .map(validateDashboardDeploymentRecord)
    .sort(
      (left, right) =>
        right.deployedAt.localeCompare(left.deployedAt) ||
        left.id.localeCompare(right.id)
    );
}

function sortedExternalObservations(
  snapshot: DashboardSnapshot
): DashboardExternalObservation[] {
  return [...snapshot.externalObservations].sort(compareExternalObservations);
}

function createDashboardExternalProviderConnectors(
  snapshot: DashboardSnapshot
): readonly DashboardExternalProviderConnector[] {
  const contract = routeContractForOperation(
    "startExternalProviderOAuthConnection"
  );
  return (["google", "yandex"] as const).map((provider) => ({
    provider,
    status: externalProviderConnectorStatus(snapshot, provider),
    action: "startExternalProviderOAuthConnection",
    operation: contract.operation,
    method: contract.method,
    pathTemplate: contract.path,
    requestSchemaVersion: contract.requestSchemaVersion,
    responseSchemaVersion: contract.responseSchemaVersion
  }));
}

function createDashboardExternalProviderSettings(
  snapshot: DashboardSnapshot
): readonly DashboardExternalProviderSettings[] {
  return createDashboardExternalProviderConnectors(snapshot).map(
    (connector) => ({
      provider: connector.provider,
      status: connector.status,
      observedSubjectCount: new Set(
        snapshot.externalObservations
          .filter((observation) => observation.provider === connector.provider)
          .map((observation) => observation.subjectUrl)
      ).size,
      oauthStartOperation: connector.operation,
      oauthStartMethod: connector.method,
      oauthStartPathTemplate: connector.pathTemplate,
      requiredScopes: externalProviderRequiredScopes(connector.provider),
      redirectUri: `/dashboard/integrations/${connector.provider}/callback`
    })
  );
}

function externalProviderRequiredScopes(
  provider: DashboardProvider
): readonly string[] {
  return provider === "google"
    ? ["openid", "email", "https://www.googleapis.com/auth/webmasters.readonly"]
    : ["login:email", "webmaster:read", "metrika:read"];
}

function createDashboardOnboardingChecklist(
  snapshot: DashboardSnapshot
): readonly DashboardChecklistItem[] {
  const summary = createDashboardSummary(snapshot);
  return [
    {
      label: "Project configured",
      status:
        snapshot.project.siteUrl.trim() === "" ? "needsAttention" : "complete",
      evidence: snapshot.project.siteUrl
    },
    {
      label: "Environment configured",
      status:
        snapshot.environment.baseUrl.trim() === ""
          ? "needsAttention"
          : "complete",
      evidence: snapshot.environment.baseUrl
    },
    {
      label: "First crawl recorded",
      status: snapshot.crawlRuns.length === 0 ? "needsAttention" : "complete",
      evidence:
        summary.latestCrawl === undefined
          ? "No crawl runs."
          : `Latest crawl ${summary.latestCrawl.status}.`
    },
    {
      label: "External observations connected",
      status:
        snapshot.externalObservations.length === 0
          ? "needsAttention"
          : "complete",
      evidence: `${snapshot.externalObservations.length} observations.`
    },
    {
      label: "Team access configured",
      status: snapshot.teamMembers.length === 0 ? "needsAttention" : "complete",
      evidence: `${snapshot.teamMembers.length} team members.`
    }
  ];
}

function createDashboardAuditLogSummary(
  snapshot: DashboardSnapshot
): readonly DashboardAuditLogSummaryItem[] {
  return [
    {
      action: "project.viewed",
      target: snapshot.project.id,
      evidence: `Project ${snapshot.project.name} loaded for ${snapshot.organization.name}.`
    },
    {
      action: "environment.viewed",
      target: snapshot.environment.id,
      evidence: `Environment ${snapshot.environment.name} base URL ${snapshot.environment.baseUrl}.`
    },
    {
      action: "dashboard.snapshot.loaded",
      target: snapshot.organization.id,
      evidence: `${snapshot.diagnostics.length} diagnostics, ${snapshot.crawlRuns.length} crawl runs, ${snapshot.reports.length} reports.`
    }
  ];
}

function externalProviderConnectorStatus(
  snapshot: DashboardSnapshot,
  provider: DashboardProvider
): DashboardExternalProviderConnectorStatus {
  const observations = snapshot.externalObservations.filter(
    (observation) => observation.provider === provider
  );
  if (observations.length === 0) {
    return "notConnected";
  }
  return observations.some((observation) => observation.status === "fresh")
    ? "connected"
    : "stale";
}

function compareExternalObservations(
  left: DashboardExternalObservation,
  right: DashboardExternalObservation
): number {
  return left.provider === right.provider
    ? left.subjectUrl.localeCompare(right.subjectUrl)
    : left.provider.localeCompare(right.provider);
}

function sortedReports(snapshot: DashboardSnapshot): DashboardReportSummary[] {
  return [...snapshot.reports].sort((left, right) =>
    right.generatedAt.localeCompare(left.generatedAt)
  );
}

function sortedTeamMembers(snapshot: DashboardSnapshot): DashboardTeamMember[] {
  return [...snapshot.teamMembers].sort((left, right) =>
    left.displayName.localeCompare(right.displayName)
  );
}

function createDashboardTeamRbacRoleSummaries(
  snapshot: DashboardSnapshot
): readonly DashboardTeamRbacRoleSummary[] {
  const roles = dashboardSnapshotHasPermission(snapshot, "member:manage")
    ? (Object.keys(dashboardRolePermissions) as DashboardRole[])
    : [snapshot.viewerRole ?? "viewer"];
  return roles.map((role) => ({
    role,
    permissions: dashboardRolePermissions[role],
    memberCount: snapshot.teamMembers.filter((member) => member.role === role)
      .length
  }));
}

function dashboardSnapshotHasPermission(
  snapshot: DashboardSnapshot,
  permission: string
): boolean {
  const role = snapshot.viewerRole ?? "owner";
  return dashboardRolePermissions[role].includes(permission);
}

function createDashboardTeamManagementActions(): readonly DashboardTeamManagementAction[] {
  const addMemberRoute = dashboardActionRoute("addMember");
  return [
    {
      label: "Invite member",
      action: addMemberRoute.action,
      method: addMemberRoute.route.method,
      pathTemplate: addMemberRoute.route.path,
      evidence: "checked addMember API route contract"
    },
    {
      label: "Remove member",
      evidence: "local API foundation supports member removal"
    },
    {
      label: "Transfer ownership",
      evidence: "local API foundation supports ownership transfer"
    }
  ];
}

function sortedNotificationChannels(
  snapshot: DashboardSnapshot
): DashboardNotificationChannel[] {
  return [...(snapshot.notificationChannels ?? [])].sort((left, right) => {
    const kindOrder = left.kind.localeCompare(right.kind);
    return kindOrder === 0 ? left.name.localeCompare(right.name) : kindOrder;
  });
}

function sortedNotificationRules(
  snapshot: DashboardSnapshot
): DashboardNotificationRule[] {
  return [...(snapshot.notificationRules ?? [])].sort((left, right) =>
    left.name.localeCompare(right.name)
  );
}

function sortedNotificationDeliveryAttempts(
  snapshot: DashboardSnapshot
): DashboardNotificationDeliveryAttempt[] {
  return [...(snapshot.notificationDeliveryAttempts ?? [])].sort(
    (left, right) => {
      const timeOrder = right.attemptedAt.localeCompare(left.attemptedAt);
      return timeOrder === 0 ? left.id.localeCompare(right.id) : timeOrder;
    }
  );
}

function notificationRulePauseSummary(rule: DashboardNotificationRule): string {
  const parts = [
    ...(rule.mutedUntil === undefined
      ? []
      : [`muted until ${rule.mutedUntil}`]),
    ...(rule.snoozedUntil === undefined
      ? []
      : [`snoozed until ${rule.snoozedUntil}`])
  ];
  return parts.length === 0 ? "none" : parts.join("; ");
}

function formatMoney(amountDueCents: number, currency: string): string {
  return `${currency.toUpperCase()} ${(amountDueCents / 100).toFixed(2)}`;
}

function isDashboardSnapshot(value: unknown): value is DashboardSnapshot {
  if (!isRecord(value)) {
    return false;
  }
  return (
    isDashboardOrganization(value.organization) &&
    isDashboardProject(value.project) &&
    isDashboardEnvironment(value.environment) &&
    (value.organizationSwitchTargets === undefined ||
      (Array.isArray(value.organizationSwitchTargets) &&
        value.organizationSwitchTargets.every(
          isDashboardOrganizationSwitchTarget
        ))) &&
    (value.projectManagement === undefined ||
      (Array.isArray(value.projectManagement) &&
        value.projectManagement.every(isDashboardProjectManagementItem))) &&
    (value.crawlSchedules === undefined ||
      (Array.isArray(value.crawlSchedules) &&
        value.crawlSchedules.every(isDashboardCrawlSchedule))) &&
    (value.deploymentHistory === undefined ||
      (Array.isArray(value.deploymentHistory) &&
        value.deploymentHistory.every(isDashboardDeploymentRecord))) &&
    Array.isArray(value.diagnostics) &&
    value.diagnostics.every(isDashboardDiagnostic) &&
    Array.isArray(value.crawlRuns) &&
    Array.isArray(value.trends) &&
    Array.isArray(value.externalObservations) &&
    Array.isArray(value.reports) &&
    Array.isArray(value.quotas) &&
    (value.viewerRole === undefined ||
      (typeof value.viewerRole === "string" &&
        Object.hasOwn(dashboardRolePermissions, value.viewerRole))) &&
    Array.isArray(value.teamMembers)
  );
}

function isDashboardOrganizationSwitchTarget(
  value: unknown
): value is DashboardOrganizationSwitchTarget {
  return (
    isRecord(value) &&
    typeof value.organizationId === "string" &&
    typeof value.organizationName === "string" &&
    typeof value.projectId === "string" &&
    typeof value.projectName === "string" &&
    typeof value.environmentId === "string" &&
    typeof value.environmentName === "string"
  );
}

function isDashboardCrawlSchedule(
  value: unknown
): value is DashboardCrawlSchedule {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    ["hourly", "daily", "weekly", "monthly", "manual"].includes(
      String(value.cadence)
    ) &&
    typeof value.enabled === "boolean" &&
    (value.nextRunAt === undefined || typeof value.nextRunAt === "string") &&
    (value.lastRunAt === undefined || typeof value.lastRunAt === "string") &&
    typeof value.targetUrlCount === "number"
  );
}

function isDashboardDeploymentRecord(
  value: unknown
): value is DashboardDeploymentRecord {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.deployedAt === "string" &&
    typeof value.environmentName === "string" &&
    typeof value.commitRef === "string" &&
    ["succeeded", "failed", "rolled_back"].includes(String(value.status)) &&
    typeof value.diagnosticsBefore === "number" &&
    typeof value.diagnosticsAfter === "number" &&
    (value.annotation === undefined || typeof value.annotation === "string")
  );
}

function isDashboardOrganization(
  value: unknown
): value is DashboardOrganization {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string"
  );
}

function isDashboardProjectManagementItem(
  value: unknown
): value is DashboardProjectManagementItem {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.siteUrl === "string" &&
    typeof value.environmentCount === "number" &&
    typeof value.openDiagnostics === "number" &&
    (value.latestCrawlStatus === undefined ||
      ["queued", "running", "succeeded", "failed", "cancelled"].includes(
        String(value.latestCrawlStatus)
      ))
  );
}

function isDashboardProject(value: unknown): value is DashboardProject {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.siteUrl === "string"
  );
}

function isDashboardEnvironment(value: unknown): value is DashboardEnvironment {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.baseUrl === "string"
  );
}

function isDashboardDiagnostic(value: unknown): value is Diagnostic {
  return (
    isRecord(value) &&
    typeof value.ruleId === "string" &&
    typeof value.severity === "string" &&
    typeof value.confidence === "string" &&
    typeof value.pageUrl === "string" &&
    typeof value.title === "string" &&
    typeof value.evidence === "string" &&
    typeof value.observedAt === "string" &&
    typeof value.fingerprint === "string"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function t(key: DashboardMessageKey): string {
  return dashboardMessages[key];
}

function validateDashboardAuthRoutePaths(
  routes: DashboardAuthRoutePaths
): DashboardAuthRoutePaths {
  const signIn = requiredDashboardRoutePath(routes.signIn, "signIn");
  const dashboard = requiredDashboardRoutePath(routes.dashboard, "dashboard");
  const validatedRoutes: DashboardAuthRoutePaths = {
    signIn,
    dashboard
  };
  if (routes.sessionExpired !== undefined) {
    validatedRoutes.sessionExpired = requiredDashboardRoutePath(
      routes.sessionExpired,
      "sessionExpired"
    );
  }
  return validatedRoutes;
}

function validateDashboardProjectRouteParams(
  params: DashboardProjectRouteParams
): DashboardProjectRouteParams {
  return {
    organizationId: requiredDashboardRouteSegment(
      params.organizationId,
      "organizationId"
    ),
    projectId: requiredDashboardRouteSegment(params.projectId, "projectId"),
    environmentId: requiredDashboardRouteSegment(
      params.environmentId,
      "environmentId"
    )
  };
}

function assertDashboardProjectRouteMatchesSnapshot(
  params: DashboardProjectRouteParams,
  snapshot: DashboardSnapshot
): void {
  if (params.organizationId !== snapshot.organization.id) {
    throw new Error(
      "Dashboard project route organizationId must match the snapshot organization."
    );
  }
  if (params.projectId !== snapshot.project.id) {
    throw new Error(
      "Dashboard project route projectId must match the snapshot project."
    );
  }
  if (params.environmentId !== snapshot.environment.id) {
    throw new Error(
      "Dashboard project route environmentId must match the snapshot environment."
    );
  }
}

function dashboardProjectViewLabel(view: DashboardProjectView): string {
  return t(dashboardProjectViewMessageKeys[view]);
}

function isValidDashboardProjectRouteParams(
  params: DashboardProjectRouteParams
): boolean {
  return (
    isValidDashboardRouteSegment(params.organizationId) &&
    isValidDashboardRouteSegment(params.projectId) &&
    isValidDashboardRouteSegment(params.environmentId)
  );
}

function requiredDashboardRouteSegment(value: string, key: string): string {
  if (!isValidDashboardRouteSegment(value)) {
    throw new Error(`Dashboard project route ${key} is required.`);
  }
  return value;
}

function validateDashboardOrganizationSwitchTarget(
  target: DashboardOrganizationSwitchTarget
): DashboardOrganizationSwitchTarget {
  return {
    organizationId: requiredDashboardRouteSegment(
      target.organizationId,
      "organizationId"
    ),
    organizationName: requiredDashboardSwitchLabel(
      target.organizationName,
      "organizationName"
    ),
    projectId: requiredDashboardRouteSegment(target.projectId, "projectId"),
    projectName: requiredDashboardSwitchLabel(
      target.projectName,
      "projectName"
    ),
    environmentId: requiredDashboardRouteSegment(
      target.environmentId,
      "environmentId"
    ),
    environmentName: requiredDashboardSwitchLabel(
      target.environmentName,
      "environmentName"
    )
  };
}

function validateDashboardProjectManagementItem(
  project: DashboardProjectManagementItem
): DashboardProjectManagementItem {
  if (!isValidDashboardRouteSegment(project.id)) {
    throw new Error("Dashboard project management project id is required.");
  }
  if (project.name.trim() === "") {
    throw new Error("Dashboard project management project name is required.");
  }
  if (project.siteUrl.trim() === "") {
    throw new Error("Dashboard project management site URL is required.");
  }
  if (
    !Number.isInteger(project.environmentCount) ||
    project.environmentCount < 0
  ) {
    throw new Error(
      "Dashboard project management environmentCount must be a non-negative integer."
    );
  }
  if (
    !Number.isInteger(project.openDiagnostics) ||
    project.openDiagnostics < 0
  ) {
    throw new Error(
      "Dashboard project management openDiagnostics must be a non-negative integer."
    );
  }
  return project;
}

function validateDashboardCrawlSchedule(
  schedule: DashboardCrawlSchedule
): DashboardCrawlSchedule {
  if (!isValidDashboardRouteSegment(schedule.id)) {
    throw new Error("Dashboard crawl schedule id is required.");
  }
  if (schedule.name.trim() === "") {
    throw new Error("Dashboard crawl schedule name is required.");
  }
  if (
    !["hourly", "daily", "weekly", "monthly", "manual"].includes(
      schedule.cadence
    )
  ) {
    throw new Error("Dashboard crawl schedule cadence is invalid.");
  }
  if (
    !Number.isInteger(schedule.targetUrlCount) ||
    schedule.targetUrlCount < 0
  ) {
    throw new Error(
      "Dashboard crawl schedule targetUrlCount must be a non-negative integer."
    );
  }
  return schedule;
}

function validateDashboardDeploymentRecord(
  deployment: DashboardDeploymentRecord
): DashboardDeploymentRecord {
  if (!isValidDashboardRouteSegment(deployment.id)) {
    throw new Error("Dashboard deployment history id is required.");
  }
  if (deployment.deployedAt.trim() === "") {
    throw new Error("Dashboard deployment deployedAt is required.");
  }
  if (deployment.environmentName.trim() === "") {
    throw new Error("Dashboard deployment environment name is required.");
  }
  if (deployment.commitRef.trim() === "") {
    throw new Error("Dashboard deployment commit ref is required.");
  }
  if (!["succeeded", "failed", "rolled_back"].includes(deployment.status)) {
    throw new Error("Dashboard deployment status is invalid.");
  }
  if (
    !Number.isInteger(deployment.diagnosticsBefore) ||
    deployment.diagnosticsBefore < 0 ||
    !Number.isInteger(deployment.diagnosticsAfter) ||
    deployment.diagnosticsAfter < 0
  ) {
    throw new Error(
      "Dashboard deployment diagnostics counts must be non-negative integers."
    );
  }
  return deployment;
}

function requiredDashboardSwitchLabel(value: string, key: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Dashboard organization switch target ${key} is required.`);
  }
  return value;
}

function organizationSwitchIdentity(
  target: DashboardOrganizationSwitchTarget
): string {
  return [target.organizationId, target.projectId, target.environmentId].join(
    "\0"
  );
}

function isValidDashboardRouteSegment(value: string): boolean {
  return (
    typeof value === "string" && value.trim() !== "" && !value.includes("/")
  );
}

function normalizeDashboardRouteBasePath(basePath = "/dashboard"): string {
  if (
    typeof basePath !== "string" ||
    basePath.trim() === "" ||
    !basePath.startsWith("/") ||
    basePath.startsWith("//")
  ) {
    throw new Error("Dashboard route basePath must be a non-empty local path.");
  }
  const normalized = basePath.replace(/\/+$/u, "");
  return normalized === "" ? "/" : normalized;
}

function pathSegments(path: string): string[] {
  return path.split("/").filter((segment) => segment !== "");
}

function joinDashboardRoutePath(segments: readonly string[]): string {
  const [basePath = "/", ...pathSegments] = segments;
  const normalizedBasePath =
    basePath === "/" ? "" : basePath.replace(/\/+$/u, "");
  return `${normalizedBasePath}/${pathSegments.join("/")}`;
}

function segmentsMatch(
  left: readonly string[],
  right: readonly string[]
): boolean {
  return (
    left.length === right.length &&
    left.every((segment, index) => segment === right[index])
  );
}

function decodeRouteSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return "";
  }
}

function requiredDashboardRoutePath(value: string, key: string): string {
  if (
    typeof value !== "string" ||
    value.trim() === "" ||
    !value.startsWith("/")
  ) {
    throw new Error(
      `Dashboard auth route ${key} must be a non-empty local path.`
    );
  }
  if (value.startsWith("//")) {
    throw new Error(
      `Dashboard auth route ${key} must not be protocol-relative.`
    );
  }
  return value;
}

function validateDashboardBrowserAppConfig(
  config: DashboardBrowserAppConfig
): DashboardBrowserAppConfig {
  if (!config || typeof config !== "object") {
    throw new Error("Dashboard browser app config is required.");
  }
  requiredDashboardPort(config.root, "root");
  requiredDashboardPort(config.location, "location");
  requiredDashboardPort(config.history, "history");
  requiredDashboardPort(config.eventTarget, "eventTarget");
  requiredDashboardPort(config.navigation, "navigation");
  requiredDashboardPort(config.storage, "storage");
  requiredDashboardFunction(config.history.pushState, "history.pushState");
  requiredDashboardFunction(
    config.eventTarget.addEventListener,
    "eventTarget.addEventListener"
  );
  requiredDashboardFunction(
    config.eventTarget.removeEventListener,
    "eventTarget.removeEventListener"
  );
  if (config.linkEventTarget !== undefined) {
    requiredDashboardPort(config.linkEventTarget, "linkEventTarget");
    requiredDashboardFunction(
      config.linkEventTarget.addEventListener,
      "linkEventTarget.addEventListener"
    );
    requiredDashboardFunction(
      config.linkEventTarget.removeEventListener,
      "linkEventTarget.removeEventListener"
    );
  }
  requiredDashboardFunction(config.navigation.assign, "navigation.assign");
  requiredDashboardFunction(config.storage.getItem, "storage.getItem");
  requiredDashboardFunction(config.storage.setItem, "storage.setItem");
  requiredDashboardFunction(config.storage.removeItem, "storage.removeItem");
  requiredDashboardFunction(config.apiFetch, "apiFetch");
  requiredDashboardFunction(config.tokenFetch, "tokenFetch");
  requiredDashboardFunction(config.clock?.now, "clock.now");
  requiredDashboardAbsoluteUrl(config.apiBaseUrl, "apiBaseUrl");
  requiredDashboardAbsoluteUrl(
    config.cognitoHostedUiDomain,
    "cognitoHostedUiDomain"
  );
  requiredDashboardNonEmptyString(config.cognitoClientId, "cognitoClientId");
  validateDashboardAuthRoutePaths(config.authRoutes);
  browserRuntimePath(config.location);
  if (config.basePath !== undefined) {
    normalizeDashboardRouteBasePath(config.basePath);
  }
  if (config.sessionStorageNamespace !== undefined) {
    requiredDashboardNonEmptyString(
      config.sessionStorageNamespace,
      "sessionStorageNamespace"
    );
  }
  if (
    config.expirySkewSeconds !== undefined &&
    (!Number.isFinite(config.expirySkewSeconds) || config.expirySkewSeconds < 0)
  ) {
    throw new Error(
      "Dashboard browser app expirySkewSeconds must be a non-negative number."
    );
  }
  return config;
}

function validateDashboardHostedHtmlShellConfig(
  config: DashboardHostedHtmlShellConfig
): DashboardHostedHtmlShellConfig {
  if (!config || typeof config !== "object") {
    throw new Error("Dashboard hosted shell config is required.");
  }
  requiredDashboardHostedUrl(config.entryModuleUrl, "entryModuleUrl");
  validateDashboardHostedBootstrapConfig(config.bootstrapConfig);
  if (config.title !== undefined) {
    requiredDashboardNonEmptyString(config.title, "title");
  }
  if (config.lang !== undefined) {
    requiredDashboardHtmlToken(config.lang, "lang");
  }
  if (config.rootId !== undefined) {
    requiredDashboardHtmlToken(config.rootId, "rootId");
  }
  if (config.configScriptId !== undefined) {
    requiredDashboardHtmlToken(config.configScriptId, "configScriptId");
  }
  if (config.cspNonce !== undefined) {
    requiredDashboardNonEmptyString(config.cspNonce, "cspNonce");
  }
  if (config.importMap !== undefined) {
    validateDashboardHostedImportMap(config.importMap);
  }
  for (const stylesheetUrl of config.stylesheetUrls ?? []) {
    requiredDashboardHostedUrl(stylesheetUrl, "stylesheetUrl");
  }
  return config;
}

function validateDashboardHostedBrowserAssetManifest(
  manifest: DashboardHostedBrowserAssetManifest
): DashboardHostedBrowserAssetManifest {
  if (!manifest || typeof manifest !== "object") {
    throw new Error("Dashboard hosted browser asset manifest is required.");
  }
  if (!manifest.entry || typeof manifest.entry !== "object") {
    throw new Error(
      "Dashboard hosted browser asset manifest entry is required."
    );
  }
  requiredDashboardNonEmptyString(manifest.entry.name, "entry.name");
  requiredDashboardHostedUrl(manifest.entry.moduleScript, "entry.moduleScript");
  if (manifest.importMap !== undefined) {
    validateDashboardHostedImportMap(manifest.importMap);
  }
  return manifest;
}

function validateDashboardHostedImportMap(
  importMap: DashboardHostedImportMap
): DashboardHostedImportMap {
  if (!importMap || typeof importMap !== "object") {
    throw new Error("Dashboard hosted shell importMap is required.");
  }
  if (
    !importMap.imports ||
    typeof importMap.imports !== "object" ||
    Array.isArray(importMap.imports)
  ) {
    throw new Error("Dashboard hosted shell importMap.imports is required.");
  }
  for (const [specifier, moduleUrl] of Object.entries(importMap.imports)) {
    requiredDashboardImportMapSpecifier(specifier);
    requiredDashboardHostedUrl(moduleUrl, `importMap import ${specifier}`);
  }
  return importMap;
}

function requiredDashboardImportMapSpecifier(specifier: string): string {
  if (
    typeof specifier !== "string" ||
    specifier.trim() === "" ||
    specifier.startsWith("/") ||
    specifier.startsWith("./") ||
    specifier.startsWith("../") ||
    /\s/u.test(specifier)
  ) {
    throw new Error(
      "Dashboard hosted shell importMap specifier must be a non-empty bare specifier."
    );
  }
  return specifier;
}

function validateDashboardBrowserEntryOptions(
  options: DashboardBrowserEntryOptions
): DashboardBrowserEntryOptions {
  if (!options || typeof options !== "object") {
    throw new Error("Dashboard browser entry options are required.");
  }
  requiredDashboardPort(options.window, "entry window");
  requiredDashboardPort(options.window.document, "entry document");
  requiredDashboardPort(options.window.location, "entry location");
  requiredDashboardPort(options.window.history, "entry history");
  requiredDashboardPort(options.window.sessionStorage, "entry sessionStorage");
  requiredDashboardFunction(
    options.window.document.getElementById,
    "entry document.getElementById"
  );
  requiredDashboardFunction(
    options.window.document.addEventListener,
    "entry document.addEventListener"
  );
  requiredDashboardFunction(
    options.window.document.removeEventListener,
    "entry document.removeEventListener"
  );
  requiredDashboardFunction(
    options.window.addEventListener,
    "entry window.addEventListener"
  );
  requiredDashboardFunction(
    options.window.removeEventListener,
    "entry window.removeEventListener"
  );
  requiredDashboardFunction(
    options.window.history.pushState,
    "entry history.pushState"
  );
  requiredDashboardFunction(
    options.window.location.assign,
    "entry location.assign"
  );
  requiredDashboardFunction(
    options.window.sessionStorage.getItem,
    "entry sessionStorage.getItem"
  );
  requiredDashboardFunction(
    options.window.sessionStorage.setItem,
    "entry sessionStorage.setItem"
  );
  requiredDashboardFunction(
    options.window.sessionStorage.removeItem,
    "entry sessionStorage.removeItem"
  );
  requiredDashboardFunction(options.window.fetch, "entry window.fetch");
  if (options.rootId !== undefined) {
    requiredDashboardHtmlToken(options.rootId, "rootId");
  }
  if (options.configScriptId !== undefined) {
    requiredDashboardHtmlToken(options.configScriptId, "configScriptId");
  }
  if (options.clock !== undefined) {
    requiredDashboardFunction(options.clock.now, "entry clock.now");
  }
  return options;
}

function validateDashboardHostedBootstrapConfig(
  config: DashboardHostedShellBootstrapConfig
): DashboardHostedShellBootstrapConfig {
  if (!config || typeof config !== "object") {
    throw new Error("Dashboard hosted shell bootstrapConfig is required.");
  }
  requiredDashboardAbsoluteUrl(config.apiBaseUrl, "apiBaseUrl");
  requiredDashboardAbsoluteUrl(
    config.cognitoHostedUiDomain,
    "cognitoHostedUiDomain"
  );
  requiredDashboardNonEmptyString(config.cognitoClientId, "cognitoClientId");
  validateDashboardAuthRoutePaths(config.authRoutes);
  if (config.basePath !== undefined) {
    normalizeDashboardRouteBasePath(config.basePath);
  }
  if (config.sessionStorageNamespace !== undefined) {
    requiredDashboardNonEmptyString(
      config.sessionStorageNamespace,
      "sessionStorageNamespace"
    );
  }
  if (
    config.expirySkewSeconds !== undefined &&
    (!Number.isFinite(config.expirySkewSeconds) || config.expirySkewSeconds < 0)
  ) {
    throw new Error(
      "Dashboard hosted shell expirySkewSeconds must be a non-negative number."
    );
  }
  return config;
}

function parseDashboardHostedBootstrapConfig(
  textContent: string | null | undefined,
  configScriptId: string
): DashboardHostedShellBootstrapConfig {
  if (textContent === undefined || textContent === null || textContent === "") {
    throw new Error(
      `Dashboard browser entry config script #${configScriptId} is empty.`
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(textContent);
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `Dashboard browser entry config script #${configScriptId} contains invalid JSON: ${error.message}`
        : `Dashboard browser entry config script #${configScriptId} contains invalid JSON.`
    );
  }
  return parsed as DashboardHostedShellBootstrapConfig;
}

function requiredDashboardHtmlToken(value: unknown, name: string): string {
  const token = requiredDashboardNonEmptyString(value, name);
  if (/\s/u.test(token)) {
    throw new Error(`Dashboard hosted shell ${name} must not contain spaces.`);
  }
  return token;
}

function requiredDashboardHostedUrl(value: unknown, name: string): string {
  const url = requiredDashboardNonEmptyString(value, name);
  if (
    (url.startsWith("/") && !url.startsWith("//")) ||
    url.startsWith("./") ||
    url.startsWith("../")
  ) {
    return url;
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return url;
    }
  } catch {
    // Fall through to a deterministic validation error.
  }
  throw new Error(
    `Dashboard hosted shell ${name} must be a local path or absolute HTTP(S) URL.`
  );
}

function requiredDashboardPort(value: unknown, name: string): void {
  if (!value || typeof value !== "object") {
    throw new Error(`Dashboard browser app ${name} port is required.`);
  }
}

function requiredDashboardFunction(value: unknown, name: string): void {
  if (typeof value !== "function") {
    throw new Error(`Dashboard browser app ${name} function is required.`);
  }
}

function requiredDashboardNonEmptyString(value: unknown, name: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Dashboard browser app ${name} is required.`);
  }
  return value;
}

function requiredDashboardAbsoluteUrl(value: unknown, name: string): string {
  const url = requiredDashboardNonEmptyString(value, name);
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("Unsupported protocol.");
    }
  } catch {
    throw new Error(
      `Dashboard browser app ${name} must be an absolute HTTP(S) URL.`
    );
  }
  return url;
}

function browserRuntimePath(location: DashboardBrowserLocationPort): string {
  if (
    !location ||
    typeof location !== "object" ||
    typeof location.pathname !== "string" ||
    location.pathname.trim() === "" ||
    !location.pathname.startsWith("/") ||
    location.pathname.startsWith("//")
  ) {
    throw new Error(
      "Dashboard browser runtime location pathname must be a non-empty local path."
    );
  }
  return location.pathname;
}

function runtimeLocation(
  location: DashboardBrowserLocationPort,
  pathname: string
): DashboardBrowserLocationPort {
  return location.origin === undefined
    ? { pathname }
    : {
        pathname,
        origin: location.origin
      };
}

function requiredDashboardBrowserNavigationPath(
  path: string,
  basePath?: string
): string {
  const localPath = requiredDashboardLocalPath(
    path,
    "Dashboard browser navigation path"
  );
  const normalizedBasePath = normalizeDashboardRouteBasePath(basePath);
  if (!isDashboardPathWithinBasePath(localPath, normalizedBasePath)) {
    throw new Error(
      "Dashboard browser navigation path must be inside the dashboard base path."
    );
  }
  return localPath;
}

function requiredDashboardLocalPath(path: string, label: string): string {
  if (
    typeof path !== "string" ||
    path.trim() === "" ||
    !path.startsWith("/") ||
    path.startsWith("//")
  ) {
    throw new Error(`${label} must be a non-empty local path.`);
  }
  return path;
}

function isDashboardPathWithinBasePath(
  path: string,
  basePath: string
): boolean {
  if (basePath === "/") {
    return path.startsWith("/");
  }
  return path === basePath || path.startsWith(`${basePath}/`);
}

function isDashboardBrowserClickEvent(
  event: unknown
): event is DashboardBrowserClickEventPort {
  return (
    !!event &&
    typeof event === "object" &&
    "preventDefault" in event &&
    typeof (event as DashboardBrowserClickEventPort).preventDefault ===
      "function"
  );
}

function dashboardBrowserClickNavigationPath(
  event: DashboardBrowserClickEventPort,
  location: DashboardBrowserLocationPort,
  basePath?: string
): string | undefined {
  if (
    event.defaultPrevented ||
    (event.button !== undefined && event.button !== 0) ||
    event.metaKey ||
    event.altKey ||
    event.ctrlKey ||
    event.shiftKey
  ) {
    return undefined;
  }

  const link = event.target?.closest("a[href]");
  if (link === undefined || link === null) {
    return undefined;
  }
  if (
    link.target !== undefined &&
    link.target !== "" &&
    link.target !== "_self"
  ) {
    return undefined;
  }
  if (
    link.getAttribute?.("download") !== null &&
    link.getAttribute?.("download") !== undefined
  ) {
    return undefined;
  }

  const path = dashboardLinkPath(link, location);
  if (path === undefined) {
    return undefined;
  }
  try {
    return requiredDashboardBrowserNavigationPath(path, basePath);
  } catch {
    return undefined;
  }
}

function dashboardLinkPath(
  link: DashboardBrowserLinkPort,
  location: DashboardBrowserLocationPort
): string | undefined {
  if (
    link.origin !== undefined &&
    location.origin !== undefined &&
    link.origin !== location.origin
  ) {
    return undefined;
  }
  if (link.pathname !== undefined) {
    return `${link.pathname}${link.search ?? ""}${link.hash ?? ""}`;
  }
  try {
    const base =
      location.origin === undefined
        ? `https://searchlint.local${location.pathname}`
        : `${location.origin}${location.pathname}`;
    const url = new URL(link.href, base);
    if (location.origin !== undefined && url.origin !== location.origin) {
      return undefined;
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return undefined;
  }
}

function renderDashboardDomState(
  root: DashboardBrowserDomRootPort,
  state: string,
  html: string
): void {
  root.innerHTML = html;
  root.setAttribute?.("data-searchlint-dashboard-state", state);
}

function focusDashboardRoot(
  root: DashboardBrowserDomRootPort,
  focusAfterRender: boolean
): void {
  if (focusAfterRender) {
    root.focus?.();
  }
}

function dashboardDocumentTitle(html: string): string | undefined {
  const match = /<title>(?<title>[\s\S]*?)<\/title>/iu.exec(html);
  const title = match?.groups?.title?.trim();
  return title === undefined || title === "" ? undefined : title;
}

function renderDashboardRuntimeStatusShell(input: {
  title: string;
  message: string;
  details: readonly string[];
}): string {
  return `<main class="searchlint-dashboard-shell" tabindex="-1" aria-labelledby="dashboard-runtime-state-heading">
  <section class="searchlint-dashboard-state">
    <h1 id="dashboard-runtime-state-heading">${escapeHtml(input.title)}</h1>
    <p>${escapeHtml(input.message)}</p>
    ${renderRuntimeStatusDetails(input.details)}
  </section>
</main>`;
}

function renderRuntimeStatusDetails(details: readonly string[]): string {
  if (details.length === 0) {
    return "";
  }
  return `<dl>
      ${details.map((detail) => `<div><dd>${escapeHtml(detail)}</dd></div>`).join("\n      ")}
    </dl>`;
}

function escapeJsonScript(value: unknown): string {
  return JSON.stringify(value)
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
