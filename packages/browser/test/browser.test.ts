import { describe, expect, it } from "vitest";

import { createBrowserRenderedDomSnapshot } from "../src/index.js";

describe("createBrowserRenderedDomSnapshot", () => {
  it("creates a rendered DOM page snapshot from explicit inputs", () => {
    const snapshot = createBrowserRenderedDomSnapshot({
      document: {
        documentElement: {
          outerHTML:
            "<html><head><title>Product</title></head><body><h1>Product</h1></body></html>"
        }
      },
      url: "https://example.com/products/1?ref=test",
      capturedAt: "2026-06-21T00:00:00.000Z",
      rawHtml: "<html><body>loading</body></html>"
    });

    expect(snapshot).toEqual({
      pageUrl: "https://example.com/products/1?ref=test",
      route: "/products/1",
      capturedAt: "2026-06-21T00:00:00.000Z",
      rawHtml: "<html><body>loading</body></html>",
      renderedDom:
        "<html><head><title>Product</title></head><body><h1>Product</h1></body></html>"
    });
  });

  it("uses an explicit route when the caller provides one", () => {
    const snapshot = createBrowserRenderedDomSnapshot({
      document: { documentElement: { outerHTML: "<html></html>" } },
      url: "https://example.com/products/1",
      route: "/products/[id]",
      capturedAt: "2026-06-21T00:00:00.000Z"
    });

    expect(snapshot.route).toBe("/products/[id]");
  });

  it("does not fabricate rendered DOM when documentElement HTML is unavailable", () => {
    const snapshot = createBrowserRenderedDomSnapshot({
      document: {},
      url: "not a url",
      capturedAt: "2026-06-21T00:00:00.000Z"
    });

    expect(snapshot).toEqual({
      pageUrl: "not a url",
      route: "/",
      capturedAt: "2026-06-21T00:00:00.000Z",
      renderedDom: ""
    });
  });
});
