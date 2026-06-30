import { describe, expect, it } from "vitest";

import {
  ExternalObservationOAuthRefreshError,
  createGoogleOAuthTokenRefresher,
  createYandexOAuthTokenRefresher
} from "../src/index.js";
import type {
  ExternalObservationOAuthRefreshFetch,
  ExternalObservationOAuthRefreshFetchResponse
} from "../src/index.js";
import type { OAuthConnectionRecord } from "@searchlint/api";

describe("OAuth token refresh adapters", () => {
  it("posts Google refresh-token grants and maps refreshed token metadata", async () => {
    const calls: RefreshFetchCall[] = [];
    const refresher = createGoogleOAuthTokenRefresher({
      clientId: "google-client",
      clientSecret: "google-secret",
      fetch: recordingFetch(calls, {
        ok: true,
        status: 200,
        payload: {
          access_token: "google-access-token",
          refresh_token: "google-refresh-token",
          expires_in: 3600
        }
      })
    });

    await expect(
      refresher.refreshAccessToken({
        connection: connection({ provider: "google" }),
        refreshToken: "old-refresh-token",
        now: "2026-06-21T00:00:00.000Z"
      })
    ).resolves.toEqual({
      accessToken: "google-access-token",
      refreshToken: "google-refresh-token",
      expiresAt: "2026-06-21T01:00:00.000Z"
    });

    expect(calls).toEqual([
      {
        url: "https://oauth2.googleapis.com/token",
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/x-www-form-urlencoded"
        },
        body: "grant_type=refresh_token&refresh_token=old-refresh-token&client_id=google-client&client_secret=google-secret"
      }
    ]);
  });

  it("surfaces Yandex refresh failures with status and response payload", async () => {
    const refresher = createYandexOAuthTokenRefresher({
      clientId: "yandex-client",
      clientSecret: "yandex-secret",
      tokenEndpoint: "https://oauth.yandex.test/token",
      fetch: recordingFetch([], {
        ok: false,
        status: 401,
        payload: {
          error: "invalid_grant"
        }
      })
    });

    await expect(
      refresher.refreshAccessToken({
        connection: connection({ provider: "yandex" }),
        refreshToken: "old-refresh-token",
        now: "2026-06-21T00:00:00.000Z"
      })
    ).rejects.toMatchObject({
      name: "ExternalObservationOAuthRefreshError",
      provider: "yandex",
      status: 401,
      payload: {
        error: "invalid_grant"
      }
    } satisfies Partial<ExternalObservationOAuthRefreshError>);
  });

  it("rejects malformed refresh responses deterministically", async () => {
    await expectRefreshPayload({}).rejects.toThrow(
      "OAuth refresh response access_token must be a non-empty string."
    );
    await expectRefreshPayload({
      access_token: "access-token",
      expires_in: -1
    }).rejects.toThrow("OAuth refresh response expires_in must be positive.");
    await expect(
      createGoogleOAuthTokenRefresher({
        clientId: "client",
        clientSecret: "secret",
        fetch: recordingFetch([], {
          ok: true,
          status: 200,
          payload: {
            access_token: "access-token",
            expires_in: 60
          }
        })
      }).refreshAccessToken({
        connection: connection({ provider: "google" }),
        refreshToken: "refresh-token",
        now: "not-a-date"
      })
    ).rejects.toThrow("OAuth refresh timestamp must be a valid ISO date.");
  });
});

function expectRefreshPayload(payload: unknown) {
  const refresher = createGoogleOAuthTokenRefresher({
    clientId: "client",
    clientSecret: "secret",
    fetch: recordingFetch([], {
      ok: true,
      status: 200,
      payload
    })
  });
  return expect(
    refresher.refreshAccessToken({
      connection: connection({ provider: "google" }),
      refreshToken: "refresh-token",
      now: "2026-06-21T00:00:00.000Z"
    })
  );
}

type RefreshFetchCall = {
  url: string;
  method: string;
  headers: Readonly<Record<string, string>>;
  body: string;
};

function recordingFetch(
  calls: RefreshFetchCall[],
  response: {
    ok: boolean;
    status: number;
    payload: unknown;
  }
): ExternalObservationOAuthRefreshFetch {
  return async (
    url,
    init
  ): Promise<ExternalObservationOAuthRefreshFetchResponse> => {
    calls.push({
      url,
      method: init.method,
      headers: init.headers,
      body: init.body
    });
    return {
      ok: response.ok,
      status: response.status,
      async json() {
        return response.payload;
      }
    };
  };
}

function connection(
  overrides: Partial<OAuthConnectionRecord> = {}
): OAuthConnectionRecord {
  return {
    id: "connection-1",
    organizationId: "org-1",
    projectId: "project-1",
    environmentId: "env-1",
    provider: "google",
    providerAccountId: "sc-domain:example.test",
    scopes: ["scope-1"],
    accessTokenSecretRef: "secret://org-1/google/access-token",
    refreshTokenSecretRef: "secret://org-1/google/refresh-token",
    expiresAt: "2026-06-21T00:00:00.000Z",
    status: "active",
    deletionState: "active",
    createdAt: "2026-06-20T00:00:00.000Z",
    ...overrides
  };
}
