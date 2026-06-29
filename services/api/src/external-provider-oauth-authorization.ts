import type { ExternalObservationProvider } from "./types.js";
import { CloudApiError } from "./types.js";

export type ExternalProviderOAuthAuthorizationPkce = {
  codeChallenge: string;
  method: "S256";
};

export type ExternalProviderOAuthAuthorizationConfig = {
  provider: ExternalObservationProvider;
  authorizationEndpoint: string;
  clientId: string;
  redirectUri: string;
  scopes: readonly string[];
  pkceRequired?: boolean;
};

export type ExternalProviderOAuthAuthorizationRequest = {
  organizationId: string;
  projectId: string;
  environmentId: string;
  provider: ExternalObservationProvider;
  state: string;
  redirectUri?: string;
  scopes?: readonly string[];
  pkce?: ExternalProviderOAuthAuthorizationPkce;
};

export type ExternalProviderOAuthAuthorizationResult = {
  provider: ExternalObservationProvider;
  authorizationUrl: string;
  state: string;
  redirectUri: string;
  scopes: readonly string[];
  pkceRequired: boolean;
};

export function createExternalProviderOAuthAuthorizationUrlBuilder(
  configs: readonly ExternalProviderOAuthAuthorizationConfig[]
): {
  buildAuthorizationUrl(
    request: ExternalProviderOAuthAuthorizationRequest
  ): Promise<ExternalProviderOAuthAuthorizationResult>;
} {
  const byProvider = new Map(
    configs.map((config) => [config.provider, validateConfig(config)])
  );

  return {
    async buildAuthorizationUrl(request) {
      const config = byProvider.get(request.provider);
      if (!config) {
        throw new CloudApiError(
          "INVALID_INPUT",
          "External provider OAuth authorization is not configured."
        );
      }
      const state = nonEmpty(request.state, "state");
      const redirectUri = absoluteUrl(
        request.redirectUri ?? config.redirectUri,
        "redirectUri"
      );
      const scopes = normalizedScopes(request.scopes ?? config.scopes);
      const pkce = request.pkce;
      if (config.pkceRequired === true && pkce === undefined) {
        throw new CloudApiError(
          "INVALID_INPUT",
          "codeChallenge is required for this provider."
        );
      }
      const url = new URL(config.authorizationEndpoint);

      url.searchParams.set("client_id", config.clientId);
      url.searchParams.set("redirect_uri", redirectUri);
      url.searchParams.set("response_type", "code");
      url.searchParams.set(
        "scope",
        scopes.join(scopeSeparator(config.provider))
      );
      url.searchParams.set("state", state);
      url.searchParams.set("access_type", "offline");
      if (config.provider === "google") {
        url.searchParams.set("prompt", "consent");
      }
      if (pkce !== undefined) {
        url.searchParams.set(
          "code_challenge",
          nonEmpty(pkce.codeChallenge, "codeChallenge")
        );
        url.searchParams.set("code_challenge_method", pkce.method);
      }

      return {
        provider: request.provider,
        authorizationUrl: url.toString(),
        state,
        redirectUri,
        scopes,
        pkceRequired: config.pkceRequired === true
      };
    }
  };
}

function validateConfig(
  config: ExternalProviderOAuthAuthorizationConfig
): ExternalProviderOAuthAuthorizationConfig {
  return {
    provider: provider(config.provider),
    authorizationEndpoint: absoluteUrl(
      config.authorizationEndpoint,
      "authorizationEndpoint"
    ),
    clientId: nonEmpty(config.clientId, "clientId"),
    redirectUri: absoluteUrl(config.redirectUri, "redirectUri"),
    scopes: normalizedScopes(config.scopes),
    ...(config.pkceRequired === undefined
      ? {}
      : { pkceRequired: config.pkceRequired })
  };
}

function provider(value: string): ExternalObservationProvider {
  if (value === "google" || value === "yandex") {
    return value;
  }
  throw new CloudApiError("INVALID_INPUT", "provider is not supported.");
}

function nonEmpty(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new CloudApiError(
      "INVALID_INPUT",
      `${field} must be a non-empty string.`
    );
  }
  return value;
}

function absoluteUrl(value: string, field: string): string {
  const candidate = nonEmpty(value, field);
  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:") {
      throw new Error("not https");
    }
    return url.toString();
  } catch {
    throw new CloudApiError("INVALID_INPUT", `${field} must be an https URL.`);
  }
}

function normalizedScopes(scopes: readonly string[]): readonly string[] {
  const normalized = scopes.map((scope) => nonEmpty(scope, "scopes"));
  if (normalized.length === 0) {
    throw new CloudApiError(
      "INVALID_INPUT",
      "scopes must include at least one scope."
    );
  }
  return [...new Set(normalized)].sort();
}

function scopeSeparator(provider: ExternalObservationProvider): string {
  return provider === "google" ? " " : " ";
}
