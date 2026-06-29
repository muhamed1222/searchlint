import { describe, expect, it } from "vitest";

import { createMemoryDistributedRateLimitStore } from "../src/index.js";

describe("createMemoryDistributedRateLimitStore", () => {
  it("allows requests until the fixed-window limit is reached", async () => {
    const store = createMemoryDistributedRateLimitStore();

    await expect(
      store.consume({
        key: "tenant:1",
        limit: 2,
        windowMs: 1000,
        now: 100
      })
    ).resolves.toEqual({
      allowed: true,
      remaining: 1,
      resetAt: 1100
    });
    await expect(
      store.consume({
        key: "tenant:1",
        limit: 2,
        windowMs: 1000,
        now: 200
      })
    ).resolves.toEqual({
      allowed: true,
      remaining: 0,
      resetAt: 1100
    });
    await expect(
      store.consume({
        key: "tenant:1",
        limit: 2,
        windowMs: 1000,
        now: 300
      })
    ).resolves.toEqual({
      allowed: false,
      remaining: 0,
      resetAt: 1100,
      reason: "rate limit exceeded"
    });
  });

  it("tracks keys independently", async () => {
    const store = createMemoryDistributedRateLimitStore();

    await store.consume({
      key: "tenant:1",
      limit: 1,
      windowMs: 1000,
      now: 100
    });

    await expect(
      store.consume({
        key: "tenant:2",
        limit: 1,
        windowMs: 1000,
        now: 100
      })
    ).resolves.toMatchObject({
      allowed: true
    });
  });

  it("resets the fixed window after windowMs elapses", async () => {
    const store = createMemoryDistributedRateLimitStore();

    await store.consume({
      key: "tenant:1",
      limit: 1,
      windowMs: 1000,
      now: 100
    });

    await expect(
      store.consume({
        key: "tenant:1",
        limit: 1,
        windowMs: 1000,
        now: 1100
      })
    ).resolves.toEqual({
      allowed: true,
      remaining: 0,
      resetAt: 2100
    });
  });
});
