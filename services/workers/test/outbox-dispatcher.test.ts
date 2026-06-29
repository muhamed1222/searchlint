import { describe, expect, it } from "vitest";

import { dispatchOutboxBatch } from "../src/index.js";
import type {
  DispatchOutboxBatchInput,
  OutboxDispatchStore,
  OutboxPublisher,
  OutboxRetryPolicy
} from "../src/index.js";
import type { CloudOutboxEvent, CrawlJobPayload } from "@searchlint/api";

const createdAt = "2026-06-21T00:00:00.000Z";
const retryAt = "2026-06-21T00:01:00.000Z";

describe("dispatchOutboxBatch", () => {
  it("returns zero counts for empty batches", async () => {
    const harness = createHarness([]);

    await expect(dispatchOutboxBatch(harness.input)).resolves.toEqual({
      selected: 0,
      leased: 0,
      published: 0,
      failed: 0,
      skipped: 0
    });
    expect(harness.events).toEqual(["store:selectPending"]);
  });

  it("leases before publishing and marks the event published", async () => {
    const event = outboxEvent("outbox-1");
    const harness = createHarness([event]);

    await expect(dispatchOutboxBatch(harness.input)).resolves.toEqual({
      selected: 1,
      leased: 1,
      published: 1,
      failed: 0,
      skipped: 0
    });
    expect(harness.publishedPayloads).toEqual([event.payload]);
    expect(harness.events).toEqual([
      "store:selectPending",
      "store:markProcessing:outbox-1",
      "publisher:crawl.requested:crawl-1",
      "store:markPublished:outbox-1"
    ]);
  });

  it("marks events failed with retry availability when publish fails", async () => {
    const harness = createHarness([outboxEvent("outbox-1")], {
      failPublish: true
    });

    await expect(dispatchOutboxBatch(harness.input)).resolves.toEqual({
      selected: 1,
      leased: 1,
      published: 0,
      failed: 1,
      skipped: 0
    });
    expect(harness.failedEvents).toEqual([
      {
        organizationId: "org-1",
        id: "outbox-1",
        lastError: "SQS unavailable",
        availableAt: retryAt
      }
    ]);
  });

  it("skips events that cannot be leased", async () => {
    const harness = createHarness([outboxEvent("outbox-1")], {
      leaseIds: new Set()
    });

    await expect(dispatchOutboxBatch(harness.input)).resolves.toEqual({
      selected: 1,
      leased: 0,
      published: 0,
      failed: 0,
      skipped: 1
    });
    expect(harness.publishedPayloads).toEqual([]);
  });

  it("marks unsupported topics failed and does not publish", async () => {
    const event = {
      ...outboxEvent("outbox-1"),
      topic: "unknown.topic" as CloudOutboxEvent["topic"]
    };
    const harness = createHarness([event]);

    await expect(dispatchOutboxBatch(harness.input)).resolves.toEqual({
      selected: 1,
      leased: 1,
      published: 0,
      failed: 1,
      skipped: 0
    });
    expect(harness.publishedPayloads).toEqual([]);
    expect(harness.failedEvents[0]?.lastError).toBe(
      "Unsupported outbox topic unknown.topic."
    );
  });

  it("rejects invalid batch limits before selecting work", async () => {
    const harness = createHarness([outboxEvent("outbox-1")]);

    await expect(
      dispatchOutboxBatch({
        ...harness.input,
        limit: 0
      })
    ).rejects.toThrow("Outbox dispatch limit must be a positive integer.");
    expect(harness.events).toEqual([]);
  });
});

function createHarness(
  events: readonly CloudOutboxEvent[],
  options: {
    failPublish?: boolean;
    leaseIds?: Set<string>;
  } = {}
) {
  const observedEvents: string[] = [];
  const publishedPayloads: CrawlJobPayload[] = [];
  const failedEvents: {
    organizationId: string;
    id: string;
    lastError: string;
    availableAt: string;
  }[] = [];
  const leaseIds = options.leaseIds ?? new Set(events.map((event) => event.id));
  const store: OutboxDispatchStore = {
    async selectPending() {
      observedEvents.push("store:selectPending");
      return events;
    },
    async markProcessing(input) {
      observedEvents.push(`store:markProcessing:${input.id}`);
      if (!leaseIds.has(input.id)) {
        return undefined;
      }
      return events.find((event) => event.id === input.id);
    },
    async markPublished(input) {
      observedEvents.push(`store:markPublished:${input.id}`);
      return events.find((event) => event.id === input.id);
    },
    async markFailed(input) {
      observedEvents.push(`store:markFailed:${input.id}`);
      failedEvents.push(input);
      return events.find((event) => event.id === input.id);
    }
  };
  const publisher: OutboxPublisher = {
    async publishCrawlRequested(payload) {
      observedEvents.push(
        `publisher:crawl.requested:${payload.crawlRequestId}`
      );
      if (options.failPublish === true) {
        throw new Error("SQS unavailable");
      }
      publishedPayloads.push(payload);
    }
  };
  const retryPolicy: OutboxRetryPolicy = {
    nextAvailableAt() {
      return retryAt;
    }
  };
  const input: DispatchOutboxBatchInput = {
    store,
    publisher,
    retryPolicy,
    clock: {
      now() {
        return createdAt;
      }
    },
    limit: 25
  };

  return {
    input,
    events: observedEvents,
    publishedPayloads,
    failedEvents
  };
}

function outboxEvent(id: string): CloudOutboxEvent {
  return {
    id,
    organizationId: "org-1",
    topic: "crawl.requested",
    payload: {
      crawlRequestId: "crawl-1",
      organizationId: "org-1",
      projectId: "project-1",
      environmentId: "env-1",
      maxUrls: 500
    },
    status: "pending",
    attempts: 0,
    createdAt,
    availableAt: createdAt
  };
}
