import type {
  CloudApiOperation,
  CloudApiStability,
  CloudHttpMethod
} from "@searchlint/api/http-contracts";
import { routeContractForOperation } from "@searchlint/api/http-contracts";

import type { DashboardAction } from "./index.js";

export type DashboardApiRole =
  | "owner"
  | "admin"
  | "developer"
  | "analyst"
  | "client";

export type DashboardApiPathParams = Partial<
  Record<"organizationId" | "projectId" | "environmentId" | "provider", string>
>;

export type DashboardCreateProjectBody = {
  name: string;
  siteUrl: string;
};

export type DashboardCreateEnvironmentBody = {
  name: string;
  baseUrl: string;
};

export type DashboardRequestCrawlBody = {
  maxUrls: number;
};

export type DashboardAddMemberBody = {
  principalId: string;
  role: DashboardApiRole;
};

export type DashboardCompleteExternalProviderOAuthConnectionBody = {
  code: string;
  redirectUri: string;
  codeVerifier?: string;
  scopes?: readonly string[];
};

export type DashboardStartExternalProviderOAuthConnectionBody = {
  state: string;
  redirectUri?: string;
  scopes?: readonly string[];
  codeChallenge?: string;
};

export type DashboardApiBodyByAction = {
  createProject: DashboardCreateProjectBody;
  createEnvironment: DashboardCreateEnvironmentBody;
  getDashboardSnapshot: undefined;
  requestCrawl: DashboardRequestCrawlBody;
  addMember: DashboardAddMemberBody;
  startExternalProviderOAuthConnection: DashboardStartExternalProviderOAuthConnectionBody;
  completeExternalProviderOAuthConnection: DashboardCompleteExternalProviderOAuthConnectionBody;
};

export type DashboardApiRequest<
  TAction extends DashboardAction = DashboardAction
> = {
  action: TAction;
  operation: CloudApiOperation;
  method: CloudHttpMethod;
  path: string;
  apiVersion: "v1";
  stability: CloudApiStability;
  requestSchemaVersion: string;
  responseSchemaVersion: string;
  body: DashboardApiBodyByAction[TAction];
};

export type DashboardApiResponse<TBody = unknown> = {
  status: number;
  body: TBody;
};

export type DashboardApiTransport = <TAction extends DashboardAction>(
  request: DashboardApiRequest<TAction>
) => Promise<DashboardApiResponse>;

export type DashboardApiAccessTokenProvider = () => string | Promise<string>;

export type DashboardSessionClock = {
  now(): number;
};

export type DashboardAuthSession = {
  accessToken: string;
  expiresAt: number;
  tokenType: "Bearer";
  identityProvider: "cognito";
  subject?: string;
  issuer?: string;
  idToken?: string;
  refreshToken?: string;
};

export type DashboardSessionRefresh = (
  session: DashboardAuthSession
) => DashboardAuthSession | Promise<DashboardAuthSession>;

export type DashboardSessionAccessTokenProviderOptions = {
  session: DashboardAuthSession;
  clock: DashboardSessionClock;
  expirySkewSeconds?: number;
  refresh?: DashboardSessionRefresh;
};

export type DashboardStoredSessionAccessTokenProviderOptions = {
  sessionStore: DashboardAuthSessionStore;
  clock: DashboardSessionClock;
  expirySkewSeconds?: number;
  refresh?: DashboardSessionRefresh;
};

export type DashboardStoredAuthSessionState =
  | {
      status: "missing";
    }
  | {
      status: "valid";
      session: DashboardAuthSession;
    }
  | {
      status: "expired";
      session: DashboardAuthSession;
    };

export type DashboardStoredAuthSessionStateOptions = {
  sessionStore: DashboardAuthSessionStore;
  clock: DashboardSessionClock;
  expirySkewSeconds?: number;
};

export type DashboardAuthSessionStore = {
  save(session: DashboardAuthSession): void | Promise<void>;
  load():
    | DashboardAuthSession
    | undefined
    | Promise<DashboardAuthSession | undefined>;
  delete(): void | Promise<void>;
};

export type DashboardCognitoHostedUiConfig = {
  hostedUiDomain: string;
  clientId: string;
  redirectUri: string;
  scopes: readonly string[];
};

export type DashboardCognitoAuthRequest = {
  state: string;
  nonce: string;
  codeChallenge: string;
};

export type DashboardCognitoPendingAuthState = DashboardCognitoAuthRequest & {
  redirectUri: string;
};

export type DashboardCognitoPendingPkceAuthState =
  DashboardCognitoPendingAuthState & {
    codeVerifier: string;
    createdAt: number;
    expiresAt: number;
  };

export type DashboardCognitoPendingAuthStore = {
  save(state: DashboardCognitoPendingPkceAuthState): void | Promise<void>;
  load(
    state: string
  ):
    | DashboardCognitoPendingPkceAuthState
    | undefined
    | Promise<DashboardCognitoPendingPkceAuthState | undefined>;
  delete(state: string): void | Promise<void>;
};

export type DashboardExternalProvider = "google" | "yandex";

export type DashboardExternalProviderOAuthPendingState = {
  provider: DashboardExternalProvider;
  organizationId: string;
  projectId: string;
  environmentId: string;
  state: string;
  redirectUri: string;
  scopes: readonly string[];
  codeVerifier?: string;
  createdAt: number;
  expiresAt: number;
};

export type DashboardExternalProviderOAuthPendingStore = {
  save(state: DashboardExternalProviderOAuthPendingState): void | Promise<void>;
  load(
    state: string
  ):
    | DashboardExternalProviderOAuthPendingState
    | undefined
    | Promise<DashboardExternalProviderOAuthPendingState | undefined>;
  delete(state: string): void | Promise<void>;
};

export type DashboardBrowserStorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export type DashboardBrowserPkceStorageOptions = {
  storage: DashboardBrowserStorageLike;
  namespace?: string;
};

export type DashboardBrowserSessionStorageOptions = {
  storage: DashboardBrowserStorageLike;
  namespace?: string;
};

export type DashboardBrowserExternalProviderOAuthStorageOptions = {
  storage: DashboardBrowserStorageLike;
  namespace?: string;
};

export type DashboardBrowserNavigationPort = {
  assign(url: string): void | Promise<void>;
};

export type DashboardCognitoAuthCallbackInput = {
  callbackUrl: string;
  expectedState: DashboardCognitoPendingAuthState;
};

export type DashboardCognitoAuthCallbackResult = {
  code: string;
  state: string;
  issuer?: string;
};

export type DashboardCognitoTokenExchangeRequest = {
  hostedUiDomain: string;
  clientId: string;
  redirectUri: string;
  code: string;
  codeVerifier: string;
};

export type DashboardCognitoRefreshTokenRequest = {
  hostedUiDomain: string;
  clientId: string;
  refreshToken: string;
};

export type DashboardCognitoLogoutRequest = {
  hostedUiDomain: string;
  clientId: string;
  logoutUri: string;
  state?: string;
};

export type DashboardCognitoSignOutOptions = DashboardCognitoLogoutRequest & {
  sessionStore: DashboardAuthSessionStore;
};

export type DashboardCognitoSignOutResult = {
  logoutUrl: string;
};

export type DashboardCognitoTokenFetchRequestInit = {
  method: "POST";
  headers: Readonly<Record<string, string>>;
  body: string;
  signal?: unknown;
};

export type DashboardCognitoTokenFetchResponse = {
  status: number;
  headers?: {
    get(name: string): string | null;
  };
  json(): Promise<unknown>;
  text?(): Promise<string>;
};

export type DashboardCognitoTokenFetch = (
  url: string,
  init: DashboardCognitoTokenFetchRequestInit
) => Promise<DashboardCognitoTokenFetchResponse>;

export type DashboardCognitoTokenExchangeOptions =
  DashboardCognitoTokenExchangeRequest & {
    fetch: DashboardCognitoTokenFetch;
    clock: DashboardSessionClock;
    signal?: unknown;
  };

export type DashboardCognitoRefreshTokenOptions =
  DashboardCognitoRefreshTokenRequest & {
    fetch: DashboardCognitoTokenFetch;
    clock: DashboardSessionClock;
    signal?: unknown;
  };

export type DashboardCognitoStartPkceAuthOptions = {
  config: DashboardCognitoHostedUiConfig;
  request: DashboardCognitoAuthRequest;
  codeVerifier: string;
  store: DashboardCognitoPendingAuthStore;
  clock: DashboardSessionClock;
  ttlSeconds?: number;
};

export type DashboardCognitoStartPkceAuthResult = {
  authorizationUrl: string;
  pendingState: DashboardCognitoPendingPkceAuthState;
};

export type DashboardCognitoConsumePkceAuthCallbackOptions = {
  config: DashboardCognitoHostedUiConfig;
  callbackUrl: string;
  store: DashboardCognitoPendingAuthStore;
  clock: DashboardSessionClock;
};

export type DashboardCognitoConsumePkceAuthCallbackResult = {
  callback: DashboardCognitoAuthCallbackResult;
  tokenExchangeRequest: DashboardCognitoTokenExchangeRequest;
};

export type DashboardCognitoCompletePkceAuthCallbackOptions = {
  config: DashboardCognitoHostedUiConfig;
  callbackUrl: string;
  pendingAuthStore: DashboardCognitoPendingAuthStore;
  sessionStore: DashboardAuthSessionStore;
  fetch: DashboardCognitoTokenFetch;
  clock: DashboardSessionClock;
  signal?: unknown;
};

export type DashboardCognitoCompletePkceAuthCallbackResult = {
  callback: DashboardCognitoAuthCallbackResult;
  session: DashboardAuthSession;
};

export type DashboardExternalProviderOAuthStartOptions = {
  apiClient: DashboardApiClient;
  store: DashboardExternalProviderOAuthPendingStore;
  clock: DashboardSessionClock;
  organizationId: string;
  projectId: string;
  environmentId: string;
  provider: DashboardExternalProvider;
  state: string;
  redirectUri?: string;
  scopes?: readonly string[];
  codeChallenge?: string;
  codeVerifier?: string;
  ttlSeconds?: number;
};

export type DashboardExternalProviderOAuthStartResult = {
  authorizationUrl: string;
  pendingState: DashboardExternalProviderOAuthPendingState;
};

export type DashboardExternalProviderOAuthRedirectOptions =
  DashboardExternalProviderOAuthStartOptions & {
    navigation: DashboardBrowserNavigationPort;
  };

export type DashboardExternalProviderOAuthCallbackResult = {
  provider: DashboardExternalProvider;
  code: string;
  state: string;
};

export type DashboardExternalProviderOAuthConsumeCallbackOptions = {
  callbackUrl: string;
  store: DashboardExternalProviderOAuthPendingStore;
  clock: DashboardSessionClock;
};

export type DashboardExternalProviderOAuthConsumeCallbackResult = {
  callback: DashboardExternalProviderOAuthCallbackResult;
  completionRequest: {
    organizationId: string;
    projectId: string;
    environmentId: string;
    provider: DashboardExternalProvider;
    body: DashboardCompleteExternalProviderOAuthConnectionBody;
  };
};

export type DashboardExternalProviderOAuthCompleteCallbackOptions =
  DashboardExternalProviderOAuthConsumeCallbackOptions & {
    apiClient: DashboardApiClient;
  };

export type DashboardExternalProviderOAuthCompleteCallbackResult = {
  callback: DashboardExternalProviderOAuthCallbackResult;
  response: DashboardApiResponse;
};

export type DashboardApiFetchRequestInit = {
  method: CloudHttpMethod;
  headers: Readonly<Record<string, string>>;
  body?: string;
  signal?: unknown;
};

export type DashboardApiFetchResponse = {
  status: number;
  headers?: {
    get(name: string): string | null;
  };
  json(): Promise<unknown>;
  text?(): Promise<string>;
};

export type DashboardApiFetch = (
  url: string,
  init: DashboardApiFetchRequestInit
) => Promise<DashboardApiFetchResponse>;

export type DashboardApiFetchTransportOptions = {
  baseUrl: string;
  fetch: DashboardApiFetch;
  accessToken: string | DashboardApiAccessTokenProvider;
  headers?: Readonly<Record<string, string>>;
  signal?: unknown;
};

export type DashboardCognitoStoredSessionApiClientOptions = {
  baseUrl: string;
  apiFetch: DashboardApiFetch;
  tokenFetch: DashboardCognitoTokenFetch;
  sessionStore: DashboardAuthSessionStore;
  hostedUiDomain: string;
  clientId: string;
  clock: DashboardSessionClock;
  expirySkewSeconds?: number;
  headers?: Readonly<Record<string, string>>;
  signal?: unknown;
};

export type DashboardApiClient = {
  createProject(
    params: Pick<DashboardApiPathParams, "organizationId">,
    body: DashboardCreateProjectBody
  ): Promise<DashboardApiResponse>;
  createEnvironment(
    params: Pick<DashboardApiPathParams, "organizationId" | "projectId">,
    body: DashboardCreateEnvironmentBody
  ): Promise<DashboardApiResponse>;
  getDashboardSnapshot(
    params: Required<
      Pick<
        DashboardApiPathParams,
        "organizationId" | "projectId" | "environmentId"
      >
    >
  ): Promise<DashboardApiResponse>;
  requestCrawl(
    params: Required<
      Pick<
        DashboardApiPathParams,
        "organizationId" | "projectId" | "environmentId"
      >
    >,
    body: DashboardRequestCrawlBody
  ): Promise<DashboardApiResponse>;
  addMember(
    params: Pick<DashboardApiPathParams, "organizationId">,
    body: DashboardAddMemberBody
  ): Promise<DashboardApiResponse>;
  startExternalProviderOAuthConnection(
    params: Required<DashboardApiPathParams>,
    body: DashboardStartExternalProviderOAuthConnectionBody
  ): Promise<DashboardApiResponse>;
  completeExternalProviderOAuthConnection(
    params: Required<DashboardApiPathParams>,
    body: DashboardCompleteExternalProviderOAuthConnectionBody
  ): Promise<DashboardApiResponse>;
};

export type DashboardApiClientErrorCode =
  | "MISSING_PATH_PARAM"
  | "INVALID_REQUEST_BODY"
  | "INVALID_BASE_URL"
  | "ACCESS_TOKEN_UNAVAILABLE"
  | "ACCESS_TOKEN_EXPIRED"
  | "INVALID_AUTH_SESSION"
  | "INVALID_AUTH_REQUEST"
  | "AUTH_STATE_MISMATCH"
  | "AUTH_STATE_NOT_FOUND"
  | "AUTH_STATE_EXPIRED"
  | "AUTH_STORAGE_ERROR"
  | "AUTH_PROVIDER_ERROR"
  | "INVALID_TOKEN_EXCHANGE"
  | "TOKEN_PROVIDER_ERROR"
  | "TRANSPORT_ERROR";

export class DashboardApiClientError extends Error {
  readonly code: DashboardApiClientErrorCode;

  constructor(code: DashboardApiClientErrorCode, message: string) {
    super(message);
    this.name = "DashboardApiClientError";
    this.code = code;
  }
}

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

const actionRequiredParams: Readonly<
  Record<DashboardAction, readonly string[]>
> = {
  createProject: ["organizationId"],
  createEnvironment: ["organizationId", "projectId"],
  getDashboardSnapshot: ["organizationId", "projectId", "environmentId"],
  requestCrawl: ["organizationId", "projectId", "environmentId"],
  addMember: ["organizationId"],
  startExternalProviderOAuthConnection: [
    "organizationId",
    "projectId",
    "environmentId",
    "provider"
  ],
  completeExternalProviderOAuthConnection: [
    "organizationId",
    "projectId",
    "environmentId",
    "provider"
  ]
};

const apiRoles: readonly DashboardApiRole[] = [
  "owner",
  "admin",
  "developer",
  "analyst",
  "client"
];

export function createDashboardApiRequest<TAction extends DashboardAction>(
  action: TAction,
  params: DashboardApiPathParams,
  body: DashboardApiBodyByAction[TAction]
): DashboardApiRequest<TAction> {
  const contract = routeContractForOperation(actionOperations[action]);
  const path = buildPath(contract.path, actionRequiredParams[action], params);
  validateBody(action, body);

  return {
    action,
    operation: contract.operation,
    method: contract.method,
    path,
    apiVersion: contract.apiVersion,
    stability: contract.stability,
    requestSchemaVersion: contract.requestSchemaVersion,
    responseSchemaVersion: contract.responseSchemaVersion,
    body
  };
}

export function createDashboardApiClient(
  transport: DashboardApiTransport
): DashboardApiClient {
  return {
    async createProject(params, body) {
      return transport(
        createDashboardApiRequest("createProject", params, body)
      );
    },
    async createEnvironment(params, body) {
      return transport(
        createDashboardApiRequest("createEnvironment", params, body)
      );
    },
    async getDashboardSnapshot(params) {
      return transport(
        createDashboardApiRequest("getDashboardSnapshot", params, undefined)
      );
    },
    async requestCrawl(params, body) {
      return transport(createDashboardApiRequest("requestCrawl", params, body));
    },
    async addMember(params, body) {
      return transport(createDashboardApiRequest("addMember", params, body));
    },
    async startExternalProviderOAuthConnection(params, body) {
      return transport(
        createDashboardApiRequest(
          "startExternalProviderOAuthConnection",
          params,
          body
        )
      );
    },
    async completeExternalProviderOAuthConnection(params, body) {
      return transport(
        createDashboardApiRequest(
          "completeExternalProviderOAuthConnection",
          params,
          body
        )
      );
    }
  };
}

export function createDashboardApiFetchTransport(
  options: DashboardApiFetchTransportOptions
): DashboardApiTransport {
  const baseUrl = parseBaseUrl(options.baseUrl);

  return async (request) => {
    const accessToken = await resolveAccessToken(options.accessToken);
    const headers: Record<string, string> = {
      ...options.headers,
      accept: "application/json",
      authorization: `Bearer ${accessToken}`,
      "x-searchlint-api-version": request.apiVersion,
      "x-searchlint-operation": request.operation,
      "x-searchlint-dashboard-action": request.action,
      "x-searchlint-request-schema": request.requestSchemaVersion,
      "x-searchlint-response-schema": request.responseSchemaVersion
    };
    if (request.body !== undefined) {
      headers["content-type"] = "application/json";
    }
    const init: DashboardApiFetchRequestInit = {
      method: request.method,
      headers,
      ...(request.body === undefined
        ? {}
        : {
            body: JSON.stringify(request.body)
          })
    };
    if (options.signal !== undefined) {
      init.signal = options.signal;
    }

    try {
      const response = await options.fetch(apiUrl(baseUrl, request.path), init);
      return {
        status: response.status,
        body: await parseFetchResponseBody(response)
      };
    } catch (error) {
      if (error instanceof DashboardApiClientError) {
        throw error;
      }
      throw new DashboardApiClientError(
        "TRANSPORT_ERROR",
        error instanceof Error
          ? `Dashboard API transport failed: ${error.message}`
          : "Dashboard API transport failed."
      );
    }
  };
}

export function createDashboardCognitoStoredSessionApiClient(
  options: DashboardCognitoStoredSessionApiClientOptions
): DashboardApiClient {
  const accessToken = createDashboardStoredSessionAccessTokenProvider({
    sessionStore: options.sessionStore,
    clock: options.clock,
    ...(options.expirySkewSeconds !== undefined
      ? { expirySkewSeconds: options.expirySkewSeconds }
      : {}),
    refresh: (session) => {
      if (!isNonEmptyString(session.refreshToken)) {
        throw new DashboardApiClientError(
          "ACCESS_TOKEN_UNAVAILABLE",
          "Dashboard auth session refresh token is required."
        );
      }
      return refreshDashboardCognitoAuthSession({
        hostedUiDomain: options.hostedUiDomain,
        clientId: options.clientId,
        refreshToken: session.refreshToken,
        fetch: options.tokenFetch,
        clock: options.clock,
        ...(options.signal !== undefined ? { signal: options.signal } : {})
      });
    }
  });
  return createDashboardApiClient(
    createDashboardApiFetchTransport({
      baseUrl: options.baseUrl,
      fetch: options.apiFetch,
      accessToken,
      ...(options.headers !== undefined ? { headers: options.headers } : {}),
      ...(options.signal !== undefined ? { signal: options.signal } : {})
    })
  );
}

export function createDashboardSessionAccessTokenProvider(
  options: DashboardSessionAccessTokenProviderOptions
): DashboardApiAccessTokenProvider {
  let session = validateSession(options.session);
  const expirySkewSeconds = options.expirySkewSeconds ?? 60;
  if (!Number.isFinite(expirySkewSeconds) || expirySkewSeconds < 0) {
    throw new DashboardApiClientError(
      "INVALID_AUTH_SESSION",
      "Dashboard session expiry skew must be a non-negative number."
    );
  }

  return async () => {
    if (isSessionUsable(session, options.clock, expirySkewSeconds)) {
      return session.accessToken;
    }

    if (!options.refresh) {
      throw new DashboardApiClientError(
        "ACCESS_TOKEN_EXPIRED",
        "Dashboard access token is expired."
      );
    }

    session = validateSession(await options.refresh(session));
    if (!isSessionUsable(session, options.clock, expirySkewSeconds)) {
      throw new DashboardApiClientError(
        "ACCESS_TOKEN_EXPIRED",
        "Refreshed dashboard access token is expired."
      );
    }
    return session.accessToken;
  };
}

export function createDashboardStoredSessionAccessTokenProvider(
  options: DashboardStoredSessionAccessTokenProviderOptions
): DashboardApiAccessTokenProvider {
  let session: DashboardAuthSession | undefined;
  const expirySkewSeconds = validExpirySkewSeconds(options.expirySkewSeconds);

  return async () => {
    session ??= validateSession(await loadStoredSession(options.sessionStore));
    if (isSessionUsable(session, options.clock, expirySkewSeconds)) {
      return session.accessToken;
    }

    if (!options.refresh) {
      throw new DashboardApiClientError(
        "ACCESS_TOKEN_EXPIRED",
        "Dashboard access token is expired."
      );
    }

    const refreshedSession = validateSession(await options.refresh(session));
    if (!isSessionUsable(refreshedSession, options.clock, expirySkewSeconds)) {
      throw new DashboardApiClientError(
        "ACCESS_TOKEN_EXPIRED",
        "Refreshed dashboard access token is expired."
      );
    }
    await options.sessionStore.save(refreshedSession);
    session = refreshedSession;
    return session.accessToken;
  };
}

export async function getDashboardStoredAuthSessionState(
  options: DashboardStoredAuthSessionStateOptions
): Promise<DashboardStoredAuthSessionState> {
  const expirySkewSeconds = validExpirySkewSeconds(options.expirySkewSeconds);
  const storedSession = await options.sessionStore.load();
  if (!storedSession) {
    return {
      status: "missing"
    };
  }
  const session = validateSession(storedSession);
  return isSessionUsable(session, options.clock, expirySkewSeconds)
    ? {
        status: "valid",
        session
      }
    : {
        status: "expired",
        session
      };
}

export async function clearDashboardStoredAuthSession(
  sessionStore: DashboardAuthSessionStore
): Promise<void> {
  await sessionStore.delete();
}

export function createDashboardCognitoAuthorizationUrl(
  config: DashboardCognitoHostedUiConfig,
  request: DashboardCognitoAuthRequest
): string {
  const hostedUi = parseHostedUiDomain(config.hostedUiDomain);
  const redirectUri = requiredAbsoluteUrl(config.redirectUri, "redirectUri");
  const clientId = requiredAuthString(config.clientId, "clientId");
  const state = requiredAuthString(request.state, "state");
  const nonce = requiredAuthString(request.nonce, "nonce");
  const codeChallenge = requiredAuthString(
    request.codeChallenge,
    "codeChallenge"
  );
  const scopes = normalizedScopes(config.scopes);

  const url = new URL("/oauth2/authorize", hostedUi);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", scopes.join(" "));
  url.searchParams.set("state", state);
  url.searchParams.set("nonce", nonce);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

export function createDashboardCognitoLogoutUrl(
  request: DashboardCognitoLogoutRequest
): string {
  const hostedUi = parseHostedUiDomain(request.hostedUiDomain);
  const clientId = requiredAuthString(request.clientId, "clientId");
  const logoutUri = requiredAbsoluteUrl(request.logoutUri, "logoutUri");

  const url = new URL("/logout", hostedUi);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("logout_uri", logoutUri);
  if (request.state !== undefined) {
    url.searchParams.set("state", requiredAuthString(request.state, "state"));
  }
  return url.toString();
}

export async function signOutDashboardCognitoSession(
  options: DashboardCognitoSignOutOptions
): Promise<DashboardCognitoSignOutResult> {
  const logoutUrl = createDashboardCognitoLogoutUrl(options);
  await clearDashboardStoredAuthSession(options.sessionStore);
  return {
    logoutUrl
  };
}

export function parseDashboardCognitoAuthCallback(
  input: DashboardCognitoAuthCallbackInput
): DashboardCognitoAuthCallbackResult {
  const callbackUrl = requiredAbsoluteUrl(input.callbackUrl, "callbackUrl");
  const callback = new URL(callbackUrl);
  const expectedState = requiredAuthString(
    input.expectedState.state,
    "expectedState.state"
  );
  const state = callback.searchParams.get("state");
  if (!isNonEmptyString(state)) {
    throw new DashboardApiClientError(
      "INVALID_AUTH_REQUEST",
      "Dashboard auth callback state is required."
    );
  }
  if (state !== expectedState) {
    throw new DashboardApiClientError(
      "AUTH_STATE_MISMATCH",
      "Dashboard auth callback state does not match the pending request."
    );
  }

  const providerError = callback.searchParams.get("error");
  if (isNonEmptyString(providerError)) {
    const description = callback.searchParams.get("error_description");
    throw new DashboardApiClientError(
      "AUTH_PROVIDER_ERROR",
      `Cognito authorization failed: ${providerError}${isNonEmptyString(description) ? ` (${description})` : ""}.`
    );
  }

  const code = callback.searchParams.get("code");
  if (!isNonEmptyString(code)) {
    throw new DashboardApiClientError(
      "INVALID_AUTH_REQUEST",
      "Dashboard auth callback code is required."
    );
  }
  const result: DashboardCognitoAuthCallbackResult = {
    code,
    state
  };
  const issuer = callback.searchParams.get("iss");
  if (isNonEmptyString(issuer)) {
    result.issuer = requiredAbsoluteUrl(issuer, "iss");
  }
  return result;
}

export async function startDashboardCognitoPkceAuth(
  options: DashboardCognitoStartPkceAuthOptions
): Promise<DashboardCognitoStartPkceAuthResult> {
  const authorizationUrl = createDashboardCognitoAuthorizationUrl(
    options.config,
    options.request
  );
  const ttlSeconds = options.ttlSeconds ?? 600;
  if (!Number.isInteger(ttlSeconds) || ttlSeconds <= 0) {
    throw new DashboardApiClientError(
      "INVALID_AUTH_REQUEST",
      "Dashboard auth pending state TTL must be a positive integer."
    );
  }
  const createdAt = options.clock.now();
  const pendingState: DashboardCognitoPendingPkceAuthState = {
    state: requiredAuthString(options.request.state, "state"),
    nonce: requiredAuthString(options.request.nonce, "nonce"),
    codeChallenge: requiredAuthString(
      options.request.codeChallenge,
      "codeChallenge"
    ),
    redirectUri: requiredAbsoluteUrl(options.config.redirectUri, "redirectUri"),
    codeVerifier: requiredAuthString(options.codeVerifier, "codeVerifier"),
    createdAt,
    expiresAt: createdAt + ttlSeconds
  };
  await options.store.save(pendingState);
  return {
    authorizationUrl,
    pendingState
  };
}

export async function consumeDashboardCognitoPkceAuthCallback(
  options: DashboardCognitoConsumePkceAuthCallbackOptions
): Promise<DashboardCognitoConsumePkceAuthCallbackResult> {
  const state = callbackState(options.callbackUrl);
  const loadedState = await options.store.load(state);
  if (!loadedState) {
    throw new DashboardApiClientError(
      "AUTH_STATE_NOT_FOUND",
      "Dashboard auth pending state was not found."
    );
  }
  let pendingState: DashboardCognitoPendingPkceAuthState;
  try {
    pendingState = validatePendingPkceAuthState(loadedState);
  } catch (error) {
    await options.store.delete(state);
    throw error;
  }
  if (pendingState.expiresAt <= options.clock.now()) {
    await options.store.delete(pendingState.state);
    throw new DashboardApiClientError(
      "AUTH_STATE_EXPIRED",
      "Dashboard auth pending state is expired."
    );
  }

  let callback: DashboardCognitoAuthCallbackResult;
  try {
    callback = parseDashboardCognitoAuthCallback({
      callbackUrl: options.callbackUrl,
      expectedState: pendingState
    });
  } catch (error) {
    await options.store.delete(pendingState.state);
    throw error;
  }
  await options.store.delete(pendingState.state);
  return {
    callback,
    tokenExchangeRequest: {
      hostedUiDomain: options.config.hostedUiDomain,
      clientId: options.config.clientId,
      redirectUri: pendingState.redirectUri,
      code: callback.code,
      codeVerifier: pendingState.codeVerifier
    }
  };
}

export async function completeDashboardCognitoPkceAuthCallback(
  options: DashboardCognitoCompletePkceAuthCallbackOptions
): Promise<DashboardCognitoCompletePkceAuthCallbackResult> {
  const result = await consumeDashboardCognitoPkceAuthCallback({
    config: options.config,
    callbackUrl: options.callbackUrl,
    store: options.pendingAuthStore,
    clock: options.clock
  });
  const session = await exchangeDashboardCognitoAuthorizationCode({
    ...result.tokenExchangeRequest,
    fetch: options.fetch,
    clock: options.clock,
    ...(options.signal !== undefined ? { signal: options.signal } : {})
  });
  await options.sessionStore.save(session);
  return {
    callback: result.callback,
    session
  };
}

export async function startDashboardExternalProviderOAuth(
  options: DashboardExternalProviderOAuthStartOptions
): Promise<DashboardExternalProviderOAuthStartResult> {
  const provider = requiredExternalProvider(options.provider);
  const ttlSeconds = options.ttlSeconds ?? 600;
  if (!Number.isInteger(ttlSeconds) || ttlSeconds <= 0) {
    throw new DashboardApiClientError(
      "INVALID_AUTH_REQUEST",
      "Dashboard external provider OAuth pending state TTL must be a positive integer."
    );
  }
  const state = requiredAuthString(options.state, "state");
  const response = await options.apiClient.startExternalProviderOAuthConnection(
    {
      organizationId: requiredAuthString(
        options.organizationId,
        "organizationId"
      ),
      projectId: requiredAuthString(options.projectId, "projectId"),
      environmentId: requiredAuthString(options.environmentId, "environmentId"),
      provider
    },
    {
      state,
      ...(options.redirectUri === undefined
        ? {}
        : {
            redirectUri: requiredAbsoluteUrl(options.redirectUri, "redirectUri")
          }),
      ...(options.scopes === undefined
        ? {}
        : { scopes: normalizedScopes(options.scopes) }),
      ...(options.codeChallenge === undefined
        ? {}
        : {
            codeChallenge: requiredAuthString(
              options.codeChallenge,
              "codeChallenge"
            )
          })
    }
  );
  const authorization = parseExternalProviderAuthorizationStartResponse(
    response.body
  );
  if (authorization.provider !== provider) {
    throw new DashboardApiClientError(
      "INVALID_AUTH_REQUEST",
      "Dashboard external provider OAuth start response provider does not match the request."
    );
  }
  if (authorization.state !== state) {
    throw new DashboardApiClientError(
      "AUTH_STATE_MISMATCH",
      "Dashboard external provider OAuth start response state does not match the request."
    );
  }
  const createdAt = options.clock.now();
  const pendingState: DashboardExternalProviderOAuthPendingState = {
    provider,
    organizationId: options.organizationId,
    projectId: options.projectId,
    environmentId: options.environmentId,
    state,
    redirectUri: authorization.redirectUri,
    scopes: authorization.scopes,
    ...(options.codeVerifier === undefined
      ? {}
      : {
          codeVerifier: requiredAuthString(options.codeVerifier, "codeVerifier")
        }),
    createdAt,
    expiresAt: createdAt + ttlSeconds
  };
  await options.store.save(pendingState);
  return {
    authorizationUrl: authorization.authorizationUrl,
    pendingState
  };
}

export async function redirectDashboardExternalProviderOAuth(
  options: DashboardExternalProviderOAuthRedirectOptions
): Promise<DashboardExternalProviderOAuthStartResult> {
  const result = await startDashboardExternalProviderOAuth(options);
  try {
    await options.navigation.assign(result.authorizationUrl);
  } catch (error) {
    throw browserNavigationError(error);
  }
  return result;
}

export async function consumeDashboardExternalProviderOAuthCallback(
  options: DashboardExternalProviderOAuthConsumeCallbackOptions
): Promise<DashboardExternalProviderOAuthConsumeCallbackResult> {
  const state = callbackState(options.callbackUrl);
  const loadedState = await options.store.load(state);
  if (!loadedState) {
    throw new DashboardApiClientError(
      "AUTH_STATE_NOT_FOUND",
      "Dashboard external provider OAuth pending state was not found."
    );
  }
  let pendingState: DashboardExternalProviderOAuthPendingState;
  try {
    pendingState = validateExternalProviderOAuthPendingState(loadedState);
  } catch (error) {
    await options.store.delete(state);
    throw error;
  }
  if (pendingState.expiresAt <= options.clock.now()) {
    await options.store.delete(pendingState.state);
    throw new DashboardApiClientError(
      "AUTH_STATE_EXPIRED",
      "Dashboard external provider OAuth pending state is expired."
    );
  }

  let callback: DashboardExternalProviderOAuthCallbackResult;
  try {
    callback = parseDashboardExternalProviderOAuthCallback({
      callbackUrl: options.callbackUrl,
      expectedState: pendingState
    });
  } catch (error) {
    await options.store.delete(pendingState.state);
    throw error;
  }
  await options.store.delete(pendingState.state);
  return {
    callback,
    completionRequest: {
      organizationId: pendingState.organizationId,
      projectId: pendingState.projectId,
      environmentId: pendingState.environmentId,
      provider: pendingState.provider,
      body: {
        code: callback.code,
        redirectUri: pendingState.redirectUri,
        ...(pendingState.codeVerifier === undefined
          ? {}
          : { codeVerifier: pendingState.codeVerifier }),
        scopes: pendingState.scopes
      }
    }
  };
}

export async function completeDashboardExternalProviderOAuthCallback(
  options: DashboardExternalProviderOAuthCompleteCallbackOptions
): Promise<DashboardExternalProviderOAuthCompleteCallbackResult> {
  const result = await consumeDashboardExternalProviderOAuthCallback({
    callbackUrl: options.callbackUrl,
    store: options.store,
    clock: options.clock
  });
  const response =
    await options.apiClient.completeExternalProviderOAuthConnection(
      {
        organizationId: result.completionRequest.organizationId,
        projectId: result.completionRequest.projectId,
        environmentId: result.completionRequest.environmentId,
        provider: result.completionRequest.provider
      },
      result.completionRequest.body
    );
  return {
    callback: result.callback,
    response
  };
}

export function createDashboardBrowserExternalProviderOAuthStore(
  options: DashboardBrowserExternalProviderOAuthStorageOptions
): DashboardExternalProviderOAuthPendingStore {
  const namespace = requiredStorageNamespace(
    options.namespace ?? "searchlint:dashboard:external-provider-oauth"
  );

  return {
    save(state) {
      const pendingState = validateExternalProviderOAuthPendingState(state);
      try {
        options.storage.setItem(
          pendingStateStorageKey(namespace, pendingState.state),
          JSON.stringify(pendingState)
        );
      } catch (error) {
        throw storageError("write", error);
      }
    },
    load(state) {
      const key = pendingStateStorageKey(namespace, state);
      let serialized: string | null;
      try {
        serialized = options.storage.getItem(key);
      } catch (error) {
        throw storageError("read", error);
      }
      if (serialized === null) {
        return undefined;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(serialized);
      } catch {
        removeCorruptedStorageValue(options.storage, key);
        throw new DashboardApiClientError(
          "INVALID_AUTH_REQUEST",
          "Dashboard external provider OAuth pending state storage value must be valid JSON."
        );
      }
      try {
        return validateExternalProviderOAuthPendingState(
          parsed as DashboardExternalProviderOAuthPendingState
        );
      } catch (error) {
        removeCorruptedStorageValue(options.storage, key);
        throw error;
      }
    },
    delete(state) {
      try {
        options.storage.removeItem(pendingStateStorageKey(namespace, state));
      } catch (error) {
        throw storageError("delete", error);
      }
    }
  };
}

export function createDashboardBrowserPkceAuthStore(
  options: DashboardBrowserPkceStorageOptions
): DashboardCognitoPendingAuthStore {
  const namespace = requiredStorageNamespace(
    options.namespace ?? "searchlint:dashboard:cognito-pkce"
  );

  return {
    save(state) {
      const pendingState = validatePendingPkceAuthState(state);
      try {
        options.storage.setItem(
          pendingStateStorageKey(namespace, pendingState.state),
          JSON.stringify(pendingState)
        );
      } catch (error) {
        throw storageError("write", error);
      }
    },
    load(state) {
      const key = pendingStateStorageKey(namespace, state);
      let serialized: string | null;
      try {
        serialized = options.storage.getItem(key);
      } catch (error) {
        throw storageError("read", error);
      }
      if (serialized === null) {
        return undefined;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(serialized);
      } catch (error) {
        removeCorruptedStorageValue(options.storage, key);
        throw new DashboardApiClientError(
          "INVALID_AUTH_REQUEST",
          "Dashboard auth pending state storage value must be valid JSON."
        );
      }
      try {
        return validatePendingPkceAuthState(
          parsed as DashboardCognitoPendingPkceAuthState
        );
      } catch (error) {
        removeCorruptedStorageValue(options.storage, key);
        throw error;
      }
    },
    delete(state) {
      try {
        options.storage.removeItem(pendingStateStorageKey(namespace, state));
      } catch (error) {
        throw storageError("delete", error);
      }
    }
  };
}

export function createDashboardBrowserAuthSessionStore(
  options: DashboardBrowserSessionStorageOptions
): DashboardAuthSessionStore {
  const namespace = requiredStorageNamespace(
    options.namespace ?? "searchlint:dashboard:auth-session"
  );
  const key = `${namespace}:current`;

  return {
    save(session) {
      const authSession = validateSession(session);
      try {
        options.storage.setItem(key, JSON.stringify(authSession));
      } catch (error) {
        throw storageError("write", error);
      }
    },
    load() {
      let serialized: string | null;
      try {
        serialized = options.storage.getItem(key);
      } catch (error) {
        throw storageError("read", error);
      }
      if (serialized === null) {
        return undefined;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(serialized);
      } catch {
        removeCorruptedStorageValue(options.storage, key);
        throw new DashboardApiClientError(
          "INVALID_AUTH_SESSION",
          "Dashboard auth session storage value must be valid JSON."
        );
      }
      try {
        return validateSession(parsed as DashboardAuthSession);
      } catch (error) {
        removeCorruptedStorageValue(options.storage, key);
        throw error;
      }
    },
    delete() {
      try {
        options.storage.removeItem(key);
      } catch (error) {
        throw storageError("delete", error);
      }
    }
  };
}

export async function exchangeDashboardCognitoAuthorizationCode(
  options: DashboardCognitoTokenExchangeOptions
): Promise<DashboardAuthSession> {
  const hostedUi = parseHostedUiDomain(options.hostedUiDomain);
  const clientId = requiredAuthString(options.clientId, "clientId");
  const redirectUri = requiredAbsoluteUrl(options.redirectUri, "redirectUri");
  const code = requiredAuthString(options.code, "code");
  const codeVerifier = requiredAuthString(options.codeVerifier, "codeVerifier");
  const body = new URLSearchParams();
  body.set("grant_type", "authorization_code");
  body.set("client_id", clientId);
  body.set("redirect_uri", redirectUri);
  body.set("code", code);
  body.set("code_verifier", codeVerifier);

  const init: DashboardCognitoTokenFetchRequestInit = {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/x-www-form-urlencoded"
    },
    body: body.toString()
  };
  if (options.signal !== undefined) {
    init.signal = options.signal;
  }

  try {
    const response = await options.fetch(
      new URL("/oauth2/token", hostedUi).toString(),
      init
    );
    const payload = await parseTokenResponseBody(response);
    if (response.status >= 400) {
      throw tokenProviderError(payload);
    }
    return parseDashboardAuthSession(payload, options.clock);
  } catch (error) {
    if (error instanceof DashboardApiClientError) {
      throw error;
    }
    throw new DashboardApiClientError(
      "TRANSPORT_ERROR",
      error instanceof Error
        ? `Cognito token exchange failed: ${error.message}`
        : "Cognito token exchange failed."
    );
  }
}

export async function refreshDashboardCognitoAuthSession(
  options: DashboardCognitoRefreshTokenOptions
): Promise<DashboardAuthSession> {
  const hostedUi = parseHostedUiDomain(options.hostedUiDomain);
  const clientId = requiredAuthString(options.clientId, "clientId");
  const refreshToken = requiredAuthString(options.refreshToken, "refreshToken");
  const body = new URLSearchParams();
  body.set("grant_type", "refresh_token");
  body.set("client_id", clientId);
  body.set("refresh_token", refreshToken);

  const init: DashboardCognitoTokenFetchRequestInit = {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/x-www-form-urlencoded"
    },
    body: body.toString()
  };
  if (options.signal !== undefined) {
    init.signal = options.signal;
  }

  try {
    const response = await options.fetch(
      new URL("/oauth2/token", hostedUi).toString(),
      init
    );
    const payload = await parseTokenResponseBody(response);
    if (response.status >= 400) {
      throw tokenProviderError(payload);
    }
    return parseDashboardAuthSession(payload, options.clock, refreshToken);
  } catch (error) {
    if (error instanceof DashboardApiClientError) {
      throw error;
    }
    throw new DashboardApiClientError(
      "TRANSPORT_ERROR",
      error instanceof Error
        ? `Cognito token exchange failed: ${error.message}`
        : "Cognito token exchange failed."
    );
  }
}

function buildPath(
  pattern: string,
  requiredParams: readonly string[],
  params: DashboardApiPathParams
): string {
  for (const key of requiredParams) {
    const value = params[key as keyof DashboardApiPathParams];
    if (!isNonEmptyString(value)) {
      throw new DashboardApiClientError(
        "MISSING_PATH_PARAM",
        `Missing dashboard API path parameter ${key}.`
      );
    }
    if (key === "provider" && value !== "google" && value !== "yandex") {
      throw new DashboardApiClientError(
        "MISSING_PATH_PARAM",
        "Dashboard API provider path parameter must be google or yandex."
      );
    }
  }

  return pattern.replaceAll(/\{([^}]+)\}/g, (_match, key: string) =>
    encodeURIComponent(params[key as keyof DashboardApiPathParams]!)
  );
}

function parseBaseUrl(value: string): URL {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new Error("Unsupported protocol.");
    }
    return url;
  } catch {
    throw new DashboardApiClientError(
      "INVALID_BASE_URL",
      "Dashboard API base URL must be an absolute HTTP(S) URL."
    );
  }
}

function parseHostedUiDomain(value: string): URL {
  const url = new URL(requiredAbsoluteUrl(value, "hostedUiDomain"));
  if (url.pathname !== "/" || url.search !== "" || url.hash !== "") {
    throw new DashboardApiClientError(
      "INVALID_AUTH_REQUEST",
      "Dashboard Cognito hosted UI domain must not include a path, query, or fragment."
    );
  }
  return url;
}

function requiredAbsoluteUrl(value: string, key: string): string {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new Error("Unsupported protocol.");
    }
    return url.toString();
  } catch {
    throw new DashboardApiClientError(
      "INVALID_AUTH_REQUEST",
      `Dashboard auth ${key} must be an absolute HTTP(S) URL.`
    );
  }
}

function requiredAuthString(value: string, key: string): string {
  if (!isNonEmptyString(value)) {
    throw new DashboardApiClientError(
      "INVALID_AUTH_REQUEST",
      `Dashboard auth ${key} is required.`
    );
  }
  return value;
}

function callbackState(callbackUrl: string): string {
  const url = new URL(requiredAbsoluteUrl(callbackUrl, "callbackUrl"));
  const state = url.searchParams.get("state");
  if (!isNonEmptyString(state)) {
    throw new DashboardApiClientError(
      "INVALID_AUTH_REQUEST",
      "Dashboard auth callback state is required."
    );
  }
  return state;
}

function parseDashboardExternalProviderOAuthCallback(input: {
  callbackUrl: string;
  expectedState: DashboardExternalProviderOAuthPendingState;
}): DashboardExternalProviderOAuthCallbackResult {
  const callbackUrl = requiredAbsoluteUrl(input.callbackUrl, "callbackUrl");
  const callback = new URL(callbackUrl);
  const expectedState = requiredAuthString(
    input.expectedState.state,
    "expectedState.state"
  );
  const state = callback.searchParams.get("state");
  if (!isNonEmptyString(state)) {
    throw new DashboardApiClientError(
      "INVALID_AUTH_REQUEST",
      "Dashboard external provider OAuth callback state is required."
    );
  }
  if (state !== expectedState) {
    throw new DashboardApiClientError(
      "AUTH_STATE_MISMATCH",
      "Dashboard external provider OAuth callback state does not match the pending request."
    );
  }

  const providerError = callback.searchParams.get("error");
  if (isNonEmptyString(providerError)) {
    const description = callback.searchParams.get("error_description");
    throw new DashboardApiClientError(
      "AUTH_PROVIDER_ERROR",
      `External provider authorization failed: ${providerError}${isNonEmptyString(description) ? ` (${description})` : ""}.`
    );
  }

  const code = callback.searchParams.get("code");
  if (!isNonEmptyString(code)) {
    throw new DashboardApiClientError(
      "INVALID_AUTH_REQUEST",
      "Dashboard external provider OAuth callback code is required."
    );
  }
  return {
    provider: input.expectedState.provider,
    code,
    state
  };
}

function parseExternalProviderAuthorizationStartResponse(body: unknown): {
  provider: DashboardExternalProvider;
  authorizationUrl: string;
  state: string;
  redirectUri: string;
  scopes: readonly string[];
} {
  const fields = objectBody(body);
  return {
    provider: requiredExternalProvider(fields.provider),
    authorizationUrl: requiredAbsoluteUrl(
      requiredBodyString(fields, "authorizationUrl"),
      "authorizationUrl"
    ),
    state: requiredAuthString(requiredBodyString(fields, "state"), "state"),
    redirectUri: requiredAbsoluteUrl(
      requiredBodyString(fields, "redirectUri"),
      "redirectUri"
    ),
    scopes: normalizedScopes(requiredBodyStringList(fields, "scopes"))
  };
}

function validatePendingPkceAuthState(
  state: DashboardCognitoPendingPkceAuthState
): DashboardCognitoPendingPkceAuthState {
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new DashboardApiClientError(
      "INVALID_AUTH_REQUEST",
      "Dashboard auth pending state must be an object."
    );
  }
  requiredAuthString(state.state, "state");
  requiredAuthString(state.nonce, "nonce");
  requiredAuthString(state.codeChallenge, "codeChallenge");
  requiredAbsoluteUrl(state.redirectUri, "redirectUri");
  requiredAuthString(state.codeVerifier, "codeVerifier");
  if (!Number.isFinite(state.createdAt) || state.createdAt <= 0) {
    throw new DashboardApiClientError(
      "INVALID_AUTH_REQUEST",
      "Dashboard auth pending state createdAt must be a positive epoch second."
    );
  }
  if (!Number.isFinite(state.expiresAt) || state.expiresAt <= state.createdAt) {
    throw new DashboardApiClientError(
      "INVALID_AUTH_REQUEST",
      "Dashboard auth pending state expiresAt must be after createdAt."
    );
  }
  return state;
}

function validateExternalProviderOAuthPendingState(
  state: DashboardExternalProviderOAuthPendingState
): DashboardExternalProviderOAuthPendingState {
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new DashboardApiClientError(
      "INVALID_AUTH_REQUEST",
      "Dashboard external provider OAuth pending state must be an object."
    );
  }
  const pendingState = state as DashboardExternalProviderOAuthPendingState;
  const provider = requiredExternalProvider(pendingState.provider);
  requiredAuthString(pendingState.organizationId, "organizationId");
  requiredAuthString(pendingState.projectId, "projectId");
  requiredAuthString(pendingState.environmentId, "environmentId");
  requiredAuthString(pendingState.state, "state");
  requiredAbsoluteUrl(pendingState.redirectUri, "redirectUri");
  const scopes = normalizedScopes(pendingState.scopes);
  if (pendingState.codeVerifier !== undefined) {
    requiredAuthString(pendingState.codeVerifier, "codeVerifier");
  }
  if (!Number.isFinite(pendingState.createdAt) || pendingState.createdAt <= 0) {
    throw new DashboardApiClientError(
      "INVALID_AUTH_REQUEST",
      "Dashboard external provider OAuth pending state createdAt must be a positive epoch second."
    );
  }
  if (
    !Number.isFinite(pendingState.expiresAt) ||
    pendingState.expiresAt <= pendingState.createdAt
  ) {
    throw new DashboardApiClientError(
      "INVALID_AUTH_REQUEST",
      "Dashboard external provider OAuth pending state expiresAt must be after createdAt."
    );
  }
  return {
    ...pendingState,
    provider,
    scopes
  };
}

function requiredExternalProvider(value: unknown): DashboardExternalProvider {
  if (value === "google" || value === "yandex") {
    return value;
  }
  throw new DashboardApiClientError(
    "INVALID_AUTH_REQUEST",
    "Dashboard external provider OAuth provider must be google or yandex."
  );
}

function requiredStorageNamespace(namespace: string): string {
  if (!isNonEmptyString(namespace)) {
    throw new DashboardApiClientError(
      "INVALID_AUTH_REQUEST",
      "Dashboard auth storage namespace is required."
    );
  }
  return namespace.trim();
}

function pendingStateStorageKey(namespace: string, state: string): string {
  return `${namespace}:${encodeURIComponent(requiredAuthString(state, "state"))}`;
}

function removeCorruptedStorageValue(
  storage: DashboardBrowserStorageLike,
  key: string
): void {
  try {
    storage.removeItem(key);
  } catch {
    throw new DashboardApiClientError(
      "AUTH_STORAGE_ERROR",
      "Dashboard auth storage delete failed while cleaning invalid pending state."
    );
  }
}

function storageError(
  operation: string,
  error: unknown
): DashboardApiClientError {
  return new DashboardApiClientError(
    "AUTH_STORAGE_ERROR",
    error instanceof Error
      ? `Dashboard auth storage ${operation} failed: ${error.message}`
      : `Dashboard auth storage ${operation} failed.`
  );
}

function browserNavigationError(error: unknown): DashboardApiClientError {
  return new DashboardApiClientError(
    "TRANSPORT_ERROR",
    error instanceof Error
      ? `Dashboard browser navigation failed: ${error.message}`
      : "Dashboard browser navigation failed."
  );
}

function normalizedScopes(scopes: readonly string[]): readonly string[] {
  const normalized = [...new Set(scopes.map((scope) => scope.trim()))]
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right));
  if (normalized.length === 0) {
    throw new DashboardApiClientError(
      "INVALID_AUTH_REQUEST",
      "Dashboard auth scopes are required."
    );
  }
  return normalized;
}

function apiUrl(baseUrl: URL, path: string): string {
  const normalizedBase = baseUrl.toString().replace(/\/+$/u, "");
  return `${normalizedBase}${path}`;
}

async function resolveAccessToken(
  token: string | DashboardApiAccessTokenProvider
): Promise<string> {
  const value = typeof token === "function" ? await token() : token;
  if (!isNonEmptyString(value)) {
    throw new DashboardApiClientError(
      "ACCESS_TOKEN_UNAVAILABLE",
      "Dashboard API access token is required."
    );
  }
  return value;
}

function validateSession(session: DashboardAuthSession): DashboardAuthSession {
  if (session.tokenType !== "Bearer") {
    throw new DashboardApiClientError(
      "INVALID_AUTH_SESSION",
      "Dashboard auth session token type must be Bearer."
    );
  }
  if (session.identityProvider !== "cognito") {
    throw new DashboardApiClientError(
      "INVALID_AUTH_SESSION",
      "Dashboard auth session identity provider must be cognito."
    );
  }
  if (!isNonEmptyString(session.accessToken)) {
    throw new DashboardApiClientError(
      "ACCESS_TOKEN_UNAVAILABLE",
      "Dashboard auth session access token is required."
    );
  }
  if (!Number.isFinite(session.expiresAt) || session.expiresAt <= 0) {
    throw new DashboardApiClientError(
      "INVALID_AUTH_SESSION",
      "Dashboard auth session expiresAt must be a positive epoch second."
    );
  }
  return session;
}

function isSessionUsable(
  session: DashboardAuthSession,
  clock: DashboardSessionClock,
  expirySkewSeconds: number
): boolean {
  return session.expiresAt - expirySkewSeconds > clock.now();
}

function validExpirySkewSeconds(value: number | undefined): number {
  const expirySkewSeconds = value ?? 60;
  if (!Number.isFinite(expirySkewSeconds) || expirySkewSeconds < 0) {
    throw new DashboardApiClientError(
      "INVALID_AUTH_SESSION",
      "Dashboard session expiry skew must be a non-negative number."
    );
  }
  return expirySkewSeconds;
}

async function loadStoredSession(
  sessionStore: DashboardAuthSessionStore
): Promise<DashboardAuthSession> {
  const storedSession = await sessionStore.load();
  if (!storedSession) {
    throw new DashboardApiClientError(
      "ACCESS_TOKEN_UNAVAILABLE",
      "Dashboard auth session was not found."
    );
  }
  return storedSession;
}

async function parseFetchResponseBody(
  response: DashboardApiFetchResponse
): Promise<unknown> {
  const contentType = response.headers?.get("content-type") ?? "";
  if (contentType.toLowerCase().includes("application/json")) {
    return response.json();
  }
  if (response.text) {
    return response.text();
  }
  return response.json();
}

async function parseTokenResponseBody(
  response: DashboardCognitoTokenFetchResponse
): Promise<unknown> {
  try {
    const contentType = response.headers?.get("content-type") ?? "";
    if (contentType.toLowerCase().includes("application/json")) {
      return response.json();
    }
    if (response.text) {
      const text = await response.text();
      return text ? JSON.parse(text) : {};
    }
    return response.json();
  } catch {
    throw new DashboardApiClientError(
      "INVALID_TOKEN_EXCHANGE",
      "Cognito token exchange response must be valid JSON."
    );
  }
}

function tokenProviderError(payload: unknown): DashboardApiClientError {
  const fields = tokenResponseObject(payload);
  const providerError = optionalProviderErrorString(fields, "error");
  const description = optionalProviderErrorString(fields, "error_description");
  if (providerError) {
    return new DashboardApiClientError(
      "TOKEN_PROVIDER_ERROR",
      `Cognito token exchange failed: ${providerError}${description ? ` (${description})` : ""}.`
    );
  }
  return new DashboardApiClientError(
    "TOKEN_PROVIDER_ERROR",
    "Cognito token exchange failed."
  );
}

function optionalProviderErrorString(
  body: Readonly<Record<string, unknown>>,
  key: string
): string | undefined {
  const value = body[key];
  return isNonEmptyString(value) ? value : undefined;
}

function parseDashboardAuthSession(
  payload: unknown,
  clock: DashboardSessionClock,
  refreshTokenFallback?: string
): DashboardAuthSession {
  const fields = tokenResponseObject(payload);
  const accessToken = requiredTokenString(fields, "access_token");
  const tokenType = requiredTokenString(fields, "token_type");
  if (tokenType !== "Bearer") {
    throw new DashboardApiClientError(
      "INVALID_TOKEN_EXCHANGE",
      "Cognito token exchange token_type must be Bearer."
    );
  }
  const expiresIn = fields["expires_in"];
  if (
    typeof expiresIn !== "number" ||
    !Number.isInteger(expiresIn) ||
    expiresIn <= 0
  ) {
    throw new DashboardApiClientError(
      "INVALID_TOKEN_EXCHANGE",
      "Cognito token exchange expires_in must be a positive integer."
    );
  }
  const idToken = optionalTokenString(fields, "id_token");
  const refreshToken =
    optionalTokenString(fields, "refresh_token") ?? refreshTokenFallback;
  return {
    accessToken,
    expiresAt: clock.now() + expiresIn,
    tokenType: "Bearer",
    identityProvider: "cognito",
    ...(idToken ? { idToken } : {}),
    ...(refreshToken ? { refreshToken } : {})
  };
}

function tokenResponseObject(
  payload: unknown
): Readonly<Record<string, unknown>> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new DashboardApiClientError(
      "INVALID_TOKEN_EXCHANGE",
      "Cognito token exchange response must be an object."
    );
  }
  return payload as Readonly<Record<string, unknown>>;
}

function requiredTokenString(
  body: Readonly<Record<string, unknown>>,
  key: string
): string {
  const value = optionalTokenString(body, key);
  if (!value) {
    throw new DashboardApiClientError(
      "INVALID_TOKEN_EXCHANGE",
      `Cognito token exchange ${key} is required.`
    );
  }
  return value;
}

function optionalTokenString(
  body: Readonly<Record<string, unknown>>,
  key: string
): string | undefined {
  const value = body[key];
  if (value === undefined) {
    return undefined;
  }
  if (!isNonEmptyString(value)) {
    throw new DashboardApiClientError(
      "INVALID_TOKEN_EXCHANGE",
      `Cognito token exchange ${key} must be a non-empty string.`
    );
  }
  return value;
}

function validateBody<TAction extends DashboardAction>(
  action: TAction,
  body: DashboardApiBodyByAction[TAction]
): void {
  if (action === "getDashboardSnapshot") {
    if (body !== undefined) {
      throw new DashboardApiClientError(
        "INVALID_REQUEST_BODY",
        "getDashboardSnapshot must not include a request body."
      );
    }
    return;
  }

  const fields = objectBody(body);

  if (action === "createProject") {
    requiredString(fields, "name");
    requiredString(fields, "siteUrl");
    return;
  }

  if (action === "createEnvironment") {
    requiredString(fields, "name");
    requiredString(fields, "baseUrl");
    return;
  }

  if (action === "requestCrawl") {
    requiredPositiveInteger(fields, "maxUrls");
    return;
  }

  if (action === "addMember") {
    requiredString(fields, "principalId");
    const role = requiredString(fields, "role");
    if (!apiRoles.includes(role as DashboardApiRole)) {
      throw new DashboardApiClientError(
        "INVALID_REQUEST_BODY",
        "role is not supported."
      );
    }
    return;
  }

  if (action === "startExternalProviderOAuthConnection") {
    requiredString(fields, "state");
    optionalString(fields, "redirectUri");
    optionalString(fields, "codeChallenge");
    optionalStringList(fields, "scopes");
    return;
  }

  if (action === "completeExternalProviderOAuthConnection") {
    requiredString(fields, "code");
    requiredString(fields, "redirectUri");
    optionalString(fields, "codeVerifier");
    optionalStringList(fields, "scopes");
    return;
  }
}

function optionalString(
  body: Readonly<Record<string, unknown>>,
  key: string
): string | undefined {
  const value = body[key];
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!isNonEmptyString(value)) {
    throw new DashboardApiClientError(
      "INVALID_REQUEST_BODY",
      `${key} must be a non-empty string.`
    );
  }
  return value;
}

function optionalStringList(
  body: Readonly<Record<string, unknown>>,
  key: string
): readonly string[] | undefined {
  const value = body[key];
  if (value === undefined || value === null) {
    return undefined;
  }
  if (
    !Array.isArray(value) ||
    value.some((entry) => !isNonEmptyString(entry))
  ) {
    throw new DashboardApiClientError(
      "INVALID_REQUEST_BODY",
      `${key} must be an array of non-empty strings.`
    );
  }
  return value;
}

function objectBody(body: unknown): Readonly<Record<string, unknown>> {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new DashboardApiClientError(
      "INVALID_REQUEST_BODY",
      "Dashboard API request body must be an object."
    );
  }
  return body as Readonly<Record<string, unknown>>;
}

function requiredString(
  body: Readonly<Record<string, unknown>>,
  key: string
): string {
  const value = body[key];
  if (!isNonEmptyString(value)) {
    throw new DashboardApiClientError(
      "INVALID_REQUEST_BODY",
      `${key} must be a non-empty string.`
    );
  }
  return value;
}

function requiredBodyString(
  body: Readonly<Record<string, unknown>>,
  key: string
): string {
  const value = body[key];
  if (!isNonEmptyString(value)) {
    throw new DashboardApiClientError(
      "INVALID_AUTH_REQUEST",
      `Dashboard external provider OAuth ${key} is required.`
    );
  }
  return value;
}

function requiredBodyStringList(
  body: Readonly<Record<string, unknown>>,
  key: string
): readonly string[] {
  const value = body[key];
  if (
    !Array.isArray(value) ||
    value.some((entry) => !isNonEmptyString(entry))
  ) {
    throw new DashboardApiClientError(
      "INVALID_AUTH_REQUEST",
      `Dashboard external provider OAuth ${key} must be an array of non-empty strings.`
    );
  }
  return value;
}

function requiredPositiveInteger(
  body: Readonly<Record<string, unknown>>,
  key: string
): number {
  const value = body[key];
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new DashboardApiClientError(
      "INVALID_REQUEST_BODY",
      `${key} must be a positive integer.`
    );
  }
  return value;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
