export type GoogleProviderRetryReason =
  | "quota-exhausted"
  | "rate-limited"
  | "server-error"
  | "temporarily-unavailable"
  | "deadline-exceeded";

export type GoogleProviderRetryPolicy = {
  baseDelayMs: number;
  maxDelayMs: number;
  multiplier: number;
};

export type GoogleProviderRetryDecisionInput = {
  status: number;
  payload?: unknown;
  retryAfter?: string | null | undefined;
  attempt: number;
  fetchedAt: string;
  policy?: Partial<GoogleProviderRetryPolicy>;
};

export type GoogleProviderRetryDecision = {
  retryable: boolean;
  reason?: GoogleProviderRetryReason;
  attempt: number;
  delayMs: number;
  nextAttemptAt?: string;
  source: "retry-after" | "exponential-backoff" | "not-retryable";
};

export const defaultGoogleProviderRetryPolicy: GoogleProviderRetryPolicy = {
  baseDelayMs: 1_000,
  maxDelayMs: 60_000,
  multiplier: 2
};

export function googleProviderRetryDecision(
  input: GoogleProviderRetryDecisionInput
): GoogleProviderRetryDecision {
  const reason = googleProviderRetryReason(input.status, input.payload);
  if (reason === undefined) {
    return {
      retryable: false,
      attempt: input.attempt,
      delayMs: 0,
      source: "not-retryable"
    };
  }

  const policy = googleProviderRetryPolicy(input.policy);
  const retryAfterMs = retryAfterDelayMs(input.retryAfter, input.fetchedAt);
  const source =
    retryAfterMs === undefined ? "exponential-backoff" : "retry-after";
  const rawDelayMs =
    retryAfterMs ??
    policy.baseDelayMs *
      Math.pow(policy.multiplier, Math.max(0, input.attempt - 1));
  const delayMs = Math.min(policy.maxDelayMs, Math.max(0, rawDelayMs));
  const nextAttemptAt = new Date(
    Date.parse(input.fetchedAt) + delayMs
  ).toISOString();

  return {
    retryable: true,
    reason,
    attempt: input.attempt,
    delayMs,
    nextAttemptAt,
    source
  };
}

export function googleProviderRetryReason(
  status: number,
  payload?: unknown
): GoogleProviderRetryReason | undefined {
  const googleStatus = googleErrorStatus(payload);
  if (status === 429) {
    return googleStatus === "RESOURCE_EXHAUSTED"
      ? "quota-exhausted"
      : "rate-limited";
  }
  if (status === 503 || googleStatus === "UNAVAILABLE") {
    return "temporarily-unavailable";
  }
  if (status === 504 || googleStatus === "DEADLINE_EXCEEDED") {
    return "deadline-exceeded";
  }
  if (status >= 500 && status <= 599) {
    return "server-error";
  }
  return undefined;
}

export function googleProviderRetryPolicy(
  policy: Partial<GoogleProviderRetryPolicy> = {}
): GoogleProviderRetryPolicy {
  const merged = {
    ...defaultGoogleProviderRetryPolicy,
    ...policy
  };
  if (merged.baseDelayMs <= 0) {
    throw new Error("Google provider retry baseDelayMs must be positive.");
  }
  if (merged.maxDelayMs <= 0) {
    throw new Error("Google provider retry maxDelayMs must be positive.");
  }
  if (merged.multiplier < 1) {
    throw new Error("Google provider retry multiplier must be at least 1.");
  }
  return merged;
}

function retryAfterDelayMs(
  retryAfter: string | null | undefined,
  fetchedAt: string
): number | undefined {
  if (retryAfter === undefined || retryAfter === null || retryAfter === "") {
    return undefined;
  }
  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds)) {
    return Math.max(0, Math.round(seconds * 1_000));
  }
  const retryAt = Date.parse(retryAfter);
  const fetchedAtMs = Date.parse(fetchedAt);
  if (!Number.isFinite(retryAt) || !Number.isFinite(fetchedAtMs)) {
    return undefined;
  }
  return Math.max(0, retryAt - fetchedAtMs);
}

function googleErrorStatus(payload: unknown): string | undefined {
  const error = plainObject(payload).error;
  const status = plainObject(error).status;
  return typeof status === "string" ? status : undefined;
}

function plainObject(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}
