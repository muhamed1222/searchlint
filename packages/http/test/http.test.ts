import { describe, expect, it } from "vitest";

import {
  createHttpSnapshotFragment,
  normalizeHeaders,
  normalizeRedirectChain
} from "../src/index.js";

describe("normalizeHeaders", () => {
  it("lowercases names and joins multi-value headers", () => {
    expect(
      normalizeHeaders({
        "Content-Type": " text/html; charset=utf-8 ",
        "X-Robots-Tag": ["noindex", "nofollow"],
        "X-Empty": undefined
      })
    ).toEqual({
      "content-type": "text/html; charset=utf-8",
      "x-robots-tag": "noindex, nofollow"
    });
  });
});

describe("normalizeRedirectChain", () => {
  it("removes empty redirect entries without changing URL order", () => {
    expect(
      normalizeRedirectChain([
        " https://example.com/a ",
        "",
        "https://example.com/b"
      ])
    ).toEqual(["https://example.com/a", "https://example.com/b"]);
  });
});

describe("createHttpSnapshotFragment", () => {
  it("normalizes observed HTTP data into a PageSnapshot fragment", () => {
    expect(
      createHttpSnapshotFragment({
        finalUrl: "https://example.com/final",
        statusCode: 200,
        headers: [["Content-Type", "text/html"]],
        redirectChain: ["https://example.com/start"],
        responseTimingMs: 123,
        fetchedAt: "2026-06-20T00:00:01.000Z"
      })
    ).toEqual({
      http: {
        finalUrl: "https://example.com/final",
        statusCode: 200,
        headers: { "content-type": "text/html" },
        redirectChain: ["https://example.com/start"],
        contentType: "text/html",
        responseTimingMs: 123,
        fetchedAt: "2026-06-20T00:00:01.000Z"
      }
    });
  });
});
