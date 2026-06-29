import type {
  ExternalObservationProvider,
  OAuthConnectionRecord
} from "@searchlint/api";

export type ExternalObservationOAuthRefreshFetchResponse = {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
};

export type ExternalObservationOAuthRefreshFetch = (
  url: string,
  init: {
    method: "POST";
    headers: Readonly<Record<string, string>>;
    body: string;
  }
) => Promise<ExternalObservationOAuthRefreshFetchResponse>;

export type ExternalObservationOAuthRefreshInput = {
  connection: OAuthConnectionRecord;
  refreshToken: string;
  now: string;
};

export type ExternalObservationOAuthRefreshResult = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
};

export type ExternalObservationOAuthTokenRefresher = {
  refreshAccessToken(
    input: ExternalObservationOAuthRefreshInput
  ): Promise<ExternalObservationOAuthRefreshResult>;
};

export type ExternalObservationOAuthTokenRefreshers = Partial<
  Record<ExternalObservationProvider, ExternalObservationOAuthTokenRefresher>
>;

export type OAuthRefreshClientCredentials = {
  clientId: string;
  clientSecret: string;
};

export type OAuthRefreshAdapterOptions = OAuthRefreshClientCredentials & {
  fetch: ExternalObservationOAuthRefreshFetch;
  tokenEndpoint?: string;
};

export class ExternalObservationOAuthRefreshError extends Error {
  readonly provider: ExternalObservationProvider;
  readonly status: number;
  readonly payload: unknown;

  constructor(input: {
    provider: ExternalObservationProvider;
    status: number;
    payload: unknown;
  }) {
    super(
      `${input.provider} OAuth refresh request failed with status ${input.status}.`
    );
    this.name = "ExternalObservationOAuthRefreshError";
    this.provider = input.provider;
    this.status = input.status;
    this.payload = input.payload;
  }
}

export function createGoogleOAuthTokenRefresher(
  options: OAuthRefreshAdapterOptions
): ExternalObservationOAuthTokenRefresher {
  return createOAuthTokenRefresher({
    ...options,
    provider: "google",
    tokenEndpoint:
      options.tokenEndpoint ?? "https://oauth2.googleapis.com/token"
  });
}

export function createYandexOAuthTokenRefresher(
  options: OAuthRefreshAdapterOptions
): ExternalObservationOAuthTokenRefresher {
  return createOAuthTokenRefresher({
    ...options,
    provider: "yandex",
    tokenEndpoint: options.tokenEndpoint ?? "https://oauth.yandex.com/token"
  });
}

function createOAuthTokenRefresher(
  options: OAuthRefreshAdapterOptions & {
    provider: ExternalObservationProvider;
    tokenEndpoint: string;
  }
): ExternalObservationOAuthTokenRefresher {
  return {
    async refreshAccessToken(input) {
      const response = await options.fetch(options.tokenEndpoint, {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/x-www-form-urlencoded"
        },
        body: refreshBody({
          refreshToken: input.refreshToken,
          clientId: options.clientId,
          clientSecret: options.clientSecret
        })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new ExternalObservationOAuthRefreshError({
          provider: options.provider,
          status: response.status,
          payload
        });
      }
      return refreshResult(payload, input.now);
    }
  };
}

function refreshBody(input: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
}): string {
  const params = new URLSearchParams();
  params.set("grant_type", "refresh_token");
  params.set("refresh_token", input.refreshToken);
  params.set("client_id", input.clientId);
  params.set("client_secret", input.clientSecret);
  return params.toString();
}

function refreshResult(
  payload: unknown,
  now: string
): ExternalObservationOAuthRefreshResult {
  const value = plainObject(payload);
  const accessToken = nonEmptyString(value.access_token, "access_token");
  const refreshToken = optionalNonEmptyString(value.refresh_token);
  const expiresIn = optionalPositiveNumber(value.expires_in);
  return {
    accessToken,
    ...(refreshToken === undefined ? {} : { refreshToken }),
    ...(expiresIn === undefined ? {} : { expiresAt: expiresAt(now, expiresIn) })
  };
}

function plainObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  throw new Error("OAuth refresh response must be a JSON object.");
}

function nonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(
      `OAuth refresh response ${field} must be a non-empty string.`
    );
  }
  return value;
}

function optionalNonEmptyString(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  return nonEmptyString(value, "refresh_token");
}

function optionalPositiveNumber(value: unknown): number | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new Error("OAuth refresh response expires_in must be positive.");
  }
  return value;
}

function expiresAt(now: string, expiresInSeconds: number): string {
  const timestamp = Date.parse(now);
  if (!Number.isFinite(timestamp)) {
    throw new Error("OAuth refresh timestamp must be a valid ISO date.");
  }
  return new Date(timestamp + expiresInSeconds * 1000).toISOString();
}
