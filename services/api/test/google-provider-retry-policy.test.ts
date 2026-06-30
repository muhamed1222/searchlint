import { describe, expect, it } from "vitest";

import {
  defaultGoogleProviderRetryPolicy,
  googleProviderRetryDecision,
  googleProviderRetryPolicy,
  googleProviderRetryReason
} from "../src/index.js";

describe("googleProviderRetryDecision", () => {
  it("classifies Google quota and rate-limit failures as retryable", () => {
    expect(
      googleProviderRetryReason(429, {
        error: { status: "RESOURCE_EXHAUSTED" }
      })
    ).toBe("quota-exhausted");
    expect(googleProviderRetryReason(429, { error: {} })).toBe("rate-limited");
  });

  it("classifies transient Google server failures as retryable", () => {
    expect(
      googleProviderRetryReason(503, { error: { status: "UNAVAILABLE" } })
    ).toBe("temporarily-unavailable");
    expect(
      googleProviderRetryReason(504, {
        error: { status: "DEADLINE_EXCEEDED" }
      })
    ).toBe("deadline-exceeded");
    expect(googleProviderRetryReason(500)).toBe("server-error");
  });

  it("does not retry Google auth, permission, or missing-property errors", () => {
    for (const status of [400, 401, 403, 404]) {
      expect(googleProviderRetryReason(status)).toBeUndefined();
      expect(
        googleProviderRetryDecision({
          status,
          attempt: 1,
          fetchedAt: "2026-06-23T00:00:00.000Z"
        })
      ).toEqual({
        retryable: false,
        attempt: 1,
        delayMs: 0,
        source: "not-retryable"
      });
    }
  });

  it("uses bounded exponential backoff when Retry-After is absent", () => {
    const policy = {
      baseDelayMs: 1_000,
      maxDelayMs: 10_000,
      multiplier: 2
    };

    expect(
      [1, 2, 3, 4, 8].map((attempt) =>
        googleProviderRetryDecision({
          status: 429,
          attempt,
          fetchedAt: "2026-06-23T00:00:00.000Z",
          policy
        })
      )
    ).toEqual([
      {
        retryable: true,
        reason: "rate-limited",
        attempt: 1,
        delayMs: 1_000,
        nextAttemptAt: "2026-06-23T00:00:01.000Z",
        source: "exponential-backoff"
      },
      {
        retryable: true,
        reason: "rate-limited",
        attempt: 2,
        delayMs: 2_000,
        nextAttemptAt: "2026-06-23T00:00:02.000Z",
        source: "exponential-backoff"
      },
      {
        retryable: true,
        reason: "rate-limited",
        attempt: 3,
        delayMs: 4_000,
        nextAttemptAt: "2026-06-23T00:00:04.000Z",
        source: "exponential-backoff"
      },
      {
        retryable: true,
        reason: "rate-limited",
        attempt: 4,
        delayMs: 8_000,
        nextAttemptAt: "2026-06-23T00:00:08.000Z",
        source: "exponential-backoff"
      },
      {
        retryable: true,
        reason: "rate-limited",
        attempt: 8,
        delayMs: 10_000,
        nextAttemptAt: "2026-06-23T00:00:10.000Z",
        source: "exponential-backoff"
      }
    ]);
  });

  it("honors Retry-After seconds and HTTP dates while preserving max delay", () => {
    expect(
      googleProviderRetryDecision({
        status: 503,
        retryAfter: "7",
        attempt: 1,
        fetchedAt: "2026-06-23T00:00:00.000Z"
      })
    ).toMatchObject({
      retryable: true,
      delayMs: 7_000,
      nextAttemptAt: "2026-06-23T00:00:07.000Z",
      source: "retry-after"
    });

    expect(
      googleProviderRetryDecision({
        status: 503,
        retryAfter: "Tue, 23 Jun 2026 00:02:00 GMT",
        attempt: 1,
        fetchedAt: "2026-06-23T00:00:00.000Z",
        policy: { maxDelayMs: 60_000 }
      })
    ).toMatchObject({
      retryable: true,
      delayMs: 60_000,
      nextAttemptAt: "2026-06-23T00:01:00.000Z",
      source: "retry-after"
    });
  });

  it("validates retry policy values", () => {
    expect(defaultGoogleProviderRetryPolicy).toEqual({
      baseDelayMs: 1_000,
      maxDelayMs: 60_000,
      multiplier: 2
    });
    expect(() => googleProviderRetryPolicy({ baseDelayMs: 0 })).toThrow(
      "baseDelayMs"
    );
    expect(() => googleProviderRetryPolicy({ maxDelayMs: 0 })).toThrow(
      "maxDelayMs"
    );
    expect(() => googleProviderRetryPolicy({ multiplier: 0 })).toThrow(
      "multiplier"
    );
  });
});
