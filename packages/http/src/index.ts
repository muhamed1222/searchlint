import type { HttpSnapshot } from "@searchlint/core";

export type HeaderInput =
  | HeadersLike
  | Readonly<Record<string, string | readonly string[] | undefined>>
  | readonly (readonly [string, string])[];

export type HeadersLike = {
  forEach(callback: (value: string, key: string) => void): void;
};

export type HttpObservationInput = {
  finalUrl: string;
  statusCode?: number;
  headers?: HeaderInput;
  redirectChain?: readonly string[];
  responseTimingMs?: number;
  fetchedAt?: string;
};

export type NormalizedHttpObservation = {
  http: HttpSnapshot & {
    responseTimingMs?: number;
    fetchedAt?: string;
    contentType?: string;
  };
};

export function createHttpSnapshotFragment(
  input: HttpObservationInput
): NormalizedHttpObservation {
  const headers = normalizeHeaders(input.headers);
  const http: NormalizedHttpObservation["http"] = {
    finalUrl: input.finalUrl,
    headers,
    redirectChain: normalizeRedirectChain(input.redirectChain)
  };

  if (input.statusCode !== undefined) {
    http.statusCode = input.statusCode;
  }

  if (input.responseTimingMs !== undefined) {
    http.responseTimingMs = input.responseTimingMs;
  }

  if (input.fetchedAt !== undefined) {
    http.fetchedAt = input.fetchedAt;
  }

  const contentType = headers["content-type"];
  if (contentType !== undefined) {
    http.contentType = contentType;
  }

  return { http };
}

export function normalizeHeaders(
  headers: HeaderInput | undefined
): Readonly<Record<string, string>> {
  if (!headers) {
    return {};
  }

  const normalized: Record<string, string> = {};

  if (Array.isArray(headers)) {
    for (const [name, value] of headers) {
      setHeader(normalized, name, value);
    }

    return normalized;
  }

  if (isHeadersLike(headers)) {
    headers.forEach((value, key) => {
      setHeader(normalized, key, value);
    });

    return normalized;
  }

  for (const [name, value] of Object.entries(headers)) {
    if (value === undefined) {
      continue;
    }

    setHeader(
      normalized,
      name,
      typeof value === "string" ? value : value.join(", ")
    );
  }

  return normalized;
}

export function normalizeRedirectChain(
  redirectChain: readonly string[] | undefined
): readonly string[] {
  if (!redirectChain) {
    return [];
  }

  return redirectChain.map((url) => url.trim()).filter(Boolean);
}

function setHeader(
  target: Record<string, string>,
  name: string,
  value: string
): void {
  const normalizedName = name.toLowerCase().trim();
  if (!normalizedName) {
    return;
  }

  target[normalizedName] = value.trim();
}

function isHeadersLike(value: object): value is HeadersLike {
  return "forEach" in value && typeof value.forEach === "function";
}
