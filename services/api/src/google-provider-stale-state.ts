import type { ExternalObservationFreshness } from "./types.js";

export type GoogleProviderFreshnessInput = {
  observedAt: string;
  fetchedAt: string;
};

export type GoogleProviderFreshnessThresholds = {
  freshMaxAgeDays: number;
  staleMaxAgeDays: number;
};

export type GoogleProviderFreshnessState = {
  freshness: ExternalObservationFreshness;
  ageDays?: number;
  threshold: GoogleProviderFreshnessThresholds;
  reason:
    | "within-fresh-window"
    | "within-stale-window"
    | "beyond-stale-window"
    | "invalid-observation-timestamp";
};

export const defaultGoogleProviderFreshnessThresholds: GoogleProviderFreshnessThresholds =
  {
    freshMaxAgeDays: 7,
    staleMaxAgeDays: 30
  };

export function googleProviderFreshnessState(
  input: GoogleProviderFreshnessInput,
  thresholds: Partial<GoogleProviderFreshnessThresholds> = {}
): GoogleProviderFreshnessState {
  const threshold = googleProviderFreshnessThresholds(thresholds);
  const observed = Date.parse(input.observedAt);
  const fetched = Date.parse(input.fetchedAt);
  if (!Number.isFinite(observed) || !Number.isFinite(fetched)) {
    return {
      freshness: "unknown",
      threshold,
      reason: "invalid-observation-timestamp"
    };
  }

  const ageDays = Math.max(0, (fetched - observed) / 86_400_000);
  if (ageDays <= threshold.freshMaxAgeDays) {
    return {
      freshness: "fresh",
      ageDays,
      threshold,
      reason: "within-fresh-window"
    };
  }
  if (ageDays <= threshold.staleMaxAgeDays) {
    return {
      freshness: "stale",
      ageDays,
      threshold,
      reason: "within-stale-window"
    };
  }
  return {
    freshness: "expired",
    ageDays,
    threshold,
    reason: "beyond-stale-window"
  };
}

export function googleProviderFreshnessThresholds(
  thresholds: Partial<GoogleProviderFreshnessThresholds> = {}
): GoogleProviderFreshnessThresholds {
  const merged = {
    ...defaultGoogleProviderFreshnessThresholds,
    ...thresholds
  };
  if (merged.freshMaxAgeDays < 0) {
    throw new Error("Google freshness freshMaxAgeDays must be non-negative.");
  }
  if (merged.staleMaxAgeDays < merged.freshMaxAgeDays) {
    throw new Error(
      "Google freshness staleMaxAgeDays must be greater than or equal to freshMaxAgeDays."
    );
  }
  return merged;
}
