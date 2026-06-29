import type { CloudApiOperation } from "./http-contracts.js";
import { cloudHttpRouteContracts } from "./http-contracts.js";
import type {
  AddMemberInput,
  CompleteExternalProviderOAuthConnectionInput,
  CreateEnvironmentInput,
  CreateOrganizationInput,
  CreateProjectInput,
  GetDashboardSnapshotInput,
  RequestCrawlInput,
  StartExternalProviderOAuthConnectionInput
} from "./api.js";
import type {
  CrawlRequest,
  DashboardSnapshotPayload,
  Environment,
  Organization,
  OrganizationMembership,
  Principal,
  Project
} from "./types.js";
import { CloudApiError } from "./types.js";

export type CloudHttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

export type CloudHttpRequest = {
  method: CloudHttpMethod;
  path: string;
  principal?: Principal;
  body?: unknown;
  signal?: AbortSignal;
};

export type CloudHttpResponse = {
  status: number;
  body: unknown;
};

export type CloudHttpApplication = {
  createOrganization(input: CreateOrganizationInput): Promise<{
    organization: Organization;
    membership: OrganizationMembership;
  }>;
  addMember(input: AddMemberInput): Promise<OrganizationMembership>;
  createProject(input: CreateProjectInput): Promise<Project>;
  createEnvironment(input: CreateEnvironmentInput): Promise<Environment>;
  requestCrawl(input: RequestCrawlInput): Promise<{
    crawlRequest: CrawlRequest;
    jobId: string;
  }>;
  getDashboardSnapshot(
    input: GetDashboardSnapshotInput
  ): Promise<DashboardSnapshotPayload>;
  completeExternalProviderOAuthConnection(
    input: CompleteExternalProviderOAuthConnectionInput
  ): Promise<{ oauthConnection: unknown }>;
  startExternalProviderOAuthConnection(
    input: StartExternalProviderOAuthConnectionInput
  ): Promise<unknown>;
};

export function createCloudHttpDispatcher(
  application: CloudHttpApplication
): (request: CloudHttpRequest) => Promise<CloudHttpResponse> {
  return async (request) => {
    const match = matchCloudRoute(request.method, request.path);
    if (!match) {
      return errorResponse(404, "NOT_FOUND", "Route was not found.");
    }

    if (!request.principal) {
      return errorResponse(
        401,
        "UNAUTHENTICATED",
        "Authenticated principal is required."
      );
    }

    try {
      const dispatchInput: {
        operation: CloudApiOperation;
        principal: Principal;
        params: Readonly<Record<string, string>>;
        body: unknown;
        signal?: AbortSignal;
      } = {
        operation: match.operation,
        principal: request.principal,
        params: match.params,
        body: request.body
      };
      if (request.signal) {
        dispatchInput.signal = request.signal;
      }
      const result = await dispatchOperation(application, dispatchInput);
      return {
        status: successStatus(match.operation),
        body: result
      };
    } catch (error) {
      return mapError(error);
    }
  };
}

export function matchCloudRoute(
  method: CloudHttpMethod,
  path: string
):
  | { operation: CloudApiOperation; params: Readonly<Record<string, string>> }
  | undefined {
  for (const contract of cloudHttpRouteContracts) {
    if (contract.method !== method) {
      continue;
    }
    const params = matchPath(contract.path, path);
    if (params) {
      return { operation: contract.operation, params };
    }
  }
  return undefined;
}

async function dispatchOperation(
  application: CloudHttpApplication,
  input: {
    operation: CloudApiOperation;
    principal: Principal;
    params: Readonly<Record<string, string>>;
    body: unknown;
    signal?: AbortSignal;
  }
): Promise<unknown> {
  if (input.operation === "createOrganization") {
    return application.createOrganization(
      withSignal(
        {
          actor: input.principal,
          name: requiredString(input.body, "name")
        },
        input.signal
      )
    );
  }

  if (input.operation === "addMember") {
    return application.addMember(
      withSignal(
        {
          actor: input.principal,
          organizationId: requiredParam(input.params, "organizationId"),
          principalId: requiredString(input.body, "principalId"),
          role: organizationRole(requiredString(input.body, "role"))
        },
        input.signal
      )
    );
  }

  if (input.operation === "createProject") {
    return application.createProject(
      withSignal(
        {
          actor: input.principal,
          organizationId: requiredParam(input.params, "organizationId"),
          name: requiredString(input.body, "name"),
          siteUrl: requiredString(input.body, "siteUrl")
        },
        input.signal
      )
    );
  }

  if (input.operation === "createEnvironment") {
    return application.createEnvironment(
      withSignal(
        {
          actor: input.principal,
          organizationId: requiredParam(input.params, "organizationId"),
          projectId: requiredParam(input.params, "projectId"),
          name: requiredString(input.body, "name"),
          baseUrl: requiredString(input.body, "baseUrl")
        },
        input.signal
      )
    );
  }

  if (input.operation === "getDashboardSnapshot") {
    return application.getDashboardSnapshot(
      withSignal(
        {
          actor: input.principal,
          organizationId: requiredParam(input.params, "organizationId"),
          projectId: requiredParam(input.params, "projectId"),
          environmentId: requiredParam(input.params, "environmentId")
        },
        input.signal
      )
    );
  }

  if (input.operation === "completeExternalProviderOAuthConnection") {
    return application.completeExternalProviderOAuthConnection(
      withSignal(
        {
          actor: input.principal,
          organizationId: requiredParam(input.params, "organizationId"),
          projectId: requiredParam(input.params, "projectId"),
          environmentId: requiredParam(input.params, "environmentId"),
          provider: externalProvider(requiredParam(input.params, "provider")),
          code: requiredString(input.body, "code"),
          redirectUri: requiredString(input.body, "redirectUri"),
          ...optionalStringField(input.body, "codeVerifier"),
          ...optionalStringListField(input.body, "scopes")
        },
        input.signal
      )
    );
  }

  if (input.operation === "startExternalProviderOAuthConnection") {
    return application.startExternalProviderOAuthConnection(
      withSignal(
        {
          actor: input.principal,
          organizationId: requiredParam(input.params, "organizationId"),
          projectId: requiredParam(input.params, "projectId"),
          environmentId: requiredParam(input.params, "environmentId"),
          provider: externalProvider(requiredParam(input.params, "provider")),
          state: requiredString(input.body, "state"),
          ...optionalStringField(input.body, "redirectUri"),
          ...optionalStringListField(input.body, "scopes"),
          ...optionalStringFieldAs(input.body, "codeChallenge")
        },
        input.signal
      )
    );
  }

  if (input.operation === "acceptStripeWebhook") {
    throw new CloudApiError(
      "INVALID_INPUT",
      "Stripe webhook route requires raw-body signature handling."
    );
  }

  return application.requestCrawl(
    withSignal(
      {
        actor: input.principal,
        organizationId: requiredParam(input.params, "organizationId"),
        projectId: requiredParam(input.params, "projectId"),
        environmentId: requiredParam(input.params, "environmentId"),
        maxUrls: requiredInteger(input.body, "maxUrls")
      },
      input.signal
    )
  );
}

function withSignal<T extends object>(
  input: T,
  signal: AbortSignal | undefined
): T {
  if (!signal) {
    return input;
  }
  return {
    ...input,
    signal
  };
}

function matchPath(
  pattern: string,
  path: string
): Readonly<Record<string, string>> | undefined {
  const patternParts = pattern.split("/").filter(Boolean);
  const pathParts = path.split("?")[0]?.split("/").filter(Boolean) ?? [];
  if (patternParts.length !== pathParts.length) {
    return undefined;
  }

  const params: Record<string, string> = {};
  for (let index = 0; index < patternParts.length; index += 1) {
    const patternPart = patternParts[index]!;
    const pathPart = decodeURIComponent(pathParts[index]!);
    if (patternPart.startsWith("{") && patternPart.endsWith("}")) {
      params[patternPart.slice(1, -1)] = pathPart;
      continue;
    }
    if (patternPart !== pathPart) {
      return undefined;
    }
  }
  return params;
}

function requiredParam(
  params: Readonly<Record<string, string>>,
  key: string
): string {
  const value = params[key];
  if (!value) {
    throw new CloudApiError("INVALID_INPUT", `Missing route parameter ${key}.`);
  }
  return value;
}

function requiredString(body: unknown, key: string): string {
  const value = objectBody(body)[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new CloudApiError(
      "INVALID_INPUT",
      `${key} must be a non-empty string.`
    );
  }
  return value;
}

function requiredInteger(body: unknown, key: string): number {
  const value = objectBody(body)[key];
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new CloudApiError("INVALID_INPUT", `${key} must be an integer.`);
  }
  return value;
}

function optionalStringField(
  body: unknown,
  key: string
): Record<string, string> {
  const value = objectBody(body)[key];
  if (value === undefined || value === null) {
    return {};
  }
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new CloudApiError(
      "INVALID_INPUT",
      `${key} must be a non-empty string.`
    );
  }
  return { [key]: value };
}

function optionalStringFieldAs<Key extends string>(
  body: unknown,
  key: Key
): Partial<Record<Key, string>> {
  const value = objectBody(body)[key];
  if (value === undefined || value === null) {
    return {};
  }
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new CloudApiError(
      "INVALID_INPUT",
      `${key} must be a non-empty string.`
    );
  }
  return { [key]: value } as Partial<Record<Key, string>>;
}

function optionalStringListField(
  body: unknown,
  key: string
): Record<string, readonly string[]> {
  const value = objectBody(body)[key];
  if (value === undefined || value === null) {
    return {};
  }
  if (
    !Array.isArray(value) ||
    value.some(
      (entry) => typeof entry !== "string" || entry.trim().length === 0
    )
  ) {
    throw new CloudApiError(
      "INVALID_INPUT",
      `${key} must be an array of non-empty strings.`
    );
  }
  return { [key]: value };
}

function objectBody(body: unknown): Readonly<Record<string, unknown>> {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new CloudApiError("INVALID_INPUT", "Request body must be an object.");
  }
  return body as Readonly<Record<string, unknown>>;
}

function organizationRole(value: string): AddMemberInput["role"] {
  if (
    value === "owner" ||
    value === "admin" ||
    value === "developer" ||
    value === "analyst" ||
    value === "client"
  ) {
    return value;
  }
  throw new CloudApiError("INVALID_INPUT", "role is not supported.");
}

function externalProvider(
  value: string
): CompleteExternalProviderOAuthConnectionInput["provider"] {
  if (value === "google" || value === "yandex") {
    return value;
  }
  throw new CloudApiError("INVALID_INPUT", "provider is not supported.");
}

function successStatus(operation: CloudApiOperation): number {
  return operation === "createOrganization" ? 201 : 200;
}

function mapError(error: unknown): CloudHttpResponse {
  if (error instanceof CloudApiError) {
    const statusByCode: Record<string, number> = {
      FORBIDDEN: 403,
      NOT_FOUND: 404,
      ENTITLEMENT_DENIED: 402,
      INVALID_INPUT: 400
    };
    return errorResponse(
      statusByCode[error.code] ?? 500,
      error.code,
      error.message
    );
  }

  return errorResponse(500, "INTERNAL_ERROR", "Internal server error.");
}

function errorResponse(
  status: number,
  code: string,
  message: string
): CloudHttpResponse {
  return {
    status,
    body: {
      error: {
        code,
        message
      }
    }
  };
}
