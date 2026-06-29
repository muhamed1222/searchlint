import { describe, expect, it } from "vitest";

import {
  defaultGoogleProviderFreshnessThresholds,
  googleProviderFreshnessState,
  googleProviderFreshnessThresholds
} from "../src/index.js";

describe("googleProviderFreshnessState", () => {
  it("classifies observations inside the fresh window", () => {
    expect(
      googleProviderFreshnessState({
        observedAt: "2026-06-16T00:00:00.000Z",
        fetchedAt: "2026-06-23T00:00:00.000Z"
      })
    ).toEqual({
      freshness: "fresh",
      ageDays: 7,
      threshold: defaultGoogleProviderFreshnessThresholds,
      reason: "within-fresh-window"
    });
  });

  it("classifies observations inside the stale window", () => {
    expect(
      googleProviderFreshnessState({
        observedAt: "2026-06-01T00:00:00.000Z",
        fetchedAt: "2026-06-23T00:00:00.000Z"
      })
    ).toEqual({
      freshness: "stale",
      ageDays: 22,
      threshold: defaultGoogleProviderFreshnessThresholds,
      reason: "within-stale-window"
    });
  });

  it("classifies observations beyond the stale window as expired", () => {
    expect(
      googleProviderFreshnessState({
        observedAt: "2026-05-01T00:00:00.000Z",
        fetchedAt: "2026-06-23T00:00:00.000Z"
      })
    ).toEqual({
      freshness: "expired",
      ageDays: 53,
      threshold: defaultGoogleProviderFreshnessThresholds,
      reason: "beyond-stale-window"
    });
  });

  it("classifies invalid timestamps as unknown", () => {
    expect(
      googleProviderFreshnessState({
        observedAt: "not-a-date",
        fetchedAt: "2026-06-23T00:00:00.000Z"
      })
    ).toEqual({
      freshness: "unknown",
      threshold: defaultGoogleProviderFreshnessThresholds,
      reason: "invalid-observation-timestamp"
    });
  });

  it("supports explicit thresholds and validates them", () => {
    expect(
      googleProviderFreshnessState(
        {
          observedAt: "2026-06-18T00:00:00.000Z",
          fetchedAt: "2026-06-23T00:00:00.000Z"
        },
        {
          freshMaxAgeDays: 3,
          staleMaxAgeDays: 10
        }
      ).freshness
    ).toBe("stale");

    expect(() =>
      googleProviderFreshnessThresholds({ freshMaxAgeDays: -1 })
    ).toThrow("freshMaxAgeDays");
    expect(() =>
      googleProviderFreshnessThresholds({
        freshMaxAgeDays: 10,
        staleMaxAgeDays: 7
      })
    ).toThrow("staleMaxAgeDays");
  });
});
