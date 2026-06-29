import { createSign, generateKeyPairSync } from "node:crypto";
import type { IncomingMessage } from "node:http";

import { describe, expect, it } from "vitest";

import {
  createCognitoPrincipalExtractor,
  createRemoteJwksProvider,
  verifyCognitoJwt
} from "../src/index.js";
import type {
  CognitoJwksFetch,
  CognitoJsonWebKeySet,
  CognitoJwtPayload,
  CognitoJwtVerifierOptions
} from "../src/index.js";

const issuer =
  "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_searchlint";
const audience = "searchlint-cloud-api";
const now = new Date("2026-06-21T12:00:00.000Z");
const nowSeconds = Math.floor(now.getTime() / 1000);

const keyPair = generateKeyPairSync("rsa", {
  modulusLength: 2048
});
const publicJwk = keyPair.publicKey.export({ format: "jwk" });
const jwks: CognitoJsonWebKeySet = {
  keys: [
    {
      ...publicJwk,
      kid: "searchlint-key-1",
      alg: "RS256",
      use: "sig"
    }
  ]
};

const verifierOptions: CognitoJwtVerifierOptions = {
  issuer,
  audience,
  tokenUse: "access",
  jwks() {
    return jwks;
  },
  clock() {
    return now;
  }
};

describe("verifyCognitoJwt", () => {
  it("resolves valid Cognito access tokens to SearchLint principals", async () => {
    const token = signToken({
      sub: "user-123",
      email: "developer@example.com"
    });

    const verified = await verifyCognitoJwt(token, verifierOptions);

    expect(verified?.principal).toEqual({
      id: "user-123",
      externalSubject: `${issuer}|user-123`,
      email: "developer@example.com"
    });
    expect(verified?.payload.token_use).toBe("access");
  });

  it("accepts client_id as the audience claim for access tokens", async () => {
    const token = signToken(
      {
        sub: "user-123",
        client_id: audience
      },
      { omitAudience: true }
    );

    await expect(verifyCognitoJwt(token, verifierOptions)).resolves.toEqual(
      expect.objectContaining({
        principal: expect.objectContaining({
          id: "user-123"
        })
      })
    );
  });

  it("rejects invalid Cognito tokens without producing a principal", async () => {
    const cases = [
      signToken({ sub: "user-123" }, { issuer: `${issuer}/wrong` }),
      signToken({ sub: "user-123", aud: "other-client" }),
      signToken({ sub: "user-123", token_use: "id" }),
      signToken({ sub: "" }),
      signToken({ sub: "user-123", exp: nowSeconds - 1 }),
      signToken({ sub: "user-123", nbf: nowSeconds + 60 }),
      signToken({ sub: "user-123" }, { kid: "missing-key" }),
      invalidSignature(signToken({ sub: "user-123" })),
      signToken({ sub: "user-123" }, { alg: "none" })
    ];

    for (const token of cases) {
      await expect(
        verifyCognitoJwt(token, verifierOptions)
      ).resolves.toBeUndefined();
    }
  });
});

describe("createCognitoPrincipalExtractor", () => {
  it("extracts bearer token principals from Node HTTP requests", async () => {
    const token = signToken({
      sub: "user-123"
    });
    const extractor = createCognitoPrincipalExtractor(verifierOptions);

    await expect(
      extractor(requestWithAuthorization(`Bearer ${token}`))
    ).resolves.toMatchObject({
      id: "user-123",
      externalSubject: `${issuer}|user-123`
    });
  });

  it("returns no principal for missing or invalid bearer credentials", async () => {
    const extractor = createCognitoPrincipalExtractor(verifierOptions);

    await expect(
      extractor(requestWithAuthorization(undefined))
    ).resolves.toBeUndefined();
    await expect(
      extractor(requestWithAuthorization("Basic abc"))
    ).resolves.toBeUndefined();
    await expect(
      extractor(requestWithAuthorization("Bearer invalid"))
    ).resolves.toBeUndefined();
  });
});

describe("createRemoteJwksProvider", () => {
  it("rejects non-HTTPS JWKS URLs", () => {
    expect(() =>
      createRemoteJwksProvider({
        jwksUrl: "http://example.com/.well-known/jwks.json"
      })
    ).toThrow("JWKS URL must use https.");
  });

  it("fetches, validates, and caches JWKS until TTL expiry", async () => {
    let currentMs = now.getTime();
    const fetches: string[] = [];
    const provider = createRemoteJwksProvider({
      jwksUrl: "https://example.com/.well-known/jwks.json",
      ttlMs: 100,
      clock() {
        return new Date(currentMs);
      },
      fetch: async (url) => {
        fetches.push(url);
        return jwksResponse(jwks);
      }
    });

    await expect(provider()).resolves.toEqual(jwks);
    await expect(provider()).resolves.toEqual(jwks);
    currentMs += 101;
    await expect(provider()).resolves.toEqual(jwks);

    expect(fetches).toEqual([
      "https://example.com/.well-known/jwks.json",
      "https://example.com/.well-known/jwks.json"
    ]);
  });

  it("shares concurrent cache-miss fetches", async () => {
    const deferred = createDeferred<CognitoJsonWebKeySet>();
    let fetchCount = 0;
    const provider = createRemoteJwksProvider({
      jwksUrl: "https://example.com/.well-known/jwks.json",
      fetch: async () => {
        fetchCount += 1;
        return jwksResponse(await deferred.promise);
      }
    });

    const first = provider();
    const second = provider();
    deferred.resolve(jwks);

    await expect(first).resolves.toEqual(jwks);
    await expect(second).resolves.toEqual(jwks);
    expect(fetchCount).toBe(1);
  });

  it("times out remote JWKS fetches deterministically", async () => {
    const provider = createRemoteJwksProvider({
      jwksUrl: "https://example.com/.well-known/jwks.json",
      timeoutMs: 1,
      fetch: (_url, init) =>
        new Promise((resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new Error("aborted"));
          });
          setTimeout(() => {
            resolve(jwksResponse(jwks));
          }, 25);
        })
    });

    await expect(provider()).rejects.toThrow("aborted");
  });

  it("rejects invalid initial JWKS responses without populating the cache", async () => {
    let calls = 0;
    const provider = createRemoteJwksProvider({
      jwksUrl: "https://example.com/.well-known/jwks.json",
      fetch: async () => {
        calls += 1;
        return {
          ok: true,
          status: 200,
          async json() {
            return calls === 1 ? { keys: [{ kty: "RSA" }] } : jwks;
          }
        };
      }
    });

    await expect(provider()).rejects.toThrow(
      "JWKS RSA keys must include kty, kid, n, and e."
    );
    await expect(provider()).resolves.toEqual(jwks);
    expect(calls).toBe(2);
  });

  it("falls back to the last cached JWKS when refresh fails", async () => {
    let currentMs = now.getTime();
    let calls = 0;
    const provider = createRemoteJwksProvider({
      jwksUrl: "https://example.com/.well-known/jwks.json",
      ttlMs: 100,
      clock() {
        return new Date(currentMs);
      },
      fetch: async () => {
        calls += 1;
        if (calls > 1) {
          throw new Error("network unavailable");
        }
        return jwksResponse(jwks);
      }
    });

    await expect(provider()).resolves.toEqual(jwks);
    currentMs += 101;
    await expect(provider()).resolves.toEqual(jwks);
    expect(calls).toBe(2);
  });

  it("can be wired into Cognito JWT verification", async () => {
    const provider = createRemoteJwksProvider({
      jwksUrl: "https://example.com/.well-known/jwks.json",
      fetch: async () => jwksResponse(jwks)
    });
    const token = signToken({
      sub: "user-123"
    });

    await expect(
      verifyCognitoJwt(token, {
        ...verifierOptions,
        jwks: provider
      })
    ).resolves.toEqual(
      expect.objectContaining({
        principal: expect.objectContaining({
          id: "user-123"
        })
      })
    );
  });
});

function signToken(
  overrides: Partial<CognitoJwtPayload>,
  headerOverrides: {
    kid?: string;
    alg?: string;
    issuer?: string;
    omitAudience?: boolean;
  } = {}
): string {
  const header = {
    alg: headerOverrides.alg ?? "RS256",
    kid: headerOverrides.kid ?? "searchlint-key-1",
    typ: "JWT"
  };
  const payload: CognitoJwtPayload = {
    iss: headerOverrides.issuer ?? issuer,
    sub: "user-123",
    token_use: "access",
    exp: nowSeconds + 300,
    nbf: nowSeconds - 30,
    iat: nowSeconds,
    ...(headerOverrides.omitAudience ? {} : { aud: audience }),
    ...overrides
  };
  const signingInput = `${base64UrlJson(header)}.${base64UrlJson(payload)}`;
  const signature = createSign("RSA-SHA256")
    .update(signingInput)
    .end()
    .sign(keyPair.privateKey)
    .toString("base64url");

  return `${signingInput}.${signature}`;
}

function base64UrlJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function invalidSignature(token: string): string {
  const [header, payload] = token.split(".");
  return `${header}.${payload}.${Buffer.from("invalid").toString("base64url")}`;
}

function requestWithAuthorization(
  authorization: string | undefined
): IncomingMessage {
  return {
    headers: {
      authorization
    }
  } as IncomingMessage;
}

function jwksResponse(
  body: CognitoJsonWebKeySet
): Awaited<ReturnType<CognitoJwksFetch>> {
  return {
    ok: true,
    status: 200,
    async json() {
      return body;
    }
  };
}

function createDeferred<T>(): {
  promise: Promise<T>;
  resolve(value: T): void;
} {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return {
    promise,
    resolve
  };
}
