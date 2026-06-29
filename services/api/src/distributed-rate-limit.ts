export type DistributedRateLimitInput = {
  key: string;
  limit: number;
  windowMs: number;
  now: number;
};

export type DistributedRateLimitDecision =
  | {
      allowed: true;
      remaining: number;
      resetAt: number;
    }
  | {
      allowed: false;
      remaining: number;
      resetAt: number;
      reason?: string;
    };

export type DistributedRateLimitStore = {
  consume(
    input: DistributedRateLimitInput
  ): Promise<DistributedRateLimitDecision>;
};

export type MemoryDistributedRateLimitStoreOptions = {
  clock?: {
    now(): number;
  };
};

type RateLimitBucket = {
  count: number;
  windowStartedAt: number;
};

export function createMemoryDistributedRateLimitStore(
  options: MemoryDistributedRateLimitStoreOptions = {}
): DistributedRateLimitStore {
  const buckets = new Map<string, RateLimitBucket>();

  return {
    async consume(input) {
      const now = options.clock?.now() ?? input.now;
      const bucket = buckets.get(input.key);

      if (!bucket || now - bucket.windowStartedAt >= input.windowMs) {
        buckets.set(input.key, {
          count: 1,
          windowStartedAt: now
        });
        return {
          allowed: true,
          remaining: input.limit - 1,
          resetAt: now + input.windowMs
        };
      }

      const resetAt = bucket.windowStartedAt + input.windowMs;
      if (bucket.count >= input.limit) {
        return {
          allowed: false,
          remaining: 0,
          resetAt,
          reason: "rate limit exceeded"
        };
      }

      bucket.count += 1;
      return {
        allowed: true,
        remaining: input.limit - bucket.count,
        resetAt
      };
    }
  };
}
