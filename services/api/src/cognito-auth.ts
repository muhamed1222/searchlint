import { createPublicKey, createVerify } from "node:crypto";
import type { IncomingMessage } from "node:http";

import type { NodeHttpPrincipalExtractor } from "./node-http-server.js";
import type { Principal } from "./types.js";

export type CognitoJwtHeader = {
  alg?: string;
  kid?: string;
  typ?: string;
};

export type CognitoJwtPayload = {
  iss?: string;
  sub?: string;
  aud?: string | readonly string[];
  client_id?: string;
  token_use?: string;
  email?: string;
  exp?: number;
  nbf?: number;
  iat?: number;
};

export type CognitoJsonWebKey = {
  kty?: string;
  n?: string;
  e?: string;
  kid?: string;
  alg?: string;
  use?: string;
};

export type CognitoJsonWebKeySet = {
  keys: readonly CognitoJsonWebKey[];
};

export type CognitoJwksProvider = () =>
  | CognitoJsonWebKeySet
  | Promise<CognitoJsonWebKeySet>;

export type CognitoJwksFetchResponse = {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
};

export type CognitoJwksFetch = (
  url: string,
  init?: { signal?: AbortSignal }
) => Promise<CognitoJwksFetchResponse>;

export type RemoteJwksProviderOptions = {
  jwksUrl: string;
  fetch?: CognitoJwksFetch;
  clock?: () => Date;
  ttlMs?: number;
  timeoutMs?: number;
};

export type CognitoJwtVerifierOptions = {
  issuer: string;
  audience: string | readonly string[];
  tokenUse: "access" | "id";
  jwks: CognitoJwksProvider;
  clock?: () => Date;
  clockToleranceSeconds?: number;
};

export type CognitoPrincipalExtractorOptions = CognitoJwtVerifierOptions;

export type CognitoVerifiedToken = {
  header: CognitoJwtHeader;
  payload: CognitoJwtPayload;
  principal: Principal;
};

export async function verifyCognitoJwt(
  token: string,
  options: CognitoJwtVerifierOptions
): Promise<CognitoVerifiedToken | undefined> {
  const parsed = parseJwt(token);
  if (!parsed || parsed.header.alg !== "RS256" || !parsed.header.kid) {
    return undefined;
  }

  const key = await jwkForKid(options.jwks, parsed.header.kid);
  if (!key) {
    return undefined;
  }

  if (!verifySignature(token, key)) {
    return undefined;
  }

  if (!validClaims(parsed.payload, options)) {
    return undefined;
  }

  return {
    header: parsed.header,
    payload: parsed.payload,
    principal: {
      id: parsed.payload.sub,
      externalSubject: `${parsed.payload.iss}|${parsed.payload.sub}`,
      ...(typeof parsed.payload.email === "string"
        ? { email: parsed.payload.email }
        : {})
    }
  };
}

export function createCognitoPrincipalExtractor(
  options: CognitoPrincipalExtractorOptions
): NodeHttpPrincipalExtractor {
  return async (request: IncomingMessage): Promise<Principal | undefined> => {
    const token = bearerToken(request.headers.authorization);
    if (!token) {
      return undefined;
    }

    return (await verifyCognitoJwt(token, options))?.principal;
  };
}

export function createRemoteJwksProvider(
  options: RemoteJwksProviderOptions
): CognitoJwksProvider {
  const jwksUrl = validateJwksUrl(options.jwksUrl);
  const fetchJwks = options.fetch ?? globalFetch;
  const clock = options.clock ?? (() => new Date());
  const ttlMs = options.ttlMs ?? 5 * 60 * 1000;
  const timeoutMs = options.timeoutMs ?? 2000;
  if (!Number.isInteger(ttlMs) || ttlMs < 1) {
    throw new Error("JWKS cache TTL must be a positive integer.");
  }
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1) {
    throw new Error("JWKS fetch timeout must be a positive integer.");
  }

  let cached:
    | {
        jwks: CognitoJsonWebKeySet;
        expiresAtMs: number;
      }
    | undefined;
  let inFlight: Promise<CognitoJsonWebKeySet> | undefined;

  return async (): Promise<CognitoJsonWebKeySet> => {
    const nowMs = clock().getTime();
    if (cached && cached.expiresAtMs > nowMs) {
      return cached.jwks;
    }

    if (!inFlight) {
      inFlight = fetchRemoteJwks(jwksUrl, fetchJwks, timeoutMs)
        .then((jwks) => {
          cached = {
            jwks,
            expiresAtMs: clock().getTime() + ttlMs
          };
          return jwks;
        })
        .catch((error: unknown) => {
          if (cached) {
            return cached.jwks;
          }
          throw error;
        })
        .finally(() => {
          inFlight = undefined;
        });
    }

    return inFlight;
  };
}

function parseJwt(
  token: string
): { header: CognitoJwtHeader; payload: CognitoJwtPayload } | undefined {
  const parts = token.split(".");
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
    return undefined;
  }

  const header = parseBase64UrlJson<CognitoJwtHeader>(parts[0]);
  const payload = parseBase64UrlJson<CognitoJwtPayload>(parts[1]);
  if (!header || !payload) {
    return undefined;
  }

  return { header, payload };
}

async function jwkForKid(
  provider: CognitoJwksProvider,
  kid: string
): Promise<CognitoJsonWebKey | undefined> {
  const jwks = await provider();
  return jwks.keys.find((key) => key.kid === kid && key.kty === "RSA");
}

function verifySignature(token: string, key: CognitoJsonWebKey): boolean {
  const [encodedHeader, encodedPayload, encodedSignature] = token.split(".");
  if (!encodedHeader || !encodedPayload || !encodedSignature) {
    return false;
  }

  try {
    const verifier = createVerify("RSA-SHA256");
    verifier.update(`${encodedHeader}.${encodedPayload}`);
    verifier.end();
    return verifier.verify(
      createPublicKey({ key, format: "jwk" }),
      base64UrlToBuffer(encodedSignature)
    );
  } catch {
    return false;
  }
}

function validClaims(
  payload: CognitoJwtPayload,
  options: CognitoJwtVerifierOptions
): payload is CognitoJwtPayload & { iss: string; sub: string } {
  if (payload.iss !== options.issuer) {
    return false;
  }
  if (typeof payload.sub !== "string" || payload.sub.length === 0) {
    return false;
  }
  if (payload.token_use !== options.tokenUse) {
    return false;
  }
  if (!validAudience(payload, options.audience)) {
    return false;
  }

  const now = Math.floor((options.clock?.() ?? new Date()).getTime() / 1000);
  const tolerance = options.clockToleranceSeconds ?? 0;
  if (typeof payload.exp !== "number" || payload.exp + tolerance < now) {
    return false;
  }
  if (typeof payload.nbf === "number" && payload.nbf - tolerance > now) {
    return false;
  }

  return true;
}

function validAudience(
  payload: CognitoJwtPayload,
  expected: string | readonly string[]
): boolean {
  const accepted = new Set(Array.isArray(expected) ? expected : [expected]);
  const tokenAudiences = [
    ...(Array.isArray(payload.aud)
      ? payload.aud
      : typeof payload.aud === "string"
        ? [payload.aud]
        : []),
    ...(typeof payload.client_id === "string" ? [payload.client_id] : [])
  ];

  return tokenAudiences.some((audience) => accepted.has(audience));
}

function bearerToken(value: string | string[] | undefined): string | undefined {
  const header = Array.isArray(value) ? value[0] : value;
  if (!header) {
    return undefined;
  }

  const match = /^Bearer\s+(.+)$/iu.exec(header.trim());
  return match?.[1];
}

function parseBase64UrlJson<T>(value: string): T | undefined {
  try {
    return JSON.parse(base64UrlToBuffer(value).toString("utf8")) as T;
  } catch {
    return undefined;
  }
}

function base64UrlToBuffer(value: string): Buffer {
  return Buffer.from(value, "base64url");
}

async function fetchRemoteJwks(
  jwksUrl: string,
  fetchJwks: CognitoJwksFetch,
  timeoutMs: number
): Promise<CognitoJsonWebKeySet> {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetchJwks(jwksUrl, {
      signal: controller.signal
    });
    if (!response.ok) {
      throw new Error(`JWKS fetch failed with status ${response.status}.`);
    }
    return parseJwksResponse(await response.json());
  } finally {
    clearTimeout(timeout);
  }
}

function parseJwksResponse(value: unknown): CognitoJsonWebKeySet {
  if (!isRecord(value) || !Array.isArray(value.keys)) {
    throw new Error("JWKS response must include a keys array.");
  }

  const keys = value.keys.map((key) => {
    if (!isRecord(key)) {
      throw new Error("JWKS key must be an object.");
    }
    const jwk: CognitoJsonWebKey = {};
    if (typeof key.kty === "string") {
      jwk.kty = key.kty;
    }
    if (typeof key.n === "string") {
      jwk.n = key.n;
    }
    if (typeof key.e === "string") {
      jwk.e = key.e;
    }
    if (typeof key.kid === "string") {
      jwk.kid = key.kid;
    }
    if (typeof key.alg === "string") {
      jwk.alg = key.alg;
    }
    if (typeof key.use === "string") {
      jwk.use = key.use;
    }
    if (jwk.kty !== "RSA" || !jwk.kid || !jwk.n || !jwk.e) {
      throw new Error("JWKS RSA keys must include kty, kid, n, and e.");
    }
    return jwk;
  });

  return { keys };
}

function validateJwksUrl(value: string): string {
  const parsed = new URL(value);
  if (parsed.protocol !== "https:") {
    throw new Error("JWKS URL must use https.");
  }
  return parsed.toString();
}

async function globalFetch(
  url: string,
  init?: { signal?: AbortSignal }
): Promise<CognitoJwksFetchResponse> {
  return fetch(url, init);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
