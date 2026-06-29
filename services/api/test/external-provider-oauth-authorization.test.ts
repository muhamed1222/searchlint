import { describe, expect, it } from "vitest";

import {
  CloudApiError,
  createExternalProviderOAuthAuthorizationUrlBuilder
} from "../src/index.js";

describe("createExternalProviderOAuthAuthorizationUrlBuilder", () => {
  it("builds deterministic Google authorization URLs with scopes, state, and PKCE", async () => {
    const builder = createExternalProviderOAuthAuthorizationUrlBuilder([
      {
        provider: "google",
        authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
        clientId: "google-client-id",
        redirectUri: "https://app.searchlint.example/oauth/google/callback",
        scopes: [
          "https://www.googleapis.com/auth/webmasters.readonly",
          "openid"
        ],
        pkceRequired: true
      }
    ]);

    const result = await builder.buildAuthorizationUrl({
      organizationId: "org-1",
      projectId: "project-1",
      environmentId: "env-1",
      provider: "google",
      state: "state-123",
      pkce: {
        codeChallenge: "pkce-challenge",
        method: "S256"
      }
    });
    const url = new URL(result.authorizationUrl);

    expect(url.origin + url.pathname).toBe(
      "https://accounts.google.com/o/oauth2/v2/auth"
    );
    expect(Object.fromEntries(url.searchParams.entries())).toEqual({
      access_type: "offline",
      client_id: "google-client-id",
      code_challenge: "pkce-challenge",
      code_challenge_method: "S256",
      prompt: "consent",
      redirect_uri: "https://app.searchlint.example/oauth/google/callback",
      response_type: "code",
      scope: "https://www.googleapis.com/auth/webmasters.readonly openid",
      state: "state-123"
    });
    expect(result).toMatchObject({
      provider: "google",
      state: "state-123",
      redirectUri: "https://app.searchlint.example/oauth/google/callback",
      scopes: ["https://www.googleapis.com/auth/webmasters.readonly", "openid"],
      pkceRequired: true
    });
  });

  it("builds deterministic Yandex authorization URLs without Google prompt", async () => {
    const builder = createExternalProviderOAuthAuthorizationUrlBuilder([
      {
        provider: "yandex",
        authorizationEndpoint: "https://oauth.yandex.com/authorize",
        clientId: "yandex-client-id",
        redirectUri: "https://app.searchlint.example/oauth/yandex/callback",
        scopes: ["webmaster:read", "metrika:read"]
      }
    ]);

    const result = await builder.buildAuthorizationUrl({
      organizationId: "org-1",
      projectId: "project-1",
      environmentId: "env-1",
      provider: "yandex",
      state: "state-123",
      redirectUri: "https://custom.example/yandex/callback",
      scopes: ["metrika:read"]
    });
    const url = new URL(result.authorizationUrl);

    expect(url.origin + url.pathname).toBe(
      "https://oauth.yandex.com/authorize"
    );
    expect(Object.fromEntries(url.searchParams.entries())).toEqual({
      access_type: "offline",
      client_id: "yandex-client-id",
      redirect_uri: "https://custom.example/yandex/callback",
      response_type: "code",
      scope: "metrika:read",
      state: "state-123"
    });
    expect(result.pkceRequired).toBe(false);
  });

  it("rejects missing PKCE challenges when the provider requires PKCE", async () => {
    const builder = createExternalProviderOAuthAuthorizationUrlBuilder([
      {
        provider: "google",
        authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
        clientId: "google-client-id",
        redirectUri: "https://app.searchlint.example/oauth/google/callback",
        scopes: ["openid"],
        pkceRequired: true
      }
    ]);

    await expect(
      builder.buildAuthorizationUrl({
        organizationId: "org-1",
        projectId: "project-1",
        environmentId: "env-1",
        provider: "google",
        state: "state-123"
      })
    ).rejects.toEqual(
      new CloudApiError(
        "INVALID_INPUT",
        "codeChallenge is required for this provider."
      )
    );
  });
});
